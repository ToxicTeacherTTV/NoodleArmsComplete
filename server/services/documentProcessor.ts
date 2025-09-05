import { storage } from "../storage";
import { Document } from "@shared/schema";
import pdf from 'pdf-parse';

interface DocumentChunk {
  content: string;
  metadata: {
    page?: number;
    section?: string;
  };
}

class DocumentProcessor {
  async processDocument(documentId: string, buffer: Buffer): Promise<void> {
    try {
      await storage.updateDocument(documentId, { processingStatus: 'PROCESSING' });
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      let extractedContent = '';
      let chunks: string[] = [];

      // Process different file types
      if (document.contentType === 'application/pdf') {
        const pdfData = await pdf(buffer);
        extractedContent = pdfData.text;
        chunks = this.chunkText(extractedContent);
      } else if (document.contentType.includes('text/')) {
        extractedContent = buffer.toString('utf-8');
        chunks = this.chunkText(extractedContent);
      } else {
        throw new Error(`Unsupported file type: ${document.contentType}`);
      }

      // Update document with processed content
      await storage.updateDocument(documentId, {
        extractedContent,
        chunks,
        processingStatus: 'COMPLETED',
      });

      // Extract and store relevant information as memory entries
      await this.extractAndStoreKnowledge(document.profileId, extractedContent, document.filename);

    } catch (error) {
      console.error('Document processing error:', error);
      await storage.updateDocument(documentId, { processingStatus: 'FAILED' });
      throw error;
    }
  }

  private chunkText(text: string, maxChunkSize = 1000, overlap = 100): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let currentSize = 0;
    
    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence.trim() + '.';
      
      if (currentSize + sentenceWithPunctuation.length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Create overlap by keeping last few sentences
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-overlap);
        currentChunk = overlapWords.join(' ') + ' ' + sentenceWithPunctuation;
        currentSize = currentChunk.length;
      } else {
        currentChunk += ' ' + sentenceWithPunctuation;
        currentSize += sentenceWithPunctuation.length;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private async extractAndStoreKnowledge(profileId: string, content: string, filename: string): Promise<void> {
    // Extract DBD-specific knowledge
    const dbdKeywords = [
      'killer', 'survivor', 'generator', 'hook', 'pallet', 'vault', 'loop',
      'bloodweb', 'entity', 'trial', 'offering', 'add-on', 'perk', 'bloodpoint',
      'dead by daylight', 'dbd', 'behavior', 'bhvr'
    ];

    const lines = content.split('\n').filter(line => line.trim().length > 20);
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Check if line contains DBD-related content
      const isDbdRelated = dbdKeywords.some(keyword => lowerLine.includes(keyword));
      
      if (isDbdRelated) {
        await storage.addMemoryEntry({
          profileId,
          type: 'FACT',
          content: line.trim(),
          importance: 2,
          source: `document:${filename}`,
        });
      }
    }
  }

  async searchDocuments(profileId: string, query: string): Promise<any[]> {
    const documents = await storage.getProfileDocuments(profileId);
    const results: any[] = [];
    
    for (const doc of documents) {
      if (doc.chunks && doc.processingStatus === 'COMPLETED') {
        const relevantChunks = doc.chunks.filter(chunk => 
          chunk.toLowerCase().includes(query.toLowerCase())
        );
        
        if (relevantChunks.length > 0) {
          await storage.incrementDocumentRetrieval(doc.id);
          
          results.push({
            documentId: doc.id,
            filename: doc.filename,
            content: relevantChunks.slice(0, 3).join(' ... '), // Top 3 relevant chunks
            relevantChunks: relevantChunks.length,
          });
        }
      }
    }
    
    return results.sort((a, b) => b.relevantChunks - a.relevantChunks);
  }
}

export const documentProcessor = new DocumentProcessor();
