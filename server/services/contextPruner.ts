import { Message } from '@shared/schema';

interface Memory {
  id: string;
  content: string;
  summary?: string;
  importance?: number;
  confidence?: number;
}

class ContextPruner {
  /**
   * Extract key facts/entities from text for comparison
   * Simple keyword extraction - looks for nouns, names, games, etc.
   */
  private extractKeywords(text: string): Set<string> {
    const keywords = new Set<string>();

    // Lowercase for case-insensitive matching
    const normalized = text.toLowerCase();

    // Extract words (3+ chars, alphanumeric)
    const words = normalized.match(/\b[a-z0-9]{3,}\b/g) || [];

    // Filter out common stop words
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one',
      'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now',
      'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'way', 'too', 'use', 'your', 'they',
      'that', 'this', 'with', 'have', 'from', 'what', 'when', 'make', 'like', 'time', 'just',
      'know', 'take', 'into', 'year', 'some', 'them', 'than', 'then', 'these', 'would', 'there',
      'about', 'think', 'really', 'little', 'could', 'should', 'pretty', 'actually'
    ]);

    for (const word of words) {
      if (!stopWords.has(word)) {
        keywords.add(word);
      }
    }

    return keywords;
  }

  /**
   * Calculate similarity between two sets of keywords
   * Returns 0-100 (Jaccard similarity percentage)
   */
  private calculateSimilarity(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
    const union = new Set([...Array.from(set1), ...Array.from(set2)]);

    return Math.round((intersection.size / union.size) * 100);
  }

  /**
   * Check if a memory is redundant with recent conversation
   * Returns true if memory content overlaps >50% with recent messages
   */
  private isRedundant(memory: any, recentKeywords: Set<string>): boolean {
    const memoryText = memory.summary || memory.content;
    const memoryKeywords = this.extractKeywords(memoryText);

    const similarity = this.calculateSimilarity(memoryKeywords, recentKeywords);

    // Redundant if >50% overlap
    return similarity > 50;
  }

  /**
   * Prune redundant memories based on recent conversation context
   * Keeps memories that add new information not already in recent messages
   */
  pruneMemories(
    memories: any[],
    recentMessages: Message[],
    maxRecentToCheck: number = 8
  ): { pruned: any[]; removed: any[]; stats: any } {
    if (memories.length === 0 || recentMessages.length === 0) {
      return {
        pruned: memories,
        removed: [],
        stats: {
          original: memories.length,
          pruned: memories.length,
          removed: 0,
          savings: 0
        }
      };
    }

    // Extract keywords from recent conversation (last N messages)
    const recentToCheck = recentMessages.slice(-maxRecentToCheck);
    const recentText = recentToCheck.map(m => m.content).join(' ');
    const recentKeywords = this.extractKeywords(recentText);

    console.log(`🔍 Context pruning: Checking ${memories.length} memories against ${recentToCheck.length} recent messages`);
    console.log(`📝 Recent context keywords: ${recentKeywords.size} unique terms`);

    const pruned: any[] = [];
    const removed: any[] = [];
    let estimatedTokensSaved = 0;

    for (const memory of memories) {
      if (this.isRedundant(memory, recentKeywords)) {
        removed.push(memory);

        // Rough estimate: ~1 token per 4 characters
        const memoryText = memory.summary || memory.content;
        estimatedTokensSaved += Math.round(memoryText.length / 4);

        console.log(`   🗑️  PRUNED: "${memoryText.substring(0, 60)}..." (redundant with recent conversation)`);
      } else {
        pruned.push(memory);
      }
    }

    const stats = {
      original: memories.length,
      pruned: pruned.length,
      removed: removed.length,
      savings: estimatedTokensSaved,
      percentReduced: Math.round((removed.length / memories.length) * 100)
    };

    console.log(`✂️  Context pruning complete: ${stats.original} → ${stats.pruned} memories (${stats.percentReduced}% reduction, ~${stats.savings} tokens saved)`);

    return { pruned, removed, stats };
  }

  /**
   * Prune documents based on recent conversation
   * Same logic as memories but for document chunks
   */
  pruneDocuments(
    documents: any[],
    recentMessages: Message[],
    maxRecentToCheck: number = 8
  ): { pruned: any[]; removed: any[]; stats: any } {
    if (documents.length === 0 || recentMessages.length === 0) {
      return {
        pruned: documents,
        removed: [],
        stats: {
          original: documents.length,
          pruned: documents.length,
          removed: 0,
          savings: 0
        }
      };
    }

    // Extract keywords from recent conversation
    const recentToCheck = recentMessages.slice(-maxRecentToCheck);
    const recentText = recentToCheck.map(m => m.content).join(' ');
    const recentKeywords = this.extractKeywords(recentText);

    const pruned: any[] = [];
    const removed: any[] = [];
    let estimatedTokensSaved = 0;

    for (const doc of documents) {
      const docText = doc.content || doc.text || '';
      const docKeywords = this.extractKeywords(docText);
      const similarity = this.calculateSimilarity(docKeywords, recentKeywords);

      if (similarity > 50) {
        removed.push(doc);
        estimatedTokensSaved += Math.round(docText.length / 4);
      } else {
        pruned.push(doc);
      }
    }

    const stats = {
      original: documents.length,
      pruned: pruned.length,
      removed: removed.length,
      savings: estimatedTokensSaved,
      percentReduced: documents.length > 0 ? Math.round((removed.length / documents.length) * 100) : 0
    };

    console.log(`✂️  Document pruning: ${stats.original} → ${stats.pruned} docs (${stats.percentReduced}% reduction, ~${stats.savings} tokens saved)`);

    return { pruned, removed, stats };
  }

  /**
   * Get recent messages for pruning context
   * Fetches last N messages from conversation
   */
  async getRecentMessages(conversationId: string, storage: any, limit: number = 8): Promise<Message[]> {
    try {
      const messages = await storage.getRecentMessages(conversationId, limit);
      return messages;
    } catch (error) {
      console.warn('⚠️ Failed to fetch recent messages for pruning:', error);
      return [];
    }
  }
}

// Singleton instance
export const contextPruner = new ContextPruner();
