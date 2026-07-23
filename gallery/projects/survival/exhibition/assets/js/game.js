/*
  Survival — First Playable 2D Web Game (vanilla HTML5 Canvas, no libraries)
  Student: Sawyer Johanneman
  Domain: Running
  Core learning shift: safety is not a place, it is dynamic navigation.

  Features added this iteration:
    - Momentum: a raw accumulator that grows (log-style) the longer you hold one
      direction — speed bonus = GAIN * ln(1 + raw), with no hard cap but a realistic
      practical MAX_SPEED ceiling. Changing direction / stopping bleeds it.
    - Jump: SPACE makes the player hop "toward/away from the screen" (depth), scaling up
      while airborne so enemies/obstacles on the ground plane can be evaded.
    - Large scrolling world (camera follows the player); game scale is unchanged.
    - Push (E): knocks nearby obstacles and enemies away (replaced the old stun).
    - Obstacles persist across levels (added, never wiped); landing on an object pops
      the player out instead of getting stuck. Each obstacle has a distinct kind/texture.
    - Enemies relentlessly home in; contact knocks the PLAYER back, forcing you to keep
      running rather than standing still.
*/
(function () {
  "use strict";

  // ---------------------- CONFIGURATION ----------------------
  var CANVAS_W = 1000;
  var CANVAS_H = 700;
  var WORLD_W = 2800;   // much larger map
  var WORLD_H = 2000;
  var WIN_SCORE = 1000;
  var MAX_HEALTH = 100;
  var MAX_ENERGY = 100;

  // Momentum — logarithmic, unbounded raw value, capped to a practical max speed.
  //   raw momentum keeps growing while you hold one direction (no hard ceiling),
  //   but the speed bonus = GAIN * ln(1 + raw) has diminishing returns, and the
  //   final speed is clamped to MAX_SPEED so you can't tunnel or break the game.
  var MOMENTUM_BUILD = 0.02;  // raw accumulator per frame while moving same direction
  var MOMENTUM_DECAY = 0.06;  // raw per frame when direction changes / stopped
  var MOMENTUM_GAIN = 1.4;    // speed bonus = GAIN * ln(1 + raw)
  var MOMENTUM_BAR_REF = 4;   // HUD bar reads full near +400% bonus (past the cap)
  var MAX_SPEED = 28;         // realistic practical speed ceiling (world units / frame)

  // Push (replaces the old "stun"): E knocks enemies away instead of stunning.
  var PUSH_RANGE = 130;
  var PUSH_SPEED = 9;
  var PUSH_DURATION = 550;    // ms an enemy flees with knockback before re-homing

  // Jump / depth
  var JUMP_VZ = 6;        // launch speed (world units / frame)
  var GRAVITY_Z = 0.4;    // pull back to ground
  var AIR_THRESHOLD = 3;  // considered "airborne" above this depth

  // Obstacle visual kinds (each gets a distinct fill + pattern texture)
  var OBSTACLE_KINDS = ["crate", "rock", "hazard", "barrier", "crystal"];
  // Fixed seed -> the whole obstacle field is the same every game and every level.
  var OBSTACLE_SEED = 1337;

  // Level presets: each changes system variables and relationships
  var LEVELS = [
    {
      name: "Level 1",
      objective: "Don't lose lives",
      playerBaseSpeed: 5.5,
      scorePerFrame: 0.4,
      obstacleCount: 35,
      basicInterval: 2000,
      bulletInterval: 0,
      strongInterval: 0,
      maxBasic: 6,
      maxBullet: 0,
      maxStrong: 0,
    },
    {
      name: "Level 2",
      objective: "Gain higher scores",
      playerBaseSpeed: 4.0,
      scorePerFrame: 0.8,
      obstacleCount: 75,
      basicInterval: 2500,
      bulletInterval: 3000,
      strongInterval: 0,
      maxBasic: 4,
      maxBullet: 3,
      maxStrong: 0,
    },
    {
      name: "Level 3",
      objective: "Reach a new top score",
      playerBaseSpeed: 2.8,
      scorePerFrame: 1.2,
      obstacleCount: 130,
      basicInterval: 3000,
      bulletInterval: 2500,
      strongInterval: 5000,
      maxBasic: 5,
      maxBullet: 4,
      maxStrong: 2,
    },
  ];

  // Total obstacles to pre-build (the hardest level's count); levels just reveal
  // more of this same deterministic field. Defined after LEVELS so it's available.
  var MAX_OBSTACLE_TOTAL = Math.max.apply(
    null,
    LEVELS.map(function (l) { return l.obstacleCount; })
  );

  // ---------------------- HELPERS ----------------------
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }
  // Small seeded PRNG (mulberry32) so the obstacle layout is deterministic and
  // stays consistent between levels and across playthroughs.
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dist(x1, y1, x2, y2) {
    var dx = x2 - x1,
      dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function now() {
    return performance.now();
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function healthColor(t) {
    var r = Math.round(231 + (46 - 231) * t);
    var g = Math.round(76 + (204 - 76) * t);
    var b = Math.round(60 + (113 - 60) * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // ---------------------- STATE ----------------------
  var canvas, ctx;
  var cam = { x: 0, y: 0 };
  var player;
  var playerZ = 0;     // depth / hop height (0 = on ground)
  var playerVZ = 0;    // depth velocity
  var momentum = 0;       // raw accumulator (no hard cap; speed bonus = log of this)
  var momentumBonus = 0;  // computed speed bonus fraction = GAIN * ln(1 + momentum)
  var effSpeed = 0;       // final speed after bonus + practical cap (HUD / debug)
  var momDirX = 0, momDirY = 0;
  var trail = [];
  var obstacles = [];
  var obstacleMaster = []; // full deterministic field; levels reveal a prefix of it
  var enemyList = [];
  var particles = [];
  var score = 0;
  var playerHealth = MAX_HEALTH;
  var energy = MAX_ENERGY;
  var gameState = "start"; // start, playing, won, lost
  var currentLevelIndex = 0;
  var lastBasicSpawn = 0;
  var lastBulletSpawn = 0;
  var lastStrongSpawn = 0;
  var lastInteractTime = -9999;
  var interactCooldown = 1500;
  var interactCost = 20;
  var invincibleUntil = 0;
  var damageFlashUntil = 0;
  var keys = {};
  var frameCount = 0;
  var lastTime = 0;

  function airborne() {
    return playerZ > AIR_THRESHOLD;
  }
  function currentLevel() {
    return LEVELS[currentLevelIndex];
  }
  function movingInput() {
    return isDown("KeyW") || isDown("KeyA") || isDown("KeyS") || isDown("KeyD");
  }
  function isDown(code) {
    return !!keys[code];
  }

  function resetGame() {
    player = { x: WORLD_W / 2, y: WORLD_H / 2, r: 14 };
    playerZ = 0;
    playerVZ = 0;
    momentum = 0;
    momentumBonus = 0;
    effSpeed = 0;
    momDirX = 0;
    momDirY = 0;
    trail = [];
    obstacles = [];
    enemyList = [];
    particles = [];
    score = 0;
    playerHealth = MAX_HEALTH;
    energy = MAX_ENERGY;
    currentLevelIndex = 0;
    lastBasicSpawn = now();
    lastBulletSpawn = now();
    lastStrongSpawn = now();
    lastInteractTime = -9999;
    invincibleUntil = 0;
    damageFlashUntil = 0;
    gameState = "start";
    generateObstacles();
  }

  function startGame() {
    resetGame();
    gameState = "playing";
  }

  // ---------------------- LEVELS ----------------------
  function updateLevel() {
    if (score < 200) currentLevelIndex = 0;
    else if (score < 350) currentLevelIndex = 1;
    else currentLevelIndex = 2;

    // Obstacles keep consistent positions between levels: each level reveals a
    // longer prefix of the SAME deterministic master field, so existing boxes
    // never move and only MORE of them appear as the level rises.
    var desired = currentLevel().obstacleCount;
    if (obstacles.length !== desired) {
      obstacles = obstacleMaster.slice(0, desired);
    }
  }

  // Build the full, deterministic obstacle field once (fixed seed -> identical
  // every game). Boxes stay in the same spots between levels and across
  // playthroughs; each level simply reveals more of this same list.
  function generateObstacles() {
    var rng = makeRng(OBSTACLE_SEED);
    obstacleMaster = [];
    var safeRadius = 220;
    var attempts = 0;
    while (obstacleMaster.length < MAX_OBSTACLE_TOTAL && attempts < 8000) {
      attempts++;
      var w = 60 + rng() * 90;
      var h = 60 + rng() * 90;
      var x = 40 + rng() * (WORLD_W - 40 - w - 40);
      var y = 40 + rng() * (WORLD_H - 40 - h - 40);
      var cx = x + w / 2,
        cy = y + h / 2;
      if (dist(cx, cy, WORLD_W / 2, WORLD_H / 2) < safeRadius + Math.max(w, h) / 2)
        continue; // keep the player's spawn area clear
      var overlaps = false;
      for (var i = 0; i < obstacleMaster.length; i++) {
        var o = obstacleMaster[i];
        if (
          x < o.x + o.w + 16 &&
          x + w + 16 > o.x &&
          y < o.y + o.h + 16 &&
          y + h + 16 > o.y
        ) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        obstacleMaster.push({
          x: x, y: y, w: w, h: h,
          kind: OBSTACLE_KINDS[Math.floor(rng() * OBSTACLE_KINDS.length)],
          seed: rng() * 1000,
        });
      }
    }
    obstacles = obstacleMaster.slice(0, currentLevel().obstacleCount);
  }

  // ---------------------- INPUT ----------------------
  function onKeyDown(e) {
    var k = e.code;
    keys[k] = true;
    if (k === "Space") {
      e.preventDefault();
      if (gameState === "start" || gameState === "won" || gameState === "lost") {
        if (playActive()) startGame();
      } else if (playerZ <= 0 && playerVZ === 0) {
        playerVZ = JUMP_VZ; // launch the depth hop
      }
    }
    if (k === "ArrowUp" || k === "ArrowDown") e.preventDefault();
  }
  function onKeyUp(e) {
    keys[e.code] = false;
  }
  function playActive() {
    var s = document.getElementById("play");
    return !!s && s.classList.contains("active");
  }

  // ---------------------- CAMERA ----------------------
  function computeCamera() {
    if (WORLD_W <= CANVAS_W) cam.x = (WORLD_W - CANVAS_W) / 2;
    else cam.x = clamp(player.x - CANVAS_W / 2, 0, WORLD_W - CANVAS_W);
    if (WORLD_H <= CANVAS_H) cam.y = (WORLD_H - CANVAS_H) / 2;
    else cam.y = clamp(player.y - CANVAS_H / 2, 0, WORLD_H - CANVAS_H);
  }

  // ---------------------- UPDATE ----------------------
  function update() {
    frameCount++;
    computeCamera();
    updateLevel();
    handlePlayerMovement();
    updateJump();
    resolveObstacles(); // pop the player out if a jump landed on/inside an object
    handleInteract();
    spawnEnemies();
    updateEnemies();
    updateParticles();
    updateTrail();
    checkCollisions();

    score += currentLevel().scorePerFrame;

    if (!isDown("ShiftLeft") && !isDown("ShiftRight") && energy < MAX_ENERGY) {
      energy = Math.min(MAX_ENERGY, energy + 0.4);
    }
    if (playerHealth < MAX_HEALTH && now() > damageFlashUntil) {
      playerHealth = Math.min(MAX_HEALTH, playerHealth + 0.03);
    }

    if (playerHealth <= 0) {
      playerHealth = 0;
      gameState = "lost";
    } else if (score >= WIN_SCORE) {
      gameState = "won";
    }
  }

  function handlePlayerMovement() {
    var lvl = currentLevel();
    var speed = lvl.playerBaseSpeed;
    var sprinting =
      (isDown("ShiftLeft") || isDown("ShiftRight")) &&
      energy > 0 &&
      movingInput();
    if (sprinting) {
      speed *= 1.6;
      energy = Math.max(0, energy - 1.0);
    }

    var dx = 0,
      dy = 0;
    if (isDown("KeyW")) dy -= 1;
    if (isDown("KeyS")) dy += 1;
    if (isDown("KeyA")) dx -= 1;
    if (isDown("KeyD")) dx += 1;
    if (dx !== 0 || dy !== 0) {
      var len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    // Momentum: a raw accumulator that grows with no hard ceiling, but the
    // speed bonus is GAIN * ln(1 + raw) (diminishing returns) and the final
    // speed is clamped to MAX_SPEED — the realistic practical maximum.
    if (dx === 0 && dy === 0) {
      momentum = Math.max(0, momentum - MOMENTUM_DECAY);
    } else {
      var dot = dx * momDirX + dy * momDirY;
      if (dot > 0.3) {
        // continuing the committed direction -> keep building
        momentum += MOMENTUM_BUILD;
        momDirX = dx;
        momDirY = dy;
      } else if (momentum <= 0.001) {
        // fully bled -> re-commit to whatever direction we're now holding
        momentum += MOMENTUM_BUILD;
        momDirX = dx;
        momDirY = dy;
      } else {
        // reversing / turning sharply -> bleed, keep the old committed dir
        momentum = Math.max(0, momentum - MOMENTUM_DECAY);
      }
    }
    momentumBonus = MOMENTUM_GAIN * Math.log(1 + momentum);
    effSpeed = Math.min(speed * (1 + momentumBonus), MAX_SPEED);
    speed = effSpeed;

    var nx = clamp(player.x + dx * speed, player.r, WORLD_W - player.r);
    var ny = clamp(player.y + dy * speed, player.r, WORLD_H - player.r);

    if (!airborne()) {
      if (!circleRectCollide(nx, player.y, player.r, obstacles)) player.x = nx;
      if (!circleRectCollide(player.x, ny, player.r, obstacles)) player.y = ny;
    } else {
      // while hopping you sail over obstacles
      player.x = nx;
      player.y = ny;
    }
  }

  function updateJump() {
    if (playerZ > 0 || playerVZ !== 0) {
      playerVZ -= GRAVITY_Z;
      playerZ += playerVZ;
      if (playerZ <= 0) {
        playerZ = 0;
        playerVZ = 0;
      }
    }
  }

  function updateTrail() {
    if (movingInput() && momentumBonus > 0.45) {
      trail.push({ x: player.x, y: player.y });
      if (trail.length > 10) trail.shift();
    } else if (trail.length) {
      trail.shift();
    }
  }

  function handleInteract() {
    if (
      isDown("KeyE") &&
      now() - lastInteractTime > interactCooldown &&
      energy >= interactCost
    ) {
      lastInteractTime = now();
      energy -= interactCost;
      // Push nearby obstacles outward (shove them out of the way)
      for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        var cx = o.x + o.w / 2,
          cy = o.y + o.h / 2;
        if (dist(player.x, player.y, cx, cy) < PUSH_RANGE) {
          var ang = Math.atan2(cy - player.y, cx - player.x);
          o.x = clamp(o.x + Math.cos(ang) * 45, 10, WORLD_W - o.w - 10);
          o.y = clamp(o.y + Math.sin(ang) * 45, 10, WORLD_H - o.h - 10);
        }
      }
      // Push enemies away (no stun — they just get knocked back and flee briefly)
      for (var j = 0; j < enemyList.length; j++) {
        var e = enemyList[j];
        if (dist(player.x, player.y, e.x, e.y) < PUSH_RANGE) {
          var a = Math.atan2(e.y - player.y, e.x - player.x);
          e.vx = Math.cos(a) * PUSH_SPEED;
          e.vy = Math.sin(a) * PUSH_SPEED;
          e.pushUntil = now() + PUSH_DURATION;
        }
      }
      for (var p = 0; p < 20; p++) particles.push(makeShock());
    }
  }

  // ---------------------- ENEMIES ----------------------
  function spawnEnemies() {
    var lvl = currentLevel();
    var t = now();
    if (
      lvl.basicInterval > 0 &&
      t - lastBasicSpawn > lvl.basicInterval &&
      countEnemies("basic") < lvl.maxBasic
    ) {
      enemyList.push(makeEnemy("basic"));
      lastBasicSpawn = t;
    }
    if (
      lvl.bulletInterval > 0 &&
      t - lastBulletSpawn > lvl.bulletInterval &&
      countEnemies("bullet") < lvl.maxBullet
    ) {
      enemyList.push(makeEnemy("bullet"));
      lastBulletSpawn = t;
    }
    if (
      lvl.strongInterval > 0 &&
      t - lastStrongSpawn > lvl.strongInterval &&
      countEnemies("strong") < lvl.maxStrong
    ) {
      enemyList.push(makeEnemy("strong"));
      lastStrongSpawn = t;
    }
  }

  function countEnemies(type) {
    var n = 0;
    for (var i = 0; i < enemyList.length; i++)
      if (enemyList[i].type === type) n++;
    return n;
  }

  function makeEnemy(type) {
    var e = {
      type: type,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      pushUntil: 0,
      r: 12,
      color: "#e74c3c",
      label: "",
    };
    // spawn just outside the visible viewport so they chase in
    var left = cam.x,
      right = cam.x + CANVAS_W,
      top = cam.y,
      bottom = cam.y + CANVAS_H;
    var edge = Math.floor(rand(0, 4));
    if (edge === 0) {
      e.x = rand(left, right);
      e.y = top - 40;
    } else if (edge === 1) {
      e.x = right + 40;
      e.y = rand(top, bottom);
    } else if (edge === 2) {
      e.x = rand(left, right);
      e.y = bottom + 40;
    } else {
      e.x = left - 40;
      e.y = rand(top, bottom);
    }

    if (type === "basic") {
      e.r = 12;
      e.speed = rand(3.0, 4.0) * (1 + currentLevelIndex * 0.2); // faster chaser
      e.color = "#e74c3c";
    } else if (type === "bullet") {
      e.r = 8;
      e.speed = rand(8.0, 10.0); // fast straight projectile
      e.color = "#e67e22";
      e.label = "●";
      var a = Math.atan2(player.y - e.y, player.x - e.x) + rand(-0.4, 0.4);
      e.vx = Math.cos(a) * e.speed;
      e.vy = Math.sin(a) * e.speed;
    } else if (type === "strong") {
      e.r = 22;
      e.speed = rand(2.2, 3.0); // bigger, but still pushes the pace
      e.color = "#9b59b6";
      e.label = "★";
    }
    return e;
  }

  // Pick a heading toward (tx,ty) that doesn't immediately hit an obstacle.
  // Tries the direct angle first, then progressively rotated options, so the
  // enemy curves around boxes and threads through the gaps between them.
  function steerToward(e, tx, ty) {
    var base = Math.atan2(ty - e.y, tx - e.x);
    var offsets = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0, 2.6, -2.6, 3.14, -3.14];
    for (var k = 0; k < offsets.length; k++) {
      var a = base + offsets[k];
      var nx = e.x + Math.cos(a) * e.speed;
      var ny = e.y + Math.sin(a) * e.speed;
      if (!circleRectCollide(nx, ny, e.r, obstacles)) return a;
    }
    return base;
  }

  function updateEnemies() {
    for (var i = enemyList.length - 1; i >= 0; i--) {
      var e = enemyList[i];
      var pushed = now() < e.pushUntil;
      if (pushed) {
        // Knocked back: flee along the push velocity, blocked by obstacles.
        var pnx = e.x + e.vx;
        var pny = e.y + e.vy;
        if (!circleRectCollide(pnx, e.y, e.r, obstacles)) e.x = pnx;
        if (!circleRectCollide(e.x, pny, e.r, obstacles)) e.y = pny;
      } else if (e.type === "bullet") {
        // Bullets fly straight along their fixed velocity (fast dodgeables).
        e.x += e.vx;
        e.y += e.vy;
      } else {
        // Basic / strong home toward the player, steering through the gaps
        // between obstacles so they genuinely chase instead of sticking.
        var a = steerToward(e, player.x, player.y);
        e.vx = Math.cos(a) * e.speed;
        e.vy = Math.sin(a) * e.speed;
        var nx = e.x + e.vx;
        var ny = e.y + e.vy;
        if (!circleRectCollide(nx, e.y, e.r, obstacles)) e.x = nx;
        if (!circleRectCollide(e.x, ny, e.r, obstacles)) e.y = ny;
      }
      // Cull anything that has drifted well outside the viewport.
      if (
        e.x < cam.x - 160 ||
        e.x > cam.x + CANVAS_W + 160 ||
        e.y < cam.y - 160 ||
        e.y > cam.y + CANVAS_H + 160
      ) {
        enemyList.splice(i, 1);
      }
    }
  }

  // ---------------------- COLLISIONS ----------------------
  function checkCollisions() {
    if (airborne()) return; // hopping over the ground plane dodges everything
    if (now() < invincibleUntil) return;
    for (var i = 0; i < enemyList.length; i++) {
      var e = enemyList[i];
      if (dist(player.x, player.y, e.x, e.y) < player.r + e.r) {
        var dmg = e.type === "basic" ? 15 : e.type === "bullet" ? 10 : 30;
        playerHealth -= dmg;
        invincibleUntil = now() + 800;
        damageFlashUntil = now() + 250;
        var ang = Math.atan2(e.y - player.y, e.x - player.x); // player -> enemy
        // enemy is flung away from the player
        e.x += Math.cos(ang) * 40;
        e.y += Math.sin(ang) * 40;
        // player is knocked back the opposite way — you can't camp on enemies,
        // which is what keeps you running instead of standing still
        var pk = 30;
        player.x = clamp(player.x - Math.cos(ang) * pk, player.r, WORLD_W - player.r);
        player.y = clamp(player.y - Math.sin(ang) * pk, player.r, WORLD_H - player.r);
        resolveObstacles(); // don't get shoved into a wall/obstacle by the hit
        for (var p = 0; p < 12; p++) particles.push(makeDamage());
        break;
      }
    }
  }

  function circleRectCollide(cx, cy, r, rects) {
    for (var i = 0; i < rects.length; i++) {
      var o = rects[i];
      var closestX = clamp(cx, o.x, o.x + o.w);
      var closestY = clamp(cy, o.y, o.y + o.h);
      var dX = cx - closestX;
      var dY = cy - closestY;
      if (dX * dX + dY * dY < r * r) return true;
    }
    return false;
  }

  // Eject the grounded player out of any obstacle it is overlapping. This mainly
  // matters when you land from a jump on top of / inside an object: instead of
  // getting stuck, you get popped out to the nearest open edge.
  function resolveObstacles() {
    if (airborne()) return;
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      var closestX = clamp(player.x, o.x, o.x + o.w);
      var closestY = clamp(player.y, o.y, o.y + o.h);
      var dX = player.x - closestX;
      var dY = player.y - closestY;
      var d2 = dX * dX + dY * dY;
      if (d2 >= player.r * player.r) continue; // no overlap
      if (d2 > 0.0001) {
        var d = Math.sqrt(d2);
        var push = player.r - d;
        player.x += (dX / d) * push;
        player.y += (dY / d) * push;
      } else {
        // Center is exactly inside the rect: shove out along the shallowest side.
        var left = player.x - o.x;
        var right = o.x + o.w - player.x;
        var top = player.y - o.y;
        var bot = o.y + o.h - player.y;
        var m = Math.min(left, right, top, bot);
        if (m === left) player.x = o.x - player.r;
        else if (m === right) player.x = o.x + o.w + player.r;
        else if (m === top) player.y = o.y - player.r;
        else player.y = o.y + o.h + player.r;
      }
    }
  }

  // ---------------------- PARTICLES ----------------------
  function makeShock() {
    var a = rand(0, Math.PI * 2);
    var s = rand(2, 5);
    return { x: player.x, y: player.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30, max: 30, color: "#64c8ff", size: rand(3, 6) };
  }
  function makeDamage() {
    var a = rand(0, Math.PI * 2);
    var s = rand(1, 4);
    return { x: player.x, y: player.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 25, max: 25, color: "#e74c3c", size: rand(3, 7) };
  }
  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ---------------------- DRAW ----------------------
  function draw() {
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (gameState === "start") {
      drawWorld();
      drawStartScreen();
      return;
    }

    if (gameState === "playing") update();

    drawWorld();
    drawHUD();

    if (now() < damageFlashUntil) {
      ctx.fillStyle = "rgba(231,76,60,0.35)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    if (gameState === "won")
      drawOverlay("YOU SURVIVED!", "Score: " + Math.floor(score), "Press SPACE to play again");
    else if (gameState === "lost")
      drawOverlay("GAME OVER", "Final Score: " + Math.floor(score), "Press SPACE to retry");
  }

  function drawWorld() {
    computeCamera();
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawGridWorld();
    drawWorldBorder();
    drawObstacles();
    drawParticles();
    drawEnemies();
    drawPlayer();
    ctx.restore();
  }

  function drawGridWorld() {
    ctx.strokeStyle = "rgba(40,46,64,0.8)";
    ctx.lineWidth = 1;
    var step = 50;
    var x0 = Math.floor(cam.x / step) * step;
    for (var x = x0; x <= cam.x + CANVAS_W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, cam.y);
      ctx.lineTo(x, cam.y + CANVAS_H);
      ctx.stroke();
    }
    var y0 = Math.floor(cam.y / step) * step;
    for (var y = y0; y <= cam.y + CANVAS_H; y += step) {
      ctx.beginPath();
      ctx.moveTo(cam.x, y);
      ctx.lineTo(cam.x + CANVAS_W, y);
      ctx.stroke();
    }
  }

  function drawWorldBorder() {
    ctx.strokeStyle = "rgba(244,185,66,0.55)";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
  }

  function drawObstacles() {
    for (var i = 0; i < obstacles.length; i++) drawObstacle(obstacles[i]);
  }

  function drawObstacle(o) {
    var x = o.x, y = o.y, w = o.w, h = o.h;
    var fill, stroke;
    if (o.kind === "crate") { fill = "#8a5a2b"; stroke = "#5c3a18"; }
    else if (o.kind === "rock") { fill = "#6b7280"; stroke = "#3f454e"; }
    else if (o.kind === "hazard") { fill = "#1c1c22"; stroke = "#f4b942"; }
    else if (o.kind === "barrier") { fill = "#1f6f6a"; stroke = "#4ecdc4"; }
    else { fill = "#5b3a8a"; stroke = "#b388ff"; } // crystal

    // base plate
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    // texture overlay, clipped to the obstacle so patterns stay inside
    ctx.save();
    roundRect(ctx, x, y, w, h, 6);
    ctx.clip();
    if (o.kind === "crate") {
      // wooden crate: crossed planks + inner frame
      ctx.strokeStyle = "rgba(92,58,24,0.75)";
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w, y + h);
      ctx.moveTo(x + w, y); ctx.lineTo(x, y + h);
      ctx.stroke();
    } else if (o.kind === "rock") {
      // boulder: a few darker speckles (deterministic from seed)
      ctx.fillStyle = "rgba(0,0,0,0.20)";
      for (var s = 0; s < 6; s++) {
        var hx = hash(o.seed + s * 7.3) * w;
        var hy = hash(o.seed + s * 3.1 + 11) * h;
        var hr = 3 + hash(o.seed + s * 1.7) * 5;
        ctx.beginPath();
        ctx.arc(x + hx, y + hy, hr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (o.kind === "hazard") {
      // hazard: yellow/black diagonal stripes
      ctx.strokeStyle = "#f4b942";
      ctx.lineWidth = 9;
      for (var d = -h; d < w + h; d += 20) {
        ctx.beginPath();
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + d - h, y + h);
        ctx.stroke();
      }
    } else if (o.kind === "barrier") {
      // barrier: bright inset border (double line)
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 4);
      ctx.stroke();
      ctx.strokeStyle = "rgba(78,205,196,0.9)";
      ctx.lineWidth = 2;
      roundRect(ctx, x + 11, y + 11, w - 22, h - 22, 3);
      ctx.stroke();
    } else {
      // crystal: glowing X in the center
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 2;
      var ccx = x + w / 2, ccy = y + h / 2;
      var r = Math.min(w, h) * 0.28;
      ctx.beginPath();
      ctx.moveTo(ccx - r, ccy - r); ctx.lineTo(ccx + r, ccy + r);
      ctx.moveTo(ccx + r, ccy - r); ctx.lineTo(ccx - r, ccy + r);
      ctx.stroke();
    }
    ctx.restore();
  }

  // deterministic 0..1 hash for stable per-obstacle texture variation
  function hash(n) {
    var v = Math.sin(n) * 10000;
    return v - Math.floor(v);
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    // ground shadow (shrinks as the player hops "toward" the screen)
    var shR = player.r * (1 - Math.min(0.55, playerZ * 0.009));
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(player.x, player.y, shR, shR * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // momentum trail
    for (var t = 0; t < trail.length; t++) {
      ctx.globalAlpha = ((t + 1) / trail.length) * 0.25;
      ctx.fillStyle = "#4ecdc4";
      ctx.beginPath();
      ctx.arc(trail[t].x, trail[t].y, player.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (now() < damageFlashUntil) return;
    if (now() < invincibleUntil && frameCount % 10 < 5) return;

    var sc = 1 + playerZ * 0.012; // bigger = closer to the screen
    var sx = player.x;
    var sy = player.y - playerZ * 0.5; // lift while hopping

    if ((isDown("ShiftLeft") || isDown("ShiftRight")) && energy > 0 && movingInput()) {
      ctx.strokeStyle = "rgba(244,185,66,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, player.r * sc + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(sc, sc);
    ctx.fillStyle = "#4ecdc4";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    var dx = 0,
      dy = 0;
    if (isDown("KeyW")) dy -= 1;
    if (isDown("KeyS")) dy += 1;
    if (isDown("KeyA")) dx -= 1;
    if (isDown("KeyD")) dx += 1;
    if (dx !== 0 || dy !== 0) {
      var a = Math.atan2(dy, dx);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
      ctx.stroke();
    }
    ctx.restore();

    // speed lines when momentum is high
    if (momentumBonus > 0.6) {
      ctx.strokeStyle = "rgba(78,205,196," + Math.min(0.8, momentumBonus - 0.6).toFixed(2) + ")";
      ctx.lineWidth = 2;
      for (var s = 0; s < 3; s++) {
        var off = (s + 1) * 6;
        ctx.beginPath();
        ctx.moveTo(sx - momDirX * (player.r + off), sy - momDirY * (player.r + off));
        ctx.lineTo(sx - momDirX * (player.r + off + 8), sy - momDirY * (player.r + off + 8));
        ctx.stroke();
      }
    }
  }

  function drawEnemies() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 11px sans-serif";
    for (var i = 0; i < enemyList.length; i++) {
      var e = enemyList[i];
      // solid, opaque body
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      // dark rim so it reads against the busy background
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // glossy highlight (still a solid, opaque look)
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.3, e.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      if (now() < e.pushUntil) {
        ctx.strokeStyle = "#4ecdc4";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.label) {
        ctx.fillStyle = "#fff";
        ctx.fillText(e.label, e.x, e.y + 1);
      }
    }
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, CANVAS_W, 112);

    // Score (top-left)
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.fillText("SCORE", 20, 10);
    ctx.fillStyle = "#f4b942";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(String(Math.floor(score)), 20, 30);

    // Energy bar + label
    var eBarW = 140,
      eBarH = 10;
    ctx.fillStyle = "#3c3c46";
    roundRect(ctx, 20, 66, eBarW, eBarH, 3);
    ctx.fill();
    ctx.fillStyle = "#f4b942";
    roundRect(ctx, 20, 66, eBarW * (energy / MAX_ENERGY), eBarH, 3);
    ctx.fill();
    ctx.fillStyle = "#c8c8c8";
    ctx.font = "12px sans-serif";
    ctx.fillText("ENERGY", 20, 80);
    var cdPct = clamp((now() - lastInteractTime) / interactCooldown, 0, 1);
    ctx.fillStyle = "#3c3c46";
    roundRect(ctx, 90, 80, 70, 5, 3);
    ctx.fill();
    ctx.fillStyle = "#64c8ff";
    roundRect(ctx, 90, 80, 70 * cdPct, 5, 3);
    ctx.fill();

    // Momentum bar + label (fill reflects the log speed bonus vs the cap ref)
    var mBarW = 140,
      mBarH = 8,
      my = 92;
    ctx.fillStyle = "#3c3c46";
    roundRect(ctx, 200, my, mBarW, mBarH, 3);
    ctx.fill();
    ctx.fillStyle = "#4ecdc4";
    var mFill = clamp(momentumBonus / MOMENTUM_BAR_REF, 0, 1);
    roundRect(ctx, 200, my, mBarW * mFill, mBarH, 3);
    ctx.fill();
    ctx.fillStyle = "#c8c8c8";
    ctx.fillText("MOMENTUM", 200, my + mBarH + 2);

    // Level (center)
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(currentLevel().name.toUpperCase(), CANVAS_W / 2, 10);
    ctx.fillStyle = "#c8c8c8";
    ctx.font = "14px sans-serif";
    ctx.fillText(currentLevel().objective, CANVAS_W / 2, 34);

    // Health (top-right)
    var barW = 200,
      barH = 18,
      bx = CANVAS_W - barW - 20,
      by = 14;
    ctx.fillStyle = "#3c3c46";
    roundRect(ctx, bx, by, barW, barH, 4);
    ctx.fill();
    var hp = playerHealth / MAX_HEALTH;
    ctx.fillStyle = healthColor(hp);
    roundRect(ctx, bx, by, barW * hp, barH, 4);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.fillText("HEALTH", CANVAS_W - 20, 38);
  }

  function drawStartScreen() {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f4b942";
    ctx.font = "bold 52px sans-serif";
    ctx.fillText("SURVIVAL", CANVAS_W / 2, CANVAS_H / 2 - 70);
    ctx.fillStyle = "#fff";
    ctx.font = "18px sans-serif";
    ctx.fillText("Run. Dodge. Build momentum. Hop over danger.", CANVAS_W / 2, CANVAS_H / 2 - 20);
    ctx.fillStyle = "#c8c8c8";
    ctx.font = "16px sans-serif";
    ctx.fillText("WASD move  ·  SHIFT sprint  ·  E push  ·  SPACE jump", CANVAS_W / 2, CANVAS_H / 2 + 20);
    ctx.fillStyle = "#f4b942";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("Press SPACE to start", CANVAS_W / 2, CANVAS_H / 2 + 80);
  }

  function drawOverlay(title, sub, action) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = gameState === "won" ? "#2ecc71" : "#e74c3c";
    ctx.font = "bold 48px sans-serif";
    ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 40);
    ctx.fillStyle = "#fff";
    ctx.font = "22px sans-serif";
    ctx.fillText(sub, CANVAS_W / 2, CANVAS_H / 2 + 20);
    ctx.fillStyle = "#f4b942";
    ctx.font = "18px sans-serif";
    ctx.fillText(action, CANVAS_W / 2, CANVAS_H / 2 + 70);
  }

  // ---------------------- BOOT ----------------------
  function init() {
    var container = document.getElementById("game-container");
    if (!container) return;
    canvas = document.createElement("canvas");
    canvas.id = "game-canvas";
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.style.width = "100%";
    canvas.style.maxWidth = CANVAS_W + "px";
    canvas.style.height = "auto";
    canvas.style.display = "block";
    canvas.style.borderRadius = "12px";
    canvas.style.border = "2px solid #c48b28";
    canvas.style.boxShadow = "0 10px 40px rgba(0,0,0,0.5)";
    canvas.style.background = "#0b0d12";
    container.appendChild(canvas);
    ctx = canvas.getContext("2d");

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    resetGame();
    requestAnimationFrame(loop);
  }

  function loop(t) {
    lastTime = t;
    draw();
    requestAnimationFrame(loop);
  }

  // Read-only debug hook (harmless; useful for testing / tuning).
  window.SurvivalDebug = function () {
    var kindCount = {};
    for (var oi = 0; oi < obstacles.length; oi++) {
      var kk = obstacles[oi].kind || "?";
      kindCount[kk] = (kindCount[kk] || 0) + 1;
    }
    var near = null;
    var best = Infinity;
    for (var i = 0; i < enemyList.length; i++) {
      var e = enemyList[i];
      var d = dist(player.x, player.y, e.x, e.y);
      if (d < best) {
        best = d;
        near = { dist: d, type: e.type, vx: e.vx, vy: e.vy, pushUntil: e.pushUntil };
      }
    }
    return {
      state: gameState,
      x: player.x,
      y: player.y,
      z: playerZ,
      health: playerHealth,
      momentum: momentum,        // raw accumulator (no hard cap)
      momentumBonus: momentumBonus,
      effSpeed: effSpeed,
      maxSpeed: MAX_SPEED,
      winScore: WIN_SCORE,
      score: score,
      camx: cam.x,
      camy: cam.y,
      worldW: WORLD_W,
      worldH: WORLD_H,
      now: now(),
      enemies: enemyList.length,
      obstacles: obstacles.length,
      obstacleKinds: kindCount,
      masterObstacles: obstacleMaster.length,
      revealedObstacles: obstacles.length,
      obstaclePositions: obstacles.map(function (o) {
        return [Math.round(o.x), Math.round(o.y)];
      }),
      insideObstacle: circleRectCollide(player.x, player.y, player.r, obstacles),
      nearestEnemy: near,
      enemiesPushedNow: enemyList.filter(function (e) {
        return now() < e.pushUntil;
      }).length,
    };
  };

  // Test-only hook: fast-forward the score to trigger level transitions.
  window.SurvivalSetScore = function (v) { score = v; };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
