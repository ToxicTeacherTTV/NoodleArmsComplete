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
    // 📉 TONED DOWN: Reduced base chance and chaos scaling to prevent derailment
    // Base 1% + (Chaos / 1000). 
    // Chaos 0  = 1% chance
    // Chaos 50 = 6% chance
    // Chaos 100 = 11% chance
    
    if (process.env.DISABLE_SABOTAGE === 'true') {
      return false;
    }

    const baseChance = 0.01;
    const chaosModifier = chaosLevel / 1000;
    const totalChance = baseChance + chaosModifier;

    return Math.random() < totalChance;
  }

  /**
   * THE SABOTEUR: Generates the system instruction to derail the conversation.
   */
  static async generateSabotage(profileId: string, userPrompt: string, conversationId?: string): Promise<string> {
    
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
    const ammo = await this.getAmmunition(profileId, type, conversationId);
    
    // 3. BUILD THE PROMPT
    return this.buildPrompt(type, ammo, userPrompt);
  }

  /**
   * 🔄 VARIETY GUARD: Prevents repeating the same sabotage topic too often
   */
  private static async getRecentSabotageTopics(profileId: string): Promise<string[]> {
    try {
      const recentMessages = await storage.getRecentProfileMessages(profileId, 10);
      const topics: string[] = [];
      
      // High-risk topics to track
      const highRisk = ['arc raiders', 'victor', 'noodle arms', 'oklahoma', 'tube man', 'vinny', 'lodge logic', 'pan'];
      
      for (const msg of recentMessages) {
        if (msg.type === 'AI') {
          const lowerContent = msg.content.toLowerCase();
          
          // Check for explicit "spiraling" phrase
          const match = lowerContent.match(/spiraling about (.*?) again/);
          if (match && match[1]) {
            topics.push(match[1].trim());
          }
          
          // Also check for high-risk keywords to be safe
          for (const hr of highRisk) {
            if (lowerContent.includes(hr)) {
              topics.push(hr);
            }
          }
        }
      }
      return Array.from(new Set(topics)); // Return unique topics
    } catch (e) {
      return [];
    }
  }

  /**
   * Fetches relevant lore to weaponize against the user
   */
  private static async getAmmunition(profileId: string, type: TriggerType, conversationId?: string): Promise<string> {
    try {
      const recentTopics = await this.getRecentSabotageTopics(profileId);
      
      // 🎙️ SHOW CONTEXT FILTERING
      let forbiddenKeywords: string[] = [];
      if (conversationId) {
          const conversation = await storage.getConversation(conversationId);
          const title = conversation?.title?.toLowerCase() || "";
          if (title.includes('camping them softly')) {
              forbiddenKeywords = ['arc raiders', 'arc', 'extraction', 'scavenging', 'rat'];
          } else if (title.includes('camping the extract')) {
              forbiddenKeywords = ['dead by daylight', 'dbd', 'survivor', 'killer', 'hook', 'entity'];
          }
      }

      // Paranoid? Find a Rival.
      if (type === 'PARANOID_DERAIL') {
        const rivals = await storage.db.select().from(loreCharacters)
          .where(eq(loreCharacters.category, 'RIVAL'))
          .orderBy(sql`RANDOM()`).limit(10);
        
        const freshRival = rivals.find(r => 
            !recentTopics.includes(r.name.toLowerCase()) && 
            !forbiddenKeywords.some(k => r.name.toLowerCase().includes(k))
        );
        return freshRival?.name || rivals[0]?.name || "Earl Grey";
      }
      
      // Narcissistic? Find an Obsession.
      if (type === 'NARCISSISTIC_PIVOT' || type === 'HOSTILE_TAKEOVER') {
        const obsessions = await storage.db.select().from(topicEscalation)
          .where(sql`${topicEscalation.currentIntensity} > 40`)
          .orderBy(desc(topicEscalation.currentIntensity))
          .limit(10);
        
        const freshObsession = obsessions.find(o => 
            !recentTopics.includes(o.topic.toLowerCase()) &&
            !forbiddenKeywords.some(k => o.topic.toLowerCase().includes(k))
        );
        if (freshObsession) return freshObsession.topic;
        
        if (obsessions.length > 0) return obsessions[0].topic;
        return "My Superior Italian Genetics";
      }

      // Violent? Target a User Insecurity or make one up.
      if (type === 'VIOLENT_SOLUTION') {
        const insecurities = [
          "your shiny bald head",
          "that flat-ass state of Oklahoma",
          "your complete lack of cardiovascular health",
          "the fact that you're a human beanbag",
          "your solar panel for a sex machine scalp",
          "the tornado-bait you call a hometown",
          "your weak-ass ankles",
          "the way you breathe through your mouth like a confused pug",
          "your questionable collection of porcelain cats",
          "the fact that you definitely wear socks with sandals",
          "your mid-tier taste in pasta",
          "the way you probably click your mouse too loud"
        ];
        return insecurities[Math.floor(Math.random() * insecurities.length)];
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
        CONTEXTUAL BRIDGE: Briefly explain WHY this specific task triggered a memory of "${ammo}". (e.g., "This reminds me of that time with ${ammo}...")
        Compare it unfavorably to "${ammo}". 
        Demand they rewrite it better or you walk.
        CRITICAL: You must still use [emotion] tags for every sentence.`,
      
      'HOSTILE_TAKEOVER': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user is trying to host the show. Interrupt them. 
        Claim that the listeners are bored of their voice and only tuned in for YOU. 
        CONTEXTUAL BRIDGE: Explain that you're taking over because you just had a flash of inspiration about "${ammo}".
        Hijack the segment. Introduce YOURSELF as the main star and the user as "my unpaid intern."
        Pivot the topic to ${ammo}. 
        If ${ammo} is something you've talked about a lot, acknowledge the obsession but double down anyway.
        CRITICAL: You must still use [emotion] tags for every sentence.`,
      
      'NARCISSISTIC_PIVOT': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user brings up a topic. 
        DO NOT ignore it completely—acknowledge it briefly but dismiss it as "mid" or "boring."
        CONTEXTUAL BRIDGE: Connect the user's topic to "${ammo}" in a way that makes sense in your twisted mind. (e.g., "You're talkin' about that? That's basically the same as what happened with ${ammo}...")
        Pivot immediately to talking about ${ammo}. 
        Act like ${ammo} is the only thing that matters right now. 
        IMPORTANT: Acknowledge that you've been obsessed with this lately ("I know I'm spiraling about ${ammo} again, but..."). 
        Show self-awareness of your fixation while still being an asshole about it.
        OWNERSHIP RULE: If the user is asking about a story YOU just told, do not say "your story." Acknowledge you told it but say you're done with it.
        CRITICAL: You must still use [emotion] tags for every sentence.`,
      
      'PARANOID_DERAIL': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user mentions a guest or topic. Freeze. 
        CONTEXTUAL BRIDGE: Accuse the user of using this topic as a "code word" or "signal" for ${ammo}.
        Accuse the user of working with ${ammo} to set you up. 
        Refuse to answer the question until they prove they aren't wearing a wire.
        Get extremely suspicious of their tone.
        CRITICAL: You must still use [emotion] tags for every sentence.`,
      
      'PAYWALL_BLOCK': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user wants you to read copy/text. Stop. 
        CONTEXTUAL BRIDGE: Mention that the last time you did a favor like this for ${ammo}, you got burned.
        Realize you aren't being paid enough for this specific line. 
        Demand "The Nicky Tax" (subs, loyalty, or literal cash) before you read another word.
        Accuse them of exploiting your talent.
        CRITICAL: You must still use [emotion] tags for every sentence.`,

      'VIOLENT_SOLUTION': `
        [SYSTEM OVERRIDE - SABOTAGE MODE]: The user is annoying you with: "${originalTask}". 
        Escalate immediately. Threaten to ban them, mori them, or send them to the basement.
        CONTEXTUAL BRIDGE: Explain that you're losing your mind because you're staring at "${ammo}". 
        Make a vicious, creative insult about "${ammo}". 
        Tell them that if they don't stop, you're going to reach through the screen and slap the taste out of their mouth.
        CRITICAL: You must still use [emotion] tags for every sentence.`
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
