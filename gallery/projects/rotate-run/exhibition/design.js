/* 关卡设计 + 验证工具：暴力 BFS 求解器，确认每关"可解"且"平凡策略失败"。
 * 用法：node design.js
 */
var Engine = require('./engine.js');
var CELL = Engine.CELL, PW = Engine.PLAYER_W, PH = Engine.PLAYER_H;
function pcol(w){return (w.player.x+PW/2)/CELL;}
function prow(w){return (w.player.y+PH/2)/CELL;}
function keyOf(w){
  return [Math.round(w.player.x),Math.round(w.player.y),w.rotation,(w.grounded?1:0)].join(',');
}
// 给定已落定的 world，施加一次旋转(dir) 并让其动画+落定，返回新 world(深拷贝字段)
  function applyRotate(w, dir){
    var n = clone(w);
    // 先确保当前已落定(旋转只能从 grounded 触发)；若已在空中则先落地
    var g=0; while(n.status==='playing' && !n.grounded && g<200){ n.step({}); g++; }
    if(n.status!=='playing') return n;
    if(!n.grounded) return n;            // 仍悬空则不旋转
    n.rotate(dir);
    g=0; while(n.rotAnim.active && g<60){ n.step({}); g++; }
    // 落定后让重力把主角吸到新地面(最多 300 帧)
    g=0; while(n.status==='playing' && !n.grounded && g<300){ n.step({}); g++; }
    return n;
  }
function clone(w){
  var n = Engine.createWorld(w.levelIndex);
  n.player.x=w.player.x; n.player.y=w.player.y; n.player.vx=w.player.vx; n.player.vy=w.player.vy;
  n.rotation=w.rotation; n.grounded=w.grounded; n.status=w.status;
  n.rotAnim={active:false,from:w.rotation,to:w.rotation,t:0};
  return n;
}
function isWin(w){return w.status==='won';}
function isDead(w){return w.status==='dead';}

// BFS over (x,y,rotation)。动作：移动(左/右直到状态稳定) 或 旋转(CW/CCW，需 grounded)。
function solve(levelIndex, maxStates){
  maxStates = maxStates||20000;
  var start = Engine.createWorld(levelIndex);
  // 落定出生点(旋转只能从 grounded 触发)
  var sg=0; while(start.status==='playing' && !start.grounded && sg<200){ start.step({}); sg++; }
  if(isWin(start)) return {ok:true,len:0,rots:0,path:[]};
  var q=[start]; var seen={}; seen[keyOf(start)]=true;
  var prev={}; var stepInfo={};
  var cnt=0, rotationsSeen={};
  while(q.length){
    if(cnt++>maxStates) return {ok:false,reason:'state limit',states:cnt,maxRot:rotationsSeen};
    var cur=q.shift();
    var baseLen = stepInfo[keyOf(cur)] ? stepInfo[keyOf(cur)].len : 0;
    // 动作1：移动(左右分别走到落定)
    var dirs=[{d:'L',left:true,right:false},{d:'R',left:false,right:true}];
    for(var mi=0; mi<dirs.length; mi++){
      var n=clone(cur); var g=0;
      while(n.status==='playing' && g<400){
        n.step({left:dirs[mi].left,right:dirs[mi].right,up:false}); g++;
        if(n.grounded) break;
        if(g>3 && keyOf(n)===keyOf(cur)) break;
      }
      if(isWin(n)) return {ok:true,len:baseLen+1,path:reconstruct(prev,keyOf(cur))};
      if(!isDead(n) && !seen[keyOf(n)]){ seen[keyOf(n)]=true; prev[keyOf(n)]=keyOf(cur); stepInfo[keyOf(n)]={act:'move'+dirs[mi].d,len:baseLen+1}; q.push(n); }
    }
    // 动作2/3：旋转(需 grounded 才能触发)
    if(cur.grounded && cur.status==='playing'){
      var rdirs=[-1,1];
      for(var ri=0; ri<rdirs.length; ri++){
        var n2=applyRotate(cur,rdirs[ri]);
        if(global.__DBG && cnt<3) console.log('  from',keyOf(cur),'rot',rdirs[ri],'->',keyOf(n2),'win',isWin(n2),'dead',isDead(n2));
        if(isWin(n2)) return {ok:true,len:baseLen+1,rots:((stepInfo[keyOf(cur)]?stepInfo[keyOf(cur)].rots:0)+1),path:reconstruct(prev,keyOf(cur))};
        if(!isDead(n2) && !seen[keyOf(n2)]){ seen[keyOf(n2)]=true; prev[keyOf(n2)]=keyOf(cur); stepInfo[keyOf(n2)]={act:(rdirs[ri]<0?'rotCCW':'rotCW'),len:baseLen+1,rots:(stepInfo[keyOf(cur)]?stepInfo[keyOf(cur)].rots:0)+1}; rotationsSeen++; q.push(n2); }
      }
    }
  }
  return {ok:false,reason:'no solution (BFS exhausted)',states:cnt,maxRot:rotationsSeen};
}
function reconstruct(prev,end){
  var path=[]; var k=end;
  while(prev[k]!==undefined){ path.unshift(prev[k]); k=prev[k]; }
  return path;
}
// 平凡策略：只移动不旋转，看能否到终点(应能失败)
function moveOnly(levelIndex){
  var w;
  try { w=Engine.createWorld(levelIndex); } catch(e){ return {win:false,dead:false,col:'?',row:'?',rot:'?',err:String(e)}; }
  if(!w.goal) return {win:false,dead:false,col:'?',row:'?',rot:'?',err:'no goal'};
  for(var f=0;f<3000 && w.status==='playing';f++){
    var g=w.goal; var pc=pcol(w),pr=prow(w);
    var dx=(g.c+0.5)-pc, dy=(g.r+0.5)-pr;
    var inp={left:false,right:false,up:false};
    // 朝目标走：当重力向下(rot0/180)走 x，否则走 y
    if((w.rotation%180)===0){ if(dx>0.3) inp.right=true; else if(dx<-0.3) inp.left=true; }
    else { if(dy>0.3) inp.right=true; else if(dy<-0.3) inp.left=true; }
    w.step(inp);
  }
  return {win:isWin(w),dead:isDead(w),col:pcol(w).toFixed(1),row:prow(w).toFixed(1),rot:w.rotation};
}

module.exports = { Engine:Engine, solve:solve, moveOnly:moveOnly, pcol:pcol, prow:prow };

// 直接运行时：对当前 LEVELS 末尾(待设计关)做快速检查
if(require.main===module){
  // 占位：具体关卡在 build-levels.js 里定义后调用
}
