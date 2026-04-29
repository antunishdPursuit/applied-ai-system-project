import { VRMExpressionPresetName } from '@pixiv/three-vrm'
import { bone } from './utils.js'

// Drives continuous breathing (chest) and subtle head drift each frame.
// Frequencies (0.8, 0.3, 0.2) are tuned so the two head axes never sync up,
// keeping the motion from looking mechanical.
export function updateIdle(vrm, elapsed) {
  const chest = bone(vrm, 'chest')
  if (chest) chest.rotation.x = Math.sin(elapsed * 0.8) * 0.004

  const head = bone(vrm, 'head')
  if (head) {
    head.rotation.y = Math.sin(elapsed * 0.3) * 0.04
    head.rotation.x = Math.sin(elapsed * 0.2) * 0.02
  }
}

// Randomized interval (3–5 s) so blinks don't fall on a fixed beat.
export function createBlinkState() {
  return {
    timer:    0,
    interval: 3 + Math.random() * 2,
    active:   false,
    progress: 0,
  }
}

// Sin curve over progress gives a natural ease-in/out shape for the blink.
export function updateBlink(vrm, state, delta) {
  state.timer += delta

  if (!state.active && state.timer >= state.interval) {
    state.active   = true
    state.timer    = 0
    state.interval = 3 + Math.random() * 2
  }

  if (state.active) {
    state.progress += delta * 8
    const v = Math.max(0, Math.sin(state.progress * Math.PI))
    vrm.expressionManager?.setValue(VRMExpressionPresetName.Blink, v)

    if (state.progress >= 1) {
      state.active   = false
      state.progress = 0
      vrm.expressionManager?.setValue(VRMExpressionPresetName.Blink, 0)
    }
  }
}
