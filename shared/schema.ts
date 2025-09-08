import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, json, boolean } from "drizzle-orm/pg-core";
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
  type: text("type").$type<'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT'>().notNull(),
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
