
import 'dotenv/config';
import { db } from './db';
import { conversations, messages } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';

import * as fs from 'fs';

async function inspectLatestConvo() {
  try {
    console.log("Fetching latest conversation...");
    // Get the most recent conversation
    const allConvos = await db.select().from(conversations).orderBy(desc(conversations.createdAt)).limit(1);
    
    if (allConvos.length === 0) {
      console.log("No conversations found.");
      return;
    }

    const convo = allConvos[0];
    let output = `\n=== CONVERSATION: ${convo.title} (${convo.id}) ===\n`;
    output += `Created: ${convo.createdAt}\n`;
    output += `Is Private: ${convo.isPrivate}\n`;
    // output += `Metadata: ${JSON.stringify(convo.metadata, null, 2)}\n`;

    // Get messages for this conversation
    const msgs = await db.select().from(messages)
      .where(eq(messages.conversationId, convo.id))
      .orderBy(messages.createdAt);

    output += `\n=== MESSAGES (${msgs.length}) ===\n`;
    msgs.forEach(msg => {
      const type = msg.type === 'USER' ? '👤 USER' : '🤖 NICKY';
      const privacy = msg.isPrivate ? '[PRIVATE]' : '[PUBLIC]';
      const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : 'Unknown Time';
      output += `\n${type} ${privacy} [${time}]\n`;
      output += `${msg.content}\n`;
    });

    fs.writeFileSync('convo_log.md', output);
    console.log("Log written to convo_log.md");

  } catch (error) {
    console.error("Error inspecting conversation:", error);
  } finally {
    process.exit(0);
  }
}

inspectLatestConvo();
