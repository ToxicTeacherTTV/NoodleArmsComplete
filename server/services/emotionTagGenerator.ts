import { anthropicService } from './anthropic.js';

interface EmotionTagContext {
  content: string;
  personality?: string;
  contentType: 'ad' | 'chat' | 'announcement' | 'voice_response';
  mood?: string;
  intensity?: 'low' | 'medium' | 'high';
}

interface EmotionTags {
  hook: string;
  body: string;
  cta: string;
}

interface CachedEmotionTag {
  tags: EmotionTags;
  timestamp: number;
  useCount: number;
}

class EmotionTagGenerator {
  private cache = new Map<string, CachedEmotionTag>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 500;

  /**
   * Generate contextual emotion tags using AI
   */
  async generateEmotionTags(context: EmotionTagContext): Promise<EmotionTags> {
    // Create cache key from context
    const cacheKey = this.createCacheKey(context);
    
    // Check cache first
    const cached = this.getCachedTags(cacheKey);
    if (cached) {
      cached.useCount++;
      console.log(`🎭 Using cached emotion tags for: ${context.contentType}`);
      return cached.tags;
    }

    try {
      // Generate tags using AI
      const aiTags = await this.generateWithAI(context);
      
      // Validate and cache successful generation
      if (this.validateTags(aiTags)) {
        this.cacheTags(cacheKey, aiTags);
        console.log(`🎭 Generated new AI emotion tags: ${JSON.stringify(aiTags)}`);
        return aiTags;
      }
      
      console.warn('🎭 AI generated invalid emotion tags, using fallback');
      return this.getFallbackTags(context);
      
    } catch (error) {
      console.error('🎭 AI emotion tag generation failed:', error);
      return this.getFallbackTags(context);
    }
  }

  /**
   * Generate emotion tags using AI
   */
  private async generateWithAI(context: EmotionTagContext): Promise<EmotionTags> {
    const prompt = this.buildPrompt(context);
    
    // Use a small, fast model for quick tag generation
    const response = await anthropicService.generateResponse(
      prompt, 
      'You are a voice emotion tag generator. Return only valid JSON.',
      [], // no relevant memories needed
      [], // no relevant docs needed
      undefined, // no lore context
      'SIMPLE' // simple mode for quick generation
    );
    
    try {
      // Extract JSON from response content (handles wrapper text)
      const jsonContent = this.extractJSON(response.content);
      const parsed = JSON.parse(jsonContent);
      
      // Validate structure
      if (!parsed.hook || !parsed.body || !parsed.cta) {
        throw new Error('Missing required emotion tag fields');
      }
      
      const tags = {
        hook: this.sanitizeTag(parsed.hook),
        body: this.sanitizeTag(parsed.body),
        cta: this.sanitizeTag(parsed.cta)
      };
      
      // Final validation
      if (!this.validateTags(tags)) {
        throw new Error('Generated emotion tags failed validation');
      }
      
      return tags;
    } catch (parseError: any) {
      console.warn('🎭 AI response parsing failed:', parseError);
      throw new Error(`Failed to parse AI emotion tag response: ${parseError?.message || 'Unknown parsing error'}`);
    }
  }

  /**
   * Extract JSON from potentially wrapped text
   */
  private extractJSON(text: string): string {
    // Try to find JSON object in the text
    const jsonMatch = text.match(/\{[^{}]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    
    // If no JSON object found, try the whole text
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }
    
    // Last resort - throw error
    throw new Error('No valid JSON object found in AI response');
  }

  /**
   * Build AI prompt for emotion tag generation
   */
  private buildPrompt(context: EmotionTagContext): string {
    return `Generate ElevenLabs emotion tags for TTS synthesis. Return ONLY a JSON object.

CONTENT: "${context.content.slice(0, 200)}..."
PERSONALITY: ${context.personality || 'neutral'}
CONTENT_TYPE: ${context.contentType}
MOOD: ${context.mood || 'balanced'}
INTENSITY: ${context.intensity || 'medium'}

Rules:
1. Return ONLY JSON: {"hook": "[tag1, tag2]", "body": "[tag3, tag4]", "cta": "[tag5, tag6]"}
2. Use 1-2 emotion words per tag in brackets
3. Match the personality and content mood
4. Hook = opening energy, Body = main content, CTA = closing energy
5. Keep tags simple and TTS-friendly
6. Use ONLY pure emotions/attitudes - NO accents, locations, or character names
7. Do NOT include words like "bronx", "italian", "jersey" or any geographic/accent descriptors
8. No explanation, just the JSON object

Examples:
- Aggressive ad: {"hook": "[bold, confident]", "body": "[intense, persuasive]", "cta": "[urgent, demanding]"}
- Warm chat: {"hook": "[friendly, welcoming]", "body": "[conversational, warm]", "cta": "[encouraging, supportive]"}
- Conspiracy content: {"hook": "[whispered, secretive]", "body": "[conspiratorial, urgent]", "cta": "[warning, serious]"}

Generate tags now:`;
  }

  /**
   * Sanitize and validate emotion tags
   */
  private sanitizeTag(tag: string): string {
    // Remove extra brackets, trim, ensure proper format
    return tag.replace(/^\[+|\]+$/g, '').trim().replace(/^/, '[').replace(/$/, ']');
  }

  /**
   * Validate generated tags
   */
  private validateTags(tags: EmotionTags): boolean {
    const isValidTag = (tag: string) => {
      return tag.startsWith('[') && tag.endsWith(']') && tag.length > 3 && tag.length < 50;
    };

    return isValidTag(tags.hook) && isValidTag(tags.body) && isValidTag(tags.cta);
  }

  /**
   * Get fallback tags based on context
   */
  private getFallbackTags(context: EmotionTagContext): EmotionTags {
    // Simple fallback based on content type
    switch (context.contentType) {
      case 'ad':
        return {
          hook: '[confident, engaging]',
          body: '[persuasive, friendly]',
          cta: '[urgent, convincing]'
        };
      case 'chat':
      case 'voice_response':
        return {
          hook: '[conversational, natural]',
          body: '[expressive, authentic]',
          cta: '[warm, genuine]'
        };
      case 'announcement':
        return {
          hook: '[clear, attention-getting]',
          body: '[informative, direct]',
          cta: '[conclusive, memorable]'
        };
      default:
        return {
          hook: '[natural, expressive]',
          body: '[conversational, engaging]',
          cta: '[warm, authentic]'
        };
    }
  }

  /**
   * Create cache key from context
   */
  private createCacheKey(context: EmotionTagContext): string {
    const contentHash = this.simpleHash(context.content.slice(0, 100));
    return `${context.contentType}_${context.personality || 'neutral'}_${context.mood || 'balanced'}_${contentHash}`;
  }

  /**
   * Simple hash function for content
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get cached tags if available and not expired
   */
  private getCachedTags(key: string): CachedEmotionTag | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Cache successful tags
   */
  private cacheTags(key: string, tags: EmotionTags): void {
    // Clean cache if it's getting too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanCache();
    }

    this.cache.set(key, {
      tags,
      timestamp: Date.now(),
      useCount: 1
    });
  }

  /**
   * Clean old cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Remove expired entries first
    entries.forEach(([key, value]) => {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    });

    // If still too many, remove least used
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const sortedByUsage = entries
        .sort((a, b) => a[1].useCount - b[1].useCount)
        .slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2)); // Remove bottom 20%
      
      sortedByUsage.forEach(([key]) => this.cache.delete(key));
    }

    console.log(`🗑️ Cleaned emotion tag cache, ${this.cache.size} entries remaining`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    const total = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.useCount, 0);
    const hits = Array.from(this.cache.values()).filter(entry => entry.useCount > 1).length;
    
    return {
      size: this.cache.size,
      hitRate: total > 0 ? hits / total : 0
    };
  }
}

// Export singleton instance
export const emotionTagGenerator = new EmotionTagGenerator();