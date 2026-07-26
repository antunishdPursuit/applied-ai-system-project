import * as THREE from 'three'

const DESK_SURFACE_NODE_INDEX = 18
const DESK_FRAME_NODE_INDEX = 19
const POSITION_PRECISION = 10000

function createDisjointSet(size) {
  const parent = Int32Array.from({ length: size }, (_, index) => index)
  const rank = new Uint8Array(size)

  function find(index) {
    let root = index
    while (parent[root] !== root) root = parent[root]

    while (parent[index] !== index) {
      const next = parent[index]
      parent[index] = root
      index = next
    }

    return root
  }

  function union(first, second) {
    let firstRoot = find(first)
    let secondRoot = find(second)
    if (firstRoot === secondRoot) return

    if (rank[firstRoot] < rank[secondRoot]) {
      ;[firstRoot, secondRoot] = [secondRoot, firstRoot]
    }

    parent[secondRoot] = firstRoot
    if (rank[firstRoot] === rank[secondRoot]) rank[firstRoot] += 1
  }

  return { find, union }
}

function getWorldPositions(mesh) {
  mesh.updateWorldMatrix(true, false)
  const position = mesh.geometry.getAttribute('position')
  const point = new THREE.Vector3()
  const positions = []

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld)
    positions.push(point.clone())
  }

  return positions
}

function findConnectedBounds(mesh) {
  const positions = getWorldPositions(mesh)
  const disjointSet = createDisjointSet(positions.length)
  const firstVertexAtPosition = new Map()

  positions.forEach((position, index) => {
    const key = [
      Math.round(position.x * POSITION_PRECISION),
      Math.round(position.y * POSITION_PRECISION),
      Math.round(position.z * POSITION_PRECISION),
    ].join(',')
    const matchingIndex = firstVertexAtPosition.get(key)

    if (matchingIndex === undefined) firstVertexAtPosition.set(key, index)
    else disjointSet.union(index, matchingIndex)
  })

  const indices = mesh.geometry.getIndex()
  const triangleVertexCount = indices?.count ?? positions.length
  const getVertexIndex = indices
    ? index => indices.getX(index)
    : index => index

  for (let index = 0; index < triangleVertexCount; index += 3) {
    const first = getVertexIndex(index)
    const second = getVertexIndex(index + 1)
    const third = getVertexIndex(index + 2)
    disjointSet.union(first, second)
    disjointSet.union(second, third)
  }

  const boundsByRoot = new Map()
  positions.forEach((position, index) => {
    const root = disjointSet.find(index)
    const bounds = boundsByRoot.get(root) ?? new THREE.Box3()
    bounds.expandByPoint(position)
    boundsByRoot.set(root, bounds)
  })

  return [...boundsByRoot.values()]
}

function isDesktopSurface(bounds) {
  const size = bounds.getSize(new THREE.Vector3())

  return size.x >= 1.05
    && size.x <= 1.2
    && size.y <= 0.08
    && size.z >= 0.6
    && size.z <= 0.72
}

function findMeshByNodeIndex(classroomMeshes, nodeIndex) {
  return classroomMeshes.find(
    mesh => mesh.userData.classroomSource?.nodeIndex === nodeIndex,
  )
}

export function deriveDeskCollisionZones(classroomMeshes) {
  const surfaceMesh = findMeshByNodeIndex(classroomMeshes, DESK_SURFACE_NODE_INDEX)
  const frameMesh = findMeshByNodeIndex(classroomMeshes, DESK_FRAME_NODE_INDEX)
  if (!surfaceMesh || !frameMesh) return []

  const desktopCenters = findConnectedBounds(surfaceMesh)
    .filter(isDesktopSurface)
    .map(bounds => bounds.getCenter(new THREE.Vector3()))
    .sort((first, second) => first.z - second.z || first.x - second.x)

  // The classroom asset contains four rows of four repeated desk stations.
  // Stop rather than create misleading collision zones if the source changes.
  if (desktopCenters.length !== 16) return []

  const zoneBounds = desktopCenters.map(() => new THREE.Box3())
  const allFurniturePositions = [
    ...getWorldPositions(surfaceMesh),
    ...getWorldPositions(frameMesh),
  ]

  allFurniturePositions.forEach((position) => {
    let closestZoneIndex = 0
    let closestDistanceSquared = Infinity

    desktopCenters.forEach((center, index) => {
      const distanceSquared = ((position.x - center.x) ** 2)
        + ((position.z - center.z) ** 2)
      if (distanceSquared < closestDistanceSquared) {
        closestDistanceSquared = distanceSquared
        closestZoneIndex = index
      }
    })

    zoneBounds[closestZoneIndex].expandByPoint(position)
  })

  return zoneBounds.map((bounds, index) => ({
    id: `desk-station-${index + 1}`,
    label: `Desk station ${index + 1}`,
    bounds,
    sourceNodeIndices: [DESK_SURFACE_NODE_INDEX, DESK_FRAME_NODE_INDEX],
  }))
}
