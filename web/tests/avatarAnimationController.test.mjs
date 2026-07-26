import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { createAvatarAnimationController } from '../src/animations/avatarAnimationController.js'

class FakeAction {
  constructor(name) {
    this.name = name
    this.transitions = []
    this.enabled = true
    this.paused = false
  }

  reset() {
    this.enabled = true
    this.paused = false
    return this
  }
  setEffectiveWeight() { return this }
  setEffectiveTimeScale() { return this }
  play() { return this }
  setLoop() { return this }
  isRunning() { return this.enabled && !this.paused }
  getClip() { return { duration: 1 } }

  crossFadeTo(action) {
    this.transitions.push(action.name)
    return this
  }
}

function createFixture(options = {}) {
  const listeners = new Map()
  const mixer = {
    addEventListener(name, listener) {
      listeners.set(name, listener)
    },
    removeEventListener(name) {
      listeners.delete(name)
    },
    stopAllAction() {},
    update() {},
  }
  const actions = {
    idle: new FakeAction('idle'),
    talking: new FakeAction('talking'),
    walking: new FakeAction('walking'),
    running: new FakeAction('running'),
  }
  const controller = createAvatarAnimationController({
    mixer,
    actions,
    ...options,
  })

  return {
    actions,
    controller,
    finish(action) {
      listeners.get('finished')?.({ action })
    },
  }
}

test('movement takes priority over stationary speech', () => {
  const { controller } = createFixture()

  assert.equal(controller.getState(), 'idle')
  controller.setSpeaking(true)
  assert.equal(controller.getState(), 'talking')
  controller.setMoving(true)
  assert.equal(controller.getState(), 'walking')
  controller.setMoving(false)
  assert.equal(controller.getState(), 'talking')
  controller.setSpeaking(false)
  assert.equal(controller.getState(), 'idle')
})

test('running is active only while movement and the run modifier are active', () => {
  const { controller } = createFixture()

  controller.setMoving(true, { running: true })
  assert.equal(controller.getState(), 'running')
  controller.setMoving(true, { running: false })
  assert.equal(controller.getState(), 'walking')
  controller.setMoving(false, { running: true })
  assert.equal(controller.getState(), 'idle')
})

test('a contextual greeting survives speech but is interrupted by movement', () => {
  const { controller } = createFixture()
  const greeting = new FakeAction('greeting')

  controller.playContextual(greeting)
  assert.equal(controller.getState(), 'contextual')
  controller.setSpeaking(true)
  assert.equal(controller.getState(), 'contextual')
  controller.setMoving(true)
  assert.equal(controller.getState(), 'walking')
})

test('long-idle variations are interruptible and avoid an immediate repeat', () => {
  const { controller, finish } = createFixture({
    idleVariationDelay: 2,
    random: () => 0,
  })
  const first = new FakeAction('first')
  const second = new FakeAction('second')
  controller.setIdleVariations([first, second])

  controller.update(2.1)
  assert.equal(controller.getState(), 'long-idle')
  finish(first)
  assert.equal(controller.getState(), 'idle')

  controller.update(2.1)
  assert.equal(controller.getState(), 'long-idle')
  finish(second)
  assert.equal(controller.getState(), 'idle')

  controller.update(2.1)
  assert.equal(controller.getState(), 'long-idle')
  controller.setSpeaking(true)
  assert.equal(controller.getState(), 'talking')
})

test('a preview returns to the current core state when it finishes', () => {
  const { controller, finish } = createFixture()
  const preview = new FakeAction('preview')

  controller.setSpeaking(true)
  controller.playPreview(preview, { loop: false })
  assert.equal(controller.getState(), 'preview')
  finish(preview)
  assert.equal(controller.getState(), 'talking')
})

test('movement interrupts a looping development preview', () => {
  const { controller } = createFixture()
  const preview = new FakeAction('preview')

  controller.playPreview(preview, { loop: true })
  assert.equal(controller.getState(), 'preview')
  controller.setMoving(true)
  assert.equal(controller.getState(), 'walking')
})

test('real Three.js actions reactivate after repeated core-state crossfades', () => {
  const root = new THREE.Object3D()
  const mixer = new THREE.AnimationMixer(root)
  const actionFor = (name, start, end) => mixer.clipAction(
    new THREE.AnimationClip(name, 1, [
      new THREE.NumberKeyframeTrack(
        '.position[x]',
        [0, 1],
        [start, end],
      ),
    ]),
  )
  const actions = {
    idle: actionFor('idle', 0, 1),
    talking: actionFor('talking', 1, 2),
    walking: actionFor('walking', 2, 3),
    running: actionFor('running', 3, 4),
  }
  const controller = createAvatarAnimationController({
    mixer,
    actions,
    transitionDuration: 0.1,
    idleVariationsEnabled: false,
  })

  controller.update(0.05)
  controller.setMoving(true)
  controller.update(0.15)
  controller.setMoving(false)
  controller.update(0.15)

  assert.equal(controller.getState(), 'idle')
  assert.equal(actions.idle.enabled, true)
  assert.equal(actions.idle.paused, false)
  assert.equal(actions.idle.isRunning(), true)
  assert.ok(actions.idle.getEffectiveWeight() > 0)

  controller.setSpeaking(true)
  controller.update(0.15)
  controller.setSpeaking(false)
  controller.update(0.15)

  assert.equal(controller.getState(), 'idle')
  assert.equal(actions.idle.enabled, true)
  assert.equal(actions.idle.paused, false)
  assert.equal(actions.idle.isRunning(), true)
  assert.ok(actions.idle.getEffectiveWeight() > 0)
})
