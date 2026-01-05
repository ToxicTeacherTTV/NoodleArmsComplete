import 'dotenv/config';
import { storage } from './server/storage.js';
import { sql } from 'drizzle-orm';

async function search() {
  console.log('Searching for "solar panel" in database...');
  
  const docs = await storage.db.execute(
    sql`SELECT id, filename, extracted_content FROM documents WHERE extracted_content ILIKE '%solar panel%'`
  );
  console.log('Documents:', docs.rows);

  const memories = await storage.db.execute(
    sql`SELECT id, content FROM memory_entries WHERE content ILIKE '%solar panel%'`
  );
  console.log('Memories:', memories.rows);
}

search().catch(console.error);
