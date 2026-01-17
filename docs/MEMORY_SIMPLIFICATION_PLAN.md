# Memory System Simplification Plan

**Status:** ✅ PHASE 1-3 IMPLEMENTED (2026-01-17)
**Author:** Analysis of current system complexity
**Last Updated:** 2026-01-17

---

## Implementation Summary

### What Was Implemented (v1.8.0)

| Phase | Status | Description |
|-------|--------|-------------|
| **1. Memory Retrieval Fix** | ✅ DONE | Scoring formula, freshness boost, retrieval penalty, diversity |
| **2. Document Parsing** | ✅ DONE | Sentence-boundary chunking, overlap, expanded story context |
| **3. Entity Extraction** | ✅ DONE | Relational references, relationship field population |
| **4. Complexity Reduction** | ⏸️ DEFERRED | Consolidate Sauce/Chaos, simplify modulators (low priority) |

### Key Changes Made

1. **Scoring Formula** (`embeddingService.ts:476`):
   ```typescript
   // OLD: importance dominated (importance=80 added +8 points!)
   score = similarity + (importance × 0.1)

   // NEW: similarity-driven with gentle tiebreaker
   score = similarity + (importance × 0.005)  // importance=80 adds only +0.4
   ```

2. **Freshness & Retrieval Penalty** (`contextBuilder.ts`):
   ```typescript
   const freshnessBoost = retrievalCount < 5 ? 1.2 : 1.0;  // +20% for low retrieval
   const retrievalPenalty = Math.min(retrievalCount * 0.03, 0.30);  // 3% per retrieval, max 30%
   const baseScore = result.similarity * freshnessBoost * (1 - retrievalPenalty);
   ```

3. **Diversity Scoring** (`contextBuilder.ts`):
   - Max 2 memories from same source
   - 60%+ keyword overlap = reduced score
   - Topic clustering penalty

4. **Sentence-Boundary Chunking** (`documentProcessor.ts`):
   - Split on sentence boundaries with 500-char overlap
   - Chunk size: 4000 chars (was 2000)
   - Large documents: 8K chunks (was 50K)
   - Story context: 2000 chars (was 200)

5. **Relational Entity Extraction** (`entityExtraction.ts`):
   - Captures "his father" → "Nicky's Father"
   - Populates `relationship` field
   - Creates entity links

### Tests Added

- `server/tests/memory-scoring.test.ts` (25 tests)
- `server/tests/podcast-extraction.test.ts` (10 tests)
- `server/vitest.config.ts`

### Future Work (Phase 4 - Optional)

See "Proposal 3: Cache Embeddings" and "Proposal 4: Smart Query Routing" below for remaining optimizations that can be implemented if needed.

---

## Original Analysis (For Reference)

The sections below contain the original analysis and proposals. Phases 1-3 have been implemented as described above.

---

## Executive Summary (Original)

The current memory retrieval system uses **8 overlapping scoring mechanisms**, performs **7 database queries**, and takes **~710ms** before response generation. This plan proposes targeted simplifications that will:

- Reduce latency by 40-60% (~300-400ms saved)
- Eliminate unused database fields (4 fields)
- Simplify scoring from 8 mechanisms to 2-3
- Maintain or improve retrieval quality

Each proposal includes effort estimate, risk assessment, rollback strategy, and testing requirements.

---

## Current State Analysis

### Performance Breakdown (Per Message)
```
Step                          Time      API Calls    DB Queries
─────────────────────────────────────────────────────────────────
Extract keywords              10ms      0            0
Enhance keywords              50ms      0            1
Generate embedding           200ms      1 (Gemini)   0
Vector search                100ms      0            1
Keyword search                50ms      0            1
Fetch podcast memories        50ms      0            1
Search documents              50ms      0            1
Fetch lore                    50ms      0            1
Search training examples     100ms      0            1
Calculate relevance           10ms      0            0
Calculate diversity           10ms      0            0
Detect knowledge gaps         10ms      0            0
Prune context                 20ms      0            0
─────────────────────────────────────────────────────────────────
TOTAL                       ~710ms      1            7
```

### Complexity Issues
1. **8 scoring mechanisms** (semantic, keyword, importance × 3 uses, confidence × 3 uses, contextual relevance, diversity, retrieval count, success rate)
2. **Unused fields** (successRate, qualityScore, temporalContext)
3. **Over-weighted importance/confidence** (unrelated "important" facts leak through)
4. **No caching** (same queries regenerate embeddings)
5. **Parallel overkill** (7 simultaneous DB queries, some rarely useful)

---

## Proposal 1: Remove Unused Database Fields

### What Gets Removed
- `successRate` (column exists, never queried)
- `qualityScore` (column exists, never queried)
- `temporalContext` (stored but never used for scoring)

### Justification
These fields consume:
- **Storage:** 12 bytes per memory × 4,136 memories = ~49 KB (negligible)
- **Mental overhead:** Developers think these matter, they don't
- **Write time:** Every memory insert/update writes these fields pointlessly

Current code search shows:
```typescript
// successRate is set in multiple places:
storage.ts:2145: successRate: 50,
storage.ts:2347: successRate: memory.successRate || 50,

// But NEVER queried in WHERE/ORDER BY clauses
// grep "successRate" server/ shows 0 SELECT queries
```

### Implementation Steps

1. **Phase 1: Verify Unused (1 hour, LOW RISK)**
   ```bash
   # Search entire codebase for any usage
   grep -r "successRate" server/ client/
   grep -r "qualityScore" server/ client/
   grep -r "temporalContext" server/ client/
   ```

2. **Phase 2: Remove from TypeScript Types (30 min, LOW RISK)**
   ```typescript
   // In shared/schema.ts
   export const memoryEntries = pgTable('memory_entries', {
     // ... other fields ...
     // successRate: integer('success_rate').default(50), // REMOVE
     // qualityScore: integer('quality_score'), // REMOVE
     // temporalContext: text('temporal_context'), // REMOVE
   });
   ```

3. **Phase 3: Remove from Code (1 hour, LOW RISK)**
   - Remove all assignments to these fields
   - Remove from storage.ts insert/update statements
   - Remove from type definitions

4. **Phase 4: Database Migration (15 min, MEDIUM RISK)**
   ```sql
   -- Create migration: drop_unused_memory_fields.sql
   ALTER TABLE memory_entries DROP COLUMN IF EXISTS success_rate;
   ALTER TABLE memory_entries DROP COLUMN IF EXISTS quality_score;
   ALTER TABLE memory_entries DROP COLUMN IF EXISTS temporal_context;
   ```

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Field actually used somewhere | LOW | High | Full codebase grep before removal |
| Breaking existing memories | NONE | N/A | Columns just disappear, no data corruption |
| Rollback difficulty | LOW | Low | Re-add columns with defaults |

### Precautions

1. **Before touching anything:**
   ```bash
   # Full database backup
   pg_dump $DATABASE_URL > backups/pre_field_removal_$(date +%Y%m%d).sql
   ```

2. **Create rollback migration:**
   ```sql
   -- rollback_unused_fields.sql
   ALTER TABLE memory_entries ADD COLUMN success_rate INTEGER DEFAULT 50;
   ALTER TABLE memory_entries ADD COLUMN quality_score INTEGER;
   ALTER TABLE memory_entries ADD COLUMN temporal_context TEXT;
   ```

3. **Test on a sample query:**
   ```bash
   # Before migration: verify no queries break
   npm run dev
   # Send test message, check logs for errors
   ```

### Effort & Timeline
- **Effort:** 3-4 hours total
- **Risk:** LOW (can rollback easily)
- **Benefit:** Cleaner schema, less mental overhead

---

## Proposal 2: Simplify Scoring to 2-3 Mechanisms

### Current: 8 Mechanisms
```typescript
// 1. Semantic similarity (0-1.2)
semanticScore = similarity * 1.2

// 2. Keyword match (0.7 default)
keywordScore = 0.7

// 3. Importance contribution (used 3x!)
baseScore += importance * 0.1
contextualRelevance += (importance/100) * 0.25
vectorRanking = importance / (1 + retrievalCount/50)

// 4. Confidence contribution (used 3x!)
baseScore += confidence * 0.001
contextualRelevance += (confidence/100) * 0.1
HARD FILTER: confidence >= 60

// 5. Contextual relevance (0-1.0)
// Calculated from 5 sub-factors

// 6. Diversity score (0-1.0)
// Penalty multiplier

// 7. Retrieval count
// Only in vector ranking

// 8. Success rate
// NEVER USED

// Final score:
finalScore = baseScore * diversityScore + contextualRelevance * 0.3
```

### Proposed: 2-3 Mechanisms

#### Option A: Trust the Vector Search (RECOMMENDED)
```typescript
// Just use semantic similarity + confidence filter
const results = await vectorSearch(embedding, limit=15);
const filtered = results.filter(m => m.confidence >= 70);
return filtered.slice(0, 10);

// That's it. Done.
```

**Justification:**
- Vector embeddings already encode semantic relevance
- Gemini's embedding model is trained on billions of documents
- Adding keyword matches, importance, diversity just adds noise
- Confidence filter prevents low-quality memories

**Scoring formula:**
```
score = semantic_similarity  // That's it!
filter = confidence >= 70
```

#### Option B: Hybrid with Light Weighting
```typescript
// Semantic + keyword + light confidence boost
score = (semantic_similarity * 0.7) + (keyword_match_bonus * 0.3)

// Confidence as multiplier instead of hard filter
if (memory.confidence < 60) {
  score *= 0.5;  // Penalize low confidence
} else if (memory.confidence > 80) {
  score *= 1.1;  // Slight boost for high confidence
}
```

**Justification:**
- Keeps keyword matching for exact phrase queries
- Confidence affects ranking but doesn't eliminate memories
- Much simpler than current system

#### Option C: Keep Confidence Filter, Simplify Rest
```typescript
// Current confidence filter is good, just remove the other cruft
const hybridResults = await hybridSearch(query, limit=30);

// Simplified scoring
const scored = hybridResults.map(m => ({
  ...m,
  score: m.similarity + (m.keywordMatch ? 0.3 : 0)
}));

// Keep the confidence filter (it works!)
const filtered = scored.filter(m =>
  m.lane === 'CANON' && m.confidence >= 60
);

return filtered.sort((a, b) => b.score - a.score).slice(0, 10);
```

**Justification:**
- Confidence >= 60 filter is actually useful
- Removes: importance weighting, contextual relevance calculation, diversity scoring
- Keeps: semantic search, keyword matching, confidence filter

### Comparison Matrix

| Mechanism | Current Weight | Option A | Option B | Option C |
|-----------|---------------|----------|----------|----------|
| Semantic similarity | 1.2x boost | ✅ Only score | ✅ 0.7 weight | ✅ Direct use |
| Keyword match | 0.7 default | ❌ Removed | ✅ 0.3 weight | ✅ +0.3 bonus |
| Importance | Used 3x | ❌ Removed | ❌ Removed | ❌ Removed |
| Confidence | Used 3x + filter | ✅ Filter only | ✅ Multiplier | ✅ Filter only |
| Contextual relevance | 5 sub-factors | ❌ Removed | ❌ Removed | ❌ Removed |
| Diversity score | Penalty | ❌ Removed | ❌ Removed | ❌ Removed |
| Retrieval count | Vector rank | ❌ Removed | ❌ Removed | ❌ Removed |

**Recommendation:** **Option C** (Keep confidence filter, simplify rest)
- Lowest risk (confidence filter already works well)
- Removes the most complexity (5 mechanisms eliminated)
- Easy to A/B test against current system

### Implementation Steps

1. **Phase 1: Create New Simplified Function (2 hours, NO RISK)**
   ```typescript
   // In contextBuilder.ts
   public async retrieveMemoriesSimplified(
     userMessage: string,
     profileId: string,
     mode?: string,
     limit: number = 10
   ): Promise<MemoryEntry[]> {
     // Option C implementation
     const { keywords, contextualQuery } = await this.extractContextualKeywords(
       userMessage, undefined, undefined, mode
     );

     // Hybrid search (semantic + keyword)
     const hybridResults = await embeddingServiceInstance.hybridSearch(
       contextualQuery, profileId, limit * 3, 'CANON'
     );

     // Simplified scoring: just use similarity + keyword bonus
     const scored = hybridResults.combined.map(m => ({
       ...m,
       score: m.similarity + (m.retrievalMethod === 'keyword_enhanced' ? 0.3 : 0)
     }));

     // Keep confidence filter (it works!)
     const filtered = scored.filter(m =>
       m.lane === 'CANON' && (m.confidence || 50) >= 60
     );

     return filtered.sort((a, b) => b.score - a.score).slice(0, limit);
   }
   ```

2. **Phase 2: A/B Test (1 day, NO RISK)**
   ```typescript
   // Add a flag to test both systems side-by-side
   const USE_SIMPLIFIED_RETRIEVAL = process.env.SIMPLIFIED_RETRIEVAL === 'true';

   const memories = USE_SIMPLIFIED_RETRIEVAL
     ? await this.retrieveMemoriesSimplified(...)
     : await this.retrieveContextualMemories(...);

   // Log both results for comparison
   if (process.env.NODE_ENV === 'development') {
     const oldResults = await this.retrieveContextualMemories(...);
     const newResults = await this.retrieveMemoriesSimplified(...);
     console.log('Old:', oldResults.canon.map(m => m.content));
     console.log('New:', newResults.map(m => m.content));
   }
   ```

3. **Phase 3: User Testing (1-2 days, LOW RISK)**
   - Use Nicky for a full stream session with simplified retrieval
   - Check if responses feel less accurate
   - Compare specific queries: "what's my favorite pasta?", "tell me about Sal", etc.

4. **Phase 4: Cutover (1 hour, MEDIUM RISK)**
   - Replace old retrieval with new
   - Remove old scoring code
   - Clean up unused functions

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Retrieval quality degrades | MEDIUM | High | A/B testing phase, easy rollback |
| Important memories missed | LOW | Medium | Confidence filter still protects quality |
| User notices difference | MEDIUM | Low | You'll notice if Nicky is dumber |
| Performance regression | VERY LOW | Low | Simplified = faster |

### Precautions

1. **Before cutover:**
   ```bash
   # Full backup
   pg_dump $DATABASE_URL > backups/pre_scoring_simplification_$(date +%Y%m%d).sql

   # Tag current working state
   git tag v1.0-complex-scoring
   git push --tags
   ```

2. **Create performance benchmark:**
   ```typescript
   // In scripts/benchmark-retrieval.ts
   const queries = [
     "What's your favorite pasta?",
     "Tell me about Sal the butcher",
     "What happened in episode 68?"
   ];

   for (const query of queries) {
     const start = Date.now();
     const oldResults = await oldRetrieval(query);
     const oldTime = Date.now() - start;

     const start2 = Date.now();
     const newResults = await newRetrieval(query);
     const newTime = Date.now() - start2;

     console.log(`Query: "${query}"`);
     console.log(`Old: ${oldTime}ms, ${oldResults.length} results`);
     console.log(`New: ${newTime}ms, ${newResults.length} results`);
     console.log(`Speedup: ${((oldTime - newTime) / oldTime * 100).toFixed(1)}%`);
   }
   ```

3. **Keep old function as fallback:**
   ```typescript
   try {
     memories = await this.retrieveMemoriesSimplified(...);
   } catch (error) {
     console.error('Simplified retrieval failed, falling back:', error);
     memories = await this.retrieveContextualMemories(...);
   }
   ```

### Effort & Timeline
- **Effort:** 1-2 days (mostly testing)
- **Risk:** MEDIUM (retrieval quality might change)
- **Benefit:** Massive complexity reduction, easier debugging
- **Rollback:** Easy (keep old function, just switch back)

---

## Proposal 3: Cache Embeddings for Common Queries

### Current Problem
Every message generates a new embedding:
```typescript
// This happens on EVERY message (200ms + API cost)
const embedding = await generateEmbedding(userMessage);
const results = await vectorSearch(embedding);
```

You probably say the same things often:
- "What's your favorite pasta?"
- "Tell me a story"
- "What happened in episode X?"
- "How do you feel about Y?"

### Proposed Solution

```typescript
// In-memory LRU cache for embeddings
class EmbeddingCache {
  private cache = new Map<string, { embedding: number[], timestamp: number }>();
  private maxSize = 100;
  private ttl = 1000 * 60 * 60; // 1 hour

  async getOrGenerate(text: string): Promise<number[]> {
    const normalized = text.toLowerCase().trim();
    const cached = this.cache.get(normalized);

    // Return cached if fresh
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      console.log('✅ Embedding cache HIT:', text.substring(0, 50));
      return cached.embedding;
    }

    // Generate new embedding
    console.log('❌ Embedding cache MISS:', text.substring(0, 50));
    const embedding = await this.generateEmbedding(text);

    // Store in cache (LRU eviction)
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(normalized, { embedding, timestamp: Date.now() });
    return embedding;
  }
}
```

### Expected Impact

**Conservative estimate:** 30% cache hit rate
- 30% of queries skip 200ms embedding generation
- Average speedup: 60ms per message
- API cost reduction: 30%

**Optimistic estimate:** 60% cache hit rate (you repeat yourself during streams)
- 60% of queries skip embedding
- Average speedup: 120ms per message
- API cost reduction: 60%

### Implementation Steps

1. **Phase 1: Add Cache Class (1 hour, NO RISK)**
   ```typescript
   // In server/services/embeddingCache.ts (NEW FILE)
   export class EmbeddingCache {
     // Implementation as shown above
   }

   export const embeddingCache = new EmbeddingCache();
   ```

2. **Phase 2: Integrate with Embedding Service (30 min, LOW RISK)**
   ```typescript
   // In embeddingService.ts
   import { embeddingCache } from './embeddingCache.js';

   async searchSimilarMemories(queryText: string, ...args): Promise<...> {
     // Use cache instead of direct generation
     const embedding = await embeddingCache.getOrGenerate(queryText);
     return storage.findSimilarMemories(profileId, embedding, ...);
   }
   ```

3. **Phase 3: Add Metrics (30 min, NO RISK)**
   ```typescript
   // Track cache hit rate
   class EmbeddingCache {
     private hits = 0;
     private misses = 0;

     getStats() {
       const total = this.hits + this.misses;
       const hitRate = total > 0 ? (this.hits / total * 100).toFixed(1) : 0;
       return { hits: this.hits, misses: this.misses, hitRate: `${hitRate}%` };
     }
   }

   // Log every 50 queries
   if ((hits + misses) % 50 === 0) {
     console.log('📊 Embedding cache stats:', embeddingCache.getStats());
   }
   ```

4. **Phase 4: Persistent Cache (Optional, 2 hours, LOW RISK)**
   ```typescript
   // Save cache to disk on shutdown, load on startup
   // Survives server restarts
   class EmbeddingCache {
     async saveToDisk() {
       const data = Array.from(this.cache.entries());
       await fs.writeFile('cache/embeddings.json', JSON.stringify(data));
     }

     async loadFromDisk() {
       const data = await fs.readFile('cache/embeddings.json', 'utf-8');
       this.cache = new Map(JSON.parse(data));
     }
   }

   // On server startup
   await embeddingCache.loadFromDisk();

   // On shutdown
   process.on('SIGTERM', async () => {
     await embeddingCache.saveToDisk();
   });
   ```

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Stale embeddings | LOW | Low | 1 hour TTL refreshes regularly |
| Memory leak | VERY LOW | Medium | LRU eviction at 100 entries (~4MB max) |
| Cache poisoning | NONE | N/A | Simple in-memory Map, no external input |
| Wrong results | VERY LOW | Low | Embeddings are deterministic for same text |

### Precautions

1. **Monitor memory usage:**
   ```typescript
   // Log memory stats periodically
   setInterval(() => {
     const used = process.memoryUsage();
     console.log('Memory:', (used.heapUsed / 1024 / 1024).toFixed(2), 'MB');
   }, 60000);
   ```

2. **Add cache clear endpoint:**
   ```typescript
   // In routes.ts
   app.post('/api/admin/clear-embedding-cache', (req, res) => {
     embeddingCache.clear();
     res.json({ message: 'Cache cleared' });
   });
   ```

3. **Test cache correctness:**
   ```bash
   # Send same message twice, verify identical results
   curl -X POST localhost:5000/api/chat -d '{"message": "test"}'
   curl -X POST localhost:5000/api/chat -d '{"message": "test"}'
   # Check logs for cache HIT on second request
   ```

### Effort & Timeline
- **Effort:** 2-4 hours (basic), 6 hours (with persistence)
- **Risk:** VERY LOW (pure optimization, doesn't change behavior)
- **Benefit:** 30-60% reduction in embedding generation time + API cost

---

## Proposal 4: Smart Query Routing (Keyword-First)

### Current Problem
Every message does:
1. Keyword search (50ms)
2. Embedding generation (200ms)
3. Vector search (100ms)

Even for simple exact-match queries like:
- "What's your favorite pasta?" (keyword "favorite pasta" would find it)
- "Tell me about Sal" (keyword "Sal" would find it)

### Proposed Solution

```typescript
async function smartRetrieval(query: string, profileId: string): Promise<MemoryEntry[]> {
  // 1. Try keyword search first (fast!)
  const keywordResults = await keywordSearch(query, profileId, limit=10);

  // 2. If we found enough high-quality results, skip semantic search
  const highQualityResults = keywordResults.filter(m => m.confidence >= 70);

  if (highQualityResults.length >= 5) {
    console.log('✅ Keyword search sufficient, skipping embedding (saved 200ms)');
    return highQualityResults.slice(0, 10);
  }

  // 3. Otherwise, fall back to full hybrid search
  console.log('⚠️ Keyword search insufficient, running semantic search');
  return await hybridSearch(query, profileId);
}
```

### Expected Impact

**Queries that skip semantic search:**
- Exact name matches ("Sal", "carbonara", "episode 68")
- Common phrases ("favorite pasta", "tell story")
- Specific topics with dedicated memories

**Conservative estimate:** 40% of queries skip semantic search
- Average speedup: 80ms per message (200ms embedding skipped, but added 50ms keyword search we were doing anyway)
- API cost reduction: 40%

### Implementation Steps

1. **Phase 1: Add Routing Logic (1 hour, LOW RISK)**
   ```typescript
   // In contextBuilder.ts
   private async shouldUseKeywordOnly(
     keywordResults: MemoryEntry[],
     threshold: number = 5
   ): Promise<boolean> {
     const highQuality = keywordResults.filter(m => m.confidence >= 70);
     return highQuality.length >= threshold;
   }

   public async retrieveMemoriesSmart(
     userMessage: string,
     profileId: string,
     mode?: string,
     limit: number = 10
   ): Promise<MemoryEntry[]> {
     // Extract keywords
     const { keywords, contextualQuery } = await this.extractContextualKeywords(
       userMessage, undefined, undefined, mode
     );

     // Try keyword search first
     const keywordResults = await storage.searchMemoriesByKeywords(
       profileId, keywords, limit * 2, 'CANON'
     );

     // Check if sufficient
     if (await this.shouldUseKeywordOnly(keywordResults)) {
       return keywordResults
         .filter(m => m.confidence >= 60)
         .slice(0, limit);
     }

     // Fall back to hybrid (semantic + keyword)
     return await this.retrieveMemoriesSimplified(userMessage, profileId, mode, limit);
   }
   ```

2. **Phase 2: Add Metrics (30 min, NO RISK)**
   ```typescript
   let keywordOnlyCount = 0;
   let hybridCount = 0;

   // In routing logic
   if (await this.shouldUseKeywordOnly(keywordResults)) {
     keywordOnlyCount++;
     console.log(`📊 Keyword-only: ${keywordOnlyCount}/${keywordOnlyCount + hybridCount} (${(keywordOnlyCount / (keywordOnlyCount + hybridCount) * 100).toFixed(1)}%)`);
   } else {
     hybridCount++;
   }
   ```

3. **Phase 3: Tune Threshold (1 day, NO RISK)**
   ```typescript
   // Test different thresholds
   const thresholds = [3, 5, 7, 10];

   for (const threshold of thresholds) {
     // Test with real queries
     // Measure: skip rate, retrieval quality
   }
   ```

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Miss relevant memories | MEDIUM | Medium | Conservative threshold (5 results) |
| Keyword search too limited | MEDIUM | Low | Falls back to hybrid automatically |
| Quality degradation | LOW | Medium | Only skip if confidence >= 70 |

### Precautions

1. **Make threshold configurable:**
   ```typescript
   const KEYWORD_ONLY_THRESHOLD = parseInt(process.env.KEYWORD_ONLY_THRESHOLD || '5');
   ```

2. **Log when skipping:**
   ```typescript
   console.log(`Keyword search found ${highQuality.length} high-quality results, skipping semantic`);
   ```

3. **Add override for testing:**
   ```typescript
   // Force hybrid search for specific queries
   if (query.includes('[force-semantic]')) {
     return await hybridSearch(query, profileId);
   }
   ```

### Effort & Timeline
- **Effort:** 2-3 hours (implementation + basic testing)
- **Risk:** LOW (automatic fallback to hybrid)
- **Benefit:** 40% reduction in embedding API calls + latency

---

## Proposal 5: Reduce Parallel Queries from 7 to 3-4

### Current: 7 Parallel DB Queries

```typescript
const [
  contextualMemoriesResult,    // Query 1: Main memory search
  podcastAwareMemories,         // Query 2: Podcast-specific memories
  relevantDocs,                 // Query 3: Document search
  loreContext,                  // Query 4: Lore retrieval
  trainingExamples              // Query 5: Training examples
] = await Promise.all([...]);

// Inside contextualMemoriesResult, there are 2 more:
// Query 6: Recent messages
// Query 7: Entity search
```

### How Often Each Is Useful

Based on your use case (personal co-host):

| Query | Usefulness | Frequency | Keep? |
|-------|-----------|-----------|-------|
| Main memory search | ✅ Always critical | 100% | ✅ YES |
| Recent messages | ✅ Context essential | 100% | ✅ YES |
| Entity search | ⚠️ Useful for names | 40% | 🤔 MAYBE |
| Podcast memories | ⚠️ Only for podcast mode | 20% | 🤔 CONDITIONAL |
| Training examples | ⚠️ Style consistency | 30% | 🤔 MAYBE |
| Document search | ❌ Rarely hits | 5% | ❌ SKIP |
| Lore context | ❌ Static, rarely changes | 10% | ❌ CACHE |

### Proposed: Mode-Specific Queries

```typescript
public async gatherAllContext(
  message: string,
  profileId: string,
  mode?: string
): Promise<any> {
  // ALWAYS: Core retrieval
  const corePromises = [
    this.retrieveMemoriesSmart(message, profileId, mode),  // Main memories
    storage.getRecentMessages(conversationId, 10),          // Recent history
  ];

  // CONDITIONALLY: Mode-specific
  const conditionalPromises = [];

  if (mode === 'PODCAST') {
    conditionalPromises.push(
      contextPrewarmer.getPodcastMemories(profileId, storage, mode)
    );
  }

  if (mode !== 'STREAMING') {
    conditionalPromises.push(
      embeddingServiceInstance.searchSimilarTrainingExamples(message, profileId, 5)
    );
  }

  // Run all promises
  const [memories, recentMessages, ...conditional] = await Promise.all([
    ...corePromises,
    ...conditionalPromises
  ]);

  return {
    memoryPack: { canon: memories },
    recentMessages,
    trainingExamples: conditional[0] || [],
    // Document search: skip entirely (you can manually trigger if needed)
    // Lore context: load once on startup, cache in memory
  };
}
```

### Expected Impact

**Normal chat:** 2 queries instead of 7 (71% reduction)
**Podcast mode:** 3 queries instead of 7 (57% reduction)
**Streaming mode:** 2 queries instead of 7 (71% reduction)

**Time saved:** ~150-200ms (4-5 queries × ~40ms each)

### Implementation Steps

1. **Phase 1: Pre-load Static Data (1 hour, NO RISK)**
   ```typescript
   // Load lore once on server startup
   class StaticContextCache {
     private loreCache: string | undefined;

     async warmup(profileId: string) {
       this.loreCache = await contextPrewarmer.getLoreContext(profileId, storage);
       console.log('✅ Lore context cached:', this.loreCache?.length, 'chars');
     }

     getLore() {
       return this.loreCache || '';
     }
   }

   // In server/index.ts
   await staticContextCache.warmup(DEFAULT_PROFILE_ID);
   ```

2. **Phase 2: Implement Conditional Queries (2 hours, LOW RISK)**
   - As shown in proposed code above
   - Mode-specific query selection

3. **Phase 3: Remove Document Search (30 min, LOW RISK)**
   ```typescript
   // Keep the function, just don't call it automatically
   // Add manual endpoint if needed
   app.post('/api/search-documents', async (req, res) => {
     const results = await documentProcessor.searchDocuments(profileId, query);
     res.json(results);
   });
   ```

4. **Phase 4: Monitor Hit Rates (Ongoing)**
   ```typescript
   // Log when conditional queries return results
   if (podcastMemories.length > 0) {
     console.log(`✅ Podcast query returned ${podcastMemories.length} results`);
   } else {
     console.log('⚠️ Podcast query returned nothing (wasted query)');
   }
   ```

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Miss important context | LOW | Medium | Keep mode-specific queries |
| Lore becomes stale | VERY LOW | Low | Reload on profile update |
| Documents never searched | NONE | None | Manual endpoint available |

### Precautions

1. **Add lore reload endpoint:**
   ```typescript
   app.post('/api/admin/reload-lore', async (req, res) => {
     await staticContextCache.warmup(profileId);
     res.json({ message: 'Lore reloaded' });
   });
   ```

2. **Log query count:**
   ```typescript
   console.log(`Context gathered with ${corePromises.length + conditionalPromises.length} queries`);
   ```

3. **Keep old function for comparison:**
   ```typescript
   const USE_CONDITIONAL_QUERIES = process.env.CONDITIONAL_QUERIES !== 'false';
   ```

### Effort & Timeline
- **Effort:** 3-4 hours
- **Risk:** LOW (conditional logic is simple)
- **Benefit:** 150-200ms latency reduction, 57-71% fewer DB queries

---

## Proposal 6: Remove Importance from Scoring

### The Problem

Currently, `importance` is used **3 times** in scoring:

1. **Base score:** `importance * 0.1` (max +99.9!)
2. **Contextual relevance:** `(importance/100) * 0.25` (max +0.25)
3. **Vector ranking:** `importance / (1 + retrievalCount/50)`

This causes unrelated but "important" memories to leak through:

```
Query: "What's your favorite pasta?"

Results:
1. "Nicky's favorite pasta is carbonara" (importance: 200, semantic: 0.92)
   Score: (0.92 × 1.2) + (200 × 0.1) = 21.1 ✅ CORRECT

2. "Nicky has 200 hours in DbD" (importance: 80, semantic: 0.45)
   Score: (0.45 × 1.2) + (80 × 0.1) = 8.54 ❌ WRONG (but still ranks high!)
```

The DbD memory has **nothing to do with pasta**, but scores high due to importance.

### Proposed Solution

**Remove importance from scoring entirely. Trust the vector embeddings.**

```typescript
// Before
score = (semantic × 1.2) + (importance × 0.1) + (confidence × 0.001)

// After
score = semantic  // That's it!
```

### Justification

1. **Importance was meant to boost "core" memories** - But vector embeddings already find relevant memories
2. **It causes false positives** - High importance + low relevance = bad results
3. **You can use confidence instead** - If a memory is important, mark it high confidence (>90)
4. **Semantic relevance > manual importance** - Let the AI (Gemini embeddings) decide what's relevant

### What About "Protected Facts"?

You have memories with `importance: 999` that are "protected core personality facts". These should ALWAYS be included.

**Solution:**
```typescript
// Always include protected facts in context (regardless of query)
const protectedFacts = await storage.getMemoriesByImportance(profileId, 999);

// Add to every response
const allMemories = [
  ...protectedFacts,  // Always included
  ...relevantMemories // From semantic search
];
```

This is **more explicit** and **less error-prone** than relying on scoring.

### Implementation Steps

1. **Phase 1: Remove from Scoring (30 min, MEDIUM RISK)**
   ```typescript
   // In contextBuilder.ts and embeddingService.ts

   // REMOVE:
   const baseScore = (semantic × 1.2) + (importance × 0.1) + (confidence × 0.001)

   // REPLACE WITH:
   const score = semantic;
   ```

2. **Phase 2: Add Protected Facts System (1 hour, LOW RISK)**
   ```typescript
   // In storage.ts
   async getProtectedFacts(profileId: string): Promise<MemoryEntry[]> {
     return db
       .select()
       .from(memoryEntries)
       .where(
         and(
           eq(memoryEntries.profileId, profileId),
           eq(memoryEntries.status, 'ACTIVE'),
           gte(memoryEntries.importance, 999) // Protected threshold
         )
       )
       .orderBy(memoryEntries.createdAt);
   }

   // In contextBuilder.ts
   const [relevantMemories, protectedFacts] = await Promise.all([
     this.retrieveMemoriesSmart(message, profileId),
     storage.getProtectedFacts(profileId)
   ]);

   // Combine (deduplicate by ID)
   const seenIds = new Set(relevantMemories.map(m => m.id));
   const combined = [
     ...relevantMemories,
     ...protectedFacts.filter(m => !seenIds.has(m.id))
   ];
   ```

3. **Phase 3: A/B Test (1 day, NO RISK)**
   ```typescript
   // Compare results with/without importance scoring
   const withImportance = await oldRetrieval(query);
   const withoutImportance = await newRetrieval(query);

   console.log('WITH importance:', withImportance.map(m => ({
     content: m.content.substring(0, 50),
     score: m.finalScore,
     importance: m.importance
   })));

   console.log('WITHOUT importance:', withoutImportance.map(m => ({
     content: m.content.substring(0, 50),
     score: m.score,
     semantic: m.similarity
   })));
   ```

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Protected facts not included | LOW | High | Explicit getProtectedFacts() call |
| Important memories missed | MEDIUM | Medium | A/B testing, confidence can substitute |
| Semantic search insufficient | LOW | Medium | Embeddings are quite good |

### Precautions

1. **Verify protected facts before cutover:**
   ```sql
   SELECT content, importance FROM memory_entries
   WHERE importance >= 900
   ORDER BY importance DESC;
   ```

2. **Keep importance column in DB:**
   - Don't delete it (might be useful later)
   - Just stop using it in scoring

3. **Make protected threshold configurable:**
   ```typescript
   const PROTECTED_IMPORTANCE_THRESHOLD = parseInt(
     process.env.PROTECTED_IMPORTANCE_THRESHOLD || '999'
   );
   ```

### Effort & Timeline
- **Effort:** 2-3 hours (including testing)
- **Risk:** MEDIUM (scoring changes affect retrieval)
- **Benefit:** More accurate results, simpler scoring

---

## Implementation Roadmap

### Phase 1: Low-Risk Optimizations (Week 1)
**Goal:** Quick wins, no behavior changes

1. ✅ **Remove Unused Fields** (3-4 hours)
   - Remove successRate, qualityScore, temporalContext
   - Database migration

2. ✅ **Add Embedding Cache** (2-4 hours)
   - In-memory LRU cache
   - Metrics tracking

3. ✅ **Reduce Parallel Queries** (3-4 hours)
   - Mode-specific queries
   - Cache static lore

**Total:** 8-12 hours
**Risk:** VERY LOW
**Benefit:** ~150ms latency reduction, cleaner code

### Phase 2: Scoring Simplification (Week 2)
**Goal:** Test new scoring in parallel with old

1. ✅ **Create Simplified Retrieval** (2 hours)
   - New function with Option C scoring
   - A/B testing flag

2. ✅ **User Testing** (2-3 days)
   - Use during streams
   - Compare results
   - Tune confidence threshold

3. ✅ **Cutover** (1 hour)
   - Replace old retrieval
   - Remove old code

**Total:** 1-2 days active work + 2-3 days testing
**Risk:** MEDIUM (can rollback easily)
**Benefit:** Massive complexity reduction

### Phase 3: Advanced Optimizations (Week 3)
**Goal:** Further latency improvements

1. ✅ **Smart Query Routing** (2-3 hours)
   - Keyword-first routing
   - Threshold tuning

2. ✅ **Remove Importance from Scoring** (2-3 hours)
   - Protected facts system
   - A/B testing

**Total:** 4-6 hours
**Risk:** MEDIUM
**Benefit:** 40% fewer embedding calls, better accuracy

### Complete Timeline

```
Week 1: Low-Risk Optimizations
├─ Day 1-2: Remove unused fields + embedding cache
├─ Day 3: Reduce parallel queries
└─ Result: ~150ms faster, cleaner code

Week 2: Scoring Simplification
├─ Day 1: Implement new scoring
├─ Day 2-4: Test during streams
├─ Day 5: Cutover
└─ Result: 5 mechanisms removed, easier debugging

Week 3: Advanced Optimizations
├─ Day 1: Smart query routing
├─ Day 2-3: Remove importance from scoring + testing
└─ Result: 40% fewer API calls, better results

TOTAL: ~3 weeks (10-15 hours active work + testing)
```

---

## Testing Strategy

### Automated Tests

```typescript
// server/tests/memory-retrieval-comparison.test.ts
describe('Simplified Memory Retrieval', () => {
  it('should return similar results to old system', async () => {
    const queries = [
      "What's your favorite pasta?",
      "Tell me about Sal the butcher",
      "What happened in episode 68?"
    ];

    for (const query of queries) {
      const oldResults = await oldRetrieval(query);
      const newResults = await newRetrieval(query);

      // Check overlap (should be >80%)
      const overlap = calculateOverlap(oldResults, newResults);
      expect(overlap).toBeGreaterThan(0.8);

      // Check top result is same
      expect(newResults[0].id).toBe(oldResults[0].id);
    }
  });

  it('should be faster than old system', async () => {
    const query = "Tell me a story";

    const oldTime = await measureTime(() => oldRetrieval(query));
    const newTime = await measureTime(() => newRetrieval(query));

    expect(newTime).toBeLessThan(oldTime * 0.7); // At least 30% faster
  });

  it('should maintain confidence filtering', async () => {
    const results = await newRetrieval("test query");

    // All results should have confidence >= 60
    results.forEach(m => {
      expect(m.confidence).toBeGreaterThanOrEqual(60);
    });
  });
});
```

### Manual Testing Checklist

```markdown
## Test Cases

### General Queries
- [ ] "What's your favorite pasta?" → Should return carbonara
- [ ] "Tell me about Sal" → Should return Newark butcher memories
- [ ] "What happened in episode 68?" → Should return episode-specific facts

### Edge Cases
- [ ] Empty query "" → Should handle gracefully
- [ ] Very long query (500+ chars) → Should not crash
- [ ] Query with no matches → Should return empty or generic memories

### Mode-Specific
- [ ] PODCAST mode → Should include podcast memories
- [ ] STREAMING mode → Should skip training examples
- [ ] CHAT mode → Should use standard retrieval

### Performance
- [ ] Cold start (no cache) → Measure latency
- [ ] Warm cache → Should be <500ms
- [ ] 10 rapid queries → No memory leak

### Accuracy
- [ ] Protected facts (importance=999) → Always included
- [ ] High confidence memories → Prioritized
- [ ] Low confidence memories → Filtered out
```

---

## Rollback Plan

### For Each Proposal

1. **Remove Unused Fields**
   ```sql
   -- Rollback migration
   ALTER TABLE memory_entries ADD COLUMN success_rate INTEGER DEFAULT 50;
   ALTER TABLE memory_entries ADD COLUMN quality_score INTEGER;
   ALTER TABLE memory_entries ADD COLUMN temporal_context TEXT;
   ```

2. **Simplify Scoring**
   ```typescript
   // Just switch the function back
   const USE_OLD_RETRIEVAL = true;

   const memories = USE_OLD_RETRIEVAL
     ? await this.retrieveContextualMemories(...)
     : await this.retrieveMemoriesSimplified(...);
   ```

3. **Embedding Cache**
   ```typescript
   // Disable cache
   const USE_CACHE = false;

   const embedding = USE_CACHE
     ? await embeddingCache.getOrGenerate(text)
     : await this.generateEmbedding(text);
   ```

4. **Query Reduction**
   ```typescript
   // Restore all 7 queries
   const USE_ALL_QUERIES = true;
   ```

5. **Remove Importance**
   ```typescript
   // Re-add to scoring
   const score = semantic + (importance * 0.1);
   ```

### Emergency Rollback Procedure

```bash
# 1. Stop the server
pm2 stop nicky

# 2. Checkout last working version
git checkout v1.0-complex-scoring

# 3. Restore database if needed
pg_restore -d $DATABASE_URL backups/pre_simplification.sql

# 4. Restart
pm2 start nicky

# 5. Verify
curl localhost:5000/api/health
```

---

## Success Metrics

### Performance Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Avg response time | ~710ms | <400ms | Time from message to context ready |
| Embedding cache hit rate | 0% | >30% | Cache hits / total queries |
| DB queries per message | 7 | 3-4 | Count of parallel queries |
| API calls per message | 1 | 0.6 | Gemini embedding calls |

### Quality Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Top result accuracy | Baseline | >90% same | Manual review of test queries |
| Retrieval overlap | Baseline | >80% | Comparison with old system |
| Protected facts inclusion | 100% | 100% | All importance=999 included |
| False positives | Unknown | <5% | Unrelated memories in results |

### Code Quality Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Scoring mechanisms | 8 | 2-3 | Count of distinct scoring formulas |
| Unused fields | 4 | 0 | Database columns not queried |
| Lines of code | ~700 | <400 | contextBuilder.ts + embeddingService.ts |
| Cyclomatic complexity | High | Medium | ESLint complexity score |

---

## Maintenance After Simplification

### Ongoing Tasks

1. **Monitor cache hit rates** (weekly)
   ```bash
   # Check logs for embedding cache stats
   grep "Embedding cache" logs/app.log | tail -100
   ```

2. **Review retrieval quality** (monthly)
   - Test standard queries
   - Check for regressions
   - Tune confidence threshold if needed

3. **Update protected facts** (as needed)
   - Review importance=999 memories
   - Add/remove as personality evolves

### Documentation Updates

1. **Update MASTER_ARCHITECTURE.md**
   - Document new simplified scoring
   - Remove references to unused fields

2. **Update code comments**
   - Explain why we simplified
   - Document decision-making

3. **Create SCORING.md**
   ```markdown
   # Memory Scoring System

   ## Overview
   We use a simplified scoring system that trusts vector embeddings.

   ## Formula
   score = semantic_similarity
   filter = confidence >= 60 && lane === 'CANON'

   ## Why So Simple?
   - Vector embeddings already encode relevance
   - Over-weighting importance caused false positives
   - Simpler = faster + easier to debug
   ```

---

## Open Questions

1. **Should we keep `importance` column in database?**
   - Pro: Might be useful for protected facts (999)
   - Con: Temptation to use it in scoring again
   - **Recommendation:** Keep for now, only use for protected facts

2. **What's the optimal cache size?**
   - Current proposal: 100 entries
   - During streams: might need 200-300
   - **Recommendation:** Make configurable via env var

3. **Should we add query latency SLA alerts?**
   - Pro: Know immediately if performance degrades
   - Con: Adds complexity
   - **Recommendation:** Start with logging, add alerts if needed

4. **How to handle migration of existing importance values?**
   - 4,136 memories have importance scores
   - Don't want to lose this data
   - **Recommendation:** Keep values, just don't use in scoring

---

## Conclusion

This plan proposes **6 targeted simplifications** to reduce complexity and improve performance:

1. ✅ **Remove Unused Fields** - LOW RISK, quick win
2. ✅ **Simplify Scoring** - MEDIUM RISK, massive benefit
3. ✅ **Cache Embeddings** - VERY LOW RISK, free speedup
4. ✅ **Smart Query Routing** - LOW RISK, 40% API cost reduction
5. ✅ **Reduce Parallel Queries** - LOW RISK, 150ms faster
6. ✅ **Remove Importance from Scoring** - MEDIUM RISK, better accuracy

**Total effort:** 10-15 hours active work + 1 week testing
**Risk level:** LOW-MEDIUM (all changes reversible)
**Expected benefit:**
- 40-60% latency reduction (~300-400ms saved)
- 40% fewer API calls
- 50% fewer DB queries
- 5 scoring mechanisms eliminated
- Much easier to debug and maintain

**Recommendation:** Proceed with **Phase 1** (low-risk optimizations) first. If successful, continue to Phase 2 and 3.
