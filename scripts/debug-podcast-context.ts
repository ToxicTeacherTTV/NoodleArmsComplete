
import { storage } from "../server/storage";

async function debugPodcastContext() {
  console.log("🎧 Debugging Podcast Context...");

  const profile = await storage.getActiveProfile();
  if (!profile) {
    console.error("❌ No active profile found.");
    process.exit(1);
  }

  console.log(`👤 Active Profile: ${profile.name}`);

  // Fetch what the AI sees in Podcast Mode
  const memories = await storage.getPodcastAwareMemories(profile.id, 'PODCAST', 15);

  console.log(`\n📚 Retrieved ${memories.length} Podcast-Aware Memories:`);
  
  let familyCount = 0;
  memories.forEach((m, i) => {
    const isFamily = /\b(uncle|cousin|aunt|mama|papa|nonna|nonno|brother|sister|family)\b/i.test(m.content);
    if (isFamily) familyCount++;
    
    console.log(`\n[${i + 1}] ${m.isPodcastContent ? '🎙️ PODCAST' : '📄 GENERAL'} (Imp: ${m.importance})`);
    console.log(`    "${m.content.substring(0, 100)}..."`);
    if (isFamily) console.log(`    ⚠️ FAMILY DETECTED`);
  });

  console.log(`\n📊 Analysis:`);
  console.log(`   Total Memories: ${memories.length}`);
  console.log(`   Family Memories: ${familyCount}`);
  console.log(`   Saturation: ${Math.round((familyCount / memories.length) * 100)}%`);

  if (familyCount > 3) {
    console.log(`\n🚨 DIAGNOSIS: Context is poisoned with family content!`);
  } else {
    console.log(`\n✅ DIAGNOSIS: Context looks balanced.`);
  }

  process.exit(0);
}

debugPodcastContext().catch(console.error);
