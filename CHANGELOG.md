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
