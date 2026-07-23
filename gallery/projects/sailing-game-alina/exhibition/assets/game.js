/*
 * Sailing Adventure — Game Engine
 * Domain: Sailing
 * Core Learning Shift: Beginners steer toward the target.
 *   Experts read the wind and adjust boat, sail, and route.
 *
 * Track A — No build step. Plain JavaScript + Canvas 2D.
 *
 * Variable organization (per brief section 4):
 *   ENV     — wind, current, rocks, target, time (set per challenge)
 *   PLAYER  — boat heading, sail angle (controlled by player)
 *   CALC    — speed, drift, stability, distance, collision (computed)
 *   FEEDBACK— visual/audio cues derived from CALC data
 */

// ─── Canvas Setup ──────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const W = 1000;
const H = 650;
canvas.width = W;
canvas.height = H;

// ─── Challenge Presets ─────────────────────────────────────────
// Each preset changes ENV variables and relationships, not just visuals.
const CHALLENGES = [
  {
    name: 'Downwind Run',
    description: 'Wind is behind you, but rocks and a cross-current block your path. Trim the sail wide and steer around obstacles.',
    hint: 'The wind pushes from behind. Let your sail out (Down arrow) to catch it — but watch for rocks and the sideways current!',
    windDir: 0,          // wind FROM the north (blowing south)
    windStrength: 0.6,   // weaker wind — must trim efficiently
    current: { x: 0.25, y: 0.2 },   // current pushes east AND south — drifts you off course
    boatStart: { x: 450, y: 100 },
    boatHeading: Math.PI / 2,    // pointing south (downwind)
    target: { x: 520, y: 545 },
    rocks: [
      { x: 320, y: 250, r: 25 },
      { x: 550, y: 340, r: 28 },
      { x: 400, y: 420, r: 22 },
      { x: 640, y: 220, r: 20 },
    ],
    timeLimit: 35,       // tighter time
  },
  {
    name: 'Beam Reach',
    description: 'The target lies perpendicular to the wind. A strong current pushes you off course — find the fastest angle while dodging rocks.',
    hint: 'Sailing across the wind (90 degrees) is the fastest point of sail. Watch the current pushing you south — fight it!',
    windDir: Math.PI,           // wind FROM the south (blowing north)
    windStrength: 0.75,
    current: { x: -0.1, y: 0.25 },  // current pushes south AND west — away from the target
    boatStart: { x: 120, y: 400 },
    boatHeading: 0,             // pointing north (across wind from the south)
    target: { x: 880, y: 220 },
    rocks: [
      { x: 350, y: 300, r: 26 },
      { x: 500, y: 450, r: 24 },
      { x: 620, y: 350, r: 22 },
      { x: 730, y: 180, r: 20 },
      { x: 450, y: 180, r: 18 },
    ],
    timeLimit: 38,
  },
  {
    name: 'Upwind Challenge',
    description: 'The target is directly upwind. You CANNOT sail straight into the wind. Tack through a narrow rock channel while a current fights you.',
    hint: 'The wind comes FROM the target. Sail at ~45 degrees to the wind, then turn to the other side. Zig-zag upwind — and avoid the rocks!',
    windDir: Math.PI / 2,       // wind FROM the east (blowing west)
    windStrength: 0.95,         // strong wind — fast but harder to control
    current: { x: 0.2, y: -0.1 }, // current pushes EAST (toward wind source) — fights your progress
    boatStart: { x: 860, y: 530 },
    boatHeading: Math.PI,       // pointing west
    target: { x: 140, y: 110 },
    rocks: [
      { x: 650, y: 400, r: 28 },
      { x: 500, y: 250, r: 26 },
      { x: 700, y: 180, r: 22 },
      { x: 350, y: 400, r: 24 },
      { x: 250, y: 250, r: 20 },
      { x: 550, y: 480, r: 22 },
    ],
    timeLimit: 60,
  },
];

// ─── Game State ────────────────────────────────────────────────
let state = 'menu';       // 'menu' | 'playing' | 'won' | 'lost'
let currentChallenge = 0;
let lastTime = 0;

// ENV data (environment — set per challenge)
let env = {};

// PLAYER-controlled data
let player = {
  heading: 0,        // boat heading in radians (0 = north/up, PI/2 = east/right)
  sailAngle: 0,       // sail angle relative to boat centerline (radians, 0 = straight, PI/2 = perpendicular)
  steerInput: 0,      // -1 = left, 0 = none, 1 = right
  trimInput: 0,       // -1 = sail in, 1 = sail out
};

// CALC data (system-calculated)
let calc = {
  speed: 0,            // current speed (0 to 1+)
  maxSpeed: 3.5,      // pixels per frame at speed=1
  driftX: 0,           // sideways drift
  driftY: 0,
  stability: 100,     // 0-100, decreases with bad angles / collisions
  distanceToTarget: 0,
  timeRemaining: 0,
  collisionRisk: false,
  boatX: 0,
  boatY: 0,
  wakeTrail: [],      // array of {x, y, alpha} for wake particles
  sailFlapping: false,
  optimalSail: 0,     // optimal sail angle for current heading
  efficiency: 0,       // 0-1, how well the sail is trimmed
};

// ─── Input Handling ────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (e.key === ' ') {
    e.preventDefault();
    if (state === 'menu') startGame(currentChallenge);
    else if (state === 'won' || state === 'lost') showMenu();
  }
  // Prevent page scroll on arrow keys
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// ─── Game Flow ─────────────────────────────────────────────────
function showMenu() {
  state = 'menu';
}

function startGame(challengeIndex) {
  currentChallenge = challengeIndex;
  const c = CHALLENGES[challengeIndex];
  env = {
    windDir: c.windDir,
    windStrength: c.windStrength,
    currentX: c.current.x,
    currentY: c.current.y,
    rocks: c.rocks.map(r => ({ ...r })),
    targetX: c.target.x,
    targetY: c.target.y,
    targetR: 30,
    timeLimit: c.timeLimit,
  };
  player.heading = c.boatHeading;
  player.sailAngle = Math.PI / 4; // start at 45 degrees
  player.steerInput = 0;
  player.trimInput = 0;
  calc.boatX = c.boatStart.x;
  calc.boatY = c.boatStart.y;
  calc.speed = 0;
  calc.stability = 100;
  calc.timeRemaining = c.timeLimit;
  calc.wakeTrail = [];
  state = 'playing';
  lastTime = performance.now();
}

// ─── Sailing Physics ───────────────────────────────────────────
/*
 * The angle of attack (alpha) is the angle between:
 *   - where the wind comes FROM (env.windDir)
 *   - where the boat is heading (player.heading)
 *
 * alpha = 0°   → boat points into the wind (NO-GO ZONE, sail luffs)
 * alpha = 45°  → close-hauled (can sail, moderate speed)
 * alpha = 90°  → beam reach (FASTEST)
 * alpha = 135° → broad reach (fast)
 * alpha = 180° → running / dead downwind (moderate speed)
 *
 * Optimal sail angle ≈ alpha / 2 (sail trimmed tighter when close-hauled)
 */
function computePhysics(dt) {
  // Angle of attack: difference between wind source direction and boat heading
  let alpha = angleDiff(env.windDir, player.heading);
  alpha = Math.abs(alpha); // 0 to PI

  // Convert to degrees for easier reasoning
  let alphaDeg = alpha * 180 / Math.PI;

  // No-go zone: within 45 degrees of the wind source
  const NO_GO = 45 * Math.PI / 180;
  let inNoGo = alpha < NO_GO;

  // Base speed from polar curve (simplified sailing polar)
  let baseSpeed = 0;
  if (!inNoGo) {
    // Interpolate speed: peaks at 90° (beam reach)
    // 45°→0.5, 90°→1.0, 135°→0.9, 180°→0.7
    if (alphaDeg <= 90) {
      baseSpeed = 0.5 + (alphaDeg - 45) / 45 * 0.5;  // 0.5 → 1.0
    } else {
      baseSpeed = 1.0 - (alphaDeg - 90) / 90 * 0.3;   // 1.0 → 0.7
    }
  }
  baseSpeed = Math.max(0, baseSpeed);

  // Optimal sail angle for this heading (tighter when close-hauled)
  let optimalSail = (alpha / 2);
  calc.optimalSail = optimalSail;

  // Sail efficiency: how close player's sail angle is to optimal
  let sailError = Math.abs(player.sailAngle - optimalSail);
  calc.efficiency = Math.max(0, 1 - sailError / (Math.PI / 2));

  // Apply wind strength and sail efficiency
  let targetSpeed = baseSpeed * env.windStrength * (0.3 + 0.7 * calc.efficiency);
  calc.sailFlapping = inNoGo || calc.efficiency < 0.2;

  // Smooth speed changes (acceleration / deceleration)
  let accel = 2.0 * dt;
  if (targetSpeed > calc.speed) {
    calc.speed = Math.min(targetSpeed, calc.speed + accel);
  } else {
    calc.speed = Math.max(targetSpeed, calc.speed - accel * 2);
  }
  if (inNoGo) {
    calc.speed = Math.max(0, calc.speed - 3 * dt); // rapid deceleration in no-go
  }

  // Move boat
  let moveDist = calc.speed * calc.maxSpeed * dt * 60;
  calc.boatX += Math.sin(player.heading) * moveDist;
  calc.boatY -= Math.cos(player.heading) * moveDist;

  // Apply water current (always affects the boat)
  calc.boatX += env.currentX * dt * 60;
  calc.boatY += env.currentY * dt * 60;

  // Sideways drift when sailing close-hauled (weather helm)
  if (alphaDeg > 40 && alphaDeg < 100) {
    let driftAmount = calc.speed * 0.15 * (1 - calc.efficiency * 0.5);
    // drift perpendicular to heading, toward the leeward side
    let perpAngle = player.heading + Math.PI / 2;
    calc.driftX = Math.sin(perpAngle) * driftAmount * dt * 60;
    calc.driftY = -Math.cos(perpAngle) * driftAmount * dt * 60;
    calc.boatX += calc.driftX;
    calc.boatY += calc.driftY;
  }

  // Keep boat in bounds
  calc.boatX = Math.max(30, Math.min(W - 30, calc.boatX));
  calc.boatY = Math.max(30, Math.min(H - 30, calc.boatY));

  // Distance to target
  let dx = env.targetX - calc.boatX;
  let dy = env.targetY - calc.boatY;
  calc.distanceToTarget = Math.sqrt(dx * dx + dy * dy);

  // Collision with rocks
  calc.collisionRisk = false;
  for (let rock of env.rocks) {
    let rdx = calc.boatX - rock.x;
    let rdy = calc.boatY - rock.y;
    let dist = Math.sqrt(rdx * rdx + rdy * rdy);
    if (dist < rock.r + 20) {
      calc.collisionRisk = true;
      if (dist < rock.r + 12) {
        // Collision!
        calc.stability -= 25;
        // Push boat away from rock
        let pushAngle = Math.atan2(rdy, rdx);
        calc.boatX += Math.cos(pushAngle) * 15;
        calc.boatY += Math.sin(pushAngle) * 15;
        calc.speed *= 0.3;
      }
    }
  }

  // Stability changes
  if (calc.sailFlapping && calc.speed < 0.05) {
    // no penalty for being stopped, just no progress
  }
  if (calc.speed > 0.8 && calc.efficiency < 0.3) {
    calc.stability -= 5 * dt; // poor sail trim at speed is unstable
  }
  calc.stability = Math.max(0, Math.min(100, calc.stability));

  // Wake trail
  if (calc.speed > 0.1) {
    calc.wakeTrail.push({
      x: calc.boatX - Math.sin(player.heading) * 18,
      y: calc.boatY + Math.cos(player.heading) * 18,
      alpha: calc.speed,
    });
  }
  // Fade and remove old wake particles
  for (let i = calc.wakeTrail.length - 1; i >= 0; i--) {
    calc.wakeTrail[i].alpha -= dt * 0.8;
    if (calc.wakeTrail[i].alpha <= 0) {
      calc.wakeTrail.splice(i, 1);
    }
  }
  if (calc.wakeTrail.length > 80) {
    calc.wakeTrail.splice(0, calc.wakeTrail.length - 80);
  }

  // Time
  calc.timeRemaining -= dt;
  if (calc.timeRemaining <= 0) {
    calc.timeRemaining = 0;
    state = 'lost';
  }

  // Check win
  if (calc.distanceToTarget < env.targetR + 15) {
    state = 'won';
  }

  // Check stability failure
  if (calc.stability <= 0) {
    state = 'lost';
  }
}

// Helper: smallest angular difference between two angles
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ─── Player Input Processing ────────────────────────────────────
function processInput(dt) {
  // Steering: Left/Right arrows
  let steerSpeed = 1.5; // radians per second
  if (keys['ArrowLeft']) {
    player.heading -= steerSpeed * dt;
  }
  if (keys['ArrowRight']) {
    player.heading += steerSpeed * dt;
  }

  // Sail trim: Up = sail in (tighter), Down = sail out (looser)
  let trimSpeed = 1.2; // radians per second
  if (keys['ArrowUp']) {
    player.sailAngle -= trimSpeed * dt;
  }
  if (keys['ArrowDown']) {
    player.sailAngle += trimSpeed * dt;
  }
  // Clamp sail angle: 0 (tight along boat) to PI/2 (perpendicular)
  player.sailAngle = Math.max(0, Math.min(Math.PI / 2, player.sailAngle));
}

// ─── Rendering ─────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H);

  if (state === 'menu') {
    renderMenu();
  } else {
    renderWorld();
    renderHUD();
    if (state === 'won') renderWinScreen();
    if (state === 'lost') renderLoseScreen();
  }
}

function renderMenu() {
  // Background
  ctx.fillStyle = '#1a4a2c';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Sailing Adventure', W / 2, 90);

  ctx.font = '18px Georgia, serif';
  ctx.fillStyle = '#aaccaa';
  ctx.fillText('Read the wind. Adjust your sail. Find your route.', W / 2, 120);

  // Challenge buttons
  ctx.font = 'bold 22px Georgia, serif';
  for (let i = 0; i < CHALLENGES.length; i++) {
    let y = 180 + i * 140;
    let hovered = isMouseOverChallenge(i);

    // Button background
    ctx.fillStyle = hovered ? '#2d6a3a' : '#244830';
    roundRect(ctx, 150, y, W - 300, 120, 12);
    ctx.fill();
    ctx.strokeStyle = hovered ? '#5adf8a' : '#3a8a5a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Challenge name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Challenge ${i + 1}: ${CHALLENGES[i].name}`, 180, y + 38);

    // Description
    ctx.font = '15px Georgia, serif';
    ctx.fillStyle = '#b0ddbb';
    wrapText(ctx, CHALLENGES[i].description, 180, y + 62, W - 360, 20);

    // Difficulty stars
    let stars = i + 1;
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillStyle = '#ffcc44';
    ctx.textAlign = 'right';
    ctx.fillText('\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars), W - 180, y + 38);
  }

  // Instructions
  ctx.textAlign = 'center';
  ctx.font = '14px Georgia, serif';
  ctx.fillStyle = '#88aa88';
  ctx.fillText('Click a challenge to start  \u2022  Controls: Left/Right = steer, Up/Down = sail trim, Space = restart', W / 2, H - 25);
}

function isMouseOverChallenge(i) {
  if (!mousePos) return false;
  let y = 180 + i * 140;
  return mousePos.x >= 150 && mousePos.x <= W - 150 &&
         mousePos.y >= y && mousePos.y <= y + 120;
}

let mousePos = null;
canvas.addEventListener('mousemove', (e) => {
  let rect = canvas.getBoundingClientRect();
  mousePos = {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
});
canvas.addEventListener('click', (e) => {
  if (state !== 'menu') return;
  let rect = canvas.getBoundingClientRect();
  let mx = (e.clientX - rect.left) * (W / rect.width);
  let my = (e.clientY - rect.top) * (H / rect.height);
  for (let i = 0; i < CHALLENGES.length; i++) {
    let y = 180 + i * 140;
    if (mx >= 150 && mx <= W - 150 && my >= y && my <= y + 120) {
      startGame(i);
      return;
    }
  }
});

function renderWorld() {
  // Water gradient
  let grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2a7a4a');
  grad.addColorStop(0.5, '#1a6a3a');
  grad.addColorStop(1, '#155a2a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Water texture (subtle wave lines)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    for (let x = 0; x < W; x += 10) {
      let wave = Math.sin((x + lastTime * 0.001 + y * 0.05) * 0.02) * 3;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  // Current direction indicator (small arrows in corner)
  drawCurrentIndicator();

  // Rocks
  for (let rock of env.rocks) {
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.arc(rock.x, rock.y, rock.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.arc(rock.x - rock.r * 0.2, rock.y - rock.r * 0.2, rock.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Collision warning ring
    if (calc.collisionRisk) {
      let rdx = calc.boatX - rock.x;
      let rdy = calc.boatY - rock.y;
      let dist = Math.sqrt(rdx * rdx + rdy * rdy);
      if (dist < rock.r + 35) {
        ctx.strokeStyle = `rgba(255, 80, 80, ${0.3 + 0.3 * Math.sin(lastTime * 0.008)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rock.x, rock.y, rock.r + 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Target (buoy)
  let targetPulse = 1 + 0.1 * Math.sin(lastTime * 0.005);
  ctx.fillStyle = 'rgba(255, 200, 50, 0.2)';
  ctx.beginPath();
  ctx.arc(env.targetX, env.targetY, env.targetR * targetPulse + 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffcc33';
  ctx.beginPath();
  ctx.arc(env.targetX, env.targetY, env.targetR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff9900';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Flag on target
  ctx.fillStyle = '#cc6600';
  ctx.fillRect(env.targetX - 1, env.targetY - env.targetR - 15, 2, 15);
  ctx.beginPath();
  ctx.moveTo(env.targetX, env.targetY - env.targetR - 15);
  ctx.lineTo(env.targetX + 12, env.targetY - env.targetR - 10);
  ctx.lineTo(env.targetX, env.targetY - env.targetR - 5);
  ctx.fill();

  // Wake trail
  for (let p of calc.wakeTrail) {
    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.3})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + p.alpha * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Boat
  drawBoat();

  // Wind indicator
  drawWindIndicator();

  // Feedback messages
  drawFeedbackMessages();
}

function drawBoat() {
  ctx.save();
  ctx.translate(calc.boatX, calc.boatY);
  ctx.rotate(player.heading);

  // Hull (pointing up = north)
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.moveTo(0, -22);       // bow
  ctx.lineTo(10, 15);      // starboard stern
  ctx.lineTo(-10, 15);    // port stern
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5C3317';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Deck
  ctx.fillStyle = '#D2B48C';
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(7, 10);
  ctx.lineTo(-7, 10);
  ctx.closePath();
  ctx.fill();

  // Mast
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-1.5, -5, 3, 8);

  // Sail (angle relative to boat centerline)
  // Sail extends to the right side of the boat (starboard) when sailAngle > 0
  let sailLen = 22;
  let sailX = Math.sin(player.sailAngle) * sailLen;
  let sailY = -Math.cos(player.sailAngle) * sailLen + 2;

  if (calc.sailFlapping) {
    // Flapping sail — draw as wavy line
    ctx.strokeStyle = '#ffe8d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    let segments = 5;
    for (let i = 1; i <= segments; i++) {
      let t = i / segments;
      let wave = Math.sin(lastTime * 0.02 + i) * 4;
      ctx.lineTo(sailX * t + wave, sailY * t);
    }
    ctx.stroke();
  } else {
    // Filled sail — curved shape
    ctx.fillStyle = `rgba(255, 248, 230, ${0.85 + 0.15 * calc.efficiency})`;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(sailX * 0.6, sailY * 0.3, sailX, sailY);
    ctx.quadraticCurveTo(sailX * 0.3, sailY * 0.6 + 3, 0, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d4b896';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

function drawWindIndicator() {
  // Wind arrow in top-left corner
  let cx = 70;
  let cy = 70;
  let arrowLen = 40 * env.windStrength;

  // Background circle
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.fill();

  // "N" marker
  ctx.fillStyle = '#aaa';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - 38);

  // Wind direction arrow (shows where wind comes FROM)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(env.windDir);

  ctx.strokeStyle = '#4ddb66';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, arrowLen / 2);
  ctx.lineTo(0, -arrowLen / 2);
  ctx.stroke();

  // Arrowhead (pointing in the direction wind comes FROM)
  ctx.fillStyle = '#4ddb66';
  ctx.beginPath();
  ctx.moveTo(0, -arrowLen / 2 - 6);
  ctx.lineTo(-6, -arrowLen / 2 + 2);
  ctx.lineTo(6, -arrowLen / 2 + 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Label
  ctx.fillStyle = '#4ddb66';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('WIND', cx, cy + 40);
  ctx.fillStyle = '#88ccaa';
  ctx.font = '10px Arial';
  ctx.fillText(Math.round(env.windStrength * 100) + '%', cx, cy + 52);
}

function drawCurrentIndicator() {
  // Small current arrow in bottom-left
  let cx = 70;
  let cy = H - 60;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.arc(cx, cy, 35, 0, Math.PI * 2);
  ctx.fill();

  let cMag = Math.sqrt(env.currentX * env.currentX + env.currentY * env.currentY);
  if (cMag > 0.01) {
    let cAngle = Math.atan2(env.currentX, -env.currentY);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(cAngle);
    ctx.strokeStyle = '#88ddaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.lineTo(0, -15);
    ctx.stroke();
    ctx.fillStyle = '#88ddaa';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(-5, -12);
    ctx.lineTo(5, -12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#88ddaa';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CURRENT', cx, cy + 28);
}

function drawFeedbackMessages() {
  let messages = [];
  let msgY = 130;

  // Sail flapping warning
  if (calc.sailFlapping && state === 'playing') {
    let alpha = 0.5 + 0.5 * Math.sin(lastTime * 0.01);
    ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sail is flapping! Adjust your angle to the wind.', W / 2, msgY);
    msgY += 30;
  }

  // Good trim feedback
  if (calc.efficiency > 0.8 && calc.speed > 0.5 && !calc.sailFlapping) {
    ctx.fillStyle = '#88ff88';
    ctx.font = 'bold 16px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Good trim! \u269B', W / 2, msgY);
    msgY += 25;
  }

  // Collision risk
  if (calc.collisionRisk) {
    let alpha = 0.6 + 0.4 * Math.sin(lastTime * 0.012);
    ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
    ctx.font = 'bold 18px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Watch out for rocks!', W / 2, msgY);
    msgY += 25;
  }

  // Challenge hint (first few seconds)
  if (calc.timeRemaining > CHALLENGES[currentChallenge].timeLimit - 6) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'italic 15px Georgia, serif';
    ctx.textAlign = 'center';
    wrapText(ctx, CHALLENGES[currentChallenge].hint, W / 2, msgY, W - 200, 20);
  }
}

function renderHUD() {
  // HUD panel on right side
  let panelX = W - 200;
  let panelW = 190;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundRect(ctx, panelX, 10, panelW, H - 20, 8);
  ctx.fill();

  ctx.textAlign = 'left';

  // Challenge name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Georgia, serif';
  ctx.fillText(CHALLENGES[currentChallenge].name, panelX + 12, 35);

  // Time
  ctx.fillStyle = '#ccc';
  ctx.font = '12px Arial';
  ctx.fillText('TIME', panelX + 12, 60);
  let timeColor = calc.timeRemaining < 10 ? '#ff6666' : '#ffffff';
  ctx.fillStyle = timeColor;
  ctx.font = 'bold 28px Arial';
  ctx.fillText(calc.timeRemaining.toFixed(1) + 's', panelX + 12, 88);

  // Speed bar
  ctx.fillStyle = '#ccc';
  ctx.font = '12px Arial';
  ctx.fillText('SPEED', panelX + 12, 115);
  ctx.fillStyle = '#333';
  ctx.fillRect(panelX + 12, 122, panelW - 24, 12);
  let speedColor = calc.speed > 0.7 ? '#44ff44' : calc.speed > 0.3 ? '#ffcc44' : '#ff6644';
  ctx.fillStyle = speedColor;
  ctx.fillRect(panelX + 12, 122, (panelW - 24) * Math.min(1, calc.speed), 12);

  // Sail efficiency bar
  ctx.fillStyle = '#ccc';
  ctx.font = '12px Arial';
  ctx.fillText('SAIL TRIM', panelX + 12, 155);
  ctx.fillStyle = '#333';
  ctx.fillRect(panelX + 12, 162, panelW - 24, 12);
  let effColor = calc.efficiency > 0.7 ? '#44dd66' : calc.efficiency > 0.3 ? '#ffcc44' : '#ff6644';
  ctx.fillStyle = effColor;
  ctx.fillRect(panelX + 12, 162, (panelW - 24) * calc.efficiency, 12);

  // Optimal sail indicator
  ctx.fillStyle = '#aaa';
  ctx.font = '11px Arial';
  let optDeg = Math.round(calc.optimalSail * 180 / Math.PI);
  let curDeg = Math.round(player.sailAngle * 180 / Math.PI);
  ctx.fillText(`Optimal: ${optDeg}\u00B0  Current: ${curDeg}\u00B0`, panelX + 12, 188);

  // Stability bar
  ctx.fillStyle = '#ccc';
  ctx.font = '12px Arial';
  ctx.fillText('STABILITY', panelX + 12, 210);
  ctx.fillStyle = '#333';
  ctx.fillRect(panelX + 12, 217, panelW - 24, 12);
  let stabColor = calc.stability > 60 ? '#44ff44' : calc.stability > 30 ? '#ffcc44' : '#ff4444';
  ctx.fillStyle = stabColor;
  ctx.fillRect(panelX + 12, 217, (panelW - 24) * (calc.stability / 100), 12);

  // Distance to target
  ctx.fillStyle = '#ccc';
  ctx.font = '12px Arial';
  ctx.fillText('DISTANCE', panelX + 12, 250);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(Math.round(calc.distanceToTarget) + ' px', panelX + 12, 275);

  // Boat heading (compass)
  ctx.fillStyle = '#ccc';
  ctx.font = '12px Arial';
  ctx.fillText('HEADING', panelX + 12, 300);
  let headingDeg = Math.round((player.heading * 180 / Math.PI + 360) % 360);
  let compass = degToCompass(headingDeg);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.fillText(`${headingDeg}\u00B0 ${compass}`, panelX + 12, 322);

  // Angle of attack
  let alpha = Math.abs(angleDiff(env.windDir, player.heading)) * 180 / Math.PI;
  ctx.fillStyle = '#ccc';
  ctx.font = '12px Arial';
  ctx.fillText('ANGLE TO WIND', panelX + 12, 348);
  let alphaColor = alpha < 45 ? '#ff6644' : alpha < 90 ? '#ffcc44' : '#44ff44';
  if (alpha > 135) alphaColor = '#88ddaa';
  ctx.fillStyle = alphaColor;
  ctx.font = 'bold 16px Arial';
  ctx.fillText(`${Math.round(alpha)}\u00B0`, panelX + 12, 370);
  if (alpha < 45) {
    ctx.fillStyle = '#ff6644';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('NO-GO ZONE!', panelX + 90, 370);
  }

  // Controls reminder
  ctx.fillStyle = '#888';
  ctx.font = '11px Arial';
  ctx.fillText('CONTROLS', panelX + 12, 405);
  ctx.fillStyle = '#aaa';
  ctx.font = '10px Arial';
  ctx.fillText('\u2190 \u2192  Steer boat', panelX + 12, 422);
  ctx.fillText('\u2191 \u2193  Trim sail', panelX + 12, 437);
  ctx.fillText('SPACE  Restart', panelX + 12, 452);
  ctx.fillText('ESC    Menu', panelX + 12, 467);

  // Sailing point of sail label
  let pointOfSail = getPointOfSail(alpha);
  ctx.fillStyle = '#ccc';
  ctx.font = '12px Arial';
  ctx.fillText('POINT OF SAIL', panelX + 12, 495);
  ctx.fillStyle = '#88ddaa';
  ctx.font = 'bold 14px Georgia, serif';
  ctx.fillText(pointOfSail, panelX + 12, 515);
}

function getPointOfSail(alphaDeg) {
  if (alphaDeg < 45) return 'In Irons (No-Go)';
  if (alphaDeg < 60) return 'Close Hauled';
  if (alphaDeg < 100) return 'Beam Reach';
  if (alphaDeg < 150) return 'Broad Reach';
  return 'Running';
}

function degToCompass(deg) {
  let dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function renderWinScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#44ff44';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Well Done! \u269B', W / 2, H / 2 - 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = '20px Georgia, serif';
  ctx.fillText(`You reached the target in ${(CHALLENGES[currentChallenge].timeLimit - calc.timeRemaining).toFixed(1)}s`, W / 2, H / 2);

  ctx.fillStyle = '#aaa';
  ctx.font = '16px Georgia, serif';
  ctx.fillText(`Stability remaining: ${Math.round(calc.stability)}%`, W / 2, H / 2 + 30);

  ctx.fillStyle = '#88ddaa';
  ctx.font = '14px Georgia, serif';
  ctx.fillText('Press SPACE to return to menu', W / 2, H / 2 + 70);
}

function renderLoseScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, W, H);

  let reason = calc.timeRemaining <= 0 ? 'You ran out of time!' : 'Your boat lost stability!';
  ctx.fillStyle = '#ff6666';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Try Again!', W / 2, H / 2 - 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = '18px Georgia, serif';
  ctx.fillText(reason, W / 2, H / 2);

  ctx.fillStyle = '#ffcc66';
  ctx.font = 'italic 15px Georgia, serif';
  let hint = calc.timeRemaining <= 0 ?
    'Hint: read the wind direction and adjust your angle before moving.' :
    'Hint: avoid rocks and keep your sail trim efficient.';
  ctx.fillText(hint, W / 2, H / 2 + 30);

  ctx.fillStyle = '#88ddaa';
  ctx.font = '14px Georgia, serif';
  ctx.fillText('Press SPACE to return to menu', W / 2, H / 2 + 65);
}

// ─── Utility Functions ─────────────────────────────────────────
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

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let words = text.split(' ');
  let line = '';
  let lineY = y;
  for (let i = 0; i < words.length; i++) {
    let testLine = line + words[i] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      ctx.fillText(line, x, lineY);
      line = words[i] + ' ';
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, lineY);
}

// ─── Game Loop ─────────────────────────────────────────────────
function gameLoop(now) {
  let dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state === 'playing') {
    processInput(dt);
    computePhysics(dt);
  }
  render();

  requestAnimationFrame(gameLoop);
}

// Handle Escape key for menu return
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state !== 'menu') {
    showMenu();
  }
});

// Start
lastTime = performance.now();
requestAnimationFrame(gameLoop);
