# Memory Corruption Incident Report

**Date:** October 14, 2025  
**Severity:** CRITICAL  
**Status:** IDENTIFIED & MITIGATED

---

## 🚨 Executive Summary

The entire memory system (1,505 memories) was built using **Gemini 2.5 Flash**, which multi-model testing revealed to be completely unreliable for fact extraction and reasoning tasks. This resulted in hallucinated facts, missing critical information (e.g., SABAM roster), and incorrect importance scoring.

---

## 📊 Impact Analysis

### Memory Creation Timeline
- **Oct 3-11, 2025**: All memories created during "Flash era"
- **Total Affected**: 1,505 memories across 35+ source documents
- **Key Documents Corrupted**:
  - `nickyalldocs-301-600.pdf` (346 memories)
  - `denteverse_bible_chatgpt_2025-06-30.pdf` (236 memories)
  - `nickyalldocs-2-300.pdf` (198 memories)
  - SABAM roster, character profiles, lore documents (all affected)

### Confirmed Issues
1. **Missing Core Facts**: Nicky doesn't "know" SABAM members exist despite 50+ related documents
2. **Hallucinated Information**: Flash invents facts not present in source material
3. **Wrong Importance Scores**: Critical facts scored low, trivial facts scored high
4. **Poor Keyword Extraction**: Semantic gaps prevent proper memory retrieval

---

## 🧪 Model Testing Results

### Gemini 2.5 Flash (BANNED)
- ❌ Math question: Paranoid rant instead of answer
- ❌ Killer advice: Wrong answer (Ghostface for beginners - actually high skill cap)
- ❌ Weather query: Conspiracy theory nonsense
- ❌ Fact extraction: Invents information, misses critical details
- **Verdict: UNUSABLE - Delete from codebase**

### Gemini 2.5 Pro (FREE, APPROVED)
- ✅ Answers questions accurately
- ✅ Gives proper advice (Trapper/Wraith for beginners)
- ✅ Creative but coherent responses
- ✅ Good enough for fact extraction
- **Verdict: Use for document processing and background tasks**

### Claude Sonnet 4.5 (PAID, PRIMARY)
- ✅ Perfect personality adherence
- ✅ Highest quality responses
- ✅ Best reasoning and context awareness
- **Verdict: Use for all user-facing conversations**

---

## 🔧 Immediate Fixes Applied

### 1. Banned Flash from Fallback (Oct 14, 2025)
```typescript
// server/services/gemini.ts Line 536
const models = ["gemini-2.5-pro"]; // ❌ NEVER USE FLASH
```

### 2. Enhanced Credit Exhaustion Warnings
```typescript
// server/services/anthropic.ts Line 1039-1045
console.error(`🚨 ANTHROPIC CREDITS EXHAUSTED - FALLING BACK TO GEMINI PRO`);
console.error(`   ⚠️  WARNING: This fallback uses Gemini Pro (NOT Flash)`);
```

### 3. Document Processing Already Fixed
- ✅ `extractStoriesFromDocument()` uses Pro
- ✅ `extractAtomicFactsFromStory()` uses Pro
- ✅ `extractFactsFromDocument()` uses Pro
- ✅ All consolidation/deduplication uses Pro

### 4. Short-term Workaround: Bridging Memory
Created protected fact (importance 999) linking semantic concepts:
```
"SABAM members are Nicky's chosen family - the crew includes Uncle Gnocchi, 
Mama Marinara, Marco 'The Mouse' Pepperoni, Bruno 'The Basement' Bolognese, 
Sofia 'Speed Run' Spaghetti, The Ravioli Twins, The Fettuccine Five, and Big Ziti"

Keywords: ['family', 'SABAM', 'members', 'organization', 'gaming', 'crew']
```

---

## 📋 Reprocessing Plan (RECOMMENDED)

### Option A: Nuclear (Start Fresh)
1. **Backup**: `CREATE TABLE memory_entries_backup_flash AS SELECT * FROM memory_entries`
2. **Delete All**: `DELETE FROM memory_entries WHERE profile_id = 'nicky-id'`
3. **Re-upload Documents**: Use Gemini Pro to reprocess all 35+ documents
4. **Verify Quality**: Check importance scores, keywords, fact accuracy

**Pros:**
- ✅ Clean slate with reliable model
- ✅ Consistent quality across all memories
- ✅ Proper importance scoring

**Cons:**
- ⚠️ Time intensive (35+ documents to reprocess)
- ⚠️ May lose some manually added memories
- ⚠️ Requires careful document re-upload

### Option B: Surgical (Keep Manual, Replace Auto)
1. **Backup**: Same as above
2. **Delete Only Document Memories**: 
```sql
DELETE FROM memory_entries 
WHERE profile_id = 'nicky-id'
  AND created_at >= '2025-10-03'  -- Flash era start
  AND source LIKE '%.pdf'         -- Document sources only
```
3. **Re-upload Core Documents**: Focus on SABAM, character profiles, lore
4. **Verify**: Check that manual/system memories preserved

**Pros:**
- ✅ Preserves manual entries
- ✅ Faster than nuclear option
- ✅ Less risk of data loss

**Cons:**
- ⚠️ May leave some Flash corruption
- ⚠️ Need to identify which memories are "safe"

### Option C: Gradual (Live with Workarounds)
1. **Keep Current Memories**: Accept some corruption
2. **Add Bridging Facts**: Manually create high-importance facts for critical gaps
3. **Implement Vector Embeddings**: Use semantic search to work around keyword gaps
4. **Reprocess New Documents Only**: Use Pro for all future uploads

**Pros:**
- ✅ No disruption to current system
- ✅ Gradual quality improvement
- ✅ Learning opportunity

**Cons:**
- ⚠️ Corruption remains in knowledge base
- ⚠️ May surface incorrect facts in conversations
- ⚠️ Requires ongoing manual fixes

---

## 🎯 Recommended Strategy

**HYBRID APPROACH:**
1. **Immediate** (Done):
   - ✅ Ban Flash from all code paths
   - ✅ Add prominent credit warnings
   - ✅ Create bridging memory for SABAM

2. **Short Term** (This Week):
   - Implement vector embeddings for semantic search (schema ready)
   - Reprocess 5-10 most critical documents with Pro
   - Add more bridging facts for known gaps

3. **Medium Term** (Next 2 Weeks):
   - Gradual reprocessing of all documents during low-usage periods
   - Build document quality validation system
   - Create "memory health check" dashboard

4. **Long Term** (Next Month):
   - Full vector embedding implementation
   - Automated duplicate/contradiction detection
   - Memory confidence scoring system

---

## 🛡️ Prevention Measures

### Model Selection Rules
```
✅ Conversations/Responses → Claude Sonnet 4.5 (expensive, best)
✅ Document Processing → Gemini Pro (free, reliable)
✅ Memory Consolidation → Gemini Pro (free, reliable)
❌ Nothing Ever → Gemini Flash (banned, unreliable)
```

### Code Enforcement
- Flash model name removed from all service files
- Fallback explicitly uses Pro only
- Document processing hardcoded to Pro
- Clear comments marking Flash as banned

### Monitoring
- Prometheus metrics track model usage
- Console warnings on credit exhaustion
- Log which model generates each memory (future enhancement)

---

## 📝 Lessons Learned

1. **Test Models Thoroughly**: Multi-model testing revealed Flash's unreliability
2. **Track Model Metadata**: Should store which model created each memory
3. **Validate Quality**: Need automated checks for fact accuracy
4. **Budget Monitoring**: Add alerts before credit exhaustion
5. **Semantic Search Needed**: Keyword-only retrieval has fundamental limits

---

## 🔗 Related Documentation

- `PERSONALITY_FIX_GUIDE.md` - Multi-model testing results
- `PROJECT_ROADMAP.md` - Vector embeddings implementation plan
- `replit.md` - Updated architecture with model allocation strategy

---

**Last Updated:** October 14, 2025  
**Next Review:** October 21, 2025 (after initial reprocessing)
