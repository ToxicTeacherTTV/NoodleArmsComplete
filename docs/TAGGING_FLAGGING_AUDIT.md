# Tagging & Flagging Systems Audit

**Date:** January 25, 2026
**Status:** Analysis Complete

---

## 🔥 KEY FINDING

**The `tags` field ALREADY EXISTS in `memoryEntries` but is NEVER POPULATED!**

`shared/schema.ts:140`:
```typescript
tags: text("tags").array(), // Categorization tags (e.g. 'technical', 'dbd', 'family')
```

**Solution:** Just start using it! No schema changes needed.

---

## 📌 Note: Entity System Already Exists

**There's ALSO a full entity extraction system** (`people`, `places`, `events` tables).

**Tags vs Entities:**
- **Tags** = Broad categories (family, dbd, enemies) - regex, instant, free
- **Entities** = Specific records (Uncle Vinny, Sal's Pizzeria) - AI, slow, costs money

**They complement each other:**
- Tags for fast filtering: "Show me family stuff"
- Entities for precise search: "Show me memories about Uncle Vinny"
- See `AUTO_TAGGING_IMPLEMENTATION.md` for full comparison

---

## 📊 Current Systems Overview

### 1. **Memory Entry Core Metadata** ✅ ACTIVE
**Location:** `shared/schema.ts:131-161`
**Status:** **IN USE**

```typescript
memoryEntry {
  importance: 0-100,            // How important this memory is
  confidence: 0-100,            // How sure we are it's true
  lane: 'CANON' | 'RUMOR',      // Reliability marker
  truthDomain: string,          // Source domain
  type: 'FACT' | 'STORY' | 'ATOMIC' | 'LORE',
  status: 'ACTIVE' | 'DEPRECATED' | 'AMBIGUOUS',
  isProtected: boolean,         // Can't be auto-deprecated
  parentFactId: string,         // Links atomic facts to stories
  isAtomicFact: boolean,        // Granular fact vs story
}
```

**Active Usage:**
- ✅ `importance`: Set on every memory creation
- ✅ `confidence`: Set on every memory creation
- ✅ `lane` (CANON/RUMOR): **NEW** - Used in Phase 2 story detection (sauce meter)
- ✅ `truthDomain`: Set during memory creation
- ✅ `type`: Set on every memory creation
- ✅ `keywords`: Set on memory creation (used for search)
- ❌ `tags`: **EXISTS IN SCHEMA BUT NEVER SET** - Always empty/null
- ❓ `status`: Set but rarely queried
- ❓ `isProtected`: Set but not actively used
- ✅ `parentFactId`: Used to link atomic facts to parent stories
- ✅ `isAtomicFact`: Used to distinguish atomic facts from stories

**Critical Finding:** `tags` field exists but is unused! Only set by disabled suggestionService.

**Effectiveness:** **HIGH** - Core system, actively used, works well (except tags)

---

### 2. **Content Flags System** ⚠️ PARTIALLY ACTIVE
**Location:** `shared/schema.ts:975-990` + `server/services/aiFlagger.ts`
**Status:** **BUILT BUT NOT WIRED UP**

```typescript
contentFlag {
  flagType: 'permanent_fact' | 'high_importance' | 'deletion_candidate' |
            'coaching_violation' | 'fourth_wall_break' | ...,
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  confidence: 0-100,
  flagReason: string,
}
```

**Active Usage:**
- ⚠️ `aiFlagger` service exists and is imported in `storage.ts:116` and `routes.ts:17`
- ❌ **NEVER CALLED** - `aiFlagger.flag()` is not invoked anywhere in production flow
- ✅ Scripts exist to rescan flags (`rescanContentFlags.ts`, `reanalyzeCriticalFlags.ts`)
- ✅ Routes exist to query flags (`routes.ts:4464`, `routes.ts:5839`)
- ❌ Not called during memory creation or message handling

**Why Disabled:**
- No evidence in code of when it was disabled
- Likely disabled for performance reasons (AI flagging is expensive)
- UI endpoints exist, suggesting it was meant to be user-facing

**Effectiveness:** **UNKNOWN** - Never runs in production

---

### 3. **Memory Suggestions System** ⚠️ PARTIALLY ACTIVE
**Location:** `server/services/suggestionService.ts`
**Status:** **SHADOW MODE - NOT APPLIED**

```typescript
memorySuggestion {
  triggerType: 'REGEX',
  suggestedAction: 'BOOST_IMPORTANCE' | 'ADD_TAG' | 'FLAG_FOR_TRAINING',
  suggestedValue: jsonb,
  status: 'PENDING' | 'APPROVED' | 'REJECTED',
}
```

**Regex Patterns:**
- family_mention (uncle, cousin, mama, etc.) → BOOST_IMPORTANCE
- dbd_gameplay → ADD_TAG
- pasta_related → ADD_TAG
- emotional_vulnerability → FLAG_FOR_TRAINING
- lore_mention → BOOST_IMPORTANCE
- technical_fact → ADD_TAG

**Active Usage:**
- ❌ **NOT CALLED** - `generateSuggestions()` is never invoked in production
- ✅ Approval endpoint exists (`routes.ts:7006`)
- ❌ No automatic generation during memory creation

**Why Disabled:**
- Designed as "shadow mode" - suggests but doesn't auto-apply
- Requires manual approval through UI
- Never wired into memory creation flow

**Effectiveness:** **ZERO** - Never generates suggestions

---

### 4. **Intelligence Engine** ❌ DISABLED
**Location:** `server/services/intelligenceEngine.ts`
**Status:** **EXPLICITLY DISABLED**

```typescript
IntelligenceEngine {
  analyzeFactClusters()       // Find duplicate/similar facts
  analyzeSourceReliability()  // Score source trustworthiness
  detectPersonalityDrift()    // Track character consistency
  scoreContextRelevance()     // Determine memory usefulness
}
```

**Active Usage:**
- ❌ **EXPLICITLY DISABLED** in `LoreOrchestrator.ts:368`:
  ```typescript
  // ⚡ OPTIMIZATION: Disabled automatic full analysis on every message to prevent perf issues
  // const contradictions = await this.intelligence.runFullIntelligenceAnalysis(storage.db, profileId);
  const contradictions = { factClusters: [] };
  ```
- ✅ Engine exists and is instantiated
- ❌ Never runs automatically
- ✅ Can be called manually via routes

**Why Disabled:**
- Performance issues - too expensive to run on every message
- Likely caused significant latency
- Comment explicitly states "perf issues"

**Effectiveness:** **ZERO** - Disabled for performance

---

## 🔍 What's Actually Working?

### ✅ Active Systems

1. **Core Memory Metadata**
   - importance, confidence, lane, type, truthDomain
   - Used on every memory creation
   - **Phase 2 Enhancement:** lane (CANON/RUMOR) now set by sauce meter

2. **Story Preservation (NEW - Phase 1-3)**
   - `type: 'STORY'` for complete narratives
   - `type: 'ATOMIC'` for extracted facts
   - `parentFactId` for hierarchical linking
   - CANON vs RUMOR lane assignment

3. **Manual Endpoints**
   - Can query content flags via API
   - Can approve suggestions via API
   - Can trigger intelligence analysis via API

### ⚠️ Built But Inactive

1. **Content Flags (aiFlagger)**
   - Service exists and is robust
   - Pattern detection for 40+ flag types
   - Never called in production flow

2. **Memory Suggestions (suggestionService)**
   - Regex-based pattern detection
   - Shadow mode design (PENDING approval)
   - Never generates suggestions automatically

3. **Intelligence Engine**
   - Comprehensive analysis capabilities
   - Clustering, reliability, drift detection
   - Disabled for performance reasons

---

## 🎯 Recommendations

### Option 1: Use Existing Tags Field + Lightweight Tagging ⭐ RECOMMENDED
**Approach:** Use what's already there, remove what doesn't work

**Keep:**
- ✅ `importance`, `confidence`, `lane`, `type`
- ✅ Story preservation (STORY/ATOMIC/parentFactId)
- ✅ CANON/RUMOR lane system
- ✅ `keywords` for search
- ✅ **`tags` field (ALREADY EXISTS, just populate it!)**

**Remove/Deprecate:**
- ❌ Content Flags system (never used)
- ❌ Memory Suggestions system (never used)
- ❌ Intelligence Engine (disabled for perf)

**Activate:**
- 🔥 **Populate `tags` field with regex patterns** - Field exists, just unused!

**Benefits:**
- **Zero schema changes** - tags field already exists!
- Simpler architecture
- Less code to maintain
- No performance overhead
- Everything in one place

**Implementation:**
```typescript
// In storage.addMemoryEntry() - before insert
const tags = [];
if (/family|uncle|cousin|mama|nonna/i.test(entry.content)) tags.push('family');
if (/dbd|dead by daylight|killer|survivor/i.test(entry.content)) tags.push('dbd');
if (/pasta|sauce|marinara|gnocchi/i.test(entry.content)) tags.push('pasta');
if (/story|uncle vinny|back in/i.test(entry.content)) tags.push('story');

entry.tags = tags;

// Auto-boost importance for family
if (tags.includes('family')) {
  entry.importance = Math.max(entry.importance || 0, 80);
}
```

---

### Option 2: Lightweight Flagging (Hybrid)
**Approach:** Keep core + add lightweight regex flagging

**Implementation:**
```typescript
// On memory creation, run lightweight regex tagging
async addMemoryEntry(entry) {
  // ... existing code ...

  // Fast regex tagging (no AI calls)
  const tags = [];
  if (/family|uncle|cousin/i.test(entry.content)) tags.push('family');
  if (/dbd|dead by daylight/i.test(entry.content)) tags.push('dbd');
  if (/pasta|sauce|marinara/i.test(entry.content)) tags.push('pasta');

  entry.tags = tags;

  // Auto-boost importance for family mentions
  if (tags.includes('family')) {
    entry.importance = Math.max(entry.importance, 80);
  }

  // Save
  await db.insert(memoryEntries).values(entry);
}
```

**Benefits:**
- Automatic tagging without AI cost
- No new tables or systems
- Fast (regex is cheap)
- Can evolve over time

**Drawbacks:**
- Less sophisticated than AI flagging
- Manual pattern maintenance

---

### Option 3: Resurrect Intelligence Engine (Async)
**Approach:** Run intelligence analysis in background, not blocking

**Implementation:**
```typescript
// In background tasks, queue intelligence analysis
async handleBackgroundTasks() {
  // ... existing tasks ...

  // Queue intelligence analysis (non-blocking)
  if (messageCount % 10 === 0) { // Every 10 messages
    queueBackgroundJob(async () => {
      await intelligenceEngine.runFullIntelligenceAnalysis(db, profileId);
    });
  }
}
```

**Benefits:**
- Get intelligence insights without blocking
- Can be run periodically (nightly, weekly)
- Useful for maintenance/cleanup

**Drawbacks:**
- Still expensive (API costs)
- Results aren't immediate
- May not be worth the cost

---

## 📋 Action Items

### Immediate (Choose One Path)

**Path A: Activate Existing Tags Field (Recommended)**
1. ✅ **No schema changes needed** - tags field already exists!
2. Implement lightweight regex tagging in `storage.addMemoryEntry()`
3. Optionally: Deprecate `contentFlags`, `memorySuggestions` tables
4. Optionally: Remove unused services (aiFlagger, suggestionService)
5. Document tagging system

**Path B: Activate Lightweight Flagging**
1. Wire up `suggestionService.generateSuggestions()` in `storage.addMemoryEntry()`
2. Remove AI-dependent patterns, keep only regex
3. Auto-approve high-confidence suggestions
4. Keep tables but simplify usage

**Path C: Do Nothing**
- Current system works fine
- Story preservation (Phase 1-3) handles narratives
- Core metadata handles everything else
- Remove unused code later

---

## 🧹 Cleanup Opportunities

### Unused Imports
- `server/storage.ts:116` - `import { aiFlagger }` (never used)
- `server/routes.ts:17` - `import { aiFlagger }` (only for manual endpoints)

### Dead Code
- `server/services/aiFlagger.ts` - Full service, never called
- `server/services/suggestionService.ts` - Full service, never called
- `server/services/intelligenceEngine.ts` - Full service, disabled

### Orphaned Tables
- `contentFlags` - Has data but not actively growing
- `memorySuggestions` - Empty or near-empty
- `flagAutoApprovals` - Related to disabled system

---

## 💡 Key Insights

1. **Simpler is Better:** Core metadata (importance, confidence, lane) works great. Complex systems sit unused.

2. **Performance Matters:** Intelligence Engine was disabled for perf. Any new system must be lightweight.

3. **AI Flagging is Expensive:** Content flags require AI calls. Not worth it for every memory.

4. **Regex is Cheap:** Pattern matching is fast. Good enough for most tagging needs.

5. **Story Preservation Works:** Phase 1-3 successfully preserves narratives. Build on this, not replace it.

6. **CANON/RUMOR is Powerful:** Sauce meter lane assignment is elegant. Expand this pattern.

---

## 🎬 Next Steps

**Decision needed:** Which path to take?

Once decided, I can:
1. Implement the chosen approach
2. Clean up unused code
3. Update documentation
4. Create migration script if needed

**Your call!**
