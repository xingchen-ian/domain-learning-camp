/* ============================================
   systemState.js — System-calculated results (mood, excitement, dream type, wake state)
   Per brief §12-6: system-calculated data is visibly separated from environment and player input.
   ============================================ */

var SystemState = {

  // ---- Current calculated values ----
  mood: 40,          // 0–100: character's emotional state
  excitement: 0,     // 0–100: accumulated stimulation
  energy: null,      // 0–100 or null (no energy limit in Level 1)

  // ---- Today's difficulty (set by Game when starting a level) ----
  currentDifficulty: null,

  // ---- Dream outcome (calculated at sleep time) ----
  dreamType: null,    // serene / echoes / absurd / kaleidoscope / wandering / unexpectedCalm / drifting / descent
  dreamLabel: null,   // display label (e.g. "A Serene Dream")
  dreamEmoji: null,   // emoji for the dream type
  dreamText: null,     // dynamically generated dream narrative
  wakeState: null,    // "energized" / "tired" / "neutral"

  // ---- Reset for a new run ----
  reset: function(level, difficulty) {
    var preset = Environment.levels[level];
    this.mood = preset.startingMood;
    this.excitement = preset.startingExcitement;
    this.energy = preset.startingEnergy; // null for Level 1
    this.currentDifficulty = difficulty;
    this.dreamType = null;
    this.dreamLabel = null;
    this.dreamEmoji = null;
    this.dreamText = null;
    this.wakeState = null;
  },

  // ---- Apply an activity's effects ----
  applyActivity: function(activityId) {
    var activity = Environment.activities.find(function(a) { return a.id === activityId; });
    var effects = activity.levelEffects[PlayerInput.currentLevel];

    this.mood += effects.moodDelta;
    this.excitement += effects.excitementDelta;

    // Difficulty bonus: if this activity is in the difficulty's beneficial list,
    // add extra mood (Levels 1 & 2 — gentle hint that some activities fit better)
    if (this.currentDifficulty && PlayerInput.currentLevel <= 2) {
      var beneficial = this.currentDifficulty.beneficialActivities.indexOf(activityId) !== -1;
      if (beneficial) {
        this.mood += this.currentDifficulty.bonusMood;
      }
    }

    if (effects.energyCost > 0 && this.energy !== null) {
      this.energy -= effects.energyCost;
    }

    // Clamp all values to 0–100
    this.mood = Math.max(0, Math.min(100, this.mood));
    this.excitement = Math.max(0, Math.min(100, this.excitement));
    if (this.energy !== null) {
      this.energy = Math.max(0, Math.min(100, this.energy));
    }
  },

  // ---- Check if an activity is truly beneficial for today's difficulty ----
  // In ALL levels, only activities in the difficulty's beneficial list count.
  // This prevents "pick anything = good dream" — even in Level 1&2,
  // the player needs to choose activities that genuinely address today's problem.
  // (Levels 1&2 still give bonusMood for beneficial activities as a gentle hint.)
  isActivityBeneficial: function(activityId) {
    if (this.currentDifficulty) {
      return this.currentDifficulty.beneficialActivities.indexOf(activityId) !== -1;
    }
    // No difficulty set (shouldn't happen) — default to false
    return false;
  },

  // ---- Calculate dream outcome at sleep time ----
  // 14 possible dream types, determined by mood, excitement, beneficial proportion,
  // and randomness. The dream TEXT is then generated from activity fragments.
  //
  // Good dreams (5): serene, echoes, absurd, unexpectedCalm, wandering
  // Neutral dreams (1): drifting
  // Scary dreams (8): pursuit, mirror, drowning, maze, loop, theVoid, descent, kaleidoscope
  //
  // Key design: good dreams are HARD to achieve.
  //   - Mood must be ≥60 (high enough to feel good)
  //   - At least HALF of chosen activities must be truly beneficial
  //   - This prevents "pick anything = good dream" — quality matters, not quantity
  //
  // Middle zone (mood 50-59): drifting/descent — not enough for a good dream.
  // Scary dreams triggered by low mood + wrong choices.
  calculateDream: function() {
    var preset = Environment.levels[PlayerInput.currentLevel];

    var chosen = PlayerInput.getChosenActivities();
    var chosenIds = chosen.map(function(a) { return a.id; });

    // Count how many chosen activities are truly beneficial
    var beneficialCount = 0;
    chosen.forEach(function(a) {
      if (SystemState.isActivityBeneficial(a.id)) {
        beneficialCount++;
      }
    });
    var numActivities = chosen.length;
    // "At least half" = beneficialCount >= ceil(numActivities/2)
    //   1 act: need 1 beneficial
    //   2 acts: need 1 beneficial
    //   3 acts: need 2 beneficial
    //   4 acts: need 2 beneficial
    var majorityBeneficial = (beneficialCount >= Math.ceil(numActivities / 2));

    // ---- 1. Too exciting → kaleidoscope (always tired) ----
    if (this.excitement >= preset.excitementThreshold) {
      this.dreamType = "kaleidoscope";
      this.wakeState = "tired";
    }
    // ---- 2. High mood (≥60) + majority beneficial → GOOD dream ----
    else if (this.mood >= preset.moodThreshold && majorityBeneficial) {
      if (numActivities === 1) {
        this.dreamType = "echoes";
      } else if (numActivities >= 4) {
        this.dreamType = "absurd";
      } else {
        this.dreamType = "serene";
      }
      this.wakeState = "energized";
    }
    // ---- 3. High mood (≥60) but NOT majority beneficial → neutral/descent ----
    //   You felt okay but didn't address the real problem enough.
    else if (this.mood >= preset.moodThreshold && !majorityBeneficial) {
      // Rare gift: unexpected calm (10% chance)
      if (Math.random() < 0.10) {
        this.dreamType = "unexpectedCalm";
        this.wakeState = "energized";
      }
      // Some beneficial but not enough → wandering (mostly neutral)
      else if (beneficialCount > 0) {
        this.dreamType = "wandering";
        this.wakeState = Math.random() < 0.20 ? "energized" : "neutral";
      }
      // Zero beneficial activities → descent (tired — you missed everything)
      else {
        this.dreamType = "descent";
        this.wakeState = "tired";
      }
    }
    // ---- 4. Middle zone: mood 50-59 — not terrible, but not enough for a good dream ----
    else if (this.mood >= 50 && this.mood < preset.moodThreshold) {
      if (majorityBeneficial) {
        this.dreamType = "drifting";
        this.wakeState = "neutral";
      } else {
        this.dreamType = "descent";
        this.wakeState = "tired";
      }
    }
    // ---- 5. Low mood (<50) — SCARY DREAM territory ----
    else if (this.mood < 50) {
      // Very low mood (below 25%) + no activities → theVoid
      if (this.mood < 25 && numActivities === 0) {
        this.dreamType = "theVoid";
        this.wakeState = "tired";
      }
      // Very low mood + did things but nothing helped → drowning
      else if (this.mood < 25 && beneficialCount === 0 && numActivities > 0) {
        this.dreamType = "drowning";
        this.wakeState = "tired";
      }
      // Low mood + did only 1 thing that didn't help → loop
      else if (numActivities === 1 && beneficialCount === 0) {
        this.dreamType = "loop";
        this.wakeState = "tired";
      }
      // Low mood + did many things but none helped → maze
      else if (numActivities >= 3 && beneficialCount === 0) {
        this.dreamType = "maze";
        this.wakeState = "tired";
      }
      // Low mood + some beneficial but mood still too low → scary pool
      else if (numActivities > 0) {
        var scaryPool;
        if (this.mood < 30) {
          scaryPool = ["pursuit", "mirror", "drowning", "descent"];
        } else {
          scaryPool = ["pursuit", "mirror", "descent"];
        }
        this.dreamType = scaryPool[Math.floor(Math.random() * scaryPool.length)];
        this.wakeState = "tired";
      }
      // Low mood + no activities → descent
      else {
        this.dreamType = "descent";
        this.wakeState = "tired";
      }
    }

    // ---- Generate the dream narrative from chosen activities ----
    var dt = Environment.dreamTypes[this.dreamType];
    this.dreamLabel = dt.label;
    this.dreamEmoji = dt.emoji;
    this.dreamText = Environment.generateDreamText(this.dreamType, chosenIds);
  },

  // ---- Get a summary string for the result screen ----
  getSummary: function() {
    var chosen = PlayerInput.getChosenActivities();
    var activityNames = chosen.map(function(a) { return a.name; }).join(", ");

    var diffStr = this.currentDifficulty
      ? "Today's difficulty: " + this.currentDifficulty.name + " | "
      : "";

    var moodStr = "Mood: " + this.mood + "%";
    var excStr = "Excitement: " + this.excitement + "%";
    var energyStr = this.energy !== null ? " | Energy left: " + this.energy + "%" : "";

    return diffStr + "Activities: " + activityNames + " | " + moodStr + " | " + excStr + energyStr;
  }
};
