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

### 3. **Importance** (0-999)
- **Source:** Memory field, manually set or auto-calculated
- **Contribution:** `importance * 0.1` (max +99.9)
- **Used in:** Base score, contextual relevance

### 4. **Confidence** (0-100)
- **Source:** Memory field
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

### Memories in Database (4,136 total):

```
ID   | Content                                    | Lane   | Conf | Importance
──────────────────────────────────────────────────────────────────────────────
M1   | Nicky's favorite pasta is carbonara       | CANON  | 95   | 200
M2   | Nicky HATES cream in carbonara            | CANON  | 90   | 180
M3   | Carbonara must have guanciale, not bacon  | CANON  | 85   | 150
M4   | Nicky once threw a plate at someone       | RUMOR  | 30   | 50
     | who used cream
M5   | Nicky's grandmother taught him to cook    | CANON  | 70   | 120
M6   | Penne is acceptable but rigatoni is best  | CANON  | 65   | 100
M7   | Nicky's favorite color is red             | CANON  | 80   | 50
M8   | Nicky has 200 hours in Dead by Daylight   | CANON  | 95   | 80
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
Base score = 0.92 * 1.2 + 200 * 0.1 + 95 * 0.001
           = 1.104 + 20.0 + 0.095
           = 21.199

Contextual relevance = 0.5 (base)
                     + 0.4 (PREFERENCE matches "favorite" intent)
                     + 0.5 (importance contribution)
                     + 0.095 (confidence contribution)
                     + 0.3 (3 keyword matches)
                     = 1.0 (capped)

Diversity = 1.0 (first result, no penalty)

Final score = 21.199 * 1.0 + 1.0 * 0.3 = 21.499
```

**M7: Favorite color is red**
```
Base score = 0.55 * 1.2 + 50 * 0.1 + 80 * 0.001
           = 0.66 + 5.0 + 0.08
           = 5.74

Contextual relevance = 0.5 + 0.1 (keyword: "favorite") = 0.6

Diversity = 1.0 - 0.1 (same type: PREFERENCE) = 0.9

Final score = 5.74 * 0.9 + 0.6 * 0.3 = 5.35
```

**M8: Dead by Daylight hours**
```
Base score = 0.45 * 1.2 + 80 * 0.1 + 95 * 0.001
           = 0.54 + 8.0 + 0.095
           = 8.635

Contextual relevance = 0.5 (base only, no matches)

Diversity = 1.0 - 0.2 (no type match but keyword overlap with "Nicky")

Final score = 8.635 * 0.8 + 0.5 * 0.3 = 7.06
```

### Step 4: Filtering

**CANON Filter** (confidence >= 60):
- ✅ M1 (95) → KEEP
- ✅ M2 (90) → KEEP
- ✅ M3 (85) → KEEP
- ❌ M4 (30) → RUMOR lane, skip in normal chat
- ✅ M5 (70) → KEEP
- ✅ M6 (65) → KEEP
- ✅ M7 (80) → KEEP (but low relevance score)
- ✅ M8 (95) → KEEP (but low relevance score)

**Sort by Final Score:**
1. M1 (21.499)
2. M2 (similar high score)
3. M3 (similar high score)
4. M8 (7.06) - IRRELEVANT but high base score!
5. M5 (moderate)
6. M6 (moderate)
7. M7 (5.35) - Wrong topic!

### Step 5: Returned to Gemini (top 8)

```
[CANON MEMORIES]
- Nicky's favorite pasta is carbonara
- Nicky HATES cream in carbonara
- Carbonara must have guanciale, not bacon
- Nicky has 200 hours in Dead by Daylight ← IRRELEVANT!
- Nicky's grandmother taught him to cook
- Penne is acceptable but rigatoni is best
- (M7 might be filtered by limit)
- (M8 got through due to high importance!)
```

**Notice:** M8 (Dead by Daylight) made it through because it has high `importance` (80) and `confidence` (95), even though it's completely irrelevant to pasta!

---

## 🎯 Key Insights

### What's Working:
1. **Semantic search** finds contextually related memories well
2. **Keyword search** catches exact matches
3. **Lane filtering** (CANON vs RUMOR) is a good concept
4. **Confidence threshold** prevents low-quality memories

### What's Broken:
1. **Importance and confidence are too heavily weighted** - Unrelated but "important" memories get through
2. **Too many scoring layers** - 8 different mechanisms that overlap
3. **Retrieval count** is barely used (only in vector ranking)
4. **Success rate** is tracked but never used
5. **Contextual relevance calculation is expensive** (10ms × 50 memories = 500ms wasted)
6. **Diversity scoring** is applied AFTER retrieval, should be during

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
