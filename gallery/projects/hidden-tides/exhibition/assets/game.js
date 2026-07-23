// ============================================================
//  HIDDEN TIDES — 3D Sailing Survival Game
//  Three.js WebGL Edition — Track A: CDN dependency only
// ============================================================

(function () {
  "use strict";

  // ---- THREE.JS SETUP ----
  var canvas = document.getElementById("gameCanvas");
  var container = document.getElementById("game-container");

  var scene = new THREE.Scene();

  // Camera: perspective, follows the boat
  var camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 1, 10000);
  camera.position.set(0, 180, 280);

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.tabIndex = 0;

  // ---- SKY & FOG — PIRATES OF THE CARIBBEAN ATMOSPHERE ----
  // Deep oceanic blue fading to gold at horizon — cinematic tropical seascape
  scene.background = new THREE.Color(0x0a2a4a);      // deep navy-blue sky base
  scene.fog = new THREE.FogExp2(0x1a4a6e, 0.00055);   // misty teal fog, blends sea into sky mysteriously

  // ---- LIGHTING — DRAMATIC CARIBBEAN SUNLIGHT ----
  // Sun (directional light with shadows) — bright gold cutting through deep blue
  var sunLight = new THREE.DirectionalLight(0xffd070, 1.5);   // brilliant Caribbean gold
  sunLight.position.set(300, 400, 200);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 1000;
  sunLight.shadow.camera.left = -500;
  sunLight.shadow.camera.right = 500;
  sunLight.shadow.camera.top = 400;
  sunLight.shadow.camera.bottom = -100;
  scene.add(sunLight);

  // Ambient light — cool blue fill (ocean ambient) with subtle warmth
  var ambientLight = new THREE.AmbientLight(0x4477aa, 0.4);   // cool ocean-blue fill
  scene.add(ambientLight);

  // Hemisphere light — golden sky above, deep teal sea below
  var hemiLight = new THREE.HemisphereLight(0xffcc55, 0x0a3a5c, 0.5);  // gold sky / navy sea
  scene.add(hemiLight);

  // Sun visual (glowing sphere) — blazing Caribbean sun, low on horizon
  var sunGeo = new THREE.SphereGeometry(35, 16, 16);
  var sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });   // brilliant gold
  var sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.set(450, 180, -350);    // lower position for "golden hour" feel
  scene.add(sunMesh);

  // Sun glow (larger transparent sphere) — radiant golden halo
  var glowGeo = new THREE.SphereGeometry(65, 16, 16);
  var glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.25 });
  var sunGlow = new THREE.Mesh(glowGeo, glowMat);
  sunGlow.position.copy(sunMesh.position);
  scene.add(sunGlow);

  // Second outer glow — huge diffuse aura (God rays effect)
  var auraGeo = new THREE.SphereGeometry(120, 16, 16);
  var auraMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.06 });
  var sunAura = new THREE.Mesh(auraGeo, auraMat);
  sunAura.position.copy(sunMesh.position);
  scene.add(sunAura);

  // ---- CLOUDS — DRAMATIC CARIBBEAN STORM CLOUDS ----
  // Dark brooding clouds with gold-rimmed edges (silver-lining effect)
  var cloudGroup = new THREE.Group();
  scene.add(cloudGroup);

  function createCloud(x, y, z, scale) {
    var cloud = new THREE.Group();
    // Two-tone cloud: dark body + bright gold edge (POTC style)
    var darkMat = new THREE.MeshLambertMaterial({
      color: 0x2a3a50,        // dark navy-grey cloud body
      transparent: true, opacity: 0.85
    });
    var goldMat = new THREE.MeshLambertMaterial({
      color: 0xffcc44,        // gold-rimmed edges (sunlit)
      transparent: true, opacity: 0.7
    });
    var puffCount = 3 + Math.floor(Math.random() * 4);
    for (var i = 0; i < puffCount; i++) {
      var pSize = 15 + Math.random() * 25;
      var puffGeo = new THREE.SphereGeometry(pSize, 8, 8);
      // Outer puffs get gold rim, inner stay dark
      var mat = (i === 0 || i === puffCount - 1) ? goldMat : darkMat;
      var puff = new THREE.Mesh(puffGeo, mat);
      puff.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 20
      );
      puff.scale.y = 0.5 + Math.random() * 0.3;
      cloud.add(puff);
    }
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(scale);
    return cloud;
  }

  // Scatter clouds across the sky
  for (var ci = 0; ci < 25; ci++) {
    var cx = Math.random() * MAP_WIDTH_3D * 1.2 - MAP_WIDTH_3D * 0.1;
    var cy = 150 + Math.random() * 200;
    var cz = (Math.random() - 0.5) * 1200;
    var cs = 0.8 + Math.random() * 1.5;
    cloudGroup.add(createCloud(cx, cy, cz, cs));
  }

  // ---- OCEAN (animated wave plane) ----
  var OCEAN_WIDTH = MAP_WIDTH_3D + 500;
  var OCEAN_DEPTH = 800;
  var oceanGeo = new THREE.PlaneGeometry(OCEAN_WIDTH, OCEAN_DEPTH, 128, 64);
  oceanGeo.rotateX(-Math.PI / 2); // lay flat on XZ

  // Store original vertices for wave animation
  var oceanPositions = oceanGeo.attributes.position.array;
  var oceanOriginals = new Float32Array(oceanPositions.length);
  for (var oi = 0; oi < oceanPositions.length; oi++) {
    oceanOriginals[oi] = oceanPositions[oi];
  }

  // Ocean material — deep Caribbean blue with brilliant golden sun-path reflections
  var oceanMat = new THREE.MeshPhongMaterial({
    color: 0x0a3a5e,           // deep Caribbean navy-blue
    specular: 0xffdd55,        // brilliant gold sun reflection on water
    shininess: 120,            // sharper highlights (tropical sun)
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide
  });
  var ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.position.set(MAP_WIDTH_3D / 2, -2, 0);
  ocean.receiveShadow = true;
  scene.add(ocean);

  // Secondary foam layer — tropical sea-foam (white-blue with gold shimmer)
  var foamGeo = new THREE.PlaneGeometry(OCEAN_WIDTH, OCEAN_DEPTH, 64, 32);
  foamGeo.rotateX(-Math.PI / 2);
  var foamMat = new THREE.MeshBasicMaterial({
    color: 0xddeeff,          // cool white-blue sea-foam
    transparent: true,
    opacity: 0.06,
    wireframe: false
  });
  var foam = new THREE.Mesh(foamGeo, foamMat);
  foam.position.set(MAP_WIDTH_3D / 2, -0.5, 0);
  scene.add(foam);

  // Underwater tint plane — mysterious Caribbean depths
  var deepWaterGeo = new THREE.PlaneGeometry(OCEAN_WIDTH, OCEAN_DEPTH);
  deepWaterGeo.rotateX(-Math.PI / 2);
  var deepWaterMat = new THREE.MeshBasicMaterial({
    color: 0x051a30,           // abyssal navy (very deep, mysterious)
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
  });
  var deepWater = new THREE.Mesh(deepWaterGeo, deepWaterMat);
  deepWater.position.set(MAP_WIDTH_3D / 2, -15, 0);
  scene.add(deepWater);

  // ---- CONSTANTS ----
  var SEA_TOP_3D = -280;     // Z boundary (north)
  var SEA_BOTTOM_3D = 280;   // Z boundary (south)
  var MAP_WIDTH_3D = 6000;   // X extent (east-west)
  var MAX_HEALTH = 100;
  var MAX_ENERGY = 100;

  // ---- KEYBOARD INPUT (same bulletproof system) ----
  var keyDown = {};
  window.addEventListener("keydown", function (e) {
    var code = e.code || "";
    var key = (e.key || "").toLowerCase();
    keyDown[code] = true;
    keyDown[key] = true;
    var gameKeys = [
      "KeyW","KeyA","KeyS","KeyD",
      "ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
      "Space", "KeyP","KeyR",
      "w","a","s","d"," ","p","r"
    ];
    if (gameKeys.indexOf(code) >= 0 || gameKeys.indexOf(key) >= 0) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", function (e) {
    var code = e.code || "";
    var key = (e.key || "").toLowerCase();
    keyDown[code] = false;
    keyDown[key] = false;
  });

  function isDown(codes) {
    for (var i = 0; i < codes.length; i++) {
      if (keyDown[codes[i]]) return true;
    }
    return false;
  }

  // ---- GAME STATE (logic layer — same as 2D version) ----
  var boat = {
    x: 120, z: 0,
    vx: 0, vz: 0,
    heading: 0,
    health: MAX_HEALTH, energy: MAX_ENERGY,
    stones: 2, attackCool: 0, invuln: 0,
    identityFragments: []
  };

  // ---- IDENTITY FRAGMENT STORIES ----
  var IDENTITY_STORIES = [
    { id: "f1", title: "A Tattered Letter", text: "Found in a floating bottle: '...you were a navigator's apprentice. Your ship was lost in the Tides of Deception. You survived \u2014 but do you remember why?'" },
    { id: "f2", title: "The Captain's Log", text: "'Day 42: The open waters claimed three more crew. Only by hugging the stone channels did we survive. The sea shows mercy only to those who read her signs.'", hint: true },
    { id: "f3", title: "A Stranger's Warning", text: "'Not everything that glitters is gold, sailor. Some crates carry hope. Others carry empty promises. The difference? There is none \u2014 until you open them.'", hint: true },
    { id: "f4", title: "Faded Photograph", text: "A photo of you at a dock, younger. On the back, written in your own hand: 'I will find what was taken from me \u2014 even if I must sail through the shark-infested waters.'" },
    { id: "f5", title: "The Quartermaster's Note", text: "'You have good instincts. Trust them when the sea looks too calm. Danger hides where nothing blocks your view.'", hint: true },
    { id: "f6", title: "Broken Compass", text: "The compass doesn't point north anymore. But its needle swings toward the finish line, as if it knows where you truly need to go." },
    { id: "f7", title: "Your Own Name", text: "Carved into a driftwood plank: a name. YOUR name. You are not just any survivor \u2014 you are the one who chose to sail back into these waters." }
  ];

  var env = null;

  // ---- 3D OBJECT GROUPS ----
  var gameWorld = new THREE.Group();    // all dynamic game objects
  scene.add(gameWorld);

  var boatMesh = null;                 // THREE.Group for the player boat
  var rockMeshes = [];                  // array of THREE.Mesh
  var sharkMeshes = [];                 // array of { mesh, data }
  var pirateMeshes = [];                // array of { mesh, data }
  var crateMeshes = [];                 // array of { mesh, data }
  var pinkZoneMeshes = [];              // array of THREE.Mesh
  var identityMeshes = [];              // array of { mesh, data }
  var finishMesh = null;                // THREE.Group

  // Particle systems
  var windParticles = null;
  var attackEffect = null;

  // ---- WORLD BUILDING (creates both logic data AND 3D meshes) ----
  function buildWorld(presetId) {
    // Clear old 3D objects
    while (gameWorld.children.length > 0) {
      var child = gameWorld.children[0];
      gameWorld.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
    }
    rockMeshes = []; sharkMeshes = []; pirateMeshes = [];
    crateMeshes = []; pinkZoneMeshes = []; identityMeshes = [];
    if (boatMesh) { gameWorld.remove(boatMesh); boatMesh = null; }
    if (finishMesh) { gameWorld.remove(finishMesh); finishMesh = null; }

    var p = PRESETS[presetId] || PRESETS.calm;

    // === ROCKS (stone fields) ===
    var rocks = [];
    for (var i = 0; i < p.rocks; i++) {
      var rx = 300 + Math.random() * (MAP_WIDTH_3D - 600);
      var rz = SEA_TOP_3D + 40 + Math.random() * (SEA_BOTTOM_3D - SEA_TOP_3D - 80);
      var rr = 18 + Math.random() * 25;
      rocks.push({ x: rx, z: rz, r: rr, angle: Math.random() * Math.PI * 2 });

      // 3D rock mesh — irregular boulder using dodecahedron
      var rockGeo = new THREE.DodecahedronGeometry(rr, 0);
      var rockMat = new THREE.MeshStandardMaterial({
        color: 0x7a7a7a,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
      });
      var rockMesh = new THREE.Mesh(rockGeo, rockMat);
      rockMesh.position.set(rx, rr * 0.35, rz);
      rockMesh.rotation.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      gameWorld.add(rockMesh);
      rockMeshes.push(rockMesh);
    }

    // === SHARKS ===
    var sharks = [];
    for (var i = 0; i < p.sharks; i++) {
      var sx, sz;
      for (var t = 0; t < 20; t++) {
        sx = 400 + Math.random() * (MAP_WIDTH_3D - 800);
        sz = SEA_TOP_3D + 50 + Math.random() * (SEA_BOTTOM_3D - SEA_TOP_3D - 100);
        var tooClose = false;
        for (var j = 0; j < rocks.length; j++) {
          if (Math.hypot(sx - rocks[j].x, sz - rocks[j].z) < 180) { tooClose = true; break; }
        }
        if (!tooClose) break;
      }
      sharks.push({
        x: sx, z: sz,
        vx: (Math.random() - 0.5) * 80,
        vz: (Math.random() - 0.5) * 40,
        alive: true, aggroRange: 250, attackCd: 0,
        finVisible: false, speed: 70 + p.sharkSpeedBonus
      });

      // 3D shark mesh
      var sGroup = new THREE.Group();

      // Body (elongated shape)
      var bodyGeo = new THREE.ConeGeometry(6, 28, 8);
      bodyGeo.rotateX(Math.PI / 2);
      var bodyMat = new THREE.MeshStandardMaterial({
        color: 0x556B7A, roughness: 0.6, metalness: 0.2
      });
      var bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.rotation.z = Math.PI / 2;
      sGroup.add(bodyMesh);

      // Dorsal fin
      var finGeo = new THREE.ConeGeometry(3, 10, 4);
      var finMat = new THREE.MeshStandardMaterial({ color: 0x445a68, roughness: 0.7 });
      var dorsalFin = new THREE.Mesh(finGeo, finMat);
      dorsalFin.position.set(-2, 7, 0);
      dorsalFin.rotation.x = -0.3;
      sGroup.add(dorsalFin);

      // Tail
      var tailGeo = new THREE.ConeGeometry(4, 10, 4);
      tailGeo.rotateX(Math.PI / 2);
      var tailMesh = new THREE.Mesh(tailGeo, bodyMat);
      tailMesh.position.set(18, 0, 0);
      tailMesh.rotation.z = -Math.PI / 2;
      sGroup.add(tailMesh);

      // Pectoral fins
      var pectGeo = new THREE.ConeGeometry(2, 8, 4);
      var pectL = new THREE.Mesh(pectGeo, finMat);
      pectL.position.set(0, -2, 5);
      pectL.rotation.x = 0.5;
      sGroup.add(pectL);
      var pectR = new THREE.Mesh(pectGeo, finMat);
      pectR.position.set(0, -2, -5);
      pectR.rotation.x = -0.5;
      sGroup.add(pectR);

      // Eye
      var eyeGeo = new THREE.SphereGeometry(1.5, 8, 8);
      var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      var eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(-10, 2, 3);
      sGroup.add(eye);
      var pupilGeo = new THREE.SphereGeometry(0.8, 8, 8);
      var pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      var pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(-10, 2, 3.8);
      sGroup.add(pupil);

      // Fin warning indicator (red triangle that shows when close)
      var warnGeo = new THREE.ConeGeometry(3, 8, 3);
      var warnMat = new THREE.MeshBasicMaterial({ color: 0xcc3333, visible: false });
      var warnFin = new THREE.Mesh(warnGeo, warnMat);
      warnFin.position.set(14, 0, 0);
      warnFin.rotation.z = -Math.PI / 2;
      sGroup.add(warnFin);

      sGroup.position.set(sx, 2, sz);
      sGroup.castShadow = true;
      gameWorld.add(sGroup);
      sharkMeshes.push({ mesh: sGroup, warnMesh: warnFin, bodyMesh: bodyMesh });
    }

    // === PIRATES ===
    var pirates = [];
    for (var i = 0; i < p.pirates; i++) {
      pirates.push({
        x: 800 + Math.random() * (MAP_WIDTH_3D - 1200),
        z: SEA_TOP_3D + 60 + Math.random() * (SEA_BOTTOM_3D - SEA_TOP_3D - 120),
        vx: 30 + Math.random() * 30,
        alive: true, flagRange: 900, shootCd: 0,
        speed: 40 + p.pirateSpeedBonus
      });

      // 3D pirate ship
      var pGroup = new THREE.Group();

      // Hull
      var hullShape = new THREE.Shape();
      hullShape.moveTo(16, 0);
      hullShape.lineTo(12, 6);
      hullShape.lineTo(-12, 5);
      hullShape.lineTo(-14, 0);
      hullShape.lineTo(-12, -5);
      hullShape.lineTo(12, -6);
      hullShape.closePath();
      var hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 8, bevelEnabled: false });
      var hullMat = new THREE.MeshStandardMaterial({
        color: 0x6b3c2a, roughness: 0.8, metalness: 0.1
      });
      var hullMesh_p = new THREE.Mesh(hullGeo, hullMat);
      hullMesh_p.rotation.x = -Math.PI / 2;
      hullMesh_p.position.y = -4;
      pGroup.add(hullMesh_p);

      // Deck
      var deckGeo = new THREE.BoxGeometry(20, 1.5, 10);
      var deckMat = new THREE.MeshStandardMaterial({ color: 0xc48852, roughness: 0.9 });
      var deckMesh = new THREE.Mesh(deckGeo, deckMat);
      deckMesh.position.y = 0;
      pGroup.add(deckMesh);

      // Mast
      var mastGeo = new THREE.CylinderGeometry(0.6, 0.8, 28, 6);
      var mastMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
      var mastMesh = new THREE.Mesh(mastGeo, mastMat);
      mastMesh.position.y = 14;
      pGroup.add(mastMesh);

      // Sail
      var sailGeo = new THREE.PlaneGeometry(16, 18);
      var sailMat = new THREE.MeshLambertMaterial({ color: 0xf5f0e0, side: THREE.DoubleSide });
      var sailMesh = new THREE.Mesh(sailGeo, sailMat);
      sailMesh.position.set(6, 18, 0);
      sailMesh.rotation.y = Math.PI / 2;
      pGroup.add(sailMesh);

      // Pirate flag
      var flagGeo = new THREE.PlaneGeometry(10, 7);
      var flagMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
      var flagMesh = new THREE.Mesh(flagGeo, flagMat);
      flagMesh.position.set(8, 27, 0);
      pGroup.add(flagMesh);

      // Skull on flag
      var skullGeo = new THREE.CircleGeometry(2, 8);
      var skullMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      var skullMesh = new THREE.Mesh(skullGeo, skullMat);
      skullMesh.position.set(8, 27, 0.01);
      pGroup.add(skullMesh);

      pGroup.position.set(pirates[pirates.length - 1].x, 0, pirates[pirates.length - 1].z);
      pGroup.castShadow = true;
      gameWorld.add(pGroup);
      pirateMeshes.push({ mesh: pGroup, flagMesh: flagMesh, sailMesh: sailMesh });
    }

    // === CRATES ===
    var crates = [];
    for (var i = 0; i < p.crates; i++) {
      var cx = 200 + Math.random() * (MAP_WIDTH_3D - 400);
      var cz = SEA_TOP_3D + 40 + Math.random() * (SEA_BOTTOM_3D - SEA_TOP_3D - 80);
      var hasStone = Math.random() < 0.55;
      crates.push({ x: cx, z: cz, collected: false, hasStone: hasStone, isDrop: false });

      // 3D crate
      var crateGeo = new THREE.BoxGeometry(12, 12, 12);
      var crateMat = new THREE.MeshStandardMaterial({
        color: hasStone ? 0xf0c040 : 0xc4953a,
        roughness: 0.8
      });
      var crateMesh = new THREE.Mesh(crateGeo, crateMat);
      crateMesh.position.set(cx, 6, cz);
      crateMesh.castShadow = true;
      gameWorld.add(crateMesh);
      crateMeshes.push({ mesh: crateMesh, data: crates[crates.length - 1] });
    }

    // === PINK ZONES (rest areas) ===
    var pinkZones = [];
    for (var i = 0; i < p.pinkZones; i++) {
      var pz = {
        x: 500 + (i * (MAP_WIDTH_3D - 800) / p.pinkZones),
        w: 200 - i * 25,
        h: SEA_BOTTOM_3D - SEA_TOP_3D
      };
      pinkZones.push(pz);

      // 3D pink zone — glowing translucent area
      var pzGeo = new THREE.PlaneGeometry(pz.w, pz.h);
      var pzMat = new THREE.MeshBasicMaterial({
        color: 0xff69b4,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide
      });
      var pzMesh = new THREE.Mesh(pzGeo, pzMat);
      pzMesh.rotation.x = -Math.PI / 2;
      pzMesh.position.set(pz.x + pz.w / 2, 0.5, 0);
      gameWorld.add(pzMesh);
      pinkZoneMeshes.push(pzMesh);

      // Angel symbols floating above
      for (var a = 0; a < 3; a++) {
        var angelGeo = new THREE.TorusGeometry(4, 0.8, 4, 12);
        var angelMat = new THREE.MeshBasicMaterial({
          color: 0xff96e6,
          transparent: true,
          opacity: 0.25
        });
        var angel = new THREE.Mesh(angelGeo, angelMat);
        angel.position.set(
          pz.x + pz.w * (0.2 + a * 0.3),
          25,
          (a - 1) * 40
        );
        angel.rotation.y = Math.PI / 2;
        gameWorld.add(angel);
        pinkZoneMeshes.push(angel); // reuse array for cleanup
      }
    }

    // === IDENTITY FRAGMENTS ===
    var identityFragments = [];
    for (var fi = 0; fi < IDENTITY_STORIES.length; fi++) {
      var story = IDENTITY_STORIES[fi];
      var fx = 350 + (fi / IDENTITY_STORIES.length) * (MAP_WIDTH_3D - 600);
      var fz = SEA_TOP_3D + 50 + Math.random() * (SEA_BOTTOM_3D - SEA_TOP_3D - 100);
      identityFragments.push({
        id: story.id, x: fx, z: fz,
        collected: false, title: story.title,
        text: story.text, hint: story.hint || false, glow: 0
      });

      // 3D identity fragment — glowing scroll/parchment
      var fragGroup = new THREE.Group();

      // Glow sphere (outer aura)
      var glowSGeo = new THREE.SphereGeometry(25, 16, 16);
      var glowSMat = new THREE.MeshBasicMaterial({
        color: 0xb478ff,
        transparent: true,
        opacity: 0.15
      });
      var glowSphere = new THREE.Mesh(glowSGeo, glowSMat);
      fragGroup.add(glowSphere);

      // Scroll body (irregular box shape)
      var scrollGeo = new THREE.BoxGeometry(14, 3, 18);
      var scrollMat = new THREE.MeshStandardMaterial({
        color: 0xf5ebd2,
        roughness: 0.9,
        emissive: 0x443322,
        emissiveIntensity: 0.2
      });
      var scrollMesh = new THREE.Mesh(scrollGeo, scrollMat);
      scrollMesh.position.y = 8;
      scrollMesh.rotation.y = Math.random() * 0.5;
      fragGroup.add(scrollMesh);

      // Floating sparkles around it
      var sparkleGeo = new THREE.OctahedronGeometry(1.2, 0);
      var sparkleMat = new THREE.MeshBasicMaterial({
        color: 0xc8a0ff,
        transparent: true,
        opacity: 0.7
      });
      for (var si = 0; si < 5; si++) {
        var spk = new THREE.Mesh(sparkleGeo, sparkleMat.clone());
        var sa = (si / 5) * Math.PI * 2;
        spk.position.set(Math.cos(sa) * 18, 10 + Math.sin(si) * 5, Math.sin(sa) * 18);
        fragGroup.add(spk);
      }

      fragGroup.position.set(fx, 0, fz);
      gameWorld.add(fragGroup);
      identityMeshes.push({ mesh: fragGroup, glowSphere: glowSphere, scrollMesh: scrollMesh, data: identityFragments[identityFragments.length - 1] });
    }

    // === FINISH FLAG ===
    var finishLine = { x: MAP_WIDTH_3D - 120 };
    finishMesh = new THREE.Group();

    // Pole
    var poleGeo = new THREE.CylinderGeometry(1, 1.5, 70, 6);
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 });
    var poleMesh = new THREE.Mesh(poleGeo, poleMat);
    poleMesh.position.y = 35;
    finishMesh.add(poleMesh);

    // Flag
    var fflagGeo = new THREE.PlaneGeometry(35, 24);
    var fflagMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71, side: THREE.DoubleSide });
    var fflagMesh = new THREE.Mesh(fflagGeo, fflagMat);
    fflagMesh.position.set(17, 55, 0);
    finishMesh.add(fflagMesh);

    // Flag text (simple plane as label)
    var labelCanvas = document.createElement("canvas");
    labelCanvas.width = 128; labelCanvas.height = 64;
    var lctx = labelCanvas.getContext("2d");
    lctx.fillStyle = "#27ae60"; lctx.fillRect(0, 0, 128, 64);
    lctx.fillStyle = "#fff"; lctx.font = "bold 24px sans-serif";
    lctx.textAlign = "center"; lctx.fillText("FINISH", 64, 40);
    var labelTex = new THREE.CanvasTexture(labelCanvas);
    var labelGeo = new THREE.PlaneGeometry(24, 12);
    var labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    var labelMesh_f = new THREE.Mesh(labelGeo, labelMat);
    labelMesh_f.position.set(17, 45, 0.1);
    finishMesh.add(labelMesh_f);

    // Glowing beacon on top
    var beaconGeo = new THREE.SphereGeometry(4, 8, 8);
    var beaconMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
    var beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 72;
    finishMesh.add(beacon);

    // Point light at finish
    var finishLight = new THREE.PointLight(0x2ecc71, 1, 200);
    finishLight.position.y = 60;
    finishMesh.add(finishLight);

    finishMesh.position.set(finishLine.x, 0, 0);
    gameWorld.add(finishMesh);

    // === START/END ZONE MARKERS ===
    // Left shore (start)
    var shoreGeo = new THREE.BoxGeometry(80, 20, SEA_BOTTOM_3D - SEA_TOP_3D);
    var shoreMat = new THREE.MeshStandardMaterial({ color: 0xc4a86a, roughness: 1 });
    var leftShore = new THREE.Mesh(shoreGeo, shoreMat);
    leftShore.position.set(-20, -5, 0);
    leftShore.receiveShadow = true;
    gameWorld.add(leftShore);

    // Right shore (near finish)
    var rightShore = new THREE.Mesh(shoreGeo.clone(), shoreMat.clone());
    rightShore.position.set(MAP_WIDTH_3D + 40, -5, 0);
    rightShore.receiveShadow = true;
    gameWorld.add(rightShore);

    // Build environment data object (for logic)
    env = {
      preset: presetId,
      rocks: rocks, sharks: sharks, pirates: pirates, crates: crates,
      pinkZones: pinkZones, identityFragments: identityFragments,
      finishLine: finishLine,
      timeLimit: p.timeLimit, timeLeft: p.timeLimit,
      windInterval: p.windInterval, windStrength: p.windStrength,
      windActive: false, windDirX: 0, windDirY: 0, windTimer: 0,
      sharkSpeedBonus: p.sharkSpeedBonus, pirateSpeedBonus: p.pirateSpeedBonus
    };
  }

  // ---- CREATE BOAT MESH ----
  function createBoatMesh() {
    if (boatMesh) {
      gameWorld.remove(boatMesh);
      boatMesh.traverse(function(c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(function(m) { m.dispose(); });
          else c.material.dispose();
        }
      });
    }

    boatMesh = new THREE.Group();

    // Hull (custom shape — pointed bow, flat stern)
    var hullShape = new THREE.Shape();
    hullShape.moveTo(18, 0);
    hullShape.lineTo(10, 7);
    hullShape.lineTo(-13, 6);
    hullShape.lineTo(-15, 0);
    hullShape.lineTo(-13, -6);
    hullShape.lineTo(10, -7);
    hullShape.closePath();
    var hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 10, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2 });
    var hullMat = new THREE.MeshStandardMaterial({
      color: 0xb5703a,
      roughness: 0.7,
      metalness: 0.1
    });
    var hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.rotation.x = -Math.PI / 2;
    hullMesh.position.y = -5;
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    boatMesh.add(hullMesh);

    // Deck
    var deckGeo = new THREE.BoxGeometry(22, 1.5, 12);
    var deckMat = new THREE.MeshStandardMaterial({ color: 0xc48852, roughness: 0.85 });
    var deckMesh_b = new THREE.Mesh(deckGeo, deckMat);
    deckMesh_b.position.y = 0.5;
    boatMesh.add(deckMesh_b);

    // Mast
    var mastGeo = new THREE.CylinderGeometry(0.5, 0.7, 26, 6);
    var mastMat = new THREE.MeshStandardMaterial({ color: 0x7a5330, roughness: 0.9 });
    var mastMesh_b = new THREE.Mesh(mastGeo, mastMat);
    mastMesh_b.position.set(1, 13, 0);
    boatMesh.add(mastMesh_b);

    // Sail (will animate with wind)
    var sailGeo = new THREE.PlaneGeometry(18, 22);
    var sailMat = new THREE.MeshLambertMaterial({
      color: 0xf5f0e0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    var sailMesh_b = new THREE.Mesh(sailGeo, sailMat);
    sailMesh_b.position.set(8, 17, 0);
    sailMesh_b.rotation.y = Math.PI / 2;
    boatMesh.add(sailMesh_b);
    boatMesh.userData.sailMesh = sailMesh_b;

    // Bow flag (small triangular flag at front)
    var bowFlagGeo = new THREE.ConeGeometry(3, 8, 3);
    var bowFlagMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c, side: THREE.DoubleSide });
    var bowFlag = new THREE.Mesh(bowFlagGeo, bowFlagMat);
    bowFlag.position.set(19, 8, 0);
    bowFlag.rotation.z = -Math.PI / 2;
    boatMesh.add(bowFlag);

    // Lantern (point light on boat for atmosphere)
    var lanternLight = new THREE.PointLight(0xffaa44, 0.4, 40);
    lanternLight.position.set(0, 10, 0);
    boatMesh.add(lanternLight);
    boatMesh.userData.lantern = lanternLight;

    // Position boat in world
    boatMesh.position.set(boat.x, 0, boat.z);
    boatMesh.castShadow = true;
    gameWorld.add(boatMesh);
  }

  // ---- CHALLENGE PRESETS (same balance) ----
  var PRESETS = {
    calm: {
      name: "Calm Passage",
      desc: "Fewer threats, more time to learn the waters.",
      color: "#27ae60",
      rocks: 22, sharks: 6, pirates: 2, crates: 8, pinkZones: 3,
      timeLimit: 260,
      sharkSpeedBonus: 0, pirateSpeedBonus: 0,
      windInterval: 18, windStrength: 40
    },
    shark: {
      name: "Shark Waters",
      desc: "More sharks in open water. Stick near the rocks.",
      color: "#e67e22",
      rocks: 28, sharks: 12, pirates: 4, crates: 10, pinkZones: 2,
      timeLimit: 240,
      sharkSpeedBonus: 25, pirateSpeedBonus: 10,
      windInterval: 12, windStrength: 65
    },
    storm: {
      name: "Storm Run",
      desc: "Frequent strong winds, many enemies, narrow safe zones.",
      color: "#c0392b",
      rocks: 32, sharks: 15, pirates: 5, crates: 11, pinkZones: 1,
      timeLimit: 220,
      sharkSpeedBonus: 35, pirateSpeedBonus: 20,
      windInterval: 7, windStrength: 95
    }
  };

  // ---- AUDIO (Web Audio API, same as before) ----
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function playTone(freq, dur, type, vol) {
    ensureAudio();
    if (audioCtx.state === "suspended") audioCtx.resume();
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (dur || 0.3));
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + (dur || 0.3));
  }
  function playWindSound() {
    ensureAudio();
    if (audioCtx.state === "suspended") audioCtx.resume();
    var len = 1.5;
    var buf = audioCtx.createBuffer(1, audioCtx.sampleRate * len, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / data.length) * 0.6;
    }
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    var g = audioCtx.createGain();
    g.gain.value = 0.25;
    src.connect(g); g.connect(audioCtx.destination);
    src.start();
  }
  function playJingle(notes, gap) {
    notes.forEach(function (n, i) {
      setTimeout(function () { playTone(n, 0.3, "square", 0.1); }, i * gap * 1000);
    });
  }

  // ---- INPUT READING (same logic, XZ plane) ----
  function readInput(dt) {
    var ax = 0, az = 0;
    if (isDown(["KeyW","w","ArrowUp"])) az -= 1;
    if (isDown(["KeyS","s","ArrowDown"])) az += 1;
    if (isDown(["KeyA","a","ArrowLeft"])) ax -= 1;
    if (isDown(["KeyD","d","ArrowRight"])) ax += 1;
    if (ax !== 0 && az !== 0) { ax *= 0.707; az *= 0.707; }

    var thrustPower = 420;
    var maxSpeed = 320;
    boat.vx += ax * thrustPower * dt;
    boat.vz += az * thrustPower * dt;

    var drag = 4.0;
    boat.vx *= Math.pow(0.01, dt * drag);
    boat.vz *= Math.pow(0.01, dt * drag);

    var spd = Math.hypot(boat.vx, boat.vz);
    if (spd > maxSpeed) {
      boat.vx = (boat.vx / spd) * maxSpeed;
      boat.vz = (boat.vz / spd) * maxSpeed;
    }
    if (spd > 8) boat.heading = Math.atan2(boat.vz, boat.vx);

    if (isDown(["Space"]) && boat.attackCool <= 0 && boat.energy >= 5) {
      doAttack(); boat.attackCool = 0.35; boat.energy -= 5;
    }
    if (boat.attackCool > 0) boat.attackCool -= dt;

    if (isDown(["KeyR","r"]) && boat.stones > 0 && boat.health < MAX_HEALTH) {
      boat.health = Math.min(MAX_HEALTH, boat.health + 25);
      boat.stones--;
      playTone(340, 0.15, "triangle", 0.12);
      flashMessage("Repaired +25 HP! Stones: " + boat.stones);
    }

    if (isDown(["KeyP","p"])) {
      if (state === "playing") { state = "paused"; return; }
      else if (state === "paused") { state = "playing"; return; }
    }
  }

  // ---- ATTACK LOGIC ----
  function doAttack() {
    playTone(180, 0.15, "sawtooth", 0.15);
    var range = 90;
    var bx = boat.x, bz = boat.z;

    // Visual attack effect
    showAttackEffect(bx, bz);

    for (var i = 0; i < env.sharks.length; i++) {
      var s = env.sharks[i];
      if (!s.alive) continue;
      if (Math.hypot(s.x - bx, s.z - bz) < range) {
        s.alive = false;
        playTone(520, 0.2, "square", 0.1);
        dropStoneAt(s.x, s.z);
        // Hide 3D shark mesh
        if (sharkMeshes[i]) sharkMeshes[i].mesh.visible = false;
      }
    }
    for (var i = 0; i < env.pirates.length; i++) {
      var p = env.pirates[i];
      if (!p.alive) continue;
      if (Math.hypot(p.x - bx, p.z - bz) < range) {
        p.alive = false;
        playTone(420, 0.2, "square", 0.1);
        dropStoneAt(p.x, p.z);
        if (pirateMeshes[i]) pirateMeshes[i].mesh.visible = false;
      }
    }
  }

  // Attack visual effect (expanding ring)
  function showAttackEffect(x, z) {
    var ringGeo = new THREE.RingGeometry(1, range, 32);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 1, z);
    gameWorld.add(ring);
    // Animate and remove
    var startT = performance.now();
    function animRing() {
      var elapsed = (performance.now() - startT) / 1000;
      if (elapsed > 0.4) {
        gameWorld.remove(ring);
        ringGeo.dispose(); ringMat.dispose();
        return;
      }
      ring.material.opacity = 0.5 * (1 - elapsed / 0.4);
      ring.scale.setScalar(1 + elapsed * 2);
      requestAnimationFrame(animRing);
    }
    animRing();
  }

  function dropStoneAt(x, z) {
    env.crates.push({ x: x + (Math.random() - 0.5) * 40, z: z + (Math.random() - 0.5) * 40, collected: false, hasStone: true, isDrop: true });
    // Create 3D mesh for dropped stone
    var stoneGeo = new THREE.DodecahedronGeometry(5, 0);
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.6, metalness: 0.3, emissive: 0x996600, emissiveIntensity: 0.3 });
    var stoneMesh = new THREE.Mesh(stoneGeo, stoneMat);
    stoneMesh.position.set(x, 8, z);
    stoneMesh.castShadow = true;
    gameWorld.add(stoneMesh);
    crateMeshes.push({ mesh: stoneMesh, data: env.crates[env.crates.length - 1] });
  }

  // ---- UPDATE: BOAT ----
  function updateBoat(dt) {
    if (boat.invuln > 0) boat.invuln -= dt;
    boat.x += boat.vx * dt;
    boat.z += boat.vz * dt;

    // Sea boundaries
    if (boat.z < SEA_TOP_3D + 20) { boat.z = SEA_TOP_3D + 20; boat.vz *= -0.3; }
    if (boat.z > SEA_BOTTOM_3D - 20) { boat.z = SEA_BOTTOM_3D - 20; boat.vz *= -0.3; }
    if (boat.x < 30) { boat.x = 30; boat.vx = 0; }

    // Rock collision
    if (env) {
      for (var i = 0; i < env.rocks.length; i++) {
        var r = env.rocks[i];
        var d = Math.hypot(boat.x - r.x, boat.z - r.z);
        var minDist = r.r + 16;
        if (d < minDist) {
          var nx = (boat.x - r.x) / d;
          var nz = (boat.z - r.z) / d;
          boat.x = r.x + nx * minDist;
          boat.z = r.z + nz * minDist;
          var impactSpd = Math.hypot(boat.vx, boat.vz);
          if (impactSpd > 40 && boat.invuln <= 0) {
            boat.health -= Math.min(20, impactSpd * 0.25);
            boat.invuln = 1.0;
            playTone(120, 0.3, "sawtooth", 0.15);
            flashMessage("Hit rock! Slow down near stones!");
          }
          var dot = boat.vx * nx + boat.vz * nz;
          boat.vx -= 1.5 * dot * nx;
          boat.vz -= 1.5 * dot * nz;
        }
      }
    }

    boat.energy = Math.min(MAX_ENERGY, boat.energy + dt * 2);
    if (boat.health <= 0) loseGame("Your boat sank beneath the waves.");

    // Update 3D boat mesh position/rotation
    if (boatMesh) {
      boatMesh.position.set(boat.x, 0, boat.z);
      boatMesh.rotation.y = -boat.heading + Math.PI / 2;

      // Bob on waves
      var bobY = Math.sin(performance.now() / 400) * 0.8 + Math.cos(performance.now() / 280) * 0.4;
      boatMesh.position.y = bobY;

      // Tilt based on velocity
      var tiltZ = -boat.vx * 0.002;
      var tiltX = boat.vz * 0.002;
      boatMesh.rotation.z = tiltZ;
      boatMesh.rotation.x = tiltX;

      // Invulnerability flash
      if (boat.invuln > 0) {
        boatMesh.visible = Math.floor(performance.now() / 80) % 2 === 0;
      } else {
        boatMesh.visible = true;
      }

      // Sail animation based on movement
      if (boatMesh.userData.sailMesh) {
        var sailAnim = Math.sin(performance.now() / 250) * 0.05;
        boatMesh.userData.sailMesh.rotation.y = Math.PI / 2 + sailAnim + (isDown(["KeyW","w","ArrowUp"]) ? 0.1 : 0);
      }
    }
  }

  // ---- UPDATE: SHARKS ----
  function updateSharks(dt) {
    if (!env) return;
    for (var i = 0; i < env.sharks.length; i++) {
      var s = env.sharks[i];
      if (!s.alive) continue;

      var dx = boat.x - s.x;
      var dz = boat.z - s.z;
      var dist = Math.hypot(dx, dz);

      s.finVisible = dist < 350;

      if (dist < s.aggroRange && dist > 5) {
        s.vx += (dx / dist) * 60 * dt;
        s.vz += (dz / dist) * 60 * dt;
      } else {
        s.vx += (Math.random() - 0.5) * 30 * dt;
        s.vz += (Math.random() - 0.5) * 15 * dt;
      }

      var spd = Math.hypot(s.vx, s.vz);
      if (spd > s.speed) { s.vx = (s.vx / spd) * s.speed; s.vz = (s.vz / spd) * s.speed; }

      s.x += s.vx * dt;
      s.z += s.vz * dt;

      s.z = Math.max(SEA_TOP_3D + 30, Math.min(SEA_BOTTOM_3D - 30, s.z));
      if (s.x < 100) s.vx += 20;
      if (s.x > MAP_WIDTH_3D - 100) s.vx -= 20;

      // Attack player
      if (dist < 28 && boat.invuln <= 0) {
        boat.health -= 18;
        boat.invuln = 1.2;
        playTone(150, 0.4, "sawtooth", 0.2);
        flashMessage("Shark bite! -18 HP!");
        boat.vx += dx / dist * 120;
        boat.vz += dz / dist * 120;
      }

      // Update 3D shark mesh
      if (sharkMeshes[i] && sharkMeshes[i].mesh.visible) {
        var sm = sharkMeshes[i].mesh;
        sm.position.set(s.x, 2, s.z);
        sm.rotation.y = -Math.atan2(s.vz, s.vx) + Math.PI / 2;

        // Body undulation
        if (sharkMeshes[i].bodyMesh) {
          sharkMeshes[i].bodyMesh.rotation.y = Math.sin(performance.now() / 200 + i) * 0.3;
        }

        // Show/hide warning fin
        if (sharkMeshes[i].warnMesh) {
          sharkMeshes[i].warnMesh.material.visible = s.finVisible;
          if (s.finVisible) {
            sharkMeshes[i].warnMesh.rotation.y = performance.now() / 200;
          }
        }

        // Bob in water
        sm.position.y = 2 + Math.sin(performance.now() / 350 + i * 2) * 1.5;
      }
    }
  }

  // ---- UPDATE: PIRATES ----
  function updatePirates(dt) {
    if (!env) return;
    for (var i = 0; i < env.pirates.length; i++) {
      var p = env.pirates[i];
      if (!p.alive) continue;

      p.x -= p.speed * dt;
      p.z += Math.sin(performance.now() / 700 + i) * 12 * dt;
      p.z = Math.max(SEA_TOP_3D + 40, Math.min(SEA_BOTTOM_3D - 40, p.z));

      var dx = boat.x - p.x;
      var dz = boat.z - p.z;
      var dist = Math.hypot(dx, dz);

      p.shootCd -= dt;
      if (p.shootCd <= 0 && dist < 320) {
        p.shootCd = 1.8;
        playTone(280, 0.12, "square", 0.08);
        if (dist < 45 && boat.invuln <= 0) {
          boat.health -= 14;
          boat.invuln = 0.8;
          playTone(200, 0.25, "sawtooth", 0.15);
          flashMessage("Pirate shot! -14 HP!");
        }
      }

      if (dist < 30 && boat.invuln <= 0) {
        boat.health -= 12;
        boat.invuln = 1.0;
        playTone(170, 0.3, "sawtooth", 0.15);
        flashMessage("Rammed by pirate! -12 HP!");
      }

      // Update 3D pirate mesh
      if (pirateMeshes[i] && pirateMeshes[i].mesh.visible) {
        var pm = pirateMeshes[i].mesh;
        pm.position.set(p.x, 0, p.z);
        pm.rotation.y = Math.PI / 8; // face left-ish

        // Bob
        pm.position.y = Math.sin(performance.now() / 400 + i) * 1.2;

        // Sail flutter
        if (pirateMeshes[i].sailMesh) {
          pirateMeshes[i].sailMesh.rotation.y = Math.PI / 2 + Math.sin(performance.now() / 180 + i) * 0.08;
        }

        // Flag wave
        if (pirateMeshes[i].flagMesh) {
          pirateMeshes[i].flagMesh.rotation.y = Math.sin(performance.now() / 150 + i) * 0.15;
        }
      }
    }
  }

  // ---- UPDATE: WIND ----
  function updateWind(dt) {
    if (!env) return;
    env.windTimer -= dt;
    if (env.windTimer <= 0 && !env.windActive) {
      env.windActive = true;
      env.windTimer = 2.0 + Math.random() * 2.0;
      var angle = Math.random() * Math.PI * 2;
      env.windDirX = Math.cos(angle) * env.windStrength;
      env.windDirY = Math.sin(angle) * env.windStrength * 0.5;
      playWindSound();
      flashMessage("Wind incoming! Steer against it!");
      showWindParticles();
    } else if (env.windTimer <= 0 && env.windActive) {
      env.windActive = false;
      env.windTimer = env.windInterval + Math.random() * 6;
      hideWindParticles();
    }

    if (env.windActive) {
      boat.vx += env.windDirX * dt;
      boat.vz += env.windDirY * dt;
    }

    if (env.windActive && (Math.abs(boat.vx) > 260 || boat.z < SEA_TOP_3D - 60 || boat.z > SEA_BOTTOM_3D + 60)) {
      loseGame("You were blown off course by the fierce wind!");
    }
  }

  // Wind particle streaks
  function showWindParticles() {
    if (windParticles) return;
    var particleCount = 200;
    var positions = new Float32Array(particleCount * 3);
    var velocities = [];

    for (var i = 0; i < particleCount; i++) {
      positions[i * 3] = boat.x + (Math.random() - 0.5) * 800;
      positions[i * 3 + 1] = Math.random() * 60 + 5;
      positions[i * 3 + 2] = boat.z + (Math.random() - 0.5) * 500;
      velocities.push({
        x: env.windDirX * (3 + Math.random() * 4),
        y: (Math.random() - 0.5) * 2,
        z: env.windDirY * (3 + Math.random() * 4)
      });
    }

    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    var pMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 3,
      transparent: true,
      opacity: 0.5
    });

    windParticles = new THREE.Points(pGeo, pMat);
    windParticles.userData.velocities = velocities;
    scene.add(windParticles);
  }

  function hideWindParticles() {
    if (windParticles) {
      scene.remove(windParticles);
      windParticles.geometry.dispose();
      windParticles.material.dispose();
      windParticles = null;
    }
  }

  function updateWindParticles(dt) {
    if (!windParticles || !env.windActive) return;
    var pos = windParticles.geometry.attributes.position.array;
    var vels = windParticles.userData.velocities;
    for (var i = 0; i < vels.length; i++) {
      pos[i * 3] += vels[i].x;
      pos[i * 3 + 1] += vels[i].y;
      pos[i * 3 + 2] += vels[i].z;
      // Reset if too far from boat
      var dx = pos[i * 3] - boat.x;
      var dz = pos[i * 3 + 2] - boat.z;
      if (Math.abs(dx) > 500 || Math.abs(dz) > 400) {
        pos[i * 3] = boat.x + (Math.random() - 0.5) * 800;
        pos[i * 3 + 1] = Math.random() * 60 + 5;
        pos[i * 3 + 2] = boat.z + (Math.random() - 0.5) * 500;
      }
    }
    windParticles.geometry.attributes.position.needsUpdate = true;
  }

  // ---- UPDATE: PICKUPS ----
  function updatePickups(dt) {
    if (!env) return;

    // Crates
    for (var i = 0; i < env.crates.length; i++) {
      var c = env.crates[i];
      if (c.collected) continue;
      if (Math.hypot(boat.x - c.x, boat.z - c.z) < 30) {
        c.collected = true;
        if (crateMeshes[i] && crateMeshes[i].mesh) crateMeshes[i].mesh.visible = false;
        if (c.hasStone) {
          boat.stones++;
          playTone(520, 0.15, "sine", 0.1);
          flashMessage("+1 Repair Stone (" + boat.stones + " total)");
        } else {
          playTone(160, 0.2, "triangle", 0.08);
          flashMessage("Empty crate... watch for decoys!");
        }
      }
      // Bob animation for crate meshes
      if (crateMeshes[i] && crateMeshes[i].mesh && crateMeshes[i].mesh.visible) {
        crateMeshes[i].mesh.position.y = 6 + Math.sin(performance.now() / 450 + i * 2) * 3;
        crateMeshes[i].mesh.rotation.y += dt * 0.5;
      }
    }

    // Pink zones
    for (var i = 0; i < env.pinkZones.length; i++) {
      var z = env.pinkZones[i];
      if (boat.x > z.x && boat.x < z.x + z.w) {
        boat.health = Math.min(MAX_HEALTH, boat.health + dt * 12);
        boat.energy = Math.min(MAX_ENERGY, boat.energy + dt * 15);
        if (pinkMsgTimer <= 0) {
          flashMessage("Pink River of Angels \u2014 resting...");
          pinkMsgTimer = 3.0;
        }
      }
    }
    if (pinkMsgTimer > 0) pinkMsgTimer -= dt;

    // Identity fragments
    for (var i = 0; i < env.identityFragments.length; i++) {
      var frag = env.identityFragments[i];
      if (frag.collected) continue;
      if (Math.hypot(boat.x - frag.x, boat.z - frag.z) < 35) {
        frag.collected = true;
        boat.identityFragments.push(frag.id);
        playTone([440, 550, 660][i % 3], 0.4, "sine", 0.12);
        showIdentityReveal(frag);
        if (identityMeshes[i] && identityMeshes[i].mesh) identityMeshes[i].mesh.visible = false;
      }
    }

    // Animate identity fragment meshes
    for (var i = 0; i < identityMeshes.length; i++) {
      var im = identityMeshes[i];
      if (!im.mesh.visible) continue;
      // Float up and down
      im.mesh.position.y = 8 + Math.sin(performance.now() / 500 + i * 2.5) * 4;
      // Rotate slowly
      im.mesh.rotation.y += dt * 0.3;
      // Pulse glow
      if (im.glowSphere) {
        var pulse = 0.7 + Math.sin(performance.now() / 350 + i) * 0.3;
        im.glowSphere.scale.setScalar(pulse);
        im.glowSphere.material.opacity = 0.1 * pulse;
      }
      // Sparkle rotation
      im.mesh.children.forEach(function(child, ci) {
        if (ci > 0) { // skip glow sphere and scroll
          child.rotation.x += dt * 2;
          child.rotation.y += dt * 3;
          child.position.y = 10 + Math.sin(performance.now() / 400 + ci) * 3;
        }
      });
    }
  }

  // ---- IDENTITY REVEAL UI ----
  var identityRevealTimer = 0;
  var currentIdentityFragment = null;

  function showIdentityReveal(frag) {
    currentIdentityFragment = frag;
    identityRevealTimer = 5.5;
    flashMessage("\u2728 Identity Found: " + frag.title + " (" + boat.identityFragments.length + "/" + IDENTITY_STORIES.length + ")");
  }

  // ---- WIN / LOSE ----
  function updateWinCondition() {
    if (!env) return;
    if (boat.x >= env.finishLine.x) winGame();
  }

  // ---- CAMERA (smooth follow in 3D) ----
  function updateCamera() {
    var targetX = boat.x - 200;
    var targetZ = boat.z + 200;
    camera.position.x += (targetX - camera.position.x) * 3 * 0.016;
    camera.position.z += (targetZ - camera.position.z + 280) * 3 * 0.016;
    camera.position.x = Math.max(0, Math.min(MAP_WIDTH_3D, camera.position.x));
    camera.lookAt(boat.x, 0, boat.z);

    // Update shadow camera to follow
    sunLight.target.position.set(boat.x, 0, boat.z);
    sunLight.target.updateMatrixWorld();
  }

  // ---- OCEAN ANIMATION ----
  function animateOcean(time) {
    var positions = oceanGeo.attributes.position.array;
    for (var i = 0; i < positions.length; i += 3) {
      var ox = oceanOriginals[i];
      var oy = oceanOriginals[i + 1];
      var oz = oceanOriginals[i + 2];
      // Multi-layered wave function
      var wave1 = Math.sin(ox * 0.02 + time * 0.0015) * 2.5;
      var wave2 = Math.sin(oz * 0.03 + time * 0.002) * 1.8;
      var wave3 = Math.cos((ox + oz) * 0.01 + time * 0.001) * 1.2;
      positions[i + 1] = oy + wave1 + wave2 + wave3;
    }
    oceanGeo.attributes.position.needsUpdate = true;
    oceanGeo.computeVertexNormals();

    // Foam layer follows waves slightly
    if (foam.geometry.attributes.position) {
      var fpos = foam.geometry.attributes.position.array;
      for (var i = 0; i < fpos.length; i += 3) {
        var fx = foam.geometry.attributes.position.array[i];
        var fz = foam.geometry.attributes.position.array[i + 2];
        var fw = Math.sin(fx * 0.02 + time * 0.0015) * 2.5 + Math.sin(fz * 0.03 + time * 0.002) * 1.8;
        fpos[i + 1] = fw;
      }
      foam.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ---- CLOUD DRIFT ANIMATION ----
  function animateClouds(dt) {
    cloudGroup.children.forEach(function(cloud, i) {
      cloud.position.x += (0.5 + i * 0.05) * dt * 3;
      if (cloud.position.x > MAP_WIDTH_3D + 500) {
        cloud.position.x = -500;
      }
    });
  }

  // ---- STATE MACHINE ----
  var state = "menu";
  var overlay = document.getElementById("overlay");
  var hudLayer = document.getElementById("hud-layer");

  function startGame(presetId) {
    ensureAudio();
    buildWorld(presetId);
    createBoatMesh();

    boat.x = 120;
    boat.z = 0;
    boat.vx = 0; boat.vz = 0; boat.heading = 0;
    boat.health = MAX_HEALTH; boat.energy = MAX_ENERGY; boat.stones = 2;
    boat.attackCool = 0; boat.invuln = 0;
    boat.identityFragments = [];

    flashMsg = ""; flashMsgTimer = 0; pinkMsgTimer = 0;
    runStartTime = performance.now();
    runStats = { sharksBeaten: 0, piratesBeaten: 0, stonesUsed: 0 };
    currentIdentityFragment = null;
    identityRevealTimer = 0;

    state = "playing";

    overlay.style.display = "none";
    overlay.innerHTML = "";
    overlay.style.pointerEvents = "none";

    canvas.focus();
    console.log("[GAME-3D] Started preset:", presetId);
  }

  function winGame() {
    state = "win";
    env.windActive = false;
    hideWindParticles();
    runElapsed = (performance.now() - runStartTime) / 1000;
    playJingle([523, 659, 784, 1047], 0.14);
    showEndOverlay(true);
  }

  function loseGame(reason) {
    if (state !== "playing") return;
    state = "lose";
    env.windActive = false;
    hideWindParticles();
    runElapsed = (performance.now() - runStartTime) / 1000;
    playTone([140, 110, 80][Math.floor(Math.random() * 3)], 0.6, "sawtooth", 0.2);
    showEndOverlay(false, reason);
  }

  function countBeaten() {
    if (!env) return;
    runStats.sharksBeaten = env.sharks.filter(function(s) { return !s.alive; }).length;
    runStats.piratesBeaten = env.pirates.filter(function(p) { return !p.alive; }).length;
  }

  // ---- OVERLAYS (HTML-based, same as before) ----
  var runStartTime = 0, runElapsed = 0;
  var runStats = { sharksBeaten: 0, piratesBeaten: 0, stonesUsed: 0 };

  function showMenu() {
    state = "menu";
    overlay.style.display = "flex";
    overlay.style.pointerEvents = "auto";
    overlay.innerHTML =
      '<div class="panel">' +
        '<h1>\u26f5 Hidden Tides <span style="font-size:0.45em;color:#ffd966">Caribbean Edition</span></h1>' +
        '<p class="subtitle">Sail the treacherous seas \u2014 sharks, pirates &amp; fortune await</p>' +
        '<p class="goal">Navigate from shore to finish line. The open water looks safest \u2014 but that\u2019s where the predators hide.</p>' +
        '<div class="preset-row">' +
          '<button class="btn" id="btn-calm" style="background:#27ae60">' + PRESETS.calm.name + '</button>' +
          '<button class="btn" id="btn-shark" style="background:#e67e22">' + PRESETS.shark.name + '</button>' +
          '<button class="btn" id="btn-storm" style="background:#c0392b">' + PRESETS.storm.name + '</button>' +
        '</div>' +
        '<div class="controls-info">' +
          '<strong>Controls:</strong> WASD / Arrows \u2014 Sail | Space \u2014 Attack | R \u2014 Repair | P \u2014 Pause' +
        '</div>' +
      '</div>';
    document.getElementById("btn-calm").onclick = function () { startGame("calm"); };
    document.getElementById("btn-shark").onclick = function () { startGame("shark"); };
    document.getElementById("btn-storm").onclick = function () { startGame("storm"); };
  }

  function showPauseOverlay() {
    overlay.style.display = "flex";
    overlay.style.pointerEvents = "auto";
    overlay.innerHTML = '<div class="panel"><h2>Paused</h2><p>Press P to resume.</p></div>';
  }

  function togglePause() {
    if (state === "playing") { state = "paused"; showPauseOverlay(); }
    else if (state === "paused") { state = "playing"; hideOverlay(); canvas.focus(); }
  }

  function hideOverlay() {
    overlay.style.display = "none";
    overlay.innerHTML = "";
    overlay.style.pointerEvents = "none";
  }

  function showEndOverlay(won, reason) {
    countBeaten();
    overlay.style.display = "flex";
    overlay.style.pointerEvents = "auto";
    var html =
      '<div class="panel">' +
        '<h2 style="color:' + (won ? "#ffd966" : "#cc4433") + '">' + (won ? "\u2605 Victory, Captain!" : "\u2620 Lost at Sea") + '</h2>';
    if (!won && reason) html += '<p class="reason">' + reason + '</p>';
    html +=
        '<div class="stats">' +
          '<div>Time: ' + runElapsed.toFixed(1) + 's</div>' +
          '<div>Health: ' + Math.max(0, Math.round(boat.health)) + ' / ' + MAX_HEALTH + '</div>' +
          '<div>Sharks beaten: ' + runStats.sharksBeaten + '</div>' +
          '<div>Pirates beaten: ' + runStats.piratesBeaten + '</div>' +
          '<div>Stones remaining: ' + boat.stones + '</div>' +
          '<div style="color:#b388ff">\u2728 Identity fragments found: ' + boat.identityFragments.length + ' / ' + IDENTITY_STORIES.length + '</div>' +
        '</div>' +
        '<div class="preset-row">' +
          '<button class="btn btn-restart" id="btn-retry">Play Again</button>' +
          '<button class="btn btn-restart" id="btn-menu">Main Menu</button>' +
        '</div>' +
      '</div>';
    overlay.innerHTML = html;
    document.getElementById("btn-retry").onclick = function () { startGame(env.preset); };
    document.getElementById("btn-menu").onclick = function () { showMenu(); };
  }

  // Flash messages
  var flashMsg = "", flashMsgTimer = 0, pinkMsgTimer = 0;

  function flashMessage(msg) {
    flashMsg = msg;
    flashMsgTimer = 2.5;
  }

  // ---- HUD (HTML overlay on top of 3D canvas) ----
  function renderHUD() {
    if (state !== "playing") { hudLayer.innerHTML = ""; return; }

    var html = "";

    // Health bar
    var hpPct = Math.max(0, boat.health) / MAX_HEALTH;
    var hpColor = hpPct > 0.4 ? "#2ecc71" : hpPct > 0.2 ? "#f39c12" : "#e74c3c";
    html += '<div style="position:absolute;left:12px;top:12px;width:204px;height:22px;background:rgba(0,0,0,0.45);border-radius:6px;">';
    html += '<div style="position:absolute;left:2px;top:2px;width:200px;height:18px;background:#333;border-radius:4px;"></div>';
    html += '<div style="position:absolute;left:2px;top:2px;width:' + (200 * hpPct) + 'px;height:18px;background:' + hpColor + ';border-radius:4px;"></div>';
    html += '<span style="position:absolute;left:8px;top:3px;color:#dfe6ea;font-size:11px;">HP ' + Math.max(0, Math.round(boat.health)) + '/' + MAX_HEALTH + '</span>';
    html += '</div>';

    // Energy bar
    var enPct = boat.energy / MAX_ENERGY;
    html += '<div style="position:absolute;left:12px;top:38px;width:154px;height:18px;background:rgba(0,0,0,0.45);border-radius:5px;">';
    html += '<div style="position:absolute;left:2px;top:2px;width:150px;height:14px;background:#1a3a5c;border-radius:3px;"></div>';
    html += '<div style="position:absolute;left:2px;top:2px;width:' + (150 * enPct) + 'px;height:14px;background:#3498db;border-radius:3px;"></div>';
    html += '<span style="position:absolute;left:6px;top:2px;color:#dfe6ea;font-size:10px;">Energy ' + Math.round(boat.energy) + '</span>';
    html += '</div>';

    // Stones
    html += '<div style="position:absolute;left:12px;top:58px;width:90px;height:18px;background:rgba(0,0,0,0.4);border-radius:4px;color:#dfe6ea;font-size:11px;padding:2px 6px;">\u2726 Stones: ' + boat.stones + '</div>';

    // Timer
    if (env) {
      var mins = Math.floor(env.timeLeft / 60);
      var secs = Math.floor(env.timeLeft % 60);
      var tstr = mins + ":" + (secs < 10 ? "0" : "") + secs;
      var tcolor = env.timeLeft < 30 ? "#e74c3c" : env.timeLeft < 60 ? "#f39c12" : "#ecf0f1";
      html += '<div style="position:absolute;right:12px;top:12px;width:100px;height:24px;background:rgba(0,0,0,0.45);border-radius:6px;text-align:right;padding:3px 8px;color:' + tcolor + ';font-weight:bold;font-size:14px;font-family:monospace;">' + tstr + '</div>';

      // Distance to finish
      var distRemaining = Math.max(0, env.finishLine.x - boat.x);
      html += '<div style="position:absolute;right:12px;top:38px;width:120px;height:18px;background:rgba(0,0,0,0.35);border-radius:4px;text-align:right;padding:2px 6px;color:#bdc3c7;font-size:11px;">Finish: ' + Math.round(distRemaining) + 'm</div>';
    }

    // Controls hint
    html += '<div style="position:absolute;left:8px;bottom:8px;width:340px;height:22px;background:rgba(0,0,0,0.35);border-radius:6px;color:#dfe6ea;font-size:11px;line-height:22px;padding:0 8px;">WASD/Arrows: sail &nbsp;|&nbsp; Space: attack &nbsp;|&nbsp; R: repair &nbsp;|&nbsp; P: pause</div>';

    // Identity counter
    var fragCount = boat.identityFragments.length;
    html += '<div style="position:absolute;right:12px;bottom:34px;width:212px;height:22px;background:rgba(40,40,40,0.6);border-radius:6px;text-align:right;padding:3px 8px;color:' + (fragCount > 0 ? '#b388ff' : '#666') + ';font-size:11px;font-weight:bold;">\u2728 Identity: ' + fragCount + ' / ' + IDENTITY_STORIES.length + '</div>';

    // Key diagnostic
    var activeKeys = [];
    if (isDown(["KeyW","w","ArrowUp"])) activeKeys.push("W");
    if (isDown(["KeyS","s","ArrowDown"])) activeKeys.push("S");
    if (isDown(["KeyA","a","ArrowLeft"])) activeKeys.push("A");
    if (isDown(["KeyD","d","ArrowRight"])) activeKeys.push("D");
    var diagText = activeKeys.length ? "[" + activeKeys.join("") + "]" : "---";
    diagText += " vel=(" + boat.vx.toFixed(0) + "," + boat.vz.toFixed(0) + ")";
    html += '<div style="position:absolute;right:12px;bottom:8px;width:192px;height:22px;background:rgba(40,40,40,0.6);border-radius:6px;text-align:right;padding:3px 8px;color:' + (activeKeys.length > 0 ? '#2ecc71' : '#888') + ';font-size:11px;font-weight:bold;font-family:monospace;">' + diagText + '</div>';

    // Wind warning
    if (env && env.windActive) {
      html += '<div style="position:absolute;50%;top:10px;left:50%;transform:translateX(-50%);width:240px;height:32px;background:rgba(200,50,50,0.85);border-radius:8px;text-align:center;color:#fff;font-weight:bold;font-size:15px;line-height:32px;">\u26A1 WIND! Steer against it!</div>';
    }

    // Flash message
    if (flashMsgTimer > 0) {
      var alpha = Math.min(1.0, flashMsgTimer);
      html += '<div style="position:absolute;50%;top:90px;left:50%;transform:translateX(-50%);width:400px;height:34px;background:rgba(0,0,0,' + (alpha * 0.6) + ');border-radius:8px;text-align:center;color:#fff;font-size:15px;line-height:34px;">' + flashMsg + '</div>';
    }

    hudLayer.innerHTML = html;
  }

  // Identity reveal popup (HTML overlay)
  function renderIdentityReveal() {
    if (!currentIdentityFragment || identityRevealTimer <= 0) return;
    identityRevealTimer -= 0.016;

    var frag = currentIdentityFragment;
    var alpha = identityRevealTimer > 1.0 ? 1.0 : identityRevealTimer;

    var hintBadge = frag.hint ?
      '<div style="margin-top:16px;display:inline-block;background:rgba(100,180,100,0.85);color:#fff;padding:4px 16px;border-radius:6px;font-size:11px;font-weight:bold;">\u270E Wisdom Hint</div>' : '';

    var revealHtml =
      '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,' + (alpha * 0.55) + ');display:flex;align-items:center;justify-content:center;z-index:100;">' +
        '<div style="background:rgba(12,18,30,0.95);border:2px solid rgba(200,170,100,' + (alpha * 0.6) + ');border-radius:12px;padding:30px 36px;max-width:600px;width:90%;color:#d4dce8;">' +
          '<h2 style="color:#e8c86a;margin-top:0;text-align:center;font-size:20px;">\u2728 ' + frag.title + ' \u2728</h2>' +
          '<hr style="border-color:rgba(200,170,100,0.3);margin:12px 0;" />' +
          '<p style="font-size:14.5px;line-height:1.6;font-family:Georgia,serif;">' + frag.text + '</p>' +
          hintBadge +
          '<p style="text-align:center;margin-top:16px;color:rgba(180,150,255,0.7);font-size:12px;">Identity Fragments: ' + boat.identityFragments.length + ' / ' + IDENTITY_STORIES.length + '</p>' +
        '</div>' +
      '</div>';

    // Append to HUD layer (it's on top of everything)
    var existingReveal = document.getElementById("identity-reveal");
    if (existingReveal) existingReveal.remove();
    var div = document.createElement("div");
    div.id = "identity-reveal";
    div.innerHTML = revealHtml;
    hudLayer.appendChild(div);
  }

  // ---- RESIZE HANDLER ----
  function onResize() {
    var w = container.clientWidth;
    var h = Math.min(w * (720 / 1280), window.innerHeight - 80);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  // ---- MAIN LOOP ----
  var lastTime = performance.now();

  function loop(now) {
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (state === "playing") {
      try {
        readInput(dt);
        updateBoat(dt);
        updateSharks(dt);
        updatePirates(dt);
        updateWind(dt);
        updatePickups(dt);

        env.timeLeft -= dt;
        if (env.timeLeft <= 0) { env.timeLeft = 0; loseGame("Time ran out on the open sea."); }

        updateCamera();
        updateWinCondition();
        updateWindParticles(dt);
      } catch (err) {
        console.error("[GAME-3D] Loop error:", err);
      }
    }

    // Always animate scene
    animateOcean(now);
    animateClouds(dt);

    // Render 3D scene
    renderer.render(scene, camera);

    // Render HTML HUD on top
    renderHUD();
    renderIdentityReveal();

    // Update flash timer
    if (flashMsgTimer > 0) flashMsgTimer -= dt;

    requestAnimationFrame(loop);
  }

  // ---- BOOT ----
  onResize();
  showMenu();
  requestAnimationFrame(loop);

  console.log("[GAME-3D] Hidden Tides 3D Edition loaded. Three.js r128 ready.");

})();
