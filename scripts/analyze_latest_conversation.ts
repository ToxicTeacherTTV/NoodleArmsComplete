
import 'dotenv/config';
import { db } from '../server/db';
import { conversations, messages } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';
import * as fs from 'fs';

async function analyzeLatestConversation() {
  try {
    console.log("Fetching latest conversation...");
    
    // Get latest conversation
    const recentConvos = await db.select().from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(1);

    if (recentConvos.length === 0) {
      console.log("No conversations found.");
      return;
    }

    const conv = recentConvos[0];
    console.log(`Analyzing Conversation ID: ${conv.id}`);
    console.log(`Title: ${conv.title}`);
    console.log(`Created: ${conv.createdAt}`);

    // Get messages for this conversation
    const msgs = await db.select().from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(messages.createdAt);

    let output = `=== CONVERSATION ANALYSIS [ID: ${conv.id}] ===\n`;
    output += `Title: ${conv.title}\n`;
    output += `Message Count: ${msgs.length}\n\n`;

    msgs.forEach((msg, index) => {
      const role = msg.role === 'user' ? 'USER' : 'NICKY';
      output += `[${index + 1}] ${role} (${msg.createdAt}):\n${msg.content}\n`;
      output += `--------------------------------------------------\n`;
    });

    fs.writeFileSync('latest_conversation_analysis.txt', output);
    console.log("Analysis written to latest_conversation_analysis.txt");
    console.log(output); // Also print to console for immediate view

  } catch (error) {
    console.error("Error analyzing conversation:", error);
  } finally {
    process.exit(0);
  }
}

analyzeLatestConversation();
