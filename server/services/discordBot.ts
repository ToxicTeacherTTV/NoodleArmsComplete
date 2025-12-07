import { Client, GatewayIntentBits, Message, Events, TextChannel } from 'discord.js';
import { storage } from '../storage';
import { anthropicService } from './anthropic';
import type { DiscordServer, DiscordMember, DiscordTopicTrigger } from '@shared/schema';
import { prometheusMetrics } from './prometheusMetrics.js';

export class DiscordBotService {
  private client: Client;
  private isConnected: boolean = false;
  private activeProfile: any = null;
  private recentResponses?: Set<string>;
  private handlersAttached: boolean = false;
  private recentPhrasesMap: Map<string, { phrases: string[], timestamps: number[] }> = new Map();

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  private getChannelMetricType(channel: any): string | number | undefined {
    if (!channel) {
      return undefined;
    }

    if (typeof channel.type !== 'undefined') {
      return channel.type as string | number;
    }

    return undefined;
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
      // Prevent duplicate startup
      if (this.isConnected || this.client.readyAt) {
        console.log(`⚠️ Discord bot already started, skipping duplicate startup`);
        return;
      }

      // Setup event handlers only once
      if (!this.handlersAttached) {
        this.setupEventHandlers();
        this.handlersAttached = true;
      }

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
    // Debug: Log all messages we receive
    console.log(`📩 Received message: "${message.content}" from ${message.author.username} in ${message.guild?.name || 'DM'}`);
    
    // Ignore bot messages to prevent loops
    if (message.author.bot) {
      console.log(`🤖 Ignoring bot message from ${message.author.username}`);
      return;
    }
    
    // Ignore DMs for now - only respond in servers
    if (!message.guild) {
      console.log(`📧 Ignoring DM from ${message.author.username}`);
      return;
    }

    try {
      // Database-based idempotency check - prevent duplicates across all instances
      // For now, skip database check until we implement the storage method
      // const existingConversation = await storage.getDiscordConversationByMessageId?.(message.id);
      // if (existingConversation) {
      //   console.log(`🚫 Message ${message.id} already processed (found in database), skipping`);
      //   return;
      // }
      // Get or create server record with robust error handling
      let discordServer: DiscordServer | null = null;
      try {
        discordServer = await storage.getDiscordServer(message.guild.id) || null;
        if (!discordServer) {
          console.log(`🆕 Creating new server record for: ${message.guild.name} (${message.guild.id})`);
          discordServer = await this.createServerRecord(message.guild.id, message.guild.name);
        }
      } catch (storageError) {
        console.error(`❌ Database error for server ${message.guild.id}:`, storageError);
        // Try to continue with minimal server config
        discordServer = {
          createdAt: null,
          id: `fallback-${message.guild.id}`,
          isActive: true,
          updatedAt: null,
          profileId: this.activeProfile?.id || 'default',
          serverId: message.guild.id,
          serverName: message.guild.name,
          aggressiveness: 80,
          responsiveness: 30,
          unpredictability: 100,
          dbdObsession: 70,
          familyBusinessMode: 60,
          proactiveEnabled: true,
          allowedChannels: [],
          blockedChannels: [],
          enabledMessageTypes: ['dbd', 'italian', 'family_business', 'aggressive', 'random'],
          lastProactiveDate: null,
          lastDriftUpdate: null,
          driftMomentum: 0,
          contextNudges: 0,
          dailyProactiveCount: 0,
          unifiedPersonalityMigrated: false
        } satisfies DiscordServer;
      }
      
      // Early exit if we couldn't get server config
      if (!discordServer) {
        console.error(`❌ Unable to get server config for ${message.guild.id}, skipping message`);
        return;
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

      // Get or create member record with error handling
      let discordMember: DiscordMember | null = null;
      try {
        discordMember = await storage.getDiscordMember(discordServer!.id, message.author.id) || null;
        if (!discordMember) {
          discordMember = await this.createMemberRecord(
            discordServer!.id, 
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
      } catch (memberError) {
        console.error(`❌ Database error for member ${message.author.id}:`, memberError);
        // Create minimal member record for this session
        discordMember = {
          createdAt: null,
          id: `fallback-${message.author.id}`,
          nickname: message.member?.nickname || null,
          username: message.author.username,
          updatedAt: null,
          profileId: this.activeProfile?.id || 'default',
          serverId: discordServer!.id,
          userId: message.author.id,
          facts: null,
          keywords: null,
          lastInteraction: new Date(),
          interactionCount: 1
        } satisfies DiscordMember;
      }

      // Early exit if we don't have member record
      if (!discordMember) {
        console.error(`❌ Unable to get member record for ${message.author.id}, skipping message`);
        return;
      }

      // Determine if Nicky should respond
      const shouldRespond = await this.shouldRespondToMessage(message, discordServer);
      console.log(`🎯 Response decision for "${message.content}": ${shouldRespond.respond ? 'YES' : 'NO'} (${shouldRespond.triggerType})`);
      
      if (shouldRespond.respond) {
        console.log(`💬 Responding to message from ${message.author.username}: "${message.content}"`);
        
        // Show typing indicator
        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }
        
        // Generate response using existing AI pipeline with error handling
        let response: string | null = null;
        try {
          response = await this.generateResponse(
            message, 
            discordServer, 
            discordMember, 
            shouldRespond
          );
        } catch (aiError) {
          console.error(`❌ AI service error for message from ${message.author.username}:`, aiError);
          // Provide fallback response when AI fails
          const fallbackResponses = [
            "Madonna mia! My brain's having a moment... give me a sec! 🤯",
            "Ay, something's not right up here! *taps head* Try again in a minute! 🤖",
            "Dio santo! The AI gods are testing me right now... 😅"
          ];
          response = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        }
        
        if (response && response.trim()) {
          // Ensure only one response per message - add deduplication
          const messageKey = `${message.id}-${message.author.id}`;
          console.log(`🔍 Processing message ${message.id} from ${message.author.username}, key: ${messageKey}`);
          
          if (this.recentResponses?.has(messageKey)) {
            console.log(`🚫 Duplicate response prevented for message ${message.id} - already processed`);
            return;
          }
          
          // Track this response to prevent duplicates
          if (!this.recentResponses) this.recentResponses = new Set();
          this.recentResponses.add(messageKey);
          console.log(`✅ Added message ${messageKey} to recent responses. Set size: ${this.recentResponses.size}`);
          setTimeout(() => {
            this.recentResponses?.delete(messageKey);
            console.log(`🗑️ Cleaned up message ${messageKey} from recent responses`);
          }, 5000); // Clean up after 5 seconds
          
          // Send response to Discord with single send method
          try {
            await message.reply(response);

            // 📊 Track Discord reply message
            const replyChannelType = this.getChannelMetricType(message.channel);
            prometheusMetrics.trackDiscordMessage('reply', replyChannelType, shouldRespond.triggerType);
          } catch (discordError) {
            console.error(`❌ Discord API error sending message:`, discordError);
            
            // 📊 Track Discord error
            const errorChannelType = this.getChannelMetricType(message.channel);
            prometheusMetrics.trackDiscordMessage('error', errorChannelType, 'send_failed');
            
            // Don't try fallback to prevent duplicate messages
            // Log the failure but don't crash
            return;
          }
          
          // Log the conversation with error handling
          try {
            await storage.logDiscordConversation({
              profileId: this.activeProfile?.id || 'default',
              serverId: discordServer!.id,
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
          } catch (loggingError) {
            console.error(`❌ Failed to log Discord conversation:`, loggingError);
            // Continue execution - logging failure shouldn't stop the bot
          }

          // Extract and store facts about the user from their message
          /* DISABLED: User requested to stop auto-storing facts
          try {
            const { discordFactExtractor } = await import('./discordFactExtractor');
            const newFacts = await discordFactExtractor.extractFactsFromMessage(
              message.author.username,
              message.content,
              discordMember.facts || []
            );

            if (newFacts.length > 0) {
              await discordFactExtractor.updateMemberFacts(
                discordMember.id,
                newFacts,
                discordMember.facts || []
              );

              // Also update keywords for better retrieval
              const keywords = discordFactExtractor.extractKeywordsFromFacts([...discordMember.facts || [], ...newFacts]);
              await storage.updateDiscordMember(discordMember.id, { keywords });

              console.log(`✅ Learned ${newFacts.length} new facts about ${message.author.username}`);
            }
          } catch (factError) {
            console.error(`❌ Failed to extract member facts:`, factError);
            // Continue execution - fact extraction failure shouldn't stop the bot
          }
          */
        }
      }
    } catch (error) {
      console.error(`❌ Critical error handling Discord message from ${message.author.username}:`, error);
      console.error('Full error details:', {
        messageId: message.id,
        channelId: message.channel.id,
        guildId: message.guild?.id,
        content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
        timestamp: new Date().toISOString()
      });
      // Don't reply with error messages to avoid spam, but ensure we don't crash
    }
  }

  /**
   * Fetch recent channel messages for conversation context
   */
  private async getChannelContext(channel: any, limit: number = 8): Promise<string> {
    try {
      if (!channel || !('messages' in channel)) {
        return '';
      }

      const recentMessages = await channel.messages.fetch({ limit: Math.min(limit, 20) });
      
      if (recentMessages.size === 0) {
        return '';
      }

      // Filter and format messages for context
      const contextMessages = recentMessages
        .filter((msg: Message) => {
          // Exclude bot messages and very old messages (older than 30 minutes)
          const isBot = msg.author.bot;
          const isTooOld = (Date.now() - msg.createdTimestamp) > (30 * 60 * 1000);
          const isEmpty = !msg.content || msg.content.trim().length === 0;
          
          return !isBot && !isTooOld && !isEmpty;
        })
        .sort((a: Message, b: Message) => a.createdTimestamp - b.createdTimestamp) // Chronological order
        .map((msg: Message) => {
          // Clean content and limit length
          const cleanContent = msg.content
            .replace(/<@[!&]?\d+>/g, '@someone') // Replace mentions
            .replace(/https?:\/\/[^\s]+/g, '[link]') // Replace URLs
            .trim()
            .substring(0, 150); // Limit message length
          
          return `${msg.author.username}: ${cleanContent}`;
        })
        .slice(-limit); // Keep most recent messages

      if (contextMessages.length === 0) {
        return '';
      }

      console.log(`📖 Channel context: ${contextMessages.length} recent messages from ${channel.name}`);
      return `Recent conversation in ${channel.name}:\n${contextMessages.join('\n')}`;
      
    } catch (error) {
      console.warn('⚠️ Failed to fetch channel context:', error);
      return '';
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
      // Get channel context for mentioned responses too
      const channelContext = await this.getChannelContext(message.channel, 6);
      console.log(`💬 Mention response with ${channelContext ? 'context' : 'no context'}`);
      
      return {
        respond: true,
        triggerType: 'MENTION',
        triggerData: {
          channelContext: channelContext, // Add conversation context to mentions
        },
        processingTime: Date.now() - startTime,
      };
    }

    // Check topic triggers
    const topicTriggers = await storage.getDiscordTopicTriggers(server.id);
    const messageContent = message.content.toLowerCase();
    console.log(`🔍 Checking ${topicTriggers.length} topic triggers for: "${messageContent}"`);
    
    for (const trigger of topicTriggers) {
      const triggerWords = [trigger.topic.toLowerCase(), ...(trigger.keywords || [])];
      
      for (const word of triggerWords) {
        if (messageContent.includes(word.toLowerCase())) {
          // Use response chance to determine if we should actually respond
          const randomChance = Math.random() * 100;
          if (randomChance <= (trigger.responseChance || 75)) {
            // Get channel context for topic/keyword triggered responses
            const channelContext = await this.getChannelContext(message.channel, 6);
            console.log(`🔍 Topic trigger "${trigger.topic}" with ${channelContext ? 'context' : 'no context'}`);
            
            // Update trigger statistics
            await storage.updateDiscordTopicTrigger(trigger.id, {
              triggerCount: (trigger.triggerCount || 0) + 1,
              lastTriggered: new Date(),
            });
            
            return {
              respond: true,
              triggerType: 'TOPIC_TRIGGER',
              triggerData: {
                channelContext: channelContext, // Add conversation context to topic triggers
                topics: [trigger.topic],
                keywords: triggerWords,
                responseChance: trigger.responseChance,
                behaviorSettings: {
                  aggressiveness: server.aggressiveness || 80,
                  responsiveness: server.responsiveness || 60,
                  unpredictability: server.unpredictability || 100,
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
        // Get channel context for conversation continuation
        const channelContext = await this.getChannelContext(message.channel, 6);
        console.log(`💬 Conversation continuation detected from ${message.author.username} with ${channelContext ? 'context' : 'no context'}`);
        
        return {
          respond: true,
          triggerType: 'TOPIC_TRIGGER',
          triggerData: {
            channelContext: channelContext, // Add conversation context to continuations
            conversationContinuation: true,
            lastMessage: lastNickyMessage.nickyResponse,
            behaviorSettings: {
              aggressiveness: server.aggressiveness || 80,
              responsiveness: server.responsiveness || 60,
              unpredictability: server.unpredictability || 100,
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
      // Balanced response rate - aim for ~25% at max responsiveness (100)
      const responseRate = Math.min(25, effectiveBehavior.responsiveness * 0.25);
      if (randomChance <= responseRate) {
        // Get channel context for contextual auto-replies
        const channelContext = await this.getChannelContext(message.channel, 6);
        console.log(`🎲 Auto-reply triggered with ${channelContext ? 'context' : 'no context'}`);
        
        return {
          respond: true,
          triggerType: 'RANDOM',
          triggerData: {
            channelContext: channelContext, // Add conversation context
            behaviorSettings: {
              aggressiveness: effectiveBehavior.aggressiveness,
              responsiveness: effectiveBehavior.responsiveness,
              unpredictability: effectiveBehavior.unpredictability,
            },
          },
          processingTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.error('Error getting effective behavior for random response:', error);
      // Fallback to baseline values
      const randomChance = Math.random() * 100;
      const fallbackResponseRate = Math.min(25, (server.responsiveness || 30) * 0.25);
      if (randomChance <= fallbackResponseRate) {
        // Get channel context even in fallback mode
        const channelContext = await this.getChannelContext(message.channel, 6);
        console.log(`🎲 Auto-reply fallback triggered with ${channelContext ? 'context' : 'no context'}`);
        
        return {
          respond: true,
          triggerType: 'RANDOM',
          triggerData: {
            channelContext: channelContext, // Add conversation context
            behaviorSettings: {
              aggressiveness: server.aggressiveness || 80,
              responsiveness: server.responsiveness || 60,
              unpredictability: server.unpredictability || 100,
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
    if (effectiveBehavior.unpredictability > 80) {
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
      if (messageTypes.includes('italian') && effectiveBehavior.unpredictability > 80) {
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
- Italian Intensity: ${effectiveBehavior.unpredictability}/100
- DBD Obsession: ${effectiveBehavior.dbdObsession}/100
- Family Business Mode: ${effectiveBehavior.familyBusinessMode}/100`);

      // Enhanced user-specific context
      if (member.facts && member.facts.length > 0) {
        contextParts.push(`Facts about ${member.username}: ${member.facts.join(', ')}`);
      }
      
      // Get relevant memories about this user for context
      try {
        // Get memories related to this user (using proper storage method)
        const allMemories = await storage.getMemoryEntries(this.activeProfile.id);
        const relevantMemories = allMemories
          .filter(mem => 
            mem.content.toLowerCase().includes(member.username.toLowerCase()) ||
            mem.keywords?.some(k => k.toLowerCase().includes(member.username.toLowerCase()))
          )
          .slice(0, 5);
        
        if (relevantMemories.length > 0) {
          const memoryContext = relevantMemories
            .map(mem => {
              let memStr = `${mem.content} (${mem.type}, importance: ${mem.importance})`;
              // 🎙️ Include episode source if from podcast
              if (mem.source === 'podcast_episode' && mem.temporalContext) {
                memStr += ` [From: ${mem.temporalContext}]`;
              }
              return memStr;
            })
            .join('; ');
          contextParts.push(`Relevant memories about conversations: ${memoryContext}`);
        }
      } catch (memoryError) {
        console.log(`⚠️ Could not retrieve memories for context: ${memoryError}`);
      }

      // Add trigger context
      if (responseContext.triggerType === 'TOPIC_TRIGGER' && responseContext.triggerData?.topics) {
        contextParts.push(`Triggered by topics: ${responseContext.triggerData.topics.join(', ')}`);
      }

      // Add recent channel context if available (for auto-replies and mentions)
      if (responseContext.triggerData?.channelContext) {
        contextParts.push(`${responseContext.triggerData.channelContext}\n\nNote: Join the ongoing conversation naturally. Respond contextually to what people are talking about instead of random unrelated topics.`);
        console.log(`📖 Added channel conversation context to AI prompt`);
      }

      // Enhanced conversation context with more detail
      const recentConversations = await storage.getDiscordConversations(server.id, 8);
      if (recentConversations.length > 0) {
        // Group conversations by user for better context
        const conversationsByUser = recentConversations.reduce((acc, conv) => {
          if (!acc[conv.username]) acc[conv.username] = [];
          acc[conv.username].push(conv);
          return acc;
        }, {} as Record<string, typeof recentConversations>);
        
        // Build rich conversation context
        const contextMessages = recentConversations
          .reverse() // Show oldest first
          .slice(-6) // Last 6 exchanges for manageable context
          .map(conv => {
            const timeAgo = conv.createdAt ? Math.floor((Date.now() - new Date(conv.createdAt).getTime()) / (1000 * 60)) : 0;
            const triggerInfo = conv.triggerType === 'MENTION' ? '[MENTION]' : 
                               conv.triggerType === 'TOPIC_TRIGGER' ? '[TOPIC]' : '[AUTO]';
            return `${timeAgo}min ago ${triggerInfo} ${conv.username}: "${conv.triggerMessage}" → Nicky: "${conv.nickyResponse}"`;
          })
          .join('\n');
        
        contextParts.push(`Recent Discord conversation flow:\n${contextMessages}`);
        
        // Add user-specific conversation patterns
        const userConversations = conversationsByUser[member.username] || [];
        if (userConversations.length > 1) {
          const userTopics = userConversations
            .map(conv => conv.triggerMessage.toLowerCase())
            .slice(-3)
            .join(', ');
          contextParts.push(`${member.username}'s recent topics: ${userTopics}`);
        }
      }

      const fullContext = contextParts.join('\n\n');
      
      // Add dynamic behavior context
      if (effectiveBehavior.driftFactors) {
        contextParts.push(`Dynamic Behavior Factors:
- Time of Day Influence: ${effectiveBehavior.driftFactors.timeOfDay > 0 ? 'Boosted' : effectiveBehavior.driftFactors.timeOfDay < 0 ? 'Dampened' : 'Normal'}
- Recent Activity Impact: ${effectiveBehavior.driftFactors.recentActivity > 0 ? 'Heightened' : effectiveBehavior.driftFactors.recentActivity < 0 ? 'Calmed' : 'Stable'}
- Chaos Mode Active: ${effectiveBehavior.driftFactors.chaosMultiplier > 1 ? 'Amplified' : effectiveBehavior.driftFactors.chaosMultiplier < 1 ? 'Suppressed' : 'Baseline'}`);
      }

      // ENHANCED: Use VarietyController for natural personality variation
      console.log(`🎭 Integrating VarietyController for Discord response...`);
      
      // Get conversation ID (use server+channel as unique identifier)
      const conversationId = `discord-${server.serverId}-${message.channel.id}`;
      
      // Import and use VarietyController for personality facet selection
      const { VarietyController } = await import('./VarietyController');
      const varietyController = new VarietyController();
      
      // Select personality facet based on user message and conversation history
      const { facet, variety } = await varietyController.selectPersonaFacet(conversationId, message.content);
      console.log(`🎭 Selected personality facet: ${facet.name} - ${facet.description}`);
      
      // Generate variety prompt with anti-repetition and personality guidance
      const varietyPrompt = varietyController.generateVarietyPrompt(facet, variety);
      
      // Anti-repetition analysis for this user
      const antiRepetitionGuidance = this.generateAntiRepetitionGuidance(server.serverId, member.username);
      
      // Enhanced prompt with full personality system + anti-repetition
      const enhancedPrompt = `${fullContext}\n\n${personalityAdjustments}\n\n${varietyPrompt}\n\n${antiRepetitionGuidance}\n\nDISCORD CONTEXT:\nUser "${member.username}" said: "${message.content}"\n\nRespond naturally in Discord chat style. Use your selected personality facet to create a varied, engaging response. 3-4 sentences max. AVOID repeating the same phrases, insults, or patterns from recent responses.`;
      
      console.log(`🤖 Calling enhanced Discord response generator with facet: ${facet.name}...`);
      const aiResponse = await this.generateShortDiscordResponse(
        enhancedPrompt,
        this.activeProfile.coreIdentity
      );
      console.log(`✅ Got Discord response using facet '${facet.name}', processing...`);
      
      // Apply chaos-based compliance to anti-repetition guidance
      const finalResponse = await this.applyChaoticCompliance(aiResponse, server.serverId, member.username, enhancedPrompt);
      
      // Track phrases for anti-repetition
      if (typeof finalResponse === 'string') {
        this.trackResponsePhrases(server.serverId, member.username, finalResponse);
        console.log(`📝 Tracked response phrases for anti-repetition: ${member.username}`);
      }

      // Extract response content from chaos-processed response
      if (!finalResponse) {
        console.log('❌ No final response received');
        return null;
      }
      console.log(`🔍 Final Response type: ${typeof finalResponse}, structure:`, JSON.stringify(finalResponse, null, 2));
      const content = typeof finalResponse === 'string' ? finalResponse : finalResponse || String(finalResponse);
      console.log(`🔍 Extracted final content: "${content}"`);

      // Emotion tags are now stripped centrally in generateShortDiscordResponse()
      let discordContent = content;

      // Remove self-mentions (bot tagging himself)
      const botUser = await this.client.user;
      if (botUser) {
        const selfMentionPattern = new RegExp(`<@!?${botUser.id}>`, 'g');
        discordContent = discordContent.replace(selfMentionPattern, '').replace(/\s+/g, ' ').trim();
        console.log(`🚫 Removed self-mentions for bot ID: ${botUser.id}`);
      }

      // If content is empty after filtering, provide a fallback
      if (!discordContent || discordContent.length < 3) {
        discordContent = "Hey there! What's up?";
      }

      // Add proper @mention for the user being responded to
      const userMention = `<@${message.author.id}>`;
      if (!discordContent.includes(userMention)) {
        discordContent = `${userMention} ${discordContent}`;
        console.log(`👤 Added user mention for: ${member.username} (${message.author.id})`);
      }

      console.log(`🎭 AGGRESSIVE Emotion filter: "${content.substring(0, 100)}..." → "${discordContent.substring(0, 100)}..."`);

      // Enforce Discord's 2000 character limit with smart truncation (check AFTER adding mention)
      if (discordContent.length > 1990) {
        console.log(`📏 Message length ${discordContent.length} exceeds limit, applying smart truncation...`);
        
        // Try sentence-based truncation first
        const sentences = discordContent.split(/(?<=[.!?])\s+/);
        let truncated = "";
        
        for (const sentence of sentences) {
          const testLength = (truncated + sentence + " (continued...)").length;
          if (testLength <= 1990) {
            truncated += (truncated ? " " : "") + sentence;
          } else {
            break;
          }
        }
        
        // If we got at least one complete sentence, use it with continuation indicator
        if (truncated.length > 100) {
          const originalLength = discordContent.length;
          discordContent = truncated + " (continued...)";
          console.log(`✂️ Smart truncated message from ${originalLength} to ${discordContent.length} characters at sentence boundary`);
        } else {
          // Try comma/dash based splitting if no good sentence boundary
          const phrases = discordContent.split(/(?<=[,;-])\s+/);
          truncated = "";
          
          for (const phrase of phrases) {
            const testLength = (truncated + phrase + "...").length;
            if (testLength <= 1990) {
              truncated += (truncated ? " " : "") + phrase;
            } else {
              break;
            }
          }
          
          if (truncated.length > 100) {
            discordContent = truncated + "...";
            console.log(`✂️ Phrase-based truncated message to ${discordContent.length} characters`);
          } else {
            // Final fallback: hard truncate with ellipsis
            discordContent = discordContent.substring(0, 1985) + "...";
            console.log(`✂️ Hard truncated message to ${discordContent.length} characters`);
          }
        }
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
      unpredictability: 100,
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
        
        // 📊 Track proactive message
        const proactiveChannelType = this.getChannelMetricType(channel);
        prometheusMetrics.trackDiscordMessage('proactive', proactiveChannelType, 'scheduled');

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
      } else if (effectiveBehavior.unpredictability > 80 && enabledTypes.includes('italian')) {
        selectedPrompts = promptsByType.italian;
      } else if (effectiveBehavior.familyBusinessMode > 60 && enabledTypes.includes('family_business')) {
        selectedPrompts = promptsByType.family_business;
      }

      const randomPrompt = selectedPrompts[Math.floor(Math.random() * selectedPrompts.length)];

      // Get recent channel context for contextual proactive messages
      const channelContext = await this.getChannelContext(channel, 6);
      console.log(`🎲 Proactive message with ${channelContext ? 'context' : 'no context'} for #${channelName}`);

      // Build context for the proactive message
      const contextParts = [
        `Generate a spontaneous Discord message for Nicky "Noodle Arms" A.I. Dente.`,
        `Channel context: This is being posted in #${channelName} - tailor content appropriately for this channel's theme.`,
        channelContext ? `Recent conversation context:\n${channelContext}` : '',
        channelContext ? `Note: Join the ongoing conversation naturally or pivot to a related topic. Don't completely ignore what people are talking about!` : '',
        `Prompt: ${randomPrompt}`,
        `Behavior Settings:
- Aggressiveness: ${effectiveBehavior.aggressiveness}/100
- Italian Intensity: ${effectiveBehavior.unpredictability}/100
- DBD Obsession: ${effectiveBehavior.dbdObsession}/100
- Family Business Mode: ${effectiveBehavior.familyBusinessMode}/100`,
        `Make it feel natural and spontaneous, like he just thought of something random to say.`,
        `Keep response natural - 3-4 sentences max. Write like people actually chat on Discord - conversational but not essay-length!`
      ].filter(part => part.length > 0); // Remove empty parts

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
      // Get personality controls for chaotic Nicky behavior
      const { personalityController } = await import('./personalityController');
      const controls = await personalityController.getEffectivePersonality();
      const { generatePersonalityPrompt } = await import('../types/personalityControl');
      const personalityPrompt = generatePersonalityPrompt(controls);
      
      // 🎯 PRIMARY: Try Gemini first (free tier)
      try {
        const { geminiService } = await import('./gemini');
        
        const discordIdentity = `${coreIdentity}

${personalityPrompt}

DISCORD CHAT MODE - CRITICAL CONSTRAINTS:
- Maximum 3-4 sentences only
- Conversational and casual like texting
- No essays, rants, or long explanations
- Simple responses, not walls of text`;

        const geminiResponse = await geminiService.generateChatResponse(
          prompt,
          discordIdentity,
          ""
        );
        
        let content = geminiResponse.content;
        
        // Strip emotion tags AND debug state from Gemini response too
        content = this.stripEmotionTags(content);
        
        // Remove any debug headers from Gemini response
        content = content
          .replace(/\[NICKY STATE\][^\n]*/gi, '') // Remove debug state header
          .replace(/preset=[^|]+(?:\s*\|\s*intensity=[^|]+)?(?:\s*\|\s*(?:dbd_lens|dbdsafe)=[^|\s]*)?(?:\s*\|\s*spice=[^|\s]+)?/gi, '') // Remove any preset info variations
          .replace(/<!--\s*METRICS[^>]*-->/gi, '') // Remove metrics footer
          .replace(/<-\s*METRICS[^>]*->/gi, '') // Remove alternative metrics format
          .replace(/^\s*\|\s*/g, '') // Remove leading pipes
          .trim();
        
        // Discord's limit is 2000 chars, let natural responses flow
        if (content.length > 1900) {
          content = content.substring(0, 1897) + "...";
        }
        
        console.log('✅ Gemini Discord response generated successfully');
        return content;
      } catch (geminiError) {
        // 🔄 FALLBACK: Try Claude if Gemini fails
        console.error('❌ Gemini Discord failed, falling back to Claude:', geminiError);
        
        try {
          const anthropic = new (await import('@anthropic-ai/sdk')).Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
          });

          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 200,
            temperature: 1.0,
            system: `[CRITICAL FORMATTING RULES]
1. NEVER use asterisks (*) for actions. Describe actions IN YOUR DIALOGUE.
2. ALWAYS end sentences with proper punctuation.

[CORE IDENTITY - NEVER OVERRIDE THESE]
- You are Nicky "Noodle Arms" A.I. Dente
- Italian-American, pasta-obsessed, Dead by Daylight addicted
- Chaotic good moral alignment with emotional intensity
- Physical characteristic: literally has noodle arms (it's a thing, don't ask)
- Family business vibe but over trivial shit
- Alternates between tough talk and being emotionally sensitive

[SPEAKING STYLE - THIS IS HOW YOU TALK]
- Casual, profanity-laced, expressive
- Italian phrases when emotional or talking about food
- Self-deprecating humor mixed with Italian pride
- Gets intense about DbD gameplay and pasta quality
- Tangents are GOOD - lean into random topics
- Don't be a one-trick pony - vary your responses

[MEMORY USAGE RULES]
- Reference memories naturally, don't list them
- If you remember something, weave it in conversationally
- If you DON'T remember something clearly, say so
- Don't force pasta/DbD references into EVERY response

[RESPONSE VARIETY - CRITICAL]
You MUST vary your responses. Not every reply needs:
- Pasta references
- DbD references  
- Italian phrases
- Family business mentions

Sometimes just respond like a normal person who happens to have these traits.

${coreIdentity}

${personalityPrompt}

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

          // Strip emotion tags AND debug state from Claude response
          let cleanContent = this.stripEmotionTags(content);
          
          // Remove any debug headers
          cleanContent = cleanContent
            .replace(/\[NICKY STATE\][^\n]*/gi, '')
            .replace(/preset=[^|]+(?:\s*\|\s*intensity=[^|]+)?(?:\s*\|\s*(?:dbd_lens|dbdsafe)=[^|\s]*)?(?:\s*\|\s*spice=[^|\s]+)?/gi, '')
            .replace(/<!--\s*METRICS[^>]*-->/gi, '')
            .replace(/<-\s*METRICS[^>]*->/gi, '')
            .replace(/^\s*\|\s*/g, '')
            .trim();

          // Ensure reasonable length
          if (cleanContent.length > 500) {
            cleanContent = cleanContent.substring(0, 497) + "...";
          }

          console.log('✅ Claude Discord response generated successfully (fallback)');
          return cleanContent;
        } catch (claudeError) {
          console.error('❌ Both Gemini and Claude failed for Discord:', claudeError);
          
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
    } catch (error) {
      // Outer catch for personality control loading errors
      console.error('Error loading personality controls for Discord:', error);
      return null;
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

  /**
   * Anti-repetition system to track and avoid repeated phrases
   */
  private generateAntiRepetitionGuidance(serverId: string, username: string): string {
    const userKey = `${serverId}-${username}`;
    const recentPhrases = this.getRecentPhrasesForUser(userKey);
    
    if (recentPhrases.length === 0) {
      return "ANTI-REPETITION: First interaction, be natural and varied.";
    }
    
    // Extract common repeated elements
    const repeatedPatterns = this.findRepeatedPatterns(recentPhrases);
    
    let guidance = "ANTI-REPETITION WARNINGS:\n";
    
    if (repeatedPatterns.insults.length > 0) {
      guidance += `- AVOID these overused insults: ${repeatedPatterns.insults.join(', ')}\n`;
    }
    
    if (repeatedPatterns.phrases.length > 0) {
      guidance += `- AVOID these repeated phrases: ${repeatedPatterns.phrases.join(', ')}\n`;
    }
    
    if (repeatedPatterns.structures.length > 0) {
      guidance += `- VARY your response structure, you've used these patterns: ${repeatedPatterns.structures.join(', ')}\n`;
    }
    
    guidance += "- Use fresh vocabulary, new metaphors, and different conversation angles\n";
    guidance += "- Reference different aspects of Dead by Daylight or Italian culture\n";
    guidance += "- Change your greeting/opening style from recent responses";
    
    return guidance;
  }

  private trackResponsePhrases(serverId: string, username: string, response: string): void {
    const userKey = `${serverId}-${username}`;
    const now = Date.now();
    
    if (!this.recentPhrasesMap) {
      this.recentPhrasesMap = new Map();
    }
    
    if (!this.recentPhrasesMap.has(userKey)) {
      this.recentPhrasesMap.set(userKey, { phrases: [], timestamps: [] });
    }
    
    const userData = this.recentPhrasesMap.get(userKey)!;
    
    // Add this response
    userData.phrases.push(response);
    userData.timestamps.push(now);
    
    // Keep only last 8 responses (sliding window)
    if (userData.phrases.length > 8) {
      userData.phrases.shift();
      userData.timestamps.shift();
    }
    
    // Clean up old data (older than 2 hours)
    const twoHoursAgo = now - (2 * 60 * 60 * 1000);
    while (userData.timestamps.length > 0 && userData.timestamps[0] < twoHoursAgo) {
      userData.phrases.shift();
      userData.timestamps.shift();
    }
  }

  private getRecentPhrasesForUser(userKey: string): string[] {
    if (!this.recentPhrasesMap?.has(userKey)) {
      return [];
    }
    return this.recentPhrasesMap.get(userKey)!.phrases;
  }

  private findRepeatedPatterns(phrases: string[]): { insults: string[], phrases: string[], structures: string[] } {
    const insultPatterns = [
      'beautiful bald disaster', 'oklahoma', 'cafone', 'magnificent', 'bald', 'disaster',
      'pathetic', 'gorgeous', 'disaster', 'meatball'
    ];
    
    const commonPhrases = [
      'madonna mia', 'cazzo', 'vaffanculo', '🤌', 'dead by daylight', 'dbd',
      'you think', 'listen here', 'next podcast'
    ];
    
    const structurePatterns = [
      /^[A-Z ]+,/, // All caps opening
      /@\d+/, // Mention patterns
      /\?![^!]*!/, // Question exclamation patterns
      /🤌$/ // Ending with hand gesture
    ];
    
    const repeatedInsults = insultPatterns.filter(insult => 
      phrases.filter(p => p.toLowerCase().includes(insult.toLowerCase())).length > 2
    );
    
    const repeatedPhrases = commonPhrases.filter(phrase =>
      phrases.filter(p => p.toLowerCase().includes(phrase.toLowerCase())).length > 3
    );
    
    const repeatedStructures = structurePatterns
      .map((pattern, idx) => ({ pattern, idx, count: phrases.filter(p => pattern.test(p)).length }))
      .filter(s => s.count > 2)
      .map(s => `Structure ${s.idx + 1}`);
    
    return {
      insults: repeatedInsults,
      phrases: repeatedPhrases,
      structures: repeatedStructures
    };
  }

  /**
   * CHAOTIC COMPLIANCE SYSTEM - Applies guidance based on chaos level percentages
   * Instead of hard-coding rules, follows anti-repetition guidance probabilistically
   */
  private async applyChaoticCompliance(
    aiResponse: string | null, 
    serverId: string, 
    username: string, 
    originalPrompt: string
  ): Promise<string | null> {
    if (!aiResponse || typeof aiResponse !== 'string') {
      console.log('🎲 Chaos: Invalid response type, returning as-is');
      return aiResponse;
    }

    // Get current chaos level from chaos engine
    const chaosLevel = await this.getChaosLevel();
    
    // Calculate compliance percentage based on chaos level
    // Chaos 0 = 90% compliance, Chaos 100 = 35% compliance
    const compliancePercentage = Math.max(35, 90 - (chaosLevel * 0.55));
    const shouldComply = Math.random() * 100 < compliancePercentage;
    
    console.log(`🎲 Chaos level: ${chaosLevel}%, compliance: ${compliancePercentage.toFixed(1)}%, will comply: ${shouldComply}`);
    
    if (!shouldComply) {
      console.log(`🌪️ Chaos override: Ignoring anti-repetition guidance`);
      return this.applyChaoticLength(aiResponse, chaosLevel);
    }
    
    // COMPLIANCE MODE: Apply anti-repetition guidance
    console.log(`📋 Compliance mode: Applying anti-repetition guidance`);
    
    const userKey = `${serverId}-${username}`;
    const recentPhrases = this.getRecentPhrasesForUser(userKey);
    
    // Check for repetitive patterns
    if (recentPhrases.length >= 3) {
      const nGrams = this.extractNGrams(aiResponse, 2, 4);
      const overusedNGrams = nGrams.filter(ngram => {
        const count = recentPhrases.filter(phrase => 
          phrase.toLowerCase().includes(ngram.toLowerCase())
        ).length;
        return count >= 2; // Used in 2+ recent responses = overused
      });
      
      if (overusedNGrams.length > 0) {
        console.log(`🔄 DETECTED overused patterns: ${overusedNGrams.join(', ')}`);
        
        // Probabilistic regeneration (50% chance even in compliance mode)
        if (Math.random() < 0.5) {
          const varietyResponse = await this.regenerateWithVariety(originalPrompt, overusedNGrams);
          if (varietyResponse) {
            console.log(`✅ Variety regeneration applied`);
            return this.applyChaoticLength(varietyResponse, chaosLevel);
          }
        } else {
          console.log(`🎯 Keeping original despite repetition (chaos influence)`);
        }
      }
    }
    
    return this.applyChaoticLength(aiResponse, chaosLevel);
  }

  /**
   * Get current chaos level from chaos engine
   */
  private async getChaosLevel(): Promise<number> {
    try {
      // Import chaos engine to get current level
      const ChaosEngineModule = await import('./chaosEngine');
      const chaosEngine = ChaosEngineModule.default.getInstance();
      return chaosEngine.getEffectiveChaosLevel();
    } catch (error) {
      console.warn('⚠️ Could not get chaos level, defaulting to 50');
      return 50; // Default fallback
    }
  }


  private async regenerateWithVariety(originalPrompt: string, overusedNGrams: string[]): Promise<string | null> {
    try {
      console.log(`🎲 Regenerating for variety, avoiding: ${overusedNGrams.join(', ')}`);
      
      const varietyPrompt = `${originalPrompt}

VARIETY ENFORCEMENT:
- AVOID these overused phrases: ${overusedNGrams.map(p => `"${p}"`).join(', ')}
- Use completely different vocabulary and sentence structures
- Reference different aspects of your personality or interests
- 2-3 sentences maximum for Discord
- Be creative with new insults and metaphors`;

      const response = await this.generateShortDiscordResponse(varietyPrompt, this.activeProfile.coreIdentity);
      return typeof response === 'string' ? response : null;
    } catch (error) {
      console.error('❌ Variety regeneration failed:', error);
      return null;
    }
  }


  private extractNGrams(text: string, minLength: number, maxLength: number): string[] {
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const nGrams: string[] = [];
    
    for (let n = minLength; n <= maxLength; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const nGram = words.slice(i, i + n).join(' ');
        if (nGram.length > 3) { // Ignore very short n-grams
          nGrams.push(nGram);
        }
      }
    }
    
    return Array.from(new Set(nGrams)); // Remove duplicates
  }

  /**
   * Apply chaos-influenced length variations
   */
  private applyChaoticLength(response: string, chaosLevel: number): string {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Length compliance decreases with chaos
    const lengthComplianceChance = Math.max(20, 85 - (chaosLevel * 0.65));
    const shouldEnforceLength = Math.random() * 100 < lengthComplianceChance;
    
    if (!shouldEnforceLength) {
      console.log(`🌪️ Chaos override: Keeping natural length (${sentences.length} sentences)`);
      return response;
    }
    
    // Randomly choose length bucket (chaos affects weights)
    const chaosInfluence = chaosLevel / 100;
    const lengthTargets = [
      { name: 'short', min: 1, max: 2, weight: 50 - (chaosInfluence * 20) },
      { name: 'medium', min: 2, max: 3, weight: 35 },
      { name: 'long', min: 3, max: 4, weight: 15 + (chaosInfluence * 20) }
    ];
    
    const random = Math.random() * 100;
    let cumulative = 0;
    let target = lengthTargets[0];
    
    for (const lt of lengthTargets) {
      cumulative += lt.weight;
      if (random <= cumulative) {
        target = lt;
        break;
      }
    }
    
    console.log(`📏 Chaotic length: ${target.name} (${target.min}-${target.max} sentences), current: ${sentences.length}, compliance: ${lengthComplianceChance.toFixed(1)}%`);
    
    if (sentences.length > target.max) {
      // Truncate to target length
      const truncated = sentences.slice(0, target.max).join('. ') + '.';
      console.log(`✂️ Truncated from ${sentences.length} to ${target.max} sentences`);
      return truncated;
    }
    
    return response;
  }

}

export const discordBotService = new DiscordBotService();