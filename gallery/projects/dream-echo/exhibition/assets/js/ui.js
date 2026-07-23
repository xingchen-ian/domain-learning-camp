/* ============================================
   ui.js — Renders game screens, updates bars, shows dialogue
   Handles all DOM manipulation for the game.
   ============================================ */

var UI = {

  // ---- Apply character theme colors to the entire UI ----
  // Uses CSS custom properties so all themed elements update at once
  applyTheme: function() {
    var char = Environment.currentCharacter;
    if (!char) return;
    var root = document.documentElement;
    root.style.setProperty("--accent", char.accentColor);
    root.style.setProperty("--accent-light", char.accentLight);
  },

  // ---- Render character select screen ----
  renderCharacterSelect: function() {
    var grid = document.getElementById("character-grid");
    grid.innerHTML = "";

    Environment.characters.forEach(function(char) {
      var card = document.createElement("div");
      card.className = "character-card";
      // Use each character's accent color on the card
      card.style.borderColor = "#d1d9e0";
      card.innerHTML =
        '<div class="char-emoji">' + char.avatarEmoji + '</div>' +
        '<div class="char-name" style="color:' + char.accentColor + '">' + char.name + '</div>' +
        '<div class="char-personality">' + char.personality + '</div>';

      card.onmouseenter = function() {
        card.style.borderColor = char.accentColor;
        card.style.boxShadow = "0 6px 24px " + char.accentColor + "25";
      };
      card.onmouseleave = function() {
        card.style.borderColor = "#d1d9e0";
        card.style.boxShadow = "none";
      };
      card.onclick = function() { Game.selectCharacter(char.id); };
      grid.appendChild(card);
    });
  },

  // ---- Show a specific screen, hide all others ----
  showScreen: function(screenId) {
    var screens = document.querySelectorAll(".game-screen");
    screens.forEach(function(s) { s.classList.remove("active"); });
    document.getElementById(screenId).classList.add("active");
  },

  // ---- Show/hide the dream overlay ----
  showDreamOverlay: function(show) {
    var overlay = document.getElementById("dream-overlay");
    if (show) {
      overlay.classList.add("active");
    } else {
      overlay.classList.remove("active");
    }
  },

  // ---- Update the morning screen ----
  renderMorning: function() {
    var diff = SystemState.currentDifficulty;
    var char = Environment.currentCharacter;
    if (diff && char) {
      // Show today's difficulty event prominently
      document.getElementById("morning-greeting").textContent = "Good Morning, " + char.name;
      document.getElementById("morning-line").innerHTML =
        '<div style="font-weight:600;color:var(--accent);margin-bottom:12px;">' +
        diff.emoji + ' Today: ' + diff.name + '</div>' +
        '<div>' + diff.morningLine + '</div>';
    } else if (char) {
      document.getElementById("morning-greeting").textContent = "Good Morning, " + char.name;
      document.getElementById("morning-line").textContent = char.morningLine;
    }
  },

  // ---- Update the daytime screen ----
  renderDaytime: function() {
    var preset = Environment.levels[PlayerInput.currentLevel];
    var diff = SystemState.currentDifficulty;
    var char = Environment.currentCharacter;

    // Update character info panel
    if (char) {
      document.getElementById("char-avatar").textContent = char.avatarEmoji;
      document.getElementById("char-name").textContent = char.name;
    }

    // Show today's difficulty as a banner above the activity grid
    var titleEl = document.getElementById("daytime-title");
    if (diff) {
      titleEl.innerHTML =
        '<span style="font-size:0.9rem;color:#7a8a9a;">Today\'s difficulty:</span> ' +
        '<strong style="color:var(--accent);">' + diff.emoji + ' ' + diff.name + '</strong>';
    } else {
      titleEl.textContent = "Choose what to do today";
    }

    var hintEl = document.getElementById("daytime-hint");
    hintEl.textContent = preset.hint;

    // Show/hide energy bar based on level
    var energyRow = document.getElementById("energy-row");
    energyRow.style.display = preset.showEnergy ? "block" : "none";

    // Render activity cards
    this.renderActivityCards();

    // Update stat bars
    this.updateStatBars();

    // Enable/disable sleep button (always enabled — player can sleep anytime)
    document.getElementById("sleep-btn").disabled = false;

    // Enable/disable undo button
    document.getElementById("undo-btn").disabled = (PlayerInput.selectedActivities.length === 0);
  },

  // ---- Render activity cards in the grid ----
  // Only shows activities in PlayerInput.todayActivities (the daily random subset)
  renderActivityCards: function() {
    var grid = document.getElementById("activity-grid");
    grid.innerHTML = "";

    var usedIds = PlayerInput.usedActivityIds;
    var level = PlayerInput.currentLevel;
    var todayActs = PlayerInput.todayActivities;

    // Special activity indicator — show which ones are difficulty-specific
    var diffId = SystemState.currentDifficulty ? SystemState.currentDifficulty.id : null;

    todayActs.forEach(function(activity) {
      var card = document.createElement("div");
      card.className = "activity-card";

      var effects = activity.levelEffects[level];
      var isUsed = usedIds.indexOf(activity.id) !== -1;
      var noEnergy = effects.energyCost > 0 && SystemState.energy !== null && SystemState.energy < effects.energyCost;

      if (isUsed) {
        card.classList.add("done");
      } else if (noEnergy) {
        card.classList.add("done");
        card.style.opacity = "0.3";
      }

      // No special tag — difficulty-specific activities are mixed in
      // without being labeled. The player must read the dialogue to
      // figure out which activities truly address today's problem.

      // Build cost line
      var costLine = "";
      if (effects.energyCost > 0) {
        costLine = "Energy cost: " + effects.energyCost;
      }

      card.innerHTML =
        '<div class="act-icon">' + activity.emoji + '</div>' +
        '<div class="act-name">' + activity.name + '</div>' +
        '<div class="act-desc">' + activity.description + '</div>' +
        (costLine ? '<div class="act-cost">' + costLine + '</div>' : '');

      if (!isUsed && !noEnergy) {
        card.onclick = function() { Game.chooseActivity(activity.id); };
      }

      grid.appendChild(card);
    });
  },

  // ---- Update mood, excitement, energy bars ----
  updateStatBars: function() {
    var moodBar = document.getElementById("mood-bar");
    var excBar = document.getElementById("excitement-bar");
    var energyBar = document.getElementById("energy-bar");

    var moodVal = document.getElementById("mood-val");
    var excVal = document.getElementById("excitement-val");
    var energyVal = document.getElementById("energy-val");

    moodBar.style.width = SystemState.mood + "%";
    moodVal.textContent = SystemState.mood + "%";

    excBar.style.width = SystemState.excitement + "%";
    excVal.textContent = SystemState.excitement + "%";

    if (SystemState.energy !== null) {
      energyBar.style.width = SystemState.energy + "%";
      energyVal.textContent = SystemState.energy + "%";
    }
  },

  // ---- Add a dialogue entry to the log ----
  addDialogueEntry: function(source, text) {
    var log = document.getElementById("dialogue-log");
    var entry = document.createElement("div");
    entry.className = "dialogue-entry";
    entry.innerHTML =
      '<div class="d-source">' + source + '</div>' +
      '<div class="d-text">' + text + '</div>';
    log.appendChild(entry);

    // Auto-scroll to bottom
    log.scrollTop = log.scrollHeight;
  },

  // ---- Clear the dialogue log ----
  clearDialogueLog: function() {
    document.getElementById("dialogue-log").innerHTML = "";
  },

  // ---- Render dream overlay ----
  renderDream: function() {
    var overlay = document.getElementById("dream-overlay");
    // Remove any previous dream-category classes
    overlay.classList.remove("dream-good", "dream-neutral", "dream-scary");

    // Add category class for visual differentiation
    var category = Environment.getDreamCategory(SystemState.dreamType);
    overlay.classList.add("dream-" + category);

    document.getElementById("dream-type-label").textContent = SystemState.dreamEmoji + "  " + SystemState.dreamLabel;
    document.getElementById("dream-text").textContent = SystemState.dreamText;
    this.showDreamOverlay(true);
  },

  // ---- Render wake-up result ----
  renderWakeUp: function() {
    var icon, stateText, stateClass;

    if (SystemState.wakeState === "energized") {
      icon = "☀️";
      stateText = "Energized — Ready for the Day!";
      stateClass = "good";
    } else if (SystemState.wakeState === "tired") {
      icon = "😴";
      stateText = "Tired — Not a Good Night...";
      stateClass = "bad";
    } else {
      icon = "😐";
      stateText = "Neutral — An Okay Night";
      stateClass = "neutral";
    }

    document.getElementById("result-icon").textContent = icon;
    var stateEl = document.getElementById("result-state");
    stateEl.textContent = stateText;
    stateEl.className = "result-state " + stateClass;

    document.getElementById("result-reflection").textContent =
      '"' + Environment.reflections[SystemState.dreamType] + '"';

    document.getElementById("result-summary").textContent = SystemState.getSummary();
  }
};
