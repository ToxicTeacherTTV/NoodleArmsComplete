/**
 * 🎯 INTELLIGENT MODEL SELECTOR WITH AUTOMATIC FALLBACK
 * 
 * This service handles:
 * 1. Selecting the right model for each task (cost vs quality tradeoff)
 * 2. Automatic fallback when models fail or are overloaded
 * 3. Retry logic with exponential backoff
 * 4. Cost tracking and optimization
 */

import { 
  getModelStrategy, 
  isExperimentalModel, 
  getModelCostMultiplier,
  getModelConfig,
  type ModelPurpose 
} from '../config/geminiModels.js';

export interface ModelExecutionResult<T> {
  data: T;
  modelUsed: string;
  attemptsCount: number;
  totalRetryTimeMs: number;
  fallbackOccurred: boolean;
}

export interface ModelExecutionOptions {
  purpose: ModelPurpose;
  maxRetries?: number;
  allowExperimental?: boolean;
  forceModel?: string; // Override model selection
}

/**
 * Error classification for determining retry strategy
 */
export function classifyApiError(error: any): {
  isRetryable: boolean;
  shouldFallback: boolean;
  suggestedDelayMs?: number;
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const statusCode = error?.status || error?.response?.status || 0;

  // Parse retry delay from error if available (e.g., "Please retry in 59.19s")
  const retryMatch = errorMessage.match(/retry in ([\d.]+)s/i);
  const suggestedDelayMs = retryMatch 
    ? Math.min(Math.ceil(parseFloat(retryMatch[1]) * 1000), 120000) // Cap at 2 minutes
    : undefined;

  // Rate limit - retryable with suggested delay
  if (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
    return {
      isRetryable: true,
      shouldFallback: true, // Try next model in chain
      suggestedDelayMs: suggestedDelayMs || 5000
    };
  }

  // Service overloaded - retryable with fallback
  if (statusCode === 503 || errorMessage.toLowerCase().includes('overload')) {
    return {
      isRetryable: true,
      shouldFallback: true,
      suggestedDelayMs: suggestedDelayMs || 3000
    };
  }

  // Timeout - retryable but same model
  if (errorMessage.toLowerCase().includes('timeout') || 
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('ECONNRESET')) {
    return {
      isRetryable: true,
      shouldFallback: false, // Network issue, not model issue
      suggestedDelayMs: 2000
    };
  }

  // Auth errors - not retryable
  if (statusCode === 401 || errorMessage.toLowerCase().includes('api key')) {
    return {
      isRetryable: false,
      shouldFallback: false
    };
  }

  // Invalid request - not retryable
  if (statusCode === 400 || errorMessage.toLowerCase().includes('invalid')) {
    return {
      isRetryable: false,
      shouldFallback: false
    };
  }

  // Unknown errors - try once more with fallback
  return {
    isRetryable: true,
    shouldFallback: true,
    suggestedDelayMs: 3000
  };
}

/**
 * Execute API call with automatic model selection and fallback
 * 
 * @param operation - The API call function that takes a model name
 * @param options - Configuration for model selection and retry behavior
 * @returns Result with data and metadata about execution
 */
export async function executeWithModelFallback<T>(
  operation: (modelName: string) => Promise<T>,
  options: ModelExecutionOptions
): Promise<ModelExecutionResult<T>> {
  const maxRetries = options.maxRetries ?? 3;
  const startTime = Date.now();
  
  // Get model strategy
  const strategy = getModelStrategy(
    options.purpose,
    process.env.NODE_ENV === 'development' ? 'development' : 'production'
  );

  // Override with forced model if specified
  if (options.forceModel) {
    // If a model is forced, we still want to allow fallbacks if it fails,
    // but we make the forced model the primary one.
    strategy.primary = options.forceModel;
  }

  // Filter out experimental models if not allowed
  const modelChain = [
    strategy.primary,
    strategy.fallback,
    strategy.ultimate
  ].filter(model => {
    if (!model) return false;
    if (!options.allowExperimental && isExperimentalModel(model)) {
      console.log(`🚫 Skipping experimental model ${model} (not allowed)`);
      return false;
    }
    return true;
  }) as string[];

  if (modelChain.length === 0) {
    throw new Error(`No valid models available for ${options.purpose} with current settings`);
  }

  console.log(`🎯 Model chain for ${options.purpose}: ${modelChain.join(' → ')}`);

  let currentModelIndex = 0;
  let attemptsCount = 0;
  let fallbackOccurred = false;
  const errors: Array<{ model: string; attempt: number; error: string }> = [];

  while (currentModelIndex < modelChain.length) {
    const currentModel = modelChain[currentModelIndex];
    const modelConfig = getModelConfig(currentModel);
    
    console.log(`🤖 Attempting with ${currentModel} (${modelConfig?.description || 'unknown'})`);

    // Retry logic for current model
    const modelMaxRetries = isExperimentalModel(currentModel) ? 1 : maxRetries;
    
    for (let attempt = 0; attempt < modelMaxRetries; attempt++) {
      attemptsCount++;
      
      try {
        const result = await operation(currentModel);
        
        const totalTime = Date.now() - startTime;
        const costMultiplier = getModelCostMultiplier(currentModel);
        
        console.log(
          `✅ Success with ${currentModel} ` +
          `(attempt ${attemptsCount}, ${totalTime}ms, ${costMultiplier}x cost)`
        );

        return {
          data: result,
          modelUsed: currentModel,
          attemptsCount,
          totalRetryTimeMs: totalTime,
          fallbackOccurred
        };
      } catch (error: any) {
        const errorClassification = classifyApiError(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        errors.push({
          model: currentModel,
          attempt: attemptsCount,
          error: errorMessage
        });

        console.warn(
          `⚠️ ${currentModel} failed (attempt ${attempt + 1}/${modelMaxRetries}): ` +
          errorMessage.substring(0, 100)
        );

        // If this is the last attempt for this model
        if (attempt === modelMaxRetries - 1) {
          // Should we try the next model?
          if (errorClassification.shouldFallback && currentModelIndex < modelChain.length - 1) {
            console.log(`🔄 Falling back to next model in chain`);
            fallbackOccurred = true;
            break; // Exit retry loop, move to next model
          }
          
          // If not retryable and no more models, throw
          if (!errorClassification.isRetryable) {
            console.error(`❌ Non-retryable error, giving up`);
            throw error;
          }
          
          // Last model, last attempt - throw
          if (currentModelIndex === modelChain.length - 1) {
            console.error(`❌ All models exhausted, giving up`);
            console.error(`Error history:`, errors);
            throw error;
          }
        } else {
          // Not the last attempt for this model - wait and retry
          const delay = errorClassification.suggestedDelayMs || 
                       Math.pow(2, attempt) * 1000; // Exponential backoff
          
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Move to next model in chain
    currentModelIndex++;
  }

  // Should never reach here, but TypeScript needs this
  throw new Error('Unexpected error: model fallback logic failed');
}

/**
 * Simple wrapper for operations that don't need fallback complexity
 * Uses default model strategy
 */
export async function executeWithDefaultModel<T>(
  operation: (modelName: string) => Promise<T>,
  purpose: ModelPurpose
): Promise<T> {
  const result = await executeWithModelFallback(operation, {
    purpose,
    maxRetries: 3,
    allowExperimental: true
  });
  
  return result.data;
}

/**
 * For critical operations that should never use experimental models
 */
export async function executeWithProductionModel<T>(
  operation: (modelName: string) => Promise<T>,
  purpose: ModelPurpose
): Promise<T> {
  const result = await executeWithModelFallback(operation, {
    purpose,
    maxRetries: 5,
    allowExperimental: false // Only production-ready models
  });

  return result.data;
}

/**
 * 🛡️ SAFE TEXT EXTRACTION FROM GEMINI RESPONSES
 * Handles responses that may contain "thought" parts from thinking models
 * without triggering SDK warnings about non-text parts.
 */
export function safeExtractText(response: any): string {
  if (!response) return "";

  try {
    // 1. Try the .text property (new @google/genai SDK v1)
    if (typeof response.text === 'string') {
      return response.text;
    }

    // 2. Try to get text from parts (standard structure)
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts && Array.isArray(parts)) {
      // Filter out "thought" parts (thinking/reasoning) and join regular text
      const text = parts
        .filter((part: any) => part.text && !part.thought && !part.thinkingContent)
        .map((part: any) => part.text)
        .join('');
      if (text) return text;
    }

    // 3. Try the .text() method (older @google/generative-ai SDK)
    // Note: This often throws warnings, so we try to avoid it if possible
    if (typeof response.text === 'function') {
      try {
        return response.text();
      } catch {
        // Fallback if SDK method fails on non-text parts
        const candidateParts = response.candidates?.[0]?.content?.parts;
        if (candidateParts) {
          return candidateParts.filter((p: any) => p.text).map((p: any) => p.text).join('') || "";
        }
      }
    }

    // 4. Deep dive into candidates
    const candidateText = response.candidates?.[0]?.text;
    if (typeof candidateText === 'string') return candidateText;

    return "";

  } catch (e) {
    console.warn("⚠️ Error extracting text from response:", e);
    return "";
  }
}
