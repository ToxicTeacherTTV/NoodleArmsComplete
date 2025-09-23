import type { DiscordServer, EffectiveBehavior, BehaviorDrift, ContextNudge } from '@shared/schema';
import { storage } from '../storage';

export class BehaviorModulator {
  private static instance: BehaviorModulator;
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): BehaviorModulator {
    if (!this.instance) {
      this.instance = new BehaviorModulator();
    }
    return this.instance;
  }

  /**
   * Calculate effective behavior values for a Discord server
   * Combines baseline + chaos mode + drift + context nudges
   */
  async getEffectiveBehavior(serverId: string): Promise<EffectiveBehavior> {
    const server = await storage.getDiscordServer(serverId);
    if (!server) {
      throw new Error('Discord server not found');
    }

    // Get current drift state
    const drift = await this.calculateDrift(server);
    
    // Get chaos mode multiplier
    const chaosMultiplier = await this.getChaosMultiplier();
    
    // Get time-based modulation
    const timeOfDayFactor = this.getTimeOfDayModulation();
    
    // Apply context nudges
    const contextNudges = this.parseContextNudges(server.contextNudges);
    const activeNudges = this.getActiveNudges(contextNudges);
    
    // Calculate effective values (clamped 0-100)
    const effective = {
      aggressiveness: this.clamp(
        ((server.aggressiveness || 80) + drift.aggressiveness) * chaosMultiplier.aggressiveness + 
        timeOfDayFactor.aggressiveness + activeNudges.aggressiveness
      ),
      responsiveness: this.clamp(
        ((server.responsiveness || 60) + drift.responsiveness) * chaosMultiplier.responsiveness + 
        timeOfDayFactor.responsiveness + activeNudges.responsiveness
      ),
      unpredictability: this.clamp(
        ((server.unpredictability || 75) + drift.unpredictability) * chaosMultiplier.unpredictability + 
        timeOfDayFactor.unpredictability + activeNudges.unpredictability
      ),
      dbdObsession: this.clamp(
        ((server.dbdObsession || 80) + drift.dbdObsession) * chaosMultiplier.dbdObsession + 
        timeOfDayFactor.dbdObsession + activeNudges.dbdObsession
      ),
      familyBusinessMode: this.clamp(
        ((server.familyBusinessMode || 40) + drift.familyBusinessMode) * chaosMultiplier.familyBusinessMode + 
        timeOfDayFactor.familyBusinessMode + activeNudges.familyBusinessMode
      ),
      lastUpdated: new Date().toISOString(),
      driftFactors: {
        timeOfDay: timeOfDayFactor.aggressiveness, // Representative
        recentActivity: activeNudges.responsiveness, // Representative
        chaosMultiplier: chaosMultiplier.aggressiveness, // Representative
      }
    };

    return effective;
  }

  /**
   * Calculate bounded random walk drift for a server
   */
  private async calculateDrift(server: DiscordServer): Promise<BehaviorDrift> {
    const now = new Date();
    const lastUpdate = server.lastDriftUpdate || server.createdAt || now;
    const minutesSinceUpdate = (now.getTime() - new Date(lastUpdate).getTime()) / (1000 * 60);
    
    // Only update drift every 2-5 minutes to avoid jitter
    if (minutesSinceUpdate < 2) {
      return this.parseDriftMomentum(server.driftMomentum);
    }

    const currentDrift = this.parseDriftMomentum(server.driftMomentum);
    const steps = Math.floor(minutesSinceUpdate / 2); // 2-minute intervals
    
    // Bounded random walk with momentum (EWMA smoothing)
    const newDrift = {
      aggressiveness: this.boundedWalk(currentDrift.aggressiveness, steps, 15), // ±15 max drift
      responsiveness: this.boundedWalk(currentDrift.responsiveness, steps, 20), // ±20 max drift  
      unpredictability: this.boundedWalk(currentDrift.unpredictability, steps, 10), // ±10 max drift
      dbdObsession: this.boundedWalk(currentDrift.dbdObsession, steps, 15), // ±15 max drift
      familyBusinessMode: this.boundedWalk(currentDrift.familyBusinessMode, steps, 25), // ±25 max drift
    };

    // Update server drift state
    await storage.updateDiscordServer(server.id, {
      driftMomentum: newDrift,
      lastDriftUpdate: now,
    });

    return newDrift;
  }

  /**
   * Bounded random walk with momentum
   */
  private boundedWalk(current: number, steps: number, maxBound: number): number {
    let value = current;
    
    for (let i = 0; i < steps; i++) {
      // Random step ±0-3 points
      const step = (Math.random() - 0.5) * 6;
      
      // Apply momentum (EWMA with α=0.3)
      value = 0.7 * value + 0.3 * (value + step);
      
      // Bound within [-maxBound, +maxBound]
      value = Math.max(-maxBound, Math.min(maxBound, value));
    }
    
    return value;
  }

  /**
   * Get chaos mode multipliers
   */
  private async getChaosMultiplier(): Promise<BehaviorDrift> {
    try {
      // Get active profile to access chaos state
      const profile = await storage.getActiveProfile();
      const mode = profile?.chaosMode || 'CONTROLLED';
      
      switch (mode) {
        case 'FULL_PSYCHO':
          return {
            aggressiveness: 1.2, // +20% aggression
            responsiveness: 1.1, // +10% responsiveness
            unpredictability: 1.15, // +15% chaos
            dbdObsession: 1.1, // +10% DBD
            familyBusinessMode: 1.0, // No change
          };
        case 'FAKE_PROFESSIONAL':
          return {
            aggressiveness: 0.7, // -30% aggression
            responsiveness: 0.7, // -30% responsiveness  
            unpredictability: 0.7, // -30% chaos
            dbdObsession: 0.8, // -20% DBD
            familyBusinessMode: 1.2, // +20% business mode
          };
        case 'HYPER_FOCUSED':
          return {
            aggressiveness: 1.0,
            responsiveness: 1.3, // +30% when mentioned
            unpredictability: 0.9,
            dbdObsession: 1.2, // +20% focus on DBD
            familyBusinessMode: 0.8,
          };
        case 'CONSPIRACY':
          return {
            aggressiveness: 1.1,
            responsiveness: 0.9,
            unpredictability: 1.0,
            dbdObsession: 0.7, // -30% DBD, more conspiracy
            familyBusinessMode: 1.3, // +30% family business paranoia
          };
        default: // CONTROLLED
          return {
            aggressiveness: 1.0,
            responsiveness: 1.0,
            unpredictability: 1.0,
            dbdObsession: 1.0,
            familyBusinessMode: 1.0,
          };
      }
    } catch (error) {
      console.error('Failed to get chaos state:', error);
      return { aggressiveness: 1.0, responsiveness: 1.0, unpredictability: 1.0, dbdObsession: 1.0, familyBusinessMode: 1.0 };
    }
  }

  /**
   * Time-of-day modulation (evenings = more active)
   */
  private getTimeOfDayModulation(): BehaviorDrift {
    const hour = new Date().getHours();
    
    // Evening hours (6PM-11PM) = more active
    if (hour >= 18 && hour <= 23) {
      return {
        aggressiveness: 5, // +5 points in evening
        responsiveness: 10, // +10 points in evening
        unpredictability: 3,
        dbdObsession: 5,
        familyBusinessMode: 2,
      };
    }
    
    // Late night/early morning (12AM-6AM) = less active
    if (hour >= 0 && hour <= 6) {
      return {
        aggressiveness: -3,
        responsiveness: -8, // -8 points late night
        unpredictability: -2,
        dbdObsession: -3,
        familyBusinessMode: 1, // Family never sleeps
      };
    }
    
    // Daytime = normal
    return {
      aggressiveness: 0,
      responsiveness: 0,
      unpredictability: 0,
      dbdObsession: 0,
      familyBusinessMode: 0,
    };
  }

  /**
   * Add context nudge (temporary boost/reduction)
   */
  async addContextNudge(serverId: string, nudge: ContextNudge): Promise<void> {
    const server = await storage.getDiscordServer(serverId);
    if (!server) return;

    const currentNudges = this.parseContextNudges(server.contextNudges);
    currentNudges.push(nudge);
    
    await storage.updateDiscordServer(server.id, {
      contextNudges: currentNudges,
    });
  }

  /**
   * Start automatic drift updates for a server
   */
  startDriftUpdates(serverId: string): void {
    // Clear existing interval
    this.stopDriftUpdates(serverId);
    
    // Update every 2 minutes
    const interval = setInterval(async () => {
      try {
        await this.getEffectiveBehavior(serverId); // This triggers drift calculation
      } catch (error) {
        console.error(`Failed to update drift for server ${serverId}:`, error);
      }
    }, 2 * 60 * 1000); // 2 minutes
    
    this.updateIntervals.set(serverId, interval);
  }

  /**
   * Stop automatic drift updates for a server
   */
  stopDriftUpdates(serverId: string): void {
    const interval = this.updateIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(serverId);
    }
  }

  // Helper methods
  private clamp(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private parseDriftMomentum(driftData: any): BehaviorDrift {
    if (typeof driftData === 'object' && driftData !== null) {
      return {
        aggressiveness: driftData.aggressiveness || 0,
        responsiveness: driftData.responsiveness || 0,
        unpredictability: driftData.unpredictability || 0,
        dbdObsession: driftData.dbdObsession || 0,
        familyBusinessMode: driftData.familyBusinessMode || 0,
      };
    }
    return { aggressiveness: 0, responsiveness: 0, unpredictability: 0, dbdObsession: 0, familyBusinessMode: 0 };
  }

  private parseContextNudges(nudgeData: any): ContextNudge[] {
    if (Array.isArray(nudgeData)) {
      return nudgeData.filter(n => n && typeof n === 'object');
    }
    return [];
  }

  private getActiveNudges(nudges: ContextNudge[]): BehaviorDrift {
    const now = new Date();
    const activeNudges = nudges.filter(n => new Date(n.expiresAt) > now);
    
    return activeNudges.reduce((sum, nudge) => ({
      aggressiveness: sum.aggressiveness + (nudge.type === 'mention_burst' ? nudge.strength : 0),
      responsiveness: sum.responsiveness + (nudge.type === 'mention_burst' ? nudge.strength * 1.5 : 0),
      unpredictability: sum.unpredictability + (nudge.type === 'keyword_trigger' ? nudge.strength : 0),
      dbdObsession: sum.dbdObsession + (nudge.type === 'keyword_trigger' ? nudge.strength : 0),
      familyBusinessMode: sum.familyBusinessMode + (nudge.type === 'moderation_flag' ? -nudge.strength : 0),
    }), { aggressiveness: 0, responsiveness: 0, unpredictability: 0, dbdObsession: 0, familyBusinessMode: 0 });
  }
}

export const behaviorModulator = BehaviorModulator.getInstance();