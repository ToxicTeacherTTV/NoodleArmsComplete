# AI-Powered Co-Host Application

## Overview
This AI-powered co-host application is an interactive voice agent designed to enhance live streaming interactions and podcast content creation. It processes user speech, utilizes AI for contextually-aware audio responses, and features real-time interaction, persistent memory, document processing, and customizable AI personalities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 19 with TypeScript, functional components, and hooks. Styling is managed with Tailwind CSS, custom CSS variables, Radix UI, and shadcn/ui.

### Technical Implementations
- **Frontend**: React 19 (TypeScript), Wouter for routing, TanStack React Query for data fetching.
- **Backend**: Node.js with Express.js (TypeScript, ESM) providing a RESTful API.
- **Data Storage**: PostgreSQL (Neon serverless) with Drizzle ORM for profiles, conversations, messages, documents, and memory.
- **Authentication**: Express sessions with PostgreSQL storage and environment-based API keys.
- **Voice Processing**: Browser-native Web Speech API for speech-to-text, browser-native Speech Synthesis API and ElevenLabs for text-to-speech, and Web Audio API for voice activity detection. It includes smart voice credit management with PODCAST and STREAMING modes.
- **AI Integration**: The system primarily uses Google Gemini 2.5 Pro for all AI operations, with Claude Sonnet 4.5 as a fallback for user-facing features. Gemini Flash models are banned due to hallucination issues.
    - **User-Facing Features**: Main chat responses, memory consolidation, intelligence analysis, ad generation, style consolidation, Discord bot responses, emotion tags, and story reconstruction utilize Gemini 2.5 Pro with Claude Sonnet 4.5 as a paid failsafe.
    - **Bulk/Volume Tasks**: Content flagging, document processing, podcast fact extraction, Discord member facts, entity extraction, contradiction detection, and intrusive thoughts are handled exclusively by Gemini 2.5 Pro for cost optimization.
    - **Enforcement**: Runtime checks and validation points prevent the use of banned models.
- **Memory System**: Features enhanced RAG with intelligent retrieval, including recency bias, thread awareness, query intent detection, diversity scoring, two-pass re-ranking, knowledge gap detection, and performance optimizations (caching, batch queries, indexing). It supports a unified personality system with customizable profiles.
- **Document Processing**: Handles PDF parsing, intelligent text chunking, and automatic knowledge extraction via Gemini. It includes a training examples system for meta-learning strategy patterns and conversation styles from samples.
- **Podcast Processing**: Automatically extracts both facts AND entities (people, places, events) from podcast episode transcripts. The system processes transcripts with Gemini to identify structured facts, then performs entity extraction to recognize and link people, places, and events mentioned in the episode. Entities are automatically created or updated with new context, and linked to relevant memory entries.
- **Memory Management**: Supports FACT, PREFERENCE, LORE, CONTEXT memory types with importance scoring. AI-powered consolidation (Gemini primary, Claude fallback), keyword-based search, and atomic UPSERT-based deduplication with comprehensive metadata merging are implemented. Entity linking creates many-to-many relationships between memories and entities, with automatic AI extraction and smart updates to prevent duplicates.
- **Metrics & Observability**: Prometheus metrics track LLM calls, tokens, estimated costs, errors, latency (for both Claude and Gemini), Discord interactions, and HTTP requests. Cost estimation is built-in.
- **Communication Flow**: Voice input -> Message Queuing -> Context Retrieval (RAG) -> AI Processing -> Response Generation -> Voice Output -> Memory Storage.
- **Core Components**: Includes Dashboard, Chat Panel, Control Panel, PersonalitySurgePanel, Discord Management Panel, Profile, Memory, Document Panels, Voice Visualizer, and a Memory UI Suite with enhanced panels, debug tools, analytics dashboard, and a protected facts manager. Ad generation is simplified for comedy.

## External Dependencies

### AI Services
- **Google Gemini API**: Primary AI provider.
- **Anthropic Claude API**: Fallback AI provider.
- **ElevenLabs API**: Enhanced text-to-speech service.

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting.
- **PostgreSQL**: Relational database.

### Development Tools
- **Vite**: Frontend build tool.
- **Replit Integration**: Development environment.

### Browser APIs
- **Web Speech API**: Speech recognition and synthesis.
- **Web Audio API**: Audio processing.
- **MediaDevices API**: Microphone access.

### UI Libraries
- **Radix UI**: Headless UI components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

### Utility Libraries
- **Drizzle ORM**: Type-safe ORM.
- **TanStack React Query**: Server state management.
- **date-fns**: Date utility library.
- **nanoid**: Unique ID generator.
- **pdf-parse**: PDF text extraction.
- **multer**: File upload handling.