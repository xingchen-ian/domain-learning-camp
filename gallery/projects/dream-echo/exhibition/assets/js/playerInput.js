/* ============================================
   playerInput.js — Tracks player's chosen activities
   Per brief §12-6: player-controlled data is visibly separated from environment and system state.
   ============================================ */

var PlayerInput = {

  // Which activities the player has chosen this run (ordered list of activity ids)
  selectedActivities: [],

  // Which activity ids have been used (for marking cards as "done")
  usedActivityIds: [],

  // The current level number (set when the player chooses a level)
  currentLevel: null,

  // Today's available activity pool (randomly selected subset)
  // Only activities in this list are shown as cards the player can pick
  todayActivities: [],

  // ---- Reset for a new run ----
  reset: function(level) {
    this.selectedActivities = [];
    this.usedActivityIds = [];
    this.currentLevel = level;
    this.todayActivities = [];
  },

  // ---- Set today's available activity pool ----
  setTodayActivities: function(activities) {
    this.todayActivities = activities;
  },

  // ---- Add an activity choice ----
  // Returns true if the activity was accepted, false if it was rejected (e.g. not enough energy)
  chooseActivity: function(activityId) {
    // Don't allow the same activity twice in one day
    if (this.usedActivityIds.indexOf(activityId) !== -1) {
      return false;
    }

    // Find the activity definition
    var activity = Environment.activities.find(function(a) { return a.id === activityId; });
    if (!activity) return false;

    // Get the effects for the current level
    var effects = activity.levelEffects[this.currentLevel];

    // Check energy constraint (Levels 2 & 3 only)
    if (effects.energyCost > 0) {
      var currentEnergy = SystemState.energy;
      if (currentEnergy < effects.energyCost) {
        // Not enough energy — reject the choice
        return false;
      }
    }

    // Accept the choice
    this.selectedActivities.push(activityId);
    this.usedActivityIds.push(activityId);
    return true;
  },

  // ---- Undo the last activity ----
  // Returns the undone activity id, or null if nothing to undo
  undoLast: function() {
    if (this.selectedActivities.length === 0) return null;

    var lastId = this.selectedActivities.pop();
    this.usedActivityIds.pop();

    // Also undo the system state effects
    var activity = Environment.activities.find(function(a) { return a.id === lastId; });
    var effects = activity.levelEffects[this.currentLevel];

    // Reverse mood and excitement changes
    SystemState.mood -= effects.moodDelta;
    SystemState.excitement -= effects.excitementDelta;

    // Reverse difficulty mood bonus (Levels 1 & 2)
    if (SystemState.currentDifficulty && this.currentLevel <= 2) {
      var beneficial = SystemState.currentDifficulty.beneficialActivities.indexOf(lastId) !== -1;
      if (beneficial) {
        SystemState.mood -= SystemState.currentDifficulty.bonusMood;
      }
    }

    // Reverse energy cost (Levels 2 & 3)
    if (effects.energyCost > 0) {
      SystemState.energy += effects.energyCost;
    }

    // Clamp values
    SystemState.mood = Math.max(0, Math.min(100, SystemState.mood));
    SystemState.excitement = Math.max(0, Math.min(100, SystemState.excitement));
    if (SystemState.energy !== null) {
      SystemState.energy = Math.max(0, Math.min(100, SystemState.energy));
    }

    return lastId;
  },

  // ---- Get the list of chosen activities (with their effects) ----
  getChosenActivities: function() {
    return this.selectedActivities.map(function(id) {
      var activity = Environment.activities.find(function(a) { return a.id === id; });
      var diffId = SystemState.currentDifficulty ? SystemState.currentDifficulty.id : null;
      return {
        id: id,
        name: activity.name,
        emoji: activity.emoji,
        dialogue: Environment.getActivityDialogue(id, diffId),
        effects: activity.levelEffects[PlayerInput.currentLevel]
      };
    });
  }
};
