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

    // Use provided voice settings or fall back to defaults
    const settings = voiceSettings || {
      stability: 0.0, // Creative mode for maximum expressiveness 
      similarity_boost: 0.75,
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
      console.error("ElevenLabs synthesis error:", error);
      throw new Error("Failed to synthesize speech");
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
      console.error("Failed to fetch voices:", error);
      throw new Error("Failed to fetch voices");
    }
  }

  setVoiceId(voiceId: string): void {
    this.config.voiceId = voiceId;
  }
}

export const elevenlabsService = new ElevenLabsService();
