// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { personalityController } from './personalityController.js';
// Tag processing consolidated into normalizeResponseTags (single-pass normalization)

export type ChatRequest = {
  message: string;
  conversationId: string;
  mode?: string;
  personalityControl?: any;
  selectedModel?: string;
  currentGame?: string;
  memoryLearning?: boolean;
  metadata?: any;
};

export function parseChatRequest(body: any): ChatRequest {
  const {
    message,
    conversationId,
    mode,
    personalityControl,
    selectedModel,
    currentGame,
    memoryLearning,
    metadata
  } = body ?? {};

  if (!message || !conversationId) {
    throw Object.assign(new Error("Message and conversation ID required"), { status: 400 });
  }

  return { message, conversationId, mode, personalityControl, selectedModel, currentGame, memoryLearning, metadata };
}

export type PrivacyDecision = {
  isPrivateConversation: boolean;
  isPrivateTrigger: boolean;
};

export async function decidePrivacy(storage: any, conversationId: string, message: string, memoryLearning?: boolean): Promise<PrivacyDecision> {
  const conversation = await storage.getConversation(conversationId);
  const isPrivateTrigger = /\[PRIVATE\]|\[OFF THE RECORD\]/i.test(message);
  const isPrivateConversation = (memoryLearning === false) || conversation?.isPrivate || isPrivateTrigger;

  if (isPrivateTrigger) {
    console.log(`🔒 Private trigger detected in message. This turn will not be stored in lore.`);
  } else if (memoryLearning === false) {
    console.log(`🔒 Memory Learning disabled via UI toggle. No lore will be extracted.`);
  } else if (conversation?.isPrivate) {
    console.log(`🔒 Conversation is marked as private. No lore will be extracted.`);
  }

  return { isPrivateConversation, isPrivateTrigger };
}

export function buildHeatAdvice(heatState: any) {
  return {
    heat: heatState.heat,
    heatLevel: heatState.heatLevel,
    game: heatState.currentGame,
    spice: heatState.spice
  };
}



export async function resolvePersonality({
  message,
  personalityControl,
}: {
  message: string;
  personalityControl?: any;
}): Promise<{ controls: any; heatState: any }> {
  // Dynamic import to avoid circular dependency
  const { heatController } = await import('./heatController.js');

  let basePersonality = await personalityController.consumeEffectivePersonality();

  if (personalityControl) {
    basePersonality = { ...basePersonality, ...personalityControl };
  }

  const heatState = await heatController.getState();

  const controls = { ...basePersonality };

  const switchOccurred = await personalityController.applyContextualSwitch(message);
  if (switchOccurred) {
    const newPersonality = await personalityController.getEffectivePersonality();
    Object.assign(controls, newPersonality);
  }

  return { controls, heatState };
}

/**
 * Normalize response tags - SINGLE source of truth for tag formatting.
 * 
 * Consolidates logic from enhanceResponse + applyUniversalCleanup into ONE pass.
 * 
 * Rules (priority order):
 * 1. DISCORD mode → strip ALL tags
 * 2. AI generated valid tags → trust them, normalize spacing only
 * 3. AI generated no tags → apply safe defaults
 * 4. Always ensure accent tag is first (move if needed)
 */
export function normalizeResponseTags(content: string, mode: string): {
  content: string;
  metrics: { processingTime: number };
} {
  const start = Date.now();

  // 0. Strip ALL asterisks (they break TTS and cause formatting issues)
  let processed = content.replaceAll('*', '');

  // 1. DISCORD mode: strip all tags
  if (mode === 'DISCORD') {
    const stripped = processed.replaceAll(/\s*\[[^\]]*\]\s*/g, ' ').replaceAll(/\s+/g, ' ').trim();
    return {
      content: stripped,
      metrics: { processingTime: Date.now() - start }
    };
  }

  // 2. Check if AI generated ANY tags
  const hasAnyTags = /\[[^\]]+\]/.test(processed);
  if (!hasAnyTags) {
    // AI generated ZERO tags → apply safe defaults
    console.log(`🎭 No tags detected. Applying defaults: [talking] [neutral]`);
    const defaultTags = '[thick italian-italian american nyc accent] [talking] [neutral] ';
    processed = defaultTags + processed;
  } else {
    console.log(`🎭 Tags detected. Trusting AI output (will normalize spacing and ensure accent tag).`);
  }

  // 3. Normalize tag spacing (ALWAYS, whether AI-generated or default)
  // Ensure space between tags: ][ → ] [
  processed = processed.replaceAll('][', '] [');

  // Remove line breaks after tags: ] \n → ]
  processed = processed.replaceAll(/(\[[^\]]+\])\s*[\r\n]+\s*/g, '$1 ');

  // 4. ALWAYS ensure accent tag is present and FIRST
  const ACCENT_TAG = '[thick italian-italian american nyc accent]';
  if (processed.includes(ACCENT_TAG)) {
    if (!processed.startsWith(ACCENT_TAG)) {
      // Move to front (and deduplicate if multiple present)
      processed = processed.replaceAll(ACCENT_TAG, '').trim();
      processed = `${ACCENT_TAG} ${processed}`;
      console.log(`🎭 Moved accent tag to front`);
    }
  } else {
    // Accent tag missing - add it at the beginning
    processed = `${ACCENT_TAG} ${processed}`;
    console.log(`🎭 Added missing accent tag`);
  }

  // 5. Fix incomplete sentences (multiple spaces before punctuation)
  // Pattern: "text   !" or "text   ?" indicates truncated/missing content
  processed = processed.replace(/\s{2,}([!?.])/g, '$1');

  // 6. Detect and warn about potential truncation
  const hasTruncationPattern = /\s{3,}[!?.]|\.\.\.\s*$/i.test(content);
  if (hasTruncationPattern) {
    console.warn('⚠️ Potential truncation detected in response (trailing spaces before punctuation)');
  }

  return {
    content: processed,
    metrics: { processingTime: Date.now() - start }
  };
}

export type BackgroundTaskOptions = {
  message: string;
  responseContent: string;
  activeProfileId: string;
  conversationId: string;
  allowMemoryWrites: boolean;
  modeSafe: string;
  messageCount: number;
  savedMessage: any;
  webSearchResults?: any[];
  storage: any;
};

/**
 * Handles all background tasks: Lore extraction, Topic decay, Auto-training, Web Memory.
 * Each task is wrapped in error boundary to prevent one failure from blocking others.
 */
export async function handleBackgroundTasks({
  message, responseContent, activeProfileId, conversationId, allowMemoryWrites,
  modeSafe, messageCount, savedMessage, webSearchResults, storage
}: BackgroundTaskOptions): Promise<void> {

  const isPrivateConversation = !allowMemoryWrites;

  // 1. Lore Orchestrator (Lore & Hallucinations)
  if (isPrivateConversation) {
    console.log(`🔒 Private conversation: Skipping Lore Orchestrator learning.`);
  } else {
    (async () => {
      try {
        const { loreOrchestrator } = await import('./LoreOrchestrator.js');

        // Get user info from conversation context (if available)
        const conversation = await storage.getConversation(conversationId);
        const speakerName = conversation?.metadata?.userName || 'User';
        const speakerId = conversation?.metadata?.userId || undefined;

        // Process user message for facts (with speaker metadata for story detection)
        await loreOrchestrator.processNewContent(
          message,
          activeProfileId,
          `Conversation: ${conversationId}`,
          'CONVERSATION',
          conversationId,
          {
            allowWrites: allowMemoryWrites,
            speaker: 'user',
            speakerName,
            speakerId
          }
        );

        // Process Nicky's response for story detection (Phase 2!)
        await loreOrchestrator.processNewContent(
          responseContent,
          activeProfileId,
          `Conversation: ${conversationId}`,
          'CONVERSATION',
          conversationId,
          {
            allowWrites: allowMemoryWrites,
            speaker: 'nicky',
            speakerName: 'Nicky',
            speakerId: activeProfileId
          }
        );

        // Check if Nicky's response contains new lore to promote
        await loreOrchestrator.checkHallucination(
          responseContent,
          activeProfileId,
          { allowWrites: allowMemoryWrites }
        );
      } catch (loreError) {
        console.error('❌ LoreOrchestrator background task failed:', loreError);
        // Continue to other tasks despite failure
      }
    })();
  }

  // 2. Topic Decay (wrapped in error boundary)
  try {
    await storage.coolDownTopics(activeProfileId);
    console.log(`🕒 Topics cooled down for profile ${activeProfileId}`);
  } catch (decayError) {
    console.error('❌ Topic decay task failed:', decayError);
    // Continue to other tasks despite failure
  }

  // 3. Auto-Training (Style Guides)
  if (isPrivateConversation) {
    console.log(`🔒 Private conversation: Skipping Auto-Training extraction.`);
  } else {
    (async () => {
      try {
        const { messageTrainingCollector } = await import('./messageTrainingCollector.js');

        // Evaluate in background (don't block response)
        // Small delay to ensure DB consistency
        setTimeout(async () => {
          try {
            const quality = await messageTrainingCollector.evaluateMessageQuality(savedMessage, {
              userMessage: message,
              conversationLength: messageCount + 1,
              hasPositiveRating: false // Will be updated if user rates
            });

            if (quality.isQuality) {
              await messageTrainingCollector.saveMessageAsTraining(
                storage,
                savedMessage,
                activeProfileId,
                {
                  userMessage: message,
                  conversationId,
                  mode: modeSafe,
                  allowWrites: allowMemoryWrites
                }
              );
              console.log(`📚 Auto-saved message as training (score: ${quality.score})`);
            }
          } catch (trainingError) {
            console.error('❌ Auto-training evaluation task failed:', trainingError);
            // Fail silently, don't block other tasks
          }
        }, 500);
      } catch (importError) {
        console.error('❌ Message training collector import failed:', importError);
        // Fail silently, don't block other tasks
      }
    })();
  }

  // 4. Web Memory Consolidation
  const webSearchUsed = webSearchResults && webSearchResults.length > 0;
  if (!isPrivateConversation && webSearchUsed && webSearchResults) {
    (async () => {
      try {
        const { webMemoryConsolidator } = await import('./webMemoryConsolidator.js');

        // Evaluate and store valuable web search results in background
        setTimeout(async () => {
          try {
            const candidates = await webMemoryConsolidator.evaluateResultsForStorage(
              webSearchResults,
              message,
              activeProfileId
            );

            if (candidates.length > 0) {
              const storedCount = await webMemoryConsolidator.storeWebMemories(
                candidates,
                activeProfileId,
                { allowWrites: allowMemoryWrites }
              );

              if (storedCount > 0) {
                console.log(`🌐 Consolidated ${storedCount} new web memories from search results`);
              }
            }
          } catch (consolidationError) {
            console.error('❌ Web memory consolidation task failed:', consolidationError);
            // Fail silently, don't block other tasks
          }
        }, 1000);

      } catch (importError) {
        console.error('❌ Web memory consolidator import failed:', importError);
        // Fail silently, don't block other tasks
      }
    })();
  }
}
