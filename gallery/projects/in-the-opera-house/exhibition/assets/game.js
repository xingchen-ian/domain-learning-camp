/* =====================================================
   In the Opera House — Game Logic (v4)
   Left/right movement only, INTERACT-only controls:
   mirror code → drawer → lens → ladder → spotlight
   → adjust beam on ladder → chair → key → side door.
   ===================================================== */

(function () {
  'use strict';

  // ---------------- Constants ----------------
  const TOTAL_TIME = 600; // 10 minutes in seconds
  const CORRECT_CODE = ['red', 'blue', 'gold'];
  const CHAIR_ANGLE_MIN = -10;
  const CHAIR_ANGLE_MAX = 10;
  const MOVE_SPEED = 0.4; // percentage per frame
  const ADJUST_SPEED = 0.6; // degrees per frame in adjustment mode
  const FIXED_Y = 20; // fixed y position — singer only moves left/right

  // All color classes for code slots
  const COLOR_CLASSES = ['red', 'orange', 'gold', 'green', 'turquoise', 'blue', 'purple'];

  // ---------------- Game state ----------------
  const state = {
    timeRemaining: TOTAL_TIME,
    active: false,
    level: 1,
    inventory: [],
    drawerUnlocked: false,
    lensFixed: false,
    spotlightOn: false,
    curtainOpen: false,
    chairLit: false,
    keyTaken: false,
    escaped: false,
    escaping: false,
    started: false,
    angle: -25,
    codeIndex: 0,
    enteredCode: [null, null, null],

    // Movement / room state
    currentRoom: 'dressing-room',
    stageRevealed: false,
    positions: {
      'dressing-room': { x: 12, y: FIXED_Y },
      'stage-area': { x: 12, y: FIXED_Y }
    },
    keys: {
      w: false, a: false, s: false, d: false, q: false, e: false,
      ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
    },
    isMoving: false,
    facingRight: true,
    lastFrameTime: 0,

    // Ladder / spotlight adjustment state
    onLadder: false,
    isClimbing: false,
    adjustingSpotlight: false,
    ladderFloorPos: null,
    ladderPos: { x: 57, y: 14 }
  };

  let timerId = null;
  let moveFrameId = null;
  let climbAnimId = null;

  // ---------------- DOM references ----------------
  const els = {
    levelDisplay: document.getElementById('level-display'),
    timerDisplay: document.getElementById('timer-display'),
    message: document.getElementById('message'),
    inventorySlots: document.querySelectorAll('#inventory-slots .slot'),

    dressingRoom: document.getElementById('dressing-room'),
    stageArea: document.getElementById('stage-area'),
    singerDressing: document.getElementById('singer'),
    singerStage: document.getElementById('singer-stage'),

    mirror: document.getElementById('mirror'),
    drawer: document.getElementById('drawer'),
    drawerContents: document.getElementById('drawer-contents'),
    lens: document.getElementById('lens'),
    poem: document.getElementById('poem'),

    ladder: document.getElementById('ladder'),
    spotlight: document.getElementById('spotlight'),
    beam: document.getElementById('spotlight-beam'),
    controls: document.getElementById('spotlight-controls'),
    angleDisplay: document.getElementById('angle-display'),
    curtain: document.getElementById('curtain'),
    chair: document.getElementById('chair'),
    key: document.getElementById('key'),
    sideDoor: document.getElementById('side-door'),
    exitGlow: document.querySelector('.exit-glow'),

    spotlightPanel: document.getElementById('spotlight-panel'),
    adjustMode: document.getElementById('adjust-mode'),
    adjustAngleVal: document.getElementById('adjust-angle-val'),

    codeModal: document.getElementById('code-modal'),
    codeSlots: document.querySelectorAll('#code-slots .code-slot'),
    colorButtons: document.querySelectorAll('.color-btn'),
    submitCode: document.getElementById('submit-code'),
    cancelCode: document.getElementById('cancel-code'),
    poemModal: document.getElementById('poem-modal'),
    closePoem: document.querySelector('#poem-modal .close-modal'),

    clueModal: document.getElementById('clue-modal'),
    clueTitle: document.getElementById('clue-title'),
    clueText: document.getElementById('clue-text'),
    clueIcon: document.getElementById('clue-icon'),
    closeClue: document.getElementById('close-clue'),
    winScreen: document.getElementById('win-screen'),
    loseScreen: document.getElementById('lose-screen'),
    playAgainWin: document.getElementById('play-again-win'),
    playAgainLose: document.getElementById('play-again-lose'),
    winTime: document.getElementById('win-time'),

    introScreen: document.getElementById('intro-screen'),
    startBtn: document.getElementById('btn-start'),
    roomDoorLabel: document.getElementById('room-door-label'),

    // Touch controls
    btnUp: document.getElementById('btn-up'),
    btnDown: document.getElementById('btn-down'),
    btnLeft: document.getElementById('btn-left'),
    btnRight: document.getElementById('btn-right'),
    btnInteract: document.getElementById('btn-interact'),
    interactHint: document.getElementById('interact-hint')
  };

  // ---------------- Utility ----------------
  function distSq(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
  }

  function getProximityTargets(room) {
    if (room === 'dressing-room') {
      return [
        { id: 'mirror', cx: 91, cy: 28, r: 20 },
        { id: 'dtable', cx: 80, cy: 30, r: 26 }
      ];
    }
    if (room === 'stage-area') {
      return [
        { id: 'ladder', cx: state.ladderPos.x + 2.5, cy: state.ladderPos.y + 10, r: 18 },
        { id: 'chair',  cx: 50, cy: 22, r: 18 },
        { id: 'door',   cx: 88, cy: 30, r: 24 }
      ];
    }
    return [];
  }

  function findNearestTarget(room) {
    // When on the ladder, the only interactable is the spotlight
    if (state.onLadder) {
      return { id: 'spotlight_top', cx: 50, cy: 10, r: 999 };
    }

    // When adjusting spotlight, always allow stop
    if (state.adjustingSpotlight) {
      return { id: 'spotlight_top', cx: 50, cy: 10, r: 999 };
    }

    const pos = state.positions[room];
    const sx = pos.x + 2.5;
    const sy = pos.y + 6;
    const list = getProximityTargets(room);
    let best = null;
    let bestDS = Infinity;
    for (const t of list) {
      const ds = distSq(sx, sy, t.cx, t.cy);
      if (ds < t.r * t.r && ds < bestDS) {
        bestDS = ds;
        best = t;
      }
    }
    return best;
  }

  function getInteractAction(target) {
    const room = state.currentRoom;
    if (!target) return null;

    // ---- On ladder: spotlight interactions ----
    if (state.onLadder && room === 'stage-area') {
      if (!state.lensFixed) {
        if (!hasItem('lens')) {
          return { label: 'Climb Down', action: 'climb_down' };
        }
        return { label: 'Fix Spotlight', action: 'spotlight_fix' };
      }
      // After fixing: spotlight auto on, curtain auto open
      if (state.spotlightOn && state.curtainOpen && !state.chairLit) {
        if (state.adjustingSpotlight) {
          return { label: 'Stop Adjusting', action: 'spotlight_stop_adjust' };
        }
        return { label: 'Adjust Spotlight', action: 'spotlight_adjust' };
      }
      return null;
    }

    // ---- Dressing room interactions ----
    if (room === 'dressing-room') {
      if (target.id === 'mirror') {
        return { label: 'Examine Mirror', action: 'mirror' };
      }
      if (target.id === 'dtable') {
        if (!state.drawerUnlocked) {
          return { label: 'Unlock Drawer', action: 'drawer_unlock' };
        }
        if (!hasItem('lens') || !hasItem('poem')) {
          return { label: 'Collect Items', action: 'collect_drawer' };
        }
        return { label: 'Drawer (empty)', action: null };
      }
    }

    // ---- Stage area (floor) interactions ----
    if (room === 'stage-area') {
      if (target.id === 'ladder') {
        if (state.lensFixed) return null;
        return { label: 'Climb Ladder', action: 'climb_up' };
      }
      if (target.id === 'chair') {
        if (state.chairLit && !state.keyTaken) {
          return { label: 'Take Key', action: 'take_key' };
        }
        return null;
      }
      if (target.id === 'door') {
        if (state.keyTaken) {
          return { label: 'Escape!', action: 'escape' };
        }
        return { label: 'Locked Door', action: 'door_locked' };
      }
    }

    return null;
  }

  function updateInteractHint() {
    if (!state.active || isModalOpen()) {
      els.interactHint.classList.remove('visible');
      els.interactHint.textContent = '';
      els.btnInteract.classList.remove('interact-active', 'glow-hint');
      return;
    }

    const target = findNearestTarget(state.currentRoom);
    const action = getInteractAction(target);

    if (action && action.action) {
      els.interactHint.textContent = action.label;
      els.interactHint.classList.add('visible');
      els.btnInteract.classList.add('interact-active');
      els.btnInteract.classList.add('glow-hint');
    } else if (action && !action.action) {
      els.interactHint.textContent = action.label;
      els.interactHint.classList.add('visible');
      els.btnInteract.classList.remove('interact-active', 'glow-hint');
    } else {
      els.interactHint.classList.remove('visible');
      els.interactHint.textContent = '';
      els.btnInteract.classList.remove('interact-active', 'glow-hint');
    }
  }

  function onInteractPress() {
    if (!state.active) return;
    if (isModalOpen()) return;
    if (state.escaping) return;
    if (state.isClimbing) return;

    const target = findNearestTarget(state.currentRoom);
    const action = getInteractAction(target);
    if (!action || !action.action) return;

    // Visual feedback on button
    els.btnInteract.style.transform = 'scale(0.9)';
    setTimeout(() => { els.btnInteract.style.transform = ''; }, 120);

    switch (action.action) {
      case 'mirror':              onMirror(); break;
      case 'drawer_unlock':       onDrawer(); break;
      case 'collect_drawer':
        if (!hasItem('lens')) onLens();
        else if (!hasItem('poem')) onPoem();
        break;
      case 'spotlight_fix':       onSpotlightFix(); break;
      case 'spotlight_adjust':    enterAdjustMode(); break;
      case 'spotlight_stop_adjust': exitAdjustMode(); break;
      case 'climb_up':            climbUp(); break;
      case 'climb_down':          climbDown(); break;
      case 'take_key':            onKey(); break;
      case 'escape':              onSideDoor(); break;
      case 'door_locked':
        setMessage('The side door is locked. You need a key to escape.');
        break;
    }
  }

  // ---------------- Utility functions ----------------
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function setMessage(text) {
    els.message.textContent = text;
  }

  function hasItem(item) {
    return state.inventory.includes(item);
  }

  function addItem(item) {
    if (!hasItem(item)) {
      state.inventory.push(item);
      renderInventory();
    }
  }

  function removeItem(item) {
    const idx = state.inventory.indexOf(item);
    if (idx !== -1) {
      state.inventory.splice(idx, 1);
      renderInventory();
    }
  }

  function renderInventory() {
    const icons = {
      lens: '<div class="inventory-icon lens-icon" title="Spotlight lens"></div>',
      poem: '<div class="inventory-icon poem-icon" title="Poem">poem</div>',
      key: '<div class="inventory-icon key-icon" title="Golden key"></div>'
    };
    els.inventorySlots.forEach((slot, i) => {
      slot.innerHTML = icons[state.inventory[i]] || '';
      slot.dataset.item = state.inventory[i] || '';
    });
  }

  function updateLevelDisplay() {
    els.levelDisplay.textContent = `Level ${state.level}`;
  }

  // ---------------- Timer ----------------
  function startTimer() {
    if (timerId) return;
    timerId = setInterval(() => {
      if (!state.active) return;
      state.timeRemaining -= 1;
      els.timerDisplay.textContent = formatTime(state.timeRemaining);

      if (state.timeRemaining <= 60) {
        els.timerDisplay.classList.add('warning');
      }
      if (state.timeRemaining <= 0) {
        endGame(false);
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  // ---------------- Level progression ----------------
  function advanceToLevel(level) {
    state.level = level;
    updateLevelDisplay();
  }

  function getActiveSinger() {
    return state.currentRoom === 'dressing-room' ? els.singerDressing : els.singerStage;
  }

  function updateSingerVisuals() {
    const singer = getActiveSinger();
    const pos = state.positions[state.currentRoom];
    if (!singer || !pos) return;

    singer.style.left = `${pos.x}%`;
    singer.style.bottom = `${pos.y}%`;
    singer.style.setProperty('--flip', state.facingRight ? '1' : '-1');

    // No depth scaling — singer stays same size everywhere
    singer.style.setProperty('--depth-scale', '1');

    if (state.isMoving) {
      singer.classList.add('walking');
    } else {
      singer.classList.remove('walking');
    }
  }

  function switchRoom(targetRoom) {
    if (targetRoom === state.currentRoom) return;

    // Reset ladder state when leaving stage
    if (state.currentRoom === 'stage-area') {
      if (state.onLadder || state.isClimbing) {
        if (climbAnimId) { cancelAnimationFrame(climbAnimId); climbAnimId = null; }
        state.onLadder = false;
        state.isClimbing = false;
        state.adjustingSpotlight = false;
        els.adjustMode.classList.add('hidden');
        els.singerStage.classList.remove('on-ladder', 'climbing');
      }
    }

    if (targetRoom === 'stage-area') {
      if (!state.stageRevealed) {
        state.stageRevealed = true;
        els.stageArea.classList.remove('unrevealed');
        setMessage('The opera singer steps onto the stage. The grand curtain rises into the light.');
      } else {
        setMessage('The opera singer returns to the stage.');
      }
      state.currentRoom = 'stage-area';
      state.positions['stage-area'] = { x: 16, y: FIXED_Y };
    } else {
      state.currentRoom = 'dressing-room';
      state.positions['dressing-room'] = { x: 62, y: FIXED_Y };
      setMessage('Back in the dressing room.');
    }

    updateSingerVisuals();
    updateRoomVisibility();
  }

  function updateRoomVisibility() {
    els.singerDressing.style.opacity = state.currentRoom === 'dressing-room' ? '1' : '0';
    els.singerStage.style.opacity = state.currentRoom === 'stage-area' ? '1' : '0';
    els.singerDressing.style.pointerEvents = 'none';
    els.singerStage.style.pointerEvents = 'none';

    // Update the shared door's label + arrow to match the current room
    if (els.roomDoorLabel) {
      if (state.currentRoom === 'dressing-room') {
        els.roomDoorLabel.innerHTML = 'go to the stage <span class="door-arrow">&rarr;</span>';
      } else {
        els.roomDoorLabel.innerHTML = '<span class="door-arrow">&larr;</span> go to the dressing room';
      }
    }
  }

  // ---------------- Movement ----------------
  function wouldCollide(room, newX) {
    const singerW = 5; // percent width
    // Only x bounds — singer only moves left/right at fixed y
    if (newX < 0 || newX + singerW > 100) {
      return true;
    }
    return false;
  }

  function isInExitZone(room, x) {
    if (room === 'dressing-room') return x >= 93;
    if (room === 'stage-area') return x <= 7;
    return false;
  }

  function isModalOpen() {
    return !els.codeModal.classList.contains('hidden') ||
           !els.poemModal.classList.contains('hidden') ||
           !els.clueModal.classList.contains('hidden');
  }

  function moveLoop(timestamp) {
    if (!state.active) {
      moveFrameId = null;
      return;
    }

    const k = state.keys;

    // ---- Spotlight adjustment mode: LEFT/RIGHT controls beam (reversed direction) ----
    if (state.adjustingSpotlight) {
      if (k.a || k.ArrowLeft || k.q) {
        state.angle = Math.min(45, state.angle + ADJUST_SPEED);
      }
      if (k.d || k.ArrowRight || k.e) {
        state.angle = Math.max(-45, state.angle - ADJUST_SPEED);
      }
      updateSpotlightBeam();
      updateInteractHint();
      moveFrameId = requestAnimationFrame(moveLoop);
      return;
    }

    // ---- On ladder: no movement, no visual updates (CSS transition handles animation) ----
    if (state.onLadder) {
      state.isMoving = false;
      // Do NOT call updateSingerVisuals() here — it would override the CSS transition
      // by resetting inline left/bottom every frame, breaking the smooth climb animation.
      updateInteractHint();
      moveFrameId = requestAnimationFrame(moveLoop);
      return;
    }

    // ---- Climbing animation in progress (climb-down): no movement, no visual updates ----
    if (state.isClimbing) {
      state.isMoving = false;
      updateInteractHint();
      moveFrameId = requestAnimationFrame(moveLoop);
      return;
    }

    // ---- Normal movement: LEFT/RIGHT only ----
    let dx = 0;

    if (!isModalOpen() && !state.escaping) {
      if (k.a || k.ArrowLeft) { dx -= MOVE_SPEED; state.facingRight = false; }
      if (k.d || k.ArrowRight) { dx += MOVE_SPEED; state.facingRight = true; }
    }

    state.isMoving = dx !== 0;

    if (state.isMoving) {
      const pos = state.positions[state.currentRoom];
      let newX = pos.x + dx;

      if (!wouldCollide(state.currentRoom, newX)) {
        pos.x = newX;
      }

      // Room transition detection
      if (isInExitZone(state.currentRoom, pos.x)) {
        const target = state.currentRoom === 'dressing-room' ? 'stage-area' : 'dressing-room';
        switchRoom(target);
      }
    }

    updateSingerVisuals();
    updateInteractHint();
    moveFrameId = requestAnimationFrame(moveLoop);
  }

  function startMovementLoop() {
    if (!moveFrameId) {
      moveFrameId = requestAnimationFrame(moveLoop);
    }
  }

  // ---------------- Ladder mechanics ----------------
  function climbUp() {
    if (state.currentRoom !== 'stage-area') return;
    if (climbAnimId) { cancelAnimationFrame(climbAnimId); climbAnimId = null; }

    state.onLadder = true;
    state.isClimbing = true;
    state.isMoving = false;
    state.ladderFloorPos = { ...state.positions['stage-area'] };

    const singer = els.singerStage;
    singer.classList.remove('walking');
    singer.classList.add('climbing');

    const startPos = { ...state.ladderFloorPos };

    // Dynamically calculate the ladder top position so singer reaches the spotlight
    const stageEl = document.getElementById('stage-area');
    const stageH = stageEl.clientHeight || 600;
    const ladderBottomPct = 14;      // CSS: bottom: 14%
    const ladderHeightPx = 280;      // CSS: height: 280px
    const ladderTopPx = (ladderBottomPct / 100) * stageH + ladderHeightPx;
    const ladderTopPct = (ladderTopPx / stageH) * 100;
    // Place singer's feet near the top of the ladder (slight offset for standing on rung)
    const endY = Math.min(ladderTopPct - 6, 72);

    const endPos = { x: state.ladderPos.x, y: endY };
    const duration = 850;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-in-out cubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const x = startPos.x + (endPos.x - startPos.x) * ease;
      const y = startPos.y + (endPos.y - startPos.y) * ease;

      state.positions['stage-area'] = { x, y };
      singer.style.left = x + '%';
      singer.style.bottom = y + '%';

      if (t < 1) {
        climbAnimId = requestAnimationFrame(step);
      } else {
        state.positions['stage-area'] = { x: endPos.x, y: endPos.y };
        singer.style.left = endPos.x + '%';
        singer.style.bottom = endPos.y + '%';
        singer.classList.add('on-ladder');
        state.isClimbing = false;
        climbAnimId = null;
      }
    }

    climbAnimId = requestAnimationFrame(step);
    setMessage('The opera singer climbs the ladder to the spotlight high above the stage.');
  }

  function climbDown(silent) {
    if (state.adjustingSpotlight) {
      state.adjustingSpotlight = false;
      els.adjustMode.classList.add('hidden');
      Object.keys(state.keys).forEach(k => { state.keys[k] = false; });
    }
    if (climbAnimId) { cancelAnimationFrame(climbAnimId); climbAnimId = null; }

    state.onLadder = false;
    state.isClimbing = true;
    state.isMoving = false;

    const singer = els.singerStage;
    singer.classList.remove('walking', 'on-ladder');
    singer.classList.add('climbing');

    const startPos = { ...state.positions['stage-area'] };
    const endPos = state.ladderFloorPos || { x: 40, y: FIXED_Y };
    const duration = 850;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-in-out cubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const x = startPos.x + (endPos.x - startPos.x) * ease;
      const y = startPos.y + (endPos.y - startPos.y) * ease;

      state.positions['stage-area'] = { x, y };
      singer.style.left = x + '%';
      singer.style.bottom = y + '%';

      if (t < 1) {
        climbAnimId = requestAnimationFrame(step);
      } else {
        state.positions['stage-area'] = { x: endPos.x, y: endPos.y };
        singer.style.left = endPos.x + '%';
        singer.style.bottom = endPos.y + '%';
        singer.classList.remove('climbing');
        state.isClimbing = false;
        climbAnimId = null;
      }
    }

    climbAnimId = requestAnimationFrame(step);
    if (!silent) {
      setMessage('The opera singer climbs down the ladder.');
    }
  }

  // ---------------- Spotlight logic ----------------
  function updateSpotlightBeam() {
    els.beam.style.transform = `rotate(${state.angle}deg)`;
    els.angleDisplay.textContent = `${state.angle}°`;
    if (els.adjustAngleVal) {
      els.adjustAngleVal.textContent = `${Math.round(state.angle)}°`;
    }

    const hitChair = state.spotlightOn &&
      state.curtainOpen &&
      state.angle >= CHAIR_ANGLE_MIN &&
      state.angle <= CHAIR_ANGLE_MAX;

    if (hitChair) {
      if (!state.chairLit) {
        state.chairLit = true;
        els.beam.classList.add('hit-chair');
        if (!state.keyTaken) {
          els.key.classList.remove('hidden');
          els.key.classList.add('glow');
        }
        setMessage('The beam finds the chair! A golden key glints on the velvet cushion.');

        // Auto exit adjustment mode
        state.adjustingSpotlight = false;
        els.adjustMode.classList.add('hidden');
        Object.keys(state.keys).forEach(k => { state.keys[k] = false; });

        // Auto climb down after a brief delay, then ladder slides left
        setTimeout(() => {
          if (!state.active) return;
          climbDown(true);

          setTimeout(() => {
            if (!state.active) return;
            state.ladderPos = { x: 8, y: 14 };
            els.ladder.style.left = '8%';
            els.ladder.style.bottom = '14%';
            setMessage('The opera singer descends the ladder. It slides to the left. Walk to the chair and take the key.');
          }, 900);
        }, 1000);
      }
    } else {
      if (state.chairLit) {
        state.chairLit = false;
        els.beam.classList.remove('hit-chair');
        if (!state.keyTaken) {
          els.key.classList.add('hidden');
          els.key.classList.remove('glow');
        }
      }
    }
  }

  function enterAdjustMode() {
    state.adjustingSpotlight = true;
    els.adjustMode.classList.remove('hidden');
    setMessage('Use ◀ ▶ (D-pad or Q/E) to aim the spotlight beam. Find what the poem hints at.');
    updateSpotlightBeam();
  }

  function exitAdjustMode() {
    state.adjustingSpotlight = false;
    els.adjustMode.classList.add('hidden');
    Object.keys(state.keys).forEach(k => { state.keys[k] = false; });
    setMessage('You stop adjusting the beam. Press INTERACT to try again.');
  }

  // ---------------- Interactions ----------------
  function onMirror() {
    if (!state.active) return;
    setMessage('The mirror has three colored stickers: red, blue, and gold. They must mean something.');
    els.mirror.classList.add('glow');
    setTimeout(() => els.mirror.classList.remove('glow'), 2000);
  }

  function onDrawer() {
    if (!state.active) return;
    if (state.drawerUnlocked) {
      setMessage('The drawer is already open. The lens and poem are inside.');
      return;
    }
    openCodeModal();
  }

  function openCodeModal() {
    state.codeIndex = 0;
    state.enteredCode = [null, null, null];
    renderCodeSlots();
    els.codeModal.classList.remove('hidden');
  }

  function closeCodeModal() {
    els.codeModal.classList.add('hidden');
  }

  function renderCodeSlots() {
    els.codeSlots.forEach((slot, i) => {
      const color = state.enteredCode[i];
      slot.dataset.value = color || '';
      slot.textContent = color ? color[0].toUpperCase() : '?';
      // Remove all color classes
      COLOR_CLASSES.forEach(c => slot.classList.remove(c));
      slot.classList.remove('selected');
      if (color) slot.classList.add(color);
      if (i === state.codeIndex) slot.classList.add('selected');
    });
  }

  function selectCodeSlot(index) {
    state.codeIndex = index;
    renderCodeSlots();
  }

  function setCodeColor(color) {
    state.enteredCode[state.codeIndex] = color;
    const next = state.enteredCode.findIndex((c) => c === null);
    state.codeIndex = next !== -1 ? next : 2;
    renderCodeSlots();
  }

  function submitCode() {
    const entered = state.enteredCode.join(',');
    const correct = CORRECT_CODE.join(',');
    if (entered === correct) {
      state.drawerUnlocked = true;
      els.drawer.classList.add('open');
      els.drawerContents.classList.remove('hidden');
      els.drawerContents.classList.add('open');
      closeCodeModal();
      setMessage('The drawer clicks open. A lens and a torn poem lie inside.');
      advanceToLevel(2);
    } else {
      setMessage('The lock rattles but does not open. The code order must be wrong.');
      const panel = els.codeModal.querySelector('.modal-panel');
      panel.style.animation = 'none';
      panel.offsetHeight; // reflow
      panel.style.animation = 'shake 0.4s ease';
    }
  }

  function onLens() {
    if (!state.active || !state.drawerUnlocked) return;
    if (hasItem('lens')) {
      setMessage('You already have the lens.');
      return;
    }
    addItem('lens');
    els.lens.classList.add('hidden');
    setMessage('You pocket the spotlight lens. It might fit the broken stage light.');
  }

  function onPoem() {
    if (!state.active || !state.drawerUnlocked) return;
    els.poemModal.classList.remove('hidden');
    if (!hasItem('poem')) {
      addItem('poem');
      setMessage('You read the poem. It hints at the spotlight and the chair.');
    }
  }

  function closePoemModal() {
    els.poemModal.classList.add('hidden');
  }

  // ---------------- Click-to-inspect clue system ----------------
  const itemClues = {
    mirror: {
      icon: '🪞',
      getTitle: function() { return 'The Ornate Mirror'; },
      getText: function() {
        if (state.drawerUnlocked) {
          return 'The three colored stickers — red, blue, and gold — have served their purpose. The code they revealed has unlocked the drawer. The mirror reflects your progress.';
        }
        return 'Three colored stickers cling to the mirror\'s gilded frame: a red one near the top, a blue one in the center, and a gold one toward the bottom. They seem deliberately placed. Their order might be a key...';
      }
    },
    drawer: {
      icon: '🔒',
      getTitle: function() { return 'The Locked Drawer'; },
      getText: function() {
        if (state.drawerUnlocked) {
          if (hasItem('lens') || hasItem('poem')) {
            return 'The drawer stands open. A lens and a torn poem were found inside — evidence of a forgotten performance. Take them before moving on.';
          }
          return 'The drawer is open and empty. Whatever secrets it held have been claimed.';
        }
        return 'A heavy oak drawer with a brass lock. Seven colored buttons are set in a row — red, orange, gold, green, turquoise, blue, purple. Three must be pressed in the correct sequence. The mirror\'s stickers may hold the answer...';
      }
    },
    spotlight: {
      icon: '💡',
      getTitle: function() { return 'The Broken Spotlight'; },
      getText: function() {
        if (state.spotlightOn) {
          if (state.chairLit) {
            return 'The spotlight blazes overhead, its beam now perfectly aimed at the empty chair. The golden key has been revealed. The path to escape grows clearer.';
          }
          if (state.lensFixed) {
            return 'The lens has been replaced and the spotlight burns bright. But the beam points aimlessly into the dark. "Golden sunbeams brush the seat" — perhaps the angle needs adjusting...';
          }
          return 'The spotlight is lit, but something is not yet right. The beam needs to be directed.';
        }
        return 'The spotlight hangs cold and dark from the ceiling. Its lens is missing — only an empty socket remains. Without a lens, no beam can be cast. A replacement must be found somewhere in the theatre...';
      }
    }
  };

  function showClue(itemId) {
    if (!state.active) return;
    if (isModalOpen()) return;
    var clue = itemClues[itemId];
    if (!clue) return;

    els.clueIcon.textContent = clue.icon;
    els.clueTitle.textContent = clue.getTitle();
    els.clueText.textContent = clue.getText();
    els.clueModal.classList.remove('hidden');
  }

  function closeClueModal() {
    els.clueModal.classList.add('hidden');
  }

  function onSpotlightFix() {
    if (!state.active) return;
    if (!hasItem('lens')) {
      setMessage('The spotlight is missing its lens. It cannot turn on.');
      return;
    }
    state.lensFixed = true;
    removeItem('lens');
    els.spotlight.classList.add('fixed');
    setMessage('The lens fits perfectly. The spotlight blazes to life!');

    // Auto turn on spotlight
    state.spotlightOn = true;
    els.beam.classList.remove('hidden');
    els.beam.classList.add('on');

    // Curtain opens after spotlight turns on — singer stays on ladder
    setTimeout(() => {
      if (!state.active) return;
      state.curtainOpen = true;
      els.curtain.classList.add('open');
      els.chair.classList.remove('hidden');
      setMessage('The curtain opens, revealing a lone chair. Press INTERACT to adjust the spotlight beam — "Golden sunbeams brush the seat."');
      advanceToLevel(3);
      updateSpotlightBeam();
    }, 1200);
  }

  function onKey() {
    if (!state.active || !state.chairLit) return;
    if (state.keyTaken) return;

    state.keyTaken = true;
    addItem('key');
    els.key.classList.add('hidden');
    els.key.classList.remove('glow');
    els.exitGlow.classList.remove('hidden');
    setMessage('You take the golden key. The side door is waiting.');
  }

  function onSideDoor() {
    if (!state.active) return;
    if (!state.keyTaken) {
      setMessage('The side door is locked. You need a key to escape.');
      return;
    }

    state.escaping = true;
    Object.keys(state.keys).forEach(k => { state.keys[k] = false; });

    // Open door animation
    const doorPanel = els.sideDoor.querySelector('.door-panel');
    if (doorPanel) {
      doorPanel.style.transition = 'transform 0.8s ease';
      doorPanel.style.transformOrigin = 'left center';
      doorPanel.style.transform = 'perspective(400px) rotateY(-75deg)';
    }
    setMessage('The key turns in the lock. The side door swings open...');

    // After 2 seconds, singer walks through door and disappears
    setTimeout(() => {
      if (!state.active) return;
      const singer = getActiveSinger();
      const pos = state.positions[state.currentRoom];

      // Animate singer walking toward door and fading out
      singer.style.transition = 'left 1.5s ease-in, opacity 1s ease-in 0.8s';
      pos.x = 90;
      singer.style.left = '90%';
      singer.style.opacity = '0';
      setMessage('The opera singer slips through the door and escapes into the night!');

      setTimeout(() => {
        endGame(true);
      }, 2000);
    }, 2000);
  }

  // ---------------- End screens ----------------
  function endGame(win) {
    if (!state.active) return;
    state.active = false;
    stopTimer();
    cancelAnimationFrame(moveFrameId);
    moveFrameId = null;
    if (climbAnimId) { cancelAnimationFrame(climbAnimId); climbAnimId = null; }

    if (win) {
      state.escaped = true;
      const used = TOTAL_TIME - state.timeRemaining;
      const m = Math.floor(used / 60);
      const s = used % 60;
      els.winTime.textContent = `Escaped in ${m}m ${s}s with ${formatTime(state.timeRemaining)} remaining.`;
      els.winScreen.classList.remove('hidden');
    } else {
      els.loseScreen.classList.remove('hidden');
    }
  }

  function resetGame() {
    stopTimer();
    cancelAnimationFrame(moveFrameId);
    moveFrameId = null;
    if (climbAnimId) { cancelAnimationFrame(climbAnimId); climbAnimId = null; }

    state.timeRemaining = TOTAL_TIME;
    state.active = true;
    state.level = 1;
    state.inventory = [];
    state.drawerUnlocked = false;
    state.lensFixed = false;
    state.spotlightOn = false;
    state.curtainOpen = false;
    state.chairLit = false;
    state.keyTaken = false;
    state.escaped = false;
    state.escaping = false;
    state.angle = -25;
    state.codeIndex = 0;
    state.enteredCode = [null, null, null];
    state.currentRoom = 'dressing-room';
    state.stageRevealed = false;
    state.positions = {
      'dressing-room': { x: 12, y: FIXED_Y },
      'stage-area': { x: 12, y: FIXED_Y }
    };
    state.keys = {
      w: false, a: false, s: false, d: false, q: false, e: false,
      ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
    };
    state.isMoving = false;
    state.facingRight = true;
    state.onLadder = false;
    state.isClimbing = false;
    state.adjustingSpotlight = false;
    state.ladderFloorPos = null;
    state.ladderPos = { x: 57, y: 14 };
    els.ladder.style.left = '57%';
    els.ladder.style.bottom = '14%';

    // Reset UI classes
    els.drawer.classList.remove('open');
    els.drawerContents.classList.remove('open');
    els.drawerContents.classList.add('hidden');
    els.lens.classList.remove('hidden');
    els.beam.classList.add('hidden');
    els.beam.classList.remove('on', 'hit-chair');
    els.curtain.classList.remove('open');
    els.chair.classList.add('hidden');
    els.key.classList.add('hidden');
    els.key.classList.remove('glow');
    els.exitGlow.classList.add('hidden');
    els.spotlight.classList.remove('fixed');
    if (els.spotlightPanel) {
      els.spotlightPanel.classList.add('hidden');
    }
    els.singerStage.classList.remove('on-ladder', 'climbing');

    // Reset singer styles
    const singerD = els.singerDressing;
    const singerS = els.singerStage;
    singerD.style.transition = '';
    singerD.style.opacity = '';
    singerS.style.transition = '';
    singerS.style.opacity = '';

    // Reset door
    const doorPanel = els.sideDoor.querySelector('.door-panel');
    if (doorPanel) {
      doorPanel.style.transition = '';
      doorPanel.style.transform = '';
      doorPanel.style.transformOrigin = '';
    }

    els.adjustMode.classList.add('hidden');
    els.winScreen.classList.add('hidden');
    els.loseScreen.classList.add('hidden');
    els.clueModal.classList.add('hidden');
    els.timerDisplay.classList.remove('warning');
    els.timerDisplay.textContent = formatTime(TOTAL_TIME);
    els.stageArea.classList.add('unrevealed');
    els.btnInteract.classList.remove('interact-active');

    updateSpotlightBeam();
    renderInventory();
    updateLevelDisplay();
    updateSingerVisuals();
    updateRoomVisibility();
    setMessage('The opera singer is trapped after the show. Use ◀ ▶ or A/D to move. Press INTERACT near objects to act.');

    if (!state.started) {
      showIntro();
    } else {
      startTimer();
      startMovementLoop();
    }
  }

  function showIntro() {
    if (els.introScreen) els.introScreen.classList.remove('hidden');
  }

  function startGameFromIntro() {
    if (els.introScreen) els.introScreen.classList.add('hidden');
    state.started = true;
    startTimer();
    startMovementLoop();
  }

  // ---------------- Event bindings ----------------
  function bindEvents() {
    // Modal buttons
    els.codeSlots.forEach((slot, i) => {
      slot.addEventListener('click', (e) => { e.stopPropagation(); selectCodeSlot(i); });
    });
    els.colorButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); setCodeColor(btn.dataset.color); });
    });
    els.submitCode.addEventListener('click', (e) => { e.stopPropagation(); submitCode(); });
    els.cancelCode.addEventListener('click', (e) => { e.stopPropagation(); closeCodeModal(); });
    els.closePoem.addEventListener('click', closePoemModal);
    els.closeClue.addEventListener('click', closeClueModal);
    els.playAgainWin.addEventListener('click', resetGame);
    els.playAgainLose.addEventListener('click', resetGame);
    if (els.startBtn) {
      els.startBtn.addEventListener('click', startGameFromIntro);
    }

    // Click-to-inspect: mirror, drawer, spotlight
    var inspectables = [
      { el: els.mirror, id: 'mirror' },
      { el: els.drawer, id: 'drawer' },
      { el: els.spotlight, id: 'spotlight' }
    ];
    inspectables.forEach(function(item) {
      if (!item.el) return;
      item.el.addEventListener('click', function(e) {
        e.stopPropagation();
        showClue(item.id);
      });
      item.el.addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showClue(item.id);
      });
    });

    // Click outside clue modal to close it
    els.clueModal.addEventListener('click', function(e) {
      if (e.target === els.clueModal) {
        closeClueModal();
      }
    });

    // Keyboard: LEFT/RIGHT movement + interact + Q/E for beam
    document.addEventListener('keydown', (e) => {
      if (!state.active) return;

      // Q/E for adjustment mode
      if (e.key === 'q' || e.key === 'Q') {
        state.keys.q = true;
        e.preventDefault();
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        state.keys.e = true;
        e.preventDefault();
        return;
      }

      // LEFT/RIGHT movement only
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        state.keys.a = true;
        state.keys.ArrowLeft = true;
        if (!state.onLadder && !state.adjustingSpotlight) state.facingRight = false;
        e.preventDefault();
        return;
      }
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        state.keys.d = true;
        state.keys.ArrowRight = true;
        if (!state.onLadder && !state.adjustingSpotlight) state.facingRight = true;
        e.preventDefault();
        return;
      }

      // Interact
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault();
        onInteractPress();
      }

      if (e.key === 'Escape') {
        closeCodeModal();
        closePoemModal();
        closeClueModal();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'q' || e.key === 'Q') {
        state.keys.q = false;
        e.preventDefault();
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        state.keys.e = false;
        e.preventDefault();
        return;
      }
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        state.keys.a = false;
        state.keys.ArrowLeft = false;
        e.preventDefault();
        return;
      }
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        state.keys.d = false;
        state.keys.ArrowRight = false;
        e.preventDefault();
        return;
      }
    });

    // D-pad: LEFT/RIGHT only (UP/DOWN disabled)
    const dpadMap = {
      left:  { key: 'ArrowLeft',  el: els.btnLeft },
      right: { key: 'ArrowRight', el: els.btnRight }
    };

    Object.values(dpadMap).forEach(({ key, el }) => {
      function startMove(e) {
        if (!state.active || isModalOpen()) return;
        e.preventDefault();

        // In adjustment mode: LEFT/RIGHT control beam
        if (state.adjustingSpotlight) {
          state.keys[key] = true;
          el.classList.add('active');
          return;
        }

        // On ladder: no movement
        if (state.onLadder) return;

        // Normal movement: LEFT/RIGHT only
        state.keys[key] = true;
        el.classList.add('active');
        if (key === 'ArrowLeft') state.facingRight = false;
        if (key === 'ArrowRight') state.facingRight = true;
      }

      function stopMove(e) {
        e.preventDefault();
        state.keys[key] = false;
        el.classList.remove('active');
      }

      el.addEventListener('mousedown', startMove);
      el.addEventListener('touchstart', startMove, { passive: false });
      el.addEventListener('mouseup', stopMove);
      el.addEventListener('touchend', stopMove);
      el.addEventListener('mouseleave', stopMove);
    });

    // Global release to catch pointer leaving the button
    document.addEventListener('mouseup', () => {
      Object.values(dpadMap).forEach(({ key, el }) => {
        state.keys[key] = false;
        el.classList.remove('active');
      });
    });
    document.addEventListener('touchend', () => {
      Object.values(dpadMap).forEach(({ key, el }) => {
        state.keys[key] = false;
        el.classList.remove('active');
      });
    });

    // Interact button
    els.btnInteract.addEventListener('click', (e) => {
      e.preventDefault();
      onInteractPress();
    });
    els.btnInteract.addEventListener('touchend', (e) => {
      e.preventDefault();
      onInteractPress();
    });
  }

  // Add shake keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-6px); }
      50% { transform: translateX(6px); }
      75% { transform: translateX(-3px); }
    }
  `;
  document.head.appendChild(style);

  // ---------------- Start ----------------
  try {
    bindEvents();
    resetGame();
  } catch (err) {
    console.error('Game init error:', err);
    document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100dvh;color:#e8c869;font-family:Georgia,serif;text-align:center;padding:20px;"><h1>In the Opera House</h1><p style="color:#f3e9d2;font-size:1.1rem;">Something went wrong loading the game.</p><p style="color:#c9a227;font-size:0.9rem;">Error: ' + (err.message || 'Unknown') + '</p><p style="color:#f3e9d2;font-size:0.85rem;opacity:0.7;">Please try refreshing the page.</p></div>';
  }
}());
