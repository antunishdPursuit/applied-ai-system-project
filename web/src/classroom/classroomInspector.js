import * as THREE from 'three'

function vectorToArray(vector) {
  return [vector.x, vector.y, vector.z].map(value => Number(value.toFixed(3)))
}

export function createClassroomInspector({ canvas, camera, scene, classroomRoot, parser, onSelection }) {
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const classroomMeshes = []
  let selectionHelper = null

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

  function selectMesh(event) {
    const bounds = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const intersection = raycaster.intersectObjects(classroomMeshes, false)[0]
    if (!intersection) return

    if (selectionHelper) {
      scene.remove(selectionHelper)
      selectionHelper.geometry.dispose()
      selectionHelper.material.dispose()
    }

    const mesh = intersection.object
    const worldBounds = new THREE.Box3().setFromObject(mesh)
    const center = worldBounds.getCenter(new THREE.Vector3())
    const size = worldBounds.getSize(new THREE.Vector3())
    const source = mesh.userData.classroomSource

    selectionHelper = new THREE.Box3Helper(worldBounds, 0xff4f9f)
    selectionHelper.material.depthTest = false
    selectionHelper.material.transparent = true
    selectionHelper.material.opacity = 0.95
    selectionHelper.renderOrder = 1000
    scene.add(selectionHelper)

    onSelection({
      nodeName: mesh.name || '(unnamed mesh)',
      nodeIndex: source.nodeIndex,
      meshIndex: source.meshIndex,
      primitiveIndex: source.primitiveIndex,
      center: vectorToArray(center),
      size: vectorToArray(size),
      min: vectorToArray(worldBounds.min),
      max: vectorToArray(worldBounds.max),
    })
  }

  canvas.addEventListener('pointerdown', selectMesh)

  return () => {
    canvas.removeEventListener('pointerdown', selectMesh)
    if (selectionHelper) {
      scene.remove(selectionHelper)
      selectionHelper.geometry.dispose()
      selectionHelper.material.dispose()
    }
  }
}
