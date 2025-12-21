
import "dotenv/config";
import { db } from "../server/db";
import { memoryEntries } from "../shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../server/storage";
import EvolutionaryAI from "../server/services/evolutionaryAI";

async function runEvolution() {
  console.log("🧬 Starting Evolutionary Analysis...");

  // Get active profile
  const activeProfile = await storage.getActiveProfile();
  if (!activeProfile) {
    console.error("❌ No active profile found.");
    return;
  }
  const profileId = activeProfile.id;
  console.log(`👤 Using Profile: ${activeProfile.name} (${profileId})`);

  // Get reliable memories
  const reliableMemories = await storage.getReliableMemoriesForAI(profileId, 1000);
  console.log(`📚 Analyzing ${reliableMemories.length} reliable memories...`);

  if (reliableMemories.length === 0) {
    console.log("⚠️ No reliable memories found. Aborting.");
    return;
  }

  // Run Evolution
  const evolutionaryAI = new EvolutionaryAI();
  const result = await evolutionaryAI.evolutionaryOptimization(reliableMemories);

  // Save Results
  console.log("💾 Saving Results to Database...");

  // 1. Save Relationships
  let relCount = 0;
  for (const rel of result.relationships) {
    const sourceFact = reliableMemories.find(m => m.id === rel.sourceFactId);
    if (sourceFact) {
      const currentRels = sourceFact.relationships || [];
      if (!currentRels.includes(rel.targetFactId)) {
        await db.update(memoryEntries)
          .set({ 
            relationships: [...currentRels, rel.targetFactId],
            updatedAt: new Date()
          })
          .where(eq(memoryEntries.id, rel.sourceFactId));
        relCount++;
      }
    }
  }
  console.log(`   - Saved ${relCount} new relationships.`);

  // 2. Save Clusters
  let clusterCount = 0;
  for (const cluster of result.clusters) {
    for (const factId of cluster.factIds) {
      await db.update(memoryEntries)
        .set({ 
          clusterId: cluster.name, 
          updatedAt: new Date()
        })
        .where(eq(memoryEntries.id, factId));
    }
    clusterCount++;
  }
  console.log(`   - Created ${clusterCount} clusters.`);

  console.log("✨ Evolution Complete!");
  console.log(`   - Knowledge Gaps Found: ${result.knowledgeGaps.length}`);
}

runEvolution().catch(console.error);
