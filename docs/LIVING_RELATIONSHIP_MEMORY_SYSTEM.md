# Living Relationship Memory System

**Status**: Planning
**Created**: 2026-01-27
**Purpose**: Enable Nicky to remember users across platforms, build relationships over time, and proactively recognize returning viewers

---

## Table of Contents
1. [Philosophy](#philosophy)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema](#database-schema)
4. [Memory Types](#memory-types)
5. [User Dossier System](#user-dossier-system)
6. [Proactive Recognition](#proactive-recognition)
7. [Trust & Confidence Scoring](#trust--confidence-scoring)
8. [Conversation Threading](#conversation-threading)
9. [Implementation Phases](#implementation-phases)
10. [Performance Optimization](#performance-optimization)
11. [Code Examples](#code-examples)
12. [Testing Strategy](#testing-strategy)

---

## Philosophy

Users aren't just fact repositories - they're **relationships** with history, patterns, and emotional context. Nicky should:
- **Actively recognize** returning users
- **Remember conversations**, not just facts
- **Build relationships** over time (stranger → regular → trusted)
- **React contextually** based on user history
- **Track behavioral patterns** (not just static facts)

This transforms Nicky from "remembers facts" to "has relationships with people."

---

## Architecture Overview

### Core Concept
User facts are stored as memories in the existing CANON memory system, tagged with speaker identity. Platform tables track lightweight metadata and relationship status.

### Key Components
1. **Platform User Tracking**: Lightweight metadata (message counts, trust scores, nicknames)
2. **Memory-Based Facts**: User facts stored as CANON memories with speaker tagging
3. **Speaker-Aware Retrieval**: Context builder filters memories by current speaker
4. **Proactive Recognition**: Detect returning users and inject greeting prompts
5. **Behavioral Analysis**: Background task to detect patterns and update profiles

### Benefits
✅ Single unified system (no duplicate extraction code)
✅ Works everywhere (Twitch, Discord, web chat)
✅ Facts are searchable with existing RAG/vector search
✅ Can flag/review user facts like any memory
✅ Scales cleanly - no per-platform fact tables
✅ Reuses existing LoreOrchestrator speaker detection

---

## Database Schema

### New Table: `twitch_viewers`

```sql
CREATE TABLE twitch_viewers (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),

  -- Identity
  username VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  twitch_user_id VARCHAR(255), -- If available from Twitch API

  -- Timestamps
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),

  -- Activity Tracking
  message_count INTEGER DEFAULT 0,
  is_subscriber BOOLEAN DEFAULT FALSE,
  is_moderator BOOLEAN DEFAULT FALSE,

  -- Relationship Status
  relationship_status VARCHAR(50) DEFAULT 'stranger',
    -- 'stranger' | 'regular' | 'trusted' | 'annoying'
  nicky_nickname VARCHAR(255), -- What Nicky calls them (e.g., "Oklahoma Menace")
  trust_score INTEGER DEFAULT 50, -- 0-100, affects fact confidence

  -- Behavioral Fingerprint
  typical_topics TEXT[], -- ["dbd_gameplay", "trash_talk", "pasta"]
  activity_pattern VARCHAR(50), -- "weekend_warrior", "always_here", "lurker", "night_owl"
  last_conversation_summary TEXT, -- "Was complaining about Nurse nerf"

  -- Cross-Platform Hints
  linked_discord_id VARCHAR(255), -- Manual or heuristic linking
  listener_city_id INTEGER REFERENCES listener_cities(id), -- Link to existing system!

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(profile_id, username)
);

CREATE INDEX idx_twitch_viewers_username ON twitch_viewers(username);
CREATE INDEX idx_twitch_viewers_last_seen ON twitch_viewers(last_seen);
CREATE INDEX idx_twitch_viewers_profile_id ON twitch_viewers(profile_id);
```

### Enhancements to `memory_entries`

**No schema changes needed** - we use existing fields:
- `source`: Set to `'twitch:username'` or `'discord:userid'`
- `metadata.speakerId`: Store platform user ID
- `metadata.conversationThreadId`: Link related memories
- `metadata.previousMessageId`: Form conversation chains
- `type`: Expand to include new user memory types

### Enhancements to `discord_members`

Add same relationship fields as `twitch_viewers`:
```sql
ALTER TABLE discord_members ADD COLUMN relationship_status VARCHAR(50) DEFAULT 'stranger';
ALTER TABLE discord_members ADD COLUMN nicky_nickname VARCHAR(255);
ALTER TABLE discord_members ADD COLUMN trust_score INTEGER DEFAULT 50;
ALTER TABLE discord_members ADD COLUMN typical_topics TEXT[];
ALTER TABLE discord_members ADD COLUMN activity_pattern VARCHAR(50);
ALTER TABLE discord_members ADD COLUMN last_conversation_summary TEXT;
ALTER TABLE discord_members ADD COLUMN linked_twitch_username VARCHAR(255);
ALTER TABLE discord_members ADD COLUMN listener_city_id INTEGER REFERENCES listener_cities(id);
```

---

## Memory Types

Expand beyond just `USER_FACT` to capture richer relationship data:

### 1. `USER_FACT`
Static, verifiable facts about the user.
```typescript
{
  type: 'USER_FACT',
  content: 'ToxicStreamer mains Killer (Trapper and Wraith)',
  source: 'twitch:toxicstreamer',
  confidence: 85,
  lane: 'CANON',
  metadata: {
    speakerId: 'twitch:toxicstreamer',
    category: 'gameplay'
  }
}
```

### 2. `USER_OPINION`
User preferences, takes, opinions.
```typescript
{
  type: 'USER_OPINION',
  content: 'ToxicStreamer believes camping is a valid tactical strategy',
  source: 'twitch:toxicstreamer',
  confidence: 90,
  lane: 'CANON',
  metadata: {
    speakerId: 'twitch:toxicstreamer',
    category: 'opinion',
    controversial: true
  }
}
```

### 3. `USER_STORY`
Personal anecdotes or stories they shared.
```typescript
{
  type: 'USER_STORY',
  content: 'ToxicStreamer told story about losing rank due to server disconnect during rank reset',
  source: 'twitch:toxicstreamer',
  confidence: 95,
  lane: 'CANON',
  metadata: {
    speakerId: 'twitch:toxicstreamer',
    storyDate: '2026-01-15',
    conversationThreadId: 'uuid'
  }
}
```

### 4. `USER_BEHAVIOR`
Observed patterns, tendencies, habits.
```typescript
{
  type: 'USER_BEHAVIOR',
  content: 'ToxicStreamer tends to get defensive when killer nerfs are mentioned',
  source: 'twitch:toxicstreamer',
  confidence: 75,
  lane: 'CANON',
  metadata: {
    speakerId: 'twitch:toxicstreamer',
    category: 'behavioral_pattern',
    occurrences: 5
  }
}
```

### 5. `CONVERSATION_THREAD`
Links to ongoing or past conversation topics.
```typescript
{
  type: 'CONVERSATION_THREAD',
  content: 'Discussion with ToxicStreamer about whether camping is tactical or cowardly - Nicky called him a coward',
  source: 'twitch:toxicstreamer',
  confidence: 100,
  lane: 'CANON',
  metadata: {
    speakerId: 'twitch:toxicstreamer',
    conversationThreadId: 'uuid',
    startedAt: '2026-01-24T19:30:00Z',
    lastMessageAt: '2026-01-24T19:45:00Z',
    messageCount: 8,
    resolution: 'unresolved'
  }
}
```

### 6. `NICKY_OBSERVATION`
What Nicky has noticed about the user (meta-observations).
```typescript
{
  type: 'NICKY_OBSERVATION',
  content: 'ToxicStreamer seems extra tilted lately - more aggressive than usual',
  source: 'system:nicky',
  confidence: 60,
  lane: 'RUMOR', // Nicky's interpretation, not hard fact
  metadata: {
    aboutSpeaker: 'twitch:toxicstreamer',
    observedAt: '2026-01-27',
    basedOn: 'last 3 interactions'
  }
}
```

---

## User Dossier System

### Dossier Structure

```typescript
interface UserDossier {
  // Identity
  platform: 'twitch' | 'discord';
  userId: string;
  username: string;
  displayName: string;

  // Relationship
  relationshipStatus: 'stranger' | 'regular' | 'trusted' | 'annoying';
  nickyNickname: string | null;
  trustScore: number; // 0-100

  // Activity
  firstSeen: Date;
  lastSeen: Date;
  messageCount: number;
  isSubscriber: boolean;
  isModerator: boolean;
  activityPattern: string;

  // Memory
  staticFacts: Memory[]; // USER_FACT
  opinions: Memory[]; // USER_OPINION
  stories: Memory[]; // USER_STORY
  behaviors: Memory[]; // USER_BEHAVIOR
  conversationThreads: ConversationThread[];
  nickyObservations: Memory[]; // NICKY_OBSERVATION

  // Context
  lastConversationSummary: string;
  typicalTopics: string[];
  cityInfo: ListenerCity | null;

  // Recognition
  isReturning: boolean;
  timeSinceLastSeen: number; // milliseconds
}
```

### Dossier Retrieval Flow

```typescript
async function buildUserDossier(
  platform: 'twitch' | 'discord',
  username: string,
  profileId: string
): Promise<UserDossier> {
  // 1. Get or create platform user record
  const user = await getOrCreatePlatformUser(platform, username, profileId);

  // 2. Check if returning
  const timeSinceLastSeen = Date.now() - user.lastSeen.getTime();
  const isReturning = timeSinceLastSeen > 24 * 60 * 60 * 1000; // 1+ days

  // 3. Retrieve memories tagged with this user
  const source = `${platform}:${username}`;
  const memories = await storage.searchMemoriesBySource(source);

  // 4. Categorize memories by type
  const staticFacts = memories.filter(m => m.type === 'USER_FACT');
  const opinions = memories.filter(m => m.type === 'USER_OPINION');
  const stories = memories.filter(m => m.type === 'USER_STORY');
  const behaviors = memories.filter(m => m.type === 'USER_BEHAVIOR');

  // 5. Get conversation threads (if returning)
  const conversationThreads = isReturning
    ? await storage.getConversationThreads(user.id, 3)
    : [];

  // 6. Get Nicky's observations
  const nickyObservations = await storage.searchMemories({
    type: 'NICKY_OBSERVATION',
    'metadata.aboutSpeaker': source
  });

  // 7. Get city info if linked
  const cityInfo = user.listenerCityId
    ? await storage.getListenerCity(user.listenerCityId)
    : null;

  return {
    platform,
    userId: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    relationshipStatus: user.relationshipStatus,
    nickyNickname: user.nickyNickname,
    trustScore: user.trustScore,
    firstSeen: user.firstSeen,
    lastSeen: user.lastSeen,
    messageCount: user.messageCount,
    isSubscriber: user.isSubscriber,
    isModerator: user.isModerator,
    activityPattern: user.activityPattern,
    staticFacts,
    opinions,
    stories,
    behaviors,
    conversationThreads,
    nickyObservations,
    lastConversationSummary: user.lastConversationSummary,
    typicalTopics: user.typicalTopics || [],
    cityInfo,
    isReturning,
    timeSinceLastSeen
  };
}
```

### Context Prompt Formatting

```typescript
function formatUserDossierPrompt(dossier: UserDossier): string {
  let prompt = `\n[USER DOSSIER: @${dossier.displayName}]\n`;

  // Relationship status
  prompt += `Relationship: ${dossier.relationshipStatus} (Trust: ${dossier.trustScore}/100)\n`;
  if (dossier.nickyNickname) {
    prompt += `Nicky calls them: "${dossier.nickyNickname}"\n`;
  }

  // Location
  if (dossier.cityInfo) {
    prompt += `Location: ${dossier.cityInfo.city}, ${dossier.cityInfo.country}\n`;
  }

  // Activity
  const daysSince = Math.floor(dossier.timeSinceLastSeen / (1000 * 60 * 60 * 24));
  if (dossier.isReturning) {
    prompt += `\nLast seen: ${daysSince} days ago\n`;
    if (dossier.lastConversationSummary) {
      prompt += `Last conversation: "${dossier.lastConversationSummary}"\n`;
    }
  }

  // Facts
  if (dossier.staticFacts.length > 0) {
    prompt += `\nKnown Facts:\n`;
    dossier.staticFacts.slice(0, 5).forEach(fact => {
      prompt += `- ${fact.content}\n`;
    });
  }

  // Opinions (controversial takes)
  if (dossier.opinions.length > 0) {
    prompt += `\nTheir Takes:\n`;
    dossier.opinions.slice(0, 3).forEach(opinion => {
      prompt += `- ${opinion.content}\n`;
    });
  }

  // Behavior patterns
  if (dossier.behaviors.length > 0) {
    prompt += `\nBehavior Patterns:\n`;
    dossier.behaviors.slice(0, 2).forEach(behavior => {
      prompt += `- ${behavior.content}\n`;
    });
  }

  // Activity pattern
  if (dossier.activityPattern) {
    prompt += `\nActivity Pattern: ${dossier.activityPattern}\n`;
  }

  // Topics
  if (dossier.typicalTopics.length > 0) {
    prompt += `Typical Topics: ${dossier.typicalTopics.join(', ')}\n`;
  }

  // Nicky's take
  prompt += `\n🎭 NICKY'S TAKE: `;
  if (dossier.nickyObservations.length > 0) {
    prompt += dossier.nickyObservations[0].content;
  } else {
    // Generate default based on relationship status
    switch (dossier.relationshipStatus) {
      case 'stranger':
        prompt += `New face. Feel them out.`;
        break;
      case 'regular':
        prompt += `Regular viewer. They know the drill.`;
        break;
      case 'trusted':
        prompt += `Trusted regular. One of the good ones.`;
        break;
      case 'annoying':
        prompt += `This one's a pain in the ass. Keep it short.`;
        break;
    }
  }

  prompt += `\n`;
  return prompt;
}
```

---

## Proactive Recognition

### Returning User Detection

When a user who hasn't been seen in 24+ hours sends a message:

```typescript
function generateReturningUserPrompt(dossier: UserDossier): string {
  if (!dossier.isReturning) return '';

  const daysSince = Math.floor(dossier.timeSinceLastSeen / (1000 * 60 * 60 * 24));

  let prompt = `\n[RETURNING USER ALERT]\n`;
  prompt += `@${dossier.displayName} just showed up after being gone ${daysSince} days.\n`;

  if (dossier.lastConversationSummary) {
    prompt += `Last time: ${dossier.lastConversationSummary}\n`;
  }

  if (dossier.conversationThreads.length > 0) {
    const lastThread = dossier.conversationThreads[0];
    prompt += `Previous topic: ${lastThread.summary}\n`;
  }

  prompt += `\nOptions:\n`;
  prompt += `- Acknowledge return: "Oh great, ${dossier.nickyNickname || dossier.displayName} is back"\n`;

  if (dossier.lastConversationSummary) {
    prompt += `- Reference last topic: [callback to previous conversation]\n`;
  }

  if (daysSince >= 7) {
    prompt += `- Notice absence: "Where the hell you been?"\n`;
  }

  prompt += `- Ignore if mid-conversation with others\n`;
  prompt += `\nYOUR CHOICE - be natural. Don't force it.\n`;

  return prompt;
}
```

### First-Time User Prompt

```typescript
function generateNewUserPrompt(username: string): string {
  return `\n[NEW USER ALERT]\n@${username} is new - you've never talked to them before.\nFeel them out. No special treatment, but you won't know anything about them yet.\n`;
}
```

---

## Trust & Confidence Scoring

### Trust Score Calculation

```typescript
function calculateTrustScore(user: PlatformUser, history: Memory[]): number {
  let score = 50; // Baseline

  // Subscriber/Mod boost
  if (user.isModerator) score += 30;
  else if (user.isSubscriber) score += 20;

  // Longevity boost
  const daysActive = (Date.now() - user.firstSeen.getTime()) / (1000 * 60 * 60 * 24);
  if (daysActive > 90) score += 15;
  else if (daysActive > 30) score += 10;
  else if (daysActive > 7) score += 5;

  // Activity boost
  if (user.messageCount > 100) score += 10;
  else if (user.messageCount > 50) score += 5;

  // Behavior penalties
  const negativeBehaviors = history.filter(m =>
    m.type === 'USER_BEHAVIOR' &&
    (m.content.includes('troll') || m.content.includes('toxic'))
  );
  score -= negativeBehaviors.length * 10;

  // Relationship status adjustment
  if (user.relationshipStatus === 'trusted') score += 10;
  if (user.relationshipStatus === 'annoying') score -= 20;

  return Math.max(0, Math.min(100, score));
}
```

### Weighted Fact Confidence

```typescript
function calculateFinalConfidence(
  baseConfidence: number,
  trustScore: number,
  recencyDays: number
): number {
  // Trust multiplier (50% trust = 0.75x, 100% trust = 1.25x)
  const trustMultiplier = 0.5 + (trustScore / 100) * 0.75;

  // Recency boost (recent facts more reliable)
  const recencyBoost = recencyDays < 7 ? 1.1 : recencyDays < 30 ? 1.0 : 0.9;

  const final = baseConfidence * trustMultiplier * recencyBoost;

  return Math.max(0, Math.min(100, final));
}
```

---

## Conversation Threading

### Thread Creation

When LoreOrchestrator processes a message:

```typescript
async function createConversationThread(
  speakerId: string,
  message: string,
  response: string,
  conversationId: string
): Promise<string> {
  // Extract topic
  const topic = await extractTopicFromExchange(message, response);

  // Check if this continues an existing thread
  const existingThreads = await storage.getActiveThreads(speakerId);
  const matchingThread = existingThreads.find(t =>
    calculateTopicSimilarity(t.topic, topic) > 0.7
  );

  if (matchingThread) {
    // Continue existing thread
    await storage.updateConversationThread(matchingThread.id, {
      lastMessageAt: new Date(),
      messageCount: matchingThread.messageCount + 1
    });
    return matchingThread.id;
  } else {
    // Create new thread
    const threadId = generateUUID();
    await storage.createMemory({
      type: 'CONVERSATION_THREAD',
      content: `Discussion with ${speakerId} about ${topic}`,
      source: speakerId,
      confidence: 100,
      lane: 'CANON',
      metadata: {
        speakerId,
        conversationThreadId: threadId,
        conversationId,
        topic,
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 1,
        resolution: 'ongoing'
      }
    });
    return threadId;
  }
}
```

### Thread Retrieval

```typescript
async function getConversationThreads(
  userId: string,
  limit: number = 3
): Promise<ConversationThread[]> {
  const threads = await storage.searchMemories({
    type: 'CONVERSATION_THREAD',
    'metadata.speakerId': userId,
    orderBy: 'metadata.lastMessageAt DESC',
    limit
  });

  return threads.map(t => ({
    id: t.metadata.conversationThreadId,
    topic: t.metadata.topic,
    summary: t.content,
    startedAt: t.metadata.startedAt,
    lastMessageAt: t.metadata.lastMessageAt,
    messageCount: t.metadata.messageCount,
    resolution: t.metadata.resolution
  }));
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
**Goal**: Basic user tracking and speaker-tagged memories

1. **Database Schema**
   - [ ] Create `twitch_viewers` table migration
   - [ ] Add relationship fields to `discord_members`
   - [ ] Add indexes for performance
   - [ ] Test migrations

2. **Platform User Tracking**
   - [ ] Implement `getOrCreateTwitchViewer()` in twitchBot.ts
   - [ ] Track basic metadata: first_seen, last_seen, message_count
   - [ ] Update on every message

3. **Speaker-Tagged Memory Creation**
   - [ ] Modify LoreOrchestrator to tag memories with `source: 'platform:username'`
   - [ ] Add `metadata.speakerId` to all user-originated memories
   - [ ] Support new memory types: USER_FACT, USER_OPINION, USER_STORY

4. **Speaker-Filtered Retrieval**
   - [ ] Add speaker filter to contextBuilder.retrieveContextualMemories()
   - [ ] Boost relevance for memories from current speaker
   - [ ] Test with sample Twitch/Discord messages

5. **Basic Dossier System**
   - [ ] Implement `buildUserDossier()` function
   - [ ] Format basic dossier prompt (facts only)
   - [ ] Inject into context during message handling

**Success Criteria**: Nicky remembers facts about users and can retrieve them when they speak again

---

### Phase 2: Proactive Recognition (Week 2)
**Goal**: Recognize returning users and inject greeting prompts

1. **Returning User Detection**
   - [ ] Detect users not seen in 24+ hours
   - [ ] Calculate time since last seen
   - [ ] Store last_conversation_summary on each interaction

2. **Proactive Greeting Prompts**
   - [ ] Generate returning user alert prompt
   - [ ] Inject into context when appropriate
   - [ ] Add first-time user detection

3. **Enhanced Dossier Formatting**
   - [ ] Add relationship status display
   - [ ] Show last conversation summary
   - [ ] Format activity patterns
   - [ ] Add "Nicky's Take" section

4. **Trust Score System**
   - [ ] Implement trust score calculation
   - [ ] Update trust based on interactions
   - [ ] Weight fact confidence by trust
   - [ ] Display trust in dossier

5. **Listener Cities Integration**
   - [ ] Link platform users to listener_cities table
   - [ ] Detect city from user messages
   - [ ] Display city info in dossier

**Success Criteria**: Nicky says "oh you're back" to returning users and references previous conversations

---

### Phase 3: Advanced Features (Week 3-4)
**Goal**: Behavioral patterns, conversation threading, cross-platform hints

1. **Conversation Threading**
   - [ ] Implement thread creation logic
   - [ ] Link related memories with threadId
   - [ ] Retrieve conversation threads
   - [ ] Display threads in dossier

2. **Behavioral Pattern Detection**
   - [ ] Background task to analyze user behavior
   - [ ] Detect activity patterns (weekend_warrior, night_owl, etc.)
   - [ ] Track typical topics
   - [ ] Create USER_BEHAVIOR memories

3. **Nicky Nickname System**
   - [ ] Allow manual nickname assignment via admin UI
   - [ ] AI-generated nickname suggestions based on user traits
   - [ ] Display nickname in dossier and responses

4. **Cross-Platform Identity Hints**
   - [ ] Heuristic matching (same city + similar topics)
   - [ ] Flag possible matches
   - [ ] Add hints to context (don't expose directly)
   - [ ] Manual linking in admin UI

5. **Relationship Evolution**
   - [ ] Auto-promote stranger → regular based on activity
   - [ ] Track positive/negative interactions
   - [ ] Update relationship status over time
   - [ ] Generate NICKY_OBSERVATION memories

**Success Criteria**: Nicky exhibits relationship-aware behavior, references ongoing conversation threads, and adapts to user behavioral patterns

---

## Performance Optimization

### Query Optimization

1. **Indexes** (Already in schema above):
```sql
CREATE INDEX idx_twitch_viewers_username ON twitch_viewers(username);
CREATE INDEX idx_twitch_viewers_last_seen ON twitch_viewers(last_seen);
CREATE INDEX idx_memories_source ON memory_entries(source);
CREATE INDEX idx_memories_speaker_id ON memory_entries((metadata->>'speakerId'));
```

2. **Parallel Execution**:
```typescript
// Run user lookup during existing context gathering
const [context, viewer] = await Promise.all([
  aiOrchestrator.gatherAllContext(...),
  getOrCreateTwitchViewer(username)
]);
```

3. **Session Caching**:
```typescript
const viewerCache = new LRUCache<string, TwitchViewer>({
  max: 500,
  ttl: 5 * 60 * 1000 // 5 minutes
});

async function getCachedViewer(username: string): Promise<TwitchViewer> {
  const cached = viewerCache.get(username);
  if (cached) return cached;

  const viewer = await storage.getTwitchViewer(username);
  viewerCache.set(username, viewer);
  return viewer;
}
```

4. **Lazy Loading**:
```typescript
// Only load threads for returning users
const conversationThreads = dossier.isReturning
  ? await storage.getConversationThreads(user.id, 3)
  : [];
```

5. **Background Processing**:
```typescript
// Update behavioral patterns AFTER response sent
process.nextTick(async () => {
  await updateUserBehavior(viewer, message, response);
});
```

### Pipelining Strategy

Hide user lookup latency during AI generation:

```typescript
async function generateResponseWithPipelining(
  message: string,
  username: string,
  ...args
) {
  // Start AI generation immediately with basic context
  const basicContext = await gatherBasicContext(message);
  const aiPromise = generateResponse(message, basicContext, ...args);

  // While AI is "thinking" (1-2s), fetch user details in parallel
  const userDetailsPromise = buildUserDossier('twitch', username, profileId);

  // Wait for both
  const [aiResponse, userDossier] = await Promise.all([
    aiPromise,
    userDetailsPromise
  ]);

  // If needed, enhance response with user context
  // (Most of the time, user details are already in basicContext)

  return aiResponse;
}
```

### Expected Latency Impact

**Without optimization**: +15-100ms (1-4% slower)
**With caching**: +5-50ms (<2% slower)
**With pipelining**: ~0ms (hidden during AI generation)

---

## Code Examples

### Full Integration in TwitchBot

```typescript
// server/services/twitchBot.ts

private async handleMessage(tags: tmi.ChatUserstate, message: string) {
  const username = tags['display-name'] || tags.username || 'Viewer';
  const senderLower = (tags.username || '').toLowerCase();

  // 1. IGNORE BANNED BOTS
  if (this.BANNED_BOTS.includes(senderLower)) {
    return;
  }

  // 2. HANDLE COMMANDS
  // ... existing command handling ...

  // 3. MENTION DETECTION
  const botUsername = this.username.toLowerCase();
  const isMentioned = message.toLowerCase().includes(botUsername) ||
    message.toLowerCase().includes('nicky');

  if (!isMentioned) return;

  console.log(`📩 [Twitch] ${username}: ${message}`);

  try {
    const conversationId = `twitch-${this.channel.toLowerCase()}`;
    const chaos = ChaosEngine.getInstance();

    // Update game info
    await this.updateCurrentGame();
    const chaosState = await chaos.getCurrentState();

    // NEW: Build user dossier in parallel with context
    const [context, viewer] = await Promise.all([
      aiOrchestrator.gatherAllContext(
        message,
        this.activeProfile.id,
        conversationId,
        null,
        'STREAMING',
        this.currentGame
      ),
      this.getOrCreateViewer(username)
    ]);

    // NEW: Build user dossier
    const dossier = await this.buildUserDossier(viewer);

    // NEW: Add stream status + user dossier to context
    context.streamStatus = {
      isLive: this.isStreamLive,
      lastChecked: this.lastStreamCheck
    };
    context.userDossier = dossier;

    // Generate response
    const aiResponse = await aiOrchestrator.generateResponse(
      message,
      this.activeProfile.coreIdentity,
      context,
      'STREAMING',
      conversationId,
      this.activeProfile.id,
      'gemini-3-flash-preview',
      chaosState.sauceMeter || 0,
      this.currentGame
    );

    // Send response
    if (aiResponse && aiResponse.content) {
      // ... existing send logic ...
    }

    // NEW: Update viewer after response (background)
    process.nextTick(async () => {
      await this.updateViewerAfterInteraction(
        viewer,
        message,
        aiResponse.content
      );
    });

  } catch (error) {
    console.error('❌ Error handling Twitch message:', error);
  }
}

private async getOrCreateViewer(username: string): Promise<TwitchViewer> {
  let viewer = await storage.getTwitchViewer(this.activeProfile.id, username);

  if (!viewer) {
    viewer = await storage.createTwitchViewer({
      profileId: this.activeProfile.id,
      username: username,
      displayName: username,
      relationshipStatus: 'stranger',
      trustScore: 50
    });
    console.log(`👤 New Twitch viewer: ${username}`);
  } else {
    // Update last_seen and message_count
    await storage.updateTwitchViewer(viewer.id, {
      lastSeen: new Date(),
      messageCount: viewer.messageCount + 1
    });
  }

  return viewer;
}

private async buildUserDossier(viewer: TwitchViewer): Promise<UserDossier> {
  const source = `twitch:${viewer.username}`;
  const timeSinceLastSeen = Date.now() - viewer.lastSeen.getTime();
  const isReturning = timeSinceLastSeen > 24 * 60 * 60 * 1000;

  // Retrieve memories
  const memories = await storage.searchMemoriesBySource(source);
  const staticFacts = memories.filter(m => m.type === 'USER_FACT');
  const opinions = memories.filter(m => m.type === 'USER_OPINION');
  const stories = memories.filter(m => m.type === 'USER_STORY');
  const behaviors = memories.filter(m => m.type === 'USER_BEHAVIOR');

  // Get conversation threads (if returning)
  const conversationThreads = isReturning
    ? await storage.getConversationThreads(viewer.id, 3)
    : [];

  // Get city info
  const cityInfo = viewer.listenerCityId
    ? await storage.getListenerCity(viewer.listenerCityId)
    : null;

  return {
    platform: 'twitch',
    userId: viewer.id,
    username: viewer.username,
    displayName: viewer.displayName || viewer.username,
    relationshipStatus: viewer.relationshipStatus,
    nickyNickname: viewer.nickyNickname,
    trustScore: viewer.trustScore,
    firstSeen: viewer.firstSeen,
    lastSeen: viewer.lastSeen,
    messageCount: viewer.messageCount,
    isSubscriber: viewer.isSubscriber,
    isModerator: viewer.isModerator,
    activityPattern: viewer.activityPattern,
    staticFacts,
    opinions,
    stories,
    behaviors,
    conversationThreads,
    nickyObservations: [],
    lastConversationSummary: viewer.lastConversationSummary,
    typicalTopics: viewer.typicalTopics || [],
    cityInfo,
    isReturning,
    timeSinceLastSeen
  };
}

private async updateViewerAfterInteraction(
  viewer: TwitchViewer,
  message: string,
  response: string
) {
  // Extract topics
  const topics = this.extractTopics(message);
  const mergedTopics = this.mergeTrendingTopics(viewer.typicalTopics, topics);

  // Generate conversation summary
  const summary = await this.summarizeConversation(message, response);

  // Update viewer
  await storage.updateTwitchViewer(viewer.id, {
    typicalTopics: mergedTopics,
    lastConversationSummary: summary,
    updatedAt: new Date()
  });
}
```

### Context Builder Integration

```typescript
// server/services/contextBuilder.ts

public async buildChatContext(
  userMessage: string,
  profileId: string,
  conversationId?: string,
  mode?: string,
  context?: any,
  sauceMeter: number = 0,
  currentGame: string = ""
): Promise<{...}> {
  // ... existing context building ...

  // NEW: User Dossier Section
  if (context?.userDossier) {
    const dossierPrompt = this.formatUserDossierPrompt(context.userDossier);
    contextPrompt += dossierPrompt;

    // Add returning user alert if applicable
    if (context.userDossier.isReturning) {
      const returningPrompt = this.generateReturningUserPrompt(context.userDossier);
      contextPrompt += returningPrompt;
    }
  }

  // ... rest of context building ...

  return {
    contextPrompt,
    recentHistory,
    isArcRaidersActive,
    saucePrompt,
    gameFocusPrompt,
    personalityPrompt
  };
}

private formatUserDossierPrompt(dossier: UserDossier): string {
  let prompt = `\n[USER DOSSIER: @${dossier.displayName}]\n`;

  // Relationship
  prompt += `Relationship: ${dossier.relationshipStatus} (Trust: ${dossier.trustScore}/100)\n`;
  if (dossier.nickyNickname) {
    prompt += `Nicky calls them: "${dossier.nickyNickname}"\n`;
  }

  // Location
  if (dossier.cityInfo) {
    prompt += `Location: ${dossier.cityInfo.city}, ${dossier.cityInfo.country}\n`;
  }

  // Activity
  if (dossier.isReturning) {
    const days = Math.floor(dossier.timeSinceLastSeen / (1000 * 60 * 60 * 24));
    prompt += `\nLast seen: ${days} days ago\n`;
    if (dossier.lastConversationSummary) {
      prompt += `Last conversation: "${dossier.lastConversationSummary}"\n`;
    }
  }

  // Facts (top 5)
  if (dossier.staticFacts.length > 0) {
    prompt += `\nKnown Facts:\n`;
    dossier.staticFacts.slice(0, 5).forEach(fact => {
      prompt += `- ${fact.content}\n`;
    });
  }

  // Opinions (top 3)
  if (dossier.opinions.length > 0) {
    prompt += `\nTheir Takes:\n`;
    dossier.opinions.slice(0, 3).forEach(opinion => {
      prompt += `- ${opinion.content}\n`;
    });
  }

  // Behaviors (top 2)
  if (dossier.behaviors.length > 0) {
    prompt += `\nBehavior Patterns:\n`;
    dossier.behaviors.slice(0, 2).forEach(behavior => {
      prompt += `- ${behavior.content}\n`;
    });
  }

  // Activity pattern
  if (dossier.activityPattern) {
    prompt += `\nActivity Pattern: ${dossier.activityPattern}\n`;
  }

  // Nicky's take
  prompt += `\n🎭 NICKY'S TAKE: `;
  switch (dossier.relationshipStatus) {
    case 'stranger':
      prompt += `New face. Feel them out.`;
      break;
    case 'regular':
      prompt += `Regular viewer. They know the drill.`;
      break;
    case 'trusted':
      prompt += `Trusted regular. One of the good ones.`;
      break;
    case 'annoying':
      prompt += `This one's a pain in the ass. Keep it short.`;
      break;
  }

  prompt += `\n`;
  return prompt;
}

private generateReturningUserPrompt(dossier: UserDossier): string {
  const days = Math.floor(dossier.timeSinceLastSeen / (1000 * 60 * 60 * 24));

  let prompt = `\n[RETURNING USER ALERT]\n`;
  prompt += `@${dossier.displayName} just showed up after being gone ${days} days.\n`;

  if (dossier.lastConversationSummary) {
    prompt += `Last time: ${dossier.lastConversationSummary}\n`;
  }

  prompt += `\nOptions:\n`;
  prompt += `- Acknowledge return: "Oh great, ${dossier.nickyNickname || dossier.displayName} is back"\n`;

  if (dossier.lastConversationSummary) {
    prompt += `- Reference last topic: [callback to previous conversation]\n`;
  }

  if (days >= 7) {
    prompt += `- Notice absence: "Where the hell you been?"\n`;
  }

  prompt += `- Ignore if mid-conversation with others\n`;
  prompt += `\nYOUR CHOICE - be natural. Don't force it.\n`;

  return prompt;
}
```

---

## Testing Strategy

### Unit Tests

1. **User Dossier Building**
```typescript
describe('buildUserDossier', () => {
  it('should build complete dossier for returning user', async () => {
    const viewer = createMockViewer({ lastSeen: daysAgo(5) });
    const dossier = await buildUserDossier('twitch', viewer.username, profileId);

    expect(dossier.isReturning).toBe(true);
    expect(dossier.timeSinceLastSeen).toBeGreaterThan(24 * 60 * 60 * 1000);
  });

  it('should mark new users as stranger', async () => {
    const viewer = createMockViewer({ messageCount: 0 });
    const dossier = await buildUserDossier('twitch', viewer.username, profileId);

    expect(dossier.relationshipStatus).toBe('stranger');
  });
});
```

2. **Trust Score Calculation**
```typescript
describe('calculateTrustScore', () => {
  it('should give mods high trust', () => {
    const score = calculateTrustScore({ isModerator: true, ...defaults });
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('should penalize trolls', () => {
    const score = calculateTrustScore({
      ...defaults,
      behaviors: [{ content: 'User is a known troll' }]
    });
    expect(score).toBeLessThan(50);
  });
});
```

3. **Memory Tagging**
```typescript
describe('LoreOrchestrator speaker tagging', () => {
  it('should tag memories with speakerId', async () => {
    await loreOrchestrator.processNewContent(
      'I main Killer',
      profileId,
      'test-source',
      'CONVERSATION',
      conversationId,
      { speaker: 'user', speakerId: 'twitch:testuser' }
    );

    const memories = await storage.searchMemoriesBySource('twitch:testuser');
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].metadata.speakerId).toBe('twitch:testuser');
  });
});
```

### Integration Tests

1. **Full Flow Test**
```typescript
describe('Twitch user memory system', () => {
  it('should remember user across messages', async () => {
    // First message
    await twitchBot.handleMessage(
      { username: 'testuser' },
      'Hey Nicky, I main Killer'
    );

    // Wait for background processing
    await sleep(1000);

    // Second message (later)
    await twitchBot.handleMessage(
      { username: 'testuser' },
      'What killer should I play?'
    );

    // Verify context includes previous fact
    const context = await contextBuilder.gatherAllContext(
      'What killer should I play?',
      profileId,
      conversationId,
      null,
      'STREAMING'
    );

    expect(context.userDossier).toBeDefined();
    expect(context.userDossier.staticFacts.some(f =>
      f.content.includes('mains Killer')
    )).toBe(true);
  });
});
```

2. **Returning User Test**
```typescript
describe('Returning user detection', () => {
  it('should detect and prompt for returning users', async () => {
    // Create user with old last_seen
    await storage.createTwitchViewer({
      username: 'returninguser',
      lastSeen: daysAgo(7)
    });

    // User returns
    const dossier = await buildUserDossier('twitch', 'returninguser', profileId);

    expect(dossier.isReturning).toBe(true);

    const prompt = generateReturningUserPrompt(dossier);
    expect(prompt).toContain('RETURNING USER ALERT');
    expect(prompt).toContain('7 days');
  });
});
```

### Performance Tests

```typescript
describe('Performance benchmarks', () => {
  it('should build dossier in <100ms', async () => {
    const start = Date.now();
    await buildUserDossier('twitch', 'testuser', profileId);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should handle parallel requests efficiently', async () => {
    const promises = Array(10).fill(null).map((_, i) =>
      buildUserDossier('twitch', `user${i}`, profileId)
    );

    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;

    // Should be faster than sequential (10 * 100ms = 1000ms)
    expect(duration).toBeLessThan(500);
  });
});
```

---

## Future Enhancements

### Voice Recognition
If user speaks in voice chat, link voice samples to user profile for speaker identification.

### Sentiment Tracking
Track emotional sentiment over time to detect mood changes or tilt.

### Prediction System
Predict when users are likely to show up based on activity patterns.

### Memory Decay
Old, unused memories gradually lose confidence score (simulating "forgetting").

### Relationship Events
Track significant moments: first sub, first gift, big argument, reconciliation.

### Cross-Platform Unified Profiles
Allow users to claim/link their identities across platforms (opt-in).

### User-Requested Facts
Allow users to tell Nicky things to remember: "!remember I hate Midwich"

### Memory Correction
Allow users to correct wrong facts: "!forget that, I actually main Survivor"

---

## Migration Notes

### From Old Discord System

The old Discord fact extraction system (now disabled) used `discord_members.facts[]`. Migration path:

1. **Data Migration Script**:
```typescript
async function migrateDiscordFacts() {
  const members = await storage.getAllDiscordMembers();

  for (const member of members) {
    if (!member.facts || member.facts.length === 0) continue;

    for (const fact of member.facts) {
      await storage.createMemory({
        type: 'USER_FACT',
        content: fact,
        source: `discord:${member.userId}`,
        confidence: 75, // Default confidence
        lane: 'CANON',
        metadata: {
          speakerId: `discord:${member.userId}`,
          migratedFrom: 'legacy_discord_facts'
        }
      });
    }

    console.log(`Migrated ${member.facts.length} facts for ${member.username}`);
  }
}
```

2. **Run migration before enabling new system**
3. **Remove `facts` column from `discord_members` after confirming migration success**

---

## Configuration

### Feature Flags

```typescript
// server/config/features.ts
export const FEATURES = {
  USER_MEMORY_SYSTEM: {
    ENABLED: true,

    // Phase 1
    BASIC_TRACKING: true,
    SPEAKER_TAGGING: true,

    // Phase 2
    PROACTIVE_RECOGNITION: true,
    TRUST_SCORING: true,

    // Phase 3
    CONVERSATION_THREADING: false, // Not yet implemented
    BEHAVIORAL_ANALYSIS: false,
    CROSS_PLATFORM_HINTS: false
  }
};
```

### Thresholds

```typescript
export const USER_MEMORY_CONFIG = {
  // How long before user is considered "returning"
  RETURNING_USER_THRESHOLD_MS: 24 * 60 * 60 * 1000, // 24 hours

  // Minimum trust score for high-confidence facts
  MIN_TRUST_FOR_HIGH_CONFIDENCE: 70,

  // Message count thresholds for relationship progression
  STRANGER_TO_REGULAR_MESSAGES: 10,
  REGULAR_TO_TRUSTED_MESSAGES: 50,

  // Cache TTL
  VIEWER_CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes

  // Max memories to include in dossier
  MAX_FACTS_IN_DOSSIER: 5,
  MAX_OPINIONS_IN_DOSSIER: 3,
  MAX_BEHAVIORS_IN_DOSSIER: 2,
  MAX_THREADS_IN_DOSSIER: 3
};
```

---

## Monitoring & Metrics

### Key Metrics to Track

1. **User Engagement**
   - New users per day
   - Returning users per day
   - Average messages per user
   - Relationship status distribution

2. **Memory System**
   - Total user facts stored
   - Facts per user (average)
   - Memory retrieval latency
   - Cache hit rate

3. **Recognition Performance**
   - Returning user detection accuracy
   - Proactive greeting rate
   - User response to greetings (did they respond back?)

4. **Performance**
   - Dossier build time (p50, p95, p99)
   - Context building latency (before/after)
   - Database query times

### Logging

```typescript
console.log(`👤 [UserMemory] New user: ${username} (${platform})`);
console.log(`🔄 [UserMemory] Returning user: ${username} (${daysAway} days)`);
console.log(`📊 [UserMemory] Dossier built in ${duration}ms for ${username}`);
console.log(`🎯 [UserMemory] Trust score updated: ${username} ${oldScore} → ${newScore}`);
console.log(`💾 [UserMemory] Created ${memoryType} for ${username}: "${content}"`);
```

---

## Conclusion

This Living Relationship Memory System transforms Nicky from a stateless chatbot into an AI with genuine user relationships. By leveraging the existing memory infrastructure and adding lightweight user tracking, we enable:

- Persistent memory of users across sessions
- Proactive recognition of returning viewers
- Trust-weighted fact confidence
- Relationship evolution over time
- Behavioral pattern detection
- Conversation threading

All while maintaining <2% performance impact and reusing 90% of existing infrastructure.

**Next Steps**: Begin Phase 1 implementation with database schema and basic user tracking.
