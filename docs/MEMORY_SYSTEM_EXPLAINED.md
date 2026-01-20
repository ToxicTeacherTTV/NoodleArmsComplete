# Memory Retrieval System - Explained

## 🎯 TL;DR: How It Works Now

When you send Nicky a message like **"Hey Nicky, what's the story with Sal the butcher?"**, here's what happens:

```
┌─────────────────────────────────────────────────────────────┐
│  USER MESSAGE                                                │
│  "Hey Nicky, what's the story with Sal the butcher?"       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Keyword Extraction (10ms)                          │
│  → ["nicky", "story", "sal", "butcher"]                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Contextual Enhancement (50ms)                      │
│  + Recent conversation keywords                              │
│  + Personality keywords (if Story Mode: +family, +newark)   │
│  + Mode keywords (if PODCAST: +episode, +show)              │
│  + Emotion keywords (angry → +frustration)                  │
│  → ["nicky", "story", "sal", "butcher", "family", "newark"] │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Parallel Context Gathering (400-700ms)             │
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 🔢 HYBRID SEARCH    │  │ 📄 DOCUMENTS       │          │
│  │ (300ms)             │  │ (50ms)             │          │
│  │                     │  │                     │          │
│  │ A. Semantic Search: │  └─────────────────────┘          │
│  │    1. Generate      │                                    │
│  │       embedding     │  ┌─────────────────────┐          │
│  │       (200ms)       │  │ 📚 LORE CONTEXT    │          │
│  │    2. Vector search │  │ (50ms)             │          │
│  │       4,136 memories│  └─────────────────────┘          │
│  │       (100ms)       │                                    │
│  │                     │  ┌─────────────────────┐          │
│  │ B. Keyword Search:  │  │ 🎓 TRAINING        │          │
│  │    SQL LIKE queries │  │    EXAMPLES        │          │
│  │    (50ms)           │  │ (100ms)            │          │
│  │                     │  └─────────────────────┘          │
│  │ C. Combine & rank   │                                    │
│  └─────────────────────┘  ┌─────────────────────┐          │
│                           │ 🎙️  PODCAST        │          │
│  All running in parallel! │    MEMORIES        │          │
│                           │ (50ms)             │          │
│                           └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Scoring & Filtering (20ms)                         │
│                                                              │
│  For EACH memory retrieved:                                 │
│    1. Base Score = semantic_similarity * 1.2                │
│                  + importance * 0.1                          │
│                  + confidence * 0.001                        │
│                                                              │
│    2. Contextual Relevance = 0.5 (if same conversation)    │
│                            + 0.4 (if query intent matches)  │
│                            + importance/100 * 0.25          │
│                            + confidence/100 * 0.1           │
│                            + 0.1 per keyword match          │
│                                                              │
│    3. Diversity Score = 1.0                                 │
│                       - 0.1 (if same type as previous)      │
│                       - 0.2 per keyword overlap             │
│                                                              │
│    4. Final Score = base_score * diversity_score            │
│                   + contextual_relevance * 0.3              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Lane Filtering (5ms)                               │
│                                                              │
│  CANON memories (facts):                                    │
│    ✅ MUST have lane = 'CANON'                              │
│    ✅ MUST have confidence >= 60                            │
│    ✅ Always retrieved                                      │
│                                                              │
│  RUMOR memories (bullshit):                                 │
│    🎭 Only in "Theater Zone":                               │
│       - PODCAST mode                                         │
│       - STREAMING mode                                       │
│       - Chaos > 70                                           │
│    🎭 Max confidence: 40                                    │
│    🎭 Limited to 3 rumors                                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Knowledge Gap Detection (10ms)                     │
│                                                              │
│  If keywords don't match retrieved memories:                │
│    → "You don't know nuttin' about: X, Y, Z"               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: Context Pruning (20ms)                             │
│  Remove redundant info already in conversation history      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  FINAL RESULT (sent to Gemini)                              │
│                                                              │
│  [CANON MEMORIES]                                            │
│  - Sal is a butcher from Newark (confidence: 95)           │
│  - Sal taught me about meat cuts (confidence: 80)          │
│                                                              │
│  [RUMORS] (if Theater Zone)                                 │
│  - Sal once wrestled a bear (confidence: 30)               │
│  - Sal secretly runs the mafia (confidence: 35)            │
└─────────────────────────────────────────────────────────────┘

TOTAL TIME: ~710ms before Nicky starts talking
```

---

## 📊 The Scoring System Breakdown

You currently have **EIGHT** different scoring mechanisms. Here's what each one does:

### 1. **Semantic Similarity** (Vector Cosine Distance)
- **Source:** Vector embedding search via Gemini
- **Range:** 0.0 to 1.0 (boosted to 1.2 for semantic matches)
- **Cost:** 200ms + Gemini API call
- **Used in:** Primary ranking

### 2. **Keyword Match Score**
- **Source:** SQL `LIKE` queries
- **Range:** 0.7 (default for keyword matches)
- **Cost:** 50ms
- **Used in:** Primary ranking (if not found in semantic)

### 3. **Importance** (1-100)
- **Source:** Memory field, set during extraction based on AI assessment
- **Scale (as of v1.9.0):**
  - 1-25: Minor details, trivial info
  - 26-45: Standard facts, common details
  - 46-60: Notable facts (MOST facts should be here)
  - 61-75: Important facts, key traits
  - 76-100: CRITICAL ONLY - core identity facts (use sparingly!)
- **Contribution:** `importance * 0.005` (max +0.5) - reduced in v1.8.0
- **Used in:** Base score, contextual relevance

### 4. **Confidence** (1-100)
- **Source:** Memory field, set during extraction and boosted on duplicates
- **Tiers (as of v1.9.0):**
  - 1-59: Low confidence, unverified content
  - 60-75: Standard auto-extracted content
  - 76-85: Boosted/frequently confirmed facts (auto-ceiling for non-protected)
  - 86-99: Human-verified content (manual only)
  - 100: Protected core identity facts only
- **Contribution:** `confidence * 0.001` (max +0.1)
- **Used in:** Base score, contextual relevance, HARD FILTER (must be >= 60 for CANON)

### 5. **Contextual Relevance** (calculated)
- **Factors:**
  - Same conversation: +0.5
  - Query intent matches memory type: +0.4
  - Importance contribution: +0.25 max
  - Confidence contribution: +0.1 max
  - Keyword matches: +0.1 per match (max +0.3)
- **Range:** 0.0 to 1.0
- **Used in:** Final score calculation

### 6. **Diversity Score** (penalty multiplier)
- **Factors:**
  - Same type as already-selected memory: -0.1
  - Keyword overlap: -0.2 per overlap
- **Range:** 0.0 to 1.0
- **Used in:** Final score calculation (as multiplier)

### 7. **Retrieval Count**
- **Source:** How many times this memory has been retrieved
- **Used in:** Vector search ranking formula only: `importance / (1 + retrievalCount / 50)`
- **Effect:** Slightly penalizes frequently-retrieved memories

### 8. **Success Rate** (0-100)
- **Source:** How useful this memory has been in conversations
- **Used in:** **NOWHERE!** Stored but never queried

---

## 🔥 The Problem: Too Complex

### What's Actually Happening Every Message:

```
Step                          Time      API Calls    Database Queries
────────────────────────────────────────────────────────────────────────
Extract keywords              10ms      0            0
Enhance keywords              50ms      0            1 (recent messages)
Generate embedding           200ms      1 (Gemini)   0
Semantic search              100ms      0            1 (vector search)
Keyword search                50ms      0            1
Fetch podcast memories        50ms      0            1
Search documents              50ms      0            1
Fetch lore                    50ms      0            1
Search training examples     100ms      0            1
Calculate relevance           10ms      0            0
Calculate diversity           10ms      0            0
Detect knowledge gaps         10ms      0            0
Prune context                 20ms      0            0
────────────────────────────────────────────────────────────────────────
TOTAL:                      ~710ms      1            7 queries
```

### Unused Complexity:

1. **Success Rate** - Tracked but never used
2. **Quality Score** - In schema but never queried
3. **Temporal Context** - Stored but not used for scoring
4. **Cluster ID** - Not actively used
5. **Relationships array** - Stored but not traversed

### Redundant Scoring:

- **Importance** is used 3 times (base score, contextual relevance, vector ranking)
- **Confidence** is used 3 times (base score, contextual relevance, hard filter)
- Semantic and keyword searches overlap significantly

---

## 💡 Example: What Gets Retrieved

Given this message: **"Hey Nicky, what's your favorite pasta?"**

### Memories in Database (3,679 total):

```
ID   | Content                                    | Lane   | Conf | Importance
──────────────────────────────────────────────────────────────────────────────
M1   | Nicky's favorite pasta is carbonara       | CANON  | 82   | 75
M2   | Nicky HATES cream in carbonara            | CANON  | 78   | 65
M3   | Carbonara must have guanciale, not bacon  | CANON  | 75   | 55
M4   | Nicky once threw a plate at someone       | RUMOR  | 30   | 40
     | who used cream
M5   | Nicky's grandmother taught him to cook    | CANON  | 70   | 60
M6   | Penne is acceptable but rigatoni is best  | CANON  | 65   | 45
M7   | Nicky's favorite color is red             | CANON  | 72   | 35
M8   | Nicky has 200 hours in Dead by Daylight   | CANON  | 80   | 50

Note: As of v1.9.0, confidence values cap at 85 for auto-extracted content.
Values 86+ are reserved for human-verified facts, 100 for protected facts only.
```

### Step 1: Keyword Extraction
```
Keywords: ["nicky", "favorite", "pasta"]
```

### Step 2: Hybrid Search (300ms)

**Semantic Search** (generates embedding, searches vectors):
- M1 (similarity: 0.92) - Direct match!
- M2 (similarity: 0.78) - Related to pasta
- M3 (similarity: 0.75) - Related to pasta
- M5 (similarity: 0.65) - Related (cooking)
- M6 (similarity: 0.60) - Related (pasta type)

**Keyword Search** (SQL LIKE):
- M1 (matches: "pasta")
- M2 (matches: "carbonara", context of pasta)
- M3 (matches: "carbonara", context of pasta)

### Step 3: Scoring

**M1: Carbonara is favorite**
```
Base score = 0.92 * 1.2 + 75 * 0.005 + 82 * 0.001
           = 1.104 + 0.375 + 0.082
           = 1.561

Contextual relevance = 0.5 (base)
                     + 0.4 (PREFERENCE matches "favorite" intent)
                     + 0.1875 (importance contribution: 75/100 * 0.25)
                     + 0.082 (confidence contribution)
                     + 0.3 (3 keyword matches)
                     = 1.0 (capped)

Diversity = 1.0 (first result, no penalty)

Final score = 1.561 * 1.0 + 1.0 * 0.3 = 1.861
```

**M7: Favorite color is red**
```
Base score = 0.55 * 1.2 + 35 * 0.005 + 72 * 0.001
           = 0.66 + 0.175 + 0.072
           = 0.907

Contextual relevance = 0.5 + 0.1 (keyword: "favorite") = 0.6

Diversity = 1.0 - 0.1 (same type: PREFERENCE) = 0.9

Final score = 0.907 * 0.9 + 0.6 * 0.3 = 0.996
```

**M8: Dead by Daylight hours**
```
Base score = 0.45 * 1.2 + 50 * 0.005 + 80 * 0.001
           = 0.54 + 0.25 + 0.08
           = 0.87

Contextual relevance = 0.5 (base only, no matches)

Diversity = 1.0 - 0.2 (no type match but keyword overlap with "Nicky")

Final score = 0.87 * 0.8 + 0.5 * 0.3 = 0.846
```

**Note (v1.9.0):** With the reduced importance multiplier (0.005 vs old 0.1),
semantic similarity now dominates scoring. High-importance but irrelevant
memories no longer overwhelm the results.

### Step 4: Filtering

**CANON Filter** (confidence >= 60):
- ✅ M1 (82) → KEEP
- ✅ M2 (78) → KEEP
- ✅ M3 (75) → KEEP
- ❌ M4 (30) → RUMOR lane, skip in normal chat
- ✅ M5 (70) → KEEP
- ✅ M6 (65) → KEEP
- ✅ M7 (72) → KEEP (but low relevance score)
- ✅ M8 (80) → KEEP (but low relevance score)

**Sort by Final Score:**
1. M1 (1.861) - Best semantic match + importance
2. M2 (similar high score) - Related pasta content
3. M3 (similar high score) - Related pasta content
4. M5 (moderate) - Cooking context
5. M6 (moderate) - Pasta types
6. M7 (0.996) - Wrong topic, but still passed filter
7. M8 (0.846) - Irrelevant, but now properly ranked LOW due to v1.8.0 fix!

### Step 5: Returned to Gemini (top 8)

```
[CANON MEMORIES]
- Nicky's favorite pasta is carbonara
- Nicky HATES cream in carbonara
- Carbonara must have guanciale, not bacon
- Nicky's grandmother taught him to cook
- Penne is acceptable but rigatoni is best
- Nicky's favorite color is red (low relevance, may be filtered by limit)
- Nicky has 200 hours in Dead by Daylight (lowest score, likely filtered)
```

**v1.8.0+ Improvement:** M8 (Dead by Daylight) now ranks LAST because semantic
similarity dominates scoring. The importance multiplier fix (0.1 → 0.005)
prevents high-importance but irrelevant memories from overwhelming results.

---

## 🎯 Key Insights

### What's Working:
1. **Semantic search** finds contextually related memories well
2. **Keyword search** catches exact matches
3. **Lane filtering** (CANON vs RUMOR) is a good concept
4. **Confidence threshold** prevents low-quality memories

### What Was Broken (Fixed in v1.8.0 & v1.9.0):
1. ~~**Importance and confidence too heavily weighted**~~ ✅ FIXED v1.8.0: Importance multiplier reduced from 0.1 to 0.005
2. ~~**Confidence inflation**~~ ✅ FIXED v1.9.0: Auto-ceiling at 85, slower boost growth (+3 vs +10)
3. ~~**Importance always increasing**~~ ✅ FIXED v1.9.0: Now uses weighted average instead of MAX
4. ~~**Patch notes importance: 850**~~ ✅ FIXED v1.9.0: Now correctly 35-65 on 1-100 scale

### Remaining Issues:
1. **Too many scoring layers** - 8 different mechanisms that overlap
2. **Retrieval count** is barely used (only in vector ranking)
3. **Success rate** is tracked but never used
4. **Contextual relevance calculation is expensive** (10ms × 50 memories = 500ms wasted)
5. **Diversity scoring** is applied AFTER retrieval, should be during

### Performance Issues:
1. **Embedding generation on EVERY message** (200ms + API cost)
2. **7 database queries** per message
3. **50+ memories scored individually** (contextual relevance × diversity)
4. **No caching** for common queries like "what's your favorite X"

---

## 🛠️ Simplification Proposals

### Option 1: Keep It Simple
```typescript
// ONE score: relevance
score = semantic_similarity * 0.7 + keyword_match * 0.3
      + (importance / 100) * 0.2

// ONE filter: confidence
if (memory.confidence >= 70 && memory.lane === 'CANON') {
  return memory;
}
```

### Option 2: Trust the Vector Search
```typescript
// Use ONLY semantic search
const results = await vectorSearch(queryEmbedding, limit=10);

// Simple filter
return results.filter(m => m.confidence >= 70);
```

### Option 3: Cache Common Patterns
```typescript
// Cache embeddings for your common phrases
const COMMON_QUERIES = {
  "what's your favorite pasta": <cached_embedding>,
  "tell me a story": <cached_embedding>,
  "what happened in episode X": <cached_embedding>
};
```

---

## 📝 Recommendations

1. **Remove unused fields:**
   - `successRate` (never queried)
   - `qualityScore` (never queried)
   - `temporalContext` (not used for scoring)

2. **Simplify scoring:**
   - Keep: `semantic_similarity`, `confidence`
   - Maybe keep: `importance` (but reduce weight)
   - Remove: `retrievalCount`, `diversityScore`, `contextualRelevance` (too complex)

3. **Optimize performance:**
   - Cache embeddings for your common phrases
   - Run keyword search FIRST, only do semantic if needed
   - Reduce parallel queries from 7 to 3-4

4. **Trust your data:**
   - If a memory is in the database, it's probably relevant
   - Let the vector search do its job
   - Don't over-engineer the ranking

---

## 🧪 Testing This Yourself

To see this in action, add logging to `contextBuilder.ts`:

```typescript
// In retrieveContextualMemories() around line 220
selectedResults.forEach((result, i) => {
  console.log(`[${i+1}] Score: ${result.finalScore.toFixed(2)} | "${result.content}"`);
});
```

Then send Nicky a message and watch the console. You'll see exactly what's being retrieved and how it's scored.
