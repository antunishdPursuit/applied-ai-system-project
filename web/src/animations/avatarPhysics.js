const DISABLED_SPRING_BONE_PATTERNS = [
  /Bust/i,
  /Skirt/i,
]

export function disableUnwantedSpringBones(vrm) {
  const springBoneManager = vrm.springBoneManager
  if (!springBoneManager) return []

  const disabledBoneNames = []
  ;[...springBoneManager.joints].forEach((joint) => {
    const boneName = joint.bone?.name ?? ''
    if (!DISABLED_SPRING_BONE_PATTERNS.some(pattern => pattern.test(boneName))) {
      return
    }

    springBoneManager.deleteJoint(joint)
    disabledBoneNames.push(boneName)
  })

  return disabledBoneNames
}
