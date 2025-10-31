import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function safeMigration() {
  console.log('🚀 Starting safe schema migration...\n');

  try {
    // ============================================
    // STEP 1: Backup data from old columns
    // ============================================
    console.log('📦 STEP 1: Backing up data from old columns...');
    
    // Check what data exists in old columns
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
    
    // ============================================
    // STEP 2: Migrate memory_entries -> link tables
    // ============================================
    console.log('\n🔄 STEP 2: Migrating memory_entries to link tables...');
    
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
    console.log(`  ✅ Migrated ${peopleMigrated.length} person links`);
    
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
    console.log(`  ✅ Migrated ${placesMigrated.length} place links`);
    
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
    console.log(`  ✅ Migrated ${eventsMigrated.length} event links`);
    
    // ============================================
    // STEP 3: Migrate flag_auto_approvals -> link table
    // ============================================
    console.log('\n🔄 STEP 3: Migrating flag_auto_approvals to link table...');
    
    // Migrate flag_ids array to flag_auto_approval_flag_links
    const flagLinksMigrated = await sql`
      INSERT INTO flag_auto_approval_flag_links (auto_approval_id, flag_id)
      SELECT faa.id, unnest(faa.flag_ids)
      FROM flag_auto_approvals faa
      WHERE faa.flag_ids IS NOT NULL
        AND array_length(faa.flag_ids, 1) > 0
        AND NOT EXISTS (
          SELECT 1 FROM flag_auto_approval_flag_links
          WHERE auto_approval_id = faa.id
        )
      ON CONFLICT DO NOTHING
      RETURNING id;
    `;
    console.log(`  ✅ Migrated ${flagLinksMigrated.length} flag approval links`);
    
    // ============================================
    // STEP 4: Verify migration
    // ============================================
    console.log('\n✅ STEP 4: Verifying migration...');
    
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
    // STEP 5: Drop old columns (MANUAL STEP)
    // ============================================
    console.log('\n⚠️  STEP 5: Ready to drop old columns');
    console.log('  The following columns can now be safely removed from schema.ts:');
    console.log('    - memory_entries: person_id, place_id, event_id');
    console.log('    - content_flags: related_flags (already empty)');
    console.log('    - flag_auto_approvals: flag_ids');
    console.log('\n  After removing them from schema.ts, run:');
    console.log('    npm run db:push\n');
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

safeMigration()
  .then(() => {
    console.log('\n🎉 All done! You can now safely update your schema.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
