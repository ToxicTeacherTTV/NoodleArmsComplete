
import 'dotenv/config';
import { db } from '../db.js';
import { contentFlags, memoryEntries } from '../../shared/schema.js';
import { eq, isNull, sql } from 'drizzle-orm';

async function cleanupOrphanedFlags() {
  console.log('🧹 Starting cleanup of orphaned flags...');
  
  // First, count them
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(contentFlags)
    .leftJoin(memoryEntries, eq(contentFlags.targetId, memoryEntries.id))
    .where(isNull(memoryEntries.id));
    
  const count = Number(countResult[0].count);
  console.log(`🗑️ Found ${count} orphaned flags to delete.`);
  
  if (count === 0) {
    console.log('✅ No orphaned flags found.');
    process.exit(0);
  }

  // Delete them
  // Note: Drizzle doesn't support DELETE with JOIN directly in a simple way for all dialects,
  // but we can use a subquery approach or just raw SQL for safety and clarity.
  // Let's use a raw SQL query to be safe and efficient for Postgres.
  
  const deleteResult = await db.execute(sql`
    DELETE FROM content_flags 
    WHERE target_type = 'MEMORY' 
    AND target_id NOT IN (SELECT id FROM memory_entries)
  `);
  
  console.log(`✅ Cleanup complete. Deleted orphaned flags.`);
}

cleanupOrphanedFlags().catch(console.error).then(() => process.exit(0));
