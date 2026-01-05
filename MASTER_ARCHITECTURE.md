# Nicky AI - Master Architecture & System Overview

**Last Updated:** December 28, 2025

This document serves as the "Master Guide" to the Nicky AI application, explaining how the entire system works, from the high-level concept to the deep technical implementation.

---

## 1. 🎯 High-Level Concept

**Nicky "Noodle Arms" A.I. Dente** is an AI-powered co-host designed for live streaming and podcasting. Unlike standard chatbots, Nicky has:
- **A Distinct Personality:** An unhinged, Italian-American Dead by Daylight streamer who is constantly on the verge of a breakdown.
- **Long-Term Memory:** He remembers past conversations, facts about the user, and lore from documents.
- **Voice Integration:** He speaks with a custom ElevenLabs voice, complete with emotional inflections (yelling, whispering, sighing).
- **Context Awareness:** He knows if he's in "Streaming Mode" (fast, punchy) or "Podcast Mode" (deep, storytelling).
- **Persistence:** He remembers his current mood, mode, and conversation variety even if the server restarts.

---

## 2. 🏗️ Core Architecture

The application is built as a modern full-stack web app:

*   **Frontend:** React + TypeScript + Vite (The user interface)
*   **Backend:** Express + TypeScript (The brain)
*   **Database:** PostgreSQL (Neon) with Drizzle ORM (The memory)
*   **AI Brains:**
    *   **Primary:** Gemini 3 Flash (Default for Chat, RAG, Extraction, & Analysis)
    *   **Fallback:** Gemini 3 Pro (When Flash fails)
*   **Voice:** ElevenLabs v3 (Text-to-Speech with emotion tags)

---

## 3. 🧠 Key Systems Explained

### A. The Memory System (The "Brain")
Nicky doesn't just "chat"; he remembers.
1.  **Ingestion:** When you talk or upload documents, the system breaks it down into "Memories" (facts).
2.  **Memory Lanes (Canon vs Rumor):** Memories are categorized into lanes:
    *   **CANON:** Verified facts and lore that Nicky must respect as truth.
    *   **RUMOR:** Embellishments, gossip, and "unreliable narrator" content that Nicky is encouraged to lie about or exaggerate.
3.  **Privacy Gating:** Lore extraction is gated by a global "Memory Learning" toggle and per-message `[PRIVATE]` triggers.
4.  **Storage:** Memories are stored in the database with:
    *   **Keywords:** For exact matching.
    *   **Vector Embeddings:** For "semantic" matching (understanding that "pasta" and "spaghetti" are related).
4.  **Retrieval (Hybrid Search):** When you ask a question, the system searches for relevant memories using BOTH keywords and vector similarity.
5.  **Deduplication:** The system automatically detects and merges duplicate facts to keep the database clean.
6.  **Integrity:** Cascading deletes ensure that removing a profile wipes all associated data cleanly.

### B. The Personality System (The "Soul")
Nicky isn't static. He changes based on the situation.
*   **Modes:**
    *   **Grumpy (Default):** Baseline annoyance.
    *   **Roast Mode:** Aggressive, volatile, insult-heavy.
    *   **Unhinged:** Chaotic, random, shouting.
*   **Unreliable Narrator:** Nicky uses the **Memory Lanes** to decide when to be truthful. He respects Canon but treats Rumors as creative writing prompts, often contradicting himself for comedic effect.
*   **Personality Hardening ("Show, Don't Tell"):** Nicky is strictly forbidden from narrating his own physical actions (e.g., *leans in*, [sighs]). He must convey his state through dialogue and [emotion] tags only.
*   **Variety Controller:** Ensures he doesn't repeat the same phrases ("Forget about it!") too often. This state is persisted to the database.
*   **Style Guidance:** Uses semantic retrieval of training examples to maintain character voice without prompt bloat.
*   **Emotion Enhancer:** An AI layer that rewrites his text to add *emotional stage directions* like `[sighs]`, `[yelling]`, or `[muttering bitterly]`.
*   **AI Orchestrator:** The central hub that coordinates between the **Brain** (ContextBuilder) and the **Mouth** (Model Providers).

### C. The Context Engine (The "Central Nervous System")
The **ContextBuilder** is the centralized engine for all RAG (Retrieval-Augmented Generation) logic.
*   **Brain/Mouth Separation:** The system decouples context gathering (Brain) from the actual AI generation (Mouth). This allows Nicky to be model-agnostic.
*   **Parallel Loading:** Uses `Promise.all` to fetch memories, documents, lore, training data, and entities in parallel, reducing latency by up to 70%.
*   **Context Pruning:** Automatically removes redundant information that is already present in the recent conversation history.
*   **History Truncation:** Aggressively truncates historical messages to 600 characters to maintain speed and focus.
*   **Web Search Integration:** Dynamically triggers web searches when Nicky's internal knowledge has a gap.

### D. Vibe-Based Storytelling ("Where the fuck are the viewers from")
A specialized narrative engine for the podcast's city segment.
*   **Narrative Archetypes:** Instead of a rigid script, Nicky uses "Flavor Packs" (The Grudge, The Fugitive, The Food Crime, etc.) to guide his stories.
*   **Multi-Turn Persistence:** Stories are tracked across multiple messages using a `metadata` state machine in the database.
*   **Natural Triggers:** Nicky can detect city mentions in chat (e.g., "What about Berlin?") and automatically start a state-managed story segment.
*   **Manual Control:** The UI allows users to trigger specific city stories or pick a random uncovered city from the database.

### D. The Voice System (The "Mouth")
1.  **Text Generation:** The AI generates the text response.
2.  **Emotion Tagging:** The **Emotion Enhancer** inserts tags like `[strong bronx wiseguy accent][grumpy]` into the text.
3.  **Synthesis:** ElevenLabs v3 reads these tags and changes the voice delivery dynamically (e.g., actually shouting when it sees `[yelling]`).
4.  **Reliability:** Character-themed error handling provides clear feedback if the voice service is unavailable or quota-limited.

### E. Podcast Mode (The "Single-Pass")
Optimized for long-form storytelling and deep character work.
*   **Single-Pass Generation:** Uses Gemini 3 Flash to generate high-quality, long-form responses in a single pass, reducing latency and improving narrative flow.
*   **Deep Context:** Utilizes Gemini's massive context window to remember complex lore and past episode details.
*   **Show Context:** Automatically detects if the current episode is "Camping Them Softly" (DbD) or "Camping the Extract" (Arc Raiders) and adjusts personality accordingly.

---

## 4. 🔄 Data Flow: "The Life of a Message"

Here is what happens when you send a message to Nicky:

1.  **User Input:** You type "Hey Nicky, what's your favorite pasta?"
2.  **Context Retrieval:**
    *   The system searches the database for memories about "pasta", "food", "favorites".
    *   It pulls the last 10-20 messages of conversation history.
3.  **Orchestration:**
    *   The **AI Orchestrator** detects if you're talking about a specific show, game, or city.
    *   It injects the correct personality facets, narrative archetypes, and variety rules.
4.  **AI Generation:**
    *   The AI (Gemini 3 Flash) generates a text response: "Listen, you walnut! It's carbonara! NO CREAM!"
5.  **Emotion Enhancement:**
    *   The text is passed through the **Emotion Enhancer**.
    *   Result: `[strong bronx wiseguy accent][annoyed] Listen, you walnut! [yelling] It's carbonara! [furious] NO CREAM!`
6.  **Voice Synthesis:** ElevenLabs turns that tagged text into audio.
7.  **Response:** The frontend plays the audio and shows the text.

---

## 5. 📂 Project Structure Overview

*   **`client/`**: The website you see.
    *   `components/`: The building blocks (Chat window, Memory panel, Settings).
*   **`server/`**: The logic.
    *   `services/`: The workers.
        *   `AIOrchestrator.ts`: The central brain for context and model routing.
        *   `anthropic.ts` / `gemini.ts`: Talk to the AI.
        *   `elevenlabs.ts`: Talks to the voice API.
        *   `emotionEnhancer.ts`: Adds the emotion tags.
        *   `storage.ts`: Talks to the database.
    *   `routes.ts`: The API endpoints (connects frontend to backend).
*   **`shared/`**: Code shared between front and back (Database schemas).

---

## 6. 🛠️ Maintenance & Troubleshooting

*   **Rate Limits:** If the AI stops responding, we might have hit the free tier limit for Gemini. The system will try to fallback to other models automatically.
*   **Memory Issues:** If Nicky forgets something, check the **Memory Panel** in the UI to see if the fact exists.
*   **Personality:** If he's too nice or too mean, adjust the **Personality Surge Panel** sliders.

---

*This document provides a high-level map of the Nicky AI system. For specific code implementation details, refer to the `DEVELOPMENT_GUIDE.md`.*
