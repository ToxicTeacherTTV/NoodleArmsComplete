import { GoogleGenAI } from "@google/genai";
import type { 
  KnowledgeRelationship, 
  KnowledgeCluster, 
  ConversationFeedback, 
  KnowledgeGap, 
  EvolutionMetrics 
} from "../../shared/evolutionaryTypes.js";
import type { MemoryEntry } from "../../shared/schema.js";

class EvolutionaryAI {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    
    // 🚫 FLASH BAN ENFORCEMENT: Block Flash models at runtime
    // Note: We can't easily override getGenerativeModel in the new SDK structure
    // but we will enforce the model name in the method calls below.
  }

  // 1. RELATIONSHIP MAPPING - Build knowledge graphs
  async discoverRelationships(facts: MemoryEntry[]): Promise<KnowledgeRelationship[]> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const prompt = `You are analyzing Nicky "Noodle Arms" A.I. Dente's knowledge base to discover relationships between facts.

Find connections between these facts:
${facts.map(f => `[${f.id}] ${f.content}`).join('\n')}

Identify relationships where facts:
- SUPPORTS: One fact reinforces another
- CONTRADICTS: Facts conflict (old vs new preferences)  
- ENHANCES: One fact adds detail to another
- DEPENDS_ON: One fact requires another for context
- TEMPORAL_SEQUENCE: Facts show progression over time

For each relationship, rate:
- strength: 1-10 (how strong the connection is)
- confidence: 0-1 (how sure you are about this relationship)

Return JSON array:
[
  {
    "sourceFactId": "fact-id-1",
    "targetFactId": "fact-id-2", 
    "relationshipType": "SUPPORTS",
    "strength": 8,
    "confidence": 0.9
  }
]

Only include strong, meaningful relationships (strength >= 6).`;

    try {
      const result = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sourceFactId: { type: "string" },
                targetFactId: { type: "string" },
                relationshipType: { type: "string", enum: ["SUPPORTS", "CONTRADICTS", "ENHANCES", "DEPENDS_ON", "TEMPORAL_SEQUENCE"] },
                strength: { type: "number" },
                confidence: { type: "number" }
              },
              required: ["sourceFactId", "targetFactId", "relationshipType", "strength", "confidence"]
            }
          }
        }
      });

      return JSON.parse(result.text || "[]");
    } catch (error) {
      console.error('❌ Relationship discovery failed:', error);
      console.warn('⚠️ No relationships discovered due to AI error - knowledge graph will be incomplete');
      
      // Return empty array with error metadata
      const result: any[] = [];
      (result as any)._discoveryError = {
        type: 'AI_ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        factsCount: facts.length
      };
      return result;
    }
  }

  // 2. INTELLIGENT CLUSTERING - Group related concepts
  async createIntelligentClusters(facts: MemoryEntry[]): Promise<KnowledgeCluster[]> {
    const prompt = `Analyze Nicky's knowledge and create intelligent clusters of related concepts.

Facts to cluster:
${facts.map(f => `${f.content} [${f.type}]`).join('\n')}

Create clusters around themes like:
- Dead by Daylight knowledge (killers, survivors, maps, strategies)
- Personality traits (anger triggers, preferences, habits)
- Streaming/podcast content (jokes, catchphrases, format preferences)
- Relationships (Earl, Vice Don, viewers, other streamers)
- Gaming skills (strengths, weaknesses, preferred playstyles)
- Character backstory/lore

For each cluster:
- name: Short, descriptive name
- description: What this cluster represents
- factIds: IDs of facts that belong here (from input)
- importance: 1-100 based on how central this is to Nicky's character
- concepts: Key concepts/keywords for this cluster

Return JSON array of clusters:
[
  {
    "id": "cluster-1",
    "name": "DBD Killer Expertise", 
    "description": "Knowledge about Dead by Daylight killers and strategies",
    "factIds": ["fact-id-1", "fact-id-2"],
    "importance": 90,
    "concepts": ["ghostface", "stealth", "killer", "strategy"]
  }
]`;

    try {
      const result = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
                factIds: { type: "array", items: { type: "string" } },
                importance: { type: "number" },
                concepts: { type: "array", items: { type: "string" } }
              },
              required: ["id", "name", "description", "factIds", "importance", "concepts"]
            }
          }
        }
      });

      return JSON.parse(result.text || "[]").map((cluster: any) => ({
        ...cluster,
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('❌ Clustering failed:', error);
      console.warn('⚠️ Knowledge clustering unavailable due to AI error - memory organization degraded');
      
      // Return empty array with error metadata
      const result: any[] = [];
      (result as any)._clusteringError = {
        type: 'AI_CLUSTERING_FAILED',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        factsCount: facts.length
      };
      return result;
    }
  }

  // 3. PREDICTIVE KNOWLEDGE GAPS - Find what's missing
  async identifyKnowledgeGaps(facts: MemoryEntry[], clusters: KnowledgeCluster[]): Promise<KnowledgeGap[]> {
    const prompt = `Analyze Nicky's knowledge to find gaps that would improve character consistency.

Current knowledge clusters:
${clusters.map(c => `${c.name}: ${c.description} (${c.factIds.length} facts)`).join('\n')}

Sample facts:
${facts.slice(0, 20).map(f => f.content).join('\n')}

Identify knowledge gaps in:
1. DBD gameplay (maps, survivor strategies, meta changes)
2. Personality depth (specific triggers, backstory details, relationships)
3. Streaming content (recurring jokes, audience interactions, format evolution)
4. Character consistency (contradictions, missing motivations)

For each gap, suggest:
- category: Area of missing knowledge  
- description: What's missing and why it matters
- priority: 1-10 (how important this gap is)
- suggestedQuestions: Questions to ask users to fill this gap
- relatedFactIds: Existing facts that relate to this gap

Return JSON array:
[
  {
    "category": "DBD Maps Knowledge",
    "description": "Missing preferences for specific maps and strategies per map",
    "priority": 7,
    "suggestedQuestions": ["What's your favorite map as killer?", "Which maps do you hate most?"],
    "relatedFactIds": ["fact-about-killer-preference"]
  }
]`;

    try {
      const result = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                description: { type: "string" },
                priority: { type: "number" },
                suggestedQuestions: { type: "array", items: { type: "string" } },
                relatedFactIds: { type: "array", items: { type: "string" } }
              },
              required: ["category", "description", "priority", "suggestedQuestions", "relatedFactIds"]
            }
          }
        }
      });

      return JSON.parse(result.text || "[]");
    } catch (error) {
      console.error('❌ Knowledge gap analysis failed:', error);
      console.warn('⚠️ Gap analysis unavailable due to AI error - missing insights into knowledge completeness');
      
      // Return empty array with error metadata
      const result: any[] = [];
      (result as any)._gapAnalysisError = {
        type: 'AI_GAP_ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        clustersCount: clusters.length,
        factsCount: facts.length
      };
      return result;
    }
  }

  // 4. CONTEXT-AWARE CONSOLIDATION - Smart temporal merging
  async contextAwareConsolidation(facts: MemoryEntry[]): Promise<MemoryEntry[]> {
    const prompt = `Perform advanced consolidation of Nicky's memories with temporal awareness.

Consolidate these facts while:
1. Resolving contradictions (keep newer preferences, note evolution)
2. Merging related facts into comprehensive entries
3. Preserving temporal context (when things changed)
4. Maintaining character depth and nuance
5. REMOVING SEARCH ARTIFACTS: Delete any memories that look like web search results, citations, or tool outputs (e.g., "Source: youtube.com", "searched for:", "According to the web").

Facts to consolidate:
${facts.map(f => `[${f.createdAt}] ${f.content} (Type: ${f.type}, Importance: ${f.importance})`).join('\n')}

Rules:
- If facts conflict, prefer newer ones but note the evolution
- Merge related facts that add detail to each other
- Preserve all unique information
- Add temporal context when relevant
- Boost importance for frequently referenced facts
- **CRITICAL: Keep facts ATOMIC and CONCISE.** Do not create "walls of text". Each entry should be a single, clear concept.
- **CRITICAL: Do not split a single coherent story into fragmented sentences.** Keep narrative beats together.
- **CRITICAL: Ensure each fact is a complete, standalone thought.** Do not leave dangling sentences.

Return optimized facts in JSON:
[
  {
    "content": "consolidated fact content",
    "type": "FACT|PREFERENCE|LORE|CONTEXT",
    "importance": 1-10,
    "keywords": ["keyword1", "keyword2"],
    "temporalContext": "when this was true/relevant",
    "qualityScore": 1-10,
    "source": "consolidation"
  }
]`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string" },
                type: { type: "string", enum: ["FACT", "PREFERENCE", "LORE", "CONTEXT"] },
                importance: { type: "number" },
                keywords: { type: "array", items: { type: "string" } },
                temporalContext: { type: "string" },
                qualityScore: { type: "number" },
                source: { type: "string" }
              },
              required: ["content", "type", "importance", "keywords", "qualityScore", "source"]
            }
          }
        },
        contents: prompt,
      });

      const consolidatedData = JSON.parse(response.text || "[]");
      return consolidatedData.map((item: any) => ({
        id: `consolidated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        profileId: facts[0]?.profileId || "",
        content: item.content,
        type: item.type,
        importance: item.importance,
        keywords: item.keywords,
        temporalContext: item.temporalContext || null,
        qualityScore: item.qualityScore,
        source: item.source,
        successRate: 100,
        retrievalCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('❌ Context-aware consolidation failed:', error);
      console.warn('⚠️ Advanced consolidation unavailable due to AI error - using original facts without optimization');
      
      // Return original facts with error metadata
      const result = [...facts];
      (result as any)._consolidationError = {
        type: 'AI_CONSOLIDATION_FAILED',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        originalFactsCount: facts.length
      };
      return result;
    }
  }

  // 5. QUALITY EVOLUTION - Learn from feedback
  async evaluateFactQuality(
    fact: MemoryEntry, 
    usageHistory: { used: boolean; successful: boolean }[]
  ): Promise<number> {
    const usageRate = usageHistory.filter(h => h.used).length / Math.max(usageHistory.length, 1);
    const successRate = usageHistory.filter(h => h.used && h.successful).length / Math.max(usageHistory.filter(h => h.used).length, 1);
    
    // Calculate quality based on usage patterns
    let qualityScore = 5; // Base score
    
    // Boost for frequently used facts
    if (usageRate > 0.3) qualityScore += 2;
    
    // Boost for successful usage
    if (successRate > 0.8) qualityScore += 2;
    
    // Penalize for low usage
    if (usageRate < 0.1) qualityScore -= 1;
    
    // Penalize for failed usage
    if (successRate < 0.5) qualityScore -= 2;
    
    return Math.max(1, Math.min(10, qualityScore));
  }

  // 6. EVOLUTIONARY OPTIMIZATION - Put it all together
  async evolutionaryOptimization(facts: MemoryEntry[]): Promise<{
    optimizedFacts: MemoryEntry[];
    relationships: KnowledgeRelationship[];
    clusters: KnowledgeCluster[];
    knowledgeGaps: KnowledgeGap[];
    metrics: EvolutionMetrics;
  }> {
    console.log(`🧠 Starting evolutionary optimization of ${facts.length} facts...`);
    
    // Step 1: Context-aware consolidation (OPTIONAL / SEPARATE)
    // ⚠️ CHANGE: We now run analysis on the ORIGINAL facts so we can update the DB directly.
    // Consolidation is cool but destructive, so we'll skip it for the main loop for now.
    console.log('🔄 Skipping consolidation to preserve DB integrity...');
    const workingFacts = facts; 
    
    // Step 2: Discover relationships
    console.log('🕸️ Discovering knowledge relationships...');
    const relationships = await this.discoverRelationships(workingFacts);
    
    // Step 3: Create intelligent clusters
    console.log('🎯 Creating intelligent clusters...');
    const clusters = await this.createIntelligentClusters(workingFacts);
    
    // Step 4: Identify knowledge gaps
    console.log('🔍 Identifying knowledge gaps...');
    const knowledgeGaps = await this.identifyKnowledgeGaps(workingFacts, clusters);
    
    // Step 5: Calculate evolution metrics
    const metrics: EvolutionMetrics = {
      totalFacts: workingFacts.length,
      avgQualityScore: workingFacts.reduce((sum, f) => sum + (f.qualityScore || 5), 0) / workingFacts.length,
      clusterCount: clusters.length,
      relationshipCount: relationships.length,
      learningRate: Math.min(1, relationships.length / workingFacts.length),
      knowledgeCoverage: Math.min(1, clusters.length / 10) // Target 10 core knowledge areas
    };
    
    console.log(`✨ Evolution complete! 
      Facts Analyzed: ${workingFacts.length}
      Relationships Found: ${relationships.length}
      Clusters Created: ${clusters.length}
      Knowledge Gaps: ${knowledgeGaps.length}`);
    
    return {
      optimizedFacts: workingFacts,
      relationships,
      clusters,
      knowledgeGaps,
      metrics
    };
  }
}

export default EvolutionaryAI;