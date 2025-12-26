import { db } from "../db";
import { memoryEntries } from "@shared/schema";
import { eq, sql, and, desc, gt } from "drizzle-orm";
import { storage } from "../storage";

export class ImportancePropagator {
  
  /**
   * 🌊 Propagates importance from "Anchor Memories" (High Importance) to related memories.
   * Uses vector similarity as a proxy for relatedness if explicit links are missing.
   */
  async propagateImportance(profileId: string, dryRun: boolean = false): Promise<{ updatedCount: number, details: string[] }> {
    console.log("🌊 Starting Importance Propagation...");
    
    // 1. Get all active memories with embeddings
    const memories = await storage.getMemoryEntriesWithEmbeddings(profileId);
    
    if (memories.length === 0) {
      return { updatedCount: 0, details: ["No memories found."] };
    }

    // 2. Identify Anchors (Importance >= 80)
    const anchors = memories.filter(m => (m.importance || 0) >= 80);
    console.log(`⚓ Found ${anchors.length} Anchor Memories (Importance >= 80)`);

    if (anchors.length === 0) {
      return { updatedCount: 0, details: ["No Anchor Memories found to propagate from."] };
    }

    const updates: { id: string, oldImp: number, newImp: number, reason: string }[] = [];

    // 3. For each Anchor, find neighbors and boost them
    for (const anchor of anchors) {
      // We can't do full N^2 comparison in JS for large datasets, but for <1000 it's fine.
      // For larger, we should use pgvector queries, but here we want to iterate anchors.
      
      // Let's use the database to find neighbors for this anchor to be efficient
      const neighbors = await storage.findSimilarMemories(
        profileId, 
        anchor.embedding!, 
        20, // Limit neighbors
        0.75 // Similarity threshold (must be fairly close)
      );

      for (const neighbor of neighbors) {
        // Skip if neighbor is already an anchor
        if ((neighbor.importance || 0) >= 80) continue;
        
        // Skip if it's the anchor itself
        if (neighbor.id === anchor.id) continue;

        // Calculate Boost
        // Formula: Boost = (AnchorImportance - NeighborImportance) * Similarity * Damping
        // e.g. (90 - 5) * 0.8 * 0.1 = 85 * 0.08 = +6.8 points
        const similarity = neighbor.similarity;
        const currentImp = neighbor.importance || 0;
        const anchorImp = anchor.importance || 0;
        
        // 🕒 NEW: Anchor Age Decay
        // Older anchors have less "pull"
        const anchorAgeDays = anchor.createdAt ? 
          (Date.now() - new Date(anchor.createdAt).getTime()) / (1000 * 60 * 60 * 24) : 0;
        const decayFactor = Math.max(0.5, 1.0 - (anchorAgeDays / 365)); // Lose up to 50% pull over a year
        
        // Only boost if anchor is significantly higher
        if (anchorImp > currentImp) {
          const boost = Math.round((anchorImp - currentImp) * similarity * 0.1 * decayFactor); // Reduced to 10% transfer rate + decay
          
          if (boost > 0) {
            const newImp = Math.min(75, currentImp + boost); // Cap propagated importance at 75 (below Anchor threshold)
            
            // Check if we already queued an update for this memory
            const existingUpdate = updates.find(u => u.id === neighbor.id);
            if (existingUpdate) {
              // Keep the higher boost
              if (newImp > existingUpdate.newImp) {
                existingUpdate.newImp = newImp;
                existingUpdate.reason = `Boosted by "${anchor.content.substring(0, 20)}..." (Sim: ${similarity.toFixed(2)})`;
              }
            } else {
              updates.push({
                id: neighbor.id,
                oldImp: currentImp,
                newImp: newImp,
                reason: `Boosted by "${anchor.content.substring(0, 20)}..." (Sim: ${similarity.toFixed(2)})`
              });
            }
          }
        }
      }
    }

    // 4. Apply Updates
    console.log(`🌊 Propagating importance to ${updates.length} memories...`);
    
    if (!dryRun) {
      for (const update of updates) {
        // Only update if the new importance is actually higher than what's in DB 
        // (in case of race conditions, though unlikely here)
        await db.update(memoryEntries)
          .set({ 
            importance: update.newImp,
            updatedAt: new Date()
          })
          .where(and(
            eq(memoryEntries.id, update.id),
            sql`${memoryEntries.importance} < ${update.newImp}` // Safety check
          ));
      }
    }

    return {
      updatedCount: updates.length,
      details: updates.map(u => `[${u.oldImp} -> ${u.newImp}] ${u.reason}`)
    };
  }
}

export const importancePropagator = new ImportancePropagator();
