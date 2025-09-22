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
      angle: selectedAngle,
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
    
    let response = `${facetStyle.opener} `;
    
    if (suggestionCount === 0) {
      response += "Ay, I'm drawin' a blank here! Maybe we just wing it and see what happens? Sometimes the best content comes from nowhere, you know what I'm sayin'?";
    } else {
      response += `I got ${suggestionCount} ideas brewin' for ya:\n\n`;
      
      suggestions.forEach((suggestion, index) => {
        response += `${index + 1}. **${suggestion.topic}** - ${suggestion.angle}\n`;
        response += `   (${suggestion.reasoning})\n\n`;
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
   * Get response style for each facet
   */
  private getFacetResponseStyle(facetName: string): { opener: string; closer: string } {
    const styles: Record<string, { opener: string; closer: string }> = {
      'dbd_expert': {
        opener: 'Alright, let me break down some content ideas from my gaming expertise:',
        closer: 'Any of these sound good? We could really dive deep into the mechanics and psychology here.'
      },
      'street_hustler': {
        opener: 'Yo, I got some ideas based on what I\'ve been hearing around the neighborhood:',
        closer: 'These are all backed by real street knowledge, you know what I\'m sayin\'?'
      },
      'food_family': {
        opener: 'Madonna mia, I got some family-inspired topics that could be beautiful:',
        closer: 'These stories come straight from the heart, just like nonna\'s cooking.'
      },
      'news_correspondent': {
        opener: 'Breaking news from the Nicky News Network - I got some exclusive story ideas:',
        closer: 'These are developing stories that deserve proper coverage, if you ask me.'
      }
    };
    
    return styles[facetName] || {
      opener: 'Ay, here\'s what\'s on my mind for content:',
      closer: 'What do you think? Any of these spark something for ya?'
    };
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