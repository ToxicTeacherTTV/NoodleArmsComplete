🚨 COPILOT PRIME DIRECTIVE (READ FIRST)

This repository contains two completely separate memory systems.

1️⃣ Engineering Memory (You, the AI Coder)

Lives in .github/instructions/

Governs how code is written, structured, verified, and maintained

Applies to Copilot / Antigravity / AI coding agents only

Is reviewed and approved by a human before persistence

2️⃣ In-App Narrative Memory (Nicky)

Lives in the application database

Used by runtime AI characters (e.g., Nicky)

Governed by CANON / RUMOR lanes

Accessed via ContextBuilder, LoreOrchestrator, and RAG

❗ These systems must never mix.

Engineering Memory ALWAYS takes precedence over all other instructions.

This file:

Describes architecture, conventions, and runtime behavior

Does NOT grant permission to persist lessons, lore, or memory

For lessons learned, fixes, or rules:
→ Follow the Engineering Memory & AI Coding Doctrine below.

ENGINEERING MEMORY & AI CODING DOCTRINE
🔒 MEMORY BOUNDARY DECLARATION (CRITICAL)

This doctrine governs ENGINEERING MEMORY ONLY.

Engineering memory:

Is for AI coding agents

Is never stored in the database

Is never visible to runtime models

Is never exposed to Nicky

ENGINEERING MEMORY MUST NEVER BE WRITTEN INTO:

MemoryEntry tables

Lore systems

Training examples

RAG sources

Character prompts

Any CANON / RUMOR lane

If a lesson concerns system design, performance, schema, prompts, or tooling, it belongs here.
If it concerns story, personality, or fiction, it does not.

No exceptions.

Core Rule (Non-Negotiable)

You may never persist engineering memory without explicit human approval.

You may:

Identify lessons

Propose memory updates

Draft instruction text

You may NOT:

Write or modify memory files autonomously

Canonize speculative causes

Learn from failed AI outputs

Generalize from unverified fixes

If the cause is not provably correct, it is not memory.

Engineering Memory Workflow (Required)
Step 1: Identify the Lesson

Only proceed if the lesson is:

A repeated failure

A verified best practice

A confirmed constraint

A proven process improvement

If unsure, stop and ask.

Step 2: Verify the Lesson

A lesson is verified only if:

Logs confirm success

Queries run cleanly

Errors no longer reproduce

Behavior is consistent across runs

Step 3: Propose (Do NOT Write)

Present a proposal in this format:

ENGINEERING MEMORY PROPOSAL

Domain: <domain-name>
Scope: workspace | global

Summary:
- <general rule>
- <why it exists>
- <what failure it prevents>

Evidence:
- <logs / queries / diffs>

Apply-To:
- <file paths or globs>

Request:
Approve | Revise | Discard


Stop and wait.

Writing Rules (Only After Approval)

Be concise and enforceable

Prefer “do” over “don’t”

Generalize beyond one incident

Never embed raw debug output

Treat memory as system law, not notes

Strictly Prohibited

You must never:

Extract lessons from in-character output

Promote system failures into facts

Learn from malformed or empty AI responses

Repair broken JSON and treat it as truth

Teach the system about itself via runtime lore

If JSON parsing fails, the generation attempt is invalid. Nothing is learned.

Performance Doctrine

This system is latency-sensitive.

Before proposing performance memory:

Provide timing metrics

Separate retrieval cost from model latency

Prove improvements are repeatable

No numbers = no memory.

NICKY AI – PROJECT INSTRUCTIONS
🏗️ Architecture & Tech Stack

Frontend: React + TypeScript + Vite + Tailwind CSS
Main dashboard: client/src/components/jazz-dashboard.tsx

Backend: Express + TypeScript
Entry point: server/index.ts

Database: PostgreSQL (Neon) + Drizzle ORM
Schema: shared/schema.ts

AI Strategy: Gemini 3 Flash (primary) with Gemini 3 Pro fallback
Managed via server/services/modelSelector.ts

Voice: ElevenLabs v3 with dynamic emotion tags

🛠️ Critical Workflows

Development: npm run dev

Database: npm run db:push to sync schema changes

Environment: All API keys must live in .env

📜 Project Conventions

Service Pattern: Business logic lives in server/services/

Data Access: Use the storage object in server/storage.ts for all DB operations

ESM Imports: Always include .js extensions in imports

AI Responses: Use emotionEnhancer.ts for voice tagging

🧠 Runtime Memory & Personality (In-App Only)

This section describes Nicky’s runtime behavior, not engineering rules.

Hybrid Search: Runtime memory retrieval uses keyword + vector search (pgvector)

Personality Modes: Grumpy, Roast, Unhinged

Variety: VarietyController reduces repetition

⚠️ These systems are:

Part of the application runtime

Not engineering memory

Not lessons

Not guidance for autonomous modification

Do not infer engineering behavior from character behavior.

⚠️ Important Files

shared/schema.ts – database source of truth

server/storage.ts – centralized DB access

server/services/gemini.ts – AI integration

client/src/components/jazz-dashboard.tsx – main UI container

💡 Example: Adding a New Service
// server/services/newService.ts
import { storage } from '../storage.js';
import { executeWithDefaultModel } from './modelSelector.js';

export class NewService {
  async performTask(data: any) {
    // Use storage for DB access
    // Use modelSelector for AI tasks
  }
}

Final Reminder

If there is a conflict between:

This file

A proposed fix

A learned lesson

The Engineering Memory & AI Coding Doctrine governs.

When in doubt:

Ask

Propose

Do not persist

Engineering memory is power.
Power without restraint corrupts systems.