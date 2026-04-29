# src/ — Python Recommender Engine

## What's Here

The core scoring engine. No ML, no external APIs — everything runs off `data/songs.csv`.

```text
src/
├── recommender.py   # Scoring engine, data classes, OOP wrapper
└── main.py          # CLI runner with 6 hardcoded test profiles
tests/
└── test_recommender.py
```

---

## Core Concepts

### The Catalog

`data/songs.csv` holds 18 synthetic songs. Each row has:

| Field        | Type   | Range            |
| ------------ | ------ | ---------------- |
| id           | int    | —                |
| title        | string | —                |
| artist       | string | —                |
| genre        | string | 15 unique values |
| mood         | string | 14 unique values |
| energy       | float  | 0.0 – 1.0        |
| tempo_bpm    | int    | 58 – 168 BPM     |
| valence      | float  | 0.0 – 1.0        |
| danceability | float  | 0.0 – 1.0        |
| acousticness | float  | 0.0 – 1.0        |

### The User Profile

A profile is a dict (or `UserProfile` dataclass) that specifies a taste snapshot:

- `favorite_genre` — string (e.g., `"lofi"`)
- `favorite_mood` — string (e.g., `"chill"`)
- `target_energy` — float 0.0–1.0
- `target_valence` — float 0.0–1.0
- `target_tempo` — int BPM
- `target_danceability` — float 0.0–1.0
- `target_acousticness` — float 0.0–1.0

---

## Data Flow

```text
User Profile (hardcoded dict in main.py)
        ↓
load_songs("data/songs.csv")  →  list of dicts
        ↓
score_song(user_prefs, song)  ×18
        ↓
Sort descending by score
        ↓
Diversity filter (max 1 song per artist)
        ↓
Return top-5 (song, score, explanation)
        ↓
print_recommendations() → terminal
```

---

## Scoring Algorithm

Maximum possible score is **9.0 points**:

| Feature        | Max pts | Rule                                    |
| -------------- | ------- | --------------------------------------- |
| Genre          | +2.0    | exact string match or 0                 |
| Energy         | +2.0    | `2.0 × (1 − \|song − target\|)`         |
| Acousticness   | +1.5    | `1.5 × (1 − \|song − target\|)`         |
| Mood           | +1.0    | exact string match or 0                 |
| Valence        | +1.0    | `1.0 × (1 − \|song − target\|)`         |
| Tempo          | +1.0    | normalized over 110 BPM range           |
| Danceability   | +0.5    | `0.5 × (1 − \|song − target\|)`         |

Genre alone (+2.0) outweighs any single numeric feature — a wrong-genre song almost never makes the top 5.

After scoring, the top 3 contributing reasons (by points) are surfaced as a plain-English explanation.

---

## Diversity Filter

After ranking, no more than 1 song per artist appears in the final top-k. Only applies when there are at least `k` distinct artists in the catalog.

---

## Function Reference

### `recommender.py`

| Function / class | Purpose |
| ---------------- | ------- |
| `load_songs(csv_path)` | Reads songs.csv, returns a list of dicts with typed numeric fields. |
| `score_song(user_prefs, song)` | Scores one song against preferences. Returns `(total_score, reason_strings)`. |
| `recommend_songs(user_prefs, songs, k=5)` | Full pipeline: score → sort → diversity filter → top-k. Returns `(song, score, explanation)` tuples. |
| `Song` dataclass | Typed representation of a catalog song. Required by the test suite. |
| `UserProfile` dataclass | Typed representation of user preferences with sensible defaults. |
| `Recommender` class | OOP wrapper around the standalone functions. Required by the test suite. |
| `_profile_to_dict(user)` | Converts `UserProfile` to the dict format `score_song` expects. |
| `_song_to_dict(song)` | Converts `Song` dataclass to the dict format `score_song` expects. |

### `main.py`

| Function | Purpose |
| -------- | ------- |
| `print_recommendations(profile, recs)` | Formats and prints the top-5 results for one profile to the terminal. |
| `main()` | Loads the CSV, runs all 6 profiles, prints results. |

### `tests/test_recommender.py`

| Test | What it checks |
| ---- | -------------- |
| `test_recommend_returns_songs_sorted_by_score` | Results are ordered highest score first. |
| `test_explain_recommendation_returns_non_empty_string` | Explanation string is non-empty for any song. |

---

## The 6 Test Profiles

| Name                   | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| Chill Lofi Student     | Realistic — low energy, lofi genre                            |
| High-Energy Pop Fan    | Realistic — high energy, pop genre                            |
| Deep Intense Rock      | Realistic — high energy, rock genre                           |
| Conflicted             | Adversarial — high energy but melancholic mood (valence 0.15) |
| Missing Genre (Opera)  | Adversarial — genre not in catalog; tests fallback to numeric |
| Average User           | Adversarial — all numeric targets at 0.5 midpoint             |

---

## Known Limitations

- **Genre lock-in** — categorical +2.0 dominates; similar genres (lofi/ambient) earn nothing from genre matching
- **Single targets** — a user can't express "energetic at the gym, chill at home"
- **No partial credit for categories** — mood and genre are binary matches
- **Tiny catalog** — 18 songs means biases are stark and obvious
- **Synthetic data** — audio features aren't measured from real tracks
- **No feedback loop** — system never learns from user reactions
