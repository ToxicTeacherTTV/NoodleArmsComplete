# Nicky AI — AI-Powered Co-Host Application

**Last updated:** January 3, 2026

This repository contains **Nicky "Noodle Arms" A.I. Dente** — an AI-powered co-host application built for live streaming, podcasting, and Discord integration. The application features real-time voice interaction, advanced memory systems, and dynamic personality control.

**Tech Stack:** React + TypeScript + Vite frontend | Express + TypeScript backend | PostgreSQL (Neon) with Drizzle ORM | Gemini 3 Flash (primary) | ElevenLabs voice synthesis

> 📘 **New to the project?** Check out the [Master Architecture Document](./MASTER_ARCHITECTURE.md) for a complete overview of how the system works, including memory, personality, and voice pipelines.

---

## 🎯 Current Architecture (January 2026)

### **AI Provider Strategy**
**Primary:** Gemini 3 Flash (Default for Chat, RAG, Extraction, & Analysis)  
**Fallback Chain:**
1. `gemini-3-flash-preview` (primary, production-ready)
2. `gemini-3-pro-preview` (if Flash rate-limited or for complex reasoning)

**Cost Impact:** ~95% reduction in AI costs vs legacy Pro models  
**Performance:** 70% faster response times via parallel RAG and aggressive history truncation.  
**Privacy:** Global "Memory Learning" toggle and per-message `[PRIVATE]` triggers for user control.

### **Recent Major Updates (Jan 2026)**

✅ **Model Flow Audit & .env Restoration**
- Verified Gemini 3 Flash as the primary engine for all system operations.
- Restored production model strategy in `.env` to prevent experimental model overrides.

✅ **Privacy & Memory Control**
- Implemented global "Memory Learning" toggle in the UI.
- Added "🧠 Learning" vs "🔒 Private" status indicators.
- Enabled message-level privacy triggers (`[PRIVATE]`).

✅ **Context Optimization**
- Vector-based semantic retrieval for training data (style guidance).
- Aggressive 600-character history truncation for faster processing.
- Reduced rumor retrieval cap to 3 entries for improved focus.

✅ **Architectural Refactor: Brain/Mouth Pattern**
- Centralized all RAG logic into `ContextBuilder` (The Brain).
- Decoupled context gathering from model providers (The Mouth).
- Implemented parallel context loading using `Promise.all` for 70% faster retrieval.

✅ **Unreliable Narrator: Memory Lanes**
- Implementation of `CANON` vs `RUMOR` memory lanes.
- Nicky now respects verified truth (Canon) but is encouraged to lie about gossip (Rumor).
- Integrated "Truth Guard" policies into the centralized context builder.

✅ **Gemini 3 Migration**
- Full migration to Gemini 3 Flash as the primary engine.
- Implementation of "Single-Pass Generation" for Podcast Mode.
- Massive context window utilization for deep lore retrieval.

✅ **Personality Hardening ("Show, Don't Tell")**
- Strict enforcement of character integrity.
- Removal of all stage directions (*leans in*, [sighs]) from AI output.
- Use of [emotion] tags and dialogue-only character expression.

✅ **Vibe-Based Storytelling Engine**
- Narrative Archetypes (The Grudge, The Fugitive, etc.) for unpredictable city stories.
- Multi-turn persistence via database metadata state machine.
- Natural city detection in chat and manual UI triggers.

✅ **Podcast Listener Cities Tracker**
- Dedicated dashboard for tracking viewer locations.
- Automatic coverage tracking and random city selection.
- Integration with the main chat dashboard via query parameters.

For detailed changes, see `CHANGELOG.md`.

---

## 📁 Project Structure

```
NoodleArmsComplete/
├── client/src/           # React frontend
│   ├── components/       # UI components (30+ panels/dashboards)
│   │   ├── jazz-dashboard-v2.tsx       # Main application container
│   │   ├── personality-surge-panel.tsx # Unified personality controls
│   │   ├── memory-panel.tsx            # Memory management UI
│   │   └── ...
│   ├── lib/              # Utilities, hooks, API client
│   └── pages/            # Route components (including Listener Cities)
├── server/
│   ├── services/         # Business logic (50+ services)
│   │   ├── aiOrchestrator.ts       # Model routing and coordination
│   │   ├── contextBuilder.ts       # Centralized RAG engine (The Brain)
│   │   ├── gemini.ts               # Gemini 3 API integration (The Mouth)
│   │   ├── anthropic.ts            # Claude API integration (The Mouth)
│   │   ├── personalityController.ts # Personality management
│   │   ├── emotionEnhancer.ts      # Adds the emotion tags
│   │   └── ...
│   ├── routes.ts         # API endpoints
│   ├── storage.ts        # Database abstraction layer
│   └── index.ts          # Express app entry point
├── shared/
│   ├── schema.ts         # Drizzle ORM schemas (18+ tables)
│   └── types.ts          # Shared TypeScript types
└── docs/                 # Documentation, roadmaps, notes
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (or Neon serverless account)
- API keys: Gemini, Claude (optional), ElevenLabs, SerpAPI

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
# Create .env file with:
# - DATABASE_URL (PostgreSQL connection string)
# - GEMINI_API_KEY (primary AI provider)
# - ANTHROPIC_API_KEY (fallback, optional on free tier)
# - ELEVENLABS_API_KEY (voice synthesis)
# - SERPAPI_API_KEY (web search)

# 3. Push database schema
npm run db:push

# 4. Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev              # Start dev server (frontend + backend)
npm run build            # Production build (Vite + esbuild)
npm run start            # Run production build
npm run check            # TypeScript type checking
npm run db:push          # Push schema changes to database
npm run db:backfill-integrity  # Backfill data integrity checks
npm run audit:timelines  # Audit event timeline consistency
```

---

## 🧠 Core Features

### **1. Advanced Memory System**
- **Storage:** 4,136+ unique memories with atomic UPSERT preventing duplicates
- **Types:** FACT, PREFERENCE, LORE, CONTEXT, STORY, ATOMIC
- **Importance Scoring:** 0-999 (protected facts at 999)
- **Hybrid Retrieval:** ✅ **Keyword + semantic search ACTIVE** (Gemini text-embedding-004)
- **Vector Embeddings:** ✅ **IMPLEMENTED** - Automatic embedding generation for new memories
- **Semantic Search:** Finds related memories by meaning, not just keywords
- **Deduplication:** Canonical key system with comprehensive metadata merging
- **Background Processing:** Embeddings generated automatically without blocking memory creation

### **2. Dynamic Personality Control**
- **11 Preset Personalities:** Roast Mode, Chill Nicky, Storytime, Gaming Rage, FULL_PSYCHO, etc.
- **Chaos Engine:** Dynamic personality drift with advisory influence (not forced)
- **Variety Controller:** 4 facet system (aggressive, storyteller, analytical, chaotic)
- **Scene Cards:** Contextual prompts for storylet generation
- **Training System:** AI-powered consolidation of conversation examples into unified style guides

### **3. Discord Bot Integration**
- **Proactive Messaging:** Context-aware engagement (2-3 messages/day global limit)
- **Behavior Modulation:** Server-specific personality adjustments
- **Drift System:** Bounded random walk for personality evolution
- **Channel Awareness:** Topic detection from channel names
- **Member Tracking:** Automatic fact extraction from server interactions

### **4. Podcast & Content Management**
- **RSS Sync:** Automatic episode import and processing
- **Fact Extraction:** AI-powered memory creation from podcast content
- **Listener Cities:** Geographic tracking with random selection feature
- **Episode Memories:** Source attribution for podcast-derived facts
- **Preroll Ads:** Dynamic ad generation with TTS support

### **5. Document Processing Pipeline**
- **Supported Formats:** PDF, DOCX, TXT, Markdown
- **Stage Tracking:** Uploaded → Processing → Analyzing → Completed
- **Entity Extraction:** People, places, events with relationship linking
- **Duplicate Detection:** 85% similarity threshold with metadata merging
- **Memory Generation:** Automatic knowledge base population from documents

### **6. Voice & TTS**
- **Primary:** ElevenLabs API v3 (stability: 0.3-0.75, similarity: 0.75-0.8)
- **Fallback:** Browser Speech Synthesis API
- **Mode-Specific Settings:**
  - PODCAST: Manual voice generation (credit conservation)
  - STREAMING: Auto-voice for reactions <300 chars
  - CHAT: Optional voice output
- **Emotion Tags:** TTS instructions like `[scoffs]`, `[furious]`, `[mutters]`

### **7. Intelligence & Analytics**
- **Fact Clustering:** AI-powered semantic grouping of related memories
- **Personality Drift Analysis:** Track personality evolution over time
- **Contradiction Detection:** Smart resolution with importance weighting
- **Prometheus Metrics:** LLM call tracking, token usage, cost estimation
- **Performance Monitoring:** Response times, cache hit rates, error rates

---

## 🎮 Mode-Specific Behaviors

### **PODCAST Mode**
```typescript
{
  maxTokens: 1024,
  temperature: 0.8,
  style: 'storytelling',
  voiceOutput: false,  // Manual generation
  personalityIntensity: 'moderate',
  responseShape: 'long-form narrative'
}
```

### **STREAMING Mode**
```typescript
{
  maxTokens: 256,
  temperature: 1.0,
  style: 'reactive',
  voiceOutput: true,   // Auto-voice enabled
  personalityIntensity: 'high',
  responseShape: 'quick reactions',
  optimizations: {
    contextPruning: true,
    parallelLoading: true,
    responseCache: true
  }
}
```

### **CHAT Mode**
```typescript
{
  maxTokens: 512,
  temperature: 0.9,
  style: 'conversational',
  voiceOutput: 'optional',
  personalityIntensity: 'adaptive',
  responseShape: 'balanced dialogue'
}
```

---

## 🔧 Configuration & Environment

### **Required Environment Variables**
```bash
# Database
DATABASE_URL="postgresql://user:pass@host/db"

# AI Providers
GEMINI_API_KEY="your-gemini-key"           # PRIMARY
ANTHROPIC_API_KEY="your-claude-key"        # FALLBACK (optional on free tier)

# Voice Synthesis
ELEVENLABS_API_KEY="your-elevenlabs-key"

# Web Search
SERPAPI_API_KEY="your-serpapi-key"

# Discord Bot
DISCORD_BOT_TOKEN="your-discord-token"
```

### **Optional Configuration**
```bash
# Model Selection (override defaults)
GEMINI_DEFAULT_MODEL="gemini-2.5-flash"    # Default: gemini-2.5-flash
GEMINI_DEV_MODEL="gemini-2.0-flash-exp"    # Dev only: experimental models
NODE_ENV="production"                       # production | development
```

---

## 📊 Database Schema Highlights

### **Core Tables** (15 total)
- `profiles` - AI personality configurations
- `conversations` - Conversation sessions with mode tracking
- `messages` - Chat history with voice output flags
- `memory_entries` - Knowledge base (4,136+ entries)
  - Vector embedding columns (fully populated)
  - Canonical key for deduplication
  - Importance scoring (0-999)
- `documents` - Uploaded files with processing stages
- `training_examples` - Conversation-based training data
- `podcast_episodes` - RSS-synced episode metadata
- `listener_cities` - Geographic tracking
- `discord_servers` - Bot behavior per server

### **Entity Relationship Tables**
- `people`, `places`, `events` - Extracted entities
- `memory_people_links`, `memory_place_links`, `memory_event_links` - Many-to-many relationships

### **System Tables**
- `content_flags` - AI-flagged content for review
- `event_timelines` - Ordered event sequences
- `preroll_ads` - Dynamic ad generation

---


## 🚨 Known Issues & Limitations

### **⚠️ High Priority**
1. **Gemini Free Tier Rate Limits**
   - `gemini-2.5-flash`: 10 RPM, 250 RPD (frequently hit with multiple users)
   - `gemini-2.5-pro`: 2 RPM, 50 RPD (very limited on free tier)
   - **Current Behavior:** Falls back to `gemini-2.0-flash-exp` (experimental, lower quality)
   - **Impact:** Quality degradation during high-traffic periods
   - **Solution:** Consider paid tier ($250 spend = Tier 2: 1000 RPM, 4M RPM, 10K RPD)
   - **Status:** Operating on free tier, monitoring usage patterns

2. **Embedding Service Backfill**
   - ✅ Service implemented and active for new memories
   - ✅ Bulk backfill completed (Dec 8, 2025)
   - **Status:** All 4,136 memories have embeddings and support semantic search
   - **Impact:** Full semantic search capability across entire knowledge base

3. **Memory Retrieval Tuning**
   - Recency bias may overshadow important older memories
   - Diversity scoring can filter out relevant duplicates
   - Debug UI shows retrieved memories but not detailed scoring
   - **Ongoing:** A/B testing hybrid search weight configurations

### **🔧 Medium Priority**
1. **ElevenLabs Credit Management**
   - Auto-voice in STREAMING mode can burn credits quickly
   - Need smarter heuristics for when to generate voice
   - Consider character count + importance thresholds

2. **Discord Bot Proactivity**
   - Current trigger: random probability
   - Needs: context-aware triggering (keywords, channel activity)
   - Daily limit (2-3 messages) may be too conservative

3. **Personality Drift Unpredictability**
   - Chaos Engine adds randomness that may reduce consistency
   - Consider making it optional or reducing influence

### **📋 Low Priority**
1. **Training Example Consolidation**
   - Requires 3+ examples before consolidating
   - Quality varies based on example selection
   - May need manual curation for best results

2. **Document Processing**
   - Large PDFs (>100 pages) can timeout
   - Entity extraction may miss nuanced relationships
   - Duplicate detection threshold (85%) may need tuning

---

## 📈 Recommended Next Steps

### **Week 1: Optimize Performance & Cost**
1. **Monitor Gemini rate limits** and evaluate paid tier
   - Track fallback frequency to experimental models
   - Measure quality degradation during peak usage
   - Decision point: Upgrade if >20% of requests use experimental fallback

3. **Optimize STREAMING mode** further
   - Current: 1.5x candidate multiplier
   - Test: 1.2x multiplier for even faster responses
   - Monitor: Ensure retrieval quality maintained

### **Week 2: UI & User Experience**
1. **Add memory retrieval debug panel**
   - Show which memories influenced each response
   - Display semantic similarity scores
   - Allow toggling search strategies (keyword vs semantic weight)

2. **Build memory management enhancements**
   - "Find Duplicates" UI button (backend ready)
   - Inline editing for content, importance, category
   - View which conversation created each memory

3. **Memory analytics dashboard**
   - Total memories by category (pie chart)
   - Memory growth over time (line graph)
   - Top 10 most-referenced memories

### **Week 3: Quality & Reliability**
1. **Smart auto-voice heuristics**
   - Only auto-generate for messages <200 chars
   - Skip if user is in PODCAST mode
   - Add UI toggle for auto-voice enable/disable

2. **Context-aware Discord bot**
   - Replace random triggers with keyword detection
   - Increase daily limit to 5 messages if context-driven
   - Add cooldown per channel (45+ minutes)

3. **Personality preset evaluation**
   - Test each of 11 presets in actual usage
   - Rate usefulness and user satisfaction
   - Consolidate to 3-5 most effective presets

---

## 📚 Documentation

### **Core Documentation**
- **`PROJECT_ROADMAP.md`** - Detailed roadmap, completed features, implementation notes
- **`NOTES.md`** - Development context, architectural decisions
- **`LISTENER_CITIES_README.md`** - Listener cities feature guide
- **`GEMINI_COST_OPTIMIZATION.md`** - Model selection strategies, cost analysis
- **`PERSONALITY_FIX_GUIDE.md`** - Personality tuning recommendations

### **Database & Schema**
- **`shared/schema.ts`** - Complete Drizzle ORM schema (15 tables)
- **`add-listener-cities.sql`** - SQL migration for listener cities
- **`fix-preroll-ads.sql`** - Preroll ad schema fixes

### **Attached Assets** (Historical Context)
- Training data exports
- Nicky personality notes
- Lore brain restructuring documents
- DbD integration specifications

---

## 🤝 Contributing

### **Development Workflow**
1. **Create issue** describing the change or bug
2. **Branch from `main`**: `git checkout -b feature/your-feature`
3. **Make changes** with clear commit messages
4. **Run type checking**: `npm run check`
5. **Test locally**: `npm run dev`
6. **Submit PR** with description of changes

### **Code Style**
- TypeScript for all new code
- Use Drizzle ORM for database operations
- Follow existing service patterns (try/catch with fallbacks)
- Add JSDoc comments for public APIs
- Keep functions focused and testable

### **Testing Guidelines**
- Unit tests for business logic
- Integration tests for API endpoints
- Manual testing for personality/character features
- Document any breaking changes

---

## 📞 Support & Contact

### **Issues & Bug Reports**
Open an issue on GitHub with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)

### **Feature Requests**
Check `PROJECT_ROADMAP.md` first - your idea might already be planned!  
If not, open an issue with:
- Use case / problem being solved
- Proposed solution
- Priority level (your opinion)

### **Questions & Discussions**
For general questions about the codebase or architecture, see:
- **Technical details**: `NOTES.md`
- **Roadmap questions**: `PROJECT_ROADMAP.md`
- **Personality tuning**: `PERSONALITY_FIX_GUIDE.md`

---

## 📄 License

MIT License - See `LICENSE` file for details

---

**Last Updated:** November 10, 2025  
**Current Version:** 1.0.0  
**Status:** Production (with known rate limit challenges on free tier)

---

*This README is maintained as a living document. For the most up-to-date technical details, see the roadmap and notes files. If you notice outdated information, please open an issue or PR.*

