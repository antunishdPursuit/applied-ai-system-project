import * as THREE from 'three'

const CORE_STATE = {
  IDLE: 'idle',
  TALKING: 'talking',
  WALKING: 'walking',
  RUNNING: 'running',
}

export function createAvatarAnimationController({
  mixer,
  actions,
  transitionDuration = 0.22,
  idleVariationDelay = 18,
  idleVariationsEnabled = true,
  random = Math.random,
}) {
  let moving = false
  let running = false
  let speaking = false
  let currentAction = null
  let temporaryAction = null
  let temporaryState = null
  let idleElapsed = 0
  let idleVariations = []
  let previousIdleVariation = null
  let disposed = false

  function desiredCoreState() {
    if (moving) {
      return running ? CORE_STATE.RUNNING : CORE_STATE.WALKING
    }
    if (speaking) return CORE_STATE.TALKING
    return CORE_STATE.IDLE
  }

  function restoreAction(action, { loop = true } = {}) {
    action.enabled = true
    action.paused = false
    action
      .reset()
      .setLoop(
        loop ? THREE.LoopRepeat : THREE.LoopOnce,
        loop ? Infinity : 1,
      )
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .play()
  }

  function transitionTo(action, { loop = true } = {}) {
    if (!action) return

    if (action === currentAction) {
      if (!action.enabled || action.paused || !action.isRunning()) {
        restoreAction(action, { loop })
      }
      return
    }

    restoreAction(action, { loop })
    if (currentAction) {
      currentAction.crossFadeTo(action, transitionDuration, true)
    }
    currentAction = action
  }

  function returnToCoreState() {
    temporaryAction = null
    temporaryState = null
    idleElapsed = 0
    transitionTo(actions[desiredCoreState()], { loop: true })
  }

  function handleFinished(event) {
    if (event.action !== temporaryAction) return
    returnToCoreState()
  }

  function interruptForMovement() {
    if (
      temporaryState === 'long-idle'
      || temporaryState === 'contextual'
      || temporaryState === 'preview'
    ) {
      returnToCoreState()
    }
  }

  function interruptForSpeech() {
    if (
      temporaryState === 'long-idle'
      || temporaryState === 'preview'
    ) {
      returnToCoreState()
    }
  }

  function chooseIdleVariation() {
    if (idleVariations.length === 0) return null
    if (idleVariations.length === 1) return idleVariations[0]

    const candidates = idleVariations.filter(
      action => action !== previousIdleVariation,
    )
    return candidates[Math.floor(random() * candidates.length)]
  }

  function playTemporaryAction(action, { loop, state }) {
    if (!action) return

    action.clampWhenFinished = !loop
    temporaryAction = action
    temporaryState = state
    transitionTo(action, { loop })
  }

  mixer.addEventListener('finished', handleFinished)
  transitionTo(actions[CORE_STATE.IDLE], { loop: true })

  return {
    setMoving(value, { running: nextRunning = false } = {}) {
      moving = Boolean(value)
      running = moving && Boolean(nextRunning)
      if (moving) interruptForMovement()
      if (!temporaryAction) {
        transitionTo(actions[desiredCoreState()], { loop: true })
      }
    },

    setSpeaking(value) {
      speaking = Boolean(value)
      if (speaking) {
        interruptForSpeech()
      }
      if (!temporaryAction) {
        transitionTo(actions[desiredCoreState()], { loop: true })
      }
    },

    playPreview(action, { loop = true } = {}) {
      playTemporaryAction(action, { loop, state: 'preview' })
    },

    playContextual(action) {
      playTemporaryAction(action, { loop: false, state: 'contextual' })
    },

    returnToCoreState,

    setIdleVariations(value) {
      idleVariations = value.filter(Boolean)
      previousIdleVariation = null
      idleElapsed = 0
    },

    update(delta) {
      if (
        idleVariationsEnabled
        && !temporaryAction
        && desiredCoreState() === CORE_STATE.IDLE
      ) {
        idleElapsed += delta
        if (idleElapsed >= idleVariationDelay) {
          const variation = chooseIdleVariation()
          if (variation) {
            previousIdleVariation = variation
            idleElapsed = 0
            playTemporaryAction(variation, {
              loop: false,
              state: 'long-idle',
            })
          }
        }
      } else if (desiredCoreState() !== CORE_STATE.IDLE) {
        idleElapsed = 0
      }

      mixer.update(delta)
    },

    getState() {
      if (temporaryState) return temporaryState
      return desiredCoreState()
    },

    dispose() {
      if (disposed) return
      disposed = true
      mixer.removeEventListener('finished', handleFinished)
      mixer.stopAllAction()
    },
  }
}
