import { db } from '../db.js';
import {
  contentFlagRelations,
  documents,
  duplicateScanResults,
  flagAutoApprovalFlagLinks,
  memoryEventLinks,
  memoryPeopleLinks,
  memoryPlaceLinks,
} from '../../shared/schema.js';
import { eq, sql, inArray } from 'drizzle-orm';
import { generateCanonicalKey } from '../utils/canonical.js';
import crypto from 'crypto';

async function backfillCanonicalKeys() {
  const rows = await db.execute<{ id: string; content: string | null }>(
    sql`SELECT id, content FROM memory_entries WHERE canonical_key IS NULL OR canonical_key = ''`
  );

  if (rows.length === 0) {
    console.log('✅ All memory entries already have canonical keys.');
    return;
  }

  for (const row of rows) {
    const fallback = row.content && row.content.trim().length > 0 ? row.content : row.id;
    const canonicalKey = generateCanonicalKey(fallback);
    await db.execute(sql`UPDATE memory_entries SET canonical_key = ${canonicalKey} WHERE id = ${row.id}`);
  }

  console.log(`🔧 Backfilled canonical keys for ${rows.length} memory entries.`);
}

async function backfillLegacyEntityColumns() {
  const rows = await db.execute<{
    id: string;
    person_id: string | null;
    place_id: string | null;
    event_id: string | null;
  }>(
    sql`SELECT id, person_id, place_id, event_id FROM memory_entries WHERE person_id IS NOT NULL OR place_id IS NOT NULL OR event_id IS NOT NULL`
  );

  if (rows.length === 0) {
    console.log('✅ No legacy entity columns found to migrate.');
    return;
  }

  for (const row of rows) {
    if (row.person_id) {
      await db
        .insert(memoryPeopleLinks)
        .values({ memoryId: row.id, personId: row.person_id })
        .onConflictDoNothing();
    }
    if (row.place_id) {
      await db
        .insert(memoryPlaceLinks)
        .values({ memoryId: row.id, placeId: row.place_id })
        .onConflictDoNothing();
    }
    if (row.event_id) {
      await db
        .insert(memoryEventLinks)
        .values({ memoryId: row.id, eventId: row.event_id })
        .onConflictDoNothing();
    }
  }

  console.log(`🔗 Migrated legacy entity references for ${rows.length} memories into junction tables.`);
}

async function backfillContentFlagRelations() {
  const rows = await db.execute<{ id: string; related_flags: string[] | null }>(
    sql`SELECT id, related_flags FROM content_flags WHERE related_flags IS NOT NULL AND array_length(related_flags, 1) > 0`
  );

  if (rows.length === 0) {
    console.log('✅ No legacy content flag relations found.');
    return;
  }

  let inserted = 0;
  for (const row of rows) {
    const related = row.related_flags ?? [];
    for (const relatedId of related) {
      if (!relatedId || relatedId.trim().length === 0) continue;
      await db
        .insert(contentFlagRelations)
        .values({ flagId: row.id, relatedFlagId: relatedId })
        .onConflictDoNothing();
      inserted += 1;
    }
  }

  console.log(`🚩 Backfilled ${inserted} content flag relationships.`);
}

async function backfillAutoApprovalLinks() {
  const rows = await db.execute<{ id: string; flag_ids: string[] | null }>(
    sql`SELECT id, flag_ids FROM flag_auto_approvals WHERE flag_ids IS NOT NULL AND array_length(flag_ids, 1) > 0`
  );

  if (rows.length === 0) {
    console.log('✅ No legacy auto-approval flag links found.');
    return;
  }

  let inserted = 0;
  for (const row of rows) {
    const ids = row.flag_ids ?? [];
    for (const flagId of ids) {
      if (!flagId || flagId.trim().length === 0) continue;
      await db
        .insert(flagAutoApprovalFlagLinks)
        .values({ autoApprovalId: row.id, flagId })
        .onConflictDoNothing();
      inserted += 1;
    }
  }

  console.log(`🤖 Backfilled ${inserted} auto-approval flag links.`);
}

async function backfillDocumentHashes() {
  const rows = await db.execute<{
    id: string;
    extracted_content: string | null;
    chunks: string[] | null;
    name: string | null;
  }>(
    sql`SELECT id, extracted_content, chunks, name FROM documents WHERE content_hash IS NULL`
  );

  if (rows.length === 0) {
    console.log('✅ All documents already have content hashes.');
    return;
  }

  for (const row of rows) {
    let basis = row.extracted_content ?? '';
    if (!basis && Array.isArray(row.chunks) && row.chunks.length > 0) {
      basis = row.chunks.join('\n');
    }
    if (!basis && row.name) {
      basis = row.name;
    }
    if (!basis) {
      basis = row.id;
    }

    const hash = crypto.createHash('sha256').update(basis).digest('hex');
    await db.update(documents).set({ contentHash: hash }).where(eq(documents.id, row.id));
  }

  console.log(`📄 Backfilled content hashes for ${rows.length} documents.`);
}

async function archiveDuplicateScanCollisions() {
  const collisions = await db.execute<{
    profile_id: string;
    scan_depth: number;
    similarity_threshold: number;
    ids: string[];
  }>(sql`
    SELECT profile_id, scan_depth, similarity_threshold,
           ARRAY_AGG(id ORDER BY updated_at DESC) AS ids
    FROM duplicate_scan_results
    WHERE status = 'ACTIVE'
    GROUP BY profile_id, scan_depth, similarity_threshold
    HAVING COUNT(*) > 1
  `);

  if (collisions.length === 0) {
    console.log('✅ No duplicate active scan results detected.');
    return;
  }

  for (const row of collisions) {
    const rest = row.ids.slice(1);
    if (rest.length === 0) continue;
    await db
      .update(duplicateScanResults)
      .set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(inArray(duplicateScanResults.id, rest));
    console.log(`🗂️ Archived ${rest.length} duplicate scan records for profile ${row.profile_id}.`);
  }
}

async function main() {
  try {
    await backfillCanonicalKeys();
    await backfillLegacyEntityColumns();
    await backfillContentFlagRelations();
    await backfillAutoApprovalLinks();
    await backfillDocumentHashes();
    await archiveDuplicateScanCollisions();
  } catch (error) {
    console.error('❌ Backfill failed:', error);
  } finally {
    process.exit(0);
  }
}

main();
