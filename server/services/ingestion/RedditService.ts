import snoowrap from 'snoowrap';
import { storage } from '../../storage';
import { eq } from 'drizzle-orm';
import { pendingContent } from '@shared/schema';

interface SubredditConfig {
  name: string;
  segment: 'dbd_content' | 'nnn_news' | 'word_from_don';
  category: string;
  minScore: number;
  limits: {
    hot: number;
    controversial: number;
    rising: number;
    top: number;
  };
}

export class RedditService {
  private reddit: any;
  
  constructor() {
    if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET && process.env.REDDIT_USERNAME && process.env.REDDIT_PASSWORD) {
      this.reddit = new snoowrap({
        userAgent: 'Nicky-AI-Content-Bot/2.0.0',
        clientId: process.env.REDDIT_CLIENT_ID,
        clientSecret: process.env.REDDIT_CLIENT_SECRET,
        username: process.env.REDDIT_USERNAME,
        password: process.env.REDDIT_PASSWORD,
      });
    } else {
      console.warn('⚠️ Reddit credentials missing. Reddit ingestion will be disabled.');
    }
  }

  // 🎮 Dead by Daylight Keywords
  private readonly DBD_KEYWORDS = [
    'dead by daylight', 'dbd', 'killer', 'survivor', 'perk', 'bloodweb',
    'entity', 'fog', 'generator', 'hook', 'trial', 'offering', 'addon',
    'behavior', 'bhvr', 'meta', 'nerf', 'buff', 'patch', 'ptb'
  ];

  private readonly COMMUNITY_KEYWORDS = [
    'toxic', 'camping', 'tunneling', 'gen rush', 'survivor main', 'killer main',
    'swf', 'solo queue', 'mmr', 'matchmaking', 'rage quit', 'dc', 'disconnect',
    'tier list', 'op', 'overpowered', 'unfair', 'broken', 'balanced',
    'otzdarva', 'spookyloops', 'ayrun', 'dowsey', 'puppers', 'streamer',
    'meme', 'shitpost', 'opinion', 'unpopular opinion', 'controversial',
    'discussion', 'rant', 'suggestion', 'idea', 'fix', 'rework'
  ];

  // 📺 NNN Weird News Keywords
  private readonly WEIRD_NEWS_KEYWORDS = [
    'florida man', 'bizarre', 'strange', 'unusual', 'absurd', 'weird', 'odd',
    'arrested for', 'caught', 'police', 'wtf', 'ridiculous', 'insane', 'crazy',
    'unbelievable', 'shocking', 'unexpected', 'mysterious', 'unprecedented',
    'scientist', 'study', 'discovery', 'government', 'mayor', 'official',
    'breaking', 'urgent', 'alert', 'just in', 'developing', 'exclusive'
  ];

  // 🤷 Advice Content Keywords  
  private readonly ADVICE_KEYWORDS = [
    'boyfriend', 'girlfriend', 'husband', 'wife', 'family', 'work', 'job',
    'roommate', 'neighbor', 'friend', 'wedding', 'money', 'inheritance',
    'cheating', 'lying', 'drama', 'argument', 'fight', 'relationship',
    'aita', 'am i the asshole', 'advice', 'help', 'what should i do',
    'problem', 'situation', 'conflict', 'issue', 'awkward', 'uncomfortable',
    'boss', 'coworker', 'debt', 'financial', 'legal', 'lawyer', 'sue'
  ];

  // 🎯 Subreddit Configuration
  private readonly SUBREDDIT_CONFIGS: SubredditConfig[] = [
    // Dead by Daylight Content
    {
      name: 'deadbydaylight',
      segment: 'dbd_content', 
      category: 'gaming_community',
      minScore: 100,
      limits: { hot: 15, controversial: 10, rising: 8, top: 7 }
    },
    // NNN Weird News Sources
    {
      name: 'nottheonion',
      segment: 'nnn_news',
      category: 'weird_news',
      minScore: 500,
      limits: { hot: 12, controversial: 8, rising: 6, top: 5 }
    },
    {
      name: 'FloridaMan', 
      segment: 'nnn_news',
      category: 'florida_chaos',
      minScore: 200,
      limits: { hot: 10, controversial: 6, rising: 4, top: 4 }
    },
    {
      name: 'todayilearned',
      segment: 'nnn_news', 
      category: 'random_facts',
      minScore: 1000,
      limits: { hot: 8, controversial: 4, rising: 3, top: 3 }
    },
    {
      name: 'mildlyinteresting',
      segment: 'nnn_news',
      category: 'mundane_weird', 
      minScore: 300,
      limits: { hot: 6, controversial: 4, rising: 3, top: 2 }
    },
    // Word from the Don Advice Sources
    {
      name: 'AmItheAsshole',
      segment: 'word_from_don',
      category: 'relationship_warfare',
      minScore: 200, 
      limits: { hot: 10, controversial: 8, rising: 5, top: 4 }
    },
    {
      name: 'relationship_advice',
      segment: 'word_from_don',
      category: 'romantic_conspiracy', 
      minScore: 150,
      limits: { hot: 8, controversial: 6, rising: 4, top: 3 }
    },
    {
      name: 'legaladvice',
      segment: 'word_from_don',
      category: 'illegal_solutions',
      minScore: 300,
      limits: { hot: 6, controversial: 4, rising: 3, top: 2 }
    },
    {
      name: 'personalfinance', 
      segment: 'word_from_don',
      category: 'criminal_finance',
      minScore: 100,
      limits: { hot: 5, controversial: 3, rising: 2, top: 2 }
    }
  ];

  private isContentRelevant(text: string, segment: string): boolean {
    const lowerText = text.toLowerCase();
    
    switch (segment) {
      case 'dbd_content':
        return this.DBD_KEYWORDS.some(keyword => lowerText.includes(keyword)) ||
               this.COMMUNITY_KEYWORDS.some(keyword => lowerText.includes(keyword));
      
      case 'nnn_news':
        return this.WEIRD_NEWS_KEYWORDS.some(keyword => lowerText.includes(keyword)) ||
               // For nottheonion/weird news, most content is relevant by nature of the subreddit
               segment === 'nnn_news';
      
      case 'word_from_don':
        return this.ADVICE_KEYWORDS.some(keyword => lowerText.includes(keyword)) ||
               // For advice subreddits, most content is relevant by nature
               segment === 'word_from_don';
      
      default:
        return false;
    }
  }

  private getContentType(post: any, segment: string, category: string): string {
    const title = post.title.toLowerCase();
    const flair = (post.link_flair_text || '').toLowerCase();
    
    // Segment-specific content typing
    if (segment === 'nnn_news') {
      if (title.includes('florida') || category === 'florida_chaos') return 'florida_gold';
      if (title.includes('arrested') || title.includes('police')) return 'crime_chaos';
      if (title.includes('scientist') || title.includes('study')) return 'fake_science';
      if (title.includes('government') || title.includes('politics')) return 'conspiracy_fuel';
      if (title.includes('til') || category === 'random_facts') return 'random_facts';
      return 'weird_news';
    }
    
    if (segment === 'word_from_don') {
      if (title.includes('aita') || flair.includes('asshole')) return 'aita_drama';
      if (title.includes('relationship') || title.includes('boyfriend') || title.includes('girlfriend')) return 'romantic_disaster';
      if (title.includes('work') || title.includes('job') || title.includes('boss')) return 'workplace_warfare';
      if (title.includes('money') || title.includes('debt') || title.includes('financial')) return 'criminal_finance';
      if (title.includes('legal') || title.includes('lawyer')) return 'illegal_solutions';
      return 'general_advice';
    }
    
    // Original DbD content typing
    if (flair.includes('discussion') || title.includes('discussion')) return 'discussion';
    if (flair.includes('meme') || title.includes('meme') || flair.includes('shitpost')) return 'meme';
    if (title.includes('opinion') || title.includes('unpopular')) return 'opinion';
    if (title.includes('rant') || title.includes('angry') || title.includes('frustrated')) return 'rant';
    if (title.includes('suggestion') || title.includes('idea') || title.includes('should')) return 'suggestion';
    if (flair.includes('news') || title.includes('patch') || title.includes('update')) return 'news';
    if (title.includes('tier list') || title.includes('ranking')) return 'tier_list';
    
    return 'general';
  }

  async collectContent(sourceId: string, profileId: string): Promise<number> {
    if (!this.reddit) {
      console.warn('⚠️ Reddit service not initialized (missing credentials). Skipping collection.');
      return 0;
    }

    try {
      console.log('🚀 Starting multi-subreddit content collection for NNN & Word from the Don...');
      
      let totalCollected = 0;
      
      // Process each configured subreddit
      for (const config of this.SUBREDDIT_CONFIGS) {
        console.log(`\n📡 Processing r/${config.name} for ${config.segment} (${config.category})`);
        
        try {
          const subreddit = this.reddit.getSubreddit(config.name);
          let subredditCollected = 0;
          
          // Collection strategy: diverse content types with subreddit-specific limits
          const collections = [
            { 
              type: 'hot', 
              posts: await subreddit.getHot({ limit: config.limits.hot }), 
              minScore: config.minScore 
            },
            { 
              type: 'controversial', 
              posts: await subreddit.getControversial({ time: 'day', limit: config.limits.controversial }), 
              minScore: Math.floor(config.minScore * 0.3) 
            },
            { 
              type: 'rising', 
              posts: await subreddit.getRising({ limit: config.limits.rising }), 
              minScore: Math.floor(config.minScore * 0.2) 
            },
            { 
              type: 'top', 
              posts: await subreddit.getTop({ time: 'day', limit: config.limits.top }), 
              minScore: Math.floor(config.minScore * 1.5) 
            }
          ];
          
          for (const collection of collections) {
            console.log(`  🔍 Processing ${collection.type} posts from r/${config.name}...`);
            let collectionCount = 0;
            
            for (const post of collection.posts) {
              // Enhanced quality filters
              if (post.score < collection.minScore) continue;
              if (post.over_18) continue; // Skip NSFW
              if (post.stickied) continue; // Skip pinned posts
              
              // Content relevance check based on segment
              const postText = post.title + ' ' + (post.selftext || '');
              if (!this.isContentRelevant(postText, config.segment)) continue;
              
              const postUrl = `https://reddit.com${post.permalink}`;
              
              // Check if already processed
              const existingContent = await storage.db
                .select()
                .from(pendingContent)
                .where(eq(pendingContent.sourceUrl, postUrl))
                .limit(1);
                
              if (existingContent.length > 0) continue;

              // Get enhanced context
              const topComments = await this.getTopComments(post);
              const contentType = this.getContentType(post, config.segment, config.category);

              // Create segment-specific content format
              let contentPrefix = '';
              if (config.segment === 'nnn_news') {
                contentPrefix = `🎬 NICKY NEWS NETWORK - ${contentType.toUpperCase()}`;
              } else if (config.segment === 'word_from_don') {
                contentPrefix = `🤷 WORD FROM THE DON - ${contentType.toUpperCase()}`;
              } else {
                contentPrefix = `🎮 DBD CONTENT - ${contentType.toUpperCase()}`;
              }

              // Create pending content with enhanced metadata
              await storage.createPendingContent({
                sourceId,
                profileId,
                rawContent: `${contentPrefix}\nSource: r/${config.name} (${collection.type})\n\nTitle: ${post.title}\n\nContent: ${post.selftext || 'Link/Image post - no text content'}\n\nTop Comments:\n${topComments}`,
                title: `[${config.segment}] ${post.title}`,
                sourceUrl: postUrl,
                metadata: {
                  upvotes: post.score,
                  author: post.author.name,
                  created: post.created_utc,
                  subreddit: post.subreddit_name_prefixed,
                  flair: post.link_flair_text,
                  contentType: contentType,
                  collectionType: collection.type,
                  segment: config.segment,
                  category: config.category,
                  upvoteRatio: post.upvote_ratio || 0.5,
                  numComments: post.num_comments || 0
                }
              });
              
              collectionCount++;
              subredditCollected++;
              totalCollected++;
              console.log(`    ✅ [${config.segment}] ${contentType}: "${post.title.substring(0, 60)}..." (${post.score} upvotes)`);
            }
            
            if (collectionCount > 0) {
              console.log(`    📊 ${collection.type}: ${collectionCount} posts collected`);
            }
          }
          
          console.log(`✅ r/${config.name}: ${subredditCollected} posts collected for ${config.segment}`);
          
        } catch (subredditError) {
          console.error(`❌ Failed to collect from r/${config.name}:`, subredditError);
          // Continue with other subreddits even if one fails
        }
      }
      
      console.log(`\n🎉 Multi-subreddit collection complete - ${totalCollected} total posts collected across all segments!`);
      return totalCollected;
      
    } catch (error) {
      console.error('❌ Multi-subreddit collection failed:', error);
      throw error;
    }
  }

  private async getTopComments(post: any): Promise<string> {
    try {
      await post.expandReplies({ limit: 5, depth: 1 });
      const topComments = post.comments
        .slice(0, 3)
        .map((comment: any) => `• ${comment.body.substring(0, 200)}...`)
        .join('\n');
      return topComments || 'No significant comments';
    } catch {
      return 'Comments unavailable';
    }
  }
}