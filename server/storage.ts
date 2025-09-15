import { 
  profiles, 
  conversations, 
  messages, 
  documents, 
  memoryEntries,
  loreEvents,
  loreCharacters,
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
  type LoreEvent,
  type InsertLoreEvent,
  type LoreCharacter,
  type InsertLoreCharacter
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, sql } from "drizzle-orm";

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
    return await db
      .select()
      .from(documents)
      .where(eq(documents.profileId, profileId))
      .orderBy(desc(documents.createdAt));
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
    return newEntry;
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
    const [memoryStats] = await db
      .select({
        totalFacts: sql<number>`count(*)`,
      })
      .from(memoryEntries)
      .where(eq(memoryEntries.profileId, profileId));

    const [conversationStats] = await db
      .select({
        conversations: sql<number>`count(*)`,
      })
      .from(conversations)
      .where(eq(conversations.profileId, profileId));

    return {
      totalFacts: memoryStats.totalFacts || 0,
      conversations: conversationStats.conversations || 0,
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

  // 🚀 NEW: Enhanced search that includes story context for atomic facts
  async searchEnrichedMemoryEntries(profileId: string, query: string): Promise<Array<MemoryEntry & { parentStory?: MemoryEntry }>> {
    const memories = await db
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
}

export const storage = new DatabaseStorage();
