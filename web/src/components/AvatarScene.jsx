import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy,
} from '@pixiv/three-vrm-animation'
import { createBlinkState, updateBlink } from '../animations/idle.js'
import { createHumanoidAnimationClip } from '../animations/createHumanoidAnimation.js'
import { createAvatarAnimationController } from '../animations/avatarAnimationController.js'
import { disableUnwantedSpringBones } from '../animations/avatarPhysics.js'
import { createWaveState, triggerWave, applyRestPose, updateWave } from '../animations/wave.js'
import { createLipSyncState, startSpeaking, stopSpeaking, updateLipSync } from '../animations/lipsync.js'
import {
  createSpeakingFaceState,
  startSpeakingFace,
  stopSpeakingFace,
  updateSpeakingFace,
} from '../animations/speakingFace.js'
import { createClassroomInspector } from '../classroom/classroomInspector.js'
import {
  createClassroomMovementEnvironment,
  createCollisionDebugView,
} from '../classroom/classroomMovementEnvironment.js'
import { createAvatarMovementController } from '../classroom/avatarMovementController.js'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001').replace(/\/$/, '')
const MAX_CHAT_MESSAGES = 20
const WELCOME_PROMPT = 'Hi, I\u2019m Esme. What kind of songs do you like? You can name a genre, artist, mood, or activity.'
const PAGE_PARAMETERS = new URLSearchParams(window.location.search)
const CLASSROOM_INSPECTION_ENABLED = import.meta.env.DEV
  && PAGE_PARAMETERS.get('inspectClassroom') === '1'
const COLLISION_DEBUG_ENABLED = import.meta.env.DEV
  && PAGE_PARAMETERS.get('debugCollisions') === '1'
const LONG_IDLE_ANIMATION_IDS = ['VRMA_01', 'VRMA_03', 'VRMA_06']

export default function AvatarScene() {
  const canvasRef  = useRef(null)
  const vrmRef     = useRef(null)
  const waveRef         = useRef(createWaveState())
  const triggerRef      = useRef(null)
  const speakRef        = useRef(null)
  const inputRef        = useRef(null)
  const startLipSyncRef = useRef(null)
  const stopLipSyncRef  = useRef(null)
  const analyserRef     = useRef(null)
  const analyserDataRef = useRef(null)
  const animationControllerRef = useRef(null)
  const openingGreetingActionRef = useRef(null)
  const openingGreetingPlayedRef = useRef(false)
  const [messages,      setMessages]      = useState([])
  const [loading,       setLoading]       = useState(false)
  const [pickedSongs,   setPickedSongs]   = useState([])
  const [loaderVisible, setLoaderVisible] = useState(true)
  const [loaderFading,  setLoaderFading]  = useState(false)
  const [profileBuilt,       setProfileBuilt]       = useState(false)
  const [voiceEnabled,       setVoiceEnabled]       = useState(true)
  const [useElevenLabs,      setUseElevenLabs]      = useState(false)
  const [elevenLabsAvailable, setElevenLabsAvailable] = useState(false)
  const [transcriptOpen,     setTranscriptOpen]     = useState(false)
  const [inspectedClassroomMesh, setInspectedClassroomMesh] = useState(null)
  const [openingGreetingReady, setOpeningGreetingReady] = useState(false)
  const messagesRef      = useRef([])
  const voiceEnabledRef  = useRef(true)
  const useElevenlabsRef = useRef(true)

  useEffect(() => { messagesRef.current      = messages      }, [messages])
  useEffect(() => { voiceEnabledRef.current  = voiceEnabled  }, [voiceEnabled])
  useEffect(() => { useElevenlabsRef.current = useElevenLabs }, [useElevenLabs])

  const chatLimitReached = messages.length >= MAX_CHAT_MESSAGES
  const latestEsmeMessage = messages.slice().reverse().find(message => message.role === 'assistant')

  useEffect(() => {
    fetch(`${API_BASE_URL}/tts/available`)
      .then(r => r.json())
      .then(data => {
        setElevenLabsAvailable(data.elevenlabs)
        setUseElevenLabs(data.elevenlabs)
        useElevenlabsRef.current = data.elevenlabs
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (pickedSongs.length === 5 && !profileBuilt) {
      setProfileBuilt(true)
      const songList = pickedSongs.map(s => `"${s.title}" by ${s.artist}`).join(', ')
      const autoMsg  = `I just picked 5 songs I love: ${songList}. Based on these picks, what can you tell about my music taste? Please recommend new songs I haven't heard — do not suggest any of the songs I just listed.`
      sendMessage(autoMsg)
    }
  }, [pickedSongs])

  useEffect(() => {
    const fadeTimer = setTimeout(() => setLoaderFading(true), 3000)
    const hideTimer = setTimeout(() => setLoaderVisible(false), 3600)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])

  useEffect(() => {
    if (
      loaderVisible
      || !openingGreetingReady
      || openingGreetingPlayedRef.current
    ) {
      return
    }

    openingGreetingPlayedRef.current = true
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animationControllerRef.current?.playContextual(
        openingGreetingActionRef.current,
      )
    }
    speakRef.current?.(WELCOME_PROMPT)
  }, [loaderVisible, openingGreetingReady])

  useEffect(() => {
    const canvas = canvasRef.current
    let disposed = false
    let disposeClassroomInspector = null
    let movementEnvironment = null
    let movementController = null
    let collisionDebugView = null
    let animationController = null
    let mixer = null
    const contextualActions = new Map()
    const contextualLoads = new Map()

    function loadVrmaAction(id) {
      if (disposed) return Promise.resolve(null)
      if (contextualActions.has(id)) {
        return Promise.resolve(contextualActions.get(id))
      }
      if (contextualLoads.has(id)) {
        return contextualLoads.get(id)
      }

      const loadPromise = new Promise((resolve, reject) => {
        loader.load(
          `/vrma/${id}.vrma`,
          (gltf) => {
            if (disposed) {
              resolve(null)
              return
            }

            const vrmAnimation = gltf.userData.vrmAnimations?.[0]
            if (!vrmAnimation || !vrmRef.current || !mixer) {
              reject(new Error(`${id} did not contain a usable VRM animation.`))
              return
            }

            const clip = createVRMAnimationClip(vrmAnimation, vrmRef.current)
            clip.name = id
            const action = mixer.clipAction(clip)
            contextualActions.set(id, action)
            resolve(action)
          },
          undefined,
          reject,
        )
      })

      contextualLoads.set(id, loadPromise)
      return loadPromise
    }

    function startMovementIfReady() {
      if (
        CLASSROOM_INSPECTION_ENABLED
        || movementController
        || !movementEnvironment
        || !vrmRef.current
      ) {
        return
      }

      movementController = createAvatarMovementController({
        avatarRoot: vrmRef.current.scene,
        camera,
        canvas,
        environment: movementEnvironment,
      })
      if (COLLISION_DEBUG_ENABLED) {
        window.__ESME_MOVEMENT__ = movementController
      }
    }

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.outputColorSpace = THREE.SRGBColorSpace

    // Scene
    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20)
    camera.position.set(-0.4, 1.4, -4.0)
    camera.lookAt(0, 1.4, 0)

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(1, 2, -2)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3)
    fillLight.position.set(-2, 1, -1)
    scene.add(fillLight)

    // Shared loader
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser))

    // Classroom environment
    loader.load(
      '/Classroom/scene.gltf',
      (gltf) => {
        if (disposed) return

        scene.add(gltf.scene)
        movementEnvironment = createClassroomMovementEnvironment({
          classroomRoot: gltf.scene,
          parser: gltf.parser,
        })
        if (COLLISION_DEBUG_ENABLED) {
          collisionDebugView = createCollisionDebugView(
            scene,
            movementEnvironment,
          )
        }
        startMovementIfReady()

        if (CLASSROOM_INSPECTION_ENABLED) {
          disposeClassroomInspector = createClassroomInspector({
            canvas,
            camera,
            scene,
            classroomRoot: gltf.scene,
            parser: gltf.parser,
            onSelection: setInspectedClassroomMesh,
          })
        }
      },
      undefined,
      (err) => {
        if (!disposed) console.error('Classroom load error:', err)
      },
    )

    // Lip sync state
    const lipSync = createLipSyncState()
    const speakingFace = createSpeakingFaceState()
    startLipSyncRef.current = () => {
      startSpeaking(lipSync)
      startSpeakingFace(speakingFace)
      animationControllerRef.current?.setSpeaking(true)
    }
    stopLipSyncRef.current = () => {
      stopSpeaking(lipSync, vrmRef.current)
      stopSpeakingFace(speakingFace)
      animationControllerRef.current?.setSpeaking(false)
    }

    // TTS — exposed to speak button
    speakRef.current = (text) => {
      if (!text.trim() || !vrmRef.current) return
      window.speechSynthesis.cancel()
      const utterance       = new SpeechSynthesisUtterance(text)
      utterance.onstart     = () => startLipSyncRef.current?.()
      utterance.onend       = () => stopLipSyncRef.current?.()
      utterance.onerror     = () => stopLipSyncRef.current?.()
      window.speechSynthesis.speak(utterance)
    }

    // Load VRM
    loader.load(
      '/Esme.vrm',
      (gltf) => {
        if (disposed) return

        const vrm = gltf.userData.vrm
        disableUnwantedSpringBones(vrm)
        VRMUtils.removeUnnecessaryJoints(vrm.scene)
        scene.add(vrm.scene)
        vrmRef.current = vrm
        applyRestPose(vrm)
        startMovementIfReady()

        // The animation library creates this proxy implicitly and warns. Creating
        // the same proxy here keeps look-at tracks explicit and the console clean.
        if (vrm.lookAt) {
          const lookAtProxy = new VRMLookAtQuaternionProxy(vrm.lookAt)
          lookAtProxy.name = 'VRMLookAtQuaternionProxy'
          vrm.scene.add(lookAtProxy)
        }

        loader.load(
          '/animations/UAL1_Standard.glb',
          (animationGltf) => {
            if (disposed) return

            mixer = new THREE.AnimationMixer(vrm.scene)
            const actionFor = (name) => {
              const sourceClip = animationGltf.animations.find(
                animation => animation.name === name,
              )
              if (!sourceClip) return null

              const clip = createHumanoidAnimationClip({
                sourceScene: animationGltf.scene,
                sourceClip,
                vrm,
              })
              return mixer.clipAction(clip)
            }

            const coreActions = {
              idle: actionFor('Idle_Loop'),
              talking: actionFor('Idle_Talking_Loop'),
              walking: actionFor('Walk_Formal_Loop'),
              running: actionFor('Jog_Fwd_Loop'),
            }
            if (Object.values(coreActions).some(action => !action)) {
              console.error(
                'Animation load error: a required idle, talking, walking, or running clip was not found.',
              )
              return
            }

            animationController = createAvatarAnimationController({
              mixer,
              actions: coreActions,
              idleVariationsEnabled: !window.matchMedia(
                '(prefers-reduced-motion: reduce)',
              ).matches,
            })
            animationControllerRef.current = animationController
            Promise.all(LONG_IDLE_ANIMATION_IDS.map(loadVrmaAction))
              .then((actions) => {
                if (
                  !disposed
                  && animationControllerRef.current === animationController
                ) {
                  animationController.setIdleVariations(actions)
                }
              })
              .catch(error => console.error('Long-idle animation load error:', error))
            loadVrmaAction('VRMA_02')
              .then((action) => {
                if (
                  !disposed
                  && animationControllerRef.current === animationController
                ) {
                  openingGreetingActionRef.current = action
                  setOpeningGreetingReady(true)
                }
              })
              .catch(error => console.error('Opening greeting load error:', error))
          },
          undefined,
          (err) => {
            if (!disposed) console.error('Animation load error:', err)
          },
        )
      },
      undefined,
      (err) => {
        if (!disposed) console.error('VRM load error:', err)
      },
    )

    // Wave trigger
    triggerRef.current = () => triggerWave(waveRef)

    // Blink state
    const blinkState = createBlinkState()

    // Render loop
    const clock = new THREE.Clock()
    let animId

    function animate() {
      animId = requestAnimationFrame(animate)
      const delta   = clock.getDelta()
      const vrm     = vrmRef.current

      const movement = movementController?.update(delta) ?? {
        moving: false,
        running: false,
      }

      if (vrm) {
        animationController?.setMoving(
          movement.moving,
          { running: movement.running },
        )
        animationController?.update(delta)
        updateBlink(vrm, blinkState, delta)
        if (analyserRef.current && analyserDataRef.current) {
          analyserRef.current.getByteFrequencyData(analyserDataRef.current)
          const avg   = analyserDataRef.current.reduce((a, b) => a + b, 0) / analyserDataRef.current.length
          const value = Math.min((avg / 80) * 0.9, 0.9)
          vrm.expressionManager?.setValue('aa', value)
          const jaw = vrm.humanoid?.getNormalizedBoneNode('jaw')
          if (jaw) jaw.rotation.x = value * 0.3
        } else {
          updateLipSync(vrm, lipSync, delta)
        }
        updateSpeakingFace(
          vrm,
          speakingFace,
          delta,
          { enabled: animationController?.getState() !== 'contextual' },
        )
        updateWave(vrm, waveRef, delta)
        vrm.update(delta)
      }

      renderer.render(scene, camera)
    }

    animate()

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      window.speechSynthesis.cancel()
      disposeClassroomInspector?.()
      movementController?.dispose()
      movementController = null
      animationController?.dispose()
      animationController = null
      animationControllerRef.current = null
      openingGreetingActionRef.current = null
      delete window.__ESME_MOVEMENT__
      collisionDebugView?.dispose()
      renderer.dispose()
    }
  }, [])

  async function speak(text) {
    if (!voiceEnabledRef.current || !text.trim()) return

    if (useElevenlabsRef.current) {
      try {
        const res = await fetch(`${API_BASE_URL}/tts`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ text }),
        })
        if (!res.ok) throw new Error('ElevenLabs unavailable')
        const blob     = await res.blob()
        const url      = URL.createObjectURL(blob)
        const audio    = new Audio(url)
        const audioCtx = new AudioContext()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        const source   = audioCtx.createMediaElementSource(audio)
        source.connect(analyser)
        analyser.connect(audioCtx.destination)
        analyserRef.current     = analyser
        analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount)

        const cleanup = () => {
          analyserRef.current     = null
          analyserDataRef.current = null
          audioCtx.close()
          URL.revokeObjectURL(url)
          stopLipSyncRef.current?.()
        }
        audio.onplay = () => startLipSyncRef.current?.()
        audio.onended = cleanup
        audio.onerror = cleanup
        await audio.play()
        return
      } catch {
        // fall through to browser TTS
      }
    }

    speakRef.current?.(text)
  }

  async function sendMessage(text) {
    // Reserve space for both the user's message and Esme's reply.
    if (messagesRef.current.length + 2 > MAX_CHAT_MESSAGES) return

    const userMsg = { role: 'user', content: text }
    const history = [...messagesRef.current, userMsg]
    const requestHistory = history.slice(-MAX_CHAT_MESSAGES)
    setMessages(history)
    setLoading(true)

    try {
      const res  = await fetch(`${API_BASE_URL}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: requestHistory }),
      })
      if (!res.ok) throw new Error(`Chat request failed with status ${res.status}`)
      const data = await res.json()
      if (!data.response) throw new Error('Chat response did not include a reply')
      const reply = data.response

      setMessages(prev => [...prev, {
        role:    'assistant',
        content: reply,
        songs:   data.recommendations ?? null,
      }])
      speak(reply)
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I couldn't connect right now. Please try again.",
      }])
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    const text = inputRef.current?.value?.trim()
    if (!text || loading || chatLimitReached) return
    inputRef.current.value = ''
    sendMessage(text)
  }

  function startNewChat() {
    messagesRef.current = []
    setMessages([])
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSend()
  }

  function addPick(song) {
    setPickedSongs(prev => {
      if (prev.some(s => s.title === song.title && s.artist === song.artist)) return prev
      return [...prev, song]
    })
  }

  function removePick(index) {
    setPickedSongs(prev => prev.filter((_, i) => i !== index))
  }

  function isPicked(song) {
    return pickedSongs.some(s => s.title === song.title && s.artist === song.artist)
  }

  return (
    <main className="esme-app">
      <canvas ref={canvasRef} className="esme-canvas" />

      {/* Loading screen */}
      {loaderVisible && (
        <div className="loading-screen" style={{
          position:   'fixed',
          inset:      0,
          zIndex:     100,
          display:    'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0a1e 0%, #1e0a3c 50%, #0a0a1e 100%)',
          transition: 'opacity 0.6s ease',
          opacity:    loaderFading ? 0 : 1,
          pointerEvents: loaderFading ? 'none' : 'auto',
        }}>
          {/* Pulsing ring */}
          <div className="loading-screen__ring" style={{
            width:        90,
            height:       90,
            borderRadius: '50%',
            border:       '3px solid rgba(124,58,237,0.2)',
            borderTop:    '3px solid #a855f7',
            animation:    'spin 1.2s linear infinite',
            marginBottom: 32,
          }} />

          <div className="loading-screen__copy" style={{ fontFamily: 'sans-serif', textAlign: 'center' }}>
            <div className="loading-screen__title" style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: 2 }}>
              Esme
            </div>
            <div className="loading-screen__status" style={{ fontSize: 14, color: 'rgba(168,85,247,0.9)', marginTop: 8, letterSpacing: 1 }}>
              ♪ loading your music experience...
            </div>
          </div>

          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Picked songs panel */}
      <section className="liked-panel" aria-label="Liked songs" style={{
        position:       'absolute',
        top:            16,
        left:           16,
        width:          220,
        maxHeight:      '70vh',
        overflowY:      'auto',
        display:        'flex',
        flexDirection:  'column',
        gap:            6,
        fontFamily:     'sans-serif',
      }}>
        <div className="panel-heading" style={{
          color:      '#fff',
          fontSize:   13,
          fontWeight: 600,
          padding:    '6px 10px',
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8,
        }}>
          ♥ Liked Songs ({pickedSongs.length})
        </div>

        {pickedSongs.length === 0 && (
          <div className="panel-empty" style={{
            color:      'rgba(255,255,255,0.4)',
            fontSize:   12,
            padding:    '6px 10px',
          }}>
            Pick songs you like with ❤️
          </div>
        )}

        {pickedSongs.map((s, i) => {
          const safeUrl = safeLastFmUrl(s.url)
          const SongDetails = safeUrl ? 'a' : 'div'
          return (
          <div className="liked-song" key={`${s.title}-${s.artist}`} style={{
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            background:     'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(8px)',
            border:         '1px solid rgba(255,255,255,0.15)',
            borderRadius:   8,
            padding:        '6px 10px',
          }}>
            <SongDetails
              {...(safeUrl ? { href: safeUrl, target: '_blank', rel: 'noreferrer' } : {})}
              className="song-copy"
              style={{ flex: 1, overflow: 'hidden', textDecoration: 'none' }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.title}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.artist}
              </div>
            </SongDetails>
            <button
              className="icon-button"
              onClick={() => removePick(i)}
              title="Remove"
              style={{
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                fontSize:   16,
                color:      '#f87171',
                padding:    '2px 4px',
                lineHeight: 1,
                flexShrink: 0,
                textShadow: '0 0 4px rgba(0,0,0,0.8)',
              }}
            >
              ♥
            </button>
          </div>
          )
        })}
      </section>

      <aside className="esme-response" aria-label="Esme’s latest response" aria-live="polite">
        {latestEsmeMessage?.content ?? WELCOME_PROMPT}
      </aside>

      {/* Chat history */}
      <section className="transcript" aria-label="Conversation transcript" style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 300,
        maxHeight: '60vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'sans-serif',
        display: transcriptOpen ? 'flex' : 'none',
      }}>
        <div className="transcript-heading">
          <strong>Conversation</strong>
          <button className="text-button" onClick={() => setTranscriptOpen(false)}>Close</button>
        </div>
        <div
          aria-label={"Esme\u2019s opening question"}
          style={{ alignSelf: 'flex-start', maxWidth: '90%' }}
        >
          <div style={{
            background:     'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            color:          '#fff',
            padding:        '8px 12px',
            borderRadius:   10,
            fontSize:       13,
          }}>
            {WELCOME_PROMPT}
          </div>
        </div>

        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
            <div style={{
              background:     m.role === 'user' ? '#7c3aed' : 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              color:          '#fff',
              padding:        '8px 12px',
              borderRadius:   10,
              fontSize:       13,
            }}>
              {m.content}
            </div>

            {m.songs && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                {m.songs.map((s, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        flex:           1,
                        display:        'flex',
                        flexDirection:  'column',
                        background:     'rgba(124,58,237,0.3)',
                        backdropFilter: 'blur(8px)',
                        border:         '1px solid rgba(124,58,237,0.5)',
                        borderRadius:   8,
                        padding:        '6px 10px',
                        color:          '#fff',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{s.title}</span>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>{s.artist}</span>
                    </div>
                    <button
                      onClick={() => addPick(s)}
                      title={isPicked(s) ? 'Already picked' : 'Add to picks'}
                      style={{
                        background: 'none',
                        border:     'none',
                        cursor:     isPicked(s) ? 'default' : 'pointer',
                        fontSize:   18,
                        padding:    '4px',
                        lineHeight: 1,
                        color:      isPicked(s) ? '#f472b6' : '#f9a8d4',
                        opacity:    isPicked(s) ? 0.5 : 1,
                        textShadow: '0 0 4px rgba(0,0,0,0.8)',
                        flexShrink: 0,
                      }}
                    >
                      {isPicked(s) ? '❤️' : '🖤'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            Esme is thinking...
          </div>
        )}
      </section>

      {CLASSROOM_INSPECTION_ENABLED && (
        <aside className="classroom-inspector" aria-live="polite">
          <div className="classroom-inspector__heading">Classroom inspection mode</div>
          {inspectedClassroomMesh ? (
            <dl className="classroom-inspector__details">
              <div><dt>Node</dt><dd>{inspectedClassroomMesh.nodeName}</dd></div>
              <div><dt>GLTF node</dt><dd>{inspectedClassroomMesh.nodeIndex ?? 'unknown'}</dd></div>
              <div><dt>GLTF mesh</dt><dd>{inspectedClassroomMesh.meshIndex ?? 'unknown'}</dd></div>
              <div><dt>Primitive</dt><dd>{inspectedClassroomMesh.primitiveIndex ?? 'unknown'}</dd></div>
              <div><dt>Center</dt><dd>{inspectedClassroomMesh.center.join(', ')}</dd></div>
              <div><dt>Size</dt><dd>{inspectedClassroomMesh.size.join(', ')}</dd></div>
              <div><dt>Min</dt><dd>{inspectedClassroomMesh.min.join(', ')}</dd></div>
              <div><dt>Max</dt><dd>{inspectedClassroomMesh.max.join(', ')}</dd></div>
            </dl>
          ) : (
            <p>Click a classroom object to identify its source mesh and world bounds.</p>
          )}
        </aside>
      )}

      {/* Controls */}
      {chatLimitReached && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position:       'absolute',
            bottom:         88,
            left:           '50%',
            transform:      'translateX(-50%)',
            padding:        '8px 12px',
            borderRadius:   8,
            background:     'rgba(15,23,42,0.88)',
            color:          '#fff',
            fontFamily:     'sans-serif',
            fontSize:       13,
            backdropFilter: 'blur(8px)',
            whiteSpace:     'nowrap',
          }}
        >
          You’ve reached the 20-message limit for this chat. Start a new chat to continue.
        </div>
      )}

      <section className="control-dock" aria-label="Talk to Esme" style={{
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        fontFamily: 'sans-serif',
      }}>
        <button className="button button--secondary" onClick={() => triggerRef.current?.()} style={btnStyle('#475569')}>
          Wave Hi 👋
        </button>

        <button
          className="button button--secondary"
          onClick={() => setVoiceEnabled(v => !v)}
          title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
          style={btnStyle(voiceEnabled ? '#475569' : '#1e1e2e')}
        >
          {voiceEnabled ? '🔊 Voice On' : '🔇 Voice Off'}
        </button>

        <button
          className="button button--secondary"
          onClick={() => elevenLabsAvailable && setUseElevenLabs(v => !v)}
          disabled={!elevenLabsAvailable}
          title={!elevenLabsAvailable ? 'Add ELEVENLABS_API_KEY to backend/.env to enable' : useElevenLabs ? 'Switch to browser voice' : 'Switch to ElevenLabs voice'}
          style={{
            ...btnStyle(useElevenLabs && elevenLabsAvailable ? '#6d28d9' : '#374151'),
            opacity: elevenLabsAvailable ? 1 : 0.4,
            cursor:  elevenLabsAvailable ? 'pointer' : 'not-allowed',
          }}
        >
          {useElevenLabs && elevenLabsAvailable ? '✨ ElevenLabs' : '💬 Browser'}
        </button>

        <button
          className="button button--secondary"
          aria-expanded={transcriptOpen}
          onClick={() => setTranscriptOpen(value => !value)}
          style={btnStyle('#475569')}
        >
          {transcriptOpen ? 'Hide transcript' : 'Show transcript'}
        </button>

        <input
          className="composer-input"
          ref={inputRef}
          onKeyDown={handleKeyDown}
          placeholder={chatLimitReached ? 'Start a new chat to continue' : loading ? 'Esme is thinking...' : 'Say something to Esme...'}
          disabled={loading || chatLimitReached}
          style={{
            padding:       '12px 16px',
            borderRadius:  8,
            border:        'none',
            fontSize:      15,
            width:         300,
            outline:       'none',
            background:    'rgba(255,255,255,0.15)',
            color:         '#fff',
            backdropFilter:'blur(8px)',
            opacity:       loading || chatLimitReached ? 0.6 : 1,
          }}
        />

        {chatLimitReached ? (
          <button className="button button--primary" onClick={startNewChat} style={btnStyle('#7c3aed')}>
            Start new chat
          </button>
        ) : (
          <button className="button button--primary" onClick={handleSend} disabled={loading} style={btnStyle('#7c3aed')}>
            {loading ? '...' : 'Send'}
          </button>
        )}
      </section>
    </main>
  )
}

function btnStyle(bg) {
  return {
    padding: '12px 20px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

function safeLastFmUrl(value) {
  if (!value) return null

  try {
    const url = new URL(value)
    const isLastFm = url.hostname === 'last.fm' || url.hostname.endsWith('.last.fm')
    return url.protocol === 'https:' && isLastFm ? url.href : null
  } catch {
    return null
  }
}
