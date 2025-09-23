import { GoogleGenAI } from "@google/genai";
import { contentFilter } from './contentFilter.js';

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  // Enhanced hierarchical extraction methods
  async extractStoriesFromDocument(content: string, filename: string): Promise<Array<{
    content: string;
    type: 'STORY' | 'LORE' | 'CONTEXT';
    importance: number;
    keywords: string[];
  }>> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `You are analyzing NICKY'S CONTENT ONLY from document: "${filename}"

CRITICAL INSTRUCTIONS:
- This content has been pre-filtered to contain ONLY Nicky's statements, responses, and attributions
- Do NOT include user questions or prompts in extracted stories
- Focus ONLY on what Nicky said, did, experienced, or expressed
- If content seems to contain both sides of conversation, extract only Nicky's parts

Content (Nicky's responses only):
${content}

Extract COMPLETE STORIES, ANECDOTES, and RICH CONTEXTS that Nicky shared about himself. Focus on:
- Nicky's backstory narratives 
- Incidents Nicky described
- Nicky's character interactions
- Relationships Nicky explained
- Experiences Nicky shared
- Background context Nicky provided

For each story/narrative, provide:
- content: The COMPLETE story/context from Nicky's perspective (1-3 sentences max)
- type: STORY (incidents/events), LORE (backstory), or CONTEXT (situational background)
- importance: 1-5 (5 being most important for character understanding)
- keywords: 3-5 relevant keywords for retrieval

Return as JSON array. Only include substantial narrative content BY or ABOUT Nicky.

Example format:
[
  {
    "content": "The 2005 incident where Nicky first clashed with Earl in World of Warcraft began when Nicky was playing his orc warrior PastaEnforcer on the Tichondrius server. Earl, playing a human mage named Teadiculous, kept repeatedly killing Nicky in contested zones. This escalated when Earl started camping Nicky's corpse for hours, leading to Nicky's first recorded threat to 'call his digital guys.' The feud continued for months, with both players recruiting their guilds into elaborate revenge schemes that eventually got both temporarily banned. This incident established their competitive dynamic that continues today.",
    "type": "STORY",
    "importance": 4,
    "keywords": ["earl", "warcraft", "feud", "origin", "tichondrius"]
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
                type: { type: "string", enum: ["STORY", "LORE", "CONTEXT"] },
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
      console.error("Gemini story extraction error:", error);
      throw new Error(`Failed to extract stories: ${error}`);
    }
  }

  async extractAtomicFactsFromStory(storyContent: string, storyContext: string): Promise<Array<{
    content: string;
    type: 'ATOMIC';
    importance: number;
    keywords: string[];
    storyContext: string;
  }>> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `You are breaking down a narrative about Nicky "Noodle Arms" A.I. Dente into ATOMIC FACTS.

Story Context: ${storyContext}

Full Story (Nicky's content only):
${storyContent}

CRITICAL RULES:
- Extract ONLY facts stated BY Nicky or ABOUT Nicky
- Ignore any user questions or prompts that may be mixed in
- Each fact must be 1-2 sentences MAXIMUM
- Focus on specific, verifiable claims
- Clear about WHO did WHAT

Extract individual, verifiable claims from this story. Each atomic fact should be:
- A single, specific claim about Nicky
- Independently verifiable
- 1-2 sentences maximum (HARD LIMIT)
- Clear about WHO did WHAT

For each atomic fact, provide:
- content: The specific atomic claim (max 2 sentences)
- type: "ATOMIC" (always)
- importance: 1-5 based on how critical this detail is
- keywords: 2-4 keywords for retrieval
- storyContext: Brief note about which part of the story this relates to

Example - from story about WoW incident:
[
  {
    "content": "Nicky played an orc warrior named PastaEnforcer",
    "type": "ATOMIC",
    "importance": 3,
    "keywords": ["character", "warrior", "PastaEnforcer"],
    "storyContext": "WoW character details"
  },
  {
    "content": "Earl played human mage named Teadiculous", 
    "type": "ATOMIC",
    "importance": 3,
    "keywords": ["earl", "mage", "Teadiculous"],
    "storyContext": "Earl's character details"
  }
]

Return as JSON array.`;

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
                type: { type: "string", enum: ["ATOMIC"] },
                importance: { type: "number" },
                keywords: { type: "array", items: { type: "string" } },
                storyContext: { type: "string" }
              },
              required: ["content", "type", "importance", "keywords", "storyContext"]
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
      console.error("Gemini atomic fact extraction error:", error);
      
      // Return empty array instead of crashing the app
      console.warn("Continuing without atomic fact extraction due to API error");
      return [];
    }
  }

  // Legacy method for backward compatibility
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

  // Chat response generation method (fallback for when Anthropic credits are exhausted)
  async generateChatResponse(
    userMessage: string,
    coreIdentity: string,
    contextPrompt: string = ""
  ): Promise<{ content: string; processingTime: number; retrievedContext?: string }> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const startTime = Date.now();

    try {
      // Build the full prompt for Gemini
      const fullPrompt = `The Toxic Teacher says: "${userMessage}"${contextPrompt}`;

      console.log('🌟 Using Gemini fallback for chat response');

      // Try multiple times with different models to handle server overload
      let response;
      const models = ["gemini-2.5-flash", "gemini-2.5-pro"]; // Try flash first (less busy)
      
      for (let attempt = 0; attempt < 3; attempt++) {
        for (const modelName of models) {
          try {
            console.log(`🔄 Gemini attempt ${attempt + 1}/3 with model: ${modelName}`);
            
            response = await this.ai.models.generateContent({
              model: modelName,
              config: {
                systemInstruction: coreIdentity,
                temperature: 1.0, // Maximum creativity to match Anthropic
              },
              contents: fullPrompt,
            });
            
            if (response?.text) {
              console.log(`✅ Gemini success with ${modelName} on attempt ${attempt + 1}`);
              break;
            }
          } catch (modelError: any) {
            console.warn(`⚠️  ${modelName} failed (attempt ${attempt + 1}):`, modelError?.message || String(modelError));
            
            // If it's not an overload error, don't retry this model
            if (!modelError?.message?.includes('overloaded')) {
              continue;
            }
          }
        }
        
        if (response?.text) break;
        
        // Wait before retrying (exponential backoff)
        if (attempt < 2) {
          const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      if (!response?.text) {
        throw new Error('All Gemini models failed or are overloaded');
      }

      // 🚫 Filter content to prevent cancel-worthy language while keeping profanity
      const rawContent = response.text || '';
      const { filtered: filteredContent, wasFiltered } = contentFilter.filterContent(rawContent);
      
      if (wasFiltered) {
        console.warn(`🚫 Gemini content filtered to prevent cancel-worthy language`);
      }

      const processingTime = Date.now() - startTime;

      return {
        content: filteredContent,
        processingTime,
        retrievedContext: contextPrompt || undefined,
      };
    } catch (error) {
      console.error('❌ Gemini chat API error:', error);
      
      // Classify error for appropriate handling
      const errorInfo = this.classifyGeminiError(error);
      console.log(`🔄 Gemini error classified as: ${errorInfo.type}`);
      
      // Provide graceful degradation instead of throwing
      console.warn("⚠️ Gemini API failed, providing fallback response");
      
      return {
        content: "Ay, my backup brain's having a moment! Give me a sec to recalibrate... 🤖💭",
        processingTime: Date.now() - startTime,
        retrievedContext: contextPrompt || undefined
      };
    }
  }

  /**
   * Analyze content for flags using Gemini with structured response
   */
  async analyzeContentForFlags(
    content: string,
    contentType: 'MEMORY' | 'MESSAGE' | 'DOCUMENT' | 'CONVERSATION',
    prompt: string
  ): Promise<any> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash", // Use flash for speed and availability
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            flags: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  flagType: { type: "string" },
                  priority: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
                  confidence: { type: "number" },
                  reason: { type: "string" },
                  extractedData: {
                    type: "object",
                    properties: {
                      characterNames: { type: "array", items: { type: "string" } },
                      relationships: { type: "array", items: { type: "string" } },
                      emotions: { type: "array", items: { type: "string" } },
                      topics: { type: "array", items: { type: "string" } },
                      contradictions: { type: "array", items: { type: "string" } },
                      patterns: { type: "array", items: { type: "string" } }
                    }
                  }
                },
                required: ["flagType", "priority", "confidence", "reason"]
              }
            }
          },
          required: ["flags"]
        },
        temperature: 0.1 // Low temperature for consistent flagging
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }], // Proper structured format
    });

    const rawJson = response.text;
    if (!rawJson) {
      throw new Error('Empty response from Gemini');
    }

    return JSON.parse(rawJson);
  }

  // NEW: Parse podcast segments from transcript for Nicky's memory system
  async parseShowSegments(transcript: string, episodeTitle: string): Promise<Array<{
    title: string;
    description: string;
    segmentType: string;
    content: string;
    startTime?: number;
    endTime?: number;
  }>> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `You are analyzing a transcript from Nicky "Noodle Arms" A.I. Dente's podcast episode: "${episodeTitle}"

CRITICAL INSTRUCTIONS:
- This is for Nicky's memory system, not production editing
- Identify RECURRING SHOW SEGMENTS by their actual names/phrases
- Extract what content was covered in each segment
- Pay attention to timestamps in format [HH:MM:SS:FF] to identify segment boundaries

TRANSCRIPT:
${transcript}

The transcript contains timestamps in format [HH:MM:SS:FF - HH:MM:SS:FF] where:
- HH = hours, MM = minutes, SS = seconds, FF = frames (ignore frames)
- Use these to identify when segments start and end

Look for these RECURRING SHOW SEGMENTS and extract what was covered:

1. **"Toxic Fucking News"** (or similar toxic news segment)
   - What news stories, events, or current affairs were discussed
   - Any specific incidents, people, or topics covered

2. **"Word from the Don"** (or advice/wisdom segment) 
   - What advice, wisdom, or guidance was shared
   - Life lessons, business tips, or philosophical insights

3. **"Where the F are the Viewers From"** (or geographic/viewer interaction)
   - Geographic locations mentioned
   - Viewer interactions or call-outs by location
   - Any regional topics or references

4. **Other Recurring Segments** (if you identify any other recurring segment patterns)
   - Gaming discussions, family stories, mafia references, etc.

For each segment found, provide:
- title: The actual segment name (e.g., "Toxic Fucking News")
- description: Brief summary of what was covered (1-2 sentences)
- segmentType: Category (NEWS, ADVICE, VIEWERS, GAMING, STORY, etc.)
- content: Detailed summary of topics, stories, or points discussed (2-3 sentences)
- startTime: Start time in seconds (convert from HH:MM:SS, ignore frames)
- endTime: End time in seconds (convert from HH:MM:SS, ignore frames)

Return as JSON array. If no clear segments are found, return empty array.

Example format:
[
  {
    "title": "Toxic Fucking News",
    "description": "Discussion of recent news events and current affairs",
    "segmentType": "NEWS", 
    "content": "Covered the subway incident in NYC, talked about the political situation with the mayor's response, and discussed how the media is handling the coverage differently than last year's similar events.",
    "startTime": 120,
    "endTime": 480
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
                title: { type: "string" },
                description: { type: "string" },
                segmentType: { type: "string" },
                content: { type: "string" },
                startTime: { type: "number" },
                endTime: { type: "number" }
              },
              required: ["title", "description", "segmentType", "content", "startTime"]
            }
          }
        },
        contents: prompt,
      });

      const rawJson = response.text;
      if (rawJson) {
        const segments = JSON.parse(rawJson);
        console.log(`🎙️ Parsed ${segments.length} show segments from "${episodeTitle}"`);
        return segments;
      } else {
        throw new Error("Empty response from Gemini");
      }
    } catch (error) {
      console.error("Gemini segment parsing error:", error);
      return []; // Return empty array if parsing fails
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