# 🎧 Model Card: Music Recommender Simulation

## 1. Model Name  

Give your model a short, descriptive name.  
Example: **VibeFinder 1.0**  

---

## 2. Intended Use  

Describe what your recommender is designed to do and who it is for. 

Prompts:  

- What kind of recommendations does it generate  
- What assumptions does it make about the user  
- Is this for real users or classroom exploration  

---

## 3. How the Model Works  

Explain your scoring approach in simple language.  

Prompts:  

- What features of each song are used (genre, energy, mood, etc.)  
- What user preferences are considered  
- How does the model turn those into a score  
- What changes did you make from the starter logic  

Avoid code here. Pretend you are explaining the idea to a friend who does not program.

---

## 4. Data  

Describe the dataset the model uses.  

Prompts:  

- How many songs are in the catalog  
- What genres or moods are represented  
- Did you add or remove data  
- Are there parts of musical taste missing in the dataset  

---

## 5. Strengths  

Where does your system seem to work well  

Prompts:  

- User types for which it gives reasonable results  
- Any patterns you think your scoring captures correctly  
- Cases where the recommendations matched your intuition  

---

## 6. Limitations and Bias 

Single targets can't represent users who enjoy variety

The profile stores one number per feature. A user who loves both intense workout sessions and calm study sessions would set their energy target somewhere in the middle (say, 0.65) — which is actually the least characteristic value for them. The system then recommends mid-energy songs that don't fully satisfy either mood. Real recommenders handle this with multiple profiles, session context, or time-of-day signals. This one can't.

#### Other

1. Genre lock-in creates a 2-point ceiling for out-of-genre songs
2. Missing-genre users get a structurally lower maximum score
3. The energy gap is linear — it doesn't care about direction
4. Acousticness creates a hard acoustic/electronic wall
5. All features are scored independently and added together. System silently picks the least-bad options without flagging that the profile itself is contradictory.

## 7. Evaluation  

Six profiles were tested — three realistic listeners and three adversarial edge cases designed to stress-test the scoring logic.

### Profiles tested

| Profile | Genre | Mood | Energy |
| --- | --- | --- | --- |
| Chill Lofi Student | lofi | chill | 0.38 |
| High-Energy Pop Fan | pop | intense | 0.92 |
| Deep Intense Rock | rock | intense | 0.90 |
| Conflicted (high energy + melancholic mood) | metal | angry | 0.95 |
| Opera Fan (genre not in catalog) | opera | peaceful | 0.20 |
| The Average User (all targets at 0.5) | jazz | relaxed | 0.50 |

### Profile comparisons

**Chill Lofi vs. High-Energy Pop**
These are the clearest opposites in the set. Lofi shifts the list toward slow, acoustic, low-energy tracks (Library Rain at 8.78); pop shifts it toward fast, electronic, high-energy tracks (Gym Hero at 8.92). Both #1 results scored near-maximum because genre, mood, and multiple numeric features all aligned at once. The swap in recommendations is total — not a single song appears in both top-5 lists — which confirms that energy and acousticness together are doing most of the separating work.

**High-Energy Pop vs. Deep Intense Rock**
Both want high energy (0.92 vs. 0.90) and intense mood, so they share some overlap in numeric scores. The critical difference is genre: Gym Hero (pop) tops the pop list; Storm Runner (rock) tops the rock list. Gym Hero still appears at #2 for the rock profile because its energy and acousticness are nearly identical to rock songs — genre is the only thing holding it back. This reveals that high-energy genres cluster together, and the genre bonus is the main thing keeping their top-5 lists distinct.

**Conflicted (high energy + melancholic) vs. Deep Intense Rock**
Both want high energy, but the conflicted profile targets very low valence (0.15 — dark, sad-sounding) while the rock profile is more neutral (0.35). Ember and Ash (metal) wins the conflicted list because it's the only song combining high energy AND low valence. Interestingly, Gym Hero — a pop/intense song with very happy valence — still appears at #4 for the conflicted profile because energy and acousticness points outweigh the valence penalty. The system is not easily tricked: energy dominates, and the dark-mood preference only reshapes the lower rankings.

**Opera Fan vs. Chill Lofi Student**
Both want low energy and high acousticness, but the opera profile's genre ("opera") doesn't exist in the catalog, so the genre bonus never fires. Despite this, Moonlit Serenade (classical/peaceful) rises to #1 — not because of genre, but because its mood matches and its audio features (energy=0.18, acousticness=0.98) almost perfectly match the targets. The lofi student's list is anchored by two genre-match songs scoring 8.74–8.78; the opera fan's entire list scores 5.21–6.84. The gap shows exactly how much the missing genre bonus costs: roughly 2 points on the best result.

**Average User vs. all others**
This was the most revealing test. Setting every numeric target to 0.5 compressed the score range dramatically — #1 scored 7.83 but #2 dropped to 5.61, and the bottom three were separated by less than 0.5 points. With no strong numeric pull in any direction, the genre and mood bonuses became the entire ranking mechanism. Coffee Shop Stories (jazz/relaxed) won purely because it matched both categories. Any song without a genre or mood match was essentially shuffled at random. This exposes the system's core weakness: it needs at least one strong numeric preference to produce a meaningful ordering.

### What surprised me

The opera fan test produced the most unexpected result. I expected the system to fail badly without a genre match — returning irrelevant songs. Instead, it quietly fell back on numeric features and surfaced Moonlit Serenade, which genuinely sounds like what an opera fan might also enjoy: quiet, acoustic, and peaceful. The system found a reasonable answer through a completely different path than intended. That was not obvious from reading the code.

---

## 8. Future Work  

Ideas for how you would improve the model next.  

Prompts:  

- Additional features or preferences  
- Better ways to explain recommendations  
- Improving diversity among the top results  
- Handling more complex user tastes  

---

## 9. Personal Reflection  

A few sentences about your experience.  

Prompts:  

- What you learned about recommender systems  
- Something unexpected or interesting you discovered  
- How this changed the way you think about music recommendation apps  
