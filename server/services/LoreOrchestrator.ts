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
   * 📥 PROCESS NEW CONTENT
   * Extracts facts and entities from raw text and integrates them into the lore.
   */
  async processNewContent(
    content: string,
    profileId: string,
    source: string,
    type: 'CONVERSATION' | 'DOCUMENT' | 'WEB' = 'CONVERSATION',
    conversationId?: string
  ): Promise<LoreProcessingResult> {
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

    // 1. Extract Atomic Facts
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

    // 3. Integrate Entities
    let updatedEntities = 0;
    for (const char of analysis.characters) {
      await this.integrateCharacter(char, profileId);
      updatedEntities++;
    }

    for (const loc of analysis.locations) {
      await this.integrateLocation(loc, profileId);
      updatedEntities++;
    }

    // 4. Check for Contradictions
    const contradictions = await this.intelligence.runFullIntelligenceAnalysis(storage.db, profileId);

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
  async checkHallucination(content: string, profileId: string): Promise<void> {
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

    try {
      const result = await geminiService.generateResponse(prompt, "You are a Lore Auditor.", [], [], "", 'SIMPLE');

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
