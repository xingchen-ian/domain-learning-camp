// Node 验证脚本：用脚本化操作把每关"玩"一遍，确认可解。
var Engine = require('./engine.js');

function playerCol(w) { return (w.player.x + Engine.PLAYER_W / 2) / Engine.CELL; }
function playerRow(w) { return (w.player.y + Engine.PLAYER_H / 2) / Engine.CELL; }

// 每关控制器：返回 {input, rotate}（rotate: +1/-1 当帧执行一次，可选）
var controllers = [
  // L1 移动
  function (w, f) { return { input: { left: false, right: true, up: false } }; },
  // L2 跳跃过方块(列8)
  function (w, f) {
    var c = playerCol(w);
    var up = w.grounded && c >= 6.8 && c < 8.2;
    return { input: { left: false, right: true, up: up } };
  },
  // L3 跳地刺(列7-8)
  function (w, f) {
    var c = playerCol(w);
    var up = w.grounded && c >= 6.2 && c < 7.8;
    return { input: { left: false, right: true, up: up } };
  },
  // L4 跳齿轮(列8)
  function (w, f) {
    var c = playerCol(w);
    var up = w.grounded && c >= 6.5 && c < 8.0;
    return { input: { left: false, right: true, up: up } };
  },
  // L5 旋转一次(E，逆时针)——主角相对场景不动，重力把它甩过缺口到右侧终点
  function (w, f) {
    if (f === 20) return { input: {}, rotate: -1 }; // 落定后按 E 旋转世界
    return { input: {} };                            // 之后放手，重力接管
  },
  // L6 跳过地刺 -> 走到坑边 -> 按 E 旋转甩过缺口到终点
  function (w, f, ctx) {
    if (ctx.rotated) return { input: {} };            // 旋转后放手，重力甩过缺口
    var c = playerCol(w);
    if (w.grounded && c >= 6.2) {                      // 到坑边、落地后旋转一次
      ctx.rotated = true;
      return { input: {}, rotate: -1 };
    }
    var up = (!ctx.jumped && w.grounded && c >= 2.6 && c < 4.2);
    if (up) ctx.jumped = true;                         // 跳过地刺(col4-5)
    return { input: { left: false, right: true, up: up } };
  }
];

var allPass = true;
// 仅校验教学 6 关(7+ 为旋转难关，由 verify-all.js 用 BFS 验证)
for (var i = 0; i < controllers.length; i++) {
  var w = Engine.createWorld(i);
  var ctrl = controllers[i];
  var ctx = {};
  var maxF = 2500, won = false, dead = false;
  for (var f = 0; f < maxF; f++) {
    var act = ctrl(w, f, ctx);
    if (act.rotate) w.rotate(act.rotate);
    w.step(act.input || {});
    if (w.status === 'won') { won = true; break; }
    if (w.status === 'dead') { dead = true; break; }
  }
  var tag = won ? 'PASS' : (dead ? 'FAIL(dead)' : 'FAIL(timeout)');
  if (!won) allPass = false;
  console.log('L' + (i + 1) + ' ' + Engine.LEVELS[i].name + ' => ' + tag +
    '  帧=' + (won || dead ? f : maxF) + '  终态rotation=' + w.rotation + '  列=' + playerCol(w).toFixed(1) + ' 行=' + playerRow(w).toFixed(1));
}
console.log(allPass ? '\n全部关卡可解 ✅' : '\n存在不可解关卡 ❌');
process.exit(allPass ? 0 : 1);
