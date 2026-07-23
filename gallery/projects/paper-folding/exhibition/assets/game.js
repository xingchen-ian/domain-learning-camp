/* ============================================================
   折·Fold — 精度折纸游戏引擎
   Track A: 纯 JavaScript + Canvas 2D，无依赖、无构建步骤
   ============================================================ */

/* ---------- 几何函数 ---------- */
// 折线 line = {ax, ay, bx, by}（无限直线）
function sideOf(p, line) {
  return (line.bx - line.ax) * (p.y - line.ay) - (line.by - line.ay) * (p.x - line.ax);
}
function reflectPoint(p, line) {
  const dx = line.bx - line.ax, dy = line.by - line.ay;
  const len2 = dx * dx + dy * dy || 1e-9;
  const t = ((p.x - line.ax) * dx + (p.y - line.ay) * dy) / len2;
  const px = line.ax + t * dx, py = line.ay + t * dy; // 投影点
  return { x: 2 * px - p.x, y: 2 * py - p.y };
}
function segIntersect(s, e, line) {
  // 线段 s-e 与无限直线 line 的交点
  const dx = e.x - s.x, dy = e.y - s.y;
  const ldx = line.bx - line.ax, ldy = line.by - line.ay;
  const denom = dx * ldy - dy * ldx; // cross(线段方向, 直线方向)
  if (Math.abs(denom) < 1e-9) return { x: s.x, y: s.y };
  const t = ((line.ax - s.x) * ldy + (s.y - line.ay) * ldx) / denom;
  return { x: s.x + t * dx, y: s.y + t * dy };
}
// 裁剪多边形到 line 的 keepSign 侧（keepSign*sideOf >= 0 保留）
function clipPoly(poly, line, keepSign) {
  const out = [];
  const n = poly.length;
  if (n === 0) return out;
  for (let i = 0; i < n; i++) {
    const s = poly[i], e = poly[(i + 1) % n];
    const ds = sideOf(s, line) * keepSign;
    const de = sideOf(e, line) * keepSign;
    const sIn = ds >= -1e-9, eIn = de >= -1e-9;
    if (eIn) {
      if (!sIn) out.push(segIntersect(s, e, line));
      out.push(e);
    } else if (sIn) {
      out.push(segIntersect(s, e, line));
    }
  }
  return out;
}
function reflectPoly(poly, line) {
  return poly.map((p) => reflectPoint(p, line));
}
function lerpPoly(a, b, t) {
  const n = Math.max(a.length, b.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const pa = a[Math.min(i, a.length - 1)] || a[a.length - 1];
    const pb = b[Math.min(i, b.length - 1)] || b[b.length - 1];
    out.push({ x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t });
  }
  return out;
}
function polyBBox(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/* ---------- 关卡数据 ----------
   纸空间：0..300 的正方形，左上角 (0,0)
   每折：line 折线, grab 折角起点(在翻折侧), hint 提示
   target = reflectPoint(grab, line)，flipSign = sign(sideOf(grab, line))
*/
const PAPER = 300;
const LEVELS = [
  { name:'方寸', en:'Square', diff:'E', intro:'从最基础的对折开始，感受精度与累积。', foldsDef:[
    { line:{ax:150,ay:0,bx:150,by:300}, grab:{x:0,y:150}, hint:'沿中线对折' },
    { line:{ax:0,ay:150,bx:300,by:150}, grab:{x:150,y:0}, hint:'沿中线对折' }
  ]},
  { name:'三角', en:'Triangle', diff:'E', intro:'一折成三角，最简洁的形态变化。', foldsDef:[
    { line:{ax:0,ay:0,bx:300,by:300}, grab:{x:300,y:0}, hint:'沿斜线折叠' }
  ]},
  { name:'信封', en:'Envelope', diff:'E', intro:'四角向中心收拢，折出信封雏形。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:75,ay:-75,bx:375,by:225}, grab:{x:300,y:0}, hint:'把右上角折到中心' },
    { line:{ax:375,ay:75,bx:75,by:375}, grab:{x:300,y:300}, hint:'把右下角折到中心' },
    { line:{ax:225,ay:375,bx:-75,by:75}, grab:{x:0,y:300}, hint:'把左下角折到中心' }
  ]},
  { name:'书页', en:'Book', diff:'E', intro:'对折再对折，像翻书页一样层层叠合。', foldsDef:[
    { line:{ax:0,ay:150,bx:300,by:150}, grab:{x:150,y:0}, hint:'沿中线对折' },
    { line:{ax:150,ay:0,bx:150,by:300}, grab:{x:0,y:150}, hint:'沿中线对折' },
    { line:{ax:225,ay:0,bx:225,by:300}, grab:{x:150,y:225}, hint:'沿竖线 x=225 折叠' }
  ]},
  { name:'纸帽', en:'Hat', diff:'M', intro:'底边上折做帽檐，两角收尖做帽顶。', foldsDef:[
    { line:{ax:0,ay:225,bx:300,by:225}, grab:{x:150,y:300}, hint:'沿横线 y=225 折叠' },
    { line:{ax:0,ay:187.5,bx:150,by:-112.5}, grab:{x:0,y:0}, hint:'把左上角折到中上' },
    { line:{ax:150,ay:-112.5,bx:300,by:187.5}, grab:{x:300,y:0}, hint:'把右上角折到中上' }
  ]},
  { name:'房子', en:'House', diff:'M', intro:'两角下折做屋顶，底边上折做门基。', foldsDef:[
    { line:{ax:-25,ay:200,bx:175,by:-100}, grab:{x:0,y:0}, hint:'把左上角折到中上' },
    { line:{ax:125,ay:-100,bx:325,by:200}, grab:{x:300,y:0}, hint:'把右上角折到中上' },
    { line:{ax:0,ay:250,bx:300,by:250}, grab:{x:150,y:300}, hint:'沿横线 y=250 折叠' }
  ]},
  { name:'箭头', en:'Arrow', diff:'M', intro:'两角收向中心做箭头，右侧收窄做箭杆。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:225,ay:375,bx:-75,by:75}, grab:{x:0,y:300}, hint:'把左下角折到中心' },
    { line:{ax:225,ay:0,bx:225,by:300}, grab:{x:150,y:150}, hint:'沿竖线 x=225 折叠' }
  ]},
  { name:'纸船', en:'Boat', diff:'M', intro:'两角到中心做船头，底边上折做船底。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:75,ay:-75,bx:375,by:225}, grab:{x:300,y:0}, hint:'把右上角折到中心' },
    { line:{ax:0,ay:225,bx:300,by:225}, grab:{x:150,y:300}, hint:'沿横线 y=225 折叠' }
  ]},
  { name:'纸杯', en:'Cup', diff:'M', intro:'对角折成三角，两底角折向顶点做杯口。', foldsDef:[
    { line:{ax:0,ay:0,bx:300,by:300}, grab:{x:300,y:0}, hint:'沿斜线折叠' },
    { line:{ax:225,ay:375,bx:-75,by:75}, grab:{x:0,y:300}, hint:'把左下角折到中心' },
    { line:{ax:375,ay:75,bx:75,by:375}, grab:{x:300,y:300}, hint:'把右下角折到中心' }
  ]},
  { name:'小鱼', en:'Fish', diff:'M', intro:'左侧两角到中心做鱼头，右侧两角内收做鱼尾。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:225,ay:375,bx:-75,by:75}, grab:{x:0,y:300}, hint:'把左下角折到中心' },
    { line:{ax:112.5,ay:0,bx:412.5,by:150}, grab:{x:300,y:0}, hint:'把右上角折到中右' },
    { line:{ax:412.5,ay:150,bx:112.5,by:300}, grab:{x:300,y:300}, hint:'把右下角折到中右' }
  ]},
  { name:'纸飞机', en:'Plane', diff:'H', intro:'两角到中线做机头，对折做机身，收角做机翼。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:75,ay:-75,bx:375,by:225}, grab:{x:300,y:0}, hint:'把右上角折到中心' },
    { line:{ax:150,ay:0,bx:150,by:300}, grab:{x:0,y:150}, hint:'沿中线对折' },
    { line:{ax:412.5,ay:150,bx:112.5,by:300}, grab:{x:300,y:300}, hint:'把右下角折到中右' }
  ]},
  { name:'蝴蝶', en:'Butterfly', diff:'H', intro:'左右四角收尖做双翅，中线折出身体。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:225,ay:375,bx:-75,by:75}, grab:{x:0,y:300}, hint:'把左下角折到中心' },
    { line:{ax:75,ay:-75,bx:375,by:225}, grab:{x:300,y:0}, hint:'把右上角折到中心' },
    { line:{ax:375,ay:75,bx:75,by:375}, grab:{x:300,y:300}, hint:'把右下角折到中心' },
    { line:{ax:0,ay:225,bx:300,by:225}, grab:{x:150,y:150}, hint:'沿横线 y=225 折叠' }
  ]},
  { name:'心形', en:'Heart', diff:'H', intro:'上两角下折做心瓣，下两角收拢做心尖。', foldsDef:[
    { line:{ax:0,ay:187.5,bx:150,by:-112.5}, grab:{x:0,y:0}, hint:'把左上角折到中上' },
    { line:{ax:150,ay:-112.5,bx:300,by:187.5}, grab:{x:300,y:0}, hint:'把右上角折到中上' },
    { line:{ax:150,ay:412.5,bx:0,by:112.5}, grab:{x:0,y:300}, hint:'把左下角折到中下' },
    { line:{ax:300,ay:112.5,bx:150,by:412.5}, grab:{x:300,y:300}, hint:'把右下角折到中下' }
  ]},
  { name:'四角星', en:'Star', diff:'H', intro:'四角分别向中上、中下收拢，折出四尖。', foldsDef:[
    { line:{ax:0,ay:187.5,bx:150,by:-112.5}, grab:{x:0,y:0}, hint:'把左上角折到中上' },
    { line:{ax:150,ay:-112.5,bx:300,by:187.5}, grab:{x:300,y:0}, hint:'把右上角折到中上' },
    { line:{ax:150,ay:412.5,bx:0,by:112.5}, grab:{x:0,y:300}, hint:'把左下角折到中下' },
    { line:{ax:300,ay:112.5,bx:150,by:412.5}, grab:{x:300,y:300}, hint:'把右下角折到中下' }
  ]},
  { name:'树叶', en:'Leaf', diff:'H', intro:'四角折到中心收尖，中线折出叶脉。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:375,ay:75,bx:75,by:375}, grab:{x:300,y:300}, hint:'把右下角折到中心' },
    { line:{ax:225,ay:375,bx:-75,by:75}, grab:{x:0,y:300}, hint:'把左下角折到中心' },
    { line:{ax:75,ay:-75,bx:375,by:225}, grab:{x:300,y:0}, hint:'把右上角折到中心' },
    { line:{ax:0,ay:150,bx:300,by:150}, grab:{x:150,y:0}, hint:'沿中线对折' }
  ]},
  { name:'钻石', en:'Diamond', diff:'H', intro:'四角到中心收成菱形，对折出立体感。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:75,ay:-75,bx:375,by:225}, grab:{x:300,y:0}, hint:'把右上角折到中心' },
    { line:{ax:225,ay:375,bx:-75,by:75}, grab:{x:0,y:300}, hint:'把左下角折到中心' },
    { line:{ax:375,ay:75,bx:75,by:375}, grab:{x:300,y:300}, hint:'把右下角折到中心' },
    { line:{ax:0,ay:150,bx:300,by:150}, grab:{x:150,y:0}, hint:'沿中线对折' }
  ]},
  { name:'纸鹤', en:'Bird', diff:'X', intro:'经典千纸鹤：两角到中心，对折收身，折出头颈与翅膀。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:75,ay:-75,bx:375,by:225}, grab:{x:300,y:0}, hint:'把右上角折到中心' },
    { line:{ax:150,ay:0,bx:150,by:300}, grab:{x:0,y:150}, hint:'沿中线对折' },
    { line:{ax:412.5,ay:150,bx:112.5,by:300}, grab:{x:300,y:300}, hint:'把右下角折到中右' },
    { line:{ax:225,ay:150,bx:300,by:225}, grab:{x:225,y:225}, hint:'沿斜线折叠' }
  ]},
  { name:'燕子', en:'Swallow', diff:'X', intro:'左侧收尖做头，右侧两角做双翅，尾部对折出叉尾。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:225,ay:375,bx:-75,by:75}, grab:{x:0,y:300}, hint:'把左下角折到中心' },
    { line:{ax:112.5,ay:0,bx:412.5,by:150}, grab:{x:300,y:0}, hint:'把右上角折到中右' },
    { line:{ax:412.5,ay:150,bx:112.5,by:300}, grab:{x:300,y:300}, hint:'把右下角折到中右' },
    { line:{ax:262,ay:0,bx:262,by:300}, grab:{x:225,y:150}, hint:'沿竖线 x=262 折叠' },
    { line:{ax:262,ay:225,bx:300,by:225}, grab:{x:281,y:150}, hint:'沿横线 y=225 折叠' }
  ]},
  { name:'花朵', en:'Bloom', diff:'X', intro:'四角折出花瓣，底部收折做花茎。', foldsDef:[
    { line:{ax:0,ay:187.5,bx:150,by:-112.5}, grab:{x:0,y:0}, hint:'把左上角折到中上' },
    { line:{ax:150,ay:-112.5,bx:300,by:187.5}, grab:{x:300,y:0}, hint:'把右上角折到中上' },
    { line:{ax:150,ay:412.5,bx:0,by:112.5}, grab:{x:0,y:300}, hint:'把左下角折到中下' },
    { line:{ax:300,ay:112.5,bx:150,by:412.5}, grab:{x:300,y:300}, hint:'把右下角折到中下' },
    { line:{ax:0,ay:225,bx:300,by:225}, grab:{x:150,y:300}, hint:'沿横线 y=225 折叠' }
  ]},
  { name:'皇冠', en:'Crown', diff:'X', intro:'顶边下折做冠带，三角上折做冠尖，收底定型。', foldsDef:[
    { line:{ax:0,ay:100,bx:300,by:100}, grab:{x:150,y:0}, hint:'沿横线 y=100 折叠' },
    { line:{ax:150,ay:350,bx:-50,by:150}, grab:{x:0,y:300}, hint:'把左下角折到左下偏中' },
    { line:{ax:350,ay:150,bx:150,by:350}, grab:{x:300,y:300}, hint:'把右下角折到右下偏中' },
    { line:{ax:275,ay:237.5,bx:25,by:237.5}, grab:{x:150,y:300}, hint:'把下边中点折到中下方' },
    { line:{ax:0,ay:250,bx:300,by:250}, grab:{x:150,y:225}, hint:'沿横线 y=250 折叠' }
  ]},
  { name:'宝盒', en:'Box', diff:'X', intro:'四角到中心做盒底，中线对折做盒壁。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:75,ay:-75,bx:375,by:225}, grab:{x:300,y:0}, hint:'把右上角折到中心' },
    { line:{ax:225,ay:375,bx:-75,by:75}, grab:{x:0,y:300}, hint:'把左下角折到中心' },
    { line:{ax:375,ay:75,bx:75,by:375}, grab:{x:300,y:300}, hint:'把右下角折到中心' },
    { line:{ax:0,ay:150,bx:300,by:150}, grab:{x:150,y:0}, hint:'沿中线对折' }
  ]},
  { name:'蜻蜓', en:'Dragonfly', diff:'X', intro:'对折打底，上下前角折出四翅，收尖做尾。', foldsDef:[
    { line:{ax:150,ay:0,bx:150,by:300}, grab:{x:0,y:150}, hint:'沿中线对折' },
    { line:{ax:112.5,ay:112.5,bx:262.5,by:-37.5}, grab:{x:150,y:0}, hint:'把上边中点折到右上偏中' },
    { line:{ax:262.5,ay:337.5,bx:112.5,by:187.5}, grab:{x:150,y:300}, hint:'把下边中点折到右下偏中' },
    { line:{ax:131,ay:37,bx:431,by:113}, grab:{x:300,y:0}, hint:'把右上角折到右1/4处' },
    { line:{ax:431,ay:187,bx:131,by:263}, grab:{x:300,y:300}, hint:'把右下角折到右1/4处' },
    { line:{ax:262,ay:0,bx:262,by:300}, grab:{x:225,y:150}, hint:'沿竖线 x=262 折叠' }
  ]},
  { name:'鹤舞', en:'CraneDance', diff:'Z', intro:'宗师级千纸鹤：两角到中心收身，对折后折出长颈，多次展翅定型。', foldsDef:[
    { line:{ax:-75,ay:225,bx:225,by:-75}, grab:{x:0,y:0}, hint:'把左上角折到中心' },
    { line:{ax:75,ay:-75,bx:375,by:225}, grab:{x:300,y:0}, hint:'把右上角折到中心' },
    { line:{ax:150,ay:0,bx:150,by:300}, grab:{x:0,y:150}, hint:'沿中线对折' },
    { line:{ax:412.5,ay:150,bx:112.5,by:300}, grab:{x:300,y:300}, hint:'把右下角折到中右' },
    { line:{ax:225,ay:150,bx:300,by:225}, grab:{x:225,y:225}, hint:'沿斜线折叠' },
    { line:{ax:225,ay:75,bx:300,by:150}, grab:{x:262,y:112}, hint:'沿斜线折叠' },
    { line:{ax:262,ay:112,bx:300,by:150}, grab:{x:281,y:131}, hint:'沿斜线折叠' }
  ]},
  { name:'宝塔', en:'Pagoda', diff:'Z', intro:'宗师级宝塔：上两角收尖做塔顶，多层横折做塔檐，层层叠叠。', foldsDef:[
    { line:{ax:0,ay:187.5,bx:150,by:-112.5}, grab:{x:0,y:0}, hint:'把左上角折到中上' },
    { line:{ax:150,ay:-112.5,bx:300,by:187.5}, grab:{x:300,y:0}, hint:'把右上角折到中上' },
    { line:{ax:0,ay:225,bx:300,by:225}, grab:{x:150,y:250}, hint:'沿横线 y=225 折叠' },
    { line:{ax:0,ay:180,bx:300,by:180}, grab:{x:150,y:200}, hint:'沿横线 y=180 折叠' },
    { line:{ax:0,ay:140,bx:300,by:140}, grab:{x:150,y:160}, hint:'沿横线 y=140 折叠' },
    { line:{ax:0,ay:110,bx:300,by:110}, grab:{x:150,y:120}, hint:'沿横线 y=110 折叠' },
    { line:{ax:150,ay:75,bx:150,by:110}, grab:{x:140,y:90}, hint:'沿中线对折' },
    { line:{ax:112,ay:90,bx:187,by:90}, grab:{x:150,y:100}, hint:'沿横线 y=90 折叠' }
  ]},
];

/* ---------- 游戏主体 ---------- */
class FoldGame {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hud = hud;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = 0; this.H = 0;
    this.view = { scale: 1, ox: 0, oy: 0 };
    this.viewTarget = this.view;
    this.viewAnim = 1;
    this.state = 'start';
    this.bindInput();
    this.resetLevel(0);
    this.bindResize();
    this.lastT = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  bindResize() {
    const resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * this.dpr;
      this.canvas.height = rect.height * this.dpr;
      this.W = rect.width; this.H = rect.height;
      this.fitView();
    };
    window.addEventListener('resize', resize);
    this._resize = resize;
    resize();
  }

  /* 视角：把纸空间拟合到画布 */
  fitView(animate = false) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const layer of this.layers) {
      const b = polyBBox(layer.poly);
      minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = PAPER; maxY = PAPER; }
    const bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1);
    const pad = 90;
    const scale = Math.min((this.W - pad) / bw, (this.H - pad) / bh);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const target = { scale, ox: this.W / 2 - cx * scale, oy: this.H / 2 - cy * scale };
    if (animate) { this.viewTarget = target; this.viewAnim = 0; }
    else { this.view = target; this.viewTarget = target; }
  }

  resetLevel(idx) {
    this.levelIndex = idx;
    const lv = LEVELS[idx];
    this.foldIndex = 0;
    this.precisions = [];
    this.layers = [{ poly: [{ x: 0, y: 0 }, { x: PAPER, y: 0 }, { x: PAPER, y: PAPER }, { x: 0, y: PAPER }], side: 0 }];
    this.creases = []; // 已完成折痕 {a,b}
    this.dragging = false;
    this.grabPos = null; // 当前拖动到的纸空间位置
    this.foldP = 0; // 当前折动画进度
    this.commitP = 0; // 提交动画进度
    this.state = 'playing';
    this.fitView();
    this.updateHud();
  }

  get currentFold() {
    return LEVELS[this.levelIndex].foldsDef[this.foldIndex];
  }
  get target() {
    return reflectPoint(this.currentFold.grab, this.currentFold.line);
  }

  /* 纸空间 <-> 画布 */
  toCanvas(p) { return { x: this.view.ox + p.x * this.view.scale, y: this.view.oy + p.y * this.view.scale }; }
  toPaper(p) { return { x: (p.x - this.view.ox) / this.view.scale, y: (p.y - this.view.oy) / this.view.scale }; }

  bindInput() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      return { x: cx, y: cy };
    };
    const down = (e) => {
      if (this.state !== 'playing') return;
      const grabC = this.toCanvas(this.currentFold.grab);
      const pos = getPos(e);
      if (Math.hypot(pos.x - grabC.x, pos.y - grabC.y) < 34) {
        this.dragging = true;
        this.grabPos = this.toPaper(pos);
        this.foldP = this.calcP(this.grabPos);
        e.preventDefault();
      }
    };
    const move = (e) => {
      if (!this.dragging) return;
      const pos = getPos(e);
      let pp = this.toPaper(pos);
      // 吸附到目标
      const t = this.target;
      if (Math.hypot(pp.x - t.x, pp.y - t.y) < 16 / this.view.scale) pp = { x: t.x, y: t.y };
      this.grabPos = pp;
      this.foldP = this.calcP(pp);
      e.preventDefault();
    };
    const up = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.commitFold();
      e.preventDefault();
    };
    this.canvas.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    this.canvas.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up, { passive: false });
    this._down = down; this._move = move; this._up = up;
  }

  calcP(grabPos) {
    const start = this.currentFold.grab, t = this.target;
    const dx = t.x - start.x, dy = t.y - start.y;
    const len2 = dx * dx + dy * dy || 1e-9;
    const proj = ((grabPos.x - start.x) * dx + (grabPos.y - start.y) * dy) / len2;
    return Math.max(0, Math.min(1, proj));
  }

  /* 提交一折：精度由释放时 grab 到 target 的距离决定 */
  commitFold() {
    const start = this.currentFold.grab, t = this.target;
    const dist = this.grabPos ? Math.hypot(this.grabPos.x - t.x, this.grabPos.y - t.y) : Math.hypot(start.x - t.x, start.y - t.y);
    const fullLen = Math.hypot(t.x - start.x, t.y - start.y) || 1;
    let precision = 100 * (1 - Math.min(dist / fullLen, 1));
    precision = Math.max(35, Math.round(precision));
    this.lastPrecision = precision;
    this.precisions.push(precision);
    // 进入提交动画
    this.state = 'animating';
    this.commitP = this.foldP;
    this.commitStart = performance.now();
  }

  finalizeFold() {
    const fold = this.currentFold;
    const line = fold.line;
    const flipSign = Math.sign(sideOf(fold.grab, line)) || 1;
    const keepSign = -flipSign;
    const newLayers = [];
    const flipped = [];
    for (const layer of this.layers) {
      const keepPart = clipPoly(layer.poly, line, keepSign);
      const flipPart = clipPoly(layer.poly, line, flipSign);
      if (keepPart.length >= 3) newLayers.push({ poly: keepPart, side: layer.side });
      if (flipPart.length >= 3) {
        const reflected = reflectPoly(flipPart, line);
        flipped.push({ poly: reflected, side: 1 - layer.side });
      }
    }
    newLayers.push(...flipped);
    this.layers = newLayers;
    // 记录折痕（折线在纸上的可见段：用 grab 与 target 的中点附近，或折线与纸包围盒交点）
    this.creases.push({ line: { ...line } });
    this.foldIndex++;
    this.foldP = 0;
    this.grabPos = null;
    this.fitView(true);
    if (this.foldIndex >= LEVELS[this.levelIndex].foldsDef.length) {
      this.state = 'levelDone';
    } else {
      this.state = 'playing';
    }
    this.updateHud();
  }

  cumulative() {
    if (!this.precisions.length) return 100;
    let p = 1;
    for (const v of this.precisions) p *= v / 100;
    return Math.round(p * 100);
  }
  rating(c) { return c >= 95 ? 'S' : c >= 85 ? 'A' : c >= 70 ? 'B' : 'C'; }

  updateHud() {
    const lv = LEVELS[this.levelIndex];
    if (this.hud.levelName) this.hud.levelName.textContent = `${lv.name} · ${lv.en}`;
    if (this.hud.levelIntro) this.hud.levelIntro.textContent = lv.intro || '';
    if (this.hud.foldCount) this.hud.foldCount.textContent = `${Math.min(this.foldIndex + 1, lv.foldsDef.length)} / ${lv.foldsDef.length}`;
    if (this.hud.precision) this.hud.precision.textContent = this.dragging ? Math.round(this.foldP * 100) + '%' : (this.lastPrecision ? this.lastPrecision + '%' : '—');
    if (this.hud.cumulative) this.hud.cumulative.textContent = this.cumulative() + '%';
    if (this.hud.hint) this.hud.hint.textContent = (this.state === 'playing') ? this.currentFold.hint : '';
    if (this.hud.dots) {
      this.hud.dots.innerHTML = '';
      for (let i = 0; i < lv.foldsDef.length; i++) {
        const d = document.createElement('span');
        d.className = 'dot' + (i < this.foldIndex ? ' done' : '') + (i === this.foldIndex ? ' cur' : '');
        this.hud.dots.appendChild(d);
      }
    }
  }

  /* ---------- 渲染 ---------- */
  loop(t) {
    const dt = Math.min(50, t - this.lastT); this.lastT = t;
    // 视角动画
    if (this.viewTarget && this.view) {
      if (this.viewAnim < 1) {
        this.viewAnim = Math.min(1, this.viewAnim + dt / 320);
        const e = 1 - Math.pow(1 - this.viewAnim, 3);
        this.view = {
          scale: this.view.scale + (this.viewTarget.scale - this.view.scale) * e * 0.25,
          ox: this.view.ox + (this.viewTarget.ox - this.view.ox) * e * 0.25,
          oy: this.view.oy + (this.viewTarget.oy - this.view.oy) * e * 0.25,
        };
      }
    }
    // 提交动画
    if (this.state === 'animating') {
      const el = t - this.commitStart;
      this.commitP = Math.min(1, this.foldP + el / 260);
      if (el >= 260) this.finalizeFold();
    }
    if (this.dragging) this.updateHud();
    this.render();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    // 桌面背景
    this.drawDesk(ctx);
    if (this.state === 'start') { this.drawStart(ctx); return; }

    // 目标幽灵轮廓（本关最终形态的提示，用最后一折后的形状近似——这里用初始方形虚框示意）
    // 绘制纸张图层
    const fold = this.currentFold;
    const p = (this.state === 'animating') ? this.commitP : this.foldP;
    if (this.state === 'playing' || this.state === 'animating') {
      this.drawFolding(ctx, fold, p);
    } else {
      this.drawLayers(ctx);
    }
    // 引导：折线、grab、target
    if (this.state === 'playing') this.drawGuides(ctx, fold);
    if (this.state === 'levelDone' || this.state === 'allDone') this.drawLevelOverlay(ctx);
  }

  drawDesk(ctx) {
    const g = ctx.createRadialGradient(this.W / 2, this.H * 0.4, 60, this.W / 2, this.H / 2, Math.max(this.W, this.H));
    g.addColorStop(0, '#f3ecdd');
    g.addColorStop(1, '#e4d8c2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  layerColor(side) { return side === 0 ? '#f8f2e4' : '#e3d2ac'; }

  drawPoly(ctx, poly, side, withShadow) {
    if (poly.length < 3) return;
    const pts = poly.map((p) => this.toCanvas(p));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (withShadow) { ctx.shadowColor = 'rgba(80,60,30,0.22)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 7; }
    ctx.fillStyle = this.layerColor(side);
    ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#c9b896'; ctx.lineWidth = 1.4; ctx.stroke();
  }

  drawLayers(ctx) {
    for (let i = 0; i < this.layers.length; i++) {
      this.drawPoly(ctx, this.layers[i].poly, this.layers[i].side, i === this.layers.length - 1);
    }
    this.drawCreases(ctx);
  }

  drawCreases(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,128,90,0.55)'; ctx.lineWidth = 1.1; ctx.setLineDash([5, 4]);
    for (const c of this.creases) {
      const a = this.toCanvas({ x: c.line.ax, y: c.line.ay }), b = this.toCanvas({ x: c.line.bx, y: c.line.by });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  }

  /* 拖动/提交中：保留侧静止，翻折侧插值 */
  drawFolding(ctx, fold, p) {
    const line = fold.line;
    const flipSign = Math.sign(sideOf(fold.grab, line)) || 1;
    const keepSign = -flipSign;
    // 画保留侧 + 已有折痕
    for (const layer of this.layers) {
      const keepPart = clipPoly(layer.poly, line, keepSign);
      if (keepPart.length >= 3) this.drawPoly(ctx, keepPart, layer.side, false);
    }
    this.drawCreases(ctx);
    // 画翻折侧插值
    for (const layer of this.layers) {
      const flipPart = clipPoly(layer.poly, line, flipSign);
      if (flipPart.length < 3) continue;
      const reflected = reflectPoly(flipPart, line);
      const interp = lerpPoly(flipPart, reflected, p);
      // 阴影随折叠中段加深
      const sh = Math.sin(p * Math.PI);
      ctx.save();
      ctx.shadowColor = `rgba(80,60,30,${0.05 + 0.28 * sh})`; ctx.shadowBlur = 10 + 18 * sh; ctx.shadowOffsetY = 4 + 10 * sh;
      this.drawPoly(ctx, interp, 1 - layer.side, false);
      ctx.restore();
    }
  }

  drawGuides(ctx, fold) {
    const line = fold.line;
    const a = this.toCanvas({ x: line.ax, y: line.ay }), b = this.toCanvas({ x: line.bx, y: line.by });
    // 折线
    ctx.save();
    ctx.strokeStyle = 'rgba(58,125,114,0.65)'; ctx.lineWidth = 1.6; ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
    // 目标环
    const t = this.toCanvas(this.target);
    const pulse = 1 + 0.18 * Math.sin(performance.now() / 280);
    ctx.save();
    ctx.strokeStyle = '#c85243'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(t.x, t.y, 15 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,82,67,0.35)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(t.x, t.y, 22 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // grab 手柄
    const g = this.toCanvas(this.grabPos || fold.grab);
    const near = Math.hypot((this.grabPos || fold.grab).x - this.target.x, (this.grabPos || fold.grab).y - this.target.y) < 16 / this.view.scale;
    ctx.save();
    ctx.shadowColor = 'rgba(58,125,114,0.5)'; ctx.shadowBlur = near ? 18 : 10;
    ctx.fillStyle = near ? '#2f9c8e' : '#3a7d72';
    ctx.beginPath(); ctx.arc(g.x, g.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
  }

  drawStart(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(44,38,32,0.9)';
    ctx.textAlign = 'center';
    ctx.font = '700 42px -apple-system,"PingFang SC",sans-serif';
    ctx.fillText('折·Fold', this.W / 2, this.H / 2 - 30);
    ctx.font = '400 17px -apple-system,"PingFang SC",sans-serif';
    ctx.fillStyle = 'rgba(44,38,32,0.6)';
    ctx.fillText('精度折纸 · 每一次对齐都在累积', this.W / 2, this.H / 2 + 8);
    ctx.restore();
  }

  drawLevelOverlay(ctx) {
    const c = this.cumulative();
    const r = this.rating(c);
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,12,0.55)'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8f2e4';
    ctx.font = '700 30px -apple-system,"PingFang SC",sans-serif';
    ctx.fillText(this.state === 'allDone' ? '全部完成' : `${LEVELS[this.levelIndex].name} 完成`, this.W / 2, this.H / 2 - 50);
    ctx.font = '800 78px -apple-system,"PingFang SC",sans-serif';
    ctx.fillStyle = r === 'S' ? '#e0a93b' : r === 'A' ? '#3a7d72' : r === 'B' ? '#c85243' : '#8a7a5e';
    ctx.fillText(r, this.W / 2, this.H / 2 + 20);
    ctx.font = '400 18px -apple-system,"PingFang SC",sans-serif';
    ctx.fillStyle = 'rgba(248,242,228,0.85)';
    ctx.fillText(`累计精度 ${c}%`, this.W / 2, this.H / 2 + 58);
    ctx.restore();
  }

  start() { this.state = 'playing'; }
  nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) { this.resetLevel(this.levelIndex + 1); }
    else { this.state = 'allDone'; }
  }
  retry() { this.resetLevel(this.levelIndex); }
}

/* ---------- 导出供页面使用 ---------- */
window.FoldGame = FoldGame;
window.LEVELS = LEVELS;
