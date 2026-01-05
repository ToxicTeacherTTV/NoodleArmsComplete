# Nicky AI - Project Roadmap & Improvements

**Last Updated:** January 3, 2026

This document tracks suggested improvements and their implementation status.

---

## 🎉 RECENT COMPLETIONS (January 4, 2026)

### Stability & Truncation Fixes (v1.6.1) ✅ COMPLETED
**Status:** DEPLOYED - 4096 tokens, Character Limits, Auto-Renaming

**What was fixed:**
- ✅ **Response Truncation:** Increased token limit to **4096** (from 1024) for both Gemini and Anthropic.
- ✅ **Character Limit:** Enforced **2200 char limit** via system prompt to keep responses concise.
- ✅ **Auto-Renaming:** Fixed off-by-one error preventing "New Chat" from renaming automatically.
- ✅ **Lore Crashes:** Patched JSON parsing error in `LoreOrchestrator`.

### Personality Hardening & "Show, Don't Tell" ✅ COMPLETED
**Status:** DEPLOYED - Character integrity enforcement

**What was built:**
- ✅ **Strict Behavioral Constraints**: Nicky is now forbidden from using asterisks (`*leans in*`) or physical narration.
- ✅ **Emotion Tagging**: Shifted all physical expression to `[emotion]` tags (e.g., `[sighs]`, `[yelling]`) which are handled by the voice engine.
- ✅ **System Prompt Refactor**: Updated `gemini.ts` and `aiOrchestrator.ts` to enforce "Show, Don't Tell" logic.
- ✅ **Validation**: Verified that Nicky no longer narrates his own actions in chat or podcast modes.

**Files:** `server/services/gemini.ts`, `server/services/aiOrchestrator.ts`, `docs/EMOTION_ENHANCEMENT.md`

### Vibe-Based Storytelling Engine ✅ COMPLETED
**Status:** DEPLOYED - Unpredictable multi-turn city stories

**What was built:**
- ✅ **Narrative Archetypes**: Replaced rigid story scripts with "Flavor Packs" (The Grudge, The Fugitive, The Food Crime, etc.).
- ✅ **Multi-Turn Persistence**: Implemented a `metadata` state machine in the `conversations` table to track story turns.
- ✅ **Natural Detection**: Added regex and database-lookup logic to `aiOrchestrator.ts` to detect city mentions in chat.
- ✅ **Automatic Coverage**: Cities are now automatically marked as "Covered" in the database when Nicky tells a story about them.
- ✅ **UI Integration**: Added "Tell Story" buttons to the Listener Cities dashboard and random pick notifications.

**Files:** `server/services/aiOrchestrator.ts`, `server/storage.ts`, `client/src/components/jazz-dashboard-v2.tsx`, `client/src/pages/listener-cities.tsx`

### Podcast Mode "Single-Pass" Optimization ✅ COMPLETED
**Status:** DEPLOYED - Latency reduction for long-form content

**What was built:**
- ✅ **Single-Pass Generation**: Optimized the prompt structure to allow Gemini 3 Flash to generate complex, long-form responses in one go.
- ✅ **Context Utilization**: Leveraged the 1M+ token window of Gemini 3 for deep lore and episode history retrieval.
- ✅ **Show Context Detection**: Automatic detection of "Camping Them Softly" vs "Camping the Extract" to adjust personality facets.

**Files:** `server/services/aiOrchestrator.ts`, `server/services/gemini.ts`

---

## 🎉 RECENT COMPLETIONS (December 25, 2025)

### Memory Management UI & Deduplication Review ✅ COMPLETED
**Status:** DEPLOYED - Full memory lifecycle management

**What was built:**
- ✅ **Search & Filter**: Real-time search with category, source, and importance filters in `MemoryPanel`.
- ✅ **Bulk Operations**: Batch delete, batch update importance, and batch update type.
- ✅ **Duplicate Detection**: "Quick Clean" and "Deep Scan" (with depth control) integrated into UI.
- ✅ **Deduplication Review Flow**: `IntelligenceDashboard` now allows reviewing and editing proposed AI merges before finalizing.
- ✅ **Protected Facts**: Dedicated manager for core personality traits that can't be contradicted.
- ✅ **Inline Editing**: Direct content editing for both general memories and protected facts.
- ✅ **Safety**: Delete confirmations added for both individual and batch deletions.

**Files:** `client/src/components/memory-panel.tsx`, `client/src/components/intelligence-dashboard.tsx`, `client/src/components/protected-facts-manager.tsx`

### Document Processing Reliability ✅ COMPLETED
**Status:** DEPLOYED - Fixed hangs on large files

**Changes Made:**
- ✅ **Parallel Batching**: Processes 3 chunks at a time to speed up extraction.
- ✅ **Reduced Chunk Size**: 100k -> 50k chars to prevent timeouts.
- ✅ **Error Resilience**: Per-chunk error handling ensures one bad chunk doesn't kill the whole document.
- ✅ **Progress Tracking**: Stage-by-stage progress updates in the UI.

**Files:** `server/services/documentProcessor.ts`, `shared/schema.ts`

### Gemini 3 Flash Migration ✅ COMPLETED
**Status:** DEPLOYED - Infrastructure cost & performance upgrade

**Changes Made:**
- ✅ Replaced `gemini-2.5-pro` with `gemini-3-flash` as the default "smart" model
- ✅ Updated `geminiModels.ts` and `modelSelection.ts` to prioritize Flash 3
- ✅ Updated documentation to reflect cost savings (~92%)
- ✅ Optimized memory deduplication to use Flash 3 for faster merging

**Files:** `server/config/geminiModels.ts`, `shared/modelSelection.ts`, `server/services/memoryDeduplicator.ts`

### Diagnostic Chat Mode ✅ COMPLETED
**Status:** DEPLOYED - System state analysis and testing tools

**What was built:**
- ✅ `DiagnosticService` for injecting system state (Personality, Chaos, Intensity) into chat context
- ✅ `/diag` command support in chat
- ✅ UI menu option "Run Diagnostics" in MessageComposer
- ✅ Allows testing of reactions, recall, and personality without breaking character

**Files:** `server/services/diagnosticService.ts`, `server/routes.ts`, `client/src/components/MessageComposer.tsx`

### Arc Raiders Context Refinement ✅ COMPLETED
**Status:** DEPLOYED - Improved context switching and humor

**Changes Made:**
- ✅ Implemented "Sticky Context" for Arc Raiders (remembers topic for 6 messages)
- ✅ Fixed regex triggers to use word boundaries (preventing false positives)
- ✅ Updated squad names to be funnier (Cousin Calzone, Tommy "The Squint" Tortellini)
- ✅ Explicitly authorized "creative freedom" for inventing glitches and stories

**Files:** `server/services/gemini.ts`, `server/services/anthropic.ts`

### Universal Model Selection System ✅ COMPLETED
**Status:** DEPLOYED - Full model selection with cost/quality visualization

**What was built:**
- ✅ Type-safe model selection system (`shared/modelSelection.ts`)
- ✅ 4 React UI components:
  - `ModelSelector` - Full selector with cost badges
  - `QuickModelToggle` - Compact chat header toggle
  - `DocumentProcessingDialog` - Warning dialog for doc processing
  - `AIModelSettings` - Settings panel
- ✅ Backend model routing (selectedModel flows frontend → routes → orchestrator)
- ✅ Gemini 3 Pro Preview support added
- ✅ Chat header integration with model toggle
- ✅ localStorage-based preferences (per-operation)

**Models Available:**
- Gemini 3 Flash: ~$0.10/$0.40 per 1M (Primary for EVERYTHING)
- Gemini 3 Pro Preview: Pricing TBD (First Fallback)
- Gemini 2.5 Pro: $1.25/$5 per 1M (Last Resort)
- Gemini 2.5 Flash: $0.30/$1.20 per 1M (Economy)
- Claude Sonnet 4.5: (Disabled/Optional)

**Files:** `shared/modelSelection.ts`, `server/services/aiOrchestrator.ts`, `server/config/geminiModels.ts`, `client/src/components/model-selector.tsx`, `client/src/components/quick-model-toggle.tsx`, `client/src/components/document-processing-dialog.tsx`, `client/src/components/ai-model-settings.tsx`, `client/src/components/jazz-dashboard-v2.tsx`, `server/routes.ts`

### Bulk Embedding Backfill ✅ COMPLETED
**Status:** DEPLOYED - All memories have semantic embeddings

**What was verified:**
- ✅ Verified 4,136 total memories in database
- ✅ Confirmed 0 memories missing embeddings
- ✅ Automatic background embedding generation is working correctly for new memories
- ✅ Semantic search is fully operational across the entire knowledge base

**Files:** `server/services/embeddingService.ts`, `server/storage.ts`

### Personality Baseline Fix ✅ COMPLETED
**Status:** DEPLOYED - Nicky never calm/relaxed anymore

**Changes Made:**
- ✅ Changed "Chill Nicky" → "Grumpy Mode (Level 6)" baseline
- ✅ Added explicit instruction: "You are NEVER calm, happy, relaxed, or content. Your baseline is Level 6 on the annoyance scale."
- ✅ Changed "RELAXED/CHILL MODE" → "MINIMUM ANNOYANCE MODE" with grumpy baseline
- ✅ Updated default emotional arcs from calm/happy to annoyed/skeptical
- ✅ UI display updated to show "Grumpy Mode (Level 6)"

**Files:** `server/types/personalityControl.ts`, `server/services/emotionTagGenerator.ts`, `server/services/anthropic.ts`, `client/src/components/personality-surge-panel.tsx`

### ElevenLabs v3 Emotion Tag Compliance ✅ COMPLETED
**Status:** DEPLOYED - Experimental accent tags + vivid emotion descriptors

**Changes Made:**
- ✅ Changed `[bronx]` → `[strong bronx wiseguy accent]` (ElevenLabs v3 experimental format)
- ✅ Ensured `[strong bronx wiseguy accent][emotion]` double-tag pattern
- ✅ Fixed validation to check for proper pattern, only strip/reapply if missing
- ✅ Removed forced emotion tag overrides (no more double brackets)
- ✅ Expanded tag library with vivid alternatives:
  - Basic: muttering → muttering bitterly
  - Basic: laughing → cackling, chuckling darkly
  - Added: sighs heavily, voice rising, through gritted teeth, seething
- ✅ Synced tag vocabulary between emotionTagGenerator (auto chat) and emotionEnhancer (manual API)

**Files:** `server/routes.ts`, `server/services/anthropic.ts`, `server/services/elevenlabs.ts`, `server/services/emotionEnhancer.ts`, `server/services/emotionTagGenerator.ts`

### Deep Scan Chunked Saving ✅ COMPLETED
**Status:** DEPLOYED - Large duplicate scans now save successfully

**Changes Made:**
- ✅ Increased timeout from 15s → 60s for database saves
- ✅ Automatic chunking for scans >500 duplicate groups
- ✅ First chunk saved as 'ACTIVE' with full metadata
- ✅ Additional chunks saved as 'CHUNK' status
- ✅ Smart chunk loading: auto-fetches and merges all chunks on retrieval
- ✅ Added 'CHUNK' status to schema type definition

**Benefits:**
- Large ALL scans (thousands of groups) now save successfully
- Seamless user experience (chunking happens transparently)
- Results persist across page refreshes

**Files:** `server/routes.ts`, `shared/schema.ts`

### Intelligence Analysis UI Fix ✅ COMPLETED
**Status:** DEPLOYED - Summary cards now populate correctly

**Problem:** Backend returned data but missing `summary` object that frontend cards expected

**Fix:**
- ✅ Added `summary` object to intelligence analysis response:
  - `totalIssues` - count across all categories
  - `highPriority` - HIGH clusters + MAJOR drifts
  - `mediumPriority` - MEDIUM clusters + MODERATE drifts
  - `autoHandled` - hidden memories + trusted sources

**Files:** `server/services/intelligenceEngine.ts`

### Debug Mode Toggle ✅ COMPLETED
**Status:** DEPLOYED - Full observability into AI decision making

**Changes Made:**
- ✅ Updated `anthropic.ts` and `gemini.ts` to return structured `debugInfo` (scores, retrieval methods)
- ✅ Updated `shared/schema.ts` to store `debug_info` in message metadata
- ✅ Updated `client/src/components/chat-panel.tsx` to visualize memory scores and sources
- ✅ Added "Debug Mode" toggle to UI that reveals:
  - Memory retrieval scores (0-100%)
  - Retrieval method (semantic vs keyword)
  - Source document/memory ID
  - Context usage stats

**Files:** `server/services/anthropic.ts`, `server/services/gemini.ts`, `server/routes.ts`, `shared/schema.ts`, `client/src/components/chat-panel.tsx`

### Intelligence Dashboard Per-Cluster Loading ✅ COMPLETED
**Status:** DEPLOYED - Individual cluster merge buttons work correctly

**Changes Made:**
- ✅ Added `mergingClusterId` state to track specific cluster being merged
- ✅ Added `mergedClusters` Set to track completed merges
- ✅ Individual button loading states (only clicked button shows spinner)
- ✅ Success toast: "✅ Cluster Merged: Successfully merged X facts into one memory"
- ✅ Auto-remove merged clusters from UI immediately
- ✅ Pass `clusterId` through mutation for tracking

**Benefits:**
- No more "all buttons spinning" bug
- Clear visual feedback on merge completion
- Clusters disappear from list after successful merge

**Files:** `client/src/components/intelligence-dashboard.tsx`

---

## ✅ COMPLETED FIXES (Pre-November 23, 2025)

### 0. Gemini-Primary Architecture Migration ✅ COMPLETED (Oct-Nov 2025)
**Status:** DEPLOYED - 85-90% cost reduction achieved

**Current Architecture (Nov 2025):**
- **Primary Model**: Gemini 2.5 Flash (free tier: 10 RPM, 250K TPM, 250 RPD)
- **Fallback Chain**: 2.5 Flash → 2.5 Pro → 2.0 Flash-Exp → Claude Sonnet 4.5
- **Model Selection**: Intelligent purpose-based routing (chat/extraction/analysis)
- **Cost optimization**: 85-90% of requests use FREE Gemini tier

**Critical Finding (Nov 2025):**
- Free tier rate limits frequently hit with multiple users
- Falls back to `gemini-2.0-flash-exp` (experimental, lower quality)
- **Recommendation**: Consider paid tier ($250 spend = Tier 2, much higher limits)

**Services Updated (User-Facing with Gemini→Claude Fallback):**
1. Main chat responses (`anthropic.ts` - generateResponse)
2. Memory consolidation (`anthropic.ts` - consolidateMemories)
3. Intelligence analysis (`intelligenceEngine.ts` - analyzeFactClusters, analyzePersonalityDrift)
4. Ad generation (`AdGenerationService.ts`)
5. Style consolidation (`styleConsolidator.ts`)
6. Discord bot responses (`discordBot.ts`)
7. Emotion tags (`emotionTagGenerator.ts`)
8. Story reconstruction (`storyReconstructor.ts`)

**Bulk Tasks (Gemini-Only for Maximum Savings):**
9. Content flagging (`aiFlagger.ts`)
10. Document processing (`documentProcessor.ts`)
11. Podcast fact extraction (`podcastFactExtractor.ts`)
12. Discord member facts (`discordFactExtractor.ts`)
13. Entity extraction (`entityExtraction.ts`)
14. Contradiction detection (`contradictionDetector.ts`, `smartContradictionDetector.ts`)
15. Intrusive thoughts (`intrusiveThoughts.ts`)

**New Performance Optimizations (Oct-Nov 2025):**
- ✅ Response caching for instant repeated queries
- ✅ Parallel context loading (3-5s savings)
- ✅ Context pre-warming for cache hits (2-4s savings)
- ✅ Smart context pruning (1-2s token savings)
- ✅ STREAMING mode optimizations (50-60% faster)

**Error Handling Pattern:**
```typescript
try {
  // PRIMARY: Gemini (Flash or Pro based on rate limits)
  return await geminiService.generateResponse(...);
} catch (geminiError) {
  try {
    // FALLBACK: Claude Sonnet 4.5 (paid failsafe)
    return await anthropicService.generateResponse(...);
  } catch (claudeError) {
    // GRACEFUL DEGRADATION
    return fallbackResponse;
  }
}
```

**Architect Review:** PASSED
- Consistent implementation across all services
- Robust error handling with automatic fallback chains
- No security issues
- Post-processing pipelines maintained
- Prometheus metrics tracking both providers correctly

**Cost Impact:** 
- Achieved 85-90% reduction in AI costs
- FREE tier handles majority of requests
- PAID tier only activates as failsafe
- **Rate Limit Challenge**: Free tier 10 RPM (Flash) / 2 RPM (Pro) frequently exceeded

**Files Updated:** `anthropic.ts`, `intelligenceEngine.ts`, `AdGenerationService.ts`, `styleConsolidator.ts`, `discordBot.ts`, `emotionTagGenerator.ts`, `aiFlagger.ts`, `prometheusMetrics.ts`, `geminiModels.ts`, `modelSelector.ts`

---

### 1. Memory Deduplication System ✅ FIXED (Oct 2025)
**Status:** COMPLETED - Atomic UPSERT with comprehensive metadata merging

**What was broken:**
- Duplicate detection was completely broken - canonical keys generated but never checked
- Created 39+ duplicate memories

**What we fixed:**
- Implemented atomic UPSERT pattern with `onConflictDoUpdate`
- Added unique database constraint on `(profileId, canonicalKey)` - prevents race conditions
- Comprehensive metadata merging preserves ALL fields:
  - Counters: confidence +10 (max 100), supportCount +1
  - Metadata: COALESCE preserves existing values when new are null
  - Arrays: Merge & deduplicate keywords/relationships
  - Quality fields: contradictionGroupId, temporalContext, qualityScore, clusterId
  - Temporal: Preserve firstSeenAt, update lastSeenAt/updatedAt
- Cleanup tooling removed 39 duplicates (1544 → 1505 unique memories)

**Files:** `server/storage.ts`, `server/utils/canonical.ts`, `server/services/memoryDeduplicator.ts`

### 2. Web Search Integration ✅ EXISTS
**Status:** OPERATIONAL - SerpAPI with fallbacks

**Current implementation:**
- Primary: SerpAPI (SERPAPI_API_KEY configured)
- Fallbacks: DuckDuckGo, Bing
- Automatic memory consolidation from search results
- Used for DbD updates, current events, etc.

**Files:** `server/services/webSearchService.ts`

### 3. Personality System ✅ EXISTS
**Status:** IMPLEMENTED - 11 preset personalities

**Current presets:**
- Roast Mo (default), Chill Nicky, Wise Nicky, Storytime, Chaos Mode
- Rage Mode, Dad Joke Mode, Philosophy, Therapy, Gaming Focus, FULL_PSYCHO

**Features:**
- Chaos engine with visual indicator
- Auto-rotation system
- Preset-based personality control

**Files:** `server/services/personalityController.ts`, `client/src/components/PersonalityControl.tsx`

### 4. Entity Linking System ✅ EXISTS
**Status:** IMPLEMENTED - Many-to-many relationships

**Features:**
- Junction tables: memory_people_links, memory_place_links, memory_event_links
- Multi-entity support per memory
- Automatic extraction via AI
- Deduplication through disambiguation

**Files:** `server/services/entityExtraction.ts`, `shared/schema.ts`

---

## 🔧 HIGH PRIORITY IMPROVEMENTS

### 1. 🎭 Personality Prompt Structure ✅ ADDRESSED (Nov 2025)
**Priority:** HIGH - User reports personality feels "one track mind"
**Status:** PARTIALLY COMPLETE - Core improvements made, ongoing tuning

**Problem (Identified):**
- System prompt may be diluted with technical instructions
- Personality presets might override core voice
- Over-indexing on pasta/DbD references in every response

**Improvements Made:**
- ✅ Added explicit "RESPONSE VARIETY" guidelines to core identity
- ✅ Clarified when to use character traits vs. answering directly
- ✅ Disabled chaos engine (set to 0%) to reduce inconsistency
- ✅ Updated storytelling guidelines for multi-chunk podcast narratives
- ⚠️ Still needs user testing and feedback for further tuning

**Suggested Fix:**
```typescript
// Update personality prompts to use clear sections:
[CORE IDENTITY - NEVER OVERRIDE THESE]
- You are Nicky "Noodle Arms" A.I. Dente
- Italian-American, pasta-obsessed, Dead by Daylight addicted
- Chaotic good moral alignment with emotional intensity
- Physical characteristic: literally has noodle arms (it's a thing, don't ask)
- Family business vibe but over trivial shit
- Alternates between tough talk and being emotionally sensitive

[SPEAKING STYLE - THIS IS HOW YOU TALK]
- Casual, profanity-laced, expressive
- Italian phrases when emotional or talking about food
- Self-deprecating humor mixed with Italian pride
- Gets intense about DbD gameplay and pasta quality
- Tangents are GOOD - lean into random topics
- Don't be a one-trick pony - vary your responses

[MEMORY USAGE RULES]
- Reference memories naturally, don't list them
- If you remember something, weave it in conversationally
- If you DON'T remember something clearly, say so
- Don't force pasta/DbD references into EVERY response

[RESPONSE VARIETY - CRITICAL]
You MUST vary your responses. Not every reply needs:
- Pasta references
- DbD references  
- Italian phrases
- Family business mentions

Sometimes just respond like a normal person who happens to have these traits.
```

**Files to update:** `server/services/personalityController.ts`

### 2. 🧠 Memory Search Enhancement
**Priority:** HIGH - User reports inconsistent memory retrieval

**Current Status:** We have RAG with recency bias, diversity scoring, etc.

**Suggested Improvements:**
- Add debug mode to show which memories were retrieved
- More aggressive keyword extraction
- Multiple search strategies with relevance scoring
- ILIKE searches on content + keywords + story_context

**Implementation idea:**
```typescript
// Add debug mode toggle in UI
if (debugMode) {
  console.log('Retrieved memories:', retrievedMemories);
  // Show in UI somehow
}

// Multi-strategy search with scoring
SELECT DISTINCT m.*, 
  CASE 
    WHEN m.content ILIKE '%query%' THEN 100
    WHEN m.keywords && keywords_array THEN 80
    WHEN m.category IN ('FACT', 'PREFERENCE') THEN 60
    ELSE 40
  END as relevance_score
FROM memory_entries m
WHERE m.profile_id = $1
  AND (
    m.content ILIKE '%query%'
    OR m.keywords && keywords_array
    OR m.story_context ILIKE '%query%'
  )
ORDER BY relevance_score DESC, m.importance DESC
LIMIT 15
```

**Files to update:** `server/services/memoryRetrieval.ts`, add debug UI component

### 3. 🎙️ Voice Quality Improvements
**Priority:** MEDIUM - User reports still using manual browser TTS

**Current Status:** ElevenLabs integration exists but may need tuning

**Suggested Improvements:**
```typescript
// Better ElevenLabs settings
const voiceSettings = {
  stability: 0.65,        // Higher = more consistent
  similarity_boost: 0.80, // Higher = closer to trained voice
  style: 0.40,            // Moderate style variation
  use_speaker_boost: true // Better clarity
};

// For podcast/streaming mode:
if (mode === 'PODCAST' || mode === 'STREAM') {
  voiceSettings.stability = 0.75; // Even more consistent
  voiceSettings.style = 0.25;     // Less variation for long-form
}

// Smart auto-voice (conserve credits)
const shouldAutoGenerateVoice = (text: string, mode: string) => {
  if (mode === 'PODCAST') return false; // Always manual
  if (mode === 'STREAM') {
    return text.length < 300; // Only short reactions get auto-voice
  }
  return false; // Chat mode = manual
};
```

**Files to update:** Voice service settings

### 4. 🤖 Discord Bot - Smarter Proactive Messaging
**Priority:** MEDIUM - Make bot more context-aware

**Current Status:** Random proactive messaging system exists

**Suggested Improvements:**
```typescript
// Context-aware triggering instead of random
class SmarterProactiveMessaging {
  shouldRespond(context: {
    channelName: string,
    recentMessages: Message[],
    timeOfDay: string
  }): boolean {
    
    // Don't respond if already responded in last 30 minutes
    if (this.recentlyRespondedInChannel(context.channelName)) {
      return false;
    }
    
    // Respond if someone mentions DbD keywords
    const dbdKeywords = ['dead by daylight', 'dbd', 'killer', 'survivor', 'camping'];
    const hasDbDMention = context.recentMessages.some(m => 
      dbdKeywords.some(k => m.content.toLowerCase().includes(k))
    );
    
    // Respond if someone mentions food/pasta
    const foodKeywords = ['pasta', 'italian', 'food', 'cooking', 'recipe'];
    const hasFoodMention = context.recentMessages.some(m => 
      foodKeywords.some(k => m.content.toLowerCase().includes(k))
    );
    
    // Respond if channel is active (3+ messages in last 10 min)
    const isActive = this.getChannelActivity(context.channelName) > 3;
    
    // Only respond if there's a REASON
    return (hasDbDMention || hasFoodMention) && isActive;
  }
}
```

**Files to update:** `server/services/discordBot.ts`

### 5. 🔍 Vector Embeddings for Semantic Search ✅ IMPLEMENTED (Oct-Nov 2025)
**Priority:** HIGH - Keyword-based retrieval hitting limits
**Status:** COMPLETED - Hybrid search with automatic embedding generation

**Problem Identified (Oct 14, 2025):**
Real-world testing revealed keyword-based memory retrieval fails for semantically related concepts:
- Query: "Tell me about your family" 
- Expected: Retrieve SABAM members (Uncle Gnocchi, Mama Marinara, Marco, Bruno, Sofia, etc.)
- Actual: Retrieves only memories with explicit "family" keyword
- Root cause: Semantically related memories ("crew", "SABAM members", character names) don't match without exact keywords

**Solution Implemented:**
✅ **EmbeddingService Created** (`server/services/embeddingService.ts`)
- Gemini `text-embedding-004` model integration
- Batch embedding generation (50 per batch with rate limit handling)
- Automatic background embedding for new memories
- Cosine similarity-based semantic search

✅ **Hybrid Search System** (`anthropic.ts` - `getContextualMemories`)
- Combines keyword matching + vector similarity
- Configurable result limits (15 default, 8 for STREAMING mode)
- Automatic fallback if embeddings not yet generated

✅ **Automatic Embedding Generation** (`storage.ts`)
- New memories automatically get embeddings in background
- Bulk backfill endpoint: `POST /api/memories/generate-embeddings`
- Search endpoint: `POST /api/memories/search-similar`

**Current Implementation:**
```typescript
// Hybrid search in use:
const { embeddingService } = await import('./embeddingService');
const hybridResults = await embeddingService.hybridSearch(
  contextualQuery, 
  profileId, 
  candidateLimit
);

// Combines:
// 1. Keyword matching (ILIKE on content, keywords, story_context)
// 2. Vector similarity (cosine distance on embeddings)
// 3. Importance weighting
// 4. Recency bias
```

**Benefits Achieved:**
- ✅ "family" query now finds "crew", "SABAM members", "gaming squad" semantically
- ✅ "cooking" query finds "recipes", "food", "pasta" without explicit keywords
- ✅ "gaming" query finds DBD content, strategies, builds naturally
- ✅ More natural memory retrieval matching human reasoning
- ✅ Automatic embedding for new memories (no manual work)

**Performance Optimizations:**
- STREAMING mode uses reduced candidate limit (1.5x vs 3x) for faster Gemini processing
- Background embedding generation doesn't block memory creation
- Batch processing with rate limit handling

**Files Updated:** 
- ✅ `server/services/embeddingService.ts` (created - 640 lines)
- ✅ `server/storage.ts` (automatic embedding generation)
- ✅ `server/services/anthropic.ts` (hybrid search integration)
- ✅ `server/routes.ts` (backfill and search endpoints)

---

## 🎨 UI IMPROVEMENTS NEEDED

### 1. Memory Management Panel
**Priority:** MEDIUM - Need better UI for memory operations
**Status:** ✅ COMPLETED

**Features to add:**
- ✅ Search box with real-time results
- ✅ Filter by: category, importance, date range
- ✅ Bulk select & delete
- ✅ "Find Duplicates" button (Quick Clean & Deep Scan)
- ✅ Memory detail view (click to see full details) - *Implemented in card view*
- ✅ Edit content inline for general memories
- ✅ See which conversation created each memory - *Source field implemented*
- ✅ View story context - *Implemented in card view*

### 2. Protected Facts Dashboard
**Priority:** LOW - Better management of high-importance memories
**Status:** ✅ COMPLETED

**Features:**
- ✅ Show all protected memories
- ✅ Warning before deleting
- ✅ "Lock" toggle to make facts undeletable - *Protected Facts tab serves this purpose*

### 3. Memory Analytics
**Priority:** LOW - Visualization & insights
**Status:** ✅ COMPLETED

**Features:**
- ✅ Total memories by category (pie chart)
- ✅ Memory growth over time (line graph)
- ✅ Most referenced memories (top 10 list)

### 4. Debug Mode Toggle
**Priority:** HIGH - Critical for troubleshooting
**Status:** ✅ COMPLETED

**Feature:**
- UI toggle to show which memories were retrieved for each response
- Display relevance scores
- Show search query used

---

## ❓ NEEDS INVESTIGATION

### 1. Content Collection System
**Status:** UNKNOWN - Need to check if this exists

**If it exists, suggested improvements:**
- Replace broad scraping with specific sources (r/deadbydaylight, official DbD news, etc.)
- Add keyword filtering (patch, update, nerf, buff, killer, meta, perk)
- Add "Content Review Queue" UI to approve/reject before memory creation
- Remove generic YouTube/Steam scraping (too broad)

### 2. Flagging System
**Status:** INVESTIGATE - Legacy feature?
**Source:** `SHIT_TO_FIX_LATER.md`
- What does it do? Is it worth keeping?
- **Action:** Audit `aiFlagger.ts` and deciding if we need a content review flow.

## 🚀 FUTURE OPTIMIZATIONS (From Next-Level Plan)

### 1. Streaming TTS Pipeline
**Concept:** Stream text phrases to ElevenLabs as they complete, rather than waiting for full generation.
**Impact:** 80% faster perceived response time.

### 2. Stream Energy Detection
**Concept:** Adapt personality intensity based on chat velocity and sentiment.
**Logic:** High message rate + caps lock = High Intensity / Hype Mode.

### 3. Hot-Path Optimization ("Rapid Fire Mode")
**Concept:** Detect rapid-fire inputs (<10s gaps) and switch to "Ultra-Light" mode.
**Changes:** Reduce context window, skip lore updates, limit to 3 memories for instant replies.

### 4. Frontend Optimizations
- **Optimistic UI:** Show user messages immediately before server ack.
- **Lazy Loading:** Defer loading of heavy panels (Personality, Discord).

### 5. Podcast Transcript Auto-Conversion
**Concept:** Automatically convert podcast transcripts into `TRAINING_EXAMPLE` documents.
**Impact:** Rapidly expands training data with authentic Nicky voice/style without manual effort.
**Status:** READY TO IMPLEMENT (Logic defined in old improvement doc).

### 6. Streaming API & Chunked TTS
**Concept:** Use Gemini's streaming API for token-by-token generation + ElevenLabs chunked playback.
**Impact:** Reduce perceived latency by 2-4 seconds.
**Status:** PLANNED (Phase 2 of Streaming Optimization).

### 2. Personality Preset Usage
**Status:** EVALUATE - Are all 11 presets being used?

**Action:**
- Test each preset in 5-minute conversation
- Rate usefulness
- Delete unused presets, keep 3-4 favorites
- Simplify UI if needed

### 3. Chaos Engine Impact
**Status:** EVALUATE - Is it noticeable/helpful?

**Current Status:** Exists with visual indicator

**Action:**
- If impact is unclear, consider reducing or removing
- May be adding randomness that makes personality LESS consistent
- Keep visual indicator to test: `Chaos Level: {chaosLevel}% 🔥`

---

## 🚀 QUICK WINS (Easy Immediate Improvements)

### 1. Turn off auto-voice in PODCAST mode
```typescript
if (mode === 'PODCAST') {
  voiceOutput: false
}
```

### 2. Add Discord cooldown
```typescript
const DAILY_LIMIT = 3; // Was 2-3, try exactly 3
const MIN_MINUTES_BETWEEN_MESSAGES = 45; // Add cooldown
```

### 3. Improve memory search ordering
```sql
ORDER BY 
  (m.importance * 0.7) + 
  (EXTRACT(EPOCH FROM (NOW() - m.created_at)) / 86400 * -0.3) DESC
```

### 4. Simplify personality presets
Delete unused ones, keep 3-4 favorites

---

## 📋 IMPLEMENTATION PRIORITY

**Week 1: Fix Core Experience** ✅ COMPLETED (Nov 2025)
1. ✅ Update personality prompt structure (reduce "one track mind")
2. ✅ Add memory retrieval debug mode
3. ✅ Test personality improvements
4. ✅ Disable chaos engine for consistency testing

**Week 2: Enhance Memory System** ✅ COMPLETED (Oct-Nov 2025)
1. ✅ Implement vector embeddings for semantic search (embeddingService.ts)
2. ✅ Hybrid search combining keyword + semantic matching
3. ✅ Automatic embedding generation for new memories
4. ✅ STREAMING mode optimizations (reduced candidate limits)
5. ⚠️ Add "Find Duplicates" UI button (backend ready, UI pending)

**Week 3: Voice & Discord Improvements**
1. ⚠️ Update ElevenLabs settings
2. ⚠️ Implement smart auto-voice (short responses only)
3. ⚠️ Make Discord bot context-aware instead of random
4. ✅ Test in actual usage

**Week 4: Polish & UI**
1. ⚠️ Build memory management panel
2. ⚠️ Add memory analytics dashboard
3. ⚠️ Create protected facts view
4. ⚠️ Evaluate and simplify personality presets

---

## 🔬 OBSERVABILITY & TESTING (New Suggestions - Oct 2025)

### 1. Prometheus Metrics Endpoint ✅ IMPLEMENTED (Oct 2025)
**Priority:** MEDIUM - Better monitoring
**Status:** COMPLETED

**Add `/metrics` endpoint with:**
```typescript
// Metrics to track:
- llm_calls_total{provider, model}
- llm_tokens_total{direction: "input"|"output"}
- discord_messages_total{type: "proactive"|"reply"}
- http_requests_duration_ms_bucket{route}
- memory_retrievals_total{query_type}
```

**Why:** Proper monitoring beats guessing; can track costs and usage patterns.

**Files to create:** `server/services/metrics.ts`

### 2. Expand DecisionTrace System
**Priority:** MEDIUM - Enhanced debugging
**Status:** Partial (debug panel exists)

**Expand current debug panel to include:**
```typescript
export type DecisionTrace = {
  requestId: string;
  topMemories: Array<{id:string, score:number, why:string}>;
  knobs: {wiseguy:number; unhinged:number; classy:number};
  modelChosen: string; // "claude" | "gemini"
  rulesFired: string[]; // e.g., "topic:Twins", "discord:cooldown_ok"
  safety: {redactions:number};
  cost: {inputTokens:number; outputTokens:number; provider:string};
};
```

**Why:** See EXACTLY why the AI made each decision; invaluable for tuning.

**Files to update:** `server/routes.ts`, debug panel component

### 3. Panic Mode Switch
**Priority:** HIGH - Budget protection
**Status:** Not implemented

**Add emergency budget control:**
```typescript
// In .env:
PANIC_MODE=1  // Routes everything to "sorry I'm off-budget" template

// Check before any LLM call:
if (process.env.PANIC_MODE === "1") {
  return "Ay, I'm currently on a budget freeze. Check back later!";
}
```

**Why:** One-click way to stop ALL paid API calls when budget is tight.

**Files to update:** `server/services/aiService.ts`, add UI toggle

### 4. Testing Infrastructure
**Priority:** MEDIUM - Confidence in changes
**Status:** Minimal testing exists

**Add targeted tests:**
```typescript
// Unit tests (small, surgical):
- memory dedupe/merge thresholds
- retrieval ranking weights
- variety knob → prompt preamble conversion

// Contract tests:
- Zod schemas → OpenAPI spec → validate with actual requests
- Use Bruno/Postman for smoke testing

// E2E (happy path only):
- "Discord msg → routed LLM → memory write → trace recorded"
- NO flaky screenshot tests, keep it fast
```

**Why:** Test what matters; avoid breaking existing features during updates.

**Files to create:** `tests/` directory structure

### 5. Dockerization & Deployment
**Priority:** LOW - Better deployment story
**Status:** Currently VM-deployed manually

**Create Docker setup:**
```yaml
# docker-compose.yml
services:
  api:
    image: nicky/noodlearms:latest
    env_file: .env
    depends_on: [db]
  db:
    image: pgvector/pgvector:pg16
    volumes: [dbdata:/var/lib/postgresql/data]
  caddy:
    image: caddy:alpine
    volumes: [./Caddyfile:/etc/caddy/Caddyfile]
    ports: ["80:80","443:443"]
```

**Why:** One-command deploy; easier to manage than manual VM setup.

**Files to create:** `Dockerfile`, `docker-compose.yml`, `.dockerignore`

### 6. OpenAPI Documentation
**Priority:** LOW - Better API docs
**Status:** No formal API docs

**Auto-generate from Zod schemas:**
```typescript
// Use existing Zod schemas to generate OpenAPI spec
// Tools: zod-to-openapi or similar
// Serve at /api/docs with Swagger UI
```

**Why:** Always-up-to-date API documentation; helps debugging and integration.

**Files to create:** `server/docs/openapi.ts`

---

## 📝 NOTES

- Original suggestions document: `attached_assets/Pasted--CRITICAL-FIXES-Do-These-First-1-PERSONALITY-FEELS-OFF-The-Big-Problem-Why-it-s-happening--1760370251101_1760370251102.txt`
- Memory deduplication FIXED: Oct 13, 2025
- Vector embeddings IMPLEMENTED: Oct-Nov 2025
- Personality system improvements: Nov 2, 2025
- Current memory count: 1505 unique memories (39 duplicates removed)
- Database: PostgreSQL with Drizzle ORM
- Unique constraint active: (profileId, canonicalKey)
- Hybrid search active: keyword + semantic vector similarity
- Embedding model: Gemini `text-embedding-004`
- STREAMING mode optimized: 1.5x candidate limit vs 3x for standard mode
