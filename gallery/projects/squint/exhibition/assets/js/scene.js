/* Squint - scene generation (Track A, plain script, no modules)
 * Builds the procedural reference scene, the hidden true-value map,
 * and the region classification used for scoring and critique.
 * Exposes a global `SQUINT` object.
 *
 * Level kinds:
 *   forms  - sphere + box + ground under one light (Levels 1-3, "first image")
 *   apple  - semi-realistic apple, colour, with cool artistic shadow hues
 *   bird   - colourful stylised bird
 *   dragon - simple, fun, cute dragon (final level)
 * Every kind still resolves to a 5-step VALUE map so the block-in mechanic holds.
 *
 * Lighting model (Interaction 10):
 *   - key light (diffuse) from a fixed direction
 *   - low ambient floor so cores still reach value 5
 *   - GROUND BOUNCE LIGHT: the lit ground/backdrop re-lights the shadow side,
 *     strongest on downward-facing normals. This is the missing "bounce light"
 *     that makes a sphere's dark side NOT pure black.
 *   - cast + contact shadows on the ground / backdrop to seat the object
 *   - a soft specular sheen on the lit shoulder of round objects
 *   - a faint backdrop gradient for depth (stays within value 2)
 */
(function (global) {
  'use strict';

  const CANVAS = 420;          // pixel size of each canvas
  const CELL = 5;              // painting-cell size in pixels
  const GRID = CANVAS / CELL;  // 84 cells per axis (high-res, details paintable)

  // Pure-monochrome value palette (1 = lightest, 5 = darkest). R=G=B so it
  // reads as objective value, not a warm/yellow tint that confuses the read.
  const PALETTE = {
    1: '#f2f2f2',
    2: '#cccccc',
    3: '#999999',
    4: '#666666',
    5: '#222222'
  };

  // ---- math helpers ----
  function normalize(x, y, z) {
    const l = Math.hypot(x, y, z) || 1;
    return { x: x / l, y: y / l, z: z / l };
  }
  // key(diffuse) + ambient + ground bounce (strongest on downward normals).
  function shade(nx, ny, nz, L, bounce) {
    const key = Math.max(0, nx * L.x + ny * L.y + nz * L.z);
    let b = 0.10 + 0.80 * key;
    const bk = (bounce == null) ? 0.16 : bounce;
    b += bk * Math.max(0, -ny);   // shadow side faces down -> catches bounce
    return Math.max(0, Math.min(1, b));
  }
  // brightness 1 (bright/light) -> value 1, brightness 0 (dark) -> value 5
  function quantize(b) {
    return Math.max(1, Math.min(5, Math.round((1 - b) * 4) + 1));
  }
  // Point-in-polygon (xy in screen space)
  function pointInPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      if (((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
  // Rotated-ellipse test
  function inEllipse(x, y, cx, cy, rx, ry, rotDeg) {
    const a = -(rotDeg || 0) * Math.PI / 180;
    const dx = x - cx, dy = y - cy;
    const xr = dx * Math.cos(a) - dy * Math.sin(a);
    const yr = dx * Math.sin(a) + dy * Math.cos(a);
    return (xr * xr) / (rx * rx) + (yr * yr) / (ry * ry) <= 1;
  }
  function inTri(x, y, pts) { return pointInPoly(x, y, pts); }

  // soft elliptical shadow: returns 0..depth, strongest at centre
  function softShadow(x, y, cx, cy, rx, ry, rot, depth) {
    const a = -(rot || 0) * Math.PI / 180;
    const dx = x - cx, dy = y - cy;
    const xr = dx * Math.cos(a) - dy * Math.sin(a);
    const yr = dx * Math.sin(a) + dy * Math.cos(a);
    const e = (xr * xr) / (rx * rx) + (yr * yr) / (ry * ry);
    if (e > 1) return 0;
    return depth * (1 - e);
  }

  // shortest-path hue interpolation
  function lerpHue(a, b, t) {
    let diff = (((b - a) % 360) + 540) % 360 - 180;
    return a + diff * t;
  }

  function hslToRgb(h, s, l) {
    let r, g, bb;
    if (s === 0) { r = g = bb = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      bb = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(bb * 255)];
  }

  // colour for a reference pixel: grayscale, or hue-mapped with cool-shadow blend
  function referenceColor(b, cfg, region) {
    if (!cfg.color) { const v = Math.round(b * 255); return [v, v, v]; }
    const light = 0.16 + b * 0.74;
    let h = (cfg.hueMap && cfg.hueMap[region] != null) ? cfg.hueMap[region]
          : (cfg.baseHue != null ? cfg.baseHue : 35);
    let s = cfg.sat != null ? cfg.sat : 0.45;
    // Shadow side catches the cool environment bounce (sky / ground) -> blue.
    if (cfg.shadowHue != null && b < 0.6) {
      const k = Math.min(1, ((0.6 - b) / 0.6) * 1.3);
      h = lerpHue(h, cfg.shadowHue, k);
      s = Math.min(0.78, s + k * 0.18);
    }
    // Specular sheen whitens (desaturate toward white).
    if (b > 0.82) {
      const k = Math.min(1, (b - 0.82) / 0.18);
      s = s * (1 - 0.7 * k);
    }
    return hslToRgb(((h % 360) + 360) % 360 / 360, s, light);
  }

  // faint backdrop gradient (vertical), kept inside value 2 so it reads flat
  function bgBrightness(x, y, cfg) {
    const g = cfg.bgGrad || 0;
    return Math.max(0, Math.min(1, cfg.bgB + g * (1 - y / CANVAS)));
  }

  // ---- levels ----
  const LEVELS = [
    {
      id: 1, kind: 'forms',
      name: 'Level 1 · Grayscale Basics',
      desc: 'First reference. Grayscale, 5 fixed values, single fixed light. Watch the bounce light on the sphere\'s shadow side.',
      color: false, budget: 20,
      L: normalize(-0.5, -0.62, 0.6), horizon: 300, groundB: 0.42, bgB: 0.70, bgGrad: 0.04, bounce: 0.16,
      sphere: { cx: 150, cy: 205, r: 95 }, box: { x: 268, y: 175, w: 104, h: 118, ow: 42, oh: 30 }
    },
    {
      id: 2, kind: 'forms',
      name: 'Level 2 · Moving Light',
      desc: 'First reference, light moved right. Re-read the values as the light shifts.',
      color: false, budget: 22,
      L: normalize(0.5, -0.62, 0.6), horizon: 300, groundB: 0.42, bgB: 0.70, bgGrad: 0.04, bounce: 0.16,
      sphere: { cx: 270, cy: 205, r: 95 }, box: { x: 60, y: 175, w: 104, h: 118, ow: 42, oh: 30 }
    },
    {
      id: 3, kind: 'forms',
      name: 'Level 3 · Colour Mixing',
      desc: 'First reference, now in colour. Keep the value masses while mixing warm light and cool shadow.',
      color: true, bgHue: 35, budget: 24,
      L: normalize(-0.5, -0.62, 0.6), horizon: 300, groundB: 0.42, bgB: 0.70, bgGrad: 0.04, bounce: 0.16,
      sphere: { cx: 150, cy: 205, r: 95 }, box: { x: 268, y: 175, w: 104, h: 118, ow: 42, oh: 30 },
      palette: [
        { name: 'Warm Light', hue: 35, sat: 0.40 },
        { name: 'Cool Shadow', hue: 214, sat: 0.42 }
      ]
    },
    {
      id: 4, kind: 'apple',
      name: 'Apple',
      desc: 'A semi-realistic apple in colour. Notice the cool blue bounce-light on its shadow side.',
      color: true, budget: 26,
      L: normalize(-0.5, -0.6, 0.6), bgB: 0.72, bgGrad: 0.04, bounce: 0.20,
      baseHue: 5, shadowHue: 200, sat: 0.55,
      hueMap: { body: 5, leaf: 110, stem: 25, bg: 42 },
      palette: [
        { name: 'Apple Light', hue: 8, sat: 0.50 },
        { name: 'Apple Red', hue: 2, sat: 0.62 },
        { name: 'Shadow Blue', hue: 200, sat: 0.55 },
        { name: 'Leaf Green', hue: 110, sat: 0.50 },
        { name: 'Stem Brown', hue: 25, sat: 0.50 },
        { name: 'Sky', hue: 42, sat: 0.32 }
      ]
    },
    {
      id: 5, kind: 'bird',
      name: 'Bird',
      desc: 'A colourful bird. Block in its big colour masses — body, head, wing — before any detail.',
      color: true, budget: 28,
      L: normalize(-0.5, -0.55, 0.62), bgB: 0.70, bgGrad: 0.04, bounce: 0.16,
      baseHue: 210, shadowHue: 248, sat: 0.5,
      hueMap: { body: 208, head: 208, wing: 196, beak: 32, eye: 210, bg: 45 },
      palette: [
        { name: 'Body Blue', hue: 208, sat: 0.55 },
        { name: 'Wing Teal', hue: 196, sat: 0.50 },
        { name: 'Beak Orange', hue: 32, sat: 0.60 },
        { name: 'Sky', hue: 45, sat: 0.32 },
        { name: 'Shadow', hue: 248, sat: 0.50 }
      ]
    },
    {
      id: 6, kind: 'dragon',
      name: 'Dragon',
      desc: 'The final level: a simple, fun dragon. Read its friendly masses and squint to check.',
      color: true, budget: 32,
      L: normalize(-0.45, -0.6, 0.62), bgB: 0.68, bgGrad: 0.04, bounce: 0.16,
      baseHue: 120, shadowHue: 182, sat: 0.48,
      hueMap: { body: 122, head: 122, wing: 152, bg: 50 },
      palette: [
        { name: 'Body Green', hue: 122, sat: 0.50 },
        { name: 'Wing Green', hue: 152, sat: 0.48 },
        { name: 'Sky', hue: 50, sat: 0.32 },
        { name: 'Shadow', hue: 182, sat: 0.50 }
      ]
    }
  ];

  // ============ brightness fields ============
  function formsGround(x, y, cfg) {
    let b = cfg.groundB;
    const t = (y - cfg.horizon) / (CANVAS - cfg.horizon);
    b += 0.05 * (1 - t);                       // a touch lighter near the horizon
    const sdir = -Math.sign(cfg.L.x || -1);    // shadow falls opposite the light
    const s = cfg.sphere;
    // sphere cast shadow, stretched away from the light on the ground
    b -= softShadow(x, y, s.cx + sdir * 60, s.cy + s.r + 10, 150, 42, 0, 0.30);
    // tight contact shadow right under the sphere
    b -= softShadow(x, y, s.cx, s.cy + s.r + 2, s.r * 0.7, 22, 0, 0.18);
    const bx = cfg.box;
    // box cast shadow
    b -= softShadow(x, y, bx.x + bx.w / 2 + sdir * 58, bx.y + bx.h + 12, 150, 36, 0, 0.24);
    // box contact shadow
    b -= softShadow(x, y, bx.x + bx.w / 2, bx.y + bx.h + 4, bx.w * 0.6, 20, 0, 0.16);
    return Math.max(0, Math.min(1, b));
  }

  function formsBrightness(x, y, cfg) {
    if (y > cfg.horizon) return formsGround(x, y, cfg);
    const s = cfg.sphere;
    const dx = x - s.cx, dy = y - s.cy, r = s.r;
    if (dx * dx + dy * dy <= r * r) {
      const z = Math.sqrt(r * r - dx * dx - dy * dy);
      const n = normalize(dx / r, dy / r, z / r);
      let b = shade(n.x, n.y, n.z, cfg.L, cfg.bounce);
      // soft specular sheen on the lit shoulder (upper-left)
      const hl = ((x - (s.cx - r * 0.34)) / (r * 0.30)) ** 2 + ((y - (s.cy - r * 0.34)) / (r * 0.24)) ** 2;
      if (hl < 1) b = Math.max(b, 0.93 - 0.55 * hl);
      return b;
    }
    const b = cfg.box;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return shade(0, 0, 1, cfg.L, cfg.bounce);
    const top = [[b.x, b.y], [b.x + b.ow, b.y - b.oh], [b.x + b.w + b.ow, b.y - b.oh], [b.x + b.w, b.y]];
    if (pointInPoly(x, y, top)) return shade(0, -1, 0, cfg.L, cfg.bounce);
    const side = [[b.x + b.w, b.y], [b.x + b.w + b.ow, b.y - b.oh], [b.x + b.w + b.ow, b.y + b.h - b.oh], [b.x + b.w, b.y + b.h]];
    if (pointInPoly(x, y, side)) return shade(1, 0, 0, cfg.L, cfg.bounce);
    return bgBrightness(x, y, cfg);
  }

  function appleBrightness(x, y, cfg) {
    if (x >= 203 && x <= 217 && y >= 116 && y <= 150) return 0.12;     // stem (dark)
    if (inEllipse(x, y, 252, 110, 36, 16, -0.5)) return 0.52;          // leaf (mid green)
    const cx = 210, cy = 244, rx = 112, ry = 126;
    const nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) {
      // backdrop, with a soft cast + contact shadow seating the apple
      const sh = softShadow(x, y, cx + 26, cy + ry - 18, 150, 34, 0, 0.30)
               + softShadow(x, y, cx, cy + ry - 6, rx * 0.6, 22, 0, 0.18);
      return Math.max(0, Math.min(1, bgBrightness(x, y, cfg) - sh));
    }
    const z = Math.sqrt(1 - d);
    const n = normalize(nx, ny, z);
    let b = shade(n.x, n.y, n.z, cfg.L, cfg.bounce);
    // specular sheen on the lit shoulder
    const hl = ((x - (cx - rx * 0.34)) / (rx * 0.26)) ** 2 + ((y - (cy - ry * 0.30)) / (ry * 0.22)) ** 2;
    if (hl < 1) b = Math.max(b, 0.95 - 0.6 * hl);
    // top dimple (stem cavity) - a gentle concavity darkening
    const td = ((x - cx) / (rx * 0.45)) ** 2 + ((y - (cy - ry * 0.86)) / (ry * 0.26)) ** 2;
    if (td < 1) b -= 0.10 * (1 - td);
    // bottom calyx dimple
    const bd = ((x - cx) / (rx * 0.5)) ** 2 + ((y - (cy + ry * 0.92)) / (ry * 0.22)) ** 2;
    if (bd < 1) b -= 0.07 * (1 - bd);
    return Math.max(0, Math.min(1, b));
  }

  function birdBrightness(x, y, cfg) {
    // tail
    if (inTri(x, y, [[38, 252], [112, 224], [112, 280]])) return 0.34;
    const bx = 208, by = 254, brx = 92, bry = 70;
    const nxb = (x - bx) / brx, nyb = (y - by) / bry, db = nxb * nxb + nyb * nyb;
    if (db <= 1) {
      const z = Math.sqrt(Math.max(0, 1 - db));
      const n = normalize(nxb, nyb, z);
      const diff = Math.max(0, n.x * cfg.L.x + n.y * cfg.L.y + n.z * cfg.L.z);
      let b = shade(n.x, n.y, n.z, cfg.L, cfg.bounce);
      if (inEllipse(x, y, 196, 270, 54, 34, 0.5)) {
        b = Math.min(b, 0.30 + 0.40 * diff);   // front wing, a touch darker
      }
      return b;
    }
    const hx = 300, hy = 192, hr = 46;
    const dh = ((x - hx) * (x - hx) + (y - hy) * (y - hy)) / (hr * hr);
    if (dh <= 1) {
      const z = Math.sqrt(Math.max(0, 1 - dh));
      const n = normalize((x - hx) / hr, (y - hy) / hr, z);
      return shade(n.x, n.y, n.z, cfg.L, cfg.bounce);
    }
    if (inTri(x, y, [[344, 186], [344, 202], [380, 194]])) return 0.55;  // beak
    if ((x - 312) * (x - 312) + (y - 182) * (y - 182) <= 18) return 0.10; // eye
    // backdrop, with a soft shadow beneath the bird
    const sh = softShadow(x, y, 200, 300, 170, 40, 0, 0.22);
    return Math.max(0, Math.min(1, bgBrightness(x, y, cfg) - sh));
  }

  const DRAGON_WING = [[150, 205], [78, 150], [58, 232], [96, 258], [150, 252]];
  const DRAGON_TAIL = [[268, 300], [332, 330], [366, 362], [350, 376], [302, 348], [262, 322]];

  function dragonBrightness(x, y, cfg) {
    let b = cfg.bgB;
    const sh = softShadow(x, y, 196, 322, 180, 44, 0, 0.22);  // ground shadow under dragon
    if (pointInPoly(x, y, DRAGON_WING)) b = 0.52;             // membrane (lighter green)
    if (pointInPoly(x, y, DRAGON_TAIL)) b = 0.42;             // tail
    const bx = 196, by = 256, brx = 96, bry = 72;
    const nxb = (x - bx) / brx, nyb = (y - by) / bry, db = nxb * nxb + nyb * nyb;
    if (db <= 1) {
      const z = Math.sqrt(Math.max(0, 1 - db));
      const n = normalize(nxb, nyb, z);
      b = shade(n.x, n.y, n.z, cfg.L, cfg.bounce);
    }
    if (inEllipse(x, y, 200, 286, 70, 34, 0)) b = Math.max(b, 0.80);   // belly (light)
    const hx = 300, hy = 196, hr = 52;
    const dh = ((x - hx) * (x - hx) + (y - hy) * (y - hy)) / (hr * hr);
    if (dh <= 1) {
      const z = Math.sqrt(Math.max(0, 1 - dh));
      const n = normalize((x - hx) / hr, (y - hy) / hr, z);
      b = shade(n.x, n.y, n.z, cfg.L, cfg.bounce);
    }
    if (inEllipse(x, y, 344, 210, 30, 22, 0)) b = 0.66;   // snout
    if (inTri(x, y, [[286, 152], [302, 152], [280, 118]])) b = 0.14;  // horn L
    if (inTri(x, y, [[306, 152], [324, 152], [324, 116]])) b = 0.14;  // horn R
    if ((x - 312) * (x - 312) + (y - 184) * (y - 184) <= 22) b = 0.10; // eye
    if ((x - 362) * (x - 362) + (y - 208) * (y - 208) <= 14) b = 0.22; // nostril
    // apply the cast shadow only on backdrop areas (objects already set)
    if (b > cfg.bgB - 0.01) b = Math.max(0, Math.min(1, bgBrightness(x, y, cfg) - sh));
    return Math.max(0, Math.min(1, b));
  }

  function sceneBrightness(x, y, cfg) {
    switch (cfg.kind) {
      case 'apple': return appleBrightness(x, y, cfg);
      case 'bird': return birdBrightness(x, y, cfg);
      case 'dragon': return dragonBrightness(x, y, cfg);
      default: return formsBrightness(x, y, cfg);
    }
  }

  // ============ classification ============
  function formsClassify(cfg, x, y) {
    if (y > cfg.horizon) return 'ground';
    const s = cfg.sphere;
    if ((x - s.cx) * (x - s.cx) + (y - s.cy) * (y - s.cy) <= s.r * s.r) return 'sphere';
    const b = cfg.box;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return 'box';
    const top = [[b.x, b.y], [b.x + b.ow, b.y - b.oh], [b.x + b.w + b.ow, b.y - b.oh], [b.x + b.w, b.y]];
    const side = [[b.x + b.w, b.y], [b.x + b.w + b.ow, b.y - b.oh], [b.x + b.w + b.ow, b.y + b.h - b.oh], [b.x + b.w, b.y + b.h]];
    if (pointInPoly(x, y, top) || pointInPoly(x, y, side)) return 'box';
    return 'bg';
  }
  function appleClassify(cfg, x, y) {
    if (x >= 203 && x <= 217 && y >= 116 && y <= 150) return 'stem';
    if (inEllipse(x, y, 252, 110, 36, 16, -0.5)) return 'leaf';
    const nx = (x - 210) / 112, ny = (y - 244) / 126;
    if (nx * nx + ny * ny <= 1) return 'body';
    return 'bg';
  }
  function birdClassify(cfg, x, y) {
    if (inTri(x, y, [[38, 252], [112, 224], [112, 280]])) return 'body';
    const bx = 208, by = 254, brx = 92, bry = 70;
    const nxb = (x - bx) / brx, nyb = (y - by) / bry, db = nxb * nxb + nyb * nyb;
    if (db <= 1 && inEllipse(x, y, 196, 270, 54, 34, 0.5)) return 'wing';
    if (db <= 1) return 'body';
    const hx = 300, hy = 192, hr = 46;
    const dh = ((x - hx) * (x - hx) + (y - hy) * (y - hy)) / (hr * hr);
    if (dh <= 1) return 'head';
    if (inTri(x, y, [[344, 186], [344, 202], [380, 194]])) return 'head';
    return 'bg';
  }
  function dragonClassify(cfg, x, y) {
    if (pointInPoly(x, y, DRAGON_WING)) return 'wing';
    if (pointInPoly(x, y, DRAGON_TAIL)) return 'body';
    const bx = 196, by = 256, brx = 96, bry = 72;
    const nxb = (x - bx) / brx, nyb = (y - by) / bry, db = nxb * nxb + nyb * nyb;
    if (db <= 1) return 'body';
    if (inEllipse(x, y, 200, 286, 70, 34, 0)) return 'body';
    const hx = 300, hy = 196, hr = 52;
    const dh = ((x - hx) * (x - hx) + (y - hy) * (y - hy)) / (hr * hr);
    if (dh <= 1) return 'head';
    if (inEllipse(x, y, 344, 210, 30, 22, 0)) return 'head';
    return 'bg';
  }
  function classify(cfg, x, y) {
    switch (cfg.kind) {
      case 'apple': return appleClassify(cfg, x, y);
      case 'bird': return birdClassify(cfg, x, y);
      case 'dragon': return dragonClassify(cfg, x, y);
      default: return formsClassify(cfg, x, y);
    }
  }

  // ---- build full scene data ----
  function buildScene(cfg) {
    const N = CANVAS * CANVAS;
    const brightness = new Float32Array(N);
    const off = document.createElement('canvas');
    off.width = CANVAS; off.height = CANVAS;
    const octx = off.getContext('2d');
    const img = octx.createImageData(CANVAS, CANVAS);
    const data = img.data;

    for (let y = 0; y < CANVAS; y++) {
      for (let x = 0; x < CANVAS; x++) {
        const i = y * CANVAS + x;
        const b = sceneBrightness(x, y, cfg);
        brightness[i] = b;
        const cls = classify(cfg, x, y);
        const c = referenceColor(b, cfg, cls);
        const p = i * 4;
        data[p] = c[0]; data[p + 1] = c[1]; data[p + 2] = c[2]; data[p + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);

    const trueGrid = [], cellClass = [];
    const regions = {};
    for (let r = 0; r < GRID; r++) {
      trueGrid[r] = []; cellClass[r] = [];
      for (let c = 0; c < GRID; c++) {
        const px = c * CELL + CELL / 2;
        const py = r * CELL + CELL / 2;
        const b = sceneBrightness(px, py, cfg);
        trueGrid[r][c] = quantize(b);
        const cls = classify(cfg, px, py);
        cellClass[r][c] = cls;
        (regions[cls] || (regions[cls] = [])).push({ r, c });
      }
    }

    return { cfg, brightness, refCanvas: off, trueGrid, cellClass, regions, width: CANVAS, height: CANVAS, cell: CELL, grid: GRID };
  }

  global.SQUINT = {
    CANVAS, CELL, GRID, PALETTE, LEVELS, buildScene,
    colorFor: referenceColor, hslToRgb, quantize
  };
})(typeof window !== 'undefined' ? window : globalThis);
