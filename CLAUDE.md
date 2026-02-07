# Oubli — Claude Instructions

## API Tools Available
- **FAL_KEY** (in `.env`): Image generation via fal.ai. Use for AI-generated visuals, textures, memory imagery. Call via server-side fetch to `https://fal.run/` endpoints.
- **ELEVENLABS_API_KEY** (in `.env`): Voice synthesis and sound generation via ElevenLabs API. Use for spoken whispers, voice of the void, generated ambient sounds. Call via server-side fetch to `https://api.elevenlabs.io/` endpoints.

Both require a server-side proxy (Vite dev server or Railway backend) to avoid exposing keys in the browser. Use `import.meta.env.VITE_*` prefix or a server route.

## Compaction Protocol
After context compaction/reset:
1. Read `CONTINUITY.md` first — it has the full feature list and architecture
2. Do fresh cultural inspiration research (web search for new art/tech/neuroscience)
3. NEVER repeat previous features — push into genuinely new territory
4. Each era should feel like a different consciousness dreaming
5. Remember: FAL_KEY and ELEVENLABS_API_KEY are available for AI-generated content
6. Check the backlog in CONTINUITY.md for prioritized ideas

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
- **NOT everything has to revolve around saved memories.** Many rooms use `getMemories()` as their primary content source — this is getting repetitive
- Think MORE outside the box: rooms can be about real-time data, external APIs, generative systems, pure interaction, games, tools, narratives, live feeds, sensor data, browser APIs, or anything else
- Features can be completely self-contained with no connection to the memory system
- Variety is essential — each new room should feel like a genuinely different experience, not just "another way to view your memories"
- The system is a living world that contains EVERYTHING, not just a memory gallery

## Workflow
- Commit and push after every major feature
- Deploy to Railway after EACH feature: `railway up --detach`
- Update CONTINUITY.md after major features
- Type check before committing: `npx tsc --noEmit`
- Check for bugs periodically — open the deployed site and verify core features work

## Architecture Quick Reference
- Stack: Vite + TypeScript + Three.js (WebGL)
- Rooms: RoomManager with tab bar (void, study, instrument, observatory, séance)
- Sound: Shared AudioContext via `src/sound/AudioBus.ts`
- Memory: MemoryJournal with localStorage persistence
- Room awareness: `setRoomCheck(() => roomManager.getActiveRoom())`
