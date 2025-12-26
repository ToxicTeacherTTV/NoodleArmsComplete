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
   * Extract optimized search keywords from a question
   */
  private extractSearchKeywords(query: string): string {
    // Remove question words from the beginning
    const questionWords = /^(what|how|why|when|where|who|which|do|does|did|can|could|should|would|will|is|are|was|were|tell me|show me|explain|hey|hi)\s+/i;
    let cleanQuery = query.replace(questionWords, '').trim();
    
    // Remove common filler words but preserve proper nouns
    const words = cleanQuery.split(/\s+/);
    const fillerWords = new Set(['about', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'you', 'me', 'know', 'like', 'do', 'does']);
    
    const importantWords = words.filter(word => {
      const lower = word.toLowerCase();
      // Keep if: it's capitalized (proper noun), or it's not a filler word, or it's long enough
      return /^[A-Z]/.test(word) || !fillerWords.has(lower) || word.length > 5;
    });
    
    cleanQuery = importantWords.join(' ').trim();
    
    // If query is still too long (>8 words), prioritize proper nouns and longer terms
    if (importantWords.length > 8) {
      const prioritized = importantWords
        .sort((a, b) => {
          const aScore = (/^[A-Z]/.test(a) ? 20 : 0) + a.length;
          const bScore = (/^[A-Z]/.test(b) ? 20 : 0) + b.length;
          return bScore - aScore;
        })
        .slice(0, 8);
      cleanQuery = prioritized.join(' ');
    }
    
    // Clean up multiple spaces
    cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();
    
    return cleanQuery || query; // Fallback to original if cleaning removed everything
  }

  /**
   * Main search function that tries multiple search strategies
   */
  async search(query: string): Promise<SearchResponse> {
    const startTime = Date.now();
    
    // Extract optimized search keywords
    let searchQuery = this.extractSearchKeywords(query);
    
    // 🛡️ AMBIGUITY PROTECTION: If query is just "Nicky", add character context to avoid Nicki Minaj results
    const lowerSearch = searchQuery.toLowerCase();
    if (lowerSearch === 'nicky' || lowerSearch === 'who is nicky' || lowerSearch === 'nicky ai') {
      searchQuery = 'Nicky "Noodle Arms" A.I. Dente Dead by Daylight';
      console.log(`🛡️ Ambiguity protection: Updated query to "${searchQuery}"`);
    }

    console.log(`🔍 Web search query: "${query}" → optimized: "${searchQuery}"`);

    // Check cache first (use optimized query for cache key)
    const cached = this.getFromCache(searchQuery);
    if (cached) {
      console.log(`📚 Using cached result for: "${searchQuery}"`);
      return cached;
    }

    // Apply rate limiting
    await this.applyRateLimit();

    try {
      let results: SearchResult[] = [];
      
      // 🔑 NEW: Try SerpApi first if API key is available
      const serpApiKey = process.env.SERPAPI_API_KEY;
      if (serpApiKey) {
        console.log('🔑 Using SerpApi for web search');
        results = await this.searchSerpApi(searchQuery, serpApiKey);
      }
      
      // Fallback to DuckDuckGo if SerpApi fails or no key
      if (results.length === 0) {
        console.log('🦆 Falling back to DuckDuckGo search');
        results = await this.searchDuckDuckGo(searchQuery);
        
        // If DuckDuckGo doesn't return enough results, try web scraping approach
        if (results.length < 3) {
          console.log(`🔄 DuckDuckGo returned ${results.length} results, trying fallback...`);
          const fallbackResults = await this.searchFallback(searchQuery);
          results = [...results, ...fallbackResults].slice(0, this.MAX_RESULTS);
        }
      }

      const response: SearchResponse = {
        results: results.slice(0, this.MAX_RESULTS),
        query: searchQuery,
        totalResults: results.length,
        searchTime: Date.now() - startTime
      };

      // Cache the result
      this.cache.set(searchQuery.toLowerCase(), {
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
   * Search using SerpApi (Google search)
   */
  private async searchSerpApi(query: string, apiKey: string): Promise<SearchResult[]> {
    try {
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=8`;
      
      const response = await fetch(url, {
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`SerpApi error: ${response.status}`);
      }

      const data = await response.json() as any;
      const results: SearchResult[] = [];

      // Parse organic results
      if (data.organic_results && Array.isArray(data.organic_results)) {
        data.organic_results.slice(0, this.MAX_RESULTS).forEach((result: any, index: number) => {
          if (result.link && result.title) {
            results.push({
              title: result.title,
              snippet: result.snippet || result.displayed_link || '',
              url: result.link,
              score: 100 - (index * 5)
            });
          }
        });
      }

      // Also check knowledge graph if available
      if (data.knowledge_graph && data.knowledge_graph.description && results.length < 3) {
        results.unshift({
          title: data.knowledge_graph.title || query,
          snippet: data.knowledge_graph.description,
          url: data.knowledge_graph.website || data.knowledge_graph.source?.link || `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          score: 100
        });
      }

      console.log(`🔑 SerpApi returned ${results.length} results`);
      return results;

    } catch (error) {
      console.warn('⚠️ SerpApi search failed:', error);
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
   * Now uses intelligent signal extraction rather than hardcoded keywords
   */
  async shouldTriggerSearch(
    existingMemories: any[],
    query: string,
    averageConfidence: number
  ): Promise<boolean> {
    // Import and use the query signal extractor for intelligent analysis
    const { querySignalExtractor } = await import('./querySignalExtractor.js');
    const signals = querySignalExtractor.extractSignals(query);
    
    // 🛑 CRITICAL: Never search for simple greetings or conversational filler
    if (signals.questionType === 'conversational' as any) {
      console.log(`🚫 Skipping web search: Conversational query detected ("${query}")`);
      return false;
    }

    // Always search if no relevant memories found AND it's information seeking
    if (existingMemories.length === 0 && signals.isInformationSeeking) {
      console.log(`🌐 Triggering search: No relevant memories found for information-seeking query`);
      return true;
    }

    // Search if confidence is very low AND it's information seeking
    if (averageConfidence < 60 && signals.isInformationSeeking) {
      console.log(`🌐 Triggering search: Low confidence (${averageConfidence}%) for information-seeking query`);
      return true;
    }
    
    // Log decision rationale for tuning
    console.log(`🧠 Query analysis: freshness=${signals.freshnessPriority}% novelty=${signals.noveltyScore}% temporal=${signals.temporalScore}% domains=[${signals.volatileDomains.join(',')}] type=${signals.questionType}`);
    
    // Use the intelligent recommendation
    if (signals.searchRecommendation === 'prioritize') {
      console.log(`🌐 Prioritizing web search due to high freshness signals: ${signals.noveltyPhrases.concat(signals.temporalCues).join(', ')}`);
      return true;
    }
    
    if (signals.searchRecommendation === 'supplement') {
      console.log(`🌐 Supplementing memory with web search (moderate freshness signals)`);
      return true;
    }
    
    // Legacy fallback for time-sensitive queries (in case signal extraction misses something)
    const timeSensitiveKeywords = [
      'today', 'current', 'latest', 'recent', 'now', 'this year', 
      'stock', 'price', 'news', 'weather', 'score'
    ];
    
    if (timeSensitiveKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    )) {
      console.log(`🌐 Legacy time-sensitive keyword match triggered search`);
      return true;
    }

    console.log(`🚫 Skipping web search: freshness priority ${signals.freshnessPriority}% below threshold`);
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