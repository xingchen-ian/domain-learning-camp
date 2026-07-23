/* =========================================================================
 *  Speed Car Master Tournament —— First-Person F1 Racing (extended)
 *  Pure Canvas 2D pseudo-3D. No external dependencies.
 *
 *  Core learning shift: beginners think racing is just flooring the
 *  throttle; experts read the data, manage the car, and pit in time.
 *
 *  This version adds (per design request): garage start sequence +
 *  5-light countdown, garage tire station with long-press E, guardrails
 *  with 3-hit damage, high-temp blurred vision, car collisions, level
 *  car counts / tighter turns, weather (sun/rain/fog), minimap, voice
 *  meter, and per-level obstacles / themes / hills.
 * ========================================================================= */

(function () {
  'use strict';

  /* ----------------------------- Basic constants ------------------------------ */
  var fps = 60;
  var step = 1 / fps;
  var width = 1280, height = 720;
  var segmentLength = 200;
  var rumbleLength = 3;
  var roadWidth = 2000;
  var drawDistance = 260;
  var cameraHeight = 1000;
  var fieldOfView = 100;
  var cameraDepth = 1 / Math.tan((fieldOfView / 2) * Math.PI / 180);
  var playerZ = cameraHeight * cameraDepth;
  var maxSpeed = segmentLength / step;       // 12000 units/s
  var accel = maxSpeed / 4;
  var braking = -maxSpeed;
  var decel = -maxSpeed / 5;
  var offRoadDecel = -maxSpeed / 2;
  var offRoadLimit = maxSpeed / 4;
  var centrifugal = 0.32;
  var steerResponse = 1.15;
  var CAR_LEN = 230;                          // collision length (world units)
  var CAR_HALF = 0.28;                        // collision half-width (road units)
  var PIT_TIME = 2.6;                         // long-press E duration (s)
  var GUARDRAIL_MAX = 3;                      // hits before permanent damage
  var INTRO_TIME = 3.2;
  var COUNTDOWN_TIME = 5.2;

  /* ----------------------------- Level configuration ------------------------------ */
  // overtakeSpace: road-width multiplier (smaller = less room to pass at higher levels)
  var LEVELS = {
    1: {
      key: 1, name: 'Level 1 · Rookie Straight', weather: 'sun', theme: 'grass',
      desc: 'Sunny day on a grassy circuit. Gentle corners, slightly slower rivals, no pit needed.',
      seed: 1337, trackSegments: 3000, straightProb: 0.46, curveMag: 2.2,
      hillMag: 0, hillCount: 0, competitors: 7, compMin: 6800, compMax: 7400,
      threshold: 0.5, needPit: false, airTemp: 30, fogDist: 260,
      gravel: false, brokenCarts: 0, overtake: 1.0, roadW: 2000
    },
    2: {
      key: 2, name: 'Level 2 · Technical Corners', weather: 'rain', theme: 'city',
      desc: 'Rainy, lightning city circuit. More corners, evenly matched rivals, pit at least once.',
      seed: 2024, trackSegments: 3800, straightProb: 0.30, curveMag: 3.9,
      hillMag: 30, hillCount: 4, competitors: 15, compMin: 7900, compMax: 8700,
      threshold: 0.7, needPit: true, airTemp: 33, fogDist: 150,
      gravel: true, brokenCarts: 0, overtake: 0.72, roadW: 1820
    },
    3: {
      key: 3, name: 'Level 3 · Extreme Sharp Corners', weather: 'fog', theme: 'beach',
      desc: 'Foggy beach circuit. Tight connected corners, slightly faster rivals, watch for broken carts.',
      seed: 99, trackSegments: 4600, straightProb: 0.20, curveMag: 5.4,
      hillMag: 44, hillCount: 10, competitors: 22, compMin: 8300, compMax: 9300,
      threshold: 0.5, needPit: false, airTemp: 36, fogDist: 34,
      gravel: false, brokenCarts: 2, overtake: 0.46, roadW: 1640
    }
  };

  /* ----------------------------- Colors ------------------------------ */
  var COLORS = {
    LIGHT: { road: '#6b6b6b', grass: '#2e8b2e', rumble: '#d23b3b', lane: '#ffffff' },
    DARK:  { road: '#666666', grass: '#268226', rumble: '#ffffff', lane: null },
    FINISH:{ road: '#cfcfcf', grass: '#1f6f1f', rumble: '#111111', lane: null },
    SAND:  { road: '#6b6b6b', grass: '#d9c98a', rumble: '#c98b3b', lane: '#ffffff' },
    CITYG: { road: '#6b6b6b', grass: '#3a3f47', rumble: '#d23b3b', lane: '#ffffff' }
  };
  var WEATHER_SKY = {
    sun:  { top: '#7ec8ff', bot: '#dff1ff', sun: '#fff7c2' },
    rain: { top: '#5b6b78', bot: '#9fb0bd', sun: '#cfd6da' },
    fog:  { top: '#c9d2d8', bot: '#e6ebef', sun: '#eef2f4' }
  };
  var FOG_COLOR = { sun: null, rain: 'rgba(180,195,210,', fog: 'rgba(220,228,234,' };

  /* ----------------------------- Utility ------------------------------ */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function interpolate(a, b, p) { return a + (b - a) * p; }
  function percentRemaining(n, total) { return (n % total) / total; }
  function easeIn(a, b, p) { return a + (b - a) * Math.pow(p, 2); }
  function easeInOut(a, b, p) { return a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5); }
  function randInt(rng, a, b) { return Math.floor(a + rng() * (b - a + 1)); }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function findSegment(z) {
    var i = Math.floor(z / segmentLength) % segments.length;
    i = (i + segments.length) % segments.length;
    return segments[i];
  }
  function project(p, cameraX, cameraY, cameraZ) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = (p.world.z || 0) - cameraZ;
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
    p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
    p.screen.w = Math.round(p.screen.scale * roadWidth * width / 2);
  }
  function rumbleWidth(w) { return w / 6; }
  function laneWidth(w) { return w / 32; }

  /* ----------------------------- Track data ------------------------------ */
  var segments = [];
  var trackLength = 0;
  var finishZ = 0, finishSegmentIndex = 0;
  var pitSegmentIndex = 0, pitStartZ = 0, pitEndZ = 0;
  var brokenCarts = [];           // [{z, x}]
  var trackPath = [];             // minimap centerline
  var rainDrops = [];

  function lastY() { return segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y; }

  function addSegment(curve, y) {
    var n = segments.length;
    segments.push({
      index: n,
      p1: { world: { y: lastY(), z: n * segmentLength }, camera: {}, screen: {} },
      p2: { world: { y: y, z: (n + 1) * segmentLength }, camera: {}, screen: {} },
      curve: curve, sprites: [], cars: [],
      finish: false, gravel: false, color: Math.floor(n / rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT
    });
  }
  function addRoad(enter, hold, leave, curve, y) {
    var startY = lastY(), endY = startY + (y * segmentLength), total = enter + hold + leave, n;
    for (n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
  }
  function addStraight(num) { addRoad(num, num, num, 0, 0); }
  function addCurve(num, curve, h) { addRoad(num, num, num, curve, h || 0); }
  function addHill(num, h) { addRoad(num, num, num, 0, h); }
  function addSCurve(num, mag) { addRoad(num, num, num, mag, 0); addRoad(num, num, num, -mag, 0); }

  function buildTrack(cfg) {
    segments = [];
    roadWidth = cfg.roadW;
    var rng = mulberry32(cfg.seed);
    var guard = 0;
    while (segments.length < cfg.trackSegments && guard < 3000) {
      guard++;
      var r = rng();
      if (r < cfg.straightProb) {
        addStraight(randInt(rng, cfg.straightMin || 30, cfg.straightMax || 60));
      } else if (r < cfg.straightProb + 0.5) {
        var dir = rng() < 0.5 ? -1 : 1;
        var h = rng() < 0.4 ? randInt(rng, -cfg.hillMag, cfg.hillMag) : 0;
        addCurve(randInt(rng, cfg.curveMin || 20, cfg.curveMax || 50), dir * cfg.curveMag, h);
      } else {
        addSCurve(randInt(rng, cfg.curveMin || 20, cfg.curveMax || 50), cfg.curveMag);
        if (rng() < 0.5) addHill(randInt(rng, 20, 40), randInt(rng, -cfg.hillMag, cfg.hillMag));
      }
    }
    // Hills for higher levels, placed at random positions
    for (var hi = 0; hi < cfg.hillCount; hi++) {
      var hp = randInt(rng, 50, segments.length - 60);
      var hh = randInt(rng, -cfg.hillMag, cfg.hillMag);
      for (var k = 0; k < 40; k++) {
        var s = segments[hp + k]; if (!s) break;
        s.p1.world.y += easeInOut(0, hh, k / 40);
        s.p2.world.y += easeInOut(0, hh, k / 40);
      }
    }
    // Pit / garage in the middle
    pitSegmentIndex = Math.floor(segments.length * 0.5);
    pitStartZ = (pitSegmentIndex - 7) * segmentLength;
    pitEndZ = (pitSegmentIndex + 7) * segmentLength;
    segments[pitSegmentIndex].sprites.push({ type: 'garage' });
    segments[pitSegmentIndex].sprites.push({ type: 'pitbox' });
    // Finish line near the end
    finishSegmentIndex = segments.length - 36;
    finishZ = finishSegmentIndex * segmentLength;
    for (var i = finishSegmentIndex; i < Math.min(segments.length, finishSegmentIndex + 8); i++) {
      segments[i].finish = true; segments[i].color = COLORS.FINISH;
    }
    segments[finishSegmentIndex].sprites.push({ type: 'finish' });
    trackLength = segments.length * segmentLength;
    // Gravel patches (Level 2): loose gravel on the road
    if (cfg.gravel) {
      for (var g = 0; g < 22; g++) {
        var gp = randInt(rng, 60, segments.length - 60);
        segments[gp].gravel = true;
      }
    }
    // Broken carts (Level 3): 2 random, away from start/finish/pit, new each round
    brokenCarts = [];
    if (cfg.brokenCarts > 0) {
      var tries = 0;
      while (brokenCarts.length < cfg.brokenCarts && tries < 200) {
        tries++;
        var cz = randInt(rng, 800, segments.length - 60) * segmentLength;
        if (cz > pitEndZ + 4000 && cz < finishZ - 6000) {
          brokenCarts.push({ z: cz, x: randInt(rng, -6, 6) / 10 });
        }
      }
    }
    buildTrackPath();
  }

  function buildTrackPath() {
    trackPath = [];
    var tx = 0;
    for (var i = 0; i < segments.length; i += 6) {
      tx += segments[i].curve * 0.0016;
      trackPath.push({ x: tx, y: i });
    }
  }

  /* ----------------------------- Game state ------------------------------ */
  var canvas, ctx;
  var state = 'menu';          // menu | intro | countdown | racing | finished
  var level = null, levelKey = 1;
  var player = null;
  var competitors = [];
  var finishCounter = 0;
  var pitStops = 0, raceTime = 0;
  var steerAngle = 0;
  var halfFinishedTimer = -1;
  var resultInfo = null, muted = false, lastRadio = '', radioBox;
  var hudEls = {};
  var keys = { left: false, right: false, fwd: false, brake: false, pit: false };

  // feature state
  var introTimer = 0, countdownTimer = 0, goFlash = 0;
  var guardrailHits = 0, guardrailDamaged = false, offRoadHitActive = false;
  var pitProgress = 0, pitting = false, pitAnnounced = false;
  var collisionCD = 0, spin = 0;
  var speaking = false, speakUntil = 0, lightningTimer = 4, lightningFlash = 0;
  var bounce = 0;             // gravel bounce offset
  var warnText = 'Vehicle normal, keep your rhythm';

  function resetGame(cfg) {
    level = cfg;
    buildTrack(cfg);
    player = {
      x: 0, z: 0, speed: 0, tireWear: 0, tirePressure: 2.0, blown: false,
      health: 100, driverTemp: 36.5, rank: 1, beat: 0
    };
    competitors = [];
    finishCounter = 0; pitStops = 0; raceTime = 0; steerAngle = 0;
    halfFinishedTimer = -1; resultInfo = null;
    guardrailHits = 0; guardrailDamaged = false; offRoadHitActive = false;
    pitProgress = 0; pitting = false; pitAnnounced = false;
    collisionCD = 0; spin = 0; bounce = 0;
    introTimer = 0; countdownTimer = 0; goFlash = 0;
    guardrailDamaged = false;
    var rng = mulberry32(cfg.seed + 7);
    for (var i = 0; i < cfg.competitors; i++) {
      competitors.push({
        z: randInt(rng, -2500, 2500), x: (rng() * 1.2 - 0.6),
        speed: cfg.compMin + rng() * (cfg.compMax - cfg.compMin),
        finished: false, finishOrder: 0,
        health: 100, tireLife: 100,
        color: ['#e23b3b', '#3b7de2', '#e2c23b', '#3be29a', '#e23b3b', '#ff8c1a', '#9b59b6',
                '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b', '#2980b9', '#8e44ad',
                '#27ae60', '#d35400', '#2c3e50', '#f39c12', '#7f8c8d', '#bdc3c7', '#e74c3c', '#3498db'][i % 24]
      });
    }
    // rain drops
    rainDrops = [];
    for (var d = 0; d < 140; d++) rainDrops.push({ x: Math.random() * width, y: Math.random() * height, l: 8 + Math.random() * 10, s: 6 + Math.random() * 6 });
  }

  /* ----------------------------- Input ------------------------------ */
  function bindInput() {
    window.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': keys.left = true; e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D': keys.right = true; e.preventDefault(); break;
        case 'ArrowUp': case 'w': case 'W': keys.fwd = true; e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S': keys.brake = true; e.preventDefault(); break;
        case 'e': case 'E': keys.pit = true; break;
        case 'm': case 'M': toggleMute(); break;
        case 'r': case 'R': if (state === 'finished') restart(); break;
        case 'Enter': if (state === 'finished') restart(); break;
      }
    });
    window.addEventListener('keyup', function (e) {
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': keys.left = false; break;
        case 'ArrowRight': case 'd': case 'D': keys.right = false; break;
        case 'ArrowUp': case 'w': case 'W': keys.fwd = false; break;
        case 'ArrowDown': case 's': case 'S': keys.brake = false; break;
        case 'e': case 'E': keys.pit = false; pitting = false; pitAnnounced = false; break;
      }
    });
    var touchStart = 0;
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', function () { keys.left = keys.right = keys.fwd = keys.brake = false; });
    function handleTouch(e) {
      e.preventDefault();
      keys.left = keys.right = keys.fwd = keys.brake = false;
      for (var i = 0; i < e.touches.length; i++) {
        var t = e.touches[i];
        var rx = t.clientX / window.innerWidth, ry = t.clientY / window.innerHeight;
        if (rx < 0.33) keys.left = true; else if (rx > 0.66) keys.right = true;
        if (ry < 0.5) keys.fwd = true; else keys.brake = true;
      }
    }
  }

  /* ----------------------------- Radio / voice ------------------------------ */
  function speak(text) {
    if (muted) return;
    speaking = true; speakUntil = performance.now() + 1300;
    try {
      if (!window.speechSynthesis) return;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 1.12; u.pitch = 1.0;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch (e) { /* ignore unsupported */ }
  }
  function pushRadio(text) {
    lastRadio = text;
    if (radioBox) radioBox.textContent = text;
    speak(text);
  }
  function toggleMute() {
    muted = !muted;
    var b = document.getElementById('muteBtn');
    if (b) b.textContent = muted ? 'Voice: Off' : 'Voice: On';
  }

  /* ----------------------------- Pre-race phases ------------------------------ */
  function updateIntro(dt) {
    introTimer += dt;
    if (introTimer >= INTRO_TIME) {
      state = 'countdown'; countdownTimer = 0;
      pushRadio('Get ready. Lights coming on.');
    }
  }
  function updateCountdown(dt) {
    countdownTimer += dt;
    if (countdownTimer >= COUNTDOWN_TIME) {
      state = 'racing'; raceTime = 0; goFlash = 1.2;
      pushRadio('GO! GO! GO!');
    }
  }

  /* ----------------------------- Physics update ------------------------------ */
  function update(dt) {
    if (state !== 'racing') return;
    raceTime += dt;
    if (collisionCD > 0) collisionCD -= dt;
    if (spin > 0) spin -= dt;
    if (goFlash > 0) goFlash -= dt;
    if (lightningFlash > 0) lightningFlash -= dt;

    var playerSeg = findSegment(player.z);
    var speedPercent = player.speed / maxSpeed;
    var dx = dt * 2 * Math.max(0.15, speedPercent);

    // Steering: centrifugal pushes outward, player must counter-steer
    player.x -= dx * playerSeg.curve * centrifugal * (level.weather === 'rain' ? 1.35 : 1);
    var steer = 0;
    if (keys.left) steer -= 1; if (keys.right) steer += 1;
    if (spin > 0) steer += Math.sin(raceTime * 22) * 0.8;   // wobble while spinning
    player.x += dx * steerResponse * steer;
    steerAngle = interpolate(steerAngle, steer, 0.2);

    // Throttle / brake / reverse
    if (keys.fwd) player.speed += accel * dt;
    else if (keys.brake) {
      if (player.speed > 1) player.speed += braking * dt;
      else player.speed -= accel * dt * 0.55;
    } else player.speed += decel * dt;
    if (!keys.brake && player.speed < 0) player.speed = 0;

    // Off track / guardrail
    var offRoad = (player.x < -1 || player.x > 1);
    if (offRoad && player.speed > offRoadLimit) player.speed += offRoadDecel * dt;
    // guardrail hit (only when clearly past the edge on a curve)
    if (Math.abs(player.x) > 1.06 && !offRoadHitActive) {
      offRoadHitActive = true;
      guardrailHits++;
      player.health -= 4;
      player.speed *= 0.85;
      if (guardrailHits >= GUARDRAIL_MAX) {
        guardrailDamaged = true;
        pushRadio('Guardrail damaged three times! Car badly hurt, handle with care.');
      } else {
        pushRadio('Hit the guardrail! Watch the track edges.');
      }
    }
    if (Math.abs(player.x) < 0.95) offRoadHitActive = false;

    // L1 grass penalty: health down + wear up when off road
    if (offRoad) { player.health -= 5 * dt; player.tireWear += 3 * dt; }

    // L2 gravel: bounce + extra wear
    if (level.gravel && playerSeg.gravel) { bounce = 6; player.tireWear += 6 * dt; }

    // Effective top speed (reduced by tire/health/temp + guardrail damage)
    var eff = 1.0;
    if (player.tireWear > 80) eff *= (1 - (player.tireWear - 80) / 100);
    if (player.health < 50) eff *= (0.7 + 0.3 * player.health / 50);
    if (player.driverTemp > 40) eff *= 0.88;
    if (guardrailDamaged) eff *= 0.78;                 // permanently slower
    var wearMul = guardrailDamaged ? 1.6 : 1.0;        // tires wear faster
    var effMax = maxSpeed * Math.max(0.15, eff);

    player.speed = clamp(player.speed, -maxSpeed / 3, effMax);
    player.z += player.speed * dt;

    // Tire wear
    var wearRate = 0.55 * (0.4 + 0.6 * speedPercent);
    wearRate += Math.abs(playerSeg.curve) * speedPercent * 0.6;
    if (player.tirePressure < 1.6 || player.tirePressure > 2.4) wearRate *= 1.8;
    if (level.weather === 'rain') wearRate *= 1.25;    // wet wears faster
    player.tireWear = clamp(player.tireWear + wearRate * dt * wearMul, 0, 100);
    player.blown = player.tireWear >= 100;

    // Tire pressure drift
    player.tirePressure = clamp(player.tirePressure + (Math.random() - 0.5) * 0.02, 1.2, 2.8);

    // Car health
    if (player.blown) player.health -= 18 * dt;
    if (offRoad) player.health -= 5 * dt;
    if (guardrailDamaged) player.health -= 1.5 * dt;   // slowly worse
    player.health = clamp(player.health, 0, 100);

    // Driver body temp
    player.driverTemp += (speedPercent * 0.025 - 0.012) * 10 * dt;
    if (player.speed < maxSpeed * 0.3) player.driverTemp -= 0.06 * 10 * dt;
    player.driverTemp = clamp(player.driverTemp, 36, 42);

    // Pit (long press E inside garage box)
    var inPit = (player.z >= pitStartZ && player.z <= pitEndZ);
    if (inPit && keys.pit) {
      if (!pitAnnounced) { pitAnnounced = true; pitting = true; speak('Changing tires, hold E.'); }
      pitProgress += dt / PIT_TIME;
      if (pitProgress >= 1) {
        player.tireWear = 0; player.tirePressure = 2.0; player.blown = false;
        player.health = clamp(player.health + 8, 0, 100);
        player.speed *= 0.4; pitStops++; pitProgress = 0; pitting = false; pitAnnounced = false;
        pushRadio('Tires changed! Good to go.');
      }
    } else if (!keys.pit) {
      pitting = false; pitAnnounced = false;  // release pauses (progress kept)
    }

    // Collisions with rivals
    handleCollisions();

    // Broken carts (Level 3)
    for (var bc = 0; bc < brokenCarts.length; bc++) {
      var c = brokenCarts[bc];
      if (Math.abs(player.z - c.z) < CAR_LEN && Math.abs(player.x - c.x) < 0.4) {
        endRace(false, 'crashCart'); return;
      }
    }

    // Rival AI
    for (var i = 0; i < competitors.length; i++) {
      var c2 = competitors[i];
      if (!c2.finished) {
        c2.z += c2.speed * dt;
        if (c2.z >= finishZ) { c2.finished = true; c2.finishOrder = ++finishCounter; }
      }
    }

    // Ranking
    var behind = 0;
    for (var j = 0; j < competitors.length; j++) if (competitors[j].z < player.z) behind++;
    player.rank = behind + 1; player.beat = competitors.length - behind;

    // Half-finished 30s countdown
    var halfNeeded = Math.ceil(competitors.length / 2);
    if (halfFinishedTimer < 0 && finishCounter >= halfNeeded) {
      halfFinishedTimer = 30;
      pushRadio('Alert: Half the field finished. Cross the line within 30 seconds!');
    }
    if (halfFinishedTimer >= 0) {
      halfFinishedTimer -= dt;
      if (halfFinishedTimer <= 0) { endRace(false, 'timeout'); return; }
    }

    updateWarnings();
    if (level.weather === 'rain') {
      lightningTimer -= dt;
      if (lightningTimer <= 0) { lightningFlash = 0.18; lightningTimer = 5 + Math.random() * 7; }
    }

    // Health zero or crossed finish
    if (player.health <= 0) { endRace(false, 'breakdown'); return; }
    if (player.z >= finishZ) { player.z = finishZ; player.speed = 0; endRace(true, 'crossed'); return; }
  }

  function handleCollisions() {
    if (collisionCD > 0) return;
    var lvl = level.key;
    var dmg = (lvl === 1 ? 1 : lvl === 2 ? 1.8 : 2.6);
    for (var i = 0; i < competitors.length; i++) {
      var c = competitors[i];
      if (c.finished) continue;
      if (Math.abs(player.z - c.z) < CAR_LEN && Math.abs(player.x - c.x) < CAR_HALF * 2) {
        collisionCD = 0.5;
        var rel = player.speed - c.speed;
        var strong = rel > maxSpeed * 0.25;
        // front car = the one ahead (larger z)
        if (c.z > player.z) {
          // player is behind, hitting c
          c.x += (player.x >= c.x ? 1 : -1) * 0.6; c.x = clamp(c.x, -1.4, 1.4);  // knocked off track
          c.speed *= 0.55; c.health = clamp(c.health - 8 * dmg, 0, 100); c.tireLife = clamp(c.tireLife - 10 * dmg, 0, 100);
          player.speed *= strong ? 0.45 : 0.7;
          player.health = clamp(player.health - 5 * dmg, 0, 100);
          if (strong) { spin = 0.9; pushRadio('Hard hit! Car spinning!'); }
          else pushRadio('Bumped a rival, slight wobble.');
        } else {
          // c is behind, hitting player
          player.x += (c.x >= player.x ? 1 : -1) * 0.6; player.x = clamp(player.x, -1.4, 1.4);
          player.speed *= strong ? 0.5 : 0.75;
          player.health = clamp(player.health - 6 * dmg, 0, 100);
          player.tireWear = clamp(player.tireWear + 6 * dmg, 0, 100);
          c.speed *= 0.55;
          if (strong) { spin = 0.9; pushRadio('Got rear-ended! Car spinning!'); }
          else pushRadio('Tapped from behind!');
        }
        return;
      }
    }
  }

  function updateWarnings() {
    var w = [];
    if (pitting) w.push('CHANGING TIRES ' + Math.floor(pitProgress * 100) + '% (keep holding E)');
    if (player.blown) w.push('Tire blowout! Speed drops, pit now!');
    else if (player.tireWear > 85) w.push('Severe tire wear, pit recommended');
    if (player.tirePressure < 1.6) w.push('Tire pressure too low, wear speeding up');
    else if (player.tirePressure > 2.4) w.push('Tire pressure too high, grip dropping');
    if (player.health < 35) w.push('Car health critical, protect the car');
    if (guardrailHits > 0 && !guardrailDamaged) w.push('Guardrail hits: ' + guardrailHits + '/' + GUARDRAIL_MAX);
    if (guardrailDamaged) w.push('Guardrail damaged: car slower, tires waste faster');
    if (player.driverTemp > 40) w.push('Driver temp too high, slow down (vision blurs)');
    if (offRoadState()) w.push('Off track! Return to the racing line');
    if (level.brokenCarts > 0) w.push('Avoid broken carts on track!');
    if (halfFinishedTimer >= 0) w.push('Finish countdown: ' + Math.ceil(halfFinishedTimer) + 's');
    warnText = w.length ? w.join('  |  ') : 'Vehicle normal, keep your rhythm';
    var el = document.getElementById('warnBox');
    if (el) {
      el.innerHTML = warnText;
      el.className = 'warn' + (w.length ? ' warn-on' : '');
    }
  }
  function offRoadState() { return player && (player.x < -1 || player.x > 1); }

  /* ----------------------------- End race ------------------------------ */
  function endRace(crossed, reason) {
    if (state === 'finished') return;
    state = 'finished';
    var finishedBefore = competitors.filter(function (c) { return c.finished; }).length;
    var beat = competitors.length - finishedBefore;
    var rank = finishedBefore + 1;
    var need = Math.ceil(level.threshold * competitors.length);
    var win = false, title = '', detail = '';

    if (reason === 'crashCart') {
      title = 'Crashed Into Broken Cart';
      detail = 'You hit a broken cart on the track. Race over.';
      speak('Crashed into a broken cart, race over.');
      pushRadio('Crashed into a broken cart!');
    } else if (reason === 'breakdown') {
      title = 'Mechanical Failure';
      detail = 'Health hit zero, did not finish. Next time watch tires and health, pit in time.';
      speak('Car failure, out of the race.');
      pushRadio('Car failure, out of the race.');
    } else if (reason === 'timeout') {
      title = 'Timeout, Did Not Finish';
      detail = 'Half the field crossed, you failed to finish in 30s. You lose.';
      speak('Timeout, race over.');
      pushRadio('Timeout, race over.');
    } else if (crossed) {
      win = (player.health > 0) && (beat >= need);
      if (level.needPit && pitStops < 1) win = false;
      if (win) {
        title = 'You Crossed the Finish Line! You Win!';
        detail = 'Finished P' + rank + ', beat ' + beat + '/' + competitors.length +
                 ' rivals (needed ' + need + ').' +
                 (level.needPit ? (' Pitted ' + pitStops + ' time(s), requirement met.') : '');
        speak('You crossed the finish line, you win!');
        pushRadio('Crossed the finish line! Nice, you won!');
      } else {
        if (level.needPit && pitStops < 1) {
          title = 'Crossed line, but pit requirement not met';
          detail = 'You did cross the finish line, but this level requires at least 1 pit stop (you made ' + pitStops + '), so you lose.';
        } else {
          title = 'Crossed line, but finished too low';
          detail = 'Finished P' + rank + ', only beat ' + beat + '/' + competitors.length + ' rivals (needed ' + need + '), narrow loss.';
        }
        speak('Crossed the line, but finished too low.');
        pushRadio('Crossed the line, but finished too low.');
      }
    }

    resultInfo = { crossed: crossed, win: win, rank: rank, beat: beat, need: need, reason: reason, title: title, detail: detail };
    showResult(resultInfo);
  }

  /* ----------------------------- Rendering ------------------------------ */
  function drawPolygon(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath(); ctx.fill();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function renderSegment(x1, y1, w1, x2, y2, w2, seg) {
    var r1 = rumbleWidth(w1), r2 = rumbleWidth(w2);
    var l1 = laneWidth(w1), l2 = laneWidth(w2);
    var c = seg.color;
    var grass = (level.theme === 'city') ? COLORS.CITYG.grass : (level.theme === 'beach') ? COLORS.SAND.grass : c.grass;
    // grass / sand / city ground
    drawPolygon(0, y2, width, y2, width, y1, 0, y1, grass);
    // gravel tint
    if (seg.gravel) drawPolygon(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, '#8a7d52');
    // rumble
    drawPolygon(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, c.rumble);
    drawPolygon(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, c.rumble);
    // guardrail (just outside rumble)
    drawGuardrail(x1 - w1 - r1 - 6, y1, x2 - w2 - r2 - 6, y2);
    drawGuardrail(x1 + w1 + r1 + 6, y1, x2 + w2 + r2 + 6, y2);
    // road
    if (seg.finish) {
      drawPolygon(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, '#ffffff');
      var cols = 10;
      for (var i = 0; i < cols; i++) {
        var fx1 = x1 - w1 + (2 * w1) * (i / cols);
        var fx2 = x1 - w1 + (2 * w1) * ((i + 1) / cols);
        var fx3 = x2 - w2 + (2 * w2) * ((i + 1) / cols);
        var fx4 = x2 - w2 + (2 * w2) * (i / cols);
        drawPolygon(fx1, y1, fx2, y1, fx3, y2, fx4, y2, i % 2 ? '#111111' : '#ffffff');
      }
    } else {
      drawPolygon(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, c.road);
      if (c.lane) {
        var lanew1 = (w1 * 2) / 3, lanew2 = (w2 * 2) / 3;
        var lx1 = x1 - w1 + lanew1, lx2 = x2 - w2 + lanew2;
        for (var lane = 1; lane < 3; lane++) {
          drawPolygon(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, c.lane);
          lx1 += lanew1; lx2 += lanew2;
        }
      }
    }
    // side props (garage / audience / buildings / sea)
    drawSideProps(seg, x1, y1, w1, x2, y2, w2);
  }

  function drawGuardrail(x1, y1, x2, y2) {
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function drawSideProps(seg, x1, y1, w1, x2, y2, w2) {
    var leftX1 = x1 - w1 - 40, leftX2 = x2 - w2 - 40;
    var rightX1 = x1 + w1 + 40, rightX2 = x2 + w2 + 40;
    if (level.theme === 'grass') {
      // audience stands every ~12 segments
      if (seg.index % 12 === 0) {
        drawStand(leftX1, y1, leftX2, y2); drawStand(rightX1, y1, rightX2, y2);
      }
    } else if (level.theme === 'city') {
      if (seg.index % 8 === 0) {
        drawBuilding(leftX1, y1, leftX2, y2, seg.index); drawBuilding(rightX1, y1, rightX2, y2, seg.index + 3);
      }
    } else if (level.theme === 'beach') {
      // sea on outer side, sand near
      drawPolygon(0, y2, leftX1, y2, leftX1, y1, 0, y1, '#1f6fb0');
      drawPolygon(rightX2, y2, width, y2, width, y1, rightX2, y1, '#1f6fb0');
    }
  }
  function drawStand(x1, y1, x2, y2) {
    ctx.fillStyle = '#444b55'; ctx.fillRect(Math.min(x1, x2) - 20, Math.min(y1, y2) - 26, Math.abs(x2 - x1) + 40, 26);
    for (var i = 0; i < 10; i++) {
      ctx.fillStyle = ['#ffd400', '#fff', '#e23b3b', '#3b7de2'][i % 4];
      ctx.fillRect(Math.min(x1, x2) - 18 + i * 4, Math.min(y1, y2) - 22 + (i % 2) * 4, 3, 3);
    }
  }
  function drawBuilding(x1, y1, x2, y2, seed) {
    var h = 40 + (seed * 37 % 90);
    var bx = Math.min(x1, x2) - 14, by = Math.min(y1, y2) - h;
    ctx.fillStyle = '#2b3240'; ctx.fillRect(bx, by, Math.abs(x2 - x1) + 28, h);
    ctx.fillStyle = '#3a4150';
    for (var wy = by + 6; wy < Math.min(y1, y2) - 4; wy += 12)
      for (var wx = bx + 4; wx < bx + Math.abs(x2 - x1) + 24; wx += 10)
        ctx.fillRect(wx, wy, 5, 7);
  }

  function renderCarSprite(seg, car) {
    var scale = seg.p1.screen.scale;
    if (scale <= 0) return;
    var carW = clamp(seg.p1.screen.w * 0.16, 2, 220);
    var carH = carW * 0.65;
    var sx = seg.p1.screen.x + car.x * seg.p1.screen.w;
    var sy = seg.p1.screen.y;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(sx, sy, carW * 0.55, carH * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = car.color || '#e23b3b';
    roundRect(sx - carW / 2, sy - carH, carW, carH * 0.72, 4); ctx.fill();
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    roundRect(sx - carW * 0.22, sy - carH * 0.95, carW * 0.44, carH * 0.4, 3); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(sx - carW / 2, sy - carH * 1.02, carW, carH * 0.12);
    // rain -> red taillights on
    if (level.weather === 'rain') {
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(sx - carW * 0.42, sy - carH * 0.55, carW * 0.12, carH * 0.18);
      ctx.fillRect(sx + carW * 0.30, sy - carH * 0.55, carW * 0.12, carH * 0.18);
    }
    ctx.fillStyle = '#111';
    ctx.fillRect(sx - carW / 2 - carW * 0.06, sy - carH * 0.5, carW * 0.12, carH * 0.5);
    ctx.fillRect(sx + carW / 2 - carW * 0.06, sy - carH * 0.5, carW * 0.12, carH * 0.5);
  }

  function renderBrokenCart(seg, cart) {
    var scale = seg.p1.screen.scale;
    if (scale <= 0) return;
    var w = clamp(seg.p1.screen.w * 0.22, 2, 260);
    var h = w * 0.6;
    var sx = seg.p1.screen.x + cart.x * seg.p1.screen.w;
    var sy = seg.p1.screen.y;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.6, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a8f96';
    roundRect(sx - w / 2, sy - h, w, h * 0.8, 4); ctx.fill();
    ctx.fillStyle = '#444';
    ctx.fillRect(sx - w / 2, sy - h * 1.1, w, h * 0.3);
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold ' + Math.max(10, h * 0.3) + 'px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', sx, sy - h * 0.7);
  }

  function renderSprite(seg, sprite) {
    var sx = seg.p1.screen.x, sy = seg.p1.screen.y;
    if (sprite.type === 'finish') {
      var bw = seg.p1.screen.w * 2.2, bh = seg.p1.screen.w * 0.55;
      if (bw < 4) return;
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      roundRect(sx - bw / 2, sy - bh - bh * 0.2, bw, bh * 0.5, 6); ctx.fill();
      ctx.fillStyle = '#ffd400'; ctx.font = 'bold ' + Math.max(10, bh * 0.32) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('FINISH LINE', sx, sy - bh * 0.45);
    } else if (sprite.type === 'garage') {
      // company garage building beside the track
      var gw = seg.p1.screen.w * 1.4, gh = seg.p1.screen.w * 0.9;
      if (gw < 6) return;
      var gx = sx - gw - seg.p1.screen.w * 0.5;
      ctx.fillStyle = '#b03a3a'; ctx.fillRect(gx, sy - gh, gw, gh);
      ctx.fillStyle = '#222'; ctx.fillRect(gx + gw * 0.3, sy - gh * 0.8, gw * 0.4, gh * 0.8);
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(9, gh * 0.18) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('TEAM GARAGE', gx + gw / 2, sy - gh - 6);
    } else if (sprite.type === 'pitbox') {
      // rectangle on the ground showing where to stop for tires
      var pw = seg.p1.screen.w * 0.9, ph = Math.max(3, seg.p1.screen.w * 0.08);
      ctx.fillStyle = 'rgba(255,210,0,0.35)';
      ctx.fillRect(sx - pw / 2, sy - ph, pw, ph);
      ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 2;
      ctx.strokeRect(sx - pw / 2, sy - ph, pw, ph);
      ctx.fillStyle = '#ffd400'; ctx.font = 'bold ' + Math.max(9, ph * 1.2) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('STOP & HOLD E', sx, sy - ph / 2);
    }
  }

  function drawSky() {
    var sky = WEATHER_SKY[level ? level.weather : 'sun'];
    var g = ctx.createLinearGradient(0, 0, 0, height * 0.62);
    g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = sky.sun;
    ctx.beginPath(); ctx.arc(width * 0.8, height * 0.22, level && level.weather === 'sun' ? 46 : 30, 0, Math.PI * 2); ctx.fill();
    // distant mountains / city silhouette
    ctx.fillStyle = (level && level.theme === 'city') ? 'rgba(60,70,90,0.6)' : 'rgba(120,160,120,0.5)';
    ctx.beginPath(); ctx.moveTo(0, height * 0.6);
    for (var i = 0; i <= 10; i++) ctx.lineTo(i * width / 10, height * 0.6 - 40 * Math.abs(Math.sin(i * 1.3)));
    ctx.lineTo(width, height * 0.6); ctx.closePath(); ctx.fill();
  }

  function drawCockpit() {
    var dashH = 132;
    var g = ctx.createLinearGradient(0, height - dashH, 0, height);
    g.addColorStop(0, '#1a1d22'); g.addColorStop(1, '#0c0e11');
    ctx.fillStyle = g; ctx.fillRect(0, height - dashH, width, dashH);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, height - dashH, width, 4);
    var cx = width / 2, cy = height - 8, R = 96;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(steerAngle * 0.6);
    ctx.strokeStyle = '#2b2f36'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, -R * 0.9); ctx.lineTo(0, R * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R * 0.75, -R * 0.45); ctx.lineTo(R * 0.75, -R * 0.45); ctx.stroke();
    ctx.fillStyle = '#e23b3b'; ctx.beginPath(); ctx.arc(0, -R * 0.78, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    var kmh = Math.round(player.speed / maxSpeed * 320);
    ctx.fillStyle = '#0a0c0f'; roundRect(width - 250, height - dashH + 18, 230, 96, 10); ctx.fill();
    ctx.fillStyle = '#23e06b'; ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(kmh, width - 30, height - dashH + 52);
    ctx.fillStyle = '#9fb3c8'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('km/h', width - 30, height - dashH + 84);
    var gear = player.speed <= 0 ? (player.speed < -10 ? 'R' : 'N') : String(Math.min(7, 1 + Math.floor(player.speed / (maxSpeed / 7))));
    ctx.fillStyle = '#ffd400'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(gear, width - 238, height - dashH + 52);
    ctx.textAlign = 'left'; ctx.font = '13px sans-serif'; ctx.fillStyle = '#cfe';
    ctx.fillText('Tire Press ' + player.tirePressure.toFixed(2) + '  Wear ' + Math.round(player.tireWear) + '%', 24, height - dashH + 40);
    ctx.fillText('Car health ' + Math.round(player.health) + '  Temp ' + player.driverTemp.toFixed(1) + '°', 24, height - dashH + 64);
  }

  function render() {
    drawSky();
    if (!player) return;

    if (state === 'intro') { drawIntro(); return; }

    var baseSegment = findSegment(player.z);
    var basePercent = percentRemaining(player.z, segmentLength);
    var playerY = interpolate(baseSegment.p1.world.y, baseSegment.p2.world.y, basePercent);
    var maxy = height;
    var x = 0;
    var dx = -(baseSegment.curve * basePercent);
    var effDraw = Math.min(drawDistance, level.fogDist);

    for (var s = 0; s < segments.length; s++) segments[s].cars.length = 0;
    for (var ci = 0; ci < competitors.length; ci++) {
      var c = competitors[ci];
      var idx = Math.floor(c.z / segmentLength);
      if (idx >= baseSegment.index && idx < baseSegment.index + effDraw && idx < segments.length) segments[idx].cars.push(c);
    }
    for (var bc = 0; bc < brokenCarts.length; bc++) {
      var b = brokenCarts[bc];
      var bidx = Math.floor(b.z / segmentLength);
      if (bidx >= baseSegment.index && bidx < baseSegment.index + effDraw && bidx < segments.length) segments[bidx].cars.push({ cart: true, ref: b });
    }

    var n, seg;
    for (n = 0; n < effDraw; n++) {
      seg = segments[baseSegment.index + n];
      if (!seg) break;
      project(seg.p1, player.x * roadWidth - x, playerY + cameraHeight, player.z);
      project(seg.p2, player.x * roadWidth - x - dx, playerY + cameraHeight, player.z);
      x += dx; dx += seg.curve;
      if (seg.p1.camera.z <= cameraDepth || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      renderSegment(seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w, seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, seg);
      maxy = seg.p2.screen.y;
    }
    for (n = effDraw - 1; n >= 0; n--) {
      seg = segments[baseSegment.index + n];
      if (!seg) continue;
      for (var k = 0; k < seg.sprites.length; k++) renderSprite(seg, seg.sprites[k]);
      for (var m = 0; m < seg.cars.length; m++) {
        if (seg.cars[m].cart) renderBrokenCart(seg, seg.cars[m].ref);
        else renderCarSprite(seg, seg.cars[m]);
      }
    }

    drawCockpit();
    if (level.weather === 'rain') drawRain();
    if (level.weather === 'fog') drawFog();
    if (lightningFlash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 0, width, height); }
    if (state === 'countdown') drawCountdown();
    drawMinimap();
    drawVoiceMeter();
  }

  function drawRain() {
    ctx.strokeStyle = 'rgba(200,220,255,0.5)'; ctx.lineWidth = 1.5;
    for (var i = 0; i < rainDrops.length; i++) {
      var d = rainDrops[i];
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y + d.l); ctx.stroke();
      d.y += d.s; d.x -= 1;
      if (d.y > height) { d.y = -10; d.x = Math.random() * width; }
    }
  }
  function drawFog() {
    var g = ctx.createLinearGradient(0, height * 0.25, 0, height * 0.7);
    g.addColorStop(0, 'rgba(220,228,234,0.92)');
    g.addColorStop(1, 'rgba(220,228,234,0.0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
  }

  /* ----------------------------- Intro & countdown ------------------------------ */
  function drawIntro() {
    drawSky();
    var p = clamp(introTimer / INTRO_TIME, 0, 1);
    var ground = (level.theme === 'beach') ? '#d9c98a' : (level.theme === 'city') ? '#3a3f47' : '#2e8b2e';
    ctx.fillStyle = ground; ctx.fillRect(0, height * 0.55, width, height * 0.45);
    // garage building
    var gw = 300, gh = 220, gx = width / 2 - gw / 2, gy = height * 0.55 - gh + 30;
    ctx.fillStyle = '#b03a3a'; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TEAM GARAGE', width / 2, gy - 14);
    // door opens
    var doorH = gh * 0.82 * (1 - p * 0.92);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(gx + gw * 0.22, gy + gh - doorH, gw * 0.56, doorH);
    // car exits
    var carY = gy + gh - 26 + p * 150;
    drawCarShape(width / 2, carY, 1.0, '#e23b3b');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif';
    ctx.fillText(p < 0.6 ? 'Car coming out of the garage...' : 'Getting ready on the track...', width / 2, height * 0.86);
    ctx.fillStyle = '#ffd400'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(level.name + '  ·  ' + level.weather.toUpperCase(), width / 2, height * 0.92);
  }
  function drawCarShape(cx, cy, sc, color) {
    var w = 120 * sc, h = 70 * sc;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + 4, w * 0.55, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; roundRect(cx - w / 2, cy - h, w, h * 0.72, 6); ctx.fill();
    ctx.fillStyle = 'rgba(20,20,30,0.85)'; roundRect(cx - w * 0.22, cy - h * 0.95, w * 0.44, h * 0.4, 3); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(cx - w / 2, cy - h * 1.02, w, h * 0.12);
  }
  function drawCountdown() {
    // F1-style: all 5 red lights come on, then they all go out, then GO!
    var onPhase = countdownTimer < (COUNTDOWN_TIME - 1.0);
    var lightsOn = onPhase ? 5 : 0;
    var cx = width / 2, y = 120, r = 22, gap = 64;
    for (var i = 0; i < 5; i++) {
      var lx = cx - 2 * gap + i * gap;
      ctx.beginPath(); ctx.arc(lx, y, r, 0, Math.PI * 2);
      // bright red when on, with a subtle glow ring while active
      if (i < lightsOn) {
        ctx.fillStyle = '#ff2b2b';
        ctx.shadowColor = 'rgba(255,60,60,0.85)';
        ctx.shadowBlur = 18;
      } else {
        ctx.fillStyle = '#3a1010';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('WAIT FOR THE LIGHTS TO GO OUT', cx, y + 70);
    if (goFlash > 0) {
      ctx.fillStyle = '#23ff7a'; ctx.font = 'bold 90px sans-serif';
      ctx.fillText('GO!', cx, height / 2);
    }
  }

  /* ----------------------------- Minimap ------------------------------ */
  function drawMinimap() {
    if (!trackPath.length) return;
    var mw = 170, mh = 120, mx = width - mw - 16, my = height - mh - 150;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(mx, my, mw, mh, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, mw, mh);
    // normalize
    var minX = 1e9, maxX = -1e9;
    for (var i = 0; i < trackPath.length; i++) { minX = Math.min(minX, trackPath[i].x); maxX = Math.max(maxX, trackPath[i].x); }
    var pad = 14;
    function px(x) { return mx + pad + (x - minX) / (maxX - minX || 1) * (mw - 2 * pad); }
    function py(y) { return my + pad + (y / segments.length) * (mh - 2 * pad); }
    ctx.strokeStyle = '#9fb3c8'; ctx.lineWidth = 2; ctx.beginPath();
    for (var j = 0; j < trackPath.length; j++) {
      var X = px(trackPath[j].x), Y = py(trackPath[j].y * 6);
      if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    // rivals
    for (var c = 0; c < competitors.length; c++) {
      var cc = competitors[c]; if (cc.finished) continue;
      var seg = Math.floor(cc.z / segmentLength);
      if (seg < 0 || seg >= trackPath.length) continue;
      var tp = trackPath[seg];
      ctx.fillStyle = cc.color;
      ctx.beginPath(); ctx.arc(px(tp.x), py(tp.y * 6), 3, 0, Math.PI * 2); ctx.fill();
    }
    // broken carts
    for (var b = 0; b < brokenCarts.length; b++) {
      var seg2 = Math.floor(brokenCarts[b].z / segmentLength);
      if (seg2 < 0 || seg2 >= trackPath.length) continue;
      var tp2 = trackPath[seg2];
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(px(tp2.x) - 2, py(tp2.y * 6) - 2, 4, 4);
    }
    // player (red, labeled)
    var pseg = clamp(Math.floor(player.z / segmentLength), 0, trackPath.length - 1);
    var pt = trackPath[pseg];
    ctx.fillStyle = '#ff2b2b';
    ctx.beginPath(); ctx.arc(px(pt.x), py(pt.y * 6), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2b2b'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('YOU', px(pt.x) + 6, py(pt.y * 6) + 3);
  }

  /* ----------------------------- Voice meter ------------------------------ */
  function drawVoiceMeter() {
    // Square voice-level-meter icon, upper-right, placed just left of the speed panel so it stays visible
    var vs = 54;
    var vx = width - vs - 16 - 170;
    var vy = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(vx, vy, vs, vs);
    ctx.strokeStyle = '#23e0c0'; ctx.lineWidth = 2; ctx.strokeRect(vx, vy, vs, vs);
    ctx.fillStyle = '#23e0c0'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('RADIO', vx + vs / 2, vy + 11);
    var bars = 5, active = speaking && performance.now() < speakUntil;
    for (var i = 0; i < bars; i++) {
      var lvl = active ? (Math.random() * (i + 1) / bars) : 0.1;
      var bh = 4 + lvl * 24;
      ctx.fillStyle = active ? '#23e0c0' : '#33504a';
      ctx.fillRect(vx + 7 + i * 9, vy + vs - 5 - bh, 6, bh);
    }
  }

  /* ----------------------------- HUD ------------------------------ */
  function updateHUD() {
    if (!player) return;
    var kmh = Math.round(player.speed / maxSpeed * 320);
    hudEls.speed.textContent = kmh + ' km/h';
    hudEls.time.textContent = raceTime.toFixed(1) + ' s';
    var remain = Math.max(0, finishZ - player.z);
    hudEls.dist.textContent = Math.round(remain / 10) + ' m';
    hudEls.pressure.textContent = player.tirePressure.toFixed(2);
    hudEls.wear.textContent = Math.round(player.tireWear) + ' %';
    hudEls.life.textContent = Math.round(100 - player.tireWear) + ' %';
    hudEls.health.textContent = Math.round(player.health);
    hudEls.temp.textContent = player.driverTemp.toFixed(1) + ' °C';
    hudEls.rank.textContent = 'Rank ' + player.rank + ' / ' + (competitors.length + 1);
    hudEls.wearBar.style.width = player.tireWear + '%';
    hudEls.healthBar.style.width = player.health + '%';
    hudEls.pressureBar.style.width = clamp((player.tirePressure - 1.2) / 1.6 * 100, 0, 100) + '%';
    // high temp -> blurred vision
    if (player.driverTemp > 40) {
      var b = clamp((player.driverTemp - 40) / 2, 0, 1) * 4;
      canvas.style.filter = 'blur(' + b.toFixed(1) + 'px)';
    } else {
      canvas.style.filter = 'none';
    }
  }

  /* ----------------------------- Main loop ------------------------------ */
  var last = 0, gdt = 0;
  function frame(now) {
    if (!last) last = now;
    var dt = Math.min(1, (now - last) / 1000);
    gdt += dt;
    while (gdt > step) {
      if (state === 'racing') update(step);
      else if (state === 'intro') updateIntro(step);
      else if (state === 'countdown') updateCountdown(step);
      gdt -= step;
    }
    render();
    if (state === 'racing') updateHUD();
    if (speaking && performance.now() > speakUntil) speaking = false;
    last = now;
    requestAnimationFrame(frame);
  }

  /* ----------------------------- Screen switching ------------------------------ */
  function startLevel(key) {
    levelKey = key;
    resetGame(LEVELS[key]);
    state = 'intro'; introTimer = 0;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    document.getElementById('levelTag').textContent = level.name;
    pushRadio('Team radio ready. Entering the track.');
  }
  function restart() { startLevel(levelKey); }
  function backToMenu() {
    state = 'menu';
    document.getElementById('result').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('menu').style.display = 'flex';
  }
  function showResult(info) {
    document.getElementById('hud').style.display = 'none';
    canvas.style.filter = 'none';
    var box = document.getElementById('result');
    box.style.display = 'flex';
    var cls = info.win ? 'win' : (info.crossed ? 'cross' : 'lose');
    box.className = 'overlay ' + cls;
    document.getElementById('resTitle').textContent = info.title;
    document.getElementById('resDetail').textContent = info.detail;
    var stats = 'Level: ' + level.name + '  |  Time ' + raceTime.toFixed(1) + 's  |  Finish ' +
                info.rank + '/' + (competitors.length + 1) + '  |  Beat ' + info.beat + '/' +
                competitors.length + '  |  Pits ' + pitStops + '  |  Guardrail hits ' + guardrailHits;
    document.getElementById('resStats').textContent = stats;
  }

  /* ----------------------------- Init ------------------------------ */
  window.addEventListener('load', function () {
    canvas = document.getElementById('game');
    canvas.width = width; canvas.height = height;
    ctx = canvas.getContext('2d');
    radioBox = document.getElementById('radioBox');
    hudEls = {
      speed: document.getElementById('hudSpeed'), time: document.getElementById('hudTime'),
      dist: document.getElementById('hudDist'), pressure: document.getElementById('hudPressure'),
      wear: document.getElementById('hudWear'), life: document.getElementById('hudLife'),
      health: document.getElementById('hudHealth'), temp: document.getElementById('hudTemp'),
      rank: document.getElementById('hudRank'),
      wearBar: document.getElementById('wearBar'), healthBar: document.getElementById('healthBar'),
      pressureBar: document.getElementById('pressureBar')
    };
    var btns = document.querySelectorAll('.level-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () { startLevel(parseInt(this.dataset.level, 10)); });
    }
    document.getElementById('restartBtn').addEventListener('click', restart);
    document.getElementById('menuBtn').addEventListener('click', backToMenu);
    document.getElementById('muteBtn').addEventListener('click', toggleMute);
    bindInput();
    requestAnimationFrame(frame);
  });

})();
