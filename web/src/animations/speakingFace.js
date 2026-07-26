import { VRMExpressionPresetName } from '@pixiv/three-vrm'

const MIN_GAZE_INTERVAL = 1.5
const GAZE_INTERVAL_RANGE = 1.5
const MAX_GAZE_YAW = 0.055
const MAX_GAZE_PITCH = 0.025
const SPEAKING_EXPRESSION = 0.1
const GAZE_SMOOTHING = 7
const EXPRESSION_SMOOTHING = 5

function nextSignedValue(random) {
  return (random() * 2) - 1
}

function selectNextGaze(state) {
  state.targetYaw = nextSignedValue(state.random) * MAX_GAZE_YAW
  state.targetPitch = nextSignedValue(state.random) * MAX_GAZE_PITCH
  state.gazeTimer = 0
  state.gazeInterval = MIN_GAZE_INTERVAL
    + (state.random() * GAZE_INTERVAL_RANGE)
}

export function createSpeakingFaceState({ random = Math.random } = {}) {
  return {
    speaking: false,
    random,
    gazeTimer: 0,
    gazeInterval: MIN_GAZE_INTERVAL,
    targetYaw: 0,
    targetPitch: 0,
    yaw: 0,
    pitch: 0,
    expression: 0,
  }
}

export function startSpeakingFace(state) {
  if (state.speaking) return

  state.speaking = true
  selectNextGaze(state)
}

export function stopSpeakingFace(state) {
  state.speaking = false
  state.targetYaw = 0
  state.targetPitch = 0
  state.gazeTimer = 0
}

export function updateSpeakingFace(
  vrm,
  state,
  delta,
  { enabled = true } = {},
) {
  const active = state.speaking && enabled
  if (active) {
    state.gazeTimer += delta
    if (state.gazeTimer >= state.gazeInterval) {
      selectNextGaze(state)
    }
  } else {
    state.targetYaw = 0
    state.targetPitch = 0
  }

  const gazeAmount = 1 - Math.exp(-GAZE_SMOOTHING * delta)
  const expressionAmount = 1 - Math.exp(-EXPRESSION_SMOOTHING * delta)
  state.yaw += (state.targetYaw - state.yaw) * gazeAmount
  state.pitch += (state.targetPitch - state.pitch) * gazeAmount
  const targetExpression = active ? SPEAKING_EXPRESSION : 0
  state.expression += (
    targetExpression - state.expression
  ) * expressionAmount

  const leftEye = vrm.humanoid?.getNormalizedBoneNode('leftEye')
  const rightEye = vrm.humanoid?.getNormalizedBoneNode('rightEye')
  ;[leftEye, rightEye].forEach((eye) => {
    if (!eye) return
    eye.rotation.x = state.pitch
    eye.rotation.y = state.yaw
  })

  vrm.expressionManager?.setValue(
    VRMExpressionPresetName.Happy,
    state.expression,
  )
}
