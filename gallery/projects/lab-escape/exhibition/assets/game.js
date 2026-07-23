/* ============================================================================
   LAB ESCAPE  —  top-down Hotline-Miami-style stealth shooter (chunky pixel art)
   Track A: plain JavaScript + Canvas 2D. No build step, runs fully offline.

   CONTROL SCHEME (from the player's guide)
     WASD .......... move
     Left mouse .... punch / attack  (shoots if a gun is equipped)
     Right mouse ... pick up a bobbing item / throw held item / open-close door
                      (opening a door ONTO an enemy knocks them down)
     Space ......... execute a downed enemy
     Shift (hold) .. look ahead / aim; press Middle mouse while aiming to LOCK
                     onto the enemy under the cursor (auto-aim assist)
     R ............. restart the level
     Red arrow ..... points to the exit once the section is cleared

   NOTE: there is NO shield and NO ammo. All weapons fire infinitely — the game
   is about weapon CHOICE (fists / knife / pistol / silenced / shotgun) and route,
   not resource management. You are ONE-HIT: a bullet or contact kills you.

   THE DOMAIN (brief): escaping a lab. The core learning shift is that weapon
   and route choice change how you play. Enemies patrol their rooms and perceive
   the player; the vision cone is INVISIBLE (it ruins the fun). When an enemy
   SPOTS you it CHASES you — every enemy rushes in and kills on CONTACT. You are
   ONE-HIT: a touch kills you. There are no health pickups and no
   human shield — learn the room and go fast.

   DATA GROUPS (kept visible for the student, brief section 4):
     1) ENVIRONMENT DATA  -> level: walls, doors, glass, enemies, items, exit
     2) PLAYER-CONTROLLED -> position, weapon, actions
     3) SYSTEM-CALCULATED -> one-hit HP, score, combo, kills, danger meter

   PIXEL ART: the world is drawn at a LOW internal resolution (TILE=16px) and
   the canvas is CSS-upscaled with image-rendering:pixelated, so every sprite is
   made of big, crisp pixels. No smooth arcs — only rectangles.
============================================================================ */

(function () {
  "use strict";

  // ---- world units are INTERNAL PIXELS (canvas is then CSS-upscaled) ------
  const TILE = 16;                 // internal px per grid cell
  const PLAYER_RADIUS = 5;
  const RUN_SPEED = 1.05;
  const AIM_SPEED = 0.6;           // slower while holding Shift (looking ahead)
  const DASH_SPEED = 2.7;
  const BULLET_SPEED = 4.2;
  const PUNCH_RANGE = 15;
  const PUNCH_ARC = 1.0;           // radians half-cone for melee
  const COMBO_WINDOW = 150;        // frames to keep a combo alive
  const DASH_IFRAMES = 10;
  const DEATH_FRAMES = 48;         // slow-mo blood moment before the end screen

  // Weapons. Equipping a different weapon changes the whole playstyle -> the
  // core learning shift the brief asks us to teach.
  const WEAPONS = {
    fists:    { name: "Fists",      type: "melee", range: PUNCH_RANGE, noise: 60,  ammo: Infinity, kill: false, color: "#e8ecff" },
    knife:    { name: "Knife",      type: "melee", range: 17, noise: 50, ammo: Infinity, kill: true, color: "#cfd8ff" },
    pistol:   { name: "Pistol",     type: "gun",   range: 420, noise: 9999, ammo: Infinity, kill: true, cooldown: 11, spread: 0.03, pellets: 1, color: "#ffe08a" },
    silenced: { name: "Silenced",   type: "gun",   range: 380, noise: 90,  ammo: Infinity, kill: true, cooldown: 13, spread: 0.04, pellets: 1, color: "#a5f0d0" },
    shotgun:  { name: "Shotgun",    type: "gun",   range: 200, noise: 9999, ammo: Infinity, kill: true, cooldown: 30, spread: 0.22, pellets: 7, color: "#ff9d6a" },
    bat:      { name: "Bat",        type: "melee", range: PUNCH_RANGE + 16, noise: 70, ammo: Infinity, kill: false, color: "#caa46a" }
  };

  // Masks -> perks (Hotline Miami signature). Each changes how a level plays.
  const MASKS = {
    tiger: { name: "Tiger", perk: "Frenzy",  desc: "+24% move speed",      apply: p => { p.speedMul *= 1.24; } },
    eagle: { name: "Eagle", perk: "Ghost",   desc: "Enemies see 30% less", apply: () => { GAME.env.enemies.forEach(e => e.visRange *= 0.7); } },
    bat:   { name: "Batter", perk: "Armed", desc: "Start with Bat (+1 reach)", apply: p => { p.inventory.bat = true; p.startGun = "bat"; } },
    owl:   { name: "Owl",   perk: "Armed",   desc: "Start with Pistol",    apply: p => { p.inventory.pistol = true; p.startGun = "pistol"; } }
  };

  // ---- module state -------------------------------------------------------
  let canvas, ctx, hud;
  let keys = {};
  let mouse = { x: 0, y: 0, left: false, right: false, mid: false };
  let paused = false;
  let shake = 0;
  let audioCtx = null, tensionOsc = null, tensionGain = null;

  const GAME = {
    levelIndex: 0,
    currentMask: "tiger",
    state: "menu",          // menu | playing | dying | lost | won
    env: null,              // 1) ENVIRONMENT DATA
    player: null,           // 2) PLAYER-CONTROLLED DATA
    calc: null,             // 3) SYSTEM-CALCULATED DATA
    bullets: [], effects: [], blood: [], bloodP: [],
    flash: 0                // red death flash (0..1)
  };

  // ===========================================================================
  //  LEVELS  ==  CHALLENGE PRESETS  (change variables/relationships, not decor)
  //  Grid legend:  # wall  . floor  P start  E exit  D door  G glass  x cover (blocks sight + movement)
  //                a lab assistant   g security guard   k dog
  //                1 knife pickup  2 silenced pickup  3 shotgun pickup
  // ===========================================================================
  const LEVELS = [
    {
      name: "Reception & Hallways",
      subtitle: "You spawn in a sealed entry room (door, no enemies). Slip into the labs, use cover to break line of sight, grab a weapon, reach the exit.",
      grid: [
        "##############################",
        "######.......................#",
        "##...#....#####..#####.....E.#",
        "##.P.#....#a..#..#a..#.......#",
        "##...#....#.3a#x.#.2.#.......#",
        "###D##....#...#..#..a#.......#",
        "#......x..##D##..##D##.x.....#",
        "#........xx.........xx.......#",
        "#...............x...xx.......#",
        "#......g....xx.1.............#",
        "#.................xx....g....#",
        "#.......x......g.....xxx.....#",
        "#..........xx................#",
        "##############################"
      ],
      pickups: { "1": "knife", "2": "shotgun", "3": "silenced" },
      items: [ {col: 24, row: 12, kind: "bottle"} ],
      decor: [
        {col:7,row:7,type:"desk"}, {col:25,row:7,type:"monitor"}, {col:7,row:12,type:"plant"},
        {col:25,row:12,type:"shelf"}, {col:13,row:9,type:"crate"}, {col:20,row:9,type:"bed"}
      ]
    },
    {
      name: "Wards & Bathroom",
      subtitle: "A ward, a storage room and a bathroom — each with a door. Guards and a dog. Hide behind cover, then be brutal.",
      grid: [
        "##############################",
        "######.......................#",
        "##...#....######..#####......#",
        "##.P.#....#g...#..#g..#.x....#",
        "##...#....#..g.#..D..g#......#",
        "###D##....#...gD..#.3.#x.....#",
        "#......x..#.2..#..#####......#",
        "#.........######....xx..a....#",
        "#.......a.......x.xx.........#",
        "#.##D##........1x............#",
        "#.#a..#.....xx..a....x.......#",
        "#.#...#.x.......g.xx.......E.#",
        "#.#####..xx..................#",
        "##############################"
      ],
      pickups: { "1": "knife", "2": "shotgun", "3": "silenced" },
      items: [ {col: 24, row: 12, kind: "bottle"} ],
      decor: [
        {col:7,row:7,type:"desk"}, {col:25,row:7,type:"monitor"}, {col:14,row:8,type:"crate"},
        {col:9,row:9,type:"plant"}, {col:7,row:12,type:"bed"}, {col:25,row:12,type:"shelf"}
      ]
    },
    {
      name: "Kennels & Exit",
      subtitle: "Fast dogs in two kennels plus guards in the halls. Highest awareness. Use cover and doors, don't get cornered.",
      grid: [
        "##############################",
        "######.......................#",
        "##...#....#####..#####.......#",
        "##.P.#....#k..#..#k..#.......#",
        "##...#....#.3k#x.#.2.#k......#",
        "###D##....#...#..#..k#.......#",
        "#......x..##D##..##D##.x.....#",
        "#........xx.........xx..a....#",
        "#...............x...xx.......#",
        "#......a....xx.1.............#",
        "#..............g..xx.........#",
        "#.......x............xxx...E.#",
        "#..........xx................#",
        "##############################"
      ],
      pickups: { "1": "knife", "2": "shotgun", "3": "silenced" },
      items: [ {col: 24, row: 12, kind: "bottle"} ],
      decor: [
        {col:7,row:7,type:"desk"}, {col:25,row:7,type:"monitor"}, {col:13,row:9,type:"crate"},
        {col:25,row:12,type:"shelf"}, {col:7,row:12,type:"plant"}, {col:20,row:9,type:"bed"}
      ]
    }
  ];

  // Enemy archetypes. They PATROL their room, and when they SPOT the player they
  // CHASE. Every enemy rushes in and kills on CONTACT — there is no ranged fire.
  const ENEMY_TYPES = {
    a: { key: "assistant", hp: 1, speed: 1.00, chaseMul: 1.35, visRange: 108, visAngle: 1.15, color: "#8fd3ff" },
    g: { key: "guard",     hp: 1, speed: 1.00, chaseMul: 1.35, visRange: 150, visAngle: 1.00, color: "#ff6b6b", gun: true },
    k: { key: "dog",       hp: 1, speed: 1.35, chaseMul: 1.70, visRange: 120, visAngle: 1.35, color: "#ffcf6b", dog: true }
  };

  // ===========================================================================
  //  LEVEL LOADING  -> ENVIRONMENT DATA
  // ===========================================================================
  function loadLevel(idx, maskKey) {
    const def = LEVELS[idx];
    GAME.levelIndex = idx;
    if (maskKey) GAME.currentMask = maskKey;

    const walls = [], glass = [], doors = [], enemies = [], pickups = [], items = [], cover = [];
    let start = { x: 2 * TILE, y: 2 * TILE };
    let exit = null;

    // lab-themed cover props (each cover tile gets a stable kind by position)
    const COVER_KINDS = ["bench", "sink", "table", "cabinet", "shelf"];
    const coverKind = (r, c) => COVER_KINDS[(r * 7 + c * 3) % COVER_KINDS.length];

    for (let r = 0; r < def.grid.length; r++) {
      const row = def.grid[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        const x = c * TILE, y = r * TILE;
        const cell = { x, y, w: TILE, h: TILE, cx: x + TILE / 2, cy: y + TILE / 2 };
        if (ch === "#") walls.push(cell);
        else if (ch === "G") glass.push(cell);
        else if (ch === "x") cover.push({ ...cell, kind: coverKind(r, c) });
        else if (ch === "D") doors.push({ ...cell, open: false, horiz: cell.w >= cell.h });
        else if (ch === "P") start = { x: cell.cx, y: cell.cy };
        else if (ch === "E") exit = cell;
        else if (ENEMY_TYPES[ch]) {
          const t = ENEMY_TYPES[ch];
          enemies.push({
            type: ch, key: t.key, dog: !!t.dog, gun: !!t.gun,
            x: cell.cx, y: cell.cy,
            hp: t.hp, speed: t.speed, chaseMul: t.chaseMul,
            visRange: t.visRange, visAngle: t.visAngle,
            color: t.color,
            facing: Math.random() * Math.PI * 2,
            state: "wander", downed: false, dead: false,
            homeX: cell.cx, homeY: cell.cy,
            wx: cell.cx, wy: cell.cy, waitT: Math.floor(Math.random() * 12),
            lastX: cell.cx, lastY: cell.cy, stuckT: 0,
            alert: 0, lastSeenX: cell.cx, lastSeenY: cell.cy, shootCd: 0,
            revive: 0, bob: Math.random() * Math.PI * 2
          });
        } else if (def.pickups && def.pickups[ch]) {
          pickups.push({ x: cell.cx, y: cell.cy, weapon: def.pickups[ch], taken: false });
        }
      }
    }
    (def.items || []).forEach(it => {
      items.push({ x: it.col * TILE + TILE / 2, y: it.row * TILE + TILE / 2, kind: it.kind, taken: false, bob: Math.random() * Math.PI * 2 });
    });
    const decor = (def.decor || []).map(d => ({ x: d.col * TILE + TILE / 2, y: d.row * TILE + TILE / 2, type: d.type }));

    const cols = Math.max(...def.grid.map(r => r.length));
    GAME.env = { name: def.name, subtitle: def.subtitle, cols, rows: def.grid.length,
      walls, glass, doors, cover, enemies, pickups, items, decor, exit };

    // 2) PLAYER-CONTROLLED DATA  (one-hit: maxHp = 1)
    const p = {
      x: start.x, y: start.y, angle: 0,
      hp: 1, maxHp: 1,
      speedMul: 1, dashCd: 0, dashMax: 34,
      sneaking: false, aiming: false,
      weapon: "fists", startGun: null,
      inventory: { fists: true, knife: false, pistol: false, silenced: false, shotgun: false, bat: false },
      ammo: { fists: Infinity, knife: Infinity, pistol: Infinity, silenced: Infinity, shotgun: Infinity, bat: Infinity },
      cooldown: 0, hitFlash: 0, noiseRing: 0,
      lockTarget: null, heldItem: null,
      dashing: 0, iframe: 0, lastTap: {}, dyingTimer: 0,
      maskKey: GAME.currentMask
    };
    if (MASKS[GAME.currentMask]) MASKS[GAME.currentMask].apply(p);
    if (p.startGun) p.weapon = p.startGun;
    GAME.player = p;

    // 3) SYSTEM-CALCULATED DATA
    GAME.calc = { danger: 0, kills: 0, shotsFired: 0, score: 0, combo: 0, bestCombo: 0,
      comboTimer: 0, lastMethod: null, timeStart: performance.now(), sectionCleared: false };
    GAME.bullets = []; GAME.effects = []; GAME.blood = []; GAME.bloodP = [];
    GAME.flash = 0;
    GAME.state = "playing";
    shake = 0;

    canvas.width = cols * TILE;
    canvas.height = GAME.env.rows * TILE;
    ctx.imageSmoothingEnabled = false;
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.style.display = "none";
    startTension();
  }

  // ===========================================================================
  //  GEOMETRY HELPERS
  // ===========================================================================
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  function circleRect(cx, cy, r, rect) {
    const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    return dist(cx, cy, nx, ny) < r;
  }
  function segSeg(x1, y1, x2, y2, x3, y3, x4, y4) {
    const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
    if (d === 0) return false;
    const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
    const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
  function segRect(x1, y1, x2, y2, rect) {
    const { x, y, w, h } = rect;
    return segSeg(x1, y1, x2, y2, x, y, x + w, y) ||
      segSeg(x1, y1, x2, y2, x + w, y, x + w, y + h) ||
      segSeg(x1, y1, x2, y2, x + w, y + h, x, y + h) ||
      segSeg(x1, y1, x2, y2, x, y + h, x, y) ||
      (x1 > x && x1 < x + w && y1 > y && y1 < y + h);
  }
  // Glass is see-through: it does NOT block sight or bullets, only movement.
  function sightBlocked(ax, ay, bx, by) {
    for (const w of GAME.env.walls) if (segRect(ax, ay, bx, by, w)) return true;
    for (const c of GAME.env.cover) if (segRect(ax, ay, bx, by, c)) return true;
    for (const d of GAME.env.doors) if (!d.open && segRect(ax, ay, bx, by, d)) return true;
    return false;
  }
  function solidsForMovement() {
    return GAME.env.walls.concat(GAME.env.cover).concat(GAME.env.glass).concat(GAME.env.doors.filter(d => !d.open));
  }
  function isFloor(x, y) {
    if (x < 8 || y < 8 || x > canvas.width - 8 || y > canvas.height - 8) return false;
    return !solidsForMovement().some(s => x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h);
  }
  function moveEntity(ent, dx, dy, r) {
    const solids = solidsForMovement();
    if (!solids.some(s => circleRect(ent.x + dx, ent.y, r, s))) ent.x += dx;
    if (!solids.some(s => circleRect(ent.x, ent.y + dy, r, s))) ent.y += dy;
    const W = canvas.width, H = canvas.height;
    ent.x = Math.max(r, Math.min(W - r, ent.x));
    ent.y = Math.max(r, Math.min(H - r, ent.y));
  }
  function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

  // ===========================================================================
  //  UPDATE
  // ===========================================================================
  function update() {
    if (GAME.state === "dying") { stepDying(); return; }
    if (GAME.state !== "playing" || paused) return;
    const p = GAME.player;

    p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
    p.aiming = !!keys["shift"];

    let dx = 0, dy = 0;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;

    // dash on double-tap (short invincibility + speed burst)
    for (const k of ["w", "a", "s", "d"]) {
      if (keys[k] && !p.lastTap["_" + k + "_down"]) {
        p.lastTap["_" + k + "_down"] = true;
        const now = performance.now();
        if (p.lastTap[k] && now - p.lastTap[k] < 260 && p.dashing <= 0 && p.dashCd === 0) {
          p.dashing = 9; p.iframe = DASH_IFRAMES; p.dashCd = p.dashMax;
          p.dashDir = { x: dx || (k === "a" ? -1 : k === "d" ? 1 : 0), y: dy || (k === "w" ? -1 : k === "s" ? 1 : 0) };
        }
        p.lastTap[k] = now;
      }
      if (!keys[k]) p.lastTap["_" + k + "_down"] = false;
    }
    p.dashCd = Math.max(0, p.dashCd - 1);

    const baseSpd = (p.aiming ? AIM_SPEED : RUN_SPEED) * p.speedMul;
    if (p.dashing > 0) {
      const m = Math.hypot(p.dashDir.x, p.dashDir.y) || 1;
      moveEntity(p, (p.dashDir.x / m) * DASH_SPEED, (p.dashDir.y / m) * DASH_SPEED, PLAYER_RADIUS);
      p.dashing--; if (p.iframe > 0) p.iframe--;
    } else if (dx || dy) {
      const m = Math.hypot(dx, dy);
      moveEntity(p, (dx / m) * baseSpd, (dy / m) * baseSpd, PLAYER_RADIUS);
    }
    if (p.cooldown > 0) p.cooldown--;
    if (mouse.left) attack();
    if (mouse.right) interact();

    if (p.hitFlash > 0) p.hitFlash--;
    if (p.noiseRing > 0) p.noiseRing -= 3;
    if (p.iframe > 0 && p.dashing <= 0) p.iframe--;

    if (GAME.calc.comboTimer > 0) { GAME.calc.comboTimer--; if (GAME.calc.comboTimer === 0) { GAME.calc.bestCombo = Math.max(GAME.calc.bestCombo, GAME.calc.combo); GAME.calc.combo = 0; } }

    updateItems();
    // walk over a weapon pickup to grab + equip it (weapon CHOICE is the core learning shift)
    for (const pk of GAME.env.pickups) {
      if (pk.taken) continue;
      if (dist(p.x, p.y, pk.x, pk.y) < PLAYER_RADIUS + 7) {
        pk.taken = true; p.inventory[pk.weapon] = true; p.ammo[pk.weapon] = Infinity; p.weapon = pk.weapon;
        addEffect(pk.x, pk.y, "pickup", WEAPONS[pk.weapon].name.toUpperCase());
        flashHud("Grabbed " + WEAPONS[pk.weapon].name);
      }
    }
    updateBullets();
    updateEnemies();
    updateEffects();
    updateBloodParticles();
    if (GAME.flash > 0) GAME.flash = Math.max(0, GAME.flash - 0.02);

    GAME.calc.sectionCleared = GAME.env.enemies.every(e => e.dead);
    GAME.calc.bestCombo = Math.max(GAME.calc.bestCombo, GAME.calc.combo);

    if (GAME.env.exit && circleRect(p.x, p.y, PLAYER_RADIUS, GAME.env.exit)) {
      GAME.state = "won"; showEndScreen(true);
    }
  }

  // ---- LEFT MOUSE: punch / shoot ----
  function attack() {
    const p = GAME.player;
    const w = WEAPONS[p.weapon];
    if (p.cooldown > 0) return;
    if (w.type === "melee") {
      p.cooldown = 14;
      const target = (p.lockTarget && !p.lockTarget.dead) ? p.lockTarget : nearestInArc(p, w.range || PUNCH_RANGE);
      if (target) {
        if (w.kill) killEnemy(target, "melee"); else knockDown(target);
        addEffect(target.x, target.y, "hit"); shake = Math.max(shake, 4);
      }
    } else {
      p.cooldown = w.cooldown;
      GAME.calc.shotsFired++;
      const pellets = w.pellets || 1;
      const aimAng = (p.lockTarget && !p.lockTarget.dead)
        ? Math.atan2(p.lockTarget.y - p.y, p.lockTarget.x - p.x) : p.angle;
      for (let i = 0; i < pellets; i++) {
        const spread = (Math.random() - 0.5) * w.spread * 2;
        GAME.bullets.push({
          x: p.x + Math.cos(aimAng) * (PLAYER_RADIUS + 3), y: p.y + Math.sin(aimAng) * (PLAYER_RADIUS + 3),
          vx: Math.cos(aimAng + spread) * BULLET_SPEED, vy: Math.sin(aimAng + spread) * BULLET_SPEED,
          life: w.range / BULLET_SPEED, dmg: w.dmg, from: "player", color: w.color
        });
      }
      addEffect(p.x + Math.cos(aimAng) * 18, p.y + Math.sin(aimAng) * 18, "muzzle");
      shake = Math.max(shake, w.pellets > 1 ? 7 : 4);
    }
  }

  function nearestInArc(p, range) {
    let best = null, bd = 1e9;
    for (const e of GAME.env.enemies) {
      if (e.dead || e.downed) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < range && Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.angle)) < PUNCH_ARC) {
        if (d < bd) { bd = d; best = e; }
      }
    }
    return best;
  }

  function knockDown(e) {
    if (e.downed || e.dead) return;
    e.downed = true; e.state = "downed"; e.revive = 240; e.facing = Math.random() * Math.PI * 2;
    addEffect(e.x, e.y, "spark");
  }
  function killEnemy(e, method) {
    if (e.dead) return;
    e.dead = true; e.state = "dead"; e.downed = false;
    e.deathT = 16;                       // short "falling over" animation before vanishing
    GAME.calc.kills++;
    if (GAME.calc.comboTimer > 0) GAME.calc.combo++; else GAME.calc.combo = 1;
    GAME.calc.comboTimer = COMBO_WINDOW;
    let pts = 100 * GAME.calc.combo;
    if (GAME.calc.lastMethod && GAME.calc.lastMethod !== method) pts += 60;
    GAME.calc.lastMethod = method;
    GAME.calc.score += pts;
    addEffect(e.x, e.y, "down", "+" + pts + (GAME.calc.combo > 1 ? " x" + GAME.calc.combo : ""));
    spawnBlood(e.x, e.y, 0.9);           // blood when an enemy dies
    spawnBlood(e.x + (Math.random() - 0.5) * 6, e.y + (Math.random() - 0.5) * 6, 0.5);
    shake = Math.max(shake, 5);
  }
  function killPlayer() {
    const p = GAME.player;
    if (p.iframe > 0) return;             // dash i-frames save you
    if (GAME.state !== "playing") return; // already dying/dead
    // DEATH: big blood burst + red flash + shake, then a slow-mo beat, then screen
    p.hp = 0;
    GAME.state = "dying";
    p.dyingTimer = DEATH_FRAMES;
    spawnBlood(p.x, p.y, 1.0);
    GAME.flash = 0.65;
    shake = 14;
    stopTension();
  }

  // ---- RIGHT MOUSE: pickup / throw / door (door can knock enemies down) ----
  let rightLock = false;
  function interact() {
    if (rightLock) return; rightLock = true;
    const p = GAME.player;
    const wx = mouse.x, wy = mouse.y;

    for (const d of GAME.env.doors) {
      if (wx > d.x && wx < d.x + d.w && wy > d.y && wy < d.y + d.h) {
        if (dist(p.x, p.y, d.cx, d.cy) > TILE * 3) { flashHud("Get closer to the door"); return; }
        d.open = !d.open;
        addEffect(d.cx, d.cy, "spark");
        // opening a door ONTO an enemy knocks them down (Hotline Miami style)
        if (d.open) {
          for (const e of GAME.env.enemies) {
            if (e.dead || e.downed) continue;
            if (dist(d.cx, d.cy, e.x, e.y) < TILE * 1.6 && !sightBlocked(d.cx, d.cy, e.x, e.y)) {
              knockDown(e); addEffect(e.x, e.y, "hit"); shake = Math.max(shake, 5);
            }
          }
        }
        return;
      }
    }
    if (p.heldItem) { throwItem(p.heldItem, wx, wy); p.heldItem = null; return; }
    let best = null, bd = 40;
    for (const it of GAME.env.items) {
      if (it.taken) continue;
      const dc = dist(wx, wy, it.x, it.y), dp = dist(p.x, p.y, it.x, it.y);
      if (dc < bd && dp < TILE * 3) { bd = dc; best = it; }
    }
    if (best) {
      best.taken = true;
      p.heldItem = best.kind; addEffect(p.x, p.y, "pickup", "GRABBED");
    }
  }
  function throwItem(kind, tx, ty) {
    const p = GAME.player;
    const ang = Math.atan2(ty - p.y, tx - p.x);
    GAME.bullets.push({ x: p.x + Math.cos(ang) * (PLAYER_RADIUS + 3), y: p.y + Math.sin(ang) * (PLAYER_RADIUS + 3),
      vx: Math.cos(ang) * 3.4, vy: Math.sin(ang) * 3.4, life: 60, dmg: 0, from: "throw", color: "#9fd0ff", kind });
  }

  // ---- SPACE: execute (finish off) a downed enemy ----
  let spaceLock = false;
  function trySpace() {
    if (spaceLock) return; spaceLock = true;
    const p = GAME.player;
    let near = null, bd = 30;
    for (const e of GAME.env.enemies) {
      if (e.dead || !e.downed) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < bd) { bd = d; near = e; }
    }
    if (!near) return;
    killEnemy(near, "execute"); near.downed = false;
  }

  // ---- items (bobbing) ----
  function updateItems() { for (const it of GAME.env.items) if (!it.taken) it.bob += 0.08; }

  // ---- bullets ----
  function updateBullets() {
    const p = GAME.player;
    const solids = GAME.env.walls.concat(GAME.env.cover).concat(GAME.env.doors.filter(d => !d.open)); // glass pass-through
    for (const b of GAME.bullets) {
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0) { b.dead = true; if (b.kind === "bottle") addEffect(b.x, b.y, "spark"); continue; }
      if (solids.some(s => b.x > s.x && b.x < s.x + s.w && b.y > s.y && b.y < s.y + s.h)) { b.dead = true; addEffect(b.x, b.y, "spark"); continue; }
      if (b.from === "throw") {
        for (const e of GAME.env.enemies) {
          if (e.dead || e.downed) continue;
          if (dist(b.x, b.y, e.x, e.y) < 12) { knockDown(e); b.dead = true; addEffect(e.x, e.y, "hit"); break; }
        }
        continue;
      }
      if (b.from === "player") {
        for (const e of GAME.env.enemies) {
          if (e.dead || e.downed) continue;
          if (dist(b.x, b.y, e.x, e.y) < 11) { knockDown(e); b.dead = true; break; }  // shoot -> down, Space to finish
        }
      }
    }
    GAME.bullets = GAME.bullets.filter(b => !b.dead);
  }

  // ---- enemy AI: patrol the room, then CHASE the player once spotted ----
  // States:  wander  -> walk around the home room
  //          chase   -> rush the player; CONTACT is what kills (no ranged fire)
  // The vision cone stays invisible; being seen means the enemy comes after you.
  function updateEnemies() {
    const p = GAME.player;
    let nearestThreat = 1e9;
    let anyChasing = false;

    for (const e of GAME.env.enemies) {
      if (e.dead) { if (e.deathT > 0) e.deathT--; continue; }
      if (e.downed) {
        if (e.revive > 0) { e.revive--; if (e.revive === 0) { e.downed = false; e.state = "wander"; e.alert = 0; } }
        continue;
      }
      if (e.shootCd > 0) e.shootCd--;

      const dToPlayer = dist(e.x, e.y, p.x, p.y);
      const angToPlayer = Math.atan2(p.y - e.y, p.x - e.x);
      const inCone = Math.abs(angDiff(angToPlayer, e.facing)) < e.visAngle / 2;
      const clearLoS = !sightBlocked(e.x, e.y, p.x, p.y);
      const canSee = dToPlayer < e.visRange && inCone && clearLoS;

      // spotting: enter/refresh chase; remember where the player was last seen
      if (canSee) {
        if (e.state !== "chase") addEffect(e.x, e.y - 12, "pickup", "!");
        e.state = "chase";
        e.alert = 150;                       // stay alert ~2.5s after losing sight
        e.lastSeenX = p.x; e.lastSeenY = p.y;
      } else if (e.state === "chase") {
        e.alert--;
        if (e.alert <= 0) { e.state = "wander"; e.waitT = 0; }
      }

      if (e.state === "chase") {
        anyChasing = true;
        const tx = canSee ? p.x : e.lastSeenX;
        const ty = canSee ? p.y : e.lastSeenY;
        const a = Math.atan2(ty - e.y, tx - e.x);
        e.facing = a;

        // rush the player (chase is faster than the player — ~35% quicker for
        // humans, ~70% for dogs). Enemies only kill on CONTACT — no ranged fire.
        const chaseSpeed = RUN_SPEED * e.chaseMul;
        moveEntity(e, Math.cos(a) * chaseSpeed, Math.sin(a) * chaseSpeed, e.dog ? 4 : 5);
        // reached the last-seen spot but player gone -> give up sooner
        if (!canSee && dist(e.x, e.y, e.lastSeenX, e.lastSeenY) < 8) e.alert = Math.min(e.alert, 20);
        if (canSee) nearestThreat = Math.min(nearestThreat, dToPlayer);
      } else {
        // PATROL: keep walking around the home room
        if (e.waitT > 0) { e.waitT--; }
        else {
          const reached = dist(e.x, e.y, e.wx, e.wy) < 4;
          // stuck check: if barely moved since last frame, repath
          const moved = dist(e.x, e.y, e.lastX || e.x, e.lastY || e.y);
          e.stuckT = moved < 0.35 ? (e.stuckT || 0) + 1 : 0;
          e.lastX = e.x; e.lastY = e.y;
          if (reached || e.stuckT > 24) { pickWander(e); e.waitT = 2 + Math.floor(Math.random() * 5); e.stuckT = 0; }
          const a = Math.atan2(e.wy - e.y, e.wx - e.x);
          e.facing = a;
          // patrol the room at the enemy's own (visible) walking speed
          moveEntity(e, Math.cos(a) * e.speed, Math.sin(a) * e.speed, e.dog ? 4 : 5);
        }
      }

      // contact kills the player (one hit)
      if (dToPlayer < PLAYER_RADIUS + (e.dog ? 4 : 5) && p.iframe <= 0) { killPlayer(); return; }
    }

    // readable danger meter: rises when enemies are chasing / closing in
    const maxD = 170;
    const prox = nearestThreat < 1e9 ? Math.max(0, 1 - nearestThreat / maxD) : 0;
    GAME.calc.danger = Math.max(anyChasing ? 0.45 : 0, Math.min(1, prox + (anyChasing ? 0.25 : 0)));
    GAME.calc.anyChasing = anyChasing;
  }

  function pickWander(e) {
    // roam well beyond the home cell so the enemy visibly walks the room
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 120;
      const tx = e.homeX + Math.cos(a) * r, ty = e.homeY + Math.sin(a) * r;
      if (isFloor(tx, ty)) { e.wx = tx; e.wy = ty; return; }
    }
    const a = Math.random() * Math.PI * 2; e.wx = e.x + Math.cos(a) * 28; e.wy = e.y + Math.sin(a) * 28;
  }

  // ---- effects (floating text + sparks + muzzle) ----
  function addEffect(x, y, kind, text) { GAME.effects.push({ x, y, kind, text, life: (kind === "down" || kind === "pickup") ? 60 : 16 }); }
  function updateEffects() { for (const f of GAME.effects) f.life--; GAME.effects = GAME.effects.filter(f => f.life > 0); }

  // ---- blood (decal + particles) ----
  function spawnBlood(x, y, amount) {
    GAME.blood.push({ x, y, r: (6 + Math.random() * 6) * amount, a: 0.9 });
    const n = Math.floor(10 + amount * 14);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 2.2) * amount;
      GAME.bloodP.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30 + Math.random() * 20, size: 1 + Math.floor(Math.random() * 2) });
    }
  }
  function updateBloodParticles() {
    for (const b of GAME.bloodP) { b.x += b.vx; b.y += b.vy; b.vx *= 0.92; b.vy *= 0.92; b.life--; }
    GAME.bloodP = GAME.bloodP.filter(b => b.life > 0);
    for (const d of GAME.blood) if (d.a > 0.6) d.a -= 0.002;
  }

  // ---- death slow-mo beat ----
  function stepDying() {
    const p = GAME.player;
    updateEffects();
    updateBloodParticles();
    if (GAME.flash > 0) GAME.flash = Math.max(0, GAME.flash - 0.012);
    if (shake > 0) { shake *= 0.9; if (shake < 0.4) shake = 0; }
    // keep the blood flowing while the player falls
    if (p.dyingTimer % 5 === 0) spawnBlood(p.x + (Math.random() - 0.5) * 6, p.y + (Math.random() - 0.5) * 6, 0.6);
    p.dyingTimer--;
    if (p.dyingTimer <= 0) { GAME.state = "lost"; showEndScreen(false); }
  }

  // ===========================================================================
  //  RENDER  (chunky pixel art: internal-res canvas, CSS upscales, no AA)
  // ===========================================================================
  function render() {
    const p = GAME.player;
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    let sx = 0, sy = 0;
    if (shake > 0) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; }
    if (shake > 0 && GAME.state !== "dying") { shake *= 0.85; if (shake < 0.4) shake = 0; }
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));

    // floor (checker, brighter for readability)
    for (let r = 0; r < GAME.env.rows; r++) for (let c = 0; c < GAME.env.cols; c++) {
      px(c * TILE, r * TILE, TILE, TILE, (r + c) % 2 ? "#242833" : "#2b2f3c");
    }

    // blood decals under everything
    for (const b of GAME.blood) { ctx.fillStyle = `rgba(140,16,16,${b.a})`; ctx.fillRect(Math.round(b.x - b.r), Math.round(b.y - b.r), Math.round(b.r * 2), Math.round(b.r * 2)); }

    // decorations (non-interactable lab props)
    for (const d of GAME.env.decor) drawDecor(d.x, d.y, d.type);

    // cover (lab furniture) — block movement AND line of sight so you can hide
    for (const c of GAME.env.cover) drawCover(c);

    // exit + red arrow
    if (GAME.env.exit) {
      const ex = GAME.env.exit;
      px(ex.x, ex.y, ex.w, ex.h, "#1f7a3d");
      px(ex.x + 2, ex.y + 2, ex.w - 4, ex.h - 4, "#2c9c52");
      if (GAME.calc.sectionCleared) drawArrow(p.x, p.y, ex.cx, ex.cy);
    }

    // walls
    for (const w of GAME.env.walls) {
      px(w.x, w.y, w.w, w.h, "#404657");
      px(w.x, w.y, w.w, 3, "#545b70");
      px(w.x, w.y + w.h - 3, w.w, 3, "#2c303c");
    }
    // glass (see-through, only a faint frame)
    for (const g of GAME.env.glass) {
      ctx.fillStyle = "rgba(120,200,255,0.10)"; ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.strokeStyle = "rgba(160,220,255,0.40)"; ctx.lineWidth = 1; ctx.strokeRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2);
    }
    // doors
    for (const d of GAME.env.doors) {
      if (d.open) { px(d.cx - 2, d.cy - 2, 4, 4, "#6a4d2c"); }
      else {
        px(d.x, d.y, d.w, d.h, "#7a5a32");
        px(d.x + 2, d.y + 2, d.w - 4, d.h - 4, "#a97c46");
        px(d.cx - 1, d.cy - 2, 2, 4, "#5c4226");
      }
    }

    // weapon pickups
    for (const pk of GAME.env.pickups) {
      if (pk.taken) continue;
      const w = WEAPONS[pk.weapon];
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(Math.round(pk.x - 6), Math.round(pk.y + 3), 12, 4);
      px(pk.x - 6, pk.y - 2, 12, 4, w.color);
      if (w.type === "gun") px(pk.x + 4, pk.y - 1, 5, 3, w.color);
    }
    // bobbing items
    for (const it of GAME.env.items) {
      if (it.taken) continue;
      const by = Math.round(Math.sin(it.bob) * 3);
      ctx.save(); ctx.translate(Math.round(it.x), Math.round(it.y + by));
      if (it.kind === "health") { px(-6, -6, 12, 12, "#ff6b6b"); px(-2, -5, 4, 10, "#fff"); px(-5, -2, 10, 4, "#fff"); }
      else if (it.kind === "ammo") { px(-7, -5, 14, 10, "#ffd36b"); ctx.fillStyle = "#0c0e12"; ctx.font = "bold 7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("AM", 0, 0); }
      else { px(-5, -5, 10, 10, "#9fd0ff"); px(-2, -5, 4, 3, "#0c0e12"); }
      ctx.restore();
    }

    // enemies
    for (const e of GAME.env.enemies) {
      if (e.dead) { if (e.deathT > 0) drawEnemyDeath(e); continue; }
      if (e.downed) {
        drawActor(e.x, e.y, e.facing, enemyPal(e), { downed: true });
        ctx.fillStyle = "#ffd36b"; ctx.font = "bold 7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("SPACE", e.x, e.y - 13);
        continue;
      }
      const chasing = e.state === "chase";
      if (e.dog) drawDog(e.x, e.y, e.facing, e);
      else drawActor(e.x, e.y, e.facing, enemyPal(e), { evil: true, weapon: e.gun ? "pistol" : null });
      // a small red "!" alert bump so the chase is readable
      if (chasing) { ctx.fillStyle = "#ff4d4d"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", e.x, e.y - 12); }
    }

    // bullets
    for (const b of GAME.bullets) { px(b.x - (b.kind === "bottle" ? 3 : 1.5), b.y - (b.kind === "bottle" ? 3 : 1.5), b.kind === "bottle" ? 6 : 3, b.kind === "bottle" ? 6 : 3, b.color || "#fff"); }

    // player
    const pWeapon = WEAPONS[p.weapon].type === "gun" ? (p.weapon === "shotgun" ? "shotgun" : "pistol") : (p.weapon === "knife" ? "knife" : (p.weapon === "bat" ? "bat" : null));
    if (GAME.state === "dying") {
      // little animation: the player tips over and bleeds out
      const fall = 1 - p.dyingTimer / DEATH_FRAMES;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - fall * 0.35);
      ctx.translate(p.x, p.y); ctx.rotate(fall * Math.PI / 2); ctx.translate(-p.x, -p.y);
      drawActor(p.x, p.y, p.angle, PLAYER_PAL, { weapon: pWeapon });
      ctx.globalAlpha = 1; ctx.restore();
    } else {
      drawActor(p.x, p.y, p.angle, PLAYER_PAL, { weapon: pWeapon, iframe: p.iframe > 0 });
    }
    if (p.aiming) {
      // a simple dashed aim line (no cone) while looking ahead
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 150, p.y + Math.sin(p.angle) * 150); ctx.stroke(); ctx.setLineDash([]);
    }
    if (p.lockTarget && !p.lockTarget.dead) {
      ctx.strokeStyle = "#ff6b6b"; ctx.lineWidth = 1.5; ctx.strokeRect(p.lockTarget.x - 9, p.lockTarget.y - 9, 18, 18);
    }

    // blood particles (on top)
    for (const b of GAME.bloodP) { ctx.fillStyle = `rgba(170,20,20,${Math.min(1, b.life / 30)})`; ctx.fillRect(Math.round(b.x - b.size / 2), Math.round(b.y - b.size / 2), b.size, b.size); }

    // floating text effects
    for (const f of GAME.effects) {
      const a = f.life / ((f.kind === "down" || f.kind === "pickup") ? 60 : 16);
      if (f.kind === "muzzle") { ctx.fillStyle = `rgba(255,230,150,${a})`; ctx.fillRect(Math.round(f.x - 4), Math.round(f.y - 4), 8, 8); }
      else if (f.kind === "blood") { /* handled by particles */ }
      else if (f.kind === "hit" || f.kind === "spark") { ctx.fillStyle = `rgba(255,120,80,${a})`; ctx.fillRect(Math.round(f.x - 5), Math.round(f.y - 5), 10 * a + 2, 10 * a + 2); }
      else if (f.text) { ctx.fillStyle = f.kind === "down" ? `rgba(255,210,90,${a})` : `rgba(160,255,200,${a})`; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(f.text, f.x, f.y - (60 - f.life) * 0.4); }
    }

    ctx.restore();

    // death flash (red, full screen)
    if (GAME.flash > 0) { ctx.fillStyle = `rgba(200,10,10,${GAME.flash})`; ctx.fillRect(0, 0, W, H); }

    updateHud();
  }

  // ---- pixel helpers ----
  function px(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  // ---- pixel-art actor (top-down humanoid, head visible from above) ----
  // Bodies are drawn AXIS-ALIGNED (no rotation) so pixels stay crisp; a small
  // directional nub shows facing. This is the Hotline-Miami look.
  const PLAYER_PAL = { shirt: "#4cb8ff", shirt2: "#2b7fd6", skin: "#f8d2b0", hair: "#1d1d1d" };
  function enemyPal(e) {
    if (e.key === "guard") return { shirt: "#ff5555", shirt2: "#b83232", skin: "#f0c49a", hair: "#1d1d1d", helmet: true };
    if (e.key === "dog") return { shirt: "#ffcf6b", shirt2: "#c8924f", skin: "#ffcf6b", hair: "#7a531f" };
    return { shirt: "#ffffff", shirt2: "#c7d0dc", skin: "#f0c49a", hair: "#3a2f2a" }; // lab assistant, white coat
  }
  function drawActor(x, y, angle, pal, opt) {
    opt = opt || {};
    x = Math.round(x); y = Math.round(y);
    if (opt.downed) {
      px(x - 8, y - 4, 16, 8, pal.shirt2 || pal.shirt);
      px(x + 5, y - 2, 4, 4, pal.skin);
      ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(x - 9, y - 5, 18, 10);
      return;
    }
    // outline/shadow (makes tiny actors readable against floor)
    px(x - 7, y - 5, 14, 10, "rgba(0,0,0,0.45)");
    // legs
    px(x - 4, y + 4, 3, 4, pal.shirt2 || "#33363f"); px(x + 1, y + 4, 3, 4, pal.shirt2 || "#33363f");
    // torso
    px(x - 6, y - 6, 12, 11, pal.shirt);
    px(x - 6, y + 1, 12, 4, pal.shirt2 || "#000");
    // arms
    px(x - 8, y - 3, 2, 6, pal.shirt); px(x + 6, y - 3, 2, 6, pal.shirt);
    // head outline + head
    px(x - 5, y - 5, 10, 10, "rgba(0,0,0,0.45)");
    px(x - 4, y - 4, 8, 8, pal.skin);
    // hair (back of head)
    px(x - 4, y - 5, 8, 3, pal.hair || "#222");
    // face forward nub (which way the actor looks)
    const fx = x + Math.round(Math.cos(angle) * 5), fy = y + Math.round(Math.sin(angle) * 5);
    px(fx - 1, fy - 1, 3, 3, pal.skin);
    // evil red eyes
    if (opt.evil) { px(x - 2, y - 1, 2, 2, "#ff3b3b"); px(x + 1, y - 1, 2, 2, "#ff3b3b"); }
    // guard helmet
    if (pal.helmet) { px(x - 6, y - 7, 12, 4, "#2b2f3a"); px(x - 6, y - 4, 12, 2, "#1c2029"); }
    // weapon in front
    if (opt.weapon) {
      const wx = x + Math.round(Math.cos(angle) * 8), wy = y + Math.round(Math.sin(angle) * 8);
      if (opt.weapon === "shotgun") { px(wx - 1, wy - 2, 12, 4, "#6a7385"); }
      else if (opt.weapon === "knife") { px(wx - 1, wy - 1, 9, 2, "#e8ecff"); }
      else if (opt.weapon === "bat") { px(wx - 2, wy - 1, 11, 3, "#8a5a2c"); px(wx + 6, wy - 2, 4, 5, "#caa46a"); }
      else { px(wx - 1, wy - 1, 8, 3, "#6a7385"); }
    }
  }
  // dying enemy: tips over and fades, leaving a blood pool behind
  function drawEnemyDeath(e) {
    const t = 1 - e.deathT / 16;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t * 0.25);
    ctx.translate(e.x, e.y);
    ctx.rotate(t * Math.PI / 2);
    ctx.translate(-e.x, -e.y);
    drawActor(e.x, e.y, e.facing, enemyPal(e), { evil: true, weapon: e.gun ? "pistol" : null });
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function drawDog(x, y, angle, e) {    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(x - 6, y + 3, 12, 3);
    px(x - 7, y - 4, 14, 8, e.color);
    const hx = x + Math.round(Math.cos(angle) * 6), hy = y + Math.round(Math.sin(angle) * 6);
    px(hx - 3, hy - 3, 6, 6, e.color);
    // snout
    px(hx + Math.round(Math.cos(angle) * 3) - 1, hy + Math.round(Math.sin(angle) * 3) - 1, 3, 3, "#7a531f");
    // legs
    px(x - 6, y - 5, 2, 4, "#7a531f"); px(x - 6, y + 2, 2, 4, "#7a531f"); px(x + 5, y - 5, 2, 4, "#7a531f"); px(x + 5, y + 2, 2, 4, "#7a531f");
    // red eyes
    px(hx - 1, hy - 1, 2, 2, "#ff3b3b");
  }

  // ---- lab cover props (block movement + sight) ----
  function drawCover(c) {
    const x = c.x, y = c.y, w = c.w, h = c.h, k = c.kind || "bench";
    // shared steel base so the prop reads as lab furniture, not a crate
    px(x, y, w, h, "#3c4654");
    px(x, y, w, 3, "#566273");
    px(x, y + h - 2, w, 2, "#222a33");
    if (k === "bench") {            // lab bench: steel top + basin
      px(x + 2, y + 3, w - 4, 4, "#7d8aa0");
      px(x + 4, y + 6, w - 8, 3, "#2b3340");
      px(x + 4, y + 6, 3, 2, "#9fd0ff");   // water glint
    } else if (k === "sink") {      // stainless sink: basin + faucet
      px(x + 3, y + 4, w - 6, h - 7, "#586478");
      px(x + 4, y + 5, w - 8, h - 9, "#2b3340");
      px(x + w / 2 - 1, y + 1, 2, 3, "#aeb9c9"); // faucet
      px(x + w / 2 - 2, y + 4, 4, 2, "#9fd0ff"); // drain glint
    } else if (k === "table") {     // exam table: padded top
      px(x + 2, y + 3, w - 4, h - 6, "#46506a");
      px(x + 3, y + 4, w - 6, 3, "#7f8aa6");
      px(x + 4, y + h - 4, w - 8, 2, "#222a33");
    } else if (k === "cabinet") {   // supply cabinet: doors + handle
      px(x + 2, y + 2, w - 4, h - 4, "#566273");
      px(x + 3, y + 3, (w - 6) / 2, h - 6, "#424b5c");
      px(x + w / 2 + 1, y + 3, (w - 6) / 2, h - 6, "#424b5c");
      px(x + w / 2 - 1, y + 4, 1, h - 8, "#aeb9c9");
    } else {                        // shelf: two steel tiers
      px(x + 2, y + 3, w - 4, 2, "#7d8aa0");
      px(x + 2, y + 8, w - 4, 2, "#7d8aa0");
      px(x + 4, y + 5, 3, 2, "#9fd0ff");
      px(x + w - 7, y + 10, 3, 2, "#9fd0ff");
    }
  }

  // ---- lab decorations (non-interactable) ----
  function drawDecor(x, y, type) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(x - 9, y + 6, 18, 3);
    if (type === "desk" || type === "crate") {
      px(x - 10, y - 7, 20, 14, type === "crate" ? "#7a5a36" : "#5b6470");
      px(x - 10, y - 7, 20, 4, type === "crate" ? "#5c4226" : "#727c8a");
    } else if (type === "monitor" || type === "computer") {
      px(x - 9, y - 8, 18, 12, "#2b2f3a"); px(x - 7, y - 6, 14, 8, "#7fd0ff"); px(x - 3, y + 3, 6, 3, "#1c2029");
    } else if (type === "plant") {
      px(x - 5, y + 1, 10, 6, "#7a5a36"); px(x - 4, y - 4, 4, 5, "#2faa55"); px(x + 1, y - 3, 4, 5, "#2faa55"); px(x - 2, y - 7, 4, 5, "#2faa55");
    } else if (type === "shelf") {
      px(x - 10, y - 9, 20, 18, "#6b4a2c"); px(x - 10, y - 9, 20, 4, "#3a2a18"); px(x - 10, y + 1, 20, 4, "#3a2a18"); px(x - 8, y - 5, 6, 6, "#c7d0dc"); px(x + 2, y - 5, 6, 6, "#c7d0dc");
    } else if (type === "bed") {
      px(x - 10, y - 6, 20, 12, "#3a4250"); px(x - 10, y - 6, 20, 5, "#cfd8e6"); px(x + 4, y - 2, 5, 9, "#9aa6b8");
    } else if (type === "toilet") {
      px(x - 5, y - 3, 10, 9, "#e8eef5"); px(x - 5, y - 6, 10, 4, "#cdd6e2");
    } else if (type === "sink") {
      px(x - 8, y - 4, 16, 8, "#e8eef5"); px(x - 3, y - 1, 6, 3, "#aeb9c9");
    } else if (type === "kennel") {
      px(x - 10, y - 8, 20, 16, "#6b4a2c"); ctx.strokeStyle = "#3a2a18"; ctx.lineWidth = 1;
      for (let i = -7; i <= 7; i += 4) { ctx.beginPath(); ctx.moveTo(x + i, y - 8); ctx.lineTo(x + i, y + 8); ctx.stroke(); }
      px(x - 7, y - 5, 14, 11, "#caa46a");
    } else {
      px(x - 8, y - 8, 16, 16, "#4a5160"); px(x - 5, y - 5, 10, 5, "#7fd0ff");
    }
  }

  function drawArrow(x1, y1, x2, y2) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const r = 30;
    const ax = Math.round(x1 + Math.cos(ang) * r), ay = Math.round(y1 + Math.sin(ang) * r);
    const tx = Math.round(x1 + Math.cos(ang) * (r + 14)), ty = Math.round(y1 + Math.sin(ang) * (r + 14));
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
    px(8, -4, 8, 8, "#ff4d4d"); px(-4, -2, 12, 4, "#ff4d4d");
    ctx.restore();
    ctx.fillStyle = "#ff4d4d"; ctx.font = "bold 7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("EXIT", tx, ty);
  }

  // ===========================================================================
  //  HUD  (translates invisible system data into readable feedback)
  // ===========================================================================
  function updateHud() {
    if (!hud) return;
    const p = GAME.player;
    const w = WEAPONS[p.weapon];
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const bar = (id, v) => { const el = document.getElementById(id); if (el) el.style.width = v; };
    const bg = (id, v) => { const el = document.getElementById(id); if (el) el.style.background = v; };
    const col = (id, v) => { const el = document.getElementById(id); if (el) el.style.color = v; };
    bar("hp-bar", (p.hp / p.maxHp * 100) + "%");
    set("hp-text", p.hp > 0 ? "ALIVE (1-HIT)" : "DEAD");
    set("weapon-name", w.name);
    set("score-text", GAME.calc.score);
    set("combo-text", GAME.calc.combo > 1 ? "x" + GAME.calc.combo : "-");

    const danger = GAME.calc.danger || 0;
    bar("alert-bar", (danger * 100) + "%");
    bg("alert-bar", danger > 0.66 ? "#ff4d4d" : danger > 0.33 ? "#ffb24d" : "#7CFFA1");
    const remain = GAME.env.enemies.filter(e => !e.dead).length;
    const label = GAME.calc.sectionCleared ? "REACH THE EXIT →"
                : GAME.calc.anyChasing ? "SPOTTED — RUN!"
                : "Enemies left: " + remain;
    set("alert-label", label);
    col("alert-label", GAME.calc.sectionCleared ? "#7CFFA1" : GAME.calc.anyChasing ? "#ff4d4d" : "#ffd36b");

    set("stat-line", `${GAME.env.name}  ·  Score ${GAME.calc.score}  ·  ${GAME.calc.sectionCleared ? "Follow the red arrow" : "Clear them all"}`);

    const slots = [["1", "fists"], ["2", "knife"], ["6", "bat"], ["3", "pistol"], ["4", "silenced"], ["5", "shotgun"]];
    const inv = document.getElementById("inventory");
    if (inv) inv.innerHTML = slots.map(([k, wn]) => {
      const owned = p.inventory[wn]; const active = p.weapon === wn;
      return `<span class="slot ${active ? "active" : ""} ${owned ? "" : "locked"}">${k} ${WEAPONS[wn].name}</span>`;
    }).join("");
  }

  let hudFlashTimer = null;
  function flashHud(msg) {
    const el = document.getElementById("toast"); if (!el) return;
    el.textContent = msg; el.style.opacity = "1";
    clearTimeout(hudFlashTimer); hudFlashTimer = setTimeout(() => { el.style.opacity = "0"; }, 1400);
  }

  // ===========================================================================
  //  END SCREEN
  // ===========================================================================
  function showEndScreen(won) {
    stopTension();
    const t = ((performance.now() - GAME.calc.timeStart) / 1000).toFixed(1);
    const overlay = document.getElementById("overlay");
    const isLast = GAME.levelIndex === LEVELS.length - 1;
    overlay.style.display = "flex";
    overlay.innerHTML = `
      <div class="panel ${won ? "win" : "dead"}">
        ${won ? "" : `<div class="death-stamp">YOU DIED</div>`}
        <h2 style="color:${won ? "#7CFFA1" : "#ff6b6b"}">${won ? (isLast ? "YOU ESCAPED" : "LEVEL CLEARED") : "CAUGHT"}</h2>
        <p>${GAME.env.name}</p>
        <div class="end-stats">
          <span>Time ${t}s</span><span>Score ${GAME.calc.score}</span>
          <span>Best combo x${GAME.calc.bestCombo}</span><span>Kills ${GAME.calc.kills}</span>
        </div>
        ${won
          ? (isLast ? `<p class="win-final">All 3 levels complete. You read the lab and escaped.</p><button id="btn-restart">Play again (Level 1)</button>`
                    : `<button id="btn-next">Next level →</button><button id="btn-retry" class="ghost">Replay</button>`)
          : `<p class="tip">Don't be afraid to die — enemies are predictable. Learn the room, then go fast and brutal. Try a different mask or weapon.</p>
             <button id="btn-retry">Try again (R)</button><button id="btn-menu" class="ghost">Level select</button>`}
      </div>`;
    const bn = document.getElementById("btn-next"), br = document.getElementById("btn-retry"),
          bR = document.getElementById("btn-restart"), bm = document.getElementById("btn-menu");
    if (bn) bn.onclick = () => { overlay.style.display = "none"; loadLevel(GAME.levelIndex + 1, GAME.currentMask); };
    if (br) br.onclick = () => { overlay.style.display = "none"; loadLevel(GAME.levelIndex, GAME.currentMask); };
    if (bR) bR.onclick = () => { overlay.style.display = "none"; loadLevel(0, GAME.currentMask); };
    if (bm) bm.onclick = () => { overlay.style.display = "none"; showLevelSelect(); };
  }

  // ===========================================================================
  //  MENUS  (all rendered INSIDE the game frame)
  // ===========================================================================
  function showLevelSelect() {
    GAME.state = "menu";
    stopTension();
    const overlay = document.getElementById("overlay");
    overlay.style.display = "flex";
    overlay.innerHTML = `
      <div class="panel">
        <h2>SELECT LEVEL</h2>
        <p class="sub">Each level changes enemy types, awareness and weapons (a challenge preset).</p>
        <div class="level-select">
          ${LEVELS.map((l, i) => `
            <button class="level-card" data-idx="${i}">
              <span class="lc-num">Level ${i + 1}</span>
              <span class="lc-name">${l.name}</span>
              <span class="lc-sub">${l.subtitle}</span>
            </button>`).join("")}
        </div>
        <button id="btn-back" class="ghost">Back</button>
      </div>`;
    overlay.querySelectorAll(".level-card").forEach(b => {
      b.onclick = () => { overlay.style.display = "none"; showMaskForLevel(parseInt(b.dataset.idx, 10)); };
    });
    const bb = document.getElementById("btn-back"); if (bb) bb.onclick = () => { overlay.style.display = "none"; showMenu(); };
  }

  function showMaskForLevel(idx) {
    const overlay = document.getElementById("overlay");
    overlay.style.display = "flex";
    overlay.innerHTML = `
      <div class="panel">
        <h2>${LEVELS[idx].name}</h2>
        <p class="sub">Pick a mask — each changes how the level plays (Hotline Miami style).</p>
        <div class="level-select">
          ${Object.entries(MASKS).map(([k, m]) => `
            <button class="level-card" data-mask="${k}">
              <span class="lc-num">${m.name}</span>
              <span class="lc-name">${m.perk}</span>
              <span class="lc-sub">${m.desc}</span>
            </button>`).join("")}
        </div>
        <button id="btn-back" class="ghost">Back</button>
        <p class="controls-mini">WASD move · LMB punch/shoot · RMB grab/throw/door · Space execute · Shift aim · MMB lock-on · R restart</p>
      </div>`;
    overlay.querySelectorAll(".level-card").forEach(b => {
      b.onclick = () => { overlay.style.display = "none"; loadLevel(idx, b.dataset.mask); };
    });
    const bb = document.getElementById("btn-back"); if (bb) bb.onclick = () => { overlay.style.display = "none"; showLevelSelect(); };
  }

  function showMenu() {
    GAME.state = "menu";
    stopTension();
    const overlay = document.getElementById("overlay");
    overlay.style.display = "flex";
    overlay.innerHTML = `
      <div class="panel">
        <h2 class="title-neon">LAB ESCAPE</h2>
        <p class="sub">Top-down stealth shooter · escape the lab · 3 levels</p>
        <p class="lvl-help">Pick a mask to start at Level 1. Clear a level and the next loads automatically — no menus between fights.</p>
        <div class="level-select">
          ${Object.entries(MASKS).map(([k, m]) => `
            <button class="level-card start" data-mask="${k}">
              <span class="lc-num">${m.name}</span>
              <span class="lc-name">${m.perk}</span>
              <span class="lc-sub">${m.desc}</span>
            </button>`).join("")}
        </div>
        <button id="btn-levels" class="ghost">Or pick a level →</button>
        <p class="controls-mini">WASD move · LMB punch/shoot · RMB grab/throw/door · Space execute · Shift aim · MMB lock-on · R restart</p>
      </div>`;
    overlay.querySelectorAll(".level-card.start").forEach(b => {
      b.onclick = () => { overlay.style.display = "none"; loadLevel(0, b.dataset.mask); };
    });
    const bl = document.getElementById("btn-levels"); if (bl) bl.onclick = () => { overlay.style.display = "none"; showLevelSelect(); };
  }

  // ===========================================================================
  //  AUDIO (offline WebAudio tension tone)
  // ===========================================================================
  function startTension() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (tensionOsc) return;
      tensionOsc = audioCtx.createOscillator(); tensionGain = audioCtx.createGain();
      tensionOsc.type = "sawtooth"; tensionOsc.frequency.value = 55;
      tensionGain.gain.value = 0.0;
      tensionOsc.connect(tensionGain).connect(audioCtx.destination);
      tensionOsc.start();
    } catch (e) { /* audio optional */ }
  }
  function stopTension() { if (tensionGain) tensionGain.gain.value = 0; }
  function updateTension() {
    if (!tensionGain || !GAME.env) return;
    const remain = GAME.env.enemies.filter(e => !e.dead && !e.downed).length;
    const proximity = Math.min(1, remain / 6);
    const target = GAME.state === "playing" ? (0.01 + proximity * 0.05) : 0;
    tensionGain.gain.value += (target - tensionGain.gain.value) * 0.1;
    if (tensionOsc) tensionOsc.frequency.value = 48 + proximity * 40;
  }
  function loop() {
    update();
    if (GAME.env) { render(); updateTension(); }
    requestAnimationFrame(loop);
  }

  // ===========================================================================
  //  INPUT + BOOT
  // ===========================================================================
  function bindInput() {
    window.addEventListener("keydown", e => {
      const k = e.key.toLowerCase();
      keys[k] = true;
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      if (k === "p") paused = !paused;
      if (k === "r" && (GAME.state === "playing" || GAME.state === "dying" || GAME.state === "lost")) { if (GAME.state === "lost") document.getElementById("overlay").style.display = "none"; loadLevel(GAME.levelIndex, GAME.currentMask); }
      if (k === " ") trySpace();
      const map = { "1": "fists", "2": "knife", "3": "pistol", "4": "silenced", "5": "shotgun", "6": "bat" };
      if (map[k] && GAME.player && GAME.player.inventory[map[k]]) GAME.player.weapon = map[k];
      if (k === "enter" && GAME.state === "won" && GAME.levelIndex < LEVELS.length - 1) { document.getElementById("overlay").style.display = "none"; loadLevel(GAME.levelIndex + 1, GAME.currentMask); }
    });
    window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; if (e.key === " ") spaceLock = false; });
    window.addEventListener("mouseup", e => { if (e.button === 0) mouse.left = false; if (e.button === 2) { mouse.right = false; rightLock = false; } if (e.button === 1) mouse.mid = false; });

    function setMouse(e) {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    }
    canvas.addEventListener("mousemove", setMouse);
    canvas.addEventListener("mousedown", e => {
      setMouse(e);
      if (e.button === 0) mouse.left = true;
      if (e.button === 2) mouse.right = true;
      if (e.button === 1) { mouse.mid = true; tryLockOn(); }
    });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
  }

  function tryLockOn() {
    const p = GAME.player;
    if (!p) return;
    if (p.lockTarget && !p.lockTarget.dead) { p.lockTarget = null; return; }
    let best = null, bd = 20;
    for (const e of GAME.env.enemies) {
      if (e.dead || e.downed) continue;
      const d = dist(mouse.x, mouse.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) p.lockTarget = best;
  }

  function init() {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");
    hud = document.getElementById("hud");
    bindInput();
    showMenu();
    loop();
  }

  window.LabEscape = {
    init, loadLevel, showMenu, showLevelSelect, showMaskForLevel,
    get GAME() { return GAME; }, LEVELS, WEAPONS, MASKS,
    _forceState: s => { GAME.state = s; },
    _teleport: (x, y) => { if (GAME.player) { GAME.player.x = x; GAME.player.y = y; } },
    _sightBlocked: (ax, ay, bx, by) => sightBlocked(ax, ay, bx, by),
    _tick: () => update(),
    _blocked: (x, y) => solidsForMovement().some(s => circleRect(x, y, 5, s)),
    _move: (e, dx, dy) => moveEntity(e, dx, dy, 5),
    _whosBlock: (x, y) => solidsForMovement().filter(s => circleRect(x, y, 5, s)).map(s => ({ x: s.x, y: s.y, w: s.w, h: s.h }))
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
