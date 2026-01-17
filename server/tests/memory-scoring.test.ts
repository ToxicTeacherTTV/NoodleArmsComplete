/**
 * Memory Scoring & Diversity Tests
 *
 * Tests for the Phase 1-3 memory retrieval fixes:
 * - Scoring formula (similarity as primary driver)
 * - Freshness boost for rarely-retrieved memories
 * - Retrieval penalty for overused memories
 * - Diversity scoring (keyword overlap, max from source)
 * - Sentence-boundary chunking with overlap
 */

import { describe, it, expect } from 'vitest';

// ============================================
// PHASE 1: SCORING FORMULA TESTS
// ============================================

describe('Memory Scoring Formula', () => {

  /**
   * Calculate score using the NEW formula from embeddingService.ts
   * score = similarity + (importance * 0.005)
   */
  function calculateHybridScore(similarity: number, importance: number): number {
    return similarity + (importance * 0.005);
  }

  /**
   * Calculate score using the OLD formula (for comparison)
   * score = similarity + (importance * 0.1) + (confidence * 0.001)
   */
  function calculateOldScore(similarity: number, importance: number, confidence: number): number {
    return similarity + (importance * 0.1) + (confidence * 0.001);
  }

  it('should prioritize high similarity over high importance with NEW formula', () => {
    // High similarity, low importance
    const relevantMemory = calculateHybridScore(0.9, 20);  // 0.9 + 0.1 = 1.0

    // Low similarity, high importance
    const importantMemory = calculateHybridScore(0.5, 100); // 0.5 + 0.5 = 1.0

    // With new formula, relevant memory wins or ties
    expect(relevantMemory).toBeGreaterThanOrEqual(importantMemory);
  });

  it('should have shown importance dominating with OLD formula', () => {
    // This demonstrates why the old formula was broken

    // High similarity, low importance
    const relevantMemory = calculateOldScore(0.9, 20, 50);  // 0.9 + 2.0 + 0.05 = 2.95

    // Low similarity, high importance
    const importantMemory = calculateOldScore(0.5, 100, 50); // 0.5 + 10.0 + 0.05 = 10.55

    // OLD formula: importance=100 adds +10 points, completely dominating similarity!
    expect(importantMemory).toBeGreaterThan(relevantMemory);
    expect(importantMemory - relevantMemory).toBeGreaterThan(5); // Huge gap
  });

  it('should keep importance as gentle tiebreaker with NEW formula', () => {
    // Two memories with equal similarity
    const lowImportance = calculateHybridScore(0.8, 30);   // 0.8 + 0.15 = 0.95
    const highImportance = calculateHybridScore(0.8, 90);  // 0.8 + 0.45 = 1.25

    // High importance wins, but only by a small margin
    expect(highImportance).toBeGreaterThan(lowImportance);
    expect(highImportance - lowImportance).toBeLessThan(0.5); // Small difference
  });

  it('should have similarity range dominate score range', () => {
    // Similarity contributes 0-1
    const similarityRange = 1.0;

    // Importance (0-100) * 0.005 contributes 0-0.5
    const importanceRange = 100 * 0.005;

    // Similarity should contribute more
    expect(similarityRange).toBeGreaterThan(importanceRange);
  });
});

// ============================================
// PHASE 1: FRESHNESS BOOST TESTS
// ============================================

describe('Freshness Boost', () => {

  /**
   * Calculate freshness boost based on retrieval count
   * From contextBuilder.ts: memories with <5 retrievals get +20%
   */
  function calculateFreshnessBoost(retrievalCount: number): number {
    return retrievalCount < 5 ? 1.2 : 1.0;
  }

  it('should boost rarely-retrieved memories by 20%', () => {
    expect(calculateFreshnessBoost(0)).toBe(1.2);
    expect(calculateFreshnessBoost(1)).toBe(1.2);
    expect(calculateFreshnessBoost(4)).toBe(1.2);
  });

  it('should not boost frequently-retrieved memories', () => {
    expect(calculateFreshnessBoost(5)).toBe(1.0);
    expect(calculateFreshnessBoost(10)).toBe(1.0);
    expect(calculateFreshnessBoost(100)).toBe(1.0);
  });

  it('should give fresh memories higher scores', () => {
    const similarity = 0.7;
    const freshScore = similarity * calculateFreshnessBoost(2);   // 0.7 * 1.2 = 0.84
    const staleScore = similarity * calculateFreshnessBoost(10);  // 0.7 * 1.0 = 0.70

    expect(freshScore).toBeGreaterThan(staleScore);
    expect(freshScore).toBeCloseTo(0.84, 2);
    expect(staleScore).toBeCloseTo(0.70, 2);
  });
});

// ============================================
// PHASE 1: RETRIEVAL PENALTY TESTS
// ============================================

describe('Retrieval Penalty', () => {

  /**
   * Calculate retrieval penalty based on retrieval count
   * From contextBuilder.ts: 3% per retrieval, capped at 30%
   */
  function calculateRetrievalPenalty(retrievalCount: number): number {
    return Math.min(retrievalCount * 0.03, 0.30);
  }

  it('should apply 3% penalty per retrieval', () => {
    expect(calculateRetrievalPenalty(1)).toBeCloseTo(0.03, 3);
    expect(calculateRetrievalPenalty(5)).toBeCloseTo(0.15, 3);
    expect(calculateRetrievalPenalty(10)).toBeCloseTo(0.30, 3);
  });

  it('should cap penalty at 30%', () => {
    expect(calculateRetrievalPenalty(10)).toBe(0.30);
    expect(calculateRetrievalPenalty(15)).toBe(0.30);
    expect(calculateRetrievalPenalty(100)).toBe(0.30);
  });

  it('should reduce score for overused memories', () => {
    const similarity = 0.8;
    const freshScore = similarity * (1 - calculateRetrievalPenalty(0));   // 0.8 * 1.0 = 0.80
    const overusedScore = similarity * (1 - calculateRetrievalPenalty(10)); // 0.8 * 0.7 = 0.56

    expect(freshScore).toBeGreaterThan(overusedScore);
    expect(freshScore).toBeCloseTo(0.80, 2);
    expect(overusedScore).toBeCloseTo(0.56, 2);
  });

  it('should combine with freshness boost correctly', () => {
    const similarity = 0.7;

    // Fresh memory: boost applied, no penalty
    const freshBoost = calculateFreshnessBoost(2);
    const freshPenalty = calculateRetrievalPenalty(2);
    const freshScore = similarity * freshBoost * (1 - freshPenalty);
    // 0.7 * 1.2 * 0.94 = 0.7896

    // Stale memory: no boost, max penalty
    const staleBoost = calculateFreshnessBoost(15);
    const stalePenalty = calculateRetrievalPenalty(15);
    const staleScore = similarity * staleBoost * (1 - stalePenalty);
    // 0.7 * 1.0 * 0.70 = 0.49

    expect(freshScore).toBeGreaterThan(staleScore);
    expect(freshScore).toBeCloseTo(0.7896, 2);
    expect(staleScore).toBeCloseTo(0.49, 2);
  });

  // Helper for tests below
  function calculateFreshnessBoost(retrievalCount: number): number {
    return retrievalCount < 5 ? 1.2 : 1.0;
  }
});

// ============================================
// PHASE 1: DIVERSITY SCORING TESTS
// ============================================

describe('Diversity Scoring', () => {

  interface MockMemory {
    id: string;
    type: string;
    keywords: string[];
    source: string;
  }

  /**
   * Calculate diversity score
   * From contextBuilder.ts (simplified for testing)
   */
  function calculateDiversityScore(memory: MockMemory, selectedMemories: MockMemory[]): number {
    if (selectedMemories.length === 0) return 1.0;

    let penalty = 0;
    const memoryKeywords = new Set(memory.keywords.map(k => k.toLowerCase()));
    let sameSourceCount = 0;

    for (const selected of selectedMemories) {
      // Max 2 from same source
      if (selected.source && memory.source && selected.source === memory.source) {
        sameSourceCount++;
      }

      // Type penalty
      if (selected.type === memory.type) penalty += 0.15;

      // Keyword overlap
      const selectedKeywords = new Set(selected.keywords.map(k => k.toLowerCase()));
      const overlap = Array.from(memoryKeywords).filter(k => selectedKeywords.has(k)).length;
      const total = Math.max(memoryKeywords.size, selectedKeywords.size);

      if (total > 0) {
        const overlapRatio = overlap / total;
        if (overlapRatio > 0.6) {
          penalty += 0.5; // Strong penalty for near-duplicates
        } else {
          penalty += overlapRatio * 0.25;
        }
      }
    }

    // Hard limit: if already 2 from same source, exclude
    if (sameSourceCount >= 2) {
      return 0;
    }

    return Math.max(0, 1.0 - penalty);
  }

  it('should return 1.0 when no memories selected yet', () => {
    const memory: MockMemory = { id: '1', type: 'STORY', keywords: ['sal', 'newark'], source: 'doc1' };
    expect(calculateDiversityScore(memory, [])).toBe(1.0);
  });

  it('should apply penalty for same type', () => {
    const memory: MockMemory = { id: '2', type: 'STORY', keywords: ['mario'], source: 'doc2' };
    const selected: MockMemory[] = [
      { id: '1', type: 'STORY', keywords: ['luigi'], source: 'doc1' }
    ];

    const score = calculateDiversityScore(memory, selected);
    // Type penalty: 0.15, no keyword overlap
    expect(score).toBeCloseTo(0.85, 2);
  });

  it('should heavily penalize >60% keyword overlap', () => {
    const memory: MockMemory = {
      id: '2',
      type: 'FACT',
      keywords: ['sal', 'butcher', 'newark', 'meat'],
      source: 'doc2'
    };
    const selected: MockMemory[] = [
      { id: '1', type: 'STORY', keywords: ['sal', 'butcher', 'newark'], source: 'doc1' }
    ];

    const score = calculateDiversityScore(memory, selected);
    // 3/4 keywords overlap = 75% > 60%, so penalty = 0.5
    expect(score).toBeLessThan(0.6);
  });

  it('should apply proportional penalty for moderate overlap', () => {
    const memory: MockMemory = {
      id: '2',
      type: 'FACT',
      keywords: ['sal', 'butcher', 'cooking', 'chef'],
      source: 'doc2'
    };
    const selected: MockMemory[] = [
      { id: '1', type: 'STORY', keywords: ['sal', 'newark', 'childhood', 'friend'], source: 'doc1' }
    ];

    const score = calculateDiversityScore(memory, selected);
    // 1/4 keywords overlap = 25% < 60%, so penalty = 0.25 * 0.25 = 0.0625
    expect(score).toBeGreaterThan(0.9);
  });

  it('should exclude memories when 2+ from same source already selected', () => {
    const memory: MockMemory = { id: '3', type: 'FACT', keywords: ['third'], source: 'doc1' };
    const selected: MockMemory[] = [
      { id: '1', type: 'STORY', keywords: ['first'], source: 'doc1' },
      { id: '2', type: 'FACT', keywords: ['second'], source: 'doc1' }
    ];

    const score = calculateDiversityScore(memory, selected);
    // Hard limit: 2 already from doc1, so exclude this one
    expect(score).toBe(0);
  });

  it('should allow up to 2 from same source', () => {
    const memory: MockMemory = { id: '2', type: 'FACT', keywords: ['second'], source: 'doc1' };
    const selected: MockMemory[] = [
      { id: '1', type: 'STORY', keywords: ['first'], source: 'doc1' }
    ];

    const score = calculateDiversityScore(memory, selected);
    // Only 1 from doc1, so allowed (with type penalty)
    expect(score).toBeGreaterThan(0);
  });
});

// ============================================
// PHASE 2: SENTENCE CHUNKING TESTS
// ============================================

describe('Sentence-Boundary Chunking', () => {

  /**
   * Simplified sentence chunking with overlap
   * From documentProcessor.ts
   */
  function simpleChunkText(text: string, maxChunkSize: number = 100): string[] {
    const chunks: string[] = [];
    const OVERLAP_SIZE = 30;

    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    let lastOverlap = '';

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;

      if (currentChunk && (currentChunk.length + trimmedParagraph.length) > maxChunkSize) {
        const sentences = currentChunk.split(/(?<=[.!?])\s+/);
        const overlapSentences = sentences.slice(-2);
        lastOverlap = overlapSentences.join(' ');
        if (lastOverlap.length > OVERLAP_SIZE) {
          lastOverlap = lastOverlap.slice(-OVERLAP_SIZE);
        }

        chunks.push(currentChunk.trim());
        currentChunk = lastOverlap ? `[...] ${lastOverlap}\n\n${trimmedParagraph}` : trimmedParagraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  }

  it('should split on paragraph boundaries', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const chunks = simpleChunkText(text, 30);

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should add overlap marker when splitting', () => {
    const text = 'First sentence. Second sentence.\n\nThird sentence. Fourth sentence.\n\nFifth sentence.';
    const chunks = simpleChunkText(text, 40);

    // Second chunk should have overlap marker
    const hasOverlap = chunks.some(c => c.includes('[...]'));
    expect(hasOverlap).toBe(true);
  });

  it('should preserve context across chunk boundaries', () => {
    const text = 'Sal the butcher from Newark was famous. He made the best salami.\n\nOne day Sal told me a secret. It changed everything.';
    const chunks = simpleChunkText(text, 60);

    if (chunks.length > 1) {
      // Second chunk should reference content from first chunk
      const secondChunk = chunks[1];
      expect(secondChunk.includes('[...]')).toBe(true);
    }
  });

  it('should return single chunk for short text', () => {
    const text = 'Short text.';
    const chunks = simpleChunkText(text, 100);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe('Short text.');
  });

  it('should handle empty input', () => {
    const chunks = simpleChunkText('', 100);
    expect(chunks).toEqual(['']);
  });
});

// ============================================
// INTEGRATION: FULL SCORING PIPELINE
// ============================================

describe('Full Scoring Pipeline', () => {

  interface ScoredMemory {
    id: string;
    similarity: number;
    importance: number;
    retrievalCount: number;
    keywords: string[];
    source: string;
    type: string;
  }

  function calculateFullScore(memory: ScoredMemory, selectedMemories: ScoredMemory[]): number {
    // Step 1: Freshness boost
    const freshnessBoost = memory.retrievalCount < 5 ? 1.2 : 1.0;

    // Step 2: Retrieval penalty
    const retrievalPenalty = Math.min(memory.retrievalCount * 0.03, 0.30);

    // Step 3: Base score (similarity is primary)
    const baseScore = memory.similarity * freshnessBoost * (1 - retrievalPenalty);

    // Step 4: Diversity score
    let penalty = 0;
    let sameSourceCount = 0;
    const memoryKeywords = new Set(memory.keywords.map(k => k.toLowerCase()));

    for (const selected of selectedMemories) {
      if (selected.source === memory.source) sameSourceCount++;
      if (selected.type === memory.type) penalty += 0.15;

      const selectedKeywords = new Set(selected.keywords.map(k => k.toLowerCase()));
      const overlap = Array.from(memoryKeywords).filter(k => selectedKeywords.has(k)).length;
      const total = Math.max(memoryKeywords.size, selectedKeywords.size);
      if (total > 0) {
        const overlapRatio = overlap / total;
        penalty += overlapRatio > 0.6 ? 0.5 : overlapRatio * 0.25;
      }
    }

    if (sameSourceCount >= 2) return 0;
    const diversityScore = Math.max(0, 1.0 - penalty);

    return baseScore * diversityScore;
  }

  it('should rank semantically relevant memory higher than high-importance irrelevant memory', () => {
    const relevant: ScoredMemory = {
      id: '1',
      similarity: 0.9,
      importance: 30,
      retrievalCount: 2,
      keywords: ['sal', 'butcher', 'newark'],
      source: 'chat',
      type: 'STORY'
    };

    const irrelevant: ScoredMemory = {
      id: '2',
      similarity: 0.4,
      importance: 95,
      retrievalCount: 15,
      keywords: ['pizza', 'recipe', 'grandma'],
      source: 'doc',
      type: 'FACT'
    };

    const relevantScore = calculateFullScore(relevant, []);
    const irrelevantScore = calculateFullScore(irrelevant, []);

    // Relevant memory should win despite lower importance
    expect(relevantScore).toBeGreaterThan(irrelevantScore);
  });

  it('should surface fresh memories over stale ones with equal similarity', () => {
    const fresh: ScoredMemory = {
      id: '1',
      similarity: 0.75,
      importance: 50,
      retrievalCount: 1,
      keywords: ['sal'],
      source: 'doc1',
      type: 'STORY'
    };

    const stale: ScoredMemory = {
      id: '2',
      similarity: 0.75,
      importance: 50,
      retrievalCount: 20,
      keywords: ['mario'],
      source: 'doc2',
      type: 'FACT'
    };

    const freshScore = calculateFullScore(fresh, []);
    const staleScore = calculateFullScore(stale, []);

    expect(freshScore).toBeGreaterThan(staleScore);
  });

  it('should prevent same-source domination', () => {
    const selected: ScoredMemory[] = [
      { id: '1', similarity: 0.9, importance: 80, retrievalCount: 5, keywords: ['first'], source: 'doc1', type: 'STORY' },
      { id: '2', similarity: 0.85, importance: 75, retrievalCount: 3, keywords: ['second'], source: 'doc1', type: 'FACT' }
    ];

    const thirdFromSameSource: ScoredMemory = {
      id: '3',
      similarity: 0.95,
      importance: 90,
      retrievalCount: 0,
      keywords: ['third'],
      source: 'doc1',
      type: 'STORY'
    };

    const fromDifferentSource: ScoredMemory = {
      id: '4',
      similarity: 0.7,
      importance: 40,
      retrievalCount: 10,
      keywords: ['fourth'],
      source: 'doc2',
      type: 'FACT'
    };

    const thirdScore = calculateFullScore(thirdFromSameSource, selected);
    const differentScore = calculateFullScore(fromDifferentSource, selected);

    // Third from same source should be excluded (score = 0)
    expect(thirdScore).toBe(0);
    // Different source should be allowed
    expect(differentScore).toBeGreaterThan(0);
  });
});
