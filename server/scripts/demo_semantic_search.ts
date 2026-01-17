
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runSemanticSearch() {
    console.log("🔍 Running Test Semantic Search...");

    try {
        // Generate a random query vector (768 dimensions)
        const queryVector = new Array(768).fill(0).map(() => Math.random() * 0.1);
        
        // 🔒 ENGINEERING MEMORY COMPLIANCE 🔒
        // Rule: database-vectors
        // Action: JSON.stringify vector + cast to ::vector in SQL
        const vectorParam = JSON.stringify(queryVector);

        const result = await pool.query(
            `
            SELECT 
                id, 
                content, 
                (1 - (embedding <=> $1::vector)) as similarity 
            FROM memory_entries 
            WHERE embedding IS NOT NULL 
            ORDER BY embedding <=> $1::vector 
            LIMIT 3
            `,
            [vectorParam]
        );

        console.log(`✅ Found ${result.rows.length} results.`);
        result.rows.forEach((row, i) => {
            console.log(`\n--- Result ${i + 1} (Sim: ${(row.similarity * 100).toFixed(1)}%) ---`);
            console.log(row.content.substring(0, 100) + "...");
        });

    } catch (error: any) {
        console.error("❌ Search failed:", error.message);
    } finally {
        await pool.end();
    }
}

runSemanticSearch();
