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

### AI Integration
- **Primary AI Service**: Anthropic's Claude API (claude-sonnet-4-5-20250929)
- **Fallback Service**: Google Gemini API (automatic fallback)
- **Memory System**: Enhanced RAG with intelligent retrieval
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
- **Knowledge Extraction**: Automatic memory entry creation
- **Training Examples System**: Meta-learning from conversation samples
  - **Dual-Mode Learning**: Separates thinking/strategy from conversation style
  - **Strategy Patterns**: Extracts reasoning blocks (how to think about responses)
  - **Style Examples**: Pure conversation samples (tone, cadence, personality)
  - **Smart Parsing**: Auto-detects "Plotted/The user/I need to" thinking patterns
  - **Token Optimization**: Max 5 strategy examples (800 chars each) + 8 conversation examples (1200 chars each)

### Memory Management
- **Memory Types**: FACT, PREFERENCE, LORE, CONTEXT
- **Importance Scoring**: Weighted entries
- **Memory Consolidation**: AI-powered optimization
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
  - **Automatic Extraction**: AI extracts all entities from memory content
  - **Deduplication**: Prevents duplicate entity creation through disambiguation
- **UI Enhancements** (Oct 2025):
  - **Enhanced Memory Panel**: Category filter, importance slider (0-5), source filter, Find Duplicates button, active filter count badge
  - **Memory Debug Panel**: Debug mode toggle in chat header, query tracking, retrieved memories display with relevance scores, collapsible entries, integrated into chat interface
  - **Memory Analytics Dashboard**: Category distribution chart, importance histogram, source breakdown, 7-day growth graph, top 5 most-retrieved memories, accessible via Brain Management "📊 Analytics" tab
  - **Protected Facts Manager**: Full CRUD interface for high-importance memories
- **Architecture Review Completed** (Oct 2025):
  - Evaluated external recommendations against existing implementation
  - Most features already implemented: pgvector, deduplication, Discord triggers, personality presets, entity linking, Gemini fallback
  - Added 6 new valuable items to PROJECT_ROADMAP.md: Prometheus metrics, DecisionTrace expansion, panic mode, testing infrastructure, Dockerization, OpenAPI docs

### Communication Flow
1. Voice Input (browser speech recognition)
2. Message Queuing
3. Context Retrieval (RAG)
4. AI Processing (Claude API)
5. Response Generation
6. Voice Output (browser speech synthesis)
7. Memory Storage

### Core Components
- Dashboard, Chat Panel, Control Panel, PersonalitySurgePanel, Discord Management Panel
- Profile, Memory, Document Panels, Voice Visualizer
- **Memory UI Suite**: Enhanced Memory Panel (filters, search), Memory Debug Panel (retrieval tracking), Memory Analytics Dashboard (charts & insights), Protected Facts Manager

## External Dependencies

### AI Services
- **Anthropic Claude API**: Conversational AI, response generation, memory consolidation
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