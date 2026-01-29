#!/usr/bin/env tsx
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { sql } from 'drizzle-orm';

const NEW_DB = process.env.DATABASE_URL;
const TABLES = ['profiles', 'conversations', 'messages', 'documents', 'memory_entries', 'people', 'places', 'items', 'misc_entities', 'concepts', 'events', 'lore_characters', 'lore_locations', 'podcast_episodes', 'discord_servers'];

async function check() {
  const pool = new Pool({ connectionString: NEW_DB });
  const db = drizzle(pool);

  console.log('📊 New Database Contents:\n');
  console.log('Table                        Rows');
  console.log('─'.repeat(40));
  
  let total = 0;
  for (const table of TABLES) {
    const res = await db.execute(sql.raw(`SELECT COUNT(*) FROM ${table}`));
    const cnt = parseInt(res.rows[0].count);
    total += cnt;
    const emoji = cnt > 0 ? '✅' : '  ';
    console.log(`${emoji} ${table.padEnd(24)} ${cnt.toLocaleString().padStart(8)}`);
  }
  
  console.log('─'.repeat(40));
  console.log(`   ${'TOTAL'.padEnd(24)} ${total.toLocaleString().padStart(8)}`);
  
  await pool.end();
}

check();
