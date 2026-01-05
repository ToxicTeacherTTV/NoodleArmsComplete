import { pool } from "../server/db.js";

async function checkConversation() {
  const conversationId = '3d47d1d6-a48e-4854-b39d-ddd3f9227c3e';
  console.log(`🔍 Checking conversation ${conversationId}...`);
  
  const res = await pool.query(
    "SELECT id, type, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at",
    [conversationId]
  );
  
  console.log(`Found ${res.rows.length} messages:`);
  res.rows.forEach(r => {
    console.log(`\n[${r.type}] (${r.created_at}):`);
    console.log(r.content);
  });
  
  process.exit(0);
}

checkConversation().catch(err => {
  console.error(err);
  process.exit(1);
});
