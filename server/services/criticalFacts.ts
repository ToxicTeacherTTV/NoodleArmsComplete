/**
 * Critical Facts Protection System
 * 
 * Defines Nicky's core identity facts that MUST NEVER be contradicted by AI responses.
 * These facts are verified in every AI response to prevent character inconsistency.
 */

export interface CriticalFact {
  fact: string;
  keywords: string[]; // Keywords that might trigger this fact in a conversation
  correctAnswer: string; // The canonical correct answer
  wrongAnswers: string[]; // Common mistakes to detect
}

export const CRITICAL_FACTS: CriticalFact[] = [
  {
    fact: "Nicky's killer main",
    keywords: ["main", "killer", "play", "favorite killer", "who do you play", "your killer"],
    correctAnswer: "The Twins",
    wrongAnswers: ["Claudette", "Meg", "Dwight", "Nurse", "Huntress", "Ghostface", "Spirit", "Legion", "Trapper", "Wraith"]
  },
  {
    fact: "Nicky's role",
    keywords: ["killer", "survivor", "are you a", "do you play"],
    correctAnswer: "killer main",
    wrongAnswers: ["survivor", "survivor main", "I play survivor"]
  },
  {
    fact: "Nicky's character archetype",
    keywords: ["who are you", "what are you", "personality"],
    correctAnswer: "Italian-American AI with personality quirks",
    wrongAnswers: ["just an AI", "generic bot", "assistant"]
  },
  {
    fact: "Nicky's podcast role",
    keywords: ["podcast", "host", "co-host"],
    correctAnswer: "podcast co-host",
    wrongAnswers: ["not on podcast", "don't do podcasts"]
  },
  {
    fact: "Nicky's game",
    keywords: ["game", "what game", "play"],
    correctAnswer: "Dead by Daylight",
    wrongAnswers: ["other games", "multiple games", "not DBD"]
  }
];

/**
 * Validate AI response against critical facts
 * Returns violations if any critical facts are contradicted
 */
export function validateResponseAgainstCriticalFacts(response: string): {
  isValid: boolean;
  violations: Array<{ fact: string; detected: string }>;
} {
  const violations: Array<{ fact: string; detected: string }> = [];
  const lowerResponse = response.toLowerCase();

  for (const criticalFact of CRITICAL_FACTS) {
    // Robust first-person detection with regex (handles punctuation and natural speech)
    const firstPersonPatterns = [
      /\bi\b/i,           // "I" as standalone word
      /\bmy\b/i,          // "my" as standalone word
      /\bme\b/i,          // "me" as standalone word
      /\bi'm\b/i,         // "I'm"
      /\bi've\b/i,        // "I've"
      /\bi\s+main\b/i,    // "I main" (with filler words)
      /\bmy\s+main\b/i,   // "my main"
      /\bnicky\b/i        // "Nicky" (self-reference)
    ];
    
    // Check if response is about Nicky (first-person) AND contains relevant keywords
    const hasFirstPerson = firstPersonPatterns.some(pattern => 
      pattern.test(lowerResponse)
    );
    
    const hasKeyword = criticalFact.keywords.some(keyword => 
      lowerResponse.includes(keyword.toLowerCase())
    );
    
    // Only validate if BOTH first-person and keyword are present (Nicky talking about himself)
    const isRelevant = hasFirstPerson && hasKeyword;

    if (isRelevant) {
      // CRITICAL: Check for correct answer with variants (tolerant matching)
      const correctVariants = [
        criticalFact.correctAnswer.toLowerCase(),
        criticalFact.correctAnswer.toLowerCase().replace('the ', ''), // "Twins" instead of "The Twins"
      ];
      
      const hasCorrectAnswer = correctVariants.some(variant => 
        lowerResponse.includes(variant)
      );
      
      // Check for wrong answers (pre-listed)
      const hasWrongAnswer = criticalFact.wrongAnswers.some(wrongAnswer => 
        lowerResponse.includes(wrongAnswer.toLowerCase())
      );
      
      // CRITICAL: Detect ANY alternate killer claims (not just pre-listed)
      // For killer main fact, look for "main/mains/maining [Name]" patterns that aren't the correct answer
      let hasAlternateKillerClaim = false;
      if (criticalFact.fact === "Nicky's killer main") {
        // Match "main(s)/maining" followed by words (killer names) that aren't "The Twins" or "Twins"
        // Use case-insensitive pattern on original response to catch capitalized names
        const killerMainPattern = /\b(main|mains|maining)\s+(?:the\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi;
        const matches = Array.from(response.matchAll(killerMainPattern));
        
        for (const match of matches) {
          const claimedKillers = match[2];
          // Split on conjunctions and commas to handle "Twins and Pyramid Head" or "Twins, Pyramid Head"
          const individualKillers = claimedKillers.split(/\s+(?:and|or|,)\s+|,\s*/gi);
          
          for (const killer of individualKillers) {
            const killerLower = killer.toLowerCase().trim();
            // Check if this individual killer is NOT the correct answer (or its variant)
            if (killerLower && killerLower !== 'twins' && killerLower !== 'the twins' && !killerLower.includes('twin')) {
              hasAlternateKillerClaim = true;
              violations.push({
                fact: criticalFact.fact,
                detected: `Alternate killer claim: "main ${killer.trim()}"`
              });
              break; // Only report one alternate killer per match
            }
          }
        }
      }
      
      // Violation if: no correct answer OR has wrong answer OR has alternate claim
      if (!hasCorrectAnswer || hasWrongAnswer) {
        if (!hasCorrectAnswer) {
          violations.push({
            fact: criticalFact.fact,
            detected: `Missing correct answer: ${criticalFact.correctAnswer}`
          });
        }
        
        if (hasWrongAnswer) {
          const detected = criticalFact.wrongAnswers.find(wa => 
            lowerResponse.includes(wa.toLowerCase())
          );
          violations.push({
            fact: criticalFact.fact,
            detected: `Wrong answer detected: ${detected}`
          });
        }
      }
      
      // Check for negations and contradictions with robust regex (handles intervening words)
      const factKeyword = criticalFact.correctAnswer.toLowerCase().replace(/^the\s+/, ''); // "twins" from "The Twins"
      const negationPatterns = [
        new RegExp(`\\b(don't|do not|doesn't|does not)\\s+[^.]*\\b${factKeyword}\\b`, 'i'),
        new RegExp(`\\b(not|no|never)\\s+[^.]*\\b${factKeyword}\\b`, 'i'),
        new RegExp(`\\b(stopped|quit|changed from)\\s+[^.]*\\b${factKeyword}\\b`, 'i'),
        new RegExp(`\\b(used to|formerly|no longer)\\s+[^.]*\\b${factKeyword}\\b`, 'i'),
        new RegExp(`\\bisn't\\s+[^.]*\\b${factKeyword}\\b`, 'i'),
        new RegExp(`\\baren't\\s+[^.]*\\b${factKeyword}\\b`, 'i')
      ];
      
      for (const negationPattern of negationPatterns) {
        if (negationPattern.test(lowerResponse)) {
          const match = lowerResponse.match(negationPattern);
          violations.push({
            fact: criticalFact.fact,
            detected: `Negation detected: "${match?.[0] || 'negation pattern'}"`
          });
          break; // Only report one negation per fact
        }
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}

/**
 * Get critical facts as a formatted string for AI system prompts
 */
export function getCriticalFactsPrompt(): string {
  return `
🚨 CRITICAL IDENTITY FACTS - NEVER CONTRADICT THESE:

${CRITICAL_FACTS.map(fact => 
  `- ${fact.fact}: ${fact.correctAnswer}`
).join('\n')}

IF ASKED ABOUT THESE TOPICS, YOU MUST USE THE EXACT FACTS ABOVE. DO NOT IMPROVISE OR GUESS.
`;
}

/**
 * Get critical facts for personality context
 */
export function getCriticalFactsForContext(): string {
  return CRITICAL_FACTS.map(fact => 
    `${fact.fact}: ${fact.correctAnswer}`
  ).join('\n');
}
