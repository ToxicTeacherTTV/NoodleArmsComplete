# Story Preservation Implementation Session

**Date:** January 24, 2026
**Focus:** Fix memory atomization - preserve complete narratives instead of just extracting facts

---

## 🎯 Problem Identified

Nicky's stories were being atomized immediately upon extraction, losing narrative structure and preventing him from referencing past stories.

### Current State Analysis

**What was happening:**

| Content Source | Treatment | Stories Preserved? |
|---|---|---|
| **Uploaded Documents** (PDF/DOCX) | ✅ `extractStoriesFromDocument()` → type: 'STORY' | **YES** |
| **Podcast Transcripts** | ❌ `extractFactsFromChunk()` → type: 'FACT' | **NO** |
| **Live Conversations** (chat/Discord/stream) | ❌ `distillTextToFact()` → type: 'FACT' | **NO** |

**Example of the problem:**

When Nicky told a story about Uncle Vinny's poker game, it became:
- ❌ "Vinny exists" + "Poker game happened" + "Newark mentioned" (disconnected facts)

Instead of:
- ✅ Complete narrative: "Uncle Vinny ran a poker game at Sal's Pizzeria in 1987 where Tony 'The Trap' Benedetti tried to hustle with loaded dice, but Vinny caught him and banned him from every game in a five-block radius"

---

## ✅ Solution Implemented

### Phase 1: Podcast Transcript Processing (COMPLETED)

**File Modified:** `server/services/podcastFactExtractor.ts`

**Changes:**
1. **Story Extraction First** - Added `extractStoriesFromDocument()` call before fact extraction
2. **Hierarchical Storage** - Stories stored as type: 'STORY' with full narrative content
3. **Atomic Fact Linking** - Facts extracted FROM stories and linked via `parentFactId`
4. **Metadata Facts** - Episode title/guest stored separately as type: 'FACT'

**New Flow:**
```
Transcript → Extract Stories (preserves narratives)
              ↓
         Store as type: 'STORY'
              ↓
         Extract Atomic Facts FROM each story
              ↓
         Link facts to parent via parentFactId
```

**Test Results:**
- ✅ 5 stories preserved with full narrative content
- ✅ 13 atomic facts extracted and linked
- ✅ 8 entities extracted (Uncle Vinny, Tony Benedetti, Sal's Pizzeria, etc.)
- ✅ Deduplication working (95% similarity threshold prevented exact duplicates)

**Example Output:**
```
Story: "Nicky shares a story about his Uncle Vinny running a poker game
       out of Sal's Pizzeria in Newark in 1987, where he caught Tony
       'The Trap' Benedetti using loaded dice..."

Linked Atomic Facts:
1. "Nicky has an Uncle Vinny who ran a poker game in 1987"
2. "Tony 'The Trap' Benedetti was caught using loaded dice"
3. "Uncle Vinny's poker game was at Sal's Pizzeria in Newark"
```

---

## 📊 Memory Structure

### Type Hierarchy

```
type: 'STORY'          ← Complete narratives (preserved)
  ├─ type: 'ATOMIC'    ← Searchable facts (linked via parentFactId)
  └─ type: 'ATOMIC'

type: 'FACT'           ← Standalone facts (metadata, etc.)
type: 'LORE'           ← Background/world-building
type: 'CONTEXT'        ← Contextual information
```

### Schema Fields Used

```typescript
memoryEntry {
  type: 'STORY' | 'FACT' | 'ATOMIC' | 'LORE' | 'CONTEXT'
  content: string           // Full narrative for STORY, extracted fact for ATOMIC
  isAtomicFact: boolean     // true for ATOMIC, false for STORY
  parentFactId: string      // Links ATOMIC facts back to parent STORY
  lane: 'CANON' | 'RUMOR'   // Reliability marker
  truthDomain: string       // Source domain (PODCAST, etc.)
}
```

---

## 🔮 Future Work

### Phase 2: Live Conversation Processing (✅ COMPLETE - Jan 25, 2026)

**See:** `NICKY_STORY_DETECTION_SESSION.md` for full implementation details

**What was implemented:**
- Story detection for Nicky's responses (`isNickyStory()` method)
- CANON vs RUMOR lane assignment based on sauce meter
- Atomic fact extraction and linking to parent stories
- Full test suite with 4 test cases

**Target File:** `server/services/LoreOrchestrator.ts` (lines 76-103, 196-276)

**Current behavior:**
```typescript
// OLD - Immediate atomization
const { fact, importance } = await geminiService.distillTextToFact(content);
await storage.addMemoryEntry({ type: 'FACT', content: fact });
```

**Proposed fix:**
```typescript
// NEW - Story detection
const isStory = content.length > 200 && /story|remember when|back in|one time/i.test(content);

if (isStory) {
  // Extract stories first
  const stories = await aiOrchestrator.extractStoriesFromDocument(content, ...);

  // Store each story
  for (const story of stories) {
    const storyEntry = await storage.addMemoryEntry({
      type: 'STORY',
      content: story.content,  // Full narrative
      isAtomicFact: false,
      lane: sauceMeter > 70 ? 'RUMOR' : 'CANON'  // High heat = bullshit
    });

    // Extract atomic facts FROM the story
    const { facts } = await aiOrchestrator.extractAtomicFactsFromStory(story.content);
    for (const fact of facts) {
      await storage.addMemoryEntry({
        type: 'ATOMIC',
        parentFactId: storyEntry.id,  // Link to parent
        ...
      });
    }
  }
}
```

**Benefits:**
- Nicky's live stream stories preserved
- Discord chat stories preserved
- Can reference past conversations: "Like I told you before..."

---

### Phase 3: User Story Detection (PENDING)

**Goal:** Detect and preserve stories that USERS tell Nicky

**Implementation approach:**

1. **Detection in User Messages**
   - Check message length (>200 chars)
   - Look for narrative indicators: "So yesterday...", "I remember when...", "Let me tell you about..."
   - Detect story structure (setup → events → conclusion)

2. **Storage Strategy**
   ```typescript
   {
     type: 'STORY',
     content: userMessage,
     source: 'user_story',
     sourceId: userId,
     lane: 'CANON',  // User stories are canon
     metadata: {
       toldBy: username,
       context: conversationId
     }
   }
   ```

3. **Retrieval Enhancement**
   - When user references a past story, search for it
   - "Remember when I told you about..." should pull up their past story
   - Nicky can reference it: "Yeah, you told me about that time you..."

**Benefits:**
- Two-way memory - Nicky remembers what you tell him
- More natural conversations
- Builds relationship continuity

---

## 🧪 Testing

**Test Script:** `server/scripts/test-podcast-story-extraction.ts`

**Sample Transcript Used:**
- Conversation between Toxic and Nicky about Dead by Daylight killers
- Contains 2 complete stories (Uncle Vinny poker game, The Trapper comparison)
- ~500 words

**Verification:**
```bash
cd server
DATABASE_URL="..." GEMINI_API_KEY="..." npx tsx scripts/test-podcast-story-extraction.ts
```

**Success Metrics:**
- ✅ Stories extracted and stored with full content
- ✅ Atomic facts linked to parent stories
- ✅ Entities created and linked
- ✅ Deduplication working correctly
- ✅ Test cleanup successful (no data left behind)

---

## 📝 Migration Path for Existing Data

**For Podcast Transcripts:**

Users can reprocess old episodes via the UI:
1. Navigate to Podcast Management panel
2. Find episode that already has facts extracted
3. Click "Extract Facts" again
4. New flow will:
   - Extract stories (if any exist in transcript)
   - Link new atomic facts to stories
   - Deduplicate against existing facts (90% threshold)

**Note:** Old atomized facts will remain. They won't be deleted automatically to prevent data loss.

**Recommendation:**
- Reprocess 5-10 most important episodes with best stories
- Review results before processing more
- Use Intelligence Dashboard to review and merge any duplicates

---

## 📚 Related Documentation

- **Architecture:** `MASTER_ARCHITECTURE.md` - Memory system overview
- **Schema:** `shared/schema.ts` - Database structure (lines 129-162 for memory_entries)
- **Document Processing:** `server/services/documentProcessor.ts` - Story extraction reference implementation
- **Context Building:** `server/services/contextBuilder.ts` - How stories are retrieved for context

---

## 🎓 Key Learnings

1. **Story vs Fact Distinction:** Stories are narrative units that contain multiple facts. Both need to exist - stories for context/reference, facts for search.

2. **Hierarchical Memory:** `parentFactId` creates a tree structure that preserves relationships while enabling granular search.

3. **Lane Awareness:** High-heat stories should be marked RUMOR automatically - they're performative bullshit, not canon.

4. **Deduplication is Critical:** 90% similarity threshold prevents story/fact explosion while allowing minor variations.

5. **User Stories Matter:** The system should be bidirectional - Nicky should remember what users tell him, not just what he says.

---

## ✅ Session Checklist

- [x] Analyzed current memory atomization problem
- [x] Identified which content sources preserve stories vs atomize
- [x] Fixed podcast extractor to preserve stories
- [x] Created test script to verify story extraction
- [x] Ran test successfully (5 stories, 13 facts, 8 entities)
- [x] Documented solution and future work
- [x] **Implemented user story detection (Phase 3)** ✅ Jan 25, 2026 - See USER_STORY_DETECTION_SESSION.md
- [x] **Fix conversation handler for Nicky's stories (Phase 2)** ✅ Jan 25, 2026 - See NICKY_STORY_DETECTION_SESSION.md
- [ ] Test all changes with real usage
- [ ] Update retrieval system to prioritize story references (Phase 4)
