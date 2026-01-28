# Changelog

All notable changes to the Nicky AI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - Complete UI Reorganization (Phases 1-3)

**Problem:** Navigation was chaotic with 21 horizontal tabs, no clear hierarchy, and no contextual help. Features were scattered across confusing locations.

**Solution:** Complete redesign into 3-page task-based hierarchy with contextual help throughout.

#### Phase 1: New Memory Page (`/memory-v2`)
**Components Created:**
- `MemorySidebar.tsx` - 3-section vertical navigation with tooltips
- `WhatNickyKnows.tsx` - Browse/search with 5 tabs (Recent/All/Entities/Documents/Podcasts)
- `ReviewAndFix.tsx` - Quality review with 5 tabs (By Trust/Contradictions/Duplicates/Flags/Protected)
- `Insights.tsx` - Analytics with 5 tabs (Overview/Analytics/Intelligence/Timeline/System)
- `QuickActionsMenu.tsx` - Always-accessible dropdown with 6 maintenance tools
- `EmptyState.tsx` - Reusable empty state component

**Features:**
- Task-based sidebar navigation (What/Review/Insights)
- Comprehensive tooltips on every button and section
- Empty states with helpful guidance
- Inline descriptions throughout
- Quick Actions dropdown always accessible

#### Phase 2: New Settings Page (`/settings`)
**Components Created:**
- `SettingsSidebar.tsx` - 4-section vertical navigation with tooltips
- `PersonalitySettings.tsx` - Core identity, presets, heat/chaos controls
- `IntegrationsSettings.tsx` - Discord, Twitch, API key management
- `ContentPipelineSettings.tsx` - Podcast RSS, content ingestion, auto-processing
- `SystemSettings.tsx` - Profiles, debug/logging, operations status

**Features:**
- Consolidated all scattered configuration
- Moved Personality from Memory page
- Moved Discord management from Memory page
- Moved Podcast RSS from old "Podcast Studio"
- Clear 4-section organization

#### Phase 3: Navigation Cleanup
**Changes to `AppShell.tsx`:**
- Reduced top navigation from 4 tabs to 3
- **Before:** Dashboard | Memory | Podcast Studio | Analytics
- **After:** Chat | Memory | Settings
- Memory tab now points to `/memory-v2` (new interface)
- Removed misleading "Podcast Studio" (was actually dev workspace)
- Removed redundant "Analytics" (merged into Memory → Insights)

**Routing Updates (`App.tsx`):**
- Added `/memory-v2` route (new memory interface)
- Added `/settings` route (new settings interface)
- Kept `/memory` for backward compatibility
- Old `/workspace` and `/listener-cities` still accessible directly

#### Benefits
- **Reduced complexity**: 3 pages instead of 4, 2-level nav instead of 21 flat tabs
- **Improved discoverability**: Task-based organization, clear labels
- **Better guidance**: 50+ contextual help elements (tooltips, empty states, descriptions)
- **Easier maintenance**: Modular component structure, reusable patterns

#### Documentation
- Created `docs/UI_REORGANIZATION_COMPLETE.md` - Complete implementation guide
- See file for full visual hierarchy, migration guide, and testing checklist

### To Do
- Phase 4: Analytics Page Decision (keep/merge/remove)
- Phase 5: Polish (keyboard shortcuts, loading states, mobile responsive)
- Test all recent changes (conversation history, user stories, asterisk fixes)
- Fix conversation/stream handler to preserve Nicky's stories (Phase 2 of Story Preservation)
- Fast emotion tag generation for STREAMING mode (rule-based)
- "Save as Training" button for conversations
- Embedding cache for repeated queries (see MEMORY_SIMPLIFICATION_PLAN.md)
- Smart query routing (keyword-first) for API cost reduction

---

## [1.11.0] - 2026-01-25

### Added - User Story Detection (Phase 3 of Story Preservation)

**Problem:** Nicky couldn't remember stories that users told him - only his own stories.

**Solution:** Automatic detection and preservation of user-told stories in conversations.

#### Changes to Lore Orchestrator (`LoreOrchestrator.ts`)
- **Story Detection Heuristics:** Added `isUserStory()` method with detection criteria:
  - Length ≥ 150 characters
  - Narrative indicators: "yesterday", "last week", "I remember", "this one time", etc.
  - Past tense verb density (≥2 past tense verbs)
  - Multiple sentences (≥2)
- **Hierarchical Storage:** User stories stored as `type: 'STORY'` with metadata `toldBy: username`
- **Atomic Fact Extraction:** Facts extracted FROM user stories and linked via `parentFactId`
- **Confidence:** User stories marked with `confidence: 100` (always canon)

#### Changes to Chat Service (`chatService.ts`)
- **Speaker Metadata:** Added speaker info to `processNewContent()` calls:
  - `speaker: 'user'`
  - `speakerName: username`
  - `speakerId: user ID`

#### Test Results
- ✅ 4/5 test cases passed
- ✅ 2 user stories detected and stored with full narrative content
- ✅ 8 atomic facts extracted and linked to parent stories
- ✅ Non-stories correctly filtered (questions, opinions)
- ❌ 1 borderline case (too short at 107 chars, needs 150+)

#### Benefits
- **Two-Way Memory:** Nicky remembers stories YOU tell him, not just his own
- **Story Reference:** Can say "Yeah, you told me about that Claudette who DC'd"
- **Relationship Building:** Builds conversational continuity and depth

**Files:** `server/services/LoreOrchestrator.ts`, `server/services/chatService.ts`, `server/scripts/test-user-story-detection.ts`

---

### Fixed - Asterisk Stripping and Incomplete Sentences

**Problem:** Nicky was generating asterisks (breaking TTS) and incomplete sentences with trailing spaces.

#### Root Cause Analysis
- **AI generation truncation** caused incomplete responses
- **Asterisk stripping code** was previously removed from codebase
- **Generation cutoffs** resulted in `**` with no content between asterisks
- **Trailing spaces** before punctuation indicated truncated content

#### Fixes Implemented

**1. Asterisk Stripping (`chatService.ts` - `normalizeResponseTags()`)**
```typescript
// Strip ALL asterisks at start of processing
let processed = content.replaceAll('*', '');
```

**2. Incomplete Sentence Cleanup (`chatService.ts`)**
```typescript
// Fix multiple spaces before punctuation: "text   !" → "text!"
processed = processed.replace(/\s{2,}([!?.])/g, '$1');
```

**3. Truncation Detection (`chatService.ts`)**
- Logs warnings when suspicious patterns detected
- Helps identify AI generation issues

**4. System Prompt Rules (`gemini.ts`)**
- Added: "NO ASTERISKS (*) FOR ANY REASON - they break text-to-speech"
- Added: "COMPLETE ALL SENTENCES. Never trail off with spaces or ellipses mid-thought"

#### What This Fixes
**Before:**
```
[shouting] **INDUSTRIAL DOOM POLKA**  !
```

**After:**
```
[shouting] INDUSTRIAL DOOM POLKA!
```

**Files:** `server/services/chatService.ts`, `server/services/gemini.ts`

---

### Improved - Conversation History Window

**Problem:** Limited context window (8-12 messages) meant Nicky forgot older conversation flow.

#### Changes
- **Regular Chat:** 12 → **30 messages** (15+ turns of back-and-forth)
- **Streaming Mode:** 8 → **20 messages**
- **Keyword Extraction:** 3 → **5 messages** for contextual keywords

#### Benefits
- **Better Continuity:** Nicky remembers more of what you talked about
- **Longer Conversations:** Can reference things said 15-20 exchanges ago
- **Combined with User Stories:** Both recent flow + complete story preservation

**Files:** `server/services/contextBuilder.ts`

---

## [1.10.0] - 2026-01-24

### Added - Story Preservation System (Phase 1: Podcasts)

**Problem:** Nicky's stories were being atomized immediately, losing narrative structure and preventing him from referencing past stories.

**Solution:** Hierarchical memory system that preserves complete narratives while extracting searchable facts.

#### Changes to Podcast Processing (`podcastFactExtractor.ts`)
- **Story-First Extraction:** Now extracts complete stories using `extractStoriesFromDocument()` before atomizing
- **Hierarchical Storage:** Stories stored as `type: 'STORY'` with full narrative content
- **Atomic Fact Linking:** Facts extracted FROM stories are linked via `parentFactId` field
- **Result Return:** Added `storiesCreated` to return type alongside `factsCreated` and `entitiesCreated`

#### Memory Structure
```
type: 'STORY'          ← Complete narratives (preserved)
  ├─ type: 'ATOMIC'    ← Searchable facts (linked via parentFactId)
  └─ type: 'ATOMIC'

type: 'FACT'           ← Standalone facts (metadata)
```

#### Test Results
- ✅ 5 stories preserved with full narrative content from test transcript
- ✅ 13 atomic facts extracted and linked to parent stories
- ✅ 8 entities extracted (Uncle Vinny, Tony Benedetti, Sal's Pizzeria, etc.)
- ✅ Deduplication working (90% similarity threshold)

#### Benefits
- **Story Reference:** Nicky can now say "Remember when I told you about Uncle Vinny's poker game?"
- **Search Enabled:** Atomic facts enable semantic search while preserving full context
- **Backward Compatible:** Old atomized facts remain; new extraction adds stories
- **Reprocessable:** Existing podcast episodes can be reprocessed to extract stories

#### Future Work
- **Phase 2:** Apply same pattern to live conversations (chat/Discord/streams)
- **Phase 3:** Detect and preserve stories that USERS tell Nicky

**Files:** `server/services/podcastFactExtractor.ts`, `server/scripts/test-podcast-story-extraction.ts`, `docs/STORY_PRESERVATION_SESSION.md`

---

## [1.9.0] - 2026-01-19

### Fixed - Importance/Confidence Inflation (Critical)

Major overhaul to fix inflated importance and confidence values that were causing retrieval issues.

#### Document Classification (`documentProcessor.ts`)
- **Profile Detection:** Added filename patterns for `profile`, `character`, `lore`, `bio`, `biography`, `backstory`, `facts`, `data`, `info`, `wiki`, `reference`, `notes`
- **Content Detection:** New "about Nicky" pattern matching detects third-person descriptions (e.g., "Nicky is...", "Nicky's streaming...")
- **Default Fix:** Documents with 0 Nicky turns now default to `informational` mode instead of `conversational`
- **`.docx` Bug:** Fixed false positive where `.docx` extension matched "doc" pattern, giving all Word docs +20 confidence boost

#### AI Extraction Prompts (`gemini.ts`)
- **Importance Guidance:** Added detailed scale with examples:
  - 1-25: Minor details, trivial info
  - 26-45: Standard facts, common details
  - 46-60: Notable facts (MOST facts should be here)
  - 61-75: Important facts, key traits
  - 76-100: CRITICAL ONLY - core identity facts
- **Example Fix:** Changed example importance from `80` to `45`
- **Warning:** Added "⚠️ MOST facts should be importance 35-55"

#### Confidence Calculation (`documentProcessor.ts`, `storage.ts`)
- **Source Boost:** Reduced from +20 to +15 for official docs, +15 to +10 for notes
- **Importance Boost:** Reduced from `/5` (0-20 range) to `/10` (0-10 range)
- **Max Cap:** Reduced from 95 to 85 for auto-extracted content
- **Duplicate Boost:** Reduced from +10 to +3 per duplicate encounter
- **Auto-Ceiling:** Non-protected facts now cap at 85 confidence (reserves 90+ for manual verification)

#### Importance Merge Logic (`storage.ts`)
- **Old:** `GREATEST(old, new)` - importance only ever increased
- **New:** `(old * 0.6 + new * 0.4)` - weighted average favoring stability

#### Patch Notes Processor (`patchNotesProcessor.ts`)
- **CRITICAL BUG:** Fixed `importance: 850, 900, 700, 500` → now `65, 50, 35` (was completely off 1-100 scale!)
- **Confidence:** Reduced from 99 to 75

#### Podcast Fact Extractor (`podcastFactExtractor.ts`)
- **Importance Normalization:** Added detection for 1-10 scale values, auto-converts to 1-100
- **Confidence:** Reduced from 95 to 75

#### Fact Merge Endpoint (`routes.ts`)
- **Old:** Hardcoded `confidence: 100` for merged facts
- **New:** Calculated from source facts average + 5, capped at 85

### Added - Database Migration Script
- **Script:** `server/scripts/normalize-importance-confidence.ts`
- **Purpose:** Normalizes existing inflated values in database
- **Dry Run:** Shows distribution before/after without changes
- **Apply:** Use `--apply` flag to commit changes
- **Results:** Normalized 4,008 entries
  - Confidence 100 (non-protected): 28.1% → 0.2%
  - Confidence 86-99: 50.9% → 0.1%
  - Confidence 76-85: 11.9% → 90.4%
  - Importance 81-100: 34.2% → 3.9%
  - Importance 61-80: 24.7% → 55.1%

### New Confidence Tiers
| Tier | Range | Purpose |
|------|-------|---------|
| Low | 1-59 | Unverified, rumor-like |
| Standard | 60-75 | Auto-extracted content |
| Boosted | 76-85 | Frequently confirmed facts |
| Manual | 86-99 | Human-verified content |
| Protected | 100 | Core identity facts only |

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
