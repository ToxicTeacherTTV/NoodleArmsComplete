import type { MemoryEntry } from '@shared/schema';
import { geminiService } from './gemini.js';
import { storage } from '../storage.js';

// Content analysis types
interface ContentSignals {
  rareTokens: string[];
  namedEntities: string[];
  numericMarkers: string[];
  timeMarkers: string[];
  tfIdfVector: Map<string, number>;
}

interface CandidateMatch {
  targetId: string;
  targetContent: string;
  score: number;
  signals: {
    rareTokenJaccard: number;
    namedEntityOverlap: number;
    numericOverlap: number;
    tfIdfSimilarity: number;
  };
}

interface StoryCluster {
  id: string;
  factIds: string[];
  facts: MemoryEntry[];
  coherenceScore: number;
  suggestedTitle: string;
  suggestedSynopsis: string;
  orderedEvents: { factId: string; order: number; description: string }[];
}

interface ReconstructionResult {
  attachments: { orphanId: string; targetId: string; score: number; relationship: string }[];
  newStories: StoryCluster[];
  processedOrphans: number;
  remainingOrphans: number;
}

export class StoryReconstructor {
  private storage: any;
  private gemini: any;

  constructor() {
    this.storage = storage;
    this.gemini = geminiService;
  }

  /**
   * Main entry point for story reconstruction
   */
  async reconstructStories(profileId: string): Promise<ReconstructionResult> {
    console.log('🔧 Starting comprehensive story reconstruction...');
    
    // Get all orphaned facts (low confidence, missing connections)
    const orphanedFacts = await this.getOrphanedFacts(profileId);
    console.log(`📊 Found ${orphanedFacts.length} orphaned facts to process`);

    if (orphanedFacts.length === 0) {
      return { attachments: [], newStories: [], processedOrphans: 0, remainingOrphans: 0 };
    }

    // Get all existing memories for comparison
    const allMemories = await this.storage.getMemoryEntries(profileId, 10000);
    const anchorMemories = allMemories.filter((m: MemoryEntry) => {
      // Include high-confidence facts (≥60%) or any STORY type (even low confidence)
      const isHighConfidence = (m.confidence || 50) >= 60;
      const isStory = m.type === 'STORY';
      return (isHighConfidence || isStory) && m.id;
    });
    console.log(`📚 Analyzing against ${anchorMemories.length} anchor memories`);

    // Pass A: Connect orphans to existing high-confidence memories/stories
    const attachments = await this.findAttachmentCandidates(orphanedFacts, anchorMemories);
    console.log(`🔗 Found ${attachments.length} potential attachments to existing memories`);

    // Get remaining orphans after potential attachments
    const attachedOrphanIds = new Set(attachments.map(a => a.orphanId));
    const remainingOrphans = orphanedFacts.filter(f => !attachedOrphanIds.has(f.id));
    console.log(`🔍 ${remainingOrphans.length} orphans remain for clustering`);

    // Pass B: Cluster remaining orphans into new stories
    const newStories = await this.clusterOrphansIntoStories(remainingOrphans);
    console.log(`📚 Created ${newStories.length} new story clusters`);

    return {
      attachments,
      newStories,
      processedOrphans: attachments.length + newStories.reduce((sum, story) => sum + story.factIds.length, 0),
      remainingOrphans: orphanedFacts.length - attachments.length - newStories.reduce((sum, story) => sum + story.factIds.length, 0)
    };
  }

  /**
   * Get orphaned facts - low confidence facts with minimal connections
   */
  private async getOrphanedFacts(profileId: string): Promise<MemoryEntry[]> {
    const allMemories = await this.storage.getMemoryEntries(profileId, 10000);
    
    return allMemories.filter((memory: MemoryEntry) => {
      // Low confidence facts
      const isLowConfidence = (memory.confidence || 50) < 60;
      
      // Minimal relationships
      const hasMinimalConnections = !memory.relationships || memory.relationships.length <= 1;
      
      // Not part of a story already
      const notInStory = memory.type !== 'STORY' && !memory.parentFactId;
      
      // Not protected
      const notProtected = !memory.isProtected;
      
      return isLowConfidence && hasMinimalConnections && notInStory && notProtected;
    });
  }

  /**
   * Pass A: Find potential attachments to existing high-confidence memories
   */
  private async findAttachmentCandidates(
    orphans: MemoryEntry[], 
    anchors: MemoryEntry[]
  ): Promise<{ orphanId: string; targetId: string; score: number; relationship: string }[]> {
    const attachments: { orphanId: string; targetId: string; score: number; relationship: string }[] = [];
    
    console.log('🎯 Pass A: Finding attachments to existing memories...');
    
    for (const orphan of orphans) {
      const orphanSignals = this.extractContentSignals(orphan.content);
      const candidates: CandidateMatch[] = [];
      
      // Find potential matches using candidate generation
      for (const anchor of anchors) {
        const anchorSignals = this.extractContentSignals(anchor.content);
        const score = this.calculateSimilarityScore(orphanSignals, anchorSignals);
        
        if (score >= 0.4) { // Minimum threshold for consideration
          candidates.push({
            targetId: anchor.id,
            targetContent: anchor.content,
            score,
            signals: {
              rareTokenJaccard: this.calculateJaccard(orphanSignals.rareTokens, anchorSignals.rareTokens),
              namedEntityOverlap: this.calculateJaccard(orphanSignals.namedEntities, anchorSignals.namedEntities),
              numericOverlap: this.calculateJaccard(orphanSignals.numericMarkers, anchorSignals.numericMarkers),
              tfIdfSimilarity: this.calculateTfIdfSimilarity(orphanSignals.tfIdfVector, anchorSignals.tfIdfVector)
            }
          });
        }
      }
      
      // Take the best candidate if it meets the attachment threshold
      candidates.sort((a, b) => b.score - a.score);
      if (candidates.length > 0 && candidates[0].score >= 0.7) { // Stricter threshold for attachment
        attachments.push({
          orphanId: orphan.id,
          targetId: candidates[0].targetId,
          score: candidates[0].score,
          relationship: `belongsTo:${candidates[0].targetId}`
        });
      }
    }
    
    return attachments;
  }

  /**
   * Pass B: Cluster remaining orphans into new story containers
   */
  private async clusterOrphansIntoStories(orphans: MemoryEntry[]): Promise<StoryCluster[]> {
    if (orphans.length === 0) return [];
    
    console.log('🧩 Pass B: Clustering orphans into new stories...');
    
    // Build similarity graph
    const similarityGraph = this.buildSimilarityGraph(orphans);
    
    // Find connected components (clusters)
    const clusters = this.findConnectedComponents(similarityGraph, orphans);
    
    // Generate story outlines for each cluster
    const stories: StoryCluster[] = [];
    for (const cluster of clusters) {
      if (cluster.facts.length >= 2) { // Only create stories for multi-fact clusters
        // Temporarily disable AI outline generation to avoid hanging
        // const storyOutline = await this.generateStoryOutline(cluster.facts);
        const storyOutline = {
          title: `Story Cluster ${stories.length + 1}`,
          synopsis: `A story reconstructed from ${cluster.facts.length} related facts.`,
          events: cluster.facts.map((fact, index) => ({
            factId: fact.id,
            order: index + 1,
            description: `Event ${index + 1} in the story`
          }))
        };
        stories.push({
          id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          factIds: cluster.factIds,
          facts: cluster.facts,
          coherenceScore: cluster.coherenceScore,
          suggestedTitle: storyOutline.title,
          suggestedSynopsis: storyOutline.synopsis,
          orderedEvents: storyOutline.events
        });
      }
    }
    
    return stories;
  }

  /**
   * Extract content signals for similarity analysis
   */
  private extractContentSignals(content: string): ContentSignals {
    const text = content.toLowerCase();
    const words = text.split(/\s+/).filter(word => word.length > 2);
    
    // Rare tokens (non-common words)
    const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'has', 'had', 'have', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'this', 'that', 'these', 'those', 'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'them', 'us']);
    const rareTokens = words.filter(word => !commonWords.has(word) && word.length > 3);
    
    // Named entities (capitalized words/phrases)
    const namedEntities = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    
    // Numeric markers (numbers, dates, amounts)
    const numericMarkers = content.match(/\b\d+(?:[.,]\d+)*\b/g) || [];
    
    // Time markers (years, dates, temporal expressions)
    const timeMarkers = content.match(/\b(?:19|20)\d{2}\b|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|'(?:0[0-9]|[1-9][0-9])\b/g) || [];
    
    // Simple TF-IDF vector (word frequencies)
    const tfIdfVector = new Map<string, number>();
    rareTokens.forEach(token => {
      tfIdfVector.set(token, (tfIdfVector.get(token) || 0) + 1);
    });
    
    return {
      rareTokens: Array.from(new Set(rareTokens)),
      namedEntities: Array.from(new Set(namedEntities)),
      numericMarkers: Array.from(new Set(numericMarkers)),
      timeMarkers: Array.from(new Set(timeMarkers)),
      tfIdfVector
    };
  }

  /**
   * Calculate overall similarity score between two content signals
   */
  private calculateSimilarityScore(signals1: ContentSignals, signals2: ContentSignals): number {
    const weights = {
      rareToken: 0.4,
      namedEntity: 0.3,
      numeric: 0.15,
      tfIdf: 0.15
    };
    
    const rareTokenScore = this.calculateJaccard(signals1.rareTokens, signals2.rareTokens);
    const namedEntityScore = this.calculateJaccard(signals1.namedEntities, signals2.namedEntities);
    const numericScore = this.calculateJaccard(signals1.numericMarkers, signals2.numericMarkers);
    const tfIdfScore = this.calculateTfIdfSimilarity(signals1.tfIdfVector, signals2.tfIdfVector);
    
    return (
      weights.rareToken * rareTokenScore +
      weights.namedEntity * namedEntityScore +
      weights.numeric * numericScore +
      weights.tfIdf * tfIdfScore
    );
  }

  /**
   * Calculate Jaccard similarity between two sets
   */
  private calculateJaccard(set1: string[], set2: string[]): number {
    if (set1.length === 0 && set2.length === 0) return 0;
    
    const s1 = new Set(set1.map(s => s.toLowerCase()));
    const s2 = new Set(set2.map(s => s.toLowerCase()));
    
    const s1Array = Array.from(s1);
    const s2Array = Array.from(s2);
    const intersection = new Set(s1Array.filter(x => s2.has(x)));
    const union = new Set([...s1Array, ...s2Array]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Calculate TF-IDF cosine similarity
   */
  private calculateTfIdfSimilarity(vector1: Map<string, number>, vector2: Map<string, number>): number {
    if (vector1.size === 0 || vector2.size === 0) return 0;
    
    const allTerms = new Set([...Array.from(vector1.keys()), ...Array.from(vector2.keys())]);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (const term of Array.from(allTerms)) {
      const freq1 = vector1.get(term) || 0;
      const freq2 = vector2.get(term) || 0;
      
      dotProduct += freq1 * freq2;
      norm1 += freq1 * freq1;
      norm2 += freq2 * freq2;
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Build similarity graph for clustering
   */
  private buildSimilarityGraph(orphans: MemoryEntry[]): Map<string, { targetId: string; score: number }[]> {
    const graph = new Map<string, { targetId: string; score: number }[]>();
    
    console.log(`🔬 Pre-computing signals for ${orphans.length} orphans...`);
    // Pre-compute all signals to avoid repeated extraction (O(n) instead of O(n²))
    const signalCache = new Map<string, ContentSignals>();
    for (const orphan of orphans) {
      signalCache.set(orphan.id, this.extractContentSignals(orphan.content));
    }
    
    console.log('🕸️ Building similarity graph...');
    let comparisons = 0;
    for (let i = 0; i < orphans.length; i++) {
      const orphan1 = orphans[i];
      const signals1 = signalCache.get(orphan1.id)!;
      const connections: { targetId: string; score: number }[] = [];
      
      for (let j = i + 1; j < orphans.length; j++) {
        const orphan2 = orphans[j];
        const signals2 = signalCache.get(orphan2.id)!;
        const score = this.calculateSimilarityScore(signals1, signals2);
        comparisons++;
        
        if (score >= 0.3) { // Lower threshold for orphan-to-orphan clustering
          connections.push({ targetId: orphan2.id, score });
          
          // Add reverse connection
          if (!graph.has(orphan2.id)) {
            graph.set(orphan2.id, []);
          }
          graph.get(orphan2.id)!.push({ targetId: orphan1.id, score });
        }
      }
      
      graph.set(orphan1.id, connections);
    }
    
    console.log(`✅ Completed ${comparisons} comparisons, found connections for ${graph.size} nodes`);
    return graph;
  }

  /**
   * Find connected components in the similarity graph
   */
  private findConnectedComponents(
    graph: Map<string, { targetId: string; score: number }[]>,
    orphans: MemoryEntry[]
  ): { factIds: string[]; facts: MemoryEntry[]; coherenceScore: number }[] {
    const visited = new Set<string>();
    const clusters: { factIds: string[]; facts: MemoryEntry[]; coherenceScore: number }[] = [];
    const orphanMap = new Map(orphans.map(o => [o.id, o]));
    
    for (const orphan of orphans) {
      if (visited.has(orphan.id)) continue;
      
      // DFS to find connected component
      const cluster: string[] = [];
      const stack = [orphan.id];
      
      while (stack.length > 0) {
        const nodeId = stack.pop()!;
        if (visited.has(nodeId)) continue;
        
        visited.add(nodeId);
        cluster.push(nodeId);
        
        const connections = graph.get(nodeId) || [];
        for (const connection of connections) {
          if (!visited.has(connection.targetId)) {
            stack.push(connection.targetId);
          }
        }
      }
      
      if (cluster.length > 1) {
        // Calculate coherence score
        const edges = cluster.flatMap(id => graph.get(id) || []).filter(conn => cluster.includes(conn.targetId));
        const coherenceScore = edges.length > 0 ? edges.reduce((sum, edge) => sum + edge.score, 0) / edges.length : 0;
        
        clusters.push({
          factIds: cluster,
          facts: cluster.map(id => orphanMap.get(id)!).filter(Boolean),
          coherenceScore
        });
      }
    }
    
    return clusters.sort((a, b) => b.coherenceScore - a.coherenceScore);
  }

  /**
   * Generate story outline using AI
   */
  private async generateStoryOutline(facts: MemoryEntry[]): Promise<{
    title: string;
    synopsis: string;
    events: { factId: string; order: number; description: string }[];
  }> {
    const prompt = `Analyze these disconnected facts and create a coherent story outline:

FACTS:
${facts.map((fact, i) => `${i + 1}. [${fact.id}] ${fact.content}`).join('\n')}

Create a JSON response with:
{
  "title": "Brief descriptive title (max 50 chars)",
  "synopsis": "2-3 sentence summary of the story (max 300 chars)",
  "events": [
    {
      "factId": "fact_id_here",
      "order": 1,
      "description": "Brief context for this event in the story"
    }
  ]
}

Order the events chronologically and provide context for how they connect. Keep it concise.`;

    try {
      const response = await this.gemini.generateResponse(
        prompt,
        "You are a helpful AI assistant that analyzes facts and creates story outlines.",
        [], // relevantMemories
        [], // relevantDocs
        "", // loreContext
        undefined // mode
      );
      
      // Try to extract JSON from the response content
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and sanitize
        return {
          title: (parsed.title || 'Untitled Story').substring(0, 50),
          synopsis: (parsed.synopsis || 'Story synopsis unavailable').substring(0, 300),
          events: (parsed.events || []).map((event: any, index: number) => ({
            factId: event.factId || facts[index]?.id || '',
            order: event.order || index + 1,
            description: (event.description || 'Event description').substring(0, 200)
          }))
        };
      }
    } catch (error) {
      console.error('❌ Failed to generate story outline:', error);
    }
    
    // Fallback
    return {
      title: 'Reconstructed Story',
      synopsis: `Story containing ${facts.length} related facts.`,
      events: facts.map((fact, index) => ({
        factId: fact.id,
        order: index + 1,
        description: `Event ${index + 1} in the story`
      }))
    };
  }
}

export const storyReconstructor = new StoryReconstructor();