
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    console.log("🚀 Adding HNSW Vector Indexes for performance...");

    try {
        console.log("Adding index to documents...");
        await pool.query('CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops);');

        console.log("Adding index to memory_entries...");
        await pool.query('CREATE INDEX IF NOT EXISTS memory_entries_embedding_idx ON memory_entries USING hnsw (embedding vector_cosine_ops);');

        console.log("Adding index to content_library...");
        await pool.query('CREATE INDEX IF NOT EXISTS content_library_embedding_idx ON content_library USING hnsw (embedding vector_cosine_ops);');

        console.log("✅ HNSW indexes created successfully!");

    } catch (error) {
        console.error("❌ Index creation failed:", error);
        process.exit(1);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

main();
