import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, json, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

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
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  }>().default(sql`'{"stability": 0.0, "similarity_boost": 0.75}'`),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  sessionId: varchar("session_id"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  type: text("type").$type<'USER' | 'AI' | 'CHATTER' | 'SYSTEM'>().notNull(),
  content: text("content").notNull(),
  metadata: json("metadata").$type<{
    voice?: boolean;
    speaker?: string;
    processingTime?: number;
    retrieved_context?: string;
  }>(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  chunks: text("chunks").array(),
  extractedContent: text("extracted_content"),
  processingStatus: text("processing_status").$type<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>().default('PENDING'),
  retrievalCount: integer("retrieval_count").default(0),
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
  // Hierarchical fact support  
  parentFactId: varchar("parent_fact_id"), // Links atomic facts to parent stories (self-reference removed to avoid circular dependency)
  isAtomicFact: boolean("is_atomic_fact").default(false), // True for granular facts extracted from stories
  storyContext: text("story_context"), // Brief context about which part of the story this relates to
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
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

// Insert schemas
export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
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

export const insertMemoryEntrySchema = createInsertSchema(memoryEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type InsertMemoryEntry = z.infer<typeof insertMemoryEntrySchema>;

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
    'fourth_wall_break' | 'ooc_behavior' |
    // Additional Categories
    'pasta_related' | 'dbd_gameplay' | 'family_mention' | 'romance_failure' | 'criminal_activity'
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
  relatedFlags: text("related_flags").array(), // IDs of related flags for batch processing
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
  italianIntensity: integer("italian_intensity").default(100), // 0-100
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

// Dynamic behavior types
export type EffectiveBehavior = {
  aggressiveness: number;
  responsiveness: number;
  italianIntensity: number;
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
  italianIntensity: number;
  dbdObsession: number;
  familyBusinessMode: number;
};

export type ContextNudge = {
  type: 'mention_burst' | 'quiet_period' | 'keyword_trigger' | 'moderation_flag';
  strength: number; // -20 to +20
  expiresAt: string;
};
