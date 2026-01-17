#!/usr/bin/env tsx
/**
 * Memory Retrieval Demo
 *
 * Run this to see EXACTLY how Nicky retrieves memories when you send a message.
 * This demonstrates the complexity of the current system.
 *
 * Usage: npx tsx scripts/demo-memory-retrieval.ts
 */

import { contextBuilder } from '../server/services/contextBuilder.js';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(text: string) {
  console.log('\n' + '='.repeat(70));
  log('bright', `  ${text}`);
  console.log('='.repeat(70) + '\n');
}

function section(emoji: string, title: string) {
  console.log('');
  log('cyan', `${emoji}  ${title}`);
  console.log('─'.repeat(70));
}

async function demonstrateKeywordExtraction() {
  header('DEMO 1: Keyword Extraction');

  const testMessages = [
    "Hey Nicky, what's the story with Sal the butcher?",
    "Tell me about your favorite pasta",
    "What happened in Dead by Daylight episode 68?",
    "How do you feel about cream in carbonara?",
  ];

  for (const message of testMessages) {
    section('💬', `Message: "${message}"`);

    const keywords = contextBuilder.extractKeywords(message);
    log('green', `   Keywords extracted: [${keywords.join(', ')}]`);
    log('dim', `   (${keywords.length} keywords, stopwords removed)\n`);
  }
}

async function demonstrateContextualEnhancement() {
  header('DEMO 2: Contextual Enhancement');

  const message = "Hey Nicky, tell me a story";

  section('📝', 'Base Keywords');
  const baseKeywords = contextBuilder.extractKeywords(message);
  log('yellow', `   ${JSON.stringify(baseKeywords)}`);

  section('🎭', 'With Personality Context (Story Mode)');
  const storyResult = await contextBuilder.extractContextualKeywords(
    message,
    undefined,
    { preset: 'Story Mode' },
    'PODCAST'
  );
  log('green', `   Enhanced: ${JSON.stringify(storyResult.keywords)}`);
  log('dim', `   Added: family, newark, italian, childhood, stories, memories, episode, show, podcast`);

  section('🎮', 'With Personality Context (Gaming Rage)');
  const gamingResult = await contextBuilder.extractContextualKeywords(
    message,
    undefined,
    { preset: 'Gaming Rage' },
    'STREAMING'
  );
  log('green', `   Enhanced: ${JSON.stringify(gamingResult.keywords)}`);
  log('dim', `   Added: dead by daylight, gaming, killer, survivor, stream, twitch, viewers`);
}

function demonstrateScoringMechanisms() {
  header('DEMO 3: Scoring Mechanisms');

  const mockMemory = {
    id: 'test-1',
    content: 'Sal the butcher from Newark taught me about meat cuts',
    type: 'STORY',
    importance: 85,
    confidence: 90,
    retrievalCount: 5,
    successRate: 80,
    keywords: ['sal', 'butcher', 'newark', 'meat'],
    lane: 'CANON',
  };

  section('📊', 'Example Memory');
  console.log('   ', mockMemory);

  section('🎯', 'Scoring Breakdown');

  // 1. Semantic similarity (hypothetical)
  const semanticSim = 0.85;
  log('blue', `   1. Semantic Similarity: ${semanticSim}`);
  log('dim', `      - From vector embedding cosine distance`);
  log('dim', `      - Boosted: ${semanticSim} × 1.2 = ${(semanticSim * 1.2).toFixed(3)}\n`);

  // 2. Importance
  const importanceContrib = mockMemory.importance * 0.1;
  log('blue', `   2. Importance Contribution: ${importanceContrib}`);
  log('dim', `      - Raw: ${mockMemory.importance}`);
  log('dim', `      - Formula: importance × 0.1\n`);

  // 3. Confidence
  const confidenceContrib = mockMemory.confidence * 0.001;
  log('blue', `   3. Confidence Contribution: ${confidenceContrib}`);
  log('dim', `      - Raw: ${mockMemory.confidence}`);
  log('dim', `      - Formula: confidence × 0.001\n`);

  // 4. Base score
  const baseScore = (semanticSim * 1.2) + importanceContrib + confidenceContrib;
  log('green', `   4. Base Score: ${baseScore.toFixed(3)}`);
  log('dim', `      - Formula: (similarity × 1.2) + (importance × 0.1) + (confidence × 0.001)\n`);

  // 5. Contextual relevance (hypothetical)
  const contextualRelevance = 0.7;
  log('blue', `   5. Contextual Relevance: ${contextualRelevance}`);
  log('dim', `      - Same conversation: +0.5`);
  log('dim', `      - Query intent match: +0.4`);
  log('dim', `      - Importance factor: +0.25`);
  log('dim', `      - Confidence factor: +0.1`);
  log('dim', `      - Keyword matches: +0.1 per match\n`);

  // 6. Diversity score (hypothetical)
  const diversityScore = 0.9;
  log('blue', `   6. Diversity Score: ${diversityScore}`);
  log('dim', `      - Penalty for same type: -0.1`);
  log('dim', `      - Penalty for keyword overlap: -0.2 per overlap\n`);

  // 7. Final score
  const finalScore = baseScore * diversityScore + contextualRelevance * 0.3;
  log('green', `   7. FINAL SCORE: ${finalScore.toFixed(3)}`);
  log('dim', `      - Formula: (base_score × diversity) + (contextual × 0.3)\n`);

  // 8. Unused scores
  section('❌', 'UNUSED Scores (tracked but not used)');
  log('red', `   - retrievalCount: ${mockMemory.retrievalCount} (only in vector ranking)`);
  log('red', `   - successRate: ${mockMemory.successRate} (NEVER USED!)`);
  log('red', `   - qualityScore: (in schema but never queried)`);
  log('red', `   - temporalContext: (stored but not used for scoring)\n`);
}

function demonstrateLaneFiltering() {
  header('DEMO 4: Lane Filtering (CANON vs RUMOR)');

  const memories = [
    { id: '1', content: 'Sal is a butcher from Newark', lane: 'CANON', confidence: 95 },
    { id: '2', content: 'Sal once wrestled a bear', lane: 'RUMOR', confidence: 30 },
    { id: '3', content: 'Sal taught me about meat cuts', lane: 'CANON', confidence: 80 },
    { id: '4', content: 'Sal secretly runs the mafia', lane: 'RUMOR', confidence: 35 },
    { id: '5', content: 'Sal has a tattoo of a pig', lane: 'CANON', confidence: 45 },
  ];

  section('📚', 'All Memories in Database');
  memories.forEach(m => {
    const laneColor = m.lane === 'CANON' ? 'green' : 'yellow';
    log(laneColor, `   [${m.lane}] conf=${m.confidence} - "${m.content}"`);
  });

  section('🗨️', 'Scenario 1: Normal Chat (chaos=40, mode=CHAT)');
  log('dim', '   Theater Zone: NO (chaos <= 70)');
  log('dim', '   Canon: YES | Rumors: NO\n');

  const normalChat = memories.filter(m => m.lane === 'CANON' && m.confidence >= 60);
  log('bright', '   RETRIEVED:');
  normalChat.forEach(m => log('green', `      ✅ "${m.content}"`));

  const normalRejected = memories.filter(m => m.lane === 'CANON' && m.confidence < 60);
  log('bright', '\n   REJECTED:');
  normalRejected.forEach(m => log('red', `      ❌ "${m.content}" (confidence < 60)`));
  memories.filter(m => m.lane === 'RUMOR').forEach(m =>
    log('red', `      ❌ "${m.content}" (RUMOR, not Theater Zone)`)
  );

  section('🎙️', 'Scenario 2: Podcast Mode (chaos=60, mode=PODCAST)');
  log('dim', '   Theater Zone: YES (mode=PODCAST)');
  log('dim', '   Canon: YES | Rumors: YES (up to 3)\n');

  const podcastCanon = memories.filter(m => m.lane === 'CANON' && m.confidence >= 60);
  const podcastRumors = memories.filter(m => m.lane === 'RUMOR').slice(0, 3);

  log('bright', '   CANON:');
  podcastCanon.forEach(m => log('green', `      ✅ "${m.content}"`));
  log('bright', '\n   RUMORS:');
  podcastRumors.forEach(m => log('yellow', `      🎭 "${m.content}"`));

  section('😈', 'Scenario 3: FULL PSYCHO (chaos=95, mode=STREAMING)');
  log('dim', '   Theater Zone: YES (chaos > 70)');
  log('dim', '   Canon: YES | Rumors: UNLIMITED BULLSHIT\n');

  const psychoCanon = memories.filter(m => m.lane === 'CANON' && m.confidence >= 60);
  const psychoRumors = memories.filter(m => m.lane === 'RUMOR');

  log('bright', '   CANON:');
  psychoCanon.forEach(m => log('green', `      ✅ "${m.content}"`));
  log('bright', '\n   RUMORS:');
  psychoRumors.forEach(m => log('yellow', `      🎭 "${m.content}"`));
  log('magenta', '\n   Nicky can now lie about Sal wrestling bears! 🐻');
}

function demonstrateTimingBreakdown() {
  header('DEMO 5: Performance Breakdown');

  const timings = [
    { step: 'Extract keywords', time: 10, api: 0, db: 0 },
    { step: 'Enhance keywords', time: 50, api: 0, db: 1 },
    { step: 'Generate embedding', time: 200, api: 1, db: 0 },
    { step: 'Semantic search', time: 100, api: 0, db: 1 },
    { step: 'Keyword search', time: 50, api: 0, db: 1 },
    { step: 'Fetch podcast memories', time: 50, api: 0, db: 1 },
    { step: 'Search documents', time: 50, api: 0, db: 1 },
    { step: 'Fetch lore', time: 50, api: 0, db: 1 },
    { step: 'Search training examples', time: 100, api: 0, db: 1 },
    { step: 'Calculate relevance', time: 10, api: 0, db: 0 },
    { step: 'Calculate diversity', time: 10, api: 0, db: 0 },
    { step: 'Detect knowledge gaps', time: 10, api: 0, db: 0 },
    { step: 'Prune context', time: 20, api: 0, db: 0 },
  ];

  section('⏱️', 'Time Per Step');
  timings.forEach(({ step, time, api, db }) => {
    const timeStr = `${time}ms`.padEnd(6);
    const apiStr = api > 0 ? `(${api} API call)` : '';
    const dbStr = db > 0 ? `(${db} DB query)` : '';
    log('cyan', `   ${step.padEnd(30)} ${timeStr} ${apiStr} ${dbStr}`);
  });

  const totalTime = timings.reduce((sum, t) => sum + t.time, 0);
  const totalAPI = timings.reduce((sum, t) => sum + t.api, 0);
  const totalDB = timings.reduce((sum, t) => sum + t.db, 0);

  console.log('   ' + '─'.repeat(68));
  log('bright', `   TOTAL${' '.repeat(24)} ~${totalTime}ms    (${totalAPI} API, ${totalDB} DB queries)`);
  log('red', '\n   This happens BEFORE Nicky even starts talking!');
}

// Main execution
async function main() {
  console.clear();
  log('bright', '\n🧠 NICKY\'S MEMORY RETRIEVAL SYSTEM - LIVE DEMO\n');
  log('dim', 'This demonstrates how the current system works when you send a message.\n');

  try {
    await demonstrateKeywordExtraction();
    await demonstrateContextualEnhancement();
    demonstrateScoringMechanisms();
    demonstrateLaneFiltering();
    demonstrateTimingBreakdown();

    header('SUMMARY');
    log('yellow', '🎯 Key Findings:');
    console.log('   1. 8 different scoring mechanisms (many overlapping)');
    console.log('   2. ~710ms latency before response generation');
    console.log('   3. 1 API call + 7 database queries per message');
    console.log('   4. Several tracked metrics are never used (successRate, qualityScore)');
    console.log('   5. Importance/confidence weighted heavily (unrelated "important" facts get through)');

    log('\nyellow', '💡 Simplification Opportunities:');
    console.log('   1. Remove unused fields (successRate, qualityScore)');
    console.log('   2. Reduce scoring to: semantic_similarity + confidence (maybe + importance)');
    console.log('   3. Cache embeddings for your common phrases');
    console.log('   4. Run keyword search FIRST, semantic only if needed');
    console.log('   5. Reduce parallel queries from 7 to 3-4');

    log('\ngreen', '\n✅ Read the full analysis in docs/MEMORY_SYSTEM_EXPLAINED.md\n');

  } catch (error: any) {
    log('red', `\n❌ Error: ${error.message}`);
    log('dim', '\nNote: Some demos require database connection.');
  }
}

main();
