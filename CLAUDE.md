# CLAUDE.md — Project Index

## What This Project Is

A rule-based music recommender with a 3D talking avatar web app on top. The Python engine scores songs against a user taste profile and returns the top 5. The web layer presents those recommendations through a VRM avatar named Esme who speaks the results aloud.

---

## Directory Layout

```text
applied-ai-system-project/
├── data/
│   └── songs.csv              # 18-song catalog (the only data source)
├── src/                       # Python recommender engine → see src/CLAUDE.md
│   ├── recommender.py
│   └── main.py
├── tests/                     # pytest suite → see src/CLAUDE.md
│   └── test_recommender.py
├── backend/                   # FastAPI server → see backend/CLAUDE.md
│   ├── main.py
│   └── requirements.txt
├── web/                       # React + Three.js frontend → see web/CLAUDE.md
│   ├── src/
│   │   ├── animations/        # VRM animation modules → see web/src/animations/CLAUDE.md
│   │   └── components/        # React components → see web/src/components/CLAUDE.md
│   └── public/
│       ├── Esme.vrm
│       ├── vrma/
│       └── Classroom/
├── model_card.md
└── README.md
```

---

## Where to Go

| I want to understand...            | Read this                                                    |
| ---------------------------------- | ------------------------------------------------------------ |
| The scoring algorithm              | [src/CLAUDE.md](src/CLAUDE.md)                               |
| The test profiles and known limits | [src/CLAUDE.md](src/CLAUDE.md)                               |
| The FastAPI endpoints              | [backend/CLAUDE.md](backend/CLAUDE.md)                       |
| The 3D scene and chat UI           | [web/CLAUDE.md](web/CLAUDE.md)                               |
| The VRM animation system           | [web/src/animations/CLAUDE.md](web/src/animations/CLAUDE.md) |
| The AvatarScene component          | [web/src/components/CLAUDE.md](web/src/components/CLAUDE.md) |

---

## How to Run

```bash
# Python recommender CLI
pip install -r requirements.txt
python src/main.py

# Backend (from /backend)
python -m uvicorn main:app --reload --port 8001

# Frontend (from /web)
npm install
npm run dev
```
