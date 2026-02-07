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
- **Navigation**: Bottom tab bar (`the void · the study · the instrument`)
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

### Total Rooms: 38
Surface: 33 | Hidden: 7 (catacombs, roots, ossuary, between, aquifer, midnight, mirror)

---
*Last updated: Era 7, Feature 71 — Date Paintings*
*"38 rooms. the house is a museum, a cinema, a space station, a glacier. every room remembers differently."*
