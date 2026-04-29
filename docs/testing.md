# Testing & Reliability

This document covers the four ways the system proves it works: automated unit tests, confidence scoring built into the recommender, logging and error handling in the backend, and human evaluation across six user profiles.

---

## 1. Automated Tests

**File:** `tests/test_recommender.py`  
**Run with:** `pytest`

Two unit tests cover the core scoring engine:

| Test | What it checks | Result |
| --- | --- | --- |
| `test_recommend_returns_songs_sorted_by_score` | Given a pop/happy/high-energy profile, the pop song ranks above the lofi song | ✅ Pass |
| `test_explain_recommendation_returns_non_empty_string` | Every recommendation includes a non-empty plain-English explanation | ✅ Pass |

**2/2 tests pass.** The tests use a minimal 2-song in-memory catalog so they run fast and are not affected by changes to `songs.csv`.

**What they don't cover:** the FastAPI endpoints, Claude tool use, Last.fm responses, or the frontend. Those layers are tested through logging and human evaluation below.

---

## 2. Confidence Scoring

The Python recommender returns a numeric score (0.0–9.0) for every song. This score acts as a built-in confidence signal — how well a song matches the profile is directly readable from the output.

**Observed score ranges across the 6 test profiles:**

| Profile | #1 score | #2 score | Gap | Interpretation |
| --- | --- | --- | --- | --- |
| Chill Lofi Student | 8.78 | ~7.5 | Large | System is confident — clear winner |
| High-Energy Pop Fan | 8.92 | ~7.8 | Large | System is confident |
| Deep Intense Rock | 8.80 | ~7.4 | Large | System is confident |
| Conflicted (high energy + melancholic) | 8.72 | ~7.2 | Large | Energy dominates, still confident |
| Opera Fan (genre not in catalog) | ~6.8 | ~6.5 | Small | Genre bonus never fires — scores compress, lower confidence |
| Average User (all 0.5 targets) | 7.83 | 5.61 | Large gap but low absolute score | Only genre/mood bonus differentiates — fragile ranking |

**Key finding:** when the genre bonus fires, scores are high and well-separated (confident). When it doesn't (opera fan, average user), scores compress and the ranking becomes less reliable. The score gap between #1 and #2 is a practical confidence indicator.

---

## 3. Logging and Error Handling

The backend logs failures explicitly rather than silently swallowing them.

### ElevenLabs TTS errors

```python
if resp.status_code != 200:
    print(f"ElevenLabs error {resp.status_code}: {resp.text}")
    raise HTTPException(status_code=502, detail=f"ElevenLabs error {resp.status_code}: {resp.text}")
```

This caught two real errors during development:
- **402 Payment Required** — the hardcoded Rachel voice ID requires a paid plan. Fixed by auto-fetching the first voice in the user's account.
- **404 Not Found** — a stale voice ID from a previous test. Fixed by clearing `ELEVENLABS_VOICE_ID` in `.env`.

### API key fallback

```python
def _is_fallback_mode() -> bool:
    return not os.getenv("ANTHROPIC_API_KEY") or not os.getenv("LASTFM_API_KEY")
```

If either key is missing, `/chat` routes to the Python recommender instead of raising a 500 error. The frontend receives the same response shape either way — the degradation is invisible to the user.

### Voice availability endpoint

```python
@app.get("/tts/available")
def tts_available():
    return {"elevenlabs": bool(os.getenv("ELEVENLABS_API_KEY"))}
```

The frontend queries this on load and disables the ElevenLabs button if the key isn't set, preventing a misleading active UI state over a broken feature.

---

## 4. Human Evaluation

Six profiles were run through the recommender and results were checked manually against expected behavior.

| Profile | Expected | Actual | Pass? |
| --- | --- | --- | --- |
| Chill Lofi Student | lofi/chill song at #1 | Library Rain (lofi/chill) — 8.78 | ✅ |
| High-Energy Pop Fan | pop/intense song at #1 | Gym Hero (pop/intense) — 8.92 | ✅ |
| Deep Intense Rock | rock/intense song at #1 | Storm Runner (rock/intense) — 8.80 | ✅ |
| Conflicted (high energy + melancholic) | high energy wins over mood | Ember and Ash (metal/high energy) — 8.72 | ✅ |
| Opera Fan (genre not in catalog) | numeric fallback, no genre match | Moonlit Serenade rises on acousticness + mood | ✅ |
| Average User (all 0.5) | scores compress, genre/mood decide | Coffee Shop Stories wins on jazz + relaxed match | ✅ |

**6/6 profiles produced results that matched expected behavior.**

The most surprising result was the Opera Fan: without any genre match, the system still returned a classical/peaceful song that genuinely fits the taste — emerging from numeric feature matching alone, not from any explicit rule.

---

## Summary

| Method | Coverage | Outcome |
| --- | --- | --- |
| Automated tests (pytest) | Scoring engine — sort order + explanations | 2/2 pass |
| Confidence scoring | All 6 profiles | High scores when genre fires; compresses without it |
| Logging + error handling | ElevenLabs, API key fallback, voice availability | 2 real bugs caught and fixed via logs |
| Human evaluation | 6 profiles (3 realistic, 3 adversarial) | 6/6 results matched expectations |
