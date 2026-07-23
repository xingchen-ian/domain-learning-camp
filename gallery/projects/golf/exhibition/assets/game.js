/* =====================================================================
 * Golf — top-down 2D Canvas game
 * Plain JavaScript, no build step. See README.md for the design overview.
 * ===================================================================== */

(() => {
  "use strict";

  // ---------- Canvas setup ----------
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;   // 900
  const H = canvas.height;  // 480

  // ---------- Club table (player-controlled max distance in yards) ----------
  // Choosing a club is the core "decision" the game teaches.
  const CLUBS = {
    driver: { name: "Driver",  maxYards: 230 },
    iron7:  { name: "Iron",    maxYards: 130 },
    wedge:  { name: "Wedge",   maxYards:  80 },
  };
  const CLUB_ORDER = ["driver", "iron7", "wedge"];

  // ---------- Club icons (inline SVG, side-profile silhouettes) ----------
  // Woods → bulbous heads (driver biggest & dark-metallic, 3-wood smaller & wooden-brown).
  // Irons / wedge → same blade path rotated to show increasing loft angle.
  const CLUB_ICONS = {
    driver: '<svg viewBox="0 0 28 28" width="22" height="22"><line x1="14" y1="2" x2="14" y2="15" stroke="#b08840" stroke-width="2" stroke-linecap="round"/><ellipse cx="14" cy="20.5" rx="7" ry="5" fill="#2a2a2a" stroke="#0a0a0a" stroke-width="0.6"/><ellipse cx="13" cy="19.5" rx="4.5" ry="2.5" fill="#555" opacity="0.5"/></svg>',
    iron7:  '<svg viewBox="0 0 28 28" width="22" height="22"><line x1="14" y1="2" x2="14" y2="17" stroke="#b08840" stroke-width="2" stroke-linecap="round"/><path d="M14 17 L21 17 L19 23 L12 23 Z" fill="#a8a8a8" stroke="#777" stroke-width="0.5" transform="rotate(-25 14 19)"/></svg>',
    wedge:  '<svg viewBox="0 0 28 28" width="22" height="22"><line x1="14" y1="2" x2="14" y2="17" stroke="#b08840" stroke-width="2" stroke-linecap="round"/><path d="M14 17 L21 17 L19 23 L12 23 Z" fill="#c0c0c0" stroke="#999" stroke-width="0.5" transform="rotate(-40 14 19)"/></svg>',
  };

  // Ball drops in the cup when it passes over the hole at a slow enough speed.
  // With ease-out motion, speed fraction = (1 − t).  0.20 means the ball must
  // have decelerated to under 20% of its peak speed when crossing the cup —
  // a blast that carries well past the hole will lip out and roll over.
  const HOLE_CATCH_SPEED = 0.20;

  // ---------- Level definitions ----------
  // fairway: array of waypoints { x, topY, botY } defining the fairway edges.
  //   The path between waypoints is linearly interpolated, so the course can
  //   curve, bend, and dogleg.  getFairwayAt(x) returns the interpolated
  //   { topY, botY, centerY } at any X.
  // traps: { type: "water" | "sand", x, y, w, h }  (x,y = top-left in canvas pixels)
  // trees: { x, y, r }  (x,y = centre in canvas pixels)
  const LEVELS = [
    {
      level: 1,
      par: 3,
      holeYards: 100,
      yardToPx: 5.4,       // 100 yd * 5.4 = 540 px of course → hole at x=600
      teeX: 60,
      // Gentle bend: fairway drifts downward in the second half
      fairway: [
        { x: 0,   topY: 175, botY: 275 },
        { x: 300, topY: 175, botY: 275 },
        { x: 550, topY: 210, botY: 310 },
        { x: 900, topY: 210, botY: 310 },
      ],
      traps: [],
      trees: [
        { x: 100, y: 120, r: 18 },
        { x: 220, y: 350, r: 20 },
        { x: 420, y: 140, r: 16 },
        { x: 560, y: 370, r: 22 },
      ],
    },
    {
      level: 2,
      par: 4,
      holeYards: 200,
      yardToPx: 3.0,       // 200 yd * 3.0 = 600 px → hole at x=660
      teeX: 60,
      // S-curve: dips down in the middle then comes back up
      fairway: [
        { x: 0,   topY: 160, botY: 260 },
        { x: 200, topY: 160, botY: 260 },
        { x: 350, topY: 200, botY: 300 },
        { x: 500, topY: 160, botY: 260 },
        { x: 900, topY: 160, botY: 260 },
      ],
      traps: [
        { type: "sand",  cx: 245, cy: 192, r: 20, seed: 11 },  // top edge
        { type: "water", cx: 405, cy: 261, r: 24, seed: 23 },  // bottom edge
        { type: "sand",  cx: 585, cy: 210, r: 18, seed: 37 },  // middle
      ],
      trees: [
        { x: 120, y: 100, r: 18 },
        { x: 320, y: 370, r: 22 },
        { x: 480, y: 110, r: 20 },
        { x: 640, y: 370, r: 18 },
        { x: 720, y: 110, r: 16 },
      ],
    },
    {
      level: 3,
      par: 5,
      holeYards: 430,
      yardToPx: 1.57,      // 430 yd * 1.57 = 675 px of course → hole at x≈735
      teeX: 60,
      // Dogleg: starts upper-left, sweeps down through the middle,
      // then a slight bend back near the green
      fairway: [
        { x: 0,   topY: 140, botY: 240 },
        { x: 200, topY: 140, botY: 240 },
        { x: 350, topY: 180, botY: 280 },
        { x: 500, topY: 220, botY: 320 },
        { x: 650, topY: 220, botY: 320 },
        { x: 900, topY: 195, botY: 295 },
      ],
      traps: [
        { type: "water", cx: 165, cy: 162, r: 22, seed: 5  },  // top edge
        { type: "sand",  cx: 295, cy: 245, r: 20, seed: 17 },  // bottom edge
        { type: "water", cx: 435, cy: 225, r: 22, seed: 29 },  // top edge
        { type: "sand",  cx: 585, cy: 300, r: 20, seed: 41 },  // bottom edge
        { type: "water", cx: 695, cy: 266, r: 22, seed: 53 },  // middle
      ],
      trees: [
        { x: 100, y: 85,  r: 20 },
        { x: 250, y: 370, r: 22 },
        { x: 400, y: 90,  r: 18 },
        { x: 550, y: 375, r: 20 },
        { x: 700, y: 90,  r: 18 },
        { x: 800, y: 365, r: 22 },
      ],
    },
  ];

  // Pre-compute each trap's uneven-blob polygon once (static, deterministic).
  LEVELS.forEach(lvl => {
    lvl.traps.forEach(t => { t.points = blobPoints(t.cx, t.cy, t.r, t.seed); });
  });

  // ---------- Game state ----------
  const state = {
    levelIndex: 0,
    level: null,
    ball: { x: 0, y: 0 },
    ballLastSafe: { x: 0, y: 0 },
    hole: { x: 0, y: 0, r: 12 },
    stroke: 0,
    maxStrokes: 0,
    power: 60,
    aimDeg: 0,            // 0 = straight at the flag; + = aim right/down of it, - = left/up
    club: "iron7",
    status: "aiming",     // "aiming" | "flying" | "won" | "lost"
    flight: null,         // { fromX, fromY, toX, toY, t, dur }
    message: "Aim, pick a club, set power, then swing.",
    sound: "off",         // optional: future use
  };

  // ---------- UI references ----------
  const ui = {
    level:      document.getElementById("hud-level"),
    par:        document.getElementById("hud-par"),
    stroke:     document.getElementById("hud-stroke"),
    distance:   document.getElementById("hud-distance"),
    aim:        document.getElementById("hud-aim"),
    power:      document.getElementById("hud-power"),
    powerBar:   document.getElementById("power-bar"),
    clubList:   document.getElementById("club-list"),
    levelList:  document.getElementById("level-list"),
    swingBtn:   document.getElementById("swing-btn"),
    resetBtn:   document.getElementById("reset-btn"),
    message:    document.getElementById("message"),
  };

  // ---------- Level loading ----------
  function loadLevel(idx) {
    const lvl = LEVELS[idx];
    state.levelIndex = idx;
    state.level = lvl;
    state.stroke = 0;
    state.maxStrokes = lvl.par + 5;
    state.aimDeg = 0;
    state.power = 60;
    state.status = "aiming";
    state.flight = null;
    state.club = "driver";   // first swing of every hole must be the driver
    const teeFw = getFairwayAt(lvl.teeX);
    state.ball = { x: lvl.teeX, y: teeFw.centerY };
    state.ballLastSafe = { ...state.ball };
    const holeX = lvl.teeX + lvl.holeYards * lvl.yardToPx;
    const holeFw = getFairwayAt(holeX);
    state.hole = { x: holeX, y: holeFw.centerY, r: 12 };
    ui.swingBtn.disabled = false;
    setMessage(`Hole ${lvl.level}: Par ${lvl.par}, ${lvl.holeYards} yds, ${lvl.traps.length} traps. Driver only on the first swing.`);
    renderClubList();
    renderLevelList();
    updateHud();
    draw();
  }

  // ---------- Helpers ----------
  function yardsBetween(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.hypot(dx, dy) / state.level.yardToPx;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Aim is RELATIVE to the ball→hole direction so that 0° always means
  // "straight at the flag" — even when the ball has flown past the hole.
  // aimDeg is an offset (±) from that base bearing.
  function aimRad() {
    const dx = state.hole.x - state.ball.x;
    const dy = state.hole.y - state.ball.y;
    const base = (dx === 0 && dy === 0) ? 0 : Math.atan2(dy, dx);
    return base + state.aimDeg * Math.PI / 180;
  }

  // Interpolate fairway top/bottom edges at a given X.
  // Waypoints define the curved path; between two waypoints we lerp.
  function getFairwayAt(x) {
    const fw = state.level.fairway;
    if (x <= fw[0].x) return { topY: fw[0].topY, botY: fw[0].botY, centerY: (fw[0].topY + fw[0].botY) / 2 };
    const last = fw[fw.length - 1];
    if (x >= last.x) return { topY: last.topY, botY: last.botY, centerY: (last.topY + last.botY) / 2 };
    for (let i = 0; i < fw.length - 1; i++) {
      if (x >= fw[i].x && x <= fw[i + 1].x) {
        const t = (x - fw[i].x) / (fw[i + 1].x - fw[i].x);
        const topY = fw[i].topY + (fw[i + 1].topY - fw[i].topY) * t;
        const botY = fw[i].botY + (fw[i + 1].botY - fw[i].botY) * t;
        return { topY, botY, centerY: (topY + botY) / 2 };
      }
    }
    return { topY: fw[0].topY, botY: fw[0].botY, centerY: (fw[0].topY + fw[0].botY) / 2 };
  }

  // ---------- Blob (uneven-circle) trap helpers ----------
  function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  // Build a deterministic uneven-circle polygon around (cx, cy).
  // `seed` keeps the shape stable across frames. Radius varies 0.72..1.22.
  function blobPoints(cx, cy, r, seed) {
    const n = 10;
    const pts = [];
    let s = (seed || 1) * 7 + 3;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const rf = 0.72 + rand() * 0.5;
      pts.push({ x: cx + Math.cos(ang) * r * rf, y: cy + Math.sin(ang) * r * rf });
    }
    return pts;
  }

  // Trace a smooth closed path through the blob points (no fill/stroke).
  function traceBlob(pts) {
    const n = pts.length;
    ctx.beginPath();
    const m0 = midpoint(pts[n - 1], pts[0]);
    ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) {
      const m = midpoint(pts[i], pts[(i + 1) % n]);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    ctx.closePath();
  }

  // Point-in-polygon test (ray casting) for blob collision.
  function pointInPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function setMessage(text, kind) {
    state.message = text;
    ui.message.textContent = text;
    ui.message.classList.remove("win", "lose");
    if (kind === "win")  ui.message.classList.add("win");
    if (kind === "lose") ui.message.classList.add("lose");
  }

  // ---------- Drawing ----------
  function draw() {
    // Sky/rough background
    ctx.fillStyle = "#a4c47a";
    ctx.fillRect(0, 0, W, H);

    // Subtle rough stripes
    ctx.fillStyle = "#9bba72";
    for (let y = 0; y < H; y += 24) {
      ctx.fillRect(0, y, W, 2);
    }

    // Fairway — curved polygon following waypoints
    const lvl = state.level;
    const fw = lvl.fairway;
    ctx.fillStyle = "#74b85c";
    ctx.beginPath();
    ctx.moveTo(fw[0].x, fw[0].topY);
    for (let i = 1; i < fw.length; i++) ctx.lineTo(fw[i].x, fw[i].topY);
    for (let i = fw.length - 1; i >= 0; i--) ctx.lineTo(fw[i].x, fw[i].botY);
    ctx.closePath();
    ctx.fill();

    // Fairway edge lines
    ctx.strokeStyle = "#5fa64a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fw[0].x, fw[0].topY);
    for (let i = 1; i < fw.length; i++) ctx.lineTo(fw[i].x, fw[i].topY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fw[0].x, fw[0].botY);
    for (let i = 1; i < fw.length; i++) ctx.lineTo(fw[i].x, fw[i].botY);
    ctx.stroke();

    // Tee box — follows the fairway shape at x=20..70
    const teeA = getFairwayAt(20);
    const teeB = getFairwayAt(70);
    ctx.fillStyle = "#cfe1cf";
    ctx.beginPath();
    ctx.moveTo(20, teeA.topY);
    ctx.lineTo(70, teeB.topY);
    ctx.lineTo(70, teeB.botY);
    ctx.lineTo(20, teeA.botY);
    ctx.closePath();
    ctx.fill();

    // Traps — uneven blob shapes (not rectangles)
    for (const t of lvl.traps) {
      if (t.type === "water") {
        traceBlob(t.points);
        ctx.fillStyle = "#5aa6c8";
        ctx.fill();
        // ripple lines, clipped to the blob
        ctx.save();
        traceBlob(t.points);
        ctx.clip();
        ctx.strokeStyle = "#3f8aa6";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const yy = t.cy - t.r + (i + 1) * (t.r * 2 / 4);
          ctx.beginPath();
          for (let x = t.cx - t.r; x < t.cx + t.r; x += 8) {
            const yyw = yy + Math.sin((x + performance.now() / 200) * 0.12) * 2;
            if (x === t.cx - t.r) ctx.moveTo(x, yyw); else ctx.lineTo(x, yyw);
          }
          ctx.stroke();
        }
        ctx.restore();
      } else { // sand
        traceBlob(t.points);
        ctx.fillStyle = "#e8d49a";
        ctx.fill();
        ctx.strokeStyle = "#c8a02a";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Trees
    for (const tree of lvl.trees) {
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r + 3, 0, Math.PI * 2);
      ctx.fillStyle = "#506b3a";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fillStyle = "#3f5a2a";
      ctx.fill();
    }

    // Hole (cup) + flag
    const h = state.hole;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r + 2, 0, Math.PI * 2);
    ctx.fillStyle = "#1c2a1c";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fillStyle = "#0c0c0c";
    ctx.fill();
    // Flag pole
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x, h.y - 30);
    ctx.stroke();
    // Flag triangle
    ctx.fillStyle = "#d2453a";
    ctx.beginPath();
    ctx.moveTo(h.x, h.y - 30);
    ctx.lineTo(h.x + 18, h.y - 24);
    ctx.lineTo(h.x, h.y - 18);
    ctx.closePath();
    ctx.fill();

    // Aim line (only when aiming)
    if (state.status === "aiming") {
      const rad = aimRad();
      const length = 90;
      const ex = state.ball.x + Math.cos(rad) * length;
      const ey = state.ball.y + Math.sin(rad) * length;
      ctx.save();
      ctx.strokeStyle = "rgba(108,92,231,0.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(state.ball.x, state.ball.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();

      // Arrowhead
      ctx.fillStyle = "#6c5ce7";
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ball
    const b = state.ball;
    // shadow
    ctx.beginPath();
    ctx.arc(b.x + 2, b.y + 3, 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();
    // ball
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#bdbdbd";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ---------- HUD ----------
  function updateHud() {
    const lvl = state.level;
    ui.level.textContent  = lvl.level;
    ui.par.textContent    = lvl.par;
    ui.stroke.textContent = `${state.stroke} / ${state.maxStrokes}`;
    const yards = yardsBetween(state.ball, state.hole);
    ui.distance.textContent = `${yards.toFixed(0)} yds`;
    ui.aim.textContent   = `${state.aimDeg >= 0 ? "+" : ""}${state.aimDeg}°`;
    ui.power.textContent = `${state.power}%`;
    ui.powerBar.style.width = `${state.power}%`;

    // Update club buttons
    document.querySelectorAll(".club-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.club === state.club);
    });
  }

  function renderClubList() {
    ui.clubList.innerHTML = "";
    const firstSwing = state.stroke === 0;
    for (const key of CLUB_ORDER) {
      const c = CLUBS[key];
      const btn = document.createElement("button");
      btn.className = "club-btn";
      btn.dataset.club = key;
      // Driver is allowed ONLY on the first swing; afterwards it is locked out.
      const locked = firstSwing ? (key !== "driver") : (key === "driver");
      if (locked) btn.classList.add("locked");
      btn.disabled = locked;
      btn.innerHTML = `<span class="club-left">${CLUB_ICONS[key]}<span>${c.name}</span></span><span class="max">max ${c.maxYards} yds</span>`;
      btn.addEventListener("click", () => {
        if (state.status !== "aiming") return;
        // First swing must be the driver; the driver is locked for every later swing.
        if (state.stroke === 0 && key !== "driver") return;
        if (state.stroke >= 1 && key === "driver") return;
        state.club = key;
        // Clamp power if the new club has a lower max — but we let the player keep
        // the current power % so they learn to re-set power after switching clubs.
        updateHud();
      });
      ui.clubList.appendChild(btn);
    }
  }

  function renderLevelList() {
    if (!ui.levelList) return;
    ui.levelList.innerHTML = "";
    LEVELS.forEach((lvl, idx) => {
      const btn = document.createElement("button");
      btn.className = "club-btn";
      btn.dataset.level = String(idx);
      btn.innerHTML = `<span>Hole ${lvl.level}</span><span class="max">Par ${lvl.par} · ${lvl.holeYards} yds</span>`;
      if (idx === state.levelIndex) btn.classList.add("active");
      btn.addEventListener("click", () => {
        if (state.flight) return;
        loadLevel(idx);
      });
      ui.levelList.appendChild(btn);
    });
  }

  // ---------- Input ----------
  const AIM_STEP = 3;     // degrees per press
  const POWER_STEP = 5;   // % per press

  function onKey(e) {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (state.status !== "aiming" && k !== "r") return;

    if (k === "a")      { state.aimDeg = clamp(state.aimDeg - AIM_STEP, -45, 45); updateHud(); }
    else if (k === "d") { state.aimDeg = clamp(state.aimDeg + AIM_STEP, -45, 45); updateHud(); }
    else if (k === "w") { state.power  = clamp(state.power + POWER_STEP, 0, 100); updateHud(); }
    else if (k === "s") { state.power  = clamp(state.power - POWER_STEP, 0, 100); updateHud(); }
    else if (k === " ") { e.preventDefault(); doSwing(); }
    else if (k === "r") { loadLevel(state.levelIndex); }

    draw();
  }

  document.addEventListener("keydown", onKey);
  ui.swingBtn.addEventListener("click", doSwing);
  ui.resetBtn.addEventListener("click", () => loadLevel(state.levelIndex));

  // ---------- Swing ----------
  function doSwing() {
    if (state.status !== "aiming") return;
    if (state.power === 0) {
      setMessage("Power is 0. Press W to add some power first.");
      return;
    }

    state.stroke += 1;

    // Rule: the driver is allowed ONLY on the first swing. After stroke 1 is
    // taken, lock the driver and switch to an available club (Iron).
    if (state.stroke === 1) {
      state.club = "iron7";
      renderClubList();
      updateHud();
    }

    // Distance: (power/100) * club max, with small noise so it is not perfectly predictable.
    const club = CLUBS[state.club];
    const powerFrac = state.power / 100;
    const baseYards = powerFrac * club.maxYards;
    // Scatter: more power = more variance (up to ±10% at full power)
    const scatter = (Math.random() - 0.5) * 0.20 * powerFrac * club.maxYards;
    const totalYards = Math.max(5, baseYards + scatter);
    const totalPx = totalYards * state.level.yardToPx;

    // Direction: aim angle is an offset from the ball→hole bearing,
    // so 0° always fires toward the flag (even when past it).
    const rad = aimRad();
    const dx = Math.cos(rad) * totalPx;
    const dy = Math.sin(rad) * totalPx;
    const toX = state.ball.x + dx;
    const toY = state.ball.y + dy;

    const distPx = Math.hypot(dx, dy);
    const dur = clamp(300 + distPx * 0.5, 300, 1000); // longer shots animate longer
    state.flight = {
      fromX: state.ball.x, fromY: state.ball.y,
      toX, toY,
      t: 0,
      dur,
    };
    state.status = "flying";
    setMessage(`Stroke ${state.stroke}: ${CLUBS[state.club].name} at ${state.power}% power, aim ${state.aimDeg >= 0 ? "+" : ""}${state.aimDeg}°.`);
    animateFlight();
  }

  function animateFlight() {
    const f = state.flight;
    const start = performance.now();
    let captured = false;

    const step = (now) => {
      const t = Math.min(1, (now - start) / f.dur);
      // Ease-out quadratic: ball launches fast, decelerates to a stop.
      const te = 1 - (1 - t) * (1 - t);
      state.ball.x = f.fromX + (f.toX - f.fromX) * te;
      state.ball.y = f.fromY + (f.toY - f.fromY) * te;

      // Hole-capture: if the ball passes over the cup while moving slowly,
      // it drops in.  Speed fraction for ease-out quadratic is (1 − t).
      if (!captured) {
        const dHole = Math.hypot(state.ball.x - state.hole.x,
                                 state.ball.y - state.hole.y);
        if (dHole <= state.hole.r) {
          if (1 - t < HOLE_CATCH_SPEED) {
            captured = true;
            state.ball.x = state.hole.x;
            state.ball.y = state.hole.y;
            state.flight = null;
            draw();
            resolveHoleIn();
            return;
          }
        }
      }

      draw();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        state.flight = null;
        resolveLanding();
      }
    };
    requestAnimationFrame(step);
  }

  // ---------- Hole-in resolution (shared by mid-flight capture & landing) ----------
  function resolveHoleIn() {
    const lvl = state.level;
    if (state.stroke <= state.maxStrokes) {
      state.status = "won";
      setMessage(`In the hole! ${state.stroke} strokes (par ${lvl.par}).`, "win");
      ui.swingBtn.disabled = true;
      offerNextLevel();
    } else {
      state.status = "lost";
      setMessage(`In the hole, but you used ${state.stroke} strokes (max ${state.maxStrokes}). Game over.`, "lose");
      ui.swingBtn.disabled = true;
    }
    updateHud();
  }

  // ---------- Landing resolution ----------
  function resolveLanding() {
    const lvl = state.level;
    const b = state.ball;

    // 1. Did the ball land on the hole?  (Mid-flight capture handles most
    //    drop-ins; this catches a ball that comes to rest right on the lip.)
    const distYards = yardsBetween(b, state.hole);
    if (distYards * lvl.yardToPx <= state.hole.r + 4) {
      resolveHoleIn();
      return;
    }

    // 2. Did it land in a trap? (uneven blob → point-in-polygon test)
    for (const t of lvl.traps) {
      if (pointInPoly(b.x, b.y, t.points)) {
        // Penalty: +1 stroke, ball resets to last safe position
        state.stroke += 1;
        state.ball = { ...state.ballLastSafe };
        if (state.stroke > state.maxStrokes) {
          state.status = "lost";
          setMessage(`Hit a ${t.type} trap and went over the limit (${state.stroke}/${state.maxStrokes}). Game over.`, "lose");
          ui.swingBtn.disabled = true;
        } else {
          state.status = "aiming";
          const advice = Math.random() < 0.5 ? "Pick a different club and aim around it." : "Plan around the trap on the next swing.";
          setMessage(`Hit a ${t.type} trap! +1 stroke, ball back to last spot. ${advice}`);
        }
        updateHud();
        draw();
        return;
      }
    }

    // 3. Out of bounds (off the curved fairway or off the canvas)?
    const fwAtBall = getFairwayAt(b.x);
    if (b.y < fwAtBall.topY - 4 || b.y > fwAtBall.botY + 4 ||
        b.x < 0 || b.x > W) {
      state.stroke += 1;
      state.ball = { ...state.ballLastSafe };
      if (state.stroke > state.maxStrokes) {
        state.status = "lost";
        setMessage(`Out of bounds! Game over (${state.stroke}/${state.maxStrokes}).`, "lose");
        ui.swingBtn.disabled = true;
      } else {
        state.status = "aiming";
        setMessage("Out of bounds. +1 stroke, ball back to last spot. Aim back onto the fairway.");
      }
      updateHud();
      draw();
      return;
    }

    // 4. Landed on the fairway. Update last-safe spot, give aim/power feedback.
    state.ballLastSafe = { ...state.ball };
    state.status = "aiming";

    // Direction feedback
    const holeY = state.hole.y;
    const aimOffset = b.y - holeY; // positive = too low, negative = too high
    const yardsToFlag = distYards;

    let feedback = `${Math.round(yardsToFlag)} yds to flag. `;
    if (yardsToFlag > 30) {
      if (Math.abs(aimOffset) > 18) {
        feedback += aimOffset > 0 ? "Aim a bit higher next time." : "Aim a bit lower next time.";
      } else if (yardsToFlag > 90) {
        feedback += "Long way still — pick a longer club or more power.";
      } else {
        feedback += "Good line. Adjust club or power to close the gap.";
      }
    } else if (yardsToFlag > 8) {
      feedback += "Close! A wedge or short iron should finish it.";
    } else {
      feedback += "Very close — gentle putt home.";
    }

    if (state.stroke >= state.maxStrokes) {
      setMessage(`${feedback} | Final stroke used.`, "win");
      // Allow one last swing
    } else {
      setMessage(feedback);
    }
    updateHud();
    draw();
  }

  function offerNextLevel() {
    if (state.levelIndex < LEVELS.length - 1) {
      setMessage(state.message + ` Press N for Hole ${LEVELS[state.levelIndex + 1].level}.`, "win");
      window.addEventListener("keydown", function next(e) {
        if (e.key.toLowerCase() === "n") {
          window.removeEventListener("keydown", next);
          loadLevel(state.levelIndex + 1);
        }
      });
    } else {
      setMessage(state.message + " You finished all 3 holes. Press R to replay.", "win");
    }
  }

  // ---------- Boot ----------
  loadLevel(0);
})();
