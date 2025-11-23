
import { storage } from "../storage";
import { db } from "../db";

async function testCreateEpisode() {
  try {
    console.log("🧪 Testing podcast episode creation...");
    
    const activeProfile = await storage.getActiveProfile();
    if (!activeProfile) {
      console.error("❌ No active profile found!");
      process.exit(1);
    }
    console.log(`👤 Active profile: ${activeProfile.name} (${activeProfile.id})`);

    const episodeData = {
      profileId: activeProfile.id,
      title: "Test Episode " + Date.now(),
      description: "This is a test episode created by the debugger.",
      status: "DRAFT" as const,
      episodeNumber: 999,
      seasonNumber: 1
    };

    console.log("📝 Attempting to create episode with data:", episodeData);

    const episode = await storage.createPodcastEpisode(episodeData);
    console.log("✅ Episode created successfully:", episode.id);
    
    // Clean up
    console.log("🧹 Cleaning up test episode...");
    await storage.deletePodcastEpisode(episode.id);
    console.log("✅ Cleanup complete.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to create episode:", error);
    process.exit(1);
  }
}

testCreateEpisode();
