import { db } from '../db';
import { memoryEntries } from '@shared/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { storage } from '../storage';

export type PoisonType = 'GIBBERISH' | 'BROKEN_JSON' | 'AI_SLOP' | 'REPETITIVE' | 'LOW_CONFIDENCE' | 'ALL';

export interface PoisonedEntry {
    id: string;
    content: string;
    type: PoisonType;
    confidence: number | null;
    source: string | null;
}

export class MemoryAuditor {

    /**
     * Scan a profile's memories for potential poison/bad data
     */
    async scanForPoison(profileId: string): Promise<Record<string, PoisonedEntry[]>> {
        const allMemories = await db.select()
            .from(memoryEntries)
            .where(eq(memoryEntries.profileId, profileId));

        const issues: Record<string, PoisonedEntry[]> = {
            gibberish: [],
            brokenJson: [],
            aiSlop: [],
            repetitive: [],
            lowConfidence: []
        };

        const AI_PATTERNS = [
            "as an ai", "language model", "i don't have feelings",
            "i cannot", "my programming", "training data", "fictional accounts",
            "content creators program", "copyright"
        ];

        const BROKEN_PATTERNS = [
            "[object Object]", "undefined", "null", "NaN",
            "{\"content\":", "```json"
        ];

        // Specific noise patterns found in previous scans
        const NOISE_PATTERNS = [
            "reduction in eurasian water", "undetectable viral load", "hiv",
            "xxx pics", "green colored poop", "mashed potatoes extra gravy",
            "lil dicky", "nicki minaj", "onika" // Name confusion
        ];

        allMemories.forEach(mem => {
            const content = mem.content || "";
            const lowerContent = content.toLowerCase();
            const id = mem.id;
            const confidence = mem.confidence;
            const source = mem.source;

            // 1. GIBBERISH (Too short or weird symbols)
            if (content.length < 15 && !content.includes("https")) {
                issues.gibberish.push({ id, content, type: 'GIBBERISH', confidence, source });
                return;
            }

            // 2. BROKEN JSON/CODE ARTIFACTS
            if (BROKEN_PATTERNS.some(p => content.includes(p))) {
                issues.brokenJson.push({ id, content, type: 'BROKEN_JSON', confidence, source });
                return;
            }

            // 3. AI SLOP (Refusals or identity breaks)
            if (AI_PATTERNS.some(p => lowerContent.includes(p)) || NOISE_PATTERNS.some(p => lowerContent.includes(p))) {
                issues.aiSlop.push({ id, content, type: 'AI_SLOP', confidence, source });
                return;
            }

            // 4. REPETITIVE (Repeating words/chars excessively)
            if (/(.)\1{4,}/.test(content)) { // 5+ same chars in a row (e.g. "Ahhhhh")
                issues.repetitive.push({ id, content, type: 'REPETITIVE', confidence, source });
                return;
            }

            const words = lowerContent.split(" ");
            if (words.length > 10) {
                const uniqueWords = new Set(words);
                if (uniqueWords.size / words.length < 0.3) { // < 30% unique words
                    issues.repetitive.push({ id, content, type: 'REPETITIVE', confidence, source });
                    return;
                }
            }

            // 5. LOW CONFIDENCE (If tagged explicitly)
            if (confidence !== null && confidence < 25) {
                issues.lowConfidence.push({ id, content, type: 'LOW_CONFIDENCE', confidence, source });
            }
        });

        return issues;
    }

    /**
     * Bulk delete memories by ID
     */
    async deleteMemories(memoryIds: string[]): Promise<number> {
        if (memoryIds.length === 0) return 0;

        const result = await db.delete(memoryEntries)
            .where(inArray(memoryEntries.id, memoryIds))
            .returning();

        return result.length;
    }

    /**
     * Mark memories as 'verified' (high confidence/protected) so they aren't flagged again
     */
    async verifyMemories(memoryIds: string[]): Promise<number> {
        if (memoryIds.length === 0) return 0;

        const result = await db.update(memoryEntries)
            .set({
                confidence: 100,
                isProtected: true,
                status: 'ACTIVE'
            })
            .where(inArray(memoryEntries.id, memoryIds))
            .returning();

        return result.length;
    }

    /**
     * Edit a specific memory
     */
    async editMemory(id: string, newContent: string): Promise<any> {
        return await storage.updateMemory(id, { content: newContent, confidence: 90 });
    }
}

export const memoryAuditor = new MemoryAuditor();
