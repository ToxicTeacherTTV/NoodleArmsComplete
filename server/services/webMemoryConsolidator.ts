import { storage } from '../storage.js';
import { webSearchService } from './webSearchService.js';
import Anthropic from '@anthropic-ai/sdk';

export interface WebMemoryCandidate {
  title: string;
  snippet: string;
  url: string;
  score: number;
  searchQuery: string;
  shouldStore: boolean;
  memoryType: 'FACT' | 'CONTEXT' | 'GENERAL';
  importance: number;
  reasoning: string;
}

class WebMemoryConsolidator {
  private anthropic: Anthropic;

  constructor() {
    // Initialize Anthropic for AI-powered consolidation decisions
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Evaluate web search results and determine which ones should be stored in memory
   */
  async evaluateResultsForStorage(
    webSearchResults: any[],
    originalQuery: string,
    profileId: string
  ): Promise<WebMemoryCandidate[]> {
    if (webSearchResults.length === 0) {
      return [];
    }

    console.log(`📝 Evaluating ${webSearchResults.length} web search results for memory storage`);

    const candidates: WebMemoryCandidate[] = [];

    for (const result of webSearchResults) {
      const candidate = await this.evaluateSingleResult(result, originalQuery, profileId);
      candidates.push(candidate);
    }

    // Only return candidates that should be stored
    const storableResults = candidates.filter(c => c.shouldStore);
    console.log(`📝 ${storableResults.length}/${candidates.length} results qualified for memory storage`);

    return storableResults;
  }

  /**
   * Evaluate a single search result for memory storage
   */
  private async evaluateSingleResult(
    result: any,
    originalQuery: string,
    profileId: string
  ): Promise<WebMemoryCandidate> {
    const candidate: WebMemoryCandidate = {
      title: result.title,
      snippet: result.snippet,
      url: result.url,
      score: result.score,
      searchQuery: originalQuery,
      shouldStore: false,
      memoryType: 'GENERAL',
      importance: 1,
      reasoning: ''
    };

    // Basic quality filters
    if (!result.snippet || result.snippet.length < 30) {
      candidate.shouldStore = false;
      candidate.reasoning = 'Snippet too short or missing';
      return candidate;
    }

    if (result.score < 50) {
      candidate.shouldStore = false;
      candidate.reasoning = 'Search relevance score too low';
      return candidate;
    }

    // Check if this information might already exist in memory (relaxed - only skip if very high confidence match)
    try {
      const similarMemories = await storage.searchEnrichedMemoryEntries(profileId, result.snippet.substring(0, 100));
      
      if (similarMemories.length > 0) {
        const veryHighConfidenceMatches = similarMemories.filter(m => 
          (m.confidence || 0) > 95 && m.source === 'web_search'
        );
        if (veryHighConfidenceMatches.length > 0) {
          candidate.shouldStore = false;
          candidate.reasoning = 'Identical web search result already exists in memory';
          return candidate;
        }
      }
    } catch (error) {
      console.warn('⚠️ Error checking for existing memories:', error);
    }

    // Evaluate content value using simple heuristics
    const evaluation = this.evaluateContentValue(result, originalQuery);
    candidate.shouldStore = evaluation.shouldStore;
    candidate.memoryType = evaluation.memoryType;
    candidate.importance = evaluation.importance;
    candidate.reasoning = evaluation.reasoning;

    return candidate;
  }

  /**
   * Simple heuristic-based content evaluation (faster than AI, good for most cases)
   */
  private evaluateContentValue(result: any, query: string): {
    shouldStore: boolean;
    memoryType: 'FACT' | 'CONTEXT' | 'GENERAL';
    importance: number;
    reasoning: string;
  } {
    const title = result.title.toLowerCase();
    const snippet = result.snippet.toLowerCase();
    const queryLower = query.toLowerCase();

    // High-value content indicators
    const factualKeywords = [
      'definition', 'meaning', 'what is', 'who is', 'when did', 'where is',
      'founded', 'born', 'died', 'created', 'invented', 'discovered',
      'population', 'capital', 'currency', 'language', 'published'
    ];

    const contextualKeywords = [
      'story', 'plot', 'character', 'theme', 'setting', 'analysis',
      'background', 'history', 'context', 'significance', 'impact'
    ];

    const temporalKeywords = [
      'today', 'current', 'latest', 'recent', 'now', 'this year',
      '2024', '2025', 'breaking', 'update', 'new'
    ];

    // Gaming/DbD specific keywords
    const gamingKeywords = [
      'killer', 'survivor', 'perk', 'power', 'ability', 'chapter',
      'dlc', 'ptb', 'dead by daylight', 'dbd'
    ];

    // Check for factual content
    if (factualKeywords.some(keyword => queryLower.includes(keyword) || title.includes(keyword))) {
      return {
        shouldStore: true,
        memoryType: 'FACT',
        importance: 4,
        reasoning: 'Contains factual information'
      };
    }

    // Check for contextual/literary content
    if (contextualKeywords.some(keyword => queryLower.includes(keyword) || title.includes(keyword) || snippet.includes(keyword))) {
      return {
        shouldStore: true,
        memoryType: 'CONTEXT',
        importance: 3,
        reasoning: 'Contains contextual or analytical information'
      };
    }

    // Check for time-sensitive information
    if (temporalKeywords.some(keyword => queryLower.includes(keyword) || snippet.includes(keyword))) {
      return {
        shouldStore: true,
        memoryType: 'FACT',
        importance: 2,
        reasoning: 'Contains current/time-sensitive information'
      };
    }

    // Check for gaming content (DbD-specific) - check all sources
    if (gamingKeywords.some(keyword => 
      queryLower.includes(keyword) || title.includes(keyword) || snippet.includes(keyword)
    )) {
      return {
        shouldStore: true,
        memoryType: 'FACT',
        importance: 3,
        reasoning: 'Contains Dead by Daylight game information'
      };
    }

    // Check if this looks like reference material
    if (title.includes('wikipedia') || title.includes('encyclopedia') || 
        snippet.includes('according to') || snippet.includes('research shows')) {
      return {
        shouldStore: true,
        memoryType: 'FACT',
        importance: 3,
        reasoning: 'Reference or authoritative source'
      };
    }

    // Default: don't store unless there's a clear value
    return {
      shouldStore: false,
      memoryType: 'GENERAL',
      importance: 1,
      reasoning: 'No clear value indicators found'
    };
  }

  /**
   * Store approved web search results as memory entries
   */
  async storeWebMemories(
    candidates: WebMemoryCandidate[],
    profileId: string
  ): Promise<number> {
    const storableMemories = candidates.filter(c => c.shouldStore);
    
    if (storableMemories.length === 0) {
      return 0;
    }

    console.log(`💾 Storing ${storableMemories.length} web search results as memories`);

    let storedCount = 0;

    for (const memory of storableMemories) {
      try {
        // Store the clean snippet without source attribution
        // Source is tracked separately in the 'source' field for internal reference
        const formattedContent = memory.snippet;

        await storage.addMemoryEntry({
          profileId,
          type: memory.memoryType,
          content: formattedContent,
          importance: memory.importance,
          source: 'web_search',
          confidence: Math.min(95, memory.score), // Cap confidence at 95% for web results
          keywords: this.extractTags(memory.searchQuery, memory.snippet)
        });

        storedCount++;
        console.log(`✅ Stored web memory: ${memory.title.substring(0, 50)}...`);

      } catch (error) {
        console.error(`❌ Failed to store web memory: ${memory.title}`, error);
      }
    }

    console.log(`💾 Successfully stored ${storedCount}/${storableMemories.length} web memories`);
    return storedCount;
  }

  /**
   * Extract relevant tags from query and content
   */
  private extractTags(query: string, content: string): string[] {
    const tags = new Set<string>();
    
    // Add query-based tags
    const queryWords = query.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    queryWords.slice(0, 3).forEach(word => tags.add(word));

    // Add content-based tags
    const contentKeywords = [
      'book', 'movie', 'author', 'character', 'story', 'plot',
      'history', 'science', 'technology', 'news', 'current',
      'definition', 'meaning', 'fact', 'information'
    ];

    contentKeywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword)) {
        tags.add(keyword);
      }
    });

    // Add web search tag
    tags.add('web_search');

    return Array.from(tags).slice(0, 5); // Limit to 5 tags
  }

  // Note: Cleanup and stats methods disabled until getMemoriesBySource is added to storage interface
  // 
  // /**
  //  * Cleanup old web search memories to prevent memory bloat
  //  */
  // async cleanupOldWebMemories(profileId: string, daysToKeep: number = 30): Promise<number> {
  //   // Implementation requires getMemoriesBySource() method in storage
  //   return 0;
  // }
  //
  // /**
  //  * Get statistics about web search memory storage
  //  */
  // async getWebMemoryStats(profileId: string): Promise<{
  //   totalWebMemories: number;
  //   recentWebMemories: number;
  //   topSources: string[];
  //   memoryTypes: Record<string, number>;
  // }> {
  //   // Implementation requires getMemoriesBySource() method in storage
  //   return {
  //     totalWebMemories: 0,
  //     recentWebMemories: 0,
  //     topSources: [],
  //     memoryTypes: {}
  //   };
  // }
}

// Export singleton instance
export const webMemoryConsolidator = new WebMemoryConsolidator();