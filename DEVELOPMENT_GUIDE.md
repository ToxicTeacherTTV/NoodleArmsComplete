# Nicky AI - Development Guide

**Last Updated:** December 28, 2025

This guide covers development workflows, testing procedures, common tasks, and troubleshooting for the Nicky AI project.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (LTS recommended)
- PostgreSQL 14+ (or Neon serverless account)
- Git
- API Keys (see Environment Setup below)

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/ToxicTeacherTTV/NoodleArmsComplete.git
cd NoodleArmsComplete

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your API keys and database URL

# 4. Push database schema
npm run db:push

# 5. Start development server
npm run dev
```

### Environment Configuration

Create a `.env` file with the following variables:

```bash
# Database (Required)
DATABASE_URL="postgresql://user:password@host:5432/database"

# AI Providers (Primary Required, Fallback Optional)
GEMINI_API_KEY="your-gemini-api-key"          # Required
ANTHROPIC_API_KEY="your-claude-api-key"       # Optional (fallback)

# Voice Synthesis (Required for voice features)
ELEVENLABS_API_KEY="your-elevenlabs-api-key"

# Web Search (Optional)
SERPAPI_API_KEY="your-serpapi-api-key"

# Discord Bot (Optional)
DISCORD_BOT_TOKEN="your-discord-bot-token"

# Model Selection (Optional - Override defaults)
GEMINI_DEFAULT_MODEL="gemini-3-flash-preview" # Default production model
GEMINI_DEV_MODEL="gemini-3-flash-preview"     # Dev/testing model
NODE_ENV="development"                         # development | production

# Emergency Controls (Optional)
PANIC_MODE="0"                                 # 1 = Stop all paid API calls
```

---

## 📂 Project Structure

```
NoodleArmsComplete/
├── client/src/              # React frontend
│   ├── components/          # UI components (29 panels)
│   ├── lib/                 # Utilities, API client, constants
│   └── pages/               # Route components
├── server/                  # Express backend
│   ├── services/            # Business logic (50+ services)
│   │   ├── aiOrchestrator.ts # Model routing and coordination
│   │   ├── contextBuilder.ts # Centralized RAG and context assembly (The Brain)
│   │   ├── gemini.ts         # Gemini 3 API integration (The Mouth)
│   │   ├── anthropic.ts      # Claude API integration (The Mouth)
│   │   ├── personalityController.ts # Personality management
│   │   └── ...
│   ├── config/              # Configuration files
│   ├── routes.ts            # API endpoints
│   ├── storage.ts           # Database abstraction
│   └── index.ts             # Server entry point
├── shared/                  # Shared types and schemas
│   ├── schema.ts            # Drizzle ORM schemas (15 tables)
│   └── types.ts             # TypeScript type definitions
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
└── test/                    # Test files
```

---

## 🛠️ Development Workflow

### Running the Application

```bash
# Development mode (hot reload)
npm run dev              # Starts both frontend and backend

# Production build
npm run build            # Build for production
npm run start            # Run production build

# Type checking
npm run check            # TypeScript validation
```

### Database Operations

```bash
# Push schema changes to database
npm run db:push

# Generate Drizzle migrations (if needed)
npx drizzle-kit generate:pg

# Run custom scripts
npm run db:backfill-integrity    # Backfill data integrity checks
npm run audit:timelines          # Audit event timeline consistency
```

### API Testing

**Bruno Collection** (recommended):
- Collection located in project root: `bruno_results.json`
- Import into Bruno for interactive API testing

**Manual Testing with curl:**
```bash
# Test chat endpoint
curl -X POST http://localhost:5000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test-conv-id",
    "content": "Hello Nicky!",
    "mode": "CHAT"
  }'

# Generate embeddings for all memories
curl -X POST http://localhost:5000/api/memories/generate-embeddings

# Check Prometheus metrics
curl http://localhost:5000/metrics
```

---

## 🧪 Testing

### Current Testing Status
- ⚠️ **Limited automated testing** - Manual testing primary method
- ✅ Bruno API smoke tests available
- ❌ No unit or integration tests yet

### Recommended Testing Approach

**Manual Testing Checklist:**
1. **Chat Flow**
   - Send message → receive response
   - Check memory retrieval (logs)
   - Verify personality consistency
   - Test different modes (CHAT, STREAMING, PODCAST)

2. **Memory System**
   - Create memory → verify no duplicate
   - Search memories → check semantic matching
   - Upload document → verify extraction

3. **Voice Synthesis**
   - Generate voice → check ElevenLabs call
   - Test emotion tags → verify TTS instructions
   - Check auto-voice logic by mode

4. **Discord Bot** (if configured)
   - Send message → check response
   - Test proactive messaging (cooldown)
   - Verify behavior modulation per server

### Future Testing Goals
- Unit tests for memory deduplication logic
- Integration tests for API endpoints
- Contract tests (Zod schemas → OpenAPI validation)
- E2E tests for critical user flows

---

## 🔍 Debugging Tips

### Common Issues & Solutions

#### 1. **Memory Retrieval Not Finding Related Concepts**
```bash
# Check if embeddings are generated
SELECT COUNT(*) FROM memory_entries WHERE embedding IS NOT NULL;

# If embeddings missing, run backfill
curl -X POST http://localhost:5000/api/memories/generate-embeddings

# Check hybrid search logs
grep "hybridResults" logs/server.log
```

#### 2. **Rate Limit Errors (Gemini)**
```bash
# Check which model is being used
grep "Using model:" logs/server.log | tail -20

# Check for fallback to experimental
grep "gemini-2.0-flash-exp" logs/server.log | wc -l

# Solution: Upgrade to paid tier or reduce request frequency
```

#### 3. **Slow STREAMING Mode Responses**
```bash
# Check response times
grep "Response time:" logs/server.log

# Verify candidate multiplier
grep "candidateLimit" logs/server.log

# Should see 1.5x for STREAMING, 3x for others
```

#### 4. **Personality Feels "Off"**
```bash
# Check chaos level
psql $DATABASE_URL -c "SELECT level, mode FROM chaos_state WHERE is_global = true;"

# Verify training examples loaded
grep "Training examples:" logs/server.log

# Check personality preset active
grep "Personality preset:" logs/server.log
```

#### 5. **Duplicate Memories Created**
```bash
# Check for canonical key generation
SELECT canonical_key, COUNT(*) 
FROM memory_entries 
GROUP BY canonical_key 
HAVING COUNT(*) > 1;

# Verify unique constraint exists
\d memory_entries   # In psql, check constraints
```

### Useful Log Locations

```bash
# Server logs (if logging to file)
tail -f logs/server.log

# Drizzle ORM queries (if debug enabled)
DEBUG=drizzle:* npm run dev

# Gemini API calls
grep "🔢\|Gemini" logs/server.log

# Memory operations
grep "💾\|memory" logs/server.log
```

---

## 📊 Monitoring & Observability

### Prometheus Metrics

**Endpoint:** `http://localhost:5000/metrics`

**Key Metrics:**
- `llm_calls_total{provider, model}` - Count of AI API calls
- `llm_tokens_total{direction}` - Token usage (input/output)
- `memory_retrievals_total{query_type}` - Memory search stats
- `discord_messages_total{type}` - Discord bot activity
- `http_requests_duration_ms_bucket{route}` - Response times

**Example Queries:**
```bash
# Total Gemini calls
curl http://localhost:5000/metrics | grep 'llm_calls_total{provider="gemini"}'

# Token usage by direction
curl http://localhost:5000/metrics | grep 'llm_tokens_total'
```

### Database Monitoring

```sql
-- Check memory count by category
SELECT type, COUNT(*) as count 
FROM memory_entries 
WHERE profile_id = 'your-profile-id'
GROUP BY type;

-- Check embedding coverage
SELECT 
  COUNT(*) as total,
  COUNT(embedding) as embedded,
  ROUND(COUNT(embedding)::numeric / COUNT(*) * 100, 2) as coverage_pct
FROM memory_entries;

-- Check recent conversations
SELECT id, title, mode, message_count, created_at
FROM conversations
ORDER BY created_at DESC
LIMIT 10;

-- Check training examples
SELECT name, created_at
FROM documents
WHERE document_type = 'TRAINING_EXAMPLE'
  AND processing_status = 'COMPLETED'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 Common Development Tasks

### 1. Add a New Memory Type

```typescript
// 1. Update shared/schema.ts
export const memoryTypeEnum = pgEnum('memory_type', [
  'FACT', 'PREFERENCE', 'LORE', 'CONTEXT', 'STORY', 'ATOMIC',
  'YOUR_NEW_TYPE'  // Add here
]);

// 2. Push schema
npm run db:push

// 3. Update memory creation logic in storage.ts
// 4. Update UI dropdowns in client components
```

### 2. Add a New Personality Preset

```typescript
// Edit server/services/personalityController.ts

const NEW_PRESET: PersonalityPreset = {
  id: 'unique-preset-id',
  name: 'Preset Name',
  intensity: 0.7,
  wiseguyLevel: 0.6,
  emotionalArc: [
    { stage: 'opening', emotion: 'curious' },
    { stage: 'peak', emotion: 'excited' },
    { stage: 'close', emotion: 'satisfied' }
  ],
  contextualPrompts: {
    greeting: 'Custom greeting...',
    response: 'Custom response style...'
  }
};

// Add to PERSONALITY_PRESETS array
```

### 3. Add a New Service/Feature

```typescript
// 1. Create service file: server/services/yourService.ts
export class YourService {
  async yourMethod() {
    // Implementation
  }
}

export const yourService = new YourService();

// 2. Import in routes.ts or other services
import { yourService } from './services/yourService';

// 3. Add API endpoint if needed (in routes.ts)
app.post('/api/your-endpoint', async (req, res) => {
  const result = await yourService.yourMethod();
  res.json(result);
});

// 4. Add frontend API call (in client/src/lib/api.ts)
export async function callYourEndpoint(data: any) {
  return await fetchApi('/api/your-endpoint', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

### 4. Run Embedding Backfill (If Needed)
*Note: The production database was fully backfilled on Dec 8, 2025. This is only needed for fresh database setups.*

```bash
# Option 1: Via API (recommended)
curl -X POST http://localhost:5000/api/memories/generate-embeddings

# Option 2: Create a script (scripts/backfill-embeddings.ts)
# Then run with ts-node:
npx ts-node scripts/backfill-embeddings.ts

# Monitor progress in logs
tail -f logs/server.log | grep "embedding"
```

### 5. Adjust Chaos Level

```sql
-- View current chaos state
SELECT * FROM chaos_state WHERE is_global = true;

-- Set chaos level (0-100)
UPDATE chaos_state 
SET level = 30  -- Set to 30%
WHERE is_global = true;

-- Disable chaos completely
UPDATE chaos_state 
SET level = 0
WHERE is_global = true;
```

### 6. Export/Import Training Examples

```bash
# Export training examples
psql $DATABASE_URL -c "
  COPY (
    SELECT name, extracted_content, created_at 
    FROM documents 
    WHERE document_type = 'TRAINING_EXAMPLE'
      AND processing_status = 'COMPLETED'
  ) TO STDOUT CSV HEADER
" > training_export.csv

# Import (create documents via API)
# Use bulk upload endpoint or script
```

---

## 🐛 Troubleshooting Guide

### Application Won't Start

**Check 1: Database Connection**
```bash
psql $DATABASE_URL -c "SELECT 1;"
# Should return: 1
```

**Check 2: Environment Variables**
```bash
# Verify .env file exists and has required keys
cat .env | grep -E "DATABASE_URL|GEMINI_API_KEY"
```

**Check 3: Dependencies**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### High Response Times

**Check 1: Memory Retrieval**
```typescript
// Add timing logs in anthropic.ts
console.time('Memory Retrieval');
const memories = await getContextualMemories(...);
console.timeEnd('Memory Retrieval');
```

**Check 2: Model Selection**
```bash
# Verify using Flash for most operations
grep "Using model: gemini" logs/server.log | head -20
```

**Check 3: Caching**
```bash
# Check cache hit rate
grep "Cache hit" logs/server.log | wc -l
grep "Cache miss" logs/server.log | wc -l
```

### Memory Quality Issues

**Check 1: Embedding Coverage**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(embedding) as with_embedding
FROM memory_entries;
```

**Check 2: Canonical Keys**
```sql
-- Find potential duplicates
SELECT content, COUNT(*) 
FROM memory_entries 
GROUP BY content 
HAVING COUNT(*) > 1;
```

**Check 3: Importance Scoring**
```sql
-- Review importance distribution
SELECT 
  CASE 
    WHEN importance >= 900 THEN '900+ (Protected)'
    WHEN importance >= 700 THEN '700-899 (Very High)'
    WHEN importance >= 500 THEN '500-699 (High)'
    WHEN importance >= 300 THEN '300-499 (Medium)'
    ELSE '0-299 (Low)'
  END as tier,
  COUNT(*) as count
FROM memory_entries
GROUP BY tier
ORDER BY tier DESC;
```

---

## 📚 Additional Resources

### Documentation Files
- `README.md` - Project overview and setup
- `PROJECT_ROADMAP.md` - Feature roadmap and implementation status
- `NOTES.md` - Development notes and architectural decisions
- `CHANGELOG.md` - Version history and changes
- `GEMINI_COST_OPTIMIZATION.md` - Cost optimization strategies
- `STREAMING_OPTIMIZATION_PLAN.md` - Performance optimization details

### External Resources
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [Gemini API Docs](https://ai.google.dev/docs)
- [ElevenLabs API Docs](https://elevenlabs.io/docs)
- [Discord.js Guide](https://discordjs.guide/)

### Getting Help
1. **Check logs** first for error messages
2. **Review documentation** for known issues
3. **Search codebase** for similar implementations
4. **Test in isolation** to narrow down the problem
5. **Document the issue** with reproduction steps

---

## 🔐 Security Notes

### API Key Management
- **Never commit** `.env` file to git
- **Rotate keys** if accidentally exposed
- **Use environment variables** for all secrets
- **Limit key permissions** to minimum required

### Database Security
- **Use strong passwords** for database
- **Enable SSL** for production connections
- **Backup regularly** to prevent data loss
- **Monitor access logs** for suspicious activity

### Rate Limiting
- **Monitor API usage** to prevent bill shock
- **Set spending alerts** in Google Cloud Console
- **Implement PANIC_MODE** for emergency budget freeze
- **Use free tiers** wisely (10 RPM Flash, 2 RPM Pro)

---

**Last Updated:** November 10, 2025  
**Maintainer:** Development Team  
**Questions?** Check `NOTES.md` or `PROJECT_ROADMAP.md`
