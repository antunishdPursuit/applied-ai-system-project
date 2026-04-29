import { bone, lerp, smoothstep } from './utils.js'

// Z-axis rotations for VRM normalized humanoid bones at rest.
const REST = {
  leftUpperArm:  { z:  1 },
  rightUpperArm: { z: -1 },
  leftLowerArm:  { z:  0 },
  rightUpperLeg: { z:  0.0 },
  hips:          { z:  0.0 },
}

// Target rotations for the raised-arm wave pose.
const WAVE_TARGET = {
  leftUpperArm:  { z: -0.6 },
  leftLowerArm:  { z:  0 },
  rightUpperArm: { z: -0.8 },
  rightUpperLeg: { z:  0.5 },
  hips:          { z:  0.05 },
}

// Duration (seconds) of each phase: arm-up, waving, arm-down.
const PHASES = { up: 0.4, wave: 2.0, down: 0.5 }

export function createWaveState() {
  return { phase: null, time: 0 }
}

// Guard prevents re-triggering if a wave is already in progress.
export function triggerWave(stateRef) {
  if (stateRef.current.phase !== null) return
  stateRef.current = { phase: 'up', time: 0 }
}

// Sets bones to the rest pose on initial VRM load so the avatar doesn't
// default to the T-pose before the first wave state tick.
export function applyRestPose(vrm) {
  const lUA = bone(vrm, 'leftUpperArm')
  const rUA = bone(vrm, 'rightUpperArm')
  const lLA = bone(vrm, 'leftLowerArm')
  const rUL = bone(vrm, 'rightUpperLeg')
  const h   = bone(vrm, 'hips')
  if (lUA) lUA.rotation.z = REST.leftUpperArm.z
  if (rUA) rUA.rotation.z = REST.rightUpperArm.z
  if (lLA) lLA.rotation.z = REST.leftLowerArm.z
  if (rUL) rUL.rotation.z = REST.rightUpperLeg.z
  if (h)   h.rotation.z   = REST.hips.z
}

// Three-phase state machine: 'up' lerps bones to wave pose, 'wave' oscillates
// the hand, 'down' lerps back to rest. smoothstep on lerp t avoids linear snapping.
export function updateWave(vrm, stateRef, delta) {
  const wave  = stateRef.current
  const lUA   = bone(vrm, 'leftUpperArm')
  const rUA   = bone(vrm, 'rightUpperArm')
  const lLA   = bone(vrm, 'leftLowerArm')
  const lHand = bone(vrm, 'leftHand')
  const rUL   = bone(vrm, 'rightUpperLeg')
  const hips  = bone(vrm, 'hips')

  if (wave.phase === null) {
    if (lUA)  lUA.rotation.z  = REST.leftUpperArm.z
    if (rUA)  rUA.rotation.z  = REST.rightUpperArm.z
    if (lLA)  lLA.rotation.z  = REST.leftLowerArm.z
    if (rUL)  rUL.rotation.z  = REST.rightUpperLeg.z
    if (hips) hips.rotation.z = REST.hips.z
    return
  }

  wave.time += delta

  if (wave.phase === 'up') {
    const t = smoothstep(wave.time / PHASES.up)
    if (lUA)  lUA.rotation.z  = lerp(REST.leftUpperArm.z,   WAVE_TARGET.leftUpperArm.z,  t)
    if (rUA)  rUA.rotation.z  = lerp(REST.rightUpperArm.z,  WAVE_TARGET.rightUpperArm.z, t)
    if (lLA)  lLA.rotation.z  = lerp(REST.leftLowerArm.z,   WAVE_TARGET.leftLowerArm.z,  t)
    if (rUL)  rUL.rotation.z  = lerp(REST.rightUpperLeg.z,  WAVE_TARGET.rightUpperLeg.z, t)
    if (hips) hips.rotation.z = lerp(REST.hips.z,           WAVE_TARGET.hips.z,          t)
    if (wave.time >= PHASES.up) stateRef.current = { phase: 'wave', time: 0 }

  } else if (wave.phase === 'wave') {
    if (lUA)  lUA.rotation.z  = WAVE_TARGET.leftUpperArm.z
    if (rUA)  rUA.rotation.z  = WAVE_TARGET.rightUpperArm.z
    if (lLA)  lLA.rotation.z  = WAVE_TARGET.leftLowerArm.z
    if (rUL)  rUL.rotation.z  = WAVE_TARGET.rightUpperLeg.z
    if (hips) hips.rotation.z = WAVE_TARGET.hips.z
    if (lHand) lHand.rotation.z = Math.sin(wave.time * Math.PI * 3) * 0.45
    if (wave.time >= PHASES.wave) stateRef.current = { phase: 'down', time: 0 }

  } else if (wave.phase === 'down') {
    const t = smoothstep(wave.time / PHASES.down)
    if (lUA)  lUA.rotation.z  = lerp(WAVE_TARGET.leftUpperArm.z,  REST.leftUpperArm.z,   t)
    if (rUA)  rUA.rotation.z  = lerp(WAVE_TARGET.rightUpperArm.z, REST.rightUpperArm.z,  t)
    if (lLA)  lLA.rotation.z  = lerp(WAVE_TARGET.leftLowerArm.z,  REST.leftLowerArm.z,   t)
    if (rUL)  rUL.rotation.z  = lerp(WAVE_TARGET.rightUpperLeg.z, REST.rightUpperLeg.z,  t)
    if (hips) hips.rotation.z = lerp(WAVE_TARGET.hips.z,          REST.hips.z,           t)
    if (lHand) lHand.rotation.z = lerp(lHand.rotation.z, 0, t)
    if (wave.time >= PHASES.down) stateRef.current = { phase: null, time: 0 }
  }
}
