
import { storage } from "../storage";
import { podcastFactExtractor } from "../services/podcastFactExtractor";

async function testFactExtraction() {
  try {
    console.log("🧪 Testing podcast fact extraction...");
    
    const activeProfile = await storage.getActiveProfile();
    if (!activeProfile) {
      console.error("❌ No active profile found!");
      process.exit(1);
    }
    console.log(`👤 Active profile: ${activeProfile.name} (${activeProfile.id})`);

    // Create a dummy episode
    const episodeData = {
      profileId: activeProfile.id,
      title: "Test Episode for Extraction " + Date.now(),
      description: "Testing fact extraction.",
      status: "DRAFT" as const,
      episodeNumber: 888,
      seasonNumber: 1,
      transcript: "Welcome to the podcast. Today we are talking about Dead by Daylight. The killer is very strong. I think the Trapper needs a buff. Also, Sal from the deli is making great sandwiches."
    };

    console.log("📝 Creating test episode...");
    const episode = await storage.createPodcastEpisode(episodeData);
    console.log("✅ Episode created:", episode.id);

    console.log("🧠 Extracting facts...");
    const result = await podcastFactExtractor.extractFactsFromEpisode(
      episode.id,
      episode.episodeNumber || 0,
      episode.title,
      episode.transcript || "",
      episode.profileId,
      storage
    );

    console.log("📊 Extraction Result:", JSON.stringify(result, null, 2));

    // Clean up
    console.log("🧹 Cleaning up...");
    await storage.deletePodcastEpisode(episode.id);
    console.log("✅ Cleanup complete.");

    if (result.success) {
      console.log("✅ Test PASSED");
      process.exit(0);
    } else {
      console.error("❌ Test FAILED");
      process.exit(1);
    }

  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

testFactExtraction();
