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

  constructor() {
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
        model: 'claude-3-5-sonnet-20241022',
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
        model: 'claude-3-5-sonnet-20241022',
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
   * COMPREHENSIVE INTELLIGENCE ANALYSIS
   * Runs all intelligence layers and provides a summary
   */
  async runFullIntelligenceAnalysis(
    db: PostgresJsDatabase<any>,
    profileId: string
  ): Promise<IntelligenceSummary> {
    console.log(`🧠 Running full intelligence analysis for profile ${profileId}`);

    const [clusterAnalysis, sourceReliability, personalityDrift, relevanceScores] = await Promise.all([
      this.analyzeFactClusters(db, profileId),
      this.analyzeSourceReliability(db, profileId),
      this.analyzePersonalityDrift(db, profileId),
      this.analyzeContextRelevance(db, profileId)
    ]);

    // Calculate action counts
    const actionRequired = clusterAnalysis.filter(c => c.priority === 'HIGH').length +
                           personalityDrift.filter(d => d.severity === 'MAJOR').length +
                           sourceReliability.filter(s => s.recommendation === 'DISTRUST').length;

    const autoHandled = relevanceScores.filter(r => r.shouldHide).length +
                        sourceReliability.filter(s => s.recommendation === 'TRUST').length;

    // Generate priority actions
    const priorityActions: string[] = [];
    
    if (clusterAnalysis.length > 0) {
      priorityActions.push(`${clusterAnalysis.length} fact clusters need consolidation`);
    }
    
    if (personalityDrift.length > 0) {
      priorityActions.push(`${personalityDrift.length} personality drifts detected`);
    }
    
    if (sourceReliability.filter(s => s.recommendation === 'DISTRUST').length > 0) {
      priorityActions.push(`${sourceReliability.filter(s => s.recommendation === 'DISTRUST').length} unreliable sources need review`);
    }

    console.log(`✅ Intelligence analysis complete: ${actionRequired} actions needed, ${autoHandled} auto-handled`);

    return {
      clusterAnalysis,
      sourceReliability,
      personalityDrift,
      relevanceScores,
      actionRequired,
      autoHandled,
      priorityActions
    };
  }
}

export const intelligenceEngine = new IntelligenceEngine();