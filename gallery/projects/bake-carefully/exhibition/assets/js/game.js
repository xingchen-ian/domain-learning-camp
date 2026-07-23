/* ==========================================================================
   Bake Carefully — Cozy Cafe Bakery
   Track A: No build step. Plain HTML/CSS/Canvas 2D.

   5 STATIONS: Orders → Gather → Build → Prep → Bake
   - Name bakery, customize exterior & baker at startup
   - Walk around to gather any ingredients (even wrong ones!)
   - Multi-item orders — each customer wants 1-3 things
   - No recipes shown — figure it out through trial & error
   - No instructions — discover the controls yourself
   ========================================================================== */

(function () {
  'use strict';

  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var W = 960, H = 640;

  // ========================================================================
  //  RECIPES — 4 ingredients each (player must figure these out!)
  // ========================================================================
  var RECIPES = {
    cookies: {
      name: 'Cookies', emoji: '\u{1F36A}',
      ingredients: ['Flour', 'Butter', 'Sugar', 'Egg'],
      mixTarget: 3.5,
      bakeIdeal: 7, bakeBurn: 11,
      color: '#D4A574', points: 100,
      miniGame: 'rolling'
    },
    bread: {
      name: 'Bread', emoji: '\u{1F35E}',
      ingredients: ['Flour', 'Water', 'Yeast', 'Salt'],
      mixTarget: 4.0,
      bakeIdeal: 12, bakeBurn: 18,
      color: '#C4A35A', points: 150,
      miniGame: 'kneading'
    },
    brownies: {
      name: 'Brownies', emoji: '\u{1F36B}',
      ingredients: ['Flour', 'Cocoa', 'Butter', 'Egg'],
      mixTarget: 3.0,
      bakeIdeal: 9, bakeBurn: 14,
      color: '#5C3317', points: 120,
      miniGame: 'spreading'
    },
    cake: {
      name: 'Cake', emoji: '\u{1F382}',
      ingredients: ['Flour', 'Sugar', 'Egg', 'Milk'],
      mixTarget: 3.5,
      bakeIdeal: 16, bakeBurn: 23,
      color: '#F5DEB3', points: 180,
      miniGame: 'layering'
    }
  };

  // Multi-item orders — each customer orders 1-3 things!
  var ORDER_QUEUE = [
    { items: ['cookies', 'bread'],          cust: 'Ms. Lee',     custEmoji: '\u{1F469}' },
    { items: ['brownies', 'cake'],          cust: 'Mr. Park',    custEmoji: '\u{1F468}' },
    { items: ['cookies', 'cake', 'bread'],  cust: 'Chef Anna',   custEmoji: '\u{1F469}\u200D\u{1F373}' },
    { items: ['brownies', 'cookies'],       cust: 'Little Tim',  custEmoji: '\u{1F9D2}' },
    { items: ['bread', 'cake', 'cookies'],  cust: 'Grandma Rose', custEmoji: '\u{1F475}' },
    { items: ['cake'],                      cust: 'Mr. Lee',     custEmoji: '\u{1F935}' },
  ];

  // ========================================================================
  //  INGREDIENTS — 14 total (player can pick up ANY, even wrong ones)
  // ========================================================================
  var ALL_INGREDIENTS = [
    { name: 'Flour',    icon: '\u{1F33E}', color: '#F5F0E0' },
    { name: 'Sugar',    icon: '\u{1F36C}', color: '#FFE0B0' },
    { name: 'Butter',   icon: '\u{1F9C8}', color: '#FFF8DC' },
    { name: 'Egg',      icon: '\u{1F95A}', color: '#FFF5E0' },
    { name: 'Water',    icon: '\u{1F4A7}', color: '#B0E0E6' },
    { name: 'Yeast',    icon: '\u{1F7E1}', color: '#FFD700' },
    { name: 'Cocoa',    icon: '\u{1F7E4}', color: '#8B4513' },
    { name: 'Salt',     icon: '\u{1F9C2}', color: '#F0F0F0' },
    { name: 'Milk',     icon: '\u{1F95B}', color: '#FFFAFA' },
    { name: 'Oil',      icon: '\u{1FAD7}', color: '#DAA520' },
    { name: 'Vanilla',  icon: '\u{1F33F}', color: '#90EE90' },
    { name: 'B.Sugar',  icon: '\u{1F36F}', color: '#D2691E' },
    { name: 'B.Soda',   icon: '\u{1FAD9}', color: '#E0E0E0' },
    { name: 'B.Powder', icon: '\u{1F4E6}', color: '#FFF8DC' }
  ];

  // ========================================================================
  //  STATION LAYOUT — 5 tabs
  // ========================================================================
  var TAB_Y = 570, TAB_H = 70;
  var TABS = [
    { id: 'order',  label: 'Orders', icon: '\u{1F4CB}', x: 0,   w: 192 },
    { id: 'gather', label: 'Gather', icon: '\u{1F6B6}', x: 192, w: 192 },
    { id: 'build',  label: 'Build',  icon: '\u{1F963}', x: 384, w: 192 },
    { id: 'prep',   label: 'Prep',   icon: '\u{270B}', x: 576, w: 192 },
    { id: 'bake',   label: 'Bake',   icon: '\u{1F525}', x: 768, w: 192 }
  ];

  // Build station bowl
  var BOWL = { x: 480, y: 310, r: 75 };

  // Ovens
  var OVEN_W = 170, OVEN_H = 230, OVEN_GAP = 18;
  var OVEN_START_X = (W - (4 * OVEN_W + 3 * OVEN_GAP)) / 2;
  var OVEN_Y = 110;

  // Gather station layout
  var GATHER_STATIONS = [];
  var BOWL_GATHER = { x: 480, y: 340, r: 42 };

  function initGatherStations() {
    GATHER_STATIONS = [];
    // Top shelf: 7 ingredients (indices 0-6)
    for (var i = 0; i < 7; i++) {
      GATHER_STATIONS.push({
        ing: ALL_INGREDIENTS[i],
        cx: 140 + i * 105,
        cy: 105,
        taken: false,
        shelf: 'top'
      });
    }
    // Left shelf: 3 ingredients (indices 7-9)
    for (var i = 0; i < 3; i++) {
      GATHER_STATIONS.push({
        ing: ALL_INGREDIENTS[7 + i],
        cx: 65,
        cy: 185 + i * 95,
        taken: false,
        shelf: 'left'
      });
    }
    // Right shelf: 4 ingredients (indices 10-13)
    for (var i = 0; i < 4; i++) {
      GATHER_STATIONS.push({
        ing: ALL_INGREDIENTS[10 + i],
        cx: 895,
        cy: 185 + i * 95,
        taken: false,
        shelf: 'right'
      });
    }
  }

  // ========================================================================
  //  CUSTOMIZATION OPTIONS
  // ========================================================================
  var WALL_COLORS  = ['#F5E6D3', '#A8D8F0', '#C8E6C9', '#FFCDD2', '#E8D5B7'];
  var WALL_NAMES   = ['Cream', 'Sky', 'Mint', 'Rose', 'Wheat'];
  var ROOF_COLORS  = ['#C04F3E', '#8B5E3C', '#3D5A80', '#5C9049', '#6B3A5B'];
  var ROOF_NAMES   = ['Red', 'Brown', 'Navy', 'Green', 'Plum'];
  var DOOR_COLORS  = ['#8B5E3C', '#C04F3E', '#3D5A80', '#5C9049'];
  var DOOR_NAMES   = ['Wood', 'Red', 'Blue', 'Green'];
  var DECORATIONS  = ['none', 'plant', 'awning', 'flag', 'lantern'];
  var DECOR_NAMES  = ['None', 'Plant', 'Awning', 'Flag', 'Lantern'];

  // Baker customization
  var SKIN_COLORS  = ['#FFDBAC', '#D4A574', '#8B5E3C', '#C68642'];
  var SKIN_NAMES   = ['Fair', 'Warm', 'Tan', 'Deep'];
  var APRON_COLORS = ['#E85D3A', '#5C9049', '#4A90D9', '#8B5E3C', '#9B59B6'];
  var APRON_NAMES  = ['Red', 'Green', 'Blue', 'Brown', 'Purple'];
  var HAT_STYLES   = ['classic', 'tall', 'beret'];
  var HAT_NAMES    = ['Classic', 'Tall', 'Beret'];

  // ========================================================================
  //  GAME STATE
  // ========================================================================
  var state = {};
  var keys = {};
  var nameInput = '';
  var spacePressedLast = false;

  function resetGame() {
    state = {
      screen: 'startup-name',
      bakeryName: '',
      customize: { wallIdx: 0, roofIdx: 0, doorIdx: 0, decorIdx: 0 },
      bakerCustomize: { skinIdx: 0, apronIdx: 0, hatIdx: 0 },
      station: 'order',
      timeLeft: 300,
      score: 0,
      orderIdx: 0,
      servedCount: 0,
      comboCount: 0,

      // Multi-item order tracking
      activeOrderItems: [],
      activeOrderCustomer: '',
      activeOrderCustEmoji: '',
      activeOrderTotal: 0,

      // Chef (gather station) — uses baker customization when rendered
      chef: { x: 480, y: 430, facing: 'down', carrying: null, carryingStation: -1 },

      // Bowl
      bowl: {
        ingredients: [],
        mixed: false,
        mixing: false,
        mixProgress: 0,
        mixQuality: null,
        recipe: null
      },

      // Prep
      prepGame: null,
      prepDone: false,
      prepQuality: null,
      prepData: {},

      // Batter — can queue multiple if order has many items
      readyBatters: [],

      // Ovens
      ovens: [
        { occupied: false, recipe: null, time: 0, done: false, quality: null, mixQ: null, prepQ: null, ingredients: [] },
        { occupied: false, recipe: null, time: 0, done: false, quality: null, mixQ: null, prepQ: null, ingredients: [] },
        { occupied: false, recipe: null, time: 0, done: false, quality: null, mixQ: null, prepQ: null, ingredients: [] },
        { occupied: false, recipe: null, time: 0, done: false, quality: null, mixQ: null, prepQ: null, ingredients: [] }
      ],

      // Mouse
      mouseX: 0, mouseY: 0,
      mouseDown: false,
      prevMouseX: 0, prevMouseY: 0,
      justClicked: false,

      // Mixing
      mixLastAngle: null,
      mixTotalRotation: 0,

      // Effects
      particles: [],
      sparkles: [],
      feedback: null,
      shakeAmount: 0,
      scorePopup: null,
      animTime: 0
    };
    nameInput = '';
    initGatherStations();
  }

  // ========================================================================
  //  MOUSE INPUT
  // ========================================================================
  function getMousePos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  canvas.addEventListener('mousemove', function (e) {
    var p = getMousePos(e);
    state.prevMouseX = state.mouseX;
    state.prevMouseY = state.mouseY;
    state.mouseX = p.x;
    state.mouseY = p.y;
  });

  canvas.addEventListener('mousedown', function (e) {
    var p = getMousePos(e);
    state.mouseX = p.x;
    state.mouseY = p.y;
    state.mouseDown = true;
    state.justClicked = true;
  });

  canvas.addEventListener('mouseup', function (e) {
    state.mouseDown = false;
    if (state.station === 'prep' && state.prepGame === 'layering') {
      handleLayeringRelease();
    }
  });

  canvas.addEventListener('mouseleave', function () {
    state.mouseDown = false;
  });

  // ========================================================================
  //  KEYBOARD INPUT
  // ========================================================================
  window.addEventListener('keydown', function (e) {
    var key = e.key;
    var keyLower = key.toLowerCase();
    keys[keyLower] = true;

    // Name input
    if (state.screen === 'startup-name') {
      if (key === 'Backspace') {
        nameInput = nameInput.slice(0, -1);
        e.preventDefault();
      } else if (key === 'Enter') {
        if (nameInput.trim().length > 0) {
          state.bakeryName = nameInput.trim();
          state.screen = 'startup-customize';
        }
        e.preventDefault();
      } else if (key.length === 1 && nameInput.length < 20) {
        if (/[a-zA-Z0-9 .'"!?_-]/.test(key)) {
          nameInput += key;
          e.preventDefault();
        }
      }
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(key) !== -1) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', function (e) {
    keys[e.key.toLowerCase()] = false;
  });

  // ========================================================================
  //  HELPERS
  // ========================================================================
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function pointInRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  }

  function spawnParticles(x, y, count, color, speed) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = speed * (0.3 + Math.random() * 0.7);
      state.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 0.5 + Math.random() * 0.5,
        color: color,
        size: 2 + Math.random() * 3
      });
    }
  }

  function spawnSparkles(x, y, count) {
    for (var i = 0; i < count; i++) {
      state.sparkles.push({
        x: x + (Math.random() - 0.5) * 100,
        y: y + (Math.random() - 0.5) * 50,
        vx: (Math.random() - 0.5) * 80,
        vy: -50 - Math.random() * 60,
        life: 1 + Math.random() * 1.5,
        size: 2 + Math.random() * 4
      });
    }
  }

  function showFeedback(text, color, duration) {
    state.feedback = { text: text, color: color, timer: duration || 2 };
  }

  function showScorePopup(text, x, y) {
    state.scorePopup = { text: text, timer: 3, x: x, y: y };
  }

  function mixColor(c1, c2, t) {
    var r1 = parseInt(c1.slice(1, 3), 16);
    var g1 = parseInt(c1.slice(3, 5), 16);
    var b1 = parseInt(c1.slice(5, 7), 16);
    var r2 = parseInt(c2.slice(1, 3), 16);
    var g2 = parseInt(c2.slice(3, 5), 16);
    var b2 = parseInt(c2.slice(5, 7), 16);
    var r = Math.round(r1 + (r2 - r1) * t);
    var g = Math.round(g1 + (g2 - g1) * t);
    var b = Math.round(b1 + (b2 - b1) * t);
    return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
  }

  function getNextRecipeForOrder() {
    if (!state.activeOrderItems || state.activeOrderItems.length === 0) return null;
    for (var i = 0; i < state.activeOrderItems.length; i++) {
      if (state.activeOrderItems[i] !== null) return state.activeOrderItems[i];
    }
    return null;
  }

  // ========================================================================
  //  STATION SWITCHING
  // ========================================================================
  function switchStation(id) {
    // Return carried item when leaving gather
    if (state.station === 'gather' && id !== 'gather' && state.chef.carrying) {
      if (state.chef.carryingStation >= 0) {
        GATHER_STATIONS[state.chef.carryingStation].taken = false;
      }
      state.chef.carrying = null;
      state.chef.carryingStation = -1;
    }

    state.station = id;

    // Reset mixing tracking when leaving build
    if (id !== 'build') {
      state.mixLastAngle = null;
      if (state.bowl.mixing) finishMixing();
    }
  }

  // ========================================================================
  //  STARTUP — Name Input
  // ========================================================================
  function updateStartupName(dt) {
    if (state.justClicked) {
      if (pointInRect(state.mouseX, state.mouseY, 330, 460, 300, 55)) {
        if (nameInput.trim().length > 0) {
          state.bakeryName = nameInput.trim();
          state.screen = 'startup-customize';
        }
      }
    }
  }

  function renderStartupName() {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#F5E6D3');
    bg.addColorStop(0.5, '#FAF0E6');
    bg.addColorStop(1, '#EDD9C0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Soft vignette
    var vig = ctx.createRadialGradient(W/2, H/2, 200, W/2, H/2, 600);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Floating decorations
    var decos = ['\u{1F36A}', '\u{1F382}', '\u{1F35E}', '\u{1F36B}', '\u{1F9C1}'];
    for (var i = 0; i < decos.length; i++) {
      var dx = 100 + i * 180;
      var dy = 130 + Math.sin(state.animTime * 2 + i) * 12;
      ctx.font = '36px Arial';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.3;
      ctx.fillText(decos[i], dx, dy);
    }
    ctx.globalAlpha = 1.0;

    // Title
    ctx.font = 'bold 48px Georgia';
    ctx.fillStyle = '#5C3D2E';
    ctx.textAlign = 'center';
    ctx.fillText('Name Your Bakery', W / 2, 260);

    // Text input field with shadow
    var fx = 230, fy = 310, fw = 500, fh = 70;
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    rrect(fx + 3, fy + 3, fw, fh, 12); ctx.fill();
    ctx.fillStyle = '#FFFEF5';
    rrect(fx, fy, fw, fh, 12); ctx.fill();
    ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 3; ctx.stroke();

    ctx.font = 'bold 32px Georgia';
    ctx.fillStyle = '#5C3D2E';
    ctx.textAlign = 'center';
    var displayText = nameInput || '';
    ctx.fillText(displayText, W / 2, fy + 46);

    if (Math.floor(state.animTime * 2) % 2 === 0) {
      var tw = ctx.measureText(displayText).width;
      ctx.fillStyle = '#5C3D2E';
      ctx.fillRect(W / 2 + tw / 2 + 4, fy + 18, 3, 34);
    }

    var btnX = 330, btnY = 460, btnW = 300, btnH = 55;
    var canStart = nameInput.trim().length > 0;
    var hover = pointInRect(state.mouseX, state.mouseY, btnX, btnY, btnW, btnH);
    var bg2 = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
    if (canStart) {
      bg2.addColorStop(0, hover ? '#8FCC7F' : '#7FB069');
      bg2.addColorStop(1, hover ? '#6FB05F' : '#5C9049');
    } else {
      bg2.addColorStop(0, '#CCC');
      bg2.addColorStop(1, '#AAA');
    }
    ctx.fillStyle = bg2;
    rrect(btnX, btnY, btnW, btnH, 14); ctx.fill();
    // Button shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    rrect(btnX, btnY + 3, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = bg2;
    rrect(btnX, btnY, btnW, btnH, 14); ctx.fill();
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = canStart ? '#FFF' : '#888';
    ctx.fillText('Continue  \u2192', W / 2, btnY + 36);

    ctx.textAlign = 'start';
  }

  // ========================================================================
  //  STARTUP — Customize Exterior
  // ========================================================================
  function updateStartupCustomize(dt) {
    if (!state.justClicked) return;
    var mx = state.mouseX, my = state.mouseY;

    if (pointInRect(mx, my, 655, 145, 30, 36)) {
      state.customize.wallIdx = (state.customize.wallIdx - 1 + WALL_COLORS.length) % WALL_COLORS.length;
    }
    if (pointInRect(mx, my, 780, 145, 30, 36)) {
      state.customize.wallIdx = (state.customize.wallIdx + 1) % WALL_COLORS.length;
    }
    if (pointInRect(mx, my, 655, 200, 30, 36)) {
      state.customize.roofIdx = (state.customize.roofIdx - 1 + ROOF_COLORS.length) % ROOF_COLORS.length;
    }
    if (pointInRect(mx, my, 780, 200, 30, 36)) {
      state.customize.roofIdx = (state.customize.roofIdx + 1) % ROOF_COLORS.length;
    }
    if (pointInRect(mx, my, 655, 255, 30, 36)) {
      state.customize.doorIdx = (state.customize.doorIdx - 1 + DOOR_COLORS.length) % DOOR_COLORS.length;
    }
    if (pointInRect(mx, my, 780, 255, 30, 36)) {
      state.customize.doorIdx = (state.customize.doorIdx + 1) % DOOR_COLORS.length;
    }
    if (pointInRect(mx, my, 655, 310, 30, 36)) {
      state.customize.decorIdx = (state.customize.decorIdx - 1 + DECORATIONS.length) % DECORATIONS.length;
    }
    if (pointInRect(mx, my, 780, 310, 30, 36)) {
      state.customize.decorIdx = (state.customize.decorIdx + 1) % DECORATIONS.length;
    }
    if (pointInRect(mx, my, 330, 490, 300, 55)) {
      state.screen = 'startup-baker';
    }
  }

  function renderStartupCustomize() {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#F5E6D3');
    bg.addColorStop(1, '#EDD9C0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.font = 'bold 34px Georgia';
    ctx.fillStyle = '#5C3D2E';
    ctx.textAlign = 'center';
    ctx.fillText('Customize Your Bakery', W / 2, 55);

    renderBakeryExterior(80, 80, 400, 370);

    var px = 500, py = 95, pw = 380, ph = 290;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rrect(px, py, pw, ph, 12); ctx.fill();
    ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 2; ctx.stroke();

    var rows = [
      { label: 'Wall',  y: 145, idx: state.customize.wallIdx,  names: WALL_NAMES,  colors: WALL_COLORS },
      { label: 'Roof',  y: 200, idx: state.customize.roofIdx,  names: ROOF_NAMES,  colors: ROOF_COLORS },
      { label: 'Door',  y: 255, idx: state.customize.doorIdx,  names: DOOR_NAMES,  colors: DOOR_COLORS },
      { label: 'Decor', y: 310, idx: state.customize.decorIdx, names: DECOR_NAMES,  colors: null }
    ];

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#5C3D2E';
      ctx.textAlign = 'left';
      ctx.fillText(r.label, px + 20, r.y + 24);

      var laHover = pointInRect(state.mouseX, state.mouseY, 655, r.y, 30, 36);
      ctx.fillStyle = laHover ? '#D4A574' : '#E8D5C0';
      rrect(655, r.y, 30, 36, 6); ctx.fill();
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#5C3D2E';
      ctx.textAlign = 'center';
      ctx.fillText('\u25C0', 670, r.y + 25);

      if (r.colors) {
        ctx.fillStyle = r.colors[r.idx];
        rrect(695, r.y, 70, 36, 6); ctx.fill();
        ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.stroke();
      } else {
        ctx.fillStyle = '#FFFEF5';
        rrect(695, r.y, 70, 36, 6); ctx.fill();
        ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = '12px Arial';
        ctx.fillStyle = '#5C3D2E';
        ctx.fillText(r.names[r.idx], 730, r.y + 23);
      }

      ctx.font = '10px Arial';
      ctx.fillStyle = '#888';
      ctx.fillText(r.names[r.idx], 730, r.y + 50);

      var raHover = pointInRect(state.mouseX, state.mouseY, 780, r.y, 30, 36);
      ctx.fillStyle = raHover ? '#D4A574' : '#E8D5C0';
      rrect(780, r.y, 30, 36, 6); ctx.fill();
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#5C3D2E';
      ctx.fillText('\u25B6', 795, r.y + 25);
    }
    ctx.textAlign = 'start';

    var btnX = 330, btnY = 490, btnW = 300, btnH = 55;
    var hover = pointInRect(state.mouseX, state.mouseY, btnX, btnY, btnW, btnH);
    var bg2 = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
    bg2.addColorStop(0, hover ? '#E87A5A' : '#E85D3A');
    bg2.addColorStop(1, hover ? '#C8553A' : '#C04F3E');
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    rrect(btnX, btnY + 3, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = bg2;
    rrect(btnX, btnY, btnW, btnH, 14); ctx.fill();
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.fillText('Next: Baker  \u2192', W / 2, btnY + 36);
    ctx.textAlign = 'start';
  }

  // ========================================================================
  //  STARTUP — Customize Baker
  // ========================================================================
  function updateStartupBaker(dt) {
    if (!state.justClicked) return;
    var mx = state.mouseX, my = state.mouseY;

    if (pointInRect(mx, my, 655, 145, 30, 36)) {
      state.bakerCustomize.skinIdx = (state.bakerCustomize.skinIdx - 1 + SKIN_COLORS.length) % SKIN_COLORS.length;
    }
    if (pointInRect(mx, my, 780, 145, 30, 36)) {
      state.bakerCustomize.skinIdx = (state.bakerCustomize.skinIdx + 1) % SKIN_COLORS.length;
    }
    if (pointInRect(mx, my, 655, 200, 30, 36)) {
      state.bakerCustomize.apronIdx = (state.bakerCustomize.apronIdx - 1 + APRON_COLORS.length) % APRON_COLORS.length;
    }
    if (pointInRect(mx, my, 780, 200, 30, 36)) {
      state.bakerCustomize.apronIdx = (state.bakerCustomize.apronIdx + 1) % APRON_COLORS.length;
    }
    if (pointInRect(mx, my, 655, 255, 30, 36)) {
      state.bakerCustomize.hatIdx = (state.bakerCustomize.hatIdx - 1 + HAT_STYLES.length) % HAT_STYLES.length;
    }
    if (pointInRect(mx, my, 780, 255, 30, 36)) {
      state.bakerCustomize.hatIdx = (state.bakerCustomize.hatIdx + 1) % HAT_STYLES.length;
    }
    if (pointInRect(mx, my, 330, 490, 300, 55)) {
      state.screen = 'playing';
      switchStation('order');
    }
  }

  function renderStartupBaker() {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#F5E6D3');
    bg.addColorStop(1, '#EDD9C0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.font = 'bold 34px Georgia';
    ctx.fillStyle = '#5C3D2E';
    ctx.textAlign = 'center';
    ctx.fillText('Customize Your Baker', W / 2, 55);

    // Baker preview (left side)
    renderChef(250, 280, 'down', null);

    // Label under baker
    ctx.font = 'italic 16px Georgia';
    ctx.fillStyle = '#8B5E3C';
    ctx.fillText('Your baker', 250, 440);

    // Customization panel (right side)
    var px = 500, py = 95, pw = 380, ph = 250;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rrect(px, py, pw, ph, 12); ctx.fill();
    ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 2; ctx.stroke();

    var rows = [
      { label: 'Skin',  y: 145, idx: state.bakerCustomize.skinIdx,  names: SKIN_NAMES,  colors: SKIN_COLORS },
      { label: 'Apron', y: 200, idx: state.bakerCustomize.apronIdx, names: APRON_NAMES, colors: APRON_COLORS },
      { label: 'Hat',   y: 255, idx: state.bakerCustomize.hatIdx,   names: HAT_NAMES,   colors: null }
    ];

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#5C3D2E';
      ctx.textAlign = 'left';
      ctx.fillText(r.label, px + 20, r.y + 24);

      var laHover = pointInRect(state.mouseX, state.mouseY, 655, r.y, 30, 36);
      ctx.fillStyle = laHover ? '#D4A574' : '#E8D5C0';
      rrect(655, r.y, 30, 36, 6); ctx.fill();
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#5C3D2E';
      ctx.textAlign = 'center';
      ctx.fillText('\u25C0', 670, r.y + 25);

      if (r.colors) {
        ctx.fillStyle = r.colors[r.idx];
        rrect(695, r.y, 70, 36, 6); ctx.fill();
        ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.stroke();
      } else {
        ctx.fillStyle = '#FFFEF5';
        rrect(695, r.y, 70, 36, 6); ctx.fill();
        ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = '12px Arial';
        ctx.fillStyle = '#5C3D2E';
        ctx.fillText(r.names[r.idx], 730, r.y + 23);
      }

      ctx.font = '10px Arial';
      ctx.fillStyle = '#888';
      ctx.fillText(r.names[r.idx], 730, r.y + 50);

      var raHover = pointInRect(state.mouseX, state.mouseY, 780, r.y, 30, 36);
      ctx.fillStyle = raHover ? '#D4A574' : '#E8D5C0';
      rrect(780, r.y, 30, 36, 6); ctx.fill();
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#5C3D2E';
      ctx.fillText('\u25B6', 795, r.y + 25);
    }
    ctx.textAlign = 'start';

    var btnX = 330, btnY = 490, btnW = 300, btnH = 55;
    var hover = pointInRect(state.mouseX, state.mouseY, btnX, btnY, btnW, btnH);
    var bg2 = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
    bg2.addColorStop(0, hover ? '#8FCC7F' : '#7FB069');
    bg2.addColorStop(1, hover ? '#6FB05F' : '#5C9049');
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    rrect(btnX, btnY + 3, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = bg2;
    rrect(btnX, btnY, btnW, btnH, 14); ctx.fill();
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.fillText('Open Bakery! \u{1F511}', W / 2, btnY + 36);
    ctx.textAlign = 'start';
  }

  // ========================================================================
  //  COZY BAKERY EXTERIOR — detailed cafe-style rendering
  // ========================================================================
  function renderBakeryExterior(x, y, w, h) {
    // Sky with warm gradient
    var sky = ctx.createLinearGradient(x, y, x, y + h * 0.5);
    sky.addColorStop(0, '#87CEEB');
    sky.addColorStop(0.7, '#B8E4F0');
    sky.addColorStop(1, '#FFE8C8');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);

    // Distant clouds
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (var ci = 0; ci < 3; ci++) {
      var cx = x + 60 + ci * 110 + Math.sin(state.animTime * 0.3 + ci) * 15;
      var cy = y + 40 + ci * 15;
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 16, cy - 5, 14, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 30, cy, 16, 0, Math.PI * 2); ctx.fill();
    }

    // Cobblestone ground
    ctx.fillStyle = '#9B8B7A';
    ctx.fillRect(x, y + h - 55, w, 55);
    ctx.fillStyle = '#8B7B6A';
    for (var gx = x; gx < x + w; gx += 28) {
      for (var gy = y + h - 55; gy < y + h; gy += 18) {
        if ((Math.floor(gx/28) + Math.floor(gy/18)) % 3 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          rrect(gx + 1, gy + 1, 26, 16, 2); ctx.fill();
        }
      }
    }
    // Cobblestone edge
    ctx.fillStyle = '#7B6B5A';
    ctx.fillRect(x, y + h - 55, w, 3);

    // Building dimensions
    var bldW = 250, bldH = 210;
    var bldX = x + (w - bldW) / 2;
    var bldY = y + h - 55 - bldH;

    // Building shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(bldX - 22, bldY + 5);
    ctx.lineTo(bldX + bldW / 2, bldY - 62);
    ctx.lineTo(bldX + bldW + 22, bldY + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(bldX + 5, bldY + 3, bldW, bldH + 2);

    // Roof — detailed triangle with shingles
    var roofColor = ROOF_COLORS[state.customize.roofIdx];
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(bldX - 22, bldY);
    ctx.lineTo(bldX + bldW / 2, bldY - 68);
    ctx.lineTo(bldX + bldW + 22, bldY);
    ctx.closePath();
    ctx.fill();

    // Roof shingle lines
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (var rl = 1; rl < 5; rl++) {
      var ry = bldY - 68 + rl * 15;
      var startX = bldX - 22 + (bldW + 44) * (rl / 5) * 0.5;
      var endX = bldX + bldW + 22 - (bldW + 44) * (rl / 5) * 0.5;
      ctx.beginPath(); ctx.moveTo(startX, ry); ctx.lineTo(endX, ry); ctx.stroke();
    }

    // Roof highlight (sunlit side)
    var roofLight = mixColor(roofColor, '#FFFFFF', 0.15);
    ctx.fillStyle = roofLight;
    ctx.beginPath();
    ctx.moveTo(bldX - 22, bldY);
    ctx.lineTo(bldX + bldW / 2, bldY - 68);
    ctx.lineTo(bldX + bldW * 0.3, bldY);
    ctx.closePath();
    ctx.fill();

    // Chimney
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(bldX + bldW - 55, bldY - 78, 22, 35);
    ctx.fillStyle = '#A0782C';
    ctx.fillRect(bldX + bldW - 53, bldY - 76, 18, 30);
    // Chimney cap
    ctx.fillStyle = '#6B4F10';
    ctx.fillRect(bldX + bldW - 58, bldY - 81, 28, 6);

    // Smoke from chimney
    ctx.fillStyle = 'rgba(200,200,200,0.3)';
    for (var sm = 0; sm < 2; sm++) {
      var smX = bldX + bldW - 44 + Math.sin(state.animTime * 1.5 + sm) * 8;
      var smY = bldY - 90 - ((state.animTime * 18 + sm * 22) % 35);
      ctx.beginPath(); ctx.arc(smX, smY, 5 + sm * 2, 0, Math.PI * 2); ctx.fill();
    }

    // Decoration: flag on peak
    if (DECORATIONS[state.customize.decorIdx] === 'flag') {
      ctx.fillStyle = '#666';
      ctx.fillRect(bldX + bldW / 2 - 1, bldY - 88, 2, 28);
      ctx.fillStyle = '#E85D3A';
      ctx.beginPath();
      ctx.moveTo(bldX + bldW / 2 + 1, bldY - 86);
      ctx.lineTo(bldX + bldW / 2 + 22, bldY - 80);
      ctx.lineTo(bldX + bldW / 2 + 1, bldY - 74);
      ctx.closePath();
      ctx.fill();
    }

    // Decoration: lantern hanging from roof peak
    if (DECORATIONS[state.customize.decorIdx] === 'lantern') {
      ctx.fillStyle = '#666';
      ctx.fillRect(bldX + bldW / 2 - 1, bldY - 65, 2, 22);
      ctx.fillStyle = '#FFD700';
      ctx.globalAlpha = 0.4 + Math.sin(state.animTime * 2.5) * 0.15;
      ctx.beginPath(); ctx.arc(bldX + bldW / 2, bldY - 40, 10, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // Wall
    var wallColor = WALL_COLORS[state.customize.wallIdx];
    ctx.fillStyle = wallColor;
    ctx.fillRect(bldX, bldY, bldW, bldH);

    // Wall brick/panel lines
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    for (var by2 = bldY; by2 < bldY + bldH; by2 += 32) {
      ctx.beginPath(); ctx.moveTo(bldX, by2); ctx.lineTo(bldX + bldW, by2); ctx.stroke();
    }

    // Wall shadow on right side
    var wallShadow = mixColor(wallColor, '#000000', 0.1);
    ctx.fillStyle = wallShadow;
    ctx.fillRect(bldX + bldW - 35, bldY, 35, bldH);

    // Sign with chain
    ctx.fillStyle = '#555';
    ctx.fillRect(bldX + bldW / 2 - 1, bldY + 5, 2, 18);
    ctx.fillRect(bldX + bldW / 2 - 60, bldY + 19, 120, 2);
    ctx.fillRect(bldX + bldW / 2 - 61, bldY + 12, 2, 10);
    ctx.fillRect(bldX + bldW / 2 + 59, bldY + 19, 2, 3);

    // Sign board
    var signBX = bldX + 25, signBY = bldY + 22, signBW = bldW - 50, signBH = 32;
    ctx.fillStyle = '#3D2817';
    rrect(signBX, signBY, signBW, signBH, 5); ctx.fill();
    ctx.fillStyle = '#2A1A0E';
    rrect(signBX + 2, signBY + 2, signBW - 4, signBH - 4, 4); ctx.fill();

    ctx.font = 'bold 14px Georgia';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    var displayName = state.bakeryName || 'Bakery';
    if (displayName.length > 18) displayName = displayName.substring(0, 17) + '...';
    ctx.fillText(displayName, bldX + bldW / 2, signBY + 22);
    ctx.textAlign = 'start';

    // Upper window (decorative arched)
    ctx.fillStyle = '#FFFEF5';
    ctx.beginPath();
    ctx.arc(bldX + bldW / 2, bldY + 70, 20, Math.PI, 0);
    ctx.lineTo(bldX + bldW / 2 + 20, bldY + 90);
    ctx.arc(bldX + bldW / 2, bldY + 70, 20, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath();
    ctx.arc(bldX + bldW / 2, bldY + 70, 14, Math.PI, 0);
    ctx.lineTo(bldX + bldW / 2 + 14, bldY + 88);
    ctx.arc(bldX + bldW / 2, bldY + 70, 14, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5C3D2E'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bldX + bldW / 2, bldY + 56);
    ctx.lineTo(bldX + bldW / 2, bldY + 80);
    ctx.moveTo(bldX + bldW / 2 - 14, bldY + 70);
    ctx.lineTo(bldX + bldW / 2 + 14, bldY + 70);
    ctx.stroke();
    // Warm glow in window
    ctx.fillStyle = 'rgba(255,220,150,0.3)';
    ctx.beginPath();
    ctx.arc(bldX + bldW / 2, bldY + 70, 14, Math.PI, 0);
    ctx.lineTo(bldX + bldW / 2 + 14, bldY + 88);
    ctx.arc(bldX + bldW / 2, bldY + 70, 14, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    // Side windows with window boxes
    function drawWindow(wx, wy, ww, wh) {
      // Frame
      ctx.fillStyle = '#5C3D2E';
      rrect(wx - 3, wy - 3, ww + 6, wh + 6, 4); ctx.fill();
      ctx.fillStyle = '#FFFEF5';
      rrect(wx, wy, ww, wh, 3); ctx.fill();
      // Glass
      ctx.fillStyle = '#87CEEB';
      rrect(wx + 3, wy + 3, ww - 6, wh - 6, 2); ctx.fill();
      // Warm glow
      ctx.fillStyle = 'rgba(255,220,150,0.25)';
      rrect(wx + 3, wy + 3, ww - 6, wh - 6, 2); ctx.fill();
      // Cross bars
      ctx.strokeStyle = '#5C3D2E'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(wx + ww/2, wy); ctx.lineTo(wx + ww/2, wy + wh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx, wy + wh/2); ctx.lineTo(wx + ww, wy + wh/2); ctx.stroke();
      // Window box
      ctx.fillStyle = '#8B5E3C';
      rrect(wx - 5, wy + wh + 2, ww + 10, wh * 0.35, 3); ctx.fill();
      // Flowers in window box
      ctx.fillStyle = '#5C9049';
      ctx.beginPath(); ctx.ellipse(wx + ww/2 - 8, wy + wh + 1, 6, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(wx + ww/2 + 8, wy + wh + 1, 6, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#FF69B4';
      ctx.beginPath(); ctx.arc(wx + ww/2 - 8, wy + wh - 6, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(wx + ww/2 + 8, wy + wh - 5, 3, 0, Math.PI*2); ctx.fill();
    }

    drawWindow(bldX + 18, bldY + 75, 45, 45);
    drawWindow(bldX + bldW - 63, bldY + 75, 45, 45);

    // Decoration: awning
    if (DECORATIONS[state.customize.decorIdx] === 'awning') {
      var awY = bldY + 125;
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      rrect(bldX + 15, awY + 2, bldW - 30, 22, 0); ctx.fill();
      for (var ai = 0; ai < 8; ai++) {
        ctx.fillStyle = ai % 2 === 0 ? '#E85D3A' : '#FFF8DC';
        ctx.beginPath();
        ctx.moveTo(bldX + 15 + ai * (bldW - 30) / 8, awY);
        ctx.lineTo(bldX + 15 + (ai + 1) * (bldW - 30) / 8, awY);
        ctx.lineTo(bldX + 15 + (ai + 1) * (bldW - 30) / 8, awY + 20);
        ctx.lineTo(bldX + 15 + ai * (bldW - 30) / 8, awY + 20);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Door — detailed
    var doorColor = DOOR_COLORS[state.customize.doorIdx];
    var doorX = bldX + bldW / 2 - 28, doorY = bldY + bldH - 85, doorW2 = 56, doorH2 = 85;
    // Door frame
    ctx.fillStyle = '#5C3D2E';
    rrect(doorX - 4, doorY - 4, doorW2 + 8, doorH2 + 8, 6); ctx.fill();
    // Door
    ctx.fillStyle = doorColor;
    rrect(doorX, doorY, doorW2, doorH2, 4); ctx.fill();
    // Door panels
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
    rrect(doorX + 6, doorY + 8, doorW2 - 12, doorH2 * 0.38, 2); ctx.stroke();
    rrect(doorX + 6, doorY + doorH2 * 0.42 + 2, doorW2 - 12, doorH2 * 0.52, 2); ctx.stroke();
    // Door handle
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(doorX + doorW2 - 12, doorY + doorH2 / 2 + 5, 3.5, 0, Math.PI * 2); ctx.fill();
    // Door window
    ctx.fillStyle = '#FFFEF5';
    rrect(doorX + 10, doorY + 8, doorW2 - 20, doorH2 * 0.35, 3); ctx.fill();
    ctx.fillStyle = '#87CEEB';
    rrect(doorX + 13, doorY + 11, doorW2 - 26, doorH2 * 0.35 - 6, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,150,0.2)';
    rrect(doorX + 13, doorY + 11, doorW2 - 26, doorH2 * 0.35 - 6, 2); ctx.fill();

    // Door step
    ctx.fillStyle = '#A09080';
    rrect(doorX - 15, doorY + doorH2, doorW2 + 30, 8, 2); ctx.fill();

    // Decoration: plant
    if (DECORATIONS[state.customize.decorIdx] === 'plant') {
      // Pot
      ctx.fillStyle = '#C04F3E';
      rrect(doorX - 40, doorY + doorH2 - 30, 28, 32, 3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      rrect(doorX - 40, doorY + doorH2 - 30, 14, 32, 3); ctx.fill();
      // Leaves
      ctx.fillStyle = '#5C9049';
      ctx.beginPath(); ctx.arc(doorX - 26, doorY + doorH2 - 42, 16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#7FB069';
      ctx.beginPath(); ctx.arc(doorX - 34, doorY + doorH2 - 50, 11, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(doorX - 18, doorY + doorH2 - 48, 9, 0, Math.PI*2); ctx.fill();
    }

    // Sidewalk
    ctx.fillStyle = '#C4A882';
    ctx.fillRect(bldX - 25, y + h - 55, bldW + 50, 10);
    // Sidewalk line
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bldX - 25, y + h - 48); ctx.lineTo(bldX + bldW + 25, y + h - 48); ctx.stroke();
  }

  // ========================================================================
  //  GATHER STATION — walk around to collect ANY ingredients
  //  (No restrictions — pick up whatever you want, including wrong ones!)
  // ========================================================================
  function updateGather(dt) {
    // Movement
    var dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    var speed = 230;
    var newX = state.chef.x + dx * speed * dt;
    var newY = state.chef.y + dy * speed * dt;

    newX = Math.max(115, Math.min(845, newX));
    newY = Math.max(140, Math.min(555, newY));

    state.chef.x = newX;
    state.chef.y = newY;

    if (dx < -0.1) state.chef.facing = 'left';
    else if (dx > 0.1) state.chef.facing = 'right';
    else if (dy < -0.1) state.chef.facing = 'up';
    else if (dy > 0.1) state.chef.facing = 'down';

    // Ingredient pickup — NO recipe check, pick up ANYTHING
    if (!state.chef.carrying) {
      for (var i = 0; i < GATHER_STATIONS.length; i++) {
        var st = GATHER_STATIONS[i];
        if (!st.taken && dist(state.chef.x, state.chef.y, st.cx, st.cy) < 42) {
          state.chef.carrying = st.ing;
          state.chef.carryingStation = i;
          st.taken = true;
          break;
        }
      }
    }

    // Bowl drop-off — accept ANY ingredient, no duplicate check
    if (state.chef.carrying && dist(state.chef.x, state.chef.y, BOWL_GATHER.x, BOWL_GATHER.y) < 55) {
      if (state.bowl.ingredients.length < 4) {
        state.bowl.ingredients.push(state.chef.carrying);
        spawnParticles(BOWL_GATHER.x, BOWL_GATHER.y, 8, state.chef.carrying.color || '#FFF', 40);
        state.chef.carrying = null;
        state.chef.carryingStation = -1;
      }
    }

    // Drop/Return item (space)
    var spaceNow = !!keys[' '];
    if (spaceNow && !spacePressedLast && state.chef.carrying) {
      if (state.chef.carryingStation >= 0) {
        GATHER_STATIONS[state.chef.carryingStation].taken = false;
      }
      state.chef.carrying = null;
      state.chef.carryingStation = -1;
    }

    // Remove last ingredient from bowl (space near bowl, not carrying)
    if (spaceNow && !spacePressedLast && !state.chef.carrying && state.bowl.ingredients.length > 0) {
      if (dist(state.chef.x, state.chef.y, BOWL_GATHER.x, BOWL_GATHER.y) < 55) {
        var removed = state.bowl.ingredients.pop();
        for (var r = 0; r < GATHER_STATIONS.length; r++) {
          if (GATHER_STATIONS[r].ing.name === removed.name) {
            GATHER_STATIONS[r].taken = false;
            break;
          }
        }
      }
    }

    spacePressedLast = spaceNow;
  }

  function renderGather() {
    // Kitchen floor — warm tile pattern
    var floorY = 65, floorH = 500;
    for (var fy = 0; fy < floorH; fy += 45) {
      for (var fx = 0; fx < W; fx += 55) {
        var odd = (Math.floor(fy / 45) + Math.floor(fx / 55)) % 2;
        if (odd) {
          ctx.fillStyle = '#E8D5C0';
        } else {
          var warmth = Math.abs(fx - W/2) / (W/2);
          ctx.fillStyle = '#F5E8D8';
        }
        ctx.fillRect(fx, floorY + fy, 55, 45);
        ctx.strokeStyle = 'rgba(180,160,130,0.15)'; ctx.lineWidth = 0.5;
        ctx.strokeRect(fx, floorY + fy, 55, 45);
      }
    }

    // Top shelf — detailed wood
    var shelfW = 810, shelfH = 55, shelfX = 75;
    // Shelf shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    rrect(shelfX + 2, 82, shelfW, shelfH, 8); ctx.fill();
    // Shelf body
    var shelfGrad = ctx.createLinearGradient(0, 75, 0, 135);
    shelfGrad.addColorStop(0, '#A0782C');
    shelfGrad.addColorStop(0.3, '#C49A3C');
    shelfGrad.addColorStop(0.7, '#8B6914');
    shelfGrad.addColorStop(1, '#6B4F10');
    ctx.fillStyle = shelfGrad;
    rrect(shelfX, 75, shelfW, shelfH, 8); ctx.fill();
    // Shelf top edge highlight
    ctx.fillStyle = '#D4A84C';
    rrect(shelfX + 5, 75, shelfW - 10, 8, 6); ctx.fill();
    ctx.fillStyle = '#6B4F10';
    ctx.fillRect(shelfX, 128, shelfW, 4);

    // Left shelf — detailed
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    rrect(32, 162, 80, 290, 8); ctx.fill();
    var lsGrad = ctx.createLinearGradient(25, 160, 115, 160);
    lsGrad.addColorStop(0, '#6B4F10');
    lsGrad.addColorStop(0.3, '#A0782C');
    lsGrad.addColorStop(0.7, '#8B6914');
    lsGrad.addColorStop(1, '#6B4F10');
    ctx.fillStyle = lsGrad;
    rrect(30, 160, 80, 290, 8); ctx.fill();
    ctx.fillStyle = '#D4A84C';
    ctx.fillRect(30, 160, 80, 4);

    // Right shelf — detailed
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    rrect(852, 162, 80, 380, 8); ctx.fill();
    var rsGrad = ctx.createLinearGradient(845, 160, 935, 160);
    rsGrad.addColorStop(0, '#6B4F10');
    rsGrad.addColorStop(0.3, '#A0782C');
    rsGrad.addColorStop(0.7, '#8B6914');
    rsGrad.addColorStop(1, '#6B4F10');
    ctx.fillStyle = rsGrad;
    rrect(850, 160, 80, 380, 8); ctx.fill();
    ctx.fillStyle = '#D4A84C';
    ctx.fillRect(850, 160, 80, 4);

    // String lights across top
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(120, 72); ctx.quadraticCurveTo(W/2, 100, W - 120, 72); ctx.stroke();
    for (var li = 0; li < 7; li++) {
      var lx = 140 + li * 115;
      var ly = 82 + Math.sin(li * 1.2) * 15;
      ctx.fillStyle = (li % 3 === 0) ? '#FFD700' : ((li % 3 === 1) ? '#FF6B6B' : '#87CEEB');
      ctx.globalAlpha = 0.5 + Math.sin(state.animTime * 3 + li) * 0.3;
      ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Ingredient stations
    for (var i = 0; i < GATHER_STATIONS.length; i++) {
      var st = GATHER_STATIONS[i];
      if (st.taken) {
        ctx.strokeStyle = 'rgba(139,105,20,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        rrect(st.cx - 32, st.cy - 20, 64, 40, 5);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Container shadow
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        rrect(st.cx - 30, st.cy - 18, 64, 40, 5); ctx.fill();
        // Container
        ctx.fillStyle = '#FFFEF5';
        rrect(st.cx - 32, st.cy - 20, 64, 40, 5); ctx.fill();
        // Label area
        ctx.fillStyle = 'rgba(240,230,210,0.5)';
        rrect(st.cx - 32, st.cy - 20, 64, 28, 5); ctx.fill();
        ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 1.5; ctx.stroke();

        // Icon
        ctx.font = '22px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#333';
        ctx.fillText(st.ing.icon, st.cx, st.cy + 2);

        // Name
        ctx.font = '9px Arial';
        ctx.fillStyle = '#777';
        ctx.fillText(st.ing.name, st.cx, st.cy + 17);
      }
    }

    // Bowl in center — better shaded
    var bx = BOWL_GATHER.x, by = BOWL_GATHER.y, br = BOWL_GATHER.r;
    // Counter under bowl — wood grain
    var cGrad = ctx.createLinearGradient(0, by + br - 8, 0, by + br + 15);
    cGrad.addColorStop(0, '#C4A47A');
    cGrad.addColorStop(0.5, '#A0782C');
    cGrad.addColorStop(1, '#8B6914');
    ctx.fillStyle = cGrad;
    rrect(bx - br - 25, by + br - 5, (br + 25) * 2, 22, 6); ctx.fill();
    // Shadow under bowl
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(bx, by + br + 5, br + 10, 9, 0, 0, Math.PI * 2); ctx.fill();
    // Bowl outer
    var bowlGrad = ctx.createLinearGradient(bx - br, by - br, bx + br, by + br);
    bowlGrad.addColorStop(0, '#E8E8E8');
    bowlGrad.addColorStop(0.4, '#D4D4D4');
    bowlGrad.addColorStop(0.7, '#C0C0C0');
    bowlGrad.addColorStop(1, '#A0A0A0');
    ctx.fillStyle = bowlGrad;
    ctx.beginPath(); ctx.ellipse(bx, by, br, br * 0.82, 0, 0, Math.PI * 2); ctx.fill();
    // Bowl rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(bx, by, br, br * 0.82, 0, 0, Math.PI * 2); ctx.stroke();
    // Interior
    var bowlColor = '#F5F0E0';
    if (state.bowl.ingredients.length > 0) {
      bowlColor = mixColor('#F5F0E0', '#C4A35A', 0.2 * state.bowl.ingredients.length / 4);
    }
    ctx.fillStyle = bowlColor;
    ctx.beginPath(); ctx.ellipse(bx, by + 2, br - 10, (br - 10) * 0.78, 0, 0, Math.PI * 2); ctx.fill();
    // Inner shadow
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath(); ctx.ellipse(bx, by + 4, br - 12, (br - 12) * 0.75, 0, Math.PI, Math.PI*2); ctx.fill();
    // Ingredients in bowl
    for (var bi = 0; bi < state.bowl.ingredients.length; bi++) {
      var ang = (bi / 4) * Math.PI * 2 + state.animTime * 0.5;
      var ix = bx + Math.cos(ang) * 18;
      var iy = by + Math.sin(ang) * 11;
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(state.bowl.ingredients[bi].icon, ix, iy + 5);
    }
    // Count
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = '#5C3D2E';
    ctx.fillText(state.bowl.ingredients.length + ' / 4', bx, by + br + 33);

    // Chef
    renderChef(state.chef.x, state.chef.y, state.chef.facing, state.chef.carrying);

    // Highlight nearby interactable
    if (!state.chef.carrying) {
      for (var hi = 0; hi < GATHER_STATIONS.length; hi++) {
        var hst = GATHER_STATIONS[hi];
        if (!hst.taken && dist(state.chef.x, state.chef.y, hst.cx, hst.cy) < 60) {
          ctx.strokeStyle = 'rgba(255,215,0,0.5)';
          ctx.lineWidth = 2;
          rrect(hst.cx - 35, hst.cy - 23, 70, 46, 7);
          ctx.stroke();
          break;
        }
      }
    }
    if (state.chef.carrying && dist(state.chef.x, state.chef.y, bx, by) < 70) {
      ctx.strokeStyle = 'rgba(127,176,105,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(bx, by, br + 5, (br + 5) * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.textAlign = 'start';
  }

  // ========================================================================
  //  CHEF RENDERING — uses baker customization
  // ========================================================================
  function renderChef(x, y, facing, carrying) {
    var skin = SKIN_COLORS[state.bakerCustomize.skinIdx];
    var apronColor = APRON_COLORS[state.bakerCustomize.apronIdx];
    var hatStyle = HAT_STYLES[state.bakerCustomize.hatIdx];

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 16, 16, 7, 0, 0, Math.PI * 2); ctx.fill();

    // Body (white chef coat)
    ctx.fillStyle = '#FFF';
    ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#DDD'; ctx.lineWidth = 1; ctx.stroke();

    // Apron
    ctx.fillStyle = apronColor;
    ctx.beginPath();
    ctx.arc(x, y + 3, 12, 0, Math.PI);
    ctx.fill();
    // Apron string
    ctx.strokeStyle = mixColor(apronColor, '#000', 0.3); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 11, y + 2); ctx.lineTo(x - 6, y + 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 11, y + 2); ctx.lineTo(x + 6, y + 14); ctx.stroke();
    // Apron pocket
    ctx.fillStyle = mixColor(apronColor, '#FFF', 0.2);
    rrect(x - 6, y + 6, 12, 7, 2); ctx.fill();

    // Chef hat
    ctx.fillStyle = '#FFF';
    if (hatStyle === 'classic') {
      // Classic puffy hat
      ctx.beginPath(); ctx.arc(x, y - 10, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#DDD'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(x - 5, y - 15, 6, 0, Math.PI * 2);
      ctx.arc(x + 5, y - 15, 6, 0, Math.PI * 2);
      ctx.arc(x, y - 18, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.fillRect(x - 4, y - 12, 8, 18);
    } else if (hatStyle === 'tall') {
      // Tall chef hat
      ctx.fillStyle = '#FFF';
      rrect(x - 8, y - 30, 16, 26, 4); ctx.fill();
      ctx.strokeStyle = '#DDD'; ctx.lineWidth = 1; ctx.stroke();
      rrect(x - 10, y - 12, 20, 6, 3); ctx.fill();
      ctx.strokeStyle = '#DDD'; ctx.lineWidth = 1; ctx.stroke();
    } else if (hatStyle === 'beret') {
      // Beret-style hat
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.ellipse(x, y - 15, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 3, y - 14, 10, 5, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#555';
      ctx.beginPath(); ctx.arc(x + 4, y - 12, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Face
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();

    // Eyes
    var ex = 0, ey = 0;
    if (facing === 'up') ey = -2;
    else if (facing === 'down') ey = 1;
    else if (facing === 'left') ex = -2;
    else if (facing === 'right') ex = 2;

    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x - 4 + ex, y - 2 + ey, 2.2, 0, Math.PI * 2);
    ctx.arc(x + 4 + ex, y - 2 + ey, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Highlights in eyes
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(x - 3 + ex, y - 3 + ey, 0.8, 0, Math.PI * 2);
    ctx.arc(x + 5 + ex, y - 3 + ey, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    if (facing !== 'up') {
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x + ex, y + 2 + ey, 4, 0.3, Math.PI - 0.3); ctx.stroke();
    }

    // Rosy cheeks
    ctx.fillStyle = 'rgba(255,150,150,0.3)';
    ctx.beginPath(); ctx.arc(x - 7, y + 1, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 7, y + 1, 2.5, 0, Math.PI*2); ctx.fill();

    // Carried item
    if (carrying) {
      ctx.font = '22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(carrying.icon, x, y - 26);
      ctx.textAlign = 'start';
    }
  }

  // ========================================================================
  //  BUILD STATION — ultra-simple mixing: click to start, auto-fills, click to finish
  // ========================================================================
  function updateBuild(dt) {
    // "Continue to Prep" button click
    if (state.justClicked && state.bowl.mixed && !state.prepDone) {
      var gx = 370, gy = 505, gw = 220, gh = 48;
      if (pointInRect(state.mouseX, state.mouseY, gx, gy, gw, gh)) {
        switchStation('prep');
        return;
      }
    }

    // Mixing: 4 ingredients in bowl + not yet mixed
    if (state.bowl.ingredients.length === 4 && !state.bowl.mixed) {
      // Click anywhere to START mixing
      if (state.justClicked && !state.bowl.mixing) {
        state.bowl.mixing = true;
        state.bowl.mixProgress = 0;
        spawnParticles(BOWL.x, BOWL.y, 8, '#FFF8E7', 30);
      }

      // While mixing, auto-fill progress (fills in ~2.5 seconds)
      if (state.bowl.mixing) {
        state.bowl.mixProgress += dt * 0.42;
        if (state.bowl.mixProgress >= 1.0) {
          state.bowl.mixProgress = 1.0;
          finishMixing();
        }

        // Particles
        if (Math.random() < 0.5) {
          var pa = Math.random() * Math.PI * 2;
          spawnParticles(
            BOWL.x + Math.cos(pa) * BOWL.r * 0.5,
            BOWL.y + Math.sin(pa) * BOWL.r * 0.5,
            1, '#FFF8E7', 20
          );
        }
      }
    }
  }

  function finishMixing() {
    state.bowl.mixing = false;

    // Very wide good zone
    if (state.bowl.mixProgress < 0.3) {
      state.bowl.mixQuality = 'under';
    } else {
      state.bowl.mixQuality = 'good';
    }
    state.bowl.mixed = true;

    spawnParticles(BOWL.x, BOWL.y, 20, state.bowl.mixQuality === 'good' ? '#FFD700' : '#C04F3E', 80);
  }

  function renderBuild() {
    // ---- DEBUG STATE LINE ----
    ctx.font = '11px monospace';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'left';
    var dbg = 'ingredients:' + state.bowl.ingredients.length + ' mixed:' + state.bowl.mixed + ' mixing:' + state.bowl.mixing + ' progress:' + state.bowl.mixProgress.toFixed(2) + ' recipe:' + (state.bowl.recipe || 'none');
    ctx.fillText(dbg, 20, 25);
    ctx.textAlign = 'start';

    // Counter
    var cGrad = ctx.createLinearGradient(0, BOWL.y + BOWL.r - 12, 0, BOWL.y + BOWL.r + 15);
    cGrad.addColorStop(0, '#C4A47A');
    cGrad.addColorStop(0.5, '#A0782C');
    cGrad.addColorStop(1, '#8B6914');
    ctx.fillStyle = cGrad;
    rrect(BOWL.x - BOWL.r - 40, BOWL.y + BOWL.r - 10, (BOWL.r + 40) * 2, 26, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    rrect(BOWL.x - BOWL.r - 38, BOWL.y + BOWL.r - 9, (BOWL.r + 38) * 2, 5, 4); ctx.fill();

    // Bowl shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(BOWL.x, BOWL.y + BOWL.r + 7, BOWL.r + 12, 12, 0, 0, Math.PI * 2); ctx.fill();

    // Bowl — metallic gradient
    var bowlGrad = ctx.createLinearGradient(BOWL.x - BOWL.r, BOWL.y - BOWL.r, BOWL.x + BOWL.r, BOWL.y + BOWL.r);
    bowlGrad.addColorStop(0, '#F0F0F0');
    bowlGrad.addColorStop(0.3, '#E0E0E0');
    bowlGrad.addColorStop(0.5, '#C8C8C8');
    bowlGrad.addColorStop(0.7, '#D8D8D8');
    bowlGrad.addColorStop(1, '#A8A8A8');
    ctx.fillStyle = bowlGrad;
    ctx.beginPath(); ctx.ellipse(BOWL.x, BOWL.y, BOWL.r, BOWL.r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(BOWL.x, BOWL.y, BOWL.r, BOWL.r * 0.82, -0.1, Math.PI * 0.7); ctx.stroke();

    // Interior
    var bowlColor = '#F5F0E0';
    if (state.bowl.ingredients.length > 0) {
      bowlColor = mixColor('#F5F0E0', '#C4A35A', 0.25 * state.bowl.ingredients.length / 4);
      if (state.bowl.mixing || state.bowl.mixed) {
        bowlColor = mixColor(bowlColor, '#8B6914', Math.min(state.bowl.mixProgress * 0.3, 0.3));
      }
    }
    ctx.fillStyle = bowlColor;
    ctx.beginPath(); ctx.ellipse(BOWL.x, BOWL.y + 3, BOWL.r - 10, (BOWL.r - 10) * 0.78, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath(); ctx.ellipse(BOWL.x, BOWL.y + 5, BOWL.r - 14, (BOWL.r - 14) * 0.7, 0, Math.PI, Math.PI*2); ctx.fill();

    // Ingredient icons
    for (var bi = 0; bi < state.bowl.ingredients.length; bi++) {
      var ang = (bi / state.bowl.ingredients.length) * Math.PI * 2 + state.animTime * 0.5;
      var ix = BOWL.x + Math.cos(ang) * 28;
      var iy = BOWL.y + Math.sin(ang) * 20;
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.globalAlpha = state.bowl.mixed ? 0.5 : 1.0;
      ctx.fillText(state.bowl.ingredients[bi].icon, ix, iy + 6);
      ctx.globalAlpha = 1.0;
    }

    // ---- MIXING STATE ----
    if (state.bowl.ingredients.length === 4 && !state.bowl.mixed) {
      // Not mixing yet — show "click to start" prompt
      if (!state.bowl.mixing) {
        ctx.strokeStyle = 'rgba(255,215,0,0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.beginPath(); ctx.arc(BOWL.x, BOWL.y, BOWL.r + 14, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#E85D3A';
        ctx.textAlign = 'center';
        var pulse = 0.6 + Math.sin(state.animTime * 3) * 0.4;
        ctx.globalAlpha = pulse;
        ctx.fillText('\u{1F447} Click anywhere to start mixing \u{1F447}', BOWL.x, BOWL.y - BOWL.r - 25);
        ctx.globalAlpha = 1.0;
      }

      // Mixing swirls + progress
      if (state.bowl.mixing) {
        // Swirl arcs
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 3;
        for (var sw = 0; sw < 4; sw++) {
          var sa = state.animTime * 8 + sw * 1.5;
          ctx.beginPath();
          ctx.arc(BOWL.x, BOWL.y, 15 + sw * 18, sa, sa + Math.PI * 1.4);
          ctx.stroke();
        }

        // Progress text
        var pct = Math.floor(state.bowl.mixProgress * 100);
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.fillText('Mixing... ' + pct + '%', BOWL.x, BOWL.y - BOWL.r - 25);
      }
    }

    // Progress ring
    if ((state.bowl.mixing || state.bowl.mixed) && state.bowl.ingredients.length === 4) {
      var ringEnd = -Math.PI / 2 + state.bowl.mixProgress * Math.PI * 2;

      // Background ring
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(BOWL.x, BOWL.y, BOWL.r + 22, 0, Math.PI * 2); ctx.stroke();

      // Progress fill
      var ringColor = state.bowl.mixed
        ? (state.bowl.mixQuality === 'good' ? '#7FB069' : '#C04F3E')
        : '#FFD700';
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(BOWL.x, BOWL.y, BOWL.r + 22, -Math.PI / 2, ringEnd); ctx.stroke();
    }

    // Bowl label
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#5C3D2E';
    ctx.textAlign = 'center';
    if (state.bowl.ingredients.length < 4 && !state.bowl.mixed) {
      ctx.fillText(state.bowl.ingredients.length + ' / 4 ingredients', BOWL.x, BOWL.y + BOWL.r + 42);
      ctx.font = '12px Arial';
      ctx.fillStyle = '#AAA';
      ctx.fillText('Go to Gather to collect ingredients', BOWL.x, BOWL.y + BOWL.r + 60);
    } else if (state.bowl.mixed) {
      ctx.fillStyle = '#7FB069';
      ctx.fillText('Well Mixed! \u2714', BOWL.x, BOWL.y + BOWL.r + 42);
    }
    ctx.textAlign = 'start';

    // "Continue to Prep" button — visible after mixing is done
    if (state.bowl.mixed && !state.prepDone) {
      var btnX = 370, btnY = 500, btnW = 220, btnH = 48;
      var btnHover = pointInRect(state.mouseX, state.mouseY, btnX, btnY, btnW, btnH);

      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      rrect(btnX + 2, btnY + 3, btnW, btnH, 12); ctx.fill();

      var bGrad = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
      if (btnHover) { bGrad.addColorStop(0, '#E87A5A'); bGrad.addColorStop(1, '#C8553A'); }
      else { bGrad.addColorStop(0, '#E85D3A'); bGrad.addColorStop(1, '#C04F3E'); }
      ctx.fillStyle = bGrad;
      rrect(btnX, btnY, btnW, btnH, 12); ctx.fill();

      var pulse = 0.7 + Math.sin(state.animTime * 3.5) * 0.3;
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#FFF';
      ctx.textAlign = 'center';
      ctx.globalAlpha = pulse;
      ctx.fillText('Continue to Prep  \u2192', btnX + btnW / 2, btnY + 32);
      ctx.globalAlpha = 1.0;
      ctx.textAlign = 'start';
    }
  }

  // ========================================================================
  //  PREP STATION — harder mini-games
  // ========================================================================
  function startPrep() {
    if (!state.bowl.recipe) return;
    var recipe = RECIPES[state.bowl.recipe];
    state.prepGame = recipe.miniGame;
    state.prepDone = false;
    state.prepQuality = null;

    switch (recipe.miniGame) {
      case 'rolling':
        state.prepData = { passes: 0, lastDir: 0, flatness: 0, lastMouseX: 0 };
        break;
      case 'kneading':
        state.prepData = { count: 0, lastSide: 0, squish: 0 };
        break;
      case 'spreading':
        state.prepData = { grid: [], coverage: 0 };
        for (var i = 0; i < 25; i++) state.prepData.grid.push(false);
        break;
      case 'layering':
        state.prepData = { layerIdx: 0, dragging: false, layerX: 0, layers: [], maxLayers: 3 };
        break;
    }
  }

  function updatePrep(dt) {
    if (!state.prepGame || state.prepDone) return;
    switch (state.prepGame) {
      case 'rolling':   updateRolling(dt); break;
      case 'kneading':  updateKneading(dt); break;
      case 'spreading': updateSpreading(dt); break;
      case 'layering':  updateLayering(dt); break;
    }
  }

  function updateRolling(dt) {
    var doughX = 380, doughY = 300, doughW = 200, doughH = 120;
    var overDough = pointInRect(state.mouseX, state.mouseY, doughX - 30, doughY - 30, doughW + 60, doughH + 60);

    if (state.mouseDown && overDough) {
      var dir = state.mouseX > state.prepData.lastMouseX ? 1 : (state.mouseX < state.prepData.lastMouseX ? -1 : 0);
      if (dir !== 0 && dir !== state.prepData.lastDir && state.prepData.lastDir !== 0) {
        state.prepData.passes++;
        state.prepData.flatness = Math.min(state.prepData.passes / 8, 1);
        spawnParticles(state.mouseX, state.mouseY, 3, '#F5F0E0', 25);
      }
      if (dir !== 0) state.prepData.lastDir = dir;
    }
    state.prepData.lastMouseX = state.mouseX;

    if (state.prepData.passes >= 8) finishPrep('good');
  }

  function updateKneading(dt) {
    if (state.justClicked) {
      var cx = 480, cy = 300;
      var side = state.mouseX < cx ? -1 : 1;
      var nearDough = dist(state.mouseX, state.mouseY, cx, cy) < 120;
      if (nearDough) {
        if (state.prepData.lastSide !== 0 && side !== state.prepData.lastSide) {
          state.prepData.count++;
          state.prepData.squish = 1;
          spawnParticles(state.mouseX, state.mouseY, 4, '#F5DEB3', 30);
        }
        state.prepData.lastSide = side;
      }
    }
    state.prepData.squish *= 0.9;
    if (state.prepData.count >= 12) finishPrep('good');
  }

  function updateSpreading(dt) {
    var panX = 340, panY = 220, panW = 280, panH = 200;
    var cellW = panW / 5, cellH = panH / 5;
    if (state.mouseDown && pointInRect(state.mouseX, state.mouseY, panX, panY, panW, panH)) {
      var col = Math.floor((state.mouseX - panX) / cellW);
      var row = Math.floor((state.mouseY - panY) / cellH);
      if (col >= 0 && col < 5 && row >= 0 && row < 5) {
        var idx = row * 5 + col;
        if (!state.prepData.grid[idx]) {
          state.prepData.grid[idx] = true;
          state.prepData.coverage++;
          spawnParticles(state.mouseX, state.mouseY, 2, '#5C3317', 20);
        }
      }
    }
    if (state.prepData.coverage >= 23) finishPrep('good');
  }

  function updateLayering(dt) {
    if (state.prepData.layerIdx >= state.prepData.maxLayers) return;
    if (state.justClicked && !state.prepData.dragging) {
      var layerX = 200, layerY = 400 - state.prepData.layerIdx * 50;
      if (pointInRect(state.mouseX, state.mouseY, layerX - 50, layerY - 20, 100, 40)) {
        state.prepData.dragging = true;
      }
    }
    if (state.prepData.dragging) {
      state.prepData.layerX = state.mouseX;
    }
  }

  function handleLayeringRelease() {
    if (!state.prepData || !state.prepData.dragging) return;
    state.prepData.dragging = false;
    var cakeX = 480;
    var offset = Math.abs(state.prepData.layerX - cakeX);
    if (offset < 35) {
      state.prepData.layers.push({ offset: state.prepData.layerX - cakeX });
      state.prepData.layerIdx++;
      spawnParticles(cakeX, 400 - state.prepData.layers.length * 40, 8, '#FFD700', 50);
    } else {
      spawnParticles(state.prepData.layerX, 380, 6, '#C04F3E', 40);
    }
    if (state.prepData.layerIdx >= state.prepData.maxLayers) finishPrep('good');
  }

  function finishPrep(quality) {
    state.prepDone = true;
    state.prepQuality = quality;
    spawnParticles(480, 300, 20, '#FFD700', 100);
  }

  function renderPrep() {
    if (!state.bowl.mixed && !state.prepGame) {
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = 'rgba(139,94,60,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText('\u00b7 \u00b7 \u00b7', W / 2, 300);
      ctx.textAlign = 'start';
      return;
    }
    if (!state.prepGame && state.bowl.mixed) startPrep();

    // Work surface with better shading
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    rrect(48, 78, W - 96, 472, 12); ctx.fill();
    ctx.fillStyle = '#D4B896';
    rrect(50, 80, W - 100, 470, 12); ctx.fill();
    // Surface grain
    ctx.strokeStyle = 'rgba(0,0,0,0.03)';
    ctx.lineWidth = 1;
    for (var sl = 80; sl < 550; sl += 40) {
      ctx.beginPath(); ctx.moveTo(65, sl); ctx.lineTo(W - 65, sl); ctx.stroke();
    }
    ctx.fillStyle = '#E8D5C0';
    rrect(60, 90, W - 120, 450, 10); ctx.fill();

    if (state.prepGame === 'rolling') renderRolling();
    else if (state.prepGame === 'kneading') renderKneading();
    else if (state.prepGame === 'spreading') renderSpreading();
    else if (state.prepGame === 'layering') renderLayering();

    ctx.textAlign = 'start';
  }

  // Prep rendering functions (same as before but with slightly better visuals)
  function renderRolling() {
    var doughX = 350, doughY = 240, doughW = 200, doughH = 120;
    var flatness = state.prepData.flatness;
    var dW = doughW + flatness * 120;
    var dH = doughH - flatness * 70;

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(doughX + doughW / 2 + 3, doughY + doughH / 2 + 3, dW / 2, dH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F0D8A0';
    ctx.beginPath();
    ctx.ellipse(doughX + doughW / 2, doughY + doughH / 2, dW / 2, dH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 2; ctx.stroke();

    if (state.mouseDown && pointInRect(state.mouseX, state.mouseY, doughX - 50, doughY - 50, doughW + 100, doughH + 100)) {
      ctx.save();
      ctx.translate(state.mouseX, state.mouseY);
      ctx.rotate(Math.sin(state.animTime * 5) * 0.1);
      ctx.fillStyle = '#A0782C';
      rrect(-60, -7, 120, 14, 7); ctx.fill();
      ctx.fillStyle = '#C4A882';
      ctx.beginPath(); ctx.arc(-45, 0, 15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(45, 0, 15, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    var pbX = 350, pbY = 420, pbW = 260, pbH = 18;
    ctx.fillStyle = '#E0D0C0';
    rrect(pbX, pbY, pbW, pbH, 6); ctx.fill();
    ctx.fillStyle = state.prepData.passes >= 8 ? '#7FB069' : '#FFD700';
    rrect(pbX, pbY, (state.prepData.passes / 8) * pbW, pbH, 6); ctx.fill();
    ctx.strokeStyle = '#8B5E3C'; ctx.lineWidth = 1; ctx.stroke();
  }

  function renderKneading() {
    var cx = 480, cy = 280;
    var squish = state.prepData.squish;
    var dW = 120 + squish * 30;
    var dH = 80 - squish * 20;

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy + 3, dW / 2, dH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#F0D8A0';
    ctx.beginPath();
    ctx.ellipse(cx, cy, dW / 2, dH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 2; ctx.stroke();

    if (dist(state.mouseX, state.mouseY, cx, cy) < 120) {
      ctx.font = '28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(state.mouseDown ? '\u270A' : '\u{1F590}', state.mouseX, state.mouseY + 10);
    }

    var pbX = 350, pbY = 420, pbW = 260, pbH = 18;
    ctx.fillStyle = '#E0D0C0';
    rrect(pbX, pbY, pbW, pbH, 6); ctx.fill();
    ctx.fillStyle = state.prepData.count >= 12 ? '#7FB069' : '#FFD700';
    rrect(pbX, pbY, (state.prepData.count / 12) * pbW, pbH, 6); ctx.fill();
    ctx.strokeStyle = '#8B5E3C'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'start';
  }

  function renderSpreading() {
    var panX = 340, panY = 220, panW = 280, panH = 200;
    var cellW = panW / 5, cellH = panH / 5;

    ctx.fillStyle = '#444';
    rrect(panX - 8, panY - 8, panW + 16, panH + 16, 8); ctx.fill();
    ctx.fillStyle = '#666';
    rrect(panX, panY, panW, panH, 4); ctx.fill();

    for (var r = 0; r < 5; r++) {
      for (var c = 0; c < 5; c++) {
        var idx = r * 5 + c;
        var cellX = panX + c * cellW;
        var cellY = panY + r * cellH;
        if (state.prepData.grid[idx]) {
          ctx.fillStyle = '#5C3317';
          rrect(cellX + 2, cellY + 2, cellW - 4, cellH - 4, 3); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          rrect(cellX + 2, cellY + 2, cellW - 4, (cellH - 4) / 3, 3); ctx.fill();
        } else {
          ctx.fillStyle = '#888';
          rrect(cellX + 2, cellY + 2, cellW - 4, cellH - 4, 3); ctx.fill();
        }
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.5;
    for (var gl = 0; gl <= 5; gl++) {
      ctx.beginPath(); ctx.moveTo(panX + gl * cellW, panY); ctx.lineTo(panX + gl * cellW, panY + panH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(panX, panY + gl * cellH); ctx.lineTo(panX + panW, panY + gl * cellH); ctx.stroke();
    }

    if (pointInRect(state.mouseX, state.mouseY, panX, panY, panW, panH)) {
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('\u{1F58C}', state.mouseX, state.mouseY + 8);
    }

    var pbX = 350, pbY = 440, pbW = 260, pbH = 18;
    ctx.fillStyle = '#E0D0C0';
    rrect(pbX, pbY, pbW, pbH, 6); ctx.fill();
    ctx.fillStyle = state.prepData.coverage >= 23 ? '#7FB069' : '#FFD700';
    rrect(pbX, pbY, (state.prepData.coverage / 23) * pbW, pbH, 6); ctx.fill();
    ctx.strokeStyle = '#8B5E3C'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'start';
  }

  function renderLayering() {
    var cakeX = 480, cakeBaseY = 400;

    ctx.fillStyle = '#FFF';
    ctx.beginPath(); ctx.ellipse(cakeX, cakeBaseY + 15, 100, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#CCC'; ctx.lineWidth = 1; ctx.stroke();

    for (var li = 0; li < state.prepData.layers.length; li++) {
      var ly = cakeBaseY - (li + 1) * 40;
      var lx = cakeX + state.prepData.layers[li].offset;
      ctx.fillStyle = '#FFF8DC';
      rrect(lx - 50, ly + 25, 100, 5, 2); ctx.fill();
      ctx.fillStyle = '#F5DEB3';
      rrect(lx - 50, ly, 100, 30, 4); ctx.fill();
      ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 1; ctx.stroke();
    }

    if (state.prepData.dragging && state.prepData.layerIdx < state.prepData.maxLayers) {
      var dragY = cakeBaseY - (state.prepData.layerIdx + 1) * 40;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#F5DEB3';
      rrect(state.prepData.layerX - 50, dragY, 100, 30, 4); ctx.fill();
      ctx.globalAlpha = 1.0;

      ctx.strokeStyle = '#7FB069';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(cakeX, dragY - 10); ctx.lineTo(cakeX, dragY + 50); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (state.prepData.layerIdx < state.prepData.maxLayers && !state.prepData.dragging) {
      var nextX = 200, nextY = cakeBaseY - (state.prepData.layerIdx + 1) * 40;
      ctx.fillStyle = '#F5DEB3';
      rrect(nextX - 50, nextY, 100, 30, 4); ctx.fill();
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.stroke();

      if (pointInRect(state.mouseX, state.mouseY, nextX - 50, nextY - 20, 100, 50)) {
        ctx.strokeStyle = 'rgba(255,215,0,0.5)'; ctx.lineWidth = 3;
        rrect(nextX - 53, nextY - 3, 106, 36, 6); ctx.stroke();
      }
    }

    var pbX = 350, pbY = 480, pbW = 260, pbH = 18;
    ctx.fillStyle = '#E0D0C0';
    rrect(pbX, pbY, pbW, pbH, 6); ctx.fill();
    ctx.fillStyle = state.prepData.layerIdx >= 3 ? '#7FB069' : '#FFD700';
    rrect(pbX, pbY, (state.prepData.layerIdx / 3) * pbW, pbH, 6); ctx.fill();
    ctx.strokeStyle = '#8B5E3C'; ctx.lineWidth = 1; ctx.stroke();
  }

  // ========================================================================
  //  BAKE STATION — load batters into ovens, serve when done
  // ========================================================================
  function updateBake(dt) {
    if (state.justClicked && state.station === 'bake') {
      // Try to load a batter into an oven
      if (state.readyBatters.length > 0) {
        for (var i = 0; i < 4; i++) {
          var ox = OVEN_START_X + i * (OVEN_W + OVEN_GAP);
          if (pointInRect(state.mouseX, state.mouseY, ox, OVEN_Y, OVEN_W, OVEN_H)) {
            var oven = state.ovens[i];
            if (!oven.occupied) {
              var batter = state.readyBatters.shift();
              oven.occupied = true;
              oven.recipe = batter.recipe;
              oven.time = 0;
              oven.done = false;
              oven.quality = null;
              oven.mixQ = batter.mixQ;
              oven.prepQ = batter.prepQ;
              oven.ingredients = batter.ingredients.slice();
              spawnParticles(ox + OVEN_W / 2, OVEN_Y + 40, 10, '#FFA500', 50);
              break;
            }
          }
        }
      } else {
        // Click occupied oven to serve
        for (var i2 = 0; i2 < 4; i2++) {
          var ox2 = OVEN_START_X + i2 * (OVEN_W + OVEN_GAP);
          if (pointInRect(state.mouseX, state.mouseY, ox2, OVEN_Y, OVEN_W, OVEN_H)) {
            if (state.ovens[i2].occupied) {
              serveOven(i2);
              break;
            }
          }
        }
      }
    }
  }

  function serveOven(idx) {
    var oven = state.ovens[idx];
    var recipe = RECIPES[oven.recipe];

    // Bake quality
    if (!oven.quality) {
      if (oven.time < recipe.bakeIdeal * 0.7) oven.quality = 'under';
      else if (oven.time < recipe.bakeIdeal * 1.1) oven.quality = 'good';
      else oven.quality = 'burnt';
    }

    // Ingredient accuracy
    var correctCount = 0;
    for (var i = 0; i < oven.ingredients.length; i++) {
      if (recipe.ingredients.indexOf(oven.ingredients[i].name) !== -1) correctCount++;
    }
    var ingMult = correctCount === 4 ? 1.0 :
                  correctCount === 3 ? 0.6 :
                  correctCount === 2 ? 0.3 :
                  correctCount === 1 ? 0.1 : 0.05;
    var hasAllCorrect = correctCount === 4;

    // Score
    var points = recipe.points;
    var mixMult = oven.mixQ === 'good' ? 1.0 : (oven.mixQ === 'under' ? 0.7 : 0.5);
    var prepMult = oven.prepQ === 'good' ? 1.0 : 0.6;
    var bakeMult = oven.quality === 'good' ? 1.0 : (oven.quality === 'under' ? 0.5 : 0.2);
    points = Math.floor(points * ingMult * mixMult * prepMult * bakeMult);

    if (state.comboCount > 0 && oven.quality === 'good' && hasAllCorrect) points += state.comboCount * 15;

    state.score += points;
    state.servedCount++;
    if (oven.quality === 'good' && hasAllCorrect) state.comboCount++;
    else state.comboCount = 0;

    var qualText;
    if (!hasAllCorrect) qualText = 'Hmm...';
    else if (oven.quality === 'good') qualText = 'Perfect!';
    else if (oven.quality === 'under') qualText = 'Underbaked';
    else qualText = 'Burnt!';

    showFeedback(qualText + ' +' + points, oven.quality === 'good' && hasAllCorrect ? '#7FB069' : '#C04F3E', 3);
    showScorePopup('+' + points, OVEN_START_X + idx * (OVEN_W + OVEN_GAP) + OVEN_W / 2, OVEN_Y + 30);

    if (oven.quality === 'good' && hasAllCorrect) {
      spawnSparkles(OVEN_START_X + idx * (OVEN_W + OVEN_GAP) + OVEN_W / 2, OVEN_Y + 60, 12);
    }

    // Clear oven
    oven.occupied = false;
    oven.recipe = null;
    oven.time = 0;
    oven.done = false;
    oven.quality = null;
    oven.mixQ = null;
    oven.prepQ = null;
    oven.ingredients = [];

    // Check if order is complete
    checkOrderComplete();
  }

  function checkOrderComplete() {
    if (!state.activeOrderItems || state.activeOrderItems.length === 0) return;

    // Count remaining items in active order
    var remaining = 0;
    for (var i = 0; i < state.activeOrderItems.length; i++) {
      if (state.activeOrderItems[i] !== null) remaining++;
    }

    // Check how many ovens are occupied (still baking items for this order)
    var ovensOccupied = 0;
    for (var o = 0; o < 4; o++) {
      if (state.ovens[o].occupied) ovensOccupied++;
    }

    // Also check ready batters
    if (remaining === 0 && ovensOccupied === 0 && state.readyBatters.length === 0 &&
        state.bowl.ingredients.length === 0 && !state.bowl.mixed && !state.prepDone) {
      // Order complete! Advance to next
      state.orderIdx++;
      if (state.orderIdx >= ORDER_QUEUE.length) {
        state.screen = 'result';
      } else {
        state.activeOrderItems = [];
        state.activeOrderCustomer = '';
        state.activeOrderCustEmoji = '';
        state.activeOrderTotal = 0;
        state.bowl = { ingredients: [], mixed: false, mixing: false, mixProgress: 0, mixQuality: null, recipe: null };
        state.prepGame = null;
        state.prepDone = false;
        state.prepQuality = null;
        switchStation('order');
      }
    }
  }

  function renderBake() {
    for (var i = 0; i < 4; i++) {
      var ox = OVEN_START_X + i * (OVEN_W + OVEN_GAP);
      var oy = OVEN_Y;
      var oven = state.ovens[i];

      // Oven body — detailed with shading
      var ovenBodyGrad = ctx.createLinearGradient(ox, oy, ox + OVEN_W, oy + OVEN_H);
      ovenBodyGrad.addColorStop(0, '#5A5A5A');
      ovenBodyGrad.addColorStop(0.1, '#6A6A6A');
      ovenBodyGrad.addColorStop(0.5, '#505050');
      ovenBodyGrad.addColorStop(1, '#3A3A3A');
      ctx.fillStyle = ovenBodyGrad;
      rrect(ox, oy, OVEN_W, OVEN_H, 10); ctx.fill();

      // Inner panel
      ctx.fillStyle = '#656565';
      rrect(ox + 5, oy + 5, OVEN_W - 10, OVEN_H - 10, 8); ctx.fill();

      // Control panel — detailed
      var cpGrad = ctx.createLinearGradient(0, oy + 8, 0, oy + 40);
      cpGrad.addColorStop(0, '#3A3A3A');
      cpGrad.addColorStop(1, '#2A2A2A');
      ctx.fillStyle = cpGrad;
      rrect(ox + 10, oy + 8, OVEN_W - 20, 32, 6); ctx.fill();
      // Control lights
      ctx.fillStyle = oven.occupied && !oven.done ? '#00FF88' : (oven.occupied && oven.done ? '#FF4444' : '#444');
      ctx.beginPath(); ctx.arc(ox + 24, oy + 24, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(ox + 22, oy + 22, 2, 0, Math.PI*2); ctx.fill();

      ctx.font = 'bold 13px Arial';
      ctx.fillStyle = '#AAA';
      ctx.textAlign = 'center';
      ctx.fillText('Oven ' + (i + 1), ox + OVEN_W / 2, oy + 30);
      ctx.textAlign = 'start';

      // Handle
      ctx.fillStyle = '#888';
      rrect(ox + 35, oy + 42, OVEN_W - 70, 8, 4); ctx.fill();
      ctx.fillStyle = '#999';
      rrect(ox + 35, oy + 42, OVEN_W - 70, 3, 4); ctx.fill();

      // Window frame
      var winX = ox + 12, winY = oy + 55, winW = OVEN_W - 24, winH = 95;
      ctx.fillStyle = '#333';
      rrect(winX - 2, winY - 2, winW + 4, winH + 4, 5); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      rrect(winX, winY, winW, winH, 4); ctx.fill();

      if (oven.occupied && !oven.done) {
        var recipe = RECIPES[oven.recipe];
        var progress = oven.time / recipe.bakeBurn;

        // Heat glow
        var glowAlpha = 0.15 + progress * 0.25;
        ctx.fillStyle = 'rgba(255,140,0,' + glowAlpha + ')';
        rrect(winX + 2, winY + 2, winW - 4, winH - 4, 3); ctx.fill();

        // Food item
        var foodColor;
        if (progress < 0.3) foodColor = '#F5DEB3';
        else if (progress < 0.5) foodColor = recipe.color;
        else if (progress < 0.75) foodColor = mixColor(recipe.color, '#8B4513', 0.4);
        else if (progress < 0.9) foodColor = '#8B4513';
        else foodColor = '#2C1810';

        ctx.fillStyle = foodColor;
        ctx.beginPath();
        ctx.ellipse(winX + winW / 2, winY + winH / 2, winW / 3, winH / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Food highlight
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.ellipse(winX + winW / 2 - 5, winY + winH / 2 - 8, winW / 8, winH / 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '26px Arial';
        ctx.fillText(recipe.emoji, winX + winW / 2, winY + winH / 2 + 9);

        // Smoke for burning
        if (progress > 0.8) {
          for (var sm = 0; sm < 3; sm++) {
            var smY = winY - 5 - ((state.animTime * 25 + sm * 20) % 28);
            var smX = winX + winW / 2 + Math.sin(state.animTime * 3 + sm) * 15;
            ctx.fillStyle = 'rgba(120,120,120,' + (0.5 - sm * 0.12) + ')';
            ctx.beginPath(); ctx.arc(smX, smY, 7 + sm * 2, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (oven.occupied && oven.done) {
        ctx.fillStyle = 'rgba(255,0,0,0.1)';
        rrect(winX + 2, winY + 2, winW - 4, winH - 4, 3); ctx.fill();
        ctx.fillStyle = '#2C1810';
        ctx.beginPath();
        ctx.ellipse(winX + winW / 2, winY + winH / 2, winW / 3, winH / 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Empty — subtle gradient
        var emptyGrad = ctx.createLinearGradient(winX, winY, winX, winY + winH);
        emptyGrad.addColorStop(0, '#1a1a1a');
        emptyGrad.addColorStop(1, '#252525');
        ctx.fillStyle = emptyGrad;
        rrect(winX + 2, winY + 2, winW - 4, winH - 4, 3); ctx.fill();
        ctx.font = '18px Arial';
        ctx.fillStyle = '#444';
        ctx.textAlign = 'center';
        ctx.fillText('\u2014 \u2014', winX + winW / 2, winY + winH / 2 + 6);
        ctx.textAlign = 'start';
      }

      // Timing meter
      var meterX = ox + 12, meterY = oy + 160, meterW = OVEN_W - 24, meterH = 20;
      ctx.fillStyle = '#2A2A2A';
      rrect(meterX, meterY - 2, meterW, meterH + 4, 4); ctx.fill();

      if (oven.occupied) {
        var recipe2 = RECIPES[oven.recipe];
        var prog = oven.time / recipe2.bakeBurn;

        var idealStart = recipe2.bakeIdeal * 0.7 / recipe2.bakeBurn;
        var idealEnd = recipe2.bakeIdeal * 1.1 / recipe2.bakeBurn;

        // Red zone left
        ctx.fillStyle = '#C04F3E';
        rrect(meterX + 1, meterY, Math.max(0, meterW * idealStart - 2), meterH, 3); ctx.fill();
        // Green zone
        ctx.fillStyle = '#7FB069';
        rrect(meterX + meterW * idealStart, meterY, meterW * (idealEnd - idealStart), meterH, 3); ctx.fill();
        // Red zone right
        ctx.fillStyle = '#C04F3E';
        rrect(meterX + meterW * idealEnd, meterY, Math.max(0, meterW * (1 - idealEnd) - 2), meterH, 3); ctx.fill();

        // Marker
        var markerX = meterX + Math.min(prog, 1) * meterW;
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(markerX - 2, meterY - 2, 4, meterH + 4);
        ctx.fillStyle = '#FFF';
        ctx.beginPath(); ctx.arc(markerX, meterY - 2, 4, 0, Math.PI * 2); ctx.fill();
        // Glow on marker
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.beginPath(); ctx.arc(markerX, meterY + meterH/2, 8, 0, Math.PI*2); ctx.fill();
      }

      // Hover
      if (pointInRect(state.mouseX, state.mouseY, ox, oy, OVEN_W, OVEN_H)) {
        ctx.strokeStyle = oven.occupied ? 'rgba(255,215,0,0.5)' : 'rgba(127,176,105,0.5)';
        ctx.lineWidth = 3;
        rrect(ox - 2, oy - 2, OVEN_W + 4, OVEN_H + 4, 11); ctx.stroke();
      }
    }
  }

  // ========================================================================
  //  ORDER STATION — multi-item orders, no recipe shown
  // ========================================================================
  function handleOrderClick() {
    if (state.justClicked && state.orderIdx < ORDER_QUEUE.length) {
      var btnX = 330, btnY = 480, btnW = 300, btnH = 55;

      if (pointInRect(state.mouseX, state.mouseY, btnX, btnY, btnW, btnH)) {
        // If we have ready batters, go to bake
        if (state.readyBatters.length > 0) {
          switchStation('bake');
          return;
        }
        // If bowl has stuff in it and isn't fully mixed, resume
        if (state.bowl.ingredients.length > 0 && !state.bowl.mixed) {
          switchStation('gather');
          return;
        }
        // If bowl is mixed but not prepped, go to prep
        if (state.bowl.mixed && !state.prepDone) {
          switchStation('prep');
          return;
        }

        // Need to start a new item for the current order
        var nextRecipe = getNextRecipeForOrder();
        if (!nextRecipe) return; // should not happen

        state.bowl = {
          ingredients: [], mixed: false, mixing: false,
          mixProgress: 0, mixQuality: null, recipe: nextRecipe
        };
        initGatherStations();
        state.chef = { x: 480, y: 430, facing: 'down', carrying: null, carryingStation: -1 };
        switchStation('gather');
      }
    }
  }

  function renderOrder() {
    if (state.orderIdx >= ORDER_QUEUE.length || !ORDER_QUEUE[state.orderIdx]) {
      ctx.font = 'bold 28px Arial';
      ctx.fillStyle = '#5C3D2E';
      ctx.textAlign = 'center';
      ctx.fillText('All orders complete!', W / 2, 280);
      ctx.textAlign = 'start';
      return;
    }

    var order = ORDER_QUEUE[state.orderIdx];

    // If no active order items yet, set them up
    if (!state.activeOrderItems || state.activeOrderItems.length === 0) {
      state.activeOrderItems = order.items.slice();
      state.activeOrderCustomer = order.cust;
      state.activeOrderCustEmoji = order.custEmoji;
      state.activeOrderTotal = order.items.length;
    }

    // Counter
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(0, 430, W, 140);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 430, W, 4);
    ctx.fillStyle = '#A0782C';
    ctx.fillRect(0, 430, W, 8);

    // Customer — on the left
    var custX = 140, custY = 350;
    // Body
    ctx.fillStyle = '#4A90D9';
    rrect(custX - 32, custY, 64, 75, 10); ctx.fill();
    // Head
    ctx.fillStyle = '#FFDBAC';
    ctx.beginPath(); ctx.arc(custX, custY - 5, 26, 0, Math.PI * 2); ctx.fill();
    // Hair
    ctx.fillStyle = '#5C3D2E';
    ctx.beginPath(); ctx.arc(custX, custY - 8, 27, Math.PI, 0); ctx.fill();
    // Eyes
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(custX - 9, custY - 7, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(custX + 9, custY - 7, 3, 0, Math.PI*2); ctx.fill();
    // Smile
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(custX, custY + 2, 7, 0.2, Math.PI - 0.2); ctx.stroke();

    // Speech bubble
    ctx.fillStyle = '#FFF';
    var sbX = custX + 35, sbY = custY - 50, sbW = 210, sbH = 45;
    rrect(sbX, sbY, sbW, sbH, 10); ctx.fill();
    ctx.strokeStyle = '#5C3D2E'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sbX, sbY + sbH - 5);
    ctx.lineTo(custX + 15, custY + 5);
    ctx.lineTo(sbX + 15, sbY + sbH - 5);
    ctx.fillStyle = '#FFF'; ctx.fill();
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = '#5C3D2E';
    ctx.textAlign = 'center';

    var itemNames = [];
    for (var ni = 0; ni < order.items.length; ni++) {
      itemNames.push(RECIPES[order.items[ni]].emoji);
    }
    ctx.fillText(order.cust + ': ' + itemNames.join(' '), sbX + sbW/2, sbY + 30);
    ctx.textAlign = 'start';

    // Progress tracker — show which items are done
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#5C3D2E';
    ctx.textAlign = 'center';
    ctx.fillText('Order Progress', 140, 420);
    ctx.textAlign = 'start';

    var trackerY = 440;
    for (var ti = 0; ti < order.items.length; ti++) {
      var tx = 60 + ti * 55;
      var recipe = RECIPES[order.items[ti]];
      var isDone = state.activeOrderItems[ti] === null;

      ctx.fillStyle = isDone ? '#7FB069' : '#FFFEF5';
      rrect(tx, trackerY, 42, 42, 8); ctx.fill();
      ctx.strokeStyle = isDone ? '#5C9049' : '#D4A574'; ctx.lineWidth = 2; ctx.stroke();

      ctx.font = '20px Arial';
      ctx.fillStyle = isDone ? '#FFF' : '#333';
      ctx.textAlign = 'center';
      ctx.fillText(recipe.emoji, tx + 21, trackerY + 28);
      ctx.textAlign = 'start';

      if (isDone) {
        ctx.strokeStyle = '#FFF'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(tx + 10, trackerY + 21); ctx.lineTo(tx + 18, trackerY + 30); ctx.lineTo(tx + 32, trackerY + 14); ctx.stroke();
      }
    }

    // Order ticket — right side
    var tx = 340, ty = 80, tw = 380, th = 320;
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    rrect(tx + 4, ty + 4, tw, th, 12); ctx.fill();
    ctx.fillStyle = '#FFFEF5';
    rrect(tx, ty, tw, th, 12); ctx.fill();
    ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = '#E85D3A';
    rrect(tx, ty, tw, 45, 12); ctx.fill();
    ctx.fillRect(tx, ty + 30, tw, 15);
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.fillText('ORDER #' + (state.orderIdx + 1), tx + tw / 2, ty + 30);

    // Customer name
    ctx.font = 'bold 18px Georgia';
    ctx.fillStyle = '#5C3D2E';
    ctx.fillText(order.cust, tx + tw / 2, ty + 75);

    ctx.font = '42px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText(order.custEmoji, tx + tw / 2, ty + 130);

    // Items requested
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#8B5E3C';
    ctx.fillText('Wants:', tx + tw / 2, ty + 175);

    ctx.font = '36px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText(itemNames.join(' '), tx + tw / 2, ty + 215);

    // Question marks
    ctx.font = '28px Arial';
    ctx.fillStyle = '#CCC';
    ctx.fillText('?  ?  ?  ?', tx + tw / 2, ty + 260);

    // Items remaining
    var remainingCount = 0;
    for (var ri = 0; ri < state.activeOrderItems.length; ri++) {
      if (state.activeOrderItems[ri] !== null) remainingCount++;
    }
    if (remainingCount > 0) {
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#E85D3A';
      ctx.fillText('Items left: ' + remainingCount + ' / ' + state.activeOrderTotal, tx + tw / 2, ty + 295);
    } else if (state.activeOrderItems.length > 0) {
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#7FB069';
      ctx.fillText('All items made! Serve from ovens \u{1F525}', tx + tw / 2, ty + 295);
    }

    ctx.textAlign = 'start';

    // Bottom bar — shows batter/oven status
    var statusY = 500;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    rrect(30, statusY, W - 60, 55, 10); ctx.fill();
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    var statusText = '';
    if (state.readyBatters.length > 0) statusText = '\u{1F963} ' + state.readyBatters.length + ' batter(s) ready for oven';
    else if (state.prepDone) statusText = '\u2705 Batter ready! Put it in an oven';
    else if (state.bowl.mixed && !state.prepDone) statusText = '\u{1F963} Mixed! Go to Prep station';
    else if (state.bowl.ingredients.length > 0) statusText = '\u{1F95A} Gathering ingredients...';
    else if (state.activeOrderItems.length > 0) statusText = '\u{1F4CB} Start making the order!';
    ctx.fillText(statusText, W / 2, statusY + 25);
    // Oven count in status
    var openOvens = 0;
    for (var oo = 0; oo < 4; oo++) { if (!state.ovens[oo].occupied) openOvens++; }
    ctx.font = '12px Arial';
    ctx.fillStyle = '#AAA';
    ctx.fillText(openOvens + ' ovens available', W / 2, statusY + 44);
    ctx.textAlign = 'start';

    // Start / Continue button
    var btnX = 330, btnY = statusY + 70, btnW = 300, btnH = 55;
    var canStart = (state.bowl.ingredients.length === 0 && !state.bowl.mixed && !state.prepDone &&
                    state.readyBatters.length === 0) ||
                   (state.readyBatters.length > 0);
    var hover = pointInRect(state.mouseX, state.mouseY, btnX, btnY, btnW, btnH);
    var bg2 = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
    bg2.addColorStop(0, hover ? '#8FCC7F' : '#7FB069');
    bg2.addColorStop(1, hover ? '#6FB05F' : '#5C9049');
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    rrect(btnX, btnY + 3, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = bg2;
    rrect(btnX, btnY, btnW, btnH, 14); ctx.fill();
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    if (state.readyBatters.length > 0) {
      ctx.fillText('\u{1F525} Go Bake!', btnX + btnW / 2, btnY + 36);
    } else if (state.bowl.ingredients.length > 0 || state.bowl.mixed || state.prepDone) {
      ctx.fillText('Continue Making', btnX + btnW / 2, btnY + 36);
    } else {
      ctx.fillText('Start Next Item', btnX + btnW / 2, btnY + 36);
    }
    ctx.textAlign = 'start';

    // Upcoming orders
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = '#8B5E3C';
    ctx.textAlign = 'center';
    ctx.fillText('UPCOMING', 860, 95);
    var shown = 0;
    for (var u = 0; u < ORDER_QUEUE.length && shown < 3; u++) {
      if (u <= state.orderIdx) continue;
      var uy = 115 + shown * 60;
      var uorder = ORDER_QUEUE[u];
      ctx.fillStyle = '#FFFEF5';
      rrect(760, uy, 170, 50, 8); ctx.fill();
      ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = '12px Arial';
      ctx.fillStyle = '#5C3D2E';
      ctx.textAlign = 'center';
      var uitems = [];
      for (var ui = 0; ui < uorder.items.length; ui++) uitems.push(RECIPES[uorder.items[ui]].emoji);
      ctx.fillText(uorder.cust + ' ' + uitems.join(''), 845, uy + 18);
      ctx.font = '10px Arial';
      ctx.fillStyle = '#999';
      ctx.fillText(uorder.items.length + ' item(s)  #' + (u + 1), 845, uy + 35);
      ctx.textAlign = 'start';
      shown++;
    }
    ctx.textAlign = 'start';
  }

  // ========================================================================
  //  UPDATE
  // ========================================================================
  function update(dt) {
    state.animTime += dt;

    if (state.screen === 'startup-name') {
      updateStartupName(dt);
      state.justClicked = false;
      updateEffects(dt);
      return;
    }
    if (state.screen === 'startup-customize') {
      updateStartupCustomize(dt);
      state.justClicked = false;
      updateEffects(dt);
      return;
    }
    if (state.screen === 'startup-baker') {
      updateStartupBaker(dt);
      state.justClicked = false;
      updateEffects(dt);
      return;
    }
    if (state.screen === 'result') {
      if (state.justClicked) {
        if (pointInRect(state.mouseX, state.mouseY, 330, 470, 300, 60)) {
          resetGame();
        }
      }
      state.justClicked = false;
      updateEffects(dt);
      return;
    }

    // Timer
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.screen = 'result';
    }

    // Always update oven times
    for (var oi = 0; oi < state.ovens.length; oi++) {
      var ov = state.ovens[oi];
      if (ov.occupied && !ov.done) {
        ov.time += dt;
        var orecipe = RECIPES[ov.recipe];
        if (ov.time >= orecipe.bakeBurn) {
          ov.done = true;
          ov.quality = 'burnt';
          state.shakeAmount = 8;
        }
      }
    }

    // Tab clicks FIRST
    var tabClicked = false;
    if (state.justClicked) {
      for (var t = 0; t < TABS.length; t++) {
        if (pointInRect(state.mouseX, state.mouseY, TABS[t].x + 4, TAB_Y + 4, TABS[t].w - 8, TAB_H - 8)) {
          switchStation(TABS[t].id);
          tabClicked = true;
          break;
        }
      }
    }

    // Station-specific updates
    if (!tabClicked) {
      if (state.station === 'order') handleOrderClick();
      if (state.station === 'gather') updateGather(dt);
      if (state.station === 'build') updateBuild(dt);
      if (state.station === 'prep') {
        if (!state.prepGame && state.bowl.mixed) startPrep();
        updatePrep(dt);
      }
      if (state.station === 'bake') updateBake(dt);
    }

    // Check if prep done -> add batter to queue
    if (state.prepDone && state.bowl.recipe) {
      // Find which item in activeOrderItems this corresponds to and mark it done
      for (var ai = 0; ai < state.activeOrderItems.length; ai++) {
        if (state.activeOrderItems[ai] === state.bowl.recipe) {
          state.activeOrderItems[ai] = null;
          break;
        }
      }
      // Add to ready batters
      state.readyBatters.push({
        recipe: state.bowl.recipe,
        mixQ: state.bowl.mixQuality,
        prepQ: state.prepQuality,
        ingredients: state.bowl.ingredients.slice()
      });
      // Reset bowl
      state.bowl = { ingredients: [], mixed: false, mixing: false, mixProgress: 0, mixQuality: null, recipe: null };
      state.prepGame = null;
      state.prepDone = false;
      state.prepQuality = null;
      spawnParticles(480, 300, 20, '#FFD700', 100);

      // Auto-switch from Prep to the right next station (avoid getting stuck)
      if (state.station === 'prep') {
        // Check if more items needed for current order
        var moreNeeded = false;
        for (var mni = 0; mni < state.activeOrderItems.length; mni++) {
          if (state.activeOrderItems[mni] !== null) { moreNeeded = true; break; }
        }
        if (moreNeeded) {
          // CRITICAL: set the recipe for the next item so Build/Prep work
          var nextR = getNextRecipeForOrder();
          state.bowl.recipe = nextR;
          switchStation('gather'); // go gather next item
          initGatherStations();
        } else if (state.readyBatters.length > 0) {
          switchStation('bake'); // all items ready, go bake
        } else {
          switchStation('order');
        }
      }
    }

    updateEffects(dt);
    state.justClicked = false;
  }

  function updateEffects(dt) {
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (var i2 = state.sparkles.length - 1; i2 >= 0; i2--) {
      var s = state.sparkles[i2];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 30 * dt;
      s.life -= dt;
      if (s.life <= 0) state.sparkles.splice(i2, 1);
    }
    if (state.feedback) {
      state.feedback.timer -= dt;
      if (state.feedback.timer <= 0) state.feedback = null;
    }
    if (state.scorePopup) {
      state.scorePopup.timer -= dt;
      state.scorePopup.y -= 30 * dt;
      if (state.scorePopup.timer <= 0) state.scorePopup = null;
    }
    state.shakeAmount *= 0.85;
  }

  // ========================================================================
  //  RENDER
  // ========================================================================
  function render() {
    ctx.save();

    if (state.shakeAmount > 0.5) {
      ctx.translate(
        (Math.random() - 0.5) * state.shakeAmount,
        (Math.random() - 0.5) * state.shakeAmount
      );
    }

    if (state.screen === 'startup-name') {
      renderStartupName();
      ctx.restore();
      return;
    }
    if (state.screen === 'startup-customize') {
      renderStartupCustomize();
      ctx.restore();
      return;
    }
    if (state.screen === 'startup-baker') {
      renderStartupBaker();
      ctx.restore();
      return;
    }
    if (state.screen === 'result') {
      renderResult();
      ctx.restore();
      return;
    }

    drawBackground();

    if (state.station === 'order') renderOrder();
    else if (state.station === 'gather') renderGather();
    else if (state.station === 'build') renderBuild();
    else if (state.station === 'prep') renderPrep();
    else if (state.station === 'bake') renderBake();

    renderHUD();
    renderTabs();
    renderEffects();

    ctx.restore();
  }

  function drawBackground() {
    var wg = ctx.createLinearGradient(0, 0, 0, H);
    wg.addColorStop(0, '#FDF6F0');
    wg.addColorStop(0.5, '#F5E6D3');
    wg.addColorStop(1, '#EDD9C0');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(180,160,130,0.08)';
    ctx.lineWidth = 1;
    for (var x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 570); ctx.stroke();
    }
    for (var y = 0; y < 570; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function renderHUD() {
    var bg = ctx.createLinearGradient(0, 0, 0, 60);
    bg.addColorStop(0, '#3D2817');
    bg.addColorStop(1, '#5C3D2E');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, 60);

    // Bakery name
    ctx.font = 'bold 18px Georgia';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'left';
    var displayName = state.bakeryName || 'Bakery';
    if (displayName.length > 14) displayName = displayName.substring(0, 13) + '...';
    ctx.fillText('\u{1F9C1} ' + displayName, 12, 38);

    // Timer
    var mins = Math.floor(state.timeLeft / 60);
    var secs = Math.floor(state.timeLeft % 60);
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
    ctx.font = 'bold 26px Arial';
    ctx.fillStyle = state.timeLeft < 45 ? '#FF6B6B' : '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText('\u23F1 ' + timeStr, 230, 40);

    // Score
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#FFF';
    ctx.fillText('\u2B50 ' + state.score, 370, 40);

    // Orders served / current order
    ctx.font = '14px Arial';
    ctx.fillStyle = '#E8D5C0';
    ctx.fillText('Order ' + (state.orderIdx + 1) + '/' + ORDER_QUEUE.length, 510, 38);

    // Combo
    if (state.comboCount > 0) {
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#FFD700';
      ctx.fillText('\u{1F525} x' + state.comboCount, 620, 38);
    }

    // Current order info
    if (state.activeOrderCustomer) {
      ctx.font = 'bold 15px Arial';
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'right';
      var itemsStr = '';
      for (var oi2 = 0; oi2 < state.activeOrderItems.length; oi2++) {
        if (state.activeOrderItems[oi2] !== null) {
          itemsStr += RECIPES[state.activeOrderItems[oi2]].emoji + ' ';
        }
      }
      ctx.fillText(state.activeOrderCustEmoji + ' ' + state.activeOrderCustomer + '  ' + itemsStr.trim(), W - 18, 38);
    }

    // Batter count
    if (state.readyBatters.length > 0) {
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#7FB069';
      ctx.textAlign = 'center';
      ctx.fillText('\u{1F963}x' + state.readyBatters.length, 700, 38);
      ctx.textAlign = 'right';
    }

    // Mini bakery icon
    var iconX = W - 55, iconY = 8, iconS = 20;
    ctx.fillStyle = WALL_COLORS[state.customize.wallIdx];
    ctx.fillRect(iconX, iconY + iconS * 0.4, iconS * 1.6, iconS);
    ctx.fillStyle = ROOF_COLORS[state.customize.roofIdx];
    ctx.beginPath();
    ctx.moveTo(iconX - 3, iconY + iconS * 0.4);
    ctx.lineTo(iconX + iconS * 0.8, iconY);
    ctx.lineTo(iconX + iconS * 1.6 + 3, iconY + iconS * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'start';
  }

  function renderTabs() {
    for (var i = 0; i < TABS.length; i++) {
      var tab = TABS[i];
      var active = state.station === tab.id;

      if (active) {
        var g = ctx.createLinearGradient(0, TAB_Y, 0, TAB_Y + TAB_H);
        g.addColorStop(0, '#E85D3A');
        g.addColorStop(1, '#C04F3E');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = '#3D2817';
      }
      rrect(tab.x + 3, TAB_Y + 3, tab.w - 6, TAB_H - 6, 8);
      ctx.fill();

      if (!active) {
        ctx.strokeStyle = '#5C3D2E';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.font = '22px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = active ? '#FFF' : '#A08870';
      ctx.fillText(tab.icon, tab.x + tab.w / 2, TAB_Y + 32);

      ctx.font = 'bold 11px Arial';
      ctx.fillStyle = active ? '#FFF' : '#A08870';
      ctx.fillText(tab.label, tab.x + tab.w / 2, TAB_Y + 55);

      // Notification dots
      if (tab.id === 'bake') {
        var baking = 0, burnt = 0;
        for (var o = 0; o < 4; o++) {
          if (state.ovens[o].occupied) {
            if (state.ovens[o].done) burnt++;
            else baking++;
          }
        }
        if (burnt > 0) {
          ctx.fillStyle = '#FF4444';
          ctx.beginPath(); ctx.arc(tab.x + tab.w - 18, TAB_Y + 14, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FFF';
          ctx.font = 'bold 10px Arial';
          ctx.fillText('!', tab.x + tab.w - 18, TAB_Y + 17);
        }
        if (baking > 0) {
          ctx.fillStyle = '#FFA500';
          ctx.beginPath(); ctx.arc(tab.x + tab.w - 38, TAB_Y + 14, 8, 0, Math.PI * 2); ctx.fill();
        }
        if (state.readyBatters.length > 0) {
          ctx.fillStyle = '#7FB069';
          ctx.beginPath(); ctx.arc(tab.x + tab.w - 18, TAB_Y + 14, 8, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (tab.id === 'prep' && state.bowl.mixed && !state.prepDone) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.arc(tab.x + tab.w - 18, TAB_Y + 14, 8, 0, Math.PI * 2); ctx.fill();
      }
      if (tab.id === 'build' && state.bowl.ingredients.length === 4 && !state.bowl.mixed) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.arc(tab.x + tab.w - 18, TAB_Y + 14, 8, 0, Math.PI * 2); ctx.fill();
      }
      if (tab.id === 'gather' && state.activeOrderItems && state.activeOrderItems.length > 0 &&
          state.bowl.ingredients.length < 4 && !state.bowl.mixed) {
        ctx.fillStyle = '#7FB069';
        ctx.beginPath(); ctx.arc(tab.x + tab.w - 18, TAB_Y + 14, 8, 0, Math.PI * 2); ctx.fill();
      }
      if (tab.id === 'order' && state.orderIdx < ORDER_QUEUE.length &&
          state.bowl.ingredients.length === 0 && !state.bowl.mixed && !state.prepDone &&
          state.readyBatters.length === 0) {
        var hasOpenOrderItems = false;
        if (state.activeOrderItems) {
          for (var oij = 0; oij < state.activeOrderItems.length; oij++) {
            if (state.activeOrderItems[oij] !== null) { hasOpenOrderItems = true; break; }
          }
        }
        if (!hasOpenOrderItems || !state.activeOrderItems || state.activeOrderItems.length === 0) {
          ctx.fillStyle = '#7FB069';
          ctx.beginPath(); ctx.arc(tab.x + tab.w - 18, TAB_Y + 14, 8, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.textAlign = 'start';
  }

  // ========================================================================
  //  RESULT SCREEN
  // ========================================================================
  function renderResult() {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#3D2817');
    bg.addColorStop(1, '#5C3D2E');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Warm glow overlay
    var glow = ctx.createRadialGradient(W/2, 250, 50, W/2, 250, 400);
    glow.addColorStop(0, 'rgba(255,180,100,0.15)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Mini bakery
    renderBakeryExterior(340, 60, 280, 180);

    // Bakery name
    ctx.font = 'bold 26px Georgia';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText('\u{1F9C1} ' + (state.bakeryName || 'Bakery'), W / 2, 280);

    // Your baker
    ctx.font = '14px Arial';
    ctx.fillStyle = '#CCC';
    ctx.fillText('Head Baker', W / 2, 305);
    renderChef(W / 2, 350, 'down', null);

    ctx.font = 'bold 38px Georgia';
    ctx.fillStyle = '#FFF';
    ctx.fillText(state.servedCount >= ORDER_QUEUE.length ? 'All Orders Complete!' : 'Time\'s Up!', W / 2, 410);

    ctx.font = 'bold 52px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(state.score + ' pts', W / 2, 460);

    // Stars
    var totalOrders = ORDER_QUEUE.length;
    var stars = 1;
    if (state.score > 600) stars = 2;
    if (state.score > 1100) stars = 3;
    ctx.font = '32px Arial';
    var starStr = '';
    for (var s = 0; s < 3; s++) starStr += s < stars ? '\u2B50' : '\u2606';
    ctx.fillText(starStr, W / 2, 605);

    // Stats
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#E8D5C0';
    ctx.fillText('Orders: ' + state.servedCount + '  |  Combo: x' + state.comboCount, W / 2, 640);

    // Play again button
    var btnX = 330, btnY = 470, btnW = 300, btnH = 55;
    var hover = pointInRect(state.mouseX, state.mouseY, btnX, btnY, btnW, btnH);
    var bg2 = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
    bg2.addColorStop(0, hover ? '#8FCC7F' : '#7FB069');
    bg2.addColorStop(1, hover ? '#6FB05F' : '#5C9049');
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    rrect(btnX, btnY + 3, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = bg2;
    rrect(btnX, btnY, btnW, btnH, 14); ctx.fill();
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#FFF';
    ctx.fillText('Play Again', W / 2, btnY + 38);

    ctx.textAlign = 'start';
  }

  // ========================================================================
  //  EFFECTS RENDERING
  // ========================================================================
  function renderEffects() {
    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    for (var i2 = 0; i2 < state.sparkles.length; i2++) {
      var s = state.sparkles[i2];
      ctx.globalAlpha = Math.min(s.life, 1);
      ctx.fillStyle = '#FFD700';
      ctx.font = s.size + 'px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('\u2728', s.x, s.y);
    }
    ctx.globalAlpha = 1.0;

    if (state.feedback) {
      var alpha = Math.min(state.feedback.timer / 0.5, 1);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = state.feedback.color;
      ctx.textAlign = 'center';
      var tw = ctx.measureText(state.feedback.text).width + 30;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      rrect(W / 2 - tw / 2, 525, tw, 30, 15); ctx.fill();
      ctx.fillStyle = state.feedback.color;
      ctx.fillText(state.feedback.text, W / 2, 546);
      ctx.textAlign = 'start';
      ctx.globalAlpha = 1.0;
    }

    if (state.scorePopup) {
      ctx.globalAlpha = Math.min(state.scorePopup.timer, 1);
      ctx.font = 'bold 32px Arial';
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center';
      ctx.fillText(state.scorePopup.text, state.scorePopup.x, state.scorePopup.y);
      ctx.textAlign = 'start';
      ctx.globalAlpha = 1.0;
    }
  }

  // ========================================================================
  //  MAIN LOOP
  // ========================================================================
  var lastTime = 0;
  function loop(time) {
    var dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  resetGame();
  requestAnimationFrame(loop);

})();