import { emotionTagGenerator } from './emotionTagGenerator.js';

interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  model: string;
}

interface EmotionProfile {
  name: string;
  settings: {
    stability: number; // v3: ONLY accepts 0.0, 0.5, or 1.0
  };
  performanceCues: {
    hook: string;
    body: string;
    cta: string;
  };
}

const EMOTION_PROFILES: { [key: string]: EmotionProfile } = {
  grumpy: {
    name: "Grumpy",
    settings: {
      stability: 0.0  // "Creative" mode - maximum responsiveness to Audio Tags
    },
    performanceCues: {
      hook: "[annoyed, gruff]",
      body: "[reluctant, deadpan]", 
      cta: "[exasperated]"
    }
  },
  conspiratorial: {
    name: "Conspiratorial",
    settings: {
      stability: 0.0  // "Creative" mode - maximum responsiveness to Audio Tags
    },
    performanceCues: {
      hook: "[whispering, confidential]",
      body: "[lean-in, secretive]",
      cta: "[urgent whisper]"
    }
  },
  reluctant: {
    name: "Reluctant",
    settings: {
      stability: 0.0  // "Creative" mode - maximum responsiveness to Audio Tags
    },
    performanceCues: {
      hook: "[under-the-breath]",
      body: "[matter-of-fact, resigned]",
      cta: "[whatever]"
    }
  },
  warm: {
    name: "Warm",
    settings: {
      stability: 0.0  // "Creative" mode - maximum responsiveness to Audio Tags
    },
    performanceCues: {
      hook: "[friendly, welcoming]",
      body: "[warm, genuine]",
      cta: "[encouraging]"
    }
  },
  excited: {
    name: "Excited",
    settings: {
      stability: 0.0  // "Creative" mode - maximum responsiveness to Audio Tags
    },
    performanceCues: {
      hook: "[excited, fast]",
      body: "[energetic, passionate]",
      cta: "[BIG FINISH]"
    }
  },
  manic: {
    name: "Manic",
    settings: {
      stability: 0.0  // "Creative" mode - maximum responsiveness to Audio Tags
    },
    performanceCues: {
      hook: "[unhinged, wild]",
      body: "[chaotic, rapid-fire]",
      cta: "[over-the-top]"
    }
  },
  deadpan: {
    name: "Deadpan",
    settings: {
      stability: 0.0  // v3: Even deadpan uses 0.0 - the Audio Tags control the delivery
    },
    performanceCues: {
      hook: "[flat, monotone]",
      body: "[dry, expressionless]",
      cta: "[robotic]"
    }
  },
  salesman: {
    name: "Salesman",
    settings: {
      stability: 0.0  // "Creative" mode - maximum responsiveness to Audio Tags
    },
    performanceCues: {
      hook: "[HIGH-ENERGY, sales pitch]",
      body: "[smooth, persuasive]",
      cta: "[closing the deal]"
    }
  },
  psycho: {
    name: "Psycho",
    settings: {
      stability: 0.0  // "Creative" mode - maximum responsiveness to Audio Tags
    },
    performanceCues: {
      hook: "[UNHINGED, completely insane]",
      body: "[manic, talking to voices, breaking character]",
      cta: "[screaming, absolutely psychotic]"
    }
  }
};

class ElevenLabsService {
  private config: ElevenLabsConfig;
  private lastUsedProfiles: string[] = []; // Anti-repetition tracking

  constructor() {
    this.config = {
      apiKey: process.env.ELEVENLABS_API_KEY || "",
      voiceId: process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB", // Default Adam voice
      model: "eleven_v3", // Prefer v3 for emotion tags, fallback to v2
    };
  }

  async synthesizeSpeech(
    text: string, 
    emotionProfile?: string, 
    voiceSettings?: any,
    context?: {
      contentType?: 'ad' | 'chat' | 'announcement' | 'voice_response';
      personality?: string;
      mood?: string;
      useAI?: boolean;
    }
  ): Promise<Buffer> {
    if (!this.config.apiKey) {
      throw new Error("ElevenLabs API key not configured");
    }

    let enhancedText = text;
    let settings = voiceSettings;

    // Use AI emotion tags if enabled and context provided (default for ads)
    if (context?.useAI !== false && context?.contentType) {
      try {
        console.log(`🎭 Generating AI emotion tags for ${context.contentType}`);
        const aiTags = await emotionTagGenerator.generateEmotionTags({
          content: text,
          contentType: context.contentType,
          personality: context.personality,
          mood: context.mood
        });

        // Apply AI-generated tags
        enhancedText = this.applySectionedDeliveryWithAI(text, aiTags);
        
        // v3-compatible settings: ONLY stability (0.0 = "Creative" mode for maximum Audio Tag responsiveness)
        settings = voiceSettings || {
          stability: 0.0, // "Creative" - maximum responsiveness to Audio Tags (v3 only accepts 0.0, 0.5, 1.0)
          seed: Math.floor(Math.random() * 1000000) // Optional: for deterministic generation
        };
        
        console.log(`🎭 Applied AI emotion tags: ${JSON.stringify(aiTags)}`);
      } catch (aiError) {
        console.warn('🎭 AI emotion tag generation failed, using fallback:', aiError);
        // Fall back to original hardcoded system
        enhancedText = this.synthesizeWithHardcodedProfile(text, emotionProfile);
        settings = this.getHardcodedSettings(emotionProfile, voiceSettings);
      }
    } else {
      // Use hardcoded emotion profiles (backward compatibility)
      enhancedText = this.synthesizeWithHardcodedProfile(text, emotionProfile);
      settings = this.getHardcodedSettings(emotionProfile, voiceSettings);
    }

    return this.synthesizeWithModelFallback(enhancedText, settings);
  }

  /**
   * Synthesize with model fallback (v3 -> v2)
   */
  private async synthesizeWithModelFallback(text: string, settings: any): Promise<Buffer> {
    const models = ["eleven_v3", "eleven_v2"]; // Try v3 first, fallback to v2
    let lastError: any;
    
    // 🧹 CLEANUP: Strip deprecated v2 parameters for v3 compatibility
    const cleanSettings = {
      stability: settings?.stability ?? 0.0,
      ...(settings?.seed && { seed: settings.seed })
    };
    
    for (const model of models) {
      try {
        console.log(`🎵 ElevenLabs request: voice_id=${this.config.voiceId}, model=${model}, settings=${JSON.stringify(cleanSettings)}`);
        
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}`,
          {
            method: "POST",
            headers: {
              Accept: "audio/mpeg",
              "Content-Type": "application/json",
              "xi-api-key": this.config.apiKey,
            },
            body: JSON.stringify({
              text: text,
              model_id: model,
              voice_settings: cleanSettings,
            }),
          },
        );

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          console.log(`✅ ElevenLabs synthesis successful with model: ${model}`);
          return Buffer.from(arrayBuffer);
        }

        // Handle error response
        const errorText = await response.text();
        console.error(`❌ ElevenLabs API error ${response.status} with model ${model}:`, errorText);
        lastError = new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
        
        // If 400 error (likely model incompatibility), try next model
        if (response.status === 400) {
          console.log(`🔄 Model ${model} incompatible, trying next model...`);
          continue;
        }
        
        // For other errors, don't try other models
        throw lastError;
        
      } catch (error) {
        console.error(`❌ ElevenLabs synthesis error with model ${model}:`, error);
        lastError = error;
        
        // Classify error for appropriate handling
        const errorInfo = this.classifyElevenLabsError(error);
        console.log(`🔄 ElevenLabs error classified as: ${errorInfo.type}`);
        
        // If it's a network or rate limit error, don't try other models
        if (errorInfo.type === 'RATE_LIMIT' || errorInfo.type === 'NETWORK_ERROR') {
          throw error;
        }
        
        // For other errors, try next model
        continue;
      }
    }
    
    // If we get here, all models failed
    throw lastError || new Error('All ElevenLabs models failed');
  }

  async getVoices(): Promise<any[]> {
    if (!this.config.apiKey) {
      throw new Error("ElevenLabs API key not configured");
    }

    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": this.config.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error("❌ Failed to fetch ElevenLabs voices:", error);
      
      const errorInfo = this.classifyElevenLabsError(error);
      console.log(`🔄 ElevenLabs voices error: ${errorInfo.type}`);
      
      // Provide graceful degradation - return empty array
      if (errorInfo.type === 'RATE_LIMIT' || errorInfo.type === 'NETWORK_ERROR') {
        console.warn("⚠️ Returning empty voices array due to API issue");
        return [];
      }
      
      throw new Error(`Failed to fetch voices: ${errorInfo.type}`);
    }
  }

  setVoiceId(voiceId: string): void {
    this.config.voiceId = voiceId;
  }

  /**
   * Select a random emotion profile with anti-repetition logic
   */
  private selectRandomProfile(): string {
    const profileKeys = Object.keys(EMOTION_PROFILES);
    
    // Filter out recently used profiles
    const availableProfiles = profileKeys.filter(key => 
      !this.lastUsedProfiles.includes(key)
    );
    
    // If all profiles were used recently, reset and use all
    const candidates = availableProfiles.length > 0 ? availableProfiles : profileKeys;
    
    // Select random profile
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }

  /**
   * Track used profiles for anti-repetition (keep last 3)
   */
  private trackUsedProfile(profileKey: string): void {
    this.lastUsedProfiles.push(profileKey);
    
    // Keep only last 3 to prevent repetition
    if (this.lastUsedProfiles.length > 3) {
      this.lastUsedProfiles.shift();
    }
  }

  /**
   * Apply AI-generated emotion tags to text with proper 2-3 sentence distribution for podcast mode
   */
  /**
   * Apply 5-stage emotional arc for natural progression
   * Tags are applied to GROUPS of sentences (not every sentence)
   */
  public applyEmotionalArc(text: string, arc: {opening: string, rising: string, peak: string, falling: string, close: string}): string {
    const sentences = text.split(/([.!?]+)/).filter(part => part.trim());
    
    if (sentences.length === 0) return text;
    
    const totalSentences = Math.ceil(sentences.length / 2);
    console.log(`🎭 Applying emotional arc to ${totalSentences} sentences across 5 stages`);
    
    const emotionStages = [arc.opening, arc.rising, arc.peak, arc.falling, arc.close];
    
    // Divide sentences into 5 groups
    const sentencesPerStage = Math.max(1, Math.ceil(totalSentences / 5));
    
    let result = '';
    let currentSentence = '';
    let sentenceCount = 0;
    let currentStage = -1;
    
    for (let i = 0; i < sentences.length; i++) {
      const part = sentences[i];
      
      if (/[.!?]+/.test(part)) {
        currentSentence += part;
        sentenceCount++;
        
        // Calculate which stage this sentence belongs to (0-4)
        const stage = Math.min(4, Math.floor((sentenceCount - 1) / sentencesPerStage));
        
        // Only add emotion tag at the START of each new stage (not every sentence)
        if (stage !== currentStage) {
          currentStage = stage;
          const emotionTag = emotionStages[stage];
          const doubleTag = `[bronx]${emotionTag}`;
          
          if (result.trim()) {
            result += ` ${doubleTag} ${currentSentence.trim()}`;
          } else {
            result += `${doubleTag} ${currentSentence.trim()}`;
          }
          
          console.log(`🎭 Stage ${stage + 1}/5 (${emotionTag}) starts at sentence ${sentenceCount}`);
        } else {
          // Same stage - just add sentence without tag
          result += ` ${currentSentence.trim()}`;
        }
        
        currentSentence = '';
      } else {
        currentSentence += part;
      }
    }
    
    // Handle any remaining text
    if (currentSentence.trim()) {
      result += result.trim() ? ` ${currentSentence.trim()}` : currentSentence.trim();
    }
    
    console.log(`🎭 Applied 5 emotion tags across ${totalSentences} sentences`);
    return result;
  }

  public applySectionedDeliveryWithAI(text: string, aiTags: {hook: string, body: string, cta: string}): string {
    // Split text into sentences but preserve punctuation - handles . ! ? endings
    const sentences = text.split(/([.!?]+)/).filter(part => part.trim());
    
    if (sentences.length === 0) return text;
    
    console.log(`🎭 BEFORE applying tags: "${text.substring(0, 50)}..."`);
    
    // Group sentences for better emotion tag distribution
    let result = '';
    let currentSentence = '';
    let sentenceCount = 0;
    let tagIndex = 0;
    const tagCycle = ['hook', 'body', 'cta']; // Cycle through all emotion types
    
    for (let i = 0; i < sentences.length; i++) {
      const part = sentences[i];
      
      // If this part contains punctuation, it's the end of a sentence
      if (/[.!?]+/.test(part)) {
        currentSentence += part;
        sentenceCount++;
        
        // Apply emotion tags every 2-3 sentences for podcast mode variety
        const shouldApplyTag = sentenceCount === 1 || // First sentence always gets a tag
                              sentenceCount % 3 === 0 || // Every 3rd sentence
                              sentenceCount % 2 === 0 && Math.random() > 0.5 || // Sometimes every 2nd
                              i >= sentences.length - 2; // Final sentences always get tags
        
        if (shouldApplyTag) {
          // Determine which emotion tag to use
          let emotionTag: string;
          
          if (sentenceCount === 1) {
            // First sentence always uses hook
            emotionTag = aiTags.hook;
          } else if (i >= sentences.length - 2) {
            // Final sentences use CTA for strong finish
            emotionTag = aiTags.cta;
          } else {
            // Cycle through emotions for variety: hook → body → cta → hook...
            const currentTag = tagCycle[tagIndex % tagCycle.length];
            emotionTag = aiTags[currentTag as keyof typeof aiTags];
            tagIndex++;
          }
          
          // CRITICAL: Use [bronx][emotion] double-tag pattern for voice consistency
          const doubleTag = `[bronx]${emotionTag}`;
          
          if (result.trim()) {
            result += ` ${doubleTag} ${currentSentence.trim()}`;
          } else {
            result += `${doubleTag} ${currentSentence.trim()}`;
          }
          
          console.log(`🎭 Applied ${tagCycle[tagIndex % tagCycle.length] || 'hook'} tag to sentence ${sentenceCount}: "${currentSentence.substring(0, 30)}..."`);
        } else {
          // Add sentence without emotion tag
          result += result.trim() ? ` ${currentSentence.trim()}` : currentSentence.trim();
        }
        
        currentSentence = '';
      } else {
        // Regular text content
        currentSentence += part;
      }
    }
    
    // Handle any remaining text (edge case)
    if (currentSentence.trim()) {
      result += ` ${aiTags.cta} ${currentSentence.trim()}`;
      console.log(`🎭 Applied final CTA tag to remaining text: "${currentSentence.substring(0, 30)}..."`);
    }
    
    console.log(`🎭 AFTER applying tags: "${result.substring(0, 50)}..."`);
    return result.trim();
  }

  /**
   * Synthesize with hardcoded profile (fallback/backward compatibility)
   */
  private synthesizeWithHardcodedProfile(text: string, emotionProfile?: string): string {
    // Select emotion profile with anti-repetition
    const profileKey = emotionProfile || this.selectRandomProfile();
    const profile = EMOTION_PROFILES[profileKey];
    
    // Apply section-based performance cues
    return profile ? this.applySectionedDelivery(text, profile) : text;
  }

  /**
   * Get hardcoded settings (fallback/backward compatibility)
   */
  private getHardcodedSettings(emotionProfile?: string, voiceSettings?: any): any {
    const profileKey = emotionProfile || this.selectRandomProfile();
    const profile = EMOTION_PROFILES[profileKey];
    
    // Track the profile usage for anti-repetition
    this.trackUsedProfile(profileKey);
    
    return voiceSettings || (profile ? {
      ...profile.settings,
      // Add randomized seed to prevent identical prosody
      seed: Math.floor(Math.random() * 1000000)
    } : {
      // v3-compatible fallback: ONLY stability
      stability: 0.0, // "Creative" mode for maximum Audio Tag responsiveness
      seed: Math.floor(Math.random() * 1000000)
    });
  }

  /**
   * Apply section-based performance cues to text
   */
  private applySectionedDelivery(text: string, profile: EmotionProfile): string {
    // Split text into sentences
    const sentences = text.split('.').filter(s => s.trim());
    
    if (sentences.length === 0) return text;
    
    // Determine sections
    const hook = sentences[0]?.trim();
    const cta = sentences[sentences.length - 1]?.trim();
    const body = sentences.slice(1, -1).join('. ').trim();
    
    let result = '';
    
    // Apply hook cue
    if (hook) {
      result += `${profile.performanceCues.hook} ${hook}.`;
    }
    
    // Apply body cue (if there's a body)
    if (body) {
      result += ` ${profile.performanceCues.body} ${body}.`;
    }
    
    // Apply CTA cue (if different from hook)
    if (cta && cta !== hook) {
      result += ` ${profile.performanceCues.cta} ${cta}.`;
    }
    
    return result.trim();
  }

  /**
   * Get available emotion profiles
   */
  getEmotionProfiles(): string[] {
    return Object.keys(EMOTION_PROFILES);
  }

  /**
   * Get emotion profile by key
   */
  getEmotionProfile(key: string): EmotionProfile | undefined {
    return EMOTION_PROFILES[key];
  }

  /**
   * Classify ElevenLabs API errors for appropriate handling
   */
  private classifyElevenLabsError(error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = error?.status || error?.response?.status;
    
    // Rate limiting
    if (statusCode === 429 || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      return { type: 'RATE_LIMIT', retryable: true, retryCount: 0 };
    }
    
    // Network/timeout errors
    if (statusCode >= 500 || 
        errorMessage.includes('timeout') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('network')) {
      return { type: 'NETWORK_ERROR', retryable: true, retryCount: 0 };
    }
    
    // Auth errors
    if (statusCode === 401 || errorMessage.includes('unauthorized') || errorMessage.includes('API key')) {
      return { type: 'AUTH_ERROR', retryable: false, retryCount: 0 };
    }
    
    // Voice not found
    if (statusCode === 404 || errorMessage.includes('voice not found')) {
      return { type: 'VOICE_NOT_FOUND', retryable: false, retryCount: 0 };
    }
    
    // Service unavailable
    if (statusCode === 503 || errorMessage.includes('service unavailable')) {
      return { type: 'SERVICE_UNAVAILABLE', retryable: true, retryCount: 0 };
    }
    
    return { type: 'UNKNOWN', retryable: false, retryCount: 0 };
  }
}

export const elevenlabsService = new ElevenLabsService();
