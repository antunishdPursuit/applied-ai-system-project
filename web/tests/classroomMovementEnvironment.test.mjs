import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { createClassroomMovementEnvironment } from '../src/classroom/classroomMovementEnvironment.js'

function addBox(root, associations, {
  name,
  nodeIndex,
  size,
  position,
}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshBasicMaterial(),
  )
  mesh.name = name
  mesh.position.set(...position)
  root.add(mesh)
  associations.set(mesh, { nodes: nodeIndex })
  return mesh
}

test('the rear wall boundary closes the space behind the TV fixtures', () => {
  const classroomRoot = new THREE.Group()
  const associations = new Map()

  addBox(classroomRoot, associations, {
    name: 'room shell',
    nodeIndex: 52,
    size: [10, 3, 10],
    position: [0, 1.5, 0],
  })
  const blackboard = addBox(classroomRoot, associations, {
    name: 'large blackboard',
    nodeIndex: 4,
    size: [4.5, 1.3, 0.2],
    position: [0, 1.6, 4.7],
  })
  addBox(classroomRoot, associations, {
    name: 'front curtain',
    nodeIndex: 45,
    size: [0.1, 3, 3],
    position: [4.2, 1.5, -3],
  })
  addBox(classroomRoot, associations, {
    name: 'rear curtain',
    nodeIndex: 47,
    size: [0.1, 3, 0.8],
    position: [4.2, 1.5, 1],
  })

  const environment = createClassroomMovementEnvironment({
    classroomRoot,
    parser: { associations },
  })
  const wall = environment.structuralObstacles.find(
    obstacle => obstacle.id === 'rear-classroom-wall-boundary',
  )
  const boardBounds = new THREE.Box3().setFromObject(blackboard)

  assert.ok(wall)
  assert.equal(wall.label, 'rear classroom wall')
  assert.equal(wall.bounds.min.x, environment.walkableBounds.min.x)
  assert.equal(wall.bounds.max.x, environment.walkableBounds.max.x)
  assert.ok(wall.bounds.min.z < boardBounds.min.z)
  assert.equal(wall.bounds.max.z, environment.walkableBounds.max.z)

  const tvWall = environment.structuralObstacles.find(
    obstacle => obstacle.id === 'right-rear-wall-boundary',
  )

  assert.ok(tvWall)
  assert.equal(
    tvWall.bounds.min.x,
    environment.structuralObstacles.find(
      obstacle => obstacle.id === 'right-window-curtain-boundary',
    ).bounds.min.x,
  )
  assert.equal(tvWall.bounds.max.x, environment.walkableBounds.max.x)
  assert.equal(tvWall.bounds.max.z, wall.bounds.min.z)
})
