import { db } from "./server/db";
import { documents } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkTrainingData() {
  const trainingDocs = await db.select().from(documents).where(eq(documents.documentType, 'TRAINING_EXAMPLE'));
  console.log(`Found ${trainingDocs.length} training examples.`);
  
  trainingDocs.slice(0, 5).forEach((doc, i) => {
    console.log(`\n--- Example ${i+1} ---`);
    console.log(doc.extractedContent?.substring(0, 500));
  });
}

checkTrainingData().catch(console.error);
