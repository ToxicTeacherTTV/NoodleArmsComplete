import { geminiService } from './gemini';
import { storage } from '../storage';
import { MemoryEntry } from '@shared/schema';
import { randomUUID } from 'crypto';

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
   * Extract structured information from a fact using pattern matching
   * This avoids expensive AI calls for structure extraction
   */
  private async extractStructuredFact(fact: MemoryEntry): Promise<StructuredFact | null> {
    const content = fact.content.toLowerCase();
    
    // Extract subject (usually "nicky", "earl grey", "the stream", etc.)
    let subject = 'unknown';
    if (content.includes('nicky')) subject = 'nicky';
    else if (content.includes('earl grey') || content.includes('earl')) subject = 'earl_grey';
    else if (content.includes('stream') || content.includes('podcast')) subject = 'stream';
    else if (content.includes('bhvr') || content.includes('game')) subject = 'game';
    else if (content.includes('sabam')) subject = 'sabam';
    
    // Extract predicate categories (what aspect we're talking about)
    let predicate = 'general';
    if (content.includes('prefer') || content.includes('like') || content.includes('love') || content.includes('hate')) predicate = 'preference';
    else if (content.includes('believe') || content.includes('claim') || content.includes('think')) predicate = 'belief';
    else if (content.includes('main') || content.includes('play') || content.includes('use')) predicate = 'gameplay';
    else if (content.includes('is') || content.includes('was') || content.includes('are')) predicate = 'identity';
    else if (content.includes('honor') || content.includes('rule') || content.includes('code')) predicate = 'ethics';
    else if (content.includes('always') || content.includes('never') || content.includes('will')) predicate = 'behavior';
    else if (content.includes('start') || content.includes('time') || content.includes('schedule')) predicate = 'schedule';

    // Extract polarity (positive, negative, or neutral stance)
    let polarity: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
    const positiveWords = ['love', 'like', 'prefer', 'always', 'is', 'will', 'believe', 'honor'];
    const negativeWords = ['hate', 'dislike', 'never', 'not', 'cannot', 'refuses', 'against'];
    
    if (positiveWords.some(word => content.includes(word))) polarity = 'POSITIVE';
    else if (negativeWords.some(word => content.includes(word))) polarity = 'NEGATIVE';

    // Extract key value/concept
    const value = content.substring(0, 100); // Use first 100 chars as value representation

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
   * Find candidate facts that could actually contradict the new fact
   * This is the KEY optimization - instead of checking 1000+ facts, check ~20
   */
  private async findRelevantCandidates(profileId: string, structuredFact: StructuredFact): Promise<MemoryEntry[]> {
    const allFacts = await storage.getMemoryEntries(profileId, 1000);
    const activeFacts = allFacts.filter(fact => 
      fact.status === 'ACTIVE' && 
      fact.id !== structuredFact.id &&
      !fact.contradictionGroupId
    );

    const candidates: MemoryEntry[] = [];

    for (const fact of activeFacts) {
      const candidate = await this.extractStructuredFact(fact);
      if (!candidate) continue;

      // Only consider facts about the same subject AND predicate
      if (candidate.subject === structuredFact.subject && 
          candidate.predicate === structuredFact.predicate) {
        candidates.push(fact);
      }
      
      // Also include facts with overlapping keywords for broader matching
      else if (this.hasOverlappingConcepts(structuredFact.value, candidate.value)) {
        candidates.push(fact);
      }
    }

    return candidates;
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