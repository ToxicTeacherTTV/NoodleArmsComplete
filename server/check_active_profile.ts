import { db } from "./db";
import { profiles, conversations } from "@shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs";

async function checkProfiles() {
    try {
        const allProfiles = await db.select().from(profiles);
        const active = allProfiles.find(p => p.isActive);

        let convCount = 0;
        let archivedCount = 0;

        if (active) {
            const allConvs = await db.select().from(conversations).where(eq(conversations.profileId, active.id));
            convCount = allConvs.length;
            archivedCount = allConvs.filter(c => c.isArchived).length;
        }

        const results = {
            profiles: allProfiles.map(p => ({ id: p.id, name: p.name, isActive: p.isActive })),
            conversationStats: active ? {
                profileId: active.id,
                total: convCount,
                archived: archivedCount,
                active: convCount - archivedCount
            } : null
        };

        fs.writeFileSync("profile_results.json", JSON.stringify(results, null, 2));
        console.log("Results written to profile_results.json");
        process.exit(0);
    } catch (error) {
        console.error("Error checking profiles:", error);
        process.exit(1);
    }
}

checkProfiles();
