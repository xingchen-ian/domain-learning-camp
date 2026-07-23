/* 旋界 · 旋转跑酷 — 浏览器渲染与输入层（依赖 engine.js 提供的 window.GameEngine） */
(function () {
  'use strict';
  var E = window.GameEngine;
  if (!E) { console.error('GameEngine 未加载'); return; }

  // 配色：墙 = 实心岩体颜色；空气/路 = 原来的画布底色(路与之前一致)
  var WALL_COLOR = '#2b3358';
  var AIR_COLOR = '#0a0d18';

  var modal = document.getElementById('game-modal');
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var playBtns = [document.getElementById('play-btn'), document.getElementById('play-btn-top')];
  var closeBtn = document.getElementById('game-close');
  var startBtn = document.getElementById('game-start');
  var overlay = document.getElementById('game-overlay');
  var overlayTitle = document.getElementById('game-overlay-text');
  var overlaySub = document.getElementById('game-overlay-sub');
  var levelLabel = document.getElementById('game-level');
  var deathsLabel = document.getElementById('game-deaths');

  var SIZE = E.LEVELS[0].grid[0].length * E.CELL; // 视口尺寸 16x16 -> 640(大于此尺寸的关卡将卷动)
  canvas.width = SIZE; canvas.height = SIZE;

  var world = null;
  var levelIndex = 0;
  var gearAngle = 0;        // 齿轮自转
  var camAnchor = null;     // 主角在屏幕上的锚点(镜头跟随+按关卡边界钳制)
  var rotFreeze = null;     // 旋转动画期间冻结的镜头 {anchor, P}
  var running = false;
  var raf = null;
  var mode = 'ready';       // ready | playing | won | dead
  var keys = {};
  var toastMsg = '', toastUntil = 0;
  function showToast(msg) { toastMsg = msg; toastUntil = Date.now() + 1400; }

  function loadLevel(i) {
    levelIndex = i;
    world = E.createWorld(i);
    rotFreeze = null;
    camAnchor = computeAnchor(0, playerCenter());
    levelLabel.textContent = world.name;
    deathsLabel.textContent = world.deaths;
    hideOverlay();
    mode = 'playing';
    running = true;
    if (!raf) loop();
  }

  function hideOverlay() { overlay.classList.add('hidden'); }
  function showOverlay(title, sub, btnText) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    startBtn.textContent = btnText;
    overlay.classList.remove('hidden');
  }

  function openModal() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    loadLevel(0); // 默认从第 1 关开始
  }
  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    running = false;
    cancelAnimationFrame(raf); raf = null;
  }

  function playerCenter() {
    return { x: world.player.x + E.PLAYER_W / 2, y: world.player.y + E.PLAYER_H / 2 };
  }

  // 计算主角屏幕锚点：长方形视野(前进方向 8 格、背面 3 格、上下各 4 格)，镜头跟随主角。
  // 渲染变换：screen(W) = A + R(-theta)·(W - P)，因此世界始终绕主角(P->A)旋转。
  // 视野"前进"方向 = 屏幕上方(与重力垂直、指向屏幕上方)；主角锚定在窗口内
  //   (背面3 / (背3+前8)) 处，使前方看到更多；上下对称(各4格)故纵向居中。
  var VIEW_FWD = 8, VIEW_BACK = 3, VIEW_UP = 4, VIEW_DOWN = 4; // 单位：格
  function computeAnchor(theta, P) {
    var VW = canvas.width, VH = canvas.height;
    var g = E.gravityVec(theta);
    // 屏幕前方(指向屏幕上方)与侧向(指向屏幕右方)的本地单位向量
    var fwd = { x: g.y, y: -g.x };   // 与重力垂直、屏幕向上
    var lat = { x: g.x, y: g.y };    // 沿重力(屏幕向下)
    var fAll = VIEW_BACK + VIEW_FWD;          // 前向总跨度 = 11
    var lAll = VIEW_UP + VIEW_DOWN;           // 侧向总跨度 = 8
    var fracF = VIEW_BACK / fAll;             // 主角在"前-后"方向的位置比例(偏后)
    var fracL = VIEW_UP / lAll;               // 侧向对称 -> 0.5
    var GW = world.cols * E.CELL, GH = world.rows * E.CELL;
    var spanF = fAll * E.CELL, spanL = lAll * E.CELL;
    function proj(v, base) { return v.x * base.x + v.y * base.y; }

    var wx, wy;
    if (spanF >= VW && spanL >= VH) {
      // 关卡比窗口大 -> 主角锚定在窗口 (fracF,fracL) 处，并钳制使窗口落在关卡内
      var p1 = proj(P, fwd), p2 = proj(P, lat);
      p1 = Math.max(spanF / 2, Math.min(GW - spanF / 2, p1));
      p2 = Math.max(spanL / 2, Math.min(GH - spanL / 2, p2));
      wx = fwd.x * p1 + lat.x * p2;
      wy = fwd.y * p1 + lat.y * p2;
    } else {
      // 否则(含整关可纳入画布的小关)：镜头跟随主角——主角固定在屏幕锚点，世界随之滚动
      wx = P.x; wy = P.y;
    }
    // 屏幕锚点：让该世界落点显示在 (fracF*VW, fracL*VH)
    var a = -theta * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    function inv(dx, dy) { return { x: dx * ca - dy * sa, y: dx * sa + dy * ca }; }
    var rel = inv(wx - P.x, wy - P.y);
    return { x: fracF * VW - rel.x, y: fracL * VH - rel.y };
  }

  function drawCell(c, r, color, inset) {
    var x = c * E.CELL + (inset || 0), y = r * E.CELL + (inset || 0);
    var w = E.CELL - (inset || 0) * 2;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, w);
  }

  function drawWorld() {
    var theta = world.getRenderAngle();
    var A = rotFreeze ? rotFreeze.anchor : camAnchor;
    var P = rotFreeze ? rotFreeze.P : playerCenter();

    ctx.save();
    ctx.translate(A.x, A.y);
    ctx.rotate(-theta * Math.PI / 180);
    ctx.translate(-P.x, -P.y);

    // 整屏墙已在 render() 铺好；这里只显式画出"空气/路"格子(含 S/G/^/O 所在格)，
    // 墙格再铺一层同色，使边界与底层无缝连成一片实心岩体。
    for (var r = 0; r < world.rows; r++) {
      for (var c = 0; c < world.cols; c++) {
        var ch = world.grid[r][c];
        if (ch === '#') {
          drawCell(c, r, WALL_COLOR);
        } else {
          drawCell(c, r, AIR_COLOR);
        }
      }
    }
    // 起点
    if (world.start) {
      ctx.fillStyle = 'rgba(108,140,255,0.25)';
      ctx.fillRect(world.start.c * E.CELL, world.start.r * E.CELL, E.CELL, E.CELL);
    }
    // 地刺（本地坐标：底部 ¼ 三角形）
    for (var i = 0; i < world.spikes.length; i++) {
      var sp = world.spikes[i];
      var x0 = sp.c * E.CELL, y0 = sp.r * E.CELL, C = E.CELL;
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath();
      if (sp.dir === 'down') {            // 台子在上方，尖朝下
        ctx.moveTo(x0 + 2, y0 + 1); ctx.lineTo(x0 + C / 2, y0 + C * 0.25); ctx.lineTo(x0 + C - 2, y0 + 1);
      } else if (sp.dir === 'right') {    // 台子在左方，尖朝右
        ctx.moveTo(x0 + 1, y0 + 2); ctx.lineTo(x0 + C * 0.25, y0 + C / 2); ctx.lineTo(x0 + 1, y0 + C - 2);
      } else if (sp.dir === 'left') {     // 台子在右方，尖朝左
        ctx.moveTo(x0 + C - 1, y0 + 2); ctx.lineTo(x0 + C * 0.75, y0 + C / 2); ctx.lineTo(x0 + C - 1, y0 + C - 2);
      } else {                            // 台子在下方，尖朝上(默认)
        ctx.moveTo(x0 + 2, y0 + C - 1); ctx.lineTo(x0 + C / 2, y0 + C * 0.75); ctx.lineTo(x0 + C - 2, y0 + C - 1);
      }
      ctx.closePath();
      ctx.fill();
    }
    // 齿轮（旋转锯片）
    for (var j = 0; j < world.gears.length; j++) {
      var gp = world.gears[j];
      var cx = gp.c * E.CELL + E.CELL / 2, cy = gp.r * E.CELL + E.CELL / 2, rad = E.CELL / 4;
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(gearAngle);
      ctx.fillStyle = '#ffb454';
      var teeth = 8;
      ctx.beginPath();
      for (var t = 0; t < teeth; t++) {
        var a = (t / teeth) * Math.PI * 2;
        var rr = (t % 2 === 0) ? rad + 4 : rad - 2;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2a12';
      ctx.beginPath(); ctx.arc(0, 0, rad * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // 终点（旗帜/光门）
    if (world.goal) {
      var gx = world.goal.c * E.CELL + E.CELL / 2, gy = world.goal.r * E.CELL + E.CELL / 2;
      var pulse = 0.5 + 0.5 * Math.sin(gearAngle * 2);
      ctx.fillStyle = 'rgba(56,232,197,' + (0.35 + 0.4 * pulse) + ')';
      ctx.beginPath(); ctx.arc(gx, gy, E.CELL * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#38e8c5';
      ctx.beginPath();
      ctx.moveTo(gx, gy - 10); ctx.lineTo(gx + 10, gy); ctx.lineTo(gx, gy + 10); ctx.lineTo(gx - 10, gy);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    var A = rotFreeze ? rotFreeze.anchor : camAnchor;
    if (!A) return;
    // 主角始终直立画在屏幕锚点上(不随世界旋转)——旋转时绝对屏幕位置不动
    var w = E.PLAYER_W, h = E.PLAYER_H;
    var x = A.x - w / 2, y = A.y - h / 2;
    ctx.fillStyle = '#eef1ff';
    ctx.fillRect(x, y, w, h);
    // 眼睛（朝屏幕下方，提示"重力向下"）
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(x + 2, y + h - 7, 2, 3);
    ctx.fillRect(x + w - 4, y + h - 7, 2, 3);
  }

  function render() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(0, 0, SIZE, SIZE); // 整屏先铺满墙：关外/旋转露出的区域也都是墙，不再像悬浮箱子
    if (!world) return;
    drawWorld();
    drawPlayer();
    if (toastMsg && Date.now() < toastUntil) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff5d73';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(toastMsg, SIZE / 2, SIZE - 24);
      ctx.restore();
    }
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (running && world && world.status === 'playing') {
      var input = {
        left: !!(keys['arrowleft'] || keys['a']),
        right: !!(keys['arrowright'] || keys['d']),
        up: !!(keys['arrowup'] || keys['w'] || keys[' '])
      };
      world.step(input);
      if (world.status === 'won') {
        running = false; mode = 'won';
        var last = levelIndex >= E.LEVELS.length - 1;
        showOverlay(last ? '全部通关！' : '过关！',
          last ? '你已通关全部教学关卡' : '准备好进入下一关了吗？',
          last ? '再玩一次' : '下一关');
      } else if (world.status === 'dead') {
        running = false; mode = 'dead';
        deathsLabel.textContent = world.deaths;
        showOverlay('失败', '碰到地刺或齿轮了，再试一次', '重试');
      }
    }
    // 镜头：旋转动画期间冻结(使主角绝对屏幕位置不动)，否则跟随主角
    if (world) {
      if (world.rotAnim.active) {
        if (!rotFreeze) {
          rotFreeze = {
            anchor: camAnchor || computeAnchor(world.getRenderAngle(), playerCenter()),
            P: playerCenter()
          };
        }
      } else {
        rotFreeze = null;
        camAnchor = computeAnchor(world.getRenderAngle(), playerCenter());
      }
    }
    gearAngle += 0.08;
    render();
  }

  // 输入
  function onKeyDown(e) {
    var k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].indexOf(k) >= 0) e.preventDefault();
    // 关卡跳转：'[', ']' 上一关/下一关，数字键 1-9/0 直达对应关
    if (modal.classList.contains('open')) {
      if (k === '[' && levelIndex > 0) { loadLevel(levelIndex - 1); return; }
      if (k === ']' && levelIndex < E.LEVELS.length - 1) { loadLevel(levelIndex + 1); return; }
      if (k >= '0' && k <= '9') {
        var li = (k === '0') ? 9 : parseInt(k, 10) - 1;
        if (li < E.LEVELS.length) { loadLevel(li); return; }
      }
    }
    if (k === 'q' || k === 'e') {
      if (!keys[k] && world && world.status === 'playing') {
        if (!world.grounded) {
          showToast('需落到地面后才能旋转'); // 新规则：掉到地上(落定)之前不能旋转
        } else {
          world.rotate(k === 'q' ? 1 : -1); // Q 顺时针, E 逆时针
        }
      }
      keys[k] = true; return;
    }
    keys[k] = true;
  }
  function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }

  playBtns.forEach(function (b) { if (b) b.addEventListener('click', openModal); });
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  startBtn.addEventListener('click', function () {
    if (mode === 'won') {
      if (levelIndex >= E.LEVELS.length - 1) loadLevel(0);
      else loadLevel(levelIndex + 1);
    } else if (mode === 'dead') {
      loadLevel(levelIndex);
    } else {
      // ready -> 开始
      if (world) { hideOverlay(); mode = 'playing'; running = true; }
    }
  });

  // 测试钩子(无害)：暴露 world / 关卡控制供自动化验证使用
  window.__game = {
    getWorld: function () { return world; },
    getLevel: function () { return levelIndex; },
    getMode: function () { return mode; },
    loadLevel: function (i) { loadLevel(i); }
  };
})();
