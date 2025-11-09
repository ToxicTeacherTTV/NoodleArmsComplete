#!/usr/bin/env tsx
/**
 * Add DbD patch knowledge from podcast episodes
 * This ensures Nicky knows about recent patches when asked
 */

import { db } from '../server/db.js';
import { memoryEntries, profiles } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function addPatchKnowledge() {
  console.log('📝 Adding DbD patch knowledge from podcast episodes...\n');

  // Get Nicky's profile
  const [nicky] = await db.select().from(profiles).where(eq(profiles.name, 'Nicky')).limit(1);
  if (!nicky) {
    console.error('❌ Nicky profile not found');
    process.exit(1);
  }

  const patches = [
    {
      content: 'Dead by Daylight patch 9.3.0 exists and came after patch 9.2.0',
      keywords: ['dead by daylight', 'dbd', 'patch', '9.3.0', 'bhvr', 'update'],
      importance: 850,
      temporalContext: 'DbD Patch 9.3.0 (2025)',
      storyContext: 'Current DbD game version knowledge'
    },
    {
      content: 'BHVR nerfed fog vials to 2 charges in Dead by Daylight patch 9.1.2 after survivor mains abused them',
      keywords: ['dead by daylight', 'dbd', 'patch', '9.1.2', 'fog vials', 'nerf', 'bhvr', 'survivor mains'],
      importance: 800,
      temporalContext: 'DbD Patch 9.1.2 (August 2025)',
      storyContext: 'Fog vials were nerfed from infinite charges to 2 charges due to survivor abuse'
    },
    {
      content: 'Dead by Daylight patch 9.2.0 came between patch 9.1.2 and patch 9.3.0',
      keywords: ['dead by daylight', 'dbd', 'patch', '9.2.0', 'bhvr', 'update'],
      importance: 800,
      temporalContext: 'DbD Patch 9.2.0 (2025)',
      storyContext: 'Patch version timeline'
    },
    {
      content: 'As of November 2025, Dead by Daylight patches follow the X.Y.Z numbering format (e.g., 9.1.2, 9.2.0, 9.3.0), not "patch 8" style numbering',
      keywords: ['dead by daylight', 'dbd', 'patch', 'version', 'numbering', 'bhvr'],
      importance: 900,
      temporalContext: 'DbD Patch Numbering System (2025)',
      storyContext: 'How BHVR names their patches - important for accuracy'
    },
    {
      content: 'BHVR delayed the November chapter to January 2026 according to their roadmap update discussed on Camping Them Softly podcast',
      keywords: ['dead by daylight', 'dbd', 'bhvr', 'chapter', 'delay', 'november', 'january', 'roadmap'],
      importance: 850,
      temporalContext: 'BHVR Roadmap Update (August 2025)',
      storyContext: 'Chapter release delays - discussed in Episode 66'
    }
  ];

  let added = 0;
  for (const patch of patches) {
    try {
      await db.insert(memoryEntries).values({
        profileId: nicky.id,
        type: 'FACT',
        content: patch.content,
        keywords: patch.keywords,
        importance: patch.importance,
        confidence: 99, // High confidence - from podcast
        source: 'podcast_knowledge',
        sourceId: 'camping_them_softly_rss',
        temporalContext: patch.temporalContext,
        storyContext: patch.storyContext,
        qualityScore: 5,
        retrievalCount: 0,
        successRate: 100,
        supportCount: 1,
        canonicalKey: `dbd_patch_${patch.keywords[2]}_${Date.now()}`.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      });
      console.log(`✅ Added: ${patch.content.substring(0, 80)}...`);
      added++;
    } catch (error) {
      console.warn(`⚠️ Failed to add patch fact: ${error}`);
    }
  }

  console.log(`\n✅ Added ${added}/${patches.length} patch facts to Nicky's knowledge base`);
  console.log(`\n💡 Now Nicky will know:`);
  console.log(`   - Latest patch is 9.3.0 (not "patch 8")`);
  console.log(`   - Patch numbering format is X.Y.Z`);
  console.log(`   - Recent fog vial nerf in 9.1.2`);
  console.log(`   - Chapter delays and roadmap info`);
  
  process.exit(0);
}

addPatchKnowledge().catch((error) => {
  console.error('❌ Failed to add patch knowledge:', error);
  process.exit(1);
});
