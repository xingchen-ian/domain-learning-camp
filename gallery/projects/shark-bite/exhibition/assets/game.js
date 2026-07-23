/* =====================================================================
   Shark Bite — Reef Explorer
   Track A: plain JavaScript + Canvas 2D. No build step, no dependencies.
   ---------------------------------------------------------------------
   CORE EXPERIENCE: Swim through a living coral reef, discover creatures
   hiding in the coral, and maintain the health of the ecosystem.

   Three data layers (kept separate so a student can read the system):
     - ENVIRONMENT DATA     : coral formations, pollution, species, depth,
                              current, time of day
     - PLAYER-CONTROLLED    : swim, dive, scan (discover), clean pollution,
                              defend, sprint
     - SYSTEM-CALCULATED    : oxygen, equipment, health, eco-health,
                              coral health, catalog, safe/dangerous, rewards

   Invisible data is translated into readable feedback:
     - Coral glows when a hidden creature is nearby (discovery hint)
     - Coral turns white/bleached when eco-health drops (visual warning)
     - Pollution particles drift visibly (actionable — swim through to clean)
     - Radar beeps for large creatures (size, not danger)
     - Pressure mesh past equipment limit
     - Red flash on attack
     - Eco-health bar changes color (green → yellow → red)
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- 1. SPECIES CATALOG (real domain knowledge) --------------
     Each entry carries: a true fact, the misconception it corrects,
     and its reef role (what it does in the ecosystem).                   */
  var SPECIES = [
    { id: "clownfish", name: "Clownfish", danger: 0, predator: false,
      minD: 0,  maxD: 8,  size: 14, color: "#FF8C1A", dark: "#CC6600",
      fact: "Lives symbiotically inside sea anemones and is immune to their sting.",
      role: "Reef resident — shelter species",
      hides: true },
    { id: "tang", name: "Blue Tang", danger: 0, predator: false,
      minD: 0,  maxD: 12, size: 16, color: "#2E86FF", dark: "#1A4D99",
      fact: "Can change color as it matures; plays an important role cleaning reefs.",
      role: "Reef cleaner — grazes algae",
      hides: true },
    { id: "wrasse", name: "Cleaner Wrasse", danger: 0, predator: false,
      minD: 0,  maxD: 10, size: 12, color: "#1D9E75", dark: "#0F6644",
      fact: "Sets up cleaning stations where larger fish come to have parasites removed.",
      role: "Reef cleaner — removes parasites from other fish",
      hides: true },
    { id: "turtle", name: "Sea Turtle", danger: 0, predator: false,
      minD: 0,  maxD: 20, size: 30, color: "#3FA66A", dark: "#266B42",
      fact: "Can hold its breath for 4-7 hours while resting on the seabed.",
      role: "Grazes on seagrass and jellyfish",
      hides: false },
    { id: "jelly", name: "Jellyfish", danger: 1, predator: false,
      minD: 0,  maxD: 15, size: 20, color: "#C7A8FF", dark: "#8B6FD4",
      fact: "Has no brain, heart, or bones; it hunts by simply drifting with the current.",
      role: "Drifter — food for turtles and sunfish",
      hides: false },
    { id: "barracuda", name: "Barracuda", danger: 1, predator: false,
      minD: 5,  maxD: 25, size: 28, color: "#C0CCD6", dark: "#7A8893",
      fact: "Curious and attracted to shiny objects, but attacks on humans are extremely rare.",
      role: "Mid-water hunter — keeps small fish populations balanced",
      hides: false },
    { id: "eel", name: "Moray Eel", danger: 1, predator: false,
      minD: 8,  maxD: 30, size: 26, color: "#7A5A3A", dark: "#4A3520",
      fact: "Defensive, not aggressive; it only bites when cornered or provoked.",
      role: "Reef predator — hides in crevices, hunts at night",
      hides: true },
    { id: "reefshark", name: "Reef Shark", danger: 1, predator: true,
      minD: 5,  maxD: 30, size: 38, color: "#6E7B85", dark: "#3A4550",
      fact: "Often feared, but reef sharks rarely attack humans and usually avoid divers.",
      misconception: "People think all sharks are maneaters. In truth, reef sharks are shy.",
      role: "Apex predator — keeps the reef ecosystem balanced",
      hides: false },
    { id: "whaleshark", name: "Whale Shark", danger: 0, predator: false,
      minD: 8,  maxD: 40, size: 65, color: "#3D6FAE", dark: "#1E3F6E",
      fact: "The largest fish in the sea, yet a gentle filter feeder that is harmless to humans.",
      misconception: "Its huge size makes radar beep red, but it is not a threat.",
      role: "Filter feeder — cleans plankton from open water",
      hides: false },
    { id: "tuna", name: "Bluefin Tuna", danger: 0, predator: false,
      minD: 10, maxD: 40, size: 30, color: "#2A6FB0", dark: "#143860",
      fact: "Can swim up to 75 km/h and is one of the few warm-blooded fish.",
      role: "Open-water hunter — controls schooling fish populations",
      hides: false },
    { id: "parrot", name: "Parrotfish", danger: 0, predator: false,
      minD: 0,  maxD: 15, size: 18, color: "#E0C44A", dark: "#9A8420",
      fact: "Scrapes algae off coral with beak-like teeth; its waste becomes beach sand.",
      role: "Reef builder — cleans coral and creates sand",
      hides: true },
    { id: "hammer", name: "Great Hammerhead", danger: 2, predator: true,
      minD: 20, maxD: 60, size: 50, color: "#4A5560", dark: "#252D35",
      fact: "A powerful predator, but it normally avoids people; give it space and ascend calmly.",
      misconception: "Even large predators rarely attack if you do not panic or corner them.",
      role: "Apex predator — hunts rays and smaller sharks",
      hides: false }
  ];

  /* ---------- 2. CORAL TYPES ----------------------------------------- */
  var CORAL_TYPES = [
    { id: "brain",   color: "#E8A07A", accent: "#C9785A", shape: "brain" },
    { id: "fan",     color: "#FF6B9D", accent: "#D14878", shape: "fan" },
    { id: "tube",    color: "#5DD3A0", accent: "#3AA67A", shape: "tube" },
    { id: "anemone", color: "#C77DFF", accent: "#9B4DCA", shape: "anemone" },
    { id: "plate",   color: "#F0C75E", accent: "#C9A23E", shape: "plate" }
  ];

  /* ---------- 3. CHALLENGE PRESETS ------------------------------------ */
  var CHALLENGES = [
    {
      id: "reef", name: "Reef Welcome", tag: "Tutorial",
      desc: "A shallow, sunny reef. Swim near coral to discover creatures hiding inside. Clean pollution to keep the reef healthy.",
      maxEquipmentDepth: 25, oxygenRate: 0.10, target: 4, ecoTarget: 60,
      pool: ["clownfish", "tang", "wrasse", "parrot", "turtle", "jelly"],
      maxWorldDepth: 30, spawnRate: 1.8, pollutionRate: 0.15, coralCount: 14
    },
    {
      id: "stress", name: "Stressed Reef", tag: "Eco-Health",
      desc: "Pollution is spreading and coral is bleaching. Clean debris, discover stressed creatures, and restore eco-health above 60%.",
      maxEquipmentDepth: 30, oxygenRate: 0.14, target: 5, ecoTarget: 65,
      pool: ["clownfish", "tang", "wrasse", "parrot", "eel", "barracuda", "reefshark"],
      maxWorldDepth: 35, spawnRate: 1.4, pollutionRate: 0.5, coralCount: 16
    },
    {
      id: "balance", name: "Predator Balance", tag: "Ecosystem",
      desc: "Too many predators threaten the reef. Discover species while keeping the ecosystem balanced. Big blips may be harmless — scan before reacting.",
      maxEquipmentDepth: 35, oxygenRate: 0.13, target: 5, ecoTarget: 55,
      pool: ["tang", "wrasse", "parrot", "turtle", "reefshark", "whaleshark", "hammer", "tuna"],
      maxWorldDepth: 45, spawnRate: 1.5, pollutionRate: 0.25, coralCount: 12,
      special: "whaleSharkLesson"
    }
  ];

  /* ---------- 4. CANVAS & VIEW --------------------------------------- */
  var canvas = document.getElementById("game-canvas");
  var ctx = canvas.getContext("2d");
  var W = 960, H = 600;
  canvas.width = W; canvas.height = H;
  var PX_PER_M = 10;
  var cameraY = 0;
  var causticPhase = 0;
  var screenShake = 0;

  /* ---------- 5. GAME STATE ------------------------------------------ */
  var state = null;
  var running = false;
  var lastTs = 0;

  function freshState(challenge) {
    return {
      challenge: challenge,
      diver: { x: W / 2, y: 30, vx: 0, vy: 0, facing: 1, defending: 0, scanCool: 0, cleanCool: 0, finAnim: 0, bubbleTimer: 0 },
      timeOfDay: 0.5,
      current: 0,
      creatures: [],
      corals: [],
      pollution: [],
      bubbles: [],
      particles: [],
      plankton: [],
      ripples: [],
      scorePopups: [],
      // system-calculated
      oxygen: 100,
      equipment: 100,
      health: 100,
      ecoHealth: 75,
      catalog: {},
      discovered: 0,
      safe: true,
      alert: 100,
      rewards: 0,
      cleaned: 0,
      combo: 0,
      comboTimer: 0,
      // feedback timers
      radarBeep: 0,
      pressureWarn: 0,
      attackFlash: 0,
      pressureMesh: 0,
      toasts: [],
      elapsed: 0,
      over: false,
      win: false,
      startledPenalty: 0,
      pollutionTimer: 0,
      hoverTarget: null,
      // ocean atmosphere elements
      seaweed: [], bgFish: [], starfish: [], vents: [],
      silhouettes: [], driftDebris: [], seagrass: []
    };
  }

  /* ---------- 6. AUDIO (Web Audio beeps, no assets) ------------------ */
  var actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return actx;
  }
  function beep(freq, dur, type, vol) {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "square"; o.frequency.value = freq;
    g.gain.value = vol || 0.05;
    o.connect(g); g.connect(a.destination);
    var t = a.currentTime; o.start(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.stop(t + dur);
  }
  function sRadar()    { beep(880, 0.12, "square", 0.05); }
  function sPressure() { beep(440, 0.18, "sawtooth", 0.06); }
  function sScan()     { beep(660, 0.08, "sine", 0.05); setTimeout(function(){ beep(990, 0.1, "sine", 0.05); }, 90); }
  function sAttack()   { beep(120, 0.3, "sawtooth", 0.09); }
  function sReward()   { beep(523, 0.1, "sine", 0.06); setTimeout(function(){ beep(784, 0.14, "sine", 0.06); }, 110); }
  function sClean()    { beep(520, 0.06, "sine", 0.04); }
  function sEcoUp()    { beep(440, 0.08, "sine", 0.05); setTimeout(function(){ beep(660, 0.1, "sine", 0.05); }, 80); }
  function sFail()     { beep(200, 0.4, "sawtooth", 0.08); setTimeout(function(){ beep(120, 0.5, "sawtooth", 0.08); }, 200); }
  function sWin()      { [523, 659, 784, 1046].forEach(function(f, i){ setTimeout(function(){ beep(f, 0.18, "sine", 0.06); }, i * 130); }); }
  function sCombo(n)   { beep(440 + n * 80, 0.1, "triangle", 0.05); }
  function sPop()      { beep(800, 0.05, "sine", 0.03); }

  /* ---------- 7. INPUT ----------------------------------------------- */
  var keys = {};
  var mouseX = 0, mouseY = 0;
  var mouseDown = false;

  window.addEventListener("keydown", function (e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) !== -1) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    if (e.key === " ") { tryScan(); }
    if (e.key.toLowerCase() === "f") { tryDefend(); }
    if (e.key.toLowerCase() === "p") { togglePause(); }
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });

  // Mouse interaction — click to scan creatures
  canvas.addEventListener("mousemove", function (e) {
    var rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (W / rect.width);
    mouseY = (e.clientY - rect.top) * (H / rect.height) + cameraY;
  });
  canvas.addEventListener("click", function (e) {
    if (!running || state.over || paused) return;
    var rect = canvas.getBoundingClientRect();
    var cx = (e.clientX - rect.left) * (W / rect.width);
    var cy = (e.clientY - rect.top) * (H / rect.height) + cameraY;
    // Try to scan the creature clicked, or nearest
    var clicked = null, cd = 50;
    for (var i = 0; i < state.creatures.length; i++) {
      var c = state.creatures[i];
      if (c.hiding && c.emergeT < 0.2) continue;
      var dd = dist(cx, cy, c.x, c.y);
      if (dd < cd) { cd = dd; clicked = c; }
    }
    if (clicked) {
      // Scan the clicked creature if in range
      var diverDist = dist(state.diver.x, state.diver.y, clicked.x, clicked.y);
      if (diverDist < 160) {
        scanCreature(clicked);
      } else {
        toast("Too far — swim closer to that " + clicked.tpl.name, "#888");
      }
    } else {
      tryScan(); // fallback to nearest scan
    }
  });

  var paused = false;
  function togglePause() { if (running && !state.over) { paused = !paused; document.getElementById("pause-overlay").classList.toggle("hidden", !paused); } }

  /* ---------- 8. HELPERS --------------------------------------------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function depthOf(y) { return Math.max(0, Math.round(y / PX_PER_M)); }

  /* ---------- 9. CORAL REEF GENERATION ------------------------------- */
  function generateCorals(ch) {
    var corals = [];
    var count = ch.coralCount;
    for (var i = 0; i < count; i++) {
      var type = CORAL_TYPES[Math.floor(Math.random() * CORAL_TYPES.length)];
      var depth = rand(3, ch.maxWorldDepth - 2);
      var x = rand(40, W - 40);
      corals.push({
        type: type,
        x: x,
        y: depth * PX_PER_M,
        size: rand(22, 42),
        health: rand(60, 100),
        wobble: Math.random() * Math.PI * 2,
        hasCreature: false,
        creatureId: null,
        glowPulse: 0
      });
    }
    return corals;
  }

  /* ---------- 10. CREATURE SPAWNING ---------------------------------- */
  function spawnCreature() {
    var pool = state.challenge.pool;
    var id = pool[Math.floor(Math.random() * pool.length)];
    var tpl = SPECIES.find(function(s){ return s.id === id; });
    var d = rand(tpl.minD, tpl.maxD);
    var y = clamp(d * PX_PER_M, 20, state.challenge.maxWorldDepth * PX_PER_M);
    var fromLeft = Math.random() < 0.5;

    var attachedCoral = null;
    if (tpl.hides) {
      for (var i = 0; i < state.corals.length; i++) {
        var c = state.corals[i];
        if (!c.hasCreature && Math.abs(c.y - y) < 80 && dist(c.x, c.y, W / 2, y) < 200) {
          attachedCoral = c;
          break;
        }
      }
    }

    var creature = {
      tpl: tpl,
      x: attachedCoral ? attachedCoral.x : (fromLeft ? -40 : W + 40),
      y: attachedCoral ? attachedCoral.y : y,
      vx: attachedCoral ? 0 : (fromLeft ? 1 : -1) * rand(0.3, 0.9),
      vy: attachedCoral ? 0 : rand(-0.1, 0.1),
      dir: fromLeft ? 1 : -1,
      aggro: 0,
      scanned: !!state.catalog[tpl.id],
      flee: 0,
      wobble: Math.random() * Math.PI * 2,
      swimPhase: Math.random() * Math.PI * 2,
      hiding: !!attachedCoral,
      coral: attachedCoral,
      emergeT: 0
    };

    if (attachedCoral) {
      attachedCoral.hasCreature = true;
      attachedCoral.creatureId = tpl.id;
    }

    state.creatures.push(creature);
  }

  /* ---------- 11. POLLUTION SYSTEM ----------------------------------- */
  function spawnPollution() {
    var y = rand(20, state.challenge.maxWorldDepth * PX_PER_M - 20);
    state.pollution.push({
      x: rand(20, W - 20),
      y: y,
      vx: rand(-0.2, 0.2),
      vy: rand(-0.05, 0.05),
      size: rand(8, 16),
      wobble: Math.random() * Math.PI * 2,
      life: 1.0
    });
  }

  /* ---------- 11b. PARTICLE / BUBBLE / PLANKTON SYSTEMS -------------- */
  function spawnBubble(x, y, size, vy) {
    state.bubbles.push({
      x: x, y: y, size: size || rand(2, 5),
      vy: vy || rand(-1.5, -0.8), vx: rand(-0.2, 0.2),
      wobble: Math.random() * Math.PI * 2, life: 1.0
    });
  }

  function spawnSparkle(x, y, color, count) {
    count = count || 12;
    for (var i = 0; i < count; i++) {
      var ang = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
      var sp = rand(1, 3.5);
      state.particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.5,
        size: rand(2, 5), color: color || "#FFD700",
        life: 1.0, decay: rand(0.015, 0.03)
      });
    }
  }

  function spawnScorePopup(x, y, text, color) {
    state.scorePopups.push({
      x: x, y: y, text: text, color: color || "#FFD700",
      vy: -1.5, life: 1.0
    });
  }

  function initPlankton() {
    state.plankton = [];
    for (var i = 0; i < 40; i++) {
      state.plankton.push({
        x: rand(0, W), y: rand(0, state.challenge.maxWorldDepth * PX_PER_M),
        size: rand(0.5, 2), vx: rand(-0.15, 0.15), vy: rand(-0.1, 0.1),
        wobble: Math.random() * Math.PI * 2,
        alpha: rand(0.2, 0.6)
      });
    }
  }

  function spawnRipple(x, y) {
    state.ripples.push({ x: x, y: y, r: 5, maxR: 30, life: 1.0 });
  }

  /* ---------- 11c. OCEAN ATMOSPHERE INIT ------------------------------ */
  function initOcean(ch) {
    // Seaweed / kelp — tall swaying plants from the seabed
    state.seaweed = [];
    for (var i = 0; i < Math.floor(ch.coralCount * 0.5); i++) {
      state.seaweed.push({
        x: rand(15, W - 15), y: ch.maxWorldDepth * PX_PER_M - rand(4, 20),
        height: rand(50, 100), segments: Math.floor(rand(6, 10)),
        sway: Math.random() * Math.PI * 2, swaySpeed: rand(0.7, 1.3),
        color: ["#2A6B3E", "#1A5530", "#357A4A", "#1E6038"][Math.floor(Math.random() * 4)],
        width: rand(3, 5)
      });
    }
    // Seagrass beds — shorter green blades on the sand
    state.seagrass = [];
    for (var i = 0; i < Math.floor(rand(10, 18)); i++) {
      state.seagrass.push({
        x: rand(15, W - 15), y: ch.maxWorldDepth * PX_PER_M - rand(2, 8),
        blades: Math.floor(rand(3, 7)), bladeH: rand(12, 28),
        sway: Math.random() * Math.PI * 2, swaySpeed: rand(1.0, 1.8),
        color: ["#2A8B3E", "#1A6B30", "#3A9B4E"][Math.floor(Math.random() * 3)]
      });
    }
    // Background fish schools — tiny non-interactive fish
    state.bgFish = [];
    for (var i = 0; i < 3; i++) spawnBgFishSchool(ch);
    // Starfish & sea urchins on the seabed
    state.starfish = [];
    for (var i = 0; i < Math.floor(rand(5, 9)); i++) {
      var r = Math.random();
      state.starfish.push({
        x: rand(25, W - 25), y: ch.maxWorldDepth * PX_PER_M - rand(2, 10),
        type: r < 0.5 ? "star" : "urchin",
        size: rand(5, 11),
        color: r < 0.5 ? ["#E04B4B", "#E0A040", "#D06080"][Math.floor(Math.random() * 3)] : "#1A0A2A",
        rot: rand(0, Math.PI * 2)
      });
    }
    // Bubble vents — natural streams from the seabed
    state.vents = [];
    for (var i = 0; i < Math.floor(rand(2, 4)); i++) {
      state.vents.push({
        x: rand(50, W - 50), y: ch.maxWorldDepth * PX_PER_M - rand(5, 12),
        timer: rand(0, 2), rate: rand(0.3, 0.7)
      });
    }
    // Distant silhouettes — shadowy shapes in deep water
    state.silhouettes = [];
    for (var i = 0; i < 3; i++) {
      state.silhouettes.push({
        x: rand(0, W),
        y: rand(ch.maxWorldDepth * 0.35, ch.maxWorldDepth * 0.75) * PX_PER_M,
        vx: (Math.random() < 0.5 ? -1 : 1) * rand(0.08, 0.14),
        size: rand(35, 65),
        phase: Math.random() * Math.PI * 2
      });
    }
    // Drifting seaweed fragments
    state.driftDebris = [];
    for (var i = 0; i < 10; i++) {
      state.driftDebris.push({
        x: rand(0, W), y: rand(15, ch.maxWorldDepth * PX_PER_M - 15),
        vx: rand(-0.1, 0.1), vy: rand(-0.04, 0.04),
        rot: rand(0, Math.PI * 2), rotSpeed: rand(-0.4, 0.4),
        size: rand(3, 8), wobble: Math.random() * Math.PI * 2,
        color: ["#2A6B3E", "#3A7B4E", "#1A5530"][Math.floor(Math.random() * 3)]
      });
    }
  }

  function spawnBgFishSchool(ch) {
    var dir = Math.random() < 0.5 ? 1 : -1;
    var cx = dir > 0 ? -30 : W + 30;
    var cy = rand(25, ch.maxWorldDepth * PX_PER_M * 0.65);
    var count = Math.floor(rand(5, 11));
    var color = ["#A0B8D0", "#8AA0B8", "#B0C4D8", "#94A8C0"][Math.floor(Math.random() * 4)];
    var speed = rand(0.3, 0.55);
    for (var i = 0; i < count; i++) {
      state.bgFish.push({
        x: cx + rand(-20, 20), y: cy + rand(-12, 12),
        vx: dir * speed, baseY: cy + rand(-12, 12),
        size: rand(1.5, 3), color: color,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  /* ---------- 12. PLAYER ACTIONS ------------------------------------- */
  function tryScan() {
    if (!running || state.over || paused) return;
    var d = state.diver;
    if (d.scanCool > 0) return;
    d.scanCool = 0.4;

    var best = null, bestD = 140;
    for (var i = 0; i < state.creatures.length; i++) {
      var c = state.creatures[i];
      var dd = dist(d.x, d.y, c.x, c.y);
      if (dd < bestD) { bestD = dd; best = c; }
    }
    if (!best) { toast("No creature nearby — swim closer to coral", "#888"); return; }
    scanCreature(best);
  }

  function scanCreature(best) {
    var d = state.diver;
    d.scanCool = 0.4;
    sScan();

    if (!state.catalog[best.tpl.id]) {
      state.catalog[best.tpl.id] = true;
      state.discovered++;

      // Combo system — chain discoveries within 6 seconds
      if (state.comboTimer > 0) {
        state.combo++;
      } else {
        state.combo = 1;
      }
      state.comboTimer = 6;

      var points = 1 + Math.floor(state.combo / 2);
      state.rewards += points;
      sReward();
      if (state.combo > 1) sCombo(state.combo);

      // Sparkle burst
      spawnSparkle(best.x, best.y - cameraY, "#FFD700", 14);
      spawnScorePopup(best.x, best.y - cameraY - 20, "+" + points + (state.combo > 1 ? " x" + state.combo : ""), "#FFD700");

      var mis = best.tpl.misconception ? "  ⚠ " + best.tpl.misconception : "";
      var role = "  [" + best.tpl.role + "]";
      var comboMsg = state.combo > 1 ? "  (COMBO x" + state.combo + "!)" : "";
      toast("DISCOVERED: " + best.tpl.name + " — " + best.tpl.fact + role + mis + comboMsg, "#1D9E75");
      best.scanned = true;
      if (best.coral && best.coral.health > 60) {
        state.rewards += 1;
      }
    } else {
      toast("Already recorded: " + best.tpl.name, "#5F5E5A");
    }
  }

  function tryDefend() {
    if (!running || state.over || paused) return;
    var d = state.diver;
    d.defending = 0.5;
    var nearest = null, nd = 160;
    for (var i = 0; i < state.creatures.length; i++) {
      var c = state.creatures[i];
      var dd = dist(d.x, d.y, c.x, c.y);
      if (dd < nd) { nd = dd; nearest = c; }
    }
    if (nearest && nearest.tpl.danger === 0 && nd < 120) {
      nearest.flee = 1.2;
      state.startledPenalty++;
      toast("You startled a harmless " + nearest.tpl.name + ". Observe before you react.", "#D85A30");
    }
  }

  function checkClean() {
    var d = state.diver;
    for (var i = 0; i < state.pollution.length; i++) {
      var p = state.pollution[i];
      if (p.life <= 0) continue;
      var dd = dist(d.x, d.y, p.x, p.y);
      if (dd < 35) {
        p.life -= 0.08;
        if (p.life > 0.5) sClean();
        // green sparkle when cleaning
        if (Math.random() < 0.3) spawnSparkle(p.x, p.y - cameraY, "#5DD3A0", 3);
        for (var j = 0; j < state.corals.length; j++) {
          var c = state.corals[j];
          if (dist(c.x, c.y, p.x, p.y) < 100) {
            c.health = clamp(c.health + 0.3, 0, 100);
          }
        }
        if (p.life <= 0) {
          state.cleaned++;
          state.rewards += 1;
          state.ecoHealth = clamp(state.ecoHealth + 1.5, 0, 100);
          spawnSparkle(p.x, p.y - cameraY, "#1D9E75", 8);
          spawnScorePopup(p.x, p.y - cameraY - 15, "+1", "#1D9E75");
          if (state.cleaned % 3 === 0) {
            sEcoUp();
            toast("Reef clearing up! Eco-health improving.", "#1D9E75");
          }
        }
      }
    }
    state.pollution = state.pollution.filter(function(p){ return p.life > 0; });
  }

  /* ---------- 13. UPDATE --------------------------------------------- */
  function update(dt) {
    state.elapsed += dt;
    var d = state.diver;
    var ch = state.challenge;
    causticPhase += dt * 0.5;

    // --- diver movement ---
    var speed = 2.4 * (keys["shift"] ? 1.7 : 1);
    var mx = 0, my = 0;
    if (keys["arrowleft"] || keys["a"]) mx -= 1;
    if (keys["arrowright"] || keys["d"]) mx += 1;
    if (keys["arrowup"] || keys["w"]) my -= 1;
    if (keys["arrowdown"] || keys["s"]) my += 1;
    d.vx += mx * speed * 0.25;
    d.vy += my * speed * 0.25;
    d.vx *= 0.86; d.vy *= 0.86;
    d.x = clamp(d.x + d.vx, 30, W - 30);
    d.y = clamp(d.y + d.vy, 10, ch.maxWorldDepth * PX_PER_M - 10);
    if (mx !== 0) d.facing = mx > 0 ? 1 : -1;
    if (d.scanCool > 0) d.scanCool -= dt;
    if (d.defending > 0) d.defending -= dt;
    d.finAnim += dt * (Math.abs(d.vx) + Math.abs(d.vy)) * 0.3 + 1;

    // --- ripples when moving ---
    if ((Math.abs(d.vx) > 0.5 || Math.abs(d.vy) > 0.5) && Math.random() < 0.15) {
      spawnRipple(d.x + rand(-8, 8), d.y + rand(-8, 8));
    }

    // --- bubble trail ---
    d.bubbleTimer += dt;
    if (d.bubbleTimer > 0.3) {
      d.bubbleTimer = 0;
      spawnBubble(d.x + (d.facing > 0 ? -8 : 8), d.y - 10, rand(2, 5), rand(-2, -1));
    }

    // --- camera follows diver ---
    var targetCam = clamp(d.y - H / 2, 0, ch.maxWorldDepth * PX_PER_M - H);
    cameraY += (targetCam - cameraY) * 0.1;

    // --- time of day ---
    state.timeOfDay = clamp(state.timeOfDay + dt * 0.005, 0.2, 0.9);

    // --- oxygen ---
    var depthM = depthOf(d.y);
    var oxDrop = ch.oxygenRate * (keys["shift"] ? 1.6 : 1);
    if (depthM > 20) oxDrop *= 1.4;
    state.oxygen -= oxDrop * dt;
    if (depthM <= 2) state.oxygen = Math.min(100, state.oxygen + 8 * dt);
    state.oxygen = clamp(state.oxygen, 0, 100);

    state.alert = clamp(100 - state.elapsed * 0.4, 0, 100);

    // --- pressure & equipment ---
    var overDepth = depthM > ch.maxEquipmentDepth;
    if (overDepth) {
      state.pressureWarn += dt;
      state.equipment -= (depthM - ch.maxEquipmentDepth) * 0.6 * dt;
      state.pressureMesh = clamp(state.pressureMesh + dt * 2, 0, 1);
      if (state.pressureWarn > 1.0) { sPressure(); state.pressureWarn = 0; }
    } else {
      state.pressureMesh = clamp(state.pressureMesh - dt, 0, 1);
      state.equipment = Math.min(100, state.equipment + 2 * dt);
    }
    state.equipment = clamp(state.equipment, 0, 100);

    // --- combo timer ---
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // --- spawn creatures ---
    if (Math.random() < ch.spawnRate * dt * 0.5 && state.creatures.length < 10) spawnCreature();

    // --- spawn pollution ---
    state.pollutionTimer += dt;
    if (state.pollutionTimer > 1 / ch.pollutionRate && state.pollution.length < 12) {
      spawnPollution();
      state.pollutionTimer = 0;
    }

    // --- update pollution ---
    for (var i = 0; i < state.pollution.length; i++) {
      var p = state.pollution[i];
      p.wobble += dt * 2;
      p.x += p.vx + Math.sin(p.wobble) * 0.15;
      p.y += p.vy + Math.cos(p.wobble * 0.7) * 0.08;
      p.x = clamp(p.x, 10, W - 10);
      p.y = clamp(p.y, 15, ch.maxWorldDepth * PX_PER_M - 10);
      for (var j = 0; j < state.corals.length; j++) {
        var c = state.corals[j];
        if (dist(c.x, c.y, p.x, p.y) < 70) {
          c.health = clamp(c.health - 2 * dt, 0, 100);
        }
      }
    }

    checkClean();

    // --- update corals ---
    var totalCoralHealth = 0;
    for (var i = 0; i < state.corals.length; i++) {
      var c = state.corals[i];
      c.wobble += dt * 1.5;
      totalCoralHealth += c.health;
      if (c.hasCreature) {
        var dd = dist(d.x, d.y, c.x, c.y);
        if (dd < 120) {
          c.glowPulse = Math.min(1, c.glowPulse + dt * 3);
        } else {
          c.glowPulse = Math.max(0, c.glowPulse - dt * 2);
        }
      }
    }
    var avgCoralHealth = totalCoralHealth / state.corals.length;
    var pollutionPenalty = Math.min(30, state.pollution.length * 2.5);
    var predatorCount = 0;
    for (var i = 0; i < state.creatures.length; i++) {
      if (state.creatures[i].tpl.predator) predatorCount++;
    }
    var predatorPenalty = predatorCount > 2 ? (predatorCount - 2) * 8 : 0;
    var targetEco = clamp(avgCoralHealth - pollutionPenalty - predatorPenalty, 0, 100);
    state.ecoHealth += (targetEco - state.ecoHealth) * 0.02 * dt * 60;
    state.ecoHealth = clamp(state.ecoHealth, 0, 100);

    // --- creatures AI ---
    var dangerNear = false;
    for (var i = 0; i < state.creatures.length; i++) {
      var c = state.creatures[i];
      c.wobble += dt * 3;
      c.swimPhase += dt * (2 + Math.abs(c.vx) * 0.5);
      var dd = dist(d.x, d.y, c.x, c.y);

      if (c.hiding && c.coral) {
        if (dd < 110) {
          c.emergeT = Math.min(1, c.emergeT + dt * 2);
          c.x = c.coral.x + Math.sin(c.wobble) * 8 * c.emergeT;
          c.y = c.coral.y - 10 * c.emergeT;
        } else {
          c.emergeT = Math.max(0, c.emergeT - dt);
          c.x = c.coral.x;
          c.y = c.coral.y;
        }
      }

      if (c.tpl.predator && c.tpl.danger >= 2 && dd < 200) {
        c.aggro = Math.min(1, c.aggro + dt * 0.5);
      } else {
        c.aggro = Math.max(0, c.aggro - dt * 0.3);
      }

      if (c.flee > 0) {
        c.flee -= dt;
        c.x += -c.dir * 3;
      } else if (!c.hiding) {
        var sp = 0.6 + c.aggro * 1.2;
        c.x += c.dir * sp;
        c.y += c.vy + Math.sin(c.wobble) * 0.3;
        if (c.aggro > 0.3) {
          var dy = d.y - c.y;
          c.y += clamp(dy, -1, 1) * c.aggro;
        }
        c.y = clamp(c.y, c.tpl.minD * PX_PER_M, c.tpl.maxD * PX_PER_M);
      }

      if ((c.tpl.size >= 50 || (c.tpl.predator && c.tpl.danger >= 2)) && dd < 320) dangerNear = true;

      if (c.tpl.predator && c.tpl.danger >= 2 && dd < c.tpl.size + 14) {
        if (d.defending > 0) {
          c.flee = 1.0; c.aggro = 0;
          toast("You warded off the " + c.tpl.name, "#3B6D11");
        } else if (state.attackFlash <= 0) {
          state.health -= 25;
          state.attackFlash = 0.6;
          screenShake = 0.8;
          sAttack();
          spawnSparkle(d.x, d.y - cameraY, "#A32D2D", 16);
          c.flee = 1.0; c.aggro = 0;
          toast("Attacked by " + c.tpl.name + "! Ascend and stay calm.", "#A32D2D");
        }
      }
    }
    state.creatures = state.creatures.filter(function(c){ return c.x > -120 && c.x < W + 120; });

    // --- radar beep ---
    if (dangerNear) {
      state.radarBeep -= dt;
      if (state.radarBeep <= 0) { sRadar(); state.radarBeep = 0.7; }
    }

    state.safe = !dangerNear && !overDepth;

    if (state.attackFlash > 0) state.attackFlash -= dt;
    if (screenShake > 0) screenShake -= dt * 2;

    // --- bubbles ---
    for (var i = 0; i < state.bubbles.length; i++) {
      var b = state.bubbles[i];
      b.wobble += dt * 3;
      b.x += b.vx + Math.sin(b.wobble) * 0.3;
      b.y += b.vy;
      b.life -= dt * 0.15;
    }
    state.bubbles = state.bubbles.filter(function(b){ return b.life > 0 && b.y > -10; });

    // --- particles ---
    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.05; // slight gravity
      p.vx *= 0.97; p.vy *= 0.97;
      p.life -= p.decay;
    }
    state.particles = state.particles.filter(function(p){ return p.life > 0; });

    // --- score popups ---
    for (var i = 0; i < state.scorePopups.length; i++) {
      var sp = state.scorePopups[i];
      sp.y += sp.vy;
      sp.vy *= 0.96;
      sp.life -= dt * 0.8;
    }
    state.scorePopups = state.scorePopups.filter(function(sp){ return sp.life > 0; });

    // --- ripples ---
    for (var i = 0; i < state.ripples.length; i++) {
      var r = state.ripples[i];
      r.r += dt * 40;
      r.life -= dt * 2;
    }
    state.ripples = state.ripples.filter(function(r){ return r.life > 0; });

    // --- plankton ---
    for (var i = 0; i < state.plankton.length; i++) {
      var pl = state.plankton[i];
      pl.wobble += dt;
      pl.x += pl.vx + Math.sin(pl.wobble) * 0.05;
      pl.y += pl.vy + Math.cos(pl.wobble * 0.7) * 0.03;
      if (pl.x < 0) pl.x = W; if (pl.x > W) pl.x = 0;
      if (pl.y < 0) pl.y = ch.maxWorldDepth * PX_PER_M;
      if (pl.y > ch.maxWorldDepth * PX_PER_M) pl.y = 0;
    }

    // --- ocean atmosphere: bg fish, seaweed, vents, silhouettes, debris ---
    for (var i = 0; i < state.bgFish.length; i++) {
      var bf = state.bgFish[i];
      bf.phase += dt * 3.5;
      bf.x += bf.vx;
      bf.y = bf.baseY + Math.sin(bf.phase) * 2.5;
    }
    state.bgFish = state.bgFish.filter(function(bf){ return bf.x > -60 && bf.x < W + 60; });
    if (Math.random() < 0.004 && state.bgFish.length < 25) spawnBgFishSchool(ch);

    for (var i = 0; i < state.seaweed.length; i++) state.seaweed[i].sway += dt * state.seaweed[i].swaySpeed;
    for (var i = 0; i < state.seagrass.length; i++) state.seagrass[i].sway += dt * state.seagrass[i].swaySpeed;

    for (var i = 0; i < state.vents.length; i++) {
      var v = state.vents[i];
      v.timer += dt;
      if (v.timer > 1 / v.rate) {
        v.timer = 0;
        spawnBubble(v.x + rand(-3, 3), v.y, rand(1.5, 3), rand(-1.0, -0.5));
      }
    }

    for (var i = 0; i < state.silhouettes.length; i++) {
      var si = state.silhouettes[i];
      si.x += si.vx; si.phase += dt * 0.4;
      if (si.x < -100) si.x = W + 50;
      if (si.x > W + 100) si.x = -50;
    }

    for (var i = 0; i < state.driftDebris.length; i++) {
      var dd = state.driftDebris[i];
      dd.wobble += dt;
      dd.x += dd.vx + Math.sin(dd.wobble) * 0.08;
      dd.y += dd.vy + Math.cos(dd.wobble * 0.7) * 0.04;
      dd.rot += dd.rotSpeed * dt;
      if (dd.x < 0) dd.x = W; if (dd.x > W) dd.x = 0;
      if (dd.y < 10) dd.y = ch.maxWorldDepth * PX_PER_M - 15;
      if (dd.y > ch.maxWorldDepth * PX_PER_M - 5) dd.y = 10;
    }

    // --- toasts ---
    for (var i = 0; i < state.toasts.length; i++) state.toasts[i].t -= dt;
    state.toasts = state.toasts.filter(function(t){ return t.t > 0; });

    // --- eco-health warnings ---
    if (state.ecoHealth < 25 && Math.random() < 0.01) {
      toast("⚠ Reef health critical! Clean pollution to restore the ecosystem.", "#D85A30");
    }

    // --- win / lose ---
    if (state.discovered >= ch.target && state.ecoHealth >= ch.ecoTarget && !state.over) {
      endGame(true);
    }
    if (state.discovered >= ch.target && state.ecoHealth < ch.ecoTarget && !state.over) {
      if (state.ecoHealth < 20) {
        endGame(false, "You cataloged the species, but the reef ecosystem collapsed.");
      }
    }
    if (state.oxygen <= 0 && !state.over) { toast("Out of oxygen!", "#A32D2D"); endGame(false, "You ran out of oxygen."); }
    if (state.equipment <= 0 && !state.over) { endGame(false, "Equipment failed under pressure."); }
    if (state.health <= 0 && !state.over) { endGame(false, "You were killed by a predator."); }
  }

  /* ---------- 14. RENDER --------------------------------------------- */
  function render() {
    var d = state.diver;
    var depthM = depthOf(d.y);

    // screen shake offset
    var shakeX = screenShake > 0 ? rand(-4, 4) * screenShake : 0;
    var shakeY = screenShake > 0 ? rand(-4, 4) * screenShake : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // --- background: depth-based gradient ---
    var light = clamp(1 - depthM / 70, 0.12, 1);
    var murk = clamp(1 - state.ecoHealth / 100, 0, 0.6);
    var top = mixWater("#5DB8E8", "#02132E", 1 - light, murk);
    var mid = mixWater("#2E7AB0", "#031A38", 1 - light, murk);
    var bot = mixWater("#1A4F7A", "#010A1C", 1 - light, murk);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(0.5, mid); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);

    // --- god rays (animated) ---
    if (cameraY < 250) {
      var rayAlpha = 0.08 * (1 - murk) * clamp(1 - cameraY / 250, 0, 1);
      ctx.save(); ctx.globalAlpha = rayAlpha;
      for (var i = 0; i < 6; i++) {
        var rayX = 60 + i * 160 + Math.sin(causticPhase * 0.3 + i) * 20;
        var rayW = 30 + Math.sin(causticPhase * 0.5 + i * 2) * 8;
        var rayBot = 250 - cameraY;
        var grad = ctx.createLinearGradient(rayX, 0, rayX + rayW, rayBot);
        grad.addColorStop(0, "rgba(200,240,255,0.8)");
        grad.addColorStop(1, "rgba(200,240,255,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(rayX, 0);
        ctx.lineTo(rayX + rayW, 0);
        ctx.lineTo(rayX + rayW + 30, rayBot);
        ctx.lineTo(rayX - 10, rayBot);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    // --- caustic light patterns on seabed area ---
    drawCaustics();

    // --- water surface with waves ---
    var surfY = -cameraY;
    if (surfY > -30) {
      ctx.save();
      ctx.fillStyle = "rgba(180,220,255,0.15)";
      ctx.beginPath();
      ctx.moveTo(0, surfY + 8);
      for (var x = 0; x <= W; x += 8) {
        var wy = surfY + Math.sin(x * 0.03 + causticPhase * 1.5) * 4 + Math.sin(x * 0.07 + causticPhase) * 2;
        ctx.lineTo(x, wy);
      }
      ctx.lineTo(W, surfY + 30); ctx.lineTo(0, surfY + 30); ctx.closePath(); ctx.fill();
      // bright surface line
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (var x = 0; x <= W; x += 8) {
        var wy = surfY + Math.sin(x * 0.03 + causticPhase * 1.5) * 4 + Math.sin(x * 0.07 + causticPhase) * 2;
        if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // --- depth markers ---
    drawDepthMarkers();

    // --- plankton (background floating particles) ---
    drawPlankton();

    // --- distant silhouettes (deep water shadows) ---
    drawSilhouettes();

    // --- background fish schools ---
    drawBgFish();

    // --- seabed ---
    drawSeabed();

    // --- seagrass, starfish & seaweed on the seabed ---
    drawSeagrass();
    drawStarfish();
    drawSeaweed();

    // --- coral reef formations ---
    drawCorals();

    // --- ripples ---
    drawRipples();

    // --- drifting debris ---
    drawDriftDebris();

    // --- pollution particles ---
    drawPollution();

    // --- creatures (sorted by depth for proper layering) ---
    var sortedCreatures = state.creatures.slice().sort(function(a, b){ return a.y - b.y; });
    for (var i = 0; i < sortedCreatures.length; i++) {
      var c = sortedCreatures[i];
      var sy = c.y - cameraY;
      if (sy < -80 || sy > H + 80) continue;
      drawCreature(c, sy);
    }

    // --- bubbles ---
    drawBubbles();

    // --- diver ---
    drawDiver(d.x, d.y - cameraY, d.facing, d.defending > 0, d.finAnim);

    // --- particles ---
    drawParticles();

    // --- score popups ---
    drawScorePopups();

    // --- scan range indicator ---
    if (d.scanCool > 0.2) {
      ctx.strokeStyle = "rgba(95,200,160,0.5)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(d.x, d.y - cameraY, 140, 0, Math.PI * 2); ctx.stroke();
    }
    // clean range
    ctx.strokeStyle = "rgba(95,200,160,0.1)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(d.x, d.y - cameraY, 35, 0, Math.PI * 2); ctx.stroke();

    // --- feedback overlays ---
    if (state.pressureMesh > 0) drawEdgeMesh(state.pressureMesh);
    if (state.attackFlash > 0) {
      ctx.save(); ctx.globalAlpha = state.attackFlash * 0.5;
      ctx.fillStyle = "#A32D2D"; ctx.fillRect(0, 0, W, H); ctx.restore();
    }

    // --- depth vignette ---
    drawVignette(depthM);

    // --- radar ---
    drawRadar();

    // --- combo display ---
    drawCombo();

    // --- toasts ---
    drawToasts();

    ctx.restore();

    // --- HUD ---
    updateHUD(depthM);
  }

  function drawCaustics() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.06 * clamp(1 - cameraY / 300, 0, 1);
    for (var i = 0; i < 8; i++) {
      var cx = (i * 130 + Math.sin(causticPhase + i * 0.7) * 40) % W;
      var cy = (Math.cos(causticPhase * 0.8 + i) * 30 + 50) % H;
      var r = 40 + Math.sin(causticPhase + i * 1.3) * 10;
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, "rgba(200,240,255,0.8)");
      grad.addColorStop(1, "rgba(200,240,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlankton() {
    ctx.save();
    for (var i = 0; i < state.plankton.length; i++) {
      var pl = state.plankton[i];
      var sy = pl.y - cameraY;
      if (sy < -10 || sy > H + 10) continue;
      ctx.globalAlpha = pl.alpha * (0.5 + 0.5 * Math.sin(pl.wobble));
      ctx.fillStyle = "rgba(220,240,255,0.8)";
      ctx.beginPath(); ctx.arc(pl.x, sy, pl.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawSeabed() {
    var floorY = state.challenge.maxWorldDepth * PX_PER_M - cameraY;
    if (floorY > H + 50) return;
    ctx.save();
    // sand gradient
    var sandGrad = ctx.createLinearGradient(0, floorY - 20, 0, H);
    sandGrad.addColorStop(0, "rgba(180,160,110,0.3)");
    sandGrad.addColorStop(0.5, "rgba(150,130,90,0.7)");
    sandGrad.addColorStop(1, "rgba(120,100,70,0.9)");
    ctx.fillStyle = sandGrad;
    // wavy sand surface
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    for (var x = 0; x <= W; x += 12) {
      var sy = floorY + Math.sin(x * 0.02 + 1.5) * 6 + Math.sin(x * 0.05) * 3;
      ctx.lineTo(x, sy);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // sand texture dots
    ctx.fillStyle = "rgba(200,180,130,0.3)";
    for (var i = 0; i < 30; i++) {
      var rx = (i * 37 + 13) % W;
      var ry = floorY + (i * 23 % 30) + 5;
      if (ry < H) { ctx.beginPath(); ctx.arc(rx, ry, 1.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // rocks
    ctx.fillStyle = "rgba(100,90,75,0.6)";
    for (var i = 0; i < 5; i++) {
      var rx = (i * 193 + 50) % W;
      var ry = floorY + (i * 17 % 20) + 8;
      if (ry < H) {
        ctx.beginPath();
        ctx.ellipse(rx, ry, 12 + (i * 7 % 8), 6 + (i * 5 % 5), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------- 14aa. OCEAN ATMOSPHERE DRAWING ------------------------- */
  function drawSilhouettes() {
    ctx.save();
    for (var i = 0; i < state.silhouettes.length; i++) {
      var si = state.silhouettes[i];
      var sy = si.y - cameraY;
      if (sy < -60 || sy > H + 60) continue;
      var depthF = clamp(depthOf(si.y) / state.challenge.maxWorldDepth, 0, 1);
      ctx.globalAlpha = 0.08 + depthF * 0.1;
      ctx.fillStyle = "#01101E";
      var dir = si.vx > 0 ? 1 : -1;
      // body
      ctx.beginPath();
      ctx.ellipse(si.x, sy, si.size, si.size * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      // tail
      ctx.beginPath();
      ctx.moveTo(si.x - dir * si.size * 0.9, sy);
      ctx.lineTo(si.x - dir * (si.size + 14), sy - si.size * 0.22);
      ctx.lineTo(si.x - dir * (si.size + 14), sy + si.size * 0.22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBgFish() {
    ctx.save();
    for (var i = 0; i < state.bgFish.length; i++) {
      var bf = state.bgFish[i];
      var sy = bf.y - cameraY;
      if (sy < -5 || sy > H + 5) continue;
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = bf.color;
      var dir = bf.vx > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(bf.x, sy, bf.size, bf.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bf.x - dir * bf.size, sy);
      ctx.lineTo(bf.x - dir * (bf.size + 2), sy - bf.size * 0.4);
      ctx.lineTo(bf.x - dir * (bf.size + 2), sy + bf.size * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSeagrass() {
    ctx.save();
    for (var i = 0; i < state.seagrass.length; i++) {
      var sg = state.seagrass[i];
      var sy = sg.y - cameraY;
      if (sy < -sg.bladeH || sy > H + 5) continue;
      ctx.strokeStyle = sg.color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (var b = 0; b < sg.blades; b++) {
        var bx = sg.x + (b - sg.blades / 2) * 5;
        var swayAmt = Math.sin(sg.sway + b * 0.4) * 4;
        ctx.beginPath();
        ctx.moveTo(bx, sy);
        ctx.quadraticCurveTo(bx + swayAmt * 0.5, sy - sg.bladeH * 0.5, bx + swayAmt, sy - sg.bladeH);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawStarfish() {
    for (var i = 0; i < state.starfish.length; i++) {
      var sf = state.starfish[i];
      var sy = sf.y - cameraY;
      if (sy < -20 || sy > H + 20) continue;
      ctx.save();
      ctx.translate(sf.x, sy);
      if (sf.type === "star") {
        ctx.rotate(sf.rot);
        ctx.fillStyle = sf.color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        for (var k = 0; k < 5; k++) {
          var ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
          if (k === 0) ctx.moveTo(Math.cos(ang) * sf.size, Math.sin(ang) * sf.size);
          else ctx.lineTo(Math.cos(ang) * sf.size, Math.sin(ang) * sf.size);
          var ang2 = ang + Math.PI / 5;
          ctx.lineTo(Math.cos(ang2) * sf.size * 0.4, Math.sin(ang2) * sf.size * 0.4);
        }
        ctx.closePath();
        ctx.fill();
        // center dot
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(0, 0, sf.size * 0.2, 0, Math.PI * 2); ctx.fill();
      } else {
        // sea urchin — dark spiky ball
        ctx.fillStyle = sf.color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(0, 0, sf.size * 0.5, 0, Math.PI * 2); ctx.fill();
        // spikes
        ctx.strokeStyle = sf.color;
        ctx.lineWidth = 1.5;
        for (var k = 0; k < 12; k++) {
          var sp = (k / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(sp) * sf.size * 0.4, Math.sin(sp) * sf.size * 0.4);
          ctx.lineTo(Math.cos(sp) * sf.size, Math.sin(sp) * sf.size);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  function drawSeaweed() {
    ctx.save();
    for (var i = 0; i < state.seaweed.length; i++) {
      var sw = state.seaweed[i];
      var sy = sw.y - cameraY;
      if (sy < -sw.height || sy > H + 10) continue;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.width;
      ctx.lineCap = "round";
      var segH = sw.height / sw.segments;
      ctx.beginPath();
      ctx.moveTo(sw.x, sy);
      for (var s = 1; s <= sw.segments; s++) {
        var swayAmt = Math.sin(sw.sway + s * 0.4) * (s * 2);
        ctx.lineTo(sw.x + swayAmt, sy - s * segH);
      }
      ctx.stroke();
      // leaves on alternating segments
      for (var s = 2; s <= sw.segments; s += 2) {
        var lSway = Math.sin(sw.sway + s * 0.4) * (s * 2);
        var lx = sw.x + lSway;
        var ly = sy - s * segH;
        ctx.fillStyle = sw.color;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(lx + 5, ly, 6, 2.5, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(lx - 5, ly + 2, 6, 2.5, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function drawDriftDebris() {
    ctx.save();
    for (var i = 0; i < state.driftDebris.length; i++) {
      var dd = state.driftDebris[i];
      var sy = dd.y - cameraY;
      if (sy < -10 || sy > H + 10) continue;
      ctx.save();
      ctx.translate(dd.x, sy);
      ctx.rotate(dd.rot);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = dd.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, dd.size, dd.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(dd.size * 0.5, 0, dd.size * 0.3, dd.size * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawRipples() {
    ctx.save();
    for (var i = 0; i < state.ripples.length; i++) {
      var r = state.ripples[i];
      var sy = r.y - cameraY;
      ctx.globalAlpha = r.life * 0.3;
      ctx.strokeStyle = "rgba(200,230,255,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(r.x, sy, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawDepthMarkers() {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "11px sans-serif"; ctx.lineWidth = 1;
    for (var m = 10; m <= state.challenge.maxWorldDepth; m += 10) {
      var y = m * PX_PER_M - cameraY;
      if (y < 0 || y > H) continue;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillText(m + " m", 8, y - 3);
    }
    var ey = state.challenge.maxEquipmentDepth * PX_PER_M - cameraY;
    if (ey > 0 && ey < H) {
      ctx.strokeStyle = "rgba(226,75,74,0.5)"; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(0, ey); ctx.lineTo(W, ey); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#E24B4A"; ctx.fillText("equipment limit " + state.challenge.maxEquipmentDepth + " m", W - 180, ey - 3);
    }
    ctx.restore();
  }

  /* ---------- 14a. CORAL DRAWING (detailed) -------------------------- */
  function drawCorals() {
    for (var i = 0; i < state.corals.length; i++) {
      var c = state.corals[i];
      var sy = c.y - cameraY;
      if (sy < -60 || sy > H + 60) continue;

      var healthRatio = c.health / 100;
      var fillColor = mixColor(c.type.color, "#E8E6E0", 1 - healthRatio);
      var accentColor = mixColor(c.type.accent, "#E8E6E0", 1 - healthRatio);
      var darkColor = mixColor(c.type.accent, "#999", 1 - healthRatio);

      ctx.save();
      ctx.translate(c.x, sy);

      // shadow beneath coral
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.ellipse(0, c.size * 0.45, c.size * 0.6, c.size * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // discovery glow
      if (c.glowPulse > 0) {
        ctx.save();
        ctx.globalAlpha = c.glowPulse * 0.4 * (0.5 + 0.5 * Math.sin(c.wobble * 2));
        var glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, c.size * 2);
        glowGrad.addColorStop(0, "rgba(255,230,120,0.6)");
        glowGrad.addColorStop(1, "rgba(255,230,120,0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath(); ctx.arc(0, 0, c.size * 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      var s = c.size;
      var sway = Math.sin(c.wobble) * 2;

      switch (c.type.shape) {
        case "brain":
          // shadow layer
          ctx.fillStyle = darkColor;
          ctx.beginPath(); ctx.ellipse(2, 2, s * 0.72, s * 0.52, 0, 0, Math.PI * 2); ctx.fill();
          // main dome with gradient
          var bgrad = ctx.createRadialGradient(-s * 0.2, -s * 0.2, 0, 0, 0, s * 0.8);
          bgrad.addColorStop(0, fillColor);
          bgrad.addColorStop(1, accentColor);
          ctx.fillStyle = bgrad;
          ctx.beginPath(); ctx.ellipse(0, 0, s * 0.7, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
          // surface ridges
          ctx.strokeStyle = darkColor; ctx.lineWidth = 1.5;
          for (var k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.moveTo(k * 10, -s * 0.4);
            ctx.quadraticCurveTo(k * 10 + 6, 0, k * 10, s * 0.3);
            ctx.stroke();
          }
          // highlight
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.beginPath(); ctx.ellipse(-s * 0.2, -s * 0.25, s * 0.25, s * 0.12, -0.3, 0, Math.PI * 2); ctx.fill();
          break;

        case "fan":
          // shadow
          ctx.fillStyle = darkColor;
          ctx.beginPath();
          ctx.moveTo(2, s * 0.42);
          ctx.quadraticCurveTo(-s * 0.58 + sway, -s * 0.18, -s * 0.28 + sway, -s * 0.58);
          ctx.quadraticCurveTo(2, -s * 0.68, s * 0.32 + sway, -s * 0.58);
          ctx.quadraticCurveTo(s * 0.62 + sway, -s * 0.18, 2, s * 0.42);
          ctx.fill();
          // main fan with gradient
          var fgrad = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.4);
          fgrad.addColorStop(0, fillColor);
          fgrad.addColorStop(1, accentColor);
          ctx.fillStyle = fgrad;
          ctx.beginPath();
          ctx.moveTo(0, s * 0.4);
          ctx.quadraticCurveTo(-s * 0.6 + sway, -s * 0.2, -s * 0.3 + sway, -s * 0.6);
          ctx.quadraticCurveTo(0, -s * 0.7, s * 0.3 + sway, -s * 0.6);
          ctx.quadraticCurveTo(s * 0.6 + sway, -s * 0.2, 0, s * 0.4);
          ctx.fill();
          // branch lines
          ctx.strokeStyle = darkColor; ctx.lineWidth = 1.5;
          for (var k = -2; k <= 2; k++) {
            ctx.beginPath();
            ctx.moveTo(0, s * 0.3);
            ctx.lineTo(k * 6 + sway, -s * 0.4);
            ctx.stroke();
          }
          // polyp dots
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          for (var k = -2; k <= 2; k++) {
            ctx.beginPath(); ctx.arc(k * 6 + sway, -s * 0.35, 1.5, 0, Math.PI * 2); ctx.fill();
          }
          break;

        case "tube":
          // shadow
          ctx.fillStyle = darkColor;
          for (var k = -1; k <= 1; k++) {
            ctx.beginPath(); ctx.ellipse(k * 8 + 2, 2, 5, s * 0.52, 0, 0, Math.PI * 2); ctx.fill();
          }
          // tubes with gradient
          for (var k = -1; k <= 1; k++) {
            var tgrad = ctx.createLinearGradient(k * 8 - 5, 0, k * 8 + 5, 0);
            tgrad.addColorStop(0, accentColor);
            tgrad.addColorStop(0.5, fillColor);
            tgrad.addColorStop(1, accentColor);
            ctx.fillStyle = tgrad;
            ctx.beginPath(); ctx.ellipse(k * 8, 0, 5, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
          }
          // tube openings (dark interior)
          ctx.fillStyle = "rgba(20,15,10,0.6)";
          for (var k = -1; k <= 1; k++) {
            ctx.beginPath(); ctx.ellipse(k * 8, -s * 0.4, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
          }
          // rim highlight
          ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1;
          for (var k = -1; k <= 1; k++) {
            ctx.beginPath(); ctx.ellipse(k * 8, -s * 0.4, 3, 2, 0, Math.PI, 0); ctx.stroke();
          }
          break;

        case "anemone":
          // shadow
          ctx.fillStyle = darkColor;
          ctx.beginPath(); ctx.arc(2, 2, s * 0.37, 0, Math.PI * 2); ctx.fill();
          // body with gradient
          var agrad = ctx.createRadialGradient(-s * 0.1, -s * 0.1, 0, 0, 0, s * 0.4);
          agrad.addColorStop(0, fillColor);
          agrad.addColorStop(1, accentColor);
          ctx.fillStyle = agrad;
          ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2); ctx.fill();
          // tentacles with gradient tips
          for (var t = 0; t < 10; t++) {
            var ang = (t / 10) * Math.PI * 2;
            var tx = Math.cos(ang) * s * 0.35;
            var ty = Math.sin(ang) * s * 0.35;
            var wave = Math.sin(c.wobble + t * 0.5) * 4;
            var tentGrad = ctx.createLinearGradient(tx, ty, tx + wave * 0.5, ty - s * 0.55);
            tentGrad.addColorStop(0, accentColor);
            tentGrad.addColorStop(1, fillColor);
            ctx.strokeStyle = tentGrad; ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.quadraticCurveTo(tx + wave, ty - s * 0.3, tx + wave * 0.5, ty - s * 0.55);
            ctx.stroke();
            // glowing tip
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.beginPath(); ctx.arc(tx + wave * 0.5, ty - s * 0.55, 1.5, 0, Math.PI * 2); ctx.fill();
          }
          break;

        case "plate":
          // shadow
          ctx.fillStyle = darkColor;
          ctx.beginPath(); ctx.ellipse(2, 2, s * 0.82, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
          // stem
          ctx.fillStyle = accentColor;
          ctx.fillRect(-3, 0, 6, s * 0.3);
          // plate with gradient
          var pgrad = ctx.createRadialGradient(-s * 0.2, -s * 0.15, 0, 0, 0, s * 0.8);
          pgrad.addColorStop(0, fillColor);
          pgrad.addColorStop(1, accentColor);
          ctx.fillStyle = pgrad;
          ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(0, -s * 0.2, s * 0.6, s * 0.15, 0, 0, Math.PI * 2); ctx.fill();
          // top highlight
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.22, s * 0.3, s * 0.06, 0, 0, Math.PI * 2); ctx.fill();
          break;
      }
      ctx.restore();
    }
  }

  /* ---------- 14b. POLLUTION DRAWING --------------------------------- */
  function drawPollution() {
    for (var i = 0; i < state.pollution.length; i++) {
      var p = state.pollution[i];
      var sy = p.y - cameraY;
      if (sy < -30 || sy > H + 30) continue;
      ctx.save();
      ctx.globalAlpha = p.life * 0.75;
      ctx.translate(p.x, sy);
      ctx.rotate(Math.sin(p.wobble) * 0.3);
      // shadow
      ctx.fillStyle = "rgba(40,30,20,0.3)";
      ctx.beginPath(); ctx.ellipse(1, 1, p.size * 0.62, p.size * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      // main blob
      var pgrad = ctx.createRadialGradient(-p.size * 0.15, -p.size * 0.1, 0, 0, 0, p.size * 0.6);
      pgrad.addColorStop(0, "#8B7D6F");
      pgrad.addColorStop(1, "#5A4D40");
      ctx.fillStyle = pgrad;
      ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.6, p.size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      // inner detail
      ctx.fillStyle = "rgba(60,50,40,0.5)";
      ctx.beginPath(); ctx.ellipse(2, -1, p.size * 0.3, p.size * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- 14c. CREATURE DRAWING (detailed) ----------------------- */
  function drawCreature(c, sy) {
    var s = c.tpl.size;
    var alpha = c.hiding ? c.emergeT : 1;
    if (alpha < 0.05) return;

    var tailWag = Math.sin(c.swimPhase) * 0.3;

    // shadow beneath creature
    ctx.save();
    ctx.globalAlpha = alpha * 0.15;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(c.x, sy + s * 0.4, s * 0.5, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(c.x, sy);
    if (c.dir < 0) ctx.scale(-1, 1);

    var col = c.tpl.color;
    var dark = c.tpl.dark || c.tpl.color;
    var lightCol = mixColor(col, "#ffffff", 0.3);

    // --- species-specific rendering ---
    if (c.tpl.id === "whaleshark") {
      drawWhaleShark(s, col, dark, lightCol, tailWag);
    } else if (c.tpl.id === "jelly") {
      drawJellyfish(s, col, dark, lightCol, c.wobble);
    } else if (c.tpl.id === "turtle") {
      drawTurtle(s, col, dark, lightCol, c.swimPhase);
    } else if (c.tpl.id === "eel") {
      drawEel(s, col, dark, lightCol, c.swimPhase);
    } else if (c.tpl.id === "reefshark" || c.tpl.id === "hammer") {
      drawShark(s, col, dark, lightCol, tailWag, c.tpl.id === "hammer");
    } else if (c.tpl.id === "barracuda") {
      drawBarracuda(s, col, dark, lightCol, tailWag);
    } else if (c.tpl.id === "tuna") {
      drawTuna(s, col, dark, lightCol, tailWag);
    } else {
      drawGenericFish(s, col, dark, lightCol, tailWag, c.tpl);
    }

    ctx.restore();

    // name tag
    var dd = dist(state.diver.x, state.diver.y, c.x, c.y);
    if ((c.scanned || dd < 90) && alpha > 0.5) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c.scanned ? "rgba(29,158,117,0.9)" : "rgba(255,255,255,0.6)";
      ctx.font = "11px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(c.tpl.name, c.x, sy - s * 0.5 - 6); ctx.textAlign = "left";
      ctx.restore();
    }
  }

  function drawGenericFish(s, col, dark, light, tailWag, tpl) {
    var bodyGrad = ctx.createLinearGradient(0, -s * 0.3, 0, s * 0.3);
    bodyGrad.addColorStop(0, light);
    bodyGrad.addColorStop(0.5, col);
    bodyGrad.addColorStop(1, dark);
    // body
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.6, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // tail
    ctx.fillStyle = dark;
    ctx.save();
    ctx.translate(-s * 0.55, 0);
    ctx.rotate(tailWag);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.35, -s * 0.25);
    ctx.lineTo(-s * 0.35, s * 0.25);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // dorsal fin
    ctx.fillStyle = mixColor(col, dark, 0.5);
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.28);
    ctx.lineTo(-s * 0.1, -s * 0.48);
    ctx.lineTo(-s * 0.15, -s * 0.28);
    ctx.closePath(); ctx.fill();
    // pectoral fin
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(s * 0.15, s * 0.15, s * 0.12, s * 0.06, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(s * 0.35, -s * 0.08, s * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(s * 0.37, -s * 0.08, s * 0.04, 0, Math.PI * 2); ctx.fill();
    // species-specific stripes
    if (tpl.id === "clownfish") {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.ellipse(-s * 0.15, 0, s * 0.04, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.15, 0, s * 0.04, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    } else if (tpl.id === "tang") {
      ctx.fillStyle = "rgba(255,200,0,0.5)";
      ctx.beginPath(); ctx.ellipse(s * 0.0, 0, s * 0.5, s * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    } else if (tpl.id === "parrot") {
      // beak-like mouth
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(s * 0.5, -s * 0.05);
      ctx.lineTo(s * 0.65, 0);
      ctx.lineTo(s * 0.5, s * 0.05);
      ctx.closePath(); ctx.fill();
      // pink/green patches
      ctx.fillStyle = "rgba(200,100,200,0.3)";
      ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.1, s * 0.15, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    } else if (tpl.id === "wrasse") {
      // stripe
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.4, s * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawWhaleShark(s, col, dark, light, tailWag) {
    var bodyGrad = ctx.createLinearGradient(0, -s * 0.3, 0, s * 0.3);
    bodyGrad.addColorStop(0, light);
    bodyGrad.addColorStop(0.5, col);
    bodyGrad.addColorStop(1, dark);
    ctx.fillStyle = bodyGrad;
    // massive body
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.7, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // wide mouth
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.05, s * 0.2, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    // tail
    ctx.save();
    ctx.translate(-s * 0.65, 0); ctx.rotate(tailWag * 0.5);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.4, -s * 0.35, -s * 0.3);
    ctx.quadraticCurveTo(-s * 0.15, 0, -s * 0.35, s * 0.3);
    ctx.quadraticCurveTo(-s * 0.2, s * 0.4, 0, 0);
    ctx.fill();
    ctx.restore();
    // dorsal fin
    ctx.fillStyle = mixColor(col, dark, 0.5);
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.32);
    ctx.quadraticCurveTo(-s * 0.1, -s * 0.55, -s * 0.2, -s * 0.32);
    ctx.closePath(); ctx.fill();
    // pectoral fins
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(s * 0.15, s * 0.2, s * 0.2, s * 0.08, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // white spots
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (var i = -2; i <= 2; i++) {
      for (var j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.arc(i * 10, j * 8 + 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(s * 0.4, -s * 0.12, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(s * 0.41, -s * 0.12, s * 0.03, 0, Math.PI * 2); ctx.fill();
  }

  function drawJellyfish(s, col, dark, light, wobble) {
    // bell with gradient
    var bellGrad = ctx.createRadialGradient(0, -s * 0.1, 0, 0, 0, s * 0.6);
    bellGrad.addColorStop(0, mixColor(col, "#fff", 0.4));
    bellGrad.addColorStop(0.7, col);
    bellGrad.addColorStop(1, mixColor(col, dark, 0.5));
    ctx.fillStyle = bellGrad;
    ctx.globalAlpha *= 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.6, Math.PI, 0);
    ctx.quadraticCurveTo(s * 0.5, s * 0.05, s * 0.4, s * 0.12);
    ctx.quadraticCurveTo(0, s * 0.08, -s * 0.4, s * 0.12);
    ctx.quadraticCurveTo(-s * 0.5, s * 0.05, -s * 0.6, 0);
    ctx.fill();
    // inner frills
    ctx.fillStyle = mixColor(col, "#fff", 0.3);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.1, s * 0.35, s * 0.15, 0, 0, Math.PI);
    ctx.fill();
    // tentacles
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.globalAlpha *= 0.7;
    for (var i = -3; i <= 3; i++) {
      var tx = i * 5;
      var wave = Math.sin(wobble + i * 0.5) * 6;
      ctx.beginPath();
      ctx.moveTo(tx, s * 0.1);
      ctx.quadraticCurveTo(tx + wave * 0.5, s * 0.3, tx + wave, s * 0.6);
      ctx.stroke();
      // thinner inner tentacle
      ctx.strokeStyle = light; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, s * 0.1);
      ctx.quadraticCurveTo(tx + wave * 0.3, s * 0.25, tx + wave * 0.7, s * 0.5);
      ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2;
    }
    // glow
    ctx.globalAlpha = 0.1;
    var glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
    glowGrad.addColorStop(0, col);
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
  }

  function drawTurtle(s, col, dark, light, swimPhase) {
    var flipperAng = Math.sin(swimPhase) * 0.3;
    // shell with gradient
    var shellGrad = ctx.createRadialGradient(-s * 0.1, -s * 0.1, 0, 0, 0, s * 0.5);
    shellGrad.addColorStop(0, light);
    shellGrad.addColorStop(0.7, col);
    shellGrad.addColorStop(1, dark);
    ctx.fillStyle = shellGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.5, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // shell pattern (hexagon-like)
    ctx.strokeStyle = dark; ctx.lineWidth = 1;
    for (var i = -1; i <= 1; i++) {
      for (var j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.ellipse(i * 8, j * 6, 4, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // head
    ctx.fillStyle = mixColor(col, dark, 0.3);
    ctx.beginPath();
    ctx.ellipse(s * 0.55, -2, s * 0.15, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // eye
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(s * 0.6, -4, 1.5, 0, Math.PI * 2); ctx.fill();
    // front flippers
    ctx.fillStyle = mixColor(col, dark, 0.4);
    ctx.save();
    ctx.translate(s * 0.25, -s * 0.25);
    ctx.rotate(-0.5 + flipperAng);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.18, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(s * 0.25, s * 0.25);
    ctx.rotate(0.5 - flipperAng);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.18, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // back flippers
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, -s * 0.2, s * 0.1, s * 0.05, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, s * 0.2, s * 0.1, s * 0.05, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEel(s, col, dark, light, swimPhase) {
    var wave = Math.sin(swimPhase) * 0.15;
    var bodyGrad = ctx.createLinearGradient(0, -s * 0.15, 0, s * 0.15);
    bodyGrad.addColorStop(0, light);
    bodyGrad.addColorStop(0.5, col);
    bodyGrad.addColorStop(1, dark);
    ctx.fillStyle = bodyGrad;
    // sinuous body
    ctx.beginPath();
    ctx.moveTo(s * 0.6, 0);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.1 + wave * s, -s * 0.2, 0);
    ctx.quadraticCurveTo(-s * 0.5, s * 0.1 - wave * s, -s * 0.7, 0);
    ctx.quadraticCurveTo(-s * 0.5, s * 0.15 - wave * s, -s * 0.2, s * 0.08);
    ctx.quadraticCurveTo(s * 0.2, s * 0.05 + wave * s, s * 0.6, s * 0.06);
    ctx.closePath(); ctx.fill();
    // head
    ctx.fillStyle = mixColor(col, dark, 0.3);
    ctx.beginPath();
    ctx.ellipse(s * 0.55, 0, s * 0.1, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    // mouth
    ctx.strokeStyle = dark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(s * 0.6, 0); ctx.lineTo(s * 0.65, s * 0.03); ctx.stroke();
    // eye
    ctx.fillStyle = "#FFD700";
    ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.03, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(s * 0.56, -s * 0.03, 1, 0, Math.PI * 2); ctx.fill();
    // spots
    ctx.fillStyle = dark;
    for (var i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(s * 0.3 - i * 12, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawShark(s, col, dark, light, tailWag, isHammer) {
    var bodyGrad = ctx.createLinearGradient(0, -s * 0.3, 0, s * 0.3);
    bodyGrad.addColorStop(0, light);
    bodyGrad.addColorStop(0.4, col);
    bodyGrad.addColorStop(0.6, col);
    bodyGrad.addColorStop(1, dark);
    // body
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.6, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    // belly line
    ctx.fillStyle = mixColor(col, "#fff", 0.4);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.1, s * 0.45, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // tail
    ctx.save();
    ctx.translate(-s * 0.55, 0); ctx.rotate(tailWag * 0.5);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.35, -s * 0.35, -s * 0.25);
    ctx.quadraticCurveTo(-s * 0.1, 0, -s * 0.35, s * 0.25);
    ctx.quadraticCurveTo(-s * 0.2, s * 0.35, 0, 0);
    ctx.fill();
    ctx.restore();
    // dorsal fin
    ctx.fillStyle = mixColor(col, dark, 0.3);
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.22);
    ctx.quadraticCurveTo(-s * 0.05, -s * 0.5, -s * 0.2, -s * 0.22);
    ctx.closePath(); ctx.fill();
    // pectoral fins
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(s * 0.15, s * 0.1);
    ctx.quadraticCurveTo(s * 0.0, s * 0.35, -s * 0.15, s * 0.2);
    ctx.quadraticCurveTo(0, s * 0.12, s * 0.15, s * 0.1);
    ctx.fill();
    // head
    if (isHammer) {
      // hammerhead
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(s * 0.55, -s * 0.12, s * 0.12, s * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s * 0.55, s * 0.12, s * 0.12, s * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      // eyes at ends
      ctx.fillStyle = "#FFD700";
      ctx.beginPath(); ctx.arc(s * 0.62, -s * 0.12, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.62, s * 0.12, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      // reef shark pointed snout
      ctx.fillStyle = mixColor(col, dark, 0.3);
      ctx.beginPath();
      ctx.moveTo(s * 0.5, -s * 0.08);
      ctx.lineTo(s * 0.68, 0);
      ctx.lineTo(s * 0.5, s * 0.08);
      ctx.closePath(); ctx.fill();
      // eye
      ctx.fillStyle = "#FFD700";
      ctx.beginPath(); ctx.arc(s * 0.38, -s * 0.08, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath(); ctx.arc(s * 0.39, -s * 0.08, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    // gills
    ctx.strokeStyle = dark; ctx.lineWidth = 1;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * 0.25 - i * 4, -s * 0.1);
      ctx.quadraticCurveTo(s * 0.25 - i * 4 + 2, 0, s * 0.25 - i * 4, s * 0.08);
      ctx.stroke();
    }
  }

  function drawBarracuda(s, col, dark, light, tailWag) {
    var bodyGrad = ctx.createLinearGradient(0, -s * 0.15, 0, s * 0.15);
    bodyGrad.addColorStop(0, light);
    bodyGrad.addColorStop(0.5, col);
    bodyGrad.addColorStop(1, dark);
    ctx.fillStyle = bodyGrad;
    // long torpedo body
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.7, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // silver shine
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.02, s * 0.6, s * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    // tail
    ctx.save();
    ctx.translate(-s * 0.65, 0); ctx.rotate(tailWag);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.2, -s * 0.2);
    ctx.lineTo(-s * 0.15, 0);
    ctx.lineTo(-s * 0.2, s * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // dorsal fin
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.1);
    ctx.lineTo(-s * 0.05, -s * 0.22);
    ctx.lineTo(-s * 0.1, -s * 0.1);
    ctx.closePath(); ctx.fill();
    // pointed snout with teeth
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(s * 0.6, -s * 0.03);
    ctx.lineTo(s * 0.75, 0);
    ctx.lineTo(s * 0.6, s * 0.03);
    ctx.closePath(); ctx.fill();
    // teeth
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.5;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * 0.62 + i * 3, s * 0.02);
      ctx.lineTo(s * 0.63 + i * 3, s * 0.04);
      ctx.stroke();
    }
    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(s * 0.5, -s * 0.04, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(s * 0.51, -s * 0.04, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  function drawTuna(s, col, dark, light, tailWag) {
    var bodyGrad = ctx.createLinearGradient(0, -s * 0.2, 0, s * 0.2);
    bodyGrad.addColorStop(0, light);
    bodyGrad.addColorStop(0.4, col);
    bodyGrad.addColorStop(0.6, col);
    bodyGrad.addColorStop(1, dark);
    ctx.fillStyle = bodyGrad;
    // sleek powerful body
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.65, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    // yellow side stripe
    ctx.fillStyle = "rgba(255,200,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, s * 0.05, s * 0.5, s * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    // tail — crescent
    ctx.save();
    ctx.translate(-s * 0.6, 0); ctx.rotate(tailWag);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.15, -s * 0.3, -s * 0.3, -s * 0.25);
    ctx.quadraticCurveTo(-s * 0.1, 0, -s * 0.3, s * 0.25);
    ctx.quadraticCurveTo(-s * 0.15, s * 0.3, 0, 0);
    ctx.fill();
    ctx.restore();
    // small dorsal fins
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(s * 0.15, -s * 0.2);
    ctx.lineTo(s * 0.05, -s * 0.3);
    ctx.lineTo(-s * 0.05, -s * 0.2);
    ctx.closePath(); ctx.fill();
    // finlets
    ctx.strokeStyle = dark; ctx.lineWidth = 1;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.2 + i * 5, -s * 0.15);
      ctx.lineTo(-s * 0.22 + i * 5, -s * 0.08);
      ctx.stroke();
    }
    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.06, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(s * 0.46, -s * 0.06, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  /* ---------- 14d. DIVER DRAWING (detailed) -------------------------- */
  function drawDiver(x, y, facing, defending, finAnim) {
    ctx.save();
    ctx.translate(x, y);
    if (facing < 0) ctx.scale(-1, 1);

    var finKick = Math.sin(finAnim) * 0.3;

    // shadow
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(0, 20, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // --- tank on back ---
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-14, -12, 8, 22, 3) : ctx.rect(-14, -12, 8, 22);
    ctx.fill();
    ctx.fillStyle = "#3A8";
    ctx.fillRect(-13, -8, 6, 4); // tank valve
    // tank strap
    ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(2, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(2, 6); ctx.stroke();

    // --- body (wetsuit) ---
    var bodyGrad = ctx.createLinearGradient(0, -10, 0, 14);
    bodyGrad.addColorStop(0, "#1B4F8A");
    bodyGrad.addColorStop(0.5, "#1B4F8A");
    bodyGrad.addColorStop(1, "#0E3A66");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 2, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- regulator hose ---
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.quadraticCurveTo(4, -8, 8, -8);
    ctx.stroke();

    // --- head with mask ---
    ctx.fillStyle = "#E8C0A0"; // face
    ctx.beginPath();
    ctx.arc(7, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    // mask
    var maskGrad = ctx.createLinearGradient(4, -14, 12, -6);
    maskGrad.addColorStop(0, "#A0D8F0");
    maskGrad.addColorStop(1, "#5AA0C8");
    ctx.fillStyle = maskGrad;
    ctx.beginPath();
    ctx.ellipse(8, -11, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // mask reflection
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(6, -12, 2, 1.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // mask strap
    ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(3, -11); ctx.lineTo(12, -9); ctx.stroke();

    // --- arms ---
    ctx.fillStyle = "#1B4F8A";
    ctx.beginPath();
    ctx.ellipse(5, 2, 3, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // hand
    ctx.fillStyle = "#E8C0A0";
    ctx.beginPath(); ctx.arc(8, 8, 2.5, 0, Math.PI * 2); ctx.fill();

    // --- fins ---
    ctx.save();
    ctx.translate(-2, 16);
    ctx.rotate(finKick);
    ctx.fillStyle = "#0E3A66";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-6, 10, -2, 14);
    ctx.quadraticCurveTo(2, 10, 4, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(4, 16);
    ctx.rotate(-finKick * 0.7);
    ctx.fillStyle = "#0E3A66";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-4, 10, 0, 14);
    ctx.quadraticCurveTo(4, 10, 6, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // defending ring
    if (defending) {
      ctx.strokeStyle = "#FAC775"; ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(finAnim * 3);
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();
  }

  /* ---------- 14e. BUBBLES ------------------------------------------- */
  function drawBubbles() {
    ctx.save();
    for (var i = 0; i < state.bubbles.length; i++) {
      var b = state.bubbles[i];
      var sy = b.y - cameraY;
      if (sy < -10 || sy > H + 10) continue;
      ctx.globalAlpha = b.life * 0.6;
      // bubble outline
      ctx.strokeStyle = "rgba(200,230,255,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, sy, b.size, 0, Math.PI * 2); ctx.stroke();
      // highlight
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath(); ctx.arc(b.x - b.size * 0.3, sy - b.size * 0.3, b.size * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- 14f. PARTICLES ----------------------------------------- */
  function drawParticles() {
    ctx.save();
    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      var sz = p.size * p.life;
      // glow
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* ---------- 14g. SCORE POPUPS -------------------------------------- */
  function drawScorePopups() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 16px sans-serif";
    for (var i = 0; i < state.scorePopups.length; i++) {
      var sp = state.scorePopups[i];
      ctx.globalAlpha = sp.life;
      ctx.fillStyle = sp.color;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.fillText(sp.text, sp.x, sp.y);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* ---------- 14h. VIGNETTE ------------------------------------------ */
  function drawVignette(depthM) {
    var darkness = clamp(depthM / 50, 0, 0.5);
    if (darkness < 0.05) return;
    ctx.save();
    var grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0," + darkness + ")");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ---------- 14i. COMBO DISPLAY ------------------------------------- */
  function drawCombo() {
    if (state.combo < 2) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 28px sans-serif";
    var alpha = clamp(state.comboTimer / 6, 0, 1);
    ctx.globalAlpha = alpha * (0.7 + 0.3 * Math.sin(state.elapsed * 8));
    ctx.fillStyle = "#FFD700";
    ctx.shadowColor = "#FF8C1A";
    ctx.shadowBlur = 10;
    ctx.fillText("COMBO x" + state.combo + "!", W / 2, 50);
    // combo timer bar
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,215,0,0.4)";
    ctx.fillRect(W / 2 - 60, 56, 120 * (state.comboTimer / 6), 3);
    ctx.restore();
  }

  function drawEdgeMesh(intensity) {
    ctx.save();
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(226,75,74," + (0.5 * intensity) + ")");
    grad.addColorStop(0.15, "rgba(226,75,74,0)");
    grad.addColorStop(0.85, "rgba(226,75,74,0)");
    grad.addColorStop(1, "rgba(226,75,74," + (0.5 * intensity) + ")");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(226,75,74," + (0.35 * intensity) + ")"; ctx.lineWidth = 1;
    for (var i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * H / 6); ctx.lineTo(40, i * H / 6 + 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W, i * H / 6); ctx.lineTo(W - 40, i * H / 6 + 20); ctx.stroke();
    }
    ctx.fillStyle = "rgba(226,75,74," + intensity + ")"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("PRESSURE INCREASING — ASCEND", W / 2, 34); ctx.textAlign = "left";
    ctx.restore();
  }

  function drawRadar() {
    var rx = W - 70, ry = H - 70, R = 52;
    ctx.save();
    // radar background with gradient
    var rGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, R);
    rGrad.addColorStop(0, "rgba(2,15,30,0.7)");
    rGrad.addColorStop(1, "rgba(2,15,30,0.4)");
    ctx.fillStyle = rGrad;
    ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(120,200,160,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(rx, ry, R / 2, 0, Math.PI * 2); ctx.stroke();
    // sweep line
    var sweepAng = state.elapsed * 2;
    ctx.strokeStyle = "rgba(120,200,160,0.2)";
    ctx.beginPath(); ctx.moveTo(rx, ry);
    ctx.lineTo(rx + Math.cos(sweepAng) * R, ry + Math.sin(sweepAng) * R); ctx.stroke();
    for (var i = 0; i < state.creatures.length; i++) {
      var c = state.creatures[i];
      if (c.hiding && c.emergeT < 0.3) continue;
      var dx = (c.x - state.diver.x) / 14, dy = (c.y - state.diver.y) / 14;
      var dd = Math.hypot(dx, dy);
      if (dd > R) continue;
      var dangerous = c.tpl.size >= 50 || (c.tpl.predator && c.tpl.danger >= 2);
      ctx.fillStyle = dangerous ? "#E24B4A" : "rgba(160,220,180,0.8)";
      ctx.beginPath(); ctx.arc(rx + dx, ry + dy, dangerous ? 3.5 : 2, 0, Math.PI * 2); ctx.fill();
    }
    for (var i = 0; i < state.pollution.length; i++) {
      var p = state.pollution[i];
      var dx = (p.x - state.diver.x) / 14, dy = (p.y - state.diver.y) / 14;
      var dd = Math.hypot(dx, dy);
      if (dd > R) continue;
      ctx.fillStyle = "rgba(200,180,80,0.6)";
      ctx.beginPath(); ctx.arc(rx + dx, ry + dy, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#FAC775"; ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("RADAR", rx, ry + R + 12); ctx.textAlign = "left";
    ctx.restore();
  }

  function drawToasts() {
    ctx.save(); ctx.textAlign = "center"; ctx.font = "12px sans-serif";
    var y = 70;
    for (var i = 0; i < state.toasts.length; i++) {
      var t = state.toasts[i];
      var a = clamp(t.t / 4, 0, 1);
      ctx.globalAlpha = a;
      var w = ctx.measureText(t.text).width + 20;
      ctx.fillStyle = "rgba(2,15,30,0.85)"; roundRect(W / 2 - w / 2, y - 14, w, 22, 6); ctx.fill();
      ctx.fillStyle = t.color; ctx.fillText(t.text, W / 2, y);
      y += 28;
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function updateHUD(depthM) {
    document.getElementById("hud-oxygen").style.width = state.oxygen + "%";
    document.getElementById("hud-equip").style.width = state.equipment + "%";
    document.getElementById("hud-health").style.width = state.health + "%";
    document.getElementById("hud-eco").style.width = state.ecoHealth + "%";
    var ecoEl = document.getElementById("hud-eco");
    if (state.ecoHealth > 60) ecoEl.style.background = "#1D9E75";
    else if (state.ecoHealth > 30) ecoEl.style.background = "#E0C44A";
    else ecoEl.style.background = "#E24B4A";

    document.getElementById("hud-depth").textContent = depthM + " m";
    document.getElementById("hud-pressure").textContent = (1 + depthM / 10).toFixed(1) + " atm";
    document.getElementById("hud-catalog").textContent = state.discovered + " / " + state.challenge.target;
    document.getElementById("hud-eco-readout").textContent = Math.round(state.ecoHealth) + "%";
    document.getElementById("hud-cleaned").textContent = state.cleaned;
    var status = document.getElementById("hud-status");
    status.textContent = state.safe ? "SAFE" : "DANGER";
    status.style.color = state.safe ? "#3B6D11" : "#A32D2D";
  }

  function toast(text, color) {
    state.toasts.push({ text: text, color: color || "#fff", t: 4 });
    if (state.toasts.length > 4) state.toasts.shift();
  }

  /* ---------- 15. COLOR HELPERS -------------------------------------- */
  function mix(a, b, t) {
    var pa = hex(a), pb = hex(b);
    return "rgb(" + Math.round(pa[0] + (pb[0] - pa[0]) * t) + "," +
                    Math.round(pa[1] + (pb[1] - pa[1]) * t) + "," +
                    Math.round(pa[2] + (pb[2] - pa[2]) * t) + ")";
  }
  function mixColor(a, b, t) { return mix(a, b, t); }
  function mixWater(shallow, deep, depthRatio, murk) {
    var base = mix(shallow, deep, depthRatio);
    if (murk > 0) {
      var pa = base.match(/\d+/g);
      var r = parseInt(pa[0]), g = parseInt(pa[1]), b = parseInt(pa[2]);
      r = Math.round(r + (140 - r) * murk * 0.4);
      g = Math.round(g + (120 - g) * murk * 0.4);
      b = Math.round(b + (90 - b) * murk * 0.4);
      return "rgb(" + r + "," + g + "," + b + ")";
    }
    return base;
  }
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

  /* ---------- 16. GAME LOOP ------------------------------------------ */
  function loop(ts) {
    if (!running) return;
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    if (!paused && !state.over) update(dt);
    render();
    requestAnimationFrame(loop);
  }

  /* ---------- 17. SCREENS / FLOW ------------------------------------- */
  function startChallenge(id) {
    var ch = CHALLENGES.find(function (c) { return c.id === id; });
    state = freshState(ch);
    state.corals = generateCorals(ch);
    initPlankton();
    initOcean(ch);
    for (var i = 0; i < 6; i++) spawnCreature();
    if (ch.id === "stress") {
      for (var j = 0; j < 5; j++) spawnPollution();
    }
    cameraY = 0; paused = false;
    document.getElementById("menu-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    document.getElementById("end-screen").classList.add("hidden");
    document.getElementById("pause-overlay").classList.add("hidden");
    running = true; lastTs = 0;
    toast("Swim near coral to discover creatures. Click or press Space to scan!", "#378ADD");
    requestAnimationFrame(loop);
  }

  function endGame(win, reason) {
    state.over = true; state.win = win;
    if (win) {
      sWin();
      // celebration particles
      for (var i = 0; i < 30; i++) {
        spawnSparkle(rand(0, W), rand(0, H / 2), ["#FFD700", "#1D9E75", "#378ADD"][i % 3], 5);
      }
    } else { sFail(); }
    var box = document.getElementById("end-screen");
    document.getElementById("end-title").textContent = win ? "Dive Complete!" : "Dive Failed";
    document.getElementById("end-title").style.color = win ? "#3B6D11" : "#A32D2D";
    var msg = win
      ? "You cataloged " + state.discovered + " species and kept reef health at " + Math.round(state.ecoHealth) + "%. The ocean is beautiful when you understand it."
      : (reason || "Your dive ended.") + " Review your feedback and try again — every attempt teaches more.";
    if (state.startledPenalty > 0) msg += " (You startled harmless creatures " + state.startledPenalty + " time(s) — observe before reacting.)";
    document.getElementById("end-msg").textContent = msg;
    document.getElementById("end-stats").textContent =
      "Species: " + state.discovered + " / " + state.challenge.target +
      "   |   Eco-Health: " + Math.round(state.ecoHealth) + "% (target " + state.challenge.ecoTarget + "%)" +
      "   |   Pollution cleaned: " + state.cleaned +
      "   |   Rewards: " + state.rewards +
      "   |   Time: " + Math.round(state.elapsed) + "s";
    box.classList.remove("hidden");
  }

  function backToMenu() {
    running = false;
    document.getElementById("game-screen").classList.add("hidden");
    document.getElementById("end-screen").classList.add("hidden");
    document.getElementById("menu-screen").classList.remove("hidden");
  }

  window.SB = { startChallenge: startChallenge, backToMenu: backToMenu, togglePause: togglePause };

  /* ---------- 18. MENU BUILD ----------------------------------------- */
  (function buildMenu() {
    var wrap = document.getElementById("challenge-cards");
    CHALLENGES.forEach(function (ch) {
      var card = document.createElement("button");
      card.className = "ch-card";
      card.innerHTML =
        "<span class='ch-tag'>" + ch.tag + "</span>" +
        "<span class='ch-name'>" + ch.name + "</span>" +
        "<span class='ch-desc'>" + ch.desc + "</span>" +
        "<span class='ch-meta'>discover " + ch.target + " species · eco-health " + ch.ecoTarget + "% · equip limit " + ch.maxEquipmentDepth + " m</span>";
      card.onclick = function () { startChallenge(ch.id); };
      wrap.appendChild(card);
    });
  })();
})();
