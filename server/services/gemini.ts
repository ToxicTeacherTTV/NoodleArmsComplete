import { GoogleGenAI } from "@google/genai";

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  async extractFactsFromDocument(content: string, filename: string): Promise<Array<{
    content: string;
    type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT';
    importance: number;
    keywords: string[];
  }>> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `You are analyzing a document that may contain information about or from Nicky "Noodle Arms" A.I. Dente (a foul-mouthed Italian mafia-themed Dead by Daylight streamer who co-hosts "Camping Them Softly" podcast), the user who uploaded this document, or other people.

CRITICAL: Pay attention to WHO is saying or doing what. This could be:
- Content BY Nicky (his own statements/preferences) 
- Content ABOUT Nicky (others describing him)
- Content BY the USER (their own statements/preferences)
- Content ABOUT other people (guests, characters, etc.)

Analyze document: "${filename}"

Content:
${content}

Extract relevant facts, but ONLY store information that is clearly ABOUT NICKY or BY NICKY. Do NOT store user preferences as Nicky's traits.

For each fact about Nicky, provide:
- content: The actual fact with clear attribution (1-2 sentences max)
- type: FACT (general info), PREFERENCE (likes/dislikes), LORE (backstory), or CONTEXT (situational)  
- importance: 1-5 (5 being most important for character consistency)
- keywords: 2-4 relevant keywords for retrieval

ONLY include facts that are:
1. Nicky's personality traits, preferences, or backstory
2. Nicky's Dead by Daylight knowledge, strategies, or opinions
3. Nicky's streaming/podcast content or habits  
4. Nicky's relationships with other characters (Earl, Vice Don, etc.)

DO NOT include:
- User's personal preferences or statements
- Other people's preferences (unless about Nicky)
- General gaming information not specific to Nicky

Return as JSON array. Only include substantial, unique facts about Nicky specifically.

Example format:
[
  {
    "content": "Nicky states he prefers playing as Ghostface because of the stealth gameplay style",
    "type": "PREFERENCE",
    "importance": 4, 
    "keywords": ["ghostface", "stealth", "killer", "preference"]
  }
]`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string" },
                type: { type: "string", enum: ["FACT", "PREFERENCE", "LORE", "CONTEXT"] },
                importance: { type: "number" },
                keywords: { type: "array", items: { type: "string" } }
              },
              required: ["content", "type", "importance", "keywords"]
            }
          }
        },
        contents: prompt,
      });

      const rawJson = response.text;
      if (rawJson) {
        return JSON.parse(rawJson);
      } else {
        throw new Error("Empty response from Gemini");
      }
    } catch (error) {
      console.error("Gemini fact extraction error:", error);
      throw new Error(`Failed to extract facts: ${error}`);
    }
  }

  async deduplicateAndOptimizeFacts(facts: Array<{
    content: string;
    type: string;
    importance: number;
    keywords: string[];
  }>): Promise<Array<{
    content: string;
    type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT';
    importance: number;
    keywords: string[];
  }>> {
    if (facts.length === 0) return [];

    const prompt = `You are optimizing a knowledge base for Nicky "Noodle Arms" A.I. Dente, the Italian mafia-themed Dead by Daylight streamer.

Analyze these facts and:
1. Remove exact duplicates
2. Merge similar facts into single, comprehensive entries
3. Ensure each fact is unique and valuable
4. Maintain character voice and personality

Facts to optimize:
${JSON.stringify(facts, null, 2)}

Return the optimized facts as a JSON array. Keep the most important and unique information while eliminating redundancy.`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string" },
                type: { type: "string", enum: ["FACT", "PREFERENCE", "LORE", "CONTEXT"] },
                importance: { type: "number" },
                keywords: { type: "array", items: { type: "string" } }
              },
              required: ["content", "type", "importance", "keywords"]
            }
          }
        },
        contents: prompt,
      });

      const rawJson = response.text;
      if (rawJson) {
        return JSON.parse(rawJson);
      } else {
        throw new Error("Empty response from Gemini");
      }
    } catch (error) {
      console.error("Gemini optimization error:", error);
      return facts as Array<{
        content: string;
        type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT';
        importance: number;
        keywords: string[];
      }>; // Return original facts if optimization fails
    }
  }

  async consolidateAndOptimizeMemories(memories: Array<{
    id: string;
    type: string;
    content: string;
    importance: number;
    source?: string;
  }>): Promise<Array<{
    type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT';
    content: string;
    importance: number;
    source?: string;
  }>> {
    if (memories.length === 0) return [];

    const prompt = `You are optimizing a knowledge base for Nicky "Noodle Arms" A.I. Dente, the Italian mafia-themed Dead by Daylight streamer.

Consolidate and optimize these memory entries by:
1. Removing exact duplicates and near-duplicates
2. Merging related facts into comprehensive entries
3. Improving clarity and organization
4. Maintaining all important character details
5. Ensuring each fact is unique and valuable

Memory entries to consolidate:
${memories.map(m => `[${m.type}] ${m.content} (importance: ${m.importance})`).join('\n')}

Return the optimized memory entries as a JSON array. Preserve character personality, preferences, and important game knowledge while eliminating redundancy.

Response format:
[
  {
    "content": "consolidated fact here",
    "type": "FACT|PREFERENCE|LORE|CONTEXT", 
    "importance": 1-5,
    "source": "consolidation"
  }
]`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string" },
                type: { type: "string", enum: ["FACT", "PREFERENCE", "LORE", "CONTEXT"] },
                importance: { type: "number" },
                source: { type: "string" }
              },
              required: ["content", "type", "importance"]
            }
          }
        },
        contents: prompt,
      });

      const rawJson = response.text;
      if (rawJson) {
        const consolidated = JSON.parse(rawJson);
        return consolidated.map((item: any) => ({
          ...item,
          type: item.type as 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT',
          source: item.source || 'consolidation'
        }));
      } else {
        throw new Error("Empty response from Gemini");
      }
    } catch (error) {
      console.error("Gemini consolidation error:", error);
      // Return simplified version of original memories if consolidation fails
      return memories.map(m => ({
        content: m.content,
        type: m.type as 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT',
        importance: Math.max(1, m.importance - 1),
        source: m.source || 'fallback'
      }));
    }
  }
}

// Generate lore content for emergent storytelling
export async function generateLoreContent(prompt: string): Promise<any> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error('Lore generation error:', error);
    throw new Error(`Failed to generate lore: ${error}`);
  }
}

export const geminiService = new GeminiService();