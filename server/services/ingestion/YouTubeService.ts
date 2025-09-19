import { storage } from '../../storage';
import { eq } from 'drizzle-orm';
import { pendingContent } from '@shared/schema';

export class YouTubeService {
  private readonly API_KEY = process.env.YOUTUBE_API_KEY!;
  private readonly BASE_URL = 'https://www.googleapis.com/youtube/v3';
  
  // Top DBD Content Creators (channel IDs)
  private readonly DBD_CREATORS = [
    { name: 'Otzdarva', channelId: 'UCGBOkOOuSeVCmvmNXYZDj_g' },
    { name: 'SpookyLoops', channelId: 'UCBwP_3UYJJuXhJ6HgY_m6ng' },
    { name: 'Ayrun', channelId: 'UC5Vq5zPPKgOXpSRo7CjNZOg' },
    { name: 'Dowsey', channelId: 'UCOPvAvUjNJ-gy0DwfwDc0kA' },
    { name: 'Puppers', channelId: 'UCDKRqNy5MQPQ4DkJHnpWzxQ' }
  ];

  async collectContent(sourceId: string, profileId: string): Promise<number> {
    if (!this.API_KEY) {
      console.log('⚠️ YouTube API key not configured - skipping YouTube collection');
      return 0;
    }

    try {
      console.log('🔍 Starting YouTube content collection...');
      let totalCollected = 0;

      // Collect from each creator
      for (const creator of this.DBD_CREATORS.slice(0, 3)) { // Limit to 3 creators to manage quota
        console.log(`🎬 Processing ${creator.name}...`);
        
        try {
          const creatorCount = await this.collectFromCreator(creator, sourceId, profileId);
          totalCollected += creatorCount;
          
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ Failed to collect from ${creator.name}:`, error);
          continue; // Continue with other creators
        }
      }

      console.log(`✅ YouTube: Collected ${totalCollected} pieces of content`);
      return totalCollected;

    } catch (error) {
      console.error('❌ YouTube collection failed:', error);
      throw error;
    }
  }

  private async collectFromCreator(creator: { name: string; channelId: string }, sourceId: string, profileId: string): Promise<number> {
    let collected = 0;

    try {
      // Get recent videos (last 2-3 videos to manage quota)
      const videosResponse = await fetch(
        `${this.BASE_URL}/search?part=snippet&channelId=${creator.channelId}&maxResults=3&order=date&type=video&key=${this.API_KEY}`
      );

      if (!videosResponse.ok) {
        console.error(`YouTube API error: ${videosResponse.status}`);
        return 0;
      }

      const videosData = await videosResponse.json();
      
      if (!videosData.items?.length) {
        console.log(`No recent videos found for ${creator.name}`);
        return 0;
      }

      // Process each video
      for (const video of videosData.items) {
        if (!this.isDbDRelevant(video.snippet.title + video.snippet.description)) continue;

        // Get top comments for this video
        const comments = await this.getVideoComments(video.id.videoId);
        if (comments.length === 0) continue;

        // Create content entry
        const videoUrl = `https://youtube.com/watch?v=${video.id.videoId}`;
        
        // Check if already processed
        const existing = await storage.db
          .select()
          .from(pendingContent)
          .where(eq(pendingContent.sourceUrl, videoUrl))
          .limit(1);
          
        if (existing.length > 0) continue;

        const commentsText = comments
          .slice(0, 5) // Top 5 comments
          .map((comment: any, index: number) => 
            `${index + 1}. ${comment.snippet.topLevelComment.snippet.textDisplay} (${comment.snippet.topLevelComment.snippet.likeCount || 0} likes)`
          )
          .join('\n\n');

        await storage.createPendingContent({
          sourceId,
          profileId,
          rawContent: `YOUTUBE - ${creator.name}: ${video.snippet.title}\n\nVideo Description: ${video.snippet.description.substring(0, 200)}...\n\nTop Community Comments:\n${commentsText}`,
          title: `[YT] ${creator.name}: ${video.snippet.title}`,
          sourceUrl: videoUrl,
          metadata: {
            creator: creator.name,
            channelId: creator.channelId,
            videoId: video.id.videoId,
            publishedAt: video.snippet.publishedAt,
            commentCount: comments.length,
            platform: 'youtube'
          }
        });

        collected++;
        console.log(`✅ Collected YouTube content: "${video.snippet.title}" from ${creator.name}`);
      }

    } catch (error) {
      console.error(`Error collecting from ${creator.name}:`, error);
    }

    return collected;
  }

  private async getVideoComments(videoId: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/commentThreads?part=snippet&videoId=${videoId}&maxResults=10&order=relevance&key=${this.API_KEY}`
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.items || [];

    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  private isDbDRelevant(text: string): boolean {
    const lowerText = text.toLowerCase();
    const dbdKeywords = [
      'dead by daylight', 'dbd', 'killer', 'survivor', 'hook', 'generator',
      'behavior', 'bhvr', 'patch', 'update', 'nerf', 'buff', 'meta',
      'camping', 'tunneling', 'toxic', 'tier list', 'build'
    ];
    
    return dbdKeywords.some(keyword => lowerText.includes(keyword));
  }
}