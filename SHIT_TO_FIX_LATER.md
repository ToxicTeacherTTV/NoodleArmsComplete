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
- **Priority:** ✅ FIXED - Parallel batching and reduced chunk size implemented. Monitoring for any edge cases.

---

## 🔧 Minor Annoyances

- flagging system still exists for no real purpose. need to figure it out. what does it do? what SHOULD it do? is it worth implementing? etc.

---

## 💡 Nice-to-Haves

### Need option to review proposed dupe changes
- **Status:** ✅ FIXED - Implemented in Intelligence Dashboard. Users can now review and edit proposed merges before they are finalized.

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

