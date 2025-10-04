import { storage } from "../storage";
import { Document } from "@shared/schema";
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { geminiService } from './gemini';
import { contradictionDetector } from './contradictionDetector';
import { conversationParser } from './conversationParser';
import { entityExtraction } from './entityExtraction';
import natural from 'natural';
import { encoding_for_model } from 'tiktoken';

interface DocumentChunk {
  content: string;
  metadata: {
    page?: number;
    section?: string;
  };
}

interface ExtractedStory {
  content: string;
  entities: {
    people: string[];
    places: string[];
    events: string[];
  };
  storyArc: 'complete' | 'partial' | 'fragment';
  relatedChunks: string[];
  importance: number;
}

interface GlobalEntities {
  people: string[];
  places: string[];
  events: string[];
}

class DocumentProcessor {
  private encoder: any;
  private sentenceTokenizer: any;

  constructor() {
    try {
      this.encoder = encoding_for_model('gpt-4');
    } catch (error) {
      console.warn('⚠️ Failed to initialize tiktoken encoder, falling back to character-based chunking');
      this.encoder = null;
    }
    
    try {
      // @ts-ignore - Natural.js TypeScript definitions may be incorrect
      this.sentenceTokenizer = new natural.SentenceTokenizer();
    } catch (error) {
      console.warn('⚠️ Failed to initialize sentence tokenizer');
      this.sentenceTokenizer = {
        tokenize: (text: string) => text.split(/[.!?]+/).filter(s => s.trim())
      };
    }
  }
  
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
        chunks = this.intelligentChunkText(extractedContent);
      } else if (document.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Process Word documents (.docx)
        const result = await mammoth.extractRawText({ buffer });
        extractedContent = result.value;
        chunks = this.intelligentChunkText(extractedContent);
      } else if (document.contentType.includes('text/')) {
        extractedContent = buffer.toString('utf-8');
        chunks = this.intelligentChunkText(extractedContent);
      } else {
        throw new Error(`Unsupported file type: ${document.contentType}`);
      }

      // Update document with processed content
      await storage.updateDocument(documentId, {
        extractedContent,
        chunks,
        processingStatus: 'COMPLETED',
      });

      // 🚫 DISABLED: No longer auto-extract knowledge on upload
      // Users must manually trigger extraction via "Extract Facts" or "Reprocess" buttons
      // This prevents unwanted API costs and gives users control over large documents
      // await this.extractAndStoreHierarchicalKnowledge(document.profileId, extractedContent, document.filename, document.id);

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

  // 🎯 BACKGROUND: Start entity extraction in the background without blocking
  async startBackgroundProcessing(profileId: string, extractedContent: string, filename: string, documentId: string): Promise<void> {
    console.log(`🚀 Starting background processing for ${filename}...`);
    
    // Update status to indicate processing has started
    await storage.updateDocument(documentId, { 
      processingStatus: 'PROCESSING',
      processingProgress: 0 
    });

    // Run extraction in the background (don't await)
    setImmediate(async () => {
      try {
        await this.extractAndStoreHierarchicalKnowledgeInBackground(profileId, extractedContent, filename, documentId);
        
        // Mark as completed
        await storage.updateDocument(documentId, { 
          processingStatus: 'COMPLETED',
          processingProgress: 100
        });
        
        console.log(`✅ Background processing completed for ${filename}`);
      } catch (error) {
        console.error(`❌ Background processing failed for ${filename}:`, error);
        await storage.updateDocument(documentId, { 
          processingStatus: 'FAILED',
          processingProgress: 0
        });
      }
    });

    console.log(`✅ Background job queued for ${filename}`);
  }

  // 📦 BATCHED: Process entities in batches to prevent database overload
  private async extractAndStoreHierarchicalKnowledgeInBackground(
    profileId: string, 
    content: string, 
    filename: string, 
    documentId: string
  ): Promise<void> {
    console.log(`🔄 Running batched entity extraction for ${filename}...`);
    
    // First, do the entity extraction without writing to DB
    const chunks = this.intelligentChunkText(content);
    console.log(`📝 Created ${chunks.length} chunks`);
    
    // Update progress: 25% (chunking complete)
    await storage.updateDocument(documentId, { processingProgress: 25 });
    
    // Process in smaller batches to avoid overwhelming the database
    const BATCH_SIZE = 10;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);
      
      // Process this batch
      await this.processBatch(profileId, batch, filename, documentId);
      
      // Update progress
      const progress = Math.min(25 + Math.floor(((i + BATCH_SIZE) / chunks.length) * 70), 95);
      await storage.updateDocument(documentId, { processingProgress: progress });
      
      // Small delay to prevent connection saturation
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Batched extraction completed for ${filename}`);
  }

  // Process a single batch of chunks
  private async processBatch(profileId: string, chunks: string[], filename: string, documentId: string): Promise<void> {
    // Call the original extraction method for this batch
    // We'll need to modify extractAndStoreHierarchicalKnowledge to accept chunks
    await this.extractAndStoreHierarchicalKnowledge(profileId, chunks.join('\n\n'), filename, documentId);
  }

  // Enhanced chunking with global entity extraction and story arc detection
  private intelligentChunkText(text: string, maxTokens: number = 500): string[] {
    try {
      console.log('🧠 Starting intelligent document processing...');
      
      // Step 1: Clean the text first
      text = this.cleanText(text);
      
      // Step 2: Extract entities BEFORE chunking so we don't lose them
      const globalEntities = this.extractGlobalEntitiesSync(text);
      console.log(`🔍 Extracted ${globalEntities.people.length} people, ${globalEntities.places.length} places globally`);
      
      // Step 3: Chunk intelligently
      const chunks = this.intelligentChunk(text, maxTokens);
      console.log(`📝 Created ${chunks.length} intelligent chunks`);
      
      // Step 4: Process each chunk with context for story detection
      const stories: ExtractedStory[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const story = this.processChunkSync(
          chunks[i], 
          chunks[i-1], // previous chunk for context
          chunks[i+1], // next chunk for context
          globalEntities
        );
        stories.push(story);
      }
      
      // Step 5: Reconnect related stories
      const connectedStories = this.connectRelatedStories(stories);
      
      // Return the enhanced chunks with preserved context
      return connectedStories.map(story => story.content);
      
    } catch (error) {
      console.error('❌ Intelligent chunking failed, falling back to legacy:', error);
      return this.legacyChunkText(text);
    }
  }
  
  // Fallback to original chunking method
  private legacyChunkText(text: string, maxChunkSize = 2500, overlap = 200): string[] {
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

  /**
   * Classify content as conversational vs informational
   */
  private classifyContent(content: string, filename: string): { mode: 'conversational' | 'informational', metrics: any } {
    const lines = content.split('\n');
    const contentLength = content.length;
    
    // Calculate features for classification
    const questionCount = (content.match(/[?]/g) || []).length;
    const dialogueMarkers = (content.match(/^(user|nicky|assistant|you)[\s:]/gmi) || []).length;
    const sectionHeaders = (content.match(/^#{1,3}\s|^#\s.*|^\*\*.*\*\*$|^Section\s\d+/gmi) || []).length;
    const longParagraphs = lines.filter(line => line.length > 200).length;
    const avgLineLength = lines.length > 0 ? contentLength / lines.length : 0;
    
    // Try conversation parsing to get actual metrics
    const parsed = conversationParser.parseConversation(content, filename);
    const nickyTurns = parsed.turns.filter(t => t.speaker === 'nicky').length;
    const userTurns = parsed.turns.filter(t => t.speaker === 'user').length;
    const totalTurns = parsed.totalTurns;
    const nickyContentRatio = parsed.nickyContent.length / contentLength;
    
    const metrics = {
      contentLength,
      questionCount,
      dialogueMarkers,
      sectionHeaders,
      longParagraphs,
      avgLineLength,
      totalTurns,
      nickyTurns,
      userTurns,
      nickyContentRatio
    };
    
    // Classification logic - conservative approach
    const isConversational = (
      (totalTurns >= 6 && (nickyTurns >= 2 || nickyContentRatio >= 0.15)) ||
      (questionCount >= 3 && dialogueMarkers >= 4) ||
      (nickyTurns >= 2 && userTurns >= 2)
    );
    
    const isInformational = (
      (totalTurns < 6 && sectionHeaders >= 3) ||
      (nickyContentRatio < 0.05 && longParagraphs > 5) ||
      (avgLineLength > 100 && sectionHeaders >= 2) ||
      filename.toLowerCase().includes('guide') ||
      filename.toLowerCase().includes('patch') ||
      filename.toLowerCase().includes('manual') ||
      filename.toLowerCase().includes('.pdf')
    );
    
    // Default to conversational to preserve existing behavior
    const mode = isInformational && !isConversational ? 'informational' : 'conversational';
    
    console.log(`📊 Content classification for ${filename}: ${mode}`);
    console.log(`📈 Metrics: turns=${totalTurns}, nicky=${nickyTurns}, ratio=${nickyContentRatio.toFixed(3)}, headers=${sectionHeaders}`);
    
    return { mode, metrics };
  }

  // New hierarchical extraction method with content-type routing
  private async extractAndStoreHierarchicalKnowledge(profileId: string, content: string, filename: string, documentId: string): Promise<void> {
    try {
      console.log(`🧠 Starting hierarchical extraction for ${filename}...`);
      
      // 🚀 NEW: Classify content type and route accordingly
      const classification = this.classifyContent(content, filename);
      let contentToProcess = content;
      let processedWithConversational = false;
      
      if (classification.mode === 'conversational') {
        // Use existing conversation parsing for chat logs
        console.log(`🎭 Processing as conversational content - extracting Nicky's responses...`);
        contentToProcess = conversationParser.extractFactRelevantContent(content, filename);
        processedWithConversational = true;
      } else {
        // Process full content for informational documents
        console.log(`📖 Processing as informational content - using full document...`);
        contentToProcess = content;
      }
      
      // Safety fallback: if conversational processing yielded very little content, retry as informational
      if (processedWithConversational && contentToProcess.length < 2000 && content.length > 10000) {
        console.log(`⚠️ Conversational processing yielded little content (${contentToProcess.length} chars from ${content.length}), retrying as informational...`);
        contentToProcess = content;
      }
      
      // PASS 1: Extract rich stories and contexts (from processed content)
      console.log(`📖 Pass 1: Extracting stories and contexts from processed content...`);
      const stories = await geminiService.extractStoriesFromDocument(contentToProcess, filename);
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
          const existingStory = await storage.findMemoryByCanonicalKey(profileId, canonicalKey);
          if (existingStory) {
            storyFact = existingStory;
          }
        }
        
        if (storyFact?.id) {
          storyIds.push(storyFact.id);
          console.log(`📚 Stored story: ${story.content.substring(0, 60)}...`);
          
          // 🔗 NEW: Extract and link entities for this story
          try {
            const entityLinks = await entityExtraction.processMemoryForEntityLinking(
              story.content, 
              profileId, 
              storage
            );
            
            if (entityLinks.personId || entityLinks.placeId || entityLinks.eventId) {
              await storage.linkMemoryToEntities(storyFact.id, entityLinks);
              console.log(`🔗 Linked story to ${entityLinks.entitiesCreated} entities`);
            }
          } catch (error) {
            console.error(`❌ Failed to link entities for story:`, error);
            // Continue processing - don't fail the whole reprocessing
          }
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
            
            const atomicMemory = await storage.addMemoryEntry({
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
            
            // 🔗 NEW: Extract and link entities for this atomic fact
            if (atomicMemory?.id) {
              try {
                const entityLinks = await entityExtraction.processMemoryForEntityLinking(
                  atomicFact.content, 
                  profileId, 
                  storage
                );
                
                if (entityLinks.personId || entityLinks.placeId || entityLinks.eventId) {
                  await storage.linkMemoryToEntities(atomicMemory.id, entityLinks);
                  console.log(`🔗 Linked atomic fact to ${entityLinks.entitiesCreated} entities`);
                }
              } catch (error) {
                console.error(`❌ Failed to link entities for atomic fact:`, error);
                // Continue processing - don't fail the whole reprocessing
              }
            }
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
      // Note: Contradiction detection runs automatically during memory entry creation
      
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
    const chunks = this.legacyChunkText(content, 1500, 150);
    
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

  // ==========================================
  // INTELLIGENT DOCUMENT PROCESSING METHODS
  // ==========================================

  private cleanText(text: string): string {
    // Fix common PDF extraction issues
    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/(\w)-\s+(\w)/g, '$1$2') // Reconnect hyphenated words
      .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
      .replace(/(\w)\s*\n\s*(\w)/g, '$1 $2') // Join broken sentences
      .trim();
  }

  private intelligentChunk(text: string, maxTokens: number = 500): string[] {
    // Split into paragraphs first
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const paragraph of paragraphs) {
      const paragraphTokens = this.encoder ? this.encoder.encode(paragraph).length : Math.ceil(paragraph.length / 4);
      
      // If single paragraph is too long, split by sentences
      if (paragraphTokens > maxTokens) {
        const sentences = this.sentenceTokenizer ? this.sentenceTokenizer.tokenize(paragraph) : paragraph.split(/[.!?]+/);
        let tempChunk = '';
        let tempTokens = 0;
        
        for (const sentence of sentences) {
          const sentTokens = this.encoder ? this.encoder.encode(sentence).length : Math.ceil(sentence.length / 4);
          
          if (tempTokens + sentTokens > maxTokens && tempChunk) {
            // Save current chunk
            chunks.push(tempChunk.trim());
            tempChunk = sentence;
            tempTokens = sentTokens;
          } else {
            tempChunk += ' ' + sentence;
            tempTokens += sentTokens;
          }
        }
        
        if (tempChunk) {
          chunks.push(tempChunk.trim());
        }
      } 
      // If adding paragraph exceeds limit, save current and start new
      else if (currentTokens + paragraphTokens > maxTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
        currentTokens = paragraphTokens;
      } 
      // Otherwise, add to current chunk
      else {
        currentChunk += '\n\n' + paragraph;
        currentTokens += paragraphTokens;
      }
    }
    
    // Don't forget the last chunk
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private extractGlobalEntitiesSync(text: string): GlobalEntities {
    // Extract ALL entities from document first
    // This ensures we don't miss important people/places
    
    const entities = {
      people: new Set<string>(),
      places: new Set<string>(),
      events: new Set<string>(),
      relationships: new Map<string, string[]>()
    };
    
    // Pattern matching for names (capitalized words) - fix iterator issue
    const namePattern = /\b([A-Z][a-z]+ (?:[A-Z][a-z]+ ?){0,2})\b/g;
    let match;
    while ((match = namePattern.exec(text)) !== null) {
      const potential = match[1].trim();
      
      // Filter out common non-names
      if (!this.isCommonWord(potential) && potential.length > 2) {
        // Use context to determine if it's a person or place
        const context = text.substring(
          Math.max(0, match.index - 50),
          Math.min(text.length, match.index + 50)
        );
        
        if (this.isPerson(potential, context)) {
          entities.people.add(potential);
        } else if (this.isPlace(potential, context)) {
          entities.places.add(potential);
        }
      }
    }
    
    // Extract events (looking for time markers + actions) - fix iterator issue
    const eventPattern = /(when|after|before|during) ([^.!?]+)/gi;
    let eventMatch;
    while ((eventMatch = eventPattern.exec(text)) !== null) {
      entities.events.add(eventMatch[2].trim());
    }
    
    return {
      people: Array.from(entities.people),
      places: Array.from(entities.places),
      events: Array.from(entities.events)
    };
  }

  private async extractGlobalEntities(text: string): Promise<GlobalEntities> {
    return this.extractGlobalEntitiesSync(text);
  }

  private isPerson(text: string, context: string): boolean {
    const personIndicators = [
      'said', 'told', 'asked', 'replied', 'thought',
      'went', 'came', 'his', 'her', 'their', 'was', 'is'
    ];
    return personIndicators.some(ind => context.toLowerCase().includes(ind));
  }

  private isPlace(text: string, context: string): boolean {
    const placeIndicators = [
      'in', 'at', 'from', 'to', 'near', 'city', 
      'town', 'street', 'restaurant', 'house'
    ];
    return placeIndicators.some(ind => context.toLowerCase().includes(ind));
  }

  private isCommonWord(word: string): boolean {
    const common = [
      'The', 'This', 'That', 'These', 'Those', 'Monday',
      'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 
      'Sunday', 'January', 'February', 'March', 'April', 'May',
      'June', 'July', 'August', 'September', 'October', 
      'November', 'December'
    ];
    return common.includes(word);
  }

  private processChunkSync(
    chunk: string,
    prevChunk: string | undefined,
    nextChunk: string | undefined,
    globalEntities: GlobalEntities
  ): ExtractedStory {
    // Look for story markers
    const storyMarkers = {
      beginning: /^(once|one day|it started|first|initially)/i,
      middle: /(then|after|during|while|as)/i,
      end: /(finally|in the end|ultimately|concluded|last)/i,
      complete: /(the story|here's what happened|let me tell you)/i
    };
    
    // Determine story completeness
    let storyArc: 'complete' | 'partial' | 'fragment' = 'fragment';
    
    if (storyMarkers.complete.test(chunk)) {
      storyArc = 'complete';
    } else if (
      storyMarkers.beginning.test(chunk) && 
      storyMarkers.end.test(chunk)
    ) {
      storyArc = 'complete';
    } else if (
      storyMarkers.beginning.test(chunk) || 
      storyMarkers.end.test(chunk)
    ) {
      storyArc = 'partial';
    }
    
    // Extract local entities
    const localEntities = this.extractGlobalEntitiesSync(chunk);
    
    // Merge with global entities (don't miss anyone!) - fix Set iteration
    const allPeople = new Set<string>();
    localEntities.people.forEach(p => allPeople.add(p));
    globalEntities.people.forEach(p => allPeople.add(p));
    
    const allPlaces = new Set<string>();
    localEntities.places.forEach(p => allPlaces.add(p));
    globalEntities.places.forEach(p => allPlaces.add(p));
    
    const entities = {
      people: Array.from(allPeople),
      places: Array.from(allPlaces),
      events: localEntities.events // Keep local events
    };
    
    // Calculate importance based on entity mentions and story completeness
    const importance = this.calculateImportanceFromStory(chunk, entities, storyArc);
    
    return {
      content: chunk,
      entities,
      storyArc,
      relatedChunks: [], // Will be filled by connectRelatedStories
      importance
    };
  }

  private async processChunk(
    chunk: string,
    prevChunk: string | undefined,
    nextChunk: string | undefined,
    globalEntities: GlobalEntities
  ): Promise<ExtractedStory> {
    return this.processChunkSync(chunk, prevChunk, nextChunk, globalEntities);
  }

  private calculateImportanceFromStory(
    chunk: string,
    entities: any,
    storyArc: string
  ): number {
    let importance = 500; // Base
    
    // Complete stories are more important
    if (storyArc === 'complete') importance += 200;
    if (storyArc === 'partial') importance += 100;
    
    // More entities = more important
    importance += entities.people.length * 50;
    importance += entities.places.length * 30;
    importance += entities.events.length * 40;
    
    // Emotional content is important for Nicky
    const emotionalWords = [
      'angry', 'frustrated', 'happy', 'sad', 'betrayed',
      'excited', 'disappointed', 'proud', 'ashamed'
    ];
    const emotionCount = emotionalWords.filter(
      word => chunk.toLowerCase().includes(word)
    ).length;
    importance += emotionCount * 75;
    
    // Cap at 999 (reserved for protected facts)
    return Math.min(importance, 990);
  }

  private connectRelatedStories(stories: ExtractedStory[]): ExtractedStory[] {
    // Find stories that reference the same entities
    for (let i = 0; i < stories.length; i++) {
      for (let j = i + 1; j < stories.length; j++) {
        const sharedPeople = stories[i].entities.people.filter(
          p => stories[j].entities.people.includes(p)
        );
        
        const sharedPlaces = stories[i].entities.places.filter(
          p => stories[j].entities.places.includes(p)
        );
        
        // If they share entities, they're related
        if (sharedPeople.length > 0 || sharedPlaces.length > 0) {
          stories[i].relatedChunks.push(stories[j].content);
          stories[j].relatedChunks.push(stories[i].content);
          
          // Incomplete stories that relate might form complete story
          if (
            stories[i].storyArc === 'partial' && 
            stories[j].storyArc === 'partial'
          ) {
            // Check if they form a complete arc together
            const combined = stories[i].content + ' ' + stories[j].content;
            if (this.isCompleteStory(combined)) {
              stories[i].storyArc = 'complete';
              stories[j].storyArc = 'complete';
            }
          }
        }
      }
    }
    
    return stories;
  }

  private isCompleteStory(text: string): boolean {
    // Has beginning, middle, and end markers
    const hasBeginning = /^(once|one day|it started|first)/i.test(text);
    const hasMiddle = /(then|after|during|while)/i.test(text);
    const hasEnd = /(finally|in the end|ultimately|concluded)/i.test(text);
    
    return hasBeginning && hasMiddle && hasEnd;
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
