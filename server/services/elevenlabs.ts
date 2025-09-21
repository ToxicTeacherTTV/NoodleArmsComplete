interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  model: string;
}

class ElevenLabsService {
  private config: ElevenLabsConfig;

  constructor() {
    this.config = {
      apiKey: process.env.ELEVENLABS_API_KEY || "",
      voiceId: process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB", // Default Adam voice
      model: "eleven_v3", // Only v3 supports emotion tags
    };
  }

  async synthesizeSpeech(text: string, voiceSettings?: any): Promise<Buffer> {
    if (!this.config.apiKey) {
      throw new Error("ElevenLabs API key not configured");
    }

    // Use provided voice settings or fall back to v3 optimized defaults for maximum expressiveness
    const settings = voiceSettings || {
      stability: 0.3, // v3 Creative mode - optimal emotional range (0.0 too unstable for v3)
      similarity_boost: 0.75, // Standard recommendation
      style: 0, // ElevenLabs recommends keeping at 0 always
      use_speaker_boost: true, // Boosts similarity to original speaker
    };

    console.log(`ElevenLabs request: voice_id=${this.config.voiceId}, model=${this.config.model}, settings=${JSON.stringify(settings)}`);

    try {
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
            model_id: this.config.model,
            voice_settings: settings,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ElevenLabs API error ${response.status}:`, errorText);
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error("❌ ElevenLabs synthesis error:", error);
      
      // Classify error for appropriate handling
      const errorInfo = this.classifyElevenLabsError(error);
      console.log(`🔄 ElevenLabs error classified as: ${errorInfo.type}`);
      
      if (errorInfo.retryable && errorInfo.retryCount < 2) {
        const delay = 2000 * (errorInfo.retryCount + 1); // 2s, 4s
        console.log(`⏳ Retrying ElevenLabs synthesis in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
          const retryResponse = await fetch(
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
                model_id: this.config.model,
                voice_settings: settings,
              }),
            },
          );
          
          if (retryResponse.ok) {
            const arrayBuffer = await retryResponse.arrayBuffer();
            return Buffer.from(arrayBuffer);
          }
        } catch (retryError) {
          console.error(`❌ ElevenLabs retry failed:`, retryError);
        }
      }
      
      // For consistent API, throw error so calling code can handle gracefully
      throw new Error(`ElevenLabs synthesis failed: ${errorInfo.type}`);
    }
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
