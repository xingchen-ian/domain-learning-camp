/*
 * To the End - Biking Game
 * Track A: no build step, plain HTML/CSS/JS
 *
 * Logic map (2026-07-16 update):
 * Goal: reach finish before time runs out, without 0 stamina, stopping the bike,
 *       or exceeding safe heart-rate limit.
 */

const LEVELS = [
  {
    name: "Level 1",
    target: "Reach the finish line using the given stamina.",
    windKnots: 0,
    windDir: "none",
    inclines: [0.05, 0, 0.05, 0, 0.05],
    road: "smooth",
    distanceM: 500,
    stamina: 100
  },
  {
    name: "Level 2",
    target: "Reach the finish line using the given stamina.",
    windKnots: 30,
    windDir: "head",
    inclines: [0.05, 0, 0.08, 0, 0.11],
    road: "smooth",
    distanceM: 1000,
    stamina: 100
  },
  {
    name: "Level 3",
    target: "Reach the finish line using the given stamina.",
    windKnots: 20,
    windDir: "tail",
    inclines: [0.16, 0, 0.10, 0, 0.23],
    road: "rough",
    distanceM: 1500,
    stamina: 100
  }
];

const GEAR_RATIOS = [1.3, 1.4, 1.9, 2.5, 3.2, 4.0, 4.9, 6.0];
const MAX_GEAR = 8;
const MIN_GEAR = 1;

const STOP_SPEED_LIMIT = 7 / 3.6; // 7 km/h ≈ 1.944 m/s (unstable below this)
const STOP_FAIL_TIME = 2.5;     // seconds at/below limit before failure
const HR_DANGER_LIMIT = 185;  // bpm — the red line
const HR_FAIL_TIME = 2;       // seconds at/above the red line before failure
const HR_ORANGE_LOW = 160;    // bpm — bottom of the orange (warning) zone
const HR_ORANGE_FAIL_TIME = 15;// seconds sustained in the 160–185 zone before failure
const HR_DECLINE_K = 0.8;     // bpm/s of HR fall per %-point of power cut (constant decline)
const HR_DECLINE_MIN = 2;      // bpm/s floor so even a small cut still eases down
const HR_MIN = 70;            // bottom of the heart-rate meter
const HR_MAX = 200;           // top of the heart-rate meter
const HR_MAX_TARGET = 200;    // realistic cap; 100% power → ~235 bpm, clamped to 200 (meter top)
const HR_RATE_K = 0.9;        // logistic mid-acceleration for the slow→fast shape
const HR_RATE_LINEAR = 0.012; // small floor so it always converges
const HR_MAX_RATE = 10;        // maximum change in bpm per second (no violent burst)
const HR_POWER_DELAY_MIN = 5; // s: min wait after a power change before HR responds (fresh/stable case)
const HR_POWER_DELAY_MAX = 6; // s: max wait after a power change before HR responds (fresh/stable case)
const HR_FLUCT_TIME = 15;     // s: fluctuating window before HR stabilizes (normal path, from a stable state)
const HR_FLUCT_SHORT_MIN = 4; // s: min fluctuation window when a NEW power change interrupts (HR not yet stable)
const HR_FLUCT_SHORT_MAX = 5; // s: max fluctuation window when a NEW power change interrupts (HR not yet stable)
const HR_FLUCT_AMP = 6;       // max bpm of fluctuation (decays to 0 over the window)
const HR_POS_DELAY = 5.5;     // s: wait this long after a riding-position change before HR responds
const HR_LEAN_BONUS = 12;     // extra bpm when leaning forward (per original logic map)
const MAX_SPEED = 48 / 3.6;   // 48 km/h, realistic upper bound for cycling
const ROAD_EXAG = 2.0;      // visual slant factor: applied to BOTH the road geometry
                              // and the bike angle so they stay parallel (wheels on the road).
                              // 2x keeps even Level 3's 23% grade on a 1200x450 canvas.
const DISTANCE_RATE = 0.65;   // world traversal factor: bike covers 65% of "true" distance/sec,
                              // so the same stated distance & game time FEELS longer / takes more time.

// --- Jumping over obstacles ----------------------------------------------
const JUMP_DUR = 1.0;        // seconds the player/NPC is airborne (longer = more forgiving timing)
const JUMP_HEIGHT = 80;       // px visual hop height — tall enough to clearly clear a hurdle
const JUMP_COST = 10;         // % stamina lost per jump
const JUMP_TRIGGER = 0.5;    // s-fraction of JUMP_DUR before an obstacle an NPC will auto-jump

// --- Pickups (air bubbles) ---------------------------------------------
// Bubbles float ABOVE the road so only a JUMP — which lifts the rider —
// can pop them; a rider cruising on the surface passes underneath.
const BUBBLE_AIR = 64;          // px above the road surface (within jump reach)
const STAMINA_BLUE_GAIN = 20;    // % stamina restored by a blue bubble
const STAMINA_MYSTERY_GAIN = 30; // % stamina from the "+30" mystery effect
const MYSTERY_CURRENT_LOSS = 0.20;// -20% of current stamina
// Max-stamina mystery effects are ADDITIVE ±25 percentage-points of the
// 100% ceiling (so 75% + 25% = 100%), not multiplicative — see applyMystery.
const MYSTERY_MAX_GAIN = 25;     // additive +25 to max stamina (points)
const MYSTERY_MAX_LOSS = 25;     // additive -25 to max stamina (points)
const MAX_STAMINA_CAP = 100;      // ceiling for the +max-stamina effect
const MIN_STAMINA_CAP = 50;       // floor for the -max-stamina effect
const TIRE_POP_SPEED = 20 / 3.6; // m/s cap when the tire is popped (20 km/h)

// --- Correct-combination model -------------------------------------------
// The correct combo (gear + pedal + power + position) is a function of the
// incline GRADE only (see correctComboForIncline + optimalGearForIncline), so
// the same grade always carries the same correct combo. "hardness" measures how
// far the player's inputs are from it:
//   hardness > 0  → harder than needed (over-exerting) → MORE drain & higher HR
//   hardness < 0  → easier than needed (under-exerting) → LESS drain & lower HR
// The weights below say how strongly each input contributes to hardness.
const HARD_W_POWER = 1.0;     // power deviation weight (per 50% off)
const HARD_W_PEDAL = 0.6;     // pedal-speed deviation weight (per 60 RPM off)
const HARD_W_GEAR = 0.7;      // gear-vs-incline deviation weight (per 7 gears off)
const HARD_W_POS = 1.5;       // stamina/HR penalty for the wrong riding position
const DRAIN_BASE = 0.075;     // stamina %/s drained by the CORRECT combo (slightly higher than before)
const DRAIN_HARDNESS_K = 1.6; // how much hardness scales the drain
const DRAIN_INCLINE_COST = 0.12; // extra %/s drain per unit of incline (grade)
const DRAIN_ROUGH_COST = 0.05;  // extra %/s drain on a rough road
const DRAIN_MIN = 0.08;       // never below this while riding
// The starting/default combination (gear 4, pedal 60, power 50, normal) is the
// "lazy" setup a new player begins with. Riding it — instead of reading the
// incline and dialling in the correct combo — drains stamina a little faster.
const DEFAULT_COMBO = { gear: 4, pedal: 60, power: 50, position: "normal" };
const DEFAULT_PENALTY = 0.04; // extra %/s stamina drain while on the default combo
const HR_DEV_K = 20;          // bpm added/removed per unit of pedal/gear/position hardness
const HR_POWER_K = 1.25;      // bpm per % of (delayed) power output — the HR baseline
const SPEED_INCLINE_PEN = 5;  // how much a climb slows the bike (m/s per unit grade)
const POWER_SPEED_K = 0.007;  // power's contribution to speed: factor = 0.7 + power*K
                              // (power 0→0.7×, 50→1.05×, 100→1.4×). More power → faster,
                              // but power also drives heart rate, so it can't be pushed freely.

// A "bike" holds every per-rider field. In singleplayer only STATE.p1 is
// used; in multiplayer both STATE.p1 and STATE.p2 exist and are simulated
// independently (each has its own distance, stamina, heart rate, gear, jump…).
function makeBike(color, isPlayer) {
  return {
    color,
    isPlayer,
    bikeDistance: 0,
    speed: 0,
    stamina: 100,
    staminaMax: 100,           // can be raised/lowered by mystery bubbles
    tirePopped: false,          // mystery effect: caps top speed at 20 km/h
    toast: null,                 // { text, color, t } brief on-screen effect message
    heartRate: 70,
    pedalSpeed: 60,
    powerOutput: 50,
    gear: 4,
    position: "normal",          // "normal" or "leaning"
    incline: 0,
    windResistance: 0,
    dangerHeartTimer: 0,
    orangeHeartTimer: 0,      // seconds sustained in the 160–185 bpm orange zone
    stopTimer: 0,
    hrSmooth: 70,               // smoothed heart-rate baseline (fluctuation added on top)
    hrDeclineRate: 0,           // constant bpm/s HR fall rate set when power is cut
    hrActivePower: 50,          // power HR is currently reacting to (old value during delay)
    hrPendingPower: 50,         // power HR will move to once the delay window passes
    hrChangeT: -999,            // elapsed time of the last power change
    hrDelay: 0,                 // random 5-6 s (fresh) or 0 (interrupted) delay before HR reacts
    hrFluctTime: 0,             // length of the current fluctuation window (15 s normal, 4-5 s interrupted)
    hrStableAt: -999,           // elapsed time at which HR has fully stabilized for the current transition
    hrPosBuf: [{ t: 0, v: false }], // ring buffer of recent leaning states (delayed HR)
    jump: null,                  // this rider's active jump: { t } or null
    cleared: [],                 // per-obstacle "cleared" flag (multiplayer-safe)
    finished: false,
    won: false,
    message: ""
  };
}

const STATE = {
  gameMode: "single",           // "single" | "multi"
  levelIndex: 0,
  running: false,
  finished: false,
  won: false,
  message: "",
  totalDistance: 0,
  bikeDistance: 0,              // camera bike (P1) — shadow kept for the draw routines
  incline: 0,                   // camera shadow (P1 incline)
  speed: 0,                     // camera shadow (P1 speed)
  windResistance: 0,            // camera shadow (P1 wind)
  elapsed: 0,                   // seconds since level start (shared clock, for HR delays)
  roadPath: [],
  obstacles: [],                // hurdles on flat terrain: { dist }
  bubbles: [],                  // air pickups: { dist, type:'blue'|'mystery', popped }
  npcs: [],                     // rival riders: { dist, speed, target, retarget, color, lane, jump }
  p1: makeBike("#E67E22", true),
  p2: null                      // created when multiplayer is chosen
};

/* Cobblestone road texture -----------------------------------------------
 * The rough road is rendered as a dense field of stones (a real stone road)
 * by tiling a pre-built cobblestone canvas. The pattern scrolls with the
 * bike so the stones move naturally with the world. */
const STONE_PALETTES = [
  { light: "#b8b0a3", dark: "#6f675b" }, // light gray
  { light: "#a89c86", dark: "#5d5446" }, // tan
  { light: "#9aa0a0", dark: "#52585a" }, // blue-gray
  { light: "#c2b8a6", dark: "#7a6f5c" } // warm
];

// Build a smooth, irregular closed blob (no two stones look alike).
function blobPath(ctx, cx, cy, r, ry) {
  const n = 10;
  const start = Math.random() * Math.PI * 2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * Math.PI * 2;
    const rr = 0.74 + Math.random() * 0.5; // 0.74..1.24 → wavy/irregular edge
    pts.push([cx + Math.cos(a) * r * rr, cy + Math.sin(a) * ry * rr]);
  }
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    const nxt = pts[(i + 1) % n];
    ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2);
  }
  ctx.closePath();
}

function drawStoneTile(ctx, x, y, r, shade) {
  const pal = STONE_PALETTES[shade];
  const ry = r * (0.68 + Math.random() * 0.34); // varied width/height ratio
  const rot = Math.random() * Math.PI;            // random orientation
  // Soft contact shadow to seat the stone.
  ctx.save();
  ctx.translate(x + 1, y + 1.5);
  ctx.rotate(rot);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  blobPath(ctx, 0, 0, r, ry);
  ctx.fill();
  ctx.restore();
  // Stone body with a top-lit radial gradient for a 3D pebble look.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(-r * 0.35, -ry * 0.35, r * 0.2, 0, 0, r);
  g.addColorStop(0, pal.light);
  g.addColorStop(1, pal.dark);
  ctx.fillStyle = g;
  blobPath(ctx, 0, 0, r, ry);
  ctx.fill();
  ctx.restore();
}

function buildStoneTile() {
  const T = 56;
  const c = document.createElement("canvas");
  c.width = T;
  c.height = T;
  const t = c.getContext("2d");
  // Mortar / grout between the stones.
  t.fillStyle = "#574f44";
  t.fillRect(0, 0, T, T);
  const cell = 14;
  for (let i = -1; i <= T / cell + 1; i++) {
    for (let j = -1; j <= T / cell + 1; j++) {
      const offset = (i % 2) * (cell / 2); // brick-style stagger
      const x = j * cell + offset + (Math.random() - 0.5) * 3;
      const y = i * cell + (Math.random() - 0.5) * 3;
      const r = 4 + Math.random() * 8; // 4..12 → strongly varied sizes
      const shade = Math.floor(Math.random() * STONE_PALETTES.length);
      drawStoneTile(t, x, y, r, shade);
    }
  }
  return c;
}

const stoneTile = buildStoneTile();


const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  levelTitle: document.getElementById("levelTitle"),
  levelTarget: document.getElementById("levelTarget"),
  levelWind: document.getElementById("levelWind"),
  levelRoad: document.getElementById("levelRoad"),
  levelDistance: document.getElementById("levelDistance"),
  topBar: document.getElementById("topBar"),
  pedalSlider: document.getElementById("pedalSlider"),
  pedalValue: document.getElementById("pedalValue"),
  powerSlider: document.getElementById("powerSlider"),
  powerValue: document.getElementById("powerValue"),
  positionBtn: document.getElementById("positionBtn"),
  gearValue: document.getElementById("gearValue"),
  gearUp: document.getElementById("gearUp"),
  gearDown: document.getElementById("gearDown"),
  windValue: document.getElementById("windValue"),
  speedValue: document.getElementById("speedValue"),
  hrValue: document.getElementById("hrValue"),
  inclineValue: document.getElementById("inclineValue"),
  staminaBar: document.getElementById("staminaBar"),
  staminaValue: document.getElementById("staminaValue"),
  hrBar: document.getElementById("hrBar"),
  powerOut: document.getElementById("powerOut"),
  distanceValue: document.getElementById("distanceValue"),
  terrainValue: document.getElementById("terrainValue"),
  startBtn: document.getElementById("startBtn"),
  restartBtn: document.getElementById("restartBtn"),
  levelBtns: document.querySelectorAll(".level-btn[data-level]"),
  lockBtn: document.getElementById("lockBtn"),
  messageBox: document.getElementById("messageBox"),
  // Player 2 control group (multiplayer only). Mirrors the Player 1 controls.
  p2: {
    pedalSlider: document.getElementById("pedalSlider2"),
    pedalValue: document.getElementById("pedalValue2"),
    powerSlider: document.getElementById("powerSlider2"),
    powerValue: document.getElementById("powerValue2"),
    positionBtn: document.getElementById("positionBtn2"),
    gearValue: document.getElementById("gearValue2"),
    gearUp: document.getElementById("gearUp2"),
    gearDown: document.getElementById("gearDown2"),
    staminaBar: document.getElementById("staminaBar2"),
    staminaValue: document.getElementById("staminaValue2"),
    hrBar: document.getElementById("hrBar2"),
    hrValue: document.getElementById("hrValue2"),
    speedValue: document.getElementById("speedValue2"),
    distanceValue: document.getElementById("distanceValue2")
  }
};

let lastFrame = 0;

/* --- Level progression / locking ----------------------------------------
 * The player can only enter a level once the previous one has been cleared.
 * The highest unlocked level index is remembered in localStorage so progress
 * survives a page reload. */
let maxUnlockedLevel = 0;
try {
  const saved = parseInt(localStorage.getItem("tte_maxUnlocked"), 10);
  if (!Number.isNaN(saved)) {
    maxUnlockedLevel = Math.max(0, Math.min(LEVELS.length - 1, saved));
  }
} catch (e) { /* localStorage unavailable — start from level 1 only */ }

function refreshLevelButtons() {
  ui.levelBtns.forEach((btn) => {
    const lv = parseInt(btn.dataset.level, 10);
    const locked = lv > maxUnlockedLevel;
    const current = lv === STATE.levelIndex;
    // A level can be entered once it has been beaten (it is "unlocked").
    btn.classList.toggle("locked", locked);
    btn.classList.toggle("active", current);          // current level → highlighted blue
    btn.classList.toggle("cleared", !locked && !current); // beaten but not current
    btn.disabled = locked;
    btn.title = locked
      ? "Complete the previous level to unlock this one"
      : (current ? "You are on this level" : "Replay this level");
  });
}

function unlockLevel(index) {
  if (index > maxUnlockedLevel) {
    maxUnlockedLevel = Math.min(LEVELS.length - 1, index);
    try { localStorage.setItem("tte_maxUnlocked", String(maxUnlockedLevel)); } catch (e) {}
  }
  refreshLevelButtons();
}

/* "Lock Levels" toggle (button to the right of Level 3).
 * When engaged it re-locks Levels 2 & 3 (only Level 1 is selectable) and
 * forces sequential play — the player must finish the previous level before
 * the next one unlocks. Switching it off re-opens every level for free
 * practice. (The normal per-win unlock still advances one level at a time.) */
let progressionLocked = false;

ui.lockBtn.addEventListener("click", () => {
  progressionLocked = !progressionLocked;
  if (progressionLocked) {
    maxUnlockedLevel = 0;
    ui.lockBtn.textContent = "Unlock Levels";
    ui.lockBtn.dataset.locked = "true";
    ui.lockBtn.title = "Levels 2 & 3 are locked — finish the previous level to advance.";
  } else {
    maxUnlockedLevel = LEVELS.length - 1;
    ui.lockBtn.textContent = "Lock Levels";
    ui.lockBtn.dataset.locked = "false";
    ui.lockBtn.title = "Click to lock Levels 2 & 3 — finish the previous level to advance.";
  }
  refreshLevelButtons();
});

/* Rapid heartbeat audio — plays only while heart rate is in the danger zone. */
let audioCtx = null;
let heartbeatInterval = null;

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function thump(time, freq, peak) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(peak, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(time);
  o.stop(time + 0.2);
}

function playHeartbeat() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  thump(t, 62, 0.6);          // lub
  thump(t + 0.18, 50, 0.45); // dub
}

function startHeartbeat() {
  if (heartbeatInterval || !audioCtx) return;
  playHeartbeat();
  heartbeatInterval = setInterval(playHeartbeat, 600); // rapid ~100 bpm feel
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function formatTime(s) {
  if (s === null || s === undefined) return "∞";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function buildRoadPath(level) {
  const segments = [];
  const inclines = level.inclines;
  const total = inclines.length;
  const segmentDistance = level.distanceM / total;

  let x = 0;
  let y = 0;
  segments.push({ x, y, grade: 0, dist: 0 });

  for (let i = 0; i < total; i++) {
    const grade = inclines[i];
    const run = segmentDistance * Math.cos(Math.atan(grade));
    const rise = segmentDistance * Math.sin(Math.atan(grade));
    x += run;
    y -= rise * ROAD_EXAG; // up is negative; exaggerate the slant for visibility
    segments.push({ x, y, grade, dist: segmentDistance * (i + 1) });
  }

  return segments;
}

function getInclineAtDistance(roadPath, distance) {
  if (!roadPath.length) return 0;
  const totalDist = roadPath[roadPath.length - 1].dist;
  if (distance >= totalDist) return roadPath[roadPath.length - 1].grade;
  if (distance <= 0) return roadPath[0].grade;

  for (let i = 0; i < roadPath.length - 1; i++) {
    const a = roadPath[i];
    const b = roadPath[i + 1];
    if (distance >= a.dist && distance <= b.dist) {
      // The grade of segment [a→b] is the slope between the two nodes,
      // which equals the grade stored on the END node (b). Returning a.grade
      // would report the PREVIOUS segment's grade (off-by-one), so the
      // terrain box and the physics would see the wrong incline.
      return b.grade;
    }
  }
  return 0;
}

function roadYAt(roadPath, distance) {
  if (!roadPath.length) return 0;
  const totalDist = roadPath[roadPath.length - 1].dist;
  if (distance >= totalDist) return roadPath[roadPath.length - 1].y;
  if (distance <= 0) return roadPath[0].y;

  for (let i = 0; i < roadPath.length - 1; i++) {
    const a = roadPath[i];
    const b = roadPath[i + 1];
    if (distance >= a.dist && distance <= b.dist) {
      const t = (distance - a.dist) / (b.dist - a.dist);
      return a.y + (b.y - a.y) * t;
    }
  }
  return 0;
}

// Place hurdles on the FLAT segments of the road (grade === 0). Each flat
// run gets several evenly-spaced hurdles — at least 3 across the whole level,
// with a guaranteed minimum gap between them — so the player always sees them
// coming and must clear each one with a jump.
function generateObstacles(level) {
  const total = level.inclines.length;
  const seg = level.distanceM / total;
  const BUFFER = 40;   // m from the very start / finish
  const MARGIN = 12;    // m from each flat-segment's own ends
  const MIN_GAP = 22;   // m — minimum spacing between consecutive hurdles

  // Collect the inner (usable) span of every flat segment.
  const flats = [];
  for (let i = 0; i < total; i++) {
    if (level.inclines[i] !== 0) continue;          // only flat terrain
    const s = i * seg, e = (i + 1) * seg;
    if (s < BUFFER || e > level.distanceM - BUFFER) continue;
    flats.push([s + MARGIN, e - MARGIN]);
  }

  // Try progressively tighter spacing until we have at least 3 hurdles.
  let gap = 45;
  let obs = [];
  while (gap >= 18 && obs.length < 3) {
    obs = [];
    for (const [lo, hi] of flats) {
      const len = hi - lo;
      if (len < gap) {
        obs.push({ dist: (lo + hi) / 2, cleared: false });
        continue;
      }
      const n = Math.min(3, Math.max(1, Math.floor(len / gap)));
      for (let k = 0; k < n; k++) {
        const d = lo + (len * (k + 1)) / (n + 1); // even spacing, clear of edges
        obs.push({ dist: d, cleared: false });
      }
    }
    gap -= 6;
  }

  obs.sort((a, b) => a.dist - b.dist);

  // Enforce the hard minimum spacing across the whole list (nudge later ones).
  for (let i = 1; i < obs.length; i++) {
    if (obs[i].dist - obs[i - 1].dist < MIN_GAP) {
      obs[i].dist = obs[i - 1].dist + MIN_GAP;
    }
  }
  return obs;
}

// Place air bubbles along the level:
//   • one YELLOW mystery bubble on each INCLINE section (→ sits above the hill)
//     — random effect, but the player can simply NOT jump on the climb to avoid it.
//   • BLUE bubbles floating in the AIR between the hurdles on each FLAT section
//     — each one pops for +20% stamina. (Hurdles only appear on flat terrain.)
// All bubbles sit above the road (BUBBLE_AIR) so only a jump can pop them.
function generateBubbles(level) {
  const total = level.inclines.length;
  const seg = level.distanceM / total;
  const bubbles = [];
  for (let i = 0; i < total; i++) {
    const s = i * seg, e = (i + 1) * seg;
    const mid = (i + 0.5) * seg;
    if (level.inclines[i] !== 0) {
      // Mystery bubble floats above the INCLINE itself.
      bubbles.push({ dist: mid, type: "mystery", popped: false });
    } else {
      // Blue bubbles float in the AIR between the hurdles on this flat run.
      // (STATE.obstacles is already generated when this runs.)
      const hurdles = STATE.obstacles
        .filter((o) => o.dist >= s && o.dist <= e)
        .map((o) => o.dist)
        .sort((a, b) => a - b);
      if (hurdles.length >= 2) {
        // One blue bubble in each gap between consecutive hurdles.
        for (let k = 0; k < hurdles.length - 1; k++) {
          const d = (hurdles[k] + hurdles[k + 1]) / 2;
          bubbles.push({ dist: d, type: "blue", popped: false });
        }
      } else if (hurdles.length === 1) {
        // A single hurdle: drop a blue bubble in the air just before it.
        bubbles.push({ dist: Math.max(s + 6, hurdles[0] - 18), type: "blue", popped: false });
      } else {
        // No hurdles on this flat run: one blue bubble in the middle.
        bubbles.push({ dist: mid, type: "blue", popped: false });
      }
    }
  }
  return bubbles;
}

function optimalGearForIncline(grade) {
  // Higher inclines need easier gears. Grade is 0.0 to 1.0 (e.g. 0.05 = 5%).
  const gear = Math.max(1, 6 - Math.floor(grade * 40));
  return gear;
}

// The CORRECT combination is a function of the incline GRADE only — so every
// hill with the same grade always has the same correct gear / pedal speed /
// power output / riding position, no matter which level or segment it appears in.
// (Gear already comes from optimalGearForIncline; this adds pedal/power/position.)
function correctComboForIncline(grade) {
  const gear = optimalGearForIncline(grade);
  // Pedal (cadence) and power climb with the grade; they ease off on descents.
  let pedal = 62 + grade * 110;   // 0% -> 62; 5% -> 67; 11% -> 74; 23% -> 87; -10% -> 51
  let power = 46 + grade * 120;   // 0% -> 46; 5% -> 52; 11% -> 59; 23% -> 74; -10% -> 34
  pedal = Math.round(Math.max(40, Math.min(95, pedal)));
  power = Math.round(Math.max(25, Math.min(85, power)));
  // Lean forward to drive the pedals on steeper climbs; flat / descent = normal.
  const position = grade >= 0.08 ? "leaning" : "normal";
  return { gear, pedal, power, position };
}

function topBarText(level) {
  const parts = level.inclines.map((g) => {
    const pct = Math.round(g * 100);
    return pct === 0 ? "flat" : `${pct}% climb`;
  });
  const windText = level.windKnots === 0
    ? "No wind"
    : `${level.windKnots} knots ${level.windDir === "head" ? "headwind" : "tailwind"}`;
  const roadText = level.road === "smooth" ? "smooth road" : "rough road";
  return `${parts.join(" → ")}   |   ${windText} · ${roadText}`;
}

function resetBike(bike) {
  const level = LEVELS[STATE.levelIndex];
  bike.bikeDistance = 0;
  bike.speed = 0;
  bike.stamina = level.stamina;
  bike.staminaMax = level.stamina;
  bike.tirePopped = false;
  bike.toast = null;
  bike.heartRate = 70;
  bike.pedalSpeed = 60;
  bike.powerOutput = 50;
  bike.gear = 4;
  bike.position = "normal";
  bike.incline = 0;
  bike.windResistance = 0;
  bike.dangerHeartTimer = 0;
  bike.orangeHeartTimer = 0;
  bike.stopTimer = 0;
  bike.hrSmooth = 70;
  bike.hrDeclineRate = 0;
  bike.hrActivePower = 50;
  bike.hrPendingPower = 50;
  bike.hrChangeT = -999;
  bike.hrDelay = 0;
  bike.hrFluctTime = 0;
  bike.hrStableAt = -999;
  bike.hrPosBuf = [{ t: 0, v: false }];
  bike.jump = null;
  bike.cleared = STATE.obstacles.map(() => false);
  bike.finished = false;
  bike.won = false;
  bike.message = "";
}

function loadLevel(index) {
  const level = LEVELS[index];
  STATE.levelIndex = index;
  STATE.running = false;
  STATE.finished = false;
  STATE.won = false;
  STATE.message = "";
  STATE.totalDistance = level.distanceM;
  STATE.elapsed = 0;
  // Hurdles on the flat parts of the road.
  STATE.obstacles = generateObstacles(level);
  // Air bubbles (blue on inclines, yellow mystery on flats).
  STATE.bubbles = generateBubbles(level);
  STATE.roadPath = buildRoadPath(level);
  // Two rival NPCs start ON the start line (singleplayer only — multiplayer
  // uses a second human player instead).
  STATE.npcs = [
    { dist: 0, speed: 18, target: 18, retarget: 0,   color: "#9B59B6", lane: 0, jump: null },
    { dist: 0, speed: 22, target: 22, retarget: 1.2, color: "#3498DB", lane: 0, jump: null }
  ];
  resetBike(STATE.p1);
  if (STATE.gameMode === "multi") {
    if (!STATE.p2) STATE.p2 = makeBike("#3498DB", true);
    resetBike(STATE.p2);
  } else {
    STATE.p2 = null;
  }
  stopHeartbeat();

  ui.levelTitle.textContent = level.name;
  ui.levelTarget.textContent = level.target;
  ui.levelWind.textContent = level.windKnots === 0
    ? "None"
    : `${level.windKnots} knots ${level.windDir === "head" ? "headwind" : "tailwind"}`;
  ui.levelRoad.textContent = level.road === "smooth" ? "Smooth" : "Rough";
  ui.levelDistance.textContent = `${level.distanceM} m`;
  ui.topBar.textContent = topBarText(level);

  // Player 1 controls.
  ui.pedalSlider.value = STATE.p1.pedalSpeed;
  ui.powerSlider.value = STATE.p1.powerOutput;
  ui.positionBtn.textContent = "Normal";
  ui.positionBtn.dataset.value = "normal";
  ui.gearValue.textContent = STATE.p1.gear;

  // Player 2 controls (multiplayer).
  if (STATE.p2) {
    ui.p2.pedalSlider.value = STATE.p2.pedalSpeed;
    ui.p2.powerSlider.value = STATE.p2.powerOutput;
    ui.p2.positionBtn.textContent = "Normal";
    ui.p2.positionBtn.dataset.value = "normal";
    ui.p2.gearValue.textContent = STATE.p2.gear;
  }

  ui.startBtn.textContent = "Start";
  ui.messageBox.classList.add("hidden");
  ui.messageBox.textContent = "";
  ui.messageBox.classList.remove("won", "lost");

  refreshLevelButtons();
  updateDashboard();
  draw();
}

// One of five equal-chance effects fires when a YELLOW mystery bubble is
// popped. Effects may raise / lower the stamina ceiling, change current
// stamina, or pop the tire (capping top speed at 20 km/h for the run).
function applyMystery(bike) {
  const r = Math.floor(Math.random() * 5);
  if (r === 0) {
    // Additive +25% to the max-stamina ceiling (so 75% → 100%), capped at 100.
    bike.staminaMax = Math.min(MAX_STAMINA_CAP, bike.staminaMax + MYSTERY_MAX_GAIN);
    bike.toast = { text: "Mystery: max stamina +25%!", color: "#27AE60" };
  } else if (r === 1) {
    // Additive -25% to the max-stamina ceiling, floored at 50.
    bike.staminaMax = Math.max(MIN_STAMINA_CAP, bike.staminaMax - MYSTERY_MAX_LOSS);
    if (bike.stamina > bike.staminaMax) bike.stamina = bike.staminaMax;
    bike.toast = { text: "Mystery: max stamina -25%!", color: "#C0392B" };
  } else if (r === 2) {
    bike.stamina = Math.max(0, bike.stamina * (1 - MYSTERY_CURRENT_LOSS));
    bike.toast = { text: "Mystery: stamina -20%!", color: "#C0392B" };
  } else if (r === 3) {
    bike.stamina = Math.min(bike.staminaMax, bike.stamina + STAMINA_MYSTERY_GAIN);
    bike.toast = { text: "Mystery: +" + STAMINA_MYSTERY_GAIN + "% stamina!", color: "#27AE60" };
  } else {
    bike.tirePopped = true;
    bike.toast = { text: "Bike tire popped! (max bike speed: 20 km/h)", color: "#E67E22" };
  }
}

function stepBike(bike, dt) {
  if (bike.finished) return;
  const level = LEVELS[STATE.levelIndex];

  // --- Delayed heart-rate response (power) ---
  // Two cases:
  //  1) Fresh change from a STABLE state: wait 5–6 s, then fluctuate & stabilize.
  //  2) A NEW change lands BEFORE HR has stabilized: skip the long wait, fluctuate
  //     4–5 s, then lock onto the NEWEST power value.
  if (bike.powerOutput !== bike.hrPendingPower) {
    const interrupted = STATE.elapsed < bike.hrStableAt;
    const powerDrop = bike.hrPendingPower - bike.powerOutput; // >0 when power is cut
    bike.hrDeclineRate = powerDrop > 0
      ? Math.min(HR_MAX_RATE, Math.max(HR_DECLINE_MIN, powerDrop * HR_DECLINE_K))
      : 0;
    bike.hrPendingPower = bike.powerOutput;
    bike.hrChangeT = STATE.elapsed;
    if (interrupted) {
      bike.hrDelay = 0;
      bike.hrFluctTime = HR_FLUCT_SHORT_MIN +
        Math.random() * (HR_FLUCT_SHORT_MAX - HR_FLUCT_SHORT_MIN);
    } else {
      bike.hrDelay = HR_POWER_DELAY_MIN +
        Math.random() * (HR_POWER_DELAY_MAX - HR_POWER_DELAY_MIN);
      bike.hrFluctTime = HR_FLUCT_TIME;
    }
    bike.hrStableAt = bike.hrChangeT + bike.hrDelay + bike.hrFluctTime;
  }
  const hrReactStart = bike.hrChangeT + bike.hrDelay;
  let delayedPower = bike.hrActivePower;
  if (STATE.elapsed >= hrReactStart) {
    bike.hrActivePower = bike.hrPendingPower;
    delayedPower = bike.hrPendingPower;
  }

  // --- Delayed heart-rate response (riding position) ---
  bike.hrPosBuf.push({ t: STATE.elapsed, v: bike.position === "leaning" });
  const cutPos = STATE.elapsed - HR_POS_DELAY - 0.05;
  while (bike.hrPosBuf.length > 2 && bike.hrPosBuf[1].t < cutPos) bike.hrPosBuf.shift();
  const delayedLeaning = bike.hrPosBuf[0].v;

  bike.incline = getInclineAtDistance(STATE.roadPath, bike.bikeDistance);
  const optimalGear = optimalGearForIncline(bike.incline);
  const ratio = GEAR_RATIOS[bike.gear - 1];

  // Gear category relative to the current incline.
  const gearDiff = bike.gear - optimalGear;

  // Cadence category.
  let cadenceCategory = "suitable";
  if (bike.pedalSpeed < 40) cadenceCategory = "slow";
  if (bike.pedalSpeed > 90) cadenceCategory = "high";

  // Base speed from gear, cadence AND power output.
  let baseSpeed = ratio * bike.pedalSpeed * 0.046 * (0.7 + bike.powerOutput * POWER_SPEED_K);

  // Gear-cadence mismatch effect on speed.
  if (gearDiff > 0) {
    if (cadenceCategory === "slow") baseSpeed *= 0.5;
    else if (cadenceCategory === "high") baseSpeed *= 1.05;
    else baseSpeed *= 0.85;
  } else if (gearDiff < 0) {
    if (cadenceCategory === "high") baseSpeed *= 1.1;
    else if (cadenceCategory === "slow") baseSpeed *= 0.7;
    else baseSpeed *= 1.0;
  } else if (cadenceCategory === "suitable") {
    baseSpeed *= 1.15;
  }

  const inclinePenalty = bike.incline * SPEED_INCLINE_PEN;

  // Wind effect depends on riding position. Lean forward to cut a headwind
  // (faster); sit up in a tailwind (faster). The magnitudes are kept modest
  // so the per-INCLINE correct position (normal on flat / low grades) stays
  // winnable even in a headwind — leaning is a *mild* speed bonus, not a
  // requirement to avoid stalling.
  const wind = level.windKnots;
  const isLeaning = bike.position === "leaning";
  let windPenalty = 0;
  if (level.windDir === "head") {
    windPenalty = isLeaning ? wind * 0.03 : wind * 0.08;
  } else if (level.windDir === "tail") {
    // In a tailwind sitting up (normal) is fastest; leaning is near-neutral
    // (kept small so the per-INCLINE "lean on climbs" combo isn't a speed penalty).
    windPenalty = isLeaning ? wind * 0.01 : wind * -0.06;
  }
  bike.windResistance = windPenalty;

  const roughPenalty = level.road === "rough" ? 1.2 : 0;

  let targetSpeed = baseSpeed - inclinePenalty - windPenalty - roughPenalty;
  if (targetSpeed < 0) targetSpeed = 0;
  if (targetSpeed > MAX_SPEED) targetSpeed = MAX_SPEED;
  // Mystery "tire popped" effect caps the top speed at 20 km/h.
  if (bike.tirePopped && targetSpeed > TIRE_POP_SPEED) targetSpeed = TIRE_POP_SPEED;

  bike.speed += (targetSpeed - bike.speed) * 0.8 * dt;
  if (bike.speed < 0.05 && targetSpeed < 0.05) bike.speed = 0;

  const prevDist = bike.bikeDistance;
  bike.bikeDistance += bike.speed * dt * DISTANCE_RATE;

  // Advance this rider's jump timer.
  if (bike.jump) {
    bike.jump.t += dt;
    if (bike.jump.t >= JUMP_DUR) bike.jump = null;
  }

  // Obstacle crossing (per rider). Cleared only while airborne.
  for (let i = 0; i < STATE.obstacles.length; i++) {
    const o = STATE.obstacles[i];
    if (bike.cleared[i]) continue;
    if (prevDist < o.dist && bike.bikeDistance >= o.dist) {
      if (bike.jump) {
        bike.cleared[i] = true;
      } else {
        const who = bike === STATE.p1 ? "Player 1" : "Player 2";
        bike.finished = true;
        bike.won = false;
        bike.message = who + " crashed into a hurdle! Press the jump key to clear them.";
        stopHeartbeat();
        break;
      }
    }
  }

  // --- Air-bubble pickups (blue + mystery) ---
  // Only poppable while AIRBORNE, so a rider on the road surface passes
  // underneath and never collects them — jumping is required to reach them.
  if (bike.jump) {
    for (const b of STATE.bubbles) {
      if (b.popped) continue;
      if (prevDist < b.dist && bike.bikeDistance >= b.dist) {
        b.popped = true;
        if (b.type === "blue") {
          bike.stamina = Math.min(bike.staminaMax, bike.stamina + STAMINA_BLUE_GAIN);
          bike.toast = { text: "Blue! +" + STAMINA_BLUE_GAIN + "% stamina", color: "#2980B9" };
        } else {
          applyMystery(bike);
        }
        break;
      }
    }
  }

  // Advance this rider's effect-feedback toast timer.
  if (bike.toast) {
    bike.toast.t += dt;
    if (bike.toast.t > 2.5) bike.toast = null;
  }

  // --- Hardness vs the correct combination (per-INCLINE, so the same
  //     grade always has the same correct gear/pedal/power/position) ---
  const c = correctComboForIncline(bike.incline);
  const gearTerm = gearDiff / 7;
  const pedalTerm = (bike.pedalSpeed - c.pedal) / 60;
  const powerTerm = (bike.powerOutput - c.power) / 50;
  const posWrong = bike.position === c.position ? 0 : 1;
  const hardness =
    powerTerm * HARD_W_POWER +
    pedalTerm * HARD_W_PEDAL +
    gearTerm * HARD_W_GEAR +
    posWrong * HARD_W_POS;

  let drain = DRAIN_BASE * (1 + DRAIN_HARDNESS_K * hardness);
  // Extra drain while riding the starting/default combo instead of reading the
  // incline and dialling in the correct combination.
  const onDefault =
    bike.gear === DEFAULT_COMBO.gear &&
    bike.pedalSpeed === DEFAULT_COMBO.pedal &&
    bike.powerOutput === DEFAULT_COMBO.power &&
    bike.position === DEFAULT_COMBO.position;
  if (onDefault) drain += DEFAULT_PENALTY;
  drain += bike.incline * DRAIN_INCLINE_COST;
  if (level.road === "rough") drain += DRAIN_ROUGH_COST;
  if (drain < DRAIN_MIN) drain = DRAIN_MIN;

  bike.stamina = Math.max(0, bike.stamina - drain * dt);

  // NOTE: stamina recovery on flat terrain has been REMOVED — once you spend
  // it, you only get it back from the blue air-bubbles (or a "+stamina"
  // mystery bubble). This keeps "reading the incline and riding the correct
  // combo" the core skill rather than a recover-while-cruising loop.

  // Heart rate.
  const posWrongHR = (delayedLeaning ? "leaning" : "normal") === c.position ? 0 : 1;
  // Heart-rate target from absolute power output (single linear map):
  //   75% power → 160 bpm (bottom of the orange zone)
  //   80% power → 185 bpm (the red line)
  //   below 75% stays green; above 80% climbs into the red (clamped at 200)
  let targetHR = 5 * delayedPower - 215;
  targetHR +=
    (pedalTerm * HARD_W_PEDAL + gearTerm * HARD_W_GEAR + posWrongHR * HARD_W_POS) *
    HR_DEV_K;
  targetHR = Math.max(HR_MIN, Math.min(HR_MAX_TARGET, targetHR));
  const u = (bike.hrSmooth - HR_MIN) / (HR_MAX - HR_MIN);
  const uTarget = (targetHR - HR_MIN) / (HR_MAX - HR_MIN);
  let newU;
  // When power has been CUT, heart rate eases down at a steady (constant) rate
  // sized by the size of the cut, rather than the eased logistic rise used going up.
  if (targetHR < bike.hrSmooth - 0.001 && bike.hrDeclineRate > 0) {
    const dropU = (bike.hrDeclineRate / (HR_MAX - HR_MIN)) * dt;
    newU = u - dropU;
    if (newU < uTarget) newU = uTarget;   // don't overshoot the new target
  } else {
    const error = uTarget - u;
    let rate = (HR_RATE_K * u * (1 - u) + HR_RATE_LINEAR) * Math.sign(error);
    const capU = HR_MAX_RATE / (HR_MAX - HR_MIN);
    if (Math.abs(rate) > capU) rate = Math.sign(rate) * capU;
    newU = u + rate * dt;
  }
  if (newU < 0) newU = 0;
  if (newU > 1) newU = 1;
  bike.hrSmooth = HR_MIN + newU * (HR_MAX - HR_MIN);

  let fluct = 0;
  const reactT = bike.hrChangeT + bike.hrDelay;
  if (STATE.elapsed >= reactT && STATE.elapsed < bike.hrStableAt) {
    const phase = (STATE.elapsed - reactT) / bike.hrFluctTime;
    const amp = HR_FLUCT_AMP * (1 - phase);
    fluct = Math.sin((STATE.elapsed - reactT) * 2.4) * amp;
  }
  bike.heartRate = bike.hrSmooth + fluct;

  // Failure checks (per rider).
  //  • Red zone   (>= 185 bpm): fail after HR_FAIL_TIME seconds.
  //  • Orange zone (160–185 bpm): fail after HR_ORANGE_FAIL_TIME seconds —
  //    the rider can't sustain such a high heart rate.
  if (bike.heartRate >= HR_DANGER_LIMIT) {
    bike.dangerHeartTimer += dt;
    bike.orangeHeartTimer = 0;
    startHeartbeat();
  } else if (bike.heartRate >= HR_ORANGE_LOW) {
    bike.orangeHeartTimer += dt;
    bike.dangerHeartTimer = 0;
    startHeartbeat();
  } else {
    bike.dangerHeartTimer = 0;
    bike.orangeHeartTimer = 0;
    stopHeartbeat();
  }

  if (bike.speed < STOP_SPEED_LIMIT) bike.stopTimer += dt;
  else bike.stopTimer = 0;

  if (bike.bikeDistance >= STATE.totalDistance) {
    bike.finished = true;
    bike.won = true;
    bike.message = "You reached the finish line!";
    stopHeartbeat();
  } else if (bike.stamina <= 0) {
    bike.finished = true;
    bike.won = false;
    bike.message = "You're out of stamina!";
    stopHeartbeat();
  } else if (bike.dangerHeartTimer > HR_FAIL_TIME) {
    bike.finished = true;
    bike.won = false;
    bike.message = "Heart rate over the 185 bpm limit for too long!";
    stopHeartbeat();
  } else if (bike.orangeHeartTimer > HR_ORANGE_FAIL_TIME) {
    bike.finished = true;
    bike.won = false;
    bike.message = "Heart rate stuck in the 160–185 bpm zone for too long — can't sustain it!";
    stopHeartbeat();
  } else if (bike.stopTimer > STOP_FAIL_TIME) {
    bike.finished = true;
    bike.won = false;
    bike.message = "Unstable bike — speed too low to ride stably!";
    stopHeartbeat();
  }
}

// End the level and show the result. `won` = the MAIN player (P1) succeeded,
// which is what gates level progression in both modes.
function finishLevel(won, message) {
  STATE.finished = true;
  STATE.won = won;
  if (won) {
    const hasNext = STATE.levelIndex + 1 < LEVELS.length;
    if (hasNext) unlockLevel(STATE.levelIndex + 1);
    message += hasNext ? " Next level unlocked." : " You've completed every level!";
  }
  STATE.message = message;
  stopHeartbeat();
  ui.startBtn.textContent = "Start";
  ui.messageBox.textContent = message;
  ui.messageBox.classList.remove("hidden");
  ui.messageBox.classList.toggle("won", won);
  ui.messageBox.classList.toggle("lost", !won);
}

function updatePhysics(dt) {
  if (!STATE.running || STATE.finished) return;

  STATE.elapsed += dt;

  // Rival NPCs only exist in singleplayer.
  if (STATE.gameMode === "single") updateNPCs(dt);

  // Advance each rider independently.
  stepBike(STATE.p1, dt);
  if (STATE.gameMode === "multi" && STATE.p2) stepBike(STATE.p2, dt);

  // Camera follows Player 1 (kept as shadows for the draw routines).
  STATE.bikeDistance = STATE.p1.bikeDistance;
  STATE.incline = STATE.p1.incline;
  STATE.speed = STATE.p1.speed;
  STATE.windResistance = STATE.p1.windResistance;

  if (STATE.gameMode === "single") {
    if (STATE.p1.finished) {
      const hasNext = STATE.levelIndex + 1 < LEVELS.length;
      let msg = STATE.p1.message;
      if (STATE.p1.won && !hasNext) msg = "You reached the finish line! You've completed every level!";
      finishLevel(STATE.p1.won, msg);
    }
    return;
  }

  // --- Multiplayer: first rider to a terminal state decides the round. ---
  // (No time limit — the round ends on a crash / stamina / HR / finish.)
  const p1 = STATE.p1, p2 = STATE.p2;
  if (p1.finished && p2.finished) {
    const p1ahead = p1.bikeDistance >= p2.bikeDistance;
    finishLevel(p1ahead, p1ahead ? "Player 1 wins the race!" : "Player 2 wins the race!");
  } else if (p1.finished) {
    finishLevel(p1.won, p1.won ? "Player 1 wins the race!" : "Player 2 wins! (Player 1 failed)");
  } else if (p2.finished) {
    finishLevel(p2.won ? false : true, p2.won ? "Player 2 wins the race!" : "Player 1 wins! (Player 2 failed)");
  }
}

function setBar(bar, valEl, pct, withText) {
  valEl.textContent = `${pct.toFixed(0)}%`;
  bar.style.width = `${pct}%`;
  bar.classList.remove("ok", "warning", "danger");
  if (pct < 25) bar.classList.add("danger");
  else if (pct < 50) bar.classList.add("warning");
  else bar.classList.add("ok");
}

function setHrBar(bar, hr) {
  const hrPct = Math.max(0, Math.min(100, ((hr - 60) / 140) * 100));
  bar.style.width = `${hrPct}%`;
  bar.classList.remove("ok", "warning", "danger");
  if (hr >= HR_DANGER_LIMIT) bar.classList.add("danger");
  else if (hr >= HR_ORANGE_LOW) bar.classList.add("warning");
  else bar.classList.add("ok");
}

function updateDashboard() {
  const p1 = STATE.p1;
  ui.pedalValue.textContent = `${p1.pedalSpeed} RPM`;
  ui.powerValue.textContent = `${p1.powerOutput}%`;
  ui.windValue.textContent = `${p1.windResistance.toFixed(1)} N`;
  ui.speedValue.textContent = `${(p1.speed * 3.6).toFixed(1)} km/h`;
  ui.hrValue.textContent = `${Math.round(p1.heartRate)} bpm`;
  ui.inclineValue.textContent = `${(p1.incline * 100).toFixed(0)}%`;
  ui.powerOut.textContent = `${p1.powerOutput}%`;
  ui.distanceValue.textContent = `${Math.floor(p1.bikeDistance)} / ${STATE.totalDistance} m`;

  // Terrain type — also mirrored in the top-left white box on the canvas (draw).
  const g = Math.round(p1.incline * 100);
  ui.terrainValue.textContent = g === 0 ? "Flat" : (g > 0 ? "Uphill " : "Downhill ") + Math.abs(g) + "%";

  setBar(ui.staminaBar, ui.staminaValue, p1.stamina, true);
  ui.hrValue.classList.toggle("danger", p1.heartRate > HR_DANGER_LIMIT);
  setHrBar(ui.hrBar, p1.heartRate);

  // Player 2 box (multiplayer).
  if (STATE.gameMode === "multi" && STATE.p2) {
    const p2 = STATE.p2;
    ui.p2.pedalValue.textContent = `${p2.pedalSpeed} RPM`;
    ui.p2.powerValue.textContent = `${p2.powerOutput}%`;
    ui.p2.speedValue.textContent = `${(p2.speed * 3.6).toFixed(1)} km/h`;
    ui.p2.hrValue.textContent = `${Math.round(p2.heartRate)} bpm`;
    ui.p2.distanceValue.textContent = `${Math.floor(p2.bikeDistance)} / ${STATE.totalDistance} m`;
    ui.p2.hrValue.classList.toggle("danger", p2.heartRate > HR_DANGER_LIMIT);
    setBar(ui.p2.staminaBar, ui.p2.staminaValue, p2.stamina, true);
    setHrBar(ui.p2.hrBar, p2.heartRate);
  }
}

function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;

  // Sky gradient.
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, "#BDE0FE");
  skyGrad.addColorStop(1, "#E8F6F3");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Sun.
  ctx.fillStyle = "#FFF4BD";
  ctx.beginPath();
  ctx.arc(w - 120, 90, 45, 0, Math.PI * 2);
  ctx.fill();

  // Distant hills (layered).
  const hillLayers = [
    { color: "#A8C686", yOffset: 0.45, amplitude: 50, frequency: 0.004 },
    { color: "#8FB069", yOffset: 0.55, amplitude: 40, frequency: 0.006 },
    { color: "#729C52", yOffset: 0.65, amplitude: 35, frequency: 0.008 }
  ];

  hillLayers.forEach((layer) => {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 10) {
      const y = h * layer.yOffset + Math.sin(x * layer.frequency + STATE.bikeDistance * 0.002) * layer.amplitude;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  });

  // Ground at bottom.
  ctx.fillStyle = "#6E8C4B";
  ctx.fillRect(0, h * 0.8, w, h * 0.2);
}

function drawRoad() {
  const w = canvas.width;
  const h = canvas.height;

  if (!STATE.roadPath.length) return;

  const totalDist = STATE.roadPath[STATE.roadPath.length - 1].dist;
  const scale = (w * 1.25) / totalDist;
  const offsetY = h * 0.78;
  const bikeX = w * 0.35;
  const isRough = LEVELS[STATE.levelIndex].road === "rough";

  // Road surface path.
  const roadPoints = [];
  for (let i = 0; i < STATE.roadPath.length; i++) {
    const node = STATE.roadPath[i];
    const sx = bikeX - (STATE.bikeDistance - node.dist) * scale;
    const sy = offsetY + node.y * scale;
    roadPoints.push({ x: sx, y: sy });
  }

  // Build the road polygon (top edge down to the bottom of the canvas).
  // The FIRST point is extended to the far-LEFT edge (x = 0) and the LAST
  // point to the far-RIGHT edge (x = w). This guarantees the road surface
  // always fills the bottom of the screen — no blank gap at the start (left)
  // or at the finish (right), no matter where the camera/cursor is.
  ctx.beginPath();
  if (roadPoints.length > 0) {
    ctx.moveTo(0, roadPoints[0].y);
    for (let i = 0; i < roadPoints.length; i++) {
      ctx.lineTo(roadPoints[i].x, roadPoints[i].y);
    }
    ctx.lineTo(w, roadPoints[roadPoints.length - 1].y);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
  }

  // Fill the road.
  if (isRough) {
    // Cobblestone road: a tiled stone texture that scrolls with the bike so
    // the whole surface reads as a dense, fully-covered stone road.
    const pat = ctx.createPattern(stoneTile, "repeat");
    const m = new DOMMatrix();
    const pOff = -((STATE.bikeDistance * scale) % stoneTile.width);
    m.translateSelf(pOff, 0);
    pat.setTransform(m);
    ctx.fillStyle = pat;
  } else {
    ctx.fillStyle = "#3A3D42"; // clean asphalt for smooth roads
  }
  ctx.fill();

  // Road top edge.
  ctx.strokeStyle = "#4A4D52";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < roadPoints.length; i++) {
    if (i === 0) ctx.moveTo(roadPoints[i].x, roadPoints[i].y);
    else ctx.lineTo(roadPoints[i].x, roadPoints[i].y);
  }
  ctx.stroke();

  // Dashed lane markers (smooth roads only — they'd look wrong on cobblestones).
  if (!isRough) {
    ctx.strokeStyle = "#F4E8C1";
    ctx.lineWidth = 4;
    ctx.setLineDash([25, 25]);
    ctx.beginPath();
    for (let i = 0; i < roadPoints.length; i++) {
      const y = roadPoints[i].y + 18;
      if (i === 0) ctx.moveTo(roadPoints[i].x, y);
      else ctx.lineTo(roadPoints[i].x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Finish line.
  const finishX = bikeX + (totalDist - STATE.bikeDistance) * scale;
  if (finishX > -50 && finishX < w + 50) {
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(finishX, offsetY - 120);
    ctx.lineTo(finishX, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FINISH", finishX, offsetY - 135);
  }

  // Start line (distance 0 — at the far left when the level begins).
  const startX = roadPoints.length > 0 ? roadPoints[0].x : bikeX;
  if (startX > -50 && startX < w + 50) {
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(startX, offsetY - 120);
    ctx.lineTo(startX, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("START", startX, offsetY - 135);
  }

  return { bikeX, offsetY, scale, roadPoints };
}

function drawBike(x, y, angle, scale, color, isLeaning, isPlayer) {
  const s = scale * (isPlayer ? 1 : 0.6);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);

  // Wheels.
  ctx.strokeStyle = "#1A1A1A";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-22, 0, 10, 0, Math.PI * 2);
  ctx.arc(22, 0, 10, 0, Math.PI * 2);
  ctx.stroke();

  // Triangular frame.
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-22, 0);   // rear wheel
  ctx.lineTo(0, -18);   // seat
  ctx.lineTo(22, 0);    // front wheel
  ctx.closePath();
  ctx.stroke();

  // Handlebars / stem.
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(8, -26);
  ctx.stroke();

  // Rider.
  ctx.strokeStyle = "#1A1A1A";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  if (isLeaning) {
    // Leaning forward: body angled forward, head low.
    ctx.beginPath();
    ctx.moveTo(0, -18);   // seat
    ctx.lineTo(10, -36);  // back
    ctx.lineTo(22, -30);  // head area
    ctx.stroke();
    // Head.
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.arc(24, -30, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Normal position.
    ctx.beginPath();
    ctx.moveTo(0, -18);   // seat
    ctx.lineTo(2, -40);  // back
    ctx.lineTo(14, -26); // arms toward handlebars
    ctx.stroke();
    // Head.
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.arc(4, -46, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function updateNPCs(dt) {
  for (const n of STATE.npcs) {
    // Re-pick a target speed every 1.5–4 s. The top end (35) is ABOVE the
    // player's comfortable cruising speed, so a rival can genuinely pull ahead.
    n.retarget -= dt;
    if (n.retarget <= 0) {
      n.target = 10 + Math.random() * 25;          // 10..35 km/h
      n.retarget = 1.5 + Math.random() * 2.5;     // next re-pick in 1.5..4 s
    }
    // Ease current speed toward the target. Because both ends stay in
    // [10,35], the eased value can never leave that range (convex combo).
    n.speed += (n.target - n.speed) * Math.min(1, 1.5 * dt);

    // Auto-jump: start a hop when the next obstacle is close enough that the
    // jump (JUMP_DUR) will still be airborne as the NPC reaches it. Uses the
    // EFFECTIVE approach speed (× DISTANCE_RATE), since that is how fast the
    // bike actually closes on the hurdle.
    const ve = (n.speed / 3.6) * DISTANCE_RATE; // effective m/s
    if (!n.jump) {
      for (const o of STATE.obstacles) {
        const remaining = o.dist - n.dist;
        if (remaining > 0.3 && remaining <= ve * JUMP_DUR * JUMP_TRIGGER) {
          n.jump = { t: 0 };
          break;
        }
      }
    }
    if (n.jump) {
      n.jump.t += dt;
      if (n.jump.t >= JUMP_DUR) n.jump = null;
    }

    // Advance along the road (km/h → m/s), matching the player's DISTANCE_RATE.
    if (n.dist < STATE.totalDistance) {
      n.dist += (n.speed / 3.6) * dt * DISTANCE_RATE;
      if (n.dist > STATE.totalDistance) n.dist = STATE.totalDistance;
    }
  }
}

function drawNPCs(offsetY, scale) {
  const w = canvas.width;
  const bikeX = w * 0.35;

  for (const n of STATE.npcs) {
    if (n.dist > STATE.totalDistance) continue; // off the map

    const theta = Math.atan(getInclineAtDistance(STATE.roadPath, n.dist) * ROAD_EXAG);
    const surfaceY = offsetY + roadYAt(STATE.roadPath, n.dist) * scale;
    const R = 10; // SAME wheel radius as the player (singleplayer NPCs match its size)
    // Same along-road position & height as the player (lane 0 ⇒ no vertical lift).
    let sx = bikeX + (n.dist - STATE.bikeDistance) * scale + R * Math.sin(theta);
    let sy = surfaceY - R * Math.cos(theta);
    // Hop arc while jumping (matches the player's jump shape).
    if (n.jump) {
      const hop = JUMP_HEIGHT * Math.sin(Math.PI * Math.min(1, n.jump.t / JUMP_DUR));
      sy -= hop;
    }
    // isPlayer = true ⇒ drawn at the SAME size as the player bike.
    drawBike(sx, sy, theta, 1, n.color, false, true);
  }
}

function drawObstacles(offsetY, scale) {
  const w = canvas.width;
  const bikeX = w * 0.35;
  for (let i = 0; i < STATE.obstacles.length; i++) {
    const o = STATE.obstacles[i];
    const cleared = STATE.p1.cleared[i]; // shown dimmed once the camera rider has cleared it
    const obsX = bikeX + (o.dist - STATE.bikeDistance) * scale;
    if (obsX < -40 || obsX > w + 40) continue; // off-screen
    const theta = Math.atan(getInclineAtDistance(STATE.roadPath, o.dist) * ROAD_EXAG);
    const surfaceY = offsetY + roadYAt(STATE.roadPath, o.dist) * scale;
    const H = 34;   // hurdle height
    const W = 16;   // hurdle width
    ctx.save();
    ctx.translate(obsX, surfaceY);
    ctx.rotate(theta);
    // Side posts.
    ctx.fillStyle = cleared ? "#7A7A7A" : "#E74C3C";
    ctx.fillRect(-W / 2, -H, 4, H);
    ctx.fillRect(W / 2 - 4, -H, 4, H);
    // Top bar (warning colour), dimmed once cleared.
    ctx.fillStyle = cleared ? "#9A9A9A" : "#F1C40F";
    ctx.fillRect(-W / 2, -H, W, 7);
    ctx.restore();
  }
}

// Draw one rider at its on-screen position. `lane` is a small perpendicular
// offset (0 = exactly the road height, so two riders share the SAME height);
// `dx` is a horizontal screen offset so they don't perfectly overlap.
function drawBubbles(offsetY, scale) {
  const w = canvas.width;
  const bikeX = w * 0.35;
  for (const b of STATE.bubbles) {
    if (b.popped) continue;
    const bx = bikeX + (b.dist - STATE.bikeDistance) * scale;
    if (bx < -40 || bx > w + 40) continue;
    const theta = Math.atan(getInclineAtDistance(STATE.roadPath, b.dist) * ROAD_EXAG);
    const surfaceY = offsetY + roadYAt(STATE.roadPath, b.dist) * scale;
    const cy = surfaceY - BUBBLE_AIR; // floating above the road surface
    ctx.save();
    if (b.type === "blue") {
      ctx.fillStyle = "rgba(41,128,185,0.85)";
      ctx.beginPath(); ctx.arc(bx, cy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2; ctx.stroke();
    } else {
      // Yellow mystery bubble with a "?" in the middle.
      ctx.fillStyle = "rgba(241,196,15,0.92)";
      ctx.beginPath(); ctx.arc(bx, cy, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#7d6608"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#5b4a00";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("?", bx, cy + 1);
    }
    // little highlight glint
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath(); ctx.arc(bx - 5, cy - 5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawBikeAt(bike, color, lane, dx, offsetY, scale) {
  const w = canvas.width;
  const bikeX = w * 0.35;
  const theta = Math.atan(bike.incline * ROAD_EXAG);
  const surfaceY = offsetY + roadYAt(STATE.roadPath, bike.bikeDistance) * scale;
  const R = 10;
  let sx = bikeX + (bike.bikeDistance - STATE.p1.bikeDistance) * scale + R * Math.sin(theta);
  let sy = surfaceY - R * Math.cos(theta);
  if (lane) { sx += -Math.sin(theta) * lane; sy += -Math.cos(theta) * lane; }
  if (dx) sx += dx;
  if (bike.jump) {
    const hop = JUMP_HEIGHT * Math.sin(Math.PI * Math.min(1, bike.jump.t / JUMP_DUR));
    sy -= hop;
  }
  drawBike(sx, sy, theta, 1, color, bike.position === "leaning", true);
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;

  drawBackground();
  const roadInfo = drawRoad();
  if (!roadInfo) return;

  const { bikeX, offsetY, scale } = roadInfo;

  // Rivals (singleplayer only — multiplayer uses a second human player).
  if (STATE.gameMode === "single") drawNPCs(offsetY, scale);

  // Player 1 (camera bike), exactly on the road surface (lane 0).
  drawBikeAt(STATE.p1, STATE.p1.color, 0, 0, offsetY, scale);

  // Player 2 (multiplayer): SAME height as Player 1 (lane 0) AND no
  // horizontal nudge (dx 0), so the blue bike's front tire lines up
  // exactly parallel with the orange bike's front wheel at equal distance.
  if (STATE.gameMode === "multi" && STATE.p2) {
    drawBikeAt(STATE.p2, STATE.p2.color, 0, 0, offsetY, scale);
  }

  // Hurdles on the flat sections.
  drawObstacles(offsetY, scale);

  // Air bubbles (blue = +stamina, yellow = mystery).
  drawBubbles(offsetY, scale);

  // Terrain type — top-left white box.
  const grade = Math.round(STATE.p1.incline * 100);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(20, 20, 210, 48);
  ctx.fillStyle = "#2C3E50";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    grade === 0 ? "FLAT" : (grade > 0 ? "UPHILL " : "DOWNHILL ") + Math.abs(grade) + "%",
    34, 52
  );

  // Distance label (right side).
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(w - 230, 20, 200, 48);
  ctx.fillStyle = "#2C3E50";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.floor(STATE.p1.bikeDistance)} / ${STATE.totalDistance} m`, w - 36, 52);

  // Progress bar at top.
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(30, 80, w - 60, 8);
  const progress = Math.min(1, STATE.p1.bikeDistance / STATE.totalDistance);
  ctx.fillStyle = "#27AE60";
  ctx.fillRect(30, 80, (w - 60) * progress, 8);

  // Effect toast (blue / mystery bubble feedback) for the camera rider.
  const toast = STATE.p1.toast;
  if (toast) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, 1 - (toast.t - 1.5) / 1.0));
    ctx.fillStyle = toast.color;
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(toast.text, w / 2, 150);
    ctx.restore();
  }
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastFrame) / 1000, 0.1);
  lastFrame = timestamp;

  updatePhysics(dt);
  updateDashboard();
  draw();

  requestAnimationFrame(gameLoop);
}

function toggleStart() {
  ensureAudio();
  if (STATE.finished) {
    loadLevel(STATE.levelIndex);
    STATE.running = true;
    ui.startBtn.textContent = "Pause";
  } else {
    STATE.running = !STATE.running;
    ui.startBtn.textContent = STATE.running ? "Pause" : "Resume";
  }
  lastFrame = performance.now();
}

function setGear(bike, u, newGear) {
  if (newGear < MIN_GEAR) newGear = MIN_GEAR;
  if (newGear > MAX_GEAR) newGear = MAX_GEAR;
  bike.gear = newGear;
  u.gearValue.textContent = bike.gear;
}

function togglePosition(bike, u) {
  bike.position = bike.position === "normal" ? "leaning" : "normal";
  u.positionBtn.textContent = bike.position === "normal" ? "Normal" : "Leaning Forward";
  u.positionBtn.dataset.value = bike.position;
}

// Keyboard-driven setters keep the sliders and HUD in sync.
function setPedal(bike, u, v) {
  v = Math.max(0, Math.min(120, Math.round(v)));
  bike.pedalSpeed = v;
  u.pedalSlider.value = v;
  updateDashboard();
}
function setPower(bike, u, v) {
  v = Math.max(0, Math.min(100, Math.round(v)));
  bike.powerOutput = v;
  u.powerSlider.value = v;
  updateDashboard();
}

ui.startBtn.addEventListener("click", toggleStart);
ui.restartBtn.addEventListener("click", () => loadLevel(STATE.levelIndex));

// Player 1 input bindings.
ui.pedalSlider.addEventListener("input", (e) => {
  setPedal(STATE.p1, ui, parseInt(e.target.value, 10));
});
ui.powerSlider.addEventListener("input", (e) => {
  setPower(STATE.p1, ui, parseInt(e.target.value, 10));
});
ui.positionBtn.addEventListener("click", () => togglePosition(STATE.p1, ui));
ui.gearUp.addEventListener("click", () => setGear(STATE.p1, ui, STATE.p1.gear + 1));
ui.gearDown.addEventListener("click", () => setGear(STATE.p1, ui, STATE.p1.gear - 1));

// Player 2 input bindings (multiplayer). Guarded so they are inert in singleplayer.
function guardP2(cb) { if (STATE.gameMode === "multi" && STATE.p2) cb(); }
ui.p2.pedalSlider.addEventListener("input", (e) => {
  guardP2(() => setPedal(STATE.p2, ui.p2, parseInt(e.target.value, 10)));
});
ui.p2.powerSlider.addEventListener("input", (e) => {
  guardP2(() => setPower(STATE.p2, ui.p2, parseInt(e.target.value, 10)));
});
ui.p2.positionBtn.addEventListener("click", () => guardP2(() => togglePosition(STATE.p2, ui.p2)));
ui.p2.gearUp.addEventListener("click", () => guardP2(() => setGear(STATE.p2, ui.p2, STATE.p2.gear + 1)));
ui.p2.gearDown.addEventListener("click", () => guardP2(() => setGear(STATE.p2, ui.p2, STATE.p2.gear - 1)));

ui.levelBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const lv = parseInt(btn.dataset.level, 10);
    if (lv > maxUnlockedLevel) return; // locked — must clear the previous level first
    loadLevel(lv);
  });
});

window.addEventListener("keydown", (e) => {
  const mode = STATE.gameMode;
  const p1 = STATE.p1, p2 = STATE.p2;
  const U1 = ui, U2 = ui.p2;

  // Start / pause (both modes).
  if (e.key === "Enter") { toggleStart(); return; }

  // ---- Player 1 ----
  if (e.key === "w" || e.key === "W") setPedal(p1, U1, p1.pedalSpeed + 3);
  if (e.key === "s" || e.key === "S") setPedal(p1, U1, p1.pedalSpeed - 3);
  if (e.key === "a" || e.key === "A") setPower(p1, U1, p1.powerOutput + 3);
  if (e.key === "d" || e.key === "D") setPower(p1, U1, p1.powerOutput - 3);

  // Player 1 jump = Space (both modes).
  if (e.key === " ") {
    e.preventDefault();
    if (STATE.running && !STATE.finished && !p1.jump) {
      p1.jump = { t: 0 };
      p1.stamina = Math.max(0, p1.stamina - JUMP_COST);
    }
  }

  if (mode === "single") {
    // Singleplayer P1: P = position; gears via 1-8, [ ], arrows.
    if (e.key === "p" || e.key === "P") togglePosition(p1, U1);
    if (e.key === "ArrowUp" || e.key === "]") setGear(p1, U1, p1.gear + 1);
    if (e.key === "ArrowDown" || e.key === "[") setGear(p1, U1, p1.gear - 1);
    if (e.key >= "1" && e.key <= "8") setGear(p1, U1, parseInt(e.key, 10));
  } else {
    // Multiplayer P1: Q = position, E/R = gears. 1-8 are DISABLED here
    // (they only work in singleplayer).
    if (e.key === "q" || e.key === "Q") togglePosition(p1, U1);
    if (e.key === "e" || e.key === "E") setGear(p1, U1, p1.gear + 1);
    if (e.key === "r" || e.key === "R") setGear(p1, U1, p1.gear - 1);
  }

  // ---- Player 2 (multiplayer only) ----
  if (mode === "multi" && p2) {
    if (e.key === "i" || e.key === "I") setPedal(p2, U2, p2.pedalSpeed + 3);
    if (e.key === "k" || e.key === "K") setPedal(p2, U2, p2.pedalSpeed - 3);
    if (e.key === "j" || e.key === "J") setPower(p2, U2, p2.powerOutput + 3);
    if (e.key === "l" || e.key === "L") setPower(p2, U2, p2.powerOutput - 3);
    if (e.key === "p" || e.key === "P") togglePosition(p2, U2);
    if (e.key === "-") setGear(p2, U2, p2.gear - 1);
    if (e.key === "=") setGear(p2, U2, p2.gear + 1);
    if (e.key === "o" || e.key === "O") {
      if (STATE.running && !STATE.finished && !p2.jump) {
        p2.jump = { t: 0 };
        p2.stamina = Math.max(0, p2.stamina - JUMP_COST);
      }
    }
  }
});

// --- Homepage / mode selection --------------------------------------------
function chooseMode(mode) {
  STATE.gameMode = mode;
  if (mode === "multi") {
    if (!STATE.p2) STATE.p2 = makeBike("#3498DB", true);
    document.body.classList.add("multi");
    document.getElementById("p2panel").classList.remove("hidden");
    document.getElementById("p1hint").textContent =
      "Keys: W/S pedal, A/D power, Q position, E/R gears, Space jump.";
  } else {
    STATE.p2 = null;
    document.body.classList.remove("multi");
    document.getElementById("p2panel").classList.add("hidden");
    document.getElementById("p1hint").textContent =
      "Keys: W/S pedal, A/D power, P position, 1-8 gears, Space jump.";
  }
  document.getElementById("homepage").classList.add("hidden");
  document.getElementById("gameArea").classList.remove("hidden");
  loadLevel(STATE.levelIndex);
}

function backToMenu() {
  STATE.running = false;
  STATE.finished = false;
  stopHeartbeat();
  document.getElementById("homepage").classList.remove("hidden");
  document.getElementById("gameArea").classList.add("hidden");
}

document.getElementById("singleBtn").addEventListener("click", () => chooseMode("single"));
document.getElementById("multiBtn").addEventListener("click", () => chooseMode("multi"));
document.getElementById("menuBtn").addEventListener("click", backToMenu);

// Initial load (homepage is shown on top; gameplay starts after a mode is chosen).
loadLevel(0);
requestAnimationFrame(gameLoop);
