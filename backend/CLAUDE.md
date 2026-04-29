# backend/ — FastAPI Server

## What's Here

The HTTP layer between the browser and the AI/data services. Runs on port 8001.

```text
backend/
├── main.py           # FastAPI app — two endpoints
├── requirements.txt  # fastapi, uvicorn, anthropic, httpx, python-dotenv
└── .env              # ANTHROPIC_API_KEY, LASTFM_API_KEY (gitignored)
```

---

## How to Run

```bash
cd backend
python -m uvicorn main:app --reload --port 8001
```

---

## Endpoints

### `POST /chat`

Two-pass Claude conversation with Last.fm tool use.

**Request:** `{ messages: [{ role, content }] }`

**Response:** `{ response: string, recommendations: Song[] | null }`

**Flow:**
1. Checks the last message for music keywords.
2. If music is detected, forces `tool_choice="any"` so Claude must call `get_recommendations` instead of answering from training knowledge.
3. `get_recommendations` returns a genre + optional mood → Last.fm is queried.
4. Track list is sent back as a tool result; Claude forms a short spoken reply naming 1–2 songs.

### `POST /recommend`

Direct Last.fm lookup with no Claude involved. Useful for testing the data layer independently.

**Request:** `{ genre: string, mood?: string, limit?: int }`

**Response:** `{ tag: string, recommendations: Song[] }`

---

## Function Reference

| Function / constant | Purpose |
| ------------------- | ------- |
| `fetch_tracks(tag, limit)` | Calls Last.fm `tag.gettoptracks`. Falls back to the mood tag if the genre tag returns no results. |
| `POST /chat` | See flow above. Returns both the spoken response text and the raw song list for the frontend to render as cards. |
| `POST /recommend` | Direct Last.fm lookup. No Claude call. |
| `MUSIC_KEYWORDS` | Set of words that trigger `tool_choice="any"`. Prevents Claude from answering music questions from its training data. |
| `SYSTEM_PROMPT` | Instructs Claude to act as Esme, keep replies to 2 sentences, and always use the tool for music questions. |
| `TOOLS` | Defines the `get_recommendations` tool schema that Claude uses to extract genre and mood from the user's message. |

---

## Environment Variables

| Variable | Used by |
| -------- | ------- |
| `ANTHROPIC_API_KEY` | Claude API calls in `/chat` |
| `LASTFM_API_KEY` | Last.fm requests in `fetch_tracks` |
