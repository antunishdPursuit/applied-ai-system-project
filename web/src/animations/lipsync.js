export function createLipSyncState() {
  return { speaking: false, phase: 0 }
}

export function startSpeaking(state) {
  state.speaking = true
  state.phase    = 0
}

// Both the expression and the jaw bone are reset: the 'aa' setValue is a no-op
// on Esme (no morph targets), but the jaw bone rotation must be zeroed explicitly.
export function stopSpeaking(state, vrm) {
  state.speaking = false
  vrm?.expressionManager?.setValue('aa', 0)
  const jaw = vrm?.humanoid?.getNormalizedBoneNode('jaw')
  if (jaw) jaw.rotation.x = 0
}

// Jaw bone is used instead of the 'aa' expression because Esme's VRM has no
// morph target binds — expressionManager calls are silent no-ops on this model.
export function updateLipSync(vrm, state, delta) {
  if (!state.speaking) return
  state.phase += delta * 10
  const value = Math.abs(Math.sin(state.phase)) * 0.8
  vrm.expressionManager?.setValue('aa', value)
  const jaw = vrm.humanoid?.getNormalizedBoneNode('jaw')
  if (jaw) jaw.rotation.x = value * 0.3
}
