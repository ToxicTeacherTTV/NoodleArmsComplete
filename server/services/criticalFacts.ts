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
    // Check if response might be discussing this topic
    const isRelevant = criticalFact.keywords.some(keyword => 
      lowerResponse.includes(keyword.toLowerCase())
    );

    if (isRelevant) {
      // Check for wrong answers
      for (const wrongAnswer of criticalFact.wrongAnswers) {
        if (lowerResponse.includes(wrongAnswer.toLowerCase())) {
          violations.push({
            fact: criticalFact.fact,
            detected: wrongAnswer
          });
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
