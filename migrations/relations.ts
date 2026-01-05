import { relations } from "drizzle-orm/relations";
import { profiles, loreCharacters, loreEvents, contentFlags, discordMembers, discordServers, conversations, discordConversations, memoryEntries, documents, loreRelationships, loreHistoricalEvents, loreLocations, discordTopicTriggers, automatedSources, pendingContent, messages, podcastEpisodes, podcastSegments, contentLibrary, events, people, places, consolidatedPersonalities, memoryEventLinks, topicEscalation, flagAutoApprovals, memoryPeopleLinks, memoryPlaceLinks, duplicateScanResults, contentFlagRelations, flagAutoApprovalFlagLinks, prerollAds, adTemplates, listenerCities, items, memoryConceptLinks, concepts, memoryItemLinks, memoryMiscLinks, miscEntities, memorySuggestions, personalityState } from "./schema";

export const loreCharactersRelations = relations(loreCharacters, ({one}) => ({
	profile: one(profiles, {
		fields: [loreCharacters.profileId],
		references: [profiles.id]
	}),
}));

export const profilesRelations = relations(profiles, ({many}) => ({
	loreCharacters: many(loreCharacters),
	loreEvents: many(loreEvents),
	contentFlags: many(contentFlags),
	discordMembers: many(discordMembers),
	conversations: many(conversations),
	discordConversations: many(discordConversations),
	memoryEntries: many(memoryEntries),
	documents: many(documents),
	loreRelationships: many(loreRelationships),
	loreHistoricalEvents: many(loreHistoricalEvents),
	loreLocations: many(loreLocations),
	discordServers: many(discordServers),
	discordTopicTriggers: many(discordTopicTriggers),
	automatedSources: many(automatedSources),
	pendingContents: many(pendingContent),
	contentLibraries: many(contentLibrary),
	events: many(events),
	people: many(people),
	places: many(places),
	consolidatedPersonalities: many(consolidatedPersonalities),
	topicEscalations: many(topicEscalation),
	flagAutoApprovals: many(flagAutoApprovals),
	duplicateScanResults: many(duplicateScanResults),
	podcastEpisodes: many(podcastEpisodes),
	prerollAds: many(prerollAds),
	listenerCities: many(listenerCities),
	items: many(items),
	concepts: many(concepts),
	miscEntities: many(miscEntities),
	memorySuggestions: many(memorySuggestions),
	personalityStates: many(personalityState),
}));

export const loreEventsRelations = relations(loreEvents, ({one}) => ({
	profile: one(profiles, {
		fields: [loreEvents.profileId],
		references: [profiles.id]
	}),
}));

export const contentFlagsRelations = relations(contentFlags, ({one, many}) => ({
	profile: one(profiles, {
		fields: [contentFlags.profileId],
		references: [profiles.id]
	}),
	contentFlagRelations_flagId: many(contentFlagRelations, {
		relationName: "contentFlagRelations_flagId_contentFlags_id"
	}),
	contentFlagRelations_relatedFlagId: many(contentFlagRelations, {
		relationName: "contentFlagRelations_relatedFlagId_contentFlags_id"
	}),
	flagAutoApprovalFlagLinks: many(flagAutoApprovalFlagLinks),
}));

export const discordMembersRelations = relations(discordMembers, ({one}) => ({
	profile: one(profiles, {
		fields: [discordMembers.profileId],
		references: [profiles.id]
	}),
	discordServer: one(discordServers, {
		fields: [discordMembers.serverId],
		references: [discordServers.id]
	}),
}));

export const discordServersRelations = relations(discordServers, ({one, many}) => ({
	discordMembers: many(discordMembers),
	discordConversations: many(discordConversations),
	profile: one(profiles, {
		fields: [discordServers.profileId],
		references: [profiles.id]
	}),
	discordTopicTriggers: many(discordTopicTriggers),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	profile: one(profiles, {
		fields: [conversations.profileId],
		references: [profiles.id]
	}),
	messages: many(messages),
}));

export const discordConversationsRelations = relations(discordConversations, ({one}) => ({
	profile: one(profiles, {
		fields: [discordConversations.profileId],
		references: [profiles.id]
	}),
	discordServer: one(discordServers, {
		fields: [discordConversations.serverId],
		references: [discordServers.id]
	}),
}));

export const memoryEntriesRelations = relations(memoryEntries, ({one, many}) => ({
	profile: one(profiles, {
		fields: [memoryEntries.profileId],
		references: [profiles.id]
	}),
	memoryEventLinks: many(memoryEventLinks),
	memoryPeopleLinks: many(memoryPeopleLinks),
	memoryPlaceLinks: many(memoryPlaceLinks),
	memoryConceptLinks: many(memoryConceptLinks),
	memoryItemLinks: many(memoryItemLinks),
	memoryMiscLinks: many(memoryMiscLinks),
	memorySuggestions: many(memorySuggestions),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	profile: one(profiles, {
		fields: [documents.profileId],
		references: [profiles.id]
	}),
}));

export const loreRelationshipsRelations = relations(loreRelationships, ({one}) => ({
	profile: one(profiles, {
		fields: [loreRelationships.profileId],
		references: [profiles.id]
	}),
}));

export const loreHistoricalEventsRelations = relations(loreHistoricalEvents, ({one}) => ({
	profile: one(profiles, {
		fields: [loreHistoricalEvents.profileId],
		references: [profiles.id]
	}),
}));

export const loreLocationsRelations = relations(loreLocations, ({one}) => ({
	profile: one(profiles, {
		fields: [loreLocations.profileId],
		references: [profiles.id]
	}),
}));

export const discordTopicTriggersRelations = relations(discordTopicTriggers, ({one}) => ({
	profile: one(profiles, {
		fields: [discordTopicTriggers.profileId],
		references: [profiles.id]
	}),
	discordServer: one(discordServers, {
		fields: [discordTopicTriggers.serverId],
		references: [discordServers.id]
	}),
}));

export const automatedSourcesRelations = relations(automatedSources, ({one, many}) => ({
	profile: one(profiles, {
		fields: [automatedSources.profileId],
		references: [profiles.id]
	}),
	pendingContents: many(pendingContent),
}));

export const pendingContentRelations = relations(pendingContent, ({one}) => ({
	automatedSource: one(automatedSources, {
		fields: [pendingContent.sourceId],
		references: [automatedSources.id]
	}),
	profile: one(profiles, {
		fields: [pendingContent.profileId],
		references: [profiles.id]
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
}));

export const podcastSegmentsRelations = relations(podcastSegments, ({one}) => ({
	podcastEpisode: one(podcastEpisodes, {
		fields: [podcastSegments.episodeId],
		references: [podcastEpisodes.id]
	}),
}));

export const podcastEpisodesRelations = relations(podcastEpisodes, ({one, many}) => ({
	podcastSegments: many(podcastSegments),
	profile: one(profiles, {
		fields: [podcastEpisodes.profileId],
		references: [profiles.id]
	}),
}));

export const contentLibraryRelations = relations(contentLibrary, ({one}) => ({
	profile: one(profiles, {
		fields: [contentLibrary.profileId],
		references: [profiles.id]
	}),
}));

export const eventsRelations = relations(events, ({one, many}) => ({
	profile: one(profiles, {
		fields: [events.profileId],
		references: [profiles.id]
	}),
	memoryEventLinks: many(memoryEventLinks),
}));

export const peopleRelations = relations(people, ({one, many}) => ({
	profile: one(profiles, {
		fields: [people.profileId],
		references: [profiles.id]
	}),
	memoryPeopleLinks: many(memoryPeopleLinks),
}));

export const placesRelations = relations(places, ({one, many}) => ({
	profile: one(profiles, {
		fields: [places.profileId],
		references: [profiles.id]
	}),
	memoryPlaceLinks: many(memoryPlaceLinks),
}));

export const consolidatedPersonalitiesRelations = relations(consolidatedPersonalities, ({one}) => ({
	profile: one(profiles, {
		fields: [consolidatedPersonalities.profileId],
		references: [profiles.id]
	}),
}));

export const memoryEventLinksRelations = relations(memoryEventLinks, ({one}) => ({
	memoryEntry: one(memoryEntries, {
		fields: [memoryEventLinks.memoryId],
		references: [memoryEntries.id]
	}),
	event: one(events, {
		fields: [memoryEventLinks.eventId],
		references: [events.id]
	}),
}));

export const topicEscalationRelations = relations(topicEscalation, ({one}) => ({
	profile: one(profiles, {
		fields: [topicEscalation.profileId],
		references: [profiles.id]
	}),
}));

export const flagAutoApprovalsRelations = relations(flagAutoApprovals, ({one, many}) => ({
	profile: one(profiles, {
		fields: [flagAutoApprovals.profileId],
		references: [profiles.id]
	}),
	flagAutoApprovalFlagLinks: many(flagAutoApprovalFlagLinks),
}));

export const memoryPeopleLinksRelations = relations(memoryPeopleLinks, ({one}) => ({
	memoryEntry: one(memoryEntries, {
		fields: [memoryPeopleLinks.memoryId],
		references: [memoryEntries.id]
	}),
	person: one(people, {
		fields: [memoryPeopleLinks.personId],
		references: [people.id]
	}),
}));

export const memoryPlaceLinksRelations = relations(memoryPlaceLinks, ({one}) => ({
	memoryEntry: one(memoryEntries, {
		fields: [memoryPlaceLinks.memoryId],
		references: [memoryEntries.id]
	}),
	place: one(places, {
		fields: [memoryPlaceLinks.placeId],
		references: [places.id]
	}),
}));

export const duplicateScanResultsRelations = relations(duplicateScanResults, ({one}) => ({
	profile: one(profiles, {
		fields: [duplicateScanResults.profileId],
		references: [profiles.id]
	}),
}));

export const contentFlagRelationsRelations = relations(contentFlagRelations, ({one}) => ({
	contentFlag_flagId: one(contentFlags, {
		fields: [contentFlagRelations.flagId],
		references: [contentFlags.id],
		relationName: "contentFlagRelations_flagId_contentFlags_id"
	}),
	contentFlag_relatedFlagId: one(contentFlags, {
		fields: [contentFlagRelations.relatedFlagId],
		references: [contentFlags.id],
		relationName: "contentFlagRelations_relatedFlagId_contentFlags_id"
	}),
}));

export const flagAutoApprovalFlagLinksRelations = relations(flagAutoApprovalFlagLinks, ({one}) => ({
	contentFlag: one(contentFlags, {
		fields: [flagAutoApprovalFlagLinks.flagId],
		references: [contentFlags.id]
	}),
	flagAutoApproval: one(flagAutoApprovals, {
		fields: [flagAutoApprovalFlagLinks.autoApprovalId],
		references: [flagAutoApprovals.id]
	}),
}));

export const prerollAdsRelations = relations(prerollAds, ({one}) => ({
	profile: one(profiles, {
		fields: [prerollAds.profileId],
		references: [profiles.id]
	}),
	adTemplate: one(adTemplates, {
		fields: [prerollAds.templateId],
		references: [adTemplates.id]
	}),
}));

export const adTemplatesRelations = relations(adTemplates, ({many}) => ({
	prerollAds: many(prerollAds),
}));

export const listenerCitiesRelations = relations(listenerCities, ({one}) => ({
	profile: one(profiles, {
		fields: [listenerCities.profileId],
		references: [profiles.id]
	}),
}));

export const itemsRelations = relations(items, ({one, many}) => ({
	profile: one(profiles, {
		fields: [items.profileId],
		references: [profiles.id]
	}),
	memoryItemLinks: many(memoryItemLinks),
}));

export const memoryConceptLinksRelations = relations(memoryConceptLinks, ({one}) => ({
	memoryEntry: one(memoryEntries, {
		fields: [memoryConceptLinks.memoryId],
		references: [memoryEntries.id]
	}),
	concept: one(concepts, {
		fields: [memoryConceptLinks.conceptId],
		references: [concepts.id]
	}),
}));

export const conceptsRelations = relations(concepts, ({one, many}) => ({
	memoryConceptLinks: many(memoryConceptLinks),
	profile: one(profiles, {
		fields: [concepts.profileId],
		references: [profiles.id]
	}),
}));

export const memoryItemLinksRelations = relations(memoryItemLinks, ({one}) => ({
	memoryEntry: one(memoryEntries, {
		fields: [memoryItemLinks.memoryId],
		references: [memoryEntries.id]
	}),
	item: one(items, {
		fields: [memoryItemLinks.itemId],
		references: [items.id]
	}),
}));

export const memoryMiscLinksRelations = relations(memoryMiscLinks, ({one}) => ({
	memoryEntry: one(memoryEntries, {
		fields: [memoryMiscLinks.memoryId],
		references: [memoryEntries.id]
	}),
	miscEntity: one(miscEntities, {
		fields: [memoryMiscLinks.miscId],
		references: [miscEntities.id]
	}),
}));

export const miscEntitiesRelations = relations(miscEntities, ({one, many}) => ({
	memoryMiscLinks: many(memoryMiscLinks),
	profile: one(profiles, {
		fields: [miscEntities.profileId],
		references: [profiles.id]
	}),
}));

export const memorySuggestionsRelations = relations(memorySuggestions, ({one}) => ({
	profile: one(profiles, {
		fields: [memorySuggestions.profileId],
		references: [profiles.id]
	}),
	memoryEntry: one(memoryEntries, {
		fields: [memorySuggestions.memoryId],
		references: [memoryEntries.id]
	}),
}));

export const personalityStateRelations = relations(personalityState, ({one}) => ({
	profile: one(profiles, {
		fields: [personalityState.profileId],
		references: [profiles.id]
	}),
}));