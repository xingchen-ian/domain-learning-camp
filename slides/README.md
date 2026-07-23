# Summer Camp Summary Slides

Clean dark deck matched to the [course homepage](https://xingchen-ian.github.io/domain-learning-camp/) art direction: flat `#091015` background, subtle vertical grid, warm eyebrow labels, thin accent rules, rectangular cards — no circular glow decorations.

## Files

| File | Purpose |
|------|---------|
| `summer-camp-summary.pptx` | Ready-to-present deck (12 slides, 16:9) |
| `build_summary_slides.py` | Regenerate after editing copy |

## Import to Google Slides

1. Open [Google Drive](https://drive.google.com).
2. **New → File upload** → choose `summer-camp-summary.pptx`.
3. Double-click the uploaded file → **Open with → Google Slides**.
4. Optional: **File → Save as Google Slides** to convert fully (fonts may shift slightly; `Segoe UI` → `Arial` or `Roboto` if needed).

## Slide map

1. Title — *From Real Life to Playable Worlds*
2. Opening (quote)
3. Opening — creator vs AI
4. Takeaways
5. Design & development process
6. Human & AI roles (two-column)
7. Who owns the purpose?
8. Why this matters for future designers
9. How to play student games (+ gallery URL)
10. Game trailers (placeholder for video)
11. Final words
12. Thank you + gallery link

## Regenerate

```bash
cd distribution/domain-learning-camp
python3 -m venv .venv-slides
.venv-slides/bin/pip install python-pptx
.venv-slides/bin/python slides/build_summary_slides.py
```
