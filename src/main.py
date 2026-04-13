"""
Command line runner for the Music Recommender Simulation.

Run with:  python -m src.main

Defines six user profiles — three realistic and three adversarial/edge-case —
and prints Top 5 recommendations for each.
"""

from src.recommender import load_songs, recommend_songs


# ---------------------------------------------------------------------------
# PROFILES
# ---------------------------------------------------------------------------

# --- 1. Realistic: Late-night study session --------------------------------
# Wants slow, organic, mildly positive lofi.  Strong acoustic preference.
CHILL_LOFI = {
    "name":                "Chill Lofi Student",
    "favorite_genre":      "lofi",
    "favorite_mood":       "chill",
    "target_energy":       0.38,
    "target_valence":      0.60,
    "target_tempo":        76,
    "target_danceability": 0.58,
    "target_acousticness": 0.78,
}

# --- 2. Realistic: Pre-workout pump-up -------------------------------------
# High energy, fast tempo, very danceable pop.  Acoustic sound is unwanted.
HIGH_ENERGY_POP = {
    "name":                "High-Energy Pop Fan",
    "favorite_genre":      "pop",
    "favorite_mood":       "intense",
    "target_energy":       0.92,
    "target_valence":      0.80,
    "target_tempo":        130,
    "target_danceability": 0.90,
    "target_acousticness": 0.05,
}

# --- 3. Realistic: Late-night brooding rock --------------------------------
# Wants loud, fast, dark-feeling rock.  Low valence (moody/angry tone).
DEEP_ROCK = {
    "name":                "Deep Intense Rock",
    "favorite_genre":      "rock",
    "favorite_mood":       "intense",
    "target_energy":       0.90,
    "target_valence":      0.35,
    "target_tempo":        150,
    "target_danceability": 0.60,
    "target_acousticness": 0.10,
}

# --- 4. Adversarial: Contradictory energy vs mood -------------------------
# "I want moody/sad vibes (low valence) but at extremely high energy."
# Real examples: angry metal, intense workout music with dark lyrics.
# Expected behavior: high-energy songs win even though their mood won't match.
# Potential surprise: "Gym Hero" (pop/intense, energy=0.93) could rank high
# despite having happy valence — the energy and tempo match overpowers the
# valence mismatch.
CONFLICTING_ENERGY_MOOD = {
    "name":                "Conflicted (high energy + melancholic mood)",
    "favorite_genre":      "metal",
    "favorite_mood":       "angry",
    "target_energy":       0.95,
    "target_valence":      0.15,   # wants very sad/dark tone
    "target_tempo":        160,
    "target_danceability": 0.55,
    "target_acousticness": 0.05,
}

# --- 5. Adversarial: Genre that doesn't exist in the catalog --------------
# "classical/peaceful" is in the catalog, but "opera" is not.
# Expected behavior: genre bonus never fires (+0.0 for every song), so the
# system falls back entirely on numeric features.  The quietest, slowest,
# most acoustic songs will win regardless of their genre label.
MISSING_GENRE = {
    "name":                "Opera Fan (genre not in catalog)",
    "favorite_genre":      "opera",     # zero songs match this
    "favorite_mood":       "peaceful",
    "target_energy":       0.20,
    "target_valence":      0.70,
    "target_tempo":        65,
    "target_danceability": 0.30,
    "target_acousticness": 0.95,
}

# --- 6. Adversarial: All targets at dead-center 0.5 ----------------------
# Every numeric target is the midpoint of the 0–1 scale.
# Expected behavior: every song gets nearly identical numeric scores;
# the only differentiator becomes genre/mood match.  Exposes whether
# categorical bonuses alone are enough to produce a meaningful ranking,
# or whether everything collapses to near-ties.
AVERAGE_USER = {
    "name":                "The Average User (all targets at midpoint)",
    "favorite_genre":      "jazz",
    "favorite_mood":       "relaxed",
    "target_energy":       0.50,
    "target_valence":      0.50,
    "target_tempo":        100,
    "target_danceability": 0.50,
    "target_acousticness": 0.50,
}

ALL_PROFILES = [
    CHILL_LOFI,
    HIGH_ENERGY_POP,
    DEEP_ROCK,
    CONFLICTING_ENERGY_MOOD,
    MISSING_GENRE,
    AVERAGE_USER,
]


# ---------------------------------------------------------------------------
# OUTPUT HELPER
# ---------------------------------------------------------------------------

def print_recommendations(profile: dict, recommendations: list) -> None:
    print()
    print("=" * 56)
    print(f"  {profile['name']}")
    print(f"  Genre: {profile['favorite_genre']}  |  Mood: {profile['favorite_mood']}"
          f"  |  Energy: {profile['target_energy']}")
    print("=" * 56)
    for rank, (song, score, explanation) in enumerate(recommendations, start=1):
        print()
        print(f"  #{rank}  {song['title']}  —  {song['artist']}")
        print(f"       Genre: {song['genre']}  |  Mood: {song['mood']}"
              f"  |  Score: {score:.2f} / 9.00")
        for reason in explanation.split("; "):
            print(f"       • {reason}")
    print()


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main() -> None:
    songs = load_songs("data/songs.csv")

    for profile in ALL_PROFILES:
        recs = recommend_songs(profile, songs, k=5)
        print_recommendations(profile, recs)


if __name__ == "__main__":
    main()
