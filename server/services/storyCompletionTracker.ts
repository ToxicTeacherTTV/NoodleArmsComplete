/**
 * Story Completion Tracker
 * Detects when Nicky completes stories and prevents repetition
 */

import { storage } from '../storage.js';
import type { MemoryEntry, Conversation } from '@shared/schema';

interface StoryAnalysis {
  isCompleteStory: boolean;
  storyElements: {
    setup?: string;
    conflict?: string;
    resolution?: string;
  };
  storyType?: 'family' | 'business' | 'dbd' | 'neighborhood' | 'personal' | 'other';
  storyHash: string;
  confidence: number;
}

interface StoryRepetitionCheck {
  isRepetitive: boolean;
  similarStories: string[];
  confidence: number;
}

export class StoryCompletionTracker {
  
  /**
   * Analyze AI response content to detect completed stories
   */
  analyzeForCompletedStory(content: string): StoryAnalysis {
    const cleanContent = content.toLowerCase().replace(/[^\w\s]/g, ' ');
    
    // Story structure indicators
    const setupIndicators = [
      'back when', 'this one time', 'i remember', 'let me tell you',
      'there was this', 'my nonna', 'my cousin', 'in newark', 'little italy'
    ];
    
    const conflictIndicators = [
      'but then', 'suddenly', 'turns out', 'problem was', 'next thing',
      'wouldn\'t you know', 'of course', 'naturally'
    ];
    
    const resolutionIndicators = [
      'ended up', 'learned', 'realized', 'moral of', 'point is',
      'that\'s when', 'so now', 'ever since', 'lesson learned'
    ];
    
    // Check for story elements
    const hasSetup = setupIndicators.some(indicator => cleanContent.includes(indicator));
    const hasConflict = conflictIndicators.some(indicator => cleanContent.includes(indicator));
    const hasResolution = resolutionIndicators.some(indicator => cleanContent.includes(indicator));
    
    // Determine story type based on content
    let storyType: StoryAnalysis['storyType'] = 'other';
    if (cleanContent.includes('nonna') || cleanContent.includes('famiglia') || cleanContent.includes('sunday dinner')) {
      storyType = 'family';
    } else if (cleanContent.includes('business') || cleanContent.includes('legitimate') || cleanContent.includes('newark')) {
      storyType = 'business';
    } else if (cleanContent.includes('dead by daylight') || cleanContent.includes('dbd') || cleanContent.includes('killer')) {
      storyType = 'dbd';
    } else if (cleanContent.includes('little italy') || cleanContent.includes('neighborhood') || cleanContent.includes('paramus')) {
      storyType = 'neighborhood';
    } else if (cleanContent.includes('i once') || cleanContent.includes('personal') || cleanContent.includes('my ex')) {
      storyType = 'personal';
    }
    
    // Calculate story completeness
    const structureScore = (hasSetup ? 1 : 0) + (hasConflict ? 1 : 0) + (hasResolution ? 1 : 0);
    const isCompleteStory = structureScore >= 2 && content.length > 150; // Minimum length for story
    
    // Generate story hash for deduplication
    const keyPhrases = this.extractKeyPhrases(cleanContent);
    const storyHash = this.generateStoryHash(keyPhrases.join(' '));
    
    const confidence = Math.min(
      (structureScore / 3) * 0.7 + 
      (content.length / 500) * 0.2 + 
      (keyPhrases.length / 10) * 0.1,
      1.0
    );
    
    return {
      isCompleteStory,
      storyElements: {
        setup: hasSetup ? 'detected' : undefined,
        conflict: hasConflict ? 'detected' : undefined,
        resolution: hasResolution ? 'detected' : undefined
      },
      storyType,
      storyHash,
      confidence
    };
  }
  
  /**
   * Check if similar stories have been told recently
   */
  async checkForStoryRepetition(
    profileId: string,
    storyHash: string,
    storyType?: string,
    conversationId?: string
  ): Promise<StoryRepetitionCheck> {
    try {
      // Get recent podcast conversations to check for story repetition
      const recentPodcastConversations = await storage.getPodcastConversations(profileId, 20);
      const recentGeneralConversations = await storage.getConversationsByContentType(profileId, 'GENERAL', 10);
      
      const allRecentConversations = [...recentPodcastConversations, ...recentGeneralConversations];
      
      // Check completed stories from recent conversations
      const similarStories: string[] = [];
      
      for (const conversation of allRecentConversations) {
        if (conversation.id === conversationId) continue; // Skip current conversation
        
        if (conversation.completedStories && conversation.completedStories.length > 0) {
          // Simple hash comparison for exact matches
          if (conversation.completedStories.includes(storyHash)) {
            similarStories.push(`Exact match in conversation ${conversation.id}`);
          }
          
          // Check for similar story types told recently
          if (storyType && conversation.storyContext?.includes(storyType)) {
            const daysSince = conversation.createdAt ? 
              Math.floor((Date.now() - new Date(conversation.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
            
            if (daysSince < 7) { // Within a week
              similarStories.push(`Similar ${storyType} story ${daysSince} days ago`);
            }
          }
        }
      }
      
      const isRepetitive = similarStories.length > 0;
      const confidence = isRepetitive ? 
        Math.min(0.1 + (similarStories.length * 0.3), 1.0) : 0;
      
      return {
        isRepetitive,
        similarStories,
        confidence
      };
    } catch (error) {
      console.error('❌ Error checking story repetition:', error);
      return { isRepetitive: false, similarStories: [], confidence: 0 };
    }
  }
  
  /**
   * Track completed story in conversation
   */
  async trackCompletedStory(
    conversationId: string,
    storyAnalysis: StoryAnalysis,
    podcastEpisodeId?: string
  ): Promise<void> {
    try {
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) return;
      
      // Get existing completed stories
      const existingStories = conversation.completedStories || [];
      const existingTopics = conversation.topicTags || [];
      
      // Add new story hash if not already present
      if (!existingStories.includes(storyAnalysis.storyHash)) {
        const updatedStories = [...existingStories, storyAnalysis.storyHash];
        const updatedTopics = storyAnalysis.storyType && !existingTopics.includes(storyAnalysis.storyType) 
          ? [...existingTopics, storyAnalysis.storyType] 
          : existingTopics;
        
        const storyContextUpdate = storyAnalysis.storyType 
          ? `${conversation.storyContext || ''} [${storyAnalysis.storyType}_story]`.trim()
          : conversation.storyContext || undefined;
        
        await storage.updateConversationContent(conversationId, {
          completedStories: updatedStories,
          topicTags: updatedTopics,
          storyContext: storyContextUpdate,
          podcastEpisodeId: podcastEpisodeId || conversation.podcastEpisodeId || undefined
        });
        
        console.log(`📖 Tracked completed ${storyAnalysis.storyType} story in conversation ${conversationId}`);
      }
    } catch (error) {
      console.error('❌ Error tracking completed story:', error);
    }
  }
  
  /**
   * Extract key phrases from story content
   */
  private extractKeyPhrases(content: string): string[] {
    // Remove stop words and extract meaningful phrases
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
    ]);
    
    return content
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 15); // Key phrases for hashing
  }
  
  /**
   * Generate hash for story deduplication
   */
  private generateStoryHash(content: string): string {
    // Simple hash function for story deduplication
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `story_${Math.abs(hash).toString(36)}`;
  }
  
  /**
   * Get story completion statistics for a profile
   */
  async getStoryStats(profileId: string): Promise<{
    totalStories: number;
    storiesByType: Record<string, number>;
    recentStories: Array<{ conversationId: string; storyType: string; createdAt: string }>;
  }> {
    try {
      const conversations = await storage.getConversationsByContentType(profileId, 'PODCAST', 100);
      
      let totalStories = 0;
      const storiesByType: Record<string, number> = {};
      const recentStories: Array<{ conversationId: string; storyType: string; createdAt: string }> = [];
      
      for (const conversation of conversations) {
        if (conversation.completedStories && conversation.completedStories.length > 0) {
          totalStories += conversation.completedStories.length;
          
          // Extract story types from context
          const types = conversation.storyContext?.match(/\[(.*?)_story\]/g) || [];
          types.forEach(type => {
            const storyType = type.replace(/[\[\]_story]/g, '');
            storiesByType[storyType] = (storiesByType[storyType] || 0) + 1;
            
            recentStories.push({
              conversationId: conversation.id,
              storyType,
              createdAt: conversation.createdAt?.toISOString() || ''
            });
          });
        }
      }
      
      return {
        totalStories,
        storiesByType,
        recentStories: recentStories.slice(-20) // Most recent 20
      };
    } catch (error) {
      console.error('❌ Error getting story stats:', error);
      return { totalStories: 0, storiesByType: {}, recentStories: [] };
    }
  }
}

// Export singleton instance
export const storyCompletionTracker = new StoryCompletionTracker();