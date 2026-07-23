/* ============================================================
   HUE KEEPER — Canvas 2D Game Engine
   Track A: Plain JavaScript, no build step, no dependencies
   ============================================================

   COLOR THEORY DATA MODEL
   -----------------------
   Primary colors: Red, Blue, Yellow
   Secondary colors (mixed at fountain):
     Red + Blue  = Purple
     Red + Yellow = Orange
     Blue + Yellow = Green
   Complementary pairs (used to defeat monsters in Level 3):
     Red <-> Green | Blue <-> Orange | Yellow <-> Purple

   GAME LOOP: Observe -> Judge -> Act -> Read Feedback -> Adjust
   ============================================================ */

(function () {
'use strict';

// ===================== COLOR THEORY DATA =====================
// Environment data: defines all colors and their relationships
var COLOR_DATA = {
    red:    { hex: '#E63946', name: 'Red',    complement: 'green'  },
    blue:   { hex: '#457B9D', name: 'Blue',   complement: 'orange' },
    yellow: { hex: '#F4D35E', name: 'Yellow', complement: 'purple' },
    green:  { hex: '#2A9D8F', name: 'Green',  complement: 'red'    },
    orange: { hex: '#F4A261', name: 'Orange', complement: 'blue'   },
    purple: { hex: '#9B5DE5', name: 'Purple', complement: 'yellow' }
};

// Mixing rules — walk over the fountain with two primary colors
var MIX_RULES = {
    'red+blue': 'purple',   'blue+red': 'purple',
    'red+yellow': 'orange', 'yellow+red': 'orange',
    'blue+yellow': 'green', 'yellow+blue': 'green'
};

// ===================== CANVAS SETUP =====================
var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width;   // 960
var H = canvas.height;  // 600

// ===================== AUDIO (Web Audio API) =====================
var audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
}

function playTone(freq, duration, type, volume) {
    if (!audioCtx) return;
    type = type || 'sine';
    volume = volume || 0.15;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function soundCorrect() { playTone(660, 0.15, 'sine', 0.12); setTimeout(function(){ playTone(880, 0.2, 'sine', 0.12); }, 100); }
function soundWrong()   { playTone(150, 0.3, 'sawtooth', 0.1); }
function soundCollect() { playTone(500, 0.08, 'sine', 0.1); setTimeout(function(){ playTone(700, 0.08, 'sine', 0.1); }, 60); }
function soundMix()     { playTone(400, 0.1, 'triangle', 0.1); setTimeout(function(){ playTone(600, 0.1, 'triangle', 0.1); }, 80); setTimeout(function(){ playTone(800, 0.15, 'triangle', 0.1); }, 160); }
function soundDefeat()  { playTone(300, 0.1, 'square', 0.12); setTimeout(function(){ playTone(200, 0.2, 'square', 0.1); }, 80); }
function soundStronger() { playTone(100, 0.4, 'sawtooth', 0.15); }
function soundWin()     { var notes = [523, 659, 784, 1047]; notes.forEach(function(n, i) { setTimeout(function(){ playTone(n, 0.2, 'sine', 0.15); }, i * 120); }); }
function soundLose()    { playTone(200, 0.5, 'sawtooth', 0.15); setTimeout(function(){ playTone(150, 0.6, 'sawtooth', 0.12); }, 200); }

// ===================== GAME STATE =====================
// System-calculated results and player-controlled data live here
var game = {
    state: 'menu',        // menu, playing, win, lose
    level: 1,
    player: null,
    flowers: [],
    frescoPieces: [],
    monsters: [],
    fountain: null,
    particles: [],
    floatingTexts: [],
    keys: {},
    lastTime: 0,
    fadeRate: 0,          // fill level lost per second (0 = no fading)
    hasFilledAny: false,  // tracks if player has ever filled a piece (for lose check)
    monsterSpawnTimer: 0,
    monsterSpawnInterval: 0,
    monsterPool: 0,           // total monsters available to spawn
    monstersRequired: 0,      // minimum defeats needed to win (Level 3)
    currentMaxMonsters: 0,    // active spawn cap (decreases as monsters are defeated)
    totalMonstersDefeated: 0,
    loseReason: '',
    levelStartTime: 0,
    hint: '',
    colorWheelOpen: false,    // Level 3 color-wheel reference overlay
    levelStarted: false       // Level 1 start-screen gate
};

// ===================== LEVEL CONFIG =====================
// Challenge presets — each changes variables, not just decoration
var LEVELS = {
    1: {
        title: 'Level 1 — Color Matching',
        desc: 'Collect colors from flowers and restore the fresco. Match the exact color each piece needs.',
        frescoColors: ['red', 'blue', 'yellow'],
        flowerColors: ['red', 'blue', 'yellow'],
        flowerPositions: [[780, 180], [840, 360], [760, 480]],
        fadeRate: 0,
        monsters: false,
        hint: 'Walk over flowers to collect, then press SPACE near the fresco to splatter!'
    },
    2: {
        title: 'Level 2 — Color Mixing',
        desc: 'The fresco needs secondary colors! Mix two primary colors at the fountain. Each color fades 60s after splattering!',
        frescoColors: ['green', 'orange', 'purple', 'green', 'orange'],
        flowerColors: ['red', 'blue', 'yellow', 'red'],
        flowerPositions: [[780, 160], [850, 280], [790, 400], [860, 500]],
        fadeRate: 1.67,     // 100% / 60s = ~1.67% per second (1 minute to fully fade)
        monsters: false,
        hint: 'Collect TWO primary colors, then walk over the fountain to MIX them!'
    },
    3: {
        title: 'Level 3 — Color Conflict',
        desc: 'Monsters approach! Defeat them with the COMPLEMENTARY (opposite) color. Same color makes them stronger!',
        frescoColors: ['green', 'red', 'orange', 'blue', 'purple', 'yellow'],
        flowerColors: ['red', 'blue', 'yellow', 'green', 'orange'],
        flowerPositions: [[780, 120], [860, 230], [785, 340], [860, 440], [780, 530]],
        fadeRate: 1.67,     // 1 minute to fully fade
        monsters: true,
        monsterSpawnInterval: 5,
        monsterPool: 3,        // total monsters that will spawn across the level
        monstersRequired: 2,   // must defeat at least 2 to win
        monsterColors: ['red', 'blue', 'yellow'],
        hint: 'Defeat at least 2 monsters with COMPLEMENTARY colors AND restore the fresco to win!'
    }
};

// ===================== ENTITIES =====================

// --- Player (Pixie) ---
function createPlayer() {
    return {
        x: 480, y: 350,
        radius: 14,
        speed: 2.8,
        palette: [null, null],  // 2 color slots
        activeSlot: 0,
        glow: 0,
        facing: 0
    };
}

function updatePlayer(p, dt) {
    var dx = 0, dy = 0;
    if (game.keys['ArrowUp']    || game.keys['w'] || game.keys['W']) dy -= 1;
    if (game.keys['ArrowDown']  || game.keys['s'] || game.keys['S']) dy += 1;
    if (game.keys['ArrowLeft']  || game.keys['a'] || game.keys['A']) dx -= 1;
    if (game.keys['ArrowRight'] || game.keys['d'] || game.keys['D']) dx += 1;

    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    p.x += dx * p.speed;
    p.y += dy * p.speed;
    p.x = Math.max(p.radius + 5, Math.min(W - p.radius - 5, p.x));
    p.y = Math.max(p.radius + 50, Math.min(H - p.radius - 70, p.y));

    if (dx !== 0 || dy !== 0) p.facing = Math.atan2(dy, dx);
    p.glow = (p.glow + 0.06) % (Math.PI * 2);
}

function drawPlayer(p) {
    var activeColor = p.palette[p.activeSlot];
    var glowR = p.radius + 5 + Math.sin(p.glow) * 3;

    // Glow aura
    if (activeColor) {
        ctx.save();
        ctx.shadowColor = COLOR_DATA[activeColor].hex;
        ctx.shadowBlur = 18;
    }

    // Wings
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x - 9, p.y - 4, 7, 12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x + 9, p.y - 4, 7, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = activeColor ? COLOR_DATA[activeColor].hex : '#d0c8e0';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(p.x - 4, p.y - 4, p.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    if (activeColor) ctx.restore();
}

// --- Flower ---
function createFlower(x, y, color) {
    return {
        x: x, y: y, color: color, radius: 16,
        charge: 1.0, rechargeRate: 0.2,
        pulse: Math.random() * Math.PI * 2
    };
}

function updateFlower(f, dt) {
    if (f.charge < 1.0) f.charge = Math.min(1.0, f.charge + f.rechargeRate * dt);
    f.pulse += 0.04;
}

function drawFlower(f) {
    var isCharged = f.charge > 0.15;
    var colorHex = isCharged ? COLOR_DATA[f.color].hex : '#555';
    var alpha = f.charge;

    // Stem
    ctx.strokeStyle = '#3a5a40';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y + f.radius);
    ctx.lineTo(f.x, f.y + f.radius + 12);
    ctx.stroke();

    // Leaf
    ctx.fillStyle = '#4a7a50';
    ctx.beginPath();
    ctx.ellipse(f.x + 5, f.y + f.radius + 8, 5, 3, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Petals
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colorHex;
    var petalCount = 6;
    var petalSize = f.radius * (0.85 + Math.sin(f.pulse) * 0.08);
    for (var i = 0; i < petalCount; i++) {
        var angle = (i / petalCount) * Math.PI * 2 + f.pulse * 0.2;
        var px = f.x + Math.cos(angle) * petalSize * 0.55;
        var py = f.y + Math.sin(angle) * petalSize * 0.55;
        ctx.beginPath();
        ctx.ellipse(px, py, petalSize * 0.5, petalSize * 0.3, angle, 0, Math.PI * 2);
        ctx.fill();
    }

    // Center
    ctx.fillStyle = isCharged ? '#FFD700' : '#444';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Color label
    if (isCharged) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(COLOR_DATA[f.color].name, f.x, f.y + f.radius + 26);
    }
}

function tryCollectFlower(f, p) {
    if (f.charge > 0.5) {
        f.charge = 0;
        return f.color;
    }
    return null;
}

// --- Fresco Piece ---
function createFrescoPiece(x, y, w, h, requiredColor) {
    return {
        x: x, y: y, w: w, h: h,
        requiredColor: requiredColor,
        fillLevel: 0,
        isFilled: false,
        glowTime: 0,
        rejectTime: 0,
        fading: false
    };
}

function updateFrescoPiece(fp, dt) {
    if (fp.isFilled && fp.fading) {
        fp.fillLevel -= game.fadeRate * dt;
        if (fp.fillLevel <= 0) {
            fp.fillLevel = 0;
            fp.isFilled = false;
            fp.fading = false;
        }
    }
    if (fp.glowTime > 0) fp.glowTime -= dt;
    if (fp.rejectTime > 0) fp.rejectTime -= dt;
}

function drawFrescoPiece(fp) {
    // Empty/broken background
    ctx.fillStyle = '#3a3340';
    ctx.fillRect(fp.x, fp.y, fp.w, fp.h);

    // Filled color
    if (fp.fillLevel > 0) {
        ctx.globalAlpha = Math.max(0, fp.fillLevel / 100);
        ctx.fillStyle = COLOR_DATA[fp.requiredColor].hex;
        ctx.fillRect(fp.x, fp.y, fp.w, fp.h);
        ctx.globalAlpha = 1;
    }

    // Glow (correct color applied)
    if (fp.glowTime > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (fp.glowTime * 2) + ')';
        ctx.lineWidth = 3;
        ctx.strokeRect(fp.x - 2, fp.y - 2, fp.w + 4, fp.h + 4);
    }

    // Reject flash (wrong color)
    if (fp.rejectTime > 0) {
        ctx.strokeStyle = 'rgba(255,60,60,' + (fp.rejectTime * 2) + ')';
        ctx.lineWidth = 3;
        ctx.strokeRect(fp.x - 2, fp.y - 2, fp.w + 4, fp.h + 4);
    }

    // Border
    ctx.strokeStyle = '#5a5060';
    ctx.lineWidth = 1;
    ctx.strokeRect(fp.x, fp.y, fp.w, fp.h);

    // Required color hint — big bright dot with pulsing glow + label
    if (!fp.isFilled) {
        var cx = fp.x + fp.w / 2;
        var cy = fp.y + fp.h / 2;
        var pulse = 0.8 + 0.2 * Math.sin(performance.now() / 300);
        // Outer glow ring
        ctx.strokeStyle = COLOR_DATA[fp.requiredColor].hex;
        ctx.globalAlpha = 0.4 * pulse;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.stroke();
        // Inner solid dot
        ctx.fillStyle = COLOR_DATA[fp.requiredColor].hex;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Color name label
        ctx.fillStyle = COLOR_DATA[fp.requiredColor].hex;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(COLOR_DATA[fp.requiredColor].name, cx, fp.y + fp.h - 10);
    }
}

function applyColorToFresco(fp, color) {
    if (color === fp.requiredColor) {
        fp.fillLevel = 100;
        fp.isFilled = true;
        fp.fading = game.fadeRate > 0;  // each piece fades individually from the moment it's splattered
        fp.glowTime = 0.6;
        game.hasFilledAny = true;
        return 'correct';
    } else {
        fp.rejectTime = 0.6;
        return 'wrong';
    }
}

// --- Monster ---
function createMonster(x, y, color) {
    return {
        x: x, y: y, color: color, radius: 18,
        speed: 0.8, state: 'unharmed',
        defeatAnim: 0, growAnim: 0,
        wobble: Math.random() * Math.PI * 2,
        spawnAnim: 0
    };
}

function updateMonster(m, dt) {
    if (m.state === 'defeated') {
        m.defeatAnim += dt * 2;
        return;
    }
    if (m.state === 'stronger') m.growAnim += dt;
    m.wobble += 0.05;
    m.spawnAnim = Math.min(1, m.spawnAnim + dt * 3);

    // Move toward player
    var dx = game.player.x - m.x;
    var dy = game.player.y - m.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
        var spd = m.state === 'stronger' ? m.speed * 1.4 : m.speed;
        m.x += (dx / dist) * spd * dt * 60;
        m.y += (dy / dist) * spd * dt * 60;
    }

    // Collision with player = game over
    if (dist < m.radius + game.player.radius) {
        game.state = 'lose';
        game.loseReason = 'Pixie was caught by a monster!';
        soundLose();
    }
}

function drawMonster(m) {
    if (m.state === 'defeated' && m.defeatAnim > 1.2) return;

    var wobbleX = Math.sin(m.wobble) * 2;
    var scale = m.state === 'stronger' ? 1 + Math.min(m.growAnim * 0.2, 0.4) : 1;
    scale *= m.spawnAnim;
    var alpha = m.state === 'defeated' ? Math.max(0, 1 - m.defeatAnim) : m.spawnAnim;

    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(m.x + wobbleX, m.y);

    // Body — blobby organic shape
    ctx.fillStyle = COLOR_DATA[m.color].hex;
    ctx.beginPath();
    var r = m.radius * scale;
    for (var i = 0; i < 10; i++) {
        var angle = (i / 10) * Math.PI * 2;
        var wiggle = Math.sin(m.wobble + i * 0.8) * 3;
        var px = Math.cos(angle) * (r + wiggle);
        var py = Math.sin(angle) * (r + wiggle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Eyes
    if (m.state !== 'defeated' || m.defeatAnim < 0.3) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-6, -3, 4.5, 0, Math.PI * 2);
        ctx.arc(6, -3, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = m.state === 'stronger' ? '#e63946' : '#000';
        ctx.beginPath();
        ctx.arc(-6, -3, 2, 0, Math.PI * 2);
        ctx.arc(6, -3, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Color name label
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(COLOR_DATA[m.color].name, 0, r + 14);

    // State label
    if (m.state === 'stronger') {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('STRONGER!', 0, r + 26);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
}

function attackMonster(m, color) {
    if (m.state === 'defeated') return 'already';
    if (color === COLOR_DATA[m.color].complement) {
        m.state = 'defeated';
        m.defeatAnim = 0;
        game.totalMonstersDefeated++;
        // Shrink the spawn cap so defeated monsters aren't replaced
        if (game.currentMaxMonsters > 0) game.currentMaxMonsters--;
        return 'defeated';
    } else if (color === m.color) {
        m.state = 'stronger';
        return 'stronger';
    } else {
        return 'unharmed';
    }
}

// --- Fountain ---
function createFountain(x, y) {
    return { x: x, y: y, radius: 28, ripple: 0 };
}

function updateFountain(ft, dt) {
    ft.ripple += dt * 1.5;
}

function drawFountain(ft) {
    // Outer basin
    ctx.fillStyle = '#6a7a8a';
    ctx.beginPath();
    ctx.arc(ft.x, ft.y, ft.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner water
    ctx.fillStyle = '#4a90d9';
    ctx.beginPath();
    ctx.arc(ft.x, ft.y, ft.radius - 4, 0, Math.PI * 2);
    ctx.fill();

    // Ripples
    for (var i = 0; i < 3; i++) {
        var progress = ((ft.ripple + i * 0.4) % 1);
        var r = progress * (ft.radius - 4);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 - progress * 0.5) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ft.x, ft.y, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MIX', ft.x, ft.y + 3);
}

function tryMixAtFountain(ft, p) {
    if (p.palette[0] && p.palette[1]) {
        var key = p.palette[0] + '+' + p.palette[1];
        if (MIX_RULES[key]) {
            var mixed = MIX_RULES[key];
            p.palette[0] = mixed;
            p.palette[1] = null;
            p.activeSlot = 0;
            return mixed;
        }
    }
    return null;
}

// ===================== PARTICLES =====================
function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = 1 + Math.random() * 3;
        game.particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: color,
            size: 2 + Math.random() * 3
        });
    }
}

function updateParticles(dt) {
    for (var i = game.particles.length - 1; i >= 0; i--) {
        var p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life -= dt * 2;
        if (p.life <= 0) game.particles.splice(i, 1);
    }
}

function drawParticles() {
    for (var i = 0; i < game.particles.length; i++) {
        var p = game.particles[i];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ===================== FLOATING TEXT =====================
function addFloatingText(x, y, text, color) {
    game.floatingTexts.push({ x: x, y: y, text: text, color: color, life: 1.5, vy: -1 });
}

function updateFloatingTexts(dt) {
    for (var i = game.floatingTexts.length - 1; i >= 0; i--) {
        var ft = game.floatingTexts[i];
        ft.y += ft.vy;
        ft.life -= dt;
        if (ft.life <= 0) game.floatingTexts.splice(i, 1);
    }
}

function drawFloatingTexts() {
    for (var i = 0; i < game.floatingTexts.length; i++) {
        var ft = game.floatingTexts[i];
        ctx.globalAlpha = Math.min(1, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
}

// ===================== LEVEL MANAGEMENT =====================
function loadLevel(levelNum) {
    var config = LEVELS[levelNum];
    if (!config) return;

    game.level = levelNum;
    game.state = 'playing';
    game.player = createPlayer();
    game.flowers = [];
    game.frescoPieces = [];
    game.monsters = [];
    game.particles = [];
    game.floatingTexts = [];
    game.fadeRate = config.fadeRate;
    game.hasFilledAny = false;
    game.monsterSpawnTimer = 0;
    game.monsterPool = config.monsterPool || 0;
    game.monstersRequired = config.monstersRequired || 0;
    game.currentMaxMonsters = config.monsterPool || 0;
    game.totalMonstersDefeated = 0;
    game.loseReason = '';
    game.levelStartTime = 0;
    game.hint = config.hint;
    game.colorWheelOpen = false;
    // Level 1 shows a start screen; other levels begin immediately
    game.levelStarted = (levelNum !== 1);

    // Create fountain in center
    game.fountain = createFountain(480, 300);

    // Create flowers
    for (var i = 0; i < config.flowerColors.length; i++) {
        var pos = config.flowerPositions[i];
        game.flowers.push(createFlower(pos[0], pos[1], config.flowerColors[i]));
    }

    // Create fresco pieces (stacked on left wall, sized to fit)
    var frescoX = 30;
    var pieceCount = config.frescoColors.length;
    var pieceW, pieceH, gap, frescoStartY;
    if (pieceCount <= 3) {
        pieceW = 100; pieceH = 80; gap = 12;
        frescoStartY = 120;
    } else if (pieceCount <= 5) {
        pieceW = 90; pieceH = 68; gap = 10;
        frescoStartY = 80;
    } else {
        pieceW = 90; pieceH = 58; gap = 8;
        frescoStartY = 65;
    }
    for (var j = 0; j < pieceCount; j++) {
        game.frescoPieces.push(createFrescoPiece(
            frescoX, frescoStartY + j * (pieceH + gap),
            pieceW, pieceH, config.frescoColors[j]
        ));
    }
}

// ===================== INPUT HANDLING =====================
window.addEventListener('keydown', function (e) {
    initAudio();
    var key = e.key;
    game.keys[key] = true;

    if (game.state === 'playing') {
        // Level 1 start screen — any movement key, Enter, or Space starts the level
        if (!game.levelStarted) {
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','W','a','A','s','S','d','D','Enter',' '].indexOf(key) !== -1) {
                if (key === ' ') e.preventDefault();
                game.levelStarted = true;
                return;
            }
        }

        // Color wheel toggle (Level 3)
        if (key === 'Escape') {
            if (LEVELS[game.level].monsters) {
                game.colorWheelOpen = !game.colorWheelOpen;
            }
            return;
        }

        // Block gameplay input while the reference overlay is open
        if (game.colorWheelOpen) return;

        // Select palette slot
        if (key === '1') { game.player.activeSlot = 0; playTone(600, 0.05, 'sine', 0.05); }
        if (key === '2') { game.player.activeSlot = 1; playTone(600, 0.05, 'sine', 0.05); }

        // Splatter color
        if (key === ' ') {
            e.preventDefault();
            handleSplatter();
        }

        // Prevent page scroll on arrow keys
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].indexOf(key) !== -1) {
            e.preventDefault();
        }
    }

    // Restart on R when game over / win
    if ((game.state === 'win' || game.state === 'lose') && (key === 'r' || key === 'R')) {
        loadLevel(game.level);
    }

    // Menu: Enter to start
    if (game.state === 'menu' && key === 'Enter') {
        loadLevel(1);
    }
});

window.addEventListener('keyup', function (e) {
    game.keys[e.key] = false;
});

// ===================== ACTION: SPLATTER =====================
function handleSplatter() {
    var p = game.player;
    var color = p.palette[p.activeSlot];

    if (!color) {
        addFloatingText(p.x, p.y - 25, 'No color!', '#ff6666');
        playTone(200, 0.1, 'square', 0.08);
        return;
    }

    // Check monsters first (attack range)
    var closestMonster = null;
    var closestMonsterDist = 65;
    for (var i = 0; i < game.monsters.length; i++) {
        var m = game.monsters[i];
        if (m.state === 'defeated') continue;
        var d = Math.sqrt((m.x - p.x) * (m.x - p.x) + (m.y - p.y) * (m.y - p.y));
        if (d < closestMonsterDist) {
            closestMonsterDist = d;
            closestMonster = m;
        }
    }

    if (closestMonster) {
        var result = attackMonster(closestMonster, color);
        spawnParticles(closestMonster.x, closestMonster.y, COLOR_DATA[color].hex, 12);
        if (result === 'defeated') {
            addFloatingText(closestMonster.x, closestMonster.y - 30, 'DEFEATED!', '#44ff44');
            soundDefeat();
            spawnParticles(closestMonster.x, closestMonster.y, '#ffffff', 8);
        } else if (result === 'stronger') {
            addFloatingText(closestMonster.x, closestMonster.y - 30, 'STRONGER!', '#ff4444');
            soundStronger();
        } else {
            addFloatingText(closestMonster.x, closestMonster.y - 30, 'No effect', '#ffaa00');
            playTone(180, 0.15, 'square', 0.08);
        }
        p.palette[p.activeSlot] = null; // consume color
        return;
    }

    // Check fresco pieces (splatter range)
    var closestPiece = null;
    var closestPieceDist = 90;
    for (var j = 0; j < game.frescoPieces.length; j++) {
        var fp = game.frescoPieces[j];
        if (fp.isFilled) continue;
        var cx = fp.x + fp.w / 2;
        var cy = fp.y + fp.h / 2;
        var fd = Math.sqrt((cx - p.x) * (cx - p.x) + (cy - p.y) * (cy - p.y));
        if (fd < closestPieceDist) {
            closestPieceDist = fd;
            closestPiece = fp;
        }
    }

    if (closestPiece) {
        var frescoResult = applyColorToFresco(closestPiece, color);
        spawnParticles(closestPiece.x + closestPiece.w / 2, closestPiece.y + closestPiece.h / 2, COLOR_DATA[color].hex, 10);
        if (frescoResult === 'correct') {
            addFloatingText(closestPiece.x + closestPiece.w / 2, closestPiece.y - 10, 'Correct!', '#44ff44');
            soundCorrect();
        } else {
            addFloatingText(closestPiece.x + closestPiece.w / 2, closestPiece.y - 10, 'Wrong color!', '#ff4444');
            soundWrong();
        }
        p.palette[p.activeSlot] = null; // consume color
        return;
    }

    // Nothing in range
    addFloatingText(p.x, p.y - 25, 'Nothing to splatter!', '#ffaa00');
    playTone(200, 0.1, 'square', 0.06);
}

// ===================== COLLISION CHECKS =====================
function checkCollisions() {
    var p = game.player;

    // Flower collection
    for (var i = 0; i < game.flowers.length; i++) {
        var f = game.flowers[i];
        var fd = Math.sqrt((f.x - p.x) * (f.x - p.x) + (f.y - p.y) * (f.y - p.y));
        if (fd < p.radius + f.radius && f.charge > 0.5) {
            var collected = tryCollectFlower(f, p);
            if (collected) {
                // Fill first empty slot, or overwrite active slot if both full
                if (!p.palette[0]) { p.palette[0] = collected; p.activeSlot = 0; }
                else if (!p.palette[1]) { p.palette[1] = collected; p.activeSlot = 1; }
                else { p.palette[p.activeSlot] = collected; }
                soundCollect();
                addFloatingText(f.x, f.y - 25, '+' + COLOR_DATA[collected].name, COLOR_DATA[collected].hex);
                spawnParticles(f.x, f.y, COLOR_DATA[collected].hex, 6);
            }
        }
    }

    // Fountain mixing
    if (game.fountain) {
        var ftd = Math.sqrt((game.fountain.x - p.x) * (game.fountain.x - p.x) + (game.fountain.y - p.y) * (game.fountain.y - p.y));
        if (ftd < p.radius + game.fountain.radius) {
            var mixed = tryMixAtFountain(game.fountain, p);
            if (mixed) {
                soundMix();
                addFloatingText(game.fountain.x, game.fountain.y - 35, 'Mixed: ' + COLOR_DATA[mixed].name + '!', COLOR_DATA[mixed].hex);
                spawnParticles(game.fountain.x, game.fountain.y, COLOR_DATA[mixed].hex, 14);
            }
        }
    }
}

// ===================== WIN/LOSE CHECKS =====================
function checkWinLose() {
    if (game.state !== 'playing') return;

    // Win: all fresco pieces filled
    var allFilled = true;
    var pieceCount = game.frescoPieces.length;
    for (var i = 0; i < pieceCount; i++) {
        if (!game.frescoPieces[i].isFilled) allFilled = false;
    }

    // Lose: all fresco pieces have faded to zero after the player filled at least one
    if (game.fadeRate > 0 && game.hasFilledAny && pieceCount > 0) {
        var allEmpty = true;
        for (var k = 0; k < pieceCount; k++) {
            if (game.frescoPieces[k].fillLevel > 0) { allEmpty = false; break; }
        }
        if (allEmpty) {
            game.state = 'lose';
            game.loseReason = 'All fresco colors faded away! Fill them faster next time.';
            soundLose();
            return;
        }
    }

    if (allFilled) {
        // Level 3: must also defeat the required number of monsters
        if (game.monstersRequired > 0 && game.totalMonstersDefeated < game.monstersRequired) {
            // Fresco complete but not enough monsters defeated — don't win yet
            return;
        }
        game.state = 'win';
        soundWin();
    }
}

// ===================== MONSTER SPAWNING =====================
function updateMonsterSpawning(dt) {
    var config = LEVELS[game.level];
    if (!config || !config.monsters) return;

    game.monsterSpawnTimer += dt;
    if (game.monsterSpawnTimer >= config.monsterSpawnInterval) {
        game.monsterSpawnTimer = 0;
        // Stop spawning once the monster pool is exhausted
        if (game.totalMonstersDefeated + game.monsters.length >= game.monsterPool) return;
        // Cap concurrent monsters — shrinks as the player defeats them
        if (game.monsters.length >= game.currentMaxMonsters) return;
        // Spawn from a random edge (right, top, or bottom) so the player
        // can't safely camp on one side — they must sometimes fight through
        var edge = Math.floor(Math.random() * 3);
        var spawnX, spawnY;
        if (edge === 0) {        // right edge
            spawnX = W + 20;
            spawnY = 100 + Math.random() * (H - 250);
        } else if (edge === 1) { // top edge
            spawnX = 200 + Math.random() * (W - 220);
            spawnY = -20;
        } else {                 // bottom edge
            spawnX = 200 + Math.random() * (W - 220);
            spawnY = H + 20;
        }
        var colorIdx = Math.floor(Math.random() * config.monsterColors.length);
        var mColor = config.monsterColors[colorIdx];
        game.monsters.push(createMonster(spawnX, spawnY, mColor));
        addFloatingText(spawnX < W ? spawnX : spawnX - 30, spawnY > H ? H - 30 : spawnY + 20, 'Monster!', COLOR_DATA[mColor].hex);
    }
}

// ===================== BACKGROUND RENDERING =====================
function drawBackground() {
    // Cave area (left)
    var caveGrad = ctx.createLinearGradient(0, 0, 300, 0);
    caveGrad.addColorStop(0, '#2a2038');
    caveGrad.addColorStop(1, '#1e1a2a');
    ctx.fillStyle = caveGrad;
    ctx.fillRect(0, 0, 300, H);

    // Garden area (right)
    var gardenGrad = ctx.createLinearGradient(550, 0, W, 0);
    gardenGrad.addColorStop(0, '#1e2a1e');
    gardenGrad.addColorStop(1, '#243a28');
    ctx.fillStyle = gardenGrad;
    ctx.fillRect(550, 0, W - 550, H);

    // Transition/path area (middle)
    ctx.fillStyle = '#1e1a2a';
    ctx.fillRect(300, 0, 250, H);

    // Cave wall texture (dots)
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (var i = 0; i < 40; i++) {
        var x = (i * 37) % 280;
        var y = (i * 53) % H;
        ctx.beginPath();
        ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
    }

    // Garden grass texture
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (var g = 0; g < 50; g++) {
        var gx = 560 + (g * 29) % (W - 570);
        var gy = (g * 43) % H;
        ctx.fillRect(gx, gy, 1, 4);
    }

    // Divider lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(300, 0); ctx.lineTo(300, H);
    ctx.moveTo(550, 0); ctx.lineTo(550, H);
    ctx.stroke();

    // Area labels
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CAVE / FRESCO', 150, 50);
    ctx.fillText('FOUNTAIN', 480, 50);
    ctx.fillText('GARDEN', 750, 50);
}

// ===================== HUD RENDERING =====================
function drawHUD() {
    // Top bar
    ctx.fillStyle = 'rgba(20,15,30,0.85)';
    ctx.fillRect(0, 0, W, 38);

    ctx.fillStyle = '#e0d5c8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    var config = LEVELS[game.level];
    ctx.fillText(config.title, 12, 24);

    // Progress
    var filled = 0;
    for (var i = 0; i < game.frescoPieces.length; i++) {
        if (game.frescoPieces[i].isFilled) filled++;
    }
    ctx.textAlign = 'center';
    ctx.fillText('Fresco: ' + filled + '/' + game.frescoPieces.length, W / 2, 24);

    // Monsters defeated (level 3) — prominent counter with requirement
    if (config.monsters) {
        ctx.textAlign = 'right';
        var reqMet = game.totalMonstersDefeated >= game.monstersRequired;
        ctx.fillStyle = reqMet ? '#44ff44' : '#ff6b6b';
        ctx.font = 'bold 15px sans-serif';
        // Leave room for the color-wheel tip button on the far right
        ctx.fillText('Monsters: ' + game.totalMonstersDefeated + '/' + game.monsterPool
            + '  (need ' + game.monstersRequired + ')', W - 40, 24);

        // Color-wheel tip button (top-right corner)
        var btnX = W - 28, btnY = 8, btnR = 12;
        ctx.fillStyle = game.colorWheelOpen ? '#e9c46a' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(btnX, btnY + btnR, btnR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = game.colorWheelOpen ? '#fff' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = game.colorWheelOpen ? '#1a1520' : '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', btnX, btnY + btnR + 1);
        ctx.textBaseline = 'alphabetic';
    }

    // Bottom bar — palette & controls
    var barY = H - 52;
    ctx.fillStyle = 'rgba(20,15,30,0.85)';
    ctx.fillRect(0, barY, W, 52);

    // Palette slots
    var p = game.player;
    var slotSize = 36;
    var slotStartX = 16;
    var slotY = barY + 8;

    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';

    for (var s = 0; s < 2; s++) {
        var sx = slotStartX + s * (slotSize + 28);
        // Slot bg
        ctx.fillStyle = p.activeSlot === s ? 'rgba(231,111,81,0.3)' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(sx, slotY, slotSize, slotSize);
        ctx.strokeStyle = p.activeSlot === s ? '#e76f51' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, slotY, slotSize, slotSize);

        // Color fill
        if (p.palette[s]) {
            ctx.fillStyle = COLOR_DATA[p.palette[s]].hex;
            ctx.fillRect(sx + 4, slotY + 4, slotSize - 8, slotSize - 8);
            ctx.fillStyle = '#fff';
            ctx.fillText(COLOR_DATA[p.palette[s]].name, sx + slotSize / 2, slotY + slotSize + 12);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillText('empty', sx + slotSize / 2, slotY + slotSize / 2 + 4);
        }

        // Slot number (prominent key hint)
        ctx.fillStyle = p.activeSlot === s ? '#fff' : 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('key ' + (s + 1), sx + slotSize / 2, slotY - 4);
        ctx.font = 'bold 11px sans-serif';
    }

    // Complement reference (Level 3)
    if (config.monsters) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Complements: Red-Green | Blue-Orange | Yellow-Purple', slotStartX + 100, slotY + 22);
    }

    // Controls hint (right side)
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WASD/Arrows: Move  |  1/2: Switch slot  |  SPACE: Splatter  |  R: Restart', W - 12, barY + 30);

    // Context hint
    if (game.hint && game.levelStartTime < 5) {
        ctx.fillStyle = 'rgba(233,196,106,0.9)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(game.hint, W / 2, barY - 8);
    }

    // Persistent banner: fresco done but still need monster kills
    if (config.monsters && game.totalMonstersDefeated < game.monstersRequired) {
        var allDone = true;
        for (var fi = 0; fi < game.frescoPieces.length; fi++) {
            if (!game.frescoPieces[fi].isFilled) { allDone = false; break; }
        }
        if (allDone) {
            ctx.fillStyle = 'rgba(230,57,70,0.85)';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Fresco restored! Defeat ' + (game.monstersRequired - game.totalMonstersDefeated)
                + ' more monster(s) to win!', W / 2, barY - 8);
        }
    }
}

// ===================== COLOR WHEEL REFERENCE (Level 3) =====================
function drawColorWheel() {
    var cx = W / 2;
    var cy = H / 2;
    var outerR = 130;
    var innerR = 62;
    var segCount = 12;

    // Dim the game underneath
    ctx.fillStyle = 'rgba(10, 8, 16, 0.82)';
    ctx.fillRect(0, 0, W, H);

    // Panel
    ctx.fillStyle = 'rgba(35, 30, 48, 0.95)';
    ctx.strokeStyle = 'rgba(233,196,106,0.5)';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 210, cy - 190, 420, 380);
    ctx.strokeRect(cx - 210, cy - 190, 420, 380);

    // Title
    ctx.fillStyle = '#e9c46a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Color Wheel — Complementary Pairs', cx, cy - 158);

    // 12-segment wheel
    for (var i = 0; i < segCount; i++) {
        var startAngle = (i / segCount) * Math.PI * 2 - Math.PI / 2;
        var endAngle = ((i + 1) / segCount) * Math.PI * 2 - Math.PI / 2;
        var hue = (i * 30) % 360;
        ctx.fillStyle = 'hsl(' + hue + ', 85%, 55%)';
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle, endAngle);
        ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Center hole label
    ctx.fillStyle = '#2a2438';
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0d5c8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Opposite', cx, cy - 6);
    ctx.fillText('colors are', cx, cy + 6);
    ctx.fillText('complements', cx, cy + 18);

    // Complementary pair lines and labels
    var pairs = [
        { a: 0,   b: 180, name: 'Red — Green',     ax: 0,   ay: -1,   bx: 0,   by: 1 },
        { a: 240, b: 60,  name: 'Blue — Orange',   ax: -0.87, ay: 0.5, bx: 0.87, by: -0.5 },
        { a: 120, b: 300, name: 'Yellow — Purple', ax: 0.87, ay: 0.5,  bx: -0.87, by: -0.5 }
    ];
    ctx.lineWidth = 2.5;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    for (var p = 0; p < pairs.length; p++) {
        var pr = pairs[p];
        var x1 = cx + pr.ax * (outerR + 14);
        var y1 = cy + pr.ay * (outerR + 14);
        var x2 = cx + pr.bx * (outerR + 14);
        var y2 = cy + pr.by * (outerR + 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#e0d5c8';
        ctx.fillText(pr.name, cx + (pr.ax + pr.bx) * (outerR + 32) / 2,
            cy + (pr.ay + pr.by) * (outerR + 32) / 2 + 4);
    }

    // Legend
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(cx - 160, cy + 155, 320, 56);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 160, cy + 155, 320, 56);

    ctx.fillStyle = '#a89888';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tip: Use the color directly opposite a monster to defeat it.', cx, cy + 178);
    ctx.fillText('Using the same color as the monster makes it stronger!', cx, cy + 198);

    // Close hint
    ctx.fillStyle = '#e76f51';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Click the ? button or press ESC to close', cx, cy + 228);
}

// ===================== LEVEL 1 START OVERLAY =====================
function drawStartOverlay() {
    // Semi-transparent backdrop
    ctx.fillStyle = 'rgba(10, 8, 16, 0.75)';
    ctx.fillRect(0, 0, W, H);

    // Card
    var cx = W / 2;
    var cy = H / 2 - 30;
    ctx.fillStyle = 'rgba(35, 30, 48, 0.95)';
    ctx.strokeStyle = 'rgba(233,196,106,0.5)';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 240, cy - 110, 480, 220);
    ctx.strokeRect(cx - 240, cy - 110, 480, 220);

    // Title
    ctx.fillStyle = '#e9c46a';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Level 1 — Color Matching', cx, cy - 70);

    // Goal
    ctx.fillStyle = '#e0d5c8';
    ctx.font = '14px sans-serif';
    ctx.fillText('Collect colors from flowers and splatter them onto the fresco.', cx, cy - 42);

    // Movement keys visual
    var keyW = 42, keyH = 34, gap = 8;
    var baseX = cx - (keyW * 3 + gap * 2) / 2;
    var baseY = cy - 5;

    function drawKey(x, y, label, subLabel) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.fillRect(x, y, keyW, keyH);
        ctx.strokeRect(x, y, keyW, keyH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + keyW / 2, y + keyH / 2 + (subLabel ? -5 : 0));
        if (subLabel) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '9px sans-serif';
            ctx.fillText(subLabel, x + keyW / 2, y + keyH / 2 + 8);
        }
        ctx.textBaseline = 'alphabetic';
    }

    // Arrow keys row
    drawKey(baseX + keyW + gap, baseY, '↑', 'Up');
    drawKey(baseX, baseY + keyH + gap, '←', 'Left');
    drawKey(baseX + keyW + gap, baseY + keyH + gap, '↓', 'Down');
    drawKey(baseX + (keyW + gap) * 2, baseY + keyH + gap, '→', 'Right');

    // WASD row
    var wasdBaseX = cx + 40;
    drawKey(wasdBaseX + keyW + gap, baseY, 'W', 'Up');
    drawKey(wasdBaseX, baseY + keyH + gap, 'A', 'Left');
    drawKey(wasdBaseX + keyW + gap, baseY + keyH + gap, 'S', 'Down');
    drawKey(wasdBaseX + (keyW + gap) * 2, baseY + keyH + gap, 'D', 'Right');

    ctx.fillStyle = '#a89888';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Use WASD or Arrow keys to move Pixie', cx, baseY + keyH * 2 + gap + 24);

    // Start button
    var btnW = 140, btnH = 40;
    var btnX = cx - btnW / 2;
    var btnY = cy + 75;
    ctx.fillStyle = 'rgba(231,111,81,0.9)';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#e76f51';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', cx, btnY + btnH / 2 + 1);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#e9c46a';
    ctx.font = '12px sans-serif';
    ctx.fillText('Click START or press any movement key / Enter / Space', cx, btnY + btnH + 22);
}

// ===================== MENU SCREEN =====================
function drawMenu() {
    ctx.fillStyle = '#1a1520';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.textAlign = 'center';
    var titleGrad = ctx.createLinearGradient(W / 2 - 150, 0, W / 2 + 150, 0);
    titleGrad.addColorStop(0, '#e76f51');
    titleGrad.addColorStop(0.33, '#e9c46a');
    titleGrad.addColorStop(0.66, '#2a9d8f');
    titleGrad.addColorStop(1, '#457b9d');
    ctx.fillStyle = titleGrad;
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('HUE KEEPER', W / 2, 140);

    ctx.fillStyle = '#a89888';
    ctx.font = '16px sans-serif';
    ctx.fillText('Restore the fresco. Mix the colors. Defeat the monsters.', W / 2, 175);

    // Level buttons
    ctx.font = 'bold 14px sans-serif';
    var levels = [
        { num: 1, y: 240, title: 'Level 1 — Color Matching', desc: 'Collect and match colors to the fresco' },
        { num: 2, y: 310, title: 'Level 2 — Color Mixing', desc: 'Mix primary colors at the fountain. Beware of fading!' },
        { num: 3, y: 380, title: 'Level 3 — Color Conflict', desc: 'Defeat 2+ monsters with complementary colors AND restore the fresco!' }
    ];

    for (var i = 0; i < levels.length; i++) {
        var lv = levels[i];
        var boxY = lv.y - 20;
        var boxH = 55;
        var isHover = game.menuHover === lv.num;
        ctx.fillStyle = isHover ? 'rgba(231,111,81,0.2)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(W / 2 - 220, boxY, 440, boxH);
        ctx.strokeStyle = isHover ? '#e76f51' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(W / 2 - 220, boxY, 440, boxH);

        ctx.fillStyle = '#e0d5c8';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(lv.title, W / 2 - 200, boxY + 22);

        ctx.fillStyle = '#8a7a6a';
        ctx.font = '12px sans-serif';
        ctx.fillText(lv.desc, W / 2 - 200, boxY + 42);

        ctx.fillStyle = '#e76f51';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Click to Play >', W / 2 + 200, boxY + 32);
    }

    // Color theory reference
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(W / 2 - 280, 460, 560, 90);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeRect(W / 2 - 280, 460, 560, 90);

    ctx.fillStyle = '#e9c46a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COLOR THEORY REFERENCE', W / 2, 482);

    ctx.fillStyle = '#a89888';
    ctx.font = '11px sans-serif';
    ctx.fillText('Mixing: Red+Blue=Purple | Red+Yellow=Orange | Blue+Yellow=Green', W / 2, 505);
    ctx.fillText('Complements (defeat monsters): Red-Green | Blue-Orange | Yellow-Purple', W / 2, 525);

    ctx.fillStyle = '#5a5060';
    ctx.font = '10px sans-serif';
    ctx.fillText('Press ENTER for Level 1, or click a level above', W / 2, 570);
}

// Mouse handling for menu
canvas.addEventListener('mousemove', function (e) {
    if (game.state !== 'menu') return;
    var rect = canvas.getBoundingClientRect();
    var mx = (e.clientX - rect.left) * (W / rect.width);
    var my = (e.clientY - rect.top) * (H / rect.height);

    game.menuHover = null;
    for (var i = 1; i <= 3; i++) {
        var boxY = 240 + (i - 1) * 70 - 20;
        if (mx > W / 2 - 220 && mx < W / 2 + 220 && my > boxY && my < boxY + 55) {
            game.menuHover = i;
            canvas.style.cursor = 'pointer';
            return;
        }
    }
    canvas.style.cursor = 'default';
});

canvas.addEventListener('click', function (e) {
    initAudio();
    var rect = canvas.getBoundingClientRect();
    var mx = (e.clientX - rect.left) * (W / rect.width);
    var my = (e.clientY - rect.top) * (H / rect.height);

    if (game.state === 'menu') {
        for (var i = 1; i <= 3; i++) {
            var boxY = 240 + (i - 1) * 70 - 20;
            if (mx > W / 2 - 220 && mx < W / 2 + 220 && my > boxY && my < boxY + 55) {
                loadLevel(i);
                return;
            }
        }
        return;
    }

    if (game.state === 'playing') {
        // Level 1 start button
        if (!game.levelStarted && game.level === 1) {
            if (mx > W / 2 - 70 && mx < W / 2 + 70 && my > H / 2 + 20 && my < H / 2 + 60) {
                game.levelStarted = true;
                return;
            }
        }

        // Level 3 color-wheel tip button (top-right corner)
        var config = LEVELS[game.level];
        if (config && config.monsters) {
            var btnX = W - 28, btnY = 8, btnR = 12;
            var dx = mx - btnX;
            var dy = my - (btnY + btnR);
            if (dx * dx + dy * dy <= btnR * btnR) {
                game.colorWheelOpen = !game.colorWheelOpen;
                return;
            }
            // Click anywhere else closes an open wheel
            if (game.colorWheelOpen) {
                game.colorWheelOpen = false;
                return;
            }
        }
    }
});

// ===================== WIN/LOSE SCREENS =====================
function drawWinScreen() {
    ctx.fillStyle = 'rgba(20,15,30,0.85)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#2a9d8f';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('LEVEL COMPLETE!', W / 2, H / 2 - 40);

    ctx.fillStyle = '#e0d5c8';
    ctx.font = '16px sans-serif';
    if (game.level === 3) {
        ctx.fillText('Fresco restored and ' + game.totalMonstersDefeated + ' monster(s) defeated!', W / 2, H / 2 + 5);
    } else {
        ctx.fillText('You restored the fresco!', W / 2, H / 2 + 5);
    }

    if (game.level < 3) {
        ctx.fillStyle = '#e9c46a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('Press R to replay, or select the next level from the menu', W / 2, H / 2 + 50);
    } else {
        ctx.fillStyle = '#e76f51';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('Congratulations! You mastered Hue Keeper!', W / 2, H / 2 + 50);
        ctx.fillStyle = '#a89888';
        ctx.font = '13px sans-serif';
        ctx.fillText('Press R to play again', W / 2, H / 2 + 80);
    }
}

function drawLoseScreen() {
    ctx.fillStyle = 'rgba(20,15,30,0.85)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e63946';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 40);

    ctx.fillStyle = '#e0d5c8';
    ctx.font = '15px sans-serif';
    ctx.fillText(game.loseReason, W / 2, H / 2 + 5);

    ctx.fillStyle = '#e9c46a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Press R to try again', W / 2, H / 2 + 50);
}

// ===================== MAIN GAME LOOP =====================
function gameLoop(timestamp) {
    if (!game.lastTime) game.lastTime = timestamp;
    var dt = Math.min((timestamp - game.lastTime) / 1000, 0.05); // cap at 50ms
    game.lastTime = timestamp;

    if (game.state === 'menu') {
        drawMenu();
    } else if (game.state === 'playing') {
        // Level 1 start gate: render the world but do not advance gameplay
        if (!game.levelStarted) {
            drawBackground();
            for (var d = 0; d < game.frescoPieces.length; d++) drawFrescoPiece(game.frescoPieces[d]);
            if (game.fountain) drawFountain(game.fountain);
            for (var df = 0; df < game.flowers.length; df++) drawFlower(game.flowers[df]);
            drawPlayer(game.player);
            drawHUD();
            drawStartOverlay();
            requestAnimationFrame(gameLoop);
            return;
        }

        // Color wheel reference pauses the action so the player can study it
        if (!game.colorWheelOpen) {
            game.levelStartTime += dt;

            // Update entities
            updatePlayer(game.player, dt);
            for (var f = 0; f < game.flowers.length; f++) updateFlower(game.flowers[f], dt);
            for (var fp = 0; fp < game.frescoPieces.length; fp++) updateFrescoPiece(game.frescoPieces[fp], dt);
            for (var m = 0; m < game.monsters.length; m++) updateMonster(game.monsters[m], dt);
            if (game.fountain) updateFountain(game.fountain, dt);
            updateParticles(dt);
            updateFloatingTexts(dt);
            updateMonsterSpawning(dt);

            // Check interactions
            checkCollisions();
            checkWinLose();
        }

        // Draw
        drawBackground();

        // Draw fresco pieces
        for (var d = 0; d < game.frescoPieces.length; d++) drawFrescoPiece(game.frescoPieces[d]);

        // Draw fountain
        if (game.fountain) drawFountain(game.fountain);

        // Draw flowers
        for (var df = 0; df < game.flowers.length; df++) drawFlower(game.flowers[df]);

        // Draw monsters
        for (var dm = 0; dm < game.monsters.length; dm++) drawMonster(game.monsters[dm]);

        // Draw player
        drawPlayer(game.player);

        // Draw particles & floating text
        drawParticles();
        drawFloatingTexts();

        // Draw HUD
        drawHUD();

        // Color wheel reference overlay (Level 3)
        if (game.colorWheelOpen) {
            drawColorWheel();
        }

        // Clean up defeated monsters
        for (var c = game.monsters.length - 1; c >= 0; c--) {
            if (game.monsters[c].state === 'defeated' && game.monsters[c].defeatAnim > 1.5) {
                game.monsters.splice(c, 1);
            }
        }
    } else if (game.state === 'win') {
        // Still draw the game underneath
        drawBackground();
        for (var wf = 0; wf < game.frescoPieces.length; wf++) drawFrescoPiece(game.frescoPieces[wf]);
        if (game.fountain) drawFountain(game.fountain);
        for (var wfl = 0; wfl < game.flowers.length; wfl++) drawFlower(game.flowers[wfl]);
        drawPlayer(game.player);
        drawHUD();
        drawWinScreen();
    } else if (game.state === 'lose') {
        drawBackground();
        for (var lf = 0; lf < game.frescoPieces.length; lf++) drawFrescoPiece(game.frescoPieces[lf]);
        if (game.fountain) drawFountain(game.fountain);
        for (var lfl = 0; lfl < game.flowers.length; lfl++) drawFlower(game.flowers[lfl]);
        for (var lm = 0; lm < game.monsters.length; lm++) drawMonster(game.monsters[lm]);
        drawPlayer(game.player);
        drawHUD();
        drawLoseScreen();
    }

    requestAnimationFrame(gameLoop);
}

// ===================== INITIALIZE =====================
// Expose level selection for external buttons
window.HueKeeper = {
    startLevel: function (n) { initAudio(); loadLevel(n); },
    backToMenu: function () { game.state = 'menu'; }
};

// Start the loop
requestAnimationFrame(gameLoop);

})();
