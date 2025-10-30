import { useState, useEffect } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Search, Brain, CheckCircle, XCircle, AlertTriangle, ThumbsUp, ThumbsDown, Ban, ChevronUp, ChevronDown, Scissors, Loader2, Shield, Copy, Merge, Users, MapPin, Calendar, Plus, Trash2, Sparkles, Zap, Scan } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProtectedFactsManager } from "@/components/protected-facts-manager";
import { MemoryAnalytics } from "@/components/memory-analytics";
import MemoryPanel from "@/components/memory-panel";
import DocumentPanel from "@/components/document-panel";
import PersonalityPanel from "@/components/personality-panel";
import DiscordManagementPanel from "@/components/discord-management-panel";
import ContentLibraryPanel from "@/components/content-library-panel";
import ContentIngestionPanel from "@/components/content-ingestion-panel";
import { IntelligenceDashboard } from "@/components/intelligence-dashboard";
import PodcastManagementPanel from "@/components/podcast-management-panel";
import SystemOperationsSummary from "@/components/system-operations-summary";
import type { ChaosState, MemoryStats, PersonalityState, Document as KnowledgeDocument, TimelineAuditResult } from "@/types";
import type { ChaosState, MemoryStats, PersonalityState, Document as KnowledgeDocument } from "@/types";

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

interface EntityConfig {
  isEnabled: boolean;
  version?: string;
  id?: string;
  updatedAt?: string;
}

interface Person {
  id: string;
  canonicalName: string;
  disambiguation?: string;
  aliases?: string[];
  relationship?: string;
  description?: string;
}

interface Place {
  id: string;
  canonicalName: string;
  locationType?: string;
  description?: string;
}

interface Event {
  id: string;
  canonicalName: string;
  eventDate?: string;
  description?: string;
  isCanonical?: boolean;
}

interface Entities {
  people: Person[];
  places: Place[];
  events: Event[];
}

// Auto-Approval Stats Component
function AutoApprovalStats() {
  const { data: weeklyStats } = useQuery<{
    totalAutoApproved: number;
    averagePerDay: number;
    peakDay: string;
    peakCount: number;
    categoryTrends: Record<string, number>;
  }>({
    queryKey: ['/api/flags/auto-approve/stats'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (!weeklyStats) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-3 mt-2">
      <div className="text-center p-2 bg-white dark:bg-gray-900 rounded">
        <div className="text-lg font-bold text-blue-600">{weeklyStats.totalAutoApproved}</div>
        <div className="text-xs text-muted-foreground">This Week</div>
      </div>
      <div className="text-center p-2 bg-white dark:bg-gray-900 rounded">
        <div className="text-lg font-bold text-blue-600">{weeklyStats.averagePerDay.toFixed(1)}</div>
        <div className="text-xs text-muted-foreground">Avg/Day</div>
      </div>
      <div className="text-center p-2 bg-white dark:bg-gray-900 rounded">
        <div className="text-lg font-bold text-blue-600">{weeklyStats.peakCount}</div>
        <div className="text-xs text-muted-foreground">Peak Day</div>
      </div>
    </div>
  );
}

export default function BrainManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get active profile and other data needed for moved components
  const { data: activeProfile } = useQuery({
    queryKey: ['/api/profiles/active'],
    refetchInterval: false,
  });

  const { data: memoryStats } = useQuery<MemoryStats>({
    queryKey: ['/api/memory/stats'],
    refetchInterval: 120000,
  });

  const { data: documents } = useQuery<KnowledgeDocument[]>({
    queryKey: ['/api/documents'],
    refetchInterval: false,
  });

  const { data: chaosState } = useQuery<ChaosState>({
    queryKey: ['/api/chaos/state'],
    refetchInterval: 10000,
  });

  const { data: personalityState } = useQuery<PersonalityState>({
    queryKey: ['/api/personality/state'],
    refetchInterval: 5000,
  });

  const { data: timelineHealth } = useQuery<TimelineAuditResult>({
    queryKey: ['/api/entities/events/timeline-health'],
    refetchInterval: 60000,
  });

  const timelineRepairMutation = useMutation({
    mutationFn: async (dryRun = false): Promise<TimelineAuditResult> => {
      const response = await fetch('/api/entities/events/timeline-repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });

      if (!response.ok) {
        throw new Error('Failed to reconcile event timelines');
      }

      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: result.updatesApplied > 0 ? 'Timeline reconciled' : 'Timeline audit complete',
        description: result.updatesApplied > 0
          ? `Marked ${result.updatesApplied} memory fact${result.updatesApplied === 1 ? '' : 's'} as ambiguous.`
          : 'No changes were required. All event facts look consistent.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/entities/events/timeline-health'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/high-confidence'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/medium-confidence'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/low-confidence'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Timeline reconciliation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Entity system queries
  const { data: entityConfig } = useQuery<EntityConfig>({
    queryKey: ['/api/entities/config'],
    refetchInterval: false,
  });

  const { data: entities } = useQuery<Entities>({
    queryKey: ['/api/entities'],
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

  // Entity system mutations
  const toggleEntitySystemMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch('/api/entities/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (!response.ok) {
        throw new Error('Failed to toggle entity system');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entities/config'] });
      toast({
        title: entityConfig?.isEnabled ? "Entity System Disabled" : "Entity System Enabled",
        description: entityConfig?.isEnabled 
          ? "Entity detection and linking is now disabled" 
          : "Entity detection and linking is now enabled",
      });
    },
    onError: (error) => {
      toast({
        title: "Toggle Failed",
        description: error.message || "Failed to toggle entity system",
        variant: "destructive",
      });
    },
  });

  const extractEntitiesFromMemoriesMutation = useMutation({
    mutationFn: async () => {
      const memoriesResponse = await fetch('/api/memory/entries');
      if (!memoriesResponse.ok) {
        throw new Error('Failed to fetch memories');
      }
      const memories = await memoriesResponse.json();
      const memoryIds = memories.slice(0, 20).map((m: any) => m.id);
      
      const response = await fetch('/api/entities/batch-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryIds })
      });
      if (!response.ok) {
        throw new Error('Failed to extract entities');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/entities'] });
      toast({
        title: "Entity Extraction Complete",
        description: `Extracted ${data.totalEntitiesDetected} entities from ${data.processedMemories} memories`,
      });
    },
    onError: (error) => {
      toast({
        title: "Extraction Failed",
        description: error.message || "Failed to extract entities",
        variant: "destructive",
      });
    },
  });

  // Entity editing mutations
  const updateEntityMutation = useMutation({
    mutationFn: async ({ type, id, data }: { type: 'person' | 'place' | 'event'; id: string; data: any }) => {
      const endpoint = type === 'person' ? 'people' : type === 'place' ? 'places' : 'events';
      const response = await fetch(`/api/entities/${endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Failed to update ${type}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entities'] });
      setShowEntityEditDialog(false);
      setEditingEntity(null);
      toast({
        title: "Entity Updated",
        description: "Entity has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update entity",
        variant: "destructive",
      });
    },
  });

  const deleteEntityMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'person' | 'place' | 'event'; id: string }) => {
      const endpoint = type === 'person' ? 'people' : type === 'place' | 'place' ? 'places' : 'events';
      const response = await fetch(`/api/entities/${endpoint}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete ${type}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entities'] });
      toast({
        title: "Entity Deleted",
        description: "Entity has been deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete entity",
        variant: "destructive",
      });
    },
  });

  const mergeEntitiesMutation = useMutation({
    mutationFn: async ({ type, primaryId, duplicateId }: { type: 'person' | 'place' | 'event'; primaryId: string; duplicateId: string }) => {
      const endpoint = type === 'person' ? 'people' : type === 'place' ? 'places' : 'events';
      const response = await apiRequest('POST', `/api/entities/${endpoint}/merge`, {
        primaryId,
        duplicateId
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entities'] });
      toast({
        title: "Entities Merged",
        description: "Duplicate entity merged successfully. All memories have been transferred.",
      });
      setMergeMode(null);
      setSelectedForMerge([]);
      setShowMergeDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Merge Failed",
        description: error.message || "Failed to merge entities",
        variant: "destructive",
      });
    },
  });

  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("recent-memories");
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
  const [deepScanInProgress, setDeepScanInProgress] = useState(false);
  const [savedScanDate, setSavedScanDate] = useState<string | null>(null);
  const [showMergeEditDialog, setShowMergeEditDialog] = useState(false);
  const [mergeEditGroup, setMergeEditGroup] = useState<any>(null);
  const [mergeEditText, setMergeEditText] = useState("");

  // Load saved duplicate scan results on mount
  useEffect(() => {
    const loadSavedScan = async () => {
      try {
        console.log('📡 Fetching saved duplicate scan...');
        const response = await fetch('/api/memory/saved-duplicate-scan');
        if (!response.ok) {
          console.log('❌ Saved scan fetch failed:', response.status);
          return;
        }
        
        const data = await response.json();
        console.log('📦 Saved scan data:', {
          hasSavedScan: data.hasSavedScan,
          groupsLength: data.duplicateGroups?.length,
          threshold: data.similarityThreshold,
          createdAt: data.createdAt
        });
        
        if (data.hasSavedScan && data.duplicateGroups.length > 0) {
          setDuplicateGroups(data.duplicateGroups);
          setSimilarityThreshold(data.similarityThreshold);
          setSavedScanDate(data.createdAt);
          console.log(`✅ Loaded saved scan: ${data.duplicateGroups.length} duplicate groups from ${new Date(data.createdAt).toLocaleString()}`);
        } else {
          console.log('ℹ️ No saved scan to load');
        }
      } catch (error) {
        console.error('❌ Failed to load saved duplicate scan:', error);
      }
    };

    loadSavedScan();
  }, []);

  // Entity editing state
  const [editingEntity, setEditingEntity] = useState<{type: 'person' | 'place' | 'event', data: any} | null>(null);
  const [showEntityEditDialog, setShowEntityEditDialog] = useState(false);
  const [showEntityMemoriesDialog, setShowEntityMemoriesDialog] = useState(false);
  const [selectedEntityForMemories, setSelectedEntityForMemories] = useState<{id: string, name: string, type: 'person' | 'place' | 'event'} | null>(null);
  
  // Entity merging state
  const [mergeMode, setMergeMode] = useState<{type: 'person' | 'place' | 'event'} | null>(null);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showMergeSelectionDialog, setShowMergeSelectionDialog] = useState(false);
  const [mergeForm, setMergeForm] = useState({
    canonicalName: '',
    disambiguation: '',
    aliases: [] as string[],
    relationship: '',
    description: '',
    locationType: '',
    eventDate: '',
    isCanonical: false
  });

  // Query to fetch memories for selected entity
  const { data: entityMemories, isLoading: entityMemoriesLoading } = useQuery({
    queryKey: ['/api/entities', selectedEntityForMemories?.type, selectedEntityForMemories?.id, 'memories'],
    queryFn: async () => {
      if (!selectedEntityForMemories) return [];
      const endpoint = selectedEntityForMemories.type === 'person' ? 'people' :
                      selectedEntityForMemories.type === 'place' ? 'places' : 'events';
      const response = await fetch(`/api/entities/${endpoint}/${selectedEntityForMemories.id}/memories`);
      if (!response.ok) throw new Error('Failed to fetch entity memories');
      return response.json();
    },
    enabled: !!selectedEntityForMemories && showEntityMemoriesDialog,
  });
  const [entityEditForm, setEntityEditForm] = useState({
    canonicalName: '',
    disambiguation: '',
    aliases: [''],
    relationship: '',
    description: '',
    locationType: '',
    eventDate: '',
    isCanonical: false
  });

  // Profile editing state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    coreIdentity: "",
    knowledgeBase: ""
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: { name: string; coreIdentity: string; knowledgeBase: string }) => {
      const response = await fetch(`/api/profiles/${activeProfile?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/active'] });
      setIsProfileModalOpen(false);
      toast({
        title: "Profile Updated",
        description: "Core identity and personality have been saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Profile modal handlers
  const openProfileManager = () => {
    if (activeProfile) {
      setProfileForm({
        name: activeProfile.name || "",
        coreIdentity: activeProfile.coreIdentity || "",
        knowledgeBase: activeProfile.knowledgeBase || ""
      });
      setIsProfileModalOpen(true);
    }
  };

  const handleProfileSave = () => {
    updateProfileMutation.mutate(profileForm);
  };

  // Entity editing handlers
  const openEntityEditDialog = (type: 'person' | 'place' | 'event', data: any) => {
    setEditingEntity({ type, data });
    
    // Pre-populate form with current data
    setEntityEditForm({
      canonicalName: data.canonicalName || '',
      disambiguation: data.disambiguation || '',
      aliases: data.aliases?.length > 0 ? data.aliases : [''],
      relationship: data.relationship || '',
      description: data.description || '',
      locationType: data.locationType || '',
      eventDate: data.eventDate || '',
      isCanonical: data.isCanonical || false
    });
    
    setShowEntityEditDialog(true);
  };

  const handleEntitySave = () => {
    if (!editingEntity) return;

    const formData: any = {
      canonicalName: entityEditForm.canonicalName,
      disambiguation: entityEditForm.disambiguation,
      aliases: entityEditForm.aliases.filter(alias => alias.trim() !== ''),
      description: entityEditForm.description,
    };

    // Add type-specific fields
    if (editingEntity.type === 'person') {
      formData.relationship = entityEditForm.relationship;
    } else if (editingEntity.type === 'place') {
      formData.locationType = entityEditForm.locationType;
    } else if (editingEntity.type === 'event') {
      formData.eventDate = entityEditForm.eventDate;
      formData.isCanonical = entityEditForm.isCanonical;
    }

    updateEntityMutation.mutate({
      type: editingEntity.type,
      id: editingEntity.data.id,
      data: formData
    });
  };

  const handleEntityDelete = (type: 'person' | 'place' | 'event', id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteEntityMutation.mutate({ type, id });
    }
  };

  const showEntityMemories = (type: 'person' | 'place' | 'event', id: string, name: string) => {
    setSelectedEntityForMemories({ id, name, type });
    setShowEntityMemoriesDialog(true);
  };

  const startMergeFlow = (type: 'person' | 'place' | 'event', entityId: string) => {
    setMergeMode({ type });
    setSelectedForMerge([entityId]);
    setShowMergeSelectionDialog(true);
  };

  const selectMergeTarget = (targetId: string) => {
    const fullSelection = [selectedForMerge[0], targetId];
    setSelectedForMerge(fullSelection);
    
    // Get both entities
    const entity1 = mergeMode?.type === 'person' 
      ? entities.people?.find((p: Person) => p.id === fullSelection[0])
      : mergeMode?.type === 'place'
      ? entities.places?.find((p: Place) => p.id === fullSelection[0])
      : entities.events?.find((e: Event) => e.id === fullSelection[0]);
      
    const entity2 = mergeMode?.type === 'person' 
      ? entities.people?.find((p: Person) => p.id === targetId)
      : mergeMode?.type === 'place'
      ? entities.places?.find((p: Place) => p.id === targetId)
      : entities.events?.find((e: Event) => e.id === targetId);
    
    if (entity1 && entity2) {
      // Combine aliases from both entities (remove duplicates)
      const combinedAliases = Array.from(new Set([
        ...(entity1.aliases || []),
        ...(entity2.aliases || [])
      ]));
      
      // Combine descriptions (if both exist, separate with newline)
      let combinedDescription = entity1.description || '';
      if (entity2.description) {
        combinedDescription = combinedDescription 
          ? `${combinedDescription}\n\n${entity2.description}`
          : entity2.description;
      }
      
      // Initialize merge form with primary entity's data + combined fields
      setMergeForm({
        canonicalName: entity1.canonicalName,
        disambiguation: entity1.disambiguation || entity2.disambiguation || '',
        aliases: combinedAliases,
        relationship: entity1.relationship || entity2.relationship || '',
        description: combinedDescription,
        locationType: entity1.locationType || entity2.locationType || '',
        eventDate: entity1.eventDate || entity2.eventDate || '',
        isCanonical: entity1.isCanonical || entity2.isCanonical || false
      });
    }
    
    setShowMergeSelectionDialog(false);
    setShowMergeDialog(true);
  };

  const confirmMerge = () => {
    if (!mergeMode || selectedForMerge.length !== 2) return;
    const [primaryId, duplicateId] = selectedForMerge;
    
    mergeEntitiesMutation.mutate({
      type: mergeMode.type,
      primaryId,
      duplicateId,
      mergedData: mergeForm
    });
  };

  const addMergeAlias = () => {
    setMergeForm({
      ...mergeForm,
      aliases: [...mergeForm.aliases, '']
    });
  };

  const updateMergeAlias = (index: number, value: string) => {
    const newAliases = [...mergeForm.aliases];
    newAliases[index] = value;
    setMergeForm({
      ...mergeForm,
      aliases: newAliases
    });
  };

  const removeMergeAlias = (index: number) => {
    if (mergeForm.aliases.length > 0) {
      const newAliases = mergeForm.aliases.filter((_, i) => i !== index);
      setMergeForm({
        ...mergeForm,
        aliases: newAliases
      });
    }
  };

  const addAliasField = () => {
    setEntityEditForm({
      ...entityEditForm,
      aliases: [...entityEditForm.aliases, '']
    });
  };

  const updateAlias = (index: number, value: string) => {
    const newAliases = [...entityEditForm.aliases];
    newAliases[index] = value;
    setEntityEditForm({
      ...entityEditForm,
      aliases: newAliases
    });
  };

  const removeAlias = (index: number) => {
    if (entityEditForm.aliases.length > 1) {
      const newAliases = entityEditForm.aliases.filter((_, i) => i !== index);
      setEntityEditForm({
        ...entityEditForm,
        aliases: newAliases
      });
    }
  };

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

  // Deep scan duplicates mutation
  const deepScanDuplicatesMutation = useMutation({
    mutationFn: async ({ scanDepth, threshold }: { scanDepth: number | 'ALL'; threshold: number }) => {
      const response = await fetch('/api/memory/deep-scan-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanDepth, similarityThreshold: threshold }),
      });
      if (!response.ok) throw new Error('Failed to perform deep scan');
      return response.json();
    },
    onSuccess: (data) => {
      console.log('🔍 Deep scan response:', {
        hasDuplicateGroups: !!data.duplicateGroups,
        groupsLength: data.duplicateGroups?.length,
        totalDuplicates: data.totalDuplicates,
        scannedCount: data.scannedCount,
        savedToDatabase: data.savedToDatabase,
        warning: data.warning,
        fullData: data
      });
      setDeepScanInProgress(false);
      setDuplicateGroups(data.duplicateGroups || []);
      setSavedScanDate(new Date().toISOString());
      console.log('✅ Set duplicate groups:', data.duplicateGroups?.length || 0);
      
      if (data.warning || !data.savedToDatabase) {
        toast({
          title: "⚠️ Deep Scan Complete (With Warning)",
          description: data.warning || `Scan completed but results weren't saved to database. Found ${data.duplicateGroups?.length || 0} duplicate groups (${data.totalDuplicates || 0} total duplicates). You can still work with them below.`,
          duration: 10000,
        });
      } else {
        toast({
          title: "Deep Scan Complete",
          description: `Scanned ${data.scannedCount} memories, found ${data.duplicateGroups?.length || 0} duplicate groups (${data.totalDuplicates || 0} total duplicates)`,
          duration: 8000,
        });
      }
    },
    onError: (error) => {
      setDeepScanInProgress(false);
      toast({
        title: "Deep Scan Failed",
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

  // Quick merge mutation (no editing, just merge)
  const quickMergeMutation = useMutation({
    mutationFn: async ({ masterEntryId, duplicateIds }: { masterEntryId: string; duplicateIds: string[] }) => {
      const response = await fetch('/api/memory/merge-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterEntryId, duplicateIds }),
      });
      if (!response.ok) throw new Error('Failed to merge group');
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
      
      // Remove the merged group from duplicateGroups state
      const mergedIds = [variables.masterEntryId, ...variables.duplicateIds];
      setDuplicateGroups(prevGroups => 
        prevGroups.filter(group => {
          // Keep groups that don't contain any of the merged memory IDs
          const groupMemoryIds = [
            group.masterEntry?.id || group.masterId,
            ...(group.duplicates?.map((d: any) => d.id) || [])
          ].filter(Boolean);
          
          return !groupMemoryIds.some(id => mergedIds.includes(id));
        })
      );
      
      toast({
        title: "Group Merged",
        description: `Successfully merged ${data.mergedCount} duplicates. Group removed from list.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Merge Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manual merge mutation
  const manualMergeMutation = useMutation({
    mutationFn: async ({ primaryId, duplicateIds, mergedContent }: { primaryId: string; duplicateIds: string[]; mergedContent?: string }) => {
      const response = await fetch('/api/memory/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId, duplicateIds, mergedContent }),
      });
      if (!response.ok) throw new Error('Failed to merge memories');
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
      
      // Remove the merged group from duplicateGroups state
      const mergedIds = [variables.primaryId, ...variables.duplicateIds];
      setDuplicateGroups(prevGroups => 
        prevGroups.filter(group => {
          // Keep groups that don't contain any of the merged memory IDs
          const groupMemoryIds = [
            group.masterEntry?.id,
            ...(group.duplicates?.map((d: any) => d.id) || [])
          ].filter(Boolean);
          
          return !groupMemoryIds.some(id => mergedIds.includes(id));
        })
      );
      
      // Close the merge edit dialog
      setShowMergeEditDialog(false);
      setMergeEditGroup(null);
      setMergeEditText("");
      
      toast({
        title: "Memories Merged",
        description: `Successfully merged ${data.mergedCount} memories. Group removed from list.`,
      });
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

  // ✂️ Single fact cleaning mutation
  const cleanSingleFactMutation = useMutation({
    mutationFn: async (factId: string) => {
      const response = await apiRequest('POST', `/api/memory/entries/${factId}/clean`);
      return await response.json();
    },
    onSuccess: (data, factId) => {
      toast({
        title: "Wall-of-Text Cleaned!",
        description: `Successfully split into ${data.createdCount} atomic facts`,
      });
      
      // Invalidate queries to refresh the fact lists
      queryClient.invalidateQueries({ queryKey: ['/api/memory/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/high-confidence'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/medium-confidence'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/low-confidence'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Cleaning Failed",
        description: error.message || "Failed to clean wall-of-text",
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
              disabled={makeProtectedMutation.isPending && makeProtectedMutation.variables === fact.id}
              data-testid={`button-protect-compact-${fact.id}`}
              title="Make Protected (100% confidence, cannot be contradicted)"
            >
              {makeProtectedMutation.isPending && makeProtectedMutation.variables === fact.id ? (
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
              onClick={() => cleanSingleFactMutation.mutate(fact.id)}
              disabled={cleanSingleFactMutation.isPending}
              data-testid={`button-clean-single-${fact.id}`}
              title="Clean wall-of-text"
            >
              {cleanSingleFactMutation.isPending ? (
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
              disabled={makeProtectedMutation.isPending && makeProtectedMutation.variables === fact.id}
              data-testid={`button-protect-${fact.id}`}
            >
              <Shield className="h-4 w-4 mr-1" />
              {makeProtectedMutation.isPending && makeProtectedMutation.variables === fact.id ? "PROTECTING..." : "MAKE PROTECTED"}
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
              onClick={() => cleanSingleFactMutation.mutate(fact.id)}
              disabled={cleanSingleFactMutation.isPending}
              data-testid={`button-preview-clean-single-${fact.id}`}
            >
              {cleanSingleFactMutation.isPending ? (
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

  const getConfidenceColor = (confidence: number | null | undefined) => {
    const conf = confidence ?? 0;
    if (conf >= 90) return "bg-green-500";
    if (conf >= 70) return "bg-blue-500";
    if (conf >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getConfidenceLabel = (confidence: number | null | undefined) => {
    const conf = confidence ?? 0;
    if (conf >= 90) return "Very High";
    if (conf >= 70) return "High";
    if (conf >= 60) return "Medium";
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
        <SystemOperationsSummary
          memoryStats={memoryStats}
          flagsData={flagsData}
          flagAnalytics={flagAnalytics}
          documents={documents}
          chaosState={chaosState}
          personalityState={personalityState}
          timelineHealth={timelineHealth}
          onRequestTimelineRepair={() => timelineRepairMutation.mutate()}
          timelineRepairPending={timelineRepairMutation.isPending}
        />

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
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-1 h-auto p-1">
            <TabsTrigger value="recent-memories" data-testid="tab-recent-memories" className="text-xs">
              📝 Recent
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics" className="text-xs">
              📊 Analytics
            </TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents" className="text-xs">
              📁 Docs
            </TabsTrigger>
            <TabsTrigger value="identity" data-testid="tab-identity" className="text-xs">
              🎭 Identity
            </TabsTrigger>
            <TabsTrigger value="entities" data-testid="tab-entities" className="text-xs">
              👥 Entities
            </TabsTrigger>
            <TabsTrigger value="discord" data-testid="tab-discord" className="text-xs">
              🤖 Discord
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
            <TabsTrigger value="intelligence" data-testid="tab-intelligence" className="text-xs">
              🧠 Intelligence
            </TabsTrigger>
            <TabsTrigger value="podcast" data-testid="tab-podcast" className="text-xs">
              🎙️ Podcast
            </TabsTrigger>
            <TabsTrigger value="content-sources" data-testid="tab-content-sources" className="text-xs">
              📡 Content Sources
            </TabsTrigger>
            <TabsTrigger value="content-library" data-testid="tab-content-library" className="text-xs">
              📚 Content Library
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

          {/* Memory Analytics */}
          <TabsContent value="analytics" className="mt-6">
            <MemoryAnalytics profileId={activeProfile?.id} />
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
                  onOpenProfileManager={openProfileManager}
                  onResetChat={() => {/* This could be moved or handled differently in brain management */}}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Entity Management */}
          <TabsContent value="entities" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Entity Management</span>
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Manage people, places, and events that Nicky knows about with AI-powered entity detection
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Entity System Toggle */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Brain className="h-4 w-4" />
                        <span>Entity System</span>
                        <Badge variant={entityConfig?.isEnabled ? "default" : "secondary"}>
                          {entityConfig?.isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <Switch
                        checked={entityConfig?.isEnabled || false}
                        onCheckedChange={(enabled) => toggleEntitySystemMutation.mutate(enabled)}
                        disabled={toggleEntitySystemMutation.isPending}
                        data-testid="toggle-entity-system"
                      />
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {entityConfig?.isEnabled 
                        ? "Entity detection and disambiguation is active. New memories will automatically identify people, places, and events."
                        : "Entity system is disabled. Enable to automatically detect and link entities in memories."}
                    </p>
                  </CardHeader>
                </Card>

                {/* Entity Extraction */}
                {entityConfig?.isEnabled && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Extract Entities from Existing Memories</CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Analyze your existing memories to detect and organize people, places, and events
                      </p>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => extractEntitiesFromMemoriesMutation.mutate()}
                        disabled={extractEntitiesFromMemoriesMutation.isPending}
                        className="w-full"
                        data-testid="button-extract-entities"
                      >
                        {extractEntitiesFromMemoriesMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Extracting Entities...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Extract Entities from Recent Memories
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Entity Overview */}
                {entities && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center space-x-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span>People</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-500">
                          {entities.people?.length || 0}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Individuals mentioned in memories
                        </p>
                        {entities.people?.slice(0, 3).map((person: any) => (
                          <div key={person.id} className="text-xs text-gray-500 mt-1">
                            • {person.canonicalName} {person.disambiguation && `(${person.disambiguation})`}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-green-500" />
                          <span>Places</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-500">
                          {entities.places?.length || 0}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Locations mentioned in memories
                        </p>
                        {entities.places?.slice(0, 3).map((place: any) => (
                          <div key={place.id} className="text-xs text-gray-500 mt-1">
                            • {place.canonicalName} {place.locationType && `(${place.locationType})`}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-purple-500" />
                          <span>Events</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-purple-500">
                          {entities.events?.length || 0}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Events mentioned in memories
                        </p>
                        {entities.events?.slice(0, 3).map((event: any) => (
                          <div key={event.id} className="text-xs text-gray-500 mt-1">
                            • {event.canonicalName} {event.eventDate && `(${event.eventDate})`}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Entity Management Tabs */}
                {entities && (entities.people?.length > 0 || entities.places?.length > 0 || entities.events?.length > 0) && (
                  <Tabs defaultValue="people" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="people" data-testid="tab-entity-people">
                        <Users className="h-4 w-4 mr-2" />
                        People ({entities.people?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="places" data-testid="tab-entity-places">
                        <MapPin className="h-4 w-4 mr-2" />
                        Places ({entities.places?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="events" data-testid="tab-entity-events">
                        <Calendar className="h-4 w-4 mr-2" />
                        Events ({entities.events?.length || 0})
                      </TabsTrigger>
                    </TabsList>

                    {/* People Tab */}
                    <TabsContent value="people" className="mt-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>People Entities</CardTitle>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Manage individuals that Nicky knows about
                          </p>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[400px]">
                            <div className="space-y-4">
                              {entities.people?.map((person: Person) => (
                                <div key={person.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                                        {person.canonicalName}
                                      </h3>
                                      {person.disambiguation && (
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                          {person.disambiguation}
                                        </p>
                                      )}
                                      {person.aliases && person.aliases.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {person.aliases.map((alias, index) => (
                                            <Badge key={index} variant="outline" className="text-xs">
                                              {alias}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      {person.relationship && (
                                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                                          <strong>Relationship:</strong> {person.relationship}
                                        </p>
                                      )}
                                      {person.description && (
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                                          {person.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex space-x-2">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="text-blue-600 hover:text-blue-700"
                                        onClick={() => showEntityMemories('person', person.id, person.canonicalName)}
                                        data-testid={`button-memories-person-${person.id}`}
                                      >
                                        Show Memories
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="text-purple-600 hover:text-purple-700"
                                        onClick={() => startMergeFlow('person', person.id)}
                                        data-testid={`button-merge-person-${person.id}`}
                                      >
                                        <Merge className="h-4 w-4 mr-1" />
                                        Merge
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => openEntityEditDialog('person', person)}
                                        data-testid={`button-edit-person-${person.id}`}
                                      >
                                        Edit
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => handleEntityDelete('person', person.id, person.canonicalName)}
                                        data-testid={`button-delete-person-${person.id}`}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Places Tab */}
                    <TabsContent value="places" className="mt-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Place Entities</CardTitle>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Manage locations that Nicky knows about
                          </p>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[400px]">
                            <div className="space-y-4">
                              {entities.places?.map((place: Place) => (
                                <div key={place.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                                        {place.canonicalName}
                                      </h3>
                                      {place.locationType && (
                                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                          <strong>Type:</strong> {place.locationType}
                                        </p>
                                      )}
                                      {place.description && (
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                                          {place.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex space-x-2">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="text-blue-600 hover:text-blue-700"
                                        onClick={() => showEntityMemories('place', place.id, place.canonicalName)}
                                        data-testid={`button-memories-place-${place.id}`}
                                      >
                                        Show Memories
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => openEntityEditDialog('place', place)}
                                        data-testid={`button-edit-place-${place.id}`}
                                      >
                                        Edit
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => handleEntityDelete('place', place.id, place.canonicalName)}
                                        data-testid={`button-delete-place-${place.id}`}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Events Tab */}
                    <TabsContent value="events" className="mt-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Event Entities</CardTitle>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Manage events that Nicky knows about
                          </p>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[400px]">
                            <div className="space-y-4">
                              {entities.events?.map((event: Event) => (
                                <div key={event.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                                        {event.canonicalName}
                                      </h3>
                                      {event.eventDate && (
                                        <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                                          <strong>Date:</strong> {event.eventDate}
                                        </p>
                                      )}
                                      {event.isCanonical && (
                                        <Badge variant="default" className="mt-2">
                                          Canonical Event
                                        </Badge>
                                      )}
                                      {event.description && (
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                                          {event.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex space-x-2">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="text-blue-600 hover:text-blue-700"
                                        onClick={() => showEntityMemories('event', event.id, event.canonicalName)}
                                        data-testid={`button-memories-event-${event.id}`}
                                      >
                                        Show Memories
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => openEntityEditDialog('event', event)}
                                        data-testid={`button-edit-event-${event.id}`}
                                      >
                                        Edit
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => handleEntityDelete('event', event.id, event.canonicalName)}
                                        data-testid={`button-delete-event-${event.id}`}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Discord Integration */}
          <TabsContent value="discord" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Discord Integration</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Configure Nicky's Discord bot behavior and server interactions
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <DiscordManagementPanel />
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
                              {fact.confidence ?? 0}% {getConfidenceLabel(fact.confidence)}
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
                        <Progress value={fact.confidence ?? 0} className="w-full mb-3" />
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
                              {fact.confidence ?? 0}% {getConfidenceLabel(fact.confidence)}
                            </Badge>
                            <Badge variant="outline">
                              Support: {fact.supportCount}
                            </Badge>
                          </div>
                          <FactActions fact={fact} />
                        </div>
                        <Progress value={fact.confidence ?? 0} className="w-full mb-3" />
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
                              {fact.confidence ?? 0}% {getConfidenceLabel(fact.confidence)}
                            </Badge>
                            <Badge variant="outline">
                              Support: {fact.supportCount}
                            </Badge>
                          </div>
                          <FactActions fact={fact} />
                        </div>
                        <Progress value={fact.confidence ?? 0} className="w-full mb-3" />
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
                                    PRIMARY ({group.primaryFact.confidence ?? 0}% confidence)
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
                                    {fact.confidence ?? 0}% confidence
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

                {/* Auto-Approval Section */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-500" />
                      <h3 className="text-sm font-semibold">Smart Auto-Approval</h3>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        fetch('/api/flags/auto-approve', { method: 'POST' })
                          .then(res => res.json())
                          .then(() => {
                            queryClient.invalidateQueries({ queryKey: ['/api/flags/pending'] });
                            toast({ title: 'Auto-approval completed', description: 'High-confidence flags have been automatically approved' });
                          })
                          .catch(() => {
                            toast({ title: 'Auto-approval failed', variant: 'destructive' });
                          });
                      }}
                      data-testid="button-run-auto-approval"
                    >
                      <Zap className="w-4 h-4 mr-1" />
                      Run Auto-Approval
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Automatically approves high-confidence flags from proven categories (max 100/day). Safe categories like DbD gameplay and pasta content are approved at 85%+ confidence.
                  </p>
                  
                  {/* Auto-Approval Stats */}
                  <AutoApprovalStats />
                </div>

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
                                      {Math.round(flag.confidence)}% confidence
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
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Copy className="w-5 h-5 text-blue-500" />
                      Memory Deduplication
                    </CardTitle>
                    {savedScanDate && duplicateGroups.length > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Last scan: {new Date(savedScanDate).toLocaleString()} ({duplicateGroups.length} groups saved)
                      </p>
                    )}
                  </div>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="default"
                          disabled={deepScanInProgress || deepScanDuplicatesMutation.isPending}
                          data-testid="button-deep-scan"
                        >
                          {deepScanInProgress || deepScanDuplicatesMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Scan className="h-4 w-4 mr-2" />
                          )}
                          Deep Scan
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Scan Depth</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setDeepScanInProgress(true);
                            deepScanDuplicatesMutation.mutate({ scanDepth: 100, threshold: similarityThreshold });
                          }}
                          data-testid="scan-depth-100"
                        >
                          <span className="font-medium">100</span>
                          <span className="text-xs text-muted-foreground ml-2">Recent memories</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setDeepScanInProgress(true);
                            deepScanDuplicatesMutation.mutate({ scanDepth: 500, threshold: similarityThreshold });
                          }}
                          data-testid="scan-depth-500"
                        >
                          <span className="font-medium">500</span>
                          <span className="text-xs text-muted-foreground ml-2">Extended scan</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setDeepScanInProgress(true);
                            deepScanDuplicatesMutation.mutate({ scanDepth: 1000, threshold: similarityThreshold });
                          }}
                          data-testid="scan-depth-1000"
                        >
                          <span className="font-medium">1,000</span>
                          <span className="text-xs text-muted-foreground ml-2">Comprehensive scan</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setDeepScanInProgress(true);
                            deepScanDuplicatesMutation.mutate({ scanDepth: 'ALL', threshold: similarityThreshold });
                          }}
                          className="text-accent font-medium"
                          data-testid="scan-depth-all"
                        >
                          <span>ALL</span>
                          <span className="text-xs text-muted-foreground ml-2">Full memory scan</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                {(() => {
                  console.log('🎨 Rendering duplicates UI:', {
                    groupsLength: duplicateGroups.length,
                    isLoading: isLoadingDuplicates,
                    firstGroup: duplicateGroups[0]
                  });
                  return null;
                })()}
                
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
                      {duplicateGroups.map((group, groupIndex) => {
                        if (groupIndex === 0) {
                          console.log('🎯 First group structure:', group);
                        }
                        return (<Card key={groupIndex} className="border-l-4 border-l-orange-500">
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
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => {
                                    // Quick merge - no editing, just merge using PRIMARY as master
                                    const masterEntryId = group.masterEntry?.id || group.masterId;
                                    const duplicateIds = group.duplicates.map((d: any) => d.id);
                                    
                                    if (masterEntryId && duplicateIds.length > 0) {
                                      quickMergeMutation.mutate({ masterEntryId, duplicateIds });
                                    }
                                  }}
                                  disabled={quickMergeMutation.isPending}
                                  data-testid={`button-quick-merge-${groupIndex}`}
                                >
                                  {quickMergeMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <Zap className="h-4 w-4 mr-1" />
                                  )}
                                  Quick Merge
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    // Handle both data structures: masterEntry object or masterId+masterContent
                                    const masterContent = group.masterEntry?.content || group.masterContent || '';
                                    const allTexts = [
                                      masterContent,
                                      ...group.duplicates.map((d: any) => d.content)
                                    ].filter(Boolean);
                                    
                                    setMergeEditGroup(group);
                                    setMergeEditText(allTexts.join('\n\n'));
                                    setShowMergeEditDialog(true);
                                  }}
                                  disabled={manualMergeMutation.isPending}
                                  data-testid={`button-merge-group-${groupIndex}`}
                                >
                                  {manualMergeMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <Merge className="h-4 w-4 mr-1" />
                                  )}
                                  Edit & Merge
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Primary Memory - handle both masterEntry object and masterId+masterContent */}
                            {(group.masterEntry || group.masterContent) && (
                              <div className="border border-green-200 dark:border-green-700 rounded p-4 bg-green-50 dark:bg-green-900/20">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                    PRIMARY
                                  </Badge>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {group.masterEntry?.confidence != null && `Confidence: ${group.masterEntry.confidence}% | `}
                                    {group.masterEntry && `Importance: ${group.masterEntry.importance || 0}`}
                                  </div>
                                </div>
                                <p className="text-sm text-gray-900 dark:text-gray-100">
                                  {group.masterEntry?.content || group.masterContent}
                                </p>
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  {group.masterEntry && (
                                    <>Source: {group.masterEntry.source} • {new Date(group.masterEntry.createdAt).toLocaleDateString()}</>
                                  )}
                                  {!group.masterEntry && group.masterId && (
                                    <>ID: {group.masterId.substring(0, 8)}...</>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Similar Memories */}
                            {group.duplicates.map((memory: any, memoryIndex: number) => (
                              <div key={memory.id} className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline">
                                    SIMILAR ({Math.round(memory.similarity * 100)}%)
                                  </Badge>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {memory.confidence != null && `Confidence: ${memory.confidence}% | `}
                                    Importance: {memory.importance || 0}
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
                        </Card>);
                      })}
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
                              {fact.confidence ?? 0}%
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

          {/* Intelligence Dashboard */}
          <TabsContent value="intelligence" className="mt-6">
            <IntelligenceDashboard />
          </TabsContent>

          {/* Podcast Management */}
          <TabsContent value="podcast" className="mt-6">
            <PodcastManagementPanel />
          </TabsContent>

          {/* Content Sources */}
          <TabsContent value="content-sources" className="mt-6">
            <ContentIngestionPanel profileId={activeProfile?.id} />
          </TabsContent>

          {/* Content Library */}
          <TabsContent value="content-library" className="mt-6">
            <ContentLibraryPanel profileId={activeProfile?.id} />
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
              disabled={(updateFactMutation.isPending && updateFactMutation.variables?.factId === editingFact?.id) || !editContent.trim()}
              data-testid="button-save-edit"
            >
              {updateFactMutation.isPending && updateFactMutation.variables?.factId === editingFact?.id ? (
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
                            <span>Confidence: {preview.confidence ?? 0}% • Source: {preview.source}</span>
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

      {/* Profile Editing Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit AI Personality Profile</DialogTitle>
            <DialogDescription>
              Modify the core identity, personality traits, and knowledge base for your AI assistant.
              This is the authoritative source that controls all AI responses.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Profile Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Profile Name</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border rounded-md bg-background"
                placeholder="Enter profile name..."
              />
            </div>

            {/* Core Identity - THE IMPORTANT ONE */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-primary">
                Core Identity & Personality ⭐
              </label>
              <p className="text-xs text-muted-foreground">
                This is the most important field - it defines the AI's personality, speaking style, 
                background, and behavior patterns. Changes here will directly affect Discord responses.
              </p>
              <Textarea
                value={profileForm.coreIdentity}
                onChange={(e) => setProfileForm(prev => ({ ...prev, coreIdentity: e.target.value }))}
                className="w-full h-64 p-3 border rounded-md bg-background font-mono text-sm"
                placeholder="Enter the AI's core identity, personality, background, speaking patterns..."
              />
              <div className="text-xs text-muted-foreground">
                Character count: {profileForm.coreIdentity.length}
              </div>
            </div>

            {/* Knowledge Base */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Knowledge Base</label>
              <p className="text-xs text-muted-foreground">
                Additional context and knowledge that supplements the core identity.
              </p>
              <Textarea
                value={profileForm.knowledgeBase}
                onChange={(e) => setProfileForm(prev => ({ ...prev, knowledgeBase: e.target.value }))}
                className="w-full h-32 p-3 border rounded-md bg-background font-mono text-sm"
                placeholder="Additional knowledge, facts, references..."
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setIsProfileModalOpen(false)}
              disabled={updateProfileMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProfileSave}
              disabled={updateProfileMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entity Edit Modal */}
      <Dialog open={showEntityEditDialog} onOpenChange={setShowEntityEditDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit {editingEntity?.type === 'person' ? 'Person' : editingEntity?.type === 'place' ? 'Place' : 'Event'}
            </DialogTitle>
            <DialogDescription>
              Update the information for this {editingEntity?.type}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Canonical Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={entityEditForm.canonicalName}
                onChange={(e) => setEntityEditForm(prev => ({ ...prev, canonicalName: e.target.value }))}
                placeholder="Enter the canonical name..."
                data-testid="input-entity-name"
              />
            </div>

            {/* Disambiguation */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Disambiguation</label>
              <Input
                value={entityEditForm.disambiguation}
                onChange={(e) => setEntityEditForm(prev => ({ ...prev, disambiguation: e.target.value }))}
                placeholder="Brief description to distinguish from others..."
                data-testid="input-entity-disambiguation"
              />
            </div>

            {/* Aliases */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Aliases</label>
              <div className="space-y-2">
                {entityEditForm.aliases.map((alias, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={alias}
                      onChange={(e) => updateAlias(index, e.target.value)}
                      placeholder="Alternative name or nickname..."
                      data-testid={`input-alias-${index}`}
                    />
                    {entityEditForm.aliases.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeAlias(index)}
                        data-testid={`button-remove-alias-${index}`}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addAliasField}
                  data-testid="button-add-alias"
                >
                  Add Alias
                </Button>
              </div>
            </div>

            {/* Type-specific fields */}
            {editingEntity?.type === 'person' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Relationship</label>
                <Input
                  value={entityEditForm.relationship}
                  onChange={(e) => setEntityEditForm(prev => ({ ...prev, relationship: e.target.value }))}
                  placeholder="Relationship to Nicky or role..."
                  data-testid="input-person-relationship"
                />
              </div>
            )}

            {editingEntity?.type === 'place' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Location Type</label>
                <Input
                  value={entityEditForm.locationType}
                  onChange={(e) => setEntityEditForm(prev => ({ ...prev, locationType: e.target.value }))}
                  placeholder="Type of location (city, restaurant, etc.)..."
                  data-testid="input-place-type"
                />
              </div>
            )}

            {editingEntity?.type === 'event' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Event Date</label>
                  <Input
                    value={entityEditForm.eventDate}
                    onChange={(e) => setEntityEditForm(prev => ({ ...prev, eventDate: e.target.value }))}
                    placeholder="Date or time period..."
                    data-testid="input-event-date"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={entityEditForm.isCanonical}
                    onCheckedChange={(checked) => setEntityEditForm(prev => ({ ...prev, isCanonical: !!checked }))}
                    data-testid="checkbox-event-canonical"
                  />
                  <label className="text-sm">Mark as canonical event</label>
                </div>
              </>
            )}

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={entityEditForm.description}
                onChange={(e) => setEntityEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional details or context..."
                className="h-24"
                data-testid="input-entity-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEntityEditDialog(false)}
              disabled={updateEntityMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEntitySave}
              disabled={updateEntityMutation.isPending || !entityEditForm.canonicalName.trim()}
            >
              {updateEntityMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entity Memories Modal */}
      <Dialog open={showEntityMemoriesDialog} onOpenChange={setShowEntityMemoriesDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Memories for {selectedEntityForMemories?.name}
            </DialogTitle>
            <DialogDescription>
              All memories that mention this {selectedEntityForMemories?.type}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {entityMemoriesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading memories...
              </div>
            ) : entityMemories && entityMemories.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {entityMemories.map((memory: any) => (
                    <div 
                      key={memory.id} 
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="text-xs">
                            {memory.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Importance: {memory.importance}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(memory.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {memory.content}
                      </p>
                      {memory.source && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          Source: {memory.source}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No memories found for this {selectedEntityForMemories?.type}.</p>
                <p className="text-sm mt-2">
                  Memories will appear here when they mention "{selectedEntityForMemories?.name}".
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEntityMemoriesDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Selection Dialog - Choose which entity to merge with */}
      <Dialog open={showMergeSelectionDialog} onOpenChange={setShowMergeSelectionDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select Entity to Merge With</DialogTitle>
            <DialogDescription>
              Choose which {mergeMode?.type} you want to merge with the selected one.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {mergeMode?.type === 'person' && entities.people
                ?.filter((p: Person) => p.id !== selectedForMerge[0])
                .map((person: Person) => (
                  <div
                    key={person.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:border-purple-400 dark:hover:border-purple-500 cursor-pointer transition-colors"
                    onClick={() => selectMergeTarget(person.id)}
                    data-testid={`select-merge-target-person-${person.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                          {person.canonicalName}
                        </h3>
                        {person.disambiguation && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {person.disambiguation}
                          </p>
                        )}
                        {person.aliases && person.aliases.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            <span className="text-xs text-gray-500">Aliases:</span>
                            {person.aliases.map((alias, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {alias}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {person.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            {person.description}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm">
                        Select →
                      </Button>
                    </div>
                  </div>
                ))}

              {mergeMode?.type === 'place' && entities.places
                ?.filter((p: Place) => p.id !== selectedForMerge[0])
                .map((place: Place) => (
                  <div
                    key={place.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:border-purple-400 dark:hover:border-purple-500 cursor-pointer transition-colors"
                    onClick={() => selectMergeTarget(place.id)}
                    data-testid={`select-merge-target-place-${place.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                          {place.canonicalName}
                        </h3>
                        {place.locationType && (
                          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                            <strong>Type:</strong> {place.locationType}
                          </p>
                        )}
                        {place.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            {place.description}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm">
                        Select →
                      </Button>
                    </div>
                  </div>
                ))}

              {mergeMode?.type === 'event' && entities.events
                ?.filter((e: Event) => e.id !== selectedForMerge[0])
                .map((event: Event) => (
                  <div
                    key={event.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:border-purple-400 dark:hover:border-purple-500 cursor-pointer transition-colors"
                    onClick={() => selectMergeTarget(event.id)}
                    data-testid={`select-merge-target-event-${event.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                          {event.canonicalName}
                        </h3>
                        {event.eventDate && (
                          <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                            <strong>Date:</strong> {event.eventDate}
                          </p>
                        )}
                        {event.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm">
                        Select →
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMergeSelectionDialog(false);
                setMergeMode(null);
                setSelectedForMerge([]);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Entities Dialog - Enhanced with editable fields */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Merge {mergeMode?.type === 'person' ? 'People' : mergeMode?.type === 'place' ? 'Places' : 'Events'}</DialogTitle>
            <DialogDescription>
              Review and edit the combined information before merging. The duplicate will be deleted and all memory links transferred.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Original Entities Side-by-Side */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 uppercase">Original Entities</h3>
              {selectedForMerge.map((entityId, index) => {
                const entity = mergeMode?.type === 'person' 
                  ? entities.people?.find((p: Person) => p.id === entityId)
                  : mergeMode?.type === 'place'
                  ? entities.places?.find((p: Place) => p.id === entityId)
                  : entities.events?.find((e: Event) => e.id === entityId);
                
                if (!entity) return null;

                return (
                  <div key={entityId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={index === 0 ? "default" : "secondary"}>
                        {index === 0 ? 'Primary' : 'Merging Into Primary'}
                      </Badge>
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      {entity.canonicalName}
                    </h4>
                    {entity.disambiguation && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {entity.disambiguation}
                      </p>
                    )}
                    {entity.aliases && entity.aliases.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entity.aliases.map((alias: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {alias}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {entity.description && (
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-2">
                        {entity.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Editable Combined Data */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-purple-700 dark:text-purple-400 uppercase">
                Combined Result (Editable)
              </h3>
              <div className="space-y-4 border border-purple-300 dark:border-purple-700 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20">
                <div>
                  <label className="text-sm font-medium">Canonical Name</label>
                  <Input
                    value={mergeForm.canonicalName}
                    onChange={(e) => setMergeForm({ ...mergeForm, canonicalName: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Disambiguation (optional)</label>
                  <Input
                    value={mergeForm.disambiguation}
                    onChange={(e) => setMergeForm({ ...mergeForm, disambiguation: e.target.value })}
                    placeholder="e.g., 'from episode 42'"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Aliases (combined from both)</label>
                  <div className="space-y-2 mt-1">
                    {mergeForm.aliases.map((alias, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={alias}
                          onChange={(e) => updateMergeAlias(index, e.target.value)}
                          placeholder="Alias name"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeMergeAlias(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addMergeAlias}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Alias
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Description (combined)</label>
                  <Textarea
                    value={mergeForm.description}
                    onChange={(e) => setMergeForm({ ...mergeForm, description: e.target.value })}
                    placeholder="Combined description from both entities"
                    className="mt-1 min-h-[100px]"
                  />
                </div>

                {mergeMode?.type === 'person' && (
                  <div>
                    <label className="text-sm font-medium">Relationship</label>
                    <Input
                      value={mergeForm.relationship}
                      onChange={(e) => setMergeForm({ ...mergeForm, relationship: e.target.value })}
                      placeholder="e.g., friend, family, colleague"
                      className="mt-1"
                    />
                  </div>
                )}

                {mergeMode?.type === 'place' && (
                  <div>
                    <label className="text-sm font-medium">Location Type</label>
                    <Input
                      value={mergeForm.locationType}
                      onChange={(e) => setMergeForm({ ...mergeForm, locationType: e.target.value })}
                      placeholder="e.g., restaurant, city, venue"
                      className="mt-1"
                    />
                  </div>
                )}

                {mergeMode?.type === 'event' && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Event Date</label>
                      <Input
                        value={mergeForm.eventDate}
                        onChange={(e) => setMergeForm({ ...mergeForm, eventDate: e.target.value })}
                        placeholder="e.g., 2024-03-15"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={mergeForm.isCanonical}
                        onCheckedChange={(checked) => setMergeForm({ ...mergeForm, isCanonical: !!checked })}
                      />
                      <label className="text-sm">Is Canonical Event</label>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowMergeDialog(false);
                setMergeMode(null);
                setSelectedForMerge([]);
              }}
              disabled={mergeEntitiesMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmMerge}
              disabled={mergeEntitiesMutation.isPending || !mergeForm.canonicalName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-confirm-merge"
            >
              {mergeEntitiesMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Merge className="w-4 h-4 mr-2" />
                  Confirm Merge
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Edit Dialog */}
      <Dialog open={showMergeEditDialog} onOpenChange={setShowMergeEditDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit and Merge Duplicate Memories</DialogTitle>
            <DialogDescription>
              All duplicate texts are shown below (one per section). Edit them as needed, then merge into a single memory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Combined Text (edit as needed)
              </label>
              <Textarea
                value={mergeEditText}
                onChange={(e) => setMergeEditText(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Edit the merged content here..."
                data-testid="textarea-merge-edit"
              />
              <p className="text-xs text-gray-500 mt-2">
                Tip: Each duplicate is separated by blank lines. Edit, combine, or rewrite as you see fit.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMergeEditDialog(false);
                setMergeEditGroup(null);
                setMergeEditText("");
              }}
              disabled={manualMergeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!mergeEditGroup || !mergeEditText.trim()) {
                  toast({
                    title: "Invalid Input",
                    description: "Please provide merged content",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Handle both data structures: masterEntry object or masterId
                const primaryId = mergeEditGroup.masterEntry?.id || mergeEditGroup.masterId || mergeEditGroup.duplicates[0]?.id;
                const duplicateIds = (mergeEditGroup.masterEntry || mergeEditGroup.masterId)
                  ? mergeEditGroup.duplicates.map((d: any) => d.id)
                  : mergeEditGroup.duplicates.slice(1).map((d: any) => d.id);
                
                manualMergeMutation.mutate({
                  primaryId,
                  duplicateIds,
                  mergedContent: mergeEditText.trim()
                });
              }}
              disabled={manualMergeMutation.isPending || !mergeEditText.trim()}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-confirm-merge-edit"
            >
              {manualMergeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Merge className="w-4 h-4 mr-2" />
                  Merge with Edited Text
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}