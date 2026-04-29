export function lerp(a, b, t) {
  return a + (b - a) * t
}

// Cubic ease-in/out — prevents snapping at the start and end of phase transitions.
export function smoothstep(t) {
  const c = Math.min(Math.max(t, 0), 1)
  return c * c * (3 - 2 * c)
}

// Null-safe bone lookup. All callers guard on the return value so missing bones
// silently skip rather than throwing.
export function bone(vrm, name) {
  return vrm.humanoid?.getNormalizedBoneNode(name) ?? null
}
