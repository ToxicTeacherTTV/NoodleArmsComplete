// Advanced AI evolution types for Nicky's knowledge system

export interface KnowledgeRelationship {
  sourceFactId: string;
  targetFactId: string;
  relationshipType: 'SUPPORTS' | 'CONTRADICTS' | 'ENHANCES' | 'DEPENDS_ON' | 'TEMPORAL_SEQUENCE';
  strength: number; // 1-10
  confidence: number; // 0-1
}

export interface KnowledgeCluster {
  id: string;
  name: string;
  description: string;
  factIds: string[];
  importance: number;
  lastUpdated: Date;
  concepts: string[]; // Key concepts in this cluster
}

export interface ConversationFeedback {
  conversationId: string;
  factIds: string[]; // Facts used in this conversation
  success: boolean; // Did the conversation go well?
  userSatisfaction: number; // 1-10
  responseQuality: number; // 1-10
  chaosLevel: number; // Nicky's chaos level during conversation
}

export interface KnowledgeGap {
  category: string;
  description: string;
  priority: number; // 1-10
  suggestedQuestions: string[];
  relatedFactIds: string[];
}

export interface EvolutionMetrics {
  totalFacts: number;
  avgQualityScore: number;
  clusterCount: number;
  relationshipCount: number;
  learningRate: number; // How fast knowledge is improving
  knowledgeCoverage: number; // 0-1, how well we know Nicky
}

export interface AdaptiveLearningConfig {
  qualityThreshold: number; // Minimum quality score to keep facts
  relationshipStrengthThreshold: number;
  clusterSizeThreshold: number;
  temporalDecayRate: number; // How fast old facts lose importance
  feedbackWeight: number; // How much conversation feedback affects quality
}