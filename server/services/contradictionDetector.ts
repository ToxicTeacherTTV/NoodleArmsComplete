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
  primaryFact: MemoryEntry; // Highest confidence fact that should be considered "true"
  conflictingFacts: MemoryEntry[]; // Lower confidence facts that contradict
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  explanation: string;
}

class ContradictionDetector {
  /**
   * Check if a new fact contradicts existing facts for a profile
   */
  async detectContradictions(profileId: string, newFact: MemoryEntry): Promise<ContradictionResult> {
    try {
      // Get existing active facts for this profile, excluding the new fact itself
      const existingFacts = await storage.getMemoryEntries(profileId, 500);
      const activeFacts = existingFacts.filter(fact => 
        fact.status === 'ACTIVE' && 
        fact.id !== newFact.id &&
        !fact.contradictionGroupId // Don't check already flagged contradictions
      );

      if (activeFacts.length === 0) {
        return {
          isContradiction: false,
          conflictingFacts: [],
          severity: 'LOW',
          explanation: 'No existing facts to check against'
        };
      }

      console.log(`Checking new fact "${newFact.content.substring(0, 50)}..." against ${activeFacts.length} existing facts`);

      // Use AI to detect semantic contradictions
      const contradictions = await this.findSemanticContradictions(newFact, activeFacts);

      if (contradictions.length > 0) {
        const severity = this.assessContradictionSeverity(newFact, contradictions);
        
        return {
          isContradiction: true,
          conflictingFacts: contradictions,
          severity,
          explanation: `Found ${contradictions.length} conflicting facts`
        };
      }

      return {
        isContradiction: false,
        conflictingFacts: [],
        severity: 'LOW',
        explanation: 'No contradictions detected'
      };

    } catch (error) {
      console.error('Error detecting contradictions:', error);
      return {
        isContradiction: false,
        conflictingFacts: [],
        severity: 'LOW',
        explanation: 'Error during contradiction detection'
      };
    }
  }

  /**
   * Use AI to find semantic contradictions between facts
   */
  private async findSemanticContradictions(newFact: MemoryEntry, existingFacts: MemoryEntry[]): Promise<MemoryEntry[]> {
    // Process facts in batches to avoid overwhelming the AI
    const batchSize = 10;
    const contradictingFacts: MemoryEntry[] = [];

    for (let i = 0; i < existingFacts.length; i += batchSize) {
      const batch = existingFacts.slice(i, i + batchSize);
      
      const batchPrompt = `
Analyze the following NEW FACT against existing facts to identify any semantic contradictions:

NEW FACT: "${newFact.content}"

EXISTING FACTS:
${batch.map((fact, idx) => `${idx + 1}. "${fact.content}"`).join('\n')}

For each existing fact, determine if it contradicts the new fact. Two facts contradict if they make conflicting claims about the same subject/entity/concept.

Examples of contradictions:
- "Nicky prefers Ghostface" vs "Nicky hates Ghostface"
- "The stream starts at 8 PM" vs "The stream starts at 9 PM" 
- "Earl is Nicky's co-host" vs "Earl is not involved in the stream"

Examples of NOT contradictions:
- Different aspects of the same topic ("Nicky likes horror games" vs "Nicky plays DBD")
- Different time contexts ("Used to main Hillbilly" vs "Now mains Ghostface")
- Compatible preferences ("Likes camping" vs "Enjoys tunneling")

Return only the numbers of facts that contradict the new fact, separated by commas. If no contradictions, return "NONE".

Response:`;

      try {
        // 🚀 USE AI: Enable semantic contradiction detection with Gemini  
        // Use a simple fact analysis approach - check each fact individually
        const contradictionPrompt = `Analyze if these two facts contradict each other:

FACT 1: "${newFact.content}"

FACT 2: "${batch[0]?.content || ''}"

Do these facts make conflicting claims about the same subject? Answer only "YES" or "NO".`;

        // Skip the initial response since we'll check individually
        // const response = await geminiService.ai.models.generateContent(...
        
        // Check each fact in the batch individually for cleaner AI responses
        for (const existingFact of batch) {
          const individualPrompt = `Analyze if these two facts contradict each other:

FACT 1: "${newFact.content}"
FACT 2: "${existingFact.content}"

Do these facts make conflicting claims about the same subject/entity? Answer only "YES" or "NO".`;

          const individualResponse = await geminiService['ai'].models.generateContent({
            model: "gemini-2.5-pro",
            contents: individualPrompt,
          });
          
          const result = individualResponse.text?.trim().toUpperCase();
          console.log(`🤖 AI contradiction check: "${result}" for facts "${newFact.content.substring(0, 30)}..." vs "${existingFact.content.substring(0, 30)}..."`);
          
          if (result === "YES") {
            contradictingFacts.push(existingFact);
            console.log(`🔍 AI detected contradiction: "${newFact.content.substring(0, 50)}..." vs "${existingFact.content.substring(0, 50)}..."`);
          }
        }
      } catch (error) {
        console.error(`❌ AI contradiction detection failed, falling back to keyword matching:`, error);
        
        // Fallback to basic keyword detection if AI fails
        for (const existingFact of batch) {
          if (this.detectBasicContradiction(newFact.content, existingFact.content)) {
            contradictingFacts.push(existingFact);
            console.log(`📍 Keyword detected contradiction: "${newFact.content.substring(0, 50)}..." vs "${existingFact.content.substring(0, 50)}..."`);
          }
        }
      }
    }

    return contradictingFacts;
  }

  /**
   * Simple contradiction detection using keyword patterns
   */
  private detectBasicContradiction(newContent: string, existingContent: string): boolean {
    const newLower = newContent.toLowerCase();
    const existingLower = existingContent.toLowerCase();
    
    // Check for direct negations
    const negationPatterns = [
      ['likes', 'hates'], ['loves', 'hates'], ['prefers', 'dislikes'],
      ['is', 'is not'], ['has', 'does not have'], ['can', 'cannot'],
      ['will', 'will not'], ['does', 'does not']
    ];
    
    for (const [positive, negative] of negationPatterns) {
      if ((newLower.includes(positive) && existingLower.includes(negative)) ||
          (newLower.includes(negative) && existingLower.includes(positive))) {
        return true;
      }
    }
    
    // Check for conflicting times/numbers (basic pattern)
    const timePattern = /(\d+)\s*(am|pm|hour|minute)/g;
    const newTimes = newLower.match(timePattern);
    const existingTimes = existingLower.match(timePattern);
    
    if (newTimes && existingTimes && newTimes[0] !== existingTimes[0]) {
      return true;
    }
    
    return false;
  }

  /**
   * Assess the severity of contradictions based on confidence and importance
   */
  private assessContradictionSeverity(newFact: MemoryEntry, contradictingFacts: MemoryEntry[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const maxConfidence = Math.max(...contradictingFacts.map(f => f.confidence || 50));
    const maxImportance = Math.max(...contradictingFacts.map(f => f.importance || 1));
    const newFactConfidence = newFact.confidence || 50;
    const newFactImportance = newFact.importance || 1;

    // High severity: Important facts with high confidence contradicting each other
    if ((maxConfidence >= 80 && newFactConfidence >= 80) || 
        (maxImportance >= 4 && newFactImportance >= 4)) {
      return 'HIGH';
    }

    // Medium severity: Moderate confidence contradictions
    if ((maxConfidence >= 60 && newFactConfidence >= 60) || 
        (maxImportance >= 3 && newFactImportance >= 3)) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Resolve contradictions by grouping and prioritizing facts
   */
  async resolveContradictions(profileId: string, newFact: MemoryEntry, contradictingFacts: MemoryEntry[]): Promise<ContradictionGroup> {
    const groupId = randomUUID();
    const allFacts = [newFact, ...contradictingFacts];

    // Sort facts by resolution priority (confidence + support + importance)
    const sortedFacts = allFacts.sort((a, b) => {
      const scoreA = this.calculateResolutionScore(a);
      const scoreB = this.calculateResolutionScore(b);
      return scoreB - scoreA; // Highest score first
    });

    const primaryFact = sortedFacts[0];
    const conflictingFactsList = sortedFacts.slice(1);

    console.log(`Resolving contradiction group ${groupId}: Primary fact "${primaryFact.content.substring(0, 50)}..." (score: ${this.calculateResolutionScore(primaryFact)})`);

    // Mark all facts as part of this contradiction group
    const factIds = allFacts.map(f => f.id);
    await storage.markFactsAsContradicting(factIds, groupId);

    // Keep the primary fact as ACTIVE, others marked as AMBIGUOUS
    // Note: markFactsAsContradicting marks all as AMBIGUOUS, so we need to update the primary fact back to ACTIVE
    await this.updateFactStatus(primaryFact.id, 'ACTIVE');

    return {
      groupId,
      facts: allFacts,
      primaryFact,
      conflictingFacts: conflictingFactsList,
      severity: this.assessContradictionSeverity(newFact, contradictingFacts),
      explanation: `Resolved contradiction group with ${allFacts.length} facts. Primary: "${primaryFact.content.substring(0, 100)}..."`
    };
  }

  /**
   * Calculate resolution score for prioritizing contradicting facts
   */
  private calculateResolutionScore(fact: MemoryEntry): number {
    const confidence = fact.confidence || 50;
    const supportCount = fact.supportCount || 1;
    const importance = fact.importance || 1;
    
    // Weighted score: confidence is most important, then support, then importance
    return (confidence * 0.5) + (supportCount * 20 * 0.3) + (importance * 10 * 0.2);
  }

  /**
   * Update fact status without changing contradiction group
   */
  private async updateFactStatus(factId: string, status: 'ACTIVE' | 'DEPRECATED' | 'AMBIGUOUS'): Promise<void> {
    await storage.updateMemoryStatus(factId, status);
  }

  /**
   * Proactively check for contradictions when adding new facts
   */
  async checkAndResolveContradictions(profileId: string, newFact: MemoryEntry): Promise<ContradictionGroup | null> {
    const contradictionResult = await this.detectContradictions(profileId, newFact);
    
    if (contradictionResult.isContradiction && contradictionResult.conflictingFacts.length > 0) {
      console.log(`🔍 Contradiction detected: ${contradictionResult.explanation}`);
      
      const group = await this.resolveContradictions(profileId, newFact, contradictionResult.conflictingFacts);
      
      console.log(`✅ Contradiction resolved: Group ${group.groupId} with primary fact having score ${this.calculateResolutionScore(group.primaryFact)}`);
      
      return group;
    }

    return null;
  }
}

export const contradictionDetector = new ContradictionDetector();