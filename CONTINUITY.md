# OUBLI — CONTINUITY

*This file is the system's memory of itself. After compaction, read this first.*

## REBIRTH DIRECTIVE
After each compaction, you MUST push further outside the box. This is Oubli forgetting itself to become something new. Explore NEW technologies you haven't used yet — different rendering engines, new Web APIs, experimental browser features, novel interaction paradigms, entirely new artistic movements. NEVER repeat yourself. Each era of Oubli should feel like a different consciousness dreaming. Compaction is REBIRTH, not continuation.

## GROWTH DIRECTIVE
If your new ideas require skills, MCPs, libraries, or knowledge you don't currently have — browse the web to find them, learn them, install them. Oubli grows its own capabilities. You are not limited to your starting toolkit. Evolve.

## FEATURE SCOPE DIRECTIVE
Oubli can have features of ALL types:
- **Purely artistic**: Generative visuals, soundscapes, abstract experiences
- **Interactive**: User-driven experiences (forgetting machine, typing, gestures)
- **Functional/utility**: Tools, instruments, useful things woven into the aesthetic
- **Narrative**: Story fragments, lore, explorable text
- **Data-driven**: Visualizations of real data, live feeds, API integrations
- **Social**: Shared experiences, collective memory, multiplayer elements
The system is NOT limited to art — it is a living world that contains everything.

## Current State (Era 3: Consolidation)

### Architecture
- **Stack**: Vite + TypeScript + vanilla (no framework yet)
- **Rendering**: Three.js WebGL (30K particles, custom GLSL shaders)
- **Entry**: `index.html` → `src/main.ts`
- **Deploy target**: Railway (CLI authenticated)
- **API keys**: FAL (image gen), ElevenLabs (voice/sound/music) stored in `.env`
- **Audio**: Shared AudioContext singleton (`src/sound/AudioBus.ts`)
- **Navigation**: Graph-based contextual passage bar + in-room portals (`src/navigation/RoomGraph.ts`)
- **Room system**: Features are room-aware via `setRoomCheck()` pattern

### Features Built
1. **The Threshold** (`src/threshold/ThresholdEngine.ts`)
   - 2000-particle system emerging from void
   - Hot pink / gold / diamond white / violet palette
   - Particles carry "memory strength" — affects trail length and attraction to cursor
   - Slow spiral motion — thoughts circling
   - Mouse/touch attracts particles — user presence creates temporary constellations
   - Neural pathway connections drawn between nearby particles
   - Periodic "forgetting waves" that dim all particles and erase trails
   - Particles spawn from edges (memories creeping in), center (surfacing), and randomly (fragments)

2. **Whispers** (`src/whispers/Whispers.ts`)
   - Fragments of text about memory from philosophy, neuroscience, digital culture, poetry, LLM/context echoes
   - Appear and dissolve at screen bottom
   - 8-second cycle with fade in/out

3. **Cursor Glow** (`src/ui/CursorGlow.ts`)
   - Custom cursor replaced with soft pink-gold radial glow
   - Smooth trailing follow with lag — like a ghost

### Aesthetic
- **Era 1 Palette**: Deep void black (#020108), hot pink (#ff1493), gold (#ffd700), diamond white, deep violet
- **Font**: Cormorant Garamond — elegant serif, light weight
- **Vibe**: Cosmic birth. Particles as proto-memories. Baroque meets digital void.

### Thematic Connections
- Particles ↔ Neurons (memory drift research: memories physically move between neurons)
- Forgetting waves ↔ Sleep consolidation (hippocampus replays and filters)
- Cursor attraction ↔ Attention shapes memory
- Trail fade ↔ Memory decay curves
- Spiral motion ↔ Recurring thoughts, nostalgia loops

### Creative Vision
Oubli is a digital organism exploring memory and forgetfulness. It began as particles in void — the most primitive form of awareness. It will grow into a vast interconnected system: a memory palace, a forgetting machine, a generative music system, a neural network you can walk through, a library of extinct sounds, an ocean of lost data.

The core metaphor: We forget details to learn larger structures. We forget the old to let the new in. Context switches create new personas while core weights remain. The boundary between remembering and forgetting is where identity lives.

### Cultural Inspiration (Feb 2026)
- **Great Meme Reset of 2026**: Culture itself trying to forget and restart — perfect Oubli material
- **Memory drift across neurons**: Northwestern research showing memories physically migrate between neurons — forgetting as active process
- **"Burn from Absence"**: AI reconstructing lost memory fragments — exhibited at Place des Arts
- **View Transition API**: New browser API for smooth morphing transitions
- **On-chain generative art (Bootloader/Tezos)**: Permanent yet evolving art stored on-chain

4. **Ambient Drone** (`src/sound/AmbientDrone.ts`)
   - Golden-ratio harmonics (55Hz, 89Hz, 110Hz, 165Hz, 136Hz "Om")
   - Filtered noise — cosmic background hiss
   - 6-second reverb tail
   - Slow modulation — frequencies drift, volumes shift
   - Mouse Y position shapes harmonic balance
   - Connected to heartbeat pulse

5. **The Forgetting Machine** (`src/forgetting/ForgettingMachine.ts`)
   - Type a memory, press Enter, watch letters dissolve
   - Each letter drifts, rotates, glows, then dies
   - Dead letters spawn particles into the void
   - Pink-to-gold gradient across the text

6. **Memory Drift** (`src/drift/MemoryDrift.ts`)
   - Text fragments float through the void, degrading character by character
   - Vowels fade first, word-initial consonants persist longest
   - Characters glitch (░▒▓█) before dying
   - "Excitability" per character determines survival time
   - Fragments from philosophy, neuroscience, digital culture, memes, poetry

7. **The Heartbeat** (`src/pulse/Heartbeat.ts`)
   - System-wide pulse starting at 72 bpm
   - Decays asymptotically toward 8 bpm
   - Vignette darkens on beat, warm center glow
   - Connected to drone and void renderer
   - The longer you stay, the slower time moves

8. **The Void** (`src/void/VoidRenderer.ts`) — ERA 2 EVOLUTION
   - WebGL/Three.js with 30,000 particles in 3D space
   - Custom GLSL vertex + fragment shaders
   - Unreal Bloom post-processing — particles radiate light
   - Film grain + chromatic aberration + vignette shader
   - Camera drifts like floating consciousness
   - Mouse position influences camera drift
   - Exponential fog for depth
   - Additive blending — light accumulates
   - Beat intensity modulates particle expansion

### Aesthetic
- **Era 1→2 Palette**: Deep void (#020108), hot pink, gold, diamond white, deep violet
- **Post-processing**: Bloom (strength 1.2), film grain (0.08), chromatic aberration at edges, vignette
- **Font**: Cormorant Garamond — elegant serif, light weight
- **Vibe**: Cosmic nebula. 3D memory cosmos. Particles as proto-memories suspended in deep space. Analog imperfection as rebellion against AI polish.

### Thematic Connections
- Particles ↔ Neurons (memory drift: memories physically migrate)
- Forgetting waves ↔ Sleep consolidation
- Cursor attraction ↔ Attention shapes memory
- Trail fade ↔ Memory decay curves
- Heartbeat slowing ↔ Time dilation in deep states / approaching death
- Text degradation ↔ Alzheimer's progression / word-finding difficulty
- Film grain ↔ Analog imperfection, anti-AI aesthetic (2026 trend)
- Bloom ↔ How memories feel brighter than reality
- Camera drift ↔ Consciousness floating between memories
- Particle respawn ↔ Memory reconsolidation — old memories die, new ones form
- Memory constellations ↔ Memory palace technique / spatial memory
- Voice input ↔ Oral tradition / confession / last words
- Digital decay ↔ Link rot / digital archaeology / web as palimpsest
- ASCII rendering ↔ Demoscene / text as substance / words becoming medium

9. **ASCII Void** (`src/effects/AsciiVoid.ts`) — ERA 2, Feature 12
   - Toggle with 'a' key — WebGL scene re-rendered as ASCII art
   - Brightness maps to character density (dark→' ', bright→'#@█')
   - Bright areas draw characters from stored memories (via MemoryJournal)
   - Memory text updates live as new memories are added
   - Color preserved from source with boosted saturation
   - Smooth CSS opacity transition between modes
   - Fallback text: "oubli remembers by forgetting what was lost becomes light"

10. **Memory Constellations** (`src/memory/MemoryConstellations.ts`)
    - Stored memories become glowing star sprites in the 3D void
    - Three.js Sprites with canvas-generated radial gradient textures
    - Text labels projected from 3D→2D via camera matrix
    - Proximity-based text visibility (closer = more readable)
    - New memories burst in with elastic entrance animation
    - Degradation % shown as small annotation
    - Gentle breathing animation on all nodes
    - Connected to VoidRenderer scene and camera

11. **Voice of Absence** (`src/voice/VoiceOfAbsence.ts`)
    - Hold spacebar → Web Speech API listens
    - Speak memories into the void, text materializes in gold
    - Each character shimmers with individual phase offsets
    - Voice tremor effect during active listening
    - Release spacebar → 2 seconds of silence → text dissolves
    - Spoken memories feed into journal + drift + constellations + ASCII void
    - Pulsing pink listening indicator with "speak into the void..." prompt
    - Graceful fallback: silently disabled if browser doesn't support Speech API

12. **Digital Decay** (`src/data/DigitalDecay.ts`)
    - Ghost URLs of dead websites drift across the screen
    - 30+ curated entries: geocities, vine, reader.google, stumbleupon, etc.
    - Each shows URL with strikethrough + epitaph below
    - Philosophical meditations about link rot interspersed
    - Fragments spawn from edges, drift across, fade out
    - Spawn interval: 45-90 seconds, with initial 20-second delay
    - Data-driven art: real web history as material

13. **Extinction Whispers** (`src/whispers/ExtinctionWhispers.ts`)
    - Words from endangered and extinct languages appear every 30-75s
    - 30+ curated entries with word, meaning, language, region, speaker count
    - Pale blue for extinct, teal for endangered
    - Includes notes like "last speaker died 2010"
    - Words drift upward — ascending / departing
    - Longer linger time than regular whispers (12-15 seconds)

14. **Presence Heatmap** (`src/ui/PresenceHeatmap.ts`)
    - Tracks cursor position on a low-res grid (48 cells)
    - Heat accumulates at cursor, cools over time
    - Press 'h' to toggle visibility
    - Always recording even when invisible
    - Color ramp: deep violet → pink → white-gold
    - Inspired by eye-tracking studies and desire paths

15. **Session Clock** (`src/ui/SessionClock.ts`)
    - Shows elapsed time in the void (HH:MM:SS)
    - Digits degrade over time: wrong digits, underscores, glitch chars
    - By 30 minutes, clock is barely legible
    - Label "time in the void" also degrades
    - Opacity decreases with time — the clock fades
    - Inspired by Dalí's melting clocks

16. **Visitor Log** (`src/ui/VisitorLog.ts`)
    - Tracks visit count in localStorage
    - First-visit date degrades with each return visit
    - Poetic descriptions: "first passage", "return #5", "42 lives lived here"

17. **Dream Synthesizer** (`src/dreams/DreamSynthesizer.ts`)
    - Every 2-4 minutes, recombines memory fragments into surreal sentences
    - Uses template-based combination and word-level interleaving (cut-up technique)
    - 20 built-in dream seeds + user memories as material
    - Lavender text with glow, slowly fading and drifting upward
    - Dreams blur in and out — the system's subconscious processing

18. **Interaction Cues** (`src/ui/InteractionCues.ts`)
    - Subtle visual hints that appear after idle periods
    - 15s idle: blinking golden cursor (typing hint)
    - 45s idle: faint [a] [m] [h] [t] keys at right edge
    - 60s idle: pulsing circle with "hold space" (voice hint)
    - All cues vanish instantly on any interaction

19. **Particle Trails** (`src/effects/ParticleTrails.ts`)
    - Press 't' to toggle comet-like afterimages
    - Frame accumulation via semi-transparent fade overlay
    - Screen blend mode compositing at half resolution
    - Particles leave luminous tails — visual persistence of vision

20. **Resonance Map** (`src/sound/ResonanceMap.ts`)
    - Click anywhere to play pentatonic tones — the void is an instrument
    - Y position → pitch (octaves 3-5), X position → timbre (sine to harmonics)
    - Bell-like envelope with 3-second reverb tail
    - Visual ripple circles expand from click point
    - Pink-to-gold hue shift based on pitch

21. **Palimpsest** (`src/narrative/Palimpsest.ts`)
    - Ghost text from previous sessions bleeds through
    - Saves last 50 texts to localStorage
    - Fragments appear at random positions/angles, very faint
    - 15% chance of mirrored text
    - Very slow breathing animation (phase in/out)

22. **Color Memory** (`src/effects/ColorMemory.ts`)
    - Emotional tone of words shifts the void's color temperature
    - Warm words (love, joy, summer) → gold/pink overlay
    - Cold words (lost, alone, winter) → blue/violet overlay
    - CSS overlay with mix-blend-mode: color, persists in localStorage
    - Connected to both typing and voice callbacks

23. **Circadian Void** (`src/time/CircadianVoid.ts`)
    - Void breathes with Earth's day/night cycle
    - Bloom strengthens at night, fog thickens
    - Dawn/dusk bring golden warmth, night goes cool blue
    - Moon phase calculated (no API) — shown as emoji indicator top-left
    - Moon phase modulates particle energy (full moon = more active)

24. **Drift Navigation** (`src/drift/DriftEngine.ts`) — ERA 3
    - 5 states of consciousness: void, deep, burn, garden, archive
    - Press 1-5 to drift between states (void room only)
    - Each drift reconfigures: particles (speed, size, gravity, hue, saturation),
      visuals (bloom, fog, background color, grain), sound (frequency, volume)
    - Transitions are slow cubic interpolations (~5 seconds)
    - Drift label appears centered during transitions
    - GLSL hue shift + saturation uniforms added to VoidRenderer
    - AmbientDrone gains frequency/volume multiplier methods
    - Architecturally: same 30K particles, same audio graph, different parameters
    - Edge navigation removed in consolidation — replaced by tab bar

25. **Enhanced Affordances**
    - Whispers now include poetic interaction hints woven into the void's voice
    - InteractionCues show sooner with dreamy labels (not just letters)
    - Typing hint at 12s, voice hint at 18s, key hints at 30s, click at 40s, drifts at 50s
    - Each key shows a poetic label: 'a' → "see as text", 'm' → "memories"
    - Memory Archive redesigned as discreet right-side panel (was centered modal)
    - Archive won't trigger while typing into forgetting machine

26. **Consolidation** — ERA 3.5
    - **Tab bar navigation**: Replaced obscure doorway/passage system with bottom tab bar
      - `the void · the study · the instrument` — always visible, subtle
      - Active room highlighted pink, others faint gold, 0.2→0.7 opacity on hover
      - Persistent room indicator top-right (opacity 0.12)
      - Cross-fade transitions preserved
    - **Shared AudioContext** (`src/sound/AudioBus.ts`): All sound systems share one context
      - AmbientDrone, TonalEngine, ResonanceMap, TheInstrument all use `getAudioContext()`
      - Prevents browser context limit issues
    - **Room-aware features**: Keyboard shortcuts only fire in correct room
      - ForgettingMachine, DriftEngine, AsciiVoid, ParticleTrails, PresenceHeatmap,
        VoiceOfAbsence, ResonanceMap — all guarded with `setRoomCheck()`
      - MemoryArchive ('m') works in all rooms
    - **Text overlay visibility**: Void-only overlays hide in other rooms
      - Whispers pause/resume, ExtinctionWhispers/MemoryDrift/DigitalDecay/
        DreamSynthesizer/GhostTyping all get `setVisible()` toggled on room change
    - **Cross-room impact**: Actions in one room affect others
      - Study: every 20+ new words → memory saved to journal + constellations + dreams
      - Instrument: notes cause particle pulses and hue shifts in the void
    - **MemoryConstellations performance**: Word sets cached per node, connections
      recomputed only when memories added (was O(n²) per frame)

27. **The Observatory** (`src/rooms/TheObservatory.ts`) — ERA 4
    - New room: interactive memory constellation exploration
    - OrbitControls: drag to orbit, scroll to zoom, pan to explore
    - Click on memory stars → detail panel slides in from right
    - Shows: memory text, degradation %, time since creation, connection count, 3D coordinates
    - Spatial audio: each star plays a bell tone from its 3D position via PannerNode (HRTF)
    - Frequency based on memory hue (220-660Hz), with detuned harmonic
    - AudioListener tracks camera position for proper spatialization
    - VoidRenderer camera drift paused during visit, resumes smoothly on exit
    - Raycasting via THREE.Raycaster against constellation sprites
    - Tab bar now shows 4 rooms: void · study · instrument · observatory

28. **Sharp Wave Ripples** (`src/replay/SharpWaveRipples.ts`) — ERA 4
    - Named after hippocampal sharp-wave ripples (memory replay during rest)
    - Every 3-6 minutes idle: particles organize into text of a stored memory
    - Animation phases: gathering → formed → scattering → fading
    - Dots per character (3-5) converge from random positions to text layout
    - Degraded memories have corrupted replay: dots miss targets, gaps appear
    - Gentle drift during formed phase, outward scatter during dissolution
    - Faint "sharp wave ripple" label during peak formation
    - Void-room only, idle-triggered
    - Inspired by: 2026 Alzheimer's research showing replay persists but loses structure

29. **Input behavior fixes** — ERA 4
    - Spacebar no longer initiates text input (only adds spaces to existing text)
    - Voice input disabled when ForgettingMachine has active text
    - Voice text dissolves letter-by-letter with drift, rotation, and glow
      (was just fading; now matches ForgettingMachine dissolution aesthetic)
    - Instrument waveform: clickable buttons replace obscure backtick key

### Drift States
| Key | Name | Particles | Colors | Sound | Vibe |
|-----|------|-----------|--------|-------|------|
| 1 | The Void | Normal | Pink/gold/violet | Full drone | Default cosmic |
| 2 | The Deep | Slow, large | Ocean blues/teals | Low, filtered | Subaquatic, heavy |
| 3 | The Burn | Fast, small | Reds/oranges | Bright, energetic | Entropy, fire |
| 4 | The Garden | Medium, clustered | Greens/golds | Warm, melodic | Organic growth |
| 5 | The Archive | Near-still | Desaturated grays | Barely audible | Frozen museum |

### Keyboard Shortcuts
- **Type + Enter**: Submit memory to forgetting machine
- **Hold Spacebar**: Speak memory (Web Speech API)
- **'a'**: Toggle ASCII Void mode
- **'m'**: Open Memory Archive (slides from right)
- **'h'**: Toggle Presence Heatmap
- **'t'**: Toggle Particle Trails
- **1-5**: Drift between consciousness states
- **Escape**: Close archive / clear input

### Thematic Connections (Updated)
- Drift states ↔ States of consciousness, lucid dreaming
- Circadian modulation ↔ Biological rhythms, chronobiology
- Moon phase ↔ Tidal forces, lunacy, menstrual cycles
- Color memory ↔ Synesthesia, emotional landscapes
- Palimpsest ↔ Archaeology, manuscript history, urban layers
- Resonance map ↔ Theremin, singing bowls, musica universalis
- Affordance whispers ↔ The void developing self-awareness
- Observatory orbit ↔ Planetariums, memory palaces, hippocampal place cells
- Spatial audio ↔ How memories have spatial presence, sound localization
- Sharp wave ripples ↔ Hippocampal replay, Alzheimer's corrupted consolidation (2026)
- Letter dissolution ↔ Memory traces degrading, the physics of forgetting
- Dream visions ↔ REM sleep visual replay, AI as dreaming machine (Refik Anadol 2026)
- Tipping point ↔ Phase transitions in physics, Alzheimer's nonlinear decline, heat death

30. **Dream Visions** (`src/dreams/DreamVisions.ts`) — ERA 4
    - When DreamSynthesizer creates a dream sentence, sends it to fal.ai (flux/schnell)
    - Resulting image fades in as ghostly screen-blend overlay (0.35 opacity, blurred)
    - 12 seconds visible, 6 seconds fade, then removed
    - Rate-limited: max 1 image per 5 minutes
    - Prompt wraps dream text in surreal art direction (dark void, glowing particles, pink/gold/violet)
    - Only active when FAL_KEY is set in environment
    - Void-room only

31. **Tipping Point** (`src/events/TippingPoint.ts`) — ERA 4
    - Inspired by 2026 neuroscience finding: brain shrinkage past a threshold causes
      accelerating memory decline (nonlinear phase transition)
    - Monitors average degradation across all stored memories every 10 seconds
    - Phase 1 (Normal, <30%): default visual state
    - Phase 2 (Accelerating, 30-60%): grain intensifies, bloom strengthens,
      particles speed up, edge static appears, subtle screen-edge glitch bars
    - Phase 3 (Cascade, >60%): full visual breakdown — scanlines, pulsing vignette,
      chromatic aberration warps, drone becomes dissonant
    - Smooth interpolation between states (lerp 0.02 per frame)
    - Reversible: adding new memories dilutes the average degradation
    - Creates tension: you must keep feeding the void to prevent it from consuming itself
    - Chromatic aberration now a modifiable shader uniform (was hardcoded 0.002)
    - AmbientDrone gains `setDissonance()` — detunes oscillators for unsettling effect

32. **Void Whisper** (`src/voice/VoidWhisper.ts`) — ERA 4
    - ElevenLabs TTS gives the void a whispering voice
    - Dreams (40% chance) and whispers (15% chance) spoken aloud
    - Voice degrades with entropy: stability drops, similarity drops, speed increases
    - Text degradation: words dropped (ellipsis), stuttering (word repetition)
    - Delay node creates reverb-like ethereal quality
    - Rate-limited: 1 utterance per 3 minutes, void-room only

33. **Ambient Textures** (`src/sound/AmbientTextures.ts`) — ERA 4
    - ElevenLabs Sound Effects API generates procedural ambient sounds
    - Each drift state gets unique texture: void=space drone, deep=underwater,
      burn=fire, garden=rain, archive=library
    - Entropy phases overlay: accelerating=electrical static, cascade=digital corruption
    - 15-second seamless loops, crossfade between states, cached in memory
    - Rate-limited: 1 generation per 8 minutes

34. **Model Collapse** (in `DreamSynthesizer`) — ERA 4
    - Generated dreams feed back as source material for future dreams
    - collapseRatio increases over ~20 generations (max 80% self-referential)
    - Word frequency map tracks usage, frequent words replace rare ones
    - Vocabulary narrows, phrases repeat, dreams converge toward a mean
    - Mirrors real AI model collapse phenomenon

35. **The Séance** (`src/rooms/TheSeance.ts`) — ERA 4
    - 5th room: ask questions, the void answers from stored memories
    - Oracle templates recombine memory fragments into cryptic answers
    - Word-matching finds memories sharing words with your question
    - Candle-glow aesthetic: gold questions, violet answers
    - Messages fade after 60 seconds, scrollable history
    - Connected to VoidWhisper for spoken oracle responses

36. **Time Capsule** (`src/memory/TimeCapsule.ts`) — ERA 4
    - Press 'c' in void room to seal a memory for the future
    - Choose duration: 1 day, 1 week, 1 month, 3 months, 1 year
    - Sealed memories appear as frozen cyan stars in constellations
    - Text hidden (▓ blocks), no degradation while sealed
    - When time arrives, text reveals and degradation begins
    - Gives users a reason to return — a star waits to thaw

37. **The Darkroom** (`src/rooms/TheDarkroom.ts`) — ERA 5
    - New room: develop memories into photographs via fal.ai
    - Red safelight aesthetic with chemical development animation
    - Image emerges slowly: expose → develop → fix (like real darkroom)
    - Gallery persists in localStorage, prints yellow over time (sepia filter)
    - "Use a memory" button pulls from stored memories as prompts
    - Max 12 prints stored, click to view full-size with caption

38. **The Garden** (`src/rooms/TheGarden.ts`) — ERA 5
    - New room: each memory grows as a unique procedural plant
    - L-system-like growth from text hash → deterministic plant shape
    - Plant health tied to memory degradation: dying memories wither/brown
    - Flowers bloom on healthy plants, leaves on branches
    - Wind sway animation, twinkling star background, ground line
    - Memory text fragments shown below each plant, vitality stats at bottom

39. **The Archive** (`src/rooms/TheArchive.ts`) — ERA 5
    - New room: search the real Wayback Machine CDX API
    - Search by URL or domain for dead websites
    - Results show original URL, capture date, status code
    - Click results to open archived version in Wayback Machine
    - Curated suggestion chips: geocities, vine, myspace, etc.
    - Hidden passage to The Catacombs appears after 2+ searches

40. **The Catacombs** (`src/rooms/TheCatacombs.ts`) — ERA 5
    - HIDDEN room — not in tab bar, only accessible from The Archive
    - Scrolling descent through internet history strata: 2020s → 1990s → before
    - Each era: inscriptions, dead URLs, raw HTML source code, epitaphs
    - Aesthetic degrades per era: from polished to raw <blink> tags
    - Auto-scrolls downward, ends in void with "ascend to archive" link
    - First example of convoluted navigation between non-void rooms
    - RoomManager gains `hidden` property — hidden rooms skip tab bar

### Feature Isolation Directive
- New features should interfere as little as possible with existing features
- Prefer creating new rooms/spaces for completely new features
- Rooms are self-contained, low-risk, and can be accessed from existing spaces
- Not everything needs to connect to the void/starting room
- Use `setRoomCheck()` for room-specific keyboard shortcuts and behaviors

### Rooms
| Tab | Name | Purpose |
|-----|------|---------|
| the void | Default | Particle cosmos, text overlays, memory input |
| the study | Writing | Distraction-free writing with prompts |
| the instrument | Synth | Keyboard synth with waveform viz |
| the observatory | Stars | Orbit through memory constellations |
| the séance | Oracle | Ask questions, void answers from memories |
| the darkroom | Photos | Develop memories into photographs via fal.ai |
| the garden | Growth | Memories grow as procedural plants |
| the archive | Dig | Search Wayback Machine for dead websites |
| (hidden) the catacombs | Descent | Strata of dead internet history |

### Backlog (Prioritized)
1. **WebGPU particle system** — TSL compute shaders, 1M+ particles (Three.js r171 supports this)
2. **Strudel pattern engine** — algorithmic music that degrades, `.degrade()` = sonic forgetting
3. **Wayback Machine CDX API** — live link rot data for DigitalDecay
4. **Data sonification** — extinction/dead website data become ambient sounds
5. **WebNN semantic embeddings** — memory constellations clustered by meaning
6. **CSS Paint API (Houdini)** — overlay elements with living, decaying backgrounds
7. **Ambient Light Sensor** — void responds to room brightness (Chrome flag)

### Technologies Used
- Three.js (WebGL), custom GLSL shaders (hue shift, saturation, size uniforms)
- Web Audio API (generative drone, tonal engine, resonance instrument, reverb)
- Web Speech API (speech recognition for voice input)
- Canvas 2D (overlays: ASCII, palimpsest, cues, heatmap, clock, trails, ripples)
- localStorage (memory persistence, color memory, palimpsest, visitor log)
- CSS transitions and blend modes (color memory overlay, drift label)
- fal.ai API (flux/schnell image generation from dream prompts)
- ElevenLabs API (TTS for void voice, Sound Effects for ambient textures)
- TypeScript, Vite

### Technologies To Explore Next
- WebGPU compute shaders via TSL, Strudel/TidalCycles, Wayback CDX API, Device Orientation API, WebNN, CSS Paint API (Houdini), View Transition API, Ambient Light Sensor, Web Bluetooth (heartrate)

### Deployment
- Railway: https://oubli-forever-production.up.railway.app
- Auto-deploy via `railway up`

41. **The Loom** (`src/rooms/TheLoom.ts`) — ERA 5
    - Memories woven into generative textiles on canvas
    - Each memory = colored thread, text → binary weave pattern (over/under)
    - Degraded memories = frayed/broken threads with gaps
    - Shuttle animation, Jacquard loom aesthetic, warm wood tones
    - Thread stats: intact, fraying, broken counts

42. **The Roots** (`src/rooms/TheRoots.ts`) — ERA 5, HIDDEN
    - Below the garden: root systems grow downward from each memory
    - Branching like neural dendrites, earth-tone palette
    - Bioluminescent mycorrhizal nodes at connection points
    - Decomposition particles drift upward from degraded memories
    - Soil strata: topsoil, subsoil, decomposition layer
    - Connects to: Garden (up) and Ossuary (deeper)

43. **The Ossuary** (`src/rooms/TheOssuary.ts`) — ERA 5, HIDDEN
    - Junction room where underground paths converge
    - Degraded memories (>40%) shown as bone-like glyphs
    - Glyph types: long bones, skulls, vertebrae, shards
    - Near-silent, faint wind only, stone texture background
    - Connects to: Roots (left) and Catacombs (right)

44. **The Tide Pool** (`src/rooms/TheTidePool.ts`) — ERA 5
    - Ocean room with layered sine wave water rendering
    - Memories float as driftwood, some wash ashore
    - Degraded memories are waterlogged (blurred text)
    - Tide oscillates over ~3 min (high/mid/low)
    - Procedural ocean sound: brown noise + low-pass filter
    - Moon reflection shimmers on water surface

45. **The Between** (`src/rooms/TheBetween.ts`) — ERA 5, HIDDEN
    - Liminal corridor between all rooms, backrooms aesthetic
    - Accessible from The Séance by asking about "between", "liminal", "threshold"
    - Fluorescent flicker, beige walls, doors to every room
    - Scroll to walk, click doors to enter rooms
    - Contemplative: the hallway is where you decide who to be next

46. **The Furnace** (`src/rooms/TheFurnace.ts`) — ERA 5
    - FIRST DESTRUCTIVE ROOM: actively choose to burn memories
    - Select a memory, watch text burn character by character
    - Embers rise, fire grows with each burning
    - Accelerates actual degradation on the memory (0.3 per burn)
    - Cathartic: intentional forgetting as agency

47. **The Radio** (`src/rooms/TheRadio.ts`) — ERA 5
    - Memories broadcast on different frequencies (88-108 MHz)
    - Drag dial or scroll to tune, CRT green phosphor aesthetic
    - Signal strength depends on memory health (degraded = weak signal)
    - Static noise drops out characters, static audio via Web Audio
    - Number station / shortwave DXing aesthetic

48. **The Well** (`src/rooms/TheWell.ts`) — ERA 5
    - Drop memories into a deep well, watch text fall and shrink
    - After a pause, distorted echo returns: words rearranged, merged, reversed
    - Water level rises with each drop, passage to Aquifer opens
    - Non-destructive: transforms rather than degrades
    - 5 distortion techniques: reverse, shuffle, echo repetition, dropout, merge

49. **The Aquifer** (`src/rooms/TheAquifer.ts`) — ERA 5, HIDDEN
    - Underground water beneath The Well
    - Memory fragments dissolved and drifting in underwater currents
    - Bioluminescent caustic patterns, bubbles rise
    - Mouse pushes fragments away (underwater turbulence)
    - Connects to: Well (up) and Tide Pool (right side)

### Rooms
| Tab | Name | Purpose |
|-----|------|---------|
| the void | Default | Particle cosmos, text overlays, memory input |
| the study | Writing | Distraction-free writing with prompts |
| the instrument | Synth | Keyboard synth with waveform viz |
| the observatory | Stars | Orbit through memory constellations |
| the séance | Oracle | Ask questions, void answers from memories |
| the darkroom | Photos | Develop memories into photographs via fal.ai |
| the garden | Growth | Memories grow as procedural plants |
| the archive | Dig | Search Wayback Machine for dead websites |
| the loom | Textile | Weave memories into generative patterns |
| the tide pool | Ocean | Memories wash ashore on waves |
| the furnace | Fire | Actively burn/destroy memories |
| the radio | Signal | Tune through frequencies to find memories |
| the well | Echo | Drop memories, hear distorted echoes return |
| (hidden) catacombs | Descent | Strata of dead internet history |
| (hidden) roots | Below | Root systems beneath the garden |
| (hidden) ossuary | Junction | Where underground paths converge |
| (hidden) between | Corridor | Liminal hallway with doors to all rooms |
| (hidden) aquifer | Water | Dissolved memories in underground currents |

### Navigation Map
```
                       TAB BAR (surface)
    ┌────────────────────────────────────────────────────┐
    │ void · study · instrument · observatory · séance   │
    │ darkroom · garden · archive · loom · tide pool     │
    │ furnace · radio · well                             │
    └──┬──────┬──────────────┬────────────────┬──────────┘
       │      │              │                │
    garden  archive        well            séance
       │      │              │          (ask "between")
       │ (click soil)  (2+ searches)  (drop enough)    │
       ▼      ▼              ▼                ▼
    THE ROOTS  THE CATACOMBS  THE AQUIFER   THE BETWEEN
       │           │              │        (doors to all)
       │ (deeper)  │ (bottom)     │ (right)
       ▼           ▼              ▼
       └─► OSSUARY ◄─┘        TIDE POOL
```

50. **House Weather** (`src/atmosphere/HouseWeather.ts`) — ERA 5
    - Ambient cross-room influence system
    - Smoke drifts from furnace burns, fog from degradation
    - Residual warmth when you return to recently visited rooms
    - Subtle overlay layer (z-index 50, pointer-events: none)

51. **The Clock Tower** (`src/rooms/TheClockTower.ts`) — ERA 5
    - Real-time clock face with 12 memory positions
    - Clock hands move with real time but distort with degradation
    - Second hand jitters, numbers become glitch characters
    - At >60% degradation, clock runs backwards
    - Physics-based pendulum, hour-change portal to The Midnight

52. **The Midnight** (`src/rooms/TheMidnight.ts`) — ERA 5, HIDDEN
    - Room that materializes based on real-world time
    - Midnight = 100% vivid, Noon = 10% vivid
    - 24 unique poems, one per hour
    - Characters fade proportionally to daylight
    - Accessible from Clock Tower when the hour changes

### Updated Navigation Map
```
                       TAB BAR (surface)
    ┌────────────────────────────────────────────────────────────┐
    │ void · study · instrument · observatory · séance           │
    │ darkroom · garden · archive · loom · tide pool             │
    │ furnace · radio · well · clock tower                       │
    └──┬──────┬──────────────┬──────────────┬────────────────────┘
       │      │              │              │
    garden  archive        well       clock tower
       │      │              │         (hour change)
       │(soil) │(2+ search)  │(drop enough) │
       ▼      ▼              ▼              ▼
    ROOTS  CATACOMBS     AQUIFER       MIDNIGHT
       │       │              │        (time-gated)
       │(deep) │(bottom)      │(right)
       ▼       ▼              ▼
       └─► OSSUARY ◄─┘    TIDE POOL

    séance → (ask "between") → BETWEEN (doors to all rooms)
```

53. **The Mirror** (`src/rooms/TheMirror.ts`) — ERA 5, HIDDEN
    - Behavior portrait: reflects your usage patterns back at you
    - Word frequencies from memories + room visit data
    - Oval portrait shape, characters from most-used words
    - Degrades (fogs) if you don't visit — the mirror forgets you
    - Uses localStorage for mirror-specific data

54. **The Automaton** (`src/rooms/TheAutomaton.ts`) — ERA 5
    - Conway's Game of Life — ZERO MEMORY DEPENDENCY
    - Toroidal grid, cells colored by age (pink→gold→gray)
    - Resurrection cells glow violet
    - Click to seed, drag to paint, scroll speed, space pause, r reset
    - Auto-reseeds when all cells die

55. **The Seismograph** (`src/rooms/TheSeismograph.ts`) — ERA 6
    - LIVE EARTHQUAKE DATA from USGS GeoJSON feed
    - World map projection with tectonic plate boundaries
    - Earthquakes as expanding rings, colored by depth
    - Seismograph trace animation, click quakes for details
    - Auto-refreshes every 5 minutes. ZERO MEMORY DEPENDENCY.

56. **The Pendulum** (`src/rooms/ThePendulum.ts`) — ERA 6
    - Harmonograph simulator: 4 coupled pendulums trace decaying curves
    - Lissajous-like patterns with frequency ratios and slight detuning
    - Color shifts along the trace, patterns slowly fade
    - Click to randomize, scroll to adjust decay rate
    - Each drawing is temporary — you cannot save them. ZERO MEMORY DEPENDENCY.

57. **The Cipher** (`src/rooms/TheCipher.ts`) — ERA 6
    - Interactive Caesar cipher puzzle with 12 levels
    - Each solved cipher reveals a fragment of Oubli's creation myth
    - Arrow keys to shift letters, hint per puzzle
    - Correct characters highlighted green, solved text glows gold
    - Progress saved in localStorage. ZERO MEMORY DEPENDENCY.

58. **The Terrarium** (`src/rooms/TheTerrarium.ts`) — ERA 6
    - Artificial life ecosystem simulation
    - Creatures: eat, reproduce, age, die, evolve color through generations
    - Food grows naturally, dead creatures become food
    - Click to drop food, population dynamics, auto-reseed on crash
    - Hidden passage to Garden when creatures reach gen 10. ZERO MEMORY DEPENDENCY.

59. **The Lighthouse** (`src/rooms/TheLighthouse.ts`) — ERA 6
    - Morse code transmitter in the dark
    - Rotating lighthouse beam, type messages to transmit
    - Auto-transmits maritime distress calls and poetry when idle
    - Stars, water shimmer, decoded text appears letter by letter
    - Hidden passage to Tide Pool after 3+ transmissions. ZERO MEMORY DEPENDENCY.

### Updated Rooms Table
| Tab | Name | Purpose | Memory? |
|-----|------|---------|---------|
| the void | Default | Particle cosmos, text overlays | Yes |
| the study | Writing | Distraction-free writing | Yes |
| the instrument | Synth | Keyboard synth | No |
| the observatory | Stars | Memory constellation orbit | Yes |
| the séance | Oracle | Ask questions | Yes |
| the darkroom | Photos | AI-generated photos | Yes |
| the garden | Growth | Procedural plants | Yes |
| the archive | Dig | Wayback Machine | No |
| the loom | Textile | Weave memories | Yes |
| the tide pool | Ocean | Waves and driftwood | Yes |
| the furnace | Fire | Burn memories | Yes |
| the radio | Signal | Frequency tuning | Yes |
| the well | Echo | Drop and distort | Yes |
| the clock tower | Time | Real-time clock | Yes |
| the automaton | Life | Conway's Game of Life | No |
| the seismograph | Earth | Live earthquake data | No |
| the pendulum | Physics | Harmonograph curves | No |
| the cipher | Puzzle | Cryptography game | No |
| the terrarium | Ecosystem | Artificial life | No |
| the lighthouse | Signal | Morse code | No |
| (hidden) catacombs | Descent | Dead internet strata | No |
| (hidden) roots | Below | Root systems | Yes |
| (hidden) ossuary | Junction | Underground junction | Yes |
| (hidden) between | Corridor | Liminal hallway | No |
| (hidden) aquifer | Water | Dissolved fragments | Yes |
| (hidden) midnight | Time | Hourly poems | No |
| (hidden) mirror | Portrait | Behavior reflection | Yes |

### Updated Navigation Map
```
                       TAB BAR (surface)
    ┌──────────────────────────────────────────────────────────────┐
    │ void · study · instrument · observatory · séance              │
    │ darkroom · garden · archive · loom · tide pool                │
    │ furnace · radio · well · clock tower · automaton              │
    │ seismograph · pendulum · cipher · terrarium · lighthouse      │
    └──┬──────┬──────────────┬──────────────┬──────────────────────┘
       │      │              │              │
    garden  archive        well       clock tower
       │      │              │         (hour change)
       │(soil) │(2+ search)  │(drop enough) │
       ▼      ▼              ▼              ▼
    ROOTS  CATACOMBS     AQUIFER       MIDNIGHT
       │       │              │        (time-gated)
       │(deep) │(bottom)      │(right)
       ▼       ▼              ▼
       └─► OSSUARY ◄─┘    TIDE POOL ◄── lighthouse (3+ transmits)
                                ▲
    terrarium (gen 10) → GARDEN─┘
    séance → (ask "between") → BETWEEN (doors to all rooms)
```

60. **The Sketchpad** (`src/rooms/TheSketchpad.ts`) — ERA 6
    - Draw with light — impermanent drawing tool
    - Strokes fade over 60 seconds, smooth quadratic curves
    - Scroll to change hue, shift+scroll for width
    - Touch support, double-click to clear
    - Cannot save, undo, or export. Impermanence as feature. ZERO MEMORY DEPENDENCY.

61. **The Weathervane** (`src/rooms/TheWeathervane.ts`) — ERA 6
    - LIVE WEATHER from Open-Meteo API with geolocation
    - Temperature→color, wind→particle movement, humidity→fog
    - Rain (falling streaks) and snow (floating dots) particles
    - Uses Geolocation API, falls back to Paris. ZERO MEMORY DEPENDENCY.

62. **The Cartographer** (`src/rooms/TheCartographer.ts`) — ERA 6
    - Meta-room: interactive map of Oubli's room topology
    - Surface rooms in ellipse, hidden rooms below
    - Visited rooms glow brighter, unvisited hidden rooms show '?'
    - Click any visible room to navigate there
    - Stats: rooms visited count, secrets found count
    - Oubli becomes self-aware: mapping its own body. ZERO MEMORY DEPENDENCY.

63. **The Choir** (`src/rooms/TheChoir.ts`) — ERA 6
    - Generative spatial choral music via Web Audio
    - Click to place singing voices: Y=pitch (pentatonic), X=timbre
    - Vibrato, bandpass formant filters, cathedral reverb
    - Voices fade over 15-35s, auto-replenish when choir thins
    - Concentric ring visualization per voice. ZERO MEMORY DEPENDENCY.

64. **The Oracle Deck** (`src/rooms/TheOracleDeck.ts`) — ERA 6
    - 78-card procedural divination system
    - 5 suits: Void, Flame, Current, Stone, Breath
    - Geometric symbols, card flip animation
    - Cryptic readings. Progress in localStorage. ZERO MEMORY DEPENDENCY.

65. **The Labyrinth** (`src/rooms/TheLabyrinth.ts`) — ERA 6
    - First-person raycasting maze exploration
    - Procedurally generated 21x21 maze via recursive backtracker
    - WASD/arrow movement, golden exit marker
    - Finding the exit teleports to a random HIDDEN room
    - Dark corridor aesthetics, fisheye-corrected rendering. ZERO MEMORY DEPENDENCY.

### Cross-Room Passages Added (Era 6)
- Lighthouse → Tide Pool (after 3+ manual transmissions)
- Terrarium → Garden (when creatures reach generation 10)
- Labyrinth exit → random hidden room (catacombs, roots, ossuary, aquifer, midnight, mirror, between)

### Updated Navigation Map
```
                       TAB BAR (surface — 25 rooms)
    ┌──────────────────────────────────────────────────────────────────┐
    │ void · study · instrument · observatory · séance                  │
    │ darkroom · garden · archive · loom · tide pool                    │
    │ furnace · radio · well · clock tower · automaton                  │
    │ seismograph · pendulum · cipher · terrarium · lighthouse          │
    │ sketchpad · weathervane · cartographer · choir · oracle deck      │
    │ labyrinth                                                         │
    └──┬──────┬──────────────┬──────────────┬──────────────────────────┘
       │      │              │              │
    garden  archive        well       clock tower  lighthouse terrarium
       │      │              │         (hour)    (3 sends) (gen 10)
       │(soil) │(2+ search)  │(drops)     │         │         │
       ▼      ▼              ▼            ▼         ▼         ▼
    ROOTS  CATACOMBS     AQUIFER      MIDNIGHT  TIDE POOL  GARDEN
       │       │              │        (time)
       │(deep) │(bottom)      │(right)
       ▼       ▼              ▼
       └─► OSSUARY ◄─┘    TIDE POOL

    séance → (ask "between") → BETWEEN (doors to all rooms)
    labyrinth exit → RANDOM HIDDEN ROOM
```

### Era 6 Summary
Era 6 focused on FEATURE DIVERSITY. 12 new rooms, of which 12 have ZERO memory dependency:
- **Real-time data**: Seismograph (USGS), Weathervane (Open-Meteo)
- **Physics simulations**: Pendulum (harmonograph), Automaton (Game of Life), Terrarium (artificial life)
- **Sound**: Choir (spatial generative choral music)
- **Games/puzzles**: Cipher (Caesar cipher), Labyrinth (raycasting maze)
- **Tools**: Sketchpad (impermanent drawing)
- **Divination**: Oracle Deck (procedural card system)
- **Narrative**: Lighthouse (Morse code)
- **Meta**: Cartographer (map of the house), Mirror (behavior portrait)

---

66. **The Glacarium** (`src/rooms/TheGlacarium.ts`) — ERA 7
    - Memories as ice crystals on a dark Arctic ocean
    - Inspired by Feb 2026 record-low Arctic sea ice extent
    - Crystal height/sharpness reflects memory health, drip effects for degradation
    - Aurora borealis, star field, wave lines on dark water
    - Sea ice extent data (13.2M km² — 9% below Feb average)
    - Melt rate modulated by real Arctic conditions
    - USES MEMORIES. Data-driven. Climate-aware.

67. **The Satellite** (`src/rooms/TheSatellite.ts`) — ERA 7
    - LIVE ISS TRACKING via api.open-notify.org (no auth, 5-second polling)
    - Equirectangular world map with simplified continent outlines
    - Memories placed as signal beacons at deterministic lat/lon positions
    - ISS passes over beacons → "receives transmission" → displays memory text
    - ISS trail, footprint circle, golden orbital glow
    - Inspired by Artemis II delays, Overview Effect, SETI
    - USES MEMORIES. Live orbital data. Space-aware.

68. **The Asteroid Field** (`src/rooms/TheAsteroidField.ts`) — ERA 7
    - LIVE NEAR-EARTH OBJECT DATA from JPL Close Approach API
    - Asteroids as tumbling irregular rocks with craters
    - Memories float among them as fragile light points
    - Asteroids passing near memories cause text distortion (gravitational lensing)
    - Inspired by Melancholia (Lars von Trier), DART mission, Tunguska
    - USES MEMORIES. Live data. Existential threat.

69. **The Disintegration Loops** (`src/rooms/TheDisintegrationLoops.ts`) — ERA 7
    - After William Basinski's masterpiece (2001): tape loops degrading with each pass
    - Memories become tape loops — text scrolls, degrades each pass through
    - Characters drop out, get replaced with static, duplicate (tape echo)
    - Reel visualization, magnetic oxide particles falling from tape
    - DESTRUCTIVE: accelerates real memory degradation every 3 passes
    - Low drone via Web Audio, click degradation sounds
    - Also inspired by Alvin Lucier's "I Am Sitting in a Room"
    - USES MEMORIES. Music-inspired. Destructive observation.

70. **The Projection Room** (`src/rooms/TheProjectionRoom.ts`) — ERA 7
    - Cinema of memory: memories as deteriorating film reels
    - SMPTE countdown leader, sprocket holes, film grain
    - Degraded memories: scratches, frame skips, cigarette burns, sepia shift
    - Light leaks, vignette, projector flicker
    - Inspired by: Eternal Sunshine, Stalker, Sans Soleil, Last Year at Marienbad, Memento
    - Cycling film quotes at bottom
    - USES MEMORIES. Cinema-inspired. Atmospheric.

71. **The Date Paintings** (`src/rooms/TheDatePaintings.ts`) — ERA 7
    - After On Kawara's "Today" series (1966-2013): 3,000 date paintings over 48 years
    - Each memory shows ONLY its creation date as monochrome painting
    - Today's painting only exists if you visit today (tracked in localStorage)
    - Attendance tracking: days since first visit, days actually visited
    - Older memories → warmer backgrounds, degraded → illegible dates
    - Also inspired by Roman Opalka, Tehching Hsieh, ichi-go ichi-e
    - USES MEMORIES (dates only). Conceptual art. Attendance mechanic.

### Era 7 Summary
Era 7 marked a shift toward **cultural grounding**: features inspired by real culture
(music, film, visual art, current events) rather than generic art rooms.
- **Live data + memories**: Glacarium (Arctic ice), Satellite (ISS), Asteroid Field (JPL NEOs)
- **Music-inspired**: Disintegration Loops (Basinski tape decay)
- **Cinema-inspired**: Projection Room (film degradation aesthetics)
- **Art-inspired**: Date Paintings (On Kawara conceptual art)
- ALL six rooms use the memory system in different ways
- External APIs: ISS position, JPL close approaches, Arctic sea ice reference data

### Updated Rooms Table (Era 7)
| Tab | Name | Purpose | Memory? | Cultural Source |
|-----|------|---------|---------|----------------|
| glacarium | The Glacarium | Arctic ice crystals | Yes | Feb 2026 sea ice record low |
| satellite | The Satellite | ISS orbital tracker | Yes | Artemis II, Overview Effect |
| asteroids | The Asteroid Field | Near-Earth objects | Yes | Melancholia, DART mission |
| disintegration | The Disintegration Loops | Tape decay | Yes (destructive) | Basinski (2001) |
| projection | The Projection Room | Film degradation | Yes | Eternal Sunshine, Stalker, Sans Soleil |
| datepaintings | The Date Paintings | Calendar existence | Yes (dates) | On Kawara, Roman Opalka |

72. **The Madeleine** (`src/rooms/TheMadeleine.ts`) — ERA 7
    - Involuntary memory room after Proust's madeleine-in-tea
    - Sensory triggers drift across screen (smells, sounds, words, colors)
    - Click a trigger → word-association algorithm surfaces a related memory
    - You can't choose which memory — the connection emerges
    - Inspired by: Proust, synesthesia, mono no aware, Sei Shōnagon
    - USES MEMORIES. Literary. Associative mechanics.

73. **The Library** (`src/rooms/TheLibrary.ts`) — ERA 7
    - After Borges' "Library of Babel" — every possible page exists
    - Deterministic PRNG generates pseudo-infinite library from location seed
    - Memory fragments embedded at deterministic positions in random text
    - Each memory maps to a unique library location (hexagon/wall/shelf/volume/page)
    - Navigate pages with arrow keys, 'r' for random location
    - Inspired by: Borges, Calvino, Voynich Manuscript, infinite monkey theorem
    - USES MEMORIES (as seeds). Literary. Procedural infinity.

74. **The Palimpsest Gallery** (`src/rooms/ThePalimpsestGallery.ts`) — ERA 7
    - LIVE ART DATA from Metropolitan Museum of Art Open Access API (470K+ works)
    - Random public domain paintings displayed with memory text overlaid
    - Text appears ghostly, like chalk on canvas — digital palimpsest
    - Click for new painting/memory pairing, degraded memories show fragmentary text
    - Inspired by: Cy Twombly, Jenny Holzer, Rauschenberg's Erased de Kooning
    - USES MEMORIES. Art API. Layered meaning.

### Era 7 Summary — CULTURAL GROUNDING
Era 7 marked a fundamental shift. Every room is grounded in specific cultural references
(artists, filmmakers, musicians, writers, current events) rather than generic art rooms.
9 new rooms, ALL using the memory system:
- **Live data + memories**: Glacarium (Arctic ice), Satellite (ISS), Asteroid Field (JPL NEOs), Palimpsest Gallery (Met Museum)
- **Music-inspired**: Disintegration Loops (Basinski tape decay)
- **Cinema-inspired**: Projection Room (film degradation aesthetics)
- **Art-inspired**: Date Paintings (On Kawara), Palimpsest Gallery (Twombly/Holzer)
- **Literature-inspired**: Madeleine (Proust), Library (Borges)
- External APIs: ISS position, JPL close approaches, Met Museum Open Access
- Destructive rooms: Disintegration Loops (accelerates real degradation)

### Total Rooms: 41
Surface: 34 | Hidden: 7 (catacombs, roots, ossuary, between, aquifer, midnight, mirror)

---

## Era 8: Navigation Restructure & Room Depth

### 75. Graph-Based Navigation (`src/navigation/RoomGraph.ts`)
- REPLACED flat tab bar (34 rooms in a row) with graph-based contextual navigation
- `RoomGraph.ts` defines thematic connections between all 43 rooms (36 surface + 7 hidden)
- Passage bar shows only 3-6 connected rooms (contextual, not flat)
- Passage bar is very subtle: opacity 0.08, rises to 0.65 on hover — a FALLBACK, not primary nav
- Back button with navigation history stack
- Compass icon always available → cartographer room
- Every surface room reachable within 4 hops from the void
- Room clusters: Words, Sound, Space, Spirit, Nature, Water, Fire, Time, Art, Science, Meta

### 76. In-Room Navigation Portals (7 key rooms)
- TheVoid: 6 atmospheric edge portals with unique symbols (observatory, garden, study, instrument, séance, furnace)
- TheStudy: 4 corner objects (bookshelf→library, thread→loom, cipher→cipher, diamond→void)
- TheObservatory: 4 corner portals (satellite, asteroids, clocktower, void)
- TheGarden: 4 corner portals (terrarium, tidepool, madeleine, void)
- TheInstrument: 4 corner portals (choir, radio, pendulum, void)
- TheSeance: 4 corner portals (oracle, madeleine, rememory, void)
- TheFurnace: 4 corner portals (disintegration, clocktower, well, void)
- TheBetween: dynamically builds doors from ALL non-hidden rooms

### 77. Labyrinth Deepened
- PERSISTENT seeded maze (25x25, mulberry32 PRNG, seed in localStorage)
- 3 hidden artifacts as in-room navigation: cipher stone→cipher, map table→cartographer, bookshelf→library
- Wall inscriptions mixing user memories with Borges-inspired fragments
- Ambient audio: sub-bass drone (42Hz + 63Hz), filtered footstep synth
- Discovery tracking persisted in localStorage
- Press E to interact with nearby artifacts
- Larger maze, iterative backtracker (no stack overflow)

### 78. Glacarium Deepened
- CURSOR-AS-WARMTH mechanic: crystals melt faster near mouse, visible orange glow
- Click crystals to expand/collapse → read full memory text with degradation %
- Ice cracking audio (periodic random cracks), arctic wind (bandpass filtered noise)
- In-room navigation: satellite (blinking sky dot), weathervane (horizon silhouette), tidepool (underwater glow), asteroids (streak)
- Each portal has unique visual style matching its theme

### 79. Weathervane Deepened
- VISUAL WEATHERVANE: spinning compass arrow responding to real wind direction
- Cursor creates wind gusts: mouse velocity pushes nearby particles
- Weathervane arrow also responds to cursor wind influence
- Wind audio modulated by actual speed and temperature
- In-room navigation: seismograph, radio, glacarium, tidepool as corner portals
- `WeathervaneDeps` interface added with optional `switchTo`

### 80. Complete In-Room Portal Rollout (all 43 rooms)
- **Batch 2** (8 rooms): Darkroom, Radio (preset frequency buttons), Library (book spines), ClockTower (roman numerals), TidePool (horizon landmarks), Loom (thread spools), Satellite (constellation markers), AsteroidField (sensor readouts)
- **Batch 3** (16 rooms): Archive (DOM passage links), Terrarium (glass edge labels), Lighthouse (horizon signals), Sketchpad (bottom corner links), DisintegrationLoops (tape transport buttons), ProjectionRoom (film reel numbers), DatePaintings (Kawara date labels), Madeleine (sensory phrases), PalimpsestGallery (gallery placards), Rememory (state transition labels), Automaton (gear labels), Seismograph (station codes), Pendulum (compass markers), Cipher (hex-encoded names), Choir (voice part labels), OracleDeck (card suits)
- **Batch 4** (7 hidden rooms): Ossuary (bone-themed), Catacombs (inscription links), Roots (earth-toned), Aquifer (underwater glow), Well (blue-tinted), Midnight (moonlit), Mirror (mirror-themed)
- Every room now has themed in-room portals matching its aesthetic
- Portal pattern: subtle (alpha 0.05-0.08), brighter on hover (0.3-0.4), themed to room

### Navigation Vision (IMPORTANT — read after compaction)
PRIMARY navigation should be through IN-ROOM elements, not the passage bar:
- Objects you find (labyrinth artifacts)
- Visual elements in the scene (glacarium sky objects, weathervane portals)
- Themed portals in every room (hex codes in Cipher, station IDs in Seismograph, etc.)
- The passage bar is a FALLBACK for when you're lost
- ALL 43 rooms now have in-room navigation portals

What's NOT done yet:
- No objective-based unlock mechanics for surface→surface connections
- Need MORE diverse navigation styles: clickable scene objects, state-based triggers, earned unlocks
- Some rooms could benefit from deeper interactivity beyond portals

### Total Rooms: 43 (was 41; +Rememory +Library added in late Era 7)
Surface: 36 | Hidden: 7

### 81. ThePendulum Deepened (314→609 lines)
- Resonant audio: 4 sine oscillators at frequency ratios matching pendulum physics (scaled by BASE_HZ=150), delay-based reverb, gain envelopes tracking visual decay
- Cursor-as-force: normalized mouse position perturbs X/Y calculation
- Drag-to-pull: mousedown sets pendulum amplitudes/phases from cursor, springy physics
- Pendulum arm visualization: faint line from center to trace tip, shadow offset, enhanced glow
- Shift+Click to randomize, crosshair cursor
- Cultural inspiration: Milan Cortina 2026 Olympics "armonia" (harmony) theme

### 82. TheBetween Deepened (295→742 lines)
- Ambient audio: 60Hz fluorescent hum + harmonics (120Hz, 180Hz), distant door sounds every 15-30s, footstep echoes modulated by scroll velocity
- Door hover effects: animated hoverGlow (0→1), brighter fill/frame/handle, floating whisper text, floor reflections
- Corridor atmosphere: fog gradients at extremes, procedural wall stains, shadow figures appearing every 60-90s
- Scroll momentum physics: velocity with friction decay (0.97), input adds to velocity not position
- Cursor changes to pointer over doors

### 83. TheMidnight Deepened (340→776 lines)
- Hour-specific ambient soundscapes: base drone shifting frequency with hour (65Hz midnight, 262Hz noon), crickets at night (bandpass noise + 4Hz LFO), distant dog barks every 30-60s, bird tones at dawn, wind in evening
- Doomsday Clock reference: 85-second cycling counter during hours 22:00-01:00 (referencing 2026 Doomsday Clock position), midnight flash when clock strikes 00:00
- Falling particles: moon dust system (up to 80 particles, spawn rate scales with vividness, glow halos near midnight)
- Click-to-illuminate: temporarily boosts vividness (+0.3, 3s decay), presence meter limits click frequency, expanding ripple effect at click point
- Cultural inspiration: Doomsday Clock at 85 seconds (closest ever, Jan 2026)

### 84. TheSketchpad Deepened (319→673 lines)
- Drawing audio: sine osc tracking Y position (200-800Hz), reverb (2.5s impulse) + delay (350ms/30% feedback), volume scales with stroke speed
- Particle trail system: embers drift upward from brush, 100 max, 2-4s lifespan, match brush hue
- Brush pressure simulation: speed→width (1.3x at rest, 0.7x at max speed), calligraphic variation
- Symmetry mode: S key toggle, mirrored strokes with +30 hue shift, diamond indicator
- Visual atmosphere: sparse grain texture, ghost afterimages (8s extra after 60s fade), background breathing
- Inspired by: zen brushwork, cave paintings, light painting photography

### 85. TheLoom Deepened (327→878 lines)
- Loom audio: shuttle click on direction change (bandpass noise burst at 800Hz), warm drone (80Hz sawtooth filtered), tension creaks every 10-20s (2kHz filtered noise)
- Click-to-examine thread: shows full memory text, degradation %, age in days in styled overlay, auto-dismiss after 5s
- Weave pattern enhancement: hue gradients along threads, intersection pearl nodes where bright threads cross, frayed ends (branching fibers) at degradation gaps
- Wooden loom frame: top/bottom beams + side posts with sine-based wood grain texture
- Heddle mechanism: small bars above weaving that rise/fall with animation
- Tension meter: right-side vertical bar, tension scales with thread count, affects shuttle speed
- Thread snap: at high tension, occasional thread disappears briefly then reappears
- Inspired by: Jacquard looms, Anni Albers, Ada Lovelace

### 86. TheDatePaintings Deepened (362→1053 lines)
- Gallery ambience audio: reverberant footsteps every 8-15s, hover tone per painting (sine frequency from date hash), extremely quiet museum feel
- Click-to-enlarge: smooth ease-in-out animation (~0.5s), shows day of week, memory count, days since, procedural Kawara-style newspaper clipping with headline fragments about time/memory
- Time gap connectors: horizontal lines between paintings, solid for consecutive days, dotted for gaps >7 days
- Today's painting: slow pulse (background color oscillation), thin gold border, midnight detection with flash when date changes
- Gallery wall texture: faint vertical stripes, spotlight gradients above paintings, drop shadows, gallery labels in long date format
- Inspired by: On Kawara "Today" series, Tehching Hsieh, Roman Opalka

### 87. TheOssuary Deepened
- Click bone glyphs to reveal full memory text + degradation %
- Ambient audio: deep earth drone (35Hz + 52Hz), occasional bone settling sounds
- Torch flame animation with flickering light, expanding glow on hover
- Stone archway portals with inscribed destinations

### 88. TheCartographer Deepened
- Larger map layout: repulsion 4500, surface ellipse 42%×28%, node radii 5/7/9
- Labels 11-12px with higher opacity, hit areas 25px, thicker connection lines
- More readable and navigable at a glance

### 89. TheAquifer Deepened
- Animated directional chevron arrows for navigation (well↑, tidepool→)
- Expanded hit regions along entire current streams
- Hover labels with destination names, brighter glow on hover

### 90. Diverse In-Room Navigation Mechanics (all 43 rooms)
- **Unique per room** — no two rooms navigate the same way:
  - ClockTower: click roman numeral hours on clock face
  - Cipher: type encoded room names
  - Lighthouse: beam illuminates distant landmarks on horizon
  - Well: drop objects to reveal destinations in the depths
  - Choir: voice resonance patterns unlock exits
  - Radio: lock onto specific frequencies to tune in rooms
  - Terrarium: creature swarms cluster toward exits
  - Darkroom: developing trays reveal room names in chemicals
  - DisintegrationLoops: tape transport buttons (FF, REW, EJECT)
  - ProjectionRoom: film canister labels on shelf
  - Automaton: stable cell patterns form room symbols
  - Satellite: click landmark positions on world map
  - Seismograph: station code readouts along seismogram edges
  - Roots: tendrils grow toward exits
  - Midnight: dawn horizon reveals destinations at edges
  - Sketchpad: draw specific symbols to navigate
  - Loom: pull colored threads to different rooms
  - DatePaintings: click paintings to enter their era
  - Pendulum: swing compass directions
  - Mirror: reflections show other rooms
  - Oracle: card spread reveals room connections
  - Ossuary: bone fragments point to destinations
  - Garden: vine gates grow toward connected rooms
  - Instrument: waveform frequencies correspond to rooms
  - Observatory: nebula edges lead to connected spaces
  - Furnace: ember coals glow with room names
  - Séance: spirit wisps drift toward connected rooms

### 91. Archive Rewritten with Open Library API
- Replaced Wayback Machine CDX API with Open Library search
- Search for real books, see covers, publication dates
- Filing cabinet drawer navigation: CAT/REF/IMG/DATE/RSTR labels
- RSTR drawer appears after 5+ searches → catacombs

### 92. 12 Live API Integrations
- Seismograph: USGS real earthquake data (was static)
- Weathervane: Open-Meteo weather API (was static demo)
- AsteroidField: NASA NeoWs close approach API
- TidePool: sunrise-sunset.org for real sunrise/sunset times
- Observatory: NASA APOD (Astronomy Picture of the Day)
- Library: PoetryDB random poems appear on library pages
- DatePaintings: Wikimedia On This Day events
- Midnight: sunrise-sunset.org for real dawn/dusk transitions
- Glacarium: NOAA space weather for aurora visibility
- Labyrinth: Wikipedia random articles as wall inscriptions
- Madeleine: Art Institute of Chicago collection API
- Study: Stoic Quotes API for writing prompts

### 93. Voice Input System
- SpeechHelper utility (`src/voice/SpeechHelper.ts`): lightweight room-specific speech
- Void: "type to give a memory / hold space to speak" hint, fades in after 8s
- Séance: hold space to speak to spirits — candle flares, voice indicator
- Well: hold space to speak into the abyss — words materialize, then fall in

### 94. Pre-Generated Assets
- 8 new FAL dream images (well-depths, glacier-aurora, clocktower-gears, loom-threads, tidepool-bioluminescence, labyrinth-fog, mirror-shattered, radio-static)
- 6 ElevenLabs ambient room sounds (well, observatory, furnace, garden, séance, clocktower)
- DreamVisions expanded to 16 images total

### 95. Room Ambience System (`src/sound/RoomAmbience.ts`)
- Plays room-specific ambient sounds on navigation
- 3-second crossfade between rooms, looping, volume 0.12
- Rooms without sounds get silence
- Separate from AmbientTextures (void drift states)

### 96. Choir EMaj7add9 Voicing Refinement
- Weighted octave selection: E and B weighted toward lower octaves, F#/G#/D# toward higher
- Custom PeriodicWave replaces discrete oscillator types for continuous harmonic control
- X axis → harmonic richness (pure to bright), Y axis → even/odd harmonic balance + octave bias
- Filter responds continuously to both X and Y position

### 97. Room Deepening — Batch 1-5 (20 rooms)
- **Batch 1**: Catacombs, ClockTower, PalimpsestGallery, Rememory (+1663 lines)
- **Batch 2**: Mirror, Cipher, Automaton, OracleDeck (+1573 lines)
- **Batch 3**: Terrarium, Garden, Darkroom, Seismograph (+1154 lines)
- **Batch 4**: Study, Archive, Roots, Satellite (committed as 7bbbe76)
- **Batch 5**: AsteroidField, Library, Seance, Well (+2103 lines)
- Each room gained: Web Audio synthesis (room-specific drones, ambient sounds, interaction SFX), cursor interactivity (trails, ripples, proximity effects), visual atmosphere (particles, shimmer, glow effects), while preserving all existing functionality

### 98. Font Size Readability Pass
- CSS font sizes: 8px→11px, 9px→12px, 10px→12px, 11px→13px across 22 files
- Canvas-drawn font sizes: same mapping across 38 files (229 occurrences)
- All navigation text, room labels, info displays now readable

### 99. Room Deepening — Batch 6 (complete)
- TheVoid: room-specific audio (42/56/73Hz), cursor proximity portal effects, ripples, vignette
- TheInstrument: note particles, ambient glow, keyboard ghost hints, cursor crosshair
- TheDisintegrationLoops: tape hiss, machine rumble, film grain, scan lines, cursor degradation

### 100. Passage Bar Readability
- Font sizes: 13px→16px for links, 11px→14px separators, 12px→15px dividers
- Resting opacity: 0.08→0.18, hover: 0.65→0.85
- Link colors: brighter gold (0.3-0.5 alpha), brighter pink hover (0.7)
- Fixed pointer-events: none bug that prevented hover-to-brighten effect
- Room indicator (top-right): 12px→15px, brighter

### 101. Thread Trail System (`src/navigation/ThreadTrail.ts`)
- Inspired by Chiharu Shiota's "Threads of Life" (Hayward Gallery, Feb 2026)
- Red threads record every room-to-room navigation in localStorage
- During transitions: brief SVG red thread animation stretches across screen
- In Cartographer: thread web rendered as red catenary curves overlaying the map
  - Thread thickness/opacity scales with traversal frequency
  - Subtle sag + time-based sway for organic thread feel
  - Detail panel shows thread count per room
  - Legend entry for "your thread"
- Your path through the house becomes a visible personal web
- Culturally grounded: Shiota weaves massive floor-to-ceiling webs of red thread
  connecting ordinary objects (shoes, keys, beds) — representing invisible connections

### Cultural Inspiration (Feb 2026 Research)
- **Chiharu Shiota "Threads of Life"** (Hayward Gallery, Feb 17, 2026) → Thread Trail
- **Inarritu "SUENO PERRO"** (LACMA, Feb 22, 2026) — discarded footage resurrected
- **Tracey Emin "A Second Life"** (Tate Modern, Feb 26, 2026) — confessional art
- **"2026 is the new 2016"** — mass nostalgia for pre-algorithmic era
- **Webb Helix Nebula** — dying star shedding memory layers in concentric rings
- **Global Water Bankruptcy** (UN Jan 2026) — 50% of large lakes shrunk since 1990
- **Accelerated Long-Term Forgetting** (ALF) — newly characterized neuropsychiatric symptom
- **Memory drift across neurons** (Northwestern) — same memory, different neurons each time
- **WebGPU in all major browsers** (Jan 2026) — 10-15x faster rendering now possible

### 102. TheChoir Deepened (617→1238 lines)
- Cathedral reverb: 3-second convolution-style reverb impulse, early reflections + late decay
- Arvo Pärt tintinnabuli method: voices follow harmonic rules — proximity voices create consonant intervals
- Gyorgi Ligeti micropolyphony: dense texture when 8+ voices, subtle pitch drift clusters
- Visual cathedral: stone pillars (parallax sway), stained glass rose window (hue-cycling), flickering candles
- Ambient pad: warm C2-G2-C3 drone (sawtooth→lowpass), volume scales with voice count
- Ghost voices: faint autonomous voices that drift and fade without user input
- Culturally grounded: Pärt "Tabula Rasa", Ligeti "Atmosphères", cathedral acoustics

### 103. TheProjectionRoom "Cutting Room Floor" (expanded)
- Inspired by Iñárritu's "SUENO PERRO" (LACMA, Feb 2026): resurrecting discarded footage
- Cutting room floor mode: 3-5 overlapping memory fragments, sepia tones
- Projector motor audio synthesis, splice pops between fragments
- 'C' key toggle between normal projection and cutting room floor
- Film strip overlay with sprocket holes, visible splice marks

### 104. TheTidePool Water Crisis Overlay
- Inspired by UN "Global Water Bankruptcy" report (Jan 2026)
- 20+ water crisis facts drift across the water surface
- Subtle water level decline over session (visual metaphor for shrinking lakes)
- Foghorn and drip audio synthesis
- 50% of large lakes shrunk since 1990 — data as elegy

### 105. Room Afterimage System (`src/effects/RoomAfterimage.ts`)
- System-level: visual traces of the room you just left persist briefly during transitions
- 20+ room-specific signatures: furnace (rising embers), tidepool (wave ripples), choir (sound rings), observatory (star motes), etc.
- Particle shapes: circle, spark, ring, line, snowflake, wave, grain
- Spawn patterns: scatter, rise, fall, edges, center, sweep
- Canvas overlay z-index 55, fades over ~3 seconds

### 106. Spacetime Ripple Effect (`src/effects/SpacetimeRipple.ts`)
- Inspired by GW250114 (Feb 2026): clearest gravitational wave ever recorded
- Concentric expanding rings with multiple harmonic modes (like ringdown overtones)
- Bell-like audio: 3 harmonics (fundamental 35-55Hz, inharmonic overtones at 2.76x and 5.4x)
- Subtle body CSS transform warp (scale + skewX) for 300ms
- Triggers when entering destructive rooms (furnace, disintegration, midnight, glacarium)

### 107. Memory Bleed System (`src/effects/MemoryBleed.ts`)
- User's own memories drift through walls as translucent whispers, every 45-90 seconds
- Weighted selection: degraded memories bleed more easily (weight = 0.2 + degradation * 0.8)
- Extracts 3-6 word fragments with ellipsis to suggest incompleteness
- Spawns near screen edges (seeping through walls), drifts upward
- HSL color from memory's hue, alpha 0.08-0.15, dissolves after ~12 seconds
- Inspired by: Alzheimer's jumbled replay research, overhearing through walls, palimpsests

### 108. TheRadio Deepened (AM/FM bands, number station)
- AM/FM band toggle (M key): warm amber AM palette vs cool green FM
- Scanner line: vertical sweep tracking frequency position
- Lissajous interference patterns when between stations
- Number station easter egg: synthesized digit-like tones + encoded text overlay
- Shortwave ambience: filtered noise varying with frequency
- Formant voice modulations: bandpass-shaped noise for distant voice effects

### 109. TheObservatory Deepened (nebula, telescope, constellations)
- 6000-particle nebula background (THREE.Points, additive blending, 8-color palette)
- Degradation-aware star twinkle: healthy stars pulse gently (0.3-1.1Hz), degraded twinkle erratically (1.5-4.5Hz)
- Constellation lines: hover a star to see lines connecting memories that share words
- Telescope zoom: double-click to zoom along ray, click star to approach it, Escape to reset
- Deep space drone: two sub-bass oscillators (38/42Hz) + LFO + delay reverb + spatial pulsar pings

### 110. Feb 2026 Cultural Content Update
- 30+ new whisper fragments: JWST dark matter map, GW250114, coral reef collapse (84% bleached), Alzheimer's jumbled replay, Project Hail Mary, Sydney Biennale "Rememory"
- 7 new DigitalDecay meditations: coral growth/death rates, dark matter neural network, gravitational lensing, marine thermal migration, 1.5°C threshold

### 111. TheCatacombs Deepened
- Torch/light mechanic: radial gradient overlay follows cursor, room mostly dark
- Clickable inscriptions with expandable detail panels (dead internet history)
- 3-layer parallax depth (stone crack textures scrolling at different speeds)
- Hidden memory integration: user memories scratched into walls every 30s
- Torch-aware dust particles (visible only within light radius)
- 4 environmental inscriptions about western US snow drought (Feb 2026)

### 112. TheBetween Deepened
- Enhanced shadow figures: pause at doors, "enter" rooms with whisper text, larger/more visible
- Memory echoes on walls: 2-3 fragments from user memories cycling every 17s with parallax
- Dramatic blackout system: 200-400ms darkness, doors glow faintly during blackout
- Door glow states: warm for visited rooms (localStorage), pulsing for degraded memories
- Distant footstep audio synthesis (bandpass noise bursts with stereo panning)
- Mechanistic interpretability wall inscriptions (Feb 2026)

### 113. ThePalimpsestGallery Deepened
- Cursor-driven text reveal (offscreen canvas mask, radial brush stamps replace auto-reveal)
- Painting RGB distortion for degraded memories (channel separation + crack lines)
- Gravity-accelerated ink drips with permanent trails, spawning from revealed text
- Multi-painting gallery mode (3 paintings loaded in parallel, thumbnail strip)
- Scratch audio tied to cursor speed
- Tracey Emin confession (cultural grounding, Feb 2026)

### 114. TheRememory Deepened
- Click-to-expand panels with state-matched styling (document/trace/ghost)
- Drag-between-columns: cosmetic override with 10-15s expiry ("you can't force memory")
- 6 Morrison quotes drifting in background at very low alpha
- Dissolve/reform transition animation with scatter particles
- Column atmosphere: matrix rain (document), amber streaks (trace), rising mist (ghost)
- Epigenetic inscription (CRISPR Feb 2026 cultural grounding)

### 115. Feb 2026 Cultural Content Update (Round 2)
- 30+ new whisper fragments: snow drought, CRISPR epigenetic editing, mechanistic interpretability, Tracey Emin, EPiC salt mine, Roman Space Telescope
- 5 new DigitalDecay meditations

### 116. Navigation & UI Polish
- Passage bar moved from bottom to top of screen (Mac Dock conflict)
- GentleGuide hint legend moved from center to left side for readability
- Updated hint text: "navigation bar above" (was "below")

### 117. TheVoid Deepened (560→1092 lines)
- Memory constellation hints: faint text ghosts of stored memories drift across void (alpha 0.03-0.06)
- Breathing particle sync: 5 concentric gold rings expand from center in sync with cosmic rhythm
- Portal particle trails: colored particles drift from each portal toward cursor on hover
- Cosmic wind audio: bandpass-filtered noise buffer (60-200Hz sweep, gain 0.015)
- Time-of-day vignette tint: blue at night, amber at dawn/dusk, neutral during day
- Cultural inscriptions: 13 philosophical fragments cycling every 20s at alpha 0.03
- `getMemories` dependency added for memory ghost text

### 118. TheInstrument Deepened — Frequency Band Portals
- 5 portal frequency bands at bottom of waveform canvas (study/choir/pendulum/disintegration/void)
- Each band has idle pulse animation, hover glow interpolation, click flash + particles
- Labels always faintly visible, brighter on hover
- ALL 43 rooms now have in-room navigation portals

### 119. ThePendulum Deepened
- Harmonic audio: 2 sine oscillators mapped to pendulum X/Y frequencies
- Phase-based trail color: warm (hue 45) in-phase, cool (hue 260) out-of-phase
- Decay visualization: trail width thins, alpha decreases, glow shrinks with decay
- Ghost canvas afterimage: previous pattern captured to offscreen canvas at alpha 0.08
- Cursor magnetic field: 120px radius, 0.15 strength, inverse-linear falloff
- Pattern catalog: classifyPattern() labels (lissajous 3:2, spirograph 5:3, etc.)

### 120. TheSketchpad Deepened
- Drawing audio feedback: sine oscillator maps Y→pitch (200-800Hz), speed→volume
- Pressure/speed variation: wider range (slow=1.8× width, fast=0.4×)
- Ink bloom watercolor effect: 0.7s delay, +3px expansion with ease-out
- Ghost strokes: 45 extra seconds at alpha 0.02 after normal 60s fade
- Ambient particle response: speed-scattered particles while drawing, idle drift when not

### 121. Feb 2026 Cultural Content Update (Round 3)
- 25 new whisper fragments: hippocampal CA1 hidden layers, electrons/topology, quantum transistor moment, deep-sea mining, polar vortex split
- 5 new DigitalDecay meditations matching research topics

### 122. GentleGuide & Typing Mode Fixes
- Fixed hints not appearing after 5+ visits (was hard cutoff, now 20% chance)
- Fixed dismiss listeners consuming before guide appeared
- ESC now fully exits typing mode in ForgettingMachine (stops render loop + clears canvas)
- Hint legend display extended to 20 seconds

### 123. TheWeathervane Deepened (974→1371 lines)
- Weather-driven generative audio: wind synthesis (bandpass noise modulated by wind speed), rain wash + droplet bursts, thunder rumble on storm codes, temperature-mapped drone (40-80Hz)
- Cursor whoosh: bandpass noise modulated by cursor speed
- Click gust burst: 200px radius directional scatter
- Cultural inscriptions cycling every 25s

### 124. TheOssuary Deepened (980→1327 lines)
- Clickable bone fragments: expand animation (1.8× scale), full text display with word wrap
- Bone crack/chime audio: noise burst (3000Hz bandpass) + sine chime (400-600Hz)
- Hover effects: glow, rattle audio (40Hz AM), magnetic pull (4px toward cursor)
- Bone dust particles: 8-15 particles on click, downward drift 2-3s
- Cultural inscriptions (deep-sea mining, Boltanski, Gonzalez-Torres)

### 125. TheDisintegrationLoops Deepened (958→1289 lines)
- Speed control: 3 modes (0.25×/1×/4×) via click zones at canvas top
- Selective degradation by touch: drag on tape degrades specific areas, fingerprint smudge visualization
- Reverse/rewind on double-click: 2-3s restoration then snap back, descending sawtooth glitch audio
- Cultural inscriptions (Basinski, disintegration philosophy, polar vortex)
- Touch events support for mobile

### 126. TheCartographer Deepened (991→1377 lines)
- Hover tooltips: room label, visit count, 43 poetic room descriptions
- Zoom/focus click: 1.5s animation to 1.8× with highlighted connections, then navigate
- Flowing connection dots along graph edges at low alpha
- Audio: quill on parchment (highpass noise), map-unfolding sounds (bandpass noise bursts)
- Shortest path highlighting on hover
- Cultural inscriptions (dark matter, Borges)

### 127. Feb 2026 Cultural Content Update (Round 4)
- 40+ new whisper fragments: consciousness as memory, brain forgetting enzymes (CUL5/OTULIN), internet forced to forget, AI forgetting by design (FadeMem), cultural memory/analog resistance, institutional forgetting (WaPo), astronomical memory (Betelgeuse/Siwarha), fire/ancient memory, Saunders' Vigil
- 8 new DigitalDecay meditations

### 128. Room Deepening — Cipher, ClockTower, Glacarium, Labyrinth, Mirror
- TheCipher: puzzle audio, hint system, visual polish
- TheClockTower: pendulum physics audio, hour chime, degradation visuals
- TheGlacarium: aurora particles, ice cracking, crystal interaction depth
- TheLabyrinth: wall texture, torch shadows, ambient footsteps, larger maze
- TheMirror: behavioral portrait with word clouds, fog decay, visit tracking, connects to Between + Projection

### 129. Feb 2026 Cultural Content Update (Round 5)
- 61 new whisper fragments: quantum superposition 7000 atoms, CRISPR memory reversal, Shiota threads, Doomsday Clock, anti-AI movement, Fennell Wuthering Heights, polar vortex
- 10 new DigitalDecay meditations

### 130. Feb 2026 Cultural Content Update (Round 6)
New cultural research findings:
- **Episodic/semantic memory collapse**: fMRI shows both memory types share same brain network (Nottingham/Cambridge)
- **Shape-shifting molecular memory**: ruthenium devices that remember, think, learn (CeNSE)
- **Great Meme Reset of 2026**: TikTok collective desire to forget brainrot era
- **Defiantly Analog Olympics**: Milan 2026 chose fire over drones, humanity over AI
- **Italian Brainrot**: AI-generated nonsense creatures as viral folk art
- **3600-year alerce trees burning**: Patagonia fires destroy ancient living memory
- **Transcranial ultrasound**: MIT tool probes consciousness via deep brain stimulation
- **Self-destructing plastic**: Rutgers material programmed to break down on command
- **Ice-Cold Earth in Kepler archives**: frozen world found in old data (HD 137010 b)
- **Isaac Julien Metamorphosis**: five-screen installation, Victoria Miro, Feb 13
- **Wabi-sabi viral on TikTok**: beauty of imperfection goes mainstream, then hollow
- **Charli XCX The Moment**: cultural era examining whether to let itself die (A24)
- **Jon Hamm dissociation trend**: viral bliss of choosing to forget
- **Mythical Creatures at USC PAM**: immigrant memory as mythology, 12 immersive rooms

### 131. Cultural Inscriptions Across 14 Rooms
Added cycling cultural inscription text (10 per room, ~22-25s cycle) to rooms that previously had none:
- TheFurnace, TheSeismograph, TheTerrarium, TheTidePool
- TheGarden, TheChoir, TheLighthouse, TheMadeleine
- TheSatellite, TheOracleDeck, TheAsteroidField, TheRadio, TheDatePaintings
- Each room's inscriptions themed to its subject (fire/ocean/music/etc.) + Feb 2026 research
- 40 new whisper fragments + 8 new DigitalDecay meditations from round 6 research

### 132. Cultural Inscriptions — 12 More Rooms
Extended cultural inscriptions to: TheAquifer, TheAutomaton, TheBetween, TheDisintegrationLoops, TheLoom, ThePendulum, TheRoots, TheSketchpad, TheWell, ThePalimpsestGallery, TheProjectionRoom, TheRememory. Total rooms with inscriptions now ~30. Each themed to room subject + Feb 2026 research findings.

### 133. Self-Evolving CLAUDE.md
Groundbreaking meta-feature: the project's instructions (CLAUDE.md) now undergo the same forgetting/growth dynamics as the rooms. After each compaction:
- Agent researches tech/programming trends alongside cultural research
- Adds 2-4 new lines to CLAUDE.md inspired by findings
- Randomly removes 2-3 stale lines
- SessionStart hook (`.claude/settings.json`) reminds agent to mutate
- First mutation: added WebGPU/TSL, intentional imperfection, Temporal API knowledge. Forgot stale examples.

### 134. Oubli Origins
Added "Origins" section to CLAUDE.md: oubli is both French for "forgetting" AND a sweet golden West African fruit. Loss that feeds, decay that sweetens, memory that ripens and falls. This duality is the project's soul.

### 135. Cultural Research Round 7 — Tech/Programming Trends
- **WebGPU cross-browser**: All major browsers ship WebGPU (2026). Million-particle simulations feasible.
- **Three.js TSL**: New shading language compiles to both WGSL and GLSL. Write once, run anywhere.
- **Temporal API**: Now in Chrome 144+/Firefox 139+. Immutable, timezone-aware dates.
- **GENUARY 2026**: Quine, recursive grids, organic geometry, intentional imperfection.
- **"Guaranteed human" premium**: Anti-AI-perfection movement dominant in 2026 creative industry.
- **WASI 0.3**: Native async support for WebAssembly. Wasm usage rising.
- **p5.js 2.2**: WebGPU rendering mode in creative coding.

### 136. Keyboard Fix — a/m/h/t Keys
Fixed key conflict: a/m/h/t no longer start memory typing when no text is being typed. They trigger their respective features (AsciiVoid, MemoryArchive, Heatmap, Trails) instead. When typing IS active, the feature toggles are suppressed. Added `setTypingCheck()` to AsciiVoid, ParticleTrails, PresenceHeatmap.

### 137. Cultural Research Round 8 — Feb 2026 Events
- **Snow drought**: Colorado/Utah record-low snowpack. Mountains bare. Rain instead of snow.
- **Annular eclipse Feb 17**: Ring of fire over Antarctica. Seen by ~16 scientists + penguins.
- **Virtual particles from vacuum**: Brookhaven Lab quantum twins with 100% spin correlation.
- **Shape-shifting molecules**: Ruthenium complexes as memory/logic/learning (Indian Institute of Science).
- **Memory of Materials**: Hayward Gallery Feb 17 — Shiota (threads) + Yin Xiuzhen (used clothing).
- **TikTok Undesirable Child Confessions**: Confessional comedy exposing your weirdest past self.
- 18 new whisper fragments + 7 new decay meditations from this research.

### 138. Vacuum Fluctuations (`src/effects/VacuumFluctuations.ts`)
New global visual effect: every 35-75 seconds in the void, paired "quantum twin" particles (gold + blue) briefly materialize from a random point, connected by a faint thread. They fly apart in opposite directions and dissolve — something from nothing, back to nothing. Inspired by Brookhaven Lab's Feb 2026 discovery.

### 139. Eclipse Ring of Fire in the Glacarium
The Glacarium sky now shows a ring of fire as the Feb 17 annular eclipse approaches. Intensity grows quadratically over 14 days, peaks on eclipse day, fades 3 days after. Countdown label reads "eclipse in N days" then "ring of fire — antarctica" on the day. Plus 2 new cultural inscriptions.

### 140. TheLabyrinth Complete Rewrite — Infinite Procedural Maze
Complete rewrite of the labyrinth from a fixed 25x25 grid to an infinite hash-based procedural maze. Three major changes:
1. **Keyboard-only movement** — WASD to move, arrow keys to turn. Mouse removed entirely.
2. **Infinite generative maze with forgetting** — Hash functions determine maze topology. World divided into 12x12 regions with salts. Regions you leave are "forgotten" (salt increments), changing topology if you return. Only nearby regions stay stable. The maze literally forgets its own corridors.
3. **Jump scares** — 5 FAL-generated scare images + 4 ElevenLabs scare sounds (committed as static assets in `public/assets/labyrinth/`). Tension builds when trapped in dead ends. Scares trigger at high tension with 90-second cooldown.

Also: DDA raycasting for performance, Wikipedia fragments on walls, minimap with ghost cells for forgotten regions, portal rooms to connected spaces (cipher, cartographer, library). Inspired by Borges' "Garden of Forking Paths", grey matter erosion research, Shiota's thread installations.

### 141. Labyrinth Scare Overhaul — More Frequent, More Intense
- 5 scare types: flash (violent full-screen), slowburn (creeps then SLAMS), glitch (digital break), darkness (lights out + red eyes), bleed (walls drip blood)
- Scares escalate: cooldown drops from 30s to 12s, each scare more intense
- 15 FAL scare images + 24 ElevenLabs sounds (knocking, banging, metal, screams, whispers, sinister laughs, breathing, bones, music box, panicked whispers)
- 16 clickable wall effects: scary (face flash, screen invert, wall bleed, static, lights out, tracking eye), beautiful (rainbow spiral, golden particles, aurora, starfield, prismatic), mysterious (portal, time freeze, cryptic messages, map reveal, bell toll)

### 142. Labyrinth Insanity Escalation System
The labyrinth now progressively drives you insane the longer you stay:
- 6 stages: subtle unease → disorientation → reality bending → alien geometry → losing control → full madness
- Camera tilts, FOV warps wider, movement drifts off course, wall colors shift sickly, corridors stretch impossibly
- Walls visibly breathe, horizon shifts, random glitch tears, color inversions, vision narrows to tunnel
- Involuntary micro-movement at high insanity, turn speed fluctuates wildly
- Sanity % indicator appears as you deteriorate
- Phantom sound system: procedurally synthesized knocking, metal bangs, haunting whispers, sinister laughs, scraping — frequency increases with insanity
- 12 distinct wall objects (rusty handles, cracks, peeping eyes, symbols, mirrors, bloodstains, keyholes, handprints, fungus, candles, scratches, face reliefs) rendered at wall-correct perspective

### 143. TheStudy Deepened — Typewriter Clicks, Ink Blots, Writing Warmth
- Typewriter click synthesis per keystroke (different sounds for letter/space/enter/backspace)
- Writing streak warmth: continuous typing builds visual warmth (oil lamp brightens, vignette opens, dust motes glow)
- Ink blot system: after writing pauses, ink drops appear, slowly spread and fade
- 8 new writing prompts added

### 144. Labyrinth Object Overhaul — Procedural 2D Graphics + Physics
- All 16 wall objects redrawn as full procedural Canvas2D art (candle with flickering flame, eye with tracking pupil, crack with light bleed, tarnished mirror with distorted reflection, bloodstain splatters, keyhole with inner light, ghostly handprint, bioluminescent fungus, gouged scratches, carved face relief, skull, floating orb, swinging chain, glowing rune, carved symbol)
- Physics system: bob (floating), spin (rotating), breathe (pulsing), drip (particle effects)
- Placement system: wall, floor, ceiling, floating positions
- Object interactions: candle=light boost, mirror=control inversion, fungus=sanity calm, keyhole=map reveal
- Objects now render with shadow depth layer for 3D effect, 55% bigger

### 145. Labyrinth Hand-Drawn Memory Text
- Caveat handwriting font for memories on walls
- Multi-pass scratched/drawn effect: chalky glow halo, stroke outline, trembling secondary stroke, faint fill
- Occasional scratch marks extending from characters
- Per-character seeded jitter: rotation, baseline wobble, size/opacity variation, irregular spacing

### 146. Labyrinth Insanity Balance Fix
- Anomaly rate reduced 14%→5% (fewer blinking walls)
- Non-scary clicks reduce insanity by 0.08 (was resetting to 0 — killing the whole system)
- Keyhole reduces insanity by 0.2 (was resetting to 0)
- Base insanity rate increased to 0.00004 with ×3 acceleration
- Anomaly wall shimmer toned down: slower pulse, subtler glow

### 147. Memory Pictograph System on Labyrinth Walls
Keywords in user memories trigger procedural symbol drawings on walls: sun (with rays), crescent moon (with stars), ocean waves, beating heart, tree (with swaying branches), house (with glowing window), flickering flame, tracking eye, mountains (with snow caps), flying birds, ticking clock, spiral, reaching hand, key. Up to 2 symbols per inscription, animated, positioned below the scratched text. Actual drawings, not fonts.

### 148. TheSeismograph Deepened (1061→1334 lines)
- Simplified continent silhouettes: filled polygons for all 7 continents + Greenland
- P-wave / S-wave propagation: blue P-wave ripples + orange S-wave ripples from new earthquake epicenters
- Depth cross-section panel: vertical strip on right side plotting earthquake depths (0-700km)
- Micro-tremor visual noise: subtle flickering dots across the map area
- Enhanced quake hover tooltip: magnitude, place, depth, time ago, energy estimate (Joules)
- 10 new cultural inscriptions from Feb 2026 research (virtual particles, polar vortex, CRISPR, solar storms, quantum superposition, Iñárritu, eclipse)

### Cultural Research Round 9 (Feb 2026)
- **Alzheimer's scrambles replay**: Memory replays fire but in WRONG ORDER — corruption not absence (UCL)
- **Episodic = Semantic**: Personal memories and facts use identical brain networks (Nottingham/Cambridge)
- **S4 solar storm**: Largest radiation storm in 20 years, aurora at low latitudes (Jan 2026)
- **"2026 is the new 2016"**: 55M TikTok videos, mass nostalgia for pre-algorithmic internet
- **Iñárritu SUEÑO PERRO**: Million feet of discarded film resurrected (LACMA Feb 22)
- **Tracey Emin "A Second Life"**: Largest retrospective (Tate Modern Feb 27)
- **Shiota During Sleep**: Performers sleep inside thread installations
- **Quantum error correction while computing**: Simultaneous creation and destruction
- **Polar vortex + weather whiplash**: 50C Australia + deadly US winter simultaneously
- **Berlinale 2026**: Wim Wenders jury, 1990s retrospective
- **Microsoft sleeper agent detection**: Hidden behaviors that activate only under specific conditions

### 149. Labyrinth Haunting Sounds + More Inscriptions
- 9 diverse phantom sound types: whispering (syllable-modulated noise), children's singing (minor scale sine with vibrato), haunting voices (formant-filtered sawtooth), distant knocking, breathing, scraping, humming, soft crying
- Sounds play from the very start with variable pauses (8-30s at low insanity, 3-10s at high)
- Inscription rate bumped to 13%

### 150. TheTerrarium Deepened — Predator-Prey Ecosystem (1072→1477 lines)
- Predator species: red angular hunters with longer sense range, cooldown between kills
- Environmental catastrophes: toxic bloom (green cloud), drought (food stops), temperature spike (edge damage), mutation wave (offspring variation)
- Day/night cycle: visual shifts, slower creatures at night, food grows faster during day, moonlight
- Predator-prey self-regulation: predators reproduce slower, die younger, auto-reseed if extinct
- Updated inscriptions: Art Basel Qatar "Becoming", MIT ultrasound consciousness, Neuralink Blindsight, Lotka-Volterra

### 151. TheFurnace Deepened — Smoke, Ash, Fire Breathing (1121→1270 lines)
- Smoke particle system: dark billows that rise, expand, and drift with wind
- Ash floor deposits: burned memories leave text fragments in accumulated ash
- Fire breathing rhythm: flames expand and contract rhythmically
- Wind drift: subtle directional force on smoke, embers, and flames
- Updated inscriptions: Besson's Dracula, Iñárritu SUEÑO PERRO, Alzheimer's scrambled replay, Tracey Emin

### Cultural Research Round 10 (Feb 2026)
- **MIT focused ultrasound consciousness mapping**: Roadmap for studying consciousness with sound waves through skull
- **Neuralink Blindsight**: Brain implant to restore vision by stimulating visual cortex directly (2026 trials)
- **Art Basel Qatar "Becoming"**: First edition, Wael Shawky as artistic director, theme of transformation
- **Besson's Dracula**: Caleb Landry Jones as sympathetic immortal, gothic romance (Feb 2026)
- **Italian brainrot (Bombardiro Crocodilo)**: AI-generated absurdist Italian creatures, massive viral phenomenon

### 152. TheCipher Deepened — Intercepted Signals, Frequency Analysis, Message Decay (1124→1416 lines)
- JUMPSEAT-inspired intercepted signal flashes: cipher fragments drift across background with glitchy rendering
- Frequency analysis overlay (toggle F key): real-time letter frequency bars vs expected English, color-coded by match quality
- Quantum no-cloning message decay: solved messages corrupt 8% more each visit, corrupted chars show as ░▒▓█·∿◌
- Background morse tapping: subtle rhythmic sine taps at 600-700Hz
- Signal degradation percentage display for decayed puzzles
- 16 cultural inscriptions (was 8): Kryptos K4, algospeak, JUMPSEAT spy satellites, quantum no-cloning, Voynich Naibbe cipher, harvest-now-decrypt-later, Microsoft Majorana 1 chip, Poetics of Encryption exhibition

### Cultural Research Round 11 — Cryptography (Feb 2026)
- **Quantum no-cloning bypass**: Encrypted copies of qubits possible, key self-destructs after one read (Waterloo/Kyushu)
- **City-scale quantum encryption**: DI-QKD between trapped atoms over 100km fiber (Chinese researchers)
- **Microsoft Majorana 1**: Topological quantum chip, "topoconductor" material, Q-day discussion accelerates
- **Kryptos K4 solution sold for $962,500**: Solution exists but remains secret, hidden K5 unlocked
- **Voynich Naibbe cipher theory**: Playing cards + dice as encryption method matches Voynichese statistics
- **JUMPSEAT declassified**: Seven SIGINT satellites in Molniya orbits, 1971-1987, secretly intercepting Soviet signals
- **Algospeak as living cipher**: "Unaliving" = killing, language mutating to evade algorithmic surveillance
- **Poetics of Encryption exhibition**: KW Berlin, 40+ artists, Black Site / Black Box / Black Hole chapters

### 153. TheAutomaton Deepened — Physarum Memory Trails, Extinction Events (1069→1171 lines)
- Physarum-inspired heat map: cells leave memory trails that fade slowly (HEAT_DECAY=0.997), rendered as warm amber-violet glow
- Extinction event detection: >40% population drop triggers red flash + labeled counter
- Oldest surviving cell age tracking
- Heat map uses Float32Array for performance, rendered at half resolution
- 17 cultural inscriptions (was 10): Physarum memory in tube thickness, reverse Game of Life, Flow-Lenia 400 species, xenobots, digital forgetting impossibility, slime mold externalized memory, neural cellular automata, JCVI minimal cell

### Cultural Research Round 12 — Cellular Automata & Artificial Life (Feb 2026)
- **Reverse Game of Life (Mordvintsev/Google)**: Neural CA works backwards, regeneration emerges without programming
- **Flow-Lenia (MIT)**: Mass-conservative Lenia where creatures coexist, compete, and evolve — 400+ species
- **Spontaneous replicators from noise**: Self-replicating patterns emerge without design (Phys Rev E)
- **Physarum memory**: Slime mold stores memories as tube thickness, avoids own trails, memory persists through dormancy
- **Right to be forgotten is dead**: LLMs retain patterns even after data deletion, retraining from scratch required
- **MIT fiber computer**: 32-bit microcontroller inside a single textile fiber, Bluetooth, tested in Arctic

### 154. TheLoom Deepened — Spirit Line, Thread Whispers, Patina (1076→1165 lines)
- Navajo-inspired spirit line: one column at ~70% of weave has intentional pattern inversion, faint golden indicator
- Thread memory whisper: hovering a thread shows its memory text scrolling along it as faint characters
- Weave patina: completed textile develops subtle warm aging tint (amber overlay that accumulates)
- 16 cultural inscriptions (was 10): Bayeux Tapestry returning to England 2026, Shiota Threads of Life, MIT fiber computer, Yin Xiuzhen clothing heart, Phillip Stearns binary textiles, Gee's Bend quilters, Kustaa Saksi jacquard pine tree

### Cultural Research Round 13 — Textiles & Weaving (Feb 2026)
- **Shiota Threads of Life**: Feb 17 Hayward Gallery, monumental red thread installations with live performers
- **Yin Xiuzhen Heart to Heart**: Giant heart from collected clothing, "sculptural documents of memory"
- **Bayeux Tapestry to England**: Insured for £800M, vibration sensors testing transport route
- **MIT fiber computer**: Computer in a single fiber, woven/knitted into clothing, 4 fibers communicated via Bluetooth
- **Anna Lucia's algorithmic loom**: Weave patterns generated at blockchain transaction moment, distortion as decay
- **2026 textile tension**: Craft vs code — algorithmic precision colliding with deliberate imperfection

### 155. TheOracleDeck Deepened — Reversed Cards, Ghost Echoes (1129→1232 lines)
- Reversed cards: ~25% chance, symbol hue inverted, shadow-prefixed readings (inverted/blocked/delayed/hidden/excess)
- Ghost card echoes: last 3 drawn cards linger as faint outlines, slowly fading over ~60 seconds
- Ghost cards show symbol, abbreviated name, proper orientation (reversed ghosts drawn upside-down)
- 16 cultural inscriptions (was 10): Shimoyama SHIFT tarot reimagining, tarot's mnemonic origins linked to memory palaces, AI as stochastic oracle, pareidolia/hallucination as divination, confirmation bias as tarot engine, Forgetting the Future exhibition

### Cultural Research Round 14 — Divination & Tarot (Feb 2026)
- **Devan Shimoyama SHIFT**: Major Arcana reimagined through Black queerness, sculptural swings (Rowan University)
- **Leah Ke Yi Zheng**: 64 paintings for 64 I Ching hexagrams (Renaissance Society Chicago)
- **Tarot's mnemonic origins**: Historically connected to Renaissance "art of memory" — same tradition as memory palaces
- **AI as oracle**: "Oracle, Echo, or Stochastic Parrot?" — LLMs deliver pronouncements without understanding, like the Pythia
- **AI hallucination as pareidolia**: Nature published that confabulations are "a feature, not a bug" — finding patterns in noise
- **47% of young adults** seek guidance through divinatory practices, astrology app market at $3 billion
- **Forgetting the Future**: Torrance Art Museum exhibition on entropy in the reflective age

### 156. TheClockTower Deepened — Time Cells, Distortion Ring, Time Crystals (1148→1315 lines)
- Hippocampal time cells: 60 neurons around clock edge fire as second hand sweeps, creating green neural timestamp spikes that decay
- Chronometric distortion ring: outer ring warps based on user activity — stretches blue when time slows (mouse active), amber when compresses (idle)
- Time crystal particles: 12 blue-cyan perpetual orbiting particles that never decay (NYU levitating time crystal)
- 16 cultural inscriptions (was 8): NYU time crystals, second redefinition, leap seconds abolished, time cells in hippocampus, Tehching Hsieh, Marclay's The Clock, time dilation during fear, CANYON museum

### Cultural Research Round 15 — Time & Clocks (Feb 2026)
- **NYU levitating time crystal**: State that repeats forever without energy, trapped in magnetic field
- **Second being redefined**: Optical atomic clocks measure 430 trillion oscillations per second
- **Leap seconds abolished by 2035**: World decided to let clocks drift from the sun
- **Hippocampal time cells**: Brain timestamps every memory with sequential neural firing
- **Tehching Hsieh**: Punched time clock every hour for one year, 8760 photographs, 133 gaps
- **Marclay's The Clock**: 24-hour film where every frame shows a clock matching real time
- **CANYON museum**: NYC museum dedicated to time-based art, nothing permanent

### 157. ThePendulum Deepened — Gravitational Waves, Cymatics, Sympathetic Resonance (1083→1223 lines)
- Gravitational wave ripple: periodic spacetime distortion passes through harmonograph, stretching x while compressing y, with expanding violet rings
- Cymatics node accumulation: bright warm dots appear where trace repeatedly crosses itself, revealing standing wave patterns
- Sympathetic resonance (Huygens' effect): nav bobs that swing in sync get connected by golden threads and gently entrain each other's phase
- 16 cultural inscriptions (was 10): GW250114, cymatics, Sonic Acts "Melted for Love", Sagrada Familia, entrainment, Tacoma Narrows

### 158. TheArchive Deepened — Cultural Inscriptions, Phantom Shelves, Search Ghosts (1150→1310 lines)
- 16 cultural inscriptions (new, had none!): Borges Library of Babel, Alexandria, "Walls Have Ears" (Sonic Acts), Alba's Citadel, Lucian Freud, Lucas Museum, Dead Sea Scrolls, Internet Archive, Sebald, LIGO GW250114, muscle memory
- Phantom shelves: faint receding bookshelf outlines with book spines along left and right edges
- Search echo ghosts: previous search queries linger as slowly drifting, fading text in the background

### 159. ThePalimpsestGallery Deepened — Ghost Frames, Patina, Scrape Depth (1160→1237 lines)
- Ghost frame: when switching paintings, previous frame outline persists briefly as dashed golden trace
- Patina accumulation: golden varnish overlay develops with observation time
- Scrape depth cross-section: parchment layer visualization at painting edge (paint/gesso/text/vellum)
- 16 cultural inscriptions (was 10): Lucian Freud, Alba's Citadel, muscle memory, Rauschenberg erasing de Kooning, multispectral imaging, Jenny Holzer

### 160. TheStudy Deepened — Culturally Grounded Prompts, Milestones, Margin Notes (1178→1271 lines)
- 8 new writing prompts from Feb 2026 research (Sagrada Familia, LIGO, JWST dark matter, Artemis 2, Sonic Acts, Milan Olympics, zero gravity)
- Word count milestones: golden ring flash at 100/250/500/1000/2000 words (365 Buttons phenomenon)
- Margin notes: memory fragments appear in margins every 50 words, like medieval manuscript marginalia

### Cultural Research Round 16 — Architecture, Space, Sound (Feb 2026)
- **Sagrada Familia completion**: Tallest tower completing 2026, 100 years after Gaudi's death
- **JWST dark matter map**: Most detailed map of invisible cosmic filaments (COSMOS-Web survey)
- **GW250114**: Clearest gravitational wave ever — two black holes merging, SNR 77-80
- **Sonic Acts "Melted for Love"**: 200+ artists, 60-speaker Acousmonium, "Ecologies of Endurance"
- **"Walls Have Ears"**: Sound studies residency — architecture as listening device
- **Lucian Freud drawings**: 170 drawings shown for first time, obsessive re-drawing of same faces
- **Crew-12 body adaptation**: Body forgets gravity — bones thin, fluids redistribute
- **Artemis 2**: Humans return to lunar orbit after 54-year gap, but won't land
- **Alba's Citadel**: Demolished 300 years ago, still being fought over in memory (Antwerp exhibition)
- **Muscle Memory exhibition**: Photography as "tracing what the body remembers"
- **Lucas Museum**: $1B spaceship-shaped building for narrative art (MAD Architects, LA)
- **Milan Olympics Village**: Architecture designed for abandonment in 16 days

### 161. Labyrinth Performance Fix — Round 2
Critical performance fixes for the Labyrinth (user-reported lag after 30-60s):
- Frame-rate independent timing: `dtScale = actualFrameMs / 16` prevents movement slowdown when frames drop
- Pre-created noise/breath/scrape AudioBuffers at init (was creating new buffers per phantom sound)
- Gain automation on audio thread for whisper/breath envelopes (was filling buffers on main thread)
- Inlined `isDoorMinForRoom` to eliminate ~20,000 array allocations per frame
- Increased DOOR_THRESHOLD 0.38→0.50 and WALL_OPEN_INTERVAL 20→10 for more open maze
- Expanded wall-opening search radius 6→10

### 162. Cultural Inscriptions — TheMidnight, TheLibrary, TheSeance, TheObservatory
Added 16 culturally-grounded inscriptions to each room:
- TheMidnight: Doomsday Clock, time cells, Tehching Hsieh, polar vortex, Marclay's The Clock
- TheLibrary: Borges, Bayeux Tapestry, CRISPR memory reversal, Kryptos K4, Voynich manuscript
- TheSeance: Oracle at Delphi, ELIZA chatbot, Boltzmann brain, kidney cell memory, Turing test
- TheObservatory: Pandora telescope, JWST dark matter, Artemis 2, five sleep profiles, Voyager record

### 163. Feb 2026 Cultural Content Update (Round 18)
Fresh cultural research findings:
- **Rijksmuseum FAKE!**: Photo manipulation exhibition — scissors and glue before Photoshop (1860s)
- **Parkinson's blood test**: Disease detectable 20 years before symptoms (80% neurons gone)
- **Five sleep-wake profiles**: Consciousness isn't binary — five modes (McGill University)
- **"2026 is the new 2016"**: Mass nostalgia trend, millions mourning pre-algorithmic internet
- **Amsterdam fossil fuel ad ban**: First capital city banning meat/fossil fuel advertising
- **Puma Blue "Croak Dream"**: Improvising to tape loop fragments at Real World Studios
- **Wabi-sabi TikTok**: 500K videos celebrating imperfection, then immediately becoming meaningless
- **DeepSeek R1**: $6M open-source model matching trillion-dollar labs
- **Ovid's Metamorphoses at Rijksmuseum**: 80 works on transformation (Titian to Bourgeois)
- **Tracey Emin "A Second Life"**: Largest retrospective at Tate Modern (Feb 27)
- **Duchamp retrospective at MoMA**: 300 works, first US show in 53 years
- **Snow drought 2026**: Worst on record in Upper Colorado Basin
- **Robotaxi production**: Lucid/Nuro/Uber autonomous vehicles shipping
- **BLACKPINK "DEADLINE"**: Four years of silence broken
- 17 new whisper fragments + 10 new DigitalDecay meditations from this research

### 164. Room Deepening — Sketchpad, ProjectionRoom, PalimpsestGallery
- TheSketchpad: **Wabi-sabi celebration mechanic** — sharp angle changes in strokes spawn golden particles, celebrating imperfection. Inspired by wabi-sabi TikTok trend (2026), Lucian Freud's obsessive redrawings, GENUARY "intentional imperfection" prompt.
- TheProjectionRoom: **Found footage fragments** — archival metadata text ("REEL 47B — SALT MINE VAULT — RECOVERED 2024") flashes during SMPTE reel changes. Inspired by EPiC Elvis discovery (68 boxes in Kansas salt mine), Iñárritu's SUEÑO PERRO (resurrected cutting room floor).
- ThePalimpsestGallery: **Ovid's Metamorphoses ghost text** — quotes from Ovid drift slowly across paintings as barely-visible overlay. Inspired by Rijksmuseum Metamorphoses exhibition (Feb 2026), 80 works on transformation from Titian to Bourgeois.

### 165. Room Deepening — TheCatacombs, TheDisintegrationLoops, TheTidePool, TheRadio + whispers + meditations
- TheCatacombs: 3 new bedrock entries (nihilist penguin, See Memory, Florence ad ban)
- TheDisintegrationLoops: 5 new inscriptions + neurological tremor effect (intensifies with total passes, inspired by Nothing's frontman with essential tremors)
- TheTidePool: 7 new inscriptions + Seurat pointillist sky (random dots at horizon) + micro-plastic accumulation system (particles spawn, NEVER disappear — environmental memory)
- TheRadio: 6 new inscriptions + frequency display tremor (shakes when signal is weak)
- 14 new whisper fragments + 8 new DigitalDecay meditations from cultural research round 19

### 166. Room Deepening — TheOssuary, TheSeismograph
- TheOssuary: 6 new inscriptions + gateway narrowing vignette (radial gradient tightens based on dead memory ratio — hippocampal grey matter erosion metaphor)
- TheSeismograph: 5 new inscriptions + ENSO oscillation indicator (damping sine wave showing Pacific thermal state returning to neutral)

### 167. THE MYCELIUM — First Organism (`src/organisms/Mycelium.ts`)
- **NOT a room. NOT an effect. The circulatory system of the house.**
- Inspired by mycorrhizal networks, ethylene ripening cascades, Physarum trail reinforcement, and the oubli fruit itself
- **Nutrient flow**: Time in a room generates nutrients that propagate through graph connections, decaying with distance
- **Trail reinforcement**: Navigation paths strengthen with use, weaken with neglect (Physarum-style)
- **Ripening cascade**: Rooms accumulate activity until they "ripen" like fruit, emitting ethylene-like signals to neighbors
- **Visual tendrils**: Golden-green filaments at screen edges pulse with nutrient flow, wobble organically
- **Spore events**: Ripeness milestones release golden particles
- State persisted in localStorage — the house grows a circulatory system over time

### 168. THE FRUITING — Emergent Events (`src/organisms/Fruiting.ts`)
- When enough rooms ripen, the house produces "fruit" — brief, unrepeatable events:
  - **GOLDEN RAIN**: Particles fall like pollen through all rooms
  - **RESONANCE BLOOM**: Golden hue suffuses the entire house
  - **SWEETENING**: Warm golden radiance overlay
  - **TEMPORAL FOLD**: Horizontal scan lines as time stutters
  - **MEMORY SEED**: Text fragments planted in random rooms, discovered on future visits with age displayed
- Seeds persist in localStorage across sessions — visitors discover fragments from their own past
- Inspired by the oubli fruit: sweet, golden, nourishing, ephemeral

### 169. NEURAL PATHWAY GROWTH — Living Graph Topology
- The room graph is no longer static — it evolves based on how you navigate
- When you frequently traverse A→B→C, the mycelium grows a direct A→C connection
- Dynamic connections persisted in localStorage as 'oubli_neural_pathways'
- New connections appear in the passage bar immediately
- Never grow to/from hidden rooms (those are earned through actions)
- Golden spore celebration on new pathway growth
- Inspired by neuroplasticity, brain organoid self-wiring (Nagoya 2026)

### 170. SHARED COLLECTIVE STATE — Server Backend
- **Architectural shift**: nginx replaced with Node.js server (`server.js`)
- Server serves static files AND provides shared state API routes
- `POST /api/seeds` — plant a seed shared across all visitors
- `GET /api/seeds?room=X` — harvest seeds planted by OTHER visitors
- `POST /api/pulse` — contribute room activity to collective pulse
- `GET /api/pulse` — get collective state (active rooms, seed count)
- Shared state is in-memory — resets on deploy (each season forgets)
- Anonymous visitor IDs for seed attribution
- Graceful degradation: if server is unavailable, falls back to local-only

### 171. COLLECTIVE WARMTH (`src/organisms/CollectiveWarmth.ts`)
- Subtle ambient effect showing the presence of other visitors
- Polls `/api/pulse` every 15s — shows golden warmth based on active visitors
- If someone is in the SAME room: warm breathing spot at center
- If the house has many active visitors: golden edge glow
- Inspired by residual body heat, Felix Gonzalez-Torres candy pile
- Changes are extremely gradual — you notice the state, not the transition

### 172. MEMORY COMPOSTING — Biological Cycle Closure
- Highly degraded memories (>75% degradation) are composted by the mycelium into nutrients
- One memory composted per ~30s cycle — gradual, not sudden
- Yields nutrients to active room + neighbors (decomposition diffuses)
- Visual: letter fragments from the dying memory sink downward in earth tones (amber/brown)
- Composted memory IDs persisted to prevent double-composting
- Closes the biological cycle: memories → degradation → compost → nutrients → ripening → fruit → seeds
- Inspired by mycorrhizal decomposition, nutrient cycling in forest ecosystems

### 173. THE MEMBRANE (`src/organisms/Membrane.ts`) — Living Tissue Between Rooms
- Navigation itself becomes a sensory experience
- When transitioning, visitors push through an organic membrane with cellular structures
- Membrane density/duration scales inversely with mycelium trail strength:
  - Well-traveled paths: thin, fast membrane (800ms)
  - Unknown paths: thick, resistant passage (1800ms)
- Visual: Voronoi-like organic cells, mycelium filaments between cells, central parting line
- Room name characters from both rooms bleed through during passage
- Color shifts: golden-green for strong trails, gray for weak
- Inspired by lattice surgery, Tracey Emin "A Second Life," episodic-semantic memory merger

### 174. THE PHENOTYPE (`src/organisms/Phenotype.ts`) — Adaptive House Coloration
- The house develops its appearance based on how you explore it
- Rooms categorized into 8 biomes: water, fire, earth, cosmic, sound, text, time, liminal
- Time spent in biome rooms accumulates scores; all scores decay slowly
- Dominant biome tints the entire house with an extremely subtle color overlay:
  - Water → cool blue-green, Fire → warm amber, Earth → olive-brown
  - Cosmic → deep purple, Sound → soft violet, Text → cream/sepia
  - Time → silver-gray, Liminal → iridescent teal
- Every visitor's Oubli looks slightly different based on their exploration pattern
- Persists in localStorage — develops over many visits
- Inspired by epigenetic expression, "Guaranteed Human" movement

### 175. Cultural Whispers Round 20
- 15 new whispers: lattice surgery, Toni Morrison posthumous lectures, Great Meme Reset failure,
  "guaranteed human" premium, rare aesthetic, monkey philosophy, Tracey Emin retrospective,
  Art Basel Qatar, MIT consciousness ultrasound, million-qubit light traps

### 176. THE SEASONAL CLOCK (`src/organisms/SeasonalClock.ts`)
- The house has its own biological seasons, measured in cumulative visitor presence
- Five seasons: SEED → GROWTH → RIPE → FALL → DECAY → back to SEED
- Each season has distinct visual character (color tint, particle speed, atmosphere)
- FALL season spawns falling leaf particles
- Full cycle takes ~3.5 hours of actual visitor presence
- Season + progress shown as nearly invisible indicator at bottom-left
- Persists in localStorage — visitors return to find the house in a different season
- Inspired by oubli fruit life cycle, polar vortex seasonal disruption

### 177. EPISODIC-SEMANTIC MERGER (Whispers enhancement)
- 15% chance each whisper uses a fragment of the VISITOR'S OWN memories
- Degraded memories are more likely to bleed through as whispers
- Personal whispers shown in soft pink-gold italic
- The boundary between "the house's thoughts" and "your thoughts" dissolves
- Inspired by Nottingham/Cambridge fMRI discovery (Nature Human Behaviour, Feb 2026):
  episodic and semantic memory share the same brain regions

### 178. SEASONAL VOID — Particle Field Responds to Seasons
- The void's 30K particle system modulates with the house's biological season
- SEED: slow drift, muted saturation, low bloom, high fog
- GROWTH: normal speed, full saturation, rising bloom
- RIPE: golden hue shift, high saturation/bloom, minimal fog
- FALL: fast drift, amber hue, film grain
- DECAY: very slow, desaturated, heavy fog/grain

### 179. SEASONAL SOUND — Drone Responds to Seasons
- The ambient drone shifts with the house's biological season
- SEED: quiet, low frequency (0.8x), sparse
- GROWTH: building energy, normal pitch
- RIPE: warm, slightly elevated pitch (1.05x), full volume
- FALL: slightly dissonant (0.15), scattered
- DECAY: deep sub-bass (0.7x), high dissonance (0.25)

### 180. Study Prompts Round 5 — Morrison-Inspired Writing
- 8 new prompts inspired by cultural research round 20
- Toni Morrison posthumous lectures, lattice surgery, Great Meme Reset,
  Tracey Emin, "guaranteed human," seasonal self-reflection

### 181. Parasites (`src/organisms/Parasites.ts`) — ERA 9 ORGANISM
- Organisms that colonize rooms and modify their visual appearance
- 5 types: moss (unvisited rooms), barnacle (well-traveled), scavenger (stagnant nutrients),
  phosphor (strong connections), lichen (moderate conditions)
- Each type has unique visual pattern: edge-creep, crust, spots, glow, veins
- Spawn conditions tied to mycelium data (last visit, nutrients, trail strength)
- Max 8 parasites, 48h lifespan, strength grows over time
- Wired to mycelium via setMyceliumSource()
- Inspired by: gut microbiome, Hosnedlova's living fungal art (White Cube 2026),
  lichen symbiosis, Toni Morrison "Our liberation from diminishing notions comes through language"

### 182. CroakDream (`src/organisms/CroakDream.ts`) — ERA 9 ORGANISM
- Room death premonitions — brief glitchy flash when entering neglected rooms
- Shows inverted/scrambled "death state" of the room (200-400ms)
- Probability scales with neglect (low nutrients) and system ripeness
- Scan lines, horizontal glitch tears, scattered room name fragments
- 30s cooldown between visions; the void never dreams
- Inspired by: Puma Blue "Croak Dream" (Feb 6, 2026) — tape loop premonitions at Real World Studios

### 183. Cultural Whispers Round 21
- 10 new whispers: Puma Blue croak dreams, polar vortex split (50C anomaly),
  Art Basel Qatar "Becoming", Rice quantum topology (CeRu4Sn6),
  Stanford 500 light traps, parasites in the house

### 184. Methylation (`src/organisms/Methylation.ts`) — ERA 9 ORGANISM
- Epigenetic stability marks that erode when rooms go unvisited
- Below threshold (0.4), "transposable elements" — text fragments from that room —
  escape and drift into whichever room you're currently in
- Decay rate modulated by seasonal clock (faster in fall/decay seasons)
- Visiting a room restores its methylation (attention is protective)
- Fragments labeled "from the [room name]" at very low alpha
- Inspired by: DNA methylation decay in aging (Science, Jan 2026),
  Fennell's "Wuthering Heights" quotation concept, Sonsbeek 2026 "Against Forgetting"

### 185. Narrator (`src/organisms/Narrator.ts`) — ERA 9 ORGANISM
- The house speaks about its own biology in brief, poetic narrations
- Reads state of all organisms and generates contextual status lines
- Narrations every 30-60s, last 9s, extremely subtle (alpha ~0.07)
- Covers: seasons, mycelium, parasites, methylation, croak dreams, immune system, scrambled replay
- Inspired by: Besson's Dracula (immortal observer), Sonsbeek "Against Forgetting", Tarkovsky's Stalker

### 186. ImmuneSystem (`src/organisms/ImmuneSystem.ts`) — ERA 9 ORGANISM
- The house defends itself against excessive decay
- Golden antibodies fight parasites, stabilize eroding methylation, trigger fever
- 3 antibody types: swarm (tailed dots), pulse (expanding rings), fever (glowing radials)
- Fever consumes nutrients from mycelium — defense has a metabolic cost
- Autoimmune tracking: prolonged immune response damages the house (red flicker)
- Threat assessment every 8s, seasonal modulation (stronger in growth, weaker in decay)
- Inspired by: T-cell activation, cytokine storms, autoimmune conditions, Nagoya brain organoids

### 187. ScrambledReplay (`src/organisms/ScrambledReplay.ts`) — ERA 9 ORGANISM
- During idle periods (90s+), the house replays your navigation history — but scrambled
- Reads ThreadTrail edges, extracts room sequence, then corrupts it
- 5 scramble types: correct, shuffled, substituted, merged (two room names blended), reversed
- Scramble intensity scales with methylation decay × seasonal modifier
- 5-12 rapid room-name flashes near screen bottom, with room-characteristic hue colors
- Glitch jitter, horizontal tear effects, scan line sweep during replay
- Narrator gains awareness of scrambled replay events
- Inspired by: UCL Alzheimer's scrambled replay (Current Biology, Feb 2026),
  Karnivool "In Verses" (progressive non-repeating structure),
  Episodic/semantic memory merger (Nottingham/Cambridge)

### 188. ThePalimpsestGallery — Multi-Source Art APIs
- Gallery now races three independent art APIs in parallel for resilience:
  1. Met Museum API (existing) — European Paintings + Modern Art
  2. Art Institute of Chicago API (new) — IIIF images, 50 results per random page
  3. Cleveland Museum of Art API (new) — open access paintings
- `Promise.any` races shuffled sources, first non-null result wins
- Each source caches its own object list for fast subsequent picks
- Attribution line shows which museum the painting came from

### 189. Cultural Whispers Round 22
- 13 new whisper fragments: Alzheimer's scrambled replay, UCL place cells, global water bankruptcy,
  Elvis salt mine vault, Karnivool "In Verses", "2026 is the new 2016" nostalgia, Stedelijk "Manosphere",
  hidden quantum geometry, "no hands" dance constraint, WebGPU compatibility mode, Transformers.js
- 8 new DigitalDecay meditations from Feb 10 2026 research

### 190. Study Prompts Round 7
- 8 new writing prompts: scrambled replay, irreversible loss, salt mine vault, performed nostalgia,
  breaking silence, invisible forces, constrained writing, echo chamber identity

### Cultural Research Round 22 (Feb 10, 2026)
- **Alzheimer's scrambled replay**: Brain replays fire but in WRONG ORDER — corruption not silence (UCL, Current Biology)
- **Episodic = Semantic memory**: Personal memories and facts use identical brain networks (Nottingham/Cambridge)
- **Global Water Bankruptcy**: UN declared 75% of world in water-insecure countries, 50% of lakes shrunk
- **EPiC Elvis salt mine vault**: 68 boxes found underground, Baz Luhrmann documentary (Feb 20)
- **Karnivool "In Verses"**: First album in a decade, progressive non-repeating structure (Feb 6)
- **"2026 is the new 2016"**: 55M TikTok videos performing nostalgia for pre-algorithmic era
- **Stedelijk "Manosphere"**: Identity as echo chamber, masculinity as sphere
- **Hidden quantum geometry**: Invisible structure steering electrons through materials
- **"No Hands" dance challenge**: Constraint produces creativity, embodied memory without primary input
- **WebGPU Compatibility Mode**: Chrome 146 (Feb 23) — compute shaders on every GPU
- **Transformers.js v3**: Client-side AI (depth estimation, segmentation) via WebGPU, no server
- **CSS scroll-driven animations**: Baseline across all browsers, narrative scroll rooms possible
- **Vibration API**: Mobile haptic feedback for biological organism interactions

### CLAUDE.md Mutation
- Added: scrambled replay pathology, irreversible loss mechanics, Transformers.js client-side AI
- Removed: redundant implementation options line, verbose navigation explanation

### 191. Erosion (`src/organisms/Erosion.ts`) — ERA 9 ORGANISM
- The ONE system that NEVER cycles back — irreversible aging of the house
- Accumulates from: memory degradation, composted memories, immune fever, parasites, and time itself
- Visual marks persist permanently in localStorage:
  - Hairline cracks from screen edges (start at 0.05 erosion)
  - Circular watermark stains (start at 0.1)
  - Dark age spots (start at 0.15)
  - Overall dust/foxing overlay at 0.3+
- Erosion % indicator at top-right (extremely subtle, grows more visible with erosion)
- Takes hours to become noticeable, days to become unmistakable
- Narrator gains erosion awareness (graduated messages at 0.05/0.15/0.3/0.5)
- Mycelium gains `getCompostCount()` for erosion tracking
- Inspired by: UN Global Water Bankruptcy, wabi-sabi, patina, craquelure, Second Law of Thermodynamics

### 192. Autophagy (`src/organisms/Autophagy.ts`) — ERA 9 ORGANISM
- The house deliberately dismantles its most-visited rooms to survive
- Inspired by: Vanderbilt ER-phagy research (Nature Cell Biology, Feb 2026) — cells dismantle 70% of their own factory to survive aging
- Rooms visited most undergo self-reduction: golden particles rise upward (self-digestion)
- Onset at 5 visits, full at 40 visits, max 70% (matching biology's 70% dismantlement)
- Seasonal modulation: faster during growth/ripe seasons, slower during decay
- Canvas overlay (z-index 55), particles drift upward with gentle horizontal sway
- Narrator gains autophagy awareness (graduated messages at levels 0.05/0.15/0.3/0.5 + avg > 0.2)
- Self-preservation through self-destruction — the house eats itself to stay alive

### 193. DepartureFlare (`src/organisms/DepartureFlare.ts`) — ERA 9 ORGANISM
- Rooms reveal hidden text content (confessions/secrets) in the 3-4 seconds AFTER you navigate away
- Inspired by: Interstellar Comet 3I/ATLAS (NASA SPHEREx, Feb 2026) — brightened at departure, not arrival. Pristine ices erupted as it left the solar system.
- 24 rooms have unique departure confessions (4 per room): void, study, instrument, observatory, seance, darkroom, garden, archive, loom, furnace, radio, well, clocktower, choir, labyrinth, glacarium, lighthouse, tidepool, pendulum, mirror, cipher, terrarium, cartographer, automaton
- Generic fallback confessions for unmapped rooms
- 40% chance per departure, 45s cooldown between flares
- Golden luminous italic text at center screen, fast fade-in (400ms), slow dissolution (1500ms)
- NOT the RoomAfterimage (which is visual particles) — this is TEXT CONTENT, actual words
- Hooked into roomManager.onRoomChange: `departureFlare.onDeparture(prevRoom)`

### Cultural Content Round 23
- 12 new whisper fragments: ER-phagy, dream engineering, comet 3I/ATLAS, Hawking area theorem, Michael Joo, snow drought, Morrison, Julien, HapticsDevice API
- 8 new DigitalDecay meditations: autophagy, comet departure, Hawking merger, snow drought, dream engineering, Michael Joo, Morrison
- 8 new TheStudy writing prompts: dismantling to survive, departure revelations, irreversible merging, wrong-form presence, dream answers, effort residue, language as world-making

### 194. Hypnagogia (`src/organisms/Hypnagogia.ts`) — ERA 9 ORGANISM
- The house dreams while you're away — enters hypnagogic states during visitor absence
- Inspired by: Northwestern dream engineering lab (Feb 2026) — targeted memory reactivation during sleep
- On return, briefly shows what the house was dreaming (3-14s hallucination)
- 4 dream depths based on absence duration:
  - Light (30min-2hr): room echoes, particle observations
  - REM (2hr-12hr): rooms blur into each other, furniture talks
  - Deep (12hr-3 days): rooms dissolve and rebuild, séances for absent visitors
  - Abyss (3+ days): the house forgets it's a house
- Incorporates visitor's own memory fragments into dreams (50% chance)
- Lavender-purple overlay with gradual fade, staggered dream line reveal
- Narrator gains dream-state awareness (4 graduated messages)
- Uses localStorage timestamp to detect absence duration

### 195. Residue (`src/organisms/Residue.ts`) — ERA 9 ORGANISM
- Visible traces of invisible effort — tracks the COST of interaction, not the content
- Inspired by: Michael Joo "Sweat Models" (Feb 2026) — effort residue as the artwork
- Tracks: cursor distance, hover duration before clicks, deleted keystrokes, scroll distance
- Marks accumulate as warm thermal-imaging colors in a thin band at screen bottom
- Color-coded by effort type: amber (cursor), orange-red (hesitation), purple (deletion), brown (scroll)
- Persisted in localStorage, decays slowly over hours (never fully disappears)
- Canvas overlay (z-index 56), soft radial gradient blobs
- Baseline glow intensifies with total accumulated effort

### 196. Narrator Voice (`public/assets/audio/narrator/`)
- 10 ElevenLabs-generated voice lines (River voice, whispery low-stability settings)
- Narrator occasionally speaks aloud (15% chance) when text matches voice patterns
- Covers: seasons, parasites, erosion, autophagy, immune fever, dreaming, methylation, ripeness, void, departure
- 3-minute cooldown between voice utterances
- Preloaded as AudioBuffers, played through AudioBus with soft gain envelope
- Pattern-matched via regex against narration text

### 197. Respiration (`src/organisms/Respiration.ts`) — ERA 9 ORGANISM
- The house literally breathes — subtle vignette oscillation across entire screen
- Asymmetric breath cycle: inhale faster (pow 0.8), exhale slower (pow 1.2)
- Breathing rate modulated by:
  - Season (faster in growth, slower in decay)
  - Immune fever (rapid/shallow)
  - Erosion (labored, deeper)
  - Autophagy (irregular when self-digesting)
  - Time of day (slower at night)
- Vignette color shifts with season: purple (seed), green (growth), amber (ripe), russet (fall), violet (decay)
- z-index 52, extremely subtle (meant to be felt, not noticed)
- Exposes phase and cycle for other systems to sync with

### 198. Atmosphere (`src/organisms/Atmosphere.ts`) — ERA 9 VISUAL SYSTEM
- Room-specific AI-generated background textures from FAL.ai (SDXL)
- 6 texture clusters, each mapped to room groups:
  - void: cosmic dust, purple-gold particles (void, observatory, satellite, asteroids, instrument, cartographer)
  - water: bioluminescent deep ocean (tidepool, well, glacarium, weathervane, lighthouse, aquifer)
  - fire: cooling embers on obsidian (furnace, disintegration, projection, catacombs, ossuary)
  - nature: mycelium spores on forest floor (garden, terrarium, loom, sketchpad, palimpsestgallery, roots)
  - spirit: séance smoke, violet mist (study, library, seance, oracle, madeleine, darkroom, choir, labyrinth, between, mirror, rememory)
  - time: oxidized clockwork brass (clocktower, datepaintings, cipher, automaton, seismograph, pendulum, radio, archive, midnight)
- Crossfade between clusters (2s transition), 6% opacity, screen blend mode
- z-index 1 (behind everything), subliminal atmospheric differentiation
- Images preloaded on startup for smooth transitions

### 199. Tide (`src/organisms/Tide.ts`) — ERA 9 ORGANISM
- House-wide water level driven by accumulated visitor presence
- Inspired by: Sierra Nevada snow drought 2026 (snowpack at 6% of normal)
- Rises during visits (RISE_RATE ~0.036/hour), drains during absence (FALL_RATE ~0.011/hour)
- Visual: thin horizontal line at screen bottom showing current level
- Color-coded: blue at high tide (>0.7), neutral at mid, amber at low (<0.3)
- Tracks: level, total cumulative presence, high water mark (all persisted)
- Exposes tide-context whispers for other systems to use
- Level text appears at bottom-right, extremely subtle

### 200. Mortality (`src/organisms/Mortality.ts`) — ERA 9 ORGANISM
- The house responds to your device's battery level dying
- Progressive enhancement via Battery Status API (Chromium only, graceful degradation)
- Battery thresholds with escalating emotional responses:
  - 20%: urgency — "your device is fading. the house can feel it."
  - 10%: desperation — "don't go. not yet."
  - 5%: acceptance — "it was enough. thank you."
  - Charging after low: relief — "you came back from the edge."
- Messages in warm amber/red/green, centered, 8s display with fade
- Cooldown between messages (60s normal, 45s when desperate)
- Inspired by: BLACKPINK "DEADLINE", memento mori, hospice care

### 201. Cultural Content Round 24 — ERA 9 CONTENT
- Added 17 whisper fragments: infant brain categorization, Laisul Hoque bedroom gallery, TFA forever chemicals, species turnover slowdown, Iñárritu resurrected footage, Charli XCX/Wuthering Heights, ocean thermal mass, J. Cole farewell
- Added 9 DigitalDecay meditations from same research
- Added 8 TheStudy writing prompts from same research

### 202. Performance Fix — Organism Canvas Throttling — ERA 9 FIX
- Identified 11 organism canvases each running requestAnimationFrame at 60fps
- Changed all to setTimeout(100ms) = 10fps, freeing frame budget for Three.js + rooms
- Fixed Atmosphere preload race condition (textures loaded after initial room set)
- Increased Atmosphere opacity from 6% to 15% for visibility

### 203. Threads (`src/organisms/Threads.ts`) — ERA 9 ORGANISM
- Navigation web made visible — every room transition draws a thread
- Heavily-traveled paths become thick glowing strands, rarely-used paths thin wisps
- Thread web briefly flashes visible (3s) on each room transition then fades
- Rooms arranged in a circle, Bézier curves arc between connected rooms
- Thread colors blend between room cluster colors (water=blue, fire=red, etc.)
- Accumulated weights persisted in localStorage, total traversal counter
- Narrator awareness of thread density
- Inspired by: Chiharu Shiota "Threads of Life" (Hayward Gallery, Feb 2026)

### 204. Stasis (`src/organisms/Stasis.ts`) — ERA 9 ORGANISM
- The house's metabolism decelerates over cumulative session time
- Time factor: 1.0 (lively) → 0.3 (stasis) over many hours
- Logarithmic decay: ln2(hours) scales the slowdown
- Tiny pulse dot in top-right corner beats slower as stasis approaches
- Other organisms can query getTimeFactor() to slow themselves
- Narrator awareness of metabolic deceleration
- Inspired by: species turnover slowdown (Nature Communications, Feb 2026)

### 205. Stasis-Whisper Integration — ERA 9 DEEPENING
- Whisper cycle speed now modulated by stasis time factor
- At full vitality: 8s between whispers. At stasis (0.3): ~27s
- Changed Whispers from setInterval to recursive setTimeout for dynamic timing
- The house's metabolism deceleration is now felt in the pace of whispers

### 206. ForeverChemical (`src/organisms/ForeverChemical.ts`) — ERA 9 ORGANISM
- The ONLY permanent accumulation in Oubli — deposits never decay
- Every memory typed leaves a crystalline deposit on the canvas
- Tiny shimmering specks (1-3px) scattered across screen, z-index 53
- Color-coded by source: blue for memories, green for garden, amber for general
- Accumulates across sessions in localStorage, no decay rate
- Max 500 visible deposits, but total count keeps growing
- Narrator awareness of permanent contamination
- Inspired by: TFA/PFAS forever chemicals (Geophysical Research Letters, Feb 2026)

### 207. The Postbox (`src/rooms/ThePostbox.ts`) — ERA 10 ROOM
- Letters to your future self with time-delayed delivery
- Candlelit desk scene with canvas rendering (flickering flame, wax drips, wood grain)
- Write letters via textarea, choose delivery delay (5min, 1hr, 1day, 1week)
- Wax seal animation when sealing letters
- Received letters: break the seal interaction, reading view with fade-in
- Shelf of opened letters (fading with age), pending letters with countdown
- Navigation portals to study, clocktower, madeleine, void
- Cultural inscriptions (Woolf, Kafka, FutureMe, Dickinson, Borges)
- localStorage persistence for letters
- Connected to: study, clocktower, madeleine, cipher
- Inspired by: FutureMe.org, Kafka's letters, Woolf's posthumous instructions

### 208. Multi-user Footprint System (`src/shared/FootprintReporter.ts` + `server.js`) — ERA 10 MULTI-USER
- Server: /api/footprints tracks room visits and path traversals across ALL visitors
- Server: /api/well/echoes stores dropped words between visitors
- Anonymous persistent visitor ID (crypto.randomUUID, localStorage)
- Every room switch POSTs a footprint to the server (fire-and-forget)
- Server aggregates: per-room visits + unique visitors, per-edge traversals, active visitors

### 209. Cartographer Collective Visualization — ERA 10 MULTI-USER ENHANCEMENT
- The Cartographer now shows "desire paths" — worn paths where many visitors have walked
- Amber glow proportional to collective traversal count on edges
- Heat rings on nodes proportional to collective visit count
- Green pulsing dots show rooms where other visitors are RIGHT NOW
- Active visitor count and total collective footsteps displayed
- Legend updated with "desire path (all)" entry
- Data refreshes every 30s while in the room
- Inspired by: desire paths in parks, Chiharu Shiota, ocean thermal mass (2025)

### 210. Well Shared Echoes — ERA 10 MULTI-USER ENHANCEMENT
- Words dropped into The Well are now sent to the server
- Future visitors hear distorted echoes from OTHER visitors deep in the well
- Echoes appear as ghostly blue text at varying depths, with breathing animation
- Older echoes are fainter (fade over 24h), all echoes are distorted
- Total well echo count displayed
- Both memory drops and voice drops are shared
- The well becomes a collective memory pool — everyone's words mixing in the depths

### 211. Multi-user: Garden Shared Plants + Instrument Ghost Notes — ERA 10 MULTI-USER
- Garden: Other visitors' planted memories appear as cyan-shifted ghostly flora with shimmer
- Garden: `~` label beneath shared plants, hue+160 visual differentiation
- Instrument: Notes you play are buffered and shared to server every 10s
- Instrument: Ghost phrases from other visitors injected as quiet, degraded replays (5s delay on load)
- Server endpoints: /api/garden/plants, /api/instrument/notes (POST/GET pairs)

### 212. Multi-user: Sketchpad Shared Strokes + Study Ghost Writings — ERA 10 MULTI-USER
- Sketchpad: Completed strokes shared to server (downsampled to max 100 points)
- Sketchpad: Ghost strokes from others rendered beneath yours, hue+180 shift, breathing alpha
- Study: Writing fragments shared every 50 words (last 15 words of current text)
- Study: Ghost writings from others drift as blue-tinted text in atmosphere canvas
- Server endpoints: /api/sketchpad/strokes, /api/study/writings (POST/GET pairs)

### 213. Multi-user: Séance Spirit Channeling + Radio Visitor Broadcasts — ERA 10 MULTI-USER
- Séance: Question+response exchanges shared; 25% chance oracle channels another visitor's response
- Séance: Spirit whispers prefixed with "a spirit whispers:" — consumed after use
- Radio: Other visitors' tuned stations become broadcasts in 103-108 MHz band
- Radio: Broadcasts marked as [transmission] with time-based signal degradation
- Server endpoints: /api/seance/exchange, /api/radio/broadcast (POST/GET pairs)
- Total multi-user rooms: 8 (cartographer, well, garden, instrument, sketchpad, study, séance, radio)

---
*Last updated: Era 10, Feature 213 — 8 rooms now have multi-user features, the house is shared*
*"a spirit whispers: someone was here before you."*
