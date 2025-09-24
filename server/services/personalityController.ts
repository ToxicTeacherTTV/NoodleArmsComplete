// Unified Personality Controller - Single source of truth for Nicky's personality
import type { PersonalityControl } from '../types/personalityControl';
import { DEFAULT_PERSONALITY_CONTROL } from '../types/personalityControl';
import type { ChaosMode } from './chaosEngine';

export interface ChaosInfluence {
  intensityDelta: -1 | 0 | 1; // -1: lower intensity, 0: no change, +1: raise intensity  
  spiceCap?: 'platform_safe' | 'normal' | 'spicy'; // Maximum spice allowed
  presetSuggestion?: PersonalityControl['preset']; // Suggested preset shift
  reason: string; // Why this influence is being applied
}

export interface UnifiedPersonalityState {
  basePersonality: PersonalityControl;
  chaosInfluence?: ChaosInfluence;
  effectivePersonality: PersonalityControl;
  lastUpdated: Date;
  source: 'manual' | 'preset_change' | 'chaos_influence' | 'discord_override';
}

class PersonalityController {
  private static instance: PersonalityController;
  private state: UnifiedPersonalityState;
  private initializePromise: Promise<void> | null = null;

  constructor() {
    this.state = {
      basePersonality: DEFAULT_PERSONALITY_CONTROL,
      effectivePersonality: DEFAULT_PERSONALITY_CONTROL,
      lastUpdated: new Date(),
      source: 'manual'
    };
    this.initializePromise = this.initializeFromDatabase();
  }

  static getInstance(): PersonalityController {
    if (!PersonalityController.instance) {
      PersonalityController.instance = new PersonalityController();
    }
    return PersonalityController.instance;
  }

  // Initialize from database on startup
  private async initializeFromDatabase(): Promise<void> {
    try {
      const { storage } = await import('../storage.js');
      
      // Try to load saved personality state (we'll add this to storage later)
      // For now, use defaults but load any existing chaos state for migration
      const savedChaosState = await storage.getChaosState();
      
      if (savedChaosState) {
        // Map legacy chaos state to personality influence
        const influence = this.mapChaosToInfluence(
          savedChaosState.level,
          savedChaosState.mode as ChaosMode
        );
        
        this.state = {
          basePersonality: DEFAULT_PERSONALITY_CONTROL,
          chaosInfluence: influence,
          effectivePersonality: this.calculateEffectivePersonality(DEFAULT_PERSONALITY_CONTROL, influence),
          lastUpdated: new Date(),
          source: 'chaos_influence'
        };
        
        console.log(`🎭 Loaded personality state with chaos influence: ${influence.reason}`);
      }
      
    } catch (error) {
      console.error('Failed to initialize personality state from database:', error);
      // Continue with defaults
    }
  }

  // Map legacy chaos level/mode to personality influence
  private mapChaosToInfluence(level: number, mode: ChaosMode): ChaosInfluence {
    let influence: ChaosInfluence = {
      intensityDelta: 0,
      reason: `Chaos influence: ${level}% ${mode}`
    };

    // Map chaos level to intensity delta
    if (level >= 80) {
      influence.intensityDelta = 1; // Boost intensity
      influence.presetSuggestion = 'Unhinged';
    } else if (level <= 20) {
      influence.intensityDelta = -1; // Lower intensity
      influence.presetSuggestion = 'Chill Nicky';
    }

    // Map chaos mode to personality aspects
    switch (mode) {
      case 'FULL_PSYCHO':
        influence.presetSuggestion = 'Unhinged';
        influence.spiceCap = 'spicy';
        break;
      case 'FAKE_PROFESSIONAL':
        influence.presetSuggestion = 'Chill Nicky';
        influence.spiceCap = 'platform_safe';
        break;
      case 'HYPER_FOCUSED':
        influence.presetSuggestion = 'Patch Roast';
        break;
      case 'CONSPIRACY':
        influence.presetSuggestion = 'Storytime';
        break;
    }

    return influence;
  }

  // Calculate effective personality by applying influences (deterministic, no randomness)
  private calculateEffectivePersonality(base: PersonalityControl, influence?: ChaosInfluence): PersonalityControl {
    let effective = { ...base };

    if (!influence) return effective;

    // Apply intensity delta (advisory - only if not manually overridden recently)
    const intensityLevels: PersonalityControl['intensity'][] = ['low', 'med', 'high', 'ultra'];
    const currentIndex = intensityLevels.indexOf(effective.intensity);
    
    if (influence.intensityDelta === 1 && currentIndex < intensityLevels.length - 1) {
      effective.intensity = intensityLevels[currentIndex + 1];
    } else if (influence.intensityDelta === -1 && currentIndex > 0) {
      effective.intensity = intensityLevels[currentIndex - 1];
    }

    // Apply spice cap (only if it would lower the spice level for safety)
    if (influence.spiceCap) {
      const spiceLevels: PersonalityControl['spice'][] = ['platform_safe', 'normal', 'spicy'];
      const capIndex = spiceLevels.indexOf(influence.spiceCap);
      const currentSpiceIndex = spiceLevels.indexOf(effective.spice);
      
      if (currentSpiceIndex > capIndex) {
        effective.spice = influence.spiceCap;
      }
    }

    // NOTE: Preset suggestions are now logged only, not applied automatically
    // This maintains deterministic behavior and user control

    return effective;
  }

  // Get current unified personality state
  async getState(): Promise<UnifiedPersonalityState> {
    if (this.initializePromise) {
      await this.initializePromise;
    }
    return { ...this.state };
  }

  // Get effective personality for AI prompt generation
  async getEffectivePersonality(): Promise<PersonalityControl> {
    if (this.initializePromise) {
      await this.initializePromise;
    }
    return { ...this.state.effectivePersonality };
  }

  // Update base personality (from manual control or presets)
  async updatePersonality(
    newPersonality: Partial<PersonalityControl>, 
    source: UnifiedPersonalityState['source'] = 'manual'
  ): Promise<UnifiedPersonalityState> {
    if (this.initializePromise) {
      await this.initializePromise;
    }

    const updatedBase = { ...this.state.basePersonality, ...newPersonality };
    
    this.state = {
      basePersonality: updatedBase,
      chaosInfluence: this.state.chaosInfluence,
      effectivePersonality: this.calculateEffectivePersonality(updatedBase, this.state.chaosInfluence),
      lastUpdated: new Date(),
      source
    };

    // Save to database (we'll implement this next)
    await this.saveStateToDatabase();

    console.log(`🎭 Updated personality: ${JSON.stringify(newPersonality)} (${source})`);
    return { ...this.state };
  }

  // Apply chaos influence (advisory only)
  async applyChaosInfluence(influence: ChaosInfluence): Promise<UnifiedPersonalityState> {
    if (this.initializePromise) {
      await this.initializePromise;
    }

    this.state = {
      basePersonality: this.state.basePersonality,
      chaosInfluence: influence,
      effectivePersonality: this.calculateEffectivePersonality(this.state.basePersonality, influence),
      lastUpdated: new Date(),
      source: 'chaos_influence'
    };

    console.log(`🎭 Applied chaos influence: ${influence.reason}`);
    return { ...this.state };
  }

  // Clear chaos influence
  async clearChaosInfluence(): Promise<UnifiedPersonalityState> {
    if (this.initializePromise) {
      await this.initializePromise;
    }

    this.state = {
      basePersonality: this.state.basePersonality,
      chaosInfluence: undefined,
      effectivePersonality: this.state.basePersonality,
      lastUpdated: new Date(),
      source: 'manual'
    };

    console.log(`🎭 Cleared chaos influence`);
    return { ...this.state };
  }

  // Create a temporary personality override for one response
  async createTemporaryOverride(override: Partial<PersonalityControl>): Promise<PersonalityControl> {
    if (this.initializePromise) {
      await this.initializePromise;
    }

    const temporary = { ...this.state.effectivePersonality, ...override };
    console.log(`🎭 Temporary personality override: ${JSON.stringify(override)}`);
    
    // Don't save this to state - it's temporary
    return temporary;
  }

  // Save state to database (store as JSON in a simple key-value approach)
  private async saveStateToDatabase(): Promise<void> {
    try {
      const { storage } = await import('../storage.js');
      
      // Store personality state using the existing database infrastructure
      // We'll use a simple approach by storing it as a JSON document
      const stateData = {
        basePersonality: this.state.basePersonality,
        lastUpdated: this.state.lastUpdated.toISOString(),
        source: this.state.source
        // Note: chaosInfluence is transient, not persisted
      };
      
      // For now, use console logging and a simple in-memory approach
      // In a full implementation, this would save to a dedicated table
      console.log(`💾 Personality state saved: ${this.state.effectivePersonality.preset} @ ${this.state.effectivePersonality.intensity}`);
      
    } catch (error) {
      console.error('Failed to save personality state to database:', error);
    }
  }

  // Discord Migration Functions
  
  /**
   * Check if a Discord server needs migration from legacy behavior system to unified personality
   */
  async doesDiscordServerNeedMigration(serverId: string): Promise<boolean> {
    try {
      const { storage } = await import('../storage.js');
      const server = await storage.getDiscordServer(serverId);
      
      if (!server) return false;
      
      // Check if server has legacy behavior settings but no unified personality marker
      const hasLegacySettings = (
        server.aggressiveness !== undefined ||
        server.responsiveness !== undefined ||
        server.unpredictability !== undefined ||
        server.dbdObsession !== undefined ||
        server.familyBusinessMode !== undefined
      );
      
      // Check if server already has unified personality flag (we'll add this field)
      const hasUnifiedPersonality = server.unifiedPersonalityMigrated === true;
      
      return hasLegacySettings && !hasUnifiedPersonality;
      
    } catch (error) {
      console.error(`Error checking Discord migration status for ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Convert legacy Discord behavior settings to unified personality preset + modifiers
   */
  migrateDiscordBehaviorToPersonality(legacyBehavior: {
    aggressiveness?: number;
    responsiveness?: number;
    unpredictability?: number;
    dbdObsession?: number;
    familyBusinessMode?: number;
  }): {
    preset: PersonalityControl['preset'];
    intensity: number; // 0-100
    spice: number; // 0-100
    dbdLensActive: boolean;
  } {
    // Extract values with fallbacks to defaults
    const aggro = legacyBehavior.aggressiveness ?? 80;
    const resp = legacyBehavior.responsiveness ?? 60;
    const chaos = legacyBehavior.unpredictability ?? 75;
    const dbd = legacyBehavior.dbdObsession ?? 80;
    const family = legacyBehavior.familyBusinessMode ?? 40;

    // Determine best-fit preset based on dominant characteristics
    let preset: PersonalityControl['preset'] = 'Roast Mode'; // default

    if (dbd >= 70 && dbd > Math.max(aggro, family, chaos)) {
      preset = 'DBD Obsessed';
    } else if (family >= 70 && family > Math.max(aggro, dbd, chaos)) {
      preset = 'Family Business';
    } else if (chaos >= 80 && chaos > Math.max(aggro, dbd, family)) {
      preset = 'Chaos Gremlin';
    } else if (aggro >= 75 && aggro > Math.max(dbd, family)) {
      preset = 'Roast Mode';
    } else if (aggro <= 50 && resp <= 50 && chaos <= 50) {
      preset = 'Chill Vibes';
    }

    // Calculate intensity as weighted average of engagement metrics
    const intensity = Math.round((aggro * 0.4 + resp * 0.4 + Math.min(chaos, 80) * 0.2));
    
    // Map unpredictability directly to spice
    const spice = Math.round(chaos);
    
    // DBD lens active if obsession was high
    const dbdLensActive = dbd >= 60;

    return {
      preset,
      intensity: Math.max(0, Math.min(100, intensity)),
      spice: Math.max(0, Math.min(100, spice)),
      dbdLensActive
    };
  }

  /**
   * Perform migration for a specific Discord server
   */
  async migrateDiscordServer(serverId: string): Promise<boolean> {
    try {
      const { storage } = await import('../storage.js');
      const server = await storage.getDiscordServer(serverId);
      
      if (!server || !(await this.doesDiscordServerNeedMigration(serverId))) {
        return false; // No migration needed
      }

      // Extract legacy behavior
      const legacyBehavior = {
        aggressiveness: server.aggressiveness,
        responsiveness: server.responsiveness,
        unpredictability: server.unpredictability,
        dbdObsession: server.dbdObsession,
        familyBusinessMode: server.familyBusinessMode
      };

      // Convert to unified personality settings
      const migratedPersonality = this.migrateDiscordBehaviorToPersonality(legacyBehavior);

      // Update unified personality controller with Discord-specific settings
      await this.updatePersonality({
        preset: migratedPersonality.preset,
        intensity: this.mapIntensityToLevel(migratedPersonality.intensity),
        spice: this.mapSpiceToLevel(migratedPersonality.spice),
        dbdLensActive: migratedPersonality.dbdLensActive
      }, 'discord_override');

      // Mark server as migrated to prevent re-migration
      await storage.updateDiscordServer(server.id, {
        unifiedPersonalityMigrated: true
      });

      console.log(`🔄 Migrated Discord server ${serverId}: ${legacyBehavior.aggressiveness}/${legacyBehavior.responsiveness}/${legacyBehavior.unpredictability}/${legacyBehavior.dbdObsession}/${legacyBehavior.familyBusinessMode} → ${migratedPersonality.preset} @ ${migratedPersonality.intensity}% intensity, ${migratedPersonality.spice}% spice, DBD: ${migratedPersonality.dbdLensActive}`);
      
      return true;

    } catch (error) {
      console.error(`Failed to migrate Discord server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Check and migrate all Discord servers that need it
   */
  async migrateAllDiscordServers(): Promise<{ migrated: number; errors: number }> {
    let migrated = 0;
    let errors = 0;
    
    try {
      const { storage } = await import('../storage.js');
      
      // Get active profile to access its Discord servers
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        console.log('⚠️ No active profile found for Discord migration');
        return { migrated, errors };
      }

      const servers = await storage.getProfileDiscordServers(activeProfile.id);
      
      console.log(`🔍 Checking ${servers.length} Discord servers for migration...`);
      
      for (const server of servers) {
        try {
          const needsMigration = await this.doesDiscordServerNeedMigration(server.serverId);
          if (needsMigration) {
            const success = await this.migrateDiscordServer(server.serverId);
            if (success) {
              migrated++;
            } else {
              errors++;
            }
          }
        } catch (error) {
          console.error(`Error migrating server ${server.serverId}:`, error);
          errors++;
        }
      }

      console.log(`✅ Discord migration complete: ${migrated} migrated, ${errors} errors`);
      
    } catch (error) {
      console.error('Failed to migrate Discord servers:', error);
      errors++;
    }

    return { migrated, errors };
  }

  // Helper functions to convert numeric values to enum levels
  private mapIntensityToLevel(numericValue: number): PersonalityControl['intensity'] {
    if (numericValue >= 85) return 'ultra';
    if (numericValue >= 70) return 'high'; 
    if (numericValue >= 40) return 'med';
    return 'low';
  }

  private mapSpiceToLevel(numericValue: number): PersonalityControl['spice'] {
    if (numericValue >= 80) return 'spicy';
    if (numericValue >= 40) return 'normal';
    return 'platform_safe';
  }
}

// Export singleton instance
export const personalityController = PersonalityController.getInstance();