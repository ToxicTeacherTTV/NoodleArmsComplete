# Streaming Mode Performance Optimization

## Current Bottlenecks (Identified)

### 1. **Memory Retrieval (Biggest Impact)** ⏱️ 2-5 seconds
- Hybrid search doing 3x limit (45 candidates for 15 results)
- Semantic embedding comparisons are slow
- Knowledge gap detection adds extra processing
- **Fix:** Reduce candidate multiplier for STREAMING mode (2x instead of 3x)

### 2. **Emotion Tag Generation** ⏱️ 1-3 seconds  
- Calls AI again to generate 5-stage emotional arc
- Separate AI call adds latency
- **Fix:** Pre-generate or use faster rule-based system for streaming

### 3. **Context Building** ⏱️ 1-2 seconds
- Recent messages (8 messages)
- Lore context retrieval
- Training examples loading (50 examples)
- **Fix:** Reduce context for STREAMING mode (4 messages, skip lore, 20 examples)

### 4. **AI Generation** ⏱️ 3-8 seconds
- Gemini 2.5 Pro response time
- Long context prompts
- **Fix:** Use streaming API, reduce prompt size

### 5. **ElevenLabs TTS** ⏱️ 2-4 seconds
- Waiting for full audio generation before starting playback
- **Fix:** Use streaming TTS if available

---

## Optimization Strategy (Ordered by Impact)

### ✅ **Phase 1: Quick Wins (Implement Now)** - Save 4-8 seconds

#### 1.1: STREAMING Mode Fast Path
```typescript
// In routes.ts, add fast path for STREAMING mode
if (mode === 'STREAMING') {
  // Reduce memory retrieval
  const relevantMemories = await anthropicService.retrieveContextualMemories(
    message,
    activeProfile.id,
    conversationId,
    controls,
    mode,
    8  // ← Reduce from 15 to 8 for streaming
  );
  
  // Skip heavy operations
  const skipWebSearch = true;
  const skipLoreContext = true; // Only use for complex questions
  const trainingLimit = 15; // ← Reduce from 50 to 15
}
```

#### 1.2: Fast Emotion Tags for Streaming
```typescript
// Create rule-based emotion tagger (no AI call)
// In emotionTagGenerator.ts, add:
generateFastEmotionalArc(content: string, mood: string): EmotionalArc {
  // Use pattern matching instead of AI
  const hasQuestion = content.includes('?');
  const hasExclamation = content.includes('!');
  const contentLength = content.length;
  
  // Predefined arcs based on patterns
  if (mood === 'aggressive' || mood === 'chaotic') {
    return {
      opening: 'bronx, dismissive',
      rising: 'heated, building',
      peak: 'furious',
      falling: 'sarcastic',
      close: 'mutters'
    };
  }
  // ... more patterns
}
```

#### 1.3: Parallel Operations
```typescript
// In routes.ts, run independent operations in parallel
const [relevantMemories, trainingExamples] = await Promise.all([
  anthropicService.retrieveContextualMemories(...),
  storage.getTrainingExamples(activeProfile.id, 15)
]);
```

#### 1.4: Reduce Memory Candidate Multiplier
```typescript
// In anthropic.ts retrieveContextualMemories:
const candidateLimit = mode === 'STREAMING' ? limit * 2 : limit * 3;
// 16 candidates instead of 45 for streaming
```

---

### 🚀 **Phase 2: AI Streaming (Advanced)** - Save 2-4 seconds

#### 2.1: Use Gemini Streaming API
```typescript
// Stream tokens as they're generated
async generateStreamingResponse(...): AsyncGenerator<string> {
  const stream = await this.ai.models.generateContentStream({
    model: 'gemini-2.5-pro',
    contents: [{ parts: [{ text: prompt }] }]
  });
  
  for await (const chunk of stream) {
    yield chunk.text;
  }
}
```

#### 2.2: Send Audio in Chunks
```typescript
// Send to ElevenLabs as text is generated
// Start playback sooner (perceived faster response)
for await (const chunk of aiStream) {
  processedText += chunk;
  
  // When we have a complete sentence, send to TTS
  if (chunk.includes('.') || chunk.includes('!') || chunk.includes('?')) {
    await sendToElevenLabs(processedText);
    processedText = '';
  }
}
```

---

### 🔧 **Phase 3: Infrastructure (Long-term)** - Save 3-6 seconds

#### 3.1: Cache Common Responses
```typescript
// Cache frequently asked questions
const cacheKey = `streaming:${message.toLowerCase().trim()}`;
const cached = await redis.get(cacheKey);
if (cached && Date.now() - cached.timestamp < 3600000) {
  return cached.response;
}
```

#### 3.2: Pre-warm Memory Embeddings
```typescript
// Keep recent memories in memory (RAM)
// Avoid DB queries for every request
```

#### 3.3: Use Faster Model for Streaming
```typescript
// Gemini Flash 2.0 is 10x faster
// Use for streaming, Gemini Pro for podcasts
if (mode === 'STREAMING') {
  model = 'gemini-2.0-flash';
}
```

---

## Expected Performance Gains

| Optimization | Current | After | Savings |
|-------------|---------|-------|---------|
| Memory Retrieval | 3-5s | 1-2s | **2-3s** |
| Emotion Tags | 1-3s | 0.1s | **1-3s** |
| Context Building | 1-2s | 0.5s | **0.5-1.5s** |
| AI Generation | 4-8s | 2-4s | **2-4s** |
| **TOTAL** | **9-18s** | **4-8s** | **🎯 5-10s faster** |

---

## Implementation Priority

1. ✅ **Phase 1.1-1.4** (30 mins) - Immediate 4-8s improvement
2. 🚀 **Phase 2.1-2.2** (2-3 hours) - Streaming API integration
3. 🔧 **Phase 3** (future sprint) - Infrastructure improvements

---

## Code Changes Required

### File: `server/routes.ts`
- Add STREAMING mode detection
- Reduce limits for streaming
- Parallelize independent operations
- Skip web search/lore for simple queries

### File: `server/services/anthropic.ts`
- Add candidateLimit modifier based on mode
- Reduce context for STREAMING

### File: `server/services/emotionTagGenerator.ts`
- Add `generateFastEmotionalArc()` method
- Use pattern matching instead of AI

### File: `server/services/gemini.ts` (Phase 2)
- Add streaming response method
- Handle chunked text generation

---

## Testing Plan

1. Time current flow with console.time()
2. Implement Phase 1 optimizations
3. Measure improvement
4. A/B test response quality (ensure no degradation)
5. Implement Phase 2 if quality is maintained
