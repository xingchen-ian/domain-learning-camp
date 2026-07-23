/* =============================================================
   PASSWORD — Chemistry Escape Room  V5 (Scenario + Sound + KI Fix)
   game.js — Canvas 2D top-down escape room with real chemistry puzzles
   Style: Surreal Cute + Real-world lab scenarios + Sound effects
   Pure vanilla JS, no build step (Track A)
   ============================================================= */
'use strict';

// ============== Canvas & World ==============
var canvas = document.getElementById('game-canvas');
var ctx = canvas.getContext('2d');
var TILE = 32;
var COLS = 32;
var ROWS = 20;
var W = COLS * TILE; // 1024
var H = ROWS * TILE; // 640

// ============== Sound System (Web Audio API — synthesized, no external files) ==============
var AudioCtx = window.AudioContext || window.webkitAudioContext;
var audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new AudioCtx(); } catch(e) { return false; }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return true;
}

// Synthesized sound effects — pure Web Audio, zero external dependencies
function playSound(type) {
  if (!ensureAudio()) return;
  var ctx = audioCtx;
  var t = ctx.currentTime;

  function tone(freq, start, dur, vol, type, fadeOut) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.15, t + start);
    if (fadeOut !== false) gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t + start);
    osc.stop(t + start + dur + 0.05);
  }

  function noise(start, dur, vol) {
    var buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (vol || 0.1);
    var src = ctx.createBufferSource();
    var gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.setValueAtTime(vol || 0.08, t + start);
    gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.8;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t + start);
    src.stop(t + start + dur + 0.05);
  }

  switch (type) {
    case 'pickup-correct':
      // Pleasant rising chime for correct chemical pickup
      tone(523, 0, 0.10, 0.18, 'sine');
      tone(659, 0.08, 0.10, 0.18, 'sine');
      tone(784, 0.16, 0.20, 0.20, 'sine');
      break;

    case 'pickup-wrong':
      // Buzzy low error sound
      tone(180, 0, 0.15, 0.15, 'sawtooth');
      tone(150, 0.08, 0.20, 0.12, 'sawtooth');
      noise(0, 0.25, 0.05);
      break;

    case 'damage':
      // Alarm-like descending tone
      tone(600, 0, 0.08, 0.20, 'square');
      tone(400, 0.06, 0.12, 0.18, 'square');
      tone(250, 0.12, 0.18, 0.15, 'square');
      noise(0, 0.20, 0.04);
      break;

    case 'note-read':
      // Soft paper rustle + gentle ding
      noise(0, 0.08, 0.03);
      tone(880, 0.05, 0.12, 0.08, 'sine');
      break;

    case 'lab-success':
      // Ascending satisfying chime
      tone(440, 0, 0.10, 0.15, 'sine');
      tone(554, 0.08, 0.10, 0.15, 'sine');
      tone(659, 0.16, 0.10, 0.15, 'sine');
      tone(880, 0.24, 0.25, 0.18, 'sine');
      break;

    case 'lab-fail':
      // Descending error buzz
      tone(400, 0, 0.08, 0.13, 'sawtooth');
      tone(300, 0.06, 0.10, 0.13, 'sawtooth');
      tone(200, 0.12, 0.20, 0.12, 'sawtooth');
      noise(0, 0.22, 0.05);
      break;

    case 'exit-open':
      // Magical portal opening — sparkly ascending arpeggio
      tone(330, 0, 0.10, 0.10, 'sine');
      tone(415, 0.07, 0.10, 0.10, 'sine');
      tone(523, 0.14, 0.10, 0.12, 'sine');
      tone(659, 0.21, 0.10, 0.12, 'sine');
      tone(784, 0.28, 0.10, 0.14, 'sine');
      tone(1047, 0.35, 0.35, 0.16, 'sine');
      break;

    case 'win':
      // Victory fanfare — triumphant ascending sequence
      tone(523, 0, 0.15, 0.16, 'sine');
      tone(659, 0.12, 0.15, 0.16, 'sine');
      tone(784, 0.24, 0.15, 0.18, 'sine');
      tone(1047, 0.36, 0.50, 0.22, 'sine');
      // Harmony
      tone(392, 0.24, 0.30, 0.10, 'triangle');
      tone(523, 0.36, 0.30, 0.10, 'triangle');
      break;

    case 'lose':
      // Sad descending tone
      tone(440, 0, 0.20, 0.13, 'sine');
      tone(370, 0.15, 0.20, 0.12, 'sine');
      tone(277, 0.30, 0.40, 0.12, 'sine');
      noise(0.3, 0.15, 0.04);
      break;

    case 'level-start':
      // Level intro — short energetic hit
      tone(440, 0, 0.08, 0.12, 'square');
      tone(660, 0.06, 0.08, 0.12, 'square');
      tone(880, 0.12, 0.20, 0.15, 'square');
      break;

    case 'celebration':
      // Big victory fanfare — ascending arpeggio with rich harmonics
      tone(523, 0, 0.25, 0.14, 'triangle');
      tone(659, 0.08, 0.25, 0.14, 'triangle');
      tone(784, 0.16, 0.25, 0.14, 'triangle');
      tone(1047, 0.24, 0.35, 0.16, 'triangle');
      tone(1319, 0.30, 0.30, 0.14, 'triangle');
      tone(1568, 0.36, 0.40, 0.12, 'triangle');
      // Harmony layer
      tone(392, 0, 0.50, 0.08, 'sine');
      tone(523, 0.15, 0.35, 0.08, 'sine');
      tone(659, 0.30, 0.30, 0.08, 'sine');
      // Sparkle
      tone(2093, 0.50, 0.15, 0.06, 'sine');
      tone(2637, 0.58, 0.15, 0.06, 'sine');
      tone(3136, 0.66, 0.25, 0.05, 'sine');
      break;
  }
}

// ============== BGM System (cheerful 8-bit Snake-style background music) ==============
var BGM = {
  active: false,
  timerID: null,
  nextNoteTime: 0,
  noteIndex: 0,
  stepTime: 0.17,       // seconds per note — snappy tempo
  scheduleAhead: 0.25,  // schedule notes this far ahead
  lookahead: 50,        // scheduler checks every 50ms
  volume: 0.05,         // quiet background, won't overpower SFX

  // Cheerful Snake-like melody in C major pentatonic
  melody: [
    523, 659, 784, 880, 784, 659, 523, 440,
    494, 523, 587, 659, 587, 523, 494, 440,
    392, 440, 494, 523, 587, 659, 587, 523,
    494, 440, 392, 330, 392, 440, 523, 523,
  ],

  playTone: function(freq, startTime) {
    if (!audioCtx) return;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    var dur = BGM.stepTime * 0.85;
    gain.gain.setValueAtTime(BGM.volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.03);
  },

  scheduler: function() {
    if (!BGM.active || !audioCtx) return;
    while (BGM.nextNoteTime < audioCtx.currentTime + BGM.scheduleAhead) {
      var freq = BGM.melody[BGM.noteIndex];
      BGM.noteIndex = (BGM.noteIndex + 1) % BGM.melody.length;
      BGM.playTone(freq, BGM.nextNoteTime);
      BGM.nextNoteTime += BGM.stepTime;
    }
  },

  start: function() {
    if (BGM.active) return;
    if (!ensureAudio()) return;
    BGM.active = true;
    BGM.noteIndex = 0;
    BGM.nextNoteTime = audioCtx.currentTime + 0.1;
    BGM.scheduler();
    if (BGM.timerID) clearInterval(BGM.timerID);
    BGM.timerID = setInterval(BGM.scheduler, BGM.lookahead);
  },

  stop: function() {
    BGM.active = false;
    if (BGM.timerID) {
      clearInterval(BGM.timerID);
      BGM.timerID = null;
    }
  },
};

// ============== Color palette (Surreal Cute) ==============
var PAL = {
  bgTop:       '#f3e8ff',
  bgBot:       '#e0f7fa',
  floor1:      '#fff0f6',
  floor2:      '#f3e8ff',
  wall:        '#c8a2e6',
  wallEdge:    '#9c7bbd',
  wallTop:     '#e1c4f0',
  player:      '#ff8fab',
  playerEdge:  '#ff5d8f',
  playerEye:   '#4a2c5a',
  npc:         '#b388eb',
  npcEdge:     '#8b5fbf',
  npcEye:      '#3d1f5e',
  npcAlert:    '#ff6b6b',
  lab:         '#7fd9a0',
  labEdge:     '#4caf7d',
  exitOpen:    '#64d2ff',
  exitClosed:  '#b0bec5',
  itemGlow:    '#ffd93d',
  itemDecoy:   '#e0e0e0',
  heart:       '#ff6b9d',
  star:        '#ffd93d',
  text:        '#4a2c5a',
  textLight:   '#7b6b8a',
  note:        '#fffde7',
  noteEdge:    '#e0d6a0',
};

// ============== Level configuration (V5 — Real scenarios + Sound) ==============
var LEVELS = {
  1: {
    name: '急救中和',
    subtitle: 'HCl + NaOH → NaCl + H₂O',
    difficulty: '中等',
    time: 60, hp: 3,
    npcCount: 2, npcSpeed: 0.6, npcBehavior: 'chase',
    recipe: { chemicals: ['HCl', 'NaOH'], tools: ['mix'] },
    reaction: 'HCl + NaOH → NaCl + H₂O',
    reactionType: '中和反应 (Neutralization)',
    clue: '要平息灼烧的烧杯，将盐酸与强碱结合吧。盐和水将会诞生。',
    // === Real scenario context ===
    story: {
      title: '急救室 — 酸灼伤病例',
      intro: '一名学生在化学实验中泼洒了盐酸（HCl），造成化学灼伤，被紧急送往急救室。解药是用碱快速中和。找到 NaOH 和 HCl —— 在灼伤恶化之前将它们混合（60 秒）。酸雾会引来麻烦——快行动！',
      win: '中和成功！生成了 NaCl（食盐）和 H₂O。病人安全了。',
      lose: '酸灼伤扩散了。中和太慢了——皮肤损伤已不可逆……',
    },
    notes: [
      '急救手册 #1："HCl 是强酸（pH ≈ 1）。皮肤接触导致蛋白质变性——迅速灼伤。"',
      '急救手册 #2："NaOH 是强碱。等摩尔酸 + 碱 = 盐 + 水。这就是中和反应。"',
      '急救手册 #3："该反应放热！HCl + NaOH → NaCl + H₂O 释放热量。小心混合。"',
    ],
  },
  2: {
    name: '废水处理',
    subtitle: 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄',
    difficulty: '困难',
    time: 50, hp: 3,
    npcCount: 3, npcSpeed: 0.8, npcBehavior: 'chase',
    recipe: { chemicals: ['CuSO4', 'NaOH'], tools: ['mix', 'filter', 'heat'] },
    reaction: 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄',
    reactionType: '沉淀反应 (Precipitation)',
    clue: '蓝色溶液含有铜。加入强碱——固体将从液体中析出。过滤分离，然后加热干燥。',
    story: {
      title: '工厂场景 — 工业废水',
      intro: '一家纺织厂向河中排放了硫酸铜（CuSO₄）——河水变成了诡异的蓝色，鱼类正在死亡。作为水处理化学家，你必须将铜沉淀出来。向蓝色 CuSO₄ 溶液中加入 NaOH → 过滤 Cu(OH)₂ 沉淀 → 加热干燥。河流的命运掌握在你手中（50 秒）！',
      win: '铜以 Cu(OH)₂ 形式沉淀并被滤出。河水重新清澈了！',
      lose: '铜仍然溶解在水中。河流生态系统被摧毁了……',
    },
    notes: [
      '实验报告 #1："CuSO₄ 溶于水形成亮蓝色溶液。Cu²⁺ 离子对水生生物有毒。"',
      '实验报告 #2："向 CuSO₄ 加入 NaOH 生成 Cu(OH)₂ —— 一种蓝绿色胶状沉淀。这是关键步骤。"',
      '实验报告 #3："过滤将固体 Cu(OH)₂ 与液体 Na₂SO₄ 分离。然后加热干燥沉淀物以安全处理。"',
      '实验报告 #4："警告：不要加入错误的化学品——Cu²⁺ 已经够危险了。"',
    ],
  },
  3: {
    name: '暗房银回收',
    subtitle: 'AgNO₃ + NaCl → AgCl↓  |  AgNO₃ + KI → AgI↓',
    difficulty: '极限',
    time: 60, hp: 3,
    npcCount: 4, npcSpeed: 1.0, npcBehavior: 'chase',
    recipe: { chemicals: ['AgNO3', 'NaCl', 'KI'], tools: ['mix', 'filter', 'heat', 'evaporate'] },
    reaction: 'AgNO₃ + NaCl → AgCl↓ + NaNO₃  |  AgNO₃ + KI → AgI↓ + KNO₃',
    reactionType: '复分解反应 (Double Displacement)',
    clue: '硝酸银与氯化物和碘化物盐都能反应。每种生成不同颜色的沉淀——白色和黄色。混合、过滤、加热，然后蒸发得到最终产物。',
    story: {
      title: '暗房场景 — 摄影银回收',
      intro: '在一间复古摄影暗房中，硝酸银（AgNO₃）定影液非常珍贵——但如果直接倒掉则剧毒无比。回收银！加入 NaCl → 生成白色 AgCl 沉淀。再加入 KI → 生成黄色 AgI 沉淀。按顺序完成全部 4 个操作（混合 → 过滤 → 加热 → 蒸发）。60 秒——暗房计时器正在滴答作响！',
      win: '银回收成功！AgCl（白色）和 AgI（黄色）都对光敏感——请保存在暗盒中。暗房安全了。',
      lose: '银流失了。没有正确回收，有毒的银离子正在污染水源……',
    },
    notes: [
      '暗房笔记 #1："AgNO₃ 是摄影胶片的关键试剂。它对光敏感——动作要快。"',
      '暗房笔记 #2："AgCl 是白色凝乳状沉淀。AgI 是黄色的。两者都是摄影中使用的卤化银。"',
      '暗房笔记 #3："复分解反应：Ag⁺ 与 Na⁺ 或 K⁺ 交换。每次银都会沉淀出来。"',
      '暗房笔记 #4："完整流程：混合试剂 → 过滤沉淀物 → 加热干燥 → 蒸发剩余溶剂。"',
      '暗房笔记 #5："碘化钾（KI）生成黄色 AgI。没有它，只能回收一半的银。"',
    ],
  }
};

// ============== Chemical library ==============
var CHEMICALS = {
  'HCl':   { name: '盐酸',      formula: 'HCl',   color: '#f9e79f', emoji: '🟡', type: '酸',   desc: '强酸，pH ≈ 1' },
  'NaOH':  { name: '氢氧化钠',   formula: 'NaOH',  color: '#f0f0f0', emoji: '⚪', type: '碱',   desc: '强碱（烧碱），pH ≈ 13' },
  'CuSO4': { name: '硫酸铜',     formula: 'CuSO₄', color: '#5dade2', emoji: '🔵', type: '盐',   desc: '蓝色溶液，金属盐' },
  'AgNO3': { name: '硝酸银',     formula: 'AgNO₃', color: '#d5d8dc', emoji: '🥄', type: '盐',   desc: '光敏银盐' },
  'NaCl':  { name: '氯化钠',     formula: 'NaCl',  color: '#f8f8ff', emoji: '🧂', type: '盐',   desc: '常见食盐' },
  'KI':    { name: '碘化钾',     formula: 'KI',    color: '#c39bd3', emoji: '🟣', type: '盐',   desc: '碘源，与 AgNO₃ 反应' },
  'H2O':   { name: '水',        formula: 'H₂O',   color: '#aed6f1', emoji: '💧', type: '溶剂', desc: '万能溶剂' },
  'H2SO4': { name: '硫酸',      formula: 'H₂SO₄', color: '#f5b7b1', emoji: '🔴', type: '酸',   desc: '强二元酸' },
  'Na2SO4':{ name: '硫酸钠',     formula: 'Na₂SO₄',color: '#e8e8e8', emoji: '⬜', type: '盐',   desc: '中和反应副产物' },
  'KNO3':  { name: '硝酸钾',     formula: 'KNO₃',  color: '#fadbd8', emoji: '🌸', type: '盐',   desc: '硝石，氧化剂' },
};

var TOOLS = {
  mix:       { name: '混合',   key: '1', icon: '🌀', desc: '合并反应物' },
  filter:    { name: '过滤',   key: '2', icon: '🌈', desc: '分离沉淀物' },
  heat:      { name: '加热',   key: '3', icon: '🔥', desc: '施加热能' },
  evaporate: { name: '蒸发',   key: '4', icon: '💨', desc: '去除溶剂' },
};

// ============== Game state ==============
var G = null;

function newGame(levelId) {
  var cfg = LEVELS[levelId];
  G = {
    level: levelId,
    status: 'playing',
    timeLeft: cfg.time,
    maxTime: cfg.time,
    hp: cfg.hp,
    maxHp: cfg.hp,
    deaths: 0,
    chemicalsUsed: 0,
    wrongPicks: 0,
    startTime: performance.now(),
    elapsedTime: 0,
    endTime: 0,
    player: { x: 2 * TILE + TILE / 2, y: 2 * TILE + TILE / 2, r: 12, dir: 'down', invuln: 0, bounce: 0 },
    lab: {
      step: 0,
      collected: [],
      usedChemicals: [],
      phases: [],
      recipeDone: false,
      beakerContent: [],
    },
    recipe: cfg.recipe,
    items: [],
    npcs: [],
    notes: [],
    readNotes: [],
    activeNote: null,
    particles: [],
    bubbles: [],
    floaties: [],
    damageFlash: 0,
    shake: 0,
    hint: '',
    hintTimer: 0,
    banner: { text: cfg.name, sub: cfg.story.title + ' • ' + cfg.difficulty + ' • ' + cfg.time + 's', timer: 3.0 }
  };
  buildLevel();
  spawnFloaties();
  setHint(cfg.story.intro);
  updateHUD();
  showBanner();
  playSound('level-start');
  setTimeout(function() { if (G && G.banner) G.banner.timer = 0; }, 3000);
  BGM.start();
}

// ============== Hint system ==============
function setHint(text) {
  if (!G) return;
  G.hint = text;
  G.hintTimer = 5;
  var el = document.getElementById('objective-hint');
  if (el) {
    el.textContent = text;
    el.classList.add('show');
  }
}

function updateHint() {
  if (!G || G.status !== 'playing') return;
  var collected = G.lab.collected.length;
  var recipeCount = G.recipe.chemicals.length;
  var recipeCollected = G.recipe.chemicals.filter(function(c) { return G.lab.collected.indexOf(c) >= 0; }).length;

  if (G.lab.recipeDone) {
    setHint('反应完成！找到出口传送门！');
  } else if (G.readNotes.length === 0 && collected === 0) {
    setHint('地上的纸条藏着化学线索。走过去按 E 阅读。');
  } else if (recipeCollected < recipeCount && collected > 0) {
    setHint('你已经有了一些化学品。阅读纸条找出还需要什么。');
  } else if (recipeCollected >= recipeCount) {
    setHint('材料齐全。去实验台（⚗️）按 E 操作。');
  } else {
    setHint('四处探索，收集材料，仔细阅读纸条。');
  }
}

// ============== Map / level layout (V5 — fixed decoy/recipe overlap) ==============
function buildLevel() {
  var lvl = G.level;
  var map = [];
  for (var r = 0; r < ROWS; r++) {
    var row = [];
    for (var c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        row.push(1);
      } else {
        row.push(0);
      }
    }
    map.push(row);
  }

  // --- Level 1 walls ---
  if (lvl >= 1) {
    for (r = 4; r <= 6; r++) map[r][10] = 1;
    for (c = 10; c <= 13; c++) map[6][c] = 1;
    for (r = 8; r <= 11; r++) map[r][6] = 1;
    for (r = 12; r <= 15; r++) map[r][20] = 1;
    for (c = 20; c <= 23; c++) map[15][c] = 1;
  }

  // --- Level 2 walls ---
  if (lvl >= 2) {
    for (r = 3; r <= 5; r++) map[r][22] = 1;
    for (c = 22; c <= 25; c++) map[5][c] = 1;
    for (r = 9; r <= 14; r++) map[r][8] = 1;
    for (c = 8; c <= 11; c++) map[14][c] = 1;
    for (r = 9; r <= 11; r++) map[r][14] = 1;
    for (r = 15; r <= 17; r++) map[r][12] = 1;
    for (c = 24; c <= 27; c++) map[8][c] = 1;
  }

  // --- Level 3 walls ---
  if (lvl >= 3) {
    for (r = 8; r <= 11; r++) map[r][18] = 1;
    for (c = 18; c <= 22; c++) map[11][c] = 1;
    for (r = 2; r <= 4; r++) map[r][6] = 1;
    for (c = 4; c <= 6; c++) map[4][c] = 1;
    for (r = 13; r <= 16; r++) map[r][24] = 1;
    for (c = 24; c <= 27; c++) map[13][c] = 1;
    for (r = 7; r <= 9; r++) {
      for (c = 12; c <= 14; c++) map[r][c] = 1;
    }
    for (r = 16; r <= 18; r++) map[r][16] = 1;
    for (c = 16; c <= 19; c++) map[18][c] = 1;
  }

  G.map = map;

  // Lab station
  var labR = 9, labC = 16;
  map[labR][labC] = 2;
  G.labStation = { r: labR, c: labC, x: labC * TILE + TILE / 2, y: labR * TILE + TILE / 2 };

  // Exit
  var exitR = 2, exitC = 28;
  map[exitR][exitC] = 3;
  G.exit = { r: exitR, c: exitC, x: exitC * TILE + TILE / 2, y: exitR * TILE + TILE / 2, open: false };

  // --- Items (chemicals) — V5: level-specific decoy spots, no overlaps ---
  G.items = [];
  var recipe = G.recipe.chemicals;
  var allChemKeys = Object.keys(CHEMICALS);
  var decoy = allChemKeys.filter(function(k) { return recipe.indexOf(k) < 0; });

  // Recipe chemicals — per-level positions
  var recipeSpots = {
    1: [{ r: 5, c: 4 }, { r: 17, c: 6 }],
    2: [{ r: 14, c: 22 }, { r: 4, c: 25 }],
    // V5 FIX: KI at (17,24) instead of (17,14) to avoid decoy overlap
    3: [{ r: 14, c: 27 }, { r: 3, c: 4 }, { r: 17, c: 24 }]
  };
  var rSpots = recipeSpots[lvl] || recipeSpots[1];
  for (var i = 0; i < recipe.length; i++) {
    var spot = rSpots[i % rSpots.length];
    G.items.push({
      x: spot.c * TILE + TILE / 2, y: spot.r * TILE + TILE / 2, r: 18,
      key: recipe[i], collected: false, important: true, bounce: Math.random() * Math.PI * 2
    });
  }

  // Decoy chemicals — V5: per-level decoy spots that DO NOT overlap recipe spots
  var decoySpotsPerLevel = {
    1: [
      { r: 8, c: 4 }, { r: 16, c: 18 }, { r: 3, c: 14 },
      { r: 11, c: 24 }, { r: 7, c: 26 }, { r: 15, c: 8 }
    ],
    2: [
      { r: 3, c: 4 }, { r: 16, c: 22 }, { r: 7, c: 26 },
      { r: 12, c: 28 }, { r: 17, c: 8 }, { r: 5, c: 14 },
      { r: 10, c: 2 }, { r: 15, c: 2 }
    ],
    // V5 FIX: Level 3 decoys — (17,14) is NO LONGER used, KI moved to (17,24)
    3: [
      { r: 8, c: 4 }, { r: 16, c: 18 }, { r: 3, c: 14 },
      { r: 11, c: 24 }, { r: 17, c: 14 }, { r: 7, c: 26 },
      { r: 12, c: 2 }, { r: 15, c: 28 }
    ]
  };
  var dSpots = decoySpotsPerLevel[lvl] || decoySpotsPerLevel[1];
  var decoyCount = Math.min(4 + lvl * 2, dSpots.length);
  for (i = 0; i < decoyCount; i++) {
    G.items.push({
      x: dSpots[i].c * TILE + TILE / 2, y: dSpots[i].r * TILE + TILE / 2, r: 18,
      key: decoy[i % decoy.length], collected: false, important: false, bounce: Math.random() * Math.PI * 2
    });
  }

  // --- Paper notes ---
  G.notes = [];
  G.readNotes = [];
  G.activeNote = null;
  var levelNotes = LEVELS[lvl].notes;
  var noteSpots = {
    1: [{ r: 3, c: 8 }, { r: 12, c: 5 }, { r: 16, c: 22 }],
    2: [{ r: 3, c: 8 }, { r: 7, c: 25 }, { r: 16, c: 10 }, { r: 13, c: 26 }],
    3: [{ r: 3, c: 12 }, { r: 7, c: 4 }, { r: 16, c: 20 }, { r: 12, c: 28 }, { r: 5, c: 26 }]
  };
  var nSpots = noteSpots[lvl] || noteSpots[1];
  for (i = 0; i < levelNotes.length && i < nSpots.length; i++) {
    var ns = nSpots[i];
    G.notes.push({
      x: ns.c * TILE + TILE / 2, y: ns.r * TILE + TILE / 2, r: 22,
      text: levelNotes[i], index: i, read: false, bounce: Math.random() * Math.PI * 2
    });
  }

  // --- NPCs ---
  G.npcs = [];
  var npcSpots = [
    { r: 6, c: 22 }, { r: 16, c: 4 }, { r: 10, c: 24 },
    { r: 4, c: 12 }, { r: 17, c: 24 }
  ];
  var npcCount = LEVELS[lvl].npcCount;
  for (i = 0; i < npcCount; i++) {
    var s = npcSpots[i % npcSpots.length];
    G.npcs.push({
      x: s.c * TILE + TILE / 2, y: s.r * TILE + TILE / 2, r: 12,
      vx: 0, vy: 0,
      dir: Math.random() * Math.PI * 2,
      patrolTimer: 2 + Math.random() * 3,
      speed: LEVELS[lvl].npcSpeed,
      behavior: 'chase',
      attackCooldown: 0,
      wobble: Math.random() * Math.PI * 2,
      memoryTimer: 0,
      alertPulse: 0,
    });
  }

  // Player start
  G.player.x = 2 * TILE + TILE / 2;
  G.player.y = 2 * TILE + TILE / 2;
  G.player.dir = 'down';
  G.player.invuln = 0;
}

// ============== Floating background decorations ==============
function spawnFloaties() {
  G.floaties = [];
  for (var i = 0; i < 18; i++) {
    G.floaties.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 4 + Math.random() * 8,
      speed: 0.2 + Math.random() * 0.5,
      sway: Math.random() * Math.PI * 2,
      type: Math.random() < 0.4 ? 'star' : (Math.random() < 0.5 ? 'heart' : 'bubble'),
      alpha: 0.15 + Math.random() * 0.25
    });
  }
}

// ============== Input ==============
var KEYS = {};
var TOUCH = { active: false, dx: 0, dy: 0, startX: 0, startY: 0, stickId: null };

document.addEventListener('keydown', function(e) {
  // First interaction unlocks audio context
  ensureAudio();
  KEYS[e.key.toLowerCase()] = true;
  if (G && G.status === 'lab') {
    var toolKeys = { '1': 'mix', '2': 'filter', '3': 'heat', '4': 'evaporate' };
    if (toolKeys[e.key]) { applyTool(toolKeys[e.key]); e.preventDefault(); }
    if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') { closeLab(); e.preventDefault(); }
  } else if (G && G.status === 'playing') {
    if (e.key === 'e' || e.key === 'E' || e.key === ' ') { tryInteract(); }
    if (e.key === 'r' || e.key === 'R') { newGame(G.level); }
  } else if (G && (G.status === 'won' || G.status === 'lost')) {
    if (e.key === 'Enter' || e.key === ' ') { showMenu(); }
    if (e.key === 'r' || e.key === 'R') { newGame(G.level); }
  }
});
document.addEventListener('keyup', function(e) { KEYS[e.key.toLowerCase()] = false; });

// ---- Touch controls ----
function isTouchDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function setupTouchControls() {
  var stick = document.getElementById('touch-stick');
  var knob = document.getElementById('touch-knob');
  var btnAct = document.getElementById('touch-action');
  var btnLab = document.getElementById('touch-lab');
  var btnRestart = document.getElementById('touch-restart');
  if (!stick) return;

  // --- Virtual joystick (redesigned: 160px base, 60px knob, 62px max displacement) ---
  stick.addEventListener('touchstart', function(e) {
    e.preventDefault();
    ensureAudio();
    if (TOUCH.stickId !== null) return;
    var t = e.changedTouches[0];
    TOUCH.stickId = t.identifier;
    TOUCH.startX = t.clientX;
    TOUCH.startY = t.clientY;
    TOUCH.active = true;
    TOUCH.dx = 0; TOUCH.dy = 0;
    stick.classList.add('active');
  }, { passive: false });

  document.addEventListener('touchmove', function(e) {
    if (TOUCH.stickId === null) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === TOUCH.stickId) {
        var dx = t.clientX - TOUCH.startX;
        var dy = t.clientY - TOUCH.startY;
        var dist = Math.hypot(dx, dy);
        var maxDist = 62;  // max displacement from center
        var deadZone = 12; // dead zone to prevent accidental movement
        if (dist < deadZone) {
          TOUCH.dx = 0; TOUCH.dy = 0;
          if (knob) knob.style.transform = 'translate(0, 0)';
        } else {
          var clampedDist = Math.min(dist, maxDist);
          var angle = Math.atan2(dy, dx);
          var cx = Math.cos(angle) * clampedDist;
          var cy = Math.sin(angle) * clampedDist;
          TOUCH.dx = cx / maxDist;
          TOUCH.dy = cy / maxDist;
          if (knob) knob.style.transform = 'translate(' + cx + 'px, ' + cy + 'px)';
        }
        break;
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', function(e) {
    if (TOUCH.stickId === null) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === TOUCH.stickId) {
        TOUCH.stickId = null;
        TOUCH.active = false;
        TOUCH.dx = 0; TOUCH.dy = 0;
        if (knob) knob.style.transform = 'translate(0, 0)';
        stick.classList.remove('active');
        break;
      }
    }
  }, { passive: false });

  // Also handle touchcancel (e.g. system gesture interrupt)
  document.addEventListener('touchcancel', function(e) {
    if (TOUCH.stickId === null) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === TOUCH.stickId) {
        TOUCH.stickId = null;
        TOUCH.active = false;
        TOUCH.dx = 0; TOUCH.dy = 0;
        if (knob) knob.style.transform = 'translate(0, 0)';
        stick.classList.remove('active');
        break;
      }
    }
  });

  // --- Action button (interact) ---
  if (btnAct) {
    btnAct.addEventListener('touchstart', function(e) {
      e.preventDefault();
      ensureAudio();
      if (G && G.status === 'playing') tryInteract();
    }, { passive: false });
  }

  // --- Lab button (open/close experiment table) ---
  if (btnLab) {
    btnLab.addEventListener('touchstart', function(e) {
      e.preventDefault();
      ensureAudio();
      if (!G) return;
      if (G.status === 'lab') {
        closeLab();
      } else if (G.status === 'playing') {
        openLab();
      }
    }, { passive: false });
  }

  // --- Restart button ---
  if (btnRestart) {
    btnRestart.addEventListener('touchstart', function(e) {
      e.preventDefault();
      ensureAudio();
      if (G && (G.status === 'playing' || G.status === 'won' || G.status === 'lost')) newGame(G.level);
    }, { passive: false });
  }
}

// ---- Fullscreen toggle ----
function setupFullscreen() {
  var btn = document.getElementById('fullscreen-btn');
  if (!btn) return;

  function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      var el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(function() {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  btn.addEventListener('click', toggleFullscreen);
  btn.addEventListener('touchend', function(e) {
    e.preventDefault();
    toggleFullscreen();
  });

  // Update fullscreen icon based on state
  function updateFsIcon() {
    var icon = btn.querySelector('.fullscreen-icon');
    if (!icon) return;
    var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    icon.textContent = isFs ? '⛶' : '⛶';  // same icon for now
  }
  document.addEventListener('fullscreenchange', updateFsIcon);
  document.addEventListener('webkitfullscreenchange', updateFsIcon);
}

// ---- Orientation detection (portrait → landscape hint) ----
function setupOrientation() {
  var hint = document.getElementById('orientation-hint');
  if (!hint) return;

  function checkOrientation() {
    // Only show hint on touch devices in portrait
    if (!isTouchDevice()) {
      hint.hidden = true;
      return;
    }
    var isPortrait = window.innerHeight > window.innerWidth;
    hint.hidden = !isPortrait;
  }

  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', function() {
    // Small delay for the browser to update dimensions
    setTimeout(checkOrientation, 200);
  });
  checkOrientation();
}

function updateTouchVisibility() {
  var show = isTouchDevice();
  var els = document.querySelectorAll('.touch-controls');
  els.forEach(function(el) { el.style.display = show ? 'flex' : 'none'; });
  var hint = document.querySelector('.controls-hint');
  if (hint) hint.style.display = show ? 'none' : 'flex';
  // Show fullscreen button only on touch devices
  var fsBtn = document.getElementById('fullscreen-btn');
  if (fsBtn) fsBtn.style.display = show ? 'flex' : 'none';
}

// ============== Movement & collision ==============
function isWall(px, py) {
  var c = Math.floor(px / TILE);
  var r = Math.floor(py / TILE);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
  return G.map[r][c] === 1;
}

function moveCircle(entity, dx, dy) {
  var r = entity.r;
  if (!isWall(entity.x + dx + Math.sign(dx) * r, entity.y) &&
      !isWall(entity.x + dx + Math.sign(dx) * r, entity.y - r) &&
      !isWall(entity.x + dx + Math.sign(dx) * r, entity.y + r)) {
    entity.x += dx;
  }
  if (!isWall(entity.x, entity.y + dy + Math.sign(dy) * r) &&
      !isWall(entity.x - r, entity.y + dy + Math.sign(dy) * r) &&
      !isWall(entity.x + r, entity.y + dy + Math.sign(dy) * r)) {
    entity.y += dy;
  }
}

function circleCircle(ax, ay, ar, bx, by, br) {
  var dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

// ============== Update loop ==============
var lastFrame = 0;
function loop(now) {
  var dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (G) update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (G.status === 'playing') {
    G.timeLeft = Math.max(0, G.timeLeft - dt);
    G.elapsedTime = (performance.now() - G.startTime) / 1000;
    if (G.timeLeft <= 0) {
      gameOver(LEVELS[G.level].story.lose);
      return;
    }

    // Player movement
    var sp = 130;
    var dx = 0, dy = 0;
    if (KEYS['arrowleft'] || KEYS['a']) dx -= 1;
    if (KEYS['arrowright'] || KEYS['d']) dx += 1;
    if (KEYS['arrowup'] || KEYS['w']) dy -= 1;
    if (KEYS['arrowdown'] || KEYS['s']) dy += 1;
    if (TOUCH.active && (Math.abs(TOUCH.dx) > 0.1 || Math.abs(TOUCH.dy) > 0.1)) {
      dx = TOUCH.dx;
      dy = TOUCH.dy;
    }
    if (dx !== 0 || dy !== 0) {
      var len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      moveCircle(G.player, dx * sp * dt, dy * sp * dt);
      if (Math.abs(dx) > Math.abs(dy)) G.player.dir = dx > 0 ? 'right' : 'left';
      else G.player.dir = dy > 0 ? 'down' : 'up';
      G.player.bounce += dt * 10;
    }
    G.player.invuln = Math.max(0, G.player.invuln - dt);

    // --- NPC AI ---
    var detectRange = 280;
    var memoryDuration = 3.0;
    for (var ni = 0; ni < G.npcs.length; ni++) {
      var npc = G.npcs[ni];
      npc.attackCooldown = Math.max(0, npc.attackCooldown - dt);
      npc.wobble += dt * 4;
      npc.alertPulse = Math.max(0, npc.alertPulse - dt * 2);

      var ddx = G.player.x - npc.x;
      var ddy = G.player.y - npc.y;
      var d = Math.hypot(ddx, ddy);
      var canSee = d < detectRange && d > 0.01;

      if (canSee) {
        npc.memoryTimer = memoryDuration;
        npc.alertPulse = 1;
      }

      if (npc.memoryTimer > 0) {
        npc.memoryTimer -= dt;
        if (d > 0.01) {
          var chaseSpeed = npc.speed * 55 * dt;
          var cvx = (ddx / d) * chaseSpeed;
          var cvy = (ddy / d) * chaseSpeed;
          moveCircle(npc, cvx, cvy);
        }
      } else {
        npc.patrolTimer -= dt;
        if (npc.patrolTimer <= 0) {
          npc.dir = Math.random() * Math.PI * 2;
          npc.patrolTimer = 1.5 + Math.random() * 2.5;
        }
        var pvx = Math.cos(npc.dir) * npc.speed * 20 * dt;
        var pvy = Math.sin(npc.dir) * npc.speed * 20 * dt;
        moveCircle(npc, pvx, pvy);
      }

      if (circleCircle(npc.x, npc.y, npc.r, G.player.x, G.player.y, G.player.r) &&
          npc.attackCooldown <= 0 && G.player.invuln <= 0) {
        damagePlayer(1, '被化学毒气抓到了！');
        npc.attackCooldown = 1.5;
        var pushDx = npc.x - G.player.x;
        var pushDy = npc.y - G.player.y;
        var pushD = Math.hypot(pushDx, pushDy) || 1;
        moveCircle(npc, (pushDx / pushD) * 10, (pushDy / pushD) * 10);
      }
    }

    // --- Item pickup ---
    for (var ii = 0; ii < G.items.length; ii++) {
      var it = G.items[ii];
      if (it.collected) continue;
      it.bounce += dt * 3;
      if (circleCircle(it.x, it.y, it.r, G.player.x, G.player.y, G.player.r)) {
        it.collected = true;
        G.lab.collected.push(it.key);
        G.chemicalsUsed++;
        spawnPickupFx(it.x, it.y, it.key, it.important);

        if (it.important) {
          playSound('pickup-correct');
          var recipeCollected = G.recipe.chemicals.filter(function(c) { return G.lab.collected.indexOf(c) >= 0; }).length;
          var recipeCount = G.recipe.chemicals.length;
          if (recipeCollected < recipeCount) {
            setHint('正确！' + CHEMICALS[it.key].name + '（' + CHEMICALS[it.key].formula + '）— ' + recipeCollected + '/' + recipeCount + ' 种反应物已收集。');
          } else {
            setHint('全部反应物收集完毕！去实验台（⚗️）吧。');
          }
        } else {
          playSound('pickup-wrong');
          G.wrongPicks++;
          damagePlayer(1, '错误化学品！' + CHEMICALS[it.key].name + ' 不是这里的反应物。');
          setHint('错误！' + CHEMICALS[it.key].formula + ' 不需要。生命 -1！');
        }
      }
    }

    // --- Note pickup ---
    for (var nti = 0; nti < G.notes.length; nti++) {
      var note = G.notes[nti];
      note.bounce += dt * 2;
      if (circleCircle(note.x, note.y, note.r, G.player.x, G.player.y, G.player.r) && !note.read) {
        note.read = true;
        G.readNotes.push(note.text);
        G.activeNote = note.text;
        playSound('note-read');
        showNoteModal(note.text);
      }
    }

    // Exit check
    if (G.exit.open && circleCircle(G.exit.x, G.exit.y, TILE / 2, G.player.x, G.player.y, G.player.r)) {
      winLevel();
    }

    // Update hint
    G.hintTimer -= dt;
    if (G.hintTimer <= 0) {
      updateHint();
    }
  }

  // Particles
  G.particles = G.particles.filter(function(p) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.rot += p.rotSpeed * dt;
    return p.life > 0;
  });
  G.bubbles = G.bubbles.filter(function(b) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    return b.life > 0;
  });
  for (var fi = 0; fi < G.floaties.length; fi++) {
    var f = G.floaties[fi];
    f.y -= f.speed;
    f.sway += dt * 2;
    f.x += Math.sin(f.sway) * 0.3;
    if (f.y < -20) { f.y = H + 20; f.x = Math.random() * W; }
  }

  G.damageFlash = Math.max(0, G.damageFlash - dt * 4);
  G.shake = Math.max(0, G.shake - dt * 4);

  if (G.banner && G.banner.timer > 0) G.banner.timer -= dt;

  updateHUD();
}

// ============== Interactions ==============
function tryInteract() {
  for (var i = 0; i < G.notes.length; i++) {
    var note = G.notes[i];
    if (circleCircle(note.x, note.y, note.r + 6, G.player.x, G.player.y, G.player.r)) {
      if (!note.read) {
        note.read = true;
        G.readNotes.push(note.text);
        playSound('note-read');
        showNoteModal(note.text);
      } else {
        showNoteModal(note.text);
      }
      return;
    }
  }
  if (circleCircle(G.labStation.x, G.labStation.y, TILE / 2 + 4, G.player.x, G.player.y, G.player.r)) {
    openLab();
    return;
  }
  if (G.exit.open && circleCircle(G.exit.x, G.exit.y, TILE / 2 + 4, G.player.x, G.player.y, G.player.r)) {
    winLevel();
    return;
  }
}

// ============== Note modal ==============
function showNoteModal(text) {
  var modal = document.getElementById('note-modal');
  var content = document.getElementById('note-content');
  if (modal && content) {
    content.textContent = text;
    modal.hidden = false;
  }
}

function closeNoteModal() {
  var modal = document.getElementById('note-modal');
  if (modal) modal.hidden = true;
}

// ============== Lab system ==============
function openLab() {
  G.status = 'lab';
  renderLab();
  document.getElementById('lab-modal').hidden = false;
}

function closeLab() {
  G.status = 'playing';
  document.getElementById('lab-modal').hidden = true;
  updateHint();
}

function renderLab() {
  var cfg = LEVELS[G.level];

  // Chemistry clue
  var clueEl = document.getElementById('lab-clue');
  if (clueEl) {
    clueEl.innerHTML =
      '<div class="lab-clue-reaction">' + cfg.reaction + '</div>' +
      '<div class="lab-clue-type"><strong>' + cfg.reactionType + '</strong></div>' +
      '<div style="font-size:12px;color:#7b6b8a;margin-top:6px;">' + cfg.story.title + '</div>' +
      '<div class="lab-clue-text">' + cfg.clue + '</div>';
  }

  // Notes read
  var notesEl = document.getElementById('lab-notes');
  if (notesEl) {
    if (G.readNotes.length === 0) {
      notesEl.innerHTML = '<div class="lab-empty">还没有发现纸条。探索房间吧！</div>';
    } else {
      notesEl.innerHTML = G.readNotes.map(function(n) {
        return '<div class="lab-note-item">' + n + '</div>';
      }).join('');
    }
  }

  // Chemicals
  var chemEl = document.getElementById('lab-chemicals');
  var allChems = G.lab.collected;
  if (allChems.length === 0) {
    chemEl.innerHTML = '<div class="lab-empty">还没有化学品。去找瓶子吧！</div>';
  } else {
    chemEl.innerHTML = allChems.map(function(ch) {
      var used = G.lab.usedChemicals.indexOf(ch) >= 0;
      var cls = used ? 'used' : 'ready';
      return '<button class="lab-chem ' + cls + '" data-key="' + ch + '" ' + (used ? 'disabled' : '') + '>' +
        '<span class="lab-chem-emoji">' + CHEMICALS[ch].emoji + '</span>' +
        '<span class="lab-chem-name">' + CHEMICALS[ch].name + '</span>' +
        '<span class="lab-chem-formula">' + CHEMICALS[ch].formula + '</span>' +
        '<span class="lab-chem-type">' + CHEMICALS[ch].type + '</span>' +
        '</button>';
    }).join('');
    chemEl.querySelectorAll('.lab-chem').forEach(function(btn) {
      btn.addEventListener('click', function() { addChemical(btn.dataset.key); });
    });
  }

  // Tools
  var toolEl = document.getElementById('lab-tools');
  var allTools = ['mix', 'filter', 'heat', 'evaporate'];
  toolEl.innerHTML = allTools.map(function(t) {
    var done = G.lab.phases.indexOf(t) >= 0;
    var cls = done ? 'done' : '';
    return '<button class="lab-tool ' + cls + '" data-tool="' + t + '" ' + (done ? 'disabled' : '') + '>' +
      '<span class="lab-tool-icon">' + TOOLS[t].icon + '</span>' +
      '<span class="lab-tool-name">' + TOOLS[t].name + '</span>' +
      '<span class="lab-tool-desc">' + TOOLS[t].desc + '</span>' +
      '<span class="lab-tool-key">[' + TOOLS[t].key + ']</span>' +
      '</button>';
  }).join('');
  toolEl.querySelectorAll('.lab-tool').forEach(function(btn) {
    btn.addEventListener('click', function() { applyTool(btn.dataset.tool); });
  });

  // Progress bar
  var totalSteps = G.recipe.chemicals.length + G.recipe.tools.length;
  var doneSteps = G.lab.usedChemicals.length + G.lab.phases.length;
  var pct = Math.round((doneSteps / totalSteps) * 100);
  var barEl = document.getElementById('lab-progress-bar');
  if (barEl) barEl.style.width = pct + '%';
  var pctEl = document.getElementById('lab-progress-pct');
  if (pctEl) pctEl.textContent = pct + '%';

  // Status
  if (!G.lab.recipeDone) {
    if (G.lab.usedChemicals.length === 0) {
      if (G.lab.collected.length === 0) {
        setLabStatus('烧杯是空的。先找化学品并阅读纸条获取线索。', 'info');
      } else {
        setLabStatus('你手上有化学品。阅读纸条——哪些是反应需要的？', 'info');
      }
    } else if (G.lab.usedChemicals.length < G.recipe.chemicals.length) {
      setLabStatus('部分反应物已在烧杯中。查看纸条——还需要更多吗？', 'info');
    } else {
      if (G.lab.phases.length === 0) {
        setLabStatus('反应物已备齐。现在按正确顺序进行操作。想想反应类型……', 'info');
      } else if (G.lab.phases.length < G.recipe.tools.length) {
        setLabStatus('进度：' + G.lab.phases.map(function(p) { return TOOLS[p].icon; }).join(' ') + '。下一步？', 'info');
      }
    }
  }
}

function addChemical(key) {
  if (G.lab.usedChemicals.indexOf(key) >= 0) {
    setLabStatus(CHEMICALS[key].name + ' 已经在烧杯里了。', 'error');
    return;
  }
  if (G.recipe.chemicals.indexOf(key) === -1) {
    G.lab.usedChemicals.push(key);
    playSound('lab-fail');
    spawnBeakerFx(false);
    setLabStatus('错误！' + CHEMICALS[key].formula + ' 不属于该反应。生命 -1！', 'error');
    damagePlayer(1, '错误化学品放入烧杯');
    renderLab();
    return;
  }
  G.lab.usedChemicals.push(key);
  playSound('lab-success');
  spawnBeakerFx(true);
  var remaining = G.recipe.chemicals.length - G.lab.usedChemicals.length;
  if (remaining > 0) {
    setLabStatus('已加入 ' + CHEMICALS[key].name + '（' + CHEMICALS[key].formula + '）。还需要 ' + remaining + ' 种……', 'success');
  } else {
    setLabStatus('所有反应物已添加。现在按正确顺序操作。', 'success');
  }
  renderLab();
  checkLabComplete();
}

function applyTool(tool) {
  var expectedTool = G.recipe.tools[G.lab.phases.length];
  if (tool !== expectedTool) {
    playSound('lab-fail');
    setLabStatus('错误！' + TOOLS[tool].name + ' 不是正确的步骤。生命 -1！', 'error');
    damagePlayer(1, '错误的操作顺序');
    spawnBeakerFx(false);
    renderLab();
    return;
  }
  if (tool === 'mix' && G.lab.usedChemicals.length === 0) {
    setLabStatus('烧杯是空的！先加入化学品。', 'error');
    return;
  }
  if ((tool === 'filter' || tool === 'heat' || tool === 'evaporate') && G.lab.phases.indexOf('mix') < 0) {
    setLabStatus('先混合化学品再进行其他操作！', 'error');
    return;
  }
  G.lab.phases.push(tool);
  playSound('lab-success');
  spawnBeakerFx(true);
  var remaining = G.recipe.tools.length - G.lab.phases.length;
  if (remaining > 0) {
    setLabStatus('已执行 ' + TOOLS[tool].name + '。还剩 ' + remaining + ' 步操作。', 'success');
  } else {
    setLabStatus('所有操作完成！', 'success');
  }
  renderLab();
  checkLabComplete();
}

function checkLabComplete() {
  if (G.lab.phases.length === G.recipe.tools.length &&
      G.lab.usedChemicals.length === G.recipe.chemicals.length) {
    G.lab.recipeDone = true;
    G.exit.open = true;
    playSound('exit-open');
    setLabStatus('反应完成！出口传送门已开启！', 'success');
    showSucceed();
  }
}

// ============== SUCCEED celebration ==============
function showSucceed() {
  // Play celebration fanfare
  playSound('celebration');

  // Show the SUCCEED overlay
  var overlay = document.getElementById('succeed-overlay');
  overlay.hidden = false;

  // Re-trigger animation by cloning the text element
  var textEl = overlay.querySelector('.succeed-text');
  var clone = textEl.cloneNode(true);
  textEl.parentNode.replaceChild(clone, textEl);

  // Spawn stars
  var starsContainer = document.getElementById('succeed-stars');
  starsContainer.innerHTML = '';
  var starEmojis = ['⭐', '✨', '💫', '🌟', '💖', '🧪', '🎉', '🎊', '💜', '🔮'];
  for (var i = 0; i < 30; i++) {
    var star = document.createElement('span');
    star.className = 'succeed-star';
    star.textContent = starEmojis[i % starEmojis.length];
    star.style.left = (10 + Math.random() * 80) + '%';
    star.style.top = (10 + Math.random() * 80) + '%';
    star.style.setProperty('--sx', ((Math.random() - 0.5) * 400) + 'px');
    star.style.setProperty('--sy', ((Math.random() - 0.5) * 400 - 100) + 'px');
    star.style.setProperty('--sr', ((Math.random() - 0.5) * 720) + 'deg');
    star.style.animationDelay = (Math.random() * 0.4) + 's';
    star.style.fontSize = (20 + Math.random() * 40) + 'px';
    starsContainer.appendChild(star);
  }

  // Spawn confetti particles
  var confettiColors = ['#ff8fab', '#b388eb', '#ffd93d', '#7fd9a0', '#7ec8e3', '#ff6b9d', '#c4a6e8'];
  for (var j = 0; j < 60; j++) {
    var dot = document.createElement('span');
    dot.className = 'succeed-confetti';
    dot.style.left = (Math.random() * 100) + '%';
    dot.style.top = (Math.random() * 100) + '%';
    dot.style.backgroundColor = confettiColors[j % confettiColors.length];
    dot.style.width = (6 + Math.random() * 14) + 'px';
    dot.style.height = (6 + Math.random() * 14) + 'px';
    dot.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    dot.style.setProperty('--cx', ((Math.random() - 0.5) * 600) + 'px');
    dot.style.setProperty('--cy', ((Math.random() - 0.2) * 500 + 100) + 'px');
    dot.style.setProperty('--cr', ((Math.random() - 0.5) * 1080) + 'deg');
    dot.style.animationDelay = (Math.random() * 0.6) + 's';
    overlay.appendChild(dot);
  }

  // Hide after 2.5 seconds
  setTimeout(function() {
    overlay.hidden = true;
  }, 2500);
}

function setLabStatus(text, cls) {
  var el = document.getElementById('lab-status');
  if (el) {
    el.textContent = text;
    el.className = 'lab-status' + (cls ? ' ' + cls : '');
  }
}

// ============== Damage / feedback ==============
function damagePlayer(amount, reason) {
  if (G.player.invuln > 0) return;
  G.hp = Math.max(0, G.hp - amount);
  G.player.invuln = 1.2;
  G.damageFlash = 1;
  G.shake = 0.5;
  playSound('damage');
  spawnDamageFx();
  if (G.hp <= 0) {
    G.deaths++;
    playSound('lose');
    gameOver(reason ? reason + ' — 生命值耗尽！' : '你倒下了……');
  }
}

function gameOver(msg) {
  G.status = 'lost';
  G.endTime = (performance.now() - G.startTime) / 1000;
  BGM.stop();
  showOverlay('lose', '实验失败', msg);
}

function winLevel() {
  G.status = 'won';
  G.endTime = (performance.now() - G.startTime) / 1000;
  G.totalTime = G.endTime;
  BGM.stop();
  playSound('win');
  showOverlay('win', '实验成功！', LEVELS[G.level].story.win);
}

// ============== Particle effects ==============
function spawnPickupFx(x, y, key, correct) {
  if (correct) {
    var c = CHEMICALS[key].color;
    for (var i = 0; i < 12; i++) {
      G.particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.8) * 60,
        gravity: 120, life: 0.6 + Math.random() * 0.3, maxLife: 0.9,
        color: c, size: 3 + Math.random() * 2, type: 'circle', rot: 0, rotSpeed: 0
      });
    }
    for (i = 0; i < 6; i++) {
      G.particles.push({
        x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 30,
        gravity: 50, life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
        color: PAL.heart, size: 6 + Math.random() * 4, type: 'heart', rot: 0, rotSpeed: 0
      });
    }
    for (i = 0; i < 8; i++) {
      G.particles.push({
        x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
        gravity: 20, life: 0.7, maxLife: 0.7,
        color: PAL.star, size: 5 + Math.random() * 3, type: 'star',
        rot: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 6
      });
    }
  } else {
    // Wrong chemical — dark purple smoke
    for (i = 0; i < 10; i++) {
      G.particles.push({
        x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20,
        gravity: -20, life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
        color: '#b388eb', size: 5 + Math.random() * 3, type: 'circle', rot: 0, rotSpeed: 0
      });
    }
  }
}

function spawnBeakerFx(success) {
  var x = G.labStation.x, y = G.labStation.y;
  if (success) {
    for (var i = 0; i < 10; i++) {
      G.particles.push({
        x: x, y: y - 8, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30,
        gravity: 60, life: 0.7, maxLife: 0.7,
        color: PAL.lab, size: 4, type: 'circle', rot: 0, rotSpeed: 0
      });
    }
    for (i = 0; i < 4; i++) {
      G.particles.push({
        x: x + (Math.random() - 0.5) * 20, y: y - 4,
        vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 20,
        gravity: 30, life: 1.0, maxLife: 1.0,
        color: PAL.heart, size: 8, type: 'heart', rot: 0, rotSpeed: 0
      });
    }
  } else {
    for (i = 0; i < 16; i++) {
      G.particles.push({
        x: x + (Math.random() - 0.5) * 30, y: y - 8,
        vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30,
        gravity: -10, life: 1.0 + Math.random() * 0.5, maxLife: 1.5,
        color: Math.random() < 0.5 ? '#b388eb' : '#ff8fab',
        size: 6 + Math.random() * 4, type: 'circle', rot: 0, rotSpeed: 0
      });
    }
  }
}

function spawnDamageFx() {
  var x = G.player.x, y = G.player.y;
  for (var i = 0; i < 12; i++) {
    G.particles.push({
      x: x, y: y, vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100,
      gravity: 0, life: 0.5, maxLife: 0.5,
      color: '#ff4d6d', size: 3, type: 'circle', rot: 0, rotSpeed: 0
    });
  }
  for (i = 0; i < 4; i++) {
    G.particles.push({
      x: x, y: y, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 30,
      gravity: 80, life: 0.6, maxLife: 0.6,
      color: '#ff4d6d', size: 6, type: 'heart', rot: 0, rotSpeed: 0
    });
  }
}

// ============== HUD ==============
function updateHUD() {
  if (!G) return;
  document.getElementById('hud-level').textContent = '第 ' + G.level + ' 关';
  document.getElementById('hud-level-name').textContent = LEVELS[G.level].name;
  document.getElementById('hud-time').textContent = Math.ceil(G.timeLeft) + 's';
  var timeEl = document.getElementById('hud-time');
  timeEl.classList.remove('time-low', 'time-critical');
  if (G.timeLeft < 10) timeEl.classList.add('time-critical');
  else if (G.timeLeft < 20) timeEl.classList.add('time-low');

  var recipeCollected = G.recipe.chemicals.filter(function(c) { return G.lab.collected.indexOf(c) >= 0; }).length;
  document.getElementById('hud-chem').textContent = recipeCollected + ' / ' + G.recipe.chemicals.length;

  var hpEl = document.getElementById('hud-hp');
  hpEl.innerHTML = '';
  for (var i = 0; i < G.maxHp; i++) {
    var lost = i >= G.hp;
    hpEl.insertAdjacentHTML('beforeend',
      '<svg class="heart ' + (lost ? 'lost' : '') + '" viewBox="0 0 24 22" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 21s-7-4.5-9.5-9.5C.5 6.5 4 2 8 2c2 0 3 1 4 2 1-1 2-2 4-2 4 0 7.5 4.5 5.5 9.5C19 16.5 12 21 12 21z" fill="#ff6b9d" />' +
      '</svg>'
    );
  }

  var hintEl = document.getElementById('objective-hint');
  if (hintEl && G.hint) {
    hintEl.textContent = G.hint;
  }
}

function showBanner() {
  if (!G.banner) return;
  var b = document.getElementById('banner');
  document.getElementById('banner-title').textContent = G.banner.text;
  document.getElementById('banner-sub').textContent = G.banner.sub;
  b.hidden = false;
  setTimeout(function() { b.hidden = true; }, 3000);
}

function showOverlay(kind, title, msg) {
  var ov = document.getElementById('overlay');
  ov.className = 'overlay ' + kind;
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent = msg || '';
  document.getElementById('stat-time').textContent = (G.endTime || 0).toFixed(1) + 's';
  document.getElementById('stat-deaths').textContent = G.wrongPicks;
  document.getElementById('stat-chem').textContent = G.chemicalsUsed;
  ov.hidden = false;
}

function hideOverlay() {
  document.getElementById('overlay').hidden = true;
}

function showMenu() {
  hideOverlay();
  BGM.stop();
  var ov = document.getElementById('menu');
  ov.hidden = false;
  // Play menu video background
  var mv = document.getElementById('menu-video');
  if (mv) { mv.currentTime = 0; mv.play().catch(function(){}); }
}

function hideMenu() {
  document.getElementById('menu').hidden = true;
  // Pause menu video
  var mv = document.getElementById('menu-video');
  if (mv) mv.pause();
}

// ============== Story Intro Cutscene Engine ==============
var _storyTimer = null;
var _storyLines = [];
var _storyLineIdx = 0;
var _storyLevel = 0;

// Scene config per level
var STORY_INTRO = {
  1: {
    title: '急救中和',
    scene: '市立医院 — 急救室',
    lines: [
      '急救室的警报声响起……',
      '一名学生因化学灼伤被紧急送医——',
      '实验课上泼洒了盐酸。',
      '',
      '作为值班化学师，你必须快速行动：',
      '找到 HCl 和 NaOH，进行中和反应，',
      '在灼伤恶化之前完成任务。',
      '',
      '酸雾已经引来了麻烦。',
      '避开追击你的医院保安！',
    ],
    bgClass: 'hospital',
    particles: [
      { symbol: '💊', count: 6 },
      { symbol: '🩺', count: 4 },
      { symbol: '🧪', count: 5 },
    ]
  },
  2: {
    title: '废水处理',
    scene: '工业区 — 河畔工厂',
    lines: [
      '一家纺织厂向河中排放了硫酸铜——',
      '河水泛着诡异的蓝光……',
      '鱼类正在死亡。下游村庄一片恐慌。',
      '',
      '作为水处理化学家，',
      '你必须将铜从溶液中沉淀出来。',
      '向 CuSO₄ 加入 NaOH → 过滤 → 加热干燥。',
      '',
      '工厂保安正在巡逻。',
      '他们不想让你干扰他们的生产！',
    ],
    bgClass: 'factory',
    particles: [
      { symbol: '💧', count: 8 },
      { symbol: '🔵', count: 5 },
      { symbol: '🏭', count: 3 },
    ]
  },
  3: {
    title: '暗房银回收',
    scene: '废弃照相馆 — 暗房',
    lines: [
      '在一间老旧的照相馆深处，',
      '暗房计时器正在倒计时。',
      '硝酸银定影液——珍贵但剧毒——',
      '从锈蚀的罐子中泄漏出来。',
      '',
      '在银污染地下水之前回收它。',
      '加入 NaCl → AgCl（白色）。加入 KI → AgI（黄色）。',
      '按顺序完成四步操作：混合、过滤、加热、蒸发。',
      '',
      '暗房并不空荡。',
      '毒气已经……引来了什么东西。',
    ],
    bgClass: 'darkroom',
    particles: [
      { symbol: '📷', count: 4 },
      { symbol: '💡', count: 6 },
      { symbol: '🎞️', count: 5 },
    ]
  }
};

function showStoryIntro(levelId) {
  _storyLevel = levelId;
  var cfg = STORY_INTRO[levelId];
  _storyLines = cfg.lines;
  _storyLineIdx = 0;

  // Bail if G already exists and is playing (shouldn't happen, but safety)
  if (G && G.status === 'playing') return;

  var el = document.getElementById('story-intro');
  var bgEl = document.getElementById('story-intro-bg');
  var particlesEl = document.getElementById('story-particles');
  var bodyEl = document.getElementById('story-body');
  var beginBtn = document.getElementById('story-begin');

  // Set data-level for the button handlers
  el.dataset.level = levelId;

  // Background
  bgEl.className = 'story-intro-bg ' + cfg.bgClass;

  // Show the right anime video, hide others
  for (var v = 1; v <= 3; v++) {
    var vid = document.getElementById('story-video-' + v);
    if (vid) {
      vid.classList.toggle('active', v === levelId);
      if (v === levelId) { vid.currentTime = 0; vid.play().catch(function(){}); }
      else { vid.pause(); }
    }
  }

  // Scene particles
  _buildStoryParticles(particlesEl, cfg.particles);

  // Title & scene
  document.getElementById('story-title').textContent = cfg.title;
  document.getElementById('story-scene').textContent = cfg.scene;

  // Clear body
  bodyEl.innerHTML = '';

  // Hide begin button initially
  beginBtn.classList.add('hidden-btn');

  // Show overlay
  el.hidden = false;

  // Start typewriter
  _storyLineIdx = 0;
  _typeNextLine(bodyEl, beginBtn);
}

function _buildStoryParticles(container, particleCfg) {
  container.innerHTML = '';
  for (var p = 0; p < particleCfg.length; p++) {
    var cfg = particleCfg[p];
    for (var i = 0; i < cfg.count; i++) {
      var span = document.createElement('span');
      span.className = 'story-particle';
      span.textContent = cfg.symbol;
      span.style.left = (5 + Math.random() * 90) + '%';
      span.style.top = (5 + Math.random() * 90) + '%';
      span.style.fontSize = (16 + Math.random() * 24) + 'px';
      span.style.animationDelay = (Math.random() * 3) + 's';
      span.style.animationDuration = (2.5 + Math.random() * 3) + 's';
      container.appendChild(span);
    }
  }
}

function _typeNextLine(bodyEl, beginBtn) {
  if (_storyLineIdx >= _storyLines.length) {
    // All lines shown — reveal begin button
    beginBtn.classList.remove('hidden-btn');
    // Auto-bind Enter key
    _bindStoryEnter(beginBtn);
    return;
  }

  var line = _storyLines[_storyLineIdx];
  var lineEl = document.createElement('div');
  lineEl.className = 'line';

  if (line === '') {
    // Empty line — just spacing
    lineEl.innerHTML = '&nbsp;';
    lineEl.classList.add('visible');
    bodyEl.appendChild(lineEl);
    _storyLineIdx++;
    _storyTimer = setTimeout(function() { _typeNextLine(bodyEl, beginBtn); }, 400);
    return;
  }

  bodyEl.appendChild(lineEl);

  // Typewriter effect
  var charIdx = 0;
  function typeChar() {
    if (charIdx < line.length) {
      lineEl.textContent += line.charAt(charIdx);
      charIdx++;
      if (!lineEl.classList.contains('visible') && charIdx > 3) {
        lineEl.classList.add('visible');
      }
      _storyTimer = setTimeout(typeChar, 25 + Math.random() * 15);
    } else {
      lineEl.classList.add('visible');
      _storyLineIdx++;
      _storyTimer = setTimeout(function() { _typeNextLine(bodyEl, beginBtn); }, 500);
    }
  }
  typeChar();
}

function _bindStoryEnter(beginBtn) {
  function onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.removeEventListener('keydown', onKey);
      beginBtn.click();
    }
  }
  document.addEventListener('keydown', onKey);
}

function hideStoryIntro() {
  if (_storyTimer) { clearTimeout(_storyTimer); _storyTimer = null; }
  document.getElementById('story-intro').hidden = true;
  document.getElementById('story-particles').innerHTML = '';
  // Stop all story videos
  for (var v = 1; v <= 3; v++) {
    var vid = document.getElementById('story-video-' + v);
    if (vid) { vid.pause(); vid.classList.remove('active'); }
  }
}

// ============== Render (Surreal Cute style) ==============
function render() {
  ctx.save();
  if (G && G.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 6 * G.shake, (Math.random() - 0.5) * 6 * G.shake);
  }

  var grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, PAL.bgTop);
  grd.addColorStop(0.5, '#f8e1ff');
  grd.addColorStop(1, PAL.bgBot);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  if (!G) { ctx.restore(); return; }

  // Floating decorations
  for (var fi = 0; fi < G.floaties.length; fi++) {
    var f = G.floaties[fi];
    ctx.globalAlpha = f.alpha;
    if (f.type === 'star') {
      drawStar(ctx, f.x, f.y, f.size, PAL.star);
    } else if (f.type === 'heart') {
      drawHeart(ctx, f.x, f.y, f.size, PAL.heart);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Tiles
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var t = G.map[r][c];
      var x = c * TILE, y = r * TILE;
      if (t === 1) {
        ctx.fillStyle = PAL.wall;
        roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 8);
        ctx.fill();
        ctx.fillStyle = PAL.wallTop;
        roundRect(ctx, x + 3, y + 3, TILE - 6, 6, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        roundRect(ctx, x + 3, y + TILE - 9, TILE - 6, 5, 4);
        ctx.fill();
      } else {
        var checker = (r + c) % 2 === 0;
        ctx.fillStyle = checker ? PAL.floor1 : PAL.floor2;
        ctx.fillRect(x, y, TILE, TILE);
        if ((r * 7 + c * 13) % 11 === 0) {
          ctx.fillStyle = 'rgba(200, 162, 230, 0.15)';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (t === 2) {
        ctx.fillStyle = 'rgba(127, 217, 160, 0.2)';
        roundRect(ctx, x, y, TILE, TILE, 8);
        ctx.fill();
        ctx.strokeStyle = PAL.lab;
        ctx.lineWidth = 2;
        roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 8);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚗️', x + TILE / 2, y + TILE / 2);
      }
      if (t === 3) {
        var open = G.exit && G.exit.open;
        if (open) {
          var pulse = 0.7 + Math.sin(performance.now() / 200) * 0.3;
          var pg = ctx.createRadialGradient(x + TILE / 2, y + TILE / 2, 2, x + TILE / 2, y + TILE / 2, TILE / 2);
          pg.addColorStop(0, 'rgba(100, 210, 255, ' + pulse + ')');
          pg.addColorStop(1, 'rgba(100, 210, 255, 0)');
          ctx.fillStyle = pg;
          ctx.fillRect(x - 4, y - 4, TILE + 8, TILE + 8);
          ctx.fillStyle = 'rgba(100, 210, 255, 0.3)';
          roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 12);
          ctx.fill();
          ctx.font = '18px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🌟', x + TILE / 2, y + TILE / 2);
        } else {
          ctx.fillStyle = 'rgba(176, 190, 197, 0.15)';
          roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 8);
          ctx.fill();
          ctx.strokeStyle = PAL.exitClosed;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 8);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🔒', x + TILE / 2, y + TILE / 2);
        }
      }
    }
  }

  // Paper notes (scaled up 2.5x for visibility)
  for (var nti = 0; nti < G.notes.length; nti++) {
    var note = G.notes[nti];
    var noteBounce = Math.sin(note.bounce) * 5;
    ctx.save();
    ctx.translate(note.x, note.y + noteBounce);
    if (!note.read) {
      var noteGlow = 0.5 + Math.sin(performance.now() / 400) * 0.3;
      ctx.shadowColor = 'rgba(255, 217, 61, ' + noteGlow + ')';
      ctx.shadowBlur = 20;
    }
    ctx.fillStyle = note.read ? '#f5f5f5' : PAL.note;
    roundRect(ctx, -25, -18, 50, 36, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = PAL.noteEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, -25, -18, 50, 36, 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    for (var ln = 0; ln < 3; ln++) {
      ctx.beginPath();
      ctx.moveTo(-18, -8 + ln * 8);
      ctx.lineTo(18, -8 + ln * 8);
      ctx.stroke();
    }
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(note.read ? '✓' : '📝', 0, 0);
    ctx.restore();
  }

  // Items (chemicals) — scaled up 2.5x for visibility
  for (var ii = 0; ii < G.items.length; ii++) {
    var it = G.items[ii];
    if (it.collected) continue;
    var ch = CHEMICALS[it.key];
    var bounceY = Math.sin(it.bounce) * 6;
    var pulse = 0.85 + Math.sin(performance.now() / 250 + it.bounce) * 0.15;
    ctx.save();
    ctx.translate(it.x, it.y + bounceY);
    ctx.scale(pulse, pulse);
    var glowColor = 'rgba(255, 217, 61, 0.4)';
    var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-50, -50, 100, 100);
    // Cap
    ctx.fillStyle = '#d4a373';
    roundRect(ctx, -10, -22, 20, 10, 3);
    ctx.fill();
    // Bottle body
    ctx.fillStyle = ch.color;
    ctx.beginPath();
    ctx.moveTo(-8, -15);
    ctx.lineTo(8, -15);
    ctx.lineTo(15, 5);
    ctx.quadraticCurveTo(15, 20, 0, 20);
    ctx.quadraticCurveTo(-15, 20, -15, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(-5, 0, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Formula label
    ctx.fillStyle = PAL.text;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch.formula, 0, 2);
    ctx.restore();
  }

  // Lab label
  ctx.fillStyle = PAL.labEdge;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('LAB', G.labStation.x, G.labStation.y - 18);

  // Exit label
  ctx.fillStyle = G.exit && G.exit.open ? '#29b6f6' : '#9e9e9e';
  ctx.fillText(G.exit && G.exit.open ? 'EXIT' : 'LOCKED', G.exit.x, G.exit.y - 18);

  // NPCs
  for (var nci = 0; nci < G.npcs.length; nci++) {
    var npc = G.npcs[nci];
    ctx.save();
    ctx.translate(npc.x, npc.y);
    var wob = Math.sin(npc.wobble) * 2;
    if (npc.memoryTimer > 0) {
      var alertAlpha = 0.6 + Math.sin(performance.now() / 150) * 0.4;
      ctx.fillStyle = 'rgba(255, 107, 107, ' + alertAlpha + ')';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, -npc.r - 12);
    }
    ctx.fillStyle = npc.memoryTimer > 0 ? '#ff9999' : PAL.npc;
    ctx.beginPath();
    ctx.arc(0, -2 + wob, npc.r, Math.PI, 0, false);
    ctx.lineTo(npc.r, npc.r + wob);
    for (var wi = 2; wi >= 0; wi--) {
      var wx = (wi / 2) * 2 * npc.r - npc.r;
      ctx.quadraticCurveTo(wx + npc.r / 3, npc.r + 4 + wob, wx, npc.r + wob);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = npc.memoryTimer > 0 ? '#ff6b6b' : PAL.npcEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -3 + wob, 3.5, 0, Math.PI * 2);
    ctx.arc(4, -3 + wob, 3.5, 0, Math.PI * 2);
    ctx.fill();
    var pdx = G.player.x - npc.x;
    var pdy = G.player.y - npc.y;
    var pd = Math.hypot(pdx, pdy) || 1;
    var px = (pdx / pd) * 1.5;
    var py = (pdy / pd) * 1.5;
    ctx.fillStyle = PAL.npcEye;
    ctx.beginPath();
    ctx.arc(-4 + px, -3 + py + wob, 2, 0, Math.PI * 2);
    ctx.arc(4 + px, -3 + py + wob, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 143, 171, 0.4)';
    ctx.beginPath();
    ctx.arc(-6, 1 + wob, 2, 0, Math.PI * 2);
    ctx.arc(6, 1 + wob, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Player
  if (G.status !== 'lost') {
    ctx.save();
    ctx.translate(G.player.x, G.player.y);
    if (G.player.invuln > 0 && Math.floor(G.player.invuln * 8) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    var pBounce = Math.sin(G.player.bounce) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(0, G.player.r + 2, G.player.r * 0.8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.player;
    ctx.beginPath();
    ctx.arc(0, pBounce, G.player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.playerEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PAL.player;
    ctx.beginPath();
    ctx.moveTo(-8, -8 + pBounce);
    ctx.lineTo(-4, -16 + pBounce);
    ctx.lineTo(-2, -8 + pBounce);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, -8 + pBounce);
    ctx.lineTo(4, -16 + pBounce);
    ctx.lineTo(2, -8 + pBounce);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -2 + pBounce, 3.5, 0, Math.PI * 2);
    ctx.arc(4, -2 + pBounce, 3.5, 0, Math.PI * 2);
    ctx.fill();
    var dirMap = { down: [0, 1.5], up: [0, -1.5], left: [-1.5, 0], right: [1.5, 0] };
    var dirArr = dirMap[G.player.dir] || [0, 1.5];
    var ex = dirArr[0], ey = dirArr[1];
    ctx.fillStyle = PAL.playerEye;
    ctx.beginPath();
    ctx.arc(-4 + ex, -2 + ey + pBounce, 2, 0, Math.PI * 2);
    ctx.arc(4 + ex, -2 + ey + pBounce, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3.5 + ex, -2.5 + ey + pBounce, 0.8, 0, Math.PI * 2);
    ctx.arc(4.5 + ex, -2.5 + ey + pBounce, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 105, 140, 0.35)';
    ctx.beginPath();
    ctx.arc(-7, 2 + pBounce, 2.5, 0, Math.PI * 2);
    ctx.arc(7, 2 + pBounce, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Particles
  for (var pi = 0; pi < G.particles.length; pi++) {
    var p = G.particles[pi];
    var pa = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = pa;
    if (p.type === 'heart') {
      drawHeart(ctx, p.x, p.y, p.size, p.color);
    } else if (p.type === 'star') {
      drawStar(ctx, p.x, p.y, p.size, p.color);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  if (G.damageFlash > 0) {
    ctx.fillStyle = 'rgba(255, 105, 140, ' + (G.damageFlash * 0.3) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

// ============== Drawing helpers ==============
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

function drawHeart(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  var s = size / 10;
  ctx.moveTo(x, y + 3 * s);
  ctx.bezierCurveTo(x, y, x - 5 * s, y - 2 * s, x - 5 * s, y + 1 * s);
  ctx.bezierCurveTo(x - 5 * s, y + 4 * s, x, y + 6 * s, x, y + 8 * s);
  ctx.bezierCurveTo(x, y + 6 * s, x + 5 * s, y + 4 * s, x + 5 * s, y + 1 * s);
  ctx.bezierCurveTo(x + 5 * s, y - 2 * s, x, y, x, y + 3 * s);
  ctx.fill();
}

function drawStar(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  var spikes = 5;
  var outerR = size;
  var innerR = size * 0.4;
  for (var i = 0; i < spikes * 2; i++) {
    var r = i % 2 === 0 ? outerR : innerR;
    var angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    var px = x + Math.cos(angle) * r;
    var py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ============== Public API ==============
window.startLevel = function(levelId) {
  hideMenu();
  hideOverlay();
  closeNoteModal();
  // Show story intro instead of immediately starting
  showStoryIntro(levelId);
};

// Called after story intro → actually starts the game
window._beginGame = function(levelId) {
  hideStoryIntro();
  closeNoteModal();
  newGame(levelId);
};

window.restartLevel = function() {
  hideOverlay();
  closeNoteModal();
  // Restart skips story — straight to game
  hideStoryIntro();
  if (G) newGame(G.level);
};
window.openLab = openLab;
window.closeLab = closeLab;
window.showMenu = showMenu;
window.closeNoteModal = closeNoteModal;

// ============== Canvas responsive scaling ==============
function resizeCanvas() {
  var stage = document.getElementById('game-stage');
  if (!stage) return;
  var sw = stage.clientWidth;
  var sh = stage.clientHeight;
  var scale = Math.min(sw / W, sh / H);
  canvas.style.width = Math.floor(W * scale) + 'px';
  canvas.style.height = Math.floor(H * scale) + 'px';
}
window.addEventListener('resize', resizeCanvas);

// ============== Boot ==============
setupTouchControls();
setupFullscreen();
setupOrientation();
updateTouchVisibility();
resizeCanvas();
requestAnimationFrame(function(t) { lastFrame = t; loop(t); });
showMenu();
