/**
 * Animal Dash — v5: Opponent Lane Switching, Clean UI
 *
 * Core Learning Shift: Speed isn't everything —
 * environment adaptation, stamina, and HP management matter!
 *
 * Controls:
 *   ← → (or A/D) — switch lanes
 *   ↑ (or W) hold — boost speed (faster stamina drain)
 *   Dodge obstacles (they reduce HP), collect food (restores stamina)
 *
 * Track A: No build step. Pure HTML/CSS/Canvas 2D.
 * Student: Chengxuan Zhang
 */

// ========== CONFIGURATION ==========

const SPEED_SCALE = 22;
const LANE_COUNT = 3;
const COLLISION_RADIUS = 28;
const INVINCIBLE_TIME = 1.2;
const MIN_STAMINA_FACTOR = 0.3;

// HP (blood) cost when hitting an obstacle — BASE value, scaled by adaptation
const HP_HIT_COST = 15;

// Stamina drain rates per second based on adaptation
const DRAIN = {
  perfect:  1.0,
  good:     1.5,
  medium:   2.2,
  poor:     3.0,
  veryPoor: 4.0
};

// Boost parameters
const BOOST_SPEED_MULT = 1.5;
const BOOST_STAMINA_MULT = 2.2;

// Progressive speed increase
const ACCELERATION_RATE = 0.0008;

const SCORE_PER_DODGE = 10;
const SCORE_PER_STAR = 50;

// Segment duration per level (seconds)
const SEGMENT_DURATIONS = [180, 150, 120];

// ========== OPPONENT BALANCE ==========
const OPP_STAMINA_MULT = 1.5;
const OPP_HP_MULT = 1.3;
const OPP_HIT_RATE = 0.008;
const OPP_HIT_DAMAGE_MULT = 0.25;
const OPP_STAMINA_REGEN = 0.15;
const OPP_BOOST_CHANCE = 0.12;

// ========== TERRAIN DATA (7 types) ==========

const TERRAINS = {
  grassland: {
    name: 'Grassland',  emoji: '🌾',
    bg: '#7CCD7C', mid: '#5CA85C', dark: '#4A7A3A', accent: '#4A9B4A',
    skyTop: '#87CEEB', skyBottom: '#B0E0B0',
    groundEmoji: '🌿', decorEmoji: ['🌸', '🌺', '🦋', '🌻'],
    particleColor: '#E8D44D', particleType: 'pollen'
  },
  forest: {
    name: 'Forest',     emoji: '🌲',
    bg: '#2E8B57', mid: '#1A6B3A', dark: '#0D4B1A', accent: '#1A5B1A',
    skyTop: '#4A6741', skyBottom: '#2E5B2E',
    groundEmoji: '🍂', decorEmoji: ['🍄', '🌿', '🦉', '🍃'],
    particleColor: '#8B4513', particleType: 'leaf'
  },
  desert: {
    name: 'Desert',     emoji: '🏜️',
    bg: '#EDC9AF', mid: '#D4A76A', dark: '#8B7355', accent: '#C4A882',
    skyTop: '#87CEFA', skyBottom: '#EDC9AF',
    groundEmoji: '🌵', decorEmoji: ['🦂', '🔥', '💀', '🪨'],
    particleColor: '#D4A76A', particleType: 'sand'
  },
  ocean: {
    name: 'Ocean',      emoji: '🌊',
    bg: '#4682B4', mid: '#2E6BA0', dark: '#1A4A80', accent: '#1E90FF',
    skyTop: '#1E90FF', skyBottom: '#4682B4',
    groundEmoji: '🪸', decorEmoji: ['🐠', '🫧', '🐚', '🪼'],
    particleColor: '#ADD8E6', particleType: 'bubble'
  },
  mountain: {
    name: 'Mountain',   emoji: '⛰️',
    bg: '#A0826D', mid: '#7B6345', dark: '#5A4030', accent: '#6B5344',
    skyTop: '#B0C4DE', skyBottom: '#A0826D',
    groundEmoji: '🪨', decorEmoji: ['🏔️', '⛰️', '🦅', '☁️'],
    particleColor: '#CCC', particleType: 'mist'
  },
  antarctic: {
    name: 'Antarctic',  emoji: '❄️',
    bg: '#D0E8F0', mid: '#A0C8D8', dark: '#80B0C0', accent: '#C0D8E8',
    skyTop: '#E8F4F8', skyBottom: '#D0E8F0',
    groundEmoji: '🧊', decorEmoji: ['❄️', '🌨️', '🦭', '❆'],
    particleColor: '#FFF', particleType: 'snow'
  },
  arctic: {
    name: 'Arctic',     emoji: '🧊',
    bg: '#E8F0F8', mid: '#B8D0E0', dark: '#98B8C8', accent: '#D0E0E8',
    skyTop: '#F0F8FF', skyBottom: '#E8F0F8',
    groundEmoji: '🧊', decorEmoji: ['❄️', '🐺', '🌬️', '❆'],
    particleColor: '#E0E8F0', particleType: 'snow'
  }
};

const OBSTACLE_TYPES = {
  grassland: ['🌿', '🪨'],
  forest:    ['🌳', '🍄'],
  desert:    ['🌵', '🪨'],
  ocean:     ['🪸', '🪼'],
  mountain:  ['🪨', '⛰️'],
  antarctic: ['🧊', '🪨'],
  arctic:    ['🧊', '❄️']
};

const BONUS_TYPES = [
  { emoji: '🍖', type: 'stamina', value: 35, weight: 3 },
  { emoji: '🐟', type: 'stamina', value: 30, weight: 2 },
  { emoji: '🍎', type: 'stamina', value: 25, weight: 2 },
  { emoji: '❤️', type: 'hp',      value: 20, weight: 2 },
  { emoji: '💚', type: 'stamina', value: 50, weight: 1 },
  { emoji: '⭐', type: 'score',   value: 50, weight: 1 }
];

// ========== ANIMAL DATA (14 animals) ==========

const ANIMALS = [
  { id: 'cheetah',  name: 'Cheetah',  emoji: '豹', baseSpeed: 10, maxStamina: 40, maxHP: 30,
    adapt: { grassland: 0.85, forest: 0.30, desert: 0.25, ocean: 0.15, mountain: 0.20, antarctic: 0.15, arctic: 0.15 },
    desc: 'Fastest on grassland. Struggles in harsh climates.' },
  { id: 'horse',    name: 'Horse',    emoji: '🐴', baseSpeed: 7,  maxStamina: 70, maxHP: 50,
    adapt: { grassland: 0.75, forest: 0.45, desert: 0.50, ocean: 0.15, mountain: 0.30, antarctic: 0.20, arctic: 0.25 },
    desc: 'Versatile runner. Solid stamina and toughness.' },
  { id: 'camel',    name: 'Camel',    emoji: '🐪', baseSpeed: 5,  maxStamina: 90, maxHP: 60,
    adapt: { grassland: 0.45, forest: 0.20, desert: 0.85, ocean: 0.15, mountain: 0.25, antarctic: 0.15, arctic: 0.15 },
    desc: 'Desert champion. Unmatched heat endurance.' },
  { id: 'deer',     name: 'Deer',     emoji: '🦌', baseSpeed: 6,  maxStamina: 60, maxHP: 40,
    adapt: { grassland: 0.55, forest: 0.85, desert: 0.25, ocean: 0.15, mountain: 0.50, antarctic: 0.20, arctic: 0.25 },
    desc: 'Forest specialist. Agile among trees.' },
  { id: 'dolphin',  name: 'Dolphin',  emoji: '🐬', baseSpeed: 8,  maxStamina: 80, maxHP: 45,
    adapt: { grassland: 0.15, forest: 0.15, desert: 0.15, ocean: 0.85, mountain: 0.15, antarctic: 0.40, arctic: 0.30 },
    desc: 'Ocean speedster. Thrives in water.' },
  { id: 'eagle',    name: 'Eagle',    emoji: '🦅', baseSpeed: 9,  maxStamina: 50, maxHP: 35,
    adapt: { grassland: 0.45, forest: 0.30, desert: 0.40, ocean: 0.15, mountain: 0.80, antarctic: 0.25, arctic: 0.30 },
    desc: 'Mountain flyer. Rules the sky at altitude.' },
  { id: 'fox',      name: 'Fox',      emoji: '🦊', baseSpeed: 5,  maxStamina: 65, maxHP: 45,
    adapt: { grassland: 0.55, forest: 0.70, desert: 0.40, ocean: 0.15, mountain: 0.30, antarctic: 0.25, arctic: 0.50 },
    desc: 'Clever all-rounder. Best in forest & cold.' },
  { id: 'goat',     name: 'Mtn Goat', emoji: '🐐', baseSpeed: 4,  maxStamina: 85, maxHP: 55,
    adapt: { grassland: 0.25, forest: 0.25, desert: 0.20, ocean: 0.15, mountain: 0.85, antarctic: 0.20, arctic: 0.25 },
    desc: 'King of cliffs. Unmatched on mountains.' },
  { id: 'bear',     name: 'Bear',     emoji: '🐻', baseSpeed: 3,  maxStamina: 95, maxHP: 80,
    adapt: { grassland: 0.40, forest: 0.65, desert: 0.20, ocean: 0.25, mountain: 0.40, antarctic: 0.45, arctic: 0.55 },
    desc: 'Endurance tank. Versatile in cold & forest.' },
  { id: 'penguin',  name: 'Penguin',  emoji: '🐧', baseSpeed: 4,  maxStamina: 75, maxHP: 50,
    adapt: { grassland: 0.15, forest: 0.15, desert: 0.15, ocean: 0.65, mountain: 0.15, antarctic: 0.85, arctic: 0.70 },
    desc: 'Antarctic specialist. Great in ice and water.' },
  { id: 'seal',     name: 'Seal',     emoji: '🦭', baseSpeed: 5,  maxStamina: 70, maxHP: 50,
    adapt: { grassland: 0.15, forest: 0.15, desert: 0.15, ocean: 0.75, mountain: 0.15, antarctic: 0.75, arctic: 0.55 },
    desc: 'Water and ice expert. Solid survivor.' },
  { id: 'wolf',     name: 'Wolf',     emoji: '🐺', baseSpeed: 6,  maxStamina: 75, maxHP: 55,
    adapt: { grassland: 0.45, forest: 0.55, desert: 0.30, ocean: 0.15, mountain: 0.40, antarctic: 0.50, arctic: 0.80 },
    desc: 'Arctic hunter. Strong in cold and forest.' },
  { id: 'rabbit',   name: 'Rabbit',   emoji: '🐰', baseSpeed: 5,  maxStamina: 45, maxHP: 25,
    adapt: { grassland: 0.65, forest: 0.50, desert: 0.30, ocean: 0.15, mountain: 0.25, antarctic: 0.25, arctic: 0.50 },
    desc: 'Quick and nimble. Best on grassland.' },
  { id: 'shark',    name: 'Shark',    emoji: '🦈', baseSpeed: 7,  maxStamina: 60, maxHP: 50,
    adapt: { grassland: 0.15, forest: 0.15, desert: 0.15, ocean: 0.80, mountain: 0.15, antarctic: 0.25, arctic: 0.20 },
    desc: 'Ocean predator. Deadly in water.' }
];

// ========== LEVEL DATA (3 levels) ==========

const LEVELS = [
  {
    id: 1, name: 'Level 1', difficulty: 'Easy',
    desc: 'Terrain changes announced. Learn the basics.',
    terrains: ['grassland', 'forest', 'desert'],
    numSegments: 3,
    segmentDuration: 180,
    obstacleRate: 3.5,
    bonusRate: 4.0,
    announceTerrain: true,
    opponentSkill: 0.90,
    animals: ['cheetah', 'horse', 'camel', 'deer', 'fox', 'bear', 'rabbit']
  },
  {
    id: 2, name: 'Level 2', difficulty: 'Medium',
    desc: 'No announcements! Watch the environment.',
    terrains: ['grassland', 'forest', 'desert', 'ocean', 'mountain'],
    numSegments: 5,
    segmentDuration: 150,
    obstacleRate: 2.6,
    bonusRate: 5.0,
    announceTerrain: false,
    opponentSkill: 0.95,
    animals: ['cheetah', 'horse', 'camel', 'deer', 'fox', 'bear', 'rabbit', 'dolphin', 'eagle', 'goat', 'wolf', 'seal']
  },
  {
    id: 3, name: 'Level 3', difficulty: 'Hard',
    desc: 'All environments. Dense obstacles. Survive!',
    terrains: ['grassland', 'forest', 'desert', 'ocean', 'mountain', 'antarctic', 'arctic'],
    numSegments: 7,
    segmentDuration: 120,
    obstacleRate: 2.0,
    bonusRate: 5.5,
    announceTerrain: false,
    opponentSkill: 1.0,
    animals: ['cheetah', 'horse', 'camel', 'deer', 'fox', 'bear', 'rabbit', 'dolphin', 'eagle', 'goat', 'wolf', 'seal', 'penguin', 'shark']
  }
];

// ========== GAME STATE ==========

let G = {
  screen: 'title',
  levelIdx: 0,
  level: null,
  segments: [],
  availableAnimals: [],
  playerAnimal: null,
  opponentAnimal: null,
  playerDistance: 0,
  opponentDistance: 0,
  playerStamina: 0,
  opponentStamina: 0,
  playerHP: 0,
  opponentHP: 0,
  oppMaxStamina: 0,
  oppMaxHP: 0,
  oppBoosting: false,
  oppLane: 1,
  oppLaneTimer: 2,
  segIdx: 0,
  segElapsed: 0,
  lane: 1,
  animalX: 0,
  oppX: 0,
  obstacles: [],
  bonuses: [],
  obstacleTimer: 0,
  bonusTimer: 0,
  totalTime: 0,
  levelTime: 0,
  lastTime: 0,
  animFrame: 0,
  score: 0,
  obstaclesDodged: 0,
  animalsUsed: [],
  collisionFlash: 0,
  invincible: 0,
  finished: false,
  playerWon: false,
  endReason: '',
  hoverAnimal: null,
  selectedLevel: 0,
  unlockedLevel: 0,
  canvas: null,
  ctx: null,
  mouseX: 0,
  mouseY: 0,
  keysPressed: {},
  boosting: false,
  animalScreenY: 0,
  terrainAnnounce: null,
  terrainTransitionTimer: 0,
  particles: [],
  decorObjects: []
};

// ========== UTILITY FUNCTIONS ==========

function getAnimal(id) {
  return ANIMALS.find(a => a.id === id);
}

function adaptLevel(animal, terrain) {
  return animal.adapt[terrain] !== undefined ? animal.adapt[terrain] : 0;
}

function effectiveSpeed(animal, terrain, stamina, hp, isBoosting, accelFactor) {
  const rawAdapt = adaptLevel(animal, terrain);
  const af = 0.3 + rawAdapt * 0.7;   // speed floor: even worst adaptation has 30% speed
  const sf = Math.max(MIN_STAMINA_FACTOR, stamina / animal.maxStamina);
  const hf = Math.max(0.5, hp / animal.maxHP);
  let speed = animal.baseSpeed * SPEED_SCALE * af * sf * hf;
  if (isBoosting) speed *= BOOST_SPEED_MULT;
  speed *= accelFactor;
  return speed;
}

function staminaDrain(animal, terrain, isBoosting) {
  const a = adaptLevel(animal, terrain);
  let drain;
  if (a >= 0.80) drain = DRAIN.perfect;
  else if (a >= 0.60) drain = DRAIN.good;
  else if (a >= 0.40) drain = DRAIN.medium;
  else if (a >= 0.25) drain = DRAIN.poor;
  else drain = DRAIN.veryPoor;
  if (isBoosting) drain *= BOOST_STAMINA_MULT;
  return drain;
}

function obstacleHPCost(animal, terrain) {
  const adapt = adaptLevel(animal, terrain);
  const multiplier = 2.0 - adapt * 1.5;
  return HP_HIT_COST * multiplier;
}

function currentTerrain() {
  if (!G.segments.length) return 'grassland';
  return G.segments[G.segIdx].terrain;
}

function currentSegmentDuration() {
  return G.level ? G.level.segmentDuration : 180;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// ========== PARTICLES & DECORATION ==========

function initParticles(terrain) {
  const info = TERRAINS[terrain];
  G.particles = [];
  const count = terrain === 'antarctic' || terrain === 'arctic' ? 40 :
                terrain === 'desert' ? 25 :
                terrain === 'forest' ? 20 :
                terrain === 'ocean' ? 30 : 15;
  for (let i = 0; i < count; i++) {
    G.particles.push({
      x: Math.random() * (G.canvas ? G.canvas.width : 800),
      y: Math.random() * (G.canvas ? G.canvas.height : 600),
      vx: (Math.random() - 0.5) * 0.5,
      vy: info.particleType === 'snow' ? 0.3 + Math.random() * 0.5 :
          info.particleType === 'sand' ? 0.2 + Math.random() * 0.3 :
          info.particleType === 'bubble' ? -0.3 - Math.random() * 0.4 :
          info.particleType === 'leaf' ? 0.1 + Math.random() * 0.2 :
          info.particleType === 'mist' ? 0.05 + Math.random() * 0.1 :
          0.1 + Math.random() * 0.2,
      size: 2 + Math.random() * 4,
      alpha: 0.2 + Math.random() * 0.4,
      color: info.particleColor
    });
  }

  G.decorObjects = [];
  const decorCount = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < decorCount; i++) {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const emoji = info.decorEmoji[Math.floor(Math.random() * info.decorEmoji.length)];
    G.decorObjects.push({
      side: side,
      xOffset: 15 + Math.random() * 40,
      yRatio: 0.15 + Math.random() * 0.65,
      emoji: emoji,
      alpha: 0.4 + Math.random() * 0.3,
      drift: Math.random() * 0.3
    });
  }
}

function updateParticles(dt) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  for (const p of G.particles) {
    p.x += p.vx * 60 * dt;
    p.y += p.vy * 60 * dt;
    if (p.x < 0) p.x = W;
    if (p.x > W) p.x = 0;
    if (p.y > H) { p.y = HUD_H + 10; p.alpha = 0.2 + Math.random() * 0.4; }
    if (p.y < HUD_H) { p.y = H; p.alpha = 0.2 + Math.random() * 0.4; }
  }
}

function drawParticles(ctx) {
  for (const p of G.particles) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    if (TERRAINS[currentTerrain()].particleType === 'snow' || TERRAINS[currentTerrain()].particleType === 'bubble') {
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.6);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

function drawDecor(ctx, W, H) {
  const info = TERRAINS[currentTerrain()];
  const scrollOffset = G.animFrame * 0.5;
  for (const d of G.decorObjects) {
    const baseX = d.side === 'left' ? d.xOffset : W - d.xOffset;
    const baseY = HUD_H + d.yRatio * (H - HUD_H) + Math.sin(G.animFrame * 0.02 + d.drift * 10) * 8;
    ctx.globalAlpha = d.alpha;
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.emoji, baseX, baseY);
  }
  ctx.globalAlpha = 1.0;
  ctx.textAlign = 'left';
}

// ========== RANDOM TERRAIN GENERATION ==========

function generateSegments(level) {
  const segments = [];
  const terrains = [...level.terrains];

  for (let i = terrains.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [terrains[i], terrains[j]] = [terrains[j], terrains[i]];
  }

  const numSeg = level.numSegments;
  let lastTerrain = null;

  for (let i = 0; i < numSeg; i++) {
    let terrain;
    if (i < terrains.length) {
      terrain = terrains[i];
    } else {
      let attempts = 0;
      do {
        terrain = terrains[Math.floor(Math.random() * terrains.length)];
        attempts++;
      } while (terrain === lastTerrain && terrains.length > 1 && attempts < 10);
    }
    segments.push({ terrain: terrain, duration: level.segmentDuration });
    lastTerrain = terrain;
  }

  return segments;
}

// ========== OPPONENT AI ==========

function aiBestAnimal(terrain, animalIds) {
  let best = null, bestScore = -1;
  for (const id of animalIds) {
    const a = getAnimal(id);
    const score = a.baseSpeed * adaptLevel(a, terrain) * (0.4 + 0.35 * a.maxHP / 80 + 0.25 * a.maxStamina / 100);
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

// ========== LEVEL INITIALIZATION ==========

function initLevel(idx) {
  G.levelIdx = idx;
  G.level = LEVELS[idx];
  G.segments = generateSegments(G.level);
  G.availableAnimals = G.level.animals.map(id => getAnimal(id));
  G.playerDistance = 0;
  G.opponentDistance = 0;
  G.segIdx = 0;
  G.segElapsed = 0;
  G.lane = 1;
  G.obstacles = [];
  G.bonuses = [];
  G.obstacleTimer = G.level.obstacleRate;
  G.bonusTimer = G.level.bonusRate * 0.5;
  G.totalTime = 0;
  G.levelTime = 0;
  G.score = 0;
  G.obstaclesDodged = 0;
  G.animalsUsed = [];
  G.collisionFlash = 0;
  G.invincible = 0;
  G.finished = false;
  G.endReason = '';
  G.boosting = false;
  G.oppBoosting = false;
  G.oppLane = 1;
  G.oppLaneTimer = 2;
  G.terrainAnnounce = null;
  G.terrainTransitionTimer = 0;
  G.screen = 'animalSelect';
}

function startRace() {
  const firstTerrain = G.segments[0].terrain;
  G.opponentAnimal = aiBestAnimal(firstTerrain, G.level.animals);
  G.oppMaxStamina = Math.round(G.opponentAnimal.maxStamina * OPP_STAMINA_MULT);
  G.oppMaxHP = Math.round(G.opponentAnimal.maxHP * OPP_HP_MULT);
  G.opponentStamina = G.oppMaxStamina;
  G.opponentHP = G.oppMaxHP;
  G.playerStamina = G.playerAnimal.maxStamina;
  G.playerHP = G.playerAnimal.maxHP;
  G.animalsUsed.push(G.playerAnimal.id);
  G.screen = 'playing';
  G.playerDistance = 0;
  G.opponentDistance = 0;
  G.segIdx = 0;
  G.segElapsed = 0;
  G.totalTime = 0;
  G.levelTime = 0;
  G.oppBoosting = false;
  G.oppLane = 1;
  G.oppLaneTimer = 2;
  // Initialize positions at lane centers
  const lw = G.canvas.width / LANE_COUNT;
  G.animalX = lw * (G.lane + 0.5);
  G.oppX = lw * (G.oppLane + 0.5) + 20;
  initParticles(currentTerrain());
}

function switchAnimal(id) {
  const a = getAnimal(id);
  if (!a) return;
  G.playerAnimal = a;
  G.playerStamina = a.maxStamina;
  G.playerHP = a.maxHP;
  if (!G.animalsUsed.includes(a.id)) {
    G.animalsUsed.push(a.id);
  }
  G.obstacles = G.obstacles.filter(o => o.distance < G.playerDistance + 150);
  G.bonuses = G.bonuses.filter(b => b.distance < G.playerDistance + 150);
  G.obstacleTimer = G.level.obstacleRate * 0.5;
  G.invincible = 0.8;
  G.screen = 'playing';
  initParticles(currentTerrain());
}

// ========== OBSTACLE & BONUS SPAWNING ==========

function spawnObstacle() {
  const t = currentTerrain();
  const obsTypes = OBSTACLE_TYPES[t];
  const emoji = obsTypes[Math.floor(Math.random() * obsTypes.length)];
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const spawnAhead = G.animalScreenY + 10;
  const distance = G.playerDistance + spawnAhead;
  G.obstacles.push({ distance: distance, lane: lane, emoji: emoji, hit: false, dodged: false });
}

function spawnBonus() {
  const totalWeight = BONUS_TYPES.reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * totalWeight;
  let bonus = BONUS_TYPES[0];
  for (const b of BONUS_TYPES) {
    r -= b.weight;
    if (r <= 0) { bonus = b; break; }
  }
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const spawnAhead = G.animalScreenY + 10;
  const distance = G.playerDistance + spawnAhead;
  G.bonuses.push({
    distance: distance, lane: lane, emoji: bonus.emoji,
    type: bonus.type, value: bonus.value, collected: false
  });
}

// ========== COLLISION DETECTION ==========

function checkCollisions() {
  const t = currentTerrain();

  if (G.invincible <= 0) {
    for (const obs of G.obstacles) {
      if (obs.hit) continue;
      const distDiff = Math.abs(obs.distance - G.playerDistance);
      if (distDiff < COLLISION_RADIUS && obs.lane === G.lane) {
        obs.hit = true;
        const hpCost = obstacleHPCost(G.playerAnimal, t);
        G.playerHP = Math.max(0, G.playerHP - hpCost);
        G.playerStamina = Math.max(0, G.playerStamina - 5);
        G.collisionFlash = 0.5;
        G.invincible = INVINCIBLE_TIME;
        G.score = Math.max(0, G.score - 20);
      }
    }
  }

  for (const bonus of G.bonuses) {
    if (bonus.collected) continue;
    const distDiff = Math.abs(bonus.distance - G.playerDistance);
    if (distDiff < COLLISION_RADIUS && bonus.lane === G.lane) {
      bonus.collected = true;
      if (bonus.type === 'stamina') {
        G.playerStamina = Math.min(G.playerAnimal.maxStamina, G.playerStamina + bonus.value);
      } else if (bonus.type === 'hp') {
        G.playerHP = Math.min(G.playerAnimal.maxHP, G.playerHP + bonus.value);
      } else if (bonus.type === 'score') {
        G.score += bonus.value;
      }
    }
  }
}

// ========== UPDATE ==========

function update(dt) {
  if (G.screen !== 'playing' || G.finished) return;

  G.totalTime += dt;
  G.levelTime += dt;
  G.animFrame += dt * 60;
  G.collisionFlash = Math.max(0, G.collisionFlash - dt);
  G.invincible = Math.max(0, G.invincible - dt);
  G.terrainTransitionTimer = Math.max(0, G.terrainTransitionTimer - dt);

  const accelFactor = 1.0 + G.levelTime * ACCELERATION_RATE;

  // Boost detection
  G.boosting = G.keysPressed['ArrowUp'] || G.keysPressed['w'] || G.keysPressed['W'];

  // Opponent decides to boost occasionally
  G.oppBoosting = Math.random() < OPP_BOOST_CHANCE;

  const t = currentTerrain();

  // --- Player movement ---
  let pSpeed = effectiveSpeed(G.playerAnimal, t, G.playerStamina, G.playerHP, G.boosting, accelFactor);
  G.playerDistance += pSpeed * dt;
  G.playerStamina = Math.max(0, G.playerStamina - staminaDrain(G.playerAnimal, t, G.boosting) * dt);

  // --- DEATH CHECK (player) — only HP=0 kills; stamina=0 just slows ---
  if (G.playerHP <= 0) {
    G.finished = true; G.playerWon = false; G.endReason = 'killed'; G.screen = 'gameOver'; return;
  }

  // --- Opponent movement ---
  const oSpeed = effectiveSpeed(G.opponentAnimal, t, G.opponentStamina, G.opponentHP, G.oppBoosting, accelFactor) * G.level.opponentSkill;
  G.opponentDistance += oSpeed * dt;

  const oppDrainRate = staminaDrain(G.opponentAnimal, t, G.oppBoosting) * 0.7;
  G.opponentStamina = Math.max(0, G.opponentStamina - oppDrainRate * dt);
  G.opponentStamina = Math.min(G.oppMaxStamina, G.opponentStamina + OPP_STAMINA_REGEN * dt);

  if (Math.random() < OPP_HIT_RATE) {
    const oppCost = obstacleHPCost(G.opponentAnimal, t) * OPP_HIT_DAMAGE_MULT;
    G.opponentHP = Math.max(0, G.opponentHP - oppCost);
  }

  if (G.opponentHP <= 0) {
    G.finished = true; G.playerWon = true; G.endReason = 'opponent_died';
    G.score += 500;
    G.screen = (G.levelIdx + 1 >= LEVELS.length) ? 'gameWon' : 'levelComplete';
    if (G.levelIdx + 1 < LEVELS.length) {
      G.unlockedLevel = Math.max(G.unlockedLevel, G.levelIdx + 1);
    }
    return;
  }

  // --- Opponent lane switching AI ---
  G.oppLaneTimer -= dt;
  if (G.oppLaneTimer <= 0) {
    let bestLane = G.oppLane;
    let laneScores = [1, 1.5, 1]; // slight center preference
    // Avoid obstacle lanes ahead
    for (const obs of G.obstacles) {
      if (!obs.hit && obs.distance > G.opponentDistance && obs.distance < G.opponentDistance + 120) {
        laneScores[obs.lane] -= 3;
      }
    }
    // Seek food lanes ahead
    for (const bonus of G.bonuses) {
      if (!bonus.collected && bonus.distance > G.opponentDistance && bonus.distance < G.opponentDistance + 100) {
        laneScores[bonus.lane] += 2;
      }
    }
    let maxScore = -999;
    for (let l = 0; l < LANE_COUNT; l++) {
      if (laneScores[l] > maxScore) { maxScore = laneScores[l]; bestLane = l; }
    }
    // Only switch if it's clearly better
    if (laneScores[bestLane] > laneScores[G.oppLane] + 0.5) {
      G.oppLane = bestLane;
    }
    G.oppLaneTimer = 1.2 + Math.random() * 1.8;
  }

  // --- Smooth lane positions ---
  const laneWidth = G.canvas.width / LANE_COUNT;
  const targetX = laneWidth * (G.lane + 0.5);
  G.animalX += (targetX - G.animalX) * 0.25;
  const oppTargetX = laneWidth * (G.oppLane + 0.5) + 18;
  G.oppX += (oppTargetX - G.oppX) * 0.12;

  // --- Spawn obstacles ---
  G.obstacleTimer -= dt;
  if (G.obstacleTimer <= 0) {
    spawnObstacle();
    if (G.level.id >= 2 && Math.random() < 0.3) spawnObstacle();
    if (G.level.id >= 3 && Math.random() < 0.2) spawnObstacle();
    G.obstacleTimer = G.level.obstacleRate * (0.7 + Math.random() * 0.6);
  }

  // --- Spawn food ---
  G.bonusTimer -= dt;
  if (G.bonusTimer <= 0) {
    spawnBonus();
    G.bonusTimer = G.level.bonusRate * (0.8 + Math.random() * 0.4);
  }

  // --- Collisions ---
  checkCollisions();

  // --- Check dodged ---
  for (const obs of G.obstacles) {
    if (!obs.hit && !obs.dodged && obs.distance < G.playerDistance - COLLISION_RADIUS) {
      obs.dodged = true;
      G.score += SCORE_PER_DODGE;
      G.obstaclesDodged++;
    }
  }

  // --- Cleanup ---
  G.obstacles = G.obstacles.filter(o => o.distance > G.playerDistance - 200);
  G.bonuses = G.bonuses.filter(b => b.distance > G.playerDistance - 200 && !b.collected);

  // --- Update particles ---
  updateParticles(dt);

  // --- Time-based segment switching ---
  G.segElapsed += dt;

  if (G.level.announceTerrain && G.segIdx + 1 < G.segments.length) {
    const timeLeft = currentSegmentDuration() - G.segElapsed;
    if (timeLeft <= 30 && !G.terrainAnnounce) {
      const nextTerrain = G.segments[G.segIdx + 1].terrain;
      G.terrainAnnounce = { terrain: nextTerrain, countdown: timeLeft };
    }
    if (G.terrainAnnounce) {
      G.terrainAnnounce.countdown = timeLeft;
    }
  }

  if (G.segElapsed >= currentSegmentDuration()) {
    G.terrainAnnounce = null;
    if (G.segIdx + 1 < G.segments.length) {
      G.segIdx++;
      G.segElapsed = 0;
      const newTerrain = G.segments[G.segIdx].terrain;
      G.terrainTransitionTimer = 1.0;
      G.opponentAnimal = aiBestAnimal(newTerrain, G.level.animals);
      G.oppMaxStamina = Math.round(G.opponentAnimal.maxStamina * OPP_STAMINA_MULT);
      G.oppMaxHP = Math.round(G.opponentAnimal.maxHP * OPP_HP_MULT);
      G.opponentStamina = G.oppMaxStamina;
      G.opponentHP = G.oppMaxHP;
      G.screen = 'switchAnimal';
      initParticles(newTerrain);
    } else {
      G.finished = true;
      G.playerWon = G.playerDistance >= G.opponentDistance;
      G.endReason = G.playerWon ? 'won_race' : 'lost_race';
      G.score += Math.round(G.playerDistance / 10);
      if (G.playerWon) {
        G.screen = (G.levelIdx + 1 >= LEVELS.length) ? 'gameWon' : 'levelComplete';
        if (G.levelIdx + 1 < LEVELS.length) {
          G.unlockedLevel = Math.max(G.unlockedLevel, G.levelIdx + 1);
        }
      } else {
        G.screen = 'gameOver';
      }
    }
  }
}

// ========== RENDERING HELPERS ==========

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

// Wrap text to fit within maxWidth — returns array of lines
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Draw wrapped text centered at (x, y), returns next y position
function drawWrappedCenter(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = wrapText(ctx, text, maxWidth);
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function drawBar(ctx, x, y, value, max, width, label, colorScheme) {
  const barW = width || 56;
  const barH = 7;
  const bx = x - barW / 2;
  const ratio = Math.max(0, Math.min(1, value / max));

  ctx.fillStyle = '#222';
  roundRect(ctx, bx, y, barW, barH, 3);
  ctx.fill();

  let color;
  if (colorScheme === 'hp') {
    color = ratio > 0.5 ? '#E74C3C' : ratio > 0.25 ? '#F39C12' : '#8B0000';
  } else {
    color = ratio > 0.5 ? '#27AE60' : ratio > 0.25 ? '#F39C12' : '#E74C3C';
  }
  ctx.fillStyle = color;
  roundRect(ctx, bx, y, barW * ratio, barH, 3);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  roundRect(ctx, bx, y, barW, barH, 3);
  ctx.stroke();

  if (label) {
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 3);
    ctx.textAlign = 'left';
  }
}

function drawDualBars(ctx, x, y, stamina, maxStam, hp, maxHP, width, staminaLabel, hpLabel) {
  drawBar(ctx, x, y, stamina, maxStam, width, staminaLabel, 'stamina');
  drawBar(ctx, x, y + 10, hp, maxHP, width, hpLabel, 'hp');
}

// ========== RICH TERRAIN BACKGROUND ==========

function drawTerrainBackground(ctx, terrain, W, H) {
  const info = TERRAINS[terrain];

  const skyGrad = ctx.createLinearGradient(0, HUD_H, 0, H * 0.4 + HUD_H);
  skyGrad.addColorStop(0, info.skyTop);
  skyGrad.addColorStop(1, info.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, HUD_H, W, H - HUD_H);

  const groundGrad = ctx.createLinearGradient(0, H * 0.4 + HUD_H, 0, H);
  groundGrad.addColorStop(0, info.bg);
  groundGrad.addColorStop(0.5, info.mid);
  groundGrad.addColorStop(1, info.dark);
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, H * 0.4 + HUD_H, W, H * 0.6);

  ctx.save();
  ctx.globalAlpha = 0.12;
  const scrollOffset = G.playerDistance % 80;
  for (let y = H * 0.55 - scrollOffset; y < H; y += 80) {
    for (let x = 20; x < W; x += 80) {
      const ox = x + ((y / 80) * 20) % 40;
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.fillText(info.groundEmoji, ox, y);
    }
  }
  ctx.restore();
  ctx.textAlign = 'left';

  drawDecor(ctx, W, H);
  drawParticles(ctx);
}

// ========== HUD (clean, percentage-based layout) ==========

const HUD_H = 78;

function drawHUD(ctx, W) {
  // HUD background
  const hudGrad = ctx.createLinearGradient(0, 0, 0, HUD_H);
  hudGrad.addColorStop(0, '#16213e');
  hudGrad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = hudGrad;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = '#0f3460';
  ctx.fillRect(0, HUD_H - 2, W, 2);

  const t = currentTerrain();
  const terrainInfo = TERRAINS[t];
  const accelFactor = 1.0 + G.levelTime * ACCELERATION_RATE;

  // Column boundaries (percentage-based, responsive)
  const c1 = 8;           // terrain start
  const c1End = W * 0.19; // terrain end
  const c2 = W * 0.20;    // player start
  const c2End = W * 0.52; // player end
  const c3 = W * 0.53;    // opponent start
  const c3End = W * 0.78; // opponent end
  const c4 = W * 0.79;    // progress/controls start
  const c4End = W - 8;    // right edge

  // ── Terrain Panel ──
  ctx.fillStyle = terrainInfo.dark;
  roundRect(ctx, c1, 6, c1End - c1, HUD_H - 14, 8);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(terrainInfo.emoji + ' ' + terrainInfo.name, c1 + 10, 24);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#CCC';
  ctx.fillText('Seg ' + (G.segIdx + 1) + '/' + G.segments.length, c1 + 10, 42);
  const timeLeft = Math.max(0, currentSegmentDuration() - G.segElapsed);
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = timeLeft < 15 ? '#E74C3C' : '#FFD700';
  ctx.fillText('⏱ ' + formatTime(timeLeft), c1 + 10, 58);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#AAA';
  ctx.fillText(G.level.difficulty + ' ×' + accelFactor.toFixed(2), c1 + 10, 68);

  // Terrain announcement (L1 only)
  if (G.terrainAnnounce && G.level.announceTerrain) {
    const ntInfo = TERRAINS[G.terrainAnnounce.terrain];
    ctx.fillStyle = ntInfo.accent;
    roundRect(ctx, c1, HUD_H + 2, c1End - c1, 16, 5);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Next ' + ntInfo.emoji + ' ' + ntInfo.name + ' ' + Math.round(G.terrainAnnounce.countdown) + 's', c1 + 10, HUD_H + 13);
  }

  // ── Player Stats ──
  const pBarW = Math.max(40, Math.min(110, (c2End - c2) * 0.45));
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(G.playerAnimal.emoji + ' ' + G.playerAnimal.name + ' (YOU)', c2 + 6, 20);
  if (G.boosting) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('🔥BOOST', c2 + 6 + ctx.measureText(G.playerAnimal.emoji + ' ' + G.playerAnimal.name + ' (YOU)').width + 3, 20);
  }

  // Speed bar
  const pSpeed = effectiveSpeed(G.playerAnimal, t, G.playerStamina, G.playerHP, G.boosting, accelFactor);
  const maxPossibleSpeed = 10 * SPEED_SCALE * 1.5 * 1.3;
  const speedRatio = Math.min(1, pSpeed / maxPossibleSpeed);
  ctx.fillStyle = '#333';
  roundRect(ctx, c2 + 6, 28, pBarW, 7, 3);
  ctx.fill();
  ctx.fillStyle = speedRatio > 0.5 ? '#27AE60' : speedRatio > 0.2 ? '#F39C12' : '#E74C3C';
  roundRect(ctx, c2 + 6, 28, pBarW * speedRatio, 7, 3);
  ctx.fill();
  ctx.fillStyle = '#AAA';
  ctx.font = '8px sans-serif';
  ctx.fillText('Spd ' + Math.round(pSpeed), c2 + 6 + pBarW + 3, 35);

  // Stamina bar
  const stamRatio = G.playerStamina / G.playerAnimal.maxStamina;
  ctx.fillStyle = '#333';
  roundRect(ctx, c2 + 6, 38, pBarW, 7, 3);
  ctx.fill();
  ctx.fillStyle = stamRatio > 0.5 ? '#27AE60' : stamRatio > 0.25 ? '#F39C12' : '#E74C3C';
  roundRect(ctx, c2 + 6, 38, pBarW * stamRatio, 7, 3);
  ctx.fill();
  ctx.fillStyle = '#AAA';
  ctx.fillText('Sta ' + Math.round(G.playerStamina) + '/' + G.playerAnimal.maxStamina, c2 + 6 + pBarW + 3, 45);

  // HP bar
  const hpRatio = G.playerHP / G.playerAnimal.maxHP;
  ctx.fillStyle = '#333';
  roundRect(ctx, c2 + 6, 48, pBarW, 7, 3);
  ctx.fill();
  ctx.fillStyle = hpRatio > 0.5 ? '#E74C3C' : hpRatio > 0.25 ? '#F39C12' : '#8B0000';
  roundRect(ctx, c2 + 6, 48, pBarW * hpRatio, 7, 3);
  ctx.fill();
  ctx.fillStyle = '#AAA';
  ctx.fillText('HP ' + Math.round(G.playerHP) + '/' + G.playerAnimal.maxHP, c2 + 6 + pBarW + 3, 55);

  // Score + lane
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('Score: ' + G.score, c2 + 6, 66);
  ctx.fillStyle = '#888';
  ctx.font = '9px sans-serif';
  ctx.fillText('Lane ' + (G.lane + 1) + '/3', c2 + 6, HUD_H - 4);

  // ── Opponent Stats ──
  const oBarW = Math.max(40, Math.min(100, (c3End - c3) * 0.45));
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('🤖 ' + G.opponentAnimal.emoji + ' ' + G.opponentAnimal.name, c3 + 6, 20);

  // Opp stamina
  const oppStamRatio = G.opponentStamina / G.oppMaxStamina;
  ctx.fillStyle = '#333';
  roundRect(ctx, c3 + 6, 28, oBarW, 7, 3);
  ctx.fill();
  ctx.fillStyle = oppStamRatio > 0.5 ? '#C0392B' : '#F39C12';
  roundRect(ctx, c3 + 6, 28, oBarW * oppStamRatio, 7, 3);
  ctx.fill();
  ctx.fillStyle = '#AAA';
  ctx.font = '8px sans-serif';
  ctx.fillText('Sta ' + Math.round(G.opponentStamina) + '/' + G.oppMaxStamina, c3 + 6 + oBarW + 3, 35);

  // Opp HP
  const oppHpRatio = G.opponentHP / G.oppMaxHP;
  ctx.fillStyle = '#333';
  roundRect(ctx, c3 + 6, 38, oBarW, 7, 3);
  ctx.fill();
  ctx.fillStyle = oppHpRatio > 0.5 ? '#C0392B' : '#F39C12';
  roundRect(ctx, c3 + 6, 38, oBarW * oppHpRatio, 7, 3);
  ctx.fill();
  ctx.fillStyle = '#AAA';
  ctx.fillText('HP ' + Math.round(G.opponentHP) + '/' + G.oppMaxHP, c3 + 6 + oBarW + 3, 45);

  // Distance comparison
  const delta = Math.round(G.playerDistance - G.opponentDistance);
  ctx.font = 'bold 11px sans-serif';
  if (delta > 0) {
    ctx.fillStyle = '#2ECC71';
    ctx.fillText('▲ Lead ' + delta + 'm', c3 + 6, 56);
  } else if (delta < 0) {
    ctx.fillStyle = '#E74C3C';
    ctx.fillText('▼ Behind ' + Math.abs(delta) + 'm', c3 + 6, 56);
  } else {
    ctx.fillStyle = '#FFD700';
    ctx.fillText('= Tied', c3 + 6, 56);
  }
  ctx.fillStyle = '#888';
  ctx.font = '9px sans-serif';
  ctx.fillText('Lane ' + (G.oppLane + 1) + '/3', c3 + 6, 66);
  ctx.fillText('CPU', c3 + 6, HUD_H - 4);

  // ── Progress + Controls ──
  const progW = c4End - c4 - 90;
  if (progW > 50) {
    ctx.fillStyle = '#333';
    roundRect(ctx, c4 + 6, 8, progW, 10, 4);
    ctx.fill();

    for (let i = 0; i < G.segments.length; i++) {
      const ratio = i / G.segments.length;
      const bx = c4 + 6 + ratio * progW;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, 8);
      ctx.lineTo(bx, 18);
      ctx.stroke();
    }

    const segStart = G.segIdx / G.segments.length;
    const segEnd = (G.segIdx + 1) / G.segments.length;
    ctx.fillStyle = terrainInfo.accent;
    ctx.globalAlpha = 0.4;
    roundRect(ctx, c4 + 6 + segStart * progW, 8, (segEnd - segStart) * progW, 10, 4);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    const segProgress = G.segElapsed / currentSegmentDuration();
    const curX = c4 + 6 + (segStart + (segEnd - segStart) * segProgress) * progW;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(curX, 13, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#888';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Progress', c4 + 6 + progW / 2, 6);
  }

  // Controls box
  const ctrlX = c4End - 82;
  ctx.fillStyle = '#222';
  roundRect(ctx, ctrlX, 24, 82, 48, 6);
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  roundRect(ctx, ctrlX, 24, 82, 48, 6);
  ctx.stroke();
  ctx.fillStyle = '#CCC';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('← → Lane', ctrlX + 41, 38);
  ctx.fillText('↑ Boost', ctrlX + 41, 50);
  ctx.fillText('↑ = 2× drain', ctrlX + 41, 62);

  ctx.textAlign = 'left';
}

// ========== TRACK RENDERING ==========

function drawTrack(ctx, W, H) {
  const t = currentTerrain();
  const laneWidth = W / LANE_COUNT;
  const accelFactor = 1.0 + G.levelTime * ACCELERATION_RATE;
  G.animalScreenY = H * 0.72;

  drawTerrainBackground(ctx, t, W, H);

  // Lane dividers
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 12]);
  for (let i = 1; i < LANE_COUNT; i++) {
    ctx.beginPath();
    ctx.moveTo(i * laneWidth, HUD_H);
    ctx.lineTo(i * laneWidth, H);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Terrain transition flash
  if (G.terrainTransitionTimer > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (G.terrainTransitionTimer * 0.5) + ')';
    ctx.fillRect(0, HUD_H, W, H - HUD_H);
  }

  // --- Draw obstacles ---
  for (const obs of G.obstacles) {
    const screenY = G.animalScreenY - (obs.distance - G.playerDistance);
    if (screenY > HUD_H - 60 && screenY < H + 60) {
      const laneX = laneWidth * (obs.lane + 0.5);
      ctx.globalAlpha = obs.hit ? 0.3 : 1.0;
      // Shadow
      ctx.globalAlpha = obs.hit ? 0.1 : 0.15;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(laneX, screenY + 14, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = obs.hit ? 0.3 : 1.0;
      ctx.font = '36px serif';
      ctx.textAlign = 'center';
      ctx.fillText(obs.emoji, laneX, screenY);
      ctx.globalAlpha = 1.0;
    }
  }

  // --- Draw food ---
  for (const bonus of G.bonuses) {
    if (bonus.collected) continue;
    const screenY = G.animalScreenY - (bonus.distance - G.playerDistance);
    if (screenY > HUD_H - 60 && screenY < H + 60) {
      const laneX = laneWidth * (bonus.lane + 0.5);
      const pulse = 1 + Math.sin(G.animFrame * 0.15) * 0.15;
      ctx.save();
      ctx.translate(laneX, screenY);
      ctx.scale(pulse, pulse);
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = bonus.type === 'hp' ? '#E74C3C' : '#FFD700';
      ctx.shadowBlur = 12;
      ctx.fillText(bonus.emoji, 0, 0);
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  }

  // --- Draw OPPONENT (now in its own lane) ---
  const oppDelta = G.opponentDistance - G.playerDistance;
  const oppScreenY = G.animalScreenY - oppDelta * 0.35;

  if (oppScreenY > HUD_H + 20 && oppScreenY < H - 30) {
    const oppBobY = Math.sin(G.animFrame * 0.25) * 3;

    // Opponent shadow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(G.oppX, oppScreenY + 22, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Opponent emoji (slightly smaller than player)
    ctx.globalAlpha = 0.85;
    ctx.font = '42px serif';
    ctx.textAlign = 'center';
    ctx.fillText(G.opponentAnimal.emoji, G.oppX, oppScreenY + oppBobY);
    ctx.globalAlpha = 1.0;

    // Opponent dual bars
    drawDualBars(ctx, G.oppX, oppScreenY - 35,
      G.opponentStamina, G.oppMaxStamina,
      G.opponentHP, G.oppMaxHP, 46, 'CPU-S', 'CPU-H');

    // CPU label
    ctx.fillStyle = '#E74C3C';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🤖', G.oppX, oppScreenY - 42);
  } else if (oppScreenY <= HUD_H + 20) {
    // Opponent ahead — show arrow indicator
    ctx.fillStyle = '#E74C3C';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲ ' + G.opponentAnimal.emoji + ' ahead', G.oppX, HUD_H + 20);
  } else {
    // Opponent behind — show arrow indicator
    ctx.fillStyle = '#3498DB';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ ' + G.opponentAnimal.emoji + ' behind', G.oppX, H - 15);
  }
  ctx.textAlign = 'left';

  // --- Draw PLAYER ---
  const bobY = Math.sin(G.animFrame * 0.3) * 4;
  const isInv = G.invincible > 0;
  if (isInv && Math.floor(G.animFrame / 4) % 2 === 0) ctx.globalAlpha = 0.4;

  // Player shadow
  ctx.globalAlpha = isInv ? 0.15 : 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(G.animalX, G.animalScreenY + 28, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = isInv && Math.floor(G.animFrame / 4) % 2 === 0 ? 0.4 : 1.0;

  ctx.font = '52px serif';
  ctx.textAlign = 'center';
  ctx.fillText(G.playerAnimal.emoji, G.animalX, G.animalScreenY + bobY);
  ctx.globalAlpha = 1.0;

  // Player dual bars
  drawDualBars(ctx, G.animalX, G.animalScreenY - 45,
    G.playerStamina, G.playerAnimal.maxStamina,
    G.playerHP, G.playerAnimal.maxHP, 56, 'YOU-S', 'YOU-H');

  // "YOU" label above bars
  ctx.fillStyle = '#2ECC71';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('YOU', G.animalX, G.animalScreenY - 52);

  // Boost visual — flames behind animal
  if (G.boosting) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    const flameOffset = Math.sin(G.animFrame * 0.4) * 5;
    ctx.fillText('🔥', G.animalX - 25, G.animalScreenY + flameOffset);
    ctx.fillText('🔥', G.animalX + 25, G.animalScreenY - flameOffset);
    ctx.restore();
  }

  // Speed lines
  const pSpeed = effectiveSpeed(G.playerAnimal, t, G.playerStamina, G.playerHP, G.boosting, accelFactor);
  if (pSpeed > 100) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const lineY = G.animalScreenY - 15 + i * 10;
      ctx.beginPath();
      ctx.moveTo(G.animalX - 30, lineY);
      ctx.lineTo(G.animalX - 30 - pSpeed * 0.08, lineY);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Collision flash
  if (G.collisionFlash > 0) {
    ctx.fillStyle = 'rgba(255, 0, 0, ' + (G.collisionFlash * 0.35) + ')';
    ctx.fillRect(0, HUD_H, W, H - HUD_H);
  }

  // Low HP warning
  const hpRatio = G.playerHP / G.playerAnimal.maxHP;
  if (hpRatio < 0.25) {
    const flash = 0.3 + Math.sin(G.animFrame * 0.2) * 0.2;
    ctx.strokeStyle = 'rgba(231, 76, 60, ' + flash + ')';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, HUD_H + 4, W - 8, H - HUD_H - 8);
  }

  // Low stamina warning
  const stamRatio = G.playerStamina / G.playerAnimal.maxStamina;
  if (stamRatio < 0.2 && hpRatio >= 0.25) {
    const flash = 0.3 + Math.sin(G.animFrame * 0.15) * 0.2;
    ctx.strokeStyle = 'rgba(243, 156, 18, ' + flash + ')';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, HUD_H + 4, W - 8, H - HUD_H - 8);
  }

  ctx.textAlign = 'left';
}

// ========== TITLE SCREEN ==========

function drawTitle(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(0.5, '#16213e');
  grad.addColorStop(1, '#0f3460');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.font = '60px serif';
  ctx.textAlign = 'center';
  ctx.fillText('豹', W * 0.15, H * 0.4);
  ctx.fillText('🐴', W * 0.85, H * 0.35);
  ctx.fillText('🦌', W * 0.1, H * 0.7);
  ctx.fillText('🦊', W * 0.9, H * 0.65);
  ctx.fillText('🦅', W * 0.5, H * 0.05);
  ctx.fillText('🐧', W * 0.3, H * 0.8);
  ctx.fillText('🐺', W * 0.7, H * 0.75);
  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ Animal Dash ⚡', W / 2, H * 0.13);

  ctx.fillStyle = '#BDC3C7';
  ctx.font = '17px sans-serif';
  ctx.fillText('Speed isn\'t everything — adaptation, stamina & HP matter!', W / 2, H * 0.13 + 32);

  ctx.fillStyle = '#ECF0F1';
  ctx.font = '15px sans-serif';
  let fy = H * 0.26;
  const lines = [
    '← → Switch lanes — dodge obstacles, collect food',
    '↑ Hold to boost speed — but stamina drains 2× faster!',
    '❤️ HP (blood) — obstacles reduce it, adapted animals lose less',
    '⚡ Stamina — constantly drains, food restores it',
    '💀 HP = 0 or Stamina = 0 → Game Over!',
    '🤖 Opponent switches lanes too — dodge & collect like you!',
    '⚠️ Adaptation is HIDDEN — discover it by playing!',
    '🏆 3 levels: L1 announces terrain, L2&3 don\'t!'
  ];
  for (const line of lines) {
    ctx.fillText(line, W / 2, fy);
    fy += 24;
  }

  const btnW = 240, btnH = 56;
  const btnX = W / 2 - btnW / 2, btnY = H * 0.76;
  const isHover = G.mouseX >= btnX && G.mouseX <= btnX + btnW && G.mouseY >= btnY && G.mouseY <= btnY + btnH;
  ctx.fillStyle = isHover ? '#2ECC71' : '#27AE60';
  roundRect(ctx, btnX, btnY, btnW, btnH, 12);
  ctx.fill();
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 2;
  roundRect(ctx, btnX, btnY, btnW, btnH, 12);
  ctx.stroke();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('▶ Start Game', W / 2, btnY + 37);

  ctx.fillStyle = '#7F8C8D';
  ctx.font = '13px sans-serif';
  ctx.fillText('Observe → Judge → Switch → Manage stamina & HP → Survive!', W / 2, H - 22);

  ctx.textAlign = 'left';
}

// ========== LEVEL SELECT ==========

function drawLevelSelect(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#0f3460');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ Animal Dash — Select Level', W / 2, 60);

  const cardW = 250, cardH = 230, gap = 20;
  const totalW = LEVELS.length * cardW + (LEVELS.length - 1) * gap;
  const startX = W / 2 - totalW / 2;
  const cardY = 75;

  for (let i = 0; i < LEVELS.length; i++) {
    const lv = LEVELS[i];
    const cx = startX + i * (cardW + gap);
    const isUnlocked = i <= G.unlockedLevel;
    const isHover = G.mouseX >= cx && G.mouseX <= cx + cardW && G.mouseY >= cardY && G.mouseY <= cardY + cardH;

    ctx.fillStyle = !isUnlocked ? '#2C3E50' : isHover ? '#2980B9' : '#1a1a2e';
    ctx.strokeStyle = isHover ? '#FFD700' : '#555';
    ctx.lineWidth = isHover ? 3 : 1;
    roundRect(ctx, cx, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    if (!isUnlocked) ctx.globalAlpha = 0.4;

    const diffColors = { 'Easy': '#27AE60', 'Medium': '#F39C12', 'Hard': '#E74C3C' };
    ctx.fillStyle = diffColors[lv.difficulty];
    roundRect(ctx, cx + 10, cardY + 10, 70, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lv.difficulty, cx + 45, cardY + 26);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(lv.name, cx + cardW / 2, cardY + 48);

    // Description — wrapped to fit card width
    ctx.fillStyle = '#BDC3C7';
    ctx.font = '12px sans-serif';
    const descY = drawWrappedCenter(ctx, lv.desc, cx + cardW / 2, cardY + 68, cardW - 20, 15);

    let nextY = Math.max(descY, cardY + 85);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = lv.announceTerrain ? '#2ECC71' : '#E74C3C';
    ctx.fillText(lv.announceTerrain ? '✅ Terrain announced' : '❌ No announcement', cx + cardW / 2, nextY);
    nextY += 20;

    ctx.fillStyle = '#ECF0F1';
    ctx.font = '15px sans-serif';
    const terrainsStr = lv.terrains.map(t => TERRAINS[t].emoji).join(' ');
    ctx.fillText(terrainsStr, cx + cardW / 2, nextY);
    nextY += 20;

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#95A5A6';
    ctx.fillText(lv.numSegments + ' segs × ' + (lv.segmentDuration / 60) + ' min', cx + cardW / 2, nextY);
    nextY += 16;
    ctx.fillText(lv.animals.length + ' animals | Obs: ' + (lv.obstacleRate < 2.5 ? 'Dense' : lv.obstacleRate < 3.5 ? 'Normal' : 'Sparse'), cx + cardW / 2, nextY);
    nextY += 16;

    ctx.fillStyle = '#F39C12';
    ctx.font = '10px sans-serif';
    ctx.fillText('🤖 Opp: ' + Math.round(lv.opponentSkill * 100) + '% spd + ' + Math.round(OPP_STAMINA_MULT * 100) + '% sta', cx + cardW / 2, nextY);
    nextY += 10;

    if (isUnlocked) {
      ctx.fillStyle = '#27AE60';
      roundRect(ctx, cx + cardW / 2 - 50, nextY, 100, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('▶ Play', cx + cardW / 2, nextY + 18);
    } else {
      ctx.fillStyle = '#7F8C8D';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('🔒 Locked', cx + cardW / 2, nextY + 15);
    }
    ctx.globalAlpha = 1.0;
  }

  ctx.fillStyle = '#555';
  roundRect(ctx, 20, H - 50, 100, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('← Back', 70, H - 28);
  ctx.textAlign = 'left';
}

// ========== ANIMAL SELECT SCREEN ==========

function drawAnimalSelect(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#0f3460');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ Choose Your Animal', W / 2, 38);

  const firstTerrain = G.segments[0].terrain;
  const ftInfo = TERRAINS[firstTerrain];
  ctx.fillStyle = ftInfo.dark;
  roundRect(ctx, W / 2 - 170, 50, 340, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px sans-serif';
  if (G.level.announceTerrain) {
    ctx.fillText('First terrain: ' + ftInfo.emoji + ' ' + ftInfo.name, W / 2, 68);
  } else {
    ctx.fillText('Starting in: ' + ftInfo.emoji + ' — watch for clues!', W / 2, 68);
  }

  ctx.fillStyle = '#F39C12';
  ctx.font = '12px sans-serif';
  ctx.fillText('⚠️ Adaptation is hidden — discover by playing!', W / 2, 86);

  const n = G.availableAnimals.length;
  const cardW = 185, cardH = 165;
  const cols = Math.min(n, Math.floor((W - 40) / (cardW + 10)));
  const gapX = 10, gapY = 10;
  const startX = W / 2 - (cols * cardW + (cols - 1) * gapX) / 2;
  const startY = 100;

  for (let i = 0; i < n; i++) {
    const a = G.availableAnimals[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * (cardW + gapX);
    const cy = startY + row * (cardH + gapY);
    const isHover = G.hoverAnimal === a.id;

    ctx.fillStyle = isHover ? '#2980B9' : '#2C3E50';
    ctx.strokeStyle = isHover ? '#FFD700' : '#444';
    ctx.lineWidth = isHover ? 2 : 1;
    roundRect(ctx, cx, cy, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(a.emoji + ' ' + a.name, cx + cardW / 2, cy + 20);

    const barW = cardW - 20;
    const barX = cx + 10;

    // Speed bar with label overlaid
    ctx.fillStyle = '#333';
    roundRect(ctx, barX, cy + 28, barW, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#3498DB';
    roundRect(ctx, barX, cy + 28, barW * (a.baseSpeed / 10), 10, 3);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Speed ' + a.baseSpeed, cx + cardW / 2, cy + 36);

    // Stamina bar with label overlaid
    ctx.fillStyle = '#333';
    roundRect(ctx, barX, cy + 42, barW, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#27AE60';
    roundRect(ctx, barX, cy + 42, barW * (a.maxStamina / 100), 10, 3);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('Stamina ' + a.maxStamina, cx + cardW / 2, cy + 50);

    // HP bar with label overlaid
    ctx.fillStyle = '#333';
    roundRect(ctx, barX, cy + 56, barW, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#E74C3C';
    roundRect(ctx, barX, cy + 56, barW * (a.maxHP / 80), 10, 3);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('HP ' + a.maxHP, cx + cardW / 2, cy + 64);

    // Description — wrapped to fit card width
    ctx.textAlign = 'center';
    ctx.fillStyle = '#AAA';
    ctx.font = '9px sans-serif';
    drawWrappedCenter(ctx, a.desc, cx + cardW / 2, cy + 78, cardW - 12, 11);

    ctx.fillStyle = '#27AE60';
    roundRect(ctx, cx + cardW / 2 - 38, cy + cardH - 22, 76, 18, 6);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Select', cx + cardW / 2, cy + cardH - 9);
  }

  ctx.textAlign = 'left';
}

// ========== SWITCH ANIMAL OVERLAY ==========

function drawSwitchAnimal(ctx, W, H) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.fillRect(0, 0, W, H);

  const newTerrain = currentTerrain();
  const ntInfo = TERRAINS[newTerrain];

  ctx.fillStyle = ntInfo.dark;
  roundRect(ctx, W / 2 - 210, 10, 420, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ntInfo.emoji + ' New terrain: ' + ntInfo.name, W / 2, 30);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#ECF0F1';
  ctx.fillText('Pick wisely — adaptation is hidden!', W / 2, 48);

  ctx.fillStyle = '#2C3E50';
  roundRect(ctx, W / 2 - 210, 58, 420, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Current: ' + G.playerAnimal.emoji + ' ' + G.playerAnimal.name +
    '  Stamina: ' + Math.round(G.playerStamina) + '/' + G.playerAnimal.maxStamina +
    '  HP: ' + Math.round(G.playerHP) + '/' + G.playerAnimal.maxHP, W / 2, 74);

  const n = G.availableAnimals.length;
  const cardW = 150, cardH = 145;
  const cols = Math.min(n, Math.floor((W - 30) / (cardW + 6)));
  const gapX = 6, gapY = 6;
  const startX = W / 2 - (cols * cardW + (cols - 1) * gapX) / 2;
  const startY = 90;

  for (let i = 0; i < n; i++) {
    const a = G.availableAnimals[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * (cardW + gapX);
    const cy = startY + row * (cardH + gapY);
    const isHover = G.hoverAnimal === a.id;
    const isCurrent = G.playerAnimal && G.playerAnimal.id === a.id;

    ctx.fillStyle = isCurrent ? '#555' : isHover ? '#2980B9' : '#2C3E50';
    ctx.strokeStyle = isHover ? '#FFD700' : '#444';
    ctx.lineWidth = isHover ? 2 : 1;
    roundRect(ctx, cx, cy, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(a.emoji + ' ' + a.name, cx + cardW / 2, cy + 16);

    // Stats on separate short lines to fit card width
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#BDC3C7';
    ctx.fillText('Spd ' + a.baseSpeed + '  Sta ' + a.maxStamina + '  HP ' + a.maxHP, cx + cardW / 2, cy + 32);

    // Description — wrapped to fit card width
    ctx.fillStyle = '#999';
    ctx.font = '9px sans-serif';
    const descEndY = drawWrappedCenter(ctx, a.desc, cx + cardW / 2, cy + 46, cardW - 10, 11);

    if (isCurrent) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('★ Current', cx + cardW / 2, Math.max(descEndY + 2, cy + 75));
    }

    if (!isCurrent) {
      ctx.fillStyle = '#27AE60';
      roundRect(ctx, cx + cardW / 2 - 32, cy + cardH - 22, 64, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('Switch', cx + cardW / 2, cy + cardH - 9);
    } else {
      ctx.fillStyle = '#555';
      roundRect(ctx, cx + cardW / 2 - 32, cy + cardH - 22, 64, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('Using', cx + cardW / 2, cy + cardH - 9);
    }
  }

  ctx.fillStyle = '#555';
  roundRect(ctx, W / 2 - 110, H - 44, 220, 34, 10);
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  roundRect(ctx, W / 2 - 110, H - 44, 220, 34, 10);
  ctx.stroke();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Keep ' + G.playerAnimal.emoji + ' ' + G.playerAnimal.name, W / 2, H - 22);

  ctx.textAlign = 'left';
}

// ========== LEVEL COMPLETE ==========

function drawLevelComplete(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1A5B1A');
  grad.addColorStop(1, '#27AE60');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('🏆 Level Complete!', W / 2, 90);

  ctx.fillStyle = '#FFF';
  ctx.font = '18px sans-serif';
  ctx.fillText(G.level.name + ' — ' + G.level.difficulty, W / 2, 125);

  ctx.fillStyle = '#ECF0F1';
  ctx.font = '15px sans-serif';
  let reasonText = '';
  if (G.endReason === 'opponent_died') reasonText = 'The opponent died! You outlasted them!';
  else if (G.endReason === 'won_race') reasonText = 'You covered more distance!';
  ctx.fillText(reasonText, W / 2, 155);

  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#CCC';
  ctx.fillText('Time: ' + formatTime(G.totalTime), W / 2, 195);
  ctx.fillText('Score: ' + G.score, W / 2, 218);
  ctx.fillText('Your distance: ' + Math.round(G.playerDistance) + 'm', W / 2, 241);
  ctx.fillText('Opponent distance: ' + Math.round(G.opponentDistance) + 'm', W / 2, 264);
  ctx.fillText('Obstacles dodged: ' + G.obstaclesDodged, W / 2, 287);
  ctx.fillText('Animals used: ' + G.animalsUsed.length, W / 2, 310);
  ctx.fillText('HP: ' + Math.round(G.playerHP) + '/' + G.playerAnimal.maxHP + '  Stamina: ' + Math.round(G.playerStamina) + '/' + G.playerAnimal.maxStamina, W / 2, 333);

  ctx.fillStyle = '#2ECC71';
  roundRect(ctx, W / 2 - 110, 365, 220, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('▶ Next Level', W / 2, 393);

  ctx.fillStyle = '#555';
  roundRect(ctx, W / 2 - 90, 420, 180, 36, 8);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Back to Menu', W / 2, 443);

  ctx.textAlign = 'left';
}

// ========== GAME OVER ==========

function drawGameOver(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#5B1A1A');
  grad.addColorStop(1, '#C0392B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('💀 Game Over', W / 2, 100);

  ctx.fillStyle = '#ECF0F1';
  ctx.font = '16px sans-serif';
  let reasonText = '', adviceText = '';
  if (G.endReason === 'killed') {
    reasonText = 'Your animal took too many hits!';
    adviceText = 'Tip: dodge obstacles! Adapted animals lose less HP.';
  } else if (G.endReason === 'lost_race') {
    reasonText = 'The opponent covered more distance!';
    adviceText = 'Tip: pick animals suited to each terrain! Check stamina & HP.';
  }
  ctx.fillText(reasonText, W / 2, 145);
  ctx.fillStyle = '#F1C40F';
  ctx.font = '14px sans-serif';
  ctx.fillText(adviceText, W / 2, 175);

  ctx.fillStyle = '#BDC3C7';
  ctx.font = '15px sans-serif';
  ctx.fillText('Your distance: ' + Math.round(G.playerDistance) + 'm', W / 2, 210);
  ctx.fillText('Opponent: ' + Math.round(G.opponentDistance) + 'm', W / 2, 235);
  ctx.fillText('Score: ' + G.score, W / 2, 260);
  ctx.fillText('Time: ' + formatTime(G.totalTime), W / 2, 285);
  ctx.fillText('HP: ' + Math.round(G.playerHP) + '  Stamina: ' + Math.round(G.playerStamina), W / 2, 310);

  ctx.fillStyle = '#3498DB';
  roundRect(ctx, W / 2 - 110, 340, 220, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('↻ Retry Level', W / 2, 368);

  ctx.fillStyle = '#555';
  roundRect(ctx, W / 2 - 90, 395, 180, 36, 8);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Back to Menu', W / 2, 418);

  ctx.textAlign = 'left';
}

// ========== GAME WON ==========

function drawGameWon(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(0.5, '#16213e');
  grad.addColorStop(1, '#0f3460');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('🏆 You Won! 🏆', W / 2, 100);

  ctx.fillStyle = '#FFF';
  ctx.font = '20px sans-serif';
  ctx.fillText('All 3 levels conquered!', W / 2, 150);
  ctx.fillText('You mastered animal adaptation & survival!', W / 2, 178);

  ctx.fillStyle = '#ECF0F1';
  ctx.font = '16px sans-serif';
  ctx.fillText('Final Score: ' + G.score, W / 2, 220);
  ctx.fillText('Obstacles dodged: ' + G.obstaclesDodged, W / 2, 245);
  ctx.fillText('Animals used: ' + G.animalsUsed.length + ' species', W / 2, 270);

  ctx.fillStyle = '#27AE60';
  roundRect(ctx, W / 2 - 110, 310, 220, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('▶ Play Again', W / 2, 338);

  ctx.textAlign = 'left';
}

// ========== MAIN RENDER ==========

function render() {
  const ctx = G.ctx;
  const W = G.canvas.width;
  const H = G.canvas.height;
  ctx.clearRect(0, 0, W, H);

  switch (G.screen) {
    case 'title': drawTitle(ctx, W, H); break;
    case 'levelSelect': drawLevelSelect(ctx, W, H); break;
    case 'animalSelect': drawAnimalSelect(ctx, W, H); break;
    case 'playing': drawTrack(ctx, W, H); drawHUD(ctx, W); break;
    case 'switchAnimal': drawTrack(ctx, W, H); drawHUD(ctx, W); drawSwitchAnimal(ctx, W, H); break;
    case 'levelComplete': drawLevelComplete(ctx, W, H); break;
    case 'gameOver': drawGameOver(ctx, W, H); break;
    case 'gameWon': drawGameWon(ctx, W, H); break;
  }
}

// ========== INPUT HANDLING ==========

function handleClick(e) {
  const rect = G.canvas.getBoundingClientRect();
  const scaleX = G.canvas.width / rect.width;
  const scaleY = G.canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const W = G.canvas.width;
  const H = G.canvas.height;

  if (G.screen === 'title') {
    const btnW = 240, btnH = 56;
    const btnX = W / 2 - btnW / 2, btnY = H * 0.76;
    if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
      G.screen = 'levelSelect';
    }
  }

  if (G.screen === 'levelSelect') {
    if (x >= 20 && x <= 120 && y >= H - 50 && y <= H - 16) {
      G.screen = 'title'; return;
    }
    const cardW = 250, cardH = 230, gap = 20;
    const totalW = LEVELS.length * cardW + (LEVELS.length - 1) * gap;
    const startX = W / 2 - totalW / 2;
    const cardY = 75;
    for (let i = 0; i < LEVELS.length; i++) {
      const cx = startX + i * (cardW + gap);
      if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
        if (i <= G.unlockedLevel) initLevel(i);
        return;
      }
    }
  }

  if (G.screen === 'animalSelect') {
    const n = G.availableAnimals.length;
    const cardW = 185, cardH = 165;
    const cols = Math.min(n, Math.floor((W - 40) / (cardW + 10)));
    const gapX = 10, gapY = 10;
    const startX = W / 2 - (cols * cardW + (cols - 1) * gapX) / 2;
    const startY = 100;
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);
      if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH) {
        G.playerAnimal = G.availableAnimals[i];
        startRace();
        return;
      }
    }
  }

  if (G.screen === 'switchAnimal') {
    const n = G.availableAnimals.length;
    const cardW = 150, cardH = 145;
    const cols = Math.min(n, Math.floor((W - 30) / (cardW + 6)));
    const gapX = 6, gapY = 6;
    const startX = W / 2 - (cols * cardW + (cols - 1) * gapX) / 2;
    const startY = 90;
    for (let i = 0; i < n; i++) {
      const a = G.availableAnimals[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);
      if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH) {
        if (a.id !== G.playerAnimal.id) { switchAnimal(a.id); return; }
      }
    }
    if (x >= W / 2 - 110 && x <= W / 2 + 110 && y >= H - 44 && y <= H - 10) {
      G.screen = 'playing'; return;
    }
  }

  if (G.screen === 'levelComplete') {
    if (x >= W / 2 - 110 && x <= W / 2 + 110 && y >= 365 && y <= 409) { initLevel(G.levelIdx + 1); return; }
    if (x >= W / 2 - 90 && x <= W / 2 + 90 && y >= 420 && y <= 456) { G.screen = 'levelSelect'; return; }
  }

  if (G.screen === 'gameOver') {
    if (x >= W / 2 - 110 && x <= W / 2 + 110 && y >= 340 && y <= 384) { initLevel(G.levelIdx); return; }
    if (x >= W / 2 - 90 && x <= W / 2 + 90 && y >= 395 && y <= 431) { G.screen = 'levelSelect'; return; }
  }

  if (G.screen === 'gameWon') {
    if (x >= W / 2 - 110 && x <= W / 2 + 110 && y >= 310 && y <= 354) { G.unlockedLevel = 0; G.screen = 'levelSelect'; return; }
  }
}

function handleMouseMove(e) {
  const rect = G.canvas.getBoundingClientRect();
  const scaleX = G.canvas.width / rect.width;
  const scaleY = G.canvas.height / rect.height;
  G.mouseX = (e.clientX - rect.left) * scaleX;
  G.mouseY = (e.clientY - rect.top) * scaleY;

  if (G.screen === 'animalSelect' || G.screen === 'switchAnimal') {
    G.hoverAnimal = null;
    const n = G.availableAnimals.length;
    const W = G.canvas.width;
    let cardW, cardH, gapX, gapY, startX, startY, cols;

    if (G.screen === 'animalSelect') {
      cardW = 185; cardH = 165; gapX = 10; gapY = 10;
      cols = Math.min(n, Math.floor((W - 40) / (cardW + gapX)));
      startX = W / 2 - (cols * cardW + (cols - 1) * gapX) / 2;
      startY = 100;
    } else {
      cardW = 150; cardH = 145; gapX = 6; gapY = 6;
      cols = Math.min(n, Math.floor((W - 30) / (cardW + gapX)));
      startX = W / 2 - (cols * cardW + (cols - 1) * gapX) / 2;
      startY = 90;
    }

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);
      if (G.mouseX >= cx && G.mouseX <= cx + cardW && G.mouseY >= cy && G.mouseY <= cy + cardH) {
        G.hoverAnimal = G.availableAnimals[i].id;
        break;
      }
    }
  }
}

function handleKeyDown(e) {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
    e.preventDefault();
  }

  G.keysPressed[e.key] = true;

  if (G.screen === 'playing') {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      G.lane = Math.max(0, G.lane - 1);
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      G.lane = Math.min(LANE_COUNT - 1, G.lane + 1);
    }
  }

  if (e.key === 'Enter' || e.key === ' ') {
    if (G.screen === 'title') G.screen = 'levelSelect';
    else if (G.screen === 'switchAnimal') G.screen = 'playing';
    else if (G.screen === 'levelComplete') initLevel(G.levelIdx + 1);
    else if (G.screen === 'gameOver') initLevel(G.levelIdx);
  }
}

function handleKeyUp(e) {
  G.keysPressed[e.key] = false;
}

// ========== GAME LOOP ==========

function gameLoop(timestamp) {
  if (!G.lastTime) G.lastTime = timestamp;
  const dt = Math.min((timestamp - G.lastTime) / 1000, 0.1);
  G.lastTime = timestamp;

  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

// ========== INITIALIZATION ==========

function resizeCanvas() {
  const c = G.canvas;
  c.width = window.innerWidth;
  c.height = window.innerHeight - 56; // subtract nav bar height
  G.animalScreenY = c.height * 0.72;
}

function init() {
  G.canvas = document.getElementById('gameCanvas');
  G.ctx = G.canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  G.canvas.addEventListener('click', handleClick);
  G.canvas.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  G.screen = 'title';
  G.unlockedLevel = 0;
  requestAnimationFrame(gameLoop);
}

window.addEventListener('load', init);
