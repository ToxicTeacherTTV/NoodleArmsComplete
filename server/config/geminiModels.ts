/**
 * 🎯 CENTRALIZED GEMINI MODEL CONFIGURATION
 * 
 * This module manages model selection with tiered fallback logic
 * to optimize costs while maintaining quality.
 * 
 * COST COMPARISON (per 1M input tokens):
 * - gemini-3-flash-preview: ~$0.10 (Primary for EVERYTHING)
 * - gemini-3-pro-preview:   TBD (First Fallback)
 * - gemini-2.5-pro:         $1.25 (Last Resort)
 * 
 * STRATEGY UPDATE (Dec 2025):
 * Gemini 3 Flash is now the default for all operations.
 * It outperforms previous Pro models at a fraction of the cost.
 * Claude Sonnet 4.5 is removed from the active rotation.
 */

export type ModelTier = 'experimental' | 'standard' | 'premium';
export type ModelPurpose = 'chat' | 'extraction' | 'analysis' | 'generation';

export interface GeminiModelConfig {
  name: string;
  tier: ModelTier;
  costMultiplier: number; // Relative to Flash (1x = Flash baseline)
  isExperimental: boolean;
  description: string;
}

/**
 * Available Gemini models with metadata
 */
export const GEMINI_MODELS: Record<string, GeminiModelConfig> = {
  // Experimental tier (free, may be unstable)
  'gemini-2.0-flash-exp': {
    name: 'gemini-2.0-flash-exp',
    tier: 'experimental',
    costMultiplier: 0, // Free tier
    isExperimental: true,
    description: 'Experimental Flash model - free but may be unstable'
  },
  'gemini-2.0-flash-thinking-exp-01-21': {
    name: 'gemini-2.0-flash-thinking-exp-01-21',
    tier: 'experimental',
    costMultiplier: 0, // Free tier
    isExperimental: true,
    description: 'Flash Thinking experimental - improved reasoning, free tier'
  },
  
  // Standard tier (production-ready, cost-effective)
  'gemini-2.5-flash': {
    name: 'gemini-2.5-flash',
    tier: 'standard',
    costMultiplier: 1, // Baseline
    isExperimental: false,
    description: 'Production Flash - reliable, 17x cheaper than Pro'
  },
  
  // Premium tier (highest quality, expensive)
  'gemini-2.5-pro': {
    name: 'gemini-2.5-pro',
    tier: 'premium',
    costMultiplier: 17, // 17x more expensive than Flash
    isExperimental: false,
    description: 'Legacy Pro model - replaced by Gemini 3'
  },
  
  // NEW: Gemini 3 Flash (beats 2.5 Pro, cheaper)
  'gemini-3-flash-preview': {
    name: 'gemini-3-flash-preview',
    tier: 'standard',
    costMultiplier: 1.3, // Slightly more than 2.5 Flash, but much less than Pro
    isExperimental: false,
    description: 'Newest Flash model - beats 2.5 Pro in quality and cost'
  },
  
  // NEW: Gemini 3 Pro Preview (newest, most intelligent)
  'gemini-3-pro-preview': {
    name: 'gemini-3-pro-preview',
    tier: 'premium',
    costMultiplier: 17, // Assume similar to 2.5 Pro (TBD)
    isExperimental: false,
    description: 'Google\'s newest, most intelligent model to date'
  }
} as const;

/**
 * Model selection strategy based on environment and purpose
 */
export interface ModelSelectionStrategy {
  primary: string;      // First choice model
  fallback?: string;    // Fallback if primary fails
  ultimate?: string;    // Last resort fallback
}

/**
 * Get model selection strategy based on environment and purpose
 */
export function getModelStrategy(
  purpose: ModelPurpose,
  environment: 'development' | 'production' = 'production'
): ModelSelectionStrategy {
  const isDev = environment === 'development' || process.env.NODE_ENV === 'development';
  
  // Development: Use experimental/cheap models
  if (isDev) {
    // Special case for CHAT: Use higher quality model even in dev if requested
    if (purpose === 'chat') {
      return {
        primary: process.env.GEMINI_DEV_CHAT_MODEL || 'gemini-3-flash-preview', // Upgrade dev chat to 3.0 Flash
        fallback: 'gemini-3-pro-preview',
        ultimate: 'gemini-2.5-pro'
      };
    }

    return {
      primary: process.env.GEMINI_DEV_MODEL || 'gemini-3-flash-preview',
      fallback: process.env.GEMINI_FALLBACK_MODEL || 'gemini-3-pro-preview',
      ultimate: 'gemini-2.5-pro' // Last resort
    };
  }
  
  // Production: Strategy varies by purpose
  switch (purpose) {
    case 'chat':
      // Chat: Gemini 3 Flash (Primary) -> 3 Pro (Fallback)
      return {
        primary: process.env.GEMINI_DEFAULT_MODEL || 'gemini-3-flash-preview',
        fallback: 'gemini-3-pro-preview',
        ultimate: 'gemini-2.5-pro'
      };
      
    case 'extraction':
      // Extraction: Gemini 3 Flash (Primary) -> 3 Pro (Fallback)
      return {
        primary: process.env.GEMINI_EXTRACTION_MODEL || 'gemini-3-flash-preview',
        fallback: 'gemini-3-pro-preview',
        ultimate: 'gemini-2.5-pro'
      };
      
    case 'analysis':
      // Analysis: Gemini 3 Flash (Primary) -> 3 Pro (Fallback)
      return {
        primary: process.env.GEMINI_ANALYSIS_MODEL || 'gemini-3-flash-preview',
        fallback: 'gemini-3-pro-preview',
        ultimate: 'gemini-2.5-pro'
      };
      
    case 'generation':
      // Generation: Gemini 3 Flash (Primary) -> 3 Pro (Fallback)
      return {
        primary: process.env.GEMINI_GENERATION_MODEL || 'gemini-3-flash-preview',
        fallback: 'gemini-3-pro-preview',
        ultimate: 'gemini-2.5-pro'
      };
  }

  // Default fallback
  return {
    primary: process.env.GEMINI_DEFAULT_MODEL || 'gemini-3-flash-preview',
    fallback: 'gemini-3-pro-preview',
    ultimate: 'gemini-2.5-pro'
  };
}

/**
 * Validate model name against available models
 */
export function isValidModel(modelName: string): boolean {
  return modelName in GEMINI_MODELS;
}

/**
 * Get model config by name
 */
export function getModelConfig(modelName: string): GeminiModelConfig | null {
  return GEMINI_MODELS[modelName] || null;
}

/**
 * Check if model is experimental
 */
export function isExperimentalModel(modelName: string): boolean {
  const config = getModelConfig(modelName);
  return config?.isExperimental || false;
}

/**
 * Get cost estimate for a model relative to Flash baseline
 */
export function getModelCostMultiplier(modelName: string): number {
  const config = getModelConfig(modelName);
  return config?.costMultiplier || 1;
}

/**
 * LEGACY SUPPORT: Check if model is approved
 * This maintains compatibility with existing Flash ban logic
 */
export function isApprovedModel(modelName: string): boolean {
  // Allow all models in the config (Flash ban is lifted with controlled testing)
  // Individual services can still enforce stricter rules if needed
  return isValidModel(modelName);
}

/**
 * Get the default model for current environment
 */
export function getDefaultModel(): string {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    return process.env.GEMINI_DEV_MODEL || 'gemini-3-flash-preview';
  }
  
  return process.env.GEMINI_DEFAULT_MODEL || 'gemini-3-flash-preview';
}

/**
 * Estimate cost savings from using one model vs another
 */
export function estimateCostSavings(
  currentModel: string,
  newModel: string,
  estimatedTokens: number
): { savings: number; savingsPercent: number } {
  const currentCost = getModelCostMultiplier(currentModel);
  const newCost = getModelCostMultiplier(newModel);
  
  // Flash baseline is $0.075 per 1M tokens
  const flashCostPer1M = 0.075;
  const currentTotalCost = (estimatedTokens / 1000000) * flashCostPer1M * currentCost;
  const newTotalCost = (estimatedTokens / 1000000) * flashCostPer1M * newCost;
  
  const savings = currentTotalCost - newTotalCost;
  const savingsPercent = currentTotalCost > 0 
    ? ((savings / currentTotalCost) * 100) 
    : 0;
  
  return { savings, savingsPercent };
}
