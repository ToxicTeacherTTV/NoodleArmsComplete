// CRITICAL FIX: Import shared types instead of duplicating them
import type { 
  Message as DbMessage, 
  Profile as DbProfile, 
  MemoryEntry as DbMemoryEntry, 
  Document as DbDocument,
  Conversation as DbConversation
} from '@shared/schema';

// Client-compatible types with Date -> string serialization
export type Message = Omit<DbMessage, 'createdAt'> & {
  createdAt: string;
};

export type Profile = Omit<DbProfile, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type MemoryEntry = Omit<DbMemoryEntry, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt?: string;
};

export type Document = Omit<DbDocument, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type Conversation = Omit<DbConversation, 'createdAt'> & {
  createdAt: string;
};

export interface MemoryStats {
  totalFacts: number;
  conversations: number;
}

export type AIStatus = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'PROCESSING' | 'ERROR';

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

// API Response Interfaces
export interface ChatResponse {
  content: string;
  id?: string;
}

export interface ConversationResponse {
  id: string;
  title: string;
  profileId: string;
  createdAt: string;
}

export interface ChaosState {
  level: number;
  mode: 'FULL_PSYCHO' | 'FAKE_PROFESSIONAL' | 'HYPER_FOCUSED' | 'CONSPIRACY';
  effectiveLevel?: number;
  manualOverride?: number;
  lastModeChange?: string;
}

export interface PersonalityState {
  basePersonality: {
    preset: string;
    intensity: 'low' | 'med' | 'high' | 'ultra';
    dbd_lens: boolean;
    spice: 'platform_safe' | 'normal' | 'spicy';
  };
  chaosInfluence?: {
    reason: string;
    intensityDelta: number;
    suggestedPreset?: string;
    presetSuggestion?: string;
    spiceCap?: 'platform_safe' | 'normal' | 'spicy';
  };
  effectivePersonality: {
    preset: string;
    intensity: 'low' | 'med' | 'high' | 'ultra';
    dbd_lens: boolean;
    spice: 'platform_safe' | 'normal' | 'spicy';
  };
  lastUpdated: string;
  source: string;
}
