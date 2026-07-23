// ============================================
// BIKE RIDER 3D - A Cycling Safety Game
// ============================================
// Track A: No build step - Three.js + HTML/CSS
// Student: Cici chen | Domain: cycling, riding a bike
// Core Learning Shift: Rushing causes falls;
//   experts control speed and direction to avoid danger.
// ============================================

(function () {
'use strict';

// ============================================
// SECTION 1: CONFIGURATION
// ============================================

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;

// 3D world scale
const SEGMENT_LENGTH = 8;       // world units per road segment
const ROAD_HALF_WIDTH = 10;     // world units from center to road edge (wider road)
const CURVE_TO_HEADING = 0.045; // curve value to radians
const SCROLL_FACTOR = 0.65;     // speed-to-world-unit conversion

// Speed
const MIN_SPEED = 8;
const MIN_SPEED_TIME = 5;
const PEDAL_ACCEL = 55;
const BRAKE_DECEL = 110;
const NATURAL_DECEL = 12;

// Stability
const STABILITY_MAX = 100;
const STABILITY_RECOVERY = 16;
const STABILITY_RECOVERY_GENERAL = 8;
const STABILITY_LOSS_CURVE = 24;
const STABILITY_LOSS_TERRAIN = 4;
const STABILITY_LOSS_OFFROAD = 20;
const STABILITY_LOSS_SLICK = 10;

// Health (blood/HP)
const HEALTH_MAX = 100;
const HEALTH_COIN_GAIN = 15;       // health gained per coin
const HEALTH_OBSTACLE_LOSS = 12;   // health lost per non-crash obstacle hit
const HEALTH_LOW_STAB_DRAIN = 5;   // health drained per second when stability < 20
const HEALTH_LOW_STAB_THRESHOLD = 20;

// Obstacle types with 3D-aware properties
const OBSTACLE_EFFECTS = {
  rock:    { crash: true,  stabilityLoss: 0,   label: 'Rock',    radius: 1.8 },
  tree:    { crash: true,  stabilityLoss: 0,   label: 'Fallen Tree', radius: 2.0 },
  branch:  { crash: false, stabilityLoss: 30,  label: 'Branch',  radius: 1.4 },
  stick:   { crash: false, stabilityLoss: 10,  label: 'Stick',   radius: 1.0 },
  cone:    { crash: false, stabilityLoss: 20,  label: 'Cone',    radius: 1.1, speedPenalty: 25 },
  puddle:  { crash: false, stabilityLoss: 0,   label: 'Puddle',  radius: 1.9, slippery: true },
  barrier: { crash: true,  stabilityLoss: 0,   label: 'Barrier', radius: 2.0 },
  pothole: { crash: false, stabilityLoss: 15,  label: 'Pothole', radius: 1.0, shake: 8 },
};
const BIKE_RADIUS = 0.6;

// Terrain
const TERRAIN_GRIP = {
  pavement: 1.0,
  gravel: 0.72,
  slippery: 0.48,
  rough: 0.82,
};
var TERRAIN_COLORS = {
  pavement: 0x4a4a4a,
  gravel:   0x8b7355,
  slippery: 0x5a7a8a,
  rough:    0x6b5e4a,
};
var TERRAIN_LABELS = {
  pavement: 'Pavement',
  gravel:   'Gravel',
  slippery: 'Slippery',
  rough:    'Rough',
};
var SKY_COLORS = [0x87CEEB, 0xB0C4DE, 0xA9A9A9, 0x708090];

// Level definitions
const LEVELS = [
  {
    name: 'Park Path',
    description: 'Flat pavement, gentle curves, a few sticks.',
    terrains: ['pavement'],
    obstacleTypes: ['stick', 'cone', 'rock'],
    curveIntensity: 0.25,
    curveProbability: 0.35,
    obstacleDensity: 0.022,
    distance: 6000,
    timeLimit: 120,
    maxSpeed: 180,
    hilly: false,
    sceneryDensity: 0.5,
    coinDensity: 0.06,
  },
  {
    name: 'Mixed Trail',
    description: 'Pavement meets gravel. Rocks and branches.',
    terrains: ['pavement', 'gravel'],
    obstacleTypes: ['rock', 'tree', 'branch', 'stick', 'cone'],
    curveIntensity: 0.45,
    curveProbability: 0.45,
    obstacleDensity: 0.035,
    distance: 8000,
    timeLimit: 150,
    maxSpeed: 200,
    hilly: false,
    sceneryDensity: 0.35,
    coinDensity: 0.05,
  },
  {
    name: 'Hilly Gravel',
    description: 'Sharp turns on gravel hills. Control descent speed.',
    terrains: ['gravel', 'rough', 'pavement'],
    obstacleTypes: ['rock', 'tree', 'branch', 'cone', 'pothole'],
    curveIntensity: 0.65,
    curveProbability: 0.55,
    obstacleDensity: 0.04,
    distance: 10000,
    timeLimit: 180,
    maxSpeed: 210,
    hilly: true,
    sceneryDensity: 0.25,
    coinDensity: 0.045,
  },
  {
    name: 'Mountain Pass',
    description: 'Slippery sections, dense obstacles, tight curves.',
    terrains: ['rough', 'slippery', 'gravel'],
    obstacleTypes: ['rock', 'tree', 'branch', 'barrier', 'pothole', 'puddle'],
    curveIntensity: 0.85,
    curveProbability: 0.65,
    obstacleDensity: 0.055,
    distance: 12000,
    timeLimit: 210,
    maxSpeed: 220,
    hilly: true,
    sceneryDensity: 0.15,
    coinDensity: 0.04,
  },
];

// ============================================
// SECTION 2: GAME STATE
// ============================================

var canvas, ctx2d;
var scene, camera, renderer;
var bikePivot, bikeLeanGroup, wheelFront, wheelRear;
var dirLight;
var roadMeshGroup, obstacleGroup, sceneryGroup, coinGroup;
var skyMesh;
var puddleTimer = 0; // slippery effect timer
var slipperyActive = false;

var gameState = 'menu';
var currentLevel = 0;
var lastTime = 0;
var deltaTime = 0;

var roadData = [];
var totalSegments = 0;

var player = {
  z: 0,
  worldX: 0,
  speed: 0,
  stability: STABILITY_MAX,
  health: HEALTH_MAX,
  coinsCollected: 0,
  lean: 0,
  targetLean: 0,
  prevZ: 0,
  lowSpeedTimer: 0,
  steerInput: 0,
};

var timeRemaining = 0;
var elapsedTime = 0;
var shakeAmount = 0;
var skidMarks = [];
var dustParticles = [];
var crashReason = '';
var crashTip = '';
var obstacleWarning = null;

var keys = {};
var GAME_KEYS = ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyP','Escape','Digit1','Digit2','Digit3','Digit4','KeyR'];

// Shared geometries & materials
var GEO = {};
var MAT = {};

// ============================================
// SECTION 3: AUDIO SYSTEM
// ============================================

var Audio = {
  ctx: null,
  enabled: false,
  windSource: null,
  windGain: null,

  init: function() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
    } catch (e) {
      this.enabled = false;
    }
  },

  resume: function() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  startWind: function() {
    if (!this.enabled || this.windSource) return;
    var bufSize = this.ctx.sampleRate * 2;
    var buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    var filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    this.windSource.start();
  },

  updateWind: function(speed, maxSpeed) {
    if (!this.enabled || !this.windGain) return;
    var vol = Math.min(0.12, (speed / maxSpeed) * 0.12);
    this.windGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
  },

  stopWind: function() {
    if (this.windSource) {
      try { this.windSource.stop(); } catch (e) {}
      this.windSource = null;
      this.windGain = null;
    }
  },

  playCrash: function() {
    if (!this.enabled) return;
    var t = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + 0.5);
  },

  playBump: function() {
    if (!this.enabled) return;
    var t = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + 0.12);
  },

  playCoin: function() {
    if (!this.enabled) return;
    var t = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + 0.15);
  },

  playWin: function() {
    if (!this.enabled) return;
    var t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach(function(freq, i) {
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.3);
    }, this);
  },
};

// ============================================
// SECTION 4: RESOURCE CREATION (Geometries & Materials)
// ============================================

function createSharedResources() {
  // Obstacle geometries — enlarged for visibility
  GEO.rock = new THREE.DodecahedronGeometry(1.6, 0);
  GEO.branchA = new THREE.CylinderGeometry(0.14, 0.14, 3.2, 6);
  GEO.branchB = new THREE.CylinderGeometry(0.11, 0.11, 2.0, 5);
  GEO.stick = new THREE.CylinderGeometry(0.07, 0.07, 1.8, 4);
  GEO.cone = new THREE.ConeGeometry(0.65, 1.4, 8);
  GEO.coneBase = new THREE.CylinderGeometry(0.75, 0.75, 0.1, 8);
  GEO.puddle = new THREE.CircleGeometry(1.8, 16);
  GEO.barrier = new THREE.BoxGeometry(4, 1.2, 0.3);
  GEO.pothole = new THREE.CircleGeometry(0.9, 12);

  // Bike geometries — thicker for more 3D presence
  GEO.wheel = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 20);
  GEO.wheelRim = new THREE.TorusGeometry(0.42, 0.04, 6, 16);
  GEO.frameTube = new THREE.CylinderGeometry(0.09, 0.09, 1.2, 8);
  GEO.seat = new THREE.BoxGeometry(0.4, 0.1, 0.2);
  GEO.handlebar = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6);
  GEO.head = new THREE.SphereGeometry(0.25, 16, 12);
  GEO.body = new THREE.BoxGeometry(0.45, 0.6, 0.28);
  GEO.arm = new THREE.CylinderGeometry(0.07, 0.06, 0.5, 6);
  GEO.leg = new THREE.CylinderGeometry(0.08, 0.06, 0.55, 6);
  GEO.pedal = new THREE.BoxGeometry(0.15, 0.04, 0.25);

  // Scenery geometries
  GEO.treeTrunk = new THREE.CylinderGeometry(0.15, 0.22, 1.8, 6);
  GEO.treeFoliage = new THREE.ConeGeometry(1.1, 2.5, 6);
  GEO.bush = new THREE.SphereGeometry(0.5, 8, 6);
  GEO.roadside = new THREE.DodecahedronGeometry(0.6, 0);

  // Coin geometry (flat cylinder like a gold coin)
  GEO.coin = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16);

  // Materials
  MAT.rock = new THREE.MeshLambertMaterial({ color: 0x666666 });
  MAT.rockDark = new THREE.MeshLambertMaterial({ color: 0x555555 });
  MAT.branch = new THREE.MeshLambertMaterial({ color: 0x5C3317 });
  MAT.stick = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  MAT.cone = new THREE.MeshLambertMaterial({ color: 0xFF6600 });
  MAT.coneBase = new THREE.MeshLambertMaterial({ color: 0xCC4400 });
  MAT.puddle = new THREE.MeshLambertMaterial({ color: 0x3366AA, transparent: true, opacity: 0.65 });
  MAT.barrier = new THREE.MeshLambertMaterial({ color: 0xCC2222 });
  MAT.barrierStripe = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  MAT.pothole = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  MAT.wheel = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 30 });
  MAT.wheelRim = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 80 });
  MAT.frame = new THREE.MeshPhongMaterial({ color: 0xe74c3c, shininess: 60 });
  MAT.seat = new THREE.MeshPhongMaterial({ color: 0x2c2c2c, shininess: 20 });
  MAT.handlebar = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 50 });
  MAT.head = new THREE.MeshPhongMaterial({ color: 0xf4c20d, shininess: 40 });
  MAT.body = new THREE.MeshPhongMaterial({ color: 0x2980b9, shininess: 40 });
  MAT.arm = new THREE.MeshPhongMaterial({ color: 0x2980b9, shininess: 40 });
  MAT.leg = new THREE.MeshPhongMaterial({ color: 0x1a1a2e, shininess: 20 });

  MAT.treeTrunk = new THREE.MeshLambertMaterial({ color: 0x4A2F1A });
  MAT.treeFoliage = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });
  MAT.bush = new THREE.MeshLambertMaterial({ color: 0x3a7a3a });
  MAT.roadside = new THREE.MeshLambertMaterial({ color: 0x7a7a7a });
  MAT.grass = new THREE.MeshLambertMaterial({ color: 0x2d5a2d });

  // Coin material - shiny gold
  MAT.coin = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0x886600, emissiveIntensity: 0.4 });
}

// ============================================
// SECTION 5: BIKE MODEL
// ============================================

function createBike() {
  bikePivot = new THREE.Group();      // position + heading
  bikeLeanGroup = new THREE.Group();  // lean + steer tilt
  bikePivot.add(bikeLeanGroup);

  // Wheels — front at +Z (forward), rear at -Z. Bigger & with rims.
  wheelFront = new THREE.Mesh(GEO.wheel, MAT.wheel);
  wheelFront.rotation.z = Math.PI / 2;
  wheelFront.position.set(0, 0.55, 0.8);
  bikeLeanGroup.add(wheelFront);
  var rimF = new THREE.Mesh(GEO.wheelRim, MAT.wheelRim);
  rimF.rotation.y = Math.PI / 2;
  rimF.position.copy(wheelFront.position);
  bikeLeanGroup.add(rimF);

  wheelRear = new THREE.Mesh(GEO.wheel, MAT.wheel);
  wheelRear.rotation.z = Math.PI / 2;
  wheelRear.position.set(0, 0.55, -0.8);
  bikeLeanGroup.add(wheelRear);
  var rimR = new THREE.Mesh(GEO.wheelRim, MAT.wheelRim);
  rimR.rotation.y = Math.PI / 2;
  rimR.position.copy(wheelRear.position);
  bikeLeanGroup.add(rimR);

  // Frame - top tube (thicker now)
  var topTube = new THREE.Mesh(GEO.frameTube, MAT.frame);
  topTube.rotation.x = Math.PI / 2;
  topTube.position.set(0, 0.9, 0);
  bikeLeanGroup.add(topTube);

  // Frame - down tube (diagonal)
  var downTube = new THREE.Mesh(GEO.frameTube, MAT.frame);
  downTube.rotation.x = Math.PI / 2;
  downTube.rotation.z = 0.5;
  downTube.scale.set(1, 1.1, 1);
  downTube.position.set(0, 0.65, 0);
  bikeLeanGroup.add(downTube);

  // Seat post (rear)
  var seatPost = new THREE.Mesh(GEO.frameTube, MAT.frame);
  seatPost.scale.set(0.7, 0.6, 0.7);
  seatPost.position.set(0, 1.1, -0.55);
  bikeLeanGroup.add(seatPost);

  // Seat (rear)
  var seat = new THREE.Mesh(GEO.seat, MAT.seat);
  seat.position.set(0, 1.2, -0.6);
  bikeLeanGroup.add(seat);

  // Handlebar post (front)
  var hbPost = new THREE.Mesh(GEO.frameTube, MAT.handlebar);
  hbPost.scale.set(0.6, 0.5, 0.6);
  hbPost.position.set(0, 1.05, 0.55);
  bikeLeanGroup.add(hbPost);

  // Handlebar (front)
  var hb = new THREE.Mesh(GEO.handlebar, MAT.handlebar);
  hb.rotation.z = Math.PI / 2;
  hb.position.set(0, 1.2, 0.6);
  bikeLeanGroup.add(hb);

  // Pedals (at bottom center)
  var pedalL = new THREE.Mesh(GEO.pedal, MAT.handlebar);
  pedalL.position.set(-0.2, 0.3, 0);
  bikeLeanGroup.add(pedalL);
  var pedalR = new THREE.Mesh(GEO.pedal, MAT.handlebar);
  pedalR.position.set(0.2, 0.3, 0);
  bikeLeanGroup.add(pedalR);

  // Rider body (leaning forward, bigger)
  var body = new THREE.Mesh(GEO.body, MAT.body);
  body.position.set(0, 1.55, -0.35);
  bikeLeanGroup.add(body);

  // Rider head (helmet, bigger)
  var head = new THREE.Mesh(GEO.head, MAT.head);
  head.position.set(0, 2.0, -0.3);
  bikeLeanGroup.add(head);

  // Rider arms (reaching forward to handlebar, thicker)
  var armL = new THREE.Mesh(GEO.arm, MAT.arm);
  armL.position.set(-0.22, 1.6, 0.15);
  armL.rotation.x = 1.2;
  bikeLeanGroup.add(armL);

  var armR = new THREE.Mesh(GEO.arm, MAT.arm);
  armR.position.set(0.22, 1.6, 0.15);
  armR.rotation.x = 1.2;
  bikeLeanGroup.add(armR);

  // Rider legs (pedaling position)
  var legL = new THREE.Mesh(GEO.leg, MAT.leg);
  legL.position.set(-0.16, 0.95, -0.15);
  legL.rotation.x = 0.8;
  bikeLeanGroup.add(legL);

  var legR = new THREE.Mesh(GEO.leg, MAT.leg);
  legR.position.set(0.16, 0.95, -0.15);
  legR.rotation.x = 0.8;
  bikeLeanGroup.add(legR);

  scene.add(bikePivot);
}

// ============================================
// SECTION 6: OBSTACLE CREATION
// ============================================

function createObstacleMesh(type) {
  var group = new THREE.Group();

  if (type === 'rock') {
    var rock = new THREE.Mesh(GEO.rock, MAT.rock);
    rock.position.y = 1.2;
    group.add(rock);
    // small dark patch
    var dark = new THREE.Mesh(GEO.rock, MAT.rockDark);
    dark.scale.set(0.6, 0.6, 0.6);
    dark.position.set(0.4, 0.7, 0.3);
    group.add(dark);
  } else if (type === 'tree') {
    // Fallen tree trunk lying across the road
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.7, 5.5, 8),
      MAT.treeTrunk
    );
    trunk.rotation.z = Math.PI / 2; // lay horizontal
    trunk.position.y = 0.7;
    group.add(trunk);
    // stump end
    var stump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 0.5, 8),
      MAT.treeTrunk
    );
    stump.position.set(-2.8, 0.65, 0);
    group.add(stump);
    // broken branches
    var br1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 1.8, 5),
      MAT.treeTrunk
    );
    br1.position.set(1.0, 0.8, 0.4);
    br1.rotation.set(0, 0, Math.PI / 3);
    group.add(br1);
    var br2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 1.5, 5),
      MAT.treeTrunk
    );
    br2.position.set(-0.6, 0.8, -0.4);
    br2.rotation.set(0, 0, -Math.PI / 4);
    group.add(br2);
  } else if (type === 'branch') {
    var b1 = new THREE.Mesh(GEO.branchA, MAT.branch);
    b1.position.y = 0.4;
    b1.rotation.z = 0.5;
    group.add(b1);
    var b2 = new THREE.Mesh(GEO.branchB, MAT.branch);
    b2.position.y = 0.5;
    b2.position.x = 0.5;
    b2.rotation.z = -0.8;
    group.add(b2);
  } else if (type === 'stick') {
    var stick = new THREE.Mesh(GEO.stick, MAT.stick);
    stick.position.y = 0.2;
    stick.rotation.z = 0.3;
    group.add(stick);
  } else if (type === 'cone') {
    var base = new THREE.Mesh(GEO.coneBase, MAT.coneBase);
    base.position.y = 0.05;
    group.add(base);
    var cone = new THREE.Mesh(GEO.cone, MAT.cone);
    cone.position.y = 0.8;
    group.add(cone);
    // white stripe
    var stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.55, 0.12, 8),
      MAT.barrierStripe
    );
    stripe.position.y = 0.65;
    group.add(stripe);
  } else if (type === 'puddle') {
    var puddle = new THREE.Mesh(GEO.puddle, MAT.puddle);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.y = 0.02;
    group.add(puddle);
  } else if (type === 'barrier') {
    var post1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.3, 0.2),
      MAT.barrier
    );
    post1.position.set(-1.9, 0.65, 0);
    group.add(post1);
    var post2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.3, 0.2),
      MAT.barrier
    );
    post2.position.set(1.9, 0.65, 0);
    group.add(post2);
    // striped bar
    for (var i = 0; i < 8; i++) {
      var seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.35, 0.15),
        i % 2 === 0 ? MAT.barrier : MAT.barrierStripe
      );
      seg.position.set(-1.75 + i * 0.5, 0.9, 0);
      group.add(seg);
    }
  } else if (type === 'pothole') {
    var hole = new THREE.Mesh(GEO.pothole, MAT.pothole);
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.01;
    group.add(hole);
    // debris ring
    var debris = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 12),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    debris.rotation.x = -Math.PI / 2;
    debris.position.y = 0.02;
    group.add(debris);
  }

  return group;
}

// ============================================
// SECTION 7: ROAD GENERATION
// ============================================

function generateRoad(config) {
  var road = [];
  totalSegments = Math.ceil(config.distance / SEGMENT_LENGTH);
  var safeZone = 25;

  var heading = 0;
  var cx = 0;
  var cz = 0;

  var i = 0;
  while (i < totalSegments) {
    var chunkLength = 12 + Math.floor(Math.random() * 18);
    var isCurve = i > safeZone && Math.random() < config.curveProbability;
    var terrain = config.terrains[Math.floor(Math.random() * config.terrains.length)];
    var curveDir = Math.random() < 0.5 ? -1 : 1;
    var curvePeak = config.curveIntensity * (0.5 + Math.random() * 0.5);

    var consecutiveObstacles = 0;

    for (var j = 0; j < chunkLength && i < totalSegments; j++, i++) {
      var seg = {
        terrain: terrain,
        curve: 0,
        obstacles: [],
        coins: [],
        slope: 0,
        centerX: cx,
        centerZ: cz,
        heading: heading,
        y: 0,
      };

      if (i > safeZone) {
        if (isCurve) {
          var progress = j / chunkLength;
          seg.curve = curveDir * curvePeak * Math.sin(progress * Math.PI);
        }
        if (Math.random() < config.obstacleDensity && consecutiveObstacles < 2) {
          var type = config.obstacleTypes[Math.floor(Math.random() * config.obstacleTypes.length)];
          var obsX = (Math.random() - 0.5) * (ROAD_HALF_WIDTH * 0.75);
          seg.obstacles.push({ type: type, x: obsX, hit: false, mesh: null });
          consecutiveObstacles++;
        } else {
          consecutiveObstacles = 0;
        }
      }

      // Coins: place independently, sometimes in lines
      if (i > 5 && Math.random() < (config.coinDensity || 0.05)) {
        var coinX = (Math.random() - 0.5) * (ROAD_HALF_WIDTH * 0.7);
        seg.coins.push({ x: coinX, collected: false, mesh: null });
      }

      if (config.hilly && i > safeZone) {
        seg.slope = Math.sin(i * 0.04) * 0.35 + Math.sin(i * 0.013) * 0.2;
        seg.y = seg.slope * 6;
      }

      // Compute road edges
      var perpX = Math.cos(heading);
      var perpZ = -Math.sin(heading);
      seg.leftX = cx - perpX * ROAD_HALF_WIDTH;
      seg.rightX = cx + perpX * ROAD_HALF_WIDTH;
      seg.leftZ = cz - perpZ * ROAD_HALF_WIDTH;
      seg.rightZ = cz + perpZ * ROAD_HALF_WIDTH;

      road.push(seg);

      // Advance for next segment
      heading += seg.curve * CURVE_TO_HEADING;
      cx += Math.sin(heading) * SEGMENT_LENGTH;
      cz += Math.cos(heading) * SEGMENT_LENGTH;
    }
  }

  return road;
}

// ============================================
// SECTION 8: 3D WORLD BUILDING
// ============================================

function buildRoadMesh() {
  // Remove old road
  if (roadMeshGroup) {
    scene.remove(roadMeshGroup);
    disposeGroup(roadMeshGroup);
  }
  roadMeshGroup = new THREE.Group();

  // Build road surface geometry
  var positions = [];
  var colors = [];
  var indices = [];

  for (var i = 0; i < roadData.length; i++) {
    var seg = roadData[i];
    var y = seg.y;

    // Left and right edge vertices
    positions.push(seg.leftX, y, seg.leftZ);
    positions.push(seg.rightX, y, seg.rightZ);

    // Color from terrain
    var c = new THREE.Color(TERRAIN_COLORS[seg.terrain]);
    colors.push(c.r, c.g, c.b);
    colors.push(c.r, c.g, c.b);

    if (i > 0) {
      var v = i * 2;
      indices.push(v - 2, v, v - 1);
      indices.push(v, v + 1, v - 1);
    }
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var roadSurface = new THREE.Mesh(geo, mat);
  roadMeshGroup.add(roadSurface);

  // Edge lines (white)
  var leftLinePos = [], rightLinePos = [];
  for (var i2 = 0; i2 < roadData.length; i2++) {
    var s = roadData[i2];
    leftLinePos.push(s.leftX + Math.cos(s.heading) * 0.3, s.y + 0.03, s.leftZ - Math.sin(s.heading) * 0.3);
    rightLinePos.push(s.rightX - Math.cos(s.heading) * 0.3, s.y + 0.03, s.rightZ + Math.sin(s.heading) * 0.3);
  }
  var lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  var leftLineGeo = new THREE.BufferGeometry();
  leftLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(leftLinePos, 3));
  roadMeshGroup.add(new THREE.Line(leftLineGeo, lineMat));

  var rightLineGeo = new THREE.BufferGeometry();
  rightLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightLinePos, 3));
  roadMeshGroup.add(new THREE.Line(rightLineGeo, lineMat));

  // Center dashes (yellow)
  var dashMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
  for (var i3 = 4; i3 < roadData.length; i3 += 6) {
    var seg3 = roadData[i3];
    var dashGeo = new THREE.BoxGeometry(0.2, 0.02, SEGMENT_LENGTH * 2);
    var dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(seg3.centerX, seg3.y + 0.03, seg3.centerZ);
    dash.rotation.y = seg3.heading;
    roadMeshGroup.add(dash);
  }

  scene.add(roadMeshGroup);

  // Ground plane (only create once)
  if (!scene.userData.ground) {
    var groundGeo = new THREE.PlaneGeometry(2000, 2000);
    var ground = new THREE.Mesh(groundGeo, MAT.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);
    scene.userData.ground = ground;
  }
}

function placeObstacles() {
  if (obstacleGroup) {
    scene.remove(obstacleGroup);
    disposeGroup(obstacleGroup);
  }
  obstacleGroup = new THREE.Group();

  for (var i = 0; i < roadData.length; i++) {
    var seg = roadData[i];
    for (var j = 0; j < seg.obstacles.length; j++) {
      var obs = seg.obstacles[j];
      var perpX = Math.cos(seg.heading);
      var perpZ = -Math.sin(seg.heading);
      var wx = seg.centerX + perpX * obs.x;
      var wz = seg.centerZ + perpZ * obs.x;

      var mesh = createObstacleMesh(obs.type);
      mesh.position.set(wx, seg.y, wz);
      mesh.rotation.y = seg.heading;
      obs.mesh = mesh;
      obs.worldX = wx;
      obs.worldZ = wz;
      obstacleGroup.add(mesh);
    }
  }

  scene.add(obstacleGroup);
}

function placeCoins() {
  if (coinGroup) {
    scene.remove(coinGroup);
    disposeGroup(coinGroup);
  }
  coinGroup = new THREE.Group();

  for (var i = 0; i < roadData.length; i++) {
    var seg = roadData[i];
    for (var j = 0; j < seg.coins.length; j++) {
      var coin = seg.coins[j];
      var perpX = Math.cos(seg.heading);
      var perpZ = -Math.sin(seg.heading);
      var wx = seg.centerX + perpX * coin.x;
      var wz = seg.centerZ + perpZ * coin.x;

      var mesh = new THREE.Group();
      var coinMesh = new THREE.Mesh(GEO.coin, MAT.coin);
      coinMesh.rotation.x = Math.PI / 2; // stand upright like a wheel
      mesh.add(coinMesh);
      mesh.position.set(wx, seg.y + 1.2, wz);
      coin.mesh = mesh;
      coin.worldX = wx;
      coin.worldZ = wz;
      coinGroup.add(mesh);
    }
  }

  scene.add(coinGroup);
}

function placeScenery(config) {
  if (sceneryGroup) {
    scene.remove(sceneryGroup);
    disposeGroup(sceneryGroup);
  }
  sceneryGroup = new THREE.Group();

  for (var i = 5; i < roadData.length; i += 2) {
    var seg = roadData[i];
    var perpX = Math.cos(seg.heading);
    var perpZ = -Math.sin(seg.heading);

    // Both sides
    for (var side = -1; side <= 1; side += 2) {
      if (Math.random() < config.sceneryDensity) {
        var dist = ROAD_HALF_WIDTH + 2 + Math.random() * 8;
        var sx = seg.centerX + perpX * dist * side;
        var sz = seg.centerZ + perpZ * dist * side;
        var sy = seg.y;

        if (Math.random() < 0.6) {
          // Tree
          var tree = new THREE.Group();
          var trunk = new THREE.Mesh(GEO.treeTrunk, MAT.treeTrunk);
          trunk.position.y = 0.9;
          tree.add(trunk);
          var foliage = new THREE.Mesh(GEO.treeFoliage, MAT.treeFoliage);
          foliage.position.y = 2.8;
          tree.add(foliage);
          // second cone for fuller look
          var foliage2 = new THREE.Mesh(GEO.treeFoliage, MAT.treeFoliage);
          foliage2.position.y = 2.0;
          foliage2.scale.set(1.2, 0.8, 1.2);
          tree.add(foliage2);
          tree.position.set(sx, sy, sz);
          tree.scale.setScalar(0.7 + Math.random() * 0.6);
          tree.rotation.y = Math.random() * Math.PI;
          sceneryGroup.add(tree);
        } else if (Math.random() < 0.5) {
          // Bush
          var bush = new THREE.Mesh(GEO.bush, MAT.bush);
          bush.position.set(sx, sy + 0.3, sz);
          bush.scale.setScalar(0.8 + Math.random() * 0.8);
          sceneryGroup.add(bush);
        } else {
          // Roadside rock
          var rock = new THREE.Mesh(GEO.roadside, MAT.roadside);
          rock.position.set(sx, sy + 0.3, sz);
          rock.scale.setScalar(0.5 + Math.random() * 0.8);
          rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
          sceneryGroup.add(rock);
        }
      }
    }
  }

  scene.add(sceneryGroup);
}

function disposeGroup(group) {
  group.traverse(function(obj) {
    if (obj.geometry && obj.geometry !== GEO.wheel) {
      // Don't dispose shared geometries, only custom ones
    }
  });
  // Just remove all children - shared geo/mat are kept in GEO/MAT
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
}

// ============================================
// SECTION 9: INPUT HANDLING
// ============================================

function setupInput() {
  window.addEventListener('keydown', function(e) {
    keys[e.code] = true;
    if (GAME_KEYS.indexOf(e.code) >= 0) e.preventDefault();

    if (gameState === 'menu') {
      if (e.code === 'Digit1') startLevel(0);
      if (e.code === 'Digit2') startLevel(1);
      if (e.code === 'Digit3') startLevel(2);
      if (e.code === 'Digit4') startLevel(3);
      if (e.code === 'Space' || e.code === 'Enter') startLevel(currentLevel);
    }

    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (gameState === 'playing') { gameState = 'paused'; updateOverlays(); }
      else if (gameState === 'paused') { gameState = 'playing'; updateOverlays(); }
    }

    if (e.code === 'KeyR' && (gameState === 'won' || gameState === 'lost')) {
      startLevel(currentLevel);
    }
    if (e.code === 'Space') {
      if (gameState === 'won') {
        if (currentLevel < LEVELS.length - 1) startLevel(currentLevel + 1);
        else { gameState = 'menu'; updateOverlays(); }
      } else if (gameState === 'lost') {
        startLevel(currentLevel);
      }
    }
  });

  window.addEventListener('keyup', function(e) {
    keys[e.code] = false;
    if (GAME_KEYS.indexOf(e.code) >= 0) e.preventDefault();
  });
}

function readInput() {
  var level = LEVELS[currentLevel];
  if (keys['KeyW'] || keys['ArrowUp']) {
    player.speed += PEDAL_ACCEL * deltaTime;
  }
  if (keys['KeyS'] || keys['ArrowDown']) {
    player.speed -= BRAKE_DECEL * deltaTime;
  }
  if (!keys['KeyW'] && !keys['ArrowUp'] && !keys['KeyS'] && !keys['ArrowDown']) {
    player.speed -= NATURAL_DECEL * deltaTime;
  }

  var steerFactor = 1.1 * (0.3 + 0.7 * Math.min(1, player.speed / level.maxSpeed));
  player.steerInput = 0;
  // NOTE: Three.js right-handed coords — when camera looks toward +Z, world +X appears on screen LEFT.
  // So ArrowRight must DECREASE worldX to move bike screen-RIGHT.
  if (keys['KeyA'] || keys['ArrowLeft']) { player.worldX += steerFactor * deltaTime * 60; player.steerInput = -1; }
  if (keys['KeyD'] || keys['ArrowRight']) { player.worldX -= steerFactor * deltaTime * 60; player.steerInput = 1; }

  player.targetLean = 0;
  // Lean also flipped: Q = lean left on screen, E = lean right on screen
  if (keys['KeyQ']) player.targetLean = 1;
  if (keys['KeyE']) player.targetLean = -1;
  player.lean += (player.targetLean - player.lean) * 5 * deltaTime;
}

// ============================================
// SECTION 10: PHYSICS UPDATE
// ============================================

function update(dt) {
  deltaTime = dt;
  var level = LEVELS[currentLevel];

  readInput();

  player.speed = Math.max(0, Math.min(level.maxSpeed, player.speed));

  player.prevZ = player.z;
  player.z += player.speed * SCROLL_FACTOR * dt;

  elapsedTime += dt;
  timeRemaining = level.timeLimit - elapsedTime;

  var segIndex = Math.floor(player.z / SEGMENT_LENGTH);
  var seg = roadData[segIndex] || roadData[roadData.length - 1];
  var terrain = seg ? seg.terrain : 'pavement';
  var curve = seg ? seg.curve : 0;

  // Slippery override from puddle
  if (puddleTimer > 0) {
    puddleTimer -= dt;
    slipperyActive = true;
  } else {
    slipperyActive = false;
  }
  var effectiveTerrain = slipperyActive ? 'slippery' : terrain;
  var grip = TERRAIN_GRIP[effectiveTerrain] || 1.0;

  // Stability: curve safety
  var safeSpeed = level.maxSpeed * (1 - Math.abs(curve) * 0.55) * grip;
  var leanMatch = player.lean * Math.sign(curve || 1);
  var effectiveSafeSpeed = safeSpeed * (1 + Math.max(0, leanMatch) * 0.15);

  if (player.speed > effectiveSafeSpeed && Math.abs(curve) > 0.05) {
    var overshoot = (player.speed - effectiveSafeSpeed) / level.maxSpeed;
    player.stability -= STABILITY_LOSS_CURVE * overshoot * dt;
    shakeAmount = Math.min(8, shakeAmount + 3 * overshoot * dt * 60);
  } else if (Math.abs(curve) > 0.05 && leanMatch > 0) {
    player.stability += STABILITY_RECOVERY * 0.3 * dt;
  }

  // Terrain effect
  if (effectiveTerrain === 'gravel' || effectiveTerrain === 'rough') {
    player.stability -= STABILITY_LOSS_TERRAIN * dt;
    if (player.speed > level.maxSpeed * 0.7) {
      shakeAmount = Math.min(4, shakeAmount + 1 * dt * 60);
    }
  }
  if (effectiveTerrain === 'slippery' && (player.steerInput !== 0 || Math.abs(curve) > 0.1)) {
    player.stability -= STABILITY_LOSS_SLICK * dt;
  }

  // Off-road
  var playerRelativeX = player.worldX;
  if (Math.abs(playerRelativeX) > ROAD_HALF_WIDTH) {
    player.stability -= STABILITY_LOSS_OFFROAD * dt;
    player.speed *= (1 - 0.4 * dt);
    shakeAmount = Math.min(5, shakeAmount + 1 * dt * 60);
  }

  // Recovery
  var onRoad = Math.abs(playerRelativeX) < ROAD_HALF_WIDTH;
  var speedIsSafe = player.speed <= effectiveSafeSpeed || Math.abs(curve) < 0.05;
  if (onRoad && speedIsSafe) {
    if (effectiveTerrain === 'pavement' && Math.abs(curve) < 0.1) {
      player.stability += STABILITY_RECOVERY * dt;
    } else {
      player.stability += STABILITY_RECOVERY_GENERAL * dt;
    }
  }

  // Low speed
  if (player.speed < MIN_SPEED) {
    player.lowSpeedTimer += dt;
    if (player.lowSpeedTimer > MIN_SPEED_TIME) {
      crashGame('You lost balance!\nThe bike needs forward momentum to stay upright.',
                'Keep pedaling! A bike falls over if it moves too slowly.');
      return;
    }
  } else {
    player.lowSpeedTimer = 0;
  }

  // Wrong lean
  if (Math.abs(curve) > 0.1 && leanMatch < -0.3) {
    player.stability -= 15 * dt;
  }

  player.stability = Math.max(0, Math.min(STABILITY_MAX, player.stability));

  // Collisions
  checkCollisions();
  checkCoinPickup();

  // Low stability drains health
  if (player.stability < HEALTH_LOW_STAB_THRESHOLD) {
    player.health -= HEALTH_LOW_STAB_DRAIN * dt;
  }

  player.health = Math.max(0, Math.min(HEALTH_MAX, player.health));

  // Win/lose
  if (player.health <= 0) {
    crashGame('Your health reached zero!',
              'Collect coins to restore health. Avoid obstacles and maintain stability!');
    return;
  }
  if (player.stability <= 0) {
    crashGame('You lost balance and fell!',
              'Slow down before curves and lean into turns. Watch your stability bar!');
    return;
  }
  if (timeRemaining <= 0) {
    crashGame('Time ran out!',
              'Plan your speed: rush and you crash, but go too slow and time runs out.');
    return;
  }
  if (player.z >= level.distance) {
    winGame();
    return;
  }

  // Shake decay
  shakeAmount *= (1 - 8 * dt);
  if (shakeAmount < 0.1) shakeAmount = 0;

  // Obstacle warning
  obstacleWarning = null;
  for (var ahead = 3; ahead < 20; ahead++) {
    var checkSeg = roadData[segIndex + ahead];
    if (!checkSeg) break;
    for (var oi = 0; oi < checkSeg.obstacles.length; oi++) {
      var obs = checkSeg.obstacles[oi];
      if (obs.hit) continue;
      var xDiff = obs.x - playerRelativeX;
      if (Math.abs(xDiff) < 5) {
        var side = xDiff > 1 ? 'left' : xDiff < -1 ? 'right' : 'center';
        obstacleWarning = { side: side, distance: ahead * SEGMENT_LENGTH };
        break;
      }
    }
    if (obstacleWarning) break;
  }

  updateBike3D(seg, segIndex);
  updateCamera(seg, level, segIndex);
  updateCoins(dt);
  updateHUD();
  Audio.updateWind(player.speed, level.maxSpeed);
}

function updateBike3D(seg, segIndex) {
  if (!bikePivot || !seg) return;

  // Interpolate heading within segment for smooth movement
  var frac = (player.z / SEGMENT_LENGTH) - segIndex;
  frac = Math.max(0, Math.min(1, frac));
  var nextSeg = roadData[segIndex + 1];
  var curH = seg.heading;
  if (nextSeg) {
    curH += (nextSeg.heading - seg.heading) * frac;
  }

  // Compute centerline position following the curve (not linear between centers)
  // Use the interpolated heading to trace the arc
  var dist = frac * SEGMENT_LENGTH;
  var curX = seg.centerX + Math.sin(curH) * dist;
  var curZ = seg.centerZ + Math.cos(curH) * dist;
  var curY = seg.y;
  if (nextSeg) {
    curY += (nextSeg.y - seg.y) * frac;
  }

  var perpX = Math.cos(curH);
  var perpZ = -Math.sin(curH);
  var bikeX = curX + perpX * player.worldX;
  var bikeZ = curZ + perpZ * player.worldX;
  var bikeY = curY;

  bikePivot.position.set(bikeX, bikeY, bikeZ);
  bikePivot.rotation.y = curH;

  // Lean tilt
  if (bikeLeanGroup) {
    bikeLeanGroup.rotation.z = player.lean * 0.25;
    bikeLeanGroup.rotation.x = player.steerInput * 0.04;
  }

  // Wheel spin
  if (wheelFront && wheelRear) {
    var spin = player.speed * 0.03;
    wheelFront.rotation.x += spin;
    wheelRear.rotation.x += spin;
  }
}

function updateCoins(dt) {
  if (!coinGroup) return;
  // Spin all visible coins around Y axis
  coinGroup.children.forEach(function(mesh) {
    if (mesh.visible) {
      mesh.rotation.y += dt * 3;
    }
  });
}

function updateCamera(seg, level, segIndex) {
  if (!seg || !bikePivot) return;

  // Interpolate heading for smooth camera direction
  var frac = (player.z / SEGMENT_LENGTH) - segIndex;
  frac = Math.max(0, Math.min(1, frac));
  var nextSeg = roadData[segIndex + 1];
  var curH = seg.heading;
  if (nextSeg) {
    curH += (nextSeg.heading - seg.heading) * frac;
  }

  var fwdX = Math.sin(curH);
  var fwdZ = Math.cos(curH);

  // Camera position: directly behind and above bike
  var camDist = 13;
  var camHeight = 7;

  camera.position.x = bikePivot.position.x - fwdX * camDist;
  camera.position.y = bikePivot.position.y + camHeight;
  camera.position.z = bikePivot.position.z - fwdZ * camDist;

  // Look DIRECTLY at the bike — guarantees it is dead-center on screen
  camera.lookAt(
    bikePivot.position.x,
    bikePivot.position.y + 1.5,
    bikePivot.position.z
  );

  // FOV adjustment based on speed
  var targetFov = 62 + (player.speed / level.maxSpeed) * 8;
  camera.fov += (targetFov - camera.fov) * 0.1;
  camera.updateProjectionMatrix();

  // Screen shake (minimal)
  if (shakeAmount > 0.1) {
    camera.position.x += (Math.random() - 0.5) * shakeAmount * 0.06;
    camera.position.y += (Math.random() - 0.5) * shakeAmount * 0.04;
  }
}

// ============================================
// SECTION 11: COLLISION DETECTION
// ============================================

function checkCollisions() {
  var startSeg = Math.floor(player.prevZ / SEGMENT_LENGTH);
  var endSeg = Math.floor(player.z / SEGMENT_LENGTH);

  for (var i = startSeg; i <= endSeg; i++) {
    if (i < 0 || i >= roadData.length) continue;
    var seg = roadData[i];
    for (var j = 0; j < seg.obstacles.length; j++) {
      var obs = seg.obstacles[j];
      if (obs.hit) continue;

      var dx = obs.worldX - (seg.centerX + Math.cos(seg.heading) * player.worldX);
      var dz = obs.worldZ - (seg.centerZ + (-Math.sin(seg.heading)) * player.worldX);
      var dist = Math.sqrt(dx * dx + dz * dz);
      var collisionDist = (OBSTACLE_EFFECTS[obs.type].radius || 1) + BIKE_RADIUS;

      if (dist < collisionDist) {
        obs.hit = true;
        handleObstacleHit(obs);
        if (gameState !== 'playing') return;
      }
    }
  }
}

function handleObstacleHit(obs) {
  var effect = OBSTACLE_EFFECTS[obs.type];

  // Hide obstacle mesh
  if (obs.mesh) {
    obs.mesh.visible = false;
  }

  if (effect.crash) {
    Audio.playCrash();
    crashGame(
      'You crashed into a ' + effect.label.toLowerCase() + '!',
      'Watch the obstacle alert! Steer around rocks and barriers.'
    );
  } else if (effect.slippery) {
    puddleTimer = 2.5;
    player.health -= HEALTH_OBSTACLE_LOSS;
    Audio.playBump();
  } else {
    player.stability -= effect.stabilityLoss;
    player.health -= HEALTH_OBSTACLE_LOSS;
    shakeAmount = Math.min(15, shakeAmount + (effect.shake || 6));
    if (effect.speedPenalty) {
      player.speed = Math.max(0, player.speed - effect.speedPenalty);
    }
    Audio.playBump();
    if (player.stability <= 0) {
      crashGame(
        'You hit a ' + effect.label.toLowerCase() + ' and lost balance!',
        'Small obstacles damage your stability. Avoid them or slow down first.'
      );
    }
  }
}

function checkCoinPickup() {
  var startSeg = Math.floor(player.prevZ / SEGMENT_LENGTH);
  var endSeg = Math.floor(player.z / SEGMENT_LENGTH);

  for (var i = startSeg; i <= endSeg; i++) {
    if (i < 0 || i >= roadData.length) continue;
    var seg = roadData[i];
    for (var j = 0; j < seg.coins.length; j++) {
      var coin = seg.coins[j];
      if (coin.collected) continue;

      var perpX = Math.cos(seg.heading);
      var perpZ = -Math.sin(seg.heading);
      var bikeWorldX = seg.centerX + perpX * player.worldX;
      var bikeWorldZ = seg.centerZ + perpZ * player.worldX;

      var dx = coin.worldX - bikeWorldX;
      var dz = coin.worldZ - bikeWorldZ;
      var dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.5) {
        coin.collected = true;
        if (coin.mesh) coin.mesh.visible = false;
        player.coinsCollected++;
        player.health = Math.min(HEALTH_MAX, player.health + HEALTH_COIN_GAIN);
        Audio.playCoin();
      }
    }
  }
}

// ============================================
// SECTION 12: RENDERING
// ============================================

function updateDebugStatus() {
  var el = document.getElementById('debug-status');
  if (!el) return;
  var camPos = camera ? camera.position : {x:0,y:0,z:0};
  var bikePos = bikePivot ? bikePivot.position : {x:0,y:0,z:0};
  var sceneObjs = scene ? scene.children.length : 0;
  el.textContent = 'State:' + gameState +
    ' | Cam:' + camPos.x.toFixed(1) + ',' + camPos.y.toFixed(1) + ',' + camPos.z.toFixed(1) +
    ' | Bike:' + bikePos.x.toFixed(1) + ',' + bikePos.y.toFixed(1) + ',' + bikePos.z.toFixed(1) +
    ' | Scene:' + sceneObjs +
    ' | Road:' + (roadData ? roadData.length : 0);
}

function render() {
  if (gameState === 'menu') {
    // Slowly rotate camera around origin for menu
    var t = elapsedTime * 0.2;
    camera.position.set(Math.sin(t) * 25, 10, Math.cos(t) * 25);
    camera.lookAt(0, 1, 0);
    elapsedTime += 0.016;
    renderer.render(scene, camera);
    return;
  }

  renderer.render(scene, camera);

  // 2D overlay effects on the 2D context
  if (ctx2d) {
    var cw = ctx2d.canvas.width;
    var ch = ctx2d.canvas.height;
    ctx2d.clearRect(0, 0, cw, ch);
    // Low stability red vignette
    if (player.stability < 30) {
      var alpha = (30 - player.stability) / 30 * 0.4;
      var grad = ctx2d.createRadialGradient(
        cw / 2, ch / 2, ch * 0.3,
        cw / 2, ch / 2, ch * 0.7
      );
      grad.addColorStop(0, 'rgba(255,0,0,0)');
      grad.addColorStop(1, 'rgba(255,0,0,' + alpha + ')');
      ctx2d.fillStyle = grad;
      ctx2d.fillRect(0, 0, cw, ch);
    }
  }
}

// ============================================
// SECTION 13: HUD
// ============================================

function updateHUD() {
  var level = LEVELS[currentLevel];

  var speedNum = Math.round(player.speed);
  var speedLabel = 'Slow';
  if (speedNum > 140) speedLabel = 'Fast';
  else if (speedNum > 70) speedLabel = 'Moderate';
  document.getElementById('hud-speed-num').textContent = speedNum;
  document.getElementById('hud-speed-label').textContent = speedLabel;

  var stabPct = Math.round(player.stability);
  var stabLabel = 'Stable', stabColor = '#27ae60';
  if (stabPct < 30) { stabLabel = 'Falling!'; stabColor = '#e74c3c'; }
  else if (stabPct < 60) { stabLabel = 'Unstable'; stabColor = '#f39c12'; }
  document.getElementById('hud-stability-fill').style.width = stabPct + '%';
  document.getElementById('hud-stability-fill').style.background = stabColor;
  document.getElementById('hud-stability-label').textContent = stabLabel + ' (' + stabPct + '%)';
  document.getElementById('hud-stability-fill').className = stabPct < 30 ? 'flash' : '';

  // Health
  var hpPct = Math.round(player.health);
  var hpColor = '#27ae60';
  if (hpPct < 30) hpColor = '#e74c3c';
  else if (hpPct < 60) hpColor = '#f39c12';
  document.getElementById('hud-health-fill').style.width = hpPct + '%';
  document.getElementById('hud-health-fill').style.background = hpColor;
  document.getElementById('hud-health-label').textContent = hpPct + '%';
  document.getElementById('hud-health-fill').className = hpPct < 30 ? 'flash' : '';

  // Coins
  document.getElementById('hud-coins').textContent = player.coinsCollected;

  var segIndex = Math.floor(player.z / SEGMENT_LENGTH);
  var seg = roadData[segIndex];
  var terrain = slipperyActive ? 'slippery' : (seg ? seg.terrain : 'pavement');
  document.getElementById('hud-terrain').textContent = TERRAIN_LABELS[terrain] || 'Pavement';

  var remaining = Math.max(0, Math.round(level.distance - player.z));
  var progress = Math.min(100, (player.z / level.distance) * 100);
  document.getElementById('hud-distance').textContent = remaining + ' m';
  document.getElementById('hud-progress-fill').style.width = progress + '%';

  var timeLeft = Math.max(0, Math.ceil(timeRemaining));
  document.getElementById('hud-time').textContent = timeLeft + 's';
  document.getElementById('hud-time').className = timeLeft <= 10 ? 'time-warning' : '';

  var alertEl = document.getElementById('hud-obstacle-alert');
  if (obstacleWarning) {
    alertEl.style.display = 'block';
    var icon = 'OBSTACLE AHEAD';
    if (obstacleWarning.side === 'left') icon = '<< OBSTACLE AHEAD';
    else if (obstacleWarning.side === 'right') icon = 'OBSTACLE AHEAD >>';
    else icon = '! OBSTACLE AHEAD !';
    alertEl.textContent = icon;
  } else {
    alertEl.style.display = 'none';
  }

  var leanEl = document.getElementById('hud-lean');
  if (Math.abs(player.lean) > 0.1) {
    leanEl.textContent = player.lean < 0 ? 'Leaning Left' : 'Leaning Right';
    leanEl.style.display = 'block';
  } else {
    leanEl.style.display = 'none';
  }
}

// ============================================
// SECTION 14: GAME STATE MANAGEMENT
// ============================================

function startLevel(levelIndex) {
  currentLevel = levelIndex;
  var level = LEVELS[levelIndex];

  player.z = 0;
  player.worldX = 0;
  player.speed = 0;
  player.stability = STABILITY_MAX;
  player.health = HEALTH_MAX;
  player.coinsCollected = 0;
  player.lean = 0;
  player.targetLean = 0;
  player.prevZ = 0;
  player.lowSpeedTimer = 0;
  player.steerInput = 0;

  roadData = generateRoad(level);
  buildRoadMesh();
  placeObstacles();
  placeCoins();
  placeScenery(level);

  // Update sky/fog color for level
  var skyColor = SKY_COLORS[levelIndex];
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, 50, 250);

  timeRemaining = level.timeLimit;
  elapsedTime = 0;
  shakeAmount = 0;
  puddleTimer = 0;
  slipperyActive = false;
  obstacleWarning = null;
  crashReason = '';
  crashTip = '';

  document.getElementById('level-name').textContent = 'Level ' + (levelIndex + 1) + ': ' + level.name;
  document.getElementById('level-desc').textContent = level.description;

  gameState = 'playing';
  updateOverlays();

  // Snap camera directly behind bike on level start
  var firstSeg = roadData[0];
  if (firstSeg) {
    var h = firstSeg.heading;
    var camDist = 13, camHeight = 7;
    var camX = firstSeg.centerX - Math.sin(h) * camDist;
    var camZ = firstSeg.centerZ - Math.cos(h) * camDist;
    var camY = firstSeg.y + camHeight;
    camera.position.set(camX, camY, camZ);
    // Look directly at bike position
    camera.lookAt(firstSeg.centerX, firstSeg.y + 1.5, firstSeg.centerZ);
    camera.fov = 62;
    camera.updateProjectionMatrix();
  }

  Audio.resume();
  Audio.startWind();
}

function crashGame(reason, tip) {
  gameState = 'lost';
  crashReason = reason;
  crashTip = tip;
  Audio.playCrash();
  Audio.stopWind();
  document.getElementById('gameover-reason').textContent = reason;
  document.getElementById('gameover-tip').textContent = tip;
  updateOverlays();
}

function winGame() {
  gameState = 'won';
  Audio.playWin();
  Audio.stopWind();

  var level = LEVELS[currentLevel];
  var isLast = currentLevel >= LEVELS.length - 1;
  document.getElementById('win-title').textContent = isLast ? 'All Levels Complete!' : 'Level Complete!';
  document.getElementById('win-stats').innerHTML =
    '<b>Time:</b> ' + Math.round(elapsedTime) + 's / ' + level.timeLimit + 's<br>' +
    '<b>Health:</b> ' + Math.round(player.health) + '%<br>' +
    '<b>Stability:</b> ' + Math.round(player.stability) + '%<br>' +
    '<b>Coins Collected:</b> ' + player.coinsCollected + '<br>' +
    '<b>Level:</b> ' + (currentLevel + 1) + ' / ' + LEVELS.length;

  var nextBtn = document.getElementById('win-next-btn');
  nextBtn.textContent = isLast ? 'Back to Menu' : 'Next Level';
  updateOverlays();
}

function updateOverlays() {
  var menu = document.getElementById('menu-overlay');
  var pause = document.getElementById('pause-overlay');
  var gameover = document.getElementById('gameover-overlay');
  var win = document.getElementById('win-overlay');
  var hud = document.getElementById('hud');
  var levelBar = document.getElementById('level-bar');

  menu.style.display = gameState === 'menu' ? 'flex' : 'none';
  pause.style.display = gameState === 'paused' ? 'flex' : 'none';
  gameover.style.display = gameState === 'lost' ? 'flex' : 'none';
  win.style.display = gameState === 'won' ? 'flex' : 'none';
  hud.style.display = (gameState === 'playing' || gameState === 'paused') ? 'block' : 'none';
  levelBar.style.display = (gameState === 'playing' || gameState === 'paused') ? 'flex' : 'none';
}

// ============================================
// SECTION 15: GAME LOOP
// ============================================

function gameLoop(timestamp) {
  var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (gameState === 'playing') {
    update(dt);
  }
  render();

  requestAnimationFrame(gameLoop);
}

// ============================================
// SECTION 16: INITIALIZATION
// ============================================

function init() {
  console.log('[BikeRider3D] init() started');
  // Check Three.js availability
  if (typeof THREE === 'undefined') {
    document.body.innerHTML = '<div style="color:#fff;padding:40px;text-align:center;">' +
      '<h2>Three.js failed to load</h2><p>Please ensure assets/js/three.min.js exists.</p></div>';
    return;
  }
  console.log('[BikeRider3D] THREE version:', THREE.REVISION);

  // Get canvas - use WebGL for 3D, plus a 2D overlay canvas
  var webglCanvas = document.getElementById('game-canvas');
  if (!webglCanvas) {
    document.body.innerHTML = '<div style="color:#fff;padding:40px;">Error: canvas element not found</div>';
    return;
  }

  // Create 2D overlay canvas for vignette effects
  var overlayCanvas = document.createElement('canvas');
  overlayCanvas.style.position = 'absolute';
  overlayCanvas.style.top = '0';
  overlayCanvas.style.left = '0';
  overlayCanvas.style.width = '100%';
  overlayCanvas.style.height = '100%';
  overlayCanvas.style.pointerEvents = 'none';
  overlayCanvas.style.zIndex = '5';
  document.getElementById('game-container').appendChild(overlayCanvas);
  ctx2d = overlayCanvas.getContext('2d');

  // Three.js renderer — with error handling
  try {
    renderer = new THREE.WebGLRenderer({ canvas: webglCanvas, antialias: true });
  } catch(e) {
    document.getElementById('game-container').innerHTML =
      '<div style="color:#fff;padding:40px;text-align:center;">' +
      '<h2>WebGL Error</h2><p>' + e.message + '</p>' +
      '<p>Your browser may not support WebGL.</p></div>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  console.log('[BikeRider3D] WebGL renderer created successfully');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 50, 250);

  // Camera — dynamic aspect ratio
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / Math.max(200, window.innerHeight - 50), 0.1, 600);
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 1, 0);

  // Dynamic resize — fill browser window
  function resizeCanvas() {
    var w = window.innerWidth;
    var h = Math.max(200, window.innerHeight - 50);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (overlayCanvas) {
      overlayCanvas.width = w;
      overlayCanvas.height = h;
    }
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Lighting
  var ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
  dirLight.position.set(30, 50, 20);
  scene.add(dirLight);

  // Hemisphere light for nicer outdoor look
  var hemi = new THREE.HemisphereLight(0x87CEEB, 0x3a6b3a, 0.4);
  scene.add(hemi);

  // Create shared resources
  createSharedResources();

  // Create bike
  createBike();

  // Build a simple preview road for menu
  roadData = generateRoad(LEVELS[0]);
  buildRoadMesh();
  placeObstacles();
  placeCoins();
  placeScenery(LEVELS[0]);

  setupInput();

  // Button handlers
  document.getElementById('menu-level-1').addEventListener('click', function() { Audio.init(); startLevel(0); });
  document.getElementById('menu-level-2').addEventListener('click', function() { Audio.init(); startLevel(1); });
  document.getElementById('menu-level-3').addEventListener('click', function() { Audio.init(); startLevel(2); });
  document.getElementById('menu-level-4').addEventListener('click', function() { Audio.init(); startLevel(3); });

  // Fullscreen toggle
  var fsBtn = document.getElementById('fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('click', function() {
      var elem = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    });
  }

  document.getElementById('pause-resume').addEventListener('click', function() { gameState = 'playing'; updateOverlays(); });
  document.getElementById('pause-menu').addEventListener('click', function() { gameState = 'menu'; updateOverlays(); });

  document.getElementById('gameover-retry').addEventListener('click', function() { startLevel(currentLevel); });
  document.getElementById('gameover-menu').addEventListener('click', function() { gameState = 'menu'; updateOverlays(); });

  document.getElementById('win-next-btn').addEventListener('click', function() {
    if (currentLevel < LEVELS.length - 1) startLevel(currentLevel + 1);
    else { gameState = 'menu'; updateOverlays(); }
  });
  document.getElementById('win-menu-btn').addEventListener('click', function() { gameState = 'menu'; updateOverlays(); });

  updateOverlays();
  lastTime = performance.now();
  console.log('[BikeRider3D] init() complete. Scene objects:', scene.children.length,
              'Road segments:', roadData.length, 'Starting game loop...');
  requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
