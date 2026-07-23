// ============================================================
// TO LEAVE — Game Data (Challenge Presets)
// ============================================================
// Each challenge defines a character, their clues, the container,
// and the objects in the room with Need/Want scores and memories.
//
// Environment Data: object sizes, container capacity, character clues
// Player-Controlled Data: which objects are packed, which are examined
// System-Calculated Results: Need/Want totals, satisfaction score
// ============================================================

const CHALLENGES = [
  // ─── CASE 1: The Wealthy Lady ───
  {
    id: 0,
    title: "Case 1: The Wealthy Lady",
    character: {
      name: "Mrs. Wellington",
      description: "A wealthy woman who has accumulated countless things over decades. She talks endlessly — about her collections, her trips, her tastes. Her words are a flood, but hidden inside are clues about what truly matters to her.",
      vignette: "I've filled every room in this house, and yet — the emptiness only grows.",
      satisfactionThreshold: 75,
      // Feedback voice — she talks a lot and guides the player
      voiceStyle: "talkative",
      voiceLines: {
        onPack: [
          "Oh, that one! I haven't looked at it in years, but… well, maybe it still means something.",
          "You chose THAT? I have ten better ones, but… fine, fine.",
          "Interesting choice. I wouldn't have picked it, but you're the agent here.",
          "That was my husband's favorite. You have good instincts.",
        ],
        onUnpack: [
          "Removing it? Hmm, perhaps you're right. Perhaps there's something more important.",
          "Well, if you think something else fits better… I do have rather a lot.",
        ],
        onFull: [
          "The bag is full? Well, I suppose we must choose wisely then.",
        ],
        onFinish: {
          high: "You understood me better than I understood myself. Some of these… I didn't realize I still needed them.",
          medium: "A reasonable selection. Though I wonder if you truly read between my words.",
          low: "You packed like a stranger. Did you listen to me at all?",
        },
      },
    },
    container: {
      name: "Luxury Suitcase",
      capacity: 8,
      description: "A large leather suitcase — but even this has limits.",
    },
    clues: [
      {
        type: "text",
        content: "A handwritten note: 'Remember what he gave you on the bridge in Paris.'",
        hint: "Something connected to Paris and her husband matters deeply.",
      },
      {
        type: "art",
        content: "A small sketch of a garden gate, drawn in ink.",
        hint: "The garden was where she felt most at peace.",
      },
      {
        type: "text",
        content: "A torn diary page: 'I keep buying things to fill the rooms, but the rooms feel emptier each year.'",
        hint: "She accumulates things to cope with emptiness — but the emotional items matter more.",
      },
    ],
    objects: [
      {
        id: "perfume",
        name: "Vintage Perfume",
        description: "A rare fragrance from Paris, in a crystal bottle. The scent has faded but the memory hasn't.",
        size: 1,
        needScore: 2,
        wantScore: 8,
        memory: {
          title: "The Scent of Paris",
          text: "She bought this on her first trip to Paris with her late husband. On the bridge over the Seine, he surprised her with it. Every time she opens the bottle, she's back on that bridge — the wind, the water, his smile.",
          visual: "bridge",
          colors: ["#4a6fa5", "#8ab4d6", "#e8d5b7"],
        },
        clueRelevance: "Directly matches the clue about Paris and her husband's gift.",
      },
      {
        id: "garden_key",
        name: "Garden Gate Key",
        description: "A small iron key on a ribbon. It unlocks the gate to her walled garden.",
        size: 1,
        needScore: 1,
        wantScore: 9,
        memory: {
          title: "Behind the Gate",
          text: "The garden was her refuge. When the house felt too full of things and too empty of feeling, she would unlock the gate and sit among the roses. The key is small but it opens the only place where she feels whole.",
          visual: "garden",
          colors: ["#2d5a27", "#8fbc8f", "#ffefdb"],
        },
        clueRelevance: "Matches the ink sketch of the garden gate.",
      },
      {
        id: "silk_dress",
        name: "Silk Evening Dress",
        description: "A gorgeous emerald dress she wore to charity galas. Impractical for travel, but beautiful.",
        size: 2,
        needScore: 1,
        wantScore: 4,
        memory: {
          title: "The Galas",
          text: "She wore this to impress, not to feel. The galas were performances — she was the wealthiest woman in the room, but never the happiest. The dress is a costume, not a memory.",
          visual: "party",
          colors: ["#50643c", "#c4a35a", "#2e2e2e"],
        },
        clueRelevance: "Looks impressive, but the diary reveals she fills rooms with things that don't fill her heart.",
      },
      {
        id: "photo_album",
        name: "Old Photo Album",
        description: "A leather-bound album with photos spanning 40 years. Heavy and fragile.",
        size: 2,
        needScore: 1,
        wantScore: 7,
        memory: {
          title: "Forty Years in Pages",
          text: "Every birthday, every trip, every garden afternoon. The album is her autobiography in pictures. Without it, the years blur together. With it, she can still touch each moment.",
          visual: "album",
          colors: ["#8b6914", "#d4c4a8", "#5a3e1b"],
        },
        clueRelevance: "A collection of real memories — contrasting with her habit of buying things to fill emptiness.",
      },
      {
        id: "jewelry_box",
        name: "Jewelry Collection",
        description: "A velvet box with rings, necklaces, and brooches. Worth a fortune, but which pieces matter?",
        size: 2,
        needScore: 1,
        wantScore: 3,
        memory: {
          title: "Cold Gold",
          text: "Most of these were purchases, not gifts. She bought them on lonely afternoons, telling herself they were investments. Only one ring — the simple gold band at the bottom — was his. The rest are just expensive noise.",
          visual: "jewelry",
          colors: ["#c9a961", "#2e2e2e", "#b87333"],
        },
        clueRelevance: "Valuable but mostly emotional substitutes. The diary clue hints that buying things doesn't fill the emptiness.",
      },
      {
        id: "medicine",
        name: "Medicine Kit",
        description: "Prescription bottles, vitamins, and a first-aid pouch. Essential for health.",
        size: 1,
        needScore: 9,
        wantScore: 1,
        memory: {
          title: "What Keeps Her Going",
          text: "Without these, she can't manage her blood pressure or sleep through the night. Practical, unromantic, but the things that literally keep her alive. Even wealthy ladies need their medicine.",
          visual: "medical",
          colors: ["#ffffff", "#e8e8e8", "#d32f2f"],
        },
        clueRelevance: "No emotional connection, but extremely high utility. The challenge of balancing need vs. want.",
      },
      {
        id: "passport",
        name: "Passport & Documents",
        description: "Her passport, ID, and bank cards. Can't travel or function without these.",
        size: 1,
        needScore: 10,
        wantScore: 0,
        memory: {
          title: "The Papers of Identity",
          text: "A passport is permission to leave. An ID is proof that you exist. These aren't emotional — they're foundational. Without them, she's nowhere and no one.",
          visual: "document",
          colors: ["#1a237e", "#c62828", "#eceff1"],
        },
        clueRelevance: "Zero emotional weight but maximum necessity. The game's lesson: some things must go in regardless of feelings.",
      },
      {
        id: "tea_set",
        name: "Porcelain Tea Set",
        description: "A hand-painted tea set from Kyoto. Beautiful, delicate, and a morning ritual.",
        size: 2,
        needScore: 3,
        wantScore: 6,
        memory: {
          title: "Morning Tea",
          text: "She brought this back from Japan and made tea every morning since. The ritual — boiling water, choosing a cup, the first sip — is the one moment each day where she doesn't think about anything else. It's both habit and peace.",
          visual: "tea",
          colors: ["#e8d5b7", "#3e7c8f", "#5d4037"],
        },
        clueRelevance: "A ritual item — both useful and emotional. The diary hints she needs practices that give peace, not more possessions.",
      },
      {
        id: "blanket",
        name: "Knitted Blanket",
        description: "A thick wool blanket her mother made. Worn but warm.",
        size: 2,
        needScore: 5,
        wantScore: 6,
        memory: {
          title: "Mother's Hands",
          text: "Her mother knitted this over a winter, stitch by stitch, while watching old films. It's the warmest thing in the house — not just because of the wool, but because of the hands that made it. She still wraps it around herself on hard nights.",
          visual: "blanket",
          colors: ["#8b4513", "#d2691e", "#f5deb3"],
        },
        clueRelevance: "Both practical and deeply emotional — a bridge between Need and Want.",
      },
      {
        id: "clock",
        name: "Grandfather Clock",
        description: "A towering antique clock. Impossible to fit, but she insists it's 'essential.'",
        size: 3,
        needScore: 0,
        wantScore: 2,
        memory: {
          title: "Tick, Tick",
          text: "She bought it at an auction because it looked impressive in the hallway. It chimes every hour — a constant reminder of time passing. She thought it made the house feel important. It just makes it feel louder.",
          visual: "clock",
          colors: ["#5d4037", "#ffc107", "#212121"],
        },
        clueRelevance: "The diary reveals she buys things to feel important, but they just make the emptiness louder. This clock is a perfect example.",
      },
    ],
  },

  // ─── CASE 2: The College Student ───
  {
    id: 1,
    title: "Case 2: The College Student",
    character: {
      name: "Sam",
      description: "A college student moving out of their dorm. Quiet — keeps their thoughts in doodles and half-crumpled notes scattered around the room.",
      vignette: "Four years. Everything I own fits in one dorm room. Most of it I don't even care about — but a few things… I can't explain why, I just can't leave without them.",
      satisfactionThreshold: 70,
      voiceStyle: "quiet",
      voiceLines: {
        onPack: [
          "…thanks.",
          "Hmm. Yeah, that one.",
          "Okay.",
          "…I didn't think anyone would notice that one.",
        ],
        onUnpack: [
          "If you think something else should go… yeah, okay.",
        ],
        onFull: [
          "It's full? I guess… we have to choose then.",
        ],
        onFinish: {
          high: "You actually… got it. Some of these I couldn't even explain to myself, but you picked them anyway.",
          medium: "Not bad. Some things you got right, some I would've picked differently. But you tried.",
          low: "I don't think you saw what I was trying to show you.",
        },
      },
    },
    container: {
      name: "Dorm Backpack",
      capacity: 6,
      description: "A worn backpack — it's carried four years of classes, but space is tight.",
    },
    clues: [
      {
        type: "art",
        content: "A doodle of a hand reaching toward something small, then pulling back.",
      },
      {
        type: "text",
        content: "A crumpled note: 'some things you don't choose — they choose you.'",
      },
    ],
    objects: [
      {
        id: "laptop",
        name: "Laptop & Charger",
        description: "A laptop and charger.",
        size: 1,
        needScore: 10,
        wantScore: 2,
        // No memory — this is obviously practical
      },
      {
        id: "tree_photo",
        name: "Photo Under the Tree",
        description: "A small framed photo of two people under a tree.",
        size: 1,
        needScore: 0,
        wantScore: 9,
        memory: {
          title: "Under the Branches",
          text: "That afternoon. The other person. Sam doesn't talk about them. But the photo is proof it was real.",
          visual: "tree",
          colors: ["#4a7c59", "#8fbc8f", "#f5deb3"],
        },
      },
      {
        id: "mom_letter",
        name: "Letter from Mom",
        description: "A handwritten letter on faded stationery.",
        size: 1,
        needScore: 0,
        wantScore: 10,
        memory: {
          title: "Her Handwriting",
          text: "Mom wrote this the day Sam left. Not advice — just love, in her looping handwriting. Sam read it on every bad night.",
          visual: "letter",
          colors: ["#f5deb3", "#5d4037", "#e8d5b7"],
        },
      },
      {
        id: "mom_copy",
        name: "Printed Copy of Letter",
        description: "A photocopy of the same letter, on flat white paper.",
        size: 1,
        needScore: 0,
        wantScore: 2,
        memory: {
          title: "Same Words, Different Weight",
          text: "Same words, no warmth. No handwriting, no creased paper. The message without the meaning.",
          visual: "copy",
          colors: ["#ffffff", "#cccccc", "#212121"],
        },
      },
      {
        id: "poster",
        name: "Concert Poster",
        description: "A faded concert poster.",
        size: 1,
        needScore: 0,
        wantScore: 5,
        // No memory — just paper
      },
      {
        id: "textbooks",
        name: "Textbooks",
        description: "A stack of textbooks.",
        size: 2,
        needScore: 4,
        wantScore: 0,
        // No memory — available online anyway
      },
      {
        id: "hoodie",
        name: "Favorite Hoodie",
        description: "A worn, soft hoodie.",
        size: 1,
        needScore: 6,
        wantScore: 4,
        // No memory — comfort is obvious
      },
      {
        id: "snacks",
        name: "Snack Stash",
        description: "Granola bars, instant noodles, coffee packets.",
        size: 1,
        needScore: 7,
        wantScore: 0,
        // No memory — just fuel
      },
      {
        id: "journal",
        name: "Personal Journal",
        description: "A notebook filled with writing and doodles.",
        size: 1,
        needScore: 1,
        wantScore: 7,
        memory: {
          title: "The Unfinished Thoughts",
          text: "What Sam can't say out loud. The doodles, the questions, the honest parts. Leaving without it means leaving part of themselves.",
          visual: "journal",
          colors: ["#212121", "#f5deb3", "#5d4037"],
        },
      },
    ],
  },

  // ─── CASE 3: The Elderly Man ───
  {
    id: 2,
    title: "Case 3: The Elderly Man",
    character: {
      name: "Mr. Chen",
      description: "An elderly man leaving the house he's lived in for fifty years. He doesn't say much.",
      vignette: "Fifty years in this house. What do you take from fifty years? You can't take the walls. You can't take the mornings. You take… what you can carry.",
      satisfactionThreshold: 72,
      voiceStyle: "silent",
      voiceLines: {
        onPack: [
          "...",
          "...",
          "...",
          "...",
          "...",
          "...",
          "...",
          "...",
          "...",
          "That one.",
        ],
        onUnpack: [
          "...",
          "...",
          "...",
          "...",
          "...",
        ],
        onFull: [
          "...",
        ],
        onFinish: {
          high: "You saw what I couldn't say. Thank you.",
          medium: "Some… you understood.",
          low: "...The wrong things.",
        },
      },
    },
    container: {
      name: "Old Travel Bag",
      capacity: 7,
      description: "A canvas bag he's used since his thirties. It's traveled with him before — it can do it again.",
    },
    clues: [
      {
        type: "art",
        content: "A smudged line — like a horizon, or maybe a river. Below it, only the word 'before' is still visible.",
      },
      {
        type: "art",
        content: "A creased square of paper. Faded colors. A shape that might be a house, or might be a box. Hard to tell anymore.",
      },
    ],
    objects: [
      {
        id: "river_photo",
        name: "Faded Photograph",
        description: "A faded photograph.",
        size: 1,
        needScore: 0,
        wantScore: 10,
        memory: {
          title: "The River…",
          text: "The riverbank. He was young. She was… there. Something about that day.",
          visual: "river",
          colors: ["#4a6fa5", "#8ab4d6", "#f5deb3"],
        },
      },
      {
        id: "baker_apron",
        name: "Flour-Stained Apron",
        description: "A flour-stained apron.",
        size: 1,
        needScore: 1,
        wantScore: 8,
        memory: {
          title: "Flour and Dawn",
          text: "Flour. Mornings. Thirty years of… something. He can't separate it anymore.",
          visual: "apron",
          colors: ["#f5deb3", "#8b4513", "#5d4037"],
        },
      },
      {
        id: "crayon_drawing",
        name: "Crayon Drawing",
        description: "A crayon drawing on creased paper.",
        size: 1,
        needScore: 0,
        wantScore: 9,
        memory: {
          title: "The House in Crayon",
          text: "She was five. 'Grandpa is always here.' But here won't exist anymore.",
          visual: "crayon",
          colors: ["#ff6b6b", "#4ecdc4", "#ffe66d"],
        },
      },
      {
        id: "medication",
        name: "Daily Medications",
        description: "Pill bottles and vitamins.",
        size: 1,
        needScore: 10,
        wantScore: 0,
        // No memory — his heart needs these. That's all there is to know.
      },
      {
        id: "walking_stick",
        name: "Walking Stick",
        description: "A carved wooden stick.",
        size: 1,
        needScore: 7,
        wantScore: 3,
        // No memory — he needs it to walk. What else is there?
      },
      {
        id: "id_docs",
        name: "ID & Documents",
        description: "ID card and papers.",
        size: 1,
        needScore: 10,
        wantScore: 0,
        // No memory — you can't leave without proof that you exist.
      },
      {
        id: "teapot",
        name: "Clay Teapot",
        description: "A small clay teapot.",
        size: 1,
        needScore: 2,
        wantScore: 7,
        memory: {
          title: "Afternoon, Always",
          text: "Three o'clock. Every day. The clay remembers what he can't.",
          visual: "teapot",
          colors: ["#5d4037", "#a1887f", "#efebe9"],
        },
      },
      {
        id: "old_radio",
        name: "Vintage Radio",
        description: "A wooden radio.",
        size: 2,
        needScore: 3,
        wantScore: 4,
        // No memory — just noise, or company. Hard to tell.
      },
      {
        id: "watch",
        name: "Wristwatch",
        description: "A wristwatch.",
        size: 1,
        needScore: 3,
        wantScore: 9,
        memory: {
          title: "Her Time",
          text: "She wore this. It still ticks. Her time, on his arm.",
          visual: "watch",
          colors: ["#c9a961", "#212121", "#e8d5b7"],
        },
      },
      {
        id: "furniture",
        name: "Chair & Side Table",
        description: "A chair and side table.",
        size: 3,
        needScore: 0,
        wantScore: 2,
        // No memory — can't travel. Some things stay.
      },
    ],
  },
];
