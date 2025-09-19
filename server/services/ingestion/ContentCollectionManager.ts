import { RedditService } from './RedditService';
import { SteamNewsService } from './SteamNewsService';
import { YouTubeService } from './YouTubeService';
import { storage } from '../../storage';

export interface CollectionResult {
  reddit: number;
  steam: number;
  youtube: number;
  errors: string[];
  totalCollected: number;
}

export class ContentCollectionManager {
  private redditService = new RedditService();
  private steamService = new SteamNewsService();
  private youtubeService = new YouTubeService();
  
  async runCollection(profileId: string): Promise<CollectionResult> {
    console.log('🚀 Starting automated DbD content collection...');
    
    const results: CollectionResult = {
      reddit: 0,
      steam: 0,
      youtube: 0,
      errors: [],
      totalCollected: 0
    };
    
    // Get active sources for this profile
    const activeSources = await storage.getAutomatedSources(profileId);
    const activeSourcesFiltered = activeSources.filter(s => s.isActive);
    
    console.log(`📊 Found ${activeSourcesFiltered.length} active sources for profile ${profileId}`);
    
    for (const source of activeSourcesFiltered) {
      try {
        let collected = 0;
        
        console.log(`🔄 Processing ${source.sourceType} source: ${source.id}`);
        
        switch (source.sourceType) {
          case 'reddit':
            collected = await this.redditService.collectContent(source.id, profileId);
            results.reddit += collected;
            break;
            
          case 'steam':
            collected = await this.steamService.collectContent(source.id, profileId);
            results.steam += collected;
            break;
            
          case 'youtube':
            collected = await this.youtubeService.collectContent(source.id, profileId);
            results.youtube += collected;
            break;
            
          default:
            console.log(`⚠️ Unknown source type: ${source.sourceType}`);
        }
        
        // Update last processed timestamp
        await storage.updateAutomatedSource(source.id, {
          lastProcessedAt: new Date()
        });
        
        console.log(`✅ ${source.sourceType}: ${collected} items collected`);
        
      } catch (error) {
        const errorMsg = `${source.sourceType}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`❌ Collection failed for ${source.sourceType}:`, error);
      }
    }
    
    results.totalCollected = results.reddit + results.steam + results.youtube;
    
    console.log(`🎯 Collection complete: ${results.totalCollected} total items collected`);
    if (results.errors.length > 0) {
      console.error(`⚠️ Errors encountered:`, results.errors);
    }
    
    return results;
  }

  // Manual test method for immediate collection
  async testCollection(profileId: string, sourceType: 'reddit' | 'steam' | 'youtube'): Promise<number> {
    console.log(`🧪 Testing ${sourceType} collection...`);
    
    try {
      switch (sourceType) {
        case 'reddit':
          return await this.redditService.collectContent('test-reddit', profileId);
        case 'steam':
          return await this.steamService.collectContent('test-steam', profileId);
        case 'youtube':
          return await this.youtubeService.collectContent('test-youtube', profileId);
        default:
          throw new Error(`Unknown source type: ${sourceType}`);
      }
    } catch (error) {
      console.error(`❌ Test collection failed for ${sourceType}:`, error);
      throw error;
    }
  }
}