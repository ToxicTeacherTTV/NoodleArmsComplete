import Parser from 'rss-parser';
import { promises as fs } from 'fs';
import path from 'path';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { podcastEpisodes } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { PodcastFactExtractor } from './podcastFactExtractor';
import type { IStorage } from '../storage';

interface RssEpisode {
  guid: string;
  title: string;
  description?: string;
  pubDate?: string;
  enclosure?: {
    url: string;
    type: string;
  };
  itunes?: {
    duration?: string;
    episode?: string;
    season?: string;
    image?: string;
  };
}

export class PodcastRssSyncService {
  private parser: Parser;
  private transcriptDir: string;

  constructor(transcriptDir: string = './podcast_transcripts') {
    this.parser = new Parser({
      customFields: {
        item: [
          ['itunes:duration', 'duration'],
          ['itunes:episode', 'episodeNum'],
          ['itunes:season', 'seasonNum'],
          ['itunes:image', 'image'],
        ]
      }
    });
    this.transcriptDir = transcriptDir;
  }

  /**
   * Fetch and parse RSS feed
   */
  async fetchRssFeed(feedUrl: string): Promise<RssEpisode[]> {
    console.log(`📡 Fetching RSS feed from: ${feedUrl}`);
    
    try {
      const feed = await this.parser.parseURL(feedUrl);
      console.log(`✅ Found ${feed.items.length} episodes in RSS feed`);
      
      return feed.items.map((item: any) => ({
        guid: item.guid || item.link || item.title,
        title: item.title || 'Untitled Episode',
        description: item.contentSnippet || item.content || item.description,
        pubDate: item.pubDate || item.isoDate,
        enclosure: item.enclosure,
        itunes: {
          duration: item.duration || item.itunes?.duration,
          episode: item.episodeNum || item.itunes?.episode,
          season: item.seasonNum || item.itunes?.season,
          image: item.image?.url || item.itunes?.image,
        }
      }));
    } catch (error) {
      console.error('❌ Failed to fetch RSS feed:', error);
      throw new Error(`RSS feed fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse episode number from various formats
   */
  private parseEpisodeNumber(title: string, itunesEpisode?: string): number | null {
    // Try iTunes episode number first
    if (itunesEpisode) {
      const num = parseInt(itunesEpisode, 10);
      if (!isNaN(num)) return num;
    }

    // Try extracting from title patterns like "Episode 68" or "Ep. 68" or "68:"
    const patterns = [
      /episode\s*(\d+)/i,
      /ep\.?\s*(\d+)/i,
      /^(\d+)[\s:]/,
      /#(\d+)/
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) return num;
      }
    }

    return null;
  }

  /**
   * Parse duration string to seconds
   */
  private parseDuration(duration?: string): number | null {
    if (!duration) return null;

    // If already a number in seconds
    const numValue = parseInt(duration, 10);
    if (!isNaN(numValue)) return numValue;

    // Parse HH:MM:SS or MM:SS format
    const parts = duration.split(':').map(p => parseInt(p, 10));
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }

    return null;
  }

  /**
   * Find matching transcript file for an episode
   */
  async findTranscriptFile(episodeNumber: number | null, title: string): Promise<string | null> {
    try {
      // Ensure transcript directory exists
      await fs.mkdir(this.transcriptDir, { recursive: true });
      
      const files = await fs.readdir(this.transcriptDir);
      const txtFiles = files.filter(f => f.endsWith('.txt'));

      console.log(`🔍 Looking for transcript matching episode ${episodeNumber} or "${title}"`);
      console.log(`📁 Found ${txtFiles.length} .txt files in ${this.transcriptDir}`);

      // Try to match by episode number first
      if (episodeNumber !== null) {
        // Patterns: "68.txt", "Episode 68.txt", "Ep68.txt", etc.
        const patterns = [
          new RegExp(`^${episodeNumber}\\.txt$`, 'i'),
          new RegExp(`^episode[\\s_-]*${episodeNumber}\\.txt$`, 'i'),
          new RegExp(`^ep[\\s_-]*${episodeNumber}\\.txt$`, 'i'),
          new RegExp(`${episodeNumber}[\\s_-].*\\.txt$`, 'i'),
        ];

        for (const pattern of patterns) {
          const match = txtFiles.find(f => pattern.test(f));
          if (match) {
            console.log(`✅ Found transcript by episode number: ${match}`);
            return match;
          }
        }
      }

      // Try fuzzy title matching
      const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const file of txtFiles) {
        const normalizedFilename = file.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedFilename.includes(normalizedTitle.substring(0, 20)) ||
            normalizedTitle.includes(normalizedFilename.replace('txt', '').substring(0, 20))) {
          console.log(`✅ Found transcript by title match: ${file}`);
          return file;
        }
      }

      console.log(`⚠️ No transcript file found for episode ${episodeNumber}`);
      return null;
    } catch (error) {
      console.error('❌ Error finding transcript file:', error);
      return null;
    }
  }

  /**
   * Read transcript file content
   */
  async readTranscript(filename: string): Promise<string> {
    const filePath = path.join(this.transcriptDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  }

  /**
   * Sync RSS feed with database and local transcripts
   */
  async syncRssFeed(
    db: PostgresJsDatabase<any>,
    profileId: string,
    feedUrl: string,
    processTranscripts: boolean = true
  ): Promise<{
    newEpisodes: number;
    updatedEpisodes: number;
    transcriptsMatched: number;
    transcriptsProcessed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let newEpisodes = 0;
    let updatedEpisodes = 0;
    let transcriptsMatched = 0;
    let transcriptsProcessed = 0;

    try {
      // Fetch RSS feed
      const rssEpisodes = await this.fetchRssFeed(feedUrl);

      // Process each episode
      for (const rssEpisode of rssEpisodes) {
        try {
          const episodeNumber = this.parseEpisodeNumber(rssEpisode.title, rssEpisode.itunes?.episode);
          const duration = this.parseDuration(rssEpisode.itunes?.duration);

          // Check if episode already exists
          const existing = await db.select()
            .from(podcastEpisodes)
            .where(
              and(
                eq(podcastEpisodes.profileId, profileId),
                eq(podcastEpisodes.guid, rssEpisode.guid)
              )
            )
            .limit(1);

          const episodeData: any = {
            profileId,
            guid: rssEpisode.guid,
            title: rssEpisode.title,
            description: rssEpisode.description,
            episodeNumber,
            seasonNumber: rssEpisode.itunes?.season ? parseInt(rssEpisode.itunes.season, 10) : null,
            publishedAt: rssEpisode.pubDate ? new Date(rssEpisode.pubDate) : null,
            duration,
            audioUrl: rssEpisode.enclosure?.url,
            imageUrl: rssEpisode.itunes?.image,
            lastSyncedAt: new Date(),
          };

          if (existing.length === 0) {
            // New episode - try to find transcript
            const transcriptFilename = await this.findTranscriptFile(episodeNumber, rssEpisode.title);
            
            if (transcriptFilename) {
              transcriptsMatched++;
              episodeData.transcriptFilename = transcriptFilename;
              
              // Read transcript content
              const transcriptContent = await this.readTranscript(transcriptFilename);
              episodeData.transcript = transcriptContent;
              
              if (processTranscripts) {
                episodeData.processingStatus = 'PENDING';
              }
            }

            // Insert new episode
            await db.insert(podcastEpisodes).values(episodeData);
            newEpisodes++;
            console.log(`✅ Added new episode: ${rssEpisode.title} ${transcriptFilename ? `(transcript: ${transcriptFilename})` : ''}`);
          } else {
            // Update existing episode
            await db.update(podcastEpisodes)
              .set(episodeData)
              .where(eq(podcastEpisodes.id, existing[0].id));
            updatedEpisodes++;
            console.log(`🔄 Updated episode: ${rssEpisode.title}`);
          }
        } catch (error) {
          const errorMsg = `Error processing episode "${rssEpisode.title}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      return {
        newEpisodes,
        updatedEpisodes,
        transcriptsMatched,
        transcriptsProcessed,
        errors
      };
    } catch (error) {
      const errorMsg = `RSS sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Process pending episodes (extract facts and entities)
   */
  async processPendingEpisodes(
    db: PostgresJsDatabase<any>,
    storage: IStorage,
    profileId: string
  ): Promise<{ processed: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;
    let failed = 0;

    const extractor = new PodcastFactExtractor();

    // Get pending episodes that have transcripts
    const pending = await db.select()
      .from(podcastEpisodes)
      .where(
        and(
          eq(podcastEpisodes.profileId, profileId),
          eq(podcastEpisodes.processingStatus, 'PENDING')
        )
      );

    console.log(`🎙️ Processing ${pending.length} pending episodes`);

    for (const episode of pending) {
      if (!episode.transcript) {
        console.log(`⚠️ Skipping ${episode.title} - no transcript`);
        continue;
      }

      try {
        console.log(`⚙️ Processing episode: ${episode.title}`);
        
        // Update status to PROCESSING
        await db.update(podcastEpisodes)
          .set({ processingStatus: 'PROCESSING', processingProgress: 10 })
          .where(eq(podcastEpisodes.id, episode.id));

        // Extract facts using existing podcast fact extractor
        const result = await extractor.extractAndStoreFacts(
          storage,
          profileId,
          episode.id,
          episode.episodeNumber || 0,
          episode.title,
          episode.transcript,
          episode.guestNames || [],
          episode.topics || []
        );

        // Update episode with results
        await db.update(podcastEpisodes)
          .set({
            processingStatus: result.success ? 'COMPLETED' : 'FAILED',
            processingProgress: 100,
            factsExtracted: result.factsCreated || 0,
            entitiesExtracted: result.entitiesCreated || 0,
          })
          .where(eq(podcastEpisodes.id, episode.id));

        if (result.success) {
          processed++;
          console.log(`✅ Processed ${episode.title}: ${result.factsCreated} facts, ${result.entitiesCreated} entities`);
        } else {
          failed++;
          errors.push(result.error || 'Unknown error');
        }
      } catch (error) {
        const errorMsg = `Failed to process "${episode.title}": ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
        failed++;

        // Mark as failed
        await db.update(podcastEpisodes)
          .set({ processingStatus: 'FAILED' })
          .where(eq(podcastEpisodes.id, episode.id));
      }
    }

    return { processed, failed, errors };
  }
}
