import { storage } from '../../storage';
import { eq } from 'drizzle-orm';
import { pendingContent } from '@shared/schema';

export class SteamNewsService {
  private readonly DBD_APP_ID = '381210';
  private readonly STEAM_NEWS_API = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/';

  async collectContent(sourceId: string, profileId: string): Promise<number> {
    try {
      console.log('🔍 Starting Steam news collection...');
      
      const response = await fetch(
        `${this.STEAM_NEWS_API}?appid=${this.DBD_APP_ID}&count=10&format=json`
      );
      
      const data = await response.json();
      let contentCollected = 0;
      
      if (!data.appnews?.newsitems) {
        console.log('⚠️ No Steam news items found');
        return 0;
      }
      
      for (const newsItem of data.appnews.newsitems) {
        // Only get official announcements and patch notes
        if (!newsItem.feedlabel.includes('Official') && 
            !newsItem.title.toLowerCase().includes('patch') &&
            !newsItem.title.toLowerCase().includes('update')) continue;
            
        // Check if already processed
        const existing = await storage.db
          .select()
          .from(pendingContent)
          .where(eq(pendingContent.sourceUrl, newsItem.url))
          .limit(1);
          
        if (existing.length > 0) continue;

        // Clean up HTML content
        const cleanContent = newsItem.contents
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
          .trim();

        await storage.createPendingContent({
          sourceId,
          profileId,
          rawContent: `STEAM NEWS: ${newsItem.title}\n\n${cleanContent}`,
          title: newsItem.title,
          sourceUrl: newsItem.url,
          metadata: {
            date: newsItem.date,
            feedlabel: newsItem.feedlabel,
            author: newsItem.author || 'Behaviour Interactive'
          }
        });
        
        contentCollected++;
        console.log(`✅ Collected Steam news: "${newsItem.title}"`);
      }
      
      console.log(`✅ Steam: Collected ${contentCollected} new announcements`);
      return contentCollected;
      
    } catch (error) {
      console.error('❌ Steam collection failed:', error);
      throw error;
    }
  }
}