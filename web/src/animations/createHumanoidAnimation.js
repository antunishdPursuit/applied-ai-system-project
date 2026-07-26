import * as THREE from 'three'
import { VRMAnimation, createVRMAnimationClip } from '@pixiv/three-vrm-animation'

// Quaternius uses a conventional humanoid rig. Map only the joints needed for
// locomotion so its source model can stay separate from Esme's VRM skeleton.
const SOURCE_TO_VRM_BONE = new Map([
  ['pelvis', 'hips'],
  ['spine_01', 'spine'],
  ['spine_02', 'chest'],
  ['spine_03', 'upperChest'],
  ['neck_01', 'neck'],
  ['Head', 'head'],
  ['clavicle_l', 'leftShoulder'],
  ['upperarm_l', 'leftUpperArm'],
  ['lowerarm_l', 'leftLowerArm'],
  ['hand_l', 'leftHand'],
  ['clavicle_r', 'rightShoulder'],
  ['upperarm_r', 'rightUpperArm'],
  ['lowerarm_r', 'rightLowerArm'],
  ['hand_r', 'rightHand'],
  ['thigh_l', 'leftUpperLeg'],
  ['calf_l', 'leftLowerLeg'],
  ['foot_l', 'leftFoot'],
  ['ball_l', 'leftToes'],
  ['thigh_r', 'rightUpperLeg'],
  ['calf_r', 'rightLowerLeg'],
  ['foot_r', 'rightFoot'],
  ['ball_r', 'rightToes'],
])

const VRM_BONE_PARENT = {
  hips: null,
  spine: 'hips',
  chest: 'spine',
  upperChest: 'chest',
  neck: 'upperChest',
  head: 'neck',
  leftShoulder: 'upperChest',
  leftUpperArm: 'leftShoulder',
  leftLowerArm: 'leftUpperArm',
  leftHand: 'leftLowerArm',
  rightShoulder: 'upperChest',
  rightUpperArm: 'rightShoulder',
  rightLowerArm: 'rightUpperArm',
  rightHand: 'rightLowerArm',
  leftUpperLeg: 'hips',
  leftLowerLeg: 'leftUpperLeg',
  leftFoot: 'leftLowerLeg',
  leftToes: 'leftFoot',
  rightUpperLeg: 'hips',
  rightLowerLeg: 'rightUpperLeg',
  rightFoot: 'rightLowerLeg',
  rightToes: 'rightFoot',
}

const vector = new THREE.Vector3()
const scale = new THREE.Vector3()
const sourceRestQuaternion = new THREE.Quaternion()
const parentRestQuaternion = new THREE.Quaternion()
const sampledQuaternion = new THREE.Quaternion()

function cloneTransformedQuaternionTrack(
  track,
  sourceRestMatrix,
  parentRestMatrix,
) {
  sourceRestMatrix.decompose(vector, sourceRestQuaternion, scale)
  sourceRestQuaternion.invert()
  parentRestMatrix.decompose(vector, parentRestQuaternion, scale)

  const values = new Float32Array(track.values.length)
  for (let index = 0; index < track.values.length; index += 4) {
    sampledQuaternion
      .fromArray(track.values, index)
      .premultiply(parentRestQuaternion)
      .multiply(sourceRestQuaternion)
      .toArray(values, index)
  }

  const convertedTrack = track.clone()
  convertedTrack.values = values
  return convertedTrack
}

function cloneTransformedHipsTrack(track, hipsParentMatrix) {
  const values = new Float32Array(track.values.length)
  for (let index = 0; index < track.values.length; index += 3) {
    vector
      .fromArray(track.values, index)
      .applyMatrix4(hipsParentMatrix)
      .toArray(values, index)
  }

  const convertedTrack = track.clone()
  convertedTrack.values = values
  return convertedTrack
}

export function createHumanoidAnimationClip({
  sourceScene,
  sourceClip,
  vrm,
}) {
  sourceScene.updateWorldMatrix(true, true)

  const sourceNodes = new Map()
  sourceScene.traverse((node) => {
    if (node.name) sourceNodes.set(node.name, node)
  })

  const sourceBoneByVrmName = new Map()
  SOURCE_TO_VRM_BONE.forEach((vrmBoneName, sourceBoneName) => {
    const sourceBone = sourceNodes.get(sourceBoneName)
    if (sourceBone) sourceBoneByVrmName.set(vrmBoneName, sourceBone)
  })

  const hips = sourceBoneByVrmName.get('hips')
  if (!hips) {
    throw new Error('The walking animation does not contain a pelvis joint.')
  }

  const vrmAnimation = new VRMAnimation()
  vrmAnimation.duration = sourceClip.duration
  hips.getWorldPosition(vrmAnimation.restHipsPosition)

  sourceClip.tracks.forEach((track) => {
    const separatorIndex = track.name.lastIndexOf('.')
    if (separatorIndex === -1) return

    const sourceBoneName = track.name.slice(0, separatorIndex)
    const propertyName = track.name.slice(separatorIndex + 1)
    const vrmBoneName = SOURCE_TO_VRM_BONE.get(sourceBoneName)
    if (!vrmBoneName) return

    const sourceBone = sourceBoneByVrmName.get(vrmBoneName)
    if (!sourceBone) return

    if (propertyName === 'quaternion') {
      let parentBoneName = VRM_BONE_PARENT[vrmBoneName]
      while (parentBoneName && !sourceBoneByVrmName.has(parentBoneName)) {
        parentBoneName = VRM_BONE_PARENT[parentBoneName]
      }

      const parentMatrix = parentBoneName
        ? sourceBoneByVrmName.get(parentBoneName).matrixWorld
        : hips.parent.matrixWorld

      vrmAnimation.humanoidTracks.rotation.set(
        vrmBoneName,
        cloneTransformedQuaternionTrack(
          track,
          sourceBone.matrixWorld,
          parentMatrix,
        ),
      )
    } else if (propertyName === 'position' && vrmBoneName === 'hips') {
      vrmAnimation.humanoidTracks.translation.set(
        vrmBoneName,
        cloneTransformedHipsTrack(track, hips.parent.matrixWorld),
      )
    }
  })

  const clip = createVRMAnimationClip(vrmAnimation, vrm)

  // Position remains controlled by the collision-aware movement controller.
  clip.tracks = clip.tracks.filter(
    track => !track.name.endsWith('.position'),
  )
  clip.name = sourceClip.name
  return clip
}

export function createCurrentPoseClip({ vrm, animatedClip }) {
  const tracks = animatedClip.tracks.flatMap((track) => {
    if (!track.name.endsWith('.quaternion')) return []

    const nodeName = track.name.slice(0, -'.quaternion'.length)
    const node = vrm.scene.getObjectByName(nodeName)
    if (!node) return []

    return new THREE.QuaternionKeyframeTrack(
      track.name,
      [0, 1],
      [
        node.quaternion.x,
        node.quaternion.y,
        node.quaternion.z,
        node.quaternion.w,
        node.quaternion.x,
        node.quaternion.y,
        node.quaternion.z,
        node.quaternion.w,
      ],
    )
  })

  return new THREE.AnimationClip('Esme_Rest_Pose', 1, tracks)
}
