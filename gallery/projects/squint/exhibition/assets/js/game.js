/* Squint - game logic (Track A, plain script, no modules)
 * Depends on scene.js (global SQUINT). Runs after DOMContentLoaded.
 *
 * Interaction model (v2):
 *  - The player PAINTS pixel cells, not blocks. Click / drag paints cells
 *    with the selected value. A brush radius (in cells) lets the player work
 *    from single pixels (for detail) up to big swaths (to block in masses).
 *  - A "stroke" = one continuous drag (mousedown -> mouseup). The stroke
 *    budget is spent per stroke, so big efficient strokes are rewarded and
 *    dabbing is limited - the player naturally learns to block masses first.
 *  - After a level is WON, an optional Detail Mode unlocks: free painting with
 *    an unlimited brush, no scoring, for practising fine detail.
 */
(function () {
  'use strict';
  const S = window.SQUINT;
  const { CANVAS, CELL, GRID, PALETTE, LEVELS, buildScene, hslToRgb } = S;
  const N = GRID * GRID;
  const SQUINT_DOWN = 4;                 // squint/pop grid: 84/4 = 21 blocks
  const SQUINT_GRID = GRID / SQUINT_DOWN;

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const refCanvas = $('refCanvas');
  const playerCanvas = $('playerCanvas');
  const refCtx = refCanvas.getContext('2d');
  const pctx = playerCanvas.getContext('2d');
  const stage = $('canvasStage');

  // offscreen base player canvas (unblurred; used for blur in squint mode)
  const pbase = document.createElement('canvas');
  pbase.width = CANVAS; pbase.height = CANVAS;
  const pbaseCtx = pbase.getContext('2d');

  const state = {
    levelIndex: 0,
    scene: null,
    pg: new Uint8Array(N),   // current value per cell, 0 = empty
    history: [],             // committed strokes: {cells:[idx], prev:[val], value}
    budgetMax: 20,
    budget: 20,
    currentValue: 3,
    currentHue: 35,
    currentSat: 0.45,        // saturation of the selected colour (colour levels)
    brush: 2,                // radius in cells (0 = single pixel)
    squint: false,
    stepback: false,
    flip: false,
    result: null,
    locked: false,
    detail: false,
    detailSnapshot: null,
    historyLenAtDetail: 0,
    painting: false,
    active: null,            // stroke in progress
    rafPending: false
  };

  // ---------- helpers ----------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function blockColor(value) {
    if (!state.scene.cfg.color) return PALETTE[value];
    const light = 0.92 - (value - 1) * (0.82 / 4); // value1 light -> value5 dark
    const c = hslToRgb((state.currentHue % 360) / 360, state.currentSat, light);
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  function fillCell(ctx, idx, value) {
    const r = (idx / GRID) | 0, c = idx % GRID;
    ctx.fillStyle = blockColor(value);
    ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
  }

  function makeBlurred(srcCanvas, scale) {
    const small = document.createElement('canvas');
    small.width = CANVAS / scale; small.height = CANVAS / scale;
    const sctx = small.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(srcCanvas, 0, 0, small.width, small.height);
    const out = document.createElement('canvas');
    out.width = CANVAS; out.height = CANVAS;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.drawImage(small, 0, 0, CANVAS, CANVAS);
    return out;
  }

  // ---------- rendering ----------
  function rebuildBase() {
    pbaseCtx.clearRect(0, 0, CANVAS, CANVAS);
    pbaseCtx.fillStyle = '#ffffff';
    pbaseCtx.fillRect(0, 0, CANVAS, CANVAS);
    for (let i = 0; i < N; i++) if (state.pg[i] > 0) fillCell(pbaseCtx, i, state.pg[i]);
  }

  function drawReference() {
    refCtx.clearRect(0, 0, CANVAS, CANVAS);
    if (state.squint) refCtx.drawImage(makeBlurred(state.scene.refCanvas, 10), 0, 0);
    else refCtx.drawImage(state.scene.refCanvas, 0, 0);
  }

  function renderPlayer() {
    pctx.clearRect(0, 0, CANVAS, CANVAS);
    if (state.squint) {
      pctx.drawImage(makeBlurred(pbase, 10), 0, 0);
      drawPops();
    } else {
      pctx.drawImage(pbase, 0, 0);
      if (state.flip) {
        pctx.globalAlpha = 0.5;
        pctx.drawImage(state.scene.refCanvas, 0, 0);
        pctx.globalAlpha = 1;
      }
    }
  }

  // Pops are computed on a coarse grid so they stay readable at high res.
  function drawPops() {
    const tg = state.scene.trueGrid;
    const bw = SQUINT_DOWN;
    pctx.fillStyle = 'rgba(214,40,30,0.45)';
    for (let sy = 0; sy < SQUINT_GRID; sy++) {
      for (let sx = 0; sx < SQUINT_GRID; sx++) {
        let tSum = 0, pSum = 0, pN = 0, cnt = 0;
        for (let rr = sy * bw; rr < sy * bw + bw; rr++) {
          for (let cc = sx * bw; cc < sx * bw + bw; cc++) {
            tSum += tg[rr][cc]; cnt++;
            const v = state.pg[rr * GRID + cc];
            if (v > 0) { pSum += v; pN++; }
          }
        }
        if (pN === 0) continue;
        const tMean = tSum / cnt, pMean = pSum / pN;
        if (Math.abs(pMean - tMean) >= 1) {
          pctx.fillRect(sx * bw * CELL, sy * bw * CELL, bw * CELL, bw * CELL);
        }
      }
    }
  }

  function redraw() { drawReference(); renderPlayer(); }

  function scheduleRender() {
    if (state.rafPending) return;
    state.rafPending = true;
    requestAnimationFrame(() => { state.rafPending = false; renderPlayer(); });
  }

  // ---------- painting ----------
  function eventCell(e) {
    const rect = playerCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS / rect.width);
    const y = (e.clientY - rect.top) * (CANVAS / rect.height);
    return {
      r: clamp(Math.floor(y / CELL), 0, GRID - 1),
      c: clamp(Math.floor(x / CELL), 0, GRID - 1)
    };
  }

  function paintAt(r, c) {
    const a = state.active;
    if (!a) return;
    const rad = state.brush;
    const r0 = Math.max(0, r - rad), r1 = Math.min(GRID - 1, r + rad);
    const c0 = Math.max(0, c - rad), c1 = Math.min(GRID - 1, c + rad);
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        const i = rr * GRID + cc;
        if (state.pg[i] === state.currentValue) continue;
        if (!a.seen.has(i)) { a.seen.add(i); a.cells.push(i); a.prev.push(state.pg[i]); }
        state.pg[i] = state.currentValue;
        fillCell(pbaseCtx, i, state.currentValue);
        fillCell(pctx, i, state.currentValue);
      }
    }
  }

  function onDown(e) {
    if (state.locked && !state.detail) return;
    e.preventDefault();
    const { r, c } = eventCell(e);
    state.painting = true;
    state.active = {
      cells: [], prev: [], seen: new Set(),
      value: state.currentValue
    };
    paintAt(r, c);
    scheduleRender();
  }
  function onMove(e) {
    if (!state.painting) return;
    const { r, c } = eventCell(e);
    paintAt(r, c);
    scheduleRender();
  }
  function onUp() {
    if (!state.painting) return;
    state.painting = false;
    const a = state.active; state.active = null;
    if (!a || a.cells.length === 0) { scheduleRender(); return; }
    state.history.push(a);
    if (!state.detail && state.budget > 0) state.budget -= 1;
    if (!state.detail && state.budget === 0) flash('Stroke budget empty — undo or reset.');
    updateKpis();
    scheduleRender();
  }

  function flash(msg) {
    const el = $('flash');
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(flash._t);
    flash._t = setTimeout(() => { el.style.opacity = '0'; }, 1700);
  }

  // ---------- evaluation ----------
  const PASS = 80; // 80% is the passing grade

  // Map a score to the student's grading bands.
  function gradeLabel(score) {
    if (score >= 95) return 'Perfect';
    if (score >= 90) return 'Great';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Decent';
    if (score >= 60) return 'Needs a little work';
    return 'Needs improvement';
  }

  // Penalty for an UNPAINTED cell. A blank cell literally shows the white
  // canvas, i.e. value 1 (the lightest). So the "wrongness" of leaving it
  // blank depends on how dark the true value is:
  //   - value 1 (white): 0      — the blank canvas already matches
  //   - value 2 (near-white backdrop): 0.6  — cheap, the earlier "background
  //     never satisfied" complaint; a near-white backdrop shouldn't be punished
  //   - value 3/4/5: |1 - tv|  — darker masses still MUST be blocked in
  function blankErr(tv) {
    if (tv <= 1) return 0;
    if (tv === 2) return 0.6;
    return Math.abs(1 - tv);
  }

  function evaluate() {
    if (state.detail) { flash('Detail Mode has no scoring. Press Exit to finish.'); return; }
    const pg = state.pg;
    const tg = state.scene.trueGrid;
    const cc = state.scene.cellClass;
    const regions = state.scene.regions;
    let sumErr = 0, count = 0, popCells = 0;
    const regionErr = {}, regionCount = {}, regionPlayerSum = {}, regionPlayerN = {};
    for (const k of Object.keys(regions)) { regionErr[k] = 0; regionCount[k] = 0; regionPlayerSum[k] = 0; regionPlayerN[k] = 0; }

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const i = r * GRID + c;
        const tv = tg[r][c];
        const pv = pg[i];
        // An UNPAINTED cell literally shows the white canvas = value 1 (lightest).
        // Score it with blankErr(): value 1 = free, value 2 (near-white backdrop)
        // = light, darker masses = full distance. So the light backdrop isn't
        // unfairly punished when left blank, but dark forms still must be painted.
        const err = pv === 0 ? blankErr(tv) : Math.abs(pv - tv);
        sumErr += err; count++;
        const k = cc[r][c];
        regionErr[k] += err; regionCount[k] += 1;
        if (pv > 0) { regionPlayerSum[k] += pv; regionPlayerN[k] += 1; }
        if (pv > 0 && Math.abs(pv - tv) >= 1) popCells++;
      }
    }
    const meanErr = sumErr / count;
    const score = clamp(Math.round(100 * (1 - meanErr / 4)), 0, 100);

    const regionMean = {};
    for (const k of Object.keys(regions)) {
      if (regionCount[k] > 0) regionMean[k] = regionErr[k] / regionCount[k];
    }
    const strokesUsed = state.budgetMax - state.budget;
    // Win = a passing score with strokes still left. The brittle "every region
    // within 1 step" gate is intentionally dropped so 80%+ truly passes.
    const win = state.budget > 0 && score >= PASS;
    const bonus = win && strokesUsed <= Math.round(state.budgetMax * 0.6);

    let reason;
    if (win) reason = 'You read the light into values — a passing grade with strokes to spare.';
    else if (state.budget === 0) reason = 'Stroke budget ran out before the values matched the light.';
    else if (score < 60) reason = 'The value reading is well off — squint (Q) and re-read the masses.';
    else if (score < PASS) reason = 'Close, but below the 80% passing grade. Tweak the off regions.';
    else reason = 'Overall value reading is below the passing score.';

    const text = buildCritique(regionMean, regionPlayerSum, regionPlayerN, regionCount, tg, score, popCells, win, bonus);

    state.result = { win, score, reason, bonus, text };
    state.locked = win;
    $('detailBtn').style.display = win ? 'inline-block' : 'none';
    showResult();
    return state.result;
  }

  const REGION_NAMES = {
    sphere: 'Sphere', box: 'Box', ground: 'Ground', bg: 'Background',
    body: 'Body', head: 'Head', wing: 'Wing', leaf: 'Leaf', stem: 'Stem', tail: 'Tail'
  };

  function buildCritique(regionMean, pSum, pN, rCount, tg, score, popCells, win, bonus) {
    const lines = [];
    lines.push(`AI critique score: ${score}/100  —  ${gradeLabel(score)}`);
    lines.push(`Passing grade: ${PASS}%. ${win ? 'You passed.' : 'Keep adjusting to reach it.'}`);
    if (bonus) lines.push('BONUS: efficient strokes — clean value reading.');
    lines.push('');
    for (const k of Object.keys(state.scene.regions)) {
      if (rCount[k] === 0) continue;
      let trueMean = 0;
      for (const cell of state.scene.regions[k]) trueMean += tg[cell.r][cell.c];
      trueMean /= rCount[k];
      const name = REGION_NAMES[k] || (k.charAt(0).toUpperCase() + k.slice(1));
      if (pN[k] === 0) {
        if (trueMean <= 2.2) {
          lines.push(`• ${name}: left as white canvas — already reads close to value ${Math.round(trueMean)}. Paint it only to finish.`);
        } else {
          lines.push(`• ${name}: left blank. Block it in near value ${Math.round(trueMean)}.`);
        }
      } else {
        const playerMean = pSum[k] / pN[k];
        const diff = playerMean - trueMean;
        if (Math.abs(diff) < 0.5) lines.push(`• ${name}: values read well.`);
        else if (diff < 0) lines.push(`• ${name}: too light — push toward value ${Math.round(trueMean)} (darker).`);
        else lines.push(`• ${name}: too dark — lighten toward value ${Math.round(trueMean)}.`);
      }
    }
    lines.push('');
    lines.push(win
      ? 'Solid read of the light. Squint and step back confirmed the masses.'
      : `Squint (Q) to see pops, step back (E) to judge the whole. ${popCells} cell(s) still off.`);
    return lines.join('\n');
  }

  function showResult() {
    const r = state.result;
    if (!r) return;
    const grade = gradeLabel(r.score);
    const win = r.win;
    const head = $('resultHead');
    head.textContent = win ? 'LEVEL COMPLETE' : 'KEEP PRACTISING';
    head.style.color = win ? 'var(--good)' : 'var(--bad)';
    const scoreEl = $('resultScore');
    scoreEl.innerHTML = `${r.score}<small>% · ${grade}</small>`;
    scoreEl.style.color = win ? 'var(--good)' : 'var(--bad)';
    $('resultReason').textContent = r.reason;
    $('resultCritique').textContent = r.text;
    $('resultDetail').style.display = win ? 'inline-block' : 'none';
    $('scoreKpi').textContent = r.score;
    openResult();
  }

  function openResult() { $('resultOverlay').style.display = 'flex'; }
  function closeResult() { $('resultOverlay').style.display = 'none'; }

  // ---------- detail mode ----------
  function enterDetail() {
    if (!state.result || !state.result.win) return;
    state.detail = true;
    state.detailSnapshot = state.pg.slice();
    state.historyLenAtDetail = state.history.length;
    state.locked = false;
    $('detailBtn').style.display = 'none';
    $('exitDetailBtn').style.display = 'inline-block';
    $('detailBanner').style.display = 'block';
    flash('Detail Mode: refine freely. No scoring.');
    updateKpis();
    redraw();
  }
  function exitDetail() {
    state.detail = false;
    state.detailSnapshot = null;
    state.locked = true;
    $('exitDetailBtn').style.display = 'none';
    $('detailBanner').style.display = 'none';
    $('detailBtn').style.display = 'inline-block';
    updateKpis();
    redraw();
    showResult();
  }

  // ---------- KPIs / palette / brush ----------
  function updateKpis() {
    $('budget').textContent = state.detail ? '∞' : state.budget;
    $('strokes').textContent = state.detail ? '—' : (state.budgetMax - state.budget);
    $('brushSize').textContent = (state.brush * 2 + 1);
  }

  function undo() {
    if (state.detail && state.history.length <= state.historyLenAtDetail) return;
    if (state.history.length === 0) return;
    const a = state.history.pop();
    for (let k = 0; k < a.cells.length; k++) state.pg[a.cells[k]] = a.prev[k];
    if (!state.detail) {
      state.budget = Math.min(state.budgetMax, state.budget + 1);
      state.locked = false; state.result = null;
      $('detailBtn').style.display = 'none';
    }
    updateKpis(); rebuildBase(); renderPlayer();
  }

  function resetLevel() {
    if (state.detail) {
      state.pg.set(state.detailSnapshot);
      state.history = state.history.slice(0, state.historyLenAtDetail);
      rebuildBase(); renderPlayer(); updateKpis();
      return;
    }
    state.pg.fill(0);
    state.history = [];
    state.budget = state.budgetMax;
    state.locked = false; state.result = null;
    $('detailBtn').style.display = 'none';
    $('scoreKpi').textContent = '—';
    updateKpis(); rebuildBase(); renderPlayer();
  }

  function changeBrush(delta) {
    state.brush = clamp(state.brush + delta, 0, 8);
    updateKpis();
  }

  function loadLevel(index) {
    state.levelIndex = index;
    const cfg = LEVELS[index];
    state.scene = buildScene(cfg);
    state.budgetMax = cfg.budget || (cfg.color ? 24 : 20);
    resetLevelState();
    $('levelDesc').textContent = cfg.desc;
    document.querySelectorAll('.level-tabs .btn').forEach((b, i) =>
      b.classList.toggle('active', i === index));
    if (cfg.color && cfg.palette && cfg.palette.length) {
      const first = cfg.palette[0];
      state.currentHue = first.hue;
      state.currentSat = first.sat;
      buildHueChips();
      $('colorWrap').style.display = 'block';
    } else {
      $('colorWrap').style.display = 'none';
    }
    buildPalette();
    rebuildBase(); redraw();
  }

  function resetLevelState() {
    state.pg.fill(0);
    state.history = [];
    state.budget = state.budgetMax;
    state.locked = false; state.result = null;
    state.detail = false; state.detailSnapshot = null;
    state.squint = false; state.stepback = false; state.flip = false;
    stage.classList.remove('stepback');
    $('resultOverlay').style.display = 'none';
    $('squintBtn').classList.remove('on');
    $('stepBtn').classList.remove('on');
    $('flipBtn').classList.remove('on');
    $('detailBtn').style.display = 'none';
    $('exitDetailBtn').style.display = 'none';
    $('detailBanner').style.display = 'none';
    $('scoreKpi').textContent = '—';
    updateKpis();
  }

  // ---------- UI wiring ----------
  // A value swatch shows the actual colour it paints: grayscale on mono levels,
  // or the currently-selected hue at that value's lightness on colour levels.
  function swatchColor(v) {
    if (!state.scene || !state.scene.cfg.color) return PALETTE[v];
    return blockColor(v);
  }
  function buildPalette() {
    const wrap = $('palette');
    wrap.innerHTML = '';
    for (let v = 1; v <= 5; v++) {
      const sw = document.createElement('div');
      sw.className = 'swatch' + (v === state.currentValue ? ' sel' : '');
      sw.style.background = swatchColor(v);
      sw.title = 'Value ' + v + (v === 1 ? ' (lightest)' : v === 5 ? ' (darkest)' : '');
      sw.addEventListener('click', () => selectValue(v));
      wrap.appendChild(sw);
    }
  }
  function selectValue(v) {
    state.currentValue = v;
    document.querySelectorAll('#palette .swatch').forEach((s, i) =>
      s.classList.toggle('sel', i + 1 === v));
  }

  // Colour chips (colour levels only): pick a colour family; the value
  // swatches re-tint to it so the palette itself shows colours.
  function buildHueChips() {
    const wrap = $('hueChips');
    if (!wrap) return;
    wrap.innerHTML = '';
    const pal = (state.scene && state.scene.cfg.palette) || [];
    pal.forEach((entry) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'hue-chip' + (entry.hue === state.currentHue ? ' sel' : '');
      const c = hslToRgb((((entry.hue % 360) + 360) % 360) / 360, entry.sat, 0.55);
      chip.title = entry.name;
      chip.innerHTML =
        `<span class="hue-dot" style="background:rgb(${c[0]},${c[1]},${c[2]})"></span>${entry.name}`;
      chip.addEventListener('click', () => selectHue(entry));
      wrap.appendChild(chip);
    });
  }
  function selectHue(entry) {
    state.currentHue = entry.hue;
    state.currentSat = entry.sat;
    buildHueChips();   // refresh selected state
    buildPalette();    // re-tint the value swatches
  }

  function bindUI() {
    playerCanvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    playerCanvas.addEventListener('touchstart', (e) => { onDown(e.touches[0]); e.preventDefault(); }, { passive: false });
    playerCanvas.addEventListener('touchmove', (e) => { onMove(e.touches[0]); e.preventDefault(); }, { passive: false });
    playerCanvas.addEventListener('touchend', (e) => onUp(e.changedTouches[0]));

    window.addEventListener('keydown', (e) => {
      if (e.key >= '1' && e.key <= '5') selectValue(parseInt(e.key, 10));
      else if (e.key === 'q' || e.key === 'Q') toggleSquint();
      else if (e.key === 'e' || e.key === 'E') toggleStep();
      else if (e.key === 'f' || e.key === 'F') toggleFlip();
      else if (e.key === '[') changeBrush(-1);
      else if (e.key === ']') changeBrush(1);
      else if (e.key === 'Escape') closeResult();
    });

    $('squintBtn').addEventListener('click', toggleSquint);
    $('stepBtn').addEventListener('click', toggleStep);
    $('flipBtn').addEventListener('click', toggleFlip);
    $('undoBtn').addEventListener('click', undo);
    $('resetBtn').addEventListener('click', resetLevel);
    $('submitBtn').addEventListener('click', evaluate);
    $('brushMinus').addEventListener('click', () => changeBrush(-1));
    $('brushPlus').addEventListener('click', () => changeBrush(1));
    $('detailBtn').addEventListener('click', enterDetail);
    $('exitDetailBtn').addEventListener('click', exitDetail);
    $('resultClose').addEventListener('click', closeResult);
    $('resultContinue').addEventListener('click', closeResult);
    $('resultDetail').addEventListener('click', () => { closeResult(); enterDetail(); });

    document.querySelectorAll('.level-tabs .btn').forEach((b) =>
      b.addEventListener('click', () => loadLevel(parseInt(b.dataset.level, 10))));
  }

  function toggleSquint() { state.squint = !state.squint; $('squintBtn').classList.toggle('on', state.squint); redraw(); }
  function toggleStep() { state.stepback = !state.stepback; stage.classList.toggle('stepback', state.stepback); $('stepBtn').classList.toggle('on', state.stepback); }
  function toggleFlip() { state.flip = !state.flip; $('flipBtn').classList.toggle('on', state.flip); redraw(); }

  // ---------- start ----------
  function init() {
    buildPalette();
    bindUI();
    loadLevel(0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
