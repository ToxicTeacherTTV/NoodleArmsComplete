import { geminiService } from './gemini';
import { storage } from '../storage';
import { MemoryEntry } from '@shared/schema';
import { randomUUID } from 'crypto';

// 🔒 Job state management to prevent infinite loops
interface ScanJob {
  status: 'idle' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  result?: ContradictionResult[];
  error?: string;
}

const profileScanJobs = new Map<string, ScanJob>();
const SCAN_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max

export interface ContradictionResult {
  isContradiction: boolean;
  conflictingFacts: MemoryEntry[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  explanation: string;
}

export interface ContradictionGroup {
  groupId: string;
  facts: MemoryEntry[];
  primaryFact: MemoryEntry;
  conflictingFacts: MemoryEntry[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  explanation: string;
}

interface StructuredFact {
  id: string;
  subject: string;
  predicate: string;
  polarity: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  value: string;
  confidence: number;
  originalFact: MemoryEntry;
}

class SmartContradictionDetector {
  
  /**
   * 🔒 Check if a scan is already running or get cached results
   */
  checkScanStatus(profileId: string): { canRun: boolean; status: ScanJob['status']; result?: any } {
    const job = profileScanJobs.get(profileId);
    
    if (!job) {
      return { canRun: true, status: 'idle' };
    }
    
    // Check for timeout
    if (job.status === 'running' && job.startedAt) {
      const elapsed = Date.now() - job.startedAt.getTime();
      if (elapsed > SCAN_TIMEOUT_MS) {
        console.log(`⏰ Scan timeout for profile ${profileId}, resetting`);
        job.status = 'failed';
        job.error = 'Timeout';
      }
    }
    
    return {
      canRun: job.status === 'idle' || job.status === 'failed',
      status: job.status,
      result: job.result
    };
  }
  
  /**
   * 🔒 Start a new scan job
   */
  startScanJob(profileId: string): void {
    profileScanJobs.set(profileId, {
      status: 'running',
      startedAt: new Date()
    });
    console.log(`🔒 Started contradiction scan for profile ${profileId}`);
  }
  
  /**
   * 🔒 Complete a scan job
   */
  completeScanJob(profileId: string, result: ContradictionResult[], error?: string): void {
    const job = profileScanJobs.get(profileId);
    if (job) {
      job.status = error ? 'failed' : 'completed';
      job.completedAt = new Date();
      job.result = result;
      job.error = error;
    }
    console.log(`✅ Completed contradiction scan for profile ${profileId}: ${error ? 'FAILED' : 'SUCCESS'}`);
  }
  
  /**
   * 🚀 SMART APPROACH: Only check facts that could actually contradict
   * Instead of N x N comparisons, we:
   * 1. Extract structure from new fact
   * 2. Find candidate facts (same subject+predicate)  
   * 3. Apply fast rule-based checks
   * 4. Use AI only for ambiguous cases (max 5-10 calls)
   */
  async detectContradictions(profileId: string, newFact: MemoryEntry): Promise<ContradictionResult> {
    try {
      console.log(`🧠 Smart contradiction check for: "${newFact.content.substring(0, 50)}..."`);
      
      // Step 1: Extract structure from the new fact
      const structuredNewFact = await this.extractStructuredFact(newFact);
      if (!structuredNewFact) {
        return this.noContradiction('Unable to analyze fact structure');
      }

      console.log(`📊 Extracted: Subject="${structuredNewFact.subject}", Predicate="${structuredNewFact.predicate}", Polarity="${structuredNewFact.polarity}"`);

      // Step 2: Find relevant candidate facts (smart filtering!)
      const candidates = await this.findRelevantCandidates(profileId, structuredNewFact);
      
      console.log(`🎯 Found ${candidates.length} relevant candidates (vs ${1000}+ total facts)`);
      
      if (candidates.length === 0) {
        return this.noContradiction('No relevant facts to compare against');
      }

      // Step 3: Fast rule-based contradiction detection first
      const ruleBasedConflicts = this.detectRuleBasedContradictions(structuredNewFact, candidates);
      console.log(`⚡ Rule-based detection found ${ruleBasedConflicts.length} conflicts`);

      // Step 4: AI analysis only for remaining ambiguous cases (BUDGET LIMITED!)
      const aiCandidates = candidates.filter(c => !ruleBasedConflicts.some(r => r.id === c.id));
      const aiConflicts = await this.detectAIContradictions(structuredNewFact, aiCandidates.slice(0, 10)); // Max 10 AI calls!
      
      console.log(`🤖 AI analysis checked ${Math.min(aiCandidates.length, 10)} facts, found ${aiConflicts.length} conflicts`);

      // Combine results
      const allConflicts = [...ruleBasedConflicts, ...aiConflicts];
      
      if (allConflicts.length > 0) {
        const severity = this.assessContradictionSeverity(newFact, allConflicts);
        console.log(`🚨 Total conflicts: ${allConflicts.length}, Severity: ${severity}`);
        
        return {
          isContradiction: true,
          conflictingFacts: allConflicts,
          severity,
          explanation: `Found ${allConflicts.length} conflicting facts using smart analysis`
        };
      }

      return this.noContradiction('No contradictions detected');

    } catch (error) {
      console.error('❌ Smart contradiction detection error:', error);
      return this.noContradiction('Error during smart contradiction detection');
    }
  }

  /**
   * Extract granular structured information from a fact
   * 🚀 GRANULAR APPROACH: Creates specific topic clusters instead of broad categories
   */
  private async extractStructuredFact(fact: MemoryEntry): Promise<StructuredFact | null> {
    const content = fact.content.toLowerCase();
    
    // Extract primary subject
    let subject = 'unknown';
    if (content.includes('nicky')) subject = 'nicky';
    else if (content.includes('earl grey') || content.includes('earl')) subject = 'earl_grey';
    else if (content.includes('stream') || content.includes('podcast')) subject = 'stream';
    else if (content.includes('bhvr') || content.includes('behavior')) subject = 'bhvr';
    else if (content.includes('sabam')) subject = 'sabam';
    
    // 🎯 GRANULAR PREDICATE EXTRACTION: Specific topics instead of broad categories
    let predicate = this.extractGranularTopic(content);
    
    // Extract polarity with more nuanced detection
    let polarity: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = this.extractPolarity(content);
    
    // Create topic-specific value for better matching
    const value = this.extractTopicValue(content, predicate);

    console.log(`🔍 Granular extraction: "${subject}.${predicate}.${polarity}" for "${fact.content.substring(0, 40)}..."`);

    return {
      id: fact.id,
      subject,
      predicate,
      polarity,
      value,
      confidence: fact.confidence || 50,
      originalFact: fact
    };
  }

  /**
   * 🎯 GRANULAR TOPIC EXTRACTION: Break broad categories into specific clusters
   * This reduces 800-fact buckets into 20-50 fact clusters!
   */
  private extractGranularTopic(content: string): string {
    // Earl Grey Rivalry Cluster (~30-50 facts)
    if (content.includes('earl grey') || content.includes('rivalry') || content.includes('feud') || 
        content.includes('tea') || content.includes('lasagna') || content.includes('yogurt shop') ||
        content.includes('food fight') || content.includes('cafeteria clash') || content.includes('pasta war')) {
      return 'earl_grey_rivalry';
    }
    
    // BHVR Conspiracy Cluster (~25-40 facts) 
    if (content.includes('bhvr') || content.includes('anti-italian') || content.includes('bias') || 
        content.includes('rigged') || content.includes('matchmaking') || content.includes('ignored') ||
        content.includes('conspiracy') || content.includes('government') || content.includes('tech')) {
      return 'bhvr_conspiracy';
    }
    
    // Gameplay Tactics Cluster (~40-60 facts)
    if (content.includes('camping') || content.includes('tunneling') || content.includes('main') || 
        content.includes('killer') || content.includes('tactics') || content.includes('mercy') ||
        content.includes('respect-based') || content.includes('establish territory') || content.includes('twins')) {
      return 'gameplay_tactics';
    }
    
    // Family Honor/Italian Culture Cluster (~20-30 facts)
    if (content.includes('honor') || content.includes('family') || content.includes('italian') || 
        content.includes('marinara') || content.includes('sauce') || content.includes('nonna') ||
        content.includes('tradition') || content.includes('culture') || content.includes('respect')) {
      return 'family_honor';
    }
    
    // Streaming/Podcast Cluster (~25-40 facts)
    if (content.includes('stream') || content.includes('podcast') || content.includes('catchphrase') || 
        content.includes('audience') || content.includes('segment') || content.includes('camping them softly') ||
        content.includes('banned in kozani') || content.includes('viewer') || content.includes('chat')) {
      return 'streaming_persona';
    }
    
    // Personal History/Backstory Cluster (~30-50 facts)
    if (content.includes('age') || content.includes('history') || content.includes('born') || 
        content.includes('childhood') || content.includes('school') || content.includes('noodle arms') ||
        content.includes('mission') || content.includes('caper') || content.includes('story')) {
      return 'personal_backstory';
    }
    
    // Gaming Skills/Performance Cluster (~20-30 facts)
    if (content.includes('skill') || content.includes('good at') || content.includes('bad at') || 
        content.includes('win') || content.includes('lose') || content.includes('rank') ||
        content.includes('performance') || content.includes('improvement') || content.includes('practice')) {
      return 'gaming_performance';
    }
    
    // SABAM Organization Cluster (~15-25 facts)  
    if (content.includes('sabam') || content.includes('organization') || content.includes('member') || 
        content.includes('mission') || content.includes('restore') || content.includes('society')) {
      return 'sabam_organization';
    }
    
    // Schedule/Time Cluster (~10-20 facts)
    if (content.includes('time') || content.includes('schedule') || content.includes('start') || 
        content.includes('pm') || content.includes('am') || content.includes('hour') || content.includes('minute')) {
      return 'schedule_timing';
    }
    
    // Physical Description Cluster (~15-25 facts)
    if (content.includes('appearance') || content.includes('looks') || content.includes('height') || 
        content.includes('weight') || content.includes('hair') || content.includes('eyes') || content.includes('build')) {
      return 'physical_appearance';
    }
    
    // Default to confidence-based general categories for remaining facts
    return 'general_other';
  }

  /**
   * Extract more nuanced polarity 
   */
  private extractPolarity(content: string): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
    const strongPositive = ['love', 'excellent', 'perfect', 'amazing', 'always', 'definitely', 'absolutely'];
    const strongNegative = ['hate', 'terrible', 'awful', 'never', 'refuse', 'against', 'conspiracy', 'rigged'];
    const weakPositive = ['like', 'prefer', 'good', 'yes', 'will', 'can'];
    const weakNegative = ['dislike', 'bad', 'not', 'cannot', 'won\'t', 'avoid'];
    
    if (strongNegative.some(word => content.includes(word))) return 'NEGATIVE';
    if (strongPositive.some(word => content.includes(word))) return 'POSITIVE';
    if (weakNegative.some(word => content.includes(word))) return 'NEGATIVE';
    if (weakPositive.some(word => content.includes(word))) return 'POSITIVE';
    
    return 'NEUTRAL';
  }

  /**
   * Extract topic-specific value for better semantic matching
   */
  private extractTopicValue(content: string, predicate: string): string {
    // For Earl Grey rivalry, extract the specific conflict aspect
    if (predicate === 'earl_grey_rivalry') {
      if (content.includes('food')) return 'food_conflict';
      if (content.includes('game') || content.includes('dbd')) return 'gaming_conflict';
      if (content.includes('stream')) return 'streaming_conflict';
      return 'general_rivalry';
    }
    
    // For BHVR conspiracy, extract the specific complaint
    if (predicate === 'bhvr_conspiracy') {
      if (content.includes('matchmaking')) return 'matchmaking_bias';
      if (content.includes('ignore') || content.includes('proposal')) return 'ignored_suggestions';
      if (content.includes('patch') || content.includes('nerf')) return 'patch_complaints';
      return 'general_conspiracy';
    }
    
    // For gameplay, extract the specific tactic
    if (predicate === 'gameplay_tactics') {
      if (content.includes('camping')) return 'camping_philosophy';
      if (content.includes('tunneling')) return 'tunneling_philosophy';
      if (content.includes('main')) return 'killer_preference';
      if (content.includes('mercy')) return 'mercy_beliefs';
      return 'general_gameplay';
    }
    
    // Default: use first 50 chars as representative value
    return content.substring(0, 50).trim();
  }

  /**
   * Find candidate facts that could actually contradict the new fact
   * 🎯 GRANULAR OPTIMIZATION: Use specific topic clusters + confidence filtering
   */
  private async findRelevantCandidates(profileId: string, structuredFact: StructuredFact): Promise<MemoryEntry[]> {
    const allFacts = await storage.getMemoryEntries(profileId, 1000);
    const activeFacts = allFacts.filter(fact => 
      fact.status === 'ACTIVE' && 
      fact.id !== structuredFact.id &&
      !fact.contradictionGroupId
    );

    const candidates: MemoryEntry[] = [];
    const newFactConfidence = structuredFact.confidence;

    console.log(`🎯 Filtering ${activeFacts.length} facts for topic "${structuredFact.predicate}"`);

    for (const fact of activeFacts) {
      const candidate = await this.extractStructuredFact(fact);
      if (!candidate) continue;

      // 🎯 GRANULAR MATCHING: Same subject AND same specific topic cluster
      const isExactTopicMatch = (
        candidate.subject === structuredFact.subject && 
        candidate.predicate === structuredFact.predicate
      );

      // 🎯 CONFIDENCE OPTIMIZATION: Only compare facts in similar confidence ranges
      const confidenceGap = Math.abs((candidate.confidence) - newFactConfidence);
      const isReasonableConfidenceRange = confidenceGap <= 30; // Don't compare 90% confidence vs 10% confidence

      if (isExactTopicMatch && isReasonableConfidenceRange) {
        candidates.push(fact);
        console.log(`✅ Topic match: ${candidate.predicate} (conf: ${candidate.confidence})`);
      }
      
      // 🎯 RELATED TOPIC MATCHING: Some topics can cross-contradict
      else if (this.areRelatedTopics(structuredFact.predicate, candidate.predicate)) {
        if (isReasonableConfidenceRange) {
          candidates.push(fact);
          console.log(`🔗 Related topics: ${structuredFact.predicate} <-> ${candidate.predicate}`);
        }
      }
      
      // 🎯 SEMANTIC FALLBACK: Only for high-confidence facts to avoid noise
      else if (newFactConfidence >= 70 && candidate.confidence >= 70) {
        if (this.hasOverlappingConcepts(structuredFact.value, candidate.value)) {
          candidates.push(fact);
          console.log(`💡 Semantic match: High-confidence facts with overlap`);
        }
      }
    }

    console.log(`🎯 Filtered to ${candidates.length} relevant candidates (from ${activeFacts.length} total)`);
    return candidates;
  }

  /**
   * 🔗 Check if two topics can cross-contradict each other
   * Some topics naturally relate and can have conflicting claims
   */
  private areRelatedTopics(topic1: string, topic2: string): boolean {
    const relatedGroups = [
      ['family_honor', 'gameplay_tactics', 'streaming_persona'], // Honor affects gameplay and streaming behavior
      ['bhvr_conspiracy', 'gaming_performance', 'gameplay_tactics'], // BHVR complaints relate to performance
      ['earl_grey_rivalry', 'streaming_persona', 'family_honor'], // Rivalry affects streaming and honor
      ['personal_backstory', 'family_honor', 'streaming_persona'], // History affects current persona
      ['gaming_performance', 'gameplay_tactics'], // Performance relates to tactics
    ];

    for (const group of relatedGroups) {
      if (group.includes(topic1) && group.includes(topic2)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Fast rule-based contradiction detection - no AI needed!
   */
  private detectRuleBasedContradictions(newFact: StructuredFact, candidates: MemoryEntry[]): MemoryEntry[] {
    const conflicts: MemoryEntry[] = [];

    for (const candidate of candidates) {
      const content1 = newFact.value.toLowerCase();
      const content2 = candidate.content.toLowerCase();

      // Rule 1: Direct polarity opposites with same predicate
      if (newFact.predicate !== 'general') {
        const hasOpposingWords = this.hasOpposingWords(content1, content2);
        if (hasOpposingWords) {
          console.log(`⚡ Rule-based conflict: Opposing words detected`);
          conflicts.push(candidate);
          continue;
        }
      }

      // Rule 2: Mutually exclusive values
      const hasMutuallyExclusiveValues = this.hasMutuallyExclusiveValues(content1, content2);
      if (hasMutuallyExclusiveValues) {
        console.log(`⚡ Rule-based conflict: Mutually exclusive values`);
        conflicts.push(candidate);
        continue;
      }

      // Rule 3: Time/number conflicts
      const hasTimeConflict = this.hasTimeOrNumberConflict(content1, content2);
      if (hasTimeConflict) {
        console.log(`⚡ Rule-based conflict: Time/number mismatch`);
        conflicts.push(candidate);
        continue;
      }
    }

    return conflicts;
  }

  /**
   * AI-powered contradiction detection - BUDGET LIMITED to max 10 calls!
   */
  private async detectAIContradictions(newFact: StructuredFact, candidates: MemoryEntry[]): Promise<MemoryEntry[]> {
    const conflicts: MemoryEntry[] = [];
    const maxAICalls = Math.min(candidates.length, 10); // Hard limit!

    for (let i = 0; i < maxAICalls; i++) {
      const candidate = candidates[i];
      
      try {
        const prompt = `Do these two facts about ${newFact.subject} contradict each other?

FACT 1: "${newFact.originalFact.content}"
FACT 2: "${candidate.content}"

Consider they contradict if they make conflicting claims about the same aspect of ${newFact.subject}.
Answer only "YES" or "NO".`;

        const response = await geminiService.generateChatResponse(
          prompt,
          "You are analyzing fact contradictions. Respond only YES or NO."
        );
        
        const isContradiction = /^\s*YES\b/i.test(response.content?.trim() || "");
        
        if (isContradiction) {
          console.log(`🤖 AI detected conflict: "${newFact.originalFact.content.substring(0, 30)}..." vs "${candidate.content.substring(0, 30)}..."`);
          conflicts.push(candidate);
        }
        
      } catch (error) {
        console.error(`❌ AI call ${i+1} failed:`, error);
        // Continue with other facts even if one AI call fails
      }
      
      // Small delay between AI calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return conflicts;
  }

  // Helper methods for rule-based detection
  private hasOverlappingConcepts(text1: string, text2: string): boolean {
    const keywords1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const keywords2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const overlap = keywords1.filter(k => keywords2.includes(k));
    return overlap.length >= 2; // At least 2 keywords in common
  }

  private hasOpposingWords(text1: string, text2: string): boolean {
    const opposites = [
      ['love', 'hate'], ['like', 'dislike'], ['prefer', 'avoid'],
      ['is', 'is not'], ['will', 'will not'], ['can', 'cannot'],
      ['always', 'never'], ['honor', 'dishonor'], ['professional', 'amateur']
    ];

    for (const [pos, neg] of opposites) {
      if ((text1.includes(pos) && text2.includes(neg)) ||
          (text1.includes(neg) && text2.includes(pos))) {
        return true;
      }
    }
    return false;
  }

  private hasMutuallyExclusiveValues(text1: string, text2: string): boolean {
    // Check for different killer names, different times, etc.
    const killers = ['ghostface', 'hillbilly', 'nurse', 'huntress', 'trapper', 'wraith'];
    const times = /(\d{1,2})\s*(am|pm)/g;
    
    const killer1 = killers.find(k => text1.includes(k));
    const killer2 = killers.find(k => text2.includes(k));
    
    if (killer1 && killer2 && killer1 !== killer2) return true;
    
    const time1 = text1.match(times);
    const time2 = text2.match(times);
    
    if (time1 && time2 && time1[0] !== time2[0]) return true;
    
    return false;
  }

  private hasTimeOrNumberConflict(text1: string, text2: string): boolean {
    const timePattern = /(\d+)\s*(am|pm|hour|minute)/g;
    const numberPattern = /\b(\d+)\b/g;
    
    const times1 = text1.match(timePattern) || [];
    const times2 = text2.match(timePattern) || [];
    
    if (times1.length > 0 && times2.length > 0) {
      return times1[0] !== times2[0];
    }
    
    const numbers1 = text1.match(numberPattern) || [];
    const numbers2 = text2.match(numberPattern) || [];
    
    if (numbers1.length > 0 && numbers2.length > 0) {
      return numbers1[0] !== numbers2[0];
    }
    
    return false;
  }

  private assessContradictionSeverity(newFact: MemoryEntry, conflictingFacts: MemoryEntry[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const maxConfidence = Math.max(...conflictingFacts.map(f => f.confidence || 50));
    const newFactConfidence = newFact.confidence || 50;
    const conflictCount = conflictingFacts.length;

    if (conflictCount >= 3 || (maxConfidence >= 80 && newFactConfidence >= 80)) {
      return 'HIGH';
    } else if (conflictCount >= 2 || (maxConfidence >= 60 && newFactConfidence >= 60)) {
      return 'MEDIUM';  
    }
    
    return 'LOW';
  }

  private noContradiction(explanation: string): ContradictionResult {
    return {
      isContradiction: false,
      conflictingFacts: [],
      severity: 'LOW',
      explanation
    };
  }

  /**
   * Resolve contradictions using same logic as original detector
   */
  async resolveContradictions(profileId: string, newFact: MemoryEntry, contradictingFacts: MemoryEntry[]): Promise<ContradictionGroup> {
    const groupId = randomUUID();
    const allFacts = [newFact, ...contradictingFacts];

    // Sort facts by resolution priority
    const sortedFacts = allFacts.sort((a, b) => {
      const scoreA = this.calculateResolutionScore(a);
      const scoreB = this.calculateResolutionScore(b);
      return scoreB - scoreA;
    });

    const primaryFact = sortedFacts[0];
    const conflictingFactsList = sortedFacts.slice(1);

    console.log(`✅ Smart resolution: Primary fact "${primaryFact.content.substring(0, 50)}..." (score: ${this.calculateResolutionScore(primaryFact)})`);

    // Mark all facts as part of this contradiction group
    const factIds = allFacts.map(f => f.id);
    await storage.markFactsAsContradicting(factIds, groupId);
    await storage.updateMemoryStatus(primaryFact.id, 'ACTIVE');

    return {
      groupId,
      facts: allFacts,
      primaryFact,
      conflictingFacts: conflictingFactsList,
      severity: this.assessContradictionSeverity(newFact, contradictingFacts),
      explanation: `Smart contradiction group: ${allFacts.length} facts analyzed efficiently`
    };
  }

  private calculateResolutionScore(fact: MemoryEntry): number {
    const confidence = fact.confidence || 50;
    const supportCount = fact.supportCount || 1;
    const importance = fact.importance || 1;
    
    return (confidence * 0.5) + (supportCount * 20 * 0.3) + (importance * 10 * 0.2);
  }

  async checkAndResolveContradictions(profileId: string, newFact: MemoryEntry): Promise<ContradictionGroup | null> {
    const contradictionResult = await this.detectContradictions(profileId, newFact);
    
    if (contradictionResult.isContradiction && contradictionResult.conflictingFacts.length > 0) {
      console.log(`🧠 Smart contradiction detected: ${contradictionResult.explanation}`);
      
      const group = await this.resolveContradictions(profileId, newFact, contradictionResult.conflictingFacts);
      
      console.log(`🎯 Smart contradiction resolved efficiently!`);
      
      return group;
    }

    return null;
  }
}

export const smartContradictionDetector = new SmartContradictionDetector();