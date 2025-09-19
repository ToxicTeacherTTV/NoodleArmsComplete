import snoowrap from 'snoowrap';
import { storage } from '../../storage';
import { eq } from 'drizzle-orm';
import { pendingContent } from '@shared/schema';

export class RedditService {
  private reddit: any;
  
  constructor() {
    this.reddit = new snoowrap({
      userAgent: 'DbD-Content-Bot/1.0.0',
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
      username: process.env.REDDIT_USERNAME!,
      password: process.env.REDDIT_PASSWORD!,
    });
  }

  private readonly DBD_KEYWORDS = [
    'dead by daylight', 'dbd', 'killer', 'survivor', 'perk', 'bloodweb',
    'entity', 'fog', 'generator', 'hook', 'trial', 'offering', 'addon',
    'behavior', 'bhvr', 'meta', 'nerf', 'buff', 'patch', 'ptb'
  ];

  // Community discussion keywords for more diverse content
  private readonly COMMUNITY_KEYWORDS = [
    'toxic', 'camping', 'tunneling', 'gen rush', 'survivor main', 'killer main',
    'swf', 'solo queue', 'mmr', 'matchmaking', 'rage quit', 'dc', 'disconnect',
    'tier list', 'op', 'overpowered', 'unfair', 'broken', 'balanced',
    'otzdarva', 'spookyloops', 'ayrun', 'dowsey', 'puppers', 'streamer',
    'meme', 'shitpost', 'opinion', 'unpopular opinion', 'controversial',
    'discussion', 'rant', 'suggestion', 'idea', 'fix', 'rework'
  ];

  private isDbDRelevant(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.DBD_KEYWORDS.some(keyword => lowerText.includes(keyword)) ||
           this.COMMUNITY_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }

  private getContentType(post: any): string {
    const title = post.title.toLowerCase();
    const flair = (post.link_flair_text || '').toLowerCase();
    
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
    try {
      console.log('🔍 Starting enhanced Reddit content collection...');
      
      const subreddit = this.reddit.getSubreddit('deadbydaylight');
      let totalCollected = 0;
      
      // Collection strategy: diverse content types for better community coverage
      const collections = [
        { type: 'hot', posts: await subreddit.getHot({ limit: 15 }), minScore: 100 },
        { type: 'controversial', posts: await subreddit.getControversial({ time: 'day', limit: 10 }), minScore: 25 },
        { type: 'rising', posts: await subreddit.getRising({ limit: 8 }), minScore: 20 },
        { type: 'top', posts: await subreddit.getTop({ time: 'day', limit: 7 }), minScore: 200 }
      ];
      
      for (const collection of collections) {
        console.log(`🔍 Processing ${collection.type} posts...`);
        let collectionCount = 0;
        
        for (const post of collection.posts) {
          // Enhanced quality filters
          if (post.score < collection.minScore) continue;
          if (post.over_18) continue; // Skip NSFW
          if (post.stickied) continue; // Skip pinned posts
          if (!this.isDbDRelevant(post.title + (post.selftext || ''))) continue;
          
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
          const contentType = this.getContentType(post);

          // Create pending content with enhanced metadata
          await storage.createPendingContent({
            sourceId,
            profileId,
            rawContent: `REDDIT ${collection.type.toUpperCase()}: ${post.title}\n\nContent Type: ${contentType}\n\n${post.selftext || 'Link/Image post - no text content'}\n\nTop Comments:\n${topComments}`,
            title: `[${collection.type}] ${post.title}`,
            sourceUrl: postUrl,
            metadata: {
              upvotes: post.score,
              author: post.author.name,
              created: post.created_utc,
              subreddit: post.subreddit_name_prefixed,
              flair: post.link_flair_text,
              contentType: contentType,
              collectionType: collection.type,
              upvoteRatio: post.upvote_ratio || 0.5,
              numComments: post.num_comments || 0
            }
          });
          
          collectionCount++;
          totalCollected++;
          console.log(`✅ Collected [${collection.type}] ${contentType}: "${post.title}" (${post.score} upvotes)`);
        }
        
        console.log(`📊 ${collection.type}: ${collectionCount} posts collected`);
      }
      
      console.log(`✅ Reddit: Enhanced collection complete - ${totalCollected} diverse posts collected`);
      return totalCollected;
      
    } catch (error) {
      console.error('❌ Enhanced Reddit collection failed:', error);
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