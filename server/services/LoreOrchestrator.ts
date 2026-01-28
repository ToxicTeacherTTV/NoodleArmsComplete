import { storage } from '../storage.js';
import { LoreEngine } from './loreEngine.js';
import { MemoryAnalyzer } from './memoryAnalyzer.js';
import { IntelligenceEngine } from './intelligenceEngine.js';
import { geminiService } from './gemini.js';
import ChaosEngine from './chaosEngine.js';
import {
  loreCharacters,
  loreLocations,
  loreEvents,
  memoryEntries,
  type MemoryEntry,
  type LoreCharacter,
  type LoreLocation,
  type LoreEvent
} from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

/**
 * 🏛️ LORE ORCHESTRATOR
 * 
 * The single source of truth for Nicky's world-building.
 * Consolidates fact extraction, entity management, and lore consistency.
 */

export interface LoreProcessingResult {
  newFacts: number;
  updatedEntities: number;
  conflictsDetected: number;
  summary: string;
}

export class LoreOrchestrator {
  private static instance: LoreOrchestrator;
  private intelligence: IntelligenceEngine;

  private constructor() {
    this.intelligence = new IntelligenceEngine();
  }

  public static getInstance(): LoreOrchestrator {
    if (!LoreOrchestrator.instance) {
      LoreOrchestrator.instance = new LoreOrchestrator();
    }
    return LoreOrchestrator.instance;
  }

  /**
   * 📖 DETECT USER STORY
   * Heuristic detection for user-told stories in messages
   */
  private isUserStory(content: string): boolean {
    // Length check (users typically more concise than Nicky)
    if (content.length < 150) return false;

    // Narrative indicators (past tense, storytelling phrases)
    const storyIndicators = [
      /\b(yesterday|last (week|month|year|night|time))\b/i,
      /\b(I remember|let me tell you|this one time|back when|so I was)\b/i,
      /\b(I went|I saw|I did|I played|I met|I found)\b/i,
    ];

    const hasIndicators = storyIndicators.some(pattern => pattern.test(content));

    // Must have multiple sentences
    const sentenceCount = (content.match(/[.!?]+/g) || []).length;

    // Check for past tense verb density
    const pastTenseVerbs = (content.match(/\b(happened|told|asked|said|went|was|were|did|had|got|came|left|found|saw)\b/gi) || []).length;
    const hasPastTense = pastTenseVerbs >= 2;

    return hasIndicators && sentenceCount >= 2 && hasPastTense;
  }

  /**
   * 📖 DETECT NICKY'S STORY
   * Heuristic detection for stories Nicky tells in his responses
   */
  private isNickyStory(content: string): boolean {
    // Strip emotion tags first to analyze raw narrative
    const stripped = content.replace(/\[(yelling|screaming|muttering|whispering|shouting|ranting|huffing|panting|slapping|sniffing|dramatic pause|strong bronx wiseguy accent|sound of [^\]]+)\]/gi, '');

    // Nicky is verbose - stories are typically 300+ chars
    if (stripped.length < 300) return false;

    // Nicky's storytelling indicators
    const nickyStoryIndicators = [
      /\b(back in|remember when|one time|there was this|I told you about|let me tell ya|so there I was)\b/i,
      /\b(Uncle Vinny|my cousin|my mother|the old neighborhood|Newark|Brooklyn|Bronx)\b/i, // Italian-American references
      /\b(1987|1992|'87|'92|the 80s|the 90s)\b/i, // Specific years/decades common in stories
    ];

    const hasIndicators = nickyStoryIndicators.some(pattern => pattern.test(content));

    // Check for past tense density (Nicky's stories are narrative heavy)
    const pastTenseVerbs = (stripped.match(/\b(happened|told|asked|said|went|was|were|did|had|got|came|left|found|saw|ran|caught|tried|looked|walked|grabbed)\b/gi) || []).length;
    const hasPastTense = pastTenseVerbs >= 4; // Higher threshold for Nicky's verbose style

    // Multiple sentences check
    const sentenceCount = (stripped.match(/[.!?]+/g) || []).length;
    const hasMultipleSentences = sentenceCount >= 3;

    // Check for narrative structure markers
    const hasNarrativeStructure = /\b(so then|and then|but then|after that|next thing|suddenly)\b/i.test(content);

    return hasIndicators && hasPastTense && (hasMultipleSentences || hasNarrativeStructure);
  }

  /**
   * 📥 PROCESS NEW CONTENT
   * Extracts facts and entities from raw text and integrates them into the lore.
   */
  async processNewContent(
    content: string,
    profileId: string,
    source: string,
    type: 'CONVERSATION' | 'DOCUMENT' | 'WEB' = 'CONVERSATION',
    conversationId?: string,
    options?: {
      allowWrites?: boolean;
      speaker?: 'user' | 'nicky';
      speakerName?: string;
      speakerId?: string;
    }
  ): Promise<LoreProcessingResult> {
    if (options && options.allowWrites === false) {
      console.log('🔒 Private mode: Skipping lore processing (safety catch)');
      return { newFacts: 0, updatedEntities: 0, conflictsDetected: 0, summary: 'Skipped due to private mode' };
    }

    console.log(`🏛️ LoreOrchestrator: Processing new ${type} content from ${source}`);

    // 0. Check for Podcast Redundancy
    if (conversationId) {
      const conversation = await storage.getConversation(conversationId);
      if (conversation?.contentType === 'PODCAST' || conversation?.podcastEpisodeId) {
        console.log(`🎙️ LoreOrchestrator: Content is from a Podcast. Checking for existing facts...`);
        // If it's a podcast, we might want to skip or merge.
        // For now, we'll let the vector deduplicator handle it in storage.addMemoryEntry,
        // but we'll tag it correctly.
      }
    }

    // 0.5. Check if this is a USER STORY (NEW!)
    if (options?.speaker === 'user' && this.isUserStory(content)) {
      console.log(`📖 Detected user story from ${options.speakerName || 'User'}`);

      try {
        // Store complete user story
        const storyEntry = await storage.addMemoryEntry({
          profileId,
          type: 'STORY',
          content,
          importance: 60, // User stories are important
          source: 'user_story',
          sourceId: conversationId || source,
          confidence: 100, // User stories are always true
          lane: 'CANON',
          truthDomain: 'GENERAL',
          keywords: content.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 10),
          metadata: {
            toldBy: options.speakerName || 'User',
            toldByUserId: options.speakerId,
            context: conversationId
          }
        });

        if (storyEntry?.id) {
          console.log(`✅ Stored user story: ${content.substring(0, 80)}...`);

          // Extract atomic facts FROM the story
          const { aiOrchestrator } = await import('./aiOrchestrator.js');
          const { facts } = await aiOrchestrator.extractAtomicFactsFromStory(
            content,
            `Story told by ${options.speakerName || 'User'}`,
            'gemini-3-flash-preview'
          );

          console.log(`⚛️ Extracted ${facts.length} atomic facts from user story`);

          // Store atomic facts linked to parent story
          let factsStored = 0;
          for (const fact of facts) {
            try {
              await storage.addMemoryEntry({
                profileId,
                type: 'ATOMIC',
                content: fact.content,
                importance: Math.min(fact.importance || 50, 100),
                source: 'user_story',
                sourceId: conversationId || source,
                confidence: 100,
                isAtomicFact: true,
                parentFactId: storyEntry.id, // Link to parent
                lane: 'CANON',
                truthDomain: 'GENERAL',
                keywords: fact.keywords || [],
                storyContext: fact.storyContext
              });
              factsStored++;
            } catch (error) {
              console.warn(`⚠️ Failed to store atomic fact from user story:`, error);
            }
          }

          // Still do entity extraction from user story
          const analysis = await MemoryAnalyzer.analyzeMemoryBatch([{ content, type }], profileId);
          let updatedEntities = 0;
          for (const char of (analysis.characters || [])) {
            await this.integrateCharacter(char, profileId);
            updatedEntities++;
          }
          for (const loc of (analysis.locations || [])) {
            await this.integrateLocation(loc, profileId);
            updatedEntities++;
          }

          return {
            newFacts: factsStored,
            updatedEntities,
            conflictsDetected: 0,
            summary: `Stored user story from ${options.speakerName || 'User'} with ${factsStored} facts`
          };
        }
      } catch (error) {
        console.error(`❌ Failed to process user story:`, error);
        // Fall through to normal fact extraction if story processing fails
      }
    }

    // 0.6. Check if this is a NICKY STORY (Phase 2!)
    if (options?.speaker === 'nicky' && this.isNickyStory(content)) {
      console.log(`📖 Detected Nicky story (${content.length} chars)`);

      try {
        // Determine lane based on sauce meter
        const chaos = ChaosEngine.getInstance();
        const state = await chaos.getCurrentState();
        const sauceLevel = state.sauceMeter;
        const lane = sauceLevel > 70 ? 'RUMOR' : 'CANON'; // High heat = performative bullshit

        console.log(`🌶️ Sauce meter: ${sauceLevel}/100 → Lane: ${lane}`);

        // Store complete Nicky story
        const storyEntry = await storage.addMemoryEntry({
          profileId,
          type: 'STORY',
          content,
          importance: 50, // Nicky's stories are moderately important
          source: 'nicky_story',
          sourceId: conversationId || source,
          confidence: lane === 'CANON' ? 85 : 60, // Lower confidence for rumors
          lane,
          truthDomain: 'GENERAL',
          keywords: content.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 10),
          metadata: {
            toldBy: 'Nicky',
            sauceMeter: sauceLevel,
            context: conversationId
          }
        });

        if (storyEntry?.id) {
          console.log(`✅ Stored Nicky story in ${lane} lane: ${content.substring(0, 80)}...`);

          // Extract atomic facts FROM the story
          const { aiOrchestrator } = await import('./aiOrchestrator.js');
          const { facts } = await aiOrchestrator.extractAtomicFactsFromStory(
            content,
            'Story told by Nicky',
            'gemini-3-flash-preview'
          );

          console.log(`⚛️ Extracted ${facts.length} atomic facts from Nicky's story`);

          // Store atomic facts linked to parent story
          let factsStored = 0;
          for (const fact of facts) {
            try {
              await storage.addMemoryEntry({
                profileId,
                type: 'ATOMIC',
                content: fact.content,
                importance: Math.min(fact.importance || 50, 100),
                source: 'nicky_story',
                sourceId: conversationId || source,
                confidence: lane === 'CANON' ? 85 : 60, // Match parent confidence
                isAtomicFact: true,
                parentFactId: storyEntry.id, // Link to parent
                lane,
                truthDomain: 'GENERAL',
                keywords: fact.keywords || [],
                storyContext: fact.storyContext
              });
              factsStored++;
            } catch (error) {
              console.warn(`⚠️ Failed to store atomic fact from Nicky's story:`, error);
            }
          }

          // Still do entity extraction from Nicky's story
          const analysis = await MemoryAnalyzer.analyzeMemoryBatch([{ content, type }], profileId);
          let updatedEntities = 0;
          for (const char of (analysis.characters || [])) {
            await this.integrateCharacter(char, profileId);
            updatedEntities++;
          }
          for (const loc of (analysis.locations || [])) {
            await this.integrateLocation(loc, profileId);
            updatedEntities++;
          }

          return {
            newFacts: factsStored,
            updatedEntities,
            conflictsDetected: 0,
            summary: `Stored Nicky story (${lane}) with ${factsStored} facts`
          };
        }
      } catch (error) {
        console.error(`❌ Failed to process Nicky story:`, error);
        // Fall through to normal fact extraction if story processing fails
      }
    }

    // 1. Extract Atomic Facts (existing flow - only reached if not a story)
    const { fact, importance } = await geminiService.distillTextToFact(content);

    // 1b. Save Fact to Memory
    if (fact && fact.length > 10) {
      let podcastEpisodeId = undefined;
      if (conversationId) {
        const conversation = await storage.getConversation(conversationId);
        podcastEpisodeId = conversation?.podcastEpisodeId;
      }

      await storage.addMemoryEntry({
        profileId,
        type: 'FACT',
        content: fact,
        importance: importance || 30,
        source: podcastEpisodeId ? 'podcast_episode' : (type === 'CONVERSATION' ? 'conversation' : 'document'),
        sourceId: podcastEpisodeId || conversationId || source,
        confidence: 80,
        supportCount: 1,
        keywords: fact.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 5)
      });
      console.log(`🏛️ LoreOrchestrator: Saved distilled fact: ${fact} (Importance: ${importance}, Source: ${podcastEpisodeId ? 'Podcast' : 'Conversation'})`);
    }

    // 2. Analyze for Entities & Relationships
    const analysis = await MemoryAnalyzer.analyzeMemoryBatch([{ content, type }], profileId);

    // 3. Integrate Entities (with safe array access in case AI returns malformed response)
    let updatedEntities = 0;
    for (const char of (analysis.characters || [])) {
      await this.integrateCharacter(char, profileId);
      updatedEntities++;
    }

    for (const loc of (analysis.locations || [])) {
      await this.integrateLocation(loc, profileId);
      updatedEntities++;
    }

    // 4. Check for Contradictions
    // ⚡ OPTIMIZATION: Disabled automatic full analysis on every message to prevent perf issues
    // const contradictions = await this.intelligence.runFullIntelligenceAnalysis(storage.db, profileId);
    const contradictions = { factClusters: [] };

    return {
      newFacts: 1,
      updatedEntities,
      conflictsDetected: contradictions.factClusters.length,
      summary: `Processed ${type} from ${source}. Integrated ${updatedEntities} entities.`
    };
  }

  /**
   * 👤 INTEGRATE CHARACTER
   * Ensures characters are updated or created without duplication.
   */
  private async integrateCharacter(char: any, profileId: string) {
    const existing = await storage.db.select().from(loreCharacters)
      .where(and(
        eq(loreCharacters.profileId, profileId),
        eq(loreCharacters.name, char.name)
      )).limit(1);

    if (existing.length > 0) {
      // Update existing character with new context
      await storage.db.update(loreCharacters)
        .set({
          personality: `${existing[0].personality}\n${char.description}`,
          lastActivity: new Date().toISOString(),
          updatedAt: new Date()
        })
        .where(eq(loreCharacters.id, existing[0].id));
    } else {
      // Create new character
      await storage.db.insert(loreCharacters).values({
        profileId,
        name: char.name,
        category: char.category || 'other',
        relationship: char.relationship || 'Acquaintance',
        personality: char.description || 'Unknown personality',
        backstory: char.backstory || 'No backstory yet',
        lastActivity: 'Just appeared in conversation',
        activityFrequency: char.significance || 3,
        updatedAt: new Date()
      });
    }

    // Also integrate into the Entity Disambiguation System for UI visibility
    try {
      const { people } = await import('../../shared/schema.js');
      const existingPerson = await storage.db.select().from(people)
        .where(and(
          eq(people.profileId, profileId),
          eq(people.canonicalName, char.name)
        )).limit(1);

      if (!existingPerson.length) {
        await storage.db.insert(people).values({
          profileId,
          canonicalName: char.name,
          description: char.description,
          relationship: char.relationship || 'Acquaintance',
          aliases: []
        });
      }
    } catch (e) {
      console.warn("Failed to sync with Entity Disambiguation System:", e);
    }
  }

  /**
   * 📍 INTEGRATE LOCATION
   */
  private async integrateLocation(loc: any, profileId: string) {
    const existing = await storage.db.select().from(loreLocations)
      .where(and(
        eq(loreLocations.profileId, profileId),
        eq(loreLocations.name, loc.name)
      )).limit(1);

    if (existing.length > 0) {
      await storage.db.update(loreLocations)
        .set({
          description: `${existing[0].description}\n${loc.description}`,
          updatedAt: new Date()
        })
        .where(eq(loreLocations.id, existing[0].id));
    } else {
      await storage.db.insert(loreLocations).values({
        profileId,
        name: loc.name,
        category: loc.category || 'other',
        description: loc.description || 'Unknown location',
        significance: loc.significance?.toString() || '3',
        updatedAt: new Date()
      });
    }

    // Sync with places table
    try {
      const { places } = await import('../../shared/schema.js');
      const existingPlace = await storage.db.select().from(places)
        .where(and(
          eq(places.profileId, profileId),
          eq(places.canonicalName, loc.name)
        )).limit(1);

      if (!existingPlace.length) {
        await storage.db.insert(places).values({
          profileId,
          canonicalName: loc.name,
          description: loc.description,
          locationType: loc.category || 'other'
        });
      }
    } catch (e) {
      console.warn("Failed to sync with Places system:", e);
    }
  }

  /**
   * 🎭 INTEGRATE EVENT
   */
  private async integrateEvent(event: any, profileId: string) {
    const existing = await storage.db.select().from(loreEvents)
      .where(and(
        eq(loreEvents.profileId, profileId),
        eq(loreEvents.title, event.name)
      )).limit(1);

    if (!existing.length) {
      await storage.db.insert(loreEvents).values({
        profileId,
        title: event.name,
        description: event.description || 'No description',
        category: event.category || 'gaming',
        status: 'resolved',
        priority: event.significance || 3,
        updatedAt: new Date()
      });
    }

    // Sync with events table
    try {
      const { events } = await import('../../shared/schema.js');
      const existingEvent = await storage.db.select().from(events)
        .where(and(
          eq(events.profileId, profileId),
          eq(events.canonicalName, event.name)
        )).limit(1);

      if (!existingEvent.length) {
        await storage.db.insert(events).values({
          profileId,
          canonicalName: event.name,
          description: event.description,
          isCanonical: true
        });
      }
    } catch (e) {
      console.warn("Failed to sync with Events system:", e);
    }
  }

  /**
   * 🕵️ HALLUCINATION CHECK
   * Checks if a statement made by Nicky should be promoted to "Lore".
   */
  async checkHallucination(content: string, profileId: string, options?: { allowWrites?: boolean }): Promise<void> {
    if (options && options.allowWrites === false) {
      console.log('🔒 Private mode: Skipping hallucination check (safety catch)');
      return;
    }

    const chaos = ChaosEngine.getInstance();
    const state = await chaos.getCurrentState();
    const sauceLevel = state.sauceMeter;

    const prompt = `
      You are the Lore Auditor for Nicky "Noodle Arms" Dente.
      Nicky just said this: "${content}"
      
      Nicky's current "Sauce Meter" (Heated Level) is: ${sauceLevel}/100.
      
      Is there a NEW fact, character, or event in this statement that isn't already established lore?
      If it's a funny or interesting "hallucination" (something he made up), should it become permanent lore?
      
      LORE PROMOTION RULES:
      1. If Sauce Meter is HIGH (>70), be MORE AGGRESSIVE in promoting wild, unhinged conspiracies or weird details.
      2. It must add flavor to his Italian-American background.
      3. It involves a specific name, place, or weird detail (e.g., "The 1998 Sauce Incident").
      4. It's not a generic insult.
      
      Return JSON:
      {
        "shouldPromote": boolean,
        "entityType": "character|location|event|fact",
        "name": "Name of entity",
        "description": "Brief description for the lore book",
        "reasoning": "Why this is good lore"
      }
    `;

    let result;
    try {
      result = await geminiService.generateResponse(prompt, "You are a Lore Auditor.", [], [], "", 'SIMPLE');

      const cleanJson = (text: string) => {
        return text.replace(/```json\n?|\n?```/g, '').replace(/```/g, '').trim();
      };

      const analysis = JSON.parse(cleanJson(result.content));

      if (analysis.shouldPromote) {
        console.log(`🏛️ LoreOrchestrator: Promoting hallucination to lore: ${analysis.name}`);
        if (analysis.entityType === 'character') await this.integrateCharacter(analysis, profileId);
        if (analysis.entityType === 'location') await this.integrateLocation(analysis, profileId);
        if (analysis.entityType === 'event') await this.integrateEvent(analysis, profileId);
      }
    } catch (e) {
      console.warn("Lore promotion check failed. Raw content:", result?.content);
      console.warn("Error:", e);
    }
  }


  /**
   * 🎲 GENERATE BACKGROUND LORE
   * Triggers the LoreEngine to evolve the world while Nicky is "offline".
   */
  async evolveWorld(profileId: string): Promise<void> {
    const profile = await storage.getProfile(profileId);
    if (!profile) return;

    const events = await storage.db.select().from(loreEvents).where(eq(loreEvents.profileId, profileId));
    const characters = await storage.db.select().from(loreCharacters).where(eq(loreCharacters.profileId, profileId));

    await LoreEngine.generateBackgroundLore({
      profileId,
      existingEvents: events as LoreEvent[],
      existingCharacters: characters as LoreCharacter[],
      lastConversationTime: new Date(), // Should be fetched from profile
      timeSinceLastLore: 24 // Force generation for now
    });
  }
}

export const loreOrchestrator = LoreOrchestrator.getInstance();
