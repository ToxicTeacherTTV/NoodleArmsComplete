
import 'dotenv/config';
import { storage } from './server/storage.js';
import { embeddingServiceInstance } from './server/services/embeddingService.js';

async function test() {
  const query = "hey nicky, what's going on man?";
  console.log(`Testing search for: "${query}"`);
  
  try {
    const results = await embeddingServiceInstance.searchSimilarTrainingExamples(query, "any-profile-id", 5);
    console.log('Results:', results);
  } catch (error) {
    console.error('Search failed:', error);
  }
}

test().catch(console.error);
