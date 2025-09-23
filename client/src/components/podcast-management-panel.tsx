import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, Mic, Clock, Edit, Trash2, Play, FileText, Hash, Calendar, Users, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PodcastEpisode {
  id: string;
  profileId: string;
  episodeNumber: number;
  title: string;
  description?: string;
  recordedAt?: string;
  transcript?: string;
  notes?: string;
  topics?: string[];
  keyMoments?: string[];
  guestInfo?: string;
  mood?: string;
  energy?: number;
  createdAt: string;
  updatedAt: string;
}

interface PodcastSegment {
  id: string;
  episodeId: string;
  title: string;
  description?: string;
  startTime: number;
  endTime?: number;
  transcript?: string;
  segmentType?: string;
  keyQuotes?: string[];
  topics?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PodcastManagementPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateEpisodeOpen, setIsCreateEpisodeOpen] = useState(false);
  const [isEditEpisodeOpen, setIsEditEpisodeOpen] = useState(false);
  const [isCreateSegmentOpen, setIsCreateSegmentOpen] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<PodcastEpisode | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<PodcastSegment | null>(null);
  const [editEpisode, setEditEpisode] = useState({
    title: "",
    description: "",
    episodeNumber: 1,
    guestInfo: "",
    transcript: "",
    notes: ""
  });
  const [newEpisode, setNewEpisode] = useState({
    title: "",
    description: "",
    episodeNumber: 1,
    guestInfo: "",
    transcript: "",
    notes: ""
  });

  // Fetch episodes
  const { data: episodes = [], isLoading: episodesLoading } = useQuery({
    queryKey: ['/api/podcast/episodes'],
    refetchInterval: false,
  }) as { data: PodcastEpisode[]; isLoading: boolean };

  // Fetch segments for selected episode
  const { data: segments = [], isLoading: segmentsLoading } = useQuery({
    queryKey: ['/api/podcast/episodes', selectedEpisode?.id, 'segments'],
    enabled: !!selectedEpisode,
    refetchInterval: false,
  }) as { data: PodcastSegment[]; isLoading: boolean };

  // Create episode mutation
  const createEpisodeMutation = useMutation({
    mutationFn: async (episodeData: any) => {
      const response = await apiRequest('POST', '/api/podcast/episodes', episodeData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes'] });
      setIsCreateEpisodeOpen(false);
      setNewEpisode({
        title: "",
        description: "",
        episodeNumber: episodes.length + 1,
        guestInfo: "",
        transcript: "",
        notes: ""
      });
      toast({ title: "Episode created successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to create episode", variant: "destructive" });
    },
  });

  // Update episode mutation
  const updateEpisodeMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await apiRequest('PUT', `/api/podcast/episodes/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes'] });
      setIsEditEpisodeOpen(false);
      toast({ title: "Episode updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update episode", variant: "destructive" });
    },
  });

  // Delete episode mutation
  const deleteEpisodeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/podcast/episodes/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes'] });
      setSelectedEpisode(null);
      toast({ title: "Episode deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete episode", variant: "destructive" });
    },
  });

  // Parse segments mutation
  const parseSegmentsMutation = useMutation({
    mutationFn: async (episodeId: string) => {
      const response = await apiRequest('POST', `/api/podcast/episodes/${episodeId}/parse-segments`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes', selectedEpisode?.id, 'segments'] });
      toast({ 
        title: "Segments parsed successfully!", 
        description: `Found ${data.segments?.length || 0} show segments`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to parse segments", 
        description: error?.message || "Make sure the episode has a transcript",
        variant: "destructive" 
      });
    },
  });

  const handleCreateEpisode = () => {
    if (!newEpisode.title.trim()) {
      toast({ title: "Please enter an episode title", variant: "destructive" });
      return;
    }

    if (createEpisodeMutation.isPending) {
      return; // Prevent double submission
    }

    createEpisodeMutation.mutate({
      ...newEpisode,
      topics: [],
      keyMoments: []
    });
  };

  const handleEditEpisode = () => {
    if (!editEpisode.title.trim()) {
      toast({ title: "Please enter an episode title", variant: "destructive" });
      return;
    }

    if (!selectedEpisode || updateEpisodeMutation.isPending) {
      return; // Prevent double submission
    }

    updateEpisodeMutation.mutate({
      id: selectedEpisode.id,
      updates: {
        ...editEpisode,
        topics: [],
        keyMoments: []
      }
    });
  };

  const openEditDialog = (episode: PodcastEpisode) => {
    setEditEpisode({
      title: episode.title,
      description: episode.description || "",
      episodeNumber: episode.episodeNumber,
      guestInfo: (episode as any).guestInfo || "",
      transcript: episode.transcript || "",
      notes: episode.notes || ""
    });
    setIsEditEpisodeOpen(true);
  };

  const filteredEpisodes = episodes.filter((episode: PodcastEpisode) =>
    episode.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    episode.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    episode.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="podcast-management-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Podcast Management</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Manage podcast episodes, segments, and content for Nicky's show
          </p>
        </div>
        <Dialog open={isCreateEpisodeOpen} onOpenChange={setIsCreateEpisodeOpen}>
          <DialogTrigger asChild>
            <Button className="ml-4" data-testid="button-create-episode">
              <Plus className="h-4 w-4 mr-2" />
              New Episode
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Episode</DialogTitle>
              <DialogDescription>
                Add a new podcast episode to track content and segments
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Episode Number</label>
                <Input
                  type="number"
                  value={newEpisode.episodeNumber}
                  onChange={(e) => setNewEpisode({ ...newEpisode, episodeNumber: parseInt(e.target.value) })}
                  className="mt-1"
                  data-testid="input-episode-number"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input
                  value={newEpisode.title}
                  onChange={(e) => setNewEpisode({ ...newEpisode, title: e.target.value })}
                  placeholder="Episode title..."
                  className="mt-1"
                  data-testid="input-episode-title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newEpisode.description}
                  onChange={(e) => setNewEpisode({ ...newEpisode, description: e.target.value })}
                  placeholder="What's this episode about?"
                  className="mt-1"
                  rows={3}
                  data-testid="textarea-episode-description"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Guest Info</label>
                <Input
                  value={newEpisode.guestInfo}
                  onChange={(e) => setNewEpisode({ ...newEpisode, guestInfo: e.target.value })}
                  placeholder="Guest names or info..."
                  className="mt-1"
                  data-testid="input-guest-info"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Transcript</label>
                <Textarea
                  value={newEpisode.transcript}
                  onChange={(e) => setNewEpisode({ ...newEpisode, transcript: e.target.value })}
                  placeholder="Paste the episode transcript here..."
                  className="mt-1"
                  rows={4}
                  data-testid="textarea-episode-transcript"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={newEpisode.notes}
                  onChange={(e) => setNewEpisode({ ...newEpisode, notes: e.target.value })}
                  placeholder="Additional notes about this episode..."
                  className="mt-1"
                  rows={2}
                  data-testid="textarea-episode-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateEpisodeOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateEpisode}
                disabled={createEpisodeMutation.isPending}
                data-testid="button-submit-episode"
              >
                {createEpisodeMutation.isPending ? "Creating..." : "Create Episode"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Episode Dialog */}
        <Dialog open={isEditEpisodeOpen} onOpenChange={setIsEditEpisodeOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Episode</DialogTitle>
              <DialogDescription>
                Update episode information and content
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Episode Number</label>
                <Input
                  type="number"
                  value={editEpisode.episodeNumber}
                  onChange={(e) => setEditEpisode({ ...editEpisode, episodeNumber: parseInt(e.target.value) })}
                  className="mt-1"
                  data-testid="input-edit-episode-number"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input
                  value={editEpisode.title}
                  onChange={(e) => setEditEpisode({ ...editEpisode, title: e.target.value })}
                  placeholder="Episode title..."
                  className="mt-1"
                  data-testid="input-edit-episode-title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editEpisode.description}
                  onChange={(e) => setEditEpisode({ ...editEpisode, description: e.target.value })}
                  placeholder="What's this episode about?"
                  className="mt-1"
                  rows={3}
                  data-testid="textarea-edit-episode-description"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Guest Info</label>
                <Input
                  value={editEpisode.guestInfo}
                  onChange={(e) => setEditEpisode({ ...editEpisode, guestInfo: e.target.value })}
                  placeholder="Guest names or info..."
                  className="mt-1"
                  data-testid="input-edit-guest-info"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Transcript</label>
                <Textarea
                  value={editEpisode.transcript}
                  onChange={(e) => setEditEpisode({ ...editEpisode, transcript: e.target.value })}
                  placeholder="Paste the episode transcript here..."
                  className="mt-1"
                  rows={4}
                  data-testid="textarea-edit-episode-transcript"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={editEpisode.notes}
                  onChange={(e) => setEditEpisode({ ...editEpisode, notes: e.target.value })}
                  placeholder="Additional notes about this episode..."
                  className="mt-1"
                  rows={2}
                  data-testid="textarea-edit-episode-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditEpisodeOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEditEpisode}
                disabled={updateEpisodeMutation.isPending}
                data-testid="button-submit-edit-episode"
              >
                {updateEpisodeMutation.isPending ? "Updating..." : "Update Episode"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Episodes</p>
                <p className="text-2xl font-bold" data-testid="stat-total-episodes">{episodes.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mic className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Latest Episode</p>
                <p className="text-2xl font-bold" data-testid="stat-latest-episode">
                  #{Math.max(...episodes.map((e: PodcastEpisode) => e.episodeNumber), 0)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Hash className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Segments</p>
                <p className="text-2xl font-bold" data-testid="stat-total-segments">
                  {selectedEpisode ? segments.length : "-"}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Episodes List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Episodes
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search episodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-episodes"
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {episodesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading episodes...</p>
                  </div>
                ) : filteredEpisodes.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "No episodes match your search" : "No episodes yet. Create your first one!"}
                    </p>
                  </div>
                ) : (
                  filteredEpisodes.map((episode: PodcastEpisode) => (
                    <Card 
                      key={episode.id} 
                      className={`cursor-pointer transition-colors ${selectedEpisode?.id === episode.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedEpisode(episode)}
                      data-testid={`episode-card-${episode.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">#{episode.episodeNumber}</Badge>
                            </div>
                            <h4 className="font-medium line-clamp-1" data-testid={`episode-title-${episode.id}`}>
                              {episode.title}
                            </h4>
                            {episode.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {episode.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(episode.createdAt).toLocaleDateString()}
                              </div>
                              {episode.guestInfo && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  Guest
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Episode Details & Segments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedEpisode ? `Episode #${selectedEpisode.episodeNumber} Details` : "Select Episode"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEpisode ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2" data-testid={`selected-episode-title`}>
                    {selectedEpisode.title}
                  </h3>
                  {selectedEpisode.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {selectedEpisode.description}
                    </p>
                  )}
                  
                  <div className="flex gap-2 mb-4">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => openEditDialog(selectedEpisode)}
                      data-testid="button-edit-episode"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {selectedEpisode.transcript && selectedEpisode.transcript.trim() !== '' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => parseSegmentsMutation.mutate(selectedEpisode.id)}
                        disabled={parseSegmentsMutation.isPending}
                        data-testid="button-parse-segments"
                        className="bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700"
                      >
                        {parseSegmentsMutation.isPending ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-1"></div>
                        ) : (
                          <FileText className="h-4 w-4 mr-1" />
                        )}
                        {parseSegmentsMutation.isPending ? "Parsing..." : "Parse Segments"}
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => deleteEpisodeMutation.mutate(selectedEpisode.id)}
                      disabled={deleteEpisodeMutation.isPending}
                      data-testid="button-delete-episode"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Segments</h4>
                    <Button size="sm" data-testid="button-add-segment">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Segment
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-[250px]">
                    {segmentsLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                        <p className="text-xs text-muted-foreground mt-2">Loading segments...</p>
                      </div>
                    ) : segments.length === 0 ? (
                      <div className="text-center py-8">
                        <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No segments yet</p>
                        <p className="text-xs text-muted-foreground">Add segments to organize episode content</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {segments.map((segment: PodcastSegment) => (
                          <Card key={segment.id} className="border-l-4 border-l-primary">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium text-sm" data-testid={`segment-title-${segment.id}`}>
                                    {segment.title}
                                  </h5>
                                  {segment.description && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {segment.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">
                                      {Math.floor(segment.startTime / 60)}:{(segment.startTime % 60).toString().padStart(2, '0')}
                                    </Badge>
                                    {segment.segmentType && (
                                      <Badge variant="secondary" className="text-xs">
                                        {segment.segmentType}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Mic className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Select an episode to view details and manage segments
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}