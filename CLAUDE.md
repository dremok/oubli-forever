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

## Workflow
- Commit and push after every major feature
- Deploy to Railway: `railway up --detach`
- Update CONTINUITY.md after major features
- Type check before committing: `npx tsc --noEmit`

## Architecture Quick Reference
- Stack: Vite + TypeScript + Three.js (WebGL)
- Rooms: RoomManager with tab bar (void, study, instrument, observatory)
- Sound: Shared AudioContext via `src/sound/AudioBus.ts`
- Memory: MemoryJournal with localStorage persistence
- Room awareness: `setRoomCheck(() => roomManager.getActiveRoom())`
