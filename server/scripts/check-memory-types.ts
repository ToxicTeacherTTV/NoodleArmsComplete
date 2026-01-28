import { storage } from '../storage.js';
import { sql } from 'drizzle-orm';

async function checkMemoryTypes() {
  console.log('📊 Checking memory types in database...\n');

  // Get memory type counts
  const typeCounts = await storage.db.execute(sql`
    SELECT type, COUNT(*) as count
    FROM memory_entries
    GROUP BY type
    ORDER BY count DESC
  `);

  console.log('Memory Types:');
  console.log(typeCounts.rows);
  console.log('');

  // Get total memories and sources
  const totals = await storage.db.execute(sql`
    SELECT
      COUNT(*) as total_memories,
      COUNT(DISTINCT "sourceId") as unique_sources,
      COUNT(*) FILTER (WHERE lane = 'CANON') as canon_count,
      COUNT(*) FILTER (WHERE lane = 'RUMOR') as rumor_count
    FROM memory_entries
    WHERE "profileId" = '1'
  `);

  console.log('Totals:');
  console.log(totals.rows[0]);
  console.log('');

  // Check for existing STORY type memories
  const storyMemories = await storage.db.execute(sql`
    SELECT COUNT(*) as story_count
    FROM memory_entries
    WHERE type = 'STORY'
  `);

  console.log('STORY type memories:', storyMemories.rows[0]);
  console.log('');

  // Get source document counts
  const docs = await storage.db.execute(sql`
    SELECT name, COUNT(*) as count
    FROM documents
    WHERE "profileId" = '1'
    GROUP BY name
    LIMIT 20
  `);

  console.log('Source Documents:');
  console.log(docs.rows);
  console.log('');

  // Check podcast episodes
  const podcasts = await storage.db.execute(sql`
    SELECT COUNT(*) as episode_count
    FROM podcast_episodes
    WHERE "profileId" = '1'
  `);

  console.log('Podcast Episodes:', podcasts.rows[0]);
}

checkMemoryTypes().catch(console.error);
