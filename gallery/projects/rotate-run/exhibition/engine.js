/*
 * 旋界 · 旋转跑酷 — 纯逻辑引擎
 * 不依赖 DOM，可在浏览器(window.GameEngine) 与 Node(module.exports) 复用。
 *
 * 核心机制：
 *  - 重力恒为"屏幕向下"；旋转的是整个世界(关卡 + 角色位置)，重力方向随之改变。
 *  - 物理在"关卡本地坐标系"中计算，重力方向随 rotation 变化；碰撞永远轴对齐。
 *  - 渲染时把本地坐标按 rotation 顺时针旋转到屏幕，角色保持直立。
 */
(function (global) {
  'use strict';

  var CELL = 40;
  var PLAYER_W = CELL / 4;   // ¼ 格宽
  var PLAYER_H = CELL / 2;   // ½ 格高
  var GRAVITY = 0.5;
  var JUMP_V = 11;
  var MOVE_SPEED = 3.4;
  var MAX_FALL = 12;
  var ROT_FRAMES = 14;       // 旋转动画帧数(约 0.23s@60fps)，期间锁输入、冻结物理

  // 顺时针旋转向量(屏幕 y 向下): (x*cos + y*sin, -x*sin + y*cos)
  // 旋转始终 90° 步进，分量必为 -1/0/1；用 round 消除浮点误差
  // (否则 g.y 会出现 6e-17 之类的值，导致 step() 把重力轴判断错误，旋转单步后角色悬空不动)
  function rotCw(v, deg) {
    var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return {
      x: Math.round(v.x * c + v.y * s),
      y: Math.round(-v.x * s + v.y * c)
    };
  }
  // 本地坐标系下的重力方向(单位向量)。gravity = rotCw((0,1), -rotation)
  function gravityVec(rotation) { return rotCw({ x: 0, y: 1 }, -rotation); }
  // 屏幕"右"在本地坐标系中的方向
  function rightVec(rotation) { return rotCw({ x: 1, y: 0 }, -rotation); }

  // 教学 6 关：'#' 墙  '.'/' ' 空  '^' 地刺  'O' 齿轮  'S' 出生  'G' 终点
  var LEVELS = [
    {
      name: '第 1 关 · 移动',
      hint: '按 ← → 走到终点旗帜',
      grid: [
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '#..............#',
        '#..............#',
        '#..............#',
        '#S............G#',
        '################',
        '################'
      ]
    },
    {
      name: '第 2 关 · 跳跃',
      hint: '按 ↑ 跳过挡路的方块',
      grid: [
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '#..............#',
        '#..............#',
        '#..............#',
        '#S.....#.....G.#',
        '################',
        '################'
      ]
    },
    {
      name: '第 3 关 · 地刺',
      hint: '地刺会致命，跳过去',
      grid: [
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '#..............#',
        '#..............#',
        '#..............#',
        '#S....^^.....G.#',
        '################',
        '################'
      ]
    },
    {
      name: '第 4 关 · 齿轮',
      hint: '旋转的齿轮碰到就死，跳过去',
      grid: [
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '#..............#',
        '#..............#',
        '#..............#',
        '#S.....O.....G.#',
        '################',
        '################'
      ]
    },
    {
      name: '第 5 关 · 旋转',
      hint: '走到台子上，按 Q 旋转世界——你原地不动，重力会把你甩过缺口送到右侧终点',
      grid: [
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#.S............#',
        '####^^^^^^..G..#',
        '################',
        '################'
      ]
    },
    {
      name: '第 6 关 · 刺墙迷室',
      hint: '封闭刺室：左右墙都贴着地刺。向右跑酷跳过地刺坑，到最右墙按 E 翻重力向右，贴右墙向上跑、跳过墙上的地刺，到右上角终点旗帜。墙上的刺碰到即死，转错方向也死。',
      grid: [
        '###############',
        '#...........G##',
        '#............##',
        '#............##',
        '#^..........^##',
        '#............##',
        '#............##',
        '#............##',
        '#^..........^##',
        '#............##',
        '#............##',
        '#............##',
        '#............##',
        '#S...^^......##',
        '###############'
      ]
    },
    {
      name: '第 7 关 · 双坑刺墙',
      hint: '双坑版：连续两道地刺坑要精准起跳；右墙两根地刺，贴墙爬时务必跳过去。左墙的刺是误转即死的警告。',
      grid: [
        '###############',
        '#...........G##',
        '#............##',
        '#............##',
        '#^..........^##',
        '#............##',
        '#............##',
        '#............##',
        '#^..........^##',
        '#............##',
        '#............##',
        '#............##',
        '#............##',
        '#S..^^...^^..##',
        '###############'
      ]
    },
    {
      name: '第 8 关 · 三坑刺墙',
      hint: '三坑版：三道地刺坑 + 右墙双刺，跑酷与旋转的双重考验。每一面墙都有东西，乱转必死。',
      grid: [
        '###############',
        '#...........G##',
        '#............##',
        '#............##',
        '#^..........^##',
        '#............##',
        '#............##',
        '#............##',
        '#^..........^##',
        '#............##',
        '#............##',
        '#............##',
        '#............##',
        '#S.^^...^^...##',
        '###############'
      ]
    }
  ];

  function parseLevel(def) {
    var grid = def.grid;
    var rows = grid.length, cols = grid[0].length;
    var spikes = [], gears = [], start = null, goal = null;
    function chAt(rr, cc) { if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) return '#'; return grid[rr][cc]; }
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var ch = grid[r][c];
        if (ch === '^') {
          // 朝向：根据相邻台子('#')判定——地刺必须长在台子上
          var dir = 'up';
          if (chAt(r + 1, c) === '#') dir = 'up';            // 台子在下方 -> 尖朝上
          else if (chAt(r - 1, c) === '#') dir = 'down';     // 台子在上方 -> 尖朝下
          else if (chAt(r, c - 1) === '#') dir = 'right';    // 台子在左方 -> 尖朝右
          else if (chAt(r, c + 1) === '#') dir = 'left';     // 台子在右方 -> 尖朝左
          spikes.push({ c: c, r: r, dir: dir });
        }
        else if (ch === 'O') gears.push({ c: c, r: r });
        else if (ch === 'S') start = { c: c, r: r };
        else if (ch === 'G') goal = { c: c, r: r };
      }
    }
    return { rows: rows, cols: cols, spikes: spikes, gears: gears, start: start, goal: goal };
  }

  function createWorld(levelIndex) {
    var def = LEVELS[levelIndex];
    var meta = parseLevel(def);
    var world = {
      levelIndex: levelIndex,
      name: def.name,
      hint: def.hint,
      grid: def.grid,
      cols: meta.cols,
      rows: meta.rows,
      spikes: meta.spikes,
      gears: meta.gears,
      start: meta.start,
      goal: meta.goal,
      rotation: 0,        // 结算后的世界旋转角(0/90/180/270)
      // 旋转动画：active 期间物理冻结、输入锁死、主角相对场景不动
      rotAnim: { active: false, from: 0, to: 0, t: 0 },
      player: { x: 0, y: 0, vx: 0, vy: 0 },
      grounded: false,
      rotBlocked: false,   // 本帧是否因"未落地"被拒绝旋转(供 UI 提示)
      status: 'playing', // playing | dead | won
      deaths: 0,
      elapsed: 0,
    };

    function isSolid(r, c) {
      if (r < 0 || c < 0 || r >= world.rows || c >= world.cols) return true;
      return world.grid[r][c] === '#';
    }
    function solidsOverlap(x, y, w, h) {
      var c0 = Math.floor(x / CELL), c1 = Math.floor((x + w - 0.001) / CELL);
      var r0 = Math.floor(y / CELL), r1 = Math.floor((y + h - 0.001) / CELL);
      var out = [];
      for (var r = r0; r <= r1; r++)
        for (var c = c0; c <= c1; c++)
          if (isSolid(r, c)) out.push({ c: c, r: r });
      return out;
    }
    function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }
    function circleRectOverlap(cx, cy, cr, rx, ry, rw, rh) {
      var nx = Math.max(rx, Math.min(cx, rx + rw));
      var ny = Math.max(ry, Math.min(cy, ry + rh));
      var dx = cx - nx, dy = cy - ny;
      return dx * dx + dy * dy < cr * cr;
    }

    function reset() {
      var s = world.start;
      world.player.x = s.c * CELL + (CELL - PLAYER_W) / 2;
      world.player.y = s.r * CELL + (CELL - PLAYER_H); // 站立在格子底部
      world.player.vx = 0; world.player.vy = 0;
      world.rotation = 0;
      world.rotAnim.active = false; world.rotAnim.from = 0; world.rotAnim.to = 0; world.rotAnim.t = 0;
      world.grounded = false;
      world.status = 'playing';
      world.elapsed = 0;
    }

    // 场景绕主角旋转：主角在场景里的格子(本地坐标)与屏幕位置都不动，只改重力方向。
    // dir: +1 顺时针(CW), -1 逆时针(CCW)。旋转是一段动画，期间锁输入、冻结物理。
    function rotate(dir) {
      if (world.status !== 'playing') return;
      if (world.rotAnim.active) return;          // 转到一半不能反向/再转
      if (!world.grounded) { world.rotBlocked = true; return; } // 掉到地上(落定)之前不能旋转
      world.rotBlocked = false;
      world.rotAnim.active = true;
      world.rotAnim.from = world.rotation;       // 未归一化，供渲染取最短路径插值
      world.rotAnim.to = world.rotation + dir * 90;
      world.rotAnim.t = 0;
      world.player.vx = 0; world.player.vy = 0;  // 旋转期间主角静止
    }

    // 渲染用的当前角度(度)：动画期间在 from->to 之间缓动插值，否则为结算角
    function getRenderAngle() {
      var ra = world.rotAnim;
      if (!ra.active) return world.rotation;
      var p = ra.t / ROT_FRAMES; if (p > 1) p = 1;
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
      return ra.from + (ra.to - ra.from) * e;
    }

    function resolveX(dx) {
      world.player.x += dx;
      var cells = solidsOverlap(world.player.x, world.player.y, PLAYER_W, PLAYER_H);
      if (cells.length) {
        if (dx > 0) {
          var left = Math.min.apply(null, cells.map(function (cl) { return cl.c * CELL; }));
          world.player.x = left - PLAYER_W;
        } else if (dx < 0) {
          var right = Math.max.apply(null, cells.map(function (cl) { return (cl.c + 1) * CELL; }));
          world.player.x = right;
        }
        world.player.vx = 0;
      }
    }
    function resolveY(dy) {
      world.player.y += dy;
      var cells = solidsOverlap(world.player.x, world.player.y, PLAYER_W, PLAYER_H);
      if (cells.length) {
        if (dy > 0) {
          var top = Math.min.apply(null, cells.map(function (cl) { return cl.r * CELL; }));
          world.player.y = top - PLAYER_H;
        } else if (dy < 0) {
          var bot = Math.max.apply(null, cells.map(function (cl) { return (cl.r + 1) * CELL; }));
          world.player.y = bot;
        }
        world.player.vy = 0;
      }
    }

    function checkLethal() {
      var p = world.player;
      // 地刺：致死区在"尖尖所朝"的那 ¼ 格(本地坐标)。台子在哪面就朝相反方向。
      for (var i = 0; i < world.spikes.length; i++) {
        var sp = world.spikes[i];
        var sx = sp.c * CELL, sy = sp.r * CELL, sw = CELL, sh = CELL / 4;
        if (sp.dir === 'down') { sy = sp.r * CELL; sw = CELL; sh = CELL / 4; }            // 台子上 -> 尖朝下 -> 顶部 ¼
        else if (sp.dir === 'left') { sx = sp.c * CELL + CELL * 3 / 4; sy = sp.r * CELL; sw = CELL / 4; sh = CELL; } // 台子右 -> 尖朝左 -> 右侧 ¼
        else if (sp.dir === 'right') { sx = sp.c * CELL; sy = sp.r * CELL; sw = CELL / 4; sh = CELL; }               // 台子左 -> 尖朝右 -> 左侧 ¼
        else { sy = sp.r * CELL + CELL * 3 / 4; sw = CELL; sh = CELL / 4; }                                       // 台子下 -> 尖朝上 -> 底部 ¼
        if (rectsOverlap(p.x, p.y, PLAYER_W, PLAYER_H, sx, sy, sw, sh)) return true;
      }
      // 齿轮：圆心在格中心，半径 ¼ 格
      for (var j = 0; j < world.gears.length; j++) {
        var gp = world.gears[j];
        var gx = gp.c * CELL + CELL / 2, gy = gp.r * CELL + CELL / 2, gr = CELL / 4;
        if (circleRectOverlap(gx, gy, gr, p.x, p.y, PLAYER_W, PLAYER_H)) return true;
      }
      return false;
    }
    function checkGoal() {
      if (!world.goal) return false;
      var p = world.player;
      var gx = world.goal.c * CELL, gy = world.goal.r * CELL;
      return rectsOverlap(p.x, p.y, PLAYER_W, PLAYER_H, gx, gy, CELL, CELL);
    }

    // input: {left,right,up} 布尔；旋转请用 world.rotate()
    function step(input) {
      if (world.status !== 'playing') return;
      input = input || {};
      world.elapsed++;
      world.rotBlocked = false; // 每帧重置，仅当本帧尝试旋转但被"未落地"拒绝时为 true

      // 旋转动画进行中：冻结物理、忽略输入，主角相对场景与屏幕都不动
      if (world.rotAnim.active) {
        world.player.vx = 0; world.player.vy = 0;
        world.rotAnim.t++;
        if (world.rotAnim.t >= ROT_FRAMES) {
          world.rotation = ((world.rotAnim.to % 360) + 360) % 360;
          world.rotAnim.active = false;
          world.grounded = false; // 结算后从静止开始，重力把主角垂直吸到下方
        }
        return;
      }

      var g = gravityVec(world.rotation);
      var right = rightVec(world.rotation);
      var gAxis = (g.y !== 0) ? 'y' : 'x';
      var tAxis = (gAxis === 'y') ? 'x' : 'y';
      var tInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);

      // 切向移动(直接设定速度，无惯性，利于精准解谜)
      if (tAxis === 'x') world.player.vx = right.x * tInput * MOVE_SPEED;
      else world.player.vy = right.y * tInput * MOVE_SPEED;

      // 重力方向加速
      if (gAxis === 'x') {
        world.player.vx += g.x * GRAVITY;
        if (world.player.vx > MAX_FALL) world.player.vx = MAX_FALL;
        if (world.player.vx < -MAX_FALL) world.player.vx = -MAX_FALL;
      } else {
        world.player.vy += g.y * GRAVITY;
        if (world.player.vy > MAX_FALL) world.player.vy = MAX_FALL;
        if (world.player.vy < -MAX_FALL) world.player.vy = -MAX_FALL;
      }

      // 跳跃(逆重力方向)，仅着地时
      if (input.up && world.grounded) {
        if (gAxis === 'x') world.player.vx = -g.x * JUMP_V;
        else world.player.vy = -g.y * JUMP_V;
        world.grounded = false;
      }

      // 先移动重力轴再移动切向轴，最后判定着地
      if (gAxis === 'x') { resolveX(world.player.vx); resolveY(world.player.vy); }
      else { resolveY(world.player.vy); resolveX(world.player.vx); }

      // 着地判定：沿重力方向探 1px
      var pad = 1;
      world.grounded = solidsOverlap(
        world.player.x + g.x * pad, world.player.y + g.y * pad, PLAYER_W, PLAYER_H
      ).length > 0;

      if (checkLethal()) { world.status = 'dead'; world.deaths++; return; }
      if (checkGoal()) { world.status = 'won'; return; }
    }

    reset();
    world.reset = reset;
    world.rotate = rotate;
    world.step = step;
    world.getRenderAngle = getRenderAngle;
    world.isSolid = isSolid;
    return world;
  }

  var Engine = {
    CELL: CELL,
    PLAYER_W: PLAYER_W,
    PLAYER_H: PLAYER_H,
    GRAVITY: GRAVITY,
    JUMP_V: JUMP_V,
    MOVE_SPEED: MOVE_SPEED,
    ROT_FRAMES: ROT_FRAMES,
    LEVELS: LEVELS,
    rotCw: rotCw,
    gravityVec: gravityVec,
    rightVec: rightVec,
    createWorld: createWorld
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else global.GameEngine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
