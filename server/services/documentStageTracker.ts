import { storage } from "../storage";
import { db } from "../db";
import { documents } from "@shared/schema";
import { eq } from "drizzle-orm";

interface ProcessingStage {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  timestamp: string;
  error?: string;
  [key: string]: any; // Stage-specific metadata
}

interface DocumentProcessingMetadata {
  text_extraction?: ProcessingStage;
  fact_extraction?: ProcessingStage;
  entity_extraction?: ProcessingStage;
  deep_research?: ProcessingStage;
  embedding_generation?: ProcessingStage;
}

class DocumentStageTracker {
  
  /**
   * Update a specific processing stage for a document
   */
  async updateStage(
    documentId: string,
    stage: keyof DocumentProcessingMetadata,
    status: ProcessingStage['status'],
    metadata?: Record<string, any>
  ): Promise<void> {
    const stageData: ProcessingStage = {
      status,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    
    try {
      // Get current metadata
      const doc = await storage.getDocument(documentId);
      const currentMetadata = doc?.processingMetadata || {};
      
      // Update the specific stage
      const updatedMetadata = {
        ...currentMetadata,
        [stage]: stageData
      };
      
      // Update in database
      await db.update(documents)
        .set({ processingMetadata: updatedMetadata })
        .where(eq(documents.id, documentId));
      
      console.log(`📝 Document ${documentId} - ${stage}: ${status}`);
    } catch (error) {
      console.error(`Failed to update stage ${stage}:`, error);
      throw error;
    }
  }
  
  /**
   * Get processing status for a document
   */
  async getProcessingStatus(documentId: string): Promise<DocumentProcessingMetadata | null> {
    const doc = await storage.getDocument(documentId);
    return doc?.processingMetadata || null;
  }
  
  /**
   * Get overall progress percentage based on completed stages
   */
  getProgressPercentage(metadata: DocumentProcessingMetadata | null): number {
    if (!metadata) return 0;
    
    const stages = ['text_extraction', 'embedding_generation', 'fact_extraction', 'entity_extraction'] as const;
    const completed = stages.filter(stage => metadata[stage]?.status === 'completed').length;
    
    return Math.round((completed / stages.length) * 100);
  }
  
  /**
   * Check if document processing is fully complete
   */
  isProcessingComplete(metadata: DocumentProcessingMetadata | null): boolean {
    if (!metadata) return false;
    
    const required = ['text_extraction', 'embedding_generation'] as const;
    return required.every(stage => metadata[stage]?.status === 'completed');
  }
}

export const documentStageTracker = new DocumentStageTracker();
