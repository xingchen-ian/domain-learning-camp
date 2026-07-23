/**
 * Keep Going - Trail Run Game
 * Top-down vertical scroller
 * 3 Levels: Short / Medium / Long
 * W = run forward (hold) · Up/Down = set speed · Left/Right = steer & choose fork
 */

// ======================== Level Configs ========================
var LEVELS = [
  { id:1, name:'Valley Loop',    desc:'A short trail through the valley',           segments:12, finish:500,  timeLimit:240, icon:'\u26F0\uFE0F', color:'#44BB44' },
  { id:2, name:'Ridge Run',      desc:'A mid-distance ridge traverse',              segments:18, finish:750,  timeLimit:300, icon:'\uD83C\uDF04', color:'#FFAA00' },
  { id:3, name:'Summit Push',    desc:'The full mountain challenge',                segments:24, finish:1000, timeLimit:360, icon:'\uD83C\uDFD4\uFE0F', color:'#E94560' },
];

// ======================== Base Config ========================
var CFG = {
  INIT_SUGAR:80, INIT_ELECTROLYTE:80, INIT_WATER:80, INIT_HEALTH:100,
  MAX_SALT:5, MAX_GEL:5, MAX_WATER_BOTTLE:6, MAX_PASTE:3,
  SALT_RESTORE:25, GEL_RESTORE:25, WATER_RESTORE:20, PASTE_HEAL:15,
  SUGAR_DRAIN:0.016, ELEC_DRAIN:0.012, WATER_DRAIN:0.016,
  MIN_SPD:1, MAX_SPD_BASE:8,
  LOW_ENERGY_DRAIN:0.003, LOW_WATER_DRAIN:0.002,
  MAX_SUGAR:100, MAX_ELEC:100, MAX_WATER:100, MAX_HP:100,
  COOLDOWN:25, TUMBLE_THRESHOLD:7, TUMBLE_DMG:12,
  // These will be set per-level:
  SEGMENTS:12, FINISH:500, GPS_TIME:480, TIME_LIMIT:240,
  ROAD_W:180,
  PLAYER_Y:430,
  STEER_SPEED:0.04,
  STEER_FRICTION:0.92,
  FORK_PAUSE_POS:0.42,
  DOG_SPAWN_CHANCE:0.0004, DOG_SPEED:1.8, DOG_DMG:10, DOG_ESCAPE_SPD:5.5,
  SUPPLY_TIME:180,
};

var ROAD = {
  SOIL:   {color:'#C4956A', dark:'#A07850', edge:'#8B6A40', name:'Dirt'},
  STONE:  {color:'#C0C0C0', dark:'#A0A0A0', edge:'#808080', name:'Stone'},
  CONCRETE:{color:'#DBDBDB', dark:'#C0C0C0', edge:'#A0A0A0', name:'Concrete'},
};

var SLOPE = {
  UPHILL:  {name:'Uphill', speedMul:0.6, drainMul:1.6, tint:'#FFE8D6', angle:22},
  FLAT:    {name:'Flat', speedMul:1.0, drainMul:1.0, tint:'#FFFFFF', angle:0},
  DOWNHILL:{name:'Downhill', speedMul:1.4, drainMul:1.3, tint:'#E8F0FF', angle:-15},
};

// ======================== Utils ========================
function lerpC(c1,c2,t){
  var r1=parseInt(c1.slice(1,3),16),g1=parseInt(c1.slice(3,5),16),b1=parseInt(c1.slice(5,7),16);
  var r2=parseInt(c2.slice(1,3),16),g2=parseInt(c2.slice(3,5),16),b2=parseInt(c2.slice(5,7),16);
  var r=Math.round(r1+(r2-r1)*t),g=Math.round(g1+(g2-g1)*t),b=Math.round(b1+(b2-b1)*t);
  return '#'+[r,g,b].map(function(v){var s=v.toString(16);return s.length<2?'0'+s:s;}).join('');
}
function lightenC(hex){
  var r=Math.min(255,parseInt(hex.slice(1,3),16)+60);
  var g=Math.min(255,parseInt(hex.slice(3,5),16)+60);
  var b=Math.min(255,parseInt(hex.slice(5,7),16)+60);
  return '#'+[r,g,b].map(function(v){var s=v.toString(16);return s.length<2?'0'+s:s;}).join('');
}

// ======================== Track Gen ========================
function genTrack(segments){
  var segs=[], slopes=['UPHILL','FLAT','DOWNHILL'], roads=['SOIL','STONE','CONCRETE'];
  for(var i=0;i<segments;i++){
    segs.push({
      i:i, slope:slopes[Math.floor(Math.random()*3)], road:roads[Math.floor(Math.random()*3)],
      len:30+Math.floor(Math.random()*25),
      fork:i>2&&i<segments-2&&Math.random()<0.35,
      supply:Math.random()<0.2&&i>1,
      forkDir:Math.random()<0.5?'L':'R',
      cliff:i>4&&i<segments-1&&Math.random()<0.12,
    });
  }
  segs[0].slope='FLAT';segs[0].fork=false;segs[0].supply=false;segs[0].cliff=false;
  var lst=segments-1;
  segs[lst].slope='UPHILL';segs[lst].fork=false;segs[lst].cliff=false;segs[lst].supply=false;
  var sc=0;for(var j=0;j<segs.length;j++)if(segs[j].supply)sc++;
  while(sc<2){var idx=2+Math.floor(Math.random()*(segments-4));if(!segs[idx].supply){segs[idx].supply=true;sc++;}}
  return segs;
}

// ======================== Game ========================
function Game(cv){
  this.cv=cv;this.ctx=cv.getContext('2d');
  this.completedLevels=[false,false,false];
  this.screen='start'; // 'start' | 'playing' | 'levelDone' | 'dead'
  this.currentLevel=0;
  this.bindKeys();
  this._initTrees();
}

Game.prototype.startLevel=function(lvlIdx){
  var lv=LEVELS[lvlIdx];
  this.currentLevel=lvlIdx;
  this.screen='playing';
  // Apply level config
  CFG.SEGMENTS=lv.segments;CFG.FINISH=lv.finish;CFG.TIME_LIMIT=lv.timeLimit;
  this.sugar=CFG.INIT_SUGAR;this.elec=CFG.INIT_ELECTROLYTE;this.water=CFG.INIT_WATER;this.hp=CFG.INIT_HEALTH;
  this.speedSetting=3;
  this.spd=0;
  this.salt=CFG.MAX_SALT;this.gel=CFG.MAX_GEL;this.wb=CFG.MAX_WATER_BOTTLE;this.paste=CFG.MAX_PASTE;
  this.miles=0;this.elev=0;
  this.seg=0;this.prog=0;this.track=genTrack(CFG.SEGMENTS);
  this.done=false;this.dead=false;this.deadWhy='';
  this.hurt=false;this.hurtT=0;
  this.tumbled=false;this.tumbleT=0;
  this.gpsOn=false;this.gpsT=0;
  this.cd=0;this.msgs=[];
  this.frame=0;this.time=0;
  this.scroll=0;this.anim=0;
  this.playerOffset=0;
  this.paused=false;
  this.forkDone=false;
  this.forkWrong=false;
  this.shortcuts=0;
  this.dust=[];
  this.dog=null;
  this.supplyTimer=0;
  this._supplyCollected=false;
};

Game.prototype.backToStart=function(){
  this.screen='start';
};

Game.prototype._initTrees=function(){
  this.trees=[];
  for(var i=0;i<50;i++){
    this.trees.push({x:0,y:0,side:Math.random()<0.5?'L':'R',type:Math.random()<0.55?'tree':(Math.random()<0.5?'bush':'rock'),depth:Math.random()});
  }
};

// ======================== Input ========================
Game.prototype.bindKeys=function(){
  var self=this;
  self.keys={};
  var gameKeys=['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','1','2','3','4','m','r','b','k'];
  self._kd=function(e){
    var k=e.key.toLowerCase();
    if(gameKeys.indexOf(k)>=0)e.preventDefault();
    self.keys[k]=true;
    self.press(k);
  };
  self._ku=function(e){
    var k=e.key.toLowerCase();
    self.keys[k]=false;
  };
  window.addEventListener('keydown',self._kd);
  window.addEventListener('keyup',self._ku);
};
Game.prototype.destroy=function(){
  window.removeEventListener('keydown',this._kd);
  window.removeEventListener('keyup',this._ku);
};

Game.prototype.press=function(k){
  var s=this;

  // Start screen: pick level
  if(s.screen==='start'){
    if(k==='1')s.startLevel(0);
    if(k==='2')s.startLevel(1);
    if(k==='3')s.startLevel(2);
    return;
  }

  // Level done screen
  if(s.screen==='levelDone'){
    if(k==='n'){
      var next=s.currentLevel+1;
      if(next<LEVELS.length)s.startLevel(next);
    }
    if(k==='m')s.backToStart();
    return;
  }

  // Dead screen
  if(s.screen==='dead'){
    if(k==='r')s.startLevel(s.currentLevel);
    if(k==='m')s.backToStart();
    return;
  }

  if(k==='m'){s.gpsOn=!s.gpsOn;if(s.gpsOn)s.gpsT=CFG.GPS_TIME;return;}
  if(k==='r'){s.startLevel(s.currentLevel);return;}

  // Fork wrong: optional [B] Back to return, or just keep running
  if(s.forkWrong){
    if(k==='b'){
      // Turn back, re-enter fork — backtrack costs time
      s.forkWrong=false;
      s.forkDone=false;
      s.paused=true;
      s.spd=0;
      s.time+=20;
      s.say('Turned back. Time +20s. Choose again.');
      return;
    }
    // No forced choice — player can ignore and keep running
    return;
  }

  // Fork stop-and-choose (both paths passable, one is a shortcut)
  if(s.paused&&s.seg<s.track.length){
    var seg=s.track[s.seg];
    if(seg&&seg.fork&&!s.forkDone){
      var chosen=null;
      if(k==='arrowleft'||k==='a')chosen='L';
      if(k==='arrowright'||k==='d')chosen='R';
      if(chosen){
        if(chosen!==seg.forkDir){
          // Wrong path — unpause, show shortcut hint, optional back
          s.forkWrong=true;
          s.forkDone=true;
          s.paused=false;
          s.say('Shortcut! [B] Back to return (time +20s)');
        }else{
          s.paused=false;s.forkDone=true;
          s.say('On track!');
        }
      }
      return;
    }
  }

  var ok=s.cd<=0&&!s.paused;
  if(k==='1'&&ok&&s.salt>0){s.salt--;s.elec=Math.min(CFG.MAX_ELEC,s.elec+CFG.SALT_RESTORE);s.cd=CFG.COOLDOWN;s.say('Salt pill +electrolytes');}
  if(k==='2'&&ok&&s.gel>0){s.gel--;s.sugar=Math.min(CFG.MAX_SUGAR,s.sugar+CFG.GEL_RESTORE);s.cd=CFG.COOLDOWN;s.say('Energy gel +sugar');}
  if(k==='3'&&ok&&s.wb>0){s.wb--;s.water=Math.min(CFG.MAX_WATER,s.water+CFG.WATER_RESTORE);s.cd=CFG.COOLDOWN;s.say('Drank water +hydration');}
  if(k==='4'&&s.hurt&&s.paste>0){s.paste--;s.hp=Math.min(CFG.MAX_HP,s.hp+CFG.PASTE_HEAL);s.hurt=false;s.say('Bandaged wound');}
};

Game.prototype.say=function(msg){this.msgs.push({t:msg,life:150});if(this.msgs.length>5)this.msgs.shift();};

Game.prototype.maxSpd=function(){
  var m=CFG.MAX_SPD_BASE;m*=1-(this.miles/CFG.FINISH)*0.25;
  if(this.sugar<30)m*=0.65;if(this.elec<30)m*=0.7;if(this.water<30)m*=0.7;if(this.hurt)m*=0.8;
  return Math.max(CFG.MIN_SPD,m);
};

// ======================== Update ========================
Game.prototype.tick=function(){
  var s=this;
  if(s.screen!=='playing')return;
  if(s.done||s.dead)return;
  s.frame++;s.time+=1/60;
  if(s.cd>0)s.cd--;
  if(s.gpsOn&&s.gpsT>0){s.gpsT--;if(s.gpsT<=0)s.gpsOn=false;}
  if(s.tumbleT>0){s.tumbleT--;if(s.tumbleT<=0)s.tumbled=false;}
  if(s.hurtT>0)s.hurtT--;

  var seg=s.track[s.seg];if(!seg)return;
  var nseg=s.track[s.seg+1]||seg;
  var slp=SLOPE[seg.slope];
  var rd=ROAD[seg.road];

  var effDrain=slp.drainMul;
  var effSpeed=slp.speedMul;

  // Steering (only when not paused)
  var steerLeft=(s.keys['arrowleft']||s.keys['a']);
  var steerRight=(s.keys['arrowright']||s.keys['d']);
  if(!s.paused){
    if(steerLeft&&!steerRight)s.playerOffset-=CFG.STEER_SPEED;
    else if(steerRight&&!steerLeft)s.playerOffset+=CFG.STEER_SPEED;
    else s.playerOffset*=CFG.STEER_FRICTION;
    s.playerOffset=Math.max(-1,Math.min(1,s.playerOffset));
  }

  // Fork auto-brake (only once per segment)
  if(!s.paused&&!s.forkDone&&seg.fork&&s.prog>=CFG.FORK_PAUSE_POS){
    s.paused=true;
    s.spd=0;
    s.say('Fork! Choose LEFT or RIGHT');
  }

  // Speed setting
  if(!s.paused){
    if(s.keys['arrowup'])s.speedSetting=Math.min(s.maxSpd(),s.speedSetting+0.08);
    else if(s.keys['arrowdown'])s.speedSetting=Math.max(CFG.MIN_SPD,s.speedSetting-0.08);
    if(s.keys['w']){
      s.spd+=(s.speedSetting-s.spd)*0.06;
    }else{
      s.spd=0;
    }
    var curMax=s.maxSpd();
    s.speedSetting=Math.min(curMax,Math.max(CFG.MIN_SPD,s.speedSetting));
    s.spd=Math.min(curMax,Math.max(0,s.spd));
  }else{
    s.spd=0;
  }

  // Drain (only when moving)
  if(!s.paused&&s.spd>0.1){
    var dm=effDrain*(s.spd/4.5);
    s.sugar-=CFG.SUGAR_DRAIN*dm;s.elec-=CFG.ELEC_DRAIN*dm;s.water-=CFG.WATER_DRAIN*dm;
  }

  // Tumble
  if(!s.paused&&s.spd>CFG.TUMBLE_THRESHOLD){
    var tumbleChance=0;
    if(seg.slope==='DOWNHILL'){
      tumbleChance=0.002*s.spd;
      if(seg.road==='SOIL')tumbleChance*=2.5;
    }else if(seg.slope==='UPHILL'&&seg.road==='SOIL'&&s.spd>5){
      tumbleChance=0.001*s.spd;
    }
    if(tumbleChance>0&&Math.random()<tumbleChance)s._tumble();
  }
  // Cliff
  if(!s.paused&&seg.cliff&&s.spd>6&&Math.random()<0.003){s.hp=0;s.deadWhy='Fell off a cliff!';s.dead=true;s.screen='dead';return;}

  // Low resource damage
  if(s.sugar<10||s.elec<10)s.hp-=CFG.LOW_ENERGY_DRAIN;
  if(s.water<10)s.hp-=CFG.LOW_WATER_DRAIN;
  if(s.hurt){s.hurtT++;s.hp-=0.02;}

  // Dog Enemy
  s._updateDog();

  // Supply Timer
  if(!s.paused&&seg.supply&&s.prog>0.32&&s.prog<0.68&&!s._supplyCollected){
    if(s.spd<0.3){
      s.supplyTimer++;
      if(s.supplyTimer>=CFG.SUPPLY_TIME){
        s._supplyCollected=true;
        s.supplyTimer=0;
        s.wb=Math.min(CFG.MAX_WATER_BOTTLE,s.wb+2);
        s.salt=Math.min(CFG.MAX_SALT,s.salt+1);
        s.gel=Math.min(CFG.MAX_GEL,s.gel+1);
        s.say('Resupplied! +2 water +1 salt pill +1 gel');
      }
    }else{
      s.supplyTimer=Math.max(0,s.supplyTimer-2);
    }
  }else if(!seg.supply||s.prog>0.68||s.prog<0.32){
    s.supplyTimer=0;
  }

  // Distance
  if(!s.paused&&s.spd>0.1){
    s.prog+=(s.spd*effSpeed)/(seg.len*10);
    s.miles+=s.spd*0.15*effSpeed;
    if(seg.slope==='UPHILL')s.elev+=s.spd*0.08*effSpeed;
  }

  // Segment switch
  if(s.prog>=1){
    if(s.forkWrong){s.shortcuts++;}
    s.prog=0;s.seg++;
    s.paused=false;s.forkDone=false;s.forkWrong=false;
    s.supplyTimer=0;s._supplyCollected=false;
    s.dog=null;
    if(s.seg>=CFG.SEGMENTS){
      s.done=true;s.miles=CFG.FINISH;
      s.completedLevels[s.currentLevel]=true;
      s.screen='levelDone';
      return;
    }
    var ns=s.track[s.seg];
    if(ns){
      if(ns.fork)s.say('Fork ahead -- slow down!');
      if(ns.supply)s.say('Supply point ahead! Stop to resupply');
    }
  }

  // Clamp
  s.sugar=Math.max(0,Math.min(CFG.MAX_SUGAR,s.sugar));
  s.elec=Math.max(0,Math.min(CFG.MAX_ELEC,s.elec));
  s.water=Math.max(0,Math.min(CFG.MAX_WATER,s.water));
  // Time limit
  if(s.time>=CFG.TIME_LIMIT){s.dead=true;s.deadWhy='Time up! '+Math.floor(CFG.TIME_LIMIT/60)+'min limit exceeded';s.screen='dead';return;}
  s.hp=Math.max(0,Math.min(CFG.MAX_HP,s.hp));
  if(s.hp<=0){s.dead=true;if(!s.deadWhy)s.deadWhy='Health depleted';s.screen='dead';return;}
  if(s.spd>0.5)s.anim+=s.spd*0.08;

  // Dust
  s._updateDust();

  // Messages
  for(var i=s.msgs.length-1;i>=0;i--){s.msgs[i].life--;if(s.msgs[i].life<=0)s.msgs.splice(i,1);}
};

Game.prototype._tumble=function(){
  this.tumbled=true;this.tumbleT=60;this.hp-=CFG.TUMBLE_DMG;
  this.hurt=true;this.hurtT=180;
  this.say('Fell hard! Press 4 to bandage');
};

// ======================== Dog Enemy ========================
Game.prototype._updateDog=function(){
  var s=this;
  if(s.paused)return;

  if(!s.dog&&s.spd>0.5&&Math.random()<CFG.DOG_SPAWN_CHANCE){
    var cx=s.cv.width/2,rw=CFG.ROAD_W,proj=0.15;
    var botW=rw*(1+proj*0.3);
    var rx=cx+(Math.random()-0.5)*botW*0.6;
    s.dog={x:rx, y:s.cv.height+100, alertT:80, closingIn:false};
    s.say('WOOF! A dog is chasing you!');
  }

  if(!s.dog)return;
  var d=s.dog;

  var targetY=CFG.PLAYER_Y+50;
  var px=s.cv.width/2+s.playerOffset*((CFG.ROAD_W*(1+0.15*0.3))/2-16);

  if(s.spd>=CFG.DOG_ESCAPE_SPD){
    d.y+=(s.spd-CFG.DOG_ESCAPE_SPD)*1.2+0.8;
    d.closingIn=false;
  }else if(d.y>targetY+20){
    var closeRate=CFG.DOG_SPEED+s.spd*0.25;
    d.y-=closeRate;
    d.closingIn=d.y<targetY+100;
  }else{
    d.y+=(targetY-d.y)*0.08;
    d.closingIn=true;
  }

  d.x+=(px-d.x)*0.025;

  var dx=d.x-px,dy=d.y-CFG.PLAYER_Y;
  if(Math.abs(dx)<26&&Math.abs(dy)<30){
    s.hp-=CFG.DOG_DMG;
    s.hurt=true;s.hurtT=180;
    s.say('Dog bite! Bandage needed. Speed up to escape!');
    d.y+=80;d.closingIn=false;
  }

  if(d.y>s.cv.height+300){
    s.say('Dog gave up chasing');
    s.dog=null;
  }else if(d.y<-80){
    s.dog=null;
  }
};

// ======================== Dust Particles ========================
Game.prototype._updateDust=function(){
  if(!this.paused&&this.spd>0.5&&this.screen==='playing'){
    var cyclePos=this.anim%(Math.PI*2);
    if(cyclePos<0.15||Math.abs(cyclePos-Math.PI)<0.15){
      if(Math.random()<0.4){
        var cx=this.cv.width/2,cy=CFG.PLAYER_Y;
        var rw=CFG.ROAD_W,proj=0.15,botW=rw*(1+proj*0.3);
        var maxOff=(botW/2)-16;
        var ox=cx+this.playerOffset*maxOff;
        this.dust.push({x:ox+(Math.random()-0.5)*12,y:cy+10,vx:(Math.random()-0.5)*1.5,vy:-Math.random()*1.5-0.5,life:30,life0:30,r:2+Math.random()*3});
      }
    }
  }
  for(var i=this.dust.length-1;i>=0;i--){
    var d=this.dust[i];
    d.x+=d.vx;d.y+=d.vy;
    d.vy+=0.05;
    d.vx*=0.96;
    d.life--;
    if(d.life<=0)this.dust.splice(i,1);
  }
};

Game.prototype._drawDust=function(ctx){
  for(var i=0;i<this.dust.length;i++){
    var d=this.dust[i];
    var a=d.life/d.life0*0.5;
    ctx.fillStyle='rgba(180,160,130,'+a+')';
    ctx.beginPath();ctx.arc(d.x,d.y,d.r*(1-d.life/d.life0*0.3),0,Math.PI*2);ctx.fill();
  }
};

// ======================== Render ========================
Game.prototype.draw=function(){
  var ctx=this.ctx,W=this.cv.width,H=this.cv.height;
  if(!W||W<100){this.cv.width=960;W=960;}if(!H||H<100){this.cv.height=540;H=540;}
  if(this.error){ctx.fillStyle='#300';ctx.fillRect(0,0,W,H);ctx.fillStyle='#F44';ctx.font='18px sans-serif';ctx.fillText('Error: '+this.error,20,60);return;}

  if(this.screen==='start'){
    this._drawStartScreen(ctx,W,H);
    return;
  }
  if(this.screen==='levelDone'){
    this._drawLevelDone(ctx,W,H);
    return;
  }
  if(this.screen==='dead'){
    this._drawDead(ctx,W,H);
    return;
  }

  // Playing
  this._ground(ctx,W,H);
  this._road(ctx,W,H);
  this._supplyMarkers(ctx,W,H);
  this._trees(ctx,W,H);
  this._drawDust(ctx);
  this._player(ctx,W,H);
  this._dog(ctx,W,H);
  this._slopeIndicator(ctx,W,H);
  this._hud(ctx,W,H);
  if(this.gpsOn)this._gps(ctx,W,H);
  if(this.tumbled){ctx.fillStyle='rgba(255,80,0,'+(this.tumbleT/60*0.3)+')';ctx.fillRect(0,0,W,H);}
  if(this.done)this._finish(ctx,W,H);
};

// ======================== Start Screen ========================
Game.prototype._drawStartScreen=function(ctx,W,H){
  // Background
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#1A3A10');g.addColorStop(0.5,'#2E5A1E');g.addColorStop(1,'#1A3A10');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

  // Title
  ctx.fillStyle='#FFD700';ctx.font='bold 56px sans-serif';ctx.textAlign='center';
  ctx.fillText('KEEP GOING',W/2,H*0.16);
  ctx.fillStyle='#FFF';ctx.font='18px sans-serif';
  ctx.fillText('Trail Running Challenge',W/2,H*0.22);

  // Mountains silhouette
  ctx.fillStyle='rgba(30,60,20,0.6)';
  ctx.beginPath();ctx.moveTo(0,H*0.85);
  ctx.lineTo(W*0.15,H*0.55);ctx.lineTo(W*0.3,H*0.62);ctx.lineTo(W*0.5,H*0.48);
  ctx.lineTo(W*0.65,H*0.58);ctx.lineTo(W*0.8,H*0.52);ctx.lineTo(W,H*0.6);
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();

  // Separator
  ctx.strokeStyle='rgba(255,215,0,0.3)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(W*0.15,H*0.24);ctx.lineTo(W*0.85,H*0.24);ctx.stroke();

  // Level cards
  var cardW=230,cardH=160,startX=W/2-cardW*1.5-24,cardY=H*0.3,gap=cardW+24;

  for(var i=0;i<LEVELS.length;i++){
    var lv=LEVELS[i];
    var cx=startX+cardW/2+i*gap;
    var cy=cardY+cardH/2;
    var completed=this.completedLevels[i];

    // Card bg
    ctx.fillStyle=completed?'rgba(30,60,20,0.7)':'rgba(0,0,0,0.5)';
    ctx.fillRect(cx-cardW/2,cy-cardH/2,cardW,cardH);

    // Border
    var pulse=Math.sin(this.frame*0.03+i)*0.15+0.85;
    ctx.strokeStyle=completed?'rgba(100,200,100,'+pulse+')':'rgba(255,255,255,'+(0.25+pulse*0.1)+')';
    ctx.lineWidth=2;
    ctx.strokeRect(cx-cardW/2,cy-cardH/2,cardW,cardH);

    // Level number
    ctx.fillStyle=lv.color;
    ctx.font='bold 28px sans-serif';ctx.textAlign='center';
    ctx.fillText('LEVEL '+(i+1),cx,cy-cardH/2+40);

    // Icon
    ctx.font='40px sans-serif';
    ctx.fillText(lv.icon,cx,cy-cardH/2+82);

    // Name
    ctx.fillStyle='#FFF';ctx.font='bold 18px sans-serif';
    ctx.fillText(lv.name,cx,cy+10);

    // Desc line
    ctx.fillStyle='#AAA';ctx.font='12px sans-serif';
    ctx.fillText(lv.desc,cx,cy+32);

    // Stats
    ctx.fillStyle='#FFD700';ctx.font='11px monospace';
    ctx.fillText(lv.finish+'m · '+lv.segments+' seg · '+(lv.timeLimit/60)+'min',cx,cy+52);

    // Check mark or key hint
    if(completed){
      ctx.fillStyle='#44DD44';ctx.font='bold 24px sans-serif';
      ctx.fillText('\u2713 COMPLETE',cx,cy+75);
    }else{
      ctx.fillStyle='rgba(255,215,0,'+pulse+')';ctx.font='bold 13px sans-serif';
      ctx.fillText('Press ['+(i+1)+'] to start',cx,cy+75);
    }
  }

  // Bottom hint
  ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='12px sans-serif';ctx.textAlign='center';
  ctx.fillText('Press 1, 2 or 3 to choose a level',W/2,H*0.84);

  // Controls reminder
  ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='10px monospace';
  ctx.fillText('[W]Run [\u2191\u2193]Speed [\u2190\u2192]Steer [1]Salt [2]Gel [3]Water [4]Bandage [M]Map',W/2,H*0.90);

  ctx.textAlign='left';
};

// ======================== Level Done ========================
Game.prototype._drawLevelDone=function(ctx,W,H){
  var lv=LEVELS[this.currentLevel];
  ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);

  ctx.fillStyle='#FFD700';ctx.font='bold 48px sans-serif';ctx.textAlign='center';
  ctx.fillText('LEVEL COMPLETE!',W/2,H*0.15);

  ctx.fillStyle='#FFF';ctx.font='20px sans-serif';
  ctx.fillText(lv.icon+' '+lv.name+': '+lv.desc,W/2,H*0.23);

  // --- Scoring ---
  // Time penalty (progressive brackets)
  var t=this.time,limit=CFG.TIME_LIMIT;
  var timePenalty=0;
  if(t>limit*2/3)      timePenalty=Math.floor(t/10)*6;
  else if(t>limit/3)   timePenalty=Math.floor(t/10)*3;
  // Shortcut penalty: always applies, no cheating
  var shortcutPenalty=this.shortcuts*5;
  var score=Math.max(0,100-timePenalty-shortcutPenalty);
  var rating=score>=90?'S':score>=75?'A':score>=60?'B':score>=40?'C':'D';
  var ratingColor={'S':'#FFD700','A':'#44DD44','B':'#44AAFF','C':'#FFAA44','D':'#FF4444'}[rating];

  // Score panel
  var px=W/2-160,py=H*0.30,pw=320,ph=150;
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(px,py,pw,ph);
  ctx.strokeStyle=ratingColor;ctx.lineWidth=3;ctx.strokeRect(px,py,pw,ph);

  ctx.fillStyle='#FFF';ctx.font='bold 28px sans-serif';ctx.textAlign='center';
  ctx.fillText('Score: '+score+' / 100',W/2,py+40);

  ctx.fillStyle=ratingColor;ctx.font='bold 52px sans-serif';
  ctx.fillText(rating,W/2,py+90);

  // Breakdown
  ctx.fillStyle='#AAA';ctx.font='14px sans-serif';
  var bdY=py+ph+16;
  ctx.fillText('Distance: '+Math.floor(this.miles)+'m   Climb: '+Math.floor(this.elev)+'m   Time: '+Math.floor(this.time/60)+'m '+Math.floor(this.time%60)+'s',W/2,bdY);
  ctx.fillText('Time penalty: -'+timePenalty+'   Shortcuts: -'+shortcutPenalty, W/2,bdY+20);

  if(this.shortcuts>0){
    var susPulse=Math.sin(this.frame*0.06)*0.3+0.7;
    ctx.fillStyle='rgba(255,80,40,'+susPulse+')';ctx.font='bold 16px sans-serif';
    ctx.fillText('\u26A0 Suspicious: '+this.shortcuts+' shortcut'+(this.shortcuts>1?'s':'')+' detected!',W/2,bdY+44);
  }

  // Options
  var nextLevel=this.currentLevel+1;
  var optY=bdY+(this.shortcuts>0?72:40);
  if(nextLevel<LEVELS.length){
    var pulse=Math.sin(this.frame*0.05)*0.3+0.7;
    ctx.fillStyle='rgba(255,215,0,'+pulse+')';ctx.font='bold 20px sans-serif';
    ctx.fillText('Press [N] for next: '+LEVELS[nextLevel].icon+' '+LEVELS[nextLevel].name,W/2,optY);
  }else{
    ctx.fillStyle='#44DD44';ctx.font='bold 24px sans-serif';
    ctx.fillText('\u2605 ALL LEVELS CLEARED! \u2605',W/2,optY);
  }
  ctx.fillStyle='#AAA';ctx.font='16px sans-serif';
  ctx.fillText('Press [M] for level select   [R] retry',W/2,optY+26);

  ctx.textAlign='left';
};

// ======================== Dead Screen ========================
Game.prototype._drawDead=function(ctx,W,H){
  ctx.fillStyle='rgba(80,0,0,0.7)';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#F44';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.fillText('FAILED',W/2,H*0.35);
  ctx.fillStyle='#FFF';ctx.font='20px sans-serif';ctx.fillText(this.deadWhy||'Health depleted',W/2,H*0.44);
  ctx.fillText('Ran: '+Math.floor(this.miles)+'m   Climb: '+Math.floor(this.elev)+'m',W/2,H*0.50);
  ctx.font='16px sans-serif';
  ctx.fillStyle='#FFD700';ctx.fillText('Press [R] to retry level',W/2,H*0.58);
  ctx.fillStyle='#AAA';ctx.fillText('Press [M] for level select',W/2,H*0.63);
  ctx.textAlign='left';
};

// ---- Ground ----
Game.prototype._ground=function(ctx,W,H){
  var g=ctx.createLinearGradient(W/2,0,W/2,H);
  g.addColorStop(0,'#7BA05B');g.addColorStop(0.35,'#8DB86A');g.addColorStop(0.7,'#6B9A4B');g.addColorStop(1,'#5A8A3D');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,0.03)';
  for(var i=0;i<20;i++){var rx=(i*113+this.scroll*0.2)%W,ry=(i*97+this.scroll*0.3)%H;ctx.fillRect(rx,ry,30+Math.random()*40,2);}
};

// ---- Road ----
Game.prototype._road=function(ctx,W,H){
  var seg=this.track[this.seg];if(!seg)return;
  var nseg=this.track[this.seg+1]||seg;
  var rd=ROAD[seg.road],nrd=ROAD[nseg.road];
  var slp=SLOPE[seg.slope];
  var cx=W/2,rw=CFG.ROAD_W;
  var proj=0.15;
  var topW=rw*(1-proj),botW=rw*(1+proj*0.3);
  var topX=cx-topW/2,botX=cx-botW/2;
  var roadC=rd.color;
  var edgeC=rd.edge;

  ctx.fillStyle=roadC;ctx.beginPath();
  ctx.moveTo(botX,H);ctx.lineTo(botX+botW,H);ctx.lineTo(topX+topW,0);ctx.lineTo(topX,0);
  ctx.closePath();ctx.fill();

  var tintA=slp.speedMul>1.1?0.15:0;
  ctx.fillStyle=slp.tint;ctx.globalAlpha=tintA*0.5;
  ctx.beginPath();ctx.moveTo(botX,H);ctx.lineTo(botX+botW,H);ctx.lineTo(topX+topW,0);ctx.lineTo(topX,0);
  ctx.closePath();ctx.fill();ctx.globalAlpha=1;

  ctx.strokeStyle=edgeC;ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(botX,H);ctx.lineTo(topX,0);ctx.stroke();
  ctx.beginPath();ctx.moveTo(botX+botW,H);ctx.lineTo(topX+topW,0);ctx.stroke();

  this._slopeArrows(ctx,cx,W,H,slp);

  // Center dashes
  ctx.setLineDash([18,14]);ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=2;
  var dashOff=(this.scroll*this.spd*0.5)%32;
  ctx.beginPath();ctx.moveTo(cx,H-dashOff);
  for(var y=H-dashOff;y>-50;y-=32)ctx.lineTo(cx,y);
  ctx.stroke();ctx.setLineDash([]);
};

// ---- Slope Arrows ----
Game.prototype._slopeArrows=function(ctx,cx,W,H,slp){
  if(slp.name==='Flat')return;
  var dir=slp.speedMul<0.9?'up':'down',count=5,alpha=0.25;
  ctx.fillStyle='rgba(255,255,255,'+alpha+')';
  ctx.font='16px sans-serif';ctx.textAlign='center';
  for(var i=0;i<count;i++){
    var y=80+i*110+(this.scroll*2)%110;
    if(y>H||y<0)continue;
    var label=dir==='up'?'\u25B2':'\u25BC';
    ctx.fillText(label,cx-160,y);ctx.fillText(label,cx+160,y);
  }
  ctx.textAlign='left';
};

// ---- Supply Markers ----
Game.prototype._supplyMarkers=function(ctx,W,H){
  var seg=this.track[this.seg];if(!seg)return;
  var cx=W/2;

  if(seg.supply){
    var markerY=H*0.05+(H*0.78)*(1-this.prog/0.5);
    if(this.prog<0.65&&markerY>0&&markerY<H){
      var pulse=Math.sin(this.frame*0.06)*0.3+0.7;
      ctx.fillStyle='rgba(255,99,71,'+(0.4+pulse*0.3)+')';
      ctx.beginPath();ctx.arc(cx,markerY,14+(1-pulse)*4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,'+(0.7+pulse*0.3)+')';
      ctx.beginPath();ctx.arc(cx,markerY,10,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(255,99,71,'+pulse+')';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(cx,markerY,11,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#FF6347';
      ctx.fillRect(cx-5,markerY-1.5,10,3);ctx.fillRect(cx-1.5,markerY-5,3,10);
      ctx.fillStyle='#FFF';ctx.font='bold 11px sans-serif';ctx.textAlign='center';
      ctx.fillText('SUPPLY',cx,markerY-18);
      ctx.textAlign='left';

      if(this.spd<0.3&&!this._supplyCollected&&this.supplyTimer>0){
        var pct=Math.min(1,this.supplyTimer/CFG.SUPPLY_TIME);
        var pbw=80,pbh=6,pbx=cx-pbw/2,pby=markerY+18;
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(pbx,pby,pbw,pbh);
        ctx.fillStyle='rgba(255,99,71,0.8)';ctx.fillRect(pbx,pby,pbw*pct,pbh);
        ctx.strokeStyle='#FFF';ctx.lineWidth=1;ctx.strokeRect(pbx,pby,pbw,pbh);
      }else if(this._supplyCollected){
        ctx.fillStyle='rgba(100,255,100,0.6)';ctx.font='bold 11px sans-serif';ctx.textAlign='center';
        ctx.fillText('DONE',cx,markerY+18);
        ctx.textAlign='left';
      }
    }
  }

  for(var i=1;i<=3;i++){
    var nsIdx=this.seg+i;
    if(nsIdx>=this.track.length)break;
    if(this.track[nsIdx].supply){
      var ny=H*0.05-i*22;
      ctx.fillStyle='rgba(255,99,71,0.35)';
      ctx.beginPath();ctx.arc(cx,ny,5-i*0.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='9px sans-serif';ctx.textAlign='center';
      ctx.fillText('+',cx,ny+3);ctx.textAlign='left';
    }
  }
};

// ---- Trees/Rocks ----
Game.prototype._trees=function(ctx,W,H){
  var rw=CFG.ROAD_W,cx=W/2,proj=0.15;
  var botW=rw*(1+proj*0.3);
  for(var i=0;i<this.trees.length;i++){
    var t=this.trees[i];
    var rawY=(t.depth*H+this.scroll*this.spd*0.8)%(H+80)-40;
    if(rawY<-80||rawY>H+80)continue;
    var roadEdge=botW/2+(H-rawY)/H*20;
    var dir=t.side==='L'?-1:1;
    var gx=cx+dir*(roadEdge+15+t.depth*60);
    if(t.type==='tree')this._oneTree(ctx,gx,rawY,t.depth);
    else if(t.type==='bush')this._oneBush(ctx,gx,rawY,t.depth);
    else this._oneRock(ctx,gx,rawY,t.depth);
  }
};

Game.prototype._oneTree=function(ctx,x,y,d){
  var s=0.6+d*0.5;
  ctx.fillStyle='#6B4226';ctx.fillRect(x-2*s,y-8*s,4*s,8*s);
  ctx.fillStyle='#3A7D44';ctx.beginPath();ctx.arc(x,y-12*s,7*s,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#4D8D54';ctx.beginPath();ctx.arc(x-2*s,y-14*s,4*s,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x+3*s,y-13*s,3.5*s,0,Math.PI*2);ctx.fill();
};
Game.prototype._oneBush=function(ctx,x,y,d){
  var s=0.5+d*0.4;
  ctx.fillStyle='#5A8F4A';ctx.beginPath();ctx.arc(x,y-5*s,8*s,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#6A9F5A';ctx.beginPath();ctx.arc(x-4*s,y-7*s,5*s,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x+4*s,y-6*s,5*s,0,Math.PI*2);ctx.fill();
};
Game.prototype._oneRock=function(ctx,x,y,d){
  var s=0.5+d*0.4;
  ctx.fillStyle='#999';ctx.beginPath();
  ctx.moveTo(x-6*s,y);ctx.lineTo(x+5*s,y+1*s);ctx.lineTo(x+4*s,y-7*s);ctx.lineTo(x-4*s,y-9*s);ctx.closePath();
  ctx.fill();
  ctx.fillStyle='#AAA';ctx.beginPath();
  ctx.moveTo(x-3*s,y-7*s);ctx.lineTo(x+3*s,y-5*s);ctx.lineTo(x+1*s,y-10*s);ctx.lineTo(x-3*s,y-9*s);ctx.closePath();
  ctx.fill();
};

// ======================== Dog Render ========================
Game.prototype._dog=function(ctx,W,H){
  if(!this.dog)return;
  var d=this.dog;
  var dx=d.x,dy=d.y;

  ctx.fillStyle='#8B6914';
  ctx.fillRect(dx-12,dy-8,24,16);
  ctx.fillStyle='#A07830';
  ctx.beginPath();ctx.arc(dx+16,dy-6,7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#6B4F10';
  ctx.beginPath();ctx.arc(dx+22,dy-4,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#FFF';
  ctx.beginPath();ctx.arc(dx+19,dy-8,2.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#000';
  ctx.beginPath();ctx.arc(dx+20,dy-8,1.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#6B4F10';
  ctx.beginPath();ctx.arc(dx+11,dy-12,5,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#5A4410';ctx.lineWidth=3;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(dx-6,dy+8);ctx.lineTo(dx-6,dy+16);ctx.stroke();
  ctx.beginPath();ctx.moveTo(dx+2,dy+8);ctx.lineTo(dx+2,dy+16);ctx.stroke();
  ctx.beginPath();ctx.moveTo(dx+8,dy+8);ctx.lineTo(dx+8,dy+15);ctx.stroke();
  ctx.strokeStyle='#A07830';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(dx-12,dy-4);ctx.lineTo(dx-18,dy-12);ctx.stroke();

  if(d.alertT>0){
    var barkA=d.alertT/80;
    ctx.fillStyle='rgba(255,255,255,'+barkA+')';ctx.font='bold 13px sans-serif';ctx.textAlign='center';
    ctx.fillText('WOOF!',dx-8,dy-28);
    ctx.textAlign='left';
    d.alertT--;
  }

  var px=W/2+this.playerOffset*((CFG.ROAD_W*(1+0.15*0.3))/2-16);
  if(Math.abs(dx-px)<60&&Math.abs(dy-CFG.PLAYER_Y)<80){
    ctx.strokeStyle='rgba(255,0,0,'+(0.3+Math.sin(this.frame*0.2)*0.3)+')';
    ctx.lineWidth=2;ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.arc(dx+2,dy-2,24,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
  }
};

// ======================== Player ========================
Game.prototype._player=function(ctx,W,H){
  var cx=W/2,cy=CFG.PLAYER_Y;
  var rw=CFG.ROAD_W,proj=0.15;
  var botW=rw*(1+proj*0.3);
  var maxOff=(botW/2)-16;
  var ox=cx+this.playerOffset*maxOff;

  var running=!this.paused&&this.spd>0.3;
  var phase=this.anim*1.5;

  var bounce=running?Math.abs(Math.sin(phase*2))*3:0;
  var py=cy-bounce;

  ctx.fillStyle='rgba(0,0,0,0.2)';
  ctx.beginPath();ctx.ellipse(ox,cy+14,10,3,0,0,Math.PI*2);ctx.fill();

  var legTopY=py-2;
  var legBaseLen=11;
  var legSwing=running?5:0;
  var lenL=legBaseLen+Math.sin(phase)*legSwing;
  var lenR=legBaseLen+Math.sin(phase+Math.PI)*legSwing;

  ctx.strokeStyle='#2C3E50';
  ctx.lineWidth=4;
  ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(ox-3,legTopY);ctx.lineTo(ox-3,legTopY+lenL);ctx.stroke();
  ctx.beginPath();ctx.moveTo(ox+3,legTopY);ctx.lineTo(ox+3,legTopY+lenR);ctx.stroke();

  ctx.fillStyle='#333';
  ctx.beginPath();ctx.ellipse(ox-3,legTopY+lenL,4,2,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(ox+3,legTopY+lenR,4,2,0,0,Math.PI*2);ctx.fill();

  var bodyColor='#E94560';
  ctx.fillStyle=bodyColor;
  ctx.fillRect(ox-8,py-20,16,20);
  ctx.fillStyle='rgba(255,255,255,0.15)';
  ctx.fillRect(ox-8,py-12,16,2);

  var headY=py-26;
  ctx.fillStyle='#FFDAB9';
  ctx.beginPath();ctx.arc(ox,headY,7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3B2E1A';
  ctx.beginPath();ctx.arc(ox,headY-1,7,Math.PI*1.1,Math.PI*2.1,false);ctx.fill();
  ctx.fillStyle='#E94560';
  ctx.beginPath();ctx.ellipse(ox+1,headY-3,8,2.5,-0.2,0,Math.PI*2);ctx.fill();

  if(this.spd>5&&!this.paused){
    var spdA=(this.spd-5)/5*0.4;
    ctx.strokeStyle='rgba(255,255,255,'+spdA+')';ctx.lineWidth=1.5;ctx.lineCap='round';
    for(var i=0;i<3;i++){
      var sy=py-15+i*6;
      var off=Math.sin(this.frame*0.3+i)*3;
      ctx.beginPath();ctx.moveTo(ox-16-off,sy);ctx.lineTo(ox-10-off,sy);ctx.stroke();
      ctx.beginPath();ctx.moveTo(ox+10+off,sy);ctx.lineTo(ox+16+off,sy);ctx.stroke();
    }
  }

  if(this.dog){
    var dogDist=Math.abs(this.dog.y-cy);
    if(dogDist<120){
      var dangerA=(120-dogDist)/120;
      ctx.strokeStyle='rgba(255,0,0,'+(dangerA*0.6*Math.sin(this.frame*0.15)*0.3+0.7)+')';
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(ox,py-12,20+5*Math.sin(this.frame*0.3),0,Math.PI*2);ctx.stroke();
    }
  }
};

// ======================== Slope Cross-Section ========================
Game.prototype._slopeIndicator=function(ctx,W,H){
  var seg=this.track[this.seg];if(!seg)return;
  var slp=SLOPE[seg.slope];
  var angle=slp.angle;
  var slopeName=slp.name;

  var ix=W-130,iy=145;
  var iw=90,ih=80;

  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.fillRect(ix-8,iy-18,iw+16,ih+30);

  ctx.fillStyle='#FFF';ctx.font='10px monospace';
  ctx.fillText('Slope',ix,iy-6);
  ctx.fillStyle='#FFD700';
  ctx.fillText(slopeName,ix+40,iy-6);

  var baseY=iy+ih;
  var groundX0=ix,groundX1=ix+iw;

  ctx.strokeStyle='rgba(100,200,100,0.5)';ctx.lineWidth=1;
  ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(groundX0-4,baseY);ctx.lineTo(groundX1+4,baseY);ctx.stroke();
  ctx.setLineDash([]);

  var angleRad=angle*Math.PI/180;
  var rise=Math.tan(angleRad)*iw;

  ctx.fillStyle='rgba(200,180,140,0.4)';
  ctx.strokeStyle='#FFD700';
  ctx.lineWidth=2;

  if(angle>1){
    ctx.beginPath();
    ctx.moveTo(groundX0,baseY);
    ctx.lineTo(groundX1,baseY);
    ctx.lineTo(groundX1,baseY-rise);
    ctx.closePath();
    ctx.fill();ctx.stroke();
  }else if(angle<-1){
    ctx.beginPath();
    ctx.moveTo(groundX0,baseY);
    ctx.lineTo(groundX1,baseY+rise);
    ctx.lineTo(groundX1,baseY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();ctx.moveTo(groundX0,baseY);ctx.lineTo(groundX1,baseY+rise);ctx.stroke();
    ctx.beginPath();ctx.moveTo(groundX0,baseY);ctx.lineTo(groundX1,baseY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(groundX1,baseY);ctx.lineTo(groundX1,baseY+rise);ctx.stroke();
  }else{
    ctx.fillRect(groundX0,baseY-3,iw,3);
    ctx.strokeRect(groundX0,baseY-3,iw,3);
  }

  var angleStr=(angle>0?'+':'')+Math.round(angle)+'deg';
  ctx.fillStyle='#FFD700';ctx.font='bold 11px monospace';
  ctx.fillText(angleStr,ix+iw/2-16,baseY+15);

  var runX=groundX0+iw*0.3;
  var runY=angle>1?baseY-rise*0.3:(angle<-1?baseY+rise*0.3:baseY-2);
  ctx.fillStyle='#E94560';
  ctx.beginPath();ctx.arc(runX,runY-4,3,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#E94560';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(runX,runY-2);ctx.lineTo(runX,runY+3);ctx.stroke();
};

// ======================== HUD ========================
Game.prototype._hud=function(ctx,W,H){
  var bw=180,bh=13,x0=14,y0=14,gap=18;
  ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(x0-6,y0-6,bw+12,gap*5+8);
  this._bar(ctx,x0,y0,bw,bh,this.hp,CFG.MAX_HP,'#FF4444','HP');
  this._bar(ctx,x0,y0+gap,bw,bh,this.sugar,CFG.MAX_SUGAR,'#FFAA00','Sugar');
  this._bar(ctx,x0,y0+gap*2,bw,bh,this.elec,CFG.MAX_ELEC,'#00BBFF','Elec');
  this._bar(ctx,x0,y0+gap*3,bw,bh,this.water,CFG.MAX_WATER,'#3399FF','Water');

  // Speed bar
  var sy0=y0+gap*4;
  ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(x0,sy0,bw,bh);
  var spdPct=Math.max(0,this.spd/this.maxSpd());
  var spdG=ctx.createLinearGradient(x0,sy0,x0+bw*spdPct,sy0);
  spdG.addColorStop(0,'#88FF44');spdG.addColorStop(1,lightenC('#88FF44'));
  ctx.fillStyle=spdG;ctx.fillRect(x0,sy0,bw*spdPct,bh);
  var setPct=Math.max(0,Math.min(1,this.speedSetting/this.maxSpd()));
  ctx.strokeStyle='#FFF';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x0+bw*setPct,sy0-2);ctx.lineTo(x0+bw*setPct,sy0+bh+2);ctx.stroke();
  ctx.strokeStyle='#FFF';ctx.lineWidth=0.5;ctx.strokeRect(x0,sy0,bw,bh);
  ctx.fillStyle='#FFF';ctx.font='10px sans-serif';
  ctx.fillText('Spd '+this.spd.toFixed(1)+' (set '+this.speedSetting.toFixed(1)+')',x0+4,sy0+bh-2);

  // Level name tag
  var lv=LEVELS[this.currentLevel];
  ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(W/2-65,8,130,22);
  ctx.fillStyle=lv.color;ctx.font='bold 14px sans-serif';ctx.textAlign='center';
  ctx.fillText('L'+(this.currentLevel+1)+' '+lv.name,W/2,24);

  // Right info panel
  ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(W-210,10,194,140);
  ctx.fillStyle='#FFF';ctx.font='14px monospace';
  ctx.fillText('Dist:'+Math.floor(this.miles)+'/'+CFG.FINISH+'m',W-200,28);
  ctx.fillText('Climb:'+Math.floor(this.elev)+'m',W-200,46);
  var mn=Math.floor(this.time/60),sc=Math.floor(this.time%60);
  ctx.fillText('Time:'+mn+':'+(sc<10?'0':'')+sc,W-200,64);
  var remain=Math.max(0,CFG.TIME_LIMIT-this.time);
  var rm=Math.floor(remain/60),rs=Math.floor(remain%60);
  var warn=(remain<60)?Math.sin(this.frame*0.15)*0.5+0.5:0;
  ctx.fillStyle=(remain<60)?'rgba(255,80,80,'+(0.8+warn*0.2)+')':'#FFD700';
  ctx.fillText('Limit:'+rm+':'+(rs<10?'0':'')+rs,W-200,82);
  ctx.fillStyle='#FFF';
  ctx.fillText('Seg:'+(this.seg+1)+'/'+CFG.SEGMENTS,W-200,100);
  var seg=this.track[this.seg];
  if(seg){
    ctx.fillStyle='#FFD700';ctx.font='12px monospace';
    ctx.fillText(ROAD[seg.road].name+' \u00B7 '+SLOPE[seg.slope].name,W-200,118);
    ctx.fillText('Offset:'+(this.playerOffset*100).toFixed(0)+'%',W-200,134);
  }

  // Dog warning
  if(this.dog){
    var dist=Math.abs(this.dog.y-CFG.PLAYER_Y);
    var dwA=Math.sin(this.frame*0.15)*0.3+0.7;
    ctx.fillStyle='rgba(255,80,0,'+dwA+')';ctx.font='bold 12px monospace';
    if(dist<80){
      ctx.fillText('DOG CLOSE! Speed > '+CFG.DOG_ESCAPE_SPD.toFixed(0)+'!',W-200,132);
    }else{
      ctx.fillText('Dog '+Math.floor(dist)+'px behind',W-200,132);
    }
  }

  // Supply progress hint
  if(seg&&seg.supply&&this.spd<0.3&&!this._supplyCollected&&this.supplyTimer>0){
    var supPct=Math.floor(this.supplyTimer/CFG.SUPPLY_TIME*100);
    ctx.fillStyle='rgba(255,99,71,0.8)';ctx.font='11px monospace';
    ctx.fillText('Resupplying... '+supPct+'%',W-200,148);
  }

  // Bottom controls
  ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(14,H-78,360,64);
  ctx.fillStyle='#FFF';ctx.font='13px monospace';
  ctx.fillText('[1]Salt Pill:'+this.salt+'  [2]Gel:'+this.gel+'  [3]Water:'+this.wb,20,H-56);
  ctx.fillText('[4]Bandage:'+this.paste+'  [W]Run  [Up/Dn]Speed',20,H-36);
  ctx.fillText('[<-/->]Steer & Fork  [M]Map  [R]Retry',20,H-16);

  // Messages
  var my=H-140;
  for(var i=0;i<this.msgs.length;i++){
    var m=this.msgs[i],a=Math.min(1,m.life/80);
    ctx.fillStyle='rgba(255,255,50,'+a+')';ctx.font='bold 13px sans-serif';
    ctx.fillText(m.t,W-280,my);my-=17;
  }

  // Hurt warning
  if(this.hurt){
    var p=Math.sin(this.frame*0.08)*0.3+0.7;
    ctx.fillStyle='rgba(255,80,80,'+p+')';ctx.font='bold 16px sans-serif';ctx.textAlign='center';
    ctx.fillText('Injured! Press [4] to bandage',W/2,40);ctx.textAlign='left';
  }

  // ---- MAP button (top-left below bars) ----
  var isForkPaused=this.paused&&seg&&seg.fork&&!this.forkDone;
  var mapBX=x0,mapBY=y0+gap*5+bh+10,mapBW=bw,mapBH=42;
  ctx.fillStyle=isForkPaused?'rgba(255,215,0,0.15)':'rgba(0,0,0,0.55)';
  ctx.fillRect(mapBX,mapBY,mapBW,mapBH);
  var forkAlpha=Math.sin(this.frame*0.12)*0.5+0.5;
  ctx.strokeStyle=isForkPaused?'rgba(255,215,0,'+(0.5+forkAlpha*0.3)+')':'rgba(255,215,0,0.5)';
  ctx.lineWidth=isForkPaused?2.5:1.5;
  ctx.strokeRect(mapBX,mapBY,mapBW,mapBH);
  if(isForkPaused){
    ctx.fillStyle='rgba(255,215,0,'+(0.6+forkAlpha*0.4)+')';
    ctx.font='bold 14px sans-serif';ctx.textAlign='center';
    ctx.fillText('\uD83D\uDDFA\uFE0F MAP [M]',mapBX+mapBW/2,mapBY+15);
    ctx.fillStyle='rgba(255,255,255,'+(0.6+forkAlpha*0.4)+')';
    ctx.font='11px sans-serif';
    ctx.fillText('View trail overview',mapBX+mapBW/2,mapBY+32);
  }else{
    var gpsRemain=this.gpsOn?Math.ceil(this.gpsT/60):CFG.GPS_TIME/60;
    ctx.fillStyle='#CCC';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
    ctx.fillText('\uD83D\uDDFA\uFE0F MAP ['+gpsRemain+'s]',mapBX+mapBW/2,mapBY+16);
    ctx.fillStyle='#888';ctx.font='11px sans-serif';
    ctx.fillText('Press [M] to open',mapBX+mapBW/2,mapBY+32);
  }
  ctx.textAlign='left';

  // Fork: full-screen Y-shaped popup (both paths identical, no hints)
  var isForkChoosing=isForkPaused&&!this.forkWrong;
  if(isForkChoosing&&this.track[this.seg]&&this.track[this.seg].fork&&!this.forkDone){
    this._drawForkChoice(ctx,W,H,this.track[this.seg]);
  }

  // Fork wrong: small side indicator (not forced)
  if(this.forkWrong){
    var scPulse=Math.sin(this.frame*0.1)*0.3+0.7;
    ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(W-210,154,194,42);
    ctx.strokeStyle='rgba(255,120,40,'+(0.5+scPulse*0.3)+')';ctx.lineWidth=2;
    ctx.strokeRect(W-210,154,194,42);
    ctx.fillStyle='rgba(255,120,40,'+scPulse+')';ctx.font='bold 15px monospace';ctx.textAlign='center';
    ctx.fillText('\u26A0 SHORTCUT',W-113,172);
    ctx.fillStyle='#FFF';ctx.font='12px monospace';
    ctx.fillText('[B] Back (+20s time cost)',W-113,190);
    ctx.textAlign='left';
  }
};

// ---- Fork Choice Y popup (both paths neutral) ----
Game.prototype._drawForkChoice=function(ctx,W,H,segNow){
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);

  var yCy=H*0.55,yNodeX=W/2,yNodeY=yCy;
  var branchLen=190,branchAngle=0.55;

  // Trunk
  ctx.strokeStyle='#B89060';ctx.lineWidth=30;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(yNodeX,yNodeY);ctx.lineTo(yNodeX,H-20);ctx.stroke();
  ctx.strokeStyle='#C9A87A';ctx.lineWidth=22;
  ctx.beginPath();ctx.moveTo(yNodeX,yNodeY);ctx.lineTo(yNodeX,H-20);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=2;
  ctx.setLineDash([10,8]);
  ctx.beginPath();ctx.moveTo(yNodeX,yNodeY);ctx.lineTo(yNodeX,H-20);ctx.stroke();
  ctx.setLineDash([]);

  var lEndX=yNodeX-Math.sin(branchAngle)*branchLen;
  var lEndY=yNodeY-Math.cos(branchAngle)*branchLen;
  var rEndX=yNodeX+Math.sin(branchAngle)*branchLen;
  var rEndY=yNodeY-Math.cos(branchAngle)*branchLen;

  // Left branch (neutral)
  ctx.strokeStyle='#B89060';ctx.lineWidth=24;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(yNodeX,yNodeY);ctx.lineTo(lEndX,lEndY);ctx.stroke();
  ctx.strokeStyle='#C9A87A';ctx.lineWidth=16;
  ctx.beginPath();ctx.moveTo(yNodeX,yNodeY);ctx.lineTo(lEndX,lEndY);ctx.stroke();

  // Right branch (neutral, identical to left)
  ctx.strokeStyle='#B89060';ctx.lineWidth=24;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(yNodeX,yNodeY);ctx.lineTo(rEndX,rEndY);ctx.stroke();
  ctx.strokeStyle='#C9A87A';ctx.lineWidth=16;
  ctx.beginPath();ctx.moveTo(yNodeX,yNodeY);ctx.lineTo(rEndX,rEndY);ctx.stroke();

  ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(yNodeX,yNodeY,12,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,215,0,0.8)';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(yNodeX,yNodeY,14,0,Math.PI*2);ctx.stroke();

  ctx.fillStyle='#FFF';ctx.font='bold 28px sans-serif';ctx.textAlign='center';
  ctx.fillText('\u25C0',lEndX-50,lEndY+8);
  ctx.fillText('\u25B6',rEndX+50,rEndY+8);

  ctx.font='bold 20px sans-serif';
  ctx.fillStyle='#FFF';
  ctx.fillText('LEFT',lEndX-55,lEndY-55);
  ctx.fillText('RIGHT',rEndX+55,rEndY-55);

  ctx.fillStyle='#FFD700';ctx.font='bold 36px sans-serif';ctx.textAlign='center';
  ctx.fillText('FORK! Choose Path',W/2,yNodeY-branchLen-70);

  ctx.fillStyle='#FFF';ctx.font='18px sans-serif';
  ctx.fillText('Press  \u2190  or  \u2192  to choose',W/2,yNodeY-branchLen-35);

  ctx.textAlign='left';
};

// ---- Fork Wrong: Turn back or Keep going ----
Game.prototype._drawForkWrong=function(ctx,W,H){
  ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(0,0,W,H);

  // Title
  var pulse=Math.sin(this.frame*0.08)*0.4+0.6;
  ctx.fillStyle='rgba(255,80,40,'+pulse+')';ctx.font='bold 38px sans-serif';ctx.textAlign='center';
  ctx.fillText('\u26A0 Wrong Way!',W/2,H*0.3);

  ctx.fillStyle='rgba(255,255,255,0.9)';ctx.font='20px sans-serif';
  ctx.fillText('This path is not the main trail.',W/2,H*0.38);

  // Two option cards side by side
  var cardW=280,cardH=140,cardGap=40,cardY=H*0.44;
  var leftCX=W/2-cardW/2-cardGap/2;
  var rightCX=W/2+cardW/2+cardGap/2;

  // Left card: Turn back
  var lbp=Math.sin(this.frame*0.06)*0.2+0.8;
  ctx.fillStyle='rgba(40,100,40,0.7)';
  ctx.fillRect(leftCX-cardW/2,cardY-cardH/2,cardW,cardH);
  ctx.strokeStyle='rgba(100,200,100,'+lbp+')';ctx.lineWidth=3;
  ctx.strokeRect(leftCX-cardW/2,cardY-cardH/2,cardW,cardH);

  ctx.fillStyle='#44DD44';ctx.font='bold 24px sans-serif';
  ctx.fillText('[B] Turn Back',leftCX,cardY-30);
  ctx.fillStyle='#FFF';ctx.font='14px sans-serif';
  ctx.fillText('\u21A9 Return to fork',leftCX,cardY-2);
  ctx.fillText('\u2713 No penalty to score',leftCX,cardY+20);

  // Right card: Keep going
  var rbp=Math.sin(this.frame*0.06+1)*0.2+0.8;
  ctx.fillStyle='rgba(100,40,0,0.7)';
  ctx.fillRect(rightCX-cardW/2,cardY-cardH/2,cardW,cardH);
  ctx.strokeStyle='rgba(255,150,50,'+rbp+')';ctx.lineWidth=3;
  ctx.strokeRect(rightCX-cardW/2,cardY-cardH/2,cardW,cardH);

  ctx.fillStyle='#FFAA44';ctx.font='bold 24px sans-serif';
  ctx.fillText('[K] Keep Going',rightCX,cardY-30);
  ctx.fillStyle='#FFF';ctx.font='14px sans-serif';
  ctx.fillText('\u26A1 Saves time',rightCX,cardY-2);
  ctx.fillStyle='#FF6644';ctx.font='14px sans-serif';
  ctx.fillText('\u2717 -20 score (shortcut)',rightCX,cardY+20);

  // Bottom hint
  ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='14px sans-serif';
  ctx.fillText('Press B or K to decide',W/2,H*0.72);
  ctx.textAlign='left';
};

Game.prototype._bar=function(ctx,x,y,w,h,v,mx,clr,lb){
  ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(x,y,w,h);
  var pct=Math.max(0,v/mx);
  var g=ctx.createLinearGradient(x,y,x+w*pct,y);
  g.addColorStop(0,clr);g.addColorStop(1,lightenC(clr));
  ctx.fillStyle=g;ctx.fillRect(x,y,w*pct,h);
  ctx.strokeStyle='#FFF';ctx.lineWidth=0.5;ctx.strokeRect(x,y,w,h);
  ctx.fillStyle='#FFF';ctx.font='10px sans-serif';
  ctx.fillText(lb+' '+Math.floor(v),x+4,y+h-2);
};

// ======================== GPS Map ========================
Game.prototype._gps=function(ctx,W,H){
  ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,W,H);
  var mx=W*0.1,my=H*0.08,mw=W*0.8,mh=H*0.78;
  ctx.fillStyle='#2E5A1E';ctx.fillRect(mx,my,mw,mh);
  ctx.strokeStyle='#FFF';ctx.lineWidth=2;ctx.strokeRect(mx,my,mw,mh);

  var isForkPaused=this.paused&&this.track[this.seg]&&this.track[this.seg].fork&&!this.forkDone;
  if(isForkPaused){
    ctx.fillStyle='rgba(255,215,0,0.15)';ctx.fillRect(mx,my,mw,28);
    ctx.fillStyle='#FFD700';ctx.font='bold 22px sans-serif';ctx.fillText('GPS',mx+14,my-6);
    ctx.fillStyle='#FFF';ctx.font='13px sans-serif';ctx.fillText('Gold dots = fork points. Both paths lead forward.',mx+mw/2-120,my+20);
    my+=34;mh-=34;
  }else{
    ctx.fillStyle='#FFD700';ctx.font='bold 22px sans-serif';ctx.fillText('GPS',mx+14,my-6);
  }

  var sx=mw/(CFG.SEGMENTS+1);
  ctx.lineWidth=4;ctx.lineCap='round';
  for(var i=0;i<CFG.SEGMENTS;i++){
    var seg=this.track[i];
    var x1=mx+20+i*sx,x2=mx+20+(i+1)*sx;
    var y1=my+mh*0.55-(i*10%60)+Math.sin(i*0.6)*25;
    var y2=my+mh*0.55-((i+1)*10%60)+Math.sin((i+1)*0.6)*25;

    if(i<this.seg)ctx.strokeStyle='#44DD44';
    else if(i===this.seg)ctx.strokeStyle='#FFD700';
    else ctx.strokeStyle='#777';
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();

    if(seg.fork){
      ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(x2,y2,5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(255,215,0,0.5)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(x2,y2,8,0,Math.PI*2);ctx.stroke();
    }
    if(seg.supply){ctx.fillStyle='#FF6347';ctx.beginPath();ctx.arc(x2,y2,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#FFF';ctx.font='8px sans-serif';ctx.fillText('S',x2-3,y2+3);}
    if(seg.cliff){ctx.fillStyle='#F33';ctx.font='bold 11px sans-serif';ctx.fillText('!',x2-3,y2+4);}
  }

  var fex=mx+20+(CFG.SEGMENTS-1)*sx,fey=my+mh*0.55-((CFG.SEGMENTS-1)*10%60)+Math.sin((CFG.SEGMENTS-1)*0.6)*25;
  ctx.fillStyle='#F00';ctx.fillRect(fex+10,fey-18,3,18);ctx.fillStyle='#FFF';ctx.fillRect(fex+13,fey-18,12,7);
  ctx.fillStyle='#FFD700';ctx.font='12px sans-serif';ctx.fillText('FINISH',fex-4,fey+24);

  var px=mx+20+this.seg*sx+this.prog*sx,py=my+mh*0.55-(this.seg*10%60)+Math.sin(this.seg*0.6)*25;
  ctx.fillStyle='#00BFFF';ctx.beginPath();ctx.arc(px,py,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#FFF';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,'+(Math.sin(this.frame*0.1)*0.3+0.7)+')';ctx.font='13px sans-serif';ctx.textAlign='center';
  ctx.fillText('YOU',px,py+22);ctx.textAlign='left';
};

// ======================== Finish (playing overlay) ========================
Game.prototype._finish=function(ctx,W,H){
  ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#FFD700';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.fillText('FINISH!',W/2,H*0.33);
  ctx.fillStyle='#FFF';ctx.font='20px sans-serif';
  ctx.fillText('Distance: '+Math.floor(this.miles)+'m   Climb: '+Math.floor(this.elev)+'m',W/2,H*0.44);
  var mn=Math.floor(this.time/60),sc=Math.floor(this.time%60);
  ctx.fillText('Time: '+mn+'m '+sc+'s',W/2,H*0.5);
  ctx.font='18px sans-serif';ctx.fillStyle='#AAA';ctx.fillText('Press R to restart',W/2,H*0.68);ctx.textAlign='left';
};

// ======================== Boot ========================
window.addEventListener('DOMContentLoaded',function(){
  var cv=document.getElementById('gameCanvas');if(!cv)return;
  cv.width=960;cv.height=540;
  var g=new Game(cv);
  function loop(){
    try{g.tick();g.scroll+=g.spd*0.5;g.draw();}
    catch(e){g.error=e.message;var ctx=cv.getContext('2d');ctx.fillStyle='#300';ctx.fillRect(0,0,960,540);ctx.fillStyle='#F44';ctx.font='16px sans-serif';ctx.fillText('Error: '+e.message,20,50);ctx.fillText(e.stack||'',20,80);}
    requestAnimationFrame(loop);
  }
  loop();
  function b(id,k){var el=document.getElementById(id);if(el)el.addEventListener('click',function(){g.press(k);});}
  b('btnSalt','1');b('btnGel','2');b('btnWater','3');b('btnWound','4');b('btnGps','m');
  var rb=document.getElementById('btnRestart');if(rb)rb.addEventListener('click',function(){g.startLevel(g.currentLevel);});
});
