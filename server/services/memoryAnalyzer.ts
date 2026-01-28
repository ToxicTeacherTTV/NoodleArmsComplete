import { storage } from '../storage.js';
import { 
  loreCharacters, 
  loreLocations, 
  loreHistoricalEvents, 
  loreRelationships,
  loreEvents,
  type InsertLoreCharacter,
  type InsertLoreLocation,
  type InsertLoreHistoricalEvent,
  type InsertLoreRelationship
} from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { generateLoreContent } from './gemini.js';

interface ExtractedEntity {
  type: 'character' | 'location' | 'event';
  name: string;
  description: string;
  category: string;
  significance: number;
  context: string;
  relatedEntities: string[];
}

interface ExtractedRelationship {
  entity1: string;
  entity2: string;
  relationshipType: string;
  strength: number;
  description: string;
}

interface MemoryAnalysisResult {
  characters: ExtractedEntity[];
  locations: ExtractedEntity[];
  events: ExtractedEntity[];
  relationships: ExtractedRelationship[];
}

export class MemoryAnalyzer {
  // Analyze a batch of memory entries and extract entities
  static async analyzeMemoryBatch(memoryEntries: any[], profileId: string): Promise<MemoryAnalysisResult> {
    const memoryText = memoryEntries
      .map(entry => `${entry.type}: ${entry.content}`)
      .join('\n\n');

    const analysisPrompt = `
You are analyzing memories from "Nicky 'Noodle Arms' A.I. Dente", a foul-mouthed Italian-American Dead by Daylight streamer. Extract ALL entities and relationships from these memories to build his comprehensive world.

ANALYZE THESE MEMORIES:
${memoryText}

EXTRACT:

1. CHARACTERS (people mentioned):
- Family members, friends, rivals, viewers, streamers, neighbors, etc.
- Include personality traits, relationships to Nicky
- Rate significance 1-5 (how important they are to Nicky)

2. LOCATIONS (places mentioned):
- Restaurants, neighborhoods, gaming setups, family homes, etc.
- Include what happens there, atmosphere, significance
- Rate significance 1-5 (how important to Nicky's story)

3. EVENTS (past happenings):
- Gaming moments, family events, streaming incidents, personal stories
- Include participants, outcomes, emotional impact
- Rate significance 1-5 (how memorable/important)

4. RELATIONSHIPS (connections between entities):
- Character-character relationships (friends, rivals, family)
- Character-location relationships (works at, lives at, visits)
- Event-character/location relationships (who was involved, where it happened)
- Rate strength 1-5 (how important this connection is)

RETURN ONLY VALID JSON:
{
  "characters": [
    {
      "type": "character",
      "name": "Character Name",
      "description": "Who they are, personality, role in Nicky's life",
      "category": "family|friend|rival|viewer|streamer|neighbor|other",
      "significance": 3,
      "context": "How they relate to Nicky specifically",
      "relatedEntities": ["other characters/locations they're connected to"]
    }
  ],
  "locations": [
    {
      "type": "location", 
      "name": "Location Name",
      "description": "What this place is like, atmosphere, what happens there",
      "category": "restaurant|home|gaming|neighborhood|family|streaming|other",
      "significance": 3,
      "context": "Why this place matters to Nicky",
      "relatedEntities": ["characters who go there"]
    }
  ],
  "events": [
    {
      "type": "event",
      "name": "Event Title", 
      "description": "What happened, context, outcome",
      "category": "gaming|family|streaming|personal|neighborhood|other",
      "significance": 3,
      "context": "Impact on Nicky's life/story",
      "relatedEntities": ["participants", "locations involved"]
    }
  ],
  "relationships": [
    {
      "entity1": "Entity Name 1",
      "entity2": "Entity Name 2", 
      "relationshipType": "friends|rivals|family|works_at|lives_at|happened_at|knows|dislikes",
      "strength": 3,
      "description": "Nature of the relationship/connection"
    }
  ]
}

Focus on authentic Italian-American culture and Dead by Daylight streaming context. Be thorough - extract EVERYTHING mentioned.`;

    try {
      const result = await generateLoreContent(analysisPrompt);
      return result;
    } catch (error) {
      console.error('❌ Failed to analyze memory batch:', error);
      console.warn('⚠️ Memory analysis failed - knowledge graph will be incomplete for this batch');
      
      // Return empty result with error metadata
      const result = { characters: [], locations: [], events: [], relationships: [] };
      (result as any)._analysisError = {
        type: 'MEMORY_ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        batchSize: 0, // Batch size unavailable due to error
        profileId
      };
      return result;
    }
  }

  // Process all memories for a profile and build complete knowledge graph
  static async buildKnowledgeGraph(profileId: string): Promise<void> {
    console.log(`🧠 Starting comprehensive memory analysis for profile ${profileId}`);
    
    // Get all memory entries
    const allMemories = await storage.getMemoryEntries(profileId, 10000);
    console.log(`📚 Processing ${allMemories.length} memory entries`);

    // Process in batches to avoid token limits
    const batchSize = 50;
    const allCharacters: Map<string, ExtractedEntity> = new Map();
    const allLocations: Map<string, ExtractedEntity> = new Map(); 
    const allEvents: Map<string, ExtractedEntity> = new Map();
    const allRelationships: ExtractedRelationship[] = [];

    for (let i = 0; i < allMemories.length; i += batchSize) {
      const batch = allMemories.slice(i, i + batchSize);
      console.log(`🔍 Analyzing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allMemories.length/batchSize)}`);
      
      const analysis = await this.analyzeMemoryBatch(batch, profileId);
      
      // Merge results (deduplicate by name) - with safe array access
      (analysis.characters || []).forEach(char => {
        const existing = allCharacters.get(char.name);
        if (!existing || char.significance > existing.significance) {
          allCharacters.set(char.name, char);
        }
      });

      (analysis.locations || []).forEach(loc => {
        const existing = allLocations.get(loc.name);
        if (!existing || loc.significance > existing.significance) {
          allLocations.set(loc.name, loc);
        }
      });

      (analysis.events || []).forEach(event => {
        const existing = allEvents.get(event.name);
        if (!existing || event.significance > existing.significance) {
          allEvents.set(event.name, event);
        }
      });

      allRelationships.push(...(analysis.relationships || []));
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`✨ Extracted: ${allCharacters.size} characters, ${allLocations.size} locations, ${allEvents.size} events, ${allRelationships.length} relationships`);

    // Store extracted data in database
    await this.storeKnowledgeGraph(profileId, {
      characters: Array.from(allCharacters.values()),
      locations: Array.from(allLocations.values()),
      events: Array.from(allEvents.values()),
      relationships: allRelationships
    });
  }

  // Store the extracted knowledge in the lore database tables
  private static async storeKnowledgeGraph(profileId: string, data: MemoryAnalysisResult): Promise<void> {
    console.log(`💾 Storing knowledge graph in database...`);

    // Store characters
    for (const char of data.characters) {
      const characterData: InsertLoreCharacter = {
        profileId,
        name: char.name,
        category: char.category,
        relationship: char.context,
        personality: char.description,
        backstory: `Extracted from memories: ${char.context}`,
        lastActivity: `Recently mentioned in memories`,
        activityFrequency: Math.min(5, char.significance)
      };

      await storage.db.insert(loreCharacters).values(characterData).onConflictDoNothing();

      // Sync with Entity Disambiguation System (people table)
      try {
        const { people } = await import('../../shared/schema.js');
        const { and, eq } = await import('drizzle-orm');
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
            relationship: char.context,
            aliases: []
          });
        }
      } catch (e) {
        console.warn("Failed to sync character with people table:", e);
      }
    }

    // Store locations  
    for (const loc of data.locations) {
      const locationData: InsertLoreLocation = {
        profileId,
        name: loc.name,
        category: loc.category,
        description: loc.description,
        significance: loc.context,
        currentStatus: 'active',
        associatedCharacters: loc.relatedEntities,
        mentionCount: 0
      };

      await storage.db.insert(loreLocations).values(locationData).onConflictDoNothing();

      // Sync with places table
      try {
        const { places } = await import('../../shared/schema.js');
        const { and, eq } = await import('drizzle-orm');
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
            locationType: loc.category
          });
        }
      } catch (e) {
        console.warn("Failed to sync location with places table:", e);
      }
    }

    // Store historical events
    for (const event of data.events) {
      const eventData: InsertLoreHistoricalEvent = {
        profileId,
        title: event.name,
        description: event.description,
        category: event.category,
        timeframe: 'from memories',
        significance: event.significance,
        participants: event.relatedEntities,
        mentionCount: 0
      };

      await storage.db.insert(loreHistoricalEvents).values(eventData).onConflictDoNothing();

      // Sync with events table
      try {
        const { events } = await import('../../shared/schema.js');
        const { and, eq } = await import('drizzle-orm');
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
        console.warn("Failed to sync event with events table:", e);
      }
    }

    // Store relationships
    for (const rel of data.relationships) {
      const relationshipData: InsertLoreRelationship = {
        profileId,
        entityType1: 'character', // Will be improved to detect actual types
        entityId1: rel.entity1,
        entityName1: rel.entity1,
        entityType2: 'character',
        entityId2: rel.entity2,
        entityName2: rel.entity2,
        relationshipType: rel.relationshipType,
        strength: rel.strength,
        description: rel.description,
        status: 'active'
      };

      await storage.db.insert(loreRelationships).values(relationshipData).onConflictDoNothing();
    }

    console.log(`🎉 Knowledge graph stored successfully!`);
  }

  // Get comprehensive lore context including extracted knowledge
  static async getEnhancedLoreContext(profileId: string): Promise<string> {
    // Get all lore data
    const [characters, locations, events, historicalEvents, relationships] = await Promise.all([
      storage.db.select().from(loreCharacters).where(eq(loreCharacters.profileId, profileId)).limit(10),
      storage.db.select().from(loreLocations).where(eq(loreLocations.profileId, profileId)).limit(5),
      storage.db.select().from(loreHistoricalEvents).where(eq(loreHistoricalEvents.profileId, profileId)).limit(8),
      // Still get ongoing events from original table
      storage.db.select().from(loreEvents).where(eq(loreEvents.profileId, profileId)).limit(3),
      storage.db.select().from(loreRelationships).where(eq(loreRelationships.profileId, profileId)).limit(15)
    ]);

    let context = "NICKY'S COMPREHENSIVE WORLD (mention naturally if relevant):\n\n";

    // Current ongoing events
    if (events.length > 0) {
      context += "CURRENT ONGOING SITUATIONS:\n";
      events.forEach(event => {
        context += `- ${event.title}: ${event.description}\n`;
      });
      context += "\n";
    }

    // Key people in his life
    if (characters.length > 0) {
      context += "PEOPLE IN NICKY'S LIFE:\n";
      characters.forEach(char => {
        context += `- ${char.name} (${char.relationship}): ${char.lastActivity}\n`;
      });
      context += "\n";
    }

    // Important locations
    if (locations.length > 0) {
      context += "IMPORTANT PLACES:\n";
      locations.forEach(loc => {
        context += `- ${loc.name}: ${loc.description}\n`;
      });
      context += "\n";
    }

    // Notable past events
    if (historicalEvents.length > 0) {
      context += "MEMORABLE PAST EVENTS:\n";
      historicalEvents.forEach(event => {
        context += `- ${event.title}: ${event.description}\n`;
      });
      context += "\n";
    }

    // Key relationships
    if (relationships.length > 0) {
      context += "RELATIONSHIP DYNAMICS:\n";
      relationships.slice(0, 8).forEach(rel => {
        context += `- ${rel.entityName1} & ${rel.entityName2}: ${rel.relationshipType} (${rel.description})\n`;
      });
    }

    return context;
  }
}