
import { storage } from '../server/storage.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const profile = await storage.getActiveProfile();
    if (profile) {
        console.log("--- CORE IDENTITY ---");
        console.log(profile.coreIdentity);
        console.log("--- END CORE IDENTITY ---");
    } else {
        console.log("No active profile found.");
    }
    process.exit(0);
}

main().catch(console.error);
