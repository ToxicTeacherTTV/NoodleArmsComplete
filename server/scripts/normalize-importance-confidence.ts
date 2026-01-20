/**
 * 🔧 MIGRATION: Normalize Inflated Importance/Confidence Values
 *
 * This script fixes historical bugs that caused inflated values:
 * - importance: 850, 900, 700, 500 (should be 1-100)
 * - confidence: 99, 100 for auto-extracted content (should cap at 85)
 *
 * Run with: npx tsx server/scripts/normalize-importance-confidence.ts
 * Add --apply flag to actually make changes (default is dry-run)
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables FIRST
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

const DRY_RUN = !process.argv.includes('--apply');

async function normalizeValues() {
  // Dynamic imports to ensure env vars are loaded before db connection
  const { db } = await import('../db');
  const { memoryEntries } = await import('../../shared/schema');
  const { sql, eq, and, gt, lt, or, not } = await import('drizzle-orm');

  console.log("🔧 IMPORTANCE/CONFIDENCE NORMALIZATION SCRIPT");
  console.log("=============================================");
  console.log(DRY_RUN ? "📋 DRY RUN MODE - No changes will be made" : "⚠️  APPLY MODE - Changes will be committed");
  console.log("");

  // Fetch all memories for analysis
  const allMemories = await db.select({
    id: memoryEntries.id,
    content: memoryEntries.content,
    importance: memoryEntries.importance,
    confidence: memoryEntries.confidence,
    isProtected: memoryEntries.isProtected,
    source: memoryEntries.source,
    lane: memoryEntries.lane
  }).from(memoryEntries);

  console.log(`📊 Total memories: ${allMemories.length}`);
  console.log("");

  // === ANALYSIS ===

  // 1. Find importance values > 100 (clearly broken)
  const brokenImportance = allMemories.filter(m => (m.importance || 0) > 100);
  console.log(`🔴 Broken importance (>100): ${brokenImportance.length}`);
  if (brokenImportance.length > 0) {
    const sample = brokenImportance.slice(0, 5);
    sample.forEach(m => {
      console.log(`   [${m.importance}] "${m.content?.substring(0, 60)}..."`);
    });
    if (brokenImportance.length > 5) {
      console.log(`   ... and ${brokenImportance.length - 5} more`);
    }
  }

  // 2. Find high importance (80-100) - might be inflated
  const highImportance = allMemories.filter(m => {
    const imp = m.importance || 0;
    return imp >= 80 && imp <= 100;
  });
  console.log(`🟡 High importance (80-100): ${highImportance.length}`);

  // 3. Find very high confidence (>85) for non-protected facts
  const highConfidenceNonProtected = allMemories.filter(m => {
    const conf = m.confidence || 0;
    return conf > 85 && !m.isProtected;
  });
  console.log(`🟡 High confidence (>85, non-protected): ${highConfidenceNonProtected.length}`);
  if (highConfidenceNonProtected.length > 0) {
    const sample = highConfidenceNonProtected.slice(0, 5);
    sample.forEach(m => {
      console.log(`   [conf:${m.confidence}] "${m.content?.substring(0, 50)}..."`);
    });
  }

  // 4. Find confidence = 100 for non-protected (definitely wrong)
  const maxConfidenceNonProtected = allMemories.filter(m => {
    return m.confidence === 100 && !m.isProtected;
  });
  console.log(`🔴 Max confidence (100, non-protected): ${maxConfidenceNonProtected.length}`);

  // === STATISTICS ===
  console.log("");
  console.log("📈 DISTRIBUTION BEFORE NORMALIZATION:");

  const importanceBuckets = {
    '1-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0, '>100': 0
  };
  const confidenceBuckets = {
    '1-40': 0, '41-60': 0, '61-75': 0, '76-85': 0, '86-99': 0, '100': 0
  };

  allMemories.forEach(m => {
    const imp = m.importance || 50;
    const conf = m.confidence || 50;

    if (imp > 100) importanceBuckets['>100']++;
    else if (imp >= 81) importanceBuckets['81-100']++;
    else if (imp >= 61) importanceBuckets['61-80']++;
    else if (imp >= 41) importanceBuckets['41-60']++;
    else if (imp >= 21) importanceBuckets['21-40']++;
    else importanceBuckets['1-20']++;

    if (conf === 100) confidenceBuckets['100']++;
    else if (conf >= 86) confidenceBuckets['86-99']++;
    else if (conf >= 76) confidenceBuckets['76-85']++;
    else if (conf >= 61) confidenceBuckets['61-75']++;
    else if (conf >= 41) confidenceBuckets['41-60']++;
    else confidenceBuckets['1-40']++;
  });

  console.log("  Importance distribution:");
  Object.entries(importanceBuckets).forEach(([range, count]) => {
    const pct = ((count / allMemories.length) * 100).toFixed(1);
    console.log(`    ${range.padEnd(8)}: ${count.toString().padStart(5)} (${pct}%)`);
  });

  console.log("  Confidence distribution:");
  Object.entries(confidenceBuckets).forEach(([range, count]) => {
    const pct = ((count / allMemories.length) * 100).toFixed(1);
    console.log(`    ${range.padEnd(8)}: ${count.toString().padStart(5)} (${pct}%)`);
  });

  if (DRY_RUN) {
    console.log("");
    console.log("=============================================");
    console.log("📋 DRY RUN COMPLETE - No changes made");
    console.log("Run with --apply flag to apply changes:");
    console.log("  npx tsx server/scripts/normalize-importance-confidence.ts --apply");
    process.exit(0);
  }

  // === APPLY CHANGES ===
  console.log("");
  console.log("⚠️  APPLYING NORMALIZATION...");
  console.log("");

  let updated = 0;

  // 1. Fix broken importance values (>100)
  // These were clearly bugs (850, 900, 700, 500, etc.)
  // Normalize: divide by 10 if > 100, cap at 70
  if (brokenImportance.length > 0) {
    console.log("🔧 Fixing broken importance values (>100)...");
    for (const mem of brokenImportance) {
      const oldImp = mem.importance || 500;
      // Normalize: if it was 850, make it 85 then cap at 70
      // If it was 500-900, divide by 10 and cap
      let newImp = Math.round(oldImp / 10);
      newImp = Math.min(newImp, 70); // Cap at 70 for auto-extracted

      await db.update(memoryEntries)
        .set({ importance: newImp })
        .where(eq(memoryEntries.id, mem.id));
      updated++;
    }
    console.log(`   ✅ Fixed ${brokenImportance.length} entries`);
  }

  // 2. Reduce inflated importance (85-100 -> cap at 75 for non-protected)
  const veryHighImportance = allMemories.filter(m => {
    const imp = m.importance || 0;
    return imp >= 85 && imp <= 100 && !m.isProtected;
  });
  if (veryHighImportance.length > 0) {
    console.log("🔧 Capping very high importance (85-100) to 75 for non-protected...");
    for (const mem of veryHighImportance) {
      const oldImp = mem.importance || 85;
      // Soft reduction: 85->72, 90->73, 95->74, 100->75
      const newImp = Math.min(75, 70 + Math.floor((oldImp - 85) / 3));

      await db.update(memoryEntries)
        .set({ importance: newImp })
        .where(eq(memoryEntries.id, mem.id));
      updated++;
    }
    console.log(`   ✅ Capped ${veryHighImportance.length} entries`);
  }

  // 3. Cap confidence at 85 for non-protected facts
  if (highConfidenceNonProtected.length > 0) {
    console.log("🔧 Capping confidence at 85 for non-protected facts...");
    for (const mem of highConfidenceNonProtected) {
      // Keep some variance based on original value
      const oldConf = mem.confidence || 90;
      const newConf = Math.min(85, 80 + Math.floor((oldConf - 85) / 3));

      await db.update(memoryEntries)
        .set({ confidence: newConf })
        .where(eq(memoryEntries.id, mem.id));
      updated++;
    }
    console.log(`   ✅ Capped ${highConfidenceNonProtected.length} entries`);
  }

  // === FINAL STATS ===
  console.log("");
  console.log("=============================================");
  console.log(`✅ NORMALIZATION COMPLETE - Updated ${updated} entries`);
  console.log("");

  // Re-fetch and show new distribution
  const afterMemories = await db.select({
    importance: memoryEntries.importance,
    confidence: memoryEntries.confidence,
    isProtected: memoryEntries.isProtected
  }).from(memoryEntries);

  const newImportanceBuckets = {
    '1-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0, '>100': 0
  };
  const newConfidenceBuckets = {
    '1-40': 0, '41-60': 0, '61-75': 0, '76-85': 0, '86-99': 0, '100': 0
  };

  afterMemories.forEach(m => {
    const imp = m.importance || 50;
    const conf = m.confidence || 50;

    if (imp > 100) newImportanceBuckets['>100']++;
    else if (imp >= 81) newImportanceBuckets['81-100']++;
    else if (imp >= 61) newImportanceBuckets['61-80']++;
    else if (imp >= 41) newImportanceBuckets['41-60']++;
    else if (imp >= 21) newImportanceBuckets['21-40']++;
    else newImportanceBuckets['1-20']++;

    if (conf === 100) newConfidenceBuckets['100']++;
    else if (conf >= 86) newConfidenceBuckets['86-99']++;
    else if (conf >= 76) newConfidenceBuckets['76-85']++;
    else if (conf >= 61) newConfidenceBuckets['61-75']++;
    else if (conf >= 41) newConfidenceBuckets['41-60']++;
    else newConfidenceBuckets['1-40']++;
  });

  console.log("📈 DISTRIBUTION AFTER NORMALIZATION:");
  console.log("  Importance distribution:");
  Object.entries(newImportanceBuckets).forEach(([range, count]) => {
    const pct = ((count / afterMemories.length) * 100).toFixed(1);
    console.log(`    ${range.padEnd(8)}: ${count.toString().padStart(5)} (${pct}%)`);
  });

  console.log("  Confidence distribution:");
  Object.entries(newConfidenceBuckets).forEach(([range, count]) => {
    const pct = ((count / afterMemories.length) * 100).toFixed(1);
    console.log(`    ${range.padEnd(8)}: ${count.toString().padStart(5)} (${pct}%)`);
  });

  process.exit(0);
}

normalizeValues().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
