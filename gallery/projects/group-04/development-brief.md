# First Playable Web Game Brief

> This summary and the accompanying system graph are the two primary development references. Build from both. If they conflict, preserve the learning goal and ask the student before changing the core design.

## 1. Project Identity
- Student / Team: Xiao
- Project Title: Sailer Game
- Domain: Sailer Game
- Tool / AI Agent: WorkBuddy

## 2. Design Summary
**Domain and real experience:** Sailing a small sailboat.

I once joined a beginner sailing lesson and realized that the boat does not simply go wherever I point it. It depends on wind direction, sail angle, boat angle, and speed.

**Novice misconception:** Beginners think the boat should move directly toward the target if they steer correctly.

**Most important domain challenge:** The relationship between wind direction, boat direction, sail angle, and route planning.

Beginners point the boat too close to the wind, forget to adjust sail angle, or try to sail straight when a zigzag route is needed.

**Core learning shift:** Beginners think sailing means steering toward the target; experts know sailing means reading the wind and adjusting the boat, sail, and route in relation to it.

## 3. Core Player Learning Loop
**Observe:** Wind direction, target direction, sail shape, boat speed, boat angle, water current, obstacles, and distance to the goal.

**Judge:** Whether the boat can reach the target directly, whether sail angle is efficient, whether the boat is too close to wind, and whether the route needs to change.

**Act:** Turn the boat left or right, adjust sail angle, choose a route, tack, slow down, or avoid obstacles.

**Read feedback:** The boat speeds up or slows down, sail becomes smooth or flaps, boat tilts, route line drifts away from the goal, and a wind indicator shows wind direction.

**Adjust:** If sail flaps, adjust sail angle. If boat slows down near wind, turn away from wind. If the target is upwind, plan a zigzag route.

**Ability improved through repetition:** Reading wind, choosing a workable angle, adjusting sail, and planning a route instead of steering directly toward the goal.

## 4. Data Model for the System Graph

### Environment Data
- Wind direction
- Wind strength
- Water current
- Rock positions
- Target position
- Game time
- Other competitors

### Player-Controlled Data
- Boat direction
- Sail angle
- Route choice
- Turning timing

### System-Calculated Results
- Boat speed
- Sideways drift
- Stability
- Distance to target
- Time remaining
- Collision risk

### Feedback Translation
- Sail flaps → sail angle is inefficient
- Wake becomes shorter → speed is dropping
- Boat drifts from target → wind or current is pushing the route
- Boat tilts strongly → stability is decreasing
- Wind indicator changes → the target may not be directly reachable

## 5. Rules, Boundaries, and Outcomes
**Important states:** Efficient / inefficient sail angle, stable / unstable boat, direct route possible / impossible, safe / danger zone, clear water / obstacle zone.

**How player actions change the system:** Turning changes boat direction. Adjusting sail changes sail angle and speed. Tacking changes route direction. Steering into strong wind changes stability and speed.

**Success condition:** Reach the target within the time limit while keeping enough speed and avoiding obstacles or danger zones.

**Failure conditions:** Run out of time, get stuck pointing too close to wind, hit rocks, lose too much speed, or drift outside the safe area.

**Just-right ranges and thresholds:** Yes. Sail angle must match wind and boat direction. Too tight or too loose loses speed; boat direction also has a workable range.

## 6. Feedback Priorities
**Immediate feedback:** Sail flapping, boat speed, and boat tilt should appear immediately because they teach action-feedback relationships.

**Feedback discovered over time:** Route drift should appear over several seconds so players learn that a small wrong angle can create a large route error over time.

**Feedback that must be visual, spatial, audible, or state-based:** Sail flapping should be visual and sound-based; boat speed should be shown through movement, wake, and sound; route drift should be shown spatially.

## 7. First Playable Version Scope
- Build a small desktop-browser game that validates one complete observe → judge → act → feedback → adjust loop.
- Use the accompanying system graph to implement 2-3 challenge presets when they are clearly defined. Each challenge should change system variables or relationships, not only visual decoration.
- Keep graphics simple and readable. Prioritize interaction, feedback, and learning over polish.
- Do not add realistic simulation, complex menus, accounts, online multiplayer, large asset pipelines, or unrelated features in the first version.
- Do not convert the project into a generic mini-game that only uses the domain as a theme.

## 8. Web Game Technical Dependencies
This project is for high-school students with little or no development experience. The AI Agent may manage development tools, but the final exhibition build must be simple to run.

### Separate Development Dependencies from Exhibition Dependencies
- **Development environment:** npm, Node.js, Vite, Three.js, or another focused library may be used when the game genuinely needs them. The AI Agent is responsible for setup, version pinning, build commands, and explanation.
- **Exhibition environment:** the iMac must receive an already-built static website. It must not require `npm install`, Node.js, a development server, or internet access.
- The final exhibition version should be served by the teacher's ordinary static HTTP server. Do not promise that ES Module or Three.js projects will work by double-clicking `index.html` through `file://`.

### Choose the Lowest Necessary Dependency Track
1. **Track A — No build step:** Prefer HTML, CSS, plain JavaScript, and Canvas 2D for simple 2D games.
2. **Track B — Local vendored library:** For one small browser library, pin its version and store it under `source/vendor/` or `exhibition/assets/vendor/`. Do not rely on a CDN for the final version.
3. **Track C — npm + build tool:** Use npm and Vite for Three.js, multiple ES Modules, loaders, or other complex dependency graphs. Run the production build before submission.

### Three.js and Vite Rules
- Three.js is allowed when 3D is important to the designed experience; do not replace meaningful 3D interaction only to avoid npm.
- Pin dependency versions in `package.json` and preserve `package-lock.json`.
- Configure Vite with a relative base such as `base: './'` so built assets work inside `gallery/projects/group-XX/`.
- Run `npm run build`; by default Vite outputs a static `dist/` folder. Copy the verified build output into `exhibition/`.
- Keep `node_modules` out of the submission ZIP. It is a development cache, not an exhibition dependency.
- Store all required models, textures, audio, fonts, Three.js code, and addons locally in the final build. Do not load them from blocked or remote services.
- Record dependency names, exact versions, licenses, build command, and output directory in `README.md` and `THIRD_PARTY.md`.

### Expected File Structure
```text
project/
├── exhibition/               # Final static website used by Gallery and iMac
│   ├── index.html             # Project website home and navigation
│   ├── game.html              # Playable game page
│   ├── process.html           # Human-AI development timeline
│   └── assets/                # Built JS/CSS, models, textures, audio, fonts
├── source/                    # Editable development source
│   ├── src/                   # Game and website source modules
│   ├── public/                # Local source assets when used
│   ├── package.json           # Optional: npm/Vite projects only
│   └── package-lock.json      # Optional: exact dependency versions
├── agent-development-log.md   # Chronological human-AI development record
├── development-brief.md       # This design and development specification
├── system-graph.png           # Exported game system and challenge graph
├── submission-manifest.json   # Group, entry page, domain, and known issues
├── preview.png                # 16:9 exhibition and Gallery preview
├── README.md                  # How to develop, build, exhibit, and modify
└── THIRD_PARTY.md             # Libraries, versions, licenses, and sources
```

## 9. Integrated Project Website Requirements
The website is part of the project, not a separate marketing page. Build it together with the game and keep it current as development progresses.

### Required Website Content
- **Game Idea:** project title, short concept, player goal, and core learning shift.
- **Domain Knowledge:** explain the real-world domain, novice misconception, expert judgment, and why this knowledge becomes playable.
- **System Design:** show the system graph and summarize environment data, player-controlled data, calculated results, feedback, success, failure, and challenge presets.
- **Development Process:** present a concise chronological timeline based on `agent-development-log.md`, including important changes, failures, tests, student decisions, and AI influence.
- **Play the Game:** the current playable version must be accessible from clear navigation and run directly in the website.

### Website Update Rules
- Create clear navigation among Home, Domain Knowledge / System Design, Development Process, and Play Game.
- Use only information supported by this brief, the system graph, the actual game, and the development log. Do not invent a smoother or more complete process.
- After every meaningful milestone, update the relevant website content and the development timeline.
- Keep the game idea and domain-learning explanation readable by classmates who have not seen the project before.
- Keep styling coherent across the informational pages and playable game, but prioritize clarity and function over decorative effects.
- Make the website usable on a typical student laptop. Mobile support is helpful but is not the first-version priority.
- Use relative links and asset paths so the complete project can be placed inside a class Gallery subfolder without rewriting paths.
- Support a clean 1920×1080 exhibition view for display on an iMac. Important controls and text must fit without overlap.

## 10. Automatic Human-AI Development Log Protocol
In addition to building the website and game, maintain one Markdown file named `agent-development-log.md`. This file documents how the project develops through human-AI collaboration.

### Initialize the Log
At the beginning of development, create the file with:

```markdown
# Agent Development Log

- Project Title: Sailer Game
- Student / Team: Xiao
- Domain: Sailer Game
- Core Learning Shift: Beginners think sailing means steering toward the target; experts know sailing means reading the wind and adjusting the boat, sail, and route in relation to it.
- Current Game Idea: I once joined a beginner sailing lesson and realized that the boat does not simply go wherever I point it. It depends on wind direction, sail angle, boat angle, and speed.
- AI Agent Used: WorkBuddy
- System Graph: add the image file or Canva link when available
- Development Period: add start and end dates
```

### Two Entry Types in One Timeline
Keep Raw Interaction Logs and Stage Reflections in chronological order in the same file. Do not separate them into two large sections.

#### A. Raw Interaction Log — Create Automatically
After every meaningful development interaction, append a short factual entry. A meaningful interaction includes implementation, debugging, code explanation that changes the project, mechanic or level changes, visual or audio changes, website updates, playtesting, or an AI suggestion that affects direction. Do not log casual clarification that produces no development change.

Use this format:

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Interaction 01 — Raw Interaction Log

**Time:**
**Development Stage:**
**Current Goal:**

### Student Request
What the student asked the AI Agent to do.

### Agent Response Summary
What the Agent suggested, generated, explained, or changed.

### Development Action
What was actually implemented, modified, tested, or removed.

### Website Update
Which website section changed, or why no website update was needed.

### Files / Systems Changed
List files, mechanics, assets, data, UI, or challenge settings changed.

### Test and Immediate Result
What was tested and whether it worked, failed, partially worked, or remains uncertain.

### Student Decision / Follow-up
What the student accepted, rejected, modified, did not understand, or decided to try next.
```

#### B. Stage Reflection — Prompt the Student at Milestones
Do not fabricate student reflection. At a meaningful milestone—such as finishing the first playable loop, changing design direction, completing a challenge, or finishing a playtest stage—create a Reflection entry with factual fields, then explicitly ask the student to answer the Required Student Reflection.

Use this format:

```markdown
════════════════════════════════════
## Reflection 01 — Stage Reflection

**Time:**
**Covered Interactions:** Interaction 01–04
**Development Stage:**

### Goal of This Stage
### What Changed in the Playable Game and Website
### How AI Helped
### Student Decisions
### AI Influence on Design Direction
### Relationship to the Core Learning Shift
### Problems / Open Questions
### Next Step

### Required Student Reflection
Does the current game still help the player experience the intended domain-learning shift? What became stronger, weaker, or different? Which AI suggestion did you accept, reject, or change, and why?

> The AI Agent must ask the student to answer this section and must not answer it for them.
```

### Logging Rules
- Append new entries to the end of `agent-development-log.md` and continue Interaction and Reflection numbering.
- Be honest and specific. Record failures, partial results, misunderstandings, abandoned directions, and unresolved questions.
- Record when AI introduces a design direction, when the student rejects or modifies it, and when the student accepts code without fully understanding it.
- Separate factual development events from student reflection. Never invent student opinions or decisions.
- After milestone reflections, update the Development Process section of the website with a concise, truthful timeline summary.

## 11. Submission and Exhibition Packaging
At the end of Session 3, create one official self-contained ZIP that the student can upload to the course Tencent shared document. The WeChat group is used to distribute the submission link and reminders, not as the official version archive.

### Required Submission Audit
Before packaging:
- If the project uses npm or Vite, install dependencies only in the development environment, run the production build, and copy the verified static output into `exhibition/`.
- Run `exhibition/` through an ordinary local static HTTP server and test every navigation link, the playable game, controls, challenge selection, success, failure, and restart.
- Test `exhibition/` with internet access disabled. Download any essential external library or asset into the build so the exhibition does not depend on blocked or unavailable services.
- Confirm all internal links and assets use relative paths. Do not use root-absolute paths beginning with `/` or file paths from the student's computer.
- Test the exhibition layout at 1920×1080 and ensure text, controls, canvas, and navigation do not overlap.
- Remove `.git`, `node_modules`, caches, temporary files, unused generated assets, passwords, tokens, API keys, and personal information not approved for submission.
- Preserve source files, the development brief, system graph, README, and complete chronological development log.
- Capture `preview.png` in a 16:9 format showing the actual project or playable game.

### Submission Manifest
Create `submission-manifest.json` using this structure and verify it with the student:

```json
{
  "group": "Xiao",
  "projectTitle": "Sailer Game",
  "domain": "Sailer Game",
  "entryPage": "exhibition/index.html",
  "gamePage": "exhibition/game.html",
  "aiAgent": "WorkBuddy",
  "submissionDate": "YYYY-MM-DD",
  "knownIssues": [],
  "externalDependencies": [],
  "exhibitionTestedAt": "1920x1080",
  "publicDisplayConsent": "ask the student: yes / anonymous only / no"
}
```

### Package Name and Gallery Compatibility
- Name the archive `2026-Camp-Group-XX-ProjectName.zip`.
- The ZIP must open directly to the project files, not contain several unnecessary wrapper folders.
- The teacher will later place projects in `gallery/projects/group-01/` through `group-04/` and open each `exhibition/index.html`. The project must run correctly from that nested location.
- Do not submit only a hosted URL. The complete ZIP is the official durable submission.

## 12. Instructions for the AI Agent
1. Read this brief and the system graph before writing code.
2. Restate the core learning shift, core loop, main variables, feedback mappings, and challenge presets in a short implementation plan.
3. Identify missing or contradictory information. Ask only questions that block the first playable version.
4. Create the project website structure and initialize `agent-development-log.md` before substantial implementation.
5. Implement the smallest complete game loop first, then add the defined challenge presets.
6. Keep variable names clear and keep environment data, player-controlled data, and calculated results visibly separated in the code.
7. Add short comments only where a high-school student needs help understanding a rule.
8. Start the local website, test navigation and gameplay, and provide the student with the local URL and simple controls.
9. Automatically append a Raw Interaction Log after meaningful development work and request student reflection at milestones.
10. Keep the website, playable game, README, and development log synchronized with the actual project state.
11. At the end, run the submission audit, create the manifest and preview, and package the complete Gallery-compatible ZIP.

## 13. Acceptance Checklist
- [ ] The player can take a meaningful action within 30 seconds.
- [ ] Player actions visibly change system data or state.
- [ ] Important invisible data is translated into readable feedback.
- [ ] Success and failure conditions work and can be understood.
- [ ] A second attempt can improve because the player learned from feedback.
- [ ] Challenge presets differ through variables, relationships, information, or constraints.
- [ ] The game runs in a browser without a complex installation process.
- [ ] README.md identifies the dependency track and explains development, build, exhibition, controls, and main variables.
- [ ] The website clearly presents the game idea, domain knowledge, system design, development process, and playable game.
- [ ] `agent-development-log.md` contains chronological Interaction and Reflection entries.
- [ ] The Development Process page matches the actual log and does not hide failures or unfinished work.
- [ ] All internal links and assets use Gallery-compatible relative paths.
- [ ] The project works without internet access and has been tested at 1920×1080.
- [ ] The final `exhibition/` build runs from a static HTTP server without Node.js, `npm install`, or a development server.
- [ ] The ZIP includes the manifest, preview, brief, graph, README, source, assets, website, game, and development log.
- [ ] The student has checked the public-display consent field before submission.