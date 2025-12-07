import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Radio, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RssConfig {
  feedUrl: string;
  transcriptDir: string;
  lastSync: string | null;
}

interface PodcastEpisode {
  id: string;
  episodeNumber?: number;
  title: string;
  podcastName?: string;
  publishedAt?: string;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  transcriptFilename?: string;
  factsExtracted?: number;
  entitiesExtracted?: number;
}

export function PodcastRssSync() {
  const [feedUrl, setFeedUrl] = useState('');
  const [transcriptDir, setTranscriptDir] = useState('./podcast_transcripts');
  const [podcastName, setPodcastName] = useState('Camping Them Softly');
  const { toast } = useToast();

  // Fetch RSS config
  const { data: config } = useQuery<RssConfig>({
    queryKey: ['/api/podcast/rss/config'],
  });

  // Fetch episodes
  const { data: episodes, isLoading: episodesLoading } = useQuery<PodcastEpisode[]>({
    queryKey: ['/api/podcast/episodes'],
  });

  // Sync RSS feed mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/podcast/rss/sync', {
        feedUrl,
        transcriptDir,
        podcastName,
        processTranscripts: true
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'RSS Feed Synced Successfully',
        description: `Added ${data.newEpisodes} new episodes, updated ${data.updatedEpisodes}. Matched ${data.transcriptsMatched} transcripts.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/podcast/rss/config'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync RSS feed',
        variant: 'destructive',
      });
    }
  });

  // Process pending episodes mutation
  const processMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/podcast/rss/process', {});
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Episodes Processed',
        description: `Successfully processed ${data.processed} episodes. ${data.failed > 0 ? `${data.failed} failed.` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Processing Failed',
        description: error.message || 'Failed to process episodes',
        variant: 'destructive',
      });
    }
  });

  const handleSync = () => {
    if (!feedUrl.trim()) {
      toast({
        title: 'Feed URL Required',
        description: 'Please enter your podcast RSS feed URL',
        variant: 'destructive',
      });
      return;
    }
    syncMutation.mutate();
  };

  const handleProcess = () => {
    processMutation.mutate();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'PROCESSING':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingCount = episodes?.filter((ep: any) => ep.processingStatus === 'PENDING').length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            RSS Feed Sync
          </CardTitle>
          <CardDescription>
            Automatically sync podcast episodes from your RSS feed and match them with local transcript files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="podcastName">Podcast Show</Label>
            <Select value={podcastName} onValueChange={setPodcastName}>
              <SelectTrigger>
                <SelectValue placeholder="Select Podcast" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Camping Them Softly">Camping Them Softly (DbD)</SelectItem>
                <SelectItem value="Camping the Extract">Camping the Extract (ARC)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedUrl">Podcast RSS Feed URL</Label>
            <Input
              id="feedUrl"
              type="url"
              placeholder="https://feeds.example.com/your-podcast.rss"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              data-testid="input-feed-url"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter the RSS feed URL from your podcast hosting platform (e.g., Simplecast, Anchor, etc.)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transcriptDir">Transcript Directory</Label>
            <Input
              id="transcriptDir"
              type="text"
              placeholder="./podcast_transcripts"
              value={transcriptDir}
              onChange={(e) => setTranscriptDir(e.target.value)}
              data-testid="input-transcript-dir"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Local directory containing your .txt transcript files (named like "Episode 68.txt" or "68.txt")
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              data-testid="button-sync-rss"
            >
              {syncMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sync RSS Feed
            </Button>
            
            {pendingCount > 0 && (
              <Button
                variant="outline"
                onClick={handleProcess}
                disabled={processMutation.isPending}
                data-testid="button-process-pending"
              >
                {processMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Process {pendingCount} Pending Episodes
              </Button>
            )}
          </div>

          {config?.lastSync && (
            <p className="text-sm text-gray-500">
              Last synced: {new Date(config.lastSync).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Episodes</CardTitle>
          <CardDescription>
            {episodes?.length || 0} episodes synced from RSS feed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {episodesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : episodes && episodes.length > 0 ? (
            <div className="space-y-3">
              {episodes.slice(0, 20).map((episode) => (
                <div
                  key={episode.id}
                  className="p-4 border rounded-lg space-y-2"
                  data-testid={`episode-${episode.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {episode.podcastName && (
                          <Badge variant="outline" className="text-[10px]">
                            {episode.podcastName === 'Camping Them Softly' ? 'DbD' : 'ARC'}
                          </Badge>
                        )}
                        <span className="font-medium">
                          {episode.episodeNumber && `Episode ${episode.episodeNumber}: `}
                          {episode.title}
                        </span>
                      </div>
                      {episode.publishedAt && (
                        <div className="text-sm text-gray-500">
                          {new Date(episode.publishedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    {getStatusBadge(episode.processingStatus)}
                  </div>

                  {episode.transcriptFilename && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      📄 {episode.transcriptFilename}
                    </div>
                  )}

                  {(episode.factsExtracted || 0) > 0 && (
                    <div className="text-sm text-green-600 dark:text-green-400">
                      ✅ {episode.factsExtracted} facts extracted
                      {(episode.entitiesExtracted || 0) > 0 && `, ${episode.entitiesExtracted} entities`}
                    </div>
                  )}
                </div>
              ))}
              {episodes.length > 20 && (
                <p className="text-sm text-gray-500 text-center">
                  Showing first 20 of {episodes.length} episodes
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No episodes synced yet. Enter your RSS feed URL above and click "Sync RSS Feed".
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
