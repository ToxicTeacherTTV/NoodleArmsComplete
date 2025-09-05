# AI-Powered Co-Host Application

## Overview

This is a sophisticated AI-powered co-host application designed for live streamers. The system functions as an interactive voice agent that can listen to user speech, process it through AI services, and respond with contextually-aware audio responses. The application features real-time voice interaction, persistent memory management, document processing capabilities, and customizable AI personality profiles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 19 with TypeScript using functional components and hooks
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **State Management**: Local React state management using hooks (useState, useEffect, useCallback, useRef)
- **Routing**: Wouter for lightweight client-side routing
- **Data Fetching**: TanStack React Query for server state management and caching

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ESM module system
- **API Design**: RESTful API endpoints for profiles, conversations, messages, documents, and memory management
- **File Upload**: Multer middleware for handling document uploads
- **Build System**: Vite for frontend bundling and development, esbuild for server bundling

### Data Storage Solutions
- **Database**: PostgreSQL with Neon serverless connection
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: Structured tables for profiles, conversations, messages, documents, and memory entries
- **Session Storage**: PostgreSQL-based session storage using connect-pg-simple
- **File Storage**: In-memory storage for document processing with extracted content storage

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL storage
- **API Key Management**: Environment-based API key configuration for external services
- **Request Middleware**: Custom logging and error handling middleware

### Voice Processing Architecture
- **Speech-to-Text**: Browser-native Web Speech API with automatic restart functionality
- **Text-to-Speech**: Browser-native Speech Synthesis API with queuing system
- **Voice Activity Detection**: Real-time audio monitoring using Web Audio API
- **Audio Visualization**: Custom voice activity visualization components

### AI Integration Architecture
- **Primary AI Service**: Anthropic's Claude API (claude-sonnet-4-20250514 model)
- **Alternative TTS**: ElevenLabs integration for enhanced voice synthesis
- **Memory System**: Retrieval-Augmented Generation (RAG) with keyword-based knowledge retrieval
- **Personality Profiles**: Customizable AI personalities with core identity and knowledge base configuration

### Document Processing System
- **PDF Processing**: pdf-parse library for text extraction
- **Text Chunking**: Intelligent content segmentation for knowledge base integration
- **Processing Pipeline**: Async document processing with status tracking
- **Knowledge Extraction**: Automatic memory entry creation from processed documents

### Memory Management System
- **Memory Types**: Categorized storage (FACT, PREFERENCE, LORE, CONTEXT)
- **Importance Scoring**: Weighted memory entries with retrieval tracking
- **Memory Consolidation**: AI-powered knowledge base optimization
- **Search Functionality**: Keyword-based memory retrieval for context augmentation

### Communication Flow
1. **Voice Input**: Browser speech recognition captures user audio
2. **Message Queuing**: Sequential processing to prevent overlapping responses
3. **Context Retrieval**: RAG system finds relevant memories and documents
4. **AI Processing**: Augmented prompts sent to Claude API with context
5. **Response Generation**: AI-generated responses with processing time tracking
6. **Voice Output**: Browser speech synthesis with queue management
7. **Memory Storage**: Automatic extraction and storage of new information

### Component Architecture
- **Dashboard**: Main application container managing state and data flow
- **Chat Panel**: Message display with real-time updates and formatting
- **Control Panel**: Voice controls and text input interface
- **Profile Management**: AI personality configuration and switching
- **Memory Panel**: Memory entry management and knowledge base optimization
- **Document Panel**: File upload and processing interface
- **Voice Visualizer**: Real-time audio activity display

## External Dependencies

### AI Services
- **Anthropic Claude API**: Primary conversational AI service for response generation and memory consolidation
- **ElevenLabs API**: Optional enhanced text-to-speech service for improved voice quality

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with automatic scaling
- **PostgreSQL**: Primary data storage for all application data

### Development Tools
- **Vite**: Frontend development server and build tool
- **Replit Integration**: Development environment integration with error overlay and cartographer plugins

### Browser APIs
- **Web Speech API**: Speech recognition and synthesis for voice interaction
- **Web Audio API**: Real-time audio processing and visualization
- **MediaDevices API**: Microphone access for voice activity detection

### UI Libraries
- **Radix UI**: Headless UI primitives for accessible components
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for consistent iconography

### Utility Libraries
- **Drizzle ORM**: Type-safe database operations and migrations
- **TanStack React Query**: Server state management and caching
- **date-fns**: Date manipulation and formatting
- **nanoid**: Unique ID generation for entities
- **pdf-parse**: PDF text extraction for document processing
- **multer**: File upload handling middleware