# AI-Powered Co-Host Application

## Overview
This AI-powered co-host application acts as an interactive voice agent for live streamers. It processes user speech, leverages AI for contextually-aware audio responses, and features real-time interaction, persistent memory, document processing, and customizable AI personalities. The project aims to enhance live streaming interactions and podcast content creation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 19 (TypeScript, functional components, hooks)
- **Styling**: Tailwind CSS, custom CSS variables, Radix UI, shadcn/ui
- **State Management**: Local React state
- **Routing**: Wouter
- **Data Fetching**: TanStack React Query

### Backend
- **Runtime**: Node.js with Express.js (TypeScript, ESM)
- **API**: RESTful (profiles, conversations, messages, documents, memory)
- **File Upload**: Multer
- **Build System**: Vite (frontend), esbuild (server)

### Data Storage
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Schema**: Tables for profiles, conversations, messages, documents, memory
- **Session Storage**: PostgreSQL-based
- **File Storage**: In-memory for document processing

### Authentication
- **Session Management**: Express sessions with PostgreSQL storage
- **API Keys**: Environment-based configuration

### Voice Processing
- **Speech-to-Text**: Browser-native Web Speech API
- **Text-to-Speech**: Browser-native Speech Synthesis API, ElevenLabs integration
- **Voice Activity Detection**: Web Audio API
- **Smart Voice Credit Management**: PODCAST (manual voice), STREAMING (auto-voice) modes

### AI Integration - Gemini-Primary Architecture ✅
**Last Updated:** October 17, 2025

#### 🎯 Architecture Migration Complete
The system now uses **Gemini 2.5 Pro as PRIMARY** across all AI operations, with Claude Sonnet 4.5 as expensive failsafe only.

**Approved Models:**
- **Primary AI**: Google Gemini Pro (`gemini-2.5-pro`) - FREE TIER
- **Fallback AI**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) - PAID

**BANNED Models:**
- ❌ ALL Gemini Flash variants (1.5-flash, 2.0-flash, 2.5-flash, flash-exp)
- **Reason**: Flash models hallucinate facts and create false memories (269 corrupted memories in Oct 2025 incident)
- **Enforcement**: Runtime checks in geminiService constructor will throw errors if Flash is used

#### 💰 Cost-Optimized Task Distribution

**User-Facing Features (Gemini → Claude Fallback):**
1. **Main Chat Responses** (anthropic.ts `generateResponse()`)
   - Primary: Gemini 2.5 Pro (free)
   - Fallback: Claude Sonnet 4.5 (paid failsafe)
   
2. **Memory Consolidation** (anthropic.ts `consolidateMemories()`)
   - Primary: Gemini 2.5 Pro (free)
   - Fallback: Claude Sonnet 4.5 (paid failsafe)
   
3. **Intelligence Analysis** (intelligenceEngine.ts)
   - `analyzeFactClusters()`: Gemini → Claude fallback
   - `analyzePersonalityDrift()`: Gemini → Claude fallback
   
4. **Ad Generation** (AdGenerationService.ts)
   - Primary: Gemini 2.5 Pro (free)
   - Fallback: Claude Sonnet 4.5 (paid failsafe)
   
5. **Style Consolidation** (styleConsolidator.ts)
   - Primary: Gemini 2.5 Pro (free)
   - Fallback: Claude Sonnet 4.5 (paid failsafe)
   
6. **Discord Bot Responses** (discordBot.ts)
   - Primary: Gemini 2.5 Pro (free)
   - Fallback: Claude Sonnet 4.5 (paid failsafe)
   
7. **Emotion Tags** (emotionTagGenerator.ts)
   - Primary: Gemini 2.5 Pro (free)
   - Fallback: Claude Sonnet 4.5 (paid failsafe)
   
8. **Story Reconstruction** (storyReconstructor.ts)
   - Uses anthropicService (inherits Gemini→Claude pattern)

**Bulk/Volume Tasks (Gemini-Only for Cost Optimization):**
9. **Content Flagging** (aiFlagger.ts)
   - Gemini-only (77% accuracy acceptable for metadata)
   
10. **Document Processing** (documentProcessor.ts)
    - Gemini-only (volume task, free tier)
    
11. **Podcast Fact Extraction** (podcastFactExtractor.ts)
    - Gemini-only (volume task, free tier)
    
12. **Discord Member Facts** (discordFactExtractor.ts)
    - Gemini-only (volume task, free tier)
    
13. **Entity Extraction** (entityExtraction.ts)
    - Gemini-only (volume task, free tier)
    
14. **Contradiction Detection** (contradictionDetector.ts, smartContradictionDetector.ts)
    - Gemini-only (volume task, free tier)
    
15. **Intrusive Thoughts** (intrusiveThoughts.ts)
    - Gemini-only (backend feature)

#### 🛡️ Enforcement Mechanisms
1. **Constructor-level override**: geminiService blocks any Flash model at runtime
2. **APPROVED_MODELS constant**: Whitelist of allowed models
3. **validateModel() guards**: 12+ validation points across all Gemini methods
4. **Stack trace logging**: Any Flash attempt logs full call stack for debugging
5. **Error handling**: All services follow Gemini → Claude → graceful degradation pattern

#### 📊 Cost Impact
- **FREE:** Gemini 2.5 Pro handles 90%+ of requests (free tier)
- **PAID:** Claude Sonnet 4.5 only activates on Gemini failures (premium failsafe)
- **Prometheus Metrics**: Tracks both providers separately for cost analysis

### Memory System
- **Enhanced RAG with Intelligent Retrieval**:
  - **Recency Bias**: Recent conversation context prioritized (exponential decay)
  - **Thread Awareness**: Prevents repetitive context from same conversation
  - **Query Intent Detection**: Identifies tell_about, asking_opinion, requesting_story, etc.
  - **Diversity Scoring**: Prevents similar/duplicate memories in results
  - **Two-Pass Re-ranking**: 50 candidates → diversity filter → 15 best results
  - **Knowledge Gap Detection**: Identifies missing information via proper noun analysis
  - **Performance Optimizations**: LRU cache, batch queries, 6 database indexes
  
- **Unified Personality System**: Preset-based PersonalityControl with 11 profiles
- **Personality Profiles**: Customizable AI identities and knowledge bases

### Document Processing
- **PDF Processing**: pdf-parse for text extraction
- **Text Chunking**: Intelligent segmentation
- **Knowledge Extraction**: Automatic memory entry creation via Gemini (free tier)
- **Training Examples System**: Meta-learning from conversation samples
  - **Dual-Mode Learning**: Separates thinking/strategy from conversation style
  - **Strategy Patterns**: Extracts reasoning blocks (how to think about responses)
  - **Style Examples**: Pure conversation samples (tone, cadence, personality)
  - **Smart Parsing**: Auto-detects "Plotted/The user/I need to" thinking patterns
  - **Token Optimization**: Max 5 strategy examples (800 chars each) + 8 conversation examples (1200 chars each)

### Memory Management
- **Memory Types**: FACT, PREFERENCE, LORE, CONTEXT
- **Importance Scoring**: Weighted entries
- **Memory Consolidation**: AI-powered optimization (Gemini primary, Claude fallback)
- **Search**: Keyword-based retrieval
- **Deduplication System**: Atomic UPSERT-based duplicate prevention (Oct 2025)
  - **Canonical Key Matching**: Normalizes content for duplicate detection
  - **Unique Database Constraint**: (profileId, canonicalKey) prevents race conditions
  - **Comprehensive Metadata Merging**: Preserves richest data on conflicts
    - Counters: confidence +10 (max 100), supportCount +1
    - Metadata: Uses COALESCE to preserve existing values when new ones are null
    - Arrays: Merges and deduplicates keywords/relationships
    - Quality fields: Preserves contradictionGroupId, temporalContext, qualityScore, clusterId
    - Temporal: Preserves firstSeenAt, updates lastSeenAt/updatedAt
  - **Cleanup Tooling**: Removed 39 duplicates (1544 → 1505 unique memories)
- **Entity Linking System**: Many-to-many relationships between memories and entities
  - **Junction Tables**: memory_people_links, memory_place_links, memory_event_links
  - **Multi-Entity Support**: Each memory can link to multiple people, places, and events
  - **Automatic Extraction**: AI extracts all entities from memory content (Gemini-only)
  - **Deduplication**: Prevents duplicate entity creation through disambiguation
  - **Smart Updates** (Oct 2025): Instead of creating duplicates, updates existing entity context when new information is found
    - Matches by name and aliases (case-insensitive)
    - Merges context intelligently (avoids duplicate text)
    - Preserves and combines aliases from both sources
- **UI Enhancements** (Oct 2025):
  - **Enhanced Memory Panel**: Category filter, importance slider (0-5), source filter, Find Duplicates button, active filter count badge
  - **Memory Debug Panel**: Debug mode toggle in chat header, query tracking, retrieved memories display with relevance scores, collapsible entries, integrated into chat interface
  - **Memory Analytics Dashboard**: Category distribution chart, importance histogram, source breakdown, 7-day growth graph, top 5 most-retrieved memories, accessible via Brain Management "📊 Analytics" tab
  - **Protected Facts Manager**: Full CRUD interface for high-importance memories
- **Architecture Review Completed** (Oct 2025):
  - Evaluated external recommendations against existing implementation
  - Most features already implemented: pgvector, deduplication, Discord triggers, personality presets, entity linking, Gemini fallback
  - Added 6 new valuable items to PROJECT_ROADMAP.md: Prometheus metrics, DecisionTrace expansion, panic mode, testing infrastructure, Dockerization, OpenAPI docs

### Metrics & Observability
- **Prometheus Metrics**: Comprehensive cost and usage tracking (Oct 2025)
  - **Endpoint**: `/api/metrics` (standard `/metrics` blocked by Vite in dev mode)
  - **Security**: Optional `METRICS_TOKEN` environment variable for bearer token auth
  - **LLM Metrics**: Calls, tokens, estimated costs, errors, latency (Claude/Gemini tracked separately)
  - **Discord Metrics**: Reply messages, proactive messages
  - **HTTP Metrics**: Request count, duration histograms, status codes
  - **Cardinality Control**: Route normalization prevents metric explosion (UUIDs → `:id`)
  - **Error Tracking**: Failed LLM calls counted in totals before recording errors
  - **Cost Estimation**: Built-in pricing for claude-sonnet-4-5 and gemini-2.5-pro

### Communication Flow
1. Voice Input (browser speech recognition)
2. Message Queuing
3. Context Retrieval (RAG)
4. AI Processing (Gemini primary, Claude fallback)
5. Response Generation
6. Voice Output (browser speech synthesis)
7. Memory Storage

### Core Components
- Dashboard, Chat Panel, Control Panel, PersonalitySurgePanel, Discord Management Panel
- Profile, Memory, Document Panels, Voice Visualizer
- **Memory UI Suite**: Enhanced Memory Panel (filters, search), Memory Debug Panel (retrieval tracking), Memory Analytics Dashboard (charts & insights), Protected Facts Manager
- **Ad Generation** (Oct 2025): Simplified comedy-first approach
  - Temperature 0.95 (up from 0.6) for spontaneous humor
  - Real example ads in prompt (grumpy, conspiracy, unhinged)
  - 300-600 character scripts (30-60 seconds, down from 2500)
  - Removed forced structure constraints that killed comedy
  - Basic name validation only (no over-engineered tracking)

## External Dependencies

### AI Services
- **Google Gemini API**: Primary AI for all operations (free tier)
- **Anthropic Claude API**: Fallback AI for user-facing features (paid failsafe)
- **ElevenLabs API**: Enhanced text-to-speech

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **PostgreSQL**: Primary data storage

### Development Tools
- **Vite**: Frontend development and build
- **Replit Integration**: Development environment

### Browser APIs
- **Web Speech API**: Speech recognition and synthesis
- **Web Audio API**: Audio processing and visualization
- **MediaDevices API**: Microphone access

### UI Libraries
- **Radix UI**: Headless UI components
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### Utility Libraries
- **Drizzle ORM**: Type-safe database operations
- **TanStack React Query**: Server state management
- **date-fns**: Date manipulation
- **nanoid**: Unique ID generation
- **pdf-parse**: PDF text extraction
- **multer**: File upload handling

## Recent Major Updates

### October 17, 2025 - Gemini-Primary Architecture Migration ✅
**Status:** COMPLETED - All services migrated

**What Changed:**
- Swapped ALL AI services from Claude-primary to Gemini-primary
- Gemini 2.5 Pro now handles 90%+ of requests for FREE
- Claude Sonnet 4.5 only activates as expensive failsafe on Gemini failures
- Bulk/volume tasks remain Gemini-only for maximum cost efficiency

**Services Updated:**
1. Main chat responses (anthropic.ts)
2. Memory consolidation (anthropic.ts)
3. Intelligence analysis (intelligenceEngine.ts)
4. Ad generation (AdGenerationService.ts)
5. Style consolidation (styleConsolidator.ts)
6. Discord bot responses (discordBot.ts)
7. Emotion tag generation (emotionTagGenerator.ts)
8. Story reconstruction (storyReconstructor.ts)

**Architect Review:** PASSED with no critical issues
- Consistent Gemini→Claude pattern across all services
- Robust error handling (try Gemini → catch → try Claude → catch → graceful degradation)
- Post-processing pipelines maintained
- No security issues
- Prometheus metrics tracking both providers correctly

**Cost Savings:** Estimated 90% reduction in AI costs by maximizing free tier usage
