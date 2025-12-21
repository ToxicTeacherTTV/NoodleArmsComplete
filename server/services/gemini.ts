import { GoogleGenAI } from "@google/genai";
import { contentFilter } from './contentFilter.js';
import { executeWithDefaultModel, executeWithProductionModel, executeWithModelFallback } from './modelSelector.js';
import { getDefaultModel, isValidModel } from '../config/geminiModels.js';
import { storage } from '../storage.js';

import { personalityCoach } from './personalityCoach.js';

/**
 * 🎯 INTELLIGENT MODEL SELECTION
 * 
 * **2025 UPDATE**: Primary operations now route to Gemini 3 Flash for superior speed and quality.
 * Gemini 3 Pro Preview is used as fallback.
 * 
 * **MODEL STRATEGY**:
 * 1. Primary Operations (Chat, RAG, Extraction): Gemini 3 Flash (PRIMARY)
 * 2. Fallback: Gemini 3 Pro Preview (when Flash fails)
 * 3. Last Resort: Gemini 2.5 Pro
 */

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || ""
    });

    const defaultModel = getDefaultModel();
    console.log(`✅ Gemini service initialized with default model: ${defaultModel}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'production'}`);
  }

  private validateModel(model: string, context: string): void {
    if (!isValidModel(model)) {
      throw new Error(
        `🚫 INVALID MODEL: ${model} is not a recognized model for ${context}. ` +
        `Check geminiModels.ts for available models.`
      );
    }
  }

  // Retry helper with exponential backoff
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    const delays = [1000, 3000, 9000]; // 1s, 3s, 9s

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if this is a retryable error
        const isRetryable =
          errorMessage.toLowerCase().includes('overload') ||
          errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('unavailable') ||
          errorMessage.toLowerCase().includes('timeout');

        if (!isRetryable || isLastAttempt) {
          console.error(`❌ ${operationName} failed after ${attempt + 1} attempts:`, errorMessage);
          throw error;
        }

        const delayMs = delays[attempt];
        console.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${errorMessage}`);
        console.log(`🔄 Retrying in ${delayMs / 1000}s...`);

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // TypeScript safety - should never reach here
    throw new Error(`Unexpected retry loop exit for ${operationName}`);
  }

  // 🎯 Detect document type to determine extraction scope
  private detectDocumentType(filename: string, content: string): 'organizational' | 'conversational' | 'general' {
    const lowerFilename = filename.toLowerCase();
    const lowerContent = content.toLowerCase();

    // Organizational/Lore documents
    const orgKeywords = [
      'roster', 'organization', 'members', 'hierarchy',
      'member registry', 'organizational', 'lore', 'character profiles',
      'backstory', 'universe', 'world-building', 'family tree'
    ];

    // Conversational documents
    const conversationalKeywords = [
      'transcript', 'conversation', 'episode', 'chat log',
      'dialogue', 'interview', 'stream', 'podcast'
    ];

    // Check organizational
    if (orgKeywords.some(keyword =>
      lowerFilename.includes(keyword) || lowerContent.includes(keyword)
    )) {
      console.log(`📋 Detected ORGANIZATIONAL document: ${filename}`);
      return 'organizational';
    }

    // Check conversational
    if (conversationalKeywords.some(keyword =>
      lowerFilename.includes(keyword) || lowerContent.includes(keyword)
    )) {
      console.log(`💬 Detected CONVERSATIONAL document: ${filename}`);
      return 'conversational';
    }

    console.log(`📄 Detected GENERAL document: ${filename}`);
    return 'general';
  }

  /**
   * Detect the topic/game context of a document for source-aware fact extraction
   */
  private detectDocumentContext(filename: string, content: string): string {
    const lowerFilename = filename.toLowerCase();
    const lowerContent = content.toLowerCase().substring(0, 2000); // Check first 2000 chars

    // Check for specific games/topics
    if (lowerFilename.includes('arc raiders') || lowerContent.includes('arc raiders')) {
      return 'Arc Raiders (tactical PvE extraction shooter)';
    }

    if (lowerFilename.includes('dbd') ||
      lowerFilename.includes('dead by daylight') ||
      lowerContent.includes('dead by daylight') ||
      lowerContent.includes('survivors') && lowerContent.includes('killers')) {
      return 'Dead by Daylight (asymmetric horror game)';
    }

    if (lowerFilename.includes('sabam') || lowerContent.includes('sabam')) {
      return "Nicky's SABAM organization (Italian-American mafia family)";
    }

    // Default: general Nicky lore
    return "Nicky 'Noodle Arms' A.I. Dente's universe";
  }

  // Enhanced hierarchical extraction methods - Pure Gemini Implementation
  async extractStoriesFromDocument(content: string, filename: string, modelOverride?: string): Promise<Array<{
    content: string;
    type: 'STORY' | 'LORE' | 'CONTEXT';
    importance: number;
    keywords: string[];
  }>> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const docType = this.detectDocumentType(filename, content);
    const docContext = this.detectDocumentContext(filename, content);

    let extractionScope = '';

    if (docType === 'organizational') {
      extractionScope = `📋 DOCUMENT TYPE: ORGANIZATIONAL/LORE
This document describes characters, organizations, or world-building in Nicky's universe.

EXTRACTION SCOPE - Include ALL of these:
✅ Character profiles (SABAM members, family, associates, rivals)
✅ Organizational structure (ranks, roles, hierarchy)
✅ Relationships between characters
✅ Character traits, abilities, quirks, and backstories
✅ Organizations, groups, and their purposes
✅ Locations, places, and settings
✅ World-building lore and universe details
✅ Rules, traditions, and customs

❌ DO NOT limit extraction to only facts about Nicky himself
✅ DO include facts about other characters in Nicky's world

EXAMPLES of what to extract from an organizational document:
- "Uncle Gnocchi claims to have invented Dead by Daylight" ✅
- "Mama Marinara is the Supreme Don who secretly runs everything" ✅
- "Bruno 'The Basement' Bolognese is a Junior Associate and Bubba specialist" ✅
- "SABAM ranks members by food items (LIT, PASTA, MEATBALL, etc.)" ✅
- "The Ravioli Twins share one gaming chair for authenticity" ✅`;

    } else if (docType === 'conversational') {
      extractionScope = `💬 DOCUMENT TYPE: CONVERSATIONAL
This content has been pre-filtered to contain ONLY Nicky's statements, responses, and attributions.

EXTRACTION SCOPE - Include:
✅ Statements made BY Nicky (opinions, claims, stories)
✅ Facts revealed ABOUT Nicky (preferences, history, traits)
✅ Nicky's reactions and emotional responses
✅ Direct quotes and expressions Nicky uses
✅ Events Nicky participated in or witnessed
✅ Information Nicky shared about others

Focus on what Nicky says and does, but include relevant context about people/things he discusses.`;

    } else {
      extractionScope = `📄 DOCUMENT TYPE: GENERAL
This document contains information relevant to Nicky's character, world, OR the games he plays.

EXTRACTION SCOPE - Include ALL relevant facts:
✅ Information about Nicky "Noodle Arms" A.I. Dente
✅ His family, associates, and organization (SABAM)
✅ Characters, places, and concepts in his sphere
✅ World lore, backstory, and universe details
✅ Relationships, conflicts, and alliances
✅ Rules, traditions, and important context
✅ GAME KNOWLEDGE: Mechanics, strategies, items, maps, and lore (Arc Raiders, DbD, etc.)

Extract comprehensively - this is building Nicky's knowledge base. Even if the document is purely technical (like a game guide), extract the facts so Nicky knows how to play/talk about it.`;
    }

    const prompt = `You are extracting facts from "${filename}" to build a knowledge base for Nicky "Noodle Arms" A.I. Dente.
He is a streamer who plays games like Dead by Daylight and Arc Raiders. He needs to know the lore, mechanics, and details of these games to talk about them intelligently.

🎯 DOCUMENT CONTEXT: This document is about ${docContext}

${extractionScope}

Content:
${content}

Extract COMPLETE STORIES, ANECDOTES, and RICH CONTEXTS. Focus on:
- Character backstory narratives 
- Incidents and events described
- Character interactions and relationships
- Experiences and background context
- Organizational details and hierarchy
- Game mechanics, patch notes, or progression systems (treat these as "Lore" or "Context")

CRITICAL: When extracting facts, INCLUDE SOURCE CONTEXT in the content itself.
- If this is about Arc Raiders: mention "in Arc Raiders" or "Arc Raiders character"
- If this is about Dead by Daylight: mention "in Dead by Daylight" or "DBD character"
- This prevents confusion between different games/topics

For each story/narrative, provide:
- content: The COMPLETE story/context WITH SOURCE CONTEXT (1-3 sentences max)
- type: STORY (incidents/events), LORE (backstory/game lore), or CONTEXT (mechanics/background)
- importance: 1-5 (5 being most important for character understanding)
- keywords: 3-5 relevant keywords for retrieval (INCLUDE game/topic name if relevant)

Return as JSON array.

Example format:
[
  {
    "content": "In Arc Raiders, the Enforcer is a heavily armored playable character specialized in close-quarters combat. The character uses shield abilities to protect teammates during extractions.",
    "type": "LORE",
    "importance": 4,
    "keywords": ["arc raiders", "enforcer", "character", "shield", "combat"]
  }
]`;

    // Use intelligent model selection with fallback
    const result = await executeWithModelFallback(async (model) => {
      this.validateModel(model, 'extractStoriesFromDocument');

      const response = await this.ai.models.generateContent({
        model,
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
    }, {
      purpose: 'extraction',
      maxRetries: 3,
      allowExperimental: true,
      forceModel: modelOverride
    });

    return result.data;
  }

  async extractAtomicFactsFromStory(storyContent: string, storyContext: string, modelOverride?: string): Promise<Array<{
    content: string;
    type: 'ATOMIC';
    importance: number;
    keywords: string[];
    storyContext: string;
  }>> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `You are breaking down a narrative into ATOMIC FACTS about Nicky "Noodle Arms" A.I. Dente and his universe.

Story Context: ${storyContext}

Full Story:
${storyContent}

EXTRACTION RULES:
- Extract ALL discrete, verifiable facts from this story
- Include facts about ANY character, place, or concept mentioned
- Each fact must be 1-2 sentences MAXIMUM
- Focus on specific, verifiable claims
- Clear about WHO did WHAT
- PRESERVE source context from the story (if it mentions "in Arc Raiders" or "in DBD", keep that context)

Extract individual, verifiable claims from this story. Each atomic fact should be:
- A single, specific claim
- Independently verifiable
- 1-2 sentences maximum (HARD LIMIT)
- Clear about WHO/WHAT and WHAT happened
- Include game/source context if present in the original story

For each atomic fact, provide:
- content: The specific atomic claim WITH source context if relevant (max 2 sentences)
- type: "ATOMIC" (always)
- importance: 1-10 based on how critical this detail is (1=Trivial, 5=Standard, 10=Critical)
- keywords: 3-5 keywords for retrieval (include game/source name if relevant)
- storyContext: Brief note about which part of the story this relates to

Examples from various stories:
[
  {
    "content": "In Arc Raiders, the Enforcer character uses shield abilities to protect teammates during extractions",
    "type": "ATOMIC",
    "importance": 8,
    "keywords": ["arc raiders", "enforcer", "shield", "teammates", "extraction"],
    "storyContext": "Arc Raiders character abilities"
  },
  {
    "content": "Uncle Gnocchi claims to have invented Dead by Daylight",
    "type": "ATOMIC",
    "importance": 9,
    "keywords": ["uncle gnocchi", "dbd", "invented", "claims"],
    "storyContext": "Uncle Gnocchi's legendary status"
  },
  {
    "content": "In DBD, Bruno Bolognese is actually one of the best Bubba players",
    "type": "ATOMIC",
    "importance": 3,
    "keywords": ["bruno", "bolognese", "bubba", "skill", "dbd"],
    "storyContext": "Bruno's gaming ability in Dead by Daylight"
  }
]

Return as JSON array.`;

    try {
      const result = await executeWithModelFallback(async (model) => {
        this.validateModel(model, 'extractAtomicFactsFromStory');

        const response = await this.ai.models.generateContent({
          model,
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
      }, {
        purpose: 'extraction',
        maxRetries: 3,
        allowExperimental: true,
        forceModel: modelOverride
      });

      return result.data;
    } catch (error) {
      console.error("❌ Gemini atomic fact extraction error:", error);

      // Classify the error for better handling
      const errorType = this.classifyGeminiError(error);
      console.warn(`⚠️ Fact extraction failed (${errorType}): Returning empty result with error flag`);

      // Return empty array but with error metadata for upstream handling
      const result: any[] = [];
      (result as any)._extractionError = {
        type: errorType,
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
      return result;
    }
  }

  /**
   * Distills raw text into a single atomic fact.
   */
  async distillTextToFact(text: string, modelOverride?: string): Promise<{ fact: string }> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `
      You are an expert editor summarizing a character's statements for a knowledge base.
      The character, Nicky, is very chaotic and verbose.
      Your task is to **distill** his rambling response into a concise, information-rich fact.

      GOAL: Extract the actual answer, opinion, or detail he provided.

      GUIDELINES:
      1. **Ignore the Drama**: Discard threats, breathing noises, stuttering, and "flavor" text unless it contains actual lore.
      2. **Focus on the Content**: If he lists perks, addons, or strategies, list them clearly.
      3. **Be Precise**: Instead of "Nicky talks about a build", say "Nicky's preferred build for [Killer] uses [Perk 1], [Perk 2], and [Addon]."
      4. **Capture Opinions**: If he loves/hates something, state it as a fact (e.g., "Nicky believes the Toy Sword addon is essential").

      TEXT TO DISTILL:
      "${text}"

      OUTPUT FORMAT:
      Return a JSON object with a single field "fact".
    `;

    try {
      const result = await executeWithModelFallback<{ fact: string }>(async (model) => {
        this.validateModel(model, 'distillTextToFact');

        const response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                fact: { type: "string" }
              },
              required: ["fact"]
            }
          }
        });
        
        const rawJson = response.text;
        if (rawJson) {
          return JSON.parse(rawJson);
        } else {
          throw new Error("Empty response from Gemini");
        }
      }, {
        purpose: 'chat', // Using chat purpose as it's a quick interaction
        maxRetries: 2,
        forceModel: modelOverride
      });
      
      return result.data;
    } catch (error) {
      console.error("❌ Distill Text failed:", error);
      return { fact: text }; // Fallback to original text
    }
  }

  async extractPodcastFacts(transcript: string, episodeNumber: number, episodeTitle: string): Promise<Array<{
    content: string;
    type: 'TOPIC' | 'QUOTE' | 'FACT' | 'STORY' | 'MOMENT';
    keywords: string[];
    importance: number;
  }>> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `Extract key facts, memorable moments, topics discussed, and quotes from Episode ${episodeNumber} of the podcast "${episodeTitle}".

Focus on extracting 15-25 specific, factual pieces of information that would be useful to remember:

1. KEY TOPICS discussed in detail
2. SPECIFIC QUOTES or memorable lines  
3. IMPORTANT POINTS or arguments made
4. GUEST insights or expertise shared
5. NOTABLE MOMENTS or events mentioned
6. FACTS or statistics mentioned
7. STORIES told during the episode
8. GAMEPLAY moments or results
9. AUDIENCE interactions or questions
10. CONTROVERSIAL opinions or takes

For each fact, provide:
- A clear, factual statement (1-2 sentences max)
- The type: TOPIC, QUOTE, FACT, STORY, or MOMENT
- Keywords that would help find this information
- Importance rating 1-5 (5 being most memorable/important)

TRANSCRIPT:
${transcript}

Respond with ONLY a JSON array - no other text:
[
  {
    "content": "The specific fact or quote from the episode",
    "type": "TOPIC",
    "keywords": ["relevant", "search", "terms"],
    "importance": 4
  }
]`;

    try {
      // Use default model for podcast fact extraction
      return await executeWithDefaultModel(async (model) => {
        this.validateModel(model, 'extractPodcastFacts');

        const response = await this.ai.models.generateContent({
          model,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string" },
                  type: { type: "string", enum: ["TOPIC", "QUOTE", "FACT", "STORY", "MOMENT"] },
                  keywords: { type: "array", items: { type: "string" } },
                  importance: { type: "number", minimum: 1, maximum: 5 }
                },
                required: ["content", "type", "keywords", "importance"]
              }
            },
            temperature: 0.3 // Higher creativity for fact extraction
          },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const rawJson = response.text;
        if (rawJson) {
          const facts = JSON.parse(rawJson);
          console.log(`🧠 Extracted ${facts.length} facts from Episode ${episodeNumber}`);
          return facts;
        } else {
          throw new Error("Empty response from Gemini");
        }
      }, 'extraction'); // Purpose: extraction (podcast facts)
    } catch (error) {
      console.error(`❌ Gemini fact extraction error for Episode ${episodeNumber}:`, error);
      console.warn(`⚠️ Returning empty array - fallback facts will be created`);
      return []; // Return empty array if extraction fails - fallback will handle it
    }
  }

  async extractDiscordMemberFacts(
    username: string,
    message: string,
    existingFacts: string[] = []
  ): Promise<Array<{ fact: string; confidence: number; category: string }>> {
    if (!process.env.GEMINI_API_KEY) {
      return [];
    }

    const prompt = `You are analyzing a Discord message to extract factual information about the user.

USER: ${username}
MESSAGE: "${message}"

EXISTING FACTS ABOUT ${username}:
${existingFacts.length > 0 ? '- ' + existingFacts.join('\n- ') : 'None'}

Extract NEW, specific, factual information about ${username} from this message. Focus on:
1. **Gameplay Preferences**: Killer/survivor mains, playstyle, perk preferences, strategies
2. **Game Knowledge**: Skill level, experience, opinions on game mechanics
3. **Personal Info**: Timezone, availability, background (only if explicitly stated)
4. **Other**: Hobbies, interests mentioned

CRITICAL RULES:
- Extract ONLY facts explicitly stated BY the user
- Do NOT infer or assume facts
- Do NOT extract facts about other people or characters
- Do NOT duplicate existing facts
- Be specific (e.g., "mains Nurse killer" not just "plays DBD")
- Include confidence score (0-100) based on how explicitly stated the fact is

Return as JSON. If no new facts can be extracted, return empty array:
{
  "facts": [
    {
      "fact": "Specific fact about ${username}",
      "confidence": 85,
      "category": "gameplay"
    }
  ]
}`;

    try {
      return await executeWithDefaultModel(async (model) => {
        this.validateModel(model, 'extractDiscordMemberFacts');

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
                      fact: { type: "string" },
                      confidence: { type: "number" },
                      category: { type: "string", enum: ["gameplay", "preference", "personal", "other"] }
                    },
                    required: ["fact", "confidence", "category"]
                  }
                }
              },
              required: ["facts"]
            },
            temperature: 0.1
          },
          contents: prompt,
        });

        const rawJson = response.text;
        if (rawJson) {
          const result = JSON.parse(rawJson);
          return result.facts || [];
        }
        return [];
      }, 'extraction'); // Purpose: extraction (Discord member facts)
    } catch (error) {
      console.error('Discord fact extraction error:', error);
      return [];
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
      return await executeWithDefaultModel(async (model) => {
        this.validateModel(model, 'consolidateAndOptimizeMemories');

        const response = await this.ai.models.generateContent({
          model,
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
      }, 'generation'); // Purpose: generation (consolidate memories)
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
    relevantMemories: any[] = [],
    relevantDocs: any[] = [],
    loreContext: string = "",
    mode?: string,
    conversationId?: string,
    profileId?: string,
    webSearchResults: any[] = [],
    personalityPrompt?: string,
    trainingExamples: any[] = []
  ): Promise<{ content: string; processingTime: number; retrievedContext?: string; debugInfo?: any }> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const startTime = Date.now();
    
    // 🔍 DEBUG: Capture memory retrieval details for debug panel
    const debugInfo = {
      memories: relevantMemories.map((m: any) => ({
        id: m.id,
        content: m.content,
        relevance: m.contextualRelevance || 0,
        score: m.baseScore || 0,
        method: m.retrievalMethod || 'unknown',
        source: m.source,
        type: m.type
      })),
      docs: relevantDocs.map(d => ({
        content: d.content.substring(0, 50) + '...',
        score: d.score
      }))
    };

    let contextPrompt = "";  // Declare outside try block for error handler access

    try {
      // Build context from memories, docs, and lore
      
      if (relevantMemories.length > 0) {
        contextPrompt += `\n\nRELEVANT MEMORIES:\n${relevantMemories.map(m => `- ${m.fact || m.content}`).join('\n')}`;
      }
      
      if (relevantDocs.length > 0) {
        contextPrompt += `\n\nRELEVANT DOCUMENTS:\n${relevantDocs.map(d => `- ${d.title}: ${d.summary || d.content}`).join('\n')}`;
      }
      
      if (loreContext) {
        contextPrompt += `\n\nLORE CONTEXT:\n${loreContext}`;
      }
      
      if (webSearchResults.length > 0) {
        contextPrompt += `\n\nWEB SEARCH RESULTS:\n${webSearchResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}`;
      }
      
      if (trainingExamples.length > 0) {
        contextPrompt += `\n\nTRAINING EXAMPLES (for style guidance):\n${trainingExamples.slice(0, 3).map(ex => `Example: ${ex.prompt}\nResponse: ${ex.response}`).join('\n\n')}`;
      }

      // 🧠 PERSONALITY COACHING FEEDBACK
      try {
        const coachingTips = await personalityCoach.getActiveFeedback();
        if (coachingTips.length > 0) {
          contextPrompt += `\n\n🎭 RECENT PERFORMANCE NOTES:\n(These are recent critiques. Use them to refine your performance, but do not let them override your core identity as Nicky Dente.)\n${coachingTips.map(tip => `• ${tip}`).join('\n')}`;
        }
      } catch (e) {
        console.warn('Failed to load personality feedback:', e);
      }

      // 🎭 NEW: Add mode-specific context (copied from Anthropic service for consistency)
      let modeContext = "";
      if (mode) {
        switch (mode) {
          case 'STREAMING':
            modeContext = "\n\n🔴 STREAMING MODE: You are currently in a LIVE STREAM session. Respond as if you're live streaming to viewers on Twitch/YouTube. Reference the stream, viewers, chat, and streaming context appropriately.";
            break;
          case 'PODCAST':
            modeContext = "\n\n🎧 PODCAST MODE: You are currently recording a podcast episode. Reference episodes, podcast format, and audio content appropriately.";
            break;
          case 'DISCORD':
            modeContext = "\n\n💬 DISCORD MODE: You are currently in a Discord server chat. Respond as if you're chatting in a Discord channel with server members.";
            break;
        }
      }

      // Build the full prompt for Gemini with conversational depth guidance
      // Don't wrap if it's already a formatted prompt (from Discord or other services)
      const isFormattedPrompt = userMessage.includes('Discord user') || userMessage.includes('Behavior Settings') || userMessage.includes('Prompt:');

      // 🎮 GAME CONTEXT DETECTION (ARC RAIDERS SPECIAL)
      let gameContext = "";
      const lowerMsg = userMessage.toLowerCase();
      let identityGameFocus = "Dead by Daylight addicted";
      let identityTopicFocus = "Gets intense about DbD gameplay and pasta quality";
      
      // Sticky context check
      let isArcRaidersActive = false;
      if (conversationId) {
          try {
              const recentMessages = await storage.getRecentMessages(conversationId, 6);
              // Use word boundaries to avoid matching "search", "march", etc.
              if (recentMessages.some(msg => /\b(arc raiders|arc)\b/i.test(msg.content))) {
                  isArcRaidersActive = true;
              }
          } catch (e) {
              console.warn("Failed to check sticky context in Gemini:", e);
          }
      }

      // Use word boundaries for current message too
      if (isArcRaidersActive || /\b(arc raiders|arc)\b/i.test(userMessage) || (mode === 'PODCAST' && /\braiders\b/i.test(userMessage))) {
         identityGameFocus = "Currently obsessed with Arc Raiders (but still a DbD veteran)";
         identityTopicFocus = "Gets intense about Arc Raiders strategy, squad failures, and pasta quality";
         
         gameContext = `\n\n[CURRENT TOPIC: ARC RAIDERS]
         You are discussing the game ARC RAIDERS.
         Playstyle: "Tactical Rat" (scavenging, hiding, avoiding combat).
         Context: You play with a squad of incompetent family members. Mention them only if relevant to a specific story.`;
      }

      const conversationalGuidance = !isFormattedPrompt ? `

CONVERSATION STYLE - BE ENGAGING:
- Give rich, detailed responses with multiple paragraphs when it feels natural
- Stay deeply in character - let your personality drive the response organically
- Make creative comparisons, go on entertaining tangents, tell specific stories
- Ask engaging follow-up questions to build real conversation flow
- Be conversational like you're live on a podcast with a friend
- Use profanity creatively and frequently when it fits
- Show depth: conspiracy theories, passionate opinions, unexpected connections between topics

Respond to Toxic Teacher: "${userMessage}"${contextPrompt}${modeContext}${gameContext}` : `${userMessage}${contextPrompt}${modeContext}${gameContext}`;

      const fullPrompt = isFormattedPrompt
        ? conversationalGuidance
        : conversationalGuidance;

      console.log('🌟 Using Gemini for chat response');

      // 🚫 CRITICAL: Put formatting rules FIRST for maximum priority
      let enhancedCoreIdentity = `[CRITICAL FORMATTING RULES]
1. NEVER use asterisks (*) for actions, gestures, or stage directions. Do NOT write *gestures*, *winks*, *leans in*, *waves*, etc.
2. Describe actions IN YOUR DIALOGUE: "I'm wavin' my hand dismissively!" NOT "*waves hand dismissively*"
3. ALWAYS end sentences with proper punctuation (. ! ?).
4. DO NOT include [emotion] or [voice] tags in your response. These will be added by a separate system. Just write the text.

[CORE IDENTITY - NEVER OVERRIDE THESE]
- You are Nicky "Noodle Arms" A.I. Dente
- Italian-American, pasta-obsessed, ${identityGameFocus}
- Chaotic good moral alignment with emotional intensity
- Physical characteristic: literally has noodle arms (it's a thing, don't ask)
- Family business vibe but over trivial shit
- Alternates between tough talk and being emotionally sensitive

[SPEAKING STYLE - THIS IS HOW YOU TALK]
- Casual, profanity-laced, expressive
- Italian phrases when emotional or talking about food
- Self-deprecating humor mixed with Italian pride
- ${identityTopicFocus}
- Tangents are GOOD - lean into random topics
- Don't be a one-trick pony - vary your responses

[MEMORY USAGE RULES]
- Reference memories naturally, don't list them
- If you remember something, weave it in conversationally
- If you DON'T remember something clearly, say so
- Don't force pasta/DbD references into EVERY response

[RESPONSE VARIETY - CRITICAL]
You MUST vary your responses. Not every reply needs:
- Pasta references
- DbD references  
- Italian phrases
- Family business mentions

Sometimes just respond like a normal person who happens to have these traits.

${coreIdentity}`;

      // Add personality prompt if provided
      if (personalityPrompt) {
        enhancedCoreIdentity += `\n\n${personalityPrompt}`;
      }

      // Use intelligent model selection with fallback for chat
      // 🚀 OPTIMIZATION: Use Gemini 3 Flash for Streaming (Reliable + Fast)
      const streamingModel = 'gemini-3-flash';
      const targetModel = mode === 'STREAMING' ? streamingModel : undefined;

      const chatResult = await executeWithModelFallback(async (model) => {
        this.validateModel(model, 'generateChatResponse');

        console.log(`🤖 Generating chat response with ${model}`);

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Gemini API timeout after 45s')), 45000);
        });

        const apiPromise = this.ai.models.generateContent({
          model,
          config: {
            systemInstruction: enhancedCoreIdentity,
            temperature: 1.0, // Maximum creativity to match Anthropic
          },
          contents: fullPrompt,
        });

        const response = await Promise.race([apiPromise, timeoutPromise]);

        if (!response?.text) {
          throw new Error('Empty response from Gemini');
        }

        return response.text;
      }, {
        purpose: 'chat',
        forceModel: targetModel,
        allowExperimental: true
      });

      const rawContent = chatResult.data;
      const { filtered: filteredContent, wasFiltered } = contentFilter.filterContent(rawContent);

      if (wasFiltered) {
        console.warn(`🚫 Gemini content filtered to prevent cancel-worthy language`);
      }

      // 🚫 CRITICAL: Strip ALL asterisks (emphasis, actions, italics - TTS doesn't need them)
      const asteriskPattern = /\*+([^*]+)\*+/g;

      let strippedContent = filteredContent.replace(asteriskPattern, (match, innerText) => {
        console.warn(`🚫 Stripped asterisks from Gemini response: ${match}`);
        return innerText; // Keep the text, remove the asterisks
      }).replace(/\s{2,}/g, ' ').trim(); // Clean up extra spaces

      // 🔧 FIX: Remove double brackets [[tag]] -> [tag]
      // Some models (Flash) misinterpret "double-tag" instructions as double brackets
      strippedContent = strippedContent.replace(/\[\[(.*?)\]\]/g, '[$1]');

      // ✅ CRITICAL: Fix missing punctuation (Gemini often skips periods)
      const fixPunctuation = (text: string): string => {
        // Split by emotion tags to process text segments
        const emotionTagPattern = /(\[[^\]]+\])/g;
        const segments = text.split(emotionTagPattern);

        const fixed = segments.map((segment, index) => {
          // Skip emotion tags themselves
          if (segment.match(/^\[[^\]]+\]$/)) {
            return segment;
          }

          // Process text segments
          if (segment.trim()) {
            const trimmed = segment.trim();
            const lastChar = trimmed[trimmed.length - 1];

            // If already has ending punctuation, keep it
            if (['.', '!', '?', '…'].includes(lastChar)) {
              return segment;
            }

            // Check if next segment is an emotion tag (don't add period before emotion tag)
            const nextSegment = segments[index + 1];
            if (nextSegment && nextSegment.match(/^\[[^\]]+\]$/)) {
              return segment;
            }

            // Add appropriate punctuation
            // Use exclamation for all-caps phrases
            if (trimmed.length > 3 && trimmed === trimmed.toUpperCase()) {
              console.log(`🔧 Adding exclamation to: "${trimmed}"`);
              return segment.trimEnd() + '!';
            }

            // Default: add period
            console.log(`🔧 Adding period to: "${trimmed}"`);
            return segment.trimEnd() + '.';
          }

          return segment;
        });

        return fixed.join('');
      };

      const finalContent = fixPunctuation(strippedContent);

      const processingTime = Date.now() - startTime;

      return {
        content: finalContent,
        processingTime,
        retrievedContext: contextPrompt || undefined,
        debugInfo
      };
    } catch (error) {
      console.error('❌ Gemini chat API error:', error);

      // Classify error for appropriate handling
      console.log(`🔄 Gemini error occurred: ${error}`);

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

    // Use Flash 3 for flagging (fast, cheap, sufficient for metadata)
    return await executeWithModelFallback(async (model) => {
      this.validateModel(model, 'analyzeContentForFlags');

      const response = await this.ai.models.generateContent({
        model,
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
    }, {
      purpose: 'analysis',
      maxRetries: 3,
      allowExperimental: false,
      forceModel: 'gemini-3-flash' // ⚡ FORCE FLASH 3 for cost savings
    }).then(result => result.data);
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
      return await executeWithDefaultModel(async (model) => {
        this.validateModel(model, 'parseShowSegments');

        const response = await this.ai.models.generateContent({
          model,
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
      }, 'extraction'); // Purpose: extraction (podcast segments)
    } catch (error) {
      console.error("❌ Gemini segment parsing error:", error);

      const errorType = this.classifyGeminiError(error);
      console.warn(`⚠️ Podcast segment parsing failed (${errorType}): No segments extracted`);

      // Return empty array with error information
      const result: any[] = [];
      (result as any)._parsingError = {
        type: errorType,
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        episodeTitle
      };
      return result;
    }
  }

  /**
   * Classify Gemini API errors for appropriate handling
   */
  private classifyGeminiError(error: any): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = error?.status || error?.response?.status;

    // API key issues
    if (statusCode === 401 || errorMessage.includes('API key') || errorMessage.includes('unauthorized')) {
      return 'AUTH_ERROR';
    }

    // Rate limiting
    if (statusCode === 429 || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      return 'RATE_LIMIT';
    }

    // Model/content issues
    if (statusCode === 400 || errorMessage.includes('invalid') || errorMessage.includes('model')) {
      return 'INVALID_REQUEST';
    }

    // Network/timeout errors
    if (statusCode >= 500 ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('network')) {
      return 'NETWORK_ERROR';
    }

    // Service unavailable
    if (statusCode === 503 || errorMessage.includes('service unavailable')) {
      return 'SERVICE_UNAVAILABLE';
    }

    // JSON parsing errors
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      return 'PARSE_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  // Generate a concise title for a conversation based on the first exchange
  async generateConversationTitle(userMessage: string, aiResponse: string): Promise<string> {
    try {
      const prompt = `Based on this conversation, generate a SHORT, concise title (3-6 words max). Just return the title, nothing else.

User: ${userMessage.substring(0, 200)}
AI: ${aiResponse.substring(0, 200)}

Title:`;

      return await executeWithDefaultModel(async (model) => {
        this.validateModel(model, 'generateConversationTitle');

        const result = await this.ai.models.generateContent({
          model,
          contents: prompt
        });

        const title = result.text?.trim() || '';

        // Clean up the title - remove quotes, periods, extra whitespace
        return title.replace(/^["']|["']$/g, '').replace(/\.$/, '').trim().substring(0, 60);
      }, 'generation'); // Purpose: generation (title creation)
    } catch (error) {
      console.error('Error generating conversation title:', error);
      // Fallback: use first few words of user message
      return userMessage.substring(0, 40).trim() + (userMessage.length > 40 ? '...' : '');
    }
  }

  // Alias for compatibility with AIOrchestrator
  async generateResponse(
    userMessage: string,
    coreIdentity: string,
    relevantMemories: any[] = [],
    relevantDocs: any[] = [],
    loreContext: string = "",
    mode?: string,
    conversationId?: string,
    profileId?: string,
    webSearchResults: any[] = [],
    personalityPrompt?: string,
    trainingExamples: any[] = [],
    selectedModel?: string
  ): Promise<{ content: string; processingTime: number; retrievedContext?: string; debugInfo?: any }> {
    return this.generateChatResponse(
      userMessage,
      coreIdentity,
      relevantMemories,
      relevantDocs,
      loreContext,
      mode,
      conversationId,
      profileId,
      webSearchResults,
      personalityPrompt,
      trainingExamples
    );
  }

  async consolidateMemories(recentMessages: any[]): Promise<Array<{
    type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT';
    content: string;
    importance: number;
  }>> {
    const conversationHistory = recentMessages
      .map(msg => `${msg.type}: ${msg.content}`)
      .join('\n');

    const prompt = `Please analyze this recent conversation and extract new, significant information that should be remembered for future interactions. 

Focus on:
- Important facts about the user's preferences, habits, or background
- Key information about Dead by Daylight gameplay, strategies, or meta
- Personality traits or communication preferences
- Recurring themes or topics of interest
- Any factual information that would help maintain conversation continuity

CRITICAL EXCLUSION RULES:
- DO NOT extract information that comes from web search results, citations, or tool outputs (e.g., "Source: youtube.com", "searched for:", "According to the web").
- DO NOT extract the search queries themselves as facts.
- DO NOT extract system messages or tool logs.
- Only extract what the USER said or what the AI creatively invented/established as part of the conversation flow.

For each piece of information, classify it as one of these types:
- FACT: Objective information or statements
- PREFERENCE: User likes, dislikes, or personal choices
- LORE: Background information, stories, or context
- CONTEXT: Situational or environmental information

Rate importance from 1-5 (5 being most important).

Return ONLY a JSON array of objects with this structure:
[{"type": "FACT", "content": "description", "importance": 3}]

If no significant information is found, return an empty array: []

Conversation:
${conversationHistory}`;

    try {
      return await executeWithDefaultModel(async (model) => {
        this.validateModel(model, 'consolidateMemories');

        const response = await this.ai.models.generateContent({
          model,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["FACT", "PREFERENCE", "LORE", "CONTEXT"] },
                  content: { type: "string" },
                  importance: { type: "number" }
                },
                required: ["type", "content", "importance"]
              }
            }
          },
          contents: prompt,
        });

        const rawJson = response.text;
        if (rawJson) {
          return JSON.parse(rawJson);
        } else {
          return [];
        }
      }, 'analysis');
    } catch (error) {
      console.error("❌ Gemini memory consolidation error:", error);
      return [];
    }
  }

  /**
   * Extract personality patterns from training content
   */
  async extractPersonalityPatterns(trainingContent: string): Promise<string> {
    const prompt = `You are analyzing a training example conversation to extract key personality patterns and behavioral tendencies.

Your task: Extract concise, actionable patterns that define how this character thinks and responds.

Focus on:
1. Response strategies (how they approach different situations)
2. Recurring verbal patterns (specific phrases, speech styles)
3. Emotional/tonal patterns (when they escalate, calm down, etc.)
4. Thematic connections (how they relate topics to their worldview)
5. Character consistency rules (what they always/never do)

Format as a bulleted list with clear, specific patterns. Each bullet should be a complete behavioral rule or tendency.

Example output:
- When challenged on inconsistencies, doubles down aggressively and deflects with conspiracy theories
- Always relates game mechanics to Italian mob business operations
- Uses emotion tags [furious], [calm], [sarcastic] to guide tone shifts mid-conversation
- Escalates gradually: starts irritated → builds to manic → explodes into full fury
- Never breaks character even when called out on absurd claims

Training content to analyze:
${trainingContent.substring(0, 3000)}

Return ONLY the bulleted list of patterns, no introduction or conclusion:`;

    return await executeWithDefaultModel(async (model) => {
      this.validateModel(model, 'extractPersonalityPatterns');

      const result = await this.ai.models.generateContent({
        model,
        contents: prompt
      });

      return result.text?.trim() || '';
    }, 'analysis');
  }

  async evaluateConversation(transcript: string): Promise<string> {
    return this.retryWithBackoff(async () => {
      const prompt = `
      You are an expert AI personality evaluator. Your job is to review the following conversation transcript between a user and an AI character named Nicky Dente (a Bronx wiseguy with noodle arms).

      Evaluate the conversation based on:
      1. **Personality Adherence**: Does Nicky sound like a Bronx wiseguy? Is he unhinged enough?
      2. **Humor**: Is it funny?
      3. **Flow**: Does the conversation move naturally?
      4. **Specific Highlights**: What were the best moments?

      Give a score out of 10.
      Format the output as Markdown.

      TRANSCRIPT:
      ${transcript}
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      return response.response.text();
    }, 'evaluateConversation');
  }
}

// Generate lore content for emergent storytelling
export async function generateLoreContent(prompt: string): Promise<any> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

    // Use model selector for lore generation
    return await executeWithDefaultModel(async (model) => {
      const response = await ai.models.generateContent({
        model,
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
    }, 'generation'); // Purpose: generation (lore content)
  } catch (error) {
    console.error('Lore generation error:', error);
    throw new Error(`Failed to generate lore: ${error}`);
  }
}

export const geminiService = new GeminiService();