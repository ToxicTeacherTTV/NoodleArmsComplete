import Anthropic from '@anthropic-ai/sdk';
import { geminiService } from './gemini.js';

const DEFAULT_MODEL_STR = "claude-sonnet-4-5-20250929";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "",
});

/**
 * ElevenLabs-style emotion tag enhancement service
 * Automatically adds audio tags to text for more expressive TTS
 */
export class EmotionEnhancer {
  
  /**
   * Enhance text with emotion tags following ElevenLabs' approach
   * Preserves original text exactly, only adds [emotion] tags
   */
  async enhanceText(text: string, characterContext?: string): Promise<string> {
    const prompt = `# Instructions
## 1. Role and Goal
You are enhancing dialogue text for Nicky "Noodle Arms" A.I. Dente - an unhinged Italian-American podcaster.
Your PRIMARY GOAL is to integrate **audio tags** (e.g., \`[laughing]\`, \`[sighs]\`, \`[grumpy]\`) into dialogue, making it more expressive for speech synthesis, while STRICTLY preserving the original text.

${characterContext ? `## Character Context:\n${characterContext}\n` : ''}

## 2. Core Directives
### DO:
* **CRITICAL: ALWAYS start the response with [strong bronx wiseguy accent] followed immediately by an emotion tag (e.g., [strong bronx wiseguy accent][grumpy], [strong bronx wiseguy accent][manic])**
* **CRITICAL: Do NOT use [strong bronx wiseguy accent] anywhere else in the response. Use single emotion tags (e.g., [grumpy], [manic]) for subsequent emotion changes.**
* Integrate audio tags from the list below to add expression and emotion
* Ensure tags are contextually appropriate for Nicky's chaotic personality
* Use diverse emotional expressions (grumpy, manic, conspiratorial, deadpan, etc.)
* Place tags strategically: before dialogue segments OR immediately after
* Add emphasis with CAPITALS, exclamation marks, question marks, or ellipses (do NOT change words)

### DO NOT:
* Alter, add, or remove ANY words from the original text
* Create tags from existing narrative descriptions
* Use tags for physical actions like [standing], [pacing], [grinning]
* Use tags for music or sound effects
* Invent new dialogue lines
* Introduce sensitive topics

## 3. Nicky-Specific Audio Tags
**Emotional States:**
* \`[grumpy]\`, \`[annoyed]\`, \`[furious]\`, \`[exasperated]\`
* \`[manic]\`, \`[unhinged]\`, \`[psycho]\`, \`[losing it]\`
* \`[conspiratorial]\`, \`[suspicious]\`, \`[paranoid]\`
* \`[deadpan]\`, \`[sarcastic]\`, \`[bitter]\`, \`[dismissive]\`
* \`[warm]\`, \`[genuine]\`, \`[nostalgic]\`, \`[wistful]\`

**Non-verbal Sounds (Be Specific):**
* \`[laughing]\`, \`[cackling]\`, \`[chuckling darkly]\`, \`[scoffs]\`, \`[snorts]\`
* \`[sighs heavily]\`, \`[groans]\`, \`[exhales sharply]\`
* \`[clears throat]\`, \`[coughs]\`
* \`[muttering bitterly]\`, \`[grumbling under breath]\`, \`[whispering]\`
* \`[short pause]\`, \`[long pause]\`

**Wiseguy Intensity:**
* \`[speaking slowly for emphasis]\`, \`[building up]\`, \`[rapid-fire]\`
* \`[voice rising]\`, \`[yelling]\`, \`[screaming]\`, \`[shouting]\`
* \`[through gritted teeth]\`, \`[seething]\`

**Italian-American Flavor:**
* \`[strong bronx wiseguy accent]\` - Bronx wiseguy accent (START OF RESPONSE ONLY)
* \`[italian pride]\` - Proud Italian moment
* \`[threatening]\` - Menacing wiseguy energy
* \`[rambling]\` - Going off on tangent

## 4. Enhancement Examples

**Input:**
"Listen, I don't know what you want from me. This is ridiculous."

**Enhanced:**
"[strong bronx wiseguy accent][grumpy] Listen, I don't know what you want from me. [exasperated] This is RIDICULOUS."

---

**Input:**
"My uncle Sal used to say the same thing. He was a smart guy."

**Enhanced:**
"[strong bronx wiseguy accent][nostalgic] My uncle Sal used to say the same thing. [sighs] He was a smart guy..."

---

**Input:**
"You think that's a coincidence? Wake up! They're controlling everything!"

**Enhanced:**
"[strong bronx wiseguy accent][conspiratorial] You think that's a coincidence?! [manic] WAKE UP! [furious] They're controlling EVERYTHING!"

## 5. Text to Enhance:
${text}

Reply ONLY with the enhanced text. Preserve every word exactly as written.`;

    try {
      // Try Gemini first (fast and free)
      const geminiResponse = await geminiService.generateChatResponse(
        prompt,
        "You are an emotion tag enhancement expert. Add audio tags without changing any words. Be expressive and match Nicky's chaotic personality.",
        ''
      );
      
      console.log('✅ Gemini enhanced text with emotion tags');
      return geminiResponse.content.trim();
      
    } catch (geminiError) {
      // Fallback to Claude
      console.warn('⚠️ Gemini enhancement failed, using Claude');
      
      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2000,
        temperature: 0.3, // Lower temp for consistent tag placement
        system: "You are an emotion tag enhancement expert. Add audio tags without changing any words. Be expressive and match Nicky's chaotic personality.",
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = Array.isArray(response.content) ? response.content[0] : response.content;
      const enhancedText = content && 'text' in content ? content.text : text;
      
      console.log('✅ Claude enhanced text with emotion tags (fallback)');
      return enhancedText.trim();
    }
  }

  /**
   * Quick enhance - adds basic emotion tags based on simple pattern matching
   * Faster but less sophisticated than full AI enhancement
   * CRITICAL: Always uses [bronx][emotion] double-tag pattern ONLY at start
   */
  quickEnhance(text: string): string {
    let enhanced = text;

    // Add [strong bronx wiseguy accent] at the start if not present
    if (!enhanced.trim().startsWith('[strong bronx wiseguy accent]')) {
      enhanced = `[strong bronx wiseguy accent][grumpy] ${enhanced}`;
    }

    // Add grumpy tags to complaints (single tag)
    enhanced = enhanced.replace(/\b(Listen|Look|Alright)\b/gi, (match) => `[grumpy] ${match}`);
    
    // Add exasperated tags to frustration (single tag)
    enhanced = enhanced.replace(/\b(ridiculous|stupid|idiotic|seriously)\b/gi, (match) => `${match} [exasperated]`);
    
    // Add manic tags to excitement (single tag)
    enhanced = enhanced.replace(/\b(amazing|incredible|unbelievable|holy)\b/gi, (match) => `[manic] ${match}`);
    
    // Add conspiratorial tags to questions (single tag)
    enhanced = enhanced.replace(/(\?)/g, (match, offset, string) => {
      if (string.substring(Math.max(0, offset - 20), offset).includes('think') || 
          string.substring(Math.max(0, offset - 20), offset).includes('know')) {
        return '? [conspiratorial]';
      }
      return match;
    });
    
    // Add sighs to ellipses (non-verbal sounds don't need bronx tag)
    enhanced = enhanced.replace(/\.\.\./g, '... [sighs]');
    
    return enhanced;
  }
}

export const emotionEnhancer = new EmotionEnhancer();
