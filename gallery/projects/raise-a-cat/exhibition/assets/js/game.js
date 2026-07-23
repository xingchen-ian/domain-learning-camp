/*
 * ============================================================
 * Raise a Cat Successfully — Game Engine
 * Track A: Pure HTML/CSS/JavaScript + Canvas 2D
 * ============================================================
 *
 * CORE LEARNING SHIFT:
 *   Beginners think pet keeping = just feeding + having fun.
 *   Experts know it means CHANGING METHODS based on the cat's
 *   physical condition AND personality.
 *
 * CORE LOOP: Observe → Judge → Act → Read Feedback → Adjust
 *
 * DATA SEPARATION:
 *   - Environment Data  : cat stats, behaviors, signals
 *   - Player Data       : actions the player chooses
 *   - Calculated Results: stat changes, feedback, outcomes
 * ============================================================
 */

// ============================================================
// SECTION 1 — CHALLENGE PRESETS (Cat Definitions)
//   Each preset changes system variables & relationships,
//   not just visual decoration.
// ============================================================

const CAT_PRESETS = {
  mimi: {
    name: 'Mimi',
    tag: 'Balanced House Cat',
    color: '#e8a060',
    stripeColor: '#c97840',
    description: 'A well-adjusted house cat with standard needs. Responds well to regular feeding, play, and grooming. A good choice for learning the basics.',
    // --- Personality modifiers (change system relationships) ---
    affectionRate: 1.0,        // normal affection growth from interaction
    fullnessDecay: 1.0,        // normal hunger rate
    energyDecay: 1.0,          // normal energy use
    depressionRate: 1.0,       // normal affection loss when neglected
    foodPreference: 'any',    // accepts any food type
    interactionTolerance: 999, // won't get overwhelmed by interaction
    illnessResistance: 1.0,    // normal immunity
    // --- Starting stats ---
    startHealth: 80,
    startAffection: 50,
    startEnergy: 70,
  },
  shadow: {
    name: 'Shadow',
    tag: 'Formerly Stray',
    color: '#6b6b6b',
    stripeColor: '#4a4a4a',
    description: 'Rescued from the street. Distrustful of humans — affection grows slowly. Has a sensitive stomach: wet food makes her sick. Needs patience, gentle interaction, and special diet food.',
    affectionRate: 0.5,        // affection grows HALF as fast
    fullnessDecay: 0.9,
    energyDecay: 0.8,
    depressionRate: 1.2,       // loses affection faster when neglected
    foodPreference: 'special', // wet food causes health damage
    interactionTolerance: 3,   // too many interactions at once → scared → affection drops
    illnessResistance: 0.8,    // weaker immune system
    startHealth: 65,
    startAffection: 15,
    startEnergy: 60,
  },
  bounce: {
    name: 'Bounce',
    tag: 'High Energy',
    color: '#d4a574',
    stripeColor: '#b8860b',
    description: 'Extremely energetic! Burns through food fast and needs lots of play. Gets depressed quickly without interaction. But play gives bonus affection — a rewarding cat for active owners.',
    affectionRate: 1.3,        // extra affection from PLAY specifically
    fullnessDecay: 1.6,        // burns food 60% faster
    energyDecay: 1.5,
    depressionRate: 1.5,       // gets depressed fast without attention
    foodPreference: 'any',
    interactionTolerance: 999,
    illnessResistance: 1.1,    // slightly stronger immunity
    startHealth: 85,
    startAffection: 40,
    startEnergy: 90,
  },
};

// Food types — each affects fullness and health differently
const FOOD_TYPES = {
  dry:    { name: 'Dry Food',   fullness: 18, healthBonus: 0,  cost: 0 },
  wet:    { name: 'Wet Food',   fullness: 30, healthBonus: 2,  cost: 0 },
  special:{ name: 'Special Diet',fullness: 22, healthBonus: 5,  cost: 0 },
};

// ============================================================
// SECTION 2 — GAME STATE (Environment Data)
// ============================================================

let game = null;  // Will be initialized on game start

function createGameState(presetKey) {
  const p = CAT_PRESETS[presetKey];
  return {
    // --- Which cat ---
    presetKey: presetKey,
    preset: p,

    // --- Cat stats (Environment Data) ---
    fullness: 60,
    water: 60,
    health: p.startHealth,
    affection: p.startAffection,
    energy: p.startEnergy,
    cleanliness: 70,
    age: 0,               // in years (starts as kitten)

    // --- Cat behavior state ---
    catState: 'sitting',  // sitting, sleeping, playing, eating, sick
    catAnimTime: 0,        // animation timer
    tailFlick: 0,          // 0-1, how much tail is flicking (happiness)
    happyTimer: 0,         // countdown for happy animation
    sickTimer: 0,          // how long cat has been sick
    sleepingTimer: 0,      // how long cat has been sleeping
    overeatTimer: 0,       // how long cat has been overeating (fullness > 95)
    dehydrationTimer: 0,   // how long cat has had zero water
    eatingTimer: 0,        // how long cat has been eating
    playingTimer: 0,       // how long cat has been playing
    dyingTimer: 0,         // how long health has been at 0 (grace period before death)

    // --- Signal timers ---
    hungerSignalShown: false,
    sicknessSignalShown: false,
    playfulnessSignalShown: false,
    lastInteractionTime: 0,  // game-time of last interaction
    interactionStreak: 0,   // consecutive interactions (for Shadow)

    // --- Player-controlled settings ---
    selectedFoodType: 'dry',
    foodInBowl: 0,          // amount of food currently in bowl
    waterInBowl: 50,        // amount of water in bowl
    isOutdoors: false,      // cat is taken outside or staying home

    // --- Flags ---
    isVaccinated: false,
    gameRunning: true,
    gameOver: false,
    gameWon: false,
    endReason: '',

    // --- Timers ---
    gameTime: 0,           // total game time in seconds
    realTime: 0,           // real seconds elapsed
    realStartTime: 0,      // performance.now() at game start — used for grace period
    gracePeriodWarned: false,
    graceEnded: false,

    // --- Messages ---
    messages: [],
  };
}

// ============================================================
// SECTION 3 — GAME TIME & SPEED
//   1 real second ≈ 10 game days
//   15 years = 5475 days ≈ 547 real seconds ≈ 9 minutes
// ============================================================

const GAME_DAYS_PER_SECOND = 10;
const GAME_SPEED = 5.0;  // time multiplier: 3.0 = three times as fast
const YEARS_PER_GAME_DAY = 1 / 365;

// Stat decay rates per real second (already adjusted for game speed)
const DECAY = {
  fullness: 1.0,    // per second (slower, so player has time to manage)
  water: 2.5,
  energy: 0.8,
  cleanliness: 0.6,
  affection: 0.15,  // base decay; modified by personality
};

// ============================================================
// SECTION 4 — CANVAS RENDERING
// ============================================================

let canvas, ctx;

function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  // Set canvas resolution for crisp rendering
  canvas.width = 800;
  canvas.height = 500;
}

/* Draw the room/background scene */
function drawScene() {
  const w = canvas.width;
  const h = canvas.height;

  // Wall (top portion)
  ctx.fillStyle = game.isOutdoors ? '#87b87a' : '#f0d9b5';
  ctx.fillRect(0, 0, w, h * 0.65);

  // Floor (bottom portion)
  ctx.fillStyle = game.isOutdoors ? '#6fa05a' : '#d4a76a';
  ctx.fillRect(0, h * 0.65, w, h * 0.35);

  // Floor line
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.65);
  ctx.lineTo(w, h * 0.65);
  ctx.stroke();

  // Window on the wall (if indoors)
  if (!game.isOutdoors) {
    ctx.fillStyle = '#a8d4f0';
    ctx.fillRect(w * 0.05, h * 0.1, 120, 100);
    ctx.strokeStyle = '#8a7055';
    ctx.lineWidth = 4;
    ctx.strokeRect(w * 0.05, h * 0.1, 120, 100);
    // Window cross
    ctx.beginPath();
    ctx.moveTo(w * 0.05 + 60, h * 0.1);
    ctx.lineTo(w * 0.05 + 60, h * 0.1 + 100);
    ctx.moveTo(w * 0.05, h * 0.1 + 50);
    ctx.lineTo(w * 0.05 + 120, h * 0.1 + 50);
    ctx.stroke();
  } else {
    // Sun (outdoors)
    ctx.fillStyle = '#f0e060';
    ctx.beginPath();
    ctx.arc(w * 0.12, h * 0.15, 35, 0, Math.PI * 2);
    ctx.fill();
    // Grass details
    ctx.fillStyle = '#5a8a45';
    for (let i = 0; i < 8; i++) {
      const x = (w / 8) * i + 30;
      ctx.fillRect(x, h * 0.7, 3, 8);
      ctx.fillRect(x + 15, h * 0.72, 3, 6);
    }
  }

  // Food bowl (bottom-left)
  drawBowl(w * 0.12, h * 0.82, 'food');

  // Water bowl (next to food bowl)
  drawBowl(w * 0.24, h * 0.82, 'water');

  // Cat bed (bottom-right area, behind cat)
  drawCatBed(w * 0.65, h * 0.75);
}

function drawBowl(cx, cy, type) {
  // Bowl shape
  ctx.fillStyle = type === 'food' ? '#d4762a' : '#3a9ee8';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 35, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = type === 'food' ? '#f0b870' : '#6ab4f0';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 32, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Contents
  if (type === 'food') {
    if (game.foodInBowl > 0) {
      ctx.fillStyle = '#8b6914';
      const fillRatio = Math.min(game.foodInBowl / 50, 1);
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 28 * fillRatio, 8 * fillRatio, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    if (game.waterInBowl > 0) {
      ctx.fillStyle = 'rgba(58, 158, 232, 0.7)';
      const fillRatio = Math.min(game.waterInBowl / 50, 1);
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 28 * fillRatio, 8 * fillRatio, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Label
  ctx.fillStyle = '#5a4a3a';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(type === 'food' ? Math.round(game.foodInBowl) + 'g' : Math.round(game.waterInBowl) + 'ml', cx, cy + 30);
}

function drawCatBed(cx, cy) {
  ctx.fillStyle = '#c47a5a';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 60, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8a080';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 3, 50, 16, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* Draw the cat — the main visual element */
function drawCat() {
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.7;
  const p = game.preset;
  const t = game.catAnimTime;

  // Sickness: dim lighting overlay
  if (game.health < 30) {
    const dimness = 1 - (game.health / 30) * 0.6;
    ctx.fillStyle = `rgba(0, 0, 0, ${(1 - dimness) * 0.5})`;
  }

  // Playfulness glow (when cat wants to play)
  if (game.playfulnessSignalShown && !game.sicknessSignalShown) {
    const glowRadius = 100 + Math.sin(t * 0.005) * 10;
    const gradient = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, glowRadius);
    gradient.addColorStop(0, 'rgba(255, 235, 130, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 235, 130, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - glowRadius, cy - glowRadius - 20, glowRadius * 2, glowRadius * 2);
  }

  // --- Cat body & position depends on state ---
  const state = game.catState;
  let bodyOffsetY = 0;
  let bodyRotation = 0;
  let eyeOpen = true;

  if (state === 'sleeping') {
    bodyOffsetY = 15;
    bodyRotation = -0.3;
    eyeOpen = false;
  } else if (state === 'sick') {
    bodyOffsetY = 20;
    eyeOpen = false;
  } else if (state === 'playing') {
    bodyOffsetY = -Math.abs(Math.sin(t * 0.01)) * 15;
  } else if (state === 'eating') {
    bodyRotation = 0.2;
  }

  ctx.save();
  ctx.translate(cx, cy + bodyOffsetY);
  ctx.rotate(bodyRotation);

  // --- Tail ---
  const tailWag = game.tailFlick > 0 ? Math.sin(t * 0.02) * game.tailFlick * 20 : Math.sin(t * 0.003) * 5;
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-35, -5);
  ctx.quadraticCurveTo(-55, -15 - tailWag, -50, -40 - tailWag);
  ctx.stroke();

  // --- Body (ellipse) ---
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 40, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stripes on body
  ctx.strokeStyle = p.stripeColor;
  ctx.lineWidth = 3;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 12, -20);
    ctx.quadraticCurveTo(i * 12 + 3, 0, i * 12, 20);
    ctx.stroke();
  }

  // --- Legs ---
  ctx.fillStyle = p.color;
  ctx.fillRect(-25, 18, 10, 15);
  ctx.fillRect(15, 18, 10, 15);

  // --- Head ---
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(35, -10, 22, 0, Math.PI * 2);
  ctx.fill();

  // Ears (triangles)
  ctx.beginPath();
  ctx.moveTo(20, -25);
  ctx.lineTo(25, -38);
  ctx.lineTo(32, -22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(42, -28);
  ctx.lineTo(50, -38);
  ctx.lineTo(48, -20);
  ctx.closePath();
  ctx.fill();

  // Inner ears (pink)
  ctx.fillStyle = '#e8a0a0';
  ctx.beginPath();
  ctx.moveTo(24, -30);
  ctx.lineTo(27, -35);
  ctx.lineTo(29, -25);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(45, -30);
  ctx.lineTo(48, -35);
  ctx.lineTo(46, -23);
  ctx.closePath();
  ctx.fill();

  // --- Eyes ---
  if (eyeOpen) {
    // Normal eyes
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(28, -12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(42, -12, 4, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(29, -13, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(43, -13, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Closed eyes (sleeping/sick) — curved lines
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(28, -12, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(42, -12, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  // --- Nose ---
  ctx.fillStyle = '#e88080';
  ctx.beginPath();
  ctx.moveTo(34, -4);
  ctx.lineTo(37, -4);
  ctx.lineTo(35.5, -1);
  ctx.closePath();
  ctx.fill();

  // --- Mouth ---
  ctx.strokeStyle = '#5a3a2a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(35.5, -1);
  ctx.quadraticCurveTo(32, 2, 30, 0);
  ctx.moveTo(35.5, -1);
  ctx.quadraticCurveTo(39, 2, 41, 0);
  ctx.stroke();

  // --- Whiskers ---
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, -6); ctx.lineTo(8, -10);
  ctx.moveTo(20, -4); ctx.lineTo(8, -4);
  ctx.moveTo(20, -2); ctx.lineTo(8, 2);
  ctx.moveTo(51, -6); ctx.lineTo(62, -10);
  ctx.moveTo(51, -4); ctx.lineTo(62, -4);
  ctx.moveTo(51, -2); ctx.lineTo(62, 2);
  ctx.stroke();

  // --- Happiness indicator: hearts when very happy ---
  if (game.happyTimer > 0) {
    const heartY = -50 - (1 - game.happyTimer / 60) * 30;
    ctx.fillStyle = '#e8447a';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u2665', 10, heartY);
  }

  ctx.restore();

  // --- Sickness overlay (dim the whole scene) ---
  if (game.health < 30) {
    const dimAlpha = (1 - game.health / 30) * 0.4;
    ctx.fillStyle = `rgba(20, 10, 0, ${dimAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // --- Critical health warning: red pulsing border ---
  if (game.health < 20) {
    const pulse = Math.sin(Date.now() / 300) * 0.5 + 0.5; // 0..1 pulsing
    const borderAlpha = (1 - game.health / 20) * pulse * 0.6;
    // Red border frame
    ctx.strokeStyle = `rgba(200, 30, 30, ${borderAlpha})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    // Red vignette edges
    const vAlpha = (1 - game.health / 20) * pulse * 0.15;
    const gradient = ctx.createRadialGradient(cx, cy, canvas.width * 0.3, cx, cy, canvas.width);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, `rgba(180, 0, 0, ${vAlpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // --- Cat name label ---
  ctx.fillStyle = '#3d2b1f';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p.name, cx, cy + 60);

  // --- Status text above cat ---
  let statusText = '';
  if (state === 'sleeping') statusText = 'Zzz... sleeping';
  else if (state === 'sick') statusText = '... not feeling well ...';
  else if (state === 'playing') statusText = 'Playing! \u2665';
  else if (state === 'eating') statusText = 'Nom nom...';
  else if (game.hungerSignalShown) statusText = 'Meow! (hungry)';
  else if (game.playfulnessSignalShown) statusText = 'Wants to play!';

  if (statusText) {
    ctx.fillStyle = '#5a4a3a';
    ctx.font = 'italic 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(statusText, cx, cy - 55);
  }
}

/* Critical health warning — large text overlay */
function drawWarnings() {
  if (game.health >= 20 || game.gameOver) return;

  const cx = canvas.width / 2;
  const now = Date.now() / 1000;

  // Large warning banner at top
  if (game.health < 10) {
    // Near death — huge flashing red text
    const flash = Math.sin(now * 8) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = `rgba(255, 0, 0, ${flash})`;
    ctx.shadowBlur = 30;

    // Dark red background banner
    const bannerH = game.health <= 0 ? 90 : 60;
    ctx.fillStyle = `rgba(180, 20, 20, 0.75)`;
    ctx.fillRect(0, canvas.height * 0.12, canvas.width, bannerH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CAT IS DYING!  SAVE IT NOW!', cx, canvas.height * 0.12 + 38);

    // Countdown or second line
    if (game.health <= 0 && game.dyingTimer > 0) {
      const remaining = Math.max(0, Math.ceil(40 - game.dyingTimer / GAME_SPEED));
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('DEATH IN ' + remaining + 's !  死亡倒计时: ' + remaining + '秒', cx, canvas.height * 0.12 + 65);
    } else {
      ctx.fillStyle = '#ffaaaa';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('猫快要死了！立刻行动！', cx, canvas.height * 0.12 + 65);
    }

    ctx.restore();
  } else {
    // Health < 20 — danger warning
    ctx.save();
    ctx.shadowColor = 'rgba(255, 100, 0, 0.5)';
    ctx.shadowBlur = 20;

    // Orange-red banner
    ctx.fillStyle = 'rgba(200, 80, 20, 0.7)';
    ctx.fillRect(0, canvas.height * 0.18, canvas.width, 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DANGER!  猫健康状况危急！', cx, canvas.height * 0.18 + 34);

    ctx.restore();
  }
}

/* Main render function */
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawScene();
  drawCat();
  drawWarnings();
}

// ============================================================
// SECTION 5 — AUDIO (Web Audio API — synthesized meow)
//   No external audio files needed.
// ============================================================

let audioCtx = null;

function playMeow(pitch = 1) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600 * pitch, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400 * pitch, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    // Audio not available — silently ignore
  }
}

function playHappySound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.2);
  } catch (e) {}
}

// ============================================================
// SECTION 6 — GAME LOGIC (update each frame)
//   This is where Environment Data changes over time and
//   System-Calculated Results are computed.
// ============================================================

function updateGame(deltaSec) {
  if (!game || game.gameOver) return;

  const rawDelta = deltaSec;  // real seconds — used for health (not affected by game speed)
  deltaSec *= GAME_SPEED;  // apply game speed multiplier
  const p = game.preset;
  game.gameTime += deltaSec;
  game.realTime += deltaSec;
  game.catAnimTime += deltaSec * 1000;

  // --- Age progression ---
  // 1 real second = 10 game days; age in years = gameDays / 365
  const gameDays = deltaSec * GAME_DAYS_PER_SECOND;
  game.age += gameDays * YEARS_PER_GAME_DAY;

  // --- Stat decay over time (modified by personality) ---
  game.fullness -= DECAY.fullness * p.fullnessDecay * deltaSec;
  game.water -= DECAY.water * deltaSec;
  game.energy -= DECAY.energy * p.energyDecay * deltaSec;
  game.cleanliness -= DECAY.cleanliness * deltaSec;
  game.affection -= DECAY.affection * p.depressionRate * deltaSec;

  // --- Cat eats from bowl if food is available ---
  // Don't override sleeping/sick state — cat won't eat while asleep or sick
  if (game.foodInBowl > 0 && game.catState !== 'sleeping' && game.catState !== 'sick') {
    const eatAmount = Math.min(game.foodInBowl, 1.0 * deltaSec);
    game.foodInBowl -= eatAmount;
    game.fullness += eatAmount * 3.0;
    game.catState = 'eating';
    game.eatingTimer = (game.eatingTimer || 0) + deltaSec;
    if (game.eatingTimer > 1.5) {
      game.catState = 'sitting';
      game.eatingTimer = 0;
    }
  }

  // --- Cat drinks from bowl ---
  if (game.waterInBowl > 0) {
    const drinkAmount = Math.min(game.waterInBowl, 2.0 * deltaSec);
    game.waterInBowl -= drinkAmount;
    game.water += drinkAmount * 3.0;
  }

  // --- Health calculation (based on other stats) ---
  let healthDelta = 0;
  // Too little food → health drops (slower, gives player time to notice)
  if (game.fullness < 15) healthDelta -= 0.8 * rawDelta * p.illnessResistance;

  // === OVERFEEDING: fullness > 95 for too long → severe health damage, can kill ===
  if (game.fullness > 95) {
    game.overeatTimer += deltaSec;
    if (game.overeatTimer > 8) {
      // After 8s of overeating, health drops — gives player plenty of time
      const overeatDamage = 2 * rawDelta;
      healthDelta -= overeatDamage;
      if (!game._warnedOvereat || game._warnedOvereat < game.overeatTimer - 8) {
        game._warnedOvereat = game.overeatTimer;
        addMessage('\u26A0\uFE0F DANGER: ' + game.preset.name + ' is overeating! Remove food or cat may die!');
      }
    }
  } else {
    // Reset overeat timer when fullness drops below 95
    if (game.overeatTimer > 0) {
      if (game.overeatTimer > 5) {
        addMessage(game.preset.name + ' is no longer overeating. That was close.');
      }
      game.overeatTimer = 0;
      game._warnedOvereat = 0;
    }
  }

  // Dehydration → health drops
  if (game.water < 15) healthDelta -= 0.8 * rawDelta * p.illnessResistance;

  // === DEHYDRATION: water = 0 → cat gets sick ===
  if (game.water <= 0) {
    game.dehydrationTimer += deltaSec;
    if (game.dehydrationTimer > 2 && game.catState !== 'sick') {
      game.catState = 'sick';
      game.sickTimer = 0;
      addMessage('\u{1F4A7} ' + game.preset.name + ' got sick from dehydration! Always keep the water bowl full.');
    }
  } else {
    game.dehydrationTimer = 0;
  }

  // Dirty cat → health drops slowly
  if (game.cleanliness < 20) healthDelta -= 0.5 * rawDelta;
  // Sick cat → health drops faster
  if (game.catState === 'sick') healthDelta -= 1.2 * rawDelta;
  // Vaccinated → small health bonus
  if (game.isVaccinated && game.health < 70) healthDelta += 0.5 * rawDelta;
  // Good condition → slow natural health recovery
  if (game.fullness > 50 && game.water > 50 && game.cleanliness > 50 && game.catState !== 'sick') {
    healthDelta += 0.8 * rawDelta;
  }
  game.health += healthDelta;

  // --- Energy recovery from sleeping ---
  if (game.catState === 'sleeping') {
    game.energy += 5 * deltaSec;
  }

  // --- Clamp all stats to 0-100 ---
  game.fullness = clamp(game.fullness, 0, 100);
  game.water = clamp(game.water, 0, 100);
  game.health = clamp(game.health, 0, 100);
  game.affection = clamp(game.affection, 0, 100);
  game.energy = clamp(game.energy, 0, 100);
  game.cleanliness = clamp(game.cleanliness, 0, 100);

  // --- Dying grace period: health at 0 starts countdown before game over ---
  if (game.health <= 0) {
    game.dyingTimer += deltaSec;
    game.catState = 'sick';
    if (!game._dyingWarned || game._dyingWarned < game.dyingTimer - 5) {
      game._dyingWarned = game.dyingTimer;
      const remaining = Math.max(0, Math.ceil(40 - game.dyingTimer / GAME_SPEED));
      addMessage('CRITICAL: Cat is dying! ' + remaining + 's left to save it!');
    }
  } else {
    game.dyingTimer = 0;
    game._dyingWarned = 0;
  }

  // --- Cat behavior decisions ---
  updateCatBehavior(deltaSec);

  // --- Signal checks ---
  updateSignals();

  // --- Timers ---
  if (game.happyTimer > 0) game.happyTimer -= deltaSec * 60;
  if (game.tailFlick > 0) game.tailFlick -= deltaSec * 0.5;
  game.lastInteractionTime += deltaSec;

  // Reset interaction streak after a pause (Shadow's tolerance mechanic)
  if (game.lastInteractionTime > 3 && game.interactionStreak > 0) {
    game.interactionStreak = 0;
  }

  // --- Check game over ---
  checkGameOver();
}

function updateCatBehavior(deltaSec) {
  // Cat becomes sick if health is very low
  if (game.health < 25 && game.catState !== 'sick' && game.catState !== 'sleeping') {
    game.catState = 'sick';
    game.sickTimer = 0;
    addMessage(game.preset.name + ' seems sick. The light looks dim...');
  }

  // Cat recovers from sickness if health improves
  if (game.catState === 'sick' && game.health > 50) {
    game.catState = 'sitting';
    addMessage(game.preset.name + ' is feeling better!');
  }

  if (game.catState === 'sick') {
    game.sickTimer += deltaSec;
    return; // sick cats don't do other things
  }

  // Cat sleeps when energy is low
  if (game.energy < 20 && game.catState !== 'sleeping' && game.catState !== 'eating') {
    game.catState = 'sleeping';
    game.sleepingTimer = 0;
  }

  // Cat wakes up when energy is restored
  if (game.catState === 'sleeping') {
    game.sleepingTimer += deltaSec;
    if (game.energy > 80 || game.sleepingTimer > 8) {
      game.catState = 'sitting';
      game.sleepingTimer = 0;
    }
    return;
  }

  // Cat goes back to sitting after playing
  if (game.catState === 'playing') {
    game.playingTimer = (game.playingTimer || 0) + deltaSec;
    if (game.playingTimer > 2) {
      game.catState = 'sitting';
      game.playingTimer = 0;
    }
  }
}

function updateSignals() {
  // --- Hunger signal ---
  if (game.fullness < 30 && !game.hungerSignalShown) {
    game.hungerSignalShown = true;
    addMessage(game.preset.name + ' is meowing for food!');
    playMeow();
  }
  if (game.fullness > 50) {
    game.hungerSignalShown = false;
  }

  // --- Sickness signal ---
  if (game.health < 30 && !game.sicknessSignalShown) {
    game.sicknessSignalShown = true;
    addMessage('\u26A0\uFE0F Warning: ' + game.preset.name + ' looks sick! The light is dim. Check food, water, and cleanliness!');
  }
  if (game.health > 50) {
    game.sicknessSignalShown = false;
  }

  // --- Critical warning: health < 20 ---
  if (game.health < 20) {
    game._criticalTimer = (game._criticalTimer || 0) + (1/60); // approximate per-frame
    if (game._criticalTimer > 5 && !game._criticalWarned) {
      game._criticalWarned = true;
      addMessage('\uD83D\uDD34 CRITICAL: ' + game.preset.name + ' is in danger! Health is very low — act NOW!');
    }
  } else {
    game._criticalTimer = 0;
    game._criticalWarned = false;
  }

  // --- Near-death warning: health < 10, repeat every 3s ---
  if (game.health < 10) {
    game._deathTimer = (game._deathTimer || 0) + (1/60);
    if (game._deathTimer > 3) {
      game._deathTimer = 0;
      addMessage('\uD83D\uDD34\u26A0\uFE0F ' + game.preset.name + ' is about to die!!! Save your cat immediately!!!');
    }
  } else {
    game._deathTimer = 0;
  }

  // --- Playfulness signal (appears after lack of interaction) ---
  const timeSinceInteraction = game.lastInteractionTime;
  if (timeSinceInteraction > 8 && !game.playfulnessSignalShown && game.catState !== 'sick' && game.catState !== 'sleeping') {
    game.playfulnessSignalShown = true;
    addMessage(game.preset.name + ' seems to want some attention...');
  }
  if (timeSinceInteraction < 3) {
    game.playfulnessSignalShown = false;
  }
}

// ============================================================
// SECTION 7 — PLAYER ACTIONS (Player-Controlled Data)
//   Each action modifies system variables based on the cat's
//   personality — the core of the learning shift.
// ============================================================

function actionAddFood(amount) {
  if (!game || game.gameOver) return;
  const food = FOOD_TYPES[game.selectedFoodType];
  game.foodInBowl += amount;
  game.foodInBowl = clamp(game.foodInBowl, 0, 100);
  addMessage('Added ' + amount + 'g of ' + food.name + ' to the bowl.');

  // Shadow gets sick from wet food (sensitive stomach)
  if (game.preset.foodPreference === 'special' && game.selectedFoodType === 'wet') {
    game.health -= 5;
    addMessage('Oh no! ' + game.preset.name + ' has a sensitive stomach. Wet food makes her sick!');
  }

  // Special diet food gives health bonus
  if (game.selectedFoodType === 'special') {
    game.health += food.healthBonus;
    addMessage('The special diet food is good for ' + game.preset.name + "'s health.");
  }
}

function actionReduceFood() {
  if (!game || game.gameOver) return;
  game.foodInBowl = Math.max(0, game.foodInBowl - 10);
  addMessage('Removed some food from the bowl.');
}

function actionSelectFood(type) {
  if (!game || game.gameOver) return;
  game.selectedFoodType = type;
  addMessage('Selected food: ' + FOOD_TYPES[type].name);
  updateFoodTypeButtons();
}

function actionAddWater() {
  if (!game || game.gameOver) return;
  game.waterInBowl = clamp(game.waterInBowl + 40, 0, 100);
  addMessage('Refilled the water bowl.');
}

function actionPet() {
  if (!game || game.gameOver) return;
  if (game.catState === 'sick') { addMessage(game.preset.name + ' is too sick to be petted.'); return; }
  if (game.catState === 'sleeping') { addMessage(game.preset.name + ' is sleeping. Don\'t disturb.'); return; }

  handleInteraction();
  const gain = 5 * game.preset.affectionRate;
  game.affection += gain;
  game.tailFlick = 0.6;
  game.happyTimer = 40;
  playHappySound();
  addMessage('Petted ' + game.preset.name + '. Affection +' + gain.toFixed(1));
}

function actionPlay() {
  if (!game || game.gameOver) return;
  if (game.catState === 'sick') { addMessage(game.preset.name + ' is too sick to play.'); return; }
  if (game.catState === 'sleeping') { addMessage(game.preset.name + ' is sleeping. Don\'t disturb.'); return; }
  if (game.energy < 15) { addMessage(game.preset.name + ' is too tired to play.'); return; }

  handleInteraction();
  // Bounce gets extra affection from play
  const playBonus = game.presetKey === 'bounce' ? 1.5 : 1.0;
  const gain = 10 * game.preset.affectionRate * playBonus;
  game.affection += gain;
  game.energy -= 12;
  game.tailFlick = 1.0;
  game.happyTimer = 60;
  game.catState = 'playing';
  game.playingTimer = 0;
  playHappySound();
  addMessage('Played with ' + game.preset.name + '! Affection +' + gain.toFixed(1) + ', Energy -12');
}

function actionHug() {
  if (!game || game.gameOver) return;
  if (game.catState === 'sick') { addMessage(game.preset.name + ' is too sick to be hugged.'); return; }
  if (game.catState === 'sleeping') { addMessage(game.preset.name + ' is sleeping. Don\'t disturb.'); return; }

  handleInteraction();
  // Shadow doesn't like being hugged (low trust)
  if (game.presetKey === 'shadow' && game.affection < 40) {
    game.affection -= 3;
    addMessage(game.preset.name + ' doesn\'t trust you enough for a hug. Affection -3. Be patient.');
    return;
  }
  const gain = 8 * game.preset.affectionRate;
  game.affection += gain;
  game.energy -= 3;
  game.tailFlick = 0.8;
  game.happyTimer = 50;
  playHappySound();
  addMessage('Hugged ' + game.preset.name + '. Affection +' + gain.toFixed(1));
}

function actionWash() {
  if (!game || game.gameOver) return;
  game.cleanliness += 40;
  // Cats often dislike water — small affection cost (except for water-loving breeds)
  game.affection -= 3;
  addMessage('Washed ' + game.preset.name + '. Cleanliness +40, Affection -3');
}

function actionCleanEars() {
  if (!game || game.gameOver) return;
  game.cleanliness += 15;
  game.health += 2;
  addMessage('Cleaned ' + game.preset.name + "'s ears. Cleanliness +15, Health +2");
}

function actionVet() {
  if (!game || game.gameOver) return;
  game.health += 30;
  game.catState = 'sitting';
  game.sicknessSignalShown = false;
  game.sickTimer = 0;
  addMessage('Took ' + game.preset.name + ' to the vet. Health +30!');
}

function actionVaccinate() {
  if (!game || game.gameOver) return;
  if (game.isVaccinated) {
    addMessage(game.preset.name + ' is already vaccinated.');
    return;
  }
  game.isVaccinated = true;
  game.health += 10;
  addMessage(game.preset.name + ' has been vaccinated! Health +10, illness resistance increased.');
}

function actionSleep() {
  if (!game || game.gameOver) return;
  if (game.catState === 'sick') { addMessage(game.preset.name + ' is too sick to sleep peacefully.'); return; }
  game.catState = 'sleeping';
  game.sleepingTimer = 0;
  addMessage('Put ' + game.preset.name + ' to bed. Energy will recover while sleeping.');
}

function actionTakeOut() {
  if (!game || game.gameOver) return;
  if (game.catState === 'sick') { addMessage(game.preset.name + ' is too sick to go outside.'); return; }
  game.isOutdoors = true;
  game.affection += 5 * game.preset.affectionRate;
  game.energy -= 5;
  // Going outside: small risk of getting dirty
  game.cleanliness -= 10;
  addMessage('Took ' + game.preset.name + ' outside for a walk! Affection +5, but got a bit dirty.');
}

function actionStayHome() {
  if (!game || game.gameOver) return;
  game.isOutdoors = false;
  addMessage(game.preset.name + ' is staying home.');
}

/* Track interactions for Shadow's tolerance mechanic */
function handleInteraction() {
  game.lastInteractionTime = 0;

  // Shadow gets scared if interacted with too rapidly
  if (game.preset.interactionTolerance < 999) {
    game.interactionStreak++;
    if (game.interactionStreak > game.preset.interactionTolerance) {
      game.affection -= 5;
      addMessage(game.preset.name + ' feels overwhelmed. Give her some space. Affection -5');
      game.interactionStreak = 0;
    }
  }

  // Reset streak after a pause (called from update when time passes)
  // This is handled by resetting lastInteractionTime
}

// ============================================================
// SECTION 8 — GAME OVER CONDITIONS
//   Success: cat reaches age 15 with health > 0 and affection > 20
//   Failure: cat dies (health = 0) or runs away (affection = 0)
// ============================================================

function checkGameOver() {
  if (game.gameOver) return;

  // --- Grace period: cat cannot die in the first 2 minutes (120 real seconds) ---
  const realElapsed = (performance.now() - game.realStartTime) / 1000;
  const GRACE_PERIOD = 120; // 2 minutes

  if (realElapsed < GRACE_PERIOD) {
    // Cat is protected — but if health/affection hit 0, clamp them to 1 so they survive
    if (game.health <= 0) {
      game.health = 1;
    }
    if (game.affection <= 0) {
      game.affection = 1;
    }
    // Warn the player once that the cat is in danger but protected
    if (!game.gracePeriodWarned && (game.health < 15 || game.affection < 15)) {
      game.gracePeriodWarned = true;
      const mins = Math.floor((GRACE_PERIOD - realElapsed) / 60);
      const secs = Math.round((GRACE_PERIOD - realElapsed) % 60);
      addMessage('⚠️ ' + game.preset.name + ' is in critical condition! But you are still learning — death is disabled for ' + mins + 'm ' + secs + 's. Act now to save your cat!');
    }
    return; // skip all death checks during grace period
  }

  // Warn once when grace period ends
  if (game.realStartTime > 0 && !game.graceEnded) {
    game.graceEnded = true;
    addMessage('⏰ Learning period over! From now on, ' + game.preset.name + ' can die if you neglect it. Stay alert!');
  }

  // --- Failure: health has been at 0 for 40 real seconds → death ---
  if (game.health <= 0 && game.dyingTimer >= 40 * GAME_SPEED) {
    let reason = '';
    if (game.fullness < 15) reason = game.preset.name + ' died of hunger. Always ensure there is enough food and water.';
    else if (game.water < 15) reason = game.preset.name + ' died of dehydration. Always keep the water bowl filled.';
    else if (game.overeatTimer > 8) reason = game.preset.name + ' died from overeating! Too much food is as dangerous as too little. Remove excess food!';
    else if (game.dehydrationTimer > 2) reason = game.preset.name + ' died of dehydration. Water is just as important as food. Refill the water bowl!';
    else if (game.affection < 10) reason = game.preset.name + ' became severely depressed. Pets need love and attention, not just food.';
    else reason = game.preset.name + ' died of illness. Take your cat to the vet when it acts abnormally!';
    endGame(false, reason);
    return;
  }

  // --- Failure: affection drops to 0 (cat runs away / abandoned) ---
  if (game.affection <= 0) {
    endGame(false, game.preset.name + ' felt abandoned and ran away. Pet keeping is about companionship, not just feeding.');
    return;
  }

  // --- Success: cat reaches age 15 ---
  if (game.age >= 15) {
    endGame(true, game.preset.name + ' lived a happy life to 15 years old! You are a responsible cat owner.');
  }
}

function endGame(won, reason) {
  game.gameOver = true;
  game.gameWon = won;
  game.endReason = reason;
  showGameOverScreen();
}

// ============================================================
// SECTION 9 — UI UPDATES
// ============================================================

function updateUI() {
  if (!game) return;

  // Update stat bars
  setStatBar('health', game.health);
  setStatBar('affection', game.affection);
  setStatBar('fullness', game.fullness);
  setStatBar('energy', game.energy);
  setStatBar('water', game.water);
  setStatBar('cleanliness', game.cleanliness);

  // Flash health bar when critical
  const healthBar = document.getElementById('healthBar');
  if (healthBar) {
    if (game.health < 20) {
      healthBar.classList.add('critical');
    } else {
      healthBar.classList.remove('critical');
    }
  }

  // Update info bar
  const nameEl = document.getElementById('catNameDisplay');
  const ageEl = document.getElementById('catAgeDisplay');
  if (nameEl) nameEl.textContent = game.preset.name + ' (' + game.preset.tag + ')';
  if (ageEl) ageEl.textContent = 'Age: ' + game.age.toFixed(1) + ' years';

  // Update vaccination status
  const vaccEl = document.getElementById('vaccStatus');
  if (vaccEl) vaccEl.textContent = game.isVaccinated ? 'Vaccinated' : 'Not vaccinated';

  // Update food type buttons
  updateFoodTypeButtons();

  // Update message log
  updateMessageLog();
}

function setStatBar(stat, value) {
  const fill = document.getElementById(stat + 'Bar');
  const text = document.getElementById(stat + 'Value');
  const delta = document.getElementById(stat + 'Delta');
  if (fill) fill.style.width = value + '%';
  if (text) text.textContent = Math.round(value);
  // Show per-second delta
  if (delta) {
    const d = computeStatDelta(stat);
    if (d > 0.5) {
      delta.textContent = '+' + d.toFixed(1) + '/s';
      delta.className = 'stat-delta positive';
    } else if (d < -0.5) {
      delta.textContent = d.toFixed(1) + '/s';
      delta.className = 'stat-delta negative';
    } else if (Math.abs(d) < 0.1) {
      delta.textContent = '\u2014';
      delta.className = 'stat-delta';
    } else {
      delta.textContent = (d > 0 ? '+' : '') + d.toFixed(1) + '/s';
      delta.className = 'stat-delta warning';
    }
  }
}

/* Compute the current change rate for each stat (per second) */
function computeStatDelta(stat) {
  const p = game.preset;
  switch (stat) {
    case 'health': {
      let d = 0;
      if (game.fullness < 15) d -= 0.8 * p.illnessResistance;
      if (game.fullness > 95 && game.overeatTimer > 8) d -= 2;
      if (game.water < 15) d -= 0.8 * p.illnessResistance;
      if (game.cleanliness < 20) d -= 0.5;
      if (game.catState === 'sick') d -= 1.2;
      if (game.isVaccinated && game.health < 70) d += 0.5;
      if (game.fullness > 50 && game.water > 50 && game.cleanliness > 50 && game.catState !== 'sick') d += 0.8;
      return d;
    }
    case 'affection':
      return game.catState === 'sick' ? -1.5 : -(DECAY.affection * p.depressionRate);
    case 'fullness': {
      let d = -(DECAY.fullness * p.fullnessDecay);
      if (game.foodInBowl > 0) d += 1.0 * 3.0; // eating rate
      return d;
    }
    case 'energy': {
      let d = -(DECAY.energy * p.energyDecay);
      if (game.catState === 'sleeping') d += 5;
      return d;
    }
    case 'water': {
      let d = -DECAY.water;
      if (game.waterInBowl > 0) d += 2.0 * 3.0; // drinking rate
      return d;
    }
    case 'cleanliness':
      return -DECAY.cleanliness;
    default: return 0;
  }
}

function updateFoodTypeButtons() {
  ['dry', 'wet', 'special'].forEach(type => {
    const btn = document.getElementById('foodType_' + type);
    if (btn) {
      btn.classList.toggle('active', game.selectedFoodType === type);
    }
  });
}

function addMessage(text) {
  game.messages.unshift({ text: text, time: game.realTime });
  if (game.messages.length > 20) game.messages.pop();
}

function updateMessageLog() {
  const logEl = document.getElementById('messageLog');
  if (!logEl) return;
  let html = '<h4>Activity Log</h4>';
  game.messages.slice(0, 8).forEach(msg => {
    html += '<div class="msg">' + msg.text + '</div>';
  });
  logEl.innerHTML = html;
}

// ============================================================
// SECTION 10 — GAME OVER SCREEN
// ============================================================

function showGameOverScreen() {
  const overlay = document.getElementById('gameOverlay');
  const title = document.getElementById('overlayTitle');
  const reason = document.getElementById('overlayReason');
  const summary = document.getElementById('overlayStats');

  title.textContent = game.gameWon ? '\u2728 Success!' : '\u{1F622} Game Over';
  title.className = game.gameWon ? 'win-title' : 'lose-title';
  reason.textContent = game.endReason;

  summary.innerHTML = `
    <div class="stat-line"><span>Cat:</span><strong>${game.preset.name} (${game.preset.tag})</strong></div>
    <div class="stat-line"><span>Age reached:</span><strong>${game.age.toFixed(1)} years</strong></div>
    <div class="stat-line"><span>Final Health:</span><strong>${Math.round(game.health)}/100</strong></div>
    <div class="stat-line"><span>Final Affection:</span><strong>${Math.round(game.affection)}/100</strong></div>
    <div class="stat-line"><span>Time played:</span><strong>${Math.round(game.realTime)} seconds</strong></div>
  `;

  overlay.style.display = 'flex';
}

function hideGameOverScreen() {
  const overlay = document.getElementById('gameOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ============================================================
// SECTION 11 — GAME FLOW (start, loop, restart)
// ============================================================

let lastTime = 0;
let animationId = null;

function startGame(presetKey) {
  game = createGameState(presetKey);
  game.realStartTime = performance.now();

  // Hide cat selection, show game
  document.getElementById('catSelectScreen').style.display = 'none';
  document.getElementById('gamePlayScreen').style.display = 'block';
  hideGameOverScreen();

  initCanvas();
  addMessage('You adopted ' + game.preset.name + '! Take good care of your new cat.');
  addMessage('Tip: Watch the stats and ' + game.preset.name + "'s behavior. Each cat is different!");

  lastTime = performance.now();
  if (animationId) cancelAnimationFrame(animationId);
  gameLoop();
}

function gameLoop(timestamp) {
  if (!game) return;
  if (!timestamp) timestamp = performance.now();
  const delta = Math.min((timestamp - lastTime) / 1000, 0.1); // cap at 100ms
  lastTime = timestamp;

  updateGame(delta);
  render();
  updateUI();

  if (!game.gameOver) {
    animationId = requestAnimationFrame(gameLoop);
  } else {
    render(); // final render
    updateUI();
  }
}

function restartGame() {
  hideGameOverScreen();
  document.getElementById('gamePlayScreen').style.display = 'none';
  document.getElementById('catSelectScreen').style.display = 'block';
  game = null;
  if (animationId) cancelAnimationFrame(animationId);
}

function endGameEarly() {
  if (!game || game.gameOver) return;
  if (game.age < 5) {
    endGame(false, 'You gave up too early. ' + game.preset.name + ' deserved a lifelong companion.');
  } else if (game.age < 15) {
    endGame(false, game.preset.name + ' lived to ' + game.age.toFixed(1) + ' years, but deserved a longer life. Try again!');
  }
}

// ============================================================
// SECTION 12 — UTILITY
// ============================================================

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ============================================================
// SECTION 13 — CAT SELECTION CANVAS PREVIEWS
//   Draw small cat previews on the selection cards.
// ============================================================

function drawCatPreview(canvasId, presetKey) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const cx = c.getContext('2d');
  c.width = 220;
  c.height = 160;
  const p = CAT_PRESETS[presetKey];

  // Background
  cx.fillStyle = '#f5e6d3';
  cx.fillRect(0, 0, c.width, c.height);

  // Simple cat drawing (mini version)
  const x = c.width / 2;
  const y = c.height / 2 + 10;

  // Body
  cx.fillStyle = p.color;
  cx.beginPath();
  cx.ellipse(x, y, 35, 24, 0, 0, Math.PI * 2);
  cx.fill();

  // Head
  cx.beginPath();
  cx.arc(x + 30, y - 10, 20, 0, Math.PI * 2);
  cx.fill();

  // Ears
  cx.beginPath();
  cx.moveTo(x + 18, y - 22);
  cx.lineTo(x + 22, y - 34);
  cx.lineTo(x + 28, y - 20);
  cx.closePath();
  cx.fill();
  cx.beginPath();
  cx.moveTo(x + 36, y - 25);
  cx.lineTo(x + 44, y - 34);
  cx.lineTo(x + 42, y - 18);
  cx.closePath();
  cx.fill();

  // Eyes
  cx.fillStyle = '#2a2a2a';
  cx.beginPath();
  cx.arc(x + 24, y - 10, 3, 0, Math.PI * 2);
  cx.fill();
  cx.beginPath();
  cx.arc(x + 36, y - 10, 3, 0, Math.PI * 2);
  cx.fill();

  // Nose
  cx.fillStyle = '#e88080';
  cx.beginPath();
  cx.moveTo(x + 28, y - 2);
  cx.lineTo(x + 32, y - 2);
  cx.lineTo(x + 30, y + 1);
  cx.closePath();
  cx.fill();

  // Tail
  cx.strokeStyle = p.color;
  cx.lineWidth = 7;
  cx.lineCap = 'round';
  cx.beginPath();
  cx.moveTo(x - 30, y - 5);
  cx.quadraticCurveTo(x - 50, y - 15, x - 45, y - 35);
  cx.stroke();
}

// ============================================================
// SECTION 14 — INITIALIZATION
// ============================================================

function initGamePage() {
  // Draw cat previews on selection cards
  drawCatPreview('preview_mimi', 'mimi');
  drawCatPreview('preview_shadow', 'shadow');
  drawCatPreview('preview_bounce', 'bounce');

  // Set up button event listeners
  document.getElementById('btnSelectMimi').addEventListener('click', () => startGame('mimi'));
  document.getElementById('btnSelectShadow').addEventListener('click', () => startGame('shadow'));
  document.getElementById('btnSelectBounce').addEventListener('click', () => startGame('bounce'));

  // Food type buttons
  document.getElementById('foodType_dry').addEventListener('click', () => actionSelectFood('dry'));
  document.getElementById('foodType_wet').addEventListener('click', () => actionSelectFood('wet'));
  document.getElementById('foodType_special').addEventListener('click', () => actionSelectFood('special'));

  // Food actions
  document.getElementById('btnAddFood').addEventListener('click', () => actionAddFood(20));
  document.getElementById('btnAddFoodSmall').addEventListener('click', () => actionAddFood(8));
  document.getElementById('btnReduceFood').addEventListener('click', () => actionReduceFood());

  // Water
  document.getElementById('btnAddWater').addEventListener('click', () => actionAddWater());

  // Interact
  document.getElementById('btnPet').addEventListener('click', () => actionPet());
  document.getElementById('btnPlay').addEventListener('click', () => actionPlay());
  document.getElementById('btnHug').addEventListener('click', () => actionHug());
  document.getElementById('btnSleep').addEventListener('click', () => actionSleep());

  // Health
  document.getElementById('btnWash').addEventListener('click', () => actionWash());
  document.getElementById('btnCleanEars').addEventListener('click', () => actionCleanEars());
  document.getElementById('btnVet').addEventListener('click', () => actionVet());
  document.getElementById('btnVaccinate').addEventListener('click', () => actionVaccinate());

  // Move
  document.getElementById('btnTakeOut').addEventListener('click', () => actionTakeOut());
  document.getElementById('btnStayHome').addEventListener('click', () => actionStayHome());

  // End / Restart
  document.getElementById('btnEndGame').addEventListener('click', () => endGameEarly());
  document.getElementById('btnPlayAgain').addEventListener('click', () => restartGame());
  document.getElementById('btnBackToSelect').addEventListener('click', () => restartGame());
}

// Start when page loads
window.addEventListener('DOMContentLoaded', initGamePage);
