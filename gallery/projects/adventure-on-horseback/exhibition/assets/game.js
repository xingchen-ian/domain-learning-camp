// An adventure on horseback - Game Core
// Real-life horse riding simulation with three levels

(function (global) {
  'use strict';

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  const W = 1920;
  const H = 1080;
  let HORIZON_Y = 380;       // mutable: changes with the camera view mode
  const GROUND_END_Y = 1080;
  let FOCAL = 900;           // mutable: changes with the camera view mode
  let GROUND_SLOPE = 220;    // mutable: ground perspective falloff per view
  let HORSE_BASE_Y = 700;    // mutable: vertical anchor of the horse per view
  const PLAYER_SCREEN_X = W / 2;
  const PLAYER_SCREEN_Y = 760;

  // ---- Camera view modes (press V to cycle) ----
  //  Behind   : over-the-shoulder chase view. The horse faces AWAY from you,
  //             so it meets every fence head-on - never sideways to it.
  //  Top-down : a high angle looking down at the whole course (ETG-style).
  //  Side     : a 3/4 side view, as if you were standing at the rail.
  const VIEWS = [
    { name: 'Behind',   horizon: 380, focal: 900,  slope: 220, baseY: 700, horse: 'behind' },
    { name: 'Top-down', horizon: 170, focal: 1150, slope: 440, baseY: 620, horse: 'top' },
    { name: 'Side',     horizon: 330, focal: 840,  slope: 175, baseY: 718, horse: 'side' }
  ];
  let currentView = 0;
  function applyView() {
    const v = VIEWS[currentView];
    HORIZON_Y = v.horizon;
    FOCAL = v.focal;
    GROUND_SLOPE = v.slope;
    HORSE_BASE_Y = v.baseY;
  }
  applyView();

  // Open-field bounds (world units). The horse may roam freely within these,
  // giving the wide-grassland feel instead of a narrow lane.
  const FIELD_HALF = 64;   // playable lateral half-width
  const FENCE_X = 72;      // post-and-rail boundary sits just outside the field

  // ========================================================================
  // UTILITIES
  // ========================================================================

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function dist(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Project a world (X, Z) point to screen.
  // +Z is forward (away from camera); horseZ increases over time.
  function project(worldX, worldY, worldZ, camX, camY, camZ, camYaw) {
    // Translate to camera space
    const dx = worldX - camX;
    const dz = worldZ - camZ;
    // Rotate by -camYaw
    const cs = Math.cos(-camYaw);
    const sn = Math.sin(-camYaw);
    const lx = dx * cs - dz * sn;
    const lz = dx * sn + dz * cs;
    // ly not used for ground projection but kept for completeness
    const ly = worldY - camY;
    if (lz <= 1) return null; // behind or too close
    const sx = PLAYER_SCREEN_X + (lx * FOCAL) / lz;
    const sy = PLAYER_SCREEN_Y - (ly * FOCAL) / lz;
    return { x: sx, y: sy, depth: lz };
  }

  // Ground projection - for things lying on ground (y=0)
  function projectGround(worldX, worldZ, camX, camZ, camYaw) {
    const dx = worldX - camX;
    const dz = worldZ - camZ;
    const cs = Math.cos(-camYaw);
    const sn = Math.sin(-camYaw);
    const lx = dx * cs - dz * sn;
    const lz = dx * sn + dz * cs;
    if (lz <= 1) return null;
    const sx = PLAYER_SCREEN_X + (lx * FOCAL) / lz;
    // Ground gets higher (smaller sy) as z increases
    const t = clamp(lz / 600, 0, 1);
    const sy = PLAYER_SCREEN_Y - (PLAYER_SCREEN_Y - HORIZON_Y) * (1 - t) * 0.0;
    // Simpler: lerp from player screen Y to horizon Y as z grows
    const groundT = 1 - Math.exp(-lz / GROUND_SLOPE);
    const sy2 = lerp(PLAYER_SCREEN_Y, HORIZON_Y, groundT);
    return { x: sx, y: sy2, depth: lz, scale: FOCAL / lz };
  }

  // ========================================================================
  // LEVEL DEFINITIONS
  // ========================================================================

  // Each level: route is a polyline (waypoints), obstacles are placed at z positions
  // along that polyline. The horse must steer to follow the route and jump obstacles.

  const LEVELS = [
    // ---------------- LEVEL 1: SIMPLE ----------------
    {
      id: 1,
      name: 'Level 1 - First Canter',
      desc: 'An open meadow. Learn the feel of your horse and clear 8 fences at an easy, steady pace.',
      timeLimit: null, // No time limit - take your time
      horse: {
        name: 'Whisper',
        temper: 'gentle', // gentle, calm, spirited
        maxSpeed: 10,
        jumpPower: 16,
        startEmotion: 85,
        angerRate: 0.5,
        color: '#7b4a2a',
        saddleColor: '#3a1e0d'
      },
      route: [
        { z: 0, x: 0 },
        { z: 1000, x: 0 }
      ],
      // Spaced ~115 units apart so each fence gets a clear, calm approach
      obstacles: [
        { z: 90,  type: 'vertical', height: 0.85 },
        { z: 205, type: 'vertical', height: 0.85 },
        { z: 320, type: 'vertical', height: 0.85 },
        { z: 435, type: 'vertical', height: 0.85 },
        { z: 550, type: 'oxer',    height: 0.90 },
        { z: 665, type: 'vertical', height: 0.85 },
        { z: 780, type: 'vertical', height: 0.85 },
        { z: 895, type: 'oxer',    height: 0.90 }
      ],
      fences: true,
      ambience: 'morning'
    },

    // ---------------- LEVEL 2: COMPLICATED ----------------
    {
      id: 2,
      name: 'Level 2 - Winding Path',
      desc: 'A wider S-curve course with 10 mixed fences. Watch your time and plan each line.',
      timeLimit: 90,
      horse: {
        name: 'Dapple',
        temper: 'gentle',
        maxSpeed: 12,
        jumpPower: 17,
        startEmotion: 82,
        angerRate: 0.7,
        color: '#8a5a32',
        saddleColor: '#3a1e0d'
      },
      route: [
        { z: 0, x: 0 },
        { z: 120, x: 0 },
        { z: 240, x: 20 },
        { z: 360, x: 20 },
        { z: 480, x: -16 },
        { z: 600, x: -16 },
        { z: 720, x: 18 },
        { z: 840, x: 18 },
        { z: 960, x: -12 },
        { z: 1120, x: 0 }
      ],
      // Spaced ~105 units apart along the S-curve
      obstacles: [
        { z: 95,   type: 'vertical', height: 0.90 },
        { z: 200,  type: 'oxer',    height: 0.95 },
        { z: 305,  type: 'vertical', height: 0.90 },
        { z: 410,  type: 'wall',    height: 1.05 },
        { z: 515,  type: 'vertical', height: 0.90 },
        { z: 620,  type: 'oxer',    height: 0.95 },
        { z: 725,  type: 'vertical', height: 0.90 },
        { z: 830,  type: 'wall',    height: 1.05 },
        { z: 935,  type: 'vertical', height: 0.90 },
        { z: 1040, type: 'oxer',    height: 0.95 }
      ],
      fences: true,
      ambience: 'noon'
    },

    // ---------------- LEVEL 3: ROUNDABOUT ----------------
    {
      id: 3,
      name: 'Level 3 - Trust the Bond',
      desc: 'A long, twisting 14-fence course on a strong, bad-tempered mare. Soothe her - or she will not listen.',
      timeLimit: 80,
      horse: {
        name: 'Storm',
        temper: 'spirited',
        maxSpeed: 14,
        jumpPower: 20,
        startEmotion: 65,
        angerRate: 1.5, // gets angry easily
        color: '#1a1a1a',
        saddleColor: '#7a1414'
      },
      route: [
        { z: 0, x: 0 },
        { z: 90, x: 0 },
        { z: 180, x: -22 },
        { z: 270, x: -22 },
        { z: 360, x: 20 },
        { z: 450, x: 20 },
        { z: 540, x: -18 },
        { z: 630, x: -18 },
        { z: 720, x: 16 },
        { z: 810, x: 16 },
        { z: 900, x: -14 },
        { z: 990, x: -14 },
        { z: 1080, x: 12 },
        { z: 1170, x: 12 },
        { z: 1280, x: 0 }
      ],
      // Spaced ~85 units apart across a long, twisting course
      obstacles: [
        { z: 80,   type: 'vertical', height: 0.95 },
        { z: 165,  type: 'oxer',    height: 1.00 },
        { z: 250,  type: 'vertical', height: 0.95 },
        { z: 335,  type: 'wall',    height: 1.10 },
        { z: 420,  type: 'vertical', height: 0.95 },
        { z: 505,  type: 'oxer',    height: 1.00 },
        { z: 590,  type: 'vertical', height: 0.95 },
        { z: 675,  type: 'wall',    height: 1.10 },
        { z: 760,  type: 'vertical', height: 0.95 },
        { z: 845,  type: 'oxer',    height: 1.00 },
        { z: 930,  type: 'vertical', height: 0.95 },
        { z: 1015, type: 'wall',    height: 1.10 },
        { z: 1100, type: 'vertical', height: 0.95 },
        { z: 1185, type: 'oxer',    height: 1.00 }
      ],
      fences: true,
      ambience: 'sunset'
    }
  ];

  // ========================================================================
  // HORSE EMOTION SYSTEM
  // ========================================================================

  const EMOTION_LABEL = {
    happy: { lo: 75, hi: 100, color: '#7bd389', text: 'Happy' },
    neutral: { lo: 50, hi: 74, color: '#e6c14b', text: 'Calm' },
    tired: { lo: 25, hi: 49, color: '#e69142', text: 'Tired' },
    angry: { lo: 0, hi: 24, color: '#e0524a', text: 'Angry' }
  };

  function emotionCategory(e) {
    if (e >= 75) return 'happy';
    if (e >= 50) return 'neutral';
    if (e >= 25) return 'tired';
    return 'angry';
  }

  // ========================================================================
  // GAME STATE
  // ========================================================================

  const Game = {
    state: 'gameintro', // gameintro, menu, levelSelect, playing, paused, won, lost, levelComplete
    levelIndex: 0,
    time: 0,
    timeLimit: 0,
    speed: 0,
    targetSpeed: 0,
    horseX: 0,
    horseYaw: 0,
    horseJump: 0, // 0..1 jump arc progress
    horseEmotion: 80,
    obedience: 1,     // 1 = fully responsive, 0 = barely listens (driven by emotion)
    bolting: false,   // true when a frightened horse runs off on its own
    obstacles: [],
    particles: [],
    totalJumps: 0,
    cleanJumps: 0,
    barsDropped: 0,
    whipsUsed: 0,
    soothesUsed: 0,
    jumpsMade: 0,
    feedback: [], // floating text feedback
    shake: 0,
    trailDust: [],
    camera: { x: 0, z: 0, yaw: 0 }
  };

  // ========================================================================
  // INPUT
  // ========================================================================

  const Input = {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    whip: false,
    whipPressed: false,
    soothe: false,
    soothePressed: false,
    pause: false,
    pausePressed: false,
    restart: false,
    restartPressed: false
  };

  // ========================================================================
  // LEVEL INITIALIZATION
  // ========================================================================

  function startLevel(idx) {
    Game.state = 'playing';
    Game.levelIndex = idx;
    const lvl = LEVELS[idx];
    Game.timeLimit = lvl.timeLimit;
    Game.time = lvl.timeLimit || 0;
    Game.speed = 0;
    Game.targetSpeed = 0;
    Game.horseX = 0;
    Game.horseYaw = 0;
    Game.horseJump = 0;
    Game.horseEmotion = lvl.horse.startEmotion;
    Game.obedience = 1;
    Game.bolting = false;
    Game.totalJumps = lvl.obstacles.length;
    Game.cleanJumps = 0;
    Game.barsDropped = 0;
    Game.whipsUsed = 0;
    Game.soothesUsed = 0;
    Game.jumpsMade = 0;
    Game.feedback = [];
    Game.shake = 0;
    Game.trailDust = [];
    Game.particles = [];
    Game.camera = { x: 0, z: 0, yaw: 0 };

    // Build obstacle instances
    Game.obstacles = lvl.obstacles.map((o, i) => {
      const routePos = getRoutePositionAt(lvl, o.z);
      return {
        index: i,
        type: o.type,
        height: o.height,
        worldX: routePos.x,
        worldZ: o.z,
        bars: makeObstacleBars(o.type, o.height),
        passed: false,
        hit: false,
        hitting: false,
        hitProgress: 0
      };
    });
  }

  function getRoutePositionAt(lvl, z) {
    // Linear interpolate along the polyline
    const route = lvl.route;
    if (z <= route[0].z) return { x: route[0].x, z: route[0].z };
    if (z >= route[route.length - 1].z) {
      return { x: route[route.length - 1].x, z: route[route.length - 1].z };
    }
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1];
      if (z >= a.z && z <= b.z) {
        const t = (z - a.z) / (b.z - a.z);
        return { x: lerp(a.x, b.x, t), z };
      }
    }
    return { x: 0, z };
  }

  function makeObstacleBars(type, height) {
    // Each obstacle has 1 or 2 horizontal bars
    if (type === 'vertical') {
      return [{ offset: 0, h: 0, w: 0, dropped: false }];
    }
    if (type === 'oxer') {
      return [
        { offset: -0.4, h: 0, w: 0, dropped: false },
        { offset: 0.4, h: 0, w: 0, dropped: false }
      ];
    }
    if (type === 'wall') {
      return [{ offset: 0, h: 0, w: 0, dropped: false }];
    }
    return [{ offset: 0, h: 0, w: 0, dropped: false }];
  }

  // ========================================================================
  // UPDATE LOOP
  // ========================================================================

  function update(dt) {
    if (Game.state !== 'playing') return;
    const lvl = LEVELS[Game.levelIndex];

    // -------- Speed control (W/S or Up/Down) --------
    // Gentle acceleration so the rider stays in control, not hair-trigger.
    const accelRate = 5;
    if (Game.bolting) {
      // A frightened horse runs on its own - your throttle barely matters
      Game.targetSpeed = Math.min(lvl.horse.maxSpeed * 1.25, Game.targetSpeed + 4 * dt);
    } else if (Input.forward) {
      Game.targetSpeed = Math.min(lvl.horse.maxSpeed, Game.targetSpeed + accelRate * dt);
    } else if (Input.back) {
      Game.targetSpeed = Math.max(0, Game.targetSpeed - accelRate * 1.3 * dt);
    } else {
      // Natural deceleration when no input (coasts to a calm stop)
      Game.targetSpeed = Math.max(0, Game.targetSpeed - 2.2 * dt);
    }
    // Smooth, slightly laggy speed change
    Game.speed = lerp(Game.speed, Game.targetSpeed, 1 - Math.exp(-3 * dt));

    // -------- Steering (A/D or Left/Right) --------
    // A tired or frightened horse does NOT obey your hands.
    // obedience: 1 = fully responsive, 0 = barely listens.
    const obedience = clamp((Game.horseEmotion - 18) / 62, 0, 1);
    Game.obedience = obedience;
    const steerEff = lerp(0.2, 1.0, obedience);
    let steerInput = 0;
    if (Input.left) steerInput -= 1;
    if (Input.right) steerInput += 1;
    // Calm, speed-scaled steering - never jumpy
    const steerSpeed = 9 + Game.speed * 0.35;
    Game.horseX += steerInput * steerSpeed * steerEff * dt;
    // A disobedient horse drifts on its own
    if (obedience < 0.6) {
      Game.horseX += (1 - obedience) * rand(-1, 1) * 5 * dt;
    }

    // Clamp horse to the open field
    Game.horseX = clamp(Game.horseX, -FIELD_HALF + 6, FIELD_HALF - 6);

    // Yaw follows steering input (gentler)
    Game.horseYaw = lerp(Game.horseYaw, -steerInput * 0.12 * steerEff, 1 - Math.exp(-6 * dt));

    // -------- Camera follows horse --------
    Game.camera.x = lerp(Game.camera.x, Game.horseX, 1 - Math.exp(-5 * dt));
    Game.camera.z += Game.speed * dt * 4.2;
    Game.camera.yaw = lerp(Game.camera.yaw, Game.horseYaw * 0.4, 1 - Math.exp(-5 * dt));

    // -------- Time tracking --------
    if (Game.timeLimit != null) {
      Game.time -= dt;
      if (Game.time <= 0) {
        Game.time = 0;
        loseGame('Time ran out. The course is harder than it looked.');
        return;
      }
    }

    // -------- Emotion dynamics --------
    // High speed with frequent whipping makes the horse angry
    // Gentle riding soothes
    const baseEmotion = lvl.horse.startEmotion;
    const highSpeedFactor = Game.speed > lvl.horse.maxSpeed * 0.8 ? -lvl.horse.angerRate * 0.5 * dt : 0;
    // Tiredness from sustained speed
    const staminaDrain = (Game.speed / lvl.horse.maxSpeed) * 0.3 * dt;
    // Natural recovery toward 50 if not pushed
    const recovery = (50 - Game.horseEmotion) * 0.05 * dt;
    Game.horseEmotion += (highSpeedFactor + recovery - staminaDrain) * 4;
    Game.horseEmotion = clamp(Game.horseEmotion, 0, 100);

    // Whip decreases emotion
    if (Input.whipPressed) {
      Game.whipsUsed++;
      Game.targetSpeed = Math.min(lvl.horse.maxSpeed * 1.15, Game.targetSpeed + 6);
      Game.horseEmotion = Math.max(0, Game.horseEmotion - 8);
      Game.shake = 1.2;
      addParticles(20, '#c0a060', 1.2);
      addFeedback('Whip!', '#e0524a');
    }

    // Soothe increases emotion
    if (Input.soothePressed) {
      Game.soothesUsed++;
      Game.horseEmotion = Math.min(100, Game.horseEmotion + 10);
      addParticles(8, '#a3d39b', 0.6);
      addFeedback('Good girl', '#7bd389');
    }

    // -------- Jump mechanic --------
    Game.horseJump = Math.max(0, Game.horseJump - dt * 2);

    if (Input.jumpPressed && Game.horseJump <= 0) {
      // Try to jump the next obstacle in range
      const next = Game.obstacles.find(o => !o.passed && !o.hit && o.worldZ > Game.camera.z - 2 && o.worldZ < Game.camera.z + 25);
      if (next) {
        attemptJump(next, lvl);
      } else {
        // Pressing jump with nothing to jump - small wasted motion
        addFeedback('Too early', '#cccccc');
      }
    }

    // -------- Process obstacles --------
    for (const ob of Game.obstacles) {
      if (ob.passed) continue;

      // Check if we passed the obstacle without jumping
      if (!ob.hit && ob.worldZ < Game.camera.z - 1.5) {
        // We didn't jump and we passed it - hit the bar
        registerHit(ob, 'Missed jump!', lvl);
      }

      // Animate falling bars
      if (ob.hit && ob.hitProgress < 1) {
        ob.hitProgress = Math.min(1, ob.hitProgress + dt * 1.6);
      }
    }

    // -------- Reach the destination --------
    const lastWaypoint = lvl.route[lvl.route.length - 1];
    if (Game.camera.z >= lastWaypoint.z && Game.state === 'playing') {
      // Check all obstacles cleared
      const missed = Game.obstacles.filter(o => o.hit).length;
      if (missed === 0) {
        winLevel();
      } else {
        // Crossed finish but with knocked bars - still consider failure
        loseGame('You knocked down ' + missed + ' bar(s). Plan a better line.');
      }
    }

    // -------- Disobedience: the horse may simply ignore you --------
    // This is the core challenge of the game. A horse is a living, feeling
    // creature - if you scare or tire it, it stops listening to your hands,
    // refuses fences, and can even bolt.
    Game.bolting = false;
    if (Game.horseEmotion < 12) {
      // Bolting: the frightened horse runs off on its own
      if (Math.random() < dt * 0.5) {
        Game.bolting = true;
        addFeedback('Bolting!', '#e0524a');
        Game.shake = 0.6;
      }
    } else if (Game.horseEmotion < 20 && Game.speed > 0.5) {
      // Sudden refusal to move
      if (Math.random() < dt * 0.35) {
        Game.targetSpeed = Math.max(0, Game.targetSpeed - 8);
        Game.speed *= 0.5;
        addFeedback('Horse refuses!', '#e0524a');
        Game.shake = 0.5;
      }
    }

    // -------- Particles --------
    for (let i = Game.particles.length - 1; i >= 0; i--) {
      const p = Game.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.4 * dt;
      if (p.life <= 0) Game.particles.splice(i, 1);
    }

    // -------- Trail dust --------
    if (Game.speed > 4 && Math.random() < Game.speed * dt * 0.5) {
      Game.trailDust.push({
        x: Game.horseX + rand(-0.4, 0.4),
        z: Game.camera.z - 1.2,
        life: 0.8,
        size: rand(4, 10)
      });
    }
    for (let i = Game.trailDust.length - 1; i >= 0; i--) {
      const d = Game.trailDust[i];
      d.life -= dt;
      d.size += dt * 6;
      if (d.life <= 0) Game.trailDust.splice(i, 1);
    }

    // -------- Feedback text --------
    for (let i = Game.feedback.length - 1; i >= 0; i--) {
      const f = Game.feedback[i];
      f.life -= dt;
      f.y -= 25 * dt;
      if (f.life <= 0) Game.feedback.splice(i, 1);
    }

    // -------- Screen shake decay --------
    Game.shake = Math.max(0, Game.shake - dt * 3);

    // -------- Input edge triggers cleanup --------
    Input.jumpPressed = false;
    Input.whipPressed = false;
    Input.soothePressed = false;
    Input.pausePressed = false;
    Input.restartPressed = false;
  }

  function attemptJump(ob, lvl) {
    // Good jump window: distance to obstacle between 6 and 14
    // If too close, bar falls on landing. If too far, can't reach.
    const dz = ob.worldZ - Game.camera.z;
    const dx = Math.abs(Game.horseX - ob.worldX);
    const onLine = dx < 4;
    const inRange = dz > 2 && dz < 22;

    if (!onLine) {
      addFeedback('Wrong line!', '#e0524a');
      Game.horseEmotion = Math.max(0, Game.horseEmotion - 4);
      return;
    }
    if (!inRange) {
      addFeedback('Bad timing!', '#e69142');
      return;
    }
    // A frightened / tired horse may refuse the fence entirely
    if (Game.bolting) {
      addFeedback("Won't obey!", '#e0524a');
      return;
    }
    if (Game.horseEmotion < 40) {
      const refuseP = (40 - Game.horseEmotion) / 40 * 0.75;
      if (Math.random() < refuseP) {
        addFeedback("Won't jump!", '#e0524a');
        Game.horseEmotion = Math.max(0, Game.horseEmotion - 2);
        return;
      }
    }
    // Trigger jump animation
    Game.horseJump = 1;
    Game.jumpsMade++;

    // Quality of jump depends on speed and distance
    // Sweet spot: dz between 8 and 14
    let quality = 'good';
    if (dz < 5 || dz > 17) quality = 'poor';
    else if (dz >= 7 && dz <= 13) quality = 'great';

    if (quality === 'poor') {
      // Risky - 50% chance to hit
      if (Math.random() < 0.5) {
        registerHit(ob, 'Off balance!', lvl);
        return;
      }
    }

    // Successful jump
    ob.passed = true;
    Game.cleanJumps++;
    if (quality === 'great') {
      addFeedback('Beautiful!', '#7bd389');
      Game.horseEmotion = Math.min(100, Game.horseEmotion + 4);
    } else {
      addFeedback('Clear!', '#7bd389');
      Game.horseEmotion = Math.min(100, Game.horseEmotion + 1);
    }
    addParticles(15, '#fff5d6', 0.6);
  }

  function registerHit(ob, msg, lvl) {
    ob.hit = true;
    Game.barsDropped++;
    addFeedback(msg, '#e0524a');
    Game.shake = 0.8;
    addParticles(15, '#7a5230', 1.0);
    Game.horseEmotion = Math.max(0, Game.horseEmotion - 2);
  }

  function addParticles(count, color, life) {
    for (let i = 0; i < count; i++) {
      Game.particles.push({
        x: Game.horseX + rand(-1, 1),
        y: 0.5,
        z: Game.camera.z + rand(-1, 1),
        vx: rand(-2, 2),
        vy: rand(2, 5),
        life: life * rand(0.6, 1.0),
        color: color,
        size: rand(2, 5)
      });
    }
  }

  function addFeedback(text, color) {
    Game.feedback.push({
      text: text,
      x: W / 2 + rand(-80, 80),
      y: 580,
      life: 1.4,
      color: color
    });
  }

  function winLevel() {
    Game.state = 'won';
  }

  function loseGame(reason) {
    Game.state = 'lost';
    Game.loseReason = reason;
  }

  // ========================================================================
  // RENDERING
  // ========================================================================

  const Renderer = {};

  // ---- Sky ----
  Renderer.drawSky = function (ctx, ambience) {
    let top, mid, bot;
    if (ambience === 'sunset') {
      top = '#1a1f4a';
      mid = '#d96444';
      bot = '#f3c074';
    } else if (ambience === 'noon') {
      top = '#3a78c2';
      mid = '#7eb6e6';
      bot = '#c8e0f0';
    } else {
      top = '#5a8fc4';
      mid = '#a3caea';
      bot = '#e3eef5';
    }
    const grad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 80);
    grad.addColorStop(0, top);
    grad.addColorStop(0.7, mid);
    grad.addColorStop(1, bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, HORIZON_Y + 80);

    // Sun
    const sunX = ambience === 'sunset' ? W * 0.7 : W * 0.25;
    const sunY = ambience === 'sunset' ? HORIZON_Y - 30 : HORIZON_Y - 80;
    const sunR = ambience === 'sunset' ? 60 : 45;
    const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 4);
    sg.addColorStop(0, 'rgba(255,240,180,0.9)');
    sg.addColorStop(0.2, 'rgba(255,220,140,0.5)');
    sg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - sunR * 4, sunY - sunR * 4, sunR * 8, sunR * 8);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = ambience === 'sunset' ? '#ffd078' : '#fff4c4';
    ctx.fill();

    // Distant mountains
    ctx.fillStyle = ambience === 'sunset' ? '#5a3050' : '#7898b4';
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    let mx = 0;
    while (mx < W) {
      const h = 60 + Math.sin(mx * 0.013) * 40 + Math.sin(mx * 0.027) * 25;
      ctx.lineTo(mx, HORIZON_Y - h);
      mx += 40;
    }
    ctx.lineTo(W, HORIZON_Y);
    ctx.closePath();
    ctx.fill();

    // Closer hills
    ctx.fillStyle = ambience === 'sunset' ? '#7a4560' : '#8aafc4';
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    let hx = 0;
    while (hx < W) {
      const h = 30 + Math.sin(hx * 0.02 + 1.5) * 25 + Math.sin(hx * 0.05) * 15;
      ctx.lineTo(hx, HORIZON_Y - h);
      hx += 30;
    }
    ctx.lineTo(W, HORIZON_Y);
    ctx.closePath();
    ctx.fill();
  };

  // ---- Ground (wide open grassland) ----
  Renderer.drawGround = function (ctx, lvl) {
    // Sky-to-ground transition haze
    const haze = ctx.createLinearGradient(0, HORIZON_Y - 20, 0, HORIZON_Y + 30);
    haze.addColorStop(0, 'rgba(200,205,190,0.6)');
    haze.addColorStop(1, 'rgba(200,205,190,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, HORIZON_Y - 20, W, 50);

    // Open grassland - a wide, soft gradient with no hard lane edges
    const baseGrass = lvl.horse.temper === 'spirited' ? '#4f6e34' : '#5f7e38';
    const grad = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
    grad.addColorStop(0, '#86a653');
    grad.addColorStop(0.35, baseGrass);
    grad.addColorStop(1, '#33491f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

    // Mottled grass patches for a natural, uneven meadow
    ctx.save();
    for (let i = 0; i < 420; i++) {
      const gx = (i * 53.7) % W;
      const gy = HORIZON_Y + ((i * 97.3) % (H - HORIZON_Y));
      const t = (gy - HORIZON_Y) / (H - HORIZON_Y);
      const alpha = 0.05 + t * 0.16;
      const shade = (i % 3 === 0) ? 22 : (i % 3 === 1 ? -12 : 8);
      ctx.fillStyle = `rgba(${30 + shade},${55 + shade},${20 + shade},${alpha})`;
      ctx.fillRect(gx, gy, 3, 3);
    }
    ctx.restore();

    // A soft mown track follows the route centreline so the rider can read
    // the line across the open field - but it has no hard edges like a road.
    drawCoursePath(ctx, lvl);
  };

  // Soft mown-grass ribbon along the route centreline
  function drawCoursePath(ctx, lvl) {
    const endZ = lvl.route[lvl.route.length - 1].z;
    const pts = [];
    for (let z = -8; z <= endZ + 8; z += 7) {
      const rp = getRoutePositionAt(lvl, z);
      const p = projectGround(rp.x, z, Game.camera.x, Game.camera.z, Game.camera.yaw);
      if (p && p.depth > 18 && p.depth < 600 && p.y >= HORIZON_Y - 5 && p.y <= H + 20) {
        pts.push(p);
      }
    }
    if (pts.length < 2) return;
    const halfW = 6.5;
    const left = [], right = [];
    for (const p of pts) {
      const w = Math.min(halfW * p.scale, 95);
      left.push({ x: p.x - w, y: p.y });
      right.push({ x: p.x + w, y: p.y });
    }
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
    cg.addColorStop(0, 'rgba(150,180,100,0.10)');
    cg.addColorStop(1, 'rgba(165,195,110,0.30)');
    ctx.fillStyle = cg;
    ctx.fill();
  }

  // ---- Scenery scattered across the open field ----
  Renderer.drawTrees = function (ctx) {
    const items = [];
    // Trees
    for (let i = 0; i < 70; i++) {
      const col = i % 7;
      const row = Math.floor(i / 7);
      const baseX = (col - 3) * 34 + ((i * 17.3) % 11) - 5; // -113..113 lateral
      const baseZ = 70 + row * 80 + ((i * 13.7) % 40);
      items.push({ kind: 'tree', x: baseX, z: baseZ, seed: i });
    }
    // Bushes
    for (let i = 0; i < 50; i++) {
      const baseX = ((i * 23.7) % 280) - 140;
      const baseZ = 50 + ((i * 37.1) % 760);
      items.push({ kind: 'bush', x: baseX, z: baseZ, seed: i });
    }
    // Rocks
    for (let i = 0; i < 30; i++) {
      const baseX = ((i * 41.3) % 260) - 130;
      const baseZ = 60 + ((i * 53.9) % 740);
      items.push({ kind: 'rock', x: baseX, z: baseZ, seed: i });
    }
    items.sort((a, b) => b.z - a.z); // far first

    for (const t of items) {
      // Keep the mown course line clear of bushes/rocks
      if (t.kind !== 'tree') {
        const rp = getRoutePositionAt(LEVELS[Game.levelIndex], t.z);
        if (Math.abs(t.x - rp.x) < 5) continue;
      }
      const screen = projectGround(t.x, t.z, Game.camera.x, Game.camera.z, Game.camera.yaw);
      if (!screen || screen.y < HORIZON_Y - 5 || screen.y > H) continue;
      const sc = screen.scale;
      const distFactor = clamp(1 - sc * 3.5, 0.35, 1);

      if (t.kind === 'tree') {
        const size = 22 * sc;
        if (size < 4) continue;
        ctx.fillStyle = '#3a2010';
        ctx.fillRect(screen.x - 1.6 * sc, screen.y - size * 0.4, 3.2 * sc, size * 0.4);
        const fy = screen.y - size * 0.4;
        const fh = size * 0.95;
        const fw = size * 0.72;
        const r = Math.floor(48 * distFactor + 18);
        const g = Math.floor(82 * distFactor + 28);
        const b = Math.floor(30 * distFactor + 8);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.ellipse(screen.x, fy, fw / 2, fh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(200,220,150,${0.18 * distFactor})`;
        ctx.beginPath();
        ctx.ellipse(screen.x - fw * 0.15, fy - fh * 0.15, fw * 0.2, fh * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.kind === 'bush') {
        const size = 11 * sc;
        if (size < 3) continue;
        ctx.fillStyle = `rgb(${Math.floor(40 * distFactor + 15)},${Math.floor(70 * distFactor + 20)},${Math.floor(28 * distFactor + 8)})`;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y - size * 0.3, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const size = 13 * sc;
        if (size < 3) continue;
        ctx.fillStyle = `rgb(${Math.floor(110 * distFactor + 40)},${Math.floor(105 * distFactor + 38)},${Math.floor(95 * distFactor + 32)})`;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y - size * 0.22, size * 0.55, size * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(screen.x - size * 0.12, screen.y - size * 0.3, size * 0.2, size * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  // ---- Perimeter post-and-rail fences (ETG-style paddock boundary) ----
  Renderer.drawFences = function (ctx, lvl) {
    if (!lvl.fences) return;
    drawRailFence(ctx, -FENCE_X);
    drawRailFence(ctx, FENCE_X);
  };

  function drawRailFence(ctx, worldX) {
    const startZ = Game.camera.z - 8;
    const endZ = Game.camera.z + 600;
    const step = 6;
    const posts = [];
    for (let z = startZ; z <= endZ; z += step) {
      const p = projectGround(worldX, z, Game.camera.x, Game.camera.z, Game.camera.yaw);
      if (p && p.depth > 8 && p.y <= H + 12) posts.push(p);
    }
    if (posts.length < 2) return;
    // Rails (two horizontal lines)
    ctx.strokeStyle = 'rgba(226,210,168,0.9)';
    ctx.lineWidth = Math.max(1, 2.0 * posts[0].scale);
    for (const railFrac of [0.35, 0.7]) {
      ctx.beginPath();
      for (let i = 0; i < posts.length; i++) {
        const p = posts[i];
        const ph = 28 * p.scale;
        const ry = p.y - ph * railFrac;
        if (i === 0) ctx.moveTo(p.x, ry);
        else ctx.lineTo(p.x, ry);
      }
      ctx.stroke();
    }
    // Posts
    ctx.fillStyle = '#d8c8a0';
    for (const p of posts) {
      const ph = 28 * p.scale;
      const pw = Math.max(1.5, 3 * p.scale);
      if (ph < 2) continue;
      ctx.fillRect(p.x - pw / 2, p.y - ph, pw, ph);
    }
  }

  // ---- Obstacles (show jumps) ----
  // Z-sorted rendering: far obstacles behind horse, near obstacles in front.
  // Threshold in world-Z units ahead of camera. Fences closer than this are
  // drawn AFTER the horse so they appear in front.
  var HORSE_FRONT_THRESHOLD = 16;

  Renderer.drawObstaclesBehind = function (ctx) {
    const camZ = Game.camera.z;
    const list = Game.obstacles.filter(o => {
      if (o.passed && !o.hit) return false;
      return (o.worldZ - camZ) > HORSE_FRONT_THRESHOLD;
    });
    list.sort((a, b) => b.worldZ - a.worldZ);
    for (const ob of list) { drawObstacle(ctx, ob); }
  };

  Renderer.drawObstaclesInFront = function (ctx) {
    const camZ = Game.camera.z;
    const list = Game.obstacles.filter(o => {
      if (o.passed && !o.hit) return false;
      return (o.worldZ - camZ) <= HORSE_FRONT_THRESHOLD;
    });
    list.sort((a, b) => b.worldZ - a.worldZ);
    for (const ob of list) { drawObstacle(ctx, ob); }
  };

  // Legacy single-pass (used only for non-playing states)
  Renderer.drawObstacles = function (ctx) {
    const list = Game.obstacles.filter(o => !o.passed || o.hit);
    list.sort((a, b) => b.worldZ - a.worldZ);
    for (const ob of list) { drawObstacle(ctx, ob); }
  };

  function drawObstacle(ctx, ob) {
    const camX = Game.camera.x;
    const camZ = Game.camera.z;
    const dz = ob.worldZ - camZ;
    if (dz < -5 || dz > 120) return;

    if (ob.type === 'vertical') {
      drawVertical(ctx, ob);
    } else if (ob.type === 'oxer') {
      drawOxer(ctx, ob);
    } else if (ob.type === 'wall') {
      drawWall(ctx, ob);
    }
  }

  function getObstacleScreen(ob) {
    const p = projectGround(ob.worldX, ob.worldZ, Game.camera.x, Game.camera.z, Game.camera.yaw);
    return p;
  }

  function drawVertical(ctx, ob) {
    const p = getObstacleScreen(ob);
    if (!p) return;
    const sc = p.scale;
    if (sc < 0.05) return;

    const baseY = p.y;
    // Real-life proportions: a show jump's top rail sits around the horse's
    // withers, never twice the horse's height. ob.height is in ~metres.
    const postH = ob.height * 1.25 * sc;
    const postW = 0.17 * sc;
    const barW = 2.3 * sc;
    const barH = 0.16 * sc;
    const barY = baseY - postH + barH * 0.6; // top rail at the top of the poles

    // Left post
    ctx.fillStyle = '#f5f0e0';
    ctx.fillRect(p.x - barW / 2 - postW, baseY - postH, postW, postH);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(p.x - barW / 2 - 0.5, baseY - postH, 0.5, postH);
    // Right post
    ctx.fillStyle = '#f5f0e0';
    ctx.fillRect(p.x + barW / 2, baseY - postH, postW, postH);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(p.x + barW / 2 + postW - 0.5, baseY - postH, 0.5, postH);
    // Caps
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(p.x - barW / 2 - postW - 0.03 * sc, baseY - postH - 0.05 * sc, postW + 0.06 * sc, 0.05 * sc);
    ctx.fillRect(p.x + barW / 2 - 0.03 * sc, baseY - postH - 0.05 * sc, postW + 0.06 * sc, 0.05 * sc);

    // Bar (striped - typical show jump)
    const bar = ob.bars[0];
    const dropY = bar.dropped ? ob.hitProgress * 0.6 * sc : 0;
    const barRot = bar.dropped ? ob.hitProgress * 1.2 : 0;
    ctx.save();
    ctx.translate(p.x, barY + dropY);
    ctx.rotate(barRot);

    // Striped bar
    const stripes = 6;
    const sw = barW / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d33a3a' : '#f5f0e0';
      ctx.fillRect(-barW / 2 + i * sw, -barH / 2, sw, barH);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-barW / 2, barH / 2 - 0.04 * sc, barW, 0.04 * sc);
    ctx.restore();

    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, baseY - 2, barW / 2.4, 0.45 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawOxer(ctx, ob) {
    const p = getObstacleScreen(ob);
    if (!p) return;
    const sc = p.scale;
    if (sc < 0.05) return;

    const baseY = p.y;
    const postH = ob.height * 1.35 * sc;
    const postW = 0.16 * sc;
    const spacing = 1.25 * sc;
    const barH = 0.15 * sc;
    const barY = baseY - postH + barH * 0.6;

    // Two pairs of posts
    for (let side = 0; side < 2; side++) {
      const offsetX = (side === 0 ? -1 : 1) * spacing;
      ctx.fillStyle = '#f5f0e0';
      ctx.fillRect(p.x + offsetX - postW, baseY - postH, postW, postH);
      ctx.fillRect(p.x + offsetX, baseY - postH, postW, postH);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(p.x + offsetX - 0.4, baseY - postH, 0.4, postH);
      ctx.fillRect(p.x + offsetX + postW - 0.4, baseY - postH, 0.4, postH);
    }

    // Two bars (one per side)
    for (let i = 0; i < 2; i++) {
      const bar = ob.bars[i];
      const side = i === 0 ? -1 : 1;
      const xOff = side * spacing;
      const dropY = bar.dropped ? ob.hitProgress * 0.6 * sc : 0;
      const barRot = bar.dropped ? ob.hitProgress * 1.0 : 0;
      // An oxer has a front rail (lower) and a back rail (higher)
      const railLift = i === 1 ? postH * 0.34 : 0;
      ctx.save();
      ctx.translate(p.x + xOff, barY - railLift + dropY);
      ctx.rotate(barRot);
      const bw = 1.2 * sc;
      const stripes = 5;
      const sw = bw / stripes;
      for (let s = 0; s < stripes; s++) {
        ctx.fillStyle = s % 2 === 0 ? '#2a6ab8' : '#f5f0e0';
        ctx.fillRect(-bw / 2 + s * sw, -barH / 2, sw, barH);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(-bw / 2, barH / 2 - 0.04 * sc, bw, 0.04 * sc);
      ctx.restore();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, baseY - 2, spacing * 1.5, 0.5 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWall(ctx, ob) {
    const p = getObstacleScreen(ob);
    if (!p) return;
    const sc = p.scale;
    if (sc < 0.05) return;

    const baseY = p.y;
    const wallH = ob.height * 1.5 * sc; // a wall stands a little taller than a rail
    const wallW = 2.3 * sc;

    // Wall body - brick pattern
    const grad = ctx.createLinearGradient(0, baseY - wallH, 0, baseY);
    grad.addColorStop(0, '#a07050');
    grad.addColorStop(1, '#6a4830');
    ctx.fillStyle = grad;
    ctx.fillRect(p.x - wallW / 2, baseY - wallH, wallW, wallH);

    // Brick lines
    ctx.strokeStyle = 'rgba(50,30,15,0.5)';
    ctx.lineWidth = 1;
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const y = baseY - wallH + (r + 1) * wallH / rows;
      ctx.beginPath();
      ctx.moveTo(p.x - wallW / 2, y);
      ctx.lineTo(p.x + wallW / 2, y);
      ctx.stroke();
      const cols = 6;
      const offset = r % 2 === 0 ? 0 : wallW / cols / 2;
      for (let c = 0; c <= cols; c++) {
        const x = p.x - wallW / 2 + c * wallW / cols + offset;
        if (x > p.x - wallW / 2 && x < p.x + wallW / 2) {
          ctx.beginPath();
          ctx.moveTo(x, y - wallH / rows);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    }

    // Top edge
    ctx.fillStyle = '#4a3018';
    ctx.fillRect(p.x - wallW / 2, baseY - wallH, wallW, 6);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, baseY - 2, wallW / 2, 0.5 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Destination flag ----
  Renderer.drawDestination = function (ctx, lvl) {
    const last = lvl.route[lvl.route.length - 1];
    const p = projectGround(last.x, last.z, Game.camera.x, Game.camera.z, Game.camera.yaw);
    if (!p) return;
    const sc = p.scale;
    if (sc < 0.1) return;
    const baseY = p.y;
    const poleH = 2.5 * sc * 1.4;
    const poleW = 0.12 * sc * 1.4;

    // Pole
    ctx.fillStyle = '#f5f0e0';
    ctx.fillRect(p.x - poleW / 2, baseY - poleH, poleW, poleH);
    // Flag
    const flagW = 0.9 * sc * 1.4;
    const flagH = 0.6 * sc * 1.4;
    const wave = Math.sin(performance.now() * 0.003) * 0.05;
    ctx.fillStyle = '#c83a3a';
    ctx.beginPath();
    ctx.moveTo(p.x, baseY - poleH);
    ctx.lineTo(p.x + flagW, baseY - poleH + flagH * 0.3 + wave * flagH);
    ctx.lineTo(p.x, baseY - poleH + flagH);
    ctx.closePath();
    ctx.fill();
    // Checker pattern hint
    ctx.fillStyle = '#f5f0e0';
    ctx.fillRect(p.x + flagW * 0.4, baseY - poleH + flagH * 0.3 + wave * flagH * 0.5, flagW * 0.2, flagH * 0.2);
  };

  // ---- Trail dust (behind horse) ----
  Renderer.drawTrailDust = function (ctx) {
    for (const d of Game.trailDust) {
      const p = projectGround(d.x, d.z, Game.camera.x, Game.camera.z, Game.camera.yaw);
      if (!p) continue;
      const alpha = clamp(d.life / 0.8, 0, 1) * 0.4;
      ctx.fillStyle = `rgba(220,210,180,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ---- Horse and rider ----
  // ---- Horse drawn from BEHIND (default view): faces AWAY, head-on to fences ----
  function drawHorseBehind(ctx, lvl) {
    const cx = W / 2;
    const jumpHeight = Game.horseJump > 0 ? Math.sin(Game.horseJump * Math.PI) * 90 : 0;
    const baseY = HORSE_BASE_Y - jumpHeight;
    const speed = Game.speed;
    const tempo = Math.max(0.2, speed / 12);
    const emotion = Game.horseEmotion;
    const emotionCat = emotionCategory(emotion);
    const baseColor = lvl.horse.color;
    const darkColor = shadeColor(baseColor, -0.35);
    const lightColor = shadeColor(baseColor, 0.18);
    const saddleColor = lvl.horse.saddleColor;
    const maneColor = (lvl.horse.temper === 'spirited') ? '#000' : '#1a0d05';
    const t = performance.now() * 0.012 * tempo;

    // ground shadow
    ctx.save();
    ctx.translate(cx, HORSE_BASE_Y + 4);
    ctx.scale(1, 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, 54, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, baseY);
    const bob = Math.sin(t) * (speed > 2 ? 2 : 0);
    ctx.translate(0, bob);

    // legs (behind the body)
    drawBehindLeg(ctx, -22, t, darkColor, -18);
    drawBehindLeg(ctx, 22, t + Math.PI, darkColor, -18);
    drawBehindLeg(ctx, -16, t + 1.0, darkColor, -66);
    drawBehindLeg(ctx, 16, t + 1.5, darkColor, -66);

    // tail
    const tailWag = Math.sin(performance.now() * 0.004) * 0.2;
    ctx.save();
    ctx.translate(0, -6);
    ctx.rotate(tailWag);
    ctx.fillStyle = maneColor;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.quadraticCurveTo(-16, 16, -14, 40);
    ctx.quadraticCurveTo(-6, 34, 0, 30);
    ctx.quadraticCurveTo(6, 34, 14, 40);
    ctx.quadraticCurveTo(16, 16, 7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // body (rump + barrel seen from behind — athletic, not round)
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.ellipse(0, -44, 44, 48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lightColor;
    ctx.beginPath(); ctx.ellipse(0, -60, 33, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = darkColor;
    ctx.beginPath(); ctx.ellipse(0, -20, 34, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.ellipse(0, -32, 30, 27, 0, 0, Math.PI * 2); ctx.fill();

    // back rises to withers
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(-22, -90);
    ctx.quadraticCurveTo(0, -104, 22, -90);
    ctx.lineTo(14, -78);
    ctx.quadraticCurveTo(0, -88, -14, -78);
    ctx.closePath();
    ctx.fill();

    // neck
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(-15, -88);
    ctx.quadraticCurveTo(-12, -120, 0, -150);
    ctx.quadraticCurveTo(12, -120, 15, -88);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(-15, -88);
    ctx.quadraticCurveTo(-13, -120, 0, -150);
    ctx.quadraticCurveTo(-4, -120, -6, -88);
    ctx.closePath();
    ctx.fill();

    // mane down the centre of the neck
    ctx.fillStyle = maneColor;
    ctx.beginPath();
    ctx.moveTo(-7, -86);
    ctx.quadraticCurveTo(-3, -120, 0, -150);
    ctx.quadraticCurveTo(3, -120, 7, -86);
    ctx.quadraticCurveTo(0, -80, -7, -86);
    ctx.closePath();
    ctx.fill();

    // head
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.ellipse(0, -158, 17, 21, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lightColor;
    ctx.beginPath(); ctx.ellipse(0, -178, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.moveTo(-9, -172); ctx.lineTo(-5, -188); ctx.lineTo(-1, -174); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(9, -172); ctx.lineTo(5, -188); ctx.lineTo(1, -174); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e0a890';
    ctx.beginPath(); ctx.moveTo(-7, -176); ctx.lineTo(-5, -186); ctx.lineTo(-3, -176); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(7, -176); ctx.lineTo(5, -186); ctx.lineTo(3, -176); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-13, -156, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13, -156, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0d05';
    ctx.beginPath(); ctx.arc(-3, -182, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -182, 1.2, 0, Math.PI * 2); ctx.fill();

    // saddle
    ctx.fillStyle = saddleColor;
    ctx.beginPath(); ctx.ellipse(0, -52, 22, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shadeColor(saddleColor, 0.3);
    ctx.beginPath(); ctx.ellipse(0, -56, 13, 6, 0, 0, Math.PI * 2); ctx.fill();

    // rider seen from behind
    drawRiderFromBehind(ctx, emotionCat);

    // emotion aura
    const aura = EMOTION_LABEL[emotionCat].color;
    if (emotionCat === 'happy' || emotionCat === 'neutral') {
      ctx.strokeStyle = aura + '55';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -45, 52, 56, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (emotionCat === 'tired') {
      ctx.fillStyle = 'rgba(80,150,200,0.6)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(-26 + i * 26, -64 + Math.sin(performance.now() * 0.003 + i) * 2, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#e0524a';
      ctx.beginPath(); ctx.arc(-13, -156, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(13, -156, 2.6, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  function drawBehindLeg(ctx, xOff, phase, dark, topY) {
    const swing = Math.sin(phase) * 4;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(xOff, topY);
    ctx.quadraticCurveTo(xOff + swing * 0.5, topY / 2, xOff + swing, 0);
    ctx.stroke();
    ctx.fillStyle = '#1a0d05';
    ctx.beginPath(); ctx.ellipse(xOff + swing, 0, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawRiderFromBehind(ctx, emotionCat) {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-14, -78);
    ctx.quadraticCurveTo(0, -90, 14, -78);
    ctx.lineTo(11, -50);
    ctx.lineTo(-11, -50);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(0, -92, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath(); ctx.arc(0, -95, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-11, -74);
    ctx.quadraticCurveTo(-18, -100, -4, -126);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(11, -74);
    ctx.quadraticCurveTo(18, -100, 4, -126);
    ctx.stroke();
  }

  // ---- Horse drawn from ABOVE (Top-down view) ----
  function drawHorseTop(ctx, lvl) {
    const cx = W / 2;
    const jumpHeight = Game.horseJump > 0 ? Math.sin(Game.horseJump * Math.PI) * 90 : 0;
    const baseY = HORSE_BASE_Y - jumpHeight;
    const speed = Game.speed;
    const tempo = Math.max(0.2, speed / 12);
    const emotion = Game.horseEmotion;
    const emotionCat = emotionCategory(emotion);
    const baseColor = lvl.horse.color;
    const darkColor = shadeColor(baseColor, -0.35);
    const lightColor = shadeColor(baseColor, 0.18);
    const saddleColor = lvl.horse.saddleColor;
    const maneColor = (lvl.horse.temper === 'spirited') ? '#000' : '#1a0d05';

    ctx.save();
    ctx.translate(cx, HORSE_BASE_Y + 4);
    ctx.scale(1, 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 0, 50, 60, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, baseY);

    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.ellipse(0, -30, 40, 64, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lightColor;
    ctx.beginPath(); ctx.ellipse(0, -30, 14, 56, 0, 0, Math.PI * 2); ctx.fill();

    drawTopLeg(ctx, -20, 40, darkColor);
    drawTopLeg(ctx, 20, 40, darkColor);
    drawTopLeg(ctx, -20, -82, darkColor);
    drawTopLeg(ctx, 20, -82, darkColor);

    ctx.fillStyle = saddleColor;
    ctx.beginPath(); ctx.ellipse(0, -28, 18, 22, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(-15, -80);
    ctx.quadraticCurveTo(-10, -112, 0, -122);
    ctx.quadraticCurveTo(10, -112, 15, -80);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -130, 13, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -142); ctx.lineTo(-4, -156); ctx.lineTo(0, -145); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -142); ctx.lineTo(4, -156); ctx.lineTo(0, -145); ctx.closePath(); ctx.fill();
    ctx.fillStyle = maneColor;
    ctx.beginPath(); ctx.moveTo(-2, -82); ctx.quadraticCurveTo(-8, -112, -2, -122); ctx.quadraticCurveTo(4, -112, 2, -82); ctx.closePath(); ctx.fill();
    ctx.fillStyle = maneColor;
    ctx.beginPath(); ctx.moveTo(-6, 30); ctx.quadraticCurveTo(0, 52, 6, 30); ctx.quadraticCurveTo(0, 44, -6, 30); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(0, -28, 11, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.arc(0, -34, 7, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function drawTopLeg(ctx, x, y, dark) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x * 0.35, y * 0.5);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
  }

  Renderer.drawHorseAndRider = function (ctx, lvl) {
    // Camera view modes (press V to cycle): Behind (default), Top-down, Side.
    const _v = VIEWS[currentView].horse;
    if (_v === 'behind') { drawHorseBehind(ctx, lvl); return; }
    if (_v === 'top') { drawHorseTop(ctx, lvl); return; }
    // Fall-through: the detailed 3/4 'side' horse (existing art).
    const cx = W / 2;
    // Position the horse at a point that looks "in front of" the camera on the ground
    // Slightly above where the ground projects to at the camera
    const cy = HORSE_BASE_Y;
    const jumpHeight = Game.horseJump > 0 ? Math.sin(Game.horseJump * Math.PI) * 90 : 0;
    const cy2 = cy - jumpHeight;
    const yaw = Game.horseYaw;
    const speed = Game.speed;
    const tempo = Math.max(0.2, speed / 12);

    // Horse shadow on ground (athletic oval, proportional)
    ctx.save();
    ctx.translate(cx, cy + 24);
    ctx.scale(1, 0.25);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 95, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy2);
    // Yaw rotation
    ctx.rotate(yaw);
    // Subtle bob
    const bob = Math.sin(performance.now() * 0.012 * tempo) * (speed > 2 ? 1.5 : 0);
    ctx.translate(0, bob);

    const emotion = Game.horseEmotion;
    const emotionCat = emotionCategory(emotion);
    const baseColor = lvl.horse.color;
    const darkColor = shadeColor(baseColor, -0.30);
    const lightColor = shadeColor(baseColor, 0.16);
    const saddleColor = lvl.horse.saddleColor;
    const maneColor = (lvl.horse.temper === 'spirited') ? '#000' : '#1a0d05';

    // Legs (back ones first, then front) — slightly taller, more refined
    const t = performance.now() * 0.012 * tempo;
    drawLeg(ctx, -40, -10, 108, t, tempo, baseColor, darkColor); // back-left
    drawLeg(ctx, -40, 10, 108, t + 0.5, tempo, baseColor, darkColor); // back-right
    drawLeg(ctx, 38, -10, 108, t + 1.0, tempo, baseColor, darkColor); // front-left
    drawLeg(ctx, 38, 10, 108, t + 1.5, tempo, baseColor, darkColor); // front-right

    // Body — athletic riding-horse build: deeper through the heart,
    // shorter back, well-defined withers. Less barrel-like than a draft.
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    // Withers peak (front-top)
    ctx.moveTo(52, -42);
    // Back line — shorter back, gentle slope to croup
    ctx.quadraticCurveTo(8, -54, -48, -44);
    // Croup (rump) curve down
    ctx.quadraticCurveTo(-80, -32, -92, -16);
    // Hindquarter/gaskin drop
    ctx.quadraticCurveTo(-86, 4, -64, 16);
    // Belly — tucked up (athletic, not pot-bellied)
    ctx.quadraticCurveTo(-20, 28, 28, 20);
    // Chest / brisket rise
    ctx.quadraticCurveTo(54, 10, 58, -8);
    // Withers front close
    ctx.quadraticCurveTo(62, -26, 52, -42);
    ctx.closePath();
    ctx.fill();

    // Underside shadow (softer, smaller area)
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(56, -6);
    ctx.quadraticCurveTo(32, 14, 0, 18);
    ctx.quadraticCurveTo(-40, 22, -72, 10);
    ctx.quadraticCurveTo(-62, 24, -26, 28);
    ctx.quadraticCurveTo(18, 30, 50, 14);
    ctx.quadraticCurveTo(58, 6, 56, -6);
    ctx.closePath();
    ctx.fill();

    // Top-line highlight (smooth muscular back)
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.moveTo(44, -42);
    ctx.quadraticCurveTo(0, -52, -56, -42);
    ctx.quadraticCurveTo(-26, -50, 8, -48);
    ctx.quadraticCurveTo(34, -46, 44, -42);
    ctx.closePath();
    ctx.fill();

    // Shoulder muscle definition
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.moveTo(52, -42);
    ctx.quadraticCurveTo(68, -32, 70, -10);
    ctx.quadraticCurveTo(68, 10, 52, 16);
    ctx.quadraticCurveTo(46, -2, 48, -26);
    ctx.closePath();
    ctx.fill();

    // Hindquarter definition
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.moveTo(-50, -44);
    ctx.quadraticCurveTo(-82, -36, -92, -16);
    ctx.quadraticCurveTo(-88, 4, -68, 16);
    ctx.quadraticCurveTo(-54, -4, -50, -44);
    ctx.closePath();
    ctx.fill();

    // Saddle blanket
    ctx.fillStyle = '#1a2434';
    ctx.beginPath();
    ctx.ellipse(0, -42, 38, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Saddle
    ctx.fillStyle = saddleColor;
    ctx.beginPath();
    ctx.moveTo(-22, -48);
    ctx.quadraticCurveTo(0, -60, 22, -48);
    ctx.quadraticCurveTo(24, -42, 20, -38);
    ctx.lineTo(-20, -38);
    ctx.quadraticCurveTo(-24, -42, -22, -48);
    ctx.fill();
    ctx.fillStyle = shadeColor(saddleColor, 0.3);
    ctx.beginPath();
    ctx.ellipse(0, -52, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rider
    drawRider(ctx, 0, -68, emotionCat, speed);

    // Neck — elegant arch from withers to poll, thicker at base
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(52, -42);
    // Top of neck crest (slight arch)
    ctx.quadraticCurveTo(78, -64, 106, -86);
    // Throatlatch / jaw curve under
    ctx.quadraticCurveTo(118, -72, 114, -52);
    // Bottom of neck into chest
    ctx.quadraticCurveTo(92, -34, 70, -22);
    ctx.closePath();
    ctx.fill();
    // Neck underside shading
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(58, -28);
    ctx.quadraticCurveTo(84, -44, 108, -78);
    ctx.quadraticCurveTo(114, -66, 110, -56);
    ctx.quadraticCurveTo(92, -36, 66, -18);
    ctx.closePath();
    ctx.fill();

    // Head — refined riding-horse head: slightly longer face,
    // well-defined jaw, intelligent eye placement
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.ellipse(120, -94, 18, 12, -0.35, 0, Math.PI * 2);
    ctx.fill();
    // Muzzle — lighter area (common in chestnuts/bays)
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.ellipse(137, -90, 6.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye — large, dark, expressive (key to "realistic" feel)
    ctx.fillStyle='#1a0d05';
    ctx.beginPath();
    ctx.arc(126, -100, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Eye highlight (gives life)
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(126.6, -100.6, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Nostril
    ctx.fillStyle = '#1a0d05';
    ctx.beginPath();
    ctx.arc(140, -89, 1, 0, Math.PI * 2);
    ctx.fill();
    // Ear — alert, pointed
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(114, -102);
    ctx.lineTo(111, -116);
    ctx.lineTo(119, -105);
    ctx.closePath();
    ctx.fill();
    // Inner ear (pinkish)
    ctx.fillStyle = '#e0a890';
    ctx.beginPath();
    ctx.moveTo(115, -105);
    ctx.lineTo(113, -113);
    ctx.lineTo(117, -106);
    ctx.closePath();
    ctx.fill();
    // Forelock
    ctx.fillStyle = maneColor;
    ctx.beginPath();
    ctx.ellipse(115, -98, 5, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Mane
    ctx.fillStyle = maneColor;
    ctx.beginPath();
    ctx.moveTo(58, -38);
    ctx.quadraticCurveTo(70, -52, 92, -64);
    ctx.quadraticCurveTo(100, -58, 110, -70);
    ctx.quadraticCurveTo(115, -75, 118, -80);
    ctx.lineTo(118, -64);
    ctx.quadraticCurveTo(100, -52, 88, -28);
    ctx.closePath();
    ctx.fill();

    // Mane strands blowing
    const wind = speed * 0.03;
    ctx.strokeStyle = maneColor;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) {
      const phase = i * 0.7 + performance.now() * 0.005;
      const sx = 92 + i * 4;
      const sy = -64 - i * 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx - 12 - wind * 6, sy + 6 + Math.sin(phase) * 3, sx - 24 - wind * 12, sy + 14);
      ctx.stroke();
    }

    // Tail
    const tailWag = Math.sin(performance.now() * 0.004) * 0.15;
    ctx.save();
    ctx.translate(-92, -10);
    ctx.rotate(tailWag);
    ctx.fillStyle = maneColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-18, 18, -30, 42 + wind * 4);
    ctx.quadraticCurveTo(-18, 36, -10, 30);
    ctx.quadraticCurveTo(-2, 14, 0, 0);
    ctx.closePath();
    ctx.fill();
    // Tail strands
    ctx.strokeStyle = maneColor;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-2, 6 + i * 6);
      ctx.quadraticCurveTo(-14 - wind * 4, 22 + i * 5, -26 - wind * 8, 38 + i * 5);
      ctx.stroke();
    }
    ctx.restore();

    // Emotion aura
    const emotionCol = EMOTION_LABEL[emotionCat].color;
    if (emotionCat === 'happy' || emotionCat === 'neutral') {
      ctx.strokeStyle = emotionCol + '60';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -12, 105, 60, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (emotionCat === 'tired') {
      // Sweat drops
      ctx.fillStyle = 'rgba(80,150,200,0.6)';
      for (let i = 0; i < 3; i++) {
        const sx = -30 + i * 30;
        const sy = -22 - i * 2 + Math.sin(performance.now() * 0.003 + i) * 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Angry - red eyes / ears back
      ctx.fillStyle = '#e0524a';
      ctx.beginPath();
      ctx.arc(128, -94, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  function drawRider(ctx, x, y, emotionCat, speed) {
    // Body torso
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.quadraticCurveTo(x, y - 8, x + 16, y);
    ctx.lineTo(x + 12, y + 28);
    ctx.lineTo(x - 12, y + 28);
    ctx.closePath();
    ctx.fill();
    // Breeches
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x - 14, y + 25, 28, 20);
    // Boots
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(x - 16, y + 43, 9, 16);
    ctx.fillRect(x + 7, y + 43, 9, 16);
    // Jacket highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.quadraticCurveTo(x, y - 8, x + 16, y);
    ctx.lineTo(x + 5, y + 5);
    ctx.lineTo(x - 5, y + 5);
    ctx.closePath();
    ctx.fill();
    // Arm (reaching to reins)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 3);
    ctx.quadraticCurveTo(x + 32, y + 2, x + 55, y - 18);
    ctx.lineTo(x + 53, y - 14);
    ctx.quadraticCurveTo(x + 30, y + 8, x + 5, y + 5);
    ctx.closePath();
    ctx.fill();
    // Other arm
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 3);
    ctx.quadraticCurveTo(x + 0, y + 5, x + 14, y - 5);
    ctx.lineTo(x + 12, y);
    ctx.quadraticCurveTo(x + 0, y + 14, x - 10, y + 5);
    ctx.closePath();
    ctx.fill();
    // Reins to horse head (head is at 122, -92)
    ctx.strokeStyle = '#1a0d05';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 55, y - 18);
    ctx.quadraticCurveTo(x + 90, y - 95, 122, -92);
    ctx.stroke();
    // Head / Helmet
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 20, 13, 15, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Helmet highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(x - 8, y - 25, 5, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Face
    ctx.fillStyle = '#d8a888';
    ctx.beginPath();
    ctx.ellipse(x, y - 14, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Visor
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y - 15, 4.5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Crop / whip in hand
    if (emotionCat !== 'happy') {
      ctx.strokeStyle = '#3a2010';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 10, y - 3);
      ctx.lineTo(x + 40, y - 28);
      ctx.stroke();
    }
  }

  function drawLeg(ctx, xOff, yOff, len, t, tempo, baseColor, darkColor) {
    const swing = tempo * 0.4;
    const phase = t;
    const sw = Math.sin(phase) * swing;
    const lift = Math.max(0, Math.sin(phase)) * tempo * 8;

    ctx.save();
    ctx.translate(xOff, yOff);
    ctx.rotate(sw);

    // Upper leg
    ctx.fillStyle = darkColor;
    ctx.fillRect(-5, 0, 10, len * 0.5);
    ctx.fillStyle = baseColor;
    ctx.fillRect(-4, 0, 7, len * 0.5);

    // Lower leg
    ctx.save();
    ctx.translate(0, len * 0.5);
    const knee = Math.sin(phase + 0.5) * 0.3;
    ctx.rotate(knee - lift * 0.01);

    ctx.fillStyle = baseColor;
    ctx.fillRect(-3, 0, 6, len * 0.4);
    // Hoof
    ctx.fillStyle = '#1a0d05';
    ctx.beginPath();
    ctx.ellipse(0, len * 0.42, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // ---- HUD ----
  Renderer.drawHUD = function (ctx, lvl) {
    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, 70);

    // Time (left)
    ctx.font = 'bold 36px Georgia, serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (Game.timeLimit != null) {
      ctx.fillText('Time: ' + Game.time.toFixed(1) + 's', 30, 35);
    } else {
      ctx.fillText('Practice Run', 30, 35);
    }

    // Level title (center)
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px Georgia, serif';
    ctx.fillStyle = '#f3e5b8';
    ctx.fillText(lvl.name, W / 2, 35);

    // Speed (right) - displayed in km/h to match real-life horse gaits
    ctx.textAlign = 'right';
    ctx.font = 'bold 32px Georgia, serif';
    ctx.fillStyle = '#fff';
    const speedKmh = Game.speed.toFixed(0);
    ctx.fillText('Speed: ' + speedKmh + ' km/h', W - 30, 35);

    // Second row: emotion, jumps
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 70, W, 56);

    // Horse name and emotion
    ctx.font = '24px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f3e5b8';
    ctx.fillText(lvl.horse.name + ' - Mood: ' + EMOTION_LABEL[emotionCategory(Game.horseEmotion)].text, 30, 98);

    // Emotion bar
    const eX = 380, eY = 84, eW = 360, eH = 24;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(eX, eY, eW, eH);
    const eColor = EMOTION_LABEL[emotionCategory(Game.horseEmotion)].color;
    ctx.fillStyle = eColor;
    ctx.fillRect(eX, eY, eW * (Game.horseEmotion / 100), eH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(eX, eY, eW, eH);

    // Jumps counter
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText('Jumps: ' + Game.cleanJumps + '/' + Game.totalJumps + '   Bars: ' + Game.barsDropped, W - 30, 98);

    // Progress bar
    const last = lvl.route[lvl.route.length - 1];
    const progress = clamp(Game.camera.z / last.z, 0, 1);
    const pX = 30, pY = 140, pW = W - 60, pH = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(pX, pY, pW, pH);
    ctx.fillStyle = '#7bd389';
    ctx.fillRect(pX, pY, pW * progress, pH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(pX, pY, pW, pH);

    // Disobedience warning - the horse is not listening to your hands
    if (Game.obedience < 0.55) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.008);
      ctx.globalAlpha = 0.55 + 0.45 * pulse;
      ctx.font = 'bold 38px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff6a5a';
      ctx.fillText('!! YOUR HORSE IS NOT LISTENING !!', W / 2, 210);
      ctx.globalAlpha = 1;
    }

    // Start / end labels
    ctx.font = '18px Georgia, serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('Start', pX, pY + 32);
    ctx.textAlign = 'right';
    ctx.fillText('Finish', pX + pW, pY + 32);

    // Bottom: controls reminder
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, H - 70, W, 70);
    ctx.font = '22px Georgia, serif';
    ctx.fillStyle = '#f3e5b8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const cy = H - 35;
    ctx.fillText('W / Up: Speed Up', 40, cy);
    ctx.fillText('S / Down: Slow', 260, cy);
    ctx.fillText('A / D: Steer', 460, cy);
    ctx.fillText('Space: Jump', 640, cy);
    ctx.fillText('E: Soothe', 840, cy);
    ctx.fillText('F: Whip', 1020, cy);
    ctx.fillStyle = '#9fe0a0';
    ctx.fillText('V: View = ' + VIEWS[currentView].name, 1160, cy);
    ctx.textAlign = 'right';
    ctx.fillText('P: Pause    R: Restart', W - 30, cy);

    // ---- Feedback text ----
    for (const f of Game.feedback) {
      const alpha = clamp(f.life / 1.4, 0, 1);
      ctx.font = 'bold 42px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = f.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.fillText(f.text, f.x, f.y);
    }
  };

  // ---- Particles (jump dust, whip, etc.) ----
  Renderer.drawParticles = function (ctx) {
    for (const p of Game.particles) {
      const proj = projectGround(p.x, p.z, Game.camera.x, Game.camera.z, Game.camera.yaw);
      if (!proj) continue;
      const sc = proj.scale;
      const alpha = clamp(p.life, 0, 1);
      const sz = p.size * sc * 1.4 * (0.5 + alpha * 0.5);
      ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(proj.x, proj.y - p.vy * 0.3 * sc, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ---- Pause / Win / Lose overlay ----
  Renderer.drawOverlay = function (ctx, title, subtitle, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 96px Georgia, serif';
    ctx.fillStyle = color;
    ctx.fillText(title, W / 2, H / 2 - 80);

    ctx.font = '28px Georgia, serif';
    ctx.fillStyle = '#f3e5b8';
    const lines = subtitle.split('\n');
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, H / 2 + 20 + i * 38);
    }

    // Buttons
    const btnW = 280, btnH = 70;
    const btnY = H / 2 + 60 + lines.length * 38;
    // Restart
    drawButton(ctx, W / 2 - btnW - 20, btnY, btnW, btnH, 'Restart Level', '#7bd389');
    // Next / Menu
    const rightLabel = Game.state === 'won' && Game.levelIndex < LEVELS.length - 1 ? 'Next Level' : 'Back to Menu';
    drawButton(ctx, W / 2 + 20, btnY, btnW, btnH, rightLabel, '#7eb6e6');
  };

  function drawButton(ctx, x, y, w, h, label, color) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- Level intro overlay ----
  Renderer.drawLevelIntro = function (ctx, lvl) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 76px Georgia, serif';
    ctx.fillStyle = '#f3e5b8';
    ctx.fillText(lvl.name, W / 2, H / 2 - 180);

    ctx.font = 'italic 28px Georgia, serif';
    ctx.fillStyle = '#dcd0a8';
    ctx.fillText(lvl.desc, W / 2, H / 2 - 100, W * 0.8);

    ctx.font = '32px Georgia, serif';
    ctx.fillStyle = '#fff';
    const lines = [
      'Horse: ' + lvl.horse.name + ' (' + lvl.horse.temper + ')',
      'Time limit: ' + (lvl.timeLimit ? lvl.timeLimit + 's' : 'none - take your time'),
      'Obstacles: ' + lvl.obstacles.length
    ];
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, H / 2 - 10 + i * 44);
    }

    ctx.font = 'italic 26px Georgia, serif';
    ctx.fillStyle = '#ffb3a0';
    ctx.fillText('Keep your horse calm - a frightened or angry horse will ignore your steering and refuse to jump.',
      W / 2, H / 2 + 150, W * 0.85);

    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillStyle = '#7bd389';
    ctx.fillText('Press SPACE or click to begin', W / 2, H / 2 + 180);
  };

  // ---- Game intro / story screen (shown first) ----
  Renderer.drawGameIntro = function (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1d2a18');
    grad.addColorStop(0.55, '#3e5a30');
    grad.addColorStop(1, '#233018');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Distant horse-and-rider silhouette
    ctx.save();
    ctx.translate(W / 2, 360);
    ctx.scale(2.0, 2.0);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    drawHorseSilhouette(ctx);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 92px Georgia, serif';
    ctx.fillStyle = '#f3e5b8';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.fillText('An Adventure on Horseback', W / 2, 150);
    ctx.shadowBlur = 0;

    ctx.font = 'italic 30px Georgia, serif';
    ctx.fillStyle = '#dcd0a8';
    ctx.fillText('Riding with Judgment, Riding with Trust', W / 2, 232);

    ctx.font = '25px Georgia, serif';
    ctx.fillStyle = '#e8e0c8';
    const premise = [
      'You are learning to ride. A horse is not a machine - it is a living, feeling',
      'creature that notices everything you do. Ride too fast, cut every corner, or',
      'reach for the whip, and the horse will stop trusting you and stop listening.',
      'Observe its mood, plan a clean line, and earn its cooperation instead.'
    ];
    for (let i = 0; i < premise.length; i++) {
      ctx.fillText(premise[i], W / 2, 452 + i * 36, W * 0.8);
    }

    // Three lessons
    const lessons = [
      ['Level 1', 'First Canter', 'Feel the horse, learn speed & take-off'],
      ['Level 2', 'Winding Path', 'Plan your route, manage your time'],
      ['Level 3', 'Trust the Bond', 'Soothe a spirited horse - or it will refuse']
    ];
    const cardW = 360, cardH = 120, gap = 36;
    const startX = (W - (cardW * 3 + gap * 2)) / 2;
    const cardY = 640;
    for (let i = 0; i < lessons.length; i++) {
      const x = startX + i * (cardW + gap);
      ctx.fillStyle = 'rgba(20,30,15,0.6)';
      roundRect(ctx, x, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.strokeStyle = '#a08868';
      ctx.lineWidth = 2;
      roundRect(ctx, x, cardY, cardW, cardH, 14);
      ctx.stroke();
      ctx.font = 'bold 26px Georgia, serif';
      ctx.fillStyle = '#f3e5b8';
      ctx.fillText(lessons[i][0], x + cardW / 2, cardY + 32);
      ctx.font = 'italic 22px Georgia, serif';
      ctx.fillStyle = '#dcd0a8';
      ctx.fillText(lessons[i][1], x + cardW / 2, cardY + 64);
      ctx.font = '17px Georgia, serif';
      ctx.fillStyle = '#bda878';
      ctx.fillText(lessons[i][2], x + cardW / 2, cardY + 94, cardW - 24);
    }

    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillStyle = '#7bd389';
    ctx.fillText('Press SPACE or click to begin', W / 2, 850);

    ctx.font = '20px Georgia, serif';
    ctx.fillStyle = '#bda878';
    ctx.fillText('W/S speed   A/D steer   Space jump   E soothe   F whip   V change view   P pause', W / 2, 912, W * 0.9);
  };

  // ---- Main menu ----
  Renderer.drawMainMenu = function (ctx) {
    // Background - simple gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2c3e2a');
    grad.addColorStop(0.5, '#5a7048');
    grad.addColorStop(1, '#3a4a2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Horse silhouette in distance
    ctx.save();
    ctx.translate(W / 2, H / 2 + 100);
    ctx.scale(2.2, 2.2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    drawHorseSilhouette(ctx);
    ctx.restore();

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 110px Georgia, serif';
    ctx.fillStyle = '#f3e5b8';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.fillText('An Adventure on Horseback', W / 2, 180);
    ctx.shadowBlur = 0;

    ctx.font = 'italic 32px Georgia, serif';
    ctx.fillStyle = '#dcd0a8';
    ctx.fillText('Riding with Judgment, Riding with Trust', W / 2, 270);

    // Author
    ctx.font = '24px Georgia, serif';
    ctx.fillStyle = '#bda878';
    ctx.fillText('A learning game by Ziqi Xu', W / 2, 320);

    // Level cards
    const cardW = 380, cardH = 320, gap = 40;
    const startX = (W - (cardW * 3 + gap * 2)) / 2;
    const cardY = 420;
    for (let i = 0; i < LEVELS.length; i++) {
      const lvl = LEVELS[i];
      const x = startX + i * (cardW + gap);
      // Card background
      ctx.fillStyle = 'rgba(20,30,15,0.7)';
      roundRect(ctx, x, cardY, cardW, cardH, 16);
      ctx.fill();
      // Border
      ctx.strokeStyle = '#a08868';
      ctx.lineWidth = 2;
      roundRect(ctx, x, cardY, cardW, cardH, 16);
      ctx.stroke();

      // Title
      ctx.font = 'bold 32px Georgia, serif';
      ctx.fillStyle = '#f3e5b8';
      ctx.textAlign = 'center';
      ctx.fillText('Level ' + lvl.id, x + cardW / 2, cardY + 50);

      // Name
      ctx.font = 'italic 24px Georgia, serif';
      ctx.fillStyle = '#dcd0a8';
      ctx.fillText(lvl.name.replace('Level ' + lvl.id + ' - ', ''), x + cardW / 2, cardY + 90);

      // Description
      ctx.font = '20px Georgia, serif';
      ctx.fillStyle = '#bda878';
      const words = lvl.desc.split(' ');
      let line = '';
      let ly = cardY + 140;
      for (const w of words) {
        if ((line + ' ' + w).length > 26) {
          ctx.fillText(line.trim(), x + cardW / 2, ly);
          line = w;
          ly += 26;
        } else {
          line += ' ' + w;
        }
      }
      if (line) ctx.fillText(line.trim(), x + cardW / 2, ly);

      // Stats
      ctx.font = '18px Georgia, serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('Horse: ' + lvl.horse.name, x + cardW / 2, cardY + 245);
      ctx.fillText('Time: ' + (lvl.timeLimit ? lvl.timeLimit + 's' : 'No limit'), x + cardW / 2, cardY + 268);
      ctx.fillText('Obstacles: ' + lvl.obstacles.length, x + cardW / 2, cardY + 291);
    }

    // Click instruction
    ctx.font = 'bold 28px Georgia, serif';
    ctx.fillStyle = '#7bd389';
    ctx.fillText('Click a level to begin', W / 2, 800);
  };

  function drawHorseSilhouette(ctx) {
    // Simple silhouette
    ctx.beginPath();
    ctx.ellipse(0, 0, 80, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    ctx.fillRect(-30, 25, 8, 60);
    ctx.fillRect(-15, 25, 8, 60);
    ctx.fillRect(20, 25, 8, 60);
    ctx.fillRect(35, 25, 8, 60);
    // Neck and head
    ctx.beginPath();
    ctx.moveTo(40, -15);
    ctx.quadraticCurveTo(60, -45, 90, -60);
    ctx.quadraticCurveTo(100, -50, 95, -38);
    ctx.quadraticCurveTo(75, -22, 55, -8);
    ctx.closePath();
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(-78, -5);
    ctx.quadraticCurveTo(-95, 20, -100, 40);
    ctx.quadraticCurveTo(-85, 30, -75, 15);
    ctx.closePath();
    ctx.fill();
  }

  // ---- Helper: shade a hex color ----
  function shadeColor(hex, amt) {
    let col = hex.replace('#', '');
    if (col.length === 3) col = col.split('').map(c => c + c).join('');
    const num = parseInt(col, 16);
    let r = (num >> 16) + Math.round(amt * 255);
    let g = ((num >> 8) & 0x00FF) + Math.round(amt * 255);
    let b = (num & 0x0000FF) + Math.round(amt * 255);
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  // ---- Render the whole game ----
  Renderer.render = function (ctx) {
    ctx.save();
    // Screen shake
    if (Game.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * Game.shake * 12,
        (Math.random() - 0.5) * Game.shake * 12
      );
    }

    if (Game.state === 'gameintro') {
      Renderer.drawGameIntro(ctx);
    } else if (Game.state === 'menu') {
      Renderer.drawMainMenu(ctx);
    } else {
      const lvl = LEVELS[Game.levelIndex];
      Renderer.drawSky(ctx, lvl.ambience);
      Renderer.drawTrees(ctx);
      Renderer.drawGround(ctx, lvl);
      Renderer.drawFences(ctx, lvl);
      // Z-sorted: far fences behind horse, near fences in front
      Renderer.drawObstaclesBehind(ctx);
      Renderer.drawDestination(ctx, lvl);
      Renderer.drawTrailDust(ctx);
      Renderer.drawParticles(ctx);
      Renderer.drawHorseAndRider(ctx, lvl);
      Renderer.drawObstaclesInFront(ctx);
      Renderer.drawHUD(ctx, lvl);

      if (Game.state === 'paused') {
        Renderer.drawOverlay(ctx, 'Paused', 'Press P to resume', '#f3e5b8');
      } else if (Game.state === 'won') {
        const msg = 'Clean Jumps: ' + Game.cleanJumps + '/' + Game.totalJumps + '\n' +
                    'Whips: ' + Game.whipsUsed + '    Soothes: ' + Game.soothesUsed + '\n' +
                    (Game.barsDropped === 0 ? 'A perfect clear!' : 'You dropped ' + Game.barsDropped + ' bar(s).');
        Renderer.drawOverlay(ctx, 'You made it!', msg, '#7bd389');
      } else if (Game.state === 'lost') {
        Renderer.drawOverlay(ctx, 'Failed', Game.loseReason || 'Try a different approach.', '#e0524a');
      } else if (Game.state === 'intro') {
        Renderer.drawLevelIntro(ctx, lvl);
      }
    }
    ctx.restore();
  };

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  global.HorseGame = {
    Game: Game,
    Input: Input,
    LEVELS: LEVELS,
    update: update,
    render: Renderer.render,
    startLevel: startLevel,
    setState: (s) => { Game.state = s; },
    cycleView: () => { currentView = (currentView + 1) % VIEWS.length; applyView(); },
    getView: () => VIEWS[currentView].name,
    getState: () => Game.state
  };

})(window);
