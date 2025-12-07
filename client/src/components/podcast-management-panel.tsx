import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, Mic, Clock, Edit, Trash2, FileText, Hash, Calendar, Users, AlertCircle, Link as LinkIcon, RefreshCw, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PodcastRssSync } from "@/components/podcast-rss-sync";
import type { MemoryEntry } from "@/types";

interface PodcastEpisode {
  id: string;
  profileId: string;
  podcastName?: string;
  episodeNumber: number;
  title: string;
  description?: string;
  recordedAt?: string;
  publishedAt?: string;
  transcript?: string;
  transcriptFilename?: string;
  notes?: string;
  topics?: string[];
  keyMoments?: string[];
  guestInfo?: string;
  mood?: string;
  energy?: number;
  processingStatus?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  factsExtracted?: number;
  entitiesExtracted?: number;
  lastSyncedAt?: string;
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
  participants?: string[];
}

interface EpisodeMemoriesResponse {
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  memoriesCount: number;
  memories: MemoryEntry[];
}

const SEGMENT_TYPES: Array<{ label: string; value: string }> = [
  { label: "Intro", value: "INTRO" },
  { label: "Main Topic", value: "MAIN_TOPIC" },
  { label: "Guest Interview", value: "GUEST_INTERVIEW" },
  { label: "Caller Segment", value: "CALLER_SEGMENT" },
  { label: "Game", value: "GAME" },
  { label: "Ad Read", value: "AD_READ" },
  { label: "Outro", value: "OUTRO" },
];

function formatTimestamp(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) {
    return "";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.abs(Math.round(seconds % 60));
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function parseTimestamp(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes(":")) {
    const [minPart, secPart] = trimmed.split(":");
    const minutes = Number(minPart);
    const seconds = Number(secPart);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return undefined;
    }
    return minutes * 60 + seconds;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

const defaultSegmentForm = {
  title: "",
  description: "",
  startTime: "",
  endTime: "",
  segmentType: "MAIN_TOPIC",
  participants: "",
  keyQuotes: "",
  transcript: "",
};

export default function PodcastManagementPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPodcast, setSelectedPodcast] = useState<string>("all");
  const [isCreateEpisodeOpen, setIsCreateEpisodeOpen] = useState(false);
  const [isEditEpisodeOpen, setIsEditEpisodeOpen] = useState(false);
  const [isSegmentDialogOpen, setIsSegmentDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [episodeDetailTab, setEpisodeDetailTab] = useState<"segments" | "memories">("segments");
  const [selectedEpisode, setSelectedEpisode] = useState<PodcastEpisode | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<PodcastSegment | null>(null);
  const [segmentForm, setSegmentForm] = useState(defaultSegmentForm);
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
    podcastName: "Camping Them Softly",
    episodeNumber: 1,
    guestInfo: "",
    transcript: "",
    notes: ""
  });

  // Fetch episodes
  const { data: episodes = [], isLoading: episodesLoading } = useQuery<PodcastEpisode[]>({
    queryKey: ['/api/podcast/episodes'],
    refetchInterval: false,
  });

  const nextEpisodeNumber = useMemo(() => {
    if (!episodes || episodes.length === 0) {
      return 1;
    }
    return episodes.reduce((max, ep) => Math.max(max, ep.episodeNumber ?? 0), 0) + 1;
  }, [episodes]);

  // Fetch segments for selected episode
  const { data: segments = [], isLoading: segmentsLoading } = useQuery<PodcastSegment[]>({
    queryKey: ['/api/podcast/episodes', selectedEpisode?.id, 'segments'],
    enabled: !!selectedEpisode,
    refetchInterval: false,
  });

  const { data: episodeMemories, isFetching: memoriesLoading } = useQuery<EpisodeMemoriesResponse>({
    queryKey: ['/api/podcast/episodes', selectedEpisode?.id, 'memories'],
    enabled: !!selectedEpisode,
    refetchInterval: false,
  });

  useEffect(() => {
    setEpisodeDetailTab("segments");
  }, [selectedEpisode?.id]);

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
        podcastName: "Camping Them Softly",
        episodeNumber: nextEpisodeNumber + 1,
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

  // Extract facts mutation
  const extractFactsMutation = useMutation({
    mutationFn: async (episodeId: string) => {
      const response = await apiRequest('POST', `/api/podcast/episodes/${episodeId}/extract-facts`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes'] });
      if (selectedEpisode) {
        queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes', selectedEpisode.id, 'memories'] });
      }
      toast({
        title: "Facts extracted successfully!",
        description: `${data.factsCreated} facts added to Nicky's memory`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to extract facts",
        description: error?.message || "Make sure the episode has a transcript",
        variant: "destructive"
      });
    },
  });

  const createSegmentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiRequest('POST', '/api/podcast/segments', payload);
      return response.json();
    },
    onSuccess: () => {
      if (selectedEpisode) {
        queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes', selectedEpisode.id, 'segments'] });
      }
      setIsSegmentDialogOpen(false);
      setSegmentForm(defaultSegmentForm);
      toast({ title: "Segment saved", description: "Added a curated highlight to this episode." });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save segment",
        description: error?.message || "Could not create the segment",
        variant: "destructive",
      });
    },
  });

  const updateSegmentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await apiRequest('PUT', `/api/podcast/segments/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      if (selectedEpisode) {
        queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes', selectedEpisode.id, 'segments'] });
      }
      setIsSegmentDialogOpen(false);
      setSelectedSegment(null);
      setSegmentForm(defaultSegmentForm);
      toast({ title: "Segment updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update segment",
        description: error?.message || "Could not update the segment",
        variant: "destructive",
      });
    },
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/podcast/segments/${id}`);
      return response.json();
    },
    onSuccess: () => {
      if (selectedEpisode) {
        queryClient.invalidateQueries({ queryKey: ['/api/podcast/episodes', selectedEpisode.id, 'segments'] });
      }
      setIsSegmentDialogOpen(false);
      setSelectedSegment(null);
      setSegmentForm(defaultSegmentForm);
      toast({ title: "Segment removed" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete segment",
        description: error?.message || "Could not delete the segment",
        variant: "destructive",
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
      guestNames: newEpisode.guestInfo ? newEpisode.guestInfo.split(',').map(s => s.trim()).filter(Boolean) : [],
      topics: [],
      highlights: [] // Changed from keyMoments to highlights to match schema
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
        guestNames: editEpisode.guestInfo ? editEpisode.guestInfo.split(',').map(s => s.trim()).filter(Boolean) : [],
        topics: [],
        highlights: []
      }
    });
  };

  const openEditDialog = (episode: PodcastEpisode) => {
    setEditEpisode({
      title: episode.title,
      description: episode.description || "",
      episodeNumber: episode.episodeNumber ?? 0,
      guestInfo: episode.guestNames?.join(", ") || "",
      transcript: episode.transcript || "",
      notes: episode.notes || ""
    });
    setIsEditEpisodeOpen(true);
  };

  const openCreateSegmentDialog = () => {
    if (!selectedEpisode) {
      toast({
        title: "Select an episode",
        description: "Choose an episode first so the highlight can be attached.",
        variant: "destructive",
      });
      return;
    }

    setSelectedSegment(null);
    setSegmentForm(defaultSegmentForm);
    setIsSegmentDialogOpen(true);
  };

  const openEditSegmentDialog = (segment: PodcastSegment) => {
    setSelectedSegment(segment);
    setSegmentForm({
      title: segment.title,
      description: segment.description || "",
      startTime: formatTimestamp(segment.startTime),
      endTime: formatTimestamp(segment.endTime),
      segmentType: segment.segmentType || "MAIN_TOPIC",
      participants: segment.participants?.join(", ") || "",
      keyQuotes: segment.keyQuotes?.join("\n") || "",
      transcript: segment.transcript || "",
    });
    setIsSegmentDialogOpen(true);
  };

  const handleSegmentSubmit = () => {
    if (!selectedEpisode) {
      toast({
        title: "Select an episode",
        description: "Choose an episode first so the highlight can be attached.",
        variant: "destructive",
      });
      return;
    }

    if (!segmentForm.title.trim()) {
      toast({ title: "Segment title required", variant: "destructive" });
      return;
    }

    const startSeconds = parseTimestamp(segmentForm.startTime);
    if (startSeconds === undefined) {
      toast({ title: "Start time required", description: "Use MM:SS or seconds.", variant: "destructive" });
      return;
    }

    const endSeconds = parseTimestamp(segmentForm.endTime);
    const participants = segmentForm.participants
      .split(",")
      .map((participant) => participant.trim())
      .filter(Boolean);
    const keyQuotes = segmentForm.keyQuotes
      .split("\n")
      .map((quote) => quote.trim())
      .filter(Boolean);

    const payload: any = {
      episodeId: selectedEpisode.id,
      title: segmentForm.title.trim(),
      startTime: Math.max(0, Math.round(startSeconds)),
      segmentType: segmentForm.segmentType,
    };

    if (segmentForm.description.trim()) {
      payload.description = segmentForm.description.trim();
    }
    if (Number.isFinite(endSeconds)) {
      payload.endTime = Math.max(0, Math.round(endSeconds as number));
    }
    if (participants.length > 0) {
      payload.participants = participants;
    }
    if (keyQuotes.length > 0) {
      payload.keyQuotes = keyQuotes;
    }
    if (segmentForm.transcript.trim()) {
      payload.transcript = segmentForm.transcript.trim();
    }

    if (selectedSegment) {
      updateSegmentMutation.mutate({ id: selectedSegment.id, updates: payload });
    } else {
      createSegmentMutation.mutate(payload);
    }
  };

  const handleSegmentDelete = () => {
    if (selectedSegment) {
      deleteSegmentMutation.mutate(selectedSegment.id);
    }
  };

  const isSavingSegment = createSegmentMutation.isPending || updateSegmentMutation.isPending;
  const isDeletingSegment = deleteSegmentMutation.isPending;

  const filteredEpisodes = episodes.filter((episode: PodcastEpisode) => {
    const matchesSearch = episode.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      episode.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      episode.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPodcast = selectedPodcast === "all" || 
      (selectedPodcast === "Camping Them Softly" && (!episode.podcastName || episode.podcastName === "Camping Them Softly")) ||
      episode.podcastName === selectedPodcast;

    return matchesSearch && matchesPodcast;
  });

  const canExtractFacts = Boolean(selectedEpisode?.transcript && selectedEpisode.transcript.trim() !== "");
  const processingStatus = selectedEpisode?.processingStatus ?? "PENDING";
  const processingVariant = processingStatus === "COMPLETED"
    ? "secondary"
    : processingStatus === "FAILED"
      ? "destructive"
      : "outline";

  return (
    <div className="space-y-6" data-testid="podcast-management-panel">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between w-full">
        <div className="flex-1 min-w-[300px]">
          <h2 className="text-2xl font-bold">Podcast Library &amp; Memory Curation</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Import past episodes, mark standout moments, and push the best material into Nicky&apos;s memories.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Select value={selectedPodcast} onValueChange={setSelectedPodcast}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Podcast" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Podcasts</SelectItem>
              <SelectItem value="Camping Them Softly">Camping Them Softly (DbD)</SelectItem>
              <SelectItem value="Camping the Extract">Camping the Extract (ARC)</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-sync-library">
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Library
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Sync podcast episodes from RSS</DialogTitle>
                <DialogDescription>
                  Keep the library aligned with your published feed and transcripts so you can curate faster.
                </DialogDescription>
              </DialogHeader>
              <div className="-mx-6 -mb-6 mt-4">
                <PodcastRssSync />
              </div>
            </DialogContent>
          </Dialog>
          <Dialog
            open={isCreateEpisodeOpen}
            onOpenChange={(open) => {
              setIsCreateEpisodeOpen(open);
              if (open) {
                setNewEpisode({
                  title: "",
                  description: "",
                  episodeNumber: nextEpisodeNumber,
                  guestInfo: "",
                  transcript: "",
                  notes: "",
                });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="ml-0" data-testid="button-create-episode">
                <Plus className="h-4 w-4 mr-2" />
                Manual Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import existing episode</DialogTitle>
                <DialogDescription>
                  Bring an already-published episode into the library so its transcript and highlights feed the knowledge graph.
                </DialogDescription>
              </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Podcast Show</label>
                <Select 
                  value={newEpisode.podcastName} 
                  onValueChange={(val) => setNewEpisode({ ...newEpisode, podcastName: val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Podcast" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Camping Them Softly">Camping Them Softly (DbD)</SelectItem>
                    <SelectItem value="Camping the Extract">Camping the Extract (ARC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

      <Dialog
        open={isSegmentDialogOpen}
        onOpenChange={(open) => {
          setIsSegmentDialogOpen(open);
          if (!open) {
            setSegmentForm(defaultSegmentForm);
            setSelectedSegment(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedSegment ? "Edit curated segment" : "Add curated segment"}</DialogTitle>
            <DialogDescription>
              Anchor the exact timestamp, participants, and quotes you want Nicky to remember from this episode.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={segmentForm.title}
                onChange={(e) => setSegmentForm({ ...segmentForm, title: e.target.value })}
                placeholder="e.g. Beef with the Entity"
                className="mt-1"
                data-testid="input-segment-title"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Start Time *</label>
                <Input
                  value={segmentForm.startTime}
                  onChange={(e) => setSegmentForm({ ...segmentForm, startTime: e.target.value })}
                  placeholder="12:34 or 754"
                  className="mt-1"
                  data-testid="input-segment-start"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Use MM:SS or raw seconds.</p>
              </div>
              <div>
                <label className="text-sm font-medium">End Time</label>
                <Input
                  value={segmentForm.endTime}
                  onChange={(e) => setSegmentForm({ ...segmentForm, endTime: e.target.value })}
                  placeholder="16:02"
                  className="mt-1"
                  data-testid="input-segment-end"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Segment Type</label>
              <Select
                value={segmentForm.segmentType}
                onValueChange={(value) => setSegmentForm({ ...segmentForm, segmentType: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a segment type" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={segmentForm.description}
                onChange={(e) => setSegmentForm({ ...segmentForm, description: e.target.value })}
                placeholder="What happens in this moment?"
                className="mt-1"
                rows={3}
                data-testid="textarea-segment-description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Participants</label>
              <Input
                value={segmentForm.participants}
                onChange={(e) => setSegmentForm({ ...segmentForm, participants: e.target.value })}
                placeholder="Comma-separated names"
                className="mt-1"
                data-testid="input-segment-participants"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Key Quotes</label>
              <Textarea
                value={segmentForm.keyQuotes}
                onChange={(e) => setSegmentForm({ ...segmentForm, keyQuotes: e.target.value })}
                placeholder="One quote per line"
                className="mt-1"
                rows={3}
                data-testid="textarea-segment-quotes"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Transcript Snippet</label>
              <Textarea
                value={segmentForm.transcript}
                onChange={(e) => setSegmentForm({ ...segmentForm, transcript: e.target.value })}
                placeholder="Optional: paste the relevant transcript section"
                className="mt-1"
                rows={4}
                data-testid="textarea-segment-transcript"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {selectedSegment && (
              <Button
                variant="destructive"
                onClick={handleSegmentDelete}
                disabled={isDeletingSegment || isSavingSegment}
                data-testid="button-delete-segment"
              >
                {isDeletingSegment ? "Deleting..." : "Delete Segment"}
              </Button>
            )}
            <div className="flex w-full justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsSegmentDialogOpen(false)}
                disabled={isSavingSegment || isDeletingSegment}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSegmentSubmit}
                disabled={isSavingSegment || isDeletingSegment}
                data-testid="button-submit-segment"
              >
                {isSavingSegment ? "Saving..." : selectedSegment ? "Save changes" : "Create segment"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Episodes List */}
        <Card className="lg:col-span-1">
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
                              {episode.podcastName && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {episode.podcastName === 'Camping Them Softly' ? 'DbD' : 'ARC'}
                                </Badge>
                              )}
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedEpisode ? `Episode #${selectedEpisode.episodeNumber} Details` : "Select Episode"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEpisode ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="font-medium" data-testid={`selected-episode-title`}>
                        {selectedEpisode.title}
                      </h3>
                      {selectedEpisode.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedEpisode.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {selectedEpisode.publishedAt
                            ? new Date(selectedEpisode.publishedAt).toLocaleDateString()
                            : new Date(selectedEpisode.createdAt).toLocaleDateString()}
                        </div>
                        {selectedEpisode.guestInfo && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {selectedEpisode.guestInfo}
                          </div>
                        )}
                        {selectedEpisode.transcriptFilename && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {selectedEpisode.transcriptFilename}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEpisodeDetailTab("memories")}
                        data-testid="button-view-episode-memories"
                      >
                        <LinkIcon className="h-4 w-4 mr-1" />
                        Memories
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(selectedEpisode)}
                        data-testid="button-edit-episode"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {canExtractFacts && (
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
                      {canExtractFacts && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => extractFactsMutation.mutate(selectedEpisode.id)}
                          disabled={extractFactsMutation.isPending}
                          data-testid="button-extract-facts"
                          className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                        >
                          {extractFactsMutation.isPending ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-1"></div>
                          ) : (
                            <Hash className="h-4 w-4 mr-1" />
                          )}
                          {extractFactsMutation.isPending ? "Extracting..." : "Extract Facts"}
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
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">Facts {selectedEpisode.factsExtracted ?? 0}</Badge>
                    <Badge variant="secondary">Entities {selectedEpisode.entitiesExtracted ?? 0}</Badge>
                    <Badge variant={processingVariant}>Status {processingStatus}</Badge>
                    {episodeMemories && (
                      <Badge variant="outline">Memories {episodeMemories.memoriesCount}</Badge>
                    )}
                  </div>
                </div>

                <Tabs
                value={episodeDetailTab}
                onValueChange={(value) => setEpisodeDetailTab(value as 'segments' | 'memories')}
                className="space-y-4"
              >
                        <TabsList className="grid w-full grid-cols-2 md:w-auto">
                          <TabsTrigger value="segments">Segments</TabsTrigger>
                          <TabsTrigger value="memories">Memory Entries</TabsTrigger>
                        </TabsList>
                        <TabsContent value="segments" className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Curated Segments</h4>
                            <Button size="sm" onClick={openCreateSegmentDialog} data-testid="button-add-segment">
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
                                <p className="text-sm text-muted-foreground">No curated segments yet</p>
                                <p className="text-xs text-muted-foreground">Add highlights to map important beats into memory.</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {segments.map((segment: PodcastSegment) => (
                                  <Card key={segment.id} className="border-l-4 border-l-primary">
                                    <CardContent className="p-3 space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 space-y-2">
                                          <h5 className="font-medium text-sm" data-testid={`segment-title-${segment.id}`}>
                                            {segment.title}
                                          </h5>
                                          {segment.description && (
                                            <p className="text-xs text-muted-foreground">{segment.description}</p>
                                          )}
                                          <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <Badge variant="outline">{formatTimestamp(segment.startTime)}</Badge>
                                            {segment.endTime !== undefined && segment.endTime !== null && (
                                              <Badge variant="outline">→ {formatTimestamp(segment.endTime)}</Badge>
                                            )}
                                            {segment.segmentType && (
                                              <Badge variant="secondary">{segment.segmentType}</Badge>
                                            )}
                                          </div>
                                          {segment.participants && segment.participants.length > 0 && (
                                            <div className="text-[11px] text-muted-foreground">
                                              Guests: {segment.participants.join(', ')}
                                            </div>
                                          )}
                                          {segment.keyQuotes && segment.keyQuotes.length > 0 && (
                                            <div className="text-[11px] text-muted-foreground">
                                              Key quotes: {segment.keyQuotes.join(' • ')}
                                            </div>
                                          )}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0"
                                          onClick={() => openEditSegmentDialog(segment)}
                                          data-testid={`button-edit-segment-${segment.id}`}
                                        >
                                          <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </TabsContent>
                        <TabsContent value="memories" className="space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Sparkles className="h-4 w-4 text-amber-500" />
                              <span>
                                {memoriesLoading
                                  ? 'Checking stored memories…'
                                  : episodeMemories
                                    ? `${episodeMemories.memoriesCount} memories anchored to this episode.`
                                    : 'No memories captured yet.'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => extractFactsMutation.mutate(selectedEpisode.id)}
                                disabled={extractFactsMutation.isPending || !canExtractFacts}
                                data-testid="button-extract-facts-secondary"
                              >
                                {extractFactsMutation.isPending ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-1"></div>
                                ) : (
                                  <Hash className="h-4 w-4 mr-1" />
                                )}
                                {extractFactsMutation.isPending ? 'Extracting...' : 'Re-run extraction'}
                              </Button>
                            </div>
                          </div>
                          {memoriesLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            </div>
                          ) : episodeMemories && episodeMemories.memories.length > 0 ? (
                            <ScrollArea className="h-[250px] pr-2">
                              <div className="space-y-2">
                                {episodeMemories.memories.map((memory) => (
                                  <Card key={memory.id} className="border border-border/60">
                                    <CardContent className="p-3 space-y-2">
                                      <p className="text-sm text-foreground leading-snug">{memory.content}</p>
                                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                        <Badge variant="outline">{memory.type}</Badge>
                                        <Badge variant="outline">{memory.status}</Badge>
                                        {typeof memory.confidence === 'number' && (
                                          <Badge variant="outline">Confidence {memory.confidence}%</Badge>
                                        )}
                                        {memory.temporalContext && (
                                          <Badge variant="outline">{memory.temporalContext}</Badge>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          <LinkIcon className="h-3 w-3" />
                                          Source: {memory.source || 'podcast_episode'}
                                        </div>
                                        {memory.canonicalKey && (
                                          <div className="truncate">Key: {memory.canonicalKey}</div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </ScrollArea>
                          ) : (
                            <div className="rounded border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                              Run the fact extractor to push this episode into Nicky&apos;s memory bank.
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
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
    </div>
  );
}