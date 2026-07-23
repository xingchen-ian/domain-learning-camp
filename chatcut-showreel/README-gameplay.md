# Showreel · Gameplay rebuild (2026-07-23)

## What changed
- Day1 + Thursday trailers rescanned for **high-motion gameplay** (skip early menu / project-site UI).
- Mild center crop to reduce browser chrome.
- **61 × 5s** clips at 720p → `clips-5s/`
- **61 × 12s** proxies for ChatCut trim → `proxies-gameplay/`
- Combined montage → `local-showreel-gameplay.mp4` (~5:04) copied to `summary/media/showreel.mp4`

## Rebuild
```bash
cd chatcut-showreel
.venv/bin/python build_gameplay_proxies.py
```

## ChatCut
Project: [Interior Lavender Heron](https://app.chatcut.io/zh/editor/a0046609-3c80-47aa-a5c4-ff0201136029)

1. Upload `clips-5s/` (or `proxies-gameplay/`) into the project media pool.
2. Paste `PROMPT-gameplay.txt` and rebuild: opening MG → 61 hard cuts → closing MG + BGM.
3. If MCP upload helper is unavailable, use the browser upload link from `import_media`.

## Note
Per-game name cards still need ChatCut lower-thirds (local concat is picture-only).
