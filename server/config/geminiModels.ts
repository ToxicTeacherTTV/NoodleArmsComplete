/**
 * 🎯 CENTRALIZED GEMINI MODEL CONFIGURATION
 * 
 * This module manages model selection with tiered fallback logic
 * to optimize costs while maintaining quality.
 * 
 * COST COMPARISON (per 1M input tokens):
 * - gemini-2.5-pro:         $1.25 (premium quality, expensive)
 * - gemini-2.5-flash:       $0.075 (17x cheaper, good quality)
 * - gemini-2.0-flash-exp:   Free tier (experimental, may be unstable)
 * 
 * FLASH MODEL HISTORY:
 * Flash models were previously BANNED due to hallucination issues (269 false memories).
 * After investigation, Flash Thinking models show improved reliability.
 * This config allows controlled use with fallback safety.
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
    description: 'Premium Pro model - best quality, highest cost'
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
    return {
      primary: process.env.GEMINI_DEV_MODEL || 'gemini-2.0-flash-exp',
      fallback: process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash',
      ultimate: 'gemini-2.5-pro' // Last resort
    };
  }
  
  // Production: Strategy varies by purpose
  switch (purpose) {
    case 'chat':
      // Chat: Flash for most, Pro for complex reasoning
      return {
        primary: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash',
        fallback: 'gemini-2.5-pro',
        ultimate: 'gemini-2.0-flash-exp' // Degraded mode
      };
      
    case 'extraction':
      // Extraction: Accuracy matters, use standard Flash
      return {
        primary: process.env.GEMINI_EXTRACTION_MODEL || 'gemini-2.5-flash',
        fallback: 'gemini-2.5-pro',
        ultimate: undefined // Don't use experimental for critical extraction
      };
      
    case 'analysis':
      // Analysis: Use Pro for critical analysis
      return {
        primary: process.env.GEMINI_ANALYSIS_MODEL || 'gemini-2.5-pro',
        fallback: 'gemini-2.5-flash',
        ultimate: undefined
      };
      
    case 'generation':
      // Content generation: Flash is usually fine
      return {
        primary: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash',
        fallback: 'gemini-2.5-pro',
        ultimate: 'gemini-2.0-flash-exp'
      };
  }
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
    return process.env.GEMINI_DEV_MODEL || 'gemini-2.0-flash-exp';
  }
  
  return process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash';
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
