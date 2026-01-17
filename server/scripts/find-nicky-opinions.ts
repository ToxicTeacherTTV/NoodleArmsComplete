/**
 * Find facts that claim to be Nicky's opinions
 * These might be Toxic's opinions incorrectly attributed to Nicky
 */

import { storage } from "../storage.js";

async function main() {
  console.log('🔌 Connecting...\n');

  const profile = await storage.getActiveProfile();
  if (!profile) {
    console.error('No active profile');
    process.exit(1);
  }

  const allMemories = await storage.getMemoryEntries(profile.id, 99999);
  const podcastFacts = allMemories.filter(m => m.source === 'podcast_episode');

  console.log(`📊 Total podcast facts: ${podcastFacts.length}\n`);

  // Find facts that claim Nicky thinks/believes something
  const nickyOpinions = podcastFacts.filter(f =>
    /nicky (thinks|believes|prefers|likes|hates|loves|feels|considers|wants|enjoys)/i.test(f.content)
  );

  console.log(`🎯 Facts claiming to be NICKY's opinions: ${nickyOpinions.length}\n`);
  console.log('These are the ones that MIGHT be YOUR opinions mislabeled as Nicky\'s:\n');
  console.log('=' .repeat(60) + '\n');

  nickyOpinions.forEach((f, i) => {
    console.log(`${i+1}. ${f.content}`);
    console.log(`   📅 ${f.temporalContext || 'Unknown source'}\n`);
  });

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
