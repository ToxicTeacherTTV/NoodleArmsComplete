import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProfileSchema, insertConversationSchema, insertMessageSchema, insertDocumentSchema, insertMemoryEntrySchema, insertContentFlagSchema, insertDiscordServerSchema, insertDiscordMemberSchema, insertDiscordTopicTriggerSchema, loreCharacters, loreEvents, documents, memoryEntries, contentFlags } from "@shared/schema";
import { eq, and, sql, or, inArray } from "drizzle-orm";
import { db } from "./db";
import { anthropicService } from "./services/anthropic";
import { elevenlabsService } from "./services/elevenlabs";
import { documentProcessor } from "./services/documentProcessor";
import { geminiService } from "./services/gemini";
import ChaosEngine from "./services/chaosEngine.js";
import EvolutionaryAI from "./services/evolutionaryAI.js";
import { LoreEngine } from './services/loreEngine.js';
import { MemoryAnalyzer } from './services/memoryAnalyzer.js';
import { conversationParser } from './services/conversationParser.js';
import { smartContradictionDetector } from './services/smartContradictionDetector';
import { aiFlagger } from './services/aiFlagger';
import { discordBotService } from './services/discordBot';
import { intelligenceEngine } from './services/intelligenceEngine';
import { storyReconstructor } from './services/storyReconstructor';
import { ContentCollectionManager } from './services/ingestion/ContentCollectionManager';
import { adGenerationService } from './services/AdGenerationService';
import { podcastFactExtractor } from './services/podcastFactExtractor';
import { insertAutomatedSourceSchema, insertPendingContentSchema, insertAdTemplateSchema, insertPrerollAdSchema } from '@shared/schema';
import multer from "multer";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";

// CRITICAL SECURITY: Add file size limits and type validation to prevent DoS attacks
const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit to prevent DoS attacks
    files: 1, // Only allow one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Validate MIME type to prevent malicious uploads
    if (SUPPORTED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Multer expects null as first parameter for rejection, boolean as second
      cb(null, false);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint with system status
  app.get('/api/health', async (req, res) => {
    try {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
        },
        services: {
          database: false,
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
          elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
          gemini: Boolean(process.env.GEMINI_API_KEY),
          discord: Boolean(process.env.DISCORD_BOT_TOKEN)
        }
      };

      // Test database connection
      try {
        await db.select().from(memoryEntries).limit(1);
        healthStatus.services.database = true;
      } catch (dbError) {
        console.warn('Database health check failed:', dbError);
      }

      const hasIssues = !healthStatus.services.database || 
                        !healthStatus.services.anthropic ||
                        !healthStatus.services.gemini;
      
      if (hasIssues) {
        healthStatus.status = 'degraded';
        return res.status(200).json(healthStatus); // Still return 200 for monitoring
      }

      res.json(healthStatus);
    } catch (error) {
      console.error('Health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Internal server error'
      });
    }
  });

  // Profile management routes
  app.get('/api/profiles', async (req, res) => {
    try {
      const profiles = await storage.listProfiles();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch profiles' });
    }
  });

  app.get('/api/profiles/active', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(404).json({ error: 'No active profile found' });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch active profile' });
    }
  });

  app.post('/api/profiles', async (req, res) => {
    try {
      const profileData = insertProfileSchema.parse(req.body);
      const profile = await storage.createProfile(profileData);
      res.json(profile);
    } catch (error) {
      res.status(400).json({ error: 'Invalid profile data' });
    }
  });

  app.put('/api/profiles/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const profile = await storage.updateProfile(id, updates);
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.put('/api/profiles/:id/activate', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.setActiveProfile(id);
      
      // Get the newly activated profile and set its voice
      const activeProfile = await storage.getProfile(id);
      if (activeProfile && activeProfile.voiceId) {
        elevenlabsService.setVoiceId(activeProfile.voiceId);
        console.log(`🎵 Voice set to ${activeProfile.voiceId} for activated profile: ${activeProfile.name}`);
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to activate profile' });
    }
  });

  app.delete('/api/profiles/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProfile(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete profile' });
    }
  });

  // Voice settings endpoints
  app.get('/api/profiles/:id/voice', async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await storage.getProfile(id);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      res.json({
        voiceId: profile.voiceId,
        voiceSettings: profile.voiceSettings
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get voice settings' });
    }
  });

  app.put('/api/profiles/:id/voice', async (req, res) => {
    try {
      const { id } = req.params;
      const { voiceId, voiceSettings } = req.body;
      
      const updateData: any = {};
      if (voiceId !== undefined) updateData.voiceId = voiceId;
      if (voiceSettings !== undefined) updateData.voiceSettings = voiceSettings;
      
      const profile = await storage.updateProfile(id, updateData);
      
      // If this is the active profile, update the ElevenLabs service
      if (profile.isActive && profile.voiceId) {
        elevenlabsService.setVoiceId(profile.voiceId);
      }
      
      res.json({
        voiceId: profile.voiceId,
        voiceSettings: profile.voiceSettings
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update voice settings' });
    }
  });

  app.post('/api/speech/set-voice', async (req, res) => {
    try {
      const { voiceId } = req.body;
      if (!voiceId) {
        return res.status(400).json({ error: 'Voice ID is required' });
      }
      
      elevenlabsService.setVoiceId(voiceId);
      res.json({ success: true, voiceId });
    } catch (error) {
      res.status(500).json({ error: 'Failed to set voice' });
    }
  });

  // Conversation routes
  app.post('/api/conversations', async (req, res) => {
    try {
      const conversationData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(conversationData);
      res.json(conversation);
    } catch (error) {
      res.status(400).json({ error: 'Invalid conversation data' });
    }
  });

  app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
      const { id } = req.params;
      const messages = await storage.getConversationMessages(id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/conversations/:id/messages', async (req, res) => {
    try {
      const { id: conversationId } = req.params;
      const messageData = insertMessageSchema.parse({
        ...req.body,
        conversationId,
      });
      const message = await storage.addMessage(messageData);
      res.json(message);
    } catch (error) {
      res.status(400).json({ error: 'Invalid message data' });
    }
  });

  // AI Chat routes
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, conversationId, mode, personalityControl } = req.body;
      
      if (!message || !conversationId) {
        return res.status(400).json({ error: 'Message and conversation ID required' });
      }

      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // 🎭 NEW: Personality Control v2.0 System
      const { DEFAULT_PERSONALITY_CONTROL, generatePersonalityPrompt } = await import('./types/personalityControl');
      const controls = personalityControl || DEFAULT_PERSONALITY_CONTROL;
      console.log(`🎭 Using personality controls:`, JSON.stringify(controls));

      // 🚀 REVOLUTIONARY: Semantic search with embeddings - finds relevant memories even without exact keyword matches
      console.log(`🔍 Performing hybrid semantic + keyword search for: "${message}"`);
      
      let searchBasedMemories: any[] = [];
      let semanticSearchUsed = false;
      
      try {
        const { embeddingService } = await import('./services/embeddingService');
        const hybridResults = await embeddingService.hybridSearch(message, activeProfile.id, 15);
        
        // Extract memories from hybrid search results (semantic + keyword combined)
        const semanticMemories = hybridResults.semantic.map(result => ({
          ...result,
          relevanceScore: result.similarity * 100,
          searchMethod: 'semantic'
        }));
        
        const keywordMemories = hybridResults.keyword.map(result => ({
          ...result, 
          relevanceScore: 70, // Default relevance for keyword matches
          searchMethod: 'keyword'
        }));
        
        // Combine and deduplicate hybrid results
        const seenIds = new Set();
        const combinedResults = [];
        
        // Prioritize semantic results (they're usually better)
        for (const result of semanticMemories) {
          if (!seenIds.has(result.id) && (result.confidence || 50) >= 60) {
            seenIds.add(result.id);
            combinedResults.push(result);
          }
        }
        
        // Add keyword results that weren't found semantically
        for (const result of keywordMemories) {
          if (!seenIds.has(result.id) && (result.confidence || 50) >= 60) {
            seenIds.add(result.id);
            combinedResults.push(result);
          }
        }
        
        searchBasedMemories = combinedResults;
        semanticSearchUsed = true;
        
        console.log(`🧠 Hybrid search: ${semanticMemories.length} semantic + ${keywordMemories.length} keyword = ${searchBasedMemories.length} unique results`);
      } catch (error) {
        console.warn('⚠️ Semantic search failed, falling back to keyword search:', error);
        const fallbackResults = await storage.searchEnrichedMemoryEntries(activeProfile.id, message);
        searchBasedMemories = fallbackResults.filter(m => (m.confidence || 50) >= 60);
        semanticSearchUsed = false;
      }
      
      // Get additional high-confidence memories as backup context
      const highConfidenceMemories = await storage.getEnrichedMemoriesForAI(activeProfile.id, 10);
      const seenIds = new Set(searchBasedMemories.map(m => m.id));
      const additionalMemories = highConfidenceMemories.filter(m => !seenIds.has(m.id));
      const relevantMemories = [...searchBasedMemories, ...additionalMemories.slice(0, 10)];
      
      // Update retrieval tracking for all used memories
      for (const memory of relevantMemories) {
        await storage.incrementMemoryRetrieval(memory.id);
      }
      
      const relevantDocs = await documentProcessor.searchDocuments(activeProfile.id, message);
      
      // Log confidence distribution for monitoring
      const confidenceStats = relevantMemories.length > 0 ? {
        min: Math.min(...relevantMemories.map(m => m.confidence || 50)),
        max: Math.max(...relevantMemories.map(m => m.confidence || 50)),
        avg: Math.round(relevantMemories.reduce((sum, m) => sum + (m.confidence || 50), 0) / relevantMemories.length)
      } : { min: 0, max: 0, avg: 0 };
      
      console.log(`🧠 AI Context: ${searchBasedMemories.length} search-based + ${additionalMemories.slice(0, 10).length} high-confidence facts (${relevantMemories.length} total). Confidence: ${confidenceStats.min}-${confidenceStats.max}% (avg: ${confidenceStats.avg}%)`);
      
      // 🌐 ENHANCED: Web search integration for current information
      let webSearchResults: any[] = [];
      let webSearchUsed = false;
      
      try {
        const { webSearchService } = await import('./services/webSearchService');
        
        // Intelligent decision: Should we search the web?
        const shouldSearch = webSearchService.shouldTriggerSearch(
          relevantMemories,
          message,
          confidenceStats.avg
        );
        
        if (shouldSearch) {
          console.log(`🔍 Triggering web search for: "${message}"`);
          console.log(`📊 Decision factors: ${relevantMemories.length} memories, ${confidenceStats.avg}% avg confidence`);
          
          const searchResponse = await webSearchService.search(message);
          
          if (searchResponse.results.length > 0) {
            webSearchResults = searchResponse.results.map(result => ({
              title: result.title,
              snippet: result.snippet,
              url: result.url,
              score: result.score,
              source: 'web_search'
            }));
            webSearchUsed = true;
            
            console.log(`🌐 Web search: Found ${webSearchResults.length} results in ${searchResponse.searchTime}ms`);
          } else {
            console.log(`🌐 Web search: No results found for "${message}"`);
          }
        } else {
          console.log(`🚫 Web search skipped: sufficient context available (${relevantMemories.length} memories, ${confidenceStats.avg}% confidence)`);
        }
      } catch (error) {
        console.warn('⚠️ Web search failed:', error);
        webSearchUsed = false;
      }
      
      // Get enhanced lore context (includes extracted knowledge from memories)
      const loreContext = await MemoryAnalyzer.getEnhancedLoreContext(activeProfile.id);

      // 🎭 Generate personality control prompt and log debug state
      const personalityPrompt = generatePersonalityPrompt(controls);
      
      // Log debug state for transparency
      const { generateDebugState } = await import('./types/personalityControl');
      const debugState = generateDebugState(controls);
      console.log(`🎭 ${debugState}`);
      
      // Generate AI response with personality controls, lore context, mode awareness, and web search results
      const aiResponse = await anthropicService.generateResponse(
        message,
        activeProfile.coreIdentity,
        relevantMemories,
        relevantDocs,
        loreContext,
        mode,
        conversationId,
        activeProfile.id,
        webSearchResults,
        personalityPrompt
      );

      // 🎭 Process response: strip debug patterns and add emotion tags
      let processedContent = aiResponse.content;
      
      // Remove any debug headers that Claude might generate despite instructions
      processedContent = processedContent
        .replace(/\[NICKY STATE\][^\n]*/gi, '') // Remove debug state header
        .replace(/<!--\s*METRICS[^>]*-->/gi, '') // Remove metrics footer
        .trim();
      try {
        const { emotionTagGenerator } = await import('./services/emotionTagGenerator');
        
        const emotionTags = await emotionTagGenerator.generateEmotionTags({
          content: processedContent,
          personality: activeProfile.name,
          contentType: 'voice_response',
          mood: controls.preset === 'Chill Nicky' ? 'relaxed' : 
                controls.preset === 'Roast Mode' ? 'aggressive' :
                controls.preset === 'Unhinged' ? 'chaotic' : 'balanced',
          intensity: controls.intensity === 'low' ? 'low' : 
                    controls.intensity === 'high' || controls.intensity === 'ultra' ? 'high' : 'medium'
        });
        
        // Apply emotion tags to content, respecting [bronx] tag order for podcast mode
        console.log(`🎭 Original content starts with: "${processedContent.substring(0, 20)}..."`);
        
        if (processedContent.trim().startsWith('[bronx]')) {
          // If response starts with [bronx], place emotion tag after it
          processedContent = processedContent.replace(/^\s*\[bronx\]\s*/, `[bronx] ${emotionTags.hook} `);
          console.log(`🎭 Applied emotion tags AFTER [bronx]: hook="${emotionTags.hook}"`);
        } else {
          // Check if [bronx] appears somewhere else and move it to front
          if (processedContent.includes('[bronx]')) {
            // Remove [bronx] from wherever it is and put it at the front with emotion tag
            processedContent = processedContent.replace(/\s*\[bronx\]\s*/g, '').trim();
            processedContent = `[bronx] ${emotionTags.hook} ${processedContent}`;
            console.log(`🎭 Moved [bronx] to front with emotion tag: hook="${emotionTags.hook}"`);
          } else {
            // No [bronx] tag, prepend emotion tag normally
            processedContent = `${emotionTags.hook} ${processedContent}`;
            console.log(`🎭 Applied emotion tags normally: hook="${emotionTags.hook}"`);
          }
        }
        
      } catch (error) {
        console.warn('⚠️ Failed to generate emotion tags:', error);
        // Continue with original content if emotion tag generation fails
      }

      const response = {
        ...aiResponse,
        content: processedContent
      };

      // Store the AI response
      await storage.addMessage({
        conversationId,
        type: 'AI' as const,
        content: response.content,
        metadata: {
          processingTime: response.processingTime,
          retrieved_context: response.retrievedContext,
          webSearchUsed: webSearchUsed,
          webResultsCount: webSearchResults.length,
        },
      });

      // 🌐 ENHANCED: Post-response memory consolidation for web search results
      if (webSearchUsed && webSearchResults.length > 0) {
        try {
          const { webMemoryConsolidator } = await import('./services/webMemoryConsolidator');
          
          // Evaluate and store valuable web search results in background
          setTimeout(async () => {
            try {
              const candidates = await webMemoryConsolidator.evaluateResultsForStorage(
                webSearchResults,
                message,
                activeProfile.id
              );
              
              if (candidates.length > 0) {
                const storedCount = await webMemoryConsolidator.storeWebMemories(
                  candidates,
                  activeProfile.id,
                  conversationId
                );
                
                if (storedCount > 0) {
                  console.log(`💾 Background consolidation: Stored ${storedCount} web search results as memories`);
                }
              }
            } catch (error) {
              console.warn('⚠️ Background web memory consolidation failed:', error);
            }
          }, 100); // Small delay to not block response

        } catch (error) {
          console.warn('⚠️ Failed to initiate web memory consolidation:', error);
        }
      }

      // 🎲 ENHANCED: Trigger response-based chaos evolution after successful AI response
      chaosEngine.onResponseGenerated();

      res.json(response);
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: 'Failed to generate response' });
    }
  });

  // Get available voices
  app.get('/api/speech/voices', async (req, res) => {
    try {
      const voices = await elevenlabsService.getVoices();
      res.json(voices);
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      res.status(500).json({ error: 'Failed to fetch voices' });
    }
  });

  // TTS request validation schema
  const ttsRequestSchema = z.object({
    text: z.string().min(1, 'Text is required').max(5000, 'Text too long (max 5000 characters)'),
    emotionProfile: z.string().optional(),
    contentType: z.enum(['ad', 'chat', 'announcement', 'voice_response']).optional(),
    personality: z.string().min(1).max(100).optional(),
    mood: z.string().min(1).max(50).optional(),
    useAI: z.boolean().optional()
  });

  // Speech synthesis route
  app.post('/api/speech/synthesize', async (req, res) => {
    try {
      // Validate request body
      const validationResult = ttsRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request parameters',
          details: validationResult.error.format()
        });
      }

      const { 
        text, 
        emotionProfile, 
        contentType, 
        personality, 
        mood, 
        useAI 
      } = validationResult.data;

      // Get active profile and use its voice settings
      const activeProfile = await storage.getActiveProfile();
      let voiceSettings;
      
      if (activeProfile && activeProfile.voiceSettings) {
        voiceSettings = activeProfile.voiceSettings;
        // Also ensure the voice ID is set
        if (activeProfile.voiceId) {
          elevenlabsService.setVoiceId(activeProfile.voiceId);
        }
      }

      // Prepare AI context for emotion tag generation
      const context = contentType ? {
        contentType: contentType as 'ad' | 'chat' | 'announcement' | 'voice_response',
        personality: personality || (activeProfile?.name || 'neutral'),
        mood: mood || 'balanced',
        useAI: useAI !== false  // Default to true unless explicitly disabled
      } : undefined;

      // Use AI emotion tags for ads, hardcoded for other content types
      const audioBuffer = await elevenlabsService.synthesizeSpeech(
        text, 
        emotionProfile, 
        voiceSettings,
        context
      );
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      res.send(audioBuffer);
    } catch (error) {
      console.error('Speech synthesis error:', error);
      res.status(500).json({ error: 'Failed to synthesize speech' });
    }
  });

  // Multer error handling middleware
  const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files. Only one file allowed at a time.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  };

  // Document upload and processing
  app.post('/api/documents/upload', upload.single('document'), handleMulterError, async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or unsupported file type. Supported types: PDF, DOCX, TXT, MD' });
      }

      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const document = await storage.createDocument({
        profileId: activeProfile.id,
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        size: req.file.size,
        processingStatus: 'PENDING' as const,
      });

      // Process document asynchronously
      documentProcessor.processDocument(document.id, req.file.buffer)
        .catch(error => {
          console.error('Document processing error:', error);
          storage.updateDocument(document.id, { processingStatus: 'FAILED' as const });
        });

      res.json(document);
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });

  app.get('/api/documents', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const documents = await storage.getProfileDocuments(activeProfile.id);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  app.get('/api/documents/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json({ 
        ...document, 
        content: document.extractedContent || 'No content available' 
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  });

  app.delete('/api/documents/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDocument(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  // Extract facts from document to memory system
  app.post('/api/documents/:id/extract-facts', async (req, res) => {
    try {
      const { id } = req.params;
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (document.processingStatus !== 'COMPLETED' || !document.extractedContent) {
        return res.status(400).json({ error: 'Document must be processed before extracting facts' });
      }

      // Extract facts from the document using the document processor
      await documentProcessor.extractAndStoreKnowledge(
        activeProfile.id, 
        document.extractedContent, 
        document.filename, 
        document.id
      );

      // Get a count of facts created (approximate)
      const memoryStats = await storage.getMemoryStats(activeProfile.id);
      
      res.json({ 
        success: true, 
        factsCreated: 'Facts extracted successfully',
        message: 'Document content has been processed into Nicky\'s memory for RAG retrieval'
      });
    } catch (error) {
      console.error('Fact extraction error:', error);
      res.status(500).json({ error: 'Failed to extract facts from document' });
    }
  });

  // Save document content to content library
  app.post('/api/documents/:id/save-to-content-library', async (req, res) => {
    try {
      const { id } = req.params;
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (document.processingStatus !== 'COMPLETED' || !document.extractedContent) {
        return res.status(400).json({ error: 'Document must be processed before saving to content library' });
      }

      // Determine content category based on filename
      let category: 'AITA' | 'REDDIT_STORY' | 'ENTERTAINMENT' | 'OTHER' = 'OTHER';
      const filename = document.filename.toLowerCase();
      if (filename.includes('aita')) {
        category = 'AITA';
      } else if (filename.includes('reddit')) {
        category = 'REDDIT_STORY';
      } else if (filename.includes('story') || filename.includes('entertainment')) {
        category = 'ENTERTAINMENT';
      }

      // Determine content length
      const contentLength = document.extractedContent.length;
      let length: 'SHORT' | 'MEDIUM' | 'LONG' = 'MEDIUM';
      if (contentLength < 1000) {
        length = 'SHORT';
      } else if (contentLength > 5000) {
        length = 'LONG';
      }

      // Create content library entry
      const contentEntry = await storage.createContentLibraryEntry({
        profileId: activeProfile.id,
        title: document.filename.replace(/\.[^/.]+$/, ''), // Remove extension
        content: document.extractedContent,
        category,
        source: document.filename,
        sourceId: document.id,
        tags: [category.toLowerCase(), 'document', 'imported'],
        length,
        mood: 'NEUTRAL'
      });

      res.json({ 
        success: true, 
        title: contentEntry.title,
        category: contentEntry.category,
        message: 'Document content has been saved to content library'
      });
    } catch (error) {
      console.error('Content library save error:', error);
      res.status(500).json({ error: 'Failed to save document to content library' });
    }
  });

  // Content Library routes
  app.get('/api/content-library', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const contentEntries = await storage.getContentLibraryEntries(activeProfile.id);
      res.json(contentEntries);
    } catch (error) {
      console.error('Content library fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch content library' });
    }
  });

  app.get('/api/content-library/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const contentEntry = await storage.getContentLibraryEntry(id);
      if (!contentEntry) {
        return res.status(404).json({ error: 'Content not found' });
      }
      res.json(contentEntry);
    } catch (error) {
      console.error('Content library get error:', error);
      res.status(500).json({ error: 'Failed to fetch content' });
    }
  });

  app.patch('/api/content-library/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, category, mood, tags } = req.body;
      
      const updates: any = {};
      if (title) updates.title = title;
      if (content) updates.content = content;
      if (category) updates.category = category;
      if (mood) updates.mood = mood;
      if (tags) updates.tags = tags;

      const updatedEntry = await storage.updateContentLibraryEntry(id, updates);
      if (!updatedEntry) {
        return res.status(404).json({ error: 'Content not found' });
      }
      
      res.json(updatedEntry);
    } catch (error) {
      console.error('Content library update error:', error);
      res.status(500).json({ error: 'Failed to update content' });
    }
  });

  app.delete('/api/content-library/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteContentLibraryEntry(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Content library delete error:', error);
      res.status(500).json({ error: 'Failed to delete content' });
    }
  });

  // Notes management routes
  app.get('/api/notes', async (req, res) => {
    try {
      const notesPath = path.join(process.cwd(), 'NOTES.md');
      try {
        const content = await fs.readFile(notesPath, 'utf8');
        res.json({ content });
      } catch (readError) {
        // If file doesn't exist, return empty content
        res.json({ content: '# Development Notes\n\n<!-- Add your notes here -->\n' });
      }
    } catch (error) {
      console.error('Failed to read notes:', error);
      res.status(500).json({ error: 'Failed to read notes' });
    }
  });

  app.put('/api/notes', async (req, res) => {
    try {
      const { content } = req.body;
      if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Content must be a string' });
      }
      
      const notesPath = path.join(process.cwd(), 'NOTES.md');
      await fs.writeFile(notesPath, content, 'utf8');
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to write notes:', error);
      res.status(500).json({ error: 'Failed to write notes' });
    }
  });

  // Memory management routes
  app.get('/api/memory/entries', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Get all entries for search functionality
      const limit = parseInt(req.query.limit as string) || 10000; // Large limit for search
      const entries = await storage.getMemoryEntries(activeProfile.id, limit);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch memory entries' });
    }
  });

  // Clean up incorrectly attributed memories
  app.post('/api/memory/cleanup-attribution', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const entries = await storage.getMemoryEntries(activeProfile.id, 10000);
      let deletedCount = 0;

      // Find and delete memories that look like user preferences incorrectly attributed to Nicky
      for (const entry of entries) {
        const content = entry.content.toLowerCase();
        const isFromDocument = entry.source?.startsWith('ai-extract:') || entry.source?.startsWith('document:');
        
        if (isFromDocument && entry.type === 'PREFERENCE') {
          // Look for patterns that suggest user preferences stored as Nicky's
          const suspiciousPatterns = [
            'nicky mains ', 
            'nicky prefers ',
            'nicky likes ',
            'nicky\'s primary killer',
            'nicky uses '
          ];
          
          const matchesPattern = suspiciousPatterns.some(pattern => content.includes(pattern));
          const lacksNickyContext = !content.includes('nicky said') && !content.includes('nicky mentioned') && 
                                  !content.includes('nicky states') && !content.includes('according to nicky');
          
          if (matchesPattern && lacksNickyContext) {
            await storage.deleteMemoryEntry(entry.id);
            deletedCount++;
            console.log(`Deleted potentially misattributed memory: ${entry.content}`);
          }
        }
      }

      res.json({ 
        message: `Cleaned up ${deletedCount} potentially misattributed memories`,
        deletedCount 
      });
    } catch (error) {
      console.error('Memory cleanup error:', error);
      res.status(500).json({ error: 'Failed to cleanup memories' });
    }
  });

  // Clean up hardcoded lore characters that conflict with user preferences
  app.post('/api/memory/cleanup-lore-characters', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Clean up hardcoded characters from lore system
      const charactersDeleted = await storage.db.delete(loreCharacters)
        .where(eq(loreCharacters.profileId, activeProfile.id));
        
      const eventsDeleted = await storage.db.delete(loreEvents)
        .where(eq(loreEvents.profileId, activeProfile.id));

      console.log('Cleaned up hardcoded lore characters and events');

      res.json({ 
        message: 'Cleaned up hardcoded lore characters and events that were causing character conflicts',
        charactersDeleted: charactersDeleted.rowCount || 0,
        eventsDeleted: eventsDeleted.rowCount || 0
      });
    } catch (error) {
      console.error('Lore cleanup error:', error);
      res.status(500).json({ error: 'Failed to cleanup lore data' });
    }
  });

  app.get('/api/memory/stats', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const stats = await storage.getMemoryStats(activeProfile.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch memory stats' });
    }
  });

  app.post('/api/memory/consolidate', async (req, res) => {
    try {
      const { conversationId } = req.body;
      
      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID required' });
      }

      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Get recent messages for consolidation
      const recentMessages = await storage.getRecentMessages(conversationId, 10);
      
      if (recentMessages.length === 0) {
        return res.json({ message: 'No messages to consolidate' });
      }

      // Use Claude to consolidate memories
      console.log(`💬 Memory consolidation: Processing ${recentMessages.length} recent messages`);
      const consolidatedMemories = await anthropicService.consolidateMemories(recentMessages);
      
      // Store the consolidated memories with confidence based on conversation context
      for (const memory of consolidatedMemories) {
        await storage.addMemoryEntry({
          profileId: activeProfile.id,
          type: memory.type as any,
          content: memory.content,
          importance: memory.importance,
          confidence: 75, // Good confidence since extracted from conversation context
          supportCount: 1,
          source: 'conversation',
        });
      }

      res.json({ 
        message: `Consolidated ${consolidatedMemories.length} memories`,
        memories: consolidatedMemories 
      });
    } catch (error) {
      console.error('Memory consolidation error:', error);
      res.status(500).json({ error: 'Failed to consolidate memories' });
    }
  });

  app.post('/api/memory/clear', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Get count before clearing
      const stats = await storage.getMemoryStats(activeProfile.id);
      
      // Clear existing memories
      await storage.clearProfileMemories(activeProfile.id);

      res.json({ 
        message: `Cleared ${stats.totalFacts} memory entries`,
        clearedCount: stats.totalFacts
      });
    } catch (error) {
      console.error('Memory clear error:', error);
      res.status(500).json({ error: 'Failed to clear memories' });
    }
  });

  app.post('/api/memory/optimize', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Get only high-confidence, reliable memories for optimization
      const reliableMemories = await storage.getReliableMemoriesForAI(activeProfile.id, 10000);
      console.log(`🔧 Memory optimization: Using ${reliableMemories.length} high-confidence memories (≥60% confidence)`);
      // Map memories to expected format, handling null values
      const memoriesForOptimization = reliableMemories.map(m => ({
        id: m.id,
        type: m.type,
        content: m.content,
        importance: m.importance || 1,
        source: m.source || 'unknown'
      }));
      const optimizedMemories = await geminiService.consolidateAndOptimizeMemories(memoriesForOptimization);
      
      // Clear existing memories and replace with optimized ones
      await storage.clearProfileMemories(activeProfile.id);
      
      // Add optimized memories back with high confidence (since they came from high-confidence sources)
      for (const memory of optimizedMemories) {
        await storage.addMemoryEntry({
          profileId: activeProfile.id,
          type: memory.type,
          content: memory.content,
          importance: memory.importance,
          confidence: 85, // High confidence since optimized from reliable sources
          supportCount: 1,
          source: memory.source || 'optimization',
        });
      }

      res.json({ 
        message: `Knowledge base optimized: ${reliableMemories.length} → ${optimizedMemories.length} entries`,
        beforeCount: reliableMemories.length,
        afterCount: optimizedMemories.length
      });
    } catch (error) {
      console.error('Knowledge optimization error:', error);
      res.status(500).json({ error: 'Failed to optimize knowledge base' });
    }
  });

  app.post('/api/documents/reprocess', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Get all completed documents for the active profile
      const documents = await storage.getProfileDocuments(activeProfile.id);
      const completedDocs = documents.filter(doc => doc.processingStatus === 'COMPLETED');
      
      let processedCount = 0;
      
      for (const document of completedDocs) {
        try {
          if (document.extractedContent) {
            // Re-extract knowledge using hierarchical logic (prevents orphaned facts)
            await documentProcessor.extractAndStoreKnowledge(
              activeProfile.id, 
              document.extractedContent, 
              document.filename,
              document.id
            );
            processedCount++;
          }
        } catch (error) {
          console.error(`Failed to reprocess document ${document.filename}:`, error);
        }
      }

      res.json({ 
        message: `Reprocessed ${processedCount} documents`,
        processedCount,
        totalDocuments: completedDocs.length
      });
    } catch (error) {
      console.error('Document reprocessing error:', error);
      res.status(500).json({ error: 'Failed to reprocess documents' });
    }
  });

  // Evolutionary AI and Chaos Engine
  const evolutionaryAI = new EvolutionaryAI();
  const chaosEngine = ChaosEngine.getInstance();

  app.get('/api/chaos/state', async (req, res) => {
    try {
      const chaosState = await chaosEngine.getCurrentState();
      const effectiveLevel = chaosEngine.getEffectiveChaosLevel();
      res.json({
        ...chaosState,
        effectiveLevel
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get chaos state' });
    }
  });

  app.post('/api/chaos/trigger', async (req, res) => {
    try {
      const { eventType } = req.body;
      const validEvents = ['death', 'win', 'trolled', 'compliment', 'random'];
      
      if (!validEvents.includes(eventType)) {
        return res.status(400).json({ error: 'Invalid event type' });
      }
      
      await chaosEngine.triggerChaosEvent(eventType);
      const newState = await chaosEngine.getCurrentState();
      res.json(newState);
    } catch (error) {
      res.status(500).json({ error: 'Failed to trigger chaos event' });
    }
  });

  // Manual chaos level override (for next response only)
  app.post('/api/chaos/override', async (req, res) => {
    try {
      const { level } = req.body;
      
      if (typeof level !== 'number' || level < 0 || level > 100) {
        return res.status(400).json({ error: 'Level must be a number between 0 and 100' });
      }
      
      await chaosEngine.setManualOverride(level);
      const newState = await chaosEngine.getCurrentState();
      res.json({
        ...newState,
        effectiveLevel: chaosEngine.getEffectiveChaosLevel(),
        message: `Manual override set to ${level}% for next response`
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to set chaos override' });
    }
  });

  // Set permanent base chaos level
  app.post('/api/chaos/set-level', async (req, res) => {
    try {
      const { level } = req.body;
      
      if (typeof level !== 'number' || level < 0 || level > 100) {
        return res.status(400).json({ error: 'Level must be a number between 0 and 100' });
      }
      
      await chaosEngine.setBaseLevel(level);
      const newState = await chaosEngine.getCurrentState();
      res.json({
        ...newState,
        effectiveLevel: chaosEngine.getEffectiveChaosLevel(),
        message: `Base chaos level permanently set to ${level}%`
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to set chaos level' });
    }
  });

  // EVOLUTIONARY AI ROUTES - The Ultimate Brain Upgrade! 🧠
  app.post('/api/memory/evolutionary-optimization', async (req, res) => {
    try {
      const { profileId } = req.body;
      
      if (!profileId) {
        return res.status(400).json({ error: 'Profile ID required' });
      }

      // Get only high-confidence memories for evolutionary optimization
      const reliableMemories = await storage.getReliableMemoriesForAI(profileId, 1000);
      console.log(`🧬 Evolutionary optimization: Using ${reliableMemories.length} high-confidence memories (≥60% confidence)`);
      
      // Run the revolutionary optimization with reliable data only
      const result = await evolutionaryAI.evolutionaryOptimization(reliableMemories);
      
      // Store the optimized facts back (in a real system, you'd want to backup first)
      // For now, let's just return the results
      res.json({
        message: 'Evolutionary optimization complete!',
        ...result,
        summary: {
          originalFacts: reliableMemories.length,
          optimizedFacts: result.optimizedFacts.length,
          relationships: result.relationships.length,
          clusters: result.clusters.length,
          knowledgeGaps: result.knowledgeGaps.length,
          qualityImprovement: result.metrics.avgQualityScore,
          knowledgeCoverage: result.metrics.knowledgeCoverage
        }
      });
    } catch (error) {
      console.error('Evolutionary optimization error:', error);
      res.status(500).json({ error: 'Failed to run evolutionary optimization' });
    }
  });

  app.get('/api/memory/evolution-metrics', async (req, res) => {
    try {
      let profileId = req.query.profileId as string;
      
      // Always get the active profile (same as memory stats endpoint)
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }
      profileId = activeProfile.id;

      // Get memory entries for the active profile
      const memories = await storage.getMemoryEntries(profileId);
      
      // Calculate current evolution metrics
      const totalFacts = memories.length;
      const avgQuality = totalFacts > 0 ? 
        memories.reduce((sum, m) => sum + (m.qualityScore || 5), 0) / totalFacts : 5;
      const avgImportance = totalFacts > 0 ? 
        memories.reduce((sum, m) => sum + (m.importance || 1), 0) / totalFacts : 1;
      const recentlyUsed = memories.filter(m => m.lastUsed && 
        new Date(m.lastUsed).getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000)
      ).length;
      
      const metrics = {
        totalFacts,
        avgQualityScore: Number(avgQuality.toFixed(1)),
        avgImportance: Number(avgImportance.toFixed(1)),
        recentUsageRate: Number((recentlyUsed / totalFacts).toFixed(2)),
        estimatedClusters: Math.floor(totalFacts / 50), // Rough estimate
        lastOptimization: 'Never', // Would track this in production
        readyForOptimization: totalFacts > 100 // Suggest optimization if lots of facts
      };
      
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get evolution metrics' });
    }
  });

  // Brain Management API endpoints
  app.get('/api/memory/high-confidence', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const highConfidenceFacts = await storage.getHighConfidenceMemories(activeProfile.id, 90, 100);
      res.json(highConfidenceFacts);
    } catch (error) {
      console.error('High confidence facts error:', error);
      res.status(500).json({ error: 'Failed to get high confidence facts' });
    }
  });

  // 🚀 NEW: Medium confidence facts endpoint (60-89%)
  app.get('/api/memory/medium-confidence', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const mediumConfidenceFacts = await storage.getMemoriesByConfidenceRange(activeProfile.id, 60, 89);
      console.log(`📊 Found ${mediumConfidenceFacts.length} medium confidence facts (60-89%)`);
      res.json(mediumConfidenceFacts);
    } catch (error) {
      console.error('Medium confidence facts error:', error);
      res.status(500).json({ error: 'Failed to get medium confidence facts' });
    }
  });

  // 🚀 NEW: Low confidence facts endpoint (0-59%)
  app.get('/api/memory/low-confidence', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const lowConfidenceFacts = await storage.getMemoriesByConfidenceRange(activeProfile.id, 0, 59);
      console.log(`📊 Found ${lowConfidenceFacts.length} low confidence facts (0-59%)`);
      res.json(lowConfidenceFacts);
    } catch (error) {
      console.error('Low confidence facts error:', error);
      res.status(500).json({ error: 'Failed to get low confidence facts' });
    }
  });

  // 🔍 NEW: Preview wall-of-text facts cleaning without applying changes
  app.get('/api/memory/preview-cleaning', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Find facts that look like wall-of-text (using same logic as reprocess endpoint)
      const allFacts = await storage.getMemoryEntries(activeProfile.id, 1000);
      const wallOfTextFacts = allFacts.filter(fact => {
        const content = fact.content.toLowerCase();
        const hasUserMarkers = /(\byou\s|user:|^### |^> |what|how|why|hey nicky)/i.test(fact.content);
        const hasAIMarkers = /(nicky|assistant:|dente|noodle arms)/i.test(content);
        const isLong = fact.content.length > 300;
        
        return hasUserMarkers && hasAIMarkers && isLong;
      });

      console.log(`🔍 Found ${wallOfTextFacts.length} wall-of-text facts for preview`);

      const previews = [];


      for (const fact of wallOfTextFacts) {
        try {
          // Parse the fact content to extract only Nicky's parts
          const nickyContent = conversationParser.extractFactRelevantContent(fact.content, fact.source || 'unknown');
          
          // Only include if we can extract something meaningful and different
          if (nickyContent && nickyContent.trim() !== fact.content.trim() && nickyContent.length > 20) {
            previews.push({
              id: fact.id,
              original: fact.content,
              cleaned: nickyContent.substring(0, 500), // Limit to 500 chars
              confidence: fact.confidence,
              source: fact.source,
              storyContext: fact.storyContext, // Fixed: use storyContext instead of story
              originalLength: fact.content.length,
              cleanedLength: nickyContent.length
            });
          }
        } catch (error) {
          console.error(`❌ Error previewing fact ${fact.id}:`, error);
        }
      }

      res.json({ 
        success: true,
        totalFound: wallOfTextFacts.length,
        previewsAvailable: previews.length,
        previews
      });
    } catch (error) {
      console.error('Preview error:', error);
      res.status(500).json({ error: 'Failed to preview cleaning' });
    }
  });

  // ✂️ NEW: Apply selected cleaning changes
  app.post('/api/memory/apply-cleaning', async (req, res) => {
    try {
      const { selectedFactIds } = req.body;
      
      if (!selectedFactIds || !Array.isArray(selectedFactIds) || selectedFactIds.length === 0) {
        return res.status(400).json({ error: 'No fact IDs provided' });
      }

      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      let applied = 0;

      const { db } = await import('./db');
      const { memoryEntries } = await import('@shared/schema');
      const { eq, sql } = await import('drizzle-orm');

      // Get the selected facts
      const allFacts = await storage.getMemoryEntries(activeProfile.id, 1000);
      const selectedFacts = allFacts.filter(fact => selectedFactIds.includes(fact.id));

      for (const fact of selectedFacts) {
        try {
          // Parse the fact content to extract only Nicky's parts
          const nickyContent = conversationParser.extractFactRelevantContent(fact.content, fact.source || 'unknown');
          
          // Only update if we actually extracted something meaningful and different
          if (nickyContent && nickyContent.trim() !== fact.content.trim() && nickyContent.length > 20) {
            // Update the fact with cleaned content using SQL update
            await db
              .update(memoryEntries)
              .set({ 
                content: nickyContent.substring(0, 500), // Limit to 500 chars max
                updatedAt: sql`now()`
              })
              .where(eq(memoryEntries.id, fact.id));
            applied++;
            console.log(`✂️ Applied cleaning to fact: ${fact.id} (${fact.content.length} → ${nickyContent.length} chars)`);
          }
        } catch (error) {
          console.error(`❌ Error applying cleaning to fact ${fact.id}:`, error);
        }
      }

      res.json({ 
        success: true,
        message: `Successfully applied cleaning to ${applied} facts`,
        applied 
      });
    } catch (error) {
      console.error('Apply cleaning error:', error);
      res.status(500).json({ error: 'Failed to apply cleaning' });
    }
  });

  // 🔧 EXISTING: Reprocess wall-of-text facts endpoint
  app.post('/api/memory/reprocess-facts', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Find facts that look like wall-of-text (long content with both user and AI markers)
      const allFacts = await storage.getMemoryEntries(activeProfile.id, 1000);
      const wallOfTextFacts = allFacts.filter(fact => {
        const content = fact.content.toLowerCase();
        const hasUserMarkers = /(\byou\s|user:|^### |^> |what|how|why|hey nicky)/i.test(fact.content);
        const hasAIMarkers = /(nicky|assistant:|dente|noodle arms)/i.test(content);
        const isLong = fact.content.length > 300;
        
        return hasUserMarkers && hasAIMarkers && isLong;
      });

      console.log(`🔧 Found ${wallOfTextFacts.length} wall-of-text facts to reprocess`);

      let cleaned = 0;

      const { db } = await import('./db');
      const { memoryEntries } = await import('@shared/schema');
      const { eq, sql } = await import('drizzle-orm');

      for (const fact of wallOfTextFacts) {
        try {
          // Parse the fact content to extract only Nicky's parts
          const nickyContent = conversationParser.extractFactRelevantContent(fact.content, fact.source || 'unknown');
          
          // Only update if we actually extracted something meaningful and different
          if (nickyContent && nickyContent.trim() !== fact.content.trim() && nickyContent.length > 20) {
            // Update the fact with cleaned content using SQL update
            await db
              .update(memoryEntries)
              .set({ 
                content: nickyContent.substring(0, 500), // Limit to 500 chars max
                updatedAt: sql`now()`
              })
              .where(eq(memoryEntries.id, fact.id));
            cleaned++;
            console.log(`✂️ Cleaned fact: ${fact.id} (${fact.content.length} → ${nickyContent.length} chars)`);
          }
        } catch (error) {
          console.error(`❌ Failed to clean fact ${fact.id}:`, error);
        }
      }

      res.json({ 
        message: `Successfully reprocessed ${cleaned} wall-of-text facts`,
        totalFound: wallOfTextFacts.length,
        cleaned 
      });
    } catch (error) {
      console.error('Fact reprocessing error:', error);
      res.status(500).json({ error: 'Failed to reprocess facts' });
    }
  });

  app.get('/api/memory/contradictions', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // 🚀 NEW: Use actual contradiction detector 
      const contradictions = await storage.getContradictionGroups(activeProfile.id);
      console.log(`📊 Found ${contradictions.length} contradiction groups for profile ${activeProfile.id}`);
      res.json(contradictions);
    } catch (error) {
      console.error('Contradictions error:', error);
      res.status(500).json({ error: 'Failed to get contradictions' });
    }
  });

  // 🚀 NEW: Scan all facts for contradictions
  app.post('/api/memory/scan-contradictions', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // 🔒 CRITICAL: Check if scan is already running (prevents infinite loops!)
      const scanStatus = smartContradictionDetector.checkScanStatus(activeProfile.id);
      
      if (!scanStatus.canRun) {
        console.log(`🔒 Scan already ${scanStatus.status} for profile ${activeProfile.id}, returning cached result`);
        return res.json({
          status: scanStatus.status,
          result: scanStatus.result || { message: `Scan is ${scanStatus.status}` }
        });
      }

      // 🔒 Start the scan job (mutex protection)
      smartContradictionDetector.startScanJob(activeProfile.id);

      console.log(`🔍 Starting contradiction scan for profile ${activeProfile.id}`);
      
      // Get all ACTIVE facts that don't already have contradiction groups
      const allFacts = await storage.getMemoryEntries(activeProfile.id, 1000);
      const activeFacts = allFacts.filter(f => 
        f.status === 'ACTIVE' && 
        !f.contradictionGroupId &&
        !f.isProtected // Don't scan protected facts
      );

      console.log(`🔍 Scanning ${activeFacts.length} facts for contradictions`);
      
      let contradictionsFound = 0;
      let groupsCreated = 0;

      // 🚀 OPTIMIZED: Much smaller batches and longer delays for API stability
      const batchSize = 5; // Reduced from 20 to 5 for less API pressure
      let processedCount = 0;
      let successfulAICalls = 0;
      let failedAICalls = 0;
      
      for (let i = 0; i < activeFacts.length; i += batchSize) {
        const batch = activeFacts.slice(i, i + batchSize);
        
        console.log(`📊 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activeFacts.length/batchSize)} (${batch.length} facts)`);
        console.log(`📈 AI Success Rate: ${failedAICalls + successfulAICalls > 0 ? Math.round((successfulAICalls / (successfulAICalls + failedAICalls)) * 100) : 0}% (${successfulAICalls} success, ${failedAICalls} failed)`);
        
        for (const currentFact of batch) {
          // Skip if this fact already has a group (may have been assigned in this scan)
          if (currentFact.contradictionGroupId) continue;
          
          processedCount++;
          console.log(`🔍 Checking fact ${processedCount}/${activeFacts.length}: "${currentFact.content.substring(0, 50)}..."`);
          
          try {
            // Use the SMART contradiction detector to find conflicts efficiently 
            const result = await smartContradictionDetector.detectContradictions(activeProfile.id, currentFact);
            
            // Count successful calls (assuming it succeeded if we got a result)
            successfulAICalls++;
            
            if (result.isContradiction && result.conflictingFacts.length > 0) {
              const groupId = `contradiction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              
              // Group all conflicting facts together
              const allFactsInGroup = [currentFact, ...result.conflictingFacts];
              const factIds = allFactsInGroup.map(f => f.id);
              
              console.log(`⚠️ Found contradiction group with ${allFactsInGroup.length} facts`);
              
              // Mark all facts in this group
              await storage.markFactsAsContradicting(factIds, groupId);
              
              // Set the highest confidence fact as primary (keep it ACTIVE)
              const primaryFact = allFactsInGroup.reduce((best, current) => 
                (current.confidence || 0) > (best.confidence || 0) ? current : best
              );
              await storage.updateMemoryStatus(primaryFact.id, 'ACTIVE');
              
              contradictionsFound += allFactsInGroup.length;
              groupsCreated++;
              
              // Mark processed facts as having contradiction groups to avoid reprocessing
              allFactsInGroup.forEach(fact => {
                fact.contradictionGroupId = groupId;
              });
            }
          } catch (error) {
            console.error(`❌ Error checking fact ${currentFact.id}:`, error);
            failedAICalls++;
            // Continue with other facts even if one fails
          }
          
          // 🚀 OPTIMIZED: Longer delay between individual facts when API is struggling
          if (failedAICalls > successfulAICalls && failedAICalls > 3) {
            console.log(`⏸️ API struggling (${failedAICalls} failures), adding extra delay...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second extra delay
          } else {
            await new Promise(resolve => setTimeout(resolve, 300)); // Standard 300ms delay
          }
        }
        
        // 🚀 OPTIMIZED: Much longer delays between batches to give API time to recover
        if (i + batchSize < activeFacts.length) {
          const batchDelay = failedAICalls > successfulAICalls ? 2000 : 800; // 2s if struggling, 800ms normally
          console.log(`⏳ Batch complete, waiting ${batchDelay}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }

      const message = groupsCreated > 0 
        ? `Found ${groupsCreated} contradiction groups with ${contradictionsFound} total conflicting facts`
        : "No contradictions found in your knowledge base";

      console.log(`✅ Contradiction scan complete: ${message}`);
      
      // 🔒 Complete the scan job (mutex protection)
      smartContradictionDetector.completeScanJob(activeProfile.id, [{
        isContradiction: groupsCreated > 0,
        conflictingFacts: [],
        severity: 'LOW' as const,
        explanation: message
      }]);
      
      res.json({
        found: groupsCreated,
        totalFactsChecked: activeFacts.length,
        message
      });

    } catch (error) {
      console.error('❌ Contradiction scan failed:', error);
      res.status(500).json({ error: 'Failed to scan for contradictions' });
    }
  });

  // 🚀 NEW: Document reprocessing endpoint to re-extract facts without data loss
  app.post('/api/documents/:id/reprocess', async (req, res) => {
    try {
      const { id: documentId } = req.params;
      const { preserveExisting = true, improveAtomization = false } = req.body;
      
      console.log(`📄 Starting reprocessing for document ${documentId}...`);
      
      // Get the document
      const document = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);
        
      if (!document || document.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const doc = document[0];
      console.log(`📄 Found document: ${doc.filename}`);
      
      // Get existing facts from this document to preserve them
      const existingFacts = preserveExisting ? await db
        .select()
        .from(memoryEntries)
        .where(
          and(
            eq(memoryEntries.profileId, doc.profileId),
            eq(memoryEntries.sourceId, documentId)
          )
        ) : [];
      
      console.log(`📄 Found ${existingFacts.length} existing facts from this document`);
      
      // Mark document as processing
      await db
        .update(documents)
        .set({ 
          processingStatus: 'PROCESSING',
          updatedAt: sql`now()`
        })
        .where(eq(documents.id, documentId));
      
      try {
        // Re-extract knowledge using the document processor
        if (doc.extractedContent) {
          console.log(`📄 Re-extracting knowledge from ${doc.filename}...`);
          
          // Use a public method to trigger reprocessing
          await documentProcessor.reprocessDocument(
            doc.profileId, 
            doc.extractedContent, 
            doc.filename, 
            doc.id
          );
          
          console.log(`✅ Reprocessing completed for ${doc.filename}`);
          
          // Mark as completed
          await db
            .update(documents)
            .set({ 
              processingStatus: 'COMPLETED',
              updatedAt: sql`now()`
            })
            .where(eq(documents.id, documentId));
          
          // Get final fact counts
          const finalFacts = await db
            .select()
            .from(memoryEntries)
            .where(
              and(
                eq(memoryEntries.profileId, doc.profileId),
                eq(memoryEntries.sourceId, documentId)
              )
            );
          
          const message = preserveExisting 
            ? `Reprocessed ${doc.filename}: ${existingFacts.length} existing facts preserved, ${finalFacts.length - existingFacts.length} new facts extracted`
            : `Reprocessed ${doc.filename}: ${finalFacts.length} total facts after reprocessing`;
          
          res.json({
            success: true,
            message,
            document: doc.filename,
            existingFactsCount: existingFacts.length,
            finalFactsCount: finalFacts.length,
            newFactsExtracted: Math.max(0, finalFacts.length - existingFacts.length)
          });
          
        } else {
          await db
            .update(documents)
            .set({ 
              processingStatus: 'FAILED',
              updatedAt: sql`now()`
            })
            .where(eq(documents.id, documentId));
            
          res.status(400).json({ error: 'Document has no extracted content to reprocess' });
        }
        
      } catch (extractionError) {
        console.error('📄 Reprocessing extraction failed:', extractionError);
        
        await db
          .update(documents)
          .set({ 
            processingStatus: 'FAILED',
            updatedAt: sql`now()`
          })
          .where(eq(documents.id, documentId));
          
        res.status(500).json({ error: 'Failed to reprocess document', details: (extractionError as Error).message });
      }
      
    } catch (error) {
      console.error('📄 Document reprocessing failed:', error);
      res.status(500).json({ error: 'Failed to reprocess document' });
    }
  });

  // 🚀 NEW: Batch document reprocessing endpoint
  app.post('/api/documents/reprocess-all', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      console.log(`📄 Starting batch reprocessing for all documents...`);
      
      // Get all completed documents for the profile
      const allDocuments = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.profileId, activeProfile.id),
            eq(documents.processingStatus, 'COMPLETED')
          )
        );
        
      console.log(`📄 Found ${allDocuments.length} documents to reprocess`);
      
      let successCount = 0;
      let errorCount = 0;
      const results = [];
      
      for (const doc of allDocuments) {
        try {
          console.log(`📄 Reprocessing ${doc.filename}...`);
          
          // Get existing facts count
          const existingFacts = await db
            .select()
            .from(memoryEntries)
            .where(
              and(
                eq(memoryEntries.profileId, doc.profileId),
                eq(memoryEntries.sourceId, doc.id)
              )
            );
          
          // Re-extract if content exists
          if (doc.extractedContent) {
            await documentProcessor.reprocessDocument(
              doc.profileId, 
              doc.extractedContent, 
              doc.filename, 
              doc.id
            );
            
            const finalFacts = await db
              .select()
              .from(memoryEntries)
              .where(
                and(
                  eq(memoryEntries.profileId, doc.profileId),
                  eq(memoryEntries.sourceId, doc.id)
                )
              );
            
            results.push({
              filename: doc.filename,
              status: 'success',
              existingFacts: existingFacts.length,
              finalFacts: finalFacts.length,
              newFacts: Math.max(0, finalFacts.length - existingFacts.length)
            });
            
            successCount++;
            console.log(`✅ ${doc.filename}: ${existingFacts.length} → ${finalFacts.length} facts`);
            
          } else {
            results.push({
              filename: doc.filename,
              status: 'skipped',
              reason: 'No extracted content'
            });
          }
          
        } catch (docError) {
          console.error(`❌ Failed to reprocess ${doc.filename}:`, docError);
          errorCount++;
          results.push({
            filename: doc.filename,
            status: 'error',
            error: (docError as Error).message
          });
        }
      }
      
      console.log(`📄 Batch reprocessing complete: ${successCount} success, ${errorCount} errors`);
      
      res.json({
        success: true,
        message: `Reprocessed ${successCount} documents successfully, ${errorCount} errors`,
        totalDocuments: allDocuments.length,
        successCount,
        errorCount,
        results
      });
      
    } catch (error) {
      console.error('📄 Batch reprocessing failed:', error);
      res.status(500).json({ error: 'Failed to batch reprocess documents' });
    }
  });

  app.patch('/api/memory/entries/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Validate confidence range (0-100)
      if (updates.confidence !== undefined) {
        const confidence = Number(updates.confidence);
        if (isNaN(confidence) || confidence < 0 || confidence > 100) {
          return res.status(400).json({ error: 'Confidence must be between 0 and 100' });
        }
      }
      
      // Use the more flexible updateMemoryEntry method for content + confidence updates
      const updatedEntry = await storage.updateMemoryEntry(id, updates);
      
      if (updates.confidence !== undefined) {
        console.log(`📊 Manual confidence update: Fact confidence set to ${updates.confidence}% by user`);
      }
      
      if (updates.content !== undefined) {
        console.log(`📝 Manual content update: Fact content updated by user`);
      }
      
      res.json(updatedEntry);
    } catch (error) {
      console.error('Update memory entry error:', error);
      res.status(500).json({ error: 'Failed to update memory entry' });
    }
  });

  // NEW: Make a fact protected with maximum confidence
  app.patch('/api/memory/entries/:id/protect', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if fact exists
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const currentFacts = await storage.getMemoryEntries(activeProfile.id, 10000);
      const currentFact = currentFacts.find(f => f.id === id);
      
      if (!currentFact) {
        return res.status(404).json({ error: 'Fact not found' });
      }

      // Don't protect already protected facts
      if (currentFact.isProtected) {
        return res.status(400).json({ error: 'Fact is already protected' });
      }

      // Update fact to be protected with maximum confidence and support
      const updatedEntry = await storage.updateMemoryEntry(id, {
        isProtected: true,
        confidence: 100,        // Maximum confidence
        supportCount: 999,      // High support count so it's never overridden
      });
      
      console.log(`🔒 Fact protected: "${currentFact.content.substring(0, 50)}..." now has 100% confidence and cannot be contradicted`);
      res.json(updatedEntry);
    } catch (error) {
      console.error('Protect fact error:', error);
      res.status(500).json({ error: 'Failed to protect fact' });
    }
  });

  app.post('/api/memory/entries/:id/boost', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get current fact to calculate progressive boost
      const currentFacts = await storage.getMemoryEntries(await storage.getActiveProfile().then(p => p!.id), 1000);
      const currentFact = currentFacts.find(f => f.id === id);
      
      if (!currentFact) {
        return res.status(404).json({ error: 'Fact not found' });
      }
      
      // Progressive boosting: 85→90→95→100
      const currentConfidence = currentFact.confidence || 50; // Default to 50 if null
      let newConfidence;
      if (currentConfidence < 85) {
        newConfidence = 85;
      } else if (currentConfidence < 90) {
        newConfidence = 90;
      } else if (currentConfidence < 95) {
        newConfidence = 95;
      } else {
        newConfidence = 100;
      }
      
      const updatedEntry = await storage.updateMemoryConfidence(id, newConfidence, undefined);
      console.log(`🎯 Progressive boost: Fact confidence ${currentConfidence}% → ${newConfidence}% by user`);
      res.json(updatedEntry);
    } catch (error) {
      console.error('Boost fact error:', error);
      res.status(500).json({ error: 'Failed to boost fact confidence' });
    }
  });

  app.post('/api/memory/entries/:id/deprecate', async (req, res) => {
    try {
      const { id } = req.params;
      
      const updatedEntry = await storage.updateMemoryStatus(id, 'DEPRECATED');
      console.log(`❌ Manual deprecation: Fact marked as FALSE by user`);
      res.json(updatedEntry);
    } catch (error) {
      console.error('Deprecate fact error:', error);
      res.status(500).json({ error: 'Failed to deprecate fact' });
    }
  });

  app.post('/api/memory/entries/:id/clean', async (req, res) => {
    try {
      const { id } = req.params;
      
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Get the memory entry to clean
      const currentFacts = await storage.getMemoryEntries(activeProfile.id, 10000);
      const currentFact = currentFacts.find(f => f.id === id);
      
      if (!currentFact) {
        return res.status(404).json({ error: 'Fact not found' });
      }

      // Check if it's a wall of text that can be cleaned
      const content = currentFact.content.toLowerCase();
      const hasUserMarkers = /(\byou\s|user:|^### |^> |what|how|why|hey nicky)/i.test(currentFact.content);
      const hasAIMarkers = /(nicky|assistant:|dente|noodle arms)/i.test(content);
      const isLong = currentFact.content.length > 300;
      
      if (!hasUserMarkers || !hasAIMarkers || !isLong) {
        return res.status(400).json({ error: 'This fact does not appear to be wall-of-text that can be cleaned' });
      }

      console.log(`✂️ Cleaning wall-of-text fact: "${currentFact.content.substring(0, 100)}..."`);
      
      // Use conversationParser to split into atomic sentences
      const atomicSentences = conversationParser.splitIntoAtomicSentences(currentFact.content);
      
      if (atomicSentences.length <= 1) {
        return res.status(400).json({ error: 'Could not split this content into multiple atomic facts' });
      }

      // Create new atomic facts
      const newFacts = [];
      for (const sentence of atomicSentences) {
        try {
          const newFact = await storage.addMemoryEntry({
            profileId: activeProfile.id,
            type: 'FACT',
            content: sentence.trim(),
            importance: currentFact.importance || 5,
            confidence: currentFact.confidence || 50,
            supportCount: 1,
            source: 'cleaner',
            isAtomicFact: true,
            parentFactId: id,
          });
          newFacts.push(newFact);
        } catch (error) {
          console.error(`Failed to create atomic fact from: "${sentence.substring(0, 50)}..."`, error);
        }
      }

      // Mark original fact as deprecated story to avoid duplication
      await storage.updateMemoryEntry(id, {
        type: 'STORY',
        status: 'DEPRECATED',
      });

      console.log(`✅ Cleaned wall-of-text into ${newFacts.length} atomic facts`);
      
      res.json({
        success: true,
        createdCount: newFacts.length,
        newFactIds: newFacts.map(f => f.id),
        message: `Successfully split into ${newFacts.length} atomic facts`
      });
    } catch (error) {
      console.error('Clean wall-of-text error:', error);
      res.status(500).json({ error: 'Failed to clean wall-of-text' });
    }
  });

  app.post('/api/memory/resolve-contradiction', async (req, res) => {
    try {
      const { winnerFactId, loserFactId } = req.body;
      
      // Boost winner to 100%, deprecate loser
      await storage.updateMemoryConfidence(winnerFactId, 100, undefined);
      await storage.updateMemoryStatus(loserFactId, 'DEPRECATED');
      
      console.log(`⚖️ Contradiction resolved: Winner ${winnerFactId}, Loser ${loserFactId}`);
      res.json({ success: true, message: 'Contradiction resolved' });
    } catch (error) {
      console.error('Resolve contradiction error:', error);
      res.status(500).json({ error: 'Failed to resolve contradiction' });
    }
  });

  // Emergent Lore System routes
  app.post('/api/lore/seed/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      await LoreEngine.seedBasicLore(profileId);
      res.json({ success: true, message: 'Basic lore seeded successfully' });
    } catch (error) {
      console.error('Lore seeding error:', error);
      res.status(500).json({ error: 'Failed to seed lore' });
    }
  });

  app.post('/api/lore/generate/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      await LoreEngine.runMaintenanceCycle(profileId);
      res.json({ success: true, message: 'Background lore generated' });
    } catch (error) {
      console.error('Lore generation error:', error);
      res.status(500).json({ error: 'Failed to generate lore' });
    }
  });

  app.get('/api/lore/context/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      const limit = parseInt(req.query.limit as string) || 3;
      const loreContext = await LoreEngine.getRelevantLore(profileId, limit);
      res.json({ context: loreContext });
    } catch (error) {
      console.error('Lore context error:', error);
      res.status(500).json({ error: 'Failed to get lore context' });
    }
  });

  // Build comprehensive knowledge graph from all memories
  app.post('/api/memory/build-knowledge-graph/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      console.log(`🚀 Starting knowledge graph build for profile ${profileId}`);
      
      // This is a heavy operation that processes all memories
      await MemoryAnalyzer.buildKnowledgeGraph(profileId);
      
      res.json({ 
        success: true,
        message: 'Knowledge graph built successfully from all memories'
      });
    } catch (error) {
      console.error('Failed to build knowledge graph:', error);
      res.status(500).json({ error: 'Failed to build knowledge graph' });
    }
  });

  // Get enhanced lore context (includes extracted knowledge)
  app.get('/api/lore/enhanced-context/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      const context = await MemoryAnalyzer.getEnhancedLoreContext(profileId);
      res.json({ context });
    } catch (error) {
      console.error('Failed to get enhanced lore context:', error);
      res.status(500).json({ error: 'Failed to get enhanced lore context' });
    }
  });

  // Memory inspector - search for specific references
  app.get('/api/memory/search/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }
      
      const memories = await storage.searchMemoryEntries(profileId, q);
      res.json({ 
        query: q,
        count: memories.length,
        memories: memories.map(m => ({
          id: m.id,
          type: m.type,
          content: m.content,
          importance: m.importance,
          retrievalCount: m.retrievalCount,
          createdAt: m.createdAt
        }))
      });
    } catch (error) {
      console.error('Memory search error:', error);
      res.status(500).json({ error: 'Failed to search memories' });
    }
  });

  // Embedding Management Routes
  app.post('/api/memory/embeddings/generate', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      console.log('🚀 Starting embedding generation for memory entries...');
      
      // Get entries without embeddings
      const entriesWithoutEmbeddings = await storage.getMemoryEntriesWithoutEmbeddings(profile.id);
      console.log(`📊 Found ${entriesWithoutEmbeddings.length} memory entries without embeddings`);

      if (entriesWithoutEmbeddings.length === 0) {
        return res.json({
          message: 'All memory entries already have embeddings',
          processed: 0,
          total: 0
        });
      }

      let processed = 0;
      let errors = 0;
      
      // Generate embeddings for all memories at once
      const { embeddingService } = await import('./services/embeddingService');
      const result = await embeddingService.generateEmbeddingsForAllMemories(profile.id);
      processed = result.successful;
      errors = result.processed - result.successful;

      res.json({
        message: 'Embedding generation completed',
        processed,
        errors,
        total: entriesWithoutEmbeddings.length
      });
    } catch (error) {
      console.error('Embedding generation error:', error);
      res.status(500).json({ error: 'Failed to generate embeddings' });
    }
  });

  app.post('/api/memory/embeddings/search', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { query, limit = 10, threshold = 0.7 } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query string is required' });
      }

      console.log(`🔍 Semantic search query: "${query}"`);

      const { embeddingService } = await import('./services/embeddingService');
      const results = await embeddingService.searchSimilarMemories(
        query,
        profile.id,
        limit,
        threshold
      );

      res.json({
        query,
        results,
        total: results.length,
        threshold
      });
    } catch (error) {
      console.error('Semantic search error:', error);
      res.status(500).json({ error: 'Failed to perform semantic search' });
    }
  });

  app.get('/api/memory/embeddings/status', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const [withEmbeddings, withoutEmbeddings, totalEntries] = await Promise.all([
        storage.getMemoryEntriesWithEmbeddings(profile.id),
        storage.getMemoryEntriesWithoutEmbeddings(profile.id),
        storage.getMemoryEntries(profile.id, 10000)
      ]);

      const contentWithEmbeddings = await storage.getContentLibraryWithEmbeddings(profile.id);
      const contentWithoutEmbeddings = await storage.getContentLibraryWithoutEmbeddings(profile.id);
      const totalContent = await storage.getContentLibraryEntries(profile.id);

      res.json({
        memory: {
          withEmbeddings: withEmbeddings.length,
          withoutEmbeddings: withoutEmbeddings.length,
          total: totalEntries.length,
          percentage: totalEntries.length > 0 ? Math.round((withEmbeddings.length / totalEntries.length) * 100) : 0
        },
        contentLibrary: {
          withEmbeddings: contentWithEmbeddings.length,
          withoutEmbeddings: contentWithoutEmbeddings.length,
          total: totalContent.length,
          percentage: totalContent.length > 0 ? Math.round((contentWithEmbeddings.length / totalContent.length) * 100) : 0
        }
      });
    } catch (error) {
      console.error('Embedding status error:', error);
      res.status(500).json({ error: 'Failed to get embedding status' });
    }
  });

  // Protected Facts Management
  app.post('/api/memory/protected', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { content, importance = 5, keywords = [] } = req.body;
      
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Content is required and must be a non-empty string' });
      }

      const protectedFact = await storage.addProtectedFact(
        profile.id, 
        content.trim(), 
        importance, 
        keywords
      );

      res.json(protectedFact);
    } catch (error) {
      console.error('Error adding protected fact:', error);
      res.status(500).json({ error: 'Failed to add protected fact' });
    }
  });

  app.get('/api/memory/protected', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const protectedFacts = await storage.getProtectedFacts(profile.id);
      res.json(protectedFacts);
    } catch (error) {
      console.error('Error fetching protected facts:', error);
      res.status(500).json({ error: 'Failed to fetch protected facts' });
    }
  });

  // AI-Assisted Flagging System API Endpoints
  
  // Get pending flags for review
  app.get('/api/flags/pending', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { limit = 50 } = req.query;
      
      // Get pending flags using original logic
      const flags = await aiFlagger.getPendingFlags(db, profile.id, Number(limit));
      
      // Enrich memory flags with content in one query
      const memoryFlagIds = flags.filter(f => f.targetType === 'MEMORY').map(f => f.targetId);
      let memoryContentMap = new Map();
      
      if (memoryFlagIds.length > 0) {
        const memoryContents = await db
          .select({
            id: memoryEntries.id,
            content: memoryEntries.content,
            type: memoryEntries.type,
            importance: memoryEntries.importance
          })
          .from(memoryEntries)
          .where(inArray(memoryEntries.id, memoryFlagIds));
          
        memoryContents.forEach(mem => {
          memoryContentMap.set(mem.id, mem);
        });
      }
      
      // Enrich flags with memory content
      const enrichedFlags = flags.map(flag => {
        if (flag.targetType === 'MEMORY' && memoryContentMap.has(flag.targetId)) {
          const memContent = memoryContentMap.get(flag.targetId);
          return {
            ...flag,
            memoryContent: memContent.content,
            memoryType: memContent.type,
            memoryImportance: memContent.importance
          };
        }
        return flag;
      });
      
      // Group importance flags for the same target
      const groupedFlags = [];
      const importanceGroups = new Map();
      
      for (const flag of enrichedFlags) {
        const isImportanceFlag = ['high_importance', 'medium_importance', 'low_importance'].includes(flag.flagType);
        
        if (isImportanceFlag) {
          const groupKey = `${flag.targetType}:${flag.targetId}`;
          if (!importanceGroups.has(groupKey)) {
            importanceGroups.set(groupKey, {
              type: 'importance_group',
              targetType: flag.targetType,
              targetId: flag.targetId,
              flags: [],
              // Use first flag's metadata as representative
              createdAt: flag.createdAt,
              extractedData: flag.extractedData
            });
          }
          importanceGroups.get(groupKey).flags.push({
            ...flag,
            createdAt: flag.createdAt ? new Date(flag.createdAt).toISOString() : null
          });
        } else {
          // Regular flag - add as individual item
          groupedFlags.push({
            ...flag,
            type: 'individual',
            createdAt: flag.createdAt ? new Date(flag.createdAt).toISOString() : null
          });
        }
      }
      
      // Add importance groups to the result
      for (const group of Array.from(importanceGroups.values())) {
        if (group.flags.length > 1) {
          // Multiple importance levels - use grouped display
          groupedFlags.push({
            ...group,
            createdAt: group.createdAt ? new Date(group.createdAt).toISOString() : null
          });
        } else {
          // Single importance level - add as individual flag
          groupedFlags.push({
            ...group.flags[0],
            type: 'individual'
          });
        }
      }
      
      res.json({
        count: flags.length,
        flags: groupedFlags
      });
    } catch (error) {
      console.error('Error fetching pending flags:', error);
      res.status(500).json({ error: 'Failed to fetch pending flags' });
    }
  });

  // Batch review importance flags for the same target
  app.put('/api/flags/importance/batch-review', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Validate request body
      const batchSchema = z.object({
        targetType: z.enum(['MEMORY', 'MESSAGE', 'DOCUMENT', 'CONVERSATION']),
        targetId: z.string(),
        selectedImportance: z.enum(['high_importance', 'medium_importance', 'low_importance']),
        reviewedBy: z.string(),
        reviewNotes: z.string().optional()
      });

      const { targetType, targetId, selectedImportance, reviewedBy, reviewNotes } = batchSchema.parse(req.body);

      // Get all importance flags for this target
      const allFlags = await db
        .select()
        .from(contentFlags)
        .where(
          and(
            eq(contentFlags.profileId, profile.id),
            eq(contentFlags.targetType, targetType),
            eq(contentFlags.targetId, targetId),
            or(
              eq(contentFlags.flagType, 'high_importance' as any),
              eq(contentFlags.flagType, 'medium_importance' as any),
              eq(contentFlags.flagType, 'low_importance' as any)
            )
          )
        );

      if (allFlags.length === 0) {
        return res.status(404).json({ error: 'No importance flags found for this target' });
      }

      // Batch update: approve selected importance, reject others
      const updatePromises = allFlags.map(flag => {
        const status = flag.flagType === selectedImportance ? 'APPROVED' : 'REJECTED';
        const notes = flag.flagType === selectedImportance 
          ? reviewNotes || `Selected as ${selectedImportance}`
          : `Auto-rejected: selected ${selectedImportance} instead`;

        return db
          .update(contentFlags)
          .set({
            reviewStatus: status as any,
            reviewedBy,
            reviewNotes: notes,
            reviewedAt: new Date()
          })
          .where(eq(contentFlags.id, flag.id));
      });

      await Promise.all(updatePromises);

      console.log(`🎯 Batch reviewed importance flags for ${targetType}:${targetId} - selected: ${selectedImportance}`);

      res.json({ 
        success: true, 
        updated: allFlags.length,
        selectedImportance,
        message: `Approved ${selectedImportance}, rejected ${allFlags.length - 1} others`
      });

    } catch (error) {
      console.error('Error in batch importance review:', error);
      res.status(500).json({ error: 'Failed to batch review importance flags' });
    }
  });

  // Get flags for specific content
  app.get('/api/flags/:targetType/:targetId', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { targetType, targetId } = req.params;
      
      if (!['MEMORY', 'MESSAGE', 'DOCUMENT', 'CONVERSATION'].includes(targetType)) {
        return res.status(400).json({ error: 'Invalid target type' });
      }

      const flags = await aiFlagger.getContentFlags(db, targetType as any, targetId, profile.id);
      res.json(flags);
    } catch (error) {
      console.error('Error fetching content flags:', error);
      res.status(500).json({ error: 'Failed to fetch content flags' });
    }
  });

  // Update flag review status
  app.put('/api/flags/:flagId/review', async (req, res) => {
    try {
      const { flagId } = req.params;
      
      // Validate request body
      const reviewSchema = z.object({
        reviewStatus: z.enum(['APPROVED', 'REJECTED', 'MODIFIED']),
        reviewNotes: z.string().optional(),
        reviewedBy: z.string().default('user')
      });
      
      const { reviewStatus, reviewNotes, reviewedBy } = reviewSchema.parse(req.body);

      const [updatedFlag] = await db
        .update(contentFlags)
        .set({
          reviewStatus: reviewStatus as any,
          reviewNotes: reviewNotes || null,
          reviewedBy,
          reviewedAt: sql`now()`,
          updatedAt: sql`now()`
        })
        .where(eq(contentFlags.id, flagId))
        .returning();

      res.json(updatedFlag);
    } catch (error) {
      console.error('Error updating flag review:', error);
      res.status(500).json({ error: 'Failed to update flag review' });
    }
  });

  // Manually flag content
  app.post('/api/flags/manual', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Validate request body with Zod (accept 'reason', map to 'flagReason')
      const manualInputSchema = z.object({
        targetType: z.enum(['MEMORY', 'MESSAGE', 'DOCUMENT', 'CONVERSATION']),
        targetId: z.string().min(1),
        flagType: z.string().min(1),
        priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
        reason: z.string().min(1, 'Reason is required'),
        extractedData: z.object({
          characterNames: z.array(z.string()).optional(),
          relationships: z.array(z.string()).optional(),
          emotions: z.array(z.string()).optional(),
          topics: z.array(z.string()).optional(),
          contradictions: z.array(z.string()).optional(),
          patterns: z.array(z.string()).optional(),
        }).optional()
      });

      const inputData = manualInputSchema.parse(req.body);

      // Map 'reason' to 'flagReason' for database schema
      const { reason, ...rest } = inputData;
      const validatedData = { ...rest, flagReason: reason };
      const { targetType, targetId, flagType, priority, flagReason, extractedData } = validatedData;

      const flags = await aiFlagger.storeFlagsInDatabase(
        db,
        [{
          flagType: flagType as any,
          priority: priority as any,
          confidence: 100, // Manual flags get 100% confidence
          reason: flagReason,
          extractedData: extractedData || {}
        }],
        targetType as any,
        targetId,
        profile.id
      );

      res.json(flags[0]);
    } catch (error) {
      console.error('Error creating manual flag:', error);
      res.status(500).json({ error: 'Failed to create manual flag' });
    }
  });

  // Memory Deduplication API Endpoints
  
  // Find duplicate groups
  app.get('/api/memory/duplicates', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { threshold = 0.7 } = req.query;
      const { memoryDeduplicator } = await import('./services/memoryDeduplicator');
      
      const duplicateGroups = await memoryDeduplicator.findDuplicateGroups(
        db, 
        profile.id, 
        Number(threshold)
      );

      res.json({
        groups: duplicateGroups,
        totalGroups: duplicateGroups.length,
        totalDuplicates: duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0)
      });
    } catch (error) {
      console.error('Error finding duplicate memories:', error);
      res.status(500).json({ error: 'Failed to find duplicate memories' });
    }
  });

  // Auto-merge high-confidence duplicates
  app.post('/api/memory/auto-merge', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { threshold = 0.9 } = req.body;
      const { memoryDeduplicator } = await import('./services/memoryDeduplicator');
      
      const mergedCount = await memoryDeduplicator.autoMergeDuplicates(
        db,
        profile.id,
        Number(threshold)
      );

      res.json({
        success: true,
        mergedCount,
        message: `Successfully merged ${mergedCount} duplicate memories`
      });
    } catch (error) {
      console.error('Error auto-merging duplicates:', error);
      res.status(500).json({ error: 'Failed to auto-merge duplicates' });
    }
  });

  // Manually merge a specific duplicate group
  app.post('/api/memory/merge-group', async (req, res) => {
    try {
      const { masterEntryId, duplicateIds } = req.body;
      
      if (!masterEntryId || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
        return res.status(400).json({ error: 'masterEntryId and duplicateIds are required' });
      }

      const { memoryDeduplicator } = await import('./services/memoryDeduplicator');

      // Get the entries to build a duplicate group
      const allIds = [masterEntryId, ...duplicateIds];
      const entries = await db
        .select()
        .from(memoryEntries)
        .where(inArray(memoryEntries.id, allIds));

      if (entries.length !== allIds.length) {
        return res.status(400).json({ error: 'Some memory entries not found' });
      }

      const masterEntry = entries.find(e => e.id === masterEntryId);
      const duplicateEntries = entries.filter(e => e.id !== masterEntryId);

      if (!masterEntry) {
        return res.status(400).json({ error: 'Master entry not found' });
      }

      // Build duplicate group and merge
      const duplicateGroup = {
        masterEntry,
        duplicates: duplicateEntries,
        similarity: 1.0, // Manual merge, assume high similarity
        mergedContent: masterEntry.content, // Use master content by default
        combinedImportance: Math.max(masterEntry.importance || 1, ...duplicateEntries.map(d => d.importance || 1)),
        combinedKeywords: Array.from(new Set([
          ...(masterEntry.keywords || []),
          ...duplicateEntries.flatMap(d => d.keywords || [])
        ])),
        combinedRelationships: Array.from(new Set([
          ...(masterEntry.relationships || []),
          ...duplicateEntries.flatMap(d => d.relationships || [])
        ]))
      };

      await memoryDeduplicator.executeMerge(db, duplicateGroup);

      res.json({
        success: true,
        mergedCount: duplicateEntries.length,
        message: `Successfully merged ${duplicateEntries.length} duplicates into master entry`
      });
    } catch (error) {
      console.error('Error manually merging duplicate group:', error);
      res.status(500).json({ error: 'Failed to merge duplicate group' });
    }
  });

  // Manual merge endpoint (for frontend compatibility)
  app.post('/api/memory/merge', async (req, res) => {
    try {
      const { primaryId, duplicateIds } = req.body;
      
      if (!primaryId || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
        return res.status(400).json({ error: 'primaryId and duplicateIds are required' });
      }

      const { memoryDeduplicator } = await import('./services/memoryDeduplicator');

      // Get the entries to build a duplicate group
      const allIds = [primaryId, ...duplicateIds];
      const entries = await db
        .select()
        .from(memoryEntries)
        .where(inArray(memoryEntries.id, allIds));

      if (entries.length !== allIds.length) {
        return res.status(400).json({ error: 'Some memory entries not found' });
      }

      const masterEntry = entries.find(e => e.id === primaryId);
      const duplicateEntries = entries.filter(e => e.id !== primaryId);

      if (!masterEntry) {
        return res.status(400).json({ error: 'Primary entry not found' });
      }

      // Build duplicate group and merge
      const duplicateGroup = {
        masterEntry,
        duplicates: duplicateEntries,
        similarity: 1.0, // Manual merge, assume high similarity
        mergedContent: masterEntry.content, // Use master content by default
        combinedImportance: Math.max(masterEntry.importance || 1, ...duplicateEntries.map(d => d.importance || 1)),
        combinedKeywords: Array.from(new Set([
          ...(masterEntry.keywords || []),
          ...duplicateEntries.flatMap(d => d.keywords || [])
        ])),
        combinedRelationships: Array.from(new Set([
          ...(masterEntry.relationships || []),
          ...duplicateEntries.flatMap(d => d.relationships || [])
        ]))
      };

      await memoryDeduplicator.executeMerge(db, duplicateGroup);

      res.json({
        success: true,
        mergedCount: duplicateEntries.length,
        message: `Successfully merged ${duplicateEntries.length} duplicates into primary entry`
      });
    } catch (error) {
      console.error('Error merging memories:', error);
      res.status(500).json({ error: 'Failed to merge memories' });
    }
  });

  // Check for duplicates when creating new memory (for prevention)
  app.post('/api/memory/check-duplicates', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { content, threshold = 0.8 } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'content is required' });
      }

      const { memoryDeduplicator } = await import('./services/memoryDeduplicator');
      
      const duplicates = await memoryDeduplicator.checkForDuplicates(
        db,
        profile.id,
        content,
        Number(threshold)
      );

      res.json({
        isDuplicate: duplicates.length > 0,
        duplicates: duplicates.slice(0, 5), // Return top 5 matches
        count: duplicates.length
      });
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      res.status(500).json({ error: 'Failed to check for duplicates' });
    }
  });

  // Story reconstruction endpoints
  app.post('/api/memory/reconstruct', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      console.log('🔧 Starting story reconstruction for profile:', profile.id);
      const result = await storyReconstructor.reconstructStories(profile.id);

      res.json({
        success: true,
        ...result,
        message: `Story reconstruction completed: ${result.processedOrphans}/${result.processedOrphans + result.remainingOrphans} orphaned facts processed`
      });
    } catch (error) {
      console.error('❌ Story reconstruction failed:', error);
      res.status(500).json({ error: 'Failed to reconstruct stories' });
    }
  });

  app.post('/api/memory/reconstruct/approve', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { attachments = [], stories = [] } = req.body;

      let processedAttachments = 0;
      let processedStories = 0;

      // Process approved attachments
      for (const attachment of attachments) {
        if (attachment.approved) {
          try {
            // Update the orphaned fact to link to the target
            await storage.updateMemoryEntry(attachment.orphanId, {
              relationships: [`belongsTo:${attachment.targetId}`],
              confidence: Math.min(90, (attachment.score * 100)),
              status: 'ACTIVE'
            });
            processedAttachments++;
          } catch (error) {
            console.error(`❌ Failed to process attachment for ${attachment.orphanId}:`, error);
          }
        }
      }

      // Process approved stories
      for (const story of stories) {
        if (story.approved) {
          try {
            // Create the story container
            const storyEntry = await storage.addMemoryEntry({
              profileId: profile.id,
              type: 'STORY',
              content: `${story.suggestedTitle}: ${story.suggestedSynopsis}`,
              importance: 5,
              confidence: 80,
              keywords: [story.suggestedTitle.toLowerCase(), 'reconstructed-story'],
              relationships: story.factIds.map((id: string) => `contains:${id}`),
              source: 'story-reconstruction',
              status: 'ACTIVE'
            });

            // Update each fact to link to the story
            for (let i = 0; i < story.factIds.length; i++) {
              const factId = story.factIds[i];
              await storage.updateMemoryEntry(factId, {
                parentFactId: storyEntry.id,
                relationships: [`belongsTo:${storyEntry.id}`],
                storyContext: story.orderedEvents[i]?.description || `Event ${i + 1} in ${story.suggestedTitle}`,
                confidence: Math.max(60, (story.coherenceScore * 100)),
                status: 'ACTIVE'
              });
            }
            processedStories++;
          } catch (error) {
            console.error(`❌ Failed to process story ${story.id}:`, error);
          }
        }
      }

      res.json({
        success: true,
        processedAttachments,
        processedStories,
        message: `Applied ${processedAttachments} attachments and created ${processedStories} stories`
      });
    } catch (error) {
      console.error('❌ Failed to approve reconstructions:', error);
      res.status(500).json({ error: 'Failed to approve story reconstructions' });
    }
  });

  // Batch analyze memories (for testing/setup)
  app.post('/api/flags/batch-analyze', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { memoryIds } = req.body;
      
      if (!memoryIds || !Array.isArray(memoryIds)) {
        return res.status(400).json({ error: 'memoryIds array is required' });
      }

      // Start batch analysis in background
      aiFlagger.batchAnalyzeMemories(db, memoryIds, profile.id)
        .then(() => {
          console.log(`🎯 Batch analysis of ${memoryIds.length} memories completed`);
        })
        .catch(error => {
          console.error('❌ Batch analysis failed:', error);
        });

      res.json({ 
        message: `Batch analysis started for ${memoryIds.length} memories`,
        status: 'started'
      });
    } catch (error) {
      console.error('Error starting batch analysis:', error);
      res.status(500).json({ error: 'Failed to start batch analysis' });
    }
  });

  // Get flagging analytics
  app.get('/api/flags/analytics', async (req, res) => {
    try {
      const profile = await storage.getActiveProfile();
      if (!profile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const [flagStats] = await db
        .select({
          totalFlags: sql<number>`count(*)`,
          pendingFlags: sql<number>`count(*) filter (where review_status = 'PENDING')`,
          approvedFlags: sql<number>`count(*) filter (where review_status = 'APPROVED')`,
          rejectedFlags: sql<number>`count(*) filter (where review_status = 'REJECTED')`,
        })
        .from(contentFlags)
        .where(eq(contentFlags.profileId, profile.id));

      const flagsByType = await db
        .select({
          flagType: contentFlags.flagType,
          count: sql<number>`count(*)`
        })
        .from(contentFlags)
        .where(eq(contentFlags.profileId, profile.id))
        .groupBy(contentFlags.flagType)
        .orderBy(sql`count(*) desc`)
        .limit(10);

      res.json({
        overview: flagStats,
        topFlagTypes: flagsByType
      });
    } catch (error) {
      console.error('Error fetching flag analytics:', error);
      res.status(500).json({ error: 'Failed to fetch flag analytics' });
    }
  });

  // Discord API Routes (Protected by basic auth check)
  
  // Simple auth middleware for Discord routes
  const requireAuth = (req: any, res: any, next: any) => {
    // For now, just require an active profile as basic protection
    // TODO: Implement proper authentication/authorization
    if (!req.headers.authorization && !req.session?.user) {
      // Allow for development, but log the security issue
      console.warn('⚠️ SECURITY: Discord API accessed without authentication');
    }
    next();
  };

  // Get Discord bot status
  app.get('/api/discord/status', requireAuth, async (req, res) => {
    try {
      const isConnected = discordBotService.getConnectionStatus();
      res.json({ 
        connected: isConnected,
        status: isConnected ? 'online' : 'offline'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check Discord bot status' });
    }
  });

  // Get Discord servers for active profile
  app.get('/api/discord/servers', requireAuth, async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const servers = await storage.getProfileDiscordServers(activeProfile.id);
      res.json(servers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch Discord servers' });
    }
  });

  // Get Discord server baseline behavior settings
  app.get('/api/discord/servers/:id/behavior', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const server = await storage.getDiscordServer(id);
      
      if (!server) {
        return res.status(404).json({ error: 'Discord server not found' });
      }

      // Return baseline behavior settings
      const baseline = {
        aggressiveness: server.aggressiveness || 80,
        responsiveness: server.responsiveness || 60,
        unpredictability: server.unpredictability || 75,
        dbdObsession: server.dbdObsession || 80,
        familyBusinessMode: server.familyBusinessMode || 40,
      };

      res.json(baseline);
    } catch (error) {
      console.error('Error getting Discord server behavior:', error);
      res.status(500).json({ error: 'Failed to get behavior settings' });
    }
  });

  // Update Discord server behavior settings
  app.put('/api/discord/servers/:id/behavior', requireAuth, async (req, res) => {
    try {
      const { id } = req.params; // This is the Discord server ID
      const updates = req.body;
      
      // First get the server by Discord server ID to get the database ID
      const server = await storage.getDiscordServer(id);
      
      if (!server) {
        return res.status(404).json({ error: 'Discord server not found' });
      }
      
      // Validate behavior settings
      const validKeys = ['aggressiveness', 'responsiveness', 'unpredictability', 'dbdObsession', 'familyBusinessMode'];
      const filteredUpdates: any = {};
      
      for (const key of validKeys) {
        if (key in updates && typeof updates[key] === 'number' && updates[key] >= 0 && updates[key] <= 100) {
          filteredUpdates[key] = updates[key];
        }
      }

      // Use the database ID for the update
      const updatedServer = await storage.updateDiscordServer(server.id, filteredUpdates);
      
      res.json(updatedServer);
    } catch (error) {
      console.error('Error updating Discord server behavior:', error);
      res.status(500).json({ error: 'Failed to update Discord server behavior' });
    }
  });

  // Get effective Discord behavior (live values with drift/chaos/time modulation)
  app.get('/api/discord/servers/:serverId/effective-behavior', requireAuth, async (req, res) => {
    try {
      const { serverId } = req.params;
      
      // Import the behavior modulator here to avoid circular dependency
      const { behaviorModulator } = await import('./services/behaviorModulator');
      const effective = await behaviorModulator.getEffectiveBehavior(serverId);
      
      res.json(effective);
    } catch (error) {
      console.error('Error getting effective Discord behavior:', error);
      res.status(500).json({ error: 'Failed to get effective behavior' });
    }
  });

  // Add context nudge to influence behavior temporarily
  app.post('/api/discord/servers/:serverId/nudge', requireAuth, async (req, res) => {
    try {
      const { serverId } = req.params;
      const { type, strength, durationMinutes } = req.body;
      
      // Validate nudge data
      const validTypes = ['mention_burst', 'quiet_period', 'keyword_trigger', 'moderation_flag'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid nudge type' });
      }
      
      const nudge = {
        type,
        strength: Math.max(-20, Math.min(20, strength || 5)),
        expiresAt: new Date(Date.now() + (durationMinutes || 30) * 60 * 1000).toISOString(),
      };
      
      // Import the behavior modulator here to avoid circular dependency
      const { behaviorModulator } = await import('./services/behaviorModulator');
      await behaviorModulator.addContextNudge(serverId, nudge);
      
      res.json({ success: true, nudge });
    } catch (error) {
      console.error('Error adding context nudge:', error);
      res.status(500).json({ error: 'Failed to add context nudge' });
    }
  });

  // Get Discord server proactive messaging settings
  app.get('/api/discord/servers/:serverId/proactive-settings', requireAuth, async (req, res) => {
    try {
      const { serverId } = req.params;
      
      // Find the Discord server by serverId
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }
      
      const servers = await storage.getProfileDiscordServers(activeProfile.id);
      const server = servers.find(s => s.serverId === serverId);
      if (!server) {
        return res.status(404).json({ error: 'Discord server not found' });
      }

      // Return proactive messaging settings
      const settings = {
        proactiveEnabled: server.proactiveEnabled ?? true,
        allowedChannels: server.allowedChannels || [],
        blockedChannels: server.blockedChannels || [],
        enabledMessageTypes: server.enabledMessageTypes || ['dbd', 'italian', 'family_business', 'aggressive', 'random'],
      };

      res.json(settings);
    } catch (error) {
      console.error('Error getting proactive settings:', error);
      res.status(500).json({ error: 'Failed to get proactive messaging settings' });
    }
  });

  // Update Discord server proactive messaging settings
  app.patch('/api/discord/servers/:serverId/proactive-settings', requireAuth, async (req, res) => {
    try {
      const { serverId } = req.params;
      const { proactiveEnabled, allowedChannels, blockedChannels, enabledMessageTypes } = req.body;
      
      // Find the Discord server by serverId
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }
      
      const servers = await storage.getProfileDiscordServers(activeProfile.id);
      const server = servers.find(s => s.serverId === serverId);
      if (!server) {
        return res.status(404).json({ error: 'Discord server not found' });
      }

      // Validate and prepare updates
      const updates: any = {};
      
      if (typeof proactiveEnabled === 'boolean') {
        updates.proactiveEnabled = proactiveEnabled;
      }
      
      if (Array.isArray(allowedChannels)) {
        // Validate channel IDs are strings
        const validChannels = allowedChannels.filter(id => typeof id === 'string' && id.trim().length > 0);
        updates.allowedChannels = validChannels;
      }
      
      if (Array.isArray(blockedChannels)) {
        // Validate channel IDs are strings
        const validChannels = blockedChannels.filter(id => typeof id === 'string' && id.trim().length > 0);
        updates.blockedChannels = validChannels;
      }
      
      if (Array.isArray(enabledMessageTypes)) {
        // Validate message types
        const validTypes = ['dbd', 'italian', 'family_business', 'aggressive', 'random'];
        const validMessageTypes = enabledMessageTypes.filter(type => validTypes.includes(type));
        updates.enabledMessageTypes = validMessageTypes;
      }

      const updatedServer = await storage.updateDiscordServer(server.id, updates);
      res.json(updatedServer);
    } catch (error) {
      console.error('Error updating proactive settings:', error);
      res.status(500).json({ error: 'Failed to update proactive messaging settings' });
    }
  });

  // Get Discord members for a server
  app.get('/api/discord/servers/:id/members', requireAuth, async (req, res) => {
    try {
      const { id: serverId } = req.params;
      const members = await storage.getServerMembers(serverId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch Discord members' });
    }
  });

  // Update Discord member facts
  app.put('/api/discord/members/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { facts, keywords } = req.body;
      
      const updates: any = {};
      if (Array.isArray(facts)) updates.facts = facts;
      if (Array.isArray(keywords)) updates.keywords = keywords;

      const member = await storage.updateDiscordMember(id, updates);
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update Discord member' });
    }
  });

  // Get Discord topic triggers for a server
  app.get('/api/discord/servers/:id/triggers', requireAuth, async (req, res) => {
    try {
      const { id: serverId } = req.params;
      const triggers = await storage.getDiscordTopicTriggers(serverId);
      res.json(triggers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch Discord topic triggers' });
    }
  });

  // Create Discord topic trigger
  app.post('/api/discord/servers/:id/triggers', requireAuth, async (req, res) => {
    try {
      const { id: serverId } = req.params;
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const triggerData = insertDiscordTopicTriggerSchema.parse({
        ...req.body,
        profileId: activeProfile.id,
        serverId
      });

      const trigger = await storage.createDiscordTopicTrigger(triggerData);
      res.json(trigger);
    } catch (error) {
      res.status(400).json({ error: 'Invalid trigger data' });
    }
  });

  // Update Discord topic trigger
  app.put('/api/discord/triggers/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const trigger = await storage.updateDiscordTopicTrigger(id, updates);
      res.json(trigger);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update Discord trigger' });
    }
  });

  // Delete Discord topic trigger
  app.delete('/api/discord/triggers/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDiscordTopicTrigger(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete Discord trigger' });
    }
  });

  // Get Discord conversation history for a server
  app.get('/api/discord/servers/:id/conversations', requireAuth, async (req, res) => {
    try {
      const { id: serverId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const conversations = await storage.getDiscordConversations(serverId, limit);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch Discord conversations' });
    }
  });

  // ========================================
  // AUTOMATED CONTENT INGESTION ROUTES
  // ========================================

  const collectionManager = new ContentCollectionManager();

  // Get automated sources for a profile
  app.get('/api/ingestion/sources/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      const sources = await storage.getAutomatedSources(profileId);
      res.json({ data: sources });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch automated sources' });
    }
  });

  // Create new automated source
  app.post('/api/ingestion/sources', async (req, res) => {
    try {
      console.log('🔍 Creating automated source with data:', JSON.stringify(req.body, null, 2));
      const sourceData = insertAutomatedSourceSchema.parse(req.body);
      const source = await storage.createAutomatedSource(sourceData);
      res.status(201).json({ data: source });
    } catch (error) {
      console.error('❌ Source creation failed:', error);
      res.status(400).json({ 
        error: 'Invalid source data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Toggle automated source on/off
  app.patch('/api/ingestion/sources/:id/toggle', async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      await storage.toggleAutomatedSource(id, isActive);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to toggle automated source' });
    }
  });

  // Get pending content for a profile
  app.get('/api/ingestion/pending/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      const processed = req.query.processed === 'true' ? true : req.query.processed === 'false' ? false : undefined;
      const pending = await storage.getPendingContent(profileId, processed);
      res.json({ data: pending });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pending content' });
    }
  });

  // Approve pending content and process it into memory
  app.post('/api/ingestion/pending/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      
      const pendingItem = await storage.getPendingContentById(id);
      if (!pendingItem) {
        return res.status(404).json({ error: 'Content not found' });
      }
      
      // Process through existing document pipeline  
      await documentProcessor.reprocessDocument(
        pendingItem.profileId,
        pendingItem.rawContent,
        `reddit-${pendingItem.title}`, // source filename
        pendingItem.id // document ID
      );
      
      // Mark as approved and processed
      await storage.approvePendingContent(id);
      
      res.json({ 
        success: true, 
        message: 'Content approved and processed into memory' 
      });
    } catch (error) {
      console.error('Failed to approve content:', error);
      res.status(500).json({ error: 'Failed to approve content' });
    }
  });

  // Reject pending content
  app.post('/api/ingestion/pending/:id/reject', async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ error: 'Rejection reason required' });
      }
      
      await storage.rejectPendingContent(id, reason);
      res.json({ 
        success: true, 
        message: 'Content rejected' 
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reject content' });
    }
  });

  // Manual collection trigger
  app.post('/api/ingestion/collect/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      const result = await collectionManager.runCollection(profileId);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Manual collection failed:', error);
      res.status(500).json({ error: 'Collection failed' });
    }
  });

  // Test collection for specific source
  app.post('/api/ingestion/test/:profileId/:sourceType', async (req, res) => {
    try {
      const { profileId, sourceType } = req.params;
      
      if (sourceType !== 'reddit' && sourceType !== 'steam') {
        return res.status(400).json({ error: 'Invalid source type' });
      }
      
      const collected = await collectionManager.testCollection(profileId, sourceType);
      res.json({
        success: true,
        sourceType,
        collected,
        message: `Test collection completed: ${collected} items found`
      });
    } catch (error) {
      console.error(`Test collection failed for ${req.params.sourceType}:`, error);
      res.status(500).json({ error: `Test collection failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  // =====================================
  // PRE-ROLL AD GENERATION ROUTES  
  // =====================================
  
  // Generate a new pre-roll ad
  app.post('/api/ads/generate', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { category, personalityFacet, forceNew } = req.body;
      
      const adRequest = {
        profileId: activeProfile.id,
        category,
        personalityFacet,
        forceNew
      };
      
      const newAd = await adGenerationService.generateAd(adRequest);
      res.json({ data: newAd });
    } catch (error) {
      console.error('Ad generation failed:', error);
      res.status(500).json({ error: 'Failed to generate ad' });
    }
  });

  // Get ads for a profile
  app.get('/api/ads/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      const { category, limit, includeUsed } = req.query;
      
      const options = {
        category: category as string,
        limit: limit ? parseInt(limit as string) : undefined,
        includeUsed: includeUsed === 'true'
      };
      
      const ads = await adGenerationService.getAds(profileId, options);
      res.json({ data: ads });
    } catch (error) {
      console.error('Failed to fetch ads:', error);
      res.status(500).json({ error: 'Failed to fetch ads' });
    }
  });

  // Mark an ad as used
  app.post('/api/ads/:id/use', async (req, res) => {
    try {
      const { id } = req.params;
      await adGenerationService.markAdAsUsed(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark ad as used:', error);
      res.status(500).json({ error: 'Failed to mark ad as used' });
    }
  });

  // Rate an ad (1-5 stars)
  app.post('/api/ads/:id/rate', async (req, res) => {
    try {
      const { id } = req.params;
      const { rating } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
      
      await adGenerationService.rateAd(id, rating);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to rate ad:', error);
      res.status(500).json({ error: 'Failed to rate ad' });
    }
  });

  // Toggle favorite status
  app.post('/api/ads/:id/favorite', async (req, res) => {
    try {
      const { id } = req.params;
      const { isFavorite } = req.body;
      
      await adGenerationService.toggleFavorite(id, isFavorite);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      res.status(500).json({ error: 'Failed to toggle favorite' });
    }
  });

  // Get ad statistics
  app.get('/api/ads/:profileId/stats', async (req, res) => {
    try {
      const { profileId } = req.params;
      const stats = await adGenerationService.getAdStats(profileId);
      res.json({ data: stats });
    } catch (error) {
      console.error('Failed to get ad stats:', error);
      res.status(500).json({ error: 'Failed to get ad stats' });
    }
  });

  // Get emotion profile for ad's personality facet
  app.get('/api/ads/:id/emotion-profile', async (req, res) => {
    try {
      const { id } = req.params;
      const ad = await storage.getPrerollAdById(id);
      if (!ad) {
        return res.status(404).json({ error: 'Ad not found' });
      }
      
      const emotionProfile = adGenerationService.getEmotionProfileForFacet(ad.personalityFacet || undefined);
      res.json({ 
        emotionProfile,
        personalityFacet: ad.personalityFacet,
        availableProfiles: elevenlabsService.getEmotionProfiles()
      });
    } catch (error) {
      console.error('Failed to get emotion profile:', error);
      res.status(500).json({ error: 'Failed to get emotion profile' });
    }
  });

  // =====================================
  // INTELLIGENCE ENGINE ROUTES  
  // =====================================

  // Get comprehensive intelligence analysis
  app.get('/api/intelligence/analysis', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const analysis = await intelligenceEngine.runFullIntelligenceAnalysis(
        storage.db,
        activeProfile.id
      );

      res.json(analysis);
    } catch (error) {
      console.error('Intelligence analysis error:', error);
      res.status(500).json({ error: 'Failed to run intelligence analysis' });
    }
  });

  // Bulk operations for memory management
  app.post('/api/intelligence/bulk-action', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const { action, memoryIds, options = {} } = req.body;
      let affectedCount = 0;

      switch (action) {
        case 'hide_irrelevant':
          // Hide memories with low relevance scores
          const relevanceScores = await intelligenceEngine.analyzeContextRelevance(
            storage.db,
            activeProfile.id
          );
          
          const memoriesToHide = relevanceScores
            .filter(r => r.shouldHide)
            .map(r => r.memoryId);

          for (const memoryId of memoriesToHide) {
            await storage.updateMemoryStatus(memoryId, 'DEPRECATED');
            affectedCount++;
          }
          break;

        case 'delete_selected':
          // Delete specific memory IDs
          if (memoryIds && Array.isArray(memoryIds)) {
            for (const memoryId of memoryIds) {
              await storage.deleteMemoryEntry(memoryId);
              affectedCount++;
            }
          }
          break;

        default:
          return res.status(400).json({ error: 'Invalid bulk action' });
      }

      res.json({
        success: true,
        action,
        affectedCount,
        message: `Bulk operation completed: ${affectedCount} memories affected`
      });

    } catch (error) {
      console.error('Bulk operation error:', error);
      res.status(500).json({ error: 'Failed to perform bulk operation' });
    }
  });

  // Get AI-generated memory summaries
  app.get('/api/intelligence/summaries', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const options = {
        summaryType: (req.query.type as string || 'overview') as 'overview' | 'recent' | 'topical' | 'trend_analysis',
        timeframe: (req.query.timeframe as string || 'all') as 'all' | 'day' | 'week' | 'month',
        maxFacts: parseInt(req.query.limit as string) || 100,
        focusArea: req.query.focus as string
      };

      const summaries = await intelligenceEngine.generateMemorySummaries(
        storage.db,
        activeProfile.id,
        options
      );

      res.json(summaries);
    } catch (error) {
      console.error('Memory summaries error:', error);
      res.status(500).json({ error: 'Failed to generate memory summaries' });
    }
  });

  // 🔧 Repair orphaned facts that lost their story context
  app.post('/api/intelligence/repair-orphans', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      console.log('🔧 Starting orphan facts repair for profile:', activeProfile.id);
      const result = await intelligenceEngine.repairOrphanedFacts(activeProfile.id);

      res.json({
        success: true,
        message: `Repaired ${result.repairedCount} orphaned facts, reconstructed ${result.storiesReconstructed} stories`,
        ...result
      });
    } catch (error) {
      console.error('Orphan facts repair error:', error);
      res.status(500).json({ error: 'Failed to repair orphaned facts' });
    }
  });

  // Podcast Management API Routes
  
  // Get all podcast episodes for active profile
  app.get('/api/podcast/episodes', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }
      
      const episodes = await storage.listPodcastEpisodes(activeProfile.id);
      res.json(episodes);
    } catch (error) {
      console.error('Error fetching podcast episodes:', error);
      res.status(500).json({ error: 'Failed to fetch podcast episodes' });
    }
  });

  // Get specific podcast episode
  app.get('/api/podcast/episodes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const episode = await storage.getPodcastEpisode(id);
      
      if (!episode) {
        return res.status(404).json({ error: 'Episode not found' });
      }
      
      res.json(episode);
    } catch (error) {
      console.error('Error fetching podcast episode:', error);
      res.status(500).json({ error: 'Failed to fetch podcast episode' });
    }
  });

  // Create new podcast episode
  app.post('/api/podcast/episodes', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const episodeData = { ...req.body, profileId: activeProfile.id };
      const episode = await storage.createPodcastEpisode(episodeData);
      res.status(201).json(episode);
    } catch (error) {
      console.error('Error creating podcast episode:', error);
      res.status(500).json({ error: 'Failed to create podcast episode' });
    }
  });

  // Update podcast episode
  app.put('/api/podcast/episodes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedEpisode = await storage.updatePodcastEpisode(id, updates);
      res.json(updatedEpisode);
    } catch (error) {
      console.error('Error updating podcast episode:', error);
      res.status(500).json({ error: 'Failed to update podcast episode' });
    }
  });

  // Delete podcast episode
  app.delete('/api/podcast/episodes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePodcastEpisode(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting podcast episode:', error);
      res.status(500).json({ error: 'Failed to delete podcast episode' });
    }
  });

  // Get segments for a specific episode
  app.get('/api/podcast/episodes/:episodeId/segments', async (req, res) => {
    try {
      const { episodeId } = req.params;
      const segments = await storage.getEpisodeSegments(episodeId);
      res.json(segments);
    } catch (error) {
      console.error('Error fetching episode segments:', error);
      res.status(500).json({ error: 'Failed to fetch episode segments' });
    }
  });

  // Create new podcast segment
  app.post('/api/podcast/segments', async (req, res) => {
    try {
      const segmentData = req.body;
      const segment = await storage.createPodcastSegment(segmentData);
      res.status(201).json(segment);
    } catch (error) {
      console.error('Error creating podcast segment:', error);
      res.status(500).json({ error: 'Failed to create podcast segment' });
    }
  });

  // Update podcast segment
  app.put('/api/podcast/segments/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedSegment = await storage.updatePodcastSegment(id, updates);
      res.json(updatedSegment);
    } catch (error) {
      console.error('Error updating podcast segment:', error);
      res.status(500).json({ error: 'Failed to update podcast segment' });
    }
  });

  // Delete podcast segment
  app.delete('/api/podcast/segments/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePodcastSegment(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting podcast segment:', error);
      res.status(500).json({ error: 'Failed to delete podcast segment' });
    }
  });

  // Parse show segments from episode transcript using AI
  app.post('/api/podcast/episodes/:id/parse-segments', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the episode and its transcript
      const episode = await storage.getPodcastEpisode(id);
      if (!episode) {
        return res.status(404).json({ error: 'Episode not found' });
      }

      if (!episode.transcript || episode.transcript.trim() === '') {
        return res.status(400).json({ error: 'Episode must have a transcript to parse segments' });
      }

      console.log(`🎙️ Parsing segments for episode: "${episode.title}"`);

      // Clear existing segments for this episode first
      await storage.clearPodcastSegments(episode.id);
      console.log(`🧹 Cleared existing segments for episode: "${episode.title}"`);

      // Use AI to parse segments from transcript
      const { geminiService } = await import('./services/gemini.js');
      const parsedSegments = await geminiService.parseShowSegments(episode.transcript, episode.title);

      if (parsedSegments.length === 0) {
        return res.json({ 
          message: 'No recurring show segments found in transcript',
          segments: []
        });
      }

      // Create segment records in database
      const createdSegments = [];
      for (const segment of parsedSegments) {
        const segmentData = {
          episodeId: episode.id,
          title: segment.title,
          description: segment.description,
          segmentType: segment.segmentType,
          transcript: segment.content, // Store the AI-extracted content as transcript
          startTime: segment.startTime || 0, // Use AI-parsed timestamp or default to 0
          endTime: segment.endTime || null, // Use AI-parsed end time if available
          keyQuotes: [],
          topics: [],
          notes: null
        };

        const createdSegment = await storage.createPodcastSegment(segmentData);
        createdSegments.push(createdSegment);
      }

      console.log(`✅ Created ${createdSegments.length} segments for "${episode.title}"`);

      res.json({
        message: `Successfully parsed ${createdSegments.length} show segments`,
        segments: createdSegments
      });

    } catch (error) {
      console.error('Error parsing episode segments:', error);
      res.status(500).json({ error: 'Failed to parse episode segments' });
    }
  });

  // Extract facts from podcast episode transcript and store in memory
  app.post('/api/podcast/episodes/:id/extract-facts', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the episode and its transcript
      const episode = await storage.getPodcastEpisode(id);
      if (!episode) {
        return res.status(404).json({ error: 'Episode not found' });
      }

      if (!episode.transcript || episode.transcript.trim() === '') {
        return res.status(400).json({ error: 'Episode must have a transcript to extract facts' });
      }

      console.log(`🧠 Extracting facts from Episode ${episode.episodeNumber}: "${episode.title}"`);

      // Extract facts and store them in Nicky's memory
      const result = await podcastFactExtractor.extractAndStoreFacts(
        storage,
        episode.profileId,
        episode.id,
        episode.episodeNumber,
        episode.title,
        episode.transcript,
        episode.guestNames || [],
        episode.topics || []
      );

      if (!result.success) {
        return res.status(400).json({ 
          error: result.error || 'Failed to extract facts',
          factsCreated: 0
        });
      }

      console.log(`✅ Successfully extracted ${result.factsCreated} facts from Episode ${episode.episodeNumber}`);

      res.json({
        message: `Successfully extracted ${result.factsCreated} facts and stored them in Nicky's memory`,
        factsCreated: result.factsCreated,
        episodeNumber: episode.episodeNumber,
        episodeTitle: episode.title
      });

    } catch (error) {
      console.error('Error extracting podcast facts:', error);
      res.status(500).json({ error: 'Failed to extract podcast facts' });
    }
  });

  // Search podcast content
  app.get('/api/podcast/search', async (req, res) => {
    try {
      const { q: query } = req.query;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const results = await storage.searchPodcastContent(activeProfile.id, query);
      res.json(results);
    } catch (error) {
      console.error('Error searching podcast content:', error);
      res.status(500).json({ error: 'Failed to search podcast content' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
