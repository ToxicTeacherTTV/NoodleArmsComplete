import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProfileSchema, insertConversationSchema, insertMessageSchema, insertDocumentSchema, insertMemoryEntrySchema } from "@shared/schema";
import { anthropicService } from "./services/anthropic";
import { elevenlabsService } from "./services/elevenlabs";
import { documentProcessor } from "./services/documentProcessor";
import { geminiService } from "./services/gemini";
import ChaosEngine from "./services/chaosEngine.js";
import EvolutionaryAI from "./services/evolutionaryAI.js";
import { LoreEngine } from './services/loreEngine.js';
import { MemoryAnalyzer } from './services/memoryAnalyzer.js';
import multer from "multer";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
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
      const { message, conversationId } = req.body;
      
      if (!message || !conversationId) {
        return res.status(400).json({ error: 'Message and conversation ID required' });
      }

      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Get relevant memories for RAG
      const relevantMemories = await storage.searchMemoryEntries(activeProfile.id, message);
      const relevantDocs = await documentProcessor.searchDocuments(activeProfile.id, message);
      
      // Get lore context for emergent personality
      const loreContext = await LoreEngine.getRelevantLore(activeProfile.id);

      // Generate AI response with lore context
      const response = await anthropicService.generateResponse(
        message,
        activeProfile.coreIdentity,
        relevantMemories,
        relevantDocs,
        loreContext
      );

      // Store the AI response
      await storage.addMessage({
        conversationId,
        type: 'AI' as const,
        content: response.content,
        metadata: {
          processingTime: response.processingTime,
          retrieved_context: response.retrievedContext,
        },
      });

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

  // Speech synthesis route
  app.post('/api/speech/synthesize', async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const audioBuffer = await elevenlabsService.synthesizeSpeech(text);
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      res.send(audioBuffer);
    } catch (error) {
      console.error('Speech synthesis error:', error);
      res.status(500).json({ error: 'Failed to synthesize speech' });
    }
  });

  // Document upload and processing
  app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
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

  app.delete('/api/documents/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDocument(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  // Memory management routes
  app.get('/api/memory/entries', async (req, res) => {
    try {
      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      const entries = await storage.getMemoryEntries(activeProfile.id);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch memory entries' });
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
      const consolidatedMemories = await anthropicService.consolidateMemories(recentMessages);
      
      // Store the consolidated memories
      for (const memory of consolidatedMemories) {
        await storage.addMemoryEntry({
          profileId: activeProfile.id,
          type: memory.type,
          content: memory.content,
          importance: memory.importance,
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

      // Get all memory entries
      const allMemories = await storage.getMemoryEntries(activeProfile.id, 10000);
      const optimizedMemories = await geminiService.consolidateAndOptimizeMemories(allMemories);
      
      // Clear existing memories and replace with optimized ones
      await storage.clearProfileMemories(activeProfile.id);
      
      // Add optimized memories back
      for (const memory of optimizedMemories) {
        await storage.addMemoryEntry({
          profileId: activeProfile.id,
          type: memory.type,
          content: memory.content,
          importance: memory.importance,
          source: memory.source || 'optimization',
        });
      }

      res.json({ 
        message: `Knowledge base optimized: ${allMemories.length} → ${optimizedMemories.length} entries`,
        beforeCount: allMemories.length,
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
            // Re-extract knowledge using improved logic
            await documentProcessor.extractAndStoreKnowledge(
              activeProfile.id, 
              document.extractedContent, 
              document.filename
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
      const chaosState = chaosEngine.getCurrentState();
      res.json(chaosState);
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
      
      chaosEngine.triggerChaosEvent(eventType);
      const newState = chaosEngine.getCurrentState();
      res.json(newState);
    } catch (error) {
      res.status(500).json({ error: 'Failed to trigger chaos event' });
    }
  });

  // EVOLUTIONARY AI ROUTES - The Ultimate Brain Upgrade! 🧠
  app.post('/api/memory/evolutionary-optimization', async (req, res) => {
    try {
      const { profileId } = req.body;
      
      if (!profileId) {
        return res.status(400).json({ error: 'Profile ID required' });
      }

      // Get all memory entries for this profile
      const memories = await storage.getMemoryEntries(profileId);
      
      // Run the revolutionary optimization
      const result = await evolutionaryAI.evolutionaryOptimization(memories);
      
      // Store the optimized facts back (in a real system, you'd want to backup first)
      // For now, let's just return the results
      res.json({
        message: 'Evolutionary optimization complete!',
        ...result,
        summary: {
          originalFacts: memories.length,
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

  const httpServer = createServer(app);
  return httpServer;
}
