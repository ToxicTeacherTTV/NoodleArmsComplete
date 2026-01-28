import 'dotenv/config';
import { storage } from '../storage.js';
import { desc, eq } from 'drizzle-orm';
import { messages, conversations } from '../../shared/schema.js';

// Get the most recent conversation
const recentConvos = await storage.db.select()
  .from(conversations)
  .orderBy(desc(conversations.updatedAt))
  .limit(3);

console.log('Recent conversations:');
recentConvos.forEach((conv, i) => {
  console.log(`${i + 1}. ${conv.title} (${conv.id}) - Updated: ${conv.updatedAt}`);
});

// Get messages from the most recent conversation
const latestConvoId = recentConvos[0].id;
console.log(`\n\nChecking messages from: ${recentConvos[0].title}\n`);

const convoMessages = await storage.db.select()
  .from(messages)
  .where(eq(messages.conversationId, latestConvoId))
  .orderBy(desc(messages.createdAt))
  .limit(15);

convoMessages.reverse().forEach((msg, i) => {
  console.log('\n' + '='.repeat(80));
  console.log(`Message ${i + 1} (${msg.type}):`);
  console.log(`Created: ${msg.createdAt}`);
  console.log(`Length: ${msg.content.length} chars`);

  // Check for pattern: spaces followed by !
  const spaceBeforeExclaim = msg.content.match(/\s{2,}!/g);
  if (spaceBeforeExclaim) {
    console.log(`⚠️ FOUND PATTERN: Multiple spaces before ! (${spaceBeforeExclaim.length} occurrences)`);
    spaceBeforeExclaim.forEach(match => {
      console.log(`   Pattern: "${match}"`);
    });
  }

  // Check for incomplete sentences (sentence fragments ending with spaces + !)
  const lines = msg.content.split('\n');
  lines.forEach((line, lineNum) => {
    if (/\s{2,}!/.test(line)) {
      console.log(`   ⚠️ Line ${lineNum + 1}: "${line.substring(Math.max(0, line.indexOf('  !') - 30), line.indexOf('  !') + 10)}"`);
    }
  });

  console.log('\nFull Content:');
  console.log(msg.content);
});
