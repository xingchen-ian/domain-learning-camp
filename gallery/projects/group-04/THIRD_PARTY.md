# Third-Party Libraries

This project uses **Track A — no build step** and ships with **no third-party libraries**.

Everything in the project is either:

- hand-written HTML, CSS, and JavaScript, or
- a built-in browser API (Canvas 2D, Web Audio API, `requestAnimationFrame`, etc.).

| Component           | Source               | License       | Version | Path                        |
|---------------------|----------------------|---------------|---------|-----------------------------|
| Canvas 2D context   | Browser built-in     | —             | —       | used in `assets/game.js`    |
| Web Audio API       | Browser built-in     | —             | —       | used in `assets/game.js`    |
| `requestAnimationFrame` | Browser built-in  | —             | —       | used in `assets/game.js`    |

No fonts, icons, models, or audio files are loaded from the network at runtime. The project therefore runs without internet access.
