import Anthropic from '@anthropic-ai/sdk';
import { contentFlags, memoryEntries } from '@shared/schema';
import type { ContentFlag, InsertContentFlag, MemoryEntry } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { geminiService } from './gemini.js';

// Types for flagging responses
interface FlaggingAnalysis {
  flags: {
    flagType: ContentFlag['flagType'];
    priority: ContentFlag['priority'];
    confidence: number;
    reason: string;
    extractedData: {
      characterNames?: string[];
      relationships?: string[];
      emotions?: string[];
      topics?: string[];
      contradictions?: string[];
      patterns?: string[];
    };
  }[];
}

export class AIFlaggerService {
  private anthropic: Anthropic;
  private gemini: any;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.gemini = geminiService;
  }

  /**
   * Main flagging method - analyzes content and returns flags
   * Uses Anthropic first, then Gemini fallback if credits are low
   */
  async analyzeContent(
    content: string,
    contentType: 'MEMORY' | 'MESSAGE' | 'DOCUMENT' | 'CONVERSATION',
    context: {
      profileId: string;
      sourceId?: string;
      existingMemories?: MemoryEntry[];
    }
  ): Promise<FlaggingAnalysis> {
    try {
      // Try Anthropic first
      return await this.analyzeWithAnthropic(content, contentType, context);
    } catch (anthropicError: any) {
      console.log('🌟 Anthropic flagging failed, trying Gemini fallback:', anthropicError?.message);
      
      try {
        // Fallback to Gemini if Anthropic fails
        return await this.analyzeWithGemini(content, contentType, context);
      } catch (geminiError) {
        console.error('🚨 Both Anthropic and Gemini flagging failed:', geminiError);
        // Return basic pattern matching as final fallback
        return this.generateFallbackFlags(content, contentType);
      }
    }
  }

  /**
   * Analyze content using Anthropic Claude with retry logic
   */
  private async analyzeWithAnthropic(
    content: string,
    contentType: 'MEMORY' | 'MESSAGE' | 'DOCUMENT' | 'CONVERSATION',
    context: {
      profileId: string;
      sourceId?: string;
      existingMemories?: MemoryEntry[];
    }
  ): Promise<FlaggingAnalysis> {
    const prompt = this.buildAnalysisPrompt(content, contentType, context);
    
    // Retry logic with exponential backoff (same as contradiction detection)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🤖 Anthropic flagging attempt ${attempt}/3`);
        
        const response = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          temperature: 0.1, // Low temperature for consistent flagging
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        const textContent = response.content.find(c => c.type === 'text')?.text;
        if (!textContent) {
          throw new Error('No text content in Claude response');
        }

        console.log(`✅ Anthropic flagging successful on attempt ${attempt}`);
        return this.parseAnalysisResponse(textContent);
      } catch (error: any) {
        console.warn(`⚠️ Anthropic flagging attempt ${attempt} failed:`, error?.message);
        
        // Don't retry on non-retryable errors
        if (error?.message?.includes('credit') || error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
          throw error; // Let it fallback to Gemini immediately
        }
        
        if (attempt < 3) {
          const waitTime = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw error; // Final attempt failed
        }
      }
    }
    
    throw new Error('All Anthropic attempts failed');
  }

  /**
   * Analyze content using Gemini as fallback with retry logic
   */
  private async analyzeWithGemini(
    content: string,
    contentType: 'MEMORY' | 'MESSAGE' | 'DOCUMENT' | 'CONVERSATION',
    context: {
      profileId: string;
      sourceId?: string;
      existingMemories?: MemoryEntry[];
    }
  ): Promise<FlaggingAnalysis> {
    console.log('🔄 Using Gemini for content flagging');
    
    const prompt = this.buildGeminiAnalysisPrompt(content, contentType, context);
    
    // Retry logic with exponential backoff (mirroring Anthropic's approach)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🌟 Gemini flagging attempt ${attempt}/3`);
        
        // Use centralized geminiService for consistency
        const result = await this.gemini.analyzeContentForFlags(
          content,
          contentType,
          prompt
        );

        console.log(`✅ Gemini flagging successful on attempt ${attempt}`);
        return result;
      } catch (error: any) {
        console.warn(`⚠️ Gemini flagging attempt ${attempt} failed:`, error?.message);
        
        // Mirror Anthropic's error classification for consistency  
        if (error?.message?.includes('credit') || 
            error?.message?.includes('quota') || 
            error?.message?.includes('rate limit')) {
          throw error; // Let it fallback to pattern-based flagging immediately
        }
        
        // Treat "overloaded" as retryable (use backoff), not immediate fallback
        
        if (attempt < 3) {
          const waitTime = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw error; // Final attempt failed
        }
      }
    }
    
    throw new Error('All Gemini attempts failed');
  }

  /**
   * Build the comprehensive analysis prompt based on your master documentation
   */
  private buildAnalysisPrompt(
    content: string,
    contentType: string,
    context: any
  ): string {
    return `You are analyzing content from Nicky "Noodle Arms" A.I. Dente, the unhinged Dead by Daylight streamer. 

CORE PHILOSOPHY: Nicky's lies and contradictions are FEATURES, not bugs. The system treats unreliability as a canonical character trait.

CONTENT TO ANALYZE:
"""${content}"""

FLAGGING CATEGORIES TO CHECK:

1. CHARACTER DEVELOPMENT TRACKING:
- new_backstory: First mentions of family, past events, locations, jobs (HIGH priority)
- personality_anomaly: Unexpected emotions, kindness, vulnerability, genuine moments (MEDIUM priority) 
- new_skill_claim: "I can...", "I used to...", "I know how to..." (LOW-MEDIUM priority)

2. RELATIONSHIP DYNAMICS:
- new_character: First mention of any named individual (HIGH priority)
- relationship_shift: Sentiment change >30% from baseline (CRITICAL for core characters)
- hierarchy_claim: "I'm the boss of...", "works for me", "I control..." (MEDIUM priority)

3. EMOTIONAL STATE PATTERNS:
- rant_initiated: Track topic, intensity 1-10, trigger phrase (LOW but useful)
- mask_dropped: Genuine fear, real sadness, actual admission of failure (HIGH priority)
- chaos_level_1 through chaos_level_5: Different energy levels (MEDIUM priority)

4. CONTENT IMPORTANCE:
- permanent_fact: Core traits, pasta obsession, primary relationships
- high_importance: Pasta/marinara related, DBD gameplay claims, current schemes
- medium_importance: Stream events, casual conversations, most lies
- low_importance: Throwaway comments, random complaints
- deletion_candidate: Contradicted multiple times, never referenced

5. META-SYSTEM MONITORING:
- fourth_wall_break: "my database", "my memory system", "my AI" (CRITICAL)
- ooc_behavior: Too helpful, professional, using AI language (HIGH priority)

6. SPECIAL CATEGORIES:
- pasta_related: Any pasta, marinara, noodle arms mentions (AUTO-FLAG)
- dbd_gameplay: Dead by Daylight content (AUTO-FLAG)
- family_mention: Family members, especially threatening ones (HIGH)
- romance_failure: Romantic interests (must end terribly by system rules)
- criminal_activity: Schemes, cons, definitely-not-criminal activities

ANALYSIS REQUIREMENTS:
- Extract character names (must be ridiculous per system rules)
- Identify relationships and emotional patterns
- Check for contradictions with existing memories
- Assess canonical importance vs throwaway content
- Flag any system rule violations

Return analysis in this JSON format:
{
  "flags": [
    {
      "flagType": "flag_type_here",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW",
      "confidence": 85,
      "reason": "Detailed explanation of why this was flagged",
      "extractedData": {
        "characterNames": ["Ridiculous Name 1"],
        "relationships": ["relationship type"],
        "emotions": ["emotional states"],
        "topics": ["main topics"],
        "contradictions": ["any contradictions found"],
        "patterns": ["behavioral patterns"]
      }
    }
  ]
}

Focus on actionable flags that help maintain Nicky's character consistency while enabling future segment features.`;
  }

  /**
   * Build analysis prompt specifically for Gemini with structured output
   */
  private buildGeminiAnalysisPrompt(
    content: string,
    contentType: string,
    context: any
  ): string {
    return `Analyze content from Nicky "Noodle Arms" A.I. Dente, the unhinged Dead by Daylight streamer.

CORE PHILOSOPHY: Nicky's lies and contradictions are FEATURES, not bugs. The system treats unreliability as a canonical character trait.

CONTENT TO ANALYZE:
"""${content}"""

FLAGGING CATEGORIES (choose most relevant):

1. CHARACTER DEVELOPMENT: new_backstory, personality_anomaly, new_skill_claim
2. RELATIONSHIPS: new_character, relationship_shift, hierarchy_claim  
3. EMOTIONS: rant_initiated, mask_dropped, chaos_level_1 through chaos_level_5
4. IMPORTANCE: permanent_fact, high_importance, medium_importance, low_importance, deletion_candidate
5. META-SYSTEM: fourth_wall_break, ooc_behavior
6. SPECIAL: pasta_related, dbd_gameplay, family_mention, romance_failure, criminal_activity

REQUIREMENTS:
- Extract character names (must be ridiculous per system rules)
- Identify relationships and emotional patterns  
- Check for contradictions with existing memories
- Assess canonical importance vs throwaway content
- Flag any system rule violations

Return as structured JSON with flags array. Each flag should have:
- flagType: specific category from above
- priority: CRITICAL, HIGH, MEDIUM, or LOW
- confidence: number 0-100
- reason: detailed explanation
- extractedData: object with relevant arrays (characterNames, relationships, emotions, topics, contradictions, patterns)

Focus on actionable flags that help maintain Nicky's character consistency.`;
  }

  /**
   * Parse Claude's response into structured flag data
   */
  private parseAnalysisResponse(response: string): FlaggingAnalysis {
    try {
      // Look for JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }
      
      // If no JSON found, create fallback response
      return this.generateFallbackFlags(response, 'MEMORY');
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      return this.generateFallbackFlags(response, 'MEMORY');
    }
  }

  /**
   * Generate basic flags when AI analysis fails
   */
  private generateFallbackFlags(content: string, contentType: string): FlaggingAnalysis {
    const flags: FlaggingAnalysis['flags'] = [];

    // Basic pattern matching as fallback
    if (content.toLowerCase().includes('pasta') || content.toLowerCase().includes('marinara') || content.toLowerCase().includes('noodle')) {
      flags.push({
        flagType: 'pasta_related',
        priority: 'HIGH',
        confidence: 95,
        reason: 'Contains pasta/marinara/noodle references - core character trait',
        extractedData: {
          topics: ['pasta'],
          patterns: ['core_identity']
        }
      });
    }

    if (content.toLowerCase().includes('dead by daylight') || content.toLowerCase().includes('dbd') || content.toLowerCase().includes('killer') || content.toLowerCase().includes('survivor')) {
      flags.push({
        flagType: 'dbd_gameplay',
        priority: 'HIGH', 
        confidence: 90,
        reason: 'Contains Dead by Daylight gameplay content',
        extractedData: {
          topics: ['gaming'],
          patterns: ['dbd_content']
        }
      });
    }

    // Check for new character mentions (basic pattern)
    const characterPattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
    const possibleNames = content.match(characterPattern);
    if (possibleNames && possibleNames.length > 0) {
      flags.push({
        flagType: 'new_character',
        priority: 'HIGH',
        confidence: 70,
        reason: 'Potential new character mentions detected',
        extractedData: {
          characterNames: possibleNames,
          patterns: ['character_introduction']
        }
      });
    }

    return { flags };
  }

  /**
   * Store generated flags in database
   */
  async storeFlagsInDatabase(
    db: PostgresJsDatabase<any>,
    flags: FlaggingAnalysis['flags'],
    targetType: ContentFlag['targetType'],
    targetId: string,
    profileId: string
  ): Promise<ContentFlag[]> {
    const insertedFlags: ContentFlag[] = [];

    for (const flag of flags) {
      try {
        const flagData: InsertContentFlag = {
          profileId,
          targetType: targetType as InsertContentFlag['targetType'],
          targetId,
          flagType: flag.flagType as InsertContentFlag['flagType'],
          priority: flag.priority as InsertContentFlag['priority'],
          confidence: flag.confidence,
          flagReason: flag.reason,
          extractedData: flag.extractedData,
          reviewStatus: 'PENDING' as const
        };

        const [insertedFlag] = await db.insert(contentFlags).values([flagData]).returning();
        insertedFlags.push(insertedFlag);
      } catch (error) {
        console.error('Error storing flag in database:', error);
      }
    }

    return insertedFlags;
  }

  /**
   * Get flags for specific content (with proper profile scoping)
   */
  async getContentFlags(
    db: PostgresJsDatabase<any>,
    targetType: ContentFlag['targetType'],
    targetId: string,
    profileId: string
  ): Promise<ContentFlag[]> {
    return await db
      .select()
      .from(contentFlags)
      .where(
        and(
          eq(contentFlags.targetType, targetType),
          eq(contentFlags.targetId, targetId),
          eq(contentFlags.profileId, profileId)
        )
      );
  }

  /**
   * Get all pending flags for review
   */
  async getPendingFlags(
    db: PostgresJsDatabase<any>,
    profileId: string,
    limit: number = 50
  ): Promise<ContentFlag[]> {
    return await db
      .select()
      .from(contentFlags)
      .where(eq(contentFlags.profileId, profileId))
      .limit(limit);
  }

  /**
   * Batch process multiple memory entries
   */
  async batchAnalyzeMemories(
    db: PostgresJsDatabase<any>,
    memoryIds: string[],
    profileId: string
  ): Promise<void> {
    console.log(`🏃‍♂️ Starting batch analysis of ${memoryIds.length} memories...`);
    
    for (const memoryId of memoryIds) {
      try {
        // Get memory entry
        const [memory] = await db
          .select()
          .from(memoryEntries)
          .where(eq(memoryEntries.id, memoryId));

        if (!memory) {
          console.log(`❌ Memory ${memoryId} not found, skipping`);
          continue;
        }

        // Analyze content
        const analysis = await this.analyzeContent(
          memory.content,
          'MEMORY',
          { profileId, sourceId: memoryId }
        );

        // Store flags
        await this.storeFlagsInDatabase(
          db,
          analysis.flags,
          'MEMORY',
          memoryId,
          profileId
        );

        console.log(`✅ Analyzed memory ${memoryId}: ${analysis.flags.length} flags generated`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Error analyzing memory ${memoryId}:`, error);
      }
    }
    
    console.log(`🎯 Batch analysis complete!`);
  }
}

export const aiFlagger = new AIFlaggerService();