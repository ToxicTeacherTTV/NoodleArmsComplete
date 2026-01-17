# Changelog

All notable changes to the Nicky AI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### To Do
- Fast emotion tag generation for STREAMING mode (rule-based)
- Memory analytics dashboard UI
- "Save as Training" button for conversations
- Embedding cache for repeated queries (see MEMORY_SIMPLIFICATION_PLAN.md)
- Smart query routing (keyword-first) for API cost reduction

---

## [1.8.0] - 2026-01-17

### Fixed - Memory Retrieval System (Critical)
- **Scoring Formula Fix:** Changed importance multiplier from `×0.1` to `×0.005` in `embeddingService.ts`
  - Old: `score = similarity + (importance × 0.1)` — importance=80 added +8 points, overwhelming similarity
  - New: `score = similarity + (importance × 0.005)` — importance=80 adds only +0.4 points
  - Result: Semantic relevance now drives retrieval instead of high-importance memories dominating
- **Freshness Boost:** Added +20% boost for memories with <5 retrievals in `contextBuilder.ts`
- **Retrieval Penalty:** Added 3% penalty per retrieval (capped at 30%) to prevent same memories winning repeatedly
- **Confidence Filtering:** Moved confidence from scoring factor to filter-only (≥60 for CANON lane)
- **Diversity Enforcement:** Strengthened keyword overlap penalty (60%+ overlap = reduced score), max 2 memories from same source

### Fixed - Document Parsing
- **Sentence-Boundary Chunking:** Documents now split on sentence boundaries with 500-char overlap in `documentProcessor.ts`
- **Chunk Size Optimization:** Changed default chunk size from 2000 to 4000 chars for better context
- **Story Context Expansion:** Increased `storyContextSnippet` from 200 to 2000 chars to preserve narrative context
- **Large Document Handling:** Changed 50K chunks to 8K with sentence-aware splitting

### Fixed - Entity Extraction
- **Relational References:** Updated extraction prompt to capture family references like "his father" → "Nicky's Father"
- **Relationship Field:** Now populates the `relationship` field that was previously empty
- **JSON Schema Update:** Added relationship field to extraction schema

### Fixed - Podcast Fact Extraction
- **Speaker Distinction:** Fixed prompt to distinguish between Toxic (human host) and Nicky (AI co-host)
- **Correct Attribution:** Facts from Toxic's dialogue are now correctly attributed (Nicky should know about his co-host)
- **Live Test Script:** Added `server/scripts/test-podcast-extraction.ts` for verification

### Added - Testing Infrastructure
- **Memory Scoring Tests:** Created `server/tests/memory-scoring.test.ts` with 25 unit tests
  - Scoring formula verification
  - Freshness boost calculations
  - Diversity scoring
  - Confidence filtering
- **Podcast Extraction Tests:** Created `server/tests/podcast-extraction.test.ts` with 10 tests
  - Speaker detection (Nicky vs Toxic)
  - Various speaker label formats
  - Fact attribution verification
- **Vitest Configuration:** Added `server/vitest.config.ts` for server-side testing
- **NPM Scripts:** Added `test`, `test:watch`, and `test:all` commands

### Added - Cleanup Scripts
- **Podcast Cleanup:** Created `server/scripts/cleanup-podcast-facts.ts` for reviewing/deleting incorrectly extracted facts
- **Opinion Finder:** Created `server/scripts/find-nicky-opinions.ts` for auditing opinion attribution

### Fixed - Misc
- **Syntax Error:** Fixed orphan array elements in `trainingDataValidator.ts` (pre-existing bug)

---

## [1.7.0] - 2026-01-08

### Fixed - Rant Audio Pipeline
- **Browser Autoplay Policy**: Implemented "Enable Audio" button in JazzDashboard header to unlock AudioContext, fixing `DOMException` that blocked background audio playback.
- **Race Condition**: Added deduplication logic (`processedIds` ref) to `jazz-dashboard-v2.tsx` to prevent the same audio file from playing twice.
- **Queue Management**: Ported polling logic to `jazz-dashboard-v2.tsx` and implemented proper ACK endpoint to remove played items from `twitchBot` queue.
- **Server Stability**: Fixed "Split Brain" issue in `routes.ts` by correcting dynamic imports, ensuring a single `TwitchBotService` instance.

### Changed - Dashboard Consolidation
- **V2 Supremacy**: Audit confirmed `jazz-dashboard-v2.tsx` is the definitive dashboard.
- **Feature Parity**: Ported all missing V1 features to V2:
  - **Manual Controls**: Added "Consolidate Memory" and "Clear Chat" buttons to `JazzHeader`.
  - **Save to Memory**: Restored manual "Save to Memory" action for individual messages.
  - **Personality Panel**: Confirmed V2 uses the correct `/api/personality/state` endpoint (V1 was using deprecated `/api/chaos/state`).
- **UI Improvements**: Added audio unlock status and better error handling for ElevenLabs.

---

## [1.6.1] - 2026-01-04

### Fixed - Critical Stability & UX
- **Response Truncation:** Increased token limit from 1024 to **4096** for both Gemini and Anthropic, preventing mid-sentence cutoffs for long responses.
- **Character Constraint:** Enforced a **2200 character limit** via system prompt to ensure responses remain within platform bounds while maximizing verbosity.
- **Auto-Renaming:** Fixed logic bug where chats stayed named "New Chat" because the message count check was off-by-one.
- **Model Sanitation:** Removed deprecated `gemini-2.0-flash-exp` from rotation and added active interception to force-swap it to `gemini-3-flash-preview`.
- **Lore Crashes:** Patched a `SyntaxError` in `LoreOrchestrator` caused by the AI wrapping JSON in markdown code blocks.

---

## [1.6.0] - 2026-01-04

### Added - Privacy Controls & Memory Learning
- **Memory Learning Toggle:** Added a global UI toggle to enable/disable lore extraction and style learning.
- **Privacy Indicators:** Implemented "🧠 Learning" vs "🔒 Private" status indicators in the chat header.
- **Message-Level Privacy:** Added regex triggers (`[PRIVATE]`, `[OFF THE RECORD]`) to bypass memory storage on a per-message basis.

### Changed - Context Optimization & RAG Refinement
- **Semantic Training Retrieval:** Replaced linear training data scans with vector-based semantic retrieval for faster, more relevant style guidance.
- **Aggressive History Truncation:** Implemented a 600-character limit for historical messages in the prompt to prevent context bloat and reduce latency.
- **Rumor Capping:** Limited semantic rumor retrieval to 3 entries to maintain focus and speed.
- **Model Flow Audit:** Completed a full system audit to ensure **Gemini 3 Flash** is the primary engine for all operations (Chat, RAG, Extraction, Analysis).

### Fixed - Model Selection & Environment
- **.env Restoration:** Fixed a critical desync where the `.env` file was overriding production models with experimental versions. Restored `gemini-3-flash-preview` as the global default.
- **Orchestrator Routing:** Verified and tightened the `AIOrchestrator` routing logic to ensure consistent model selection across all services.

---

## [1.5.0] - 2026-01-03

### Added - Vibe-Based Storytelling & Personality Hardening
- **Vibe-Based Storytelling Engine:** Implemented a narrative engine for the "Where the fuck are the viewers from" segment.
  - **Narrative Archetypes:** Replaced rigid scripts with "Flavor Packs" (The Grudge, The Fugitive, etc.) for unpredictable stories.
  - **Multi-Turn Persistence:** Added `metadata` state tracking to conversations to manage story turns across multiple messages.
  - **Natural Detection:** Added regex and database-lookup logic to detect city mentions in chat and trigger segments.
  - **UI Triggers:** Added "Tell Story" buttons to the Listener Cities dashboard and random pick notifications.
- **Podcast Listener Cities Tracker:** A new dashboard for managing viewer locations, integrated with the main chat via query parameters.

### Changed - Personality & AI Strategy
- **Personality Hardening ("Show, Don't Tell"):** Strictly enforced character integrity by forbidding physical narration (asterisks, stage directions). Nicky now expresses himself solely through dialogue and [emotion] tags.
- **Gemini 3 Migration:** Fully migrated all primary operations to **Gemini 3 Flash**, including chat, RAG, and intelligence tasks.
- **Single-Pass Generation:** Optimized Podcast Mode to generate high-quality, long-form responses in a single pass, utilizing Gemini 3's massive context window.

### Fixed - Dashboard Reliability
- **React Initialization Fix:** Resolved a `ReferenceError` in `jazz-dashboard-v2.tsx` where `activeProfile` was accessed before initialization during query-param handling.
- **City Detection Sticky Logic:** Improved city detection to handle multi-word cities and cross-reference with the database for better accuracy.

---

## [1.4.0] - 2025-12-28

### Added - Personality & Variety Persistence
- **Persistence Layer:** Created `personality_state` and `variety_state` tables to store Nicky's mood, mode, and conversation variety (catchphrases, facets) across server restarts.
- **Variety Controller:** Updated `VarietyController.ts` to automatically save and load state from the database, ensuring Nicky doesn't repeat himself after a reboot.

### Changed - AI Orchestration & Context
- **Centralized Context:** Moved all show-specific (`Camping Them Softly`, `Camping the Extract`) and game-specific (`Arc Raiders`, `DbD`) detection logic into `AIOrchestrator.ts`.
- **Prompt Cleanup:** Removed redundant detection logic from `gemini.ts` and `anthropic.ts` to prevent prompt bloat and conflicting instructions.
- **Discord Punchiness:** Updated Discord mode instructions to encourage shorter, punchier responses and natural length variety.

### Fixed - Architectural Integrity
- **Cascading Deletes:** Updated `storage.ts` to ensure that deleting a profile correctly removes all associated records (messages, segments, memories, entities, etc.) across 30+ tables.
- **Discord Singleton:** Fixed an issue where the Discord bot was using a separate instance of the `VarietyController`, causing inconsistent catchphrase tracking.
- **Discord Memory Retrieval:** Replaced inefficient linear memory scans in the Discord bot with the optimized `searchMemoryEntries` method.
- **Discord Message Splitting:** Added automatic message splitting for Discord responses exceeding 2000 characters.

### Improved - Diagnostics & Reliability
- **Stronger Manual Enhancement**: Updated the manual "Enhance" button to trigger a "High Intensity" mode, making emotion tags more extreme (e.g., [screaming], [cackling]) and adding aggressive punctuation for manual re-rolls.
- **LLM-Powered Search Refinement**: Implemented Gemini-driven query optimization for complex web searches in `webSearchService.ts`.
- **News-Aware Search**: Added automatic domain prioritization for Dead by Daylight news and current events.
- **Search Result Validation**: Enhanced Bing scraper with relevance filtering to prevent "hallucinated" or junk results.
- **Intelligence Engine Sync**: Synchronized `IntelligenceEngine.ts` with the global model selection strategy, defaulting to `gemini-3-flash-preview`.
- **ElevenLabs Error Handling**: Added descriptive, character-themed error messages for TTS failures (e.g., quota exceeded, network issues).

---

## [1.3.0] - 2025-12-08

### Added - Diagnostic Chat Mode
- **Diagnostic Service:** Created `server/services/diagnosticService.ts` to inject system state into chat context.
- **Chat Command:** Added `/diag` command support in `server/routes.ts` to trigger diagnostic mode.
- **UI Integration:** Added "Run Diagnostics" option to the chat message composer menu.
- **Capabilities:** Allows testing of personality presets, intensity levels, chaos state, and memory recall without breaking character (too much).

### Changed - Arc Raiders Context Refinement
- **Squad Name Update:** Renamed squad members for better humor:
  - Cousin Vinny -> **Cousin Calzone** (The Heavy)
  - Uncle Paulie -> **Tommy "The Squint" Tortellini** (The Sniper)
  - Little Anthony remains Little Anthony (The Loot Goblin)
- **Context Switching Logic:** Improved regex to use word boundaries (`\b(arc raiders|arc)\b`) to prevent false positives from words like "search" or "march".
- **Sticky Context:** Verified and refined sticky context to ensure Nicky stays in "Arc Raiders mode" for follow-up messages.

### Documentation
- **Architecture Clarification:** Documented the `AIOrchestrator` pattern explaining the coexistence of `gemini.ts` and `anthropic.ts` for redundancy and user choice.

## [1.2.0] - 2025-12-07

### Fixed - Critical Vector Crash
- **Vector Parsing Fix:** Fixed a server crash (`SyntaxError: Unexpected non-whitespace character after JSON`) caused by `pgvector` returning native Arrays instead of JSON strings.
  - Applied robust parsing logic to `embeddingService.ts`, `memoryDeduplicator.ts`, and `documentDuplicateDetector.ts`.
  - Now handles: Native Arrays, JSON strings, and raw Postgres strings (e.g., `"{0.1,0.2}"`).

### Added - Arc Raiders Personality Mode
- **Sticky Context:** Nicky now remembers you are talking about "Arc Raiders" for up to 6 messages, even if you don't mention the game name explicitly.
- **The Squad:** Added specific family members for Arc Raiders context:
  - **Cousin Vinny:** The Heavy who refuses to use shields.
  - **Uncle Paulie:** The Sniper with bad eyesight who blames lag.
  - **Little Anthony:** The Loot Goblin who steals everything.
- **Creative Freedom:** Explicitly authorized Nicky to "make shit up," invent glitches, and exaggerate stories for comedic effect.

### Fixed - Fact Extraction
- **Scope Expansion:** Updated `gemini.ts` to explicitly extract "Game Knowledge" (mechanics, strategies, maps) instead of just lore/story.
- **Result:** Game guides and patch notes now correctly generate facts instead of returning "Zero facts found."

## [1.1.0] - 2025-11-10

### Added - Vector Embeddings & Semantic Search
- **EmbeddingService** (`server/services/embeddingService.ts`) - 640 lines
  - Gemini `text-embedding-004` integration
  - Batch embedding generation (50 per batch)
  - Cosine similarity-based semantic search
  - Automatic background embedding for new memories
- **Hybrid Search** - Combines keyword + semantic vector similarity
  - Configurable weights (40% keyword, 60% semantic)
  - Importance scoring boost
  - Recency bias maintained
- **API Endpoints**
  - `POST /api/memories/generate-embeddings` - Bulk backfill
  - `POST /api/memories/search-similar` - Pure semantic search
  - Hybrid search integrated into main chat flow

### Changed - STREAMING Mode Optimizations
- Reduced memory candidate multiplier from 3x to 1.5x (24 vs 45 candidates)
- Parallel context loading (3-5s savings)
- Response caching for instant repeated queries
- Smart context pruning (1-2s token savings)
- **Performance Result:** 50-60% faster responses (9-18s → 4-8s)

### Changed - Personality System
- Added explicit "RESPONSE VARIETY" guidelines to core identity
- Clarified when to use character traits vs answering directly
- Disabled chaos engine (set to 0%) for consistency
- Updated storytelling structure for multi-chunk podcast narratives
- **Status:** Awaiting user testing feedback

### Fixed
- Memory retrieval now finds semantically related concepts
- Query "family" correctly finds "SABAM crew" without exact keyword
- Streaming mode performance significantly improved

---

## [1.0.0] - 2025-10-13

### Added - Gemini-Primary Architecture
- **Model Selection System** (`server/config/geminiModels.ts`)
  - Centralized model configuration
  - Cost multipliers and tier definitions
  - Model validation utilities
- **Intelligent Model Selector** (`server/services/modelSelector.ts`)
  - Purpose-based routing (chat/extraction/analysis)
  - Automatic fallback chains (Flash → Pro → Experimental → Claude)
  - Smart error classification for retry strategies
  - Respects API-provided retry delays
- **Prometheus Metrics** (`server/services/prometheusMetrics.ts`)
  - `/metrics` endpoint for monitoring
  - LLM call tracking by provider and model
  - Token usage metrics
  - Cost estimation

### Changed - AI Provider Strategy
- **Primary:** Gemini 2.5 Flash (free tier: 10 RPM, 250K TPM, 250 RPD)
- **Fallback Chain:** Flash → Pro → Flash-Exp → Claude Sonnet 4.5
- **Cost Impact:** 85-90% reduction in AI costs
- **Services Updated:** 15 services migrated to Gemini-first strategy
  - User-facing: Chat, memory consolidation, intelligence analysis
  - Bulk tasks: Content flagging, document processing, fact extraction
  - Critical ops: Entity extraction uses production models only

### Fixed - Memory Deduplication System
- **Problem:** 39+ duplicate memories despite canonical key generation
- **Root Cause:** Keys generated but never checked in database
- **Solution:** Atomic UPSERT with unique constraint on `(profileId, canonicalKey)`
- **Metadata Merging:** Comprehensive field preservation
  - Counters: confidence +10 (max 100), supportCount +1
  - Arrays: Merge & deduplicate keywords/relationships
  - Quality fields: contradictionGroupId, temporalContext, qualityScore
  - Temporal: Preserve firstSeenAt, update lastSeenAt/updatedAt
- **Cleanup Result:** 1544 → 1505 unique memories (39 duplicates removed)

### Changed - Training System
- Increased training example limit from 10 to 50
- Smart sampling: 30 recent + 20 older examples
- Better style consistency with more diverse training data

---

## [0.9.0] - 2025-10-01

### Added - Initial Production Release
- React + TypeScript frontend with Vite
- Express + TypeScript backend
- PostgreSQL database with Drizzle ORM
- Claude Sonnet 4.5 as primary AI provider
- ElevenLabs voice synthesis integration
- Discord bot with proactive messaging
- Podcast RSS sync and fact extraction
- Document processing pipeline
- Memory system with RAG retrieval
- 11 personality presets
- Web search integration (SerpAPI)

### Core Features
- Real-time voice interaction
- Advanced memory architecture (1,500+ entries)
- Dynamic personality control with chaos engine
- Entity extraction and linking
- Training example system
- Listener cities tracking
- Preroll ad generation

---

## Version History Summary

| Version | Date | Key Features |
|---------|------|--------------|
| **1.8.0** | 2026-01-17 | Memory retrieval fix, document parsing improvements, entity extraction, testing infrastructure |
| **1.7.0** | 2026-01-08 | Rant audio pipeline fix, dashboard consolidation |
| **1.6.1** | 2026-01-04 | Response truncation fix, model sanitation, lore crashes |
| **1.6.0** | 2026-01-04 | Privacy controls, memory learning toggle |
| **1.5.0** | 2026-01-03 | Vibe-based storytelling, personality hardening |
| **1.4.0** | 2025-12-28 | Personality persistence, variety controller |
| **1.3.0** | 2025-12-08 | Diagnostic chat mode, Arc Raiders context |
| **1.2.0** | 2025-12-07 | Vector crash fix, Arc Raiders personality mode |
| **1.1.0** | 2025-11-10 | Vector embeddings, hybrid search, STREAMING optimizations |
| **1.0.0** | 2025-10-13 | Gemini migration, memory deduplication fix, cost optimization |
| **0.9.0** | 2025-10-01 | Initial production release, core features |

---

## Migration Guides

### Upgrading to 1.1.0 (Vector Embeddings)
1. **No breaking changes** - Embeddings generate automatically for new memories
2. **Optional:** Run bulk backfill for existing memories
   ```bash
   curl -X POST http://localhost:5000/api/memories/generate-embeddings \
     -H "Content-Type: application/json"
   ```
   - Takes ~30 minutes with rate limiting
   - Can be done gradually in background

### Upgrading to 1.0.0 (Gemini Migration)
1. **Add environment variable:** `GEMINI_API_KEY` (required)
2. **Keep Claude API key** as fallback (optional on free tier)
3. **Configure model selection** (optional):
   ```bash
   GEMINI_DEFAULT_MODEL=gemini-2.5-flash
   GEMINI_DEV_MODEL=gemini-2.0-flash-exp
   ```
4. **Monitor rate limits** - Free tier may require paid upgrade for production

---

## Known Issues

### Current Limitations
- **Free Tier Rate Limits:** Gemini Flash (10 RPM) frequently exceeded with 2+ users
- **Embedding Backfill:** Existing memories need manual backfill (~30 min)
- **Chaos Engine:** Disabled (0%) pending user feedback on optimal level
- **Emotion Tags:** STREAMING mode still uses AI call (not yet optimized)

### Workarounds
- Rate limits: Monitor fallback frequency, consider paid tier upgrade
- Embeddings: Use backfill endpoint, or let gradual population occur naturally
- Quality: Track experimental model fallback as indicator of rate limiting

---

## Future Roadmap

### Short Term (Q4 2025)
- Complete embedding backfill for all memories
- Fast emotion tag generation for STREAMING mode
- Memory analytics dashboard UI
- "Save as Training" conversation feature

### Medium Term (Q1 2026)
- Voice cloning from podcast recordings
- Request queuing for rate limit management
- Enhanced debug panel for memory retrieval
- A/B testing framework for personality tuning

### Long Term (Q2+ 2026)
- Multi-user support with rate limit pooling
- Advanced analytics and insights
- Testing infrastructure (unit, integration, E2E)
- Dockerization and deployment automation

---

**Maintenance:** This changelog is updated with each release. For detailed implementation notes, see `PROJECT_ROADMAP.md` and `NOTES.md`.
