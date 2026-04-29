import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation'
import { updateIdle, createBlinkState, updateBlink } from '../animations/idle.js'
import { createWaveState, triggerWave, applyRestPose, updateWave } from '../animations/wave.js'
import { createLipSyncState, startSpeaking, stopSpeaking, updateLipSync } from '../animations/lipsync.js'

export default function AvatarScene() {
  const canvasRef  = useRef(null)
  const vrmRef     = useRef(null)
  const mixerRef   = useRef(null)
  const waveRef    = useRef(createWaveState())
  const triggerRef = useRef(null)
  const speakRef   = useRef(null)
  const inputRef   = useRef(null)
  const [messages,     setMessages]     = useState([])
  const [loading,      setLoading]      = useState(false)
  const [pickedSongs,  setPickedSongs]  = useState([])

  useEffect(() => {
    const canvas = canvasRef.current

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.outputColorSpace = THREE.SRGBColorSpace

    // Scene
    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20)
    camera.position.set(0, 1.4, -4.0)
    camera.lookAt(0, 1.4, 0)

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(1, 2, -2)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3)
    fillLight.position.set(-2, 1, -1)
    scene.add(fillLight)

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1.4, 0)
    controls.enableDamping = true
    controls.update()

    // Shared loader
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser))

    // Classroom environment
    loader.load(
      '/Classroom/scene.gltf',
      (gltf) => { scene.add(gltf.scene) },
      undefined,
      (err) => console.error('Classroom load error:', err),
    )

    // Lip sync state
    const lipSync = createLipSyncState()

    // TTS — exposed to speak button
    speakRef.current = (text) => {
      if (!text.trim() || !vrmRef.current) return
      window.speechSynthesis.cancel()
      const utterance       = new SpeechSynthesisUtterance(text)
      utterance.onstart     = () => startSpeaking(lipSync)
      utterance.onend       = () => stopSpeaking(lipSync, vrmRef.current)
      utterance.onerror     = () => stopSpeaking(lipSync, vrmRef.current)
      window.speechSynthesis.speak(utterance)
    }

    // Load VRM
    loader.load(
      '/Esme.vrm',
      (gltf) => {
        const vrm = gltf.userData.vrm
        VRMUtils.removeUnnecessaryJoints(vrm.scene)
        scene.add(vrm.scene)
        vrmRef.current = vrm
        applyRestPose(vrm)

        const em = vrm.expressionManager
        if (em?.expressionMap) {
          Object.entries(em.expressionMap).forEach(([name, expr]) => {
            console.log(name, '→', expr._binds?.length ?? 0, 'binds')
          })
        }

        loader.load(
          '/vrma/VRMA_01.vrma',
          (vrmaGltf) => {
            const vrmAnimation = vrmaGltf.userData.vrmAnimations?.[0]
            if (!vrmAnimation) return

            const clip = createVRMAnimationClip(vrmAnimation, vrm)
            clip.tracks = clip.tracks.filter(t => t.name !== 'Normalized_J_Bip_C_Hips.quaternion')
            const mixer  = new THREE.AnimationMixer(vrm.scene)
            mixerRef.current = mixer
            const action = mixer.clipAction(clip)
            action.setLoop(THREE.LoopPingPong, Infinity)
            action.play()
          },
          undefined,
          (err) => console.error('VRMA load error:', err),
        )
      },
      (p) => console.log(`Loading... ${((p.loaded / p.total) * 100).toFixed(0)}%`),
      (err) => console.error('VRM load error:', err),
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
      const elapsed = clock.elapsedTime
      const vrm     = vrmRef.current

      if (vrm) {
        mixerRef.current?.update(delta)
        updateIdle(vrm, elapsed)
        updateBlink(vrm, blinkState, delta)
        updateLipSync(vrm, lipSync, delta)
        updateWave(vrm, waveRef, delta)
        vrm.update(delta)
      }

      controls.update()
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
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      window.speechSynthesis.cancel()
      renderer.dispose()
    }
  }, [])

  async function handleSend() {
    const text = inputRef.current?.value?.trim()
    if (!text || loading) return
    inputRef.current.value = ''

    const userMsg = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setLoading(true)

    try {
      const res  = await fetch('http://localhost:8001/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history }),
      })
      const data = await res.json()
      const reply = data.response

      setMessages(prev => [...prev, {
        role:  'assistant',
        content: reply,
        songs: data.recommendations ?? null,
      }])
      speakRef.current?.(reply)
    } catch (err) {
      console.error('Chat error:', err)
    } finally {
      setLoading(false)
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
    <>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100vw', height: '100vh' }} />

      {/* Picked songs panel */}
      <div style={{
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
        <div style={{
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
          <div style={{
            color:      'rgba(255,255,255,0.4)',
            fontSize:   12,
            padding:    '6px 10px',
          }}>
            Pick songs you like with ❤️
          </div>
        )}

        {pickedSongs.map((s, i) => (
          <div key={i} style={{
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            background:     'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(8px)',
            border:         '1px solid rgba(255,255,255,0.15)',
            borderRadius:   8,
            padding:        '6px 10px',
          }}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              style={{ flex: 1, overflow: 'hidden', textDecoration: 'none' }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.title}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.artist}
              </div>
            </a>
            <button
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
        ))}
      </div>

      {/* Chat history */}
      <div style={{
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
      }}>
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
      </div>

      {/* Controls */}
      <div style={{
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        fontFamily: 'sans-serif',
      }}>
        <button onClick={() => triggerRef.current?.()} style={btnStyle('#475569')}>
          Wave Hi 👋
        </button>

        <input
          ref={inputRef}
          onKeyDown={handleKeyDown}
          placeholder="Say something to Esme..."
          disabled={loading}
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
            opacity:       loading ? 0.6 : 1,
          }}
        />

        <button onClick={handleSend} disabled={loading} style={btnStyle('#7c3aed')}>
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </>
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
