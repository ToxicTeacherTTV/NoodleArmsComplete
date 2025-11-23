import { storage } from "../storage";

async function main() {
  const profile = await storage.getActiveProfile();
  if (!profile) {
    console.error("No active profile");
    process.exit(1);
  }
  
  // Get podcast episodes
  const episodes = await storage.listPodcastEpisodes(profile.id);
  
  // Get training examples
  const trainingExamples = await storage.getTrainingExamples(profile.id);
  
  // Get podcast-sourced memories
  const allMemories = await storage.getMemoryEntries(profile.id, 99999);
  const podcastMemories = allMemories.filter(m => m.source === 'podcast_episode');
  
  console.log(`\n📊 Podcast Content Analysis:`);
  console.log(`   🎙️  Total podcast episodes: ${episodes.length}`);
  console.log(`   🧠 Memories from podcasts: ${podcastMemories.length}`);
  console.log(`   📚 Training examples: ${trainingExamples.length}`);
  
  // Check how many training examples came from podcasts
  const podcastTraining = trainingExamples.filter(te => 
    te.name?.toLowerCase().includes('episode') || 
    te.name?.toLowerCase().includes('podcast')
  );
  console.log(`   🎓 Training from podcasts: ${podcastTraining.length}\n`);
  
  if (episodes.length > 0) {
    console.log(`\n💡 Opportunity: Convert ${episodes.length} podcast episodes into training examples!`);
    console.log(`   This would teach Nicky his actual speaking style from real conversations.\n`);
  }
  
  process.exit(0);
}

main();
