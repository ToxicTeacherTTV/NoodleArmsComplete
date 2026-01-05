import tmi from 'tmi.js';
import { storage } from '../storage.js';
import { aiOrchestrator } from './aiOrchestrator.js';
import { prometheusMetrics } from './prometheusMetrics.js';
import ChaosEngine from './chaosEngine.js';
import { entityExtraction } from './entityExtraction.js';
import { varietyController } from './VarietyController.js';
import { documentProcessor } from './documentProcessor.js';
import { contextPrewarmer } from './contextPrewarmer.js';

export class TwitchBotService {
  private client: tmi.Client | null = null;
  private isConnected: boolean = false;
  private activeProfile: any = null;
  private channel: string = '';
  private username: string = '';
  private currentGame: string = 'Dead by Daylight'; // Default for Nicky
  private previousGame: string = 'Dead by Daylight';
  private lastGameUpdate: number = 0;
  private lastProactiveMessage: number = Date.now();
  private proactiveInterval: any = null;
  
  // Bots to ignore to prevent AI loops or spam
  private readonly BANNED_BOTS = [
    'nightbot', 
    'streamelements', 
    'streamlabs', 
    'moobot', 
    'wizebot',
    'fossabot'
  ];

  public async start(username: string, token: string, channel: string) {
    try {
      if (this.isConnected) {
        console.log('⚠️ Twitch bot already started, skipping duplicate startup');
        return;
      }

      this.username = username;
      this.channel = channel.startsWith('#') ? channel : `#${channel}`;
      this.activeProfile = await storage.getActiveProfile();
      
      if (!this.activeProfile) {
        throw new Error('No active profile found for Twitch bot');
      }

      this.client = new tmi.Client({
        options: { debug: true },
        connection: {
          reconnect: true,
          secure: true
        },
        identity: {
          username: username,
          password: `oauth:${token.replace('oauth:', '')}`
        },
        channels: [this.channel]
      });

      this.setupEventHandlers();
      await this.client.connect();
      this.isConnected = true;
      this.startProactiveLoop();
      console.log(`🚀 Twitch bot initialized for channel: ${this.channel} as ${username}`);
    } catch (error) {
      console.error('❌ Failed to start Twitch bot:', error);
      throw error;
    }
  }

  private setupEventHandlers() {
    if (!this.client) return;

    this.client.on('message', async (channel, tags, message, self) => {
      if (self) return; // Ignore self
      await this.handleMessage(tags, message);
    });

    this.client.on('connected', (address, port) => {
      console.log(`✅ Connected to Twitch IRC: ${address}:${port}`);
    });

    this.client.on('disconnected', (reason) => {
      console.warn(`⚠️ Disconnected from Twitch IRC: ${reason}`);
      this.isConnected = false;
    });

    this.client.on('error', (err) => {
      console.error('❌ Twitch IRC error:', err);
    });
  }

  private async handleMessage(tags: tmi.ChatUserstate, message: string) {
    const username = tags['display-name'] || tags.username || 'Viewer';
    const senderLower = (tags.username || '').toLowerCase();
    
    // 1. IGNORE BANNED BOTS
    if (this.BANNED_BOTS.includes(senderLower)) {
      return;
    }

    // 2. HANDLE COMMANDS (e.g., !sauce)
    if (message.startsWith('!sauce')) {
      try {
        const chaos = ChaosEngine.getInstance();
        const chaosState = await chaos.getCurrentState();
        const meter = chaosState.sauceMeter || 0;
        const status = meter > 80 ? "ABSOLUTELY LIVID" : meter > 50 ? "HEATED" : "CHILL (FOR NOW)";
        this.client?.say(this.channel, `[SAUCE METER: ${meter}/100] Nicky is currently ${status}. Watch your mouth.`);
        return;
      } catch (e) {
        console.error("Failed to fetch sauce for Twitch:", e);
      }
    }
    
    // 3. MENTION DETECTION
    const botUsername = this.username.toLowerCase();
    const isMentioned = message.toLowerCase().includes(botUsername) || 
                        message.toLowerCase().includes('nicky');
    
    // For Twitch, we only respond if mentioned to avoid spamming
    if (!isMentioned) return;

    console.log(`📩 [Twitch] ${username}: ${message}`);

    try {
      const conversationId = `twitch-${this.channel.toLowerCase()}`;
      const chaos = ChaosEngine.getInstance();

      // Update game info (cached)
      await this.updateCurrentGame();

      // 1. Get context in parallel
      const [relevantMemories, relevantDocs, loreContext, chaosState, entityDossiers, varietyData] = await Promise.all([
        storage.searchEnrichedMemoryEntries(this.activeProfile.id, message),
        documentProcessor.searchDocuments(this.activeProfile.id, message),
        contextPrewarmer.getLoreContext(this.activeProfile.id, storage),
        chaos.getCurrentState(),
        entityExtraction.getEntityDossiers(message, this.activeProfile.id, storage),
        varietyController.selectPersonaFacet(conversationId, message)
      ]);

      const { facet, variety } = varietyData;
      const varietyPrompt = varietyController.generateVarietyPrompt(facet, variety);

      // 2. Generate response
      const aiResponse = await aiOrchestrator.generateResponse(
        message,
        this.activeProfile.coreIdentity,
        relevantMemories,
        relevantDocs,
        loreContext,
        'STREAMING',
        conversationId,
        this.activeProfile.id,
        [], // webSearchResults
        varietyPrompt,
        [], // trainingExamples
        'gemini-3-flash-preview',
        entityDossiers,
        chaosState.sauceMeter || 0,
        this.currentGame
      );

      // 3. Send response
      if (aiResponse && aiResponse.content) {
        // Strip emotion tags for Twitch chat
        let cleanResponse = aiResponse.content.replace(/\[[^\]]*\]/g, '').trim();
        
        // Twitch message length limit is ~500 chars
        const MAX_LENGTH = 480;
        
        if (cleanResponse.length <= MAX_LENGTH) {
          this.client?.say(this.channel, `@${username} ${cleanResponse}`);
        } else {
          // Split into multiple messages if too long
          const parts = this.splitMessage(cleanResponse, MAX_LENGTH);
          for (let i = 0; i < parts.length; i++) {
            const prefix = i === 0 ? `@${username} ` : `(cont.) `;
            this.client?.say(this.channel, `${prefix}${parts[i]}`);
            // Small delay between messages to avoid rate limits and ensure order
            if (i < parts.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        
        // 4. Track metrics
        prometheusMetrics.llmCallsTotal.inc({ provider: 'google', model: 'gemini-3-flash-preview', type: 'twitch' });
        
        // 5. Save to conversation history
        try {
          // Ensure conversation exists
          let conversation = await storage.getConversation(conversationId);
          if (!conversation) {
            await storage.createConversation({
              id: conversationId,
              profileId: this.activeProfile.id,
              title: `Twitch Stream: ${this.channel}`,
              isArchived: false,
              contentType: 'STREAMING'
            });
          }

          await storage.addMessage({
            conversationId: conversationId,
            content: message,
            type: 'USER',
            metadata: {}
          });

          await storage.addMessage({
            conversationId: conversationId,
            content: aiResponse.content,
            type: 'AI',
            metadata: {}
          });
        } catch (storageError) {
          console.warn('⚠️ Failed to save Twitch message to history:', storageError);
        }
      }
    } catch (error) {
      console.error('❌ Error handling Twitch message:', error);
    }
  }

  public async stop() {
    if (this.proactiveInterval) {
      clearInterval(this.proactiveInterval);
      this.proactiveInterval = null;
    }
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('🛑 Twitch bot stopped');
    }
  }

  private startProactiveLoop() {
    // Check every 10 minutes for proactive opportunities
    this.proactiveInterval = setInterval(async () => {
      if (!this.isConnected || !this.client) return;

      const now = Date.now();
      const chaos = ChaosEngine.getInstance();
      const chaosState = await chaos.getCurrentState();
      const sauceMeter = chaosState.sauceMeter || 0;

      // 1. HIGH SAUCE ALERT (Proactive outburst)
      if (sauceMeter > 85 && now - this.lastProactiveMessage > 15 * 60 * 1000) {
        await this.sendProactiveMessage("I'm actually losing my mind right now. This stream is a disaster.");
        this.lastProactiveMessage = now;
        return;
      }

      // 2. PERIODIC NATURAL COMMENT (Every 25-40 mins)
      const randomInterval = (25 + Math.random() * 15) * 60 * 1000;
      if (now - this.lastProactiveMessage > randomInterval) {
        await this.sendProactiveMessage(`Just sitting here watching this ${this.currentGame} gameplay... could be better, could be worse. Mostly worse.`);
        this.lastProactiveMessage = now;
      }
    }, 10 * 60 * 1000);
  }

  private async sendProactiveMessage(context: string) {
    if (!this.client || !this.isConnected) return;

    try {
      const conversationId = `twitch-proactive-${Date.now()}`;
      const chaos = ChaosEngine.getInstance();
      const chaosState = await chaos.getCurrentState();
      
      // 1. Gather context first
      const contextObj = await aiOrchestrator.gatherAllContext(
        context,
        this.activeProfile.id,
        conversationId,
        null, // controls
        'STREAMING',
        this.currentGame
      );

      // 2. Generate a natural Nicky response based on the context
      const aiResponse = await aiOrchestrator.generateResponse(
        context,
        this.activeProfile.coreIdentity,
        contextObj,
        'STREAMING',
        conversationId,
        this.activeProfile.id,
        'gemini-3-flash-preview',
        chaosState.sauceMeter || 0,
        this.currentGame
      );

      if (aiResponse && aiResponse.content) {
        let cleanResponse = aiResponse.content.replace(/\[[^\]]*\]/g, '').trim();
        this.client.say(this.channel, cleanResponse);
        console.log(`📢 [Twitch Proactive] ${cleanResponse}`);
      }
    } catch (error) {
      console.error('❌ Failed to send proactive Twitch message:', error);
    }
  }

  private async updateCurrentGame() {
    const now = Date.now();
    // Update every 5 minutes
    if (now - this.lastGameUpdate < 5 * 60 * 1000) return;

    const clientId = process.env.TWITCH_CLIENT_ID;
    const token = process.env.TWITCH_OAUTH_TOKEN?.replace('oauth:', '');
    const channelName = this.channel.replace('#', '');

    if (!clientId || !token) {
      console.warn('⚠️ Missing Twitch Client ID or Token for game detection');
      return;
    }

    try {
      // 1. Get broadcaster ID
      const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${channelName}`, {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${token}`
        }
      });
      const userData = await userResponse.json();
      const broadcasterId = userData.data?.[0]?.id;

      if (broadcasterId) {
        // 2. Get channel info (current game)
        const channelResponse = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`, {
          headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`
          }
        });
        const channelData = await channelResponse.json();
        const gameName = channelData.data?.[0]?.game_name;

        if (gameName) {
          this.previousGame = this.currentGame;
          this.currentGame = gameName;
          this.lastGameUpdate = now;
          
          // Detect game change
          if (this.previousGame !== this.currentGame) {
            console.log(`🎮 [Twitch] Game changed from ${this.previousGame} to ${this.currentGame}`);
            await this.sendProactiveMessage(`I see we're playing ${this.currentGame} now. Great. Another game for me to suffer through.`);
          } else {
            console.log(`🎮 [Twitch] Current game confirmed: ${gameName}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch Twitch game info:', error);
    }
  }

  private splitMessage(text: string, maxLength: number): string[] {
    const parts: string[] = [];
    let current = text;

    while (current.length > maxLength) {
      // Find the last sentence end or space within the limit
      let splitIndex = -1;
      const punctuation = ['. ', '! ', '? '];
      
      for (const p of punctuation) {
        const idx = current.lastIndexOf(p, maxLength);
        if (idx > splitIndex) splitIndex = idx + 1;
      }

      if (splitIndex === -1) {
        splitIndex = current.lastIndexOf(' ', maxLength);
      }

      if (splitIndex === -1) {
        splitIndex = maxLength;
      }

      parts.push(current.substring(0, splitIndex).trim());
      current = current.substring(splitIndex).trim();
    }

    if (current.length > 0) {
      parts.push(current);
    }

    return parts;
  }
}

export const twitchBotService = new TwitchBotService();
