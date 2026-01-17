import 'dotenv/config';
import { storage } from '../storage.js';
import { embeddingServiceInstance } from '../services/embeddingService.js';

async function testGameKnowledgeRetrieval() {
  console.log('🧪 Testing Game Knowledge RAG Retrieval\n');

  try {
    // Get active profile
    const profile = await storage.getActiveProfile();
    if (!profile) {
      console.error('❌ No active profile found');
      process.exit(1);
    }

    console.log(`✅ Active profile: ${profile.name} (ID: ${profile.id})\n`);

    // Test 1: Count DbD facts in database
    console.log('📊 Test 1: Counting DbD/ARC facts in database...');
    const allMemories = await storage.db.query.memoryEntries.findMany({
      where: (memories, { eq }) => eq(memories.profileId, profile.id),
      limit: 10000
    });

    const dbdFacts = allMemories.filter(m => 
      m.content?.toLowerCase().includes('dbd') || 
      m.content?.toLowerCase().includes('dead by daylight') ||
      m.content?.toLowerCase().includes('killer') ||
      m.content?.toLowerCase().includes('survivor')
    );

    const arcFacts = allMemories.filter(m =>
      m.content?.toLowerCase().includes('arc raiders') ||
      m.content?.toLowerCase().includes('arc')
    );

    console.log(`   DbD-related facts: ${dbdFacts.length}`);
    console.log(`   ARC-related facts: ${arcFacts.length}`);
    
    if (dbdFacts.length > 0) {
      const types = Array.from(new Set(dbdFacts.slice(0, 5).map(f => f.type)));
      console.log(`   Sample DbD fact types:`, types);
      console.log(`   Sample DbD fact:`, dbdFacts[0].content?.substring(0, 100) + '...');
    }

    // Test 2: Try the exact query from contextBuilder
    console.log('\n📊 Test 2: Testing exact RAG query from contextBuilder...');
    const query = "Dead by Daylight gameplay mechanics perks killers survivors status effects hatch loop strategy";
    console.log(`   Query: "${query}"`);
    console.log(`   ProfileId: ${profile.id}`);
    console.log(`   Type filter: CANON`);
    
    const results = await embeddingServiceInstance.hybridSearch(query, profile.id, 25, 'CANON');
    console.log(`   Results: ${results.combined.length} facts returned`);
    
    if (results.combined.length > 0) {
      console.log(`   ✅ RAG is working! Sample results:`);
      results.combined.slice(0, 3).forEach((r, i) => {
        console.log(`      ${i + 1}. Type: ${r.type}, Confidence: ${r.confidence}%, Content: ${r.content?.substring(0, 80)}...`);
      });
    } else {
      console.log(`   ❌ RAG returned 0 results despite facts existing`);
      
      // Test 3: Try without type filter
      console.log('\n📊 Test 3: Trying without CANON type filter...');
      const resultsNoFilter = await embeddingServiceInstance.hybridSearch(query, profile.id, 25);
      console.log(`   Results (no type filter): ${resultsNoFilter.combined.length} facts`);
      
      if (resultsNoFilter.combined.length > 0) {
        console.log(`   ✅ Found facts when removing type filter!`);
        const types = Array.from(new Set(resultsNoFilter.combined.map(r => r.type).filter(Boolean)));
        console.log(`   Fact types found:`, types);
        console.log(`   🔍 DIAGNOSIS: Game facts are stored as ${types.join(', ')}, NOT 'CANON'`);
      }

      // Test 4: Try simpler query
      console.log('\n📊 Test 4: Trying simpler query...');
      const simpleQuery = "dbd killer pig";
      const resultsSimple = await embeddingServiceInstance.hybridSearch(simpleQuery, profile.id, 25);
      console.log(`   Query: "${simpleQuery}"`);
      console.log(`   Results: ${resultsSimple.combined.length} facts`);
    }

    console.log('\n✅ Test complete');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testGameKnowledgeRetrieval();
