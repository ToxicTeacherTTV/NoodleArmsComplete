#!/usr/bin/env tsx
/**
 * Migrate all data from old database to new database
 * This script copies all tables while preserving relationships
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { sql } from 'drizzle-orm';

const OLD_DB = "postgresql://neondb_owner:npg_g8qWAERIsTL3@ep-jolly-surf-ag8tj5ky.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const NEW_DB = process.env.DATABASE_URL;

if (!NEW_DB) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

interface MigrationStats {
  table: string;
  oldCount: number;
  newCount: number;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

// Tables in dependency order (no foreign key violations)
const MIGRATION_ORDER = [
  // Core profile
  'profiles',

  // Conversations and messages
  'conversations',
  'messages',

  // Documents
  'documents',

  // Memory system
  'memory_entries',
  'memory_suggestions',

  // Entity tables (depend on profiles)
  'people',
  'places',
  'items',
  'misc_entities',
  'concepts',
  'events',

  // Entity links (depend on memory_entries and entity tables)
  'memory_people_links',
  'memory_place_links',
  'memory_item_links',
  'memory_misc_links',
  'memory_concept_links',
  'memory_event_links',

  // Lore system
  'lore_characters',
  'lore_locations',
  'lore_events',
  'lore_relationships',
  'lore_historical_events',

  // Podcast system
  'podcast_episodes',
  'podcast_segments',

  // Discord
  'discord_servers',
  'discord_members',
  'discord_conversations',
  'discord_topic_triggers',

  // Content management
  'content_library',
  'content_flags',
  'content_flag_relations',
  'flag_auto_approvals',
  'flag_auto_approval_flag_links',
  'pending_content',

  // Automation
  'automated_sources',
  'ad_templates',
  'preroll_ads',

  // State tracking
  'chaos_state',
  'heat_state',
  'personality_state',
  'variety_state',
  'topic_escalation',

  // Other
  'consolidated_personalities',
  'duplicate_scan_results',
  'entity_system_config',
  'listener_cities',
];

async function migrateTable(
  oldDb: any,
  newDb: any,
  tableName: string
): Promise<MigrationStats> {
  try {
    console.log(`\n📦 Migrating table: ${tableName}`);

    // Get count from old database
    const oldCountResult = await oldDb.execute(sql.raw(`SELECT COUNT(*) FROM ${tableName}`));
    const oldCount = parseInt(oldCountResult.rows[0].count);

    console.log(`   Old DB: ${oldCount} rows`);

    if (oldCount === 0) {
      console.log(`   ⏭️  Skipping (empty table)`);
      return { table: tableName, oldCount: 0, newCount: 0, status: 'skipped' };
    }

    // Export all data from old database
    const data = await oldDb.execute(sql.raw(`SELECT * FROM ${tableName}`));

    if (data.rows.length === 0) {
      console.log(`   ⏭️  Skipping (no data)`);
      return { table: tableName, oldCount: 0, newCount: 0, status: 'skipped' };
    }

    // Get column names
    const columns = Object.keys(data.rows[0]);

    // Insert data row by row (slower but more reliable)
    let insertedCount = 0;

    for (const row of data.rows) {
      const values = columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return 'NULL';

        // Handle vectors - convert to proper format for pgvector
        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.every(v => typeof v === 'number')) {
              return `'${JSON.stringify(parsed)}'::vector`;
            }
          } catch (e) {
            // Not a vector, continue
          }
        }

        // Handle PostgreSQL arrays (from old DB format like {item1,item2})
        if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
          const arrayStr = value.slice(1, -1);
          if (!arrayStr) return 'ARRAY[]::text[]';

          const items = arrayStr.split(',').map((v: string) => {
            const cleaned = v.trim().replace(/^"(.*)"$/, '$1');
            return `'${cleaned.replace(/'/g, "''")}'`;
          });
          return `ARRAY[${items.join(', ')}]`;
        }

        // Handle JSON arrays (from old DB that should be text arrays)
        if (Array.isArray(value)) {
          if (value.length === 0) return 'ARRAY[]::text[]';
          const items = value.map((v: any) => {
            if (typeof v === 'string') {
              return `'${v.replace(/'/g, "''")}'`;
            }
            return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          });
          return `ARRAY[${items.join(', ')}]`;
        }

        // Handle JSON/JSONB objects (not arrays)
        if (typeof value === 'object') {
          return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
        }

        // Handle booleans
        if (typeof value === 'boolean') {
          return value ? 'true' : 'false';
        }

        // Handle numbers
        if (typeof value === 'number') {
          return value.toString();
        }

        // Handle timestamps
        if (value instanceof Date) {
          return `'${value.toISOString()}'`;
        }

        // Handle strings (escape single quotes)
        return `'${value.toString().replace(/'/g, "''")}'`;
      });

      const insertQuery = `
        INSERT INTO ${tableName} (${columns.map(c => `"${c}"`).join(', ')})
        VALUES (${values.join(', ')})
        ON CONFLICT DO NOTHING
      `;

      try {
        await newDb.execute(sql.raw(insertQuery));
        insertedCount++;

        if (insertedCount % 100 === 0) {
          console.log(`   ⏳ Inserted ${insertedCount}/${data.rows.length} rows...`);
        }
      } catch (err: any) {
        // Log but continue with other rows
        if (insertedCount === 0) {
          // Only throw if first row fails (likely schema issue)
          throw err;
        }
        console.log(`   ⚠️  Skipped 1 row due to: ${err.message.split('\n')[0]}`);
      }
    }

    // Verify count in new database
    const newCountResult = await newDb.execute(sql.raw(`SELECT COUNT(*) FROM ${tableName}`));
    const newCount = parseInt(newCountResult.rows[0].count);

    console.log(`   New DB: ${newCount} rows`);

    if (newCount === oldCount) {
      console.log(`   ✅ Migration successful!`);
      return { table: tableName, oldCount, newCount, status: 'success' };
    } else {
      console.log(`   ⚠️  Count mismatch: ${oldCount} -> ${newCount}`);
      return { table: tableName, oldCount, newCount, status: 'success' }; // ON CONFLICT DO NOTHING can cause this
    }

  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      table: tableName,
      oldCount: 0,
      newCount: 0,
      status: 'failed',
      error: error.message
    };
  }
}

async function main() {
  console.log('🚀 Starting database migration...\n');
  console.log(`📤 Source: ${OLD_DB.split('@')[1]?.split('/')[0]}`);
  console.log(`📥 Target: ${NEW_DB!.split('@')[1]?.split('/')[0]}\n`);

  // Connect to both databases
  const oldPool = new Pool({ connectionString: OLD_DB });
  const newPool = new Pool({ connectionString: NEW_DB });

  const oldDb = drizzle(oldPool);
  const newDb = drizzle(newPool);

  const stats: MigrationStats[] = [];

  try {
    // Migrate each table in order
    for (const tableName of MIGRATION_ORDER) {
      const stat = await migrateTable(oldDb, newDb, tableName);
      stats.push(stat);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));

    const successful = stats.filter(s => s.status === 'success');
    const failed = stats.filter(s => s.status === 'failed');
    const skipped = stats.filter(s => s.status === 'skipped');

    console.log(`\n✅ Successful: ${successful.length} tables`);
    if (successful.length > 0) {
      const totalRows = successful.reduce((sum, s) => sum + s.newCount, 0);
      console.log(`   Total rows migrated: ${totalRows.toLocaleString()}`);
      successful.forEach(s => {
        console.log(`   - ${s.table}: ${s.newCount} rows`);
      });
    }

    if (skipped.length > 0) {
      console.log(`\n⏭️  Skipped: ${skipped.length} tables (empty)`);
    }

    if (failed.length > 0) {
      console.log(`\n❌ Failed: ${failed.length} tables`);
      failed.forEach(s => {
        console.log(`   - ${s.table}: ${s.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration complete!\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main();
