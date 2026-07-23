/**
 * Dream Cake STUDIO — Main Game Logic
 * Track A: HTML + CSS + Canvas 2D + Plain JavaScript
 *
 * Architecture:
 *   Section 1 — Constants & Configuration
 *   Section 2 — Environment Data (system-controlled)
 *   Section 3 — Player-Controlled Data
 *   Section 4 — System-Calculated Results
 *   Section 5 — Game State
 *   Section 6 — Rendering (Canvas 2D)
 *   Section 7 — Controls & Input
 *   Section 8 — Step Logic (5 steps)
 *   Section 9 — Feedback System
 *   Section 10 — Win/Lose Checks
 *   Section 11 — Game Loop
 *   Section 12 — Initialization
 */

// ==========================================
// SECTION 1: CONSTANTS & CONFIGURATION
// ==========================================

var STEPS = { MIX: 0, POUR: 1, BAKE: 2, CHECK: 3, DECORATE: 4 };
var STEP_NAMES = ['Mix & Proportion', 'Pour & Mold', 'Oven Baking', 'Check Result', 'Decoration'];
var STEP_COUNT = 5;

// Temperature
var TEMP_MIN = 100, TEMP_MAX = 250;
var TEMP_OPTIMAL_MIN = 165, TEMP_OPTIMAL_MAX = 195;
var TEMP_HIGH_WARN = 210, TEMP_DANGER = 230;
var TEMP_LOW_WARN = 140;

// Time per difficulty (seconds)
var TIME_LIMITS = [30, 25, 20];

// Cake height
var CAKE_HEIGHT_MAX = 10;
var CAKE_HEIGHT_RAW = 2;   // below this = underbaked
var CAKE_HEIGHT_OK = 6;    // minimum for success
var CAKE_HEIGHT_OPTIMAL = 8;

// Batter default proportions
var BATTER_DEFAULT = { flour: 2, sugar: 1, eggs: 1, milk: 0.5 };

// Surface texture progression
var SURFACE_ORDER = ['smooth', 'slight_cracks', 'cracked', 'severely_cracked'];

// Glaze states
var GLAZE_ORDER = ['perfect', 'slightly_lumpy', 'lumpy', 'very_lumpy'];

// Topping definitions (visual only, no scoring)
var TOPPINGS = [
  { name: 'Fresh Fruit',  color: '#ff6b6b', draw: drawToppingFruit },
  { name: 'Chocolate',    color: '#5c3d2e', draw: drawToppingChocolate },
  { name: 'Cream Flowers', color: '#fff5e6', draw: drawToppingCream }
];

// Difficulty presets
var DIFFICULTY = [
  { name: 'Beginner',     tempFixed: true,  targetTemp: 180, fluctuation: 0,  batterStd: true,  time: 30, glazeEasy: true },
  { name: 'Intermediate', tempFixed: false, targetTemp: 180, fluctuation: 15, batterStd: false, time: 25, glazeEasy: false },
  { name: 'Advanced',     tempFixed: false, targetTemp: 180, fluctuation: 30, batterStd: false, time: 20, glazeEasy: false }
];

// Colors
var COLOR_BG = '#fdf6e3';
var COLOR_OVEN = '#b0734a';
var COLOR_OVEN_WINDOW = '#ffe4c4';
var COLOR_BATTER = '#f5deb3';
var COLOR_CAKE_BODY = '#e8c88a';
var COLOR_CAKE_TOP = '#f0d9b5';
var COLOR_CRACK = '#8b6914';
var COLOR_RAW = '#ffeb3b';
var COLOR_BURN = '#3e2723';
var COLOR_BOWL = '#c0c0c0';

// ==========================================
// SECTION 2: ENVIRONMENT DATA
// ==========================================
// (System-controlled — the game world state)

var env = {
  ovenTemp: 180,           // Float: current oven temperature (°C)
  glazeRatio: 0.5,         // Numeric: glaze proportion (0–1)
  timeRemaining: 180,      // Float: seconds left
  cakeStability: true,     // Boolean: structural stability
  cakeHeight: 0,           // Integer: rising height (0–10)
  surfaceTexture: 0,       // Index into SURFACE_ORDER
  batterThickness: 0.5,    // Float: 0=runny, 1=thick
  cakeRawness: 1,          // Float: 1=raw, 0=fully baked
  cakeDryness: 0,          // Float: 0=moist, 1=very dry
  ovenDoorOpen: false,     // Boolean
  batterDistribution: 0.5, // Float: 0=uneven, 1=perfectly even
  overflowActive: false,   // Boolean: batter overflow animation
  pourProgress: 0          // Float: pour completion (0–1)
};

// ==========================================
// SECTION 3: PLAYER-CONTROLLED DATA
// ==========================================

var player = {
  selectedTemp: 180,
  batterFlour: 2,
  batterSugar: 1,
  batterEggs: 1,
  batterMilk: 0.5,
  pourSpeed: 0.5,
  selectedTopping: -1,
  openedOvenCount: 0
};

// ==========================================
// SECTION 4: SYSTEM-CALCULATED RESULTS
// ==========================================

function calcBatterThickness() {
  // Deviation-from-default: standard proportions give exactly 0.5
  // Flour & eggs thicken; milk thins; sugar is mildly thickening
  var raw = (player.batterFlour - 2) * 0.15
          + (player.batterEggs  - 1) * 0.10
          + (player.batterMilk  - 0.5) * -0.25
          + (player.batterSugar - 1) * 0.05;
  return Math.max(0, Math.min(1, 0.5 + raw));
}

function calcRisingRate() {
  // Rising depends on temperature (optimal = fast, too high/low = slow/negative)
  var temp = env.ovenTemp;
  var rate = 0;
  if (temp >= TEMP_OPTIMAL_MIN && temp <= TEMP_OPTIMAL_MAX) {
    rate = 0.48; // good rising rate per second (6x original for 30s bake)
  } else if (temp > TEMP_OPTIMAL_MAX && temp < TEMP_DANGER) {
    rate = 0.24; // slower, too hot
  } else if (temp >= TEMP_DANGER) {
    rate = -0.12; // collapsing
  } else if (temp < TEMP_OPTIMAL_MIN && temp >= TEMP_LOW_WARN) {
    rate = 0.18; // slow, too cool
  } else {
    rate = 0.06; // barely rising
  }
  // Batter thickness affects rising
  rate *= (0.5 + env.batterThickness * 0.5);
  // If oven door is open, rising stops
  if (env.ovenDoorOpen) rate *= 0.1;
  // Distribution affects even rising
  rate *= (0.7 + env.batterDistribution * 0.3);
  return rate;
}

function calcSurfaceProgress() {
  // High temp causes surface to crack over time
  if (env.ovenTemp >= TEMP_DANGER) return 0.048;   // fast cracking per second
  if (env.ovenTemp >= TEMP_HIGH_WARN) return 0.018; // slow cracking
  return 0; // safe temp, no cracking
}

function calcBakingRate() {
  // How fast rawness decreases
  var temp = env.ovenTemp;
  if (temp < TEMP_LOW_WARN) return 0.012;  // barely baking
  if (temp < TEMP_OPTIMAL_MIN) return 0.036; // slow
  if (temp <= TEMP_OPTIMAL_MAX) return 0.06;  // optimal
  if (temp <= TEMP_HIGH_WARN) return 0.072;   // fast but OK
  return 0.09; // very fast, but dryness accumulates
}

function calcDrynessRate() {
  // Dryness accumulates when temp is too high for too long
  if (env.ovenTemp >= TEMP_DANGER) return 0.048;
  if (env.ovenTemp >= TEMP_HIGH_WARN) return 0.018;
  return 0;
}

function calcOverflowCheck() {
  // Overflow if temp very high AND batter is runny
  return env.ovenTemp >= TEMP_DANGER && env.batterThickness < 0.3;
}

function calcGlazeState() {
  // Glaze lumpiness depends on glazeRatio and batter consistency
  var ratio = env.glazeRatio;
  var thickness = env.batterThickness;
  var deviation = Math.abs(ratio - 0.5);
  // L2/L3: batter thickness affects glaze more
  if (!DIFFICULTY[state.difficulty].glazeEasy) {
    deviation += (1 - thickness) * 0.15;
  }
  if (deviation < 0.1) return 0;  // perfect
  if (deviation < 0.25) return 1; // slightly lumpy
  if (deviation < 0.4)  return 2; // lumpy
  return 3;                        // very lumpy
}

function calcQualityScore() {
  // Additive scoring: each dimension contributes 0–maxPoints, total max = 100
  // Designed so a normal/good L1 bake scores ~80, perfect ~95+
  var score = 0;

  // Height (0–30 points) — generous curve
  var h = env.cakeHeight;
  if (h >= 8)       score += 30;      // perfect rise
  else if (h >= 7)  score += 28;      // near-perfect
  else if (h >= 6)  score += 25;      // good rise (was 20 → now 25)
  else if (h >= 4)  score += 15;      // low but present
  else if (h >= 2)  score += 6;
  else score += Math.round(h * 2);

  // Surface texture (0–15 points) — discrete mapping, forgiving
  var s = Math.min(Math.floor(env.surfaceTexture), 3);
  var surfaceScores = [15, 10, 4, 0]; // smooth=15, slight=10, cracked=4, severely=0
  score += surfaceScores[s];

  // Stability (+10 or 0)
  if (env.cakeStability) score += 10;

  // Rawness / baked-through (0–15 points) — power curve (0.7), forgiving
  score += Math.round(15 * Math.pow(Math.max(0, 1 - env.cakeRawness), 0.7));

  // Moistness / not dry (0–10 points) — power curve (0.6), forgiving
  score += Math.round(10 * Math.pow(Math.max(0, 1 - env.cakeDryness), 0.6));

  // Glaze smoothness (0–5 points)
  var glazeScores = [5, 3, 1, 0]; // perfect=5, slight=3, lumpy=1, very=0
  score += glazeScores[calcGlazeState()];

  // Time bonus (0–15 points, proportional to remaining time)
  if (env.timeRemaining > 0) {
    var maxTime = DIFFICULTY[state.difficulty].time;
    score += Math.round(15 * (env.timeRemaining / maxTime));
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ==========================================
// SECTION 5: GAME STATE
// ==========================================

var state = {
  currentStep: -1,       // -1 = start screen, 0-4 = steps
  difficulty: 0,         // 0=L1, 1=L2, 2=L3
  isPlaying: false,
  feedbackMessages: [],
  feedbackTimers: [],
  gameResult: null,       // null, 'win', 'gameover'
  resultReason: '',
  qualityScore: 0,
  bakeStartTime: 0,
  animTime: 0,           // for visual animations
  pourAnimProgress: 0,
  ovenClosing: false,    // oven door closing animation
  ovenCloseProgress: 0   // 0–1, 1 = fully closed
};

// ==========================================
// SECTION 6: RENDERING (Canvas 2D)
// ==========================================

var canvas, ctx;
var CW = 660, CH = 360;

function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = CW;
  canvas.height = CH;
}

function render() {
  ctx.clearRect(0, 0, CW, CH);
  // Background
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, CW, CH);

  switch (state.currentStep) {
    case -1: drawStartScreen(); break;
    case STEPS.MIX: drawMixScene(); break;
    case STEPS.POUR: drawPourScene(); break;
    case STEPS.BAKE: drawBakeScene(); break;
    case STEPS.CHECK: drawCheckScene(); break;
    case STEPS.DECORATE: drawDecorateScene(); break;
  }
}

// --- Start Screen ---
function drawStartScreen() {
  // Title
  ctx.fillStyle = '#e8a87c';
  ctx.font = 'bold 36px Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Dream Cake STUDIO', CW/2, 80);

  // Decorative cake icon
  drawDecorativeCake(CW/2, 220, 80);

  // Instruction text
  ctx.fillStyle = '#5c3d2e';
  ctx.font = '16px Segoe UI, Arial';
  ctx.fillText('Choose a difficulty level and press Start!', CW/2, 320);
  ctx.fillText('Learn to bake by adapting — not just following recipes.', CW/2, 345);

  // Difficulty labels
  ctx.font = '13px Segoe UI, Arial';
  ctx.fillStyle = '#8b6914';
  ctx.fillText('L1: Fixed temp, learn 5 steps', CW/2, 380);
  ctx.fillText('L2: Temp fluctuates, adjust actively', CW/2, 400);
  ctx.fillText('L3: Unstable temp, full control needed', CW/2, 420);
}

function drawDecorativeCake(x, y, size) {
  // Cake body
  ctx.fillStyle = COLOR_CAKE_BODY;
  ctx.beginPath();
  ctx.ellipse(x, y + size*0.2, size*0.5, size*0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cake top
  ctx.fillStyle = COLOR_CAKE_TOP;
  ctx.beginPath();
  ctx.ellipse(x, y - size*0.1, size*0.5, size*0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cream drip
  ctx.fillStyle = '#fff5e6';
  for (var i = -3; i <= 3; i++) {
    var dx = i * size * 0.12;
    ctx.beginPath();
    ctx.ellipse(x + dx, y + size*0.05, size*0.04, size*0.08, 0, 0, Math.PI);
    ctx.fill();
  }
  // Cherry on top
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.arc(x, y - size*0.25, size*0.06, 0, Math.PI * 2);
  ctx.fill();
}

// --- Mix Scene ---
function drawMixScene() {
  // Mixing bowl
  var bx = CW/2, by = CH/2 - 20;
  ctx.fillStyle = COLOR_BOWL;
  ctx.beginPath();
  ctx.moveTo(bx - 120, by - 60);
  ctx.quadraticCurveTo(bx - 140, by + 80, bx, by + 100);
  ctx.quadraticCurveTo(bx + 140, by + 80, bx + 120, by - 60);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#a0a0a0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Batter inside bowl
  var batterColor = mixBatterColor();
  ctx.fillStyle = batterColor;
  ctx.beginPath();
  ctx.moveTo(bx - 100, by - 30);
  ctx.quadraticCurveTo(bx - 120, by + 70, bx, by + 80);
  ctx.quadraticCurveTo(bx + 120, by + 70, bx + 100, by - 30);
  ctx.closePath();
  ctx.fill();

  // Batter texture indicator
  var thickness = env.batterThickness;
  if (thickness < 0.3) {
    // Runny — show wavy lines
    ctx.strokeStyle = '#c9a96e';
    ctx.lineWidth = 1;
    for (var i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(bx - 60 + i*25, by + 10);
      ctx.quadraticCurveTo(bx - 60 + i*25 + 12, by + 25 + state.animTime*5, bx - 60 + i*25 + 25, by + 10);
      ctx.stroke();
    }
  } else if (thickness > 0.7) {
    // Thick — show lumps
    ctx.fillStyle = '#d4a050';
    for (var i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(bx - 50 + i*20, by + 20 + (i%2)*15, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Whisk/spoon
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx + 80, by - 80);
  ctx.lineTo(bx + 30, by - 20);
  ctx.stroke();
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.arc(bx + 30, by - 15, 10, 0, Math.PI * 2);
  ctx.fill();

  // Step label
  ctx.fillStyle = '#5c3d2e';
  ctx.font = 'bold 20px Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Step 1: Mix & Proportion', CW/2, 40);
  ctx.font = '14px Segoe UI, Arial';
  ctx.fillStyle = '#8b6914';
  ctx.fillText('Adjust the ingredient sliders, then confirm.', CW/2, 65);
}

function mixBatterColor() {
  var t = env.batterThickness;
  // Runny = lighter yellow, thick = darker
  var r = Math.round(245 - t * 40);
  var g = Math.round(222 - t * 30);
  var b = Math.round(179 - t * 20);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// --- Pour Scene ---
function drawPourScene() {
  var progress = env.pourProgress;

  // Mold/pan at bottom
  var mx = CW/2, my = CH - 80;
  ctx.fillStyle = '#a08060';
  ctx.fillRect(mx - 100, my, 200, 40);
  ctx.strokeStyle = '#705030';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx - 100, my, 200, 40);

  // Batter in mold (filling up based on pour progress)
  var fillHeight = progress * 30;
  if (fillHeight > 0) {
    ctx.fillStyle = mixBatterColor();
    ctx.fillRect(mx - 95, my + 40 - fillHeight, 190, fillHeight);
  }

  // Distribution indicator (even/uneven)
  if (progress > 0 && env.batterDistribution < 0.5) {
    // Uneven — show batter lopsided
    ctx.fillStyle = mixBatterColor();
    ctx.beginPath();
    ctx.moveTo(mx - 95, my + 40 - fillHeight);
    ctx.lineTo(mx + 20, my + 40 - fillHeight * 0.5);
    ctx.lineTo(mx + 95, my + 40 - fillHeight);
    ctx.closePath();
    ctx.fill();
  }

  // Bowl above (pouring)
  if (progress < 1) {
    var bx = CW/2, by = 120;
    ctx.fillStyle = COLOR_BOWL;
    ctx.beginPath();
    ctx.moveTo(bx - 80, by - 40);
    ctx.quadraticCurveTo(bx - 90, by + 40, bx, by + 50);
    ctx.quadraticCurveTo(bx + 90, by + 40, bx + 80, by - 40);
    ctx.closePath();
    ctx.fill();

    // Batter stream
    if (state.pourAnimProgress > 0) {
      ctx.fillStyle = mixBatterColor();
      ctx.fillRect(bx - 5, by + 50, 10, my - by - 50);
    }
  }

  // Step label
  ctx.fillStyle = '#5c3d2e';
  ctx.font = 'bold 20px Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Step 2: Pour & Mold', CW/2, 40);
  ctx.font = '14px Segoe UI, Arial';
  ctx.fillStyle = '#8b6914';
  ctx.fillText('Pour batter into the mold. Speed affects distribution.', CW/2, 65);
}

// --- Bake Scene (CORE) ---
function drawBakeScene() {
  var ox = 130, oy = 35, ow = 400, oh = 280;

  // Oven body
  ctx.fillStyle = COLOR_OVEN;
  roundRect(ctx, ox, oy, ow, oh, 10);
  ctx.fill();
  ctx.strokeStyle = '#8b5e3c';
  ctx.lineWidth = 3;
  roundRect(ctx, ox, oy, ow, oh, 10);
  ctx.stroke();

  // Oven window
  var wx = ox + 30, wy = oy + 30, ww = ow - 60, wh = oh - 100;
  ctx.fillStyle = COLOR_OVEN_WINDOW;
  roundRect(ctx, wx, wy, ww, wh, 6);
  ctx.fill();
  ctx.strokeStyle = '#705030';
  ctx.lineWidth = 2;
  roundRect(ctx, wx, wy, ww, wh, 6);
  ctx.stroke();

  // Cake inside oven
  drawCakeInOven(wx + ww/2, wy + wh - 20, ww * 0.4);

  // Oven door closing animation (left-to-right slide)
  if (state.ovenClosing && state.ovenCloseProgress < 1) {
    var progress = state.ovenCloseProgress;
    var wx = ox + 30, wy = oy + 30, ww = ow - 60, wh = oh - 100;
    // Door panel slides from left to right, progressively covering the window
    var doorWidth = ww * progress;
    ctx.fillStyle = '#8b5e3c';
    ctx.fillRect(wx, wy, doorWidth, wh);
    ctx.strokeStyle = '#5c3d2e';
    ctx.lineWidth = 2;
    ctx.strokeRect(wx, wy, doorWidth, wh);
    // Door handle (appears once door is halfway)
    if (progress > 0.4) {
      ctx.fillStyle = '#c0c0c0';
      var handleX = wx + doorWidth - 18;
      ctx.fillRect(handleX, wy + wh * 0.35, 12, 6);
      ctx.fillRect(handleX, wy + wh * 0.55, 12, 6);
    }

    // "Closing..." text
    ctx.fillStyle = '#5c3d2e';
    ctx.font = 'bold 16px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Closing oven...', ox + ow/2, oy + oh + 18);
  }

  // Oven door indicator
  if (env.ovenDoorOpen) {
    ctx.fillStyle = '#ff9800';
    ctx.font = 'bold 16px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('OVEN DOOR OPEN!', ox + ow/2, oy + oh - 25);
  }

  // Temperature glow effect
  var tempRatio = (env.ovenTemp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN);
  if (tempRatio > 0.6) {
    ctx.fillStyle = 'rgba(255,100,0,' + (tempRatio - 0.6) * 0.3 + ')';
    roundRect(ctx, wx, wy, ww, wh, 6);
    ctx.fill();
  }

  // Overflow animation
  if (env.overflowActive) {
    ctx.fillStyle = mixBatterColor();
    for (var i = 0; i < 8; i++) {
      var bx = wx + 20 + i * (ww - 40) / 7;
      var dripH = 15 + Math.sin(state.animTime * 3 + i) * 10;
      ctx.beginPath();
      ctx.ellipse(bx, wy + wh - 30 - dripH, 8, dripH, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sizzle marks
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 1;
    for (var i = 0; i < 5; i++) {
      var sx = wx + 50 + i * 60;
      var sy = wy + wh - 10;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 5, sy - 8 + Math.sin(state.animTime * 5 + i) * 4);
      ctx.stroke();
    }
  }

  // Control knobs area (below oven)
  ctx.fillStyle = '#8b5e3c';
  roundRect(ctx, ox + 10, oy + oh - 60, ow - 20, 50, 5);
  ctx.fill();

  // Temperature dial (decorative)
  var dialX = ox + ow/3, dialY = oy + oh - 35;
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.arc(dialX, dialY, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Dial indicator
  var dialAngle = -Math.PI/2 + (env.ovenTemp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN) * Math.PI;
  ctx.strokeStyle = '#5c3d2e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(dialX, dialY);
  ctx.lineTo(dialX + Math.cos(dialAngle) * 12, dialY + Math.sin(dialAngle) * 12);
  ctx.stroke();

  // Timer display (decorative)
  var timerX = ox + ow*2/3, timerY = oy + oh - 35;
  ctx.fillStyle = '#2a2a2a';
  roundRect(ctx, timerX - 30, timerY - 15, 60, 30, 4);
  ctx.fill();
  ctx.fillStyle = '#4caf50';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(Math.ceil(env.timeRemaining) + 's', timerX, timerY + 5);

  // Step label
  ctx.fillStyle = '#5c3d2e';
  ctx.font = 'bold 20px Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Step 3: Oven Baking', CW/2, 30);
}

function drawCakeInOven(cx, baseY, halfW) {
  var heightRatio = env.cakeHeight / CAKE_HEIGHT_MAX;
  var cakeH = 20 + heightRatio * 80;
  var cakeTopY = baseY - cakeH;

  // Cake body
  ctx.fillStyle = COLOR_CAKE_BODY;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, baseY);
  ctx.lineTo(cx - halfW * 0.7, cakeTopY);
  ctx.quadraticCurveTo(cx, cakeTopY - 5, cx + halfW * 0.7, cakeTopY);
  ctx.lineTo(cx + halfW, baseY);
  ctx.closePath();
  ctx.fill();

  // Raw center indicator
  if (env.cakeRawness > 0.3) {
    ctx.fillStyle = COLOR_RAW;
    ctx.globalAlpha = env.cakeRawness * 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - cakeH * 0.3, halfW * 0.3, cakeH * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Dry/burnt indicator
  if (env.cakeDryness > 0.3) {
    ctx.fillStyle = COLOR_BURN;
    ctx.globalAlpha = env.cakeDryness * 0.4;
    ctx.fillRect(cx - halfW, cakeTopY, halfW * 2, 15);
    ctx.globalAlpha = 1;
  }

  // Surface cracks
  var surfIdx = env.surfaceTexture;
  if (surfIdx >= 1) {
    ctx.strokeStyle = COLOR_CRACK;
    ctx.lineWidth = surfIdx >= 2 ? 2 : 1;
    var crackCount = surfIdx * 3;
    for (var i = 0; i < crackCount; i++) {
      var startX = cx - halfW * 0.6 + (halfW * 1.2 / crackCount) * i;
      var startY = cakeTopY + 5;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + (Math.random() - 0.5) * 15, startY + 10 + Math.random() * 8);
      ctx.lineTo(startX + (Math.random() - 0.5) * 10, startY + 20 + Math.random() * 10);
      ctx.stroke();
    }
  }

  // Cake top (cream layer)
  ctx.fillStyle = COLOR_CAKE_TOP;
  ctx.beginPath();
  ctx.ellipse(cx, cakeTopY, halfW * 0.8, 8 + heightRatio * 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

// --- Check Scene ---
function drawCheckScene() {
  // Cake on plate
  var cx = CW/2, plateY = CH - 80;

  // Plate
  ctx.fillStyle = '#e0e0e0';
  ctx.beginPath();
  ctx.ellipse(cx, plateY, 150, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c0c0c0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cake on plate
  var heightRatio = env.cakeHeight / CAKE_HEIGHT_MAX;
  var cakeH = 20 + heightRatio * 120;
  var cakeTopY = plateY - 20 - cakeH;
  var halfW = 60 + heightRatio * 30;

  // Cake body
  ctx.fillStyle = COLOR_CAKE_BODY;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, plateY - 20);
  ctx.lineTo(cx - halfW * 0.7, cakeTopY);
  ctx.quadraticCurveTo(cx, cakeTopY - 5, cx + halfW * 0.7, cakeTopY);
  ctx.lineTo(cx + halfW, plateY - 20);
  ctx.closePath();
  ctx.fill();

  // Raw center
  if (env.cakeRawness > 0.2) {
    ctx.fillStyle = COLOR_RAW;
    ctx.globalAlpha = env.cakeRawness * 0.6;
    ctx.beginPath();
    ctx.ellipse(cx, plateY - 20 - cakeH * 0.3, halfW * 0.3, cakeH * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Burnt edges
  if (env.cakeDryness > 0.2) {
    ctx.fillStyle = COLOR_BURN;
    ctx.globalAlpha = env.cakeDryness * 0.5;
    ctx.fillRect(cx - halfW, cakeTopY, halfW * 2, 12);
    ctx.globalAlpha = 1;
  }

  // Cracks
  var surfIdx = env.surfaceTexture;
  if (surfIdx >= 1) {
    ctx.strokeStyle = COLOR_CRACK;
    ctx.lineWidth = surfIdx >= 2 ? 2 : 1;
    for (var i = 0; i < surfIdx * 3; i++) {
      ctx.beginPath();
      var sx = cx - halfW * 0.5 + (halfW / surfIdx * 1.5) * i;
      ctx.moveTo(sx, cakeTopY + 8);
      ctx.lineTo(sx + (Math.random()-0.5)*12, cakeTopY + 20);
      ctx.stroke();
    }
  }

  // Cream top
  ctx.fillStyle = COLOR_CAKE_TOP;
  ctx.beginPath();
  ctx.ellipse(cx, cakeTopY, halfW * 0.8, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stability indicator
  if (!env.cakeStability) {
    // Draw cake slightly tilted/collapsed
    ctx.fillStyle = 'rgba(255,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, cakeTopY + 5, halfW, 15, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inspection arrows
  ctx.strokeStyle = '#2196f3';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  // Height arrow
  ctx.beginPath();
  ctx.moveTo(cx + halfW + 20, plateY - 20);
  ctx.lineTo(cx + halfW + 20, cakeTopY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#2196f3';
  ctx.font = '12px Segoe UI, Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Height: ' + Math.round(env.cakeHeight), cx + halfW + 25, (plateY - 20 + cakeTopY)/2);

  // Step label
  ctx.fillStyle = '#5c3d2e';
  ctx.font = 'bold 20px Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Step 4: Check Result', CW/2, 40);
  ctx.font = '14px Segoe UI, Arial';
  ctx.fillStyle = '#8b6914';
  ctx.fillText('Inspect your cake. Decide if it needs more baking or is ready to decorate.', CW/2, 65);
}

// --- Decorate Scene ---
function drawDecorateScene() {
  var cx = CW/2, plateY = CH - 80;

  // Plate
  ctx.fillStyle = '#e0e0e0';
  ctx.beginPath();
  ctx.ellipse(cx, plateY, 150, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cake (same as check but without inspection marks)
  var heightRatio = env.cakeHeight / CAKE_HEIGHT_MAX;
  var cakeH = 20 + heightRatio * 120;
  var cakeTopY = plateY - 20 - cakeH;
  var halfW = 60 + heightRatio * 30;

  ctx.fillStyle = COLOR_CAKE_BODY;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, plateY - 20);
  ctx.lineTo(cx - halfW * 0.7, cakeTopY);
  ctx.quadraticCurveTo(cx, cakeTopY - 5, cx + halfW * 0.7, cakeTopY);
  ctx.lineTo(cx + halfW, plateY - 20);
  ctx.closePath();
  ctx.fill();

  // Cream top
  ctx.fillStyle = COLOR_CAKE_TOP;
  ctx.beginPath();
  ctx.ellipse(cx, cakeTopY, halfW * 0.8, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Selected topping
  if (player.selectedTopping >= 0) {
    TOPPINGS[player.selectedTopping].draw(cx, cakeTopY, halfW);
  }

  // Step label
  ctx.fillStyle = '#5c3d2e';
  ctx.font = 'bold 20px Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Step 5: Decoration', CW/2, 40);
  ctx.font = '14px Segoe UI, Arial';
  ctx.fillStyle = '#8b6914';
  ctx.fillText('Choose a topping (visual only — no effect on score).', CW/2, 65);
}

// --- Topping Drawing Functions ---
function drawToppingFruit(cx, topY, halfW) {
  ctx.fillStyle = '#ff6b6b';
  // Strawberries
  for (var i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(cx + i * halfW * 0.3, topY - 5, 8, 0, Math.PI * 2);
    ctx.fill();
    // Leaf
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.ellipse(cx + i * halfW * 0.3, topY - 12, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6b6b';
  }
}

function drawToppingChocolate(cx, topY, halfW) {
  ctx.strokeStyle = '#5c3d2e';
  ctx.lineWidth = 3;
  // Drizzle lines
  for (var i = 0; i < 5; i++) {
    ctx.beginPath();
    var sx = cx - halfW * 0.6 + i * halfW * 0.3;
    ctx.moveTo(sx, topY - 2);
    ctx.quadraticCurveTo(sx + 5, topY + 15 + Math.sin(i) * 8, sx + 10, topY + 25);
    ctx.stroke();
  }
  // Chocolate chips
  ctx.fillStyle = '#3e2723';
  for (var i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(cx - halfW*0.4 + i * halfW * 0.25, topY + 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawToppingCream(cx, topY, halfW) {
  ctx.fillStyle = '#fff5e6';
  // Cream flower swirls
  for (var i = -2; i <= 2; i++) {
    var fx = cx + i * halfW * 0.25;
    ctx.beginPath();
    ctx.arc(fx, topY - 3, 10, 0, Math.PI * 2);
    ctx.fill();
    // Inner swirl
    ctx.strokeStyle = '#f0d9b5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(fx, topY - 3, 5, 0, Math.PI * 1.5);
    ctx.stroke();
  }
}

// --- Utility Drawing ---
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ==========================================
// SECTION 7: CONTROLS & INPUT
// ==========================================

function selectDifficulty(d) {
  state.difficulty = d;
  // Update UI
  var btns = document.querySelectorAll('.diff-btn');
  btns.forEach(function(b) { b.classList.remove('selected'); });
  btns[d].classList.add('selected');
  document.getElementById('diffDescription').textContent =
    DIFFICULTY[d].name + ': ' + getDiffDescription(d);
}

function stopPulse(btn) {
  if (btn) btn.classList.remove('btn-pulse');
}

function getDiffDescription(d) {
  if (d === 0) return 'Fixed temperature and standard ratio. Focus on learning the five basic baking steps.';
  if (d === 1) return 'Slight temperature fluctuation. Require players to adjust proportion and heat actively.';
  return 'Unstable temperature, easy lump, tight time limit. Require full-process precise control.';
}

function updateProportion() {
  player.batterFlour = parseFloat(document.getElementById('sliderFlour').value);
  player.batterSugar = parseFloat(document.getElementById('sliderSugar').value);
  player.batterEggs  = parseFloat(document.getElementById('sliderEggs').value);
  player.batterMilk  = parseFloat(document.getElementById('sliderMilk').value);

  document.getElementById('valFlour').textContent = player.batterFlour.toFixed(1);
  document.getElementById('valSugar').textContent = player.batterSugar.toFixed(1);
  document.getElementById('valEggs').textContent  = player.batterEggs.toFixed(1);
  document.getElementById('valMilk').textContent  = player.batterMilk.toFixed(1);

  // Calculate batter thickness
  env.batterThickness = calcBatterThickness();

  // Update overall batter status
  var statusEl = document.getElementById('batterStatus');
  if (env.batterThickness < 0.3) {
    statusEl.textContent = 'Too Runny!';
    statusEl.style.color = '#f44336';
  } else if (env.batterThickness > 0.7) {
    statusEl.textContent = 'Too Thick!';
    statusEl.style.color = '#ff9800';
  } else {
    statusEl.textContent = 'Standard';
    statusEl.style.color = '#4caf50';
  }

  // Per-ingredient hints
  var hints = [];
  var d = BATTER_DEFAULT;

  // Flour
  if (player.batterFlour > d.flour * 1.4) {
    hints.push({ text: 'Too much flour!', cls: 'hint-danger' });
  } else if (player.batterFlour < d.flour * 0.6) {
    hints.push({ text: 'Too little flour!', cls: 'hint-danger' });
  } else if (player.batterFlour > d.flour * 1.15 || player.batterFlour < d.flour * 0.85) {
    hints.push({ text: 'Flour slightly off', cls: 'hint-warn' });
  } else {
    hints.push({ text: 'Flour OK', cls: 'hint-ok' });
  }

  // Sugar
  if (player.batterSugar > d.sugar * 1.6) {
    hints.push({ text: 'Too much sugar!', cls: 'hint-danger' });
  } else if (player.batterSugar < d.sugar * 0.4) {
    hints.push({ text: 'Too little sugar!', cls: 'hint-danger' });
  } else if (player.batterSugar > d.sugar * 1.3 || player.batterSugar < d.sugar * 0.7) {
    hints.push({ text: 'Sugar slightly off', cls: 'hint-warn' });
  } else {
    hints.push({ text: 'Sugar OK', cls: 'hint-ok' });
  }

  // Eggs
  if (player.batterEggs > d.eggs * 1.6) {
    hints.push({ text: 'Too many eggs!', cls: 'hint-danger' });
  } else if (player.batterEggs < d.eggs * 0.4) {
    hints.push({ text: 'Too few eggs!', cls: 'hint-danger' });
  } else if (player.batterEggs > d.eggs * 1.3 || player.batterEggs < d.eggs * 0.7) {
    hints.push({ text: 'Eggs slightly off', cls: 'hint-warn' });
  } else {
    hints.push({ text: 'Eggs OK', cls: 'hint-ok' });
  }

  // Milk
  if (player.batterMilk > d.milk * 1.6) {
    hints.push({ text: 'Too much milk!', cls: 'hint-danger' });
  } else if (player.batterMilk < d.milk * 0.4) {
    hints.push({ text: 'Too little milk!', cls: 'hint-danger' });
  } else if (player.batterMilk > d.milk * 1.3 || player.batterMilk < d.milk * 0.7) {
    hints.push({ text: 'Milk slightly off', cls: 'hint-warn' });
  } else {
    hints.push({ text: 'Milk OK', cls: 'hint-ok' });
  }

  // Render hints
  var hintsEl = document.getElementById('ingredientHints');
  var html = '';
  for (var i = 0; i < hints.length; i++) {
    html += '<span class="' + hints[i].cls + '">' + hints[i].text + '</span>';
    if (i < hints.length - 1) html += ' &middot; ';
  }
  hintsEl.innerHTML = html;

  // L1: show recommended values hint
  if (state.difficulty === 0) {
    addFeedback('L1 hint: Standard ratio is Flour 2.0, Sugar 1.0, Eggs 1.0, Milk 0.5.', 'good');
  }
}

function updateTemp() {
  player.selectedTemp = parseInt(document.getElementById('sliderTemp').value);
  document.getElementById('valTemp').textContent = player.selectedTemp + '°C';
  // Update temperature bar
  var ratio = (player.selectedTemp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN);
  document.getElementById('tempBar').style.width = (ratio * 100) + '%';
}

function updatePourSpeed() {
  player.pourSpeed = parseFloat(document.getElementById('sliderPourSpeed').value);
  document.getElementById('valPourSpeed').textContent = player.pourSpeed.toFixed(1);
}

// ==========================================
// SECTION 8: STEP LOGIC
// ==========================================

function startGame() {
  // Reset all state
  resetState();
  state.currentStep = STEPS.MIX;
  state.isPlaying = true;

  // Apply difficulty settings
  env.timeRemaining = DIFFICULTY[state.difficulty].time;
  env.glazeRatio = 0.5;
  env.ovenTemp = DIFFICULTY[state.difficulty].targetTemp;
  player.selectedTemp = DIFFICULTY[state.difficulty].targetTemp;

  // L1: set default proportions
  if (DIFFICULTY[state.difficulty].batterStd) {
    player.batterFlour = BATTER_DEFAULT.flour;
    player.batterSugar = BATTER_DEFAULT.sugar;
    player.batterEggs  = BATTER_DEFAULT.eggs;
    player.batterMilk  = BATTER_DEFAULT.milk;
    env.batterThickness = calcBatterThickness();
  }

  showStepControls(STEPS.MIX);
  updateStepIndicator();
  updateStepProgress();
  addFeedback('Step 1: Adjust your batter proportions, then confirm.', 'good');
}

function resetState() {
  env.ovenTemp = 180;
  env.glazeRatio = 0.5;
  env.timeRemaining = DIFFICULTY[state.difficulty].time;
  env.cakeStability = true;
  env.cakeHeight = 0;
  env.surfaceTexture = 0;
  env.batterThickness = 0.5;
  env.cakeRawness = 1;
  env.cakeDryness = 0;
  env.ovenDoorOpen = false;
  env.batterDistribution = 0.5;
  env.overflowActive = false;
  env.pourProgress = 0;

  player.selectedTemp = 180;
  player.batterFlour = 2;
  player.batterSugar = 1;
  player.batterEggs = 1;
  player.batterMilk = 0.5;
  player.pourSpeed = 0.5;
  player.selectedTopping = -1;
  player.openedOvenCount = 0;

  state.gameResult = null;
  state.resultReason = '';
  state.qualityScore = 0;
  state.pourAnimProgress = 0;
  state.ovenClosing = false;
  state.ovenCloseProgress = 0;
  state.feedbackMessages = [];
}

function confirmMix() {
  // Lock in proportions, move to pour
  env.batterThickness = calcBatterThickness();

  // Calculate glaze ratio from batter
  var total = player.batterFlour + player.batterSugar + player.batterEggs + player.batterMilk;
  env.glazeRatio = player.batterMilk / (total || 1);

  state.currentStep = STEPS.POUR;
  showStepControls(STEPS.POUR);
  updateStepIndicator();
  updateStepProgress();

  var thicknessMsg = '';
  if (env.batterThickness < 0.3) thicknessMsg = 'Warning: batter is very runny — may overflow in oven!';
  else if (env.batterThickness > 0.7) thicknessMsg = 'Warning: batter is thick — cake may not rise well.';
  else thicknessMsg = 'Batter looks good. Proceed to pouring.';

  addFeedback(thicknessMsg, env.batterThickness < 0.3 || env.batterThickness > 0.7 ? 'warning' : 'good');
}

function pourBatter() {
  state.pourAnimProgress = 0.5;
  // Pour animation over ~1-2 seconds
  var pourDuration = 1 / player.pourSpeed;
  var pourInterval = setInterval(function() {
    env.pourProgress += 0.05 * player.pourSpeed;
    state.pourAnimProgress = env.pourProgress;
    // Distribution depends on pour speed
    env.batterDistribution = Math.min(1, env.batterDistribution + 0.02 * player.pourSpeed);
    document.getElementById('pourBar').style.width = (env.pourProgress * 100) + '%';

    if (env.pourProgress >= 1) {
      clearInterval(pourInterval);
      state.pourAnimProgress = 0;
      document.getElementById('pourBtn').style.display = 'none';
      document.getElementById('confirmPourBtn').style.display = 'block';

      if (env.batterDistribution < 0.4) {
        addFeedback('Batter is unevenly distributed. This may cause uneven baking.', 'warning');
      } else {
        addFeedback('Batter poured and distributed evenly!', 'good');
      }
      // Pulse the "Pour Done" button to guide player
      var pourDoneBtn = document.getElementById('confirmPourBtn');
      pourDoneBtn.classList.add('btn-pulse');
    }
  }, 100);
}

function confirmPour() {
  // Start oven door closing animation (1.5s), then begin baking
  state.currentStep = STEPS.BAKE;
  state.ovenClosing = true;
  state.ovenCloseProgress = 0;
  state.bakeStartTime = Date.now();
  showStepControls(STEPS.BAKE);
  updateStepIndicator();
  updateStepProgress();

  // Set temp slider
  document.getElementById('sliderTemp').value = player.selectedTemp;
  updateTemp();

  // Disable bake controls during closing animation
  document.getElementById('sliderTemp').disabled = true;
  document.getElementById('btnTakeOut').disabled = true;
  document.getElementById('btnOpenOven').disabled = true;

  addFeedback('Closing the oven door...', 'good');
}

function takeOutCake() {
  // Transition from baking to checking
  env.ovenDoorOpen = false;
  state.currentStep = STEPS.CHECK;
  showStepControls(STEPS.CHECK);
  updateStepIndicator();
  updateStepProgress();
  updateCheckDisplay();
  addFeedback('Cake taken out! Inspect the result carefully.', 'good');
}

function openOvenDoor() {
  env.ovenDoorOpen = !env.ovenDoorOpen;
  player.openedOvenCount++;
  document.getElementById('btnOpenOven').textContent = env.ovenDoorOpen ? 'Close Oven Door' : 'Open Oven Door';

  if (env.ovenDoorOpen) {
    addFeedback('You opened the oven! Temperature drops and rising may stop.', 'danger');
  } else {
    addFeedback('Oven door closed. Temperature will recover slowly.', 'warning');
  }
}

function confirmCheck() {
  // Check if cake passes minimum quality
  if (env.cakeHeight < CAKE_HEIGHT_RAW) {
    endGame('gameover', 'Cake is too flat — severely underbaked!');
    return;
  }
  if (env.cakeRawness > 0.6) {
    // Medium rawness — can still proceed but score will be lower
    addFeedback('Cake is somewhat underbaked. Proceeding with lower quality.', 'warning');
  }
  if (env.cakeDryness > 0.6) {
    addFeedback('Cake is somewhat dry. Proceeding with lower quality.', 'warning');
  }

  state.currentStep = STEPS.DECORATE;
  showStepControls(STEPS.DECORATE);
  updateStepIndicator();
  updateStepProgress();
  addFeedback('Step 5: Choose a topping to decorate your cake. This is visual only!', 'good');
}

function selectTopping(t) {
  player.selectedTopping = t;
  var btns = document.querySelectorAll('.topping-btn');
  btns.forEach(function(b) { b.classList.remove('selected'); });
  btns[t].classList.add('selected');
  addFeedback('Topping selected: ' + TOPPINGS[t].name, 'good');
}

function finishDecoration() {
  // Calculate final score
  state.qualityScore = calcQualityScore();

  // Check win/lose conditions
  var win = true;
  var reason = '';

  // Must have time remaining
  if (env.timeRemaining <= 0) { win = false; reason = 'Time ran out!'; }
  // Must be stable
  if (!env.cakeStability) { win = false; reason = 'Cake collapsed!'; }
  // Must not be severely cracked AND burnt
  if (env.surfaceTexture >= 3 && env.cakeDryness > 0.7) { win = false; reason = 'Cake severely burnt and cracked!'; }
  // Must not be very lumpy glaze
  if (calcGlazeState() >= 3) { win = false; reason = 'Glaze is too lumpy!'; }
  // Must not be completely raw
  if (env.cakeRawness > 0.8) { win = false; reason = 'Cake is completely raw!'; }

  if (win) {
    endGame('win', 'Your cake is done! Quality score: ' + state.qualityScore + '/100');
  } else {
    endGame('gameover', reason);
  }
}

function endGame(result, reason) {
  state.gameResult = result;
  state.resultReason = reason;
  state.isPlaying = false;

  // Show result overlay
  var overlay = document.getElementById('resultOverlay');
  overlay.classList.add('show');

  var card = document.getElementById('resultCard');
  card.className = 'result-card ' + result;

  document.getElementById('resultTitle').textContent = result === 'win' ? 'Cake Success!' : 'Game Over';
  document.getElementById('resultScore').textContent = result === 'win'
    ? 'Quality Score: ' + state.qualityScore + '/100'
    : '';
  document.getElementById('resultReason').textContent = reason;
}

function restartGame() {
  document.getElementById('resultOverlay').classList.remove('show');
  state.currentStep = -1;
  state.isPlaying = false;
  showStepControls(-1);
  updateStepIndicator();
  resetStepProgress();
  addFeedback('Welcome! Choose a difficulty to start baking.', 'good');
}

// ==========================================
// SECTION 9: FEEDBACK SYSTEM
// ==========================================

function addFeedback(msg, type) {
  type = type || 'good';
  var el = document.getElementById('feedbackMsg');
  el.textContent = msg;
  el.className = 'feedback-msg ' + type;
}

function checkFeedback() {
  // Temperature feedback
  if (env.ovenTemp >= TEMP_DANGER) {
    addFeedback('DANGER: Oven is too hot! Cake may crack and burn!', 'danger');
  } else if (env.ovenTemp >= TEMP_HIGH_WARN) {
    addFeedback('Warning: Oven temperature is high. Watch for cracks.', 'warning');
  } else if (env.ovenTemp < TEMP_LOW_WARN) {
    addFeedback('Warning: Oven is too cool. Cake may not bake properly.', 'warning');
  }

  // Overflow feedback
  if (calcOverflowCheck()) {
    env.overflowActive = true;
    addFeedback('Batter is overflowing! Temperature too high for thin batter!', 'danger');
  } else {
    env.overflowActive = false;
  }

  // Surface texture feedback
  if (env.surfaceTexture >= 2) {
    addFeedback('Cake surface is cracking! Lower the temperature!', 'danger');
  } else if (env.surfaceTexture >= 1) {
    addFeedback('Slight cracks appearing on cake surface.', 'warning');
  }

  // Cake stopped rising
  if (env.cakeHeight > 2 && env.ovenDoorOpen) {
    addFeedback('Cake stops rising when oven door is open!', 'danger');
  }

  // Time warning
  if (env.timeRemaining < 5 && env.timeRemaining > 0) {
    addFeedback('Less than 5 seconds left! Decide quickly!', 'danger');
  }
}

// ==========================================
// SECTION 10: WIN/LOSE CHECKS
// ==========================================

function checkWinLose() {
  // Game Over conditions (checked every frame during baking)
  if (env.timeRemaining <= 0 && state.currentStep === STEPS.BAKE) {
    endGame('gameover', 'Time ran out! The cake wasn\'t finished.');
    return;
  }
  // Severe instability
  if (!env.cakeStability && env.cakeHeight < CAKE_HEIGHT_RAW) {
    endGame('gameover', 'Cake collapsed completely!');
    return;
  }
}

// ==========================================
// SECTION 11: GAME LOOP
// ==========================================

var lastTimestamp = 0;

function gameLoop(timestamp) {
  var dt = 0;
  if (lastTimestamp > 0) {
    dt = (timestamp - lastTimestamp) / 1000;
    dt = Math.min(dt, 0.1); // cap at 100ms to prevent jumps
  }
  lastTimestamp = timestamp;

  state.animTime += dt;

  if (state.isPlaying && state.currentStep === STEPS.BAKE) {
    if (state.ovenClosing) {
      // Oven door closing animation (1.5 seconds)
      state.ovenCloseProgress += dt / 1.5;
      if (state.ovenCloseProgress >= 1) {
        state.ovenClosing = false;
        state.ovenCloseProgress = 1;
        // Enable controls now
        document.getElementById('sliderTemp').disabled = false;
        document.getElementById('btnTakeOut').disabled = false;
        document.getElementById('btnOpenOven').disabled = false;
        updateTimeDisplay();
        addFeedback('Step 3: The cake is in the oven. Monitor temperature and time!', 'good');
        if (DIFFICULTY[state.difficulty].tempFixed) {
          addFeedback('L1: Temperature is fixed at ' + DIFFICULTY[state.difficulty].targetTemp + '°C. Watch the cake and take it out when ready.', 'good');
        }
        // Pulse Take Out button to guide player
        document.getElementById('btnTakeOut').classList.add('btn-pulse');
      }
    } else {
      updateBaking(dt);
      checkFeedback();
      checkWinLose();
      updateBakeDisplay();
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}

function updateBaking(dt) {
  var diff = DIFFICULTY[state.difficulty];

  // Temperature update
  if (diff.tempFixed) {
    env.ovenTemp = diff.targetTemp;
  } else {
    // Natural fluctuation
    var fluctuation = diff.fluctuation;
    env.ovenTemp += (Math.random() - 0.5) * fluctuation * dt * 2;
    // Player influence (slider adjustment)
    env.ovenTemp += (player.selectedTemp - env.ovenTemp) * 0.3 * dt;
  }

  // Oven door effect
  if (env.ovenDoorOpen) {
    env.ovenTemp -= 25 * dt;
  }

  // Clamp temperature
  env.ovenTemp = Math.max(TEMP_MIN, Math.min(TEMP_MAX, env.ovenTemp));

  // Time countdown
  env.timeRemaining -= dt;

  // Cake rising
  var risingRate = calcRisingRate();
  env.cakeHeight += risingRate * dt;
  env.cakeHeight = Math.max(0, Math.min(CAKE_HEIGHT_MAX, env.cakeHeight));

  // Surface texture progression
  var surfProgress = calcSurfaceProgress();
  if (surfProgress > 0) {
    env.surfaceTexture += surfProgress * dt;
    env.surfaceTexture = Math.min(3, env.surfaceTexture);
  }

  // Baking progress (rawness decreases)
  env.cakeRawness -= calcBakingRate() * dt;
  env.cakeRawness = Math.max(0, env.cakeRawness);

  // Dryness accumulation
  env.cakeDryness += calcDrynessRate() * dt;
  env.cakeDryness = Math.max(0, Math.min(1, env.cakeDryness));

  // Stability check
  if (env.ovenTemp >= TEMP_DANGER && env.cakeHeight > 3) {
    env.cakeStability = false;
  }
  if (env.cakeHeight < CAKE_HEIGHT_RAW && env.cakeRawness < 0.3) {
    env.cakeStability = false;
  }
}

// ==========================================
// SECTION 12: UI UPDATE FUNCTIONS
// ==========================================

function showStepControls(step) {
  // Remove pulse from all buttons first
  document.querySelectorAll('.btn-pulse').forEach(function(b) { b.classList.remove('btn-pulse'); });

  var ids = ['controlsStart', 'controlsMix', 'controlsPour', 'controlsBake', 'controlsCheck', 'controlsDecorate'];
  ids.forEach(function(id) {
    document.getElementById(id).classList.remove('active');
  });
  var target = step === -1 ? 'controlsStart' : ids[step + 1];
  var panel = document.getElementById(target);
  panel.classList.add('active');

  // Add pulse animation to the primary action button in the active panel
  var pulseBtn = panel.querySelector('.btn-primary, .btn-danger');
  if (pulseBtn) {
    pulseBtn.classList.add('btn-pulse');
  }
}

function updateStepIndicator() {
  var el = document.getElementById('stepIndicator');
  if (state.currentStep === -1) {
    el.textContent = 'Select Difficulty';
  } else {
    el.textContent = 'Step ' + (state.currentStep + 1) + ': ' + STEP_NAMES[state.currentStep];
  }
}

function updateStepProgress() {
  var dots = document.querySelectorAll('.step-dot');
  dots.forEach(function(d, i) {
    d.classList.remove('active', 'completed');
    if (i < state.currentStep) d.classList.add('completed');
    if (i === state.currentStep) d.classList.add('active');
  });
}

function resetStepProgress() {
  var dots = document.querySelectorAll('.step-dot');
  dots.forEach(function(d) {
    d.classList.remove('active', 'completed');
  });
}

function updateTimeDisplay() {
  document.getElementById('valTime').textContent = Math.ceil(env.timeRemaining) + 's';
  var ratio = env.timeRemaining / DIFFICULTY[state.difficulty].time;
  document.getElementById('timeBar').style.width = (ratio * 100) + '%';
}

function updateBakeDisplay() {
  updateTimeDisplay();

  // Height bar
  var heightRatio = env.cakeHeight / CAKE_HEIGHT_MAX;
  document.getElementById('heightBar').style.width = (heightRatio * 100) + '%';

  // Surface label
  var surfIdx = Math.floor(env.surfaceTexture);
  surfIdx = Math.min(surfIdx, 3);
  document.getElementById('valSurface').textContent = SURFACE_ORDER[surfIdx];
}

function updateCheckDisplay() {
  var heightRatio = env.cakeHeight / CAKE_HEIGHT_MAX;
  document.getElementById('checkHeightBar').style.width = (heightRatio * 100) + '%';
  document.getElementById('checkRawBar').style.width = (env.cakeRawness * 100) + '%';
  document.getElementById('checkDryBar').style.width = (env.cakeDryness * 100) + '%';
  document.getElementById('valStability').textContent = env.cakeStability ? 'Stable' : 'Collapsed!';
  document.getElementById('valStability').style.color = env.cakeStability ? '#4caf50' : '#f44336';

  var surfIdx = Math.min(Math.floor(env.surfaceTexture), 3);
  document.getElementById('valCheckSurface').textContent = SURFACE_ORDER[surfIdx];
}

// ==========================================
// SECTION 13: INITIALIZATION
// ==========================================

function init() {
  initCanvas();
  selectDifficulty(0);
  state.currentStep = -1;
  requestAnimationFrame(gameLoop);
}

window.addEventListener('load', init);
