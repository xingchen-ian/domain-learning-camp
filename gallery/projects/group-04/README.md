# Sailer Game

> A small browser game about the most counter-intuitive part of sailing: the boat does not go where you point it. It goes where the wind lets it go.

- **Student / Team:** Xiao
- **Domain:** Sailer Game
- **Project title:** Sailer Game
- **AI agent:** WorkBuddy
- **Year:** 2026 (IMA Summer Program)
- **Dependency track:** **Track A — no build step** (plain HTML + CSS + Canvas 2D + vanilla JavaScript)

---

## 1. What this project is

A top-down sailing game for the browser. The player controls a small sailboat and has to reach a floating buoy. Three levels of increasing difficulty teach the core idea: **reading the wind matters more than pointing the boat.**

```
Read the wind  →  choose boat angle  →  trim the sail  →  pick a route  →  reach the buoy
```

---

## 2. How to run

The game is a static website. No `npm install`, no Node.js, no internet.

### Easiest — open in a browser
You can double-click `exhibition/index.html` in some browsers, but Web Audio and Canvas work most reliably when served over HTTP. Use the static server below.

### Local static server (recommended)

From the project root, run any one of:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if you have it)
npx serve .
```

Then open <http://localhost:8000/exhibition/> (or <http://localhost:8000/source/>) in any modern desktop browser.

> The final exhibition build lives in `exhibition/`. It is the version that will be put on the iMac and the class Gallery. `source/` is the editable development source. For Track A the two are identical.

---

## 3. Controls

| Key            | Action                       |
|----------------|------------------------------|
| <kbd>A</kbd>   | Turn boat left               |
| <kbd>D</kbd>   | Turn boat right              |
| <kbd>W</kbd>   | Trim the sail out            |
| <kbd>S</kbd>   | Trim the sail in             |
| <kbd>R</kbd>   | Restart current level        |
| <kbd>N</kbd>   | Next level (after winning)   |

---

## 4. What is on screen (the exposed data)

The right-hand HUD always shows:

- **Wind direction** and **wind strength**
- **Water current direction** and **current speed**
- **Rocks on the field**
- **Game time** (counting down on Levels 2 & 3)
- **Boat health**, **heading**, **sail angle**, **speed**

The play area also draws a big **wind arrow** (top-left) and a small **boat compass** (bottom-left) so the player can read the situation at a glance.

---

## 5. The three challenge presets

| Level | Wind            | Current | Rocks | Time limit | What it teaches                                |
|-------|-----------------|---------|-------|------------|------------------------------------------------|
| 1     | Crosswind       | None    | 0     | —          | Boat does not go where you point.              |
| 2     | Headwind        | None    | 0     | 70 s       | You cannot sail straight at the target. Tack.  |
| 3     | Crosswind       | None    | 6     | 110 s      | Route planning under time pressure.            |

Each preset changes **system variables**, not just visuals, as required by the brief.

---

## 6. Project structure

```
.
├── exhibition/                  # Final static website (Gallery + iMac)
│   ├── index.html               # Home
│   ├── knowledge.html           # Domain knowledge + system design
│   ├── process.html             # Development process
│   ├── game.html                # Playable game
│   └── assets/
│       ├── style.css
│       ├── game.js
│       └── system-graph.png
├── source/                      # Editable development source (Track A: same as exhibition)
│   ├── index.html
│   ├── game.html
│   ├── knowledge.html
│   ├── process.html
│   └── assets/
│       ├── style.css
│       ├── game.js
│       └── system-graph.png
├── agent-development-log.md     # Chronological human-AI development log
├── development-brief.md         # (this README cross-references the brief)
├── system-graph.png             # Exported game system graph (by Ian)
├── README.md                    # This file
└── THIRD_PARTY.md               # Third-party libraries (none for Track A)
```

---

## 7. How the game works (for curious students / teachers)

The full physics is in `source/assets/game.js` (≈ 350 lines, well commented). The short version:

1. The wind has a direction and a strength (level-defined).
2. The boat has a heading and a sail angle (player-controlled).
3. The angle of the wind relative to the boat, `R`, drives everything.
4. If the boat is pointing too close to the wind (`|R| < 36°`), it is in the **no-go zone** and produces no thrust. The sail flaps and the player must turn away.
5. Otherwise, thrust = `MAX_SPEED · sin(|R|) · sailEfficiency · windStrength`, where `sailEfficiency = |sin(sailAngle − R)|` is highest when the sail is perpendicular to the wind.
6. The boat accelerates toward its heading, with a small drag, plus any water current.
7. Hitting a rock costs 18 health and bounces the boat. Health at 0 → lose.
8. Reaching the target with health &gt; 0 and time &gt; 0 → win.

The same code path is used for all three levels — only the level variables change.

---

## 8. Audio

All sound is generated at runtime with the **Web Audio API** (no external audio files):

- A soft **sail-flap** flutter that gets louder when the sail is in an inefficient angle or the boat is in the no-go zone.
- A low **wake** hum that gets louder as the boat speeds up.

The audio context is created on the first click of a level button, to satisfy browser autoplay rules. If the browser blocks audio, the game still plays — there is just no sound.

---

## 9. Submission and exhibition

When the project is ready to be packaged, follow the brief's "Submission and Exhibition Packaging" section:

- `exhibition/` is the final deliverable. It has been tested on a local static server.
- The final archive should be named `2026-Camp-Group-04-SailerGame.zip` (adjust group number as needed) and contain the project files at the top level so the teacher can drop it into `gallery/projects/group-04/` and open `exhibition/index.html` directly.
- `submission-manifest.json` and `preview.png` will be added at the end of Session 3.

---

## 10. Development log

The full human-AI development log is in [`agent-development-log.md`](./agent-development-log.md). It includes raw interaction entries and stage reflection prompts at every meaningful milestone.
