import { db } from './server/db.js';
import { topicEscalation } from './shared/schema.js';

async function checkTopics() {
  try {
    const results = await db.select().from(topicEscalation);
    console.log('TOPIC ESCALATION:');
    console.log(results);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTopics();
