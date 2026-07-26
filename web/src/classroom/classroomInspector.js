import * as THREE from 'three'
import { deriveDeskCollisionZones } from './classroomDeskCollisionZones.js'

// These GLTF nodes combine large parts of the room or furniture. Keep them
// available as fallback targets without letting them hide smaller objects.
const IGNORED_NODE_INDICES = new Set([18, 19, 52])
const KNOWN_NODE_LABELS = new Map([
  [4, 'large blackboard'],
  [6, 'small blackboard'],
  [8, 'wall clock'],
  [10, 'chalk stick'],
  [12, 'chalk stick'],
  [14, 'chalk stick'],
  [16, 'chalkboard sponge'],
  [18, 'combined student desks'],
  [19, 'combined desk and chair frames'],
  [21, 'storage shelves and bookcase'],
  [23, 'rear-wall storage structure'],
  [25, 'ceiling light fixtures'],
  [26, 'ceiling light panels'],
  [28, 'wall speaker'],
  [29, 'wall microphone'],
  [31, 'teacher podium'],
  [33, 'TV and wheeled cart'],
  [34, 'wheeled cart frame'],
  [36, 'upper shelf books'],
  [38, 'lower shelf books'],
  [40, 'single shelf book'],
  [42, 'single shelf book'],
  [44, 'first curtain rail'],
  [45, 'first curtain section'],
  [47, 'second curtain section'],
  [48, 'second curtain rail'],
  [50, 'combined desktop surfaces'],
  [52, 'classroom shell'],
])

function vectorToArray(vector) {
  return [vector.x, vector.y, vector.z].map(value => Number(value.toFixed(3)))
}

export function createClassroomInspector({
  canvas,
  camera,
  scene,
  classroomRoot,
  parser,
  onSelection,
  onFocusCandidate,
  onCollisionZoneSelection,
}) {
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const classroomMeshes = []
  const classroomBounds = new THREE.Box3().setFromObject(classroomRoot)
  const classroomSize = classroomBounds.getSize(new THREE.Vector3())
  let selectionHelper = null
  let pointerStart = null
  let currentCandidates = []
  let currentCandidateIndex = -1
  let currentInventoryIndex = -1

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

  function describeMesh(mesh) {
    const worldBounds = new THREE.Box3().setFromObject(mesh)
    const size = worldBounds.getSize(new THREE.Vector3())
    const source = mesh.userData.classroomSource
    const largeAxisCount = ['x', 'y', 'z'].filter(
      axis => classroomSize[axis] > 0 && size[axis] >= classroomSize[axis] * 0.85,
    ).length

    return {
      mesh,
      worldBounds,
      size,
      source,
      isRoomSurface: largeAxisCount >= 2,
      isFallbackTarget: IGNORED_NODE_INDICES.has(source.nodeIndex),
      suggestedLabel: KNOWN_NODE_LABELS.get(source.nodeIndex) ?? 'unlabeled',
    }
  }

  const inventoryCandidates = classroomMeshes
    .map(describeMesh)
    .sort((first, second) => (first.source.nodeIndex ?? Infinity) - (second.source.nodeIndex ?? Infinity))
  inventoryCandidates.forEach((candidate, index) => {
    candidate.inventoryIndex = index
  })
  const candidateByMesh = new Map(
    inventoryCandidates.map(candidate => [candidate.mesh, candidate]),
  )
  const collisionZones = deriveDeskCollisionZones(classroomMeshes)
  const collisionZoneHelpers = collisionZones.map((zone) => {
    const helper = new THREE.Box3Helper(zone.bounds, 0xff4f9f)
    helper.material.depthTest = false
    helper.material.transparent = true
    helper.material.opacity = 0.65
    helper.renderOrder = 999
    scene.add(helper)
    return helper
  })
  let collisionZonesVisible = true
  let currentCollisionZoneIndex = collisionZones.length > 0 ? 0 : -1

  function describeCandidate(candidate) {
    const center = candidate.worldBounds.getCenter(new THREE.Vector3())
    const materials = Array.isArray(candidate.mesh.material)
      ? candidate.mesh.material
      : [candidate.mesh.material]

    return {
      inventoryIndex: candidate.inventoryIndex + 1,
      inventoryCount: inventoryCandidates.length,
      nodeName: candidate.mesh.name || '(unnamed mesh)',
      nodeIndex: candidate.source.nodeIndex,
      meshIndex: candidate.source.meshIndex,
      primitiveIndex: candidate.source.primitiveIndex,
      parentName: candidate.mesh.parent?.name || '(unnamed parent)',
      materialNames: materials
        .filter(Boolean)
        .map(material => material.name || '(unnamed material)'),
      center: vectorToArray(center),
      size: vectorToArray(candidate.size),
      min: vectorToArray(candidate.worldBounds.min),
      max: vectorToArray(candidate.worldBounds.max),
      isRoomSurface: candidate.isRoomSurface,
      isFallbackTarget: candidate.isFallbackTarget,
      suggestedLabel: candidate.suggestedLabel,
    }
  }

  function describeCollisionZone(zone, index) {
    const center = zone.bounds.getCenter(new THREE.Vector3())
    const size = zone.bounds.getSize(new THREE.Vector3())

    return {
      collisionZoneIndex: index + 1,
      collisionZoneCount: collisionZones.length,
      id: zone.id,
      label: zone.label,
      center: vectorToArray(center),
      size: vectorToArray(size),
      min: vectorToArray(zone.bounds.min),
      max: vectorToArray(zone.bounds.max),
      sourceNodeIndices: zone.sourceNodeIndices,
    }
  }

  function updateCollisionZoneHelperStyles() {
    collisionZoneHelpers.forEach((helper, index) => {
      helper.visible = collisionZonesVisible
      helper.material.color.setHex(
        index === currentCollisionZoneIndex ? 0xffd166 : 0xff4f9f,
      )
      helper.material.opacity = index === currentCollisionZoneIndex ? 1 : 0.5
    })
  }

  function showCollisionZone(index, shouldFocus = true) {
    if (collisionZones.length === 0) return

    currentCollisionZoneIndex = (
      index + collisionZones.length
    ) % collisionZones.length
    const zone = collisionZones[currentCollisionZoneIndex]
    updateCollisionZoneHelperStyles()
    if (shouldFocus) onFocusCandidate?.(zone.bounds, classroomBounds)
    onCollisionZoneSelection?.(
      describeCollisionZone(zone, currentCollisionZoneIndex),
    )
  }

  updateCollisionZoneHelperStyles()
  if (currentCollisionZoneIndex >= 0) {
    onCollisionZoneSelection?.(
      describeCollisionZone(
        collisionZones[currentCollisionZoneIndex],
        currentCollisionZoneIndex,
      ),
    )
  }

  function highlightCandidate(candidate, selectionDetails = {}, shouldFocus = false) {
    if (selectionHelper) {
      scene.remove(selectionHelper)
      selectionHelper.geometry.dispose()
      selectionHelper.material.dispose()
    }

    selectionHelper = new THREE.Box3Helper(candidate.worldBounds, 0xff4f9f)
    selectionHelper.material.depthTest = false
    selectionHelper.material.transparent = true
    selectionHelper.material.opacity = 0.95
    selectionHelper.renderOrder = 1000
    scene.add(selectionHelper)
    if (shouldFocus) onFocusCandidate?.(candidate.worldBounds, classroomBounds)

    currentInventoryIndex = candidate.inventoryIndex
    onSelection({
      ...describeCandidate(candidate),
      ...selectionDetails,
    })
  }

  function showCandidate(index) {
    if (currentCandidates.length === 0) return
    currentCandidateIndex = (index + currentCandidates.length) % currentCandidates.length
    highlightCandidate(currentCandidates[currentCandidateIndex], {
      candidateIndex: currentCandidateIndex + 1,
      candidateCount: currentCandidates.length,
    })
  }

  function showInventoryItem(index) {
    if (inventoryCandidates.length === 0) return
    currentInventoryIndex = (index + inventoryCandidates.length) % inventoryCandidates.length
    currentCandidates = [inventoryCandidates[currentInventoryIndex]]
    currentCandidateIndex = 0
    highlightCandidate(inventoryCandidates[currentInventoryIndex], {
      candidateIndex: 1,
      candidateCount: 1,
    }, true)
  }

  function selectMesh(event) {
    const bounds = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const uniqueMeshes = new Set()
    const candidates = raycaster
      .intersectObjects(classroomMeshes, false)
      .filter(({ object }) => {
        if (uniqueMeshes.has(object)) return false
        uniqueMeshes.add(object)
        return true
      })
      .map(({ object }) => candidateByMesh.get(object))
      .filter(Boolean)

    if (candidates.length === 0) return

    const preferredCandidates = candidates.filter(candidate => !candidate.isFallbackTarget)
    const fallbackCandidates = candidates.filter(candidate => candidate.isFallbackTarget)
    currentCandidates = [...preferredCandidates, ...fallbackCandidates]
    showCandidate(0)
  }

  function startPointerSelection(event) {
    if (event.button !== 0) return

    pointerStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    }
  }

  function trackPointerMovement(event) {
    if (!pointerStart || event.pointerId !== pointerStart.pointerId) return

    const horizontalDistance = event.clientX - pointerStart.x
    const verticalDistance = event.clientY - pointerStart.y
    if ((horizontalDistance ** 2) + (verticalDistance ** 2) > 16) {
      pointerStart.moved = true
    }
  }

  function finishPointerSelection(event) {
    if (!pointerStart || event.pointerId !== pointerStart.pointerId) return

    const shouldSelect = !pointerStart.moved
    pointerStart = null
    if (shouldSelect) selectMesh(event)
  }

  function cancelPointerSelection(event) {
    if (pointerStart?.pointerId === event.pointerId) pointerStart = null
  }

  canvas.addEventListener('pointerdown', startPointerSelection)
  canvas.addEventListener('pointermove', trackPointerMovement)
  canvas.addEventListener('pointerup', finishPointerSelection)
  canvas.addEventListener('pointercancel', cancelPointerSelection)

  function dispose() {
    canvas.removeEventListener('pointerdown', startPointerSelection)
    canvas.removeEventListener('pointermove', trackPointerMovement)
    canvas.removeEventListener('pointerup', finishPointerSelection)
    canvas.removeEventListener('pointercancel', cancelPointerSelection)
    if (selectionHelper) {
      scene.remove(selectionHelper)
      selectionHelper.geometry.dispose()
      selectionHelper.material.dispose()
    }
    collisionZoneHelpers.forEach((helper) => {
      scene.remove(helper)
      helper.geometry.dispose()
      helper.material.dispose()
    })
  }

  // Keep the original callable cleanup contract while exposing the richer
  // inspection controls used by the development panel.
  return Object.assign(dispose, {
    getInventory() {
      return inventoryCandidates.map(describeCandidate)
    },
    getCollisionZones() {
      return collisionZones.map(describeCollisionZone)
    },
    setCollisionZonesVisible(visible) {
      collisionZonesVisible = visible
      updateCollisionZoneHelperStyles()
    },
    selectPreviousCollisionZone() {
      showCollisionZone(currentCollisionZoneIndex - 1)
    },
    selectNextCollisionZone() {
      showCollisionZone(currentCollisionZoneIndex + 1)
    },
    selectCollisionZone(index) {
      showCollisionZone(index)
    },
    selectPreviousInventoryItem() {
      showInventoryItem(currentInventoryIndex - 1)
    },
    selectNextInventoryItem() {
      showInventoryItem(currentInventoryIndex + 1)
    },
    selectInventoryItem(index) {
      showInventoryItem(index)
    },
    selectPrevious() {
      showCandidate(currentCandidateIndex - 1)
    },
    selectNext() {
      showCandidate(currentCandidateIndex + 1)
    },
    dispose,
  })
}
