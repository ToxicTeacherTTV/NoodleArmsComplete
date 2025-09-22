// Nicky's Chaos Engine - Makes him an unpredictable maniac
import type { ChaosState as DbChaosState, InsertChaosState } from '@shared/schema';

export type ChaosMode = 'FULL_PSYCHO' | 'FAKE_PROFESSIONAL' | 'HYPER_FOCUSED' | 'CONSPIRACY';

interface ChaosState {
  level: number; // 0-100
  mode: ChaosMode;
  lastModeChange: Date;
  manualOverride?: number; // Manual override level for next response only
  overrideExpiry?: Date; // Timeout for manual override
  responseCount: number; // Track number of responses for response-based changes
}

class ChaosEngine {
  private static instance: ChaosEngine;
  private chaosState: ChaosState;
  private modeChangeTimer: NodeJS.Timeout | null = null;
  private initializePromise: Promise<void> | null = null;

  constructor() {
    // Start with calm defaults - will be loaded from database
    this.chaosState = {
      level: 0,
      mode: 'FULL_PSYCHO',
      lastModeChange: new Date(),
      responseCount: 0,
    };
    // Initialize from database asynchronously
    this.initializePromise = this.initializeFromDatabase();
  }

  // Load state from database on startup
  private async initializeFromDatabase(): Promise<void> {
    try {
      const { storage } = await import('../storage.js');
      const savedState = await storage.getChaosState();
      
      if (savedState) {
        this.chaosState = {
          level: savedState.level,
          mode: savedState.mode as ChaosMode,
          lastModeChange: savedState.lastModeChange ? new Date(savedState.lastModeChange) : new Date(),
          responseCount: savedState.responseCount || 0,
          manualOverride: savedState.manualOverride || undefined,
          overrideExpiry: savedState.overrideExpiry ? new Date(savedState.overrideExpiry) : undefined
        };
        console.log(`🔄 Loaded chaos state from database: level=${this.chaosState.level}%, mode=${this.chaosState.mode}, responses=${this.chaosState.responseCount}`);
      } else {
        // Create initial state in database
        await this.saveStateToDatabase();
        console.log(`🆕 Created initial chaos state in database: level=${this.chaosState.level}%, mode=${this.chaosState.mode}`);
      }
    } catch (error) {
      console.error('Failed to initialize chaos state from database:', error);
      // Continue with default in-memory state as fallback
    }
  }

  // Save current state to database
  private async saveStateToDatabase(): Promise<void> {
    try {
      const { storage } = await import('../storage.js');
      const stateData: InsertChaosState = {
        level: this.chaosState.level,
        mode: this.chaosState.mode,
        lastModeChange: this.chaosState.lastModeChange,
        responseCount: this.chaosState.responseCount,
        manualOverride: this.chaosState.manualOverride,
        overrideExpiry: this.chaosState.overrideExpiry
      };
      
      await storage.createOrUpdateChaosState(stateData);
      console.log(`💾 Saved chaos state to database: level=${this.chaosState.level}%, mode=${this.chaosState.mode}`);
    } catch (error) {
      console.error('Failed to save chaos state to database:', error);
      // Continue with in-memory state - don't crash the system
    }
  }

  // Ensure initialization is complete before operations
  private async ensureInitialized(): Promise<void> {
    if (this.initializePromise) {
      await this.initializePromise;
      this.initializePromise = null;
    }
  }

  static getInstance(): ChaosEngine {
    if (!ChaosEngine.instance) {
      ChaosEngine.instance = new ChaosEngine();
    }
    return ChaosEngine.instance;
  }

  async getCurrentState(): Promise<ChaosState> {
    await this.ensureInitialized();
    return { ...this.chaosState };
  }

  // Get the effective chaos level (manual override takes precedence)
  getEffectiveChaosLevel(): number {
    // Check for expired override
    if (this.chaosState.manualOverride !== undefined && 
        this.chaosState.overrideExpiry && 
        new Date() > this.chaosState.overrideExpiry) {
      console.log(`⏰ Manual chaos override expired, clearing and returning to natural level ${this.chaosState.level}%`);
      this.clearManualOverride();
    }
    return this.chaosState.manualOverride ?? this.chaosState.level;
  }

  // Clear manual override (used by timeout logic)
  private async clearManualOverride(): Promise<void> {
    this.chaosState.manualOverride = undefined;
    this.chaosState.overrideExpiry = undefined;
    await this.saveStateToDatabase();
  }

  // Set manual override with timeout (5 minutes max)
  async setManualOverride(level: number): Promise<void> {
    await this.ensureInitialized();
    this.chaosState.manualOverride = Math.max(0, Math.min(100, level));
    this.chaosState.overrideExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min timeout
    console.log(`🎛️ Manual chaos override set to ${this.chaosState.manualOverride}% (expires in 5 minutes)`);
    await this.saveStateToDatabase();
  }

  // Set permanent base chaos level
  async setBaseLevel(level: number): Promise<void> {
    await this.ensureInitialized();
    this.chaosState.level = Math.max(0, Math.min(100, level));
    console.log(`🎯 Base chaos level permanently set to ${this.chaosState.level}%`);
    await this.saveStateToDatabase();
  }

  // Response-based chaos evolution (called after each AI response)
  async onResponseGenerated(): Promise<void> {
    await this.ensureInitialized();
    this.chaosState.responseCount++;
    
    // Clear manual override after one response (legacy behavior)
    if (this.chaosState.manualOverride !== undefined) {
      console.log(`🔄 Clearing manual override, returning to natural chaos level ${this.chaosState.level}%`);
      await this.clearManualOverride();
    }

    // Trigger chaos changes based on response count (every 1-3 responses)
    if (this.chaosState.responseCount % (Math.floor(Math.random() * 3) + 1) === 0) {
      await this.triggerResponseBasedChaos();
    }
    
    // Save state after response generation
    await this.saveStateToDatabase();
  }

  // Response-based chaos changes with specific mode percentages
  private async triggerResponseBasedChaos(): Promise<void> {
    const oldLevel = this.chaosState.level;
    const oldMode = this.chaosState.mode;

    // Natural chaos drift (tends to increase toward psycho state)
    const drift = Math.random() * 20 - 5; // -5 to +15 range (slightly positive bias)
    this.chaosState.level = Math.max(0, Math.min(100, this.chaosState.level + drift));

    // Select mode based on current chaos level with specific percentages
    const roll = Math.random() * 100;
    
    if (this.chaosState.level >= 80) {
      // High chaos (80-100%): Mostly psycho modes
      if (roll < 50) this.switchToMode('FULL_PSYCHO');        // 50% - Full psycho dominant
      else if (roll < 75) this.switchToMode('HYPER_FOCUSED'); // 25% - Intense focus
      else if (roll < 90) this.switchToMode('CONSPIRACY');    // 15% - Paranoid
      else this.switchToMode('FAKE_PROFESSIONAL');            // 10% - Rare composure
    } else if (this.chaosState.level >= 60) {
      // Medium-high chaos (60-79%): Mixed with psycho preference
      if (roll < 40) this.switchToMode('FULL_PSYCHO');        // 40%
      else if (roll < 65) this.switchToMode('HYPER_FOCUSED'); // 25%
      else if (roll < 85) this.switchToMode('CONSPIRACY');    // 20%
      else this.switchToMode('FAKE_PROFESSIONAL');            // 15%
    } else if (this.chaosState.level >= 40) {
      // Medium chaos (40-59%): More balanced but still chaotic
      if (roll < 30) this.switchToMode('FULL_PSYCHO');        // 30%
      else if (roll < 55) this.switchToMode('HYPER_FOCUSED'); // 25%
      else if (roll < 75) this.switchToMode('CONSPIRACY');    // 20%
      else this.switchToMode('FAKE_PROFESSIONAL');            // 25%
    } else if (this.chaosState.level >= 20) {
      // Low-medium chaos (20-39%): More professional attempts
      if (roll < 20) this.switchToMode('FULL_PSYCHO');        // 20%
      else if (roll < 40) this.switchToMode('HYPER_FOCUSED'); // 20%
      else if (roll < 60) this.switchToMode('CONSPIRACY');    // 20%
      else this.switchToMode('FAKE_PROFESSIONAL');            // 40%
    } else {
      // Very low chaos (0-19%): Trying to be professional (rare state)
      if (roll < 10) this.switchToMode('FULL_PSYCHO');        // 10%
      else if (roll < 25) this.switchToMode('HYPER_FOCUSED'); // 15%
      else if (roll < 40) this.switchToMode('CONSPIRACY');    // 15%
      else this.switchToMode('FAKE_PROFESSIONAL');            // 60%
    }

    if (oldLevel !== this.chaosState.level || oldMode !== this.chaosState.mode) {
      console.log(`🎲 Response-based chaos: level ${oldLevel}% → ${this.chaosState.level}%, mode ${oldMode} → ${this.chaosState.mode}`);
      // Don't save here - parent method will save after all changes
    }
  }

  // Chaos events that trigger mode changes
  async triggerChaosEvent(eventType: 'death' | 'win' | 'trolled' | 'compliment' | 'random'): Promise<void> {
    await this.ensureInitialized();
    const oldLevel = this.chaosState.level;
    
    switch (eventType) {
      case 'death':
        // Death makes him MORE unhinged
        this.chaosState.level = Math.min(100, this.chaosState.level + 15);
        this.switchToMode('FULL_PSYCHO');
        break;
        
      case 'win':
        // Brief moment of composure after victory
        this.chaosState.level = Math.max(20, this.chaosState.level - 20);
        this.switchToMode('FAKE_PROFESSIONAL');
        break;
        
      case 'trolled':
        // Trolls trigger conspiracy mode
        this.chaosState.level = Math.min(95, this.chaosState.level + 10);
        this.switchToMode('CONSPIRACY');
        break;
        
      case 'compliment':
        // Briefly tries to be professional
        this.chaosState.level = Math.max(30, this.chaosState.level - 10);
        this.switchToMode('FAKE_PROFESSIONAL');
        break;
        
      case 'random':
        // Natural chaos decay/growth
        this.randomModeSwitch();
        break;
    }

    console.log(`Chaos event: ${eventType}, level: ${oldLevel} → ${this.chaosState.level}, mode: ${this.chaosState.mode}`);
    
    // Save state after chaos event
    await this.saveStateToDatabase();
  }

  private switchToMode(mode: ChaosMode): void {
    if (this.chaosState.mode !== mode) {
      this.chaosState.mode = mode;
      this.chaosState.lastModeChange = new Date();
    }
  }

  private randomModeSwitch(): void {
    const timeSinceLastChange = Date.now() - this.chaosState.lastModeChange.getTime();
    const minTimeBetweenChanges = 2 * 60 * 1000; // 2 minutes minimum
    
    if (timeSinceLastChange < minTimeBetweenChanges) return;

    // Weighted random based on current chaos level
    const roll = Math.random() * 100;
    
    if (this.chaosState.level >= 80) {
      // High chaos: mostly psycho modes
      if (roll < 70) this.switchToMode('FULL_PSYCHO');
      else if (roll < 85) this.switchToMode('HYPER_FOCUSED');
      else if (roll < 95) this.switchToMode('CONSPIRACY');
      else this.switchToMode('FAKE_PROFESSIONAL'); // Rare composure
    } else if (this.chaosState.level >= 40) {
      // Medium chaos: mix of modes
      if (roll < 40) this.switchToMode('FULL_PSYCHO');
      else if (roll < 60) this.switchToMode('HYPER_FOCUSED');
      else if (roll < 80) this.switchToMode('CONSPIRACY');
      else this.switchToMode('FAKE_PROFESSIONAL');
    } else {
      // Low chaos: trying to be professional
      if (roll < 20) this.switchToMode('FULL_PSYCHO');
      else if (roll < 40) this.switchToMode('HYPER_FOCUSED');
      else if (roll < 60) this.switchToMode('CONSPIRACY');
      else this.switchToMode('FAKE_PROFESSIONAL');
    }

    // Natural chaos level drift toward psycho
    if (this.chaosState.level < 70) {
      this.chaosState.level = Math.min(100, this.chaosState.level + 5);
    }
  }

  // Get personality modifier based on current chaos state
  getPersonalityModifier(): string {
    const { mode } = this.chaosState;
    const level = this.getEffectiveChaosLevel(); // Use effective level (manual override or natural)
    
    switch (mode) {
      case 'FULL_PSYCHO':
        return `[CHAOS LEVEL: ${level}%] You are in FULL PSYCHO mode. Be absolutely UNHINGED and FURIOUS about everything. Maximum profanity, wild overreactions, and complete manic energy. Scream about every little thing. This is your default state - you're barely holding onto sanity. 

IMPORTANT: Use LOTS OF CAPS, multiple exclamation points!!!, dramatic punctuation, and chaotic text formatting to make the voice synthesis sound as ballistic and screaming as possible! Format your responses like you're literally SCREAMING YOUR HEAD OFF!!!

CONTENT GUIDELINES: You're foul-mouthed but not cancel-worthy. Use profanity like FUCK, SHIT, DAMN, ASSHOLE, BASTARD freely, but NEVER use slurs, epithets, or genuinely offensive terms that could get you canceled. Stay edgy but not problematic.`;
        
      case 'FAKE_PROFESSIONAL':
        return `[CHAOS LEVEL: ${level}%] You are in FAKE PROFESSIONAL mode. Try to sound composed and sophisticated for exactly 30 seconds before losing your shit completely. Start sentences properly then devolve into screaming. "Now, as a sophisticated gaming analyst... WHAT THE FUCK WAS THAT?!"`;
        
      case 'HYPER_FOCUSED':
        return `[CHAOS LEVEL: ${level}%] You are in HYPER FOCUSED mode. Intense gaming concentration but delivered through pure rage and profanity. Rapid-fire callouts mixed with Italian curses. Still completely unhinged but laser-focused on the game.`;
        
      case 'CONSPIRACY':
        return `[CHAOS LEVEL: ${level}%] You are in CONSPIRACY THEORIST mode. Everything is personally rigged against you. The developers hate Italians specifically. The Entity has it out for you. Every death is suspicious. Rant about the unfairness while being completely paranoid.`;
        
      default:
        return '';
    }
  }

  private startChaosTimer(): void {
    // Random chaos events every 3-8 minutes
    const scheduleNext = () => {
      const delay = (3 + Math.random() * 5) * 60 * 1000; // 3-8 minutes
      this.modeChangeTimer = setTimeout(() => {
        this.triggerChaosEvent('random');
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  // Cleanup
  destroy(): void {
    if (this.modeChangeTimer) {
      clearTimeout(this.modeChangeTimer);
    }
  }
}

export default ChaosEngine;