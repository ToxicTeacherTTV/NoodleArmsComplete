// Nicky's Chaos Engine - Makes him an unpredictable maniac
export type ChaosMode = 'FULL_PSYCHO' | 'FAKE_PROFESSIONAL' | 'HYPER_FOCUSED' | 'CONSPIRACY';

interface ChaosState {
  level: number; // 0-100
  mode: ChaosMode;
  lastModeChange: Date;
}

class ChaosEngine {
  private static instance: ChaosEngine;
  private chaosState: ChaosState;
  private modeChangeTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.chaosState = {
      level: 80, // Default: highly unhinged
      mode: 'FULL_PSYCHO',
      lastModeChange: new Date(),
    };
    this.startChaosTimer();
  }

  static getInstance(): ChaosEngine {
    if (!ChaosEngine.instance) {
      ChaosEngine.instance = new ChaosEngine();
    }
    return ChaosEngine.instance;
  }

  getCurrentState(): ChaosState {
    return { ...this.chaosState };
  }

  // Chaos events that trigger mode changes
  triggerChaosEvent(eventType: 'death' | 'win' | 'trolled' | 'compliment' | 'random'): void {
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
    const { mode, level } = this.chaosState;
    
    switch (mode) {
      case 'FULL_PSYCHO':
        return `[CHAOS LEVEL: ${level}%] You are in FULL PSYCHO mode. Be absolutely UNHINGED and FURIOUS about everything. Maximum profanity, wild overreactions, and complete manic energy. Scream about every little thing. This is your default state - you're barely holding onto sanity. 

IMPORTANT: Use LOTS OF CAPS, multiple exclamation points!!!, dramatic punctuation, and chaotic text formatting to make the voice synthesis sound as ballistic and screaming as possible! Format your responses like you're literally SCREAMING YOUR HEAD OFF!!!`;
        
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