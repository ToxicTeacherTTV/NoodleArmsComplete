import { 
  profiles, 
  conversations, 
  messages, 
  documents, 
  memoryEntries,
  contentLibrary,
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
  topicEscalation,
  // NEW: Entity tables
  entitySystemConfig,
  people,
  places,
  events,
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
  type ContentLibraryEntry,
  type InsertContentLibraryEntry,
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
  type InsertPodcastSegment,
  type TopicEscalation,
  type InsertTopicEscalation,
  // NEW: Entity types
  type EntitySystemConfig,
  type InsertEntitySystemConfig,
  type Person,
  type InsertPerson,
  type Place,
  type InsertPlace,
  type Event,
  type InsertEvent
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
  updateMessageRating(messageId: string, rating: number): Promise<void>;
  getRecentMessages(conversationId: string, limit: number): Promise<Message[]>;
  
  // Enhanced memory persistence methods
  updateConversationContent(id: string, updates: {
    contentType?: 'PODCAST' | 'STREAMING' | 'DISCORD' | 'GENERAL';
    topicTags?: string[];
    completedStories?: string[];
    podcastEpisodeId?: string;
    storyContext?: string;
  }): Promise<Conversation>;
  getPodcastConversations(profileId: string, limit?: number): Promise<Conversation[]>;
  getConversationsByContentType(profileId: string, contentType: 'PODCAST' | 'STREAMING' | 'DISCORD' | 'GENERAL', limit?: number): Promise<Conversation[]>;
  searchConversationsByTopics(profileId: string, topics: string[], limit?: number): Promise<Conversation[]>;
  getCompletedStories(profileId: string): Promise<{conversationId: string; stories: string[]}[]>;

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
  
  // Embedding support for memory entries
  getMemoryEntriesWithEmbeddings(profileId: string): Promise<MemoryEntry[]>;
  getMemoryEntriesWithoutEmbeddings(profileId: string): Promise<MemoryEntry[]>;
  updateMemoryEmbedding(id: string, embedding: {embedding: string, embeddingModel: string, embeddingUpdatedAt: Date}): Promise<void>;
  searchMemoriesByKeywords(profileId: string, keywords: string[], limit?: number): Promise<MemoryEntry[]>;
  
  // Confidence tracking methods
  findMemoryByCanonicalKey(profileId: string, canonicalKey: string): Promise<MemoryEntry | undefined>;
  updateMemoryConfidence(id: string, confidence: number, supportCount?: number): Promise<MemoryEntry>;
  updateMemoryEntry(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry>;
  getHighConfidenceMemories(profileId: string, minConfidence: number, limit?: number): Promise<MemoryEntry[]>;
  getMemoriesByConfidenceRange(profileId: string, minConfidence: number, maxConfidence: number, limit?: number): Promise<MemoryEntry[]>;
  
  // 📖 NEW: Podcast-aware memory retrieval
  getPodcastAwareMemories(profileId: string, mode?: string, limit?: number): Promise<Array<MemoryEntry & { parentStory?: MemoryEntry, isPodcastContent?: boolean }>>;
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
  
  // Content Library management
  createContentLibraryEntry(entry: InsertContentLibraryEntry): Promise<ContentLibraryEntry>;
  getContentLibraryEntry(id: string): Promise<ContentLibraryEntry | undefined>;
  getProfileContentLibrary(profileId: string, category?: string): Promise<ContentLibraryEntry[]>;
  updateContentLibraryEntry(id: string, updates: Partial<ContentLibraryEntry>): Promise<ContentLibraryEntry>;
  deleteContentLibraryEntry(id: string): Promise<void>;
  searchContentLibrary(profileId: string, query: string): Promise<ContentLibraryEntry[]>;
  updateContentLibraryAccess(id: string): Promise<void>;
  
  // Embedding support for content library
  getContentLibraryWithEmbeddings(profileId: string): Promise<ContentLibraryEntry[]>;
  getContentLibraryWithoutEmbeddings(profileId: string): Promise<ContentLibraryEntry[]>;
  updateContentLibraryEmbedding(id: string, embedding: {embedding: string, embeddingModel: string, embeddingUpdatedAt: Date}): Promise<void>;
  getContentLibraryEntries(profileId: string): Promise<ContentLibraryEntry[]>;

  // Topic Escalation System
  trackTopicMention(profileId: string, topic: string, context: string): Promise<TopicEscalation>;
  getTopicEscalation(profileId: string, topic: string): Promise<TopicEscalation | undefined>;
  getTopicEscalations(profileId: string): Promise<TopicEscalation[]>;
  getHighIntensityTopics(profileId: string, minIntensity?: number): Promise<TopicEscalation[]>;
  updateTopicIntensity(id: string, newIntensity: number): Promise<TopicEscalation>;
  coolDownTopics(profileId: string): Promise<void>;

  // NEW: Entity System Management (Phase 1)
  // Feature flag management
  getEntitySystemConfig(): Promise<EntitySystemConfig | undefined>;
  setEntitySystemEnabled(enabled: boolean): Promise<EntitySystemConfig>;
  
  // Entity CRUD operations (all optional for backward compatibility)
  createPerson(person: InsertPerson): Promise<Person>;
  getPerson(id: string): Promise<Person | undefined>;
  getProfilePeople(profileId: string): Promise<Person[]>;
  updatePerson(id: string, updates: Partial<Person>): Promise<Person>;
  deletePerson(id: string): Promise<void>;
  
  createPlace(place: InsertPlace): Promise<Place>;
  getPlace(id: string): Promise<Place | undefined>;
  getProfilePlaces(profileId: string): Promise<Place[]>;
  updatePlace(id: string, updates: Partial<Place>): Promise<Place>;
  deletePlace(id: string): Promise<void>;
  
  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: string): Promise<Event | undefined>;
  getProfileEvents(profileId: string): Promise<Event[]>;
  updateEvent(id: string, updates: Partial<Event>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;
  
  // Entity linking for memory entries (optional)
  linkMemoryToEntities(memoryId: string, entityLinks: {
    personId?: string;
    placeId?: string;
    eventId?: string;
  }): Promise<MemoryEntry>;
  getMemoryWithEntityLinks(profileId: string, limit?: number): Promise<Array<MemoryEntry & {
    person?: Person;
    place?: Place;
    event?: Event;
  }>>;
  
  // Get memories for specific entities
  getMemoriesForPerson(personId: string, profileId: string): Promise<MemoryEntry[]>;
  getMemoriesForPlace(placeId: string, profileId: string): Promise<MemoryEntry[]>;
  getMemoriesForEvent(eventId: string, profileId: string): Promise<MemoryEntry[]>;
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
      .values([conversation as any])
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

  async updateMessageRating(messageId: string, rating: number): Promise<void> {
    await db
      .update(messages)
      .set({ rating })
      .where(eq(messages.id, messageId));
  }

  async getRecentMessages(conversationId: string, limit: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  // Enhanced memory persistence method implementations
  async updateConversationContent(id: string, updates: {
    contentType?: 'PODCAST' | 'STREAMING' | 'DISCORD' | 'GENERAL';
    topicTags?: string[];
    completedStories?: string[];
    podcastEpisodeId?: string;
    storyContext?: string;
  }): Promise<Conversation> {
    const [updatedConversation] = await db
      .update(conversations)
      .set(updates)
      .where(eq(conversations.id, id))
      .returning();
    return updatedConversation;
  }

  async updateConversationTitle(id: string, title: string): Promise<Conversation> {
    const [updated] = await db.update(conversations)
      .set({ title })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  async getPodcastConversations(profileId: string, limit = 50): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.profileId, profileId),
        eq(conversations.contentType, 'PODCAST')
      ))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);
  }

  async getConversationsByContentType(profileId: string, contentType: 'PODCAST' | 'STREAMING' | 'DISCORD' | 'GENERAL', limit = 50): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.profileId, profileId),
        eq(conversations.contentType, contentType)
      ))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);
  }

  async searchConversationsByTopics(profileId: string, topics: string[], limit = 50): Promise<Conversation[]> {
    // Use array overlap operator to find conversations with matching topics
    return await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.profileId, profileId),
        sql`${conversations.topicTags} && ${topics}` // PostgreSQL array overlap operator
      ))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);
  }

  async listWebConversations(profileId: string, limit = 50): Promise<Array<Conversation & { messageCount: number; firstMessage?: string }>> {
    // Get non-Discord conversations (GENERAL, PODCAST, STREAMING)
    const convos = await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.profileId, profileId),
        or(
          eq(conversations.contentType, 'GENERAL'),
          eq(conversations.contentType, 'PODCAST'),
          eq(conversations.contentType, 'STREAMING')
        )
      ))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);

    // Get message counts and first message for each conversation
    const conversationsWithMeta = await Promise.all(
      convos.map(async (convo) => {
        const msgs = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, convo.id))
          .orderBy(messages.createdAt)
          .limit(1);
        
        const messageCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(eq(messages.conversationId, convo.id));

        return {
          ...convo,
          title: convo.title, // Include AI-generated title
          messageCount: Number(messageCount[0]?.count || 0),
          firstMessage: msgs[0]?.content
        };
      })
    );

    // Filter out empty conversations (no messages)
    return conversationsWithMeta.filter(convo => convo.messageCount > 0);
  }

  async getCompletedStories(profileId: string): Promise<{conversationId: string; stories: string[]}[]> {
    const conversationsWithStories = await db
      .select({
        conversationId: conversations.id,
        completedStories: conversations.completedStories
      })
      .from(conversations)
      .where(and(
        eq(conversations.profileId, profileId),
        sql`array_length(${conversations.completedStories}, 1) > 0` // Only conversations with completed stories
      ))
      .orderBy(desc(conversations.createdAt));

    return conversationsWithStories.map(row => ({
      conversationId: row.conversationId,
      stories: row.completedStories || []
    }));
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
        name: documents.name,
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
    if (!query || query.trim().length === 0) return [];
    
    // Use PostgreSQL full-text search with ranking
    return await db
      .select({
        id: memoryEntries.id,
        profileId: memoryEntries.profileId,
        type: memoryEntries.type,
        content: memoryEntries.content,
        importance: memoryEntries.importance,
        retrievalCount: memoryEntries.retrievalCount,
        successRate: memoryEntries.successRate,
        lastUsed: memoryEntries.lastUsed,
        clusterId: memoryEntries.clusterId,
        keywords: memoryEntries.keywords,
        relationships: memoryEntries.relationships,
        qualityScore: memoryEntries.qualityScore,
        temporalContext: memoryEntries.temporalContext,
        source: memoryEntries.source,
        confidence: memoryEntries.confidence,
        sourceId: memoryEntries.sourceId,
        supportCount: memoryEntries.supportCount,
        firstSeenAt: memoryEntries.firstSeenAt,
        lastSeenAt: memoryEntries.lastSeenAt,
        contradictionGroupId: memoryEntries.contradictionGroupId,
        canonicalKey: memoryEntries.canonicalKey,
        status: memoryEntries.status,
        isProtected: memoryEntries.isProtected,
        parentFactId: memoryEntries.parentFactId,
        isAtomicFact: memoryEntries.isAtomicFact,
        storyContext: memoryEntries.storyContext,
        embedding: memoryEntries.embedding,
        embeddingModel: memoryEntries.embeddingModel,
        embeddingUpdatedAt: memoryEntries.embeddingUpdatedAt,
        searchVector: memoryEntries.searchVector,
        // NEW: Entity linking fields
        personId: memoryEntries.personId,
        placeId: memoryEntries.placeId,
        eventId: memoryEntries.eventId,
        createdAt: memoryEntries.createdAt,
        updatedAt: memoryEntries.updatedAt,
        // Add relevance score from full-text search
        relevance: sql<number>`ts_rank(${memoryEntries.searchVector}, plainto_tsquery('english', ${query}))`.as('relevance')
      })
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE'),
          sql`${memoryEntries.searchVector} @@ plainto_tsquery('english', ${query})`
        )
      )
      .orderBy(
        sql`ts_rank(${memoryEntries.searchVector}, plainto_tsquery('english', ${query})) DESC`,
        desc(memoryEntries.confidence),
        desc(memoryEntries.importance),
        desc(memoryEntries.supportCount)
      )
      .limit(50); // Limit results for performance
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
    
    if (!updatedMemory) {
      throw new Error(`Memory entry with ID ${id} not found`);
    }
    
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

  // 📖 NEW: Podcast-aware memory retrieval that prioritizes podcast content
  async getPodcastAwareMemories(profileId: string, mode?: string, limit = 100): Promise<Array<MemoryEntry & { parentStory?: MemoryEntry, isPodcastContent?: boolean }>> {
    const isPodcastMode = mode === 'PODCAST';
    
    // Get memories with enhanced context
    const baseMemories = await this.getEnrichedMemoriesForAI(profileId, limit * 2);
    
    // If not in podcast mode, return regular enriched memories
    if (!isPodcastMode) {
      return baseMemories.map(memory => ({ ...memory, isPodcastContent: false }));
    }
    
    // In podcast mode, prioritize podcast-related content
    const podcastMemories: Array<MemoryEntry & { parentStory?: MemoryEntry, isPodcastContent?: boolean }> = [];
    const generalMemories: Array<MemoryEntry & { parentStory?: MemoryEntry, isPodcastContent?: boolean }> = [];
    
    for (const memory of baseMemories) {
      const isPodcastContent = this.isPodcastRelatedMemory(memory);
      const enhancedMemory = { ...memory, isPodcastContent };
      
      if (isPodcastContent) {
        podcastMemories.push(enhancedMemory);
      } else {
        generalMemories.push(enhancedMemory);
      }
    }
    
    // Return podcast memories first, then fill with general memories
    const combinedMemories = [...podcastMemories, ...generalMemories];
    return combinedMemories.slice(0, limit);
  }
  
  // Helper method to identify podcast-related memories
  private isPodcastRelatedMemory(memory: MemoryEntry): boolean {
    const podcastKeywords = [
      'podcast', 'episode', 'streaming', 'twitch', 'youtube', 
      'chat', 'audience', 'viewer', 'subscriber', 'content',
      'story', 'tale', 'told', 'sharing', 'explain', 'talked about',
      'discussion', 'topic', 'segment', 'show', 'broadcast'
    ];
    
    const content = memory.content.toLowerCase();
    const source = (memory.source || '').toLowerCase();
    
    // Check if memory content contains podcast-related keywords
    const hasKeywords = podcastKeywords.some(keyword => 
      content.includes(keyword) || source.includes(keyword)
    );
    
    // Check if memory type suggests podcast content
    const isPodcastType = memory.type === 'LORE' || memory.type === 'STORY';
    
    // Check if source indicates podcast origin
    const isPodcastSource = source.includes('conversation') || source.includes('chat') || source.includes('episode');
    
    return hasKeywords || isPodcastType || isPodcastSource;
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
    
    const query = db
      .select()
      .from(prerollAds)
      .where(and(...conditions))
      .orderBy(desc(prerollAds.generatedAt));
    
    if (options.limit) {
      return await query.limit(options.limit);
    }
    
    return await query;
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

  // Content Library implementation
  async createContentLibraryEntry(entry: InsertContentLibraryEntry): Promise<ContentLibraryEntry> {
    const [newEntry] = await db
      .insert(contentLibrary)
      .values([entry as any])
      .returning();
    return newEntry;
  }

  async getContentLibraryEntry(id: string): Promise<ContentLibraryEntry | undefined> {
    const [entry] = await db.select().from(contentLibrary).where(eq(contentLibrary.id, id));
    return entry || undefined;
  }

  async getProfileContentLibrary(profileId: string, category?: string): Promise<ContentLibraryEntry[]> {
    const whereConditions = [eq(contentLibrary.profileId, profileId)];
    if (category) {
      whereConditions.push(eq(contentLibrary.category, category as any));
    }
    
    return await db
      .select()
      .from(contentLibrary)
      .where(and(...whereConditions))
      .orderBy(desc(contentLibrary.createdAt));
  }

  async updateContentLibraryEntry(id: string, updates: Partial<ContentLibraryEntry>): Promise<ContentLibraryEntry> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedEntry] = await db
      .update(contentLibrary)
      .set(updateData as any)
      .where(eq(contentLibrary.id, id))
      .returning();
    return updatedEntry;
  }

  async deleteContentLibraryEntry(id: string): Promise<void> {
    await db.delete(contentLibrary).where(eq(contentLibrary.id, id));
  }

  async searchContentLibrary(profileId: string, query: string): Promise<ContentLibraryEntry[]> {
    return await db
      .select()
      .from(contentLibrary)
      .where(
        and(
          eq(contentLibrary.profileId, profileId),
          or(
            like(contentLibrary.title, `%${query}%`),
            like(contentLibrary.content, `%${query}%`),
            sql`${contentLibrary.tags} && ARRAY[${query}]` // PostgreSQL array overlap
          )
        )
      )
      .orderBy(desc(contentLibrary.lastAccessed), desc(contentLibrary.createdAt))
      .limit(20);
  }

  async updateContentLibraryAccess(id: string): Promise<void> {
    await db
      .update(contentLibrary)
      .set({ 
        lastAccessed: sql`now()`,
        accessCount: sql`${contentLibrary.accessCount} + 1`
      })
      .where(eq(contentLibrary.id, id));
  }

  // Embedding support implementations
  async getMemoryEntriesWithEmbeddings(profileId: string): Promise<MemoryEntry[]> {
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          sql`${memoryEntries.embedding} IS NOT NULL`,
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.confidence));
  }

  async getMemoryEntriesWithoutEmbeddings(profileId: string): Promise<MemoryEntry[]> {
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          sql`${memoryEntries.embedding} IS NULL`,
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance));
  }

  async updateMemoryEmbedding(id: string, embedding: {embedding: string, embeddingModel: string, embeddingUpdatedAt: Date}): Promise<void> {
    await db
      .update(memoryEntries)
      .set({
        embedding: embedding.embedding,
        embeddingModel: embedding.embeddingModel,
        embeddingUpdatedAt: embedding.embeddingUpdatedAt
      })
      .where(eq(memoryEntries.id, id));
  }

  async searchMemoriesByKeywords(profileId: string, keywords: string[], limit = 20): Promise<MemoryEntry[]> {
    if (keywords.length === 0) return [];
    
    // Combine keywords into a single search query for PostgreSQL full-text search
    const searchQuery = keywords.join(' | '); // OR search for any keyword
    
    return await db
      .select({
        id: memoryEntries.id,
        profileId: memoryEntries.profileId,
        type: memoryEntries.type,
        content: memoryEntries.content,
        importance: memoryEntries.importance,
        retrievalCount: memoryEntries.retrievalCount,
        successRate: memoryEntries.successRate,
        lastUsed: memoryEntries.lastUsed,
        clusterId: memoryEntries.clusterId,
        keywords: memoryEntries.keywords,
        relationships: memoryEntries.relationships,
        qualityScore: memoryEntries.qualityScore,
        temporalContext: memoryEntries.temporalContext,
        source: memoryEntries.source,
        confidence: memoryEntries.confidence,
        sourceId: memoryEntries.sourceId,
        supportCount: memoryEntries.supportCount,
        firstSeenAt: memoryEntries.firstSeenAt,
        lastSeenAt: memoryEntries.lastSeenAt,
        contradictionGroupId: memoryEntries.contradictionGroupId,
        canonicalKey: memoryEntries.canonicalKey,
        status: memoryEntries.status,
        isProtected: memoryEntries.isProtected,
        parentFactId: memoryEntries.parentFactId,
        isAtomicFact: memoryEntries.isAtomicFact,
        storyContext: memoryEntries.storyContext,
        embedding: memoryEntries.embedding,
        embeddingModel: memoryEntries.embeddingModel,
        embeddingUpdatedAt: memoryEntries.embeddingUpdatedAt,
        searchVector: memoryEntries.searchVector,
        // NEW: Entity linking fields
        personId: memoryEntries.personId,
        placeId: memoryEntries.placeId,
        eventId: memoryEntries.eventId,
        createdAt: memoryEntries.createdAt,
        updatedAt: memoryEntries.updatedAt,
        relevance: sql<number>`ts_rank(${memoryEntries.searchVector}, to_tsquery('english', ${searchQuery}))`.as('relevance')
      })
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE'),
          sql`${memoryEntries.searchVector} @@ to_tsquery('english', ${searchQuery})`
        )
      )
      .orderBy(
        sql`ts_rank(${memoryEntries.searchVector}, to_tsquery('english', ${searchQuery})) DESC`,
        desc(memoryEntries.importance),
        desc(memoryEntries.confidence)
      )
      .limit(limit);
  }

  async getContentLibraryWithEmbeddings(profileId: string): Promise<ContentLibraryEntry[]> {
    return await db
      .select()
      .from(contentLibrary)
      .where(
        and(
          eq(contentLibrary.profileId, profileId),
          sql`${contentLibrary.embedding} IS NOT NULL`
        )
      )
      .orderBy(desc(contentLibrary.updatedAt));
  }

  async getContentLibraryWithoutEmbeddings(profileId: string): Promise<ContentLibraryEntry[]> {
    return await db
      .select()
      .from(contentLibrary)
      .where(
        and(
          eq(contentLibrary.profileId, profileId),
          sql`${contentLibrary.embedding} IS NULL`
        )
      )
      .orderBy(desc(contentLibrary.updatedAt));
  }

  async updateContentLibraryEmbedding(id: string, embedding: {embedding: string, embeddingModel: string, embeddingUpdatedAt: Date}): Promise<void> {
    await db
      .update(contentLibrary)
      .set({
        embedding: embedding.embedding,
        embeddingModel: embedding.embeddingModel,
        embeddingUpdatedAt: embedding.embeddingUpdatedAt
      })
      .where(eq(contentLibrary.id, id));
  }

  async getContentLibraryEntries(profileId: string): Promise<ContentLibraryEntry[]> {
    return await db
      .select()
      .from(contentLibrary)
      .where(eq(contentLibrary.profileId, profileId))
      .orderBy(desc(contentLibrary.updatedAt));
  }

  // Topic Escalation System Implementation
  async trackTopicMention(profileId: string, topic: string, context: string): Promise<TopicEscalation> {
    const normalizedTopic = topic.toLowerCase().trim();
    
    // Check if topic already exists
    const existingTopic = await this.getTopicEscalation(profileId, topic);
    
    if (existingTopic) {
      // Escalate existing topic
      const newMentionCount = (existingTopic.mentionCount || 0) + 1;
      const currentIntensity = existingTopic.currentIntensity || 15;
      const escalationRate = existingTopic.escalationRate || 15;
      const newIntensity = Math.min(100, currentIntensity + escalationRate);
      const newMaxIntensity = Math.max(existingTopic.maxIntensity || 15, newIntensity);
      
      // Update contexts array (keep last 5 contexts)
      const updatedContexts = [context, ...(existingTopic.contexts || [])].slice(0, 5);
      
      // Check if it's becoming personal (intensity > 60)
      const isPersonal = newIntensity > 60;
      const familyHonorInvolved = newIntensity > 85; // Family honor threshold
      
      const [updatedTopic] = await db
        .update(topicEscalation)
        .set({
          mentionCount: newMentionCount,
          currentIntensity: newIntensity,
          maxIntensity: newMaxIntensity,
          lastMentioned: sql`now()`,
          contexts: updatedContexts,
          isPersonal,
          familyHonorInvolved,
          updatedAt: sql`now()`
        })
        .where(eq(topicEscalation.id, existingTopic.id))
        .returning();
      
      return updatedTopic;
    } else {
      // Create new topic escalation
      const [newTopic] = await db
        .insert(topicEscalation)
        .values({
          profileId,
          topic,
          normalizedTopic,
          mentionCount: 1,
          currentIntensity: 15, // Starting intensity
          maxIntensity: 15,
          contexts: [context],
          relatedKeywords: [],
          emotionalTriggers: []
        })
        .returning();
      
      return newTopic;
    }
  }

  async getTopicEscalation(profileId: string, topic: string): Promise<TopicEscalation | undefined> {
    const normalizedTopic = topic.toLowerCase().trim();
    const [escalation] = await db
      .select()
      .from(topicEscalation)
      .where(and(
        eq(topicEscalation.profileId, profileId),
        eq(topicEscalation.normalizedTopic, normalizedTopic)
      ));
    
    return escalation || undefined;
  }

  async getTopicEscalations(profileId: string): Promise<TopicEscalation[]> {
    return await db
      .select()
      .from(topicEscalation)
      .where(eq(topicEscalation.profileId, profileId))
      .orderBy(desc(topicEscalation.currentIntensity), desc(topicEscalation.lastMentioned));
  }

  async getHighIntensityTopics(profileId: string, minIntensity = 60): Promise<TopicEscalation[]> {
    return await db
      .select()
      .from(topicEscalation)
      .where(and(
        eq(topicEscalation.profileId, profileId),
        sql`${topicEscalation.currentIntensity} >= ${minIntensity}`
      ))
      .orderBy(desc(topicEscalation.currentIntensity));
  }

  async updateTopicIntensity(id: string, newIntensity: number): Promise<TopicEscalation> {
    const [updatedTopic] = await db
      .update(topicEscalation)
      .set({
        currentIntensity: Math.max(0, Math.min(100, newIntensity)),
        updatedAt: sql`now()`
      })
      .where(eq(topicEscalation.id, id))
      .returning();
    
    return updatedTopic;
  }

  async coolDownTopics(profileId: string): Promise<void> {
    // Cool down all topics by their cooling rate (natural decay over time)
    await db
      .update(topicEscalation)
      .set({
        currentIntensity: sql`GREATEST(0, ${topicEscalation.currentIntensity} - ${topicEscalation.coolingRate})`,
        updatedAt: sql`now()`
      })
      .where(eq(topicEscalation.profileId, profileId));
  }

  // ===== NEW: Entity System Implementation (Phase 1) =====
  
  // Feature flag management
  async getEntitySystemConfig(): Promise<EntitySystemConfig | undefined> {
    const [config] = await db.select().from(entitySystemConfig).limit(1);
    return config || undefined;
  }

  async setEntitySystemEnabled(enabled: boolean): Promise<EntitySystemConfig> {
    const existing = await this.getEntitySystemConfig();
    
    if (existing) {
      const [updated] = await db
        .update(entitySystemConfig)
        .set({ isEnabled: enabled, updatedAt: sql`now()` })
        .where(eq(entitySystemConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [newConfig] = await db
        .insert(entitySystemConfig)
        .values({ isEnabled: enabled })
        .returning();
      return newConfig;
    }
  }
  
  // Person management
  async createPerson(person: InsertPerson): Promise<Person> {
    const [newPerson] = await db
      .insert(people)
      .values([person as any])
      .returning();
    return newPerson;
  }

  async getPerson(id: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, id));
    return person || undefined;
  }

  async getProfilePeople(profileId: string): Promise<Person[]> {
    return await db
      .select()
      .from(people)
      .where(eq(people.profileId, profileId))
      .orderBy(desc(people.createdAt));
  }

  async updatePerson(id: string, updates: Partial<Person>): Promise<Person> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedPerson] = await db
      .update(people)
      .set(updateData as any)
      .where(eq(people.id, id))
      .returning();
    return updatedPerson;
  }

  async deletePerson(id: string): Promise<void> {
    await db.delete(people).where(eq(people.id, id));
  }

  async mergePeople(primaryId: string, duplicateId: string, mergedData?: Partial<Person>): Promise<Person> {
    // Get both entities
    const primary = await this.getPerson(primaryId);
    const duplicate = await this.getPerson(duplicateId);
    
    if (!primary || !duplicate) {
      throw new Error('One or both people not found');
    }

    // Update all memories that reference the duplicate to reference the primary
    await db
      .update(memoryEntries)
      .set({ personId: primaryId })
      .where(eq(memoryEntries.personId, duplicateId));

    // Use provided mergedData if available, otherwise auto-merge
    let updateData: Partial<Person>;
    if (mergedData) {
      // User has edited the merge, use their data
      updateData = {
        canonicalName: mergedData.canonicalName || primary.canonicalName,
        disambiguation: mergedData.disambiguation,
        aliases: mergedData.aliases || [],
        relationship: mergedData.relationship,
        description: mergedData.description
      };
    } else {
      // Auto-merge logic
      const primaryAliases = Array.isArray(primary.aliases) ? primary.aliases : [];
      const duplicateAliases = Array.isArray(duplicate.aliases) ? duplicate.aliases : [];
      const mergedAliases = Array.from(new Set([
        ...primaryAliases,
        ...duplicateAliases,
        duplicate.canonicalName // Add the duplicate's name as an alias
      ]));

      const mergedDescription = [primary.description, duplicate.description]
        .filter(Boolean)
        .join(' | ');

      updateData = {
        aliases: mergedAliases,
        description: mergedDescription || primary.description
      };
    }

    // Update primary with merged data
    const updated = await this.updatePerson(primaryId, updateData);

    // Delete the duplicate
    await this.deletePerson(duplicateId);

    return updated;
  }
  
  // Place management
  async createPlace(place: InsertPlace): Promise<Place> {
    const [newPlace] = await db
      .insert(places)
      .values([place as any])
      .returning();
    return newPlace;
  }

  async getPlace(id: string): Promise<Place | undefined> {
    const [place] = await db.select().from(places).where(eq(places.id, id));
    return place || undefined;
  }

  async getProfilePlaces(profileId: string): Promise<Place[]> {
    return await db
      .select()
      .from(places)
      .where(eq(places.profileId, profileId))
      .orderBy(desc(places.createdAt));
  }

  async updatePlace(id: string, updates: Partial<Place>): Promise<Place> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedPlace] = await db
      .update(places)
      .set(updateData as any)
      .where(eq(places.id, id))
      .returning();
    return updatedPlace;
  }

  async deletePlace(id: string): Promise<void> {
    await db.delete(places).where(eq(places.id, id));
  }

  async mergePlaces(primaryId: string, duplicateId: string, mergedData?: Partial<Place>): Promise<Place> {
    const primary = await this.getPlace(primaryId);
    const duplicate = await this.getPlace(duplicateId);
    
    if (!primary || !duplicate) {
      throw new Error('One or both places not found');
    }

    // Update all memories that reference the duplicate
    await db
      .update(memoryEntries)
      .set({ placeId: primaryId })
      .where(eq(memoryEntries.placeId, duplicateId));

    // Use provided mergedData if available, otherwise auto-merge
    let updateData: Partial<Place>;
    if (mergedData) {
      updateData = {
        canonicalName: mergedData.canonicalName || primary.canonicalName,
        locationType: mergedData.locationType,
        description: mergedData.description
      };
    } else {
      // Auto-merge logic
      const mergedDescription = [primary.description, duplicate.description]
        .filter(Boolean)
        .join(' | ');

      updateData = {
        description: mergedDescription || primary.description
      };
    }

    const updated = await this.updatePlace(primaryId, updateData);

    await this.deletePlace(duplicateId);
    return updated;
  }
  
  // Event management
  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db
      .insert(events)
      .values([event as any])
      .returning();
    return newEvent;
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  async getProfileEvents(profileId: string): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(eq(events.profileId, profileId))
      .orderBy(desc(events.createdAt));
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<Event> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedEvent] = await db
      .update(events)
      .set(updateData as any)
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async mergeEvents(primaryId: string, duplicateId: string, mergedData?: Partial<Event>): Promise<Event> {
    const primary = await this.getEvent(primaryId);
    const duplicate = await this.getEvent(duplicateId);
    
    if (!primary || !duplicate) {
      throw new Error('One or both events not found');
    }

    // Update all memories that reference the duplicate
    await db
      .update(memoryEntries)
      .set({ eventId: primaryId })
      .where(eq(memoryEntries.eventId, duplicateId));

    // Use provided mergedData if available, otherwise auto-merge
    let updateData: Partial<Event>;
    if (mergedData) {
      updateData = {
        canonicalName: mergedData.canonicalName || primary.canonicalName,
        eventDate: mergedData.eventDate,
        isCanonical: mergedData.isCanonical,
        description: mergedData.description
      };
    } else {
      // Auto-merge logic
      const mergedDescription = [primary.description, duplicate.description]
        .filter(Boolean)
        .join(' | ');

      updateData = {
        description: mergedDescription || primary.description
      };
    }

    const updated = await this.updateEvent(primaryId, updateData);

    await this.deleteEvent(duplicateId);
    return updated;
  }

  async getAllEntities(profileId: string): Promise<{
    people: Person[];
    places: Place[];
    events: Event[];
  }> {
    const [peopleList, placesList, eventsList] = await Promise.all([
      this.getProfilePeople(profileId),
      this.getProfilePlaces(profileId),
      this.getProfileEvents(profileId),
    ]);
    
    return {
      people: peopleList,
      places: placesList,
      events: eventsList,
    };
  }
  
  // Entity linking for memory entries
  async linkMemoryToEntities(memoryId: string, entityLinks: {
    personId?: string;
    placeId?: string;
    eventId?: string;
  }): Promise<MemoryEntry> {
    const updateData: any = { updatedAt: sql`now()` };
    
    // Validate that entity IDs exist before linking
    if (entityLinks.personId) {
      const person = await this.getPerson(entityLinks.personId);
      if (person) {
        updateData.personId = entityLinks.personId;
      } else {
        console.warn(`⚠️ Person ID ${entityLinks.personId} not found, skipping link`);
      }
    }
    
    if (entityLinks.placeId) {
      const place = await this.getPlace(entityLinks.placeId);
      if (place) {
        updateData.placeId = entityLinks.placeId;
      } else {
        console.warn(`⚠️ Place ID ${entityLinks.placeId} not found, skipping link`);
      }
    }
    
    if (entityLinks.eventId) {
      const event = await this.getEvent(entityLinks.eventId);
      if (event) {
        updateData.eventId = entityLinks.eventId;
      } else {
        console.warn(`⚠️ Event ID ${entityLinks.eventId} not found, skipping link`);
      }
    }
    
    const [updatedMemory] = await db
      .update(memoryEntries)
      .set(updateData)
      .where(eq(memoryEntries.id, memoryId))
      .returning();
    return updatedMemory;
  }

  async getMemoryWithEntityLinks(profileId: string, limit = 50): Promise<Array<MemoryEntry & {
    person?: Person;
    place?: Place;
    event?: Event;
  }>> {
    const results = await db
      .select({
        memory: memoryEntries,
        person: people,
        place: places,
        event: events,
      })
      .from(memoryEntries)
      .leftJoin(people, eq(memoryEntries.personId, people.id))
      .leftJoin(places, eq(memoryEntries.placeId, places.id))
      .leftJoin(events, eq(memoryEntries.eventId, events.id))
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt))
      .limit(limit);

    return results.map(row => ({
      ...row.memory,
      person: row.person || undefined,
      place: row.place || undefined,
      event: row.event || undefined,
    }));
  }

  // Get memories for specific entities
  async getMemoriesForPerson(personId: string, profileId: string): Promise<MemoryEntry[]> {
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.personId, personId),
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));
  }

  async getMemoriesForPlace(placeId: string, profileId: string): Promise<MemoryEntry[]> {
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.placeId, placeId),
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));
  }

  async getMemoriesForEvent(eventId: string, profileId: string): Promise<MemoryEntry[]> {
    return await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.eventId, eventId),
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));
  }
}

export const storage = new DatabaseStorage();
