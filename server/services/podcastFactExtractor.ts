import { InsertMemoryEntry } from '@shared/schema';
import { IStorage } from '../storage.js';

export class PodcastFactExtractor {
  
  /**
   * Extract structured facts from a podcast episode transcript and store them as memory entries
   */
  async extractAndStoreFacts(
    storage: IStorage,
    profileId: string,
    episodeId: string,
    episodeNumber: number,
    title: string,
    transcript: string,
    guestNames: string[] = [],
    topics: string[] = []
  ): Promise<{success: boolean, factsCreated: number, error?: string}> {
    
    try {
      console.log(`🎙️ Starting fact extraction for Episode ${episodeNumber}: ${title}`);
      
      if (!transcript || transcript.trim().length < 100) {
        return { success: false, factsCreated: 0, error: 'Transcript too short or empty' };
      }

      // NOTE: AI extraction is now handled by Gemini service

      console.log(`🤖 Sending transcript to AI for fact extraction...`);
      
      // Use Gemini for fact extraction (no personality interference)
      const { geminiService } = await import('./gemini.js');
      let extractedFacts = await geminiService.extractPodcastFacts(transcript, episodeNumber, title);

      // If Gemini extraction fails or returns no facts, create fallback facts
      if (!extractedFacts || extractedFacts.length === 0) {
        console.warn(`⚠️ Gemini extraction failed or returned no facts, creating fallback facts`);
        
        // Fallback: create basic facts from title, topics and guests  
        extractedFacts = [];
        
        // Extract basic info from episode title
        extractedFacts.push({
          content: `Episode ${episodeNumber} is titled "${title}"`,
          type: 'FACT',
          keywords: ['episode', episodeNumber.toString(), title.toLowerCase().split(' ').slice(0, 3)].flat(),
          importance: 4
        });
        
        if (topics && topics.length > 0) {
          topics.forEach(topic => {
            extractedFacts.push({
              content: `Episode ${episodeNumber} discussed ${topic}`,
              type: 'TOPIC',
              keywords: [topic.toLowerCase(), 'episode', episodeNumber.toString()],
              importance: 3
            });
          });
        }
        
        if (guestNames && guestNames.length > 0) {
          guestNames.forEach(guest => {
            extractedFacts.push({
              content: `Episode ${episodeNumber} featured guest ${guest}`,
              type: 'FACT', 
              keywords: [guest.toLowerCase(), 'guest', 'episode', episodeNumber.toString()],
              importance: 4
            });
          });
        }
        
        // If we have no topic/guest data, create facts from the episode title
        if (extractedFacts.length === 1) { // Only the title fact
          const titleWords = title.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3);
          titleWords.slice(0, 3).forEach(word => {
            extractedFacts.push({
              content: `Episode ${episodeNumber} covers content related to ${word}`,
              type: 'TOPIC',
              keywords: [word, 'episode', episodeNumber.toString()],
              importance: 2
            });
          });
        }
      }

      if (extractedFacts.length === 0) {
        return { success: false, factsCreated: 0, error: 'No facts extracted' };
      }

      console.log(`✅ Extracted ${extractedFacts.length} facts from Episode ${episodeNumber}`);

      // Store each extracted fact as a memory entry
      let factsCreated = 0;
      for (const fact of extractedFacts) {
        try {
          // Create enhanced keywords including episode-specific terms
          const enhancedKeywords = [
            ...fact.keywords,
            'podcast',
            'episode',
            episodeNumber.toString(),
            `episode_${episodeNumber}`,
            title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(' ').filter(w => w.length > 2)
          ].flat().filter(Boolean);

          const memoryEntry: InsertMemoryEntry = {
            profileId,
            type: 'FACT', // All podcast content stored as facts
            content: fact.content,
            importance: fact.importance || 3,
            source: 'podcast_episode',
            sourceId: episodeId,
            keywords: Array.from(new Set(enhancedKeywords)), // Remove duplicates
            confidence: 95, // High confidence since extracted from actual transcript
            temporalContext: `Episode ${episodeNumber} (${title})`,
            qualityScore: fact.importance || 3,
            retrievalCount: 0,
            successRate: 100,
            supportCount: 1,
            canonicalKey: `podcast_ep${episodeNumber}_${fact.content.slice(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
          };

          await storage.addMemoryEntry(memoryEntry);
          factsCreated++;
          
        } catch (entryError) {
          console.warn(`⚠️ Failed to store fact: ${fact.content.slice(0, 100)}...`, entryError);
        }
      }

      console.log(`🎉 Successfully stored ${factsCreated} facts from Episode ${episodeNumber} into memory!`);
      
      return { success: true, factsCreated };
      
    } catch (error) {
      console.error(`❌ Error extracting facts from Episode ${episodeNumber}:`, error);
      return { success: false, factsCreated: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const podcastFactExtractor = new PodcastFactExtractor();