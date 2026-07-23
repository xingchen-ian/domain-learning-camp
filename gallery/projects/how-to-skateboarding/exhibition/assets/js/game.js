// ==========================================
// HOW TO SKATEBOARDING
// Track A: Plain JavaScript + Canvas 2D
// No build step, no external dependencies
// ==========================================
//
// This file is organized so a high-school student can see
// which data belongs to the environment, the player, and the system.
//
// ENVIRONMENT DATA  ->  LEVELS and terrain helpers
// PLAYER DATA       ->  playerInput object
// SYSTEM DATA       ->  gameState object
//
// The game teaches the core learning shift:
// Beginners think skateboarding is just standing on the board.
// Experts know it is reading landforms and adjusting speed, core, and balance.
// ==========================================

(function () {
  'use strict';

  // ==========================================
  // SECTION 1: CONFIGURATION
  // ==========================================

  const CANVAS_WIDTH = 1200;   // logical canvas width (pixels)
  const CANVAS_HEIGHT = 600;   // logical canvas height (pixels)
  const WORLD_BASE_Y = 500;    // y-coordinate of flat ground on the canvas
  const LOOK_AHEAD = 280;      // camera keeps the skateboard this far from left

  // ==========================================
  // BEST TIMES STORAGE (persists in localStorage)
  // ==========================================

  function loadBestTimes() {
    try {
      return JSON.parse(localStorage.getItem('skateBestTimes') || '{}');
    } catch (e) {
      return {};
    }
  }

  function getBestTime(levelId) {
    const times = loadBestTimes();
    return times[String(levelId)] || null;
  }

  // Saves the time if it's a new record. Returns true if new record was set.
  function saveBestTime(levelId, time) {
    const times = loadBestTimes();
    const key = String(levelId);
    if (!times[key] || time < times[key]) {
      times[key] = time;
      try {
        localStorage.setItem('skateBestTimes', JSON.stringify(times));
      } catch (e) {}
      return true;
    }
    return false;
  }

  function formatTime(t) {
    if (t === null || t === undefined) return '--';
    return t.toFixed(2) + 's';
  }

  // Physics constants
  const GRAVITY = 180;               // strength of gravity effect on slopes
  const MAX_INITIAL_SPEED = 420;     // fastest initial speed the player can pick
  const MIN_INITIAL_SPEED = 80;      // slowest initial speed the player can pick
  const MAX_SPEED = 500;             // speed cap during play
  const CORE_MOVE_SPEED = 2.0;       // how fast the player can raise/lower core (was 1.6)
  const STUCK_SPEED = 5;             // speed below this on flat/uphill = stuck (was 8)
  const FALL_BALANCE = 0;            // balance at or below this = fall

  // Visual constants
  const COLOR_SKY_TOP = '#87CEEB';
  const COLOR_SKY_BOTTOM = '#E8F7FF';
  const COLOR_GROUND = '#8B7355';
  const COLOR_GRASS = '#7CB342';
  const COLOR_BOARD = '#424242';
  const COLOR_WHEEL = '#212121';
  const COLOR_PLAYER = '#37474F';
  const COLOR_CORE_GOOD = '#4CAF50';
  const COLOR_CORE_WARN = '#FF9800';
  const COLOR_CORE_DANGER = '#F44336';
  const COLOR_HUD_BG = 'rgba(255, 255, 255, 0.92)';
  const COLOR_TEXT = '#263238';
  const COLOR_ENERGY_PAD = '#FFD54F';

  // Canvas scaling for responsive 16:9 display
  let scale = 1;

  // ==========================================
  // SECTION 2: ENVIRONMENT DATA
  // Fixed per level: terrain, friction, wheel type, destination, etc.
  // ==========================================

  const LEVELS = [
    {
      id: 1,
      name: 'Level 1 — Flat Ground',
      shortName: 'Level 1',
      description: 'Get used to your skateboard. Find a good speed and keep your core centered.',
      friction: 22,             // normal friction
      wheelType: 'normal',
      wheelLabel: 'Normal Wheels',
      controlFactor: 1.0,       // balance recovers normally
      destination: 1600,
      suggestedSpeed: 200,
      energyPads: []
    },
    {
      id: 2,
      name: 'Level 2 — Ice Hill',
      shortName: 'Level 2',
      description: 'Ice wheels slide with little friction. Speed is easy to keep, but balance is slippery.',
      friction: 7,              // low friction
      wheelType: 'ice',
      wheelLabel: 'Ice Wheels',
      controlFactor: 0.6,        // balance recovery (was 0.45 — too slippery for beginners)
      destination: 2200,
      suggestedSpeed: 260,
      energyPads: []
    },
    {
      id: 3,
      name: 'Level 3 — Cake Mountains',
      shortName: 'Level 3',
      description: 'Cake wheels are sticky and slow. Use the energy pads and your core to survive the hills.',
      friction: 30,             // high friction (was 36 — eased for beginners)
      wheelType: 'cake',
      wheelLabel: 'Cake Wheels',
      controlFactor: 1.3,       // balance recovers well, but speed is hard to keep
      destination: 2800,
      suggestedSpeed: 380,
      energyPads: [{ x: 1350, width: 160, boost: 260 }, { x: 1850, width: 120, boost: 220 }]
    }
  ];

  // Smooth hill helper: starts at 0, peaks at height, returns to 0, with smooth slope transitions.
  function smoothHill(x, start, width, height) {
    if (x < start || x > start + width) return 0;
    const t = (x - start) / width;
    return height * Math.sin(Math.PI * t) ** 2;
  }

  // Terrain height at world x for a given level.
  function getTerrainHeight(x, levelId) {
    if (levelId === 1) {
      // Tiny bump near the start so the player feels the core mechanic.
      return smoothHill(x, 350, 160, 35);
    }
    if (levelId === 2) {
      // One clear hill in the middle.
      let h = 0;
      h += smoothHill(x, 700, 500, 120);
      // Small approach bumps.
      h += smoothHill(x, 500, 120, 15);
      h += smoothHill(x, 1500, 120, 15);
      return h;
    }
    if (levelId === 3) {
      // Three hills and a final flat stretch.
      let h = 0;
      h += smoothHill(x, 500, 320, 90);
      h += smoothHill(x, 1150, 380, 130);  // energy pad sits just before this hill
      h += smoothHill(x, 1900, 360, 100);  // second energy pad just before this hill
      return h;
    }
    return 0;
  }

  // Terrain slope angle at world x (in radians, positive = uphill, negative = downhill).
  function getTerrainAngle(x, levelId) {
    const step = 4;
    const y1 = getTerrainHeight(x - step, levelId);
    const y2 = getTerrainHeight(x + step, levelId);
    return Math.atan2(y2 - y1, 2 * step);
  }

  // Draw the mini-map terrain used for the start-screen preview.
  function getTerrainSample(levelId, samples) {
    const level = LEVELS[levelId - 1];
    const points = [];
    for (let i = 0; i <= samples; i++) {
      const x = (i / samples) * level.destination;
      points.push({ x, y: getTerrainHeight(x, levelId) });
    }
    return points;
  }

  // ==========================================
  // SECTION 3: PLAYER-CONTROLLED DATA
  // The player can change these values.
  // ==========================================

  const playerInput = {
    // Initial speed chosen on the start screen.
    initialSpeed: 200,

    // Core height: 0 = lowest (leaning back), 1 = highest (leaning forward).
    coreHeight: 0.5,

    // Raw key states.
    upPressed: false,
    downPressed: false,

    // Level selection (1, 2, or 3).
    selectedLevel: 1,

    // Mouse state for canvas-based interaction.
    mouseInside: false,
    mouseCanvasX: 0,          // mouse position in canvas coordinates
    mouseCanvasY: 0,
    draggingSpeed: false,     // true while dragging the speed slider on start screen
    mouseControlActive: false  // true when mouse last moved; false when keyboard takes over
  };

  // ==========================================
  // SECTION 4: SYSTEM-CALCULATED RESULTS
  // The game updates these every frame.
  // ==========================================

  const gameState = {
    state: 'instruction',      // 'instruction' | 'start' | 'intro' | 'playing' | 'falling' | 'win' | 'gameover'
    levelId: 1,
    speed: 0,                  // current horizontal speed (pixels / second)
    energy: 0,                 // derived from speed (0..1 shown as a bar)
    balance: 1,                // 0..1, 1 = perfectly balanced, 0 = fall
    position: 0,               // world x position
    angle: 0,                  // current terrain angle
    idealCore: 0.5,            // what the core height should be for this slope
    failReason: '',
    elapsedTime: 0,            // total play time in seconds
    startTime: 0,              // timestamp when play began
    isNewRecord: false         // true if this run set a new best time
  };

  // Visual state for animation effects (not gameplay-affected).
  const visualState = {
    wheelRotation: 0,          // accumulated wheel rotation in radians
    particles: [],             // trail particles spawned by wheels
    fall: {                    // falling animation data (world-space coordinates)
      active: false,
      time: 0,
      duration: 2.0,           // longer for realistic slide/settle
      // Character (absolute world coordinates)
      charWorldX: 0,           // world X position
      charWorldY: 0,           // world Y position (canvas coords)
      charRot: 0,              // rotation in radians
      charVX: 0,               // horizontal velocity (world units/s)
      charVY: 0,               // vertical velocity (positive = down)
      charVR: 0,               // rotation velocity (rad/s)
      charLanded: false,       // has character hit the ground?
      landTime: 0,             // time when character first landed
      // Board (absolute world coordinates)
      boardWorldX: 0,
      boardWorldY: 0,
      boardRot: 0,
      boardVX: 0,
      boardVR: 0,
      // Fall context
      terrainAngle: 0,         // terrain angle at fall start
      fallType: '',            // 'uphill' | 'downhill' | 'flat-forward' | 'flat-backward' | 'flat-flip'
    }
  };

  // ==========================================
  // SECTION 5: TERRAIN SYSTEM
  // Already defined above.
  // ==========================================

  // ==========================================
  // SECTION 6: PHYSICS ENGINE
  // ==========================================

  // Returns the ideal core height for a given terrain angle and time.
  // Uphill  -> raise core (lean forward, high core)
  // Downhill -> lower core (lean back, low core)
  // Flat    -> medium core
  // A slow wobble is added so the ideal is never static — the player must
  // constantly make micro-adjustments, just like real skateboarding.
  function computeIdealCore(angle, time) {
    const steepness = Math.tanh(angle * 3.5);
    const baseIdeal = 0.5 + steepness * 0.4;
    // Slow, gentle wobble — easy to track, still requires active control.
    const wobble = Math.sin(time * 0.7) * 0.07 + Math.sin(time * 1.5 + 1.3) * 0.04;
    return Math.max(0.1, Math.min(0.9, baseIdeal + wobble));
  }

  // Apply physics for one frame.
  function updatePhysics(dt) {
    if (gameState.state !== 'playing') return;

    const level = LEVELS[gameState.levelId - 1];

    // 1. Read current terrain.
    gameState.angle = getTerrainAngle(gameState.position, gameState.levelId);
    gameState.idealCore = computeIdealCore(gameState.angle, gameState.elapsedTime);

    // 2. Energy pads boost speed.
    for (const pad of level.energyPads) {
      if (gameState.position >= pad.x && gameState.position <= pad.x + pad.width) {
        gameState.speed += pad.boost * dt;
      }
    }

    // 3. Friction and gravity change speed.
    //    Gravity acts along the slope: uphill slows forward motion (and
    //    accelerates backward sliding when energy runs out). Downhill
    //    speeds the board up. Friction always opposes the direction of motion.
    const frictionForce = level.friction * 0.7;
    const gravityForce = GRAVITY * Math.sin(gameState.angle);
    gameState.speed -= gravityForce * dt;
    if (gameState.speed > 0) {
      gameState.speed -= frictionForce * dt;
    } else if (gameState.speed < 0) {
      gameState.speed += frictionForce * dt;
    }

    // 4. Core position affects energy efficiency (uphill) and balance (downhill).
    const coreError = playerInput.coreHeight - gameState.idealCore;
    const coreErrorAbs = Math.abs(coreError);

    // Uphill wrong core -> extra energy loss (inefficient).
    // Downhill wrong core -> balance loss (risk of falling).
    // Multipliers make the terrain type matter.
    const uphillPenalty = (gameState.angle > 0.05) ? 1.15 : 1.0;
    const downhillPenalty = (gameState.angle < -0.05) ? 1.4 : 1.0;

    // Core inefficiency only matters when actively skating forward.
    if (gameState.speed > 0) {
      const energyLoss = coreErrorAbs * 38 * uphillPenalty * dt;
      gameState.speed -= energyLoss;
    }

    // 5. Balance — unified with core accuracy.
    //    Wider green zone (0.12) with slower wobble makes tracking easier.
    //    Lower multiplier and base drain give more recovery time.
    //    Uses |speed| so sliding backward is also challenging.
    const absSpeed = Math.abs(gameState.speed);
    const speedFactor = 1 + (absSpeed / MAX_SPEED) * 0.4;
    const balanceRate = (0.12 - coreErrorAbs) * 2.2 * speedFactor * level.controlFactor * downhillPenalty;

    // Base drain: always present, scales with speed magnitude.
    const baseDrain = (0.03 + (absSpeed / MAX_SPEED) * 0.035) * dt;

    // Terrain bumps — gentle and infrequent.
    let bump = 0;
    if (Math.random() < 0.4 * dt) {
      bump = -(0.01 + Math.random() * 0.015);
    }

    gameState.balance += balanceRate * dt - baseDrain + bump;

    // 6. Very fast speeds (forward or backward) are inherently harder to control.
    if (absSpeed > MAX_SPEED * 0.80) {
      gameState.balance -= (absSpeed / MAX_SPEED - 0.80) * 0.3 * dt;
    }

    // Clamp balance.
    gameState.balance = Math.max(FALL_BALANCE, Math.min(1, gameState.balance));

    // 7. Energy is derived from forward speed (0 when sliding backward).
    gameState.energy = Math.max(0, Math.min(1, gameState.speed / MAX_SPEED));

    // 8. Cap speed (allow negative for backward sliding) and move position.
    gameState.speed = Math.max(-MAX_SPEED * 0.6, Math.min(gameState.speed, MAX_SPEED));
    gameState.position += gameState.speed * dt;

    // 9. Check win / lose conditions.
    gameState.elapsedTime += dt;

    // Lose: balance dropped to zero — start falling animation.
    if (gameState.balance <= FALL_BALANCE) {
      gameState.state = 'falling';
      startFallAnimation();
      gameState.failReason = 'You lost your balance and fell off!';
    }
    // Lose: stuck on flat/downhill ground — came to a complete stop.
    // On uphill, gravity pulls the character backward instead of stopping.
    else if (Math.abs(gameState.speed) < STUCK_SPEED && gameState.angle <= 0.02 && gameState.position < level.destination) {
      gameState.state = 'gameover';
      gameState.failReason = 'You ran out of energy and got stuck!';
    }
    // Lose: slid all the way back to the start.
    else if (gameState.position <= 0 && gameState.speed < 0) {
      gameState.state = 'gameover';
      gameState.failReason = 'You ran out of energy and slid all the way back!';
    }
    // Win: reached destination.
    else if (gameState.position >= level.destination) {
      gameState.state = 'win';
      gameState.isNewRecord = saveBestTime(gameState.levelId, gameState.elapsedTime);
    }
  }

  // ==========================================
  // SECTION 7: FALLING ANIMATION
  // ==========================================

  const FALL_GRAVITY = 320;

  function startFallAnimation() {
    const fall = visualState.fall;
    const angle = getTerrainAngle(gameState.position, gameState.levelId);
    const speed = gameState.speed;
    const terrainY = WORLD_BASE_Y - getTerrainHeight(gameState.position, gameState.levelId);

    fall.active = true;
    fall.time = 0;
    fall.duration = 2.0;
    fall.terrainAngle = angle;

    // Determine fall type based on terrain slope.
    if (angle > 0.06) {
      fall.fallType = 'uphill';
    } else if (angle < -0.06) {
      fall.fallType = 'downhill';
    } else {
      // Flat ground: three realistic possibilities.
      const r = Math.random();
      if (r < 0.4) fall.fallType = 'flat-forward';
      else if (r < 0.7) fall.fallType = 'flat-backward';
      else fall.fallType = 'flat-flip';
    }

    // === Character: launches off the board with forward momentum ===
    fall.charWorldX = gameState.position;
    fall.charWorldY = terrainY;
    fall.charRot = 0;
    fall.charLanded = false;
    fall.landTime = 0;

    // Character always carries forward momentum from the board's speed.
    // Direction and intensity vary with terrain.
    if (fall.fallType === 'uphill') {
      // Going uphill: board decelerates sharply, character keeps going forward and up.
      fall.charVX = speed * 0.35 + 25;
      fall.charVY = -50 - Math.random() * 20;   // pop upward
      fall.charVR = 1.4 + Math.random() * 0.4;  // forward tumble
    } else if (fall.fallType === 'downhill') {
      // Going downhill: character tumbles forward fast, less upward pop.
      fall.charVX = speed * 0.45 + 35;
      fall.charVY = -20 - Math.random() * 15;
      fall.charVR = 2.0 + Math.random() * 0.6;
    } else {
      // Flat: character stumbles forward off the board.
      fall.charVX = speed * 0.3 + 25;
      fall.charVY = -35 - Math.random() * 15;
      fall.charVR = 1.6 + Math.random() * 0.5;
    }

    // === Board: behaviour depends on fall type ===
    fall.boardWorldX = gameState.position;
    fall.boardWorldY = terrainY;
    fall.boardRot = 0;

    if (fall.fallType === 'uphill') {
      // Uphill: gravity pulls board backward down the slope.
      fall.boardVX = -15 - Math.random() * 15;  // backward
      fall.boardVR = 0;                          // stays upright, slides
    } else if (fall.fallType === 'downhill') {
      // Downhill: gravity accelerates board forward down the slope.
      fall.boardVX = speed * 0.25 + 15;          // forward
      fall.boardVR = 0;
    } else if (fall.fallType === 'flat-forward') {
      // Flat: board slides forward with friction.
      fall.boardVX = speed * 0.2 + 20;
      fall.boardVR = 0;
    } else if (fall.fallType === 'flat-backward') {
      // Flat: board slides backward slightly (kicked back).
      fall.boardVX = -8 - Math.random() * 12;
      fall.boardVR = 0;
    } else {
      // Flat-flip: board flips over and stays roughly in place.
      fall.boardVX = speed * 0.08 + 3;
      fall.boardVR = 5 + Math.random() * 2;      // fast spin
    }
  }

  function updateFallAnimation(dt) {
    const fall = visualState.fall;
    if (!fall.active) return;

    fall.time += dt;

    // ================================================================
    // CHARACTER PHYSICS
    // ================================================================
    // Air friction on horizontal velocity.
    fall.charVX *= (1 - 0.4 * dt);
    // Gravity.
    fall.charVY += FALL_GRAVITY * dt;

    // Update position.
    fall.charWorldX += fall.charVX * dt;
    fall.charWorldY += fall.charVY * dt;
    fall.charRot += fall.charVR * dt;

    // Terrain collision: check ground level at character's current X.
    const charTerrainY = WORLD_BASE_Y - getTerrainHeight(fall.charWorldX, gameState.levelId);
    if (fall.charWorldY >= charTerrainY) {
      // Character has hit the ground.
      fall.charWorldY = charTerrainY;
      if (!fall.charLanded) {
        // First impact — kill vertical velocity, dampen horizontal & rotation.
        fall.charLanded = true;
        fall.landTime = fall.time;
        fall.charVY = 0;
        fall.charVX *= 0.35;
        fall.charVR *= 0.25;
      }
      // On ground: apply slope-based sliding (gravity component along slope).
      const charAngle = getTerrainAngle(fall.charWorldX, gameState.levelId);
      fall.charVX += -280 * Math.sin(charAngle) * dt;
      // Ground friction.
      fall.charVX *= (1 - 1.8 * dt);
      fall.charVR *= (1 - 2.5 * dt);
      // No vertical movement on ground.
      fall.charVY = 0;
    }

    // Cap character rotation so they don't spin endlessly.
    fall.charRot = Math.max(-Math.PI * 0.8, Math.min(Math.PI * 1.2, fall.charRot));

    // ================================================================
    // BOARD PHYSICS
    // ================================================================
    // Board has no vertical velocity when on ground (it stays on terrain).
    // Apply gravity along the slope direction.
    const boardAngle = getTerrainAngle(fall.boardWorldX, gameState.levelId);

    if (fall.fallType === 'flat-flip' && fall.time < 0.6) {
      // Flip phase: board is airborne, spinning.
      fall.boardVY += FALL_GRAVITY * 0.6 * dt;
      fall.boardWorldY += fall.boardVY * dt;
      fall.boardRot += fall.boardVR * dt;
      fall.boardVR *= (1 - 1.0 * dt);

      // Check terrain collision.
      const bTerrainY = WORLD_BASE_Y - getTerrainHeight(fall.boardWorldX, gameState.levelId);
      if (fall.boardWorldY >= bTerrainY) {
        fall.boardWorldY = bTerrainY;
        fall.boardVY = 0;
        // Settle upside down (π rotation).
        fall.boardRot = Math.PI;
        fall.boardVR = 0;
      }
    } else {
      // Sliding phase: board stays on terrain surface.
      const bTerrainY = WORLD_BASE_Y - getTerrainHeight(fall.boardWorldX, gameState.levelId);
      fall.boardWorldY = bTerrainY;
      fall.boardVY = 0;

      // Gravity component along slope (negative angle = downhill = forward).
      const gravityAlongSlope = -350 * Math.sin(boardAngle);
      fall.boardVX += gravityAlongSlope * dt;

      // Friction (higher on flat, lower on slope so it keeps sliding).
      const friction = Math.abs(boardAngle) < 0.05 ? 1.2 : 0.4;
      fall.boardVX *= (1 - friction * dt);

      // Update board X position.
      fall.boardWorldX += fall.boardVX * dt;

      // For flip type, keep board upside down after landing.
      if (fall.fallType === 'flat-flip') {
        fall.boardRot = Math.PI;
        fall.boardVR = 0;
      } else {
        // Non-flip: board stays flat on terrain (rotation follows slope).
        fall.boardRot = 0;
        fall.boardVR = 0;
      }
    }

    // Transition to gameover after duration.
    if (fall.time >= fall.duration) {
      fall.active = false;
      gameState.state = 'gameover';
    }
  }

  function drawFallingCharacter(x, y, rotation) {
    // Re-use the outfit colors from drawCharacter.
    const plaidBase = '#ECEFF1';
    const plaidDark = '#90A4AE';
    const teeColor = '#E53935';
    const jeansColor = '#64B5F6';
    const jeansDark = '#1E88E5';
    const shoeColor = '#424242';
    const soleColor = '#FAFAFA';
    const skinColor = '#FFCC80';
    const hairColor = '#D87C2A';

    const fall = visualState.fall;

    // Determine animation phase.
    // airP: 0→1 during airborne (before landing).
    // landP: 0→1 during grounded (after landing), used for settle pose.
    let airP, landP;
    if (!fall.charLanded) {
      // Still in the air — normalise by estimated air time (~0.5s).
      airP = Math.min(fall.time / 0.5, 1);
      landP = 0;
    } else {
      airP = 1;
      const groundedFor = fall.time - fall.landTime;
      const groundedDur = fall.duration - fall.landTime;
      landP = Math.min(groundedFor / Math.max(groundedDur, 0.1), 1);
    }

    ctx.save();
    ctx.translate(x, y);

    // Shadow — stays on the ground at character's X position.
    // Grows darker and wider as character descends.
    const shadowAlpha = 0.06 + (fall.charLanded ? 0.12 : 0.06 * airP);
    const shadowW = 16 + (fall.charLanded ? 12 : 8 * airP);
    ctx.fillStyle = 'rgba(0,0,0,' + shadowAlpha + ')';
    ctx.beginPath();
    ctx.ellipse(0, 50, shadowW, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Apply character rotation (from tumbling).
    ctx.rotate(rotation);

    // Limb drawing helper.
    function limb(x1, y1, x2, y2, w, c) {
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = w + 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.stroke();
    }

    // === Phase-based pose interpolation ===
    // Three phases: airborne → impact → grounded (sprawled).

    // Arm targets for each phase:
    // Airborne: arms flail upward and outward (instinctive balance attempt).
    // Impact:   arms reach forward (break-fall reflex).
    // Grounded: arms splay out to the sides on the ground.

    // Compute arm positions by blending phases.
    let fArmElbowX, fArmElbowY, fArmHandX, fArmHandY;
    let bArmElbowX, bArmElbowY, bArmHandX, bArmHandY;
    const fArmShoulderX = 8, fArmShoulderY = -6;
    const bArmShoulderX = -8, bArmShoulderY = -6;

    if (!fall.charLanded) {
      // === AIRBORNE: arms flail upward ===
      const flail = Math.sin(fall.time * 14) * 0.5 + 0.5; // oscillation
      // Front arm swings up and forward.
      fArmElbowX = 8 + 6 * airP;
      fArmElbowY = -6 - 12 * airP - 4 * flail;
      fArmHandX = fArmElbowX + 8 * airP + 4 * flail;
      fArmHandY = fArmElbowY - 10 * airP - 6 * flail;
      // Back arm swings up and back.
      bArmElbowX = -8 - 4 * airP;
      bArmElbowY = -6 - 10 * airP + 4 * flail;
      bArmHandX = bArmElbowX - 8 * airP - 3 * flail;
      bArmHandY = bArmElbowY - 8 * airP - 4 * flail;
    } else {
      // Blend from impact pose (arms forward) to grounded (arms splayed).
      // Impact phase: 0 → 0.15 of landP, Grounded: 0.15 → 1.
      const impactBlend = Math.min(landP / 0.15, 1);
      const sprawlBlend = Math.max((landP - 0.15) / 0.85, 0);

      // Impact pose: arms reach forward and down (catching fall).
      const impFElbX = 8 + 16, impFElbY = -6 + 10;
      const impFHandX = impFElbX + 14, impFHandY = impFElbY + 12;
      const impBElbX = -8 + 12, impBElbY = -6 + 8;
      const impBHandX = impBElbX + 10, impBHandY = impBElbY + 14;

      // Grounded pose: arms splayed out on the ground.
      const sprFElbX = 16, sprFElbY = 14;
      const sprFHandX = 28, sprFHandY = 22;
      const sprBElbX = -16, sprBElbY = 14;
      const sprBHandX = -28, sprBHandY = 22;

      // Blend impact → grounded.
      fArmElbowX = impFElbX + (sprFElbX - impFElbX) * sprawlBlend;
      fArmElbowY = impFElbY + (sprFElbY - impFElbY) * sprawlBlend;
      fArmHandX = impFHandX + (sprFHandX - impFHandX) * sprawlBlend;
      fArmHandY = impFHandY + (sprFHandY - impFHandY) * sprawlBlend;
      bArmElbowX = impBElbX + (sprBElbX - impBElbX) * sprawlBlend;
      bArmElbowY = impBElbY + (sprBElbY - impBElbY) * sprawlBlend;
      bArmHandX = impBHandX + (sprBHandX - impBHandX) * sprawlBlend;
      bArmHandY = impBHandY + (sprBHandY - impBHandY) * sprawlBlend;
    }

    // Leg positions by phase.
    let bLegKneeX, bLegKneeY, bLegFootX, bLegFootY;
    let fLegKneeX, fLegKneeY, fLegFootX, fLegFootY;
    const bLegHipX = -6, bLegHipY = 10;
    const fLegHipX = 6, fLegHipY = 10;

    if (!fall.charLanded) {
      // === AIRBORNE: legs spread apart (lost balance) ===
      const spread = airP;
      bLegKneeX = -6 - 8 * spread;
      bLegKneeY = 10 + 20 - 2 * spread;
      bLegFootX = bLegKneeX - 10 * spread;
      bLegFootY = bLegKneeY + 14 - 6 * spread;
      fLegKneeX = 6 + 8 * spread;
      fLegKneeY = 10 + 20 - 2 * spread;
      fLegFootX = fLegKneeX + 10 * spread;
      fLegFootY = fLegKneeY + 14 - 6 * spread;
    } else {
      // Blend from buckled (impact) to splayed (grounded).
      const sprawlBlend = Math.max((landP - 0.1) / 0.9, 0);

      // Impact: knees buckle, feet close together.
      const impBKneeX = -6 - 4, impBKneeY = 10 + 22;
      const impBFootX = -12, impBFootY = 10 + 36;
      const impFKneeX = 6 + 4, impFKneeY = 10 + 22;
      const impFFootX = 14, impFFootY = 10 + 36;

      // Grounded: legs splayed on ground.
      const sprBKneeX = -10, sprBKneeY = 10 + 24;
      const sprBFootX = -22, sprBFootY = 10 + 38;
      const sprFKneeX = 12, sprFKneeY = 10 + 24;
      const sprFFootX = 26, sprFFootY = 10 + 38;

      bLegKneeX = impBKneeX + (sprBKneeX - impBKneeX) * sprawlBlend;
      bLegKneeY = impBKneeY + (sprBKneeY - impBKneeY) * sprawlBlend;
      bLegFootX = impBFootX + (sprBFootX - impBFootX) * sprawlBlend;
      bLegFootY = impBFootY + (sprBFootY - impBFootY) * sprawlBlend;
      fLegKneeX = impFKneeX + (sprFKneeX - impFKneeX) * sprawlBlend;
      fLegKneeY = impFKneeY + (sprFKneeY - impFKneeY) * sprawlBlend;
      fLegFootX = impFFootX + (sprFFootX - impFFootX) * sprawlBlend;
      fLegFootY = impFFootY + (sprFFootY - impFFootY) * sprawlBlend;
    }

    // === Draw back leg ===
    limb(bLegHipX, bLegHipY, bLegKneeX, bLegKneeY, 7, jeansDark);
    limb(bLegKneeX, bLegKneeY, bLegFootX, bLegFootY, 6, jeansDark);
    // Back shoe.
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.ellipse(bLegFootX - 3, bLegFootY, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = soleColor;
    ctx.fillRect(bLegFootX - 8, bLegFootY, 8, 2);

    // === Draw back arm ===
    limb(bArmShoulderX, bArmShoulderY, bArmElbowX, bArmElbowY, 6, plaidDark);
    limb(bArmElbowX, bArmElbowY, bArmHandX, bArmHandY, 5, plaidDark);

    // === Torso (tee + open plaid) ===
    ctx.fillStyle = teeColor;
    ctx.beginPath();
    ctx.ellipse(0, 4, 10, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B71C1C';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Plaid shirt panels (open front).
    ctx.fillStyle = plaidBase;
    ctx.beginPath();
    ctx.moveTo(-9, -10);
    ctx.quadraticCurveTo(-14, 4, -9, 22);
    ctx.lineTo(-2, 22);
    ctx.quadraticCurveTo(-6, 4, -2, -10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = plaidDark;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.quadraticCurveTo(6, 4, 2, 22);
    ctx.lineTo(9, 22);
    ctx.quadraticCurveTo(14, 4, 9, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // === Draw front leg ===
    limb(fLegHipX, fLegHipY, fLegKneeX, fLegKneeY, 8, jeansColor);
    limb(fLegKneeX, fLegKneeY, fLegFootX, fLegFootY, 7, jeansColor);
    // Front shoe.
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.ellipse(fLegFootX + 3, fLegFootY, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = soleColor;
    ctx.fillRect(fLegFootX, fLegFootY, 8, 2);

    // === Draw front arm ===
    limb(fArmShoulderX, fArmShoulderY, fArmElbowX, fArmElbowY, 6, plaidBase);
    limb(fArmElbowX, fArmElbowY, fArmHandX, fArmHandY, 5, plaidBase);

    // === Head ===
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, -24, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#E0B070';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hair (natural short swept, same style as standing).
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.moveTo(-12, -18);
    ctx.quadraticCurveTo(-15, -28, -11, -36);
    ctx.quadraticCurveTo(-5, -40, 0, -38);
    ctx.quadraticCurveTo(6, -41, 12, -35);
    ctx.quadraticCurveTo(15, -27, 13, -18);
    ctx.quadraticCurveTo(6, -22, -1, -23);
    ctx.quadraticCurveTo(-7, -22, -12, -18);
    ctx.closePath();
    ctx.fill();

    // Face: squinting while airborne (bracing), dazed after landing.
    ctx.fillStyle = '#3E2723';
    if (!fall.charLanded) {
      // Squinting — bracing for impact.
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#3E2723';
      ctx.beginPath();
      ctx.moveTo(-6, -25); ctx.lineTo(-1, -24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, -24); ctx.lineTo(7, -25);
      ctx.stroke();
    } else {
      // Dazed half-open eyes (swirling after impact).
      ctx.beginPath();
      ctx.arc(-3, -25, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -25, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ==========================================
  // SECTION 8: RENDERING
  // ==========================================

  let canvas, ctx;

  function resizeCanvas() {
    // Keep a 16:9 aspect ratio and fit within the window.
    const maxWidth = window.innerWidth * 0.96;
    const maxHeight = window.innerHeight * 0.86;
    let w = maxWidth;
    let h = w * (9 / 16);
    if (h > maxHeight) {
      h = maxHeight;
      w = h * (16 / 9);
    }
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.style.width = Math.round(w) + 'px';
    canvas.style.height = Math.round(h) + 'px';
    scale = w / CANVAS_WIDTH;
  }

  function cameraX() {
    const level = LEVELS[gameState.levelId - 1];
    // Keep the skateboard a bit to the left of center so the player sees upcoming landforms.
    const cx = gameState.position - LOOK_AHEAD;
    // Clamp so we never show too much empty space beyond the start or end.
    const maxCamera = level.destination - CANVAS_WIDTH + 200;
    return Math.max(-100, Math.min(cx, maxCamera));
  }

  function worldToScreen(x, y) {
    return {
      x: x - cameraX(),
      y: y
    };
  }

  // Draw a rounded rectangle helper.
  function drawRoundRect(x, y, w, h, r, fill, stroke) {
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
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  // Draw a horizontal bar.
  function drawBar(x, y, w, h, fill, value, max, label) {
    const ratio = Math.max(0, Math.min(1, value / max));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w * ratio, h);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(label + ': ' + Math.round(value), x, y - 18);
  }

  // Level-specific sky and theme colors.
  function getLevelTheme(levelId) {
    if (levelId === 2) return {
      skyTop: '#5C9ECC', skyBottom: '#D6F0FF',
      mountainFar: 'rgba(160, 195, 215, 0.4)', mountainNear: 'rgba(200, 225, 240, 0.5)',
      cloudColor: 'rgba(255, 255, 255, 0.85)',
      sunColor: '#FFF9C4', sunGlow: 'rgba(255, 249, 196, 0.3)',
      grass: '#E0F0FF', grassDark: '#B3D9F2',
      dirt: '#90A4AE', dirtDark: '#607D8B',
      tuftColor: 'rgba(230, 245, 255, 0.7)',
      decorType: 'ice'
    };
    if (levelId === 3) return {
      skyTop: '#FFB74D', skyBottom: '#FFF3E0',
      mountainFar: 'rgba(200, 160, 100, 0.35)', mountainNear: 'rgba(220, 180, 120, 0.45)',
      cloudColor: 'rgba(255, 245, 225, 0.8)',
      sunColor: '#FFE082', sunGlow: 'rgba(255, 224, 130, 0.35)',
      grass: '#FFCC80', grassDark: '#FFB74D',
      dirt: '#D7A36E', dirtDark: '#A1745A',
      tuftColor: 'rgba(255, 224, 178, 0.6)',
      decorType: 'cactus'
    };
    return {
      skyTop: COLOR_SKY_TOP, skyBottom: COLOR_SKY_BOTTOM,
      mountainFar: 'rgba(120, 160, 180, 0.35)', mountainNear: 'rgba(150, 180, 200, 0.45)',
      cloudColor: 'rgba(255, 255, 255, 0.85)',
      sunColor: '#FFF59D', sunGlow: 'rgba(255, 245, 157, 0.25)',
      grass: COLOR_GRASS, grassDark: '#549932',
      dirt: COLOR_GROUND, dirtDark: '#6D5A42',
      tuftColor: 'rgba(124, 179, 66, 0.6)',
      decorType: 'tree'
    };
  }

  function drawCloud(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.arc(x + size * 0.8, y + size * 0.15, size * 0.75, 0, Math.PI * 2);
    ctx.arc(x - size * 0.7, y + size * 0.1, size * 0.65, 0, Math.PI * 2);
    ctx.arc(x + size * 0.3, y - size * 0.4, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBackground() {
    const theme = getLevelTheme(gameState.levelId);
    const cx = cameraX();

    // Sky gradient.
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Sun with glow.
    const sunX = CANVAS_WIDTH * 0.82 - cx * 0.05;
    const sunY = 90;
    const sunR = 38;
    // Glow.
    const sunGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 2.5);
    sunGrad.addColorStop(0, theme.sunGlow);
    sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Sun body.
    ctx.fillStyle = theme.sunColor;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Clouds — deterministic positions, parallax 0.15.
    for (let i = 0; i < 6; i++) {
      const cloudWorldX = i * 520 + 100;
      const cloudScreenX = cloudWorldX - cx * 0.15;
      const cloudY = 60 + (i % 3) * 35 + Math.sin(i * 2.3) * 15;
      const cloudSize = 22 + (i % 3) * 8;
      if (cloudScreenX > -80 && cloudScreenX < CANVAS_WIDTH + 80) {
        drawCloud(cloudScreenX, cloudY, cloudSize, theme.cloudColor);
      }
    }

    // Far mountains — parallax 0.2.
    ctx.fillStyle = theme.mountainFar;
    ctx.beginPath();
    ctx.moveTo(0, WORLD_BASE_Y);
    for (let px = 0; px <= CANVAS_WIDTH; px += 30) {
      const worldX = px + cx * 0.2;
      const my = WORLD_BASE_Y - 40 - 55 * Math.sin(worldX * 0.006) - 30 * Math.sin(worldX * 0.015);
      ctx.lineTo(px, my);
    }
    ctx.lineTo(CANVAS_WIDTH, WORLD_BASE_Y);
    ctx.closePath();
    ctx.fill();

    // Mid hills — parallax 0.4, slightly different shape.
    ctx.fillStyle = theme.mountainNear;
    ctx.beginPath();
    ctx.moveTo(0, WORLD_BASE_Y);
    for (let px = 0; px <= CANVAS_WIDTH; px += 25) {
      const worldX = px + cx * 0.4;
      const my = WORLD_BASE_Y - 10 - 35 * Math.sin(worldX * 0.01 + 1.5) - 20 * Math.sin(worldX * 0.025);
      ctx.lineTo(px, my);
    }
    ctx.lineTo(CANVAS_WIDTH, WORLD_BASE_Y);
    ctx.closePath();
    ctx.fill();
  }

  // Draw a small tree.
  function drawTree(x, baseY, scale) {
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(x - 3 * scale, baseY - 20 * scale, 6 * scale, 20 * scale);
    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.arc(x, baseY - 28 * scale, 14 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(x - 7 * scale, baseY - 22 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.arc(x + 7 * scale, baseY - 22 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw a cactus (for Level 3 cake/desert theme).
  function drawCactus(x, baseY, scale) {
    ctx.fillStyle = '#6D9E4E';
    // Main trunk.
    drawRoundRect(x - 5 * scale, baseY - 30 * scale, 10 * scale, 30 * scale, 5 * scale, '#6D9E4E');
    // Left arm.
    drawRoundRect(x - 14 * scale, baseY - 22 * scale, 9 * scale, 7 * scale, 3 * scale, '#6D9E4E');
    drawRoundRect(x - 14 * scale, baseY - 30 * scale, 7 * scale, 10 * scale, 3 * scale, '#6D9E4E');
    // Right arm.
    drawRoundRect(x + 5 * scale, baseY - 26 * scale, 9 * scale, 7 * scale, 3 * scale, '#6D9E4E');
    drawRoundRect(x + 7 * scale, baseY - 36 * scale, 7 * scale, 12 * scale, 3 * scale, '#6D9E4E');
  }

  // Draw an ice crystal formation (for Level 2 ice theme).
  function drawIceCrystal(x, baseY, scale) {
    ctx.fillStyle = 'rgba(180, 230, 255, 0.7)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    // Central shard.
    ctx.beginPath();
    ctx.moveTo(x, baseY - 25 * scale);
    ctx.lineTo(x - 6 * scale, baseY);
    ctx.lineTo(x + 6 * scale, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Side shards.
    ctx.beginPath();
    ctx.moveTo(x - 6 * scale, baseY - 12 * scale);
    ctx.lineTo(x - 12 * scale, baseY);
    ctx.lineTo(x - 3 * scale, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 6 * scale, baseY - 15 * scale);
    ctx.lineTo(x + 3 * scale, baseY);
    ctx.lineTo(x + 12 * scale, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Sparkle.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(x - 2 * scale, baseY - 18 * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTerrain() {
    const level = LEVELS[gameState.levelId - 1];
    const theme = getLevelTheme(gameState.levelId);
    const cx = cameraX();

    // === Decorations (parallax 0.7, behind terrain) ===
    for (let i = 0; i < 40; i++) {
      const decorX = i * 180 + 50;
      const screenDX = decorX - cx * 0.7;
      if (screenDX < -40 || screenDX > CANVAS_WIDTH + 40) continue;
      const decorH = getTerrainHeight(decorX, gameState.levelId);
      const decorBaseY = WORLD_BASE_Y - decorH + 2;
      const dscale = 0.7 + (i % 3) * 0.15;
      if (theme.decorType === 'tree') drawTree(screenDX, decorBaseY, dscale);
      else if (theme.decorType === 'cactus') drawCactus(screenDX, decorBaseY, dscale);
      else if (theme.decorType === 'ice') drawIceCrystal(screenDX, decorBaseY, dscale);
    }

    // === Energy pads (under ground stroke) ===
    for (const pad of level.energyPads) {
      const startX = pad.x - cx;
      const endX = pad.x + pad.width - cx;
      if (endX > 0 && startX < CANVAS_WIDTH) {
        // Pad base glow.
        const padGrad = ctx.createLinearGradient(0, WORLD_BASE_Y - 12, 0, WORLD_BASE_Y);
        padGrad.addColorStop(0, 'rgba(255, 213, 79, 0.9)');
        padGrad.addColorStop(1, 'rgba(255, 152, 0, 0.7)');
        ctx.fillStyle = padGrad;
        ctx.fillRect(startX, WORLD_BASE_Y - 12, endX - startX, 12);
        // Arrows pointing up on the pad.
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        for (let ax = startX + 10; ax < endX - 10; ax += 24) {
          ctx.beginPath();
          ctx.moveTo(ax, WORLD_BASE_Y - 4);
          ctx.lineTo(ax + 8, WORLD_BASE_Y - 12);
          ctx.lineTo(ax + 16, WORLD_BASE_Y - 4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#E65100';
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ENERGY', (startX + endX) / 2, WORLD_BASE_Y - 20);
        ctx.textAlign = 'left';
      }
    }

    // === Ground fill — layered: grass top, dirt mid, deep rock bottom ===
    // First pass: dirt/rock fill.
    ctx.fillStyle = theme.dirtDark;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT);
    for (let px = 0; px <= CANVAS_WIDTH; px += 6) {
      const worldX = px + cx;
      const h = getTerrainHeight(worldX, gameState.levelId);
      ctx.lineTo(px, WORLD_BASE_Y - h);
    }
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Second pass: dirt layer (lighter, top 35px).
    ctx.fillStyle = theme.dirt;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT);
    for (let px = 0; px <= CANVAS_WIDTH; px += 6) {
      const worldX = px + cx;
      const h = getTerrainHeight(worldX, gameState.levelId);
      ctx.lineTo(px, WORLD_BASE_Y - h);
    }
    ctx.lineTo(CANVAS_WIDTH, WORLD_BASE_Y + 35);
    ctx.lineTo(0, WORLD_BASE_Y + 35);
    ctx.closePath();
    ctx.fill();

    // Third pass: grass/surface layer (top 10px) with gradient.
    const surfGrad = ctx.createLinearGradient(0, WORLD_BASE_Y - 130, 0, WORLD_BASE_Y + 10);
    surfGrad.addColorStop(0, theme.grassDark);
    surfGrad.addColorStop(1, theme.grass);
    ctx.fillStyle = surfGrad;
    ctx.beginPath();
    for (let px = 0; px <= CANVAS_WIDTH; px += 6) {
      const worldX = px + cx;
      const h = getTerrainHeight(worldX, gameState.levelId);
      if (px === 0) ctx.moveTo(px, WORLD_BASE_Y - h);
      else ctx.lineTo(px, WORLD_BASE_Y - h);
    }
    // Follow the same line back, offset down by 12px to create the surface strip.
    for (let px = CANVAS_WIDTH; px >= 0; px -= 6) {
      const worldX = px + cx;
      const h = getTerrainHeight(worldX, gameState.levelId);
      ctx.lineTo(px, WORLD_BASE_Y - h + 12);
    }
    ctx.closePath();
    ctx.fill();

    // Grass tufts / surface details along the terrain top.
    ctx.strokeStyle = theme.tuftColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let px = 0; px <= CANVAS_WIDTH; px += 18) {
      const worldX = px + cx;
      const h = getTerrainHeight(worldX, gameState.levelId);
      const ty = WORLD_BASE_Y - h;
      // Use a deterministic pseudo-random based on worldX for consistent tufts.
      const seed = Math.sin(worldX * 0.7) * 100;
      const r1 = seed - Math.floor(seed);
      if (r1 > 0.3) {
        ctx.beginPath();
        ctx.moveTo(px, ty);
        ctx.lineTo(px + 1, ty - 5 - r1 * 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + 2, ty);
        ctx.lineTo(px + 4, ty - 3 - r1 * 3);
        ctx.stroke();
      }
    }

    // === Destination flag — checkered, more polished ===
    const flagX = level.destination - cx;
    if (flagX > -30 && flagX < CANVAS_WIDTH + 30) {
      const flagH = getTerrainHeight(level.destination, gameState.levelId);
      const flagBaseY = WORLD_BASE_Y - flagH;
      // Pole.
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 5;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(flagX, flagBaseY - 130);
      ctx.lineTo(flagX, flagBaseY);
      ctx.stroke();
      // Pole top ball.
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(flagX, flagBaseY - 132, 5, 0, Math.PI * 2);
      ctx.fill();
      // Checkered flag.
      const flagW = 56;
      const flagHeight = 40;
      const flagStartY = flagBaseY - 128;
      const checkSize = 8;
      for (let row = 0; row < flagHeight / checkSize; row++) {
        for (let col = 0; col < flagW / checkSize; col++) {
          const isBlack = (row + col) % 2 === 0;
          ctx.fillStyle = isBlack ? '#212121' : '#FFFFFF';
          ctx.fillRect(flagX + col * checkSize, flagStartY + row * checkSize, checkSize, checkSize);
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(flagX, flagStartY, flagW, flagHeight);
      // Goal label with shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.font = 'bold 16px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GOAL', flagX + 28 + 1, flagBaseY - 140 + 1);
      ctx.fillStyle = '#D32F2F';
      ctx.fillText('GOAL', flagX + 28, flagBaseY - 140);
      ctx.textAlign = 'left';
    }

    ctx.lineCap = 'butt';
  }

  // ==========================================
  // WHEEL RENDERING — three visually distinct types
  // ==========================================

  function drawNormalWheel(cx, cy, radius, rotation) {
    // Dark rubber with tread, hub, spokes, and bearing.
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Tread marks around the outer edge.
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const a = rotation + (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (radius - 3), cy + Math.sin(a) * (radius - 3));
      ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.stroke();
    }

    // Highlight on the rubber (top-left).
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Inner hub (lighter grey).
    ctx.fillStyle = '#9E9E9E';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Spokes — rotate with the wheel.
    ctx.strokeStyle = '#616161';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = rotation + (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * radius * 0.42, cy + Math.sin(a) * radius * 0.42);
      ctx.stroke();
    }

    // Bearing center.
    ctx.fillStyle = '#424242';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#BDBDBD';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawIceWheel(cx, cy, radius, rotation) {
    // Translucent icy blue with crystalline facets, frost edge, and glow.

    // Soft glow halo.
    ctx.save();
    ctx.shadowColor = '#4FC3F7';
    ctx.shadowBlur = 14;

    // Main translucent ice body.
    ctx.fillStyle = 'rgba(129, 212, 250, 0.65)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Crystalline facet lines radiating from center.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.2;
    const facets = 6;
    for (let i = 0; i < facets; i++) {
      const a = rotation + (i / facets) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.stroke();
    }

    // Inner bright ice core.
    ctx.fillStyle = 'rgba(225, 245, 254, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Center bearing (frosted metal look).
    ctx.fillStyle = 'rgba(120, 200, 230, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Rotating sparkle highlights.
    for (let i = 0; i < 3; i++) {
      const a = rotation * 1.8 + (i / 3) * Math.PI * 2;
      const sx = cx + Math.cos(a) * radius * 0.7;
      const sy = cy + Math.sin(a) * radius * 0.7;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // White frost edge outline.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawCakeWheel(cx, cy, radius, rotation) {
    // Pink frosting with cream layer, sprinkles, and drip pattern.
    const r = radius + 1; // slightly chunkier

    // Outer frosting.
    ctx.fillStyle = '#F48FB1';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Frosting drip bumps along the bottom arc.
    ctx.fillStyle = '#F8BBD0';
    for (let i = 0; i < 5; i++) {
      const dripAngle = Math.PI * 0.15 + (i / 4) * Math.PI * 0.7;
      const dx = cx + Math.cos(dripAngle) * r;
      const dy = cy + Math.sin(dripAngle) * r;
      ctx.beginPath();
      ctx.arc(dx, dy, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cream inner layer.
    ctx.fillStyle = '#FFF3E0';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Center hub (cookie colored).
    ctx.fillStyle = '#D7A36E';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#BC8A50';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Colorful sprinkles — rotate with the wheel.
    const sprinkleColors = ['#E91E63', '#9C27B0', '#3F51B5', '#009688', '#FFEB3B', '#FF5722'];
    for (let i = 0; i < 6; i++) {
      const a = rotation + (i / 6) * Math.PI * 2 + 0.3;
      const dist = r * 0.75;
      const sx = cx + Math.cos(a) * dist;
      const sy = cy + Math.sin(a) * dist;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a + Math.PI / 4);
      ctx.fillStyle = sprinkleColors[i % sprinkleColors.length];
      ctx.fillRect(-1.8, -0.8, 3.6, 1.6);
      ctx.restore();
    }

    // Top highlight (shiny frosting).
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Outline.
    ctx.strokeStyle = '#E91E63';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawWheel(cx, cy, radius, type, rotation) {
    if (type === 'ice') drawIceWheel(cx, cy, radius, rotation);
    else if (type === 'cake') drawCakeWheel(cx, cy, radius, rotation);
    else drawNormalWheel(cx, cy, radius, rotation);
  }

  // ==========================================
  // PARTICLE SYSTEM — wheel-type-specific trails
  // ==========================================

  function spawnTrailParticles(worldX, screenY, wheelType, speed) {
    const absSpeed = Math.abs(speed);
    if (absSpeed < 20) return;
    const count = absSpeed > 300 ? 3 : (absSpeed > 120 ? 2 : 1);
    // Particles fly opposite to the direction of motion.
    const pdir = speed >= 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      if (wheelType === 'ice') {
        visualState.particles.push({
          x: worldX + (Math.random() - 0.5) * 10,
          y: screenY + 3 + Math.random() * 4,
          vx: pdir * (-Math.random() * 40 - 10),
          vy: -Math.random() * 35 - 5,
          life: 0.8 + Math.random() * 0.4,
          maxLife: 1.2,
          size: 2 + Math.random() * 3,
          type: 'ice',
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 8
        });
      } else if (wheelType === 'cake') {
        const colors = ['#F48FB1', '#CE93D8', '#FFAB91', '#A5D6A7', '#FFF59D', '#FFCC80'];
        visualState.particles.push({
          x: worldX + (Math.random() - 0.5) * 12,
          y: screenY + 3 + Math.random() * 3,
          vx: pdir * (-Math.random() * 35 - 5),
          vy: -Math.random() * 45 - 10,
          life: 1.0 + Math.random() * 0.5,
          maxLife: 1.5,
          size: 2 + Math.random() * 2.5,
          type: 'cake',
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      } else {
        visualState.particles.push({
          x: worldX + (Math.random() - 0.5) * 8,
          y: screenY + 3 + Math.random() * 3,
          vx: pdir * (-Math.random() * 50 - 10),
          vy: -Math.random() * 25 - 5,
          life: 0.5 + Math.random() * 0.3,
          maxLife: 0.8,
          size: 1.5 + Math.random() * 2,
          type: 'dust'
        });
      }
    }
  }

  function updateParticles(dt) {
    for (let i = visualState.particles.length - 1; i >= 0; i--) {
      const p = visualState.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt; // gravity pulls particles down
      p.life -= dt;
      if (p.rotation !== undefined) p.rotation += p.rotSpeed * dt;
      if (p.life <= 0) visualState.particles.splice(i, 1);
    }
    if (visualState.particles.length > 250) {
      visualState.particles.splice(0, visualState.particles.length - 250);
    }
  }

  function drawParticles(camX) {
    for (const p of visualState.particles) {
      const sx = p.x - camX;
      if (sx < -20 || sx > CANVAS_WIDTH + 20) continue;
      const alpha = p.life / p.maxLife;

      if (p.type === 'ice') {
        ctx.save();
        ctx.translate(sx, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = 'rgba(179, 229, 252, ' + (alpha * 0.8) + ')';
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + alpha + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (p.type === 'cake') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = 'rgba(180, 160, 130, ' + (alpha * 0.5) + ')';
        ctx.beginPath();
        ctx.arc(sx, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draws a wheel-type badge icon — used on start screen and HUD.
  function drawWheelBadge(cx, cy, scale, type, rotation) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    const r = 14;
    if (type === 'ice') drawIceWheel(0, 0, r, rotation || 0);
    else if (type === 'cake') drawCakeWheel(0, 0, r, rotation || 0);
    else drawNormalWheel(0, 0, r, rotation || 0);
    ctx.restore();
  }

  function drawSkateboard(x, y, angle) {
    const level = LEVELS[gameState.levelId - 1];
    const wheelType = level.wheelType;
    const boardLength = 78;
    const boardHeight = 10;
    const wheelRadius = wheelType === 'cake' ? 9 : (wheelType === 'ice' ? 8 : 7);
    const wheelOffsetX = boardLength / 2 - 16;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Deck shadow.
    drawRoundRect(-boardLength / 2 + 2, -boardHeight + 2, boardLength, boardHeight, 4, 'rgba(0,0,0,0.2)');

    // Deck base color varies by wheel type.
    const deckColor = wheelType === 'ice' ? '#37474F' : (wheelType === 'cake' ? '#5D4037' : '#424242');
    drawRoundRect(-boardLength / 2, -boardHeight, boardLength, boardHeight, 4, deckColor);

    // Grip tape layer on top.
    const gripColor = wheelType === 'ice' ? '#263238' : (wheelType === 'cake' ? '#4E342E' : '#333333');
    ctx.fillStyle = gripColor;
    ctx.fillRect(-boardLength / 2 + 2, -boardHeight, boardLength - 4, 3);

    // Grip tape dot texture.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 9; i++) {
      const dx = -boardLength / 2 + 6 + i * 8;
      ctx.fillRect(dx, -boardHeight + 1, 2, 1.5);
    }

    // Trucks (metal axle mounts).
    ctx.fillStyle = '#9E9E9E';
    ctx.fillRect(-wheelOffsetX - 3, -2, 6, 5);
    ctx.fillRect(wheelOffsetX - 3, -2, 6, 5);
    ctx.fillStyle = '#757575';
    ctx.fillRect(-wheelOffsetX - 3, -2, 6, 1.5);
    ctx.fillRect(wheelOffsetX - 3, -2, 6, 1.5);

    // Wheels — drawn via type-specific functions with live rotation.
    drawWheel(-wheelOffsetX, 4, wheelRadius, wheelType, visualState.wheelRotation);
    drawWheel(wheelOffsetX, 4, wheelRadius, wheelType, visualState.wheelRotation);

    ctx.restore();
  }

  function drawCharacter(x, y, angle) {
    const boardLean = angle;
    const wobble = (1 - gameState.balance) * 0.22 * Math.sin(gameState.elapsedTime * 12);
    // Lean backward when sliding backward — natural reflex to avoid falling forward.
    const slideLean = gameState.speed < -STUCK_SPEED ? -0.18 : 0;
    const totalLean = boardLean + wobble + slideLean;

    const level = LEVELS[gameState.levelId - 1];

    // ===== Outfit based on reference image =====
    // Plaid flannel shirt (open) over red tee, light-blue jeans, dark sneakers.
    const plaidBase = '#ECEFF1';      // light gray/white flannel
    const plaidDark = '#90A4AE';      // stripe color
    const plaidLine = '#546E7A';      // thin grid lines
    const teeColor = '#E53935';       // red t-shirt
    const teeDark = '#B71C1C';
    const jeansColor = '#64B5F6';     // light blue jeans
    const jeansDark = '#1E88E5';
    const jeansShadow = '#1565C0';
    const shoeColor = '#424242';      // dark gray sneakers
    const soleColor = '#FAFAFA';      // white soles
    const skinColor = '#FFCC80';
    const skinShadow = '#F0B36C';
    const hairColor = '#D87C2A';      // brown/orange hair
    const hairDark = '#A85515';

    // ===== Pose: dynamic skate crouch from reference =====
    // crouch = 1 - coreHeight. 0 = standing tall, 1 = deep crouch (reference pose).
    const crouch = 1 - playerInput.coreHeight;
    const leanSin = Math.sin(totalLean);
    const leanCos = Math.cos(totalLean);

    // Body leans slightly forward when crouching, like real skaters.
    const bodyLean = totalLean + crouch * 0.06;
    const bodySin = Math.sin(bodyLean);
    const bodyCos = Math.cos(bodyLean);

    const footSpread = 22;

    // Back foot: always planted on the tail of the board.
    const backFootX = x - footSpread;
    const backFootY = y - 2;

    // Front foot: lifts up when crouching (reference pose), back down when standing.
    const frontFootLift = crouch * 24; // 0..24 px lifted
    const frontFootX = x + footSpread;
    const frontFootY = y - 2 - frontFootLift;

    // Hip: drops and shifts slightly back when crouching.
    const hipDrop = crouch * 18;
    const hipShift = -crouch * 4;
    const hipX = x + hipShift;
    const hipY = y - 54 + hipDrop;

    // Torso stays mostly upright, slight forward tilt when crouching.
    const torsoLen = 46;
    const shoulderX = hipX + bodySin * torsoLen * 0.3;
    const shoulderY = hipY - bodyCos * torsoLen;

    const neckX = shoulderX + bodySin * 4;
    const neckY = shoulderY - bodyCos * 5;

    const headR = 13;
    const headX = neckX + bodySin * (headR + 2);
    const headY = neckY - bodyCos * (headR + 2);

    // Back knee bends in a normal athletic crouch.
    const backKneeX = hipX - 12 - crouch * 3 + bodySin * 2;
    const backKneeY = hipY + 24 - crouch * 10;

    // Front knee lifts high when crouching (matches reference lifted front leg).
    const frontKneeX = hipX + 4 + crouch * 4 + bodySin * 2;
    const frontKneeY = hipY + 18 - crouch * 24;

    // Arms: natural response to crouch and balance.
    // Standing: arms hang relaxed at sides, hands near hip level.
    // Crouching: arms extend forward to ~shoulder height for balance.
    // Off-balance: arms swing wider to counterbalance (windmill effect).
    const balanceNeed = 1 - gameState.balance;
    const armSwing = Math.sin(gameState.elapsedTime * 7) * 6 * balanceNeed;

    // Front arm: hangs down when standing, reaches forward at shoulder height when crouching.
    const frontElbowX = shoulderX + 10 + bodySin * 4 + crouch * 6;
    const frontElbowY = shoulderY + 10 - crouch * 14; // standing: +10 (below shoulder); crouch: -4 (near shoulder)
    const frontHandX = frontElbowX + 14 + armSwing + crouch * 4;
    const frontHandY = frontElbowY + 14 - crouch * 12; // standing: hand well below elbow; crouch: near elbow

    // Back arm: hangs relaxed when standing, extends backward when crouching.
    const backElbowX = shoulderX - 8 + bodySin * 3 - crouch * 4;
    const backElbowY = shoulderY + 12 - crouch * 8;
    const backHandX = backElbowX - 12 - armSwing - crouch * 10;
    const backHandY = backElbowY + 16 - crouch * 14; // standing: hand low; crouch: hand near shoulder

    // === Shadow under character ===
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 32, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Helper: draw a limb with outline.
    function drawLimb(x1, y1, x2, y2, w, color, outlineColor) {
      ctx.strokeStyle = outlineColor || '#263238';
      ctx.lineWidth = w + 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Helper: draw a sneaker.
    function drawSneaker(footX, footY, isFront) {
      const w = isFront ? 18 : 16;
      const h = 7;
      // Sole.
      ctx.fillStyle = soleColor;
      drawRoundRect(footX - w / 2, footY + 1, w, 3, 1, soleColor);
      // Shoe body.
      ctx.fillStyle = shoeColor;
      drawRoundRect(footX - w / 2, footY - h + 2, w, h, 3, shoeColor);
      ctx.strokeStyle = '#212121';
      ctx.lineWidth = 1;
      ctx.strokeRect(footX - w / 2, footY - h + 2, w, h);
      // Laces.
      ctx.strokeStyle = '#FAFAFA';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const lx = footX - w / 2 + 4 + i * 4;
        ctx.moveTo(lx, footY - h + 4);
        ctx.lineTo(lx, footY - 1);
      }
      ctx.stroke();
      // Cuff (jeans rolled up).
      ctx.fillStyle = jeansColor;
      ctx.strokeStyle = jeansDark;
      ctx.lineWidth = 1;
      ctx.fillRect(footX - w / 2 - 1, footY - h - 2, w + 2, 3);
      ctx.strokeRect(footX - w / 2 - 1, footY - h - 2, w + 2, 3);
    }

    // === Back arm (drawn behind torso) ===
    drawLimb(shoulderX - 5, shoulderY, backElbowX, backElbowY, 6, plaidBase, plaidLine);
    drawLimb(backElbowX, backElbowY, backHandX, backHandY, 5, plaidBase, plaidLine);
    // Back hand.
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(backHandX, backHandY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skinShadow;
    ctx.lineWidth = 1;
    ctx.stroke();

    // === Back leg (behind torso) ===
    drawLimb(hipX - 6, hipY, backKneeX, backKneeY, 8, jeansColor, jeansShadow);
    drawLimb(backKneeX, backKneeY, backFootX, backFootY, 7, jeansColor, jeansShadow);
    drawSneaker(backFootX, backFootY, false);

    // === Torso: red tee + open plaid shirt ===
    const torsoHalfTop = 10;
    const torsoHalfBot = 8;
    const torsoTopY = shoulderY;
    const torsoBotY = hipY;

    // Red t-shirt (base).
    ctx.fillStyle = teeColor;
    ctx.beginPath();
    ctx.moveTo(shoulderX - torsoHalfTop + 2, torsoTopY);
    ctx.quadraticCurveTo(shoulderX - torsoHalfTop - 1, torsoTopY + torsoLen * 0.35, hipX - torsoHalfBot + 2, torsoBotY);
    ctx.lineTo(hipX + torsoHalfBot - 2, torsoBotY);
    ctx.quadraticCurveTo(shoulderX + torsoHalfTop + 1, torsoTopY + torsoLen * 0.35, shoulderX + torsoHalfTop - 2, torsoTopY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = teeDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Open plaid shirt — left/right panels with a gap in front showing the tee.
    ctx.save();
    // Build the shirt outline as a path and use it for clipping.
    const shirtPath = new Path2D();
    shirtPath.moveTo(shoulderX - torsoHalfTop, torsoTopY);
    shirtPath.quadraticCurveTo(shoulderX - torsoHalfTop - 2, torsoTopY + torsoLen * 0.35, hipX - torsoHalfBot, torsoBotY);
    shirtPath.lineTo(hipX + torsoHalfBot, torsoBotY);
    shirtPath.quadraticCurveTo(shoulderX + torsoHalfTop + 2, torsoTopY + torsoLen * 0.35, shoulderX + torsoHalfTop, torsoTopY);
    shirtPath.closePath();
    ctx.clip(shirtPath);

    // Shirt base.
    ctx.fillStyle = plaidBase;
    ctx.fill();

    // Plaid stripes.
    ctx.strokeStyle = plaidDark;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    for (let i = -3; i <= 3; i++) {
      const sx = shoulderX + i * 7;
      ctx.beginPath();
      ctx.moveTo(sx, torsoTopY - 4);
      ctx.lineTo(sx + 4, torsoBotY + 4);
      ctx.stroke();
    }
    for (let j = 0; j < 6; j++) {
      const sy = torsoTopY + j * 9;
      ctx.beginPath();
      ctx.moveTo(shoulderX - torsoHalfTop - 4, sy);
      ctx.lineTo(shoulderX + torsoHalfTop + 4, sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Thin cross grid for extra plaid detail.
    ctx.strokeStyle = plaidLine;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.4;
    for (let i = -4; i <= 4; i++) {
      const sx = shoulderX + i * 3.5;
      ctx.beginPath();
      ctx.moveTo(sx, torsoTopY - 4);
      ctx.lineTo(sx + 2, torsoBotY + 4);
      ctx.stroke();
    }
    for (let j = 0; j < 10; j++) {
      const sy = torsoTopY + j * 4.5;
      ctx.beginPath();
      ctx.moveTo(shoulderX - torsoHalfTop - 4, sy);
      ctx.lineTo(shoulderX + torsoHalfTop + 4, sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Vertical gap showing the red tee (open shirt).
    ctx.fillStyle = teeColor;
    ctx.fillRect(shoulderX + 2, torsoTopY + 2, 3, torsoLen - 2);
    ctx.restore();

    // Shirt outline.
    ctx.strokeStyle = plaidLine;
    ctx.lineWidth = 2;
    ctx.stroke(shirtPath);

    // Collar.
    ctx.strokeStyle = plaidLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shoulderX + 2, torsoTopY + 2);
    ctx.lineTo(shoulderX + 5, torsoTopY + 10);
    ctx.lineTo(shoulderX + 8, torsoTopY + 3);
    ctx.stroke();

    // === Front leg ===
    drawLimb(hipX + 6, hipY, frontKneeX, frontKneeY, 9, jeansColor, jeansDark);
    drawLimb(frontKneeX, frontKneeY, frontFootX, frontFootY, 8, jeansColor, jeansDark);
    drawSneaker(frontFootX, frontFootY, true);

    // === Front arm ===
    drawLimb(shoulderX + 5, shoulderY, frontElbowX, frontElbowY, 7, plaidBase, plaidLine);
    drawLimb(frontElbowX, frontElbowY, frontHandX, frontHandY, 6, plaidBase, plaidLine);
    // Front hand.
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(frontHandX, frontHandY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skinShadow;
    ctx.lineWidth = 1;
    ctx.stroke();

    // === Neck ===
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY - 2);
    ctx.lineTo(neckX, neckY);
    ctx.stroke();

    // === Head + face ===
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Face: dot eyes + small smile.
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.arc(headX + 4, headY - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(headX + 3, headY + 4, 4, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Blush.
    ctx.fillStyle = 'rgba(255, 120, 120, 0.25)';
    ctx.beginPath();
    ctx.ellipse(headX + 1, headY + 1, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // === Hair (natural short swept style) ===
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    // Start at left sideburn area.
    ctx.moveTo(headX - headR + 1, headY + 2);
    // Left side up over the temple.
    ctx.quadraticCurveTo(headX - headR - 1, headY - headR * 0.5, headX - headR + 2, headY - headR + 1);
    // Sweep across the top — gentle wave, not spikes.
    ctx.quadraticCurveTo(headX - 6, headY - headR - 4, headX, headY - headR - 3);
    ctx.quadraticCurveTo(headX + 6, headY - headR - 5, headX + headR - 2, headY - headR + 1);
    // Right side down past the temple.
    ctx.quadraticCurveTo(headX + headR + 1, headY - headR * 0.4, headX + headR - 1, headY + 3);
    // Bangs / hairline across the forehead.
    ctx.quadraticCurveTo(headX + 5, headY - headR * 0.3, headX - 2, headY - headR * 0.45);
    ctx.quadraticCurveTo(headX - 6, headY - headR * 0.2, headX - headR + 1, headY + 2);
    ctx.closePath();
    ctx.fill();
    // Subtle outline.
    ctx.strokeStyle = hairDark;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hair shine — soft highlight.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(headX - 2, headY - headR + 1, 5, 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // === Core dot (gameplay indicator, smaller so it doesn't hide the outfit) ===
    const coreError = Math.abs(playerInput.coreHeight - gameState.idealCore);
    let coreColor = COLOR_CORE_GOOD;
    if (coreError > 0.12) coreColor = COLOR_CORE_WARN;
    if (coreError > 0.20) coreColor = COLOR_CORE_DANGER;

    const coreT = 0.55;
    const coreX = hipX + (shoulderX - hipX) * coreT;
    const coreY = hipY + (shoulderY - hipY) * coreT;

    // Core glow.
    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, 14);
    coreGrad.addColorStop(0, coreColor);
    coreGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = coreGrad;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(coreX, coreY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Core dot.
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(coreX, coreY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.lineCap = 'butt';
  }

  function drawHUD() {
    const pad = 16;
    const panelW = 240;

    // Left panel background.
    drawRoundRect(pad, pad, panelW, 170, 10, COLOR_HUD_BG, 'rgba(0,0,0,0.1)');

    // Speed bar — show absolute value; use orange when sliding backward.
    const isSlidingBack = gameState.speed < -STUCK_SPEED;
    const speedDisplay = Math.abs(gameState.speed);
    const speedLabel = isSlidingBack ? 'Speed \u25C0' : 'Speed';
    const speedColor = isSlidingBack ? '#FF7043' : '#03A9F4';
    drawBar(pad + 14, pad + 34, panelW - 28, 18, speedColor, speedDisplay, MAX_SPEED, speedLabel);
    // Energy bar.
    drawBar(pad + 14, pad + 80, panelW - 28, 18, '#8BC34A', gameState.energy * MAX_SPEED, MAX_SPEED, 'Energy');
    // Balance bar.
    const balanceColor = gameState.balance > 0.6 ? '#4CAF50' : (gameState.balance > 0.3 ? '#FF9800' : '#F44336');
    drawBar(pad + 14, pad + 126, panelW - 28, 18, balanceColor, gameState.balance * 100, 100, 'Balance');

    // Sliding back warning.
    if (isSlidingBack) {
      ctx.fillStyle = '#E65100';
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('\u26A0 SLIDING BACK', pad + panelW / 2, pad + 150);
      ctx.textAlign = 'left';
    }

    // Right panel: core height and ideal core (enlarged for visibility).
    drawRoundRect(CANVAS_WIDTH - pad - 110, pad, 110, 170, 10, COLOR_HUD_BG, 'rgba(0,0,0,0.1)');
    // Vertical bar.
    const barX = CANVAS_WIDTH - pad - 55;
    const barY = pad + 30;
    const barH = 120;
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(barX - 14, barY, 28, barH);
    // Player core indicator (larger circle).
    const playerCoreY = barY + barH - playerInput.coreHeight * barH;
    ctx.fillStyle = '#2196F3';
    ctx.beginPath();
    ctx.arc(barX, playerCoreY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Ideal core indicator (thicker line, wider).
    const idealCoreY = barY + barH - gameState.idealCore * barH;
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(barX - 22, idealCoreY);
    ctx.lineTo(barX + 22, idealCoreY);
    ctx.stroke();
    // Green zone band (visual guide for safe range).
    ctx.fillStyle = 'rgba(76, 175, 80, 0.12)';
    const greenZone = 0.10;
    ctx.fillRect(barX - 14, barY + barH - (gameState.idealCore + greenZone) * barH, 28, greenZone * 2 * barH);
    // Labels.
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillText('Core', barX - 18, pad + 10);
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText('▲ Hi', barX + 18, barY + 8);
    ctx.fillText('▼ Lo', barX + 18, barY + barH - 4);

    // Top center: level info and progress bar.
    const level = LEVELS[gameState.levelId - 1];
    const progress = Math.min(1, gameState.position / level.destination);
    const progressW = 320;
    const progressX = (CANVAS_WIDTH - progressW) / 2;
    const progressY = 20;
    ctx.fillStyle = COLOR_HUD_BG;
    drawRoundRect(progressX - 10, progressY - 8, progressW + 20, 30, 8, COLOR_HUD_BG, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(progressX, progressY + 6, progressW, 10);
    ctx.fillStyle = '#673AB7';
    ctx.fillRect(progressX, progressY + 6, progressW * progress, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(progressX, progressY + 6, progressW, 10);
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(level.shortName + '  |  ' + level.wheelLabel, CANVAS_WIDTH / 2, progressY - 4);
    ctx.textAlign = 'left';

    // Small wheel badge to the right of the progress bar label.
    drawWheelBadge(progressX + progressW + 12, progressY + 11, 0.5, level.wheelType, visualState.wheelRotation);

    // Slope indicator.
    const slopeX = CANVAS_WIDTH - pad - 180;
    const slopeY = pad + 28;
    ctx.fillStyle = COLOR_HUD_BG;
    drawRoundRect(slopeX, slopeY, 80, 70, 8, COLOR_HUD_BG, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillText('Slope', slopeX + 22, slopeY + 14);
    // Draw a small triangle representing the board angle.
    const triLen = 30;
    const triAngle = -gameState.angle; // flip for display
    ctx.strokeStyle = gameState.angle > 0.05 ? '#4CAF50' : (gameState.angle < -0.05 ? '#F44336' : '#757575');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(slopeX + 40, slopeY + 55);
    ctx.lineTo(slopeX + 40 + Math.cos(triAngle) * triLen, slopeY + 55 + Math.sin(triAngle) * triLen);
    ctx.stroke();

    // Bottom hint: mouse controls core.
    ctx.fillStyle = 'rgba(69, 90, 100, 0.6)';
    ctx.font = '400 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Move mouse up/down to adjust core  |  Arrow keys also work  |  SPACE to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 12);
    ctx.textAlign = 'left';
  }

  // ==========================================
  // INSTRUCTION SCREEN
  // Shows controls and rules before the game starts.
  // ==========================================

  function drawInstructionScreen() {
    const cx = CANVAS_WIDTH / 2;

    // === Overlay ===
    ctx.fillStyle = 'rgba(245, 247, 250, 0.97)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';

    // === Title ===
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#1A237E';
    ctx.font = '700 34px "Segoe UI", "Helvetica Neue", sans-serif';
    ctx.fillText('HOW TO SKATEBOARDING', cx, 48);
    ctx.restore();

    // Subtitle.
    ctx.fillStyle = '#546E7A';
    ctx.font = '400 16px "Segoe UI", sans-serif';
    ctx.fillText('Guide your skater to the finish line without losing balance!', cx, 74);

    // === Two-column layout: Controls (left) | Rules (right) ===
    const colW = 480;
    const colY = 100;
    const leftX = cx - colW / 2 - 20;
    const rightX = cx + 20;

    // --- Left column: Controls ---
    drawRoundRect(leftX - 12, colY - 8, colW + 24, 340, 10, 'rgba(255,255,255,0.7)', 'rgba(0,0,0,0.06)');
    ctx.fillStyle = '#1565C0';
    ctx.font = '700 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CONTROLS', leftX + 8, colY + 18);

    const ctrlItems = [
      ['↑ / W', 'Move core up (lean forward)'],
      ['↓ / S', 'Move core down (lean back)'],
      ['Mouse Y', 'Move mouse up/down to control core'],
      ['Drag slider', 'Set initial speed on start screen'],
      ['1 / 2 / 3', 'Select level (1=Park, 2=Ice, 3=Desert)'],
      ['SPACE', 'Start game / Restart after fall'],
      ['N', 'Next level (after winning)'],
      ['ESC', 'Return to level selection'],
    ];

    ctx.font = '400 14px "Segoe UI", sans-serif';
    for (let i = 0; i < ctrlItems.length; i++) {
      const y = colY + 48 + i * 32;
      // Key badge.
      ctx.fillStyle = '#E3F2FD';
      drawRoundRect(leftX + 8, y - 14, 100, 22, 5, '#E3F2FD');
      ctx.fillStyle = '#1565C0';
      ctx.font = '700 13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ctrlItems[i][0], leftX + 58, y);
      // Description.
      ctx.fillStyle = '#37474F';
      ctx.font = '400 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(ctrlItems[i][1], leftX + 120, y);
    }

    // --- Right column: Rules ---
    drawRoundRect(rightX - 12, colY - 8, colW + 24, 340, 10, 'rgba(255,255,255,0.7)', 'rgba(0,0,0,0.06)');
    ctx.fillStyle = '#2E7D32';
    ctx.font = '700 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GAME RULES', rightX + 8, colY + 18);

    const ruleItems = [
      { icon: '🎯', title: 'Goal', text: 'Reach the finish line flag without falling!' },
      { icon: '⚖', title: 'Balance', text: 'Keep your core (blue dot) near the green line.' },
      { icon: '🟢', title: 'Green zone', text: 'Core in green band = balance recovers.' },
      { icon: '🟡', title: 'Yellow zone', text: 'Core off-target = balance slowly drops.' },
      { icon: '🔴', title: 'Red zone', text: 'Core far off = balance drops fast — you fall!' },
      { icon: '⚡', title: 'Energy', text: 'Speed drains on uphill. Energy pads boost speed.' },
      { icon: '🏔', title: 'Hills', text: 'Uphill: lean forward. Downhill: lean back.' },
      { icon: '💀', title: 'Game Over', text: 'Balance hits zero = fall. No speed on flat = stuck.' },
    ];

    for (let i = 0; i < ruleItems.length; i++) {
      const y = colY + 48 + i * 32;
      const r = ruleItems[i];
      ctx.font = '700 14px "Segoe UI", sans-serif';
      ctx.fillStyle = '#2E7D32';
      ctx.fillText(r.title + ':', rightX + 8, y);
      ctx.font = '400 13px "Segoe UI", sans-serif';
      ctx.fillStyle = '#37474F';
      ctx.fillText(r.text, rightX + 70, y);
    }

    // === Tip box at bottom ===
    const tipY = 462;
    drawRoundRect(cx - 380, tipY, 760, 50, 8, '#FFF8E1', 'rgba(255,193,7,0.3)');
    ctx.fillStyle = '#F57F17';
    ctx.font = '700 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💡 TIP: The green line moves with the terrain — anticipate hills and adjust early!', cx, tipY + 30);

    // === Continue prompt ===
    ctx.fillStyle = '#1A237E';
    ctx.font = '700 20px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
    ctx.globalAlpha = pulse;
    ctx.fillText('Press SPACE to continue', cx, 548);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
  }

  function drawStartScreen() {
    const level = LEVELS[playerInput.selectedLevel - 1];
    const previewPoints = getTerrainSample(playerInput.selectedLevel, 80);
    const maxH = 180;
    const previewTheme = getLevelTheme(playerInput.selectedLevel);
    const cx = CANVAS_WIDTH / 2;

    // === Overlay ===
    ctx.fillStyle = 'rgba(245, 247, 250, 0.96)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';

    // === Title with shadow ===
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#1A237E';
    ctx.font = '700 36px "Segoe UI", "Helvetica Neue", sans-serif';
    ctx.fillText('HOW TO SKATEBOARDING', cx, 42);
    ctx.restore();

    // Decorative underline.
    const lineGrad = ctx.createLinearGradient(cx - 160, 0, cx + 160, 0);
    lineGrad.addColorStop(0, 'rgba(33,150,243,0)');
    lineGrad.addColorStop(0.5, 'rgba(33,150,243,0.6)');
    lineGrad.addColorStop(1, 'rgba(33,150,243,0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(cx - 160, 54, 320, 2);

    // === Level name (description hidden — revealed in the intro screen) ===
    ctx.fillStyle = '#283593';
    ctx.font = '700 22px "Segoe UI", sans-serif';
    ctx.fillText(level.name, cx, 82);

    // Best time badge for the selected level.
    const best = getBestTime(playerInput.selectedLevel);
    if (best !== null) {
      ctx.fillStyle = '#FF6F00';
      ctx.font = '600 14px "Segoe UI", sans-serif';
      ctx.fillText('★ Best: ' + best.toFixed(2) + 's', cx, 102);
    }

    // === Section: Terrain Preview ===
    drawSectionHeader('TERRAIN PREVIEW', cx, 138);

    const previewX = 200;
    const previewY = 152;
    const previewW = 800;
    const previewH = 95;
    // Card background.
    drawRoundRect(previewX - 8, previewY - 8, previewW + 16, previewH + 16, 8, 'rgba(255,255,255,0.6)', 'rgba(0,0,0,0.06)');

    // Fill below terrain line.
    ctx.beginPath();
    for (let i = 0; i < previewPoints.length; i++) {
      const p = previewPoints[i];
      const px = previewX + (p.x / level.destination) * previewW;
      const py = previewY + previewH - (p.y / maxH) * previewH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineTo(previewX + previewW, previewY + previewH);
    ctx.lineTo(previewX, previewY + previewH);
    ctx.closePath();
    ctx.fillStyle = previewTheme.dirt;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Surface line.
    ctx.strokeStyle = previewTheme.grass;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < previewPoints.length; i++) {
      const p = previewPoints[i];
      const px = previewX + (p.x / level.destination) * previewW;
      const py = previewY + previewH - (p.y / maxH) * previewH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Goal flag on preview.
    const goalPx = previewX + previewW;
    const goalPy = previewY + previewH - 5;
    ctx.fillStyle = '#C62828';
    ctx.beginPath();
    ctx.moveTo(goalPx, goalPy - 16);
    ctx.lineTo(goalPx + 14, goalPy - 12);
    ctx.lineTo(goalPx, goalPy - 8);
    ctx.closePath();
    ctx.fill();

    // === Section: Initial Speed ===
    drawSectionHeader('CHOOSE INITIAL SPEED', cx, 282);

    const speedX = 360;
    const speedY = 310;
    const speedW = 480;
    const speedH = 14;

    // Slider track (rounded).
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    drawRoundRect(speedX, speedY, speedW, speedH, 7, 'rgba(0,0,0,0.08)');
    // Filled portion.
    const speedRatio = (playerInput.initialSpeed - MIN_INITIAL_SPEED) / (MAX_INITIAL_SPEED - MIN_INITIAL_SPEED);
    const fillW = Math.max(speedW * speedRatio, 7);
    const speedGrad = ctx.createLinearGradient(speedX, 0, speedX + fillW, 0);
    speedGrad.addColorStop(0, '#4FC3F7');
    speedGrad.addColorStop(1, '#0288D1');
    drawRoundRect(speedX, speedY, fillW, speedH, 7, speedGrad);
    // Knob with shadow.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#0277BD';
    ctx.beginPath();
    ctx.arc(speedX + speedW * speedRatio, speedY + speedH / 2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(speedX + speedW * speedRatio - 2, speedY + speedH / 2 - 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Value.
    ctx.fillStyle = '#0277BD';
    ctx.font = '700 22px "Segoe UI", sans-serif';
    ctx.fillText(Math.round(playerInput.initialSpeed) + ' px/s', cx, speedY + 38);

    // Suggested speed hint.
    const suggestRatio = (level.suggestedSpeed - MIN_INITIAL_SPEED) / (MAX_INITIAL_SPEED - MIN_INITIAL_SPEED);
    const suggestX = speedX + speedW * suggestRatio;
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.moveTo(suggestX, speedY - 4);
    ctx.lineTo(suggestX - 5, speedY - 12);
    ctx.lineTo(suggestX + 5, speedY - 12);
    ctx.closePath();
    ctx.fill();
    ctx.font = '600 11px "Segoe UI", sans-serif';
    ctx.fillStyle = '#388E3C';
    ctx.fillText('suggested', suggestX, speedY - 16);

    // === Controls hint ===
    ctx.fillStyle = '#455A64';
    ctx.font = '400 14px "Segoe UI", sans-serif';
    ctx.fillText('Drag slider to set speed  |  1 / 2 / 3  select level  |  H  instructions  |  SPACE  start', cx, 400);

    ctx.textAlign = 'left';
  }

  // Helper: draws a section header with accent styling.
  function drawSectionHeader(text, cx, y) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1976D2';
    ctx.font = '700 13px "Segoe UI", sans-serif';
    try { ctx.letterSpacing = '2px'; } catch (e) {}
    ctx.fillText(text, cx, y);
    // Measure while letterSpacing is still applied.
    const tw = ctx.measureText(text).width;
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    // Accent dots on either side.
    ctx.fillStyle = 'rgba(33,150,243,0.3)';
    ctx.beginPath();
    ctx.arc(cx - tw / 2 - 16, y - 4, 2, 0, Math.PI * 2);
    ctx.arc(cx + tw / 2 + 16, y - 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'left';
  }

  // ==========================================
  // LEVEL INTRO SCREEN
  // Shows the wheel type and key info before gameplay begins.
  // ==========================================

  function drawIntroScreen() {
    const level = LEVELS[gameState.levelId - 1];
    const cx = CANVAS_WIDTH / 2;

    // Overlay.
    ctx.fillStyle = 'rgba(245, 247, 250, 0.97)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';

    // Level name.
    ctx.fillStyle = '#1A237E';
    ctx.font = '700 30px "Segoe UI", sans-serif';
    ctx.fillText(level.name, cx, 120);

    // Description.
    ctx.fillStyle = '#546E7A';
    ctx.font = '400 16px "Segoe UI", sans-serif';
    ctx.fillText(level.description, cx, 150);

    // Section header.
    drawSectionHeader('YOUR WHEELS', cx, 210);

    // Large wheel display.
    const wheelCY = 310;
    drawWheelBadge(cx, wheelCY, 2.8, level.wheelType, visualState.wheelRotation * 0.5);

    // Wheel label.
    const wheelNames = { normal: 'Normal Wheels', ice: 'Ice Wheels', cake: 'Cake Wheels' };
    const wheelDescs = {
      normal: 'Balanced grip and speed. A good all-rounder.',
      ice: 'Low friction — fast on slopes, but balance is slippery.',
      cake: 'High friction — sticky and slow. Watch your energy!'
    };
    ctx.fillStyle = '#1565C0';
    ctx.font = '700 22px "Segoe UI", sans-serif';
    ctx.fillText(wheelNames[level.wheelType], cx, 380);
    ctx.fillStyle = '#546E7A';
    ctx.font = '400 14px "Segoe UI", sans-serif';
    ctx.fillText(wheelDescs[level.wheelType], cx, 405);

    // Key stats.
    drawSectionHeader('LEVEL INFO', cx, 445);
    ctx.fillStyle = '#37474F';
    ctx.font = '400 15px "Segoe UI", sans-serif';
    ctx.fillText('Distance: ' + level.destination + ' px   |   Suggested speed: ' + level.suggestedSpeed + ' px/s', cx, 475);

    // Best time for this level.
    const introBest = getBestTime(gameState.levelId);
    if (introBest !== null) {
      ctx.fillStyle = '#FF6F00';
      ctx.font = '600 15px "Segoe UI", sans-serif';
      ctx.fillText('★ Best time: ' + introBest.toFixed(2) + 's', cx, 500);
      if (level.energyPads.length > 0) {
        ctx.fillStyle = '#F9A825';
        ctx.font = '600 14px "Segoe UI", sans-serif';
        ctx.fillText('Energy pads available on this track!', cx, 522);
      }
    } else {
      if (level.energyPads.length > 0) {
        ctx.fillStyle = '#F9A825';
        ctx.font = '600 14px "Segoe UI", sans-serif';
        ctx.fillText('Energy pads available on this track!', cx, 500);
      }
    }

    // Prompt.
    ctx.fillStyle = '#0277BD';
    ctx.font = '700 18px "Segoe UI", sans-serif';
    ctx.fillText('Press SPACE to begin', cx, 545);

    ctx.textAlign = 'left';
  }

  function drawEndScreen(isWin) {
    const overlayW = 520;
    const overlayH = isWin ? 280 : 220;
    const overlayX = (CANVAS_WIDTH - overlayW) / 2;
    const overlayY = (CANVAS_HEIGHT - overlayH) / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    drawRoundRect(overlayX, overlayY, overlayW, overlayH, 14, 'rgba(255,255,255,0.96)', 'rgba(0,0,0,0.15)');

    ctx.textAlign = 'center';
    if (isWin) {
      ctx.fillStyle = '#2E7D32';
      ctx.font = 'bold 42px "Segoe UI", sans-serif';
      ctx.fillText('YOU REACHED THE GOAL!', CANVAS_WIDTH / 2, overlayY + 55);

      // Current time.
      ctx.fillStyle = COLOR_TEXT;
      ctx.font = '20px "Segoe UI", sans-serif';
      ctx.fillText('Time: ' + gameState.elapsedTime.toFixed(2) + 's', CANVAS_WIDTH / 2, overlayY + 95);

      // Best time comparison.
      const best = getBestTime(gameState.levelId);
      if (gameState.isNewRecord) {
        // New record badge.
        ctx.fillStyle = '#FF6F00';
        ctx.font = 'bold 18px "Segoe UI", sans-serif';
        ctx.fillText('★ NEW RECORD! ★', CANVAS_WIDTH / 2, overlayY + 125);
        ctx.fillStyle = '#7B8A99';
        ctx.font = '15px "Segoe UI", sans-serif';
        ctx.fillText('Previous best: ' + formatTime(best), CANVAS_WIDTH / 2, overlayY + 150);
      } else if (best !== null) {
        ctx.fillStyle = '#7B8A99';
        ctx.font = '15px "Segoe UI", sans-serif';
        const diff = gameState.elapsedTime - best;
        ctx.fillText('Best: ' + best.toFixed(2) + 's  (+' + diff.toFixed(2) + 's)', CANVAS_WIDTH / 2, overlayY + 125);
      }

      // Controls hint.
      ctx.fillStyle = '#455A64';
      ctx.font = '16px "Segoe UI", sans-serif';
      if (gameState.levelId < 3) {
        ctx.fillText('Press N for next level  |  SPACE to restart', CANVAS_WIDTH / 2, overlayY + overlayH - 30);
      } else {
        ctx.fillText('You completed all levels! Press SPACE to play again.', CANVAS_WIDTH / 2, overlayY + overlayH - 30);
      }
    } else {
      ctx.fillStyle = '#C62828';
      ctx.font = 'bold 42px "Segoe UI", sans-serif';
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, overlayY + 60);
      ctx.fillStyle = COLOR_TEXT;
      ctx.font = '18px "Segoe UI", sans-serif';
      ctx.fillText(gameState.failReason, CANVAS_WIDTH / 2, overlayY + 105);
      ctx.fillText('Try adjusting your initial speed or your core position.', CANVAS_WIDTH / 2, overlayY + 135);

      // Show best time even on failure for motivation.
      const best = getBestTime(gameState.levelId);
      if (best !== null) {
        ctx.fillStyle = '#7B8A99';
        ctx.font = '15px "Segoe UI", sans-serif';
        ctx.fillText('Best time: ' + best.toFixed(2) + 's', CANVAS_WIDTH / 2, overlayY + 165);
      }

      ctx.fillStyle = '#455A64';
      ctx.font = '16px "Segoe UI", sans-serif';
      ctx.fillText('Press SPACE to restart  |  ESC to change level', CANVAS_WIDTH / 2, overlayY + overlayH - 30);
    }
    ctx.textAlign = 'left';
  }

  function render() {
    // Clear.
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Always draw the world.
    drawBackground();
    drawTerrain();

    // Draw trail particles behind the skateboard.
    drawParticles(cameraX());

    if (gameState.state === 'instruction') {
      drawInstructionScreen();
      return;
    }

    if (gameState.state === 'start') {
      drawStartScreen();
      return;
    }

    if (gameState.state === 'intro') {
      drawIntroScreen();
      return;
    }

    const terrainY = WORLD_BASE_Y - getTerrainHeight(gameState.position, gameState.levelId);
    const screenX = gameState.position - cameraX();
    const boardAngle = getTerrainAngle(gameState.position, gameState.levelId);

    if (gameState.state === 'falling') {
      // Falling animation: board and character tracked in world coordinates.
      const fall = visualState.fall;
      // Draw board at its own world position — stays on terrain, no clipping.
      const boardScreenX = fall.boardWorldX - cameraX();
      const boardAngleAtBoard = getTerrainAngle(fall.boardWorldX, gameState.levelId);
      drawSkateboard(boardScreenX, fall.boardWorldY, boardAngleAtBoard + fall.boardRot);
      // Draw character at its own world position.
      const charScreenX = fall.charWorldX - cameraX();
      drawFallingCharacter(charScreenX, fall.charWorldY, fall.charRot);
      // Keep HUD visible but slightly faded so the player sees what happened.
      ctx.globalAlpha = 0.7;
      drawHUD();
      ctx.globalAlpha = 1;
    } else {
      // Normal play, win, or gameover (still frame behind end screen).
      drawSkateboard(screenX, terrainY, boardAngle);
      drawCharacter(screenX, terrainY, boardAngle);
      drawHUD();
    }

    // Draw end screen if needed.
    if (gameState.state === 'win' || gameState.state === 'gameover') {
      drawEndScreen(gameState.state === 'win');
    }
  }

  // ==========================================
  // SECTION 9: INPUT HANDLING
  // ==========================================

  function resetLevel() {
    // Reset to start screen for the current selected level.
    const prevState = gameState.state;
    gameState.state = 'start';
    gameState.levelId = playerInput.selectedLevel;
    gameState.speed = 0;
    gameState.energy = 0;
    gameState.balance = 1;
    gameState.position = 0;
    gameState.angle = 0;
    gameState.idealCore = 0.5;
    gameState.failReason = '';
    gameState.elapsedTime = 0;
    gameState.startTime = 0;
    gameState.isNewRecord = false;
    playerInput.coreHeight = 0.5;
    playerInput.mouseControlActive = false;
    visualState.particles.length = 0;
    visualState.wheelRotation = 0;
    visualState.fall.active = false;
    visualState.fall.time = 0;
    if (prevState !== 'start') notifyStateChange();
  }

  function startPlaying() {
    gameState.state = 'playing';
    gameState.speed = playerInput.initialSpeed;
    gameState.startTime = performance.now() / 1000;
    // Reset held keys so the initial speed adjustment does not leak into core control.
    playerInput.upPressed = false;
    playerInput.downPressed = false;
    // Reset core to neutral and disable mouse control until the player actually moves the mouse.
    playerInput.coreHeight = 0.5;
    playerInput.mouseControlActive = false;
    notifyStateChange();
  }

  function nextLevel() {
    if (gameState.levelId < 3) {
      playerInput.selectedLevel = gameState.levelId + 1;
      playerInput.initialSpeed = LEVELS[playerInput.selectedLevel - 1].suggestedSpeed;
      resetLevel();
    }
  }

  document.addEventListener('keydown', (e) => {
    // Prevent default for arrow keys / space to avoid scrolling the page.
    if (['ArrowUp', 'ArrowDown', ' ', 'Spacebar'].includes(e.key)) {
      e.preventDefault();
    }

    if (e.key === 'ArrowUp') {
      playerInput.upPressed = true;
      playerInput.mouseControlActive = false;  // keyboard takes priority
      if (gameState.state === 'start') {
        playerInput.initialSpeed = Math.min(MAX_INITIAL_SPEED, playerInput.initialSpeed + 10);
      }
    }
    if (e.key === 'ArrowDown') {
      playerInput.downPressed = true;
      playerInput.mouseControlActive = false;  // keyboard takes priority
      if (gameState.state === 'start') {
        playerInput.initialSpeed = Math.max(MIN_INITIAL_SPEED, playerInput.initialSpeed - 10);
      }
    }

    if (gameState.state === 'instruction') {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        gameState.state = 'start';
        notifyStateChange();
      }
    } else if (gameState.state === 'start') {
      if (e.key === '1') { playerInput.selectedLevel = 1; playerInput.initialSpeed = LEVELS[0].suggestedSpeed; }
      if (e.key === '2') { playerInput.selectedLevel = 2; playerInput.initialSpeed = LEVELS[1].suggestedSpeed; }
      if (e.key === '3') { playerInput.selectedLevel = 3; playerInput.initialSpeed = LEVELS[2].suggestedSpeed; }
      if (e.key === ' ' || e.key === 'Spacebar') {
        startGame();
      }
      if (e.key === 'h' || e.key === 'H' || e.key === 'i' || e.key === 'I') {
        gameState.state = 'instruction';
        notifyStateChange();
      }
    } else if (gameState.state === 'intro') {
      if (e.key === ' ' || e.key === 'Spacebar') {
        beginPlay();
      }
    } else if (gameState.state === 'falling') {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        resetLevel();
      }
    } else if (gameState.state === 'win' || gameState.state === 'gameover') {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        resetLevel();
      }
      if (e.key === 'n' || e.key === 'N') {
        nextLevel();
      }
      if (e.key === 'Escape') {
        // Return to start screen for level selection.
        gameState.state = 'start';
        playerInput.selectedLevel = 1;
        playerInput.initialSpeed = LEVELS[0].suggestedSpeed;
        resetLevel();
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') playerInput.upPressed = false;
    if (e.key === 'ArrowDown') playerInput.downPressed = false;
  });

  // Convert a mouse / touch event's screen coordinates to canvas coordinates.
  function eventToCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    return {
      x: (clientX - rect.left) / rect.width * CANVAS_WIDTH,
      y: (clientY - rect.top) / rect.height * CANVAS_HEIGHT
    };
  }

  // Speed slider geometry (must match drawStartScreen).
  const SPEED_SLIDER = { x: 360, y: 310, w: 480, h: 14 };

  function isInsideSpeedSlider(cx, cy) {
    return cx >= SPEED_SLIDER.x - 20 && cx <= SPEED_SLIDER.x + SPEED_SLIDER.w + 20 &&
           cy >= SPEED_SLIDER.y - 20 && cy <= SPEED_SLIDER.y + SPEED_SLIDER.h + 20;
  }

  function handleCanvasDown(e) {
    if (e.cancelable) e.preventDefault();
    const { x, y } = eventToCanvasCoords(e);

    if (gameState.state === 'start' && isInsideSpeedSlider(x, y)) {
      playerInput.draggingSpeed = true;
      updateSpeedFromMouse(x);
    }
  }

  function handleCanvasMove(e) {
    const { x, y } = eventToCanvasCoords(e);
    playerInput.mouseCanvasX = x;
    playerInput.mouseCanvasY = y;
    playerInput.mouseInside = true;
    playerInput.mouseControlActive = true;  // mouse takes priority back from keyboard

    if (playerInput.draggingSpeed && gameState.state === 'start') {
      if (e.cancelable) e.preventDefault();
      updateSpeedFromMouse(x);
    }
  }

  function handleCanvasUp(e) {
    playerInput.draggingSpeed = false;
  }

  function handleCanvasLeave() {
    playerInput.mouseInside = false;
    playerInput.draggingSpeed = false;
  }

  function updateSpeedFromMouse(canvasX) {
    const ratio = Math.max(0, Math.min(1, (canvasX - SPEED_SLIDER.x) / SPEED_SLIDER.w));
    playerInput.initialSpeed = MIN_INITIAL_SPEED + ratio * (MAX_INITIAL_SPEED - MIN_INITIAL_SPEED);
  }

  function startGame() {
    if (gameState.state === 'start') {
      gameState.state = 'intro';
      notifyStateChange();
    }
  }

  function beginPlay() {
    if (gameState.state === 'intro') {
      startPlaying();
    }
  }

  function restartGame() {
    if (gameState.state === 'win' || gameState.state === 'gameover' || gameState.state === 'falling' || gameState.state === 'playing' || gameState.state === 'intro') {
      resetLevel();
    }
  }

  function selectLevel(levelId) {
    if (levelId >= 1 && levelId <= 3 && gameState.state === 'start') {
      playerInput.selectedLevel = levelId;
      playerInput.initialSpeed = LEVELS[levelId - 1].suggestedSpeed;
      resetLevel();
    }
  }

  // UI state-change callback (used by game.html to update button labels).
  let onStateChangeCallback = null;
  function notifyStateChange() {
    if (onStateChangeCallback) {
      onStateChangeCallback(gameState.state);
    }
  }

  // We expose these globally so game.html can bind them.
  window.skateboardGame = {
    setCanvas: function (c) {
      canvas = c;
      ctx = canvas.getContext('2d');
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      // Mouse interaction on canvas.
      canvas.addEventListener('mousedown', handleCanvasDown);
      canvas.addEventListener('mousemove', handleCanvasMove);
      window.addEventListener('mouseup', handleCanvasUp);
      canvas.addEventListener('mouseleave', handleCanvasLeave);
      // Touch support.
      canvas.addEventListener('touchstart', handleCanvasDown, { passive: false });
      canvas.addEventListener('touchmove', handleCanvasMove, { passive: false });
      canvas.addEventListener('touchend', handleCanvasUp, { passive: false });
      resetLevel();
      requestAnimationFrame(gameLoop);
    },
    startGame: startGame,
    beginPlay: beginPlay,
    restartGame: restartGame,
    selectLevel: selectLevel,
    onStateChange: function (callback) {
      onStateChangeCallback = callback;
      // Fire once with the current state so the UI can initialise.
      if (callback) callback(gameState.state);
    }
  };

  // ==========================================
  // SECTION 10: GAME LOOP
  // ==========================================

  let lastTime = 0;
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap dt to avoid huge jumps
    lastTime = timestamp;

    // Update core height based on input.
    if (gameState.state === 'playing') {
      // Keyboard: incremental adjustment.
      if (playerInput.upPressed) {
        playerInput.coreHeight = Math.min(1, playerInput.coreHeight + CORE_MOVE_SPEED * dt);
      }
      if (playerInput.downPressed) {
        playerInput.coreHeight = Math.max(0, playerInput.coreHeight - CORE_MOVE_SPEED * dt);
      }
      // Mouse: direct position mapping (top = high core, bottom = low core).
      // Only applies when mouse was the last input method used (not keyboard).
      if (playerInput.mouseControlActive) {
        // Wider range for finer control — more pixels per core unit.
        const minY = 100, maxY = 500;  // 400px range → 200px from center to extremes
        const clampedY = Math.max(minY, Math.min(maxY, playerInput.mouseCanvasY));
        const targetCore = 1.0 - (clampedY - minY) / (maxY - minY);
        // Gentler smoothing for steadier balance control.
        playerInput.coreHeight += (targetCore - playerInput.coreHeight) * Math.min(1, 5 * dt);
      }

      // Wheel rotation: angular velocity = linear speed / wheel radius.
      const level = LEVELS[gameState.levelId - 1];
      const wheelR = level.wheelType === 'cake' ? 9 : (level.wheelType === 'ice' ? 8 : 7);
      visualState.wheelRotation += (gameState.speed / wheelR) * dt;

      // Spawn trail particles at the rear wheel contact point.
      const terrainY = WORLD_BASE_Y - getTerrainHeight(gameState.position, gameState.levelId);
      spawnTrailParticles(gameState.position, terrainY, level.wheelType, gameState.speed);
    } else if (gameState.state === 'start' || gameState.state === 'intro') {
      // Slow idle spin for the wheel showcase on the start / intro screen.
      visualState.wheelRotation += 0.8 * dt;
    }

    updateParticles(dt);

    // Capture state before any state-mutating update so all transitions are detected.
    const previousState = gameState.state;
    updateFallAnimation(dt);
    updatePhysics(dt);
    if (gameState.state !== previousState) {
      notifyStateChange();
    }
    render();

    requestAnimationFrame(gameLoop);
  }
})();
