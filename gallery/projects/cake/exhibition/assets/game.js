/* =============================================================
   Cake - Game Logic
   Plain JavaScript, no build step. Reads and writes the same
   state object so the data flow is easy to follow.
   ============================================================= */

(function () {
  'use strict';

  // ---------- 1. Game data ----------

  const BASES = [
    { id: 'chocolate',  name: 'Chocolate',  color: '#5D3A1A' },
    { id: 'vanilla',    name: 'Vanilla',    color: '#F3E2A8' },
    { id: 'strawberry', name: 'Strawberry', color: '#F4A6A6' }
  ];

  const FROSTINGS = [
    { id: 'pink',      name: 'Pink Frosting',      color: '#F4A6C0' },
    { id: 'cream',     name: 'Cream Frosting',     color: '#F8F0DA' },
    { id: 'chocolate', name: 'Chocolate Frosting', color: '#7B4B2A' }
  ];

  const DECORATIONS = [
    { id: 'candles',   name: 'Candles',   emoji: '\u{1F56F}\u{FE0F}' },
    { id: 'sprinkles', name: 'Sprinkles', emoji: '\u{1F38A}' },
    { id: 'strawberry',name: 'Strawberry',emoji: '\u{1F353}' },
    { id: 'cherry',    name: 'Cherry',    emoji: '\u{1F352}' },
    { id: 'cookie',    name: 'Cookie',    emoji: '\u{1F36A}' },
    { id: 'star',      name: 'Star',      emoji: '\u{1F31F}' }
  ];

  const MIX_DURATION  = 5;
  const BAKE_DURATION = 5;

  const LEVELS = {
    1: {
      label: 'Level 1',
      timeLimit: 0,
      minLayers: 1, maxLayers: 1,
      minDecorations: 1, maxDecorations: 1,
      goal: 'Read the order carefully. Make the cake match it.'
    },
    2: {
      label: 'Level 2',
      timeLimit: 60,
      minLayers: 2, maxLayers: 2,
      minDecorations: 2, maxDecorations: 2,
      goal: 'Add pressure. You have 1 minute.'
    },
    3: {
      label: 'Level 3',
      timeLimit: 20,
      minLayers: 3, maxLayers: 3,
      minDecorations: 3, maxDecorations: 3,
      goal: 'Full challenge. Pick each layer manually.'
    }
  };

  // ---------- 2. Game state ----------

  const game = {
    level: 1,
    step: 'READ',
    order: null,
    orderRevealed: false,
    cake: {
      base: null,
      frosting: null,
      layerBases: [],         // [base, base, base] – only used for Level 3
      decorations: [],
      layers: 1,              // how many layers total
      state: 'empty'
    },
    timeLimit: 0,
    timeLeft: 0,
    intervalId: null,
    phaseTimer: 0,
    phaseIntervalId: null,
    result: null
  };

  // ---------- 3. DOM ----------

  const $ = (id) => document.getElementById(id);

  const dom = {
    levelSelect:    $('levelSelect'),
    gameScreen:     $('gameScreen'),
    levelDisplay:   $('levelDisplay'),
    timerDisplay:   $('timerDisplay'),
    timerCell:      document.querySelector('.timer-cell'),
    stateDisplay:   $('stateDisplay'),
    restartBtn:     $('restartBtn'),
    orderCard:      $('orderCard'),
    orderInstr:     $('orderInstructions'),
    customerFace:   document.querySelector('.face-shape'),
    canvas:         $('cakeCanvas'),
    stageMessage:   $('stageMessage'),
    ingredientGrid: $('ingredientGrid'),
    mixBtn:         $('mixBtn'),
    mixProgress:    $('mixProgress'),
    mixBar:         $('mixBar'),
    mixLabel:       $('mixLabel'),
    ovenBtn:        $('ovenBtn'),
    ovenVisual:     $('ovenVisual'),
    bakeProgress:   $('bakeProgress'),
    bakeBar:        $('bakeBar'),
    bakeLabel:      $('bakeLabel'),
    decoGrid:       $('decoGrid'),
    cakeProgress:   $('cakeProgress'),
    submitBtn:      $('submitBtn'),
    resultOverlay:  $('resultOverlay'),
    resultTitle:    $('resultTitle'),
    resultDetail:   $('resultDetail'),
    retryBtn:       $('retryBtn'),
    nextLevelBtn:   $('nextLevelBtn')
  };

  const ctx = dom.canvas.getContext('2d');

  // ---------- 4. Helpers ----------

  function randItem(arr)       { return arr[Math.floor(Math.random() * arr.length)]; }
  function findById(arr, id)   { return arr.find((x) => x.id === id); }

  function randMany(arr, n) {
    const copy = arr.slice();
    const out = [];
    for (let i = 0; i < n && copy.length; i++) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
  }

  function formatTime(s) {
    if (s <= 0) return '--';
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  // ---------- 5. Order generation ----------

  function generateOrder(level) {
    const cfg = LEVELS[level];
    const order = {
      base: randItem(BASES),
      frosting: randItem(FROSTINGS),
      decorations: randMany(DECORATIONS, cfg.minDecorations),
      layers: cfg.minLayers
    };
    // Levels 2 & 3: each layer gets a different base type, chosen by player.
    if (level >= 2) {
      order.layerBases = randMany(BASES, cfg.minLayers);
    }
    return order;
  }

  // ---------- 6. Step transitions ----------

  function setStep(step) {
    game.step = step;

    const labels = {
      READ:         'Read the order',
      SELECT:       'Pick the ingredients',
      MIXING:       'Mixing the batter\u2026',
      BAKE:         'Bake the cake',
      BAKING:       'Baking in the oven\u2026',
      DECORATE:     'Add the decorations',
      SUBMIT:       'Submit the cake',
      RESULT:       'See the result'
    };
    dom.stateDisplay.textContent = labels[step];

    const unlocked = {
      READ:         [],
      SELECT:       ['select'],
      MIXING:       ['select'],
      BAKE:         ['bake'],
      BAKING:       ['bake'],
      DECORATE:     ['decorate', 'submit'],
      SUBMIT:       ['submit'],
      RESULT:       []
    };
    const allowed = unlocked[step] || [];

    document.querySelectorAll('.tool-group').forEach((g) => {
      const gStep = g.getAttribute('data-step');
      g.classList.toggle('locked', !allowed.includes(gStep));
    });

    const messages = {
      READ:         'Press A to read the order.',
      SELECT:       'Click ingredients. Then click Mix the batter.',
      MIXING:       'The batter is mixing\u2026 wait for it!',
      BAKE:         'Press W to put the cake in the oven.',
      BAKING:       'The cake is baking\u2026 patience!',
      DECORATE:     'Click decorations to add them to your cake.',
      SUBMIT:       'Press Space to hand the cake to the customer.',
      RESULT:       'The customer is reacting to your cake\u2026'
    };
    dom.stageMessage.textContent = messages[step];

    dom.mixProgress.classList.toggle('hidden', step !== 'MIXING');
    dom.bakeProgress.classList.toggle('hidden', step !== 'BAKING');

    render();
  }

  // ---------- 7. Phase timer ----------

  function startPhaseTimer(duration, onTick, onDone) {
    stopPhaseTimer();
    game.phaseTimer = duration;
    onTick(game.phaseTimer, duration);

    game.phaseIntervalId = setInterval(() => {
      if (game.step === 'RESULT') { stopPhaseTimer(); return; }
      game.phaseTimer -= 1;
      onTick(game.phaseTimer, duration);
      if (game.phaseTimer <= 0) { stopPhaseTimer(); onDone(); }
    }, 1000);
  }

  function stopPhaseTimer() {
    if (game.phaseIntervalId) { clearInterval(game.phaseIntervalId); game.phaseIntervalId = null; }
  }

  // ---------- 8. Player actions ----------

  function readOrder() {
    if (game.step !== 'READ') return;
    game.orderRevealed = true;
    renderOrder();
    setStep('SELECT');
  }

  function selectIngredient(type, id, btn) {
    if (game.step !== 'SELECT') return;
    if (type === 'base') {
      game.cake.base = findById(BASES, id);
      flashButton(btn, game.cake.base.id === game.order.base.id);
    } else if (type === 'frosting') {
      game.cake.frosting = findById(FROSTINGS, id);
      flashButton(btn, game.cake.frosting.id === game.order.frosting.id);
    } else if (type === 'layer1') {
      game.cake.layerBases[0] = findById(BASES, id);
      flashButton(btn, game.cake.layerBases[0].id === game.order.layerBases[0].id);
    } else if (type === 'layer2') {
      game.cake.layerBases[1] = findById(BASES, id);
      flashButton(btn, game.cake.layerBases[1].id === game.order.layerBases[1].id);
    } else if (type === 'layer3') {
      game.cake.layerBases[2] = findById(BASES, id);
      flashButton(btn, game.cake.layerBases[2].id === game.order.layerBases[2].id);
    }

    // Mix enabled: (base + frosting) for L1, (manual layers + frosting) for L2/L3
    let canMix;
    if (game.level >= 2) {
      const allLayers = game.cake.layerBases.slice(0, game.cake.layers).every((b) => b);
      canMix = allLayers && game.cake.frosting;
    } else {
      canMix = game.cake.base && game.cake.frosting;
    }
    dom.mixBtn.disabled = !canMix;
    render();
  }

  function flashButton(btn, correct) {
    if (!btn) return;
    if (correct) { btn.classList.add('selected'); }
    else { btn.classList.add('wrong'); setTimeout(() => btn.classList.remove('wrong'), 400); }
  }

  // ---------- 9. Mixing, baking, decorating ----------

  function mixBatter() {
    if (game.step !== 'SELECT') return;
    if (game.level >= 2) {
      const allLayers = game.cake.layerBases.slice(0, game.cake.layers).every((b) => b);
      if (!allLayers || !game.cake.frosting) return;
    } else {
      if (!game.cake.base || !game.cake.frosting) return;
    }

    game.cake.state = 'mixed';
    game.cake.layers = game.order.layers;
    dom.mixBtn.disabled = true;
    setStep('MIXING');

    startPhaseTimer(
      MIX_DURATION,
      (remaining, total) => {
        dom.mixBar.style.width = ((total - remaining) / total * 100) + '%';
        dom.mixLabel.textContent = 'Mixing\u2026 ' + remaining + 's left';
      },
      () => { dom.mixBar.style.width = '100%'; dom.mixLabel.textContent = 'Mixed!'; setStep('BAKE'); }
    );
  }

  function bake() {
    if (game.step !== 'BAKE') return;
    game.cake.state = 'baked';
    dom.ovenVisual.classList.add('on');
    dom.ovenBtn.disabled = true;
    setStep('BAKING');

    startPhaseTimer(
      BAKE_DURATION,
      (remaining, total) => {
        dom.bakeBar.style.width = ((total - remaining) / total * 100) + '%';
        dom.bakeLabel.textContent = 'Baking\u2026 ' + remaining + 's left';
      },
      () => {
        dom.ovenVisual.classList.remove('on');
        dom.bakeBar.style.width = '100%';
        dom.bakeLabel.textContent = 'Baked!';
        setStep('DECORATE');
      }
    );
  }

  function addDecoration(id) {
    if (game.step !== 'DECORATE') return;
    const idx = game.cake.decorations.findIndex((d) => d.id === id);
    if (idx >= 0) { game.cake.decorations.splice(idx, 1); }
    else          { game.cake.decorations.push(findById(DECORATIONS, id)); }
    dom.submitBtn.disabled = game.cake.decorations.length === 0;
    render();
  }

  function submit() {
    if (game.step !== 'DECORATE' && game.step !== 'BAKING' && game.step !== 'MIXING') return;
    if (game.cake.decorations.length === 0 && game.step === 'DECORATE') return;
    stopTimer();
    stopPhaseTimer();
    setStep('SUBMIT');
    game.cake.state = 'decorated';
    render();
    setTimeout(evaluate, 800);
  }

  // ---------- 10. Evaluation ----------

  function evaluate() {
    const missing = [];

    // Base check
    if (game.level >= 2) {
      // Check each layer's base
      for (let i = 0; i < game.order.layers; i++) {
        const wanted = game.order.layerBases[i];
        const got = game.cake.layerBases[i];
        if (!got || got.id !== wanted.id) {
          missing.push('Layer ' + (i + 1) + ': wrong base (wanted ' + wanted.name + ')');
        }
      }
    } else {
      if (!game.cake.base || game.cake.base.id !== game.order.base.id) {
        missing.push('Wrong cake base (wanted ' + game.order.base.name + ')');
      }
      if (game.cake.layers !== game.order.layers) {
        missing.push('Wrong number of layers (wanted ' + game.order.layers + ')');
      }
    }

    // Frosting check
    if (!game.cake.frosting || game.cake.frosting.id !== game.order.frosting.id) {
      missing.push('Wrong frosting (wanted ' + game.order.frosting.name + ')');
    }

    // Decorations check
    const orderDecoIds = game.order.decorations.map((d) => d.id).sort();
    const cakeDecoIds = game.cake.decorations.map((d) => d.id).sort();
    if (orderDecoIds.join(',') !== cakeDecoIds.join(',')) {
      missing.push('Decorations did not match the order');
    }

    const ranOutOfTime = game.timeLimit > 0 && game.timeLeft <= 0;
    const win = missing.length === 0 && !ranOutOfTime;
    game.result = { win, ranOutOfTime, missing };
    showResult();
  }

  function showResult() {
    if (game.result.win) {
      dom.customerFace.classList.remove('sad');
      dom.customerFace.classList.add('happy');
      dom.resultTitle.textContent = 'You win!';
      dom.resultTitle.className = 'win';
      dom.resultDetail.textContent = 'The customer is happy. All requirements were met and you finished in time.';
    } else {
      dom.customerFace.classList.remove('happy');
      dom.customerFace.classList.add('sad');
      dom.resultTitle.textContent = 'Game over';
      dom.resultTitle.className = 'lose';
      const reason = game.result.ranOutOfTime
        ? 'You ran out of time. Try again and plan faster.'
        : 'The cake did not match the order. Read the order more carefully next time.';
      dom.resultDetail.textContent = reason + '\n\nIssues:\n' +
        game.result.missing.map((m) => '\u2022 ' + m).join('\n');
    }
    setStep('RESULT');
    dom.resultOverlay.classList.remove('hidden');
  }

  // ---------- 11. Timer ----------

  function startTimer() {
    stopTimer();
    if (game.timeLimit <= 0) {
      dom.timerDisplay.textContent = 'No timer';
      dom.timerCell.classList.remove('warning', 'danger');
      return;
    }
    game.timeLeft = game.timeLimit;
    dom.timerDisplay.textContent = formatTime(game.timeLeft);
    dom.timerCell.classList.remove('warning', 'danger');
    game.intervalId = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (game.intervalId) { clearInterval(game.intervalId); game.intervalId = null; }
  }

  function tick() {
    game.timeLeft -= 1;
    dom.timerDisplay.textContent = formatTime(game.timeLeft);
    dom.timerCell.classList.toggle('warning', game.timeLeft <= 20 && game.timeLeft > 5);
    dom.timerCell.classList.toggle('danger',  game.timeLeft <= 5);
    if (game.timeLeft <= 0) { stopTimer(); stopPhaseTimer(); gameOver(); }
  }

  function gameOver() {
    game.result = { win: false, ranOutOfTime: true, missing: [] };
    dom.customerFace.classList.remove('happy');
    dom.customerFace.classList.add('sad');
    dom.resultTitle.textContent = 'Game Over';
    dom.resultTitle.className = 'lose';
    dom.resultDetail.textContent = "Time's up! You ran out of time.";
    setStep('RESULT');
    dom.resultOverlay.classList.remove('hidden');
  }

  // ---------- 12. Rendering ----------

  function render() {
    renderOrder();
    renderInstructions();
    renderIngredientButtons();
    renderDecorationButtons();
    renderCakeProgress();
    drawCake();
  }

  // ---- Order card ----

  function renderOrder() {
    if (!game.order || !game.orderRevealed) {
      dom.orderCard.classList.add('empty');
      dom.orderCard.innerHTML = '<p class="hint-text">Press <kbd>A</kbd> to read the order.</p>';
      dom.orderInstr.classList.add('hidden');
      return;
    }
    dom.orderCard.classList.remove('empty');
    const o = game.order;

    let lines = '';
    if (game.result) {
      // --- result view: show checks / crosses ---
      const frostOk = game.cake.frosting && game.cake.frosting.id === o.frosting.id;
      lines += row('Frosting', o.frosting.name, frostOk);

      if (game.level >= 2) {
        for (let i = 0; i < o.layers; i++) {
          const wanted = o.layerBases[i];
          const got = game.cake.layerBases[i];
          const ok = got && got.id === wanted.id;
          lines += row('Layer ' + (i + 1), wanted.name, ok);
        }
      } else {
        const baseOk = game.cake.base && game.cake.base.id === o.base.id;
        const layersOk = game.cake.layers === o.layers;
        lines += row('Base', o.base.name, baseOk);
        lines += row('Layers', String(o.layers), layersOk);
      }

      const orderDecoIds = o.decorations.map((d) => d.id).sort();
      const cakeDecoIds = game.cake.decorations.map((d) => d.id).sort();
      const decoOk = orderDecoIds.join(',') === cakeDecoIds.join(',');
      lines += row('Toppings', o.decorations.map((d) => d.name).join(', '), decoOk);

    } else {
      // --- in-progress view ---
      if (game.level >= 2) {
        for (let i = 0; i < o.layers; i++) {
          lines += row('Layer ' + (i + 1), o.layerBases[i].name);
        }
      } else {
        lines += row('Base', o.base.name);
        lines += row('Layers', String(o.layers));
      }
      lines += row('Frosting', o.frosting.name);

      if (game.step === 'DECORATE') {
        lines += '<div class="order-line"><strong>Toppings:</strong><span class="hint-text">Remember from the order!</span></div>';
      } else {
        lines += row('Toppings', o.decorations.map((d) => d.name).join(', '));
        // Show memorize warning when toppings are visible and game is in progress
        if (game.step !== 'RESULT') {
          lines += '<div class="instr-note" style="margin-top:8px;font-size:11px;">' +
            '\u26A0 Memorize the toppings \u2014 they will be hidden during the decorate step!</div>';
        }
      }
    }
    dom.orderCard.innerHTML = lines;
  }

  function row(label, value, ok) {
    if (ok === undefined) {
      return '<div class="order-line"><strong>' + label + ':</strong><span>' + value + '</span></div>';
    }
    const cls = ok ? 'req-met' : 'req-miss';
    return '<div class="order-line"><strong>' + label + ':</strong><span class="' + cls + '">' +
      value + ' ' + (ok ? '\u2713' : '\u2717') + '</span></div>';
  }

  // ---- Step-by-step instructions (under the order card) ----

  function renderInstructions() {
    if (!game.order || !game.orderRevealed || game.result) {
      dom.orderInstr.classList.add('hidden');
      return;
    }

    const steps = [];
    // Levels 2 & 3: player picks each layer manually
    if (game.level >= 2) {
      const layerCount = game.order ? game.order.layers : (game.level === 3 ? 3 : 2);
      steps.push(
        { text: 'Read the customer requirements',               done: game.step !== 'READ' },
        { text: 'Pick the frosting and ' + layerCount + ' layers', done: game.step !== 'READ' && game.step !== 'SELECT' },
        { text: 'Mix the batter (5s)',                         done: game.step === 'BAKE' || game.step === 'BAKING' || game.step === 'DECORATE' || game.step === 'SUBMIT' },
        { text: 'Bake the cake (5s)',                          done: game.step === 'DECORATE' || game.step === 'SUBMIT' },
        { text: 'Add the decorations',                          done: game.step === 'SUBMIT' },
        { text: 'Submit your cake',                             done: false }
      );
    } else {
      steps.push(
        { text: 'Read the customer requirements',               done: game.step !== 'READ' },
        { text: 'Pick the base and frosting',                   done: game.step !== 'READ' && game.step !== 'SELECT' },
        { text: 'Mix the batter (5s)',                         done: game.step === 'BAKE' || game.step === 'BAKING' || game.step === 'DECORATE' || game.step === 'SUBMIT' },
        { text: 'Bake the cake (5s)',                          done: game.step === 'DECORATE' || game.step === 'SUBMIT' },
        { text: 'Add the decorations',                          done: game.step === 'SUBMIT' },
        { text: 'Submit your cake',                             done: false }
      );
    }

    let html = '<div class="instr-title">What to do</div>';
    steps.forEach((s, i) => {
      const cls = s.done ? 'instr-step done' : 'instr-step';
      html += '<div class="' + cls + '">' + (i + 1) + '. ' + s.text + '</div>';
    });

    dom.orderInstr.innerHTML = html;
    dom.orderInstr.classList.remove('hidden');
  }

  // ---- Ingredient / decoration buttons ----

  function renderIngredientButtons() {
    const parts = [];
    const labelStyle = 'grid-column: 1 / -1; font-size: 12px; color: var(--ink-soft); margin-top: 8px;';

    if (game.level >= 2) {
      // Levels 2 & 3: individual layer rows, then frosting (last)
      for (let i = 0; i < game.cake.layers; i++) {
        parts.push('<div style="' + labelStyle + '">Layer ' + (i + 1) + '</div>');
        BASES.forEach((b) => parts.push(ingredientButton('layer' + (i + 1), b,
          game.cake.layerBases[i] && game.cake.layerBases[i].id === b.id)));
      }

      parts.push('<div style="' + labelStyle + '">Frosting (applied to all layers)</div>');
      FROSTINGS.forEach((f) => parts.push(ingredientButton('frosting', f, game.cake.frosting && game.cake.frosting.id === f.id)));
    } else {
      // Levels 1/2: base, frosting
      parts.push('<div style="' + labelStyle + '">Cake base</div>');
      BASES.forEach((b) => parts.push(ingredientButton('base', b, game.cake.base && game.cake.base.id === b.id)));
      parts.push('<div style="' + labelStyle + '">Frosting</div>');
      FROSTINGS.forEach((f) => parts.push(ingredientButton('frosting', f, game.cake.frosting && game.cake.frosting.id === f.id)));
    }

    dom.ingredientGrid.innerHTML = parts.join('');
  }

  function ingredientButton(type, item, selected) {
    return '<button class="ingredient-btn' + (selected ? ' selected' : '') +
      '" data-type="' + type + '" data-id="' + item.id + '">' +
      '<span class="swatch" style="background:' + item.color + '"></span>' + item.name + '</button>';
  }

  function renderDecorationButtons() {
    const parts = [];
    DECORATIONS.forEach((d) => {
      const has = game.cake.decorations.some((x) => x.id === d.id);
      parts.push('<button class="ingredient-btn' + (has ? ' selected' : '') +
        '" data-id="' + d.id + '"><span style="font-size:18px;">' + d.emoji + '</span>' + d.name + '</button>');
    });
    dom.decoGrid.innerHTML = parts.join('');
  }

  function renderCakeProgress() {
    const parts = [];
    if (game.level >= 2) {
      game.cake.layerBases.forEach((b, i) => {
        parts.push(chip('Layer ' + (i + 1) + ': ' + (b ? b.name : '?')));
      });
    } else if (game.cake.base) {
      parts.push(chip(game.cake.base.name));
    }
    if (game.cake.frosting) parts.push(chip(game.cake.frosting.name));
    parts.push(chip(game.cake.layers + ' layer' + (game.cake.layers > 1 ? 's' : '')));
    game.cake.decorations.forEach((d) => parts.push(chip(d.emoji + ' ' + d.name)));
    dom.cakeProgress.innerHTML = parts.join('');
  }

  function chip(text) {
    return '<span class="progress-chip">' + text + '</span>';
  }

  // ---------- 13. Cake drawing ----------

  function drawCake() {
    const w = dom.canvas.width;
    const h = dom.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#fdf2e3');
    grad.addColorStop(1, '#e7c9a0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const plateY = h - 90;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = '#cdb493';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(w / 2, plateY, 200, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const hasBase = game.level >= 2
      ? game.cake.layerBases.slice(0, game.cake.layers).some((b) => b)
      : game.cake.base;
    if (!hasBase) {
      ctx.fillStyle = '#a98763';
      ctx.font = 'italic 22px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(game.level >= 2 ? 'Pick a base for each layer to begin.' : 'Pick a base and a frosting to begin.', w / 2, plateY - 60);
      return;
    }

    const layerH = 56;
    const layerW = 280;
    const baseX = w / 2 - layerW / 2;
    let top = plateY - 4;

    for (let i = game.cake.layers - 1; i >= 0; i--) {
      top -= layerH;
      // Use per-layer color for Level 3, fall back to single base color
      const layerColor = (game.level >= 2)
        ? (game.cake.layerBases[i] ? game.cake.layerBases[i].color : '#D4A574')
        : game.cake.base.color;
      drawLayer(baseX, top, layerW, layerH, layerColor);
    }

    if (game.cake.state === 'decorated' || game.step === 'DECORATE' || game.step === 'SUBMIT' || game.step === 'RESULT') {
      drawDecorations(baseX, top, layerW);
    }
  }

  function drawLayer(x, y, w, h, baseColor) {
    const frostColor = game.cake.frosting ? game.cake.frosting.color : baseColor;

    ctx.fillStyle = baseColor;
    roundRect(x, y, w, h, 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + w - 18, y, 18, h);

    ctx.fillStyle = frostColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 8, x + w, y);
    ctx.lineTo(x + w, y + 10);
    ctx.lineTo(x, y + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = frostColor;
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x + 20 + i * (w - 40) / 5, y + 10, 6, 6 + (i % 2) * 4);
    }
  }

  function drawDecorations(x, y, w) {
    const centerX = x + w / 2;
    const topY = y - 8;

    game.cake.decorations.forEach((d) => {
      ctx.font = '24px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      if (d.id === 'candles') {
        for (let i = -1; i <= 1; i++) {
          const cx = centerX + i * 24;
          ctx.fillStyle = '#fff2b3'; ctx.fillRect(cx - 3, topY - 22, 6, 18);
          ctx.fillStyle = '#e89b6c'; ctx.fillRect(cx - 3, topY - 16, 6, 3);
          ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.arc(cx, topY - 26, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff7a8'; ctx.beginPath(); ctx.arc(cx, topY - 26, 2, 0, Math.PI * 2); ctx.fill();
        }
      } else if (d.id === 'sprinkles') {
        const colors = ['#ff7a8a', '#6baa50', '#5b9bd5', '#f6c343', '#b07ccc'];
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath(); ctx.arc(x + 20 + (i * 17) % (w - 40), topY - 4 - (i * 5) % 14, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (d.id === 'strawberry' || d.id === 'cherry') {
        const fx = centerX + (d.id === 'strawberry' ? -20 : 0);
        ctx.font = '26px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.fillText(d.emoji, fx, topY - 14);
        if (d.id === 'strawberry') ctx.fillText(d.emoji, fx + 30, topY - 10);
      } else if (d.id === 'cookie') {
        ctx.fillText(d.emoji, centerX - 18, topY - 8);
        ctx.fillText(d.emoji, centerX + 18, topY - 8);
      } else if (d.id === 'star') {
        ctx.font = '30px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.fillText(d.emoji, centerX, topY - 10);
      }
    });
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ---------- 14. Events ----------

  function onIngredientClick(e) {
    const btn = e.target.closest('.ingredient-btn');
    if (!btn) return;
    const type = btn.getAttribute('data-type');
    const id = btn.getAttribute('data-id');
    if (type) {
      selectIngredient(type, id, btn);
    } else if (game.step === 'DECORATE') {
      addDecoration(id);
    }
  }

  function onKey(e) {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'a') readOrder();
    else if (k === 'w' && game.step === 'BAKE') bake();
    else if (k === ' ' && game.step === 'DECORATE') { e.preventDefault(); submit(); }
  }

  function bind() {
    document.querySelectorAll('.level-card').forEach((card) => {
      card.addEventListener('click', () => startLevel(parseInt(card.getAttribute('data-level'), 10)));
    });
    dom.ingredientGrid.addEventListener('click', onIngredientClick);
    dom.decoGrid.addEventListener('click', onIngredientClick);
    dom.mixBtn.addEventListener('click', mixBatter);
    dom.ovenBtn.addEventListener('click', bake);
    dom.submitBtn.addEventListener('click', submit);
    dom.restartBtn.addEventListener('click', () => startLevel(game.level));
    dom.retryBtn.addEventListener('click', () => { dom.resultOverlay.classList.add('hidden'); startLevel(game.level); });
    dom.nextLevelBtn.addEventListener('click', () => { dom.resultOverlay.classList.add('hidden'); showLevelSelect(); });
    document.addEventListener('keydown', onKey);
  }

  // ---------- 15. Level flow ----------

  function showLevelSelect() {
    stopTimer();
    stopPhaseTimer();
    dom.customerFace.classList.remove('happy', 'sad');
    dom.levelSelect.classList.remove('hidden');
    dom.gameScreen.classList.add('hidden');
    dom.resultOverlay.classList.add('hidden');
    dom.orderInstr.classList.add('hidden');
  }

  function startLevel(level) {
    stopTimer();
    stopPhaseTimer();

    game.level = level;
    game.order = generateOrder(level);
    game.orderRevealed = false;
    game.cake = {
      base: null,
      frosting: null,
      layerBases: level >= 2 ? new Array(LEVELS[level].minLayers).fill(null) : [],
      decorations: [],
      layers: level >= 2 ? LEVELS[level].minLayers : 1,
      state: 'empty'
    };
    game.timeLimit = LEVELS[level].timeLimit;
    game.result = null;

    dom.levelDisplay.textContent = level;
    dom.mixBtn.disabled = true;
    dom.ovenBtn.disabled = false;
    dom.submitBtn.disabled = true;
    dom.customerFace.classList.remove('happy', 'sad');
    dom.resultOverlay.classList.add('hidden');
    dom.orderInstr.classList.add('hidden');

    dom.mixProgress.classList.add('hidden');
    dom.mixBar.style.width = '0%';
    dom.bakeProgress.classList.add('hidden');
    dom.bakeBar.style.width = '0%';
    dom.ovenVisual.classList.remove('on');

    dom.levelSelect.classList.add('hidden');
    dom.gameScreen.classList.remove('hidden');

    setStep('READ');
    startTimer();

    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') runDemo();
  }

  // ---------- 16. Boot ----------

  function boot() {
    bind();
    const params = new URLSearchParams(window.location.search);
    const levelParam = parseInt(params.get('level'), 10);
    if (levelParam >= 1 && levelParam <= 3) { startLevel(levelParam); }
    else { showLevelSelect(); }
  }

  function runDemo() {
    setTimeout(() => {
      readOrder();
      setTimeout(() => {
        if (game.level >= 2) {
          // Levels 2 & 3: pick layers + frosting (no separate base)
          const layerCount = game.order.layers;
          const layerBases = game.order.layerBases;
          for (let i = 0; i < layerCount; i++) {
            setTimeout(() => {
              const btns = document.querySelectorAll('#ingredientGrid .ingredient-btn[data-type="layer' + (i + 1) + '"]');
              for (const b of btns) {
                if (b.getAttribute('data-id') === layerBases[i].id) { b.click(); break; }
              }
            }, i * 300);
          }
          setTimeout(() => {
            const wantedFrost = game.order.frosting.id;
            document.querySelectorAll('#ingredientGrid .ingredient-btn[data-type="frosting"]').forEach((f) => {
              if (f.getAttribute('data-id') === wantedFrost) f.click();
            });
          }, layerCount * 300);
          setTimeout(() => { mixBatter(); }, layerCount * 300 + 300);
        } else {
          // Levels 1/2: base + frosting
          const wantedBase = game.order.base.id;
          const wantedFrost = game.order.frosting.id;
          document.querySelectorAll('#ingredientGrid .ingredient-btn[data-type="base"]').forEach((b) => {
            if (b.getAttribute('data-id') === wantedBase) b.click();
          });
          document.querySelectorAll('#ingredientGrid .ingredient-btn[data-type="frosting"]').forEach((f) => {
            if (f.getAttribute('data-id') === wantedFrost) f.click();
          });
          setTimeout(() => { mixBatter(); }, 200);
        }

        // Bake after mixing (add delay for L3 layer picking)
        const layerPickDelay = game.level >= 2 ? (game.order.layers * 300 + 600) : 0;
        setTimeout(() => { bake(); }, (MIX_DURATION + 1) * 1000 + 500 + layerPickDelay);

        // Decorate after baking
        setTimeout(() => {
          const decos = document.querySelectorAll('#decoGrid .ingredient-btn');
          for (const id of game.order.decorations.map((d) => d.id)) {
            for (const b of decos) { if (b.getAttribute('data-id') === id) { b.click(); break; } }
          }
        }, (MIX_DURATION + BAKE_DURATION + 2) * 1000 + 500 + layerPickDelay);
      }, 200);
    }, 200);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
})();
