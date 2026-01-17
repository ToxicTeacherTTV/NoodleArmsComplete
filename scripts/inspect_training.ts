
import 'dotenv/config';
import { db } from '../server/db';
import { documents } from '@shared/schema';
import { desc, eq, like } from 'drizzle-orm';
import * as fs from 'fs';

async function inspectTrainingExamples() {
  try {
    console.log("Fetching training examples...");
    
    // Get training examples
    const examples = await db.select().from(documents)
      .where(eq(documents.documentType, 'TRAINING_EXAMPLE'))
      .orderBy(desc(documents.createdAt))
      .limit(20);

    if (examples.length === 0) {
      console.log("No training examples found.");
      return;
    }

    let output = `\n=== TRAINING EXAMPLES INSPECTION (${examples.length} samples) ===\n`;
    
    examples.forEach((doc, index) => {
      output += `\n--- Example ${index + 1} [ID: ${doc.id}] ---\n`;
      // Check specific columns where content might be stored
      const content = doc.extractedContent || doc.content || "";
      
      // Highlight potential issues (long bracketed text)
      const bracketMatches = content.match(/\[[^\]]{20,}\]/g);
      
      output += `Preview:\n${content.substring(0, 300)}${content.length > 300 ? '...' : ''}\n`;
      
      if (bracketMatches) {
        output += `\n⚠️ POTENTIAL BAD TAGS FOUND:\n`;
        bracketMatches.forEach(match => {
            output += `  ${match}\n`;
        });
      }
    });

    fs.writeFileSync('training_examples_log.md', output);
    console.log("Log written to training_examples_log.md");

  } catch (error) {
    console.error("Error inspecting training examples:", error);
  } finally {
    process.exit(0);
  }
}

inspectTrainingExamples();
