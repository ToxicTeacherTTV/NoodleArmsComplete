# AI-Powered Co-Host Application - Technical Overview
# Nicky AI — AI-Powered Co-Host (Up-to-date README)

Last updated: 2025-11-03

This repository contains Nicky "Noodle Arms" — an AI-powered co-host application built to provide live voice interactions, podcast/story features, and Discord integration. The project combines a React frontend, a TypeScript/Express backend, PostgreSQL (Drizzle ORM), and multiple AI/voice providers (Gemini, Claude, ElevenLabs).

This README has been refreshed to reflect recent work and completed improvements. For more technical deep-dives, see `PROJECT_ROADMAP.md`, `NOTES.md`, and the docs in the `attached_assets/` folder.

## What's new (recent, notable updates)

- Gemini-Primary Architecture Migration (Deployed, Oct 2025)
  - Gemini 2.5 Pro is now PRIMARY for AI operations; Anthropic Claude Sonnet 4.5 is a paid failsafe.
  - Expected cost reduction: ~90% for AI usage by routing free-tier Gemini where possible.

- Memory Deduplication Fix (Completed Oct 2025)
  - Implemented atomic UPSERTs, unique constraints on (profileId, canonicalKey), and metadata-merge logic.
  - Cleaned up duplicate memories (example: removed 39 duplicate entries).

- Web Search Integration (Operational)
  - SerpAPI primary integration with DuckDuckGo/Bing fallbacks for external knowledge ingestion.

- Personality System Unification
  - Unified PersonalityController with preset-based personalities (11 presets available).
  - Migration tools that map legacy sliders/settings to presets.

- Entity Linking, RAG improvements, and embedding readiness
  - Many-to-many entity linking implemented; schema supports embeddings and semantic search (embeddings need population to enable hybrid semantic search).

- Podcast Listener Cities feature
  - `LISTENER_CITIES_README.md` documents the listener cities tracker used during the podcast segment (import, random pick, coverage tracking).

For a fuller list of changes and the implementation plan, open `PROJECT_ROADMAP.md` (last updated Oct 17, 2025).

## Quick project summary

- Frontend: React + TypeScript + Vite. Components live under `client/src/`.
- Backend: Node.js + Express + TypeScript. Server code under `server/`.
- DB: PostgreSQL (Neon serverless) with Drizzle ORM. Schema in `shared/schema.ts`.
- AI Providers: Gemini (PRIMARY), Claude (FALLBACK). Voice via ElevenLabs (with browser TTS fallback).

## Quick start (local dev)

Prereqs: Node 18+, PostgreSQL (or Neon), .env with required API keys (Gemini/Claude/ElevenLabs/SerpAPI), and Drizzle configured.

1. Install dependencies

   npm install

2. Dev server (frontend + backend hot run configured via scripts)

   npm run dev

3. Build for production

   npm run build

4. Run production build

   npm run start

Useful scripts (from `package.json`): `dev`, `build`, `start`, `check` (tsc), `db:push`.

## Where to find things (docs & useful files)

- Project roadmap and status: `PROJECT_ROADMAP.md` (detailed roadmap & completed items)
- Development notes & ideas: `NOTES.md`
- Listener cities feature guide: `LISTENER_CITIES_README.md`
- SQL for listener cities migration: `add-listener-cities.sql`
- Misc attachments and exports: `attached_assets/`

## How we validated the recent changes

- Gemini migration: implemented across services with a standard try-fallback pattern (Gemini → Claude) and Prometheus metrics tracking of provider usage.
- Memory dedupe: addressed by adding DB-level unique constraint + atomic UPSERTs and a merge strategy for metadata.

## Recommended next steps (short-term)

1. Populate the embedding vectors for all memories and enable hybrid semantic retrieval (high priority for better search results).
2. Add a debug UI toggle that shows retrieved memories and relevance scores for each AI response (helps tune retrieval weights).
3. Finish ElevenLabs voice tuning for podcast vs streaming modes to conserve credits.

## Contributing

If you want to contribute, please:

1. Open an issue describing the change or bug.
2. Create a feature branch from `main`.
3. Include tests (where applicable) and update docs if behavior changes.

## Contact / Further reading

- For product decisions and roadmap discussion: see `PROJECT_ROADMAP.md`.
- For implementation notes and developer context: see `NOTES.md`.
- For listener cities usage details: see `LISTENER_CITIES_README.md`.

Thanks — the README was refreshed to include all major updates up through 2025-11-03. If you'd like me to expand any specific section (example: step-by-step embedding migration, or a condensed one-page README for external audiences), tell me which section to expand and I'll update it.


### Contradiction Detection Flow

1. **Fact Comparison**: New facts checked against existing knowledge base
2. **Semantic Similarity**: AI-powered contradiction detection
3. **Importance Weighting**: Higher importance facts take precedence
4. **Resolution Strategy**: Merge, replace, or flag for manual review

### Voice Synthesis Integration Patterns

#### ElevenLabs Integration
```typescript
// Queue-based voice synthesis for consistent playback
const voiceQueue = new Queue('voice-synthesis');
voiceQueue.add('synthesize', {
  text: message.content,
  voiceId: profile.elevenLabsVoiceId,
  stability: 0.5,
  clarity: 0.8
});
```

#### Fallback to Browser TTS
```typescript
// Browser Speech Synthesis as backup
if (!elevenLabsAvailable) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = selectedVoice;
  speechSynthesis.speak(utterance);
}
```

### Advanced Discord Bot Integration

#### Proactive Messaging System
```typescript
// Smart proactive messaging with daily limits and server-specific behavior
class ProactiveMessaging {
  private async considerProactiveMessage(): Promise<void> {
    // Global daily limit: 2-3 messages across all servers
    const dailyLimit = await this.checkGlobalDailyLimit();
    if (dailyLimit.exceeded) return;
    
    // Server-specific behavior modulation
    const effectiveBehavior = await behaviorModulator.getEffectiveBehavior(serverId);
    const shouldSendMessage = Math.random() < (effectiveBehavior.responsiveness / 100);
    
    if (shouldSendMessage) {
      await this.generateContextualMessage(server, channel);
    }
  }
}
```

#### Dynamic Behavior Modulation
```typescript
// Real-time personality adjustment based on multiple factors
class BehaviorModulator {
  async getEffectiveBehavior(serverId: string): Promise<EffectiveBehavior> {
    const server = await storage.getDiscordServer(serverId);
    const drift = await this.calculateDrift(server); // Bounded random walk
    const chaosMultiplier = await this.getChaosMultiplier(); // Global chaos state
    const timeOfDayFactor = this.getTimeOfDayModulation(); // Circadian rhythm
    
    return this.combineFactors(server.baseValues, drift, chaosMultiplier, timeOfDayFactor);
  }
}
```

### Mode Switching (Podcast vs Stream vs Chat)

#### Mode-Specific Behaviors & Voice Management
- **Podcast Mode**: `voiceOutput: false` (manual generation to conserve credits), longer-form responses
- **Stream Mode**: `voiceOutput: true` (auto-voice for real-time), quick reactions
- **Chat Mode**: Conversational, memory-building interactions with optional voice

#### Implementation
```typescript
// Mode affects AI prompt construction, response length, and voice synthesis
const modeConfig = {
  PODCAST: { 
    maxTokens: 1024, temperature: 0.8, style: 'storytelling',
    voiceOutput: false, // Manual voice generation
    personalityIntensity: 'moderate' 
  },
  STREAM: { 
    maxTokens: 256, temperature: 1.0, style: 'reactive',
    voiceOutput: true, // Auto-voice enabled
    personalityIntensity: 'high'
  },
  CHAT: { 
    maxTokens: 512, temperature: 0.9, style: 'conversational',
    voiceOutput: 'optional', // User preference
    personalityIntensity: 'adaptive'
  }
};
```

## Development Patterns

### Code Organization Conventions

#### Frontend Structure
```
client/src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── personality-surge-panel.tsx  # Unified chat personality controls
│   ├── discord-management-panel.tsx  # Discord server personality settings
│   ├── jazz-dashboard.tsx  # Main application container
│   └── [feature]/      # Feature-specific components
├── pages/              # Route-level components
├── lib/                # Utilities and configurations
└── hooks/              # Custom React hooks
```

#### Backend Structure
```
server/
├── services/           # Business logic and external integrations
│   ├── personalityController.ts  # Unified personality management
│   ├── chaosEngine.ts  # Advisory personality influence
│   └── [other services]/
├── types/
│   └── personalityControl.ts  # Personality system type definitions
├── routes.ts          # API endpoint definitions (includes personality & memory endpoints)
├── storage.ts         # Database abstraction layer
└── index.ts           # Application entry point
```

#### Shared Structure
```
shared/
├── schema.ts          # Database schema and types
└── types.ts           # Shared TypeScript interfaces
```

### How to Add New Features Without Breaking Character Consistency

1. **Update Schema First**: Define data model in `shared/schema.ts`
2. **Extend Storage Interface**: Add CRUD operations to `server/storage.ts`
3. **Create API Endpoints**: Add routes following RESTful patterns
4. **Integrate with PersonalityController**: Ensure new features work with unified personality system
5. **Build Frontend Components**: Follow existing UI patterns and use unified personality controls
6. **Test Character Integration**: Ensure new features enhance rather than contradict personality

#### Recent Bug Fixes and System Improvements
- **Protected Facts Deletion**: Fixed missing `DELETE /api/memory/entries/:id` endpoint
- **Personality System Unification**: Consolidated all personality controls through single PersonalityController
- **Discord Migration**: Automatic conversion of legacy behavior settings to preset-based system

#### Example: Adding Beef Tracker Feature
```typescript
// 1. Schema definition
export const beefTrackers = pgTable("beef_trackers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").references(() => profiles.id).notNull(),
  targetUser: text("target_user").notNull(),
  grievance: text("grievance").notNull(),
  intensity: integer("intensity").default(50),
  status: text("status").$type<'ACTIVE' | 'RESOLVED' | 'ESCALATED'>().default('ACTIVE'),
});

// 2. Storage methods
async createBeefTracker(data: InsertBeefTracker): Promise<BeefTracker>
async getActiveBeefs(profileId: string): Promise<BeefTracker[]>
async updateBeefIntensity(id: string, intensity: number): Promise<void>

// 3. API endpoints
GET /api/beefs - List active beefs
POST /api/beefs - Create new beef
PATCH /api/beefs/:id - Update beef status/intensity

// 4. Frontend integration
const { data: activeBeefs } = useQuery({
  queryKey: ['/api/beefs', profileId],
  enabled: !!profileId
});
```

### Testing Approaches for AI Personality Systems

#### Unit Testing
- **Fact Extraction**: Test memory creation from sample conversations
- **Contradiction Detection**: Verify consistency enforcement
- **Behavior Modulation**: Test personality drift calculations

#### Integration Testing
- **API Endpoint Coverage**: Test all CRUD operations
- **External Service Mocking**: Mock Anthropic/ElevenLabs for consistent testing
- **Database Transactions**: Verify data integrity

#### Personality Testing
```typescript
// Test character consistency across interactions
describe('Character Consistency', () => {
  it('maintains Italian obsession regardless of topic', async () => {
    const responses = await testMultipleConversations([
      'What do you think about sports?',
      'Tell me about technology',
      'What's your favorite movie?'
    ]);
    
    responses.forEach(response => {
      expect(response).toContainItalianReference();
    });
  });
});
```

### Error Handling for External API Failures

#### AI Service Fallback Chain (Gemini → Claude)
```typescript
try {
  // PRIMARY: Try Gemini 2.5 Pro first (free tier)
  return await geminiService.generateResponse(prompt);
} catch (geminiError) {
  console.log('🔄 Gemini failed, falling back to Claude Sonnet 4.5');
  try {
    // FALLBACK: Claude Sonnet 4.5 (paid failsafe)
    return await anthropic.messages.create(request);
  } catch (claudeError) {
    // GRACEFUL DEGRADATION: Return fallback response
    console.error('Both AI services failed');
    return fallbackResponse;
  }
}
```

#### ElevenLabs Service Graceful Degradation
```typescript
async synthesizeVoice(text: string): Promise<AudioBuffer | null> {
  try {
    return await elevenLabsService.generate(text);
  } catch (error) {
    console.warn('ElevenLabs unavailable, falling back to browser TTS');
    return null; // Frontend will use Speech Synthesis API
  }
}
```

#### Discord Bot Resilience
```typescript
// Automatic reconnection and error recovery
client.on('error', (error) => {
  console.error('Discord client error:', error);
  setTimeout(() => this.initializeBot(), 5000); // Reconnect after 5s
});

client.on('disconnect', () => {
  console.log('Discord bot disconnected, attempting reconnection...');
  this.initializeBot();
});
```

## Integration Examples

### Discord Bot Feature Implementation

#### Channel-Aware Content Selection
```typescript
// Bot analyzes channel names for contextual relevance
const getChannelContext = (channelName: string): ContentType[] => {
  if (channelName.includes('dbd') || channelName.includes('dead')) {
    return ['dbd', 'aggressive'];
  }
  if (channelName.includes('food') || channelName.includes('italian')) {
    return ['italian', 'family_business'];
  }
  return ['random'];
};

// Proactive messaging respects channel themes
const proactiveMessage = await generateContextualMessage(channel, server);
```

#### Behavior Modulation System
```typescript
// Dynamic personality adjustments based on server settings
class BehaviorModulator {
  async getEffectiveBehavior(serverId: string): Promise<EffectiveBehavior> {
    const server = await storage.getDiscordServer(serverId);
    const baseValues = {
      aggressiveness: server.aggressiveness,
      responsiveness: server.responsiveness,
      italianIntensity: server.italianIntensity
    };
    
    // Apply drift and chaos modifiers
    const driftedValues = this.applyDrift(baseValues, server.driftMomentum);
    const chaosAdjusted = this.applyChaos(driftedValues);
    
    return chaosAdjusted;
  }
}
```

### Database Queries That Maintain Story Context

#### Memory Retrieval with Narrative Preservation
```sql
-- Enhanced query includes parent story context
SELECT 
  m.*,
  parent.content as parent_story_content,
  parent.story_context as parent_story_context
FROM memory_entries m
LEFT JOIN memory_entries parent ON m.parent_story_id = parent.id
WHERE m.profile_id = $1
  AND (m.content ILIKE ANY($2) OR m.keywords && $3)
ORDER BY m.importance DESC, m.created_at DESC
LIMIT $4;
```

#### Conversation Context Building
```typescript
// Build conversation context with memory integration
const buildConversationContext = async (
  conversationId: string,
  profileId: string
): Promise<string> => {
  const recentMessages = await storage.getConversationMessages(conversationId, 10);
  const relevantMemories = await storage.searchMemories(
    extractKeywords(recentMessages),
    profileId
  );
  
  return {
    messageHistory: recentMessages,
    relevantContext: relevantMemories,
    personalityState: await chaosEngine.getCurrentState()
  };
};
```

### Proper Confidence Scoring Implementation

#### Importance-Based Fact Hierarchy
```typescript
const IMPORTANCE_LEVELS = {
  PROTECTED: 999,        // Core identity, never override
  CRITICAL: 800-998,     // Major personality traits
  HIGH: 600-799,         // Important preferences/facts
  MEDIUM: 300-599,       // Regular conversation facts
  LOW: 1-299,           // Casual mentions, temporary states
  TEMPORARY: 0          // Auto-expire after time period
};

// Fact creation with automatic importance scoring
const createMemoryEntry = async (
  content: string,
  category: MemoryCategory,
  context?: string
): Promise<MemoryEntry> => {
  const importance = await calculateImportance(content, category, context);
  
  return storage.createMemoryEntry({
    content,
    category,
    importance,
    storyContext: context,
    confidence: calculateConfidence(content, existingMemories)
  });
};
```

#### Contradiction Resolution with Importance Weighting
```typescript
const resolveContradiction = async (
  newFact: MemoryEntry,
  conflictingFact: MemoryEntry
): Promise<void> => {
  if (conflictingFact.importance === 999) {
    // Protected fact - reject new information
    console.log(`Rejecting fact that contradicts protected memory: ${conflictingFact.content}`);
    return;
  }
  
  if (newFact.importance > conflictingFact.importance) {
    // Update existing fact with new information
    await storage.updateMemoryEntry(conflictingFact.id, {
      content: newFact.content,
      importance: Math.max(newFact.importance, conflictingFact.importance),
      lastUpdated: new Date()
    });
  } else {
    // Keep existing fact, flag for manual review
    await storage.createContentFlag({
      profileId: newFact.profileId,
      contentType: 'MEMORY_CONFLICT',
      content: `New: ${newFact.content} vs Existing: ${conflictingFact.content}`,
      flagType: 'REVIEW_REQUIRED'
    });
  }
};
```

---

*This technical overview is maintained as a living document and should be updated as the application evolves. Last updated: September 19, 2025*