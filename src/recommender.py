import csv
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field

@dataclass
class Song:
    """
    Represents a song and its attributes.
    Required by tests/test_recommender.py
    """
    id: int
    title: str
    artist: str
    genre: str
    mood: str
    energy: float
    tempo_bpm: float
    valence: float
    danceability: float
    acousticness: float

@dataclass
class UserProfile:
    """
    Represents a user's taste preferences.
    Required by tests/test_recommender.py

    Core fields (required):
      favorite_genre  – single genre string, e.g. "lofi"
      favorite_mood   – single mood string, e.g. "chill"
      target_energy   – ideal energy level 0.0–1.0
      likes_acoustic  – legacy boolean; prefer target_acousticness for scoring

    Extended fields (optional, all have sensible defaults):
      target_valence       – how happy/positive the sound should feel (0=sad, 1=joyful)
      target_tempo         – preferred beats per minute
      target_danceability  – how beat-driven the song should feel 0.0–1.0
      target_acousticness  – preference for organic/acoustic sound 0.0–1.0
      feature_weights      – importance of each feature in the final score (must sum to 1.0)
    """
    # --- required (tests depend on these) ---
    favorite_genre: str
    favorite_mood: str
    target_energy: float
    likes_acoustic: bool

    # --- extended numeric targets ---
    target_valence: float = 0.65
    target_tempo: float = 100.0
    target_danceability: float = 0.65
    target_acousticness: float = 0.50

    # --- per-feature importance weights (must sum to 1.0) ---
    feature_weights: Dict[str, float] = field(default_factory=lambda: {
        "energy":       0.25,
        "tempo":        0.15,
        "valence":      0.15,
        "danceability": 0.10,
        "acousticness": 0.10,
        "genre":        0.15,
        "mood":         0.10,
    })


# ---------------------------------------------------------------------------
# ALGORITHM RECIPE  (maximum possible score: 9.0 points)
#
# Feature        | Type        | Max pts | Rule
# ---------------|-------------|---------|------------------------------
# Genre          | categorical |   2.0   | +2.0 for exact match
# Energy         | numeric     |   2.0   | 2.0 × (1 − |song − target|)
# Acousticness   | numeric     |   1.5   | 1.5 × (1 − |song − target|)
# Mood           | categorical |   1.0   | +1.0 for exact match
# Valence        | numeric     |   1.0   | 1.0 × (1 − |song − target|)
# Tempo          | numeric     |   1.0   | 1.0 × max(0, 1 − |diff| / 110)
# Danceability   | numeric     |   0.5   | 0.5 × (1 − |song − target|)
#
# Why these weights?
#   • Genre (2.0) is the strongest stylistic signal — lofi and metal are worlds
#     apart even when their energy levels happen to be similar.
#   • Energy (2.0 max) is the most important numeric feature: it directly
#     reflects how calm or intense a song feels to a listener.
#   • Acousticness (1.5 max) strongly separates organic genres (lofi, folk,
#     classical) from electronic ones (synthwave, electronic, metal).
#   • Mood (1.0) scores less than genre because mood labels are subjective
#     and inconsistent across catalogues.
#   • Valence (1.0) captures happy vs sad tone — useful for pop vs folk/soul.
#   • Tempo (1.0 max) is normalized over the catalog's BPM range (58–168 ≈ 110).
#     A song 110+ BPM away from the target earns 0 tempo points.
#   • Danceability (0.5 max) gets the least weight; it largely correlates with
#     energy and tempo, so it's mainly a tiebreaker.
#
# Diversity rule: after scoring, no more than 1 song per artist appears in
# the final top-k list. This prevents one prolific artist from dominating.
# ---------------------------------------------------------------------------

# Tempo normalization constant: max BPM span in the catalog (168 − 58 = 110)
_TEMPO_RANGE = 110.0


def load_songs(csv_path: str) -> List[Dict]:
    """Read songs.csv and return a list of dicts with typed numeric fields."""
    songs = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            songs.append({
                "id":           int(row["id"]),
                "title":        row["title"],
                "artist":       row["artist"],
                "genre":        row["genre"],
                "mood":         row["mood"],
                "energy":       float(row["energy"]),
                "tempo_bpm":    float(row["tempo_bpm"]),
                "valence":      float(row["valence"]),
                "danceability": float(row["danceability"]),
                "acousticness": float(row["acousticness"]),
            })
    return songs


def score_song(user_prefs: Dict, song: Dict) -> Tuple[float, List[str]]:
    """Score one song against user preferences; return (total_score, reason_strings)."""
    score = 0.0
    reasons = []

    # --- Categorical features (fixed bonus points) ---
    if song["genre"] == user_prefs.get("favorite_genre"):
        score += 2.0
        reasons.append(f"genre match '{song['genre']}' +2.00")

    if song["mood"] == user_prefs.get("favorite_mood"):
        score += 1.0
        reasons.append(f"mood match '{song['mood']}' +1.00")

    # --- Numeric features (closeness = 1 − |song_val − target|, scaled) ---

    # Energy: how intense or calm the song feels
    energy_pts = 2.0 * (1.0 - abs(song["energy"] - user_prefs.get("target_energy", 0.5)))
    score += energy_pts
    reasons.append(f"energy closeness +{energy_pts:.2f}")

    # Acousticness: organic/live vs electronic/produced
    acoustic_pts = 1.5 * (1.0 - abs(song["acousticness"] - user_prefs.get("target_acousticness", 0.5)))
    score += acoustic_pts
    reasons.append(f"acousticness closeness +{acoustic_pts:.2f}")

    # Valence: how happy or sad the song sounds
    valence_pts = 1.0 * (1.0 - abs(song["valence"] - user_prefs.get("target_valence", 0.5)))
    score += valence_pts
    reasons.append(f"valence closeness +{valence_pts:.2f}")

    # Tempo: normalized over the catalog's BPM span (58–168 BPM ≈ 110)
    tempo_diff = abs(song["tempo_bpm"] - user_prefs.get("target_tempo", 100.0))
    tempo_pts = 1.0 * max(0.0, 1.0 - tempo_diff / _TEMPO_RANGE)
    score += tempo_pts
    reasons.append(f"tempo closeness +{tempo_pts:.2f}")

    # Danceability: tiebreaker; correlates with energy so weighted lowest
    dance_pts = 0.5 * (1.0 - abs(song["danceability"] - user_prefs.get("target_danceability", 0.5)))
    score += dance_pts
    reasons.append(f"danceability closeness +{dance_pts:.2f}")

    return score, reasons


def recommend_songs(user_prefs: Dict, songs: List[Dict], k: int = 5) -> List[Tuple[Dict, float, str]]:
    """Score all songs, sort by score, apply per-artist diversity, return top-k as (song, score, explanation)."""
    # Step 1 & 2: score and sort
    scored = []
    for song in songs:
        score, reasons = score_song(user_prefs, song)
        # Surface the top 3 reasons as the explanation (most points first)
        reasons_by_value = sorted(reasons, key=lambda r: float(r.split("+")[-1]), reverse=True)
        explanation = "; ".join(reasons_by_value[:3])
        scored.append((song, score, explanation))

    scored.sort(key=lambda x: x[1], reverse=True)

    # Step 3: diversity filter — one song per artist.
    # Only applies when there are enough distinct artists to fill the list;
    # otherwise we just take the top-k without artist restriction.
    unique_artists = {s["artist"] for s in songs}
    if len(unique_artists) >= k:
        seen_artists: set = set()
        results = []
        for song, score, explanation in scored:
            if song["artist"] not in seen_artists:
                results.append((song, score, explanation))
                seen_artists.add(song["artist"])
            if len(results) == k:
                break
    else:
        results = [(song, score, explanation) for song, score, explanation in scored[:k]]

    return results


# ---------------------------------------------------------------------------
# OOP interface (required by tests/test_recommender.py)
# ---------------------------------------------------------------------------

def _profile_to_dict(user: "UserProfile") -> Dict:
    """Convert a UserProfile dataclass to the dict format score_song() expects."""
    return {
        "favorite_genre":      user.favorite_genre,
        "favorite_mood":       user.favorite_mood,
        "target_energy":       user.target_energy,
        "target_acousticness": user.target_acousticness,
        "target_valence":      user.target_valence,
        "target_tempo":        user.target_tempo,
        "target_danceability": user.target_danceability,
    }


def _song_to_dict(song: Song) -> Dict:
    """Convert a Song dataclass to the dict format score_song() expects."""
    return {
        "genre":        song.genre,
        "mood":         song.mood,
        "energy":       song.energy,
        "tempo_bpm":    song.tempo_bpm,
        "valence":      song.valence,
        "danceability": song.danceability,
        "acousticness": song.acousticness,
    }


class Recommender:
    """
    OOP implementation of the recommendation logic.
    Required by tests/test_recommender.py
    """
    def __init__(self, songs: List[Song]):
        self.songs = songs

    def recommend(self, user: UserProfile, k: int = 5) -> List[Song]:
        user_dict = _profile_to_dict(user)
        scored = [(song, score_song(user_dict, _song_to_dict(song))[0]) for song in self.songs]
        scored.sort(key=lambda x: x[1], reverse=True)

        # Diversity: one song per artist — only when enough distinct artists exist
        unique_artists = {s.artist for s in self.songs}
        if len(unique_artists) >= k:
            seen_artists: set = set()
            results = []
            for song, _ in scored:
                if song.artist not in seen_artists:
                    results.append(song)
                    seen_artists.add(song.artist)
                if len(results) == k:
                    break
        else:
            results = [song for song, _ in scored[:k]]
        return results

    def explain_recommendation(self, user: UserProfile, song: Song) -> str:
        _, reasons = score_song(_profile_to_dict(user), _song_to_dict(song))
        return "; ".join(reasons)
