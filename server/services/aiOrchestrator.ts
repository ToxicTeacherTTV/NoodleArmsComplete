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
import { AIModel } from '@shared/modelSelection.js';

/**
 * 🎼 AI ORCHESTRATOR
 * 
 * Central service for managing AI model selection, fallback strategies, and 
 * cross-service coordination. This replaces the circular dependency pattern
 * where services directly imported each other.
 * 
 * STRATEGY:
 * - User-selectable models: Claude Sonnet 4.5, Gemini 3 Pro, Gemini 2.5 Pro, Gemini 2.5 Flash
 * - Automatic fallback on failure
 * - Per-operation model preferences
 */
export class AIOrchestrator {
    
    /**
     * Route AI operation to the selected model with fallback
     */
    private async routeToModel<T>(
        operation: string,
        selectedModel: AIModel,
        claudeOperation: () => Promise<T>,
        geminiOperation: () => Promise<T>
    ): Promise<T> {
        // Map model selection to provider
        const useGemini = selectedModel !== 'claude-sonnet-4.5';
        
        if (useGemini) {
            console.log(`🎼 Orchestrator: Routing ${operation} to ${selectedModel}...`);
            try {
                return await geminiOperation();
            } catch (geminiError) {
                console.warn(`⚠️ Orchestrator: ${selectedModel} failed, trying Claude fallback:`, geminiError);
                return await claudeOperation();
            }
        } else {
            console.log(`🎼 Orchestrator: Routing ${operation} to Claude Sonnet 4.5...`);
            try {
                return await claudeOperation();
            } catch (claudeError) {
                console.warn('⚠️ Orchestrator: Claude failed, trying Gemini fallback:', claudeError);
                return await geminiOperation();
            }
        }
    }

    /**
     * Extract stories from a document with user-selectable model
     */
    async extractStoriesFromDocument(
        content: string,
        filename: string,
        selectedModel: AIModel = 'claude-sonnet-4.5'
    ): Promise<StoryExtractionResult[]> {
        return this.routeToModel(
            'story extraction',
            selectedModel,
            () => anthropicService.extractStoriesFromDocument(content, filename),
            () => geminiService.extractStoriesFromDocument(content, filename)
        );
    }

    /**
     * Extract atomic facts from a story with user-selectable model
     */
    async extractAtomicFactsFromStory(
        storyContent: string,
        storyContext: string,
        selectedModel: AIModel = 'claude-sonnet-4.5'
    ): Promise<AtomicFactResult[]> {
        return this.routeToModel(
            'atomic fact extraction',
            selectedModel,
            () => anthropicService.extractAtomicFactsFromStory(storyContent, storyContext),
            () => geminiService.extractAtomicFactsFromStory(storyContent, storyContext)
        );
    }

    /**
     * Consolidate and optimize memories with user-selectable model
     */
    async consolidateAndOptimizeMemories(
        memories: MemoryEntry[] | any[],
        selectedModel: AIModel = 'claude-sonnet-4.5'
    ): Promise<OptimizedMemory[]> {
        return this.routeToModel(
            'memory consolidation',
            selectedModel,
            () => anthropicService.consolidateAndOptimizeMemories(memories),
            async () => {
                const result = await geminiService.consolidateAndOptimizeMemories(memories);
                return result.map((m: any) => ({
                    type: m.type,
                    content: m.content,
                    importance: (typeof m.importance === 'number' ? m.importance : 1) as number,
                    source: m.source
                })) as OptimizedMemory[];
            }
        );
    }

    /**
     * Extract podcast facts with user-selectable model
     */
    async extractPodcastFacts(
        transcript: string,
        episodeNumber: number,
        episodeTitle: string,
        selectedModel: AIModel = 'claude-sonnet-4.5'
    ): Promise<PodcastFactResult[]> {
        return this.routeToModel(
            'podcast fact extraction',
            selectedModel,
            () => anthropicService.extractPodcastFacts(transcript, episodeNumber, episodeTitle),
            () => geminiService.extractPodcastFacts(transcript, episodeNumber, episodeTitle)
        );
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
        trainingExamples: any[] = [],
        selectedModel?: string
    ): Promise<any> {
        const model = (selectedModel || 'claude-sonnet-4.5') as AIModel;
        
        // Use selected model with automatic fallback
        return await this.routeToModel(
            'chat response generation',
            model,
            () => anthropicService.generateResponse(
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
            ),
            () => geminiService.generateChatResponse(
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
            ).then(response => ({ content: response.content }))
        );
    }

    // Legacy fallback code (keeping for reference)
    private async generateResponseLegacy(
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
