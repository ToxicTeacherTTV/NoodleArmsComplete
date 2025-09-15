import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProfileSchema, insertConversationSchema, insertMessageSchema, insertDocumentSchema, insertMemoryEntrySchema, loreCharacters, loreEvents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { anthropicService } from "./services/anthropic";
import { elevenlabsService } from "./services/elevenlabs";
import { documentProcessor } from "./services/documentProcessor";
import { geminiService } from "./services/gemini";
import ChaosEngine from "./services/chaosEngine.js";
import EvolutionaryAI from "./services/evolutionaryAI.js";
import { LoreEngine } from './services/loreEngine.js';
import { MemoryAnalyzer } from './services/memoryAnalyzer.js';
import { conversationParser } from './services/conversationParser.js';
import { contradictionDetector } from './services/contradictionDetector';
import multer from "multer";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";

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
      const { message, conversationId } = req.body;
      
      if (!message || !conversationId) {
        return res.status(400).json({ error: 'Message and conversation ID required' });
      }

      const activeProfile = await storage.getActiveProfile();
      if (!activeProfile) {
        return res.status(400).json({ error: 'No active profile found' });
      }

      // Get relevant memories for RAG - combine search-based and high-confidence retrieval
      const allSearchResults = await storage.searchMemoryEntries(activeProfile.id, message);
      const highConfidenceMemories = await storage.getReliableMemoriesForAI(activeProfile.id, 20);
      
      // Filter search results to only include high-confidence facts (≥60%)
      const searchBasedMemories = allSearchResults.filter(m => (m.confidence || 50) >= 60);
      
      // Combine and deduplicate memories, prioritizing search relevance
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
      
      // Get enhanced lore context (includes extracted knowledge from memories)
      const loreContext = await MemoryAnalyzer.getEnhancedLoreContext(activeProfile.id);

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

      const audioBuffer = await elevenlabsService.synthesizeSpeech(text, voiceSettings);
      
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
            // Use the contradiction detector to find conflicts
            const result = await contradictionDetector.detectContradictions(activeProfile.id, currentFact);
            
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

  const httpServer = createServer(app);
  return httpServer;
}
