
import 'dotenv/config';
import { db } from '../db.js';
import { contentFlags, memoryEntries } from '../../shared/schema.js';
import { eq, isNull, sql } from 'drizzle-orm';

async function checkOrphanedFlags() {
  console.log('🔍 Checking for orphaned flags...');
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(contentFlags)
    .leftJoin(memoryEntries, eq(contentFlags.targetId, memoryEntries.id))
    .where(isNull(memoryEntries.id));
    
  console.log(`🗑️ Found ${result[0].count} orphaned flags (target memory no longer exists).`);
}

checkOrphanedFlags().catch(console.error).then(() => process.exit(0));
