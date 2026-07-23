/* ============================================================
   Bug Stealth — level data (3 challenge presets)
   Each level changes VARIABLES and RELATIONSHIPS, not only
   visual decoration, as required by the development brief §7.

   Coordinate system: 1024 x 640 world units, top-down.
   Vector3 in the system graph is represented here as
   {x, y, z} where z is only used by the plant / climb height.
   ============================================================ */

const LEVELS = [

  /* ----------------------------------------------------------
     LEVEL 1  (Tier 1 — only water is required)
     System graph: "single insect patrol route, one mirror,
                    no complex obstacles"
     Goal: place water-bottle and climb to wall-top.
     showVision: true — beginners can see insect detection range.
     ---------------------------------------------------------- */
  {
    name: "Seedling",
    tier: 1,
    timeLimit: 120,            // game running-time (Float) seconds
    showVision: true,          // show insect detection radius for beginners

    player:  { x: 110, y: 540 },

    // --- Environment data (system graph variables) ---
    insects: [
      {
        // insect patrol position (Vector3 waypoints)
        patrol: [ {x:430,y:150}, {x:430,y:490}, {x:760,y:490}, {x:760,y:150} ],
        patrolSpeed: 70,        // insect-moving speed (Float) — slow patrol
        diveSpeed: 200,         // fast dive once player spotted
        detectRadius: 110,      // detection range
      }
    ],

    mirrors: [
      // correct angle ~0.2 deg; starts at 15 deg (15 deg off, player must rotate CCW)
      { x: 540, y: 320, baseAngle: 15, range: 35 },
    ],

    sun:   { x: 60,  y: 40,  angle: 0.528 },  // ray aims at mirror center
    items: [
      { x: 250, y: 470, type: "water" },
    ],
    plant: { x: 870, y: 130, required: ["water"] },
    wallTop: { x: 870, y: 40, w: 90, h: 60 },  // wall-top destination position (Vector3)

    shadowZones: [
      { x: 120, y: 360, w: 110, h: 70 },
      { x: 620, y: 250, w: 120, h: 70 },
    ],
    walls: [],                // no complex obstacles
  },

  /* ----------------------------------------------------------
     LEVEL 2  (Tier 3 — water + fertilizer + sunlight required)
     Formerly Level 3 "Hunter" — promoted because old L2 was
     deemed too easy.
     System graph: "multiple crossing-patrol insects,
                    fast dive-speed, multi-mirrors, lots of barriers"
     Goal: finish placing items AND a valid sunlight reflection
           without collision.
     ---------------------------------------------------------- */
  {
    name: "Hunter",
    tier: 3,
    timeLimit: 180,

    player:  { x: 90, y: 540 },

    insects: [
      {
        patrol: [ {x:260,y:100}, {x:260,y:540}, {x:520,y:540}, {x:520,y:100} ],
        patrolSpeed: 95, diveSpeed: 280, detectRadius: 125,
      },
      {
        patrol: [ {x:720,y:540}, {x:720,y:100}, {x:520,y:100}, {x:520,y:540} ],
        patrolSpeed: 95, diveSpeed: 280, detectRadius: 125,
      },
      {
        patrol: [ {x:900,y:120}, {x:640,y:300}, {x:900,y:480}, {x:960,y:300} ],
        patrolSpeed: 100, diveSpeed: 300, detectRadius: 130,
      },
    ],

    mirrors: [
      // correct angle ~28.2 deg; starts at 40 deg (12 deg off, rotate CCW)
      { x: 300, y: 200, baseAngle: 40, range: 40 },
      // correct angle ~-8.2 deg; starts at 5 deg (13 deg off, rotate CCW)
      { x: 640, y: 350, baseAngle: 5,  range: 40 },
      // Mirror 3 is an off-path alternative the player can experiment with
      { x: 800, y: 450, baseAngle: 30,  range: 40 },
    ],

    sun:   { x: 50, y: 40, angle: 0.569 },    // ray aims at Mirror 1 center
    items: [
      { x: 210, y: 480, type: "water" },
      { x: 180, y: 180, type: "fertilizer" },
    ],
    plant: { x: 900, y: 130, required: ["water", "fertilizer", "sunlight"] },
    wallTop: { x: 900, y: 40, w: 90, h: 60 },

    shadowZones: [
      { x: 120, y: 340, w: 90, h: 70 },
      { x: 430, y: 430, w: 90, h: 70 },
      { x: 660, y: 430, w: 90, h: 70 },
      { x: 820, y: 250, w: 90, h: 70 },
    ],
    walls: [                  // lots of barriers
      { x: 300, y: 420, w: 90, h: 22 },
      { x: 470, y: 340, w: 22, h: 90 },
      { x: 660, y: 260, w: 90, h: 22 },
      { x: 820, y: 400, w: 22, h: 80 },
    ],
  },

  /* ----------------------------------------------------------
     LEVEL 3  (Tier 3 — water + fertilizer + sunlight required)
     NEW — "Nightmare": the hardest challenge.
     System graph: "four crossing-patrol insects with wide
                    detection, very fast dive-speed, tight time,
                    maze-like barriers, minimal shadow cover,
                    mirrors with large initial offset"
     Goal: survive, place items, align sunlight, climb out.
     ---------------------------------------------------------- */
  {
    name: "Nightmare",
    tier: 3,
    timeLimit: 150,            // tighter than Hunter's 180
    showVision: true,          // show insect detection radius

    player:  { x: 80, y: 560 },

    insects: [
      // 4 insects — faster, wider detection, aggressive
      {
        patrol: [ {x:240,y:100}, {x:240,y:540}, {x:480,y:540}, {x:480,y:100} ],
        patrolSpeed: 115, diveSpeed: 320, detectRadius: 140,
      },
      {
        patrol: [ {x:700,y:540}, {x:700,y:100}, {x:480,y:100}, {x:480,y:540} ],
        patrolSpeed: 115, diveSpeed: 320, detectRadius: 140,
      },
      {
        patrol: [ {x:880,y:120}, {x:620,y:300}, {x:880,y:480}, {x:950,y:300} ],
        patrolSpeed: 120, diveSpeed: 340, detectRadius: 145,
      },
      {
        // 4th insect — horizontal cross-map sweeper
        patrol: [ {x:100,y:300}, {x:950,y:300}, {x:950,y:360}, {x:100,y:360} ],
        patrolSpeed: 125, diveSpeed: 360, detectRadius: 150,
      },
    ],

    mirrors: [
      // correct angle ~28.2 deg; starts at 48 deg (20 deg off — harder!)
      { x: 300, y: 200, baseAngle: 48, range: 40 },
      // correct angle ~-8.2 deg; starts at 15 deg (23 deg off — harder!)
      { x: 640, y: 350, baseAngle: 15,  range: 40 },
      // Mirror 3 decoy — placed to confuse
      { x: 820, y: 480, baseAngle: 30,  range: 40 },
    ],

    sun:   { x: 50, y: 40, angle: 0.569 },    // same ray geometry as Hunter
    items: [
      { x: 200, y: 500, type: "water" },       // risky — near bottom patrol
      { x: 160, y: 160, type: "fertilizer" },   // risky — near top patrol
    ],
    plant: { x: 900, y: 130, required: ["water", "fertilizer", "sunlight"] },
    wallTop: { x: 900, y: 40, w: 90, h: 60 },

    shadowZones: [
      // fewer, smaller shadows — harder to hide
      { x: 120, y: 340, w: 80, h: 55 },
      { x: 430, y: 440, w: 80, h: 55 },
      { x: 680, y: 250, w: 80, h: 55 },
    ],
    walls: [                  // maze-like barriers
      { x: 300, y: 420, w: 90, h: 22 },
      { x: 470, y: 340, w: 22, h: 90 },
      { x: 660, y: 260, w: 90, h: 22 },
      { x: 820, y: 400, w: 22, h: 80 },
      { x: 150, y: 240, w: 22, h: 60 },   // new — blocks left corridor
      { x: 550, y: 100, w: 80, h: 22 },   // new — near plant approach
    ],
  },
];

// Expose for non-module script tags (Track A — no build step)
window.LEVELS = LEVELS;
