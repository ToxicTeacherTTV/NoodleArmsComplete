# Shit to Fix Later

**Quick capture list for bugs, annoyances, and "I'll get to that eventually" items**

Last Updated: November 23, 2025

---

## 🐛 Active Issues

### Document Processing Hangs on Large Files
- **What:** Document processing gets stuck after 3+ hours, likely in batched entity extraction phase
- **When:** Uploading large documents (>100KB)
- **Impact:** Wastes tokens, blocks processing queue
- **Notes:** Switched to Gemini 2.5 Flash (Nov 23). **Nov 28 Update:** Implemented parallel batch processing (3 chunks at a time) and reduced chunk size (100k -> 50k chars) to prevent timeouts. Added per-chunk error handling.
- **Priority:** MONITORING - Fix deployed, need to verify with large upload.

---

## 🔧 Minor Annoyances

- flagging system still exists for no real purpose. need to figure it out. what does it do? what SHOULD it do? is it worth implementing? etc.

---

## 💡 Nice-to-Haves

### Need option to review proposed dupe changes
- need a way that when i click "edit and merge" when looking at memory deduplication, that it will first list the original and the dupe in the same box that i can edit as i see fit, then click approve, then it goes through. alternatively, if i do a "quick merge", i'd like to see the proposed merge along with all facts, and have the ability to edit the proposed AI merge.

---

## ✅ Fixed (Archive)

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

