import { Client, GatewayIntentBits, Message, Events, TextChannel } from 'discord.js';
import { storage } from '../storage';
import { anthropicService } from './anthropic';
import type { DiscordServer, DiscordMember, DiscordTopicTrigger } from '@shared/schema';

export class DiscordBotService {
  private client: Client;
  private isConnected: boolean = false;
  private activeProfile: any = null;

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
      // Get or create server record
      let discordServer = await storage.getDiscordServer(message.guild.id);
      if (!discordServer) {
        discordServer = await this.createServerRecord(message.guild.id, message.guild.name);
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
        
        if (response) {
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
    
    // Always respond when mentioned
    if (message.mentions.has(this.client.user!)) {
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

      // Adjust personality based on effective behavior settings (dynamic)
      let personalityAdjustments = '';
      if (effectiveBehavior.aggressiveness > 70) {
        personalityAdjustments += 'Be more aggressive and confrontational. ';
      }
      if (effectiveBehavior.italianIntensity > 80) {
        personalityAdjustments += 'Use more Italian expressions and dramatic gestures. ';
      }
      if (effectiveBehavior.dbdObsession > 70) {
        personalityAdjustments += 'Relate topics back to Dead by Daylight when possible. ';
      }
      if (effectiveBehavior.familyBusinessMode > 60) {
        personalityAdjustments += 'Reference family business and mafia terminology more often. ';
      }
      
      // Add dynamic behavior context
      if (effectiveBehavior.driftFactors) {
        contextParts.push(`Dynamic Behavior Factors:
- Time of Day Influence: ${effectiveBehavior.driftFactors.timeOfDay > 0 ? 'Boosted' : effectiveBehavior.driftFactors.timeOfDay < 0 ? 'Dampened' : 'Normal'}
- Recent Activity Impact: ${effectiveBehavior.driftFactors.recentActivity > 0 ? 'Heightened' : effectiveBehavior.driftFactors.recentActivity < 0 ? 'Calmed' : 'Stable'}
- Chaos Mode Active: ${effectiveBehavior.driftFactors.chaosMultiplier > 1 ? 'Amplified' : effectiveBehavior.driftFactors.chaosMultiplier < 1 ? 'Suppressed' : 'Baseline'}`);
      }

      // Use existing AI service to generate response with Discord context
      const prompt = `${fullContext}

${personalityAdjustments}

You are responding in a Discord server called "${server.serverName}". The Discord user "${member.username}" ${member.nickname ? `(nicknamed "${member.nickname}")` : ''} said: "${message.content}"

IMPORTANT CONTEXT:
- You are NOT talking to your main profile owner/user - you are talking to "${member.username}", a Discord server member
- This is a different person than your usual conversations
- Address them as a Discord chatter, not as your owner
- You can be direct and conversational with Discord users
- Treat this as a separate conversation from your main chat sessions

IMPORTANT: Do NOT use emotion tags, action descriptions, or stage directions in your response. No *laughs*, *sighs*, *rolls eyes*, (grins), [smiles], or any similar formatting. Write only direct conversational text.

Keep response under 2000 characters for Discord. Be conversational and natural.`;

      // Get relevant memories for context
      const relevantMemories = await storage.searchMemoryEntries(this.activeProfile.id, message.content);
      
      console.log(`🤖 Calling anthropicService.generateResponse...`);
      const aiResponse = await anthropicService.generateResponse(
        prompt,
        this.activeProfile.coreIdentity,
        relevantMemories,
        [], // No documents for now
        fullContext
      );
      console.log(`✅ Got AI response, processing...`);

      // Extract response content from AI response object
      console.log(`🔍 AI Response type: ${typeof aiResponse}, structure:`, JSON.stringify(aiResponse, null, 2));
      const content = typeof aiResponse === 'string' ? aiResponse : aiResponse.content || String(aiResponse);
      console.log(`🔍 Extracted content: "${content}"`);

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

    // Check for proactive message opportunity every 2-5 minutes
    this.proactiveMessageTimer = setInterval(async () => {
      await this.considerProactiveMessage();
    }, Math.random() * 180000 + 120000); // 2-5 minutes randomly

    console.log('🎲 Started proactive messaging system');
  }

  private async considerProactiveMessage(): Promise<void> {
    try {
      if (!this.activeProfile) return;

      // Get all active servers
      const servers = await storage.getProfileDiscordServers(this.activeProfile.id);
      const activeServers = servers.filter(s => s.isActive);
      if (activeServers.length === 0) return;

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

      // Generate a proactive message with server's enabled message types
      const proactiveMessage = await this.generateProactiveMessage(server, effectiveBehavior);
      if (proactiveMessage) {
        console.log(`🎲 Sending proactive message to ${guild.name}: ${proactiveMessage.substring(0, 50)}...`);
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

  private async generateProactiveMessage(server: any, effectiveBehavior: any): Promise<string | null> {
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

      // Pick prompt based on behavior settings and enabled types
      let selectedPrompts = [...availablePrompts];
      
      if (effectiveBehavior.dbdObsession > 70 && enabledTypes.includes('dbd')) {
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
        `Prompt: ${randomPrompt}`,
        `Behavior Settings:
- Aggressiveness: ${effectiveBehavior.aggressiveness}/100
- Italian Intensity: ${effectiveBehavior.italianIntensity}/100
- DBD Obsession: ${effectiveBehavior.dbdObsession}/100
- Family Business Mode: ${effectiveBehavior.familyBusinessMode}/100`,
        `Make it feel natural and spontaneous, like he just thought of something random to say.`,
        `Keep it under 200 characters. Be true to his personality.`
      ];

      const fullContext = contextParts.join('\n\n');

      // Generate the response using existing AI service
      const { anthropicService } = await import('./anthropic');
      const response = await anthropicService.generateResponse(fullContext, this.activeProfile);

      return response?.message || null;
    } catch (error) {
      console.error('Error generating proactive message:', error);
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
    const channelArray = Array.from(eligibleChannels.values());
    return channelArray[Math.floor(Math.random() * channelArray.length)];
  }

  // Start proactive messaging when a server is added
  private initializeProactiveMessaging(): void {
    this.startProactiveMessaging();
  }
}

export const discordBotService = new DiscordBotService();