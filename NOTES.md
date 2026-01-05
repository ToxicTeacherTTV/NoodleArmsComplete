## Development Notes

**Last Updated:** January 3, 2026

### Recent Major Changes (Dec 2025 - Jan 2026)

#### Gemini 3 Migration & Single-Pass Generation (Jan 2026)
- **Goal:** Leverage Gemini 3's massive context and reasoning for high-quality podcasting.
- **Implementation:** Migrated all services to Gemini 3 Flash/Pro. Implemented "Single-Pass Generation" for Podcast Mode, generating the entire script in one call.
- **Result:** ~95% cost reduction and significantly improved narrative coherence.

#### Vibe-Based Storytelling & Narrative Archetypes (Jan 2026)
- **Problem:** City stories were too rigid and predictable.
- **Solution:** Replaced the state machine with "Narrative Archetypes" (The Grudge, The Fugitive, etc.).
- **Persistence:** Multi-turn story state is now tracked in the `conversations` table metadata.
- **Natural Detection:** Enhanced regex and DB lookups allow Nicky to detect cities naturally in chat.

#### Personality Hardening: "Show, Don't Tell" (Jan 2026)
- **Problem:** Nicky was narrating his own actions (*leans in*, *sighs*).
- **Solution:** Strict system prompt enforcement forbidding physical narration.
- **Mechanism:** Use of [emotion] tags for voice synthesis while keeping dialogue purely character-driven.

#### Dashboard Hook Ordering Fix (Jan 2026)
- **Issue:** `ReferenceError: Cannot access 'activeProfile' before initialization`.
- **Fix:** Reordered hooks in `jazz-dashboard-v2.tsx` to ensure `useQuery` results are available before being accessed by dependent logic.

#### Memory Deduplication Fix (Oct 13, 2025)
- **Problem:** 39+ duplicate memories created despite canonical key system
- **Root Cause:** Keys generated but never checked in database
- **Solution:** Atomic UPSERT with unique constraint on `(profileId, canonicalKey)`
- **Metadata Merging:** Comprehensive field preservation (confidence, keywords, relationships)
- **Cleanup:** 1544 → 1505 unique memories (39 duplicates removed)

#### Personality System Improvements (Nov 2, 2025)
- **Problem:** User feedback - "one track mind", forced references
- **Changes:** Added response variety guidelines, disabled chaos engine (0%)
- **Focus:** Balance character flavor with actually answering questions
- **Status:** Needs user testing and feedback for further tuning

#### Arc Raiders Personality & Sticky Context (Dec 7, 2025)
- **Problem:** User had to mention "Arc Raiders" in every message or Nicky would revert to generic/DbD chat.
- **Solution:** Implemented a 6-message lookback window. If "Arc Raiders" was mentioned recently, the "Squad" context (Vinny, Paulie, Anthony) remains active.
- **Creative Freedom:** Explicitly instructed the model to invent scenarios/glitches/family members to keep the humor high.

#### Vector Crash Fix (Dec 7, 2025)
- **Issue:** `SyntaxError: Unexpected non-whitespace character after JSON` in `embeddingService.ts`.
- **Cause:** `pgvector` driver returns native Arrays, but code was blindly calling `JSON.parse()`.
- **Fix:** Implemented a robust parser that handles Arrays, JSON strings, and raw Postgres strings across all vector services.

#### STREAMING Mode Optimizations (Oct-Nov 2025)
- **Target:** Reduce response time from 9-18s to 4-8s
- **Implemented:**
  - Reduced candidate multiplier (1.5x vs 3x for standard mode)
  - Parallel context loading (3-5s savings)
  - Smart context pruning (1-2s token savings)
  - Response caching for repeated queries
- **Result:** 50-60% faster STREAMING responses

### Architectural Decisions

#### Why Gemini Over Claude for Most Operations?
**Decision:** Use Gemini 2.5 Flash for 85-90% of requests, Claude as failsafe
**Reasoning:**
- Cost: Gemini Flash is 17x cheaper than Pro, free tier available
- Quality: Flash adequate for extraction, bulk processing, most conversations
- Fallback: Claude Sonnet 4.5 provides paid failsafe for critical failures
- Risk: Free tier rate limits require careful monitoring

**Trade-offs:**
- ✅ Massive cost savings ($350-550/month saved)
- ✅ Fast response times (Flash is faster than Claude)
- ❌ Rate limit challenges during peak usage
- ❌ Quality degradation when falling back to experimental models

#### Why Hybrid Search (Keyword + Semantic)?
**Decision:** Combine keyword matching with vector similarity
**Reasoning:**
- Keyword search: Fast, precise for exact matches
- Semantic search: Finds related concepts, handles synonyms
- Hybrid: Best of both worlds with configurable weights
- Recency bias: Still factors in temporal relevance

**Implementation:**
- 40% keyword weight, 60% semantic weight (configurable)
- Importance scoring boosts high-value memories
- STREAMING mode uses reduced candidates (performance)

#### Why Background Embedding Generation?
**Decision:** Generate embeddings asynchronously after memory creation
**Reasoning:**
- Don't block memory writes (user-facing operation)
- Batch processing respects rate limits
- Gradual population as system is used
- Fallback to keyword-only until embedding ready

**Trade-off:**
- ✅ No user-facing latency
- ❌ Brief period where new memory uses keyword-only search
- ✅ Backfill completed (Dec 8, 2025)

### Lessons Learned

#### Flash Model Ban (Historical Context)
- **Incident:** Gemini 2.5 Flash hallucinated 269 false memories (Oct 2025)
- **Response:** Banned Flash, forced Pro-only for all operations
- **Investigation:** Hallucinations occurred during bulk document processing
- **Resolution:** Controlled Flash reintroduction with production-only for critical ops
- **Current:** Flash safe for most operations, Pro enforced for entity extraction

#### Free Tier Limitations
- **10 RPM limit:** Easily exceeded with 2+ concurrent users
- **Fallback cascade:** Flash → Pro → Flash-Exp → Claude
- **Experimental models:** Lower quality when free tier exhausted
- **Recommendation:** Paid tier ($250 = Tier 2) for production use
- **Monitoring:** Track fallback frequency, quality metrics

#### Personality Consistency Challenges
- **Observation:** Chaos engine added unpredictability
- **User feedback:** "One track mind", forced references
- **Hypothesis:** Too many instructions dilute core personality
- **Experiments:** Disabled chaos (0%), simplified prompts
- **Ongoing:** Need A/B testing and user feedback loops

#### Memory Retrieval Quality
- **Keyword-only:** Fast but misses semantic relationships
- **Semantic-only:** Finds related concepts but may miss precision
- **Hybrid:** Balanced approach with configurable trade-offs
- **Challenge:** Tuning weights for different query types
- **Next:** Debug panel to show retrieval decisions

### Technical Debt & Future Work

#### Testing Infrastructure
- **Current:** Minimal automated testing
- **Need:** Unit tests for memory deduplication, retrieval ranking
- **Need:** Contract tests for API endpoints (Zod → OpenAPI)
- **Need:** E2E tests for critical flows (conversation → memory → retrieval)

#### Observability
- ✅ Prometheus metrics endpoint (`/metrics`)
- ⚠️ Need cost tracking dashboard
- ⚠️ Need quality monitoring (Flash vs Pro output comparison)
- ⚠️ Need usage alerts (approaching budget limits)

#### Performance Optimizations
- **Implemented:** Response caching, parallel loading, context pruning
- **Potential:** Request queue for rate limit management
- **Potential:** Memory cache (RAM) for frequently accessed memories
- **Potential:** CDN for static assets

#### Scalability Concerns
- **Database:** Single PostgreSQL instance, no replication
- **Rate Limits:** Free tier insufficient for multiple users
- **Cost:** Paid tier required for production scale
- **Architecture:** Consider queue-based processing for background tasks

### Development Workflow Notes

#### Environment Setup
- **Dev:** Uses `gemini-2.0-flash-exp` (free experimental)
- **Prod:** Uses `gemini-2.5-flash` with Pro fallback
- **Override:** `GEMINI_DEFAULT_MODEL` env var for testing

#### Database Migrations
- **Tool:** Drizzle ORM with `npm run db:push`
- **Caution:** No migration history tracking
- **Recommendation:** Add proper migration system (drizzle-kit migrate)

#### API Testing
- **Tool:** Bruno (bruno_results.json in repo)
- **Coverage:** Basic smoke tests, needs expansion
- **Manual:** Postman/curl for quick endpoint testing

#### Debugging Tips
- **Memory retrieval:** Check `hybridResults` in `anthropic.ts`
- **Model selection:** Look for "Using model:" logs
- **Rate limits:** Check for "rate limit" or "quota" in errors
- **Embeddings:** Verify `embeddingUpdatedAt` is populated

### Configuration Management

#### Key Environment Variables
```bash
# AI Providers
GEMINI_API_KEY           # Primary (required)
ANTHROPIC_API_KEY        # Fallback (optional on free tier)

# Model Selection
GEMINI_DEFAULT_MODEL     # Override default (gemini-2.5-flash)
GEMINI_DEV_MODEL         # Dev environment model
NODE_ENV                 # production | development

# Database
DATABASE_URL             # PostgreSQL connection string

# Voice & Integrations
ELEVENLABS_API_KEY       # Voice synthesis
DISCORD_BOT_TOKEN        # Discord integration
SERPAPI_API_KEY          # Web search
```

#### Model Selection Strategy
- **Chat:** Flash (fast, cheap, good enough)
- **Extraction:** Flash with Pro fallback (production-safe)
- **Analysis:** Pro (premium quality needed)
- **Generation:** Flash (creative content)
- **Development:** Experimental (free tier testing)

### Known Gotchas

1. **Embedding Backfill:** Completed. New memories are embedded automatically.
2. **Canonical Keys:** Case-sensitive, whitespace-normalized
3. **Memory Importance:** 999 = protected, never auto-delete
4. **Chaos Engine:** Disabled by default (set to 0%)
5. **Training Limit:** Only 50 most recent examples used (was 10)
6. **STREAMING Mode:** Uses reduced context for speed
7. **Discord Cooldown:** 45 min minimum between proactive messages

---
This is a sophisticated AI-powered co-host application featuring Nicky "Noodle Arms" A.I. Dente - an unreliable narrator Italian-American character who serves as a live streaming companion. The system functions as an interactive voice agent that can listen to user speech, process it through AI services, and respond with contextually-aware audio responses using advanced voice synthesis.

### Core Functionality
**Real-Time Voice Interaction:**
- Browser-based speech recognition captures user voice input
- ElevenLabs API provides high-quality voice synthesis for Nicky's responses
- Web Audio API handles real-time voice activity detection and visualization
- Automatic speech restart and queue management for seamless conversation flow

**AI-Powered Personality System:**
- **Gemini AI (Primary):** Gemini 2.5 Flash handles majority of conversational intelligence (free tier)
- **Intelligent Fallback:** Gemini 2.5 Pro → Claude Sonnet 4.5 (paid failsafe only)
- **Model Selection:** Purpose-based routing optimizes cost vs quality (chat/extraction/analysis)
- Customizable personality profiles with core identity and knowledge base configuration
- Character-consistent response generation with emotion tag support
- Sophisticated memory management with retrieval-augmented generation (RAG)
- **Cost Impact:** 85-90% reduction vs Claude-only architecture

**Advanced Memory Architecture:**
- PostgreSQL database stores conversations, messages, documents, and memory entries (4,136+ unique)
- Memory categorization system (FACT, PREFERENCE, LORE, CONTEXT, STORY, ATOMIC types)
- Keyword-based knowledge retrieval for contextual conversation enhancement
- **Vector embedding support active** - all memories populated for semantic search
- Atomic UPSERT prevents duplicates with canonical key system
- Revolutionary lie taxonomy system that categorizes Nicky's contradictions as features, not bugs

### How It Works Technically
**Frontend (React + TypeScript):**
- Dashboard manages real-time voice interaction and conversation display
- Profile management system for switching between AI personalities
- Memory panel for viewing and managing knowledge base entries
- Document processing interface for uploading and integrating reference materials
- Notes system with modal editor and keyboard shortcuts (Ctrl+N)

**Backend (Node.js + Express):**
- RESTful API endpoints for profiles, conversations, messages, documents, and memory
- Drizzle ORM with PostgreSQL for type-safe database operations
- ElevenLabs integration with v3 API settings (stability: 0.3, similarity: 0.75)
- Document processing pipeline using pdf-parse for knowledge extraction
- Session management with PostgreSQL-backed storage

**Character Intelligence System:**
- Lie Taxonomy: Character Lies (keep), Breaking Lies (fix), Evolution Lies (selective)
- Lie Confidence scoring (0-100%): How much Nicky believes his own bullshit
- Protected facts system: "Nicky is unreliable narrator" makes inconsistency canonical
- Manual curation workflow for managing memory contradictions and character development

**Voice Processing Architecture:**
- Two modes: PODCAST (ElevenLabs) vs STREAMING (browser speech synthesis)
- Voice activity visualization with real-time audio monitoring
- Automatic queue management prevents overlapping responses
- Custom voice restart functionality for handling speech recognition errors

### Key Design Philosophy
The app treats Nicky's lies and contradictions as character features rather than bugs. Instead of fixing inconsistencies, the system categorizes them using a sophisticated lie taxonomy, making unreliability part of his consistent characterization. This creates a more authentic and entertaining AI personality that feels genuinely unpredictable while maintaining narrative coherence.

## Project Notes
<!-- Add your development notes below -->

## Ideas & TODOs
<!-- 
Multi-line comment example:
- This won't show up in rendered view
- Great for temporary thoughts
- Can include code snippets safely
-->

## Seed Ideas for Lore
<!-- 
Place potential lore seeds here:
- Cousin Tony got busted selling fake parmesan again
- The Marinelli family opened a competing streaming setup
- Aunt Francesca's restaurant failed another health inspection
-->

## Technical Notes
<!-- 
Code examples and snippets can go here safely:
```javascript
// This code won't execute because it's in a comment block
console.log("This is just documentation");
```
-->

## Maintenance & Tuning

### 🎛️ Chaos Engine Control

**Current Status:** DISABLED (0%) by default.

**To Re-Enable Chaos (30-50% recommended):**
```sql
UPDATE chaos_state SET level = 40 WHERE is_global = true;
```

**Levels:**
- **0-20%**: Minimal chaos, consistent.
- **30-50%**: Moderate variation.
- **60-80%**: High chaos.
- **80-100%**: FULL_PSYCHO mode.

### 🧠 Memory Retrieval Limits

**Location:** `server/services/anthropic.ts` (retrieveContextualMemories)

**To reduce context bloat:**
1. Find `limit: number = 15` in `retrieveContextualMemories`.
2. Change to:
   - `10` (standard)
   - `5` (focused/minimal)
3. Restart server.

## Voice & Character Development
<!-- Add character notes and voice development ideas -->

## Bug Tracking
<!-- Track issues and fixes -->

---
<!-- 
COMMENTING GUIDE:
- HTML comments: <!-- comment here --> (works in .md, .html)
- JavaScript/TypeScript: // single line or /* multi-line */  
- Python: # single line or """ multi-line """
- CSS: /* comment */
- JSON: Cannot have comments (use separate .md file like this)
-->