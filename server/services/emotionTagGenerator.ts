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

interface EmotionalArc {
  opening: string;   // First 20% - Initial hook
  rising: string;    // Next 20% - Building energy
  peak: string;      // Middle 20% - Climax/intensity
  falling: string;   // Next 20% - Transition down
  close: string;     // Final 20% - Strong finish
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
   * Generate emotional arc with 5 stages for natural progression
   */
  async generateEmotionalArc(context: EmotionTagContext): Promise<EmotionalArc> {
    const cacheKey = this.createCacheKey(context) + '_arc';
    
    try {
      const arc = await this.generateArcWithAI(context);
      console.log(`🎭 Generated emotional arc: ${JSON.stringify(arc)}`);
      return arc;
    } catch (error) {
      console.error('🎭 Emotional arc generation failed:', error);
      return this.getFallbackArc(context);
    }
  }

  /**
   * Generate contextual emotion tags using AI (legacy 3-tag system)
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
   * Generate emotional arc using AI (5-stage progression)
   */
  private async generateArcWithAI(context: EmotionTagContext): Promise<EmotionalArc> {
    const prompt = this.buildArcPrompt(context);
    
    const response = await anthropicService.generateResponse(
      prompt,
      'You are a voice emotion arc generator. Create a natural 5-stage emotional progression. Return only valid JSON.',
      [],
      [],
      undefined,
      'SIMPLE'
    );
    
    try {
      const jsonContent = this.extractJSON(response.content);
      const parsed = JSON.parse(jsonContent);
      
      if (!parsed.opening || !parsed.rising || !parsed.peak || !parsed.falling || !parsed.close) {
        throw new Error('Missing required emotional arc fields');
      }
      
      return {
        opening: this.sanitizeTag(parsed.opening),
        rising: this.sanitizeTag(parsed.rising),
        peak: this.sanitizeTag(parsed.peak),
        falling: this.sanitizeTag(parsed.falling),
        close: this.sanitizeTag(parsed.close)
      };
    } catch (error: any) {
      console.warn('🎭 Arc parsing failed:', error);
      throw new Error(`Failed to parse emotional arc: ${error?.message}`);
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
   * Build AI prompt for emotional arc generation (5-stage)
   */
  private buildArcPrompt(context: EmotionTagContext): string {
    return `Create a natural 5-stage emotional arc for this dialogue. Analyze the ACTUAL emotional flow of the content.

CONTENT: "${context.content}"
PERSONALITY: ${context.personality || 'Nicky - unhinged Italian-American podcaster'}
CONTENT_TYPE: ${context.contentType}

Create a NATURAL emotional progression based on what the character is actually saying:
- opening: First 20% - How does it START?
- rising: Next 20% - Energy building
- peak: Middle 20% - Emotional climax
- falling: Next 20% - Transition/shift
- close: Final 20% - How does it END?

CRITICAL RULES:
1. Return ONLY JSON: {"opening": "[TAG]", "rising": "[TAG]", "peak": "[TAG]", "falling": "[TAG]", "close": "[TAG]"}
2. ONE emotion word per tag - NO COMMAS, NO MULTIPLE WORDS
3. Read the CONTENT and match its ACTUAL emotional flow
4. Use varied emotions - don't repeat the same tag
5. NO accent/location words (no "bronx", "italian", "jersey")
6. Uppercase tags: [GRUMPY] not [grumpy]

Available emotions: GRUMPY, ANNOYED, FURIOUS, EXASPERATED, MANIC, UNHINGED, PSYCHO, EXCITED, CONSPIRATORIAL, SUSPICIOUS, PARANOID, DEADPAN, SARCASTIC, RELUCTANT, WARM, GENUINE, NOSTALGIC, COMPOSED, INCREDULOUS, INDIGNANT, INTENSE, URGENT, CONFIDENT, PERSUASIVE, CONVERSATIONAL, EXPRESSIVE

Example for angry rant:
{"opening": "[ANNOYED]", "rising": "[FURIOUS]", "peak": "[UNHINGED]", "falling": "[SARCASTIC]", "close": "[INTENSE]"}

Generate arc now:`;
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
1. Return ONLY JSON: {"hook": "[TAG]", "body": "[TAG]", "cta": "[TAG]"}
2. Use EXACTLY ONE emotion/delivery word per tag - NO COMMAS, NO MULTIPLE WORDS
3. Match the personality and content mood
4. Hook = opening energy, Body = main content, CTA = closing energy
5. Keep tags simple and TTS-friendly (uppercase preferred: [ANNOYED] not [annoyed])
6. Use ONLY pure emotions/attitudes - NO accents, locations, or character names
7. Do NOT include words like "bronx", "italian", "jersey" or any geographic/accent descriptors
8. No explanation, just the JSON object

Examples:
- Aggressive ad: {"hook": "[CONFIDENT]", "body": "[INTENSE]", "cta": "[URGENT]"}
- Warm chat: {"hook": "[FRIENDLY]", "body": "[WARM]", "cta": "[ENCOURAGING]"}
- Conspiracy content: {"hook": "[WHISPERING]", "body": "[CONSPIRATORIAL]", "cta": "[SERIOUS]"}

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
   * Get fallback emotional arc
   */
  private getFallbackArc(context: EmotionTagContext): EmotionalArc {
    switch (context.contentType) {
      case 'ad':
        return {
          opening: '[CONFIDENT]',
          rising: '[EXCITED]',
          peak: '[PERSUASIVE]',
          falling: '[INTENSE]',
          close: '[URGENT]'
        };
      case 'chat':
      case 'voice_response':
        return {
          opening: '[GRUMPY]',
          rising: '[ANNOYED]',
          peak: '[FURIOUS]',
          falling: '[SARCASTIC]',
          close: '[INTENSE]'
        };
      default:
        return {
          opening: '[CONVERSATIONAL]',
          rising: '[EXPRESSIVE]',
          peak: '[ENGAGED]',
          falling: '[THOUGHTFUL]',
          close: '[WARM]'
        };
    }
  }

  /**
   * Get fallback tags based on context
   */
  private getFallbackTags(context: EmotionTagContext): EmotionTags {
    // Simple fallback based on content type - SINGLE tags only
    switch (context.contentType) {
      case 'ad':
        return {
          hook: '[CONFIDENT]',
          body: '[PERSUASIVE]',
          cta: '[URGENT]'
        };
      case 'chat':
      case 'voice_response':
        return {
          hook: '[CONVERSATIONAL]',
          body: '[EXPRESSIVE]',
          cta: '[WARM]'
        };
      case 'announcement':
        return {
          hook: '[CLEAR]',
          body: '[INFORMATIVE]',
          cta: '[MEMORABLE]'
        };
      default:
        return {
          hook: '[NATURAL]',
          body: '[ENGAGING]',
          cta: '[AUTHENTIC]'
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