# A Skating Novice — Exhibition Site

A static web project (HTML/CSS/JS + Canvas 2D, zero external dependencies, works offline).

## How to run

This site **must be served via HTTP** — opening `index.html` directly with `file://` will not work (browser blocks canvas/audio features).

Pick any one of these from inside the `exhibition/` folder:

### Option A — Python (already installed on most machines)
```bash
python -m http.server 8090
```
Then open http://localhost:8090/ in your browser.

### Option B — Node.js
```bash
npx serve .
```

### Option C — VS Code
Install the "Live Server" extension, right-click `index.html` → "Open with Live Server".

## Contents
- `index.html` — project introduction page
- `game.html` — the playable skating game
- `process.html` — development timeline
- `assets/css/style.css` — shared styles
- `assets/js/game.js` — game engine
- `assets/system-graph.png` — diagram

## Controls (in game)
- `↑` / `↓` (or slider) — adjust Knee Bend Angle
- `←` / `→` — steer left / right
- `,` / `.` (or `<` / `>`) — slow down / speed up
- `R` — retry after a fall
- `Space` — start / pause

Sihan Lyu / Group 4 — Built with WorkBuddy
