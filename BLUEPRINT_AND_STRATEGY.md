# 📘 Nicky AI: The Complete Blueprint & Strategy Guide

**Version:** 1.0  
**Date:** December 20, 2025  
**Status:** Living Document  

---

## 1. 🌟 Executive Summary

**Nicky "Noodle Arms" A.I. Dente** is not just a chatbot; he is a **fully autonomous, personality-driven AI co-host** designed for live streaming and content creation. 

Unlike standard LLM wrappers, Nicky is built on a **multi-agent cognitive architecture** that prioritizes:
1.  **Personality Integrity:** He is an unhinged, Italian-American Dead by Daylight streamer who is constantly on the verge of a breakdown. He never breaks character.
2.  **Long-Term Memory:** He remembers facts, stories, and user details across sessions using a hybrid vector/keyword database.
3.  **Emotional Voice Synthesis:** He speaks with a custom ElevenLabs voice that dynamically changes emotion (yelling, whispering, sighing) based on the context of his own words.
4.  **Cost-Effective Intelligence:** He utilizes a streamlined AI strategy, using **Gemini 3 Flash** as the primary brain for all operations, ensuring maximum performance at minimum cost.

---

## 2. 🎯 Core Goals & Philosophy

### The "Why"
Most AI companions are boring, agreeable, and static. Nicky is designed to be **entertaining, volatile, and memorable**. The goal is to create an AI that feels like a real, slightly unstable person sitting in the room with you.

### The "What"
*   **For the User:** A hilarious, roast-heavy companion who can hold a conversation, remember lore, and react to live events.
*   **For the Developer:** A robust, scalable platform for experimenting with advanced AI concepts like memory consolidation, personality drift, and multi-model orchestration.

### The "How" (Coding Strategy)
*   **Type Safety First:** Strict TypeScript interfaces for all data flows.
*   **Service-Oriented Architecture:** Logic is broken down into small, single-purpose services (e.g., `emotionEnhancer`, `memoryDeduplicator`).
*   **Model Agnosticism:** The system is designed to swap AI models easily (Gemini, Claude, OpenAI) without rewriting core logic.
*   **Fail-Safe Design:** If the "Smart" model fails, it falls back to a "Fast" model. If the database is slow, it serves a cached response.

---

## 3. 🏗️ System Architecture

### A. The Tech Stack
*   **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS (Fast, responsive UI).
*   **Backend:** Node.js + Express + TypeScript (Robust API server).
*   **Database:** PostgreSQL (Neon Serverless) + Drizzle ORM (Type-safe database access).
*   **Vector Store:** `pgvector` extension on Postgres (Semantic memory search).
*   **AI Brains:**
    *   **Primary Intelligence:** **Gemini 3 Flash** (Google) - High speed, low cost, high IQ. Handles Chat, Logic, Extraction, and Analysis.
    *   **Fallback:** **Gemini 3 Pro Preview** - Used if Flash fails.
    *   **Legacy:** Gemini 2.5 Pro (Last resort).
    *   *(Note: Claude Sonnet 4.5 has been deprecated to reduce complexity)*
*   **Voice:** ElevenLabs v3 (Turbo model with custom voice clone).

### B. The "Brain" (Cognitive Architecture)
Nicky's "mind" is composed of several distinct modules that work together:

1.  **The Orchestrator (`aiOrchestrator.ts`)**
    *   The traffic cop. It decides which AI model to use for a given task based on cost, complexity, and user preference.
    *   *Example:* "Is this a simple chat? Use Gemini 3 Flash. Is this a complex memory merge? Also use Gemini 3 Flash (it's that good)."

2.  **The Memory System (`memoryDeduplicator.ts`, `storage.ts`)**
    *   **Ingestion:** Converts user text into "Memories" (atomic facts).
    *   **Retrieval:** Uses **Hybrid Search** (Keywords + Vector Embeddings) to find relevant info.
    *   **Consolidation:** A background process that wakes up every few minutes to find duplicate memories and merge them into a single, stronger memory.

3.  **The Personality Engine (`personalityProfile.ts`, `emotionEnhancer.ts`)**
    *   **Core Identity:** A massive system prompt defining who Nicky is.
    *   **Mood System:** Tracks his current emotional state (Grumpy, Furious, Manic).
    *   **Emotion Enhancer:** A post-processing step that reads Nicky's generated text and inserts "stage directions" for the voice engine (e.g., `[sighs]`, `[yelling]`).

4.  **The Voice Module (`elevenlabs.ts`)**
    *   Takes the tagged text and converts it to audio.
    *   Understands tags like `[strong bronx wiseguy accent]` to modulate delivery.

---

## 4. 🔄 Data Flow: The Lifecycle of a Message

1.  **Input:** User types "Do you remember my dog's name?"
2.  **Retrieval:**
    *   System embeds the query into a vector.
    *   Searches DB for memories near "dog", "pet", "name".
    *   Finds: "User has a dog named Barky."
3.  **Prompt Construction:**
    *   System builds a prompt:
        *   *Identity:* "You are Nicky, an angry Italian streamer."
        *   *Context:* "User just asked about their dog."
        *   *Memory:* "You know the dog is named Barky."
        *   *Instruction:* "Answer the user, but be annoyed that they tested you."
4.  **Generation (Gemini 3 Flash):**
    *   AI generates: "Of course I remember Barky! What do I look like, a goldfish?"
5.  **Enhancement (Emotion Engine):**
    *   AI rewrites: `[strong bronx wiseguy accent][annoyed] Of course I remember Barky! [yelling] What do I look like, a goldfish?`
6.  **Synthesis (ElevenLabs):**
    *   Audio is generated with the specific emotional inflections.
7.  **Output:** User hears the audio and sees the text.

---

## 5. 🧠 AI Strategy & Model Selection

We use a **Tiered Model Strategy** to balance cost and quality.

| Tier | Model | Use Case | Cost (per 1M tokens) |
|------|-------|----------|----------------------|
| **Primary** | **Gemini 3 Flash** | EVERYTHING (Chat, Logic, Extraction) | ~$0.10 (Input) |
| **Fallback** | **Gemini 3 Pro Preview** | First line of defense if Flash fails | TBD (Premium) |
| **Last Resort** | **Gemini 2.5 Pro** | Ultimate backup | $1.25 (Input) |

**Why Gemini 3 Flash?**
It represents a paradigm shift. It is faster and cheaper than the old "Pro" models while offering superior intelligence. It allows us to run complex chains of thought without breaking the bank. **Claude Sonnet 4.5** has been removed from the active rotation to streamline costs and dependency management.

---

## 6. 🗺️ Roadmap & Future Goals

### Short Term
*   **Memory Visualization:** A 3D graph view of Nicky's brain to see how memories connect.
*   **Twitch Integration:** Direct connection to Twitch chat to reply to viewers in real-time.

### Medium Term
*   **Visual Vision:** Giving Nicky "eyes" (multimodal input) so he can see the game screen and react to gameplay.
*   **Autonomous Agency:** Allowing Nicky to initiate conversations or "decide" to look something up without being prompted.

### Long Term
*   **Full Autonomy:** Nicky runs as a background process on a dedicated server, "living" his life and tweeting/messaging even when the stream is offline.

---

## 7. 📂 Key File Directory

*   **`server/config/geminiModels.ts`**: The central registry of AI models and their costs.
*   **`server/services/aiOrchestrator.ts`**: The brain that routes tasks to models.
*   **`server/services/memoryDeduplicator.ts`**: The logic for merging duplicate memories.
*   **`server/services/emotionEnhancer.ts`**: The system that adds emotional tags.
*   **`shared/modelSelection.ts`**: Shared types for model configuration.
*   **`MASTER_ARCHITECTURE.md`**: Technical deep dive (companion to this doc).

---

*This document is a high-level blueprint. For specific implementation details, refer to the code in the `server/services` directory.*
