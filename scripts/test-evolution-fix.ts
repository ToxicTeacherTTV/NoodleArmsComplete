
import { config } from "dotenv";
config();

import EvolutionaryAI from "../server/services/evolutionaryAI.js";
import { storage } from "../server/storage.js";

async function testEvolution() {
  console.log("🧪 Testing Evolutionary AI Fix...");
  
  try {
    const evolutionaryAI = new EvolutionaryAI();
    
    // Mock some memory entries if DB is empty or just to test
    const mockMemories = [
      {
        id: "test-1",
        content: "Nicky loves Dead by Daylight.",
        type: "FACT",
        importance: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        profileId: "nicky",
        qualityScore: 8,
        metadata: {},
        embedding: null
      },
      {
        id: "test-2",
        content: "Nicky hates playing against the Nurse in DBD.",
        type: "PREFERENCE",
        importance: 9,
        createdAt: new Date(),
        updatedAt: new Date(),
        profileId: "nicky",
        qualityScore: 9,
        metadata: {},
        embedding: null
      }
    ];

    console.log("Calling evolutionaryOptimization...");
    // We cast to any because the mock doesn't match the full DB schema perfectly but is enough for the service
    const result = await evolutionaryAI.evolutionaryOptimization(mockMemories as any);
    
    console.log("✅ Optimization successful!");
    console.log("Clusters:", result.clusters.length);
    console.log("Relationships:", result.relationships.length);
    console.log("Gaps:", result.knowledgeGaps.length);
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
  
  process.exit(0);
}

testEvolution();
