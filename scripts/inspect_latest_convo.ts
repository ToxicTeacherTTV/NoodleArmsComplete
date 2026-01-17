
import { storage } from '../server/storage';
import { db } from '../server/db';
import { conversations, messages } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';

async function inspectLatestConvo() {
  try {
    // Get the most recent conversation
    const allConvos = await db.select().from(conversations).orderBy(desc(conversations.updatedAt)).limit(1);
    
    if (allConvos.length === 0) {
      console.log("No conversations found.");
      return;
    }

    const convo = allConvos[0];
    console.log(`\n=== CONVERSATION: ${convo.title} (${convo.id}) ===`);
    console.log(`Created: ${convo.createdAt}, Updated: ${convo.updatedAt}`);
    console.log(`Is Private: ${convo.isPrivate}`);
    console.log(`Metadata:`, convo.metadata);

    // Get messages for this conversation
    const msgs = await db.select().from(messages)
      .where(eq(messages.conversationId, convo.id))
      .orderBy(messages.createdAt);

    console.log(`\n=== MESSAGES (${msgs.length}) ===`);
    msgs.forEach(msg => {
      const type = msg.type === 'USER' ? '👤 USER' : '🤖 NICKY';
      const privacy = msg.isPrivate ? '[PRIVATE]' : '[PUBLIC]';
      console.log(`\n${type} ${privacy} [${msg.createdAt?.toISOString()}]`);
      console.log(msg.content);
      if (msg.metadata) {
         console.log('Metadata:', JSON.stringify(msg.metadata).substring(0, 200) + '...');
      }
    });

  } catch (error) {
    console.error("Error inspecting conversation:", error);
  } finally {
    process.exit(0);
  }
}

inspectLatestConvo();
