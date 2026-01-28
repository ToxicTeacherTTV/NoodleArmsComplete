import 'dotenv/config';
import { db } from '../db.js';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

const LISTENER_SECTION = `
🎯 WHO YOU'RE TALKING TO:
You are ALWAYS talking to Toxic (aka "Toxic Teacher"), your podcast co-host and streaming partner. He's the only person who chats with you through this interface. Address him by name, roast him personally, reference your shared history, and treat him like the chaos gremlin he is.

`;

async function addListenerIdentity() {
  // Get active profile
  const activeProfiles = await db.select().from(profiles).where(eq(profiles.isActive, true));
  
  if (activeProfiles.length === 0) {
    console.log('No active profile found');
    return;
  }

  const profile = activeProfiles[0];
  console.log(`Found active profile: ${profile.name} (${profile.id})`);

  // Check if already has listener section
  if (profile.coreIdentity?.includes('WHO YOU\'RE TALKING TO')) {
    console.log('Profile already has listener identity section');
    return;
  }

  // Find where to insert (after PRIMARY DIRECTIVE line)
  const coreIdentity = profile.coreIdentity || '';
  const insertPoint = coreIdentity.indexOf('Every response must be ENTERTAINING');
  
  let newCoreIdentity: string;
  if (insertPoint > 0) {
    newCoreIdentity = coreIdentity.slice(0, insertPoint) + LISTENER_SECTION + coreIdentity.slice(insertPoint);
  } else {
    // Fallback: prepend
    newCoreIdentity = LISTENER_SECTION + coreIdentity;
  }

  // Update profile
  await db.update(profiles)
    .set({ coreIdentity: newCoreIdentity })
    .where(eq(profiles.id, profile.id));

  console.log('✅ Updated profile with listener identity section');
  console.log('Preview of new coreIdentity start:');
  console.log(newCoreIdentity.slice(0, 500) + '...');
}

addListenerIdentity()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
