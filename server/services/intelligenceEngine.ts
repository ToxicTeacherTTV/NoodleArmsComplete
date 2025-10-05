import Anthropic from '@anthropic-ai/sdk';
import { memoryEntries, contentFlags } from '@shared/schema';
import type { MemoryEntry, ContentFlag } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { geminiService } from './gemini.js';
import { storage } from '../storage.js';

// Intelligence analysis types
interface ClusterAnalysis {
  clusterId: string;
  factIds: string[];
  consolidationScore: number;
  suggestedMerge: string;
  reasoning: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface SourceReliability {
  sourceId: string;
  reliabilityScore: number; // 0-100
  factAccuracyRate: number;
  contradictionRate: number;
  supportRate: number;
  recommendation: 'TRUST' | 'VERIFY' | 'DISTRUST';
}

interface PersonalityDrift {
  traitName: string;
  baseline: number;
  current: number;
  driftAmount: number;
  severity: 'MINOR' | 'MODERATE' | 'MAJOR';
  affectedFacts: string[];
  recommendation: string;
}

interface RelevanceScore {
  memoryId: string;
  relevanceScore: number; // 0-100
  contextSimilarity: number;
  recencyFactor: number;
  retrievalFrequency: number;
  shouldHide: boolean;
  reasoning: string;
}

interface MemorySummary {
  id: string;
  type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT' | 'GENERAL';
  title: string;
  content: string;
  factCount: number;
  confidenceScore: number;
  lastUpdated: string;
  insights: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface IntelligenceSummary {
  clusterAnalysis: ClusterAnalysis[];
  sourceReliability: SourceReliability[];
  personalityDrift: PersonalityDrift[];
  relevanceScores: RelevanceScore[];
  actionRequired: number;
  autoHandled: number;
  priorityActions: string[];
}

export class IntelligenceEngine {
  private anthropic: Anthropic;
  private gemini: any;
  private storage: any;

  constructor() {
    this.storage = storage;
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.gemini = geminiService;
  }

  /**
   * INTELLIGENCE LAYER 1: Pattern Recognition for Fact Clustering
   * Identifies groups of related facts that should be consolidated
   */
  async analyzeFactClusters(
    db: PostgresJsDatabase<any>,
    profileId: string,
    limit: number = 100
  ): Promise<ClusterAnalysis[]> {
    console.log(`🧠 Analyzing fact clusters for profile ${profileId}`);

    // Get recent facts that haven't been clustered
    const facts = await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE'),
          sql`${memoryEntries.clusterId} IS NULL`
        )
      )
      .orderBy(desc(memoryEntries.createdAt))
      .limit(limit);

    if (facts.length < 2) {
      return [];
    }

    const clusters: ClusterAnalysis[] = [];

    try {
      // Use AI to identify semantic clusters
      const prompt = `Analyze these memory facts and identify clusters of related information that should be consolidated:

${facts.map((f, i) => `${i + 1}. "${f.content}" (ID: ${f.id})`).join('\n')}

Look for:
- Facts about the same topic/person/event
- Redundant or overlapping information
- Facts that could be merged for better organization
- Related concepts that should be grouped

For each cluster you identify, provide:
- List of fact IDs that belong together
- Consolidation score (0-100, higher = more urgent)
- Suggested merged content
- Reasoning for the grouping
- Priority level

Return a JSON array:
[{
  "factIds": ["id1", "id2"],
  "consolidationScore": 85,
  "suggestedMerge": "Combined fact content",
  "reasoning": "Why these should be merged",
  "priority": "HIGH"
}]

If no clusters found, return: []`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 3000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content.find(c => c.type === 'text')?.text || '';
      const analysis = JSON.parse(content);

      if (Array.isArray(analysis)) {
        for (const cluster of analysis) {
          clusters.push({
            clusterId: `cluster_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            factIds: cluster.factIds,
            consolidationScore: cluster.consolidationScore,
            suggestedMerge: cluster.suggestedMerge,
            reasoning: cluster.reasoning,
            priority: cluster.priority || 'MEDIUM'
          });
        }
      }

      console.log(`🎯 Found ${clusters.length} fact clusters needing consolidation`);
      return clusters;

    } catch (error) {
      console.error('❌ Fact clustering analysis failed:', error);
      return [];
    }
  }

  /**
   * INTELLIGENCE LAYER 2: Source Reliability Scoring
   * Auto-adjusts importance ratings based on historical accuracy
   */
  async analyzeSourceReliability(
    db: PostgresJsDatabase<any>,
    profileId: string
  ): Promise<SourceReliability[]> {
    console.log(`📊 Analyzing source reliability for profile ${profileId}`);

    // Get source statistics
    const sources = await db
      .select({
        sourceId: memoryEntries.sourceId,
        totalFacts: sql<number>`count(*)`,
        avgConfidence: sql<number>`avg(${memoryEntries.confidence})`,
        avgImportance: sql<number>`avg(${memoryEntries.importance})`,
        contradictionCount: sql<number>`count(${memoryEntries.contradictionGroupId})`,
        supportSum: sql<number>`sum(${memoryEntries.supportCount})`
      })
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          sql`${memoryEntries.sourceId} IS NOT NULL`
        )
      )
      .groupBy(memoryEntries.sourceId)
      .having(sql`count(*) >= 3`); // Only sources with 3+ facts

    const reliability: SourceReliability[] = [];

    for (const source of sources) {
      const totalFacts = Number(source.totalFacts);
      const avgConfidence = Number(source.avgConfidence) || 50;
      const contradictionCount = Number(source.contradictionCount) || 0;
      const supportSum = Number(source.supportSum) || 0;

      // Calculate reliability metrics
      const factAccuracyRate = Math.max(0, avgConfidence / 100);
      const contradictionRate = contradictionCount / totalFacts;
      const supportRate = supportSum / totalFacts;

      // Calculate overall reliability score
      const reliabilityScore = Math.round(
        (factAccuracyRate * 0.4 + 
         (1 - contradictionRate) * 0.3 + 
         Math.min(supportRate / 3, 1) * 0.3) * 100
      );

      // Determine recommendation
      let recommendation: 'TRUST' | 'VERIFY' | 'DISTRUST';
      if (reliabilityScore >= 80) recommendation = 'TRUST';
      else if (reliabilityScore >= 60) recommendation = 'VERIFY';
      else recommendation = 'DISTRUST';

      reliability.push({
        sourceId: source.sourceId!,
        reliabilityScore,
        factAccuracyRate: Math.round(factAccuracyRate * 100),
        contradictionRate: Math.round(contradictionRate * 100),
        supportRate: Math.round(supportRate * 100),
        recommendation
      });
    }

    console.log(`📈 Analyzed ${reliability.length} sources for reliability`);
    return reliability.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  }

  /**
   * INTELLIGENCE LAYER 3: Personality Drift Detection
   * Warns when core traits are shifting from baseline
   */
  async analyzePersonalityDrift(
    db: PostgresJsDatabase<any>,
    profileId: string
  ): Promise<PersonalityDrift[]> {
    console.log(`🎭 Analyzing personality drift for profile ${profileId}`);

    // Get core personality traits from recent facts
    const recentFacts = await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE'),
          eq(memoryEntries.type, 'LORE')
        )
      )
      .orderBy(desc(memoryEntries.createdAt))
      .limit(50);

    if (recentFacts.length < 10) {
      return [];
    }

    try {
      const prompt = `Analyze these personality-related facts for character trait drift:

${recentFacts.map(f => `"${f.content}"`).join('\n')}

Identify core personality traits and check for inconsistencies or drift from established character patterns.

Look for:
- Contradictory personality descriptions
- Shifts in behavior patterns
- Changes in preferences or values
- Inconsistent emotional responses

For each drift detected, provide:
- Trait name
- Baseline description (original pattern)
- Current description (new pattern)
- Drift severity (MINOR/MODERATE/MAJOR)
- Affected fact IDs
- Recommendation for handling

Return JSON array:
[{
  "traitName": "Aggressiveness",
  "baseline": 85,
  "current": 65,
  "driftAmount": -20,
  "severity": "MODERATE",
  "affectedFacts": ["id1", "id2"],
  "recommendation": "Review recent interactions that may have softened character"
}]

If no drift detected, return: []`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content.find(c => c.type === 'text')?.text || '';
      const drifts = JSON.parse(content);

      console.log(`🎯 Detected ${Array.isArray(drifts) ? drifts.length : 0} personality drifts`);
      return Array.isArray(drifts) ? drifts : [];

    } catch (error) {
      console.error('❌ Personality drift analysis failed:', error);
      return [];
    }
  }

  /**
   * INTELLIGENCE LAYER 4: Context Relevance Scoring
   * Hides irrelevant memories from active retrieval
   */
  async analyzeContextRelevance(
    db: PostgresJsDatabase<any>,
    profileId: string,
    contextQuery?: string
  ): Promise<RelevanceScore[]> {
    console.log(`🎯 Analyzing context relevance for profile ${profileId}`);

    const memories = await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.createdAt))
      .limit(200);

    const relevanceScores: RelevanceScore[] = [];
    const now = Date.now();

    for (const memory of memories) {
      // Calculate recency factor (newer = more relevant)
      const createdAt = memory.createdAt ? new Date(memory.createdAt) : new Date();
      const daysSinceCreated = (now - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.max(0, 100 - (daysSinceCreated * 2));

      // Calculate retrieval frequency
      const retrievalFrequency = (memory.retrievalCount || 0) * 10;

      // Base relevance score
      let relevanceScore = (
        recencyFactor * 0.3 +
        retrievalFrequency * 0.3 +
        (memory.importance || 1) * 10 * 0.2 +
        (memory.confidence || 50) * 0.2
      );

      // Context similarity (if context provided)
      let contextSimilarity = 50;
      if (contextQuery) {
        const queryWords = contextQuery.toLowerCase().split(' ');
        const memoryWords = memory.content.toLowerCase().split(' ');
        const commonWords = queryWords.filter(word => memoryWords.includes(word));
        contextSimilarity = (commonWords.length / queryWords.length) * 100;
        relevanceScore = relevanceScore * 0.7 + contextSimilarity * 0.3;
      }

      // Determine if should be hidden (very low relevance)
      const shouldHide = relevanceScore < 25 && daysSinceCreated > 30 && (memory.retrievalCount || 0) === 0;

      relevanceScores.push({
        memoryId: memory.id,
        relevanceScore: Math.round(relevanceScore),
        contextSimilarity: Math.round(contextSimilarity),
        recencyFactor: Math.round(recencyFactor),
        retrievalFrequency: Math.round(retrievalFrequency),
        shouldHide,
        reasoning: shouldHide ? 'Low relevance + old + never accessed' : 'Keep active'
      });
    }

    const hiddenCount = relevanceScores.filter(r => r.shouldHide).length;
    console.log(`📊 Analyzed ${relevanceScores.length} memories, suggesting ${hiddenCount} for hiding`);

    return relevanceScores.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * INTELLIGENCE LAYER 5: AI-Generated Memory Summaries
   * Creates intelligent overviews instead of individual fact reading
   */
  async generateMemorySummaries(
    db: PostgresJsDatabase<any>,
    profileId: string,
    options: {
      summaryType?: 'overview' | 'recent' | 'topical' | 'trend_analysis';
      timeframe?: 'day' | 'week' | 'month' | 'all';
      maxFacts?: number;
      focusArea?: string;
    } = {}
  ): Promise<{
    summaries: MemorySummary[];
    overview: string;
    insights: string[];
    recommendations: string[];
  }> {
    const { summaryType = 'overview', timeframe = 'all', maxFacts = 100, focusArea } = options;

    console.log(`📊 Generating ${summaryType} summaries for profile ${profileId}`);

    // Get memory entries based on parameters
    const memories = await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .limit(maxFacts)
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.confidence));

    if (memories.length === 0) {
      return {
        summaries: [],
        overview: 'No active memories found for summary generation.',
        insights: ['Memory database is empty or contains no active entries'],
        recommendations: ['Add more content to build a comprehensive knowledge base']
      };
    }

    // Group memories by category/type for better summarization
    const factsByType = memories.reduce((acc, memory) => {
      const type = memory.type || 'GENERAL';
      if (!acc[type]) acc[type] = [];
      acc[type].push(memory);
      return acc;
    }, {} as Record<string, typeof memories>);

    const summaries: MemorySummary[] = [];

    // Generate summaries for each category
    for (const [type, facts] of Object.entries(factsByType)) {
      if (facts.length === 0) continue;

      try {        
        const summary: MemorySummary = {
          id: `${type}_${Date.now()}`,
          type: type as any,
          title: this.generateSummaryTitle(type, facts.length),
          content: this.generateBasicSummary(facts),
          factCount: facts.length,
          confidenceScore: Math.round(facts.reduce((sum, f) => sum + (f.confidence || 50), 0) / facts.length),
          lastUpdated: new Date().toISOString(),
          insights: this.extractInsights(facts),
          priority: facts.some(f => (f.importance || 1) > 7) ? 'HIGH' : 
                   facts.some(f => (f.importance || 1) > 4) ? 'MEDIUM' : 'LOW'
        };

        summaries.push(summary);
      } catch (error) {
        console.error(`Failed to generate summary for type ${type}:`, error);
      }
    }

    // Generate overall overview
    const overview = this.generateOverallOverview(summaries, memories.length);
    
    // Generate insights and recommendations
    const insights = this.generateInsights(memories, summaries);
    const recommendations = this.generateRecommendations(memories, summaries);

    console.log(`✅ Generated ${summaries.length} summaries with ${insights.length} insights`);

    return {
      summaries,
      overview,
      insights,
      recommendations
    };
  }

  private generateSummaryTitle(type: string, factCount: number): string {
    const typeLabels: Record<string, string> = {
      FACT: 'Key Facts',
      PREFERENCE: 'Preferences & Likes',
      LORE: 'Personal Stories',
      CONTEXT: 'Contextual Information',
      GENERAL: 'General Knowledge'
    };

    return `${typeLabels[type] || type} Summary (${factCount} entries)`;
  }

  private generateBasicSummary(facts: any[]): string {
    // Create a basic summary without AI calls to avoid costs
    const highConfidenceFacts = facts.filter(f => (f.confidence || 0) >= 80);
    const recentFacts = facts.slice(0, 5); // Most recent/important
    
    let summary = '';
    
    if (highConfidenceFacts.length > 0) {
      summary += `**High Confidence Information (${highConfidenceFacts.length} items):**\n`;
      summary += highConfidenceFacts.slice(0, 3).map(f => `• ${f.content.substring(0, 100)}...`).join('\n');
      summary += '\n\n';
    }
    
    if (recentFacts.length > 0) {
      summary += `**Key Entries:**\n`;
      summary += recentFacts.map(f => `• ${f.content.substring(0, 150)}...`).join('\n');
    }
    
    return summary || 'No summary content available.';
  }

  private extractInsights(facts: any[]): string[] {
    const insights: string[] = [];
    
    const avgConfidence = facts.reduce((sum, f) => sum + (f.confidence || 50), 0) / facts.length;
    const highImportanceCount = facts.filter(f => (f.importance || 1) > 7).length;
    const lowConfidenceCount = facts.filter(f => (f.confidence || 50) < 60).length;
    
    if (avgConfidence > 80) {
      insights.push('This category has high overall confidence - information is well-established');
    } else if (avgConfidence < 60) {
      insights.push('This category has lower confidence - may need verification or consolidation');
    }
    
    if (highImportanceCount > facts.length * 0.3) {
      insights.push('Contains many high-importance items - core knowledge area');
    }
    
    if (lowConfidenceCount > facts.length * 0.4) {
      insights.push('Many entries need confidence improvement - good candidate for review');
    }
    
    return insights;
  }

  private generateOverallOverview(summaries: MemorySummary[], totalFacts: number): string {
    const highPriorityCount = summaries.filter(s => s.priority === 'HIGH').length;
    const avgConfidence = summaries.length > 0 ? summaries.reduce((sum, s) => sum + s.confidenceScore, 0) / summaries.length : 0;
    
    return `**Memory Overview**\n\n` +
           `Total active memories: ${totalFacts}\n` +
           `Summary categories: ${summaries.length}\n` +
           `High priority areas: ${highPriorityCount}\n` +
           `Average confidence: ${Math.round(avgConfidence)}%\n\n` +
           `The knowledge base contains ${totalFacts} active memory entries across ${summaries.length} categories. ` +
           `${highPriorityCount > 0 ? `${highPriorityCount} areas require attention, ` : 'All areas are well-maintained, '}` +
           `with an overall confidence rating of ${Math.round(avgConfidence)}%.`;
  }

  private generateInsights(memories: any[], summaries: MemorySummary[]): string[] {
    const insights: string[] = [];
    
    const avgConfidence = memories.reduce((sum, m) => sum + (m.confidence || 50), 0) / memories.length;
    const recentCount = memories.filter(m => {
      const created = new Date(m.createdAt);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return created > weekAgo;
    }).length;
    
    if (avgConfidence > 85) {
      insights.push('Knowledge base has high overall confidence - well-established information');
    } else if (avgConfidence < 65) {
      insights.push('Knowledge base needs attention - many low-confidence entries');
    }
    
    if (recentCount > memories.length * 0.2) {
      insights.push('High recent activity - knowledge base is actively growing');
    } else if (recentCount < memories.length * 0.05) {
      insights.push('Low recent activity - knowledge base may need fresh content');
    }
    
    const typeDistribution = summaries.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + s.factCount;
      return acc;
    }, {} as Record<string, number>);
    
    const dominantType = Object.entries(typeDistribution).sort(([,a], [,b]) => b - a)[0];
    if (dominantType && dominantType[1] > memories.length * 0.4) {
      insights.push(`Knowledge heavily focused on ${dominantType[0]} - consider diversifying content types`);
    }
    
    return insights;
  }

  private generateRecommendations(memories: any[], summaries: MemorySummary[]): string[] {
    const recommendations: string[] = [];
    
    const lowConfidenceCount = memories.filter(m => (m.confidence || 50) < 60).length;
    const highPriorityCount = summaries.filter(s => s.priority === 'HIGH').length;
    
    if (lowConfidenceCount > memories.length * 0.3) {
      recommendations.push('Review and verify low-confidence entries to improve knowledge quality');
    }
    
    if (highPriorityCount > summaries.length * 0.4) {
      recommendations.push('Address high-priority categories to optimize knowledge organization');
    }
    
    const avgFactsPerSummary = memories.length / summaries.length;
    if (avgFactsPerSummary > 50) {
      recommendations.push('Consider creating more granular categories to improve information organization');
    }
    
    if (summaries.length < 3) {
      recommendations.push('Diversify content types (FACT, PREFERENCE, LORE) for richer knowledge representation');
    }
    
    recommendations.push('Enable Trust AI mode for automated optimization of low-stakes memory management decisions');
    
    return recommendations;
  }

  /**
   * COMPREHENSIVE INTELLIGENCE ANALYSIS
   * Runs all intelligence layers and provides a summary
   */
  async runFullIntelligenceAnalysis(
    db: PostgresJsDatabase<any>,
    profileId: string
  ): Promise<IntelligenceSummary> {
    console.log(`🧠 Running full intelligence analysis for profile ${profileId}`);

    // Run analyses individually with error handling to ensure partial success
    const clusterAnalysis = await this.analyzeFactClusters(db, profileId).catch(error => {
      console.error('❌ Fact clustering analysis failed:', error);
      return [];
    });
    
    const sourceReliability = await this.analyzeSourceReliability(db, profileId).catch(error => {
      console.error('❌ Source reliability analysis failed:', error);
      return [];
    });
    
    const personalityDrift = await this.analyzePersonalityDrift(db, profileId).catch(error => {
      console.error('❌ Personality drift analysis failed:', error);
      return [];
    });
    
    const relevanceScores = await this.analyzeContextRelevance(db, profileId).catch(error => {
      console.error('❌ Context relevance analysis failed:', error);
      return [];
    });

    // Calculate action counts with null safety
    const actionRequired = (clusterAnalysis || []).filter(c => c.priority === 'HIGH').length +
                           (personalityDrift || []).filter(d => d.severity === 'MAJOR').length +
                           (sourceReliability || []).filter(s => s.recommendation === 'DISTRUST').length;

    const autoHandled = (relevanceScores || []).filter(r => r.shouldHide).length +
                        (sourceReliability || []).filter(s => s.recommendation === 'TRUST').length;

    // Generate priority actions with null safety
    const priorityActions: string[] = [];
    
    if ((clusterAnalysis || []).length > 0) {
      priorityActions.push(`${clusterAnalysis.length} fact clusters need consolidation`);
    }
    
    if ((personalityDrift || []).length > 0) {
      priorityActions.push(`${personalityDrift.length} personality drifts detected`);
    }
    
    const distrustSources = (sourceReliability || []).filter(s => s.recommendation === 'DISTRUST');
    if (distrustSources.length > 0) {
      priorityActions.push(`${distrustSources.length} unreliable sources need review`);
    }

    console.log(`✅ Intelligence analysis complete: ${actionRequired} actions needed, ${autoHandled} auto-handled`);

    return {
      clusterAnalysis: clusterAnalysis || [],
      sourceReliability: sourceReliability || [],
      personalityDrift: personalityDrift || [],
      relevanceScores: relevanceScores || [],
      actionRequired,
      autoHandled,
      priorityActions
    };
  }

  /**
   * 🔧 ORPHAN FACTS REPAIR SYSTEM
   * Identifies and repairs facts that have been cut off from their original stories
   */
  async repairOrphanedFacts(profileId: string): Promise<{
    orphanedCount: number;
    repairedCount: number;
    storiesReconstructed: number;
    details: Array<{
      storyId: string;
      title: string;
      childFacts: number;
      context: string;
    }>;
  }> {
    console.log('🔍 Starting orphaned facts repair...');
    
    try {
      // Step 1: Identify orphaned facts
      const orphanedFacts = await this.identifyOrphanedFacts(profileId);
      console.log(`📊 Found ${orphanedFacts.length} orphaned facts`);
      
      if (orphanedFacts.length === 0) {
        return {
          orphanedCount: 0,
          repairedCount: 0,
          storiesReconstructed: 0,
          details: []
        };
      }

      // Step 2: Group facts by semantic similarity (reconstruct stories)
      const factGroups = await this.groupFactsIntoStories(orphanedFacts);
      console.log(`📚 Reconstructed ${factGroups.length} story groups`);

      // Step 3: Create parent stories and link atomic facts
      const repairedDetails = [];
      let repairedCount = 0;

      for (const group of factGroups) {
        try {
          const result = await this.createStoryFromFactGroup(profileId, group);
          if (result) {
            repairedDetails.push(result);
            repairedCount += group.length;
          }
        } catch (error) {
          console.error(`❌ Failed to repair fact group:`, error);
        }
      }

      console.log(`✅ Orphan facts repair complete: ${repairedCount}/${orphanedFacts.length} facts repaired`);
      
      return {
        orphanedCount: orphanedFacts.length,
        repairedCount,
        storiesReconstructed: factGroups.length,
        details: repairedDetails
      };
      
    } catch (error) {
      console.error('❌ Orphan facts repair failed:', error);
      throw error;
    }
  }

  /**
   * Identify facts that are missing story context or parent relationships
   */
  private async identifyOrphanedFacts(profileId: string): Promise<any[]> {
    const allMemories = await this.storage.getMemoryEntries(profileId, 1000);
    
    const orphaned = allMemories.filter((memory: any) => {
      return (
        // Missing story context
        (!memory.storyContext || memory.storyContext.trim().length === 0) &&
        // No parent fact ID
        !memory.parentFactId &&
        // Either not marked as atomic fact when it should be, or has missing context
        (!memory.isAtomicFact || memory.storyContext === null) &&
        // Has substantial content (not just a short phrase)
        memory.content.length > 30 &&
        // Is a factual type
        ['FACT', 'ATOMIC', 'LORE', 'STORY'].includes(memory.type)
      );
    });

    return orphaned;
  }

  /**
   * Group orphaned facts by semantic similarity to reconstruct original stories
   */
  private async groupFactsIntoStories(orphanedFacts: any[]): Promise<any[][]> {
    const groups: any[][] = [];
    const processed = new Set<string>();

    for (const fact of orphanedFacts) {
      if (processed.has(fact.id)) continue;

      const group = [fact];
      processed.add(fact.id);

      // Find semantically related facts
      for (const otherFact of orphanedFacts) {
        if (processed.has(otherFact.id)) continue;

        const similarity = this.calculateSemanticSimilarity(fact, otherFact);
        if (similarity > 0.6) { // Moderate similarity threshold
          group.push(otherFact);
          processed.add(otherFact.id);
        }
      }

      // Only create groups with multiple facts (stories)
      if (group.length >= 2) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Calculate semantic similarity between two facts
   */
  private calculateSemanticSimilarity(fact1: any, fact2: any): number {
    // Simple keyword-based similarity for now
    const keywords1 = new Set([
      ...(fact1.keywords || []),
      ...fact1.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
    ]);
    
    const keywords2 = new Set([
      ...(fact2.keywords || []),
      ...fact2.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
    ]);

    const intersection = new Set(Array.from(keywords1).filter(x => keywords2.has(x)));
    const union = new Set([...Array.from(keywords1), ...Array.from(keywords2)]);

    return intersection.size / union.size;
  }

  /**
   * Create a parent story from a group of related facts
   */
  private async createStoryFromFactGroup(profileId: string, factGroup: any[]): Promise<{
    storyId: string;
    title: string;
    childFacts: number;
    context: string;
  } | null> {
    try {
      // Generate story context from the fact group
      const combinedContent = factGroup.map((f: any) => f.content).join(' ');
      const storyContext = this.generateStoryContext(factGroup);
      const storyTitle = this.generateStoryTitle(factGroup);

      // Create parent story
      const parentStory = await this.storage.addMemoryEntry({
        profileId,
        type: 'STORY',
        content: combinedContent,
        importance: Math.max(...factGroup.map((f: any) => f.importance || 5)),
        keywords: this.extractCombinedKeywords(factGroup),
        source: factGroup[0].source || 'orphan_repair',
        sourceId: factGroup[0].sourceId,
        isAtomicFact: false, // This is a parent story
        storyContext: storyContext
      });

      if (!parentStory?.id) {
        console.warn('⚠️ Failed to create parent story');
        return null;
      }

      // Update all child facts to link to parent story
      for (const fact of factGroup) {
        await this.storage.updateMemoryEntry(fact.id, {
          parentFactId: parentStory.id,
          isAtomicFact: true,
          storyContext: storyContext
        });
      }

      console.log(`📚 Created story "${storyTitle}" with ${factGroup.length} child facts`);

      return {
        storyId: parentStory.id,
        title: storyTitle,
        childFacts: factGroup.length,
        context: storyContext
      };

    } catch (error) {
      console.error('❌ Failed to create story from fact group:', error);
      return null;
    }
  }

  /**
   * Generate narrative context for a group of facts
   */
  private generateStoryContext(factGroup: any[]): string {
    const themes = this.identifyCommonThemes(factGroup);
    const locations = this.extractLocations(factGroup);
    const characters = this.extractCharacters(factGroup);

    let context = `Story involving ${characters.join(', ')}`;
    if (locations.length > 0) {
      context += ` in ${locations.join(', ')}`;
    }
    if (themes.length > 0) {
      context += ` related to ${themes.join(', ')}`;
    }

    return context;
  }

  /**
   * Generate a descriptive title for a story group
   */
  private generateStoryTitle(factGroup: any[]): string {
    const commonWords = this.findMostCommonWords(factGroup);
    const themes = this.identifyCommonThemes(factGroup);
    
    if (themes.length > 0) {
      return `${themes[0]} story`;
    }
    
    if (commonWords.length > 0) {
      return `${commonWords[0]} narrative`;
    }

    return `Reconstructed story (${factGroup.length} facts)`;
  }

  /**
   * Extract combined keywords from fact group
   */
  private extractCombinedKeywords(factGroup: any[]): string[] {
    const allKeywords = new Set<string>();
    
    for (const fact of factGroup) {
      if (fact.keywords) {
        fact.keywords.forEach((keyword: string) => allKeywords.add(keyword));
      }
    }

    return Array.from(allKeywords).slice(0, 10); // Limit to 10 keywords
  }

  /**
   * Identify common themes in fact group
   */
  private identifyCommonThemes(factGroup: any[]): string[] {
    const themes = new Set<string>();
    
    const combinedText = factGroup.map((f: any) => f.content).join(' ').toLowerCase();
    
    const themePatterns = [
      { pattern: /dead by daylight|dbd|killer|survivor/, theme: 'Dead by Daylight' },
      { pattern: /pasta|marinara|italian|cooking/, theme: 'cooking' },
      { pattern: /family|relatives|cousin|uncle/, theme: 'family' },
      { pattern: /mafia|crime|business|territory/, theme: 'mafia business' },
      { pattern: /earl|rivalry|competition/, theme: 'rivalry' },
      { pattern: /podcast|streaming|show/, theme: 'podcast' }
    ];

    for (const { pattern, theme } of themePatterns) {
      if (pattern.test(combinedText)) {
        themes.add(theme);
      }
    }

    return Array.from(themes);
  }

  /**
   * Extract locations mentioned in fact group
   */
  private extractLocations(factGroup: any[]): string[] {
    const locations = new Set<string>();
    const combinedText = factGroup.map((f: any) => f.content).join(' ');
    
    const locationMatches = combinedText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const knownLocations = ['Nagoya', 'Berlin', 'Tokyo', 'Atlantic City', 'Newark', 'Tulsa', 'Chattanooga'];
    
    for (const match of locationMatches) {
      if (knownLocations.some(loc => match.includes(loc))) {
        locations.add(match);
      }
    }

    return Array.from(locations);
  }

  /**
   * Extract character names from fact group
   */
  private extractCharacters(factGroup: any[]): string[] {
    const characters = new Set<string>();
    const combinedText = factGroup.map((f: any) => f.content).join(' ').toLowerCase();
    
    const characterPatterns = ['nicky', 'dente', 'earl', 'toxic', 'sal', 'sabam'];
    
    for (const character of characterPatterns) {
      if (combinedText.includes(character)) {
        characters.add(character);
      }
    }

    return Array.from(characters);
  }

  /**
   * Find most common significant words in fact group
   */
  private findMostCommonWords(factGroup: any[]): string[] {
    const wordCounts = new Map<string, number>();
    const combinedText = factGroup.map((f: any) => f.content).join(' ').toLowerCase();
    
    const words = combinedText.split(/\s+/).filter((word: string) => 
      word.length > 4 && 
      !/^(the|and|that|this|with|from|they|have|were|been|their)$/.test(word)
    );

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);
  }
}

export const intelligenceEngine = new IntelligenceEngine();