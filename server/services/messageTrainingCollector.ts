import { IStorage } from '../storage.js';
import { Message } from '@shared/schema';

/**
 * Collects high-quality AI messages as training examples
 * Preserves emotion tags, cadence, and style patterns
 */
export class MessageTrainingCollector {
  
  /**
   * Evaluate if an AI message is worthy of being saved as training data
   */
  async evaluateMessageQuality(message: Message, context: {
    userMessage?: string;
    conversationLength?: number;
    hasPositiveRating?: boolean;
  }): Promise<{ isQuality: boolean; score: number; reason: string }> {
    
    let score = 50; // Base score
    const reasons: string[] = [];
    
    // ✅ Length check: Not too short, not too long
    if (message.content.length < 20) {
      return { isQuality: false, score: 0, reason: 'Too short (< 20 chars)' };
    }
    if (message.content.length > 50 && message.content.length < 500) {
      score += 20;
      reasons.push('Good length');
    }
    
    // ✅ Has emotion tags (indicates proper formatting)
    const hasEmotionTags = /\[[\w-]+\]/.test(message.content);
    if (hasEmotionTags) {
      score += 15;
      reasons.push('Has emotion tags');
    }
    
    // ✅ No error indicators
    const hasErrors = /error|failed|sorry|cannot|unable/i.test(message.content);
    if (hasErrors) {
      score -= 30;
      reasons.push('Contains error language');
    }
    
    // ✅ Not generic/boring
    const isGeneric = /^(hi|hello|hey|yes|no|okay|ok|sure|thanks)\.?$/i.test(message.content.trim());
    if (isGeneric) {
      return { isQuality: false, score: 10, reason: 'Too generic' };
    }
    
    // ✅ Has personality indicators (Italian phrases, profanity, DBD references, etc.)
    const hasPersonality = /\b(ay+o?|capisce|madonna|pasta|faccia|DbD|dead by daylight|noodle arms|fuck|shit|damn)\b/i.test(message.content);
    if (hasPersonality) {
      score += 20;
      reasons.push('Strong personality');
    }
    
    // ✅ Has good conversational elements (questions, exclamations, variety)
    const hasQuestions = /\?/.test(message.content);
    const hasExclamations = /!/.test(message.content);
    if (hasQuestions || hasExclamations) {
      score += 10;
      reasons.push('Dynamic conversation');
    }
    
    // ✅ Bonus: User gave positive rating
    if (context.hasPositiveRating) {
      score += 25;
      reasons.push('User rated positively');
    }
    
    // ✅ Context relevance: Message is part of active conversation
    if (context.conversationLength && context.conversationLength > 3) {
      score += 10;
      reasons.push('Good conversation flow');
    }
    
    const isQuality = score >= 70;
    const reason = reasons.join(', ');
    
    return { isQuality, score, reason };
  }
  
  /**
   * Save a high-quality AI message as a training example
   */
  async saveMessageAsTraining(
    storage: IStorage,
    message: Message,
    profileId: string,
    context: {
      userMessage?: string;
      conversationId?: string;
      mode?: string;
    }
  ): Promise<void> {
    
    // Format training example with context
    let trainingContent = '';
    
    // Include user message for context if available
    if (context.userMessage) {
      trainingContent += `User: ${context.userMessage}\n\n`;
    }
    
    trainingContent += `Nicky: ${message.content}`;
    
    // Add metadata comment for reference
    trainingContent += `\n\n---\n[Mode: ${context.mode || 'CHAT'}, Quality Score: High, Source: Message ID ${message.id}]`;
    
    // Create document as training example
    await storage.createDocument({
      profileId,
      name: `Training: Auto-saved message (${new Date().toISOString().split('T')[0]})`,
      filename: `auto_msg_${message.id.substring(0, 8)}.txt`,
      contentType: 'text/plain',
      documentType: 'TRAINING_EXAMPLE',
      size: trainingContent.length,
      extractedContent: trainingContent,
      processingStatus: 'COMPLETED'
    });
    
    console.log(`📚 Auto-saved message ${message.id.substring(0, 8)} as training example`);
  }
  
  /**
   * Batch evaluate and save recent messages from a conversation
   */
  async processConversationMessages(
    storage: IStorage,
    conversationId: string,
    profileId: string
  ): Promise<{ saved: number; evaluated: number }> {
    
    const messages = await storage.getConversationMessages(conversationId);
    
    // Filter to AI messages only
    const aiMessages = messages.filter(m => m.type === 'AI');
    
    let saved = 0;
    let evaluated = 0;
    
    for (let i = 0; i < aiMessages.length; i++) {
      const aiMessage = aiMessages[i];
      evaluated++;
      
      // Find corresponding user message (previous message)
      const userMessage = messages[i > 0 ? i - 1 : i];
      const userText = userMessage?.type === 'USER' ? userMessage.content : undefined;
      
      // Evaluate quality
      const quality = await this.evaluateMessageQuality(aiMessage, {
        userMessage: userText,
        conversationLength: messages.length,
        hasPositiveRating: (aiMessage as any).rating > 0
      });
      
      // Save if high quality
      if (quality.isQuality) {
        await this.saveMessageAsTraining(storage, aiMessage, profileId, {
          userMessage: userText,
          conversationId,
          mode: (aiMessage as any).metadata?.mode || 'CHAT'
        });
        saved++;
        console.log(`✅ Saved message (score: ${quality.score}, reason: ${quality.reason})`);
      } else {
        console.log(`⏭️ Skipped message (score: ${quality.score}, reason: ${quality.reason})`);
      }
    }
    
    return { saved, evaluated };
  }
}

export const messageTrainingCollector = new MessageTrainingCollector();
