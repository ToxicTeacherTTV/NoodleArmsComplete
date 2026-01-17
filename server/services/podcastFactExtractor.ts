import { InsertMemoryEntry } from '@shared/schema';
import { IStorage } from '../storage.js';
import { entityExtraction } from './entityExtraction.js';
import { GoogleGenAI } from "@google/genai";
import { executeWithProductionModel } from './modelSelector.js';

export class PodcastFactExtractor {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  private async extractFactsWithAI(transcript: string): Promise<Array<{ content: string; type: string; keywords: string[]; importance: number }>> {
    if (!transcript || transcript.length < 50) return [];

    const prompt = `You are an expert archivist for the "Noodle Arms" podcast. Your job is to extract PERMANENT FACTS and MEMORIES about NICKY from the following podcast transcript.

CRITICAL: This podcast has TWO CO-HOSTS:
1. **Toxic** (or "ToxicTeacher", "Host") - The HUMAN co-host. DO NOT extract his opinions/facts as Nicky's.
2. **Nicky** (or "Noodle Arms", "Nicky Noodle Arms", "Nicky A.I. Dente") - The AI co-host. ONLY extract facts about/from HIM.

The transcript has speaker labels like "Toxic:", "Nicky:", "[Toxic]", "[Nicky]", etc.

TRANSCRIPT:
"${transcript.substring(0, 30000)}" ${(transcript.length > 30000) ? '...(truncated)' : ''}

INSTRUCTIONS:
Extract 10-20 distinct, atomic facts from this episode. ONLY extract facts that are:
- Said BY Nicky (his opinions, stories, preferences)
- Said ABOUT Nicky by Toxic or others (e.g., "Toxic mentions that Nicky hates camping killers")

Focus on:
1. Nicky's specific opinions and hot takes
2. Nicky's stories and lore (his fictional Italian-American backstory, SABAM, etc.)
3. Nicky's relationships with people (real or fictional)
4. Nicky's gaming preferences (Dead by Daylight, etc.)
5. Nicky's personal details and character traits

Do NOT extract:
- Toxic's personal opinions (unless they're ABOUT Nicky)
- Generic greetings or filler
- Ambiguous statements
- Facts about Toxic himself

Return a JSON object with a "facts" array. Each fact should have:
- content: The fact statement (e.g., "Nicky thinks The Trapper is the worst killer in DBD")
- type: One of ['OPINION', 'LORE', 'PREFERENCE', 'RELATIONSHIP', 'STORY']
- keywords: Array of 3-5 search keywords
- importance: 1-100 scale (100 = critical lore, 1 = trivial)
- lane: One of ['CANON', 'RUMOR']. Use 'RUMOR' if the statement is an obvious exaggeration, a lie, or part of Nicky's performative bullshit.
- truthDomain: One of ['DOC', 'PODCAST', 'OPS', 'NICKY_LORE', 'SABAM_LORE', 'GENERAL']. For podcast transcripts, use 'PODCAST'.

JSON FORMAT:
{
  "facts": [
    {
      "content": "Nicky hates playing against The Skull Merchant",
      "type": "PREFERENCE",
      "keywords": ["skull merchant", "dbd", "killer", "hate"],
      "importance": 85,
      "lane": "CANON",
      "truthDomain": "PODCAST"
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
                      importance: { type: "number" },
                      lane: { type: "string", enum: ['CANON', 'RUMOR'] },
                      truthDomain: { type: "string", enum: ['DOC', 'PODCAST', 'OPS', 'NICKY_LORE', 'SABAM_LORE', 'GENERAL'] }
                    },
                    required: ["content", "type", "keywords", "importance", "lane", "truthDomain"]
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
    // Recognize various speaker label formats from transcripts
    const lines = transcript.split('\n');
    const nickyLines: string[] = [];

    // Patterns for Nicky's speaker labels
    const nickyPatterns = [
      /^(Nicky|NICKY|Noodle Arms|NOODLE ARMS|Nicky Noodle Arms|Nicky A\.?I\.? Dente):?\s*/i,
      /^\[(Nicky|NICKY|Noodle Arms|NOODLE ARMS|Nicky Noodle Arms)\]\s*/i,
      /^\*\*(Nicky|Noodle Arms)\*\*:?\s*/i,  // Markdown bold format
    ];

    for (const line of lines) {
      for (const pattern of nickyPatterns) {
        if (pattern.test(line)) {
          const cleaned = line.replace(pattern, '').trim();
          if (cleaned) nickyLines.push(cleaned);
          break;
        }
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
        const doc = await storage.createDocument({
          profileId,
          name: `Training: Episode ${episodeNumber} - ${title}`,
          filename: `ep${episodeNumber}_training.txt`,
          contentType: 'text/plain',
          documentType: 'TRAINING_EXAMPLE',
          size: nickyLines.length,
          extractedContent: nickyLines,
          processingStatus: 'COMPLETED'
        });

        // 🔢 Generate embedding for semantic retrieval
        try {
            const { embeddingService } = await import('./embeddingService.js');
            await embeddingService.embedDocument(doc.id, nickyLines);
        } catch (e) {
            console.warn(`⚠️ Failed to generate embedding for training example ${doc.id}:`, e);
        }
        
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
    storage: IStorage,
    options?: { allowWrites?: boolean }
  ): Promise<{ success: boolean; factsCreated: number; entitiesCreated: number; error?: string }> {
    if (options?.allowWrites === false) {
      console.log(`🔒 Privacy Guard: Skipping podcast fact extraction for Episode ${episodeNumber}`);
      return { success: true, factsCreated: 0, entitiesCreated: 0 };
    }
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
            supportCount: 1
            // canonicalKey will be generated by storage.addMemoryEntry based on content
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

      // 📚 DISABLED: Training examples from transcripts aren't ideal
      // Transcripts are conversational/reactive, not representative of Nicky's style
      // Keeping this code for potential future use with better filtering
      // if (transcript.length > 500) {
      //   await this.createTrainingExampleFromTranscript(
      //       storage,
      //       profileId,
      //       episodeId,
      //       episodeNumber,
      //       title,
      //       transcript
      //   );
      // }

      return { success: true, factsCreated, entitiesCreated };

    } catch (error) {
      console.error(`❌ Error extracting facts from Episode ${episodeNumber}:`, error);
      return { success: false, factsCreated: 0, entitiesCreated: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const podcastFactExtractor = new PodcastFactExtractor();