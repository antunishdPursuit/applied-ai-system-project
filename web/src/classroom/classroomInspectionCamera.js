import * as THREE from 'three'

const LOOK_SPEED = 0.003
const WHEEL_MOVE_SCALE = 0.0025
const MAX_WHEEL_MOVE = 0.8
const MAX_PITCH = (Math.PI / 2) - 0.05

export function createClassroomInspectionCamera({ canvas, camera }) {
  const forward = new THREE.Vector3()
  const initialRotation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
  let yaw = initialRotation.y
  let pitch = initialRotation.x
  let lookPointerId = null
  let lastPointerX = 0
  let lastPointerY = 0

  camera.rotation.order = 'YXZ'

  function startLooking(event) {
    if (event.button !== 2) return

    lookPointerId = event.pointerId
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    canvas.setPointerCapture?.(event.pointerId)
  }

  function updateLook(event) {
    if (event.pointerId !== lookPointerId) return

    const horizontalMovement = event.clientX - lastPointerX
    const verticalMovement = event.clientY - lastPointerY
    lastPointerX = event.clientX
    lastPointerY = event.clientY

    yaw -= horizontalMovement * LOOK_SPEED
    pitch = THREE.MathUtils.clamp(
      pitch - (verticalMovement * LOOK_SPEED),
      -MAX_PITCH,
      MAX_PITCH,
    )
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
  }

  function stopLooking(event) {
    if (event.pointerId !== lookPointerId) return

    canvas.releasePointerCapture?.(event.pointerId)
    lookPointerId = null
  }

  function preventContextMenu(event) {
    event.preventDefault()
  }

  function moveWithWheel(event) {
    event.preventDefault()
    camera.getWorldDirection(forward)
    const distance = THREE.MathUtils.clamp(
      -event.deltaY * WHEEL_MOVE_SCALE,
      -MAX_WHEEL_MOVE,
      MAX_WHEEL_MOVE,
    )
    camera.position.addScaledVector(forward, distance)
  }

  function syncLookRotation() {
    const rotation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    yaw = rotation.y
    pitch = rotation.x
  }

  canvas.addEventListener('pointerdown', startLooking)
  canvas.addEventListener('pointermove', updateLook)
  canvas.addEventListener('pointerup', stopLooking)
  canvas.addEventListener('pointercancel', stopLooking)
  canvas.addEventListener('contextmenu', preventContextMenu)
  canvas.addEventListener('wheel', moveWithWheel, { passive: false })

  return {
    update() {},
    focusOnBounds(bounds, roomBounds) {
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      const roomCenter = roomBounds.getCenter(new THREE.Vector3())
      const viewDirection = roomCenter.sub(center)
      viewDirection.y = 0
      if (viewDirection.lengthSq() < 0.001) viewDirection.set(0, 0, -1)
      viewDirection.normalize()

      const largestDimension = Math.max(size.x, size.y, size.z)
      const fieldOfView = THREE.MathUtils.degToRad(camera.fov)
      const framingDistance = largestDimension / (2 * Math.tan(fieldOfView / 2))
      const distance = THREE.MathUtils.clamp(framingDistance * 1.25, 0.75, 6)

      camera.position.copy(center).addScaledVector(viewDirection, distance)
      camera.position.y += Math.max(size.y * 0.12, 0.12)
      camera.lookAt(center)
      syncLookRotation()
    },
    dispose() {
      canvas.removeEventListener('pointerdown', startLooking)
      canvas.removeEventListener('pointermove', updateLook)
      canvas.removeEventListener('pointerup', stopLooking)
      canvas.removeEventListener('pointercancel', stopLooking)
      canvas.removeEventListener('contextmenu', preventContextMenu)
      canvas.removeEventListener('wheel', moveWithWheel)
    },
  }
}
