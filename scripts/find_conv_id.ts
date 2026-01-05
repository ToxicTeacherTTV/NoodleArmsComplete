
import { db } from '../server/db.js';
import { messages } from '@shared/schema.js';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const msgId = '8fa7fb7a-c724-49a3-b946-7612eb9bf96a';
    const [msg] = await db.select().from(messages).where(eq(messages.id, msgId));
    if (msg) {
        console.log(`Message ID: ${msg.id}`);
        console.log(`Conversation ID: ${msg.conversationId}`);
        console.log(`Content: ${msg.content.substring(0, 100)}...`);
    } else {
        console.log("Message not found (it might have been deleted).");
        // Try to find messages with similar content if deleted
        const allMsgs = await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(50);
        console.log("Last 50 messages:");
        allMsgs.forEach(m => {
            if (m.content.toLowerCase().includes("sleep") || m.content.toLowerCase().includes("glymphatic")) {
                console.log(`[MATCH] ID: ${m.id}, Conv: ${m.conversationId}, Content: ${m.content.substring(0, 50)}`);
            }
        });
    }
    process.exit(0);
}

import { desc } from 'drizzle-orm';
main().catch(console.error);
