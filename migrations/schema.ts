import { pgTable, foreignKey, varchar, text, integer, timestamp, uniqueIndex, json, boolean, jsonb, index, vector, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const loreCharacters = pgTable("lore_characters", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	name: text().notNull(),
	category: text().notNull(),
	relationship: text().notNull(),
	personality: text().notNull(),
	backstory: text().notNull(),
	lastActivity: text("last_activity"),
	activityFrequency: integer("activity_frequency").default(3),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "lore_characters_profile_id_profiles_id_fk"
		}),
]);

export const loreEvents = pgTable("lore_events", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	category: text().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	status: text().notNull(),
	priority: integer().default(3),
	lastMentioned: timestamp("last_mentioned", { mode: 'string' }),
	mentionCount: integer("mention_count").default(0),
	relatedCharacters: text("related_characters").array(),
	outcomes: text().array(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "lore_events_profile_id_profiles_id_fk"
		}),
]);

export const contentFlags = pgTable("content_flags", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	targetType: text("target_type").notNull(),
	targetId: varchar("target_id").notNull(),
	flagType: text("flag_type").notNull(),
	priority: text().default('MEDIUM'),
	confidence: integer().default(80),
	flagReason: text("flag_reason").notNull(),
	extractedData: json("extracted_data"),
	reviewStatus: text("review_status").default('PENDING'),
	reviewedBy: text("reviewed_by"),
	reviewNotes: text("review_notes"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	triggerPattern: text("trigger_pattern"),
	actionTaken: text("action_taken"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("unique_content_flag_idx").using("btree", table.profileId.asc().nullsLast().op("text_ops"), table.targetType.asc().nullsLast().op("text_ops"), table.targetId.asc().nullsLast().op("text_ops"), table.flagType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "content_flags_profile_id_profiles_id_fk"
		}),
]);

export const profiles = pgTable("profiles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	coreIdentity: text("core_identity").notNull(),
	knowledgeBase: text("knowledge_base").default('),
	isActive: boolean("is_active").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	chaosLevel: integer("chaos_level").default(80),
	chaosMode: text("chaos_mode").default('FULL_PSYCHO'),
	voiceId: text("voice_id").default('pNInz6obpgDQGcFmaJgB'),
	voiceSettings: json("voice_settings").default({"stability":0}),
	personalityBaselines: jsonb("personality_baselines"),
});

export const discordMembers = pgTable("discord_members", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	serverId: varchar("server_id").notNull(),
	userId: text("user_id").notNull(),
	username: text().notNull(),
	nickname: text(),
	facts: text().array(),
	keywords: text().array(),
	lastInteraction: timestamp("last_interaction", { mode: 'string' }),
	interactionCount: integer("interaction_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("unique_server_user_idx").using("btree", table.serverId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "discord_members_profile_id_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.serverId],
			foreignColumns: [discordServers.id],
			name: "discord_members_server_id_discord_servers_id_fk"
		}),
]);

export const conversations = pgTable("conversations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	sessionId: varchar("session_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	contentType: text("content_type").default('GENERAL'),
	topicTags: text("topic_tags").array(),
	completedStories: text("completed_stories").array(),
	podcastEpisodeId: varchar("podcast_episode_id"),
	storyContext: text("story_context"),
	title: text(),
	isArchived: boolean("is_archived").default(false),
	isPrivate: boolean("is_private").default(true),
	metadata: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "conversations_profile_id_profiles_id_fk"
		}),
]);

export const discordConversations = pgTable("discord_conversations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	serverId: varchar("server_id").notNull(),
	channelId: text("channel_id").notNull(),
	channelName: text("channel_name").notNull(),
	messageId: text("message_id").notNull(),
	triggerMessage: text("trigger_message").notNull(),
	nickyResponse: text("nicky_response").notNull(),
	triggerType: text("trigger_type").notNull(),
	triggerData: json("trigger_data"),
	userId: text("user_id").notNull(),
	username: text().notNull(),
	processingTime: integer("processing_time"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "discord_conversations_profile_id_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.serverId],
			foreignColumns: [discordServers.id],
			name: "discord_conversations_server_id_discord_servers_id_fk"
		}),
]);

export const memoryEntries = pgTable("memory_entries", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	type: text().notNull(),
	content: text().notNull(),
	importance: integer().default(1),
	retrievalCount: integer("retrieval_count").default(0),
	source: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	successRate: integer("success_rate").default(100),
	lastUsed: timestamp("last_used", { mode: 'string' }),
	clusterId: varchar("cluster_id"),
	keywords: text().array(),
	relationships: text().array(),
	qualityScore: integer("quality_score").default(5),
	temporalContext: text("temporal_context"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	confidence: integer().default(50),
	sourceId: varchar("source_id"),
	supportCount: integer("support_count").default(1),
	firstSeenAt: timestamp("first_seen_at", { mode: 'string' }).defaultNow(),
	lastSeenAt: timestamp("last_seen_at", { mode: 'string' }).defaultNow(),
	contradictionGroupId: varchar("contradiction_group_id"),
	canonicalKey: text("canonical_key"),
	status: text().default('ACTIVE'),
	parentFactId: varchar("parent_fact_id"),
	isAtomicFact: boolean("is_atomic_fact").default(false),
	storyContext: text("story_context"),
	isProtected: boolean("is_protected").default(false),
	embeddingModel: text("embedding_model"),
	embeddingUpdatedAt: timestamp("embedding_updated_at", { mode: 'string' }),
	// TODO: failed to parse database type 'tsvector'
	searchVector: unknown("search_vector"),
	embedding: vector({ dimensions: 768 }),
	tags: text().array(),
	lane: text().default('CANON').notNull(),
	truthDomain: text("truth_domain").default('GENERAL'),
	origin: text().default('SYSTEM'),
}, (table) => [
	index("memory_embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	uniqueIndex("unique_profile_canonical_key_idx").using("btree", table.profileId.asc().nullsLast().op("text_ops"), table.canonicalKey.asc().nullsLast().op("text_ops"), table.lane.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "memory_entries_profile_id_profiles_id_fk"
		}),
]);

export const documents = pgTable("documents", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	filename: text().notNull(),
	contentType: text("content_type").notNull(),
	size: integer().notNull(),
	chunks: text().array(),
	extractedContent: text("extracted_content"),
	processingStatus: text("processing_status").default('PENDING'),
	retrievalCount: integer("retrieval_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	name: text(),
	processingProgress: integer("processing_progress").default(0),
	documentType: text("document_type").default('DOCUMENT'),
	processingMetadata: jsonb("processing_metadata"),
	contentHash: varchar("content_hash", { length: 64 }),
	embedding: text(),
	embeddingModel: text("embedding_model"),
	embeddingUpdatedAt: timestamp("embedding_updated_at", { mode: 'string' }),
}, (table) => [
	uniqueIndex("unique_document_content_hash_idx").using("btree", table.profileId.asc().nullsLast().op("text_ops"), table.contentHash.asc().nullsLast().op("text_ops")).where(sql`(content_hash IS NOT NULL)`),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "documents_profile_id_profiles_id_fk"
		}),
]);

export const loreRelationships = pgTable("lore_relationships", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	entityType1: text("entity_type_1").notNull(),
	entityId1: text("entity_id_1").notNull(),
	entityName1: text("entity_name_1").notNull(),
	entityType2: text("entity_type_2").notNull(),
	entityId2: text("entity_id_2").notNull(),
	entityName2: text("entity_name_2").notNull(),
	relationshipType: text("relationship_type").notNull(),
	strength: integer().default(3),
	description: text(),
	status: text().default('active'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "lore_relationships_profile_id_profiles_id_fk"
		}),
]);

export const loreHistoricalEvents = pgTable("lore_historical_events", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	title: text().notNull(),
	description: text().notNull(),
	category: text().notNull(),
	timeframe: text(),
	significance: integer().default(3),
	participants: text().array(),
	location: text(),
	consequences: text(),
	lastMentioned: timestamp("last_mentioned", { mode: 'string' }),
	mentionCount: integer("mention_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "lore_historical_events_profile_id_profiles_id_fk"
		}),
]);

export const loreLocations = pgTable("lore_locations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	name: text().notNull(),
	category: text().notNull(),
	description: text().notNull(),
	significance: text().notNull(),
	currentStatus: text("current_status"),
	associatedCharacters: text("associated_characters").array(),
	lastMentioned: timestamp("last_mentioned", { mode: 'string' }),
	mentionCount: integer("mention_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "lore_locations_profile_id_profiles_id_fk"
		}),
]);

export const discordServers = pgTable("discord_servers", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	serverId: text("server_id").notNull(),
	serverName: text("server_name").notNull(),
	isActive: boolean("is_active").default(true),
	aggressiveness: integer().default(80),
	responsiveness: integer().default(60),
	unpredictability: integer().default(75),
	dbdObsession: integer("dbd_obsession").default(80),
	familyBusinessMode: integer("family_business_mode").default(40),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	lastDriftUpdate: timestamp("last_drift_update", { mode: 'string' }).defaultNow(),
	driftMomentum: json("drift_momentum").default({}),
	contextNudges: json("context_nudges").default([]),
	allowedChannels: json("allowed_channels").default([]),
	blockedChannels: json("blocked_channels").default([]),
	enabledMessageTypes: json("enabled_message_types").default(["dbd","italian","family_business","aggressive","random"]),
	proactiveEnabled: boolean("proactive_enabled").default(true),
	dailyProactiveCount: integer("daily_proactive_count").default(0),
	lastProactiveDate: text("last_proactive_date").default('),
	unifiedPersonalityMigrated: boolean("unified_personality_migrated").default(false),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "discord_servers_profile_id_profiles_id_fk"
		}),
	unique("discord_servers_server_id_unique").on(table.serverId),
]);

export const discordTopicTriggers = pgTable("discord_topic_triggers", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	serverId: varchar("server_id").notNull(),
	topic: text().notNull(),
	category: text().default('MEDIUM'),
	responseChance: integer("response_chance").default(75),
	keywords: text().array(),
	customResponse: text("custom_response"),
	isActive: boolean("is_active").default(true),
	triggerCount: integer("trigger_count").default(0),
	lastTriggered: timestamp("last_triggered", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "discord_topic_triggers_profile_id_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.serverId],
			foreignColumns: [discordServers.id],
			name: "discord_topic_triggers_server_id_discord_servers_id_fk"
		}),
]);

export const automatedSources = pgTable("automated_sources", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	sourceType: varchar("source_type", { length: 50 }).notNull(),
	sourceUrl: text("source_url"),
	isActive: boolean("is_active").default(true),
	confidenceMultiplier: varchar("confidence_multiplier", { length: 10 }).default('0.70'),
	lastProcessedAt: timestamp("last_processed_at", { mode: 'string' }),
	collectionSchedule: varchar("collection_schedule", { length: 50 }).default('2h'),
	keywords: text().array().default(["RAY"]),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "automated_sources_profile_id_profiles_id_fk"
		}),
]);

export const pendingContent = pgTable("pending_content", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	sourceId: varchar("source_id").notNull(),
	profileId: varchar("profile_id").notNull(),
	rawContent: text("raw_content").notNull(),
	title: text(),
	sourceUrl: text("source_url"),
	extractedAt: timestamp("extracted_at", { mode: 'string' }).defaultNow(),
	processed: boolean().default(false),
	approved: boolean(),
	rejectionReason: text("rejection_reason"),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	metadata: json().default({}),
}, (table) => [
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [automatedSources.id],
			name: "pending_content_source_id_automated_sources_id_fk"
		}),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "pending_content_profile_id_profiles_id_fk"
		}),
]);

export const messages = pgTable("messages", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	conversationId: varchar("conversation_id").notNull(),
	type: text().notNull(),
	content: text().notNull(),
	metadata: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	rating: integer(),
	isPrivate: boolean("is_private").default(true),
}, (table) => [
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}),
]);

export const adTemplates = pgTable("ad_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	category: varchar({ length: 50 }).notNull(),
	template: text().notNull(),
	italianFlavor: varchar("italian_flavor", { length: 20 }).default('medium'),
	personalityTags: text("personality_tags").array().default(["RAY"]),
	isActive: boolean("is_active").default(true),
	usageCount: integer("usage_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const podcastSegments = pgTable("podcast_segments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	episodeId: varchar("episode_id").notNull(),
	title: text().notNull(),
	description: text(),
	startTime: integer("start_time"),
	endTime: integer("end_time"),
	segmentType: text("segment_type").default('MAIN_TOPIC'),
	participants: text().array(),
	keyQuotes: text("key_quotes").array(),
	gameResults: json("game_results"),
	transcript: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.episodeId],
			foreignColumns: [podcastEpisodes.id],
			name: "podcast_segments_episode_id_podcast_episodes_id_fk"
		}),
]);

export const chaosState = pgTable("chaos_state", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	level: integer().default(0).notNull(),
	mode: text().default('FULL_PSYCHO').notNull(),
	lastModeChange: timestamp("last_mode_change", { mode: 'string' }).defaultNow(),
	responseCount: integer("response_count").default(0),
	manualOverride: integer("manual_override"),
	isGlobal: boolean("is_global").default(true),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	overrideExpiry: timestamp("override_expiry", { mode: 'string' }),
	sauceMeter: integer("sauce_meter").default(0).notNull(),
});

export const contentLibrary = pgTable("content_library", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	title: text().notNull(),
	content: text().notNull(),
	category: text().default('OTHER'),
	source: text(),
	sourceId: varchar("source_id"),
	tags: text().array(),
	difficulty: text(),
	mood: text(),
	length: text(),
	rating: integer().default(0),
	notes: text(),
	isFavorite: boolean("is_favorite").default(false),
	lastAccessed: timestamp("last_accessed", { mode: 'string' }),
	accessCount: integer("access_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	embedding: text(),
	embeddingModel: text("embedding_model"),
	embeddingUpdatedAt: timestamp("embedding_updated_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "content_library_profile_id_profiles_id_fk"
		}),
]);

export const entitySystemConfig = pgTable("entity_system_config", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	isEnabled: boolean("is_enabled").default(false),
	version: text().default('1.0'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const events = pgTable("events", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	canonicalName: text("canonical_name").notNull(),
	eventDate: text("event_date"),
	description: text(),
	isCanonical: boolean("is_canonical").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "events_profile_id_profiles_id_fk"
		}),
]);

export const people = pgTable("people", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	canonicalName: text("canonical_name").notNull(),
	disambiguation: text(),
	aliases: jsonb(),
	relationship: text(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "people_profile_id_profiles_id_fk"
		}),
]);

export const places = pgTable("places", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	canonicalName: text("canonical_name").notNull(),
	locationType: text("location_type"),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "places_profile_id_profiles_id_fk"
		}),
]);

export const consolidatedPersonalities = pgTable("consolidated_personalities", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	patterns: text().notNull(),
	trainingExampleIds: text("training_example_ids").array().notNull(),
	status: text().default('PENDING'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "consolidated_personalities_profile_id_profiles_id_fk"
		}),
]);

export const memoryEventLinks = pgTable("memory_event_links", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	memoryId: varchar("memory_id").notNull(),
	eventId: varchar("event_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.memoryId],
			foreignColumns: [memoryEntries.id],
			name: "memory_event_links_memory_id_memory_entries_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [events.id],
			name: "memory_event_links_event_id_events_id_fk"
		}).onDelete("cascade"),
]);

export const topicEscalation = pgTable("topic_escalation", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	topic: text().notNull(),
	normalizedTopic: text("normalized_topic").notNull(),
	mentionCount: integer("mention_count").default(1),
	currentIntensity: integer("current_intensity").default(15),
	maxIntensity: integer("max_intensity").default(15),
	lastMentioned: timestamp("last_mentioned", { mode: 'string' }).defaultNow(),
	contexts: text().array(),
	relatedKeywords: text("related_keywords").array(),
	emotionalTriggers: text("emotional_triggers").array(),
	escalationRate: integer("escalation_rate").default(15),
	coolingRate: integer("cooling_rate").default(5),
	isPersonal: boolean("is_personal").default(false),
	familyHonorInvolved: boolean("family_honor_involved").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("topic_escalation_profile_topic_idx").using("btree", table.profileId.asc().nullsLast().op("text_ops"), table.normalizedTopic.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "topic_escalation_profile_id_profiles_id_fk"
		}),
]);

export const flagAutoApprovals = pgTable("flag_auto_approvals", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	approvalDate: text("approval_date").notNull(),
	approvalCount: integer("approval_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("unique_date_profile_idx").using("btree", table.profileId.asc().nullsLast().op("text_ops"), table.approvalDate.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "flag_auto_approvals_profile_id_profiles_id_fk"
		}),
]);

export const memoryPeopleLinks = pgTable("memory_people_links", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	memoryId: varchar("memory_id").notNull(),
	personId: varchar("person_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.memoryId],
			foreignColumns: [memoryEntries.id],
			name: "memory_people_links_memory_id_memory_entries_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.personId],
			foreignColumns: [people.id],
			name: "memory_people_links_person_id_people_id_fk"
		}).onDelete("cascade"),
]);

export const memoryPlaceLinks = pgTable("memory_place_links", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	memoryId: varchar("memory_id").notNull(),
	placeId: varchar("place_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.memoryId],
			foreignColumns: [memoryEntries.id],
			name: "memory_place_links_memory_id_memory_entries_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.placeId],
			foreignColumns: [places.id],
			name: "memory_place_links_place_id_places_id_fk"
		}).onDelete("cascade"),
]);

export const duplicateScanResults = pgTable("duplicate_scan_results", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	scanDepth: integer("scan_depth").notNull(),
	similarityThreshold: integer("similarity_threshold").notNull(),
	totalGroupsFound: integer("total_groups_found").default(0),
	totalDuplicatesFound: integer("total_duplicates_found").default(0),
	duplicateGroups: jsonb("duplicate_groups").default([]),
	status: text().default('ACTIVE'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("unique_duplicate_scan_scope_idx").using("btree", table.profileId.asc().nullsLast().op("int4_ops"), table.scanDepth.asc().nullsLast().op("text_ops"), table.similarityThreshold.asc().nullsLast().op("int4_ops")).where(sql`(status = 'ACTIVE'::text)`),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "duplicate_scan_results_profile_id_profiles_id_fk"
		}),
]);

export const podcastEpisodes = pgTable("podcast_episodes", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	episodeNumber: integer("episode_number"),
	title: text().notNull(),
	description: text(),
	airDate: timestamp("air_date", { mode: 'string' }),
	duration: integer(),
	guestNames: text("guest_names").array(),
	topics: text().array(),
	transcript: text(),
	highlights: text().array(),
	status: text().default('DRAFT'),
	viewCount: integer("view_count").default(0),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	guid: text(),
	seasonNumber: integer("season_number"),
	publishedAt: timestamp("published_at", { mode: 'string' }),
	audioUrl: text("audio_url"),
	imageUrl: text("image_url"),
	transcriptFilename: text("transcript_filename"),
	processingStatus: text("processing_status").default('PENDING'),
	processingProgress: integer("processing_progress").default(0),
	factsExtracted: integer("facts_extracted").default(0),
	entitiesExtracted: integer("entities_extracted").default(0),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	podcastName: text("podcast_name").default('Camping Them Softly'),
}, (table) => [
	uniqueIndex("unique_episode_guid_idx").using("btree", table.profileId.asc().nullsLast().op("text_ops"), table.guid.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "podcast_episodes_profile_id_profiles_id_fk"
		}),
]);

export const contentFlagRelations = pgTable("content_flag_relations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	flagId: varchar("flag_id").notNull(),
	relatedFlagId: varchar("related_flag_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("unique_content_flag_relation_idx").using("btree", table.flagId.asc().nullsLast().op("text_ops"), table.relatedFlagId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.flagId],
			foreignColumns: [contentFlags.id],
			name: "content_flag_relations_flag_id_content_flags_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.relatedFlagId],
			foreignColumns: [contentFlags.id],
			name: "content_flag_relations_related_flag_id_content_flags_id_fk"
		}).onDelete("cascade"),
]);

export const flagAutoApprovalFlagLinks = pgTable("flag_auto_approval_flag_links", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	autoApprovalId: varchar("auto_approval_id").notNull(),
	flagId: varchar("flag_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("unique_auto_approval_flag_idx").using("btree", table.autoApprovalId.asc().nullsLast().op("text_ops"), table.flagId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.flagId],
			foreignColumns: [contentFlags.id],
			name: "flag_auto_approval_flag_links_flag_id_content_flags_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.autoApprovalId],
			foreignColumns: [flagAutoApprovals.id],
			name: "flag_auto_approval_flag_links_auto_approval_id_flag_auto_approv"
		}).onDelete("cascade"),
]);

export const prerollAds = pgTable("preroll_ads", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	templateId: varchar("template_id").notNull(),
	sponsorName: varchar("sponsor_name", { length: 100 }).notNull(),
	productName: varchar("product_name", { length: 100 }).notNull(),
	category: varchar({ length: 50 }).notNull(),
	adScript: text("ad_script").notNull(),
	personalityFacet: text("personality_facet"),
	duration: integer(),
	lastUsed: timestamp("last_used", { mode: 'string' }),
	usageCount: integer("usage_count").default(0),
	rating: integer(),
	isFavorite: boolean("is_favorite").default(false),
	generatedAt: timestamp("generated_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	productionStatus: text("production_status").default('draft'),
	audioFilePath: text("audio_file_path"),
	episodeId: text("episode_id"),
	submittedBy: text("submitted_by"),
	variant: text().default('normal'),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "preroll_ads_profile_id_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [adTemplates.id],
			name: "preroll_ads_template_id_ad_templates_id_fk"
		}),
]);

export const listenerCities = pgTable("listener_cities", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	city: text().notNull(),
	stateProvince: text("state_province"),
	country: text().notNull(),
	continent: text().notNull(),
	region: text(),
	isCovered: boolean("is_covered").default(false),
	coveredDate: timestamp("covered_date", { mode: 'string' }),
	coveredEpisode: text("covered_episode"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("unique_city_country_idx").using("btree", table.profileId.asc().nullsLast().op("text_ops"), table.city.asc().nullsLast().op("text_ops"), table.country.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "listener_cities_profile_id_profiles_id_fk"
		}),
]);

export const items = pgTable("items", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	canonicalName: text("canonical_name").notNull(),
	description: text(),
	type: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "items_profile_id_profiles_id_fk"
		}),
]);

export const memoryConceptLinks = pgTable("memory_concept_links", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	memoryId: varchar("memory_id").notNull(),
	conceptId: varchar("concept_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.memoryId],
			foreignColumns: [memoryEntries.id],
			name: "memory_concept_links_memory_id_memory_entries_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.conceptId],
			foreignColumns: [concepts.id],
			name: "memory_concept_links_concept_id_concepts_id_fk"
		}).onDelete("cascade"),
]);

export const memoryItemLinks = pgTable("memory_item_links", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	memoryId: varchar("memory_id").notNull(),
	itemId: varchar("item_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.memoryId],
			foreignColumns: [memoryEntries.id],
			name: "memory_item_links_memory_id_memory_entries_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [items.id],
			name: "memory_item_links_item_id_items_id_fk"
		}).onDelete("cascade"),
]);

export const memoryMiscLinks = pgTable("memory_misc_links", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	memoryId: varchar("memory_id").notNull(),
	miscId: varchar("misc_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.memoryId],
			foreignColumns: [memoryEntries.id],
			name: "memory_misc_links_memory_id_memory_entries_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.miscId],
			foreignColumns: [miscEntities.id],
			name: "memory_misc_links_misc_id_misc_entities_id_fk"
		}).onDelete("cascade"),
]);

export const concepts = pgTable("concepts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	canonicalName: text("canonical_name").notNull(),
	description: text(),
	category: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "concepts_profile_id_profiles_id_fk"
		}),
]);

export const miscEntities = pgTable("misc_entities", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	canonicalName: text("canonical_name").notNull(),
	description: text(),
	type: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "misc_entities_profile_id_profiles_id_fk"
		}),
]);

export const memorySuggestions = pgTable("memory_suggestions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	memoryId: varchar("memory_id").notNull(),
	triggerType: text("trigger_type").notNull(),
	triggerValue: text("trigger_value").notNull(),
	suggestedAction: text("suggested_action").notNull(),
	suggestedValue: jsonb("suggested_value").notNull(),
	status: text().default('PENDING'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "memory_suggestions_profile_id_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.memoryId],
			foreignColumns: [memoryEntries.id],
			name: "memory_suggestions_memory_id_memory_entries_id_fk"
		}).onDelete("cascade"),
]);

export const personalityState = pgTable("personality_state", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	profileId: varchar("profile_id").notNull(),
	basePersonality: jsonb("base_personality").notNull(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow(),
	source: text().notNull(),
	isGlobal: boolean("is_global").default(true),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "personality_state_profile_id_profiles_id_fk"
		}),
]);

export const varietyState = pgTable("variety_state", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	conversationId: varchar("conversation_id").notNull(),
	state: jsonb().notNull(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow(),
});
