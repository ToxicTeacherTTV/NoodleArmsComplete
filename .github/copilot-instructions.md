# Nicky AI - Copilot Instructions

## 🏗️ Architecture & Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS. Main dashboard: [client/src/components/jazz-dashboard.tsx](client/src/components/jazz-dashboard.tsx).
- **Backend**: Express + TypeScript. Entry point: [server/index.ts](server/index.ts).
- **Database**: PostgreSQL (Neon) + Drizzle ORM. Schema: [shared/schema.ts](shared/schema.ts).
- **AI Strategy**: Gemini 3 Flash (Primary) with Gemini 3 Pro fallback. Managed via [server/services/modelSelector.ts](server/services/modelSelector.ts).
- **Voice**: ElevenLabs v3 with dynamic emotion tags (e.g., `[yelling]`, `[sighs]`).

## 🛠️ Critical Workflows
- **Development**: `npm run dev` starts both frontend and backend.
- **Database**: Use `npm run db:push` to sync schema changes to the database.
- **Environment**: All API keys (Gemini, ElevenLabs, etc.) must be in `.env`.

## 📜 Project Conventions
- **Service Pattern**: Place business logic in [server/services/](server/services/).
- **Data Access**: Use the `storage` object in [server/storage.ts](server/storage.ts) for all database operations.
- **ESM Imports**: Always use `.js` extensions in imports (e.g., `import { x } from './y.js'`) to satisfy ESM requirements.
- **AI Responses**: Nicky's persona is an unhinged, Italian-American Dead by Daylight streamer. Use [server/services/emotionEnhancer.ts](server/services/emotionEnhancer.ts) for voice tagging.

## 🧠 Memory & Personality
- **Hybrid Search**: Memory retrieval uses both keywords and vector embeddings (pgvector).
- **Personality Modes**: Nicky has 'Grumpy', 'Roast', and 'Unhinged' modes.
- **Variety**: Use `VarietyController` to prevent repetitive catchphrases.

## ⚠️ Important Files
- [shared/schema.ts](shared/schema.ts): Source of truth for database tables.
- [server/storage.ts](server/storage.ts): Centralized Drizzle queries.
- [server/services/gemini.ts](server/services/gemini.ts): Primary AI integration.
- [client/src/components/jazz-dashboard.tsx](client/src/components/jazz-dashboard.tsx): Main UI container.

## 💡 Example: Adding a new Service
```typescript
// server/services/newService.ts
import { storage } from '../storage.js';
import { executeWithDefaultModel } from './modelSelector.js';

export class NewService {
  async performTask(data: any) {
    // Use storage for DB access
    // Use modelSelector for AI tasks
  }
}
```
