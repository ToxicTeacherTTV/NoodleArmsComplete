import { storage } from "./storage";

async function testWebApi() {
    try {
        const activeProfile = await storage.getActiveProfile();
        console.log("Active Profile:", activeProfile?.id);

        if (activeProfile) {
            const conversations = await storage.listWebConversations(activeProfile.id, false);
            console.log(`Found ${conversations.length} active conversations for web`);

            // Look at the first one
            if (conversations.length > 0) {
                console.log("First conversation sample:", JSON.stringify(conversations[0], null, 2));
            }
        } else {
            console.log("No active profile found in storage");
        }
        process.exit(0);
    } catch (error) {
        console.error("Error testing Web API:", error);
        process.exit(1);
    }
}

testWebApi();
