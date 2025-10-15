import { db } from '../db.js';
import { contentFlags, memoryEntries } from '../../shared/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { aiFlagger } from '../services/aiFlagger.js';

/**
 * Re-analyze HIGH/CRITICAL priority content flags from before Flash ban
 * to identify and reject Flash hallucinations
 */
async function reanalyzeCriticalFlags(profileId: string) {
  console.log('🎯 Re-analyzing HIGH/CRITICAL priority flags from before Flash ban...');
  console.log('⏱️  Estimated time: ~44 minutes (2,645 flags at 1/sec)');
  
  // Get HIGH/CRITICAL flags from before Oct 14, 2025 (when Flash was banned)
  const criticalFlags = await db
    .select()
    .from(contentFlags)
    .where(
      and(
        eq(contentFlags.profileId, profileId),
        eq(contentFlags.reviewStatus, 'PENDING'),
        inArray(contentFlags.priority, ['HIGH', 'CRITICAL']),
        sql`${contentFlags.createdAt} < '2025-10-14'`
      )
    )
    .orderBy(contentFlags.priority, contentFlags.createdAt);
  
  console.log(`📊 Found ${criticalFlags.length} critical flags to re-analyze\n`);
  
  let reanalyzed = 0;
  let confirmed = 0;
  let changed = 0;
  let errors = 0;
  let skipped = 0;
  
  const startTime = Date.now();
  
  for (const flag of criticalFlags) {
    try {
      // Get the original content
      let content = '';
      if (flag.targetType === 'MEMORY') {
        const [memory] = await db
          .select()
          .from(memoryEntries)
          .where(eq(memoryEntries.id, flag.targetId))
          .limit(1);
        content = memory?.content || '';
      }
      
      if (!content) {
        console.log(`⚠️  No content found for flag ${flag.id}, skipping`);
        skipped++;
        continue;
      }
      
      // Progress indicator
      const percent = Math.round((reanalyzed / criticalFlags.length) * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
      console.log(`[${percent}%] ${reanalyzed + 1}/${criticalFlags.length} | ${elapsed}m elapsed | ${flag.priority} ${flag.flagType}`);
      
      // Re-analyze with Pro (Anthropic → Gemini Pro fallback)
      const newAnalysis = await aiFlagger.analyzeContent(
        content,
        flag.targetType,
        { profileId: flag.profileId }
      );
      
      // Check if the same flag type appears in new analysis with similar priority
      const stillValid = newAnalysis.flags.some(f => 
        f.flagType === flag.flagType && 
        (f.priority === flag.priority || 
         (flag.priority === 'CRITICAL' && f.priority === 'HIGH') ||
         (flag.priority === 'HIGH' && f.priority === 'CRITICAL'))
      );
      
      if (stillValid) {
        console.log(`   ✅ Confirmed: ${flag.flagType} still valid`);
        // Mark as reviewed and confirmed
        await db
          .update(contentFlags)
          .set({ 
            reviewStatus: 'APPROVED',
            flagReason: `[Pro Re-analysis ${new Date().toISOString().split('T')[0]}] ${flag.flagReason}`
          })
          .where(eq(contentFlags.id, flag.id));
        confirmed++;
      } else {
        console.log(`   ❌ FLASH HALLUCINATION: ${flag.flagType} rejected`);
        // Mark as rejected (Flash hallucination)
        await db
          .update(contentFlags)
          .set({ 
            reviewStatus: 'REJECTED',
            flagReason: `[FLASH HALLUCINATION - Rejected by Pro ${new Date().toISOString().split('T')[0]}] ${flag.flagReason}`
          })
          .where(eq(contentFlags.id, flag.id));
        changed++;
      }
      
      reanalyzed++;
      
      // Rate limit (1 per second for Gemini Pro to avoid quota issues)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ❌ Failed to re-analyze flag ${flag.id}:`, error);
      errors++;
      // Continue with next flag despite error
    }
  }
  
  const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 CLEANUP RESULTS:');
  console.log('='.repeat(60));
  console.log(`✅ Confirmed valid: ${confirmed} (${Math.round(confirmed/reanalyzed*100)}%)`);
  console.log(`❌ Rejected (Flash hallucinations): ${changed} (${Math.round(changed/reanalyzed*100)}%)`);
  console.log(`⚠️  Skipped (no content): ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📈 Total processed: ${reanalyzed}/${criticalFlags.length}`);
  console.log(`⏱️  Time taken: ${totalTime} minutes`);
  console.log('='.repeat(60));
  
  return {
    total: criticalFlags.length,
    processed: reanalyzed,
    confirmed,
    rejected: changed,
    skipped,
    errors,
    timeMinutes: totalTime
  };
}

// Get profile ID from command line or use default
const profileId = process.argv[2] || '3a3fe4fc-9187-4ca0-a21b-75077885e128'; // Nicky's profile (correct ID)

console.log(`\n🚀 Starting Flash hallucination cleanup for profile: ${profileId}\n`);

reanalyzeCriticalFlags(profileId)
  .then(results => {
    console.log('\n✅ Cleanup complete!');
    console.log(`\nFlash hallucinations detected: ${results.rejected}`);
    console.log(`Valid flags preserved: ${results.confirmed}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });
