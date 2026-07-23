/* ============================================================
   Bug Stealth — game engine (Track A: plain JavaScript + Canvas 2D)

   The code is split into clearly labelled regions so a high-school
   student can follow what each part does:

     1.  Constants & helpers
     2.  Game state (environment / player-controlled / calculated)
     3.  Level loading
     4.  Input handling  (player-controlled data)
     5.  Update loop     (system-calculated results)
     6.  Light-beam reflection
     7.  Rendering
     8.  HUD & overlays
     9.  Main loop & boot

   Variable naming follows the system graph:
     insectPatrolPosition, insectMovingSpeed, mirrorReflectionRange,
     itemPlacementJudgementRange, sunlightReflectionPath,
     wallTopDestinationPosition, gameRunningTime
   ============================================================ */

"use strict";

/* ---------- 1. Constants & helpers ---------- */

const W = 1024, H = 640;          // world / canvas size
const PLAYER_SPEED   = 150;       // px / second
const PLAYER_HIDE_SPEED = 70;     // slower while hiding in shadow
const CLIMB_SPEED    = 90;        // px / second while climbing
const ITEM_PICKUP_RADIUS = 28;    // item-placement judgement range (Fixed-Value)
const PLANT_RADIUS    = 36;       // interaction trigger radius
const ITEM_USE_RADIUS = 44;
const INSECT_TOUCH_RADIUS = 22;   // hit detection radius
const MIRROR_HIT_HALF = 35;       // half mirror surface length

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const dist  = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function angDiff(a, b){ // smallest signed difference a-b in [-PI, PI]
  let d = (a - b) % TAU;
  if (d >  Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function pointInRect(px, py, r){ return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }

/* ---------- 2. Game state ---------- */

const game = {
  phase: "menu",     // menu | playing | won | lost
  levelIndex: 0,
  level: null,
  time: 0,           // gameRunningTime (Float) — counts DOWN
  player: null,
  insects: [],
  mirrors: [],
  items: [],
  plant: null,
  sun: null,
  wallTop: null,
  shadowZones: [],
  walls: [],
  lightPath: [],    // sunlightReflectionPath (Vector3 array)
  lightValid: false,
  warning: 0,       // 0..1 red border intensity
  toast: "",        // transient message text
  toastT: 0,
  briefingT: 0,   // level-start mission briefing display timer
  uiHintT: 999,    // key-hint auto-hide timer (999 = never hide)
  uiHintVisible: true,  // key-hint panel visibility
  objExpanded: true,    // objective panel expanded state (default open so players see objectives)
  camera: { ox: 0, oy: 0 }, // right-drag perspective offset
  // plant eating system — when fully grown, the flytrap devours nearby insects
  eatParticles: [],  // visual chomp particles
  // victory finale animation system
  finaleT: 0,           // timer counting up during finale
  finaleInsects: [],    // remaining insects to eat during finale
  finaleNextIdx: 0,     // next insect to release
  finaleReleaseT: 0,    // countdown to release next insect
  finaleDone: false,    // all insects eaten
  finaleDoneT: 0,       // countdown after all eaten
};

/* ---------- 3. Level loading ---------- */

function loadLevel(idx){
  const L = window.LEVELS[idx];
  game.level = L;
  game.levelIndex = idx;
  game.time = L.timeLimit;
  game.phase = "playing";

  // --- Player-controlled data ---
  game.player = {
    x: L.player.x, y: L.player.y, z: 0,
    vx: 0, vy: 0,
    facing: -Math.PI / 2,
    holding: null,           // "water" | "fertilizer" | null
    state: "walk",           // walk | hide | climb
    climbT: 0,               // climb progress 0..1
  };

  // --- Environment data ---
  game.insects = L.insects.map(s => ({
    x: s.patrol[0].x, y: s.patrol[0].y,
    patrol: s.patrol, pi: 0,
    patrolSpeed: s.patrolSpeed,
    diveSpeed: s.diveSpeed,
    detectRadius: s.detectRadius,
    state: "patrol",          // patrol | alert | dive
    alertT: 0,                // seconds in alert before dive
  }));
  game.mirrors = L.mirrors.map(m => ({
    x: m.x, y: m.y,
    baseAngle: m.baseAngle * Math.PI / 180,
    angle: m.baseAngle * Math.PI / 180,  // current rotation
    range: m.range * Math.PI / 180,     // effective mirror reflection range (Float, radians)
    dragging: false,
    dragStart: 0,
  }));
  game.items = L.items.map(it => ({ x: it.x, y: it.y, type: it.type, placed: false, carried: false }));
  game.plant = { x: L.plant.x, y: L.plant.y, required: L.plant.required.slice(),
                 has: { water: false, fertilizer: false, sunlight: false }, growth: 0,
                 eatT: 0, eaten: 0, mouthOpen: 0 };
  game.sun = { x: L.sun.x, y: L.sun.y, angle: L.sun.angle };
  game.wallTop = { x: L.wallTop.x, y: L.wallTop.y, w: L.wallTop.w, h: L.wallTop.h };
  game.shadowZones = L.shadowZones.map(z => ({...z}));
  game.walls = L.walls.map(w => ({...w}));
  game.lightPath = []; game.lightValid = false;
  game.warning = 0; game.toast = ""; game.toastT = 0;
  game.briefingT = 4.0; // show mission briefing for 4 seconds
  game.objExpanded = true;  // mission panel open by default
  game.uiHintT = 999; game.uiHintVisible = true;  // key hints always visible
  game.camera.ox = 0; game.camera.oy = 0;
}

/* ---------- 4. Input handling (player-controlled data) ---------- */

const keys = {};
const mouse = { x: 0, y: 0, down: false, button: 0, dx: 0, dy: 0 };
let mirrorRotateDir = 0;   // -1 = rotate left, +1 = rotate right, 0 = none (mobile buttons)
let touchMode = false;     // true on touch devices

function setupInput(canvas){
  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (k === "e") tryInteract();
    if (k === "escape") togglePause();
    if (k === "tab"){ game.objExpanded = !game.objExpanded; e.preventDefault(); }
    if (k === "h"){ game.uiHintVisible = !game.uiHintVisible; game.uiHintT = game.uiHintVisible ? 999 : 0; }
    if (["a","d","w","s","q"," ","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) e.preventDefault();
  });
  window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left) * (W / r.width);
    const ny = (e.clientY - r.top)  * (H / r.height);
    mouse.dx = nx - mouse.x; mouse.dy = ny - mouse.y;
    mouse.x = nx; mouse.y = ny;
  });
  canvas.addEventListener("mousedown", e => {
    mouse.down = true; mouse.button = e.button;
    if (e.button === 0) startMirrorDrag();
    e.preventDefault();
  });
  window.addEventListener("mouseup", e => {
    if (e.button === 0) endMirrorDrag();
    mouse.down = false;
  });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
}

/* ---- Touch controls for mobile / tablet ---- */

function setupTouchControls(canvas){
  // detect touch capability
  touchMode = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  if (!touchMode) return;
  const tc = document.getElementById("touchControls");
  if (tc) tc.style.display = "block";

  // prevent the whole page from scrolling / zooming on touch
  document.addEventListener("touchmove", e => e.preventDefault(), { passive: false });

  // D-pad + hide buttons: hold to activate
  const dpadBtns = document.querySelectorAll(".dpad .tbtn, .hide-btn");
  dpadBtns.forEach(btn => {
    const k = btn.getAttribute("data-key");
    const press = e => { e.preventDefault(); keys[k] = true; };
    const release = e => { e.preventDefault(); keys[k] = false; };
    btn.addEventListener("touchstart", press,   { passive: false });
    btn.addEventListener("touchend",   release, { passive: false });
    btn.addEventListener("touchcancel",release,{ passive: false });
  });

  // Action buttons
  const actBtns = document.querySelectorAll(".action-pad .tbtn");
  actBtns.forEach(btn => {
    const action = btn.getAttribute("data-action");
    if (action === "interact"){
      btn.addEventListener("touchstart", e => { e.preventDefault(); tryInteract(); }, { passive: false });
    } else if (action === "rotateLeft"){
      btn.addEventListener("touchstart", e => { e.preventDefault(); mirrorRotateDir = -1; }, { passive: false });
      btn.addEventListener("touchend",   e => { e.preventDefault(); mirrorRotateDir = 0; }, { passive: false });
      btn.addEventListener("touchcancel", e => { e.preventDefault(); mirrorRotateDir = 0; }, { passive: false });
    } else if (action === "rotateRight"){
      btn.addEventListener("touchstart", e => { e.preventDefault(); mirrorRotateDir = 1; }, { passive: false });
      btn.addEventListener("touchend",   e => { e.preventDefault(); mirrorRotateDir = 0; }, { passive: false });
      btn.addEventListener("touchcancel", e => { e.preventDefault(); mirrorRotateDir = 0; }, { passive: false });
    } else if (action === "pause"){
      btn.addEventListener("touchstart", e => { e.preventDefault(); togglePause(); }, { passive: false });
    }
  });

  // Canvas touch: tap to select level from menu, drag to rotate mirror
  canvas.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    const x = (t.clientX - r.left) * (W / r.width);
    const y = (t.clientY - r.top)  * (H / r.height);
    mouse.x = x; mouse.y = y;

    if (game.phase === "menu"){
      // tap a level button on canvas
      for (let i = 0; i < window.LEVELS.length; i++){
        const bx = W/2 - 180 + i * 180;
        if (x > bx && x < bx + 160 && y > H/2 + 70 && y < H/2 + 110){
          loadLevel(i); return;
        }
      }
    } else if (game.phase === "won" || game.phase === "lost"){
      // tap to retry
      loadLevel(game.levelIndex);
    } else if (game.phase === "playing"){
      // try to grab a mirror for drag-rotation
      mouse.down = true; mouse.button = 0;
      startMirrorDrag();
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", e => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    const nx = (t.clientX - r.left) * (W / r.width);
    const ny = (t.clientY - r.top)  * (H / r.height);
    mouse.dx = nx - mouse.x; mouse.dy = ny - mouse.y;
    mouse.x = nx; mouse.y = ny;
  }, { passive: false });

  canvas.addEventListener("touchend", e => {
    e.preventDefault();
    mouse.down = false;
    endMirrorDrag();
  }, { passive: false });
}

function togglePause(){
  if (game.phase === "playing") game.phase = "paused";
  else if (game.phase === "paused") game.phase = "playing";
  // cannot pause during finale
}

/* Mirror rotation: mouse-left-drag nearest mirror */
let dragMirror = null;
function startMirrorDrag(){
  if (game.phase !== "playing") return;
  let best = null, bd = 999;
  for (const m of game.mirrors){
    const d = dist(mouse.x, mouse.y, m.x, m.y);
    if (d < 48 && d < bd){ best = m; bd = d; }
  }
  if (best){ dragMirror = best; best.dragging = true; best.dragStart = best.angle; }
}
function endMirrorDrag(){ if (dragMirror){ dragMirror.dragging = false; dragMirror = null; } }

/* E key: pick up / place / drop */
function tryInteract(){
  if (game.phase !== "playing") return;
  const p = game.player;
  if (!p.holding){
    // try to pick up nearest item
    for (const it of game.items){
      if (it.carried || it.placed) continue;
      if (dist(p.x, p.y, it.x, it.y) < ITEM_PICKUP_RADIUS){
        it.carried = true; p.holding = it.type;
        showToast("Picked up " + it.type);
        return;
      }
    }
  } else {
    // holding something — try to place on plant
    const pl = game.plant;
    if (dist(p.x, p.y, pl.x, pl.y) < ITEM_USE_RADIUS){
      const it = game.items.find(i => i.type === p.holding && i.carried);
      if (it){
        it.placed = true; it.carried = false;
        pl.has[p.holding] = true;
        showToast("Placed " + p.holding + " on the plant");
        p.holding = null;
        recalcPlantGrowth();
      }
    } else {
      // drop back on the ground where the player stands
      const it = game.items.find(i => i.type === p.holding && i.carried);
      if (it){ it.carried = false; it.x = p.x; it.y = p.y; p.holding = null; showToast("Dropped " + it.type); }
    }
  }
}

function showToast(t){ game.toast = t; game.toastT = 2.0; }

/* ---------- 5. Update loop (system-calculated results) ---------- */

function update(dt){
  if (game.phase === "finale"){
    updateFinale(dt);
    return;
  }
  if (game.phase !== "playing") return;

  // timer
  game.time -= dt;
  if (game.time <= 0){ game.time = 0; lose("Time ran out."); return; }

  updatePlayer(dt);
  updateInsects(dt);
  updatePlantEating(dt);
  updateMirrors();
  updateLightBeam();
  recalcPlantGrowth();
  checkCollisions();
  checkWin();

  if (game.toastT > 0) game.toastT -= dt;
  if (game.briefingT > 0) game.briefingT -= dt;
  if (game.uiHintT > 0 && game.uiHintT < 999){ game.uiHintT -= dt; if (game.uiHintT <= 0) game.uiHintVisible = false; }

  // clear mouse delta at the very end so all subsystems can read it
  mouse.dx = 0; mouse.dy = 0;
}

function updatePlayer(dt){
  const p = game.player;
  if (p.state === "climb"){
    p.climbT += dt;
    if (p.climbT >= 1.0){ /* handled in checkWin */ }
    return;
  }

  // movement — WASD or Arrow keys
  let mx = 0, my = 0;
  if (keys["a"] || keys["arrowleft"])  mx -= 1;
  if (keys["d"] || keys["arrowright"]) mx += 1;
  if (keys["w"] || keys["arrowup"])    my -= 1;
  if (keys["s"] || keys["arrowdown"])  my += 1;       // S / ↓ = move down only

  // hiding in shadow (Q = crouch/hide, separate from movement)
  let inShadow = false;
  for (const z of game.shadowZones){ if (pointInRect(p.x, p.y, z)){ inShadow = true; break; } }
  const wantHide = keys["q"] && inShadow;
  p.state = wantHide ? "hide" : "walk";

  const sp = wantHide ? PLAYER_HIDE_SPEED : PLAYER_SPEED;
  if (mx || my){
    const len = Math.hypot(mx, my); mx /= len; my /= len;
    p.facing = Math.atan2(my, mx);
    const nx = p.x + mx * sp * dt;
    const ny = p.y + my * sp * dt;
    if (!hitsWall(nx, p.y)) p.x = nx;
    if (!hitsWall(p.x, ny)) p.y = ny;
    p.x = clamp(p.x, 16, W - 16);
    p.y = clamp(p.y, 16, H - 16);
  }

  // start climbing when pressing W/↑ adjacent to a fully-grown plant
  if ((keys["w"] || keys["arrowup"]) && plantFullyGrown()){
    const pl = game.plant;
    if (dist(p.x, p.y, pl.x, pl.y) < PLANT_RADIUS + 10){
      p.state = "climb"; p.climbT = 0;
    }
  }

  // camera right-drag
  if (mouse.down && mouse.button === 2){
    game.camera.ox = clamp(game.camera.ox + mouse.dx * 0.5, -120, 120);
    game.camera.oy = clamp(game.camera.oy + mouse.dy * 0.5, -80, 80);
  }
}

function hitsWall(x, y){
  for (const w of game.walls){
    if (x > w.x - 12 && x < w.x + w.w + 12 && y > w.y - 12 && y < w.y + w.h + 12) return true;
  }
  return false;
}

function updateInsects(dt){
  const p = game.player;
  let anyAlert = false;
  for (const ins of game.insects){
    const d = dist(ins.x, ins.y, p.x, p.y);
    const playerHidden = (p.state === "hide");
    const canSee = d < ins.detectRadius && !playerHidden;

    if (ins.state === "patrol"){
      if (canSee){ ins.state = "alert"; ins.alertT = 0; anyAlert = true; }
      else moveAlongPatrol(ins, dt);
    } else if (ins.state === "alert"){
      anyAlert = true;
      ins.alertT += dt;
      if (!canSee){ ins.state = "patrol"; }
      else if (ins.alertT > 0.7){ ins.state = "dive"; }
    } else if (ins.state === "dive"){
      anyAlert = true;
      // head straight for the player
      const a = Math.atan2(p.y - ins.y, p.x - ins.x);
      ins.x += Math.cos(a) * ins.diveSpeed * dt;
      ins.y += Math.sin(a) * ins.diveSpeed * dt;
      if (!canSee && d > ins.detectRadius * 1.6){ ins.state = "patrol"; }
    }
  }
  // red warning border intensity
  const target = anyAlert ? 1 : 0;
  game.warning = lerp(game.warning, target, dt * 6);
}

function moveAlongPatrol(ins, dt){
  const tgt = ins.patrol[(ins.pi + 1) % ins.patrol.length];
  const a = Math.atan2(tgt.y - ins.y, tgt.x - ins.x);
  ins.x += Math.cos(a) * ins.patrolSpeed * dt;
  ins.y += Math.sin(a) * ins.patrolSpeed * dt;
  if (dist(ins.x, ins.y, tgt.x, tgt.y) < 6) ins.pi = (ins.pi + 1) % ins.patrol.length;
}

/* ---- Plant eating: fully-grown flytrap devours nearby insects ---- */
const PLANT_EAT_RADIUS = 50;       // how close an insect must be to get eaten
const PLANT_EAT_RANGE = 130;      // detection/lure range — insects within this are drawn toward the plant
const PLANT_EAT_DURATION = 0.6;   // seconds the chomp animation lasts

function updatePlantEating(dt){
  const pl = game.plant;
  if (!pl) return;

  // decay eat timer & mouth animation
  if (pl.eatT > 0) pl.eatT -= dt;
  if (pl.mouthOpen > 0) pl.mouthOpen -= dt * 1.5; // mouth closes after chomp

  // decay particles
  for (let i = game.eatParticles.length - 1; i >= 0; i--){
    const p = game.eatParticles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 80 * dt;  // gravity
    if (p.life <= 0) game.eatParticles.splice(i, 1);
  }

  // only eat when fully grown
  if (!plantFullyGrown()) return;

  // check each insect — eat if within eat radius, lure if within lure range
  for (let i = game.insects.length - 1; i >= 0; i--){
    const ins = game.insects[i];
    const d = dist(ins.x, ins.y, pl.x, pl.y);

    if (d < PLANT_EAT_RADIUS){
      // CHOMP! — remove the insect and trigger animation
      game.insects.splice(i, 1);
      pl.eatT = PLANT_EAT_DURATION;
      pl.mouthOpen = 1.0;
      pl.eaten++;
      spawnEatParticles(ins.x, ins.y, pl.x, pl.y);
      showToast("The flycatcher devoured an insect! (" + pl.eaten + " eaten)");
    } else if (d < PLANT_EAT_RANGE){
      // lure — gradually pull the insect toward the plant (irresistible nectar scent)
      const pullStrength = 0.4 * (1 - d / PLANT_EAT_RANGE);
      const a = Math.atan2(pl.y - ins.y, pl.x - ins.x);
      ins.x += Math.cos(a) * ins.patrolSpeed * pullStrength * dt * 2;
      ins.y += Math.sin(a) * ins.patrolSpeed * pullStrength * dt * 2;
    }
  }
}

function spawnEatParticles(ix, iy, px, py){
  // dark green sap + red mist burst as the insect is consumed
  for (let i = 0; i < 14; i++){
    const a = Math.random() * TAU;
    const sp = 30 + Math.random() * 60;
    const colors = ["rgba(100,200,60,0.8)", "rgba(140,240,80,0.6)", "rgba(200,80,60,0.5)"];
    game.eatParticles.push({
      x: ix + (Math.random() - 0.5) * 8,
      y: iy + (Math.random() - 0.5) * 8,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 30,
      life: 0.5 + Math.random() * 0.4,
      maxLife: 0.9,
      r: 1.5 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function updateMirrors(){
  if (dragMirror){
    // rotate based on horizontal mouse movement while dragging
    const delta = (mouse.dx || 0) * 0.012;
    dragMirror.angle = clamp(dragMirror.angle + delta,
                             dragMirror.baseAngle - dragMirror.range - 0.4,
                             dragMirror.baseAngle + dragMirror.range + 0.4);
  }
  // mobile: continuous rotation via on-screen buttons
  if (mirrorRotateDir !== 0 && !dragMirror){
    // find nearest mirror to player for rotation
    const p = game.player;
    let best = null, bd = 80;
    for (const m of game.mirrors){
      const d = dist(p.x, p.y, m.x, m.y);
      if (d < bd){ best = m; bd = d; }
    }
    if (best){
      best.angle = clamp(best.angle + mirrorRotateDir * 0.035,
                         best.baseAngle - best.range - 0.4,
                         best.baseAngle + best.range + 0.4);
    }
  }
}

/* ---------- 6. Light-beam reflection ---------- */

function updateLightBeam(){
  const sun = game.sun;
  let origin = { x: sun.x, y: sun.y };
  let dir = { x: Math.cos(sun.angle), y: Math.sin(sun.angle) };
  const path = [{ x: origin.x, y: origin.y }];
  const used = new Set();
  let valid = false;

  for (let bounce = 0; bounce < 8; bounce++){
    // find nearest mirror hit
    let best = null, bestT = Infinity, bestPt = null;
    for (let i = 0; i < game.mirrors.length; i++){
      if (used.has(i)) continue;
      const m = game.mirrors[i];
      const hit = rayHitMirror(origin, dir, m);
      if (hit && hit.t > 1 && hit.t < bestT){ best = i; bestT = hit.t; bestPt = hit.pt; }
    }
    // also test hit on plant
    const plantHit = rayHitCircle(origin, dir, game.plant.x, game.plant.y, 26);

    if (best !== null && (plantHit === null || bestT < plantHit.t)){
      // reflect off this mirror
      const m = game.mirrors[best];
      path.push({ x: bestPt.x, y: bestPt.y });
      used.add(best);
      // normal = perpendicular to mirror surface = (-sin, cos)
      const nx = -Math.sin(m.angle), ny = Math.cos(m.angle);
      // reflected = dir - 2*(dir*n)*n
      const dot = dir.x * nx + dir.y * ny;
      const rx = dir.x - 2 * dot * nx;
      const ry = dir.y - 2 * dot * ny;
      origin = { x: bestPt.x + rx * 2, y: bestPt.y + ry * 2 };
      dir = { x: rx, y: ry };
    } else if (plantHit !== null){
      path.push({ x: plantHit.pt.x, y: plantHit.pt.y });
      valid = true;
      break;
    } else {
      // ray escapes — extend off screen
      path.push({ x: origin.x + dir.x * 1200, y: origin.y + dir.y * 1200 });
      valid = false;
      break;
    }
  }

  game.lightPath = path;
  game.lightValid = valid;
  game.plant.has.sunlight = valid;
}

function rayHitMirror(o, d, m){
  // m.angle = mirror SURFACE direction (matches what is drawn on screen)
  // surface goes from (m - t*half) to (m + t*half) where t = (cos, sin)
  const tx = Math.cos(m.angle), ty = Math.sin(m.angle);
  const ax = m.x - tx * MIRROR_HIT_HALF, ay = m.y - ty * MIRROR_HIT_HALF;
  const bx = m.x + tx * MIRROR_HIT_HALF, by = m.y + ty * MIRROR_HIT_HALF;
  return raySeg(o, d, ax, ay, bx, by);
}

function raySeg(o, d, ax, ay, bx, by){
  const rdx = d.x, rdy = d.y;
  const sdx = bx - ax, sdy = by - ay;
  const denom = rdx * sdy - rdy * sdx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((ax - o.x) * sdy - (ay - o.y) * sdx) / denom;
  const u = ((ax - o.x) * rdy - (ay - o.y) * rdx) / denom;
  if (t > 0 && u >= 0 && u <= 1) return { t, pt: { x: o.x + rdx * t, y: o.y + rdy * t } };
  return null;
}

function rayHitCircle(o, d, cx, cy, r){
  const ox = o.x - cx, oy = o.y - cy;
  const b = ox * d.x + oy * d.y;
  const c = ox * ox + oy * oy - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t <= 0) return null;
  return { t, pt: { x: o.x + d.x * t, y: o.y + d.y * t } };
}

/* ---------- Plant growth & win/lose ---------- */

function recalcPlantGrowth(){
  const pl = game.plant;
  let g = 0;
  if (pl.has.water) g++;
  if (pl.has.fertilizer) g++;
  if (pl.has.sunlight) g++;
  pl.growth = g;
}
function plantFullyGrown(){
  const pl = game.plant;
  return pl.required.every(r => pl.has[r]);
}

function checkCollisions(){
  const p = game.player;
  if (p.state === "hide") return;  // hiding in shadow = safe from insect contact
  for (const ins of game.insects){
    if (dist(ins.x, ins.y, p.x, p.y) < INSECT_TOUCH_RADIUS){
      lose("An insect touched you!");
      return;
    }
  }
}

function checkWin(){
  const p = game.player;
  if (p.state === "climb" && p.climbT >= 1.0){
    // reached the top?
    if (plantFullyGrown()){
      // animate moving to wall top
      p.x = lerp(p.x, game.wallTop.x + game.wallTop.w / 2, 0.1);
      p.y = lerp(p.y, game.wallTop.y + game.wallTop.h / 2, 0.1);
      if (dist(p.x, p.y, game.wallTop.x + game.wallTop.w/2, game.wallTop.y + game.wallTop.h/2) < 20){
        win();
      }
    }
  }
  // reaching wall top without meeting placement requirements = game over (per system graph)
  if (p.state !== "climb" && pointInRect(p.x, p.y, game.wallTop)){
    if (!plantFullyGrown()) lose("You reached the top without finishing the plant.");
  }
}

function win(){
  // Start the victory finale animation: plant eats all remaining insects
  game.phase = "finale";
  game.finaleT = 0;
  game.finaleNextIdx = 0;
  game.finaleReleaseT = 1.2;  // delay before first insect flies to plant
  game.finaleDone = false;
  // snapshot remaining insects for the finale
  game.finaleInsects = game.insects.map(ins => ({
    x: ins.x, y: ins.y,
    startX: ins.x, startY: ins.y,
    released: false,
    eaten: false,
    flyT: 0,
    patrolSpeed: ins.patrolSpeed,
  }));
  // clear normal insects so they don't move during finale
  game.insects = [];
}
function lose(reason){ game.phase = "lost"; game._loseReason = reason; }

/* ---- Victory Finale: plant grows big and eats all remaining insects ---- */
function updateFinale(dt){
  const pl = game.plant;
  game.finaleT += dt;

  // decay eat particles (same as normal)
  for (let i = game.eatParticles.length - 1; i >= 0; i--){
    const p = game.eatParticles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 80 * dt;
    if (p.life <= 0) game.eatParticles.splice(i, 1);
  }
  // decay plant mouth animation
  if (pl.eatT > 0) pl.eatT -= dt;
  if (pl.mouthOpen > 0) pl.mouthOpen -= dt * 1.5;

  // Phase 1: grow (0 - 1.2s) — plant swells, mouth opens wide
  if (game.finaleT < 1.2){
    // keep mouth wide open during grow phase
    pl.mouthOpen = Math.max(pl.mouthOpen, 0.9);
  }

  // Phase 1: grow (0 - 1.2s) — plant swells, mouth opens wide
  // Phase 2: release insects one by one
  // Phase 3: all eaten → transition to "won"

  // release timer
  if (game.finaleNextIdx < game.finaleInsects.length){
    game.finaleReleaseT -= dt;
    if (game.finaleReleaseT <= 0){
      // release next insect
      const ins = game.finaleInsects[game.finaleNextIdx];
      if (ins && !ins.eaten){
        ins.released = true;
        ins.flyT = 0;
      }
      game.finaleNextIdx++;
      game.finaleReleaseT = 1.0 + Math.random() * 0.4;  // next release delay
    }
  }

  // move released insects toward the plant
  let allEaten = true;
  for (const ins of game.finaleInsects){
    if (ins.eaten) continue;
    allEaten = false;
    if (ins.released){
      ins.flyT += dt;
      // accelerate toward plant — dramatic dive
      const speed = 200 + ins.flyT * 250;
      const a = Math.atan2(pl.y - ins.y, pl.x - ins.x);
      ins.x += Math.cos(a) * speed * dt;
      ins.y += Math.sin(a) * speed * dt;

      // check if reached plant mouth
      const d = dist(ins.x, ins.y, pl.x, pl.y);
      if (d < 35){
        ins.eaten = true;
        pl.eatT = 0.6;
        pl.mouthOpen = 1.0;
        pl.eaten++;
        spawnEatParticles(ins.x, ins.y, pl.x, pl.y);
      }
    } else {
      allEaten = false;
    }
  }

  // check: all insects eaten?
  if (allEaten && game.finaleNextIdx >= game.finaleInsects.length){
    if (!game.finaleDone){
      game.finaleDone = true;
      game.finaleDoneT = 1.8;  // wait 1.8s after last insect before victory screen
    }
    game.finaleDoneT -= dt;
    if (game.finaleDoneT <= 0){
      game.phase = "won";
    }
  }
}

/* ---------- 7. Rendering — refined dark-mossy style (v1 enhanced) ----------
   Dark mossy ground, deep shadows, golden light beams, warm characters.
   Original palette with richer gradients, texture detail, layered glow.
   --------------------------------------------------------------------- */

let ctx;
let _frameCount = 0;
let _sparkles = [];   // light-beam sparkle particles

function render(){
  const c = document.getElementById("game");
  ctx = ctx || c.getContext("2d");
  _frameCount++;
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  if (game.level){
    ctx.translate(game.camera.ox, game.camera.oy);

    drawGround();
    drawShadowZones();
    drawWalls();
    drawSun();
    drawLightBeam();
    drawItems();
    drawPlant();
    drawMirrors();
    drawWallTop();

    if (game.phase === "finale"){
      drawFinaleInsects();
      drawEatParticles();
    } else {
      drawInsects();
    }

    drawPlayer();
    drawSparkles();

    ctx.restore();

    if (game.phase === "finale"){
      drawFinaleOverlay();
    } else {
      drawHUD();
      drawKeyHints();
      drawObjectivePanel();
    }
  } else {
    ctx.restore();
  }

  drawOverlays();
}

/* ---- Ground: dark mossy floor with gradient + scattered detail ---- */
function drawGround(){
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1e281e");
  g.addColorStop(0.5, "#1a221a");
  g.addColorStop(1, "#141a12");
  ctx.fillStyle = g;
  ctx.fillRect(-200, -200, W + 400, H + 400);

  // subtle moss specks — deterministic scatter
  for (let i = 0; i < 90; i++){
    const x = (i * 137.5) % W;
    const y = (i * 89.3 + 17) % H;
    const sz = 1 + (i % 3);
    ctx.fillStyle = (i % 5 === 0)
      ? "rgba(90,110,60,0.12)"
      : "rgba(60,75,45,0.08)";
    ctx.fillRect(x, y, sz, sz);
  }

  // faint scattered pebbles — small ellipses with highlight
  for (let i = 0; i < 20; i++){
    const x = (i * 211.7 + 30) % W;
    const y = (i * 157.3 + 50) % H;
    ctx.fillStyle = "rgba(40,38,32,0.5)";
    ctx.beginPath();
    ctx.ellipse(x, y, 3, 2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(70,65,50,0.3)";
    ctx.beginPath();
    ctx.ellipse(x - 0.5, y - 0.5, 1.5, 1, 0, 0, TAU);
    ctx.fill();
  }
}

/* ---- Shadow zones: deep dark voids with soft edges ---- */
function drawShadowZones(){
  for (const z of game.shadowZones){
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    const rad = Math.max(z.w, z.h) / 1.3;
    const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, rad);
    g.addColorStop(0, "rgba(0,0,0,0.78)");
    g.addColorStop(0.5, "rgba(0,0,0,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(z.x - 20, z.y - 20, z.w + 40, z.h + 40);
    // subtle cool tint at center
    const t = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad * 0.4);
    t.addColorStop(0, "rgba(15,20,30,0.2)");
    t.addColorStop(1, "rgba(15,20,30,0)");
    ctx.fillStyle = t;
    ctx.fillRect(z.x - 10, z.y - 10, z.w + 20, z.h + 20);
  }
}

/* ---- Walls: dark stone with gradient + brick texture + shadow ---- */
function drawWalls(){
  for (const w of game.walls){
    // drop shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(w.x + 3, w.y + 4, w.w, w.h);
    // body — dark stone gradient
    const g = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
    g.addColorStop(0, "#332e26");
    g.addColorStop(0.5, "#2a2620");
    g.addColorStop(1, "#1e1a14");
    ctx.fillStyle = g;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    // top highlight
    ctx.fillStyle = "rgba(80,72,55,0.35)";
    ctx.fillRect(w.x, w.y, w.w, 2);
    // brick lines
    ctx.strokeStyle = "rgba(20,18,14,0.6)";
    ctx.lineWidth = 1;
    for (let by = w.y + 14; by < w.y + w.h; by += 14){
      ctx.beginPath();
      ctx.moveTo(w.x, by);
      ctx.lineTo(w.x + w.w, by);
      ctx.stroke();
      // offset vertical lines for staggered brick pattern
      const row = Math.floor((by - w.y) / 14);
      const ox = (row % 2 === 0) ? 0 : 20;
      for (let bx = w.x + ox; bx < w.x + w.w; bx += 40){
        ctx.beginPath();
        ctx.moveTo(bx, by - 14);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }
    // edge
    ctx.strokeStyle = "rgba(12,10,8,0.8)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  }
}

/* ---- Sun: warm glowing orb with corona + bloom ---- */
function drawSun(){
  const s = game.sun;
  const t = performance.now() / 1000;
  ctx.save();
  ctx.translate(s.x, s.y);
  const pulse = 1 + 0.07 * Math.sin(t * 1.5);

  // outer bloom
  const bloom = ctx.createRadialGradient(0, 0, 3, 0, 0, 48 * pulse);
  bloom.addColorStop(0, "rgba(255,210,90,0.3)");
  bloom.addColorStop(0.4, "rgba(255,180,60,0.12)");
  bloom.addColorStop(1, "rgba(255,160,40,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(-55, -55, 110, 110);

  // corona rays
  ctx.strokeStyle = "rgba(255,200,80,0.2)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++){
    const a = i * Math.PI / 4 + t * 0.12;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
    ctx.lineTo(Math.cos(a) * 28 * pulse, Math.sin(a) * 28 * pulse);
    ctx.stroke();
  }

  // core — bright warm gradient
  const core = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
  core.addColorStop(0, "rgba(255,248,210,1)");
  core.addColorStop(0.5, "rgba(255,215,110,0.95)");
  core.addColorStop(1, "rgba(240,185,70,0.2)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, 13 * pulse, 0, TAU);
  ctx.fill();

  // bright center dot
  ctx.fillStyle = "rgba(255,255,240,0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, TAU);
  ctx.fill();

  ctx.restore();
}

/* ---- Light beam: layered glow + bright core + sparkles ---- */
function drawLightBeam(){
  if (game.lightPath.length < 2) return;
  const t = performance.now() / 1000;
  ctx.save();
  ctx.lineCap = "round";

  // wide outer glow
  ctx.strokeStyle = game.lightValid
    ? "rgba(255,215,90,0.14)"
    : "rgba(180,160,60,0.06)";
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.moveTo(game.lightPath[0].x, game.lightPath[0].y);
  for (let i = 1; i < game.lightPath.length; i++)
    ctx.lineTo(game.lightPath[i].x, game.lightPath[i].y);
  ctx.stroke();

  // mid glow
  ctx.strokeStyle = game.lightValid
    ? "rgba(255,225,120,0.28)"
    : "rgba(180,170,70,0.1)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(game.lightPath[0].x, game.lightPath[0].y);
  for (let i = 1; i < game.lightPath.length; i++)
    ctx.lineTo(game.lightPath[i].x, game.lightPath[i].y);
  ctx.stroke();

  // bright core
  ctx.strokeStyle = game.lightValid
    ? "rgba(255,245,180,0.95)"
    : "rgba(160,150,80,0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(game.lightPath[0].x, game.lightPath[0].y);
  for (let i = 1; i < game.lightPath.length; i++)
    ctx.lineTo(game.lightPath[i].x, game.lightPath[i].y);
  ctx.stroke();

  // spawn sparkles along beam when valid
  if (game.lightValid && _frameCount % 3 === 0){
    for (let i = 0; i < game.lightPath.length - 1; i++){
      const p1 = game.lightPath[i], p2 = game.lightPath[i + 1];
      const f = Math.random();
      _sparkles.push({
        x: p1.x + (p2.x - p1.x) * f,
        y: p1.y + (p2.y - p1.y) * f,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        r: 0.8 + Math.random() * 1.2,
      });
    }
  }

  ctx.restore();
}

/* ---- Sparkles: tiny golden motes drifting along the beam ---- */
function drawSparkles(){
  const dt = 0.016;
  ctx.save();
  for (let i = _sparkles.length - 1; i >= 0; i--){
    const s = _sparkles[i];
    s.life -= dt;
    s.y -= 8 * dt;
    if (s.life <= 0){ _sparkles.splice(i, 1); continue; }
    const a = clamp(s.life / s.maxLife, 0, 1);
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = "rgba(255,240,160,1)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ---- Items: floating pickups with glow + detail ---- */
function drawItems(){
  const t = performance.now() / 1000;
  for (const it of game.items){
    if (it.carried || it.placed) continue;
    const float = Math.sin(t * 2.5 + it.x * 0.01) * 2.5;
    ctx.save();
    ctx.translate(it.x, it.y + float);

    if (it.type === "water"){
      // soft glow
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
      g.addColorStop(0, "rgba(70,160,210,0.22)");
      g.addColorStop(1, "rgba(70,160,210,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-18, -18, 36, 36);
      // bottle body — deep blue
      const bg = ctx.createLinearGradient(-8, 0, 8, 0);
      bg.addColorStop(0, "#2a5a78");
      bg.addColorStop(0.5, "#3a7a9a");
      bg.addColorStop(1, "#2a5a78");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 10, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#1a3a4a";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // cap — dark metal
      ctx.fillStyle = "#3a4048";
      ctx.fillRect(-3, -14, 6, 5);
      ctx.strokeStyle = "#1a1e22";
      ctx.lineWidth = 1;
      ctx.strokeRect(-3, -14, 6, 5);
      // shine
      ctx.fillStyle = "rgba(160,210,240,0.5)";
      ctx.beginPath();
      ctx.ellipse(-3, -3, 1.5, 4, 0.3, 0, TAU);
      ctx.fill();
      // small highlight dot
      ctx.fillStyle = "rgba(200,230,250,0.6)";
      ctx.beginPath();
      ctx.arc(-4, -4, 1, 0, TAU);
      ctx.fill();
    } else {
      // fertilizer bag — warm earthy
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
      g.addColorStop(0, "rgba(180,140,60,0.18)");
      g.addColorStop(1, "rgba(180,140,60,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-18, -18, 36, 36);
      // bag body
      const bg = ctx.createLinearGradient(-7, 0, 7, 0);
      bg.addColorStop(0, "#5a4420");
      bg.addColorStop(0.5, "#7a5e30");
      bg.addColorStop(1, "#5a4420");
      ctx.fillStyle = bg;
      ctx.fillRect(-7, -9, 14, 12);
      ctx.strokeStyle = "#2a1e0a";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-7, -9, 14, 12);
      // tie
      ctx.fillStyle = "#3a2e18";
      ctx.fillRect(-7, -12, 14, 4);
      // label
      ctx.fillStyle = "rgba(200,180,130,0.3)";
      ctx.beginPath();
      ctx.arc(0, -3, 3, 0, TAU);
      ctx.fill();
      // small highlight
      ctx.fillStyle = "rgba(200,170,100,0.25)";
      ctx.fillRect(-5, -7, 3, 2);
    }
    ctx.restore();
  }
}

/* ---- Plant: flycatcher that grows and devours insects ---- */
function drawPlant(){
  const pl = game.plant;
  const full = plantFullyGrown();
  const t = performance.now() / 1000;
  const h = 20 + pl.growth * 18;
  const growthRatio = pl.growth;

  ctx.save();
  ctx.translate(pl.x, pl.y);

  // during finale: scale up the plant dramatically
  if (game.phase === "finale"){
    const scale = 1 + Math.min(0.8, game.finaleT * 0.5);
    ctx.scale(scale, scale);
    const fPulse = 0.5 + 0.3 * Math.sin(t * 3);
    const fg = ctx.createRadialGradient(0, -h * scale / 2, 4, 0, -h * scale / 2, 70 * scale);
    fg.addColorStop(0, "rgba(100,220,70," + (0.25 * fPulse) + ")");
    fg.addColorStop(1, "rgba(60,180,50,0)");
    ctx.fillStyle = fg;
    ctx.fillRect(-55 * scale, -h * scale - 35, 110 * scale, h * scale + 55);
  }

  // ---- ambient glow when grown or has sunlight ----
  if (pl.has.sunlight || full){
    const pulse = 1 + 0.08 * Math.sin(t * 2);
    const g = ctx.createRadialGradient(0, -h / 2, 2, 0, -h / 2, 42 * pulse);
    g.addColorStop(0, "rgba(100,220,70,0.16)");
    g.addColorStop(1, "rgba(60,180,50,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-35, -h - 25, 70, h + 50);
  }

  // ---- shadow under plant ----
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 26, 7, 0, 0, TAU);
  ctx.fill();

  // ---- soil mound with layered texture ----
  const soilG = ctx.createRadialGradient(0, 6, 2, 0, 6, 24);
  soilG.addColorStop(0, "#3a2a18");
  soilG.addColorStop(0.6, "#2a1e10");
  soilG.addColorStop(1, "#1a1208");
  ctx.fillStyle = soilG;
  ctx.beginPath();
  ctx.ellipse(0, 8, 24, 9, 0, 0, TAU);
  ctx.fill();
  // darker inner soil
  ctx.fillStyle = "rgba(20,12,6,0.6)";
  ctx.beginPath();
  ctx.ellipse(0, 5, 16, 5, 0, 0, TAU);
  ctx.fill();
  // small pebbles on soil
  ctx.fillStyle = "rgba(60,50,35,0.5)";
  ctx.beginPath(); ctx.arc(-12, 7, 2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(10, 9, 1.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(4, 4, 1, 0, TAU); ctx.fill();
  // tiny moss tufts on soil
  ctx.fillStyle = "rgba(50,80,35,0.4)";
  ctx.beginPath(); ctx.arc(-8, 6, 2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(14, 7, 1.5, 0, TAU); ctx.fill();

  // ---- roots — thin tendrils spreading from base ----
  ctx.strokeStyle = "rgba(50,38,20,0.55)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  // left root
  ctx.beginPath();
  ctx.moveTo(-6, 6);
  ctx.quadraticCurveTo(-16, 12, -22, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-18, 10);
  ctx.quadraticCurveTo(-20, 14, -18, 16);
  ctx.stroke();
  // right root
  ctx.beginPath();
  ctx.moveTo(6, 6);
  ctx.quadraticCurveTo(16, 12, 22, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(18, 10);
  ctx.quadraticCurveTo(20, 14, 18, 16);
  ctx.stroke();
  // center root
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.quadraticCurveTo(0, 14, 2, 18);
  ctx.stroke();

  // ---- stalk — segmented with gradient ----
  const stalkCol  = full ? "#5a8a48" : "#3a5a2e";
  const stalkMid  = full ? "#4a7a3e" : "#2e4a24";
  const stalkDark  = full ? "#2a4a1e" : "#1a2e14";
  const stalkHi   = full ? "#6a9a58" : "#4a6a3e";

  const sg = ctx.createLinearGradient(-12, 0, 12, 0);
  sg.addColorStop(0, stalkDark);
  sg.addColorStop(0.35, stalkMid);
  sg.addColorStop(0.55, stalkCol);
  sg.addColorStop(0.75, stalkMid);
  sg.addColorStop(1, stalkDark);
  ctx.fillStyle = sg;

  // organic curved stalk shape — wider at base, tapering up
  const sw = 10 + growthRatio * 2;  // stalk half-width at base
  ctx.beginPath();
  ctx.moveTo(-sw, 6);
  ctx.quadraticCurveTo(-sw - 3, -h * 0.3, -sw * 0.5, -h * 0.7);
  ctx.quadraticCurveTo(-sw * 0.3, -h * 0.9, -4, -h);
  ctx.lineTo(4, -h);
  ctx.quadraticCurveTo(sw * 0.3, -h * 0.9, sw * 0.5, -h * 0.7);
  ctx.quadraticCurveTo(sw + 3, -h * 0.3, sw, 6);
  ctx.closePath();
  ctx.fill();

  // highlight stripe on the stalk (left side — light from sun)
  const hlG = ctx.createLinearGradient(-sw, 0, -sw * 0.3, 0);
  hlG.addColorStop(0, "rgba(120,160,80,0)");
  hlG.addColorStop(0.5, "rgba(120,160,80,0.15)");
  hlG.addColorStop(1, "rgba(120,160,80,0)");
  ctx.fillStyle = hlG;
  ctx.beginPath();
  ctx.moveTo(-sw + 2, 4);
  ctx.quadraticCurveTo(-sw - 1, -h * 0.3, -sw * 0.4, -h * 0.7);
  ctx.quadraticCurveTo(-sw * 0.2, -h * 0.9, -3, -h);
  ctx.lineTo(-1, -h);
  ctx.quadraticCurveTo(-sw * 0.1, -h * 0.9, -sw * 0.3, -h * 0.7);
  ctx.quadraticCurveTo(-sw + 1, -h * 0.3, -sw + 2, 4);
  ctx.closePath();
  ctx.fill();

  // stalk outline
  ctx.strokeStyle = "rgba(16,28,12,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-sw, 6);
  ctx.quadraticCurveTo(-sw - 3, -h * 0.3, -sw * 0.5, -h * 0.7);
  ctx.quadraticCurveTo(-sw * 0.3, -h * 0.9, -4, -h);
  ctx.lineTo(4, -h);
  ctx.quadraticCurveTo(sw * 0.3, -h * 0.9, sw * 0.5, -h * 0.7);
  ctx.quadraticCurveTo(sw + 3, -h * 0.3, sw, 6);
  ctx.stroke();

  // central vein
  ctx.strokeStyle = "rgba(80,120,50,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.quadraticCurveTo(0, -h * 0.5, 0, -h);
  ctx.stroke();

  // segment lines — horizontal ridges on the stalk
  ctx.strokeStyle = "rgba(20,35,15,0.3)";
  ctx.lineWidth = 0.8;
  const segs = 3;
  for (let i = 1; i <= segs; i++){
    const sy = 6 - (h + 2) * (i / (segs + 1));
    const halfW = sw * (1 - (i / (segs + 1)) * 0.4);
    ctx.beginPath();
    ctx.moveTo(-halfW, sy);
    ctx.quadraticCurveTo(0, sy + 1, halfW, sy);
    ctx.stroke();
  }

  // ---- side leaves growing from stalk ----
  const leafCol  = full ? "#4a7a3e" : "#345a28";
  const leafDark = full ? "#2a4a1e" : "#1e3a18";
  const leafHi   = full ? "#5a8a4e" : "#4a6a3e";
  // leaf on the left
  if (growthRatio > 0.15){
    const ly = -h * 0.45;
    const lScale = clamp(growthRatio * 1.2, 0, 1);
    const ll = 18 * lScale, lw = 7 * lScale;
    const lg2 = ctx.createLinearGradient(-ll, ly, -2, ly);
    lg2.addColorStop(0, leafDark);
    lg2.addColorStop(0.5, leafCol);
    lg2.addColorStop(1, leafHi);
    ctx.fillStyle = lg2;
    ctx.beginPath();
    ctx.moveTo(-3, ly);
    ctx.quadraticCurveTo(-ll * 0.6, ly - lw - 2, -ll, ly - lw * 0.3);
    ctx.quadraticCurveTo(-ll * 0.7, ly + 1, -3, ly + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(16,28,12,0.5)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // leaf vein
    ctx.strokeStyle = "rgba(60,100,40,0.3)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-3, ly + 0.5);
    ctx.quadraticCurveTo(-ll * 0.5, ly - lw * 0.2, -ll + 1, ly - lw * 0.3);
    ctx.stroke();
  }
  // leaf on the right (lower)
  if (growthRatio > 0.3){
    const ly = -h * 0.65;
    const lScale = clamp((growthRatio - 0.2) * 1.3, 0, 1);
    const ll = 16 * lScale, lw = 6 * lScale;
    const rg2 = ctx.createLinearGradient(2, ly, ll, ly);
    rg2.addColorStop(0, leafHi);
    rg2.addColorStop(0.5, leafCol);
    rg2.addColorStop(1, leafDark);
    ctx.fillStyle = rg2;
    ctx.beginPath();
    ctx.moveTo(3, ly);
    ctx.quadraticCurveTo(ll * 0.6, ly - lw - 1, ll, ly - lw * 0.3);
    ctx.quadraticCurveTo(ll * 0.7, ly + 2, 3, ly + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(16,28,12,0.5)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.strokeStyle = "rgba(60,100,40,0.3)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(3, ly + 0.5);
    ctx.quadraticCurveTo(ll * 0.5, ly - lw * 0.2, ll - 1, ly - lw * 0.3);
    ctx.stroke();
  }

  // ---- Venus flytrap head when fully grown ----
  if (full){
    const headY = -h - 3;
    let openness = 0.22 + 0.1 * Math.sin(t * 1.5);
    if (pl.eatT > 0){
      const chompPhase = 1 - (pl.eatT / PLANT_EAT_DURATION);
      if (chompPhase < 0.3) openness = 0.04;
      else openness = 0.04 + (chompPhase - 0.3) * 0.9;
    } else if (pl.mouthOpen > 0){
      openness = pl.mouthOpen * 0.8;
    }

    // lure glow — pulsing aura to attract insects
    const lurePulse = 0.4 + 0.3 * Math.sin(t * 3);
    const lg = ctx.createRadialGradient(0, headY, 1, 0, headY, 34);
    lg.addColorStop(0, "rgba(120,240,80," + (0.12 * lurePulse) + ")");
    lg.addColorStop(0.5, "rgba(80,200,60," + (0.06 * lurePulse) + ")");
    lg.addColorStop(1, "rgba(60,180,50,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(-28, headY - 22, 56, 36);

    // stalk-to-head connector (small bulb)
    ctx.fillStyle = stalkDark;
    ctx.beginPath();
    ctx.ellipse(0, headY + 3, 5, 3, 0, 0, TAU);
    ctx.fill();

    // === LEFT LOBE ===
    const lobeW = 14 + openness * 5;
    const lobeH = 12 + openness * 9;
    const lobeCol = "#4e7e42";
    const lobeMid = "#3e6e32";
    const lobeDark = "#2a4e1e";
    const lobeHi  = "#6a9e58";

    // outer gradient
    const lobeLG = ctx.createLinearGradient(-lobeW, headY - lobeH * 0.5, -1, headY);
    lobeLG.addColorStop(0, lobeDark);
    lobeLG.addColorStop(0.4, lobeMid);
    lobeLG.addColorStop(0.75, lobeCol);
    lobeLG.addColorStop(1, lobeHi);
    ctx.fillStyle = lobeLG;
    ctx.beginPath();
    ctx.moveTo(-1, headY + 2);
    ctx.quadraticCurveTo(-lobeW * 0.8, headY - lobeH * 0.3, -lobeW, headY - lobeH * 0.5);
    ctx.quadraticCurveTo(-lobeW * 0.9, headY - lobeH - 2, -lobeW * 0.5, headY - lobeH);
    ctx.quadraticCurveTo(-lobeW * 0.2, headY - lobeH + 1, -1, headY - lobeH * 0.5);
    ctx.closePath();
    ctx.fill();
    // outline
    ctx.strokeStyle = "rgba(16,28,12,0.65)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // inner highlight
    ctx.fillStyle = "rgba(120,180,80,0.12)";
    ctx.beginPath();
    ctx.ellipse(-lobeW * 0.55, headY - lobeH * 0.55, lobeW * 0.25, lobeH * 0.35, -0.3, 0, TAU);
    ctx.fill();

    // === RIGHT LOBE ===
    const lobeRG = ctx.createLinearGradient(1, headY, lobeW, headY - lobeH * 0.5);
    lobeRG.addColorStop(0, lobeHi);
    lobeRG.addColorStop(0.25, lobeCol);
    lobeRG.addColorStop(0.6, lobeMid);
    lobeRG.addColorStop(1, lobeDark);
    ctx.fillStyle = lobeRG;
    ctx.beginPath();
    ctx.moveTo(1, headY + 2);
    ctx.quadraticCurveTo(lobeW * 0.8, headY - lobeH * 0.3, lobeW, headY - lobeH * 0.5);
    ctx.quadraticCurveTo(lobeW * 0.9, headY - lobeH - 2, lobeW * 0.5, headY - lobeH);
    ctx.quadraticCurveTo(lobeW * 0.2, headY - lobeH + 1, 1, headY - lobeH * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(16,28,12,0.65)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // inner highlight
    ctx.fillStyle = "rgba(120,180,80,0.12)";
    ctx.beginPath();
    ctx.ellipse(lobeW * 0.55, headY - lobeH * 0.55, lobeW * 0.25, lobeH * 0.35, 0.3, 0, TAU);
    ctx.fill();

    // === INNER MOUTH ===
    if (openness > 0.08){
      const mouthG = ctx.createRadialGradient(0, headY - 2, 0, 0, headY - 2, 8 + openness * 5);
      mouthG.addColorStop(0, "rgba(200,60,50," + (0.7 * openness) + ")");
      mouthG.addColorStop(0.5, "rgba(160,40,40," + (0.5 * openness) + ")");
      mouthG.addColorStop(1, "rgba(100,20,20," + (0.2 * openness) + ")");
      ctx.fillStyle = mouthG;
      ctx.beginPath();
      ctx.ellipse(0, headY - 3, 5 + openness * 4, 4 + openness * 6, 0, 0, TAU);
      ctx.fill();

      // nectar glands — small glistening dots
      ctx.fillStyle = "rgba(240,200,80," + (0.5 * openness) + ")";
      for (let i = 0; i < 3; i++){
        const nx = -3 + i * 3;
        const ny = headY - 4 + (i % 2) * 2;
        ctx.beginPath();
        ctx.arc(nx, ny, 0.8, 0, TAU);
        ctx.fill();
      }
      // central nectar droplet
      ctx.fillStyle = "rgba(255,220,100," + (0.4 * openness) + ")";
      ctx.beginPath();
      ctx.arc(0, headY - 3, 1.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,200," + (0.3 * openness) + ")";
      ctx.beginPath();
      ctx.arc(-0.5, headY - 3.5, 0.5, 0, TAU);
      ctx.fill();

      // trigger hairs — 3 sensitive hairs inside the mouth
      ctx.strokeStyle = "rgba(200,180,140," + (0.4 * openness) + ")";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 3; i++){
        const hx = -2 + i * 2;
        ctx.beginPath();
        ctx.moveTo(hx, headY - 3);
        ctx.lineTo(hx, headY - 6 - openness * 3);
        ctx.stroke();
        // small knob at tip
        ctx.fillStyle = "rgba(200,180,140," + (0.4 * openness) + ")";
        ctx.beginPath();
        ctx.arc(hx, headY - 6 - openness * 3, 0.6, 0, TAU);
        ctx.fill();
      }
    }

    // === MARGINAL TEETH (cilia) — interlocking spines along lobe edges ===
    ctx.strokeStyle = "rgba(210,225,190,0.65)";
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    const numTeethL = 5;
    const numTeethR = 5;
    // left lobe teeth — along the inner edge
    for (let i = 0; i < numTeethL; i++){
      const frac = (i + 0.5) / numTeethL;
      const tx = -1 - frac * (lobeW - 2);
      const ty = headY - 1 - frac * (lobeH - 2) + Math.sin(frac * 3) * 1.5;
      const toothLen = 2.5 + (1 - Math.abs(frac - 0.5)) * 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 1, ty - toothLen);
      ctx.stroke();
    }
    // right lobe teeth
    for (let i = 0; i < numTeethR; i++){
      const frac = (i + 0.5) / numTeethR;
      const tx = 1 + frac * (lobeW - 2);
      const ty = headY - 1 - frac * (lobeH - 2) + Math.sin(frac * 3) * 1.5;
      const toothLen = 2.5 + (1 - Math.abs(frac - 0.5)) * 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 1, ty - toothLen);
      ctx.stroke();
    }

    // eaten count badge
    if (pl.eaten > 0){
      ctx.fillStyle = "rgba(100,200,60,0.8)";
      ctx.font = "bold 10px Georgia";
      ctx.textAlign = "center";
      ctx.fillText("\u00d7" + pl.eaten, 0, headY - lobeH - 8);
    }
  } else {
    // ---- growing bud — small curled leaf at top ----
    const budCol = full ? "#4a7a3e" : "#3a5a2e";
    const budDark = full ? "#2a4a1e" : "#1e3a18";
    const budHi  = full ? "#5a8a4e" : "#4a6a3e";
    const budG = ctx.createLinearGradient(0, -h - 6, 0, -h + 2);
    budG.addColorStop(0, budHi);
    budG.addColorStop(0.5, budCol);
    budG.addColorStop(1, budDark);
    ctx.fillStyle = budG;
    ctx.beginPath();
    ctx.ellipse(0, -h - 1, 6, 5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(16,28,12,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // tiny leaf tip
    ctx.fillStyle = budHi;
    ctx.beginPath();
    ctx.ellipse(-2, -h - 4, 3, 2, -0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(16,28,12,0.4)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // ---- growth indicator dots — subtle glowing orbs on stalk ----
  const dotY = -h * 0.3;
  const dotSpacing = 10;
  if (pl.has.water){
    ctx.fillStyle = "#3aa0d8";
    ctx.beginPath();
    ctx.arc(-dotSpacing, dotY, 2.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(60,160,220,0.12)";
    ctx.beginPath();
    ctx.arc(-dotSpacing, dotY, 5, 0, TAU);
    ctx.fill();
  }
  if (pl.has.fertilizer){
    ctx.fillStyle = "#c0a040";
    ctx.beginPath();
    ctx.arc(0, dotY, 2.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(180,160,60,0.12)";
    ctx.beginPath();
    ctx.arc(0, dotY, 5, 0, TAU);
    ctx.fill();
  }
  if (pl.has.sunlight){
    ctx.fillStyle = "#ffd840";
    ctx.beginPath();
    ctx.arc(dotSpacing, dotY, 2.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,220,80,0.15)";
    ctx.beginPath();
    ctx.arc(dotSpacing, dotY, 6, 0, TAU);
    ctx.fill();
  }

  // ---- climb prompt — prominent pulsing banner when fully grown ----
  if (full){
    const pulse = 0.6 + 0.3 * Math.sin(t * 3);
    const bw = 124, bh = 22;
    const bx = -bw / 2, by = -h - (pl.eaten > 0 ? 42 : 26) - bh;
    ctx.fillStyle = "rgba(80,140,40," + (0.35 * pulse) + ")";
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "rgba(140,220,80," + (0.6 * pulse) + ")";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = "rgba(200,255,120," + (0.9 * pulse) + ")";
    ctx.font = "bold 11px Georgia";
    ctx.textAlign = "center";
    ctx.fillText("\u2191 HOLD W / \u2191 TO ESCAPE!", 0, by + 15);
    ctx.strokeStyle = "rgba(140,220,80," + (0.5 * pulse) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, by + bh);
    ctx.lineTo(0, by + bh + 6);
    ctx.moveTo(-4, by + bh + 2);
    ctx.lineTo(0, by + bh + 6);
    ctx.lineTo(4, by + bh + 2);
    ctx.stroke();
  }
  ctx.restore();

  // eat particles
  drawEatParticles();
}

/* ---- Eat particles: green sap + red mist burst ---- */
function drawEatParticles(){
  ctx.save();
  for (const p of game.eatParticles){
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * a, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ---- Mirrors: polished glass with specular shimmer ---- */
function drawMirrors(){
  const t = performance.now() / 1000;
  for (const m of game.mirrors){
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);

    // drop shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-MIRROR_HIT_HALF, 0, MIRROR_HIT_HALF * 2, 6);

    // mirror face — glass gradient
    const g = ctx.createLinearGradient(0, -3, 0, 3);
    g.addColorStop(0, "rgba(200,220,230,0.85)");
    g.addColorStop(0.5, "rgba(140,165,180,0.75)");
    g.addColorStop(1, "rgba(80,100,115,0.65)");
    ctx.fillStyle = g;
    ctx.fillRect(-MIRROR_HIT_HALF, -3, MIRROR_HIT_HALF * 2, 6);

    // specular highlight band
    ctx.strokeStyle = "rgba(240,250,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-MIRROR_HIT_HALF + 4, -2);
    ctx.lineTo(-MIRROR_HIT_HALF + 16, -2);
    ctx.stroke();

    // moving shimmer
    const shim = (Math.sin(t * 2 + m.x * 0.01) * 0.5 + 0.5) * MIRROR_HIT_HALF * 2 - MIRROR_HIT_HALF;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(shim - 5, -2);
    ctx.lineTo(shim + 5, -2);
    ctx.stroke();

    // frame
    ctx.strokeStyle = "rgba(20,25,30,0.8)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-MIRROR_HIT_HALF, -3, MIRROR_HIT_HALF * 2, 6);

    // back support — dark wood
    ctx.fillStyle = "#2a2018";
    ctx.fillRect(-3, 3, 6, 14);
    ctx.strokeStyle = "rgba(60,45,25,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, 3, 6, 14);

    // range arc when dragging
    if (m.dragging){
      ctx.strokeStyle = "rgba(160,200,220,0.2)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 32, -m.range, m.range);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---- Wall top: glowing destination ---- */
function drawWallTop(){
  const w = game.wallTop;
  const t = performance.now() / 1000;
  const pulse = 0.7 + 0.15 * Math.sin(t * 1.5);

  // soft glow
  const g = ctx.createRadialGradient(
    w.x + w.w / 2, w.y + w.h / 2, 2,
    w.x + w.w / 2, w.y + w.h / 2, 48);
  g.addColorStop(0, "rgba(180,200,140," + (0.12 * pulse) + ")");
  g.addColorStop(1, "rgba(180,200,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(w.x - 30, w.y - 30, w.w + 60, w.h + 60);

  // body — dark stone
  const bg = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
  bg.addColorStop(0, "#3a342a");
  bg.addColorStop(1, "#2a2418");
  ctx.fillStyle = bg;
  ctx.fillRect(w.x, w.y, w.w, w.h);

  // top highlight
  ctx.fillStyle = "rgba(100,90,65,0.3)";
  ctx.fillRect(w.x, w.y, w.w, 2);

  // edge
  ctx.strokeStyle = "rgba(80,70,50,0.6)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);

  // label
  ctx.fillStyle = "rgba(150,180,100," + (0.5 * pulse) + ")";
  ctx.font = "italic bold 10px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("ESCAPE", w.x + w.w / 2, w.y + w.h / 2 + 3);
}

/* ---- Insects: dark bugs with glowing eyes ---- */
function drawInsects(){
  const t = performance.now() / 1000;
  for (const ins of game.insects){
    ctx.save();
    ctx.translate(ins.x, ins.y);

    // detection ring — always visible on levels with showVision (e.g. L1)
    const showVisionAlways = game.level && game.level.showVision;
    if (ins.state !== "patrol"){
      const ringPulse = 0.5 + 0.3 * Math.sin(t * 4);
      const ringCol = ins.state === "dive"
        ? "rgba(220,50,30," + (0.35 * ringPulse) + ")"
        : "rgba(230,140,40," + (0.22 * ringPulse) + ")";
      ctx.strokeStyle = ringCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, ins.detectRadius, 0, TAU);
      ctx.stroke();
    } else if (showVisionAlways){
      // subtle vision range for beginners — pale blue ring
      ctx.strokeStyle = "rgba(120,160,200,0.18)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, ins.detectRadius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      // soft fill
      ctx.fillStyle = "rgba(120,160,200,0.04)";
      ctx.beginPath();
      ctx.arc(0, 0, ins.detectRadius, 0, TAU);
      ctx.fill();
    }

    // wings — flapping blur
    const flap = Math.sin(t * 15) * 4;
    ctx.fillStyle = "rgba(100,100,110,0.3)";
    ctx.beginPath();
    ctx.ellipse(-4, -5 - flap, 8, 4, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -5 - flap, 8, 4, -0.3, 0, TAU);
    ctx.fill();

    // body — color by state
    const bodyCol = ins.state === "dive"
      ? "#8a2a2a"
      : ins.state === "alert"
      ? "#a05028"
      : "#5a4a3a";
    const bodyDark = ins.state === "dive"
      ? "#5a1a1a"
      : ins.state === "alert"
      ? "#6a3020"
      : "#3a2e22";
    const bg = ctx.createLinearGradient(0, -5, 0, 5);
    bg.addColorStop(0, bodyDark);
    bg.addColorStop(0.5, bodyCol);
    bg.addColorStop(1, bodyDark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,15,10,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // eyes — dark with glow when alerted
    const eyeCol = ins.state === "dive"
      ? "rgba(255,60,40,0.9)"
      : ins.state === "alert"
      ? "rgba(255,160,40,0.8)"
      : "#1a1410";
    ctx.fillStyle = eyeCol;
    ctx.beginPath();
    ctx.arc(-2.5, -1.5, 1.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2.5, -1.5, 1.3, 0, TAU);
    ctx.fill();
    // eye shine
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(-2, -2, 0.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, -2, 0.5, 0, TAU);
    ctx.fill();

    ctx.restore();
  }
}

/* ---- Player: small warm character ---- */
function drawPlayer(){
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);

  // drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 9, 4, 0, 0, TAU);
  ctx.fill();

  const hiding = p.state === "hide";
  const climbing = p.state === "climb";

  // body — gradient torso
  const bodyCol = hiding ? "#6a7a5a" : "#8a7a5a";
  const bodyDark = hiding ? "#4a5a3a" : "#6a5a3a";
  const bg = ctx.createLinearGradient(-6, 0, 6, 0);
  bg.addColorStop(0, bodyDark);
  bg.addColorStop(0.5, bodyCol);
  bg.addColorStop(1, bodyDark);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-6, 8);
  ctx.quadraticCurveTo(-8, 0, -5, -6);
  ctx.quadraticCurveTo(-3, -8, 0, -8);
  ctx.quadraticCurveTo(3, -8, 5, -6);
  ctx.quadraticCurveTo(8, 0, 6, 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(30,25,15,0.6)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // head
  const headCol = hiding ? "#7a8a6a" : "#c8a868";
  const headDark = hiding ? "#5a6a4a" : "#a88848";
  const hg = ctx.createLinearGradient(-5, -12, 5, -8);
  hg.addColorStop(0, headDark);
  hg.addColorStop(0.5, headCol);
  hg.addColorStop(1, headDark);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, -10, 5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,25,15,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // facing indicator
  if (!hiding){
    ctx.strokeStyle = "rgba(230,216,161,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(p.facing) * 14, Math.sin(p.facing) * 14);
    ctx.stroke();
  }

  // carried item
  if (p.holding){
    const col = p.holding === "water" ? "#3a7a9a" : "#7a5e30";
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(7, -6, 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,15,10,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // climb animation
  if (climbing){
    ctx.fillStyle = "rgba(180,220,100,0.7)";
    ctx.font = "bold 9px Georgia";
    ctx.textAlign = "center";
    ctx.fillText("climbing " + Math.floor(p.climbT * 100) + "%", 0, -22);
  }
  ctx.restore();
}

/* ---------- 8. HUD & overlays ---------- */

function drawHUD(){
  ctx.save();
  // top bar — dark glass
  const bar = ctx.createLinearGradient(0, 0, 0, 38);
  bar.addColorStop(0, "rgba(16,18,14,0.88)");
  bar.addColorStop(1, "rgba(16,18,14,0.7)");
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, W, 38);
  ctx.strokeStyle = "rgba(60,55,40,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 38);
  ctx.lineTo(W, 38);
  ctx.stroke();

  ctx.fillStyle = "#e6d8a1";
  ctx.font = "bold 14px Georgia";
  ctx.textAlign = "left";
  const L = game.level;
  ctx.fillText("Level " + (game.levelIndex + 1) + " — " + L.name, 12, 24);

  // time
  ctx.fillStyle = game.time < 20 ? "#e06050" : "#c9d3a8";
  ctx.textAlign = "center";
  ctx.fillText("Time: " + Math.ceil(game.time) + "s", W / 2, 24);

  // placement requirements — clearer wording
  const pl = game.plant;
  ctx.textAlign = "right";
  ctx.fillStyle = "#a8a892";
  const reqText = pl.required.map(r => {
    const names = { water: "Water", fertilizer: "Fert", sunlight: "Light" };
    return (pl.has[r] ? "\u2713" : "\u2717") + names[r];
  }).join("  ");
  ctx.fillText("Plant needs: " + reqText, W - 12, 24);

  if (L.tier === 3){
    ctx.textAlign = "left";
    ctx.fillStyle = game.lightValid ? "#8acb5a" : "#a06060";
    ctx.fillText("Light path: " + (game.lightValid ? "VALID" : "invalid"), 220, 24);
  }

  if (game.player.holding){
    ctx.textAlign = "left";
    ctx.fillStyle = "#c9d3a8";
    ctx.fillText("Holding: " + game.player.holding, 420, 24);
  }

  // toast
  if (game.toastT > 0){
    ctx.globalAlpha = clamp(game.toastT, 0, 1);
    ctx.fillStyle = "#e6d8a1";
    ctx.font = "italic 13px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(game.toast, W / 2, H - 24);
    ctx.globalAlpha = 1;
  }

  // red warning border — pulsing
  if (game.warning > 0.02){
    const t = performance.now() / 1000;
    const pulse = 0.5 + 0.3 * Math.sin(t * 6);
    ctx.strokeStyle = "rgba(200,50,40," + (0.5 * game.warning * pulse) + ")";
    ctx.lineWidth = 6 * game.warning + 2;
    ctx.strokeRect(2, 2, W - 4, H - 4);
  }

  ctx.restore();
}

/* ---- On-screen key hint panel: shows controls during gameplay ---- */
/* ---- Compact key-hint strip at bottom centre — auto-hides after 8s, H toggles ---- */
function drawKeyHints(){
  if (game.phase !== "playing" && game.phase !== "paused") return;
  ctx.save();

  if (!game.uiHintVisible){
    // tiny hint to press H
    ctx.fillStyle = "rgba(16,18,14,0.6)";
    ctx.fillRect(W / 2 - 36, H - 22, 72, 18);
    ctx.fillStyle = "rgba(168,168,146,0.5)";
    ctx.font = "9px Georgia";
    ctx.textAlign = "center";
    ctx.fillText("[H] Show Keys", W / 2, H - 9);
    ctx.restore();
    return;
  }

  // compact one-line strip
  const items = [
    { key: "W/\u2191", label: "Up" },
    { key: "S/\u2193", label: "Down" },
    { key: "A/\u2190", label: "Left" },
    { key: "D/\u2192", label: "Right" },
    { key: "Q", label: "Hide" },
    { key: "E", label: "Grab" },
    { key: "Drag", label: "Mirror" },
  ];
  ctx.font = "10px Georgia";
  let totalW = 0;
  const segW = [];
  for (const it of items){
    const w = ctx.measureText(it.key).width + ctx.measureText(it.label).width + 18;
    segW.push(w);
    totalW += w;
  }
  totalW += 16;
  const px = (W - totalW) / 2;
  const py = H - 26;
  const ph = 20;

  // fading alpha near end of timer
  let alpha = 1;
  if (game.uiHintT < 999 && game.uiHintT > 0 && game.uiHintT < 2){
    alpha = game.uiHintT / 2;
  }
  ctx.globalAlpha = alpha;

  // background strip
  ctx.fillStyle = "rgba(16,18,14,0.78)";
  ctx.fillRect(px, py, totalW, ph);
  ctx.strokeStyle = "rgba(60,55,40,0.35)";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(px + 0.5, py + 0.5, totalW - 1, ph - 1);

  // draw segments
  let cx = px + 8;
  ctx.textAlign = "left";
  for (let i = 0; i < items.length; i++){
    ctx.fillStyle = "#e6d8a1";
    ctx.font = "bold 10px Georgia";
    ctx.fillText(items[i].key, cx, py + 13);
    cx += ctx.measureText(items[i].key).width + 4;
    ctx.fillStyle = "#8a8a72";
    ctx.font = "10px Georgia";
    ctx.fillText(items[i].label, cx, py + 13);
    cx += ctx.measureText(items[i].label).width + 14;
  }

  ctx.restore();
}

/* ---- Objective panel: compact badge + expandable (Tab to toggle) ---- */
function drawObjectivePanel(){
  if (game.phase !== "playing" && game.phase !== "paused") return;
  const pl = game.plant;
  if (!pl) return;
  const full = plantFullyGrown();
  const t = performance.now() / 1000;

  // build objective steps based on level requirements
  const steps = [];
  if (pl.required.includes("water")){
    const done = pl.has.water;
    steps.push({ label: "Pick up Water", done: done || game.items.some(i => i.type === "water" && i.carried) });
    steps.push({ label: "Place Water on Plant", done: done });
  }
  if (pl.required.includes("fertilizer")){
    const done = pl.has.fertilizer;
    steps.push({ label: "Pick up Fertilizer", done: done || game.items.some(i => i.type === "fertilizer" && i.carried) });
    steps.push({ label: "Place Fertilizer on Plant", done: done });
  }
  if (pl.required.includes("sunlight")){
    steps.push({ label: "Aim Mirrors \u2192 Light on Plant", done: pl.has.sunlight });
  }
  steps.push({ label: "Climb Plant (hold W/\u2191) to Escape!", done: false, highlight: full });

  let activeIdx = steps.findIndex(s => !s.done);
  if (activeIdx < 0) activeIdx = steps.length - 1;
  const doneCount = steps.filter(s => s.done).length;

  ctx.save();

  if (!game.objExpanded){
    // ---- collapsed: prominent badge in top-right corner of HUD ----
    const bx = W - 168, by = 4, bw = 156, bh = 36;
    // badge bg — brighter so it's noticeable
    const badgeG = ctx.createLinearGradient(bx, by, bx, by + bh);
    badgeG.addColorStop(0, "rgba(40,44,28,0.92)");
    badgeG.addColorStop(1, "rgba(26,28,18,0.92)");
    ctx.fillStyle = badgeG;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "rgba(107,125,75,0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

    // star icon — bigger and brighter
    ctx.fillStyle = "#e6d8a1";
    ctx.font = "bold 15px Georgia";
    ctx.textAlign = "left";
    ctx.fillText("\u2605", bx + 8, by + 22);

    // "MISSION" label
    ctx.fillStyle = "#c9d3a8";
    ctx.font = "bold 9px Georgia";
    ctx.fillText("MISSION", bx + 24, by + 13);

    // progress text
    ctx.fillStyle = "#e6d8a1";
    ctx.font = "bold 11px Georgia";
    ctx.fillText(doneCount + "/" + steps.length + " done", bx + 24, by + 26);

    // progress bar
    const barX = bx + 100, barY = by + 20, barW = 44, barH = 5;
    ctx.fillStyle = "rgba(40,44,30,0.8)";
    ctx.fillRect(barX, barY, barW, barH);
    const fillW = barW * (doneCount / steps.length);
    const fillG = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
    fillG.addColorStop(0, "#5a8a3e");
    fillG.addColorStop(1, "#8acb5a");
    ctx.fillStyle = fillG;
    ctx.fillRect(barX, barY, fillW, barH);

    // Tab hint — more visible
    ctx.fillStyle = "rgba(200,190,140,0.8)";
    ctx.font = "bold 8px Georgia";
    ctx.textAlign = "center";
    ctx.fillText("[Tab] \u2193", bx + bw - 20, by + 13);

    // pulse the badge if there's an active objective
    if (activeIdx < steps.length - 1 || full){
      const pulse = 0.4 + 0.25 * Math.sin(t * 2.5);
      ctx.strokeStyle = "rgba(200,180,80," + pulse + ")";
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
    }
    // urgent: plant ready to climb
    if (full){
      const pulse = 0.6 + 0.3 * Math.sin(t * 4);
      ctx.fillStyle = "rgba(140,220,80," + (0.18 * pulse) + ")";
      ctx.fillRect(bx, by, bw, bh);
    }
  } else {
    // ---- expanded: panel at bottom-right (safe area, no gameplay overlap) ----
    const pw = 252;
    const rowH = 20;
    const panelH = 32 + steps.length * rowH + 8;
    const px = W - pw - 6;
    const py = H - panelH - 30;  // above the key-hint strip

    // panel bg
    ctx.fillStyle = "rgba(16,18,14,0.88)";
    ctx.fillRect(px, py, pw, panelH);
    ctx.strokeStyle = "rgba(60,55,40,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, panelH - 1);

    // header
    ctx.fillStyle = "#e6d8a1";
    ctx.font = "bold 11px Georgia";
    ctx.textAlign = "left";
    ctx.fillText("\u2605 MISSION  " + doneCount + "/" + steps.length, px + 8, py + 15);
    ctx.strokeStyle = "rgba(107,125,75,0.3)";
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 20);
    ctx.lineTo(px + pw - 8, py + 20);
    ctx.stroke();

    // Tab hint
    ctx.fillStyle = "rgba(168,168,146,0.5)";
    ctx.font = "8px Georgia";
    ctx.textAlign = "right";
    ctx.fillText("[Tab] Close", px + pw - 8, py + 15);

    // steps
    ctx.font = "10px Georgia";
    ctx.textAlign = "left";
    for (let i = 0; i < steps.length; i++){
      const s = steps[i];
      const ry = py + 32 + i * rowH;
      const isActive = (i === activeIdx);
      const isDone = s.done;

      // highlight active step
      if (isActive && !isDone){
        ctx.fillStyle = "rgba(180,160,60,0.12)";
        ctx.fillRect(px + 4, ry - 11, pw - 8, rowH - 2);
      }

      // checkbox circle
      ctx.beginPath();
      ctx.arc(px + 14, ry - 4, 5, 0, TAU);
      if (isDone){
        ctx.fillStyle = "rgba(80,160,50,0.3)";
        ctx.fill();
        ctx.strokeStyle = "#6aaa4a";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.strokeStyle = "#8acb5a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + 11, ry - 4);
        ctx.lineTo(px + 13, ry - 2);
        ctx.lineTo(px + 17, ry - 7);
        ctx.stroke();
      } else {
        ctx.strokeStyle = isActive ? "rgba(200,180,80,0.7)" : "rgba(80,75,55,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // label
      if (isDone){
        ctx.fillStyle = "rgba(120,170,90,0.55)";
      } else if (isActive){
        const pulse2 = 0.7 + 0.2 * Math.sin(t * 2.5);
        ctx.fillStyle = "rgba(230,216,161," + pulse2 + ")";
      } else {
        ctx.fillStyle = "rgba(120,115,95,0.45)";
      }
      ctx.fillText(s.label, px + 24, ry);

      // arrow for active step
      if (isActive && !isDone){
        ctx.fillStyle = "rgba(230,216,161,0.5)";
        ctx.font = "bold 9px Georgia";
        ctx.textAlign = "right";
        ctx.fillText("\u25c0", px + pw - 8, ry);
        ctx.textAlign = "left";
        ctx.font = "10px Georgia";
      }
    }
  }

  ctx.restore();
}

/* ---- Level-start mission briefing overlay ---- */
function drawBriefing(){
  const a = clamp(game.briefingT / 4.0, 0, 1);
  const fade = game.briefingT > 3 ? (4.0 - game.briefingT) : (game.briefingT < 1 ? game.briefingT : 1);
  const L = game.level;
  const pl = game.plant;

  ctx.save();
  ctx.globalAlpha = fade;

  // panel
  const px = W / 2 - 220, py = H / 2 - 80, pw = 440, ph = 160;
  ctx.fillStyle = "rgba(12,14,10,0.92)";
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = "rgba(107,125,75,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e6d8a1";
  ctx.font = "bold 20px Georgia";
  ctx.fillText("Level " + (game.levelIndex + 1) + ": " + L.name, W / 2, py + 30);

  ctx.font = "italic 13px Georgia";
  ctx.fillStyle = "#c9d3a8";
  ctx.fillText("Your mission: grow the flycatcher plant and escape!", W / 2, py + 54);

  // list what the plant needs
  ctx.font = "12px Georgia";
  ctx.fillStyle = "#a8a892";
  const needs = pl.required.map(r => {
    const names = { water: "Water", fertilizer: "Fertilizer", sunlight: "Sunlight (via mirrors)" };
    return names[r] || r;
  });
  ctx.fillText("The plant needs: " + needs.join(" + "), W / 2, py + 78);

  ctx.font = "italic 11px Georgia";
  ctx.fillStyle = "rgba(168,168,146,0.7)";
  ctx.fillText("1. Pick up items (walk near them, press E)", W / 2, py + 100);
  ctx.fillText("2. Place items on the plant (stand near it, press E)", W / 2, py + 116);
  if (pl.required.includes("sunlight")){
    ctx.fillText("3. Drag mirrors to aim the sun beam at the plant", W / 2, py + 132);
    ctx.fillText("4. When fully grown, hold W near the plant to CLIMB & ESCAPE!", W / 2, py + 148);
  } else {
    ctx.fillText("3. When fully grown, hold W near the plant to CLIMB & ESCAPE!", W / 2, py + 132);
  }
  ctx.fillStyle = "rgba(168,168,146,0.5)";
  ctx.font = "10px Georgia";
  ctx.fillText("Tip: press Tab for mission tracker, H for key hints", W / 2, py + 170);

  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ---- Finale: draw insects flying toward the plant ---- */
function drawFinaleInsects(){
  const t = performance.now() / 1000;
  const pl = game.plant;
  for (const ins of game.finaleInsects){
    if (ins.eaten) continue;

    ctx.save();
    ctx.translate(ins.x, ins.y);

    // glow trail when flying toward plant
    if (ins.released){
      const a = Math.atan2(pl.y - ins.y, pl.x - ins.x);
      ctx.rotate(a);
      // motion trail
      for (let i = 0; i < 5; i++){
        const trailX = -(i + 1) * 6;
        ctx.fillStyle = "rgba(180,60,40," + (0.15 - i * 0.02) + ")";
        ctx.beginPath();
        ctx.arc(trailX, 0, 4 - i * 0.5, 0, TAU);
        ctx.fill();
      }
      ctx.rotate(-a);
    }

    // body — reddish, panicking
    const bg = ctx.createRadialGradient(0, -2, 1, 0, 0, 8);
    bg.addColorStop(0, "#8a3a2a");
    bg.addColorStop(1, "#5a2a1a");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(40,20,15,0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // glowing eyes — terrified red
    const eyePulse = 0.6 + 0.3 * Math.sin(t * 8);
    ctx.fillStyle = "rgba(255,60,40," + eyePulse + ")";
    ctx.beginPath();
    ctx.arc(-3, -1, 1.5, 0, TAU);
    ctx.arc(3, -1, 1.5, 0, TAU);
    ctx.fill();

    // wings — frantic flapping
    const flap = Math.sin(t * 25) * 0.6;
    ctx.fillStyle = "rgba(180,160,140,0.25)";
    ctx.beginPath();
    ctx.ellipse(-3, -3 - flap * 2, 5, 2, -0.5 + flap, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3, -3 - flap * 2, 5, 2, 0.5 - flap, 0, TAU);
    ctx.fill();

    ctx.restore();
  }
}

/* ---- Finale overlay: cinematic darkening + victory text ---- */
function drawFinaleOverlay(){
  const t = game.finaleT;
  const pl = game.plant;

  // gradual darkening — cinematic spotlight effect
  const darken = Math.min(0.55, t * 0.15);

  // radial gradient: spotlight on plant, dark everywhere else
  const cx = pl.x, cy = pl.y - 20;
  const radius = 180 + t * 10;
  const g = ctx.createRadialGradient(cx, cy, 40, cx, cy, radius + 200);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.3, "rgba(0,0,0," + (darken * 0.3) + ")");
  g.addColorStop(1, "rgba(0,0,0," + darken + ")");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // "FINALE" text appearing during grow phase
  if (t < 1.2){
    const fade = t < 0.6 ? t / 0.6 : (1.2 - t) / 0.6;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(230,216,161,0.7)";
    ctx.font = "italic 16px Georgia";
    ctx.fillText("The flycatcher awakens...", W / 2, 50);
    ctx.restore();
  }

  // "DEVOUR" text when eating starts
  if (t >= 1.2 && !game.finaleDone){
    const eaten = pl.eaten;
    const total = game.finaleInsects.length;
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(120,200,60,0.6)";
    ctx.font = "italic 14px Georgia";
    ctx.fillText("Devouring... " + eaten + " / " + total, W / 2, 50);
    ctx.restore();
  }

  // Final victory text when all eaten
  if (game.finaleDone){
    const fadeT = 1.8 - (game.finaleDoneT || 0);
    const fade = Math.min(1, fadeT / 0.8);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = "center";
    const glow = 0.7 + 0.2 * Math.sin(performance.now() / 500);
    ctx.fillStyle = "rgba(120,220,80," + (0.1 * glow) + ")";
    ctx.font = "bold 36px Georgia";
    ctx.fillText("VICTORY!", W / 2, H / 2 - 20);
    ctx.fillStyle = "rgba(120,200,60," + (0.85 * glow * fade) + ")";
    ctx.fillText("VICTORY!", W / 2, H / 2 - 20);
    ctx.font = "italic 14px Georgia";
    ctx.fillStyle = "rgba(200,211,168," + (0.7 * fade) + ")";
    ctx.fillText("All " + pl.eaten + " insects devoured by the flycatcher!", W / 2, H / 2 + 10);
    ctx.restore();
  }
}

function drawOverlays(){
  if (game.phase === "menu")      drawMenu();
  else if (game.phase === "won")  drawEnd(true);
  else if (game.phase === "lost") drawEnd(false);
  else if (game.phase === "paused") drawPause();
  // finale phase renders its own overlay in render(), no overlay needed here
  if (game.briefingT > 0 && game.phase === "playing") drawBriefing();
}

function dim(){
  ctx.fillStyle = "rgba(8,10,8,0.78)";
  ctx.fillRect(0, 0, W, H);
}

function drawMenu(){
  dim();
  const t = performance.now() / 1000;

  ctx.textAlign = "center";
  // title glow
  ctx.fillStyle = "rgba(230,216,161,0.06)";
  ctx.font = "bold 48px Georgia";
  for (let r = 0; r < 3; r++)
    ctx.fillText("Bug Stealth", W / 2, H / 2 - 60);
  ctx.fillStyle = "#e6d8a1";
  ctx.fillText("Bug Stealth", W / 2, H / 2 - 60);

  ctx.font = "italic 14px Georgia";
  ctx.fillStyle = "#a8a892";
  ctx.fillText("Grow the flycatcher plant and climb it to escape!", W / 2, H / 2 - 28);
  ctx.fillText("Pick up items (E), place them on the plant,", W / 2, H / 2 - 6);
  ctx.fillText("rotate mirrors to aim sunlight, then climb (W).", W / 2, H / 2 + 16);

  ctx.fillStyle = "#c9d3a8";
  ctx.font = "14px Georgia";
  ctx.fillText("Choose your difficulty:", W / 2, H / 2 + 50);

  const labels = window.LEVELS.map((l, i) => "L" + (i + 1) + " " + l.name);
  for (let i = 0; i < labels.length; i++){
    const x = W / 2 - 180 + i * 180;
    const pulse = 0.7 + 0.12 * Math.sin(t * 1.5 + i);
    ctx.fillStyle = "rgba(30,28,20," + (0.7 * pulse) + ")";
    ctx.fillRect(x, H / 2 + 70, 160, 40);
    ctx.strokeStyle = "rgba(107,125,75," + (0.5 * pulse) + ")";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, H / 2 + 70, 160, 40);
    ctx.fillStyle = "rgba(230,216,161," + (0.8 * pulse) + ")";
    ctx.fillText(labels[i], x + 80, H / 2 + 95);
  }

  // difficulty hints
  ctx.font = "italic 11px Georgia";
  ctx.fillStyle = "rgba(168,168,146,0.5)";
  const hints = ["1 item, 1 bug", "3 items, 3 bugs, mirrors", "3 items, 4 bugs, harder!"];
  for (let i = 0; i < hints.length; i++){
    const x = W / 2 - 180 + i * 180 + 80;
    ctx.fillText(hints[i], x, H / 2 + 122);
  }

  ctx.fillStyle = "rgba(107,125,75,0.4)";
  ctx.font = "italic 12px Georgia";
  ctx.fillText("click a level, or press 1 / 2 / 3", W / 2, H - 40);
}

function drawPause(){
  dim();
  ctx.fillStyle = "#e6d8a1";
  ctx.textAlign = "center";
  ctx.font = "bold 32px Georgia";
  ctx.fillText("Paused", W / 2, H / 2);
  ctx.font = "italic 14px Georgia";
  ctx.fillStyle = "#a8a892";
  ctx.fillText("press Esc to resume", W / 2, H / 2 + 30);
}

function drawEnd(won){
  dim();
  const t = performance.now() / 1000;
  ctx.textAlign = "center";

  if (won){
    const glow = 0.7 + 0.2 * Math.sin(t * 2);
    ctx.fillStyle = "rgba(120,220,80," + (0.08 * glow) + ")";
    ctx.font = "bold 40px Georgia";
    ctx.fillText("VICTORY", W / 2, H / 2 - 30);
    ctx.fillStyle = "rgba(120,200,60," + (0.85 * glow) + ")";
    ctx.fillText("VICTORY", W / 2, H / 2 - 30);
    ctx.font = "italic 15px Georgia";
    ctx.fillStyle = "#c9d3a8";
    ctx.fillText("You grew the flycatcher, climbed it, and escaped!", W / 2, H / 2 + 4);
    ctx.font = "italic 12px Georgia";
    ctx.fillStyle = "rgba(168,168,146,0.6)";
    ctx.fillText("Bugs eaten by plant: " + (game.plant.eaten || 0), W / 2, H / 2 + 24);
  } else {
    const glow = 0.6 + 0.2 * Math.sin(t * 3);
    ctx.fillStyle = "rgba(200,60,50," + (0.08 * glow) + ")";
    ctx.font = "bold 40px Georgia";
    ctx.fillText("GAME OVER", W / 2, H / 2 - 30);
    ctx.fillStyle = "rgba(200,70,50," + (0.8 * glow) + ")";
    ctx.fillText("GAME OVER", W / 2, H / 2 - 30);
    ctx.font = "italic 15px Georgia";
    ctx.fillStyle = "#c9d3a8";
    ctx.fillText(game._loseReason || "You failed.", W / 2, H / 2 + 4);
  }

  ctx.fillStyle = "rgba(107,125,75,0.5)";
  ctx.font = "italic 13px Georgia";
  ctx.fillText("press R to retry  \u2022  press M for menu", W / 2, H / 2 + 40);
}

/* ---------- 9. Main loop & boot ---------- */

let last = 0;
function loop(ts){
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  try {
    update(dt);
    render();
  } catch(err){
    console.error("Game loop error:", err);
  }
  requestAnimationFrame(loop);
}

function boot(){
  const c = document.getElementById("game");
  c.width = W; c.height = H;
  ctx = c.getContext("2d");
  setupInput(c);
  setupTouchControls(c);

  // menu click handling
  c.addEventListener("click", e => {
    if (game.phase !== "menu") return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width);
    const y = (e.clientY - r.top)  * (H / r.height);
    for (let i = 0; i < window.LEVELS.length; i++){
      const bx = W/2 - 180 + i * 180;
      if (x > bx && x < bx + 160 && y > H/2 + 70 && y < H/2 + 110){
        loadLevel(i); return;
      }
    }
  });

  // number keys to pick level from menu / restart
  window.addEventListener("keydown", e => {
    const k = e.key;
    if (game.phase === "menu" && (k === "1" || k === "2" || k === "3")) loadLevel(+k - 1);
    if ((game.phase === "won" || game.phase === "lost") && k.toLowerCase() === "r") loadLevel(game.levelIndex);
    if ((game.phase === "won" || game.phase === "lost") && k.toLowerCase() === "m") game.phase = "menu";
  });

  requestAnimationFrame(loop);
}

document.addEventListener("DOMContentLoaded", boot);
