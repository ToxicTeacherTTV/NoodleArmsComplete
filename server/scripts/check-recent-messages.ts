import 'dotenv/config';
import { storage } from '../storage.js';
import { desc } from 'drizzle-orm';
import { messages } from '../../shared/schema.js';

const recentMessages = await storage.db.select()
  .from(messages)
  .orderBy(desc(messages.createdAt))
  .limit(5);

recentMessages.forEach((msg, i) => {
  console.log('\n' + '='.repeat(80));
  console.log(`Message ${i + 1}:`);
  console.log(`Type: ${msg.type}`);
  console.log(`Created: ${msg.createdAt}`);
  console.log(`Content length: ${msg.content.length} chars`);
  console.log(`Content:`);
  console.log(msg.content);
});
