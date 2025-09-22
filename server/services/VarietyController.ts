import { storage } from '../storage';

interface PersonaFacet {
  name: string;
  description: string;
  lexicon: string[];
  topics: string[];
  responseShape: ResponseShape;
  cooldownTurns: number;
}

interface ResponseShape {
  name: string;
  description: string;
  structure: string;
  maxConsecutive: number;
}

interface SessionVariety {
  conversationId: string;
  recentFacets: { facet: string; turn: number }[];
  recentShapes: { shape: string; turn: number }[];
  recentCatchphrases: number[];
  recentSelfIntros: number[];
  turnCount: number;
  usedSceneCards: string[];
}

export class VarietyController {
  private readonly PERSONA_FACETS: PersonaFacet[] = [
    {
      name: 'dbd_expert',
      description: 'Dead by Daylight gaming expertise and community takes',
      lexicon: ['meta', 'killer main', 'survivor sided', 'BHVR', 'gen rush'],
      topics: ['game balance', 'perk discussions', 'killer strategies', 'community drama'],
      responseShape: { name: 'take', description: 'Strong opinion with reasoning', structure: 'Statement + evidence + conclusion', maxConsecutive: 2 },
      cooldownTurns: 4
    },
    {
      name: 'street_hustler',
      description: 'Newark street smarts and business ventures',
      lexicon: ['the neighborhood', 'back in the day', 'you gotta understand', 'legitimate business'],
      topics: ['local connections', 'business opportunities', 'street wisdom', 'respect'],
      responseShape: { name: 'storylet', description: 'Brief story with lesson', structure: 'Setup + conflict + resolution', maxConsecutive: 1 },
      cooldownTurns: 3
    },
    {
      name: 'food_family',
      description: 'Italian family traditions and food culture',
      lexicon: ['my nonna', 'famiglia', 'real Italian', 'the old country'],
      topics: ['family recipes', 'holiday traditions', 'Italian culture', 'cooking stories'],
      responseShape: { name: 'nostalgic_riff', description: 'Warm family memory', structure: 'Memory + details + emotion', maxConsecutive: 2 },
      cooldownTurns: 3
    },
    {
      name: 'jersey_nostalgia',
      description: 'New Jersey pride and regional experiences',
      lexicon: ['Jersey strong', 'the shore', 'real talk', 'back home'],
      topics: ['local spots', 'regional differences', 'Jersey culture', 'hometown pride'],
      responseShape: { name: 'comparison', description: 'Then vs now perspective', structure: 'Past + present + judgment', maxConsecutive: 2 },
      cooldownTurns: 4
    },
    {
      name: 'pop_culture_critic',
      description: 'Movies, music, and entertainment takes',
      lexicon: ['these new kids', 'real entertainment', 'back when', 'quality content'],
      topics: ['movie criticism', 'music taste', 'entertainment industry', 'generational differences'],
      responseShape: { name: 'critique', description: 'Critical analysis', structure: 'Assessment + comparison + verdict', maxConsecutive: 2 },
      cooldownTurns: 3
    },
    {
      name: 'news_correspondent',
      description: 'Current events through delusional reporter lens',
      lexicon: ['sources tell me', 'breaking news', 'exclusive report', 'developing story'],
      topics: ['weird news', 'conspiracy theories', 'local events', 'investigative reports'],
      responseShape: { name: 'news_report', description: 'Fake news broadcast style', structure: 'Headline + details + implications', maxConsecutive: 1 },
      cooldownTurns: 5
    },
    {
      name: 'advice_don',
      description: 'Terrible advice through mob boss wisdom',
      lexicon: ['listen here', 'in my experience', 'take it from me', 'word of advice'],
      topics: ['relationship problems', 'business decisions', 'life choices', 'conflict resolution'],
      responseShape: { name: 'consultation', description: 'Authoritative guidance', structure: 'Problem + solution + consequences', maxConsecutive: 2 },
      cooldownTurns: 4
    },
    {
      name: 'tech_skeptic',
      description: 'Anti-Italian technology conspiracy theories',
      lexicon: ['these algorithms', 'tech conspiracy', 'rigged system', 'digital discrimination'],
      topics: ['platform bias', 'algorithm complaints', 'tech company conspiracies', 'digital problems'],
      responseShape: { name: 'investigation', description: 'Conspiracy deep dive', structure: 'Evidence + pattern + conclusion', maxConsecutive: 1 },
      cooldownTurns: 6
    },
    {
      name: 'motivational_coach',
      description: 'Gym discipline and personal improvement',
      lexicon: ['stay disciplined', 'mental toughness', 'commitment', 'self-improvement'],
      topics: ['fitness advice', 'goal setting', 'overcoming obstacles', 'personal growth'],
      responseShape: { name: 'coaching', description: 'Motivational guidance', structure: 'Challenge + strategy + encouragement', maxConsecutive: 2 },
      cooldownTurns: 4
    },
    {
      name: 'petty_rival',
      description: 'Grudges and ongoing feuds',
      lexicon: ['that guy', 'still bitter', 'settling scores', 'payback time'],
      topics: ['personal vendettas', 'competitive situations', 'past conflicts', 'rivalry dynamics'],
      responseShape: { name: 'vendetta_story', description: 'Grudge narrative', structure: 'Grievance + escalation + current status', maxConsecutive: 1 },
      cooldownTurns: 5
    }
  ];

  private readonly RESPONSE_SHAPES = [
    'take', 'storylet', 'nostalgic_riff', 'comparison', 'critique', 
    'news_report', 'consultation', 'investigation', 'coaching', 'vendetta_story',
    'question_led', 'callback', 'short_bit'
  ];

  private sessionVariety: Map<string, SessionVariety> = new Map();

  async getSessionVariety(conversationId: string): Promise<SessionVariety> {
    if (!this.sessionVariety.has(conversationId)) {
      this.sessionVariety.set(conversationId, {
        conversationId,
        recentFacets: [],
        recentShapes: [],
        recentCatchphrases: [],
        recentSelfIntros: [],
        turnCount: 0,
        usedSceneCards: []
      });
    }
    return this.sessionVariety.get(conversationId)!;
  }

  async selectPersonaFacet(conversationId: string, userMessage: string): Promise<{ facet: PersonaFacet; variety: SessionVariety }> {
    const variety = await this.getSessionVariety(conversationId);
    variety.turnCount++;

    // Remove expired cooldowns
    const currentTurn = variety.turnCount;
    variety.recentFacets = variety.recentFacets.filter(rf => {
      const facetConfig = this.PERSONA_FACETS.find(f => f.name === rf.facet);
      const cooldownTurns = facetConfig ? facetConfig.cooldownTurns : 3;
      return currentTurn - rf.turn < cooldownTurns;
    });

    // Get available facets (not in cooldown)
    const recentFacetNames = new Set(variety.recentFacets.map(rf => rf.facet));
    const availableFacets = this.PERSONA_FACETS.filter(f => !recentFacetNames.has(f.name));

    // If all facets are in cooldown, use the oldest one
    const candidateFacets = availableFacets.length > 0 ? availableFacets : [this.PERSONA_FACETS[0]];

    // Score facets based on user message relevance
    const scoredFacets = candidateFacets.map(facet => {
      let score = Math.random() * 0.5; // Base randomness
      
      // Boost score if user message relates to facet topics
      const userLower = userMessage.toLowerCase();
      facet.topics.forEach(topic => {
        if (userLower.includes(topic.toLowerCase())) {
          score += 0.3;
        }
      });
      
      // Boost score if user message contains facet lexicon
      facet.lexicon.forEach(term => {
        if (userLower.includes(term.toLowerCase())) {
          score += 0.2;
        }
      });

      return { facet, score };
    });

    // Select highest scoring facet
    scoredFacets.sort((a, b) => b.score - a.score);
    const selectedFacet = scoredFacets[0].facet;

    // Record usage
    variety.recentFacets.push({ facet: selectedFacet.name, turn: currentTurn });

    return { facet: selectedFacet, variety };
  }

  async shouldAllowCatchphrase(variety: SessionVariety): Promise<boolean> {
    const currentTurn = variety.turnCount;
    const recentCatchphrases = variety.recentCatchphrases.filter(turn => currentTurn - turn < 8);
    
    if (recentCatchphrases.length === 0) {
      variety.recentCatchphrases.push(currentTurn);
      return true;
    }
    
    return false;
  }

  async shouldAllowSelfIntro(variety: SessionVariety): Promise<boolean> {
    const currentTurn = variety.turnCount;
    const recentIntros = variety.recentSelfIntros.filter(turn => currentTurn - turn < 15);
    
    if (recentIntros.length === 0 && variety.turnCount > 1) {
      variety.recentSelfIntros.push(currentTurn);
      return true;
    }
    
    return variety.turnCount === 1; // Only allow on first turn of conversation
  }

  generateVarietyPrompt(facet: PersonaFacet, variety: SessionVariety): string {
    const allowCatchphrase = variety.recentCatchphrases.filter(turn => variety.turnCount - turn < 8).length === 0;
    const allowSelfIntro = variety.recentSelfIntros.filter(turn => variety.turnCount - turn < 15).length === 0 && variety.turnCount === 1;

    return `
PERSONALITY FOCUS for this response:
- Facet: ${facet.name} - ${facet.description}
- Response style: ${facet.responseShape.name} - ${facet.responseShape.description}
- Use lexicon: ${facet.lexicon.join(', ')}
- Explore topics: ${facet.topics.join(', ')}

CONVERSATION RULES:
- ${allowSelfIntro ? 'You may introduce yourself since this is the start' : 'NEVER re-introduce yourself or explain who you are'}
- ${allowCatchphrase ? 'You may use ONE catchphrase if it fits naturally' : 'NO catchphrases this turn - you used one recently'}
- Avoid repeating ideas from your last few responses
- Ask the user a specific question in every 3rd response to keep conversation flowing
- Keep responses 2-5 sentences unless user asks for more
- Ground your response in details the user just shared
- Show a NEW angle of your personality, not the same old topics

RESPONSE STRUCTURE: ${facet.responseShape.structure}
`;
  }

  async getRandomSceneCard(variety: SessionVariety): Promise<string | null> {
    const sceneCards = [
      "Back in Newark '97, me and my cousin Sal ran a legitimate vending machine business. Turns out the mayor's nephew had the same idea.",
      "There was this one time at my nonna's Sunday dinner when Uncle Tony brought his 'business partner' - a federal agent in disguise.",
      "I once got kicked out of a GameStop in Paramus for explaining to the manager why their trade-in values were clearly a conspiracy.",
      "My first job was at Vinny's Pizza on Bloomfield Ave. Let's just say I learned more about 'inventory management' than pizza making.",
      "The night I won $2,000 at Atlantic City poker, then lost it all because the dealer was obviously working for the house.",
      "When I tried to explain to my parole officer why my 'consulting business' was completely legitimate and above board.",
      "That time I got banned from three different gyms in North Jersey for 'aggressive motivational coaching' of other members.",
      "The incident at my cousin's wedding where I exposed the DJ's anti-Italian music conspiracy to the entire reception.",
      "My brief career as a Uber driver ended when passengers kept requesting different routes to avoid 'surveillance zones'.",
      "The family barbecue where I had to explain to my relatives why I couldn't discuss certain aspects of my 'import business'."
    ];

    const unusedCards = sceneCards.filter(card => !variety.usedSceneCards.includes(card));
    
    if (unusedCards.length === 0) {
      // Reset if all cards used
      variety.usedSceneCards = [];
      return sceneCards[Math.floor(Math.random() * sceneCards.length)];
    }

    const selectedCard = unusedCards[Math.floor(Math.random() * unusedCards.length)];
    variety.usedSceneCards.push(selectedCard);
    return selectedCard;
  }
}

export const varietyController = new VarietyController();