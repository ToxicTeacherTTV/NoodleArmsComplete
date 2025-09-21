import { Client, GatewayIntentBits, Message, Events, TextChannel } from 'discord.js';
import { storage } from '../storage';
import { anthropicService } from './anthropic';
import type { DiscordServer, DiscordMember, DiscordTopicTrigger } from '@shared/schema';

export class DiscordBotService {
  private client: Client;
  private isConnected: boolean = false;
  private activeProfile: any = null;
  private recentResponses?: Set<string>;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.once(Events.ClientReady, (readyClient) => {
      console.log(`🤖 Discord bot ready! Logged in as ${readyClient.user.tag}`);
      this.isConnected = true;
      
      // Start proactive messaging system
      this.initializeProactiveMessaging();
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      await this.handleMessage(message);
    });

    this.client.on(Events.Error, (error) => {
      console.error('🚨 Discord client error:', error);
    });
  }

  public async start(token: string) {
    try {
      // Get active profile
      this.activeProfile = await storage.getActiveProfile();
      if (!this.activeProfile) {
        throw new Error('No active profile found for Discord bot');
      }

      console.log(`🚀 Starting Discord bot with profile: ${this.activeProfile.name}`);
      await this.client.login(token);
    } catch (error) {
      console.error('❌ Failed to start Discord bot:', error);
      throw error;
    }
  }

  public async stop() {
    if (this.client) {
      await this.client.destroy();
      this.isConnected = false;
      console.log('🛑 Discord bot stopped');
    }
  }

  private async handleMessage(message: Message) {
    // Ignore bot messages to prevent loops
    if (message.author.bot) return;
    
    // Ignore DMs for now - only respond in servers
    if (!message.guild) return;

    try {
      // Get or create server record with proper error handling
      let discordServer = await storage.getDiscordServer(message.guild.id);
      if (!discordServer) {
        console.log(`🆕 Creating new server record for: ${message.guild.name} (${message.guild.id})`);
        discordServer = await this.createServerRecord(message.guild.id, message.guild.name);
      }
      
      // CRITICAL FIX: Validate server config has all required fields
      if (!discordServer.proactiveEnabled && discordServer.proactiveEnabled !== false) {
        console.warn(`⚠️ Server ${discordServer.serverId} missing proactiveEnabled field, defaulting to true`);
        discordServer.proactiveEnabled = true;
      }
      if (!discordServer.allowedChannels) {
        console.warn(`⚠️ Server ${discordServer.serverId} missing allowedChannels field, defaulting to empty array`);
        discordServer.allowedChannels = [];
      }
      if (!discordServer.blockedChannels) {
        console.warn(`⚠️ Server ${discordServer.serverId} missing blockedChannels field, defaulting to empty array`);
        discordServer.blockedChannels = [];
      }
      if (!discordServer.enabledMessageTypes) {
        console.warn(`⚠️ Server ${discordServer.serverId} missing enabledMessageTypes field, defaulting to all types`);
        discordServer.enabledMessageTypes = ['dbd', 'italian', 'family_business', 'aggressive', 'random'];
      }

      // Get or create member record
      let discordMember = await storage.getDiscordMember(discordServer.id, message.author.id);
      if (!discordMember) {
        discordMember = await this.createMemberRecord(
          discordServer.id, 
          message.author.id, 
          message.author.username,
          message.member?.nickname || undefined
        );
      }

      // Update member last interaction
      await storage.updateDiscordMember(discordMember.id, {
        lastInteraction: new Date(),
        interactionCount: (discordMember.interactionCount || 0) + 1,
      });

      // Determine if Nicky should respond
      const shouldRespond = await this.shouldRespondToMessage(message, discordServer);
      
      if (shouldRespond.respond) {
        console.log(`💬 Responding to message from ${message.author.username}: "${message.content}"`);
        
        // Show typing indicator
        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }
        
        // Generate response using existing AI pipeline
        const response = await this.generateResponse(
          message, 
          discordServer, 
          discordMember, 
          shouldRespond
        );
        
        if (response && response.trim()) {
          // Ensure only one response per message - add deduplication
          const messageKey = `${message.id}-${message.author.id}`;
          if (this.recentResponses?.has(messageKey)) {
            console.log(`🚫 Duplicate response prevented for message ${message.id}`);
            return;
          }
          
          // Track this response to prevent duplicates
          if (!this.recentResponses) this.recentResponses = new Set();
          this.recentResponses.add(messageKey);
          setTimeout(() => this.recentResponses?.delete(messageKey), 5000); // Clean up after 5 seconds
          
          // Send response to Discord
          await message.reply(response);
          
          // Log the conversation
          await storage.logDiscordConversation({
            profileId: this.activeProfile.id,
            serverId: discordServer.id,
            channelId: message.channel.id,
            channelName: 'name' in message.channel ? (message.channel.name || 'Unknown') : 'DM',
            messageId: message.id,
            triggerMessage: message.content,
            nickyResponse: response,
            triggerType: shouldRespond.triggerType,
            triggerData: shouldRespond.triggerData,
            userId: message.author.id,
            username: message.author.username,
            processingTime: shouldRespond.processingTime,
          });
        }
      }
    } catch (error) {
      console.error('❌ Error handling Discord message:', error);
      // Don't reply with error messages to avoid spam
    }
  }

  /**
   * Helper function to check if bot should message in this channel
   * based on server's allowedChannels and blockedChannels settings
   */
  private shouldMessageChannel(serverConfig: DiscordServer, channelId: string): boolean {
    // If proactive messaging is disabled, don't send proactive messages
    // Note: Mentions and direct interactions should still work
    if (!serverConfig.proactiveEnabled) {
      return false;
    }

    // Parse allowedChannels and blockedChannels from JSON
    let allowedChannels: string[] = [];
    let blockedChannels: string[] = [];

    try {
      allowedChannels = Array.isArray(serverConfig.allowedChannels) 
        ? serverConfig.allowedChannels 
        : JSON.parse(serverConfig.allowedChannels as string || '[]');
      blockedChannels = Array.isArray(serverConfig.blockedChannels) 
        ? serverConfig.blockedChannels 
        : JSON.parse(serverConfig.blockedChannels as string || '[]');
    } catch (error) {
      console.error('Error parsing channel arrays:', error);
      allowedChannels = [];
      blockedChannels = [];
    }

    // If channel is explicitly blocked, don't message
    if (blockedChannels.includes(channelId)) {
      console.log(`🚫 Channel ${channelId} is blocked for server ${serverConfig.serverId}`);
      return false;
    }

    // If allowedChannels is set and non-empty, only message in allowed channels
    if (allowedChannels.length > 0 && !allowedChannels.includes(channelId)) {
      console.log(`⚠️ Channel ${channelId} not in allowed list for server ${serverConfig.serverId}`);
      return false;
    }

    // Channel is allowed
    return true;
  }

  private async shouldRespondToMessage(
    message: Message, 
    server: DiscordServer
  ): Promise<{
    respond: boolean;
    triggerType: 'MENTION' | 'TOPIC_TRIGGER' | 'RANDOM' | 'KEYWORD';
    triggerData?: any;
    processingTime?: number;
  }> {
    const startTime = Date.now();
    
    // CRITICAL FIX: Check channel restrictions FIRST before any response logic
    // For mentions, we allow responses regardless of channel restrictions (direct interaction)
    const isMention = message.mentions.has(this.client.user!);
    
    // For non-mention responses, check channel restrictions  
    if (!isMention && !this.shouldMessageChannel(server, message.channel.id)) {
      console.log(`🚫 Channel ${message.channel.id} blocked - skipping response`);
      return { respond: false, triggerType: 'KEYWORD' };
    }
    
    // Always respond when mentioned (but still respect message type filters in generateResponse)
    if (isMention) {
      return {
        respond: true,
        triggerType: 'MENTION',
        processingTime: Date.now() - startTime,
      };
    }

    // Check topic triggers
    const topicTriggers = await storage.getDiscordTopicTriggers(server.id);
    const messageContent = message.content.toLowerCase();
    
    for (const trigger of topicTriggers) {
      const triggerWords = [trigger.topic.toLowerCase(), ...(trigger.keywords || [])];
      
      for (const word of triggerWords) {
        if (messageContent.includes(word.toLowerCase())) {
          // Use response chance to determine if we should actually respond
          const randomChance = Math.random() * 100;
          if (randomChance <= (trigger.responseChance || 75)) {
            // Update trigger statistics
            await storage.updateDiscordTopicTrigger(trigger.id, {
              triggerCount: (trigger.triggerCount || 0) + 1,
              lastTriggered: new Date(),
            });
            
            return {
              respond: true,
              triggerType: 'TOPIC_TRIGGER',
              triggerData: {
                topics: [trigger.topic],
                keywords: triggerWords,
                responseChance: trigger.responseChance,
                behaviorSettings: {
                  aggressiveness: server.aggressiveness || 80,
                  responsiveness: server.responsiveness || 60,
                  italianIntensity: server.italianIntensity || 100,
                },
              },
              processingTime: Date.now() - startTime,
            };
          }
        }
      }
    }

    // Check for conversation continuation - respond if someone just replied to Nicky
    const recentConversations = await storage.getDiscordConversations(server.id, 5);
    const lastNickyMessage = recentConversations.find(conv => conv.nickyResponse);
    
    if (lastNickyMessage && lastNickyMessage.createdAt) {
      const timeSinceLastResponse = Date.now() - new Date(lastNickyMessage.createdAt).getTime();
      const isFromSameUser = message.author.id === lastNickyMessage.userId;
      const isRecentConversation = timeSinceLastResponse < 300000; // 5 minutes
      
      // If same user replied to Nicky within 5 minutes, continue the conversation
      if (isFromSameUser && isRecentConversation) {
        console.log(`💬 Conversation continuation detected from ${message.author.username}`);
        return {
          respond: true,
          triggerType: 'TOPIC_TRIGGER',
          triggerData: {
            conversationContinuation: true,
            lastMessage: lastNickyMessage.nickyResponse,
            behaviorSettings: {
              aggressiveness: server.aggressiveness || 80,
              responsiveness: server.responsiveness || 60,
              italianIntensity: server.italianIntensity || 100,
            },
          },
          processingTime: Date.now() - startTime,
        };
      }
    }

    // Random response based on effective server responsiveness setting (dynamic)
    try {
      const { behaviorModulator } = await import('./behaviorModulator');
      const effectiveBehavior = await behaviorModulator.getEffectiveBehavior(server.serverId);
      
      const randomChance = Math.random() * 100;
      // Higher base response rate - aim for ~70% at max responsiveness (100)
      const responseRate = Math.min(70, effectiveBehavior.responsiveness * 0.7);
      if (randomChance <= responseRate) {
        return {
          respond: true,
          triggerType: 'RANDOM',
          triggerData: {
            behaviorSettings: {
              aggressiveness: effectiveBehavior.aggressiveness,
              responsiveness: effectiveBehavior.responsiveness,
              italianIntensity: effectiveBehavior.italianIntensity,
            },
          },
          processingTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.error('Error getting effective behavior for random response:', error);
      // Fallback to baseline values
      const randomChance = Math.random() * 100;
      const fallbackResponseRate = Math.min(70, (server.responsiveness || 60) * 0.7);
      if (randomChance <= fallbackResponseRate) {
        return {
          respond: true,
          triggerType: 'RANDOM',
          triggerData: {
            behaviorSettings: {
              aggressiveness: server.aggressiveness || 80,
              responsiveness: server.responsiveness || 60,
              italianIntensity: server.italianIntensity || 100,
            },
          },
          processingTime: Date.now() - startTime,
        };
      }
    }

    return { respond: false, triggerType: 'KEYWORD' };
  }

  /**
   * Classify message content type based on content and trigger context
   */
  private classifyMessageType(responseContext: any, effectiveBehavior: any): string[] {
    const messageTypes: string[] = [];
    
    // Classify based on trigger type and context
    if (responseContext.triggerType === 'MENTION') {
      messageTypes.push('random'); // Mentions get random type by default
    }
    
    if (responseContext.triggerData?.topics) {
      const topics = responseContext.triggerData.topics;
      // Check for specific topic types
      if (topics.some((t: string) => t.toLowerCase().includes('dbd') || t.toLowerCase().includes('dead by daylight'))) {
        messageTypes.push('dbd');
      }
      if (topics.some((t: string) => t.toLowerCase().includes('italian') || t.toLowerCase().includes('family'))) {
        messageTypes.push('italian', 'family_business');
      }
    }
    
    // Classify based on effective behavior thresholds
    if (effectiveBehavior.aggressiveness > 70) {
      messageTypes.push('aggressive');
    }
    if (effectiveBehavior.italianIntensity > 80) {
      messageTypes.push('italian');
    }
    if (effectiveBehavior.dbdObsession > 70) {
      messageTypes.push('dbd');
    }
    if (effectiveBehavior.familyBusinessMode > 60) {
      messageTypes.push('family_business');
    }
    
    // Always include random as fallback
    if (messageTypes.length === 0) {
      messageTypes.push('random');
    }
    
    return Array.from(new Set(messageTypes)); // Remove duplicates
  }

  /**
   * Check if any of the message types are enabled for this server
   */
  private isMessageTypeEnabled(server: DiscordServer, messageTypes: string[]): boolean {
    let enabledMessageTypes: string[] = [];
    
    try {
      enabledMessageTypes = Array.isArray(server.enabledMessageTypes) 
        ? server.enabledMessageTypes 
        : JSON.parse(server.enabledMessageTypes as string || '["dbd", "italian", "family_business", "aggressive", "random"]');
    } catch (error) {
      console.error('Error parsing enabledMessageTypes:', error);
      enabledMessageTypes = ['dbd', 'italian', 'family_business', 'aggressive', 'random']; // Default fallback
    }
    
    // Check if any of the message types are enabled
    const hasEnabledType = messageTypes.some(type => enabledMessageTypes.includes(type));
    
    if (!hasEnabledType) {
      console.log(`🚫 Message types [${messageTypes.join(', ')}] not enabled for server ${server.serverId}. Enabled: [${enabledMessageTypes.join(', ')}]`);
    }
    
    return hasEnabledType;
  }

  private async generateResponse(
    message: Message,
    server: DiscordServer,
    member: DiscordMember,
    responseContext: any
  ): Promise<string | null> {
    console.log(`🚀 Discord generateResponse called for user: ${member.username}`);
    try {
      // Get effective behavior values (baseline + drift + chaos + time)
      const { behaviorModulator } = await import('./behaviorModulator');
      const effectiveBehavior = await behaviorModulator.getEffectiveBehavior(server.serverId);
      
      // CRITICAL FIX: Check message type restrictions BEFORE generating response
      const messageTypes = this.classifyMessageType(responseContext, effectiveBehavior);
      if (!this.isMessageTypeEnabled(server, messageTypes)) {
        console.log(`🚫 Response blocked: Message types [${messageTypes.join(', ')}] not enabled for server ${server.serverId}`);
        return null; // Don't generate response if message type is disabled
      }
      
      console.log(`✅ Message types [${messageTypes.join(', ')}] enabled for server ${server.serverId}`);
      
      // Add enabled message types to context for AI
      const enabledTypesContext = `Enabled message types for this server: [${messageTypes.join(', ')}]`;
      
      let personalityAdjustments = `${enabledTypesContext}\n`;
      
      // Filter personality adjustments based on enabled message types
      if (messageTypes.includes('aggressive') && effectiveBehavior.aggressiveness > 70) {
        personalityAdjustments += 'Be more aggressive and confrontational. ';
      }
      if (messageTypes.includes('italian') && effectiveBehavior.italianIntensity > 80) {
        personalityAdjustments += 'Use more Italian expressions and dramatic gestures. ';
      }
      if (messageTypes.includes('dbd') && effectiveBehavior.dbdObsession > 70) {
        personalityAdjustments += 'Relate topics back to Dead by Daylight when possible. ';
      }
      if (messageTypes.includes('family_business') && effectiveBehavior.familyBusinessMode > 60) {
        personalityAdjustments += 'Reference family business and mafia terminology more often. ';
      }
      
      // Build context for Nicky's response
      const contextParts = [];
      
      // Add effective server behavior settings (live values)
      contextParts.push(`Discord Server Behavior Settings:
- Aggressiveness: ${effectiveBehavior.aggressiveness}/100
- Responsiveness: ${effectiveBehavior.responsiveness}/100  
- Italian Intensity: ${effectiveBehavior.italianIntensity}/100
- DBD Obsession: ${effectiveBehavior.dbdObsession}/100
- Family Business Mode: ${effectiveBehavior.familyBusinessMode}/100`);

      // Add member facts if available
      if (member.facts && member.facts.length > 0) {
        contextParts.push(`Facts about ${member.username}: ${member.facts.join(', ')}`);
      }

      // Add trigger context
      if (responseContext.triggerType === 'TOPIC_TRIGGER' && responseContext.triggerData?.topics) {
        contextParts.push(`Triggered by topics: ${responseContext.triggerData.topics.join(', ')}`);
      }

      // Recent Discord conversations for context
      const recentConversations = await storage.getDiscordConversations(server.id, 5);
      if (recentConversations.length > 0) {
        const contextMessages = recentConversations
          .reverse() // Show oldest first
          .map(conv => `${conv.username}: "${conv.triggerMessage}" | Nicky: "${conv.nickyResponse}"`)
          .join('\n');
        contextParts.push(`Recent Discord conversation context:\n${contextMessages}`);
      }

      const fullContext = contextParts.join('\n\n');
      
      // Add dynamic behavior context
      if (effectiveBehavior.driftFactors) {
        contextParts.push(`Dynamic Behavior Factors:
- Time of Day Influence: ${effectiveBehavior.driftFactors.timeOfDay > 0 ? 'Boosted' : effectiveBehavior.driftFactors.timeOfDay < 0 ? 'Dampened' : 'Normal'}
- Recent Activity Impact: ${effectiveBehavior.driftFactors.recentActivity > 0 ? 'Heightened' : effectiveBehavior.driftFactors.recentActivity < 0 ? 'Calmed' : 'Stable'}
- Chaos Mode Active: ${effectiveBehavior.driftFactors.chaosMultiplier > 1 ? 'Amplified' : effectiveBehavior.driftFactors.chaosMultiplier < 1 ? 'Suppressed' : 'Baseline'}`);
      }

      // Use Discord-specific short response generator
      console.log(`🤖 Calling Discord-specific response generator...`);
      const aiResponse = await this.generateShortDiscordResponse(
        `${fullContext}\n\n${personalityAdjustments}\n\nDiscord user "${member.username}" said: "${message.content}"\n\nRespond naturally like in Discord chat. 3-4 sentences max, no essays.`,
        this.activeProfile.coreIdentity
      );
      console.log(`✅ Got Discord response, processing...`);

      // Extract response content from AI response object
      if (!aiResponse) {
        console.log('❌ No AI response received');
        return null;
      }
      console.log(`🔍 AI Response type: ${typeof aiResponse}, structure:`, JSON.stringify(aiResponse, null, 2));
      const content = typeof aiResponse === 'string' ? aiResponse : aiResponse || String(aiResponse);
      console.log(`🔍 Extracted content: "${content}"`);

      // Emotion tags are now stripped centrally in generateShortDiscordResponse()
      let discordContent = content;

      // Remove self-mentions (bot tagging himself)
      const botUser = await this.client.user;
      if (botUser) {
        const selfMentionPattern = new RegExp(`<@!?${botUser.id}>`, 'g');
        discordContent = discordContent.replace(selfMentionPattern, '').replace(/\s+/g, ' ').trim();
        console.log(`🚫 Removed self-mentions for bot ID: ${botUser.id}`);
      }

      // Add proper @mention for the user being responded to
      const userMention = `<@${message.author.id}>`;
      if (!discordContent.includes(userMention)) {
        discordContent = `${userMention} ${discordContent}`;
        console.log(`👤 Added user mention for: ${member.username} (${message.author.id})`);
      }

      // If content is empty after filtering, provide a fallback
      if (!discordContent || discordContent.length < 3) {
        discordContent = "Hey there! What's up?";
      }

      console.log(`🎭 AGGRESSIVE Emotion filter: "${content.substring(0, 100)}..." → "${discordContent.substring(0, 100)}..."`);

      // Enforce Discord's 2000 character limit
      if (discordContent.length > 1900) {
        discordContent = discordContent.substring(0, 1900) + "...";
      }

      // Filter is working - debug signature removed

      return discordContent;
    } catch (error) {
      console.error('❌ Error generating Discord response:', error);
      
      // Random funny error messages
      const errorMessages = [
        "Madonna mia! Something went wrong in my head... give me a second! 🤯",
        "Ayy, my brain just blue-screened like a busted Windows 95! 💻💥",
        "Che cazzo! I think a wire got loose in my CPU! Give me a moment to reboot... 🔌⚡",
        "Mamma mia! My neural networks are more tangled than spaghetti! 🍝🧠",
        "VA BENE! My AI just had the digital equivalent of a stroke! 🤖💀",
        "ASPETTA! I think my processors are running hotter than Ma's marinara sauce! 🔥🍅",
        "Merda! Even my backup servers are crying right now! 😭💻",
        "Dio mio! My artificial intelligence just became artificial stupidity! 🤪🤖"
      ];
      
      return errorMessages[Math.floor(Math.random() * errorMessages.length)];
    }
  }

  private async createServerRecord(serverId: string, serverName: string): Promise<DiscordServer> {
    console.log(`📝 Creating new Discord server record: ${serverName} (${serverId})`);
    
    const newServer = await storage.createDiscordServer({
      profileId: this.activeProfile.id,
      serverId,
      serverName,
      isActive: true,
      // Default behavior settings
      aggressiveness: 80,
      responsiveness: 60,
      italianIntensity: 100,
      dbdObsession: 80,
      familyBusinessMode: 40,
      // CRITICAL FIX: Include proactive messaging control fields with proper defaults
      proactiveEnabled: true,
      allowedChannels: [], // Empty array means all channels allowed
      blockedChannels: [], // Empty array means no channels blocked
      enabledMessageTypes: ['dbd', 'italian', 'family_business', 'aggressive', 'random'], // All types enabled by default
    });
    
    // Start automatic behavior drift updates for this server
    try {
      const { behaviorModulator } = await import('./behaviorModulator');
      behaviorModulator.startDriftUpdates(serverId);
      console.log(`🔄 Started dynamic behavior drift for server: ${serverName}`);
    } catch (error) {
      console.error('Failed to start behavior drift updates:', error);
    }
    
    return newServer;
  }

  private async createMemberRecord(
    serverId: string, 
    userId: string, 
    username: string,
    nickname?: string
  ): Promise<DiscordMember> {
    console.log(`👤 Creating new Discord member record: ${username} (${userId})`);
    
    return await storage.createDiscordMember({
      profileId: this.activeProfile.id,
      serverId,
      userId,
      username,
      nickname,
      facts: [],
      keywords: [],
      lastInteraction: new Date(),
      interactionCount: 1,
    });
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public getClient(): Client {
    return this.client;
  }

  // Proactive messaging system - Nicky randomly initiates conversations
  private proactiveMessageTimer: NodeJS.Timeout | null = null;

  private startProactiveMessaging(): void {
    if (this.proactiveMessageTimer) {
      clearInterval(this.proactiveMessageTimer);
    }

    // Check for proactive message opportunity every 2-4 hours
    this.proactiveMessageTimer = setInterval(async () => {
      await this.considerProactiveMessage();
    }, Math.random() * 7200000 + 7200000); // 2-4 hours randomly (much less frequent!)

    console.log('🎲 Started proactive messaging system');
  }

  private async considerProactiveMessage(): Promise<void> {
    try {
      if (!this.activeProfile) return;

      // Check daily limit (max 2 proactive messages per day) - PERSISTENT VERSION
      const today = new Date().toDateString();

      // Get all active servers and check/reset daily limits
      const servers = await storage.getProfileDiscordServers(this.activeProfile.id);
      const activeServers = servers.filter(s => s.isActive && s.proactiveEnabled);
      if (activeServers.length === 0) return;

      // Check daily limits across all servers (global daily limit)
      let totalDailyCount = 0;
      for (const server of activeServers) {
        // Reset daily count if it's a new day
        if (server.lastProactiveDate !== today) {
          await storage.updateDiscordServer(server.serverId, {
            dailyProactiveCount: 0,
            lastProactiveDate: today
          });
          console.log(`🔄 Reset daily proactive count for server: ${server.serverName}`);
        } else {
          totalDailyCount += server.dailyProactiveCount || 0;
        }
      }

      if (totalDailyCount >= 2) {
        console.log(`🎲 Daily proactive message limit reached (${totalDailyCount}/2) across all servers`);
        return;
      }

      // Pick a random server
      const server = activeServers[Math.floor(Math.random() * activeServers.length)];

      // Check if proactive messaging is enabled for this server
      if (!server.proactiveEnabled) {
        console.log(`🎲 Proactive messaging disabled for server: ${server.serverName}`);
        return;
      }

      // Get effective behavior to determine proactivity level
      const { behaviorModulator } = await import('./behaviorModulator');
      const effectiveBehavior = await behaviorModulator.getEffectiveBehavior(server.serverId);

      // Higher responsiveness = more proactive messages
      const proactiveChance = effectiveBehavior.responsiveness * 0.15; // 15% at max responsiveness
      if (Math.random() * 100 > proactiveChance) return;

      // Find a suitable channel to send message to
      const guild = this.client.guilds.cache.get(server.serverId);
      if (!guild) return;

      // Find eligible channels based on server settings
      const channel = this.findEligibleChannel(guild, server);
      if (!channel) {
        console.log(`🎲 No eligible channels found for proactive message in: ${server.serverName}`);
        return;
      }

      // Generate a proactive message with server's enabled message types and channel context
      const proactiveMessage = await this.generateProactiveMessage(server, effectiveBehavior, channel);
      if (proactiveMessage) {
        // CRITICAL FIX: Update database counter instead of in-memory
        const currentCount = server.dailyProactiveCount || 0;
        await storage.updateDiscordServer(server.id, {
          dailyProactiveCount: currentCount + 1,
          lastProactiveDate: today
        });
        
        console.log(`🎲 Sending proactive message to ${guild.name} (${currentCount + 1}/2 today): ${proactiveMessage.substring(0, 50)}...`);
        await channel.send(proactiveMessage);

        // Log this as a conversation
        await storage.logDiscordConversation({
          profileId: this.activeProfile.id,
          serverId: server.serverId,
          channelId: channel.id,
          channelName: channel.name,
          messageId: 'PROACTIVE',
          userId: 'PROACTIVE_BOT',
          username: 'Nicky (Proactive)',
          triggerMessage: '[PROACTIVE MESSAGE INITIATED]',
          nickyResponse: proactiveMessage,
          triggerType: 'PROACTIVE',
          triggerData: { keywords: ['proactive'], responseChance: 100 },
          processingTime: 100,
        });
      }
    } catch (error) {
      console.error('Error in proactive messaging:', error);
    }
  }

  private async generateProactiveMessage(server: any, effectiveBehavior: any, channel?: any): Promise<string | null> {
    try {
      // Get recent activity to avoid interrupting active conversations
      const recentConversations = await storage.getDiscordConversations(server.serverId, 5);
      const lastMessage = recentConversations[0];

      // Don't send proactive message if someone just talked (within 10 minutes)
      if (lastMessage && lastMessage.createdAt && (Date.now() - new Date(lastMessage.createdAt).getTime()) < 600000) {
        return null;
      }

      // Get enabled message types from server settings
      const enabledTypes = server.enabledMessageTypes || ['dbd', 'italian', 'family_business', 'aggressive', 'random'];

      // Create personality-driven proactive prompts organized by type
      const promptsByType = {
        dbd: [
          'Ask a random Dead by Daylight question or share a DBD hot take',
          'Complain about something ridiculous that happened in your last DBD match',
          'Ask who people think the most annoying killer is and why',
          'Challenge everyone to settle something with DBD 1v1s',
        ],
        italian: [
          'Say something completely random in Italian and then translate it poorly',
          'Ask a weird question about food or cooking',
          'Dramatically declare something totally mundane',
        ],
        family_business: [
          'Make a vague reference to "family business" about something silly',
          'Ask if anyone needs any "favors" but for trivial things',
          'Reference loyalty or respect in a ridiculous context',
        ],
        aggressive: [
          'Start a mild argument about something completely harmless',
          'Call someone out for something trivial they did days ago',
          'Challenge someone to prove their point about anything',
        ],
        random: [
          'Ask a completely bizarre hypothetical question',
          'Share a random childhood memory that makes no sense',
          'Demand everyone vote on something ridiculous',
          'Ask for help with the most basic task possible',
          'Complain about weather, time, or the concept of Tuesdays',
        ]
      };

      // Collect all prompts from enabled types
      let availablePrompts: string[] = [];
      for (const type of enabledTypes) {
        if (promptsByType[type as keyof typeof promptsByType]) {
          availablePrompts.push(...promptsByType[type as keyof typeof promptsByType]);
        }
      }

      // If no enabled types or no prompts, fall back to random
      if (availablePrompts.length === 0) {
        availablePrompts = promptsByType.random;
      }

      // Pick prompt based on behavior settings, enabled types, AND channel context
      let selectedPrompts = [...availablePrompts];
      
      // Note: Channel context will be passed from the calling function
      
      // Use channel name to influence content selection (if available)
      const channelName = channel?.name || 'general';
      if (channelName.includes('dbd') || channelName.includes('dead') || channelName.includes('daylight') || channelName.includes('killer')) {
        selectedPrompts = enabledTypes.includes('dbd') ? promptsByType.dbd : availablePrompts.filter(p => p.includes('DBD') || p.includes('Dead by Daylight'));
      } else if (channelName.includes('food') || channelName.includes('cook') || channelName.includes('italian') || channelName.includes('pasta')) {
        selectedPrompts = enabledTypes.includes('italian') ? promptsByType.italian : availablePrompts.filter(p => p.includes('Italian') || p.includes('food'));
      } else if (channelName.includes('game') || channelName.includes('gaming') || channelName.includes('play')) {
        selectedPrompts = enabledTypes.includes('dbd') ? promptsByType.dbd.concat(promptsByType.aggressive) : [...promptsByType.dbd, ...promptsByType.aggressive];
      } else if (channelName.includes('random') || channelName.includes('chaos') || channelName.includes('off-topic') || channelName.includes('meme')) {
        selectedPrompts = enabledTypes.includes('random') ? promptsByType.random.concat(promptsByType.aggressive) : [...promptsByType.random, ...promptsByType.aggressive];
      } else if (effectiveBehavior.dbdObsession > 70 && enabledTypes.includes('dbd')) {
        selectedPrompts = promptsByType.dbd;
      } else if (effectiveBehavior.italianIntensity > 80 && enabledTypes.includes('italian')) {
        selectedPrompts = promptsByType.italian;
      } else if (effectiveBehavior.familyBusinessMode > 60 && enabledTypes.includes('family_business')) {
        selectedPrompts = promptsByType.family_business;
      }

      const randomPrompt = selectedPrompts[Math.floor(Math.random() * selectedPrompts.length)];

      // Build context for the proactive message
      const contextParts = [
        `Generate a spontaneous Discord message for Nicky "Noodle Arms" A.I. Dente.`,
        `Channel context: This is being posted in #${channelName} - tailor content appropriately for this channel's theme.`,
        `Prompt: ${randomPrompt}`,
        `Behavior Settings:
- Aggressiveness: ${effectiveBehavior.aggressiveness}/100
- Italian Intensity: ${effectiveBehavior.italianIntensity}/100
- DBD Obsession: ${effectiveBehavior.dbdObsession}/100
- Family Business Mode: ${effectiveBehavior.familyBusinessMode}/100`,
        `Make it feel natural and spontaneous, like he just thought of something random to say.`,
        `Keep response natural - 3-4 sentences max. Write like people actually chat on Discord - conversational but not essay-length!`
      ];

      const fullContext = contextParts.join('\n\n');

      // Generate Discord-specific short proactive message
      return await this.generateShortDiscordResponse(fullContext, this.activeProfile.coreIdentity);
    } catch (error) {
      console.error('Error generating proactive message:', error);
      return null;
    }
  }

  /**
   * Centralized emotion tag removal for ALL Discord responses
   */
  private stripEmotionTags(content: string): string {
    // AGGRESSIVE emotion tag removal for Discord - strip ALL possible formats
    let discordContent = content
      .replace(/\*[^*]*\*/g, '')      // Remove *anything*
      .replace(/\([^)]*\)/g, '')      // Remove (anything)  
      .replace(/\[[^\]]*\]/g, '')     // Remove [anything]
      .replace(/_[^_]*_/g, '')        // Remove _anything_
      .replace(/~[^~]*~/g, '')        // Remove ~anything~
      .replace(/\{[^}]*\}/g, '')      // Remove {anything}
      .replace(/\s*\.\.\.\s*/g, ' ')  // Remove ellipses
      .replace(/\s+/g, ' ')           // Clean up extra spaces
      .trim();
    
    return discordContent;
  }

  /**
   * Discord-specific response generator that enforces brevity
   */
  private async generateShortDiscordResponse(prompt: string, coreIdentity: string): Promise<string | null> {
    try {
      // First try Anthropic
      const anthropic = new (await import('@anthropic-ai/sdk')).Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 200, // Reasonable limit for 3-4 sentences
        temperature: 1.0,
        system: `${coreIdentity}

DISCORD MODE: You are chatting on Discord. Your responses MUST be:
- 3-4 sentences maximum 
- Conversational and casual like texting
- No action descriptions (*laughs*, etc.)
- No long rants or essays
- Natural Discord chat style, not walls of text`,
        messages: [{
          role: 'user',
          content: prompt
        }],
      });

      const content = Array.isArray(response.content) 
        ? (response.content[0] as any).text 
        : (response.content as any);

      if (!content) return null;

      // Strip emotion tags from Anthropic response
      let cleanContent = this.stripEmotionTags(content);

      // Ensure it stays reasonable length
      if (cleanContent.length > 500) {
        cleanContent = cleanContent.substring(0, 497) + "...";
      }

      return cleanContent;
    } catch (error) {
      console.error('Error in Discord-specific response generation:', error);
      
      // Fallback to Gemini with Discord-specific constraints
      try {
        console.log('🔄 Anthropic failed, using Gemini for Discord response...');
        const { geminiService } = await import('./gemini');
        
        const discordIdentity = `${coreIdentity}

DISCORD CHAT MODE - CRITICAL CONSTRAINTS:
- Maximum 3-4 sentences only
- Casual conversational tone like texting
- No essays, rants, or long explanations
- Simple responses, not walls of text
- Stay calm and composed
- Be friendly and helpful, not aggressive`;

        // Create clean Discord prompt without chaos personality instructions
        const cleanPrompt = `Discord chat context: Someone said "${prompt.split('Discord user')[1]?.split('said:')[1]?.split('"')[1] || 'hello'}"

Respond naturally in Discord chat style. Keep it short and conversational.`;

        const geminiResponse = await geminiService.generateChatResponse(
          cleanPrompt,
          discordIdentity,
          ""
        );
        
        let content = geminiResponse.content;
        
        // Strip emotion tags from Gemini response too
        content = this.stripEmotionTags(content);
        
        // Aggressively limit length for Discord
        if (content.length > 300) {
          content = content.substring(0, 297) + "...";
        }
        
        console.log('✅ Gemini Discord response generated successfully');
        return content;
      } catch (geminiError) {
        console.error('Gemini Discord fallback also failed:', geminiError);
        
        // Last resort: simple responses
        const fallbackResponses = [
          "What's good?",
          "Sup?",
          "Hey there!",
          "Yo!",
          "What's up?",
          "Madonna mia...",
          "Oof...",
          "Bruh"
        ];
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      }
    }
  }

  // Helper method to find eligible channels for proactive messaging
  private findEligibleChannel(guild: any, server: any): TextChannel | null {
    const allowedChannels = server.allowedChannels || [];
    const blockedChannels = server.blockedChannels || [];

    // Get all text channels
    const textChannels = guild.channels.cache.filter((ch: any) => ch.type === 0);

    // If there are allowed channels specified, only use those
    if (allowedChannels.length > 0) {
      const allowedChannel = textChannels.find((ch: any) => allowedChannels.includes(ch.id));
      return allowedChannel || null;
    }

    // Otherwise, find general channels but exclude blocked ones
    const eligibleChannels = textChannels.filter((ch: any) => {
      // Skip blocked channels
      if (blockedChannels.includes(ch.id)) return false;
      
      // Look for general chat channels
      return ch.name.includes('general') || 
             ch.name.includes('chat') || 
             ch.name.includes('main') ||
             ch.name.includes('random') ||
             ch.name.includes('off-topic');
    });

    if (eligibleChannels.size === 0) return null;

    // Pick a random eligible channel
    const channelArray = Array.from(eligibleChannels.values()) as TextChannel[];
    return channelArray[Math.floor(Math.random() * channelArray.length)];
  }

  // Start proactive messaging when a server is added
  private initializeProactiveMessaging(): void {
    this.startProactiveMessaging();
  }
}

export const discordBotService = new DiscordBotService();