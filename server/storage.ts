import { memoryCaches } from './services/memoryCache';
import { suggestionService } from './services/suggestionService.js';
import { perfMetrics } from './services/performanceMetrics';
import {
  profiles,
  conversations,
  messages,
  documents,
  consolidatedPersonalities,
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
  concepts,
  items,
  miscEntities,
  // Junction tables for many-to-many relationships
  memoryPeopleLinks,
  memoryPlaceLinks,
  memoryEventLinks,
  memoryConceptLinks,
  memoryItemLinks,
  memoryMiscLinks,
  type Profile,
  type InsertProfile,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Document,
  type InsertDocument,
  type ConsolidatedPersonality,
  type InsertConsolidatedPersonality,
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
  type InsertEvent,
  type Concept,
  type InsertConcept,
  type Item,
  type InsertItem,
  type MiscEntity,
  type InsertMiscEntity
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, ilike, sql, gt } from "drizzle-orm";
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
  getMessage(id: string): Promise<Message | undefined>;
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
  getCompletedStories(profileId: string): Promise<{ conversationId: string; stories: string[] }[]>;
  listWebConversations(profileId: string): Promise<Conversation[]>;

  // Document management
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getProfileDocuments(profileId: string): Promise<Document[]>;
  getTrainingExamples(profileId: string): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  incrementDocumentRetrieval(id: string): Promise<void>;

  // Consolidated Personality management
  createConsolidatedPersonality(consolidation: InsertConsolidatedPersonality): Promise<ConsolidatedPersonality>;
  getConsolidatedPersonality(id: string): Promise<ConsolidatedPersonality | undefined>;
  getPendingConsolidations(profileId: string): Promise<ConsolidatedPersonality[]>;
  updateConsolidationStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<ConsolidatedPersonality>;
  deleteConsolidatedPersonality(id: string): Promise<void>;

  // Memory management
  addMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry>;
  getMemoryEntries(profileId: string, limit?: number): Promise<MemoryEntry[]>;
  searchMemoryEntries(profileId: string, query: string): Promise<MemoryEntry[]>;
  getMemoryEntriesBySource(profileId: string, source: string, sourceId?: string): Promise<MemoryEntry[]>;
  deleteMemoryEntry(id: string): Promise<void>;
  clearProfileMemories(profileId: string): Promise<void>;
  incrementMemoryRetrieval(id: string): Promise<void>;
  getMemoryStats(profileId: string): Promise<{ totalFacts: number; conversations: number }>;

  // Embedding support for memory entries
  findSimilarMemories(profileId: string, queryVector: number[], limit?: number, threshold?: number): Promise<Array<MemoryEntry & { similarity: number }>>;
  getMemoryEntriesWithEmbeddings(profileId: string): Promise<MemoryEntry[]>;
  getRecentMemoriesWithEmbeddings(profileId: string, limit: number): Promise<MemoryEntry[]>;
  getMemoryEntriesWithoutEmbeddings(profileId: string): Promise<MemoryEntry[]>;
  updateMemoryEmbedding(id: string, embedding: { embedding: number[], embeddingModel: string, embeddingUpdatedAt: Date }): Promise<void>;
  searchMemoriesByKeywords(profileId: string, keywords: string[], limit?: number): Promise<MemoryEntry[]>;

  // Query memories by source (e.g., podcast episode, document)
  getMemoriesBySource(profileId: string, sourceId: string, source?: string): Promise<MemoryEntry[]>;

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

  // Memory/RAG Integration for Podcast Content
  getRelevantPodcastContent(profileId: string, keywords: string[]): Promise<{
    episodes: PodcastEpisode[];
    segments: PodcastSegment[];
  }>;

  // Content Library implementation
  createContentLibraryEntry(entry: InsertContentLibraryEntry): Promise<ContentLibraryEntry>;
  getContentLibraryEntry(id: string): Promise<ContentLibraryEntry | undefined>;
  getProfileContentLibrary(profileId: string, category?: string): Promise<ContentLibraryEntry[]>;
  updateContentLibraryEntry(id: string, updates: Partial<ContentLibraryEntry>): Promise<ContentLibraryEntry>;
  deleteContentLibraryEntry(id: string): Promise<void>;
  searchContentLibrary(profileId: string, query: string): Promise<ContentLibraryEntry[]>;
  updateContentLibraryAccess(id: string): Promise<void>;

  // NEW: Entity System Management (Phase 1)
  // Feature flag management
  getEntitySystemConfig(): Promise<EntitySystemConfig | undefined>;
  setEntitySystemEnabled(enabled: boolean): Promise<EntitySystemConfig>;

  // Entity CRUD operations
  createPerson(person: InsertPerson): Promise<Person>;
  getPerson(id: string): Promise<Person | undefined>;
  getProfilePeople(profileId: string): Promise<Person[]>;
  updatePerson(id: string, updates: Partial<Person>): Promise<Person>;
  deletePerson(id: string): Promise<void>;
  mergePeople(primaryId: string, duplicateId: string, mergedData?: Partial<Person>): Promise<Person>;

  createPlace(place: InsertPlace): Promise<Place>;
  getPlace(id: string): Promise<Place | undefined>;
  getProfilePlaces(profileId: string): Promise<Place[]>;
  updatePlace(id: string, updates: Partial<Place>): Promise<Place>;
  deletePlace(id: string): Promise<void>;
  mergePlaces(primaryId: string, duplicateId: string, mergedData?: Partial<Place>): Promise<Place>;

  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: string): Promise<Event | undefined>;
  getProfileEvents(profileId: string): Promise<Event[]>;
  updateEvent(id: string, updates: Partial<Event>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;
  mergeEvents(primaryId: string, duplicateId: string, mergedData?: Partial<Event>): Promise<Event>;

  createConcept(concept: InsertConcept): Promise<Concept>;
  getConcept(id: string): Promise<Concept | undefined>;
  getProfileConcepts(profileId: string): Promise<Concept[]>;
  updateConcept(id: string, updates: Partial<Concept>): Promise<Concept>;
  deleteConcept(id: string): Promise<void>;

  createItem(item: InsertItem): Promise<Item>;
  getItem(id: string): Promise<Item | undefined>;
  getProfileItems(profileId: string): Promise<Item[]>;
  updateItem(id: string, updates: Partial<Item>): Promise<Item>;
  deleteItem(id: string): Promise<void>;

  createMiscEntity(misc: InsertMiscEntity): Promise<MiscEntity>;
  getMiscEntity(id: string): Promise<MiscEntity | undefined>;
  getProfileMiscEntities(profileId: string): Promise<MiscEntity[]>;
  updateMiscEntity(id: string, updates: Partial<MiscEntity>): Promise<MiscEntity>;
  deleteMiscEntity(id: string): Promise<void>;

  getAllEntities(profileId: string): Promise<{
    people: Person[];
    places: Place[];
    events: Event[];
    concepts: Concept[];
    items: Item[];
    misc: MiscEntity[];
  }>;

  // Entity linking for memory entries (updated to use junction tables)
  linkMemoryToEntities(memoryId: string, entityLinks: {
    personIds?: string[];
    placeIds?: string[];
    eventIds?: string[];
    conceptIds?: string[];
    itemIds?: string[];
    miscIds?: string[];
  }): Promise<void>;
  getMemoryWithEntityLinks(profileId: string, limit?: number): Promise<Array<MemoryEntry & {
    people?: Person[];
    places?: Place[];
    events?: Event[];
    concepts?: Concept[];
    items?: Item[];
    misc?: MiscEntity[];
  }>>;

  // Get memories for specific entities
  getMemoriesForPerson(personId: string, profileId: string): Promise<MemoryEntry[]>;
  getMemoriesForPlace(placeId: string, profileId: string): Promise<MemoryEntry[]>;
  getMemoriesForEvent(eventId: string, profileId: string): Promise<MemoryEntry[]>;
  getMemoriesForConcept(conceptId: string, profileId: string): Promise<MemoryEntry[]>;
  getMemoriesForItem(itemId: string, profileId: string): Promise<MemoryEntry[]>;
  getMemoriesForMiscEntity(miscId: string, profileId: string): Promise<MemoryEntry[]>;
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

  async getConversationById(id: string): Promise<Conversation | undefined> {
    return this.getConversation(id);
  }

  async updateConversationArchiveStatus(id: string, isArchived: boolean): Promise<Conversation> {
    const [updated] = await db
      .update(conversations)
      .set({ isArchived })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    return message || undefined;
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

  async listWebConversations(profileId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.profileId, profileId),
        eq(conversations.isArchived, false)
      ))
      .orderBy(desc(conversations.createdAt));
  }

  async searchConversationsByTopics(profileId: string, topics: string[], limit = 50): Promise<Conversation[]> {
    // Use array overlap operator to find conversations with matching topics
    return await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.profileId, profileId),
        // Check if topicTags overlaps with provided topics
        sql`${conversations.topicTags} && ${topics}::text[]`
      ))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);
  }

  async getCompletedStories(profileId: string): Promise<{ conversationId: string; stories: string[] }[]> {
    const results = await db
      .select({
        conversationId: conversations.id,
        completedStories: conversations.completedStories
      })
      .from(conversations)
      .where(and(
        eq(conversations.profileId, profileId),
        sql`array_length(${conversations.completedStories}, 1) > 0`
      ))
      .orderBy(desc(conversations.createdAt));

    return results.map(row => ({
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
    // Optimized: Select all columns and limit to recent documents
    return await db
      .select()
      .from(documents)
      .where(eq(documents.profileId, profileId))
      .orderBy(desc(documents.createdAt))
      .limit(50); // Limit to most recent 50 documents
  }

  async getTrainingExamples(profileId: string, limit?: number): Promise<Document[]> {
    // 📚 OPTIMIZED: Reduced from 50 to 40 for faster Gemini 2.5 Pro processing
    // 🚀 OPTIMIZATION: Allow custom limit for streaming mode (10 vs 40)
    const targetLimit = limit || 40; // Reduced from 50
    const candidateLimit = Math.min(targetLimit * 2, 100); // Get 2x candidates for sampling

    // Smart sampling: Get candidates, then mix recent + sampled older examples
    const allExamples = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.profileId, profileId),
          eq(documents.documentType, 'TRAINING_EXAMPLE'),
          eq(documents.processingStatus, 'COMPLETED')
        )
      )
      .orderBy(desc(documents.createdAt))
      .limit(candidateLimit);

    if (allExamples.length <= targetLimit) {
      return allExamples; // If we have targetLimit or fewer, return all
    }

    // Mix of recent (60%) and sampled older (40%) for variety
    const recentCount = Math.floor(targetLimit * 0.6);
    const olderCount = targetLimit - recentCount;

    const recent = allExamples.slice(0, recentCount);
    const older = allExamples.slice(recentCount);

    // Random sample from older set
    const sampledOlder = older
      .sort(() => Math.random() - 0.5)
      .slice(0, olderCount);

    return [...recent, ...sampledOlder];
  }

  async createConsolidatedPersonality(consolidation: InsertConsolidatedPersonality): Promise<ConsolidatedPersonality> {
    const [result] = await db.insert(consolidatedPersonalities).values([consolidation as any]).returning();
    return result;
  }

  async getConsolidatedPersonality(id: string): Promise<ConsolidatedPersonality | undefined> {
    const [result] = await db
      .select()
      .from(consolidatedPersonalities)
      .where(eq(consolidatedPersonalities.id, id));
    return result;
  }

  async getPendingConsolidations(profileId: string): Promise<ConsolidatedPersonality[]> {
    return await db
      .select()
      .from(consolidatedPersonalities)
      .where(
        and(
          eq(consolidatedPersonalities.profileId, profileId),
          eq(consolidatedPersonalities.status, 'PENDING')
        )
      )
      .orderBy(desc(consolidatedPersonalities.createdAt));
  }

  async updateConsolidationStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<ConsolidatedPersonality> {
    const [result] = await db
      .update(consolidatedPersonalities)
      .set({ status, updatedAt: new Date() })
      .where(eq(consolidatedPersonalities.id, id))
      .returning();
    return result;
  }

  async deleteConsolidatedPersonality(id: string): Promise<void> {
    await db.delete(consolidatedPersonalities).where(eq(consolidatedPersonalities.id, id));
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
    }

    // 🌟 NEW: Vector-based duplicate detection (BEFORE insert)
    // This catches semantic duplicates that text-based canonicalKey misses
    if (finalEntry.content && finalEntry.profileId) {
      try {
        const { memoryDeduplicator } = await import('./services/memoryDeduplicator.js');
        const duplicateCheck = await memoryDeduplicator.handleDuplicateDetection(
          finalEntry.profileId,
          finalEntry.content
        );

        if (duplicateCheck.action === 'block') {
          // Near-exact duplicate (95%+) - don't create, just update existing
          console.log(`🚫 ${duplicateCheck.reason} - skipping creation`);
          const existingId = duplicateCheck.duplicates[0].id;
          const existing = await db.select().from(memoryEntries).where(eq(memoryEntries.id, existingId)).limit(1);
          if (existing.length > 0) {
            // Update confidence and support count on existing memory
            const [updated] = await db
              .update(memoryEntries)
              .set({
                confidence: sql`LEAST(100, ${existing[0].confidence || 50} + 10)`,
                supportCount: sql`${existing[0].supportCount || 1} + 1`,
                lastSeenAt: sql`now()`,
                updatedAt: sql`now()`
              })
              .where(eq(memoryEntries.id, existingId))
              .returning();

            console.log(`🔄 Boosted existing memory instead: confidence ${updated.confidence}, support ${updated.supportCount}`);
            return updated;
          }
        } else if (duplicateCheck.action === 'flag') {
          // Very similar (90-95%) - log warning but allow creation
          console.log(`⚠️ ${duplicateCheck.reason}`);
          console.log(`  Existing: "${duplicateCheck.duplicates[0].content.substring(0, 60)}..."`);
          console.log(`  New:      "${finalEntry.content.substring(0, 60)}..."`);
          // Continue with normal insert but note the similarity
        }
        // If action === 'allow', continue normally
      } catch (error) {
        // Don't block memory creation if duplicate detection fails
        console.warn('⚠️ Vector duplicate detection failed, continuing with insert:', error);
      }
    }

    // 🔒 ATOMIC UPSERT: Insert or update on conflict (prevents race conditions)
    const [upsertedEntry] = await db
      .insert(memoryEntries)
      .values([finalEntry as any])
      .onConflictDoUpdate({
        target: [memoryEntries.profileId, memoryEntries.canonicalKey],
        set: {
          // === Counter updates ===
          // Increment confidence (max 100)
          confidence: sql`LEAST(100, COALESCE(${memoryEntries.confidence}, 50) + 10)`,
          // Increment support count
          supportCount: sql`COALESCE(${memoryEntries.supportCount}, 1) + 1`,

          // === Metadata updates (preserve existing values if new ones are null) ===
          type: sql`COALESCE(EXCLUDED.type, ${memoryEntries.type})`,
          content: sql`COALESCE(EXCLUDED.content, ${memoryEntries.content})`,
          importance: sql`GREATEST(COALESCE(${memoryEntries.importance}, 0), COALESCE(EXCLUDED.importance, 0))`,
          source: sql`COALESCE(EXCLUDED.source, ${memoryEntries.source})`,
          sourceId: sql`COALESCE(EXCLUDED.source_id, ${memoryEntries.sourceId})`,
          status: sql`COALESCE(EXCLUDED.status, ${memoryEntries.status})`,
          isProtected: sql`COALESCE(EXCLUDED.is_protected, ${memoryEntries.isProtected})`,

          // === Quality & clustering metadata ===
          qualityScore: sql`COALESCE(EXCLUDED.quality_score, ${memoryEntries.qualityScore})`,
          temporalContext: sql`COALESCE(EXCLUDED.temporal_context, ${memoryEntries.temporalContext})`,
          clusterId: sql`COALESCE(EXCLUDED.cluster_id, ${memoryEntries.clusterId})`,
          contradictionGroupId: sql`COALESCE(EXCLUDED.contradiction_group_id, ${memoryEntries.contradictionGroupId})`,

          // === Usage metrics (cumulative - don't overwrite with new values) ===
          retrievalCount: sql`${memoryEntries.retrievalCount}`, // Keep existing count, don't reset
          successRate: sql`COALESCE(${memoryEntries.successRate}, EXCLUDED.success_rate)`, // Preserve existing rate
          lastUsed: sql`COALESCE(${memoryEntries.lastUsed}, EXCLUDED.last_used)`, // Keep most recent usage

          // === Hierarchical fact fields (preserve existing if new is null) ===
          parentFactId: sql`COALESCE(EXCLUDED.parent_fact_id, ${memoryEntries.parentFactId})`,
          isAtomicFact: sql`COALESCE(EXCLUDED.is_atomic_fact, ${memoryEntries.isAtomicFact})`,
          storyContext: sql`COALESCE(EXCLUDED.story_context, ${memoryEntries.storyContext})`,

          // === Semantic/embedding fields (preserve existing if new is null) ===
          embedding: sql`COALESCE(EXCLUDED.embedding, ${memoryEntries.embedding})`,
          embeddingModel: sql`COALESCE(EXCLUDED.embedding_model, ${memoryEntries.embeddingModel})`,
          embeddingUpdatedAt: sql`COALESCE(EXCLUDED.embedding_updated_at, ${memoryEntries.embeddingUpdatedAt})`,

          // === Array merging (keywords, relationships) ===
          keywords: sql`ARRAY(SELECT DISTINCT unnest(COALESCE(${memoryEntries.keywords}, ARRAY[]::text[]) || COALESCE(EXCLUDED.keywords, ARRAY[]::text[])))`,
          relationships: sql`ARRAY(SELECT DISTINCT unnest(COALESCE(${memoryEntries.relationships}, ARRAY[]::text[]) || COALESCE(EXCLUDED.relationships, ARRAY[]::text[])))`,

          // === Temporal fields (preserve firstSeenAt, update others) ===
          lastSeenAt: sql`now()`,
          updatedAt: sql`now()`,
          // Note: firstSeenAt is preserved from original entry
        }
      })
      .returning();

    // 🚀 CACHE: Invalidate caches for this profile
    memoryCaches.warm.invalidatePattern(`enriched_memories:${entry.profileId}`);
    memoryCaches.warm.invalidatePattern(`search_memories:${entry.profileId}`);

    // Log what happened
    if (upsertedEntry.supportCount && upsertedEntry.supportCount > 1) {
      console.log(`🔄 Updated existing memory: "${upsertedEntry.content.substring(0, 50)}..." (support: ${upsertedEntry.supportCount}, confidence: ${upsertedEntry.confidence})`);
    } else {
      console.log(`✅ Created new memory: "${upsertedEntry.content.substring(0, 50)}..." (canonical: ${upsertedEntry.canonicalKey})`);
    }

    // AI-Assisted Flagging: DISABLED - Hitting rate limits during bulk extractions
    // 🕵️ SHADOW TAGGING: Generate suggestions in background (Zero-Interference)
    if (upsertedEntry.content && upsertedEntry.profileId) {
      this.generateSuggestionsBackground(upsertedEntry);
    }

    // 🔢 AUTO-GENERATE EMBEDDINGS: Create vector embeddings in background
    if (upsertedEntry.content && !upsertedEntry.embedding) {
      // Generate embedding asynchronously (don't block memory creation)
      this.generateEmbeddingBackground(upsertedEntry.id, upsertedEntry.content);
    }

    return upsertedEntry;
  }

  /**
   * Background task to generate suggestions for new memories (Shadow Mode)
   */
  private async generateSuggestionsBackground(memory: MemoryEntry): Promise<void> {
    try {
      await suggestionService.generateSuggestions(
        memory.id,
        memory.content,
        memory.profileId
      );
    } catch (error) {
      console.error(`❌ Error generating suggestions for memory ${memory.id}:`, error);
    }
  }

  /**
   * Background task to generate vector embeddings for new memories
   */
  private async generateEmbeddingBackground(memoryId: string, content: string): Promise<void> {
    try {
      console.log(`🔢 Auto-generating embedding for memory: ${memoryId}`);

      const { embeddingService } = await import('./services/embeddingService.js');
      const success = await embeddingService.embedMemoryEntry(memoryId, content);

      if (success) {
        console.log(`✅ Embedding generated successfully for memory ${memoryId}`);
      }
    } catch (error) {
      // Don't throw - this is a background task and shouldn't fail memory creation
      console.error(`❌ Error generating embedding for memory ${memoryId}:`, error);
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
        createdAt: memoryEntries.createdAt,
        updatedAt: memoryEntries.updatedAt,
        searchVector: memoryEntries.searchVector,
        // Add relevance score from full-text search
        relevance: sql`ts_rank(${memoryEntries.searchVector}, plainto_tsquery('english', ${query}))`.as('relevance')
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

  async getMemoryEntriesBySource(profileId: string, source: string, sourceId?: string): Promise<MemoryEntry[]> {
    const conditions = [
      eq(memoryEntries.profileId, profileId),
      eq(memoryEntries.source, source),
      eq(memoryEntries.status, 'ACTIVE')
    ];

    if (sourceId) {
      conditions.push(eq(memoryEntries.sourceId, sourceId));
    }

    return await db
      .select()
      .from(memoryEntries)
      .where(and(...conditions))
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));
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
        totalFacts: sql`(SELECT count(*) FROM memory_entries WHERE profile_id = ${profileId})`.mapWith(Number),
        conversations: sql`(SELECT count(*) FROM conversations WHERE profile_id = ${profileId})`.mapWith(Number),
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
    const endTimer = perfMetrics.startTimer('getEnrichedMemoriesForAI');

    // 🚀 CACHE: Check cache first
    const cacheKey = `enriched_memories:${profileId}:${limit}`;
    const cached = memoryCaches.warm.get(cacheKey);
    if (cached) {
      endTimer();
      console.log(`⚡ Cache HIT for enriched memories (${profileId})`);
      return cached;
    }

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

    // 🚀 OPTIMIZED: Batch fetch parent stories to avoid N+1 queries
    const parentFactIds = memories
      .filter(m => m.isAtomicFact && m.parentFactId)
      .map(m => m.parentFactId!)
      .filter((id, index, self) => self.indexOf(id) === index); // unique IDs only

    let parentStoriesMap = new Map<string, any>();

    if (parentFactIds.length > 0) {
      try {
        const parentStories = await db
          .select()
          .from(memoryEntries)
          .where(sql`${memoryEntries.id} IN (${sql.join(parentFactIds.map(id => sql`${id}`), sql`, `)})`);

        parentStories.forEach(story => {
          parentStoriesMap.set(story.id, story);
        });

        console.log(`📦 Batch fetched ${parentStories.length} parent stories for getEnrichedMemoriesForAI`);
      } catch (error) {
        console.warn(`⚠️ Failed to batch fetch parent stories:`, error);
      }
    }

    // Enrich atomic facts with their parent story context (no additional queries needed)
    const enrichedMemories = memories.map(memory => {
      if (memory.isAtomicFact && memory.parentFactId) {
        const parentStory = parentStoriesMap.get(memory.parentFactId);
        return {
          ...memory,
          parentStory: parentStory || undefined
        };
      }
      return { ...memory };
    });

    // 🚀 CACHE: Store result for future use
    memoryCaches.warm.set(cacheKey, enrichedMemories);

    const duration = endTimer();
    perfMetrics.log('getEnrichedMemoriesForAI', duration, { profileId, resultCount: enrichedMemories.length });

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

    // 🚀 OPTIMIZED: Batch fetch parent stories to avoid N+1 queries
    const parentFactIds = memories
      .filter(m => m.isAtomicFact && m.parentFactId)
      .map(m => m.parentFactId!)
      .filter((id, index, self) => self.indexOf(id) === index); // unique IDs only

    let parentStoriesMap = new Map<string, any>();

    if (parentFactIds.length > 0) {
      try {
        const parentStories = await db
          .select()
          .from(memoryEntries)
          .where(sql`${memoryEntries.id} IN (${sql.join(parentFactIds.map(id => sql`${id}`), sql`, `)})`);

        parentStories.forEach(story => {
          parentStoriesMap.set(story.id, story);
        });

        console.log(`📦 Batch fetched ${parentStories.length} parent stories for searchEnrichedMemoryEntries`);
      } catch (error) {
        console.warn(`⚠️ Failed to batch fetch parent stories:`, error);
      }
    }

    // Enrich atomic facts with their parent story context (no additional queries needed)
    const enrichedMemories = memories.map(memory => {
      if (memory.isAtomicFact && memory.parentFactId) {
        const parentStory = parentStoriesMap.get(memory.parentFactId);
        return {
          ...memory,
          parentStory: parentStory || undefined
        };
      }
      return { ...memory };
    });

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
  }

  async getRecentMemoriesWithEmbeddings(profileId: string, limit: number): Promise<MemoryEntry[]> {
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
      .orderBy(desc(memoryEntries.createdAt))
      .limit(limit);
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

  async updateMemoryEmbedding(id: string, embedding: { embedding: number[], embeddingModel: string, embeddingUpdatedAt: Date }): Promise<void> {
    await db
      .update(memoryEntries)
      .set({
        embedding: embedding.embedding,
        embeddingModel: embedding.embeddingModel,
        embeddingUpdatedAt: embedding.embeddingUpdatedAt
      })
      .where(eq(memoryEntries.id, id));
  }

  async findSimilarMemories(profileId: string, queryVector: number[], limit = 5, threshold = 0.5): Promise<Array<MemoryEntry & { similarity: number }>> {
    // Calculate similarity score: 1 - (cosine distance)
    const similarity = sql<number>`1 - (${memoryEntries.embedding} <=> ${JSON.stringify(queryVector)})`;
    
    // 🧠 HYBRID RANKING SCORE:
    // 1. Base: Vector Similarity (0.0 - 1.0)
    // 2. Boost: Importance (1-5) -> gives up to 25% boost
    // 3. Penalty: Retrieval Count -> reduces score for overused facts
    // Formula: Similarity * (1 + Importance/20) / (1 + RetrievalCount/50)
    const rankingScore = sql<number>`
      (1 - (${memoryEntries.embedding} <=> ${JSON.stringify(queryVector)})) 
      * (1 + (${memoryEntries.importance}::float / 20.0))
      / (1 + (${memoryEntries.retrievalCount}::float / 50.0))
    `;
    
    // @ts-ignore - Drizzle type inference might struggle with the dynamic selection
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
        createdAt: memoryEntries.createdAt,
        updatedAt: memoryEntries.updatedAt,
        similarity: similarity.as('similarity')
      })
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          gt(similarity, threshold),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(rankingScore)) // 🚀 Sort by Hybrid Score instead of raw similarity
      .limit(limit);
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

  async updateContentLibraryEmbedding(id: string, embedding: { embedding: string, embeddingModel: string, embeddingUpdatedAt: Date }): Promise<void> {
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

    // Update all memory links that reference the duplicate to reference the primary
    const duplicateLinks = await db
      .select({ id: memoryPeopleLinks.id, memoryId: memoryPeopleLinks.memoryId })
      .from(memoryPeopleLinks)
      .where(eq(memoryPeopleLinks.personId, duplicateId));

    if (duplicateLinks.length > 0) {
      const newLinks = duplicateLinks.map((link) => ({
        memoryId: link.memoryId,
        personId: primaryId,
      }));

      if (newLinks.length > 0) {
        await db.insert(memoryPeopleLinks).values(newLinks).onConflictDoNothing();
      }

      await db.delete(memoryPeopleLinks).where(eq(memoryPeopleLinks.personId, duplicateId));
    }

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

    // Update all memory links that reference the duplicate
    const duplicateLinks = await db
      .select({ id: memoryPlaceLinks.id, memoryId: memoryPlaceLinks.memoryId })
      .from(memoryPlaceLinks)
      .where(eq(memoryPlaceLinks.placeId, duplicateId));

    if (duplicateLinks.length > 0) {
      const newLinks = duplicateLinks.map((link) => ({
        memoryId: link.memoryId,
        placeId: primaryId,
      }));

      if (newLinks.length > 0) {
        await db.insert(memoryPlaceLinks).values(newLinks).onConflictDoNothing();
      }

      await db.delete(memoryPlaceLinks).where(eq(memoryPlaceLinks.placeId, duplicateId));
    }

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

    // Update all memory links that reference the duplicate
    const duplicateLinks = await db
      .select({ id: memoryEventLinks.id, memoryId: memoryEventLinks.memoryId })
      .from(memoryEventLinks)
      .where(eq(memoryEventLinks.eventId, duplicateId));

    if (duplicateLinks.length > 0) {
      const newLinks = duplicateLinks.map((link) => ({
        memoryId: link.memoryId,
        eventId: primaryId,
      }));

      if (newLinks.length > 0) {
        await db.insert(memoryEventLinks).values(newLinks).onConflictDoNothing();
      }

      await db.delete(memoryEventLinks).where(eq(memoryEventLinks.eventId, duplicateId));
    }

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

  // Concept management
  async createConcept(concept: InsertConcept): Promise<Concept> {
    const [newConcept] = await db
      .insert(concepts)
      .values([concept as any])
      .returning();
    return newConcept;
  }

  async getConcept(id: string): Promise<Concept | undefined> {
    const [concept] = await db.select().from(concepts).where(eq(concepts.id, id));
    return concept || undefined;
  }

  async getProfileConcepts(profileId: string): Promise<Concept[]> {
    return await db
      .select()
      .from(concepts)
      .where(eq(concepts.profileId, profileId))
      .orderBy(desc(concepts.createdAt));
  }

  async updateConcept(id: string, updates: Partial<Concept>): Promise<Concept> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedConcept] = await db
      .update(concepts)
      .set(updateData as any)
      .where(eq(concepts.id, id))
      .returning();
    return updatedConcept;
  }

  async deleteConcept(id: string): Promise<void> {
    await db.delete(concepts).where(eq(concepts.id, id));
  }

  // Item management
  async createItem(item: InsertItem): Promise<Item> {
    const [newItem] = await db
      .insert(items)
      .values([item as any])
      .returning();
    return newItem;
  }

  async getItem(id: string): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item || undefined;
  }

  async getProfileItems(profileId: string): Promise<Item[]> {
    return await db
      .select()
      .from(items)
      .where(eq(items.profileId, profileId))
      .orderBy(desc(items.createdAt));
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<Item> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedItem] = await db
      .update(items)
      .set(updateData as any)
      .where(eq(items.id, id))
      .returning();
    return updatedItem;
  }

  async deleteItem(id: string): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  }

  // Misc Entity management
  async createMiscEntity(misc: InsertMiscEntity): Promise<MiscEntity> {
    const [newMisc] = await db
      .insert(miscEntities)
      .values([misc as any])
      .returning();
    return newMisc;
  }

  async getMiscEntity(id: string): Promise<MiscEntity | undefined> {
    const [misc] = await db.select().from(miscEntities).where(eq(miscEntities.id, id));
    return misc || undefined;
  }

  async getProfileMiscEntities(profileId: string): Promise<MiscEntity[]> {
    return await db
      .select()
      .from(miscEntities)
      .where(eq(miscEntities.profileId, profileId))
      .orderBy(desc(miscEntities.createdAt));
  }

  async updateMiscEntity(id: string, updates: Partial<MiscEntity>): Promise<MiscEntity> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    const [updatedMisc] = await db
      .update(miscEntities)
      .set(updateData as any)
      .where(eq(miscEntities.id, id))
      .returning();
    return updatedMisc;
  }

  async deleteMiscEntity(id: string): Promise<void> {
    await db.delete(miscEntities).where(eq(miscEntities.id, id));
  }

  async getAllEntities(profileId: string): Promise<{
    people: Person[];
    places: Place[];
    events: Event[];
    concepts: Concept[];
    items: Item[];
    misc: MiscEntity[];
  }> {
    const [peopleList, placesList, eventsList, conceptsList, itemsList, miscList] = await Promise.all([
      this.getProfilePeople(profileId),
      this.getProfilePlaces(profileId),
      this.getProfileEvents(profileId),
      this.getProfileConcepts(profileId),
      this.getProfileItems(profileId),
      this.getProfileMiscEntities(profileId),
    ]);

    return {
      people: peopleList,
      places: placesList,
      events: eventsList,
      concepts: conceptsList,
      items: itemsList,
      misc: miscList,
    };
  }

  // Entity linking for memory entries (updated to use junction tables)
  async linkMemoryToEntities(memoryId: string, entityLinks: {
    personIds?: string[];
    placeIds?: string[];
    eventIds?: string[];
    conceptIds?: string[];
    itemIds?: string[];
    miscIds?: string[];
  }): Promise<void> {
    // Create junction table entries for people
    if (entityLinks.personIds && entityLinks.personIds.length > 0) {
      for (const personId of entityLinks.personIds) {
        const person = await this.getPerson(personId);
        if (person) {
          await db.insert(memoryPeopleLinks).values({
            memoryId,
            personId
          }).onConflictDoNothing();
        } else {
          console.warn(`⚠️ Person ID ${personId} not found, skipping link`);
        }
      }
    }

    // Create junction table entries for places
    if (entityLinks.placeIds && entityLinks.placeIds.length > 0) {
      for (const placeId of entityLinks.placeIds) {
        const place = await this.getPlace(placeId);
        if (place) {
          await db.insert(memoryPlaceLinks).values({
            memoryId,
            placeId
          }).onConflictDoNothing();
        } else {
          console.warn(`⚠️ Place ID ${placeId} not found, skipping link`);
        }
      }
    }

    // Create junction table entries for events
    if (entityLinks.eventIds && entityLinks.eventIds.length > 0) {
      for (const eventId of entityLinks.eventIds) {
        const event = await this.getEvent(eventId);
        if (event) {
          await db.insert(memoryEventLinks).values({
            memoryId,
            eventId
          }).onConflictDoNothing();
        } else {
          console.warn(`⚠️ Event ID ${eventId} not found, skipping link`);
        }
      }
    }

    // Create junction table entries for concepts
    if (entityLinks.conceptIds && entityLinks.conceptIds.length > 0) {
      for (const conceptId of entityLinks.conceptIds) {
        const concept = await this.getConcept(conceptId);
        if (concept) {
          await db.insert(memoryConceptLinks).values({
            memoryId,
            conceptId
          }).onConflictDoNothing();
        } else {
          console.warn(`⚠️ Concept ID ${conceptId} not found, skipping link`);
        }
      }
    }

    // Create junction table entries for items
    if (entityLinks.itemIds && entityLinks.itemIds.length > 0) {
      for (const itemId of entityLinks.itemIds) {
        const item = await this.getItem(itemId);
        if (item) {
          await db.insert(memoryItemLinks).values({
            memoryId,
            itemId
          }).onConflictDoNothing();
        } else {
          console.warn(`⚠️ Item ID ${itemId} not found, skipping link`);
        }
      }
    }

    // Create junction table entries for misc entities
    if (entityLinks.miscIds && entityLinks.miscIds.length > 0) {
      for (const miscId of entityLinks.miscIds) {
        const misc = await this.getMiscEntity(miscId);
        if (misc) {
          await db.insert(memoryMiscLinks).values({
            memoryId,
            miscId
          }).onConflictDoNothing();
        } else {
          console.warn(`⚠️ Misc Entity ID ${miscId} not found, skipping link`);
        }
      }
    }
  }

  async getMemoryWithEntityLinks(profileId: string, limit = 50): Promise<Array<MemoryEntry & {
    people?: Person[];
    places?: Place[];
    events?: Event[];
    concepts?: Concept[];
    items?: Item[];
    misc?: MiscEntity[];
  }>> {
    // First, get the memories
    const memories = await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt))
      .limit(limit);

    // Then, for each memory, get the linked entities
    const enrichedMemories = await Promise.all(memories.map(async (memory) => {
      const [peopleLinks, placeLinks, eventLinks, conceptLinks, itemLinks, miscLinks] = await Promise.all([
        // Get people linked to this memory
        db.select({ person: people })
          .from(memoryPeopleLinks)
          .innerJoin(people, eq(memoryPeopleLinks.personId, people.id))
          .where(eq(memoryPeopleLinks.memoryId, memory.id)),

        // Get places linked to this memory
        db.select({ place: places })
          .from(memoryPlaceLinks)
          .innerJoin(places, eq(memoryPlaceLinks.placeId, places.id))
          .where(eq(memoryPlaceLinks.memoryId, memory.id)),

        // Get events linked to this memory
        db.select({ event: events })
          .from(memoryEventLinks)
          .innerJoin(events, eq(memoryEventLinks.eventId, events.id))
          .where(eq(memoryEventLinks.memoryId, memory.id)),

        // Get concepts linked to this memory
        db.select({ concept: concepts })
          .from(memoryConceptLinks)
          .innerJoin(concepts, eq(memoryConceptLinks.conceptId, concepts.id))
          .where(eq(memoryConceptLinks.memoryId, memory.id)),

        // Get items linked to this memory
        db.select({ item: items })
          .from(memoryItemLinks)
          .innerJoin(items, eq(memoryItemLinks.itemId, items.id))
          .where(eq(memoryItemLinks.memoryId, memory.id)),

        // Get misc entities linked to this memory
        db.select({ misc: miscEntities })
          .from(memoryMiscLinks)
          .innerJoin(miscEntities, eq(memoryMiscLinks.miscId, miscEntities.id))
          .where(eq(memoryMiscLinks.memoryId, memory.id)),
      ]);

      return {
        ...memory,
        people: peopleLinks.map(link => link.person),
        places: placeLinks.map(link => link.place),
        events: eventLinks.map(link => link.event),
        concepts: conceptLinks.map(link => link.concept),
        items: itemLinks.map(link => link.item),
        misc: miscLinks.map(link => link.misc),
      };
    }));

    return enrichedMemories;
  }

  // Get memories for specific entities (updated to use junction tables)
  async getMemoriesForPerson(personId: string, profileId: string): Promise<MemoryEntry[]> {
    const results = await db
      .select({ memory: memoryEntries })
      .from(memoryPeopleLinks)
      .innerJoin(memoryEntries, eq(memoryPeopleLinks.memoryId, memoryEntries.id))
      .where(
        and(
          eq(memoryPeopleLinks.personId, personId),
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));

    return results.map(row => row.memory);
  }

  async getMemoriesForPlace(placeId: string, profileId: string): Promise<MemoryEntry[]> {
    const results = await db
      .select({ memory: memoryEntries })
      .from(memoryPlaceLinks)
      .innerJoin(memoryEntries, eq(memoryPlaceLinks.memoryId, memoryEntries.id))
      .where(
        and(
          eq(memoryPlaceLinks.placeId, placeId),
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));

    return results.map(row => row.memory);
  }

  async getMemoriesForEvent(eventId: string, profileId: string): Promise<MemoryEntry[]> {
    const results = await db
      .select({ memory: memoryEntries })
      .from(memoryEventLinks)
      .innerJoin(memoryEntries, eq(memoryEventLinks.memoryId, memoryEntries.id))
      .where(
        and(
          eq(memoryEventLinks.eventId, eventId),
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));

    return results.map(row => row.memory);
  }

  async getMemoriesForConcept(conceptId: string, profileId: string): Promise<MemoryEntry[]> {
    const results = await db
      .select({ memory: memoryEntries })
      .from(memoryConceptLinks)
      .innerJoin(memoryEntries, eq(memoryConceptLinks.memoryId, memoryEntries.id))
      .where(
        and(
          eq(memoryConceptLinks.conceptId, conceptId),
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));

    return results.map(row => row.memory);
  }

  async getMemoriesForItem(itemId: string, profileId: string): Promise<MemoryEntry[]> {
    const results = await db
      .select({ memory: memoryEntries })
      .from(memoryItemLinks)
      .innerJoin(memoryEntries, eq(memoryItemLinks.memoryId, memoryEntries.id))
      .where(
        and(
          eq(memoryItemLinks.itemId, itemId),
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));

    return results.map(row => row.memory);
  }

  async getMemoriesForMiscEntity(miscId: string, profileId: string): Promise<MemoryEntry[]> {
    const results = await db
      .select({ memory: memoryEntries })
      .from(memoryMiscLinks)
      .innerJoin(memoryEntries, eq(memoryMiscLinks.memoryId, memoryEntries.id))
      .where(
        and(
          eq(memoryMiscLinks.miscId, miscId),
          eq(memoryEntries.profileId, profileId),
          eq(memoryEntries.status, 'ACTIVE')
        )
      )
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));

    return results.map(row => row.memory);
  }

  /**
   * Get all memories from a specific source (e.g., podcast episode, document)
   * Useful for querying "What did we learn from Episode 68?" or "What's in this document?"
   */
  async getMemoriesBySource(profileId: string, sourceId: string, source?: string): Promise<MemoryEntry[]> {
    const conditions = [
      eq(memoryEntries.profileId, profileId),
      eq(memoryEntries.sourceId, sourceId),
      eq(memoryEntries.status, 'ACTIVE')
    ];

    // Optionally filter by source type (e.g., 'podcast_episode', 'document')
    if (source) {
      conditions.push(eq(memoryEntries.source, source));
    }

    return await db
      .select()
      .from(memoryEntries)
      .where(and(...conditions))
      .orderBy(
        desc(memoryEntries.importance),
        desc(memoryEntries.confidence),
        desc(memoryEntries.createdAt)
      );
  }

  async searchEntities(profileId: string, query: string): Promise<{
    people: Person[];
    places: Place[];
    events: Event[];
    concepts: Concept[];
    items: Item[];
    misc: MiscEntity[];
  }> {
    const lowerQuery = `%${query.toLowerCase()}%`;

    const [peopleList, placesList, eventsList, conceptsList, itemsList, miscList] = await Promise.all([
      db.select().from(people).where(and(
        eq(people.profileId, profileId),
        or(
          ilike(people.canonicalName, lowerQuery),
          ilike(people.description, lowerQuery),
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${people.aliases}) as alias WHERE alias ILIKE ${lowerQuery})`
        )
      )).limit(5),
      
      db.select().from(places).where(and(
        eq(places.profileId, profileId),
        or(
          ilike(places.canonicalName, lowerQuery),
          ilike(places.description, lowerQuery)
        )
      )).limit(5),

      db.select().from(events).where(and(
        eq(events.profileId, profileId),
        or(
          ilike(events.canonicalName, lowerQuery),
          ilike(events.description, lowerQuery)
        )
      )).limit(5),

      db.select().from(concepts).where(and(
        eq(concepts.profileId, profileId),
        or(
          ilike(concepts.canonicalName, lowerQuery),
          ilike(concepts.description, lowerQuery)
        )
      )).limit(5),

      db.select().from(items).where(and(
        eq(items.profileId, profileId),
        or(
          ilike(items.canonicalName, lowerQuery),
          ilike(items.description, lowerQuery)
        )
      )).limit(5),

      db.select().from(miscEntities).where(and(
        eq(miscEntities.profileId, profileId),
        or(
          ilike(miscEntities.canonicalName, lowerQuery),
          ilike(miscEntities.description, lowerQuery)
        )
      )).limit(5),
    ]);

    return {
      people: peopleList,
      places: placesList,
      events: eventsList,
      concepts: conceptsList,
      items: itemsList,
      misc: miscList,
    };
  }
}

export const storage = new DatabaseStorage();
