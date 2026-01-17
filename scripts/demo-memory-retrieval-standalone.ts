#!/usr/bin/env tsx
/**
 * Memory Retrieval Demo (Standalone)
 *
 * This demonstrates how Nicky's memory system works WITHOUT needing database access.
 * It simulates the scoring and filtering logic to show the complexity.
 *
 * Usage: npx tsx scripts/demo-memory-retrieval-standalone.ts
 */

// ANSI color codes
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = (color: keyof typeof c, msg: string) => console.log(`${c[color]}${msg}${c.reset}`);
const header = (text: string) => {
  console.log('\n' + '='.repeat(70));
  log('bright', `  ${text}`);
  console.log('='.repeat(70) + '\n');
};
const section = (emoji: string, title: string) => {
  console.log('');
  log('cyan', `${emoji}  ${title}`);
  console.log('─'.repeat(70));
};

// Simulate keyword extraction (from contextBuilder.ts:31-45)
function extractKeywords(message: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);

  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => {
      const isNumber = /^\d+$/.test(word);
      const isLongEnough = word.length > 2;
      const isNotStopWord = !stopWords.has(word);
      return (isNumber || isLongEnough) && isNotStopWord;
    })
    .slice(0, 8);
}

// DEMO 1
function demoKeywordExtraction() {
  header('DEMO 1: Keyword Extraction');

  const messages = [
    "Hey Nicky, what's the story with Sal the butcher?",
    "Tell me about your favorite pasta",
    "What happened in Dead by Daylight episode 68?",
    "How do you feel about cream in carbonara?",
  ];

  messages.forEach(msg => {
    section('💬', `Message: "${msg}"`);
    const keywords = extractKeywords(msg);
    log('green', `   Keywords: [${keywords.join(', ')}]`);
    log('dim', `   (${keywords.length} keywords, stopwords removed)\n`);
  });
}

// DEMO 2
function demoContextualEnhancement() {
  header('DEMO 2: Contextual Enhancement');

  const message = "Hey Nicky, tell me a story";
  const baseKeywords = extractKeywords(message);

  section('📝', 'Base Keywords');
  log('yellow', `   ${JSON.stringify(baseKeywords)}`);

  section('🎭', 'With Story Mode + PODCAST');
  const storyEnhanced = [...baseKeywords, 'family', 'newark', 'italian', 'childhood', 'episode', 'show', 'podcast'];
  log('green', `   Enhanced: ${JSON.stringify(storyEnhanced)}`);
  log('dim', `   Added personality keywords: family, newark, italian, childhood`);
  log('dim', `   Added mode keywords: episode, show, podcast`);

  section('🎮', 'With Gaming Rage + STREAMING');
  const gamingEnhanced = [...baseKeywords, 'dead', 'daylight', 'gaming', 'killer', 'survivor', 'stream', 'twitch'];
  log('green', `   Enhanced: ${JSON.stringify(gamingEnhanced)}`);
  log('dim', `   Added personality keywords: dead, daylight, gaming, killer, survivor`);
  log('dim', `   Added mode keywords: stream, twitch, viewers`);
}

// DEMO 3
function demoScoringMechanisms() {
  header('DEMO 3: The 8 Scoring Mechanisms');

  const memory = {
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
  Object.entries(memory).forEach(([key, value]) => {
    log('dim', `   ${key}: ${JSON.stringify(value)}`);
  });

  section('🎯', 'How This Memory Gets Scored');

  // 1. Semantic similarity
  const semanticSim = 0.85;
  log('blue', '\n   1️⃣  Semantic Similarity (Vector Cosine Distance)');
  log('dim', `      Raw similarity: ${semanticSim}`);
  log('dim', `      Boosted: ${semanticSim} × 1.2 = ${(semanticSim * 1.2).toFixed(3)}`);
  log('dim', '      Source: Gemini embedding API + vector search');

  // 2. Keyword match
  log('blue', '\n   2️⃣  Keyword Match Score');
  log('dim', '      Default: 0.7 (if found via keyword search)');
  log('dim', '      Source: SQL LIKE queries');

  // 3. Importance
  const importanceContrib = memory.importance * 0.1;
  log('blue', '\n   3️⃣  Importance Contribution');
  log('dim', `      Raw: ${memory.importance}`);
  log('dim', `      Contribution: ${memory.importance} × 0.1 = ${importanceContrib}`);
  log('yellow', '      Used 3 times: base score, contextual relevance, vector ranking');

  // 4. Confidence
  const confidenceContrib = memory.confidence * 0.001;
  log('blue', '\n   4️⃣  Confidence Contribution');
  log('dim', `      Raw: ${memory.confidence}`);
  log('dim', `      Contribution: ${memory.confidence} × 0.001 = ${confidenceContrib}`);
  log('yellow', '      Used 3 times: base score, contextual relevance, HARD FILTER (>= 60)');

  // 5. Base score
  const baseScore = (semanticSim * 1.2) + importanceContrib + confidenceContrib;
  log('green', '\n   5️⃣  Base Score');
  log('bright', `      ${baseScore.toFixed(3)}`);
  log('dim', `      Formula: (similarity × 1.2) + (importance × 0.1) + (confidence × 0.001)`);

  // 6. Contextual relevance
  log('blue', '\n   6️⃣  Contextual Relevance Score (0.0 - 1.0)');
  log('dim', '      Components:');
  log('dim', '        • Same conversation: +0.5');
  log('dim', '        • Query intent matches type: +0.4 (e.g., "tell me about" + STORY)');
  log('dim', '        • Importance factor: +(importance/100) × 0.25 = +0.21');
  log('dim', '        • Confidence factor: +(confidence/100) × 0.1 = +0.09');
  log('dim', '        • Keyword matches: +0.1 per match (max +0.3)');
  const contextualRelevance = 0.5 + 0.4 + 0.21 + 0.09 + 0.3;
  log('bright', `      Hypothetical total: ${Math.min(contextualRelevance, 1.0).toFixed(2)} (capped at 1.0)`);

  // 7. Diversity score
  log('blue', '\n   7️⃣  Diversity Score (Penalty Multiplier 0.0 - 1.0)');
  log('dim', '      Penalties:');
  log('dim', '        • Same type as previous memory: -0.1');
  log('dim', '        • Keyword overlap: -0.2 per overlapping keyword');
  const diversityScore = 1.0 - 0.1 - 0.2;
  log('bright', `      Hypothetical: ${diversityScore} (some overlap detected)`);

  // 8. Final score
  const finalScore = baseScore * diversityScore + contextualRelevance * 0.3;
  log('green', '\n   8️⃣  FINAL SCORE');
  log('bright', `      ${finalScore.toFixed(3)}`);
  log('dim', `      Formula: (base_score × diversity) + (contextual × 0.3)`);
  log('dim', `      = (${baseScore.toFixed(3)} × ${diversityScore}) + (${contextualRelevance.toFixed(2)} × 0.3)`);

  // UNUSED
  section('❌', 'UNUSED / BARELY USED Scores');
  log('red', `   • retrievalCount: ${memory.retrievalCount}`);
  log('dim', '     Only used in vector search ranking formula: importance / (1 + retrievalCount/50)');
  log('red', `\n   • successRate: ${memory.successRate}`);
  log('dim', '     NEVER USED ANYWHERE! Tracked but not queried.');
  log('red', '\n   • qualityScore:');
  log('dim', '     In schema but never queried');
  log('red', '\n   • temporalContext:');
  log('dim', '     Stored but not used for scoring');
}

// DEMO 4
function demoLaneFiltering() {
  header('DEMO 4: Lane Filtering (CANON vs RUMOR)');

  const memories = [
    { id: '1', content: 'Sal is a butcher from Newark', lane: 'CANON', confidence: 95 },
    { id: '2', content: 'Sal once wrestled a bear', lane: 'RUMOR', confidence: 30 },
    { id: '3', content: 'Sal taught me about meat cuts', lane: 'CANON', confidence: 80 },
    { id: '4', content: 'Sal secretly runs the mafia', lane: 'RUMOR', confidence: 35 },
    { id: '5', content: 'Sal has a tattoo of a pig', lane: 'CANON', confidence: 45 },
  ];

  section('📚', 'All Memories in Database (5 total)');
  memories.forEach(m => {
    const color = m.lane === 'CANON' ? 'green' : 'yellow';
    log(color, `   [${m.lane.padEnd(5)}] confidence=${m.confidence} - "${m.content}"`);
  });

  section('🗨️', 'Scenario 1: Normal Chat (chaos=40, mode=CHAT)');
  log('dim', '   • Theater Zone: NO (chaos <= 70, not PODCAST/STREAMING)');
  log('dim', '   • Canon memories: YES (confidence >= 60)');
  log('dim', '   • Rumor memories: NO\n');

  const s1Canon = memories.filter(m => m.lane === 'CANON' && m.confidence >= 60);
  const s1Rejected = memories.filter(m => m.lane === 'CANON' && m.confidence < 60);
  const s1RumorsRejected = memories.filter(m => m.lane === 'RUMOR');

  log('bright', '   RETRIEVED:');
  s1Canon.forEach(m => log('green', `      ✅ "${m.content}" (conf: ${m.confidence})`));

  log('bright', '\n   REJECTED:');
  s1Rejected.forEach(m => log('red', `      ❌ "${m.content}" (conf: ${m.confidence} < 60)`));
  s1RumorsRejected.forEach(m => log('red', `      ❌ "${m.content}" (RUMOR, not Theater Zone)`));

  section('🎙️', 'Scenario 2: Podcast Mode (chaos=60, mode=PODCAST)');
  log('dim', '   • Theater Zone: YES (mode=PODCAST)');
  log('dim', '   • Canon memories: YES (confidence >= 60)');
  log('dim', '   • Rumor memories: YES (up to 3, confidence capped at 40)\n');

  const s2Canon = memories.filter(m => m.lane === 'CANON' && m.confidence >= 60);
  const s2Rumors = memories.filter(m => m.lane === 'RUMOR').slice(0, 3);

  log('bright', '   CANON RETRIEVED:');
  s2Canon.forEach(m => log('green', `      ✅ "${m.content}"`));
  log('bright', '\n   RUMORS RETRIEVED:');
  s2Rumors.forEach(m => log('yellow', `      🎭 "${m.content}" (Nicky can embellish this!)`));

  section('😈', 'Scenario 3: FULL PSYCHO (chaos=95, mode=STREAMING)');
  log('dim', '   • Theater Zone: YES (chaos > 70)');
  log('dim', '   • Canon memories: YES (confidence >= 60)');
  log('dim', '   • Rumor memories: YES (UNLIMITED)\n');

  const s3Canon = memories.filter(m => m.lane === 'CANON' && m.confidence >= 60);
  const s3Rumors = memories.filter(m => m.lane === 'RUMOR');

  log('bright', '   CANON RETRIEVED:');
  s3Canon.forEach(m => log('green', `      ✅ "${m.content}"`));
  log('bright', '\n   RUMORS RETRIEVED:');
  s3Rumors.forEach(m => log('yellow', `      🎭 "${m.content}"`));
  log('magenta', '\n   🐻 Nicky can now claim Sal wrestled bears AND runs the mafia!');
}

// DEMO 5
function demoTimingBreakdown() {
  header('DEMO 5: Performance & Cost Analysis');

  const steps = [
    { name: 'Extract keywords', time: 10, api: 0, db: 0 },
    { name: 'Enhance keywords (fetch recent msgs)', time: 50, api: 0, db: 1 },
    { name: 'Generate embedding', time: 200, api: 1, db: 0, cost: '$0.000013' },
    { name: 'Vector search (4,136 memories)', time: 100, api: 0, db: 1 },
    { name: 'Keyword search', time: 50, api: 0, db: 1 },
    { name: 'Fetch podcast memories', time: 50, api: 0, db: 1 },
    { name: 'Search documents', time: 50, api: 0, db: 1 },
    { name: 'Fetch lore context', time: 50, api: 0, db: 1 },
    { name: 'Search training examples', time: 100, api: 0, db: 1 },
    { name: 'Calculate contextual relevance', time: 10, api: 0, db: 0 },
    { name: 'Calculate diversity scores', time: 10, api: 0, db: 0 },
    { name: 'Detect knowledge gaps', time: 10, api: 0, db: 0 },
    { name: 'Prune redundant context', time: 20, api: 0, db: 0 },
  ];

  section('⏱️', 'Time Breakdown Per Message');
  steps.forEach(s => {
    const timeStr = `${s.time}ms`.padEnd(6);
    const apiStr = s.api > 0 ? `${s.api} API` : '';
    const dbStr = s.db > 0 ? `${s.db} DB` : '';
    const costStr = s.cost ? `(${s.cost})` : '';
    log('cyan', `   ${s.name.padEnd(40)} ${timeStr} ${apiStr} ${dbStr} ${costStr}`);
  });

  const total = steps.reduce((sum, s) => sum + s.time, 0);
  const apis = steps.reduce((sum, s) => sum + s.api, 0);
  const dbs = steps.reduce((sum, s) => sum + s.db, 0);

  console.log('   ' + '─'.repeat(68));
  log('bright', `   TOTAL${' '.repeat(34)} ~${total}ms`);
  log('dim', `   API calls: ${apis} | Database queries: ${dbs}`);
  log('red', '\n   ⚠️  This happens BEFORE Nicky even starts talking!');

  section('💰', 'Cost Per Message');
  log('yellow', '   Embedding generation: $0.000013 (Gemini text-embedding-004)');
  log('dim', '   • 100 messages/day = $0.0013/day = $0.47/year');
  log('dim', '   • But you probably send 500+ msgs/day during streams...');
  log('dim', '   • 500 msgs/day = $0.0065/day = $2.37/year (negligible!)');
}

// DEMO 6
function demoRealWorldExample() {
  header('DEMO 6: Real-World Example');

  section('💬', 'Message: "What\'s your favorite pasta?"');

  const allMemories = [
    { id: 1, content: "Nicky's favorite pasta is carbonara", semantic: 0.92, importance: 200, confidence: 95, lane: 'CANON' },
    { id: 2, content: "Nicky HATES cream in carbonara", semantic: 0.78, importance: 180, confidence: 90, lane: 'CANON' },
    { id: 3, content: "Carbonara must have guanciale not bacon", semantic: 0.75, importance: 150, confidence: 85, lane: 'CANON' },
    { id: 4, content: "Nicky once threw a plate at someone who used cream", semantic: 0.68, importance: 50, confidence: 30, lane: 'RUMOR' },
    { id: 5, content: "Nicky's grandmother taught him to cook", semantic: 0.65, importance: 120, confidence: 70, lane: 'CANON' },
    { id: 6, content: "Penne is acceptable but rigatoni is best", semantic: 0.60, importance: 100, confidence: 65, lane: 'CANON' },
    { id: 7, content: "Nicky's favorite color is red", semantic: 0.55, importance: 50, confidence: 80, lane: 'CANON' },
    { id: 8, content: "Nicky has 200 hours in Dead by Daylight", semantic: 0.45, importance: 80, confidence: 95, lane: 'CANON' },
  ];

  log('dim', '\n   Database contains 8 memories about Nicky...\n');

  section('🔍', 'Step 1: Hybrid Search Returns All 8');
  allMemories.forEach(m => {
    log('dim', `   [${m.id}] similarity=${m.semantic.toFixed(2)} "${m.content.substring(0, 50)}..."`);
  });

  section('🎯', 'Step 2: Calculate Scores');
  const scored = allMemories.map(m => {
    const baseScore = (m.semantic * 1.2) + (m.importance * 0.1) + (m.confidence * 0.001);
    const contextRel = 0.5 + (m.importance / 100 * 0.25) + (m.confidence / 100 * 0.1);
    const diversity = m.id <= 3 ? 1.0 : 0.85; // Similar pasta memories get penalized
    const finalScore = baseScore * diversity + contextRel * 0.3;
    return { ...m, baseScore, finalScore };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);

  scored.slice(0, 5).forEach((m, i) => {
    const rank = i + 1;
    log('blue', `\n   ${rank}. "${m.content}"`);
    log('dim', `      Base: ${m.baseScore.toFixed(2)} | Final: ${m.finalScore.toFixed(2)}`);
  });

  section('🔒', 'Step 3: Apply Confidence Filter (>= 60)');
  const filtered = scored.filter(m => m.lane === 'CANON' && m.confidence >= 60);

  log('green', '\n   PASSED FILTER:');
  filtered.slice(0, 5).forEach(m => {
    log('green', `      ✅ "${m.content}" (conf: ${m.confidence})`);
  });

  log('red', '\n   REJECTED:');
  scored.filter(m => m.lane === 'CANON' && m.confidence < 60).forEach(m => {
    log('red', `      ❌ "${m.content}" (conf: ${m.confidence} < 60)`);
  });
  scored.filter(m => m.lane === 'RUMOR').forEach(m => {
    log('red', `      ❌ "${m.content}" (RUMOR, not Theater Zone)`);
  });

  section('⚠️', 'The Problem');
  log('yellow', '   Notice: "Dead by Daylight" made it to rank 4!');
  log('dim', '   Why? High importance (80) + high confidence (95)');
  log('dim', '   Even though it\'s COMPLETELY UNRELATED to pasta.');
  log('red', '\n   This is why importance/confidence are over-weighted.');
}

// MAIN
console.clear();
log('bright', '\n🧠 NICKY\'S MEMORY RETRIEVAL SYSTEM - COMPLETE DEMO\n');
log('dim', 'Demonstrates the complexity of the current memory scoring & retrieval.\n');

demoKeywordExtraction();
demoContextualEnhancement();
demoScoringMechanisms();
demoLaneFiltering();
demoTimingBreakdown();
demoRealWorldExample();

header('SUMMARY & RECOMMENDATIONS');

log('yellow', '🎯 Key Problems Identified:\n');
console.log('   1. EIGHT overlapping scoring mechanisms');
console.log('   2. Importance/confidence over-weighted (unrelated "important" facts leak through)');
console.log('   3. Several tracked fields never used (successRate, qualityScore)');
console.log('   4. ~710ms latency per message (200ms just for embedding)');
console.log('   5. 7 database queries per message (some could be cached)');

log('\ngreen', '💡 Simplification Ideas:\n');
console.log('   1. Remove: successRate, qualityScore, temporalContext (unused)');
console.log('   2. Simplify scoring: semantic_similarity + confidence (drop importance weight)');
console.log('   3. Cache embeddings for your common phrases');
console.log('   4. Run keyword search FIRST, semantic only if <5 results');
console.log('   5. Reduce to 3-4 parallel queries instead of 7');
console.log('   6. Trust the vector search - it already handles relevance well');

log('\ncyan', '📖 Full explanation: docs/MEMORY_SYSTEM_EXPLAINED.md');
log('cyan', '🧪 Test file created: server/tests/memory-retrieval.test.ts\n');
