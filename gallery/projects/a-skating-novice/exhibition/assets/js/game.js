/**
 * A Skating Novice — Game Logic (Top-Down View)
 * ==============================================
 * L1: Straight track (wider), 4 center cones — dodge left/right.
 * L2: S-curve track (wider), 5 center cones — wall collision = instant death.
 * L3: S-curve track (narrow), no cones — wall collision = instant death.
 * Knee bend starts at 0° — skater can't stand on ice until adjusted.
 * Side-view minimap shows knee bend posture.
 */

(function () {
  'use strict';

  // ─── DOM Elements ───────────────────────────────────
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var timerEl = document.getElementById('timer');
  var scoreEl = document.getElementById('score');
  var levelNameEl = document.getElementById('level-name');
  var messageEl = document.getElementById('message');
  var balanceFill = document.getElementById('balance-fill');
  var speedFill = document.getElementById('speed-fill');
  var kneeFill = document.getElementById('knee-fill');
  var kneeSlider = document.getElementById('knee-slider');
  var kneeAngleValue = document.getElementById('knee-angle-value');

  // ─── Constants ──────────────────────────────────────
  var CANVAS_W = 900;
  var CANVAS_H = 500;
  var PLAYER_Y = 400;
  var PLAYER_RADIUS = 14;
  var CONE_RADIUS = 16;
  var COLLISION_DIST = 28;

  // Minimap (side view)
  var MM_X = CANVAS_W - 150;
  var MM_Y = CANVAS_H - 125;
  var MM_W = 140;
  var MM_H = 110;

  // ─── Level Presets ──────────────────────────────────
  var LEVELS = [
    {
      id: 1,
      name: 'Straight Line',
      timeLimit: 35,
      scrollSpeed: 130,
      goalDistance: 1500,
      layout: 'straight',
      trackHalfWidth: 120,
      wallFatal: false,
      obstacles: [
        { dist: 420 },
        { dist: 780 },
        { dist: 1140 },
        { dist: 1380 }
      ]
    },
    {
      id: 2,
      name: 'Winding Path',
      timeLimit: 40,
      scrollSpeed: 150,
      goalDistance: 2400,
      layout: 'curve',
      trackAmplitude: 200,
      trackCycles: 2.0,
      trackHalfWidth: 140,
      straightLeadIn: 400,
      wallFatal: true,
      obstacles: [
        { dist: 650 },
        { dist: 1000 },
        { dist: 1400 },
        { dist: 1800 },
        { dist: 2150 }
      ]
    },
    {
      id: 3,
      name: 'Alpine Slalom',
      timeLimit: 20,
      scrollSpeed: 175,
      goalDistance: 2800,
      layout: 'curve',
      trackAmplitude: 230,
      trackCycles: 2.5,
      trackHalfWidth: 95,
      straightLeadIn: 350,
      wallFatal: true,
      obstacles: []
    }
  ];

  // ─── Game State ─────────────────────────────────────
  var STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', WON: 'won', LOST: 'lost' };
  var gameState = STATE.MENU;
  var currentLevel = 0;
  var timeLeft = 0;
  var gameScore = 0;
  var animationId = null;
  var lastTimestamp = 0;
  var worldOffset = 0;
  var fallReason = '';
  var balancePhase = false;
  var balanceTimer = 0;

  // ─── Player ─────────────────────────────────────────
  var player = {
    x: 450,
    vx: 0,
    kneeBend: 0,
    steerInput: 0
  };

  // ─── System ─────────────────────────────────────────
  var sys = {
    speed: 0,
    stability: 0.5,
    hasFallen: false,
    trail: [],
    totalDistance: 0,
    wobble: 0,
    passedCones: []
  };

  // ─── Track Helpers ──────────────────────────────────
  function getTrackCenterX(dist) {
    var lvl = LEVELS[currentLevel];
    if (lvl.layout === 'straight') return 450;
    var leadIn = lvl.straightLeadIn || 0;
    if (dist < leadIn) return 450;
    var effDist = dist - leadIn;
    var effGoal = lvl.goalDistance - leadIn;
    var t = Math.max(0, Math.min(1, effDist / effGoal));
    return 450 + lvl.trackAmplitude * Math.sin(t * Math.PI * 2 * lvl.trackCycles);
  }

  function getTrackHalfWidth() {
    return LEVELS[currentLevel].trackHalfWidth;
  }

  function hasObstacles() {
    var lvl = LEVELS[currentLevel];
    return lvl.obstacles && lvl.obstacles.length > 0;
  }

  function isWallFatal() {
    return LEVELS[currentLevel].wallFatal;
  }

  // ─── Audio ──────────────────────────────────────────
  var audioCtx = null;
  var glideGain = null;

  function initAudio() {
    if (audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
  }

  function startGlideSound() {
    if (!audioCtx) return;
    try {
      if (!glideGain) {
        glideGain = audioCtx.createGain();
        glideGain.gain.value = 0;
        glideGain.connect(audioCtx.destination);
        var buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.06;
        var src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(glideGain);
        src.start();
      }
      glideGain.gain.setTargetAtTime(0.08, audioCtx.currentTime, 0.05);
    } catch (e) {}
  }

  function stopGlideSound() {
    if (glideGain) {
      try { glideGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15); } catch (e) {}
    }
  }

  function playFallSound() {
    if (!audioCtx) return;
    try {
      var osc = audioCtx.createOscillator(), g = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.5);
      g.gain.setValueAtTime(0.2, audioCtx.currentTime);
      g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
      osc.connect(g); g.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
  }

  function playWinSound() {
    if (!audioCtx) return;
    try {
      [523, 659, 784, 1047].forEach(function (f, i) {
        var osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.value = f;
        g.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.15);
        g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + i * 0.15 + 0.3);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + i * 0.15);
        osc.stop(audioCtx.currentTime + i * 0.15 + 0.3);
      });
    } catch (e) {}
  }

  function playCrashSound() {
    if (!audioCtx) return;
    try {
      var osc = audioCtx.createOscillator(), g = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.25);
      g.gain.setValueAtTime(0.3, audioCtx.currentTime);
      g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
      osc.connect(g); g.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
  }

  // ─── Input ──────────────────────────────────────────
  var keys = {};
  window.addEventListener('keydown', function (e) {
    keys[e.key] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ',',','.','<','>'].indexOf(e.key) !== -1) e.preventDefault();
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  });
  window.addEventListener('keyup', function (e) { keys[e.key] = false; });

  function readInput() {
    player.steerInput = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.steerInput = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) player.steerInput = 1;

    if (kneeSlider) {
      var cur = parseInt(kneeSlider.value);
      if (keys['ArrowUp'] || keys['w'] || keys['W']) kneeSlider.value = Math.min(180, cur + 2);
      if (keys['ArrowDown'] || keys['s'] || keys['S']) kneeSlider.value = Math.max(0, cur - 2);
    }

    // Speed multiplier: < (comma) to slow down, > (period) to speed up
    if (keys[','] || keys['<']) player.speedMult = Math.max(0.3, player.speedMult - 0.02);
    if (keys['.'] || keys['>']) player.speedMult = Math.min(2.5, player.speedMult + 0.02);
  }

  // ═════════════════════════════════════════════════════
  //  UPDATE
  // ═════════════════════════════════════════════════════
  function update(dt) {
    if (gameState !== STATE.PLAYING) return;
    dt = Math.min(dt, 0.05);
    var lvl = LEVELS[currentLevel];
    var halfW = getTrackHalfWidth();

    readInput();

    // Knee bend from slider
    var targetKnee = kneeSlider ? parseInt(kneeSlider.value) / 180 : 0;
    player.kneeBend += (targetKnee - player.kneeBend) * 8 * dt;
    var kneeDeg = player.kneeBend * 180;

    // ── BALANCE PHASE ──────────────────────────────────
    if (balancePhase) {
      var kneeOpt = 1 - Math.abs(player.kneeBend - 0.5) * 2;
      sys.stability += (Math.pow(Math.max(0, kneeOpt), 1.5) - sys.stability) * 4 * dt;
      sys.wobble = (1 - sys.stability) * 8;
      sys.speed = 0;

      if (sys.stability > 0.35) {
        balanceTimer += dt;
        if (balanceTimer > 0.8) {
          balancePhase = false;
          if (hasObstacles()) {
            showMsg('Balance found! Skate forward and dodge the cones!');
          } else {
            showMsg('Balance found! Skate forward and stay on the track!');
          }
        }
      } else {
        balanceTimer = 0;
      }
      return;
    }

    // ═══════════════════════════════════════════════════
    //  NORMAL GAMEPLAY
    // ═══════════════════════════════════════════════════

    // --- Horizontal movement ---
    player.vx += (player.steerInput * 480 - player.vx * 5.5) * dt;
    player.x += player.vx * dt;
    player.x = Math.max(60, Math.min(840, player.x));

    // --- Track boundary ---
    var trackCX = getTrackCenterX(worldOffset);
    var leftB = trackCX - halfW;
    var rightB = trackCX + halfW;

    if (player.x < leftB || player.x > rightB) {
      if (isWallFatal()) {
        loseGame('You hit the wall! Press R to retry');
        playCrashSound();
        return;
      } else {
        player.x = Math.max(leftB, Math.min(rightB, player.x));
        player.vx *= 0.2;
        sys.stability -= 1.5 * dt;
      }
    }

    // --- Stability ---
    var kneeOpt2 = 1 - Math.abs(player.kneeBend - 0.5) * 2;
    var targetStab = Math.max(0, Math.pow(Math.max(0, kneeOpt2), 1.5) - Math.abs(player.vx) / 800 * 0.15);
    sys.stability += (targetStab - sys.stability) * 3 * dt;

    // Extreme knee bend penalty
    if (kneeDeg >= 170 && !sys.hasFallen) sys.stability -= 8 * dt;
    sys.stability = Math.max(0, Math.min(1, sys.stability));
    sys.wobble = (1 - sys.stability) * 5;

    // --- Speed (always auto-advance) ---
    // More knee bend = slower movement
    var kneeSpeedFactor = 1 - player.kneeBend * 0.65;
    var targetSpeed = (35 + sys.stability * 130) * kneeSpeedFactor * player.speedMult;
    sys.speed += (targetSpeed - sys.speed) * 3 * dt;
    sys.speed = Math.max(0, sys.speed);

    // --- World scroll ---
    worldOffset += sys.speed * dt;
    sys.totalDistance += sys.speed * dt;

    // --- Cone collision & bypass ---
    if (hasObstacles()) {
      for (var i = 0; i < lvl.obstacles.length; i++) {
        var obs = lvl.obstacles[i];
        var obsScreenY = PLAYER_Y - (obs.dist - worldOffset);
        if (Math.abs(obsScreenY - PLAYER_Y) < COLLISION_DIST) {
          var coneX = getTrackCenterX(obs.dist);
          if (Math.abs(player.x - coneX) < PLAYER_RADIUS + CONE_RADIUS) {
            loseGame('You hit a cone! Press R to retry');
            playCrashSound();
            return;
          }
        }
        // Track bypass
        if (!sys.passedCones[i] && obs.dist <= worldOffset) {
          var dx = Math.abs(player.x - getTrackCenterX(obs.dist));
          sys.passedCones[i] = dx >= 38; // bypassed if far enough
        }
      }
    }

    // --- Fall check ---
    if (sys.stability < 0.05 && !sys.hasFallen) {
      var reason = kneeDeg >= 170 ? 'Knees too bent!' : kneeDeg < 20 ? 'Legs too straight!' : 'Lost balance!';
      loseGame(reason + ' Press R to retry');
      playFallSound();
      return;
    }

    // --- Trail ---
    if (sys.trail.length === 0 || worldOffset - sys.trail[sys.trail.length - 1].worldY > 12) {
      sys.trail.push({ worldY: worldOffset, x: player.x });
    }
    if (sys.trail.length > 80) sys.trail.shift();

    // --- Timer ---
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      loseGame("Time's up! Press R to retry");
      return;
    }

    // --- Goal ---
    if (worldOffset >= lvl.goalDistance) {
      if (hasObstacles()) {
        var missed = [];
        for (var j = 0; j < lvl.obstacles.length; j++) {
          if (!sys.passedCones[j]) missed.push(j + 1);
        }
        if (missed.length > 0) {
          loseGame('Missed cone(s) #' + missed.join(', ') + '! Go around EVERY cone. Press R to retry');
          return;
        }
      }
      winGame();
    }

    startGlideSound();
  }

  function loseGame(reason) {
    sys.hasFallen = true;
    sys.speed = 0;
    sys.stability = 0;
    gameState = STATE.LOST;
    fallReason = reason;
    stopGlideSound();
    showMsg(reason);
  }

  function winGame() {
    gameState = STATE.WON;
    stopGlideSound();
    playWinSound();
    var timeBonus = Math.floor(timeLeft * 10);
    var stabAvg = sys.trail.length > 0
      ? sys.trail.reduce(function (s, t) { return s + (t.stability || 0.5); }, 0) / sys.trail.length
      : 0.5;
    gameScore = Math.max(0, timeBonus + Math.floor(stabAvg * 300));
    showMsg('You made it! Great skating!');
  }

  // ═════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════
  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawSnowBG();
    drawIceTrack();
    drawTrackBoundaries();
    drawTrackCenterLine();
    drawDirectionArrows();
    drawObstacles();
    drawTrail();
    drawPlayerTopDown();
    drawGoalLine();
    drawEdgeWarning();
    drawOverlayMessages();
    drawMinimapSideView();
    updateUI();
  }

  function drawSnowBG() {
    var g = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    g.addColorStop(0, '#e3e6ea'); g.addColorStop(0.5, '#eef0f3'); g.addColorStop(1, '#e0e3e7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = 'rgba(190,198,208,0.35)';
    var seed = Math.floor(worldOffset * 0.3);
    for (var sx = 10; sx < CANVAS_W; sx += 28) {
      for (var sy = ((seed + sx) % 36); sy < CANVAS_H; sy += 36) {
        ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawIceTrack() {
    var lvl = LEVELS[currentLevel], hw = getTrackHalfWidth(), step = 8;
    var dS = Math.max(0, worldOffset - 60), dE = Math.min(lvl.goalDistance, worldOffset + CANVAS_H + 60);

    ctx.beginPath();
    for (var d = dS; d <= dE; d += step) {
      var cx = getTrackCenterX(d), sy = PLAYER_Y - (d - worldOffset);
      d === dS ? ctx.moveTo(cx - hw, sy) : ctx.lineTo(cx - hw, sy);
    }
    for (var d2 = dE; d2 >= dS; d2 -= step) {
      var cx2 = getTrackCenterX(d2), sy2 = PLAYER_Y - (d2 - worldOffset);
      ctx.lineTo(cx2 + hw, sy2);
    }
    ctx.closePath();

    var ig = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    ig.addColorStop(0, '#c8dce8'); ig.addColorStop(0.3, '#dceaf2');
    ig.addColorStop(0.7, '#e8f0f5'); ig.addColorStop(1, '#d4e4ee');
    ctx.fillStyle = ig; ctx.fill();

    ctx.strokeStyle = 'rgba(180,200,215,0.22)'; ctx.lineWidth = 1;
    for (var d3 = Math.floor(dS / 40) * 40; d3 <= dE; d3 += 40) {
      var cx3 = getTrackCenterX(d3), sy3 = PLAYER_Y - (d3 - worldOffset);
      if (sy3 < -10 || sy3 > CANVAS_H + 10) continue;
      ctx.beginPath(); ctx.moveTo(cx3 - hw + 12, sy3); ctx.lineTo(cx3 + hw - 12, sy3); ctx.stroke();
    }
  }

  function drawTrackBoundaries() {
    var lvl = LEVELS[currentLevel], hw = getTrackHalfWidth(), step = 10;
    var dS = Math.max(0, worldOffset - 60), dE = Math.min(lvl.goalDistance, worldOffset + CANVAS_H + 60);
    var fatal = isWallFatal();

    // Outer glow
    ctx.strokeStyle = fatal ? 'rgba(230,57,70,0.28)' : 'rgba(230,57,70,0.15)';
    ctx.lineWidth = fatal ? 10 : 7;
    for (var side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      for (var d = dS; d <= dE; d += step) {
        var cx = getTrackCenterX(d), sy = PLAYER_Y - (d - worldOffset);
        d === dS ? ctx.moveTo(cx + side * hw, sy) : ctx.lineTo(cx + side * hw, sy);
      }
      ctx.stroke();
    }

    // Dashed line
    ctx.strokeStyle = '#e63946'; ctx.lineWidth = 2.5; ctx.setLineDash([14, 6]);
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      ctx.beginPath();
      for (var d2 = dS; d2 <= dE; d2 += step) {
        var cx2 = getTrackCenterX(d2), sy2 = PLAYER_Y - (d2 - worldOffset);
        d2 === dS ? ctx.moveTo(cx2 + s2 * hw, sy2) : ctx.lineTo(cx2 + s2 * hw, sy2);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawTrackCenterLine() {
    var lvl = LEVELS[currentLevel], step = 15;
    var dS = Math.max(0, worldOffset - 60), dE = Math.min(lvl.goalDistance, worldOffset + CANVAS_H + 60);
    ctx.strokeStyle = 'rgba(120,160,180,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([12, 18]);
    ctx.beginPath();
    for (var d = dS; d <= dE; d += step) {
      var cx = getTrackCenterX(d), sy = PLAYER_Y - (d - worldOffset);
      d === dS ? ctx.moveTo(cx, sy) : ctx.lineTo(cx, sy);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }

  function drawDirectionArrows() {
    var lvl = LEVELS[currentLevel];
    var dS = Math.max(0, worldOffset - 60), dE = Math.min(lvl.goalDistance, worldOffset + CANVAS_H + 60);
    for (var d = Math.floor(dS / 180) * 180 + 90; d < dE; d += 180) {
      var cx = getTrackCenterX(d), ay = PLAYER_Y - (d - worldOffset);
      if (ay < 10 || ay > CANVAS_H - 10) continue;
      ctx.fillStyle = 'rgba(20,100,90,0.45)';
      ctx.beginPath(); ctx.moveTo(cx, ay - 8); ctx.lineTo(cx - 6, ay + 6); ctx.lineTo(cx + 6, ay + 6); ctx.closePath();
      ctx.fill();
    }
    var startY = PLAYER_Y - (0 - worldOffset);
    if (startY > -10 && startY < CANVAS_H + 10) {
      ctx.fillStyle = '#2a9d8f'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('START', getTrackCenterX(0), startY + 20);
    }
  }

  function drawEdgeWarning() {
    if (gameState !== STATE.PLAYING || balancePhase) return;
    var hw = getTrackHalfWidth(), tcx = getTrackCenterX(worldOffset);
    var thresh = isWallFatal() ? 28 : 18;
    var dists = [player.x - (tcx - hw), (tcx + hw) - player.x];
    var pY = PLAYER_Y;
    for (var i = 0; i < 2; i++) {
      if (dists[i] < thresh) {
        var a = Math.max(0, (1 - dists[i] / thresh)) * (isWallFatal() ? 0.85 : 0.5);
        ctx.fillStyle = 'rgba(230,57,70,' + a + ')';
        ctx.fillRect((i === 0 ? tcx - hw : tcx + hw) - 5, pY - 18, 10, 36);
      }
    }
  }

  function drawObstacles() {
    if (!hasObstacles()) return;
    var lvl = LEVELS[currentLevel];
    for (var i = 0; i < lvl.obstacles.length; i++) {
      var obs = lvl.obstacles[i];
      var cx = getTrackCenterX(obs.dist), sy = PLAYER_Y - (obs.dist - worldOffset);
      if (sy < -40 || sy > CANVAS_H + 40) continue;

      ctx.save(); ctx.translate(cx, sy);
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.ellipse(2, 2, CONE_RADIUS + 2, CONE_RADIUS * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      // Cone body
      var pulse = 1 + Math.sin(worldOffset * 0.02 + obs.dist * 0.01) * 0.05;
      ctx.fillStyle = '#e85d04';
      ctx.beginPath(); ctx.arc(0, 0, CONE_RADIUS * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, CONE_RADIUS * 0.6 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f77f00';
      ctx.beginPath(); ctx.arc(0, 0, CONE_RADIUS * 0.35 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9d0208'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, CONE_RADIUS * pulse, 0, Math.PI * 2); ctx.stroke();
      // Passed indicator
      if (sys.passedCones[i] !== undefined) {
        ctx.fillStyle = sys.passedCones[i] ? 'rgba(42,157,143,0.85)' : 'rgba(230,57,70,0.85)';
        ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(sys.passedCones[i] ? '\u2713' : '\u2717', 0, CONE_RADIUS + 12);
      }
      ctx.restore();
    }
  }

  function drawTrail() {
    if (sys.trail.length < 2) return;
    // Glow
    ctx.strokeStyle = 'rgba(42,157,143,0.25)'; ctx.lineWidth = 8;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    var first = true;
    for (var i = 0; i < sys.trail.length; i++) {
      var t = sys.trail[i], sy = PLAYER_Y - (t.worldY - worldOffset);
      if (sy < 0 || sy > CANVAS_H) continue;
      if (first) { ctx.moveTo(t.x, sy); first = false; } else ctx.lineTo(t.x, sy);
    }
    ctx.stroke();
    // Main trail
    ctx.lineWidth = 3.5;
    var s = sys.stability;
    ctx.strokeStyle = s > 0.5
      ? 'rgba(42,157,143,' + (0.5 + s * 0.4) + ')'
      : 'rgba(230,57,70,' + (0.3 + (1 - s) * 0.5) + ')';
    ctx.beginPath(); first = true;
    for (var j = 0; j < sys.trail.length; j++) {
      var tp = sys.trail[j], sy2 = PLAYER_Y - (tp.worldY - worldOffset);
      if (sy2 < 0 || sy2 > CANVAS_H) continue;
      if (first) { ctx.moveTo(tp.x, sy2); first = false; } else ctx.lineTo(tp.x, sy2);
    }
    ctx.stroke();
  }

  function drawPlayerTopDown() {
    var px = player.x, py = PLAYER_Y;
    ctx.save(); ctx.translate(px, py);
    var wx = (Math.random() - 0.5) * sys.wobble, wy = (Math.random() - 0.5) * sys.wobble;
    ctx.translate(wx, wy);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(2, 4, 11, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = '#2a9d8f'; ctx.strokeStyle = '#1d3557'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -2, 5, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Head
    ctx.fillStyle = '#ffcdb2';
    ctx.beginPath(); ctx.arc(0, -12, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1d3557'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#1d3557';
    ctx.beginPath(); ctx.arc(0, -12, 5, Math.PI, 0); ctx.fill();
    // Arms
    ctx.strokeStyle = '#264653'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-5, -4); ctx.lineTo(-15, -1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -4); ctx.lineTo(15, -1); ctx.stroke();
    // Legs
    var kd = player.kneeBend * 180, ls = 3 + (kd > 90 ? (kd - 90) / 90 * 6 : 0);
    ctx.strokeStyle = '#1d3557'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-2 + ls * 0.3, 4); ctx.lineTo(-ls, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2 - ls * 0.3, 4); ctx.lineTo(ls, 14); ctx.stroke();
    // Skates
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-ls - 5, 16); ctx.lineTo(-ls + 5, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ls - 5, 16); ctx.lineTo(ls + 5, 14); ctx.stroke();
    // Arrow
    ctx.fillStyle = 'rgba(29,53,87,0.5)';
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-5, -15); ctx.lineTo(5, -15); ctx.closePath(); ctx.fill();
    // Fallen
    if (sys.hasFallen) {
      ctx.fillStyle = 'rgba(230,57,70,0.7)';
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('X', 0, 0);
    }
    ctx.restore();
  }

  function drawGoalLine() {
    var lvl = LEVELS[currentLevel], gy = PLAYER_Y - (lvl.goalDistance - worldOffset);
    if (gy < -20 || gy > CANVAS_H + 20) return;
    var hw = getTrackHalfWidth(), gcx = getTrackCenterX(lvl.goalDistance);
    var gL = gcx - hw, gR = gcx + hw, seg = 14;
    for (var x = gL; x < gR; x += seg) {
      ctx.fillStyle = (Math.floor((x - gL) / seg) % 2 === 0) ? '#fff' : '#1d3557';
      ctx.fillRect(x, gy - 5, seg, 10);
    }
    ctx.fillStyle = '#e63946'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('FINISH', gcx, gy - 14);
  }

  // ── Minimap: Side View ──────────────────────────────
  function drawMinimapSideView() {
    var kd = player.kneeBend * 180;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
    roundRect(MM_X, MM_Y, MM_W, MM_H, 6); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Side View — Posture', MM_X + MM_W / 2, MM_Y + 12);

    var cx = MM_X + MM_W / 2 - 5, baseY = MM_Y + MM_H - 14;
    var headR = 7, torsoLen = 24, thighLen = 20, shinLen = 18;
    var torsoLean = 25 * Math.PI / 180;

    var neckX = cx + Math.sin(torsoLean) * (torsoLen * 0.3), neckY = baseY - shinLen - thighLen - torsoLen;
    var hipX = cx + Math.sin(torsoLean) * torsoLen * 0.5, hipY = baseY - shinLen - thighLen;

    // Torso outline
    ctx.strokeStyle = '#2a9d8f'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(neckX + Math.sin(torsoLean) * 4, neckY); ctx.stroke();
    // Torso box
    ctx.fillStyle = '#2a9d8f'; ctx.strokeStyle = '#1d3557'; ctx.lineWidth = 1;
    ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(-torsoLean);
    ctx.fillRect(-3, -torsoLen, 6, torsoLen); ctx.strokeRect(-3, -torsoLen, 6, torsoLen); ctx.restore();

    // Head
    ctx.fillStyle = '#ffcdb2'; ctx.beginPath(); ctx.arc(neckX, neckY - headR, headR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1d3557'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#1d3557'; ctx.beginPath(); ctx.arc(neckX, neckY - headR, headR + 1, Math.PI, 0); ctx.fill();

    // Legs
    var thighAngle = (kd / 180) * 80 * Math.PI / 180;
    var kneeX = hipX + Math.sin(thighAngle) * thighLen, kneeY = hipY + Math.cos(thighAngle) * thighLen;
    var shinAngle = -0.3;
    var footX = kneeX + Math.sin(shinAngle) * shinLen, footY = kneeY + Math.cos(shinAngle) * shinLen;

    ctx.strokeStyle = '#264653'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.strokeStyle = '#457b9d'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();

    // Knee joint
    ctx.fillStyle = '#1d3557'; ctx.beginPath(); ctx.arc(kneeX, kneeY, 3, 0, Math.PI * 2); ctx.fill();
    // Knee angle arc
    ctx.strokeStyle = 'rgba(255,200,100,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(kneeX, kneeY, 10, -Math.PI / 2 - thighAngle, -Math.PI / 2, false); ctx.stroke();

    // Skate
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(footX - 5, footY + 3); ctx.lineTo(footX + 5, footY + 1); ctx.stroke();

    // Ice line
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(MM_X + 15, baseY + 2); ctx.lineTo(MM_X + MM_W - 15, baseY + 2); ctx.stroke(); ctx.setLineDash([]);

    // Label
    ctx.fillStyle = '#ffc864'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(kd + '\u00B0', MM_X + MM_W - 10, MM_Y + MM_H - 14);

    // Arm
    ctx.strokeStyle = '#264653'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(neckX + Math.sin(torsoLean) * 3, neckY + 3);
    ctx.lineTo(neckX + Math.sin(torsoLean) * 3 - 12, neckY + 11); ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ─── Overlays ───────────────────────────────────────
  function drawOverlayMessages() {
    if (gameState === STATE.PLAYING && balancePhase) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, CANVAS_H / 2 - 55, CANVAS_W, 70);
      ctx.fillStyle = '#ffc864'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('\u26A0 You can\'t stand on ice with straight legs!', CANVAS_W / 2, CANVAS_H / 2 - 25);
      ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
      ctx.fillText('Use \u2191 \u2193 arrows or the slider to adjust Knee Bend Angle', CANVAS_W / 2, CANVAS_H / 2 - 3);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '12px sans-serif';
      ctx.fillText("Don't worry — you won't fall during this phase. Find your balance!", CANVAS_W / 2, CANVAS_H / 2 + 17);
    }

    // Level 3 tip: knee bend + turning
    if (gameState === STATE.PLAYING && !balancePhase && currentLevel === 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(10, 8, 390, 40, 6); ctx.fill();
      ctx.fillStyle = '#ffc864'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('\u26A0 Tip: Adjust knee bend AND turn at the same time!', 22, 28);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '11px sans-serif';
      ctx.fillText('More knee bend = slower speed \u2192 use it to control your pace!', 22, 43);
    }

    if (gameState === STATE.PAUSED) {
      overlay('PAUSED', 'Press P to resume');
    } else if (gameState === STATE.WON) {
      overlay('LEVEL COMPLETE!', 'Score: ' + gameScore + ' — Press R to continue');
    } else if (gameState === STATE.LOST) {
      overlay('GAME OVER', fallReason);
    } else if (gameState === STATE.MENU) {
      overlay('A SKATING NOVICE', 'Select a level and press SPACE to start');
      var lvl = LEVELS[currentLevel];
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Level ' + lvl.id + ': ' + lvl.name, CANVAS_W / 2, CANVAS_H / 2 + 40);
      if (hasObstacles()) {
        ctx.fillText('Dodge the center cones! Miss any = Game Over', CANVAS_W / 2, CANVAS_H / 2 + 58);
      } else {
        ctx.fillText('\u2620 Stay on the S-curve track — hitting the wall is GAME OVER!', CANVAS_W / 2, CANVAS_H / 2 + 58);
      }
    }
  }

  function overlay(title, subtitle) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 15);
    ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(subtitle, CANVAS_W / 2, CANVAS_H / 2 + 25);
  }

  // ─── UI ─────────────────────────────────────────────
  function updateUI() {
    var m = Math.floor(timeLeft / 60), s = Math.floor(timeLeft % 60);
    timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    scoreEl.textContent = gameScore;
    levelNameEl.textContent = 'Lv' + (currentLevel + 1) + ': ' + LEVELS[currentLevel].name;

    balanceFill.style.width = (sys.stability * 100) + '%';
    balanceFill.style.background = sys.stability > 0.5
      ? 'hsl(' + (sys.stability * 120) + ', 70%, 45%)' : 'hsl(0, 70%, 50%)';
    speedFill.style.width = Math.min(sys.speed / 200, 1) * 100 + '%';
    kneeFill.style.width = (player.kneeBend * 100) + '%';

    if (kneeAngleValue) {
      kneeAngleValue.textContent = Math.round(player.kneeBend * 180) + '\u00B0';
      kneeAngleValue.className = 'angle-value neutral';
    }

    if (gameState === STATE.WON) messageEl.textContent = 'Cleared! Score: ' + gameScore;
    else if (gameState === STATE.LOST) messageEl.textContent = fallReason;
    else if (balancePhase) messageEl.textContent = '\u26A0 Adjust your knee bend to stand on the ice!';
    else messageEl.textContent = '';
  }

  // ─── Lifecycle ──────────────────────────────────────
  function resetGame(level) {
    var lvl = LEVELS[level];
    worldOffset = 0;
    player.x = getTrackCenterX(0);
    player.vx = 0;
    player.kneeBend = 0;
    player.steerInput = 0;
    player.speedMult = 1.0;
    sys.speed = 0;
    sys.stability = 0.5;
    sys.hasFallen = false;
    sys.trail = [];
    sys.totalDistance = 0;
    sys.wobble = 0;
    sys.passedCones = [];
    timeLeft = lvl.timeLimit;
    gameScore = 0;
    fallReason = '';
    balancePhase = false;
    balanceTimer = 0;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    if (kneeSlider) kneeSlider.value = 0;
    updateUI();
  }

  function startGame() {
    resetGame(currentLevel);
    balancePhase = true;
    balanceTimer = 0;
    player.x = getTrackCenterX(0);
    gameState = STATE.PLAYING;
    lastTimestamp = performance.now();
    stopGlideSound();
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    messageEl.textContent = '';
    if (!animationId) animationId = requestAnimationFrame(gameLoop);
  }

  function gameLoop(timestamp) {
    try {
      var dt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0.016;
      lastTimestamp = timestamp;
      if (gameState === STATE.PLAYING) update(dt);
      draw();
      if (gameState === STATE.PLAYING || gameState === STATE.PAUSED) {
        animationId = requestAnimationFrame(gameLoop);
      } else {
        draw(); animationId = null;
      }
    } catch (e) {
      console.error('Game loop error:', e);
      gameState = STATE.LOST;
      sys.hasFallen = true;
      sys.speed = 0;
      sys.stability = 0;
      fallReason = 'Error — Press R to retry';
      showMsg(fallReason);
      animationId = null;
    }
  }

  function togglePause() {
    if (gameState === STATE.PLAYING) { gameState = STATE.PAUSED; stopGlideSound(); }
    else if (gameState === STATE.PAUSED) { gameState = STATE.PLAYING; lastTimestamp = performance.now(); }
  }

  function showMsg(msg) { messageEl.textContent = msg; }

  // ─── Buttons ────────────────────────────────────────
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-restart').addEventListener('click', function () {
    stopGlideSound(); resetGame(currentLevel); gameState = STATE.MENU; draw(); messageEl.textContent = '';
  });

  document.querySelectorAll('.level-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var lvl = parseInt(this.dataset.level);
      currentLevel = lvl;
      document.querySelectorAll('.level-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      stopGlideSound(); resetGame(lvl); gameState = STATE.MENU; draw(); messageEl.textContent = '';
    });
  });

  // ─── Keyboard ───────────────────────────────────────
  window.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.code === 'Space') { if (gameState === STATE.MENU) startGame(); }
    if (e.key === 'p' || e.key === 'P') { if (gameState === STATE.PLAYING || gameState === STATE.PAUSED) togglePause(); }
    if (e.key === 'r' || e.key === 'R') {
      if (gameState === STATE.WON || gameState === STATE.LOST) {
        stopGlideSound(); resetGame(currentLevel); gameState = STATE.MENU; draw(); messageEl.textContent = '';
      }
    }
    if (e.key === '1') switchLevel(0);
    if (e.key === '2') switchLevel(1);
    if (e.key === '3') switchLevel(2);
  });

  function switchLevel(idx) {
    currentLevel = idx;
    document.querySelectorAll('.level-btn').forEach(function (b, i) { b.classList.toggle('active', i === idx); });
    stopGlideSound(); resetGame(idx); gameState = STATE.MENU; draw(); messageEl.textContent = '';
  }

  if (kneeSlider) kneeSlider.addEventListener('input', function () {});

  // ─── Init ───────────────────────────────────────────
  resetGame(0); gameState = STATE.MENU; draw();
})();
