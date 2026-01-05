// Content filter to keep Nicky edgy but not cancel-worthy
export class ContentFilter {
  // Words/phrases that cross the line into cancel territory
  private readonly blockedTerms = [
    // Slurs and genuinely offensive epithets (patterns to catch variations)
    /\bn[i1!]gg[ae3]r/gi,
    /\bf[a4]gg?[0o]t/gi,
    /\br[e3]t[a4]rd/gi,
    /\btr[a4]nn[yi1]/gi,
    /\bc[o0]ck[s5]uck[e3]r/gi,
    /\bn[a4]z[i1]/gi,
    /\bk[i1]k[e3]/gi,
    /\bg[o0]y/gi,
    // Add other genuinely problematic terms as needed
  ];

  // Acceptable profanity that stays (Nicky's bread and butter)
  private readonly allowedProfanity = [
    'fuck', 'fucking', 'shit', 'damn', 'hell', 'ass', 'bitch', 'bastard', 
    'crap', 'piss', 'cock', 'pussy', 'tits', 'balls', 'dickhead'
  ];

  /**
   * Filters content to remove cancel-worthy language while preserving edgy profanity
   */
  filterContent(content: string): { filtered: string; wasFiltered: boolean } {
    let filtered = content;
    let wasFiltered = false;

    // 🚫 STRIP STAGE DIRECTIONS (Plain text narration of actions)
    filtered = this.stripStageDirections(filtered);

    // Check for and replace blocked terms
    for (const blockedPattern of this.blockedTerms) {
      if (blockedPattern.test(filtered)) {
        console.warn(`🚫 Content filter: Blocked term detected, replacing...`);
        // Replace with creative alternatives that maintain the energy
        filtered = filtered.replace(blockedPattern, this.getCreativeReplacement());
        wasFiltered = true;
      }
    }

    // If content was heavily filtered, add a fallback profanity to maintain edge
    if (wasFiltered && !this.hasAcceptableProfanity(filtered)) {
      filtered = this.addFallbackProfanity(filtered);
    }

    return { filtered, wasFiltered };
  }

  /**
   * Strips plain-text stage directions (e.g., "I'm shaking my head")
   */
  private stripStageDirections(content: string): string {
    // Patterns for "I'm [action]" or "I am [action]" that look like stage directions
    const actions = [
      'shakin\' my head', 'shaking my head', 
      'rubbin\' my temples', 'rubbing my temples', 
      'leanin\' back', 'leaning back', 
      'leanin\' in', 'leaning in',
      'wavin\' my hand', 'waving my hand',
      'shruggin\' my shoulders', 'shrugging my shoulders',
      'rollin\' my eyes', 'rolling my eyes',
      'noddin\' my head', 'nodding my head',
      'pacin\' the room', 'pacing the room',
      'takin\' a sip', 'taking a sip',
      'lightin\' a cigarette', 'lighting a cigarette',
      'adjustin\' my tie', 'adjusting my tie',
      'checkin\' my watch', 'checking my watch',
      'winking', 'winkin\'',
      'shrugging', 'shruggin\'',
      'sighing', 'sighin\'',
      'laughing', 'laughin\'',
      'furious', 'annoyed', 'pissed off', 'confused'
    ];

    const actionPattern = actions.join('|');
    // Match "I'm [action]" or "I am [action]" followed by punctuation or end of string
    // We only match if it's a standalone sentence or at the very start/end
    const regex = new RegExp(`(^|[.!?]\\s+)(I'm|I am) (${actionPattern})[.!?]`, 'gi');
    
    let result = content.replace(regex, (match, prefix) => {
      console.warn(`🚫 Content filter: Stripped plain-text stage direction: ${match}`);
      return prefix; 
    });

    // Also strip any remaining asterisk blocks just in case
    result = result.replace(/\*[^*]+\*/g, '');

    return result.trim();
  }

  /**
   * Checks if content has acceptable profanity
   */
  private hasAcceptableProfanity(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return this.allowedProfanity.some(word => lowerContent.includes(word));
  }

  /**
   * Gets a creative replacement for blocked terms
   */
  private getCreativeReplacement(): string {
    const replacements = [
      'PIECE OF SHIT',
      'FUCKING IDIOT', 
      'GODDAMN MORON',
      'ABSOLUTE DICKHEAD',
      'COMPLETE ASSHOLE',
      'TOTAL BASTARD'
    ];
    return replacements[Math.floor(Math.random() * replacements.length)];
  }

  /**
   * Adds fallback profanity to maintain edge when content was heavily filtered
   */
  private addFallbackProfanity(content: string): string {
    const fallbacks = [
      ' What the fuck?!',
      ' Goddamn it!',
      ' This is such bullshit!',
      ' Fucking unbelievable!'
    ];
    return content + fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /**
   * Validates if content is safe for publication
   */
  isContentSafe(content: string): boolean {
    return !this.blockedTerms.some(pattern => pattern.test(content));
  }
}

export const contentFilter = new ContentFilter();