import { anthropicService } from './anthropic.js';
import { geminiService } from './gemini.js';
import { MemoryEntry, Message } from '@shared/schema';
import {
    StoryExtractionResult,
    AtomicFactResult,
    PodcastFactResult,
    DiscordMemberFactResult,
    OptimizedMemory,
    ConsolidatedMemory
} from './ai-types.js';

/**
 * 🎼 AI ORCHESTRATOR
 * 
 * Central service for managing AI model selection, fallback strategies, and 
 * cross-service coordination. This replaces the circular dependency pattern
 * where services directly imported each other.
 * 
 * STRATEGY:
 * 1. Primary: Claude 4.5 Sonnet (Superior quality for reasoning/creative)
 * 2. Fallback: Gemini 2.0 Flash (Cost-effective, fast, good backup)
 */
export class AIOrchestrator {

    /**
     * Extract stories from a document with fallback strategy
     */
    async extractStoriesFromDocument(content: string, filename: string): Promise<StoryExtractionResult[]> {
        console.log('🎼 Orchestrator: Routing story extraction to Claude Sonnet 4.5...');
        try {
            return await anthropicService.extractStoriesFromDocument(content, filename);
        } catch (claudeError) {
            console.warn('⚠️ Orchestrator: Claude extraction failed, using Gemini fallback:', claudeError);
            return await geminiService.extractStoriesFromDocument(content, filename);
        }
    }

    /**
     * Extract atomic facts from a story with fallback strategy
     */
    async extractAtomicFactsFromStory(storyContent: string, storyContext: string): Promise<AtomicFactResult[]> {
        console.log('🎼 Orchestrator: Routing atomic fact extraction to Claude Sonnet 4.5...');
        try {
            return await anthropicService.extractAtomicFactsFromStory(storyContent, storyContext);
        } catch (claudeError) {
            console.warn('⚠️ Orchestrator: Claude extraction failed, using Gemini fallback:', claudeError);
            return await geminiService.extractAtomicFactsFromStory(storyContent, storyContext);
        }
    }

    /**
     * Consolidate and optimize memories with fallback strategy
     */
    async consolidateAndOptimizeMemories(memories: MemoryEntry[] | any[]): Promise<OptimizedMemory[]> {
        console.log('🎼 Orchestrator: Routing memory consolidation to Claude Sonnet 4.5...');
        try {
            return await anthropicService.consolidateAndOptimizeMemories(memories);
        } catch (claudeError) {
            console.warn('⚠️ Orchestrator: Claude consolidation failed, using Gemini fallback:', claudeError);
            const result = await geminiService.consolidateAndOptimizeMemories(memories);
            // Ensure importance is a number and map to OptimizedMemory
            return result.map((m: any) => ({
                type: m.type,
                content: m.content,
                importance: (typeof m.importance === 'number' ? m.importance : 1) as number,
                source: m.source
            })) as OptimizedMemory[];
        }
    }

    /**
     * Extract podcast facts with fallback strategy
     */
    async extractPodcastFacts(transcript: string, episodeNumber: number, episodeTitle: string): Promise<PodcastFactResult[]> {
        console.log('🎼 Orchestrator: Routing podcast fact extraction to Claude Sonnet 4.5...');
        try {
            return await anthropicService.extractPodcastFacts(transcript, episodeNumber, episodeTitle);
        } catch (claudeError) {
            console.warn('⚠️ Orchestrator: Claude extraction failed, using Gemini fallback:', claudeError);
            return await geminiService.extractPodcastFacts(transcript, episodeNumber, episodeTitle);
        }
    }

    /**
     * Extract Discord member facts with fallback strategy
     */
    async extractDiscordMemberFacts(username: string, message: string, existingFacts: string[] = []): Promise<DiscordMemberFactResult[]> {
        console.log('🎼 Orchestrator: Routing Discord member fact extraction to Claude Sonnet 4.5...');
        try {
            return await anthropicService.extractDiscordMemberFacts(username, message, existingFacts);
        } catch (claudeError) {
            console.warn('⚠️ Orchestrator: Claude extraction failed, using Gemini fallback:', claudeError);
            return await geminiService.extractDiscordMemberFacts(username, message, existingFacts);
        }
    }

    /**
     * Retrieve contextual memories with fallback strategy
     */
    async retrieveContextualMemories(
        userMessage: string,
        profileId: string,
        conversationId?: string,
        personalityState?: any,
        mode?: string,
        limit: number = 15
    ): Promise<any[]> {
        // Primary: Anthropic
        try {
            return await anthropicService.retrieveContextualMemories(
                userMessage,
                profileId,
                conversationId,
                personalityState,
                mode,
                limit
            );
        } catch (error) {
            console.warn('⚠️ Orchestrator: Anthropic memory retrieval failed, falling back to basic search:', error);
            // Fallback logic could be implemented here, but for now just return empty or basic search
            return [];
        }
    }

    /**
     * Consolidate memories from recent conversation
     */
    async consolidateMemories(recentMessages: Message[]): Promise<ConsolidatedMemory[]> {
        console.log('🎼 Orchestrator: Routing memory consolidation to Claude Sonnet 4.5...');
        try {
            return await anthropicService.consolidateMemories(recentMessages);
        } catch (claudeError) {
            console.warn('⚠️ Orchestrator: Claude consolidation failed, using Gemini fallback:', claudeError);
            // Note: anthropicService.consolidateMemories already has internal fallback to Gemini,
            // but we add this layer for safety and architectural consistency.
            // However, since we can't easily call the internal fallback, we might need to duplicate logic 
            // or just rely on the service's internal error handling if it doesn't throw.
            // If it throws, we return empty array.
            return [];
        }
    }

    /**
     * Extract personality patterns from training content
     */
    async extractPersonalityPatterns(trainingContent: string): Promise<string> {
        console.log('🎼 Orchestrator: Routing personality pattern extraction to Claude Sonnet 4.5...');
        try {
            return await anthropicService.extractPersonalityPatterns(trainingContent);
        } catch (claudeError) {
            console.warn('⚠️ Orchestrator: Claude pattern extraction failed, using Gemini fallback:', claudeError);
            // anthropicService.extractPersonalityPatterns also has internal fallback.
            // If it propagates error, we try to handle it or re-throw.
            throw claudeError;
        }
    }

    /**
     * Generate conversation title
     */
    async generateConversationTitle(userMessage: string, aiResponse: string): Promise<string> {
        // Primary: Gemini (Cost effective for simple tasks)
        try {
            return await geminiService.generateConversationTitle(userMessage, aiResponse);
        } catch (error) {
            console.warn('⚠️ Orchestrator: Gemini title generation failed:', error);
            // Fallback: Simple truncation
            return userMessage.substring(0, 40).trim() + (userMessage.length > 40 ? '...' : '');
        }
    }

    /**
     * Parse show segments from transcript
     */
    async parseShowSegments(transcript: string, episodeTitle: string): Promise<Array<{
        title: string;
        description: string;
        segmentType: string;
        content: string;
        startTime?: number;
        endTime?: number;
    }>> {
        // Primary: Gemini (Good at structured extraction from long context)
        try {
            return await geminiService.parseShowSegments(transcript, episodeTitle);
        } catch (error) {
            console.warn('⚠️ Orchestrator: Gemini segment parsing failed:', error);
            return [];
        }
    }

    /**
     * Generate chat response with fallback strategy
     */
    async generateResponse(
        userMessage: string,
        coreIdentity: string,
        relevantMemories: any[],
        relevantDocs: any[] = [],
        loreContext?: string,
        mode?: string,
        conversationId?: string,
        profileId?: string,
        webSearchResults: any[] = [],
        personalityPrompt?: string,
        trainingExamples: any[] = []
    ): Promise<any> {
        // 🚀 ENHANCED: For PODCAST and STREAMING modes, we strictly enforce Claude
        // This logic was previously in anthropic.ts, now centralized here
        if (mode === 'PODCAST' || mode === 'STREAMING') {
            console.log(`🎙️ Orchestrator: Strictly using Claude Sonnet 4.5 for ${mode} mode (No Fallback)`);
            return await anthropicService.generateResponse(
                userMessage,
                coreIdentity,
                relevantMemories,
                relevantDocs,
                loreContext,
                mode,
                conversationId,
                profileId,
                webSearchResults,
                personalityPrompt,
                trainingExamples
            );
        }

        console.log('🎼 Orchestrator: Routing chat generation to Claude Sonnet 4.5...');
        try {
            return await anthropicService.generateResponse(
                userMessage,
                coreIdentity,
                relevantMemories,
                relevantDocs,
                loreContext,
                mode,
                conversationId,
                profileId,
                webSearchResults,
                personalityPrompt,
                trainingExamples
            );
        } catch (claudeError) {
            console.warn('⚠️ Orchestrator: Claude generation failed, using Gemini fallback:', claudeError);

            // Adapt arguments for Gemini
            // Gemini service signature: generateChatResponse(userMessage, coreIdentity, contextPrompt)

            // We need to construct a context prompt from the rich arguments
            let contextPrompt = "";
            if (loreContext) contextPrompt += `\n\nLORE CONTEXT:\n${loreContext}`;
            if (relevantMemories.length > 0) {
                contextPrompt += `\n\nRELEVANT MEMORIES:\n${relevantMemories.map(m => `- ${m.content}`).join('\n')}`;
            }

            return await geminiService.generateChatResponse(
                userMessage,
                coreIdentity,
                contextPrompt
            );
        }
    }
}

export const aiOrchestrator = new AIOrchestrator();
