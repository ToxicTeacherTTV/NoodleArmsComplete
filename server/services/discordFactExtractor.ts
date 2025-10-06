import { geminiService } from './gemini.js';
import { storage } from '../storage.js';

interface ExtractedMemberFact {
  fact: string;
  confidence: number; // 0-100
  category: 'gameplay' | 'preference' | 'personal' | 'other';
}

export class DiscordFactExtractor {
  /**
   * Extract facts about a Discord member from their message
   */
  async extractFactsFromMessage(
    username: string,
    message: string,
    existingFacts: string[] = []
  ): Promise<string[]> {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️ Gemini API key not configured, skipping fact extraction');
      return [];
    }

    // Skip extraction for very short messages
    if (message.trim().length < 10) {
      return [];
    }

    try {
      // Use Gemini's dedicated Discord fact extraction method
      const extractedFacts = await geminiService.extractDiscordMemberFacts(
        username,
        message,
        existingFacts
      );

      // Filter by confidence threshold (>60) and return only the fact strings
      const highConfidenceFacts = extractedFacts
        .filter((f) => f.confidence > 60)
        .map((f) => f.fact);

      if (highConfidenceFacts.length > 0) {
        console.log(`📝 Extracted ${highConfidenceFacts.length} facts about ${username}: ${highConfidenceFacts.join(', ')}`);
      }

      return highConfidenceFacts;
    } catch (error) {
      console.error('❌ Discord fact extraction error:', error);
      return [];
    }
  }

  /**
   * Update member facts in database
   */
  async updateMemberFacts(
    memberId: string,
    newFacts: string[],
    existingFacts: string[] = []
  ): Promise<void> {
    if (newFacts.length === 0) {
      return;
    }

    try {
      // Merge new facts with existing, avoiding duplicates
      const allFacts = [...existingFacts];
      
      for (const newFact of newFacts) {
        // Check if similar fact already exists (simple string matching)
        const isDuplicate = allFacts.some(existing => 
          existing.toLowerCase().includes(newFact.toLowerCase()) ||
          newFact.toLowerCase().includes(existing.toLowerCase())
        );

        if (!isDuplicate) {
          allFacts.push(newFact);
        }
      }

      // Limit to most recent 20 facts
      const limitedFacts = allFacts.slice(-20);

      await storage.updateDiscordMember(memberId, {
        facts: limitedFacts,
      });

      console.log(`✅ Updated member facts: ${newFacts.length} new, ${limitedFacts.length} total`);
    } catch (error) {
      console.error('❌ Failed to update member facts:', error);
    }
  }

  /**
   * Extract keywords from facts for better retrieval
   */
  extractKeywordsFromFacts(facts: string[]): string[] {
    const keywords = new Set<string>();

    for (const fact of facts) {
      // Extract potential keywords (simple approach)
      const words = fact.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !['about', 'that', 'this', 'with', 'from'].includes(word));

      words.forEach(word => keywords.add(word));
    }

    return Array.from(keywords).slice(0, 10); // Limit to 10 keywords
  }
}

export const discordFactExtractor = new DiscordFactExtractor();
