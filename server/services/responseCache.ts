/**
 * Response Cache Service
 * Caches AI responses for frequently asked questions to reduce latency and API costs
 * Particularly useful for STREAMING mode where speed is critical
 */

interface CachedResponse {
  response: string;
  timestamp: number;
  useCount: number;
  mode: string;
}

class ResponseCache {
  private cache = new Map<string, CachedResponse>();
  private readonly TTL = 1000 * 60 * 30; // 30 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  /**
   * Generate normalized cache key from message
   * Removes punctuation, extra spaces, lowercases for fuzzy matching
   */
  getCacheKey(message: string, mode: string, profileId: string, preset: string = 'default'): string {
    // Normalize the message
    const normalized = message
      .toLowerCase()
      .trim()
      .replace(/[?.!,;:'"]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/^(hey|yo|sup|hi|hello|nicky)\s+/i, '') // Remove greetings
      .substring(0, 200); // Limit length for cache key
    
    return `${mode}:${profileId}:${preset}:${normalized}`;
  }

  /**
   * Get cached response if available and fresh
   */
  async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Check if expired
    const age = Date.now() - cached.timestamp;
    if (age > this.TTL) {
      this.cache.delete(key);
      console.log(`🗑️  Cache expired for key: ${key.substring(0, 50)}...`);
      return null;
    }
    
    // Update use count
    cached.useCount++;
    console.log(`💾 Cache HIT (${cached.useCount} uses, age: ${Math.round(age/1000)}s): ${key.substring(0, 80)}...`);
    
    return cached.response;
  }

  /**
   * Store response in cache
   */
  set(key: string, response: string, mode: string): void {
    // Don't cache very short responses (likely errors or acknowledgments)
    if (response.length < 20) {
      return;
    }
    
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      useCount: 1,
      mode
    });
    
    console.log(`💾 Cached response (${response.length} chars): ${key.substring(0, 80)}...`);
    
    // Enforce max cache size - evict least recently used
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }
  }

  /**
   * Check if a message should be cached based on patterns
   */
  shouldCache(message: string, mode: string): boolean {
    // Only cache for STREAMING mode (speed critical)
    if (mode !== 'STREAMING') {
      return false;
    }
    
    // Cache common question patterns
    const cacheablePatterns = [
      /^who (is|are)/i,
      /^what (is|are|does|do)/i,
      /^when (did|does|do)/i,
      /^where (is|are|does)/i,
      /^why (is|are|does|do)/i,
      /^how (do|does|did)/i,
      /tell me about/i,
      /explain/i,
      /what's your (opinion|take|thought)/i,
    ];
    
    return cacheablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 10%
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    console.log(`🗑️  Cache eviction: removed ${toRemove} oldest entries (${this.cache.size} remaining)`);
  }

  /**
   * Clear all cached responses
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️  Cache cleared: ${size} entries removed`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
    mostUsed: Array<{ key: string; uses: number }>;
  } {
    const entries = Array.from(this.cache.entries());
    
    const totalUses = entries.reduce((sum, [, value]) => sum + value.useCount, 0);
    const totalRequests = totalUses + entries.length; // Approximate
    const hitRate = totalRequests > 0 ? (totalUses / totalRequests) * 100 : 0;
    
    const mostUsed = entries
      .map(([key, value]) => ({ key: key.substring(0, 80), uses: value.useCount }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 10);
    
    return {
      size: this.cache.size,
      hitRate: Math.round(hitRate),
      mostUsed
    };
  }
}

// Global singleton instance
export const responseCache = new ResponseCache();

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const before = responseCache.getStats().size;
  const cache = (responseCache as any).cache as Map<string, CachedResponse>;
  const ttl = (responseCache as any).TTL as number;
  
  Array.from(cache.entries()).forEach(([key, value]) => {
    const age = Date.now() - value.timestamp;
    if (age > ttl) {
      cache.delete(key);
    }
  });
  
  const after = responseCache.getStats().size;
  if (before !== after) {
    console.log(`🗑️  Cache cleanup: ${before - after} expired entries removed`);
  }
}, 10 * 60 * 1000);

// Log cache stats every 30 minutes
setInterval(() => {
  const stats = responseCache.getStats();
  if (stats.size > 0) {
    console.log(`📊 Response Cache Stats: ${stats.size} entries, ${stats.hitRate}% hit rate`);
    if (stats.mostUsed.length > 0) {
      console.log(`   Top questions:`, stats.mostUsed.slice(0, 3));
    }
  }
}, 30 * 60 * 1000);
