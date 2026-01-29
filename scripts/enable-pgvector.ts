#!/usr/bin/env tsx
/**
 * Enable pgvector extension in the database
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function enablePgVector() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    console.log('🔌 Connecting to database...');

    // Enable pgvector extension
    console.log('📦 Enabling pgvector extension...');
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);

    console.log('✅ pgvector extension enabled successfully!');

    // Verify it's enabled
    const result = await db.execute(sql`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector';
    `);

    if (result.rows.length > 0) {
      console.log(`✅ pgvector version: ${result.rows[0].extversion}`);
    }

  } catch (error) {
    console.error('❌ Error enabling pgvector:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

enablePgVector();
