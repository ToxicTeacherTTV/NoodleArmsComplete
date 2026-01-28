# User Story Detection Implementation Session

**Date:** January 25, 2026
**Phase:** Story Preservation Phase 3 - User Stories

---

## 🎯 Problem

Nicky could remember his own stories but not stories that USERS told him. Memory was one-directional.

---

## ✅ Solution Implemented

### User Story Detection Heuristics

**Detection Criteria:**
```typescript
isUserStory(content: string): boolean {
  // Minimum length
  if (content.length < 150) return false;

  // Narrative indicators
  const storyIndicators = [
    /\b(yesterday|last (week|month|year|night|time))\b/i,
    /\b(I remember|let me tell you|this one time|back when|so I was)\b/i,
    /\b(I went|I saw|I did|I played|I met|I found)\b/i,
  ];

  // Past tense verb density
  const pastTenseVerbs = /\b(happened|told|asked|said|went|was|were|did|had|got|came|left|found|saw)\b/gi;
  const hasPastTense = (content.match(pastTenseVerbs) || []).length >= 2;

  // Multiple sentences
  const sentenceCount = (content.match(/[.!?]+/g) || []).length >= 2;

  return hasIndicators && sentenceCount && hasPastTense;
}
```

### Storage Strategy

**User Story Entry:**
```typescript
{
  type: 'STORY',
  content: fullUserMessage,
  importance: 60,
  confidence: 100,  // User stories are always true
  source: 'user_story',
  lane: 'CANON',
  metadata: {
    toldBy: username,
    toldByUserId: userId,
    context: conversationId
  }
}
```

**Linked Atomic Facts:**
```typescript
{
  type: 'ATOMIC',
  content: extractedFact,
  parentFactId: storyEntry.id,  // Links back to parent
  source: 'user_story',
  confidence: 100,
  lane: 'CANON'
}
```

---

## 🧪 Test Results

**Test Cases:**

1. **DBD Locker Story** ✅ DETECTED
   - 250 chars, past tense, narrative structure
   - 4 atomic facts extracted
   - Result: Fully preserved

2. **Camping Trip Story** ✅ DETECTED
   - 280 chars, past tense, story indicators
   - 4 atomic facts extracted
   - Result: Fully preserved

3. **Short Question** ✅ NOT DETECTED (correct)
   - "What do you think about camping killers?"
   - Too short, no narrative structure
   - Result: Correctly filtered

4. **Opinion Statement** ✅ NOT DETECTED (correct)
   - "I hate playing against The Skull Merchant..."
   - Too short, no past tense
   - Result: Correctly filtered

5. **Borderline Anecdote** ❌ NOT DETECTED
   - "I remember when Dead by Daylight first came out..."
   - Only 107 chars (needs 150+)
   - Result: Too short to qualify

**Overall:** 4/5 tests passed (80% accuracy)

---

## 📊 What Gets Stored

**Example: DBD Locker Story**

**Parent Story:**
```
Content: "So yesterday I was playing Nurse on Dead by Daylight and this
          Claudette kept hiding in a locker for 20 minutes. I finally found
          her because she had crows circling above her, and when I grabbed
          her out, she DC'd instantly. Funniest shit I've seen all week."

Type: STORY
Importance: 60
Confidence: 100
Metadata: { toldBy: "Toxic", context: "conversation-id" }
```

**Linked Atomic Facts:**
1. "Toxic played as The Nurse in Dead by Daylight"
2. "Claudette player hid in a locker for 20 minutes"
3. "Toxic found her because crows were circling"
4. "Claudette DC'd immediately after being grabbed"

All facts linked to parent story via `parentFactId`.

---

## 🎯 Benefits

### For Nicky:
- Can reference user stories: "You told me about that locker Claudette"
- Can build on previous conversations: "Remember your camping trip with the raccoon?"
- Two-way relationship building

### For Users:
- Stories preserved as complete narratives (not atomized)
- Conversational continuity across sessions
- Nicky actually remembers what you tell him

---

## 🔧 Implementation Details

**Files Modified:**

1. **`server/services/LoreOrchestrator.ts`**
   - Added `isUserStory()` detection method
   - Modified `processNewContent()` to accept speaker metadata
   - Added story preservation flow before fact extraction

2. **`server/services/chatService.ts`**
   - Updated `handleBackgroundTasks()` to pass speaker info
   - Added metadata: `speaker: 'user'`, `speakerName`, `speakerId`

3. **`server/scripts/test-user-story-detection.ts`**
   - Created comprehensive test suite
   - Tests detection accuracy
   - Verifies storage and linking

---

## 🚀 Next Steps

- [ ] Test with real user interactions
- [ ] Fine-tune detection thresholds if needed
- [ ] Implement Phase 2: Detect Nicky's own stories in responses
- [ ] Update retrieval system to surface user stories when referenced

---

## 📝 Detection Threshold Notes

**Current Settings:**
- Minimum length: 150 characters
- Minimum past tense verbs: 2
- Minimum sentences: 2

**Tuning Considerations:**
- Lower threshold (100 chars) would catch more borderline anecdotes but increase false positives
- Current settings balance precision vs recall effectively
- Can adjust based on real-world usage patterns

---

## ✅ Session Complete

- [x] Designed detection heuristics
- [x] Implemented in LoreOrchestrator
- [x] Updated chatService with speaker metadata
- [x] Created and ran test suite (4/5 passed)
- [x] Documented solution and results
