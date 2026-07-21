import sys
import os
from urllib.parse import urlparse
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Annotated, Literal, Optional
import anthropic
import httpx
from dotenv import load_dotenv
from src.recommender import load_songs, recommend_songs
from src.main import CHILL_LOFI, HIGH_ENERGY_POP, DEEP_ROCK, CONFLICTING_ENERGY_MOOD, AVERAGE_USER

load_dotenv()

# ---------------------------------------------------------------------------
# Fallback recommender — used when ANTHROPIC_API_KEY or LASTFM_API_KEY is missing
# ---------------------------------------------------------------------------

_SONGS = load_songs(os.path.join(os.path.dirname(__file__), '..', 'data', 'songs.csv'))

_KEYWORD_PROFILES = [
    ({"lofi", "chill", "study", "focus", "calm", "relax", "soft", "lo-fi"},         CHILL_LOFI),
    ({"pop", "dance", "energy", "energetic", "workout", "gym", "upbeat", "happy"},  HIGH_ENERGY_POP),
    ({"rock", "metal", "intense", "heavy", "dark", "angry", "loud", "hard"},        DEEP_ROCK),
    ({"sad", "moody", "melancholy", "emotional", "heartbreak", "depressed"},        CONFLICTING_ENERGY_MOOD),
]

_FALLBACK_INTROS = {
    "Chill Lofi Student":                        "I can feel those chill study vibes! Here are some mellow tracks I think you'll love.",
    "High-Energy Pop Fan":                       "You want to move! Here are some high-energy tracks to keep the momentum going.",
    "Deep Intense Rock":                         "Time to turn it up! Here are some intense tracks that should hit the spot.",
    "Conflicted (high energy + melancholic mood)":"Here are some tracks with that raw, emotional intensity you're after.",
}

def _fallback_recommend(message: str) -> dict:
    words = set(message.lower().split())
    profile = AVERAGE_USER
    for keywords, candidate in _KEYWORD_PROFILES:
        if words & keywords:
            profile = candidate
            break

    results = recommend_songs(profile, _SONGS, k=5)
    intro   = _FALLBACK_INTROS.get(profile["name"], "Here are some tracks I think you'll enjoy!")
    titles  = " and ".join(f'"{s["title"]}"' for s, _, _ in results[:2])
    response_text = f"{intro} I'd start with {titles}."

    recommendations = [
        {"title": song["title"], "artist": song["artist"], "url": ""}
        for song, _, _ in results
    ]
    return {"response": response_text, "recommendations": recommendations}


def _is_fallback_mode() -> bool:
    return not os.getenv("ANTHROPIC_API_KEY") or not os.getenv("LASTFM_API_KEY")

app = FastAPI()

LOCAL_FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

LASTFM_BASE = "http://ws.audioscrobbler.com/2.0/"
LASTFM_HEADERS = {
    "User-Agent": "EsmeMusicAssistant/1.0 (https://github.com/antunishdPursuit/applied-ai-system-project)",
}
PROVIDER_TIMEOUT = httpx.Timeout(15.0)


class ProviderError(RuntimeError):
    """An external provider failed without exposing its response to the client."""


def _anthropic_client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        timeout=PROVIDER_TIMEOUT,
        max_retries=1,
    )

SYSTEM_PROMPT = (
    "You are Esme, a warm and friendly music assistant. "
    "IMPORTANT: Whenever the user mentions music, songs, artists, genres, moods, or asks what to listen to, "
    "you MUST call the get_recommendations tool — never answer music questions from your own knowledge. "
    "After getting results, respond in 2 sentences max since your words are spoken aloud. "
    "Mention 1 or 2 song titles by name to make it feel personal."
)

TOOLS = [
    {
        "name": "get_recommendations",
        "description": (
            "Fetch real song recommendations from Last.fm by genre and mood. "
            "Use this whenever the user asks for music suggestions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "genre": {
                    "type": "string",
                    "description": "Music genre, e.g. lofi, pop, rock, jazz, hip-hop, classical, electronic",
                },
                "mood": {
                    "type": "string",
                    "description": "Optional mood or vibe, e.g. chill, happy, energetic, sad, focused",
                },
            },
            "required": ["genre"],
        },
    }
]

# Keywords that signal a music-related request. When matched, tool_choice is
# forced to "any" so Claude cannot answer from training knowledge instead of
# calling get_recommendations.
MUSIC_KEYWORDS = {
    "music", "song", "songs", "track", "tracks", "artist", "listen", "recommend",
    "recommendation", "playlist", "genre", "lofi", "pop", "rock", "jazz", "hip-hop",
    "electronic", "classical", "chill", "energetic", "sad", "happy", "vibe", "beats",
    "albums", "album", "rapper", "band", "singer", "tune", "tunes",
}


async def fetch_tracks(tag: str, limit: int = 5) -> list:
    """Call Last.fm tag.gettoptracks and return the track list."""
    api_key = os.getenv("LASTFM_API_KEY")
    try:
        async with httpx.AsyncClient(timeout=PROVIDER_TIMEOUT, headers=LASTFM_HEADERS) as http:
            resp = await http.get(LASTFM_BASE, params={
                "method":  "tag.gettoptracks",
                "tag":     tag.lower(),
                "api_key": api_key,
                "format":  "json",
                "limit":   limit,
            })
            resp.raise_for_status()
            payload = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ProviderError("Last.fm request failed") from exc

    tracks = payload.get("tracks", {}).get("track", [])
    if not isinstance(tracks, list):
        raise ProviderError("Last.fm returned an unexpected response")
    return tracks


def _format_tracks(tracks: list) -> list[dict]:
    """Return only complete track records that the frontend can display safely."""
    formatted = []
    for track in tracks:
        name = track.get("name") if isinstance(track, dict) else None
        artist = track.get("artist", {}) if isinstance(track, dict) else {}
        artist_name = artist.get("name") if isinstance(artist, dict) else None
        if name and artist_name:
            raw_url = track.get("url", "")
            parsed_url = urlparse(raw_url)
            hostname = parsed_url.hostname or ""
            safe_url = raw_url if (
                parsed_url.scheme == "https"
                and (hostname == "last.fm" or hostname.endswith(".last.fm"))
            ) else ""
            formatted.append({"title": name, "artist": artist_name, "url": safe_url})
    return formatted


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, Field(min_length=1, max_length=2000)]


class ChatRequest(BaseModel):
    messages: Annotated[list[Message], Field(min_length=1, max_length=20)]


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Two-pass Claude conversation with tool use.

    Pass 1: Send the conversation history. If the message contains music keywords,
            force tool_choice="any" so Claude must call get_recommendations.
    Pass 2: After fetching tracks from Last.fm, send the tool result back so
            Claude can form a natural spoken response that names specific songs.
    """
    if _is_fallback_mode():
        last_msg = request.messages[-1].content
        return _fallback_recommend(last_msg)

    history = [{"role": m.role, "content": m.content} for m in request.messages]

    last_msg = request.messages[-1].content.lower()
    is_music = any(kw in last_msg for kw in MUSIC_KEYWORDS)
    tool_choice = {"type": "any"} if is_music else {"type": "auto"}

    client = _anthropic_client()
    try:
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            tool_choice=tool_choice,
            messages=history,
        )
    except anthropic.APIError as exc:
        raise HTTPException(status_code=502, detail="Music assistant provider unavailable") from exc

    recommendations = None

    if response.stop_reason == "tool_use":
        tool_block = next(b for b in response.content if b.type == "tool_use")
        genre = tool_block.input.get("genre", "pop")
        mood  = tool_block.input.get("mood")

        try:
            tracks = await fetch_tracks(genre)
            # Fall back to mood tag if the genre tag returns nothing on Last.fm.
            if not tracks and mood:
                tracks = await fetch_tracks(mood)
        except ProviderError as exc:
            raise HTTPException(status_code=502, detail="Music data provider unavailable") from exc

        recommendations = _format_tracks(tracks)

        tracks_text = "\n".join(
            f"- {t['title']} by {t['artist']}" for t in recommendations
        )

        try:
            response = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=history + [
                    {"role": "assistant", "content": response.content},
                    {"role": "user", "content": [
                        {
                            "type":        "tool_result",
                            "tool_use_id": tool_block.id,
                            "content":     tracks_text,
                        }
                    ]},
                ],
            )
        except anthropic.APIError as exc:
            raise HTTPException(status_code=502, detail="Music assistant provider unavailable") from exc

    text = next((b.text for b in response.content if hasattr(b, "text")), "")
    return {"response": text, "recommendations": recommendations}


class TTSRequest(BaseModel):
    text: Annotated[str, Field(min_length=1, max_length=1000)]


@app.get("/tts/available")
def tts_available():
    return {"elevenlabs": bool(os.getenv("ELEVENLABS_API_KEY"))}


@app.post("/tts")
async def tts(req: TTSRequest):
    api_key  = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=501, detail="ELEVENLABS_API_KEY not configured")

    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "")

    try:
        async with httpx.AsyncClient(timeout=PROVIDER_TIMEOUT) as http:
            if not voice_id:
                voices_resp = await http.get(
                    "https://api.elevenlabs.io/v1/voices",
                    headers={"xi-api-key": api_key},
                )
                voices_resp.raise_for_status()
                voices = voices_resp.json().get("voices", [])
                if not voices:
                    raise ProviderError("ElevenLabs returned no voices")
                voice_id = voices[0]["voice_id"]

            resp = await http.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers={"xi-api-key": api_key, "Content-Type": "application/json"},
                json={
                    "text": req.text,
                    "model_id": "eleven_turbo_v2",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
                },
            )
            resp.raise_for_status()
    except (httpx.HTTPError, ValueError, KeyError, ProviderError) as exc:
        raise HTTPException(status_code=502, detail="Voice provider unavailable") from exc

    return Response(content=resp.content, media_type="audio/mpeg")


class RecommendRequest(BaseModel):
    genre: Annotated[str, Field(min_length=1, max_length=100)]
    mood:  Optional[Annotated[str, Field(min_length=1, max_length=100)]] = None
    limit: Annotated[int, Field(ge=1, le=10)] = 5


@app.post("/recommend")
async def recommend(req: RecommendRequest):
    """Direct Last.fm lookup — no Claude involved. Used for testing the data layer."""
    if not os.getenv("LASTFM_API_KEY"):
        raise HTTPException(status_code=500, detail="LASTFM_API_KEY not set")

    try:
        tracks = await fetch_tracks(req.genre, req.limit)
        if not tracks and req.mood:
            tracks = await fetch_tracks(req.mood, req.limit)
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail="Music data provider unavailable") from exc
    if not tracks:
        raise HTTPException(status_code=404, detail=f"No tracks found for '{req.genre}'")

    return {
        "tag": req.genre,
        "recommendations": _format_tracks(tracks),
    }
