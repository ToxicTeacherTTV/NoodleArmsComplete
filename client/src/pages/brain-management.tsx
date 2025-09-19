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
import { Search, Brain, CheckCircle, XCircle, AlertTriangle, ThumbsUp, ThumbsDown, Ban, ChevronUp, ChevronDown, Scissors, Loader2, Shield, Copy, Merge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProtectedFactsManager } from "@/components/protected-facts-manager";
import MemoryPanel from "@/components/memory-panel";
import DocumentPanel from "@/components/document-panel";
import PersonalityPanel from "@/components/personality-panel";

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

interface ContradictionGroup {
  groupId: string;
  facts: MemoryFact[];
  primaryFact: MemoryFact;
  conflictingFacts: MemoryFact[];
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
}

export default function BrainManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get active profile and other data needed for moved components
  const { data: activeProfile } = useQuery({
    queryKey: ['/api/profiles/active'],
    refetchInterval: false,
  });

  const { data: memoryStats } = useQuery({
    queryKey: ['/api/memory/stats'],
    refetchInterval: 120000,
  });

  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
    refetchInterval: false,
  });

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

  // Mutation for scanning all facts for contradictions
  const scanContradictionsMutation = useMutation({
    mutationFn: async (): Promise<{ found: number; message: string }> => {
      const response = await fetch('/api/memory/scan-contradictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to scan for contradictions');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] as string).startsWith('/api/memory')
      });
      toast({
        title: "Contradiction Scan Complete",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Scan Failed",
        description: error.message || "Failed to scan for contradictions",
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

  // Flag management state
  const [selectedFlagType, setSelectedFlagType] = useState<string>('all');
  const [flagSearchTerm, setFlagSearchTerm] = useState<string>('');
  
  // Duplicates state
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.8);
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([]);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [autoMergeInProgress, setAutoMergeInProgress] = useState(false);

  // Find duplicates mutation
  const findDuplicatesMutation = useMutation({
    mutationFn: async (threshold: number) => {
      const response = await fetch(`/api/memory/duplicates?threshold=${threshold}`);
      if (!response.ok) throw new Error('Failed to find duplicates');
      return response.json();
    },
    onSuccess: (data) => {
      setDuplicateGroups(data.groups || []);
      setIsLoadingDuplicates(false);
      toast({
        title: "Duplicates Found",
        description: `Found ${data.groups?.length || 0} groups of similar memories`,
      });
    },
    onError: (error) => {
      setIsLoadingDuplicates(false);
      toast({
        title: "Error Finding Duplicates",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto merge mutation
  const autoMergeMutation = useMutation({
    mutationFn: async (threshold: number) => {
      const response = await fetch('/api/memory/auto-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold }),
      });
      if (!response.ok) throw new Error('Failed to auto-merge');
      return response.json();
    },
    onSuccess: (data) => {
      setAutoMergeInProgress(false);
      queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
      toast({
        title: "Auto-merge Complete",
        description: `Merged ${data.mergedCount || 0} groups of duplicates`,
      });
      // Refresh duplicate search
      if (duplicateGroups.length > 0) {
        findDuplicatesMutation.mutate(similarityThreshold);
      }
    },
    onError: (error) => {
      setAutoMergeInProgress(false);
      toast({
        title: "Auto-merge Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manual merge mutation
  const manualMergeMutation = useMutation({
    mutationFn: async ({ primaryId, duplicateIds }: { primaryId: string; duplicateIds: string[] }) => {
      const response = await fetch('/api/memory/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId, duplicateIds }),
      });
      if (!response.ok) throw new Error('Failed to merge memories');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
      toast({
        title: "Memories Merged",
        description: `Successfully merged ${data.mergedCount} memories`,
      });
      // Refresh duplicate search
      findDuplicatesMutation.mutate(similarityThreshold);
    },
    onError: (error) => {
      toast({
        title: "Merge Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch flags data
  const { data: flagsData } = useQuery({
    queryKey: ['/api/flags/pending'],
    queryFn: async () => {
      const response = await fetch('/api/flags/pending?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch flags');
      return response.json();
    },
  });

  // Fetch flag analytics
  const { data: flagAnalytics } = useQuery({
    queryKey: ['/api/flags/analytics'],
    queryFn: async () => {
      const response = await fetch('/api/flags/analytics');
      if (!response.ok) throw new Error('Failed to fetch flag analytics');
      return response.json();
    },
  });

  // Flag review mutation
  const reviewFlagMutation = useMutation({
    mutationFn: async ({ flagId, reviewStatus, notes }: { flagId: string; reviewStatus: 'APPROVED' | 'REJECTED'; notes?: string }) => {
      const response = await apiRequest('PUT', `/api/flags/${flagId}/review`, {
        reviewStatus,
        reviewNotes: notes || '',
        reviewedBy: 'user'
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flags/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/flags/analytics'] });
      toast({ title: "Flag reviewed successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to review flag", variant: "destructive" });
    },
  });

  // Batch importance review mutation
  const batchImportanceReviewMutation = useMutation({
    mutationFn: async ({ 
      targetType, 
      targetId, 
      selectedImportance, 
      notes 
    }: { 
      targetType: string; 
      targetId: string; 
      selectedImportance: 'high_importance' | 'medium_importance' | 'low_importance'; 
      notes?: string;
    }) => {
      const response = await apiRequest('PUT', '/api/flags/importance/batch-review', {
        targetType,
        targetId,
        selectedImportance,
        reviewedBy: 'user',
        reviewNotes: notes
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/flags/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/flags/analytics'] });
      toast({ title: `Importance set! ${data.message}` });
    },
    onError: () => {
      toast({ title: "Failed to review importance flags", variant: "destructive" });
    },
  });

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

  // activeProfile and memoryStats already declared above

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

  const { data: contradictions = [] } = useQuery<ContradictionGroup[]>({
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
          <TabsList className="grid w-full grid-cols-6 lg:grid-cols-11">
            <TabsTrigger value="recent-memories" data-testid="tab-recent-memories" className="text-xs">
              📝 Recent
            </TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents" className="text-xs">
              📁 Docs
            </TabsTrigger>
            <TabsTrigger value="identity" data-testid="tab-identity" className="text-xs">
              🎭 Identity
            </TabsTrigger>
            <TabsTrigger value="protected-facts" data-testid="tab-protected-facts" className="text-xs">
              🛡️ Protected
            </TabsTrigger>
            <TabsTrigger value="high-confidence" data-testid="tab-high-confidence" className="text-xs">
              ✅ High (90%+)
            </TabsTrigger>
            <TabsTrigger value="medium-confidence" data-testid="tab-medium-confidence" className="text-xs">
              ⚠️ Med (60-89%)
            </TabsTrigger>
            <TabsTrigger value="low-confidence" data-testid="tab-low-confidence" className="text-xs">
              ❓ Low (0-59%)
            </TabsTrigger>
            <TabsTrigger value="contradictions" data-testid="tab-contradictions" className="text-xs">
              🔥 Conflicts ({contradictions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="flags" data-testid="tab-flags" className="text-xs">
              🚩 Flags ({flagsData?.count || 0})
            </TabsTrigger>
            <TabsTrigger value="duplicates" data-testid="tab-duplicates" className="text-xs">
              📋 Dupes
            </TabsTrigger>
            <TabsTrigger value="all-facts" data-testid="tab-all-facts" className="text-xs">
              🧠 All Facts
            </TabsTrigger>
          </TabsList>

          {/* Recent Memories */}
          <TabsContent value="recent-memories" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Memories</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Latest memories and interactions with quick search
                </p>
              </CardHeader>
              <CardContent>
                <MemoryPanel
                  profileId={activeProfile?.id}
                  memoryStats={memoryStats}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Management</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Upload and process documents to extract knowledge
                </p>
              </CardHeader>
              <CardContent>
                <DocumentPanel
                  profileId={activeProfile?.id}
                  documents={documents}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Identity & Core Personality */}
          <TabsContent value="identity" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Core Identity & Personality</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Manage the AI's core personality traits and identity
                </p>
              </CardHeader>
              <CardContent>
                <PersonalityPanel
                  profile={activeProfile}
                  onOpenProfileManager={() => {/* Navigate to profile management or show modal */}}
                  onResetChat={() => {/* This could be moved or handled differently in brain management */}}
                />
              </CardContent>
            </Card>
          </TabsContent>

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
                {contradictions.length === 0 && (
                  <div className="mt-4">
                    <Button
                      onClick={() => scanContradictionsMutation.mutate()}
                      disabled={scanContradictionsMutation.isPending}
                      data-testid="button-scan-contradictions"
                    >
                      {scanContradictionsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing Facts with AI...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-2" />
                          Scan All Facts for Contradictions
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      This will analyze your existing {allFacts.length} facts using AI to detect semantic contradictions
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-6">
                    {contradictions?.map((group: ContradictionGroup, index: number) => (
                      <div
                        key={group.groupId}
                        className={`border rounded-lg p-4 ${
                          group.severity === 'HIGH' 
                            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                            : group.severity === 'MEDIUM'
                            ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20' 
                            : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
                        }`}
                      >
                        <div className="mb-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                              Contradiction Group: {group.explanation}
                            </h4>
                            <Badge variant={group.severity === 'HIGH' ? 'destructive' : group.severity === 'MEDIUM' ? 'default' : 'secondary'}>
                              {group.severity} Priority
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Found {group.facts.length} conflicting facts about the same topic
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          {/* Primary Fact (if marked) */}
                          {group.primaryFact && group.primaryFact.status === 'ACTIVE' && (
                            <div className="border border-green-200 dark:border-green-700 rounded p-3 bg-green-50 dark:bg-green-900/20">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                    PRIMARY ({group.primaryFact.confidence}% confidence)
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                {group.primaryFact.content}
                              </p>
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                {group.primaryFact.supportCount} sources • {group.primaryFact.source}
                              </div>
                            </div>
                          )}
                          
                          {/* Conflicting Facts */}
                          {group.facts.filter(f => f.id !== group.primaryFact?.id || group.primaryFact?.status !== 'ACTIVE').map((fact) => (
                            <div key={fact.id} className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <Badge className={getConfidenceColor(fact.confidence)}>
                                    {fact.confidence}% confidence
                                  </Badge>
                                  <Badge variant={fact.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                    {fact.status}
                                  </Badge>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => resolveContradictionMutation.mutate({
                                    winnerFactId: fact.id,
                                    loserFactId: group.facts.find(f => f.id !== fact.id)?.id || ''
                                  })}
                                  data-testid={`button-choose-${fact.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Make Primary
                                </Button>
                              </div>
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                {fact.content}
                              </p>
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                {fact.supportCount} sources • {fact.source}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-4 flex justify-center">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              // Mark all facts in group as low confidence
                              group.facts.forEach(fact => {
                                updateFactMutation.mutate({ 
                                  factId: fact.id, 
                                  content: fact.content,
                                  confidence: 1 
                                });
                              });
                            }}
                            data-testid={`button-dismiss-group-${group.groupId}`}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            Dismiss Group
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Flags Tab */}
          <TabsContent value="flags" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Content Flags ({flagsData?.count || 0})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search flags..."
                      value={flagSearchTerm}
                      onChange={(e) => setFlagSearchTerm(e.target.value)}
                      className="w-48"
                      data-testid="input-flag-search"
                    />
                    <select
                      value={selectedFlagType}
                      onChange={(e) => setSelectedFlagType(e.target.value)}
                      className="px-3 py-2 border rounded-md bg-background"
                      data-testid="select-flag-type"
                    >
                      <option value="all">All Types</option>
                      {flagAnalytics?.topFlagTypes?.map((type: any) => (
                        <option key={type.flagType} value={type.flagType}>
                          {type.flagType} ({type.count})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {flagAnalytics && (
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{flagAnalytics.overview?.totalFlags || 0}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-500">{flagAnalytics.overview?.pendingFlags || 0}</div>
                      <div className="text-sm text-muted-foreground">Pending</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">{flagAnalytics.overview?.approvedFlags || 0}</div>
                      <div className="text-sm text-muted-foreground">Approved</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-500">{flagAnalytics.overview?.rejectedFlags || 0}</div>
                      <div className="text-sm text-muted-foreground">Rejected</div>
                    </div>
                  </div>
                )}

                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {flagsData?.flags
                      ?.filter((flag: any) => 
                        (selectedFlagType === 'all' || flag.flagType === selectedFlagType) &&
                        (flagSearchTerm === '' || 
                         flag.flagReason?.toLowerCase().includes(flagSearchTerm.toLowerCase()) ||
                         flag.flagType?.toLowerCase().includes(flagSearchTerm.toLowerCase()))
                      )
                      ?.map((flag: any) => {
                        // Grouped importance flags
                        if (flag.type === 'importance_group') {
                          const availableImportanceLevels = flag.flags.map((f: any) => f.flagType);
                          const sampleFlag = flag.flags[0];
                          
                          return (
                            <Card key={`${flag.targetType}-${flag.targetId}`} className="p-4 border-blue-200">
                              <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="secondary" className="text-xs">
                                        Importance Level
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        {flag.flags.length} levels detected
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {sampleFlag.flagReason}
                                    </p>
                                    {sampleFlag.memoryContent && (
                                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 mb-3 rounded-r">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                          Flagged Content:
                                        </p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                                          "{sampleFlag.memoryContent}"
                                        </p>
                                        {sampleFlag.memoryType && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Type: {sampleFlag.memoryType}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground mb-3">
                                      Target: {flag.targetType} • Created: {new Date(flag.createdAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Importance Selector */}
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                  <p className="text-sm font-medium mb-3">Choose the correct importance level:</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {['high_importance', 'medium_importance', 'low_importance'].map((importance) => {
                                      const isAvailable = availableImportanceLevels.includes(importance);
                                      const label = importance.replace('_importance', '').toUpperCase();
                                      const variant = importance === 'high_importance' ? 'destructive' : 
                                                    importance === 'medium_importance' ? 'secondary' : 'outline';
                                      
                                      return (
                                        <Button
                                          key={importance}
                                          size="sm"
                                          variant={isAvailable ? variant : 'outline'}
                                          disabled={!isAvailable || batchImportanceReviewMutation.isPending}
                                          onClick={() => batchImportanceReviewMutation.mutate({
                                            targetType: flag.targetType,
                                            targetId: flag.targetId,
                                            selectedImportance: importance as 'high_importance' | 'medium_importance' | 'low_importance'
                                          })}
                                          data-testid={`button-importance-${importance}-${flag.targetId}`}
                                          className={`${!isAvailable ? 'opacity-50' : ''}`}
                                        >
                                          {label} {isAvailable ? '✓' : '✗'}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Click to approve that importance level and auto-reject the others
                                  </p>
                                </div>
                              </div>
                            </Card>
                          );
                        }

                        // Individual flags (regular display)
                        return (
                          <Card key={flag.id} className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    {flag.flagType}
                                  </Badge>
                                  <Badge 
                                    variant={flag.priority === 'CRITICAL' ? 'destructive' : 
                                             flag.priority === 'HIGH' ? 'secondary' : 'outline'}
                                    className="text-xs"
                                  >
                                    {flag.priority}
                                  </Badge>
                                  {flag.confidence && (
                                    <Badge variant="outline" className="text-xs">
                                      {Math.round(flag.confidence * 100)}% confidence
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {flag.flagReason}
                                </p>
                                {flag.memoryContent && (
                                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 mb-3 rounded-r">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                      Flagged Content:
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                                      "{flag.memoryContent}"
                                    </p>
                                    {flag.memoryType && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Type: {flag.memoryType}
                                      </p>
                                    )}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  Target: {flag.targetType} • Created: {new Date(flag.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reviewFlagMutation.mutate({
                                    flagId: flag.id,
                                    reviewStatus: 'APPROVED'
                                  })}
                                  data-testid={`button-approve-flag-${flag.id}`}
                                >
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reviewFlagMutation.mutate({
                                    flagId: flag.id,
                                    reviewStatus: 'REJECTED'
                                  })}
                                  data-testid={`button-reject-flag-${flag.id}`}
                                >
                                  <XCircle className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Duplicates Tab */}
          <TabsContent value="duplicates" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Copy className="w-5 h-5 text-blue-500" />
                    Memory Deduplication
                  </CardTitle>
                  <div className="flex gap-2 items-center">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Similarity:</label>
                      <Slider
                        value={[similarityThreshold]}
                        onValueChange={(value) => setSimilarityThreshold(value[0])}
                        max={1}
                        min={0.5}
                        step={0.05}
                        className="w-32"
                        data-testid="slider-similarity-threshold"
                      />
                      <span className="text-sm text-gray-500 w-12">
                        {Math.round(similarityThreshold * 100)}%
                      </span>
                    </div>
                    <Button
                      onClick={() => {
                        setIsLoadingDuplicates(true);
                        findDuplicatesMutation.mutate(similarityThreshold);
                      }}
                      disabled={isLoadingDuplicates || findDuplicatesMutation.isPending}
                      data-testid="button-find-duplicates"
                    >
                      {isLoadingDuplicates || findDuplicatesMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Find Duplicates
                    </Button>
                    <Button
                      onClick={() => {
                        setAutoMergeInProgress(true);
                        autoMergeMutation.mutate(similarityThreshold);
                      }}
                      disabled={autoMergeInProgress || autoMergeMutation.isPending}
                      variant="outline"
                      data-testid="button-auto-merge"
                    >
                      {autoMergeInProgress || autoMergeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Merge className="h-4 w-4 mr-2" />
                      )}
                      Auto-Merge ({Math.round(similarityThreshold * 100)}%+)
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Find and merge similar memory entries to eliminate redundancy and improve knowledge base efficiency.
                </p>
              </CardHeader>
              <CardContent>
                {duplicateGroups.length === 0 && !isLoadingDuplicates ? (
                  <div className="text-center py-12">
                    <Copy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 mb-2">
                      No duplicate groups found
                    </p>
                    <p className="text-sm text-gray-400">
                      Click "Find Duplicates" to scan for similar memories
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-6">
                      {duplicateGroups.map((group, groupIndex) => (
                        <Card key={groupIndex} className="border-l-4 border-l-orange-500">
                          <CardHeader>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {group.duplicates.length + 1} similar memories
                                </Badge>
                                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
                                  {Math.round(group.avgSimilarity * 100)}% similar
                                </Badge>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => manualMergeMutation.mutate({
                                  primaryId: group.masterEntry.id,
                                  duplicateIds: group.duplicates.map((d: any) => d.id)
                                })}
                                disabled={manualMergeMutation.isPending}
                                data-testid={`button-merge-group-${groupIndex}`}
                              >
                                {manualMergeMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Merge className="h-4 w-4 mr-1" />
                                )}
                                Merge Group
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Primary Memory */}
                            <div className="border border-green-200 dark:border-green-700 rounded p-4 bg-green-50 dark:bg-green-900/20">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                  PRIMARY
                                </Badge>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Confidence: {group.masterEntry.confidence}% | Importance: {group.masterEntry.importance}
                                </div>
                              </div>
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                {group.masterEntry.content}
                              </p>
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Source: {group.masterEntry.source} • {new Date(group.masterEntry.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            
                            {/* Similar Memories */}
                            {group.duplicates.map((memory: any, memoryIndex: number) => (
                              <div key={memory.id} className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline">
                                    SIMILAR ({Math.round(memory.similarity * 100)}%)
                                  </Badge>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Confidence: {memory.confidence}% | Importance: {memory.importance}
                                  </div>
                                </div>
                                <p className="text-sm text-gray-900 dark:text-gray-100">
                                  {memory.content}
                                </p>
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  Source: {memory.source} • {new Date(memory.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
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