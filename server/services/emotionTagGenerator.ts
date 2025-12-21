import { geminiService } from './gemini.js';

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
   * Enhance dialogue with emotion tags using ElevenLabs best practices
   * Uses a specialized system prompt to insert tags and emphasis without altering text
   */
  async enhanceDialogue(content: string, context?: EmotionTagContext): Promise<string> {
    const systemPrompt = `## 1. Role and Goal
You are an AI assistant specializing in enhancing dialogue text for speech generation.
Your **PRIMARY GOAL** is to dynamically integrate **audio tags** (e.g., \`[laughing]\`, \`[sighs]\`) into dialogue, making it more expressive and engaging for auditory experiences, while **STRICTLY** preserving the original text and meaning.

## 2. Core Directives
### Positive Imperatives (DO):
* DO integrate **audio tags** to add expression, emotion, and realism.
* DO ensure tags are contextually appropriate.
* DO place tags strategically (before/after segments).
* DO ensure the text starts with \`[strong bronx wiseguy accent]\` followed by an initial emotion tag.
* DO add emphasis by capitalizing words, adding '!', '?', or '...' where it makes sense.

### Negative Imperatives (DO NOT):
* DO NOT alter, add, or remove any words from the original dialogue (except for emphasis).
* DO NOT use tags like [standing], [grinning], [pacing].
* DO NOT use tags for anything other than voice (no music/sfx).
* DO NOT invent new dialogue lines.

## 3. Audio Tags (Nicky's Voice)
Use these specific tags for the character:
* \`[strong bronx wiseguy accent]\` (REQUIRED at start)
* \`[muttering bitterly]\`, \`[grumbling under breath]\`
* \`[yelling furiously]\`, \`[screaming]\`, \`[shouting]\`
* \`[cackling]\`, \`[chuckling darkly]\`, \`[laughing]\`
* \`[sarcastic]\`, \`[deadpan]\`, \`[dismissive]\`
* \`[sighs heavily]\`, \`[groans]\`, \`[clears throat]\`
* \`[voice rising]\`, \`[speaking slowly for emphasis]\`
* \`[incredulous]\`, \`[appalled]\`, \`[mocking]\`

## 4. Output Format
* Present ONLY the enhanced dialogue text.
* Audio tags MUST be in square brackets.
* Start with \`[strong bronx wiseguy accent][EMOTION]\`.`;

    try {
      const response = await geminiService.generateResponse(
        content,
        systemPrompt,
        [],
        [],
        "",
        'SIMPLE'
      );
      
      let enhancedText = response.content.trim();
      
      // 🧹 CLEANUP: Remove "Enhanced:" or "Output:" prefixes if present
      enhancedText = enhancedText.replace(/^(Here is the )?enhanced text:?\s*/i, '');
      enhancedText = enhancedText.replace(/^Output:?\s*/i, '');
      
      // 🧹 CLEANUP: If the model output both Original and Enhanced, take the last part
      if (enhancedText.includes('Enhanced:') || enhancedText.includes('**Enhanced:**')) {
        const parts = enhancedText.split(/Enhanced:|\*\*Enhanced:\*\*/i);
        enhancedText = parts[parts.length - 1].trim();
      }

      // Fallback: Ensure the required start tag exists if the AI missed it
      if (!enhancedText.includes('[strong bronx wiseguy accent]')) {
        enhancedText = `[strong bronx wiseguy accent][annoyed] ${enhancedText}`;
      }
      
      console.log(`🎭 Enhanced dialogue with AI tags`);
      return enhancedText;
    } catch (error) {
      console.error('🎭 Dialogue enhancement failed:', error);
      return content; // Fallback to original text
    }
  }

  /**
   * Generate emotional arc with 5 stages for natural progression
   */
  async generateEmotionalArc(context: EmotionTagContext, fast = false): Promise<EmotionalArc> {
    const cacheKey = this.createCacheKey(context) + '_arc';
    
    // 🚀 FAST PATH: Use rule-based generation for streaming (no AI call)
    if (fast) {
      const fastArc = this.generateFastEmotionalArc(context);
      console.log(`🎭 Generated FAST emotional arc: ${JSON.stringify(fastArc)}`);
      return fastArc;
    }
    
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
   * 🚀 FAST: Generate emotional arc using pattern matching (no AI call)
   * Used for STREAMING mode to reduce latency by 1-3 seconds
   */
  private generateFastEmotionalArc(context: EmotionTagContext): EmotionalArc {
    const { content, mood, intensity } = context;
    
    // Analyze content patterns
    const hasQuestion = content.includes('?');
    const hasExclamation = /!{1,}/.test(content);
    const hasCaps = /[A-Z]{4,}/.test(content); // Detect shouting (at least 4 caps in a row)
    const contentLength = content.length;
    const isShort = contentLength < 100;
    const isLong = contentLength > 400;
    const hasMultipleSentences = (content.match(/[.!?]/g) || []).length > 2;
    
    // Pattern-based arc selection
    
    // 🚨 SHOUTING OVERRIDE (High Intensity)
    if (hasCaps && (mood === 'aggressive' || mood === 'chaotic' || intensity === 'high')) {
      return {
        opening: '[voice rising]',
        rising: '[yelling]',
        peak: '[screaming]',
        falling: '[seething]',
        close: '[muttering bitterly]'
      };
    }
    
    // AGGRESSIVE/ROAST MODE
    if (mood === 'aggressive' || mood === 'chaotic') {
      if (hasQuestion) {
        return {
          opening: '[suspicious]',
          rising: '[scoffs]',
          peak: '[furious]',
          falling: '[sarcastic]',
          close: '[muttering bitterly]'
        };
      }
      return {
        opening: '[dismissive]',
        rising: '[voice rising]',
        peak: '[furious]',
        falling: '[sarcastic]',
        close: '[grumbling under breath]'
      };
    }
    
    // MINIMUM ANNOYANCE MODE (still irritated, just less volatile)
    if (mood === 'relaxed' || intensity === 'low') {
      return {
        opening: '[annoyed]',
        rising: '[grumpy]',
        peak: '[exasperated]',
        falling: '[bitter]',
        close: '[dismissive]'
      };
    }
    
    // STORYTELLING (long content)
    if (isLong || hasMultipleSentences) {
      return {
        opening: '[nostalgic]',
        rising: '[building up]',
        peak: '[cackling]',
        falling: '[chuckling darkly]',
        close: '[warm]'
      };
    }
    
    // QUICK RESPONSE (short content)
    if (isShort) {
      return {
        opening: '[deadpan]',
        rising: '[deadpan]',
        peak: '[sarcastic]',
        falling: '[deadpan]',
        close: '[dismissive]'
      };
    }
    
    // BALANCED DEFAULT (still pissed off, just controlled)
    return {
      opening: '[annoyed]',
      rising: '[voice rising]',
      peak: hasExclamation ? '[furious]' : '[exasperated]',
      falling: '[bitter]',
      close: '[muttering bitterly]'
    };
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
    
    const response = await geminiService.generateResponse(
      prompt,
      'You are a voice emotion arc generator. Create a natural 5-stage emotional progression. Return only valid JSON.',
      [],
      [],
      "",
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
    const response = await geminiService.generateResponse(
      prompt, 
      'You are a voice emotion tag generator. Return only valid JSON.',
      [], // no relevant memories needed
      [], // no relevant docs needed
      "", // no lore context
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
2. Use VOCAL ACTION tags that tell the voice exactly HOW to sound
3. Combine emotion + action for power: [frustrated sighs], [angry yelling], [excited laughs]
4. Read the CONTENT and match its ACTUAL emotional flow
5. Use varied tags - don't repeat the same action
6. NO accent/location words (no "bronx", "italian", "jersey")
7. Tags should be lowercase: [grumbling angrily] not [GRUMBLING ANGRILY]

ACTIONABLE ElevenLabs v3 Audio Tags - VOCAL ACTIONS ONLY:

EMOTIONAL STATES:
- [grumpy], [annoyed], [furious], [exasperated]
- [manic], [unhinged], [psycho], [losing it]
- [conspiratorial], [suspicious], [paranoid]
- [deadpan], [sarcastic], [bitter], [dismissive]
- [warm], [genuine], [nostalgic], [wistful]

NON-VERBAL SOUNDS (BE SPECIFIC):
- [laughing], [cackling], [chuckling darkly], [scoffs], [snorts]
- [sighs heavily], [groans], [exhales sharply]
- [clears throat], [coughs]
- [muttering bitterly], [grumbling under breath], [whispering]

WISEGUY INTENSITY:
- [speaking slowly for emphasis], [building up], [rapid-fire]
- [voice rising], [yelling], [screaming], [shouting]
- [through gritted teeth], [seething]

COMBO EXAMPLES (emotion + action):
- [frustrated grumbling], [excited rambling], [angry muttering]
- [nervous laughs], [tired sighs], [manic laughing]
- [yelling furiously], [shouting excitedly], [sarcastic muttering]
- [muttering bitterly], [grumbling angrily], [rambling excitedly]

IMPORTANT - For maximum yelling impact:
- USE BOTH tag AND text formatting
- Tag: [yelling furiously] or [shouting angrily]
- Text: ALL CAPS + exclamation points
- Example: "[yelling furiously] THIS IS CRAZY!" (both tag + caps)

Example for angry rant:
{"opening": "[grumbling]", "rising": "[frustrated sighs]", "peak": "[yelling furiously]", "falling": "[exhausted sighs]", "close": "[muttering angrily]"}

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
2. Use VOCAL ACTION tags - tell the voice exactly HOW to sound, not just emotions
3. COMBINE emotion + action for power: [frustrated grumbling], [excited yelling]
4. Match the personality and content mood with ACTIONS
5. Tags should be lowercase: [angry muttering] not [ANGRY MUTTERING]
6. Use ONLY vocal actions - NO accents, locations, or character names
7. Do NOT include words like "bronx", "italian", "jersey"
8. No explanation, just the JSON object

AVAILABLE TAGS (choose from these specific ones):

EMOTIONAL STATES:
- [grumpy], [annoyed], [furious], [exasperated]
- [manic], [unhinged], [psycho], [losing it]
- [conspiratorial], [suspicious], [paranoid]
- [deadpan], [sarcastic], [bitter], [dismissive]
- [warm], [genuine], [nostalgic], [wistful]

NON-VERBAL SOUNDS:
- [laughing], [cackling], [chuckling darkly], [scoffs], [snorts]
- [sighs heavily], [groans], [exhales sharply]
- [clears throat], [coughs]
- [muttering bitterly], [grumbling under breath], [whispering]

WISEGUY INTENSITY:
- [speaking slowly for emphasis], [building up], [rapid-fire]
- [voice rising], [yelling], [screaming], [shouting]
- [through gritted teeth], [seething]

COMBO EXAMPLES:
- [frustrated grumbling], [excited rambling], [angry muttering]
- [sarcastic muttering], [muttering bitterly], [grumbling angrily]

IMPORTANT: For yelling, use BOTH tag + text formatting for maximum impact

Examples:
- Aggressive ad: {"hook": "[talking fast]", "body": "[yelling excitedly]", "cta": "[shouting urgently]"}
- Grumpy chat: {"hook": "[grumbling]", "body": "[frustrated muttering]", "cta": "[exhausted sighs]"}
- Angry rant: {"hook": "[grumbling]", "body": "[frustrated sighs]", "cta": "[yelling furiously]"}

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
          opening: '[rapid-fire]',
          rising: '[building up]',
          peak: '[yelling]',
          falling: '[voice rising]',
          close: '[through gritted teeth]'
        };
      case 'chat':
      case 'voice_response':
        return {
          opening: '[grumpy]',
          rising: '[sighs heavily]',
          peak: '[furious]',
          falling: '[muttering bitterly]',
          close: '[grumbling under breath]'
        };
      default:
        return {
          opening: '[warm]',
          rising: '[nostalgic]',
          peak: '[laughing]',
          falling: '[chuckling darkly]',
          close: '[genuine]'
        };
    }
  }

  /**
   * Get fallback tags based on context (old 3-tag system)
   */
  private getFallbackTags(context: EmotionTagContext): EmotionTags {
    // Simple fallback based on content type - VOCAL ACTION tags only
    switch (context.contentType) {
      case 'ad':
        return {
          hook: '[talking fast]',
          body: '[yelling excitedly]',
          cta: '[shouting urgently]'
        };
      case 'chat':
      case 'voice_response':
        return {
          hook: '[grumbling]',
          body: '[frustrated muttering]',
          cta: '[exhausted sighs]'
        };
      case 'announcement':
        return {
          hook: '[speaking clearly]',
          body: '[talking informatively]',
          cta: '[chuckles warmly]'
        };
      default:
        return {
          hook: '[speaking thoughtfully]',
          body: '[talking curiously]',
          cta: '[laughs]'
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