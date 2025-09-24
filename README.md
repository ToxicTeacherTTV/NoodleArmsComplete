# AI-Powered Co-Host Application - Technical Overview

## System Architecture Overview

### Full Tech Stack Breakdown
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM for type-safe operations
- **Backend**: Node.js + Express.js with TypeScript, session-based storage
- **Frontend**: React 19 + TypeScript with Vite, TanStack Query for state management
- **External APIs**: 
  - Anthropic Claude (claude-sonnet-4-20250514) for AI conversation
  - ElevenLabs for enhanced voice synthesis
  - Discord.js for Discord bot integration
  - Web Speech API for browser-based voice recognition

### Database Schema Summary

#### Core Tables
- **`profiles`**: AI character definitions with personality settings
- **`conversations`**: Chat session containers linking users to AI interactions
- **`messages`**: Individual message records with type, content, and metadata
- **`memory_entries`**: Knowledge base facts with importance scoring and categorization
- **`documents`**: File storage with extracted content and processing status

#### Discord Integration Tables
- **`discord_servers`**: Per-server behavior settings and proactive messaging controls
- **`discord_members`**: User interaction tracking with fact association
- **`discord_topic_triggers`**: Custom response triggers with probability settings
- **`content_flags`**: Content filtering and moderation settings

#### Key Relationships
- Profiles → Conversations (1:many): Each character can have multiple chat sessions
- Conversations → Messages (1:many): Messages belong to specific conversations
- Profiles → Memory Entries (1:many): Each character maintains its own knowledge base
- Discord Servers → Members (1:many): Server-specific user tracking
- Memory Entries → Parent Stories: Atomic facts link to narrative context

### API Endpoint Structure and Patterns

#### RESTful API Design
- **Profiles**: `/api/profiles` - Character management and configuration
- **Conversations**: `/api/conversations` - Chat session lifecycle
- **Messages**: `/api/messages` - Individual message CRUD operations
- **Memory**: `/api/memory` - Knowledge base management with retrieval and deletion
- **Documents**: `/api/documents` - File upload and processing pipeline
- **Discord**: `/api/discord` - Bot configuration and server management with migration support
- **Personality**: `/api/personality` - Unified personality control system (state, updates)
- **Chaos**: `/api/chaos` - Advisory personality influence system

#### Standard Response Patterns
```typescript
// Success responses include data and metadata
{ data: T, meta?: { total?, page?, limit? } }

// Error responses follow consistent structure
{ error: string, details?: any, code?: number }

// All endpoints support pagination where applicable
?limit=50&offset=0&sortBy=createdAt&sortOrder=desc
```

### Advanced Memory & Intelligence Systems

#### Multi-Layer Intelligence Architecture
1. **IntelligenceEngine**: Comprehensive analysis including fact clustering, personality drift detection, and source reliability scoring
2. **MemoryDeduplicator**: Identifies and merges similar memories using Jaccard similarity, Levenshtein distance, and containment analysis
3. **StoryReconstructor**: Groups related facts into coherent narratives with coherence scoring and event ordering
4. **SmartContradictionDetector**: AI-powered resolution of conflicting information with importance weighting

#### Atomic Facts → Story Context → Intelligence Analysis
1. **Fact Extraction**: AI processes conversations and documents to extract discrete facts
2. **Story Context Preservation**: Facts retain narrative context to avoid disconnected knowledge
3. **Confidence Scoring**: Importance ratings (1-999) with 999 reserved for protected facts
4. **Intelligence Analysis**: Automatic clustering, reliability scoring, and contradiction detection
5. **Retrieval System**: Keyword-based search with relevance weighting and semantic similarity

#### Memory Categories
- **FACT**: Concrete information about users, preferences, events
- **PREFERENCE**: User likes, dislikes, behavioral patterns
- **LORE**: Character background, personality traits, fictional elements
- **CONTEXT**: Situational information, temporary states

#### Memory Consolidation Process
```typescript
// Memory retrieval pipeline
const relevantMemories = await memoryService.searchMemories(keywords, {
  limit: 10,
  includeStoryContext: true,
  minImportance: 50
});

// AI-powered memory optimization
const consolidatedFacts = await memoryService.consolidateMemories(profileId, {
  removeDuplicates: true,
  mergeRelated: true,
  updateImportance: true
});
```

### Advanced Content Generation Systems

#### Automated Content Creation Pipeline
- **AdGenerationService**: Generates comedic fake sponsor content with Italian-American twist and rotating templates
- **PodcastFactExtractor**: Extracts structured facts (TOPIC, QUOTE, FACT, STORY, MOMENT) from episode transcripts
- **ContentCollectionManager**: Automated collection from Reddit, Steam News, and YouTube with active source management
- **VarietyController**: 10-facet personality system ensuring varied responses with anti-repetition mechanisms

### Integration Points

#### Frontend ↔ Backend
- **TanStack Query**: Automatic caching, background updates, optimistic updates
- **Unified Personality Controls**: PersonalitySurgePanel and Discord management use same API endpoints
- **Session Management**: Express sessions with PostgreSQL storage

#### Backend ↔ External APIs
- **Anthropic Service**: Centralized AI request handling with fallback to Gemini
- **ElevenLabs Integration**: Voice synthesis with queue management and credit conservation modes
- **Discord Bot Service**: Event-driven message processing with advanced behavior modulation and proactive messaging
- **Content Ingestion**: Automated collection from multiple external sources with rate limiting

#### Browser APIs
- **Web Speech API**: Speech recognition with automatic restart and error handling
- **Speech Synthesis API**: Text-to-speech with queue management for consistent playback
- **Web Audio API**: Real-time voice activity detection and visualization

## Core Philosophy & Constraints

### WHY Contradictions Are Features
The AI character is designed to be authentically chaotic and contradictory, reflecting real personality complexity:

**Examples of Intentional Contradictions:**
- Claiming to be tough while being emotionally sensitive about pasta
- Obsessing over Dead by Daylight while pretending it's not important
- Making grandiose statements about family business over trivial matters
- Alternating between Italian pride and self-deprecating humor

**Implementation:**
```typescript
// Chaos Engine introduces deliberate personality drift
const chaosModifier = chaosEngine.getPersonalityModifier();
const enhancedPrompt = `${baseIdentity}\n\n${chaosModifier}`;

// Behavior modulation allows real-time personality adjustments
const effectiveBehavior = behaviorModulator.getEffectiveBehavior(serverId);
```

### Unified Personality Control System

#### PersonalityController Architecture
The application now uses a unified preset-based personality system that serves as the single source of truth across all interfaces:

```typescript
// Core personality presets with consistent behavior
const PERSONALITY_PRESETS = {
  'chill': { intensity: 30, spice: 20, dbdLens: 30 },
  'roast_mode': { intensity: 85, spice: 90, dbdLens: 40 },
  'storyteller': { intensity: 70, spice: 50, dbdLens: 80 },
  'gaming_rage': { intensity: 95, spice: 85, dbdLens: 95 }
  // ... 11 total presets
};
```

#### Migration from Legacy Systems
- **Chat Interface**: ChaosMeter replaced with PersonalitySurgePanel
- **Discord Interface**: Legacy behavior sliders (aggressiveness, responsiveness) converted to preset-aligned controls
- **Automatic Migration**: Existing Discord server settings automatically mapped to equivalent presets
- **Chaos Engine**: Converted from mutating controller to advisory influence layer

#### Protected Core Traits (Always Consistent)
- Italian heritage and pasta obsession
- Dead by Daylight addiction
- "Noodle Arms" physical characteristic
- Basic family business references
- Core moral framework (chaotic good)

#### Acceptable Chaos Areas
- Mood swings and emotional intensity
- Specific game opinions and hot takes
- Relationship dynamics with users
- Random tangent topics
- Severity of Italian accent in text

#### Lie Taxonomy Approach
```typescript
// Memory importance scoring prevents contradicting protected facts
const PROTECTED_IMPORTANCE = 999;
const HIGH_IMPORTANCE = 800-998;
const MEDIUM_IMPORTANCE = 400-799;
const LOW_IMPORTANCE = 1-399;

// Protected facts cannot be overridden by AI generation
if (newFact.contradicts(existingFact) && existingFact.importance === 999) {
  rejectFact(newFact);
}
```

### When to Auto-Process vs Manual Curation

#### Automatic Processing
- Document text extraction and chunking
- Basic fact extraction from conversations
- Routine memory importance scoring (1-799)
- Standard conversation logging

#### Manual Curation Required
- Protected fact designation (999 importance)
- Character core identity changes
- Major personality trait modifications
- Content moderation flag adjustments

## Existing Systems Deep Dive

### Document Processing Pipeline End-to-End

1. **File Upload**: Multer middleware handles file validation and temporary storage
2. **Type Detection**: MIME type analysis determines processing strategy
3. **Content Extraction**:
   ```typescript
   // PDF processing with pdf-parse
   const pdfData = await pdfParse(buffer);
   const extractedText = pdfData.text;
   
   // Text chunking for knowledge base integration
   const chunks = intelligentChunking(extractedText, {
     maxChunkSize: 1000,
     preserveContext: true
   });
   ```
4. **Memory Integration**: Extracted content becomes searchable memory entries
5. **Status Tracking**: Processing status updates via database and real-time UI

### Memory Retrieval with Narrative Context Preservation

```typescript
// Enhanced memory retrieval maintains story coherence
const memoryEntry = {
  content: "User prefers thriller games",
  storyContext: "Discovered during discussion about Dead by Daylight match",
  parentStory: "User shared experience about getting scared by killer",
  isAtomicFact: true,
  importance: 650
};

// Retrieval includes parent narrative context
const enrichedMemories = await storage.getRelevantMemories(keywords, {
  includeParentStories: true,
  preserveNarrativeFlow: true
});
```

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

#### Anthropic Service Fallback
```typescript
try {
  return await anthropic.messages.create(request);
} catch (error) {
  if (error.message.includes('insufficient credits')) {
    console.log('🔄 Falling back to Gemini due to Anthropic credit exhaustion');
    return await geminiService.generateText(prompt);
  }
  throw error;
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