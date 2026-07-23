// ============================================================
// TO LEAVE — Game Engine
// ============================================================
// Handles: game state, UI rendering, object interaction,
// memory viewing, packing/unpacking, scoring, and feedback.
//
// Core loop: Observe → Judge → Act → Read Feedback → Adjust
// ============================================================

// ─── GAME STATE ───
let state = {
  currentChallenge: 0,
  phase: 'intro',       // intro | explore | memory | score
  roomObjects: [],       // objects still in room
  packedObjects: [],     // objects in container
  usedCapacity: 0,
  selectedObject: null,
  selectedItemSource: null, // 'room' or 'container'
  totalNeed: 0,
  totalWant: 0,
  satisfaction: 0,
  tutorialShown: false,  // show tutorial only on first room entry
};

// ─── INITIALIZATION ───
function selectChallenge(index) {
  state.currentChallenge = index;
  const challenge = CHALLENGES[index];
  // Reset state
  state.roomObjects = challenge.objects.map(o => ({ ...o }));
  state.packedObjects = [];
  state.usedCapacity = 0;
  state.selectedObject = null;
  state.selectedItemSource = null;
  state.totalNeed = 0;
  state.totalWant = 0;
  state.satisfaction = 0;
  state.phase = 'intro';
  renderIntroScreen();
}

function startGame() {
  state.phase = 'explore';
  showScreen('game-screen');
  renderGameUI();
  // Show tutorial on first room entry
  if (!state.tutorialShown) {
    document.getElementById('tutorial-overlay').classList.remove('hidden');
  }
}

// ─── SCREEN MANAGEMENT ───
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ─── INTRO SCREEN ───
function renderIntroScreen() {
  const challenge = CHALLENGES[state.currentChallenge];
  showScreen('intro-screen');
  document.getElementById('intro-character-name').textContent = challenge.character.name;
  document.getElementById('intro-vignette').textContent = challenge.character.vignette || '';
  document.getElementById('intro-character-desc').textContent = challenge.character.description;

  // Clues are now shown inside the game room, not on the intro page

  // Update challenge selector styling
  const buttons = document.querySelectorAll('#challenge-selector button');
  buttons.forEach((btn, i) => {
    btn.classList.toggle('selected', i === state.currentChallenge);
  });

  document.getElementById('intro-title').textContent = 'To Leave';
  document.getElementById('intro-subtitle').textContent = 'A game about packing, leaving, and what we carry with us.';
}

// ─── MAIN GAME UI ───
function renderGameUI() {
  const challenge = CHALLENGES[state.currentChallenge];
  // Header
  document.getElementById('header-character-name').textContent = challenge.character.name;
  document.getElementById('header-case-label').textContent = challenge.title;

  // Clues bar (visible by default inside the room)
  renderCluesBar();

  // Room objects
  renderRoomGrid();

  // Container
  document.getElementById('container-title').textContent = challenge.container.name;
  renderContainerGrid();
  updateCapacityBar();

  // Hide detail panel and overlays
  document.getElementById('detail-panel').classList.add('hidden');
  document.getElementById('memory-overlay').classList.add('hidden');
}

// ─── CLUES BAR (in-room, visible by default) ───
function renderCluesBar() {
  const challenge = CHALLENGES[state.currentChallenge];
  const content = document.getElementById('clues-bar-content');
  content.innerHTML = '';
  challenge.clues.forEach(clue => {
    const div = document.createElement('div');
    div.className = 'clue-item clue-' + clue.type;
    const label = clue.type === 'art' ? '📝 Visual Clue' : '📄 Text Clue';
    div.innerHTML = `<span class="clue-type-label">${label}</span><p>${clue.content}</p>`;
    content.appendChild(div);
  });
}

function toggleCluesBar() {
  const content = document.getElementById('clues-bar-content');
  const toggle = document.getElementById('clues-bar-toggle');
  if (content.style.display === 'none') {
    content.style.display = '';
    toggle.textContent = 'Hide';
  } else {
    content.style.display = 'none';
    toggle.textContent = 'Show';
  }
}

// ─── TUTORIAL ───
function closeTutorial() {
  document.getElementById('tutorial-overlay').classList.add('hidden');
  state.tutorialShown = true;
}

function renderClueStrip() {
  const challenge = CHALLENGES[state.currentChallenge];
  const strip = document.getElementById('clue-strip');
  strip.innerHTML = '';
  challenge.clues.forEach(clue => {
    const span = document.createElement('span');
    span.className = 'clue-strip-item';
    span.textContent = clue.type === 'art' ? '📝' : '📄';
    span.title = clue.content;
    strip.appendChild(span);
  });
}

// ─── ROOM GRID ───
function renderRoomGrid() {
  const grid = document.getElementById('room-grid');
  grid.innerHTML = '';
  state.roomObjects.forEach(obj => {
    const card = createObjectCard(obj, 'room');
    grid.appendChild(card);
  });
}

// ─── CONTAINER GRID ───
function renderContainerGrid() {
  const grid = document.getElementById('container-grid');
  grid.innerHTML = '';
  state.packedObjects.forEach(obj => {
    const card = createObjectCard(obj, 'container');
    grid.appendChild(card);
  });

  // Show empty slots
  const challenge = CHALLENGES[state.currentChallenge];
  const remaining = challenge.container.capacity - state.usedCapacity;
  for (let i = 0; i < remaining; i++) {
    const slot = document.createElement('div');
    slot.className = 'empty-slot';
    slot.textContent = 'Empty';
    grid.appendChild(slot);
  }
}

function createObjectCard(obj, source) {
  const card = document.createElement('div');
  card.className = 'object-card';
  card.dataset.id = obj.id;
  card.dataset.source = source;

  // Icon based on object category
  const icons = {
    perfume: '🧴', garden_key: '🔑', silk_dress: '👗', photo_album: '📷',
    jewelry_box: '💍', medicine: '💊', passport: '📘', tea_set: '🍵',
    blanket: '🧶', clock: '🕐', laptop: '💻', tree_photo: '🌳',
    mom_letter: '💌', mom_copy: '📋', poster: '🎸', textbooks: '📚',
    hoodie: '🧥', snacks: '🍫', journal: '📓',
    river_photo: '🏞️', baker_apron: '👨‍🍳', crayon_drawing: '🎨',
    medication: '💊', walking_stick: '🦯', id_docs: '🪪',
    teapot: '🫖', old_radio: '📻', watch: '⌚', furniture: '🪑',
  };

  const icon = icons[obj.id] || '📦';

  card.innerHTML = `
    <div class="obj-icon">${icon}</div>
    <div class="obj-name">${obj.name}</div>
    <div class="obj-size">Size: ${obj.size}</div>
  `;

  card.onclick = () => selectObject(obj.id, source);
  return card;
}

function updateCapacityBar() {
  const challenge = CHALLENGES[state.currentChallenge];
  const max = challenge.container.capacity;
  const used = state.usedCapacity;
  const pct = Math.min(100, (used / max) * 100);

  const fill = document.getElementById('capacity-fill');
  fill.style.width = pct + '%';
  fill.style.backgroundColor = pct >= 100 ? '#f44336' : pct > 75 ? '#ff9800' : '#4caf50';

  document.getElementById('capacity-text').textContent = `${used} / ${max} slots`;
}

// ─── OBJECT SELECTION & DETAIL ───
function selectObject(objId, source) {
  const obj = source === 'room'
    ? state.roomObjects.find(o => o.id === objId)
    : state.packedObjects.find(o => o.id === objId);

  if (!obj) return;

  state.selectedObject = obj;
  state.selectedItemSource = source;

  // Show detail panel
  const panel = document.getElementById('detail-panel');
  panel.classList.remove('hidden');

  document.getElementById('detail-item-name').textContent = obj.name;
  document.getElementById('detail-item-desc').textContent = obj.description;

  // No Need/Want scores shown — player must discover through clues and memories
  // No clue relevance shown — player must interpret clues themselves

  // Show/hide Memory button based on whether the object has a memory
  const memoryBtn = document.getElementById('memory-btn');
  const memoryHint = document.getElementById('memory-hint-text');
  const hasMemory = obj.memory && obj.memory.text;
  memoryBtn.style.display = hasMemory ? 'inline-block' : 'none';
  memoryHint.style.display = hasMemory ? 'inline' : 'none';

  // Action buttons
  const packBtn = document.getElementById('pack-btn');
  const unpackBtn = document.getElementById('unpack-btn');

  if (source === 'room') {
    packBtn.classList.remove('hidden');
    unpackBtn.classList.add('hidden');
    const challenge = CHALLENGES[state.currentChallenge];
    if (state.usedCapacity + obj.size > challenge.container.capacity) {
      packBtn.textContent = '⚠️ Too Large to Pack';
      packBtn.disabled = true;
    } else {
      packBtn.textContent = 'Pack This';
      packBtn.disabled = false;
    }
  } else {
    packBtn.classList.add('hidden');
    unpackBtn.classList.remove('hidden');
    unpackBtn.textContent = 'Remove from Bag';
    unpackBtn.disabled = false;
  }
}

function closeDetail() {
  document.getElementById('detail-panel').classList.add('hidden');
  state.selectedObject = null;
  state.selectedItemSource = null;
}

// ─── PACK / UNPACK ───
function packItem() {
  if (!state.selectedObject || state.selectedItemSource !== 'room') return;

  const obj = state.selectedObject;
  const challenge = CHALLENGES[state.currentChallenge];

  // Check capacity
  if (state.usedCapacity + obj.size > challenge.container.capacity) {
    showVoiceLine("The bag is full! We need to remove something first.");
    return;
  }

  // Move from room to container
  state.roomObjects = state.roomObjects.filter(o => o.id !== obj.id);
  state.packedObjects.push(obj);
  state.usedCapacity += obj.size;

  // Voice feedback — probability depends on character voice style
  const voiceProb = challenge.character.voiceStyle === 'silent' ? 0.10
    : challenge.character.voiceStyle === 'quiet' ? 0.20
    : 0.35;
  if (Math.random() < voiceProb) {
    const lines = challenge.character.voiceLines.onPack;
    showVoiceLine(lines[Math.floor(Math.random() * lines.length)]);
  }

  closeDetail();
  renderRoomGrid();
  renderContainerGrid();
  updateCapacityBar();
}

function unpackItem() {
  if (!state.selectedObject || state.selectedItemSource !== 'container') return;

  const obj = state.selectedObject;
  const challenge = CHALLENGES[state.currentChallenge];

  // Move from container to room
  state.packedObjects = state.packedObjects.filter(o => o.id !== obj.id);
  state.roomObjects.push(obj);
  state.usedCapacity -= obj.size;

  // Voice feedback — probability depends on character voice style
  const voiceProb = challenge.character.voiceStyle === 'silent' ? 0.08
    : challenge.character.voiceStyle === 'quiet' ? 0.15
    : 0.25;
  if (Math.random() < voiceProb) {
    const lines = challenge.character.voiceLines.onUnpack;
    showVoiceLine(lines[Math.floor(Math.random() * lines.length)]);
  }

  closeDetail();
  renderRoomGrid();
  renderContainerGrid();
  updateCapacityBar();
}

// ─── MEMORY VIEW ───
function enterMemory() {
  if (!state.selectedObject || !state.selectedObject.memory) return;
  const obj = state.selectedObject;

  document.getElementById('memory-overlay').classList.remove('hidden');
  document.getElementById('detail-panel').classList.add('hidden');

  document.getElementById('memory-title').textContent = obj.memory.title;
  document.getElementById('memory-text').textContent = obj.memory.text;
  // No hint shown — the memory itself tells the story

  // Draw memory visual on canvas
  drawMemoryVisual(obj.memory);
}

function exitMemory() {
  document.getElementById('memory-overlay').classList.add('hidden');
  // Re-open detail panel
  if (state.selectedObject) {
    selectObject(state.selectedObject.id, state.selectedItemSource);
  }
}

// ─── MEMORY VISUAL RENDERING ───
function drawMemoryVisual(memory) {
  const canvas = document.getElementById('memory-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Clear
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);

  const colors = memory.colors || ['#4a6fa5', '#8ab4d6', '#f5deb3'];

  // Different visual scenes based on the memory type
  const visualType = memory.visual;
  switch (visualType) {
    case 'bridge':
      drawRiverScene(ctx, w, h, colors);
      break;
    case 'garden':
      drawGardenScene(ctx, w, h, colors);
      break;
    case 'party':
      drawPartyScene(ctx, w, h, colors);
      break;
    case 'album':
      drawAlbumScene(ctx, w, h, colors);
      break;
    case 'jewelry':
      drawJewelryScene(ctx, w, h, colors);
      break;
    case 'medical':
      drawMedicalScene(ctx, w, h, colors);
      break;
    case 'document':
      drawDocumentScene(ctx, w, h, colors);
      break;
    case 'tea':
      drawTeaScene(ctx, w, h, colors);
      break;
    case 'blanket':
      drawBlanketScene(ctx, w, h, colors);
      break;
    case 'clock':
      drawClockScene(ctx, w, h, colors);
      break;
    case 'tree':
      drawTreeScene(ctx, w, h, colors);
      break;
    case 'letter':
      drawLetterScene(ctx, w, h, colors);
      break;
    case 'copy':
      drawCopyScene(ctx, w, h, colors);
      break;
    case 'concert':
      drawConcertScene(ctx, w, h, colors);
      break;
    case 'books':
      drawBooksScene(ctx, w, h, colors);
      break;
    case 'hoodie':
      drawHoodieScene(ctx, w, h, colors);
      break;
    case 'snacks':
      drawSnacksScene(ctx, w, h, colors);
      break;
    case 'journal':
      drawJournalScene(ctx, w, h, colors);
      break;
    case 'screen':
      drawScreenScene(ctx, w, h, colors);
      break;
    case 'river':
      drawRiverScene(ctx, w, h, colors);
      break;
    case 'apron':
      drawApronScene(ctx, w, h, colors);
      break;
    case 'crayon':
      drawCrayonScene(ctx, w, h, colors);
      break;
    case 'stick':
      drawStickScene(ctx, w, h, colors);
      break;
    case 'teapot':
      drawTeapotScene(ctx, w, h, colors);
      break;
    case 'radio':
      drawRadioScene(ctx, w, h, colors);
      break;
    case 'watch':
      drawWatchScene(ctx, w, h, colors);
      break;
    case 'chair':
      drawChairScene(ctx, w, h, colors);
      break;
    default:
      drawAbstractScene(ctx, w, h, colors);
      break;
  }

  // Add memory title text overlay
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(memory.title, w / 2, h - 20);
}

// ─── MEMORY SCENE DRAWING FUNCTIONS ───
function drawAbstractScene(ctx, w, h, colors) {
  // Soft abstract shapes
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = colors[i % colors.length] + '40';
    ctx.beginPath();
    ctx.arc(w * (0.2 + i * 0.12), h * (0.3 + (i % 3) * 0.2), 60 + i * 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRiverScene(ctx, w, h, colors) {
  // Sky
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h * 0.5);
  // Water
  ctx.fillStyle = colors[1];
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
  // Bridge
  ctx.fillStyle = colors[2];
  ctx.fillRect(w * 0.3, h * 0.35, w * 0.4, h * 0.08);
  ctx.fillRect(w * 0.35, h * 0.35, w * 0.05, h * 0.2);
  ctx.fillRect(w * 0.6, h * 0.35, w * 0.05, h * 0.2);
  // Two figures on bridge
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(w * 0.42, h * 0.32, 12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.55, h * 0.32, 12, 0, Math.PI * 2); ctx.fill();
}

function drawGardenScene(ctx, w, h, colors) {
  // Ground
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  // Gate
  ctx.fillStyle = colors[2];
  ctx.fillRect(w * 0.4, h * 0.2, w * 0.2, h * 0.6);
  ctx.fillStyle = colors[1];
  ctx.fillRect(w * 0.43, h * 0.2, w * 0.14, h * 0.6);
  // Flowers
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = ['#ff6b6b', '#f48fb1', '#ffab91', '#fff176'][i % 4];
    ctx.beginPath();
    ctx.arc(w * (0.1 + i * 0.1), h * (0.7 + (i % 3) * 0.05), 8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roses
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = '#e91e63';
    ctx.beginPath();
    ctx.arc(w * (0.15 + i * 0.15), h * 0.65, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPartyScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Stage lights
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i] + '60';
    ctx.beginPath();
    ctx.moveTo(w * (0.3 + i * 0.2), 0);
    ctx.lineTo(w * (0.1 + i * 0.25), h);
    ctx.lineTo(w * (0.5 + i * 0.25), h);
    ctx.fill();
  }
  // Figures
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = '#ffffff40';
    ctx.beginPath();
    ctx.arc(w * (0.1 + i * 0.11), h * 0.55, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAlbumScene(ctx, w, h, colors) {
  ctx.fillStyle = '#2e2e2e';
  ctx.fillRect(0, 0, w, h);
  // Album cover
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.2, h * 0.1, w * 0.6, h * 0.8);
  // Photos inside
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = colors[(i + 1) % colors.length];
    ctx.fillRect(w * (0.25 + i % 3 * 0.17), h * (0.15 + Math.floor(i / 3) * 0.35), w * 0.14, h * 0.3);
  }
}

function drawJewelryScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[1];
  ctx.fillRect(0, 0, w, h);
  // Velvet box
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.4);
  // Ring at bottom
  ctx.strokeStyle = colors[2];
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.6, 15, 0, Math.PI * 2);
  ctx.stroke();
  // Other items faded
  ctx.fillStyle = colors[0] + '40';
  ctx.beginPath(); ctx.arc(w * 0.38, h * 0.45, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.62, h * 0.45, 8, 0, Math.PI * 2); ctx.fill();
}

function drawMedicalScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[1];
  ctx.fillRect(0, 0, w, h);
  // Pill bottles
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[2];
    ctx.fillRect(w * (0.2 + i * 0.25), h * 0.3, w * 0.15, h * 0.4);
    ctx.fillStyle = colors[0];
    ctx.fillRect(w * (0.22 + i * 0.25), h * 0.32, w * 0.11, h * 0.1);
  }
}

function drawDocumentScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Document pages
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.2, h * 0.2, w * 0.3, h * 0.6);
  ctx.fillStyle = colors[2];
  ctx.fillRect(w * 0.55, h * 0.2, w * 0.25, h * 0.6);
  // Red stamp
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.arc(w * 0.35, h * 0.5, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawTeaScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Teacup
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.55, 50, 0, Math.PI);
  ctx.fill();
  ctx.fillRect(w * 0.3, h * 0.55, w * 0.4, h * 0.05);
  // Steam
  ctx.strokeStyle = colors[0] + '80';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(w * (0.4 + i * 0.1), h * 0.35);
    ctx.quadraticCurveTo(w * (0.42 + i * 0.1), h * 0.2, w * (0.45 + i * 0.1), h * 0.3);
    ctx.stroke();
  }
}

function drawBlanketScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Blanket folds
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.1, h * 0.3, w * 0.8, h * 0.5);
  ctx.fillStyle = colors[1];
  ctx.fillRect(w * 0.15, h * 0.35, w * 0.7, h * 0.4);
  // Texture lines
  ctx.strokeStyle = colors[2] + '60';
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * (0.4 + i * 0.04));
    ctx.lineTo(w * 0.8, h * (0.4 + i * 0.04));
    ctx.stroke();
  }
}

function drawClockScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Clock face
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, 80, 0, Math.PI * 2);
  ctx.fill();
  // Hands
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.5);
  ctx.lineTo(w * 0.5, h * 0.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.5);
  ctx.lineTo(w * 0.65, h * 0.5);
  ctx.stroke();
}

function drawTreeScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Tree
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.45, h * 0.3, w * 0.1, h * 0.5);
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.2, 60, 0, Math.PI * 2);
  ctx.fill();
  // Two figures
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(w * 0.38, h * 0.55, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.55, h * 0.55, 10, 0, Math.PI * 2); ctx.fill();
  // Music notes
  ctx.fillStyle = '#ffe66d';
  ctx.font = '24px sans-serif';
  ctx.fillText('♪', w * 0.35, h * 0.4);
  ctx.fillText('♫', w * 0.6, h * 0.35);
}

function drawLetterScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  // Letter paper
  ctx.fillStyle = colors[2];
  ctx.fillRect(w * 0.25, h * 0.15, w * 0.5, h * 0.7);
  // Handwritten lines (loops)
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    const y = h * (0.25 + i * 0.08);
    ctx.moveTo(w * 0.3, y);
    ctx.bezierCurveTo(w * 0.4, y - 10, w * 0.5, y + 10, w * 0.7, y);
    ctx.stroke();
  }
}

function drawCopyScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  // Photocopy - flat, mechanical
  ctx.fillStyle = colors[1];
  ctx.fillRect(w * 0.25, h * 0.15, w * 0.5, h * 0.7);
  // Straight, uniform lines
  ctx.strokeStyle = colors[2];
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const y = h * (0.25 + i * 0.08);
    ctx.beginPath();
    ctx.moveTo(w * 0.3, y);
    ctx.lineTo(w * 0.7, y);
    ctx.stroke();
  }
}

function drawConcertScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  // Stage
  ctx.fillStyle = colors[1];
  ctx.fillRect(w * 0.2, h * 0.3, w * 0.6, h * 0.15);
  // Spotlight
  ctx.fillStyle = colors[1] + '30';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w * 0.2, h * 0.5);
  ctx.lineTo(w * 0.8, h * 0.5);
  ctx.fill();
  // Crowd
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = colors[2] + '60';
    ctx.beginPath();
    ctx.arc(w * (0.1 + i * 0.08), h * 0.65, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBooksScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Book stack
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(w * 0.3, h * (0.3 + i * 0.1), w * 0.4, h * 0.08);
  }
}

function drawHoodieScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Hoodie shape
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.3, h * 0.2, w * 0.4, h * 0.6);
  ctx.fillStyle = colors[1];
  ctx.fillRect(w * 0.4, h * 0.1, w * 0.2, h * 0.2);
  // Pocket
  ctx.fillStyle = colors[0] + '80';
  ctx.fillRect(w * 0.35, h * 0.5, w * 0.3, h * 0.15);
}

function drawSnacksScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Packaged items
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.2, h * 0.3, w * 0.2, h * 0.35);
  ctx.fillStyle = colors[1];
  ctx.fillRect(w * 0.45, h * 0.3, w * 0.15, h * 0.4);
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.65, h * 0.3, w * 0.15, h * 0.35);
}

function drawJournalScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  // Notebook
  ctx.fillStyle = colors[2];
  ctx.fillRect(w * 0.25, h * 0.15, w * 0.5, h * 0.7);
  // Doodles
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(w * 0.4, h * 0.35, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.55, h * 0.5);
  ctx.quadraticCurveTo(w * 0.7, h * 0.3, w * 0.65, h * 0.7);
  ctx.stroke();
}

function drawScreenScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  // Screen
  ctx.fillStyle = colors[2];
  ctx.fillRect(w * 0.25, h * 0.2, w * 0.5, h * 0.55);
  // Screen glow
  ctx.fillStyle = colors[1] + '40';
  ctx.fillRect(w * 0.27, h * 0.22, w * 0.46, h * 0.5);
  // Cursor
  ctx.fillStyle = colors[1];
  ctx.fillRect(w * 0.5, h * 0.45, 3, 15);
}

function drawApronScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Apron
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.3, h * 0.2, w * 0.4, h * 0.6);
  // Pocket
  ctx.fillStyle = colors[1];
  ctx.fillRect(w * 0.35, h * 0.45, w * 0.3, h * 0.2);
  // Flour stains
  ctx.fillStyle = '#ffffff40';
  ctx.beginPath();
  ctx.arc(w * 0.45, h * 0.35, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.55, h * 0.55, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrayonScene(ctx, w, h, colors) {
  ctx.fillStyle = '#f5f5dc';
  ctx.fillRect(0, 0, w, h);
  // House drawing
  ctx.strokeStyle = colors[0];
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.45);
  ctx.lineTo(w * 0.5, h * 0.25);
  ctx.lineTo(w * 0.65, h * 0.45);
  ctx.stroke();
  ctx.strokeRect(w * 0.35, h * 0.45, w * 0.3, h * 0.3);
  // Tree
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.arc(w * 0.75, h * 0.3, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors[1];
  ctx.fillRect(w * 0.74, h * 0.35, w * 0.02, h * 0.2);
  // Stick figures
  ctx.strokeStyle = colors[2];
  ctx.lineWidth = 2;
  // Figure 1
  ctx.beginPath();
  ctx.arc(w * 0.3, h * 0.4, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.3, h*0.45); ctx.lineTo(w*0.3, h*0.6); ctx.stroke();
  // Figure 2
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.4, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.5, h*0.45); ctx.lineTo(w*0.5, h*0.6); ctx.stroke();
}

function drawStickScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Walking stick
  ctx.strokeStyle = colors[0];
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(w * 0.4, h * 0.3);
  ctx.lineTo(w * 0.5, h * 0.7);
  ctx.stroke();
  // Bird carving
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.arc(w * 0.4, h * 0.28, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawTeapotScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Teapot
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.55, 50, 0, Math.PI * 2);
  ctx.fill();
  // Spout
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.45);
  ctx.lineTo(w * 0.75, h * 0.35);
  ctx.lineTo(w * 0.75, h * 0.45);
  ctx.fill();
  // Lid
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.42, 30, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(w * 0.48, h * 0.38, w * 0.04, h * 0.06);
}

function drawRadioScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[1];
  ctx.fillRect(0, 0, w, h);
  // Radio body
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.25, h * 0.3, w * 0.5, h * 0.4);
  // Speaker grille
  ctx.fillStyle = colors[2];
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(w * 0.3, h * (0.35 + i * 0.05), w * 0.3, h * 0.02);
  }
  // Dial
  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.55, 15, 0, Math.PI * 2);
  ctx.fill();
}

function drawWatchScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Watch face
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, 60, 0, Math.PI * 2);
  ctx.fill();
  // Inner face
  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, 50, 0, Math.PI * 2);
  ctx.fill();
  // Hands
  ctx.strokeStyle = colors[2];
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(w*0.5, h*0.5); ctx.lineTo(w*0.5, h*0.25); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.5, h*0.5); ctx.lineTo(w*0.65, h*0.5); ctx.stroke();
}

function drawChairScene(ctx, w, h, colors) {
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  // Chair
  ctx.fillStyle = colors[0];
  ctx.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.05);
  ctx.fillRect(w * 0.3, h * 0.3, w * 0.05, h * 0.5);
  ctx.fillRect(w * 0.65, h * 0.3, w * 0.05, h * 0.5);
  ctx.fillRect(w * 0.3, h * 0.1, w * 0.05, h * 0.25);
  // Side table
  ctx.fillStyle = colors[1];
  ctx.fillRect(w * 0.7, h * 0.4, w * 0.15, h * 0.04);
  ctx.fillRect(w * 0.75, h * 0.44, w * 0.04, h * 0.36);
}

// ─── CLUE PANEL (header button — toggles the in-room clues bar) ───
function toggleCluePanel() {
  toggleCluesBar();
}

// ─── VOICE LINE (character feedback) ───
let voiceTimeout = null;
function showVoiceLine(text) {
  const challenge = CHALLENGES[state.currentChallenge];
  // Create or update voice bubble
  let bubble = document.getElementById('voice-bubble');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.id = 'voice-bubble';
    document.getElementById('game-wrapper').appendChild(bubble);
  }

  // Style based on voice style
  bubble.className = 'voice-bubble voice-' + challenge.character.voiceStyle;
  bubble.textContent = text || '';
  bubble.style.display = text ? 'block' : 'none';

  // Auto-hide after 3 seconds
  if (voiceTimeout) clearTimeout(voiceTimeout);
  if (text) {
    voiceTimeout = setTimeout(() => {
      bubble.style.display = 'none';
    }, 3000);
  }
}

// ─── FINISH PACKING & SCORING ───
function finishPacking() {
  state.phase = 'score';
  calculateScore();
  renderScoreScreen();
}

function calculateScore() {
  let totalNeed = 0;
  let totalWant = 0;

  state.packedObjects.forEach(obj => {
    totalNeed += obj.needScore;
    totalWant += obj.wantScore;
  });

  state.totalNeed = totalNeed;
  state.totalWant = totalWant;

  // Calculate satisfaction based on character's preferences
  const challenge = CHALLENGES[state.currentChallenge];

  // Normalize: max possible need and want from all objects
  let maxNeed = 0, maxWant = 0;
  challenge.objects.forEach(o => { maxNeed += o.needScore; maxWant += o.wantScore; });

  // Store maxNeed/maxWant on state so renderScoreScreen can access them
  state.maxNeed = maxNeed;
  state.maxWant = maxWant;

  // Satisfaction = weighted combination of need and want, scaled to 100
  const needWeight = challenge.character.satisfactionThreshold === 75 ? 0.35 : 0.3;
  const wantWeight = 1 - needWeight;

  const needPct = maxNeed > 0 ? totalNeed / maxNeed : 0;
  const wantPct = maxWant > 0 ? totalWant / maxWant : 0;

  // Penalize extreme imbalance
  const balance = Math.abs(needPct - wantPct);
  const balancePenalty = balance * 15;

  state.satisfaction = Math.round(
    Math.min(100, (needPct * needWeight + wantPct * wantWeight) * 100 - balancePenalty + 10)
  );

  if (state.satisfaction < 0) state.satisfaction = 0;
  if (state.satisfaction > 100) state.satisfaction = 100;
}

function renderScoreScreen() {
  showScreen('score-screen');
  const challenge = CHALLENGES[state.currentChallenge];

  // Character name
  document.getElementById('score-character-name').textContent = challenge.character.name;

  // Character reaction based on satisfaction level
  let reaction;
  if (state.satisfaction >= challenge.character.satisfactionThreshold) {
    reaction = challenge.character.voiceLines.onFinish.high;
  } else if (state.satisfaction >= challenge.character.satisfactionThreshold * 0.6) {
    reaction = challenge.character.voiceLines.onFinish.medium;
  } else {
    reaction = challenge.character.voiceLines.onFinish.low;
  }
  document.getElementById('score-character-reaction').textContent = '"' + reaction + '"';

  // Qualitative Need/Want labels (single calculation, no duplicate const)
  const maxNeed = state.maxNeed || 1;
  const maxWant = state.maxWant || 1;
  const needRatio = state.totalNeed / maxNeed;
  const wantRatio = state.totalWant / maxWant;

  function careLabel(ratio) {
    if (ratio >= 0.6) return 'Very Well';
    if (ratio >= 0.4) return 'Decent';
    if (ratio >= 0.2) return 'Low';
    return 'Very Low';
  }

  document.getElementById('score-need-label').textContent = careLabel(needRatio);
  document.getElementById('score-need-label').className = needRatio >= 0.4
    ? 'score-big-num score-high' : needRatio >= 0.2
    ? 'score-big-num score-medium' : 'score-big-num score-low';

  document.getElementById('score-want-label').textContent = careLabel(wantRatio);
  document.getElementById('score-want-label').className = wantRatio >= 0.4
    ? 'score-big-num score-high' : wantRatio >= 0.2
    ? 'score-big-num score-medium' : 'score-big-num score-low';

  const satEl = document.getElementById('score-satisfaction');
  satEl.textContent = state.satisfaction + '%';
  satEl.className = state.satisfaction >= challenge.character.satisfactionThreshold
    ? 'score-big-num score-high'
    : state.satisfaction >= challenge.character.satisfactionThreshold * 0.6
    ? 'score-big-num score-medium'
    : 'score-big-num score-low';

  // Items list
  const itemsList = document.getElementById('score-items-list');
  itemsList.innerHTML = '<h3>What You Packed</h3>';
  state.packedObjects.forEach(obj => {
    const div = document.createElement('div');
    div.className = 'packed-item-summary';
    div.textContent = obj.name;
    itemsList.appendChild(div);
  });

  // Qualitative feedback based on score ratios, no numbers revealed
  const feedbackEl = document.getElementById('score-feedback');
  let feedbackText = '';
  const challengeName = challenge.character.name;

  if (needRatio < 0.3) {
    feedbackText += '⚠️ You packed very few practical items. ' + challengeName + ' might struggle without essentials. ';
  }
  if (wantRatio < 0.3) {
    feedbackText += '⚠️ You packed very few emotional items. ' + challengeName + ' might feel their memories were left behind. ';
  }
  if (state.satisfaction >= challenge.character.satisfactionThreshold) {
    feedbackText += '✨ You understood ' + challengeName + ' well. The balance between necessity and emotion is what makes good packing — and good leaving.';
  } else {
    feedbackText += '💡 Try again and read the clues more carefully. Understanding who is leaving helps you know what to carry.';
  }

  feedbackEl.textContent = feedbackText;

  // Next case button visibility
  const nextBtn = document.querySelector('#score-actions button:nth-child(2)');
  nextBtn.style.display = state.currentChallenge < CHALLENGES.length - 1 ? 'inline-block' : 'none';
}

function retryChallenge() {
  selectChallenge(state.currentChallenge);
}

function nextChallenge() {
  if (state.currentChallenge < CHALLENGES.length - 1) {
    selectChallenge(state.currentChallenge + 1);
  } else {
    backToMenu();
  }
}

function backToMenu() {
  state.phase = 'intro';
  // Show intro screen with challenge selector
  showScreen('intro-screen');
  // Update challenge selector buttons to show completion status
  const buttons = document.querySelectorAll('#challenge-selector button');
  buttons.forEach(btn => btn.classList.remove('selected'));
}

// ─── AUTO-INIT on page load ───
window.addEventListener('DOMContentLoaded', () => {
  selectChallenge(0);
});
