/* ==================================================================
 * Rock Climbing Web Game — Game Engine
 * Track A: Pure HTML/CSS/JavaScript + Canvas 2D (no build step)
 *
 * Code is organized into three clearly separated data sections:
 *   - ENVIRONMENT  : wall, holds, route config (the world)
 *   - PLAYER       : stamina, stability, position (what the player controls)
 *   - RESULTS      : height, feedback flags, best score (calculated outputs)
 * ================================================================== */

(function () {
'use strict';

/* ================================================================
 * 1. CONSTANTS & CONFIGURATION
 * ================================================================ */

// --- Hold Types ---
// Each type has different stamina cost, stability impact, and visual style.
// This teaches the player to read holds before committing.
var HOLD_TYPES = {
  jug:    { name: 'Jug',    staminaMult: 0.7, stabilityCost: 2,  color: '#53d769', w: 34, h: 14, label: 'J' },
  crimp:  { name: 'Crimp',  staminaMult: 1.5, stabilityCost: 9,  color: '#e94560', w: 18, h: 7,  label: 'C' },
  sloper: { name: 'Sloper', staminaMult: 1.0, stabilityCost: 5,  color: '#4a9eff', w: 28, h: 16, label: 'S' },
  pinch:  { name: 'Pinch',  staminaMult: 1.1, stabilityCost: 4,  color: '#b366ff', w: 14, h: 22, label: 'P' },
  rest:   { name: 'Rest',   staminaMult: 0.4, stabilityCost: -10, color: '#f5a623', w: 38, h: 16, label: 'R' }
};

// --- Grip Zones ---
// Teaches "just-right" grip force: too light = slip risk, too hard = wasted energy.
var GRIP_ZONES = [
  { start: 0.00, end: 0.22, type: 'too_light', costMult: 1.0, slipChance: 0.30, color: '#e94560', label: 'Slip' },
  { start: 0.22, end: 0.55, type: 'optimal',   costMult: 0.75, slipChance: 0,    color: '#53d769', label: 'Good' },
  { start: 0.55, end: 0.78, type: 'hard',      costMult: 1.15, slipChance: 0,    color: '#f5a623', label: 'Hard' },
  { start: 0.78, end: 1.00, type: 'too_hard',  costMult: 1.4, slipChance: 0,    color: '#e94560', label: 'Over' }
];

// --- Reach Parameters ---
// How far the player can reach from their current position.
var REACH = { horizontal: 160, up: 180, down: 100 };

// --- Base stamina cost per move ---
var BASE_MOVE_COST = 8;

// --- Route Configurations ---
// Each route changes system variables: hold distribution, wobble rate,
// stamina drain, grip difficulty, and wall length.
var ROUTE_CONFIGS = [
  {
    name: 'First Ascent',
    desc: 'Beginner-friendly route with large holds and rest spots.',
    icon: '🟢',
    seed: 42,
    wallWidth: 600,
    holdCount: 14,
    xSpread: 110,
    yMinGap: 85,
    yMaxGap: 125,
    typeDist: { jug: 0.40, crimp: 0.12, sloper: 0.13, pinch: 0.10, rest: 0.25 },
    wobbleRate: 0.08,
    staminaDrainMult: 1.0,
    optimalZoneEnd: 0.58
  },
  {
    name: 'Crux Master',
    desc: 'Technical route with tricky holds and wobbly sections.',
    icon: '🟡',
    seed: 137,
    wallWidth: 600,
    holdCount: 18,
    xSpread: 140,
    yMinGap: 90,
    yMaxGap: 135,
    typeDist: { jug: 0.18, crimp: 0.28, sloper: 0.22, pinch: 0.22, rest: 0.10 },
    wobbleRate: 0.32,
    staminaDrainMult: 1.0,
    optimalZoneEnd: 0.52
  },
  {
    name: 'The Marathon',
    desc: 'Endurance test — long route, few rests, manage your pace.',
    icon: '🔴',
    seed: 256,
    wallWidth: 600,
    holdCount: 22,
    xSpread: 120,
    yMinGap: 95,
    yMaxGap: 140,
    typeDist: { jug: 0.24, crimp: 0.20, sloper: 0.20, pinch: 0.18, rest: 0.18 },
    wobbleRate: 0.15,
    staminaDrainMult: 1.0,
    optimalZoneEnd: 0.62
  }
];

/* ================================================================
 * 2. SEEDED RANDOM (deterministic route generation)
 * ================================================================ */
function makeRand(seed) {
  var s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pickType(dist, rand) {
  var r = rand();
  var cumulative = 0;
  for (var key in dist) {
    cumulative += dist[key];
    if (r <= cumulative) return key;
  }
  return 'jug';
}

/* ================================================================
 * 3. ROUTE GENERATION
 * ================================================================ */
function generateRoute(config) {
  var rand = makeRand(config.seed);
  var holds = [];
  var y = 60;
  var lastX = config.wallWidth / 2;
  var metersPerUnit = 0.05; // 20 units = 1 meter

  // Start hold — always a rest at the bottom
  holds.push({
    id: 0, x: config.wallWidth / 2, y: 50,
    type: 'rest', quality: 'solid', isRest: true, isStart: true
  });

  for (var i = 1; i < config.holdCount - 1; i++) {
    var x = lastX + (rand() - 0.5) * config.xSpread;
    x = Math.max(100, Math.min(config.wallWidth - 100, x));
    lastX = x;
    y += config.yMinGap + rand() * (config.yMaxGap - config.yMinGap);
    var type = pickType(config.typeDist, rand);
    var quality = rand() < config.wobbleRate ? 'wobbly' : 'solid';
    holds.push({
      id: i, x: x, y: y,
      type: type, quality: quality, isRest: type === 'rest'
    });
  }

  // Top hold — the goal
  y += config.yMinGap + 20;
  holds.push({
    id: config.holdCount - 1, x: config.wallWidth / 2, y: y,
    type: 'jug', quality: 'solid', isTop: true
  });

  return {
    holds: holds,
    wallHeight: y + 100,
    wallWidth: config.wallWidth,
    metersPerUnit: metersPerUnit,
    config: config
  };
}

/* ================================================================
 * 4. GAME STATE
 * ================================================================ */
var game = {
  // --- Game Phase ---
  phase: 'menu',  // menu | idle | gripping | moving | resting | adjusting | falling | gameover | won
  selectedRoute: 0,
  time: 0,        // accumulated game time (ms)
  dt: 0,          // delta time (seconds)

  // --- ENVIRONMENT DATA (the world) ---
  env: {
    route: null,       // generated route object
    holds: [],         // array of hold objects
    wallHeight: 0,
    wallWidth: 600,
    cameraY: 0,
    cameraTargetY: 0,
  },

  // --- PLAYER-CONTROLLED DATA ---
  player: {
    x: 300, y: 50,           // current visual position (wall coords)
    targetX: 300, targetY: 50,
    currentHold: null,        // hold object the player is on
    previousHold: null,       // last hold (for feet rendering)
    stamina: 100,
    maxStamina: 100,
    stability: 100,
    maxStability: 100,
    moveProgress: 0,          // 0..1 during movement
    moveDuration: 400,        // ms
    restProgress: 0,
    restRecoveries: 0,        // diminishing returns counter
  },

  // --- SYSTEM-CALCULATED RESULTS ---
  results: {
    height: 0,               // current height in meters
    bestHeight: 0,           // best for this route
    isNewBest: false,
    isShaking: false,
    isLeaning: false,
    shakeIntensity: 0,
    leanAmount: 0,
    fallY: 0,                // y position when falling
    fallVel: 0,
  },

  // --- Grip Meter ---
  grip: {
    active: false,
    value: 0,           // 0..1 position of marker
    direction: 1,       // 1 = right, -1 = left
    speed: 1.0,         // sweeps per second
    targetHold: null,
    optimalEnd: 0.55,   // end of optimal zone (route-dependent)
  },

  // --- Messages ---
  msg: { text: '', type: '', timer: 0 },

  // --- Particles ---
  particles: [],
};

/* ================================================================
 * 5. TEXTURES (4K-style AI-generated assets)
 * ================================================================ */
var textures = {
  rock: { img: null, ready: false, cropBottom: 0 },
  sky: { img: null, ready: false, cropBottom: 0 },
  vegetation: { img: null, ready: false, cropBottom: 0 },
  hold: { img: null, ready: false, cropBottom: 0 },
  character: { img: null, ready: false, cropBottom: 0 }
};
var texturesLoaded = 0;
var texturesTotal = 5;

var loadingMessages = [
  'Preparing rock faces…',
  'Painting the sky…',
  'Growing mountain pines…',
  'Carving climbing holds…',
  'Summoning the climber…'
];

function loadTexture(key, src) {
  var img = new Image();
  // Update loading text + progress bar
  var fill = document.getElementById('loadingBarFill');
  var text = document.getElementById('loadingText');
  if (text) text.textContent = loadingMessages[texturesLoaded] || 'Almost there…';
  if (fill) fill.style.width = ((texturesLoaded / texturesTotal) * 100) + '%';

  img.onload = function () {
    textures[key].img = img;
    textures[key].ready = true;
    texturesLoaded++;
    if (fill) fill.style.width = ((texturesLoaded / texturesTotal) * 100) + '%';
    if (text) text.textContent = loadingMessages[texturesLoaded] || 'Almost there…';
    if (texturesLoaded === texturesTotal) onAllTexturesReady();
  };
  img.onerror = function () {
    // Even on error, mark as ready to not block the game
    textures[key].ready = true;
    texturesLoaded++;
    if (fill) fill.style.width = ((texturesLoaded / texturesTotal) * 100) + '%';
    if (texturesLoaded === texturesTotal) onAllTexturesReady();
  };
  img.src = src;
}

function onAllTexturesReady() {
  // Hide loading screen
  var ls = document.getElementById('loadingScreen');
  if (ls) ls.classList.add('hidden');
  // Mark on game object for dev mode
  if (typeof game !== 'undefined') {
    game.texturesLoaded = texturesLoaded;
  }
}

function loadAllTextures() {
  loadTexture('rock', 'assets/textures/rock.png');
  loadTexture('sky', 'assets/textures/sky.png');
  loadTexture('vegetation', 'assets/textures/vegetation.png');
  loadTexture('hold', 'assets/textures/hold.png');
  loadTexture('character', 'assets/textures/character.png');
}

/* ================================================================
 * 6. CANVAS SETUP
 * ================================================================ */
var canvas, ctx, dpr;

function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  dpr = window.devicePixelRatio || 1;
  var w = window.innerWidth;
  var h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function viewW() { return canvas.width / dpr; }
function viewH() { return canvas.height / dpr; }

/* ================================================================
 * 6. COORDINATE CONVERSION
 * ================================================================ */
function wallToScreenX(wx) {
  // Center the wall horizontally
  var offsetX = (viewW() - game.env.wallWidth) / 2;
  if (offsetX < 0) offsetX = 0;
  return wx + offsetX;
}

function wallToScreenY(wy) {
  // wall y=0 is bottom; screen y=0 is top
  return viewH() - (wy - game.env.cameraY);
}

function screenToWallX(sx) {
  var offsetX = (viewW() - game.env.wallWidth) / 2;
  if (offsetX < 0) offsetX = 0;
  return sx - offsetX;
}

function screenToWallY(sy) {
  return game.env.cameraY + (viewH() - sy);
}

/* ================================================================
 * 7. REACHABILITY
 * ================================================================ */
function isHoldReachable(hold) {
  if (!hold || hold === game.player.currentHold) return false;
  var p = game.player;
  var dx = Math.abs(hold.x - p.x);
  var dy = hold.y - p.y;
  if (dx > REACH.horizontal) return false;
  if (dy > REACH.up) return false;
  if (dy < -REACH.down) return false;
  return true;
}

function getReachableHolds() {
  return game.env.holds.filter(isHoldReachable);
}

/* ================================================================
 * 8. GAME ACTIONS
 * ================================================================ */

// --- Start grip meter for a target hold ---
function startGrip(hold) {
  if (game.phase !== 'idle') return;
  game.grip.active = true;
  game.grip.value = 0;
  game.grip.direction = 1;
  game.grip.targetHold = hold;
  game.grip.optimalEnd = game.env.route.config.optimalZoneEnd;
  game.phase = 'gripping';
  showGripMeter(true);
}

// --- Resolve the grip meter when player clicks ---
function resolveGrip() {
  if (game.phase !== 'gripping') return;
  game.grip.active = false;
  showGripMeter(false);

  var val = game.grip.value;
  var zone = null;
  for (var i = 0; i < GRIP_ZONES.length; i++) {
    // Adjust optimal zone end based on route config
    var z = GRIP_ZONES[i];
    if (i === 1) z = { start: 0.22, end: game.grip.optimalEnd, type: 'optimal', costMult: 0.75, slipChance: 0, color: '#53d769', label: 'Good' };
    if (i === 2) z = { start: game.grip.optimalEnd, end: 0.78, type: 'hard', costMult: 1.3, slipChance: 0, color: '#f5a623', label: 'Hard' };
    if (val >= z.start && val < z.end) { zone = z; break; }
  }
  if (!zone) zone = GRIP_ZONES[GRIP_ZONES.length - 1];

  // Check for slip
  if (zone.slipChance > 0 && Math.random() < zone.slipChance) {
    showMessage('Grip slipped!', 'danger');
    // Small stamina cost for failed attempt
    game.player.stamina = Math.max(0, game.player.stamina - 3);
    spawnParticles(game.player.x, game.player.y, '#e94560', 8);
    game.phase = 'idle';
    checkConditions();
    return;
  }

  // Start movement
  startMove(game.grip.targetHold, zone);
}

// --- Begin movement animation to a new hold ---
function startMove(hold, gripZone) {
  game.phase = 'moving';
  var p = game.player;
  p.previousHold = p.currentHold;
  p.currentHold = hold;
  p.startX = p.x;       // store start for clean interpolation
  p.startY = p.y;
  p.targetX = hold.x;
  p.targetY = hold.y;
  p.moveProgress = 0;

  // Movement is slower when fatigued (teaches pacing)
  var fatigued = p.stamina < 30;
  p.moveDuration = fatigued ? 500 : 320;

  // Store grip zone for applying cost on arrival
  p._gripZone = gripZone;

  if (gripZone.type === 'optimal') {
    showMessage('Perfect grip!', 'success');
    spawnParticles(hold.x, hold.y, '#53d769', 6);
  } else if (gripZone.type === 'too_hard') {
    showMessage('Over-grip! Wasted energy', 'warning');
  } else if (gripZone.type === 'hard') {
    showMessage('Gripped hard', 'warning');
  }
}

// --- Complete movement: apply stamina and stability changes ---
function completeMove() {
  var p = game.player;
  var hold = p.currentHold;
  var ht = HOLD_TYPES[hold.type];

  // Calculate stamina cost
  var cost = BASE_MOVE_COST * ht.staminaMult;
  // Wobbly holds cost more
  if (hold.quality === 'wobbly') cost *= 1.35;
  // Low stability increases cost
  var stabFactor = 1 + (1 - p.stability / p.maxStability) * 0.4;
  cost *= stabFactor;
  // Grip zone multiplier
  cost *= p._gripZone.costMult;
  // Route stamina drain multiplier
  cost *= game.env.route.config.staminaDrainMult;

  p.stamina = Math.max(0, p.stamina - cost);

  // Stability changes
  p.stability = Math.max(0, Math.min(p.maxStability, p.stability - ht.stabilityCost));
  if (hold.quality === 'wobbly') {
    p.stability = Math.max(0, p.stability - 6);
  }

  // Rest hold gives small immediate stability bonus
  if (hold.isRest) {
    p.stability = Math.min(p.maxStability, p.stability + 5);
  }

  // Update height
  var newHeight = hold.y * game.env.route.metersPerUnit;
  if (newHeight > game.results.height) {
    game.results.height = newHeight;
  }

  // Chalk dust particles
  spawnParticles(hold.x, hold.y, '#ffffff', 4);

  game.phase = 'idle';
  checkConditions();
}

// --- Rest action (only on rest holds) ---
function doRest() {
  if (game.phase !== 'idle') return;
  var p = game.player;
  if (!p.currentHold || !p.currentHold.isRest) return;

  game.phase = 'resting';
  p.restProgress = 0;
  p.restRecoveries++;
  showButton('restBtn', false);
}

function completeRest() {
  var p = game.player;
  // Diminishing returns: each rest recovers less
  var recover = Math.max(12, 25 - p.restRecoveries * 3);
  p.stamina = Math.min(p.maxStamina, p.stamina + recover);
  p.stability = Math.min(p.maxStability, p.stability + 8);
  showMessage('Rested: +' + Math.round(recover) + ' stamina', 'success');
  spawnParticles(p.x, p.y, '#53d769', 5);
  game.phase = 'idle';
}

// --- Adjust position action ---
function doAdjust() {
  if (game.phase !== 'idle') return;
  var p = game.player;
  if (p.stamina < 4) {
    showMessage('Too tired to adjust', 'warning');
    return;
  }
  game.phase = 'adjusting';
  p.moveProgress = 0;
  p.stamina = Math.max(0, p.stamina - 4);
}

function completeAdjust() {
  var p = game.player;
  p.stability = Math.min(p.maxStability, p.stability + 22);
  showMessage('Position adjusted: +22 stability', 'success');
  spawnParticles(p.x, p.y, '#4a9eff', 4);
  game.phase = 'idle';
}

// --- Check win / fall conditions ---
function checkConditions() {
  var p = game.player;

  // Win: reached the top hold
  if (p.currentHold && p.currentHold.isTop) {
    gameWin();
    return;
  }

  // Fall: stamina = 0 and not on a rest hold
  if (p.stamina <= 0 && !(p.currentHold && p.currentHold.isRest)) {
    startFall();
    return;
  }

  // Warning: low stamina
  if (p.stamina < 25 && p.stamina > 0) {
    if (!game._lowStamWarned) {
      showMessage('Arms getting pumped! Find a rest!', 'danger');
      game._lowStamWarned = true;
    }
  } else {
    game._lowStamWarned = false;
  }
}

// --- Fall animation ---
function startFall() {
  game.phase = 'falling';
  game.results.fallY = game.player.y;
  game.results.fallVel = 0;
  showMessage('FALL!', 'danger');
  spawnParticles(game.player.x, game.player.y, '#e94560', 20);
}

function updateFall(dt) {
  game.results.fallVel += 800 * dt; // gravity
  game.player.y -= game.results.fallVel * dt;
  if (game.player.y <= 0) {
    game.player.y = 0;
    gameOver();
  }
}

// --- Game Over ---
function gameOver() {
  game.phase = 'gameover';
  var best = getBestHeight(game.selectedRoute);
  game.results.isNewBest = game.results.height > best;
  if (game.results.isNewBest) {
    setBestHeight(game.selectedRoute, game.results.height);
    game.results.bestHeight = game.results.height;
  } else {
    game.results.bestHeight = best;
  }
  showGameOverScreen();
}

// --- Win ---
function gameWin() {
  game.phase = 'won';
  var best = getBestHeight(game.selectedRoute);
  game.results.isNewBest = game.results.height > best;
  if (game.results.isNewBest) {
    setBestHeight(game.selectedRoute, game.results.height);
    game.results.bestHeight = game.results.height;
  } else {
    game.results.bestHeight = best;
  }
  showWinScreen();
}

/* ================================================================
 * 9. UPDATE LOGIC
 * ================================================================ */
function update(dt) {
  game.time += dt * 1000;
  game.dt = dt;

  // --- Grip meter ---
  if (game.grip.active) {
    game.grip.value += game.grip.direction * game.grip.speed * dt;
    if (game.grip.value >= 1) { game.grip.value = 1; game.grip.direction = -1; }
    if (game.grip.value <= 0) { game.grip.value = 0; game.grip.direction = 1; }
    updateGripMarker();
  }

  // --- Movement animation ---
  if (game.phase === 'moving') {
    game.player.moveProgress += dt * 1000 / game.player.moveDuration;
    if (game.player.moveProgress >= 1) {
      game.player.moveProgress = 1;
      game.player.x = game.player.targetX;
      game.player.y = game.player.targetY;
      completeMove();
    } else {
      // Ease-out interpolation from start to target
      var t = game.player.moveProgress;
      var ease = 1 - Math.pow(1 - t, 3);
      game.player.x = lerp(game.player.startX, game.player.targetX, ease);
      game.player.y = lerp(game.player.startY, game.player.targetY, ease);
    }
  }

  // --- Resting animation ---
  if (game.phase === 'resting') {
    game.player.restProgress += dt * 1000 / 1500;
    // Slowly recover during animation
    var p = game.player;
    var recover = Math.max(12, 25 - p.restRecoveries * 3);
    p.stamina = Math.min(p.maxStamina, p.stamina + (recover * dt * 1000 / 1500));
    if (game.player.restProgress >= 1) {
      completeRest();
    }
  }

  // --- Adjusting animation ---
  if (game.phase === 'adjusting') {
    game.player.moveProgress += dt * 1000 / 500;
    if (game.player.moveProgress >= 1) {
      completeAdjust();
    }
  }

  // --- Falling ---
  if (game.phase === 'falling') {
    updateFall(dt);
  }

  // --- Camera follow ---
  var targetCam = game.player.y - viewH() * 0.55;
  if (targetCam < 0) targetCam = 0;
  if (targetCam > game.env.wallHeight - viewH()) targetCam = game.env.wallHeight - viewH();
  game.env.cameraY += (targetCam - game.env.cameraY) * Math.min(1, dt * 4);

  // --- Feedback: shaking ---
  var p = game.player;
  if (p.stamina < 50 && game.phase !== 'falling' && game.phase !== 'gameover') {
    game.results.isShaking = true;
    game.results.shakeIntensity = (1 - p.stamina / 50) * 6;
  } else {
    game.results.isShaking = false;
    game.results.shakeIntensity = 0;
  }

  // --- Feedback: leaning ---
  if (p.stability < 40 && game.phase !== 'falling' && game.phase !== 'gameover') {
    game.results.isLeaning = true;
    game.results.leanAmount = (1 - p.stability / 40);
  } else {
    game.results.isLeaning = false;
    game.results.leanAmount = 0;
  }

  // --- Message timer ---
  if (game.msg.timer > 0) {
    game.msg.timer -= dt * 1000;
    if (game.msg.timer <= 0) hideMessage();
  }

  // --- Particles ---
  for (var i = game.particles.length - 1; i >= 0; i--) {
    var pt = game.particles[i];
    pt.life -= dt * 1000;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy -= 150 * dt; // gravity for particles
    if (pt.life <= 0) game.particles.splice(i, 1);
  }

  // --- Update UI ---
  updateUI();
}

function lerp(a, b, t) { return a + (b - a) * t; }

/* ================================================================
 * 10. PARTICLES
 * ================================================================ */
function spawnParticles(wx, wy, color, count) {
  for (var i = 0; i < count; i++) {
    game.particles.push({
      x: wx, y: wy,
      vx: (Math.random() - 0.5) * 80,
      vy: Math.random() * 60 + 20,
      life: 500 + Math.random() * 300,
      maxLife: 800,
      color: color,
      size: 2 + Math.random() * 3
    });
  }
}

/* ================================================================
 * 11. RENDERING
 * ================================================================ */
function render() {
  ctx.clearRect(0, 0, viewW(), viewH());
  drawWall();
  drawHolds();
  drawParticles();
  drawPlayer();
}

// --- Wall background ---
function pseudoRand(x, y) {
  return ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;
}

function drawWall() {
  var W = viewW(), H = viewH();
  var camY = game.env.cameraY;
  var wallW = game.env.wallWidth;

  // 1) Sky background — visible at the top edges of the screen (peeks around rock)
  if (textures.sky.ready) {
    var skyImg = textures.sky.img;
    var skySrcH = skyImg.height - textures.sky.cropBottom;  // crop watermark
    var skyW = skyImg.width;
    var skyScale = W / skyW;  // scale sky to fit width
    var skyDrawH = skySrcH * skyScale;
    // Slight parallax with camera
    var skyOffset = -camY * 0.08;
    var y = skyOffset % skyDrawH;
    if (y > 0) y -= skyDrawH;
    for (; y < H; y += skyDrawH) {
      ctx.drawImage(skyImg, 0, 0, skyW, skySrcH, 0, y, W, skyDrawH);
    }
  } else {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#3a72b8');
    grad.addColorStop(1, '#a8d4f0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // 2) Rock cliff — fills the entire viewport with the tall rock texture
  //    This matches the "looking up at a mountain pillar" composition
  if (textures.rock.ready) {
    var rockImg = textures.rock.img;
    var rockSrcW = rockImg.width;
    var rockSrcH = rockImg.height - textures.rock.cropBottom;  // crop watermark
    // Scale rock to be a bit wider than the wall so it spans the whole view
    var rockDrawW = Math.max(W, wallW * 1.2);
    var rockScale = rockDrawW / rockSrcW;
    var rockDrawH = rockSrcH * rockScale;
    // Center it on the wall
    var rockLeftX = (W - rockDrawW) / 2;
    // Y in world coords at top of screen
    var worldYTop = camY;
    var yInTile = worldYTop % rockDrawH;
    if (yInTile < 0) yInTile += rockDrawH;
    var drawY = -yInTile;
    while (drawY < H) {
      ctx.drawImage(rockImg, 0, 0, rockSrcW, rockSrcH, rockLeftX, drawY, rockDrawW, rockDrawH);
      drawY += rockDrawH;
    }

    // Brightness overlay — lighten the rock to match a sunny mountain
    // Using 'screen' blend mode lifts dark areas toward white
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    var brightenGrad = ctx.createLinearGradient(0, 0, 0, H);
    brightenGrad.addColorStop(0, 'rgba(255, 245, 220, 0.4)');  // warm sunlight from top
    brightenGrad.addColorStop(0.5, 'rgba(255, 250, 235, 0.2)');
    brightenGrad.addColorStop(1, 'rgba(220, 230, 240, 0.1)');
    ctx.fillStyle = brightenGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else {
    // Fallback: dark gradient
    var grad2 = ctx.createLinearGradient(0, 0, 0, H);
    grad2.addColorStop(0, '#33334a');
    grad2.addColorStop(1, '#1e1e30');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, W, H);
  }

  // 3) Vegetation strips — sparse, only at certain ledges like in the reference
  if (textures.vegetation.ready) {
    var vegImg = textures.vegetation.img;
    var vegSrcW = vegImg.width;
    var vegSrcH = vegImg.height - textures.vegetation.cropBottom;
    // Place vegetation clusters at specific "ledge" heights (only a few, not everywhere)
    // These are world Y coordinates where vegetation ledges exist
    var ledges = [
      { y: 350, xOffset: -50, w: 0.55, alpha: 0.7 },
      { y: 920, xOffset: 30, w: 0.45, alpha: 0.65 },
      { y: 1450, xOffset: -80, w: 0.6, alpha: 0.6 },
      { y: 1980, xOffset: 20, w: 0.5, alpha: 0.7 }
    ];
    var stripHeight = 140;
    var vegWWorld = stripHeight * (vegSrcW / vegSrcH);
    for (var l = 0; l < ledges.length; l++) {
      var ledge = ledges[l];
      var sy = wallToScreenY(ledge.y);
      if (sy < -stripHeight || sy > H + stripHeight) continue;
      var startX = -ledge.w * game.env.wallWidth / 2 + ledge.xOffset;
      for (var xPos = startX; xPos < startX + ledge.w * game.env.wallWidth; xPos += vegWWorld) {
        var sx = wallToScreenX(xPos);
        // Slight horizontal jitter for organic look
        var jitter = ((xPos * 0.13 + ledge.y * 0.07) % 1) * 25 - 12;
        ctx.save();
        ctx.globalAlpha = ledge.alpha;
        ctx.drawImage(vegImg, 0, 0, vegSrcW, vegSrcH, sx + jitter, sy - stripHeight * 0.4, vegWWorld, stripHeight);
        ctx.restore();
      }
    }
  }

  // 4) Subtle vignette on left/right edges to focus attention on the wall
  var leftX = wallToScreenX(0);
  var rightX = wallToScreenX(wallW);
  var edgeGrad = ctx.createLinearGradient(0, 0, leftX, 0);
  edgeGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
  edgeGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, leftX, H);
  var edgeGradR = ctx.createLinearGradient(rightX, 0, W, 0);
  edgeGradR.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGradR.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = edgeGradR;
  ctx.fillRect(rightX, 0, W - rightX, H);
}

// --- Draw all holds ---
function drawHolds() {
  var reachable = getReachableHolds();
  var reachableIds = {};
  reachable.forEach(function (h) { reachableIds[h.id] = true; });

  for (var i = 0; i < game.env.holds.length; i++) {
    var hold = game.env.holds[i];
    var sy = wallToScreenY(hold.y);
    // Skip holds that are far off screen
    if (sy < -50 || sy > viewH() + 50) continue;
    drawHold(hold, wallToScreenX(hold.x), sy, !!reachableIds[hold.id]);
  }
}

function drawHold(hold, sx, sy, isReachable) {
  var ht = HOLD_TYPES[hold.type];
  var color = ht.color;
  var alpha = 1;

  // Wobbly holds look cracked/duller
  if (hold.quality === 'wobbly') {
    alpha = 0.75;
  }

  // Dim unreachable holds
  if (!isReachable) {
    alpha *= 0.55;
  }

  ctx.save();

  // Reachable highlight glow (subtle yellow ring)
  if (isReachable && game.phase === 'idle') {
    ctx.shadowColor = '#ffd54a';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(255, 213, 74, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(ht.w, ht.h) * 0.95, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Current hold indicator (orange ring)
  if (hold === game.player.currentHold) {
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(ht.w, ht.h) * 1.05, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw the hold sprite with a per-type color tint overlay
  var drawW = ht.w;
  var drawH = ht.h;
  if (textures.hold.ready) {
    var holdImg = textures.hold.img;
    var holdSrcH = holdImg.height - textures.hold.cropBottom;  // crop watermark
    // Slight rotation per hold for visual variety (deterministic by id)
    var rotAngle = ((hold.id * 0.7) % 1) * 0.4 - 0.2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rotAngle);
    ctx.globalAlpha = alpha;

    // Draw the base rock texture (cropped)
    ctx.drawImage(holdImg, 0, 0, holdImg.width, holdSrcH, -drawW / 2, -drawH / 2, drawW, drawH);

    // Apply a color tint overlay using 'multiply' blend mode
    // This tints the grey rock to the type's signature color
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);

    // Restore normal compositing
    ctx.globalCompositeOperation = 'source-over';

    // Add a slight darken to keep it from looking too bright
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = '#000';
    ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
    ctx.globalAlpha = alpha;

    // Highlight rim
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -drawH * 0.3, drawW * 0.35, drawH * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  } else {
    // Fallback: simple colored shape
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    if (hold.type === 'sloper') {
      ctx.beginPath();
      ctx.arc(sx, sy, ht.w / 2, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      drawRoundRect(sx - ht.w / 2, sy - ht.h / 2, ht.w, ht.h, 4);
      ctx.fill();
    }
  }

  // Wobbly quality: draw crack lines on top
  if (hold.quality === 'wobbly') {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx - ht.w / 4, sy - ht.h / 4);
    ctx.lineTo(sx + ht.w / 4, sy + ht.h / 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx + ht.w / 4, sy - ht.h / 4);
    ctx.lineTo(sx - ht.w / 4, sy + ht.h / 4);
    ctx.stroke();
  }

  // Rest hold: star icon
  if (hold.isRest) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', sx, sy - ht.h - 8);
  }

  // Top hold: flag icon
  if (hold.isTop) {
    ctx.fillStyle = '#53d769';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏁', sx, sy - ht.h - 10);
  }

  ctx.restore();
}

function drawRoundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function darken(hex) {
  // Simple darken: reduce each channel by 30%
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  r = Math.floor(r * 0.6);
  g = Math.floor(g * 0.6);
  b = Math.floor(b * 0.6);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// --- Draw player character ---
function drawPlayer() {
  var p = game.player;
  var sx = wallToScreenX(p.x);
  var sy = wallToScreenY(p.y);
  var shake = game.results.shakeIntensity;
  var lean = game.results.leanAmount;

  // Shake offset
  var shakeX = 0, shakeY = 0;
  if (game.results.isShaking) {
    shakeX = Math.sin(game.time / 40) * shake;
    shakeY = Math.cos(game.time / 50) * shake * 0.5;
  }

  // Lean offset (body shifts right = away from wall)
  var leanX = lean * 8;

  // --- Use character sprite if loaded, else fall back to stick figure ---
  if (textures.character.ready && textures.character.img) {
    var img = textures.character.img;
    var iw = img.width;
    var ih = img.height;

    // Sprite scale: target height ~95px on screen
    var drawH = 95;
    var scale = drawH / ih;
    var drawW = iw * scale;

    // The sprite's "raised hand" is at approximately (180, 80) in the original image
    // The "body center" is at approximately (430, 650)
    // We want the raised hand to be at the current hold position
    var handHold = p.currentHold;
    var handSX, handSY;
    if (handHold) {
      handSX = wallToScreenX(handHold.x);
      handSY = wallToScreenY(handHold.y);
    } else {
      handSX = sx;
      handSY = sy - 50;
    }

    // Hand position in original sprite coords
    var handOrigX = 180, handOrigY = 80;

    // Draw position = hand position - (hand offset in sprite * scale)
    var drawX = handSX - handOrigX * scale + shakeX;
    var drawY = handSY - handOrigY * scale + shakeY;

    ctx.save();

    // Fatigue color tint via globalAlpha + color overlay
    if (p.stamina < 30) {
      ctx.globalAlpha = 0.85;
    }

    // Draw the character sprite
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Apply fatigue tint overlay
    if (p.stamina < 30) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(233, 69, 96, 0.35)';
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.stamina < 50) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(245, 166, 35, 0.25)';
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();

    // Fatigue indicator: shake lines around hands
    if (game.results.isShaking && shake > 3) {
      ctx.strokeStyle = 'rgba(233, 69, 96, 0.4)';
      ctx.lineWidth = 1;
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(handSX, handSY, 8 + i * 4 + Math.sin(game.time / 30 + i) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else {
    // Fallback: stick figure (original code)
    var headR = 9;
    var torsoTop = sy - 35;
    var hipY = sy;

    ctx.save();

    // --- Legs ---
    var footHold = p.previousHold;
    var footSX, footSY;
    if (footHold) {
      footSX = wallToScreenX(footHold.x);
      footSY = wallToScreenY(footHold.y);
    } else {
      footSX = sx;
      footSY = sy + 25;
    }

    ctx.strokeStyle = '#888';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx + leanX - 3, hipY);
    ctx.lineTo(footSX - 4 + shakeX * 0.3, footSY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx + leanX + 3, hipY);
    ctx.lineTo(footSX + 4 + shakeX * 0.3, footSY);
    ctx.stroke();

    // --- Torso ---
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(sx + leanX, hipY);
    ctx.lineTo(sx + leanX * 0.5, torsoTop);
    ctx.stroke();

    // --- Arms ---
    var handSX2 = sx, handSY2 = torsoTop - 10;
    if (p.currentHold) {
      handSX2 = wallToScreenX(p.currentHold.x);
      handSY2 = wallToScreenY(p.currentHold.y);
    }

    var armColor = '#bbb';
    if (p.stamina < 30) armColor = '#e94560';
    else if (p.stamina < 50) armColor = '#f5a623';

    ctx.strokeStyle = armColor;
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(sx + leanX * 0.5 - 6, torsoTop + 2);
    var lArmMidX = (sx + leanX * 0.5 + handSX2) / 2 - 5 + shakeX;
    var lArmMidY = (torsoTop + handSY2) / 2 + 5 + shakeY;
    ctx.quadraticCurveTo(lArmMidX, lArmMidY, handSX2 - 2, handSY2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx + leanX * 0.5 + 6, torsoTop + 2);
    var rArmMidX = (sx + leanX * 0.5 + handSX2) / 2 + 5 + shakeX;
    var rArmMidY = (torsoTop + handSY2) / 2 + 5 + shakeY;
    ctx.quadraticCurveTo(rArmMidX, rArmMidY, handSX2 + 2, handSY2);
    ctx.stroke();

    // --- Head ---
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.arc(sx + leanX, torsoTop - headR, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.arc(sx + leanX, torsoTop - headR, headR, Math.PI, 0);
    ctx.fill();

    if (game.results.isShaking && shake > 3) {
      ctx.strokeStyle = 'rgba(233, 69, 96, 0.4)';
      ctx.lineWidth = 1;
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(handSX2, handSY2, 8 + i * 4 + Math.sin(game.time / 30 + i) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

// --- Draw particles ---
function drawParticles() {
  for (var i = 0; i < game.particles.length; i++) {
    var pt = game.particles[i];
    var sx = wallToScreenX(pt.x);
    var sy = wallToScreenY(pt.y);
    var alpha = pt.life / pt.maxLife;
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(sx, sy, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ================================================================
 * 12. UI UPDATES (DOM)
 * ================================================================ */
function updateUI() {
  var p = game.player;

  // Stamina bar
  var stamPct = Math.round(p.stamina);
  var stamBar = document.getElementById('staminaBar');
  var stamPctEl = document.getElementById('staminaPct');
  if (stamBar) {
    stamBar.style.width = stamPct + '%';
    stamBar.className = 'bar-fill stamina';
    if (stamPct < 30) stamBar.classList.add('low');
    else if (stamPct < 55) stamBar.classList.add('mid');
  }
  if (stamPctEl) stamPctEl.textContent = stamPct + '%';

  // Stability bar
  var stabPct = Math.round(p.stability);
  var stabBar = document.getElementById('stabilityBar');
  var stabPctEl = document.getElementById('stabilityPct');
  if (stabBar) stabBar.style.width = stabPct + '%';
  if (stabPctEl) stabPctEl.textContent = stabPct + '%';

  // Height display
  var hEl = document.getElementById('heightVal');
  if (hEl) hEl.textContent = game.results.height.toFixed(1) + 'm';
  var bEl = document.getElementById('bestVal');
  if (bEl) bEl.textContent = game.results.bestHeight.toFixed(1) + 'm';

  // Route name
  var rEl = document.getElementById('routeName');
  if (rEl && game.env.route) rEl.textContent = game.env.route.config.name;

  // Buttons
  var restBtn = document.getElementById('restBtn');
  if (restBtn) {
    var canRest = game.phase === 'idle' && p.currentHold && p.currentHold.isRest;
    restBtn.disabled = !canRest;
  }

  var adjBtn = document.getElementById('adjustBtn');
  if (adjBtn) {
    adjBtn.disabled = game.phase !== 'idle' || p.stamina < 4;
  }
}

function showGripMeter(show) {
  var el = document.getElementById('gripMeter');
  if (el) el.style.display = show ? 'block' : 'none';
  if (show) {
    // Build zones
    var bar = document.getElementById('gripBar');
    if (bar) {
      bar.innerHTML = '';
      var zones = [
        { w: 22, color: '#e94560', label: 'Slip' },
        { w: (game.grip.optimalEnd - 0.22) * 100, color: '#53d769', label: 'Good' },
        { w: (0.78 - game.grip.optimalEnd) * 100, color: '#f5a623', label: 'Hard' },
        { w: 22, color: '#e94560', label: 'Over' }
      ];
      zones.forEach(function (z) {
        var d = document.createElement('div');
        d.className = 'grip-zone';
        d.style.width = z.w + '%';
        d.style.background = z.color;
        d.textContent = z.label;
        bar.appendChild(d);
      });
    }
  }
}

function updateGripMarker() {
  var marker = document.getElementById('gripMarker');
  var container = document.getElementById('gripMeter');
  if (marker && container) {
    // marker is positioned relative to the bar
    var barWidth = 360; // matches CSS width
    marker.style.left = (game.grip.value * barWidth - 2) + 'px';
  }
}

function showMessage(text, type) {
  var el = document.getElementById('gameMessage');
  if (!el) return;
  el.textContent = text;
  el.className = 'game-message show ' + (type || '');
  game.msg.text = text;
  game.msg.type = type;
  game.msg.timer = 1800;
}

function hideMessage() {
  var el = document.getElementById('gameMessage');
  if (el) el.className = 'game-message';
}

function showButton(id, show) {
  var el = document.getElementById(id);
  if (el) el.style.display = show ? '' : 'none';
}

/* ================================================================
 * 13. SCREENS (Menu, Game Over, Win)
 * ================================================================ */
function showMenuScreen() {
  var overlay = document.getElementById('menuOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Rock Climbing';
  overlay.appendChild(h2);

  var sub = document.createElement('p');
  sub.className = 'subtitle';
  sub.textContent = 'Manage your stamina, read the holds, and find your path to the top. ' +
    'Experts know climbing is about energy management, not speed.';
  overlay.appendChild(sub);

  // How to play
  var htp = document.createElement('div');
  htp.className = 'how-to-play';
  htp.innerHTML =
    '<h4>How to Play</h4>' +
    '<ul>' +
    '<li>Click on a <span style="color:#fff">highlighted hold</span> to climb toward it</li>' +
    '<li>Stop the grip meter in the <span style="color:#53d769">green zone</span> for optimal grip</li>' +
    '<li><span style="color:#e94560">Red</span> = too light (slip risk) or too hard (wasted energy)</li>' +
    '<li>Rest at <span style="color:#f5a623">★ rest holds</span> to recover stamina</li>' +
    '<li>Use <b>Adjust</b> to improve body stability</li>' +
    '<li>If stamina hits <b>zero</b> away from a rest — you fall!</li>' +
    '</ul>';
  overlay.appendChild(htp);

  // Route cards
  var rc = document.createElement('div');
  rc.className = 'route-cards';
  rc.id = 'routeCards';
  ROUTE_CONFIGS.forEach(function (cfg, i) {
    var card = document.createElement('div');
    card.className = 'route-card' + (i === game.selectedRoute ? ' selected' : '');
    var best = getBestHeight(i);
    card.innerHTML =
      '<div class="route-icon">' + cfg.icon + '</div>' +
      '<h4>' + cfg.name + '</h4>' +
      '<p>' + cfg.desc + '</p>' +
      '<div class="best">Best: ' + best.toFixed(1) + 'm</div>';
    card.onclick = function () {
      game.selectedRoute = i;
      showMenuScreen();
    };
    rc.appendChild(card);
  });
  overlay.appendChild(rc);

  var btn = document.createElement('button');
  btn.className = 'menu-btn';
  btn.textContent = 'Start Climbing';
  btn.onclick = function () { startGame(); };
  overlay.appendChild(btn);
}

function showGameOverScreen() {
  var overlay = document.getElementById('menuOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'You Fell!';
  h2.style.background = 'linear-gradient(135deg, #e94560, #f5a623)';
  h2.style.webkitBackgroundClip = 'text';
  h2.style.webkitTextFillColor = 'transparent';
  overlay.appendChild(h2);

  var sub = document.createElement('p');
  sub.className = 'subtitle';
  sub.textContent = game.results.isNewBest
    ? 'New personal best! But stamina ran out. Rest more next time.'
    : 'Stamina hit zero. Try to rest more and pace yourself.';
  overlay.appendChild(sub);

  appendResultStats(overlay);
  appendActionButtons(overlay, 'Try Again');
}

function showWinScreen() {
  var overlay = document.getElementById('menuOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Summit Reached!';
  overlay.appendChild(h2);

  var sub = document.createElement('p');
  sub.className = 'subtitle';
  sub.textContent = game.results.isNewBest
    ? 'New personal best! You read the rock and managed your energy well.'
    : 'You reached the top! Try a harder route or beat your height.';
  overlay.appendChild(sub);

  appendResultStats(overlay);
  appendActionButtons(overlay, 'Climb Again');
}

function appendResultStats(overlay) {
  var stats = document.createElement('div');
  stats.className = 'result-stats';

  var heightStat = document.createElement('div');
  heightStat.className = 'result-stat';
  heightStat.innerHTML =
    '<div class="label">Height Reached</div>' +
    '<div class="value' + (game.results.isNewBest ? ' new-best' : '') + '">' +
    game.results.height.toFixed(1) + 'm</div>';
  stats.appendChild(heightStat);

  var bestStat = document.createElement('div');
  bestStat.className = 'result-stat';
  bestStat.innerHTML =
    '<div class="label">Personal Best</div>' +
    '<div class="value">' + game.results.bestHeight.toFixed(1) + 'm</div>';
  stats.appendChild(bestStat);

  if (game.results.isNewBest) {
    var nb = document.createElement('div');
    nb.className = 'result-stat';
    nb.innerHTML = '<div class="label">Status</div><div class="value new-best">★ NEW</div>';
    stats.appendChild(nb);
  }

  overlay.appendChild(stats);
}

function appendActionButtons(overlay, retryLabel) {
  var wrap = document.createElement('div');
  var retry = document.createElement('button');
  retry.className = 'menu-btn';
  retry.textContent = retryLabel;
  retry.onclick = function () { startGame(); };
  wrap.appendChild(retry);

  var menu = document.createElement('button');
  menu.className = 'menu-btn secondary';
  menu.textContent = 'Menu';
  menu.onclick = function () { showMenuScreen(); };
  wrap.appendChild(menu);

  overlay.appendChild(wrap);
}

/* ================================================================
 * 14. GAME FLOW
 * ================================================================ */
function startGame() {
  var config = ROUTE_CONFIGS[game.selectedRoute];
  game.env.route = generateRoute(config);
  game.env.holds = game.env.route.holds;
  game.env.wallHeight = game.env.route.wallHeight;
  game.env.wallWidth = game.env.route.wallWidth;
  game.env.cameraY = 0;

  // Reset player
  var startHold = game.env.holds[0];
  game.player.x = startHold.x;
  game.player.y = startHold.y;
  game.player.targetX = startHold.x;
  game.player.targetY = startHold.y;
  game.player.currentHold = startHold;
  game.player.previousHold = null;
  game.player.stamina = 100;
  game.player.stability = 100;
  game.player.moveProgress = 0;
  game.player.restProgress = 0;
  game.player.restRecoveries = 0;

  // Reset results
  game.results.height = 0;
  game.results.bestHeight = getBestHeight(game.selectedRoute);
  game.results.isNewBest = false;
  game.results.isShaking = false;
  game.results.isLeaning = false;

  // Reset grip
  game.grip.active = false;
  showGripMeter(false);

  // Reset particles
  game.particles = [];

  game._lowStamWarned = false;
  game.phase = 'idle';

  // Hide menu
  var overlay = document.getElementById('menuOverlay');
  if (overlay) overlay.classList.add('hidden');

  hideMessage();
  updateUI();
}

/* ================================================================
 * 15. LOCAL STORAGE (best scores)
 * ================================================================ */
function getBestHeight(routeIndex) {
  try {
    var v = localStorage.getItem('climbing_best_' + routeIndex);
    return v ? parseFloat(v) : 0;
  } catch (e) { return 0; }
}

function setBestHeight(routeIndex, height) {
  try {
    localStorage.setItem('climbing_best_' + routeIndex, height.toString());
  } catch (e) {}
}

/* ================================================================
 * 16. INPUT HANDLING
 * ================================================================ */
function initInput() {
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('mousemove', handleCanvasMove);

  var restBtn = document.getElementById('restBtn');
  if (restBtn) restBtn.addEventListener('click', doRest);

  var adjBtn = document.getElementById('adjustBtn');
  if (adjBtn) adjBtn.addEventListener('click', doAdjust);

  var menuBtn = document.getElementById('menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', function () {
    game.phase = 'menu';
    showMenuScreen();
  });
}

function handleCanvasClick(e) {
  if (game.phase === 'menu' || game.phase === 'gameover' || game.phase === 'won') return;

  // During grip meter: any click resolves it
  if (game.phase === 'gripping') {
    resolveGrip();
    return;
  }

  // Only allow hold selection during idle
  if (game.phase !== 'idle') return;

  var rect = canvas.getBoundingClientRect();
  var sx = e.clientX - rect.left;
  var sy = e.clientY - rect.top;
  var wx = screenToWallX(sx);
  var wy = screenToWallY(sy);

  // Find clicked hold
  var clicked = null;
  for (var i = 0; i < game.env.holds.length; i++) {
    var h = game.env.holds[i];
    var ht = HOLD_TYPES[h.type];
    var dx = Math.abs(h.x - wx);
    var dy = Math.abs(h.y - wy);
    if (dx < ht.w / 2 + 10 && dy < Math.max(ht.h, 14) / 2 + 10) {
      clicked = h;
      break;
    }
  }

  if (!clicked) return;
  if (clicked === game.player.currentHold) return;

  if (isHoldReachable(clicked)) {
    startGrip(clicked);
  } else {
    showMessage("Can't reach that hold", 'warning');
  }
}

function handleCanvasMove(e) {
  if (game.phase !== 'idle') {
    canvas.style.cursor = 'default';
    return;
  }
  var rect = canvas.getBoundingClientRect();
  var sx = e.clientX - rect.left;
  var sy = e.clientY - rect.top;
  var wx = screenToWallX(sx);
  var wy = screenToWallY(sy);

  var hovering = false;
  for (var i = 0; i < game.env.holds.length; i++) {
    var h = game.env.holds[i];
    var ht = HOLD_TYPES[h.type];
    var dx = Math.abs(h.x - wx);
    var dy = Math.abs(h.y - wy);
    if (dx < ht.w / 2 + 10 && dy < Math.max(ht.h, 14) / 2 + 10) {
      if (isHoldReachable(h)) hovering = true;
      break;
    }
  }
  canvas.style.cursor = hovering ? 'pointer' : 'crosshair';
}

/* ================================================================
 * 17. MAIN LOOP
 * ================================================================ */
var lastTime = 0;

function gameLoop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  var dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  if (dt > 0.1) dt = 0.1; // clamp

  if (game.phase !== 'menu') {
    update(dt);
    render();
  }

  requestAnimationFrame(gameLoop);
}

/* ================================================================
 * 18. INITIALIZATION
 * ================================================================ */
function init() {
  initCanvas();
  loadAllTextures();
  initInput();
  showMenuScreen();
  requestAnimationFrame(gameLoop);

  // Expose game state + key functions to window for debugging / dev mode auto-start
  window._game = game;
  window._game.startGame = startGame;
  window._game.hideMenu = function () {
    var mo = document.getElementById('menuOverlay');
    if (mo) mo.classList.add('hidden');
  };
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
