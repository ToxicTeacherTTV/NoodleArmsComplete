import { storage } from "../storage";
import { Document } from "@shared/schema";
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { geminiService } from './gemini';
import { contradictionDetector } from './contradictionDetector';
import { conversationParser } from './conversationParser';

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

      // Extract and store relevant information using hierarchical approach
      await this.extractAndStoreHierarchicalKnowledge(document.profileId, extractedContent, document.filename, document.id);

    } catch (error) {
      console.error('Document processing error:', error);
      await storage.updateDocument(documentId, { processingStatus: 'FAILED' });
      throw error;
    }
  }

  // 🚀 NEW: Public method for reprocessing documents without full pipeline
  async reprocessDocument(profileId: string, extractedContent: string, filename: string, documentId: string): Promise<void> {
    console.log(`🔄 Reprocessing document ${filename} for enhanced narrative context...`);
    
    // Call the private hierarchical extraction method directly
    await this.extractAndStoreHierarchicalKnowledge(profileId, extractedContent, filename, documentId);
    
    console.log(`✅ Document reprocessing completed for ${filename}`);
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

  // New hierarchical extraction method
  private async extractAndStoreHierarchicalKnowledge(profileId: string, content: string, filename: string, documentId: string): Promise<void> {
    try {
      console.log(`🧠 Starting hierarchical extraction for ${filename}...`);
      
      // 🔧 NEW: Parse conversation to extract only Nicky's content
      console.log(`🎭 Parsing conversation to separate user and Nicky content...`);
      const nickyContent = conversationParser.extractFactRelevantContent(content, filename);
      
      // PASS 1: Extract rich stories and contexts (from Nicky's content only)
      console.log(`📖 Pass 1: Extracting stories and contexts from Nicky's responses...`);
      const stories = await geminiService.extractStoriesFromDocument(nickyContent, filename);
      console.log(`✅ Extracted ${stories.length} stories/contexts`);
      
      const storyIds: string[] = [];
      
      // Store story-level facts first
      for (const story of stories) {
        const canonicalKey = this.generateCanonicalKey(story.content);
        
        let storyFact = await storage.addMemoryEntry({
          profileId,
          type: story.type,
          content: story.content,
          importance: story.importance,
          keywords: story.keywords,
          source: filename,
          sourceId: documentId,
          canonicalKey,
          isAtomicFact: false, // This is a parent story
        });
        
        // Handle story deduplication - find existing story if insertion failed
        if (!storyFact?.id) {
          storyFact = await storage.findMemoryByCanonicalKey(profileId, canonicalKey);
        }
        
        if (storyFact?.id) {
          storyIds.push(storyFact.id);
          console.log(`📚 Stored story: ${story.content.substring(0, 60)}...`);
        } else {
          console.warn(`⚠️ Failed to store story, skipping atomic fact extraction for this story`);
        }
      }
      
      // PASS 2: Extract atomic facts from each story
      console.log(`🔬 Pass 2: Extracting atomic facts from stories...`);
      let totalAtomicFacts = 0;
      
      for (let i = 0; i < stories.length; i++) {
        const story = stories[i];
        const storyId = storyIds[i];
        
        if (!storyId) continue;
        
        try {
          const atomicFacts = await geminiService.extractAtomicFactsFromStory(
            story.content, 
            `${story.type}: ${story.keywords.join(', ')}`
          );
          
          console.log(`⚛️ Extracted ${atomicFacts.length} atomic facts from story ${i + 1}`);
          
          // Store atomic facts linked to parent story
          for (const atomicFact of atomicFacts) {
            const atomicCanonicalKey = this.generateCanonicalKey(atomicFact.content);
            
            await storage.addMemoryEntry({
              profileId,
              type: 'ATOMIC',
              content: atomicFact.content,
              importance: atomicFact.importance,
              keywords: atomicFact.keywords,
              source: filename,
              sourceId: documentId,
              canonicalKey: atomicCanonicalKey,
              isAtomicFact: true, // This is a granular fact
              parentFactId: storyId, // Link to parent story
              storyContext: atomicFact.storyContext,
            });
            
            totalAtomicFacts++;
          }
        } catch (error) {
          console.error(`❌ Failed to extract atomic facts from story ${i + 1}:`, error);
          // Continue with other stories
        }
      }
      
      console.log(`🎉 Hierarchical extraction complete!`);
      console.log(`📊 Results: ${stories.length} stories, ${totalAtomicFacts} atomic facts`);
      
      // Run contradiction detection on atomic facts
      console.log(`🔍 Running contradiction detection...`);
      await contradictionDetector.detectContradictions(profileId);
      
    } catch (error) {
      console.error('❌ Hierarchical knowledge extraction failed:', error);
      // Fallback to legacy extraction
      console.log('🔄 Falling back to legacy extraction...');
      await this.extractAndStoreKnowledgeLegacy(profileId, content, filename, documentId);
    }
  }
  
  // Legacy extraction method as fallback
  private async extractAndStoreKnowledgeLegacy(profileId: string, content: string, filename: string, documentId?: string): Promise<void> {
    return this.extractAndStoreKnowledge(profileId, content, filename, documentId);
  }

  async extractAndStoreKnowledge(profileId: string, content: string, filename: string, documentId?: string): Promise<void> {
    try {
      console.log(`Starting AI-powered fact extraction for ${filename}...`);
      
      // 🔧 NEW: Parse conversation to extract only Nicky's content
      console.log(`🎭 Parsing conversation to separate user and Nicky content...`);
      const nickyContent = conversationParser.extractFactRelevantContent(content, filename);
      
      // Use Gemini to intelligently extract facts from the content (Nicky only)
      const extractedFacts = await geminiService.extractFactsFromDocument(nickyContent, filename);
      
      console.log(`Extracted ${extractedFacts.length} facts from ${filename}`);
      
      // Track processed facts to prevent intra-document over-boosting
      const processedInThisDocument = new Set<string>();
      let storedCount = 0;
      let boostedCount = 0;
      
      for (const fact of extractedFacts) {
        const canonicalKey = this.generateCanonicalKey(fact.content);
        
        // Skip if we already processed this exact fact in this document
        if (processedInThisDocument.has(canonicalKey)) {
          continue;
        }
        processedInThisDocument.add(canonicalKey);
        
        // Check if this fact already exists
        const existingFact = await storage.findMemoryByCanonicalKey(profileId, canonicalKey);
        
        if (existingFact) {
          // Fact exists - boost confidence and support count (max +10 per document)
          const newSupportCount = (existingFact.supportCount || 1) + 1;
          const confidenceBoost = 10; // Fixed 10 point boost per new document
          const newConfidence = Math.min(100, (existingFact.confidence || 50) + confidenceBoost);
          
          await storage.updateMemoryConfidence(existingFact.id, newConfidence, newSupportCount);
          boostedCount++;
          
          console.log(`Boosted confidence for fact: "${fact.content.substring(0, 50)}..." (${existingFact.confidence || 50} → ${newConfidence}, support: ${newSupportCount})`);
        } else {
          // New fact - determine initial confidence based on source and importance
          const initialConfidence = this.calculateInitialConfidence(fact.importance, filename);
          
          const newMemoryEntry = await storage.addMemoryEntry({
            profileId,
            type: fact.type,
            content: fact.content.trim(),
            importance: fact.importance,
            confidence: initialConfidence,
            sourceId: documentId || `doc:${filename}`,
            supportCount: 1,
            canonicalKey,
            source: `ai-extract:${filename}`,
          });
          
          // Check for contradictions with this new fact
          try {
            const contradictionGroup = await contradictionDetector.checkAndResolveContradictions(profileId, newMemoryEntry);
            if (contradictionGroup) {
              console.log(`🔍 Resolved contradiction for fact: "${fact.content.substring(0, 50)}..." in group ${contradictionGroup.groupId}`);
            }
          } catch (error) {
            console.error('Error checking contradictions for new fact:', error);
            // Continue processing even if contradiction detection fails
          }
          
          storedCount++;
        }
      }
      
      console.log(`Processed ${extractedFacts.length} facts from ${filename}: ${storedCount} new, ${boostedCount} confidence boosted`);
      
    } catch (error) {
      console.error('AI fact extraction failed, falling back to keyword-based extraction:', error);
      
      // Fallback to original keyword-based extraction if AI fails
      await this.fallbackExtractAndStoreKnowledge(profileId, content, filename, documentId);
    }
  }

  private async fallbackExtractAndStoreKnowledge(profileId: string, content: string, filename: string, documentId?: string): Promise<void> {
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
    
    // Track processed facts to prevent intra-document over-boosting
    const processedInThisDocument = new Set<string>();
    
    for (const chunk of chunks) {
      const lowerChunk = chunk.toLowerCase();
      
      // Check if chunk contains relevant character content
      const relevantKeywordCount = characterKeywords.filter(keyword => 
        lowerChunk.includes(keyword)
      ).length;
      
      // Only store chunks with substantial relevant content AND clear Nicky references
      if (relevantKeywordCount >= 2 && chunk.trim().length > 100) {
        // CRITICAL: Only store content that is clearly about/by Nicky
        // Check for explicit Nicky references or first-person statements that could be Nicky's
        const hasNickyReference = lowerChunk.includes('nicky') || lowerChunk.includes('dente') || 
                                 lowerChunk.includes('camping them softly') || lowerChunk.includes('earl') || 
                                 lowerChunk.includes('vice don');
        
        // Skip user preferences that aren't about Nicky
        const looksLikeUserContent = (lowerChunk.includes('i prefer') || lowerChunk.includes('my main') || 
                                    lowerChunk.includes('i like') || lowerChunk.includes('i play')) && 
                                   !hasNickyReference;
        
        if (!hasNickyReference && looksLikeUserContent) {
          continue; // Skip storing user preferences as Nicky's traits
        }
        
        // If no clear Nicky reference, only store general DBD knowledge, not personal preferences
        if (!hasNickyReference) {
          const isPersonalPreference = lowerChunk.includes('prefer') || lowerChunk.includes('like') || 
                                     lowerChunk.includes('favorite') || lowerChunk.includes('main');
          if (isPersonalPreference) {
            continue; // Skip personal preferences without clear attribution
          }
        }
        
        // Determine content type and importance  
        let type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT' = 'FACT';
        let importance = hasNickyReference ? 3 : 2; // Higher importance for explicit Nicky content
        
        // Character personality and preferences (only if about Nicky)
        if ((lowerChunk.includes('prefer') || lowerChunk.includes('like') || lowerChunk.includes('favorite')) && hasNickyReference) {
          type = 'PREFERENCE';
          importance = 4;
        }
        // Character backstory and lore
        else if (lowerChunk.includes('backstory') || lowerChunk.includes('history') || lowerChunk.includes('origin')) {
          type = 'LORE';
          importance = hasNickyReference ? 4 : 2;
        }
        // Game strategy and tactics
        else if (lowerChunk.includes('strategy') || lowerChunk.includes('tactics') || lowerChunk.includes('gameplay')) {
          type = 'CONTEXT';
          importance = hasNickyReference ? 3 : 2;
        }
        
        // Generate canonical key from raw content (before adding prefixes)
        const rawContent = chunk.trim();
        const canonicalKey = this.generateCanonicalKey(rawContent);
        
        // Skip if we already processed this exact fact in this document
        if (processedInThisDocument.has(canonicalKey)) {
          continue;
        }
        processedInThisDocument.add(canonicalKey);
        
        // Check if this fact already exists
        const existingFact = await storage.findMemoryByCanonicalKey(profileId, canonicalKey);
        
        if (existingFact) {
          // Fact exists - boost confidence and support count (max +10 per document)
          const newSupportCount = (existingFact.supportCount || 1) + 1;
          const confidenceBoost = 10; // Fixed 10 point boost per new document
          const newConfidence = Math.min(100, (existingFact.confidence || 50) + confidenceBoost);
          
          await storage.updateMemoryConfidence(existingFact.id, newConfidence, newSupportCount);
          console.log(`Boosted fallback fact confidence: "${rawContent.substring(0, 50)}..." (${existingFact.confidence || 50} → ${newConfidence})`);
        } else {
          // New fact - add attribution prefix if no clear Nicky reference
          let displayContent = rawContent;
          if (!hasNickyReference) {
            displayContent = `Document reference: ${rawContent}`;
          }
          
          const initialConfidence = this.calculateInitialConfidence(importance, filename);
          
          const newMemoryEntry = await storage.addMemoryEntry({
            profileId,
            type,
            content: displayContent,
            importance,
            confidence: initialConfidence,
            sourceId: documentId || `doc:${filename}`,
            supportCount: 1,
            canonicalKey,
            source: `document:${filename}`,
          });
          
          // Check for contradictions with this new fact
          try {
            const contradictionGroup = await contradictionDetector.checkAndResolveContradictions(profileId, newMemoryEntry);
            if (contradictionGroup) {
              console.log(`🔍 Resolved fallback contradiction for fact: "${rawContent.substring(0, 50)}..." in group ${contradictionGroup.groupId}`);
            }
          } catch (error) {
            console.error('Error checking contradictions for fallback fact:', error);
            // Continue processing even if contradiction detection fails
          }
        }
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

  // Generate a canonical key for fact deduplication
  private generateCanonicalKey(content: string): string {
    // Normalize content for consistent matching
    const normalized = content
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .substring(0, 100);      // Limit length
    
    // Simple hash for canonical key
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `fact_${Math.abs(hash)}`;
  }

  // Calculate initial confidence based on source reliability and importance
  private calculateInitialConfidence(importance: number, filename: string): number {
    let baseConfidence = 50; // Default medium confidence
    
    // Boost confidence based on importance (1-5 scale from Gemini)
    const importanceBoost = (importance - 1) * 10; // 0-40 point boost
    
    // Boost confidence based on source type
    let sourceBoost = 0;
    const lowerFilename = filename.toLowerCase();
    
    if (lowerFilename.includes('official') || lowerFilename.includes('doc')) {
      sourceBoost = 15; // Official documentation
    } else if (lowerFilename.includes('note') || lowerFilename.includes('fact')) {
      sourceBoost = 10; // Personal notes/facts
    } else if (lowerFilename.includes('chat') || lowerFilename.includes('log')) {
      sourceBoost = 5;  // Chat logs or conversation logs
    }
    
    const confidence = Math.min(90, baseConfidence + importanceBoost + sourceBoost);
    return Math.max(30, confidence); // Minimum 30% confidence
  }
}

export const documentProcessor = new DocumentProcessor();
