# Camp Summary

Bilingual summary page for the NYU Shanghai IMA Game Design summer camp.

## Contents

| Path | Purpose |
|------|---------|
| `index.html` | Summary narrative (from the PPT) + embedded showreel |
| `summer-camp-summary.pptx` | Downloadable summary deck |
| `media/showreel.mp4` | Current Game Designs Showreel (proxy preview edition) |

## Update showreel later

When the final original-footage export is ready:

```bash
ffmpeg -y -i "/path/to/final-showreel.mp4" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart \
  media/showreel.mp4
```

Then remove or revise the “proxy preview” note in `index.html`.
