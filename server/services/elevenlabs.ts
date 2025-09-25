import { emotionTagGenerator } from './emotionTagGenerator.js';

interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  model: string;
}

interface EmotionProfile {
  name: string;
  settings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
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
      stability: 0.25,
      similarity_boost: 0.85,
      style: 0.6,
      use_speaker_boost: true
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
      stability: 0.20,
      similarity_boost: 0.75,
      style: 0.8,
      use_speaker_boost: true
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
      stability: 0.40,
      similarity_boost: 0.7,
      style: 0.4,
      use_speaker_boost: true
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
      stability: 0.35,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true
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
      stability: 0.25,
      similarity_boost: 0.65,
      style: 0.9,
      use_speaker_boost: true
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
      stability: 0.15,
      similarity_boost: 0.6,
      style: 0.95,
      use_speaker_boost: true
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
      stability: 0.50,
      similarity_boost: 0.85,
      style: 0.3,
      use_speaker_boost: true
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
      stability: 0.30,
      similarity_boost: 0.75,
      style: 0.7,
      use_speaker_boost: true
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
      stability: 0.05,
      similarity_boost: 0.50,
      style: 1.0,
      use_speaker_boost: true
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
        
        // Use stable voice settings optimized for variety
        settings = voiceSettings || {
          stability: 0.3,
          similarity_boost: 0.75,
          style: 0.6,
          use_speaker_boost: true,
          seed: Math.floor(Math.random() * 1000000)
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
    
    for (const model of models) {
      try {
        console.log(`🎵 ElevenLabs request: voice_id=${this.config.voiceId}, model=${model}, settings=${JSON.stringify(settings)}`);
        
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
              voice_settings: settings,
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
   * Apply AI-generated emotion tags to text
   */
  public applySectionedDeliveryWithAI(text: string, aiTags: {hook: string, body: string, cta: string}): string {
    // Split text into sentences
    const sentences = text.split('.').filter(s => s.trim());
    
    if (sentences.length === 0) return text;
    
    // Determine sections
    const hook = sentences[0]?.trim();
    const cta = sentences[sentences.length - 1]?.trim();
    const body = sentences.slice(1, -1).join('. ').trim();
    
    let result = '';
    
    // Apply AI-generated hook cue
    if (hook) {
      result += `${aiTags.hook} ${hook}.`;
    }
    
    // Apply AI-generated body cue (if there's a body)
    if (body) {
      result += ` ${aiTags.body} ${body}.`;
    }
    
    // Apply AI-generated CTA cue (if different from hook)
    if (cta && cta !== hook) {
      result += ` ${aiTags.cta} ${cta}.`;
    }
    
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
      stability: 0.3,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true,
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
