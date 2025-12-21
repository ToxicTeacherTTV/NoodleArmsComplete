
import "dotenv/config";
import { db } from "../server/db";
import { memoryEntries } from "../shared/schema";
import { gte, lt } from "drizzle-orm";

async function ensureAnchorConfidence() {
  console.log("🛡️  Synchronizing Confidence for Anchor Memories...");

  // Find memories that are Important (>=90) but not Confident (<90)
  const result = await db.update(memoryEntries)
    .set({ confidence: 100 })
    .where(
      gte(memoryEntries.importance, 90)
    )
    .returning();

  console.log(`✅ Updated ${result.length} Anchor memories to 100% Confidence.`);
}

ensureAnchorConfidence().catch(console.error);
