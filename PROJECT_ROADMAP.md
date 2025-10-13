# Nicky AI - Project Roadmap & Improvements

**Last Updated:** October 13, 2025

This document tracks suggested improvements and their implementation status.

---

## ✅ COMPLETED FIXES

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

### 1. 🎭 Personality Prompt Structure
**Priority:** HIGH - User reports personality feels "one track mind"

**Problem:**
- System prompt may be diluted with technical instructions
- Personality presets might override core voice
- Over-indexing on pasta/DbD references in every response

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

---

## 🎨 UI IMPROVEMENTS NEEDED

### 1. Memory Management Panel
**Priority:** MEDIUM - Need better UI for memory operations

**Features to add:**
- ✅ Search box with real-time results
- ✅ Filter by: category, importance, date range
- ✅ Bulk select & delete
- ⚠️ "Find Duplicates" button (backend exists, need UI)
- ⚠️ Memory detail view (click to see full details)
- ⚠️ Edit content, importance, category inline
- ⚠️ See which conversation created each memory
- ⚠️ View story context

**Template provided in suggestions - ready to implement**

### 2. Protected Facts Dashboard
**Priority:** LOW - Better management of high-importance memories

**Features:**
- Show all 999 importance memories
- Warning before deleting
- "Lock" toggle to make facts undeletable

### 3. Memory Analytics
**Priority:** LOW - Visualization & insights

**Features:**
- Total memories by category (pie chart)
- Memory growth over time (line graph)
- Most referenced memories (top 10 list)

### 4. Debug Mode Toggle
**Priority:** HIGH - Critical for troubleshooting

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

**Files to check:** Look for content collection service

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

**Week 1: Fix Core Experience**
1. ✅ Update personality prompt structure (reduce "one track mind")
2. ✅ Add memory retrieval debug mode
3. ✅ Test personality improvements

**Week 2: Enhance Memory System**
1. ⚠️ Add "Find Duplicates" UI button (backend ready)
2. ⚠️ Implement multi-strategy memory search
3. ✅ Add debug mode to show retrieved memories
4. ✅ Test with common questions

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

### 1. Prometheus Metrics Endpoint
**Priority:** MEDIUM - Better monitoring
**Status:** Not implemented

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
- Current memory count: 1505 unique memories (39 duplicates removed)
- Database: PostgreSQL with Drizzle ORM
- Unique constraint active: (profileId, canonicalKey)
