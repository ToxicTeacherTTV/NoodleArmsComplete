#!/usr/bin/env tsx
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { sql } from 'drizzle-orm';

const OLD_DB = 'postgresql://neondb_owner:npg_4wXg7yT2P8Of@ep-jolly-surf-ag8tj5ky.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const NEW_DB = process.env.DATABASE_URL;

const TABLES = ['profiles', 'conversations', 'messages', 'documents', 'memory_entries', 'people', 'places', 'items', 'lore_characters', 'podcast_episodes'];

async function verify() {
  const oldPool = new Pool({ connectionString: OLD_DB });
  const newPool = new Pool({ connectionString: NEW_DB });
  const oldDb = drizzle(oldPool);
  const newDb = drizzle(newPool);

  console.log('Table                  Old     New   Status');
  console.log('─'.repeat(50));
  
  for (const table of TABLES) {
    const oldRes = await oldDb.execute(sql.raw(`SELECT COUNT(*) FROM ${table}`));
    const newRes = await newDb.execute(sql.raw(`SELECT COUNT(*) FROM ${table}`));
    const oldCnt = parseInt(oldRes.rows[0].count);
    const newCnt = parseInt(newRes.rows[0].count);
    const status = oldCnt === newCnt ? '✅' : newCnt > 0 ? '⚠️' : '❌';
    console.log(`${table.padEnd(20)} ${oldCnt.toString().padStart(6)} ${newCnt.toString().padStart(6)}  ${status}`);
  }
  
  await oldPool.end();
  await newPool.end();
}

verify();
