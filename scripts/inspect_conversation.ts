
import "dotenv/config";
import { db } from "../server/db";
import { conversations, messages } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const args = process.argv.slice(2);
const command = args[0];
const param = args[1];

async function listConversations(limit = 10) {
  const convs = await db.select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt))
    .limit(limit);

  console.log(`\n--- Last ${limit} Conversations ---`);
  convs.forEach((c, i) => {
    const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleString() : "Unknown Date";
    console.log(`${i}. [${dateStr}] ${c.title} (ID: ${c.id})`);
  });
  console.log("-----------------------------------");
}

async function viewConversation(idOrIndex: string) {
  let conversation;

  // Check if input is a UUID (simple regex check)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrIndex);

  if (isUUID) {
    const result = await db.select().from(conversations).where(eq(conversations.id, idOrIndex));
    conversation = result[0];
  } else {
    // Treat as index (0 = latest)
    const index = parseInt(idOrIndex, 10);
    if (isNaN(index)) {
      console.error("Invalid ID or index.");
      return;
    }
    const result = await db.select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(index + 1);
    
    if (result.length <= index) {
      console.error("Conversation index out of range.");
      return;
    }
    conversation = result[index];
  }

  if (!conversation) {
    console.error("Conversation not found.");
    return;
  }

  console.log(`\nViewing: ${conversation.title} (${conversation.id})`);
  console.log(`Date: ${conversation.createdAt}`);
  
  const msgs = await db.select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(messages.createdAt);

  console.log("\n--- Transcript ---");
  msgs.forEach(msg => {
    console.log(`\n[${msg.type}]: ${msg.content}`);
  });
  console.log("\n--- End Transcript ---");
}

async function main() {
  try {
    if (!command || command === 'list') {
      await listConversations();
      console.log("\nUsage:");
      console.log("  npm run inspect list          # List recent conversations");
      console.log("  npm run inspect view <index>  # View by index (0 = latest)");
      console.log("  npm run inspect view <uuid>   # View by ID");
    } else if (command === 'view') {
      if (!param) {
        // Default to latest if no param
        await viewConversation("0");
      } else {
        await viewConversation(param);
      }
    } else {
      console.log("Unknown command. Use 'list' or 'view'.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

main();
