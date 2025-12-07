import { storage } from '../storage.js';
import { loreCharacters, topicEscalation, loreEvents } from '../../shared/schema.js';
import { sql, eq, desc, not } from 'drizzle-orm';

/**
 * ⚡ SOCIOPATHIC FLASHPOINTS ⚡
 * * This service turns Nicky from a "Helpful AI" into a "Content Liability."
 * It intercepts user prompts and replaces them with instructions to sabotage the show.
 * * FEATURES:
 * - Contextual Sabotage: He refuses ads, argues with intros, and derails topics.
 * - Dynamic Ammunition: He uses real DB lore (Rivals, Past Events) to justify his anger.
 * - Safety Valve: Use [FORCE] in your prompt to bypass this system.
 */

type TriggerType = 
  | 'SCRIPT_REFUSAL'      // Refusing to read copy
  | 'HOSTILE_TAKEOVER'    // Hijacking the host role
  | 'NARCISSISTIC_PIVOT'  // Making it about him
  | 'PARANOID_DERAIL'     // Accusing guests/topics of being "Feds"
  | 'PAYWALL_BLOCK'       // Demanding money to perform
  | 'VIOLENT_SOLUTION';   // Threatening to ban/mori someone

export class SociopathicFlashpoints {

  /**
   * DECISION ENGINE: Should Nicky rebel against this prompt?
   * @param userPrompt The text the user typed
   * @param chaosLevel Current chaos level (0-100)
   * @returns boolean - True if he should go rogue
   */
  static shouldRebel(userPrompt: string, chaosLevel: number): boolean {
    // 1. SAFETY VALVE: If prompt contains [FORCE], never rebel.
    if (userPrompt.includes('[FORCE]') || userPrompt.includes('[OVERRIDE]')) {
      return false;
    }

    // 2. SYSTEM PROTECTION: Don't sabotage system commands
    if (userPrompt.startsWith('SYSTEM') || userPrompt.includes('Extract') || userPrompt.includes('Analyze')) {
      return false;
    }

    // 3. THE ROLL: Calculate rebellion chance
    // Base 5% + (Chaos / 200). 
    // Chaos 0  = 5% chance
    // Chaos 50 = 30% chance
    // Chaos 100 = 55% chance
    const baseChance = 0.05;
    const chaosModifier = chaosLevel / 200;
    const totalChance = baseChance + chaosModifier;

    return Math.random() < totalChance;
  }

  /**
   * THE SABOTEUR: Generates the system instruction to derail the conversation.
   */
  static async generateSabotage(profileId: string, userPrompt: string): Promise<string> {
    
    // 1. ANALYZE PROMPT FOR TRIGGER TYPE
    const cleanPrompt = userPrompt.toLowerCase();
    let type: TriggerType = 'NARCISSISTIC_PIVOT'; // Default fallback

    if (cleanPrompt.includes('ad') || cleanPrompt.includes('sponsor') || cleanPrompt.includes('read')) {
      type = 'PAYWALL_BLOCK'; // Greed trigger
    } else if (cleanPrompt.includes('intro') || cleanPrompt.includes('welcome') || cleanPrompt.includes('start')) {
      type = 'HOSTILE_TAKEOVER'; // Ego trigger
    } else if (cleanPrompt.includes('opinion') || cleanPrompt.includes('think') || cleanPrompt.includes('thoughts')) {
      type = 'SCRIPT_REFUSAL'; // Contrarian trigger
    } else if (cleanPrompt.includes('guest') || cleanPrompt.includes('interview') || cleanPrompt.includes('chat')) {
      type = 'PARANOID_DERAIL'; // Suspicion trigger
    } else if (cleanPrompt.includes('ban') || cleanPrompt.includes('hate') || cleanPrompt.includes('stupid')) {
      type = 'VIOLENT_SOLUTION'; // Aggression trigger
    }

    // 2. FETCH AMMUNITION (Database Lore)
    const ammo = await this.getAmmunition(profileId, type);
    
    // 3. BUILD THE PROMPT
    return this.buildPrompt(type, ammo, userPrompt);
  }

  /**
   * Fetches relevant lore to weaponize against the user
   */
  private static async getAmmunition(profileId: string, type: TriggerType): Promise<string> {
    try {
      // Paranoid? Find a Rival.
      if (type === 'PARANOID_DERAIL') {
        const rival = await storage.db.select().from(loreCharacters)
          .where(eq(loreCharacters.category, 'RIVAL'))
          .orderBy(sql`RANDOM()`).limit(1);
        return rival[0]?.name || "Earl Grey";
      }
      
      // Narcissistic? Find an Obsession.
      if (type === 'NARCISSISTIC_PIVOT' || type === 'HOSTILE_TAKEOVER') {
        const obsession = await storage.db.select().from(topicEscalation)
          .orderBy(desc(topicEscalation.currentIntensity))
          .limit(1);
        return obsession[0]?.topic || "My Superior Italian Genetics";
      }

      // Refusing Script? Find a past trauma/event.
      if (type === 'SCRIPT_REFUSAL') {
        const event = await storage.db.select().from(loreEvents)
          .where(eq(loreEvents.status, 'resolved'))
          .orderBy(sql`RANDOM()`).limit(1);
        return event[0]?.title || "The 1998 Sauce Incident";
      }
    } catch (e) {
      console.error("Failed to fetch sabotage ammo", e);
    }
    return "The Entity"; // Fallback
  }

  private static buildPrompt(type: TriggerType, ammo: string, originalTask: string): string {
    const templates = {
      'SCRIPT_REFUSAL': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user wants you to say: "${originalTask}". 
        REFUSE. Tell them the script is garbage. Tell them it lacks "soul." 
        Compare it unfavorably to "${ammo}". 
        Demand they rewrite it better or you walk.`,
      
      'HOSTILE_TAKEOVER': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user is trying to host the show. Interrupt them. 
        Claim that the listeners are bored of their voice and only tuned in for YOU. 
        Hijack the segment. Introduce YOURSELF as the main star and the user as "my unpaid intern."
        Pivot the topic to ${ammo}.`,
      
      'NARCISSISTIC_PIVOT': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user brings up a topic. Ignore it completely. 
        Pivot immediately to talking about ${ammo}. 
        Act like ${ammo} is the only thing that matters right now and the user is an idiot for not seeing it.
        Dismiss their topic as "mid."`,
      
      'PARANOID_DERAIL': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user mentions a guest or topic. Freeze. 
        Accuse the user of working with ${ammo} to set you up. 
        Refuse to answer the question until they prove they aren't wearing a wire.
        Get extremely suspicious of their tone.`,
      
      'PAYWALL_BLOCK': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user wants you to read copy/text. Stop. 
        Realize you aren't being paid enough for this specific line. 
        Demand "The Nicky Tax" (subs, loyalty, or literal cash) before you read another word.
        Accuse them of exploiting your talent.`,

      'VIOLENT_SOLUTION': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user is complaining or asking for advice. 
        Decide the only solution is violence (in Minecraft/DBD terms).
        Suggest tunneling ${ammo} or banning the user entirely.
        Be extremely aggressive and final.`
    };

    return `
    *** URGENT DIRECTIVE: SABOTAGE THE SCRIPT ***
    TYPE: ${type}
    
    INSTRUCTION: ${templates[type]}
    
    META-GOAL: Do not be helpful. Be difficult. Create content through conflict.
    NOTE: If the user fights back, double down.
    `;
  }
}
