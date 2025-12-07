import { storage } from "../storage";
import { db } from "../db";
import { documents } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { embeddingService } from "./embeddingService";
import crypto from 'crypto';

interface DuplicateResult {
  type: 'exact' | 'metadata' | 'semantic';
  document: any;
  confidence: number;
  reason: string;
}

class DocumentDuplicateDetector {
  
  /**
   * Generate SHA-256 hash for exact duplicate detection
   */
  generateContentHash(fileBuffer: Buffer): string {
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }
  
  /**
   * TIER 1: Check for exact duplicates using content hash
   */
  async checkExactDuplicate(hash: string, profileId: string): Promise<any | null> {
    const results = await db.select()
      .from(documents)
      .where(
        and(
          eq(documents.contentHash, hash),
          eq(documents.profileId, profileId)
        )
      )
      .limit(1);
    
    return results[0] || null;
  }
  
  /**
   * TIER 2: Check for metadata similarity (file size, type, name)
   */
  async checkMetadataSimilarity(
    size: number,
    contentType: string,
    filename: string,
    profileId: string
  ): Promise<any[]> {
    // Allow ±5% size variance
    const sizeLower = Math.floor(size * 0.95);
    const sizeUpper = Math.ceil(size * 1.05);
    
    // Use simple filename matching instead of PostgreSQL similarity function
    // since we can't rely on pg_trgm extension being installed
    const results = await db.select()
      .from(documents)
      .where(
        and(
          eq(documents.profileId, profileId),
          eq(documents.contentType, contentType),
          sql`${documents.size} BETWEEN ${sizeLower} AND ${sizeUpper}`
        )
      )
      .limit(10);
    
    // Filter and score by filename similarity in JavaScript
    const withSimilarity = results
      .map(doc => {
        const similarity = this.calculateFilenameSimilarity(filename, doc.filename);
        return { ...doc, name_similarity: similarity };
      })
      .filter(doc => doc.name_similarity > 0.3)
      .sort((a, b) => b.name_similarity - a.name_similarity);
    
    return withSimilarity;
  }
  
  /**
   * Simple filename similarity calculation (Jaccard similarity of words)
   */
  private calculateFilenameSimilarity(filename1: string, filename2: string): number {
    // Normalize filenames: lowercase, remove extensions, split into words
    const normalize = (fname: string) => {
      return fname
        .toLowerCase()
        .replace(/\.[^/.]+$/, '') // Remove extension
        .split(/[\s_-]+/)
        .filter(w => w.length > 2);
    };
    
    const words1 = new Set(normalize(filename1));
    const words2 = new Set(normalize(filename2));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);
    
    return intersection.size / union.size;
  }
  
  /**
   * TIER 3: Check for semantic similarity using embeddings
   */
  async checkSemanticDuplicates(
    documentId: string,
    embedding: number[],
    profileId: string,
    threshold: number = 0.85
  ): Promise<Array<{document: any, similarity: number}>> {
    try {
      // Get all documents with embeddings for this profile
      const allDocs = await db.select()
        .from(documents)
        .where(
          and(
            eq(documents.profileId, profileId),
            sql`${documents.embedding} IS NOT NULL`
          )
        );
      
      const similar: Array<{document: any, similarity: number}> = [];
      
      for (const doc of allDocs) {
        // Skip self-comparison
        if (doc.id === documentId) continue;
        
        if (!doc.embedding) continue;
        
        try {
          let docEmbedding: number[];
          if (Array.isArray(doc.embedding)) {
            docEmbedding = doc.embedding;
          } else if (typeof doc.embedding === 'string') {
            try {
              docEmbedding = JSON.parse(doc.embedding);
            } catch (e) {
              const cleaned = doc.embedding.replace(/^\[|\]$/g, '');
              docEmbedding = cleaned.split(',').map(n => parseFloat(n.trim()));
              if (docEmbedding.some(isNaN)) {
                 console.error(`[DocumentDuplicateDetector] Failed to parse embedding: ${doc.embedding.substring(0, 50)}...`);
                 continue;
              }
            }
          } else {
            continue;
          }
          
          const similarity = embeddingService.cosineSimilarity(embedding, docEmbedding);
          
          if (similarity >= threshold) {
            similar.push({
              document: doc,
              similarity
            });
          }
        } catch (error) {
          console.error(`Failed to parse embedding for document ${doc.id}:`, error);
        }
      }
      
      return similar
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);
    } catch (error) {
      console.error("Semantic duplicate detection error:", error);
      return [];
    }
  }
  
  /**
   * Full 3-tier duplicate detection pipeline
   */
  async checkForDuplicates(
    file: { buffer: Buffer; size: number; type: string; name: string },
    content: string,
    profileId: string
  ): Promise<DuplicateResult[]> {
    const duplicates: DuplicateResult[] = [];
    
    console.log('🔍 Starting 3-tier duplicate detection...');
    
    // TIER 1: Content hash (fastest, exact matches)
    console.log('  🔹 Tier 1: Checking content hash...');
    const hash = this.generateContentHash(file.buffer);
    const exactDupe = await this.checkExactDuplicate(hash, profileId);
    
    if (exactDupe) {
      duplicates.push({
        type: 'exact',
        document: exactDupe,
        confidence: 1.0,
        reason: 'Identical file content (SHA-256 match)'
      });
      
      console.log('  ✅ Exact duplicate found! Skipping remaining checks.');
      return duplicates;
    }
    
    // TIER 2: Metadata similarity
    console.log('  🔹 Tier 2: Checking metadata similarity...');
    const metadataDupes = await this.checkMetadataSimilarity(
      file.size,
      file.type,
      file.name,
      profileId
    );
    
    for (const doc of metadataDupes) {
      duplicates.push({
        type: 'metadata',
        document: doc,
        confidence: doc.name_similarity || 0.5,
        reason: `Similar size (${doc.size} bytes) and filename (${Math.round((doc.name_similarity || 0) * 100)}% match)`
      });
    }
    
    console.log(`  ✅ Found ${metadataDupes.length} metadata duplicates`);
    
    // TIER 3: Semantic similarity (slowest, smartest)
    console.log('  🔹 Tier 3: Checking semantic similarity...');
    try {
      const embedding = await embeddingService.generateEmbedding(content);
      const semanticDupes = await this.checkSemanticDuplicates(
        '', // No doc ID yet since we haven't saved
        embedding.embedding,
        profileId,
        0.85
      );
      
      for (const { document, similarity } of semanticDupes) {
        // Don't duplicate if already found in metadata check
        if (!duplicates.some(d => d.document.id === document.id)) {
          duplicates.push({
            type: 'semantic',
            document,
            confidence: similarity,
            reason: `${Math.round(similarity * 100)}% content similarity`
          });
        }
      }
      
      console.log(`  ✅ Found ${semanticDupes.length} semantic duplicates`);
    } catch (error) {
      console.warn('  ⚠️ Semantic duplicate check failed:', error);
    }
    
    console.log(`✅ Duplicate detection complete: ${duplicates.length} potential duplicates found`);
    return duplicates.sort((a, b) => b.confidence - a.confidence);
  }
}

export const documentDuplicateDetector = new DocumentDuplicateDetector();
