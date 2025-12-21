
import "dotenv/config";
import { db } from "../server/db";
import { memoryEntries } from "../shared/schema";
import { eq, and, inArray } from "drizzle-orm";

async function applyAnchors() {
  console.log("⚓ Applying Anchor Status to Core Memories...");

  // Get all active memories
  const memories = await db.select().from(memoryEntries).where(eq(memoryEntries.status, 'ACTIVE'));
  
  const updates = [];
  const coreKeywords = [
    "Nicky", "Dente", "Noodle Arms", // Self
    "Toxic Teacher", "Host", // User
    "Vinny", "Paulie", "Anthony", "Gnocchi", "Marinara", // Family/Squad
    "Arc Raiders", "Dead by Daylight", "DBD", // Core Games
    "Pasta", "Italian", "Gabagool", // Core Theme
    "Streamer", "Twitch", "Chat", "Camping Them Softly", "Camping the Extract" // Job
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

    // 3. Length Penalty
    if (content.length > 200) score -= 5;

    // Threshold: Needs at least 3 keywords (30 pts) or 2 keywords + Lore bonus (25 pts)
    if (score >= 25 && (memory.importance || 0) < 80) {
      updates.push(memory.id);
      console.log(`✅ Boosting: "${memory.content.substring(0, 60)}..." (Score: ${score})`);
    }
  }

  if (updates.length > 0) {
    console.log(`\n🚀 Updating ${updates.length} memories to Importance 90...`);
    await db.update(memoryEntries)
      .set({ importance: 90, updatedAt: new Date() })
      .where(inArray(memoryEntries.id, updates));
    console.log("✨ Done!");
  } else {
    console.log("No new anchors found.");
  }
}

applyAnchors().catch(console.error);
