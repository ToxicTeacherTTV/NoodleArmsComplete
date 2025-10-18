import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";

interface EmbeddingResult {
  embedding: number[];
  model: string;
}

interface SemanticSearchResult {
  id: string;
  content: string;
  similarity: number;
  type?: string;
  importance?: number;
  confidence?: number;
}

/**
 * EmbeddingService - Provides semantic search capabilities using Gemini embeddings
 * Generates and manages vector embeddings for memory entries and content library
 */
class EmbeddingService {
  private ai: GoogleGenAI;
  private readonly EMBEDDING_MODEL = 'text-embedding-004'; // Latest Gemini embedding model
  private readonly BATCH_SIZE = 50; // Process embeddings in batches
  
  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  /**
   * Generate embedding for a single text using Gemini
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    if (!text.trim()) {
      throw new Error("Cannot generate embedding for empty text");
    }

    try {
      console.log(`🔢 Generating embedding for text: "${text.substring(0, 50)}..."`);
      
      const response = await this.ai.models.embedContent({
        model: this.EMBEDDING_MODEL,
        contents: {
          parts: [{ text: text }],
        },
      });

      if (!response.embeddings || !response.embeddings[0]?.values) {
        throw new Error("No embedding returned from Gemini");
      }

      return {
        embedding: response.embeddings[0].values,
        model: this.EMBEDDING_MODEL
      };
    } catch (error) {
      console.error("Embedding generation error:", error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < texts.length; i += this.BATCH_SIZE) {
      const batch = texts.slice(i, i + this.BATCH_SIZE);
      console.log(`🔢 Processing embedding batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(texts.length / this.BATCH_SIZE)}`);
      
      const batchPromises = batch.map(text => this.generateEmbedding(text));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Failed to generate embedding for text ${i + index}:`, result.reason);
          // Add a zero vector as fallback
          results.push({
            embedding: new Array(768).fill(0), // Standard embedding dimension
            model: this.EMBEDDING_MODEL
          });
        }
      });
      
      // Add delay between batches to respect rate limits
      if (i + this.BATCH_SIZE < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   * Made public for use in duplicate/contradiction detection
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error("Vectors must have the same dimension");
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0; // Avoid division by zero
    }
    
    return dotProduct / (normA * normB);
  }

  /**
   * Search for semantically similar memory entries
   */
  async searchSimilarMemories(
    queryText: string, 
    profileId: string, 
    limit: number = 10,
    similarityThreshold: number = 0.5
  ): Promise<SemanticSearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      // Get all memory entries with embeddings for this profile
      const memories = await storage.getMemoryEntriesWithEmbeddings(profileId);
      
      if (!memories || memories.length === 0) {
        console.log("No memories with embeddings found");
        return [];
      }
      
      // Calculate similarities
      const similarities: SemanticSearchResult[] = [];
      
      for (const memory of memories) {
        if (!memory.embedding) continue;
        
        try {
          const memoryEmbedding = JSON.parse(memory.embedding as string);
          const similarity = this.cosineSimilarity(queryEmbedding.embedding, memoryEmbedding);
          
          if (similarity >= similarityThreshold) {
            similarities.push({
              id: memory.id,
              content: memory.content,
              similarity,
              type: memory.type,
              importance: memory.importance || 1,
              confidence: memory.confidence || 50
            });
          }
        } catch (error) {
          console.error(`Failed to parse embedding for memory ${memory.id}:`, error);
        }
      }
      
      // Sort by similarity score (descending) and limit results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
        
    } catch (error) {
      console.error("Semantic search error:", error);
      return [];
    }
  }

  /**
   * Search for semantically similar content library entries
   */
  async searchSimilarContent(
    queryText: string, 
    profileId: string, 
    limit: number = 5,
    similarityThreshold: number = 0.6
  ): Promise<SemanticSearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      // Get all content library entries with embeddings for this profile
      const contentEntries = await storage.getContentLibraryWithEmbeddings(profileId);
      
      if (!contentEntries || contentEntries.length === 0) {
        console.log("No content library entries with embeddings found");
        return [];
      }
      
      // Calculate similarities
      const similarities: SemanticSearchResult[] = [];
      
      for (const content of contentEntries) {
        if (!content.embedding) continue;
        
        try {
          const contentEmbedding = JSON.parse(content.embedding as string);
          const similarity = this.cosineSimilarity(queryEmbedding.embedding, contentEmbedding);
          
          if (similarity >= similarityThreshold) {
            similarities.push({
              id: content.id,
              content: content.content,
              similarity,
              type: content.category || undefined
            });
          }
        } catch (error) {
          console.error(`Failed to parse embedding for content ${content.id}:`, error);
        }
      }
      
      // Sort by similarity score (descending) and limit results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
        
    } catch (error) {
      console.error("Content semantic search error:", error);
      return [];
    }
  }

  /**
   * Generate and store embedding for a memory entry
   */
  async embedMemoryEntry(memoryId: string, content: string): Promise<boolean> {
    try {
      const embeddingResult = await this.generateEmbedding(content);
      
      await storage.updateMemoryEmbedding(memoryId, {
        embedding: JSON.stringify(embeddingResult.embedding),
        embeddingModel: embeddingResult.model,
        embeddingUpdatedAt: new Date()
      });
      
      console.log(`✅ Generated embedding for memory ${memoryId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to embed memory ${memoryId}:`, error);
      return false;
    }
  }

  /**
   * Generate and store embedding for a content library entry
   */
  async embedContentEntry(contentId: string, content: string): Promise<boolean> {
    try {
      const embeddingResult = await this.generateEmbedding(content);
      
      await storage.updateContentLibraryEmbedding(contentId, {
        embedding: JSON.stringify(embeddingResult.embedding),
        embeddingModel: embeddingResult.model,
        embeddingUpdatedAt: new Date()
      });
      
      console.log(`✅ Generated embedding for content ${contentId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to embed content ${contentId}:`, error);
      return false;
    }
  }

  /**
   * Batch process embeddings for existing memory entries (for migration)
   */
  async generateEmbeddingsForAllMemories(profileId: string): Promise<{processed: number, successful: number}> {
    try {
      console.log("🚀 Starting batch embedding generation for all memories...");
      
      // Get all memory entries without embeddings
      const memories = await storage.getMemoryEntriesWithoutEmbeddings(profileId);
      console.log(`📊 Found ${memories.length} memory entries without embeddings`);
      
      if (memories.length === 0) {
        return { processed: 0, successful: 0 };
      }
      
      let successful = 0;
      
      // Process in smaller batches to manage API rate limits
      for (let i = 0; i < memories.length; i += 10) {
        const batch = memories.slice(i, i + 10);
        console.log(`🔄 Processing memory batch ${Math.floor(i / 10) + 1}/${Math.ceil(memories.length / 10)}`);
        
        const promises = batch.map(memory => 
          this.embedMemoryEntry(memory.id, memory.content)
        );
        
        const results = await Promise.allSettled(promises);
        successful += results.filter(r => r.status === 'fulfilled' && r.value).length;
        
        // Add delay between batches
        if (i + 10 < memories.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`✅ Embedding generation complete: ${successful}/${memories.length} successful`);
      return { processed: memories.length, successful };
      
    } catch (error) {
      console.error("Batch embedding generation error:", error);
      throw error;
    }
  }

  /**
   * Batch process embeddings for existing content library entries
   */
  async generateEmbeddingsForAllContent(profileId: string): Promise<{processed: number, successful: number}> {
    try {
      console.log("🚀 Starting batch embedding generation for content library...");
      
      // Get all content entries without embeddings
      const contentEntries = await storage.getContentLibraryWithoutEmbeddings(profileId);
      console.log(`📊 Found ${contentEntries.length} content entries without embeddings`);
      
      if (contentEntries.length === 0) {
        return { processed: 0, successful: 0 };
      }
      
      let successful = 0;
      
      // Process in smaller batches to manage API rate limits
      for (let i = 0; i < contentEntries.length; i += 5) {
        const batch = contentEntries.slice(i, i + 5);
        console.log(`🔄 Processing content batch ${Math.floor(i / 5) + 1}/${Math.ceil(contentEntries.length / 5)}`);
        
        const promises = batch.map(content => 
          this.embedContentEntry(content.id, content.content)
        );
        
        const results = await Promise.allSettled(promises);
        successful += results.filter(r => r.status === 'fulfilled' && r.value).length;
        
        // Add delay between batches  
        if (i + 5 < contentEntries.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`✅ Content embedding generation complete: ${successful}/${contentEntries.length} successful`);
      return { processed: contentEntries.length, successful };
      
    } catch (error) {
      console.error("Batch content embedding generation error:", error);
      throw error;
    }
  }

  /**
   * Hybrid search combining semantic similarity with keyword matching
   * This provides the best of both worlds for RAG retrieval
   */
  async hybridSearch(
    queryText: string,
    profileId: string,
    limit: number = 10
  ): Promise<{
    semantic: SemanticSearchResult[];
    keyword: any[];
    combined: SemanticSearchResult[];
  }> {
    try {
      // Get semantic results
      const semanticResults = await this.searchSimilarMemories(queryText, profileId, limit);
      
      // Get keyword results (existing system)
      const keywords = this.extractKeywords(queryText);
      const keywordResults = await storage.searchMemoriesByKeywords(profileId, keywords, limit);
      
      // Combine and deduplicate results
      const combinedMap = new Map<string, SemanticSearchResult>();
      
      // Add semantic results (weighted higher)
      semanticResults.forEach(result => {
        combinedMap.set(result.id, {
          ...result,
          similarity: result.similarity * 1.2 // Boost semantic matches
        });
      });
      
      // Add keyword results (if not already present)
      keywordResults.forEach(result => {
        if (!combinedMap.has(result.id)) {
          combinedMap.set(result.id, {
            id: result.id,
            content: result.content,
            similarity: 0.7, // Default similarity for keyword matches
            type: result.type,
            importance: result.importance || undefined,
            confidence: result.confidence || undefined
          });
        }
      });
      
      // Sort combined results by similarity + importance + confidence
      const combined = Array.from(combinedMap.values())
        .sort((a, b) => {
          const scoreA = a.similarity + (a.importance || 0) * 0.1 + (a.confidence || 0) * 0.001;
          const scoreB = b.similarity + (b.importance || 0) * 0.1 + (b.confidence || 0) * 0.001;
          return scoreB - scoreA;
        })
        .slice(0, limit);
      
      return {
        semantic: semanticResults,
        keyword: keywordResults,
        combined
      };
      
    } catch (error) {
      console.error("Hybrid search error:", error);
      return {
        semantic: [],
        keyword: [],
        combined: []
      };
    }
  }

  /**
   * Find duplicate memories using vector similarity (NEW: for duplicate detection)
   * This catches semantic duplicates that text-based methods miss
   * OPTIMIZED: Only checks top N most recent memories for performance
   */
  async findDuplicatesByEmbedding(
    newMemoryContent: string,
    profileId: string,
    similarityThreshold: number = 0.90,
    scanLimit: number = 100 // Only scan 100 most recent memories for duplicates
  ): Promise<Array<{ id: string; content: string; similarity: number }>> {
    try {
      // Generate embedding for new memory
      const newEmbedding = await this.generateEmbedding(newMemoryContent);
      
      // 🚀 PERFORMANCE FIX: Only get recent memories (limit 100) instead of ALL
      const existingMemories = await storage.getRecentMemoriesWithEmbeddings(profileId, scanLimit);
      
      if (!existingMemories || existingMemories.length === 0) {
        return [];
      }
      
      // Find similar memories above threshold (early exit when we find top 5)
      const duplicates: Array<{ id: string; content: string; similarity: number }> = [];
      
      for (const memory of existingMemories) {
        if (!memory.embedding) continue;
        
        try {
          const memoryEmbedding = JSON.parse(memory.embedding as string);
          const similarity = this.cosineSimilarity(newEmbedding.embedding, memoryEmbedding);
          
          if (similarity >= similarityThreshold) {
            duplicates.push({
              id: memory.id,
              content: memory.content,
              similarity
            });
            
            // Early exit if we found enough high-confidence duplicates
            if (duplicates.length >= 5) break;
          }
        } catch (error) {
          console.error(`Failed to parse embedding for memory ${memory.id}:`, error);
        }
      }
      
      // Sort by similarity (highest first) and limit to top 5
      return duplicates.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
      
    } catch (error) {
      console.error("Vector duplicate detection error:", error);
      return [];
    }
  }

  /**
   * Find related memories using vector similarity (NEW: for contradiction detection stage 1)
   * Lower threshold than duplicate detection - finds semantically related content
   * OPTIMIZED: Enforces limit during scan, not after
   */
  async findRelatedMemoriesByEmbedding(
    newMemoryContent: string,
    profileId: string,
    similarityThreshold: number = 0.75,
    limit: number = 20
  ): Promise<Array<{ id: string; content: string; similarity: number; memory: any }>> {
    try {
      // Generate embedding for new memory
      const newEmbedding = await this.generateEmbedding(newMemoryContent);
      
      // 🚀 PERFORMANCE FIX: Only get recent memories (limit 200) instead of ALL
      // Most contradictions happen with recent facts, not ancient ones
      const existingMemories = await storage.getRecentMemoriesWithEmbeddings(profileId, 200);
      
      if (!existingMemories || existingMemories.length === 0) {
        return [];
      }
      
      // Find related memories above threshold with HARD LIMIT
      const related: Array<{ id: string; content: string; similarity: number; memory: any }> = [];
      let scannedCount = 0;
      
      for (const memory of existingMemories) {
        if (!memory.embedding) continue;
        
        scannedCount++;
        
        try {
          const memoryEmbedding = JSON.parse(memory.embedding as string);
          const similarity = this.cosineSimilarity(newEmbedding.embedding, memoryEmbedding);
          
          if (similarity >= similarityThreshold) {
            related.push({
              id: memory.id,
              content: memory.content,
              similarity,
              memory // Include full memory object for contradiction checks
            });
            
            // 🚀 CRITICAL FIX: Enforce limit during scan, not after
            if (related.length >= limit) {
              console.log(`✅ Found ${limit} related memories, stopping scan early (scanned ${scannedCount}/${existingMemories.length})`);
              break;
            }
          }
        } catch (error) {
          console.error(`Failed to parse embedding for memory ${memory.id}:`, error);
        }
      }
      
      // Sort by similarity (already limited to max `limit` items)
      return related.sort((a, b) => b.similarity - a.similarity);
      
    } catch (error) {
      console.error("Vector related memory search error:", error);
      return [];
    }
  }

  /**
   * Extract keywords from text (copied from existing implementation)
   */
  private extractKeywords(message: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    return message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => {
        const isNumber = /^\d+$/.test(word);
        const isLongEnough = word.length > 2;
        const isNotStopWord = !stopWords.has(word);
        
        return (isNumber || isLongEnough) && isNotStopWord;
      })
      .slice(0, 8);
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();