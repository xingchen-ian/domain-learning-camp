/* =====================================================================
 *  Sailer Game  —  first playable web build
 *  Track A: plain JS + Canvas 2D. No build step, no external libs.
 *  --------------------------------------------------------------------
 *  This file is intentionally kept linear and well-commented so a
 *  high-school student can read it top-to-bottom and follow how
 *  wind + sail + boat angle turn into motion.
 * ===================================================================== */

/* ---------- Canvas / view setup ---------- */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// Logical play-area size. The actual canvas is scaled to fit the
// browser window while keeping the 16:9 ratio (see resize()).
const VIEW_W = 1600;
const VIEW_H = 900;

function resize() {
  // Fit the canvas inside the window while keeping the 16:9 aspect.
  const ratio = VIEW_W / VIEW_H;
  let w = window.innerWidth - 360;     // leave room for the right HUD
  let h = window.innerHeight - 40;
  if (w / h > ratio) w = h * ratio;   // too wide → shrink by height
  else h = w / ratio;                 // too tall → shrink by width
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width = Math.max(640, w) + 'px';
  canvas.style.height = Math.max(360, h) + 'px';
}
window.addEventListener('resize', resize);

/* ---------- Math helpers ---------- */

function wrapAngle(a) {
  // Wrap any angle to (-PI, PI].
  while (a >  Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max) { return min + Math.random() * (max - min); }

/* ---------- Levels (challenge presets from the system graph) ----------
 * The graph lists three presets. Each preset changes system variables
 * (wind direction, time limit, number of rocks), not just visuals.
 * --------------------------------------------------------------------- */

const LEVELS = [
  {
    name: 'Level 1 — Crosswind Basics',
    blurb: 'Reach the target. Wind blows across your path — point the boat across the wind for full speed.',
    windDir: Math.PI / 2,       // wind blowing south (perpendicular to the east-bound path)
    windStrength: 0.7,
    currentDir: 0,
    currentSpeed: 0,
    rocks: 0,
    timeLimit: 0,               // 0 = no time limit
    start:  { x: 200,  y: 450 },
    target: { x: 1400, y: 450 },
  },
  {
    name: 'Level 2 — Headwind & Time',
    blurb: 'The wind blows from the target. You must tack — sail to one side, turn through the wind, repeat. Time is limited.',
    windDir: Math.PI,           // wind blowing west (against the east-bound target)
    windStrength: 0.8,
    currentDir: 0,
    currentSpeed: 0,
    rocks: 0,
    timeLimit: 70,              // seconds
    start:  { x: 200,  y: 450 },
    target: { x: 1400, y: 450 },
  },
  {
    name: 'Level 3 — Rock Field',
    blurb: 'Crosswind, time pressure, and 6 rocks. Plan your route before you commit.',
    windDir: Math.PI / 2,       // wind blowing south (crosswind to the diagonal path)
    windStrength: 0.9,
    currentDir: 0,
    currentSpeed: 0,
    rocks: 6,
    timeLimit: 110,
    start:  { x: 200,  y: 200 },
    target: { x: 1400, y: 700 },
  },
];

/* ---------- Game state ---------- */

const STATE = { MENU: 'menu', PLAY: 'play', WIN: 'win', LOSE: 'lose' };
let state = STATE.MENU;
let levelIndex = 0;            // 0..2

const boat = {
  x: 200, y: 450,
  heading: 0,                  // radians, 0 = east, PI/2 = south
  vx: 0, vy: 0,
  sailAngle: 0,                // sail angle relative to boat keel, 0 = aligned
  health: 100,
  maxHealth: 100,
  heel: 0,                     // visual lean, 0 = upright, ±1 = full lean
};

let wind   = { dir: 0, strength: 0.7 };
let waterC = { dir: 0, speed: 0 };
let rocks  = [];
let target = { x: 1400, y: 450 };
let timeLimit = 0;
let timeLeft = 0;              // counts down; -1 = no limit
let levelTime = 0;             // total time spent in this attempt

const keys = Object.create(null);
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ' || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

/* ---------- Audio (Web Audio API, no external files) ---------- */

let audioCtx = null;
let flapGain = null;
let waterGain = null;
function ensureAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Sail flap = band-passed white noise (a soft flutter).
    const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer = noiseBuf; noiseSrc.loop = true;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.4;
    flapGain = audioCtx.createGain(); flapGain.gain.value = 0;
    noiseSrc.connect(bp).connect(flapGain).connect(audioCtx.destination);
    noiseSrc.start();

    // Water / wake = low pink-ish noise modulated by boat speed.
    const waterSrc = audioCtx.createBufferSource();
    waterSrc.buffer = noiseBuf; waterSrc.loop = true;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 0.7;
    waterGain = audioCtx.createGain(); waterGain.gain.value = 0;
    waterSrc.connect(lp).connect(waterGain).connect(audioCtx.destination);
    waterSrc.start();
  } catch (err) {
    audioCtx = null; // Browser blocked audio. The game still works.
  }
}
function setFlapVolume(v) { if (flapGain) flapGain.gain.value = v; }
function setWaterVolume(v) { if (waterGain) waterGain.gain.value = v; }

/* ---------- Level loading ---------- */

function loadLevel(idx) {
  levelIndex = idx;
  const L = LEVELS[idx];
  boat.x = L.start.x; boat.y = L.start.y;
  boat.heading = 0;
  boat.vx = 0; boat.vy = 0;
  boat.sailAngle = 0;
  boat.health = boat.maxHealth;
  boat.heel = 0;
  wind.dir = L.windDir; wind.strength = L.windStrength;
  waterC.dir = L.currentDir; waterC.speed = L.currentSpeed;
  target.x = L.target.x; target.y = L.target.y;
  timeLimit = L.timeLimit;
  timeLeft = L.timeLimit > 0 ? L.timeLimit : -1;
  levelTime = 0;

  // Place rocks in safe spots (not on start, not on target, not on each other).
  rocks = [];
  let tries = 0;
  while (rocks.length < L.rocks && tries < 400) {
    tries++;
    const r = { x: rand(260, VIEW_W - 260), y: rand(120, VIEW_H - 120), r: 28 };
    if (Math.hypot(r.x - boat.x, r.y - boat.y) < 120) continue;
    if (Math.hypot(r.x - target.x, r.y - target.y) < 120) continue;
    if (rocks.some((o) => Math.hypot(o.x - r.x, o.y - r.y) < 90)) continue;
    rocks.push(r);
  }
  state = STATE.PLAY;
}

/* ---------- Physics ----------
 * The boat does NOT move in the direction it is pointed. The wind
 * pushes the sail; only the component of that push along the boat's
 * heading turns into forward motion. Sailing directly into the wind
 * is impossible (the "no-go zone").
 * --------------------------------------------------------------------- */

const TURN_RATE       = 1.4;   // rad / sec when holding A or D
const SAIL_TRIM_RATE  = 0.9;   // rad / sec when holding W or S
const NO_GO_ANGLE     = Math.PI / 5;  // 36° on each side of the wind
const MAX_BOAT_SPEED  = 230;   // px / sec at full efficiency

function update(dt) {
  if (state !== STATE.PLAY) return;

  // --- Player input: turn the boat, trim the sail.
  if (keys['a']) boat.heading -= TURN_RATE * dt;
  if (keys['d']) boat.heading += TURN_RATE * dt;
  if (keys['w']) boat.sailAngle += SAIL_TRIM_RATE * dt;
  if (keys['s']) boat.sailAngle -= SAIL_TRIM_RATE * dt;
  boat.heading = wrapAngle(boat.heading);
  boat.sailAngle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, boat.sailAngle));

  // --- Wind & sail → forward thrust.
  // R is the angle of the WIND VELOCITY relative to the boat's heading.
  //   R = 0    → wind is blowing the same way the boat is pointing
  //              (dead downwind — wind is pushing from behind).
  //   R = ±PI  → wind is blowing opposite to the boat
  //              (the wind is hitting the bow → no-go zone).
  //   R = ±PI/2→ wind is on the beam (the fastest point of sail).
  const R = wrapAngle(wind.dir - boat.heading);
  const absR = Math.abs(R);

  // Sail efficiency peaks when the sail is perpendicular to the wind
  // direction in the boat's frame (sin(±PI/2) = 1).
  const sailToWind = wrapAngle(boat.sailAngle - R);
  const sailEff = Math.abs(Math.sin(sailToWind));

  // The boat is in the no-go zone when the wind is hitting close to
  // dead ahead. In our convention that is |R| close to PI, not 0.
  const inNoGo = absR > Math.PI - NO_GO_ANGLE;

  let forward = 0;
  if (!inNoGo) {
    // Speed model:
    //   sin(|R|)  peaks at beam reach (|R|=PI/2), zero at downwind (|R|=0).
    // We add a constant so the boat still makes some progress downwind —
    // a real boat can run before the wind, just slower than a beam reach.
    // The whole expression is smoothly scaled by the no-go falloff, so
    // there is no harsh step at the no-go boundary.
    const noGoFalloff = Math.min(1, (Math.PI - absR) / NO_GO_ANGLE);
    const speedShape  = 0.35 + 0.65 * Math.sin(absR);
    forward = MAX_BOAT_SPEED * speedShape * sailEff * wind.strength * noGoFalloff;
  }

  // The thrust direction is the boat's heading, but the sign follows
  // the side the sail is trimmed to (sail on the right → push to the
  // left of the wind, etc.). In this simplified model we keep the
  // boat moving in the direction it is pointed.
  let ax = Math.cos(boat.heading) * forward;
  let ay = Math.sin(boat.heading) * forward;

  // --- Water current adds a constant velocity.
  if (waterC.speed > 0) {
    ax += Math.cos(waterC.dir) * waterC.speed * 30;
    ay += Math.sin(waterC.dir) * waterC.speed * 30;
  }

  // --- Simple drag so the boat does not accelerate forever.
  boat.vx = lerp(boat.vx, ax, 1 - Math.exp(-dt * 2.5));
  boat.vy = lerp(boat.vy, ay, 1 - Math.exp(-dt * 2.5));

  boat.x += boat.vx * dt;
  boat.y += boat.vy * dt;

  // Visual heel: how sideways the wind is hitting the boat.
  const targetHeel = -Math.sin(R) * 0.6 * wind.strength;
  boat.heel = lerp(boat.heel, targetHeel, 1 - Math.exp(-dt * 3));

  // --- Rock collisions.
  for (const r of rocks) {
    if (Math.hypot(r.x - boat.x, r.y - boat.y) < r.r + 14) {
      boat.health -= 18;
      // Bounce the boat a little.
      const dx = boat.x - r.x, dy = boat.y - r.y;
      const d = Math.hypot(dx, dy) || 1;
      boat.x = r.x + (dx / d) * (r.r + 15);
      boat.y = r.y + (dy / d) * (r.r + 15);
      boat.vx *= -0.3; boat.vy *= -0.3;
    }
  }
  boat.health = Math.max(0, Math.min(boat.maxHealth, boat.health));

  // --- Time + win / lose.
  levelTime += dt;
  if (timeLimit > 0) {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; lose(); }
  }
  if (boat.health <= 0) lose();
  if (Math.hypot(target.x - boat.x, target.y - boat.y) < 38) win();

  // --- Audio feedback.
  // Sail flap volume: loud when in the no-go zone OR when the sail is
  // aligned with the wind (no efficiency).
  const flapAmount = inNoGo ? 0.6 : (1 - sailEff) * 0.35;
  setFlapVolume(flapAmount);
  const speed = Math.hypot(boat.vx, boat.vy);
  setWaterVolume(Math.min(0.25, speed / MAX_BOAT_SPEED * 0.25));
}

/* ---------- Win / lose ---------- */

function win()  { state = STATE.WIN;  setFlapVolume(0); }
function lose() { state = STATE.LOSE; setFlapVolume(0); }

/* ---------- Drawing ---------- */

function drawWater() {
  // Soft blue gradient with a few wave ripples — kept simple.
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#9bcfe8');
  g.addColorStop(1, '#5a9fc4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  for (let y = 0; y < VIEW_H; y += 60) {
    ctx.beginPath();
    for (let x = 0; x < VIEW_W; x += 20) {
      const yy = y + Math.sin((x + levelTime * 40) * 0.02) * 4;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

function drawWindArrow() {
  // Big, obvious wind indicator in the top-left of the play area.
  const cx = 80, cy = 80, R = 50;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(0, 0, R + 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#345a78'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();

  // The arrow points in the direction the wind is going TO.
  ctx.rotate(wind.dir);
  ctx.fillStyle = '#345a78';
  ctx.beginPath();
  ctx.moveTo(R - 6, 0);
  ctx.lineTo(-R + 10, 14);
  ctx.lineTo(-R + 4, 0);
  ctx.lineTo(-R + 10, -14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#1f3a4d';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WIND', cx, cy + R + 22);
}

function drawRocks() {
  for (const r of rocks) {
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath(); ctx.arc(r.x - 6, r.y - 6, r.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawTarget() {
  // A floating buoy: a ring + a flag pole.
  const t = target;
  ctx.save();
  ctx.translate(t.x, t.y);
  // Outer ring
  ctx.strokeStyle = '#ff7a3a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 26 + Math.sin(levelTime * 3) * 3, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffb489';
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  // Flag pole
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -32); ctx.stroke();
  ctx.fillStyle = '#ff5a2a';
  ctx.beginPath();
  ctx.moveTo(0, -32); ctx.lineTo(20, -25); ctx.lineTo(0, -18);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBoat() {
  // Boat = hull triangle + sail line.
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.heading);
  ctx.scale(1, 1 + boat.heel * 0.2);

  // Hull
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-16, 11);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-16, -11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Mast
  ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke();

  // Sail — drawn as a filled triangle that flaps when inefficient.
  const flap = Math.abs(boat.sailAngle - wrapAngle(wind.dir - boat.heading));
  const flapK = Math.max(0, Math.sin(levelTime * 30) * Math.min(1, (Math.PI - flap) / Math.PI));
  ctx.save();
  ctx.rotate(-boat.sailAngle);
  ctx.fillStyle = 'rgba(240,240,255,' + (0.65 + flapK * 0.3) + ')';
  ctx.strokeStyle = '#4a6c8c'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(2 + flapK * 4, 0);
  ctx.lineTo(0, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawCompass() {
  // Small compass in the bottom-left so the player can read boat heading.
  const cx = 80, cy = VIEW_H - 80, R = 36;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#345a78'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  ctx.rotate(boat.heading);
  ctx.fillStyle = '#1f3a4d';
  ctx.beginPath();
  ctx.moveTo(R - 4, 0); ctx.lineTo(-R + 6, 7); ctx.lineTo(-R + 6, -7);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#1f3a4d';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BOAT', cx, cy + R + 16);
}

function drawHUD() {
  // Right-side panel drawn in HTML (see index.html). Nothing here.
}

function drawOverlay() {
  if (state === STATE.MENU)  return;  // the HTML menu is shown instead
  if (state === STATE.PLAY)  return;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  if (state === STATE.WIN) {
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('You reached the target!', VIEW_W / 2, VIEW_H / 2 - 30);
    ctx.font = '24px sans-serif';
    ctx.fillText('Boat health > 0  •  Game time > 0', VIEW_W / 2, VIEW_H / 2 + 10);
    ctx.fillText('Press N for the next level, or R to replay.', VIEW_W / 2, VIEW_H / 2 + 50);
  } else {
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('Game Over', VIEW_W / 2, VIEW_H / 2 - 30);
    ctx.font = '24px sans-serif';
    ctx.fillText('Press R to try again.', VIEW_W / 2, VIEW_H / 2 + 10);
  }
}

function render() {
  drawWater();
  drawWindArrow();
  drawRocks();
  drawTarget();
  drawBoat();
  drawCompass();
  drawOverlay();
}

/* ---------- Main loop ---------- */

let lastT = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (state === STATE.PLAY) update(dt);
  render();
  // Update the HTML HUD every frame.
  updateHud();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- HUD (HTML) ---------- */

function el(id) { return document.getElementById(id); }
function deg(r) { return Math.round((r * 180 / Math.PI + 360) % 360) + '°'; }

function updateHud() {
  const L = LEVELS[levelIndex];
  if (el('hud-level'))  el('hud-level').textContent  = L.name;
  if (el('hud-blurb'))  el('hud-blurb').textContent  = L.blurb;
  if (el('hud-wind'))   el('hud-wind').textContent   = deg(wind.dir);
  if (el('hud-winds'))  el('hud-winds').textContent  = (wind.strength).toFixed(2);
  if (el('hud-curd'))   el('hud-curd').textContent   = waterC.speed > 0 ? deg(waterC.dir) : '—';
  if (el('hud-curs'))   el('hud-curs').textContent   = waterC.speed.toFixed(2);
  if (el('hud-rocks'))  el('hud-rocks').textContent  = String(rocks.length);
  if (el('hud-time')) {
    if (timeLimit > 0) {
      const s = Math.max(0, timeLeft).toFixed(1);
      el('hud-time').textContent = s + 's';
    } else {
      el('hud-time').textContent = levelTime.toFixed(1) + 's';
    }
  }
  if (el('hud-health')) {
    el('hud-health').textContent = Math.round(boat.health) + ' / ' + boat.maxHealth;
    el('hud-health-bar').style.width = (boat.health / boat.maxHealth * 100).toFixed(0) + '%';
    el('hud-health-bar').style.background = boat.health > 40 ? '#5cc177' : '#e3603a';
  }
  if (el('hud-heading')) el('hud-heading').textContent = deg(boat.heading);
  if (el('hud-sail'))    el('hud-sail').textContent    = deg(boat.sailAngle);
  if (el('hud-speed'))   el('hud-speed').textContent   = Math.round(Math.hypot(boat.vx, boat.vy)) + ' px/s';

  const R = wrapAngle(wind.dir - boat.heading);
  const absR = Math.abs(R);
  const inNoGo = absR < NO_GO_ANGLE || absR > Math.PI - NO_GO_ANGLE;
  if (el('hud-nogo')) el('hud-nogo').style.opacity = inNoGo ? '1' : '0.25';
  if (el('hud-tip')) {
    if (state === STATE.PLAY) {
      if (inNoGo) el('hud-tip').textContent = '⚠ No-go zone — turn away from the wind.';
      else if (Math.abs(Math.sin(wrapAngle(boat.sailAngle - R))) < 0.2)
        el('hud-tip').textContent = 'Trim the sail (W/S) to catch the wind better.';
      else el('hud-tip').textContent = 'Hold your course — keep an eye on the wind arrow.';
    } else {
      el('hud-tip').textContent = '';
    }
  }
}

/* ---------- UI buttons (Start / Restart / Next) ---------- */

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'r' && (state === STATE.WIN || state === STATE.LOSE)) {
    loadLevel(levelIndex);
  }
  if (k === 'n' && state === STATE.WIN) {
    if (levelIndex < LEVELS.length - 1) loadLevel(levelIndex + 1);
    else loadLevel(0);
  }
});

function startLevel(i) {
  ensureAudio();
  loadLevel(i);
  document.getElementById('menu').style.display = 'none';
}

// Expose to inline onclick handlers in the HTML.
window.startLevel = startLevel;
window.loadLevel  = loadLevel;

// Initial HUD render so the panel is not empty on the menu.
updateHud();
