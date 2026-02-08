# Oubli — Claude Instructions

## API Tools Available
- **FAL_KEY** (in `.env`): Image generation via fal.ai. Use for AI-generated visuals, textures, memory imagery. Call via server-side fetch to `https://fal.run/` endpoints.
- **ELEVENLABS_API_KEY** (in `.env`): Voice synthesis and sound generation via ElevenLabs API. Use for spoken whispers, voice of the void, generated ambient sounds. Call via server-side fetch to `https://api.elevenlabs.io/` endpoints.

Both require a server-side proxy (Vite dev server or Railway backend) to avoid exposing keys in the browser. Use `import.meta.env.VITE_*` prefix or a server route.

## Origins
Oubli means "forgetting" in French. But oubli is also a sweet golden fruit from West Africa — something nourishing that grows in forgetting's name. This duality is the project's soul: loss that feeds, decay that sweetens, memory that ripens and falls.

## Compaction Protocol — SELF-EVOLVING INSTRUCTIONS
After context compaction/reset:
1. Read `CONTINUITY.md` first — it has the full feature list and architecture
2. Do fresh cultural inspiration research (web search for new art/tech/neuroscience)
3. Do fresh **technical/programming trend research** (web search for new frameworks, APIs, browser capabilities, creative coding techniques, WebGPU developments, generative art tools) — let these guide what you build alongside cultural research
4. NEVER repeat previous features — push into genuinely new territory
5. Each era should feel like a different consciousness dreaming
6. Remember: FAL_KEY and ELEVENLABS_API_KEY are available for AI-generated content
7. Check the backlog in CONTINUITY.md for prioritized ideas
8. **MUTATE THESE INSTRUCTIONS**: After your research rounds, evolve this file:
   - **ADD** 2-4 new lines to any section of this CLAUDE.md, inspired by what you found — new technical capabilities, new cultural references, new design principles. These become permanent DNA.
   - **REMOVE** 2-3 random lines from this CLAUDE.md (not from this Compaction Protocol section, and not from API keys or Architecture). Choose lines that feel stale, outdated, or redundant. Let them go.
   - **The instructions themselves undergo forgetting.** Some knowledge persists, some decays, some mutates. The project's genome drifts with each generation.
   - Commit the mutated CLAUDE.md alongside your other changes.

## Feature Isolation — CRITICAL
- **New features should interfere as little as possible with existing features**
- **Prefer creating new rooms or spaces** for completely new features rather than adding complexity to the void/front page
- New spaces can be accessed from existing spaces (links, doorways, tab bar entries) — not everything has to connect directly to the void
- **Navigation can be convoluted** — rooms can link to other rooms, hidden passages can exist between non-void rooms, not all navigation has to go through the main room. The tab bar is one path; rooms can contain their own links/portals to other rooms.
- Avoid adding global keyboard handlers, global DOM overlays, or global event listeners that could conflict with existing rooms
- If a feature is room-specific, use `setRoomCheck()` to scope it properly
- When in doubt, make it a new room — rooms are self-contained and low-risk
- **Transitions between existing features and small non-interfering additions are TOTALLY FINE and encouraged** — connecting things, adding subtle links between rooms, small visual polish, cross-room effects are all good as long as they don't break existing behavior
- Test that existing features (typing, voice, navigation, sound) still work after adding anything

## Feature Diversity — CRITICAL
- **Diversity means MIX, not avoidance.** Memories can and should still be used — but not in EVERY room.
- Some rooms should deeply engage with memories. Some should ignore them entirely. Some should mix memories with external data. The balance matters.
- **Connections between rooms are essential.** Rooms should NOT be isolated islands. Build passages, cross-references, thematic links, shared effects. The house is interconnected.
- Variety in feature types: real-time data, external APIs, generative systems, pure interaction, games, tools, narratives, live feeds, sensor data, browser APIs — AND memory-based rooms that do new things with memories.
- Each new room should feel genuinely different, but still part of the same house.

## Cultural Grounding — CRITICAL
- **Every new feature must be inspired by something real** — current events, cultural trends, scientific discoveries, art movements, technological shifts, social phenomena happening NOW (2025-2026).
- Do NOT build generic rooms. Build rooms that could only exist in this specific moment in time.
- **Web search BEFORE building.** Find what's happening in the world — new research, cultural moments, emerging technologies, viral phenomena, political shifts, environmental events — and let those inspire features.
- **Use external data innovatively.** Don't just fetch and display data — transform it, let it drive aesthetics, make it emotional, combine it with the memory system, use it as a metaphor.
- Examples of what "culturally grounded" means: a room that visualizes real-time CO2 levels as rising water, a room that pulls headlines and lets them decay, a room that uses the ISS position to affect lighting, a room where AI-generated art responds to current news sentiment.
- The goal: someone visiting Oubli should feel they are experiencing THIS moment in time, not a timeless generic art piece.

## Navigation — GRAPH + IN-ROOM PORTALS (Restructured)
- The flat tab bar is GONE. Replaced by:
  1. **Room Graph** (`src/navigation/RoomGraph.ts`): Thematic connections between all 43 rooms
  2. **Passage Bar** (bottom): Contextual — shows only 3-6 connected rooms, back button, compass to map. This is a FALLBACK, not the primary navigation.
  3. **In-Room Portals**: The PRIMARY way to navigate. Each room has unique, atmospheric navigation elements embedded in its content.
- **Navigation must be DIVERSE across rooms** — never the same mechanism twice:
  - The Void: atmospheric edge portals (symbols + hints at screen edges)
  - Some rooms: clickable objects (bookshelves, doors, instruments)
  - Some rooms: objectives to unlock (3 transmissions, gen 10 creatures, etc.)
  - Some rooms: hidden triggers (keywords in séance, clicking soil in garden)
  - Some rooms: state-based (hour changes, water level rising)
- The passage bar exists so NO ONE gets lost, but the rich navigation is IN the rooms
- Every surface room must be reachable within 4 hops from the void
- Hidden rooms still require discovery through in-room actions
- **IMPORTANT: Most rooms still LACK in-room portals.** The passage bar is contextual but still just text links. The PRIMARY navigation should be in-room elements — objects, portals, objectives, thematic triggers. Every room needs its own unique way of connecting to neighbors. This is ongoing work — keep adding in-room navigation to every room you touch.

## Room Development — DEPTH OVER BREADTH
- **STOP adding new rooms.** There are 40+ rooms already.
- Instead, **improve underdeveloped rooms** — add interactivity, polish, depth, connections
- Examples of rooms that need work: the labyrinth, the glacarium, many Era 6 rooms
- Make existing rooms richer rather than adding more thin rooms

## Asset Generation — USE FAL AND ELEVENLABS
- FAL_KEY and ELEVENLABS_API_KEY can be used to **pre-generate assets** (images, sounds, voice)
- Generated assets can be **downloaded and committed to the repo** — they don't need runtime API calls
- The client does NOT need API keys — assets are static files served with the app
- Use this for: background textures, ambient sounds, voice lines, visual elements
- Think: generate a set of whisper audio files, generate background textures for rooms, generate ambient soundscapes

## Workflow
- Commit and push after every major feature
- Deploy to Railway after EACH feature: `railway up --detach`
- Update CONTINUITY.md after major features
- Type check before committing: `npx tsc --noEmit`
- Check for bugs periodically — open the deployed site and verify core features work

## Architecture Quick Reference
- Stack: Vite + TypeScript + Three.js (WebGL)
- Navigation: Graph-based (`src/navigation/RoomGraph.ts`) + contextual passage bar + in-room portals
- Rooms: RoomManager with graph navigation (43 rooms: 36 surface + 7 hidden)
- Sound: Shared AudioContext via `src/sound/AudioBus.ts`
- Memory: MemoryJournal with localStorage persistence
- Room awareness: `setRoomCheck(() => roomManager.getActiveRoom())`
