import { Client, GatewayIntentBits, Message, Events } from 'discord.js';
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

    // Random response based on server responsiveness setting
    const randomChance = Math.random() * 100;
    if (randomChance <= ((server.responsiveness || 60) * 0.1)) { // Scale down responsiveness for random responses
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

    return { respond: false, triggerType: 'KEYWORD' };
  }

  private async generateResponse(
    message: Message,
    server: DiscordServer,
    member: DiscordMember,
    responseContext: any
  ): Promise<string | null> {
    try {
      // Build context for Nicky's response
      const contextParts = [];
      
      // Add server behavior settings
      contextParts.push(`Discord Server Behavior Settings:
- Aggressiveness: ${server.aggressiveness}/100
- Responsiveness: ${server.responsiveness}/100  
- Italian Intensity: ${server.italianIntensity}/100
- DBD Obsession: ${server.dbdObsession}/100
- Family Business Mode: ${server.familyBusinessMode}/100`);

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

      // Adjust personality based on behavior settings
      let personalityAdjustments = '';
      if ((server.aggressiveness || 80) > 70) {
        personalityAdjustments += 'Be more aggressive and confrontational. ';
      }
      if ((server.italianIntensity || 100) > 80) {
        personalityAdjustments += 'Use more Italian expressions and dramatic gestures. ';
      }
      if ((server.dbdObsession || 80) > 70) {
        personalityAdjustments += 'Relate topics back to Dead by Daylight when possible. ';
      }
      if ((server.familyBusinessMode || 40) > 60) {
        personalityAdjustments += 'Reference family business and mafia terminology more often. ';
      }

      // Use existing AI service to generate response with Discord context
      const prompt = `${fullContext}

${personalityAdjustments}

You are responding in a Discord server. The Discord user "${member.username}" ${member.nickname ? `(nicknamed "${member.nickname}")` : ''} said: "${message.content}"

Respond directly to ${member.username}. You are NOT talking to your main user/owner - you are talking to this Discord user specifically. Address them by name when appropriate.

IMPORTANT: Do NOT use emotion tags, action descriptions, or stage directions in your response. No *laughs*, *sighs*, *rolls eyes*, (grins), [smiles], or any similar formatting. Write only direct conversational text.

Keep response under 2000 characters for Discord. Be conversational and natural.`;

      // Get relevant memories for context
      const relevantMemories = await storage.searchMemoryEntries(this.activeProfile.id, message.content);
      
      const aiResponse = await anthropicService.generateResponse(
        prompt,
        this.activeProfile.coreIdentity,
        relevantMemories,
        [], // No documents for now
        fullContext
      );

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

      // If content is empty after filtering, provide a fallback
      if (!discordContent || discordContent.length < 3) {
        discordContent = "Hey there! What's up?";
      }

      console.log(`🎭 AGGRESSIVE Emotion filter: "${content.substring(0, 100)}..." → "${discordContent.substring(0, 100)}..."`);

      // Enforce Discord's 2000 character limit
      if (discordContent.length > 1900) {
        discordContent = discordContent.substring(0, 1900) + "...";
      }

      // TEMPORARY TEST: Force add signature to confirm filter is working
      discordContent = `${discordContent} [EMOTION-FILTER-ACTIVE]`;

      return discordContent;
    } catch (error) {
      console.error('❌ Error generating Discord response:', error);
      return "Madonna mia! Something went wrong in my head... give me a second! 🤯";
    }
  }

  private async createServerRecord(serverId: string, serverName: string): Promise<DiscordServer> {
    console.log(`📝 Creating new Discord server record: ${serverName} (${serverId})`);
    
    return await storage.createDiscordServer({
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
}

export const discordBotService = new DiscordBotService();