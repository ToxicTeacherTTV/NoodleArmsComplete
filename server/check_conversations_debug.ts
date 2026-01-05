import { db } from "./db";
import { profiles, conversations, messages } from "@shared/schema";
import { eq, desc, and, count } from "drizzle-orm";
import fs from "fs";

async function checkConversations() {
    try {
        const allProfiles = await db.select().from(profiles);
        const active = allProfiles.find(p => p.isActive);

        if (!active) {
            console.log("No active profile");
            process.exit(0);
        }

        // Get latest 10 conversations
        const latestConvs = await db.select()
            .from(conversations)
            .where(eq(conversations.profileId, active.id))
            .orderBy(desc(conversations.createdAt))
            .limit(10);

        const hydratedConvs = await Promise.all(latestConvs.map(async (conv) => {
            const msgCountRes = await db.select({ value: count() }).from(messages).where(eq(messages.conversationId, conv.id));
            const msgCount = Number(msgCountRes[0].value);

            const firstMsg = await db.select().from(messages)
                .where(eq(messages.conversationId, conv.id))
                .orderBy(desc(messages.createdAt))
                .limit(1);

            return {
                id: conv.id,
                title: conv.title,
                createdAt: conv.createdAt,
                isArchived: conv.isArchived,
                isPrivate: conv.isPrivate,
                messageCount: msgCount,
                firstMessageSnippet: firstMsg[0]?.content?.substring(0, 50)
            };
        }));

        fs.writeFileSync("conversation_inspect.json", JSON.stringify(hydratedConvs, null, 2));
        console.log("Results written to conversation_inspect.json");
        process.exit(0);
    } catch (error) {
        console.error("Error checking conversations:", error);
        process.exit(1);
    }
}

checkConversations();
