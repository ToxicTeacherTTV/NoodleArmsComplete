import { storage } from '../storage.js';
import ChaosEngine from './chaosEngine.js';
import { Message, MemoryEntry } from '@shared/schema';
import { contextPrewarmer } from './contextPrewarmer.js';
import { contextPruner } from './contextPruner.js';
import { embeddingServiceInstance } from './embeddingService.js';
import { webSearchService } from './webSearchService.js';
import { documentProcessor } from './documentProcessor.js';
import { generatePersonalityPrompt } from '../types/personalityControl.js';
import { diagnosticService } from './diagnosticService.js';

/**
 * 🧠 CONTEXT BUILDER (RAG Engine)
 * 
 * Centralized service for retrieval-augmented generation (RAG) logic.
 * This service is model-agnostic and handles:
 * 1. Keyword extraction (base and contextual)
 * 2. Memory retrieval (Canon, Rumors, Entities)
 * 3. Context assembly and prompt construction
 */
export class ContextBuilder {
    private chaosEngine: ChaosEngine;

    constructor() {
        this.chaosEngine = ChaosEngine.getInstance();
    }

    /**
     * Extract base keywords from a message
     */
    public extractKeywords(message: string): string[] {
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);

        return message
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(word => {
                const isNumber = /^\d+$/.test(word);
                const isLongEnough = word.length > 2;
                const isNotStopWord = !stopWords.has(word);
                return (isNumber || isLongEnough) && isNotStopWord;
            })
            .slice(0, 8);
    }

    /**
     * Extract contextual keywords using conversation history
     */
    public async extractContextualKeywords(
        message: string,
        conversationId?: string,
        personalityState?: any,
        mode?: string,
        prefetchedMessages?: Message[]
    ): Promise<{ keywords: string[], contextualQuery: string }> {
        const baseKeywords = this.extractKeywords(message);
        let enhancedKeywords = [...baseKeywords];
        let contextualQuery = message;

        try {
            if (conversationId || prefetchedMessages) {
                const recentMessages = prefetchedMessages || await storage.getRecentMessages(conversationId!, 3);
                if (recentMessages.length > 0) {
                    const conversationText = recentMessages.map(m => m.content).join(' ');
                    const conversationKeywords = this.extractKeywords(conversationText);
                    enhancedKeywords.push(...conversationKeywords.slice(0, 3));

                    const recentContext = recentMessages.slice(-1)[0]?.content || '';
                    if (recentContext && recentContext !== message) {
                        contextualQuery = `In context of: "${recentContext}" - User asks: ${message}`;
                    }
                }
            }

            if (personalityState) {
                const personalityKeywords = this.getPersonalityContextKeywords(personalityState, mode);
                enhancedKeywords.push(...personalityKeywords);
            }

            const emotionalKeywords = this.extractEmotionalContext(message);
            enhancedKeywords.push(...emotionalKeywords);

            const uniqueKeywords = Array.from(new Set(enhancedKeywords)).slice(0, 12);
            return { keywords: uniqueKeywords, contextualQuery };
        } catch (error) {
            console.warn('⚠️ Contextual keyword extraction failed:', error);
            return { keywords: baseKeywords, contextualQuery: message };
        }
    }

    private getPersonalityContextKeywords(personalityState: any, mode?: string): string[] {
        const keywords: string[] = [];
        const preset = personalityState.preset || '';

        if (preset.includes('Gaming') || preset.includes('Patch')) {
            keywords.push('dead by daylight', 'gaming', 'killer', 'survivor', 'patch', 'bhvr');
        } else if (preset.includes('Story')) {
            keywords.push('family', 'newark', 'italian', 'childhood', 'stories', 'memories');
        } else if (preset.includes('Roast') || preset.includes('Unhinged')) {
            keywords.push('roast', 'insults', 'comeback', 'trash talk');
        }

        if (mode === 'PODCAST') keywords.push('episode', 'show', 'podcast');
        else if (mode === 'STREAMING') keywords.push('stream', 'twitch', 'viewers');
        else if (mode === 'DISCORD') keywords.push('server', 'discord', 'channel');

        return keywords.slice(0, 4);
    }

    private extractEmotionalContext(message: string): string[] {
        const keywords: string[] = [];
        const lower = message.toLowerCase();

        if (/angry|mad|pissed|frustrated/.test(lower)) keywords.push('frustration', 'anger');
        if (/happy|excited|awesome/.test(lower)) keywords.push('joy', 'excitement');
        if (/sad|depressed|upset/.test(lower)) keywords.push('sadness', 'support');
        if (/question|how|what|why/.test(lower)) keywords.push('question', 'explanation');

        return keywords.slice(0, 2);
    }

    /**
     * Core RAG logic: Retrieve structured memory packs
     */
    public async retrieveContextualMemories(
        userMessage: string,
        profileId: string,
        conversationId?: string,
        personalityState?: any,
        mode?: string,
        limit: number = 15,
        recentMessages: Message[] = []
    ): Promise<{
        canon: any[];
        rumors: any[];
        disputed: any[];
        entities: any[];
        knowledgeGap?: { hasGap: boolean; missingTopics: string[] };
    }> {
        try {
            const queryIntent = this.detectQueryIntent(userMessage);
            const chaosState = await this.chaosEngine.getCurrentState();

            // 1. Fetch Lane-aware Memory Packs from DB
            const packs = await storage.getMemoryPacks(profileId, userMessage, chaosState.level, mode, queryIntent);

            // 2. Enhanced Keyword Extraction
            const { keywords, contextualQuery } = await this.extractContextualKeywords(
                userMessage,
                conversationId,
                personalityState,
                mode,
                recentMessages
            );

            // 3. Hybrid Search (Semantic + Keyword) - ENFORCED CANON ONLY
            const candidateLimit = Math.floor(mode === 'STREAMING' ? limit * 1.5 : limit * 3);
            const hybridResults = await embeddingServiceInstance.hybridSearch(contextualQuery, profileId, candidateLimit, 'CANON');

            // 🎭 THEATER ZONE: Optional Rumor Hybrid Search
            // This allows Nicky to re-summon his own bullshit variants semantically
            let hybridRumors: any[] = [];
            const isTheaterZone = mode === 'PODCAST' || mode === 'STREAMING' || chaosState.level > 70 || (queryIntent && /tell_about|remind|opinion/i.test(queryIntent));

            if (isTheaterZone) {
                const rumorLimit = Math.floor(candidateLimit / 2);
                const rumorHybrid = await embeddingServiceInstance.hybridSearch(contextualQuery, profileId, rumorLimit, 'RUMOR');
                hybridRumors = rumorHybrid.combined.map((r: any) => ({
                    ...r,
                    confidence: Math.min(r.confidence || 25, 40), // Enforce rumor ceiling
                    retrievalMethod: 'rumor_hybrid'
                }));
            }

            // 4. Contextual Re-ranking
            const seenIds = new Set();
            const combinedResults = [];

            const semanticMemories = hybridResults.semantic.map((result: any) => ({
                ...result,
                contextualRelevance: this.calculateContextualRelevance(result, personalityState, mode, keywords, conversationId, queryIntent),
                retrievalMethod: 'semantic_enhanced'
            }));

            const keywordMemories = hybridResults.keyword.map((result: any) => ({
                ...result,
                contextualRelevance: this.calculateContextualRelevance(result, personalityState, mode, keywords, conversationId, queryIntent),
                retrievalMethod: 'keyword_enhanced'
            }));

            for (const result of semanticMemories) {
                // Enforce confidence >= 60 for CANON grounding
                if (!seenIds.has(result.id) && (result.confidence || 50) >= 60) {
                    seenIds.add(result.id);
                    combinedResults.push({ ...result, baseScore: result.similarity * 1.2 + (result.contextualRelevance || 0) * 0.3 });
                }
            }

            for (const result of keywordMemories) {
                // Enforce confidence >= 60 for CANON grounding
                if (!seenIds.has(result.id) && (result.confidence || 50) >= 60) {
                    seenIds.add(result.id);
                    combinedResults.push({ ...result, baseScore: 0.7 + (result.contextualRelevance || 0) * 0.3 });
                }
            }

            // 5. Entity Search
            const entityResults = await storage.searchEntities(profileId, contextualQuery);
            const entityMemories = this.formatEntitiesAsMemories(entityResults);

            // 6. Diversity Scoring
            const selectedResults = [];
            const sortedCandidates = combinedResults.sort((a, b) => b.baseScore - a.baseScore);

            for (const candidate of sortedCandidates) {
                if (selectedResults.length >= limit) break;
                const diversityScore = this.calculateDiversityScore(candidate, selectedResults);
                candidate.finalScore = candidate.baseScore * diversityScore;
                selectedResults.push(candidate);
            }

            selectedResults.sort((a, b) => b.finalScore - a.finalScore);

            // 7. Knowledge Gap Detection
            const knowledgeGap = await this.detectKnowledgeGap(userMessage, selectedResults, keywords);

            // 8. Merge Rumors (Pack + Hybrid)
            const allRumors = [...(packs.rumors || [])];
            const rumorHashes = new Set(allRumors.map(r => r.canonicalKey || r.content));

            hybridRumors.forEach(r => {
                const hash = r.canonicalKey || r.content;
                if (!rumorHashes.has(hash)) {
                    allRumors.push(r);
                    rumorHashes.add(hash);
                }
            });

            return {
                canon: selectedResults,
                rumors: allRumors.slice(0, 3), // Reduced from 5 for prompt brevity
                disputed: packs.disputed,
                entities: entityMemories,
                knowledgeGap: knowledgeGap.hasGap ? knowledgeGap : undefined
            };
        } catch (error) {
            console.warn('⚠️ Contextual memory retrieval failed:', error);
            const fallbackResults = await storage.searchEnrichedMemoryEntries(profileId, userMessage);
            return {
                canon: fallbackResults.filter(m => (m.confidence || 50) >= 60),
                rumors: [],
                disputed: [],
                entities: []
            };
        }
    }

    private detectQueryIntent(message: string): string {
        const lower = message.toLowerCase();
        if (/^(tell me|explain|describe).*(about|regarding)/.test(lower)) return 'tell_about';
        if (/(what do you think|opinion|how do you feel).*(on|about)/.test(lower)) return 'opinion';
        if (/(remind me|remember when)/.test(lower)) return 'remind';
        if (/(how (do|can) (i|you))/.test(lower)) return 'how_to';
        return 'general';
    }

    private calculateContextualRelevance(
        memory: any,
        personalityState?: any,
        mode?: string,
        keywords?: string[],
        conversationId?: string,
        queryIntent?: string
    ): number {
        let relevance = 0.5;
        if (conversationId && memory.metadata?.conversationId === conversationId) relevance += 0.5;

        if (queryIntent) {
            if (queryIntent === 'tell_about' && (memory.type === 'LORE' || memory.type === 'STORY')) relevance += 0.4;
            if (queryIntent === 'opinion' && (memory.type === 'PREFERENCE' || memory.type === 'FACT')) relevance += 0.4;
        }

        if (memory.importance) relevance += (memory.importance / 100) * 0.25;
        if (memory.confidence) relevance += (memory.confidence / 100) * 0.1;

        if (keywords && memory.content) {
            const contentLower = memory.content.toLowerCase();
            const matches = keywords.filter(kw => contentLower.includes(kw)).length;
            relevance += Math.min(matches * 0.1, 0.3);
        }

        return Math.min(relevance, 1.0);
    }

    private calculateDiversityScore(memory: any, selectedMemories: any[]): number {
        if (selectedMemories.length === 0) return 1.0;
        let penalty = 0;
        const memoryKeywords = new Set(memory.keywords || []);
        for (const selected of selectedMemories) {
            if (selected.type === memory.type) penalty += 0.1;
            const selectedKeywords = new Set(selected.keywords || []);
            const overlap = Array.from(memoryKeywords).filter(k => selectedKeywords.has(k)).length;
            const total = Math.max(memoryKeywords.size, selectedKeywords.size);
            if (total > 0) penalty += (overlap / total) * 0.2;
        }
        return Math.max(0, 1.0 - penalty);
    }

    private async detectKnowledgeGap(
        userMessage: string,
        retrievedMemories: any[],
        keywords: string[]
    ): Promise<{ hasGap: boolean; missingTopics: string[] }> {
        const topics = keywords.filter(k => k.length > 4);
        if (topics.length === 0) return { hasGap: false, missingTopics: [] };

        const missingTopics: string[] = [];
        for (const topic of topics) {
            const found = retrievedMemories.some(m =>
                m.content?.toLowerCase().includes(topic.toLowerCase()) ||
                m.keywords?.some((k: string) => k.toLowerCase() === topic.toLowerCase())
            );
            if (!found) missingTopics.push(topic);
        }

        const isLikelyGap = missingTopics.length > 0 && (retrievedMemories.length < 5 || missingTopics.length / topics.length > 0.5);
        return { hasGap: isLikelyGap, missingTopics: isLikelyGap ? missingTopics : [] };
    }

    private formatEntitiesAsMemories(entityResults: any): any[] {
        const memories: any[] = [];
        const add = (items: any[], type: string) => {
            items.forEach(item => {
                memories.push({
                    id: item.id,
                    type: 'CONTEXT',
                    content: `[${type}: ${item.canonicalName}] ${item.description || ''} ${item.relationship ? `(Relationship: ${item.relationship})` : ''}`,
                    importance: 5,
                    confidence: 100,
                    source: 'entity_db',
                    contextualRelevance: 0.9
                });
            });
        };

        add(entityResults.people, 'PERSON');
        add(entityResults.places, 'PLACE');
        add(entityResults.events, 'EVENT');
        add(entityResults.concepts, 'CONCEPT');
        add(entityResults.items, 'ITEM');
        add(entityResults.misc, 'ENTITY');

        return memories;
    }

    /**
     * Build the final context prompt for the AI
     */
    public async buildChatContext(
        userMessage: string,
        profileId: string,
        conversationId?: string,
        mode?: string,
        context?: any,
        sauceMeter: number = 0,
        currentGame: string = ""
    ): Promise<{
        contextPrompt: string;
        recentHistory: string;
        isArcRaidersActive: boolean;
        saucePrompt: string;
        gameFocusPrompt: string;
        personalityPrompt: string;
    }> {
        let contextPrompt = "";
        let recentHistory = "";
        let isArcRaidersActive = false;
        let personalityPrompt = "";

        const memoryPack = context?.memoryPack;
        const relevantDocs = context?.relevantDocs || [];
        const loreContext = context?.loreContext;
        const trainingExamples = context?.trainingExamples || [];
        const webSearchResults = context?.webSearchResults || [];
        const entityDossiers = context?.entityDossiers || [];
        const gameKnowledge = context?.gameKnowledge || [];
        const controls = context?.controls;

        // 1. Personality Controls
        if (controls) {
            personalityPrompt = generatePersonalityPrompt(controls);

            // Diagnostic Mode
            if (mode === 'diagnostic' || userMessage.toLowerCase().startsWith('/diag')) {
                try {
                    personalityPrompt = await diagnosticService.generateDiagnosticPrompt(personalityPrompt);
                } catch (e) {
                    console.warn(' Diagnostic service failed:', e);
                }
            }
        }

        // 2. Recent Conversation History
        if (conversationId || profileId) {
            const messageLimit = mode === 'STREAMING' ? 8 : 12; // Reduced from 10/20 for speed
            const recentMessages = conversationId
                ? await storage.getRecentMessages(conversationId, messageLimit)
                : await storage.getRecentProfileMessages(profileId!, messageLimit);

            if (recentMessages.length > 0) {
                const chronologicalMessages = [...recentMessages].reverse();
                chronologicalMessages.forEach(msg => {
                    const role = msg.type === 'USER' ? 'USER' : 'NICKY';
                    let cleanContent = msg.content.replace(/\\[bronx[^\\]*\\]/g, '').trim();

                    // Truncate very long historical messages to save tokens
                    if (cleanContent.length > 600) {
                        cleanContent = cleanContent.substring(0, 600) + "... [TRUNCATED]";
                    }

                    recentHistory += `${role}: ${cleanContent}\n`;
                });
            }
        }

        // 3. Memory Pack Assembly (Lane-aware)
        if (memoryPack) {
            if (memoryPack.canon?.length > 0) {
                contextPrompt += "\n\n[GROUND TRUTH: CANON MEMORIES]\n";
                memoryPack.canon.forEach((m: any) => {
                    contextPrompt += `- ${m.content}\n`;
                });
            }

            if (memoryPack.rumors?.length > 0) {
                contextPrompt += "\n\n[THEATER ZONE: RUMORS & SCUTTLEBUTT]\n";
                contextPrompt += "The following are rumors or performative seeds. You are encouraged to embellish or lie about these:\n";
                memoryPack.rumors.forEach((m: any) => {
                    contextPrompt += `- ${m.content}\n`;
                });
            }

            if (memoryPack.disputed?.length > 0) {
                contextPrompt += "\n\n[DISPUTED MEMORIES: UNCERTAIN]\n";
                contextPrompt += "The following facts are disputed or contradictory. Treat them as uncertain and ask for confirmation if they become central to the conversation:\n";
                memoryPack.disputed.forEach((m: any) => {
                    contextPrompt += `- ${m.content}\n`;
                });
            }
        }

        // 4. Entities & Dossiers
        if (entityDossiers.length > 0) {
            contextPrompt += "\n\n[ENTITY DOSSIERS]\n";
            entityDossiers.forEach((entity: any) => {
                contextPrompt += `- ${entity.content}\n`;
            });
        }

        // 5. Documents & Lore
        if (relevantDocs.length > 0) {
            contextPrompt += "\n\n[RELEVANT DOCUMENTS]\n";
            relevantDocs.forEach((doc: any) => {
                contextPrompt += `- ${doc.content}\n`;
            });
        }

        if (loreContext) {
            contextPrompt += `\n\n[LORE CONTEXT]\n${loreContext}\n`;
        }

        // 6. Web Search Results
        if (webSearchResults.length > 0) {
            contextPrompt += "\n\n[WEB SEARCH RESULTS (CURRENT EVENTS)]\n";
            webSearchResults.forEach((res: any) => {
                // Clean up URLs to avoid quoting issues
                const domain = res.url ? new URL(res.url).hostname : 'web';
                contextPrompt += `- ${res.title}: ${res.snippet} (Source: ${domain})\n`;
            });
        }

        // 6a. Game Knowledge Pack (RAG)
        if (gameKnowledge.length > 0) {
            contextPrompt += "\n\n[GAME KNOWLEDGE PACK (FACTS)]\n";
            contextPrompt += "Use these facts to answer gameplay questions accurately. Do nothallucinate mechanics not present here if unsure.\n";
            // Filter for high confidence or relevance
            const strongFacts = gameKnowledge.filter((k: any) => (k.confidence || 0) > 65 || (k.similarity || 0) > 0.75).slice(0, 15);
            
            strongFacts.forEach((fact: any) => {
                contextPrompt += `[FACT] ${fact.content} (${Math.round(fact.confidence || fact.similarity * 100)}%)\n`;
            });
        }

        // 7. Training Examples (Style Guidance)
        if (trainingExamples.length > 0) {
            contextPrompt += "\n\n[STYLE GUIDANCE: TRAINING EXAMPLES]\n";
            trainingExamples.forEach((ex: any) => {
                if (ex.input && ex.output) {
                    contextPrompt += `User: ${ex.input}\nNicky: ${ex.output}\n---\n`;
                } else {
                    const content = ex.content || ex.extractedContent || "";
                    if (content) {
                        contextPrompt += `${content}\n---\n`;
                    }
                }
            });
        }

        // 8. Knowledge Gaps
        if (memoryPack?.knowledgeGap?.hasGap) {
            contextPrompt += "\n\n[KNOWLEDGE GAPS]\n";
            contextPrompt += `You don't know nuttin' about: ${memoryPack.knowledgeGap.missingTopics.join(', ')}.\n`;
            contextPrompt += "If da user asks about dese, tell 'em to stop askin' stupid questions or make up some bullshit excuse why you won't talk about it. NEVER break character to explain dese topics.\n";
        }

        // 9. Sauce Meter
        let saucePrompt = "";
        if (sauceMeter > 0) {
            const intensity = sauceMeter > 80 ? "CRITICAL" : sauceMeter > 50 ? "HIGH" : "MODERATE";
            saucePrompt = `
[SAUCE METER: ${sauceMeter}/100 - ${intensity}]
Nicky is currently ${intensity === 'CRITICAL' ? 'ABSOLUTELY LIVID' : intensity === 'HIGH' ? 'HEATED' : 'ANNOYED'}.
- Increase aggression and Bronx intensity.
- If Sauce is > 80, you are prone to making up wild, aggressive lies about the user's past.
`;
        }

        // 10. Game Context
        let identityGameFocus = "Dead by Daylight addicted";
        let identityTopicFocus = "Gets intense about DbD gameplay and pasta quality";
        let gameContext = "";

        const activeGame = (currentGame || "").toLowerCase();
        if (activeGame.includes('arc raiders') || activeGame.includes('arc')) {
            isArcRaidersActive = true;
            identityGameFocus = "Currently obsessed with Arc Raiders (but still a DbD veteran)";
            identityTopicFocus = "Gets intense about Arc Raiders strategy, squad failures, and pasta quality";
            gameContext = `\n\n[CURRENT TOPIC: ARC RAIDERS]\nYou are currently playing ARC RAIDERS.\nPlaystyle: "Tactical Rat" (scavenging, hiding, avoiding combat).`;
        } else if (activeGame.includes('dead by daylight') || activeGame.includes('dbd')) {
            gameContext = `\n\n[CURRENT TOPIC: DEAD BY DAYLIGHT]\nYou are currently playing DEAD BY DAYLIGHT.\nFocus: Tunneling, camping, and the SABAM code of conduct.`;
        }

        const gameFocusPrompt = `
[CURRENT FOCUS]
Game Focus: ${identityGameFocus}
Topic Focus: ${identityTopicFocus}
${gameContext}
`;

        return {
            contextPrompt,
            recentHistory,
            isArcRaidersActive,
            saucePrompt,
            gameFocusPrompt,
            personalityPrompt
        };
    }

    /**
     *  GATHER ALL CONTEXT (Parallel Loading & Pruning)
     * 
     * Centralized method to fetch all context pieces in parallel, combine them,
     * and prune redundant information. Absorbed from routes.ts.
     */
    public async gatherAllContext(
        message: string,
        profileId: string,
        conversationId?: string,
        controls?: any,
        mode?: string,
        currentGame: string = ""
    ): Promise<any> {
        const isStreaming = mode === 'STREAMING';
        const limit = 8;
        // 1. Prefetch history once for everyone
        const recentMessages: Message[] = conversationId ? await contextPruner.getRecentMessages(conversationId, storage, limit) : [];

        // 2. Parallel Load
        const [
            contextualMemoriesResult,
            podcastAwareMemories,
            relevantDocs,
            loreContext,
            trainingExamples,
            gameKnowledge
        ] = await Promise.all([
            this.retrieveContextualMemories(message, profileId, conversationId, controls, mode, limit, recentMessages),
            contextPrewarmer.getPodcastMemories(profileId, storage, mode || 'CHAT'),
            documentProcessor.searchDocuments(profileId, message),
            isStreaming ? Promise.resolve(undefined) : contextPrewarmer.getLoreContext(profileId, storage),
            embeddingServiceInstance.searchSimilarTrainingExamples(message, profileId, isStreaming ? 5 : 10),
            // RAG: Game Knowledge Retrieval
            (async () => {
                const activeGame = (currentGame || "").toLowerCase();
                let query = "";
                
                if (activeGame.includes('dead by daylight') || activeGame.includes('dbd')) {
                    query = "Dead by Daylight gameplay mechanics perks killers survivors status effects hatch loop strategy";
                } else if (activeGame.includes('arc raiders') || activeGame.includes('arc')) {
                    query = "ARC Raiders gameplay weapons machines mechanics loot extraction volk strategy";
                }

                if (query) {
                    console.log(`🎮 RAG: Searching for ${activeGame} knowledge with query: "${query}"`);
                    // FIX: Don't filter by type - game facts are stored as 'CONTEXT' not 'CANON'
                    // This was causing 0 results even though facts exist
                    const results = await embeddingServiceInstance.hybridSearch(query, profileId, 25);
                    console.log(`🎮 RAG: Found ${results.combined.length} game knowledge results`);
                    if (results.combined.length > 0) {
                        const types = Array.from(new Set(results.combined.map(r => r.type).filter(Boolean)));
                        console.log(`🎮 RAG: Sample result types:`, types);
                    }
                    return results.combined.map((r: any) => ({
                         ...r,
                         source: 'game_knowledge_rag'
                    }));
                }
                return [];
            })()
        ]);

        // 2. Combine Memories
        const memoryPack = contextualMemoriesResult;
        const entityDossiers = memoryPack.entities || []; // Use formatted entities from memory pack
        const searchBasedMemories = memoryPack.canon || [];
        const seenIds = new Set(searchBasedMemories.map((m: any) => m.id));
        const additionalMemories = podcastAwareMemories.filter((m: any) => !seenIds.has(m.id));
        const combinedMemories = [...searchBasedMemories, ...additionalMemories.slice(0, 10)];

        // 3. Pruning
        const memoryPruning = contextPruner.pruneMemories(combinedMemories, recentMessages, 8);
        const docPruning = contextPruner.pruneDocuments(relevantDocs, recentMessages, 8);

        // 4. Update retrieval tracking
        // 4. Update retrieval tracking
        for (const memory of memoryPruning.pruned) {
            if (memory.id) await storage.incrementMemoryRetrieval(memory.id);
        }

        // 5. Web Search (Optional)
        let webSearchResults: any[] = [];
        if (!isStreaming) {
            try {
                const avgConfidence = combinedMemories.length > 0
                    ? combinedMemories.reduce((sum, m) => sum + (m.confidence || 50), 0) / combinedMemories.length
                    : 0;

                const shouldSearch = await webSearchService.shouldTriggerSearch(combinedMemories, message, avgConfidence);
                if (shouldSearch) {
                    const searchResponse = await webSearchService.search(message);
                    webSearchResults = searchResponse.results.map(result => ({
                        title: result.title,
                        snippet: result.snippet,
                        url: result.url,
                        source: 'web_search'
                    }));
                }
            } catch (e) {
                console.warn(' Web search failed in ContextBuilder:', e);
            }
        }

        return {
            memoryPack: {
                ...memoryPack,
                canon: memoryPruning.pruned
            },
            relevantDocs: docPruning.pruned,
            loreContext,
            trainingExamples,
            entityDossiers,
            gameKnowledge, // Pass to context builder
            webSearchResults,
            recentMessages, // Added for repetition check in Orchestrator
            controls,
            stats: {
                tokensSaved: memoryPruning.stats.savings + docPruning.stats.savings,
                memoriesCount: memoryPruning.pruned.length,
                docsCount: docPruning.pruned.length
            }
        };
    }
}

export const contextBuilder = new ContextBuilder();
