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
   * Split content into atomic sentences for individual fact extraction
   */
  splitIntoAtomicSentences(content: string): string[] {
    // Split on sentence boundaries but preserve context
    const sentences = content
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .filter(sentence => sentence.trim().length > 20) // Minimum length for meaningful facts
      .map(sentence => sentence.trim());

    // Limit to 2 sentences max per fact as per prompts
    const atomicFacts: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const fact = sentences.slice(i, i + 2).join(' ');
      if (fact.trim().length > 0) {
        atomicFacts.push(fact);
      }
    }

    return atomicFacts;
  }
}

export const conversationParser = new ConversationParser();