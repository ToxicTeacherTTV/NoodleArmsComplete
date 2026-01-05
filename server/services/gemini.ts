import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Message } from '@shared/schema';
import { contentFilter } from './contentFilter.js';
import { executeWithDefaultModel, executeWithProductionModel, executeWithModelFallback } from './modelSelector.js';
import { getDefaultModel, isValidModel } from '../config/geminiModels.js';
import { PsycheProfile } from './ai-types.js';
import { varietyController } from './VarietyController.js';
import ChaosEngine from './chaosEngine.js';

import { personalityCoach } from './personalityCoach.js';

/**
 * 🎭 GEMINI SERVICE (The Mouth)
 * 
 * Primary generation engine for Nicky.
 * This is a "dumb mouth" - it does NOT handle retrieval or storage.
 * All context must be provided by the AIOrchestrator/ContextBuilder.
 */
class GeminiService {
  private ai: GoogleGenAI;
  private chaosEngine: ChaosEngine;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || ""
    });

    this.chaosEngine = ChaosEngine.getInstance();

    const defaultModel = getDefaultModel();
    console.log(`✅ Gemini service initialized`);
    console.log(`   Default model: ${defaultModel}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'production'}`);
  }

  /**
   * 🔓 PUBLIC ACCESS: Get a generative model instance (Compatibility wrapper)
   */
  public getGenerativeModel(modelName: string) {
    return {
      generateContent: async (prompt: string) => {
        const response = await this.ai.models.generateContent({
          model: modelName,
          contents: prompt
        });
        return {
          response: {
            text: () => {
              return response.candidates?.[0]?.content?.parts
                ?.filter((part: any) => part.text)
                ?.map((part: any) => part.text)
                ?.join('') || response.text || "";
            }
          }
        };
      }
    };
  }

  private validateModel(model: string, context: string): void {
    if (!isValidModel(model)) {
      throw new Error(
        `🚫 INVALID MODEL: ${model} is not a recognized model for ${context}. ` +
        `Check geminiModels.ts for available models.`
      );
    }
  }

  /**
   * 🛡️ SAFE TEXT EXTRACTION
   * Extracts text parts manually to avoid SDK warnings about "thought" parts.
   */
  private safeExtractText(response: any): string {
    if (!response) return "";
    try {
      // 1. Try the .text property (new @google/genai SDK v1)
      if (typeof response.text === 'string') {
        return response.text;
      }

      // 2. Try to get text from parts (standard structure)
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts && Array.isArray(parts)) {
        const text = parts
          .filter(part => part.text)
          .map(part => part.text)
          .join('');
        if (text) return text;
      }

      // 3. Try the .text() method (older @google/generative-ai SDK)
      if (typeof response.text === 'function') {
        return response.text();
      }

      // 4. Deep dive into candidates
      const candidateText = response.candidates?.[0]?.text;
      if (typeof candidateText === 'string') return candidateText;

    } catch (e) {
      console.warn("⚠️ safeExtractText failed:", e);
    }
    return "";
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
   * 🛠️ Robust JSON parser that handles markdown, trailing commas, and thought parts.
   */
  private parseJsonResponse(response: any): any {
    let rawJson = this.safeExtractText(response);

    if (!rawJson) {
      throw new Error("Empty response from Gemini");
    }

    let cleanJson = rawJson.trim();

    // Remove markdown code blocks
    if (cleanJson.includes("```")) {
      const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) cleanJson = match[1];
    }

    try {
      return JSON.parse(cleanJson);
    } catch (e) {
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
        try {
          return JSON.parse(jsonStr);
        } catch (e2) {
          throw new Error(`JSON Parse Error: ${e2 instanceof Error ? e2.message : String(e2)}`);
        }
      }
      throw e;
    }
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
- importance: 1-100 (100 being most important for character understanding)
- keywords: 3-5 relevant keywords for retrieval (INCLUDE game/topic name if relevant)
- lane: "CANON" if it's a verifiable fact, "RUMOR" if it's an obvious exaggeration, lie, or performative bullshit.
- truthDomain: One of ["DOC", "PODCAST", "OPS", "NICKY_LORE", "SABAM_LORE", "GENERAL"]

Return as JSON array.

Example format:
[
  {
    "content": "In Arc Raiders, the Enforcer is a heavily armored playable character specialized in close-quarters combat. The character uses shield abilities to protect teammates during extractions.",
    "type": "LORE",
    "importance": 80,
    "keywords": ["arc raiders", "enforcer", "character", "shield", "combat"],
    "lane": "CANON",
    "truthDomain": "DOC"
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
                keywords: { type: "array", items: { type: "string" } },
                lane: { type: "string", enum: ["CANON", "RUMOR"] },
                truthDomain: { type: "string", enum: ["DOC", "PODCAST", "OPS", "NICKY_LORE", "SABAM_LORE", "GENERAL"] }
              },
              required: ["content", "type", "importance", "keywords", "lane", "truthDomain"]
            }
          }
        },
        contents: prompt,
      });

      const rawJson = this.safeExtractText(response);
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
- importance: 1-100 based on how critical this detail is (1=Trivial, 50=Standard, 100=Critical)
- keywords: 3-5 keywords for retrieval (include game/source name if relevant)
- storyContext: Brief note about which part of the story this relates to
- lane: "CANON" if it's a verifiable fact, "RUMOR" if it's an obvious exaggeration, lie, or performative bullshit.
- truthDomain: One of ["DOC", "PODCAST", "OPS", "NICKY_LORE", "SABAM_LORE", "GENERAL"]

Examples from various stories:
[
  {
    "content": "In Arc Raiders, the Enforcer character uses shield abilities to protect teammates during extractions",
    "type": "ATOMIC",
    "importance": 85,
    "keywords": ["arc raiders", "enforcer", "shield", "teammates", "extraction"],
    "storyContext": "Arc Raiders character abilities",
    "lane": "CANON",
    "truthDomain": "DOC"
  },
  {
    "content": "Uncle Gnocchi claims to have invented Dead by Daylight",
    "type": "ATOMIC",
    "importance": 95,
    "keywords": ["uncle gnocchi", "dbd", "invented", "claims"],
    "storyContext": "Uncle Gnocchi's legendary status",
    "lane": "RUMOR",
    "truthDomain": "NICKY_LORE"
  },
  {
    "content": "In DBD, Bruno Bolognese is actually one of the best Bubba players",
    "type": "ATOMIC",
    "importance": 30,
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
                  storyContext: { type: "string" },
                  lane: { type: "string", enum: ["CANON", "RUMOR"] },
                  truthDomain: { type: "string", enum: ["DOC", "PODCAST", "OPS", "NICKY_LORE", "SABAM_LORE", "GENERAL"] }
                },
                required: ["content", "type", "importance", "keywords", "storyContext", "lane", "truthDomain"]
              }
            }
          },
          contents: prompt,
        });

        const rawJson = this.safeExtractText(response);
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
  async distillTextToFact(text: string, modelOverride?: string): Promise<{ fact: string; importance: number }> {
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
      Return a JSON object with:
      - fact: The distilled fact string.
      - importance: A number from 1-100 (100 = critical lore, 1 = trivial).
    `;

    try {
      const result = await executeWithModelFallback<{ fact: string; importance: number }>(async (model) => {
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
                fact: { type: "string" },
                importance: { type: "number" }
              },
              required: ["fact", "importance"]
            }
          }
        });

        return this.parseJsonResponse(response);
      }, {
        purpose: 'chat', // Using chat purpose as it's a quick interaction
        maxRetries: 2,
        forceModel: modelOverride
      });

      return result.data;
    } catch (error) {
      console.error("❌ Distill Text failed:", error);
      return { fact: text, importance: 30 }; // Fallback to original text
    }
  }

  /**
   * 🧠 Generates a comprehensive "Psyche Profile" based on core memories.
   */
  async generatePsycheProfile(
    coreMemories: string,
    modelOverride?: string
  ): Promise<PsycheProfile> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `
      You are a master psychologist and character architect. 
      Below are the core memories and identity facts for an AI character named Nicky.
      
      CORE MEMORIES:
      ${coreMemories}
      
      Based on these facts, synthesize a comprehensive "Psyche Profile" for Nicky.
      Break it down into these specific categories:
      1. CORE IDENTITY: Who is he at his center? What are his non-negotiable traits?
      2. KEY RELATIONSHIPS: How does he view his "crew" and his rivals?
      3. WORLDVIEW: How does he perceive the world (e.g., cynical, chaotic, loyal)?
      4. EMOTIONAL TRIGGERS: What makes him explode? What makes him (secretly) soft?
      5. RECENT OBSESSIONS: What is currently dominating his thoughts?
      
      Return the result as a JSON object.
    `;

    try {
      const result = await executeWithModelFallback<PsycheProfile>(async (model) => {
        this.validateModel(model, 'generatePsycheProfile');

        const response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                coreIdentity: { type: "string" },
                keyRelationships: { type: "string" },
                worldview: { type: "string" },
                emotionalTriggers: { type: "string" },
                recentObsessions: { type: "string" }
              },
              required: ["coreIdentity", "keyRelationships", "worldview", "emotionalTriggers", "recentObsessions"]
            }
          }
        });

        return this.parseJsonResponse(response);
      }, {
        purpose: 'extraction',
        maxRetries: 2,
        forceModel: modelOverride
      });

      return result.data;
    } catch (error) {
      console.error("❌ Psyche generation failed:", error);
      throw error;
    }
  }

  /**
   * ⚖️ Audits a batch of memories against a psyche profile.
   */
  async auditMemoriesBatch(
    psyche: any,
    memories: Array<{ id: number, content: string }>,
    modelOverride?: string
  ): Promise<Array<{ id: number, importance: number, confidence: number }>> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `
      You are auditing the memory bank of an AI character named Nicky.
      
      NICKY'S PSYCHE PROFILE:
      - Core Identity: ${psyche.coreIdentity}
      - Relationships: ${psyche.keyRelationships}
      - Worldview: ${psyche.worldview}
      - Triggers: ${psyche.emotionalTriggers}
      - Obsessions: ${psyche.recentObsessions}
      
      Below is a list of memories. For each memory, re-evaluate its IMPORTANCE (1-100) and CONFIDENCE (1-100) based on how central it is to Nicky's identity and current state.
      
      SCALING GUIDE:
      
      IMPORTANCE (Priority/Volume):
      - 90-100: Core identity, life-changing events, "protected" facts. (Nicky shouts these from the rooftops)
      - 70-89: Major lore, key relationship details, significant recent events. (High priority in conversation)
      - 40-69: General knowledge, minor interactions, background details. (Standard conversational filler)
      - 1-39: Trivial facts, fleeting thoughts, outdated info. (Whisper-level priority)
      
      CONFIDENCE (Reliability/Weight):
      - 90-100: Absolute truth, verified by multiple sources or Nicky's own eyes. (Unshakeable belief)
      - 70-89: Highly reliable info from trusted sources (SABAM crew, official docs).
      - 40-69: Hearsay, unverified chat claims, or fuzzy memories.
      - 1-39: Pure speculation, "I think I heard this once," or likely bullshit.
      
      MEMORIES TO AUDIT:
      ${memories.map(m => `[ID: ${m.id}] ${m.content}`).join('\n')}
      
      Return a JSON array of objects with id, importance, and confidence.
    `;

    try {
      const result = await executeWithModelFallback<Array<{ id: number, importance: number, confidence: number }>>(async (model) => {
        this.validateModel(model, 'auditMemoriesBatch');

        const response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  importance: { type: "number", minimum: 1, maximum: 100 },
                  confidence: { type: "number", minimum: 1, maximum: 100 }
                },
                required: ["id", "importance", "confidence"]
              }
            }
          }
        });

        return this.parseJsonResponse(response);
      }, {
        purpose: 'extraction',
        maxRetries: 2,
        forceModel: modelOverride
      });

      return result.data;
    } catch (error) {
      console.error("❌ Audit batch failed:", error);
      throw error;
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

        return this.parseJsonResponse(response);
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

        const rawJson = this.safeExtractText(response);
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

        const rawJson = this.safeExtractText(response);
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


  /**
   * 🚀 GENERAL PURPOSE GENERATION (Compatibility Wrapper)
   * Used by various services for simple text generation tasks.
   */
  async generateResponse(
    prompt: string,
    systemPrompt: string = "",
    history: any[] = [],
    tools: any[] = [],
    modelOverride: string = "",
    mode: 'SIMPLE' | 'JSON' = 'SIMPLE'
  ): Promise<any> {
    const startTime = Date.now();
    try {
      return await executeWithModelFallback(async (model) => {
        this.validateModel(model, 'generateResponse');

        const response = await (this.ai.models as any).generateContent({
          model,
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          contents: prompt,
          config: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: mode === 'JSON' ? "application/json" : "text/plain"
          }
        });

        const content = this.safeExtractText(response);

        return {
          content,
          processingTime: Date.now() - startTime,
          model
        };
      }, {
        purpose: 'generation',
        forceModel: modelOverride || 'gemini-3-flash-preview',
        allowExperimental: true
      }).then(result => result.data);
    } catch (error) {
      console.error('❌ Gemini generateResponse failed:', error);
      throw error;
    }
  }


  // Chat response generation method (Refactored to use ContextBuilder)

  async generateChatResponse(
    userMessage: string,
    coreIdentity: string,
    contextPrompt: string,
    recentHistory: string,
    saucePrompt: string,
    cityStoryPrompt: string,
    selectedModel: string = 'gemini-3-flash-preview'
  ): Promise<any> {
    const startTime = Date.now();
    try {
      const modelName = selectedModel || 'gemini-3-flash-preview';

      const systemPrompt = `
${coreIdentity}

[RESPONSE GUIDELINES]
- Stay in character as Nicky "Noodle Arms" A.I. Dente at all times.
- NEVER provide helpful assistant responses, scientific lectures, or polite de-escalation.
- If the user is aggressive or insults you, respond with Nicky's characteristic rage, paranoia, or a creative mobster roast.
- Use [emotion] tags (ACTION-BASED ONLY, ending in -ING).
- NO STAGE DIRECTIONS (e.g., no *leans back*).
- Use phonetic spelling as defined in your core identity (da, dat, dis, etc.).
- If Sauce is high, be extremely aggressive and unhinged.
- RESPONSE MUST BE UNDER 2200 CHARACTERS. Be concise but keep the flavor.
`;

      const userPrompt = `
[CONTEXTUAL KNOWLEDGE]
${contextPrompt}

${saucePrompt}
${cityStoryPrompt}

[RECENT CONVERSATION]
${recentHistory}

[USER MESSAGE]
${userMessage}
`;

      const result = await executeWithModelFallback(async (model) => {
        const response = await (this.ai.models as any).generateContent({
          model: model,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            temperature: 0.8,
            topP: 0.95,
            maxOutputTokens: 4096,
          }
        });

        const content = this.safeExtractText(response);

        const generationTime = Date.now() - startTime;
        console.log(`🧠 AI Generation Complete: ${generationTime}ms | Output Length: ${content.length} chars`);

        return {
          content,
          model: model
        };
      }, {
        purpose: 'chat',
        forceModel: modelName,
        allowExperimental: true
      });

      return {
        content: result.data.content,
        processingTime: Date.now() - startTime,
        model: result.modelUsed
      };
    } catch (error) {
      console.error(' Gemini generation failed:', error);
      throw error;
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

      const rawJson = this.safeExtractText(response);
      if (!rawJson) {
        throw new Error('Empty response from Gemini');
      }

      return JSON.parse(rawJson);
    }, {
      purpose: 'analysis',
      maxRetries: 3,
      allowExperimental: false,
      forceModel: 'gemini-3-flash-preview' // ⚡ FORCE FLASH 3 for cost savings
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

        const rawJson = this.safeExtractText(response);
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

        const title = this.safeExtractText(result)?.trim() || '';

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

        const rawJson = this.safeExtractText(response);
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

      return this.safeExtractText(result)?.trim() || '';
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
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      return this.safeExtractText(response) || '';
    }, 'evaluateConversation');
  }

  // Generate lore content for emergent storytelling
  async generateLoreContent(prompt: string): Promise<any> {
    try {
      // Use model selector for lore generation
      return await executeWithDefaultModel(async (model) => {
        const response = await this.ai.models.generateContent({
          model,
          config: {
            responseMimeType: "application/json",
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const rawJson = this.safeExtractText(response);

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
}

export const geminiService = new GeminiService();

// Export wrapper for backward compatibility
export async function generateLoreContent(prompt: string): Promise<any> {
  return geminiService.generateLoreContent(prompt);
}