export interface Message {
  id: string;
  conversationId: string;
  type: 'USER' | 'AI' | 'CHATTER' | 'SYSTEM';
  content: string;
  metadata?: {
    voice?: boolean;
    speaker?: string;
    processingTime?: number;
    retrieved_context?: string;
  };
  createdAt: string;
}

export interface Profile {
  id: string;
  name: string;
  coreIdentity: string;
  knowledgeBase: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryEntry {
  id: string;
  profileId: string;
  type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT';
  content: string;
  importance: number;
  retrievalCount: number;
  source?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  profileId: string;
  filename: string;
  contentType: string;
  size: number;
  chunks?: string[];
  extractedContent?: string;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  retrievalCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryStats {
  totalFacts: number;
  conversations: number;
}

export type AIStatus = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export interface VoiceActivity {
  isActive: boolean;
  volume: number;
  transcript: string;
}

export interface StreamSettings {
  autoRespond: boolean;
  voiceOutput: boolean;
  memoryLearning: boolean;
}

export type AppMode = 'PODCAST' | 'STREAMING';

export interface VoiceSettings {
  useElevenLabs: boolean;
  voiceId?: string;
}
