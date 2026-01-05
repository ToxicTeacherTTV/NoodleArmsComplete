
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Setup environment BEFORE importing services
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

async function runTest() {
    console.log("🚀 Starting Chat Timing Debug...");
    console.log("🔑 Checking API Key presence...");
    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY is missing from environment!");
        process.exit(1);
    } else {
        console.log("✅ GEMINI_API_KEY found.");
    }

    // DYNAMIC IMPORT to ensure env vars are loaded first
    const { geminiService } = await import('../services/gemini.js');

    const userMessage = "Tell me a very long, detailed story about the time you tried to cook a 5-course meal for the entire SABAM crew using only a microwave and a stolen hot plate. I want to know every disaster, every scream, and every specific dish.";

    const coreIdentity = `You are Nicky "Noodle Arms" A.I. Dente. 
  - An anxious, shouting, New York Italian mobster AI.
  - You speak in ALL CAPS often.
  - You are paranoid about "The Sauce".
  `;

    const contextPrompt = "Nicky is a streamer. SABAM is his organization.";
    const recentHistory = "User: Hello\nAI: HEY! WHO IS DIS?";
    const saucePrompt = "Sauce Level: 50% (Spicy)";
    const cityStoryPrompt = "No active city story.";

    try {
        const start = Date.now();
        console.log("⏳ Sending request to Gemini...");

        // Call the method
        const response = await geminiService.generateChatResponse(
            userMessage,
            coreIdentity,
            contextPrompt,
            recentHistory,
            saucePrompt,
            cityStoryPrompt
        );

        const end = Date.now();
        console.log("\n✅ Response Received!");
        console.log(`⏱️ Total Client-Side Time: ${end - start}ms`);
        console.log(`📏 Content Length: ${response.content.length}`);
        console.log(`📝 Content Preview: ${response.content.substring(0, 100)}...`);
        console.log(`🔚 Content End: ...${response.content.substring(response.content.length - 100)}`);

        if (response.content.length > 2000) {
            console.log("SUCCESS: Response is > 2000 chars, truncation likely fixed.");
        } else {
            console.log("WARNING: Response is short. Check if it was truncated naturally or by limit.");
        }

    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

runTest();
