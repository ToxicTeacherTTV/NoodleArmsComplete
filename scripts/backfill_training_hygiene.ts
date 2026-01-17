
import 'dotenv/config';
import { db } from '../server/db';
import { documents } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { trainingDataValidator } from '../server/services/trainingDataValidator';
import { trainingDataNormalizer } from '../server/services/trainingDataNormalizer';

async function backfillHygiene() {
  console.log("🚀 Starting Training Data Hygiene Backfill...");

  try {
    // Fetch all training examples
    const examples = await db.select().from(documents)
      .where(eq(documents.documentType, 'TRAINING_EXAMPLE'))
      .orderBy(desc(documents.createdAt));

    console.log(`Found ${examples.length} training examples.`);
    let stats = {
      valid: 0,
      normalized: 0,
      quarantined: 0,
      failed: 0
    };

    for (const doc of examples) {
      console.log(`\n--- Processing Doc ID: ${doc.id} ---`);
      
      const rawContent = doc.extractedContent || doc.content || ""; // Handle both potential sources
      
      // 1. Initial Validate
      let validation = trainingDataValidator.validate(rawContent);
      let normalizedContent: string | undefined = undefined;
      let finalStatus = validation.status;

      // 2. Normalize if needed
      if (validation.status === 'FIXABLE') {
        console.log(`   🛠️ Needs Normalization (Issues: ${validation.issues.details.join(', ')})`);
        
        try {
            normalizedContent = trainingDataNormalizer.normalize(rawContent);
            
            // Re-validate normalized content
            const revalidation = trainingDataValidator.validate(normalizedContent);
            console.log(`   ✅ Normalized Score: ${revalidation.score}`);
            
            finalStatus = revalidation.status === 'VALID' ? 'NORMALIZED' : revalidation.status;
            
            // If still bad after normalization, logic flow?
            // If revalidation says 'FIXABLE' (maybe we missed something?), we treat as NORMALIZED but low score?
            // If revalidation says 'QUARANTINE' (unlikely if normalizer works), we quarantine.
            validation = revalidation; 

        } catch (err) {
            console.error(`   ❌ Normalization Failed: ${err}`);
            finalStatus = 'QUARANTINE';
        }
      } else if (validation.status === 'QUARANTINE') {
          console.log(`   🚫 QUARANTINE: ${validation.issues.details.join(', ')}`);
      } else {
          console.log(`   ✨ Valid (Score: ${validation.score})`);
      }

      // 3. Prepare Update
      const existingMeta = (doc.processingMetadata as any) || {};
      const newMeta = {
        ...existingMeta,
        tagQualityScore: validation.score,
        validationStatus: finalStatus,
        quarantineReason: finalStatus === 'QUARANTINE' ? validation.issues.details.join('; ') : undefined,
        originalContent: rawContent, // Always store original for consistency? Or only if normalized? User said "For backfill, keep: originalContent"
        normalizedContent: normalizedContent // Undefined if VALID or QUARANTINED (unless we want to store normalized even for valid?)
                                             // Ideally, if VALID, normalizedContent is just rawContent. 
                                             // But to save space, let's only store if different.
      };

      // 4. Update DB
      await db.update(documents)
        .set({ processingMetadata: newMeta })
        .where(eq(documents.id, doc.id));
        
      console.log(`   💾 Updated metadata. Status: ${finalStatus}`);

      // Stats
      if (finalStatus === 'VALID') stats.valid++;
      else if (finalStatus === 'NORMALIZED') stats.normalized++;
      else if (finalStatus === 'QUARANTINE') stats.quarantined++;
      else stats.failed++;
    }

    console.log("\n=== BACKFILL COMPLETE ===");
    console.log(JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error("Backfill failed:", error);
  } finally {
    process.exit(0);
  }
}

backfillHygiene();
