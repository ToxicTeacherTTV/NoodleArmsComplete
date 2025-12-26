import { InsertMemoryEntry, InsertDocument } from '@shared/schema';
import { IStorage } from '../storage.js';
import { entityExtraction } from './entityExtraction.js';
import { GoogleGenAI } from "@google/genai";
import { executeWithProductionModel } from './modelSelector.js';
import { getDefaultModel } from '../config/geminiModels.js';

export class PodcastFactExtractor {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  private async extractFactsWithAI(transcript: string): Promise<Array<{ content: string; type: string; keywords: string[]; importance: number }>> {
    if (!transcript || transcript.length < 50) return [];

    const prompt = `You are an expert archivist for the "Noodle Arms" podcast. Your job is to extract PERMANENT FACTS and MEMORIES from the following podcast transcript.

TRANSCRIPT:
"${transcript.substring(0, 30000)}" ${(transcript.length > 30000) ? '...(truncated)' : ''}

INSTRUCTIONS:
Extract 10-20 distinct, atomic facts from this episode. Focus on:
1. Specific opinions held by the host (Nicky/Noodle Arms)
2. Concrete events or stories mentioned (Lore)
3. Relationships with other people (Guests, friends, rivals)
4. Specific gaming preferences or hot takes (Dead by Daylight, etc.)
5. Personal life details revealed

Do NOT extract:
- Generic greetings ("Hello everyone")
- Filler conversation
- Ambiguous statements

Return a JSON object with a "facts" array. Each fact should have:
- content: The fact statement (e.g., "Nicky thinks The Trapper is the worst killer in DBD")
- type: One of ['OPINION', 'LORE', 'PREFERENCE', 'RELATIONSHIP', 'STORY']
- keywords: Array of 3-5 search keywords
- importance: 1-100 scale (100 = critical lore, 1 = trivial)

JSON FORMAT:
{
  "facts": [
    {
      "content": "Nicky hates playing against The Skull Merchant",
      "type": "PREFERENCE",
      "keywords": ["skull merchant", "dbd", "killer", "hate"],
      "importance": 85
    }
  ]
}`;

    try {
      return await executeWithProductionModel(async (model) => {
        const response = await this.ai.models.generateContent({
          model,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                facts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      content: { type: "string" },
                      type: { type: "string", enum: ['OPINION', 'LORE', 'PREFERENCE', 'RELATIONSHIP', 'STORY', 'FACT'] },
                      keywords: { type: "array", items: { type: "string" } },
                      importance: { type: "number" }
                    },
                    required: ["content", "type", "keywords", "importance"]
                  }
                }
              }
            }
          },
          contents: prompt,
        });

        const rawJson = response.text;
        if (rawJson) {
          const result = JSON.parse(rawJson);
          return result.facts || [];
        }
        return [];
      }, 'extraction');
    } catch (error) {
      console.error("❌ AI Fact Extraction failed:", error);
      return [];
    }
  }

  private extractNickyDialogue(transcript: string): string {
    // Parse transcript and extract only Nicky's speaking parts
    // Common formats: "Nicky:", "Nicky says:", "[Nicky]"
    const lines = transcript.split('\n');
    const nickyLines: string[] = [];
    
    for (const line of lines) {
      if (line.match(/^(Nicky|NICKY|Noodle Arms|NOODLE ARMS):?\s/i) || 
          line.match(/^\[(Nicky|NICKY|Noodle Arms|NOODLE ARMS)\]/i)) {
        const cleaned = line
          .replace(/^(Nicky|NICKY|Noodle Arms|NOODLE ARMS):?\s/i, '')
          .replace(/^\[(Nicky|NICKY|Noodle Arms|NOODLE ARMS)\]\s*/i, '')
          .trim();
        if (cleaned) nickyLines.push(cleaned);
      }
    }
    
    return nickyLines.join('\n\n');
  }

  private async createTrainingExampleFromTranscript(
    storage: IStorage,
    profileId: string,
    episodeId: string,
    episodeNumber: number,
    title: string,
    transcript: string
  ): Promise<void> {
    // Extract only Nicky's lines from transcript
    const nickyLines = this.extractNickyDialogue(transcript);
    
    if (nickyLines.length < 100) { // Minimum length check
        console.log(`⚠️ Not enough Nicky dialogue found in Episode ${episodeNumber} for training example.`);
        return; 
    }
    
    try {
        // Create training example document
        await storage.createDocument({
          profileId,
          name: `Training: Episode ${episodeNumber} - ${title}`,
          filename: `ep${episodeNumber}_training.txt`,
          contentType: 'text/plain',
          documentType: 'TRAINING_EXAMPLE',
          size: nickyLines.length,
          extractedContent: nickyLines,
          processingStatus: 'COMPLETED'
        });
        
        console.log(`📚 Created training example from Episode ${episodeNumber} (${nickyLines.length} chars)`);
    } catch (error) {
        console.error(`❌ Failed to create training example for Episode ${episodeNumber}:`, error);
    }
  }

  async extractFactsFromEpisode(
    episodeId: string,
    episodeNumber: number,
    title: string,
    transcript: string,
    profileId: string,
    storage: IStorage
  ): Promise<{ success: boolean; factsCreated: number; entitiesCreated: number; error?: string }> {
    try {
      console.log(`🎙️ Extracting facts from Podcast Episode ${episodeNumber}: "${title}"`);

      // Basic facts extraction logic (Metadata)
      const extractedFacts: Array<{ content: string; type: string; keywords: string[]; importance: number }> = [];

      // Add title fact
      extractedFacts.push({
        content: `Episode ${episodeNumber} is titled "${title}"`,
        type: 'EPISODE_INFO',
        keywords: ['episode', 'title', episodeNumber.toString()],
        importance: 5
      });

      // Extract guests if mentioned in title
      const guestMatch = title.match(/with\s+([^,]+)/i);
      if (guestMatch) {
        const guest = guestMatch[1].trim();
        extractedFacts.push({
          content: `Episode ${episodeNumber} features guest ${guest}`,
          type: 'GUEST',
          keywords: [guest.toLowerCase(), 'guest', 'episode', episodeNumber.toString()],
          importance: 4
        });
      }

      // 🧠 AI EXTRACTION: Deep analyze the transcript
      console.log(`🧠 Analyzing transcript with AI for deep fact extraction...`);
      const aiFacts = await this.extractFactsWithAI(transcript);
      
      if (aiFacts.length > 0) {
        console.log(`✨ AI found ${aiFacts.length} deep facts/memories from transcript`);
        extractedFacts.push(...aiFacts);
      } else {
        console.warn(`⚠️ AI returned 0 facts. Falling back to basic metadata.`);
        
        // Fallback: If we have no topic/guest data, create facts from the episode title
        if (extractedFacts.length === 1) { 
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
        return { success: false, factsCreated: 0, entitiesCreated: 0, error: 'No facts extracted' };
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

      // 🔍 ENTITY EXTRACTION: Extract people, places, and events from the transcript
      let entitiesCreated = 0;
      try {
        console.log(`🔍 Extracting entities from Episode ${episodeNumber} transcript...`);

        // Build context from transcript for better entity extraction
        const contextualTranscript = `Episode ${episodeNumber}: ${title}\n\n${transcript}`;

        const entityResult = await entityExtraction.processMemoryForEntityLinking(
          contextualTranscript,
          profileId,
          storage
        );

        entitiesCreated = entityResult.entitiesCreated;

        if (entitiesCreated > 0) {
          console.log(`✨ Extracted ${entitiesCreated} new entities from Episode ${episodeNumber}`);
          console.log(`   📊 Entity breakdown: ${entityResult.personIds.length} people, ${entityResult.placeIds.length} places, ${entityResult.eventIds.length} events, ${entityResult.conceptIds.length} concepts, ${entityResult.itemIds.length} items, ${entityResult.miscIds.length} misc`);
        } else {
          console.log(`ℹ️ No new entities found in Episode ${episodeNumber} (may have matched existing entities)`);
        }

      } catch (entityError) {
        console.warn(`⚠️ Entity extraction failed for Episode ${episodeNumber}, continuing with facts only:`, entityError);
        // Don't fail the whole operation if entity extraction fails
      }

      // 📚 NEW: Create training example from transcript
      if (transcript.length > 500) {
        await this.createTrainingExampleFromTranscript(
            storage,
            profileId,
            episodeId,
            episodeNumber,
            title,
            transcript
        );
      }

      return { success: true, factsCreated, entitiesCreated };

    } catch (error) {
      console.error(`❌ Error extracting facts from Episode ${episodeNumber}:`, error);
      return { success: false, factsCreated: 0, entitiesCreated: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const podcastFactExtractor = new PodcastFactExtractor();