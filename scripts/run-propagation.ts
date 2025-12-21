
import "dotenv/config";
import { propagateImportance } from "../server/services/importancePropagator";

async function run() {
  console.log("🌊 Starting Importance Propagation...");
  try {
    const result = await propagateImportance();
    console.log("✅ Propagation Complete!");
    console.log(`- Anchors Used: ${result.anchorsProcessed}`);
    console.log(`- Memories Boosted: ${result.propagatedCount}`);
  } catch (error) {
    console.error("❌ Propagation Failed:", error);
  }
}

run();
