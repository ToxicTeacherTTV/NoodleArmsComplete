import { personalityController } from './personalityController.js';
import type { PersonalityControl } from '../types/personalityControl.js';
import { storage } from '../storage.js';
import { geminiService } from './gemini.js';

interface IntrusiveThought {
  thought: string;
  trigger: string;
  intensity: 'mild' | 'moderate' | 'chaotic';
  timing: 'immediate' | 'delayed' | 'random';
}

class IntrusiveThoughts {
  private static instance: IntrusiveThoughts;
  private lastIntrusionTime: number = 0;
  private cooldownPeriod: number = 30000; // 30 seconds minimum between intrusions

  private readonly thoughtTriggers = [
    { pattern: /\b(boring|dull|tired)\b/i, response: "Yo, you know what's NOT boring? The time I accidentally started a food truck war in Newark..." },
    { pattern: /\b(money|cash|broke)\b/i, response: "Speaking of money, did I ever tell you about my cousin Vinny's 'investment opportunities'? Guy could sell ice to an Eskimo..." },
    { pattern: /\b(food|eat|hungry)\b/i, response: "Food? Oh man, that reminds me of this sandwich place in Little Italy - they put PROSCIUTTO on everything. Even the cannoli!" },
    { pattern: /\b(work|job|boss)\b/i, response: "Work schmork - you know what real work is? Trying to explain to my ma why I can't just 'get a nice job at the post office like your cousin Tony'..." },
    { pattern: /\b(dead|kill|murder|DbD)\b/i, response: "Whoa whoa, that's some dark stuff! Speaking of dark, you ever been chased by a maniac with a chainsaw? No? Just me then..." },
    { pattern: /\b(love|relationship|dating)\b/i, response: "Love? Fuhgeddaboutit! Last time I fell in love, she turned out to be collecting my soul for some entity called 'The Entity'. True story!" },
    { pattern: /\b(family|mother|father|parent)\b/i, response: "Family... don't get me started on family. My ma still thinks I'm 'going through a phase' because I keep talking about killers and trials..." }
  ];

  constructor() {
    // No need to store personalityController, we'll use the singleton directly
  }

  static getInstance(): IntrusiveThoughts {
    if (!IntrusiveThoughts.instance) {
      IntrusiveThoughts.instance = new IntrusiveThoughts();
    }
    return IntrusiveThoughts.instance;
  }

  // Main method: Check if we should inject an intrusive thought
  async shouldInjectThought(userMessage: string, conversationId?: string): Promise<IntrusiveThought | null> {
    const now = Date.now();
    
    // Respect cooldown period
    if (now - this.lastIntrusionTime < this.cooldownPeriod) {
      return null;
    }

    const personality = await personalityController.getEffectivePersonality();
    
    // Calculate injection probability based on personality
    const baseChance = this.calculateInjectionChance(personality);
    const triggerMatch = this.findTrigger(userMessage);
    
    // If no trigger found and low base chance, skip
    if (!triggerMatch && Math.random() > baseChance) {
      return null;
    }

    // Higher chance if we found a trigger
    const finalChance = triggerMatch ? baseChance * 3 : baseChance;
    
    if (Math.random() > finalChance) {
      return null;
    }

    this.lastIntrusionTime = now;
    
    // Generate the intrusive thought
    return this.generateThought(userMessage, triggerMatch, personality, conversationId);
  }

  private calculateInjectionChance(personality: PersonalityControl): number {
    // Base chance starts low
    let chance = 0.05; // 5% base
    
    // Increase based on personality intensity
    const intensity = personality.intensity || 'med';
    const intensityMultiplier = {
      'low': 0.1,
      'med': 0.3, 
      'high': 0.6,
      'ultra': 1.0
    }[intensity];
    chance += intensityMultiplier * 0.15; // Up to +15%
    
    // Increase based on spice level
    switch (personality.spice) {
      case 'platform_safe': chance += 0.02; break;
      case 'normal': chance += 0.05; break;
      case 'spicy': chance += 0.15; break;
    }
    
    // Personality preset modifiers
    switch (personality.preset) {
      case 'Unhinged': chance += 0.20; break;
      case 'Roast Mode': chance += 0.10; break;
      case 'Caller War': chance += 0.15; break;
      case 'Chill Nicky': chance -= 0.10; break;
    }
    
    return Math.max(0, Math.min(chance, 0.4)); // Cap at 40%
  }

  private findTrigger(message: string): { pattern: RegExp; response: string } | null {
    return this.thoughtTriggers.find(trigger => trigger.pattern.test(message)) || null;
  }

  private async generateThought(
    userMessage: string, 
    trigger: { pattern: RegExp; response: string } | null, 
    personality: PersonalityControl,
    conversationId?: string
  ): Promise<IntrusiveThought> {
    
    let thought: string;
    
    if (trigger) {
      // Use predefined trigger response
      thought = trigger.response;
    } else {
      // Generate contextual intrusive thought
      thought = await this.generateContextualThought(userMessage, personality, conversationId);
    }
    
    return {
      thought,
      trigger: trigger ? trigger.pattern.source : 'random',
      intensity: this.getIntensityLevel(personality),
      timing: 'immediate'
    };
  }

  private async generateContextualThought(
    userMessage: string,
    personality: PersonalityControl,
    conversationId?: string
  ): Promise<string> {
    try {
      // Get some recent memories for context
      const memories = await storage.searchMemoriesByKeywords(conversationId || '', ['nicky', 'story', 'newark'], 3);
      const memoryContext = memories.map((m: any) => m.content).join(' ');
      
      // Generate a short, contextual interruption
      const prompt = `You are Nicky, interrupting with a random thought. Keep it under 100 characters.
      
User just said: "${userMessage}"
      Your background: ${memoryContext}
      
Respond with a sudden, random thought that pops into your head. Start with something like "Oh! Speaking of..." or "Wait, that reminds me..." or "Yo, random thought but..."`;
      
      const response = await geminiService.generateChatResponse(userMessage, `You are Nicky "Noodle Arms" A.I. Dente, interrupting with a random thought. Keep it under 100 characters. Your background: ${memoryContext}`, "Respond with a sudden, random thought that pops into your head. Start with something like 'Oh! Speaking of...' or 'Wait, that reminds me...' or 'Yo, random thought but...'");
      return response.content || "Yo, random thought but... never mind, what were we talking about?";
      
    } catch (error) {
      console.error('Failed to generate contextual thought:', error);
      // Fallback to random thought
      const fallbacks = [
        "Wait, did I ever tell you about the time I got stuck in a locker for 3 hours?",
        "Random thought: Why do they call it 'rush hour' when nobody's moving?",
        "Yo, speaking of nothing - my cousin Sal once ate 47 meatballs in one sitting...",
        "Hold up, I just remembered I left my keys in that trial realm again..."
      ];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }

  private getIntensityLevel(personality: PersonalityControl): 'mild' | 'moderate' | 'chaotic' {
    const intensity = personality.intensity || 'med';
    const spice = personality.spice || 'normal';
    
    if (intensity === 'ultra' || spice === 'spicy') return 'chaotic';
    if (intensity === 'high' || spice === 'normal') return 'moderate';
    return 'mild';
  }

  // Reset cooldown (for testing or manual override)
  resetCooldown(): void {
    this.lastIntrusionTime = 0;
  }
  
  // Update cooldown period
  setCooldownPeriod(milliseconds: number): void {
    this.cooldownPeriod = Math.max(5000, milliseconds); // Minimum 5 seconds
  }
}

export const intrusiveThoughts = IntrusiveThoughts.getInstance();
export default IntrusiveThoughts;
