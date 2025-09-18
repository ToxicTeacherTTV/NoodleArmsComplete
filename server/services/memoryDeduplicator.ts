import { eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { memoryEntries } from "@shared/schema";

// Use the actual database schema type
type MemoryEntry = typeof memoryEntries.$inferSelect;

export interface DuplicateGroup {
  masterEntry: MemoryEntry;
  duplicates: MemoryEntry[];
  similarity: number;
  mergedContent: string;
  combinedImportance: number;
  combinedKeywords: string[];
  combinedRelationships: string[];
}

export class MemoryDeduplicator {
  
  /**
   * Calculate text similarity using multiple techniques
   */
  calculateSimilarity(text1: string, text2: string): number {
    const similarity1 = this.jaccardSimilarity(text1, text2);
    const similarity2 = this.levenshteinSimilarity(text1, text2);
    const similarity3 = this.containmentSimilarity(text1, text2);
    
    // Weighted combination of similarity measures
    return (similarity1 * 0.4) + (similarity2 * 0.3) + (similarity3 * 0.3);
  }
  
  /**
   * Jaccard similarity using word sets
   */
  private jaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * Normalized Levenshtein distance
   */
  private levenshteinSimilarity(text1: string, text2: string): number {
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 1;
  }
  
  /**
   * Check if one text contains significant portions of the other
   */
  private containmentSimilarity(text1: string, text2: string): number {
    const shorter = text1.length < text2.length ? text1 : text2;
    const longer = text1.length < text2.length ? text2 : text1;
    
    if (shorter.length === 0) return 0;
    
    const shorterWords = shorter.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const longerLower = longer.toLowerCase();
    
    let matchedWords = 0;
    for (const word of shorterWords) {
      if (longerLower.includes(word)) {
        matchedWords++;
      }
    }
    
    return shorterWords.length > 0 ? matchedWords / shorterWords.length : 0;
  }
  
  /**
   * Levenshtein distance calculation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Find duplicate groups in a set of memory entries
   */
  async findDuplicateGroups(
    db: PostgresJsDatabase<any>,
    profileId: string,
    similarityThreshold: number = 0.7
  ): Promise<DuplicateGroup[]> {
    console.log(`🔍 Finding duplicate groups for profile ${profileId} with threshold ${similarityThreshold}`);
    
    // Get all memories for the profile
    const memories = await db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.profileId, profileId))
      .orderBy(memoryEntries.createdAt);
    
    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<string>();
    
    for (let i = 0; i < memories.length; i++) {
      if (processed.has(memories[i].id)) continue;
      
      const currentMemory = memories[i];
      const duplicates: MemoryEntry[] = [];
      
      // Compare with remaining memories
      for (let j = i + 1; j < memories.length; j++) {
        if (processed.has(memories[j].id)) continue;
        
        const similarity = this.calculateSimilarity(
          currentMemory.content,
          memories[j].content
        );
        
        if (similarity >= similarityThreshold) {
          duplicates.push(memories[j]);
          processed.add(memories[j].id);
        }
      }
      
      if (duplicates.length > 0) {
        processed.add(currentMemory.id);
        
        const group: DuplicateGroup = {
          masterEntry: currentMemory,
          duplicates: duplicates,
          similarity: duplicates.length > 0 ? 
            duplicates.reduce((sum, dup) => sum + this.calculateSimilarity(currentMemory.content, dup.content), 0) / duplicates.length : 
            1.0,
          mergedContent: this.mergeContent(currentMemory, duplicates),
          combinedImportance: this.calculateCombinedImportance(currentMemory, duplicates),
          combinedKeywords: this.mergeKeywords(currentMemory, duplicates),
          combinedRelationships: this.mergeRelationships(currentMemory, duplicates)
        };
        
        duplicateGroups.push(group);
      }
    }
    
    console.log(`🎯 Found ${duplicateGroups.length} duplicate groups containing ${duplicateGroups.reduce((sum, group) => sum + group.duplicates.length + 1, 0)} total memories`);
    return duplicateGroups;
  }
  
  /**
   * Intelligently merge content from similar memories
   */
  private mergeContent(master: MemoryEntry, duplicates: MemoryEntry[]): string {
    const allEntries = [master, ...duplicates];
    
    // Find the most comprehensive version (longest content with most detail)
    const mostComprehensive = allEntries.reduce((best, current) => {
      const currentScore = current.content.length + ((current.importance || 1) * 10) + ((current.qualityScore || 5) * 5);
      const bestScore = best.content.length + ((best.importance || 1) * 10) + ((best.qualityScore || 5) * 5);
      return currentScore > bestScore ? current : best;
    });
    
    // If the most comprehensive is significantly more detailed, use it
    if (mostComprehensive.content.length > master.content.length * 1.3) {
      return mostComprehensive.content;
    }
    
    // Otherwise, keep the master content
    return master.content;
  }
  
  /**
   * Calculate combined importance score
   */
  private calculateCombinedImportance(master: MemoryEntry, duplicates: MemoryEntry[]): number {
    const allImportance = [master.importance || 1, ...duplicates.map(d => d.importance || 1)];
    const maxImportance = Math.max(...allImportance);
    const avgImportance = allImportance.reduce((sum, imp) => sum + imp, 0) / allImportance.length;
    
    // Use max importance but boost slightly based on multiple confirmations
    return Math.min(10, Math.round(maxImportance + (avgImportance * 0.1)));
  }
  
  /**
   * Merge keywords from all entries
   */
  private mergeKeywords(master: MemoryEntry, duplicates: MemoryEntry[]): string[] {
    const allKeywords = new Set<string>();
    
    if (master.keywords) {
      master.keywords.forEach(k => k && allKeywords.add(k));
    }
    
    duplicates.forEach(dup => {
      if (dup.keywords) {
        dup.keywords.forEach(k => k && allKeywords.add(k));
      }
    });
    
    return Array.from(allKeywords);
  }
  
  /**
   * Merge relationships from all entries
   */
  private mergeRelationships(master: MemoryEntry, duplicates: MemoryEntry[]): string[] {
    const allRelationships = new Set<string>();
    
    if (master.relationships) {
      master.relationships.forEach(r => r && allRelationships.add(r));
    }
    
    duplicates.forEach(dup => {
      if (dup.relationships) {
        dup.relationships.forEach(r => r && allRelationships.add(r));
      }
    });
    
    return Array.from(allRelationships);
  }
  
  /**
   * Execute the merge by updating master and deleting duplicates
   */
  async executeMerge(
    db: PostgresJsDatabase<any>,
    duplicateGroup: DuplicateGroup
  ): Promise<void> {
    console.log(`🔄 Merging duplicate group: master ${duplicateGroup.masterEntry.id} with ${duplicateGroup.duplicates.length} duplicates`);
    
    try {
      await db.transaction(async (tx) => {
        // Update the master entry with merged data
        await tx
          .update(memoryEntries)
          .set({
            content: duplicateGroup.mergedContent,
            importance: duplicateGroup.combinedImportance,
            keywords: duplicateGroup.combinedKeywords,
            relationships: duplicateGroup.combinedRelationships,
            retrievalCount: (duplicateGroup.masterEntry.retrievalCount || 0) + 
              duplicateGroup.duplicates.reduce((sum, dup) => sum + (dup.retrievalCount || 0), 0),
            qualityScore: Math.max(duplicateGroup.masterEntry.qualityScore || 5, 
              ...duplicateGroup.duplicates.map(d => d.qualityScore || 5)),
            updatedAt: sql`now()`
          })
          .where(eq(memoryEntries.id, duplicateGroup.masterEntry.id));
        
        // Delete duplicate entries
        if (duplicateGroup.duplicates.length > 0) {
          await tx
            .delete(memoryEntries)
            .where(inArray(memoryEntries.id, duplicateGroup.duplicates.map(d => d.id)));
        }
        
        console.log(`✅ Successfully merged duplicate group`);
      });
    } catch (error) {
      console.error(`❌ Failed to merge duplicate group:`, error);
      throw error;
    }
  }
  
  /**
   * Auto-merge duplicates above a high confidence threshold
   */
  async autoMergeDuplicates(
    db: PostgresJsDatabase<any>,
    profileId: string,
    autoMergeThreshold: number = 0.9
  ): Promise<number> {
    console.log(`🚀 Auto-merging high-confidence duplicates (threshold: ${autoMergeThreshold})`);
    
    const duplicateGroups = await this.findDuplicateGroups(db, profileId, autoMergeThreshold);
    
    let mergedCount = 0;
    for (const group of duplicateGroups) {
      await this.executeMerge(db, group);
      mergedCount += group.duplicates.length;
    }
    
    console.log(`🎯 Auto-merged ${duplicateGroups.length} groups, eliminated ${mergedCount} duplicate memories`);
    return mergedCount;
  }
  
  /**
   * Check if a new memory is a duplicate of existing memories
   */
  async checkForDuplicates(
    db: PostgresJsDatabase<any>,
    profileId: string,
    newContent: string,
    similarityThreshold: number = 0.8
  ): Promise<MemoryEntry[]> {
    const existingMemories = await db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.profileId, profileId));
    
    const duplicates: MemoryEntry[] = [];
    
    for (const memory of existingMemories) {
      const similarity = this.calculateSimilarity(newContent, memory.content);
      if (similarity >= similarityThreshold) {
        duplicates.push(memory);
      }
    }
    
    return duplicates;
  }
}

export const memoryDeduplicator = new MemoryDeduplicator();