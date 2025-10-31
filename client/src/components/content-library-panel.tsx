import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, Tag, BookOpen, Eye, Edit2, Trash2, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ContentLibraryEntry {
  id: string;
  profileId: string;
  title: string;
  content: string;
  category: 'AITA' | 'REDDIT_STORY' | 'ENTERTAINMENT' | 'OTHER';
  source: string;
  sourceId?: string;
  tags: string[];
  length: 'SHORT' | 'MEDIUM' | 'LONG';
  mood: 'FUNNY' | 'DRAMATIC' | 'MYSTERIOUS' | 'HEARTWARMING' | 'NEUTRAL';
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ContentLibraryPanelProps {
  profileId?: string;
}

export default function ContentLibraryPanel({ profileId }: ContentLibraryPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLength, setSelectedLength] = useState<string>("all");
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [viewingContent, setViewingContent] = useState<ContentLibraryEntry | null>(null);
  const [editingContent, setEditingContent] = useState<ContentLibraryEntry | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    category: "" as ContentLibraryEntry['category'],
    mood: "" as ContentLibraryEntry['mood'],
    tags: ""
  });

  // Fetch content library entries
  const { data: contentEntries, isLoading } = useQuery({
    queryKey: ['/api/content-library'],
    queryFn: async (): Promise<ContentLibraryEntry[]> => {
      const response = await fetch('/api/content-library');
      if (!response.ok) throw new Error('Failed to fetch content library');
      return response.json();
    },
    enabled: !!profileId,
  });

  // Filter content entries
  const filteredEntries = useMemo(() => {
    if (!contentEntries || !Array.isArray(contentEntries)) return [];
    
    return contentEntries.filter(entry => {
      const matchesSearch = !searchTerm.trim() || 
        entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
      const matchesLength = selectedLength === 'all' || entry.length === selectedLength;
      const matchesMood = selectedMood === 'all' || entry.mood === selectedMood;
      
      return matchesSearch && matchesCategory && matchesLength && matchesMood;
    });
  }, [contentEntries, searchTerm, selectedCategory, selectedLength, selectedMood]);

  // Delete content mutation
  const deleteContentMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const response = await fetch(`/api/content-library/${contentId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete content');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-library'] });
      toast({
        title: "Content Deleted",
        description: "Content has been removed from the library",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update content mutation
  const updateContentMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ContentLibraryEntry> }) => {
      const response = await fetch(`/api/content-library/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.updates),
      });
      if (!response.ok) throw new Error('Failed to update content');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-library'] });
      setEditingContent(null);
      toast({
        title: "Content Updated",
        description: "Changes have been saved",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (entry: ContentLibraryEntry) => {
    setEditingContent(entry);
    setEditForm({
      title: entry.title,
      content: entry.content,
      category: entry.category,
      mood: entry.mood,
      tags: entry.tags.join(', ')
    });
  };

  const handleSaveEdit = () => {
    if (!editingContent) return;
    
    updateContentMutation.mutate({
      id: editingContent.id,
      updates: {
        title: editForm.title,
        content: editForm.content,
        category: editForm.category,
        mood: editForm.mood,
        tags: editForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      }
    });
  };

  const getCategoryColor = (category: ContentLibraryEntry['category']) => {
    switch (category) {
      case 'AITA': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'REDDIT_STORY': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'ENTERTAINMENT': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'OTHER': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getLengthIcon = (length: ContentLibraryEntry['length']) => {
    switch (length) {
      case 'SHORT': return '📝';
      case 'MEDIUM': return '📄';
      case 'LONG': return '📚';
      default: return '📄';
    }
  };

  const getMoodIcon = (mood: ContentLibraryEntry['mood']) => {
    switch (mood) {
      case 'FUNNY': return '😂';
      case 'DRAMATIC': return '🎭';
      case 'MYSTERIOUS': return '🕵️';
      case 'HEARTWARMING': return '❤️';
      case 'NEUTRAL': return '😐';
      default: return '😐';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="flex-1 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Content Library</h2>
        <Badge variant="secondary" data-testid="content-count">
          {filteredEntries.length} of {contentEntries?.length || 0} entries
        </Badge>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-content-search"
          />
        </div>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger data-testid="select-category-filter">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="AITA">AITA</SelectItem>
            <SelectItem value="REDDIT_STORY">Reddit Stories</SelectItem>
            <SelectItem value="ENTERTAINMENT">Entertainment</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedLength} onValueChange={setSelectedLength}>
          <SelectTrigger data-testid="select-length-filter">
            <SelectValue placeholder="All Lengths" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lengths</SelectItem>
            <SelectItem value="SHORT">Short</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LONG">Long</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedMood} onValueChange={setSelectedMood}>
          <SelectTrigger data-testid="select-mood-filter">
            <SelectValue placeholder="All Moods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Moods</SelectItem>
            <SelectItem value="FUNNY">Funny</SelectItem>
            <SelectItem value="DRAMATIC">Dramatic</SelectItem>
            <SelectItem value="MYSTERIOUS">Mysterious</SelectItem>
            <SelectItem value="HEARTWARMING">Heartwarming</SelectItem>
            <SelectItem value="NEUTRAL">Neutral</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={() => {
            setSearchTerm("");
            setSelectedCategory("all");
            setSelectedLength("all");
            setSelectedMood("all");
          }}
          variant="outline"
          size="sm"
          data-testid="button-clear-filters"
        >
          <Filter className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => (
            <Card key={entry.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-medium text-foreground truncate">
                    {entry.title}
                  </CardTitle>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Button
                      onClick={() => setViewingContent(entry)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      data-testid={`button-view-${entry.id}`}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      onClick={() => handleEdit(entry)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      data-testid={`button-edit-${entry.id}`}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      onClick={() => deleteContentMutation.mutate(entry.id)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      data-testid={`button-delete-${entry.id}`}
                      disabled={deleteContentMutation.isPending && deleteContentMutation.variables === entry.id}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getCategoryColor(entry.category)} data-testid={`badge-category-${entry.id}`}>
                    {entry.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {getLengthIcon(entry.length)} {entry.length}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {getMoodIcon(entry.mood)} {entry.mood}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {entry.content.substring(0, 100)}...
                </p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatTimeAgo(entry.createdAt)}</span>
                  <span>{entry.usageCount || 0} uses</span>
                </div>
                
                {entry.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {entry.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {entry.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        +{entry.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchTerm || selectedCategory !== 'all' || selectedLength !== 'all' || selectedMood !== 'all'
                ? "No content matches your filters"
                : "No content in your library yet. Upload documents and choose 'Save as Content Library' to get started."}
            </p>
          </div>
        )}
      </div>

      {/* View Content Dialog */}
      <Dialog open={!!viewingContent} onOpenChange={() => setViewingContent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingContent?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getCategoryColor(viewingContent?.category!)}>
                {viewingContent?.category}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {getLengthIcon(viewingContent?.length!)} {viewingContent?.length}
              </span>
              <span className="text-sm text-muted-foreground">
                {getMoodIcon(viewingContent?.mood!)} {viewingContent?.mood}
              </span>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap">{viewingContent?.content}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Added {formatTimeAgo(viewingContent?.createdAt!)}</span>
              <span>•</span>
              <span>{viewingContent?.usageCount || 0} uses</span>
            </div>
            {viewingContent?.tags && viewingContent.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {viewingContent.tags.map((tag, index) => (
                  <Badge key={index} variant="outline">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Content Dialog */}
      <Dialog open={!!editingContent} onOpenChange={() => setEditingContent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Content title"
                data-testid="input-edit-title"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value as ContentLibraryEntry['category'] }))}
                >
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AITA">AITA</SelectItem>
                    <SelectItem value="REDDIT_STORY">Reddit Story</SelectItem>
                    <SelectItem value="ENTERTAINMENT">Entertainment</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Mood</label>
                <Select
                  value={editForm.mood}
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, mood: value as ContentLibraryEntry['mood'] }))}
                >
                  <SelectTrigger data-testid="select-edit-mood">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FUNNY">Funny</SelectItem>
                    <SelectItem value="DRAMATIC">Dramatic</SelectItem>
                    <SelectItem value="MYSTERIOUS">Mysterious</SelectItem>
                    <SelectItem value="HEARTWARMING">Heartwarming</SelectItem>
                    <SelectItem value="NEUTRAL">Neutral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
              <Input
                value={editForm.tags}
                onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="tag1, tag2, tag3"
                data-testid="input-edit-tags"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <Textarea
                value={editForm.content}
                onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                rows={8}
                className="resize-none"
                data-testid="textarea-edit-content"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setEditingContent(null)}
                variant="outline"
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateContentMutation.isPending && updateContentMutation.variables?.id === editingContent?.id}
                data-testid="button-save-edit"
              >
                {updateContentMutation.isPending && updateContentMutation.variables?.id === editingContent?.id ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}