/**
 * 🎙️ Content Suggestion Service
 * Generates podcast topic suggestions when user asks "What should we talk about?"
 */

import { storage } from '../storage.ts';
import { VarietyController } from './VarietyController.ts';
import { ContentCollectionManager } from './ingestion/ContentCollectionManager.ts';

interface ContentSuggestion {
  topic: string;
  angle: string;
  personality_facet: string;
  content_source: 'personality' | 'reddit' | 'memory' | 'hybrid';
  reasoning: string;
}

interface SuggestionResponse {
  suggestions: ContentSuggestion[];
  nickyResponse: string;
  variety_info: {
    facet_used: string;
    facet_description: string;
  };
}

export class ContentSuggestionService {
  private varietyController: VarietyController;
  private contentManager: ContentCollectionManager;
  private recentSuggestions: Map<string, string[]> = new Map(); // conversationId -> recent topics

  constructor() {
    this.varietyController = new VarietyController();
    this.contentManager = new ContentCollectionManager();
  }

  /**
   * Detect if user message is asking for content suggestions
   */
  isContentSuggestionRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    const patterns = [
      /what should we talk about/,
      /what should we cover/,
      /any topic suggestions/,
      /what topics do you have/,
      /give me some ideas/,
      /what content should/,
      /suggest some topics/,
      /what do you want to discuss/,
      /what's on your mind/,
      /got any ideas/
    ];

    return patterns.some(pattern => pattern.test(lowerMessage));
  }

  /**
   * Generate content suggestions based on personality facets, Reddit content, and memories
   */
  async generateSuggestions(
    conversationId: string,
    profileId: string,
    userMessage: string
  ): Promise<SuggestionResponse> {
    console.log('🎯 Generating content suggestions for conversation:', conversationId);

    // Get personality facet for this suggestion session
    const { facet } = await this.varietyController.selectPersonaFacet(conversationId, userMessage);
    
    // Get recent suggestions to avoid repetition
    const recentTopics = this.recentSuggestions.get(conversationId) || [];
    
    // Generate suggestions from different sources
    const suggestions: ContentSuggestion[] = [];
    
    // 1. Personality-driven suggestions
    const personalitySuggestion = await this.generatePersonalitySuggestion(facet, recentTopics);
    if (personalitySuggestion) suggestions.push(personalitySuggestion);
    
    // 2. Reddit content suggestions 
    const redditSuggestion = await this.generateRedditSuggestion(facet, recentTopics);
    if (redditSuggestion) suggestions.push(redditSuggestion);
    
    // 3. Memory-based suggestions (unused stories)
    const memorySuggestion = await this.generateMemorySuggestion(profileId, facet, recentTopics);
    if (memorySuggestion) suggestions.push(memorySuggestion);

    // Generate Nicky's response about these suggestions
    const nickyResponse = this.generateNickyResponse(facet, suggestions);
    
    // Track suggestions to avoid immediate repeats
    const suggestedTopics = suggestions.map(s => s.topic);
    this.updateRecentSuggestions(conversationId, suggestedTopics);

    return {
      suggestions,
      nickyResponse,
      variety_info: {
        facet_used: facet.name,
        facet_description: facet.description
      }
    };
  }

  /**
   * Generate suggestion based on current personality facet
   */
  private async generatePersonalitySuggestion(
    facet: any,
    recentTopics: string[]
  ): Promise<ContentSuggestion | null> {
    // Select a topic from the facet that hasn't been recently suggested
    const availableTopics = facet.topics.filter((topic: string) => 
      !recentTopics.some(recent => recent.toLowerCase().includes(topic.toLowerCase()))
    );
    
    if (availableTopics.length === 0) return null;
    
    const selectedTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)];
    
    // Generate a Nicky-specific angle on this topic
    const angles = this.getTopicAngles(selectedTopic, facet.name);
    const selectedAngle = angles[Math.floor(Math.random() * angles.length)];
    
    return {
      topic: selectedTopic,
      angle: this.tightenAngle(selectedAngle, facet.name),
      personality_facet: facet.name,
      content_source: 'personality',
      reasoning: `From ${facet.description} - fits your current vibe`
    };
  }

  /**
   * Generate suggestion from recent Reddit content
   */
  private async generateRedditSuggestion(
    facet: any,
    recentTopics: string[]
  ): Promise<ContentSuggestion | null> {
    try {
      // Get recent pending content from storage (Reddit content gets stored as pending content)
      const pendingItems = await storage.getPendingContent('', false); // Get unprocessed items
      
      if (pendingItems.length === 0) return null;
      
      // Filter out recently suggested content
      const availableContent = pendingItems.filter((item: any) => 
        !recentTopics.some(recent => 
          recent.toLowerCase().includes(item.title.toLowerCase())
        )
      );
      
      if (availableContent.length === 0) return null;
      
      const selectedContent = availableContent[Math.floor(Math.random() * availableContent.length)];
      
      // Generate Nicky's angle on this Reddit content
      const nickyAngle = this.generateRedditAngle(selectedContent, facet.name);
      
      return {
        topic: selectedContent.title || 'Reddit Content',
        angle: nickyAngle,
        personality_facet: facet.name,
        content_source: 'reddit',
        reasoning: `Fresh from Reddit - recent content stream`
      };
    } catch (error) {
      console.error('Failed to generate Reddit suggestion:', error);
      return null;
    }
  }

  /**
   * Generate suggestion from unused memories/stories
   */
  private async generateMemorySuggestion(
    profileId: string,
    facet: any,
    recentTopics: string[]
  ): Promise<ContentSuggestion | null> {
    try {
      // Get memories with low retrieval counts (unused stories)
      const allMemories = await storage.getMemoryEntries(profileId, 50);
      const unusedMemories = allMemories.filter((memory: any) => 
        (memory.retrievalCount || 0) <= 2 // Low usage memories
      );
      
      if (unusedMemories.length === 0) return null;
      
      // Filter for story-type memories that match the current facet
      const relevantMemories = unusedMemories.filter((memory: any) => 
        (memory.type === 'STORY' || memory.type === 'LORE') &&
        !recentTopics.some(recent => 
          recent.toLowerCase().includes(memory.content.substring(0, 30).toLowerCase())
        )
      );
      
      if (relevantMemories.length === 0) return null;
      
      const selectedMemory = relevantMemories[Math.floor(Math.random() * relevantMemories.length)];
      
      return {
        topic: this.extractTopicFromMemory(selectedMemory.content),
        angle: `Tell the full story behind: "${selectedMemory.content.substring(0, 50)}..."`,
        personality_facet: facet.name,
        content_source: 'memory',
        reasoning: 'Unused story from your past - time to bring it back'
      };
    } catch (error) {
      console.error('Failed to generate memory suggestion:', error);
      return null;
    }
  }

  /**
   * Generate Nicky's response about the suggestions
   */
  private generateNickyResponse(facet: any, suggestions: ContentSuggestion[]): string {
    const facetStyle = this.getFacetResponseStyle(facet.name);
    const suggestionCount = suggestions.length;
    const ideaWord = suggestionCount === 1 ? 'idea' : 'ideas';
    
    let response = `${facetStyle.opener} `;
    
    if (suggestionCount === 0) {
      response += "Ay, I'm drawin' a blank here! Maybe we just wing it and see what happens? Sometimes the best content comes from nowhere, you know what I'm sayin'?";
    } else {
      response += `I got ${suggestionCount} ${ideaWord} brewin' for ya:\n\n`;
      
      suggestions.forEach((suggestion, index) => {
        // Make topics more specific and personal
        const specificTopic = this.personalizeTopic(suggestion.topic, facet.name, suggestionCount > 1);
        response += `${index + 1}. **${specificTopic}** - ${suggestion.angle}\n\n`;
      });
      
      response += facetStyle.closer;
    }
    
    return response;
  }

  /**
   * Get topic angles based on personality facet
   */
  private getTopicAngles(topic: string, facetName: string): string[] {
    const anglesByFacet: Record<string, string[]> = {
      'dbd_expert': [
        'Why this breaks the game completely',
        'How survivors will definitely abuse this',
        'The killer perspective everyone ignores',
        'Why BHVR will probably mess this up'
      ],
      'street_hustler': [
        'How this connects to my Newark business ventures',
        'The street-smart way to handle this situation',
        'What my neighborhood contacts would say',
        'The legitimate business opportunities here'
      ],
      'food_family': [
        'How nonna would have handled this',
        'The family dinner conversation about this',
        'Traditional Italian take on this topic',
        'What this reminds me of from the old country'
      ],
      'jersey_nostalgia': [
        'How this was different back in Little Italy',
        'Why Jersey people understand this better',
        'Comparing this to how it used to be',
        'The authentic neighborhood perspective'
      ],
      'pop_culture_critic': [
        'Why modern takes on this are all wrong',
        'How this compares to the classics',
        'What\'s wrong with how kids see this today',
        'The generational divide on this topic'
      ]
    };
    
    return anglesByFacet[facetName] || [
      'My hot take on this',
      'The angle nobody else talks about',
      'Why this matters more than people think',
      'The Nicky perspective on this situation'
    ];
  }

  /**
   * Generate Nicky's angle on Reddit content
   */
  private generateRedditAngle(content: any, facetName: string): string {
    const redditAngles: Record<string, string[]> = {
      'dbd_expert': [
        'And here\'s why this proves DbD players are losing their minds',
        'This is exactly what I was talking about with the meta',
        'See? This is why I don\'t trust survivor mains'
      ],
      'news_correspondent': [
        'Breaking: Sources tell me this connects to a larger conspiracy',
        'Exclusive report on what this really means',
        'Field investigation into the deeper truth here'
      ],
      'street_hustler': [
        'This reminds me of a similar situation back in Newark',
        'There\'s definitely a business angle here nobody\'s seeing',
        'My street sources would have handled this differently'
      ]
    };
    
    const angles = redditAngles[facetName] || ['Here\'s my take on this situation'];
    return angles[Math.floor(Math.random() * angles.length)];
  }

  /**
   * Get response style for each facet (Nicky's authentic grumpy personality)
   */
  private getFacetResponseStyle(facetName: string): { opener: string; closer: string } {
    const styles: Record<string, { opener: string; closer: string }> = {
      'dbd_expert': {
        opener: 'Christ, you want ideas? Fine, here\'s what\'s pissing me off about games:',
        closer: 'Pick one, I don\'t care. They\'re all gonna annoy me anyway.'
      },
      'street_hustler': {
        opener: 'Ay, you want the real deal? Here\'s some shit from the neighborhood:',
        closer: 'Don\'t say I didn\'t warn ya when this gets ugly.'
      },
      'food_family': {
        opener: 'Madonna mia, fine, here\'s some family stuff that\'s been bugging me:',
        closer: 'Nonna\'s rolling in her grave watching what passes for content these days.'
      },
      'jersey_nostalgia': {
        opener: 'You wanna talk? Here\'s some crap from back home that still gets me heated:',
        closer: 'Jersey\'s gone to hell, but whatever, pick your poison.'
      },
      'pop_culture_critic': {
        opener: 'Jesus, everything\'s garbage now. Here\'s what I\'m pissed about today:',
        closer: 'Kids today wouldn\'t know real content if it bit \'em in the ass.'
      }
    };
    
    return styles[facetName] || {
      opener: 'What, you can\'t think of your own topics? Alright, here:',
      closer: 'There, happy? Pick one and let\'s get this over with.'
    };
  }

  /**
   * Make topics more specific and personal using Nicky's lexicon
   */
  private personalizeTopic(topic: string, facetName: string, isMultiple: boolean): string {
    console.log(`🔍 DEBUG personalizeTopic: topic="${topic}", facetName="${facetName}", isMultiple=${isMultiple}`);
    
    // If topic is already specific enough, keep it
    if (topic.length > 20 && !this.isGenericTopic(topic)) {
      console.log(`✅ Topic already specific enough: "${topic}"`);
      return topic;
    }
    
    // Transform generic topics into authentically pissed-off Nicky topics
    const personalizedTopics: Record<string, string[]> = {
      'dbd_expert': [
        'Why every DbD update makes the game worse',
        'These entitled survivor mains ruining everything',
        'BHVR doesn\'t give a shit about killer players'
      ],
      'street_hustler': [
        'That Newark parking situation is a complete scam',
        'Why Wawa ain\'t what it used to be',
        'These gentrification assholes destroying the neighborhood'
      ],
      'food_family': [
        'What they\'re calling "Italian food" these days is insulting',
        'Why nobody knows how to cook anymore',
        'The family recipe disaster from last week'
      ],
      'jersey_nostalgia': [
        'How they completely destroyed Little Italy',
        'That Atlantic City bullshit nobody talks about',
        'Why everything was better back in the day'
      ],
      'pop_culture_critic': [
        'These kids don\'t appreciate real music anymore',
        'Why modern movies are complete garbage',
        'Social media rotting everyone\'s brains'
      ],
      'overly_excited': [
        'This AMAZING thing that happened to me yesterday',
        'The BEST fucking story you\'ve never heard',
        'Why everything is SO MUCH BETTER than people think'
      ],
      'conspiracy_theories': [
        'The real reason they don\'t want you knowing about this',
        'How they\'re covering up the obvious truth',
        'Why the government doesn\'t want you talking about this'
      ],
      'deadpan': [
        'Another boring thing that somehow matters',
        'Why people get excited about absolutely nothing',
        'The least interesting story that everyone cares about'
      ],
      'angry_rants': [
        'What\'s really pissing me off about this situation',
        'Why I\'m completely done with this bullshit',
        'The thing that\'s driving me absolutely insane'
      ],
      'psycho': [
        'The twisted shit nobody wants to acknowledge',
        'Why normal people can\'t handle the truth',
        'The dark reality everyone\'s ignoring'
      ]
    };
    
    const facetTopics = personalizedTopics[facetName] || [
      'That thing nobody wants to admit',
      'The real story behind the headlines',
      'Why everything\'s backwards these days'
    ];
    
    console.log(`🎯 Available topics for facet "${facetName}":`, facetTopics);
    const selectedTopic = facetTopics[Math.floor(Math.random() * facetTopics.length)];
    console.log(`✅ Selected topic: "${selectedTopic}"`);
    
    return selectedTopic;
  }
  
  /**
   * Tighten angles to be more specific and Nicky-like
   */
  private tightenAngle(angle: string, facetName: string): string {
    // Keep it under 90 chars and inject personality
    const tightenedAngles: Record<string, string[]> = {
      'dbd_expert': [
        'and why the devs got it wrong',
        'the real reason nobody talks about',
        'and how it breaks everything'
      ],
      'street_hustler': [
        'the way we handled it in Newark',
        'and why the city doesn\'t want you knowing',
        'the inside story they won\'t tell ya'
      ],
      'food_family': [
        'the way nonna would have done it',
        'and why modern folks got it backwards',
        'straight from the family recipe book'
      ],
      'jersey_nostalgia': [
        'back when Jersey meant something',
        'and why they don\'t make \'em like that anymore',
        'the Little Italy way of handling it'
      ],
      'overly_excited': [
        'and it\'s gonna BLOW YOUR MIND',
        'trust me, this is INCREDIBLE',
        'and it\'s the BEST thing ever'
      ],
      'conspiracy_theories': [
        'and they don\'t want you knowing',
        'wake up, this is the truth',
        'connect the dots, it\'s obvious'
      ],
      'deadpan': [
        'if you care about that sort of thing',
        'not that anyone gives a shit',
        'because apparently that matters'
      ],
      'angry_rants': [
        'and it\'s pissing me the fuck off',
        'this bullshit has got to stop',
        'I\'m done with this garbage'
      ],
      'psycho': [
        'and it\'s darker than you think',
        'the twisted truth nobody admits',
        'embrace the chaos'
      ]
    };
    
    const facetEndings = tightenedAngles[facetName] || [
      'and why nobody wants to admit it',
      'the real story nobody tells',
      'and how it all connects'
    ];
    
    const ending = facetEndings[Math.floor(Math.random() * facetEndings.length)];
    return `${angle.toLowerCase()}, ${ending}`;
  }
  
  /**
   * Check if a topic is too generic
   */
  private isGenericTopic(topic: string): boolean {
    const genericTerms = [
      'conspiracy theories', 'weird news', 'advice', 'general topic',
      'current events', 'politics', 'technology', 'sports'
    ];
    
    const lowerTopic = topic.toLowerCase();
    return genericTerms.some(term => lowerTopic.includes(term)) || topic.split(' ').length <= 2;
  }

  /**
   * Extract a topic title from memory content
   */
  private extractTopicFromMemory(content: string): string {
    // Extract first meaningful phrase (up to first period or comma)
    const firstSentence = content.split(/[.!?]/)[0];
    const topic = firstSentence.length > 50 
      ? firstSentence.substring(0, 47) + '...'
      : firstSentence;
    
    return topic || 'Untold story from the past';
  }

  /**
   * Track recent suggestions to avoid repetition
   */
  private updateRecentSuggestions(conversationId: string, newTopics: string[]): void {
    const existing = this.recentSuggestions.get(conversationId) || [];
    const updated = [...existing, ...newTopics];
    
    // Keep only last 10 suggestions
    const recent = updated.slice(-10);
    this.recentSuggestions.set(conversationId, recent);
    
    console.log(`📝 Tracking ${recent.length} recent suggestions for conversation:`, conversationId);
  }
}