# 🎵 Music Recommender Simulation

## Project Summary

In this project you will build and explain a small music recommender system.

Your goal is to:

- Represent songs and a user "taste profile" as data
- Design a scoring rule that turns that data into recommendations
- Evaluate what your system gets right and wrong
- Reflect on how this mirrors real world AI recommenders

Replace this paragraph with your own summary of what your version does.

---

## How The System Works

The system works like a friend who knows your taste in music. You tell them what kind of songs you like, and they go through a catalog to find the ones that match your vibe as closely as possible.

### What each Song knows about itself

Every song in the catalog carries two types of information:

- *Audio feel*: energy (how intense or calm), valence (how happy or sad it sounds), danceability, tempo (speed in beats per minute), and acousticness (how organic vs. electronic it sounds)
- *Labels*: genre (e.g., pop, lofi, rock), mood (e.g., happy, chill, intense), artist, and title

### What the User Profile stores

The user profile is a snapshot of your taste:

- Your preferred level for each audio feature — for example, “I like high-energy, happy-sounding, very danceable songs”
- Your preferred genres and moods (e.g., pop and lofi; happy and chill)
- How much each feature matters to you (so genre can count more than tempo if you care more about style than speed)

### How a song gets scored

For each song, the system asks: *how close is this song to what the user wants?*

1. For each audio feature (energy, valence, etc.), it measures how far the song's value is from the user's preference — closer = higher score for that feature
2. It then adds bonus points if the genre matches, and a smaller bonus if the mood matches
3. All the individual scores are combined into one final number using the importance weights the user set

Genre counts more than mood by default, because genre tends to reflect a consistent style, while mood labels can be more subjective.

### How the final recommendations are chosen

1. Every song in the catalog gets a score
2. Songs are sorted from highest to lowest score
3. A diversity check runs: if two top songs are by the same artist, the second one is bumped down slightly so the list feels more varied
4. The top 5 songs after that check become the recommendations

### Simple flow

```text
User Profile → score each song → sort by score → diversity check → Top 5 recommendations
```

---

## Getting Started

### Setup

1. Create a virtual environment (optional but recommended):

   ```bash
   python -m venv .venv
   source .venv/bin/activate      # Mac or Linux
   .venv\Scripts\activate         # Windows

2. Install dependencies

```bash
pip install -r requirements.txt
```

3. Run the app:

```bash
python -m src.main
```

### Running Tests

Run the starter tests with:

```bash
pytest
```

You can add more tests in `tests/test_recommender.py`.

---

## Experiments You Tried

Use this section to document the experiments you ran. For example:

- What happened when you changed the weight on genre from 2.0 to 0.5
- What happened when you added tempo or valence to the score
- How did your system behave for different types of users

---

## Limitations and Risks

Summarize some limitations of your recommender.

Examples:

- It only works on a tiny catalog
- It does not understand lyrics or language
- It might over favor one genre or mood

You will go deeper on this in your model card.

---

## Reflection

Read and complete `model_card.md`:

[**Model Card**](model_card.md)

Write 1 to 2 paragraphs here about what you learned:

- about how recommenders turn data into predictions
- about where bias or unfairness could show up in systems like this


---

## 7. `model_card_template.md`

Combines reflection and model card framing from the Module 3 guidance. :contentReference[oaicite:2]{index=2}  

```markdown
# 🎧 Model Card - Music Recommender Simulation

## 1. Model Name

Give your recommender a name, for example:

> VibeFinder 1.0

---

## 2. Intended Use

- What is this system trying to do
- Who is it for

Example:

> This model suggests 3 to 5 songs from a small catalog based on a user's preferred genre, mood, and energy level. It is for classroom exploration only, not for real users.

---

## 3. How It Works (Short Explanation)

Describe your scoring logic in plain language.

- What features of each song does it consider
- What information about the user does it use
- How does it turn those into a number

Try to avoid code in this section, treat it like an explanation to a non programmer.

---

## 4. Data

Describe your dataset.

- How many songs are in `data/songs.csv`
- Did you add or remove any songs
- What kinds of genres or moods are represented
- Whose taste does this data mostly reflect

---

## 5. Strengths

Where does your recommender work well

You can think about:
- Situations where the top results "felt right"
- Particular user profiles it served well
- Simplicity or transparency benefits

---

## 6. Limitations and Bias

Where does your recommender struggle

Some prompts:
- Does it ignore some genres or moods
- Does it treat all users as if they have the same taste shape
- Is it biased toward high energy or one genre by default
- How could this be unfair if used in a real product

---

## 7. Evaluation

How did you check your system

Examples:
- You tried multiple user profiles and wrote down whether the results matched your expectations
- You compared your simulation to what a real app like Spotify or YouTube tends to recommend
- You wrote tests for your scoring logic

You do not need a numeric metric, but if you used one, explain what it measures.

---

## 8. Future Work

If you had more time, how would you improve this recommender

Examples:

- Add support for multiple users and "group vibe" recommendations
- Balance diversity of songs instead of always picking the closest match
- Use more features, like tempo ranges or lyric themes

---

## 9. Personal Reflection

A few sentences about what you learned:

- What surprised you about how your system behaved
- How did building this change how you think about real music recommenders
- Where do you think human judgment still matters, even if the model seems "smart"

