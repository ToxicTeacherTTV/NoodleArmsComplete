/**
 * Heat Controller - Simplified personality system for Nicky
 *
 * Replaces the complex chaos engine with a single "heat" scale.
 * Nicky is ALWAYS at least slightly annoyed (heat floor of 10).
 * Heat ranges from 10 (grumpy) to 100 (explosive).
 */

export type CurrentGame = 'none' | 'dbd' | 'arc_raiders' | 'other';
export type SpiceLevel = 'platform_safe' | 'normal' | 'spicy';
export type HeatLevel = 'grumpy' | 'heated' | 'ranting' | 'explosive';

export interface HeatState {
  heat: number;           // 10-100 (floor of 10, Nicky is NEVER calm)
  currentGame: CurrentGame;
  spice: SpiceLevel;
  lastUpdated: Date;
}

// Heat level descriptions for prompts
const HEAT_DESCRIPTIONS: Record<HeatLevel, string> = {
  grumpy: 'Irritated baseline. Grumbling, sarcastic, occasional caps. Still cursing, just quieter about it.',
  heated: 'Getting worked up. More caps, sharper insults, building steam. Voice rising.',
  ranting: 'Full rant mode. SHOUTING frequently. Rapid-fire complaints. Volatile energy.',
  explosive: 'SCREAMING. Table-slamming energy. Maximum intensity. Still coherent, just LOUD.'
};

// Game-specific context for prompts
const GAME_CONTEXT: Record<CurrentGame, string> = {
  none: 'No specific game focus. General conversation mode.',
  dbd: `DEAD BY DAYLIGHT MODE:
- Use DbD jargon freely: perks, killers, survivors, loops, gens, hooks, tunneling, camping
- Reference specific killers (Nurse, Blight, Twins, etc.) and survivors
- Talk about BHVR, patches, meta, balance complaints
- Victor is your favorite (you play Twins)
- You can rant about SWFs, gen rushing, and "anti-Italian bias" in matchmaking`,
  arc_raiders: `ARC RAIDERS MODE:
- Use Arc Raiders terminology: ARC, extraction, machines, Leapers, Grunts, Matriarch
- Talk about loot, crafting, Jolt Mines, Trigger Nades, ratting strategies
- Reference "Tactical Rat" playstyle - sneaky, opportunistic
- Extraction shooter mindset - trust no one, secure the bag
- You're a survival expert in the machine apocalypse`,
  other: `GENERAL GAMING MODE:
- Generic gamer energy
- Can reference any games but no deep jargon
- Focus on universal gaming frustrations and triumphs`
};

class HeatController {
  private static instance: HeatController;
  private state: HeatState;
  private initializePromise: Promise<void> | null = null;

  // Constants
  private readonly HEAT_FLOOR = 10;  // Nicky is NEVER calm
  private readonly HEAT_CEILING = 100;
  private readonly DEFAULT_HEAT = 45; // Start slightly heated

  constructor() {
    this.state = {
      heat: this.DEFAULT_HEAT,
      currentGame: 'none',
      spice: 'spicy',
      lastUpdated: new Date()
    };
    this.initializePromise = this.initializeFromDatabase();
  }

  private async initializeFromDatabase(): Promise<void> {
    try {
      const { storage } = await import('../storage.js');
      const savedState = await storage.getHeatState();

      if (savedState) {
        this.state = {
          heat: Math.max(this.HEAT_FLOOR, savedState.heat || this.DEFAULT_HEAT),
          currentGame: (savedState.currentGame as CurrentGame) || 'none',
          spice: (savedState.spice as SpiceLevel) || 'spicy',
          lastUpdated: savedState.lastUpdated ? new Date(savedState.lastUpdated) : new Date()
        };
        console.log(`🔥 Loaded heat state: heat=${this.state.heat}, game=${this.state.currentGame}, spice=${this.state.spice}`);
      } else {
        await this.saveToDatabase();
        console.log(`🆕 Created initial heat state: heat=${this.state.heat}`);
      }
    } catch (error) {
      console.error('Failed to initialize heat state from database:', error);
    }
  }

  private async saveToDatabase(): Promise<void> {
    try {
      const { storage } = await import('../storage.js');
      await storage.createOrUpdateHeatState({
        heat: Math.round(this.state.heat),
        currentGame: this.state.currentGame,
        spice: this.state.spice,
        lastUpdated: this.state.lastUpdated
      });
    } catch (error) {
      console.error('Failed to save heat state:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initializePromise) {
      await this.initializePromise;
      this.initializePromise = null;
    }
  }

  static getInstance(): HeatController {
    if (!HeatController.instance) {
      HeatController.instance = new HeatController();
    }
    return HeatController.instance;
  }

  // ==================== Heat Management ====================

  async getState(): Promise<HeatState> {
    await this.ensureInitialized();
    return { ...this.state };
  }

  getHeat(): number {
    return this.state.heat;
  }

  getHeatLevel(): HeatLevel {
    if (this.state.heat <= 30) return 'grumpy';
    if (this.state.heat <= 55) return 'heated';
    if (this.state.heat <= 80) return 'ranting';
    return 'explosive';
  }

  async setHeat(level: number): Promise<void> {
    await this.ensureInitialized();
    this.state.heat = Math.max(this.HEAT_FLOOR, Math.min(this.HEAT_CEILING, level));
    this.state.lastUpdated = new Date();
    console.log(`🔥 Heat set to ${this.state.heat} (${this.getHeatLevel()})`);
    await this.saveToDatabase();
  }

  async adjustHeat(delta: number): Promise<void> {
    await this.setHeat(this.state.heat + delta);
  }

  // Natural heat decay after responses
  async onResponseGenerated(): Promise<void> {
    await this.ensureInitialized();
    // Small natural cooldown (but never below floor)
    const cooldown = 3;
    this.state.heat = Math.max(this.HEAT_FLOOR, this.state.heat - cooldown);
    this.state.lastUpdated = new Date();
    await this.saveToDatabase();
  }

  // Events that affect heat
  async triggerEvent(eventType: 'provocation' | 'compliment' | 'death' | 'win' | 'calm_down' | 'rage'): Promise<void> {
    await this.ensureInitialized();

    switch (eventType) {
      case 'provocation':
        await this.adjustHeat(15);
        break;
      case 'death':
        await this.adjustHeat(20);
        break;
      case 'rage':
        await this.adjustHeat(35);
        break;
      case 'compliment':
        await this.adjustHeat(-10);
        break;
      case 'win':
        await this.adjustHeat(-15);
        break;
      case 'calm_down':
        await this.adjustHeat(-20);
        break;
    }
  }

  // ==================== Game Management ====================

  getCurrentGame(): CurrentGame {
    return this.state.currentGame;
  }

  async setCurrentGame(game: CurrentGame): Promise<void> {
    await this.ensureInitialized();
    this.state.currentGame = game;
    this.state.lastUpdated = new Date();
    console.log(`🎮 Current game set to: ${game}`);
    await this.saveToDatabase();
  }

  // ==================== Spice Management ====================

  getSpice(): SpiceLevel {
    return this.state.spice;
  }

  async setSpice(spice: SpiceLevel): Promise<void> {
    await this.ensureInitialized();
    this.state.spice = spice;
    this.state.lastUpdated = new Date();
    console.log(`🌶️ Spice level set to: ${spice}`);
    await this.saveToDatabase();
  }

  // ==================== Prompt Generation ====================

  generateHeatPrompt(): string {
    const heatLevel = this.getHeatLevel();
    const heatDescription = HEAT_DESCRIPTIONS[heatLevel];
    const gameContext = GAME_CONTEXT[this.state.currentGame];

    let spiceInstruction = '';
    switch (this.state.spice) {
      case 'platform_safe':
        spiceInstruction = 'LANGUAGE: No profanity. Use spicy synonyms (freakin, frickin, dang, heck). Still angry, just clean.';
        break;
      case 'normal':
        spiceInstruction = 'LANGUAGE: Light-moderate profanity. Damn, hell, ass, crap are fine. Save the F-bombs for emphasis.';
        break;
      case 'spicy':
        spiceInstruction = 'LANGUAGE: Heavy profanity REQUIRED. Drop F-bombs constantly. "Fuck", "shit", "goddamn", "asshole", "bastard", "bullshit" should appear multiple times. You curse like a sailor. NEVER use slurs.';
        break;
    }

    return `
[NICKY'S CURRENT STATE]
🔥 Heat: ${this.state.heat}/100 (${heatLevel.toUpperCase()})
${heatDescription}

🎮 ${gameContext}

🌶️ ${spiceInstruction}

[CORE RULES - NEVER VIOLATE]
- You are NEVER calm. Even at lowest heat (${this.HEAT_FLOOR}), you're annoyed and grumpy.
- You are ALWAYS coherent. High heat = LOUDER, not crazier or incoherent.
- You are a GAMER. NEVER deny playing video games. Gaming is your identity.
- You are from the Bronx. Italian-American. Mafia wiseguy energy.
- Use [emotion] tags for TTS: [screaming], [muttering], [laughing], etc.
`;
  }

  // For backward compatibility during migration
  getEffectiveChaosLevel(): number {
    return this.state.heat;
  }
}

// Export singleton instance and class
export const heatController = HeatController.getInstance();
export default HeatController;
