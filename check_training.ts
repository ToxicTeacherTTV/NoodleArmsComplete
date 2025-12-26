import { db } from './server/db';
import { documents } from './shared/schema';
import { eq, desc } from 'drizzle-orm';

async function checkTraining() {
  const examples = await db.select()
    .from(documents)
    .where(eq(documents.documentType, 'TRAINING_EXAMPLE'))
    .orderBy(desc(documents.createdAt))
    .limit(5);

  examples.forEach(ex => {
    console.log(`ID: ${ex.id}`);
    console.log(`Content:\n${ex.extractedContent}`);
    console.log('-'.repeat(40));
  });
  process.exit(0);
}

checkTraining();
