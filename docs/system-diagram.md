# System Diagram

## Architecture Overview

```mermaid
flowchart TD
    User([👤 User])

    subgraph FRONTEND ["Frontend — React + Three.js (port 5173)"]
        ChatUI[Chat UI\nmessage bubbles + song cards]
        LikedPanel[Liked Songs Panel\npick ♡ / remove ♥]
        Avatar[Esme Avatar\n3D VRM + lip sync]
        TTS[TTS Engine\nElevenLabs or Browser]
    end

    subgraph BACKEND ["Backend — FastAPI (port 8001)"]
        FallbackCheck{API keys\nset?}
        ChatRoute[/chat]
        TTSRoute[/tts]
    end

    subgraph AI_LAYER ["AI Layer"]
        Claude[Claude Haiku\nextracts genre + mood\nforms spoken reply]
        LastFM[Last.fm API\nfetches top tracks by tag]
    end

    subgraph FALLBACK ["Fallback Layer — no keys required"]
        KeywordMatch[Keyword Matcher\nlofi · pop · rock · sad ...]
        PythonRec[Python Recommender\nscores 18 songs from songs.csv]
    end

    subgraph TESTING ["Testing & Human Evaluation"]
        Pytest[pytest\ntest_recommender.py]
        Profiles[6 Hardcoded Profiles\n3 realistic · 3 adversarial]
        HumanReview[👤 Human Review\ndo results match expectations?]
    end

    %% Normal chat flow
    User -->|types message| ChatUI
    ChatUI -->|POST /chat| ChatRoute
    ChatRoute --> FallbackCheck

    %% AI path
    FallbackCheck -->|yes| Claude
    Claude -->|tool call: get_recommendations| LastFM
    LastFM -->|track list| Claude
    Claude -->|response text + songs| ChatRoute

    %% Fallback path
    FallbackCheck -->|no| KeywordMatch
    KeywordMatch -->|matched profile| PythonRec
    PythonRec -->|top 5 songs + canned reply| ChatRoute

    %% Response back to user
    ChatRoute -->|response + song cards| ChatUI
    ChatUI -->|trigger speech| TTS
    TTS -->|audio playback| Avatar
    Avatar -->|amplitude-driven jaw| Avatar

    %% Liked songs → profile trigger
    User -->|♡ picks a song| LikedPanel
    LikedPanel -->|5 picks → auto message| ChatRoute

    %% Voice
    User -->|POST /tts| TTSRoute
    TTSRoute -->|mp3 audio| TTS

    %% Testing loop
    Pytest -->|validates scoring logic| PythonRec
    Profiles -->|run through recommender| PythonRec
    PythonRec -->|ranked results| HumanReview
    HumanReview -->|adjust weights or profiles| Profiles
```

---

## Component Summary

| Component | Role | Type |
| --- | --- | --- |
| **Chat UI** | Accepts user input, renders Esme's replies and song cards | Frontend |
| **Liked Songs Panel** | Tracks up to 5 picked songs; triggers profile message | Frontend |
| **Esme Avatar** | 3D VRM with idle animation, blinking, and lip sync | Frontend |
| **TTS Engine** | Speaks Esme's replies — ElevenLabs (natural) or browser (fallback) | Frontend |
| **FastAPI `/chat`** | Orchestrates Claude + Last.fm or routes to fallback | Backend |
| **FastAPI `/tts`** | Proxies text to ElevenLabs, returns mp3 | Backend |
| **Claude Haiku** | Extracts genre/mood via tool use, forms the spoken reply | AI Agent |
| **Last.fm API** | Retrieves real song recommendations by genre/mood tag | Retriever |
| **Keyword Matcher** | Maps user message words to the closest taste profile | Fallback |
| **Python Recommender** | Scores 18 songs against a profile, returns top 5 | Fallback / Evaluator |
| **pytest suite** | Validates sorting, scoring, and explanation logic | Automated Testing |
| **6 Test Profiles** | Covers realistic and adversarial user types | Evaluation |
| **Human Review** | Checks whether ranked results match expected taste | Human-in-the-loop |

---

## Data Flow Summary

```
User message
    → Frontend (Chat UI)
    → Backend /chat
        → [keys set]   Claude extracts genre/mood → Last.fm fetches tracks → Claude forms reply
        → [no keys]    Keyword match → Python Recommender scores songs.csv
    → Response text + song list
    → Frontend renders cards + triggers Esme to speak
    → TTS audio → amplitude-driven lip sync on jaw bone
```

## Where Humans Are Involved

| Touch point | What the human does |
| --- | --- |
| **Chat input** | Sends natural language messages to Esme |
| **Song picks** | Chooses songs they like from recommendation cards |
| **Profile evaluation** | Reviews whether the 6 test profiles return sensible results |
| **Weight tuning** | Adjusts scoring weights in `recommender.py` based on observed bias |
