import { anthropicService } from './anthropic.js';
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

      // Use AI to extract key facts, quotes, and moments from the episode
      const prompt = `You are extracting key facts, memorable moments, topics discussed, and quotes from Episode ${episodeNumber} of a podcast titled "${title}".

Extract specific, factual information that would be useful to remember about this episode. Focus on:

1. KEY TOPICS discussed in detail
2. SPECIFIC QUOTES or memorable lines  
3. IMPORTANT POINTS or arguments made
4. GUEST insights or expertise shared
5. NOTABLE MOMENTS or events mentioned
6. FACTS or statistics mentioned
7. STORIES told during the episode

For each fact, provide:
- A clear, factual statement (1-2 sentences max)
- The type: TOPIC, QUOTE, FACT, STORY, or MOMENT
- Keywords that would help find this information

Transcript:
${transcript}

Respond with a JSON array of facts like this:
[
  {
    "content": "The specific fact or quote from the episode",
    "type": "TOPIC|QUOTE|FACT|STORY|MOMENT", 
    "keywords": ["relevant", "search", "terms"],
    "importance": 1-5
  }
]

Extract 8-15 of the most important and memorable facts from this episode.`;

      console.log(`🤖 Sending transcript to AI for fact extraction...`);
      
      // Get the active profile for core identity
      const profile = await storage.getProfile(profileId);
      const coreIdentity = profile?.coreIdentity || "AI assistant";
      
      const response = await anthropicService.generateResponse(
        prompt,
        coreIdentity,
        [],  // relevantMemories
        []   // relevantDocs
      );
      
      // Parse the AI response
      let extractedFacts: Array<{
        content: string;
        type: 'TOPIC' | 'QUOTE' | 'FACT' | 'STORY' | 'MOMENT';
        keywords: string[];
        importance: number;
      }>;

      try {
        // Try to extract JSON from the response
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('No JSON array found in AI response');
        }
        extractedFacts = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse AI response as JSON, falling back to manual extraction`);
        // Fallback: create basic facts from topics and guests
        extractedFacts = [];
        
        if (topics.length > 0) {
          topics.forEach(topic => {
            extractedFacts.push({
              content: `Episode ${episodeNumber} discussed ${topic}`,
              type: 'TOPIC',
              keywords: [topic, 'episode', episodeNumber.toString()],
              importance: 3
            });
          });
        }
        
        if (guestNames.length > 0) {
          guestNames.forEach(guest => {
            extractedFacts.push({
              content: `Episode ${episodeNumber} featured guest ${guest}`,
              type: 'FACT', 
              keywords: [guest, 'guest', 'episode', episodeNumber.toString()],
              importance: 4
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