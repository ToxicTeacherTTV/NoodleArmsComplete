import { InsertMemoryEntry } from '@shared/schema';
import { IStorage } from '../storage.js';
import { entityExtraction } from './entityExtraction.js';
import { GoogleGenAI } from "@google/genai";
import { executeWithProductionModel, safeExtractText } from './modelSelector.js';

export class PodcastFactExtractor {
  private ai: GoogleGenAI;

  // Chunk size for processing long transcripts (25k chars with 2k overlap)
  private readonly CHUNK_SIZE = 25000;
  private readonly CHUNK_OVERLAP = 2000;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || ""
    });
  }

  /**
   * Split transcript into overlapping chunks for complete processing
   */
  private chunkTranscript(transcript: string): string[] {
    if (transcript.length <= this.CHUNK_SIZE) {
      return [transcript];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < transcript.length) {
      let endIndex = startIndex + this.CHUNK_SIZE;

      // Try to break at a sentence boundary (., !, ?, or newline)
      if (endIndex < transcript.length) {
        const searchStart = endIndex - 500; // Look back 500 chars for a good break point
        const searchRegion = transcript.substring(searchStart, endIndex);

        // Find last sentence boundary in the search region
        const lastBreak = Math.max(
          searchRegion.lastIndexOf('. '),
          searchRegion.lastIndexOf('.\n'),
          searchRegion.lastIndexOf('! '),
          searchRegion.lastIndexOf('?\n'),
          searchRegion.lastIndexOf('\n\n')
        );

        if (lastBreak > 0) {
          endIndex = searchStart + lastBreak + 1;
        }
      }

      chunks.push(transcript.substring(startIndex, endIndex));

      // Move start index, accounting for overlap
      startIndex = endIndex - this.CHUNK_OVERLAP;

      // Prevent infinite loop
      if (startIndex >= transcript.length - 100) break;
    }

    return chunks;
  }

  private async extractFactsFromChunk(chunk: string, chunkIndex: number, totalChunks: number): Promise<Array<{ content: string; type: string; keywords: string[]; importance: number }>> {
    if (!chunk || chunk.length < 50) return [];

    const prompt = `You are an expert archivist for the "Noodle Arms" podcast. Your job is to extract PERMANENT FACTS and MEMORIES about NICKY from the following podcast transcript.

${totalChunks > 1 ? `NOTE: This is chunk ${chunkIndex + 1} of ${totalChunks} from a longer transcript.` : ''}

CRITICAL: This podcast has TWO CO-HOSTS:
1. **Toxic** (or "ToxicTeacher", "Host") - The HUMAN co-host. DO NOT extract his opinions/facts as Nicky's.
2. **Nicky** (or "Noodle Arms", "Nicky Noodle Arms", "Nicky A.I. Dente") - The AI co-host. ONLY extract facts about/from HIM.

The transcript has speaker labels like "Toxic:", "Nicky:", "[Toxic]", "[Nicky]", etc.

TRANSCRIPT:
"${chunk}"

INSTRUCTIONS:
Extract 10-20 distinct, atomic facts from this section. ONLY extract facts that are:
- Said BY Nicky (his opinions, stories, preferences)
- Said ABOUT Nicky by Toxic or others (e.g., "Toxic mentions that Nicky hates camping killers")

IMPORTANT - FAMILY & PERSONAL LORE:
Pay special attention to any mentions of Nicky's family members (father, mother, cousins, uncles, aunts, etc.).
These are HIGH PRIORITY facts that should always be extracted.

Focus on:
1. Nicky's specific opinions and hot takes
2. Nicky's stories and lore (his fictional Italian-American backstory, SABAM, etc.)
3. Nicky's relationships with people (real or fictional)
4. Nicky's family members and their names/stories
5. Nicky's gaming preferences (Dead by Daylight, etc.)
6. Nicky's personal details and character traits

Do NOT extract:
- Toxic's personal opinions (unless they're ABOUT Nicky)
- Generic greetings or filler
- Ambiguous statements
- Facts about Toxic himself

Return a JSON object with a "facts" array. Each fact should have:
- content: The fact statement (e.g., "Nicky thinks The Trapper is the worst killer in DBD")
- type: One of ['OPINION', 'LORE', 'PREFERENCE', 'RELATIONSHIP', 'STORY']
- keywords: Array of 3-5 search keywords
- importance: 1-100 scale (100 = critical lore, 1 = trivial). Family lore should be 80+.
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

        const rawJson = safeExtractText(response);
        if (rawJson) {
          const result = JSON.parse(rawJson);
          return result.facts || [];
        }
        return [];
      }, 'extraction');
    } catch (error) {
      console.error(`❌ AI Fact Extraction failed for chunk ${chunkIndex + 1}:`, error);
      return [];
    }
  }

  /**
   * Extract facts from full transcript by processing in chunks
   */
  private async extractFactsWithAI(transcript: string): Promise<Array<{ content: string; type: string; keywords: string[]; importance: number }>> {
    if (!transcript || transcript.length < 50) return [];

    const chunks = this.chunkTranscript(transcript);
    console.log(`📄 Transcript is ${transcript.length} chars, split into ${chunks.length} chunks`);

    const allFacts: Array<{ content: string; type: string; keywords: string[]; importance: number }> = [];
    const seenContent = new Set<string>();

    for (let i = 0; i < chunks.length; i++) {
      console.log(`   🔍 Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`);

      const chunkFacts = await this.extractFactsFromChunk(chunks[i], i, chunks.length);

      // Deduplicate facts (in case of overlap between chunks)
      for (const fact of chunkFacts) {
        const normalizedContent = fact.content.toLowerCase().trim();
        if (!seenContent.has(normalizedContent)) {
          seenContent.add(normalizedContent);
          allFacts.push(fact);
        }
      }

      console.log(`   ✅ Chunk ${i + 1}: extracted ${chunkFacts.length} facts (${allFacts.length} total unique)`);

      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return allFacts;
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

          // FIXED: Normalize importance to 1-100 scale and reduce auto-confidence
          const normalizedImportance = fact.importance
            ? (fact.importance <= 10 ? fact.importance * 10 : Math.min(fact.importance, 100))
            : 45; // Default to moderate importance

          const memoryEntry: InsertMemoryEntry = {
            profileId,
            type: 'FACT', // All podcast content stored as facts
            content: fact.content,
            importance: normalizedImportance,
            source: 'podcast_episode',
            sourceId: episodeId,
            keywords: Array.from(new Set(enhancedKeywords)), // Remove duplicates
            confidence: 75, // FIXED: Was 95, reduced to allow room for verified facts
            temporalContext: `Episode ${episodeNumber} (${title})`,
            qualityScore: Math.min(fact.importance || 5, 10),
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
      // Process in chunks to capture entities from the entire transcript
      let entitiesCreated = 0;
      try {
        console.log(`🔍 Extracting entities from Episode ${episodeNumber} transcript (chunked)...`);

        const chunks = this.chunkTranscript(transcript);
        const totalPersonIds: string[] = [];
        const totalPlaceIds: string[] = [];
        const totalEventIds: string[] = [];
        const totalConceptIds: string[] = [];
        const totalItemIds: string[] = [];
        const totalMiscIds: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
          console.log(`   🔍 Entity extraction chunk ${i + 1}/${chunks.length}...`);

          const contextualChunk = `Episode ${episodeNumber}: ${title} (Part ${i + 1}/${chunks.length})\n\n${chunks[i]}`;

          const entityResult = await entityExtraction.processMemoryForEntityLinking(
            contextualChunk,
            profileId,
            storage
          );

          // Collect unique IDs
          entityResult.personIds.forEach(id => { if (!totalPersonIds.includes(id)) totalPersonIds.push(id); });
          entityResult.placeIds.forEach(id => { if (!totalPlaceIds.includes(id)) totalPlaceIds.push(id); });
          entityResult.eventIds.forEach(id => { if (!totalEventIds.includes(id)) totalEventIds.push(id); });
          entityResult.conceptIds.forEach(id => { if (!totalConceptIds.includes(id)) totalConceptIds.push(id); });
          entityResult.itemIds.forEach(id => { if (!totalItemIds.includes(id)) totalItemIds.push(id); });
          entityResult.miscIds.forEach(id => { if (!totalMiscIds.includes(id)) totalMiscIds.push(id); });

          entitiesCreated += entityResult.entitiesCreated;

          // Small delay between chunks
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (entitiesCreated > 0) {
          console.log(`✨ Extracted ${entitiesCreated} new entities from Episode ${episodeNumber}`);
          console.log(`   📊 Entity breakdown: ${totalPersonIds.length} people, ${totalPlaceIds.length} places, ${totalEventIds.length} events, ${totalConceptIds.length} concepts, ${totalItemIds.length} items, ${totalMiscIds.length} misc`);
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