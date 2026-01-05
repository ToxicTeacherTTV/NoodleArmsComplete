import { pool } from "../server/db.js";

async function findPoison() {
  console.log("🔍 Searching for sleep science poison...");
  
  const searchTerms = [
    '%Glymphatic System%',
    '%Matthew Walker%',
    '%Sleep is often viewed as a period of%',
    '%turning off%',
    '%biological maintenance%',
    '%beta-amyloid%',
    '%Circadian Rhythm%',
    '%Adenosine%',
    '%The Greatest Romance%',
    '%Self-Love is Your Ultimate Superpower%'
  ];

  const deleteMode = process.argv.includes('--delete');

  try {
    for (const term of searchTerms) {
      console.log(`\n--- Searching for: ${term} ---`);
      
      // Search memories
      const memories = await pool.query(
        "SELECT id, content, lane FROM memory_entries WHERE content ILIKE $1",
        [term]
      );
      if (memories.rows.length > 0) {
        console.log(`Found in memories: ${memories.rows.length} entries`);
        for (const r of memories.rows) {
          console.log(`[${r.id}] (${r.lane}): ${r.content.substring(0, 100)}...`);
          if (deleteMode) {
            await pool.query("DELETE FROM memory_entries WHERE id = $1", [r.id]);
            console.log(`  🗑️ Deleted memory ${r.id}`);
          }
        }
      }

      // Search documents (training examples)
      const docs = await pool.query(
        "SELECT id, name, extracted_content FROM documents WHERE extracted_content ILIKE $1 OR name ILIKE $1",
        [term]
      );
      if (docs.rows.length > 0) {
        console.log(`Found in documents: ${docs.rows.length} entries`);
        for (const r of docs.rows) {
          console.log(`[${r.id}] (${r.name}): ${r.extracted_content?.substring(0, 100)}...`);
          if (deleteMode) {
            await pool.query("DELETE FROM documents WHERE id = $1", [r.id]);
            console.log(`  🗑️ Deleted document ${r.id}`);
          }
        }
      }

      // Search messages
      const messages = await pool.query(
        "SELECT id, content FROM messages WHERE content ILIKE $1",
        [term]
      );
      if (messages.rows.length > 0) {
        console.log(`Found in messages: ${messages.rows.length} entries`);
        for (const r of messages.rows) {
          console.log(`[${r.id}]: ${r.content.substring(0, 100)}...`);
          if (deleteMode) {
            await pool.query("DELETE FROM messages WHERE id = $1", [r.id]);
            console.log(`  🗑️ Deleted message ${r.id}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error during search:", error);
  } finally {
    console.log("\n✅ Operation complete.");
    process.exit(0);
  }
}

findPoison().catch(err => {
  console.error("❌ Fatal Error:", err);
  process.exit(1);
});
