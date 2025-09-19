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

  private isDbDRelevant(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.DBD_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }

  async collectContent(sourceId: string, profileId: string): Promise<number> {
    try {
      console.log('🔍 Starting Reddit content collection...');
      
      // Get hot posts from r/deadbydaylight
      const hotPosts = await this.reddit.getSubreddit('deadbydaylight').getHot({ limit: 25 });
      
      let contentCollected = 0;
      
      for (const post of hotPosts) {
        // Quality filters
        if (post.score < 50) continue; // Minimum upvotes
        if (post.over_18) continue; // Skip NSFW
        if (!this.isDbDRelevant(post.title + (post.selftext || ''))) continue;
        
        const postUrl = `https://reddit.com${post.permalink}`;
        
        // Check if we already processed this post
        const existingContent = await storage.db
          .select()
          .from(pendingContent)
          .where(eq(pendingContent.sourceUrl, postUrl))
          .limit(1);
          
        if (existingContent.length > 0) continue;

        // Get top comments for context
        const topComments = await this.getTopComments(post);

        // Create pending content entry
        await storage.createPendingContent({
          sourceId,
          profileId,
          rawContent: `REDDIT POST: ${post.title}\n\n${post.selftext || 'Link post - no text content'}\n\nComments summary: ${topComments}`,
          title: post.title,
          sourceUrl: postUrl,
          metadata: {
            upvotes: post.score,
            author: post.author.name,
            created: post.created_utc,
            subreddit: post.subreddit_name_prefixed,
            flair: post.link_flair_text
          }
        });
        
        contentCollected++;
        console.log(`✅ Collected DbD post: "${post.title}" (${post.score} upvotes)`);
      }
      
      console.log(`✅ Reddit: Collected ${contentCollected} new DbD posts`);
      return contentCollected;
      
    } catch (error) {
      console.error('❌ Reddit collection failed:', error);
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