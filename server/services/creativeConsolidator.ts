import { GoogleGenAI } from "@google/genai";
import { IStorage } from '../storage.js';
import { InsertMemoryEntry } from '@shared/schema';
import { executeWithDefaultModel } from './modelSelector.js';

export class CreativeConsolidator {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  /**
   * Analyzes the AI's own output to extract "Creative Bullshit" (Stories, Lore, Claims)
   * and saves them as low-confidence memories.
   */
  async consolidateCreativeOutput(
    aiContent: string,
    userMessage: string,
    profileId: string,
    storage: IStorage
  ): Promise<number> {
    // 1. Quick filter: Only process if content is substantial
    if (aiContent.length < 100) return 0;

    // 2. Extract creative facts using AI
    const creativeFacts = await this.extractCreativeFacts(aiContent, userMessage);

    if (creativeFacts.length === 0) return 0;

    // 3. Save to database
    let savedCount = 0;
    for (const fact of creativeFacts) {
      try {
        const memory: InsertMemoryEntry = {
          profileId,
          type: fact.type as any,
          content: fact.content,
          importance: fact.importance,
          confidence: 50, // Fixed low confidence as requested
          source: 'self_generated', // Mark as self-generated
          keywords: fact.keywords,
          isProtected: false,
          status: 'ACTIVE',
          canonicalKey: `creative_${Date.now()}_${Math.random().toString(36).substring(7)}`
        };

        await storage.addMemoryEntry(memory);
        savedCount++;
      } catch (error) {
        console.warn('⚠️ Failed to save creative memory:', error);
      }
    }

    return savedCount;
  }

  private async extractCreativeFacts(aiContent: string, userMessage: string): Promise<Array<{ content: string; type: string; keywords: string[]; importance: number }>> {
    const prompt = `You are analyzing a creative response from an AI character named Nicky (a Bronx Italian-American streamer).
    
USER PROMPT: "${userMessage}"
AI RESPONSE: "${aiContent}"

Your job is to extract **NEW INVENTED LORE, STORIES, or CLAIMS** that the AI just made up.
The user explicitly wants to "commit the bullshit to memory" so the AI remembers its own creative inventions later.

**TARGETS:**
1. **Viewer Backstories:** If Nicky invents a viewer (e.g., "Joey from the Bronx who eats pizza"), extract that.
2. **Personal Tall Tales:** If Nicky claims he did something wild (e.g., "I fought a bear"), extract that.
3. **World Building:** If Nicky invents a fact about his stream, his basement, or his "cousins".

**RULES:**
- Ignore generic chatter ("Hey guys, welcome back").
- Ignore real-world facts (unless Nicky twists them).
- **IGNORE WEB SEARCH RESULTS:** Do not extract facts that look like citations, search queries, or external sources (e.g., "Source: youtube.com", "searched for:").
- **CONFIDENCE IS LOW (50%)** by default, so capture even wild claims.
- Format as concise facts.

Return a JSON object with a "facts" array.
{
  "facts": [
    {
      "content": "Nicky claims he has a cousin named Vinny who sells illegal gabagool.",
      "type": "LORE", // or STORY, FACT
      "keywords": ["cousin", "vinny", "gabagool", "lore"],
      "importance": 5
    }
  ]
}`;

    try {
      return await executeWithDefaultModel(async (model) => {
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
                      type: { type: "string", enum: ['LORE', 'STORY', 'FACT'] },
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
      console.error("❌ Creative Extraction failed:", error);
      return [];
    }
  }
}

export const creativeConsolidator = new CreativeConsolidator();
