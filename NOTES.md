# Development Notes

<!-- This is a comment in Markdown - won't be visible when rendered -->

## Application Overview

### What It Is
This is a sophisticated AI-powered co-host application featuring Nicky "Noodle Arms" A.I. Dente - an unreliable narrator Italian-American character who serves as a live streaming companion. The system functions as an interactive voice agent that can listen to user speech, process it through AI services, and respond with contextually-aware audio responses using advanced voice synthesis.

### Core Functionality
**Real-Time Voice Interaction:**
- Browser-based speech recognition captures user voice input
- ElevenLabs API provides high-quality voice synthesis for Nicky's responses
- Web Audio API handles real-time voice activity detection and visualization
- Automatic speech restart and queue management for seamless conversation flow

**AI-Powered Personality System:**
- Anthropic Claude API powers Nicky's conversational intelligence
- Customizable personality profiles with core identity and knowledge base configuration
- Character-consistent response generation with emotion tag support
- Sophisticated memory management with retrieval-augmented generation (RAG)

**Advanced Memory Architecture:**
- PostgreSQL database stores conversations, messages, documents, and memory entries
- Memory categorization system (FACT, PREFERENCE, LORE, CONTEXT types)
- Keyword-based knowledge retrieval for contextual conversation enhancement
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