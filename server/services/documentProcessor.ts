import { storage } from "../storage";
import { Document } from "@shared/schema";
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

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
      } else if (document.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Process Word documents (.docx)
        const result = await mammoth.extractRawText({ buffer });
        extractedContent = result.value;
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

  private chunkText(text: string, maxChunkSize = 2500, overlap = 200): string[] {
    const chunks: string[] = [];
    
    // First split by double newlines (paragraphs), then by single newlines if needed
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      
      // If adding this paragraph would exceed chunk size
      if (currentChunk && (currentChunk.length + trimmedParagraph.length) > maxChunkSize) {
        chunks.push(currentChunk.trim());
        
        // Create overlap by keeping last portion of previous chunk
        const sentences = currentChunk.split(/[.!?]+/).filter(s => s.trim());
        const overlapSentences = sentences.slice(-2); // Keep last 2 sentences for context
        currentChunk = overlapSentences.join('. ') + '. ' + trimmedParagraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
      }
      
      // If single paragraph is too large, split it by sentences
      if (currentChunk.length > maxChunkSize * 1.5) {
        const sentences = currentChunk.split(/[.!?]+/).filter(s => s.trim());
        let tempChunk = '';
        
        for (const sentence of sentences) {
          if (tempChunk && (tempChunk.length + sentence.length) > maxChunkSize) {
            chunks.push(tempChunk.trim() + '.');
            tempChunk = sentence;
          } else {
            tempChunk += (tempChunk ? '. ' : '') + sentence;
          }
        }
        
        currentChunk = tempChunk;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  async extractAndStoreKnowledge(profileId: string, content: string, filename: string): Promise<void> {
    // Enhanced extraction for character-specific knowledge
    const characterKeywords = [
      // DBD game content
      'killer', 'survivor', 'generator', 'hook', 'pallet', 'vault', 'loop', 'bloodweb', 'entity', 'trial', 'offering', 'add-on', 'perk', 'bloodpoint', 'dead by daylight', 'dbd', 'behavior', 'bhvr',
      // Character personality
      'nicky', 'dente', 'sabam', 'streaming', 'podcast', 'camping them softly', 'earl', 'vice don', 'digital entertainment',
      // Character preferences and lore
      'ghostface', 'twins', 'nurse', 'hillbilly', 'wraith', 'demogorgon', 'plague', 'spirit'
    ];

    // Use larger paragraph-based chunks instead of line-by-line processing
    const chunks = this.chunkText(content, 1500, 150);
    
    for (const chunk of chunks) {
      const lowerChunk = chunk.toLowerCase();
      
      // Check if chunk contains relevant character content
      const relevantKeywordCount = characterKeywords.filter(keyword => 
        lowerChunk.includes(keyword)
      ).length;
      
      // Only store chunks with substantial relevant content (2+ keywords)
      if (relevantKeywordCount >= 2 && chunk.trim().length > 100) {
        // Determine content type and importance
        let type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT' = 'FACT';
        let importance = 2;
        
        // Character personality and preferences
        if (lowerChunk.includes('prefer') || lowerChunk.includes('like') || lowerChunk.includes('favorite')) {
          type = 'PREFERENCE';
          importance = 4;
        }
        // Character backstory and lore
        else if (lowerChunk.includes('backstory') || lowerChunk.includes('history') || lowerChunk.includes('origin')) {
          type = 'LORE';
          importance = 4;
        }
        // Game strategy and tactics
        else if (lowerChunk.includes('strategy') || lowerChunk.includes('tactics') || lowerChunk.includes('gameplay')) {
          type = 'CONTEXT';
          importance = 3;
        }
        
        await storage.addMemoryEntry({
          profileId,
          type,
          content: chunk.trim(),
          importance,
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
