import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useElevenLabsSpeech } from "@/hooks/use-elevenlabs-speech";
import { apiRequest } from "@/lib/queryClient";
import { 
  Megaphone, 
  Star, 
  StarIcon,
  Clock, 
  Play, 
  Heart,
  HeartIcon,
  BarChart3,
  Sparkles,
  Dice3,
  Timer,
  Trophy,
  Pause,
  Download,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";

interface PrerollAd {
  id: string;
  sponsorName: string;
  productName: string;
  category: string;
  adScript: string;
  personalityFacet?: string;
  duration?: number;
  lastUsed?: string;
  usageCount: number;
  rating?: number;
  isFavorite: boolean;
  generatedAt: string;
}

interface AdStats {
  totalAds: number;
  byCategory: Record<string, number>;
  favorites: number;
  averageRating: number;
  totalDuration: number;
}

interface PrerollAdPanelProps {
  profileId?: string;
}

const AD_CATEGORIES = [
  { value: 'food', label: '🍕 Food & Restaurants' },
  { value: 'health', label: '💪 Health & Supplements' },
  { value: 'home', label: '🏠 Home & Garden' },
  { value: 'automotive', label: '🚗 Automotive' },
  { value: 'finance', label: '💰 Finance & Tax' },
  { value: 'tech', label: '📱 Technology' },
  { value: 'alternative', label: '🔮 Alternative Services' }
];

const PERSONALITY_FACETS = [
  { value: 'grumpy_mentor', label: '😤 Grumpy Mentor' },
  { value: 'family_business', label: '👨‍👩‍👧‍👦 Family Business' },
  { value: 'italian_pride', label: '🇮🇹 Italian Pride' },
  { value: 'dbd_expert', label: '🎮 DbD Expert' },
  { value: 'reluctant_helper', label: '🤷 Reluctant Helper' },
  { value: 'conspiracy_theories', label: '🕵️ Conspiracy Theories' },
  { value: 'old_school_wisdom', label: '👴 Old School Wisdom' },
  { value: 'unhinged_lunatic', label: '🤪 Unhinged Lunatic' }
];

export default function PrerollAdPanel({ profileId }: PrerollAdPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFacet, setSelectedFacet] = useState<string>('');
  const [viewingAd, setViewingAd] = useState<PrerollAd | null>(null);
  const [generatingAd, setGeneratingAd] = useState(false);

  // Audio functionality
  const { speak, isSpeaking, isPaused, stop, pause, resume, replay, canReplay, saveAudio, canSave } = useElevenLabsSpeech();

  // Fetch ads
  const { data: ads = [], isLoading } = useQuery<PrerollAd[]>({
    queryKey: ['/api/ads', profileId],
    queryFn: async () => {
      const response = await fetch(`/api/ads/${profileId}?includeUsed=true`);
      if (!response.ok) throw new Error('Failed to fetch ads');
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!profileId,
  });

  // Fetch ad statistics
  const { data: stats } = useQuery<AdStats>({
    queryKey: ['/api/ads', profileId, 'stats'],
    queryFn: async () => {
      const response = await fetch(`/api/ads/${profileId}/stats`);
      if (!response.ok) throw new Error('Failed to fetch ad stats');
      const result = await response.json();
      return result.data;
    },
    enabled: !!profileId,
  });

  // Generate new ad mutation
  const generateAdMutation = useMutation({
    mutationFn: async (params: { category?: string; personalityFacet?: string; forceNew?: boolean }) => {
      const response = await apiRequest('POST', '/api/ads/generate', params);
      return response.json();
    },
    onMutate: () => {
      setGeneratingAd(true);
    },
    onSuccess: (result) => {
      toast({
        title: "🎪 Ad Generated!",
        description: `New ${result.data.category} ad for "${result.data.sponsorName}" created`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ads', profileId] });
      queryClient.invalidateQueries({ queryKey: ['/api/ads', profileId, 'stats'] });
      setGeneratingAd(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
      setGeneratingAd(false);
    },
  });

  // Mark ad as used mutation
  const markUsedMutation = useMutation({
    mutationFn: async (adId: string) => {
      const response = await apiRequest('POST', `/api/ads/${adId}/use`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ad Marked as Used",
        description: "Usage statistics updated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ads', profileId] });
      queryClient.invalidateQueries({ queryKey: ['/api/ads', profileId, 'stats'] });
    },
  });

  // Rate ad mutation
  const rateAdMutation = useMutation({
    mutationFn: async ({ adId, rating }: { adId: string; rating: number }) => {
      const response = await apiRequest('POST', `/api/ads/${adId}/rate`, { rating });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ads', profileId] });
      queryClient.invalidateQueries({ queryKey: ['/api/ads', profileId, 'stats'] });
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ adId, isFavorite }: { adId: string; isFavorite: boolean }) => {
      const response = await apiRequest('POST', `/api/ads/${adId}/favorite`, { isFavorite });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ads', profileId] });
      queryClient.invalidateQueries({ queryKey: ['/api/ads', profileId, 'stats'] });
    },
  });

  const handleGenerateAd = useCallback(() => {
    generateAdMutation.mutate({
      category: selectedCategory || undefined,
      personalityFacet: selectedFacet || undefined,
      forceNew: true
    });
  }, [selectedCategory, selectedFacet, generateAdMutation]);

  const handleRating = useCallback((adId: string, rating: number) => {
    rateAdMutation.mutate({ adId, rating });
  }, [rateAdMutation]);

  const handleToggleFavorite = useCallback((adId: string, isFavorite: boolean) => {
    toggleFavoriteMutation.mutate({ adId, isFavorite });
  }, [toggleFavoriteMutation]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getCategoryIcon = (category: string) => {
    const categoryMap: Record<string, string> = {
      food: '🍕',
      health: '💪',
      home: '🏠',
      automotive: '🚗',
      finance: '💰',
      tech: '📱',
      alternative: '🔮'
    };
    return categoryMap[category] || '📢';
  };

  const StarRating = ({ rating, onRate, adId, readonly = false }: { 
    rating?: number; 
    onRate?: (rating: number) => void; 
    adId: string; 
    readonly?: boolean;
  }) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => !readonly && onRate?.(star)}
            disabled={readonly}
            className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
            data-testid={`star-rating-${adId}-${star}`}
          >
            {star <= (rating || 0) ? (
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            ) : (
              <StarIcon className="h-4 w-4 text-gray-300" />
            )}
          </button>
        ))}
      </div>
    );
  };

  if (!profileId) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No active profile found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-blue-600" />
            Pre-Roll Ad Generator
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Generate hilarious Italian-American fake sponsor ads for Nicky's podcast
          </p>
        </div>
        
        {stats && (
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalAds}</div>
              <div className="text-xs text-muted-foreground">Total Ads</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.favorites}</div>
              <div className="text-xs text-muted-foreground">Favorites</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatDuration(stats.totalDuration)}
              </div>
              <div className="text-xs text-muted-foreground">Content</div>
            </div>
          </div>
        )}
      </div>

      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate New Ad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Category (Optional)</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Random category" />
                </SelectTrigger>
                <SelectContent>
                  {AD_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value} data-testid={`category-${cat.value}`}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Personality Facet (Optional)</label>
              <Select value={selectedFacet} onValueChange={setSelectedFacet}>
                <SelectTrigger data-testid="select-facet">
                  <SelectValue placeholder="Random facet" />
                </SelectTrigger>
                <SelectContent>
                  {PERSONALITY_FACETS.map(facet => (
                    <SelectItem key={facet.value} value={facet.value} data-testid={`facet-${facet.value}`}>
                      {facet.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleGenerateAd}
            disabled={generateAdMutation.isPending}
            className="w-full"
            data-testid="button-generate-ad"
          >
            {generateAdMutation.isPending ? (
              <>
                <Dice3 className="h-4 w-4 mr-2 animate-spin" />
                Generating Nicky's Ad Magic...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Ad
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Ad Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Ad Library ({ads.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading ads...</p>
            </div>
          ) : ads.length === 0 ? (
            <div className="text-center py-8">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No ads generated yet</p>
              <p className="text-sm text-muted-foreground">Generate your first Italian-American fake sponsor ad!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ads.map((ad) => (
                <Card key={ad.id} className="relative" data-testid={`ad-card-${ad.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getCategoryIcon(ad.category)}</span>
                        <div>
                          <h3 className="font-semibold text-sm">{ad.sponsorName}</h3>
                          <p className="text-xs text-muted-foreground">{ad.productName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleFavorite(ad.id, !ad.isFavorite)}
                          data-testid={`button-favorite-${ad.id}`}
                        >
                          {ad.isFavorite ? (
                            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                          ) : (
                            <HeartIcon className="h-4 w-4" />
                          )}
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" data-testid={`button-view-${ad.id}`}>
                              <Play className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                {getCategoryIcon(ad.category)}
                                {ad.sponsorName} - {ad.productName}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <Badge variant="secondary">{ad.category}</Badge>
                                {ad.personalityFacet && (
                                  <Badge variant="outline">{ad.personalityFacet}</Badge>
                                )}
                                <div className="flex items-center gap-1">
                                  <Timer className="h-3 w-3" />
                                  {formatDuration(ad.duration)}
                                </div>
                              </div>
                              <Textarea
                                value={ad.adScript}
                                readOnly
                                className="min-h-[200px] font-mono text-sm"
                                data-testid={`ad-script-${ad.id}`}
                              />
                              <div className="flex items-center justify-between">
                                <StarRating 
                                  rating={ad.rating} 
                                  onRate={(rating) => handleRating(ad.id, rating)}
                                  adId={ad.id}
                                />
                                <div className="flex items-center gap-2">
                                  {/* Audio Controls */}
                                  <div className="flex items-center gap-1">
                                    <Button
                                      onClick={() => {
                                        if (isSpeaking && !isPaused) {
                                          pause();
                                        } else if (isPaused) {
                                          resume();
                                        } else {
                                          speak(ad.adScript);
                                        }
                                      }}
                                      size="sm"
                                      variant="outline"
                                      data-testid={`button-play-${ad.id}`}
                                    >
                                      {isSpeaking ? (isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />) : <Play className="h-3 w-3" />}
                                    </Button>
                                    {canReplay && (
                                      <Button
                                        onClick={replay}
                                        size="sm"
                                        variant="outline"
                                        data-testid={`button-replay-${ad.id}`}
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {canSave && (
                                      <Button
                                        onClick={() => saveAudio(`${ad.sponsorName.replace(/[^a-zA-Z0-9]/g, '-')}-ad.mp3`)}
                                        size="sm"
                                        variant="outline"
                                        data-testid={`button-save-${ad.id}`}
                                      >
                                        <Download className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                  <Button
                                    onClick={() => markUsedMutation.mutate(ad.id)}
                                    size="sm"
                                    data-testid={`button-use-${ad.id}`}
                                    disabled={markUsedMutation.isPending && markUsedMutation.variables === ad.id}
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    {markUsedMutation.isPending && markUsedMutation.variables === ad.id ? 'Marking...' : 'Mark as Used'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {ad.adScript}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <StarRating rating={ad.rating} readonly adId={ad.id} />
                        {ad.usageCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Used {ad.usageCount}x
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(ad.duration)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}