import { storage } from '../storage.js';

async function check() {
  const profile = await storage.getActiveProfile();
  if (!profile) { console.log('No profile'); return; }

  // Check entities
  const entities = await storage.getAllEntities(profile.id);
  const salvatore = entities.people.filter(p =>
    p.canonicalName.toLowerCase().includes('salvatore') ||
    p.canonicalName.toLowerCase().includes('father') ||
    p.disambiguation?.toLowerCase().includes('father')
  );

  console.log('=== ENTITIES (Salvatore/Father) ===');
  if (salvatore.length > 0) {
    salvatore.forEach(p => {
      console.log(`✅ ${p.canonicalName}`);
      console.log(`   Disambiguation: ${p.disambiguation || 'none'}`);
      console.log(`   Relationship: ${p.relationship || 'none'}`);
    });
  } else {
    console.log('❌ No Salvatore/Father entities found');
    console.log('\nAll people entities:');
    entities.people.slice(0, 20).forEach(p => console.log(`  - ${p.canonicalName}`));
    if (entities.people.length > 20) console.log(`  ... and ${entities.people.length - 20} more`);
  }

  // Check memories
  const memories = await storage.getMemoryEntries(profile.id, 99999);
  const salvatoreMemories = memories.filter(m =>
    m.content.toLowerCase().includes('salvatore')
  );

  console.log('\n=== MEMORIES mentioning Salvatore ===');
  if (salvatoreMemories.length > 0) {
    salvatoreMemories.forEach(m => console.log(`✅ ${m.content.substring(0, 120)}...`));
  } else {
    console.log('❌ No memories mentioning Salvatore');
  }

  // Check for father mentions
  const fatherMemories = memories.filter(m =>
    m.content.toLowerCase().includes('father') &&
    m.source === 'podcast_episode'
  );
  console.log(`\n=== PODCAST MEMORIES mentioning "father" (${fatherMemories.length}) ===`);
  fatherMemories.slice(0, 5).forEach(m => console.log(`  - ${m.content.substring(0, 100)}...`));
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
