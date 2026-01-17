import { normalizeResponseTags } from '../services/chatService.js';

console.log('Testing Tag Normalization - Debug Version\n');

// Test 1: Valid tags
console.log('Test 1: AI-generated valid tags');
const test1Input = '[thick italian-italian american nyc accent] [yelling] [furious] What the HELL?';
const test1Result = normalizeResponseTags(test1Input, 'CHAT');
console.log('Input:', test1Input);
console.log('Output:', test1Result.content);
console.log('Match:', test1Result.content === test1Input ? 'PASS' : 'FAIL');
console.log('');

// Test 2: No tags
console.log('Test 2: No tags (apply defaults)');
const test2Input = 'I am Nicky';
const test2Result = normalizeResponseTags(test2Input, 'CHAT');
console.log('Input:', test2Input);
console.log('Output:', test2Result.content);
console.log('Expected: [thick italian-italian american nyc accent] [talking] [neutral] I am Nicky');
console.log('Match:', test2Result.content === '[thick italian-italian american nyc accent] [talking] [neutral] I am Nicky' ? 'PASS' : 'FAIL');
console.log('');

// Test 3: Tags but accent not first
console.log('Test 3: Accent not first (move it)');
const test3Input = '[yelling] [thick italian-italian american nyc accent] [furious] Hey';
const test3Result = normalizeResponseTags(test3Input, 'CHAT');
console.log('Input:', test3Input);
console.log('Output:', test3Result.content);
console.log('Expected: [thick italian-italian american nyc accent] [yelling] [furious] Hey');
console.log('Match:', test3Result.content === '[thick italian-italian american nyc accent] [yelling] [furious] Hey' ? 'PASS' : 'FAIL');
console.log('');

// Test 4: Discord mode
console.log('Test 4: Discord mode (strip tags)');
const test4Input = '[thick italian-italian american nyc accent] [yelling] Test';
const test4Result = normalizeResponseTags(test4Input, 'DISCORD');
console.log('Input:', test4Input);
console.log('Output:', test4Result.content);
console.log('Expected: Test');
console.log('Match:', test4Result.content === 'Test' ? 'PASS' : 'FAIL');
