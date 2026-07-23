# How to Skateboarding — Game Package

## Quick Start

### Option 1: Python (recommended)

1. Make sure Python 3 is installed (https://www.python.org/downloads/)
2. Open a terminal in this folder
3. Run:
   ```
   python serve.py
   ```
4. Open your browser and go to: **http://localhost:8080**

### Option 2: Any HTTP server

Use any static file server you like (Node `http-server`, VS Code Live Server, etc.) and serve this directory.

### Option 3: Just open the file

Double-click `index.html` to open it directly in a browser. Some browsers may restrict local file loading, so using a server is recommended.

---

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Home page |
| `game.html` | Skateboarding game (main) |
| `process.html` | Design process page |

## Controls

- **↑ / ↓**: Adjust speed / core
- **1 / 2 / 3**: Pick level
- **Space**: Start / restart
- **N**: Next level
- **ESC**: Change level
- **Mouse**: Move up/down to control core during play; drag slider on start screen
- **H / I**: Show instructions (from start screen)

## Files

```
exhibition/
├── index.html
├── game.html
├── process.html
├── serve.py            # Python HTTP server (port 8080)
├── README.md
└── assets/
    ├── css/style.css
    └── js/game.js       # Game logic
```
