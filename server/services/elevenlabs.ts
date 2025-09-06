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
      voiceId: process.env.ELEVENLABS_VOICE_ID || "LEwNRx69wC2SjtBsyDEf", // Nicky's custom voice
      model: "eleven_multilingual_v2"  // Latest model for better quality
    };
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    if (!this.config.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.config.apiKey,
          },
          body: JSON.stringify({
            text: text,
            model_id: this.config.model,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              style: 1.0,  // Maximum creative mode for character personality
              use_speaker_boost: true
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('ElevenLabs synthesis error:', error);
      throw new Error('Failed to synthesize speech');
    }
  }

  async getVoices(): Promise<any[]> {
    if (!this.config.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      throw new Error('Failed to fetch voices');
    }
  }

  setVoiceId(voiceId: string): void {
    this.config.voiceId = voiceId;
  }
}

export const elevenlabsService = new ElevenLabsService();
