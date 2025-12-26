import { storage } from "../storage";
import { aiOrchestrator } from "./aiOrchestrator";
import { db } from "../db";
import { memoryEntries } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { AIModel } from "@shared/modelSelection";
import { PsycheProfile } from "./ai-types";
import fs from "fs/promises";
import path from "path";

export interface AuditProgress {
  status: 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalMemories: number;
  auditedCount: number;
  updateCount: number;
  currentBatch: number;
  totalBatches: number;
  startTime?: string;
  endTime?: string;
  error?: string;
  significantChanges: Array<{
    content: string;
    oldImportance: number;
    newImportance: number;
    oldConfidence: number;
    newConfidence: number;
  }>;
}

export class PersonalityAuditor {
  private progressFile = path.join(process.cwd(), "personality_audit_progress.json");

  private async updateProgress(progress: Partial<AuditProgress>) {
    try {
      let current: AuditProgress = {
        status: 'IDLE',
        totalMemories: 0,
        auditedCount: 0,
        updateCount: 0,
        currentBatch: 0,
        totalBatches: 0,
        significantChanges: []
      };

      try {
        const data = await fs.readFile(this.progressFile, 'utf-8');
        current = JSON.parse(data);
      } catch (e) {
        // File doesn't exist or is invalid, use default
      }

      const updated = { ...current, ...progress };
      await fs.writeFile(this.progressFile, JSON.stringify(updated, null, 2));
    } catch (error) {
      console.error("Failed to update audit progress file:", error);
    }
  }

  async getProgress(): Promise<AuditProgress> {
    try {
      const data = await fs.readFile(this.progressFile, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return {
        status: 'IDLE',
        totalMemories: 0,
        auditedCount: 0,
        updateCount: 0,
        currentBatch: 0,
        totalBatches: 0,
        significantChanges: []
      };
    }
  }

  async clearProgress() {
    try {
      const idle: AuditProgress = {
        status: 'IDLE',
        totalMemories: 0,
        auditedCount: 0,
        updateCount: 0,
        currentBatch: 0,
        totalBatches: 0,
        significantChanges: []
      };
      await fs.writeFile(this.progressFile, JSON.stringify(idle, null, 2));
    } catch (error) {
      console.error("Failed to clear audit progress file:", error);
    }
  }

  /**
   * 🧠 Generates a comprehensive "Psyche Profile" based on core memories.
   */
  async generatePsyche(profileId: string, model: AIModel = 'gemini-3-flash-preview'): Promise<PsycheProfile> {
    console.log("🧠 Generating Psyche Profile...");
    
    // 1. Fetch core memories (Importance >= 90 or Protected)
    // Use a high limit to ensure we see all potential core memories
    const memories = await storage.getMemoryEntries(profileId, 10000);
    const coreMemories = memories
      .filter(m => (m.importance || 0) >= 90)
      .map(m => `- ${m.content}`)
      .join('\n');

    try {
      return await aiOrchestrator.generatePsycheProfile(coreMemories, model);
    } catch (error) {
      console.error("❌ Failed to generate Psyche Profile:", error);
      return {
        coreIdentity: "Chaotic, foul-mouthed, loyal but abrasive.",
        keyRelationships: "SABAM crew is family; Toxic is a rival/friend.",
        worldview: "The world is a mess and everyone is an idiot.",
        emotionalTriggers: "Disloyalty, being called soft, losing at games.",
        recentObsessions: "ARC Raiders, Camping the Extract podcast."
      };
    }
  }

  /**
   * ⚖️ Audits all memories against the Psyche Profile and re-scores them.
   */
  async auditMemories(profileId: string, psyche: PsycheProfile, model: AIModel = 'gemini-3-flash-preview'): Promise<{ totalAudited: number, updates: number }> {
    console.log("⚖️ Starting Personality Audit of all memories...");
    
    // Fetch all memories (up to 10,000) to ensure we cover the entire bank
    const memories = await storage.getMemoryEntries(profileId, 10000);
    const totalMemories = memories.length;
    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(totalMemories / BATCH_SIZE);

    await this.updateProgress({
      status: 'PROCESSING',
      totalMemories,
      auditedCount: 0,
      updateCount: 0,
      currentBatch: 0,
      totalBatches,
      startTime: new Date().toISOString(),
      significantChanges: []
    });

    let totalAudited = 0;
    let updates = 0;
    const significantChanges: AuditProgress['significantChanges'] = [];
    
    for (let i = 0; i < memories.length; i += BATCH_SIZE) {
      const batch = memories.slice(i, i + BATCH_SIZE);
      const currentBatchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`⚖️ Auditing batch ${currentBatchNum}/${totalBatches}...`);
      
      await this.updateProgress({
        currentBatch: currentBatchNum,
        auditedCount: totalAudited
      });

      try {
        const results = await aiOrchestrator.auditMemoriesBatch(
          psyche, 
          batch.map((m, idx) => ({ id: idx, content: m.content })),
          model
        );
        
        // 🚀 BATCH UPDATE: Collect all updates for this batch and run in a transaction
        const updatesToApply = results
          .map(result => {
            const memory = batch[result.id];
            if (memory && (result.importance !== memory.importance || result.confidence !== memory.confidence)) {
              return {
                id: memory.id,
                importance: result.importance,
                confidence: result.confidence,
                content: memory.content // for tracking significant changes
              };
            }
            return null;
          })
          .filter((u): u is NonNullable<typeof u> => u !== null);

        if (updatesToApply.length > 0) {
          try {
            await db.transaction(async (tx) => {
              for (const update of updatesToApply) {
                // Track significant changes (e.g., importance change > 20)
                const originalMemory = batch.find(m => m.id === update.id);
                if (originalMemory && Math.abs((update.importance || 0) - (originalMemory.importance || 0)) > 20 && significantChanges.length < 10) {
                  significantChanges.push({
                    content: update.content.substring(0, 100) + (update.content.length > 100 ? '...' : ''),
                    oldImportance: originalMemory.importance || 0,
                    newImportance: update.importance || 0,
                    oldConfidence: originalMemory.confidence || 0,
                    newConfidence: update.confidence || 0
                  });
                }

                await tx.update(memoryEntries)
                  .set({ 
                    importance: update.importance, 
                    confidence: update.confidence,
                    lastSeenAt: new Date()
                  })
                  .where(eq(memoryEntries.id, update.id));
                updates++;
              }
            });
          } catch (dbError) {
            console.error(`❌ Database transaction failed for batch starting at ${i}:`, dbError);
            // Retry once after a short delay if it's a connection issue
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
              await db.transaction(async (tx) => {
                for (const update of updatesToApply) {
                  await tx.update(memoryEntries)
                    .set({ 
                      importance: update.importance, 
                      confidence: update.confidence,
                      lastSeenAt: new Date()
                    })
                    .where(eq(memoryEntries.id, update.id));
                }
              });
              console.log(`✅ Retry successful for batch starting at ${i}`);
            } catch (retryError) {
              console.error(`❌ Retry failed for batch starting at ${i}:`, retryError);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Failed to audit batch starting at ${i}:`, error);
      }
      
      totalAudited += batch.length;
      
      // Small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`✅ Personality Audit complete. Audited ${totalAudited} memories, updated ${updates}.`);
    
    await this.updateProgress({
      status: 'COMPLETED',
      auditedCount: totalAudited,
      updateCount: updates,
      endTime: new Date().toISOString(),
      significantChanges
    });

    return { totalAudited, updates };
  }
}

export const personalityAuditor = new PersonalityAuditor();
