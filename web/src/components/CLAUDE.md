# components/ — React Components

```text
components/
└── AvatarScene.jsx   # The entire app — 3D scene + chat UI in one component
```

---

## AvatarScene.jsx

Single component that owns both the Three.js renderer and the React chat UI. They share state through refs since the render loop lives inside a `useEffect` closure.

### Refs

| Ref | What it holds |
| --- | ------------- |
| `canvasRef` | The `<canvas>` element Three.js renders into. |
| `vrmRef` | The loaded VRM instance. Animations read from this every frame. |
| `mixerRef` | The Three.js `AnimationMixer` driving the VRMA clip. |
| `waveRef` | Wave animation state object. Updated by `triggerWave` and read by `updateWave`. |
| `triggerRef` | Function that starts the wave. Stored as a ref so the "Wave Hi" button can call it without stale closure issues. |
| `speakRef` | Function that invokes Web Speech API TTS + lip sync. Ref so the chat handler can call it after the `useEffect` closure is set up. |
| `inputRef` | The chat input element. Read directly on send to avoid controlled-input re-renders. |

### Functions

| Function | Purpose |
| -------- | ------- |
| `useEffect` (main) | Sets up renderer, camera, lights, OrbitControls, GLTF/VRM/VRMA loaders, classroom scene, and the `animate` render loop. Returns a cleanup that cancels animation, removes listeners, and disposes the renderer. |
| `handleSend()` | Reads input, posts `{ messages }` to `localhost:8001/chat`, appends the reply and song cards to state, calls `speakRef` to voice the response. |
| `handleKeyDown(e)` | Calls `handleSend` on Enter. |

### Scene Setup Notes

| Detail | Why |
| ------ | --- |
| Camera at `(0, 1.4, -4.0)` | VRM faces -Z; negative Z positions the camera in front without rotating the model. |
| `LoopPingPong` on VRMA | Clip's last frame doesn't match first — ping-pong avoids the jump at the loop boundary. |
| Hips quaternion track removed | `Normalized_J_Bip_C_Hips.quaternion` overrides facing direction mid-animation, causing a flip. |

### Chat UI Layout

- **Top-right panel** — scrollable message history. User messages align right (purple), assistant messages align left (frosted glass). Song recommendations render as clickable Last.fm cards below each assistant message.
- **Bottom-center bar** — "Wave Hi" button, text input, Send button.
