# Summer Camp Game Gallery

Storage stays by **group** (matching the student brief).
The public homepage shows an interactive **game-name cloud**: move or drag to rotate, click a title to play.
Search stays available from a small **Find** control, not in the main stage.

## Two layers

| Layer | Rule |
| --- | --- |
| Disk / teacher archive | `gallery/projects/group-01/` … `group-04/` |
| Public exhibition UI | Flat cards + search by game name; not sorted into group sections |

Students do not need to change their ZIPs. Their MD already asked Agents to keep relative paths so each project still runs after being placed under a `group-XX/` folder.

## Folder layout

```text
gallery/
├── index.html
├── projects.json
├── README.md
└── projects/
    ├── group-01/                 # official package from Group 01
    │   ├── exhibition/
    │   │   ├── index.html
    │   │   └── game.html
    │   ├── submission-manifest.json
    │   ├── preview.png
    │   └── ...
    ├── group-02/
    ├── group-03/
    └── group-04/
```

If one group submits more than one playable game, nest by title under that group:

```text
projects/group-03/
├── the-darkroom/
│   └── exhibition/...
└── another-game/
    └── exhibition/...
```

## Teacher intake steps

1. Download the official ZIP from the Tencent shared document.
2. Unzip and confirm `exhibition/index.html` opens through a local static server.
3. Place it under the matching group folder:
   - default: `gallery/projects/group-XX/`
   - multiple games from the same group: `gallery/projects/group-XX/<game-slug>/`
4. Add one entry per game to `projects.json` (paths must match the folder).
5. Refresh the Gallery homepage. Visitors find games by title, not by group.

## Day 1 batch (2026-07)

Student packages from `GameDesignFinal_Day1/` were ingested into flat folders:

```text
gallery/projects/<game-slug>/exhibition/...
```

- Spec packages: copied `exhibition/` (skipped trailer `.mp4`/`.mov`; kept in-game `assets/videos/`).
- Single-HTML games: wrapped with a thin home page + `game.html`.
- Re-run: `python3 gallery/intake_day1.py`

`projects.json` lists all playable titles for the name cloud (including Sailer Game under `group-04/`).

## Thursday batch (2026-07-23)

Student packages from `gamedesignfinal-thu/` were ingested the same way:

- Re-run: `python3 gallery/intake_thu.py`
- Report: `gallery/intake_thu_summary.json`
- Skipped non-static Next.js packages and one mistaken course-site ZIP (see summary JSON).


## `projects.json` entry schema

```json
{
  "id": "the-darkroom",
  "title": "The Darkroom",
  "titleZh": "暗房",
  "domain": "Photography / Exposure",
  "domainZh": "摄影 / 曝光",
  "summary": "Players learn to read light as terrain.",
  "summaryZh": "玩家学习把光线读成可行走的地形。",
  "group": "group-03",
  "team": "Group 03 · Boyan",
  "teamDisplay": "anonymous",
  "consent": "yes",
  "preview": "projects/group-03/preview.png",
  "entryPage": "projects/group-03/exhibition/index.html",
  "gamePage": "projects/group-03/exhibition/game.html",
  "featured": false
}
```

For a second game from the same group:

```json
{
  "id": "another-game",
  "title": "Another Game",
  "group": "group-03",
  "preview": "projects/group-03/another-game/preview.png",
  "entryPage": "projects/group-03/another-game/exhibition/index.html",
  "gamePage": "projects/group-03/another-game/exhibition/game.html",
  "consent": "yes"
}
```

### Consent rules

- `yes`: show title, optional team, and links
- `anonymous`: show title and links; hide real names
- `no`: keep files in the group folder for teaching, but do not list them in `projects.json`

## Local preview

From the camp root:

```bash
python3 -m http.server 4173
```

Open:

- Course site: `http://localhost:4173/index.html`
- Gallery: `http://localhost:4173/gallery/index.html`
