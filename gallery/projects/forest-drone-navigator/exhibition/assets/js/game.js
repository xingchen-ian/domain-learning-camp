/* ============================================================
   无人机森林导航 · 3D  (Three.js, no build step, offline)
   - 目标：飞到 LAND 平台并把高度降到 0 即胜
   - 树木：从上方飞过（树顶 top）；电缆：低于标注高度 bot 通过
   - 风：持续横向加速度，需补偿
   ============================================================ */
(function () {
  'use strict';

  // ---------- constants ----------
  const FIELD_HALF_W = 70;   // 森林半宽（X 方向边界）
  let PAD_Z = 640;           // LAND 平台位置（前进方向 +Z），随关卡变化
  const GOAL_R = 44;         // 平台半径
  const DRONE_R = 4;         // 无人机碰撞半径
  const TREE_R = 8;          // 树木碰撞半径（XZ）
  const CABLE_BAND = 6;      // 电缆纵向碰撞带宽
  const LAND_THRESHOLD = 3;  // 落地判定高度
  const START_ALT = 70;      // 起点高度
  const THRUST = 55;         // 推进加速度
  const BOOST = 1.8;         // 按住 Control 时的推力倍率（加速）
  const DRAG = 0.7;          // 阻力系数（动量/惯性感）
  const WIND_SCALE = 1.0;    // 风加速度缩放
  const CEIL = 130;          // 高度上限

  // ---------- RNG（每次新开随机布局） ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- level definitions ----------
  const LEVELS = [
    { name: 'P1 · 入门', tier: 0, seed: 11, windSpeed: 8,  windDir: 0.3, padZ: 700, time: 60 },
    { name: 'P2 · 进阶', tier: 1, seed: 23, windSpeed: 12, windDir: -0.5, padZ: 1040, time: 40 },
    { name: 'P3 · 挑战', tier: 2, seed: 37, windSpeed: 16, windDir: 0.6, padZ: 1760, time: 30 }
  ];

  // 关卡布局：沿前进方向（Z）排布一串「关卡门」(gate)，相邻门间距 GATE，
  // 保证树（需从上方飞过）与电缆（需从下方钻过）永不在同一 Z 窗口冲突。
  const GATE = 180;
  const PATTERNS = [
    ['trees', 'trees', 'trees'],
    ['cable', 'trees', 'cable', 'trees', 'cable'],
    ['trees', 'cable', 'trees', 'cable', 'trees', 'cable', 'trees', 'cable', 'trees']
  ];
  const CABLE_BOTS = [
    [],
    [48, 60, 54],
    [50, 62, 54, 64]
  ];

  // 当前语言的关卡名（P1/P2/P3）
  function lvlName(i) { return I18N[getLang()].lv_names[i]; }

  // 随机生成：每次新开局用随机种子，树/电缆位置都不同，但沿用已验证可通关的
  // 门间距与高度结构，不会出现「既要高于树、又要低于缆」的死走廊。
  function genField(idx) {
    const level = LEVELS[idx];
    const rng = mulberry32((Math.random() * 0x7fffffff) | 0);  // 每次开局随机
    const pattern = PATTERNS[idx];
    const bots = CABLE_BOTS[idx];
    const trees = [], cables = [];
    let z = 120, ci = 0;
    for (let gi = 0; gi < pattern.length; gi++) {
      const type = pattern[gi];
      if (type === 'cable') {
        cables.push({ z: z, bot: bots[ci++] });
      } else {
        const n = idx === 0 ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 3);
        for (let i = 0; i < n; i++) {
          const x = (rng() * 2 - 1) * (FIELD_HALF_W - 14);
          let top;
          if (idx === 0) top = 26 + rng() * 10;                 // 26-36 矮树
          else {
            const tall = rng() < 0.6;                            // 约 60% 高树
            top = tall ? 52 + rng() * 20 : 26 + rng() * 16;      // 52-72（部分 > 起点 70）
          }
          trees.push({ x: x, z: z + i * 12 + (rng() * 2 - 1) * 6, top: top });
        }
      }
      z += GATE;
    }
    return { trees, cables };
  }

  // ---------- three.js setup ----------
  let scene, camera, renderer;
  let drone, padMesh;
  const obstacleGroup = new THREE.Group();

  let state = 'menu'; // menu | paused | playing | win | lose
  const keys = {};
  const pos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  let windVec = new THREE.Vector3();
  let levelIdx = 0;
  let lastLoseReason = 'unknown';
  let lastT = 0;
  let timeLeft = 0;        // 剩余时间（秒），仅 playing 时递减

  const dom = {};

  function initThree() {
    const canvas = document.getElementById('scene');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = false;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08160e);
    scene.fog = new THREE.Fog(0x0c2418, 320, 900);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, START_ALT + 20, -38);

    // lights
    const hemi = new THREE.HemisphereLight(0x9fe6b0, 0x0e2a1c, 0.95);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xeafbe9, 0.7);
    dir.position.set(80, 160, 60);
    scene.add(dir);

    // ground
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x163d24 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 2000), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 1000);
    scene.add(ground);

    const grid = new THREE.GridHelper(2000, 100, 0x2e6b40, 0x3f8f55);
    grid.position.set(0, 0.05, 1000);
    scene.add(grid);

    scene.add(obstacleGroup);

    buildDrone();
    buildPad();
    window.addEventListener('resize', onResize);
  }

  function buildDrone() {
    drone = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x39d353 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 6), bodyMat);
    drone.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 3), new THREE.MeshLambertMaterial({ color: 0x1f9d3a }));
    top.position.y = 1.8;
    drone.add(top);
    // arms + rotors
    const armMat = new THREE.MeshLambertMaterial({ color: 0x244a34 });
    const rotorMat = new THREE.MeshLambertMaterial({ color: 0xeafbe9, transparent: true, opacity: 0.85 });
    const offs = [[4, 4], [-4, 4], [4, -4], [-4, -4]];
    offs.forEach(function (o) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), armMat);
      arm.position.set(o[0], 0, o[1]);
      drone.add(arm);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 16), rotorMat);
      rotor.position.set(o[0], 1.4, o[1]);
      rotor.name = 'rotor';
      drone.add(rotor);
    });
    // front indicator (nose)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 12), new THREE.MeshLambertMaterial({ color: 0xc8f7d4 }));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 4);
    drone.add(nose);
    scene.add(drone);
  }

  function buildPad() {
    padMesh = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(GOAL_R, GOAL_R, 1.2, 40),
      new THREE.MeshLambertMaterial({ color: 0x163d24 })
    );
    base.position.y = 0.6;
    padMesh.add(base);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(GOAL_R - 4, 1.2, 12, 40),
      new THREE.MeshLambertMaterial({ color: 0x39d353 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.3;
    padMesh.add(ring);
    const label = makeTextSprite('LAND', '#ffffff', 14, '#0e2a1c');
    label.position.set(0, 14, 0);
    padMesh.add(label);
    padMesh.position.set(0, 0, PAD_Z);
    scene.add(padMesh);
  }

  // canvas-texture sprite for floating labels
  function makeTextSprite(text, color, fontPx, bg) {
    const c = document.createElement('canvas');
    const pad = 12;
    const ctx = c.getContext('2d');
    const font = 'bold ' + (fontPx || 13) + 'px sans-serif';
    ctx.font = font;
    const w = ctx.measureText(text).width + pad * 2;
    const h = fontPx + pad * 2;
    c.width = w; c.height = h;
    ctx.font = font;
    if (bg) { ctx.fillStyle = bg; roundRect(ctx, 0, 0, w, h, 8); ctx.fill(); }
    ctx.fillStyle = color || '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(w / 6, h / 6, 1);
    return sp;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- build obstacle field for a level ----------
  function buildField(idx) {
    const level = LEVELS[idx];
    // clear old
    while (obstacleGroup.children.length) {
      const c = obstacleGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); }
    }
    const field = genField(idx);
    const trees = field.trees;
    const cables = field.cables;
    obstacleGroup.userData.trees = trees;
    obstacleGroup.userData.cables = cables;

    trees.forEach(function (tree) {
      const g = new THREE.Group();
      const trunkH = tree.top * 0.55;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 3.2, trunkH, 10),
        new THREE.MeshLambertMaterial({ color: 0x6d4c41 })
      );
      trunk.position.y = trunkH / 2;
      g.add(trunk);
      // canopy (stacked cones up to top)
      let cy = trunkH;
      let r = 11;
      while (cy < tree.top) {
        const ch = Math.min(14, tree.top - cy + 4);
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(r, ch, 12),
          new THREE.MeshLambertMaterial({ color: 0x3f9d4f })
        );
        cone.position.y = cy + ch / 2 - 2;
        g.add(cone);
        cy += ch * 0.6;
        r *= 0.78;
      }
    // label（每棵树都显示高度，便于判断需爬升多少）
    const h = Math.round(tree.top);
    const lab = makeTextSprite(t('tree_label', { h: h }), '#ffffff', 13, 'rgba(16,60,36,0.92)');
    lab.userData = { label: true, kind: 'tree', value: h, fg: '#ffffff', bg: 'rgba(16,60,36,0.92)' };
    lab.position.set(0, tree.top + 6, 0);
    g.add(lab);
    if (tree.top > START_ALT) {
      const tall = makeTextSprite(t('tall_label', { h: h }), '#06291a', 13, 'rgba(124,209,122,0.95)');
      tall.userData = { label: true, kind: 'tall', value: h, fg: '#06291a', bg: 'rgba(124,209,122,0.95)' };
      tall.position.set(0, tree.top + 16, 0);
      g.add(tall);
    }
      g.position.set(tree.x, 0, tree.z);
      obstacleGroup.add(g);
    });

    cables.forEach(function (c) {
      const cableY = c.bot + 7;
      const pts = [];
      const seg = 24;
      for (let i = 0; i <= seg; i++) {
        const x = -FIELD_HALF_W + (i / seg) * (FIELD_HALF_W * 2);
        const sag = Math.sin((i / seg) * Math.PI) * 5; // 轻微下垂
        pts.push(new THREE.Vector3(x, cableY - sag, c.z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fe6c0 }));
      obstacleGroup.add(line);
      // poles
      [-FIELD_HALF_W, FIELD_HALF_W].forEach(function (px) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.8, 0.8, cableY + 8, 8),
          new THREE.MeshLambertMaterial({ color: 0x244a34 })
        );
        pole.position.set(px, (cableY + 8) / 2, c.z);
        obstacleGroup.add(pole);
      });
      const lab = makeTextSprite(t('cable_label', { b: c.bot }), '#ffffff', 13, 'rgba(16,60,40,0.95)');
      lab.userData = { label: true, kind: 'cable', value: c.bot, fg: '#ffffff', bg: 'rgba(16,60,40,0.95)' };
      lab.position.set(0, cableY + 6, c.z);
      obstacleGroup.add(lab);
    });
  }

  // Re-render the 3D world labels (trees / cables) in the current language
  // WITHOUT regenerating the layout — used when the player switches language
  // mid-game, so the in-scene "tree Xm" / "Altitude < X to pass" labels follow.
  function relabelField() {
    obstacleGroup.children.forEach(function (child) {
      const list = child.isGroup ? child.children : [child];
      list.forEach(function (sprite) {
        if (!sprite || !sprite.userData || !sprite.userData.label) return;
        const u = sprite.userData;
        const text = u.kind === 'cable' ? t('cable_label', { b: u.value })
                   : u.kind === 'tall' ? t('tall_label', { h: u.value })
                   : t('tree_label', { h: u.value });
        const ns = makeTextSprite(text, u.fg, 13, u.bg);
        if (sprite.material.map) sprite.material.map.dispose();
        sprite.material.map = ns.material.map;
        if (sprite.material.map) sprite.material.map.needsUpdate = true;
        sprite.material.needsUpdate = true;
        sprite.scale.copy(ns.scale);
        ns.material.dispose();
      });
    });
  }

  // ---------- game flow ----------
  function startLevel(idx) {
    levelIdx = idx;
    const level = LEVELS[idx];
    PAD_Z = level.padZ;
    padMesh.position.z = PAD_Z;
    timeLeft = level.time;
    buildField(idx);
    pos.set(0, START_ALT, 8);
    vel.set(0, 0, 0);
    const a = level.windDir;
    windVec.set(Math.cos(a) * level.windSpeed, 0, Math.sin(a) * level.windSpeed);
    hideOverlays();
    dom.hud.classList.remove('hidden');
    dom.hudLevel.textContent = t('hud_level_prefix') + lvlName(levelIdx);
    dom.helpAdv.classList.toggle('hidden', idx === 0);
    dom.help.classList.remove('hidden');
    state = 'paused';
  }

  function resetToMenu() {
    hideOverlays();
    dom.hud.classList.add('hidden');
    dom.menu.classList.remove('hidden');
    state = 'menu';
  }

  function hideOverlays() {
    dom.menu.classList.add('hidden');
    dom.help.classList.add('hidden');
    dom.win.classList.add('hidden');
    dom.lose.classList.add('hidden');
  }

  function win() {
    state = 'win';
    const used = Math.max(0, Math.round(LEVELS[levelIdx].time - timeLeft));
    dom.winMsg.textContent = t('win_msg', { name: lvlName(levelIdx), used: used });
    dom.win.classList.remove('hidden');
  }
  function lose(reason) {
    state = 'lose';
    lastLoseReason = reason || 'unknown';
    let m = t('lose_default');
    if (reason === 'tree') m = t('lose_tree');
    else if (reason === 'cable') m = t('lose_cable');
    else if (reason === 'ground') m = t('lose_ground');
    else if (reason === 'time') m = t('lose_time');
    else if (reason === 'out') m = t('lose_out');
    dom.loseMsg.textContent = m;
    dom.lose.classList.remove('hidden');
  }

  // ---------- physics ----------
  function update(dt) {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; lose('time'); return; }

    const a = new THREE.Vector3();
    const boost = keys['control'] ? BOOST : 1;   // 按住 Control 加速
    if (keys['w']) a.z += THRUST * boost;
    if (keys['s']) a.z -= THRUST * 0.7 * boost;
    if (keys['a']) a.x += THRUST * boost;   // A → 屏幕左
    if (keys['d']) a.x -= THRUST * boost;   // D → 屏幕右
    if (keys['u']) a.y += THRUST * boost;
    if (keys['h']) a.y -= THRUST * boost;
    a.x += windVec.x * WIND_SCALE;
    a.z += windVec.z * WIND_SCALE;

    vel.addScaledVector(a, dt);
    const damp = Math.max(0, 1 - DRAG * dt);
    vel.multiplyScalar(damp);
    pos.addScaledVector(vel, dt);

    // 超出飞行范围 → 任务失败（按重来按钮可重试）
    if (Math.abs(pos.x) > FIELD_HALF_W + 4) { lose('out'); return; }
    if (pos.z < -5 || pos.z > PAD_Z + 20) { lose('out'); return; }
    if (pos.y > CEIL) { pos.y = CEIL; vel.y = Math.min(0, vel.y); }

    // collisions
    const trees = obstacleGroup.userData.trees || [];
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const dx = pos.x - t.x, dz = pos.z - t.z;
      const rr = (TREE_R + DRONE_R);
      if (dx * dx + dz * dz < rr * rr && pos.y < t.top) { lose('tree'); return; }
    }
    const cables = obstacleGroup.userData.cables || [];
    for (let i = 0; i < cables.length; i++) {
      const c = cables[i];
      if (Math.abs(pos.z - c.z) < CABLE_BAND && pos.y > c.bot) { lose('cable'); return; }
    }

    // landing / crash
    if (pos.y <= LAND_THRESHOLD) {
      const dx = pos.x, dz = pos.z - PAD_Z;
      if (dx * dx + dz * dz < GOAL_R * GOAL_R) { win(); }
      else { lose('ground'); }
      return;
    }

    // sync drone
    drone.position.copy(pos);
    drone.rotation.z = THREE.MathUtils.clamp(-vel.x * 0.02, -0.5, 0.5);
    drone.rotation.x = THREE.MathUtils.clamp(vel.z * 0.012, -0.4, 0.4);

    // spin rotors
    drone.traverse(function (o) { if (o.name === 'rotor') o.rotation.y += dt * 30; });

    // camera follow (chase cam)
    const camTarget = new THREE.Vector3(pos.x * 0.5, pos.y + 18, pos.z - 40);
    camera.position.lerp(camTarget, 0.08);
    camera.lookAt(pos.x * 0.4, pos.y + 2, pos.z + 12);

    updateHUD();
  }

  function updateHUD() {
    const alt = Math.max(0, pos.y);
    dom.altVal.textContent = Math.round(alt);
    dom.altFill.style.width = Math.min(100, (alt / CEIL) * 100) + '%';
    const ws = Math.round(windVec.length());
    dom.windVal.textContent = ws + ' m/s';
    const ang = Math.atan2(windVec.z, windVec.x) * 180 / Math.PI;
    dom.windArrow.style.transform = 'rotate(' + ang + 'deg)';
    const spd = vel.length();
    dom.hudSpeed.textContent = t('speed_prefix') + Math.round(spd) + (keys['control'] ? t('boost_suffix') : '');
    const dist = Math.max(0, PAD_Z - pos.z);
    dom.hudProgress.textContent = t('progress_prefix') + Math.round(dist) + ' m';
    dom.hudTime.textContent = '⏱ ' + Math.ceil(timeLeft) + ' s';
    dom.hudTime.classList.toggle('warn', timeLeft <= 10);
  }

  // ---------- loop ----------
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min((t - lastT) / 1000 || 0, 0.05);
    lastT = t;
    if (state === 'playing') update(dt);
    else {
      // keep rotor spin + camera gentle even when paused
      drone.position.copy(pos);
      drone.traverse(function (o) { if (o.name === 'rotor') o.rotation.y += dt * 8; });
    }
    renderer.render(scene, camera);
  }

  // ---------- input ----------
  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (k === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (state === 'paused' && !dom.help.classList.contains('hidden')) {
        dom.help.classList.add('hidden');
        state = 'playing';
      } else if (state === 'playing') {
        dom.help.classList.remove('hidden');
        state = 'paused';
      }
      return;
    }
    if (['w', 'a', 's', 'd', 'u', 'h', 'control'].indexOf(k) >= 0) {
      keys[k] = true;
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'u', 'h', 'control'].indexOf(k) >= 0) keys[k] = false;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------- boot ----------
  function boot() {
    dom.menu = document.getElementById('menu');
    dom.help = document.getElementById('help');
    dom.helpAdv = document.getElementById('help-adv');
    dom.win = document.getElementById('win');
    dom.lose = document.getElementById('lose');
    dom.hud = document.getElementById('hud');
    dom.altVal = document.getElementById('alt-val');
    dom.altFill = document.getElementById('alt-fill');
    dom.windVal = document.getElementById('wind-val');
    dom.windArrow = document.getElementById('wind-arrow');
    dom.hudLevel = document.getElementById('hud-level');
    dom.hudSpeed = document.getElementById('hud-speed');
    dom.hudProgress = document.getElementById('hud-progress');
    dom.hudTime = document.getElementById('hud-time');
    dom.winMsg = document.getElementById('win-msg');
    dom.loseMsg = document.getElementById('lose-msg');

    initThree();

    // store tree/cable data on group for collision checks
    obstacleGroup.userData.trees = [];
    obstacleGroup.userData.cables = [];

    document.querySelectorAll('.lv-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        startLevel(parseInt(b.getAttribute('data-lv'), 10));
      });
    });
    document.getElementById('win-again').addEventListener('click', function () { startLevel(levelIdx); });
    document.getElementById('lose-again').addEventListener('click', function () { startLevel(levelIdx); });
    document.getElementById('win-menu').addEventListener('click', resetToMenu);
    document.getElementById('lose-menu').addEventListener('click', resetToMenu);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // re-render dynamic overlay / HUD text when language switches
    window.onLangChange = function () {
      relabelField();
      if (state === 'win') win();
      else if (state === 'lose') lose(lastLoseReason);
      if (state === 'playing' || state === 'paused') {
        dom.hudLevel.textContent = t('hud_level_prefix') + lvlName(levelIdx);
      }
      updateHUD();
    };

    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
