/**
 * 📝 Conversation Parser Service
 * Separates user questions from Nicky responses in conversation transcripts
 */

interface ConversationTurn {
  speaker: 'user' | 'nicky' | 'unknown';
  content: string;
  originalIndex: number;
}

interface ParsedConversation {
  turns: ConversationTurn[];
  nickyContent: string;
  userContent: string;
  totalTurns: number;
}

export class ConversationParser {
  
  /**
   * Parse conversation text into separate turns for user and Nicky
   */
  parseConversation(content: string, filename: string = ''): ParsedConversation {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const turns: ConversationTurn[] = [];
    let currentTurn = '';
    let currentSpeaker: 'user' | 'nicky' | 'unknown' = 'unknown';
    let lineIndex = 0;

    // Patterns to identify speakers
    const userPatterns = [
      /^(you|user|me|i)[\s:]+(.*)/i,
      /^### (.*)/,  // Common user input format
      /^> (.*)/,    // Quote-style user input
      /^\*\*user\*\*[\s:]+(.*)/i,
      /^user[\s:]+(.*)/i,
    ];

    const nickyPatterns = [
      /^(nicky|dente|noodle arms?)[\s:]+(.*)/i,
      /^assistant[\s:]+(.*)/i,
      /^\*\*assistant\*\*[\s:]+(.*)/i,
      /^\*\*nicky\*\*[\s:]+(.*)/i,
    ];

    for (const line of lines) {
      let foundSpeaker = false;
      let extractedContent = '';

      // Check for user patterns
      for (const pattern of userPatterns) {
        const match = line.match(pattern);
        if (match) {
          // Save previous turn if exists
          if (currentTurn.trim()) {
            turns.push({
              speaker: currentSpeaker,
              content: currentTurn.trim(),
              originalIndex: lineIndex - 1
            });
          }
          
          currentSpeaker = 'user';
          currentTurn = match[1] || match[2] || line;
          foundSpeaker = true;
          break;
        }
      }

      // Check for Nicky patterns if not user
      if (!foundSpeaker) {
        for (const pattern of nickyPatterns) {
          const match = line.match(pattern);
          if (match) {
            // Save previous turn if exists
            if (currentTurn.trim()) {
              turns.push({
                speaker: currentSpeaker,
                content: currentTurn.trim(),
                originalIndex: lineIndex - 1
              });
            }
            
            currentSpeaker = 'nicky';
            currentTurn = match[1] || match[2] || line;
            foundSpeaker = true;
            break;
          }
        }
      }

      // If no speaker pattern found, add to current turn
      if (!foundSpeaker) {
        if (currentTurn) {
          currentTurn += '\n' + line;
        } else {
          // No current turn, try to infer speaker from content
          currentSpeaker = this.inferSpeaker(line);
          currentTurn = line;
        }
      }

      lineIndex++;
    }

    // Add final turn
    if (currentTurn.trim()) {
      turns.push({
        speaker: currentSpeaker,
        content: currentTurn.trim(),
        originalIndex: lineIndex - 1
      });
    }

    // Separate content by speaker
    const nickyTurns = turns.filter(turn => turn.speaker === 'nicky');
    const userTurns = turns.filter(turn => turn.speaker === 'user');

    const nickyContent = nickyTurns.map(turn => turn.content).join('\n\n');
    const userContent = userTurns.map(turn => turn.content).join('\n\n');

    console.log(`🎭 Parsed conversation: ${turns.length} total turns (${nickyTurns.length} Nicky, ${userTurns.length} user)`);

    return {
      turns,
      nickyContent,
      userContent,
      totalTurns: turns.length
    };
  }

  /**
   * Infer speaker from content when no explicit markers exist
   */
  private inferSpeaker(content: string): 'user' | 'nicky' | 'unknown' {
    const lower = content.toLowerCase();
    
    // Strong Nicky indicators
    const nickyIndicators = [
      'noodle arms', 'dente', 'camping them softly', 'earl', 'vice don',
      'mafia', 'pasta', 'italian', 'dead by daylight', 'dbd',
      'survivors', 'killers', 'hook', 'generator'
    ];

    // Question patterns (usually user)
    const questionPatterns = [
      /^(what|how|why|when|where|who|can you|do you|are you|will you|should)/i,
      /\?$/,
      /^(tell me|explain|describe)/i
    ];

    // First person patterns (could be either, need context)
    const firstPersonPatterns = [
      /^(i |i'm |i've |i'll |my |me |myself)/i
    ];

    // Count Nicky indicators
    const nickyScore = nickyIndicators.filter(indicator => lower.includes(indicator)).length;
    
    // Check question patterns
    const isQuestion = questionPatterns.some(pattern => pattern.test(content));
    
    // Check first person
    const isFirstPerson = firstPersonPatterns.some(pattern => pattern.test(content));

    // Scoring logic
    if (nickyScore >= 2) return 'nicky';
    if (isQuestion) return 'user';
    if (isFirstPerson && nickyScore === 0) return 'user';
    if (nickyScore >= 1) return 'nicky';
    
    return 'unknown';
  }

  /**
   * Extract only content that should be processed for facts (Nicky's responses)
   */
  extractFactRelevantContent(content: string, filename: string = ''): string {
    const parsed = this.parseConversation(content, filename);
    
    // Only return Nicky's content for fact extraction
    if (parsed.nickyContent.trim().length === 0) {
      console.log(`⚠️ No Nicky content found in ${filename}, falling back to full content`);
      return content; // Fallback to original content if no Nicky content detected
    }

    console.log(`✂️ Extracted ${parsed.nickyContent.length} chars of Nicky content from ${parsed.totalTurns} turns`);
    return parsed.nickyContent;
  }

  /**
   * Split content into meaningful atomic facts with preserved context
   */
  splitIntoAtomicSentences(content: string): string[] {
    // Parse conversation to extract meaningful context
    const parsed = this.parseConversation(content);
    
    // Extract key context elements from the full content
    const contextElements = this.extractContextElements(content);
    
    // Split on sentence boundaries
    const sentences = content
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .filter(sentence => sentence.trim().length > 20)
      .map(sentence => sentence.trim());

    const atomicFacts: string[] = [];
    
    for (let i = 0; i < sentences.length; i += 2) {
      const sentenceGroup = sentences.slice(i, i + 2);
      const combinedSentences = sentenceGroup.join(' ');
      
      // Check if this group contains meaningful factual content
      if (this.isMeaningfulFact(combinedSentences, contextElements)) {
        // Add context if the sentences contain pronouns or location references without clear antecedents
        const enrichedFact = this.enrichWithContext(combinedSentences, contextElements);
        atomicFacts.push(enrichedFact);
      }
    }

    return atomicFacts;
  }

  /**
   * Extract important context elements from the full content
   */
  private extractContextElements(content: string): { locations: string[], characters: string[], topics: string[] } {
    const locations = [];
    const characters = [];
    const topics = [];

    // Extract location names (capitalized words that might be places)
    const locationMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const knownLocations = ['Nagoya', 'Berlin', 'Tokyo', 'Castle', 'Underground', 'Osu', 'Shopping', 'District'];
    locations.push(...locationMatches.filter(match => 
      knownLocations.some(loc => match.includes(loc)) || 
      /\b(Street|Castle|District|Underground|Shopping|Temple|Park|Station)\b/i.test(match)
    ));

    // Extract character names and references
    const characterMatches = content.match(/\b(Nicky|Dente|Earl|Vice Don|Sal|Toxic|SABAM)\b/gi) || [];
    const uniqueCharacters = Array.from(new Set(characterMatches.map(c => c.toLowerCase())));
    characters.push(...uniqueCharacters);

    // Extract topic keywords
    const topicMatches = content.match(/\b(Dead by Daylight|DBD|killer|survivor|mafia|pasta|family|business|respect|territory)\b/gi) || [];
    const uniqueTopics = Array.from(new Set(topicMatches.map(t => t.toLowerCase())));
    topics.push(...uniqueTopics);

    return { 
      locations: Array.from(new Set(locations)), 
      characters: Array.from(new Set(characters)), 
      topics: Array.from(new Set(topics)) 
    };
  }

  /**
   * Check if a sentence group contains meaningful factual content
   */
  private isMeaningfulFact(sentences: string, contextElements: any): boolean {
    // Skip pure questions without factual content
    if (/^[^.!]*\?$/.test(sentences.trim())) {
      return false;
    }

    // Skip dialogue that's just pleasantries or generic responses
    const genericPhrases = [
      /^(yeah|yes|no|okay|sure|right|well|so|and|but|or)\b/i,
      /^you got business there/i,
      /just tryin.* to expand/i,
      /what.*you.*think/i,
      /how.*you.*feel/i
    ];
    
    if (genericPhrases.some(pattern => pattern.test(sentences))) {
      return false;
    }

    // Keep sentences that contain specific factual information
    const factualIndicators = [
      ...contextElements.locations,
      ...contextElements.characters,
      ...contextElements.topics,
      'family', 'business', 'respect', 'territory', 'mafia', 'dente'
    ];

    return factualIndicators.some(indicator => 
      sentences.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Enrich sentences with context if they contain unclear references
   */
  private enrichWithContext(sentences: string, contextElements: any): string {
    let enriched = sentences;

    // If sentences contain "there" without clear reference, add location context
    if (/\bthere\b/i.test(sentences) && contextElements.locations.length > 0) {
      const primaryLocation = contextElements.locations[0];
      enriched = `In ${primaryLocation}: ${sentences}`;
    }

    // If sentences contain "he/she/they" without clear reference, add character context
    if (/\b(he|she|they)\b/i.test(sentences) && contextElements.characters.length > 0) {
      const primaryCharacter = contextElements.characters.find((c: string) => c.includes('nicky') || c.includes('dente')) || contextElements.characters[0];
      enriched = enriched.replace(/\b(he|she)\b/gi, primaryCharacter);
    }

    return enriched;
  }
}

export const conversationParser = new ConversationParser();