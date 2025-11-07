/**
 * Context Pre-Warming Service
 * Pre-loads heavy, static context data on server startup to eliminate wait time
 * Optimized for single-profile usage - keeps data in memory indefinitely
 */

import { MemoryAnalyzer } from './memoryAnalyzer';

interface PrewarmedContext {
  trainingExamples: any[];
  podcastMemories: any[];
  loreContext: any;
  timestamp: number;
  profileId: string;
}

class ContextPrewarmer {
  private cache: PrewarmedContext | null = null;
  private isWarming = false;

  /**
   * Pre-warm context data for a profile
   * Loads training examples, podcast memories, and lore context
   */
  async warmContext(profileId: string, storage: any): Promise<void> {
    if (this.isWarming) {
      console.log('⏳ Context warming already in progress, skipping...');
      return;
    }

    try {
      this.isWarming = true;
      console.log(`🔥 Pre-warming context for profile: ${profileId}`);
      const startTime = Date.now();

      // Load everything in parallel
      const [trainingExamples, podcastMemories, loreContext] = await Promise.all([
        storage.getTrainingExamples(profileId), // Get all training examples
        storage.getPodcastAwareMemories(profileId, 'CHAT', 8), // 🚀 REDUCED: Get 8 podcast memories (was 15)
        MemoryAnalyzer.getEnhancedLoreContext(profileId) // Get lore context
      ]);

      this.cache = {
        trainingExamples,
        podcastMemories,
        loreContext,
        timestamp: Date.now(),
        profileId
      };

      const loadTime = Date.now() - startTime;
      console.log(`🔥 Context pre-warmed successfully in ${loadTime}ms:`);
      console.log(`   📚 ${trainingExamples.length} training examples`);
      console.log(`   🎙️ ${podcastMemories.length} podcast memories`);
      console.log(`   📖 Lore context loaded`);
      console.log(`   💾 Cache size: ~${this.estimateCacheSize()}MB`);

    } catch (error) {
      console.error('❌ Failed to pre-warm context:', error);
      this.cache = null;
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Get pre-warmed training examples
   * Returns cached data if available, otherwise loads fresh
   */
  async getTrainingExamples(profileId: string, storage: any): Promise<any[]> {
    if (this.cache && this.cache.profileId === profileId) {
      console.log(`⚡ Using pre-warmed training examples (${this.cache.trainingExamples.length} cached)`);
      return this.cache.trainingExamples;
    }

    // Cache miss - load fresh and warm for next time
    console.log('⚠️ Cache miss for training examples, loading fresh...');
    const examples = await storage.getTrainingExamples(profileId);
    
    // Don't block - warm cache in background for next request
    this.warmContext(profileId, storage).catch(err => 
      console.warn('Background cache warming failed:', err)
    );
    
    return examples;
  }

  /**
   * Get pre-warmed podcast memories
   * Returns cached data if available, otherwise loads fresh
   */
  async getPodcastMemories(profileId: string, storage: any, mode: string): Promise<any[]> {
    if (this.cache && this.cache.profileId === profileId) {
      console.log(`⚡ Using pre-warmed podcast memories (${this.cache.podcastMemories.length} cached)`);
      return this.cache.podcastMemories;
    }

    // Cache miss - load fresh and warm for next time
    console.log('⚠️ Cache miss for podcast memories, loading fresh...');
    const memories = await storage.getPodcastAwareMemories(profileId, mode, 8);  // 🚀 REDUCED: 15→8
    
    // Don't block - warm cache in background for next request
    this.warmContext(profileId, storage).catch(err => 
      console.warn('Background cache warming failed:', err)
    );
    
    return memories;
  }

  /**
   * Get pre-warmed lore context
   * Returns cached data if available, otherwise loads fresh
   */
  async getLoreContext(profileId: string, storage: any): Promise<any> {
    if (this.cache && this.cache.profileId === profileId) {
      console.log(`⚡ Using pre-warmed lore context`);
      return this.cache.loreContext;
    }

    // Cache miss - load fresh and warm for next time
    console.log('⚠️ Cache miss for lore context, loading fresh...');
    const lore = await MemoryAnalyzer.getEnhancedLoreContext(profileId);
    
    // Don't block - warm cache in background for next request
    this.warmContext(profileId, storage).catch(err => 
      console.warn('Background cache warming failed:', err)
    );
    
    return lore;
  }

  /**
   * Manually refresh the cache
   * Use this after adding/editing training examples or lore
   */
  async refresh(profileId: string, storage: any): Promise<void> {
    console.log('🔄 Manual cache refresh requested');
    this.cache = null; // Clear cache
    await this.warmContext(profileId, storage);
  }

  /**
   * Clear the cache
   */
  clear(): void {
    console.log('🗑️ Clearing pre-warmed context cache');
    this.cache = null;
  }

  /**
   * Get cache stats
   */
  getStats() {
    if (!this.cache) {
      return {
        warmed: false,
        profileId: null,
        timestamp: null,
        age: null,
        size: 0
      };
    }

    const age = Date.now() - this.cache.timestamp;
    return {
      warmed: true,
      profileId: this.cache.profileId,
      timestamp: new Date(this.cache.timestamp).toISOString(),
      age: `${Math.round(age / 1000)}s`,
      size: this.estimateCacheSize(),
      trainingExamples: this.cache.trainingExamples.length,
      podcastMemories: this.cache.podcastMemories.length,
      hasLoreContext: !!this.cache.loreContext
    };
  }

  /**
   * Estimate cache size in MB
   */
  private estimateCacheSize(): number {
    if (!this.cache) return 0;
    
    const jsonSize = JSON.stringify(this.cache).length;
    return Math.round((jsonSize / 1024 / 1024) * 100) / 100; // MB with 2 decimals
  }
}

// Singleton instance
export const contextPrewarmer = new ContextPrewarmer();
