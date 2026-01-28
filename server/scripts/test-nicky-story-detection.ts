/**
 * 🧪 Test Script: Nicky Story Detection (Phase 2)
 *
 * Verifies that stories Nicky tells in responses are preserved as complete
 * narratives instead of being atomized immediately.
 */

import { storage } from '../storage.js';
import { LoreOrchestrator } from '../services/LoreOrchestrator.js';
import { sql } from 'drizzle-orm';

// Test conversation with Nicky telling stories
const TEST_CONVERSATIONS = [
  {
    name: "Uncle Vinny Poker Story (CANON - Low Heat)",
    speaker: 'nicky' as const,
    sauceMeter: 30, // Low heat = CANON
    content: `[strong bronx wiseguy accent] Oh, you wanna hear about Uncle Vinny? Let me tell ya about Uncle Vinny. Back in 1987, right? Uncle Vinny was runnin' a poker game outta Sal's Pizzeria in Newark. Every Friday night, the boys would come in through the back door - Paulie, Big Tommy, Joey Knuckles, the whole crew.

So one night, this mook shows up. Tony "The Trap" Benedetti. Everyone knew he was a cheat, but nobody could prove it. He sits down at the table with these dice that looked a little TOO perfect, you know what I'm sayin'? Vinny's watchin' him like a hawk.

Three hands in, The Trap rolls snake eyes twice in a row. Vinny slams his hand on the table, grabs the dice, and drops 'em in a glass of water. Sure enough, they float lopsided - loaded dice! Vinny banned him from every poker game in a five-block radius. The Trap tried to come back six months later and Vinny chased him out with a pizza peel!

That's Uncle Vinny for ya. You don't mess with the family games.`,
    expectedStory: true,
    expectedLane: 'CANON'
  },
  {
    name: "Ghost Pigs Story (RUMOR - High Heat)",
    speaker: 'nicky' as const,
    sauceMeter: 85, // High heat = RUMOR
    content: `[screaming] YOU DON'T UNDERSTAND WHAT I'VE BEEN THROUGH! [panting heavily] Let me tell you about the Ghost Pigs. This ain't no joke, Teach! Back in Denmark, right? I crossed the streams with an eel during a soul-trading ritual. I CROSSED THE STREAMS!

So Jens - that's the turtleneck Satan - he sold my debt to the Ghost Pigs! These spectral swine, they smell like bacon and brimstone, and they're repo men for your SOUL! Little Lars the Gnome, he's a four-foot-two Danish broker, he told me the only way to call 'em off is to find the Exiled One. The one Gnome they kicked out for being too extreme!

[paranoid whispering] They're huntin' me, Teach. Every night I hear the squealing. The rhythmic squealing of Ghost Pigs foreclosing on a mortgage in D-minor! [yelling] DO YOU KNOW WHAT THAT SOUNDS LIKE?!`,
    expectedStory: true,
    expectedLane: 'RUMOR'
  },
  {
    name: "Short Response (Not a Story)",
    speaker: 'nicky' as const,
    sauceMeter: 40,
    content: `[muttering] Yeah, whatever Teach. Just play the music and let's move on.`,
    expectedStory: false,
    expectedLane: null
  },
  {
    name: "Opinion Rant (Not a Story)",
    speaker: 'nicky' as const,
    sauceMeter: 60,
    content: `[yelling] YOU CALL THAT A BUILD?! That's the worst loadout I've ever seen! No Dead Hard, no Borrowed Time, nothin'! You're gonna get hooked in the first 30 seconds!`,
    expectedStory: false,
    expectedLane: null
  }
];

async function runTest() {
  console.log('🧪 Starting Nicky Story Detection Test (Phase 2)\n');
  console.log('=' .repeat(80));

  const loreOrchestrator = LoreOrchestrator.getInstance();
  const testProfileId = 'test-nicky-story-detection-' + Date.now();

  let testsPassed = 0;
  let testsFailed = 0;

  for (const test of TEST_CONVERSATIONS) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`🌶️  Sauce Meter: ${test.sauceMeter}/100`);
    console.log(`📏 Length: ${test.content.length} chars`);
    console.log(`─`.repeat(80));

    try {
      // Set sauce meter for the test (would normally be set by ChaosEngine)
      // Note: In real usage, ChaosEngine sets this, but for testing we simulate it

      // Process the content
      const result = await loreOrchestrator.processNewContent(
        test.content,
        testProfileId,
        'test-conversation',
        'CONVERSATION',
        'test-conv-id',
        {
          allowWrites: true,
          speaker: test.speaker,
          speakerName: 'Nicky',
          speakerId: testProfileId
        }
      );

      console.log(`\n📊 Processing Result:`);
      console.log(`   New Facts: ${result.newFacts}`);
      console.log(`   Updated Entities: ${result.updatedEntities}`);
      console.log(`   Summary: ${result.summary}`);

      // Query database to check what was stored
      const stories = await storage.db.execute(sql`
        SELECT id, type, content, lane, confidence, "isAtomicFact", "parentFactId"
        FROM memory_entries
        WHERE "profileId" = ${testProfileId}
        AND type = 'STORY'
        ORDER BY "createdAt" DESC
        LIMIT 1
      `);

      const atomicFacts = await storage.db.execute(sql`
        SELECT id, type, content, lane, "parentFactId"
        FROM memory_entries
        WHERE "profileId" = ${testProfileId}
        AND type = 'ATOMIC'
        ORDER BY "createdAt" DESC
      `);

      const wasStoryDetected = stories.rows.length > 0;
      const storyLane = stories.rows[0]?.lane || null;

      console.log(`\n✅ Verification:`);
      console.log(`   Story Detected: ${wasStoryDetected ? 'YES' : 'NO'}`);
      if (wasStoryDetected) {
        console.log(`   Story Lane: ${storyLane}`);
        console.log(`   Atomic Facts Linked: ${atomicFacts.rows.length}`);
      }

      // Check expectations
      let testPassed = true;

      if (test.expectedStory !== wasStoryDetected) {
        console.log(`\n❌ FAIL: Expected story=${test.expectedStory}, got story=${wasStoryDetected}`);
        testPassed = false;
      }

      if (test.expectedStory && test.expectedLane !== storyLane) {
        console.log(`\n❌ FAIL: Expected lane=${test.expectedLane}, got lane=${storyLane}`);
        testPassed = false;
      }

      if (testPassed) {
        console.log(`\n✅ PASS`);
        testsPassed++;
      } else {
        testsFailed++;
      }

    } catch (error) {
      console.error(`\n❌ ERROR:`, error);
      testsFailed++;
    }
  }

  // Cleanup
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧹 Cleaning up test data...`);
  await storage.db.execute(sql`
    DELETE FROM memory_entries WHERE "profileId" = ${testProfileId}
  `);
  await storage.db.execute(sql`
    DELETE FROM lore_characters WHERE "profileId" = ${testProfileId}
  `);
  await storage.db.execute(sql`
    DELETE FROM lore_locations WHERE "profileId" = ${testProfileId}
  `);
  console.log(`✅ Cleanup complete`);

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Test Summary:`);
  console.log(`   Total Tests: ${TEST_CONVERSATIONS.length}`);
  console.log(`   Passed: ${testsPassed}`);
  console.log(`   Failed: ${testsFailed}`);
  console.log(`   Success Rate: ${Math.round((testsPassed / TEST_CONVERSATIONS.length) * 100)}%`);
  console.log(`${'='.repeat(80)}\n`);

  if (testsFailed === 0) {
    console.log(`🎉 All tests passed!`);
  } else {
    console.log(`⚠️  Some tests failed. Review results above.`);
  }

  process.exit(testsFailed === 0 ? 0 : 1);
}

runTest().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
