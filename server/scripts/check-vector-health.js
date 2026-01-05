
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Permanent health check for Vector Search functionality.
 * Verifies:
 * 1. Extension exists
 * 2. Columns are vector type
 * 3. Similarity search works
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkHealth() {
    console.log("🔍 Checking Vector Search Health...");

    try {
        // 1. Check Extension
        const ext = await pool.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
        if (ext.rows.length === 0) throw new Error("pgvector extension missing");
        console.log("✅ pgvector extension is active.");

        // 2. Check Column Types
        const types = await pool.query(`
      SELECT table_name, udt_name 
      FROM information_schema.columns 
      WHERE column_name = 'embedding' 
      AND table_name IN ('documents', 'memory_entries', 'content_library')
    `);

        for (const row of types.rows) {
            if (row.udt_name !== 'vector') throw new Error(`Column ${row.table_name}.embedding is type ${row.udt_name}, expected vector`);
        }
        console.log("✅ All embedding columns are vector type.");

        // 3. Test Search
        const dummyVector = new Array(768).fill(0).map(() => Math.random());
        const vectorLiteral = `[${dummyVector.join(',')}]`;

        const searchTest = await pool.query(`
      SELECT id, (1 - (embedding <=> $1::vector)) as similarity 
      FROM documents 
      WHERE embedding IS NOT NULL 
      LIMIT 1
    `, [vectorLiteral]);

        console.log("✅ Similarity search functional.");
        console.log("\n✨ VECTOR SYSTEM IS HEALTHY!");

    } catch (error) {
        console.error("\n❌ VECTOR SYSTEM UNHEALTHY:");
        console.error(error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkHealth();
