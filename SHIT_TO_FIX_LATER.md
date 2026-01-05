# Shit to Fix Later

**Quick capture list for bugs, annoyances, and "I'll get to that eventually" items**

Last Updated: January 3, 2026

---

## 🐛 Active Issues

- flagging system still exists for no real purpose. need to figure it out. what does it do? what SHOULD it do? is it worth implementing? etc.

---

## ✅ Fixed (Archive)

### Dashboard Initialization Error (activeProfile)
- **Fixed:** January 3, 2026
- **Resolution:** Fixed hook ordering in `client/src/components/jazz-dashboard-v2.tsx` where `activeProfile` was being accessed before its initialization in the `useQuery` hook.

### Rigid Storytelling State Machine
- **Fixed:** January 3, 2026
- **Resolution:** Replaced the hardcoded `story_state` logic with a "Vibe-Based" Narrative Archetype system. Nicky now uses unpredictable archetypes (The Grudge, The Fugitive, etc.) driven by metadata and system prompts.

### Natural City Detection
- **Fixed:** January 3, 2026
- **Resolution:** Enhanced `aiOrchestrator.ts` with regex and database cross-referencing to detect cities naturally in chat (e.g., "tell me about Oklahoma City") and automatically mark them as covered.

### Gemini 3 Migration & Single-Pass Generation
- **Fixed:** January 3, 2026
- **Resolution:** Fully migrated to Gemini 3 Flash/Pro. Implemented Single-Pass Generation for Podcast Mode, reducing latency and costs by ~95%.

### Entities update
- **Fixed:** December 2, 2025
- **Resolution:** Implemented new entity tables (`concepts`, `items`, `miscEntities`) in `server/storage.ts` and `shared/schema.ts` to support broader lore categorization.

### Intelligence analysis inefficient
- **Fixed:** November 23, 2025
- **Resolution:** Implemented in-memory caching with 1-hour TTL for intelligence analysis. Added `?refresh=true` support to API for manual re-runs.

### Log files have out of date messages
- **Fixed:** November 23, 2025
- **Resolution:** Updated `server/routes.ts` and `server/services/aiOrchestrator.ts` to reflect `gemini-3-pro-preview` as the default model in logs and logic, replacing outdated references to `claude-sonnet-4.5`.

### Doesn't seem to be using Gemini 3 Pro in chat
- **Fixed:** November 23, 2025
- **Resolution:** Updated central config and all service files to use `gemini-3-pro-preview` for chat, analysis, and intelligence tasks. Also optimized bulk tasks (extraction, dedupe) to use `gemini-2.5-flash` and `gemini-2.5-pro` for cost efficiency.

*(Move completed items here with date fixed)*

