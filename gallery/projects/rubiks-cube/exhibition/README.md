# 3x3 Rubik's Cube — IMA Summer Program

A learning game that takes the player from random turns to recognizing
patterns and choosing the correct algorithm. Built around a real
3D Rubik's Cube rendered with a locally vendored `three.js`.

## Project info

- **Student / Team:** Kimi Xu
- **Project Title:** 3x3 Rubik's Cube
- **Domain:** Rubik's Cube
- **AI Agent:** WorkBuddy
- **Dependency Track:** Track B — locally vendored library (no build step)

## Layout

```text
project/
├── exhibition/               # Final static website (the deliverable)
│   ├── index.html             # Landing page with game idea / domain / system
│   ├── game.html              # Playable game
│   ├── process.html           # Development process timeline
│   ├── assets/
│   │   ├── css/style.css
│   │   ├── js/game.js
│   │   └── vendor/three.module.min.js
│   ├── README.md              # this file
│   └── THIRD_PARTY.md
├── source/                    # Editable development source (mirrors exhibition/)
├── agent-development-log.md   # Chronological human-AI development record
├── development-brief.md       # The original IMA design brief
└── system-graph.png           # IMA Summer Program system graph
```

## How to run

The exhibition folder is a self-contained static website.  No build
step, no `npm install`, no internet access required.

```bash
cd exhibition
python -m http.server 8080
# open http://localhost:8080 in a browser
```

Any static HTTP server works (`npx http-server`, `nginx`, the school's
internal server, etc.).  Opening `game.html` directly via `file://` will
not work because the JavaScript uses ES modules which require an HTTP
origin.

## How to play

| Input | Effect |
| --- | --- |
| Click a face on the cube | Select that face |
| Click again / press `→` | Turn the selected face 90° CW |
| Press `←` | Turn the selected face 90° CCW |
| `R` / `L` / `U` / `D` / `F` / `B` | Select that face (or turn it if already selected) |
| `Shift` + face key | Turn the face counter-clockwise |
| `Esc` | Deselect the face |
| Drag the stage | Rotate the camera around the cube |
| Scroll wheel | Zoom in / out |
| `🎲 Shuffle` | Apply 8 random moves on top of the current state |
| `↶ Undo` | Reverse the last move |
| `↷ Redo` | Replay the last undone move |
| `Give Up` | End the current attempt and show the summary |
| `↻ Restart` | Reset the cube and reshuffle (20 random moves) |

## Three difficulty levels

- **Level 1 — Full Algorithms.**  Shows the current solving stage
  (cross / F2L / OLL / PLL) with a brief explanation and the standard
  algorithm you can apply.
- **Level 2 — Brief Hints.**  Shows the same stage name and a brief
  explanation, but no algorithm.
- **Level 3 — No Hints + Countdown.**  Hides the hint card and starts a
  5-minute countdown.  If time runs out, the attempt is over.

## Exposed data on screen

- **Time used** — live timer; in Level 3 it shows the remaining time.
- **Percent solved** — fraction of stickers that are on their correct
  face (0–100%).
- **Moves made** — count of user moves, ignoring scramble moves.
- **Difficulty** — current level and the hint mode.

## Win / lose

- **Win:** all six faces have a uniform color.  Timer stops, summary
  modal appears with final time, move count, and level.
- **Give Up / Time Up:** the current attempt is ended and the summary
  is shown.  Press `Play Again` to start a fresh scramble.

## Tech notes

- **three.js 0.160.0** is vendored at
  `exhibition/assets/vendor/three.module.min.js`.  No CDN, no build
  step, no internet required at runtime.
- The cube is built from 27 mini-cubes (the inner cube is kept to keep
  the scene graph uniform but is hidden by the outer 26).  Each
  mini-cube carries its own 6 sticker materials.
- Face turns are implemented via a temporary pivot `Object3D` that the
  9 affected mini-cubes are attached to, animated, and then detached.
  This is the standard Three.js pattern for Rubik's-cube-style scenes.
- A custom orbit camera handles drag-to-rotate and scroll-to-zoom.
  `OrbitControls` was not vendored at the pinned version, so the small
  amount of camera code is in `game.js` directly.
- All assets (CSS, JS, three.js) live under `exhibition/assets/` so the
  project works from a nested gallery path like
  `gallery/projects/group-01/exhibition/`.

## Browser support

Tested on modern Chrome, Edge, and Firefox at 1920×1080.  Requires
WebGL 2 and ES module support.  Mobile browsers work in portrait but
the layout is optimized for laptop / desktop exhibition.
