import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSpeakingFaceState,
  startSpeakingFace,
  stopSpeakingFace,
  updateSpeakingFace,
} from '../src/animations/speakingFace.js'

function createFixture() {
  const eyes = {
    leftEye: { rotation: { x: 0, y: 0 } },
    rightEye: { rotation: { x: 0, y: 0 } },
  }
  const expressions = new Map()
  const vrm = {
    humanoid: {
      getNormalizedBoneNode(name) {
        return eyes[name] ?? null
      },
    },
    expressionManager: {
      setValue(name, value) {
        expressions.set(name, value)
      },
    },
  }

  return { eyes, expressions, vrm }
}

test('speaking adds restrained eye movement and a subtle expression', () => {
  const { eyes, expressions, vrm } = createFixture()
  const state = createSpeakingFaceState({ random: () => 0.75 })

  startSpeakingFace(state)
  updateSpeakingFace(vrm, state, 0.2)

  assert.ok(eyes.leftEye.rotation.y > 0)
  assert.equal(
    eyes.leftEye.rotation.y,
    eyes.rightEye.rotation.y,
  )
  assert.ok(expressions.get('happy') > 0)
  assert.ok(expressions.get('happy') <= 0.1)
})

test('facial motion returns smoothly to neutral after speech', () => {
  const { eyes, expressions, vrm } = createFixture()
  const state = createSpeakingFaceState({ random: () => 0.75 })

  startSpeakingFace(state)
  updateSpeakingFace(vrm, state, 0.5)
  stopSpeakingFace(state)
  updateSpeakingFace(vrm, state, 2)

  assert.ok(Math.abs(eyes.leftEye.rotation.x) < 0.001)
  assert.ok(Math.abs(eyes.leftEye.rotation.y) < 0.001)
  assert.ok(expressions.get('happy') < 0.001)
})

test('contextual animations suppress procedural speaking motion', () => {
  const { eyes, expressions, vrm } = createFixture()
  const state = createSpeakingFaceState({ random: () => 0.75 })

  startSpeakingFace(state)
  updateSpeakingFace(vrm, state, 0.5, { enabled: false })

  assert.equal(eyes.leftEye.rotation.x, 0)
  assert.equal(eyes.leftEye.rotation.y, 0)
  assert.equal(expressions.get('happy'), 0)
})
