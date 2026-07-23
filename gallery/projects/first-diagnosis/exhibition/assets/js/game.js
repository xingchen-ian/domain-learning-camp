/* ============================================================
 * First Diagnosis — playable web game (v2)
 * Track A: HTML + CSS + plain JS + Canvas 2D. No dependencies.
 *
 * Architecture (v2 — Self Play Test 01 feedback)
 *   - Top-down exploration: forest clearing with crashed jet, fire, trees
 *   - Moveable medic (WASD / arrows) finds patients and equipment
 *   - 7 patients per level (4 visible, 3 hidden behind obstacles)
 *   - Per-patient 170s timer that starts when the patient is found
 *     and keeps ticking during treatment (real-emergency pressure)
 *   - Sidebar equipment: saline, small bandage, suture, medicine
 *   - Environment equipment: cast, big bandage, cleaning cloth, water
 *     (water is required to take medicine)
 *   - Treatment mode swaps the canvas to the patient view; the world
 *     and other patients' clocks keep running in the background
 *   - One level for first playable: "Jet Crash — Forest Clearing"
 * ============================================================ */

(() => {
  'use strict';

  /* ---------- 1. Constants ---------- */

  const CANVAS_W = 1200;
  const CANVAS_H = 900;

  const PLAYER_SPEED = 220;        // px / second
  const INTERACT_RADIUS = 60;      // px — close enough to pick up / treat
  const REVEAL_RADIUS = 100;       // px — hidden patients become visible
  const PATIENT_TIMER = 170;       // seconds per patient (160-180s range)
  const MAX_LOSSES = 2;            // 3rd patient dying ends the level

  // Body part positions in canvas pixels (used in treatment view).
  // Patient is drawn centered in the 1200x900 canvas.
  const BODY = {
    head:     { x: 600, y: 200, w: 140, h: 140, label: 'Head' },
    torso:    { x: 600, y: 400, w: 200, h: 220, label: 'Torso' },
    leftArm:  { x: 460, y: 400, w: 80,  h: 200, label: 'Left arm' },
    rightArm: { x: 740, y: 400, w: 80,  h: 200, label: 'Right arm' },
    leftLeg:  { x: 540, y: 620, w: 80,  h: 240, label: 'Left leg' },
    rightLeg: { x: 660, y: 620, w: 80,  h: 240, label: 'Right leg' },
  };

  const COLORS = {
    ground:       '#3a4a35',
    groundAlt:    '#324029',
    treeCanopy:   '#2d5a2d',
    treeCanopyAlt:'#3d6a3d',
    treeTrunk:    '#4a3520',
    jet:          '#7d7d7d',
    jetDark:      '#4a4a4a',
    jetAccent:    '#c44',
    fire1:        '#ff6a1a',
    fire2:        '#ffaa30',
    fire3:        '#ffe060',
    smoke:        'rgba(60,60,60,0.45)',
    player:       '#2b7da6',
    playerCross:  '#ffffff',
    patient:      '#d65a5a',
    patient2:     '#e08050',
    hidden:       'rgba(255,255,255,0.25)',
    item:         '#ffd700',
    selectionRing:'#ffcc44',
    stabilityOk:  '#4caf7d',
    stabilityBad: '#d65a5a',
  };

  /* ---------- 2. Equipment definitions ---------- */

  // Sidebar equipment: always available, unlimited uses (per the brief:
  // "saline solution to sanitize the wound, small bandages, sutures,
  // and medicine will be kept in the sidebar to be clicked on easily")
  const SIDEBAR_ITEMS = {
    saline: {
      key: 'saline', name: 'Saline', icon: '🧴', time: 2.5,
      desc: 'Sanitize the wound',
      canApply: (inj) => inj.type === 'cut' && !inj.cleaned && !inj.fixed,
      effect: (inj) => { inj.cleaned = true; return { ok: true, msg: 'Wound cleaned with saline.' }; }
    },
    smallBandage: {
      key: 'smallBandage', name: 'Small bandage', icon: '🩹', time: 2.5,
      desc: 'Wrap a small wound',
      canApply: (inj) => inj.type === 'cut' && !inj.bandaged,
      effect: (inj) => {
        if (!inj.stitched) {
          inj.overTreated = (inj.overTreated || 0) + 1;
          return { ok: false, warn: true, msg: 'Bandaged an open wound — bleeding continues.' };
        }
        inj.bandaged = true;
        return { ok: true, msg: 'Small bandage applied.' };
      }
    },
    suture: {
      key: 'suture', name: 'Suture', icon: '🪡', time: 4,
      desc: 'Close with thread',
      canApply: (inj) => inj.type === 'cut' && !inj.stitched && !inj.fixed,
      effect: (inj) => {
        if (!inj.cleaned) {
          inj.stitched = true; inj.stitchedWith = 'basic'; inj.popChance = 0.45;
          return { ok: false, warn: true, msg: 'Sutured a dirty wound — risk of re-opening.' };
        }
        if (inj.depth > 0.5) {
          inj.stitched = true; inj.stitchedWith = 'basic'; inj.popChance = 0.20;
          return { ok: false, warn: true, msg: 'Wound deeper than the suture can hold.' };
        }
        inj.stitched = true;
        return { ok: true, msg: 'Sutured cleanly.' };
      }
    },
    medicine: {
      key: 'medicine', name: 'Medicine', icon: '💊', time: 3,
      desc: 'Pain relief / internal (needs water)',
      canApply: (inj, inv) => inv.water > 0 && !inj.fixed,
      effect: (inj, inv) => {
        if (inv.water <= 0) {
          return { ok: false, warn: true, msg: 'You need water to take medicine.' };
        }
        if (inj.type === 'internal') {
          inv.water -= 1;
          inj.fixed = true;
          return { ok: true, msg: 'Took medicine with water. Internal injury stabilized.' };
        }
        inj.overTreated = (inj.overTreated || 0) + 1;
        return { ok: false, warn: true, msg: 'Medicine is not a substitute for the right treatment.' };
      }
    }
  };

  // Environment equipment: must be found in the world, limited uses.
  // "casts, bigger bandages, cloths for cleaning, as well as regular
  // water to swallow medicine will need to be found from the environment"
  const ENV_ITEMS = {
    cast: {
      key: 'cast', name: 'Cast', icon: '🦾', time: 6,
      desc: 'Immobilize a broken bone',
      canApply: (inj) => inj.type === 'broken' && !inj.casted && !inj.fixed,
      effect: (inj) => { inj.casted = true; return { ok: true, msg: 'Cast applied.' }; }
    },
    bigBandage: {
      key: 'bigBandage', name: 'Big bandage', icon: '🩹', time: 3,
      desc: 'Wrap a large wound',
      canApply: (inj) => inj.type === 'cut' && !inj.bandaged,
      effect: (inj) => {
        if (!inj.stitched) {
          inj.overTreated = (inj.overTreated || 0) + 1;
          return { ok: false, warn: true, msg: 'Big bandage on open wound — bleeding continues.' };
        }
        inj.bandaged = true;
        return { ok: true, msg: 'Big bandage applied.' };
      }
    },
    cloth: {
      key: 'cloth', name: 'Cleaning cloth', icon: '🧻', time: 3,
      desc: 'Wipe the wound (alternative to saline)',
      canApply: (inj) => inj.type === 'cut' && !inj.cleaned && !inj.fixed,
      effect: (inj) => { inj.cleaned = true; return { ok: true, msg: 'Wound cleaned with cloth.' }; }
    },
    water: {
      key: 'water', name: 'Water', icon: '🥛', time: 2,
      desc: 'Required to take medicine',
      canApply: () => false,
      effect: () => ({ ok: false, msg: 'Water is consumed automatically when you take medicine.' })
    }
  };

  /* ---------- 3. Level definition ---------- */

  // One level for the first playable: jet crash in a forest clearing.
  // World is 1200x900. The jet is a large obstacle across the middle.
  // Equipment is placed inside and around the jet. Some patients are
  // hidden behind the jet and in clusters of trees.
  const LEVELS = {
    'jet-crash': {
      id: 'jet-crash',
      name: 'Jet Crash — Forest Clearing',
      blurb: 'A passenger jet has crashed in a forest clearing. Find the survivors, find the right equipment, and treat them before it is too late.',
      patientTime: PATIENT_TIMER,
      playerStart: { x: 600, y: 820 },
      // Patient spawns: x, y, hidden, name, age, injuries[]
      patients: [
        { id: 0, x: 240,  y: 220, hidden: false, name: 'Alex',   age: 24,
          injuries: [{ type: 'cut', region: 'rightArm', offsetX: 0, offsetY: 30, rotation: 0.35, depth: 0.3, cleanliness: 0 }] },
        { id: 1, x: 960,  y: 340, hidden: false, name: 'Maya',   age: 31,
          injuries: [{ type: 'cut', region: 'leftLeg',  offsetX: 0, offsetY: 0,  rotation: 0.1,  depth: 0.8, cleanliness: 0 }] },
        { id: 2, x: 1080, y: 720, hidden: false, name: 'Jordan', age: 18,
          injuries: [{ type: 'broken', region: 'leftArm', offsetX: 0, offsetY: 20 }] },
        { id: 3, x: 360,  y: 540, hidden: true,  name: 'Sam',    age: 45, // behind jet
          injuries: [{ type: 'cut', region: 'torso', offsetX: 0, offsetY: 0, rotation: 0.2, depth: 0.5, cleanliness: 0 }] },
        { id: 4, x: 140,  y: 700, hidden: true,  name: 'Riley',  age: 28, // in trees
          injuries: [{ type: 'bruise', region: 'head', offsetX: 0, offsetY: 0 }] },
        { id: 5, x: 820,  y: 600, hidden: true,  name: 'Casey',  age: 52, // near jet, under debris
          injuries: [{ type: 'internal', region: 'torso', offsetX: 0, offsetY: 0 }] },
        { id: 6, x: 1060, y: 160, hidden: false, name: 'Drew',   age: 36,
          injuries: [{ type: 'cut', region: 'leftArm', offsetX: 0, offsetY: 20, rotation: -0.2, depth: 0.4, cleanliness: 0 }] }
      ],
      // Equipment spawns in the world
      envItems: [
        { type: 'cast',        x: 700, y: 460 },
        { type: 'bigBandage',  x: 660, y: 480 },
        { type: 'bigBandage',  x: 800, y: 470 },
        { type: 'cloth',       x: 380, y: 320 },
        { type: 'cloth',       x: 1040, y: 580 },
        { type: 'water',       x: 320, y: 620 },
        { type: 'water',       x: 900, y: 780 }
      ],
      // Static obstacles for collision
      obstacles: [
        // Jet: a long horizontal polygon (broken into fuselage + wing)
        { type: 'jet', x: 380, y: 380, w: 540, h: 130 },
        { type: 'jet', x: 880, y: 410, w: 120, h: 80 }, // wing sticking out
        // Trees
        { type: 'tree', x: 80,   y: 100 }, { type: 'tree', x: 150,  y: 340 },
        { type: 'tree', x: 90,   y: 560 }, { type: 'tree', x: 120,  y: 820 },
        { type: 'tree', x: 320,  y: 140 }, { type: 'tree', x: 480,  y: 100 },
        { type: 'tree', x: 700,  y: 120 }, { type: 'tree', x: 920,  y: 100 },
        { type: 'tree', x: 1130, y: 250 }, { type: 'tree', x: 1160, y: 540 },
        { type: 'tree', x: 1140, y: 800 }, { type: 'tree', x: 800,  y: 820 },
        { type: 'tree', x: 440,  y: 780 },
        // Fire patches
        { type: 'fire', x: 600, y: 360, r: 38 },
        { type: 'fire', x: 960, y: 500, r: 32 },
        { type: 'fire', x: 420, y: 480, r: 28 }
      ]
    }
  };

  /* ---------- 4. State ---------- */

  const state = {
    mode: 'menu',                  // 'menu' | 'exploring' | 'treating' | 'won' | 'lost'
    level: null,
    player: { x: 600, y: 800, r: 14 },
    keys: {},
    patients: [],                  // array of patient objects
    foundIds: new Set(),           // patients whose timer has started
    deadIds: new Set(),            // patients whose stability hit 0
    envItems: [],                  // items still in the world
    inventory: { cast: 0, bigBandage: 0, cloth: 0, water: 0 },
    // Treatment state (only when mode === 'treating')
    activePatientId: null,
    selectedInjuryId: null,
    activeAction: null,
    effects: [],
    toastTimer: 0,
    dt: 0,
    lastTime: 0,
    stats: { found: 0, treated: 0, lost: 0 }
  };

  /* ---------- 5. Helpers ---------- */

  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  function regionCenter(region) {
    const p = BODY[region];
    return { x: p.x, y: p.y };
  }

  function injuryPos(inj) {
    const c = regionCenter(inj.region);
    return { x: c.x + (inj.offsetX || 0), y: c.y + (inj.offsetY || 0) };
  }

  function findInjuryAt(x, y, injuries) {
    let best = null, bestD = 50;
    for (const inj of injuries) {
      if (inj.fixed) continue;
      const p = injuryPos(inj);
      const d = dist(x, y, p.x, p.y);
      if (d < bestD) { best = inj; bestD = d; }
    }
    return best;
  }

  function describeInjuryShort(inj) {
    if (!inj.examined) {
      if (inj.type === 'cut') return 'a cut, details unclear';
      if (inj.type === 'broken') return 'a possible fracture, details unclear';
      if (inj.type === 'bruise') return 'a bruise';
      if (inj.type === 'internal') return 'possible internal injury';
      return 'an injury';
    }
    const parts = [];
    if (inj.type === 'cut') {
      parts.push(inj.cleaned ? 'cut, cleaned' : 'cut, dirty');
      parts.push(inj.depth > 0.5 ? 'deep' : 'shallow');
    } else if (inj.type === 'broken') parts.push('fracture');
    else if (inj.type === 'internal') parts.push('internal');
    else if (inj.type === 'bruise') parts.push('bruise');
    if (inj.stitched) parts.push('stitched');
    if (inj.bandaged) parts.push('bandaged');
    if (inj.casted) parts.push('casted');
    if (inj.overTreated) parts.push(`over-treated x${inj.overTreated}`);
    return parts.join(', ');
  }

  // Circle vs rectangle collision (player vs obstacle)
  function collides(cx, cy, cr, ox, oy, ow, oh) {
    const nx = Math.max(ox, Math.min(cx, ox + ow));
    const ny = Math.max(oy, Math.min(cy, oy + oh));
    return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < cr * cr;
  }

  function obstacleCollides(x, y, r) {
    const obs = state.level.obstacles;
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      if (collides(x, y, r, o.x - 30, o.y - 30, o.w + 60, o.h + 60)) {
        if (o.type === 'tree' || o.type === 'jet') {
          if (collides(x, y, r, o.x, o.y, o.w, o.h)) return o;
        }
      }
    }
    return null;
  }

  /* ---------- 6. Audio (Web Audio synth) ---------- */

  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    }
    return audioCtx;
  }
  function beep(freq, dur, type = 'sine', vol = 0.15) {
    const ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  }
  const snd = {
    select: () => beep(620, 0.06, 'square', 0.06),
    action: () => beep(440, 0.1,  'sine',   0.10),
    pop:    () => beep(180, 0.18, 'sawtooth', 0.18),
    warn:   () => beep(330, 0.12, 'triangle',0.12),
    win:    () => { beep(660, 0.15, 'sine', 0.18); setTimeout(() => beep(880, 0.2, 'sine', 0.18), 120); },
    lose:   () => beep(220, 0.4,  'sawtooth', 0.18),
    pickup: () => { beep(520, 0.06, 'sine', 0.10); setTimeout(() => beep(720, 0.08, 'sine', 0.10), 60); },
    find:   () => beep(740, 0.08, 'sine', 0.12),
  };

  /* ---------- 7. UI helpers ---------- */

  const $ = (id) => document.getElementById(id);

  function showToast(msg, kind = '') {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show' + (kind ? ' ' + kind : '');
    state.toastTimer = 2.0;
  }
  function hideToast() {
    const t = $('toast');
    if (t) t.className = 'toast';
  }

  function showMenu() {
    state.mode = 'menu';
    $('menu-overlay').style.display = 'flex';
    $('result-overlay').style.display = 'none';
    $('treat-bar').style.display = 'none';
  }

  function showResult(won, reason) {
    state.mode = won ? 'won' : 'lost';
    $('menu-overlay').style.display = 'none';
    $('result-overlay').style.display = 'flex';
    $('treat-bar').style.display = 'none';
    const title = $('result-title');
    title.className = won ? 'win' : 'lose';
    if (won) {
      title.textContent = 'All patients stabilized';
      $('result-text').textContent = 'You triaged and treated every survivor in time.';
    } else {
      title.textContent = 'Mission failed';
      $('result-text').textContent = reason === 'losses'
        ? 'Too many patients were lost before you could reach them.'
        : 'A patient died while you were treating someone else.';
    }
    const stats = $('result-stats');
    stats.innerHTML = `
      <div class="stat"><span class="v">${state.stats.found}</span><span class="l">Found</span></div>
      <div class="stat"><span class="v">${state.stats.treated}</span><span class="l">Treated</span></div>
      <div class="stat"><span class="v">${state.stats.lost}</span><span class="l">Lost</span></div>
    `;
  }

  /* ---------- 8. Level / game lifecycle ---------- */

  function startLevel(id) {
    const def = LEVELS[id];
    if (!def) return;
    state.level = def;
    state.player.x = def.playerStart.x;
    state.player.y = def.playerStart.y;
    state.patients = def.patients.map(p => ({
      ...p,
      injuries: p.injuries.map((i, idx) => ({ ...i, id: idx, examined: false, fixed: false, overTreated: 0 })),
      found: false,
      timer: def.patientTime,
      stability: 100
    }));
    state.foundIds = new Set();
    state.deadIds = new Set();
    state.envItems = def.envItems.map(it => ({ ...it, picked: false }));
    state.inventory = { cast: 0, bigBandage: 0, cloth: 0, water: 0 };
    state.activePatientId = null;
    state.selectedInjuryId = null;
    state.activeAction = null;
    state.effects = [];
    state.stats = { found: 0, treated: 0, lost: 0 };
    state.mode = 'exploring';
    state.lastTime = performance.now();
    $('menu-overlay').style.display = 'none';
    $('result-overlay').style.display = 'none';
    $('treat-bar').style.display = 'none';
    snd.find();
    showToast(`Mission started: ${def.name}`, 'good');
    requestAnimationFrame(loop);
  }

  function enterTreatMode(patient) {
    state.activePatientId = patient.id;
    state.selectedInjuryId = patient.injuries[0]?.id ?? null;
    state.activeAction = null;
    state.mode = 'treating';
    $('treat-bar').style.display = 'flex';
    $('result-overlay').style.display = 'none';
  }

  function exitTreatMode() {
    if (state.mode !== 'treating') return;
    state.activePatientId = null;
    state.selectedInjuryId = null;
    state.activeAction = null;
    state.mode = 'exploring';
    $('treat-bar').style.display = 'none';
  }

  /* ---------- 9. Update ---------- */

  function tick(dt) {
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) hideToast();
    }

    if (state.mode === 'exploring') {
      tickExplore(dt);
    } else if (state.mode === 'treating') {
      tickTreat(dt);
    }
  }

  function tickExplore(dt) {
    // Player movement
    let dx = 0, dy = 0;
    if (state.keys['w'] || state.keys['arrowup'])    dy -= 1;
    if (state.keys['s'] || state.keys['arrowdown'])  dy += 1;
    if (state.keys['a'] || state.keys['arrowleft'])  dx -= 1;
    if (state.keys['d'] || state.keys['arrowright']) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx = dx / len * PLAYER_SPEED * dt;
      dy = dy / len * PLAYER_SPEED * dt;
      // Try X then Y separately for clean sliding
      const nx = state.player.x + dx;
      if (!obstacleCollides(nx, state.player.y, state.player.r)) state.player.x = nx;
      const ny = state.player.y + dy;
      if (!obstacleCollides(state.player.x, ny, state.player.r)) state.player.y = ny;
      // Clamp to world
      state.player.x = Math.max(20, Math.min(CANVAS_W - 20, state.player.x));
      state.player.y = Math.max(20, Math.min(CANVAS_H - 20, state.player.y));
    }

    // Patient timers + reveals
    for (const p of state.patients) {
      if (state.deadIds.has(p.id)) continue;
      if (!p.found) {
        if (dist(state.player.x, state.player.y, p.x, p.y) < REVEAL_RADIUS) {
          p.revealed = true;
        }
        if (dist(state.player.x, state.player.y, p.x, p.y) < INTERACT_RADIUS) {
          p.found = true;
          state.foundIds.add(p.id);
          state.stats.found += 1;
          showToast(`${p.name} found — ${p.injuries.length} injury. 170s to treat.`, 'good');
          snd.find();
        }
      } else {
        // Tick down the per-patient clock
        p.timer -= dt;
        if (p.timer <= 0) {
          p.stability = 0;
          state.deadIds.add(p.id);
          state.stats.lost += 1;
          showToast(`${p.name} did not survive.`, 'bad');
          snd.lose();
          if (state.stats.lost > MAX_LOSSES) {
            showResult(false, 'losses'); snd.lose(); return;
          }
        } else {
          // Stability drops slowly once found (the clock is the real pressure,
          // but stability also drops from the injury itself over time)
          p.stability = Math.max(0, p.stability - dt * 1.0);
          if (p.stability <= 0) {
            state.deadIds.add(p.id);
            state.stats.lost += 1;
            showToast(`${p.name} did not survive.`, 'bad');
            snd.lose();
            if (state.stats.lost > MAX_LOSSES) {
              showResult(false, 'losses'); snd.lose(); return;
            }
          }
        }
      }
    }

    // Check win: all patients found and all injuries fixed
    const alive = state.patients.filter(p => !state.deadIds.has(p.id));
    const allTreated = alive.length > 0 && alive.every(p => p.injuries.every(i => i.fixed));
    if (allTreated) { showResult(true); snd.win(); return; }
  }

  function tickTreat(dt) {
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) hideToast();
    }
    const patient = state.patients.find(p => p.id === state.activePatientId);
    if (!patient) { exitTreatMode(); return; }

    // Active action progress
    if (state.activeAction) {
      state.activeAction.timeLeft -= dt;
      if (state.activeAction.timeLeft <= 0) completeAction();
    }

    // Per-patient timer keeps ticking (real-emergency pressure)
    patient.timer -= dt;
    if (patient.timer <= 0) {
      patient.stability = 0;
      state.deadIds.add(patient.id);
      state.stats.lost += 1;
      showToast(`${patient.name} did not survive.`, 'bad');
      snd.lose();
      exitTreatMode();
      if (state.stats.lost > MAX_LOSSES) { showResult(false, 'losses'); snd.lose(); }
      return;
    }

    // Injury state update (bleeding, stitch pop, pain)
    let damage = 0;
    for (const inj of patient.injuries) {
      if (inj.fixed) continue;
      if (inj.type === 'cut') {
        const isBleeding = !inj.stitched || inj.popChance >= 0.5;
        if (isBleeding) damage += inj.depth * 6;
        if (inj.stitched && inj.popChance > 0 && Math.random() < inj.popChance * dt) {
          inj.stitched = false; inj.popChance = 0; inj.fixed = false;
          spawnPopEffect(inj); showToast('Sutures popped!', 'bad'); snd.pop();
        }
      } else if (inj.type === 'broken') {
        if (!inj.casted) damage += 4.5;
      } else if (inj.type === 'internal') {
        damage += 5.0;
      } else if (inj.type === 'bruise') {
        damage += 0.6;
      }
      if (inj.overTreated) damage += inj.overTreated * 1.2;
    }
    patient.stability -= damage * dt;
    if (patient.stability <= 0) {
      patient.stability = 0;
      state.deadIds.add(patient.id);
      state.stats.lost += 1;
      showToast(`${patient.name} did not survive.`, 'bad');
      snd.lose();
      exitTreatMode();
      if (state.stats.lost > MAX_LOSSES) { showResult(false, 'losses'); snd.lose(); }
      return;
    }

    // Win check for this patient: all injuries fixed
    if (patient.injuries.every(i => i.fixed)) {
      state.stats.treated += 1;
      showToast(`${patient.name} stabilized!`, 'good');
      snd.win();
      exitTreatMode();
    }
  }

  function spawnBleedDrop(inj) {
    const p = injuryPos(inj);
    state.effects.push({ type: 'bleed', x: p.x + (Math.random() - 0.5) * 24, y: p.y + 8, vy: 40 + Math.random() * 30, life: 1.0, maxLife: 1.0 });
  }
  function spawnPopEffect(inj) {
    const p = injuryPos(inj);
    state.effects.push({ type: 'pop', x: p.x, y: p.y, life: 0.6, maxLife: 0.6 });
  }
  function spawnCleanEffect(inj) {
    const p = injuryPos(inj);
    for (let i = 0; i < 6; i++) {
      state.effects.push({ type: 'sparkle', x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, life: 0.8, maxLife: 0.8 });
    }
  }

  function completeAction() {
    const a = state.activeAction;
    if (!a) return;
    const patient = state.patients.find(p => p.id === state.activePatientId);
    if (!patient) { state.activeAction = null; return; }
    const inj = patient.injuries.find(i => i.id === a.targetId);
    if (!inj) { state.activeAction = null; return; }
    const def = a.def;
    const res = def.effect(inj, state.inventory);
    if (a.actionKey === 'examine') inj.examined = true;
    if (a.actionKey === 'clean') spawnCleanEffect(inj);
    if (res.msg) showToast(res.msg, res.ok ? 'good' : 'bad');
    snd.action();
    state.activeAction = null;
  }

  /* ---------- 10. Render ---------- */

  const canvas = $('game-canvas');
  const ctx = canvas.getContext('2d');

  function render() {
    if (state.mode === 'exploring') renderWorld();
    else if (state.mode === 'treating') renderTreat();
    else if (state.mode === 'won' || state.mode === 'lost') {
      // Keep the last world frame under the result overlay
      renderWorld();
    }
  }

  function renderWorld() {
    drawBackground();
    drawObstacles();
    drawEnvItems();
    drawPatients();
    drawPlayer();
    drawFireAnimation();
    drawVignette();
    drawInteractHint();
  }

  function drawBackground() {
    // Base ground
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Subtle pattern
    ctx.fillStyle = COLORS.groundAlt;
    for (let x = 0; x < CANVAS_W; x += 80) {
      for (let y = 0; y < CANVAS_H; y += 80) {
        if ((x + y) % 160 === 0) ctx.fillRect(x, y, 4, 4);
      }
    }
    // World border
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, CANVAS_W - 4, CANVAS_H - 4);
  }

  function drawObstacles() {
    // Trees first (behind everything)
    for (const o of state.level.obstacles) {
      if (o.type === 'tree') drawTree(o.x, o.y);
    }
    // Jet
    for (const o of state.level.obstacles) {
      if (o.type === 'jet') drawJet(o.x, o.y, o.w, o.h);
    }
  }

  function drawTree(x, y) {
    // Trunk
    ctx.fillStyle = COLORS.treeTrunk;
    ctx.fillRect(x - 8, y - 8, 16, 24);
    // Canopy
    ctx.fillStyle = COLORS.treeCanopy;
    ctx.beginPath();
    ctx.arc(x, y - 18, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.treeCanopyAlt;
    ctx.beginPath();
    ctx.arc(x - 8, y - 24, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawJet(x, y, w, h) {
    // Main fuselage
    ctx.fillStyle = COLORS.jetDark;
    roundRect(x, y, w, h, 14, true);
    ctx.fillStyle = COLORS.jet;
    roundRect(x + 4, y + 4, w - 8, h - 22, 10, true);
    // Stripe
    ctx.fillStyle = COLORS.jetAccent;
    ctx.fillRect(x + 10, y + h / 2 - 3, w - 20, 6);
    // Windows
    ctx.fillStyle = '#a0c4d8';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(x + 30 + i * 55, y + h / 2 - 12, 30, 8);
    }
    // Damage: jagged tear
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.35, y + h);
    ctx.lineTo(x + w * 0.45, y + h - 35);
    ctx.lineTo(x + w * 0.55, y + h);
    ctx.closePath();
    ctx.fill();
  }

  function drawFireAnimation() {
    const t = performance.now() / 200;
    for (const o of state.level.obstacles) {
      if (o.type !== 'fire') continue;
      const flicker = 0.85 + 0.15 * Math.sin(t + o.x);
      // Outer flame
      ctx.fillStyle = COLORS.fire1;
      ctx.globalAlpha = 0.5 * flicker;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
      // Mid flame
      ctx.fillStyle = COLORS.fire2;
      ctx.globalAlpha = 0.7 * flicker;
      ctx.beginPath();
      ctx.arc(o.x, o.y - 3, o.r * 0.65, 0, Math.PI * 2);
      ctx.fill();
      // Inner flame
      ctx.fillStyle = COLORS.fire3;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(o.x, o.y - 5, o.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawVignette() {
    // Subtle red vignette near fire for atmosphere
    for (const o of state.level.obstacles) {
      if (o.type !== 'fire') continue;
      const grad = ctx.createRadialGradient(o.x, o.y, 10, o.x, o.y, 120);
      grad.addColorStop(0, 'rgba(255, 80, 30, 0.18)');
      grad.addColorStop(1, 'rgba(255, 80, 30, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(o.x - 120, o.y - 120, 240, 240);
    }
  }

  function drawEnvItems() {
    for (const it of state.envItems) {
      if (it.picked) continue;
      const def = ENV_ITEMS[it.type];
      // Glow if player is close
      const close = dist(state.player.x, state.player.y, it.x, it.y) < INTERACT_RADIUS;
      ctx.save();
      ctx.translate(it.x, it.y);
      // Backing circle
      ctx.fillStyle = close ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 215, 0, 0.15)';
      ctx.beginPath();
      ctx.arc(0, 0, close ? 18 : 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = close ? COLORS.item : 'rgba(255,215,0,0.5)';
      ctx.lineWidth = close ? 2 : 1;
      ctx.stroke();
      // Icon (emoji as text)
      ctx.font = close ? '20px sans-serif' : '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(def.icon, 0, 1);
      // Label on close
      if (close) {
        ctx.font = '600 11px -apple-system, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(def.name, 0, -26);
        ctx.fillText('[E] Pick up', 0, 28);
      }
      ctx.restore();
    }
  }

  function drawPatients() {
    for (const p of state.patients) {
      if (state.deadIds.has(p.id)) continue;
      const visible = !p.hidden || p.revealed;
      const close = dist(state.player.x, state.player.y, p.x, p.y) < INTERACT_RADIUS;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (!visible) {
        // Hidden: just a '?' mark
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 1);
      } else {
        // Body: lying figure (oval + head)
        ctx.fillStyle = p.found ? COLORS.patient : COLORS.patient2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f0d0b0';
        ctx.beginPath();
        ctx.arc(-22, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        // Injury indicator (red glow over body)
        ctx.fillStyle = 'rgba(196, 60, 60, 0.5)';
        ctx.beginPath();
        ctx.arc(0, -2, 10, 0, Math.PI * 2);
        ctx.fill();
        // Name + state
        ctx.font = '600 12px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#fff';
        ctx.fillText(p.name, 0, 16);
        if (p.found) {
          // Timer bar
          const t = Math.max(0, p.timer) / p._maxTimer;
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(-30, 30, 60, 6);
          ctx.fillStyle = t > 0.5 ? COLORS.stabilityOk : t > 0.25 ? '#e0a050' : COLORS.stabilityBad;
          ctx.fillRect(-30, 30, 60 * t, 6);
          ctx.font = '600 10px -apple-system, sans-serif';
          ctx.fillStyle = '#fff';
          ctx.fillText(Math.ceil(p.timer) + 's', 0, 38);
        }
        if (close && p.found && state.mode === 'exploring') {
          ctx.font = '600 11px -apple-system, sans-serif';
          ctx.fillStyle = '#fff';
          ctx.fillText('[E] Treat', 0, -28);
        }
      }
      ctx.restore();
    }
  }

  function drawPlayer() {
    const p = state.player;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body (medic)
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Cross
    ctx.fillStyle = COLORS.playerCross;
    ctx.fillRect(p.x - 7, p.y - 2, 14, 4);
    ctx.fillRect(p.x - 2, p.y - 7, 4, 14);
  }

  function drawInteractHint() {
    if (state.mode !== 'exploring') return;
    // Find nearest interactable
    let nearest = null, nearestD = INTERACT_RADIUS + 1;
    for (const p of state.patients) {
      if (state.deadIds.has(p.id) || !p.found) continue;
      const d = dist(state.player.x, state.player.y, p.x, p.y);
      if (d < nearestD) { nearest = { type: 'patient', obj: p, d }; nearestD = d; }
    }
    for (const it of state.envItems) {
      if (it.picked) continue;
      const d = dist(state.player.x, state.player.y, it.x, it.y);
      if (d < nearestD) { nearest = { type: 'item', obj: it, d }; nearestD = d; }
    }
    if (!nearest) return;
    // Drawn in the bottom bar via DOM; nothing on canvas for this.
  }

  function renderTreat() {
    // Treatment background
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#243140');
    grad.addColorStop(1, '#1a2330');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawPatient();
    for (const inj of activePatient().injuries) drawInjury(inj);
    drawEffects();
    drawActionOverlay();
    drawVitalsOverlay();
  }

  function activePatient() {
    return state.patients.find(p => p.id === state.activePatientId);
  }

  function drawPatient() {
    const skin = '#f0d0b0';
    const skinShadow = 'rgba(0,0,0,0.12)';
    const cloth = '#4a90b8';
    const clothDark = '#3a7a9a';

    // Legs
    ctx.fillStyle = cloth;
    roundRect(540, 620, 80, 240, 10, true);
    roundRect(660, 620, 80, 240, 10, true);
    ctx.fillStyle = clothDark;
    roundRect(540, 620, 6, 240, 3, true);
    roundRect(660, 620, 6, 240, 3, true);

    // Torso
    ctx.fillStyle = cloth;
    roundRect(500, 300, 200, 220, 14, true);
    ctx.fillStyle = clothDark;
    ctx.beginPath();
    ctx.moveTo(540, 300);
    ctx.quadraticCurveTo(600, 322, 660, 300);
    ctx.lineTo(660, 312);
    ctx.quadraticCurveTo(600, 336, 540, 312);
    ctx.closePath();
    ctx.fill();

    // Arms
    ctx.fillStyle = skin;
    roundRect(420, 300, 80, 200, 14, true);
    roundRect(740, 300, 80, 200, 14, true);
    ctx.fillStyle = skinShadow;
    roundRect(420, 300, 6, 200, 3, true);
    roundRect(740, 300, 6, 200, 3, true);

    // Hands
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(460, 510, 18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(780, 510, 18, 0, Math.PI * 2); ctx.fill();

    // Neck
    ctx.fillStyle = skin;
    roundRect(570, 260, 60, 45, 6, true);

    // Head
    ctx.beginPath(); ctx.arc(600, 200, 65, 0, Math.PI * 2); ctx.fill();

    // Hair
    ctx.fillStyle = '#3a2a20';
    ctx.beginPath();
    ctx.arc(600, 180, 66, Math.PI * 1.1, Math.PI * 1.9, false);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(580, 200, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(620, 200, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.arc(580, 201, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(620, 201, 3.5, 0, Math.PI * 2); ctx.fill();

    // Mouth (pain-driven)
    const pain = 1 - activePatient().stability / 100;
    if (pain > 0.6) {
      ctx.fillStyle = '#3a2a2a';
      ctx.beginPath(); ctx.ellipse(600, 232, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else if (pain > 0.3) {
      ctx.strokeStyle = '#7a4a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(588, 232); ctx.quadraticCurveTo(600, 226, 612, 232); ctx.stroke();
    } else {
      ctx.strokeStyle = '#7a4a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(588, 230); ctx.quadraticCurveTo(600, 234, 612, 230); ctx.stroke();
    }

    // Eyebrows
    ctx.strokeStyle = '#3a2a20';
    ctx.lineWidth = 3;
    if (pain > 0.5) {
      ctx.beginPath();
      ctx.moveTo(564, 184); ctx.lineTo(588, 192);
      ctx.moveTo(636, 184); ctx.lineTo(612, 192);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(564, 190); ctx.lineTo(588, 190);
      ctx.moveTo(636, 190); ctx.lineTo(612, 190);
      ctx.stroke();
    }
  }

  function drawInjury(inj) {
    const p = injuryPos(inj);
    const x = p.x, y = p.y;
    if (state.selectedInjuryId === inj.id) {
      ctx.strokeStyle = COLORS.selectionRing;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (inj.type === 'cut') drawCut(x, y, inj);
    else if (inj.type === 'broken') drawBroken(x, y, inj);
    else if (inj.type === 'bruise') drawBruise(x, y, inj);
    else if (inj.type === 'internal') drawInternal(x, y, inj);
  }

  function drawCut(x, y, inj) {
    const rot = inj.rotation || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (!inj.cleaned) {
      ctx.fillStyle = 'rgba(110, 80, 50, 0.55)';
      ctx.beginPath(); ctx.ellipse(0, 4, 32, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#a31a1a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-30, -7); ctx.quadraticCurveTo(0, 0, 30, 7);
    ctx.stroke();
    if (inj.stitched) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1.8;
      for (let i = -24; i <= 24; i += 9) {
        ctx.beginPath();
        ctx.moveTo(i, -5 + i * 0.23); ctx.lineTo(i, -12 + i * 0.23);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i - 1.5, -8.5 + i * 0.23); ctx.lineTo(i + 1.5, -8.5 + i * 0.23);
        ctx.stroke();
      }
      if (inj.popChance > 0) {
        ctx.strokeStyle = `rgba(255, 80, 60, ${0.5 + 0.4 * Math.sin(performance.now() / 200)})`;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-30, -7); ctx.quadraticCurveTo(0, 0, 30, 7);
        ctx.stroke();
      }
    }
    if (inj.bandaged) {
      ctx.fillStyle = '#fbf2dc';
      ctx.strokeStyle = '#b8a888';
      ctx.lineWidth = 1.5;
      roundRect(-36, -18, 72, 36, 4, true); ctx.stroke();
      ctx.fillStyle = '#c44';
      ctx.fillRect(-3, -11, 6, 22);
      ctx.fillRect(-11, -3, 22, 6);
    }
    if (inj.examined && !inj.fixed) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath(); ctx.arc(32, -20, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b7da6';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', 32, -20);
    }
    ctx.restore();
  }

  function drawBroken(x, y, inj) {
    ctx.save();
    ctx.translate(x, y);
    if (inj.casted) {
      ctx.fillStyle = '#f0f0f0';
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5;
      roundRect(-50, -20, 100, 40, 6, true); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      for (let i = -44; i < 44; i += 9) {
        ctx.beginPath(); ctx.moveTo(i, -18); ctx.lineTo(i, 18); ctx.stroke();
      }
      ctx.fillStyle = '#ccc';
      ctx.fillRect(-50, -3, 100, 6);
    } else {
      ctx.strokeStyle = '#a31a1a';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-34, 0); ctx.lineTo(-14, -9); ctx.lineTo(0, 5);
      ctx.lineTo(16, -7); ctx.lineTo(34, 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 100, 80, ${0.4 + 0.3 * Math.sin(performance.now() / 200)})`;
      ctx.lineWidth = 10;
      ctx.stroke();
    }
    if (inj.examined) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath(); ctx.arc(38, -25, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b7da6';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', 38, -25);
    }
    ctx.restore();
  }

  function drawBruise(x, y, inj) {
    ctx.save(); ctx.translate(x, y);
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    grad.addColorStop(0, 'rgba(110, 40, 130, 0.7)');
    grad.addColorStop(1, 'rgba(110, 40, 130, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawInternal(x, y, inj) {
    if (!inj.examined) return;
    ctx.save(); ctx.translate(x, y);
    const t = performance.now() / 500;
    const r = 28 + Math.sin(t) * 3;
    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
    grad.addColorStop(0, 'rgba(255, 200, 80, 0.4)');
    grad.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawEffects() {
    for (let i = state.effects.length - 1; i >= 0; i--) {
      const e = state.effects[i];
      e.life -= state.dt;
      if (e.life <= 0) { state.effects.splice(i, 1); continue; }
      const alpha = e.life / e.maxLife;
      if (e.type === 'bleed') {
        const fallDist = (e.maxLife - e.life) * e.vy;
        ctx.fillStyle = `rgba(196, 30, 30, ${alpha})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y + fallDist, 3 + (1 - alpha) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'pop') {
        const r = (1 - alpha) * 36 + 5;
        ctx.strokeStyle = `rgba(255, 90, 90, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
      } else if (e.type === 'sparkle') {
        e.x += (e.vx || 0) * state.dt;
        e.y += (e.vy || 0) * state.dt;
        ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawActionOverlay() {
    if (!state.activeAction) return;
    const a = state.activeAction;
    const progress = 1 - (a.timeLeft / a.total);
    const barX = 200, barY = CANVAS_H - 40, barW = CANVAS_W - 400, barH = 16;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(barX, barY, barW, barH, 5, true);
    ctx.fillStyle = '#2b7da6';
    roundRect(barX, barY, barW * progress, barH, 5, true);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '600 14px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${a.def.icon} ${a.def.name}…`, barX + barW / 2, barY - 14);
  }

  function drawVitalsOverlay() {
    const p = activePatient();
    if (!p) return;
    if (p.stability < 30) {
      const t = (performance.now() / 600) % 1;
      const alpha = Math.max(0, 1 - t * 2) * 0.35;
      ctx.fillStyle = `rgba(255, 60, 60, ${alpha})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  function roundRect(x, y, w, h, r, fill) {
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
    if (fill) ctx.fill();
  }

  /* ---------- 11. Side panel UI ---------- */

  function updateSidePanel() {
    if (!state.level) return;
    if (state.mode === 'exploring') updateSideExplore();
    else if (state.mode === 'treating') updateSideTreat();
  }

  function updateSideExplore() {
    $('side-explore').style.display = 'block';
    $('side-treat').style.display = 'none';

    // Patient summary
    const found = state.patients.filter(p => state.foundIds.has(p.id) && !state.deadIds.has(p.id));
    const dead = state.deadIds.size;
    const total = state.patients.length;
    $('ex-found').textContent = `${found.length} / ${total} found`;
    $('ex-dead').textContent = `${dead} lost`;

    // Patient list
    const list = $('ex-patient-list');
    list.innerHTML = state.patients.map(p => {
      if (state.deadIds.has(p.id)) {
        return `<div class="patient-row dead"><span class="name">${p.name}</span><span class="status">lost</span></div>`;
      }
      if (!p.found) {
        return `<div class="patient-row"><span class="name">${p.name}</span><span class="status">— not found —</span></div>`;
      }
      const t = Math.max(0, p.timer);
      const lowT = t < 30;
      return `<div class="patient-row${lowT ? ' urgent' : ''}">
        <span class="name">${p.name}</span>
        <span class="status">${Math.ceil(t)}s</span>
      </div>`;
    }).join('');

    // Inventory
    $('inv-cast').textContent = state.inventory.cast;
    $('inv-bigBandage').textContent = state.inventory.bigBandage;
    $('inv-cloth').textContent = state.inventory.cloth;
    $('inv-water').textContent = state.inventory.water;

    // Interact hint
    let hint = 'WASD / arrows: move';
    let nearest = null, nearestD = INTERACT_RADIUS + 1;
    for (const p of state.patients) {
      if (state.deadIds.has(p.id) || !p.found) continue;
      const d = dist(state.player.x, state.player.y, p.x, p.y);
      if (d < nearestD) { nearest = { type: 'patient', obj: p }; nearestD = d; }
    }
    for (const it of state.envItems) {
      if (it.picked) continue;
      const d = dist(state.player.x, state.player.y, it.x, it.y);
      if (d < nearestD) { nearest = { type: 'item', obj: it }; nearestD = d; }
    }
    if (nearest) {
      if (nearest.type === 'patient') hint = `[E] or click: treat ${nearest.obj.name}`;
      else hint = `[E] or click: pick up ${ENV_ITEMS[nearest.obj.type].name}`;
    }
    $('ex-hint').textContent = hint;
  }

  function updateSideTreat() {
    $('side-explore').style.display = 'none';
    $('side-treat').style.display = 'block';
    const p = activePatient();
    if (!p) return;
    $('tr-name').textContent = `${p.name}, ${p.age}`;
    $('tr-timer').textContent = Math.max(0, Math.ceil(p.timer)) + 's';
    $('tr-stab').textContent = Math.max(0, Math.round(p.stability)) + '%';
    $('tr-stab-bar').className = 'bar ' + (p.stability < 30 ? 'danger' : p.stability < 60 ? 'warn' : 'info');
    $('tr-stab-fill').style.width = Math.max(0, Math.min(100, p.stability)) + '%';

    // Injury list
    const list = $('tr-injuries');
    list.innerHTML = p.injuries.map(inj => {
      const sel = state.selectedInjuryId === inj.id;
      return `<div class="injury${sel ? ' selected' : ''}${inj.fixed ? ' fixed' : ''}" data-id="${inj.id}">
        <div class="title">
          <span>${BODY[inj.region].label}</span>
          <span class="type ${inj.type}">${inj.type}</span>
        </div>
        <div class="meta">${injuryStatusText(inj)}</div>
      </div>`;
    }).join('');
    list.querySelectorAll('.injury').forEach(el => {
      el.addEventListener('click', () => {
        state.selectedInjuryId = Number(el.dataset.id);
        snd.select();
      });
    });

    // Equipment: sidebar items (always) + inventory items (collected)
    const eq = $('tr-equip');
    const inj = p.injuries.find(i => i.id === state.selectedInjuryId);
    let html = '<div class="equip-section-title">Sidebar (always available)</div>';
    html += '<div class="equip-grid">';
    for (const key of Object.keys(SIDEBAR_ITEMS)) {
      const a = SIDEBAR_ITEMS[key];
      const available = !state.activeAction && inj && a.canApply(inj, state.inventory);
      html += `<button class="equip-btn" data-action="sb:${key}"${available ? '' : ' disabled'}>
        <span class="icon">${a.icon}</span>${a.name}<span class="meta">${a.time}s</span>
      </button>`;
    }
    html += '</div>';
    html += '<div class="equip-section-title">Inventory (from the environment)</div>';
    html += '<div class="equip-grid">';
    let hasAny = false;
    for (const key of ['cast', 'bigBandage', 'cloth', 'water']) {
      const a = ENV_ITEMS[key];
      const have = state.inventory[key];
      if (have <= 0) continue;
      hasAny = true;
      // water is only used by medicine automatically; it has no direct apply
      const available = !state.activeAction && key !== 'water' && inj && a.canApply(inj);
      html += `<button class="equip-btn" data-action="env:${key}"${available ? '' : ' disabled'}>
        <span class="icon">${a.icon}</span>${a.name} <small>×${have}</small><span class="meta">${a.time}s</span>
      </button>`;
    }
    if (!hasAny) {
      html += '<p class="muted" style="font-size: 12px; margin: 4px 0 0;">Nothing picked up yet. Find equipment in the world.</p>';
    }
    html += '</div>';
    eq.innerHTML = html;
    eq.querySelectorAll('.equip-btn').forEach(el => {
      el.addEventListener('click', () => {
        if (el.disabled) return;
        const [src, key] = el.dataset.action.split(':');
        startAction(src, key);
      });
    });

    // Close button
    $('tr-close').onclick = exitTreatMode;
  }

  function injuryStatusText(inj) {
    if (inj.fixed) return '<span class="ok">treated</span>';
    const parts = [];
    if (inj.type === 'cut') {
      parts.push(inj.examined ? (inj.cleaned ? 'cleaned' : 'dirty') : '?');
      parts.push(inj.examined ? (inj.depth > 0.5 ? 'deep' : 'shallow') : '?');
      if (inj.stitched) parts.push('<span class="ok">sutured</span>');
      if (inj.bandaged) parts.push('<span class="ok">bandaged</span>');
      if (inj.popChance > 0) parts.push('<span class="danger">at risk</span>');
    } else if (inj.type === 'broken') {
      parts.push(inj.examined ? 'fracture' : '?');
      if (inj.casted) parts.push('<span class="ok">casted</span>');
    } else if (inj.type === 'internal') {
      parts.push(inj.examined ? 'internal' : '?');
    } else if (inj.type === 'bruise') {
      parts.push('bruise');
    }
    if (inj.overTreated) parts.push(`<span class="danger">over-treated x${inj.overTreated}</span>`);
    return parts.join(' · ');
  }

  /* ---------- 12. Action start / input ---------- */

  function startAction(src, key) {
    if (state.activeAction) return;
    const p = activePatient();
    if (!p) return;
    const inj = p.injuries.find(i => i.id === state.selectedInjuryId);
    if (!inj) {
      showToast('Select an injury first.', 'bad');
      return;
    }
    const def = (src === 'sb' ? SIDEBAR_ITEMS : ENV_ITEMS)[key];
    if (!def) return;
    if (!def.canApply(inj, state.inventory)) {
      showToast('That action does not apply here.', 'bad');
      snd.warn();
      return;
    }
    state.activeAction = {
      actionKey: key, def,
      targetId: inj.id, timeLeft: def.time, total: def.time
    };
  }

  function onKeyDown(e) {
    state.keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape') {
      if (state.mode === 'treating') exitTreatMode();
    }
    if (e.key === 'e' || e.key === 'E') {
      if (state.mode === 'exploring') tryInteract();
    }
  }
  function onKeyUp(e) {
    state.keys[e.key.toLowerCase()] = false;
  }

  function tryInteract() {
    if (state.mode !== 'exploring') return;
    // Prefer patient, then item
    let nearest = null, nearestD = INTERACT_RADIUS + 1;
    for (const p of state.patients) {
      if (state.deadIds.has(p.id) || !p.found) continue;
      const d = dist(state.player.x, state.player.y, p.x, p.y);
      if (d < nearestD) { nearest = { type: 'patient', obj: p }; nearestD = d; }
    }
    for (const it of state.envItems) {
      if (it.picked) continue;
      const d = dist(state.player.x, state.player.y, it.x, it.y);
      if (d < nearestD) { nearest = { type: 'item', obj: it }; nearestD = d; }
    }
    if (!nearest) return;
    if (nearest.type === 'patient') {
      enterTreatMode(nearest.obj);
    } else {
      pickupItem(nearest.obj);
    }
  }

  function pickupItem(it) {
    it.picked = true;
    state.inventory[it.type] += 1;
    snd.pickup();
    showToast(`Picked up ${ENV_ITEMS[it.type].name}.`, 'good');
  }

  function onCanvasClick(e) {
    if (state.mode === 'menu') {
      // Start mission button in the menu overlay
      return;
    }
    if (state.mode === 'won' || state.mode === 'lost') return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const y = (e.clientY - rect.top) * (CANVAS_H / rect.height);

    if (state.mode === 'treating') {
      const p = activePatient();
      if (!p) return;
      const inj = findInjuryAt(x, y, p.injuries);
      if (inj) {
        state.selectedInjuryId = inj.id;
        snd.select();
      }
      return;
    }

    if (state.mode === 'exploring') {
      // Click on patient (when close) to treat, or item to pick up
      let nearest = null, nearestD = INTERACT_RADIUS + 1;
      for (const p of state.patients) {
        if (state.deadIds.has(p.id) || !p.found) continue;
        const d = dist(x, y, p.x, p.y);
        if (d < nearestD) { nearest = { type: 'patient', obj: p, d }; nearestD = d; }
      }
      for (const it of state.envItems) {
        if (it.picked) continue;
        const d = dist(x, y, it.x, it.y);
        if (d < nearestD) { nearest = { type: 'item', obj: it, d }; nearestD = d; }
      }
      if (nearest) {
        if (nearest.type === 'patient') enterTreatMode(nearest.obj);
        else pickupItem(nearest.obj);
      }
    }
  }

  /* ---------- 13. Game loop ---------- */

  function loop(now) {
    if (state.mode === 'menu' || state.mode === 'won' || state.mode === 'lost') return;
    const dt = Math.min(0.1, (now - state.lastTime) / 1000);
    state.lastTime = now;
    state.dt = dt;
    tick(dt);
    render();
    updateSidePanel();
    requestAnimationFrame(loop);
  }

  /* ---------- 14. Init ---------- */

  function init() {
    canvas.addEventListener('click', onCanvasClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Build menu
    const grid = $('challenge-grid');
    grid.innerHTML = Object.values(LEVELS).map(c => `
      <button class="challenge" data-id="${c.id}">
        <h4>${c.name}</h4>
        <p>${c.blurb}</p>
        <span class="diff hard">mission</span>
      </button>
    `).join('');
    grid.querySelectorAll('.challenge').forEach(el => {
      el.addEventListener('click', () => startLevel(el.dataset.id));
    });

    $('result-retry').addEventListener('click', () => { if (state.level) startLevel(state.level.id); else showMenu(); });
    $('result-menu').addEventListener('click', showMenu);

    // Pre-compute patient _maxTimer for the bar fill ratio
    for (const def of Object.values(LEVELS)) {
      for (const p of def.patients) p._maxTimer = def.patientTime;
    }

    showMenu();

    // Dev shortcut: game.html#jet-crash auto-starts the mission;
    // game.html#jet-crash:0 also enters treatment mode for the first patient.
    if (location.hash) {
      const [id, idxStr] = location.hash.slice(1).split(':');
      if (LEVELS[id]) {
        setTimeout(() => {
          startLevel(id);
          if (idxStr !== undefined) {
            const idx = Number(idxStr);
            const p = state.patients[idx];
            if (p) {
              p.found = true; state.foundIds.add(p.id);
              p.revealed = true; // hidden patients too
              setTimeout(() => enterTreatMode(p), 50);
            }
          }
        }, 50);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
