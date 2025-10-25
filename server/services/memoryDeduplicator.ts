import { eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { memoryEntries } from "@shared/schema";
import { embeddingService } from "./embeddingService";
import { storage } from "../storage";
import Anthropic from '@anthropic-ai/sdk';
import { geminiService } from './gemini.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

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
   * Create a fingerprint for quick similarity filtering
   */
  private createFingerprint(content: string): string {
    const words = content.toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3) // Only words longer than 3 chars
      .sort()
      .slice(0, 10); // Take first 10 significant words
    return words.join(' ');
  }

  /**
   * Quick pre-filter based on word overlap
   */
  private hasWordOverlap(text1: string, text2: string): boolean {
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    
    // Check if they share at least 2 significant words
    let sharedWords = 0;
    for (const word of Array.from(words1)) {
      if (words2.has(word)) {
        sharedWords++;
        if (sharedWords >= 2) return true;
      }
    }
    return false;
  }

  /**
   * Find duplicate groups in a set of memory entries (OPTIMIZED)
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
    
    console.log(`📊 Processing ${memories.length} memories...`);
    
    // Create fingerprints for quick filtering
    const memoriesWithFingerprints = memories.map(memory => ({
      ...memory,
      fingerprint: this.createFingerprint(memory.content)
    }));
    
    // Group by similar fingerprints first (reduces comparisons significantly)
    const fingerprintGroups = new Map<string, typeof memoriesWithFingerprints>();
    for (const memory of memoriesWithFingerprints) {
      const key = memory.fingerprint;
      if (!fingerprintGroups.has(key)) {
        fingerprintGroups.set(key, []);
      }
      fingerprintGroups.get(key)!.push(memory);
    }
    
    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<string>();
    let comparisons = 0;
    
    // Process fingerprint groups
    for (const [fingerprint, candidateGroup] of Array.from(fingerprintGroups.entries())) {
      if (candidateGroup.length < 2) continue; // Skip groups with only 1 member
      
      for (let i = 0; i < candidateGroup.length; i++) {
        if (processed.has(candidateGroup[i].id)) continue;
        
        const currentMemory = candidateGroup[i];
        const duplicates: MemoryEntry[] = [];
        
        // Only compare within the same fingerprint group and with word overlap
        for (let j = i + 1; j < candidateGroup.length; j++) {
          if (processed.has(candidateGroup[j].id)) continue;
          
          // Quick pre-filter: check word overlap
          if (!this.hasWordOverlap(currentMemory.content, candidateGroup[j].content)) {
            continue;
          }
          
          comparisons++;
          const similarity = this.calculateSimilarity(
            currentMemory.content,
            candidateGroup[j].content
          );
          
          if (similarity >= similarityThreshold) {
            duplicates.push(candidateGroup[j]);
            processed.add(candidateGroup[j].id);
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
    }
    
    console.log(`🎯 Found ${duplicateGroups.length} duplicate groups containing ${duplicateGroups.reduce((sum, group) => sum + group.duplicates.length + 1, 0)} total memories`);
    console.log(`⚡ Performed ${comparisons} similarity comparisons (reduced from ~${Math.pow(memories.length, 2) / 2})`);
    return duplicateGroups;
  }
  
  /**
   * Intelligently merge content from similar memories (simple version - picks best)
   * PUBLIC: Can be called by routes for manual merging
   */
  mergeContent(master: MemoryEntry, duplicates: MemoryEntry[]): string {
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
   * AI-POWERED intelligent merge - combines ALL duplicate versions into one comprehensive memory
   * Uses Gemini 2.5 Pro (primary) with Claude Sonnet 4.5 (fallback)
   * PUBLIC: Can be called by routes for manual merging
   */
  async mergeContentWithAI(master: MemoryEntry, duplicates: MemoryEntry[]): Promise<string> {
    const allEntries = [master, ...duplicates];
    
    // Build the versions list
    const versionsText = allEntries
      .map((entry, idx) => {
        const label = idx === 0 ? 'PRIMARY' : `DUPLICATE ${idx}`;
        return `--- ${label} ---\nContent: ${entry.content}\nImportance: ${entry.importance || 1}/10\nQuality: ${entry.qualityScore || 5}/10\nKeywords: ${(entry.keywords || []).join(', ')}`;
      })
      .join('\n\n');

    const prompt = `You are merging duplicate memory entries from an AI personality database. Your task is to create ONE comprehensive memory that contains ALL unique facts and details from every version.

${versionsText}

MERGE INSTRUCTIONS:
1. Combine ALL unique facts and details from every version
2. Keep the most detailed/specific wording when versions overlap
3. Preserve all context that adds meaning (e.g., "stopped by tour guide" is important context)
4. Remove pure redundancy (don't repeat the same fact twice)
5. Maintain natural, coherent language
6. Keep it concise - focus on facts, not flowery language

OUTPUT: Return ONLY the merged memory content (one paragraph or a few sentences). No explanations, no metadata, just the final merged text.`;

    try {
      // 🎯 PRIMARY: Try Gemini first (free tier)
      const systemPrompt = 'You are a memory consolidation expert. Merge duplicate memories into comprehensive, factual entries.';
      const fullPrompt = `${systemPrompt}\n\n${prompt}`;
      
      const geminiResponse = await geminiService['ai'].models.generateContent({
        model: 'gemini-2.5-pro', // 🚫 NEVER Flash - hallucinates during merging
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
          maxOutputTokens: 1000,
          temperature: 0.3
        }
      });
      
      // Extract text from Gemini response (same pattern as gemini.ts line 920)
      const mergedContent = geminiResponse.text || '';
      
      // Debug logging to diagnose empty responses
      console.log('🔍 Gemini response debug:', {
        hasText: !!geminiResponse.text,
        textLength: mergedContent.length,
        firstChars: mergedContent.substring(0, 100),
        responseKeys: Object.keys(geminiResponse || {}),
        candidates: geminiResponse.candidates?.length
      });
      
      if (!mergedContent || mergedContent.trim().length === 0) {
        console.error('❌ Gemini returned empty content. Full response:', JSON.stringify(geminiResponse, null, 2));
        throw new Error('Gemini returned empty content');
      }
      
      console.log('✅ Successfully merged memories using Gemini AI (length: ' + mergedContent.length + ' chars)');
      console.log('📝 Merged result preview:', mergedContent.substring(0, 200));
      
      console.log('✅ Successfully merged memories using Gemini AI');
      return mergedContent.trim();
      
    } catch (geminiError) {
      // 🔄 FALLBACK: Use Claude if Gemini fails
      console.log('❌ Gemini merge failed, falling back to Claude:', geminiError);
      
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1000,
          temperature: 0.3,
          system: 'You are a memory consolidation expert. Merge duplicate memories into comprehensive, factual entries.',
          messages: [{
            role: 'user',
            content: prompt
          }]
        });

        const textContent = response.content.find(c => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in response');
        }

        console.log('✅ Successfully merged memories using Claude AI (fallback)');
        return textContent.text.trim();
        
      } catch (claudeError) {
        console.error('❌ Both Gemini and Claude AI merge failed:', claudeError);
        // Fall back to simple merge
        console.log('⚠️ Falling back to simple merge (picks most comprehensive version)');
        return this.mergeContent(master, duplicates);
      }
    }
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
   * 🚀 NOW USES VECTOR EMBEDDINGS (same as deep scan) for consistent results!
   * 🛡️ SAFE: Processes in batches with retry logic and connection error handling
   */
  async autoMergeDuplicates(
    db: PostgresJsDatabase<any>,
    profileId: string,
    autoMergeThreshold: number = 0.9
  ): Promise<number> {
    console.log(`🚀 Auto-merging high-confidence duplicates using VECTOR EMBEDDINGS (threshold: ${autoMergeThreshold})`);
    
    // 🚀 Use vector-based detection (same as deep scan!)
    const memories = await storage.getRecentMemoriesWithEmbeddings(profileId, 999999);
    console.log(`📊 Processing ${memories.length} memories with stored embeddings...`);
    
    const duplicateGroups: DuplicateGroup[] = [];
    const processedIds = new Set<string>();
    
    // Find all duplicate groups using vector embeddings
    for (const memory of memories) {
      if (processedIds.has(memory.id)) continue;
      
      // 🚀 OPTIMIZATION: Use stored embeddings directly (no API call!)
      const vectorDuplicates = embeddingService.findDuplicatesFromStoredEmbeddings(
        memory,
        memories,
        autoMergeThreshold
      );
      
      // Filter out already processed duplicates
      const actualDuplicates = vectorDuplicates
        .filter(dup => !processedIds.has(dup.id))
        .map(dup => {
          // Find the full memory entry
          const fullEntry = memories.find(m => m.id === dup.id);
          return fullEntry!;
        });
      
      if (actualDuplicates.length > 0) {
        // Build a DuplicateGroup using the same structure as text-based method
        const group: DuplicateGroup = {
          masterEntry: memory,
          duplicates: actualDuplicates,
          similarity: vectorDuplicates.length > 0 ? 
            vectorDuplicates.reduce((sum, dup) => sum + dup.similarity, 0) / vectorDuplicates.length : 
            1.0,
          mergedContent: this.mergeContent(memory, actualDuplicates),
          combinedImportance: this.calculateCombinedImportance(memory, actualDuplicates),
          combinedKeywords: this.mergeKeywords(memory, actualDuplicates),
          combinedRelationships: this.mergeRelationships(memory, actualDuplicates)
        };
        
        duplicateGroups.push(group);
        
        // Mark the master AND all duplicates as processed
        processedIds.add(memory.id);
        actualDuplicates.forEach(dup => processedIds.add(dup.id));
      }
    }
    
    console.log(`✅ Found ${duplicateGroups.length} duplicate groups using vector embeddings`);
    
    // 🛡️ Process ONE GROUP AT A TIME with delays to avoid Neon timeouts
    let mergedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const MAX_GROUPS_PER_RUN = 10; // Only process 10 groups per run to stay well under timeout
    const DELAY_BETWEEN_GROUPS = 200; // Small delay between each group
    
    const groupsToProcess = duplicateGroups.slice(0, MAX_GROUPS_PER_RUN);
    console.log(`📦 Processing ${groupsToProcess.length} groups (of ${duplicateGroups.length} total)...`);
    
    for (let i = 0; i < groupsToProcess.length; i++) {
      const group = groupsToProcess[i];
      
      try {
        console.log(`🔄 [${i+1}/${groupsToProcess.length}] Merging: "${group.masterEntry.content.substring(0, 50)}..." (${group.duplicates.length} duplicates)`);
        
        await this.executeMerge(db, group);
        mergedCount += group.duplicates.length;
        successCount++;
        
        console.log(`✅ Merged successfully`);
      } catch (error: any) {
        errorCount++;
        console.error(`❌ Failed to merge:`, error.message);
        
        // If connection error (Neon timeout), stop gracefully
        if (error.code === '57P01' || error.message?.includes('connection') || error.message?.includes('terminating')) {
          console.error(`⚠️ Database connection error - stopping gracefully`);
          console.log(`📊 Progress: ${successCount} groups merged, ${mergedCount} duplicates eliminated`);
          return mergedCount;
        }
        
        // For other errors, continue with next group
        console.warn(`   Skipping and continuing...`);
      }
      
      // Small delay between groups to let the connection breathe
      if (i < groupsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_GROUPS));
      }
    }
    
    console.log(`🎯 Auto-merge complete: ${successCount} groups merged, ${errorCount} failed, eliminated ${mergedCount} duplicate memories`);
    
    if (errorCount > 0) {
      console.warn(`⚠️ ${errorCount} groups failed to merge - you may want to run again or review manually`);
    }
    
    return mergedCount;
  }
  
  /**
   * Check if a new memory is a duplicate of existing memories (LEGACY: text-based)
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

  /**
   * 🌟 NEW: Check for duplicates using vector embeddings
   * This catches semantic duplicates that text-based methods miss
   * 
   * Similarity thresholds:
   * - 0.95-1.0: Exact/near duplicate (auto-merge or block)
   * - 0.90-0.95: Very similar (flag for review)
   * - 0.80-0.90: Related topic (check for contradiction)
   */
  async checkForDuplicatesUsingVectors(
    profileId: string,
    newContent: string,
    similarityThreshold: number = 0.90
  ): Promise<Array<{ id: string; content: string; similarity: number }>> {
    try {
      console.log(`🔍 Vector duplicate check: "${newContent.substring(0, 50)}..." (threshold: ${similarityThreshold})`);
      
      const duplicates = await embeddingService.findDuplicatesByEmbedding(
        newContent,
        profileId,
        similarityThreshold
      );
      
      if (duplicates.length > 0) {
        console.log(`⚠️ Found ${duplicates.length} potential duplicates:`);
        duplicates.forEach(dup => {
          console.log(`  - ${(dup.similarity * 100).toFixed(1)}% similar: "${dup.content.substring(0, 50)}..."`);
        });
      } else {
        console.log(`✅ No duplicates found above ${(similarityThreshold * 100).toFixed(0)}% similarity`);
      }
      
      return duplicates;
      
    } catch (error) {
      console.error('❌ Vector duplicate detection failed:', error);
      // Fallback to empty array rather than crashing
      return [];
    }
  }

  /**
   * 🌟 NEW: Smart duplicate handling with automatic decisions
   * - similarity >= 0.95: Exact duplicate, block creation
   * - similarity >= 0.90: Very similar, flag for user review
   * - similarity < 0.90: Not a duplicate, allow creation
   */
  async handleDuplicateDetection(
    profileId: string,
    newContent: string
  ): Promise<{
    isDuplicate: boolean;
    action: 'block' | 'flag' | 'allow';
    duplicates: Array<{ id: string; content: string; similarity: number }>;
    reason: string;
  }> {
    const duplicates = await this.checkForDuplicatesUsingVectors(profileId, newContent, 0.90);
    
    if (duplicates.length === 0) {
      return {
        isDuplicate: false,
        action: 'allow',
        duplicates: [],
        reason: 'No similar memories found'
      };
    }
    
    const highestSimilarity = duplicates[0].similarity;
    
    if (highestSimilarity >= 0.95) {
      return {
        isDuplicate: true,
        action: 'block',
        duplicates,
        reason: `Near-exact duplicate detected (${(highestSimilarity * 100).toFixed(1)}% similar)`
      };
    } else if (highestSimilarity >= 0.90) {
      return {
        isDuplicate: true,
        action: 'flag',
        duplicates,
        reason: `Very similar memory exists (${(highestSimilarity * 100).toFixed(1)}% similar) - review recommended`
      };
    } else {
      return {
        isDuplicate: false,
        action: 'allow',
        duplicates,
        reason: 'Similar memories found but not duplicates'
      };
    }
  }

  /**
   * 🔍 DEEP SCAN: Find all duplicate groups across the entire memory corpus
   * Configurable scan depth: 100, 500, 1000, or ALL memories
   * 🚀 OPTIMIZED: Uses stored embeddings instead of regenerating for each comparison
   */
  async deepScanDuplicates(
    profileId: string,
    scanDepth: number | 'ALL' = 100,
    similarityThreshold: number = 0.90
  ): Promise<{
    scannedCount: number;
    duplicateGroups: Array<{
      masterId: string;
      masterContent: string;
      duplicates: Array<{ id: string; content: string; similarity: number }>;
    }>;
    totalDuplicates: number;
  }> {
    console.log(`🔍 Starting deep duplicate scan (depth: ${scanDepth}, threshold: ${similarityThreshold})`);
    
    // 🚀 OPTIMIZATION: Load all memories with embeddings ONCE at the start
    const limit = scanDepth === 'ALL' ? 999999 : scanDepth;
    const memories = await storage.getRecentMemoriesWithEmbeddings(profileId, limit);
    
    console.log(`📊 Scanning ${memories.length} memories for duplicates using stored embeddings (no API calls needed)...`);
    
    const duplicateGroups: Array<{
      masterId: string;
      masterContent: string;
      duplicates: Array<{ id: string; content: string; similarity: number }>;
    }> = [];
    
    const processedIds = new Set<string>();
    let totalDuplicates = 0;
    
    // Check each memory against all others using stored embeddings
    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      
      // Skip if already processed as a duplicate
      if (processedIds.has(memory.id)) continue;
      
      // 🚀 OPTIMIZATION: Use stored embeddings directly (no API call!)
      const duplicates = embeddingService.findDuplicatesFromStoredEmbeddings(
        memory,
        memories,
        similarityThreshold
      );
      
      // Filter out already processed duplicates
      const actualDuplicates = duplicates.filter(
        dup => !processedIds.has(dup.id)
      );
      
      if (actualDuplicates.length > 0) {
        duplicateGroups.push({
          masterId: memory.id,
          masterContent: memory.content,
          duplicates: actualDuplicates
        });
        
        // Mark all duplicates as processed
        actualDuplicates.forEach(dup => processedIds.add(dup.id));
        totalDuplicates += actualDuplicates.length;
        
        console.log(`  Found group: "${memory.content.substring(0, 40)}..." has ${actualDuplicates.length} duplicates`);
      }
      
      // Progress update every 50 memories
      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${memories.length} memories scanned...`);
      }
    }
    
    console.log(`✅ Deep scan complete: Found ${duplicateGroups.length} groups with ${totalDuplicates} total duplicates`);
    
    return {
      scannedCount: memories.length,
      duplicateGroups,
      totalDuplicates
    };
  }
}

export const memoryDeduplicator = new MemoryDeduplicator();