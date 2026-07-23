// 用 DOM 桩在 Node 里加载 engine.js + game.js，模拟键盘事件跑通 L1 / L5 / L6，验证 UI 层无运行时错误。
var fs = require('fs');
var vm = require('vm');
var Engine = require('./engine.js');

function makeEl(id) {
  return {
    id: id, _l: {}, classList: {
      _s: {}, add: function (c) { this._s[c] = 1; }, remove: function (c) { delete this._s[c]; },
      contains: function (c) { return !!this._s[c]; }
    },
    textContent: '', style: {}, setAttribute: function () {}, getAttribute: function () { return null; },
    addEventListener: function (t, fn) { (this._l[t] = this._l[t] || []).push(fn); },
    getContext: function () { return ctx; },
    width: 0, height: 0,
    fire: function (t, ev) { (this._l[t] || []).forEach(function (f) { f(ev || {}); }); }
  };
}
var ctx = new Proxy({}, { get: function (o, k) { return function () {}; }, set: function () { return true; } });
var els = {};
['game-modal', 'game-canvas', 'play-btn', 'play-btn-top', 'game-close', 'game-start',
  'game-overlay', 'game-overlay-text', 'game-overlay-sub', 'game-level', 'game-deaths']
  .forEach(function (id) { els[id] = makeEl(id); });

var docListeners = {};
var sandbox = {
  window: {},
  document: {
    getElementById: function (id) { return els[id]; },
    addEventListener: function (t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); }
  },
  requestAnimationFrame: function (cb) { sandbox.__raf = cb; return 1; },
  cancelAnimationFrame: function () { sandbox.__raf = null; },
  Math: Math, console: console
};
sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
sandbox.window.cancelAnimationFrame = sandbox.cancelAnimationFrame;
sandbox.window.GameEngine = Engine;
vm.createContext(sandbox);

var src = fs.readFileSync('./game.js', 'utf8');
vm.runInContext(src, sandbox, { filename: 'game.js' });

function key(type, k) {
  (docListeners[type] || []).forEach(function (f) { f({ key: k, preventDefault: function () {} }); });
}
function frames(n) { for (var i = 0; i < n; i++) { if (sandbox.__raf) sandbox.__raf(); } }
function clickPlay() { els['play-btn'].fire('click'); }
function clickStart() { els['game-start'].fire('click'); }
function overlayText() { return els['game-overlay-text'].textContent; }
function won() { var t = overlayText(); return (t === '过关！' || t === '全部通关！'); }

function playerCol() { var w = sandbox.window.__game.getWorld(); return (w.player.x + Engine.PLAYER_W / 2) / Engine.CELL; }
function playerRow() { var w = sandbox.window.__game.getWorld(); return (w.player.y + Engine.PLAYER_H / 2) / Engine.CELL; }

// 通用 bot：一直右键，落地且前方有障碍/地刺/齿轮时跳
function simpleBot() {
  var w = sandbox.window.__game.getWorld();
  var c = playerCol(), r = playerRow();
  var up = false;
  if (w.grounded) {
    // 前方一格(屏幕右)是否有实心/地刺/齿轮
    var g = w.grid;
    var aheadC = Math.round(c + 0.6), aheadR = Math.round(r + 0.4);
    var ch = (g[aheadR] && g[aheadR][aheadC]) || '.';
    if (ch === '#' || ch === '^' || ch === 'O') up = true;
  }
  key('keydown', 'ArrowRight');
  if (up) { key('keydown', 'ArrowUp'); } else { key('keyup', 'ArrowUp'); }
}
function runCurrent(bot) {
  for (var f = 0; f < 600; f++) {
    if (sandbox.window.__game.getMode() !== 'playing') break;
    bot();
    frames(1);
  }
}

var ok = true;

// L1：一直右键+自动跳
ok = (function () {
  clickPlay();
  runCurrent(simpleBot);
  var r = won();
  console.log('UI L1 => ' + (r ? 'PASS (' + overlayText() + ')' : 'FAIL ("' + overlayText() + '")'));
  els['game-close'].fire('click');
  return r;
})() && ok;

// L5：直接载入第5关，落定后按 E 旋转一次(逆时针)——主角相对场景不动，重力把它甩过缺口到右侧终点
ok = (function () {
  clickPlay();
  sandbox.window.__game.loadLevel(4);
  var rotated = false;
  for (var f = 0; f < 400; f++) {
    if (sandbox.window.__game.getMode() !== 'playing') break;
    var w = sandbox.window.__game.getWorld();
    if (!rotated && f >= 20 && w.grounded) {   // 落定后按 E(逆时针)
      key('keydown', 'e'); key('keyup', 'e');
      rotated = true;
    }
    frames(1);
  }
  var r = won();
  console.log('UI L5 => ' + (r ? 'PASS (' + overlayText() + ')' : 'FAIL ("' + overlayText() + '")'));
  els['game-close'].fire('click');
  return r;
})() && ok;

// L6：直接载入第6关，右键跳过地刺 -> 走到坑边落地 -> 按 E 旋转甩过缺口到终点
ok = (function () {
  clickPlay();
  sandbox.window.__game.loadLevel(5);
  var jumped = false, rotated = false;
  for (var f = 0; f < 800; f++) {
    if (sandbox.window.__game.getMode() !== 'playing') break;
    var w = sandbox.window.__game.getWorld();
    var c = playerCol();
    if (rotated) {                                  // 旋转后放手，重力甩过缺口
      key('keyup', 'ArrowRight'); key('keyup', 'ArrowUp');
      frames(1); continue;
    }
    if (w.grounded && c >= 6.2) {                    // 到坑边、落地后旋转一次(E)
      key('keyup', 'ArrowRight'); key('keyup', 'ArrowUp');
      key('keydown', 'e'); key('keyup', 'e');
      rotated = true; frames(1); continue;
    }
    var up = (!jumped && w.grounded && c >= 2.6 && c < 4.2); // 跳过地刺(col4-5)
    if (up) jumped = true;
    key('keydown', 'ArrowRight');
    if (up) { key('keydown', 'ArrowUp'); } else { key('keyup', 'ArrowUp'); }
    frames(1);
  }
  var r = won();
  console.log('UI L6 => ' + (r ? 'PASS (' + overlayText() + ')' : 'FAIL ("' + overlayText() + '")'));
  els['game-close'].fire('click');
  return r;
})() && ok;

console.log(ok ? '\nUI 集成测试通过 ✅' : '\nUI 集成测试失败 ❌');
process.exit(ok ? 0 : 1);

