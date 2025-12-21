
import "dotenv/config";
import { storage } from "../server/storage";
import { db } from "../server/db";
import { memoryEntries } from "../shared/schema";
import { desc, eq, and, or, like } from "drizzle-orm";

async function analyzeForAnchors() {
  console.log("🧠 Scanning Memory Database for Potential Anchors...");

  // Get all active memories
  const memories = await db.select().from(memoryEntries).where(eq(memoryEntries.status, 'ACTIVE'));
  
  console.log(`Found ${memories.length} total memories.`);

  const candidates = [];

  // Heuristic: Look for Core Identity Keywords
  const coreKeywords = [
    "Nicky", "Dente", "Noodle Arms", // Self
    "Toxic Teacher", "Host", // User
    "Vinny", "Paulie", "Anthony", "Gnocchi", "Marinara", // Family/Squad
    "Arc Raiders", "Dead by Daylight", "DBD", // Core Games
    "Pasta", "Italian", "Gabagool", // Core Theme
    "Streamer", "Twitch", "Chat" // Job
  ];

  for (const memory of memories) {
    let score = 0;
    const content = memory.content.toLowerCase();
    
    // 1. Keyword Match
    for (const keyword of coreKeywords) {
      if (content.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }

    // 2. Type Bonus
    if (memory.type === 'LORE' || memory.type === 'PREFERENCE') score += 5;

    // 3. Length Penalty (Too long = usually just a story, not a core fact)
    if (content.length > 200) score -= 5;

    // 4. Current Importance
    const currentImp = memory.importance || 0;

    if (score >= 10 || currentImp > 50) {
      candidates.push({
        id: memory.id,
        content: memory.content,
        currentImportance: currentImp,
        suggestedScore: score,
        reason: "Contains core identity keywords"
      });
    }
  }

  // Sort by score
  candidates.sort((a, b) => b.suggestedScore - a.suggestedScore);

  console.log("\n🏆 TOP 20 ANCHOR CANDIDATES:");
  candidates.slice(0, 20).forEach((c, i) => {
    console.log(`${i+1}. [Current: ${c.currentImportance}] "${c.content.substring(0, 80)}..."`);
  });
}

analyzeForAnchors().catch(console.error);
