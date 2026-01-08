

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables FIRST
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

async function scanMemoryHealth() {
    // Dynamic imports to ensure env vars are loaded before db connection
    const { db } = await import('../db');
    const { memoryEntries } = await import('../../shared/schema');
    const { desc, eq, asc, sql, like, or, and } = await import('drizzle-orm');

    console.log("🔍 STARTING FORENSIC MEMORY SCAN...");

    console.log("=========================================");

    const allMemories = await db.select().from(memoryEntries);
    console.log(`📊 Scanned ${allMemories.length} total memory entries.`);
    console.log("=========================================\n");

    const issues = {
        gibberish: [] as any[],
        brokenJson: [] as any[],
        repetitive: [] as any[],
        aiSlop: [] as any[],
        lowConfidence: [] as any[],
        emptySource: [] as any[]
    };

    // --- HEURISTIC FILTERS ---

    const AI_PATTERNS = [
        "as an ai", "language model", "i don't have feelings",
        "i cannot", "my programming", "training data"
    ];

    const BROKEN_PATTERNS = [
        "[object Object]", "undefined", "null", "NaN",
        "{\"content\":", "```json"
    ];

    allMemories.forEach(mem => {
        const content = mem.content || "";
        const lowerContent = content.toLowerCase();

        // 1. GIBBERISH (Too short or weird symbols)
        if (content.length < 15 && !content.includes("https")) {
            issues.gibberish.push(mem);
            return;
        }

        // 2. BROKEN JSON/CODE ARTIFACTS
        if (BROKEN_PATTERNS.some(p => content.includes(p))) {
            issues.brokenJson.push(mem);
            return;
        }

        // 3. AI SLOP (Refusals or identity breaks)
        if (AI_PATTERNS.some(p => lowerContent.includes(p))) {
            issues.aiSlop.push(mem);
            return;
        }

        // 4. REPETITIVE (Repeating words/chars excessively)
        if (/(.)\1{4,}/.test(content)) { // 5+ same chars in a row (e.g. "Ahhhhh")
            issues.repetitive.push(mem);
            return;
        }

        const words = lowerContent.split(" ");
        if (words.length > 10) {
            const uniqueWords = new Set(words);
            if (uniqueWords.size / words.length < 0.3) { // < 30% unique words
                issues.repetitive.push(mem);
                return;
            }
        }

        // 5. LOW CONFIDENCE (If tagged explicitly)
        if (mem.confidence !== null && mem.confidence < 25) {
            issues.lowConfidence.push(mem);
        }
    });

    // --- REPORTING ---


    // --- REPORTING TO FILE ---
    const fs = await import('fs');
    const path = await import('path');

    let report = "FORENSIC MEMORY SCAN RESULTS\n============================\n";

    function appendIssueGroup(name: string, items: any[]) {
        if (items.length === 0) return;
        report += `\n🔴 DETECTED [${name.toUpperCase()}]: ${items.length} entries\n`;
        items.forEach(m => {
            report += `   [ID: ${m.id}] "${m.content.substring(0, 100).replace(/\n/g, ' ')}..."\n`;
        });
    }

    appendIssueGroup('Gibberish (Too Short)', issues.gibberish);
    appendIssueGroup('Broken JSON/Code Artifacts', issues.brokenJson);
    appendIssueGroup('AI Refusals/Slop', issues.aiSlop);
    appendIssueGroup('Repetitive/Looping', issues.repetitive);
    appendIssueGroup('Low Confidence (<25%)', issues.lowConfidence);

    report += "\n=========================================\n✅ SCAN COMPLETE";

    const reportPath = path.resolve(__dirname, 'scan_results.txt');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Report written to: ${reportPath}`);

    console.log("\n=========================================");
    console.log("✅ SCAN COMPLETE");
    process.exit(0);
}

scanMemoryHealth().catch(console.error);

