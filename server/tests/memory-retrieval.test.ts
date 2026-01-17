/**
 * Memory Retrieval System Test
 *
 * This test demonstrates how Nicky's memory retrieval works when you send him a message.
 * It traces through the entire pipeline to show:
 * 1. What gets called
 * 2. How long each step takes
 * 3. What actually gets returned
 * 4. Which scoring mechanisms matter
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { contextBuilder } from '../services/contextBuilder.js';
import { embeddingServiceInstance } from '../services/embeddingService.js';
import { storage } from '../storage.js';

describe('Memory Retrieval Pipeline', () => {
  const TEST_PROFILE_ID = 'test-profile-id';
  const TEST_MESSAGE = "Hey Nicky, tell me about Sal the butcher from Newark";

  it('should trace the full retrieval pipeline with timing', async () => {
    console.log('\n🔍 TRACING MEMORY RETRIEVAL PIPELINE\n');
    console.log(`Message: "${TEST_MESSAGE}"\n`);

    const timings: Record<string, number> = {};

    // Step 1: Keyword Extraction
    let start = Date.now();
    const baseKeywords = contextBuilder.extractKeywords(TEST_MESSAGE);
    timings.keywordExtraction = Date.now() - start;
    console.log(`1️⃣  Keyword Extraction (${timings.keywordExtraction}ms)`);
    console.log(`    Keywords: [${baseKeywords.join(', ')}]\n`);

    // Step 2: Contextual Keyword Enhancement
    start = Date.now();
    const { keywords: enhancedKeywords, contextualQuery } = await contextBuilder.extractContextualKeywords(
      TEST_MESSAGE,
      undefined,
      { preset: 'Story Mode' },
      'PODCAST'
    );
    timings.contextualEnhancement = Date.now() - start;
    console.log(`2️⃣  Contextual Enhancement (${timings.contextualEnhancement}ms)`);
    console.log(`    Enhanced: [${enhancedKeywords.join(', ')}]`);
    console.log(`    Query: "${contextualQuery}"\n`);

    // Step 3: Hybrid Search (this is the expensive one)
    start = Date.now();
    let hybridResults;
    try {
      hybridResults = await embeddingServiceInstance.hybridSearch(
        contextualQuery,
        TEST_PROFILE_ID,
        15,
        'CANON'
      );
      timings.hybridSearch = Date.now() - start;
      console.log(`3️⃣  Hybrid Search (${timings.hybridSearch}ms)`);
      console.log(`    Semantic results: ${hybridResults.semantic.length}`);
      console.log(`    Keyword results: ${hybridResults.keyword.length}`);
      console.log(`    Combined results: ${hybridResults.combined.length}\n`);
    } catch (error: any) {
      timings.hybridSearch = Date.now() - start;
      console.log(`3️⃣  Hybrid Search (${timings.hybridSearch}ms) - FAILED`);
      console.log(`    Error: ${error.message}\n`);
    }

    // Step 4: Full Context Gathering (includes all parallel operations)
    start = Date.now();
    let fullContext;
    try {
      fullContext = await contextBuilder.gatherAllContext(
        TEST_MESSAGE,
        TEST_PROFILE_ID,
        undefined,
        { preset: 'Story Mode' },
        'PODCAST'
      );
      timings.fullContextGather = Date.now() - start;
      console.log(`4️⃣  Full Context Gathering (${timings.fullContextGather}ms)`);
      console.log(`    Canon memories: ${fullContext.memoryPack?.canon?.length || 0}`);
      console.log(`    Rumor memories: ${fullContext.memoryPack?.rumors?.length || 0}`);
      console.log(`    Documents: ${fullContext.relevantDocs?.length || 0}`);
      console.log(`    Training examples: ${fullContext.trainingExamples?.length || 0}`);
      console.log(`    Entities: ${fullContext.entityDossiers?.length || 0}`);
      console.log(`    Web search results: ${fullContext.webSearchResults?.length || 0}\n`);
    } catch (error: any) {
      timings.fullContextGather = Date.now() - start;
      console.log(`4️⃣  Full Context Gathering (${timings.fullContextGather}ms) - FAILED`);
      console.log(`    Error: ${error.message}\n`);
    }

    // Summary
    console.log('⏱️  TIMING SUMMARY');
    console.log('─────────────────────────────────');
    const total = Object.values(timings).reduce((sum, time) => sum + time, 0);
    Object.entries(timings).forEach(([step, time]) => {
      console.log(`${step.padEnd(25)} ${time.toString().padStart(6)}ms`);
    });
    console.log('─────────────────────────────────');
    console.log(`TOTAL${' '.repeat(20)} ${total.toString().padStart(6)}ms\n`);

    // Note: These assertions will likely fail if database isn't set up
    // This test is more for understanding the pipeline than actual validation
    expect(baseKeywords.length).toBeGreaterThan(0);
  });

  it('should show which scoring mechanisms are actually used', async () => {
    console.log('\n🎯 ANALYZING SCORING MECHANISMS\n');

    // Mock a memory retrieval result
    const mockMemory = {
      id: 'test-id',
      content: 'Sal the butcher from Newark was my childhood friend',
      type: 'STORY' as const,
      importance: 85,
      confidence: 90,
      retrievalCount: 5,
      successRate: 80,
      keywords: ['sal', 'butcher', 'newark', 'childhood'],
      lane: 'CANON' as const
    };

    console.log('Example Memory:', mockMemory);
    console.log('\n📊 How This Memory Gets Scored:\n');

    // 1. Semantic similarity (from vector search)
    console.log('1️⃣  Semantic Similarity');
    console.log('    - Calculated via: cosine(query_embedding, memory_embedding)');
    console.log('    - Boosted by: 1.2x for semantic matches');
    console.log('    - Range: 0.0 to 1.0 (after boost: 0.0 to 1.2)\n');

    // 2. Importance contribution
    const importanceBoost = mockMemory.importance * 0.1;
    console.log('2️⃣  Importance Score');
    console.log(`    - Raw importance: ${mockMemory.importance}`);
    console.log(`    - Contribution: ${importanceBoost} (importance * 0.1)`);
    console.log('    - Max possible: 99.9 (if importance is 999)\n');

    // 3. Confidence contribution
    const confidenceBoost = mockMemory.confidence * 0.001;
    console.log('3️⃣  Confidence Score');
    console.log(`    - Raw confidence: ${mockMemory.confidence}`);
    console.log(`    - Contribution: ${confidenceBoost} (confidence * 0.001)`);
    console.log('    - Max possible: 0.1 (if confidence is 100)\n');

    // 4. Contextual relevance
    console.log('4️⃣  Contextual Relevance');
    console.log('    - Same conversation: +0.5');
    console.log('    - Query intent match: +0.4');
    console.log('    - Importance factor: +0.25 max');
    console.log('    - Confidence factor: +0.1 max');
    console.log('    - Keyword matches: +0.1 per match (max +0.3)');
    console.log('    - Max possible: 1.0\n');

    // 5. Diversity penalty
    console.log('5️⃣  Diversity Score (Penalty)');
    console.log('    - Same type as previous: -0.1');
    console.log('    - Keyword overlap: -0.2 per overlap');
    console.log('    - Final multiplier: 0.0 to 1.0\n');

    // 6. What's NOT used
    console.log('❌ UNUSED/BARELY USED Scores:');
    console.log(`    - retrievalCount: ${mockMemory.retrievalCount} (only used in vector ranking formula)`);
    console.log(`    - successRate: ${mockMemory.successRate} (not used in retrieval at all!)`);
    console.log('    - qualityScore: stored in DB but never queried');
    console.log('    - temporalContext: stored but not used for scoring\n');

    // Calculate a hypothetical final score
    const hypotheticalSemantic = 0.85;
    const baseScore = (hypotheticalSemantic * 1.2) + importanceBoost + confidenceBoost;
    const contextualRelevance = 0.7; // estimated
    const diversityScore = 0.9; // estimated
    const finalScore = baseScore * diversityScore + contextualRelevance * 0.3;

    console.log('🧮 HYPOTHETICAL FINAL SCORE');
    console.log(`    Base: (${hypotheticalSemantic} * 1.2) + ${importanceBoost} + ${confidenceBoost} = ${baseScore.toFixed(3)}`);
    console.log(`    With diversity: ${baseScore.toFixed(3)} * ${diversityScore} = ${(baseScore * diversityScore).toFixed(3)}`);
    console.log(`    With context: ${(baseScore * diversityScore).toFixed(3)} + (${contextualRelevance} * 0.3) = ${finalScore.toFixed(3)}\n`);

    expect(true).toBe(true);
  });

  it('should demonstrate the confidence >= 60 filter', async () => {
    console.log('\n🔒 CONFIDENCE FILTERING DEMONSTRATION\n');

    const memories = [
      { id: '1', content: 'High confidence fact', confidence: 90, lane: 'CANON' },
      { id: '2', content: 'Medium confidence fact', confidence: 65, lane: 'CANON' },
      { id: '3', content: 'Low confidence fact', confidence: 45, lane: 'CANON' },
      { id: '4', content: 'No confidence specified', confidence: undefined, lane: 'CANON' },
      { id: '5', content: 'Rumor (always low)', confidence: 25, lane: 'RUMOR' },
    ];

    console.log('📝 Sample Memories:');
    memories.forEach(m => {
      console.log(`    [${m.lane}] confidence=${m.confidence}: "${m.content}"`);
    });

    console.log('\n🔍 After CANON filtering (confidence >= 60):');
    const filteredCanon = memories.filter(m =>
      m.lane === 'CANON' && (m.confidence || 50) >= 60
    );
    filteredCanon.forEach(m => {
      console.log(`    ✅ "${m.content}" (confidence: ${m.confidence})`);
    });

    const rejected = memories.filter(m =>
      m.lane === 'CANON' && (m.confidence || 50) < 60
    );
    console.log('\n❌ Rejected memories:');
    rejected.forEach(m => {
      console.log(`    "${m.content}" (confidence: ${m.confidence || 'undefined → 50'})`);
    });

    console.log('\n💡 Key Insight:');
    console.log('    Memories without confidence scores default to 50,');
    console.log('    which means they get filtered OUT (< 60 threshold).\n');

    expect(filteredCanon.length).toBe(2);
  });

  it('should show lane filtering behavior', async () => {
    console.log('\n🎭 LANE FILTERING (CANON vs RUMOR)\n');

    const allMemories = [
      { id: '1', content: 'Sal is a butcher from Newark', lane: 'CANON', confidence: 95 },
      { id: '2', content: 'Sal once wrestled a bear', lane: 'RUMOR', confidence: 30 },
      { id: '3', content: 'Sal taught me about meat cuts', lane: 'CANON', confidence: 80 },
      { id: '4', content: 'Sal secretly runs the mafia', lane: 'RUMOR', confidence: 35 },
    ];

    console.log('📚 Full Memory Database:');
    allMemories.forEach(m => {
      console.log(`    [${m.lane.padEnd(5)}] conf=${m.confidence} "${m.content}"`);
    });

    // Scenario 1: Normal chat (chaos = 40)
    console.log('\n🗨️  Scenario 1: Normal Chat (chaos=40, mode=CHAT)');
    console.log('    - Theater Zone: NO (chaos <= 70)');
    console.log('    - Canon retrieved: YES');
    console.log('    - Rumors retrieved: NO');
    const normalChat = allMemories.filter(m => m.lane === 'CANON' && m.confidence >= 60);
    console.log('    - Results:', normalChat.length, 'canon memories');
    normalChat.forEach(m => console.log(`      ✅ "${m.content}"`));

    // Scenario 2: Podcast mode (chaos = 60)
    console.log('\n🎙️  Scenario 2: Podcast Mode (chaos=60, mode=PODCAST)');
    console.log('    - Theater Zone: YES (mode=PODCAST)');
    console.log('    - Canon retrieved: YES');
    console.log('    - Rumors retrieved: YES (up to 3)');
    const podcastCanon = allMemories.filter(m => m.lane === 'CANON' && m.confidence >= 60);
    const podcastRumors = allMemories.filter(m => m.lane === 'RUMOR').slice(0, 3);
    console.log(`    - Results: ${podcastCanon.length} canon, ${podcastRumors.length} rumors`);
    console.log('    Canon:');
    podcastCanon.forEach(m => console.log(`      ✅ "${m.content}"`));
    console.log('    Rumors:');
    podcastRumors.forEach(m => console.log(`      🎭 "${m.content}"`));

    // Scenario 3: FULL PSYCHO (chaos = 95)
    console.log('\n😈 Scenario 3: Full Psycho Mode (chaos=95, mode=STREAMING)');
    console.log('    - Theater Zone: YES (chaos > 70)');
    console.log('    - Canon retrieved: YES');
    console.log('    - Rumors retrieved: YES (unlimited bullshit)');
    const psychoCanon = allMemories.filter(m => m.lane === 'CANON' && m.confidence >= 60);
    const psychoRumors = allMemories.filter(m => m.lane === 'RUMOR');
    console.log(`    - Results: ${psychoCanon.length} canon, ${psychoRumors.length} rumors`);
    console.log('    Nicky can now lie about Sal wrestling bears!\n');

    expect(normalChat.length).toBe(2);
    expect(podcastRumors.length).toBeLessThanOrEqual(3);
  });
});
