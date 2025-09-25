/**
 * QuerySignalExtractor - Analyzes query intent for web search decision making
 * Detects novelty patterns, temporal intent, and entity mentions
 */

export interface QuerySignals {
  // Novelty indicators
  noveltyScore: number;        // 0-100, higher = more likely seeking new info
  noveltyPhrases: string[];    // Detected phrases like "have you heard", "new", etc.
  
  // Temporal indicators  
  temporalScore: number;       // 0-100, higher = more time-sensitive
  temporalCues: string[];      // "just", "recently", "today", etc.
  
  // Entity detection
  entityMentions: string[];    // Detected proper nouns/entities
  volatileDomains: string[];   // Domains known for frequent updates
  
  // Query type
  questionType: 'factual' | 'opinion' | 'update' | 'comparison' | 'general';
  isInformationSeeking: boolean;
  
  // Overall scores
  freshnessPriority: number;   // 0-100, combined score for freshness need
  searchRecommendation: 'skip' | 'supplement' | 'prioritize';
}

export class QuerySignalExtractor {
  
  // Novelty patterns that suggest seeking new/recent information
  private readonly NOVELTY_PATTERNS = [
    // Direct novelty questions
    { pattern: /have you heard/i, weight: 0.9 },
    { pattern: /did you know/i, weight: 0.7 },
    { pattern: /are you aware/i, weight: 0.8 },
    
    // New content indicators
    { pattern: /\b(new|newest|latest|recent|just released|just announced)\b/i, weight: 0.8 },
    { pattern: /\b(updated|patched|changed|modified)\b/i, weight: 0.7 },
    
    // Progressive/recent actions  
    { pattern: /\b(just|recently|now|currently)\b/i, weight: 0.6 },
    { pattern: /\b(they just|just put|just added|just came out)\b/i, weight: 0.9 },
    
    // Comparative recency
    { pattern: /\b(still|anymore|now vs|compared to now)\b/i, weight: 0.5 }
  ];

  // Temporal cues indicating time-sensitive queries
  private readonly TEMPORAL_PATTERNS = [
    { pattern: /\b(today|this week|this month|this year)\b/i, weight: 1.0 },
    { pattern: /\b(now|currently|at the moment|right now)\b/i, weight: 0.9 },
    { pattern: /\b(lately|recently|these days|nowadays)\b/i, weight: 0.8 },
    { pattern: /\b(since|after|following)\b/i, weight: 0.6 }
  ];

  // Volatile domains that frequently have updates
  private readonly VOLATILE_DOMAINS = [
    'gaming', 'games', 'video games', 'entertainment', 'movies', 'tv shows',
    'technology', 'tech', 'software', 'apps', 'social media',
    'news', 'politics', 'sports', 'weather', 'stocks', 'crypto',
    'celebrities', 'influencers', 'streamers', 'content creators'
  ];

  // Domain-specific keywords for classification
  private readonly DOMAIN_KEYWORDS = {
    gaming: ['game', 'games', 'gaming', 'player', 'killer', 'survivor', 'patch', 'update', 'dlc', 'character', 'meta', 'nerf', 'buff'],
    entertainment: ['movie', 'film', 'show', 'series', 'actor', 'actress', 'director', 'trailer', 'release', 'episode'],
    technology: ['app', 'software', 'platform', 'device', 'tech', 'ai', 'algorithm', 'update', 'version'],
    news: ['breaking', 'reported', 'announced', 'confirmed', 'sources', 'according to']
  };

  /**
   * Extract signals from a query string
   */
  extractSignals(query: string): QuerySignals {
    const queryLower = query.toLowerCase();
    
    // Analyze novelty patterns
    const noveltyAnalysis = this.analyzeNovelty(query);
    
    // Analyze temporal patterns
    const temporalAnalysis = this.analyzeTemporal(query);
    
    // Extract entity mentions (simple noun detection)
    const entityMentions = this.extractEntities(query);
    
    // Classify volatile domains
    const volatileDomains = this.classifyVolatileDomains(queryLower);
    
    // Determine question type
    const questionType = this.classifyQuestionType(queryLower);
    
    // Calculate combined freshness priority
    const freshnessPriority = this.calculateFreshnessPriority(
      noveltyAnalysis.score,
      temporalAnalysis.score,
      volatileDomains.length > 0,
      questionType
    );
    
    // Generate search recommendation
    const searchRecommendation = this.generateSearchRecommendation(freshnessPriority, questionType);
    
    return {
      noveltyScore: noveltyAnalysis.score,
      noveltyPhrases: noveltyAnalysis.phrases,
      temporalScore: temporalAnalysis.score,
      temporalCues: temporalAnalysis.cues,
      entityMentions,
      volatileDomains,
      questionType,
      isInformationSeeking: this.isInformationSeekingQuery(queryLower),
      freshnessPriority,
      searchRecommendation
    };
  }

  /**
   * Analyze novelty patterns in query
   */
  private analyzeNovelty(query: string): { score: number; phrases: string[] } {
    let totalScore = 0;
    const detectedPhrases: string[] = [];
    
    for (const { pattern, weight } of this.NOVELTY_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        totalScore += weight * 100;
        detectedPhrases.push(match[0]);
      }
    }
    
    // Cap at 100 and normalize
    const score = Math.min(totalScore, 100);
    
    return { score, phrases: detectedPhrases };
  }

  /**
   * Analyze temporal patterns in query
   */
  private analyzeTemporal(query: string): { score: number; cues: string[] } {
    let totalScore = 0;
    const detectedCues: string[] = [];
    
    for (const { pattern, weight } of this.TEMPORAL_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        totalScore += weight * 100;
        detectedCues.push(match[0]);
      }
    }
    
    const score = Math.min(totalScore, 100);
    
    return { score, cues: detectedCues };
  }

  /**
   * Extract entity mentions (simple approach - capitalized words)
   */
  private extractEntities(query: string): string[] {
    // Simple entity extraction - find capitalized words
    const words = query.split(/\s+/);
    const entities: string[] = [];
    
    for (const word of words) {
      // Skip common words and look for proper nouns
      if (word.length > 2 && 
          /^[A-Z][a-zA-Z]+/.test(word) && 
          !['The', 'This', 'That', 'What', 'When', 'Where', 'Why', 'How'].includes(word)) {
        entities.push(word);
      }
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }

  /**
   * Classify which volatile domains the query relates to
   */
  private classifyVolatileDomains(queryLower: string): string[] {
    const domains: string[] = [];
    
    for (const [domain, keywords] of Object.entries(this.DOMAIN_KEYWORDS)) {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        domains.push(domain);
      }
    }
    
    return domains;
  }

  /**
   * Classify the type of question being asked
   */
  private classifyQuestionType(queryLower: string): QuerySignals['questionType'] {
    if (/\b(what is|who is|when did|where is|how many|define|explain)\b/.test(queryLower)) {
      return 'factual';
    }
    
    if (/\b(think|opinion|feel|prefer|better|worse|should)\b/.test(queryLower)) {
      return 'opinion';
    }
    
    if (/\b(update|change|new|latest|current|recent)\b/.test(queryLower)) {
      return 'update';
    }
    
    if (/\b(vs|versus|compared to|difference|better than)\b/.test(queryLower)) {
      return 'comparison';
    }
    
    return 'general';
  }

  /**
   * Determine if query is information-seeking
   */
  private isInformationSeekingQuery(queryLower: string): boolean {
    const questionWords = ['what', 'who', 'when', 'where', 'why', 'how', 'which'];
    const seekingPhrases = ['tell me', 'explain', 'describe', 'show me', 'i want to know'];
    
    return questionWords.some(word => queryLower.includes(word)) ||
           seekingPhrases.some(phrase => queryLower.includes(phrase)) ||
           queryLower.includes('?');
  }

  /**
   * Calculate combined freshness priority score
   */
  private calculateFreshnessPriority(
    noveltyScore: number,
    temporalScore: number, 
    hasVolatileDomain: boolean,
    questionType: QuerySignals['questionType']
  ): number {
    let priority = 0;
    
    // Base scores
    priority += noveltyScore * 0.4;  // 40% weight on novelty
    priority += temporalScore * 0.3; // 30% weight on temporal cues
    
    // Domain volatility boost
    if (hasVolatileDomain) {
      priority += 20; // +20 for volatile domains
    }
    
    // Question type modifiers
    switch (questionType) {
      case 'update':
        priority += 15;
        break;
      case 'factual':
        priority += 5;
        break;
      case 'comparison':
        priority += 10;
        break;
    }
    
    return Math.min(priority, 100);
  }

  /**
   * Generate search recommendation based on signals
   */
  private generateSearchRecommendation(
    freshnessPriority: number,
    questionType: QuerySignals['questionType']
  ): QuerySignals['searchRecommendation'] {
    
    if (freshnessPriority >= 70 || questionType === 'update') {
      return 'prioritize'; // Force web search
    }
    
    if (freshnessPriority >= 40) {
      return 'supplement'; // Combine memory + web search
    }
    
    return 'skip'; // Memory-only is fine
  }
}

// Export singleton instance
export const querySignalExtractor = new QuerySignalExtractor();