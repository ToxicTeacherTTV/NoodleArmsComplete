import { normalizeResponseTags } from '../services/chatService.js';

console.log('🧪 Testing Tag Normalization (Consolidated Pipeline)\n');

// Test cases
const tests = [
  {
    name: 'AI-generated valid tags (trust them)',
    input: '[thick italian-italian american nyc accent] [yelling] [furious] What the HELL are you doing?',
    mode: 'CHAT',
    expected: '[thick italian-italian american nyc accent] [yelling] [furious] What the HELL are you doing?'
  },
  {
    name: 'No tags (apply defaults)',
    input: 'I\'m Nicky, your favorite unhinged podcaster.',
    mode: 'CHAT',
    expected: '[thick italian-italian american nyc accent] [talking] [neutral] I\'m Nicky, your favorite unhinged podcaster.'
  },
  {
    name: 'Tags but accent not first (move it to front)',
    input: '[yelling] [thick italian-italian american nyc accent] [furious] Listen up!',
    mode: 'CHAT',
    expected: '[thick italian-italian american nyc accent] [yelling] [furious] Listen up!'
  },
  {
    name: 'Discord mode (strip ALL tags)',
    input: '[thick italian-italian american nyc accent] [yelling] [furious] What the HELL?',
    mode: 'DISCORD',
    expected: 'What the HELL?'
  },
  {
    name: 'Malformed spacing ][ (fix it)',
    input: '[thick italian-italian american nyc accent][yelling][furious]Text here',
    mode: 'CHAT',
    expected: '[thick italian-italian american nyc accent] [yelling] [furious] Text here'
  },
  {
    name: 'Tags with newlines after them (remove newlines)',
    input: '[thick italian-italian american nyc accent]\n[yelling]\nText',
    mode: 'CHAT',
    expected: '[thick italian-italian american nyc accent] [yelling] Text'
  },
  {
    name: 'AI creative tags (accept them)',
    input: '[thick italian-italian american nyc accent] [rapid-fire] [manic] Yo yo yo!',
    mode: 'CHAT',
    expected: '[thick italian-italian american nyc accent] [rapid-fire] [manic] Yo yo yo!'
  },
  {
    name: 'Mixed valid and spacing issues',
    input: '[yelling][thick italian-italian american nyc accent]\n[furious]  Hey!',
    mode: 'CHAT',
    expected: '[thick italian-italian american nyc accent] [yelling] [furious] Hey!'
  }
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  console.log(`\n📋 Test ${index + 1}: ${test.name}`);
  console.log(`   Input: "${test.input}"`);
  console.log(`   Mode: ${test.mode}`);
  
  const result = normalizeResponseTags(test.input, test.mode);
  const output = result.content;
  
  console.log(`   Output: "${output}"`);
  console.log(`   Expected: "${test.expected}"`);
  console.log(`   Processing time: ${result.metrics.processingTime}ms`);
  
  if (output === test.expected) {
    console.log(`   ✅ PASS`);
    passed++;
  } else {
    console.log(`   ❌ FAIL`);
    console.log(`   Difference:`);
    console.log(`     Got:      "${output}"`);
    console.log(`     Expected: "${test.expected}"`);
    failed++;
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 Results: ${passed}/${tests.length} tests passed`);
if (failed > 0) {
  console.log(`❌ ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log(`✅ All tests passed!`);
  process.exit(0);
}
