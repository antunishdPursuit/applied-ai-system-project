"""
Command line runner for the Music Recommender Simulation.

This file helps you quickly run and test your recommender.

You will implement the functions in recommender.py:
- load_songs
- score_song
- recommend_songs
"""

from src.recommender import load_songs, recommend_songs


def main() -> None:
    songs = load_songs("data/songs.csv")

    # -------------------------------------------------------------------------
    # TASTE PROFILE — "Late-night study session" listener
    #
    # This person listens while studying: they want calm, organic-sounding music
    # with a slow tempo and slightly positive (but not euphoric) feeling.
    # They strongly prefer lofi and ambient over pop or rock.
    # -------------------------------------------------------------------------
    user_prefs = {
        # Categorical preferences
        "favorite_genre":      "lofi",
        "favorite_mood":       "chill",

        # Numeric targets — each mirrors a Song feature (0.0–1.0 unless noted)
        "target_energy":       0.38,   # low intensity; not sleepy, not wired
        "target_valence":      0.60,   # mildly positive, not euphoric
        "target_tempo":        76,     # slow BPM; roughly a relaxed walking pace
        "target_danceability": 0.58,   # gentle groove, not a dance floor track
        "target_acousticness": 0.78,   # strong preference for organic/acoustic sound

        # How much each feature counts in the final score (must sum to 1.0).
        # Energy and acousticness are weighted highest because they most strongly
        # define the "chill study" vibe; genre adds a categorical anchor.
        "feature_weights": {
            "energy":       0.25,
            "acousticness": 0.20,
            "tempo":        0.15,
            "genre":        0.15,
            "valence":      0.12,
            "danceability": 0.08,
            "mood":         0.05,
        },
    }

    # -------------------------------------------------------------------------
    # PROFILE CRITIQUE
    #
    # Q: Can this profile tell "intense rock" apart from "chill lofi"?
    #
    # YES — clearly, on three independent axes:
    #   • Energy gap:       target=0.38 vs rock(0.91)/lofi(0.40) → rock is ~0.53 away, lofi ~0.02
    #   • Acousticness gap: target=0.78 vs rock(0.10)/lofi(0.71–0.86) → rock is ~0.68 away, lofi ~0.07
    #   • Tempo gap:        target=76 BPM vs rock(152)/lofi(72–80) → rock is ~76 BPM away, lofi ~4 BPM
    #
    # Each axis alone would separate them; all three together make it decisive.
    #
    # WHERE THE PROFILE IS STILL NARROW:
    #   1. Single genre/mood strings — a user who equally enjoys lofi AND ambient
    #      gets no credit for ambient matches. Fix: use a list or weight dict.
    #   2. Valence is a weak differentiator here — lofi(0.56–0.60) and
    #      rock(0.48) are close enough that valence alone would not separate them.
    #      It is useful for happy-pop vs sad-folk, but not for this pair.
    #   3. No "dealbreaker" logic — metal (energy=0.97) still gets a non-zero
    #      score. A hard genre-exclusion list would prevent bad recommendations
    #      from ever surfacing.
    #   4. All songs are scored, even ones in totally foreign genres. With only
    #      18 songs this is fine; at Spotify scale you'd pre-filter first.
    # -------------------------------------------------------------------------

    recommendations = recommend_songs(user_prefs, songs, k=5)

    # ── Header ───────────────────────────────────────────────────────────────
    print()
    print("=" * 52)
    print("  Music Recommender — Top 5 Picks")
    print(f"  Profile: {user_prefs['favorite_genre'].upper()} / "
          f"{user_prefs['favorite_mood']} / "
          f"energy {user_prefs['target_energy']}")
    print("=" * 52)

    # ── Results ──────────────────────────────────────────────────────────────
    for rank, (song, score, explanation) in enumerate(recommendations, start=1):
        print()
        print(f"  #{rank}  {song['title']}  —  {song['artist']}")
        print(f"       Genre: {song['genre']}  |  Mood: {song['mood']}  "
              f"|  Score: {score:.2f} / 9.00")
        for reason in explanation.split("; "):
            print(f"       • {reason}")

    print()
    print("=" * 52)


if __name__ == "__main__":
    main()
