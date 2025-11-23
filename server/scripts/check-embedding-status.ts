import { storage } from "../storage.js";

async function main() {
  const profile = await storage.getActiveProfile();
  if (!profile) {
    console.error("No active profile");
    process.exit(1);
  }
  
  const all = await storage.getMemoryEntries(profile.id, 99999);
  const withEmbeddings = all.filter(m => m.embedding);
  const missing = all.length - withEmbeddings.length;
  
  console.log(`\n📊 Embedding Status Report:`);
  console.log(`   Total memories: ${all.length}`);
  console.log(`   ✅ With embeddings: ${withEmbeddings.length}`);
  console.log(`   ❌ Missing embeddings: ${missing}`);
  console.log(`   📈 Coverage: ${Math.round((withEmbeddings.length / all.length) * 100)}%\n`);
  
  process.exit(0);
}

main();
