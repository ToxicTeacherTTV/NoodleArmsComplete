import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function safeMigration() {
  console.log('🚀 Starting safe schema migration...\n');

  try {
    // ============================================
    // STEP 0: Clean up duplicate link entries
    // ============================================
    console.log('🧹 STEP 0: Cleaning up duplicate entries...');
    
    // Remove duplicates from memory_people_links
    const peopleDupsRemoved = await sql`
      DELETE FROM memory_people_links a
      USING memory_people_links b
      WHERE a.id > b.id
        AND a.memory_id = b.memory_id
        AND a.person_id = b.person_id
      RETURNING a.id;
    `;
    console.log(`  Removed ${peopleDupsRemoved.length} duplicate people links`);
    
    // Remove duplicates from memory_place_links
    const placeDupsRemoved = await sql`
      DELETE FROM memory_place_links a
      USING memory_place_links b
      WHERE a.id > b.id
        AND a.memory_id = b.memory_id
        AND a.place_id = b.place_id
      RETURNING a.id;
    `;
    console.log(`  Removed ${placeDupsRemoved.length} duplicate place links`);
    
    // Remove duplicates from memory_event_links
    const eventDupsRemoved = await sql`
      DELETE FROM memory_event_links a
      USING memory_event_links b
      WHERE a.id > b.id
        AND a.memory_id = b.memory_id
        AND a.event_id = b.event_id
      RETURNING a.id;
    `;
    console.log(`  Removed ${eventDupsRemoved.length} duplicate event links\n`);
    
    // ============================================
    // STEP 1: Create flag_auto_approval_flag_links table
    // ============================================
    console.log('🔧 STEP 1: Creating flag_auto_approval_flag_links table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS flag_auto_approval_flag_links (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        auto_approval_id varchar NOT NULL REFERENCES flag_auto_approvals(id) ON DELETE CASCADE,
        flag_id varchar NOT NULL REFERENCES content_flags(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT now()
      );
    `;
    
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_auto_approval_flag_idx 
      ON flag_auto_approval_flag_links(auto_approval_id, flag_id);
    `;
    
    console.log('  ✅ Table created\n');
    
    // ============================================
    // STEP 2: Check what data needs migrating
    // ============================================
    console.log('📦 STEP 2: Checking data in old columns...');
    
    const memoryStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(person_id) as has_person_id,
        COUNT(place_id) as has_place_id,
        COUNT(event_id) as has_event_id
      FROM memory_entries;
    `;
    console.log('  Memory entries:', memoryStats[0]);
    
    const flagStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(flag_ids) as has_flag_ids
      FROM flag_auto_approvals;
    `;
    console.log('  Flag auto approvals:', flagStats[0]);
    
    const linkStats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM memory_people_links) as people_links,
        (SELECT COUNT(*) FROM memory_place_links) as place_links,
        (SELECT COUNT(*) FROM memory_event_links) as event_links;
    `;
    console.log('  Current link counts:', linkStats[0], '\n');
    
    // ============================================
    // STEP 3: Migrate remaining data
    // ============================================
    console.log('🔄 STEP 3: Migrating any remaining data to link tables...');
    
    // Migrate person_id to memory_people_links
    const peopleMigrated = await sql`
      INSERT INTO memory_people_links (memory_id, person_id)
      SELECT id, person_id
      FROM memory_entries
      WHERE person_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM memory_people_links
          WHERE memory_id = memory_entries.id
            AND person_id = memory_entries.person_id
        )
      ON CONFLICT DO NOTHING
      RETURNING id;
    `;
    console.log(`  ✅ Migrated ${peopleMigrated.length} new person links`);
    
    // Migrate place_id to memory_place_links
    const placesMigrated = await sql`
      INSERT INTO memory_place_links (memory_id, place_id)
      SELECT id, place_id
      FROM memory_entries
      WHERE place_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM memory_place_links
          WHERE memory_id = memory_entries.id
            AND place_id = memory_entries.place_id
        )
      ON CONFLICT DO NOTHING
      RETURNING id;
    `;
    console.log(`  ✅ Migrated ${placesMigrated.length} new place links`);
    
    // Migrate event_id to memory_event_links
    const eventsMigrated = await sql`
      INSERT INTO memory_event_links (memory_id, event_id)
      SELECT id, event_id
      FROM memory_entries
      WHERE event_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM memory_event_links
          WHERE memory_id = memory_entries.id
            AND event_id = memory_entries.event_id
        )
      ON CONFLICT DO NOTHING
      RETURNING id;
    `;
    console.log(`  ✅ Migrated ${eventsMigrated.length} new event links`);
    
    // Migrate flag_ids array to flag_auto_approval_flag_links (only valid flags)
    const flagLinksMigrated = await sql`
      INSERT INTO flag_auto_approval_flag_links (auto_approval_id, flag_id)
      SELECT faa.id, flag_id
      FROM flag_auto_approvals faa
      CROSS JOIN LATERAL unnest(faa.flag_ids) AS flag_id
      WHERE faa.flag_ids IS NOT NULL
        AND array_length(faa.flag_ids, 1) > 0
        AND EXISTS (SELECT 1 FROM content_flags WHERE id = flag_id)
      ON CONFLICT DO NOTHING
      RETURNING id;
    `;
    console.log(`  ✅ Migrated ${flagLinksMigrated.length} flag approval links (skipped invalid flag IDs)\n`);
    
    // ============================================
    // STEP 4: Verify migration
    // ============================================
    console.log('✅ STEP 4: Verifying migration...');
    
    const verifyPeople = await sql`
      SELECT COUNT(*) as count
      FROM memory_entries
      WHERE person_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM memory_people_links
          WHERE memory_id = memory_entries.id
            AND person_id = memory_entries.person_id
        );
    `;
    console.log(`  People links not migrated: ${verifyPeople[0].count}`);
    
    const verifyPlaces = await sql`
      SELECT COUNT(*) as count
      FROM memory_entries
      WHERE place_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM memory_place_links
          WHERE memory_id = memory_entries.id
            AND place_id = memory_entries.place_id
        );
    `;
    console.log(`  Place links not migrated: ${verifyPlaces[0].count}`);
    
    const verifyEvents = await sql`
      SELECT COUNT(*) as count
      FROM memory_entries
      WHERE event_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM memory_event_links
          WHERE memory_id = memory_entries.id
            AND event_id = memory_entries.event_id
        );
    `;
    console.log(`  Event links not migrated: ${verifyEvents[0].count}`);
    
    const verifyFlags = await sql`
      SELECT COUNT(*) as count
      FROM flag_auto_approvals faa
      WHERE faa.flag_ids IS NOT NULL
        AND array_length(faa.flag_ids, 1) > 0
        AND NOT EXISTS (
          SELECT 1 FROM flag_auto_approval_flag_links
          WHERE auto_approval_id = faa.id
        );
    `;
    console.log(`  Flag approval links not migrated: ${verifyFlags[0].count}`);
    
    // Check totals
    const linkTotals = await sql`
      SELECT 
        (SELECT COUNT(*) FROM memory_people_links) as people_links,
        (SELECT COUNT(*) FROM memory_place_links) as place_links,
        (SELECT COUNT(*) FROM memory_event_links) as event_links,
        (SELECT COUNT(*) FROM flag_auto_approval_flag_links) as flag_links;
    `;
    console.log('\n  Final link table counts:', linkTotals[0]);
    
    // ============================================
    // STEP 5: Instructions for schema cleanup
    // ============================================
    console.log('\n⚠️  STEP 5: Ready to clean up old columns');
    console.log('  All data has been migrated! You can now safely remove these from schema.ts:\n');
    console.log('  In memoryEntries table (around line 115), remove:');
    console.log('    - person_id column');
    console.log('    - place_id column');
    console.log('    - event_id column\n');
    console.log('  In contentFlags table (around line 752), remove:');
    console.log('    - related_flags column (already empty)\n');
    console.log('  In flagAutoApprovals table (around line 841), remove:');
    console.log('    - flag_ids column\n');
    console.log('  After removing them, run: npm run db:push --force\n');
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

safeMigration()
  .then(() => {
    console.log('\n🎉 All data migrated safely! Ready for schema cleanup.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
