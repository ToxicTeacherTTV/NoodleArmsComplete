import fetch from 'node-fetch';

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  publishDate?: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
  searchTime: number;
}

class WebSearchService {
  private cache = new Map<string, { data: SearchResponse; timestamp: number }>();
  private readonly CACHE_TTL = 1000 * 60 * 30; // 30 minutes
  private readonly MAX_RESULTS = 8;
  private rateLimitDelay = 0;
  private lastRequestTime = 0;

  constructor() {
    console.log('🔍 Web Search Service initialized');
  }

  /**
   * Main search function that tries multiple search strategies
   */
  async search(query: string): Promise<SearchResponse> {
    const startTime = Date.now();
    console.log(`🔍 Web search query: "${query}"`);

    // Check cache first
    const cached = this.getFromCache(query);
    if (cached) {
      console.log(`📚 Using cached result for: "${query}"`);
      return cached;
    }

    // Apply rate limiting
    await this.applyRateLimit();

    try {
      // Primary search: DuckDuckGo Instant Answer API (free, no key required)
      let results = await this.searchDuckDuckGo(query);
      
      // If DuckDuckGo doesn't return enough results, try web scraping approach
      if (results.length < 3) {
        console.log(`🔄 DuckDuckGo returned ${results.length} results, trying fallback...`);
        const fallbackResults = await this.searchFallback(query);
        results = [...results, ...fallbackResults].slice(0, this.MAX_RESULTS);
      }

      const response: SearchResponse = {
        results: results.slice(0, this.MAX_RESULTS),
        query,
        totalResults: results.length,
        searchTime: Date.now() - startTime
      };

      // Cache the result
      this.cache.set(query.toLowerCase(), {
        data: response,
        timestamp: Date.now()
      });

      console.log(`✅ Found ${response.results.length} results in ${response.searchTime}ms`);
      return response;

    } catch (error) {
      console.error('❌ Web search failed:', error);
      
      // Return empty results rather than throwing
      return {
        results: [],
        query,
        totalResults: 0,
        searchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Search using DuckDuckGo Instant Answer API
   */
  private async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    try {
      // DuckDuckGo Instant Answer API
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NickyAI/1.0)'
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const results: SearchResult[] = [];

      // Parse DuckDuckGo response
      if (data.Abstract && data.Abstract.length > 0) {
        results.push({
          title: data.Heading || query,
          snippet: data.Abstract,
          url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          score: 95
        });
      }

      // Add related topics
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 4).forEach((topic: any, index: number) => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || `Related: ${query}`,
              snippet: topic.Text,
              url: topic.FirstURL,
              score: 80 - (index * 5)
            });
          }
        });
      }

      return results;

    } catch (error) {
      console.warn('⚠️ DuckDuckGo search failed:', error);
      return [];
    }
  }

  /**
   * Fallback search using web scraping approach
   */
  private async searchFallback(query: string): Promise<SearchResult[]> {
    try {
      // Search Bing without API key using web interface
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'DNT': '1',
          'Connection': 'keep-alive',
        },
        timeout: 15000
      });

      if (!response.ok) {
        throw new Error(`Bing search failed: ${response.status}`);
      }

      const html = await response.text();
      return this.parseBingResults(html, query);

    } catch (error) {
      console.warn('⚠️ Fallback search failed:', error);
      return [];
    }
  }

  /**
   * Parse Bing search results from HTML
   */
  private parseBingResults(html: string, query: string): SearchResult[] {
    const results: SearchResult[] = [];

    try {
      // Simple regex patterns to extract search results
      const titlePattern = /<h2><a[^>]*href="([^"]*)"[^>]*>([^<]*)</g;
      const snippetPattern = /<p class="b_lineclamp[^>]*>([^<]*)</g;

      let titleMatch;
      let snippetIndex = 0;
      const snippets: string[] = [];

      // Extract snippets first
      let snippetMatch;
      while ((snippetMatch = snippetPattern.exec(html)) !== null && snippets.length < 10) {
        const snippet = snippetMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/<[^>]*>/g, '')
          .trim();
        
        if (snippet.length > 20) {
          snippets.push(snippet);
        }
      }

      // Extract titles and URLs
      while ((titleMatch = titlePattern.exec(html)) !== null && results.length < 6) {
        const url = titleMatch[1];
        const title = titleMatch[2]
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/<[^>]*>/g, '')
          .trim();

        // Skip if URL is not a proper web URL or is from Bing itself
        if (!url.startsWith('http') || url.includes('bing.com') || url.includes('microsoft.com')) {
          continue;
        }

        const snippet = snippets[snippetIndex] || `Information about ${query}`;
        snippetIndex++;

        results.push({
          title: title || `Result for ${query}`,
          snippet,
          url,
          score: 75 - (results.length * 5)
        });
      }

    } catch (error) {
      console.warn('⚠️ Error parsing Bing results:', error);
    }

    return results;
  }

  /**
   * Check if we should trigger web search based on existing context quality
   */
  shouldTriggerSearch(
    existingMemories: any[],
    query: string,
    averageConfidence: number
  ): boolean {
    // Always search if no relevant memories found
    if (existingMemories.length === 0) {
      return true;
    }

    // Search if confidence is very low
    if (averageConfidence < 60) {
      return true;
    }

    // Search for time-sensitive queries
    const timeSensitiveKeywords = [
      'today', 'current', 'latest', 'recent', 'now', 'this year', 
      'stock', 'price', 'news', 'weather', 'score'
    ];
    
    if (timeSensitiveKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    )) {
      return true;
    }

    // Search for factual questions that might need current info
    const factualKeywords = [
      'what is', 'who is', 'when did', 'where is', 'how many',
      'definition', 'meaning', 'explain', 'about'
    ];
    
    if (factualKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    ) && existingMemories.length < 3) {
      return true;
    }

    // 🎮 NEW: Search for DbD content that could be new/updated
    const dbdKeywords = ['dead by daylight', 'dbd', 'killer', 'survivor'];
    const newContentKeywords = ['new', 'just', 'added', 'released', 'update', 'patch', 'ptb'];
    
    const queryLower = query.toLowerCase();
    const hasDbdContent = dbdKeywords.some(keyword => queryLower.includes(keyword));
    const hasNewContent = newContentKeywords.some(keyword => queryLower.includes(keyword));
    
    // Always search for DbD queries about new content, regardless of memory confidence
    if (hasDbdContent && hasNewContent) {
      console.log(`🎮 Triggering web search for potential new DbD content: "${query}"`);
      return true;
    }
    
    // Also search for specific DbD entities that might be new (like Krasue)
    if (hasDbdContent && existingMemories.length < 5) {
      console.log(`🎮 Triggering web search for DbD query with limited memories: "${query}"`);
      return true;
    }

    return false;
  }

  /**
   * Cache management
   */
  private getFromCache(query: string): SearchResponse | null {
    const cached = this.cache.get(query.toLowerCase());
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    
    // Clean expired entries
    if (cached) {
      this.cache.delete(query.toLowerCase());
    }
    
    return null;
  }

  /**
   * Rate limiting to be respectful to search services
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Minimum 2 seconds between requests
    const minDelay = 2000;
    if (timeSinceLastRequest < minDelay) {
      const delay = minDelay - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Clear cache (for debugging)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Web search cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const webSearchService = new WebSearchService();