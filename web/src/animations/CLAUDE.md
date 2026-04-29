# animations/ — VRM Animation Modules

All animation is procedural (no external animation library). Each module exports pure functions that are called every frame from the render loop in `AvatarScene.jsx`.

```text
animations/
├── utils.js     # Shared math helpers
├── idle.js      # Breathing, head drift, blinking
├── wave.js      # Wave-hi gesture state machine
└── lipsync.js   # Jaw movement during speech
```

---

## utils.js

| Function | Purpose |
| -------- | ------- |
| `lerp(a, b, t)` | Linear interpolation between two values. |
| `smoothstep(t)` | Cubic ease-in/out. Prevents snapping at the start and end of animation phase transitions. |
| `bone(vrm, name)` | Null-safe VRM humanoid bone lookup. Returns `null` for missing bones so callers can guard with `if (bone)` instead of try/catch. |

---

## idle.js

Runs every frame while the avatar is loaded.

| Function | Purpose |
| -------- | ------- |
| `updateIdle(vrm, elapsed)` | Chest breathing and slow head drift. Two different sine frequencies on the head axes keep motion from looking mechanical. |
| `createBlinkState()` | Initializes blink timer. Interval is randomized (3–5 s) so blinks don't fall on a fixed beat. |
| `updateBlink(vrm, state, delta)` | Advances the blink timer. When triggered, drives the eyelid with a sin curve over `progress` for natural ease-in/out. |

---

## wave.js

One-shot gesture triggered by the "Wave Hi" button.

| Constant / Function | Purpose |
| ------------------- | ------- |
| `REST` | Z-axis bone rotations for the default standing pose. |
| `WAVE_TARGET` | Z-axis bone rotations for the raised-arm wave pose. |
| `PHASES` | Duration in seconds of each phase: `up: 0.4`, `wave: 2.0`, `down: 0.5`. |
| `createWaveState()` | Returns `{phase: null, time: 0}`. `phase: null` = idle. |
| `triggerWave(stateRef)` | Starts the wave. No-ops if already playing. |
| `applyRestPose(vrm)` | Sets bones to rest rotations right after VRM loads so the avatar doesn't show T-pose on first frame. |
| `updateWave(vrm, stateRef, delta)` | Three-phase state machine: `up` lerps to wave pose, `wave` oscillates the hand, `down` lerps back to rest. `smoothstep` on the lerp `t` prevents linear snapping. |

---

## lipsync.js

Activated by Web Speech API events; drives jaw movement during TTS playback.

| Function | Purpose |
| -------- | ------- |
| `createLipSyncState()` | Returns `{speaking: false, phase: 0}`. |
| `startSpeaking(state)` | Called on `utterance.onstart`. Activates the lip sync loop. |
| `stopSpeaking(state, vrm)` | Called on `utterance.onend` / `onerror`. Deactivates loop and zeroes the jaw bone. |
| `updateLipSync(vrm, state, delta)` | Oscillates jaw bone with `Math.abs(Math.sin(phase))`. Jaw bone is used directly because Esme's VRM has no morph target binds — `expressionManager.setValue('aa', ...)` is a silent no-op on this model. |
