#!/usr/bin/env tsx
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

const tables = [
  'profiles', 'conversations', 'messages', 'documents',
  'memory_entries', 'people', 'places', 'items'
];

console.log('\n📊 Current Migration Status:\n');

for (const table of tables) {
  try {
    const result = await db.execute(sql.raw(`SELECT COUNT(*) FROM ${table}`));
    const count = parseInt(result.rows[0].count);
    console.log(`   ${table.padEnd(20)} ${count.toLocaleString().padStart(8)} rows`);
  } catch (err: any) {
    console.log(`   ${table.padEnd(20)} ERROR`);
  }
}

await pool.end();
