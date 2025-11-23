
import { storage } from "../storage";
import { embeddingService } from "../services/embeddingService";

async function main() {
  console.log("🚀 Starting embedding backfill process...");

  try {

    // Get active profile
    const activeProfile = await storage.getActiveProfile();
    if (!activeProfile) {
      console.error("❌ No active profile found. Please set an active profile first.");
      process.exit(1);
    }

    console.log(`👤 Active Profile: ${activeProfile.name} (${activeProfile.id})`);
    console.log(`🤖 Using Model: text-embedding-004 (Gemini)`);

    // Run the backfill
    console.log("⏳ This may take a few minutes depending on the number of memories...");
    const result = await embeddingService.generateEmbeddingsForAllMemories(activeProfile.id);

    console.log(`\n✅ Backfill Complete!`);
    console.log(`📊 Processed: ${result.processed}`);
    console.log(`✨ Successful: ${result.successful}`);
    
    if (result.processed > result.successful) {
        console.warn(`⚠️ Failed: ${result.processed - result.successful}`);
    }

  } catch (error) {
    console.error("❌ Fatal error during backfill:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
