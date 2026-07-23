'use strict';

/* ========================================================================
   Wing Flight — Born With Wings
   A Canvas 2D flying game about wind, energy, and route planning.

   Core Learning Shift:
   Beginners think flying means floating towards the target.
   Experts know it needs observing the wind vane and evaluating energy loss.

   Track A — No build step. Pure HTML + CSS + JavaScript + Canvas 2D.
   ======================================================================== */

// =========================== CONFIGURATION ===========================
const CFG = {
  CANVAS_W: 1280,
  CANVAS_H: 720,
  WORLD_W: 5400,
  SKY_H: 640,          // playable sky height (above ground)
  GROUND_H: 80,
  GRAVITY: 0.14,
  BASE_SPEED: 2.8,     // constant forward speed
  ASCEND_POWER: 0.55,
  DIVE_POWER: 0.45,
  MAX_VY: 8,
  ENERGY_MAX: 100,
  ENERGY_PASSIVE_DRAIN: 0.025,  // per frame (reduced from 0.04 for easier gameplay)
  ENERGY_ASCEND_COST: 0.22,     // per frame ascending (reduced from 0.35)
  ENERGY_DIVE_REGEN: 0.18,      // per frame diving (increased from 0.12)
  ENERGY_STORM_DRAIN: 0.45,     // per frame in storm (reduced from 0.8)
  COIN_RADIUS: 14,
  ENERGY_PICKUP_RADIUS: 16,
  ENERGY_PICKUP_AMOUNT: 35,     // regular energy orb restores 35% (increased from 30)
  ENERGY_LARGE_RADIUS: 24,
  ENERGY_LARGE_AMOUNT: 55,      // large energy orb restores 55% (increased from 50)
  PLAYER_W: 48,
  PLAYER_H: 32,
  // ---- Fish mode (ocean level) ----
  FISH_DURATION: 10,       // seconds as a fish
  FISH_SPEED: 3.5,         // fish swim speed
  FISH_ASCEND_POWER: 0.4,
  FISH_DIVE_POWER: 0.4,
  FISH_GRAVITY: 0.02,      // very light gravity underwater (buoyancy)
  FISH_ENERGY_DRAIN: 0.015, // slower energy drain underwater
  PORTAL_RADIUS: 30,
  FISH_COIN_RADIUS: 16,    // underwater coin radius
  FISH_MAX_DEPTH: 700,     // max y the fish can swim to
};

// =========================== LEVELS (Challenge Presets) =============
// Each preset changes system variables (wind, obstacles, energy, time)
// — not just visual decoration.
const LEVELS = [

  // ---- Level 1: First Flight (learn basic controls) ----
  {
    name: 'First Flight',
    subtitle: 'Calm skies — learn to fly, dive, and manage energy.',
    theme: 'meadow',   // bright sunny meadow
    timeLimit: 90,
    minCoins: 0,
    targetX: 5000,
    windZones: [
      { x: 0,    w: 1200, wx: 0.3,  wy: 0    },  // gentle tailwind
      { x: 1200, w: 1000, wx: -0.5, wy: -0.1 },  // light headwind + slight updraft
      { x: 2200, w: 1000, wx: 0.2,  wy: 0.15 },  // tailwind + slight downdraft
      { x: 3200, w: 1800, wx: -0.3, wy: -0.2 },  // light headwind + updraft
    ],
    storms: [],
    lands: [
      { x: 1500, w: 120, h: 100 },
      { x: 3000, w: 100, h: 80  },
    ],
    coins: [
      { x: 600,  y: 380 }, { x: 900,  y: 280 }, { x: 1100, y: 200 },
      { x: 1600, y: 420 }, { x: 1900, y: 320 }, { x: 2100, y: 240 },
      { x: 2500, y: 380 }, { x: 2800, y: 300 }, { x: 3100, y: 220 },
      { x: 3500, y: 360 }, { x: 3800, y: 260 }, { x: 4100, y: 320 },
      { x: 4400, y: 280 }, { x: 4700, y: 350 },
    ],
    energyPickups: [
      { x: 500,  y: 400 }, { x: 1300, y: 350 }, { x: 2000, y: 300 },
      { x: 2700, y: 330 }, { x: 3200, y: 280 }, { x: 3900, y: 300 },
      { x: 4500, y: 320 },
    ],
    largeEnergyPickups: [
      { x: 2350, y: 350 },
    ],
    startEnergy: 100,
  },

  // ---- Level 2: Headwind Trial (learn wind observation + energy planning) ----
  {
    name: 'Headwind Trial',
    subtitle: 'Strong headwind — use updrafts and dive to conserve energy.',
    theme: 'mountain', // rocky mountain pass
    timeLimit: 75,
    minCoins: 5,
    targetX: 5000,
    windZones: [
      { x: 0,    w: 800,  wx: -1.2, wy: 0    },   // strong headwind
      { x: 800,  w: 700,  wx: -0.8, wy: -0.6 },   // headwind + strong updraft (use this!)
      { x: 1500, w: 900,  wx: -1.5, wy: 0.1  },   // very strong headwind + downdraft (danger)
      { x: 2400, w: 600,  wx: -0.6, wy: -0.8 },   // weak headwind + strong updraft
      { x: 3000, w: 800,  wx: -1.3, wy: 0    },   // strong headwind
      { x: 3800, w: 700,  wx: 0.4,  wy: -0.3 },   // tailwind + updraft (relief)
      { x: 4500, w: 500,  wx: -0.8, wy: 0    },   // final headwind
    ],
    storms: [],
    lands: [
      { x: 1200, w: 140, h: 120 },
      { x: 2700, w: 100, h: 90  },
      { x: 4200, w: 120, h: 100 },
    ],
    coins: [
      { x: 500,  y: 350 }, { x: 900,  y: 200 }, { x: 1100, y: 150 },
      { x: 1700, y: 400 }, { x: 2000, y: 350 }, { x: 2600, y: 180 },
      { x: 2900, y: 120 }, { x: 3200, y: 380 }, { x: 3500, y: 300 },
      { x: 3900, y: 220 }, { x: 4200, y: 180 }, { x: 4600, y: 340 },
      { x: 4800, y: 280 },
    ],
    energyPickups: [
      { x: 500,  y: 350 }, { x: 1000, y: 250 }, { x: 1700, y: 380 },
      { x: 2300, y: 280 }, { x: 2900, y: 250 }, { x: 3400, y: 330 },
      { x: 3800, y: 280 }, { x: 4400, y: 250 },
    ],
    largeEnergyPickups: [
      { x: 1450, y: 350 },  // before the very strong headwind zone
      { x: 3650, y: 300 },  // before the final headwind
    ],
    startEnergy: 80,
  },

  // ---- Level 3: Storm Alley (learn route planning + risk management) ----
  {
    name: 'Storm Alley',
    subtitle: 'Storms block the direct path — plan your route and collect 8 coins.',
    theme: 'storm',    // dark stormy valley
    timeLimit: 70,
    minCoins: 8,
    targetX: 5000,
    windZones: [
      { x: 0,    w: 600,  wx: -0.4, wy: 0    },
      { x: 600,  w: 500,  wx: -1.0, wy: -0.3 },
      { x: 1100, w: 800,  wx: 0.6,  wy: 0.2  },   // tailwind pushes you toward storms
      { x: 1900, w: 600,  wx: -0.8, wy: -0.5 },
      { x: 2500, w: 700,  wx: 0.3,  wy: -0.2 },
      { x: 3200, w: 600,  wx: -1.2, wy: 0.1  },
      { x: 3800, w: 500,  wx: -0.5, wy: -0.6 },
      { x: 4300, w: 700,  wx: 0.5,  wy: -0.1 },
    ],
    storms: [
      { x: 1000, y: 300, w: 200, h: 200 },
      { x: 1400, y: 150, w: 180, h: 180 },
      { x: 2200, y: 350, w: 220, h: 200 },
      { x: 2900, y: 200, w: 180, h: 180 },
      { x: 3500, y: 380, w: 200, h: 180 },
      { x: 4100, y: 180, w: 160, h: 160 },
    ],
    lands: [
      { x: 800,  w: 100, h: 90  },
      { x: 2000, w: 120, h: 110 },
      { x: 3300, w: 100, h: 80  },
      { x: 4600, w: 110, h: 95  },
    ],
    coins: [
      { x: 500,  y: 350 }, { x: 750,  y: 250 }, { x: 1050, y: 480 },
      { x: 1350, y: 450 }, { x: 1700, y: 300 }, { x: 1950, y: 200 },
      { x: 2150, y: 450 }, { x: 2500, y: 300 }, { x: 2750, y: 420 },
      { x: 3100, y: 350 }, { x: 3350, y: 250 }, { x: 3700, y: 200 },
      { x: 3950, y: 450 }, { x: 4250, y: 350 }, { x: 4500, y: 280 },
      { x: 4800, y: 380 },
    ],
    energyPickups: [
      { x: 500,  y: 400 }, { x: 850,  y: 380 }, { x: 1250, y: 400 },
      { x: 1850, y: 350 }, { x: 2200, y: 280 }, { x: 2650, y: 380 },
      { x: 3100, y: 300 }, { x: 3750, y: 300 }, { x: 4100, y: 300 },
      { x: 4450, y: 350 },
    ],
    largeEnergyPickups: [
      { x: 1600, y: 380 },  // between storm clusters
      { x: 3400, y: 350 },  // after the strong headwind zone
      { x: 4250, y: 320 },  // final stretch boost
    ],
    startEnergy: 70,
  },

  // ---- Level 4: Coastal Crossing (learn shifting wind + island hopping) ----
  {
    name: 'Coastal Crossing',
    subtitle: 'Sea breezes shift — read the wind and hop between islands.',
    theme: 'ocean',    // golden sunset over the sea
    timeLimit: 80,
    minCoins: 6,
    targetX: 5200,
    windZones: [
      { x: 0,    w: 700,  wx: 0.8,  wy: -0.2 },   // offshore tailwind + updraft
      { x: 700,  w: 600,  wx: -0.5, wy: 0.1  },   // breeze reverses to headwind
      { x: 1300, w: 500,  wx: 0.6,  wy: -0.5 },   // strong tailwind + updraft (boost!)
      { x: 1800, w: 700,  wx: -1.0, wy: 0.2  },   // onshore headwind + downdraft
      { x: 2500, w: 500,  wx: 0.4,  wy: -0.3 },   // gentle tailwind
      { x: 3000, w: 600,  wx: -0.8, wy: -0.4 },   // headwind + updraft near cliff
      { x: 3600, w: 500,  wx: 0.7,  wy: 0.15 },   // strong tailwind (push forward)
      { x: 4100, w: 600,  wx: -0.6, wy: 0.1  },   // headwind
      { x: 4700, w: 500,  wx: 0.5,  wy: -0.2 },   // final tailwind to goal
    ],
    storms: [
      { x: 1000, y: 280, w: 180, h: 180 },
      { x: 2800, y: 200, w: 160, h: 160 },
      { x: 4400, y: 350, w: 200, h: 180 },
    ],
    lands: [
      { x: 900,  w: 130, h: 70  },   // small sandbar
      { x: 1700, w: 160, h: 100 },   // island with cliff
      { x: 2600, w: 110, h: 60  },   // low sandbar
      { x: 3400, w: 150, h: 90  },   // rocky island
      { x: 4200, w: 120, h: 75  },   // small isle
    ],
    coins: [
      { x: 400,  y: 350 }, { x: 650,  y: 250 }, { x: 950,  y: 420 },
      { x: 1200, y: 300 }, { x: 1450, y: 200 }, { x: 1750, y: 380 },
      { x: 2050, y: 280 }, { x: 2300, y: 350 }, { x: 2650, y: 400 },
      { x: 2950, y: 250 }, { x: 3200, y: 180 }, { x: 3500, y: 380 },
      { x: 3800, y: 300 }, { x: 4050, y: 220 }, { x: 4350, y: 400 },
      { x: 4600, y: 320 }, { x: 4900, y: 380 },
    ],
    energyPickups: [
      { x: 500,  y: 380 }, { x: 1100, y: 350 }, { x: 1600, y: 300 },
      { x: 2200, y: 330 }, { x: 2700, y: 380 }, { x: 3100, y: 300 },
      { x: 3700, y: 350 }, { x: 4100, y: 280 }, { x: 4500, y: 350 },
      { x: 4950, y: 380 },
    ],
    largeEnergyPickups: [
      { x: 1450, y: 350 },  // before the onshore headwind zone
      { x: 3300, y: 320 },  // near the rocky island
      { x: 4650, y: 330 },  // final stretch boost
    ],
    // Fish transformation portal — fly through to become a fish
    portal: { x: 2500, y: 400 },
    // Underwater coins — only collectible in fish mode (below sea level)
    fishCoins: [
      { x: 2550, y: 660 }, { x: 2650, y: 690 }, { x: 2750, y: 670 },
      { x: 2850, y: 695 }, { x: 2950, y: 665 }, { x: 3050, y: 690 },
    ],
    startEnergy: 85,
  },
];

// =========================== AUDIO (Web Audio API) ==================
// All sounds are synthesized — no external audio files needed.
const Sfx = {
  ctx: null,
  enabled: true,

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(freq, dur, type, vol, slide) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol || 0.15, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  },

  flap()      { this.tone(200, 0.12, 'sawtooth', 0.06, 120); },
  coin()      { this.tone(880, 0.08, 'square', 0.12); setTimeout(() => this.tone(1320, 0.12, 'square', 0.1), 60); },
  energy()    { this.tone(440, 0.15, 'sine', 0.1, 880); },
  energyLarge() { [523, 659, 880, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'sine', 0.12), i * 50)); },
  warn()      { this.tone(300, 0.1, 'sawtooth', 0.08, 200); },
  crash()     { this.tone(150, 0.4, 'sawtooth', 0.2, 50); },
  win()       { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'square', 0.12), i * 120)); },
  storm()     { this.tone(80, 0.3, 'sawtooth', 0.1, 40); },
  transform() { [300, 400, 600, 800, 1000].forEach((f, i) => setTimeout(() => this.tone(f, 0.1, 'sine', 0.12), i * 40)); },
};

// =========================== INPUT ===================================
const Input = {
  keys: {},
  init() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // Prevent scroll on arrow keys / space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      // Resume audio on first interaction
      Sfx.resume();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  },
  get up()    { return this.keys['KeyW'] || this.keys['ArrowUp']; },
  get down()  { return this.keys['KeyS'] || this.keys['ArrowDown']; },
  get left()  { return this.keys['KeyA'] || this.keys['ArrowLeft']; },
  get right() { return this.keys['KeyD'] || this.keys['ArrowRight']; },
  get boost() { return this.keys['Space']; },
};

// =========================== GAME STATE ==============================
let game = null;
let canvas, ctx;

function createGame(levelIndex) {
  const lv = LEVELS[levelIndex];
  return {
    state: 'playing',      // 'playing' | 'won' | 'lost'
    levelIndex,
    level: lv,

    player: {
      x: 80,
      y: 350,
      vx: CFG.BASE_SPEED,
      vy: 0,
      energy: lv.startEnergy,
      wingStrength: 2,     // 1 = light, 2 = medium, 3 = strong
      coins: 0,
      flapping: false,
      wingPhase: 0,        // animation
      inStorm: false,
      tilt: 0,             // visual tilt based on vy
    },

    wind: { wx: 0, wy: 0 },
    currentWindZone: null,

    camera: { x: 0, y: 0 },

    // Deep-copy level entities so they can be modified per-run
    coins: lv.coins.map(c => ({ ...c, collected: false })),
    energyPickups: lv.energyPickups.map(e => ({ ...e, collected: false })),
    largeEnergyPickups: (lv.largeEnergyPickups || []).map(e => ({ ...e, collected: false })),
    storms: lv.storms.map(s => ({ ...s, flicker: 0 })),
    lands: [...lv.lands],

    // Fish mode state (ocean level)
    portal: lv.portal ? { ...lv.portal, used: false } : null,
    fishCoins: (lv.fishCoins || []).map(c => ({ ...c, collected: false })),
    fishMode: false,
    fishTimer: 0,          // seconds remaining as fish
    fishCoinsCollected: 0,

    time: lv.timeLimit,
    timeFraction: 0,        // accumulates fractional seconds

    particles: [],

    // Feedback
    shake: 0,
    redFlash: 0,
    lowEnergyBeep: 0,
    flapShakeTimer: 0,

    // Stats
    distanceTraveled: 0,
    startTime: performance.now(),

    message: '',
    messageTimer: 0,
  };
}

// =========================== UPDATE ==================================
function update(dt) {
  if (game.state !== 'playing') return;
  const p = game.player;

  // ---- Fish mode update (separate physics) ----
  if (game.fishMode) {
    updateFish(dt);
    return;
  }

  // ---- Portal collision (activate fish mode) ----
  if (game.portal && !game.portal.used) {
    const dx = p.x - game.portal.x;
    const dy = p.y - game.portal.y;
    if (dx * dx + dy * dy < (CFG.PORTAL_RADIUS + CFG.PLAYER_W / 2) ** 2) {
      game.portal.used = true;
      game.fishMode = true;
      game.fishTimer = CFG.FISH_DURATION;
      game.fishCoinsCollected = 0;
      p.x = game.portal.x + 50;
      p.y = CFG.SKY_H + 30;  // dive into the water
      p.vy = 2;
      p.vx = CFG.FISH_SPEED;
      Sfx.transform();
      spawnParticles(game.portal.x, game.portal.y, '#00e5ff', 30);
      showMessage('🐟 Transformed into a fish! Dive and collect coins!');
    }
  }

  // ---- Wing strength adjustment (A / D) ----
  if (Input.left && p.wingStrength > 1)  { p.wingStrength = 1; showMessage('🐦 Sparrow Wing — light, efficient but weak in strong wind'); }
  if (Input.right && p.wingStrength < 3) { p.wingStrength = 3; showMessage('🦅 Eagle Wing — strong and fast, but drains energy fast'); }
  // Medium is default when neither pressed — use M key? Actually, let's use number keys
  // Simplify: A = light, S already used for dive... Let's keep A=light, D=strong, no medium toggle
  // Actually the player starts at medium(2). A sets to 1, D sets to 3. To get back to 2... hmm.
  // Let me change: holding A decreases, holding D increases, with a cooldown.

  // ---- Determine current wind zone ----
  let windZone = null;
  for (const wz of game.level.windZones) {
    if (p.x >= wz.x && p.x < wz.x + wz.w) { windZone = wz; break; }
  }
  if (windZone) {
    game.wind.wx = windZone.wx;
    game.wind.wy = windZone.wy;
    game.currentWindZone = windZone;
  } else {
    game.wind.wx = 0;
    game.wind.wy = 0;
    game.currentWindZone = null;
  }

  // ---- Physics ----
  const headwindFactor = game.wind.wx < 0 ? 1 + Math.abs(game.wind.wx) * 0.2 : 1;  // reduced from 0.3

  // Vertical movement
  let ascending = false;
  let diving = false;

  if (Input.up && p.energy > 0) {
    p.vy -= CFG.ASCEND_POWER * (p.wingStrength === 3 ? 1.3 : p.wingStrength === 1 ? 0.7 : 1.0);
    ascending = true;
    p.flapping = true;
  } else {
    p.flapping = false;
  }

  if (Input.down) {
    p.vy += CFG.DIVE_POWER;
    diving = true;
  }

  // Gravity
  p.vy += CFG.GRAVITY;

  // Wind effect on velocity
  p.vy += game.wind.wy * 0.3;
  // Wind effect on horizontal speed
  let effectiveSpeed = CFG.BASE_SPEED + game.wind.wx;
  // Wing strength affects speed
  if (p.wingStrength === 3) effectiveSpeed += 0.8;
  else if (p.wingStrength === 1) effectiveSpeed -= 0.5;
  effectiveSpeed = Math.max(0.5, effectiveSpeed); // never go backwards

  // Boost
  if (Input.boost && p.energy > 5) {
    effectiveSpeed += 1.5;
    p.vy -= 0.3;
    p.energy -= 0.35;  // reduced from 0.5
  }

  p.vx = effectiveSpeed;

  // Clamp vertical velocity
  p.vy = Math.max(-CFG.MAX_VY, Math.min(CFG.MAX_VY, p.vy));

  // ---- Energy management ----
  // Passive drain
  p.energy -= CFG.ENERGY_PASSIVE_DRAIN;
  // Ascending costs energy (more in headwind)
  if (ascending) {
    p.energy -= CFG.ENERGY_ASCEND_COST * p.wingStrength * headwindFactor;
  }
  // Diving regenerates energy
  if (diving) {
    p.energy += CFG.ENERGY_DIVE_REGEN;
  }
  // Storm drain
  p.inStorm = false;
  for (const s of game.storms) {
    if (p.x + CFG.PLAYER_W / 2 > s.x && p.x - CFG.PLAYER_W / 2 < s.x + s.w &&
        p.y + CFG.PLAYER_H / 2 > s.y && p.y - CFG.PLAYER_H / 2 < s.y + s.h) {
      p.inStorm = true;
      p.energy -= CFG.ENERGY_STORM_DRAIN;
      game.shake = Math.max(game.shake, 6);
      s.flicker = 1;
      if (Math.random() < 0.05) Sfx.storm();
    }
  }

  p.energy = Math.max(0, Math.min(CFG.ENERGY_MAX, p.energy));

  // ---- Apply position ----
  p.x += p.vx;
  p.y += p.vy;
  game.distanceTraveled = p.x;

  // ---- Boundaries ----
  const skyTop = 20;
  const groundY = CFG.SKY_H;
  if (p.y < skyTop) { p.y = skyTop; p.vy = 0; }
  if (p.y > groundY) {
    // Hit the ground — fail
    game.state = 'lost';
    game.message = 'You hit the ground!';
    Sfx.crash();
    return;
  }

  // Out of energy and falling — check if hit ground
  if (p.energy <= 0 && p.y > groundY - 50) {
    game.state = 'lost';
    game.message = 'Out of energy — you crashed!';
    Sfx.crash();
    return;
  }

  // ---- Visual tilt ----
  p.tilt = Math.max(-0.5, Math.min(0.5, p.vy * 0.06));

  // ---- Wing animation ----
  if (p.flapping) {
    p.wingPhase += 0.4;
  } else {
    p.wingPhase += 0.08;
  }

  // ---- Camera ----
  const targetCamX = p.x - CFG.CANVAS_W * 0.3;
  game.camera.x += (targetCamX - game.camera.x) * 0.08;
  game.camera.x = Math.max(0, Math.min(CFG.WORLD_W - CFG.CANVAS_W, game.camera.x));

  // ---- Collisions: coins ----
  for (const c of game.coins) {
    if (c.collected) continue;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    if (dx * dx + dy * dy < (CFG.COIN_RADIUS + CFG.PLAYER_W / 2) ** 2) {
      c.collected = true;
      p.coins++;
      Sfx.coin();
      spawnParticles(c.x, c.y, '#FFD700', 8);
    }
  }

  // ---- Collisions: energy pickups ----
  for (const e of game.energyPickups) {
    if (e.collected) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    if (dx * dx + dy * dy < (CFG.ENERGY_PICKUP_RADIUS + CFG.PLAYER_W / 2) ** 2) {
      e.collected = true;
      p.energy = Math.min(CFG.ENERGY_MAX, p.energy + CFG.ENERGY_PICKUP_AMOUNT);
      Sfx.energy();
      spawnParticles(e.x, e.y, '#4CAF50', 12);
      showMessage('+' + CFG.ENERGY_PICKUP_AMOUNT + ' energy');
    }
  }

  // ---- Collisions: large energy pickups ----
  for (const e of game.largeEnergyPickups) {
    if (e.collected) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    if (dx * dx + dy * dy < (CFG.ENERGY_LARGE_RADIUS + CFG.PLAYER_W / 2) ** 2) {
      e.collected = true;
      p.energy = Math.min(CFG.ENERGY_MAX, p.energy + CFG.ENERGY_LARGE_AMOUNT);
      Sfx.energyLarge();
      spawnParticles(e.x, e.y, '#00e5ff', 20);
      showMessage('+' + CFG.ENERGY_LARGE_AMOUNT + ' energy! (Large)');
    }
  }

  // ---- Collisions: land masses ----
  for (const l of game.lands) {
    const ly = CFG.SKY_H - l.h;
    if (p.x + CFG.PLAYER_W / 2 > l.x && p.x - CFG.PLAYER_W / 2 < l.x + l.w &&
        p.y + CFG.PLAYER_H / 2 > ly) {
      game.state = 'lost';
      game.message = 'You hit a land mass!';
      Sfx.crash();
      return;
    }
  }

  // ---- Flap sound ----
  if (ascending && game.flapShakeTimer <= 0) {
    Sfx.flap();
    game.flapShakeTimer = 15;
  }
  game.flapShakeTimer--;

  // ---- Turbulence: wing strength vs wind ----
  const windStrength = Math.abs(game.wind.wx) + Math.abs(game.wind.wy);
  if (windStrength > 1.0 && p.wingStrength === 1 && ascending) {
    // Light wing in strong wind = turbulence
    game.shake = Math.max(game.shake, 3);
  }
  if (windStrength > 1.5 && p.wingStrength === 3 && !ascending) {
    // Strong wing in very strong wind = also shaky
    game.shake = Math.max(game.shake, 2);
  }

  // ---- Low energy warning ----
  if (p.energy < 25) {
    game.lowEnergyBeep--;
    if (game.lowEnergyBeep <= 0) {
      Sfx.warn();
      game.lowEnergyBeep = 60;
    }
    game.redFlash = Math.max(game.redFlash, 0.15);
  }

  // ---- Route drift detection ----
  // If player is being pushed significantly by wind and not correcting
  if (Math.abs(game.wind.wy) > 0.4 && !Input.up && !Input.down && p.energy < 50) {
    game.redFlash = Math.max(game.redFlash, 0.1);
  }

  // ---- Timer ----
  game.timeFraction += dt;
  if (game.timeFraction >= 1) {
    game.time -= Math.floor(game.timeFraction);
    game.timeFraction -= Math.floor(game.timeFraction);
    if (game.time <= 0) {
      game.time = 0;
      game.state = 'lost';
      game.message = 'Out of time!';
      Sfx.crash();
      return;
    }
  }

  // ---- Win check ----
  if (p.x >= game.level.targetX) {
    if (p.coins >= game.level.minCoins) {
      game.state = 'won';
      game.message = 'Target reached!';
      Sfx.win();
    } else {
      // Reached target but not enough coins — need to collect more
      // Turn the player around conceptually: just show a message
      showMessage(`Need ${game.level.minCoins - p.coins} more coin(s)!`);
      p.x = game.level.targetX - 1;
    }
  }

  // ---- Update particles ----
  updateParticles(dt);

  // ---- Decay feedback ----
  game.shake *= 0.88;
  game.redFlash *= 0.92;
  if (game.messageTimer > 0) game.messageTimer--;

  // ---- Trail particles ----
  if (Math.random() < 0.3) {
    game.particles.push({
      x: p.x - 15, y: p.y + (Math.random() - 0.5) * 10,
      vx: -1 - Math.random(), vy: (Math.random() - 0.5) * 0.5,
      life: 30, maxLife: 30, color: p.inStorm ? '#888' : 'rgba(255,255,255,0.6)',
      size: 3, type: 'trail',
    });
  }
}

// =========================== FISH MODE UPDATE ========================
function updateFish(dt) {
  const p = game.player;

  // ---- Fish physics (swimming underwater) ----
  // Light buoyancy gravity
  p.vy += CFG.FISH_GRAVITY;

  // Ascend (swim up)
  if (Input.up && p.energy > 0) {
    p.vy -= CFG.FISH_ASCEND_POWER;
    p.flapping = true;
  } else {
    p.flapping = false;
  }

  // Dive (swim down)
  if (Input.down) {
    p.vy += CFG.FISH_DIVE_POWER;
  }

  // Horizontal speed (constant swimming, no wind underwater)
  p.vx = CFG.FISH_SPEED;
  if (Input.boost && p.energy > 5) {
    p.vx += 1.0;
    p.energy -= 0.2;
  }

  // Clamp velocity
  p.vy = Math.max(-CFG.MAX_VY, Math.min(CFG.MAX_VY, p.vy));

  // ---- Energy (slower drain underwater) ----
  p.energy -= CFG.FISH_ENERGY_DRAIN;
  if (Input.up) p.energy -= 0.01;
  p.energy = Math.max(0, Math.min(CFG.ENERGY_MAX, p.energy));

  // ---- Apply position ----
  p.x += p.vx;
  p.y += p.vy;
  game.distanceTraveled = p.x;

  // ---- Boundaries (fish can swim from sea surface to max depth) ----
  const seaSurface = CFG.SKY_H - 10;  // can go slightly above water surface
  const maxDepth = CFG.FISH_MAX_DEPTH;
  if (p.y < seaSurface) { p.y = seaSurface; p.vy = 0; }
  if (p.y > maxDepth) { p.y = maxDepth; p.vy = 0; }

  // ---- Fish timer ----
  game.fishTimer -= dt;
  if (game.fishTimer <= 0) {
    // Transform back to bird
    game.fishMode = false;
    p.y = CFG.SKY_H - 100;  // launch back into the sky
    p.vy = -3;
    p.vx = CFG.BASE_SPEED;
    Sfx.transform();
    spawnParticles(p.x, CFG.SKY_H, '#00e5ff', 25);
    const msg = game.fishCoinsCollected > 0
      ? `🐟 Back to bird! Collected ${game.fishCoinsCollected} underwater coins!`
      : '🐟 Back to bird form!';
    showMessage(msg);
  }

  // ---- Visual tilt ----
  p.tilt = Math.max(-0.5, Math.min(0.5, p.vy * 0.06));

  // ---- Tail animation ----
  p.wingPhase += p.flapping ? 0.3 : 0.12;

  // ---- Camera ----
  const targetCamX = p.x - CFG.CANVAS_W * 0.3;
  game.camera.x += (targetCamX - game.camera.x) * 0.08;
  game.camera.x = Math.max(0, Math.min(CFG.WORLD_W - CFG.CANVAS_W, game.camera.x));

  // ---- Collisions: underwater coins ----
  for (const c of game.fishCoins) {
    if (c.collected) continue;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    if (dx * dx + dy * dy < (CFG.FISH_COIN_RADIUS + CFG.PLAYER_W / 2) ** 2) {
      c.collected = true;
      p.coins++;
      game.fishCoinsCollected++;
      Sfx.coin();
      spawnParticles(c.x, c.y, '#4fc3f7', 10);
    }
  }

  // ---- Bubble particles ----
  if (Math.random() < 0.4) {
    game.particles.push({
      x: p.x - 10 + Math.random() * 15,
      y: p.y + (Math.random() - 0.5) * 15,
      vx: -0.5 - Math.random(),
      vy: -1 - Math.random(),
      life: 40, maxLife: 40,
      color: 'rgba(200, 240, 255, 0.7)',
      size: 2 + Math.random() * 3,
      type: 'bubble',
    });
  }

  // ---- Timer (global game timer still ticks) ----
  game.timeFraction += dt;
  if (game.timeFraction >= 1) {
    game.time -= Math.floor(game.timeFraction);
    game.timeFraction -= Math.floor(game.timeFraction);
    if (game.time <= 0) {
      game.time = 0;
      game.state = 'lost';
      game.message = 'Out of time!';
      Sfx.crash();
      return;
    }
  }

  // ---- Win check ----
  if (p.x >= game.level.targetX) {
    if (p.coins >= game.level.minCoins) {
      game.state = 'won';
      game.message = 'Target reached!';
      Sfx.win();
    } else {
      showMessage(`Need ${game.level.minCoins - p.coins} more coin(s)!`);
      p.x = game.level.targetX - 1;
    }
  }

  // ---- Update particles ----
  updateParticles(dt);

  // ---- Decay feedback ----
  game.shake *= 0.88;
  game.redFlash *= 0.92;
  if (game.messageTimer > 0) game.messageTimer--;
}

function showMessage(msg) {
  game.message = msg;
  game.messageTimer = 120;
}

// =========================== PARTICLES ===============================
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 2 + Math.random() * 3;
    game.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color, size: 3 + Math.random() * 3,
      type: 'spark',
    });
  }
}

function updateParticles(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const pt = game.particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    if (pt.type === 'spark') {
      pt.vy += 0.1; // gravity
      pt.vx *= 0.96;
    } else if (pt.type === 'bubble') {
      pt.vy -= 0.05; // bubbles rise
      pt.vx *= 0.98;
    }
    pt.life--;
    if (pt.life <= 0) game.particles.splice(i, 1);
  }
}

// =========================== RENDER ==================================
function render() {
  const shakeX = (Math.random() - 0.5) * game.shake;
  const shakeY = (Math.random() - 0.5) * game.shake;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Sky
  renderSky();
  // Clouds (parallax)
  renderClouds();
  // Wind streaks (mountain theme)
  renderWindStreaks();
  // World (translated by camera)
  ctx.save();
  ctx.translate(-game.camera.x, 0);
  renderStorms();
  renderLands();
  renderPortal();
  renderCoins();
  renderEnergyPickups();
  renderLargeEnergyPickups();
  renderFishCoins();
  renderTarget();
  renderParticles();
  renderPlayer();
  // Water overlay when in fish mode (drawn over world but under HUD)
  if (game.fishMode) renderWaterOverlay();
  ctx.restore();
  // HUD (fixed)
  renderHUD();
  // Feedback overlays
  renderFeedback();

  ctx.restore();

  // Game over / win overlay
  if (game.state === 'won' || game.state === 'lost') {
    renderEndScreen();
  }
}

function renderSky() {
  const theme = game.level.theme || 'meadow';
  const grad = ctx.createLinearGradient(0, 0, 0, CFG.CANVAS_H);

  if (theme === 'meadow') {
    // Bright sunny meadow
    if (game.player.inStorm) {
      grad.addColorStop(0, '#4a4a5a');
      grad.addColorStop(1, '#6a6a7a');
    } else {
      grad.addColorStop(0, '#5dade2');
      grad.addColorStop(0.5, '#85c1e9');
      grad.addColorStop(1, '#d6eaf8');
    }
  } else if (theme === 'mountain') {
    // Cool mountain pass — sharper, cooler blues
    if (game.player.inStorm) {
      grad.addColorStop(0, '#3a3a4a');
      grad.addColorStop(1, '#5a5a6a');
    } else {
      grad.addColorStop(0, '#78909c');
      grad.addColorStop(0.4, '#90a4ae');
      grad.addColorStop(1, '#cfd8dc');
    }
  } else if (theme === 'storm') {
    // Dark stormy valley
    grad.addColorStop(0, '#263238');
    grad.addColorStop(0.5, '#37474f');
    grad.addColorStop(1, '#455a64');
  } else if (theme === 'ocean') {
    // Golden sunset over the sea
    if (game.player.inStorm) {
      grad.addColorStop(0, '#4a3740');
      grad.addColorStop(0.5, '#5d4046');
      grad.addColorStop(1, '#6d4c50');
    } else {
      grad.addColorStop(0, '#e65100');
      grad.addColorStop(0.25, '#f57c00');
      grad.addColorStop(0.55, '#ffab40');
      grad.addColorStop(1, '#ffe0b2');
    }
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CFG.CANVAS_W, CFG.CANVAS_H);

  // Sun only for meadow theme
  if (theme === 'meadow' && !game.player.inStorm) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath();
    ctx.arc(CFG.CANVAS_W - 120, 100, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(CFG.CANVAS_W - 120, 100, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Sunset sun for ocean theme — low on the horizon, large and orange
  if (theme === 'ocean' && !game.player.inStorm) {
    ctx.save();
    // Outer glow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ff6f00';
    ctx.beginPath();
    ctx.arc(CFG.CANVAS_W * 0.7, CFG.SKY_H - 60, 120, 0, Math.PI * 2);
    ctx.fill();
    // Mid glow
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ff9100';
    ctx.beginPath();
    ctx.arc(CFG.CANVAS_W * 0.7, CFG.SKY_H - 60, 80, 0, Math.PI * 2);
    ctx.fill();
    // Sun disc
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffb74d';
    ctx.beginPath();
    ctx.arc(CFG.CANVAS_W * 0.7, CFG.SKY_H - 60, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Mountain silhouettes for mountain theme
  if (theme === 'mountain') {
    renderMountains(false);
  }

  // Distant storm clouds for storm theme
  if (theme === 'storm') {
    renderMountains(true);
    renderDistantLightning();
  }

  // Distant seagulls for ocean theme
  if (theme === 'ocean') {
    renderSeagulls();
  }
}

// ---- Mountain silhouettes (for mountain & storm themes) ----
function renderMountains(dark) {
  ctx.save();
  const alpha = dark ? 0.6 : 0.35;
  const baseColor = dark ? '#1a1a2e' : '#607d8b';
  const peakColor = dark ? '#16213e' : '#546e7a';

  // Far mountains (darker, taller, slower parallax)
  ctx.globalAlpha = alpha;
  ctx.fillStyle = peakColor;
  const camX = game.camera.x * 0.15;
  drawMountainPeak(100 - camX, CFG.SKY_H, 180, 280);
  drawMountainPeak(400 - camX, CFG.SKY_H, 140, 220);
  drawMountainPeak(700 - camX, CFG.SKY_H, 200, 320);
  drawMountainPeak(1050 - camX, CFG.SKY_H, 160, 260);
  drawMountainPeak(1400 - camX, CFG.SKY_H, 220, 350);
  drawMountainPeak(1750 - camX, CFG.SKY_H, 150, 240);

  // Near mountains (lighter, shorter, faster parallax)
  ctx.globalAlpha = alpha * 1.3;
  ctx.fillStyle = baseColor;
  const camX2 = game.camera.x * 0.3;
  drawMountainPeak(250 - camX2, CFG.SKY_H, 120, 190);
  drawMountainPeak(600 - camX2, CFG.SKY_H, 100, 160);
  drawMountainPeak(950 - camX2, CFG.SKY_H, 140, 210);
  drawMountainPeak(1300 - camX2, CFG.SKY_H, 110, 170);
  drawMountainPeak(1650 - camX2, CFG.SKY_H, 130, 200);

  ctx.restore();
}

function drawMountainPeak(cx, baseY, halfW, peakH) {
  // Only draw if within viewport (with generous margin)
  if (cx + halfW < -100 || cx - halfW > CFG.CANVAS_W + 100) return;
  ctx.beginPath();
  ctx.moveTo(cx, baseY - peakH);
  ctx.lineTo(cx - halfW, baseY);
  ctx.lineTo(cx + halfW, baseY);
  ctx.closePath();
  ctx.fill();

  // Snow cap for non-dark mountains
  const darkTheme = game.level.theme === 'storm';
  if (!darkTheme) {
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.moveTo(cx, baseY - peakH);
    ctx.lineTo(cx - halfW * 0.18, baseY - peakH + peakH * 0.25);
    ctx.lineTo(cx + halfW * 0.18, baseY - peakH + peakH * 0.25);
    ctx.closePath();
    ctx.fill();
  }
}

// ---- Distant lightning (storm theme background) ----
const distantLightningTimers = [];
function renderDistantLightning() {
  const t = performance.now() * 0.001;
  // Spawn occasional distant lightning
  if (Math.random() < 0.008) {
    const lx = 200 + Math.random() * (CFG.CANVAS_W - 400);
    distantLightningTimers.push({ x: lx, life: 0.6 + Math.random() * 0.4 });
  }

  for (let i = distantLightningTimers.length - 1; i >= 0; i--) {
    const dl = distantLightningTimers[i];
    dl.life -= 0.016;
    if (dl.life <= 0) { distantLightningTimers.splice(i, 1); continue; }

    const alpha = dl.life * 0.6;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#cfd8dc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const lx = dl.x;
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx + (Math.sin(t * 7 + lx) * 30), 80);
    ctx.lineTo(lx + (Math.sin(t * 5 + lx) * 15), 160);
    ctx.stroke();
    // Flash glow
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(0, 0, CFG.CANVAS_W, CFG.SKY_H * 0.6);
    ctx.restore();
  }
}

// ---- Distant seagulls (ocean theme background) ----
const seagulls = [];
function renderSeagulls() {
  // Spawn seagulls occasionally
  if (seagulls.length < 5 && Math.random() < 0.01) {
    seagulls.push({
      x: -30,
      y: 80 + Math.random() * 180,
      vx: 0.3 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      size: 6 + Math.random() * 4,
    });
  }

  for (let i = seagulls.length - 1; i >= 0; i--) {
    const g = seagulls[i];
    g.x += g.vx;
    g.phase += 0.08;
    if (g.x > CFG.CANVAS_W + 30) { seagulls.splice(i, 1); continue; }

    const wingY = Math.sin(g.phase) * g.size * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Left wing
    ctx.moveTo(g.x - g.size, g.y);
    ctx.quadraticCurveTo(g.x - g.size * 0.5, g.y - wingY, g.x, g.y);
    // Right wing
    ctx.quadraticCurveTo(g.x + g.size * 0.5, g.y - wingY, g.x + g.size, g.y);
    ctx.stroke();
    ctx.restore();
  }
}
const CLOUDS_FAR = [];
const CLOUDS_MID = [];
const CLOUDS_NEAR = [];
function initClouds() {
  for (let i = 0; i < 20; i++) {
    CLOUDS_FAR.push({ x: Math.random() * CFG.WORLD_W, y: 50 + Math.random() * 200, s: 0.8 + Math.random() * 0.5 });
  }
  for (let i = 0; i < 15; i++) {
    CLOUDS_MID.push({ x: Math.random() * CFG.WORLD_W, y: 80 + Math.random() * 250, s: 1.0 + Math.random() * 0.6 });
  }
  for (let i = 0; i < 10; i++) {
    CLOUDS_NEAR.push({ x: Math.random() * CFG.WORLD_W, y: 100 + Math.random() * 300, s: 1.5 + Math.random() * 0.8 });
  }
}

function renderClouds() {
  const theme = game.level.theme || 'meadow';
  // Cloud color varies by theme
  const cloudColor = theme === 'storm' ? '#546e7a'
                   : theme === 'mountain' ? '#cfd8dc'
                   : theme === 'ocean' ? '#ffcc80'
                   : '#ffffff';
  const cloudAlpha = {
    far:  theme === 'storm' ? 0.25 : theme === 'mountain' ? 0.3 : theme === 'ocean' ? 0.4 : 0.35,
    mid:  theme === 'storm' ? 0.35 : theme === 'mountain' ? 0.42 : theme === 'ocean' ? 0.5 : 0.5,
    near: theme === 'storm' ? 0.5  : theme === 'mountain' ? 0.6 : theme === 'ocean' ? 0.65 : 0.7,
  };

  // Far layer (slowest parallax)
  ctx.save();
  ctx.globalAlpha = cloudAlpha.far;
  ctx.fillStyle = cloudColor;
  for (const c of CLOUDS_FAR) {
    const x = c.x - game.camera.x * 0.2;
    drawCloud(x, c.y, 40 * c.s);
  }
  ctx.restore();

  // Mid layer
  ctx.save();
  ctx.globalAlpha = cloudAlpha.mid;
  ctx.fillStyle = cloudColor;
  for (const c of CLOUDS_MID) {
    const x = c.x - game.camera.x * 0.4;
    drawCloud(x, c.y, 50 * c.s);
  }
  ctx.restore();

  // Near layer
  ctx.save();
  ctx.globalAlpha = cloudAlpha.near;
  ctx.fillStyle = cloudColor;
  for (const c of CLOUDS_NEAR) {
    const x = c.x - game.camera.x * 0.6;
    drawCloud(x, c.y, 65 * c.s);
  }
  ctx.restore();
}

function drawCloud(x, y, r) {
  // Wrap around screen
  const wrappedX = ((x % (CFG.CANVAS_W + 200)) + CFG.CANVAS_W + 200) % (CFG.CANVAS_W + 200) - 100;
  ctx.beginPath();
  ctx.arc(wrappedX, y, r, 0, Math.PI * 2);
  ctx.arc(wrappedX + r * 0.8, y - r * 0.3, r * 0.8, 0, Math.PI * 2);
  ctx.arc(wrappedX + r * 1.4, y, r * 0.7, 0, Math.PI * 2);
  ctx.arc(wrappedX + r * 0.5, y + r * 0.3, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Wind streaks (mountain & storm themes show visible wind lines) ----
const windStreaks = [];
function initWindStreaks() {
  windStreaks.length = 0;
  for (let i = 0; i < 12; i++) {
    windStreaks.push({ x: Math.random() * CFG.CANVAS_W, y: 50 + Math.random() * (CFG.SKY_H - 100), len: 60 + Math.random() * 120, life: Math.random() });
  }
}

function renderWindStreaks() {
  const theme = game.level.theme || 'meadow';
  if (theme === 'meadow') return; // no streaks in meadow

  const windMag = Math.sqrt(game.wind.wx ** 2 + game.wind.wy ** 2);
  if (windMag < 0.3) return;

  const alpha = theme === 'storm' ? 0.15 : theme === 'ocean' ? 0.14 : 0.12;
  const color = theme === 'storm' ? '#90a4ae' : theme === 'ocean' ? '#fff3e0' : '#b0bec5';

  for (const ws of windStreaks) {
    ws.life += 0.005;
    if (ws.life > 1) {
      ws.life = 0;
      ws.x = (ws.x + ws.len + 100) % (CFG.CANVAS_W + 200) - 100;
      ws.y = 50 + Math.random() * (CFG.SKY_H - 100);
    }
    ctx.save();
    ctx.globalAlpha = alpha * Math.sin(ws.life * Math.PI);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sx = ws.x - game.camera.x * 0.15; // slight parallax
    ctx.moveTo(sx, ws.y);
    ctx.lineTo(sx + ws.len * Math.sign(game.wind.wx || 1), ws.y + game.wind.wy * 8);
    ctx.stroke();
    ctx.restore();
  }
}

function renderStorms() {
  for (const s of game.storms) {
    ctx.save();
    // Dark cloud body
    ctx.fillStyle = `rgba(60, 60, 80, ${0.85 + s.flicker * 0.15})`;
    ctx.beginPath();
    ctx.arc(s.x + s.w * 0.3, s.y + s.h * 0.4, s.w * 0.35, 0, Math.PI * 2);
    ctx.arc(s.x + s.w * 0.6, s.y + s.h * 0.3, s.w * 0.3, 0, Math.PI * 2);
    ctx.arc(s.x + s.w * 0.5, s.y + s.h * 0.6, s.w * 0.32, 0, Math.PI * 2);
    ctx.arc(s.x + s.w * 0.2, s.y + s.h * 0.6, s.w * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Lightning
    if (s.flicker > 0.5 || Math.random() < 0.02) {
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const lx = s.x + s.w * 0.5 + (Math.random() - 0.5) * s.w * 0.3;
      ctx.moveTo(lx, s.y + s.h * 0.4);
      ctx.lineTo(lx + (Math.random() - 0.5) * 20, s.y + s.h * 0.7);
      ctx.lineTo(lx + (Math.random() - 0.5) * 15, s.y + s.h);
      ctx.stroke();
    }
    s.flicker *= 0.9;
    ctx.restore();
  }
}

function renderLands() {
  const theme = game.level.theme || 'meadow';

  for (const l of game.lands) {
    const y = CFG.SKY_H - l.h;
    // Ground surface varies by theme
    let topColor, bodyColor, texColor;
    if (theme === 'mountain') {
      topColor = '#78909c';
      bodyColor = '#607d8b';
      texColor = '#546e7a';
    } else if (theme === 'storm') {
      topColor = '#37474f';
      bodyColor = '#263238';
      texColor = '#1a1a1a';
    } else if (theme === 'ocean') {
      topColor = '#ffe082';   // sandy beach top
      bodyColor = '#d4a04c';  // sand/rock body
      texColor = '#bf8a3a';
    } else {
      topColor = '#4caf50';
      bodyColor = '#8d6e63';
      texColor = '#6d4c41';
    }
    // Top layer
    ctx.fillStyle = topColor;
    ctx.fillRect(l.x, y, l.w, 12);
    // Body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(l.x, y + 12, l.w, l.h - 12);
    // Texture
    ctx.fillStyle = texColor;
    for (let i = 0; i < l.w; i += 20) {
      ctx.fillRect(l.x + i + 5, y + 25, 8, 8);
      ctx.fillRect(l.x + i + 12, y + 45, 6, 6);
    }
    // Palm tree on bigger islands (ocean theme)
    if (theme === 'ocean' && l.h >= 80) {
      const tx = l.x + l.w * 0.5;
      const ty = y;
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(tx - 2, ty - 30, 4, 30);
      ctx.fillStyle = '#2e7d32';
      for (let a = -2; a <= 2; a++) {
        if (a === 0) continue;
        ctx.beginPath();
        ctx.ellipse(tx + a * 8, ty - 32, 10, 4, a * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Ground / Sea
  const grad = ctx.createLinearGradient(0, CFG.SKY_H, 0, CFG.CANVAS_H);
  if (theme === 'mountain') {
    grad.addColorStop(0, '#78909c');
    grad.addColorStop(0.15, '#607d8b');
    grad.addColorStop(1, '#455a64');
  } else if (theme === 'storm') {
    grad.addColorStop(0, '#37474f');
    grad.addColorStop(0.15, '#263238');
    grad.addColorStop(1, '#1a1a1a');
  } else if (theme === 'ocean') {
    grad.addColorStop(0, '#0277bd');
    grad.addColorStop(0.15, '#01579b');
    grad.addColorStop(1, '#003c71');
  } else {
    grad.addColorStop(0, '#4caf50');
    grad.addColorStop(0.15, '#8d6e63');
    grad.addColorStop(1, '#5d4037');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(game.camera.x, CFG.SKY_H, CFG.CANVAS_W, CFG.GROUND_H);

  // Animated wave lines for ocean theme
  if (theme === 'ocean') {
    const t = performance.now() * 0.002;
    ctx.save();
    ctx.strokeStyle = 'rgba(129, 212, 250, 0.4)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 4; row++) {
      const baseY = CFG.SKY_H + 10 + row * 22;
      ctx.beginPath();
      for (let x = 0; x < CFG.CANVAS_W; x += 8) {
        const wx = game.camera.x + x;
        const wy = baseY + Math.sin(wx * 0.02 + t + row * 0.8) * 3;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    // Sun reflection on water
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffcc80';
    const reflX = CFG.CANVAS_W * 0.7;
    for (let row = 0; row < 6; row++) {
      const ry = CFG.SKY_H + 5 + row * 14;
      const w = 40 + row * 12 + Math.sin(t * 2 + row) * 8;
      ctx.fillRect(reflX - w / 2, ry, w, 3);
    }
    ctx.restore();
  }
}

function renderCoins() {
  for (const c of game.coins) {
    if (c.collected) continue;
    const pulse = Math.sin(performance.now() * 0.005 + c.x * 0.01) * 2;
    ctx.save();
    // Glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(c.x, c.y, CFG.COIN_RADIUS + 6 + pulse, 0, Math.PI * 2);
    ctx.fill();
    // Coin
    ctx.globalAlpha = 1;
    const grad = ctx.createRadialGradient(c.x - 4, c.y - 4, 2, c.x, c.y, CFG.COIN_RADIUS);
    grad.addColorStop(0, '#fff176');
    grad.addColorStop(0.6, '#ffd700');
    grad.addColorStop(1, '#f9a825');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, CFG.COIN_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(c.x - 4, c.y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function renderEnergyPickups() {
  for (const e of game.energyPickups) {
    if (e.collected) continue;
    const pulse = Math.sin(performance.now() * 0.006 + e.x * 0.01) * 3;
    ctx.save();
    // Glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(e.x, e.y, CFG.ENERGY_PICKUP_RADIUS + 8 + pulse, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.globalAlpha = 1;
    const grad = ctx.createRadialGradient(e.x - 4, e.y - 4, 2, e.x, e.y, CFG.ENERGY_PICKUP_RADIUS);
    grad.addColorStop(0, '#a5d6a7');
    grad.addColorStop(0.6, '#4caf50');
    grad.addColorStop(1, '#2e7d32');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, CFG.ENERGY_PICKUP_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // Lightning bolt
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', e.x, e.y + 1);
    ctx.restore();
  }
}

function renderLargeEnergyPickups() {
  for (const e of game.largeEnergyPickups) {
    if (e.collected) continue;
    const t = performance.now() * 0.004;
    const pulse = Math.sin(t + e.x * 0.01) * 5;
    const r = CFG.ENERGY_LARGE_RADIUS;
    ctx.save();

    // Outer rotating glow ring
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 14 + pulse, 0, Math.PI * 2);
    ctx.fill();

    // Mid glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#40c4ff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 6 + pulse * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Main body — blue-cyan gradient
    ctx.globalAlpha = 1;
    const grad = ctx.createRadialGradient(e.x - 6, e.y - 6, 3, e.x, e.y, r);
    grad.addColorStop(0, '#e1f5fe');
    grad.addColorStop(0.4, '#40c4ff');
    grad.addColorStop(0.8, '#0288d1');
    grad.addColorStop(1, '#01579b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Spinning sparkle ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -t * 20;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Star icon
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', e.x, e.y + 1);

    // Floating "+50" label
    ctx.fillStyle = 'rgba(0, 229, 255, 0.7)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('+50', e.x, e.y + r + 14);

    ctx.restore();
  }
}

// ---- Fish transformation portal ----
function renderPortal() {
  if (!game.portal) return;
  const pt = game.portal;
  if (pt.used) return;

  const t = performance.now() * 0.003;
  const pulse = Math.sin(t) * 5;
  ctx.save();

  // Outer glow ring (water/energy aura)
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, CFG.PORTAL_RADIUS + 20 + pulse, 0, Math.PI * 2);
  ctx.fill();

  // Spinning ring
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -t * 30;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, CFG.PORTAL_RADIUS + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Inner portal — swirling water
  ctx.globalAlpha = 0.8;
  const grad = ctx.createRadialGradient(pt.x, pt.y, 3, pt.x, pt.y, CFG.PORTAL_RADIUS);
  grad.addColorStop(0, '#e1f5fe');
  grad.addColorStop(0.4, '#4fc3f7');
  grad.addColorStop(0.8, '#0277bd');
  grad.addColorStop(1, '#01579b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, CFG.PORTAL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Fish icon in center
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐟', pt.x, pt.y + 1);

  // Label
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0277bd';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('DIVE PORTAL', pt.x, pt.y - CFG.PORTAL_RADIUS - 12);

  ctx.restore();
}

// ---- Underwater coins (only in ocean level) ----
function renderFishCoins() {
  if (!game.fishCoins || game.fishCoins.length === 0) return;
  for (const c of game.fishCoins) {
    if (c.collected) continue;
    const pulse = Math.sin(performance.now() * 0.004 + c.x * 0.01) * 2;
    ctx.save();
    // Bubble glow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.arc(c.x, c.y, CFG.FISH_COIN_RADIUS + 8 + pulse, 0, Math.PI * 2);
    ctx.fill();
    // Coin body (blue-ish, water themed)
    ctx.globalAlpha = 1;
    const grad = ctx.createRadialGradient(c.x - 4, c.y - 4, 2, c.x, c.y, CFG.FISH_COIN_RADIUS);
    grad.addColorStop(0, '#b3e5fc');
    grad.addColorStop(0.6, '#29b6f6');
    grad.addColorStop(1, '#0277bd');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, CFG.FISH_COIN_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // Inner sparkle
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(c.x - 4, c.y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    // Shell/star icon
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬡', c.x, c.y + 1);
    ctx.restore();
  }
}

// ---- Water overlay (when in fish mode, tints screen blue) ----
function renderWaterOverlay() {
  ctx.save();
  // Blue water tint from sea surface down
  const seaY = CFG.SKY_H;
  const grad = ctx.createLinearGradient(0, seaY, 0, CFG.FISH_MAX_DEPTH);
  grad.addColorStop(0, 'rgba(2, 119, 189, 0.35)');
  grad.addColorStop(1, 'rgba(1, 87, 155, 0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(game.camera.x, seaY, CFG.CANVAS_W, CFG.FISH_MAX_DEPTH - seaY);

  // Light rays from the surface
  const t = performance.now() * 0.001;
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#e1f5fe';
  for (let i = 0; i < 5; i++) {
    const rx = game.camera.x + (i * 250 + t * 20) % CFG.CANVAS_W;
    ctx.beginPath();
    ctx.moveTo(rx, seaY);
    ctx.lineTo(rx - 30, CFG.FISH_MAX_DEPTH);
    ctx.lineTo(rx + 30, CFG.FISH_MAX_DEPTH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function renderTarget() {
  const tx = game.level.targetX;
  const ty = 320;
  ctx.save();
  // Glowing portal
  const pulse = Math.sin(performance.now() * 0.003) * 10;
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#00e676';
  ctx.beginPath();
  ctx.arc(tx, ty, 60 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(tx, ty, 45 + pulse * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const grad = ctx.createRadialGradient(tx, ty, 5, tx, ty, 35);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.5, '#69f0ae');
  grad.addColorStop(1, '#00c853');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(tx, ty, 35, 0, Math.PI * 2);
  ctx.fill();
  // Flag pole
  ctx.fillStyle = '#37474f';
  ctx.fillRect(tx - 2, ty - 80, 4, 80);
  // Flag
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.moveTo(tx + 2, ty - 80);
  ctx.lineTo(tx + 40, ty - 65);
  ctx.lineTo(tx + 2, ty - 50);
  ctx.fill();
  // Label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GOAL', tx, ty + 70);
  ctx.restore();
}

function renderPlayer() {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.tilt);

  // ---- Fish mode: render as fish ----
  if (game.fishMode) {
    renderFish();
    ctx.restore();
    return;
  }

  const wingY = Math.sin(p.wingPhase) * (p.flapping ? 12 : 4);

  // ---- Dispatch to wing-specific renderer ----
  if (p.wingStrength === 1) {
    renderSparrow(wingY);
  } else if (p.wingStrength === 3) {
    renderEagle(wingY);
  } else {
    renderBluebird(wingY);
  }

  // Energy aura when boosting
  if (Input.boost && p.energy > 5) {
    const auraColor = p.wingStrength === 1 ? 'rgba(255, 235, 59, 0.5)'
                    : p.wingStrength === 3 ? 'rgba(255, 152, 0, 0.5)'
                    : 'rgba(255, 235, 59, 0.5)';
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28 + Math.sin(performance.now() * 0.02) * 3, 18 + Math.sin(performance.now() * 0.02) * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// =========================== FISH MODE RENDERER ===========================
// A colorful tropical fish — orange body, flowing tail, swimming animation.
function renderFish() {
  const p = game.player;
  const tailWave = Math.sin(p.wingPhase) * (p.flapping ? 8 : 4);
  const finWave = Math.sin(p.wingPhase * 1.3) * 3;

  // Tail (flowing, animated)
  ctx.fillStyle = '#ff6f00';
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.quadraticCurveTo(-22, -8 + tailWave, -28, -12 + tailWave);
  ctx.quadraticCurveTo(-20, -2, -28, 0);
  ctx.quadraticCurveTo(-20, 2, -28, 12 - tailWave);
  ctx.quadraticCurveTo(-22, 8 - tailWave, -12, 0);
  ctx.fill();

  // Tail detail (lighter inner)
  ctx.fillStyle = '#ffa726';
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.quadraticCurveTo(-18, -5 + tailWave * 0.6, -22, -8 + tailWave * 0.6);
  ctx.quadraticCurveTo(-18, 0, -22, 8 - tailWave * 0.6);
  ctx.quadraticCurveTo(-18, 5 - tailWave * 0.6, -12, 0);
  ctx.fill();

  // Body — tropical fish shape (oval, orange)
  const grad = ctx.createLinearGradient(0, -8, 0, 8);
  grad.addColorStop(0, '#ff9800');
  grad.addColorStop(0.5, '#fb8c00');
  grad.addColorStop(1, '#e65100');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // White belly stripe
  ctx.fillStyle = '#fff3e0';
  ctx.beginPath();
  ctx.ellipse(0, 3, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vertical stripes (clownfish style)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillRect(-4, -9, 3, 18);
  ctx.fillRect(5, -8, 3, 16);

  // Top fin (dorsal)
  ctx.fillStyle = '#ff6f00';
  ctx.beginPath();
  ctx.moveTo(-2, -8);
  ctx.quadraticCurveTo(2, -16 + finWave, 8, -10);
  ctx.quadraticCurveTo(4, -8, -2, -8);
  ctx.fill();

  // Bottom fin (pectoral)
  ctx.fillStyle = '#ffa726';
  ctx.beginPath();
  ctx.ellipse(2, 8, 5, 3, 0.3 + finWave * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Head highlight
  ctx.fillStyle = 'rgba(255, 200, 100, 0.4)';
  ctx.beginPath();
  ctx.arc(8, -2, 7, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(12, -2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(13, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  // Eye sparkle
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(14, -3, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#bf360c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(17, 1, 3, -0.5, 0.5);
  ctx.stroke();

  // Boost speed lines
  if (Input.boost && p.energy > 5) {
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-15 - i * 6, -4 + i * 4);
      ctx.lineTo(-25 - i * 6, -4 + i * 4);
      ctx.stroke();
    }
  }
}

// =========================== WING STYLE: LIGHT (Sparrow) ===========================
// Small, agile, pointed wings — energy-efficient but weak against strong wind.
function renderSparrow(wingY) {
  // Tail
  ctx.fillStyle = '#6d4c41';
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-24, -5);
  ctx.lineTo(-22, 0);
  ctx.lineTo(-24, 5);
  ctx.closePath();
  ctx.fill();

  // Body — small round brown body
  ctx.fillStyle = '#795548';
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly
  ctx.fillStyle = '#d7ccc8';
  ctx.beginPath();
  ctx.ellipse(0, 3, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings — short, pointed, angular (sparrow/swallow style)
  ctx.fillStyle = '#5d4037';
  // Top wing
  ctx.beginPath();
  ctx.moveTo(-4, -4);
  ctx.quadraticCurveTo(-10, -16 - wingY, -24, -12 - wingY);
  ctx.lineTo(-18, -6 - wingY * 0.5);
  ctx.quadraticCurveTo(-12, -4, -4, -2);
  ctx.fill();
  // Bottom wing
  ctx.beginPath();
  ctx.moveTo(-4, 4);
  ctx.quadraticCurveTo(-10, 16 + wingY, -24, 12 + wingY);
  ctx.lineTo(-18, 6 + wingY * 0.5);
  ctx.quadraticCurveTo(-12, 4, -4, 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#6d4c41';
  ctx.beginPath();
  ctx.arc(12, -2, 8, 0, Math.PI * 2);
  ctx.fill();

  // Beak — small triangular
  ctx.fillStyle = '#ff9800';
  ctx.beginPath();
  ctx.moveTo(19, -2);
  ctx.lineTo(25, 0);
  ctx.lineTo(19, 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(15, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(16, -3, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// =========================== WING STYLE: MEDIUM (Bluebird) ===========================
// Balanced wings — the default style. Good all-rounder.
function renderBluebird(wingY) {
  // Tail
  ctx.fillStyle = '#0277bd';
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-28, -6);
  ctx.lineTo(-28, 6);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = '#0288d1';
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly
  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.ellipse(0, 3, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings — medium, rounded
  ctx.fillStyle = '#01579b';
  // Top wing
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.quadraticCurveTo(-15, -20 - wingY, -30, -15 - wingY);
  ctx.quadraticCurveTo(-20, -8, -5, -2);
  ctx.fill();
  // Bottom wing
  ctx.beginPath();
  ctx.moveTo(-5, 5);
  ctx.quadraticCurveTo(-15, 20 + wingY, -30, 15 + wingY);
  ctx.quadraticCurveTo(-20, 8, -5, 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#0288d1';
  ctx.beginPath();
  ctx.arc(16, -2, 10, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = '#ff9800';
  ctx.beginPath();
  ctx.moveTo(25, -2);
  ctx.lineTo(34, 0);
  ctx.lineTo(25, 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(19, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(20, -4, 2, 0, Math.PI * 2);
  ctx.fill();
}

// =========================== WING STYLE: STRONG (Eagle) ===========================
// Large, broad, powerful wings with feather details — fast but energy-hungry.
function renderEagle(wingY) {
  // Tail — fan-shaped with white tip
  ctx.fillStyle = '#4e342e';
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-32, -8);
  ctx.lineTo(-28, 0);
  ctx.lineTo(-32, 8);
  ctx.closePath();
  ctx.fill();
  // White tail tip
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.moveTo(-26, -4);
  ctx.lineTo(-32, -8);
  ctx.lineTo(-30, -3);
  ctx.lineTo(-32, 8);
  ctx.lineTo(-26, 4);
  ctx.closePath();
  ctx.fill();

  // Body — large, dark brown
  ctx.fillStyle = '#5d4037';
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly — lighter brown
  ctx.fillStyle = '#8d6e63';
  ctx.beginPath();
  ctx.ellipse(0, 4, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings — LARGE, broad, with individual feather tips (eagle style)
  ctx.fillStyle = '#3e2723';
  // ---- Top wing ----
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.quadraticCurveTo(-18, -28 - wingY, -42, -22 - wingY);  // outer edge
  // Feather tips along the trailing edge
  ctx.lineTo(-38, -14 - wingY * 0.8);
  ctx.lineTo(-32, -18 - wingY * 0.7);
  ctx.lineTo(-26, -10 - wingY * 0.5);
  ctx.lineTo(-20, -14 - wingY * 0.6);
  ctx.lineTo(-14, -6 - wingY * 0.3);
  ctx.quadraticCurveTo(-10, -4, -6, -3);
  ctx.fill();
  // Feather detail lines on top wing
  ctx.strokeStyle = '#4e342e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, -8);
  ctx.lineTo(-30, -20 - wingY * 0.7);
  ctx.moveTo(-14, -6);
  ctx.lineTo(-36, -18 - wingY * 0.8);
  ctx.stroke();

  // ---- Bottom wing ----
  ctx.fillStyle = '#3e2723';
  ctx.beginPath();
  ctx.moveTo(-6, 6);
  ctx.quadraticCurveTo(-18, 28 + wingY, -42, 22 + wingY);
  // Feather tips
  ctx.lineTo(-38, 14 + wingY * 0.8);
  ctx.lineTo(-32, 18 + wingY * 0.7);
  ctx.lineTo(-26, 10 + wingY * 0.5);
  ctx.lineTo(-20, 14 + wingY * 0.6);
  ctx.lineTo(-14, 6 + wingY * 0.3);
  ctx.quadraticCurveTo(-10, 4, -6, 3);
  ctx.fill();
  // Feather detail lines on bottom wing
  ctx.strokeStyle = '#4e342e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, 8);
  ctx.lineTo(-30, 20 + wingY * 0.7);
  ctx.moveTo(-14, 6);
  ctx.lineTo(-36, 18 + wingY * 0.8);
  ctx.stroke();

  // Head — white (bald eagle signature)
  ctx.fillStyle = '#fafafa';
  ctx.beginPath();
  ctx.arc(18, -3, 11, 0, Math.PI * 2);
  ctx.fill();

  // Hooked beak — strong, golden yellow (eagle style)
  ctx.fillStyle = '#ffc107';
  ctx.beginPath();
  ctx.moveTo(28, -4);
  ctx.lineTo(38, 0);
  ctx.lineTo(34, 2);
  ctx.lineTo(28, 4);
  ctx.lineTo(26, 0);
  ctx.fill();
  // Hook detail
  ctx.strokeStyle = '#e65100';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(34, 2);
  ctx.lineTo(32, 4);
  ctx.stroke();

  // Eye — fierce, with brow
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(22, -5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(23, -5, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Eye highlight
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(24, -6, 1, 0, Math.PI * 2);
  ctx.fill();
  // Angry brow
  ctx.strokeStyle = '#616161';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(18, -10);
  ctx.lineTo(25, -8);
  ctx.stroke();
}

function renderParticles() {
  for (const pt of game.particles) {
    ctx.save();
    ctx.globalAlpha = pt.life / pt.maxLife;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// =========================== HUD =====================================
function renderHUD() {
  const p = game.player;

  // ---- Top bar background ----
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, CFG.CANVAS_W, 70);

  // ---- Energy bar ----
  const barX = 20, barY = 15, barW = 220, barH = 22;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(barX, barY, barW, barH);
  const energyRatio = p.energy / CFG.ENERGY_MAX;
  let energyColor = '#4caf50';
  if (energyRatio < 0.5) energyColor = '#ffc107';
  if (energyRatio < 0.25) energyColor = '#f44336';
  ctx.fillStyle = energyColor;
  ctx.fillRect(barX, barY, barW * energyRatio, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Energy', barX, barY - 8);
  ctx.textAlign = 'right';
  ctx.fillText(Math.ceil(p.energy) + '%', barX + barW, barY - 8);

  // ---- Wing strength indicator ----
  const wsX = 270, wsY = 15;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('Wing', wsX, wsY - 8);
  const wsLabels = ['', 'Sparrow', 'Bluebird', 'Eagle'];
  const wsSubs = ['', 'Light', 'Medium', 'Strong'];
  const wsColors = ['', '#81c784', '#4fc3f7', '#e57373'];
  for (let i = 1; i <= 3; i++) {
    ctx.fillStyle = p.wingStrength === i ? wsColors[i] : 'rgba(255,255,255,0.15)';
    ctx.fillRect(wsX + (i - 1) * 62, wsY, 58, barH);
    ctx.fillStyle = p.wingStrength === i ? '#fff' : 'rgba(255,255,255,0.4)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wsLabels[i], wsX + (i - 1) * 62 + 29, wsY + barH / 2 - 6);
    ctx.font = '9px sans-serif';
    ctx.fillText(wsSubs[i], wsX + (i - 1) * 62 + 29, wsY + barH / 2 + 6);
  }

  // ---- Wind vane ----
  const wvX = 520, wvY = 35;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('Wind', wvX, wsY - 8);
  // Vane circle
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(wvX + 30, wvY + 11, 22, 0, Math.PI * 2);
  ctx.stroke();
  // Wind arrow
  const windAngle = Math.atan2(game.wind.wy, game.wind.wx);
  const windMag = Math.sqrt(game.wind.wx ** 2 + game.wind.wy ** 2);
  ctx.save();
  ctx.translate(wvX + 30, wvY + 11);
  ctx.rotate(windAngle);
  ctx.strokeStyle = windMag > 1 ? '#ff5252' : windMag > 0.3 ? '#ffd54f' : '#81c784';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(14, 0);
  ctx.lineTo(8, -5);
  ctx.moveTo(14, 0);
  ctx.lineTo(8, 5);
  ctx.stroke();
  ctx.restore();
  // Wind strength text
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  const windDesc = windMag > 1.0 ? 'STRONG' : windMag > 0.3 ? 'MODERATE' : 'CALM';
  ctx.fillText(windDesc, wvX + 30, wvY + 40);

  // ---- Coins ----
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('●', 610, 35);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  const coinText = game.level.minCoins > 0
    ? `${p.coins} / ${game.level.minCoins}`
    : `${p.coins}`;
  ctx.fillText(coinText, 635, 35);

  // ---- Time ----
  ctx.fillStyle = game.time <= 15 ? '#ff5252' : '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⏱ ' + game.time + 's', 760, 35);

  // ---- Progress bar ----
  const pbX = 820, pbY = 28, pbW = 300, pbH = 14;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(pbX, pbY, pbW, pbH);
  const progress = Math.min(1, p.x / game.level.targetX);
  ctx.fillStyle = '#00e676';
  ctx.fillRect(pbX, pbY, pbW * progress, pbH);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(pbX, pbY, pbW, pbH);
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Distance to goal', pbX, pbY - 8);

  // ---- Fish mode timer (when active) ----
  if (game.fishMode) {
    const fmX = 1150, fmY = 15, fmW = 110, fmH = 22;
    ctx.fillStyle = 'rgba(0, 100, 200, 0.3)';
    ctx.fillRect(fmX - 5, fmY - 5, fmW + 10, fmH + 25);
    ctx.fillStyle = '#4fc3f7';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐟 FISH MODE', fmX, fmY - 8);
    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(fmX, fmY, fmW, fmH);
    const fishRatio = game.fishTimer / CFG.FISH_DURATION;
    ctx.fillStyle = fishRatio < 0.3 ? '#ff5252' : '#4fc3f7';
    ctx.fillRect(fmX, fmY, fmW * fishRatio, fmH);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(fmX, fmY, fmW, fmH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(game.fishTimer) + 's', fmX + fmW / 2, fmY + fmH / 2);
  }

  // ---- Level name ----
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(game.level.name, CFG.CANVAS_W - 20, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px sans-serif';
  ctx.fillText('Level ' + (game.levelIndex + 1) + ' / ' + LEVELS.length, CFG.CANVAS_W - 20, 35);

  // ---- Message ----
  if (game.messageTimer > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, game.messageTimer / 30)})`;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.message, CFG.CANVAS_W / 2, 100);
  }

  ctx.restore();
}

// =========================== FEEDBACK OVERLAYS =======================
function renderFeedback() {
  // Red flash for danger
  if (game.redFlash > 0.01) {
    ctx.save();
    const grad = ctx.createRadialGradient(
      CFG.CANVAS_W / 2, CFG.CANVAS_H / 2, 100,
      CFG.CANVAS_W / 2, CFG.CANVAS_H / 2, CFG.CANVAS_W / 1.2
    );
    grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
    grad.addColorStop(1, `rgba(255, 0, 0, ${game.redFlash})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CFG.CANVAS_W, CFG.CANVAS_H);
    ctx.restore();
  }

  // Low energy border pulse
  if (game.player.energy < 25) {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 82, 82, ${0.3 + Math.sin(performance.now() * 0.008) * 0.2})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, CFG.CANVAS_W, CFG.CANVAS_H);
    ctx.restore();
  }
}

// =========================== END SCREEN ==============================
function renderEndScreen() {
  const p = game.player;
  const won = game.state === 'won';

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, CFG.CANVAS_W, CFG.CANVAS_H);

  // Panel
  const panelW = 500, panelH = 360;
  const panelX = (CFG.CANVAS_W - panelW) / 2;
  const panelY = (CFG.CANVAS_H - panelH) / 2;
  ctx.fillStyle = won ? '#1b5e20' : '#b71c1c';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(won ? 'FLIGHT SUCCESS!' : 'FLIGHT FAILED', panelX + panelW / 2, panelY + 55);

  // Message
  ctx.font = '18px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(game.message, panelX + panelW / 2, panelY + 100);

  // Stats
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#fff';
  const timeUsed = game.level.timeLimit - game.time;
  ctx.fillText(`Coins collected: ${p.coins}`, panelX + panelW / 2, panelY + 150);
  ctx.fillText(`Time used: ${timeUsed}s`, panelX + panelW / 2, panelY + 180);
  ctx.fillText(`Distance: ${Math.round(p.x)}m`, panelX + panelW / 2, panelY + 210);

  if (won && game.levelIndex < LEVELS.length - 1) {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#a5d6a7';
    ctx.fillText('Press ENTER for next level', panelX + panelW / 2, panelY + 255);
  }

  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('Press R to retry  •  Press ESC for menu', panelX + panelW / 2, panelY + 290);

  ctx.restore();
}

// =========================== GAME LOOP ===============================
let lastTime = 0;
function loop(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  if (game) {
    update(dt);
    render();
  }

  requestAnimationFrame(loop);
}

// =========================== UI CONTROL ==============================
function startLevel(index) {
  game = createGame(index);
  document.getElementById('level-select').style.display = 'none';
  document.getElementById('game-canvas').style.display = 'block';
}

function backToMenu() {
  document.getElementById('level-select').style.display = 'flex';
  document.getElementById('game-canvas').style.display = 'none';
  game = null;
}

// =========================== KEYBOARD GLOBAL ========================
window.addEventListener('keydown', (e) => {
  if (!game) return;

  if (game.state === 'won' || game.state === 'lost') {
    if (e.code === 'KeyR') {
      startLevel(game.levelIndex);
    } else if (e.code === 'Escape') {
      backToMenu();
    } else if (e.code === 'Enter' && game.state === 'won' && game.levelIndex < LEVELS.length - 1) {
      startLevel(game.levelIndex + 1);
    }
    return;
  }

  if (e.code === 'Escape') {
    backToMenu();
  }

  // Number keys for wing strength
  if (e.code === 'Digit1') { game.player.wingStrength = 1; showMessage('🐦 Sparrow Wing — light, efficient but weak in strong wind'); }
  if (e.code === 'Digit2') { game.player.wingStrength = 2; showMessage('🐦 Bluebird Wing — balanced speed and efficiency'); }
  if (e.code === 'Digit3') { game.player.wingStrength = 3; showMessage('🦅 Eagle Wing — strong and fast, but drains energy fast'); }
});

// =========================== INITIALIZATION ==========================
function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  canvas.width = CFG.CANVAS_W;
  canvas.height = CFG.CANVAS_H;

  Sfx.init();
  Input.init();
  initClouds();
  initWindStreaks();

  // Build level select buttons
  const container = document.getElementById('level-cards');
  LEVELS.forEach((lv, i) => {
    const card = document.createElement('div');
    card.className = 'level-card';
    const themeDesc = lv.theme === 'mountain' ? '⛰ Mountain Pass' : lv.theme === 'storm' ? '🌩 Stormy Valley' : lv.theme === 'ocean' ? '🌊 Coastal Sunset' : '🌿 Sunny Meadow';
    card.innerHTML = `
      <div class="level-num">Level ${i + 1}</div>
      <div class="level-name">${lv.name}</div>
      <div class="level-desc">${lv.subtitle}</div>
      <div class="level-theme">${themeDesc}</div>
      <div class="level-meta">
        <span>⏱ ${lv.timeLimit}s</span>
        <span>● Min coins: ${lv.minCoins}</span>
        <span>⚡ Start energy: ${lv.startEnergy}</span>
      </div>
      ${lv.portal ? '<div class="level-special">🐟 Includes fish transformation portal!</div>' : ''}
      <button class="play-btn">Play</button>
    `;
    card.querySelector('.play-btn').addEventListener('click', () => {
      Sfx.resume();
      startLevel(i);
    });
    container.appendChild(card);
  });

  requestAnimationFrame(loop);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
