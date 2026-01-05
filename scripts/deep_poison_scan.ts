
import { pool } from '../server/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log("🔍 Scanning for 'Helpful Assistant' or 'Scientific' poison...");
    
    const keywords = [
        'assistant', 'helpful', 'science', 'research', 'study', 
        'biological', 'maintenance', 'system', 'process', 'important',
        'self-love', 'superpower', 'romance', 'greatest', 'journey',
        'meditation', 'wellness', 'health', 'scientific', 'evidence'
    ];

    for (const kw of keywords) {
        console.log(`\n--- Keyword: ${kw} ---`);
        
        // Memories
        const memories = await pool.query(
            "SELECT id, content, lane FROM memory_entries WHERE content ILIKE $1 LIMIT 10",
            [`%${kw}%`]
        );
        if (memories.rows.length > 0) {
            console.log(`Found in memories (${memories.rows.length}):`);
            memories.rows.forEach(r => console.log(`  [${r.id}] (${r.lane}): ${r.content.substring(0, 100)}...`));
        }

        // Documents
        const docs = await pool.query(
            "SELECT id, name, filename FROM documents WHERE extracted_content ILIKE $1 OR name ILIKE $1 LIMIT 10",
            [`%${kw}%`]
        );
        if (docs.rows.length > 0) {
            console.log(`Found in documents (${docs.rows.length}):`);
            docs.rows.forEach(r => console.log(`  [${r.id}] (${r.name || r.filename})`));
        }
    }

    console.log("\n🔍 Inspecting specific 'Auto-saved' documents...");
    const autoSaved = await pool.query(
        "SELECT id, name, extracted_content FROM documents WHERE name LIKE 'Training: Auto-saved message (2026-01-04)' LIMIT 3"
    );
    autoSaved.rows.forEach(r => {
        console.log(`\n--- Document: ${r.name} [${r.id}] ---`);
        console.log(r.extracted_content.substring(0, 500));
    });

    console.log("\n🔍 Searching for specific hallucination keywords (Glymphatic, Matthew Walker)...");
    const hallucinations = await pool.query(
        "SELECT id, content FROM memory_entries WHERE content ILIKE '%glymphatic%' OR content ILIKE '%matthew walker%' OR content ILIKE '%sleep science%'"
    );
    if (hallucinations.rows.length > 0) {
        console.log(`Found ${hallucinations.rows.length} hallucination memories:`);
        hallucinations.rows.forEach(r => console.log(`  [${r.id}]: ${r.content}`));
    } else {
        console.log("No specific sleep science hallucinations found in memories.");
    }

    const idsToDelete = [
        '8e13ab50-4ad0-49d1-a95f-da65a4676d01',
        '03280d88-cdff-4eff-8742-c258441cb947',
        '482cd038-b43d-4449-944b-d4956dac4058',
        '0dd54820-70fb-4e65-8071-a8c07bc63e70',
        'e724c89c-573f-49a2-87ac-9f85552903d2'
    ];
    console.log('\n🗑️ Deleting poisoned memories...');
    const delRes = await pool.query('DELETE FROM memory_entries WHERE id = ANY($1)', [idsToDelete]);
    console.log(`Deleted ${delRes.rowCount} memories.`);

    console.log('\n🔍 Searching for AI-leakage in documents...');
    const aiLeak = await pool.query("SELECT id, name, filename FROM documents WHERE extracted_content ILIKE '%helpful assistant%' OR extracted_content ILIKE '%as an AI model%' OR extracted_content ILIKE '%I am an AI%'");
    if (aiLeak.rows.length > 0) {
        console.log(`Found ${aiLeak.rows.length} AI-leakage documents:`);
        aiLeak.rows.forEach(r => console.log(`  [${r.id}] (${r.name || r.filename})`));
    } else {
        console.log('No AI-leakage documents found.');
    }

    process.exit(0);
}

main().catch(console.error);
