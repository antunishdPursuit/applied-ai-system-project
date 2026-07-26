import * as THREE from 'three'
import { deriveDeskCollisionZones } from './classroomDeskCollisionZones.js'

const FIXED_OBSTACLES = new Map([
  [4, 'large blackboard'],
  [6, 'small blackboard'],
  [21, 'storage shelves'],
  [23, 'rear bookshelf'],
  [31, 'teacher podium'],
  [33, 'TV and wheeled cart'],
])
const WINDOW_CURTAIN_NODE_INDICES = [45, 47]
const LARGE_BLACKBOARD_NODE_INDEX = 4

function createCombinedObstacle({
  classroomMeshes,
  id,
  label,
  sourceNodeIndices,
}) {
  const bounds = new THREE.Box3()
  let matchedSource = false

  classroomMeshes.forEach((mesh) => {
    const nodeIndex = mesh.userData.classroomSource?.nodeIndex
    if (!sourceNodeIndices.includes(nodeIndex)) return

    bounds.union(new THREE.Box3().setFromObject(mesh))
    matchedSource = true
  })

  if (!matchedSource) return null

  return {
    id,
    label,
    bounds,
    sourceNodeIndices,
  }
}

function attachSourceMetadata(classroomRoot, parser) {
  const classroomMeshes = []

  classroomRoot.traverse((object) => {
    if (!object.isMesh) return

    const association = parser.associations.get(object) ?? {}
    object.userData.classroomSource = {
      nodeIndex: association.nodes ?? null,
      meshIndex: association.meshes ?? null,
      primitiveIndex: association.primitives ?? null,
    }
    classroomMeshes.push(object)
  })

  return classroomMeshes
}

function createRearWallBoundary({
  roomBounds,
  fixedObstacles,
}) {
  const largeBlackboard = fixedObstacles.find(
    obstacle => obstacle.sourceNodeIndices.includes(
      LARGE_BLACKBOARD_NODE_INDEX,
    ),
  )
  if (!largeBlackboard) return null

  // The room shell's outer bounds extend behind the visible wall. Use the
  // front face of the confirmed large blackboard as the inner wall plane so
  // Esme cannot enter the narrow space behind the TV or other fixtures.
  const wallFrontZ = largeBlackboard.bounds.min.z - 0.04

  return {
    id: 'rear-classroom-wall-boundary',
    label: 'rear classroom wall',
    bounds: new THREE.Box3(
      new THREE.Vector3(
        roomBounds.min.x,
        roomBounds.min.y,
        wallFrontZ,
      ),
      new THREE.Vector3(
        roomBounds.max.x,
        roomBounds.max.y,
        roomBounds.max.z,
      ),
    ),
    sourceNodeIndices: [LARGE_BLACKBOARD_NODE_INDEX],
  }
}

function createRightRearWallBoundary({
  roomBounds,
  windowCurtainBoundary,
  rearWallBoundary,
}) {
  if (!windowCurtainBoundary || !rearWallBoundary) return null

  return {
    id: 'right-rear-wall-boundary',
    label: 'right wall behind TV',
    bounds: new THREE.Box3(
      new THREE.Vector3(
        windowCurtainBoundary.bounds.min.x,
        roomBounds.min.y,
        windowCurtainBoundary.bounds.max.z,
      ),
      new THREE.Vector3(
        roomBounds.max.x,
        roomBounds.max.y,
        rearWallBoundary.bounds.min.z,
      ),
    ),
    sourceNodeIndices: [
      ...windowCurtainBoundary.sourceNodeIndices,
      LARGE_BLACKBOARD_NODE_INDEX,
    ],
  }
}

export function createClassroomMovementEnvironment({
  classroomRoot,
  parser,
}) {
  classroomRoot.updateMatrixWorld(true)
  const classroomMeshes = attachSourceMetadata(classroomRoot, parser)
  const deskZones = deriveDeskCollisionZones(classroomMeshes)
  const fixedObstacles = classroomMeshes
    .filter(mesh => FIXED_OBSTACLES.has(
      mesh.userData.classroomSource?.nodeIndex,
    ))
    .map((mesh) => {
      const nodeIndex = mesh.userData.classroomSource.nodeIndex

      return {
        id: `fixed-obstacle-${nodeIndex}`,
        label: FIXED_OBSTACLES.get(nodeIndex),
        bounds: new THREE.Box3().setFromObject(mesh),
        sourceNodeIndices: [nodeIndex],
      }
    })
  const windowCurtainBoundary = createCombinedObstacle({
    classroomMeshes,
    id: 'right-window-curtain-boundary',
    label: 'right windows and curtains',
    sourceNodeIndices: WINDOW_CURTAIN_NODE_INDICES,
  })
  const walkableBounds = new THREE.Box3().setFromObject(classroomRoot)
  const rearWallBoundary = createRearWallBoundary({
    roomBounds: walkableBounds,
    fixedObstacles,
  })
  const rightRearWallBoundary = createRightRearWallBoundary({
    roomBounds: walkableBounds,
    windowCurtainBoundary,
    rearWallBoundary,
  })
  const structuralObstacles = [
    windowCurtainBoundary,
    rearWallBoundary,
    rightRearWallBoundary,
  ].filter(Boolean)

  return {
    classroomMeshes,
    deskZones,
    fixedObstacles,
    structuralObstacles,
    obstacles: [...deskZones, ...fixedObstacles, ...structuralObstacles],
    walkableBounds,
  }
}

export function createCollisionDebugView(scene, environment) {
  const helpers = []

  environment.deskZones.forEach((zone) => {
    const helper = new THREE.Box3Helper(zone.bounds, 0xff4f9f)
    helper.material.depthTest = false
    helper.material.transparent = true
    helper.material.opacity = 0.7
    helper.renderOrder = 998
    scene.add(helper)
    helpers.push(helper)
  })

  environment.fixedObstacles.forEach((obstacle) => {
    const helper = new THREE.Box3Helper(obstacle.bounds, 0xffa94d)
    helper.material.depthTest = false
    helper.material.transparent = true
    helper.material.opacity = 0.9
    helper.renderOrder = 999
    scene.add(helper)
    helpers.push(helper)
  })

  environment.structuralObstacles.forEach((obstacle) => {
    const helper = new THREE.Box3Helper(obstacle.bounds, 0xffd166)
    helper.material.depthTest = false
    helper.material.transparent = true
    helper.material.opacity = 0.9
    helper.renderOrder = 999
    scene.add(helper)
    helpers.push(helper)
  })

  const roomHelper = new THREE.Box3Helper(
    environment.walkableBounds,
    0x58c7ff,
  )
  roomHelper.material.depthTest = false
  roomHelper.material.transparent = true
  roomHelper.material.opacity = 0.7
  roomHelper.renderOrder = 997
  scene.add(roomHelper)
  helpers.push(roomHelper)

  return {
    dispose() {
      helpers.forEach((helper) => {
        scene.remove(helper)
        helper.geometry.dispose()
        helper.material.dispose()
      })
    },
  }
}
