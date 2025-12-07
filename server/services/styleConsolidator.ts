import type { IStorage } from '../storage.js';
import Anthropic from '@anthropic-ai/sdk';
import { geminiService } from './gemini.js';

export interface ConsolidatedPersonality {
  patterns: string;
  trainingExampleIds: string[];
  createdAt: Date;
  status: 'pending' | 'approved' | 'rejected';
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export class StyleConsolidator {
  constructor(
    private storage: IStorage
  ) {}

  /**
   * Analyze all training examples and create a consolidated personality update
   */
  async analyzeAndConsolidate(profileId: string): Promise<ConsolidatedPersonality> {
    // Get all training examples for the profile
    const trainingExamples = await this.storage.getTrainingExamples(profileId);
    
    if (trainingExamples.length === 0) {
      throw new Error('No training examples found to consolidate');
    }

    // Extract content from all examples
    const exampleContents = trainingExamples
      .filter(ex => ex.extractedContent)
      .map(ex => ({
        id: ex.id,
        content: ex.extractedContent!
      }));

    if (exampleContents.length === 0) {
      throw new Error('No training examples with content found');
    }

    // Use AI to analyze all examples and extract consolidated patterns
    const consolidatedPatterns = await this.consolidatePatterns(exampleContents);

    return {
      patterns: consolidatedPatterns,
      trainingExampleIds: exampleContents.map(ex => ex.id),
      createdAt: new Date(),
      status: 'pending'
    };
  }

  /**
   * Use AI to consolidate patterns from multiple training examples
   */
  private async consolidatePatterns(
    examples: Array<{ id: string; content: string }>
  ): Promise<string> {
    const examplesText = examples
      .map((ex, idx) => `--- Training Example ${idx + 1} ---\n${ex.content}`)
      .join('\n\n');

    const prompt = `Analyze these training conversation examples and extract the key behavioral patterns, personality traits, and response strategies that should be incorporated into the AI's core personality.

${examplesText}

Extract and consolidate:
1. Recurring personality traits and character quirks
2. Common response strategies and approaches
3. Consistent tone, voice, and style patterns
4. Key behavioral rules or preferences

Format the output as a clear, organized list of personality traits and behaviors that can be added to the AI's core identity. Be specific and actionable.`;

    try {
      // 🎯 PRIMARY: Try Gemini first (free tier)
      const systemPrompt = 'You are a personality analysis expert. Extract key behavioral patterns and personality traits from training examples.';
      const fullPrompt = `${systemPrompt}\n\n${prompt}`;
      
      const geminiResponse = await geminiService['ai'].models.generateContent({
        model: 'gemini-3-pro-preview', // 🚫 NEVER Flash - corrupts personality consolidation
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
          maxOutputTokens: 2000,
          temperature: 0.3
        }
      });
      
      const patterns = geminiResponse.text || '';
      console.log('✅ Successfully consolidated patterns using Gemini');
      return patterns.trim();
      
    } catch (geminiError) {
      // 🔄 FALLBACK: Use Claude if Gemini fails
      console.log('❌ Gemini consolidation failed, falling back to Claude:', geminiError);
      
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2000,
          temperature: 0.3,
          system: 'You are a personality analysis expert. Extract key behavioral patterns and personality traits from training examples.',
          messages: [{
            role: 'user',
            content: prompt
          }]
        });

        const textContent = response.content.find(c => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in response');
        }

        console.log('✅ Successfully consolidated patterns using Claude (fallback)');
        return textContent.text;
        
      } catch (claudeError) {
        console.error('❌ Both Gemini and Claude failed:', claudeError);
        throw new Error('Failed to consolidate patterns (both Gemini and Claude failed)');
      }
    }
  }

  /**
   * Apply consolidated patterns to a profile's core identity
   */
  async applyConsolidatedPatterns(
    profileId: string,
    consolidatedPersonality: ConsolidatedPersonality
  ): Promise<void> {
    const profile = await this.storage.getProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const currentIdentity = profile.coreIdentity || '';
    const updatedIdentity = currentIdentity + '\n\n🎓 CONSOLIDATED LEARNED BEHAVIORS:\n' + consolidatedPersonality.patterns;

    await this.storage.updateProfile(profileId, {
      coreIdentity: updatedIdentity
    });

    consolidatedPersonality.status = 'approved';
  }
}
