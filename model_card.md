# 🎧 Model Card: Music Recommender Simulation

## 1. Model Name  

What You Are(WYA)
---

## 2. Intended Use  

Describe what your recommender is designed to do and who it is for. 

Prompts:  

- What kind of recommendations does it generate  
- What assumptions does it make about the user  
- Is this for real users or classroom exploration  

---
So this app is intended to help people look for songs that would relate or encompass what they'd like in music we have a variety of songs here and depending on what their profile is like we will recommend the most compatible songs for you 
## 3. How the Model Works  

Every song in the catalog gets a score out of 9 points based on how well it matches what the user told us they like. The system looks at seven things about each song: its genre, its mood, how energetic it sounds, how acoustic or electronic it feels, how happy or sad the tone is, its tempo in beats per minute, and how danceable it is. For each of those, it checks how close the song is to the user's preferred value. 
Genre and mood work differently: they're worth fixed bonus points (2 points for a genre match, 1 for mood) because those labels reflect a whole style and not just a number. Once all seven scores are added up, every song in the catalog has a total, they're sorted highest to lowest, and a diversity check removes duplicate artists before the top 5 are returned. Each feature has a different weight based on how much it actually matters to the listening experience and builds a plain-English explanation for every recommendation so you can see exactly why each song was chosen.

## 4. Data  

The catalog contains 18 songs stored in `data/songs.csv`.

**Genres represented:** pop, lofi, rock, ambient, jazz, synthwave, indie pop, r&b, electronic, folk, hip-hop, metal, classical, latin, soul

**Moods represented:** happy, chill, intense, relaxed, moody, focused, romantic, energetic, melancholic, confident, angry, peaceful, uplifting, nostalgic

**What was added:** The 8 new songs were chosen to fill gaps. Each new song also introduced a mood not previously present.

**What is still missing:** The catalog reflects a narrow slice of global music taste. There is no K-pop, reggae, country, blues, or any non-Western genre. All songs are in English (implied). Moods like "bittersweet," "tense," or "dreamy" are absent. The data was also created synthetically so the numeric values were not measured from actual audio, so they may not reflect how these songs truly sound. 

---

## 5. Strengths  

The system works best for listeners with a clear, consistent taste. For these users, multiple features point in the same direction at once, so the top results score very high and feel obviously right. The scoring also does a good job separating genres that are acoustically very different: lofi and metal will almost never share a top-5 list because their energy, acousticness, and tempo values are worlds apart. The genre and mood bonuses add a useful anchor so that similar songs rise above technically close but tonally wrong ones. Finally, the plain-English explanation attached to every recommendation makes the system transparent: you can always see exactly why a song was chosen, which is something most real recommenders don't offer.

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

Six profiles were tested which were three realistic listeners and three adversarial edge cases designed to stress-test the scoring logic.

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

**Chill Lofi Student vs. High-Energy Pop**
These are the clearest opposites in the set. Lofi shifts the list toward slow, acoustic, low-energy tracks while  pop shifts it toward fast, electronic, high-energy tracks.

**High-Energy Pop vs. Deep Intense Rock**
Both want high energy (0.92 vs. 0.90) and intense mood, so they share some overlap in numeric scores. The critical difference is genre: Gym Hero (pop) tops the pop list; Storm Runner (rock) tops the rock list. 

**Conflicted (high energy + melancholic) vs. Deep Intense Rock**
Both want high energy, but the conflicted profile targets very low valence (0.15 — dark, sad-sounding) while the rock profile is more neutral (0.35). Ember and Ash (metal) wins the conflicted list because it's the only song combining high energy AND low valence.

**Opera Fan vs. Chill Lofi Student**
Both want low energy and high acousticness, but the opera profile's genre ("opera") doesn't exist in the catalog, so the genre bonus never fires. Despite this, Moonlit Serenade (classical/peaceful) rises to #1 — not because of genre, but because its mood matches and its audio features almost perfectly match the targets. 

**Average User vs. all others**
Setting every numeric target to 0.5 compressed the score range dramatically. With no strong numeric pull in any direction, the genre and mood bonuses became the entire ranking mechanism. Coffee Shop Stories (jazz/relaxed) won purely because it matched both categories. Any song without a genre or mood match was essentially shuffled at random. This exposes the system's core weakness: it needs at least one strong numeric preference to produce a meaningful ordering.

### What surprised me

The opera fan test produced the most unexpected result. I expected the system to fail badly without a genre match. Instead, it quietly fell back on numeric features and surfaced Moonlit Serenade, which genuinely sounds like what an opera fan might also enjoy. That was not obvious from reading the code.

---

## 8. Future Work  

So some of the best ways that I can improve this product would be to have multiple profiles for one person so that way depending on the time of day and what you're doing they will get songs recommended for that moment instead of a just a general recommendation a second option would be to add more songs so that there can be more variety within the data set or maybe using API to get songs already created and then I don't have to host the data within this project 

## 9. Personal Reflection  

A few sentences about your experience.  

Prompts:  

- What you learned about recommender systems  
- Something unexpected or interesting you discovered  
- How this changed the way you think about music recommendation apps  
