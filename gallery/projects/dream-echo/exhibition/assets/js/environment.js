/* ============================================
   environment.js — Read-only game data (Level presets, character, activities, reactions)
   Per brief §12-6: environment data is visibly separated from player input and system state.
   ============================================ */

var Environment = {

  // ---- Characters ----
  // Four characters with distinct personalities and daily difficulties.
  // Each run randomly assigns one character; the player can also choose from a select screen.
  // What's "beneficial" depends on BOTH the character AND today's difficulty — no fixed answers.

  characters: [
    {
      id: "lin",
      name: "Lin",
      avatarEmoji: "🧑",
      personality: "Quiet and thoughtful. Enjoys calm moments but often feels pressure from expectations.",
      morningLine: "Another day... I hope tonight goes better than last night.",
      accentColor: "#3a6b9f",
      accentLight: "#e8f0f8",
      dailyDifficulties: [
        { id: "exam", name: "Exam Pressure", emoji: "📝", morningLine: "I just got my exam results back... not what I hoped for. I feel like I studied so hard and it still wasn't enough.", beneficialActivities: ["study", "read", "walk", "sunset", "shower"], excludedCore: [], bonusMood: 5 },
        { id: "argument", name: "Argument with a Friend", emoji: "💔", morningLine: "I had an argument with my best friend this morning. They said something that really hurt, and I don't know how to fix it.", beneficialActivities: ["letter", "walk", "chores", "read", "sunset"], excludedCore: [], bonusMood: 5 },
        { id: "lonely", name: "Feeling Lonely", emoji: "🫥", morningLine: "Nobody seems to notice me today. I walked past three people I know and no one even said hi.", beneficialActivities: ["family", "friend", "cook", "read", "chores"], excludedCore: [], bonusMood: 5 },
        { id: "overwhelmed", name: "Overwhelmed", emoji: "🌊", morningLine: "Too many things to do... homework, chores, messages I need to reply to. I can't focus on any of them.", beneficialActivities: ["nap", "walk", "sunset", "chores", "cook"], excludedCore: [], bonusMood: 5 },
        { id: "selfdoubt", name: "Self-Doubt", emoji: "🪞", morningLine: "I keep wondering if I'm good enough. Everyone else seems so confident, and I'm just... pretending.", beneficialActivities: ["photos", "read", "sunset", "cook", "friend"], excludedCore: [], bonusMood: 5 }
      ]
    },
    {
      id: "maya",
      name: "Maya",
      avatarEmoji: "🏃",
      personality: "Athletic and driven. Appears confident but secretly fears failure and being reduced to just 'the athlete.'",
      morningLine: "Ready to train again... or am I just running from something?",
      accentColor: "#d4783c",
      accentLight: "#f5e8d8",
      dailyDifficulties: [
        { id: "performance", name: "Performance Failure", emoji: "🥀", morningLine: "I came last in the competition today. Everyone was watching. I trained so hard and it still wasn't enough.", beneficialActivities: ["sunset", "walk", "read", "stretch", "shower"], excludedCore: ["study"], bonusMood: 5 },
        { id: "perfectionism", name: "Perfectionism Trap", emoji: "🔮", morningLine: "I spent three hours redoing something that was already fine. I can't stop fixing what doesn't need fixing.", beneficialActivities: ["nap", "walk", "sunset", "stretch", "cook"], excludedCore: ["study"], bonusMood: 5 },
        { id: "betrayal", name: "Betrayed by a Teammate", emoji: "🤥", morningLine: "My teammate told everyone about my anxiety. The person I trusted most used my weakness as gossip.", beneficialActivities: ["letter", "friend", "walk", "sunset", "read"], excludedCore: [], bonusMood: 5 },
        { id: "pressure", name: "Too Much Pressure", emoji: "🏋️", morningLine: "My coach said I need to 'push harder.' My parents said 'you could do better.' When does encouragement become control?", beneficialActivities: ["nap", "walk", "sunset", "restDay", "chores"], excludedCore: ["study"], bonusMood: 5 },
        { id: "identity", name: "Lost Identity", emoji: "🪞", morningLine: "Everyone sees 'the athlete.' They don't know I also like reading, cooking, being quiet. They see one thing and assume it's everything.", beneficialActivities: ["read", "cook", "photos", "journalAthlete", "sunset"], excludedCore: [], bonusMood: 5 }
      ]
    },
    {
      id: "kai",
      name: "Kai",
      avatarEmoji: "🎨",
      personality: "Creative and sensitive. Loves making things but feels torn between passion and practicality.",
      morningLine: "I want to make something today. I just hope the inspiration comes...",
      accentColor: "#7b5ea7",
      accentLight: "#ece4f5",
      dailyDifficulties: [
        { id: "creativeBlock", name: "Creative Block", emoji: "🧱", morningLine: "I sat at my desk for two hours and made nothing. The ideas that used to flow so easily... they're just gone.", beneficialActivities: ["walk", "sunset", "sketch", "shower", "cook"], excludedCore: ["study"], bonusMood: 5 },
        { id: "familyExpect", name: "Family Expectations", emoji: "📋", morningLine: "My parents said art isn't a 'real career.' They want me to study business. I love what I do, but they make me feel like it's worthless.", beneficialActivities: ["letter", "talkToMom", "cook", "sunset", "walk"], excludedCore: [], bonusMood: 5 },
        { id: "rejection", name: "Work Rejected", emoji: "🚫", morningLine: "I submitted my work to the exhibition and they said no. They said it 'didn't fit.' I don't know what that means. It fit me.", beneficialActivities: ["walk", "sunset", "read", "cook", "shower"], excludedCore: ["study"], bonusMood: 5 },
        { id: "comparison", name: "Comparing with Others", emoji: "📊", morningLine: "I saw another student's portfolio online. It's so much better than mine. Everything they do looks effortless, and everything I do feels like struggle.", beneficialActivities: ["photos", "visitGallery", "sunset", "read", "cook"], excludedCore: ["study"], bonusMood: 5 },
        { id: "lostInspiration", name: "Lost Inspiration", emoji: "💫", morningLine: "The thing that made me want to create in the first place... I can't feel it anymore. Like the spark just went out.", beneficialActivities: ["photos", "revisitOld", "walk", "sunset", "cook"], excludedCore: ["study"], bonusMood: 5 }
      ]
    },
    {
      id: "sora",
      name: "Sora",
      avatarEmoji: "🌍",
      personality: "Bright and adaptable. A transfer student navigating a new environment while holding onto who they are.",
      morningLine: "New place, new day. I wonder if today I'll finally feel like I belong.",
      accentColor: "#2a8f8f",
      accentLight: "#e0f2f2",
      dailyDifficulties: [
        { id: "newSchool", name: "Starting at a New School", emoji: "🏫", morningLine: "I just transferred here. I don't know anyone. The hallways are full of people who already belong, and I'm just... passing through.", beneficialActivities: ["friend", "joinClub", "walk", "cook", "sunset"], excludedCore: ["chores", "study"], bonusMood: 5 },
        { id: "culturalClash", name: "Cultural Clash", emoji: "🌍", morningLine: "At home, we do things one way. At school, everyone does things differently. I keep feeling like I'm doing something wrong, even when I'm not.", beneficialActivities: ["friend", "shareCulture", "cook", "read", "sunset"], excludedCore: ["chores"], bonusMood: 5 },
        { id: "homesick", name: "Homesick", emoji: "🏠", morningLine: "I miss my old room. My old street. The bakery down the corner. Everything here is fine, but it's not mine yet.", beneficialActivities: ["callHome", "cook", "read", "sunset", "walk"], excludedCore: [], bonusMood: 5 },
        { id: "maskWearing", name: "Wearing a Mask", emoji: "🎭", morningLine: "I smile and nod and act like I fit in. But it's a performance. Underneath, I feel like I'm lying every time I pretend to be 'normal here.'", beneficialActivities: ["friend", "beReal", "letter", "walk", "sunset"], excludedCore: ["chores"], bonusMood: 5 },
        { id: "languageBarrier", name: "Language Barrier", emoji: "🗣️", morningLine: "There's a thought I can express perfectly in my own language. But when I try to say it here, it comes out wrong — simplified, flattened, less than what I meant.", beneficialActivities: ["letter", "writePoem", "read", "cook", "sunset"], excludedCore: ["chores"], bonusMood: 5 }
      ]
    }
  ],

  // Currently selected character (set by Game at startLevel)
  currentCharacter: null,

  // ---- Activity definitions ----
  // Two categories: CORE (always available) and SPECIAL (difficulty-specific).
  // Each day, 3-4 core activities are randomly selected, PLUS 1-2 special
  // activities that match today's difficulty. Total: 4-6 activities per day.
  //
  // Each activity has:
  //   id, name, emoji, short description
  //   effects per level: { moodDelta, excitementDelta, energyCost, trulyBeneficial }
  //   dialogues: response lines per difficulty (tone reveals whether it helped)
  //   dreamFragments: surreal imagery for dream generation
  //   category: "core" (shared) or difficulty ID (special)

  activities: [
    // ---- CORE activities (shared across all difficulties) ----
    {
      id: "read",
      name: "Read a Book",
      emoji: "📖",
      description: "Spend time with a good story",
      category: "core",
      levelEffects: {
        1: { moodDelta: 15, excitementDelta: 5,  energyCost: 0, beneficial: true },
        2: { moodDelta: 15, excitementDelta: 5,  energyCost: 15, beneficial: true },
        3: { moodDelta: 15, excitementDelta: 5,  energyCost: 15, beneficial: true }
      },
      dialogues: {
        exam:        "Reading for fun, not for a grade... I forgot this could feel good. The story pulls me somewhere else, and my brain finally stops calculating scores.",
        argument:    "This book is a good escape. I don't have to think about what happened. ... Actually, I feel a little calmer now.",
        lonely:      "The characters in this book feel like company right now. That sounds a bit sad, but... it helps. Like I'm not entirely alone.",
        overwhelmed: "I tried to read, but my mind kept jumping to everything I need to do. I read the same paragraph three times. It was... fine, I guess.",
        selfdoubt:   "The protagonist in this story also feels like an imposter. She overcomes it by the end. I'm not there yet, but it helps to see it on the page.",
        // Maya
        performance: "Reading about someone else's struggle reminds me — failure isn't just mine. Everyone falls. The book doesn't judge.",
        perfectionism: "The story isn't perfect. The prose is messy in places. And it's still beautiful. Maybe I don't need to be perfect either.",
        betrayal:    "I read to escape the team for a while. The characters in this book are loyal — no gossip, no backstabbing. A nice break from real people.",
        pressure:    "Reading takes me out of the race. No stopwatch. No ranking. Just words and time. This is what my brain needed.",
        identity:    "The protagonist is more than one thing — warrior, thinker, friend. That's what I want to be. Not just 'the runner.' This book reminded me I have layers.",
        // Kai
        creativeBlock: "I read someone else's creation. Their words flow so easily. I should be making, not consuming. But... their story planted a tiny seed. Maybe I'll water it later.",
        familyExpect: "The protagonist chose their own path, even when their family disagreed. It's fiction, but it feels like permission. Maybe my path can be mine too.",
        rejection:   "I read to forget the rejection. The story pulled me in, and for an hour I wasn't 'the rejected artist.' Just a reader. Sometimes stepping away is part of the process.",
        comparison:  "This book is imperfect. The pacing is off in chapter three. And it was published anyway. Imperfect things can still reach people. That's what I needed to hear.",
        lostInspiration: "I read something that made me feel... something. Not inspiration yet, but a flicker. Like a candle in a dark room. The story reminded me why I wanted to make things.",
        // Sora
        newSchool:   "I read in the library where no one talks. It's the first place here that felt like it could be mine. The books don't care that I'm new — they just wait.",
        culturalClash: "The book is about someone between two worlds. They find a way to belong to both without losing either. If fiction can imagine it, maybe reality can too.",
        homesick:    "I read a story set in a place like my old home. The descriptions were so familiar — the smells, the sounds. It felt like visiting, even if I can't go back yet.",
        maskWearing: "The protagonist hides who they are to survive. By the end, they stop hiding. I'm still in the middle of that story — still wearing the mask.",
        languageBarrier: "I read in my own language for the first time since I moved. The words fit perfectly — no translation, no simplification. My brain finally felt like it was home.",
        default:     "This chapter is exactly what I needed today... I feel calmer already."
      },
      dreamFragments: [
        "a library where the shelves dissolve into clouds",
        "words lifting from the page and rearranging into constellations",
        "a story that is writing itself, and you are a character in it"
      ]
    },
    {
      id: "walk",
      name: "Take a Walk",
      emoji: "🚶",
      description: "A quiet walk outside",
      category: "core",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: 5,  energyCost: 0, beneficial: true },
        2: { moodDelta: 10, excitementDelta: 5,  energyCost: 10, beneficial: true },
        3: { moodDelta: 10, excitementDelta: 5,  energyCost: 10, beneficial: true }
      },
      dialogues: {
        exam:        "The fresh air helps. I was spiraling about the exam, but out here with the wind and the trees, it feels... smaller. Not gone, but smaller.",
        argument:    "Walking alone gives me space to think. Maybe I was too harsh earlier. Or maybe they were. I'm not sure yet, but at least my head is clearer.",
        lonely:      "I walked past people and didn't say hi. Again. The quiet felt heavy today, not peaceful. I'm not sure this helped.",
        overwhelmed: "Just walking with no destination. One step, then another. My to-do list is still there, but it feels further away. That's enough for now.",
        selfdoubt:   "I walked for a while, but my thoughts just kept circling. 'Are you good enough? Do you deserve this?' The silence made it louder, not quieter.",
        // Maya
        performance: "I walked without timing myself. No pace, no distance — just movement. For once, my body belonged to me, not to my training log.",
        perfectionism: "I walked and didn't plan the route. Left turn, right turn, wherever. The imperfection felt like freedom.",
        betrayal:    "Walking alone, away from the team. The silence is different out here — not empty, just... mine. No one to betray me on this road.",
        pressure:    "No coach out here. No stopwatch. Just walking because I want to, not because I have to. My legs finally feel like mine again.",
        identity:    "I walked past the track and didn't stop. There's more to this campus than where I train. I saw a garden I never noticed. I'm more than one path.",
        // Kai
        creativeBlock: "I walked with no destination, and my mind started wandering too. Not ideas yet — just space. Empty space where ideas could go. I left the door open.",
        familyExpect: "Walking away from the house, away from the conversation about 'real careers.' Out here, the air doesn't judge my choices. The trees don't have opinions about art.",
        rejection:   "I walked and let the rejection fade with each step. It's still there, but further away. I can look at it from out here instead of inside it.",
        comparison:  "I walked away from the screen, away from their portfolio. My own path isn't theirs. The road I'm on looks different, and maybe that's not a flaw — maybe that's the point.",
        lostInspiration: "I walked and noticed things — a crack in the wall shaped like a river, a shadow that looked like a bird. Small things, but they made me look twice. Looking twice is how it starts.",
        // Sora
        newSchool:   "I walked around the campus and actually looked at it this time. Not just passing through — learning the shape. It's starting to feel less like someone else's school.",
        culturalClash: "I walked through the neighborhood and saw things from both cultures side by side — a temple next to a cafe. Maybe the clash isn't a problem — maybe it's the texture.",
        homesick:    "I walked to the bakery on the corner. It's not the one from home, but the bread is warm, and that's close enough. Small bridges between here and there.",
        maskWearing: "I walked alone, and for once I didn't perform. No smile for strangers, no nod of belonging. Just walking, quiet, real. The mask stays off when no one's watching.",
        languageBarrier: "Walking without talking. No need to find the right words. Just feet and ground and air. My body communicates fine — it's only my tongue that gets lost.",
        default:     "The breeze is nice. I don't have to talk to anyone out here."
      },
      dreamFragments: [
        "an endless road made of soft light, bending upward",
        "your footsteps leaving ripples in the ground, as if the earth were water",
        "the horizon folding back on itself, and you don't mind at all"
      ]
    },
    {
      id: "music",
      name: "Listen to Music",
      emoji: "🎵",
      description: "Put on some soft songs",
      category: "core",
      levelEffects: {
        1: { moodDelta: 12, excitementDelta: 10, energyCost: 0, beneficial: true },
        2: { moodDelta: 12, excitementDelta: 10, energyCost: 12, beneficial: true },
        3: { moodDelta: 12, excitementDelta: 10, energyCost: 12, beneficial: true }
      },
      dialogues: {
        exam:        "This song has nothing to do with exams. That's exactly the point. For three minutes, I was somewhere else entirely.",
        argument:    "The lyrics feel like they were written for today. Music always seems to know what to say when I can't find the words myself.",
        lonely:      "I put on my headphones and closed the door on the world. ... But closing the door also means no one can come in. I feel more alone than before.",
        overwhelmed: "I let the sound wash over me without trying to think. For once, my brain stopped racing. That's... rare.",
        selfdoubt:   "This artist is so talented. Why can't I be like that? The music is beautiful, but it just makes me feel worse about myself.",
        // Maya
        performance: "This song has no score, no ranking. It just exists and it's good. Why can't I be like that — just exist, without being measured?",
        perfectionism: "The song has a wrong note in it. I noticed, but then... it kind of works? Imperfections can be part of the beauty. I need to remember that.",
        betrayal:    "I put my headphones on and blocked out the world. The team, the gossip — all silenced. But I also silenced the people who actually care about me.",
        pressure:    "Loud music, no thoughts. For ten minutes, nobody wanted anything from me. The song didn't ask me to improve. It just played.",
        identity:    "This playlist has nothing to do with training. It's the music I listen to when I'm just Maya, not Athlete Maya. These songs know a side of me the track doesn't.",
        // Kai
        creativeBlock: "Music is someone else's creation. Listening feels passive when I should be active. But the melody gave me a structure — a shape. Maybe my block isn't about ideas, it's about shape.",
        familyExpect: "This song was made by someone who chose art over safety. Their parents probably disagreed too. The song exists anyway. Proof that you can make things even when people tell you not to.",
        rejection:   "I put on a song that was rejected by every label before it became a hit. Rejection isn't the end. Sometimes it's the wrong door, not a locked building.",
        comparison:  "Their music is polished. Mine is raw. But this song I'm listening to is raw too, and I love it. Raw isn't worse — it's just different.",
        lostInspiration: "I heard a song that sounded like the feeling I used to have when I made things. The music didn't give me an idea, but it gave me a feeling. And feelings are where ideas come from.",
        // Sora
        newSchool:   "I put on my headphones and the school noise disappeared. For twenty minutes, I was just listening. Then someone sat next to me and asked what I was playing. A small, real connection.",
        culturalClash: "The song mixes two traditions — old rhythm, new melody. It doesn't choose one. It's both at once, and it sounds like something new. That's what I want to be.",
        homesick:    "This song was playing in the cafe near my old house. Hearing it here feels like a thread between the two places — thin, but real. I'm still connected.",
        maskWearing: "The lyrics are about being seen for who you really are. I want that. But I keep singing along in private, never sharing the song. The mask covers even my taste in music.",
        languageBarrier: "Music doesn't need translation. The feeling passes through without words. For three minutes, I communicated exactly what I meant, and no one had to translate it.",
        default:     "This song always reminds me of quiet mornings."
      },
      dreamFragments: [
        "a river made of sound, carrying you gently downstream",
        "notes detaching from the air and becoming small luminous fish",
        "a melody that has been humming since before you were born"
      ]
    },
    {
      id: "chores",
      name: "Help with Chores",
      emoji: "🧹",
      description: "Do something useful at home",
      category: "core",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: 5,  energyCost: 0, beneficial: true },
        2: { moodDelta: 10, excitementDelta: 5,  energyCost: 12, beneficial: true },
        3: { moodDelta: 10, excitementDelta: 5,  energyCost: 12, beneficial: true }
      },
      dialogues: {
        exam:        "Cleaning my desk felt symbolic — clearing space to think. Small, but it helped more than I expected.",
        argument:    "Doing something physical and simple helped me stop replaying the argument in my head. My hands were busy, so my brain could rest.",
        lonely:      "The house was quiet while I cleaned. Not the same as having someone here, but the routine felt warm. Like I was taking care of myself.",
        overwhelmed: "I started with just one thing: folding laundry. One task done. Then another. It's the first time today I felt like I could finish something.",
        selfdoubt:   "At least I did something useful today. It's a small thing, but small things count. I'm holding onto that.",
        // Maya
        performance: "I cleaned my room instead of analyzing my race. The broom doesn't care about my time. The floor just gets clean. Simple, done, no score.",
        perfectionism: "I swept the floor and — for once — didn't go back to check if I missed a spot. It's clean enough. 'Enough' is a word I need to learn.",
        betrayal:    "Physical work keeps my hands busy and my mind off the betrayal. Sweep, wipe, fold. The chores don't gossip. They just need doing.",
        pressure:    "One small task with a clear end: the dishes are done. No one graded me. No one said 'you could do better.' It's finished, and that's enough.",
        identity:    "I made the kitchen neat. Not because I was told to — because I wanted a space that reflects the part of me that isn't about performance. Quiet. Orderly. Mine.",
        // Kai
        creativeBlock: "I did something physical and simple. Fold, stack, done. No creativity required, but completing a task felt like proof that I can still finish things.",
        familyExpect: "I cleaned my workspace. The desk where I make things — I made it tidy, not because they'd approve, but because I deserve a clean space. This is my territory.",
        rejection:   "Chores are small but complete. The rejection was big and unresolved. Doing something small and finished helped me remember that not everything ends in 'no.'",
        comparison:  "I organized my supplies and found old sketches I'd forgotten about. Some of them are good — not as good as their portfolio, but good for me. I have a history of making things.",
        lostInspiration: "I swept the floor and found a sketch I dropped last month. It was unfinished, but the beginning was strong. The beginning is still there. I just need to find the rest.",
        // Sora
        newSchool:   "I tidied my new room. Making a space mine — that's the first step to belonging. The desk is where I'll study, the bed where I'll sleep. It's mine now.",
        culturalClash: "I cleaned the kitchen the way my family does it — specific order, specific method. It felt like home inside a foreign place. My routines are portable.",
        homesick:    "I did chores the way Mom taught me. Same order, same care. Her voice was in my head, guiding my hands. The distance shrinks when I do things the way she showed me.",
        maskWearing: "Chores are honest work. No pretending, no performing. The floor gets clean because you sweep it. No mask needed for folding laundry.",
        languageBarrier: "Chores don't require words. Sweep, fold, wipe — the actions speak for themselves. For an hour, I was competent and complete, and I didn't need language to prove it.",
        default:     "At least I'm doing something useful. It feels grounding."
      },
      dreamFragments: [
        "rooms folding into themselves like origami",
        "dust motes rising and becoming a galaxy of small bright stars",
        "a broom sweeping the sky clean, stroke by stroke"
      ]
    },
    {
      id: "game",
      name: "Play a Game",
      emoji: "🎮",
      description: "Have some fun on screen",
      category: "core",
      levelEffects: {
        1: { moodDelta: 12, excitementDelta: 20, energyCost: 0, beneficial: true },
        2: { moodDelta: 12, excitementDelta: 20, energyCost: 18, beneficial: true },
        3: { moodDelta: 5,  excitementDelta: 20, energyCost: 18, beneficial: false }
      },
      dialogues: {
        exam:        "For an hour I forgot about the exam. Then it hit me again — guilt and dread at once. The escape was nice, but now I feel worse.",
        argument:    "Smashing through levels felt satisfying. But I didn't process anything. The argument is still there, waiting.",
        lonely:      "Online matches mean I'm technically with people. But no one talks, and when the match ends, they're gone. It's a crowded kind of lonely.",
        overwhelmed: "This is the opposite of productive. But my brain needed to shut off... I think? Now I feel guilty about the time I wasted.",
        selfdoubt:   "I won a match and felt good for about five minutes. Then I lost the next one and felt terrible. My self-worth tied to a game score — that's not great.",
        // Maya
        performance: "I played a game and won. It felt good for five minutes. Then I remembered — real competition isn't a game. Escaping doesn't erase the failure.",
        perfectionism: "I kept restarting the level until I got a perfect run. Three hours. I didn't have fun — I just couldn't accept anything less. I brought the problem with me.",
        betrayal:    "Online matches with strangers. No loyalty required, no trust expected. It's safe — but also empty. The people who leave when the match ends aren't friends.",
        pressure:    "I played to shut my brain off. No coach, no expectations. But the guilt came right back — 'you should be training.' I can't escape the pressure, even in a game.",
        identity:    "I played and for a moment I wasn't 'the athlete' — I was just someone having fun. Then my teammate messaged me about tomorrow's practice, and the identity crashed back in.",
        // Kai
        creativeBlock: "I played instead of creating. The game was designed by someone — they had the ideas I can't find. Playing their creation instead of making mine... it's escape, not progress.",
        familyExpect: "I played a game to avoid thinking about what my parents said. It worked for an hour. Then the real world came back. Escaping doesn't change expectations.",
        rejection:   "I played to forget the rejection. Then I lost the game and felt rejected again. Different context, same feeling. Escaping one 'no' by finding another — that's not a strategy.",
        comparison:  "The game I'm playing was made by a team of experts. I'm one person with a sketchbook. Comparing my solo work to a team production... that's not fair to me.",
        lostInspiration: "The game is creative — someone designed every level, every character. That used to inspire me. Now it just reminds me I'm not making anything. The gap feels enormous.",
        // Sora
        newSchool:   "I played online and actually talked to someone — another transfer student. They understood what it's like to be new. The game was just the excuse; the connection was real.",
        culturalClash: "The game is from here. My friends at home play different games. Learning this one felt like learning the culture from the inside, not just watching from outside.",
        homesick:    "I played the game I used to play with my old friends. The mechanics are the same, but I'm alone this time. Familiar and heartbreaking at once.",
        maskWearing: "Online, no one sees my face. I can be whoever I want. But I chose to be honest in the chat — said I'm new, said I'm figuring things out. The mask came off in the safest place.",
        languageBarrier: "The game uses symbols instead of words. I understood it perfectly — no translation needed. There are whole languages that don't use sentences, and I speak one of them.",
        default:     "That was really fun! I almost forgot about everything else for a while."
      },
      dreamFragments: [
        "pixels bleeding through the screen and painting the world in 8-bit colors",
        "a level that loops forever, but you're not frustrated — you're hypnotized",
        "respawning as someone else, in a world that runs on different rules"
      ]
    },
    {
      id: "sunset",
      name: "Watch the Sunset",
      emoji: "🌇",
      description: "Sit quietly and watch the sky change",
      category: "core",
      levelEffects: {
        1: { moodDelta: 8, excitementDelta: 3,  energyCost: 0, beneficial: true },
        2: { moodDelta: 8, excitementDelta: 3,  energyCost: 8,  beneficial: true },
        3: { moodDelta: 8, excitementDelta: 3,  energyCost: 8,  beneficial: true }
      },
      dialogues: {
        exam:        "The sky was beautiful tonight. For a few minutes, I stopped thinking about anything. Just colors. Just light.",
        argument:    "Watching something so big and slow made the argument feel smaller. The sky doesn't judge. It just changes.",
        lonely:      "I sat alone watching the sunset. It was peaceful, but also... proof that I was alone. The beauty didn't fill the quiet.",
        overwhelmed: "Ten minutes of stillness. That's all I gave myself, and it was enough. The sunset doesn't ask anything from you.",
        selfdoubt:   "The sunset doesn't have to prove it's beautiful. It just is. I want to be like that — just exist, without needing to justify it.",
        // Maya
        performance: "The sky didn't perform today. It just changed colors because that's what it does. No score, no audience, no failure. Just beauty happening. I want to be like that.",
        perfectionism: "Every sunset is different, and none of them are 'perfect.' They're just what they are. And people love them anyway. Maybe I don't need to be perfect to be loved.",
        betrayal:    "The sunset doesn't lie. It doesn't pretend to be something it's not. After the betrayal, I need something honest — even if it's just the sky.",
        pressure:    "Ten minutes of sky. No demands. The sunset doesn't tell me to push harder. It just shows me that the day ends, and that's okay.",
        identity:    "The sunset has no label. It's not 'the athletic sunset' or 'the artistic sunset.' It's just beautiful. I want to be like that — just me, without a category.",
        // Kai
        creativeBlock: "The sky created something tonight without effort, without planning. Just colors appearing. Maybe creation doesn't always need to be forced. Maybe sometimes you just watch, and the making happens later.",
        familyExpect: "The sunset doesn't have a career. It doesn't need to be 'practical.' It just exists, and it's the most beautiful thing I've seen today. Art isn't less real than business.",
        rejection:   "The sunset isn't curated or selected by a committee. It just happens, and it's enough. Rejection is someone's opinion, not a fact about my work.",
        comparison:  "Every sunset is different, and no one compares them. Tonight's sky isn't 'worse than yesterday's.' It's just today's. My work is today's. It doesn't need to beat anyone else's.",
        lostInspiration: "The sunset made me feel something small and warm. Not a full idea, but a feeling. Like the first note of a song I haven't written yet. It's there, waiting. I just have to listen.",
        // Sora
        newSchool:   "The sunset is the same here as it was at home. The sky doesn't change when you move. Some things are universal, and that's comforting. The day ends the same way everywhere.",
        culturalClash: "The sunset looks different from here — more buildings in the way, different horizon. But the colors are the same. The light doesn't care about culture. Beauty is a shared language.",
        homesick:    "I watched the sunset and thought of the one I'd watch from my old window. They're the same sun, just seen from a different angle. I'm still under the same sky. That helps.",
        maskWearing: "No one is watching me watch the sunset. I don't have to react the 'right' way. I just sit and feel it. The mask stays off when the audience is gone.",
        languageBarrier: "The sunset doesn't need words. It communicates entirely through color. For ten minutes, I understood something perfectly, and I didn't need language to hold it.",
        default:     "The colors were incredible. I feel a little lighter."
      },
      dreamFragments: [
        "the sun melting into the horizon and becoming a warm golden river",
        "colors that don't exist in the waking world — a sky painted by someone who never learned the rules",
        "light that bends backwards, turning night into day inside your chest"
      ]
    },

    // ---- SPECIAL activities (difficulty-specific) ----
    // These only appear when today's difficulty matches their category.
    // They address the specific problem directly — but they might be uncomfortable.

    {
      id: "study",
      name: "Study for the Exam",
      emoji: "📝",
      description: "Face the exam material directly",
      category: "exam",
      levelEffects: {
        1: { moodDelta: 5,  excitementDelta: 15, energyCost: 0,  beneficial: true },
        2: { moodDelta: 5,  excitementDelta: 15, energyCost: 25, beneficial: true },
        3: { moodDelta: 5,  excitementDelta: 15, energyCost: 25, beneficial: true }
      },
      dialogues: {
        exam:        "I opened the textbook and actually studied. It was painful at first — every wrong answer stung. But by the end, I felt like I was taking back some control. The exam hurt me, but studying tonight means I'm not just running from it.",
        argument:    "I tried to study but kept thinking about the fight. My friend's words echoed louder than any formula. Can't focus.",
        lonely:      "Studying alone is just... more alone time. My notebook doesn't talk back. It's productive, but it doesn't fill the gap.",
        overwhelmed: "Adding MORE work on top of everything? I sat down, opened the book, and immediately felt my chest tighten. This was the wrong choice today.",
        selfdoubt:   "Every question I got wrong was proof I'm not good enough. Study sessions are supposed to help, but they just exposed every gap. I feel worse.",
        default:     "I went through the material. It was hard, but at least I'm doing something about it."
      },
      dreamFragments: [
        "an exam paper where the questions keep rewriting themselves into things you actually care about",
        "numbers breaking free from equations and forming a ladder you can climb",
        "a classroom where everyone gets the same answer and it's always 'you tried'"
      ]
    },
    {
      id: "letter",
      name: "Write a Letter",
      emoji: "💌",
      description: "Write to the friend you argued with",
      category: "argument",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: 8,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 10, excitementDelta: 8,  energyCost: 15, beneficial: true },
        3: { moodDelta: 10, excitementDelta: 8,  energyCost: 15, beneficial: true }
      },
      dialogues: {
        exam:        "I wrote a letter about how I feel about the exam. It wasn't to anyone — just to myself. Seeing it on paper made it... more manageable. Like I filed it somewhere instead of carrying it.",
        argument:    "I wrote down what I really wanted to say. Not the angry version — the honest one. I haven't sent it yet, but writing it made me realize I miss them more than I'm mad at them. That's something.",
        lonely:      "I wrote a letter to no one. Just words on paper. It felt like talking without the risk of being heard — safe, but also... still alone.",
        overwhelmed: "Writing felt like adding another task. I stared at the blank page and it stared back. I wrote one sentence and stopped. Too much already.",
        selfdoubt:   "I wrote down what I'm afraid people think about me. Then I wrote what I wish they thought. The gap between them is enormous. But seeing it — that's a start.",
        default:     "I put my thoughts on paper. It felt like I was finally saying something real."
      },
      dreamFragments: [
        "words floating from paper and becoming bridges between two islands",
        "a letter that folds itself into a bird and flies toward a distant window",
        "ink dissolving into water and carrying messages you never sent"
      ]
    },
    {
      id: "family",
      name: "Visit Family",
      emoji: "🏠",
      description: "Go see someone at home",
      category: "lonely",
      levelEffects: {
        1: { moodDelta: 12, excitementDelta: 8,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 12, excitementDelta: 8,  energyCost: 12, beneficial: true },
        3: { moodDelta: 12, excitementDelta: 8,  energyCost: 12, beneficial: true }
      },
      dialogues: {
        exam:        "I visited home, but my mind was still on the exam. The noise and warmth of family was nice, but I kept spacing out. They noticed and worried. That made me feel worse.",
        argument:    "Being around family made me think about the friend I fought with. Family arguments, friend arguments... it all just reminds me that relationships are complicated.",
        lonely:      "I went home and just sat in the kitchen while Mom cooked. We didn't talk much, but she was THERE. The house felt full. I didn't feel invisible for once. This was exactly what I needed.",
        overwhelmed: "I went home, and everyone needed something from me. 'Can you help with this? Did you finish that?' Being around people meant more demands. I came back feeling more overwhelmed.",
        selfdoubt:   "My family sees me differently than I see myself. They don't see the doubt — they see someone trying. Mom said, 'You're doing better than you think.' I almost believed her.",
        default:     "Home feels... stable. Like something that doesn't change no matter what happens outside."
      },
      dreamFragments: [
        "a kitchen that stretches to the horizon, always warm, always smelling of something cooking",
        "familiar voices blending into a song that has been sung since before you were born",
        "a house that grows new rooms every time you need a place to hide"
      ]
    },
    {
      id: "nap",
      name: "Take a Nap",
      emoji: "🛋️",
      description: "Just rest for a while",
      category: "overwhelmed",
      levelEffects: {
        1: { moodDelta: 8,  excitementDelta: -5, energyCost: 0,  beneficial: true },
        2: { moodDelta: 8,  excitementDelta: -5, energyCost: 0,  beneficial: true },
        3: { moodDelta: 8,  excitementDelta: -5, energyCost: 0,  beneficial: true }
      },
      dialogues: {
        exam:        "I took a nap instead of studying. When I woke up, the exam anxiety was still there, plus guilt for wasting time. The nap didn't erase anything — it just paused it.",
        argument:    "I slept to avoid thinking about the argument. It worked for an hour. Then I woke up and the first thought was the fight. Avoidance doesn't fix things.",
        lonely:      "I fell asleep alone. When I woke up, I was still alone. The room was quieter than before. A nap doesn't bring people.",
        overwhelmed: "I closed my eyes and everything stopped. No tasks. No messages. No noise. Just... nothing for thirty minutes. When I woke, the list was still there, but I had enough energy to face it. This was the right choice today.",
        selfdoubt:   "I slept because I didn't want to face myself. The nap was a break, not a fix. But maybe breaks count too.",
        default:     "A short nap. My body needed it, I think."
      },
      dreamFragments: [
        "a hammock suspended between two clouds, rocking gently",
        "a room where time doesn't move — the clock is painted on the wall and the hands are decorative",
        "softness everywhere — the floor, the walls, the air itself is made of pillows"
      ]
    },
    {
      id: "photos",
      name: "Look at Old Photos",
      emoji: "📷",
      description: "Remember who you used to be",
      category: "selfdoubt",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: 5,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 10, excitementDelta: 5,  energyCost: 8,  beneficial: true },
        3: { moodDelta: 10, excitementDelta: 5,  energyCost: 8,  beneficial: true }
      },
      dialogues: {
        exam:        "Photos from before the exam stress. I was smiling in every one. Looking at them made me realize — I was happy before this, and I can be happy after it. The exam is a chapter, not the whole book.",
        argument:    "I found a photo of me and my friend from last year. We looked so happy. It reminded me why the friendship matters more than the fight. I want to fix this.",
        lonely:      "Photos of people I used to be close to. Some I haven't talked to in months. Looking at them made me miss them more, not less. The distance feels real now.",
        overwhelmed: "Looking at photos felt like adding 'organize photos' to my mental to-do list. I couldn't just enjoy them — my brain was already planning the next task.",
        selfdoubt:   "I saw a photo of myself from two years ago. I looked confident. Happy. Did that version of me disappear, or is it still somewhere inside? Looking at old proof that I was okay... helps me believe I can be okay again.",
        default:     "I used to be different. Or maybe I'm still that person, just buried under everything right now."
      },
      dreamFragments: [
        "photographs that keep developing, showing versions of you that haven't happened yet",
        "a gallery of moments, each one glowing softly, each one saying 'this was real'",
        "your younger self stepping out of a frame and walking beside you"
      ]
    },
    {
      id: "cook",
      name: "Cook a Meal",
      emoji: "🍳",
      description: "Make something warm to eat",
      category: "core",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: 5,  energyCost: 0, beneficial: true },
        2: { moodDelta: 10, excitementDelta: 5,  energyCost: 10, beneficial: true },
        3: { moodDelta: 10, excitementDelta: 5,  energyCost: 10, beneficial: true }
      },
      dialogues: {
        exam:        "Cooking took my hands and my attention away from the exam. The smell of something I made myself — it's a small victory, but it tastes real.",
        argument:    "I cooked something warm. The process was simple and honest — chop, stir, season. No ambiguity, no subtext. The food doesn't argue back. That felt good.",
        lonely:      "I cooked for just myself. One plate, one chair. The kitchen was warm but the table felt too big. The food was good, but eating alone is... a particular kind of quiet.",
        overwhelmed: "One task with a clear beginning and end: cook, eat, done. The first thing I actually completed today. And it tasted good. Small, complete, real.",
        selfdoubt:   "I made something from scratch and it turned out okay. I can still create things that work. That's a fact, not a feeling — and facts are harder to doubt.",
        // Maya
        performance: "I cooked something and it turned out okay. Not great — okay. For once, 'okay' was enough. Not everything needs to be a personal best.",
        perfectionism: "I followed the recipe but skipped the garnish. The meal was still good. Sometimes 'good enough' is genuinely good.",
        betrayal:    "Cooking is honest — you follow steps and get a result. No hidden motives, no betrayal. The onions don't gossip about you behind your back.",
        pressure:    "I made dinner. Nobody told me how to do it. No coach, no corrections. I just... made something. And it was mine.",
        identity:    "I cooked a meal that has nothing to do with athlete meal plans. Something I actually like. This is the Maya that exists outside the track — the one who seasons things with heart.",
        // Kai
        creativeBlock: "I made something. Not art — just dinner. But the process is the same: combine, transform, create. The block is in my head, not in my hands. My hands still know how to make things.",
        familyExpect: "I cooked the way I wanted — experimental, a little weird, definitely not 'practical.' It tasted good. My way of doing things works. Not always, but sometimes. And sometimes is enough.",
        rejection:   "I made something from scratch and it turned out well. No committee approved it. No exhibition selected it. I just made it, and it was good. The kitchen doesn't reject me.",
        comparison:  "I cooked a simple meal. Not fancy, not impressive — just warm and real. Their portfolio is fancy. My sketchbook is warm and real. Different kinds of good. I keep forgetting that.",
        lostInspiration: "Cooking is creating with immediate results. I made something and it existed right away. No waiting, no doubt. Maybe I need more of that immediacy — small creations that remind me I'm still a maker.",
        // Sora
        newSchool:   "I cooked something from my family's recipe. The smell filled the new kitchen, and for a moment this place smelled like home. Food is how I carry my roots into new places.",
        culturalClash: "I cooked a dish that combines ingredients from both cultures. It tasted like something that doesn't exist in either place alone — only in the space between. That's where I live too.",
        homesick:    "I cooked exactly what Mom would make on a Sunday. The taste was right, even if the kitchen is different. My tongue remembers home better than my eyes do.",
        maskWearing: "I cooked honestly — no pretending to prefer local food. I made what I actually like. The kitchen is where the mask comes off because the food has to be real.",
        languageBarrier: "The recipe is in my language. I read it without translating, cooked without explaining. The food spoke for itself — no words, just taste. Some things don't need translation.",
        default:     "The kitchen smells good. Something I made with my own hands."
      },
      dreamFragments: [
        "a pot that simmers with starlight instead of soup",
        "spices that open into tiny gardens when they hit the pan",
        "a table that stretches to fit however many people show up"
      ]
    },
    {
      id: "friend",
      name: "Talk to a Friend",
      emoji: "💬",
      description: "Catch up with someone",
      category: "core",
      levelEffects: {
        1: { moodDelta: 8,  excitementDelta: 15, energyCost: 0, beneficial: true },
        2: { moodDelta: 8,  excitementDelta: 15, energyCost: 20, beneficial: true },
        3: { moodDelta: 5,  excitementDelta: 15, energyCost: 20, beneficial: false }
      },
      dialogues: {
        exam:        "They tried to cheer me up about the exam. I smiled and nodded, but inside I was still replaying the score. Socializing takes so much energy when I'm like this.",
        argument:    "Talking to another friend about the argument just made me more upset. I kept venting, and now I feel drained and the problem isn't any closer to solved.",
        lonely:      "I reached out, and they responded. We talked about nothing important for half an hour. But for those thirty minutes, I wasn't invisible. That meant everything.",
        overwhelmed: "They asked how I was and I said 'fine.' I couldn't actually talk about how overwhelmed I am. Putting on a normal face just made me more tired.",
        selfdoubt:   "They told me they see me differently than I see myself. That the things I think are weaknesses, they think are strengths. I don't fully believe it yet... but it helps to hear someone say it.",
        // Maya
        performance: "They tried to comfort me about the competition. 'You'll do better next time.' But 'next time' is exactly the pressure I'm trying to escape. I needed a friend, not a coach.",
        perfectionism: "They told me I'm already good enough. I argued with them for twenty minutes about what 'good enough' means. They didn't give up on me. That means something.",
        betrayal:    "I talked to a friend outside the team. Someone who doesn't know the gossip. They just listened. No judgment, no sides. Just 'I'm here.' That's what trust actually looks like.",
        pressure:    "I told my friend how much pressure I'm under. They said, 'You don't have to push all the time.' It's the first time anyone said that instead of 'you could do more.'",
        identity:    "My friend knows me beyond the track. We talked about books, about cooking, about nothing related to sport. For an hour, I was just Maya. That hour mattered.",
        // Kai
        creativeBlock: "They asked what I'm working on, and I had to say 'nothing.' The word felt like failure. But they said, 'Blocks happen. You'll find it again.' They didn't make me feel broken.",
        familyExpect: "I told my friend what my parents said. They replied, 'Your art isn't worthless just because it doesn't make money.' Hearing someone else say it made it more real.",
        rejection:   "My friend saw the rejection email too. They said, 'This is one door. There are others.' It's what everyone says, but coming from them, I almost believed it.",
        comparison:  "I showed my friend my work. They didn't compare it to anyone else's. They just said, 'This is yours. That's what makes it matter.' No ranking. No score. Just appreciation.",
        lostInspiration: "We talked about why we started making things in the first place. My reason was simpler than I remembered — I just liked it. Maybe I don't need a grand inspiration. Maybe liking it is enough.",
        // Sora
        newSchool:   "I finally talked to someone — not just 'hi,' but a real conversation. They asked where I'm from, and I told them. They said, 'That sounds interesting.' Not weird. Not foreign. Interesting.",
        culturalClash: "My friend is from here, and they asked about my traditions. I explained, and they listened without judging. When two people actually listen, the clash becomes a conversation.",
        homesick:    "I told my friend I miss home. They said, 'You can miss it and still like here.' That's the first time anyone said both were allowed. I don't have to choose.",
        maskWearing: "I told my friend the truth — that I've been pretending to fit in. They said, 'I pretend too. Everyone does a little.' The mask isn't unique. That makes it easier to take off.",
        languageBarrier: "We talked, and I struggled with the words. But they waited. They didn't rush me or simplify. They just gave me space to find the right phrase. Patience is a kind of translation.",
        default:     "It was... nice to see them. A little overwhelming, but nice."
      },
      dreamFragments: [
        "two voices merging into one, then splitting into harmony",
        "a face made of warm light, speaking in a language you almost understand",
        "your shadow and another shadow tangling together, then drifting apart"
      ]
    },
    {
      id: "shower",
      name: "Take a Long Shower",
      emoji: "🚿",
      description: "Let the water wash over you",
      category: "core",
      levelEffects: {
        1: { moodDelta: 8,  excitementDelta: 3,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 8,  excitementDelta: 3,  energyCost: 5,  beneficial: true },
        3: { moodDelta: 8,  excitementDelta: 3,  energyCost: 5,  beneficial: true }
      },
      dialogues: {
        exam:        "The water drowned out everything — including my thoughts about the exam. For ten minutes, I was just a body under water. Clean. Simple. No score attached.",
        argument:    "I stood under the water and let it hit my face. The argument replayed, but with the sound of water it felt distant, like hearing it through a wall. By the time I got out, I could think more clearly.",
        lonely:      "The shower is warm and private. Nobody can reach you here. But nobody can reach you here. That's both the comfort and the problem.",
        overwhelmed: "I just stood there. Water running. Not thinking. Not planning. Just existing for five minutes. My body relaxed before my brain did, and then my brain followed.",
        selfdoubt:   "I scrubbed hard, like I was trying to wash the doubt off. It didn't work — you can't clean your thoughts. But my skin felt new, and that's something.",
        // Maya
        performance: "The water washed the day off me — the race, the ranking, the faces watching. For ten minutes, I was just a body under water. No performance. Just clean.",
        perfectionism: "I scrubbed until my skin was raw, then stopped. Not because I was done — because I realized I was trying to wash away imperfection that doesn't live on my skin. It lives in my head.",
        betrayal:    "The shower is private. No teammates, no whispers. The water is loud enough to drown out their voices. I stood there and just let it fall.",
        pressure:    "I stood under the water and let it hit my shoulders. The pressure I've been carrying — it's not water pressure, but at least this kind I can turn off.",
        identity:    "Clean. Just clean. No sport-specific soap, no recovery routine. Just water and warmth. The most basic self-care, and it reminded me I'm a person first.",
        // Kai
        creativeBlock: "I stood under the water and let my mind go blank. Not forcing ideas, not fighting the block — just being. Sometimes the block breaks when you stop pushing against it.",
        familyExpect: "I washed off the conversation — their words, their expectations. For ten minutes, I'm just Kai under water. Not 'the art student with no future.' Just a person, clean and quiet.",
        rejection:   "The water washed the day off me. The rejection is still there, but my skin feels new. A fresh surface. Maybe tomorrow I start on a fresh canvas too.",
        comparison:  "I scrubbed away the comparison. Their portfolio, their effortless brilliance — it's not on my skin. It's in my head, and the shower can't reach that. But at least my body feels lighter.",
        lostInspiration: "Warm water, closed eyes. For a moment, I felt the way I used to feel before I made things — open, empty, ready. The emptiness isn't a void. It's a space for something new.",
        // Sora
        newSchool:   "The shower in the new dorm is different — the water pressure, the temperature. But the feeling is the same. Clean. Private. Mine. The bathroom is the first room that truly belongs to me here.",
        culturalClash: "I stood under the water and let both cultures wash over me. Not choosing one. Under the water, I'm not from anywhere — I'm just a person getting clean.",
        homesick:    "The shower here has different tiles than home. Different soap. But the warmth is the same. Water doesn't have a nationality. Some comforts are universal.",
        maskWearing: "In the shower, there's no one to perform for. The mask literally washes off. For ten minutes, I'm just me — water, skin, breath. No pretense. No script.",
        languageBarrier: "No words needed. Just water and warmth. The most universal experience — everyone, everywhere, showers. For ten minutes, I'm exactly like everyone else, and that's not a bad thing.",
        default:     "The water was warm. I feel cleaner — inside and outside."
      },
      dreamFragments: [
        "water that flows upward, carrying you gently toward a sky made of steam",
        "droplets that freeze mid-air and become glass beads you can walk through",
        "rain falling inside a room, but it feels warm and safe instead of cold"
      ]
    },

    // ---- MAYA's special activities ----
    {
      id: "practice",
      name: "Practice Sport",
      emoji: "🏃",
      description: "Train harder, push further",
      category: "performance",
      levelEffects: {
        1: { moodDelta: 5,  excitementDelta: 20, energyCost: 0,  beneficial: false },
        2: { moodDelta: 5,  excitementDelta: 20, energyCost: 25, beneficial: false },
        3: { moodDelta: 5,  excitementDelta: 20, energyCost: 25, beneficial: false }
      },
      dialogues: {
        performance: "I trained again. More reps, more laps. My body knows what to do — but my heart isn't in it. I'm running from the failure, not toward a solution. More practice won't heal what actually hurts.",
        perfectionism: "I practiced until every movement was perfect. Three hours. I should feel satisfied, but I just feel exhausted. The perfection I chase is never enough — there's always one more rep.",
        betrayal:    "I went to practice and saw my teammate there. The one who betrayed me. We didn't speak. Training with the person who broke my trust — that's not healing, that's torture.",
        pressure:    "Another training session. Another voice telling me to push harder. I did push — and then I pushed too far. My body hurts, my mind is empty. This is what pressure looks like when you obey it.",
        identity:    "I practiced because that's what I do. That's what I'm known for. But today I asked myself — do I train because I love it, or because I don't know who I am without it?",
        default:     "I trained today. My body feels worked, but my mind is somewhere else."
      },
      dreamFragments: [
        "a track that spirals upward into the clouds, each lap taking you higher",
        "your heartbeat becoming a drum that sets the rhythm of the entire world",
        "crossing a finish line that opens into a field of wildflowers"
      ]
    },
    {
      id: "stretch",
      name: "Stretch & Meditate",
      emoji: "🧘",
      description: "Slow down, breathe deeply",
      category: "perfectionism",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: -5, energyCost: 0,  beneficial: true },
        2: { moodDelta: 10, excitementDelta: -5, energyCost: 10, beneficial: true },
        3: { moodDelta: 10, excitementDelta: -5, energyCost: 10, beneficial: true }
      },
      dialogues: {
        performance: "I stretched instead of training. No competition, no timer. Just my body breathing and lengthening. For once, movement without measurement. This is what my muscles actually needed.",
        perfectionism: "I stretched slowly, no rushing, no correcting. My body isn't perfect — one shoulder is tighter than the other, my balance is off. And that's fine. Stretching taught me to accept imperfection instead of fix it.",
        betrayal:    "I did some gentle stretching and tried to meditate. The meditation was hard — my mind kept going back to the betrayal. But my body felt better. One thing at a time.",
        pressure:    "Stretching is the opposite of pushing. No force, just release. My coach never tells me to stretch — only to push. But releasing is what I needed today. My body thanked me.",
        identity:    "I stretched and noticed things about my body I never pay attention to — how I hold tension in my jaw, how my left side is different from my right. My body is more than a machine for sport.",
        default:     "I stretched and felt my body unwind. Simple, but it worked."
      },
      dreamFragments: [
        "a hammock made of light, swinging between two clouds",
        "your spine becoming a column of warm water, each vertebra floating free",
        "a room where everything moves at half speed and the quiet is delicious"
      ]
    },
    {
      id: "teamTalk",
      name: "Talk to Teammates",
      emoji: "🤝",
      description: "Check in with the team",
      category: "betrayal",
      levelEffects: {
        1: { moodDelta: 8,  excitementDelta: 15, energyCost: 0,  beneficial: false },
        2: { moodDelta: 8,  excitementDelta: 15, energyCost: 20, beneficial: false },
        3: { moodDelta: 8,  excitementDelta: 15, energyCost: 20, beneficial: false }
      },
      dialogues: {
        performance: "The team talked about the competition. They were supportive — 'you'll get them next time.' But talking about it just made me think about it more. Sometimes support feels like pressure.",
        perfectionism: "My teammates noticed I was overworking. They told me to ease up. It's ironic — they want me to be less perfect, but I can't stop. Their words were kind, but my brain didn't listen.",
        betrayal:    "I went to talk to the team. The person who betrayed me was there, laughing like nothing happened. I couldn't say what I needed to say. Being around the source of betrayal doesn't heal it — it reinforces it.",
        pressure:    "The team meeting was about 'next goals.' More targets. More expectations. I sat there and felt the pressure double. Today I needed distance, not more drive.",
        identity:    "I talked to my teammates, and they only wanted to talk about training. The sport. I tried to mention a book I read, and they changed the subject back to the next race. They only see one part of me.",
        default:     "I spent time with the team. It was... a lot. But we're in this together."
      },
      dreamFragments: [
        "a locker room where every jersey has a different name but they're all yours",
        "whistles echoing in a stadium that has no spectators",
        "a relay race where you keep passing the baton to yourself"
      ]
    },
    {
      id: "restDay",
      name: "Skip Training, Just Rest",
      emoji: "🛋️",
      description: "Take a real break from sport",
      category: "pressure",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: -10, energyCost: 0,  beneficial: true },
        2: { moodDelta: 10, excitementDelta: -10, energyCost: 0,  beneficial: true },
        3: { moodDelta: 10, excitementDelta: -10, energyCost: 0,  beneficial: true }
      },
      dialogues: {
        performance: "I skipped training today. Instead of running, I just... sat. It felt weird at first. But my mind needed stillness. Rest isn't quitting. It's choosing.",
        perfectionism: "I didn't train today. No 'making up for lost time.' No extra reps. Just rest. The guilt was enormous — my brain said I was lazy. But my body said I was finally listening.",
        betrayal:    "I stayed home instead of going to practice. Away from the team, away from the gossip. Just my room, my bed, my quiet. Sometimes the bravest thing is not going where you're hurt.",
        pressure:    "I took a rest day. No coach. No training plan. No stopwatch. Just a day that belongs to me. My body unclenched, my breathing slowed. This is what my coach never prescribed — but it's what I needed most.",
        identity:    "I didn't train today. And I was still Maya. Still me. The sport is part of my life, not all of it. A day without training proved that I exist even when I'm not performing.",
        default:     "I rested today. No training, no schedule. Just time."
      },
      dreamFragments: [
        "a couch that becomes a cloud, lifting you gently off the ground",
        "a clock where the hands have stopped and there's no alarm anywhere",
        "a hammock stretched between two sunbeams"
      ]
    },
    {
      id: "journalAthlete",
      name: "Write Training Journal",
      emoji: "📝",
      description: "Reflect on who you are beyond sport",
      category: "identity",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: 5,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 10, excitementDelta: 5,  energyCost: 15, beneficial: true },
        3: { moodDelta: 10, excitementDelta: 5,  energyCost: 15, beneficial: true }
      },
      dialogues: {
        performance: "I wrote about the race — not the numbers, but how it felt. The fear before, the silence after. Putting it on paper made it a story instead of a scar. Failures have endings.",
        perfectionism: "I wrote about my perfectionism. How it drives me and how it traps me. On paper, I could see both sides — the gift and the curse. Writing gave me distance from the thing I can't escape.",
        betrayal:    "I wrote about what happened. The trust I gave, the trust they broke. Writing it down made it real — not just a feeling, but a record. Something I can point to and say: 'This happened.'",
        pressure:    "I wrote about the pressure. Where it comes from — coach, parents, myself. Seeing it listed made me realize: most of it is external. I'm carrying voices that aren't mine.",
        identity:    "I wrote about who I am when I'm not training. The list was longer than I expected — I like cooking, I read fantasy novels, I notice small beautiful things, I'm kind when I'm not competing. The athlete is one item on a long list. I'm more than I thought.",
        default:     "I wrote in my journal. It helps me see things I can't see in the moment."
      },
      dreamFragments: [
        "a notebook where every page becomes a door to a different version of you",
        "words rearranging themselves on the page, spelling out things you didn't know you felt",
        "a mirror made of paper, reflecting a person you almost recognize"
      ]
    },

    // ---- KAI's special activities ----
    {
      id: "sketch",
      name: "Sketch Freely",
      emoji: "✏️",
      description: "Just draw, no pressure",
      category: "creativeBlock",
      levelEffects: {
        1: { moodDelta: 8,  excitementDelta: 5,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 8,  excitementDelta: 5,  energyCost: 15, beneficial: true },
        3: { moodDelta: 8,  excitementDelta: 5,  energyCost: 15, beneficial: true }
      },
      dialogues: {
        creativeBlock: "I sketched without expecting anything. Just lines, just shapes. Most of it was garbage. But one curve felt right — not good, just right. The block didn't break, but it cracked a little.",
        familyExpect: "I sketched instead of studying business. Every line was a small rebellion. My parents wouldn't approve, but my hands didn't ask permission. The sketch isn't great — but it's mine.",
        rejection:   "I sketched something new, not the rejected piece. A different idea, a different direction. Starting fresh felt like giving myself permission to exist beyond that one 'no.'",
        comparison:  "I sketched without looking at their work first. My lines came from my own head, my own hand. Imperfect, wobbly — but unmistakably mine. Comparing kills that feeling. Sketching restores it.",
        lostInspiration: "I sketched and nothing came. But I kept the pencil moving. Blank pages, random marks. The inspiration isn't back, but the habit is. And sometimes habit is the bridge between lost and found.",
        default:     "I sketched today. Nothing special, but my hand moved. That's something."
      },
      dreamFragments: [
        "a pencil that draws on air, leaving trails of light instead of graphite",
        "lines becoming rivers, curves becoming hills — the sketch draws itself",
        "a blank canvas that fills with color the moment you look at it"
      ]
    },
    {
      id: "talkToMom",
      name: "Talk to Parents",
      emoji: "👨‍👩‍👦",
      description: "Be honest about what matters to you",
      category: "familyExpect",
      levelEffects: {
        1: { moodDelta: 8,  excitementDelta: 8,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 8,  excitementDelta: 8,  energyCost: 15, beneficial: true },
        3: { moodDelta: 8,  excitementDelta: 8,  energyCost: 15, beneficial: true }
      },
      dialogues: {
        creativeBlock: "I called Mom. She asked if I'm making things. I said 'not really.' She said, 'That's okay, take your time.' It's not what she usually says about art. Maybe she's trying.",
        familyExpect: "I told my parents what art means to me. Not as a career argument — as a life argument. 'This is how I process the world,' I said. Mom paused. Then she said, 'I didn't know that.' The conversation isn't over, but it started.",
        rejection:   "I told Mom about the rejection. She said, 'Rejection means you tried.' She wasn't dismissive or overly positive. Just factual. For once, her practicality helped instead of hurt.",
        comparison:  "I showed Mom my work — not their portfolio, just mine. She said, 'You made this? This is good.' She's not an art critic, but she's my mom, and her approval of my effort matters more than I thought.",
        lostInspiration: "I asked Mom what she does when she loses motivation. She said, 'I do something small and finish it. Then I feel like I can do more.' Simple advice from someone who isn't an artist — but she keeps going.",
        default:     "I talked to Mom. It was a real conversation this time."
      },
      dreamFragments: [
        "two chairs facing each other across a table made of shared memories",
        "a bridge built from words that were finally spoken",
        "a kitchen where two generations cook the same recipe differently, and both taste good"
      ]
    },
    {
      id: "resubmit",
      name: "Submit Work Again",
      emoji: "📤",
      description: "Try again, send it somewhere new",
      category: "rejection",
      levelEffects: {
        1: { moodDelta: 3,  excitementDelta: 15, energyCost: 0,  beneficial: false },
        2: { moodDelta: 3,  excitementDelta: 15, energyCost: 25, beneficial: false },
        3: { moodDelta: 3,  excitementDelta: 15, energyCost: 25, beneficial: false }
      },
      dialogues: {
        creativeBlock: "I tried to submit old work instead of making new things. The form felt hollow — sending something I already made instead of creating something new. The block won't break by recycling.",
        familyExpect: "I submitted work to the exhibition my parents would approve of — practical, 'career-oriented.' It felt like surrender. I'm not making art; I'm making resume entries. This isn't me.",
        rejection:   "I resubmitted the same piece to a different venue. It felt like defiance — 'you said no, I'll find a yes.' But also like avoidance — I didn't make anything new, I just re-sent the old thing. Defiance without growth isn't progress.",
        comparison:  "I looked at their portfolio one more time before submitting mine. The comparison made my work feel smaller. I sent it anyway, but my confidence was already damaged.",
        lostInspiration: "I submitted old work. No new ideas, just things I made when I was inspired. The submission was mechanical — click, send, done. My heart wasn't in it.",
        default:     "I submitted some work. Let's see what happens."
      },
      dreamFragments: [
        "an envelope that opens into a door, but the door leads back to the same room",
        "a mailbox that rejects every letter and folds them into paper cranes instead",
        "a form that keeps asking the same question in different fonts"
      ]
    },
    {
      id: "visitGallery",
      name: "Visit Art Gallery",
      emoji: "🖼️",
      description: "See art in context, not competition",
      category: "comparison",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: 8,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 10, excitementDelta: 8,  energyCost: 12, beneficial: true },
        3: { moodDelta: 10, excitementDelta: 8,  energyCost: 12, beneficial: true }
      },
      dialogues: {
        creativeBlock: "I saw art that started as rough sketches. The early versions were messy, uncertain — like mine. The finished pieces were beautiful, but they didn't start that way. The block is a beginning, not an ending.",
        familyExpect: "The gallery proves that art is real. People pay to see it. Society values it. My parents' definition of 'real' is narrow. The world's definition is wider.",
        rejection:   "I saw work that was rejected multiple times before being shown here. The labels told the story — refused, refused, then accepted. Rejection is part of the path, not the end of it.",
        comparison:  "I saw other artists' work in a gallery — not on a screen, not in competition. Just art existing in a room. Each piece was different, and none was 'better.' They were just present. Being present is enough.",
        lostInspiration: "The gallery filled me with questions. How did they choose those colors? Why that shape? Questions are the beginning of ideas. I didn't leave with a plan, but I left with curiosity. Curiosity is close to inspiration.",
        default:     "I visited the gallery. It's good to see what other people have made."
      },
      dreamFragments: [
        "a gallery where the paintings slowly breathe, expanding and contracting like lungs",
        "frames that dissolve, letting the art spill into the room and onto you",
        "a wall of paintings where each one is a window into a different world"
      ]
    },
    {
      id: "revisitOld",
      name: "Look at Old Work",
      emoji: "📂",
      description: "Remember where you started",
      category: "lostInspiration",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: 5,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 10, excitementDelta: 5,  energyCost: 8,  beneficial: true },
        3: { moodDelta: 10, excitementDelta: 5,  energyCost: 8,  beneficial: true }
      },
      dialogues: {
        creativeBlock: "I found my first sketchbook. The drawings are clumsy, earnest, full of trying. The block is about perfection — but my first work wasn't perfect, and I loved making it. I need to find that joy again.",
        familyExpect: "I looked at the art I made before I worried about careers. Before my parents' opinions. It was free — no agenda, no audience, just expression. That's the Kai I want to protect.",
        rejection:   "I found old work that no one rejected because I never showed it. It was mine — private, unjudged. The rejection is public. The old work is personal. I started with the personal. That's the root.",
        comparison:  "I compared my old work with my recent work. The recent work is better — I can see growth. Comparison with myself shows progress. Comparison with others shows distance. The first one helps.",
        lostInspiration: "I looked at the first thing I ever made. It was terrible — but it was the start of everything. The spark I lost is right there, in that clumsy first attempt. The inspiration wasn't in the quality — it was in the wanting. I still want.",
        default:     "I looked at my old work. I've grown more than I realized."
      },
      dreamFragments: [
        "a folder that opens into a hallway, each file a room from a different year",
        "old drawings floating to the ceiling and forming a constellation of past selves",
        "a timeline made of sketches, each one a step on a path you forgot you walked"
      ]
    },

    // ---- SORA's special activities ----
    {
      id: "joinClub",
      name: "Join a Club",
      emoji: "🎯",
      description: "Find a small community",
      category: "newSchool",
      levelEffects: {
        1: { moodDelta: 12, excitementDelta: 12, energyCost: 0,  beneficial: true },
        2: { moodDelta: 12, excitementDelta: 12, energyCost: 15, beneficial: true },
        3: { moodDelta: 12, excitementDelta: 12, energyCost: 15, beneficial: true }
      },
      dialogues: {
        newSchool:   "I joined the cooking club. It's small, just five people. They showed me how the kitchen works here. It's different from home, but the purpose is the same — make something, share it. I found a tiny place to belong.",
        culturalClash: "I joined a club and brought something from my culture to share. They were curious, not judgmental. 'Tell us more,' they said. The clash turned into exchange.",
        homesick:    "I joined a club that reminds me of home — the music club, where they play songs I know. Different arrangements, same melodies. The familiarity wraps around me like a blanket.",
        maskWearing: "I joined a club and was honest about being new. No pretending to know the rules. 'I'm learning,' I said. They said, 'We'll teach you.' Vulnerability earned me real belonging.",
        languageBarrier: "I joined the art club — expression without words. I showed what I mean through shapes and colors. No translation needed. Art is a language that doesn't require fluency.",
        default:     "I joined a club today. A small step, but it feels like planting a flag."
      },
      dreamFragments: [
        "a club room that keeps expanding, adding new rooms for every new person who walks in",
        "five chairs around a table, each one already warm from someone who sat there before",
        "a door with no label that opens into exactly the place you needed"
      ]
    },
    {
      id: "shareCulture",
      name: "Share Your Culture",
      emoji: "🌏",
      description: "Bring your roots into the conversation",
      category: "culturalClash",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: 10, energyCost: 0,  beneficial: true },
        2: { moodDelta: 10, excitementDelta: 10, energyCost: 15, beneficial: true },
        3: { moodDelta: 10, excitementDelta: 10, energyCost: 15, beneficial: true }
      },
      dialogues: {
        newSchool:   "I shared a story from my culture during lunch. A few people listened. One said, 'That's beautiful — I never heard that before.' My culture isn't a barrier here — it's an offering.",
        culturalClash: "I taught someone how to cook a dish from my family. They taught me one from theirs. Two recipes, one kitchen. The clash isn't a wall — it's a table. We eat together.",
        homesick:    "Sharing my culture felt like sending a letter home — 'I'm still me.' The distance doesn't erase who I am. Every story I tell here is proof that I brought my roots with me.",
        maskWearing: "I shared something real about my background — no editing, no softening. The real version is messier but more interesting. The mask simplifies me. The truth is richer.",
        languageBarrier: "I shared my culture through food and gesture, not words. The meaning passed without sentences. People understood through taste, through watching. Not everything needs language.",
        default:     "I shared something from my culture. People were curious."
      },
      dreamFragments: [
        "two maps overlapping, creating a new landscape that exists in neither place alone",
        "a table where every dish speaks a different language and they all taste delicious",
        "a bridge made of woven traditions, each strand from a different shore"
      ]
    },
    {
      id: "callHome",
      name: "Call Home",
      emoji: "📞",
      description: "Connect with the people who know you fully",
      category: "homesick",
      levelEffects: {
        1: { moodDelta: 12, excitementDelta: 5,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 12, excitementDelta: 5,  energyCost: 8,  beneficial: true },
        3: { moodDelta: 12, excitementDelta: 5,  energyCost: 8,  beneficial: true }
      },
      dialogues: {
        newSchool:   "I called home and told them about the new school. They asked good questions — about the people and the places. Their interest made me look at things differently. Maybe this place isn't so strange after all.",
        culturalClash: "I called home and Mom said, 'Be yourself there. Don't shrink to fit.' She's right, and hearing it from someone who knows me fully reminded me that I don't have to choose between cultures. I can carry both.",
        homesick:    "I called home. Mom's voice, Dad's joke, the dog barking in the background. Ten minutes of home, delivered through a phone. The distance didn't disappear, but it got thinner. A call is a bridge.",
        maskWearing: "I called home and took off the mask immediately. 'It's hard,' I said. 'I'm pretending to fit in.' They said, 'You don't have to pretend with us.' Home is where the mask stays off.",
        languageBarrier: "I called home and spoke in my language — full speed, full complexity, full meaning. No translation, no simplification. For ten minutes, I was completely understood. That's worth more than any conversation here.",
        default:     "I called home. Their voices are the same — steady, warm, mine."
      },
      dreamFragments: [
        "a phone that becomes a doorway, and through it you can hear every voice you've missed",
        "a thread stretching across an ocean, connecting two rooms on opposite sides of the world",
        "a living room that exists in two countries simultaneously, the furniture from both homes"
      ]
    },
    {
      id: "beReal",
      name: "Be Honest with Someone",
      emoji: "❤️",
      description: "Take off the mask, just for a moment",
      category: "maskWearing",
      levelEffects: {
        1: { moodDelta: 10, excitementDelta: 8,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 10, excitementDelta: 8,  energyCost: 15, beneficial: true },
        3: { moodDelta: 10, excitementDelta: 8,  energyCost: 15, beneficial: true }
      },
      dialogues: {
        newSchool:   "I told someone, 'I'm new here and I'm struggling.' They said, 'I struggled too, when I first came.' The mask made me look like I was fine. Honesty made me look like I was real. Real connects better than fine.",
        culturalClash: "I admitted that the cultural differences confuse me. My friend said, 'They confuse me too, and I grew up here.' Honesty broke the assumption that everyone else has it figured out. None of us do.",
        homesick:    "I told someone I miss home. Not casually — honestly. They said, 'I miss my hometown too, and I've been here for years.' Missing home isn't weakness. It's proof that you loved something enough to miss it.",
        maskWearing: "I took off the mask. Just told the truth — 'I've been pretending to fit in, and it's exhausting.' The person I told said, 'Thank you. I've been pretending too.' Two masks, one moment of honesty. It felt like breathing after holding my breath for weeks.",
        languageBarrier: "I said, in my limited words, 'Sometimes I can't say what I mean.' They said, 'I can tell. But I hear what you mean anyway.' Understanding doesn't require perfect language. It requires patience and honesty.",
        default:     "I was honest today. It felt risky, but it also felt real."
      },
      dreamFragments: [
        "a mask that dissolves when you touch it, revealing a face you almost forgot",
        "two reflections in a mirror — one masked, one real — and the real one is smiling",
        "a conversation where every word lands exactly where it was meant to"
      ]
    },
    {
      id: "writePoem",
      name: "Write in Your Language",
      emoji: "📜",
      description: "Express yourself without translation",
      category: "languageBarrier",
      levelEffects: {
        1: { moodDelta: 12, excitementDelta: 5,  energyCost: 0,  beneficial: true },
        2: { moodDelta: 12, excitementDelta: 5,  energyCost: 12, beneficial: true },
        3: { moodDelta: 12, excitementDelta: 5,  energyCost: 12, beneficial: true }
      },
      dialogues: {
        newSchool:   "I wrote a poem in my language. No one here can read it, but I can. The words are mine — complex, nuanced, untranslatable. I don't need everyone to understand. I need myself to understand.",
        culturalClash: "I wrote about the clash — in my language, where I can be precise. The poem holds both worlds. In translation, it would lose half its meaning. Some things exist in one language only. That's a richness, not a limitation.",
        homesick:    "I wrote about home in my language. Every word tastes like the place I left. The poem is a portable home — I carry it in my pocket, and when I read it, I'm back.",
        maskWearing: "I wrote a poem and didn't translate it. The real version stays in my language. The mask would translate it — make it 'accessible.' But accessibility isn't always honesty. The poem is honest, and it's mine.",
        languageBarrier: "I wrote in my own language, and the words came easily — full, complex, exact. No translation, no compromise. For one page, I wasn't simplified. I was complete. My language is where I'm whole.",
        default:     "I wrote a poem. In my language, the words fit perfectly."
      },
      dreamFragments: [
        "letters from an alphabet you forgot you knew, spelling out a story only you can read",
        "words that have no translation but carry entire landscapes inside them",
        "a page that glows with meaning, bright enough to light a whole room"
      ]
    }
  ],

  // ---- Helper: get the right dialogue for an activity given today's difficulty ----
  getActivityDialogue: function(activityId, difficultyId) {
    var activity = this.activities.find(function(a) { return a.id === activityId; });
    if (!activity || !activity.dialogues) return "...";

    // If we have a specific line for this difficulty, use it
    if (difficultyId && activity.dialogues[difficultyId]) {
      return activity.dialogues[difficultyId];
    }
    // Fall back to default
    return activity.dialogues.default || activity.dialogue || "...";
  },

  // ---- Helper: select available activities for today ----
  // Each day: 3-4 core activities (randomly selected) + 1-2 special activities
  // matching today's difficulty. Total: 4-6 activities.
  // ---- Select today's available activities ----
  // Picks 3-4 core activities (filtered by excludedCore) + all difficulty-specific specials.
  // excludedCore: core activity IDs that narratively don't connect with today's difficulty.
  // e.g. "chores" excluded from "newSchool" (domestic chores ≠ fitting in at a new school).
  selectTodayActivities: function(difficultyId) {
    // Find the current difficulty object to get its excludedCore list
    var excluded = [];
    var currentChar = this.currentCharacter;
    if (currentChar) {
      for (var i = 0; i < currentChar.dailyDifficulties.length; i++) {
        if (currentChar.dailyDifficulties[i].id === difficultyId) {
          excluded = currentChar.dailyDifficulties[i].excludedCore || [];
          break;
        }
      }
    }

    // Get core activities, excluding narratively mismatched ones
    var coreActivities = this.activities.filter(function(a) {
      return a.category === "core" && excluded.indexOf(a.id) === -1;
    });
    var specialActivities = this.activities.filter(function(a) { return a.category === difficultyId; });

    // Shuffle core and pick 3-4
    var shuffledCore = this.shuffleArray(coreActivities.slice());
    var numCore = 3 + Math.floor(Math.random() * 2); // 3 or 4
    var selectedCore = shuffledCore.slice(0, numCore);

    // Add all special activities for this difficulty (1-2 typically)
    var selectedSpecial = specialActivities.slice();

    // Combine and shuffle the final set
    var todaySet = selectedCore.concat(selectedSpecial);
    return this.shuffleArray(todaySet);
  },

  // ---- Helper: get dream category for visual styling ----
  // Returns "good", "neutral", or "scary" based on dream type
  getDreamCategory: function(dreamType) {
    var good = ["serene", "echoes", "absurd", "unexpectedCalm", "wandering"];
    var neutral = ["drifting"];
    var scary = ["pursuit", "mirror", "drowning", "maze", "loop", "theVoid", "descent", "kaleidoscope"];
    if (good.indexOf(dreamType) !== -1) return "good";
    if (neutral.indexOf(dreamType) !== -1) return "neutral";
    if (scary.indexOf(dreamType) !== -1) return "scary";
    return "neutral";
  },

  // ---- Helper: shuffle an array randomly ----
  shuffleArray: function(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  },

  // ---- Level presets ----
  // Each level defines starting state and rules that differ from other levels.

  levels: {
    1: {
      name: "Tutorial",
      description: "Not all activities truly help. Listen to Lin's words to find the right ones. No energy limit, but doing too many can make the dream too exciting.",
      startingMood: 40,
      startingExcitement: 0,
      startingEnergy: null, // no energy limit in Level 1
      showEnergy: false,
      moodThreshold: 60,   // mood must exceed this for a good dream
      excitementThreshold: 70, // excitement must be below this; above = too exciting
      hint: "Listen to how Lin reacts after each activity. Some things feel nice but don't address the real problem. Choose wisely — and don't do too many!"
    },
    2: {
      name: "Energy Budget",
      description: "You have limited energy. Not all activities are truly helpful — pick the ones that address today's problem.",
      startingMood: 40,
      startingExcitement: 0,
      startingEnergy: 35,   // tight energy budget — can do ~2-3 activities
      showEnergy: true,
      moodThreshold: 60,
      excitementThreshold: 70,
      hint: "You have limited energy, and not every activity truly helps. Listen to how Lin reacts — some things just distract from the real problem."
    },
    3: {
      name: "Full Challenge",
      description: "Not all activities truly help. Listen to the character's words carefully.",
      startingMood: 40,
      startingExcitement: 0,
      startingEnergy: 35,
      showEnergy: true,
      moodThreshold: 60,
      excitementThreshold: 70,
      hint: "Listen to how Lin reacts after each activity. Some things that seem fun don't actually help them."
    }
  },

  // ---- Dream types ----
  // 14 possible dream types. Good dreams (5), neutral dreams (3),
  // and scary dreams (6). The dream TEXT is dynamically generated from
  // the fragments of activities the player actually chose — so every dream is unique.
  //
  // SCARY dreams are triggered by low mood + specific conditions:
  //   pursuit    — being chased by your unspoken fear
  //   mirror     — distorted self-image, seeing what you dread
  //   drowning   — suffocation, can't breathe, pressure closing in
  //   maze       — trapped in an endless structure, no exit
  //   loop       — repeating the same moment forever
  //   theVoid    — absolute nothingness, terrifying emptiness

  dreamTypes: {
    // ---- Good dreams (energized wake state) ----
    serene:         { label: "A Serene Dream",        emoji: "🌙",   category: "good" },
    echoes:         { label: "An Echo Dream",         emoji: "🔄",   category: "good" },
    absurd:         { label: "An Absurd Dream",       emoji: "🎭",   category: "good" },
    unexpectedCalm: { label: "An Unexpected Calm",    emoji: "🕊️",   category: "good" },
    wandering:      { label: "A Wandering Dream",     emoji: "🧭",   category: "good" },
    // ---- Neutral dreams ----
    drifting:       { label: "A Drifting Dream",      emoji: "🌫️",   category: "neutral" },
    // ---- Scary dreams (tired wake state, harder to recover) ----
    pursuit:        { label: "A Pursuit Dream",       emoji: "🏃",   category: "scary" },
    mirror:         { label: "A Mirror Dream",        emoji: "🪞",   category: "scary" },
    drowning:       { label: "A Drowning Dream",      emoji: "🌊",   category: "scary" },
    maze:           { label: "A Maze Dream",          emoji: "🔗",   category: "scary" },
    loop:           { label: "A Loop Dream",          emoji: "🔁",   category: "scary" },
    theVoid:        { label: "The Void",              emoji: "🕳️",   category: "scary" },
    descent:        { label: "A Descent",             emoji: "⬇️",   category: "scary" },
    kaleidoscope:   { label: "A Kaleidoscope Dream",  emoji: "🎪",   category: "scary" }
  },

  // ---- Dream text generator ----
  // Assembles a unique dream narrative from fragments of the activities chosen today.
  // Each activity contributes one random surreal image; the tone is set by dreamType.

  generateDreamText: function(dreamType, chosenActivityIds) {
    var self = this;
    var fragments = [];
    chosenActivityIds.forEach(function(id) {
      var activity = self.activities.find(function(a) { return a.id === id; });
      if (activity && activity.dreamFragments && activity.dreamFragments.length > 0) {
        var idx = Math.floor(Math.random() * activity.dreamFragments.length);
        fragments.push(activity.dreamFragments[idx]);
      }
    });

    // Helper: get fragment i or a fallback
    var f = function(i) {
      return fragments[i] || "a faint, formless light";
    };

    // No activities chosen — dream is empty
    if (fragments.length === 0) {
      if (dreamType === "descent") {
        return "The dream is empty — not peaceful empty, just blank. A room with no furniture, no doors, no windows. You didn't do anything today, and your mind had nothing to work with. The nothing presses in, heavy and still.";
      }
      return "The dream is formless. You remember nothing, only the sensation of having been somewhere else. It passes like weather.";
    }

    switch(dreamType) {
      case "serene":
        var parts = ["In the dream, " + f(0) + "."];
        if (fragments.length >= 2) parts.push("Then, gently, " + f(1) + ".");
        if (fragments.length >= 3) parts.push("And somehow, " + f(2) + " too.");
        parts.push("Everything moves slowly, like breathing underwater. You feel held — not by anyone, but by the quiet itself. When you wake, the feeling stays.");
        return parts.join(" ");

      case "echoes":
        return "In the dream, " + f(0) + " — but deeper, more real than it was during the day. The feeling from earlier returns, transformed into something you can hold. You understand something now that you couldn't see before. The dream is small, but it's entirely yours.";

      case "absurd":
        var chain = [];
        for (var i = 0; i < Math.min(fragments.length, 4); i++) chain.push(fragments[i]);
        var chainText = chain.join(" becomes ");
        var extra = fragments.length > 4 ? " and " + f(4) + " and everything at once" : "";
        return "In the dream, " + chainText + extra + ". Nothing makes sense. Everything connects. You're all of it simultaneously — every activity, every feeling, layered on top of each other like a painting with too many colors. It should be too much, but somehow it's the strangest peace you've ever felt. When you wake, you can't remember any of it, but you know it was yours.";

      case "kaleidoscope":
        var parts = ["In the dream, " + f(0) + " collides with " + f(1) + "."];
        if (fragments.length >= 3) parts.push(f(2) + " spirals into the chaos.");
        if (fragments.length >= 4) parts.push("And then " + f(3) + " — everything at maximum speed.");
        parts.push("Colors bleed into sounds. There's no pause button. It's magnificent and relentless. When it finally stops, you feel hollowed out, like a shell left on a beach.");
        return parts.join(" ");

      case "wandering":
        var parts = ["In the dream, you drift through " + f(0)];
        if (fragments.length >= 2) parts.push(" and then " + f(1));
        if (fragments.length >= 3) parts.push(" and somewhere " + f(2));
        parts.push(". There's no destination. No urgency. Something feels unresolved — like a word on the tip of your tongue. But the wandering itself isn't unpleasant. Your mind went somewhere on its own tonight, and maybe that's okay.");
        return parts.join(" ");

      case "unexpectedCalm":
        var parts = ["In the dream, there's nothing. Not nothing-empty — nothing-vast. Like floating in warm water with no floor and no ceiling."];
        if (fragments.length >= 1) parts.push(f(0) + " drifts by, distant and unimportant.");
        if (fragments.length >= 2) parts.push(f(1) + " too, far away, like hearing it through a wall.");
        parts.push("You didn't solve anything today, but your mind let go anyway. Sometimes rest doesn't need a reason. Sometimes the dream just gives you a gift, and you don't ask why.");
        return parts.join(" ");

      case "drifting":
        var parts = ["In the dream, " + f(0) + " appears, then dissolves."];
        if (fragments.length >= 2) parts.push(f(1) + " surfaces, then sinks.");
        if (fragments.length >= 3) parts.push("And " + f(2) + " — just for a moment — before it fades.");
        parts.push("Everything is half-formed. There's something underneath, something you didn't deal with today, but it doesn't grab you. Not tonight. You drift between images, and the drifting is almost rest.");
        return parts.join(" ");

      // ============ SCARY DREAMS ============

      case "pursuit":
        var parts = ["In the dream, something is chasing you. You can't see it, but you can hear it — footsteps that match yours exactly, one step behind, forever."];
        if (fragments.length >= 1) parts.push("You run through " + f(0) + ", but the landscape shifts to block every exit.");
        if (fragments.length >= 2) parts.push("Then " + f(1) + " appears ahead — a dead end.");
        parts.push("The thing behind you doesn't need to catch you. It just needs you to keep running. When you wake, your heart is still pounding, and your legs ache like you actually ran.");
        return parts.join(" ");

      case "mirror":
        var parts = ["In the dream, you find a mirror. But the reflection doesn't move when you move. It stares at you with an expression you've never seen on your own face — contempt, maybe, or pity."];
        if (fragments.length >= 1) parts.push("Behind the reflection, " + f(0) + " stretches endlessly, like a corridor of distorted versions of yourself.");
        if (fragments.length >= 2) parts.push(f(1) + " echoes from inside the glass, spoken by your own voice but twisted, saying things you've thought but never admitted.");
        parts.push("The reflection smiles. You don't. It knows something about you that you don't. When you wake, you avoid looking at yourself.");
        return parts.join(" ");

      case "drowning":
        var parts = ["In the dream, you're underwater. Not the ocean — something thicker, like the air itself turned to liquid. You can't breathe."];
        if (fragments.length >= 1) parts.push("Below you, " + f(0) + " sinks slowly into the depths, and you realize you're sinking too.");
        if (fragments.length >= 2) parts.push(f(1) + " drifts above the surface, unreachable, like everything that was supposed to help.");
        parts.push("You try to scream but the liquid fills your throat. Your chest burns. The pressure is everywhere — not crushing, just... endless. You wake gasping, and for a moment you actually can't breathe.");
        return parts.join(" ");

      case "maze":
        var parts = ["In the dream, you're inside " + f(0) + ", but it's wrong — the walls rearrange every time you turn around."];
        if (fragments.length >= 2) parts.push(f(1) + " appears as a sign, but the words change every time you read them.");
        if (fragments.length >= 3) parts.push("And " + f(2) + " marks a door that leads to another identical room.");
        parts.push("Every corridor looks the same. Every choice leads back to where you started. You walk for hours and never find the exit. The worst part isn't being trapped — it's that you chose every wrong turn yourself. When you wake, you still feel stuck.");
        return parts.join(" ");

      case "loop":
        var parts = ["In the dream, the same moment repeats. You do " + f(0) + " and feel a brief relief."];
        if (fragments.length >= 2) parts.push("Then " + f(1) + " happens again, exactly the same way.");
        parts.push("And again. And again. The relief shrinks each time. By the hundredth loop, you don't even feel it anymore — you just watch yourself go through the motions, like a machine. You know it's repeating, but you can't stop it. When you wake, the day ahead feels like another loop.");
        return parts.join(" ");

      case "theVoid":
        return "In the dream, there is nothing. Not darkness — darkness is something. Not silence — silence has texture. This is the absence of everything. No ground. No air. No body. You don't exist. You try to think, but thoughts require a thinker, and there is no thinker here. You try to feel, but feelings require a body, and there is no body. You are not afraid, because fear requires something to protect, and there is nothing. You are not calm, because calm requires something to be calm about. You simply are not. The nothing is absolute. When you wake, you hold your own hand just to confirm you're real.";

      case "descent":
        var parts = ["In the dream, you're sinking. Not fast, not dramatic — just slowly going down."];
        if (fragments.length >= 1) parts.push(f(0) + " drifts past, but your fingers close on nothing.");
        if (fragments.length >= 2) parts.push("Then " + f(1) + " — too far to reach.");
        parts.push("The thing you didn't face today is here. Shapeless. Heavy. It sits in the center of everything and doesn't speak. You can't look away. When you wake, the weight comes with you.");
        return parts.join(" ");

      case "kaleidoscope":
        var parts = ["In the dream, " + f(0) + " collides with " + f(1) + "."];
        if (fragments.length >= 3) parts.push(f(2) + " spirals into the chaos.");
        if (fragments.length >= 4) parts.push("And then " + f(3) + " — everything at maximum speed.");
        parts.push("Colors bleed into sounds. There's no pause button. It's magnificent and relentless. When it finally stops, you feel hollowed out, like a shell left on a beach.");
        return parts.join(" ");

      default:
        return "The dream is formless. You remember nothing, only the feeling of having been somewhere else.";
    }
  },

  // ---- Wake-up reflections ----
  // The character's morning reflection — one per dream type.

  reflections: {
    serene:         "I had the most peaceful dream. Whatever I did yesterday, it was the right mix — calm enough to rest, but meaningful enough to feel good. I'm ready for today.",
    echoes:         "The dream replayed what I did, but deeper — like my mind was still working on it while I slept. I woke up understanding something I couldn't see before. That one thing was enough.",
    absurd:         "That was the weirdest dream I've ever had. Everything I did got mashed together into something impossible. But I feel... strangely whole? Like all the pieces fit somewhere, even if I can't explain how.",
    unexpectedCalm: "I don't understand it. I didn't really deal with anything yesterday, but I slept so well. My mind just... found its own quiet. I'm not going to question it. Sometimes you just get lucky.",
    wandering:      "The dream was strange — I wandered through it without going anywhere. I didn't really deal with what was bothering me. But I feel rested anyway. Maybe not everything needs to be solved.",
    drifting:       "The dream was foggy. Images came and went. I think something was there that I didn't want to see. I feel okay, but not great. Tomorrow I should try harder to actually face things.",
    pursuit:        "I was running all night. Something was behind me — I never saw it, but I could feel it getting closer. My heart still won't slow down. I think it was what I've been avoiding. Whatever I did yesterday, I didn't actually face it. It chased me instead.",
    mirror:         "I saw myself in the dream, but it wasn't me. It looked at me like it knew everything I'm ashamed of. I can't stop thinking about the expression on its face. I don't want to look at myself today.",
    drowning:       "I couldn't breathe in the dream. The pressure was everywhere — I was drowning in something I couldn't even see. I woke up gasping. I think it was everything I've been holding in. I need to let something out, or it'll crush me.",
    maze:           "I was trapped in a maze that kept changing. Every turn led back to where I started. I chose every wrong path myself. I feel stuck — not just in the dream, but in real life too. I keep making the same mistakes.",
    loop:           "The same thing happened over and over. I couldn't stop it. I couldn't change it. By the end, I didn't even feel anything anymore — I just watched. I don't want today to be another repeat.",
    theVoid:        "There was nothing. Not even darkness. I didn't exist. I don't know how to describe it. I've never felt so... erased. I need to do something today that makes me feel real.",
    descent:        "The dream was dark and heavy. I think I needed to face something I kept avoiding. Whatever I did yesterday, it wasn't enough. I should pay more attention to what I actually need.",
    kaleidoscope:   "The dream was incredible — so vivid and wild! But I feel completely drained. I did too much yesterday. Maybe fewer activities, chosen more carefully, would let me actually rest."
  }
};
