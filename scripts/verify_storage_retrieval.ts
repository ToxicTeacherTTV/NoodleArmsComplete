
import 'dotenv/config';
import { storage } from '../server/storage';
import { db } from '../server/db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function verifyRetrieval() {
  console.log("🚀 Verifying Training Example Retrieval...");

  // 1. Check DB directly for total count and status
  const allDocs = await db.select().from(documents).where(eq(documents.documentType, 'TRAINING_EXAMPLE'));
  const quarantined = allDocs.filter(d => (d.processingMetadata as any)?.validationStatus === 'QUARANTINE');
  
  console.log(`DB Count: ${allDocs.length}`);
  console.log(`DB Quarantined: ${quarantined.length}`);

  // 2. Check Storage Retrieval (should filter out bad ones)
  const profileId = allDocs[0]?.profileId;
  if (!profileId) {
      console.log("No profile ID found, skipping storage check.");
      return;
  }

  const retrieved = await storage.getTrainingExamples(profileId, 50);
  console.log(`Storage Retrieved: ${retrieved.length}`);

  if (retrieved.length === 0 && allDocs.length > 0) {
      console.log("✅ SUCCESS: Quarantined items were filtered out.");
  } else if (retrieved.length < allDocs.length) {
      console.log("✅ SUCCESS: Some items were filtered out.");
  } else {
      console.log("❌ FAILURE: No items were filtered out.");
  }

  process.exit(0);
}

verifyRetrieval();
