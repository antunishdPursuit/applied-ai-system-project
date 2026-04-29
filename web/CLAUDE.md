# web/ — React + Three.js Frontend

## What's Here

The browser app. Renders a 3D VRM avatar (Esme) in a classroom environment, lets the user chat with her, and displays song recommendations as clickable cards.

```text
web/
├── src/
│   ├── animations/          # VRM animation modules → see src/animations/CLAUDE.md
│   ├── components/          # React components → see src/components/CLAUDE.md
│   ├── App.jsx
│   └── main.jsx
└── public/
    ├── Esme.vrm             # VRM avatar model
    ├── vrma/                # VRMA animation clips (VRMA_01–07)
    └── Classroom/           # 3D classroom environment (scene.gltf + assets)
```

---

## How to Run

```bash
cd web
npm install
npm run dev   # starts on http://localhost:5173
```

Backend must also be running on port 8001 for chat to work.

---

## Architecture

```text
Browser
  ├── Three.js          — 3D rendering
  ├── @pixiv/three-vrm  — VRM avatar loading and bone/expression control
  ├── Web Speech API    — text-to-speech (free, built-in, no setup)
  └── Chat UI           — message bubbles + song cards

        ↕ HTTP JSON (localhost:8001)

FastAPI backend → Claude → Last.fm
```

---

## Build Phases

| Phase | Goal                                              | Status |
| ----- | ------------------------------------------------- | ------ |
| 1     | VRM avatar renders with idle animation            | Done   |
| 2     | Avatar speaks via Web Speech API + lip sync       | Done   |
| 3     | Chat UI wired to Claude for conversation          | Done   |
| 4     | Backend fetches real songs from Last.fm           | Done   |
| 5     | Avatar recommends songs through conversation      | Done   |

---

## TTS Roadmap

- **Now:** Browser Web Speech API — free, zero setup, validates the pipeline.
- **Next:** Migrate to ElevenLabs for natural voice quality. ElevenLabs also provides viseme timing data which enables phoneme-accurate lip sync.

## Avatar Roadmap

- **Now:** Free CC0 VRM from VRoid Hub (Esme) for all prototyping.
- **Future:** Ship a custom-designed default avatar as the product identity.
- **Future:** Let users swap in their own VRM file, but the default is always the custom one.

---

## Key Design Decisions

| Decision | Why |
| -------- | --- |
| Camera at `(0, 1.4, -4.0)` | VRM models face -Z by default; negative Z puts the camera in front without rotating the model. |
| `LoopPingPong` on VRMA clip | The clip's last frame doesn't match its first — ping-pong prevents a visible jump at the loop boundary. |
| Hips quaternion track filtered out | That track overrides the avatar's facing direction mid-animation, causing a flip. |
| `speakRef` / `triggerRef` pattern | The Three.js render loop lives inside a `useEffect` closure that can't see React state updates — refs bypass the stale closure problem. |
