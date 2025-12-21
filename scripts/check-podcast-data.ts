
import { db } from '../server/db';
import { podcastEpisodes, contentLibrary } from '../shared/schema';
import { count } from 'drizzle-orm';

async function checkPodcastData() {
  try {
    console.log('Checking podcast_episodes table...');
    const episodeCount = await db.select({ count: count() }).from(podcastEpisodes);
    console.log(`Total podcast episodes: ${episodeCount[0].count}`);

    console.log('Checking content_library table...');
    const contentCount = await db.select({ count: count() }).from(contentLibrary);
    console.log(`Total content library items: ${contentCount[0].count}`);
    
    // List the first few episodes if any
    if (episodeCount[0].count > 0) {
        const episodes = await db.select().from(podcastEpisodes).limit(5);
        console.log('First 5 episodes:', JSON.stringify(episodes, null, 2));
    }

  } catch (error) {
    console.error('Error checking database:', error);
  }
  process.exit(0);
}

checkPodcastData();
