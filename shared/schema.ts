import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, json, boolean, uniqueIndex, jsonb, customType, vector, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  coreIdentity: text("core_identity").notNull(),
  knowledgeBase: text("knowledge_base").default(""),
  isActive: boolean("is_active").default(false),
  chaosLevel: integer("chaos_level").default(80), // 0-100 scale, default highly unhinged
  chaosMode: text("chaos_mode").$type<'FULL_PSYCHO' | 'FAKE_PROFESSIONAL' | 'HYPER_FOCUSED' | 'CONSPIRACY'>().default('FULL_PSYCHO'),
  voiceId: text("voice_id").default("pNInz6obpgDQGcFmaJgB"), // ElevenLabs voice ID, default Adam voice
  voiceSettings: json("voice_settings").$type<{
    stability?: number; // v3: Only accepts 0.0, 0.5, or 1.0
    seed?: number; // Optional: for deterministic generation
  }>().default(sql`'{"stability": 0.0}'`),
  personalityBaselines: jsonb("personality_baselines").$type<{
    [traitName: string]: {
      value: number;
      acceptedAt: string;
      acceptedBy: 'USER' | 'AI';
      previousValue?: number;
      notes?: string;
    };
  }>(), // Stores accepted personality trait baselines for drift detection
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  sessionId: varchar("session_id"),
  title: text("title"), // AI-generated or user-provided conversation title
  isArchived: boolean("is_archived").default(false), // Hide from main sidebar without deleting
  isPrivate: boolean("is_private").default(false), // DEFAULT TO PUBLIC: If true, do not store lore or memories from this conversation
  // NEW: Enhanced memory persistence fields
  contentType: text("content_type").$type<'PODCAST' | 'STREAMING' | 'DISCORD' | 'GENERAL'>().default('GENERAL'),
  topicTags: text("topic_tags").array(), // Topics discussed in this conversation
  completedStories: text("completed_stories").array(), // Story IDs that were completed
  podcastEpisodeId: varchar("podcast_episode_id"), // Link to specific episode if relevant
  storyContext: text("story_context"), // Brief context about stories told
  metadata: jsonb("metadata").$type<{
    storyState?: {
      currentCity?: string;
      archetype?: string;
      turnCount: number;
      narrativeGoal?: string;
      isCompleted: boolean;
    }
  }>(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  type: text("type").$type<'USER' | 'AI' | 'CHATTER' | 'SYSTEM'>().notNull(),
  content: text("content").notNull(),
  rating: integer("rating"), // User rating: 1 = thumbs down, 2 = thumbs up
  isPrivate: boolean("is_private").default(false), // DEFAULT TO PUBLIC: If true, do not use for RAG or memory
  metadata: json("metadata").$type<{
    voice?: boolean;
    speaker?: string;
    processingTime?: number;
    retrieved_context?: string;
    debug_info?: any;
    enhanced_content?: string;
    cached?: boolean;
    concepts?: any;
  }>(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  name: text("name"), // Custom name provided by user
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  documentType: text("document_type").$type<'DOCUMENT' | 'TRAINING_EXAMPLE'>().default('DOCUMENT'),
  size: integer("size").notNull(),
  chunks: text("chunks").array(),
  extractedContent: text("extracted_content"),
  processingStatus: text("processing_status").$type<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>().default('PENDING'),
  processingProgress: integer("processing_progress").default(0), // 0-100 percentage for background jobs
  // 🔍 NEW: Enhanced processing metadata for stage-by-stage tracking
  processingMetadata: jsonb("processing_metadata").$type<{
    text_extraction?: { status: string; timestamp: string; page_count?: number; error?: string };
    fact_extraction?: { status: string; timestamp: string; facts_found?: number; error?: string };
    entity_extraction?: { status: string; timestamp: string; entities_found?: number; error?: string };
    deep_research?: { status: string; timestamp: string; progress?: number; error?: string };
    embedding_generation?: { status: string; timestamp: string; error?: string };
  }>(),
  // 🔍 NEW: Duplicate detection fields
  contentHash: varchar("content_hash", { length: 64 }), // SHA-256 hash for exact duplicate detection
  // 🔍 NEW: Semantic search support
  embedding: vector("embedding", { dimensions: 768 }), // Vector embeddings for semantic similarity
  embeddingModel: text("embedding_model"), // Model used to generate embedding
  embeddingUpdatedAt: timestamp("embedding_updated_at"), // When embedding was last generated
  retrievalCount: integer("retrieval_count").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueContentHash: uniqueIndex("unique_document_content_hash_idx")
    .on(table.profileId, table.contentHash)
    .where(sql`${table.contentHash} IS NOT NULL`),
}));

export const consolidatedPersonalities = pgTable("consolidated_personalities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  patterns: text("patterns").notNull(), // Consolidated personality patterns
  trainingExampleIds: text("training_example_ids").array().notNull(), // IDs of training examples used
  status: text("status").$type<'PENDING' | 'APPROVED' | 'REJECTED'>().default('PENDING'),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const memoryEntries = pgTable("memory_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  type: text("type").$type<'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT' | 'STORY' | 'ATOMIC'>().notNull(),
  content: text("content").notNull(),
  importance: integer("importance").default(1),
  retrievalCount: integer("retrieval_count").default(0),
  successRate: integer("success_rate").default(100), // Track how useful this fact is in conversations
  lastUsed: timestamp("last_used"),
  clusterId: varchar("cluster_id"), // For intelligent clustering
  keywords: text("keywords").array(), // For better retrieval
  tags: text("tags").array(), // Categorization tags (e.g. 'technical', 'dbd', 'family')
  relationships: text("relationships").array(), // IDs of related facts
  qualityScore: integer("quality_score").default(5), // 1-10 based on feedback
  temporalContext: text("temporal_context"), // When this fact was true/relevant
  source: text("source"), // 'conversation', 'document', 'manual'
  // Confidence tracking fields
  confidence: integer("confidence").default(50), // 0-100 confidence score
  sourceId: varchar("source_id"), // ID of the document/conversation that created this fact
  supportCount: integer("support_count").default(1), // How many sources have mentioned this fact
  firstSeenAt: timestamp("first_seen_at").default(sql`now()`),
  lastSeenAt: timestamp("last_seen_at").default(sql`now()`),
  contradictionGroupId: varchar("contradiction_group_id"), // Groups conflicting facts together
  canonicalKey: text("canonical_key"), // Unique key for fact deduplication
  status: text("status").$type<'ACTIVE' | 'DEPRECATED' | 'AMBIGUOUS'>().default('ACTIVE'),
  isProtected: boolean("is_protected").default(false), // Protected facts can't be deprecated by contradictions
  // 🎭 NEW: Unreliable Narrator & Emergence fields
  lane: text("lane").$type<'CANON' | 'RUMOR'>().notNull().default('CANON'), // CANON = reliable, RUMOR = performative bullshit
  origin: text("origin").$type<'DOC' | 'PODCAST_RSS' | 'CHAT' | 'STREAM_CHAT' | 'DISCORD' | 'MANUAL' | 'SYSTEM'>().default('SYSTEM'),
  truthDomain: text("truth_domain").$type<'DOC' | 'PODCAST' | 'OPS' | 'NICKY_LORE' | 'SABAM_LORE' | 'GENERAL'>().default('GENERAL'),
  // Hierarchical fact support  
  parentFactId: varchar("parent_fact_id"), // Links atomic facts to parent stories (self-reference removed to avoid circular dependency)
  isAtomicFact: boolean("is_atomic_fact").default(false), // True for granular facts extracted from stories
  storyContext: text("story_context"), // Brief context about which part of the story this relates to
  // Semantic search support
  embedding: vector("embedding", { dimensions: 768 }), // Vector embeddings for semantic search
  embeddingModel: text("embedding_model"), // Model used to generate embedding (e.g., 'gemini-embedding-001')
  embeddingUpdatedAt: timestamp("embedding_updated_at"), // When embedding was last generated
  // PostgreSQL Full-Text Search support
  searchVector: tsvector("search_vector"),
  
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  // Unique constraint to prevent duplicate canonical keys per profile and lane
  uniqueCanonicalKey: uniqueIndex("unique_profile_canonical_key_idx").on(table.profileId, table.canonicalKey, table.lane),
  // Vector similarity search index
  embeddingIndex: index("memory_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
}));

// === NEW: Entity Disambiguation System ===
// Feature flag to enable/disable the entity disambiguation system
export const entitySystemConfig = pgTable("entity_system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isEnabled: boolean("is_enabled").default(false),
  version: text("version").default("1.0"),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// The "Dossier" for every character in the universe  
export const people = pgTable("people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  canonicalName: text("canonical_name").notNull(), // e.g., "Sal" for all four Sals
  
  // The human-readable nickname to tell them apart. Key to solving name collisions.
  // e.g., "The Butcher", "My No-Good Cousin"
  disambiguation: text("disambiguation"), 
  
  aliases: jsonb("aliases").$type<string[]>(),
  relationship: text("relationship"),
  description: text("description"), // AI-generated summary
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  // uniqueCanonicalName: uniqueIndex("unique_person_profile_name_idx").on(table.profileId, table.canonicalName),
}));

// The "Atlas" for all significant locations
export const places = pgTable("places", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  canonicalName: text("canonical_name").notNull(),
  locationType: text("location_type"),
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  // uniqueCanonicalName: uniqueIndex("unique_place_profile_name_idx").on(table.profileId, table.canonicalName),
}));

// The "Chronicle" for the timeline of events
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  canonicalName: text("canonical_name").notNull(),
  eventDate: text("event_date"), // Text for fuzzy dates like "1998"
  description: text("description"),
  isCanonical: boolean("is_canonical").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  // uniqueCanonicalName: uniqueIndex("unique_event_profile_name_idx").on(table.profileId, table.canonicalName),
}));

// The "Concepts" for abstract ideas, lore terms, and recurring themes
export const concepts = pgTable("concepts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  canonicalName: text("canonical_name").notNull(),
  description: text("description"),
  category: text("category"), // e.g., "Game Mechanic", "Philosophy", "Inside Joke"
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// The "Items" for physical objects, game items, or significant props
export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  canonicalName: text("canonical_name").notNull(),
  description: text("description"),
  type: text("type"), // e.g., "Weapon", "Food", "Tool"
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// The "Misc" for anything that doesn't fit elsewhere
export const miscEntities = pgTable("misc_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  canonicalName: text("canonical_name").notNull(),
  description: text("description"),
  type: text("type"), // Flexible categorization
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Junction tables for many-to-many memory-entity relationships
export const memoryPeopleLinks = pgTable("memory_people_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memoryId: varchar("memory_id").references(() => memoryEntries.id, { onDelete: 'cascade' }).notNull(),
  personId: varchar("person_id").references(() => people.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  // uniqueMemoryPerson: uniqueIndex("unique_memory_person_link_idx").on(table.memoryId, table.personId),
}));

export const memoryPlaceLinks = pgTable("memory_place_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memoryId: varchar("memory_id").references(() => memoryEntries.id, { onDelete: 'cascade' }).notNull(),
  placeId: varchar("place_id").references(() => places.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  // uniqueMemoryPlace: uniqueIndex("unique_memory_place_link_idx").on(table.memoryId, table.placeId),
}));

export const memoryEventLinks = pgTable("memory_event_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memoryId: varchar("memory_id").references(() => memoryEntries.id, { onDelete: 'cascade' }).notNull(),
  eventId: varchar("event_id").references(() => events.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  // uniqueMemoryEvent: uniqueIndex("unique_memory_event_link_idx").on(table.memoryId, table.eventId),
}));

export const memoryConceptLinks = pgTable("memory_concept_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memoryId: varchar("memory_id").references(() => memoryEntries.id, { onDelete: 'cascade' }).notNull(),
  conceptId: varchar("concept_id").references(() => concepts.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const memoryItemLinks = pgTable("memory_item_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memoryId: varchar("memory_id").references(() => memoryEntries.id, { onDelete: 'cascade' }).notNull(),
  itemId: varchar("item_id").references(() => items.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const memoryMiscLinks = pgTable("memory_misc_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memoryId: varchar("memory_id").references(() => memoryEntries.id, { onDelete: 'cascade' }).notNull(),
  miscId: varchar("misc_id").references(() => miscEntities.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Duplicate Scan Results - Persistent storage for deep scan results
export const duplicateScanResults = pgTable("duplicate_scan_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  scanDepth: integer("scan_depth").notNull(), // Number of memories scanned (or -1 for ALL)
  similarityThreshold: integer("similarity_threshold").notNull(), // Threshold percentage (0-100)
  totalGroupsFound: integer("total_groups_found").default(0),
  totalDuplicatesFound: integer("total_duplicates_found").default(0),
  duplicateGroups: jsonb("duplicate_groups").$type<any[]>().default([]), // Array of duplicate group objects
  status: text("status").$type<'ACTIVE' | 'ARCHIVED' | 'CHUNK'>().default('ACTIVE'), // CHUNK = additional data for large scans
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueActiveScope: uniqueIndex("unique_duplicate_scan_scope_idx")
    .on(table.profileId, table.scanDepth, table.similarityThreshold)
    .where(sql`${table.status} = 'ACTIVE'`),
}));

// Content Library - For stories, AITA posts, entertainment content (separate from facts)
export const contentLibrary = pgTable("content_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").$type<'AITA' | 'REDDIT_STORY' | 'ENTERTAINMENT' | 'PERSONAL_STORY' | 'RANT' | 'OTHER'>().default('OTHER'),
  source: text("source"), // Where this came from (document name, URL, etc.)
  sourceId: varchar("source_id"), // ID of the document/source that created this
  tags: text("tags").array(), // Keywords for organization
  difficulty: text("difficulty").$type<'EASY' | 'MODERATE' | 'HARD' | 'EXPERT'>(), // Reading difficulty
  mood: text("mood").$type<'FUNNY' | 'DRAMATIC' | 'WHOLESOME' | 'DARK' | 'NEUTRAL'>(), // Content mood
  length: text("length").$type<'SHORT' | 'MEDIUM' | 'LONG'>(), // Content length
  rating: integer("rating").default(0), // User rating (0-5 stars)
  notes: text("notes"), // Private notes about this content
  isFavorite: boolean("is_favorite").default(false),
  lastAccessed: timestamp("last_accessed"),
  accessCount: integer("access_count").default(0),
  // Semantic search support
  embedding: vector("embedding", { dimensions: 768 }), // Vector embeddings for semantic search
  embeddingModel: text("embedding_model"), // Model used to generate embedding (e.g., 'gemini-embedding-001')
  embeddingUpdatedAt: timestamp("embedding_updated_at"), // When embedding was last generated
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Chaos Engine State - Global persistent state for Nicky's chaos system
export const chaosState = pgTable("chaos_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: integer("level").notNull().default(0), // 0-100 chaos level
  sauceMeter: integer("sauce_meter").notNull().default(0), // 0-100 "heated" level
  mode: text("mode").$type<'FULL_PSYCHO' | 'FAKE_PROFESSIONAL' | 'HYPER_FOCUSED' | 'CONSPIRACY'>().notNull().default('FULL_PSYCHO'),
  lastModeChange: timestamp("last_mode_change").default(sql`now()`),
  responseCount: integer("response_count").default(0), // Track responses for evolution
  manualOverride: integer("manual_override"), // Optional temporary override level
  overrideExpiry: timestamp("override_expiry"), // Timeout for manual override
  isGlobal: boolean("is_global").default(true), // Singleton pattern flag
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Personality State - Persistent storage for Nicky's unified personality
export const personalityState = pgTable("personality_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  basePersonality: jsonb("base_personality").notNull(), // Stores PersonalityControl object
  lastUpdated: timestamp("last_updated").default(sql`now()`),
  source: text("source").notNull(),
  isGlobal: boolean("is_global").default(true),
});

export const varietyState = pgTable("variety_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  state: jsonb("state").notNull(), // Stores SessionVariety object
  lastUpdated: timestamp("last_updated").default(sql`now()`),
});

// Heat State - Simplified personality system (replaces chaos engine)
export const heatState = pgTable("heat_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  heat: integer("heat").notNull().default(45), // 10-100, floor of 10 (never calm)
  currentGame: text("current_game").$type<'none' | 'dbd' | 'arc_raiders' | 'other'>().notNull().default('none'),
  spice: text("spice").$type<'platform_safe' | 'normal' | 'spicy'>().notNull().default('spicy'),
  lastUpdated: timestamp("last_updated").default(sql`now()`),
  isGlobal: boolean("is_global").default(true), // Singleton pattern flag
});

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  conversations: many(conversations),
  documents: many(documents),
  memoryEntries: many(memoryEntries),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [conversations.profileId],
    references: [profiles.id],
  }),
  messages: many(messages),
  varietyState: one(varietyState, {
    fields: [conversations.id],
    references: [varietyState.conversationId],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  profile: one(profiles, {
    fields: [documents.profileId],
    references: [profiles.id],
  }),
}));

export const memoryEntriesRelations = relations(memoryEntries, ({ one }) => ({
  profile: one(profiles, {
    fields: [memoryEntries.profileId],
    references: [profiles.id],
  }),
}));

// NEW: Entity system relations
export const entitySystemConfigRelations = relations(entitySystemConfig, ({ }) => ({}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [people.profileId],
    references: [profiles.id],
  }),
  memoryEntries: many(memoryEntries),
}));

export const placesRelations = relations(places, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [places.profileId],
    references: [profiles.id],
  }),
  memoryEntries: many(memoryEntries),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [events.profileId],
    references: [profiles.id],
  }),
  memoryEntries: many(memoryEntries),
}));

export const conceptsRelations = relations(concepts, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [concepts.profileId],
    references: [profiles.id],
  }),
  memoryEntries: many(memoryEntries),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [items.profileId],
    references: [profiles.id],
  }),
  memoryEntries: many(memoryEntries),
}));

export const miscEntitiesRelations = relations(miscEntities, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [miscEntities.profileId],
    references: [profiles.id],
  }),
  memoryEntries: many(memoryEntries),
}));

// Insert schemas
export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations, {
  topicTags: z.array(z.string()).optional(),
  completedStories: z.array(z.string()).optional(),
  contentType: z.enum(['PODCAST', 'STREAMING', 'DISCORD', 'GENERAL']).optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsolidatedPersonalitySchema = createInsertSchema(consolidatedPersonalities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMemoryEntrySchema = createInsertSchema(memoryEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChaosStateSchema = createInsertSchema(chaosState).omit({
  id: true,
  updatedAt: true,
});

export const insertHeatStateSchema = createInsertSchema(heatState).omit({
  id: true,
});

// NEW: Entity system insert schemas
export const insertEntitySystemConfigSchema = createInsertSchema(entitySystemConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertPersonSchema = createInsertSchema(people).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlaceSchema = createInsertSchema(places).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConceptSchema = createInsertSchema(concepts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMiscEntitySchema = createInsertSchema(miscEntities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMemoryPeopleLinkSchema = createInsertSchema(memoryPeopleLinks).omit({
  id: true,
  createdAt: true,
});

export const insertMemoryPlaceLinkSchema = createInsertSchema(memoryPlaceLinks).omit({
  id: true,
  createdAt: true,
});

export const insertMemoryEventLinkSchema = createInsertSchema(memoryEventLinks).omit({
  id: true,
  createdAt: true,
});

export const insertMemoryConceptLinkSchema = createInsertSchema(memoryConceptLinks).omit({
  id: true,
  createdAt: true,
});

export const insertMemoryItemLinkSchema = createInsertSchema(memoryItemLinks).omit({
  id: true,
  createdAt: true,
});

export const insertMemoryMiscLinkSchema = createInsertSchema(memoryMiscLinks).omit({
  id: true,
  createdAt: true,
});

// Types
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type ConsolidatedPersonality = typeof consolidatedPersonalities.$inferSelect;
export type InsertConsolidatedPersonality = z.infer<typeof insertConsolidatedPersonalitySchema>;
export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type InsertMemoryEntry = z.infer<typeof insertMemoryEntrySchema>;
export type ChaosState = typeof chaosState.$inferSelect;
export type InsertChaosState = z.infer<typeof insertChaosStateSchema>;
export type HeatState = typeof heatState.$inferSelect;
export type InsertHeatState = z.infer<typeof insertHeatStateSchema>;

// NEW: Entity system types
export type EntitySystemConfig = typeof entitySystemConfig.$inferSelect;
export type InsertEntitySystemConfig = z.infer<typeof insertEntitySystemConfigSchema>;
export type Person = typeof people.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Place = typeof places.$inferSelect;
export type InsertPlace = z.infer<typeof insertPlaceSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Concept = typeof concepts.$inferSelect;
export type InsertConcept = z.infer<typeof insertConceptSchema>;
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type MiscEntity = typeof miscEntities.$inferSelect;
export type InsertMiscEntity = z.infer<typeof insertMiscEntitySchema>;
export type MemoryPeopleLink = typeof memoryPeopleLinks.$inferSelect;
export type InsertMemoryPeopleLink = z.infer<typeof insertMemoryPeopleLinkSchema>;
export type MemoryPlaceLink = typeof memoryPlaceLinks.$inferSelect;
export type InsertMemoryPlaceLink = z.infer<typeof insertMemoryPlaceLinkSchema>;
export type MemoryEventLink = typeof memoryEventLinks.$inferSelect;
export type InsertMemoryEventLink = z.infer<typeof insertMemoryEventLinkSchema>;
export type MemoryConceptLink = typeof memoryConceptLinks.$inferSelect;
export type InsertMemoryConceptLink = z.infer<typeof insertMemoryConceptLinkSchema>;
export type MemoryItemLink = typeof memoryItemLinks.$inferSelect;
export type InsertMemoryItemLink = z.infer<typeof insertMemoryItemLinkSchema>;
export type MemoryMiscLink = typeof memoryMiscLinks.$inferSelect;
export type InsertMemoryMiscLink = z.infer<typeof insertMemoryMiscLinkSchema>;

// Emergent Lore System - Nicky's ongoing life events
export const loreEvents = pgTable("lore_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  category: text("category").notNull(), // 'family_drama', 'rival_conflict', 'neighborhood', 'restaurant', 'gaming'
  title: text("title").notNull(), // "Cousin Vinny's Legal Troubles"
  description: text("description").notNull(), // Full event description
  status: text("status").notNull(), // 'ongoing', 'resolved', 'escalated'
  priority: integer("priority").default(3), // 1-5, how likely to mention
  lastMentioned: timestamp("last_mentioned"),
  mentionCount: integer("mention_count").default(0),
  relatedCharacters: text("related_characters").array(), // Character names
  outcomes: text("outcomes").array(), // Possible developments
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Characters in Nicky's world
export const loreCharacters = pgTable("lore_characters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  name: text("name").notNull(), // "Cousin Vinny", "Tony_Cannoli", "Mrs. Rigatoni"
  category: text("category").notNull(), // 'family', 'rival', 'neighbor', 'customer', 'player'
  relationship: text("relationship").notNull(), // Relationship to Nicky
  personality: text("personality").notNull(), // Brief personality description
  backstory: text("backstory").notNull(), // Character background
  lastActivity: text("last_activity"), // What they were last doing
  activityFrequency: integer("activity_frequency").default(3), // 1-5, how often they do things
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Locations in Nicky's world (extracted from memories)
export const loreLocations = pgTable("lore_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  name: text("name").notNull(), // "Ma's Restaurant", "The Old Neighborhood", "Twitch Studio"
  category: text("category").notNull(), // 'restaurant', 'home', 'gaming', 'neighborhood', 'family'
  description: text("description").notNull(), // What happens there, atmosphere
  significance: text("significance").notNull(), // Why it matters to Nicky
  currentStatus: text("current_status"), // Current state/activity
  associatedCharacters: text("associated_characters").array(), // Who goes there
  lastMentioned: timestamp("last_mentioned"),
  mentionCount: integer("mention_count").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Historical events from Nicky's past (extracted from memories)
export const loreHistoricalEvents = pgTable("lore_historical_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  title: text("title").notNull(), // "The Great Stream Disaster of 2023"
  description: text("description").notNull(), // What happened
  category: text("category").notNull(), // 'gaming', 'family', 'streaming', 'personal'
  timeframe: text("timeframe"), // "last year", "when I was a kid", "2023"
  significance: integer("significance").default(3), // 1-5, how important this memory is
  participants: text("participants").array(), // Characters involved
  location: text("location"), // Where it happened
  consequences: text("consequences"), // What resulted from this event
  lastMentioned: timestamp("last_mentioned"),
  mentionCount: integer("mention_count").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Relationships between entities (character-character, character-location, etc.)
export const loreRelationships = pgTable("lore_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  entityType1: text("entity_type_1").notNull(), // 'character', 'location', 'event'
  entityId1: text("entity_id_1").notNull(), // ID of first entity
  entityName1: text("entity_name_1").notNull(), // Name for easy reference
  entityType2: text("entity_type_2").notNull(), // 'character', 'location', 'event'
  entityId2: text("entity_id_2").notNull(), // ID of second entity
  entityName2: text("entity_name_2").notNull(), // Name for easy reference
  relationshipType: text("relationship_type").notNull(), // 'friends', 'rivals', 'works_at', 'happened_at'
  strength: integer("strength").default(3), // 1-5, how strong/important this connection is
  description: text("description"), // Details about the relationship
  status: text("status").default('active'), // 'active', 'past', 'complicated'
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Relations for lore system
export const loreEventsRelations = relations(loreEvents, ({ one }) => ({
  profile: one(profiles, {
    fields: [loreEvents.profileId],
    references: [profiles.id],
  }),
}));

export const loreCharactersRelations = relations(loreCharacters, ({ one }) => ({
  profile: one(profiles, {
    fields: [loreCharacters.profileId],
    references: [profiles.id],
  }),
}));

export const loreLocationsRelations = relations(loreLocations, ({ one }) => ({
  profile: one(profiles, {
    fields: [loreLocations.profileId],
    references: [profiles.id],
  }),
}));

export const loreHistoricalEventsRelations = relations(loreHistoricalEvents, ({ one }) => ({
  profile: one(profiles, {
    fields: [loreHistoricalEvents.profileId],
    references: [profiles.id],
  }),
}));

export const loreRelationshipsRelations = relations(loreRelationships, ({ one }) => ({
  profile: one(profiles, {
    fields: [loreRelationships.profileId],
    references: [profiles.id],
  }),
}));

export const contentLibraryRelations = relations(contentLibrary, ({ one }) => ({
  profile: one(profiles, {
    fields: [contentLibrary.profileId],
    references: [profiles.id],
  }),
}));

// Topic Escalation System - Tracks how invested Nicky gets in various topics
export const topicEscalation = pgTable("topic_escalation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  topic: text("topic").notNull(), // The topic being tracked (normalized)
  normalizedTopic: text("normalized_topic").notNull(), // Cleaned version for deduplication
  mentionCount: integer("mention_count").default(1), // How many times mentioned
  currentIntensity: integer("current_intensity").default(15), // Current emotional intensity (0-100)
  maxIntensity: integer("max_intensity").default(15), // Highest intensity reached
  lastMentioned: timestamp("last_mentioned").default(sql`now()`),
  contexts: text("contexts").array(), // Recent contexts where this was mentioned
  relatedKeywords: text("related_keywords").array(), // Associated terms
  emotionalTriggers: text("emotional_triggers").array(), // What aspects trigger intensity
  escalationRate: integer("escalation_rate").default(15), // How much intensity increases per mention
  coolingRate: integer("cooling_rate").default(5), // How much intensity decreases over time
  isPersonal: boolean("is_personal").default(false), // Has this become personal to Nicky?
  familyHonorInvolved: boolean("family_honor_involved").default(false), // Ultimate escalation
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    // Unique index to prevent duplicate topics per profile
    topicProfileIdx: uniqueIndex("topic_escalation_profile_topic_idx").on(table.profileId, table.normalizedTopic),
  };
});

export const topicEscalationRelations = relations(topicEscalation, ({ one }) => ({
  profile: one(profiles, {
    fields: [topicEscalation.profileId],
    references: [profiles.id],
  }),
}));

// Insert schemas for lore system
export const insertLoreEventSchema = createInsertSchema(loreEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoreCharacterSchema = createInsertSchema(loreCharacters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoreLocationSchema = createInsertSchema(loreLocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoreHistoricalEventSchema = createInsertSchema(loreHistoricalEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoreRelationshipSchema = createInsertSchema(loreRelationships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentLibrarySchema = createInsertSchema(contentLibrary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTopicEscalationSchema = createInsertSchema(topicEscalation).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for lore system
export type LoreEvent = typeof loreEvents.$inferSelect;
export type InsertLoreEvent = z.infer<typeof insertLoreEventSchema>;
export type LoreCharacter = typeof loreCharacters.$inferSelect;
export type InsertLoreCharacter = z.infer<typeof insertLoreCharacterSchema>;
export type LoreLocation = typeof loreLocations.$inferSelect;
export type InsertLoreLocation = z.infer<typeof insertLoreLocationSchema>;
export type LoreHistoricalEvent = typeof loreHistoricalEvents.$inferSelect;
export type InsertLoreHistoricalEvent = z.infer<typeof insertLoreHistoricalEventSchema>;
export type LoreRelationship = typeof loreRelationships.$inferSelect;
export type InsertLoreRelationship = z.infer<typeof insertLoreRelationshipSchema>;

// Types for content library
export type ContentLibraryEntry = typeof contentLibrary.$inferSelect;
export type InsertContentLibraryEntry = z.infer<typeof insertContentLibrarySchema>;

// Types for topic escalation
export type TopicEscalation = typeof topicEscalation.$inferSelect;
export type InsertTopicEscalation = z.infer<typeof insertTopicEscalationSchema>;

// Podcast Management System
export const podcastEpisodes = pgTable("podcast_episodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  // RSS feed metadata
  guid: text("guid"), // Unique episode identifier from RSS feed
  podcastName: text("podcast_name").default('Camping Them Softly'), // Distinguish between shows
  episodeNumber: integer("episode_number"),
  seasonNumber: integer("season_number"),
  title: text("title").notNull(),
  description: text("description"),
  airDate: timestamp("air_date"), // Kept for backward compatibility
  publishedAt: timestamp("published_at"), // RSS publication date
  duration: integer("duration"), // Duration in seconds (RSS standard)
  audioUrl: text("audio_url"), // Direct link to audio file from RSS
  imageUrl: text("image_url"), // Episode artwork URL
  // Content metadata
  guestNames: text("guest_names").array(), // Array of guest names
  topics: text("topics").array(), // Main topics covered
  transcript: text("transcript"), // Full episode transcript
  transcriptFilename: text("transcript_filename"), // Local filename for transcript matching
  highlights: text("highlights").array(), // Key moments or quotes
  // Processing status
  status: text("status").$type<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>().default('DRAFT'),
  processingStatus: text("processing_status").$type<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>().default('PENDING'),
  processingProgress: integer("processing_progress").default(0), // 0-100 percentage
  factsExtracted: integer("facts_extracted").default(0), // Count of facts from this episode
  entitiesExtracted: integer("entities_extracted").default(0), // Count of entities extracted
  // Metadata
  viewCount: integer("view_count").default(0),
  notes: text("notes"), // Private production notes
  lastSyncedAt: timestamp("last_synced_at"), // Last RSS sync check
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueGuid: uniqueIndex("unique_episode_guid_idx").on(table.profileId, table.guid),
}));

export const podcastSegments = pgTable("podcast_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  episodeId: varchar("episode_id").references(() => podcastEpisodes.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: integer("start_time"), // Start time in seconds
  endTime: integer("end_time"), // End time in seconds
  segmentType: text("segment_type").$type<'INTRO' | 'MAIN_TOPIC' | 'GUEST_INTERVIEW' | 'CALLER_SEGMENT' | 'GAME' | 'AD_READ' | 'OUTRO'>().default('MAIN_TOPIC'),
  participants: text("participants").array(), // Who was involved in this segment
  keyQuotes: text("key_quotes").array(), // Notable quotes from this segment
  gameResults: json("game_results").$type<{ 
    winner?: string; 
    score?: number; 
    details?: string; 
  }>(), // For gaming segments
  transcript: text("transcript"), // Segment-specific transcript
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Podcast Listener Cities Tracking
export const listenerCities = pgTable("listener_cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  city: text("city").notNull(),
  stateProvince: text("state_province"), // Optional - not all countries have states/provinces
  country: text("country").notNull(),
  continent: text("continent").notNull(),
  region: text("region"), // e.g., "Western Europe", "Southeast Asia"
  isCovered: boolean("is_covered").default(false), // Has it been covered on "Where the fuck are the viewers from"
  coveredDate: timestamp("covered_date"),
  coveredEpisode: text("covered_episode"), // Episode number or title
  notes: text("notes"), // Any additional notes about this city
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  // Prevent duplicate cities for same profile
  uniqueCityCountry: uniqueIndex("unique_city_country_idx").on(
    table.profileId, 
    table.city, 
    table.country
  ),
}));

// AI-Assisted Flagging System
export const contentFlags = pgTable("content_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  targetType: text("target_type").$type<'MEMORY' | 'MESSAGE' | 'DOCUMENT' | 'CONVERSATION'>().notNull(),
  targetId: varchar("target_id").notNull(), // ID of the flagged content
  
  // Core flagging categories from comprehensive documentation
  flagType: text("flag_type").$type<
    // Character Development Tracking
    'new_backstory' | 'personality_anomaly' | 'new_skill_claim' |
    // Relationship Dynamics  
    'new_character' | 'relationship_shift' | 'hierarchy_claim' |
    // Emotional State Patterns
    'rant_initiated' | 'mask_dropped' | 'chaos_level_1' | 'chaos_level_2' | 'chaos_level_3' | 'chaos_level_4' | 'chaos_level_5' |
    // Content Importance Classification
    'permanent_fact' | 'high_importance' | 'medium_importance' | 'low_importance' | 'deletion_candidate' |
    // Meta-System Monitoring
    'fourth_wall_break' | 'ooc_behavior' | 'coaching_violation' | 'coaching_adherence' |
    // Additional Categories
    'pasta_related' | 'dbd_gameplay' | 'arc_raiders_gameplay' | 'family_mention' | 'romance_failure' | 'criminal_activity' |
    // New Content & Upgrades
    'podcast_topic' | 'listener_interaction' | 'streaming_moment' |
    'fact_candidate' | 'distillation_required' |
    'lore_contradiction' | 'extraction_event' | 'trial_outcome'
  >().notNull(),
  
  priority: text("priority").$type<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>().default('MEDIUM'),
  confidence: integer("confidence").default(80), // 0-100, how confident the AI is about this flag
  
  // Details about the flagged content
  flagReason: text("flag_reason").notNull(), // Why this was flagged
  extractedData: json("extracted_data").$type<{
    characterNames?: string[];
    relationships?: string[];
    emotions?: string[];
    topics?: string[];
    contradictions?: string[];
    patterns?: string[];
  }>(), // Structured data extracted from content
  
  // Review and curation
  reviewStatus: text("review_status").$type<'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED'>().default('PENDING'),
  reviewedBy: text("reviewed_by"), // Who reviewed this flag
  reviewNotes: text("review_notes"), // Notes from human reviewer
  reviewedAt: timestamp("reviewed_at"),
  
  // Automation and patterns
  triggerPattern: text("trigger_pattern"), // What regex/pattern triggered this flag
  actionTaken: text("action_taken"), // What automated action was taken

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    // Prevent duplicate flags for the same content + flag type combination
    uniqueContentFlag: uniqueIndex("unique_content_flag_idx").on(
      table.profileId, 
      table.targetType, 
      table.targetId, 
      table.flagType
    ),
  };
});

// Relations for content flags
export const contentFlagsRelations = relations(contentFlags, ({ one }) => ({
  profile: one(profiles, {
    fields: [contentFlags.profileId],
    references: [profiles.id],
  }),
}));

// Insert schema for content flags
export const insertContentFlagSchema = createInsertSchema(contentFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for content flags
export type ContentFlag = typeof contentFlags.$inferSelect;
export type InsertContentFlag = z.infer<typeof insertContentFlagSchema>;

export const contentFlagRelations = pgTable("content_flag_relations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flagId: varchar("flag_id").references(() => contentFlags.id, { onDelete: 'cascade' }).notNull(),
  relatedFlagId: varchar("related_flag_id").references(() => contentFlags.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  uniqueRelation: uniqueIndex("unique_content_flag_relation_idx").on(table.flagId, table.relatedFlagId),
}));

// Auto-Approval Tracking
export const flagAutoApprovals = pgTable("flag_auto_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  approvalDate: text("approval_date").notNull(), // YYYY-MM-DD format
  approvalCount: integer("approval_count").default(0), // Number of auto-approvals for this date
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueDateProfile: uniqueIndex("unique_date_profile_idx").on(
      table.profileId,
      table.approvalDate
    ),
  };
});

export const flagAutoApprovalFlagLinks = pgTable("flag_auto_approval_flag_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  autoApprovalId: varchar("auto_approval_id").references(() => flagAutoApprovals.id, { onDelete: 'cascade' }).notNull(),
  flagId: varchar("flag_id").references(() => contentFlags.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  uniqueAutoApprovalFlag: uniqueIndex("unique_auto_approval_flag_idx").on(table.autoApprovalId, table.flagId),
}));

export type FlagAutoApproval = typeof flagAutoApprovals.$inferSelect;

// Discord Integration Tables
export const discordServers = pgTable("discord_servers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  serverId: text("server_id").notNull().unique(), // Discord server ID
  serverName: text("server_name").notNull(),
  isActive: boolean("is_active").default(true),
  // Baseline behavior settings (user-configurable)
  aggressiveness: integer("aggressiveness").default(80), // 0-100
  responsiveness: integer("responsiveness").default(60), // 0-100 
  unpredictability: integer("unpredictability").default(75), // 0-100 (replaces italianIntensity)
  dbdObsession: integer("dbd_obsession").default(80), // 0-100
  familyBusinessMode: integer("family_business_mode").default(40), // 0-100
  // Dynamic drift state (auto-calculated)
  lastDriftUpdate: timestamp("last_drift_update").default(sql`now()`),
  driftMomentum: json("drift_momentum").default('{}'), // EWMA momentum for smooth changes
  contextNudges: json("context_nudges").default('[]'), // Temporary boosts from events (array)
  
  // Proactive messaging controls
  allowedChannels: json("allowed_channels").default('[]'), // Channel IDs where proactive messages are allowed
  blockedChannels: json("blocked_channels").default('[]'), // Channel IDs where proactive messages are blocked
  enabledMessageTypes: json("enabled_message_types").default('["dbd", "italian", "family_business", "aggressive", "random"]'), // Which message types are enabled
  proactiveEnabled: boolean("proactive_enabled").default(true), // Master toggle for proactive messaging
  
  // Daily proactive messaging limits (CRITICAL FIX: persist to prevent spam after restarts)
  dailyProactiveCount: integer("daily_proactive_count").default(0), // Number of proactive messages sent today
  lastProactiveDate: text("last_proactive_date").default(''), // Date string for tracking daily resets
  
  // Unified personality migration flag
  unifiedPersonalityMigrated: boolean("unified_personality_migrated").default(false),
  
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const discordMembers = pgTable("discord_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  serverId: varchar("server_id").references(() => discordServers.id).notNull(),
  userId: text("user_id").notNull(), // Discord user ID
  username: text("username").notNull(),
  nickname: text("nickname"), // Server nickname if different
  facts: text("facts").array(), // Array of facts about this member
  keywords: text("keywords").array(), // Keywords for triggering responses about this member
  lastInteraction: timestamp("last_interaction"),
  interactionCount: integer("interaction_count").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    // Unique per server/user combination
    uniqueServerUser: uniqueIndex("unique_server_user_idx").on(
      table.serverId, 
      table.userId
    ),
  };
});

export const discordTopicTriggers = pgTable("discord_topic_triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  serverId: varchar("server_id").references(() => discordServers.id).notNull(),
  topic: text("topic").notNull(), // The trigger word/phrase
  category: text("category").$type<'HIGH' | 'MEDIUM' | 'LOW'>().default('MEDIUM'),
  responseChance: integer("response_chance").default(75), // 0-100 chance to respond
  keywords: text("keywords").array(), // Related keywords
  customResponse: text("custom_response"), // Optional custom response template
  isActive: boolean("is_active").default(true),
  triggerCount: integer("trigger_count").default(0),
  lastTriggered: timestamp("last_triggered"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const discordConversations = pgTable("discord_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  serverId: varchar("server_id").references(() => discordServers.id).notNull(),
  channelId: text("channel_id").notNull(), // Discord channel ID
  channelName: text("channel_name").notNull(),
  messageId: text("message_id").notNull(), // Discord message ID that triggered response
  triggerMessage: text("trigger_message").notNull(), // Original message that triggered Nicky
  nickyResponse: text("nicky_response").notNull(), // Nicky's response
  triggerType: text("trigger_type").$type<'MENTION' | 'TOPIC_TRIGGER' | 'RANDOM' | 'KEYWORD'>().notNull(),
  triggerData: json("trigger_data").$type<{
    topics?: string[];
    keywords?: string[];
    responseChance?: number;
    behaviorSettings?: {
      aggressiveness: number;
      responsiveness: number;
      italianIntensity: number;
    };
  }>(),
  userId: text("user_id").notNull(), // Discord user who triggered response
  username: text("username").notNull(),
  processingTime: integer("processing_time"), // Time in ms to generate response
  createdAt: timestamp("created_at").default(sql`now()`),
});

// DbD Content Ingestion Tables
export const automatedSources = pgTable('automated_sources', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar('profile_id').references(() => profiles.id).notNull(),
  sourceType: varchar('source_type', { length: 50 }).notNull(), // 'reddit', 'steam', 'wiki', 'youtube'
  sourceUrl: text('source_url'),
  isActive: boolean('is_active').default(true),
  confidenceMultiplier: varchar('confidence_multiplier', { length: 10 }).default('0.70'),
  lastProcessedAt: timestamp('last_processed_at'),
  collectionSchedule: varchar('collection_schedule', { length: 50 }).default('2h'), // '30m', '2h', 'daily'
  keywords: text('keywords').array().default(sql`ARRAY[]::text[]`), // DbD-specific terms
  createdAt: timestamp('created_at').default(sql`now()`),
  updatedAt: timestamp('updated_at').default(sql`now()`),
});

export const pendingContent = pgTable('pending_content', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar('source_id').references(() => automatedSources.id).notNull(),
  profileId: varchar('profile_id').references(() => profiles.id).notNull(),
  rawContent: text('raw_content').notNull(),
  title: text('title'),
  sourceUrl: text('source_url'),
  extractedAt: timestamp('extracted_at').default(sql`now()`),
  processed: boolean('processed').default(false),
  approved: boolean('approved'),
  rejectionReason: text('rejection_reason'),
  processedAt: timestamp('processed_at'),
  metadata: json('metadata').default(sql`'{}'::json`) // Store upvotes, author, etc.
});

// Pre-Roll Ad Generation Tables
export const adTemplates = pgTable('ad_templates', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 'food', 'health', 'tech', 'home', 'automotive'
  template: text('template').notNull(), // Template with {SPONSOR}, {PRODUCT}, {BENEFIT} placeholders
  italianFlavor: varchar('italian_flavor', { length: 20 }).default('medium'), // 'light', 'medium', 'heavy'
  personalityTags: text('personality_tags').array().default(sql`ARRAY[]::text[]`), // Which facets work best
  isActive: boolean('is_active').default(true),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').default(sql`now()`),
  updatedAt: timestamp('updated_at').default(sql`now()`),
});

export const prerollAds = pgTable('preroll_ads', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar('profile_id').references(() => profiles.id).notNull(),
  templateId: varchar('template_id').references(() => adTemplates.id).notNull(),
  sponsorName: varchar('sponsor_name', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  adScript: text('ad_script').notNull(), // The generated ad content
  personalityFacet: text('personality_facet'), // Which facet was active during generation
  duration: integer('duration'), // Estimated duration in seconds
  variant: text('variant').$type<'normal' | 'forgot' | 'conspiracy' | 'family_story' | 'sketchy'>().default('normal'), // Ad read variant (normal, forgot halfway, conspiracy derail, etc.)
  productionStatus: text('production_status').$type<'draft' | 'approved' | 'recorded' | 'published' | 'rejected'>().default('draft'), // Production workflow status
  audioFilePath: text('audio_file_path'), // Path to recorded audio file if exists
  episodeId: text('episode_id'), // Which episode this ad was published in
  submittedBy: text('submitted_by'), // Username/source if community-submitted
  lastUsed: timestamp('last_used'),
  usageCount: integer('usage_count').default(0),
  rating: integer('rating'), // User can rate ads 1-5
  isFavorite: boolean('is_favorite').default(false),
  generatedAt: timestamp('generated_at').default(sql`now()`),
  updatedAt: timestamp('updated_at').default(sql`now()`),
});

// Relations for Discord tables
export const discordServersRelations = relations(discordServers, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [discordServers.profileId],
    references: [profiles.id],
  }),
  members: many(discordMembers),
  topicTriggers: many(discordTopicTriggers),
  conversations: many(discordConversations),
}));

export const discordMembersRelations = relations(discordMembers, ({ one }) => ({
  profile: one(profiles, {
    fields: [discordMembers.profileId],
    references: [profiles.id],
  }),
  server: one(discordServers, {
    fields: [discordMembers.serverId],
    references: [discordServers.id],
  }),
}));

export const discordTopicTriggersRelations = relations(discordTopicTriggers, ({ one }) => ({
  profile: one(profiles, {
    fields: [discordTopicTriggers.profileId],
    references: [profiles.id],
  }),
  server: one(discordServers, {
    fields: [discordTopicTriggers.serverId],
    references: [discordServers.id],
  }),
}));

export const discordConversationsRelations = relations(discordConversations, ({ one }) => ({
  profile: one(profiles, {
    fields: [discordConversations.profileId],
    references: [profiles.id],
  }),
  server: one(discordServers, {
    fields: [discordConversations.serverId],
    references: [discordServers.id],
  }),
}));

// Relations for DbD Ingestion tables
export const automatedSourcesRelations = relations(automatedSources, ({ one, many }) => ({
  profile: one(profiles, { 
    fields: [automatedSources.profileId], 
    references: [profiles.id] 
  }),
  pendingContent: many(pendingContent)
}));

export const pendingContentRelations = relations(pendingContent, ({ one }) => ({
  source: one(automatedSources, { 
    fields: [pendingContent.sourceId], 
    references: [automatedSources.id] 
  }),
  profile: one(profiles, { 
    fields: [pendingContent.profileId], 
    references: [profiles.id] 
  })
}));

// Insert schemas for Discord tables
export const insertDiscordServerSchema = createInsertSchema(discordServers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiscordMemberSchema = createInsertSchema(discordMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiscordTopicTriggerSchema = createInsertSchema(discordTopicTriggers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiscordConversationSchema = createInsertSchema(discordConversations).omit({
  id: true,
  createdAt: true,
});

// Insert schemas for DbD Ingestion tables
export const insertAutomatedSourceSchema = createInsertSchema(automatedSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPendingContentSchema = createInsertSchema(pendingContent).omit({
  id: true,
  extractedAt: true,
});

// Insert schemas for Pre-Roll Ad tables
export const insertAdTemplateSchema = createInsertSchema(adTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPrerollAdSchema = createInsertSchema(prerollAds).omit({
  id: true,
  generatedAt: true,
  updatedAt: true,
});

// Types for Discord tables
export type DiscordServer = typeof discordServers.$inferSelect;
export type InsertDiscordServer = z.infer<typeof insertDiscordServerSchema>;
export type DiscordMember = typeof discordMembers.$inferSelect;
export type InsertDiscordMember = z.infer<typeof insertDiscordMemberSchema>;
export type DiscordTopicTrigger = typeof discordTopicTriggers.$inferSelect;
export type InsertDiscordTopicTrigger = z.infer<typeof insertDiscordTopicTriggerSchema>;
export type DiscordConversation = typeof discordConversations.$inferSelect;
export type InsertDiscordConversation = z.infer<typeof insertDiscordConversationSchema>;
export type AutomatedSource = typeof automatedSources.$inferSelect;
export type InsertAutomatedSource = z.infer<typeof insertAutomatedSourceSchema>;
export type PendingContent = typeof pendingContent.$inferSelect;
export type InsertPendingContent = z.infer<typeof insertPendingContentSchema>;
export type AdTemplate = typeof adTemplates.$inferSelect;
export type InsertAdTemplate = z.infer<typeof insertAdTemplateSchema>;
export type PrerollAd = typeof prerollAds.$inferSelect;
export type InsertPrerollAd = z.infer<typeof insertPrerollAdSchema>;

// Dynamic behavior types
export type EffectiveBehavior = {
  aggressiveness: number;
  responsiveness: number;
  unpredictability: number;
  dbdObsession: number;
  familyBusinessMode: number;
  lastUpdated: string;
  driftFactors: {
    timeOfDay: number;
    recentActivity: number;
    chaosMultiplier: number;
  };
};

export type BehaviorDrift = {
  aggressiveness: number;
  responsiveness: number;
  unpredictability: number;
  dbdObsession: number;
  familyBusinessMode: number;
};

export type ContextNudge = {
  type: 'mention_burst' | 'quiet_period' | 'keyword_trigger' | 'moderation_flag';
  strength: number; // -20 to +20
  expiresAt: string;
};

// Podcast system schemas
export const insertPodcastEpisodeSchema = createInsertSchema(podcastEpisodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPodcastSegmentSchema = createInsertSchema(podcastSegments).omit({
  id: true,
  createdAt: true,
});

export const insertListenerCitySchema = createInsertSchema(listenerCities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Memory Suggestions - For "Shadow Tagging" system
export const memorySuggestions = pgTable("memory_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  memoryId: varchar("memory_id").references(() => memoryEntries.id, { onDelete: 'cascade' }).notNull(),
  
  // What triggered this suggestion
  triggerType: text("trigger_type").$type<'REGEX' | 'AI' | 'MANUAL'>().notNull(),
  triggerValue: text("trigger_value").notNull(), // e.g., "Uncle Paulie" or "mask_dropped"
  
  // The suggested change
  suggestedAction: text("suggested_action").$type<'BOOST_IMPORTANCE' | 'ADD_TAG' | 'FLAG_FOR_TRAINING'>().notNull(),
  suggestedValue: jsonb("suggested_value").notNull(), // e.g., { importance: 8 } or { tag: "family" }
  
  // Status
  status: text("status").$type<'PENDING' | 'APPROVED' | 'REJECTED'>().default('PENDING'),
  
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const memorySuggestionsRelations = relations(memorySuggestions, ({ one }) => ({
  profile: one(profiles, {
    fields: [memorySuggestions.profileId],
    references: [profiles.id],
  }),
  memory: one(memoryEntries, {
    fields: [memorySuggestions.memoryId],
    references: [memoryEntries.id],
  }),
}));

export const insertMemorySuggestionSchema = createInsertSchema(memorySuggestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MemorySuggestion = typeof memorySuggestions.$inferSelect;
export type InsertMemorySuggestion = z.infer<typeof insertMemorySuggestionSchema>;

// Podcast system types
export type PodcastEpisode = typeof podcastEpisodes.$inferSelect;
export type InsertPodcastEpisode = z.infer<typeof insertPodcastEpisodeSchema>;
export type PodcastSegment = typeof podcastSegments.$inferSelect;
export type InsertPodcastSegment = z.infer<typeof insertPodcastSegmentSchema>;
export type ListenerCity = typeof listenerCities.$inferSelect;
export type InsertListenerCity = z.infer<typeof insertListenerCitySchema>;
