import dotenv from 'dotenv';
const result = dotenv.config();

// Debug: Check if .env loaded
if (result.error) {
    console.error("❌ dotenv failed:", result.error);
} else {
    console.log("✅ dotenv loaded.");
}

// Log env vars status (DO NOT LOG VALUES)
console.log("Environment Status:", {
    DATABASE_URL: !!process.env.DATABASE_URL,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY
});

async function verifyChatFlow() {
    console.log("\n🤖 Starting Chat Flow Verification...");

    try {
        // Dynamically import services AFTER dotenv.config()
        console.log("Imports: Loading storage...");
        const { storage } = await import('../storage');
        console.log("Imports: storage loaded.");

        console.log("Imports: Loading geminiService...");
        const { geminiService } = await import('../services/gemini');
        console.log("Imports: geminiService loaded.");

        console.log("Imports: Loading embeddingService...");
        const { embeddingService } = await import('../services/embeddingService');
        console.log("Imports: embeddingService loaded.");

        console.log("----------------------------------------");

        // 1. Get the active profile
        console.log("Action: storage.getActiveProfile()");
        const activeProfile = await storage.getActiveProfile();
        if (!activeProfile) throw new Error("No active profile found!");
        console.log(`👤 Active Profile: ${activeProfile.name} (${activeProfile.id})`);

        // 2. Test Semantic Search directly
        const query = "Tell me about the Arc Raiders squad";
        console.log(`\n🔍 Testing Semantic Search with query: "${query}"`);

        // Generate embedding
        console.log("Action: embeddingService.generateEmbedding()");
        const embeddingResult = await embeddingService.generateEmbedding(query);
        const embeddingVector = embeddingResult.embedding;

        console.log(`✅ Generated embedding vector (len: ${embeddingVector.length})`);


        // Perform search
        console.log("Action: storage.findSimilarMemories()");
        let memories = [];
        try {
            memories = await storage.findSimilarMemories(activeProfile.id, embeddingVector, 3);
            console.log(`📚 Retrieved ${memories.length} similar memories:`);
            memories.forEach(m => console.log(`   - [${Math.round(m.similarity * 100)}%] ${m.content.substring(0, 80)}...`));
        } catch (searchError) {
            console.error("❌ storage.findSimilarMemories FAILED:", searchError);
            throw searchError;
        }

        if (memories.length > 0) {
            console.log("✅ Vector/Semantic Search is WORKING.");
        } else {
            console.warn("⚠️ No memories found - this might be okay if DB is empty, but verify.");
        }

        // 3. Test Full Chat Generation
        console.log("\n💬 Generating AI Response...");
        console.log("Action: geminiService.generateChatResponse()");

        // Mock context data since we are testing the service in isolation
        const coreIdentity = "You are Nicky, a neurotic robot.";
        const contextPrompt = memories.map(m => m.content).join("\n");
        const recentHistory = "";
        const saucePrompt = "Sauce Level: Low";
        const cityStoryPrompt = "No active city events.";

        const response = await geminiService.generateChatResponse(
            query,
            coreIdentity,
            contextPrompt,
            recentHistory,
            saucePrompt,
            cityStoryPrompt
        );

        console.log("\n🤖 Nicky's Response:");
        console.log("----------------------------------------");
        console.log(response.content);
        console.log("----------------------------------------");
        console.log(`✅ Response generated in ${response.metadata.durationMs}ms`);

        process.exit(0);
    } catch (error) {
        console.error("\n❌ CHAT VERIFICATION FAILED DETAILS:", error);
        process.exit(1);
    }
}

verifyChatFlow();
