
import { db, pool } from "../db.js";
import { sql } from "drizzle-orm";

async function main() {
    console.log("🔍 Forensic Embedding Investigation...");

    try {
        const result = await pool.query(`
      SELECT id, 
             embedding as raw_embedding,
             left(embedding::text, 20) as head,
             right(embedding::text, 20) as tail,
             length(embedding::text) as len
      FROM documents
      WHERE document_type = 'TRAINING_EXAMPLE'
        AND embedding IS NOT NULL
      LIMIT 10;
    `);

        if (result.rows.length === 0) {
            console.log("❌ No training examples with embeddings found.");
        } else {
            console.log(`\nFound ${result.rows.length} training examples. Sample data:`);
            console.table(result.rows.map(row => ({
                id: row.id,
                head: row.head,
                tail: row.tail,
                len: row.len,
                isDoubleQuoted: row.head.startsWith('""') || row.head.startsWith('"['),
            })));
        }

        // Check memory_entries too
        const memoryResult = await pool.query(`
      SELECT id, 
             left(embedding::text, 20) as head,
             length(embedding::text) as len
      FROM memory_entries
      WHERE embedding IS NOT NULL
      LIMIT 10;
    `);

        if (memoryResult.rows.length > 0) {
            console.log(`\nFound ${memoryResult.rows.length} memories. Sample data:`);
            console.table(memoryResult.rows.map(row => ({
                id: row.id,
                head: row.head,
                isDoubleQuoted: row.head.startsWith('""') || row.head.startsWith('"['),
            })));
        }

    } catch (error) {
        console.error("❌ Forensic check failed:", error);
    } finally {
        process.exit(0);
    }
}

main();
