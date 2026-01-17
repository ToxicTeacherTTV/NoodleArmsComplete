/**
 * Cleanup Incorrectly Extracted Podcast Facts
 *
 * This script identifies podcast facts that may have been extracted from
 * Toxic's dialogue instead of Nicky's, and allows you to review/delete them.
 *
 * Run with: npx tsx server/scripts/cleanup-podcast-facts.ts
 *
 * Options:
 *   --dry-run     Show what would be deleted without deleting (default)
 *   --delete      Actually delete the flagged facts
 *   --ai-review   Use AI to identify suspicious facts (costs API tokens)
 */

import { storage } from "../storage.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--delete');
const AI_REVIEW = args.includes('--ai-review');

// Patterns that suggest a fact might be about Toxic, not Nicky
const TOXIC_INDICATORS = [
  /\btoxic\b(?!'s)/i,           // "Toxic thinks" but not "Toxic's co-host"
  /\bhost thinks\b/i,
  /\bhost believes\b/i,
  /\bhost prefers\b/i,
  /\bhost likes\b/i,
  /\bhost plays\b/i,
  /\bhost mains\b/i,
  /\bi think\b/i,               // First person from Toxic
  /\bi believe\b/i,
  /\bi prefer\b/i,
  /\bi like playing\b/i,
  /\bi've been\b/i,
  /\bi disagree\b/i,
  /\bmy main\b/i,
  /\bmy opinion\b/i,
];

// Patterns that confirm a fact IS about Nicky
const NICKY_INDICATORS = [
  /\bnicky\b/i,
  /\bnoodle arms\b/i,
  /\bmy cousin\b/i,             // Nicky's family stories
  /\bmy uncle\b/i,
  /\bmy nonna\b/i,
  /\bmy aunt\b/i,
  /\buncle sal\b/i,
  /\blittle italy\b/i,
  /\bcapisce\b/i,
  /\bmadonna\b/i,
  /\bfuggedaboutit\b/i,
  /\bsabam\b/i,
  /\bthe entity\b/i,            // Nicky's DBD lore
];

interface FlaggedFact {
  id: string;
  content: string;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceId: string | null;
  temporalContext: string | null;
}

async function analyzeFactWithAI(facts: any[]): Promise<FlaggedFact[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.log('⚠️ GEMINI_API_KEY not set, skipping AI review');
    return [];
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const flagged: FlaggedFact[] = [];

  // Batch facts for efficiency
  const batchSize = 20;
  for (let i = 0; i < facts.length; i += batchSize) {
    const batch = facts.slice(i, i + batchSize);

    const prompt = `You are reviewing facts extracted from a podcast with TWO co-hosts:
1. **Toxic** - The HUMAN host
2. **Nicky** - The AI co-host (Italian-American character with family stories about Uncle Sal, cousins, etc.)

Review these facts and identify which ones are likely about TOXIC (not Nicky).
A fact is suspicious if it:
- Uses first person ("I think", "I prefer") without Nicky context
- Mentions Toxic's opinions without attributing to Nicky
- Doesn't sound like Nicky's Italian-American character voice

Facts to review:
${batch.map((f, idx) => `${idx + 1}. "${f.content}"`).join('\n')}

Return JSON with facts that should be DELETED (Toxic's opinions, not Nicky's):
{
  "flagged": [
    { "index": 1, "reason": "This is Toxic's opinion about gen speeds, not Nicky's" }
  ]
}

Only flag facts you're confident are NOT about Nicky. If unsure, don't flag it.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        config: { responseMimeType: "application/json" },
        contents: prompt,
      });

      const result = JSON.parse(response.text || '{"flagged":[]}');
      for (const flag of result.flagged || []) {
        const fact = batch[flag.index - 1];
        if (fact) {
          flagged.push({
            id: fact.id,
            content: fact.content,
            reason: flag.reason,
            confidence: 'HIGH',
            sourceId: fact.sourceId,
            temporalContext: fact.temporalContext,
          });
        }
      }
    } catch (error) {
      console.error(`⚠️ AI review batch failed:`, error);
    }

    // Rate limiting
    if (i + batchSize < facts.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return flagged;
}

function analyzeFactWithPatterns(fact: any): FlaggedFact | null {
  const content = fact.content;

  // Check if it has Nicky indicators - if so, it's probably fine
  for (const pattern of NICKY_INDICATORS) {
    if (pattern.test(content)) {
      return null; // Has Nicky indicators, keep it
    }
  }

  // Check for Toxic indicators
  for (const pattern of TOXIC_INDICATORS) {
    if (pattern.test(content)) {
      return {
        id: fact.id,
        content: fact.content,
        reason: `Matches pattern: ${pattern.toString()}`,
        confidence: 'MEDIUM',
        sourceId: fact.sourceId,
        temporalContext: fact.temporalContext,
      };
    }
  }

  return null;
}

async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('\n🧹 PODCAST FACT CLEANUP TOOL\n');
  console.log('=' .repeat(60));

  if (DRY_RUN) {
    console.log('📋 Mode: DRY RUN (use --delete to actually delete)');
  } else {
    console.log('⚠️  Mode: DELETE (facts will be permanently removed!)');
  }

  if (AI_REVIEW) {
    console.log('🤖 AI Review: ENABLED (will use Gemini API)');
  } else {
    console.log('🔍 AI Review: DISABLED (pattern matching only, use --ai-review to enable)');
  }
  console.log('=' .repeat(60) + '\n');

  // Get active profile
  const profile = await storage.getActiveProfile();
  if (!profile) {
    console.error('❌ No active profile found');
    process.exit(1);
  }
  console.log(`📂 Profile: ${profile.name} (${profile.id})\n`);

  // Get all podcast-sourced memories
  const allMemories = await storage.getMemoryEntries(profile.id, 99999);
  const podcastFacts = allMemories.filter(m => m.source === 'podcast_episode');

  console.log(`📊 Found ${podcastFacts.length} podcast-extracted facts\n`);

  if (podcastFacts.length === 0) {
    console.log('✅ No podcast facts to review!');
    process.exit(0);
  }

  // Analyze facts
  let flaggedFacts: FlaggedFact[] = [];

  // Pattern-based analysis (fast, free)
  console.log('🔍 Running pattern-based analysis...');
  for (const fact of podcastFacts) {
    const flagged = analyzeFactWithPatterns(fact);
    if (flagged) {
      flaggedFacts.push(flagged);
    }
  }
  console.log(`   Found ${flaggedFacts.length} suspicious facts via patterns\n`);

  // AI-based analysis (slower, costs tokens)
  if (AI_REVIEW) {
    console.log('🤖 Running AI-based analysis...');
    const aiFlagged = await analyzeFactWithAI(podcastFacts);

    // Merge, avoiding duplicates
    for (const flag of aiFlagged) {
      if (!flaggedFacts.find(f => f.id === flag.id)) {
        flaggedFacts.push(flag);
      }
    }
    console.log(`   AI flagged ${aiFlagged.length} additional facts\n`);
  }

  if (flaggedFacts.length === 0) {
    console.log('✅ No suspicious facts found! Your podcast data looks clean.');
    process.exit(0);
  }

  // Show flagged facts
  console.log('=' .repeat(60));
  console.log(`⚠️  FLAGGED FACTS (${flaggedFacts.length} total):`);
  console.log('=' .repeat(60) + '\n');

  for (let i = 0; i < flaggedFacts.length; i++) {
    const fact = flaggedFacts[i];
    console.log(`${i + 1}. [${fact.confidence}] ${fact.content}`);
    console.log(`   📍 Reason: ${fact.reason}`);
    if (fact.temporalContext) {
      console.log(`   📅 Source: ${fact.temporalContext}`);
    }
    console.log('');
  }

  console.log('=' .repeat(60));
  console.log(`\n📊 Summary: ${flaggedFacts.length} facts flagged for deletion`);
  console.log(`   HIGH confidence: ${flaggedFacts.filter(f => f.confidence === 'HIGH').length}`);
  console.log(`   MEDIUM confidence: ${flaggedFacts.filter(f => f.confidence === 'MEDIUM').length}`);
  console.log(`   LOW confidence: ${flaggedFacts.filter(f => f.confidence === 'LOW').length}\n`);

  if (DRY_RUN) {
    console.log('💡 To delete these facts, run with --delete flag:');
    console.log('   npx tsx server/scripts/cleanup-podcast-facts.ts --delete\n');
    console.log('💡 To use AI review for better accuracy:');
    console.log('   npx tsx server/scripts/cleanup-podcast-facts.ts --ai-review --delete\n');
  } else {
    const confirm = await promptUser(`\n⚠️  Delete ${flaggedFacts.length} facts? (y/n): `);

    if (confirm) {
      console.log('\n🗑️  Deleting flagged facts...');
      let deleted = 0;

      for (const fact of flaggedFacts) {
        try {
          await storage.deleteMemoryEntry(fact.id);
          deleted++;
          console.log(`   ✅ Deleted: ${fact.content.substring(0, 50)}...`);
        } catch (error) {
          console.log(`   ❌ Failed to delete ${fact.id}: ${error}`);
        }
      }

      console.log(`\n🎉 Deleted ${deleted}/${flaggedFacts.length} facts!`);
    } else {
      console.log('\n❌ Deletion cancelled.');
    }
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
