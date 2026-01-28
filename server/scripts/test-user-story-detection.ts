import 'dotenv/config';
import { storage } from '../storage.js';
import { loreOrchestrator } from '../services/LoreOrchestrator.js';

/**
 * Test script to verify user story detection and extraction
 */

const TEST_STORIES = [
  {
    name: 'DBD Locker Story',
    content: `So yesterday I was playing Nurse on Dead by Daylight and this Claudette kept hiding in a locker for 20 minutes. I finally found her because she had crows circling above her, and when I grabbed her out, she DC'd instantly. Funniest shit I've seen all week.`,
    shouldDetect: true
  },
  {
    name: 'Camping Trip Story',
    content: `Last month I went camping with my cousin in the Poconos. We set up our tent near this creek, and around 2 AM I heard something rustling outside. Turned out to be a fucking raccoon that got into our cooler and stole all our hot dogs. We found the little bastard the next morning with ketchup packets scattered everywhere.`,
    shouldDetect: true
  },
  {
    name: 'Not a story - short question',
    content: `What do you think about camping killers?`,
    shouldDetect: false
  },
  {
    name: 'Not a story - opinion',
    content: `I hate playing against The Skull Merchant. She's so boring to play against.`,
    shouldDetect: false
  },
  {
    name: 'Borderline - personal anecdote',
    content: `I remember when Dead by Daylight first came out. My friends and I played it non-stop for like two weeks straight. Good times.`,
    shouldDetect: true
  }
];

async function testUserStoryDetection() {
  console.log('🧪 Testing User Story Detection...\n');

  try {
    // Get active profile
    const activeProfile = await storage.getActiveProfile();
    if (!activeProfile) {
      console.error('❌ No active profile found. Please set up a profile first.');
      return;
    }

    console.log(`📊 Using profile: ${activeProfile.displayName} (ID: ${activeProfile.id})\n`);

    // Create test conversation
    const { conversations } = await import('../../shared/schema.js');
    const testConversation = await storage.db.insert(conversations).values({
      profileId: activeProfile.id,
      title: 'Test Conversation - User Stories',
      contentType: 'CHAT'
    }).returning();

    const conversationId = testConversation[0].id;
    console.log(`✅ Created test conversation: ${conversationId}\n`);

    // Test each story
    const results = [];
    for (let i = 0; i < TEST_STORIES.length; i++) {
      const testCase = TEST_STORIES[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📖 Test Case ${i + 1}/${TEST_STORIES.length}: ${testCase.name}`);
      console.log(`Expected to detect story: ${testCase.shouldDetect ? 'YES' : 'NO'}`);
      console.log(`Message: "${testCase.content.substring(0, 100)}..."`);
      console.log(`${'='.repeat(80)}\n`);

      const result = await loreOrchestrator.processNewContent(
        testCase.content,
        activeProfile.id,
        `Test: ${testCase.name}`,
        'CONVERSATION',
        conversationId,
        {
          allowWrites: true,
          speaker: 'user',
          speakerName: 'Toxic',
          speakerId: 'test-user-123'
        }
      );

      console.log(`\n📊 Result:`);
      console.log(`   Facts created: ${result.newFacts}`);
      console.log(`   Entities updated: ${result.updatedEntities}`);
      console.log(`   Summary: ${result.summary}`);

      results.push({
        testCase: testCase.name,
        expected: testCase.shouldDetect,
        detected: result.summary.includes('user story'),
        factsCreated: result.newFacts,
        result
      });

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check stored data
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📚 CHECKING STORED STORIES...');
    console.log(`${'='.repeat(80)}\n`);

    const { memoryEntries } = await import('../../shared/schema.js');
    const { eq, and } = await import('drizzle-orm');

    const userStories = await storage.db.select()
      .from(memoryEntries)
      .where(and(
        eq(memoryEntries.profileId, activeProfile.id),
        eq(memoryEntries.sourceId, conversationId),
        eq(memoryEntries.type, 'STORY'),
        eq(memoryEntries.source, 'user_story')
      ));

    console.log(`Found ${userStories.length} user stories in database\n`);

    for (let i = 0; i < userStories.length; i++) {
      const story = userStories[i];
      console.log(`Story ${i + 1}:`);
      console.log(`   ID: ${story.id}`);
      console.log(`   Content: ${story.content.substring(0, 100)}...`);
      console.log(`   Importance: ${story.importance}`);
      console.log(`   Confidence: ${story.confidence}`);
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
      console.log('');
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 TEST SUMMARY');
    console.log(`${'='.repeat(80)}\n`);

    let passCount = 0;
    let failCount = 0;

    results.forEach((res, i) => {
      const passed = res.expected === res.detected;
      const icon = passed ? '✅' : '❌';
      console.log(`${icon} Test ${i + 1}: ${res.testCase}`);
      console.log(`   Expected story detection: ${res.expected}`);
      console.log(`   Actual detection: ${res.detected}`);
      console.log(`   Facts created: ${res.factsCreated}`);
      console.log('');

      if (passed) passCount++;
      else failCount++;
    });

    console.log(`\nTotal: ${passCount} passed, ${failCount} failed out of ${results.length} tests`);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await storage.db.delete(memoryEntries)
      .where(eq(memoryEntries.sourceId, conversationId));

    await storage.db.delete(conversations)
      .where(eq(conversations.id, conversationId));

    console.log('✅ Cleanup complete!\n');

    if (failCount === 0) {
      console.log('🎉 ALL TESTS PASSED!\n');
    } else {
      console.log(`⚠️ ${failCount} test(s) failed\n`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testUserStoryDetection()
  .then(() => {
    console.log('✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
