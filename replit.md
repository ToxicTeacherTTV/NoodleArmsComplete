# AI-Powered Co-Host Application

## Overview
"Nicky 'Noodle Arms' A.I. Dente" is an AI-powered co-host application for live streaming and podcast content. It features an Italian-American mafia persona with real-time voice interaction, autonomous knowledge management, memory systems using vector embeddings, and intelligent content processing pipelines. The project aims to provide engaging, personalized, and dynamic AI interactions for content creators.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 19 with TypeScript, functional components.
- **Routing**: Wouter for client-side routing.
- **State Management**: TanStack React Query v5 for server state, React hooks for local state.
- **Styling**: Tailwind CSS, Radix UI primitives, shadcn/ui.
- **Forms**: React Hook Form with Zod validation.
- **Build Tool**: Vite.

### Backend
- **Runtime**: Node.js with Express.js (TypeScript, ESM).
- **API Pattern**: RESTful API (JSON).
- **Session Management**: Express sessions with PostgreSQL storage.
- **File Handling**: Multer for multipart/form-data uploads.
- **WebSocket**: Real-time communication for voice streaming and status updates.

### Database
- **Provider**: Neon serverless PostgreSQL.
- **ORM**: Drizzle ORM with type-safe queries.
- **Migration Strategy**: `drizzle-kit push`.
- **Indexing**: Strategic indexes on foreign keys, unique constraints, full-text search preparation.
- **Core Tables**: `profiles`, `conversations`, `messages`, `memories`, `entities`, `documents`, `podcast_episodes`, `protected_facts`. All entities are scoped to `profileId` for multi-tenancy.

### AI Integration Strategy
- **Primary AI**: Google Gemini 2.5 Pro for all AI operations. Gemini Flash models are banned.
- **Fallback AI**: Claude Sonnet 4.5 for critical user-facing features when Gemini fails.
- **AI Operation Categories**:
    - **User-Facing**: Chat responses, memory consolidation, intelligence analysis, ad generation, emotion tagging.
    - **Bulk/Volume**: Content moderation, document processing, podcast fact extraction, entity extraction, contradiction detection.
- **Model Configuration**: Dynamic temperature (0.7-1.2), configured max tokens (512-4096), personality-aware system prompts, streaming support.

### Voice Processing System
- **Speech Recognition**: Browser-native Web Speech API with continuous recognition and VAD.
- **Text-to-Speech**: ElevenLabs API (primary), browser-native Speech Synthesis API (fallback). Configurable voice models.
- **Credit Management**: Monitors ElevenLabs character usage, automatic fallback to browser TTS.

### Memory System Architecture
- **Enhanced RAG**: Recency bias, thread awareness, query intent detection, diversity scoring, two-pass re-ranking, knowledge gap detection.
- **Performance Optimizations**: Embedding cache, batch queries, strategic indexing, lazy loading.
- **Memory Types**: FACT, PREFERENCE, LORE, CONTEXT.
- **Memory Importance Scoring**: AI-assigned 1-100 scale, decay over time, protected facts.
- **Memory Consolidation**: Automatic merging of duplicate/similar memories (>90% vector similarity) via AI analysis.
- **Entity Extraction and Linking**: AI extracts entities (Person, Place, Event, Organization, Concept) from content with source-aware disambiguation (e.g., "Character from Arc Raiders" vs "DBD Character"), linking them to memories.

### Podcast Processing Pipeline
- **RSS Feed Auto-Sync**: Fetches and parses RSS feeds, extracts episode metadata, matches transcripts by filename or title similarity.
- **Batch Processing**: Processes pending episodes by loading transcripts and invoking AI for fact extraction.
- **Fact Extraction**: Gemini analyzes transcripts for factual statements, categorizes them, assigns importance, generates keywords, and links to episode ID.
- **Entity Recognition**: AI identifies and links entities within podcast content.

### Document Processing Pipeline
- **Upload and Parsing**: PDF documents parsed via `pdf-parse`.
- **Intelligent Text Chunking**: Configurable chunk size (1000-1500 chars) with overlap and boundary detection.
- **Knowledge Extraction**: AI processes chunks for facts, creates memories, identifies entities, and attributes to document/chunk ID.

### Intelligence Engine
- **AI-Powered Memory Management**:
    - **Fact Cluster Merging**: Detects and merges related memories with AI analysis.
    - **Personality Drift Detection**: Monitors AI responses against a baseline of protected facts.
    - **Personality Rectification**: AI proposes and implements plans to adjust personality consistency.
    - **Context Relevance Analysis**: Evaluates and cleans up outdated or redundant memories.
- **Protected Facts System**: Immutable baseline knowledge curated via UI, used for drift prevention.

### Discord Integration
- **Bot Architecture**: `discord.js` for message handling, authentication, and status sync.
- **Conversational Features**: Responds to mentions/DMs, uses context-aware responses with personality.
- **Proactive Messaging**: Generates "intrusive thoughts" based on chaos level.
- **Member Fact Extraction**: Monitors user messages to extract and store facts about server members for personalization.

### UI Components
- **Dashboard**: Overview of activity, quick actions, status indicators.
- **Chat Panel**: Threaded conversation, voice controls, context indicators, streaming.
- **Control Panel**: Voice settings, chaos controls, profile management.
- **Personality Surge Panel**: Triggers and monitors chaos level spikes.
- **Discord Management Panel**: Bot status, channel settings, intrusive thought configuration.
- **Memory UI Suite**: Browser, Protected Facts Manager, Analytics Dashboard, Intelligence Dashboard, Debug Tools for comprehensive memory management and analysis.

### Communication Flow
- **Voice Interaction Lifecycle**: User speaks → Web Speech API → Text sent to backend → RAG retrieves context → AI generates response → TTS synthesizes speech → Memory stored → UI updated.
- **Memory Lifecycle**: Fact extracted → Deduplicated/Consolidated → Stored with embeddings → Entities linked → Indexed → Retrieved by RAG → Importance decays/protected.

## External Dependencies

### AI Services
- **Google Gemini API**: Primary AI provider.
- **Anthropic Claude API**: Fallback AI provider.
- **ElevenLabs API**: Premium text-to-speech.

### Database Services
- **Neon Database**: Serverless PostgreSQL.
- **PostgreSQL**: Core relational database.

### Development Tools
- **Vite**: Frontend build tool.
- **Replit Integration**: Development environment.
- **Drizzle Kit**: Database migration tool.
- **TypeScript**: Static type checking.

### Browser APIs
- **Web Speech API**: Speech recognition and synthesis.
- **Web Audio API**: Audio processing.
- **MediaDevices API**: Microphone access.
- **Fetch API**: HTTP requests.

### UI Libraries
- **Radix UI**: Accessible headless components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React / React Icons**: Icon libraries.
- **Framer Motion**: Animation library.
- **Recharts**: Charting library.

### Utility Libraries
- **Drizzle ORM**: Type-safe ORM.
- **TanStack React Query**: Server state management.
- **date-fns**: Date manipulation.
- **nanoid**: Unique ID generation.
- **pdf-parse**: PDF text extraction.
- **multer**: File upload handling.
- **rss-parser**: RSS/Atom feed parsing.
- **tiktoken**: LLM token counting.
- **zod**: Runtime type validation.
- **natural**: Natural language processing.