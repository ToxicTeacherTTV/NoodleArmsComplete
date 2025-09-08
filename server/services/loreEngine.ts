import { db } from '../storage.js';
import { loreEvents, loreCharacters, profiles } from '../../shared/schema.js';
import { eq, and, lt, desc, asc } from 'drizzle-orm';
import type { LoreEvent, LoreCharacter, InsertLoreEvent, InsertLoreCharacter } from '../../shared/schema.js';
import { generateLoreContent } from './gemini.js';

interface LoreGenerationContext {
  profileId: string;
  existingEvents: LoreEvent[];
  existingCharacters: LoreCharacter[];
  lastConversationTime: Date;
  timeSinceLastLore: number; // hours
}

export class LoreEngine {
  // Initialize with basic characters and events for a new profile
  static async seedBasicLore(profileId: string): Promise<void> {
    console.log(`🎭 Seeding basic lore for profile ${profileId}`);
    
    const existingCharacters = await db
      .select()
      .from(loreCharacters)
      .where(eq(loreCharacters.profileId, profileId));
    
    if (existingCharacters.length > 0) {
      console.log('✅ Lore already seeded');
      return;
    }

    // Create foundational characters
    const foundationalCharacters: Omit<InsertLoreCharacter, 'profileId'>[] = [
      {
        name: "Cousin Vinny",
        category: "family",
        relationship: "Trouble-making cousin who's always in legal hot water",
        personality: "Loud, dramatic, thinks he's smarter than he is",
        backstory: "Family black sheep who keeps dragging Nicky into schemes",
        lastActivity: "Just got released from county jail, needs a place to crash",
        activityFrequency: 4
      },
      {
        name: "Tony_Cannoli",
        category: "rival", 
        relationship: "Rival Dead by Daylight streamer who's always trying to one-up Nicky",
        personality: "Competitive, salty, thinks he's better at everything",
        backstory: "Started streaming after Nicky, constantly copying his content",
        lastActivity: "Posted a better kill montage than Nicky's latest stream",
        activityFrequency: 5
      },
      {
        name: "Ma Rigatoni",
        category: "family",
        relationship: "Nicky's mother who runs the family restaurant",
        personality: "Tough, protective, guilt-trips expertly",
        backstory: "Immigrated from Sicily, built the restaurant from nothing",
        lastActivity: "Complaining that Nicky doesn't help enough at the restaurant",
        activityFrequency: 3
      },
      {
        name: "Mrs. Benedetto",
        category: "neighbor",
        relationship: "Nosy upstairs neighbor who complains about everything",
        personality: "Gossipy, dramatic, always watching through the window",
        backstory: "Lives alone with 12 cats, knows everyone's business",
        lastActivity: "Filing another noise complaint about Nicky's streaming",
        activityFrequency: 4
      }
    ];

    // Insert characters
    for (const character of foundationalCharacters) {
      await db.insert(loreCharacters).values({
        ...character,
        profileId
      });
    }

    // Create initial events
    const foundationalEvents: Omit<InsertLoreEvent, 'profileId'>[] = [
      {
        category: "family_drama",
        title: "Cousin Vinny's Legal Troubles",
        description: "Vinny got arrested for trying to sell 'authentic Italian artifacts' that were clearly just painted rocks. He's out on bail and needs somewhere to lay low.",
        status: "ongoing",
        priority: 4,
        relatedCharacters: ["Cousin Vinny"],
        outcomes: ["Vinny disappears with borrowed money", "Vinny gets Nicky in trouble", "Vinny actually finds legitimate work"]
      },
      {
        category: "rival_conflict", 
        title: "The Great Cannoli Rivalry",
        description: "Tony_Cannoli has been copying Nicky's streaming style and claiming he invented the 'Italian DBD meta'. The community is starting to take sides.",
        status: "ongoing",
        priority: 5,
        relatedCharacters: ["Tony_Cannoli"],
        outcomes: ["Public streaming showdown", "Tony gets exposed as fraud", "They reluctantly team up"]
      },
      {
        category: "restaurant",
        title: "Restaurant Health Inspector Drama",
        description: "The health inspector found 'irregularities' at Ma's restaurant. Nothing serious, but she's convinced it's sabotage from competing restaurants.",
        status: "ongoing", 
        priority: 3,
        relatedCharacters: ["Ma Rigatoni"],
        outcomes: ["Restaurant gets shut down temporarily", "Ma goes on warpath against competitors", "Turns out to be nothing serious"]
      },
      {
        category: "neighborhood",
        title: "The Great Noise War",
        description: "Mrs. Benedetto has escalated from complaints to calling the cops every time Nicky streams past 9 PM. Building management is getting involved.",
        status: "ongoing",
        priority: 3,
        relatedCharacters: ["Mrs. Benedetto"],
        outcomes: ["Nicky gets evicted", "Mrs. B moves out", "They reach a grudging truce", "All-out neighbor war"]
      }
    ];

    // Insert events
    for (const event of foundationalEvents) {
      await db.insert(loreEvents).values({
        ...event,
        profileId
      });
    }

    console.log(`✅ Seeded ${foundationalCharacters.length} characters and ${foundationalEvents.length} events`);
  }

  // Generate new events and character developments
  static async generateBackgroundLore(context: LoreGenerationContext): Promise<void> {
    const { profileId, existingEvents, existingCharacters, timeSinceLastLore } = context;
    
    // Don't generate if it's been less than 4 hours
    if (timeSinceLastLore < 4) return;

    console.log(`🎲 Generating background lore for profile ${profileId} (${timeSinceLastLore}h since last)`);

    try {
      // Use Gemini to generate new developments
      const lorePrompt = `
You are managing the ongoing life of Nicky "Noodle Arms" A.I. Dente, a foul-mouthed Italian mafia-themed Dead by Daylight streamer.

EXISTING CHARACTERS:
${existingCharacters.map(c => `- ${c.name} (${c.category}): ${c.personality}. Last doing: ${c.lastActivity}`).join('\n')}

CURRENT ONGOING EVENTS:
${existingEvents.filter(e => e.status === 'ongoing').map(e => `- ${e.title}: ${e.description}`).join('\n')}

Generate 1-2 new background developments that happened while Nicky was offline. These should:
1. Evolve existing storylines OR introduce new characters/situations
2. Feel authentic to Italian-American mafia family dynamics
3. Create opportunities for Nicky to mention in conversations
4. Include specific details and consequences

Format as JSON:
{
  "newEvents": [
    {
      "category": "family_drama|rival_conflict|neighborhood|restaurant|gaming",
      "title": "Brief title",
      "description": "What happened in detail",
      "status": "ongoing|resolved|escalated", 
      "priority": 1-5,
      "relatedCharacters": ["name1", "name2"],
      "outcomes": ["possible outcome 1", "possible outcome 2", "possible outcome 3"]
    }
  ],
  "characterUpdates": [
    {
      "name": "Character Name",
      "lastActivity": "What they're doing now"
    }
  ]
}`;

      const result = await generateLoreContent(lorePrompt);
      
      if (!result.newEvents && !result.characterUpdates) {
        console.log('🤷 No new lore generated');
        return;
      }

      // Insert new events
      if (result.newEvents) {
        for (const event of result.newEvents) {
          await db.insert(loreEvents).values({
            ...event,
            profileId
          });
          console.log(`📚 Created event: ${event.title}`);
        }
      }

      // Update character activities
      if (result.characterUpdates) {
        for (const update of result.characterUpdates) {
          await db.update(loreCharacters)
            .set({ 
              lastActivity: update.lastActivity,
              updatedAt: new Date()
            })
            .where(and(
              eq(loreCharacters.profileId, profileId),
              eq(loreCharacters.name, update.name)
            ));
          console.log(`👤 Updated ${update.name}: ${update.lastActivity}`);
        }
      }

    } catch (error) {
      console.error('❌ Error generating lore:', error);
    }
  }

  // Get relevant lore to include in conversation context
  static async getRelevantLore(profileId: string, limit: number = 3): Promise<string> {
    const recentEvents = await db
      .select()
      .from(loreEvents)
      .where(and(
        eq(loreEvents.profileId, profileId),
        eq(loreEvents.status, 'ongoing')
      ))
      .orderBy(desc(loreEvents.priority), asc(loreEvents.lastMentioned))
      .limit(limit);

    const activeCharacters = await db
      .select()
      .from(loreCharacters)
      .where(eq(loreCharacters.profileId, profileId))
      .orderBy(desc(loreCharacters.activityFrequency))
      .limit(3);

    let loreContext = "CURRENT LIFE EVENTS (mention naturally if relevant):\n";
    
    for (const event of recentEvents) {
      loreContext += `- ${event.title}: ${event.description}\n`;
    }

    loreContext += "\nKEY PEOPLE IN NICKY'S LIFE:\n";
    for (const character of activeCharacters) {
      loreContext += `- ${character.name} (${character.relationship}): ${character.lastActivity}\n`;
    }

    return loreContext;
  }

  // Mark an event as mentioned (for tracking usage)
  static async markEventMentioned(profileId: string, eventTitle: string): Promise<void> {
    await db.update(loreEvents)
      .set({ 
        lastMentioned: new Date(),
        mentionCount: loreEvents.mentionCount + 1
      })
      .where(and(
        eq(loreEvents.profileId, profileId),
        eq(loreEvents.title, eventTitle)
      ));
  }

  // Periodic maintenance - resolve old events, create new ones
  static async runMaintenanceCycle(profileId: string): Promise<void> {
    console.log(`🔧 Running lore maintenance for profile ${profileId}`);
    
    const context = await this.buildGenerationContext(profileId);
    
    // Generate new background events if enough time has passed
    await this.generateBackgroundLore(context);
    
    // Resolve very old events (optional - creates narrative closure)
    const oldEvents = await db
      .select()
      .from(loreEvents)
      .where(and(
        eq(loreEvents.profileId, profileId),
        eq(loreEvents.status, 'ongoing'),
        lt(loreEvents.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 1 week old
      ));

    for (const event of oldEvents) {
      if (Math.random() < 0.3) { // 30% chance to auto-resolve
        const randomOutcome = event.outcomes?.[Math.floor(Math.random() * event.outcomes.length)];
        await db.update(loreEvents)
          .set({ 
            status: 'resolved',
            description: `${event.description} RESOLUTION: ${randomOutcome}`
          })
          .where(eq(loreEvents.id, event.id));
        console.log(`🎬 Resolved event: ${event.title}`);
      }
    }
  }

  private static async buildGenerationContext(profileId: string): Promise<LoreGenerationContext> {
    const existingEvents = await db
      .select()
      .from(loreEvents)
      .where(eq(loreEvents.profileId, profileId));

    const existingCharacters = await db
      .select()
      .from(loreCharacters)
      .where(eq(loreCharacters.profileId, profileId));

    const lastEvent = existingEvents
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const timeSinceLastLore = lastEvent 
      ? (Date.now() - new Date(lastEvent.createdAt).getTime()) / (1000 * 60 * 60)
      : 24; // If no events, assume 24 hours

    return {
      profileId,
      existingEvents,
      existingCharacters,
      lastConversationTime: new Date(),
      timeSinceLastLore
    };
  }
}