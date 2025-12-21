# Nicky AI - Master Architecture & System Overview

**Last Updated:** December 4, 2025

This document serves as the "Master Guide" to the Nicky AI application, explaining how the entire system works, from the high-level concept to the deep technical implementation.

---

## 1. 🎯 High-Level Concept

**Nicky "Noodle Arms" A.I. Dente** is an AI-powered co-host designed for live streaming and podcasting. Unlike standard chatbots, Nicky has:
- **A Distinct Personality:** An unhinged, Italian-American Dead by Daylight streamer who is constantly on the verge of a breakdown.
- **Long-Term Memory:** He remembers past conversations, facts about the user, and lore from documents.
- **Voice Integration:** He speaks with a custom ElevenLabs voice, complete with emotional inflections (yelling, whispering, sighing).
- **Context Awareness:** He knows if he's in "Streaming Mode" (fast, punchy) or "Podcast Mode" (deep, storytelling).

---

## 2. 🏗️ Core Architecture

The application is built as a modern full-stack web app:

*   **Frontend:** React + TypeScript + Vite (The user interface)
*   **Backend:** Express + TypeScript (The brain)
*   **Database:** PostgreSQL (Neon) with Drizzle ORM (The memory)
*   **AI Brains:**
    *   **Primary:** Gemini 3 Pro Preview (Default for Chat & Intelligence)
    *   **Efficiency:** Gemini 2.5 Flash (Bulk tasks, Extraction)
    *   **Premium Fallback:** Claude Sonnet 4.5 (High-quality fallback)
*   **Voice:** ElevenLabs v3 (Text-to-Speech with emotion tags)

---

## 3. 🧠 Key Systems Explained

### A. The Memory System (The "Brain")
Nicky doesn't just "chat"; he remembers.
1.  **Ingestion:** When you talk or upload documents, the system breaks it down into "Memories" (facts).
2.  **Storage:** Memories are stored in the database with:
    *   **Keywords:** For exact matching.
    *   **Vector Embeddings:** For "semantic" matching (understanding that "pasta" and "spaghetti" are related).
3.  **Retrieval (Hybrid Search):** When you ask a question, the system searches for relevant memories using BOTH keywords and vector similarity.
4.  **Deduplication:** The system automatically detects and merges duplicate facts to keep the database clean.

### B. The Personality System (The "Soul")
Nicky isn't static. He changes based on the situation.
*   **Modes:**
    *   **Grumpy (Default):** Baseline annoyance.
    *   **Roast Mode:** Aggressive, volatile, insult-heavy.
    *   **Unhinged:** Chaotic, random, shouting.
*   **Variety Controller:** Ensures he doesn't repeat the same phrases ("Forget about it!") too often.
*   **Emotion Enhancer:** An AI layer that rewrites his text to add *emotional stage directions* like `[sighs]`, `[yelling]`, or `[muttering bitterly]`.

### C. The Voice System (The "Mouth")
1.  **Text Generation:** The AI generates the text response.
2.  **Emotion Tagging:** The **Emotion Enhancer** inserts tags like `[strong bronx wiseguy accent][grumpy]` into the text.
3.  **Synthesis:** ElevenLabs v3 reads these tags and changes the voice delivery dynamically (e.g., actually shouting when it sees `[yelling]`).

### D. Streaming Mode (The "Speed")
Optimized for live interaction where speed is critical.
*   **Faster Model:** Uses lighter AI models for quicker responses.
*   **Reduced Context:** Reads fewer past messages to save processing time.
*   **Fast Emotion Tags:** Uses the same high-quality emotion enhancer as Podcast mode (as of Dec 2, 2025) to ensure quality isn't sacrificed.

---

## 4. 🔄 Data Flow: "The Life of a Message"

Here is what happens when you send a message to Nicky:

1.  **User Input:** You type "Hey Nicky, what's your favorite pasta?"
2.  **Context Retrieval:**
    *   The system searches the database for memories about "pasta", "food", "favorites".
    *   It pulls the last 10-20 messages of conversation history.
3.  **Prompt Engineering:**
    *   The system builds a massive "Prompt" for the AI.
    *   It includes: Your message + Retrieved Memories + Personality Rules + Current Mood.
4.  **AI Generation:**
    *   The AI (Gemini or Claude) generates a text response: "Listen, you walnut! It's carbonara! NO CREAM!"
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
