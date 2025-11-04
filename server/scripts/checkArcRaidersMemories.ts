#!/usr/bin/env tsx
/**
 * Quick script to check if Arc Raiders document was processed
 * and what memories exist about the game
 */

import { storage } from '../storage';

async function checkArcRaidersMemories() {
  console.log('🔍 Searching for Arc Raiders memories...\n');
  
  // Get all profiles (usually just Nicky)
  const profiles = await storage.listProfiles();
  
  for (const profile of profiles) {
    console.log(`\n📊 Profile: ${profile.name} (${profile.id})`);
    console.log('─'.repeat(60));
    
    // Search for Arc Raiders related memories using searchMemoryEntries
    const searchQuery = 'Arc Raiders extraction shooter';
    const arcMemories = await storage.searchMemoryEntries(profile.id, searchQuery);
    
    // Also get all memories and filter for Arc Raiders
    const allMemories = await storage.getMemoryEntries(profile.id, 1000);
    const arcFilteredMemories = allMemories.filter(mem => 
      mem.content?.toLowerCase().includes('arc raiders') ||
      mem.content?.toLowerCase().includes('arc raider') ||
      mem.keywords?.some(k => k.toLowerCase().includes('arc') || k.toLowerCase().includes('raider'))
    );
    
    const combinedMemories = Array.from(new Set([...arcMemories, ...arcFilteredMemories].map(m => m.id)))
      .map(id => [...arcMemories, ...arcFilteredMemories].find(m => m.id === id)!);
    
    if (combinedMemories.length === 0) {
      console.log('❌ No Arc Raiders memories found');
      console.log('\n💡 Recommendation: Document may not have been processed yet, or');
      console.log('   you need to add bridging memories manually.\n');
    } else {
      console.log(`✅ Found ${combinedMemories.length} Arc Raiders related memories:\n`);
      
      combinedMemories.slice(0, 20).forEach((mem, idx) => {
        console.log(`${idx + 1}. [${mem.type}] (importance: ${mem.importance})`);
        console.log(`   ${mem.content.substring(0, 100)}${mem.content.length > 100 ? '...' : ''}`);
        console.log(`   Keywords: ${mem.keywords?.join(', ') || 'none'}`);
        if (mem.storyContext) {
          console.log(`   Context: ${mem.storyContext.substring(0, 80)}...`);
        }
        console.log();
      });
      
      if (combinedMemories.length > 20) {
        console.log(`   ... and ${combinedMemories.length - 20} more\n`);
      }
    }
  }
}

checkArcRaidersMemories()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
