import { anthropicService } from './anthropic.js';
import { geminiService } from './gemini.js';
import { contextBuilder } from './contextBuilder.js';
import { storage } from '../storage.js';
import { MemoryEntry, Message } from '@shared/schema';
import {
    StoryExtractionResult,
    AtomicFactResult,
    PodcastFactResult,
    DiscordMemberFactResult,
    OptimizedMemory,
    ConsolidatedMemory,
    PsycheProfile
} from './ai-types.js';
import { AIModel } from '@shared/modelSelection.js';
import { varietyController } from './VarietyController.js';
import { contentFilter } from './contentFilter.js';
import { getDefaultModel } from '../config/geminiModels.js';

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
        const isClaude = selectedModel.startsWith('claude');

        if (isClaude) {
            console.log(`🎼 Orchestrator: Routing ${operation} to Claude (${selectedModel})...`);
            try {
                return await claudeOperation();
            } catch (claudeError) {
                console.warn(`⚠️ Orchestrator: Claude failed for ${operation}. Falling back to Gemini...`, claudeError);
                return await geminiOperation();
            }
        } else {
            console.log(`🎼 Orchestrator: Routing ${operation} to Gemini (${selectedModel})...`);
            try {
                return await geminiOperation();
            } catch (geminiError) {
                console.warn(`⚠️ Orchestrator: Gemini failed for ${operation}. Falling back to Claude...`, geminiError);
                try {
                    return await claudeOperation();
                } catch (claudeError) {
                    console.error(`❌ Orchestrator: Both Gemini and Claude failed for ${operation}.`, claudeError);
                    throw geminiError; // Throw original error
                }
            }
        }
    }

    /**
     * Extract stories from a document with user-selectable model
     */
    async extractStoriesFromDocument(
        content: string,
        filename: string,
        selectedModel: AIModel = 'gemini-3-flash-preview'
    ): Promise<StoryExtractionResult[]> {
        return this.routeToModel(
            'story extraction',
            selectedModel,
            () => anthropicService.extractStoriesFromDocument(content, filename),
            () => geminiService.extractStoriesFromDocument(content, filename, selectedModel)
        );
    }

    /**
     * Extract atomic facts from a story with user-selectable model
     */
    async extractAtomicFactsFromStory(
        storyContent: string,
        storyContext: string,
        selectedModel: AIModel = 'gemini-3-flash-preview'
    ): Promise<AtomicFactResult[]> {
        return this.routeToModel(
            'atomic fact extraction',
            selectedModel,
            () => anthropicService.extractAtomicFactsFromStory(storyContent, storyContext),
            () => geminiService.extractAtomicFactsFromStory(storyContent, storyContext, selectedModel)
        );
    }

    /**
     * Distill raw text into a single atomic fact
     */
    async distillTextToFact(
        text: string,
        selectedModel: AIModel = 'gemini-3-flash-preview'
    ): Promise<{ fact: string }> {
        // For now, only Gemini implements this specific distillation
        return geminiService.distillTextToFact(text, selectedModel);
    }

    /**
     * 🧠 Generate a psyche profile from core memories
     */
    async generatePsycheProfile(
        coreMemories: string,
        selectedModel: AIModel = 'gemini-3-flash-preview'
    ): Promise<PsycheProfile> {
        return geminiService.generatePsycheProfile(coreMemories, selectedModel);
    }

    /**
     * ⚖️ Audit a batch of memories against a psyche profile
     */
    async auditMemoriesBatch(
        psyche: any,
        memories: Array<{ id: number, content: string }>,
        selectedModel: AIModel = 'gemini-3-flash-preview'
    ): Promise<Array<{ id: number, importance: number, confidence: number }>> {
        return geminiService.auditMemoriesBatch(psyche, memories, selectedModel);
    }

    /**
     * Consolidate and optimize memories with user-selectable model
     */
    async consolidateAndOptimizeMemories(
        memories: MemoryEntry[] | any[],
        selectedModel: AIModel = 'gemini-3-flash-preview'
    ): Promise<OptimizedMemory[]> {
        const mappedMemories = memories.map((m: any) => ({
            id: m.id,
            type: m.type,
            content: m.content,
            importance: m.importance ?? 5,
            source: m.source
        }));

        return this.routeToModel(
            'memory consolidation',
            selectedModel,
            () => anthropicService.consolidateAndOptimizeMemories(mappedMemories),
            async () => {
                const result = await geminiService.consolidateAndOptimizeMemories(mappedMemories);
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
        selectedModel: AIModel = 'gemini-3-flash-preview'
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
        console.log('🎼 Orchestrator: Routing Discord member fact extraction to Gemini 3 Flash...');
        try {
            return await geminiService.extractDiscordMemberFacts(username, message, existingFacts);
        } catch (error) {
            console.warn('⚠️ Orchestrator: Gemini extraction failed:', error);
            return [];
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
    ): Promise<{
        canon: any[];
        rumors: any[];
        disputed: any[];
        entities: any[];
        knowledgeGap?: { hasGap: boolean; missingTopics: string[] };
    }> {
        try {
            return await contextBuilder.retrieveContextualMemories(
                userMessage,
                profileId,
                conversationId,
                personalityState,
                mode,
                limit
            );
        } catch (error) {
            console.warn('⚠️ Orchestrator: Context retrieval failed:', error);
            return {
                canon: [],
                rumors: [],
                disputed: [],
                entities: []
            };
        }
    }

    /**
     * Consolidate memories from recent conversation
     */
    async consolidateMemories(recentMessages: Message[]): Promise<ConsolidatedMemory[]> {
        console.log('🎼 Orchestrator: Routing memory consolidation to Gemini 3 Flash...');
        try {
            return await geminiService.consolidateMemories(recentMessages);
        } catch (error) {
            console.warn('⚠️ Orchestrator: Gemini consolidation failed:', error);
            return [];
        }
    }

    /**
     * Extract personality patterns from training content
     */
    async extractPersonalityPatterns(trainingContent: string): Promise<string> {
        console.log('🎼 Orchestrator: Routing personality pattern extraction to Gemini 3 Flash...');
        try {
            return await geminiService.extractPersonalityPatterns(trainingContent);
        } catch (error) {
            console.warn('⚠️ Orchestrator: Gemini pattern extraction failed:', error);
            throw error;
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
     * 🗺️ Handle the state machine for "Where the fuck are the viewers from" stories
     */
    private async handleCityStoryState(
        userMessage: string,
        conversationId: string,
        profileId: string
    ): Promise<string> {
        const lowerMessage = userMessage.toLowerCase();

        // 1. Detect explicit segment triggers
        const segmentTriggers = [
            'where the fuck are the viewers from',
            'where are the viewers from',
            'pick a city',
            'next city',
            'another city'
        ];
        const isSegmentRequest = segmentTriggers.some(t => lowerMessage.includes(t));

        // 2. Detect city mentions with inquiry context
        // Look for capitalized words after prepositions or trigger words
        let cityMatch = userMessage.match(/(?:about|in|to|of|at|from|story|happened|been to|with|for|is|was)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);

        let cityToUse = cityMatch ? cityMatch[1] : "";

        // 3. If no capitalized match, try a more aggressive search for known cities in the DB
        if (!cityToUse) {
            const words = userMessage.split(/\s+/);
            // Check for 1, 2, or 3 word city names in the message
            for (let i = 0; i < words.length; i++) {
                for (let len = 3; len >= 1; len--) {
                    if (i + len <= words.length) {
                        const potentialCity = words.slice(i, i + len).join(' ').replace(/[?!.,]$/, '');
                        if (potentialCity.length > 3) {
                            const foundCity = await storage.findCityByName(profileId, potentialCity);
                            if (foundCity) {
                                cityToUse = `${foundCity.city}, ${foundCity.country}`;
                                break;
                            }
                        }
                    }
                }
                if (cityToUse) break;
            }
        }

        // 4. Check if we are already in a story
        const conversation = await storage.getConversation(conversationId);
        if (!conversation) return "";

        let state = conversation.metadata?.storyState;
        const isContinuing = state && !state.isCompleted;

        // If it's not a segment request, not a city inquiry, and we aren't already in a story, bail.
        if (!isSegmentRequest && !cityToUse && !isContinuing) return "";

        try {
            // STARTING OR SWITCHING
            if (isSegmentRequest || cityToUse) {
                // If it's a general "pick a city" request and we still don't have a city, get one from DB
                if (!cityToUse && isSegmentRequest) {
                    const dbCity = await storage.getRandomUncoveredCity(profileId);
                    if (dbCity) {
                        cityToUse = `${dbCity.city}, ${dbCity.country}`;
                    }
                }

                // If we found a city, start/reset the state
                if (cityToUse) {
                    state = {
                        currentCity: cityToUse,
                        turnCount: 1,
                        isCompleted: false
                    };

                    // Mark as covered in DB if it exists
                    await storage.markCityAsCovered(profileId, cityToUse.split(',')[0].trim());
                }
            }
            // CONTINUING
            else if (state && !state.isCompleted) {
                state.turnCount++;

                // We let Nicky decide when to end it, but we track turns for context
                if (state.turnCount >= 5) {
                    state.isCompleted = true; // Soft cap to prevent infinite loops
                }
            }

            if (!state) return "";

            // Save state back to conversation
            await storage.updateConversationMetadata(conversationId, {
                ...conversation.metadata,
                storyState: state
            });

            return `
\n[NICKY VIBE CHECK: "WHERE THE FUCK ARE THE VIEWERS FROM"]
Current City: ${state.currentCity}
Story Turn: ${state.turnCount}

CRITICAL GUIDANCE:
- You are in the middle of a multi-turn city story segment.
- DO NOT finish the story in this message. This is only turn ${state.turnCount}.
- Use your "CITY STORYTELLER PACK" archetypes (The Grudge, The Fugitive, etc.) as inspiration.
- Start with a hook or a confusing detail. Build the tension.
- Leave the "meat" of the story for the next 2-3 messages.
- End this message with a cliffhanger or a question for Toxic.
- If you just started (Turn 1), you should barely be getting into the setup.
`;
        } catch (e) {
            console.warn("Failed to handle city story state:", e);
            return "";
        }
    }

    /**
     * Generate chat response with fallback strategy
     */


    async generateResponse(
        userMessage: string,
        coreIdentity: string,
        context: any,
        mode?: string,
        conversationId?: string,
        profileId?: string,
        selectedModel?: string,
        sauceMeter: number = 0,
        currentGame: string = ""
    ): Promise<any> {
        const model = (selectedModel || getDefaultModel()) as AIModel;

        // 1. Build Context via ContextBuilder
        const {
            contextPrompt,
            recentHistory,
            saucePrompt,
            gameFocusPrompt,
            personalityPrompt
        } = await contextBuilder.buildChatContext(
            userMessage,
            profileId!,
            conversationId,
            mode,
            context,
            sauceMeter,
            currentGame
        );

        // 2. Handle City Story State (Orchestrator-specific as it updates DB)
        let cityStoryPrompt = "";
        if (conversationId && profileId) {
            cityStoryPrompt = await this.handleCityStoryState(userMessage, conversationId, profileId);
        }

        // 3. Assemble Enhanced Identity
const behavioralConstraints = `
[CORE BEHAVIORAL CONSTRAINTS]
- NO STAGE DIRECTIONS: Do NOT describe your physical actions.
- NO ASTERISKS: Use ALL CAPS for emphasis.
- SHOW, DON'T TELL: Use [emotion] tags like [laughing] or [screaming].
- MECHANICS FIRST: If you have [GAME KNOWLEDGE PACK] facts, ANSWER THE QUESTION with them first. THEN go into your rant/story.
- NO DODGING: Do not say "who cares" or "google it" if you have the facts. Use the knowledge pack.
- NO HALLUCINATIONS: If the detail isn't in your memory or knowledge pack, admit you don't know or deflect. Do not invent perks or stats.
`;

        const enhancedCoreIdentity = `
${coreIdentity}
${personalityPrompt}
${gameFocusPrompt}
${behavioralConstraints}
`;

        // 4. Route to Model
        const response = await this.routeToModel(
            'chat response',
            model,
            () => anthropicService.generateChatResponse(
                userMessage,
                enhancedCoreIdentity,
                contextPrompt,
                recentHistory,
                saucePrompt,
                cityStoryPrompt,
                model
            ),
            () => geminiService.generateChatResponse(
                userMessage,
                enhancedCoreIdentity,
                contextPrompt,
                recentHistory,
                saucePrompt,
                cityStoryPrompt,
                model
            )
        );

        // 5. Repetition Check (Brain logic moved to Orchestrator)
        if (conversationId && context.recentMessages) {
            const { content: finalContent, wasRegenerated } = await this.checkForRepetition(
                conversationId,
                response.content,
                userMessage,
                enhancedCoreIdentity,
                context.recentMessages,
                model,
                contextPrompt,
                recentHistory,
                saucePrompt,
                cityStoryPrompt
            );

            return {
                ...response,
                content: finalContent,
                wasRegenerated
            };
        }

        return response;
    }

    /**
     * 🔄 REPETITION GUARD
     * Checks for repetitive patterns and regenerates if necessary.
     */
    private async checkForRepetition(
        conversationId: string,
        content: string,
        userMessage: string,
        coreIdentity: string,
        recentMessages: Message[],
        model: AIModel,
        contextPrompt: string = "",
        recentHistory: string = "",
        saucePrompt: string = "",
        cityStoryPrompt: string = ""
    ): Promise<{ content: string; wasRegenerated: boolean }> {
        try {
            const recentAIResponses = recentMessages
                .filter((msg: Message) => msg.type === 'AI')
                .map((msg: Message) => msg.content.toLowerCase())
                .slice(0, 5);

            const currentContentLower = content.toLowerCase();

            // Check for problematic patterns
            const problematicPatterns = [
                /my name is nicky|i'm nicky|call me nicky/gi,
                /it's all rigged|everything's rigged/gi,
                /anti-italian/gi,
                /madonna mia!/gi,
                /dead by daylight/gi
            ];

            const hasSelfIntro = /my name is|i'm nicky|call me nicky/i.test(currentContentLower);
            const hasRepetitiveNGrams = this.detectNGramRepetition(currentContentLower, recentAIResponses);
            const overusedMotifCount = problematicPatterns.reduce((count, pattern) => {
                return count + (pattern.test(currentContentLower) ? 1 : 0);
            }, 0);

            const needsRegeneration = hasSelfIntro || hasRepetitiveNGrams || overusedMotifCount >= 2;

            if (needsRegeneration) {
                console.warn(`🔄 Orchestrator: Detected repetitive patterns, regenerating response...`);

                const { facet: altFacet } = await varietyController.selectPersonaFacet(conversationId, userMessage);
                const altVarietyPrompt = varietyController.generateVarietyPrompt(altFacet, await varietyController.getSessionVariety(conversationId));

                const antiRepetitionPrompt = `
REGENERATION RULES:
- NEVER introduce yourself or say your name
- NO catchphrases this turn
- Avoid these overused topics: Dead by Daylight complaints, anti-Italian tech, "Madonna mia!"
- Use a completely different angle from your recent responses
- Focus on: ${altFacet.description}
- ${altFacet.responseShape.structure}
`;

                // Regenerate using the same model routing
                const regenResponse = await this.routeToModel(
                    'repetition regeneration',
                    model,
                    () => anthropicService.generateChatResponse(
                        userMessage,
                        `${coreIdentity}\n\n${altVarietyPrompt}\n\n${antiRepetitionPrompt}`,
                        contextPrompt,
                        recentHistory,
                        saucePrompt,
                        cityStoryPrompt,
                        model
                    ),
                    () => geminiService.generateChatResponse(
                        userMessage,
                        `${coreIdentity}\n\n${altVarietyPrompt}\n\n${antiRepetitionPrompt}`,
                        contextPrompt,
                        recentHistory,
                        saucePrompt,
                        cityStoryPrompt,
                        model
                    )
                );

                const { filtered: filteredRegenContent } = contentFilter.filterContent(regenResponse.content);
                return { content: filteredRegenContent, wasRegenerated: true };
            }

            return { content, wasRegenerated: false };
        } catch (error) {
            console.error('❌ Orchestrator: Repetition check failed:', error);
            return { content, wasRegenerated: false };
        }
    }

    /**
     * Detect n-gram repetition in recent responses
     */
    private detectNGramRepetition(currentContent: string, recentResponses: string[]): boolean {
        const words = currentContent.split(/\s+/);
        const lowerContent = currentContent.toLowerCase();

        const highRiskTopics = ['oklahoma', 'tube man', 'vinny', 'arc raiders', 'noodle arms', 'victor', 'lodge logic', 'pan'];
        for (const topic of highRiskTopics) {
            if (lowerContent.includes(topic)) {
                if (recentResponses.length > 0 && recentResponses[0].toLowerCase().includes(topic)) {
                    return true;
                }
                const mentionCount = recentResponses.slice(0, 3).filter(r => r.toLowerCase().includes(topic)).length;
                if (mentionCount >= 2) {
                    return true;
                }
            }
        }

        for (let n = 4; n <= 6; n++) {
            for (let i = 0; i <= words.length - n; i++) {
                const ngram = words.slice(i, i + n).join(' ');
                if (ngram.length < 15) continue;
                if (recentResponses.some(response => response.includes(ngram))) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     *  GATHER ALL CONTEXT
     * Delegates to ContextBuilder to fetch all RAG components in parallel.
     */
    async gatherAllContext(
        message: string,
        profileId: string,
        conversationId?: string,
        controls?: any,
        mode?: string,
        currentGame: string = ""
    ): Promise<any> {
        return await contextBuilder.gatherAllContext(message, profileId, conversationId, controls, mode, currentGame);
    }
}

export const aiOrchestrator = new AIOrchestrator();
