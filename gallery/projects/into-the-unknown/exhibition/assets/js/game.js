/* ============================================================
 * Into the Unknown — Cave Exploration Game
 * ------------------------------------------------------------
 * Domain: Cave Exploration
 * Core Learning Shift: From exploring by instinct → making
 *   careful decisions and resource management.
 *
 * Data Model Separation (per brief):
 *   - Environment Data: cave layout, hazards, items, clues
 *   - Player-Controlled Data: position, movement, flashlight
 *   - System-Calculated Results: health, battery, time, danger
 * ============================================================ */

(function () {
  'use strict';

  /* ========================================================
  * SECTION 1 — Tile Types & Cave Layout Data
   * ======================================================== */

  // Each tile type in the cave grid
  var T = {
    WALL: 0, FLOOR: 1, START: 2, EXIT: 3, RESCUE: 4,
    BATTERY: 5, MEDKIT: 6, FOOTPRINTS: 7, LEVER: 8,
    DOOR: 9, TRAP: 10, WATER: 11, BATS: 12, UNSTABLE: 13
  };

  // Convert map characters to tile types
  var CHAR_TO_TILE = {
    '#': T.WALL,    '.': T.FLOOR,   'S': T.START,    'X': T.EXIT,
    'R': T.RESCUE,  'B': T.BATTERY, 'M': T.MEDKIT,   'F': T.FOOTPRINTS,
    'L': T.LEVER,   'D': T.DOOR,    'T': T.TRAP,     'W': T.WATER,
    'A': T.BATS,    'U': T.UNSTABLE
  };

  /* ---- Level Cave Layouts ----
   * Each level is designed with:
   *  - A clear start (S) and exit (X)
   *  - Footprints (F) on the safer / correct path
   *  - Hazards on dangerous paths: Bats (A), Water (W),
   *    Traps (T), Unstable ceiling (U)
   *  - Pickups: Batteries (B), Medkits (M)
   *  - Level 2+ has the missing explorer (R) to rescue
   *  - Levers (L) open doors (D)
   */

  var LEVELS = [
    {
      // --- Level 1: The Entrance ---
      // Teach: movement, flashlight, battery, footprints, bats
      name: 'The Entrance',
      hint: 'Follow the footprints. Watch your battery. Avoid the bats.',
      timeLimit: 120,
      startBattery: 80,
      startHealth: 100,
      map: [
        '#########################',
        '#S..............####....#',
        '#...............##......#',
        '#.................#.....#',
        '#.....#####.......#.....#',
        '#.....#...#.............#',
        '#.....#...#.............#',
        '#.....#####.............#',
        '#.......................#',
        '#...........#####.......#',
        '#...........#...#.......#',
        '#...........#...#.......#',
        '#...........#####.......#',
        '#.......................#',
        '#......A................#',
        '#.......................#',
        '#...............F.......#',
        '#.......................#',
        '#.................X.....#',
        '#########################'
      ]
    },
    {
      // --- Level 2: The Depths ---
      // Teach: water, traps, medkits, rescue the explorer
      name: 'The Depths',
      hint: 'Find the missing explorer. Water and traps are deadly.',
      timeLimit: 150,
      startBattery: 70,
      startHealth: 100,
      map: [
        '#########################',
        '#S...........####.......#',
        '#............##.........#',
        '#.......................#',
        '#....#####..............#',
        '#....#...#.......B......#',
        '#....#...#..............#',
        '#....#####..............#',
        '#.......................#',
        '#..........######.......#',
        '#..........#....#.......#',
        '#..........#....#.......#',
        '#..........##M###.......#',
        '#.......................#',
        '#..W....................#',
        '#.......................#',
        '#.......F...............#',
        '#.......................#',
        '#..............R........#',
        '#.......................#',
        '#..................F.X..#',
        '#.......................#',
        '#########################'
      ]
    },
    {
      // --- Level 3: The Escape ---
      // Teach: unstable ceiling, collapse, all hazards, time pressure
      name: 'The Escape',
      hint: 'Escape with the explorer! The cave is collapsing!',
      timeLimit: 130,
      startBattery: 60,
      startHealth: 100,
      map: [
        '#########################',
        '#S...........####.......#',
        '#............##.........#',
        '#.......................#',
        '#....#####..............#',
        '#....#...#.......B......#',
        '#....#...#..............#',
        '#....#####..............#',
        '#.......................#',
        '#.......######..........#',
        '#.......#....#..........#',
        '#.......#....#..........#',
        '#.......######..........#',
        '#.......................#',
        '#..W....................#',
        '#.......................#',
        '#.......F...............#',
        '#.......................#',
        '#..............M........#',
        '#.......................#',
        '#...........U...........#',
        '#.......................#',
        '#..............R...X....#',
        '#.......................#',
        '#########################'
      ]
    }
  ];

  /* ========================================================
   * SECTION 2 — Game State
   * ======================================================== */

  // All game state lives here. Separated into:
  //   env    = Environment Data (the cave itself)
  //   player = Player-Controlled Data
  //   calc   = System-Calculated Results
  var game = {
    state: 'menu',        // menu | playing | paused | levelComplete | gameOver | victory
    levelIndex: 0,
    canvas: null,
    ctx: null,
    tileSize: 32,
    lastTime: 0,

    // Environment Data — the cave world
    env: {
      grid: [],            // 2D array of tile types
      cols: 0,
      rows: 0,
      doorOpen: false,     // whether the lever-locked door is open
      exitX: 0, exitY: 0,
      rescueX: 0, rescueY: 0,
      rescued: false,      // has the player found the explorer?
      particles: [],       // dust / effect particles
      shake: 0,            // screen shake intensity
      rumbleTimer: 0,      // countdown to next rumble
      collapseWarning: false
    },

    // Player-Controlled Data — what the player directly controls
    player: {
      x: 0, y: 0,          // pixel position
      gridX: 0, gridY: 0,  // grid position
      dir: 'down',         // facing direction: up/down/left/right
      flashlightOn: true,
      moving: false,
      moveSpeed: 3.5,      // pixels per frame
      interactPressed: false
    },

    // System-Calculated Results — derived from player actions + environment
    calc: {
      health: 100,
      battery: 80,
      timeLeft: 120,
      dangerLevel: 0,      // 0 = safe, 1 = caution, 2 = danger
      batteriesFound: 0,
      medkitsFound: 0,
      message: '',
      messageTimer: 0
    },

    // Input state
    keys: {},

    // Audio
    audio: null
  };

  var caveBackground = new Image();
  caveBackground.src = 'assets/images.jpeg';

  /* ========================================================
   * SECTION 3 — Audio System (Web Audio API)
   * ======================================================== */

  var AudioSys = {
    ctx: null,
    enabled: false,

    init: function () {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
      } catch (e) {
        this.enabled = false;
      }
    },

    // Play a simple beep / tone
    beep: function (freq, duration, type, volume) {
      if (!this.enabled || !this.ctx) return;
      type = type || 'sine';
      volume = volume || 0.15;
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + duration);
    },

    // Sound effects
    pickup: function () { this.beep(880, 0.15, 'sine', 0.2); setTimeout(function(){ AudioSys.beep(1320, 0.1, 'sine', 0.15); }, 80); },
    hurt:   function () { this.beep(150, 0.3, 'sawtooth', 0.25); },
    bat:    function () { this.beep(2000, 0.05, 'square', 0.1); setTimeout(function(){ AudioSys.beep(1800, 0.05, 'square', 0.1); }, 60); },
    splash: function () { this.beep(400, 0.2, 'sine', 0.2); setTimeout(function(){ AudioSys.beep(300, 0.15, 'sine', 0.15); }, 100); },
    rumble: function () { this.beep(60, 0.8, 'sawtooth', 0.3); },
    rescue: function () { this.beep(523, 0.15, 'sine', 0.2); setTimeout(function(){ AudioSys.beep(659, 0.15, 'sine', 0.2); }, 150); setTimeout(function(){ AudioSys.beep(784, 0.3, 'sine', 0.2); }, 300); },
    win:    function () { this.beep(523, 0.15, 'sine', 0.2); setTimeout(function(){ AudioSys.beep(659, 0.15, 'sine', 0.2); }, 150); setTimeout(function(){ AudioSys.beep(784, 0.15, 'sine', 0.2); }, 300); setTimeout(function(){ AudioSys.beep(1047, 0.4, 'sine', 0.25); }, 450); },
    lose:   function () { this.beep(300, 0.3, 'sawtooth', 0.2); setTimeout(function(){ AudioSys.beep(200, 0.3, 'sawtooth', 0.2); }, 200); setTimeout(function(){ AudioSys.beep(100, 0.6, 'sawtooth', 0.2); }, 400); },
    flicker:function () { this.beep(1200, 0.03, 'square', 0.05); },
    footstep:function () { this.beep(80, 0.05, 'sine', 0.08); }
  };

  /* ========================================================
   * SECTION 4 — Map Loading
   * ======================================================== */

  function loadLevel(index) {
    var lvl = LEVELS[index];
    var rows = lvl.map.length;
    var cols = lvl.map[0].length;

    game.env.grid = [];
    game.env.cols = cols;
    game.env.rows = rows;
    game.env.doorOpen = false;
    game.env.particles = [];
    game.env.shake = 0;
    game.env.rumbleTimer = 15; // seconds until first rumble (level 3)
    game.env.collapseWarning = false;
    game.env.rescued = false;

    for (var y = 0; y < rows; y++) {
      var row = [];
      for (var x = 0; x < cols; x++) {
        var ch = lvl.map[y][x];
        var tile = CHAR_TO_TILE[ch] !== undefined ? CHAR_TO_TILE[ch] : T.FLOOR;

        // Add alternating rock shelves so the cave has narrow, readable routes.
        if (tile === T.FLOOR && y > 1 && y < rows - 1 && y % 2 === 0 && x > 1 && x < cols - 2) {
          var passageX = (y / 2) % 2 === 0 ? 2 : cols - 3;
          if (x !== passageX) tile = T.WALL;
        }

        // Track special positions
        if (tile === T.START) {
          game.player.gridX = x;
          game.player.gridY = y;
          game.player.x = x * game.tileSize;
          game.player.y = y * game.tileSize;
          tile = T.FLOOR; // start tile becomes floor
        }
        if (tile === T.EXIT) {
          game.env.exitX = x;
          game.env.exitY = y;
        }
        if (tile === T.RESCUE) {
          game.env.rescueX = x;
          game.env.rescueY = y;
        }

        row.push(tile);
      }
      game.env.grid.push(row);
    }

    // Set calculated values
    game.calc.health = lvl.startHealth;
    game.calc.battery = lvl.startBattery;
    game.calc.timeLeft = lvl.timeLimit;
    game.calc.batteriesFound = 0;
    game.calc.medkitsFound = 0;
    game.calc.dangerLevel = 0;
    game.calc.message = lvl.hint;
    game.calc.messageTimer = 5;

    game.player.dir = 'down';
    game.player.flashlightOn = true;
    game.player.moving = false;

    game.state = 'playing';
  }

  /* ========================================================
   * SECTION 5 — Collision & Tile Interaction
   * ======================================================== */

  function isWalkable(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= game.env.cols || gy >= game.env.rows) return false;
    var tile = game.env.grid[gy][gx];
    if (tile === T.WALL) return false;
    if (tile === T.DOOR && !game.env.doorOpen) return false;
    return true;
  }

  // Handle what happens when the player steps onto a tile
  function onTileEnter(gx, gy) {
    var tile = game.env.grid[gy][gx];

    switch (tile) {
      case T.BATTERY:
        game.calc.battery = Math.min(100, game.calc.battery + 35);
        game.calc.batteriesFound++;
        game.env.grid[gy][gx] = T.FLOOR;
        showMessage('Battery found! +35% power', 2);
        AudioSys.pickup();
        break;

      case T.MEDKIT:
        game.calc.health = Math.min(100, game.calc.health + 40);
        game.calc.medkitsFound++;
        game.env.grid[gy][gx] = T.FLOOR;
        showMessage('Medkit found! +40 health', 2);
        AudioSys.pickup();
        break;

      case T.FOOTPRINTS:
        showMessage('Footprints... someone passed through here.', 3);
        // Footprints stay as a visual clue; do not remove
        break;

      case T.LEVER:
        game.env.doorOpen = true;
        game.env.grid[gy][gx] = T.FLOOR;
        showMessage('You pulled the lever. A door opened somewhere!', 3);
        AudioSys.beep(440, 0.2, 'square', 0.2);
        break;

      case T.RESCUE:
        game.env.rescued = true;
        game.env.grid[gy][gx] = T.FLOOR;
        showMessage('You found the missing explorer! Now escape!', 4);
        AudioSys.rescue();
        break;

      case T.BATS:
        game.calc.health -= 15;
        showMessage('Bats attack! -15 health', 2);
        AudioSys.bat();
        // Bats fly away after one encounter
        game.env.grid[gy][gx] = T.FLOOR;
        if (game.calc.health <= 0) endGame(false, 'Killed by bat swarm');
        break;

      case T.WATER:
        game.calc.health -= 25;
        showMessage('You fell into underground water! -25 health', 2);
        AudioSys.splash();
        game.env.grid[gy][gx] = T.FLOOR;
        if (game.calc.health <= 0) endGame(false, 'Drowned in underground water');
        break;

      case T.TRAP:
        game.calc.health -= 30;
        showMessage('Hidden trap! -30 health', 2);
        AudioSys.hurt();
        game.env.grid[gy][gx] = T.FLOOR;
        if (game.calc.health <= 0) endGame(false, 'Killed by a hidden trap');
        break;

      case T.UNSTABLE:
        // Trigger collapse warning — screen shakes, dust falls
        game.env.shake = 20;
        game.env.collapseWarning = true;
        spawnDust(gx, gy, 15);
        AudioSys.rumble();
        showMessage('The ceiling is unstable! Move quickly!', 3);
        game.env.grid[gy][gx] = T.FLOOR; // becomes floor after triggered
        break;

      case T.EXIT:
        if (game.env.rescued || game.levelIndex === 0) {
          // Level 1: just reach exit. Levels 2-3: must rescue first.
          levelComplete();
        } else {
          showMessage('You must find the missing explorer first!', 3);
        }
        break;
    }
  }

  /* ========================================================
   * SECTION 6 — Particles & Effects
   * ======================================================== */

  function spawnDust(gx, gy, count) {
    var cx = gx * game.tileSize + game.tileSize / 2;
    var cy = gy * game.tileSize + game.tileSize / 2;
    for (var i = 0; i < count; i++) {
      game.env.particles.push({
        x: cx + (Math.random() - 0.5) * game.tileSize * 2,
        y: cy + (Math.random() - 0.5) * game.tileSize,
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * 1.5 + 0.5,
        life: 1.0,
        size: Math.random() * 3 + 1
      });
    }
  }

  function updateParticles(dt) {
    for (var i = game.env.particles.length - 1; i >= 0; i--) {
      var p = game.env.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt * 0.8;
      if (p.life <= 0) game.env.particles.splice(i, 1);
    }
  }

  /* ========================================================
   * SECTION 7 — Input Handling
   * ======================================================== */

  function setupInput() {
    window.addEventListener('keydown', function (e) {
      game.keys[e.key.toLowerCase()] = true;

      // Prevent scrolling with arrow keys
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].indexOf(e.key.toLowerCase()) > -1) {
        e.preventDefault();
      }

      // Toggle flashlight with F
      if (e.key.toLowerCase() === 'f' && game.state === 'playing') {
        game.player.flashlightOn = !game.player.flashlightOn;
        showMessage(game.player.flashlightOn ? 'Flashlight ON' : 'Flashlight OFF', 1);
      }

      // Pause with P or Escape
      if ((e.key.toLowerCase() === 'p' || e.key === 'Escape') && game.state === 'playing') {
        game.state = 'paused';
      } else if ((e.key.toLowerCase() === 'p' || e.key === 'Escape') && game.state === 'paused') {
        game.state = 'playing';
      }
    });

    window.addEventListener('keyup', function (e) {
      game.keys[e.key.toLowerCase()] = false;
    });
  }

  /* ========================================================
   * SECTION 8 — Player Movement
   * ======================================================== */

  function updatePlayer(dt) {
    if (game.state !== 'playing') return;

    var p = game.player;
    var ts = game.tileSize;
    var speed = p.moveSpeed;

    // Determine direction from input
    var dx = 0, dy = 0;
    if (game.keys['arrowup'] || game.keys['w']) { dy = -1; p.dir = 'up'; }
    else if (game.keys['arrowdown'] || game.keys['s']) { dy = 1; p.dir = 'down'; }
    else if (game.keys['arrowleft'] || game.keys['a']) { dx = -1; p.dir = 'left'; }
    else if (game.keys['arrowright'] || game.keys['d']) { dx = 1; p.dir = 'right'; }

    p.moving = (dx !== 0 || dy !== 0);

    if (p.moving) {
      // Move in pixel space
      var newX = p.x + dx * speed;
      var newY = p.y + dy * speed;

      // Check collision at new position (use bounding box center)
      var checkX = Math.floor((newX + ts / 2 + dx * (ts/2 - 2)) / ts);
      var checkY = Math.floor((newY + ts / 2 + dy * (ts/2 - 2)) / ts);

      if (isWalkable(checkX, checkY)) {
        p.x = newX;
        p.y = newY;
      } else {
        // Try sliding along one axis
        var altCheckX = Math.floor((p.x + ts / 2 + dx * (ts/2 - 2)) / ts);
        var altCheckY = Math.floor((newY + ts / 2) / ts);
        if (dx !== 0 && isWalkable(altCheckX, altCheckY)) {
          p.y = newY;
        } else {
          var altCheckX2 = Math.floor((newX + ts / 2) / ts);
          var altCheckY2 = Math.floor((p.y + ts / 2 + dy * (ts/2 - 2)) / ts);
          if (dy !== 0 && isWalkable(altCheckX2, altCheckY2)) {
            p.x = newX;
          }
        }
      }

      // Check if we entered a new tile
      var newGridX = Math.floor((p.x + ts / 2) / ts);
      var newGridY = Math.floor((p.y + ts / 2) / ts);
      if (newGridX !== p.gridX || newGridY !== p.gridY) {
        p.gridX = newGridX;
        p.gridY = newGridY;
        onTileEnter(newGridX, newGridY);
        // Footstep sound
        if (Math.random() < 0.3) AudioSys.footstep();
      }
    }
  }

  /* ========================================================
   * SECTION 9 — System Calculations (battery, health, time)
   * ======================================================== */

  function updateCalculations(dt) {
    if (game.state !== 'playing') return;

    var c = game.calc;

    // Time countdown
    c.timeLeft -= dt;
    if (c.timeLeft <= 0) {
      c.timeLeft = 0;
      endGame(false, 'You ran out of time!');
      return;
    }

    // Battery drain — faster when flashlight is on and moving
    var drainRate = 0;
    if (game.player.flashlightOn) {
      drainRate = game.player.moving ? 1.8 : 0.8;
    }
    c.battery -= drainRate * dt;

    // Flashlight flicker when low
    if (c.battery < 25 && c.battery > 0 && game.player.flashlightOn) {
      if (Math.random() < 0.1) AudioSys.flicker();
    }

    if (c.battery <= 0) {
      c.battery = 0;
      game.player.flashlightOn = false;
      // If in total darkness too long, health drops (dangerous to navigate blind)
      c.health -= 2 * dt;
      if (c.health <= 0) {
        endGame(false, 'Lost in the darkness without light');
        return;
      }
    }

    // Danger level based on conditions
    if (c.health < 30 || c.battery < 20 || c.timeLeft < 20) {
      c.dangerLevel = 2;
    } else if (c.health < 60 || c.battery < 40 || c.timeLeft < 40) {
      c.dangerLevel = 1;
    } else {
      c.dangerLevel = 0;
    }

    // Rumble / collapse events (mainly level 3)
    if (game.levelIndex === 2) {
      game.env.rumbleTimer -= dt;
      if (game.env.rumbleTimer <= 0) {
        game.env.shake = 15;
        AudioSys.rumble();
        showMessage('RUMBLE! The cave is unstable — keep moving!', 3);
        // Spawn dust from ceiling
        var px = game.player.gridX;
        var py = game.player.gridY;
        spawnDust(px, py, 10);
        game.env.rumbleTimer = 12 + Math.random() * 8;
      }
    }

    // Update screen shake
    if (game.env.shake > 0) game.env.shake -= dt * 30;
    if (game.env.shake < 0) game.env.shake = 0;

    // Update message timer
    if (c.messageTimer > 0) c.messageTimer -= dt;

    // Update particles
    updateParticles(dt);
  }

  function showMessage(msg, duration) {
    game.calc.message = msg;
    game.calc.messageTimer = duration || 3;
  }

  /* ========================================================
   * SECTION 10 — Game State Transitions
   * ======================================================== */

  function levelComplete() {
    if (game.levelIndex < LEVELS.length - 1) {
      game.state = 'levelComplete';
      AudioSys.win();
    } else {
      game.state = 'victory';
      AudioSys.win();
    }
  }

  function endGame(won, reason) {
    if (won) {
      game.state = 'victory';
      AudioSys.win();
    } else {
      game.state = 'gameOver';
      game.calc.message = reason || 'You failed';
      AudioSys.lose();
    }
  }

  function nextLevel() {
    game.levelIndex++;
    if (game.levelIndex >= LEVELS.length) {
      game.state = 'victory';
      return;
    }
    loadLevel(game.levelIndex);
  }

  function restartGame() {
    game.levelIndex = 0;
    loadLevel(0);
  }

  /* ========================================================
   * SECTION 11 — Rendering
   * ======================================================== */

  function render() {
    var ctx = game.ctx;
    var canvas = game.canvas;
    var ts = game.tileSize;

    // Clear
    ctx.fillStyle = '#0d0a06';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (game.state === 'menu') {
      renderMenu(ctx);
      return;
    }

    // Calculate camera offset to center on player
    var shakeX = 0, shakeY = 0;
    if (game.env.shake > 0) {
      shakeX = (Math.random() - 0.5) * game.env.shake;
      shakeY = (Math.random() - 0.5) * game.env.shake;
    }

    var camX = game.player.x - canvas.width / 2 + ts / 2 + shakeX;
    var camY = game.player.y - canvas.height / 2 + ts / 2 + shakeY;

    // Clamp camera to map bounds
    var mapW = game.env.cols * ts;
    var mapH = game.env.rows * ts;
    camX = Math.max(0, Math.min(camX, mapW - canvas.width));
    camY = Math.max(0, Math.min(camY, mapH - canvas.height));
    if (mapW < canvas.width) camX = (mapW - canvas.width) / 2;
    if (mapH < canvas.height) camY = (mapH - canvas.height) / 2;

    ctx.save();
    ctx.translate(-camX, -camY);

    // Establish the larger cavern before the playable surfaces are painted.
    drawCaveBackdrop(ctx);

    // Draw cave tiles
    drawCave(ctx, camX, camY);

    // Break up the hard edge of the map with organic rock silhouettes.
    drawCaveDetails(ctx);

    // Draw particles (dust)
    drawParticles(ctx);

    // Draw player
    drawPlayer(ctx);

    ctx.restore();

    // Draw darkness / flashlight overlay
    drawLighting(ctx, camX, camY);

    // Draw HUD
    drawHUD(ctx);

    // Draw state overlays
    if (game.state === 'paused') drawPaused(ctx);
    if (game.state === 'levelComplete') drawLevelComplete(ctx);
    if (game.state === 'gameOver') drawGameOver(ctx);
    if (game.state === 'victory') drawVictory(ctx);
  }

  function caveNoise(x, y, salt) {
    var value = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233 + salt * 37.719) * 43758.5453;
    return value - Math.floor(value);
  }

  function drawCaveBackdrop(ctx) {
    var width = game.env.cols * game.tileSize;
    var height = game.env.rows * game.tileSize;
    ctx.fillStyle = '#17120e';
    ctx.fillRect(0, 0, width, height);

    if (caveBackground.complete && caveBackground.naturalWidth > 0) {
      var scale = Math.max(width / caveBackground.naturalWidth, height / caveBackground.naturalHeight);
      var imageWidth = caveBackground.naturalWidth * scale;
      var imageHeight = caveBackground.naturalHeight * scale;
      ctx.drawImage(caveBackground, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
    }

    var atmosphere = ctx.createLinearGradient(0, 0, 0, height);
    atmosphere.addColorStop(0, 'rgba(4, 3, 2, 0.24)');
    atmosphere.addColorStop(0.5, 'rgba(20, 9, 3, 0.08)');
    atmosphere.addColorStop(1, 'rgba(4, 3, 2, 0.22)');
    ctx.fillStyle = atmosphere;
    ctx.fillRect(0, 0, width, height);

    // A broad pool of reflected light keeps the cavern from feeling flat.
    var floorGlow = ctx.createRadialGradient(width * 0.5, height * 0.62, 20, width * 0.5, height * 0.62, width * 0.62);
    floorGlow.addColorStop(0, 'rgba(105, 72, 42, 0.22)');
    floorGlow.addColorStop(0.55, 'rgba(49, 34, 23, 0.12)');
    floorGlow.addColorStop(1, 'rgba(8, 6, 4, 0)');
    ctx.fillStyle = floorGlow;
    ctx.fillRect(0, 0, width, height);
  }

  function drawCaveDetails(ctx) {
    var width = game.env.cols * game.tileSize;
    var height = game.env.rows * game.tileSize;
    var ts = game.tileSize;

    ctx.save();
    ctx.globalAlpha = 0.9;

    // Uneven ceiling shelf.
    ctx.fillStyle = '#080706';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (var x = 0; x <= width; x += ts) {
      var dip = 18 + caveNoise(x / ts, 0, 20) * 34;
      ctx.lineTo(x, dip);
    }
    ctx.lineTo(width, 0);
    ctx.closePath();
    ctx.fill();

    // Stalactites are deliberately irregular so the edge feels geological.
    ctx.fillStyle = '#211810';
    for (var i = 0; i < 11; i++) {
      var sx = 24 + i * (width - 48) / 10;
      var stalactiteWidth = 10 + caveNoise(i, 3, 21) * 18;
      var stalactiteHeight = 12 + caveNoise(i, 4, 22) * 32;
      ctx.beginPath();
      ctx.moveTo(sx - stalactiteWidth / 2, 8);
      ctx.quadraticCurveTo(sx, 14, sx + stalactiteWidth / 2, 8);
      ctx.lineTo(sx + 2, stalactiteHeight);
      ctx.quadraticCurveTo(sx, stalactiteHeight + 8, sx - 2, stalactiteHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Low side shelves frame the play space without hiding it.
    ctx.fillStyle = 'rgba(7, 5, 4, 0.72)';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height - 42);
    ctx.quadraticCurveTo(30, height - 68, 62, height - 36);
    ctx.quadraticCurveTo(98, height - 8, 138, height - 48);
    ctx.lineTo(138, height);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(width, height);
    ctx.lineTo(width, height - 52);
    ctx.quadraticCurveTo(width - 34, height - 22, width - 74, height - 48);
    ctx.quadraticCurveTo(width - 108, height - 72, width - 150, height - 38);
    ctx.lineTo(width - 150, height);
    ctx.closePath();
    ctx.fill();

    // Small mineral glints add depth without becoming UI markers.
    ctx.fillStyle = 'rgba(183, 126, 70, 0.26)';
    for (var j = 0; j < 18; j++) {
      var px = 20 + caveNoise(j, 7, 23) * (width - 40);
      var py = 50 + caveNoise(j, 8, 24) * (height - 110);
      ctx.fillRect(px, py, 2 + caveNoise(j, 9, 25) * 3, 1 + caveNoise(j, 10, 26) * 2);
    }
    ctx.restore();
  }

  function drawCaveFloor(ctx, px, py, ts, x, y) {
    // Floor is supplied by the continuous cavern backdrop.
  }

  function drawCaveWall(ctx, px, py, ts, x, y) {
    // Keep blocked cells readable while letting the cave illustration show through.
    ctx.fillStyle = 'rgba(8, 6, 5, 0.68)';
    ctx.fillRect(px, py, ts, ts);
    ctx.strokeStyle = 'rgba(199, 125, 67, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
    ctx.fillStyle = 'rgba(111, 68, 40, 0.22)';
    ctx.beginPath();
    ctx.moveTo(px + 3, py + ts - 5);
    ctx.quadraticCurveTo(px + ts * 0.4, py + 4, px + ts - 3, py + 7);
    ctx.lineTo(px + ts - 3, py + ts - 3);
    ctx.closePath();
    ctx.fill();
  }

  function drawCave(ctx, camX, camY) {
    var ts = game.tileSize;
    var startX = Math.max(0, Math.floor(camX / ts));
    var startY = Math.max(0, Math.floor(camY / ts));
    var endX = Math.min(game.env.cols, Math.ceil((camX + game.canvas.width) / ts) + 1);
    var endY = Math.min(game.env.rows, Math.ceil((camY + game.canvas.height) / ts) + 1);

    for (var y = startY; y < endY; y++) {
      for (var x = startX; x < endX; x++) {
        var tile = game.env.grid[y][x];
        var px = x * ts;
        var py = y * ts;

        switch (tile) {
          case T.WALL:
            drawCaveWall(ctx, px, py, ts, x, y);
            break;

          case T.FLOOR:
            drawCaveFloor(ctx, px, py, ts, x, y);
            break;

          case T.FOOTPRINTS:
            drawCaveFloor(ctx, px, py, ts, x, y);
            // Draw footprints
            ctx.fillStyle = 'rgba(180, 160, 120, 0.5)';
            ctx.beginPath();
            ctx.ellipse(px + 10, py + 12, 4, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(px + 20, py + 20, 4, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

          case T.EXIT:
            // Exit — glowing opening
            ctx.fillStyle = '#1a1510';
            ctx.fillRect(px, py, ts, ts);
            var exitGlow = 0.5 + 0.3 * Math.sin(Date.now() / 300);
            ctx.fillStyle = 'rgba(80, 200, 120, ' + exitGlow + ')';
            ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
            ctx.fillStyle = 'rgba(120, 255, 160, ' + exitGlow * 0.5 + ')';
            ctx.fillRect(px + 8, py + 8, ts - 16, ts - 16);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('EXIT', px + ts/2, py + ts/2 + 3);
            break;

          case T.RESCUE:
            // Missing explorer — pulsing red beacon
            ctx.fillStyle = '#1a1510';
            ctx.fillRect(px, py, ts, ts);
            var rescuePulse = 0.4 + 0.4 * Math.sin(Date.now() / 200);
            ctx.fillStyle = 'rgba(220, 80, 80, ' + rescuePulse + ')';
            ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SOS', px + ts/2, py + ts/2 + 3);
            break;

          case T.BATTERY:
            // Battery pickup — yellow glow
            ctx.fillStyle = '#1a1510';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = 'rgba(255, 200, 0, 0.4)';
            ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
            ctx.fillStyle = '#ffdd00';
            ctx.fillRect(px + 10, py + 8, 12, 14);
            ctx.fillStyle = '#222';
            ctx.fillRect(px + 13, py + 6, 6, 3);
            // Plus sign
            ctx.fillStyle = '#333';
            ctx.fillRect(px + 14, py + 12, 4, 2);
            ctx.fillRect(px + 15, py + 11, 2, 4);
            break;

          case T.MEDKIT:
            // Medkit — white box with red cross
            ctx.fillStyle = '#1a1510';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(px + 8, py + 8, 16, 16);
            ctx.fillStyle = '#dd2222';
            ctx.fillRect(px + 14, py + 10, 4, 12);
            ctx.fillRect(px + 10, py + 14, 12, 4);
            break;

          case T.LEVER:
            // Lever on the wall
            ctx.fillStyle = '#1a1510';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = '#554433';
            ctx.fillRect(px + 12, py + 6, 8, 20);
            ctx.fillStyle = '#cc9933';
            ctx.beginPath();
            ctx.arc(px + 16, py + 10, 5, 0, Math.PI * 2);
            ctx.fill();
            break;

          case T.DOOR:
            // Locked door
            ctx.fillStyle = '#3a2a1a';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = '#5a4a2a';
            ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
            ctx.fillStyle = '#8a7a4a';
            ctx.fillRect(px + 14, py + 14, 5, 5);
            break;

          case T.TRAP:
            drawCaveFloor(ctx, px, py, ts, x, y);
            // Very subtle dark cracks (hard to see — that's the point)
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + 8, py + 6);
            ctx.lineTo(px + 14, py + 16);
            ctx.lineTo(px + 12, py + 24);
            ctx.moveTo(px + 20, py + 8);
            ctx.lineTo(px + 18, py + 20);
            ctx.stroke();
            break;

          case T.WATER:
            // Underground water — blue with shimmer
            ctx.fillStyle = '#0a1a2a';
            ctx.fillRect(px, py, ts, ts);
            var waterShimmer = 0.3 + 0.2 * Math.sin(Date.now() / 400 + x);
            ctx.fillStyle = 'rgba(40, 100, 180, ' + waterShimmer + ')';
            ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
            ctx.fillStyle = 'rgba(80, 160, 220, 0.3)';
            ctx.fillRect(px + 6, py + 10, 8, 2);
            ctx.fillRect(px + 16, py + 18, 6, 2);
            break;

          case T.BATS:
            // Bat colony — dark with fluttering shapes
            ctx.fillStyle = '#1a1510';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = '#0a0805';
            ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
            // Draw small bat shapes
            ctx.fillStyle = '#1a0a0a';
            var batOffset = Math.sin(Date.now() / 100) * 2;
            for (var b = 0; b < 3; b++) {
              var bx = px + 8 + b * 8;
              var by = py + 10 + batOffset;
              ctx.beginPath();
              ctx.moveTo(bx, by);
              ctx.lineTo(bx - 3, by - 2);
              ctx.lineTo(bx, by + 1);
              ctx.lineTo(bx + 3, by - 2);
              ctx.closePath();
              ctx.fill();
            }
            break;

          case T.UNSTABLE:
            // Unstable ceiling — cracks and loose rocks
            ctx.fillStyle = '#1a1510';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = '#2a1810';
            ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
            // Warning cracks
            ctx.strokeStyle = 'rgba(200, 100, 50, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + 4, py + 6);
            ctx.lineTo(px + 12, py + 14);
            ctx.lineTo(px + 8, py + 24);
            ctx.moveTo(px + 20, py + 4);
            ctx.lineTo(px + 16, py + 16);
            ctx.lineTo(px + 24, py + 26);
            ctx.stroke();
            break;
        }
      }
    }
  }

  function drawPlayer(ctx) {
    var ts = game.tileSize;
    var p = game.player;
    var px = p.x;
    var py = p.y;

    // Player body — explorer figure
    ctx.fillStyle = '#4a3520';
    ctx.fillRect(px + 8, py + 10, 16, 16);

    // Head with helmet
    ctx.fillStyle = '#d4a017'; // helmet (yellow/gold)
    ctx.fillRect(px + 10, py + 4, 12, 8);
    ctx.fillStyle = '#f4c020';
    ctx.fillRect(px + 11, py + 5, 10, 4);

    // Helmet light
    if (p.flashlightOn && game.calc.battery > 0) {
      ctx.fillStyle = '#ffff80';
      ctx.fillRect(px + 14, py + 6, 4, 2);
    }

    // Body detail
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(px + 10, py + 14, 12, 10);

    // Direction indicator (small arrow on body)
    ctx.fillStyle = 'rgba(255, 255, 100, 0.6)';
    var cx = px + ts/2;
    var cy = py + ts/2;
    if (p.dir === 'up') ctx.fillRect(cx - 1, py + 2, 2, 4);
    else if (p.dir === 'down') ctx.fillRect(cx - 1, py + ts - 6, 2, 4);
    else if (p.dir === 'left') ctx.fillRect(px + 2, cy - 1, 4, 2);
    else if (p.dir === 'right') ctx.fillRect(px + ts - 6, cy - 1, 4, 2);

    // Health-based tint (red overlay when low health)
    if (game.calc.health < 30) {
      ctx.fillStyle = 'rgba(200, 0, 0, ' + (0.2 + 0.1 * Math.sin(Date.now()/200)) + ')';
      ctx.fillRect(px, py, ts, ts);
    }
  }

  function drawParticles(ctx) {
    for (var i = 0; i < game.env.particles.length; i++) {
      var p = game.env.particles[i];
      ctx.fillStyle = 'rgba(150, 130, 100, ' + p.life + ')';
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }
  }

  function drawLighting(ctx, camX, camY) {
    var canvas = game.canvas;
    var ts = game.tileSize;

    // Player screen position
    var psx = game.player.x - camX + ts / 2;
    var psy = game.player.y - camY + ts / 2;

    if (game.player.flashlightOn && game.calc.battery > 0) {
      // Flashlight cone — create darkness with a cutout
      ctx.save();

      // Draw darkness overlay — lighter for better visibility
      ctx.globalCompositeOperation = 'source-over';
      var darkness = 0.54;
      if (game.calc.battery < 25) {
        // Subtle flicker effect when battery is low
        darkness = 0.54 + 0.03 * Math.random();
      }

      ctx.fillStyle = 'rgba(0, 0, 0, ' + darkness + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cut out the flashlight cone
      ctx.globalCompositeOperation = 'destination-out';

      // Ambient light circle around player (larger)
      var ambientGrad = ctx.createRadialGradient(psx, psy, 0, psx, psy, ts * 3);
      ambientGrad.addColorStop(0, 'rgba(255, 255, 200, 1)');
      ambientGrad.addColorStop(0.4, 'rgba(255, 255, 180, 0.7)');
      ambientGrad.addColorStop(0.7, 'rgba(255, 255, 150, 0.3)');
      ambientGrad.addColorStop(1, 'rgba(255, 255, 150, 0)');
      ctx.fillStyle = ambientGrad;
      ctx.beginPath();
      ctx.arc(psx, psy, ts * 3, 0, Math.PI * 2);
      ctx.fill();

      // Flashlight cone in facing direction (longer, wider)
      var coneLength = ts * 8;
      var coneAngle = Math.PI / 2.5; // wider cone (~72 degrees)

      var angle = 0;
      if (game.player.dir === 'up') angle = -Math.PI / 2;
      else if (game.player.dir === 'down') angle = Math.PI / 2;
      else if (game.player.dir === 'left') angle = Math.PI;
      else if (game.player.dir === 'right') angle = 0;

      // Draw the cone as a triangle with gradient
      var coneGrad = ctx.createRadialGradient(psx, psy, 0, psx, psy, coneLength);
      coneGrad.addColorStop(0, 'rgba(255, 255, 220, 1)');
      coneGrad.addColorStop(0.3, 'rgba(255, 255, 200, 0.8)');
      coneGrad.addColorStop(0.7, 'rgba(255, 255, 180, 0.3)');
      coneGrad.addColorStop(1, 'rgba(255, 255, 150, 0)');

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(psx, psy);
      ctx.arc(psx, psy, coneLength, angle - coneAngle/2, angle + coneAngle/2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Add warm light tint over the cone area
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      var warmGrad = ctx.createRadialGradient(psx, psy, 0, psx, psy, coneLength);
      warmGrad.addColorStop(0, 'rgba(255, 240, 180, 0.24)');
      warmGrad.addColorStop(1, 'rgba(255, 240, 180, 0)');
      ctx.fillStyle = warmGrad;
      ctx.beginPath();
      ctx.moveTo(psx, psy);
      ctx.arc(psx, psy, coneLength, angle - coneAngle/2, angle + coneAngle/2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

    } else {
      // No flashlight — almost total darkness
      ctx.fillStyle = 'rgba(0, 0, 0, 0.97)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Tiny ambient circle
      var tinyGrad = ctx.createRadialGradient(psx, psy, 0, psx, psy, ts * 0.8);
      tinyGrad.addColorStop(0, 'rgba(40, 40, 30, 1)');
      tinyGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = tinyGrad;
      ctx.beginPath();
      ctx.arc(psx, psy, ts * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Danger vignette — red overlay when in danger
    if (game.calc.dangerLevel >= 2) {
      var dangerAlpha = 0.15 + 0.05 * Math.sin(Date.now() / 200);
      var vGrad = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, canvas.width * 0.3,
        canvas.width/2, canvas.height/2, canvas.width * 0.7
      );
      vGrad.addColorStop(0, 'rgba(200, 0, 0, 0)');
      vGrad.addColorStop(1, 'rgba(200, 0, 0, ' + dangerAlpha + ')');
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  /* ========================================================
   * SECTION 12 — HUD Rendering
   * ======================================================== */

  function drawHUD(ctx) {
    var canvas = game.canvas;
    var c = game.calc;

    // Top bar background
    ctx.fillStyle = 'rgba(10, 8, 5, 0.85)';
    ctx.fillRect(0, 0, canvas.width, 56);

    ctx.strokeStyle = '#3a2e1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 56);
    ctx.lineTo(canvas.width, 56);
    ctx.stroke();

    // --- Health bar ---
    drawBar(ctx, 16, 12, 180, 18, c.health, 100, '#dd3333', '#3a1010', 'HEALTH');

    // --- Battery bar ---
    var batColor = c.battery < 25 ? '#ff6600' : (c.battery < 50 ? '#ffaa00' : '#22dd44');
    drawBar(ctx, 220, 12, 180, 18, c.battery, 100, batColor, '#2a2010', 'BATTERY');

    // --- Timer ---
    var timeColor = c.timeLeft < 20 ? '#ff3333' : (c.timeLeft < 40 ? '#ffaa00' : '#44ddff');
    ctx.fillStyle = '#8a7a5a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TIME', 424, 12);
    ctx.fillStyle = timeColor;
    ctx.font = 'bold 22px monospace';
    var mins = Math.floor(c.timeLeft / 60);
    var secs = Math.floor(c.timeLeft % 60);
    ctx.fillText(mins + ':' + (secs < 10 ? '0' : '') + secs, 424, 34);

    // --- Level info ---
    var lvl = LEVELS[game.levelIndex];
    ctx.fillStyle = '#8a7a5a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('LEVEL ' + (game.levelIndex + 1) + ' / ' + LEVELS.length, canvas.width - 16, 12);
    ctx.fillStyle = '#ccbb88';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(lvl.name, canvas.width - 16, 32);

    // --- Rescue status ---
    if (game.levelIndex > 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = game.env.rescued ? '#44dd44' : '#888';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(game.env.rescued ? 'EXPLORER RESCUED' : 'EXPLORER MISSING', canvas.width - 16, 48);
    }

    // --- Message box ---
    if (c.messageTimer > 0 && c.message) {
      var msgAlpha = Math.min(1, c.messageTimer);
      ctx.fillStyle = 'rgba(10, 8, 5, ' + (0.85 * msgAlpha) + ')';
      var msgWidth = ctx.measureText(c.message).width;
      ctx.font = 'bold 16px monospace';
      msgWidth = ctx.measureText(c.message).width;
      var boxX = canvas.width / 2 - msgWidth / 2 - 16;
      var boxY = canvas.height - 60;
      ctx.fillRect(boxX, boxY, msgWidth + 32, 36);
      ctx.strokeStyle = 'rgba(200, 180, 120, ' + msgAlpha + ')';
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY, msgWidth + 32, 36);

      ctx.fillStyle = 'rgba(255, 240, 200, ' + msgAlpha + ')';
      ctx.textAlign = 'center';
      ctx.fillText(c.message, canvas.width / 2, boxY + 23);
    }

    // --- Controls hint (bottom left) ---
    ctx.fillStyle = 'rgba(100, 90, 70, 0.6)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('WASD/Arrows: Move  |  F: Flashlight  |  P: Pause', 16, canvas.height - 12);
  }

  function drawBar(ctx, x, y, w, h, value, max, color, bgColor, label) {
    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);

    // Fill
    var fillW = (value / max) * (w - 4);
    if (fillW < 0) fillW = 0;
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, fillW, h - 4);

    // Border
    ctx.strokeStyle = '#5a4a2a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Label
    ctx.fillStyle = '#ccbb88';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 4, y - 2);

    // Value
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.ceil(value) + '%', x + w - 4, y + 13);
  }

  /* ========================================================
   * SECTION 13 — Screen Overlays
   * ======================================================== */

  function renderMenu(ctx) {
    var canvas = game.canvas;

    // Dark cave background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cc9933';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.fillText('Into the Unknown', canvas.width / 2, 140);

    ctx.fillStyle = '#8a7a5a';
    ctx.font = '16px monospace';
    ctx.fillText('A Cave Exploration Game', canvas.width / 2, 170);

    // Subtitle / story
    ctx.fillStyle = '#aa9977';
    ctx.font = '14px monospace';
    var lines = [
      'A fellow explorer has gone missing deep inside the cave.',
      'Navigate the tunnels, manage your flashlight and supplies,',
      'and bring them home safely.',
      '',
      'Learn to observe clues, judge risks, and make careful decisions —',
      'the difference between instinct and expertise.'
    ];
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], canvas.width / 2, 220 + i * 22);
    }

    // Instructions
    ctx.fillStyle = '#778866';
    ctx.font = '12px monospace';
    ctx.fillText('WASD or Arrow Keys to move  |  F to toggle flashlight  |  P to pause', canvas.width / 2, 400);

    // Start button
    var btnX = canvas.width / 2 - 100;
    var btnY = 430;
    var btnW = 200;
    var btnH = 50;
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#cc9933';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#cc9933';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('START EXPLORING', canvas.width / 2, btnY + 32);

    // Credit
    ctx.fillStyle = '#554433';
    ctx.font = '11px monospace';
    ctx.fillText('Project by Hawinate  |  Domain: Cave Exploration  |  AI Agent: WorkBuddy', canvas.width / 2, 510);
  }

  function drawPaused(ctx) {
    var canvas = game.canvas;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#cc9933';
    ctx.font = 'bold 40px monospace';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = '#8a7a5a';
    ctx.font = '16px monospace';
    ctx.fillText('Press P or ESC to resume', canvas.width / 2, canvas.height / 2 + 20);
  }

  function drawLevelComplete(ctx) {
    var canvas = game.canvas;
    ctx.fillStyle = 'rgba(0, 20, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#44dd44';
    ctx.font = 'bold 40px monospace';
    ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2 - 60);

    ctx.fillStyle = '#ccbb88';
    ctx.font = '16px monospace';
    ctx.fillText('Level ' + (game.levelIndex + 1) + ': ' + LEVELS[game.levelIndex].name, canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = '#8a9a7a';
    ctx.font = '14px monospace';
    ctx.fillText('Batteries found: ' + game.calc.batteriesFound + '  |  Medkits found: ' + game.calc.medkitsFound, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText('Health remaining: ' + Math.ceil(game.calc.health) + '%  |  Time remaining: ' + Math.ceil(game.calc.timeLeft) + 's', canvas.width / 2, canvas.height / 2 + 34);

    // Next button
    var btnX = canvas.width / 2 - 100;
    var btnY = canvas.height / 2 + 70;
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(btnX, btnY, 200, 44);
    ctx.strokeStyle = '#44dd44';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, 200, 44);
    ctx.fillStyle = '#44dd44';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('NEXT LEVEL →', canvas.width / 2, btnY + 29);
  }

  function drawGameOver(ctx) {
    var canvas = game.canvas;
    ctx.fillStyle = 'rgba(30, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#dd3333';
    ctx.font = 'bold 44px monospace';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);

    ctx.fillStyle = '#aa8866';
    ctx.font = '16px monospace';
    ctx.fillText(game.calc.message, canvas.width / 2, canvas.height / 2);

    ctx.fillStyle = '#776655';
    ctx.font = '13px monospace';
    ctx.fillText('Tip: Observe footprints, conserve battery, and avoid hazards.', canvas.width / 2, canvas.height / 2 + 30);

    // Restart button
    var btnX = canvas.width / 2 - 100;
    var btnY = canvas.height / 2 + 60;
    ctx.fillStyle = '#2a1a1a';
    ctx.fillRect(btnX, btnY, 200, 44);
    ctx.strokeStyle = '#dd3333';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, 200, 44);
    ctx.fillStyle = '#dd3333';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('↻ TRY AGAIN', canvas.width / 2, btnY + 29);
  }

  function drawVictory(ctx) {
    var canvas = game.canvas;
    ctx.fillStyle = 'rgba(0, 10, 20, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#44ddff';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('YOU ESCAPED!', canvas.width / 2, canvas.height / 2 - 60);

    ctx.fillStyle = '#ccbb88';
    ctx.font = '16px monospace';
    ctx.fillText('You rescued the missing explorer and escaped the cave.', canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = '#8a9a8a';
    ctx.font = '14px monospace';
    ctx.fillText('You learned to observe clues, manage resources,', canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText('and make careful decisions instead of rushing forward.', canvas.width / 2, canvas.height / 2 + 34);

    ctx.fillStyle = '#668866';
    ctx.font = '12px monospace';
    ctx.fillText('That is the shift from exploring by instinct to expert caving.', canvas.width / 2, canvas.height / 2 + 60);

    // Play again button
    var btnX = canvas.width / 2 - 100;
    var btnY = canvas.height / 2 + 90;
    ctx.fillStyle = '#0a1a2a';
    ctx.fillRect(btnX, btnY, 200, 44);
    ctx.strokeStyle = '#44ddff';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, 200, 44);
    ctx.fillStyle = '#44ddff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('↻ PLAY AGAIN', canvas.width / 2, btnY + 29);
  }

  /* ========================================================
   * SECTION 14 — Mouse / Click Handling for Buttons
   * ======================================================== */

  function setupMouse() {
    game.canvas.addEventListener('click', function (e) {
      var rect = game.canvas.getBoundingClientRect();
      var mx = (e.clientX - rect.left) * (game.canvas.width / rect.width);
      var my = (e.clientY - rect.top) * (game.canvas.height / rect.height);
      var cw = game.canvas.width;
      var ch = game.canvas.height;

      if (game.state === 'menu') {
        // Start button
        if (mx > cw/2 - 100 && mx < cw/2 + 100 && my > 430 && my < 480) {
          AudioSys.init();
          restartGame();
        }
      } else if (game.state === 'levelComplete') {
        // Next level button
        if (mx > cw/2 - 100 && mx < cw/2 + 100 && my > ch/2 + 70 && my < ch/2 + 114) {
          nextLevel();
        }
      } else if (game.state === 'gameOver') {
        // Try again button
        if (mx > cw/2 - 100 && mx < cw/2 + 100 && my > ch/2 + 60 && my < ch/2 + 104) {
          restartGame();
        }
      } else if (game.state === 'victory') {
        // Play again button
        if (mx > cw/2 - 100 && mx < cw/2 + 100 && my > ch/2 + 90 && my < ch/2 + 134) {
          restartGame();
        }
      }
    });
  }

  /* ========================================================
   * SECTION 15 — Game Loop
   * ======================================================== */

  function gameLoop(timestamp) {
    if (!game.lastTime) game.lastTime = timestamp;
    var dt = (timestamp - game.lastTime) / 1000;
    game.lastTime = timestamp;

    // Clamp dt to prevent huge jumps
    if (dt > 0.05) dt = 0.05;

    // Update
    updatePlayer(dt);
    updateCalculations(dt);

    // Render
    render();

    requestAnimationFrame(gameLoop);
  }

  /* ========================================================
   * SECTION 16 — Initialization
   * ======================================================== */

  function init() {
    var canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      console.error('Canvas element not found!');
      return;
    }

    game.canvas = canvas;
    game.ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    setupInput();
    setupMouse();

    // Start the game loop (begins in menu state)
    game.state = 'menu';
    requestAnimationFrame(gameLoop);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
