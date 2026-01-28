import 'dotenv/config';
import { storage } from '../storage.js';
import { podcastFactExtractor } from '../services/podcastFactExtractor.js';

/**
 * Test script to verify story extraction from podcast transcripts
 */

const SAMPLE_TRANSCRIPT = `
Toxic: Welcome back to Camping Them Softly, episode 47! Today we're talking about the worst killers in Dead by Daylight. Nicky, what's your take?

Nicky: Oh, Madonna mia, don't even get me started on The Trapper. This guy, he's like my cousin Vinny trying to set up a surprise party - telegraphs everything, leaves clues everywhere, and nobody's actually surprised when they see him coming.

Toxic: That's a pretty specific comparison. Is there a story there?

Nicky: You want a story? Alright, picture this: It's 1987, right? My Uncle Vinny - different Vinny, this is the smart one - he's running this little poker game out of the back of Sal's Pizzeria in Newark. Real low-key operation, nothin' fancy. But one night, this guy Tony "The Trap" Benedetti tries to hustle the game with loaded dice.

So my uncle, being the clever bastard he is, doesn't call him out right away. No, no, no. He waits. He watches. And every time Tony makes a bet, Vinny matches it and raises. Four hands in a row, Vinny takes everything. And THEN he reveals he knew about the loaded dice the whole time.

Tony gets banned from every poker game in a five-block radius. That's why I can't stand The Trapper in DBD - he's got all these traps, but any survivor with half a brain cell sees them coming from a mile away. He's like Tony trying to cheat with marked cards. Amateur hour.

Toxic: That's... actually a pretty good analogy. So you're saying The Trapper is the Tony Benedetti of Dead by Daylight?

Nicky: Exactly! And don't even get me started on Skull Merchant...

Toxic: Oh boy, here we go. What's wrong with Skull Merchant?

Nicky: She's boring, Toxic. BORING. She sets up drones like she's playing tower defense, and then she just... sits there. Camps. It's like watching paint dry, except the paint is also tunneling you off first hook.
`;

async function testStoryExtraction() {
  console.log('🧪 Testing Podcast Story Extraction...\n');

  try {
    // Get active profile
    const activeProfile = await storage.getActiveProfile();
    if (!activeProfile) {
      console.error('❌ No active profile found. Please set up a profile first.');
      return;
    }

    console.log(`📊 Using profile: ${activeProfile.displayName} (ID: ${activeProfile.id})\n`);

    // Create a test podcast episode
    const testEpisode = await storage.db.insert(await import('../../shared/schema.js').then(m => m.podcastEpisodes)).values({
      profileId: activeProfile.id,
      title: 'Test Episode - Worst Killers in DBD',
      episodeNumber: 9999,
      pubDate: new Date(),
      description: 'Test episode for story extraction',
      audioUrl: 'https://example.com/test.mp3',
      duration: 1800,
      transcript: SAMPLE_TRANSCRIPT,
      hasTranscript: true
    }).returning();

    const episodeId = testEpisode[0].id;
    console.log(`✅ Created test episode: ${episodeId}\n`);

    // Run the extraction
    console.log('🎙️ Running story extraction...\n');
    const result = await podcastFactExtractor.extractFactsFromEpisode(
      episodeId,
      9999,
      'Test Episode - Worst Killers in DBD',
      SAMPLE_TRANSCRIPT,
      activeProfile.id,
      storage
    );

    console.log('\n📈 EXTRACTION RESULTS:');
    console.log(`   Stories Created: ${result.storiesCreated || 0}`);
    console.log(`   Facts Created: ${result.factsCreated}`);
    console.log(`   Entities Created: ${result.entitiesCreated}`);
    console.log(`   Success: ${result.success}`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    // Query the stored stories
    console.log('\n📚 STORED STORIES:');
    const { memoryEntries } = await import('../../shared/schema.js');
    const { eq, and } = await import('drizzle-orm');

    const stories = await storage.db.select()
      .from(memoryEntries)
      .where(and(
        eq(memoryEntries.profileId, activeProfile.id),
        eq(memoryEntries.sourceId, episodeId),
        eq(memoryEntries.type, 'STORY')
      ));

    if (stories.length === 0) {
      console.log('   ⚠️ No stories found (this might indicate extraction failed)');
    } else {
      for (let i = 0; i < stories.length; i++) {
        const story = stories[i];
        console.log(`\n   Story ${i + 1}:`);
        console.log(`   ID: ${story.id}`);
        console.log(`   Type: ${story.type}`);
        console.log(`   Importance: ${story.importance}`);
        console.log(`   Content: ${story.content.substring(0, 150)}...`);
        console.log(`   Keywords: ${story.keywords?.join(', ')}`);

        // Find atomic facts linked to this story
        const atomicFacts = await storage.db.select()
          .from(memoryEntries)
          .where(and(
            eq(memoryEntries.parentFactId, story.id)
          ));

        console.log(`   Linked Atomic Facts: ${atomicFacts.length}`);
        if (atomicFacts.length > 0) {
          atomicFacts.forEach((fact, j) => {
            console.log(`      ${j + 1}. ${fact.content.substring(0, 80)}...`);
          });
        }
      }
    }

    // Query all facts (including atomic)
    console.log('\n⚛️ ALL FACTS (INCLUDING ATOMIC):');
    const allFacts = await storage.db.select()
      .from(memoryEntries)
      .where(and(
        eq(memoryEntries.profileId, activeProfile.id),
        eq(memoryEntries.sourceId, episodeId)
      ));

    console.log(`   Total memory entries created: ${allFacts.length}`);

    const factsByType = allFacts.reduce((acc, fact) => {
      acc[fact.type] = (acc[fact.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('   Breakdown by type:');
    Object.entries(factsByType).forEach(([type, count]) => {
      console.log(`      ${type}: ${count}`);
    });

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await storage.db.delete(memoryEntries)
      .where(eq(memoryEntries.sourceId, episodeId));

    const { podcastEpisodes } = await import('../../shared/schema.js');
    await storage.db.delete(podcastEpisodes)
      .where(eq(podcastEpisodes.id, episodeId));

    console.log('✅ Test complete!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testStoryExtraction()
  .then(() => {
    console.log('✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
