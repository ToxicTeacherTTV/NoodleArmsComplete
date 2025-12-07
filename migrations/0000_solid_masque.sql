CREATE TABLE "ad_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"template" text NOT NULL,
	"italian_flavor" varchar(20) DEFAULT 'medium',
	"personality_tags" text[] DEFAULT ARRAY[]::text[],
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "automated_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_url" text,
	"is_active" boolean DEFAULT true,
	"confidence_multiplier" varchar(10) DEFAULT '0.70',
	"last_processed_at" timestamp,
	"collection_schedule" varchar(50) DEFAULT '2h',
	"keywords" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chaos_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"mode" text DEFAULT 'FULL_PSYCHO' NOT NULL,
	"last_mode_change" timestamp DEFAULT now(),
	"response_count" integer DEFAULT 0,
	"manual_override" integer,
	"override_expiry" timestamp,
	"is_global" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"canonical_name" text NOT NULL,
	"description" text,
	"category" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consolidated_personalities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"patterns" text NOT NULL,
	"training_example_ids" text[] NOT NULL,
	"status" text DEFAULT 'PENDING',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_flag_relations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flag_id" varchar NOT NULL,
	"related_flag_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar NOT NULL,
	"flag_type" text NOT NULL,
	"priority" text DEFAULT 'MEDIUM',
	"confidence" integer DEFAULT 80,
	"flag_reason" text NOT NULL,
	"extracted_data" json,
	"review_status" text DEFAULT 'PENDING',
	"reviewed_by" text,
	"review_notes" text,
	"reviewed_at" timestamp,
	"trigger_pattern" text,
	"action_taken" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_library" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'OTHER',
	"source" text,
	"source_id" varchar,
	"tags" text[],
	"difficulty" text,
	"mood" text,
	"length" text,
	"rating" integer DEFAULT 0,
	"notes" text,
	"is_favorite" boolean DEFAULT false,
	"last_accessed" timestamp,
	"access_count" integer DEFAULT 0,
	"embedding" text,
	"embedding_model" text,
	"embedding_updated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"session_id" varchar,
	"title" text,
	"is_archived" boolean DEFAULT false,
	"content_type" text DEFAULT 'GENERAL',
	"topic_tags" text[],
	"completed_stories" text[],
	"podcast_episode_id" varchar,
	"story_context" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discord_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"server_id" varchar NOT NULL,
	"channel_id" text NOT NULL,
	"channel_name" text NOT NULL,
	"message_id" text NOT NULL,
	"trigger_message" text NOT NULL,
	"nicky_response" text NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_data" json,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"processing_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discord_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"server_id" varchar NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"nickname" text,
	"facts" text[],
	"keywords" text[],
	"last_interaction" timestamp,
	"interaction_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discord_servers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"server_id" text NOT NULL,
	"server_name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"aggressiveness" integer DEFAULT 80,
	"responsiveness" integer DEFAULT 60,
	"unpredictability" integer DEFAULT 75,
	"dbd_obsession" integer DEFAULT 80,
	"family_business_mode" integer DEFAULT 40,
	"last_drift_update" timestamp DEFAULT now(),
	"drift_momentum" json DEFAULT '{}',
	"context_nudges" json DEFAULT '[]',
	"allowed_channels" json DEFAULT '[]',
	"blocked_channels" json DEFAULT '[]',
	"enabled_message_types" json DEFAULT '["dbd", "italian", "family_business", "aggressive", "random"]',
	"proactive_enabled" boolean DEFAULT true,
	"daily_proactive_count" integer DEFAULT 0,
	"last_proactive_date" text DEFAULT '',
	"unified_personality_migrated" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "discord_servers_server_id_unique" UNIQUE("server_id")
);
--> statement-breakpoint
CREATE TABLE "discord_topic_triggers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"server_id" varchar NOT NULL,
	"topic" text NOT NULL,
	"category" text DEFAULT 'MEDIUM',
	"response_chance" integer DEFAULT 75,
	"keywords" text[],
	"custom_response" text,
	"is_active" boolean DEFAULT true,
	"trigger_count" integer DEFAULT 0,
	"last_triggered" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"name" text,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"document_type" text DEFAULT 'DOCUMENT',
	"size" integer NOT NULL,
	"chunks" text[],
	"extracted_content" text,
	"processing_status" text DEFAULT 'PENDING',
	"processing_progress" integer DEFAULT 0,
	"processing_metadata" jsonb,
	"content_hash" varchar(64),
	"embedding" text,
	"embedding_model" text,
	"embedding_updated_at" timestamp,
	"retrieval_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "duplicate_scan_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"scan_depth" integer NOT NULL,
	"similarity_threshold" integer NOT NULL,
	"total_groups_found" integer DEFAULT 0,
	"total_duplicates_found" integer DEFAULT 0,
	"duplicate_groups" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entity_system_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_enabled" boolean DEFAULT false,
	"version" text DEFAULT '1.0',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"canonical_name" text NOT NULL,
	"event_date" text,
	"description" text,
	"is_canonical" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flag_auto_approval_flag_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auto_approval_id" varchar NOT NULL,
	"flag_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flag_auto_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"approval_date" text NOT NULL,
	"approval_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"canonical_name" text NOT NULL,
	"description" text,
	"type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "listener_cities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"city" text NOT NULL,
	"state_province" text,
	"country" text NOT NULL,
	"continent" text NOT NULL,
	"region" text,
	"is_covered" boolean DEFAULT false,
	"covered_date" timestamp,
	"covered_episode" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lore_characters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"relationship" text NOT NULL,
	"personality" text NOT NULL,
	"backstory" text NOT NULL,
	"last_activity" text,
	"activity_frequency" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lore_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text NOT NULL,
	"priority" integer DEFAULT 3,
	"last_mentioned" timestamp,
	"mention_count" integer DEFAULT 0,
	"related_characters" text[],
	"outcomes" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lore_historical_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"timeframe" text,
	"significance" integer DEFAULT 3,
	"participants" text[],
	"location" text,
	"consequences" text,
	"last_mentioned" timestamp,
	"mention_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lore_locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"significance" text NOT NULL,
	"current_status" text,
	"associated_characters" text[],
	"last_mentioned" timestamp,
	"mention_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lore_relationships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"entity_type_1" text NOT NULL,
	"entity_id_1" text NOT NULL,
	"entity_name_1" text NOT NULL,
	"entity_type_2" text NOT NULL,
	"entity_id_2" text NOT NULL,
	"entity_name_2" text NOT NULL,
	"relationship_type" text NOT NULL,
	"strength" integer DEFAULT 3,
	"description" text,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memory_concept_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" varchar NOT NULL,
	"concept_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memory_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"importance" integer DEFAULT 1,
	"retrieval_count" integer DEFAULT 0,
	"success_rate" integer DEFAULT 100,
	"last_used" timestamp,
	"cluster_id" varchar,
	"keywords" text[],
	"relationships" text[],
	"quality_score" integer DEFAULT 5,
	"temporal_context" text,
	"source" text,
	"confidence" integer DEFAULT 50,
	"source_id" varchar,
	"support_count" integer DEFAULT 1,
	"first_seen_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp DEFAULT now(),
	"contradiction_group_id" varchar,
	"canonical_key" text,
	"status" text DEFAULT 'ACTIVE',
	"is_protected" boolean DEFAULT false,
	"parent_fact_id" varchar,
	"is_atomic_fact" boolean DEFAULT false,
	"story_context" text,
	"embedding" vector(768),
	"embedding_model" text,
	"embedding_updated_at" timestamp,
	"search_vector" "tsvector",
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memory_event_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memory_item_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memory_misc_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" varchar NOT NULL,
	"misc_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memory_people_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memory_place_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" varchar NOT NULL,
	"place_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"rating" integer,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "misc_entities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"canonical_name" text NOT NULL,
	"description" text,
	"type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pending_content" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar NOT NULL,
	"profile_id" varchar NOT NULL,
	"raw_content" text NOT NULL,
	"title" text,
	"source_url" text,
	"extracted_at" timestamp DEFAULT now(),
	"processed" boolean DEFAULT false,
	"approved" boolean,
	"rejection_reason" text,
	"processed_at" timestamp,
	"metadata" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"canonical_name" text NOT NULL,
	"disambiguation" text,
	"aliases" jsonb,
	"relationship" text,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"canonical_name" text NOT NULL,
	"location_type" text,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "podcast_episodes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"guid" text,
	"podcast_name" text DEFAULT 'Camping Them Softly',
	"episode_number" integer,
	"season_number" integer,
	"title" text NOT NULL,
	"description" text,
	"air_date" timestamp,
	"published_at" timestamp,
	"duration" integer,
	"audio_url" text,
	"image_url" text,
	"guest_names" text[],
	"topics" text[],
	"transcript" text,
	"transcript_filename" text,
	"highlights" text[],
	"status" text DEFAULT 'DRAFT',
	"processing_status" text DEFAULT 'PENDING',
	"processing_progress" integer DEFAULT 0,
	"facts_extracted" integer DEFAULT 0,
	"entities_extracted" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"notes" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "podcast_segments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" integer,
	"end_time" integer,
	"segment_type" text DEFAULT 'MAIN_TOPIC',
	"participants" text[],
	"key_quotes" text[],
	"game_results" json,
	"transcript" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "preroll_ads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"sponsor_name" varchar(100) NOT NULL,
	"product_name" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"ad_script" text NOT NULL,
	"personality_facet" text,
	"duration" integer,
	"variant" text DEFAULT 'normal',
	"production_status" text DEFAULT 'draft',
	"audio_file_path" text,
	"episode_id" text,
	"submitted_by" text,
	"last_used" timestamp,
	"usage_count" integer DEFAULT 0,
	"rating" integer,
	"is_favorite" boolean DEFAULT false,
	"generated_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"core_identity" text NOT NULL,
	"knowledge_base" text DEFAULT '',
	"is_active" boolean DEFAULT false,
	"chaos_level" integer DEFAULT 80,
	"chaos_mode" text DEFAULT 'FULL_PSYCHO',
	"voice_id" text DEFAULT 'pNInz6obpgDQGcFmaJgB',
	"voice_settings" json DEFAULT '{"stability": 0.0}',
	"personality_baselines" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "topic_escalation" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"topic" text NOT NULL,
	"normalized_topic" text NOT NULL,
	"mention_count" integer DEFAULT 1,
	"current_intensity" integer DEFAULT 15,
	"max_intensity" integer DEFAULT 15,
	"last_mentioned" timestamp DEFAULT now(),
	"contexts" text[],
	"related_keywords" text[],
	"emotional_triggers" text[],
	"escalation_rate" integer DEFAULT 15,
	"cooling_rate" integer DEFAULT 5,
	"is_personal" boolean DEFAULT false,
	"family_honor_involved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "automated_sources" ADD CONSTRAINT "automated_sources_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consolidated_personalities" ADD CONSTRAINT "consolidated_personalities_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flag_relations" ADD CONSTRAINT "content_flag_relations_flag_id_content_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."content_flags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flag_relations" ADD CONSTRAINT "content_flag_relations_related_flag_id_content_flags_id_fk" FOREIGN KEY ("related_flag_id") REFERENCES "public"."content_flags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_library" ADD CONSTRAINT "content_library_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_conversations" ADD CONSTRAINT "discord_conversations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_conversations" ADD CONSTRAINT "discord_conversations_server_id_discord_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."discord_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_members" ADD CONSTRAINT "discord_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_members" ADD CONSTRAINT "discord_members_server_id_discord_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."discord_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_servers" ADD CONSTRAINT "discord_servers_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_topic_triggers" ADD CONSTRAINT "discord_topic_triggers_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_topic_triggers" ADD CONSTRAINT "discord_topic_triggers_server_id_discord_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."discord_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_scan_results" ADD CONSTRAINT "duplicate_scan_results_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_auto_approval_flag_links" ADD CONSTRAINT "flag_auto_approval_flag_links_auto_approval_id_flag_auto_approvals_id_fk" FOREIGN KEY ("auto_approval_id") REFERENCES "public"."flag_auto_approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_auto_approval_flag_links" ADD CONSTRAINT "flag_auto_approval_flag_links_flag_id_content_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."content_flags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_auto_approvals" ADD CONSTRAINT "flag_auto_approvals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listener_cities" ADD CONSTRAINT "listener_cities_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_characters" ADD CONSTRAINT "lore_characters_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_events" ADD CONSTRAINT "lore_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_historical_events" ADD CONSTRAINT "lore_historical_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_locations" ADD CONSTRAINT "lore_locations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_relationships" ADD CONSTRAINT "lore_relationships_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_concept_links" ADD CONSTRAINT "memory_concept_links_memory_id_memory_entries_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memory_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_concept_links" ADD CONSTRAINT "memory_concept_links_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_event_links" ADD CONSTRAINT "memory_event_links_memory_id_memory_entries_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memory_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_event_links" ADD CONSTRAINT "memory_event_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_item_links" ADD CONSTRAINT "memory_item_links_memory_id_memory_entries_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memory_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_item_links" ADD CONSTRAINT "memory_item_links_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_misc_links" ADD CONSTRAINT "memory_misc_links_memory_id_memory_entries_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memory_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_misc_links" ADD CONSTRAINT "memory_misc_links_misc_id_misc_entities_id_fk" FOREIGN KEY ("misc_id") REFERENCES "public"."misc_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_people_links" ADD CONSTRAINT "memory_people_links_memory_id_memory_entries_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memory_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_people_links" ADD CONSTRAINT "memory_people_links_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_place_links" ADD CONSTRAINT "memory_place_links_memory_id_memory_entries_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memory_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_place_links" ADD CONSTRAINT "memory_place_links_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "misc_entities" ADD CONSTRAINT "misc_entities_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_content" ADD CONSTRAINT "pending_content_source_id_automated_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."automated_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_content" ADD CONSTRAINT "pending_content_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "podcast_segments" ADD CONSTRAINT "podcast_segments_episode_id_podcast_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."podcast_episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preroll_ads" ADD CONSTRAINT "preroll_ads_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preroll_ads" ADD CONSTRAINT "preroll_ads_template_id_ad_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."ad_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_escalation" ADD CONSTRAINT "topic_escalation_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_content_flag_relation_idx" ON "content_flag_relations" USING btree ("flag_id","related_flag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_content_flag_idx" ON "content_flags" USING btree ("profile_id","target_type","target_id","flag_type");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_server_user_idx" ON "discord_members" USING btree ("server_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_document_content_hash_idx" ON "documents" USING btree ("profile_id","content_hash") WHERE "documents"."content_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_duplicate_scan_scope_idx" ON "duplicate_scan_results" USING btree ("profile_id","scan_depth","similarity_threshold") WHERE "duplicate_scan_results"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "unique_auto_approval_flag_idx" ON "flag_auto_approval_flag_links" USING btree ("auto_approval_id","flag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_date_profile_idx" ON "flag_auto_approvals" USING btree ("profile_id","approval_date");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_city_country_idx" ON "listener_cities" USING btree ("profile_id","city","country");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_profile_canonical_key_idx" ON "memory_entries" USING btree ("profile_id","canonical_key");--> statement-breakpoint
CREATE INDEX "memory_embedding_idx" ON "memory_entries" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_episode_guid_idx" ON "podcast_episodes" USING btree ("profile_id","guid");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_escalation_profile_topic_idx" ON "topic_escalation" USING btree ("profile_id","normalized_topic");