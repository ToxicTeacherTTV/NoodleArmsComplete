import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Brain, CheckCircle, XCircle, AlertTriangle, ThumbsUp, ThumbsDown, Ban, ChevronUp, ChevronDown, Scissors, Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProtectedFactsManager } from "@/components/protected-facts-manager";

interface MemoryFact {
  id: string;
  content: string;
  confidence: number;
  supportCount: number;
  importance: number;
  status: 'ACTIVE' | 'DEPRECATED' | 'AMBIGUOUS';
  source: string;
  createdAt: string;
  canonicalKey: string;
  isProtected: boolean;
}

interface ContradictionPair {
  fact1: MemoryFact;
  fact2: MemoryFact;
  conflictReason: string;
}

export default function BrainManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 🔍 NEW: Preview cleaning mutation
  const previewCleaningMutation = useMutation({
    mutationFn: async (): Promise<{ previews: any[]; totalFound: number; previewsAvailable: number }> => {
      const response = await fetch('/api/memory/preview-cleaning');
      if (!response.ok) {
        throw new Error('Failed to preview cleaning');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCleaningPreviews(data.previews);
      setSelectedPreviewIds(new Set()); // Reset selections
      setShowPreviewDialog(true);
      
      if (data.previewsAvailable === 0) {
        toast({
          title: "No Wall-of-Text Facts Found",
          description: "All your facts are already clean!",
        });
      } else {
        toast({
          title: "Preview Ready",
          description: `Found ${data.previewsAvailable} facts that can be cleaned.`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to preview cleaning",
        variant: "destructive",
      });
    },
  });

  // ✂️ NEW: Apply selected cleaning changes mutation
  const applyCleaningMutation = useMutation({
    mutationFn: async (selectedFactIds: string[]): Promise<{ applied: number; message: string }> => {
      const response = await fetch('/api/memory/apply-cleaning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedFactIds }),
      });
      if (!response.ok) {
        throw new Error('Failed to apply cleaning');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Fix: Use same cache invalidation pattern as single apply
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] as string).startsWith('/api/memory')
      });
      setShowPreviewDialog(false);
      setCleaningPreviews([]);
      setSelectedPreviewIds(new Set());
      
      toast({
        title: "Cleaning Applied Successfully",
        description: `Cleaned ${data.applied} facts as requested.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Cleaning Failed",
        description: error.message || "Failed to apply cleaning",
        variant: "destructive",
      });
    },
  });

  // 🔧 LEGACY: Reprocess wall-of-text facts mutation (kept for backup)
  const reprocessFactsMutation = useMutation({
    mutationFn: async (): Promise<{ cleaned: number; totalFound: number; message: string }> => {
      const response = await fetch('/api/memory/reprocess-facts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to reprocess facts');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
      toast({
        title: "Facts Reprocessed Successfully",
        description: `Cleaned ${data.cleaned} wall-of-text facts out of ${data.totalFound} found.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Reprocessing Failed",
        description: error.message || "Failed to reprocess facts",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating fact content and confidence
  const updateFactMutation = useMutation({
    mutationFn: async ({ factId, content, confidence }: { factId: string; content: string; confidence: number }) => {
      const response = await fetch(`/api/memory/entries/${factId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content, confidence }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to update fact');
      }
      return response.json();
    },
    onSuccess: () => {
      // Fix: Invalidate all memory-related queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] as string).startsWith('/api/memory')
      });
      toast({
        title: "Fact updated successfully",
        description: "Changes have been saved",
      });
      setEditingFact(null);
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update fact",
        variant: "destructive",
      });
    },
  });

  // Mutation for making a fact protected
  const makeProtectedMutation = useMutation({
    mutationFn: async (factId: string) => {
      const response = await fetch(`/api/memory/entries/${factId}/protect`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to make fact protected');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all memory-related queries to refresh the UI
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] as string).startsWith('/api/memory')
      });
      toast({
        title: "Fact Protected",
        description: "This fact is now permanently protected with 100% confidence",
      });
    },
    onError: (error) => {
      toast({
        title: "Protection Failed",
        description: error.message || "Failed to protect fact",
        variant: "destructive",
      });
    },
  });

  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("protected-facts");
  const [sortBy, setSortBy] = useState<'confidence' | 'date'>('confidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Edit dialog state
  const [editingFact, setEditingFact] = useState<MemoryFact | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editConfidence, setEditConfidence] = useState(50);

  // Preview cleaning dialog state
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [cleaningPreviews, setCleaningPreviews] = useState<any[]>([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<string>>(new Set());

  // Single fact cleaning dialog state
  const [showSingleCleanDialog, setShowSingleCleanDialog] = useState(false);
  const [singleCleanPreview, setSingleCleanPreview] = useState<any>(null);

  // Function to open edit dialog
  const openEditDialog = (fact: MemoryFact) => {
    setEditingFact(fact);
    setEditContent(fact.content);
    setEditConfidence(fact.confidence);
  };

  // Function to save edited fact
  const saveEditedFact = () => {
    if (editingFact) {
      updateFactMutation.mutate({
        factId: editingFact.id,
        content: editContent,
        confidence: editConfidence
      });
    }
  };

  // Functions for preview cleaning dialog
  const togglePreviewSelection = (factId: string) => {
    const newSelected = new Set(selectedPreviewIds);
    if (newSelected.has(factId)) {
      newSelected.delete(factId);
    } else {
      newSelected.add(factId);
    }
    setSelectedPreviewIds(newSelected);
  };

  const selectAllPreviews = () => {
    setSelectedPreviewIds(new Set(cleaningPreviews.map(p => p.id)));
  };

  const deselectAllPreviews = () => {
    setSelectedPreviewIds(new Set());
  };

  const applySelectedCleaning = () => {
    if (selectedPreviewIds.size > 0) {
      applyCleaningMutation.mutate(Array.from(selectedPreviewIds));
    }
  };

  // Function to check if a fact looks like wall-of-text
  const isWallOfText = (fact: MemoryFact) => {
    const content = fact.content.toLowerCase();
    const hasUserMarkers = /(\byou\s|user:|^### |^> |what|how|why|hey nicky)/i.test(fact.content);
    const hasAIMarkers = /(nicky|assistant:|dente|noodle arms)/i.test(content);
    const isLong = fact.content.length > 300;
    
    return hasUserMarkers && hasAIMarkers && isLong;
  };

  // 🔍 NEW: Single fact cleaning preview mutation
  const previewSingleFactCleaningMutation = useMutation({
    mutationFn: async (factId: string): Promise<{ preview: any; found: boolean }> => {
      // Get the fact first
      const fact = allFacts.find(f => f.id === factId);
      if (!fact || !isWallOfText(fact)) {
        return { preview: null, found: false };
      }

      // Call the existing preview endpoint but filter for just this fact
      const response = await fetch('/api/memory/preview-cleaning');
      if (!response.ok) {
        throw new Error('Failed to preview cleaning');
      }
      const data = await response.json();
      
      // Find the preview for this specific fact
      const preview = data.previews.find((p: any) => p.id === factId);
      return { preview, found: !!preview };
    },
    onSuccess: (data) => {
      if (data.found && data.preview) {
        setSingleCleanPreview(data.preview);
        setShowSingleCleanDialog(true);
      } else {
        toast({
          title: "Already Clean",
          description: "This fact doesn't need wall-of-text cleaning.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to preview cleaning",
        variant: "destructive",
      });
    },
  });

  // ✂️ NEW: Apply single fact cleaning mutation
  const applySingleCleaningMutation = useMutation({
    mutationFn: async (factId: string): Promise<{ applied: number; message: string }> => {
      const response = await fetch('/api/memory/apply-cleaning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedFactIds: [factId] }),
      });
      if (!response.ok) {
        throw new Error('Failed to apply cleaning');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Fix: Invalidate all memory-related queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] as string).startsWith('/api/memory')
      });
      setShowSingleCleanDialog(false);
      setSingleCleanPreview(null);
      
      toast({
        title: "Fact Cleaned Successfully",
        description: "Wall-of-text content has been cleaned and simplified.",
      });
    },
    onError: (error) => {
      toast({
        title: "Cleaning Failed",
        description: error.message || "Failed to apply cleaning",
        variant: "destructive",
      });
    },
  });

  // Shared component for fact action buttons
  const FactActions = ({ fact, variant = "standard" }: { fact: MemoryFact; variant?: "standard" | "compact" }) => (
    <div className="flex items-center space-x-2">
      {variant === "compact" ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openEditDialog(fact)}
            data-testid={`button-boost-all-${fact.id}`}
            title="Edit fact"
          >
            <ThumbsUp className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => deprecateFactMutation.mutate(fact.id)}
            data-testid={`button-deprecate-all-${fact.id}`}
          >
            <ThumbsDown className="h-3 w-3" />
          </Button>
          {!fact.isProtected && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => makeProtectedMutation.mutate(fact.id)}
              disabled={makeProtectedMutation.isPending}
              data-testid={`button-protect-compact-${fact.id}`}
              title="Make Protected (100% confidence, cannot be contradicted)"
            >
              {makeProtectedMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Shield className="h-3 w-3" />
              )}
            </Button>
          )}
          {isWallOfText(fact) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => previewSingleFactCleaningMutation.mutate(fact.id)}
              disabled={previewSingleFactCleaningMutation.isPending}
              data-testid={`button-preview-clean-single-${fact.id}`}
              title="Preview clean wall-of-text"
            >
              {previewSingleFactCleaningMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Scissors className="h-3 w-3" />
              )}
            </Button>
          )}
          <input
            type="number"
            min="0"
            max="100"
            defaultValue={fact.confidence || 50}
            className="w-12 h-7 text-xs border rounded text-center"
            data-testid={`input-confidence-${fact.id}`}
            onBlur={(e) => {
              const newConfidence = parseInt(e.target.value);
              if (newConfidence >= 0 && newConfidence <= 100 && newConfidence !== fact.confidence) {
                updateFactMutation.mutate({ factId: fact.id, content: fact.content, confidence: newConfidence });
              }
            }}
            title="Manual confidence (0-100)"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </>
      ) : (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openEditDialog(fact)}
            data-testid={`button-boost-${fact.id}`}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            EDIT CONFIDENCE
          </Button>
          {!fact.isProtected && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => makeProtectedMutation.mutate(fact.id)}
              disabled={makeProtectedMutation.isPending}
              data-testid={`button-protect-${fact.id}`}
            >
              <Shield className="h-4 w-4 mr-1" />
              {makeProtectedMutation.isPending ? "PROTECTING..." : "MAKE PROTECTED"}
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => deprecateFactMutation.mutate(fact.id)}
            data-testid={`button-edit-false-${fact.id}`}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            FALSE
          </Button>
          {isWallOfText(fact) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => previewSingleFactCleaningMutation.mutate(fact.id)}
              disabled={previewSingleFactCleaningMutation.isPending}
              data-testid={`button-preview-clean-single-${fact.id}`}
            >
              {previewSingleFactCleaningMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Scissors className="h-4 w-4 mr-1" />
              )}
              CLEAN WALL-OF-TEXT
            </Button>
          )}
        </>
      )}
    </div>
  );

  // Queries
  const { data: activeProfile } = useQuery({
    queryKey: ['/api/profiles/active'],
  });

  const { data: memoryStats } = useQuery<{totalFacts: number; conversations: number}>({
    queryKey: ['/api/memory/stats'],
  });

  const { data: highConfidenceFacts = [] } = useQuery<MemoryFact[]>({
    queryKey: ['/api/memory/high-confidence'],
  });

  // 🚀 NEW: Medium confidence facts query
  const { data: mediumConfidenceFacts = [] } = useQuery<MemoryFact[]>({
    queryKey: ['/api/memory/medium-confidence'],
  });

  const { data: lowConfidenceFacts = [] } = useQuery<MemoryFact[]>({
    queryKey: ['/api/memory/low-confidence'],
  });

  const { data: contradictions = [] } = useQuery<ContradictionPair[]>({
    queryKey: ['/api/memory/contradictions'],
  });

  const { data: allFacts = [] } = useQuery<MemoryFact[]>({
    queryKey: ['/api/memory/entries'],
  });

  // Mutations

  const resolveContradictionMutation = useMutation({
    mutationFn: async ({ winnerFactId, loserFactId }: { winnerFactId: string; loserFactId: string }) => {
      const response = await fetch('/api/memory/resolve-contradiction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerFactId, loserFactId }),
      });
      return response.json();
    },
    onSuccess: () => {
      // Fix: Invalidate all memory-related queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] as string).startsWith('/api/memory')
      });
      toast({ title: "Contradiction resolved!" });
    },
  });

  const boostFactMutation = useMutation({
    mutationFn: async (factId: string) => {
      const response = await fetch(`/api/memory/entries/${factId}/boost`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      // Fix: Invalidate all memory-related queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] as string).startsWith('/api/memory')
      });
      toast({ title: "Fact boosted progressively (85→90→95→100)!" });
    },
  });

  const deprecateFactMutation = useMutation({
    mutationFn: async (factId: string) => {
      const response = await fetch(`/api/memory/entries/${factId}/deprecate`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      // Fix: Invalidate all memory-related queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] as string).startsWith('/api/memory')
      });
      toast({ title: "Fact marked as FALSE - deprecated!" });
    },
  });

  // 🚀 NEW: Sort and filter facts with story groupings
  const sortFacts = (facts: MemoryFact[]) => {
    const sorted = [...facts].sort((a, b) => {
      if (sortBy === 'confidence') {
        return sortOrder === 'desc' ? (b.confidence || 0) - (a.confidence || 0) : (a.confidence || 0) - (b.confidence || 0);
      } else {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      }
    });
    return sorted;
  };

  // Group facts by story context if available
  const groupFactsByStory = (facts: MemoryFact[]) => {
    const grouped: { [key: string]: MemoryFact[] } = {};
    
    facts.forEach(fact => {
      // Extract story context from source or content
      let storyKey = 'General Facts';
      
      // 🔧 IMPROVED: Better location detection for Berlin/Germany content
      const content = fact.content.toLowerCase();
      const source = fact.source?.toLowerCase() || '';
      
      // Check for specific locations first
      if (content.includes('berlin') || source.includes('berlin') || 
          content.includes('germany') || source.includes('germany')) {
        storyKey = 'Berlin/Germany Stories';
      } else if (content.includes('paris') || source.includes('paris') || 
                 content.includes('france') || source.includes('france')) {
        storyKey = 'Paris/France Stories';
      } else if (content.includes('tokyo') || source.includes('tokyo') || 
                 content.includes('japan') || source.includes('japan')) {
        storyKey = 'Tokyo/Japan Stories';
      }
      // Then check for story types
      else if (content.includes('episode') || content.includes('stream')) {
        storyKey = 'Stream Episodes';
      } else if (content.includes('backstory') || content.includes('origin')) {
        storyKey = 'Character Backstory';
      } else if (content.includes('personality') || content.includes('behavior') || 
                content.includes('trait') || content.includes('characteristic')) {
        storyKey = 'Personality Traits';
      } else if (content.includes('conversation') || content.includes('dialogue') || 
                content.includes('said') || content.includes('asked')) {
        storyKey = 'Conversations';
      }
      // Parse filename for additional context
      else if (fact.source && fact.source.includes('_')) {
        const parts = fact.source.replace('.txt', '').split('_');
        if (parts.length > 2) {
          storyKey = parts.slice(1).join(' ').replace(/\b\w/g, l => l.toUpperCase());
        }
      }
      
      if (!grouped[storyKey]) {
        grouped[storyKey] = [];
      }
      grouped[storyKey].push(fact);
    });
    
    return grouped;
  };

  const filteredFacts = (facts: MemoryFact[] = []) => {
    if (!searchQuery) return sortFacts(facts);
    const filtered = facts.filter(fact => 
      fact.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return sortFacts(filtered);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "bg-green-500";
    if (confidence >= 70) return "bg-blue-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 90) return "Very High";
    if (confidence >= 70) return "High";
    if (confidence >= 60) return "Medium";
    return "Low";
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-purple-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Nicky's Brain Management
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {memoryStats?.totalFacts || 0} total facts
              </div>
              <Button 
                variant="outline" 
                onClick={() => setLocation("/")}
                data-testid="button-back"
              >
                Back to Chat
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar & Sorting Controls */}
        <div className="mb-8 space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search Nicky's knowledge..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={sortBy === 'confidence' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('confidence')}
                data-testid="sort-by-confidence"
              >
                Sort by Confidence
              </Button>
              <Button
                variant={sortBy === 'date' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('date')}
                data-testid="sort-by-date"
              >
                Sort by Date
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                data-testid="toggle-sort-order"
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </Button>
              <Button
                onClick={() => previewCleaningMutation.mutate()}
                disabled={previewCleaningMutation.isPending}
                variant="outline"
                size="sm"
                data-testid="button-preview-cleaning"
              >
                {previewCleaningMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Scissors className="h-4 w-4 mr-2" />
                    Preview Clean Wall-of-Text
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="protected-facts" data-testid="tab-protected-facts">
              Protected Facts
            </TabsTrigger>
            <TabsTrigger value="high-confidence" data-testid="tab-high-confidence">
              High Confidence (90%+)
            </TabsTrigger>
            <TabsTrigger value="medium-confidence" data-testid="tab-medium-confidence">
              Medium Confidence (60-89%)
            </TabsTrigger>
            <TabsTrigger value="low-confidence" data-testid="tab-low-confidence">
              Low Confidence (0-59%)
            </TabsTrigger>
            <TabsTrigger value="contradictions" data-testid="tab-contradictions">
              Contradictions ({contradictions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="all-facts" data-testid="tab-all-facts">
              All Facts
            </TabsTrigger>
          </TabsList>

          {/* Protected Facts */}
          <TabsContent value="protected-facts" className="mt-6">
            <ProtectedFactsManager />
          </TabsContent>

          {/* High Confidence Facts */}
          <TabsContent value="high-confidence" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Highest Confidence Facts (90%+)</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  These are the facts Nicky relies on most - they have the highest confidence from multiple sources.
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {/* 🚀 NEW: Story-grouped facts */}
                  {Object.entries(groupFactsByStory(filteredFacts(highConfidenceFacts))).map(([storyKey, facts]) => (
                    <div key={storyKey} className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 text-purple-600 dark:text-purple-400 border-b border-purple-200 dark:border-purple-800 pb-2">
                        📖 {storyKey}
                      </h3>
                      <div className="space-y-4">
                        {facts.map((fact: MemoryFact) => (
                          <div
                            key={fact.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                          >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Badge className={getConfidenceColor(fact.confidence)}>
                              {fact.confidence}% {getConfidenceLabel(fact.confidence)}
                            </Badge>
                            <Badge variant="outline">
                              {fact.supportCount} sources
                            </Badge>
                            <Badge variant="secondary">
                              Importance: {fact.importance}
                            </Badge>
                          </div>
                          <FactActions fact={fact} />
                        </div>
                        <Progress value={fact.confidence} className="w-full mb-3" />
                        <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                          {fact.content}
                        </p>
                        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                          Source: {fact.source} • Created: {new Date(fact.createdAt).toLocaleDateString()}
                        </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 🚀 NEW: Medium Confidence Facts */}
          <TabsContent value="medium-confidence" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Medium Confidence Facts (60-89%)</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  These facts need more verification but show promising confidence levels.
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {/* Story-grouped medium confidence facts */}
                  {Object.entries(groupFactsByStory(filteredFacts(mediumConfidenceFacts))).map(([storyKey, facts]) => (
                    <div key={storyKey} className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 text-blue-600 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2">
                        📖 {storyKey}
                      </h3>
                      <div className="space-y-4">
                        {facts.map((fact: MemoryFact) => (
                          <div
                            key={fact.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                          >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Badge className={getConfidenceColor(fact.confidence)}>
                              {fact.confidence}% {getConfidenceLabel(fact.confidence)}
                            </Badge>
                            <Badge variant="outline">
                              Support: {fact.supportCount}
                            </Badge>
                          </div>
                          <FactActions fact={fact} />
                        </div>
                        <Progress value={fact.confidence} className="w-full mb-3" />
                        <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                          {fact.content}
                        </p>
                        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                          Source: {fact.source} • Created: {new Date(fact.createdAt).toLocaleDateString()}
                        </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 🚀 NEW: Low Confidence Facts */}
          <TabsContent value="low-confidence" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Low Confidence Facts (0-59%)</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  These facts need significant verification or may be questionable.
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {/* Story-grouped low confidence facts */}
                  {Object.entries(groupFactsByStory(filteredFacts(lowConfidenceFacts))).map(([storyKey, facts]) => (
                    <div key={storyKey} className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-800 pb-2">
                        📖 {storyKey}
                      </h3>
                      <div className="space-y-4">
                        {facts.map((fact: MemoryFact) => (
                          <div
                            key={fact.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                          >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Badge className={getConfidenceColor(fact.confidence)}>
                              {fact.confidence}% {getConfidenceLabel(fact.confidence)}
                            </Badge>
                            <Badge variant="outline">
                              Support: {fact.supportCount}
                            </Badge>
                          </div>
                          <FactActions fact={fact} />
                        </div>
                        <Progress value={fact.confidence} className="w-full mb-3" />
                        <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                          {fact.content}
                        </p>
                        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                          Source: {fact.source} • Created: {new Date(fact.createdAt).toLocaleDateString()}
                        </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contradictions */}
          <TabsContent value="contradictions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                  Conflicting Facts
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  These facts contradict each other. Choose which one is correct or mark conflicts as "not important."
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-6">
                    {contradictions?.map((pair: ContradictionPair, index: number) => (
                      <div
                        key={index}
                        className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20"
                      >
                        <div className="mb-4">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                            Contradiction: {pair.conflictReason}
                          </h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Fact 1 */}
                          <div className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800">
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={getConfidenceColor(pair.fact1.confidence)}>
                                {pair.fact1.confidence}% confidence
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resolveContradictionMutation.mutate({
                                  winnerFactId: pair.fact1.id,
                                  loserFactId: pair.fact2.id
                                })}
                                data-testid={`button-choose-${pair.fact1.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Choose This
                              </Button>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-gray-100">
                              {pair.fact1.content}
                            </p>
                            <div className="mt-2 text-xs text-gray-500">
                              {pair.fact1.supportCount} sources • {pair.fact1.source}
                            </div>
                          </div>

                          {/* Fact 2 */}
                          <div className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800">
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={getConfidenceColor(pair.fact2.confidence)}>
                                {pair.fact2.confidence}% confidence
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resolveContradictionMutation.mutate({
                                  winnerFactId: pair.fact2.id,
                                  loserFactId: pair.fact1.id
                                })}
                                data-testid={`button-choose-${pair.fact2.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Choose This
                              </Button>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-gray-100">
                              {pair.fact2.content}
                            </p>
                            <div className="mt-2 text-xs text-gray-500">
                              {pair.fact2.supportCount} sources • {pair.fact2.source}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-center">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              // Mark both as not important
                              updateFactMutation.mutate({ 
                                factId: pair.fact1.id, 
                                content: pair.fact1.content,
                                confidence: 1 
                              });
                              updateFactMutation.mutate({ 
                                factId: pair.fact2.id, 
                                content: pair.fact2.content,
                                confidence: 1 
                              });
                            }}
                            data-testid={`button-not-important-${index}`}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            Mark as Not Important
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Facts */}
          <TabsContent value="all-facts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Facts Browser</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Browse and manage all facts in Nicky's knowledge base.
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {filteredFacts(allFacts)?.map((fact: MemoryFact) => (
                      <div
                        key={fact.id}
                        className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge className={getConfidenceColor(fact.confidence)}>
                              {fact.confidence}%
                            </Badge>
                            <Badge variant="outline">{fact.status}</Badge>
                          </div>
                          <FactActions fact={fact} variant="compact" />
                        </div>
                        <p className="text-sm text-gray-900 dark:text-gray-100 mb-2 leading-relaxed">
                          {fact.content}
                        </p>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {fact.supportCount} sources • Importance: {fact.importance} • {fact.source}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Single Fact Cleaning Dialog */}
      <Dialog open={showSingleCleanDialog} onOpenChange={(open) => !open && setShowSingleCleanDialog(false)}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Preview Wall-of-Text Cleaning</DialogTitle>
            <DialogDescription>
              Review the proposed changes to clean up this wall-of-text fact.
            </DialogDescription>
          </DialogHeader>
          
          {singleCleanPreview && (
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before */}
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600 dark:text-red-400">Before (Wall-of-Text)</h4>
                  <div className="p-3 border border-red-200 dark:border-red-800 rounded bg-red-50 dark:bg-red-900/20">
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {singleCleanPreview.original}
                    </p>
                  </div>
                </div>

                {/* After */}
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600 dark:text-green-400">After (Cleaned)</h4>
                  <div className="p-3 border border-green-200 dark:border-green-800 rounded bg-green-50 dark:bg-green-900/20">
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {singleCleanPreview.cleaned}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowSingleCleanDialog(false)}
              data-testid="button-cancel-single-clean"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => applySingleCleaningMutation.mutate(singleCleanPreview?.id)}
              disabled={applySingleCleaningMutation.isPending}
              data-testid="button-apply-single-clean"
            >
              {applySingleCleaningMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Apply Cleaning
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Fact Dialog */}
      <Dialog open={!!editingFact} onOpenChange={(open) => !open && setEditingFact(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Fact</DialogTitle>
            <DialogDescription>
              Modify the fact content and adjust its confidence level.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="edit-content" className="text-sm font-medium">
                Content
              </label>
              <Textarea
                id="edit-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Enter fact content..."
                className="min-h-[100px]"
                data-testid="textarea-edit-content"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-confidence" className="text-sm font-medium">
                Confidence: {editConfidence}%
              </label>
              <Slider
                id="edit-confidence"
                min={0}
                max={100}
                step={1}
                value={[editConfidence]}
                onValueChange={(value) => setEditConfidence(value[0])}
                className="w-full"
                data-testid="slider-edit-confidence"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0% (False)</span>
                <span>50% (Uncertain)</span>
                <span>100% (Absolutely True)</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingFact(null)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={saveEditedFact}
              disabled={updateFactMutation.isPending || !editContent.trim()}
              data-testid="button-save-edit"
            >
              {updateFactMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Cleaning Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => !open && setShowPreviewDialog(false)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Wall-of-Text Cleaning</DialogTitle>
            <DialogDescription>
              Review the proposed changes before applying them. Select which facts you want to clean.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Selection Controls */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllPreviews}
                  data-testid="button-select-all-previews"
                >
                  Select All ({cleaningPreviews.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAllPreviews}
                  data-testid="button-deselect-all-previews"
                >
                  Deselect All
                </Button>
              </div>
              <div className="text-sm text-gray-600">
                {selectedPreviewIds.size} of {cleaningPreviews.length} selected
              </div>
            </div>

            {/* Preview List */}
            <ScrollArea className="max-h-96">
              {cleaningPreviews.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No wall-of-text facts found to clean.
                </div>
              ) : (
                <div className="space-y-4">
                  {cleaningPreviews.map((preview) => (
                    <div
                      key={preview.id}
                      className={`border rounded-lg p-4 ${
                        selectedPreviewIds.has(preview.id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          checked={selectedPreviewIds.has(preview.id)}
                          onCheckedChange={() => togglePreviewSelection(preview.id)}
                          data-testid={`checkbox-preview-${preview.id}`}
                        />
                        <div className="flex-1 space-y-3">
                          {/* Metadata */}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Confidence: {preview.confidence}% • Source: {preview.source}</span>
                            <span>{preview.originalLength} → {preview.cleanedLength} chars</span>
                          </div>
                          
                          {/* Before */}
                          <div>
                            <label className="text-sm font-medium text-red-700 dark:text-red-400">
                              📝 Original (Wall-of-Text):
                            </label>
                            <div className="mt-1 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm">
                              {preview.original}
                            </div>
                          </div>
                          
                          {/* Arrow */}
                          <div className="flex justify-center">
                            <div className="text-gray-400">↓</div>
                          </div>
                          
                          {/* After */}
                          <div>
                            <label className="text-sm font-medium text-green-700 dark:text-green-400">
                              ✨ Cleaned Version:
                            </label>
                            <div className="mt-1 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded text-sm">
                              {preview.cleaned}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
              data-testid="button-cancel-preview"
            >
              Cancel
            </Button>
            <Button
              onClick={applySelectedCleaning}
              disabled={applyCleaningMutation.isPending || selectedPreviewIds.size === 0}
              data-testid="button-apply-cleaning"
            >
              {applyCleaningMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                `Apply Changes (${selectedPreviewIds.size})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}