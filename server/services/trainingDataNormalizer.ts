
export class TrainingDataNormalizer {

  public normalize(content: string): string {
    let clean = content;
    
    // 0. Canonical Accent (The New Standard)
    const NEW_ACCENT = '[thick italian-italian american nyc accent]';

    // 1. Strip Metadata Lines
    clean = clean.replace(/\[Mode:.*?\]\s*(\r\n|\n)?/gi, '');
    clean = clean.replace(/\[Quality Score:.*?\]\s*(\r\n|\n)?/gi, '');
    clean = clean.replace(/\[Source:.*?\]\s*(\r\n|\n)?/gi, '');

    // 2. Fix Double Brackets & Escaped Brackets
    clean = clean.replace(/\[\[(.*?)\]\]/g, '[$1]');
    clean = clean.replace(/\\\[/g, '[').replace(/\\\]/g, ']');

    // 3. Normalize Accent Tag (First tag only)
    const firstTagMatch = clean.match(/^(\s*)\[(.*?)\]/);
    if (firstTagMatch) {
      const fullMatch = firstTagMatch[0];
      const tagContent = firstTagMatch[2].toLowerCase();

      // If it's an accent tag (even the old one), replace with NEW_ACCENT
      if (tagContent.includes('bronx') || tagContent.includes('accent') || tagContent.includes('wiseguy')) {
        clean = clean.replace(fullMatch, `${firstTagMatch[1]}${NEW_ACCENT}`);
      }
    } else {
        // If no tag at all, prepend the accent? No, safest to leave it for Validator to flag or Autocorrect to fix.
    }

    // 4. Semantic Mapping (Verbose -> Simple)
    const emotionMap: Record<string, string> = {
      'yelling furiously': 'yelling',
      'shouting accusingly': 'yelling',
      'screaming': 'screaming',
      'grumbling bitterly': 'grumbling',
      'annoyed grumbling': 'grumbling',
      'speaking sarcastically': 'sarcastic',
      'sarcastic muttering': 'sarcastic',
      'chuckling mischievously': 'chuckling',
      'speaking with feigned calm': 'sarcastic',
      'voice dripping with disgust': 'disgusted',
      'voice rising': 'heated',
      'speaking defensively': 'defensive',
      'sighing dramatically': 'sighing',
      'muttering angrily': 'muttering',
      'incredulous sputtering': 'incredulous',
      // Map old accent patterns just in case
      'strong bronx wiseguy accent': 'thick italian-italian american nyc accent'
    };

    for (const [verbose, simple] of Object.entries(emotionMap)) {
      const globalRegex = new RegExp(`\\[\\s*${verbose}\\s*\\]`, 'gi');
      clean = clean.replace(globalRegex, `[${simple}]`);
    }
    
    // 5. Enforce Spacing Rules (The Audio Format)
    // Rule: Space between tags: ][ -> ] [
    clean = clean.replace(/\]\[/g, '] [');
    
    // Rule: No newline after tags: ] \n -> ] 
    // We look for a closing bracket, identifying it's a tag, followed by newline
    clean = clean.replace(/(\[[^\]]+\])\s*[\r\n]+\s*/g, '$1 ');

    // 6. Strip Markdown Formatting
    clean = clean.replace(/(\*|_)/g, '');

    // 7. Cleanup Backslashes
    clean = clean.replace(/\\/g, '');

    return clean.trim();
  }
}

export const trainingDataNormalizer = new TrainingDataNormalizer();
