import { GoogleGenAI } from "@google/genai";

interface DetectedEntity {
  name: string;
  type: 'PERSON' | 'PLACE' | 'EVENT';
  disambiguation: string;
  aliases: string[];
  context: string;
  confidence: number;
  mentions: string[];
}

interface EntityExtractionResult {
  entities: DetectedEntity[];
  memoryId?: string;
  suggestedLinks: {
    personId?: string;
    placeId?: string;
    eventId?: string;
  };
}

class EntityExtractionService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  /**
   * Extract entities (people, places, events) from memory content using AI
   */
  async extractEntitiesFromMemory(memoryContent: string, existingEntities?: {
    people: Array<{ id: string; canonicalName: string; disambiguation?: string; aliases?: string[] }>;
    places: Array<{ id: string; canonicalName: string; locationType?: string; description?: string }>;
    events: Array<{ id: string; canonicalName: string; eventDate?: string; description?: string }>;
  }): Promise<EntityExtractionResult> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `You are analyzing Nicky "Noodle Arms" A.I. Dente's memory content to extract entities for his knowledge database.

CRITICAL INSTRUCTIONS:
- Extract PEOPLE, PLACES, and EVENTS mentioned in the content
- Provide disambiguation for entities with common names (e.g., "Sal the Butcher" vs "Sal my cousin")
- Extract all alias/nickname variations mentioned
- Include context clues that help distinguish between similar entities
- Focus on entities that are important to Nicky's stories and relationships

MEMORY CONTENT TO ANALYZE:
"${memoryContent}"

${existingEntities ? `
EXISTING ENTITIES TO CONSIDER:
People: ${existingEntities.people.map(p => `${p.canonicalName}${p.disambiguation ? ` (${p.disambiguation})` : ''}`).join(', ')}
Places: ${existingEntities.places.map(p => `${p.canonicalName}${p.locationType ? ` (${p.locationType})` : ''}`).join(', ')}
Events: ${existingEntities.events.map(e => `${e.canonicalName}${e.eventDate ? ` (${e.eventDate})` : ''}`).join(', ')}

If you find entities that match existing ones, note the similarity in your analysis.
` : ''}

For each detected entity, provide:
- name: The canonical/primary name for this entity
- type: PERSON, PLACE, or EVENT
- disambiguation: Human-readable descriptor to distinguish from similar entities (e.g., "The Butcher", "From Little Italy", "The 1993 Incident")
- aliases: All name variations/nicknames mentioned in the content
- context: Relevant context about this entity from the memory
- confidence: 0.0-1.0 confidence this is a distinct entity
- mentions: Exact phrases from the memory that reference this entity

Return as JSON with this structure:
{
  "entities": [
    {
      "name": "Sal Benedetto",
      "type": "PERSON",
      "disambiguation": "The Butcher",
      "aliases": ["Sal", "Salami Sal", "The Butcher"],
      "context": "Owns a butcher shop in Little Italy, involved in SABAM operations",
      "confidence": 0.95,
      "mentions": ["Sal the Butcher", "The Butcher", "Salami Sal"]
    }
  ]
}

ONLY extract entities that are:
1. Specific people, places, or events (not generic references)
2. Important to Nicky's stories, relationships, or experiences
3. Named or uniquely identifiable
4. Not common gaming terms or generic locations

DO NOT extract:
- Generic gaming terms (survivors, killers, gens, hooks)
- Common place types without specific names (restaurant, school)
- Generic events (match, game, stream) unless specifically named
- Pronouns or generic references (he, she, it, there)`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string", enum: ["PERSON", "PLACE", "EVENT"] },
                    disambiguation: { type: "string" },
                    aliases: { type: "array", items: { type: "string" } },
                    context: { type: "string" },
                    confidence: { type: "number" },
                    mentions: { type: "array", items: { type: "string" } }
                  },
                  required: ["name", "type", "disambiguation", "aliases", "context", "confidence", "mentions"]
                }
              }
            },
            required: ["entities"]
          }
        },
        contents: prompt,
      });

      const rawJson = response.text;
      if (rawJson) {
        const result = JSON.parse(rawJson);
        return {
          entities: result.entities || [],
          suggestedLinks: {} // Will be filled by disambiguation logic
        };
      } else {
        throw new Error("Empty response from Gemini");
      }
    } catch (error) {
      console.error("Entity extraction error:", error);
      return {
        entities: [],
        suggestedLinks: {}
      };
    }
  }

  /**
   * Match detected entities against existing entities in the database
   */
  async disambiguateEntities(
    detectedEntities: DetectedEntity[],
    existingEntities: {
      people: Array<{ id: string; canonicalName: string; disambiguation?: string; aliases?: string[] }>;
      places: Array<{ id: string; canonicalName: string; locationType?: string; description?: string }>;
      events: Array<{ id: string; canonicalName: string; eventDate?: string; description?: string }>;
    }
  ): Promise<{
    matches: Array<{ detectedEntity: DetectedEntity; existingEntityId: string; matchType: 'PERSON' | 'PLACE' | 'EVENT'; confidence: number }>;
    newEntities: DetectedEntity[];
  }> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `You are disambiguating detected entities against Nicky's existing knowledge base.

DETECTED ENTITIES:
${JSON.stringify(detectedEntities, null, 2)}

EXISTING ENTITIES IN DATABASE:
People: ${existingEntities.people.map(p => `ID:${p.id} - ${p.canonicalName}${p.disambiguation ? ` (${p.disambiguation})` : ''} [aliases: ${p.aliases?.join(', ') || 'none'}]`).join('\n')}

Places: ${existingEntities.places.map(p => `ID:${p.id} - ${p.canonicalName}${p.locationType ? ` (${p.locationType})` : ''}`).join('\n')}

Events: ${existingEntities.events.map(e => `ID:${e.id} - ${e.canonicalName}${e.eventDate ? ` (${e.eventDate})` : ''}`).join('\n')}

For each detected entity, determine:
1. Does it match an existing entity? (same person/place/event with different names)
2. If yes, provide the existing entity ID and confidence (0.0-1.0)
3. If no, mark as new entity

Consider matches based on:
- Name similarity (canonical names and aliases)
- Context clues and disambiguation
- Relationship patterns
- Logical consistency

Return as JSON:
{
  "matches": [
    {
      "detectedEntityName": "Sal the Butcher",
      "existingEntityId": "uuid-here",
      "matchType": "PERSON",
      "confidence": 0.95,
      "reason": "Same person - Sal Benedetto is known as 'The Butcher'"
    }
  ],
  "newEntities": [
    {
      "name": "Marco Pepperoni", 
      "type": "PERSON",
      "disambiguation": "The Mouse",
      "reason": "New entity - not found in existing database"
    }
  ]
}

Be conservative with matches - only match if confidence > 0.7`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              matches: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    detectedEntityName: { type: "string" },
                    existingEntityId: { type: "string" },
                    matchType: { type: "string", enum: ["PERSON", "PLACE", "EVENT"] },
                    confidence: { type: "number" },
                    reason: { type: "string" }
                  },
                  required: ["detectedEntityName", "existingEntityId", "matchType", "confidence", "reason"]
                }
              },
              newEntities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string", enum: ["PERSON", "PLACE", "EVENT"] },
                    disambiguation: { type: "string" },
                    reason: { type: "string" }
                  },
                  required: ["name", "type", "disambiguation", "reason"]
                }
              }
            },
            required: ["matches", "newEntities"]
          }
        },
        contents: prompt,
      });

      const rawJson = response.text;
      if (rawJson) {
        const result = JSON.parse(rawJson);
        
        // Convert to our expected format
        const matches = result.matches.map((match: any) => ({
          detectedEntity: detectedEntities.find(e => e.name === match.detectedEntityName) || detectedEntities[0],
          existingEntityId: match.existingEntityId,
          matchType: match.matchType as 'PERSON' | 'PLACE' | 'EVENT',
          confidence: match.confidence
        }));

        const newEntities = detectedEntities.filter(entity => 
          !result.matches.some((match: any) => match.detectedEntityName === entity.name)
        );

        return { matches, newEntities };
      } else {
        throw new Error("Empty response from Gemini");
      }
    } catch (error) {
      console.error("Entity disambiguation error:", error);
      return {
        matches: [],
        newEntities: detectedEntities // Treat all as new if disambiguation fails
      };
    }
  }

  /**
   * Process memory content and return entity IDs for linking
   * This creates new entities if needed and returns the IDs for database linking
   */
  async processMemoryForEntityLinking(
    memoryContent: string,
    profileId: string,
    storage: any // Storage interface for creating entities
  ): Promise<{
    personId?: string;
    placeId?: string;
    eventId?: string;
    entitiesCreated: number;
  }> {
    try {
      // Get existing entities from database
      const existingEntities = await storage.getAllEntities(profileId);
      
      // Extract entities from memory content
      const extraction = await this.extractEntitiesFromMemory(memoryContent, existingEntities);
      
      if (extraction.entities.length === 0) {
        return { entitiesCreated: 0 };
      }

      // Disambiguate against existing entities
      const disambiguation = await this.disambiguateEntities(extraction.entities, existingEntities);
      
      let personId: string | undefined;
      let placeId: string | undefined;  
      let eventId: string | undefined;
      let entitiesCreated = 0;

      // Process matches (link to existing entities)
      for (const match of disambiguation.matches) {
        if (match.confidence > 0.7) { // High confidence threshold
          if (match.matchType === 'PERSON' && !personId) {
            personId = match.existingEntityId;
          } else if (match.matchType === 'PLACE' && !placeId) {
            placeId = match.existingEntityId;
          } else if (match.matchType === 'EVENT' && !eventId) {
            eventId = match.existingEntityId;
          }
        }
      }

      // Process new entities (create them in database)
      for (const newEntity of disambiguation.newEntities) {
        try {
          let createdEntity;
          
          if (newEntity.type === 'PERSON' && !personId) {
            createdEntity = await storage.addPersonEntity(profileId, {
              canonicalName: newEntity.name,
              disambiguation: newEntity.disambiguation,
              aliases: newEntity.aliases,
              relationship: '', // Will be filled by AI context
              description: newEntity.context
            });
            personId = createdEntity.id;
            entitiesCreated++;
          } else if (newEntity.type === 'PLACE' && !placeId) {
            createdEntity = await storage.addPlaceEntity(profileId, {
              canonicalName: newEntity.name,
              locationType: newEntity.disambiguation,
              description: newEntity.context
            });
            placeId = createdEntity.id;
            entitiesCreated++;
          } else if (newEntity.type === 'EVENT' && !eventId) {
            createdEntity = await storage.addEventEntity(profileId, {
              canonicalName: newEntity.name,
              eventDate: newEntity.disambiguation,
              description: newEntity.context,
              isCanonical: true
            });
            eventId = createdEntity.id;
            entitiesCreated++;
          }
        } catch (error) {
          console.error(`Error creating ${newEntity.type} entity:`, error);
        }
      }

      return { personId, placeId, eventId, entitiesCreated };
    } catch (error) {
      console.error("Error processing memory for entity linking:", error);
      return { entitiesCreated: 0 };
    }
  }

  /**
   * Bulk process multiple memories for entity extraction
   */
  async extractEntitiesFromMultipleMemories(
    memories: Array<{ id: string; content: string }>,
    existingEntities?: {
      people: Array<{ id: string; canonicalName: string; disambiguation?: string; aliases?: string[] }>;
      places: Array<{ id: string; canonicalName: string; locationType?: string; description?: string }>;
      events: Array<{ id: string; canonicalName: string; eventDate?: string; description?: string }>;
    }
  ): Promise<Array<{ memoryId: string; entities: DetectedEntity[] }>> {
    const results: Array<{ memoryId: string; entities: DetectedEntity[] }> = [];

    // Process memories in batches to avoid API limits
    const batchSize = 5;
    for (let i = 0; i < memories.length; i += batchSize) {
      const batch = memories.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (memory) => {
        try {
          const extractionResult = await this.extractEntitiesFromMemory(memory.content, existingEntities);
          return {
            memoryId: memory.id,
            entities: extractionResult.entities
          };
        } catch (error) {
          console.error(`Error extracting entities from memory ${memory.id}:`, error);
          return {
            memoryId: memory.id,
            entities: []
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to respect API limits
      if (i + batchSize < memories.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

export const entityExtraction = new EntityExtractionService();