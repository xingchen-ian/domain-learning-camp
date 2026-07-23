/* ============================================
   game.js — Main game controller
   Manages the game flow and wires environment, playerInput, systemState, and ui together.
   ============================================ */

var Game = {

  // ---- Select a character ----
  selectCharacter: function(characterId) {
    var character = Environment.characters.find(function(c) { return c.id === characterId; });
    if (!character) return;

    Environment.currentCharacter = character;
    UI.applyTheme();
    UI.showScreen("screen-level-select");
  },

  // ---- Start a level (after character is selected) ----
  startLevel: function(level) {
    if (!Environment.currentCharacter) {
      // Fallback: randomly pick a character if none selected
      Environment.currentCharacter = Environment.characters[Math.floor(Math.random() * Environment.characters.length)];
    }

    // Pick a random daily difficulty for this character
    var difficulties = Environment.currentCharacter.dailyDifficulties;
    var difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];

    // Reset all three data modules (environment is read-only, no reset needed)
    PlayerInput.reset(level);
    SystemState.reset(level, difficulty);

    // Select available activities for today (random subset based on difficulty)
    var todayActivities = Environment.selectTodayActivities(difficulty.id);
    PlayerInput.setTodayActivities(todayActivities);

    // Show the morning screen with today's difficulty
    UI.renderMorning();
    UI.showScreen("screen-morning");
  },

  // ---- Transition from morning to daytime ----
  goToDaytime: function() {
    UI.clearDialogueLog();

    // Add the difficulty morning line to the dialogue log
    var diff = SystemState.currentDifficulty;
    var char = Environment.currentCharacter;
    if (diff) {
      UI.addDialogueEntry(
        char.name + " (" + diff.emoji + " " + diff.name + ")",
        diff.morningLine
      );
    } else {
      UI.addDialogueEntry(char.name, char.morningLine);
    }

    // Render the daytime screen
    UI.renderDaytime();
    UI.showScreen("screen-daytime");
  },

  // ---- Player chooses an activity ----
  chooseActivity: function(activityId) {
    // Check if this activity is available today
    var availableToday = PlayerInput.todayActivities.find(function(a) { return a.id === activityId; });
    if (!availableToday) return; // not in today's pool

    var accepted = PlayerInput.chooseActivity(activityId);

    if (!accepted) return; // activity was rejected (already done or no energy)

    // Apply the activity's effects to system state
    SystemState.applyActivity(activityId);

    // Find the activity for its dialogue
    var activity = Environment.activities.find(function(a) { return a.id === activityId; });

    // Get the dialogue based on today's difficulty — same activity, different response
    var diffId = SystemState.currentDifficulty ? SystemState.currentDifficulty.id : null;
    var dialogue = Environment.getActivityDialogue(activityId, diffId);

    // Show the character's reaction in the dialogue log
    UI.addDialogueEntry(Environment.currentCharacter.name + " (after " + activity.name + ")", dialogue);

    // Update the UI (cards, bars, buttons)
    UI.renderDaytime();
  },

  // ---- Undo the last activity ----
  undoLast: function() {
    var undoneId = PlayerInput.undoLast();
    if (!undoneId) return;

    var activity = Environment.activities.find(function(a) { return a.id === undoneId; });

    // Remove the last dialogue entry
    var log = document.getElementById("dialogue-log");
    if (log.lastChild) log.removeChild(log.lastChild);

    // Update UI
    UI.renderDaytime();
  },

  // ---- Transition from daytime to dream ----
  goToSleep: function() {
    // Calculate the dream outcome based on the final state
    SystemState.calculateDream();

    // Show the dream overlay
    UI.renderDream();
  },

  // ---- Transition from dream to wake-up result ----
  goToWakeUp: function() {
    // Hide dream overlay
    UI.showDreamOverlay(false);

    // Show the wake-up result screen
    UI.renderWakeUp();
    UI.showScreen("screen-wake-up");
  },

  // ---- Retry the same level ----
  retryLevel: function() {
    this.startLevel(PlayerInput.currentLevel);
  },

  // ---- Go back to level select (keep same character) ----
  goToLevelSelect: function() {
    UI.showScreen("screen-level-select");
  },

  // ---- Go back to character select (pick a new character) ----
  goToCharacterSelect: function() {
    Environment.currentCharacter = null;
    UI.renderCharacterSelect();
    UI.showScreen("screen-character-select");
  }
};
