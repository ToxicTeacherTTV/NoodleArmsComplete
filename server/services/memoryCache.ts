/**
 * LRU (Least Recently Used) Cache for Memory Entries
 * Reduces database queries by caching frequently accessed memories
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export class MemoryCache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttlMs: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 500, ttlMinutes: number = 30) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.timestamp = now; // Refresh timestamp on access
    this.hits++;
    
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    // If cache is full, evict least recently used
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  /**
   * Check if key exists in cache (without counting as hit/miss)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) / 100 : 0
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }
}

// Global memory caches with different TTLs
export const memoryCaches = {
  // Hot cache for recently accessed memories (5 min TTL, 1000 entries)
  hot: new MemoryCache(1000, 5),
  
  // Warm cache for frequently accessed memories (30 min TTL, 500 entries)
  warm: new MemoryCache(500, 30),
  
  // Cold cache for profile-wide memory sets (60 min TTL, 100 entries)
  cold: new MemoryCache(100, 60),
};

// Cleanup expired entries every 5 minutes
setInterval(() => {
  memoryCaches.hot.cleanup();
  memoryCaches.warm.cleanup();
  memoryCaches.cold.cleanup();
}, 5 * 60 * 1000);

// Log cache stats every 10 minutes
setInterval(() => {
  const hotStats = memoryCaches.hot.getStats();
  const warmStats = memoryCaches.warm.getStats();
  const coldStats = memoryCaches.cold.getStats();
  
  console.log(`📊 Memory Cache Stats:`);
  console.log(`   Hot:  ${hotStats.size} entries, ${hotStats.hitRate}% hit rate (${hotStats.hits}/${hotStats.hits + hotStats.misses})`);
  console.log(`   Warm: ${warmStats.size} entries, ${warmStats.hitRate}% hit rate (${warmStats.hits}/${warmStats.hits + warmStats.misses})`);
  console.log(`   Cold: ${coldStats.size} entries, ${coldStats.hitRate}% hit rate (${coldStats.hits}/${coldStats.hits + coldStats.misses})`);
}, 10 * 60 * 1000);
