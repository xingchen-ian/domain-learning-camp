/* =================================================================
 * 3x3 Rubik's Cube Game
 * Project: IMA Summer Program - Game Design - Group 1
 * Student: Kimi Xu
 *
 * Architecture
 * ------------
 *  - 27 miniCubes at (x,y,z) ∈ {-1,0,1}³ form a 3x3 Rubik's cube.
 *  - Each miniCube owns 6 face materials (one per outward face).
 *  - Face turns are performed by parenting the 9 affected miniCubes
 *    to a temporary pivot Object3D, animating its rotation, then
 *    re-parenting the cubes back to the scene while applying the
 *    pivot's world matrix to their position/rotation/quaternion.
 *  - All face moves are pushed onto a `moveLog` for Redo.
 *
 * The code is intentionally split into small, commented sections
 * so a high-school reader can follow the rules of the cube.
 * ================================================================= */

import * as THREE from "../vendor/three.module.min.js";

/* =========================================================
 * 1. CONSTANTS
 * ========================================================= */

// Standard Rubik's cube color scheme.
// Faces order: +X (right), -X (left), +Y (up), -Y (down), +Z (front), -Z (back)
const COLORS = {
  right:  0xff3838, // red
  left:   0xff9f43, // orange
  up:     0xffffff, // white
  down:   0xfeca57, // yellow
  front:  0x2ed573, // green
  back:   0x48dbfb, // blue
};

// Map: face-axis -> [faceId, axis vector, sign]
const FACE_DEFS = {
  R: { id: "R", name: "Right",  axis: "x", sign:  1, color: COLORS.right  },
  L: { id: "L", name: "Left",   axis: "x", sign: -1, color: COLORS.left   },
  U: { id: "U", name: "Up",     axis: "y", sign:  1, color: COLORS.up     },
  D: { id: "D", name: "Down",   axis: "y", sign: -1, color: COLORS.down   },
  F: { id: "F", name: "Front",  axis: "z", sign:  1, color: COLORS.front  },
  B: { id: "B", name: "Back",   axis: "z", sign: -1, color: COLORS.back   },
};

// Animation timing
const TURN_DURATION = 240;     // ms per 90° turn
const CAMERA_MIN_DIST = 5;
const CAMERA_MAX_DIST = 18;
const CAMERA_DEFAULT_DIST = 9;

/* =========================================================
 * 2. APPLICATION STATE
 * ========================================================= */

const state = {
  // Cube
  miniCubes: [],            // 27 THREE.Mesh objects
  cubies: [],               // internal positions tracked separately
  selectedFace: null,       // 'R' | 'L' | 'U' | 'D' | 'F' | 'B' | null
  highlightedFace: null,    // currently visible highlight (for face indicator)

  // Move log: {face, dir} where dir = +1 (CW from outside) or -1 (CCW)
  moveLog: [],
  redoStack: [],

  // Generation counter.  Increments every time the cube is rebuilt.  Any
  // pending animation captures the current generation and aborts cleanly
  // if the cube has been rebuilt underneath it.
  generation: 0,

  // Stats
  startTime: null,
  elapsedMs: 0,
  timerId: null,
  isSolved: true,
  isAnimating: false,
  level: 1,                 // 1, 2, 3
  currentStage: null,       // tracks CFOP stage for transition detection
  countdownSec: 0,          // only used in level 3
  countdownEnd: null,
  giveUp: false,

  // Camera (quaternion-based arcball — no singularities, spin forever)
  cameraQuat: null,              // initialised below
  cameraDist:  CAMERA_DEFAULT_DIST,
  cameraTarget: new THREE.Vector3(0, 0, 0),
  isDragging: false,
  lastPointer: { x: 0, y: 0 },
};

// Initialise arcball quaternion to a nice front-right-above view.
// Default camera sits at (0, 0, dist); we tilt up then rotate right.
{
  const qTilt = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0), -Math.PI * 0.15
  );
  const qYaw  = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),  Math.PI * 0.20
  );
  state.cameraQuat = new THREE.Quaternion().multiplyQuaternions(qYaw, qTilt);
}

/* =========================================================
 * 3. THREE.JS SCENE SETUP
 * ========================================================= */

const canvas = document.getElementById("cube-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
updateCameraFromState();

const ambient = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(6, 10, 8);
scene.add(dirLight);

const dirLight2 = new THREE.DirectionalLight(0xa0c4ff, 0.35);
dirLight2.position.set(-8, -4, -6);
scene.add(dirLight2);

// Stage
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

// Highlight ring (a thin glowing outline ring we show on hovered face)
const highlightRing = makeHighlightRing();
highlightRing.visible = false;
cubeGroup.add(highlightRing);

/* =========================================================
 * 4. CUBE CONSTRUCTION
 * ========================================================= */

function buildCube() {
  // remove any existing
  for (const c of state.miniCubes) cubeGroup.remove(c);
  state.miniCubes = [];
  state.cubies = [];
  state.generation++;
  state.selectedFace = null;
  updateHighlightRing();
  updateFaceIndicator();
  updateRotatorButtons();

  const CUBIE = 1.0;       // cubie size
  const GAP = 0.04;        // tiny gap so stickers look like a real cube
  const stickerSize = CUBIE * 0.92;

  // Build the 27 cubies (we keep the center one too — it's hidden inside)
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const cubie = makeCubie(x, y, z, CUBIE, GAP, stickerSize);
        cubeGroup.add(cubie.mesh);
        state.miniCubes.push(cubie.mesh);
        state.cubies.push(cubie);
      }
    }
  }
}

function makeCubie(ix, iy, iz, size, gap, stickerSize) {
  // The miniCube's position in world units
  const px = ix * (size + gap);
  const py = iy * (size + gap);
  const pz = iz * (size + gap);

  // Group: holds geometry + stickers
  const mesh = new THREE.Group();
  mesh.position.set(px, py, pz);

  // The black plastic body
  const bodyGeom = new THREE.BoxGeometry(size, size, size);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.7,
    metalness: 0.1,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  mesh.add(body);

  // Six sticker materials, one per face.  Only the outward faces are visible.
  // Faces on a BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
  const stickers = [];
  const faceInfo = [
    { dir:  "px", color: ix ===  1 ? COLORS.right  : 0x111111, dx:  size/2 + 0.001, axis: "x", sign:  1 },
    { dir:  "nx", color: ix === -1 ? COLORS.left   : 0x111111, dx: -size/2 - 0.001, axis: "x", sign: -1 },
    { dir:  "py", color: iy ===  1 ? COLORS.up     : 0x111111, dy:  size/2 + 0.001, axis: "y", sign:  1 },
    { dir:  "ny", color: iy === -1 ? COLORS.down   : 0x111111, dy: -size/2 - 0.001, axis: "y", sign: -1 },
    { dir:  "pz", color: iz ===  1 ? COLORS.front  : 0x111111, dz:  size/2 + 0.001, axis: "z", sign:  1 },
    { dir:  "nz", color: iz === -1 ? COLORS.back   : 0x111111, dz: -size/2 - 0.001, axis: "z", sign: -1 },
  ];

  for (const f of faceInfo) {
    const stickerGeom = new THREE.PlaneGeometry(stickerSize, stickerSize);
    const stickerMat = new THREE.MeshStandardMaterial({
      color: f.color,
      roughness: 0.45,
      metalness: 0.0,
      side: THREE.FrontSide,
    });
    const sticker = new THREE.Mesh(stickerGeom, stickerMat);

    // Position the sticker just outside the cube face
    sticker.position.set(f.dx || 0, f.dy || 0, f.dz || 0);

    // Orient the sticker to face outward
    if (f.axis === "x") {
      sticker.rotation.y = f.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else if (f.axis === "y") {
      sticker.rotation.x = f.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      // z axis: default plane orientation is already facing +Z
      sticker.rotation.y = f.sign < 0 ? Math.PI : 0;
    }

    // Store the sticker info for inspection
    sticker.userData.axis = f.axis;
    sticker.userData.sign = f.sign;

    mesh.add(sticker);
    stickers.push(sticker);
  }

  // Save reference data for highlight / win detection
  mesh.userData.initialPos = new THREE.Vector3(px, py, pz);
  mesh.userData.idx = `${ix},${iy},${iz}`;
  mesh.userData.faceInfo = faceInfo;

  return { mesh, ix, iy, iz, stickers, faceInfo };
}

function makeHighlightRing() {
  // A subtle outline that we position around a face
  const ringGeom = new THREE.RingGeometry(1.45, 1.55, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfeca57,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
  });
  return new THREE.Mesh(ringGeom, ringMat);
}

function updateHighlightRing() {
  if (!state.selectedFace) {
    highlightRing.visible = false;
    return;
  }
  highlightRing.visible = true;
  const def = FACE_DEFS[state.selectedFace];
  // The ring is a ring on the XY plane; we orient it to face the face normal
  highlightRing.position.set(0, 0, 0);
  highlightRing.rotation.set(0, 0, 0);
  if (def.axis === "x") {
    highlightRing.rotation.y = def.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    highlightRing.position.x = def.sign * 1.55;
  } else if (def.axis === "y") {
    highlightRing.rotation.x = def.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
    highlightRing.position.y = def.sign * 1.55;
  } else {
    if (def.sign < 0) highlightRing.rotation.y = Math.PI;
    highlightRing.position.z = def.sign * 1.55;
  }
}

/* =========================================================
 * 5. FACE TURN LOGIC
 *
 * This is the most important function in the game.
 * To turn a face, we:
 *   1) find the 9 miniCubes on that face,
 *   2) attach them to a pivot Object3D,
 *   3) animate the pivot rotation,
 *   4) when done, re-attach to the scene and apply the pivot
 *      rotation to the cubies' positions/rotations.
 * ========================================================= */

function getFaceCubies(faceId) {
  const def = FACE_DEFS[faceId];
  return state.miniCubes.filter((m) => {
    // World position is approximate; we use the local position relative to cubeGroup
    const p = m.position;
    if (def.axis === "x") return Math.abs(p.x - def.sign * 1.04) < 0.5;
    if (def.axis === "y") return Math.abs(p.y - def.sign * 1.04) < 0.5;
    if (def.axis === "z") return Math.abs(p.z - def.sign * 1.04) < 0.5;
  });
}

function rotateFace(faceId, dir, animate = true) {
  return new Promise((resolve) => {
    if (state.isAnimating && animate) {
      resolve(false);
      return;
    }
    const def = FACE_DEFS[faceId];
    const cubies = getFaceCubies(faceId);
    if (cubies.length !== 9) {
      console.warn("Expected 9 cubies, got", cubies.length, "on face", faceId);
      resolve(false);
      return;
    }

    state.isAnimating = true;
    const myGen = state.generation;

    // Create a pivot
    const pivot = new THREE.Group();
    cubeGroup.add(pivot);
    for (const c of cubies) pivot.attach(c);

    // Total rotation
    const totalAngle = (Math.PI / 2) * dir;

    if (!animate) {
      pivot.rotation[def.axis] = totalAngle;
      pivot.updateMatrixWorld(true);
      for (const c of cubies) cubeGroup.attach(c);
      cubeGroup.remove(pivot);
      state.isAnimating = false;
      if (myGen === state.generation) finishMove(faceId, dir);
      resolve(myGen === state.generation);
      return;
    }

    const start = performance.now();
    const initial = 0;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    function step(now) {
      // If the cube was rebuilt mid-animation, stop touching the old cubies.
      if (myGen !== state.generation) {
        try { cubeGroup.remove(pivot); } catch (e) {}
        state.isAnimating = false;
        resolve(false);
        return;
      }
      const t = Math.min(1, (now - start) / TURN_DURATION);
      const angle = initial + (totalAngle - initial) * easeOutCubic(t);
      pivot.rotation[def.axis] = angle;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        // Finalize: bake rotation into the cubies themselves
        pivot.updateMatrixWorld(true);
        for (const c of cubies) cubeGroup.attach(c);
        cubeGroup.remove(pivot);
        state.isAnimating = false;
        finishMove(faceId, dir);
        resolve(true);
      }
    }
    requestAnimationFrame(step);
  });
}

function finishMove(faceId, dir) {
  state.moveLog.push({ face: faceId, dir });
  state.redoStack = []; // any new move clears redo history
  // Snap selected highlight back to the new face position
  if (state.selectedFace) updateHighlightRing();
  updateStatsUI();
  if (checkSolved()) {
    onWin();
  } else {
    // Detect stage transition — if the player advanced to a new CFOP
    // stage, show a toast with the next algorithm.
    const newStage = detectSolvingStage();
    if (state.currentStage && newStage !== state.currentStage) {
      // Only celebrate forward progress (not going backwards)
      const order = ["scrambled", "cross", "f2l", "oll", "pll", "solved"];
      const prevIdx = order.indexOf(state.currentStage);
      const newIdx = order.indexOf(newStage);
      if (newIdx > prevIdx) {
        showStageToast(newStage);
      }
    }
    state.currentStage = newStage;
    updateHintUI();
  }
}

/* =========================================================
 * 6. SCRAMBLE / RESET / REDO
 * ========================================================= */

function scramble(moves = 25) {
  const faces = ["R", "L", "U", "D", "F", "B"];
  const sequence = [];
  let lastFace = null;
  for (let i = 0; i < moves; i++) {
    let f;
    do {
      f = faces[Math.floor(Math.random() * 6)];
    } while (f === lastFace);
    lastFace = f;
    // Random direction.  Mix in some half-turns and double-layer for variety.
    const dirRoll = Math.random();
    let dir = 1;
    if (dirRoll < 0.4) dir = 1;
    else if (dirRoll < 0.8) dir = -1;
    else dir = 2 * (Math.random() < 0.5 ? 1 : -1);
    sequence.push({ face: f, dir });
  }
  // Now play those moves as a sequence and mark them as scramble moves
  // (they do not count toward the player's "Moves Made" stat).
  playMoveSequence(sequence, true);
}

async function playMoveSequence(moves, isScramble = false) {
  // We rely on rotateFace() to manage state.isAnimating per call, so the
  // loop just awaits each animation to finish before kicking off the next.
  // If the cube is rebuilt mid-sequence, abort the rest of the sequence.
  const startGen = state.generation;
  for (const m of moves) {
    if (state.generation !== startGen) return;
    await rotateFace(m.face, m.dir, true);
    if (isScramble && state.moveLog.length > 0) {
      state.moveLog[state.moveLog.length - 1].scramble = true;
    }
  }
  if (state.generation === startGen) {
    startTimer();
    updateStatsUI();
    // After scramble, initialise the stage tracker so the first player
    // move can trigger a transition toast if they advance.
    state.currentStage = detectSolvingStage();
    updateHintUI();
  }
}

function redoLast() {
  if (state.redoStack.length === 0) return;
  const m = state.redoStack.pop();
  state.moveLog.push(m);
  rotateFace(m.face, m.dir, true).then(() => {
    updateStatsUI();
    updateHintUI();
  });
}

function undoLast() {
  if (state.moveLog.length === 0) return;
  // The last move could be a scramble move; if so, just pop without animating
  const m = state.moveLog.pop();
  state.redoStack.push(m);
  rotateFace(m.face, -m.dir, true).then(() => {
    updateStatsUI();
    updateHintUI();
  });
}

function restartGame() {
  state.moveLog = [];
  state.redoStack = [];
  state.isSolved = true;
  state.giveUp = false;
  state.currentStage = null;
  stopTimer();
  state.elapsedMs = 0;
  // Rebuild the cube to ensure it is in the solved state
  buildCube();
  updateStatsUI();
  updateHintUI();
  hideOverlay();
  // Auto-scramble on restart for immediate play
  scramble(20);
}

/* =========================================================
 * 7. WIN DETECTION
 * ========================================================= */

function getOutwardSticker(cubie, faceAxis, faceSign) {
  // After rotation, a sticker's userData still records its *initial* face,
  // which may no longer match its current outward direction.  Instead, we
  // compute the sticker's current world-space outward direction and match
  // it to the face we're checking.
  const faceDir = new THREE.Vector3();
  if (faceAxis === "x") faceDir.set(faceSign, 0, 0);
  else if (faceAxis === "y") faceDir.set(0, faceSign, 0);
  else faceDir.set(0, 0, faceSign);

  for (const s of cubie.children) {
    if (!s.userData || s.userData.axis === undefined) continue; // skip body mesh etc.
    // PlaneGeometry's local-space normal is (0,0,1).  Transform it through
    // the sticker's matrixWorld (which includes all parent rotations) to get
    // the world-space outward direction.
    const worldNormal = new THREE.Vector3(0, 0, 1).transformDirection(s.matrixWorld);
    if (worldNormal.dot(faceDir) > 0.9) return s;
  }
  return null;
}

function checkSolved() {
  // Ensure matrixWorld is current before we read sticker orientations.
  cubeGroup.updateMatrixWorld(true);

  // For each of the 6 face axes, check that all 9 outward stickers on that
  // face share the same color.
  for (const f of Object.values(FACE_DEFS)) {
    const cubies = getFaceCubies(f.id);
    let firstColor = null;
    for (const c of cubies) {
      const sticker = getOutwardSticker(c, f.axis, f.sign);
      if (!sticker) continue;
      const col = sticker.material.color.getHex();
      if (firstColor === null) firstColor = col;
      else if (firstColor !== col) return false;
    }
  }
  return true;
}

function calculateSolvedPercent() {
  // Ensure matrixWorld is current before we read sticker orientations.
  cubeGroup.updateMatrixWorld(true);

  // Count outward stickers on each face that match the face's center color.
  let correct = 0;
  let total = 0;
  for (const f of Object.values(FACE_DEFS)) {
    const cubies = getFaceCubies(f.id);
    // Find the center cubie for this face to get the target color
    const centerCubie = cubies.find((c) => {
      if (f.axis === "x") return Math.abs(c.position.x - f.sign * 1.04) < 0.5 && Math.abs(c.position.y) < 0.5 && Math.abs(c.position.z) < 0.5;
      if (f.axis === "y") return Math.abs(c.position.y - f.sign * 1.04) < 0.5 && Math.abs(c.position.x) < 0.5 && Math.abs(c.position.z) < 0.5;
      if (f.axis === "z") return Math.abs(c.position.z - f.sign * 1.04) < 0.5 && Math.abs(c.position.x) < 0.5 && Math.abs(c.position.y) < 0.5;
    });
    if (!centerCubie) continue;
    const centerSticker = getOutwardSticker(centerCubie, f.axis, f.sign);
    if (!centerSticker) continue;
    const targetColor = centerSticker.material.color.getHex();
    for (const c of cubies) {
      const sticker = getOutwardSticker(c, f.axis, f.sign);
      if (!sticker) continue;
      total++;
      if (sticker.material.color.getHex() === targetColor) correct++;
    }
  }
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

/* =========================================================
 * 8. TIMER
 * ========================================================= */

function startTimer() {
  if (state.timerId) return;
  state.startTime = performance.now() - state.elapsedMs;
  state.timerId = setInterval(() => {
    state.elapsedMs = performance.now() - state.startTime;
    updateTimerUI();

    // Level 3 countdown
    if (state.level === 3 && state.countdownEnd) {
      const remainingMs = state.countdownEnd - state.elapsedMs;
      if (remainingMs <= 0) {
        onTimeUp();
      }
    }
  }, 100);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

/* =========================================================
 * 9. INPUT — keyboard + mouse + camera
 * ========================================================= */

window.addEventListener("keydown", (e) => {
  if (state.isAnimating) return;
  const k = e.key;
  const faceKeys = {
    r: "R", l: "L", u: "U", d: "D", f: "F", b: "B",
  };
  const lower = k.toLowerCase();
  if (faceKeys[lower]) {
    if (!state.selectedFace) {
      selectFace(faceKeys[lower]);
    } else if (state.selectedFace === faceKeys[lower]) {
      const dir = e.shiftKey ? -1 : 1;
      rotateFace(faceKeys[lower], dir, true).then(() => {});
    } else {
      // Switch selection
      selectFace(faceKeys[lower]);
    }
    e.preventDefault();
  } else if (k === "Escape") {
    state.selectedFace = null;
    updateHighlightRing();
    updateFaceIndicator();
    updateRotatorButtons();
  } else if (k === "ArrowRight" && state.selectedFace) {
    rotateFace(state.selectedFace, 1, true);
  } else if (k === "ArrowLeft" && state.selectedFace) {
    rotateFace(state.selectedFace, -1, true);
  }
});

// Click to select face via raycasting
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

canvas.addEventListener("pointerdown", (e) => {
  // Begin drag-rotate
  state.isDragging = true;
  state.lastPointer.x = e.clientX;
  state.lastPointer.y = e.clientY;
  state.dragMoved = false;
  // Capture the pointer so we keep getting move events even if the cursor
  // leaves the canvas — this prevents the "stuck" feeling during fast drags.
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (state.isDragging) {
    const dx = e.clientX - state.lastPointer.x;
    const dy = e.clientY - state.lastPointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) state.dragMoved = true;

    // Arcball rotation — two incremental quaternions, premultiplied so
    // they act in world space.  No phi clamp, no singularity, no "stuck".
    //
    // Horizontal drag → rotate around world Y (spins left/right forever)
    const qYaw = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), dx * 0.01
    );
    // Vertical drag → rotate around the camera's screen-space right axis.
    // This axis is the rotated X vector, so it tracks the current view.
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(state.cameraQuat);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(right, dy * 0.01);

    state.cameraQuat.premultiply(qYaw).premultiply(qPitch);
    state.cameraQuat.normalize();   // guard against float drift

    state.lastPointer.x = e.clientX;
    state.lastPointer.y = e.clientY;
    updateCameraFromState();
  }
});

window.addEventListener("pointerup", (e) => {
  if (state.isDragging) {
    state.isDragging = false;
    if (!state.dragMoved && e.target === canvas) {
      // Treat as a click — do a raycast for face selection
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(state.miniCubes, true);
      if (hits.length > 0) {
        // Use the hit point's world position to determine which face was clicked.
        // This is more robust than face-normal detection when the cubies are Groups.
        const hp = hits[0].point;
        const ax = Math.abs(hp.x), ay = Math.abs(hp.y), az = Math.abs(hp.z);
        let faceId;
        if (ax > ay && ax > az) faceId = hp.x > 0 ? "R" : "L";
        else if (ay > ax && ay > az) faceId = hp.y > 0 ? "U" : "D";
        else faceId = hp.z > 0 ? "F" : "B";
        if (state.selectedFace === faceId) {
          // second click on same face = rotate CW
          rotateFace(faceId, 1, true);
        } else {
          selectFace(faceId);
        }
      }
    }
  }
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = Math.sign(e.deltaY) * 0.4;
  state.cameraDist = Math.max(CAMERA_MIN_DIST, Math.min(CAMERA_MAX_DIST, state.cameraDist + delta));
  updateCameraFromState();
}, { passive: false });

function faceIdFromNormal(n) {
  // n is in world space
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  if (ax > ay && ax > az) return n.x > 0 ? "R" : "L";
  if (ay > ax && ay > az) return n.y > 0 ? "U" : "D";
  return n.z > 0 ? "F" : "B";
}

function selectFace(faceId) {
  state.selectedFace = faceId;
  updateHighlightRing();
  updateFaceIndicator();
  updateRotatorButtons();
}

function updateCameraFromState() {
  // Arcball: rotate the default camera pose (pos + up) by cameraQuat.
  // This has NO singularity at any angle — you can spin forever.
  const defaultPos = new THREE.Vector3(0, 0, state.cameraDist);
  const defaultUp  = new THREE.Vector3(0, 1, 0);
  const pos = defaultPos.applyQuaternion(state.cameraQuat);
  const up  = defaultUp.applyQuaternion(state.cameraQuat);
  camera.position.copy(pos).add(state.cameraTarget);
  camera.up.copy(up);
  camera.lookAt(state.cameraTarget);
}

/* =========================================================
 * 10. UI WIRING
 * ========================================================= */

const $ = (id) => document.getElementById(id);

function updateTimerUI() {
  $("stat-time").textContent = formatTime(state.elapsedMs);
  if (state.level === 3 && state.countdownEnd) {
    const remaining = Math.max(0, state.countdownEnd - state.elapsedMs);
    $("stat-time").textContent = formatTime(remaining);
    const el = $("stat-time");
    el.classList.toggle("danger", remaining < 30000);
  }
}

function updateStatsUI() {
  $("stat-moves").textContent = state.moveLog.filter((m) => !m.scramble).length;
  const pct = calculateSolvedPercent();
  $("stat-percent").textContent = `${pct}%`;
  $("stat-bar-fill").style.width = `${pct}%`;
  $("stat-level").textContent = `Level ${state.level}`;
  $("stat-difficulty").textContent =
    state.level === 1 ? "Full Algorithms" : state.level === 2 ? "Brief Hints" : "No Hints + Timer";
  updateTimerUI();
}

function updateFaceIndicator() {
  const el = $("face-indicator");
  if (state.selectedFace) {
    el.classList.add("visible");
    const def = FACE_DEFS[state.selectedFace];
    el.innerHTML = `<strong style="color:#feca57">${def.name}</strong> face selected — press <span class="key">→</span> to turn CW, <span class="key">←</span> for CCW, or use the buttons below`;
  } else {
    el.classList.remove("visible");
    el.innerHTML = "Click a face on the cube (or press <span class='key'>R L U D F B</span>) to select a face";
  }
}

function updateRotatorButtons() {
  const rot = $("face-rotator");
  if (state.selectedFace) {
    rot.classList.add("visible");
    $("rot-face-name").textContent = state.selectedFace;
  } else {
    rot.classList.remove("visible");
  }
}

// Top-level button wiring
$("btn-shuffle").addEventListener("click", () => {
  if (state.isAnimating) return;
  // For first load (solved), scramble
  if (state.moveLog.length === 0) {
    scramble(20);
  } else {
    // Add some extra moves on top of current
    const faces = ["R", "L", "U", "D", "F", "B"];
    const extra = [];
    for (let i = 0; i < 8; i++) {
      const f = faces[Math.floor(Math.random() * 6)];
      const dir = Math.random() < 0.5 ? 1 : -1;
      extra.push({ face: f, dir });
    }
    playMoveSequence(extra);
  }
});

$("btn-redo").addEventListener("click", redoLast);
$("btn-undo").addEventListener("click", undoLast);

$("btn-restart").addEventListener("click", () => {
  if (state.isAnimating) return;
  if (confirm("Restart the puzzle?  This will reset the cube and shuffle again.")) {
    restartGame();
  }
});

$("btn-giveup").addEventListener("click", () => {
  if (state.isAnimating) return;
  if (state.isSolved) return;
  if (confirm("Give up and reveal the solution?")) {
    onGiveUp();
  }
});

// Rotator buttons
document.querySelectorAll(".rotator-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    if (state.isAnimating || !state.selectedFace) return;
    const dir = parseInt(btn.dataset.dir, 10);
    rotateFace(state.selectedFace, dir, true);
  });
});

// Level pills
document.querySelectorAll(".level-pills button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (state.isAnimating) return;
    const lvl = parseInt(btn.dataset.level, 10);
    setLevel(lvl);
    document.querySelectorAll(".level-pills button").forEach((b) =>
      b.classList.toggle("active", parseInt(b.dataset.level, 10) === lvl)
    );
  });
});

function setLevel(lvl) {
  state.level = lvl;
  // Reset timer and configure countdown
  stopTimer();
  state.elapsedMs = 0;
  state.startTime = null;
  if (lvl === 3) {
    state.countdownEnd = 5 * 60 * 1000; // 5 minutes
  } else {
    state.countdownEnd = null;
  }
  updateStatsUI();
  updateHintUI();
  startTimer();
}

/* =========================================================
 * 11. HINTS — Real CFOP stage detection + auto-transition
 * ========================================================= */

// --- Real CFOP milestone checks ---

/** All 9 stickers on a face match the center color. */
function isFaceSolved(faceId) {
  const def = FACE_DEFS[faceId];
  const cubies = getFaceCubies(faceId);
  // Find center cubie (the one with only one non-zero coord)
  const centerCubie = cubies.find((c) => {
    if (def.axis === "x") return Math.abs(c.position.y) < 0.5 && Math.abs(c.position.z) < 0.5;
    if (def.axis === "y") return Math.abs(c.position.x) < 0.5 && Math.abs(c.position.z) < 0.5;
    return Math.abs(c.position.x) < 0.5 && Math.abs(c.position.y) < 0.5;
  });
  if (!centerCubie) return false;
  const centerSticker = getOutwardSticker(centerCubie, def.axis, def.sign);
  if (!centerSticker) return false;
  const target = centerSticker.material.color.getHex();
  for (const c of cubies) {
    const s = getOutwardSticker(c, def.axis, def.sign);
    if (!s || s.material.color.getHex() !== target) return false;
  }
  return true;
}

/** White cross: the 4 U-face edge cubies have white up + side matches center. */
function isCrossDone() {
  const uCubies = getFaceCubies("U");
  // Edge cubies on U face: exactly one of x/z is non-zero
  const edges = uCubies.filter((c) => {
    const nz = (Math.abs(c.position.x) > 0.5 ? 1 : 0) + (Math.abs(c.position.z) > 0.5 ? 1 : 0);
    return nz === 1;
  });
  if (edges.length !== 4) return false;
  for (const edge of edges) {
    const uSticker = getOutwardSticker(edge, "y", 1);
    if (!uSticker || uSticker.material.color.getHex() !== COLORS.up) return false;
    // Side sticker must match adjacent center
    if (Math.abs(edge.position.x) > 0.5) {
      const sign = edge.position.x > 0 ? 1 : -1;
      const s = getOutwardSticker(edge, "x", sign);
      const faceId = sign > 0 ? "R" : "L";
      if (!s || s.material.color.getHex() !== FACE_DEFS[faceId].color) return false;
    } else {
      const sign = edge.position.z > 0 ? 1 : -1;
      const s = getOutwardSticker(edge, "z", sign);
      const faceId = sign > 0 ? "F" : "B";
      if (!s || s.material.color.getHex() !== FACE_DEFS[faceId].color) return false;
    }
  }
  return true;
}

/** F2L: cross + U-face corners correct + middle-layer edges correct. */
function isF2LDone() {
  if (!isCrossDone()) return false;
  // U-face corners: all three stickers match their face centers
  const uCubies = getFaceCubies("U");
  const corners = uCubies.filter((c) => Math.abs(c.position.x) > 0.5 && Math.abs(c.position.z) > 0.5);
  if (corners.length !== 4) return false;
  for (const corner of corners) {
    const uS = getOutwardSticker(corner, "y", 1);
    if (!uS || uS.material.color.getHex() !== COLORS.up) return false;
    const xs = corner.position.x > 0 ? 1 : -1;
    const zs = corner.position.z > 0 ? 1 : -1;
    const xS = getOutwardSticker(corner, "x", xs);
    const zS = getOutwardSticker(corner, "z", zs);
    if (!xS || xS.material.color.getHex() !== FACE_DEFS[xs > 0 ? "R" : "L"].color) return false;
    if (!zS || zS.material.color.getHex() !== FACE_DEFS[zs > 0 ? "F" : "B"].color) return false;
  }
  // Middle-layer edges (y ≈ 0, x and z both non-zero)
  const midEdges = state.miniCubes.filter((c) =>
    Math.abs(c.position.y) < 0.5 && Math.abs(c.position.x) > 0.5 && Math.abs(c.position.z) > 0.5
  );
  if (midEdges.length !== 4) return false;
  for (const edge of midEdges) {
    const xs = edge.position.x > 0 ? 1 : -1;
    const zs = edge.position.z > 0 ? 1 : -1;
    const xS = getOutwardSticker(edge, "x", xs);
    const zS = getOutwardSticker(edge, "z", zs);
    if (!xS || xS.material.color.getHex() !== FACE_DEFS[xs > 0 ? "R" : "L"].color) return false;
    if (!zS || zS.material.color.getHex() !== FACE_DEFS[zs > 0 ? "F" : "B"].color) return false;
  }
  return true;
}

/** OLL: the D face (yellow) is all one color. */
function isOLLDone() {
  return isFaceSolved("D");
}

/**
 * Detect the current CFOP stage by examining the actual cube state.
 * Returns one of: "scrambled", "cross", "f2l", "oll", "pll", "solved".
 */
function detectSolvingStage() {
  cubeGroup.updateMatrixWorld(true);
  if (checkSolved()) return "solved";
  if (isOLLDone()) return "pll";       // D face all yellow → just permute
  if (isF2LDone()) return "oll";       // first two layers done → orient last layer
  if (isCrossDone()) return "f2l";     // cross done → fill first two layers
  // No cross yet — see if we have any edges placed
  const pct = calculateSolvedPercent();
  if (pct < 12) return "scrambled";
  return "cross";
}

const HINTS = {
  scrambled: {
    stage: "Get Started",
    brief: "Find the white center on top. Look for white edge pieces around the cube and bring them up one at a time to form a plus sign.",
    algo: "F2 / U' R' F R",
  },
  cross: {
    stage: "White Cross",
    brief: "Make a plus sign of white edges around the top center. Each edge's side color must match the adjacent center. Use this algorithm to flip an edge in place.",
    algo: "F U' R U",
  },
  f2l: {
    stage: "First Two Layers (F2L)",
    brief: "Pair each white corner with its matching edge, then insert them together. Repeat for all four slots. This algorithm inserts a pair from the top-right.",
    algo: "R U R' U'",
  },
  oll: {
    stage: "Orient Last Layer (OLL)",
    brief: "Make the bottom (yellow) face all yellow. If you have an 'L' shape, hold it in the back-left and use this. For a line, hold it horizontal.",
    algo: "F R U R' U' F'",
  },
  pll: {
    stage: "Permute Last Layer (PLL)",
    brief: "Permute the last-layer pieces so every side matches. Look for 'headlights' (two adjacent same-color stickers) on a side face and use this algorithm.",
    algo: "R U R' U R U2 R'",
  },
  solved: {
    stage: "Solved!",
    brief: "You did it! Try a faster time, fewer moves, or a harder scramble.",
    algo: "—",
  },
};

/** Show a toast notification when the stage changes. */
function showStageToast(newStage) {
  const hint = HINTS[newStage];
  if (!hint) return;
  const toast = $("stage-toast");
  $("toast-title").textContent = "✅ Stage advanced!";
  $("toast-stage").textContent = "Next: " + hint.stage;
  $("toast-algo").textContent = hint.algo;
  toast.classList.add("visible");
  // Flash the hint card too
  const card = $("hint-card");
  card.classList.remove("stage-changed");
  void card.offsetWidth; // force reflow to restart animation
  card.classList.add("stage-changed");
  // Auto-hide after 3.5 s
  clearTimeout(showStageToast._timer);
  showStageToast._timer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3500);
}

function updateHintUI() {
  const card = $("hint-card");
  if (state.level === 3) {
    // No hints in level 3
    card.classList.add("empty");
    card.innerHTML = `
      <div class="head">
        <span class="label">Hints</span>
        <span class="stage-name">Level 3: no hints</span>
      </div>
      <div class="body">You are on your own.  Beat the clock.</div>
    `;
    return;
  }

  const stage = detectSolvingStage();
  const hint = HINTS[stage];
  card.classList.remove("empty");
  if (state.level === 1) {
    // Full algorithm hint
    card.innerHTML = `
      <div class="head">
        <span class="label">Stage: ${hint.stage}</span>
        <span class="stage-name">Algorithm</span>
      </div>
      <div class="body">${hint.brief}</div>
      <div class="algo">${hint.algo}</div>
    `;
  } else {
    // Level 2: brief hint only, no algorithm
    card.innerHTML = `
      <div class="head">
        <span class="label">Stage: ${hint.stage}</span>
        <span class="stage-name">Brief Hint</span>
      </div>
      <div class="body">${hint.brief}</div>
    `;
  }
}

/* =========================================================
 * 12. WIN / LOSE / TIMER UP
 * ========================================================= */

function onWin() {
  stopTimer();
  state.isSolved = true;
  $("overlay-title").className = "win";
  $("overlay-title").textContent = "🎉 Solved!";
  $("overlay-text").textContent = "Great work. The cube is fully solved.";
  $("ov-time").textContent = formatTime(state.elapsedMs);
  $("ov-moves").textContent = state.moveLog.filter((m) => !m.scramble).length;
  $("ov-level").textContent = state.level;
  $("overlay").classList.add("visible");
}

function onGiveUp() {
  state.giveUp = true;
  stopTimer();
  $("overlay-title").className = "lose";
  $("overlay-title").textContent = "Game Over";
  $("overlay-text").textContent = "You gave up this time. The cube will be restored next restart.";
  $("ov-time").textContent = formatTime(state.elapsedMs);
  $("ov-moves").textContent = state.moveLog.filter((m) => !m.scramble).length;
  $("ov-level").textContent = state.level;
  $("overlay").classList.add("visible");
}

function onTimeUp() {
  stopTimer();
  state.giveUp = true;
  $("overlay-title").className = "lose";
  $("overlay-title").textContent = "⏰ Time's Up";
  $("overlay-text").textContent = `You didn't finish the cube in time on Level 3.  The cube is ${calculateSolvedPercent()}% solved.`;
  $("ov-time").textContent = "5:00.00";
  $("ov-moves").textContent = state.moveLog.filter((m) => !m.scramble).length;
  $("ov-level").textContent = state.level;
  $("overlay").classList.add("visible");
}

function hideOverlay() {
  $("overlay").classList.remove("visible");
}

$("overlay-restart").addEventListener("click", () => {
  hideOverlay();
  restartGame();
});

$("overlay-close").addEventListener("click", hideOverlay);

/* =========================================================
 * 13. RESIZE
 * ========================================================= */

function resize() {
  const wrap = document.getElementById("canvas-wrap");
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

/* =========================================================
 * 14. RENDER LOOP + INIT
 * ========================================================= */

function loop() {
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function init() {
  resize();
  buildCube();
  updateStatsUI();
  updateHintUI();
  updateFaceIndicator();
  updateRotatorButtons();
  loop();
  // Auto-scramble at first load.  We use a setTimeout so the first render
  // gets a chance to draw the solved cube before we start animating.
  const startGen = state.generation;
  setTimeout(() => {
    if (state.generation === startGen) scramble(20);
  }, 300);
}

init();
