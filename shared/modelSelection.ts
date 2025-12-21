/**
 * AI Model Selection Configuration
 * 
 * Supported models for different AI operations:
 * - Claude Sonnet 4.5: Highest quality, most expensive ($3 input / $15 output per 1M tokens)
 * - Gemini 3 Pro Preview: Google's newest, "most intelligent" model (pricing TBD)
 * - Gemini 2.5 Pro: High quality, cost-effective ($1.25 input / $5 output per 1M tokens)
 * - Gemini 2.5 Flash: Fast and cheap ($0.30 input / $1.20 output per 1M tokens)
 */

export type AIModel = 
  | 'claude-sonnet-4.5'
  | 'gemini-3-pro-preview'
  | 'gemini-3-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash';

export type AIOperation = 
  | 'chat'                    // Real-time chat responses
  | 'document-processing'     // Extract facts from documents
  | 'podcast-training'        // Convert podcasts to training data
  | 'memory-consolidation'    // Optimize and dedupe memories
  | 'fact-extraction'         // Extract atomic facts
  | 'style-analysis';         // Analyze personality patterns

export interface ModelSelectionConfig {
  operation: AIOperation;
  selectedModel: AIModel;
  fallbackModel?: AIModel;
}

/**
 * Default model selections for each operation
 * Can be overridden by user preferences
 */
export const DEFAULT_MODEL_CONFIG: Record<AIOperation, ModelSelectionConfig> = {
  'chat': {
    operation: 'chat',
    selectedModel: 'gemini-3-flash',
    fallbackModel: 'gemini-3-pro-preview'
  },
  'document-processing': {
    operation: 'document-processing',
    selectedModel: 'gemini-3-flash',
    fallbackModel: 'gemini-3-pro-preview'
  },
  'podcast-training': {
    operation: 'podcast-training',
    selectedModel: 'gemini-3-flash',
    fallbackModel: 'gemini-3-pro-preview'
  },
  'memory-consolidation': {
    operation: 'memory-consolidation',
    selectedModel: 'gemini-3-flash',
    fallbackModel: 'gemini-3-pro-preview'
  },
  'fact-extraction': {
    operation: 'fact-extraction',
    selectedModel: 'gemini-3-flash',
    fallbackModel: 'gemini-3-pro-preview'
  },
  'style-analysis': {
    operation: 'style-analysis',
    selectedModel: 'gemini-3-flash',
    fallbackModel: 'gemini-3-pro-preview'
  }
};

/**
 * Model metadata for UI display
 */
export const MODEL_METADATA: Record<AIModel, {
  displayName: string;
  provider: 'anthropic' | 'google';
  speed: 'fast' | 'medium' | 'slow';
  quality: 'standard' | 'high' | 'premium';
  costLevel: 'cheap' | 'moderate' | 'expensive';
  description: string;
}> = {
  'claude-sonnet-4.5': {
    displayName: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    speed: 'medium',
    quality: 'premium',
    costLevel: 'expensive',
    description: 'Highest quality reasoning and creative tasks'
  },
  'gemini-3-pro-preview': {
    displayName: 'Gemini 3 Pro (Preview)',
    provider: 'google',
    speed: 'medium',
    quality: 'premium',
    costLevel: 'expensive',
    description: 'Google\'s newest, most intelligent model'
  },
  'gemini-3-flash': {
    displayName: 'Gemini 3 Flash',
    provider: 'google',
    speed: 'fast',
    quality: 'high',
    costLevel: 'cheap',
    description: 'Newest Flash model - beats 2.5 Pro in quality and cost'
  },
  'gemini-2.5-pro': {
    displayName: 'Gemini 2.5 Pro',
    provider: 'google',
    speed: 'fast',
    quality: 'high',
    costLevel: 'moderate',
    description: 'Best balance of quality and cost'
  },
  'gemini-2.5-flash': {
    displayName: 'Gemini 2.5 Flash',
    provider: 'google',
    speed: 'fast',
    quality: 'standard',
    costLevel: 'cheap',
    description: 'Fast and economical for high volume'
  }
};

/**
 * Storage key for user's model preferences
 */
export const MODEL_PREFERENCE_STORAGE_KEY = 'ai_model_preferences';

/**
 * Get user's model preference for an operation
 */
export function getModelPreference(operation: AIOperation): AIModel {
  if (typeof window === 'undefined') {
    return DEFAULT_MODEL_CONFIG[operation].selectedModel;
  }

  try {
    const stored = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY);
    if (stored) {
      const preferences = JSON.parse(stored) as Partial<Record<AIOperation, AIModel>>;
      return preferences[operation] || DEFAULT_MODEL_CONFIG[operation].selectedModel;
    }
  } catch (error) {
    console.warn('Failed to load model preferences:', error);
  }

  return DEFAULT_MODEL_CONFIG[operation].selectedModel;
}

/**
 * Set user's model preference for an operation
 */
export function setModelPreference(operation: AIOperation, model: AIModel): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY);
    const preferences = stored ? JSON.parse(stored) : {};
    preferences[operation] = model;
    localStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to save model preference:', error);
  }
}

/**
 * Get all user's model preferences
 */
export function getAllModelPreferences(): Partial<Record<AIOperation, AIModel>> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load model preferences:', error);
    return {};
  }
}
