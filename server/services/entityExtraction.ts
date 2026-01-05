import { GoogleGenAI } from "@google/genai";
import { executeWithProductionModel } from './modelSelector.js';
import { getDefaultModel, isValidModel } from '../config/geminiModels.js';

/**
 * 🎯 ENTITY EXTRACTION SERVICE
 * 
 * **2025 UPDATE**: Now uses executeWithProductionModel which routes through Gemini service.
 * Gemini service now delegates RAG operations to Claude Sonnet 4.5 for superior quality.
 * 
 * **EXTRACTION FLOW**: 
 * 1. This service calls executeWithProductionModel (Gemini wrapper)
 * 2. For extraction tasks, Gemini routes to Claude Sonnet 4.5
 * 3. If Claude fails, falls back to Gemini 2.0 Flash
 * 
 * Entity extraction is critical - using best available models only.
 */

interface DetectedEntity {
  name: string;
  type: 'PERSON' | 'PLACE' | 'EVENT' | 'CONCEPT' | 'ITEM' | 'MISC';
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
    conceptId?: string;
    itemId?: string;
    miscId?: string;
  };
}

class EntityExtractionService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
    
    const defaultModel = getDefaultModel();
    console.log(`✅ Entity extraction service initialized with default model: ${defaultModel}`);
  }

  /**
   * Retry helper for Gemini API calls with exponential backoff
   * Respects API-provided retry delays for rate limits
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = 3
  ): Promise<T> {
    const defaultDelays = [2000, 5000, 15000]; // 2s, 5s, 15s
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || isLastAttempt) {
          console.error(`❌ ${operationName} failed after ${attempt + 1} attempts:`, error);
          throw error;
        }
        
        // Try to extract retry delay from API error response
        let delay = defaultDelays[attempt] || defaultDelays[defaultDelays.length - 1];
        
        // Parse retry delay from error if available (e.g., "Please retry in 59.19s")
        const errorMsg = error?.error?.message || error?.message || '';
        const retryMatch = errorMsg.match(/retry in ([\d.]+)s/i);
        if (retryMatch) {
          const suggestedDelay = Math.ceil(parseFloat(retryMatch[1]) * 1000);
          // Use suggested delay, but cap at 2 minutes for sanity
          delay = Math.min(suggestedDelay, 120000);
          console.log(`⏱️ API suggests ${suggestedDelay / 1000}s delay`);
        }
        
        console.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message || error}`);
        console.log(`🔄 Retrying in ${delay / 1000}s...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // TypeScript safety - should never reach here
    throw new Error(`Unexpected retry loop exit for ${operationName}`);
  }

  /**
   * Check if error is retryable (transient errors like overload, rate limits)
   */
  private isRetryableError(error: any): boolean {
    const errorStr = error?.message || error?.toString() || '';
    const errorCode = error?.error?.code || error?.status || 0;
    
    // Retry on: overloaded (503), rate limits (429), timeouts, network errors
    const retryablePatterns = [
      /overloaded/i,
      /rate.?limit/i,
      /timeout/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /503/,
      /429/
    ];
    
    const isRetryable = retryablePatterns.some(pattern => 
      pattern.test(errorStr) || errorCode === 503 || errorCode === 429
    );
    
    if (!isRetryable) {
      console.log(`Non-retryable error detected: ${errorStr}`);
    }
    
    return isRetryable;
  }

  /**
   * Extract entities (people, places, events) from memory content using AI
   */
  async extractEntitiesFromMemory(memoryContent: string, existingEntities?: {
    people: Array<{ id: string; canonicalName: string; disambiguation?: string; aliases?: string[] }>;
    places: Array<{ id: string; canonicalName: string; locationType?: string; description?: string }>;
    events: Array<{ id: string; canonicalName: string; eventDate?: string; description?: string }>;
    concepts?: Array<{ id: string; canonicalName: string; category?: string; description?: string }>;
    items?: Array<{ id: string; canonicalName: string; type?: string; description?: string }>;
    misc?: Array<{ id: string; canonicalName: string; type?: string; description?: string }>;
  }): Promise<EntityExtractionResult> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `You are analyzing Nicky "Noodle Arms" A.I. Dente's memory content to extract entities for his knowledge database.

CRITICAL INSTRUCTIONS:
- Extract PEOPLE, PLACES, EVENTS, CONCEPTS, ITEMS, and MISC entities mentioned in the content
- Provide disambiguation for entities with common names (e.g., "Sal the Butcher" vs "Sal my cousin")
- Extract all alias/nickname variations mentioned
- Include SOURCE CONTEXT in disambiguation to distinguish between entities from different games/media (e.g., "Character from Arc Raiders" vs "Character from Dead by Daylight")
- Focus on entities that are important to Nicky's stories and relationships
- ALWAYS include the game/media/source name in the disambiguation field for game characters, media titles, and fictional entities

MEMORY CONTENT TO ANALYZE:
"${memoryContent}"

${existingEntities ? `
EXISTING ENTITIES TO CONSIDER:
People: ${existingEntities.people.map(p => `${p.canonicalName}${p.disambiguation ? ` (${p.disambiguation})` : ''}`).join(', ')}
Places: ${existingEntities.places.map(p => `${p.canonicalName}${p.locationType ? ` (${p.locationType})` : ''}`).join(', ')}
Events: ${existingEntities.events.map(e => `${e.canonicalName}${e.eventDate ? ` (${e.eventDate})` : ''}`).join(', ')}
Concepts: ${existingEntities.concepts?.map(c => `${c.canonicalName}${c.category ? ` (${c.category})` : ''}`).join(', ') || ''}
Items: ${existingEntities.items?.map(i => `${i.canonicalName}${i.type ? ` (${i.type})` : ''}`).join(', ') || ''}
Misc: ${existingEntities.misc?.map(m => `${m.canonicalName}${m.type ? ` (${m.type})` : ''}`).join(', ') || ''}

If you find entities that match existing ones, note the similarity in your analysis.
` : ''}

For each detected entity, provide:
- name: The canonical/primary name for this entity
- type: PERSON, PLACE, EVENT, CONCEPT, ITEM, or MISC
- disambiguation: Human-readable descriptor INCLUDING SOURCE/GAME NAME for game/media entities (e.g., "Character from Arc Raiders", "DBD Character", "Arc Raiders Game Mode", "From Little Italy", "The 1993 Incident", "Game Mechanic", "Weapon")
- aliases: All name variations/nicknames mentioned in the content
- context: Relevant context about this entity from the memory, INCLUDING what game/media it's from
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
    },
    {
      "name": "The Enforcer",
      "type": "PERSON",
      "disambiguation": "Character from Arc Raiders",
      "aliases": ["Enforcer"],
      "context": "Playable character in Arc Raiders, a tactical shooter game",
      "confidence": 0.9,
      "mentions": ["The Enforcer", "Enforcer character"]
    },
    {
      "name": "Looping",
      "type": "CONCEPT",
      "disambiguation": "Dead by Daylight Mechanic",
      "aliases": ["Running the killer", "Juicing"],
      "context": "The act of running around obstacles to waste the killer's time",
      "confidence": 0.9,
      "mentions": ["looping", "run the killer"]
    },
    {
      "name": "Flashlight",
      "type": "ITEM",
      "disambiguation": "Dead by Daylight Item",
      "aliases": ["Beamer", "Clicky clicky"],
      "context": "Item used to blind the killer",
      "confidence": 0.95,
      "mentions": ["flashlight", "beamer"]
    }
  ]
}

ONLY extract entities that are:
1. Specific people, places, events, concepts, items, or misc entities (not generic references)
2. Important to Nicky's stories, relationships, or experiences
3. Named or uniquely identifiable

DO extract:
- Named game characters with source context (e.g., "Victor (DBD Character)", "Raider (Arc Raiders Character)")
- Named people (Nicky, The Host, specific developers, real people)
- Named places (Little Italy, specific restaurants, locations, game maps with source context)
- Named shows/media/games as EVENT entities (e.g., "Arc Raiders", "Dead by Daylight", "Stranger Things")
- Specific events with dates or context
- Specific game mechanics or lore terms as CONCEPTS (e.g., "The Entity", "Gen Rushing", "Tunneling")
- Specific items or objects as ITEMS (e.g., "Medkit", "Key", "Grandma's Recipe Book")

DO NOT extract:
- Generic pronouns (he, she, it, they)
- Generic place types without names (a restaurant, the school)
- Generic role terms (survivor, killer, raider) unless referring to a specific character
- Generic gameplay terms (match, round, session) without specific context`;

    try {
      // Use production model for critical entity extraction (no experimental models)
      return await executeWithProductionModel(async (model) => {
        const response = await this.ai.models.generateContent({
          model,
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
                      type: { type: "string", enum: ["PERSON", "PLACE", "EVENT", "CONCEPT", "ITEM", "MISC"] },
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
      }, 'extraction'); // Purpose: extraction (entity extraction from memories)
    } catch (error) {
      console.error("Entity extraction error:", error);
      return {
        entities: [],
        suggestedLinks: {}
      };
    }
  }  /**
   * Match detected entities against existing entities in the database
   */
  async disambiguateEntities(
    detectedEntities: DetectedEntity[],
    existingEntities: {
      people: Array<{ id: string; canonicalName: string; disambiguation?: string; aliases?: string[] }>;
      places: Array<{ id: string; canonicalName: string; locationType?: string; description?: string }>;
      events: Array<{ id: string; canonicalName: string; eventDate?: string; description?: string }>;
      concepts?: Array<{ id: string; canonicalName: string; category?: string; description?: string }>;
      items?: Array<{ id: string; canonicalName: string; type?: string; description?: string }>;
      misc?: Array<{ id: string; canonicalName: string; type?: string; description?: string }>;
    }
  ): Promise<{
    matches: Array<{ detectedEntity: DetectedEntity; existingEntityId: string; matchType: 'PERSON' | 'PLACE' | 'EVENT' | 'CONCEPT' | 'ITEM' | 'MISC'; confidence: number }>;
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

Concepts: ${existingEntities.concepts?.map(c => `ID:${c.id} - ${c.canonicalName}${c.category ? ` (${c.category})` : ''}`).join('\n') || ''}

Items: ${existingEntities.items?.map(i => `ID:${i.id} - ${i.canonicalName}${i.type ? ` (${i.type})` : ''}`).join('\n') || ''}

Misc: ${existingEntities.misc?.map(m => `ID:${m.id} - ${m.canonicalName}${m.type ? ` (${m.type})` : ''}`).join('\n') || ''}

For each detected entity, determine:
1. Does it match an existing entity? (same person/place/event/concept/item/misc with different names)
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
      // Use production model for entity disambiguation (critical for data accuracy)
      return await executeWithProductionModel(async (model) => {
        const response = await this.ai.models.generateContent({
          model,
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
                      matchType: { type: "string", enum: ["PERSON", "PLACE", "EVENT", "CONCEPT", "ITEM", "MISC"] },
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
                      type: { type: "string", enum: ["PERSON", "PLACE", "EVENT", "CONCEPT", "ITEM", "MISC"] },
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
            matchType: match.matchType as 'PERSON' | 'PLACE' | 'EVENT' | 'CONCEPT' | 'ITEM' | 'MISC',
            confidence: match.confidence
          }));

          const newEntities = detectedEntities.filter(entity => 
            !result.matches.some((match: any) => match.detectedEntityName === entity.name)
          );

          return { matches, newEntities };
        } else {
          throw new Error("Empty response from Gemini");
        }
      }, 'analysis'); // Purpose: analysis (entity disambiguation)
    } catch (error) {
      console.error("Entity disambiguation error:", error);
      return {
        matches: [],
        newEntities: detectedEntities // Treat all as new if disambiguation fails
      };
    }
  }

  /**
   * 🔍 HELPER: Find matching entity by name or aliases
   * Used to prevent duplicate entities when processing new memories
   */
  private findMatchingEntity(
    entities: Array<{ id: string; canonicalName: string; aliases?: string[]; description?: string }>,
    targetName: string,
    targetAliases: string[]
  ): { id: string; canonicalName: string; aliases?: string[]; description?: string } | null {
    const normalizedTarget = targetName.toLowerCase().trim();
    const normalizedAliases = targetAliases.map(a => a.toLowerCase().trim());
    
    for (const entity of entities) {
      const normalizedEntityName = entity.canonicalName.toLowerCase().trim();
      const normalizedEntityAliases = (entity.aliases || []).map(a => a.toLowerCase().trim());
      
      // Check if names match
      if (normalizedEntityName === normalizedTarget) {
        return entity;
      }
      
      // Check if target name matches any entity alias
      if (normalizedEntityAliases.includes(normalizedTarget)) {
        return entity;
      }
      
      // Check if any target alias matches entity name
      if (normalizedAliases.includes(normalizedEntityName)) {
        return entity;
      }
      
      // Check if any target alias matches any entity alias
      for (const targetAlias of normalizedAliases) {
        if (normalizedEntityAliases.includes(targetAlias)) {
          return entity;
        }
      }
    }
    
    return null;
  }

  /**
   * 📝 HELPER: Merge new context into existing entity description
   * Prevents duplicate information while preserving new details
   */
  private mergeEntityContext(existingContext: string, newContext: string): string {
    if (!existingContext || existingContext.trim() === '') {
      return newContext;
    }
    
    if (!newContext || newContext.trim() === '') {
      return existingContext;
    }
    
    // Check if new context is already in existing (avoid exact duplicates)
    if (existingContext.toLowerCase().includes(newContext.toLowerCase())) {
      return existingContext;
    }
    
    // Append new context with clear separator
    return `${existingContext}\n\n[Updated]: ${newContext}`;
  }

  /**
   * Process memory content and return entity IDs for linking
   * This creates new entities if needed and returns the IDs for database linking
   * UPDATED: Returns arrays of entity IDs to support many-to-many relationships
   */
  async processMemoryForEntityLinking(
    memoryContent: string,
    profileId: string,
    storage: any // Storage interface for creating entities
  ): Promise<{
    personIds: string[];
    placeIds: string[];
    eventIds: string[];
    conceptIds: string[];
    itemIds: string[];
    miscIds: string[];
    entitiesCreated: number;
  }> {
    try {
      console.log(`🔍 DEBUG: Starting entity extraction for ${memoryContent.substring(0, 100)}...`);
      
      // Get existing entities from database
      const existingEntities = await storage.getAllEntities(profileId);
      console.log(`📚 DEBUG: Found ${existingEntities.people.length} people, ${existingEntities.places.length} places, ${existingEntities.events.length} events, ${existingEntities.concepts.length} concepts, ${existingEntities.items.length} items, ${existingEntities.misc.length} misc`);
      
      // Extract entities from memory content
      console.log(`🤖 DEBUG: Calling extractEntitiesFromMemory...`);
      const extraction = await this.extractEntitiesFromMemory(memoryContent, existingEntities);
      console.log(`✅ DEBUG: Extraction complete, found ${extraction.entities.length} entities`);
      
      if (extraction.entities.length === 0) {
        console.log(`⚠️ DEBUG: No entities extracted, returning empty result`);
        return { personIds: [], placeIds: [], eventIds: [], conceptIds: [], itemIds: [], miscIds: [], entitiesCreated: 0 };
      }

      // Disambiguate against existing entities
      const disambiguation = await this.disambiguateEntities(extraction.entities, existingEntities);
      
      const personIds: string[] = [];
      const placeIds: string[] = [];
      const eventIds: string[] = [];
      const conceptIds: string[] = [];
      const itemIds: string[] = [];
      const miscIds: string[] = [];
      let entitiesCreated = 0;

      // Process matches (link to existing entities)
      for (const match of disambiguation.matches) {
        if (match.confidence > 0.7) { // High confidence threshold
          if (match.matchType === 'PERSON' && !personIds.includes(match.existingEntityId)) {
            personIds.push(match.existingEntityId);
          } else if (match.matchType === 'PLACE' && !placeIds.includes(match.existingEntityId)) {
            placeIds.push(match.existingEntityId);
          } else if (match.matchType === 'EVENT' && !eventIds.includes(match.existingEntityId)) {
            eventIds.push(match.existingEntityId);
          } else if (match.matchType === 'CONCEPT' && !conceptIds.includes(match.existingEntityId)) {
            conceptIds.push(match.existingEntityId);
          } else if (match.matchType === 'ITEM' && !itemIds.includes(match.existingEntityId)) {
            itemIds.push(match.existingEntityId);
          } else if (match.matchType === 'MISC' && !miscIds.includes(match.existingEntityId)) {
            miscIds.push(match.existingEntityId);
          }
        }
      }

      // Process new entities (check if exists, update context or create new)
      for (const newEntity of disambiguation.newEntities) {
        try {
          // 🔍 ENTITY UPDATE LOGIC: Check if entity already exists before creating duplicate
          let existingEntity = null;
          
          if (newEntity.type === 'PERSON') {
            // Search for existing person by name or aliases
            existingEntity = this.findMatchingEntity(
              existingEntities.people,
              newEntity.name,
              newEntity.aliases
            );
            
            if (existingEntity) {
              // ✏️ UPDATE existing entity context instead of creating duplicate
              const updatedDescription = this.mergeEntityContext(
                existingEntity.description || '',
                newEntity.context
              );
              const mergedAliases = Array.from(new Set([
                ...(existingEntity.aliases || []),
                ...newEntity.aliases
              ]));
              
              await storage.updatePerson(existingEntity.id, {
                description: updatedDescription,
                aliases: mergedAliases
              });
              
              if (!personIds.includes(existingEntity.id)) {
                personIds.push(existingEntity.id);
              }
              console.log(`📝 Updated existing person: ${newEntity.name} (${existingEntity.id})`);
            } else {
              // ✨ CREATE new entity (doesn't exist yet)
              const createdEntity = await storage.createPerson({
                profileId: profileId,
                canonicalName: newEntity.name,
                disambiguation: newEntity.disambiguation,
                aliases: newEntity.aliases,
                relationship: '', // Will be filled by AI context
                description: newEntity.context
              });
              if (createdEntity?.id && !personIds.includes(createdEntity.id)) {
                personIds.push(createdEntity.id);
                entitiesCreated++;
                console.log(`✨ Created new person: ${newEntity.name}`);
              }
            }
          } else if (newEntity.type === 'PLACE') {
            // Search for existing place by name
            existingEntity = this.findMatchingEntity(
              existingEntities.places,
              newEntity.name,
              []
            );
            
            if (existingEntity) {
              // ✏️ UPDATE existing place context
              const updatedDescription = this.mergeEntityContext(
                existingEntity.description || '',
                newEntity.context
              );
              
              await storage.updatePlace(existingEntity.id, {
                description: updatedDescription
              });
              
              if (!placeIds.includes(existingEntity.id)) {
                placeIds.push(existingEntity.id);
              }
              console.log(`📝 Updated existing place: ${newEntity.name} (${existingEntity.id})`);
            } else {
              // ✨ CREATE new place
              const createdEntity = await storage.createPlace({
                profileId: profileId,
                canonicalName: newEntity.name,
                locationType: newEntity.disambiguation,
                description: newEntity.context
              });
              if (createdEntity?.id && !placeIds.includes(createdEntity.id)) {
                placeIds.push(createdEntity.id);
                entitiesCreated++;
                console.log(`✨ Created new place: ${newEntity.name}`);
              }
            }
          } else if (newEntity.type === 'EVENT') {
            // Search for existing event by name
            existingEntity = this.findMatchingEntity(
              existingEntities.events,
              newEntity.name,
              []
            );
            
            if (existingEntity) {
              // ✏️ UPDATE existing event context
              const updatedDescription = this.mergeEntityContext(
                existingEntity.description || '',
                newEntity.context
              );
              
              await storage.updateEvent(existingEntity.id, {
                description: updatedDescription
              });
              
              if (!eventIds.includes(existingEntity.id)) {
                eventIds.push(existingEntity.id);
              }
              console.log(`📝 Updated existing event: ${newEntity.name} (${existingEntity.id})`);
            } else {
              // ✨ CREATE new event
              const createdEntity = await storage.createEvent({
                profileId: profileId,
                canonicalName: newEntity.name,
                eventDate: newEntity.disambiguation,
                description: newEntity.context,
                isCanonical: true
              });
              if (createdEntity?.id && !eventIds.includes(createdEntity.id)) {
                eventIds.push(createdEntity.id);
                entitiesCreated++;
                console.log(`✨ Created new event: ${newEntity.name}`);
              }
            }
          } else if (newEntity.type === 'CONCEPT') {
            existingEntity = this.findMatchingEntity(
              existingEntities.concepts,
              newEntity.name,
              []
            );
            
            if (existingEntity) {
              const updatedDescription = this.mergeEntityContext(
                existingEntity.description || '',
                newEntity.context
              );
              await storage.updateConcept(existingEntity.id, { description: updatedDescription });
              if (!conceptIds.includes(existingEntity.id)) conceptIds.push(existingEntity.id);
              console.log(`📝 Updated existing concept: ${newEntity.name}`);
            } else {
              const createdEntity = await storage.createConcept({
                profileId: profileId,
                canonicalName: newEntity.name,
                category: newEntity.disambiguation,
                description: newEntity.context
              });
              if (createdEntity?.id && !conceptIds.includes(createdEntity.id)) {
                conceptIds.push(createdEntity.id);
                entitiesCreated++;
                console.log(`✨ Created new concept: ${newEntity.name}`);
              }
            }
          } else if (newEntity.type === 'ITEM') {
            existingEntity = this.findMatchingEntity(
              existingEntities.items,
              newEntity.name,
              []
            );
            
            if (existingEntity) {
              const updatedDescription = this.mergeEntityContext(
                existingEntity.description || '',
                newEntity.context
              );
              await storage.updateItem(existingEntity.id, { description: updatedDescription });
              if (!itemIds.includes(existingEntity.id)) itemIds.push(existingEntity.id);
              console.log(`📝 Updated existing item: ${newEntity.name}`);
            } else {
              const createdEntity = await storage.createItem({
                profileId: profileId,
                canonicalName: newEntity.name,
                type: newEntity.disambiguation,
                description: newEntity.context
              });
              if (createdEntity?.id && !itemIds.includes(createdEntity.id)) {
                itemIds.push(createdEntity.id);
                entitiesCreated++;
                console.log(`✨ Created new item: ${newEntity.name}`);
              }
            }
          } else if (newEntity.type === 'MISC') {
            existingEntity = this.findMatchingEntity(
              existingEntities.misc,
              newEntity.name,
              []
            );
            
            if (existingEntity) {
              const updatedDescription = this.mergeEntityContext(
                existingEntity.description || '',
                newEntity.context
              );
              await storage.updateMiscEntity(existingEntity.id, { description: updatedDescription });
              if (!miscIds.includes(existingEntity.id)) miscIds.push(existingEntity.id);
              console.log(`📝 Updated existing misc entity: ${newEntity.name}`);
            } else {
              const createdEntity = await storage.createMiscEntity({
                profileId: profileId,
                canonicalName: newEntity.name,
                type: newEntity.disambiguation,
                description: newEntity.context
              });
              if (createdEntity?.id && !miscIds.includes(createdEntity.id)) {
                miscIds.push(createdEntity.id);
                entitiesCreated++;
                console.log(`✨ Created new misc entity: ${newEntity.name}`);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing ${newEntity.type} entity:`, error);
          // Don't let entity creation failures break the whole process
        }
      }

      return {
        personIds,
        placeIds,
        eventIds,
        conceptIds,
        itemIds,
        miscIds,
        entitiesCreated
      };
    } catch (error) {
      console.error("Error processing memory for entity linking:", error);
      return { personIds: [], placeIds: [], eventIds: [], conceptIds: [], itemIds: [], miscIds: [], entitiesCreated: 0 };
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
      concepts?: Array<{ id: string; canonicalName: string; type?: string; description?: string }>;
      items?: Array<{ id: string; canonicalName: string; type?: string; description?: string }>;
      misc?: Array<{ id: string; canonicalName: string; type?: string; description?: string }>;
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

  /**
   * 📂 GET ENTITY DOSSIERS
   * Extracts entities from a message and returns their full database records.
   * Used to give Nicky "Ground Truth" about people/places mentioned.
   */
  async getEntityDossiers(
    text: string,
    profileId: string,
    storage: any
  ): Promise<string> {
    try {
      // 1. Get all entities for this profile (cached in storage usually)
      const existingEntities = await storage.getAllEntities(profileId);
      
      // 2. Extract entities from the text
      const extraction = await this.extractEntitiesFromMemory(text, existingEntities);
      
      if (extraction.entities.length === 0) return "";

      // 3. Disambiguate to find matches
      const disambiguation = await this.disambiguateEntities(extraction.entities, existingEntities);
      
      const dossiers: string[] = [];
      const seenIds = new Set<string>();

      // 4. Build dossier strings for matches
      for (const match of disambiguation.matches) {
        if (match.confidence > 0.6 && !seenIds.has(match.existingEntityId)) {
          seenIds.add(match.existingEntityId);
          
          // Find the full entity record
          let entity: any = null;
          if (match.matchType === 'PERSON') entity = existingEntities.people.find((p: any) => p.id === match.existingEntityId);
          else if (match.matchType === 'PLACE') entity = existingEntities.places.find((p: any) => p.id === match.existingEntityId);
          else if (match.matchType === 'EVENT') entity = existingEntities.events.find((e: any) => e.id === match.existingEntityId);
          
          if (entity) {
            dossiers.push(`[DOSSIER: ${entity.canonicalName}] ${entity.description || 'No description'}. Relationship: ${entity.relationship || 'Unknown'}. Aliases: ${(entity.aliases || []).join(', ')}`);
          }
        }
      }

      return dossiers.length > 0 ? "\n\nENTITY DOSSIERS:\n" + dossiers.join('\n') : "";
    } catch (error) {
      console.warn("Failed to fetch entity dossiers:", error);
      return "";
    }
  }
}

export const entityExtraction = new EntityExtractionService();