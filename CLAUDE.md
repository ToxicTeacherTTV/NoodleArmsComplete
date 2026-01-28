# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Two Separate Memory Systems

This repository has **two completely separate memory systems** that must never mix:

1. **Engineering Memory** (for AI coding agents like you)
   - Lives in `.github/instructions/`
   - Governs code structure, architecture, verified constraints
   - Never stored in database or visible to runtime models

2. **In-App Narrative Memory** (for Nicky, the AI character)
   - Lives in the database (`memory_entries`, lore, training examples)
   - Used by runtime AI via ContextBuilder and RAG
   - Governed by CANON/RUMOR lanes

**Never write engineering lessons to MemoryEntry tables, Lore systems, Training examples, or RAG sources.**

## Build & Development Commands

```bash
npm run dev              # Start development server (Vite + Express)
npm run build            # Production build (Vite + esbuild)
npm run start            # Run production build
npm run check            # TypeScript type checking
npm run db:push          # Push schema changes to PostgreSQL

# Testing
npm run test             # Run memory-scoring tests
npm run test:watch       # Watch mode tests
npm run test:all         # All test suites

# Database Maintenance
npm run db:backfill-integrity    # Backfill data integrity checks
npm run db:backfill-embeddings   # Generate missing vector embeddings
npm run audit:timelines          # Audit event timeline consistency
```

## Architecture Overview

**Nicky "Noodle Arms" A.I. Dente** is an AI-powered co-host for live streaming, podcasting, and Discord. It features real-time voice synthesis with ElevenLabs and a dual-lane memory system (CANON for verified facts, RUMOR for embellishments Nicky can lie about).

### Tech Stack
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Express + TypeScript
- **Database:** PostgreSQL (Neon) + Drizzle ORM + pgvector
- **AI:** Gemini 3 Flash (primary), Gemini 3 Pro (fallback)
- **Voice:** ElevenLabs v3 with dynamic emotion tags

### Brain/Mouth Pattern

The system separates context gathering from AI generation:

- **The Brain (`contextBuilder.ts`):** Centralized RAG engine that gathers all context in parallel (memories, documents, lore, training examples, entities)
- **The Mouth (`aiOrchestrator.ts` + `gemini.ts`):** Model routing and AI generation layer

This allows model-agnostic design and reusable context.

### Key Directories

```
client/src/components/    # UI panels (jazz-dashboard.tsx is main container)
server/services/          # Business logic (60+ services)
server/storage.ts         # Centralized database access layer
shared/schema.ts          # Drizzle ORM schemas (source of truth)
.github/instructions/     # Engineering memory (for AI coding agents)
```

### Important Services

| Service | Purpose |
|---------|---------|
| `aiOrchestrator.ts` | Model routing and Brain/Mouth coordination |
| `contextBuilder.ts` | Parallel context gathering (The Brain) |
| `gemini.ts` | Gemini API calls (The Mouth) |
| `modelSelector.ts` | Intelligent model selection |
| `memoryAnalyzer.ts` | Memory quality scoring |
| `emotionEnhancer.ts` | Add emotion tags for voice synthesis |
| `VarietyController.ts` | Prevent phrase repetition |
| `personalityController.ts` | Personality mode management |

## Code Conventions

### Service Pattern
Business logic lives in `server/services/`. Example structure:
```typescript
import { storage } from '../storage.js';
import { executeWithDefaultModel } from './modelSelector.js';

export class NewService {
  async performTask(data: any) {
    // Use storage for DB access
    // Use modelSelector for AI tasks
  }
}
```

### ESM Imports
Always include `.js` extensions in imports:
```typescript
import { storage } from '../storage.js';  // ✓ Correct
import { storage } from '../storage';      // ✗ Wrong
```

### Database Vector Parameters
The `pg` driver serializes JS arrays as Postgres arrays (`{...}`), which are incompatible with `pgvector` (`[...]`).

**Rule:** Use `JSON.stringify(vector)` + parameter binding with `$n::vector` cast:
```typescript
// ✓ Correct
const result = await db.execute(sql`
  SELECT * FROM memories
  WHERE embedding <=> ${JSON.stringify(vector)}::vector < 0.5
`);

// ✗ Wrong - will cause "invalid input syntax for type vector"
const result = await db.execute(sql`
  SELECT * FROM memories
  WHERE embedding <=> ${vector}::vector < 0.5
`);
```

### AI Responses
Use `emotionEnhancer.ts` for voice tagging - never add stage directions (*leans in*, [sighs]) directly in AI output. Emotion tags like `[yelling]`, `[muttering]` are added by the emotion enhancer for ElevenLabs.

## Memory System

### CANON vs RUMOR Lanes
- **CANON:** Verified, truthful facts Nicky must respect
- **RUMOR:** Gossip and embellishments Nicky is encouraged to lie about

### Memory Retrieval
Uses hybrid search: keyword matching + vector similarity (pgvector with 768-dimension embeddings from Gemini text-embedding-004).

### Deduplication
Canonical keys prevent exact duplicates; merge detection identifies near-duplicates at 85% similarity threshold.

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `GEMINI_API_KEY` - Primary AI provider

Optional:
- `ANTHROPIC_API_KEY` - Claude fallback
- `ELEVENLABS_API_KEY` - Voice synthesis
- `SERPAPI_API_KEY` - Web search
- `DISCORD_BOT_TOKEN` - Discord bot

## Testing

Tests use Vitest and are located in `server/tests/`:
```bash
npm run test                                    # Run main test suite
npm run test:all                                # Run all tests
cd server && vitest run tests/specific.test.ts  # Run specific test
```

## Additional Documentation

- `MASTER_ARCHITECTURE.md` - Complete system overview
- `DEVELOPMENT_GUIDE.md` - Setup and workflow details
- `.github/copilot-instructions.md` - AI assistant rules (read this)
- `.github/instructions/memory-keeper.instructions.md` - Engineering memory doctrine
- `.github/instructions/database-vectors.md` - Vector parameter rules
