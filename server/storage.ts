import { 
  profiles, 
  conversations, 
  messages, 
  documents, 
  memoryEntries,
  chaosState,
  loreEvents,
  loreCharacters,
  discordServers,
  discordMembers,
  discordTopicTriggers,
  discordConversations,
  automatedSources,
  pendingContent,
  adTemplates,
  prerollAds,
  podcastEpisodes,
  podcastSegments,
  type Profile, 
  type InsertProfile,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Document,
  type InsertDocument,
  type MemoryEntry,
  type InsertMemoryEntry,
  type ChaosState,
  type InsertChaosState,
  type LoreEvent,
  type InsertLoreEvent,
  type LoreCharacter,
  type InsertLoreCharacter,
  type DiscordServer,
  type InsertDiscordServer,
  type DiscordMember,
  type InsertDiscordMember,
  type DiscordTopicTrigger,
  type InsertDiscordTopicTrigger,
  type DiscordConversation,
  type InsertDiscordConversation,
  type AutomatedSource,
  type InsertAutomatedSource,
  type PendingContent,
  type InsertPendingContent,
  type AdTemplate,
  type InsertAdTemplate,
  type PrerollAd,
  type InsertPrerollAd,
  type PodcastEpisode,
  type InsertPodcastEpisode,
  type PodcastSegment,
  type InsertPodcastSegment
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, sql } from "drizzle-orm";
import { aiFlagger } from "./services/aiFlagger";

export interface IStorage {
  // Profile management
  getProfile(id: string): Promise<Profile | undefined>;
  getActiveProfile(): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: string, profile: Partial<Profile>): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;
  listProfiles(): Promise<Profile[]>;
  setActiveProfile(id: string): Promise<void>;

  // Conversation management
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationMessages(conversationId: string): Promise<Message[]>;
  addMessage(message: InsertMessage): Promise<Message>;
  getRecentMessages(conversationId: string, limit: number): Promise<Message[]>;

  // Document management
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getProfileDocuments(profileId: string): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  incrementDocumentRetrieval(id: string): Promise<void>;

  // Memory management
  addMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry>;
  getMemoryEntries(profileId: string, limit?: number): Promise<MemoryEntry[]>;
  searchMemoryEntries(profileId: string, query: string): Promise<MemoryEntry[]>;
  deleteMemoryEntry(id: string): Promise<void>;
  clearProfileMemories(profileId: string): Promise<void>;
  incrementMemoryRetrieval(id: string): Promise<void>;
  getMemoryStats(profileId: string): Promise<{ totalFacts: number; conversations: number }>;
  
  // Confidence tracking methods
  findMemoryByCanonicalKey(profileId: string, canonicalKey: string): Promise<MemoryEntry | undefined>;
  updateMemoryConfidence(id: string, confidence: number, supportCount?: number): Promise<MemoryEntry>;
  updateMemoryEntry(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry>;
  getHighConfidenceMemories(profileId: string, minConfidence: number, limit?: number): Promise<MemoryEntry[]>;
  getMemoriesByConfidenceRange(profileId: string, minConfidence: number, maxConfidence: number, limit?: number): Promise<MemoryEntry[]>;
  markFactsAsContradicting(factIds: string[], groupId: string): Promise<void>;
  updateMemoryStatus(id: string, status: 'ACTIVE' | 'DEPRECATED' | 'AMBIGUOUS'): Promise<MemoryEntry>;
  getReliableMemoriesForAI(profileId: string, limit?: number): Promise<MemoryEntry[]>;
  
  // Protected facts methods
  addProtectedFact(profileId: string, content: string, importance?: number, keywords?: string[]): Promise<MemoryEntry>;
  getProtectedFacts(profileId: string): Promise<MemoryEntry[]>;
  
  // Contradiction groups methods
  getContradictionGroups(profileId: string): Promise<any[]>;

  // Chaos State management
  getChaosState(): Promise<ChaosState | undefined>;
  createOrUpdateChaosState(state: InsertChaosState): Promise<ChaosState>;
  
  // Discord management methods
  getDiscordServer(serverId: string): Promise<DiscordServer | undefined>;
  createDiscordServer(server: InsertDiscordServer): Promise<DiscordServer>;
  updateDiscordServer(id: string, updates: Partial<DiscordServer>): Promise<DiscordServer>;
  getProfileDiscordServers(profileId: string): Promise<DiscordServer[]>;
  
  // Discord member management
  getDiscordMember(serverId: string, userId: string): Promise<DiscordMember | undefined>;
  createDiscordMember(member: InsertDiscordMember): Promise<DiscordMember>;
  updateDiscordMember(id: string, updates: Partial<DiscordMember>): Promise<DiscordMember>;
  getServerMembers(serverId: string): Promise<DiscordMember[]>;
  
  // Discord topic triggers
  getDiscordTopicTriggers(serverId: string): Promise<DiscordTopicTrigger[]>;
  createDiscordTopicTrigger(trigger: InsertDiscordTopicTrigger): Promise<DiscordTopicTrigger>;
  updateDiscordTopicTrigger(id: string, updates: Partial<DiscordTopicTrigger>): Promise<DiscordTopicTrigger>;
  deleteDiscordTopicTrigger(id: string): Promise<void>;
  
  // Discord conversation logging
  logDiscordConversation(conversation: InsertDiscordConversation): Promise<DiscordConversation>;
  getDiscordConversations(serverId: string, limit?: number): Promise<DiscordConversation[]>;
  
  // Automated Sources Management
  createAutomatedSource(data: InsertAutomatedSource): Promise<AutomatedSource>;
  getAutomatedSources(profileId: string): Promise<AutomatedSource[]>;
  updateAutomatedSource(id: string, data: Partial<AutomatedSource>): Promise<void>;
  toggleAutomatedSource(id: string, isActive: boolean): Promise<void>;

  // Pending Content Management  
  createPendingContent(data: InsertPendingContent): Promise<PendingContent>;
  getPendingContent(profileId: string, processed?: boolean): Promise<PendingContent[]>;
  approvePendingContent(id: string): Promise<void>;
  rejectPendingContent(id: string, reason: string): Promise<void>;
  getPendingContentById(id: string): Promise<PendingContent | null>;

  // Podcast Management methods
  createPodcastEpisode(episode: InsertPodcastEpisode): Promise<PodcastEpisode>;
  getPodcastEpisode(id: string): Promise<PodcastEpisode | undefined>;
  getPodcastEpisodeByNumber(profileId: string, episodeNumber: number): Promise<PodcastEpisode | undefined>;
  listPodcastEpisodes(profileId: string): Promise<PodcastEpisode[]>;
  updatePodcastEpisode(id: string, updates: Partial<PodcastEpisode>): Promise<PodcastEpisode>;
  deletePodcastEpisode(id: string): Promise<void>;
  
  createPodcastSegment(segment: InsertPodcastSegment): Promise<PodcastSegment>;
  getPodcastSegment(id: string): Promise<PodcastSegment | undefined>;
  getEpisodeSegments(episodeId: string): Promise<PodcastSegment[]>;
  updatePodcastSegment(id: string, updates: Partial<PodcastSegment>): Promise<PodcastSegment>;
  deletePodcastSegment(id: string): Promise<void>;
  clearPodcastSegments(episodeId: string): Promise<void>;
  searchPodcastContent(profileId: string, query: string): Promise<{ episodes: PodcastEpisode[]; segments: PodcastSegment[] }>;
}

export class DatabaseStorage implements IStorage {
  // Expose db for lore engine to use directly  
  public db = db;
  async getProfile(id: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile || undefined;
  }

  async getActiveProfile(): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.isActive, true));
    return profile || undefined;
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const [newProfile] = await db
      .insert(profiles)
      .values([profile as any])
      .returning();
    return newProfile;
  }

  async updateProfile(id: string, profile: Partial<Profile>): Promise<Profile> {
    const updateData = { ...profile, updatedAt: sql`now()` };
    const [updatedProfile] = await db
      .update(profiles)
      .set(updateData as any)
      .where(eq(profiles.id, id))
      .returning();
    return updatedProfile;
  }

  async deleteProfile(id: string): Promise<void> {
    await db.delete(profiles).where(eq(profiles.id, id));
  }

  async listProfiles(): Promise<Profile[]> {
    return await db.select().from(profiles).orderBy(desc(profiles.createdAt));
  }

  async setActiveProfile(id: string): Promise<void> {
    await db.update(profiles).set({ isActive: false });
    await db.update(profiles).set({ isActive: true }).where(eq(profiles.id, id));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values([conversation])
      .returning();
    return newConversation;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async addMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values([message as any])
      .returning();
    return newMessage;
  }

  async getRecentMessages(conversationId: string, limit: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values([document as any])
      .returning();
    return newDocument;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getProfileDocuments(profileId: string): Promise<Document[]> {
    // Optimized: Select only essential columns and limit to recent documents
    return await db
      .select({
        id: documents.id,
        filename: documents.filename,
        contentType: documents.contentType,
        size: documents.size,
        processingStatus: documents.processingStatus,
        profileId: documents.profileId,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        chunks: documents.chunks,
        extractedContent: documents.extractedContent,
        retrievalCount: documents.retrievalCount,
      })
      .from(documents)
      .where(eq(documents.profileId, profileId))
      .orderBy(desc(documents.createdAt))
      .limit(50); // Limit to most recent 50 documents
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }

  async deleteDocument(id: string): Promise<void> {
    // First delete all associated memory entries
    await db.delete(memoryEntries).where(eq(memoryEntries.sourceId, id));
    // Then delete the document itself
    await db.delete(documents).where(eq(documents.id, id));
  }

  async incrementDocumentRetrieval(id: string): Promise<void> {
    await db
      .update(documents)
      .set({ retrievalCount: sql`${documents.retrievalCount} + 1` })
      .where(eq(documents.id, id));
  }

  async addMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry> {
    // CRITICAL FIX: Ensure canonicalKey is always present
    let finalEntry = { ...entry };
    
    if (!finalEntry.canonicalKey && finalEntry.content) {
      const { generateCanonicalKey } = await import('./utils/canonical.js');
      finalEntry.canonicalKey = generateCanonicalKey(finalEntry.content);
      console.warn(`🔧 Backfilled missing canonicalKey for content: "${finalEntry.content.substring(0, 50)}..."`);
    }
    
    const [newEntry] = await db
      .insert(memoryEntries)
      .values([finalEntry as any])
      .returning();

    // AI-Assisted Flagging: Analyze new memory content in background
    if (newEntry.content && newEntry.profileId) {
      // Run flagging as background task to avoid slowing down memory creation
      this.flagMemoryContentBackground(newEntry);
    }

    return newEntry;
  }

  /**
   * Background task to flag memory content using AI analysis
   */
  private async flagMemoryContentBackground(memory: MemoryEntry): Promise<void> {
    try {
      console.log(`🤖 Starting AI flagging analysis for memory: ${memory.id}`);
      
      const analysis = await aiFlagger.analyzeContent(
        memory.content,
        'MEMORY',
        { 
          profileId: memory.profileId,
          sourceId: memory.id 
        }
      );

      if (analysis.flags.length > 0) {
        await aiFlagger.storeFlagsInDatabase(
          db,
          analysis.flags,
          'MEMORY',
          memory.id,
          memory.profileId
        );
        
        console.log(`🏷️ Generated ${analysis.flags.length} flags for memory ${memory.id}: ${analysis.flags.map(f => f.flagType).join(', ')}`);
      } else {
        console.log(`✅ No flags needed for memory ${memory.id}`);
      }
    } catch (error) {
      // Don't throw - this is a background task and shouldn't fail memory creation
      console.error(`❌ Error flagging memory ${memory.id}:`, error);
    }
  }

  async getMemoryEntries(profileId: string, limit = 50): Promise<MemoryEntry[]> {
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE') // Only get active facts, exclude contradictions
        )
      )
      .orderBy(
        desc(memoryEntries.confidence), // Prioritize high confidence
        desc(memoryEntries.supportCount), // Then by support count
        desc(memoryEntries.importance), // Then by importance
        desc(memoryEntries.createdAt) // Finally by recency
      )
      .limit(limit);
  }

  async searchMemoryEntries(profileId: string, query: string): Promise<MemoryEntry[]> {
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE'), // Only search active facts, exclude contradictions
          like(memoryEntries.content, `%${query}%`)
        )
      )
      .orderBy(
        desc(memoryEntries.confidence), // Prioritize high confidence first
        desc(memoryEntries.importance), // Then by importance
        desc(memoryEntries.supportCount), // Then by support count
        desc(memoryEntries.retrievalCount) // Finally by usage frequency
      );
  }

  async deleteMemoryEntry(id: string): Promise<void> {
    await db.delete(memoryEntries).where(eq(memoryEntries.id, id));
  }

  async clearProfileMemories(profileId: string): Promise<void> {
    await db.delete(memoryEntries).where(eq(memoryEntries.profileId, profileId));
  }

  async incrementMemoryRetrieval(id: string): Promise<void> {
    await db
      .update(memoryEntries)
      .set({ retrievalCount: sql`${memoryEntries.retrievalCount} + 1` })
      .where(eq(memoryEntries.id, id));
  }

  async getMemoryStats(profileId: string): Promise<{ totalFacts: number; conversations: number }> {
    // Optimized: Single query with subqueries instead of two separate queries
    const [stats] = await db
      .select({
        totalFacts: sql<number>`(SELECT count(*) FROM memory_entries WHERE profile_id = ${profileId})`,
        conversations: sql<number>`(SELECT count(*) FROM conversations WHERE profile_id = ${profileId})`,
      })
      .from(sql`(SELECT 1) AS dummy`);

    return {
      totalFacts: stats.totalFacts || 0,
      conversations: stats.conversations || 0,
    };
  }

  // Confidence tracking methods implementation
  async findMemoryByCanonicalKey(profileId: string, canonicalKey: string): Promise<MemoryEntry | undefined> {
    const [memory] = await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.canonicalKey, canonicalKey)
        )
      );
    return memory || undefined;
  }

  async updateMemoryConfidence(id: string, confidence: number, supportCount?: number): Promise<MemoryEntry> {
    const updateData: any = { 
      confidence, 
      lastSeenAt: sql`now()`,
      updatedAt: sql`now()` 
    };
    
    if (supportCount !== undefined) {
      updateData.supportCount = supportCount;
    }

    const [updatedMemory] = await db
      .update(memoryEntries)
      .set(updateData)
      .where(eq(memoryEntries.id, id))
      .returning();
    
    return updatedMemory;
  }

  async updateMemoryEntry(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry> {
    const updateData: any = { 
      ...updates,
      updatedAt: sql`now()` 
    };
    
    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;

    const [updatedMemory] = await db
      .update(memoryEntries)
      .set(updateData)
      .where(eq(memoryEntries.id, id))
      .returning();
    
    return updatedMemory;
  }

  async getHighConfidenceMemories(profileId: string, minConfidence: number, limit = 50): Promise<MemoryEntry[]> {
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          sql`${memoryEntries.confidence} >= ${minConfidence}`,
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.confidence), desc(memoryEntries.supportCount), desc(memoryEntries.importance))
      .limit(limit);
  }

  // 🔧 NEW: Confidence range method for medium confidence facts
  async getMemoriesByConfidenceRange(profileId: string, minConfidence: number, maxConfidence: number, limit = 50): Promise<MemoryEntry[]> {
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          sql`${memoryEntries.confidence} >= ${minConfidence}`,
          sql`${memoryEntries.confidence} <= ${maxConfidence}`,
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.confidence), desc(memoryEntries.supportCount), desc(memoryEntries.importance))
      .limit(limit);
  }

  async markFactsAsContradicting(factIds: string[], groupId: string): Promise<void> {
    await db
      .update(memoryEntries)
      .set({ 
        contradictionGroupId: groupId,
        status: 'AMBIGUOUS',
        updatedAt: sql`now()` 
      })
      .where(sql`${memoryEntries.id} = ANY(${factIds})`);
  }

  async updateMemoryStatus(id: string, status: 'ACTIVE' | 'DEPRECATED' | 'AMBIGUOUS'): Promise<MemoryEntry> {
    const [updatedEntry] = await db
      .update(memoryEntries)
      .set({ status, updatedAt: sql`now()` })
      .where(eq(memoryEntries.id, id))
      .returning();
    return updatedEntry;
  }

  async getReliableMemoriesForAI(profileId: string, limit = 100): Promise<MemoryEntry[]> {
    // Get only high-confidence, ACTIVE facts for AI response generation
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE'), // Only active facts
          sql`${memoryEntries.confidence} >= 60` // Minimum 60% confidence
        )
      )
      .orderBy(
        desc(memoryEntries.confidence), // Highest confidence first
        desc(memoryEntries.supportCount), // Then by support
        desc(memoryEntries.importance), // Then by importance
        desc(memoryEntries.lastUsed) // Then by recent usage
      )
      .limit(limit);
  }

  // 🚀 NEW: Enhanced memory retrieval that includes story context for atomic facts
  async getEnrichedMemoriesForAI(profileId: string, limit = 100): Promise<Array<MemoryEntry & { parentStory?: MemoryEntry }>> {
    // Get only high-confidence, ACTIVE facts for AI response generation
    const memories = await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE'), // Only active facts
          sql`${memoryEntries.confidence} >= 60` // Minimum 60% confidence
        )
      )
      .orderBy(
        desc(memoryEntries.confidence), // Highest confidence first
        desc(memoryEntries.supportCount), // Then by support
        desc(memoryEntries.importance), // Then by importance
        desc(memoryEntries.lastUsed) // Then by recent usage
      )
      .limit(limit);

    // Enrich atomic facts with their parent story context
    const enrichedMemories = await Promise.all(
      memories.map(async (memory) => {
        if (memory.isAtomicFact && memory.parentFactId) {
          try {
            const parentStory = await db
              .select()
              .from(memoryEntries)
              .where(eq(memoryEntries.id, memory.parentFactId))
              .limit(1);
            
            return {
              ...memory,
              parentStory: parentStory[0] || undefined
            };
          } catch (error) {
            console.warn(`⚠️ Failed to fetch parent story for atomic fact ${memory.id}:`, error);
            return { ...memory };
          }
        }
        return { ...memory };
      })
    );

    return enrichedMemories;
  }

  // 🚀 ENHANCED: Smart search that extracts keywords and matches partial terms
  async searchEnrichedMemoryEntries(profileId: string, query: string): Promise<Array<MemoryEntry & { parentStory?: MemoryEntry }>> {
    // Extract keywords from the query for better matching
    const cleanQuery = query.toLowerCase();
    const keywords = cleanQuery
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => {
        // Keep numbers (even if short) and words longer than 2 characters
        const isNumber = /^\d+$/.test(word);
        const isLongEnough = word.length > 2;
        const commonWords = ['who', 'what', 'when', 'where', 'why', 'how', 'tell', 'about', 'the', 'and', 'but', 'are', 'you', 'can', 'did', 'know'];
        const isNotCommonWord = !commonWords.includes(word);
        
        return (isNumber || isLongEnough) && isNotCommonWord;
      }); // Preserve episode numbers like "68"!

    console.log(`🔍 Smart search for "${query}" -> Keywords: [${keywords.join(', ')}]`);

    // Build flexible search conditions for each keyword
    const keywordConditions = keywords.map(keyword => 
      or(
        // Search in content (case-insensitive)
        sql`LOWER(${memoryEntries.content}) LIKE ${`%${keyword.toLowerCase()}%`}`,
        // Search in keywords array  
        sql`array_to_string(${memoryEntries.keywords}, ',') ILIKE ${`%${keyword}%`}`
      )
    );

    const memories = await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE'), // Only search active facts, exclude contradictions
          or(
            // Original full-text search for exact matches
            sql`LOWER(${memoryEntries.content}) LIKE ${`%${cleanQuery}%`}`,
            // Smart keyword-based search - match ANY keyword
            keywordConditions.length > 0 ? or(...keywordConditions) : sql`FALSE`
          )
        )
      )
      .orderBy(
        desc(memoryEntries.confidence), // Prioritize high confidence first
        desc(memoryEntries.importance), // Then by importance
        desc(memoryEntries.supportCount), // Then by support count
        desc(memoryEntries.retrievalCount) // Finally by usage frequency
      );

    // Enrich atomic facts with their parent story context
    const enrichedMemories = await Promise.all(
      memories.map(async (memory) => {
        if (memory.isAtomicFact && memory.parentFactId) {
          try {
            const parentStory = await db
              .select()
              .from(memoryEntries)
              .where(eq(memoryEntries.id, memory.parentFactId))
              .limit(1);
            
            return {
              ...memory,
              parentStory: parentStory[0] || undefined
            };
          } catch (error) {
            console.warn(`⚠️ Failed to fetch parent story for atomic fact ${memory.id}:`, error);
            return { ...memory };
          }
        }
        return { ...memory };
      })
    );

    return enrichedMemories;
  }

  // Protected facts implementation
  async addProtectedFact(profileId: string, content: string, importance = 5, keywords: string[] = []): Promise<MemoryEntry> {
    const { generateCanonicalKey } = await import('./utils/canonical.js');
    const canonicalKey = generateCanonicalKey(content);
    
    const protectedFact = await this.addMemoryEntry({
      profileId,
      type: 'FACT' as const,
      content,
      importance,
      keywords,
      source: 'manual',
      confidence: 100, // Maximum confidence for protected facts
      supportCount: 999, // High support count so they're never overridden
      isProtected: true, // Mark as protected
      canonicalKey,
    });
    
    console.log(`🔒 Added protected fact: "${content}"`);
    return protectedFact;
  }

  async getProtectedFacts(profileId: string): Promise<MemoryEntry[]> {
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.isProtected, true),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));
  }

  async getContradictionGroups(profileId: string): Promise<any[]> {
    // Get all facts that have contradiction group IDs
    const contradictedFacts = await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          sql`${memoryEntries.contradictionGroupId} IS NOT NULL`
        )
      )
      .orderBy(desc(memoryEntries.confidence), desc(memoryEntries.createdAt));

    // Group facts by their contradiction group ID
    const groups: { [groupId: string]: MemoryEntry[] } = {};
    
    for (const fact of contradictedFacts) {
      const groupId = fact.contradictionGroupId!;
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push(fact);
    }

    // Convert to contradiction group format
    return Object.entries(groups).map(([groupId, facts]) => {
      // Find the primary fact (highest confidence, ACTIVE status)
      const primaryFact = facts.find(f => f.status === 'ACTIVE') || facts[0];
      const conflictingFacts = facts.filter(f => f.id !== primaryFact.id);
      
      return {
        groupId,
        facts,
        primaryFact,
        conflictingFacts,
        severity: facts.length > 2 ? 'HIGH' : 'MEDIUM',
        explanation: `Contradiction group with ${facts.length} conflicting facts`
      };
    });
  }

  // Chaos State management implementation
  async getChaosState(): Promise<ChaosState | undefined> {
    const [state] = await db
      .select()
      .from(chaosState)
      .where(eq(chaosState.isGlobal, true))
      .limit(1);
    return state;
  }

  async createOrUpdateChaosState(state: InsertChaosState): Promise<ChaosState> {
    // Check if global chaos state already exists
    const existingState = await this.getChaosState();
    
    if (existingState) {
      // Update existing state
      const updateData: any = {
        level: state.level,
        mode: state.mode as 'FULL_PSYCHO' | 'FAKE_PROFESSIONAL' | 'HYPER_FOCUSED' | 'CONSPIRACY',
        lastModeChange: state.lastModeChange,
        responseCount: state.responseCount,
        manualOverride: state.manualOverride,
        updatedAt: sql`now()`
      };
      const [updatedState] = await db
        .update(chaosState)
        .set(updateData)
        .where(eq(chaosState.id, existingState.id))
        .returning();
      return updatedState;
    } else {
      // Create new global state
      const insertData = {
        level: state.level || 0,
        mode: (state.mode || 'FULL_PSYCHO') as 'FULL_PSYCHO' | 'FAKE_PROFESSIONAL' | 'HYPER_FOCUSED' | 'CONSPIRACY',
        lastModeChange: state.lastModeChange || sql`now()`,
        responseCount: state.responseCount || 0,
        manualOverride: state.manualOverride,
        isGlobal: true
      };
      const [newState] = await db
        .insert(chaosState)
        .values([insertData as any])
        .returning();
      return newState;
    }
  }

  // Discord management methods implementation
  async getDiscordServer(serverId: string): Promise<DiscordServer | undefined> {
    const [server] = await db
      .select()
      .from(discordServers)
      .where(eq(discordServers.serverId, serverId));
    return server || undefined;
  }

  async createDiscordServer(server: InsertDiscordServer): Promise<DiscordServer> {
    const [newServer] = await db
      .insert(discordServers)
      .values([server as any])
      .returning();
    return newServer;
  }

  async updateDiscordServer(id: string, updates: Partial<DiscordServer>): Promise<DiscordServer> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedServer] = await db
      .update(discordServers)
      .set(updateData as any)
      .where(eq(discordServers.id, id))
      .returning();
    return updatedServer;
  }

  async getProfileDiscordServers(profileId: string): Promise<DiscordServer[]> {
    return await db
      .select()
      .from(discordServers)
      .where(eq(discordServers.profileId, profileId))
      .orderBy(desc(discordServers.createdAt));
  }

  // Discord member management
  async getDiscordMember(serverId: string, userId: string): Promise<DiscordMember | undefined> {
    const [member] = await db
      .select()
      .from(discordMembers)
      .where(
        and(
          eq(discordMembers.serverId, serverId),
          eq(discordMembers.userId, userId)
        )
      );
    return member || undefined;
  }

  async createDiscordMember(member: InsertDiscordMember): Promise<DiscordMember> {
    const [newMember] = await db
      .insert(discordMembers)
      .values([member as any])
      .returning();
    return newMember;
  }

  async updateDiscordMember(id: string, updates: Partial<DiscordMember>): Promise<DiscordMember> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedMember] = await db
      .update(discordMembers)
      .set(updateData as any)
      .where(eq(discordMembers.id, id))
      .returning();
    return updatedMember;
  }

  async getServerMembers(serverId: string): Promise<DiscordMember[]> {
    // First, find the Discord server record by its Discord server ID
    const server = await this.getDiscordServer(serverId);
    if (!server) {
      return []; // No server found, return empty array
    }

    // Then get members using the server's database primary key
    return await db
      .select()
      .from(discordMembers)
      .where(eq(discordMembers.serverId, server.id))
      .orderBy(desc(discordMembers.lastInteraction));
  }

  // Discord topic triggers
  async getDiscordTopicTriggers(serverId: string): Promise<DiscordTopicTrigger[]> {
    return await db
      .select()
      .from(discordTopicTriggers)
      .where(
        and(
          eq(discordTopicTriggers.serverId, serverId),
          eq(discordTopicTriggers.isActive, true)
        )
      )
      .orderBy(desc(discordTopicTriggers.responseChance));
  }

  async createDiscordTopicTrigger(trigger: InsertDiscordTopicTrigger): Promise<DiscordTopicTrigger> {
    const [newTrigger] = await db
      .insert(discordTopicTriggers)
      .values([trigger as any])
      .returning();
    return newTrigger;
  }

  async updateDiscordTopicTrigger(id: string, updates: Partial<DiscordTopicTrigger>): Promise<DiscordTopicTrigger> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedTrigger] = await db
      .update(discordTopicTriggers)
      .set(updateData as any)
      .where(eq(discordTopicTriggers.id, id))
      .returning();
    return updatedTrigger;
  }

  async deleteDiscordTopicTrigger(id: string): Promise<void> {
    await db.delete(discordTopicTriggers).where(eq(discordTopicTriggers.id, id));
  }

  // Discord conversation logging
  async logDiscordConversation(conversation: InsertDiscordConversation): Promise<DiscordConversation> {
    const [newConversation] = await db
      .insert(discordConversations)
      .values([conversation as any])
      .returning();
    return newConversation;
  }

  async getDiscordConversations(serverId: string, limit: number = 50): Promise<DiscordConversation[]> {
    return await db
      .select()
      .from(discordConversations)
      .where(eq(discordConversations.serverId, serverId))
      .orderBy(desc(discordConversations.createdAt))
      .limit(limit);
  }

  // Automated Sources Management
  async createAutomatedSource(data: InsertAutomatedSource): Promise<AutomatedSource> {
    const [newSource] = await db
      .insert(automatedSources)
      .values([data as any])
      .returning();
    return newSource;
  }

  async getAutomatedSources(profileId: string): Promise<AutomatedSource[]> {
    return await db
      .select()
      .from(automatedSources)
      .where(eq(automatedSources.profileId, profileId))
      .orderBy(desc(automatedSources.createdAt));
  }

  async updateAutomatedSource(id: string, data: Partial<AutomatedSource>): Promise<void> {
    const updateData = { ...data, updatedAt: sql`now()` };
    await db
      .update(automatedSources)
      .set(updateData as any)
      .where(eq(automatedSources.id, id));
  }

  async toggleAutomatedSource(id: string, isActive: boolean): Promise<void> {
    await db
      .update(automatedSources)
      .set({ isActive, updatedAt: sql`now()` })
      .where(eq(automatedSources.id, id));
  }

  // Pending Content Management
  async createPendingContent(data: InsertPendingContent): Promise<PendingContent> {
    const [newContent] = await db
      .insert(pendingContent)
      .values([data as any])
      .returning();
    return newContent;
  }

  async getPendingContent(profileId: string, processed?: boolean): Promise<PendingContent[]> {
    const conditions = [eq(pendingContent.profileId, profileId)];
    
    if (processed !== undefined) {
      conditions.push(eq(pendingContent.processed, processed));
    }
    
    return await db
      .select()
      .from(pendingContent)
      .where(and(...conditions))
      .orderBy(desc(pendingContent.extractedAt));
  }

  async approvePendingContent(id: string): Promise<void> {
    await db
      .update(pendingContent)
      .set({ 
        approved: true, 
        processed: true, 
        processedAt: sql`now()` 
      })
      .where(eq(pendingContent.id, id));
  }

  async rejectPendingContent(id: string, reason: string): Promise<void> {
    await db
      .update(pendingContent)
      .set({ 
        approved: false, 
        processed: true, 
        processedAt: sql`now()`,
        rejectionReason: reason
      })
      .where(eq(pendingContent.id, id));
  }

  async getPendingContentById(id: string): Promise<PendingContent | null> {
    const [content] = await db
      .select()
      .from(pendingContent)
      .where(eq(pendingContent.id, id));
    return content || null;
  }

  // Ad Template Management
  async createAdTemplate(data: InsertAdTemplate): Promise<AdTemplate> {
    const [newTemplate] = await db
      .insert(adTemplates)
      .values([data as any])
      .returning();
    return newTemplate;
  }

  async getAdTemplates(): Promise<AdTemplate[]> {
    return await db
      .select()
      .from(adTemplates)
      .orderBy(desc(adTemplates.createdAt));
  }

  async updateAdTemplate(id: string, data: Partial<AdTemplate>): Promise<void> {
    const updateData = { ...data, updatedAt: sql`now()` };
    await db
      .update(adTemplates)
      .set(updateData as any)
      .where(eq(adTemplates.id, id));
  }

  // Preroll Ad Management
  async createPrerollAd(data: InsertPrerollAd): Promise<PrerollAd> {
    const [newAd] = await db
      .insert(prerollAds)
      .values([data as any])
      .returning();
    return newAd;
  }

  async getPrerollAds(profileId: string, options: {
    category?: string;
    limit?: number;
    includeUsed?: boolean;
  } = {}): Promise<PrerollAd[]> {
    const conditions = [eq(prerollAds.profileId, profileId)];
    
    if (options.category) {
      conditions.push(eq(prerollAds.category, options.category));
    }
    
    if (!options.includeUsed) {
      conditions.push(eq(prerollAds.lastUsed, sql`NULL`));
    }
    
    let query = db
      .select()
      .from(prerollAds)
      .where(and(...conditions))
      .orderBy(desc(prerollAds.generatedAt));
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    return await query;
  }

  async updatePrerollAd(id: string, data: Partial<PrerollAd>): Promise<void> {
    const updateData = { ...data, updatedAt: sql`now()` };
    await db
      .update(prerollAds)
      .set(updateData as any)
      .where(eq(prerollAds.id, id));
  }

  async getPrerollAdById(id: string): Promise<PrerollAd | null> {
    const [ad] = await db
      .select()
      .from(prerollAds)
      .where(eq(prerollAds.id, id));
    return ad || null;
  }

  async listPrerollAds(profileId: string): Promise<PrerollAd[]> {
    return await db
      .select()
      .from(prerollAds)
      .where(eq(prerollAds.profileId, profileId))
      .orderBy(desc(prerollAds.generatedAt));
  }

  async updatePrerollAd(id: string, updates: Partial<PrerollAd>): Promise<PrerollAd> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedAd] = await db
      .update(prerollAds)
      .set(updateData as any)
      .where(eq(prerollAds.id, id))
      .returning();
    return updatedAd;
  }

  async deletePrerollAd(id: string): Promise<void> {
    await db.delete(prerollAds).where(eq(prerollAds.id, id));
  }

  // Podcast Management Implementation
  async createPodcastEpisode(episode: InsertPodcastEpisode): Promise<PodcastEpisode> {
    const [newEpisode] = await db
      .insert(podcastEpisodes)
      .values([episode as any])
      .returning();
    return newEpisode;
  }

  async getPodcastEpisode(id: string): Promise<PodcastEpisode | undefined> {
    const [episode] = await db
      .select()
      .from(podcastEpisodes)
      .where(eq(podcastEpisodes.id, id));
    return episode || undefined;
  }

  async getPodcastEpisodeByNumber(profileId: string, episodeNumber: number): Promise<PodcastEpisode | undefined> {
    const [episode] = await db
      .select()
      .from(podcastEpisodes)
      .where(
        and(
          eq(podcastEpisodes.profileId, profileId),
          eq(podcastEpisodes.episodeNumber, episodeNumber)
        )
      );
    return episode || undefined;
  }

  async listPodcastEpisodes(profileId: string): Promise<PodcastEpisode[]> {
    return await db
      .select()
      .from(podcastEpisodes)
      .where(eq(podcastEpisodes.profileId, profileId))
      .orderBy(desc(podcastEpisodes.episodeNumber));
  }

  async updatePodcastEpisode(id: string, updates: Partial<PodcastEpisode>): Promise<PodcastEpisode> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedEpisode] = await db
      .update(podcastEpisodes)
      .set(updateData as any)
      .where(eq(podcastEpisodes.id, id))
      .returning();
    return updatedEpisode;
  }

  async deletePodcastEpisode(id: string): Promise<void> {
    // Delete associated segments first
    await db.delete(podcastSegments).where(eq(podcastSegments.episodeId, id));
    // Then delete the episode
    await db.delete(podcastEpisodes).where(eq(podcastEpisodes.id, id));
  }

  async createPodcastSegment(segment: InsertPodcastSegment): Promise<PodcastSegment> {
    const [newSegment] = await db
      .insert(podcastSegments)
      .values([segment as any])
      .returning();
    return newSegment;
  }

  async getPodcastSegment(id: string): Promise<PodcastSegment | undefined> {
    const [segment] = await db
      .select()
      .from(podcastSegments)
      .where(eq(podcastSegments.id, id));
    return segment || undefined;
  }

  async getEpisodeSegments(episodeId: string): Promise<PodcastSegment[]> {
    return await db
      .select()
      .from(podcastSegments)
      .where(eq(podcastSegments.episodeId, episodeId))
      .orderBy(podcastSegments.startTime);
  }

  async updatePodcastSegment(id: string, updates: Partial<PodcastSegment>): Promise<PodcastSegment> {
    const [updatedSegment] = await db
      .update(podcastSegments)
      .set(updates as any)
      .where(eq(podcastSegments.id, id))
      .returning();
    return updatedSegment;
  }

  async deletePodcastSegment(id: string): Promise<void> {
    await db.delete(podcastSegments).where(eq(podcastSegments.id, id));
  }

  async clearPodcastSegments(episodeId: string): Promise<void> {
    await db.delete(podcastSegments).where(eq(podcastSegments.episodeId, episodeId));
  }

  async searchPodcastContent(profileId: string, query: string): Promise<{ episodes: PodcastEpisode[]; segments: PodcastSegment[] }> {
    // Search episodes by title, description, topics, highlights, or transcript
    const episodes = await db
      .select()
      .from(podcastEpisodes)
      .where(
        and(
          eq(podcastEpisodes.profileId, profileId),
          or(
            like(podcastEpisodes.title, `%${query}%`),
            like(podcastEpisodes.description, `%${query}%`),
            like(podcastEpisodes.transcript, `%${query}%`)
          )
        )
      )
      .orderBy(desc(podcastEpisodes.episodeNumber));

    // Search segments by title, description, transcript, or key quotes
    const segments = await db
      .select()
      .from(podcastSegments)
      .innerJoin(podcastEpisodes, eq(podcastSegments.episodeId, podcastEpisodes.id))
      .where(
        and(
          eq(podcastEpisodes.profileId, profileId),
          or(
            like(podcastSegments.title, `%${query}%`),
            like(podcastSegments.description, `%${query}%`),
            like(podcastSegments.transcript, `%${query}%`)
          )
        )
      )
      .orderBy(podcastSegments.startTime);

    return { episodes, segments: segments.map(s => s.podcast_segments) };
  }

  // Memory/RAG Integration for Podcast Content
  async getRelevantPodcastContent(profileId: string, keywords: string[]): Promise<{
    episodes: PodcastEpisode[];
    segments: PodcastSegment[];
  }> {
    if (keywords.length === 0) {
      return { episodes: [], segments: [] };
    }

    // Create a simple search pattern for each keyword
    const searchPattern = keywords.join(' | ');
    
    try {
      // Search episodes using a simpler approach
      const episodes = await db
        .select()
        .from(podcastEpisodes)
        .where(
          and(
            eq(podcastEpisodes.profileId, profileId),
            or(
              like(podcastEpisodes.title, `%${searchPattern}%`),
              like(podcastEpisodes.description, `%${searchPattern}%`),
              like(podcastEpisodes.transcript, `%${searchPattern}%`)
            )
          )
        )
        .orderBy(desc(podcastEpisodes.episodeNumber))
        .limit(5);

      // Search segments using a simpler approach
      const segments = await db
        .select()
        .from(podcastSegments)
        .innerJoin(podcastEpisodes, eq(podcastSegments.episodeId, podcastEpisodes.id))
        .where(
          and(
            eq(podcastEpisodes.profileId, profileId),
            or(
              like(podcastSegments.title, `%${searchPattern}%`),
              like(podcastSegments.description, `%${searchPattern}%`),
              like(podcastSegments.transcript, `%${searchPattern}%`)
            )
          )
        )
        .orderBy(podcastSegments.startTime)
        .limit(10);

      return { 
        episodes, 
        segments: segments.map(s => s.podcast_segments) 
      };
    } catch (error) {
      console.error('Error retrieving podcast content:', error);
      // Return empty results on error to prevent chat failures
      return { episodes: [], segments: [] };
    }
  }
}

export const storage = new DatabaseStorage();
