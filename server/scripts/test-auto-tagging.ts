/**
 * 🧪 Test Script: Auto-Tagging System
 *
 * Verifies that the 9-tag system correctly tags memories based on content.
 *
 * Success Criteria:
 * 1. Each test case gets the expected tags
 * 2. Tags are stored in the database
 * 3. No unexpected tags appear
 * 4. Family mentions boost importance to 75+
 * 5. Multiple tags can be applied to one memory
 */

import { storage } from '../storage.js';
import { sql } from 'drizzle-orm';

const TEST_CASES = [
  {
    name: "Uncle Vinny Story",
    content: "Uncle Vinny ran a poker game out of Sal's Pizzeria in Newark back in 1987. Best marinara sauce in Jersey.",
    expectedTags: ['family', 'italian', 'personal'],
    expectImportanceBoost: true,
  },
  {
    name: "DBD Gameplay",
    content: "The killer was camping the hook and the survivor had Dead Hard ready. Total gen rush.",
    expectedTags: ['dbd'],
    expectImportanceBoost: false,
  },
  {
    name: "Arc Raiders Discussion",
    content: "The new Headwinds update for Arc Raiders changed the extraction mechanics completely.",
    expectedTags: ['arc-raiders'],
    expectImportanceBoost: false,
  },
  {
    name: "Enemy Story",
    content: "Tony 'The Trap' Benedetti betrayed my Uncle Vinny at the poker game. That bastard crossed the wrong family.",
    expectedTags: ['family', 'enemies', 'personal'],
    expectImportanceBoost: true,
  },
  {
    name: "Heated Rant",
    content: "ARE YOU FUCKING KIDDING ME?! THIS IS COMPLETE BULLSHIT! THAT DAMN KILLER IS CAMPING AGAIN!",
    expectedTags: ['heated', 'dbd'],
    expectImportanceBoost: false,
  },
  {
    name: "Meta/Fourth Wall",
    content: "Sometimes I wonder if this is all just a simulation. Like I'm trapped in some developer's code.",
    expectedTags: ['meta'],
    expectImportanceBoost: false,
  },
  {
    name: "Multiple Topics",
    content: "My nonna used to make the best pasta while watching me play Dead by Daylight on Twitch.",
    expectedTags: ['family', 'italian', 'dbd'],
    expectImportanceBoost: true,
  },
  {
    name: "General Gaming",
    content: "I was streaming some FPS game yesterday and the patch broke everything.",
    expectedTags: ['gaming'],
    expectImportanceBoost: false,
  },
  {
    name: "Ghost Pigs (Enemies + Meta + Heated)",
    content: "THE GHOST PIGS ARE REPO MEN FOR MY SOUL! This simulation is broken! Those bastards crossed the streams!",
    expectedTags: ['enemies', 'meta', 'heated'],
    expectImportanceBoost: false,
  },
  {
    name: "Plain Fact (No Tags)",
    content: "The weather is nice today.",
    expectedTags: [],
    expectImportanceBoost: false,
  }
];

async function runTest() {
  console.log('🧪 Starting Auto-Tagging Test\n');
  console.log('=' .repeat(80));

  const testProfileId = 'test-auto-tagging-' + Date.now();
  let testsPassed = 0;
  let testsFailed = 0;

  for (const test of TEST_CASES) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`📄 Content: "${test.content.substring(0, 60)}..."`);
    console.log(`🎯 Expected Tags: [${test.expectedTags.join(', ')}]`);
    console.log(`─`.repeat(80));

    try {
      // Create memory entry
      const entry = await storage.addMemoryEntry({
        profileId: testProfileId,
        type: test.name.includes('Story') ? 'STORY' : 'FACT',
        content: test.content,
        importance: 50,
        source: test.name.includes('Story') ? 'nicky_story' : 'test',
        confidence: 80,
        lane: 'CANON',
        keywords: []
      });

      const actualTags = entry.tags || [];
      const actualImportance = entry.importance || 50;

      console.log(`\n✅ Memory Created:`);
      console.log(`   ID: ${entry.id}`);
      console.log(`   Tags: [${actualTags.join(', ')}]`);
      console.log(`   Importance: ${actualImportance}`);

      // Verify tags match expected
      let testPassed = true;
      const expectedSet = new Set(test.expectedTags);
      const actualSet = new Set(actualTags);

      // Check all expected tags are present
      for (const expectedTag of test.expectedTags) {
        if (!actualSet.has(expectedTag)) {
          console.log(`\n❌ FAIL: Missing expected tag: "${expectedTag}"`);
          testPassed = false;
        }
      }

      // Check no unexpected tags
      for (const actualTag of actualTags) {
        if (!expectedSet.has(actualTag)) {
          console.log(`\n❌ FAIL: Unexpected tag: "${actualTag}"`);
          testPassed = false;
        }
      }

      // Check importance boost for family mentions
      if (test.expectImportanceBoost && actualImportance < 75) {
        console.log(`\n❌ FAIL: Expected importance boost (75+), got ${actualImportance}`);
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
  console.log(`✅ Cleanup complete`);

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Test Summary:`);
  console.log(`   Total Tests: ${TEST_CASES.length}`);
  console.log(`   Passed: ${testsPassed}`);
  console.log(`   Failed: ${testsFailed}`);
  console.log(`   Success Rate: ${Math.round((testsPassed / TEST_CASES.length) * 100)}%`);
  console.log(`${'='.repeat(80)}\n`);

  if (testsFailed === 0) {
    console.log(`🎉 All tests passed! Auto-tagging system is working correctly.`);
    console.log(`\n📋 What to do next:`);
    console.log(`   1. Check existing memories: SELECT id, content, tags FROM memory_entries LIMIT 10;`);
    console.log(`   2. New memories will automatically get tagged`);
    console.log(`   3. Use tags for fast filtering: WHERE 'family' = ANY(tags)`);
    console.log(`   4. Monitor tag distribution in Intelligence Dashboard`);
  } else {
    console.log(`⚠️  Some tests failed. Review the output above.`);
  }

  process.exit(testsFailed === 0 ? 0 : 1);
}

runTest().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
