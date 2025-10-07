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
- **Memory System**: Retrieval-Augmented Generation (RAG), keyword-based retrieval
- **Unified Personality System**: Preset-based PersonalityControl with 11 profiles
- **Personality Profiles**: Customizable AI identities and knowledge bases

### Document Processing
- **PDF Processing**: pdf-parse for text extraction
- **Text Chunking**: Intelligent segmentation
- **Knowledge Extraction**: Automatic memory entry creation

### Memory Management
- **Memory Types**: FACT, PREFERENCE, LORE, CONTEXT
- **Importance Scoring**: Weighted entries
- **Memory Consolidation**: AI-powered optimization
- **Search**: Keyword-based retrieval

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