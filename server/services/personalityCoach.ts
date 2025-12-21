
import fs from 'fs/promises';
import path from 'path';

const FEEDBACK_FILE = path.join(process.cwd(), 'server', 'data', 'personality_feedback.json');

interface FeedbackEntry {
  id: string;
  content: string;
  createdAt: string;
  sourceConversationId?: string;
}

export class PersonalityCoach {
  private async ensureFile() {
    try {
      await fs.access(FEEDBACK_FILE);
    } catch {
      await fs.mkdir(path.dirname(FEEDBACK_FILE), { recursive: true });
      await fs.writeFile(FEEDBACK_FILE, JSON.stringify([], null, 2));
    }
  }

  async getActiveFeedback(): Promise<string[]> {
    await this.ensureFile();
    try {
      const data = await fs.readFile(FEEDBACK_FILE, 'utf-8');
      const entries: FeedbackEntry[] = JSON.parse(data);
      // Return the last 3 feedback items, reversed (newest first)
      // We limit to 3 to prevent "over-correction" or "hard coding" behavior
      return entries.slice(-3).reverse().map(e => e.content);
    } catch (error) {
      console.error('Error reading feedback file:', error);
      return [];
    }
  }

  async addFeedback(content: string, sourceConversationId?: string) {
    await this.ensureFile();
    try {
      const data = await fs.readFile(FEEDBACK_FILE, 'utf-8');
      const entries: FeedbackEntry[] = JSON.parse(data);
      
      const newEntry: FeedbackEntry = {
        id: Date.now().toString(),
        content,
        createdAt: new Date().toISOString(),
        sourceConversationId
      };

      entries.push(newEntry);
      await fs.writeFile(FEEDBACK_FILE, JSON.stringify(entries, null, 2));
      return newEntry;
    } catch (error) {
      console.error('Error saving feedback:', error);
      throw error;
    }
  }

  async clearFeedback() {
    await this.ensureFile();
    await fs.writeFile(FEEDBACK_FILE, JSON.stringify([], null, 2));
  }
}

export const personalityCoach = new PersonalityCoach();
