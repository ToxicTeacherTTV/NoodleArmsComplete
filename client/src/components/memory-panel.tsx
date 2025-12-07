import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { MemoryEntry, MemoryStats } from "@/types";
import { apiRequest } from "@/lib/queryClient";
import EvolutionPanel from "./evolution-panel";
import { Search, X, RefreshCw, Filter, Scan } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemoryAnalytics } from "./memory-analytics";
import { ProtectedFactsManager } from "./protected-facts-manager";

interface MemoryPanelProps {
  profileId?: string;
  memoryStats?: MemoryStats;
}

export default function MemoryPanel({ 
  profileId, 
  memoryStats 
}: MemoryPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [importanceRange, setImportanceRange] = useState<[number, number]>([0, 5]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMemories, setSelectedMemories] = useState<Set<string>>(new Set());
  const [batchImportance, setBatchImportance] = useState<number>(3);
  const [batchType, setBatchType] = useState<string>('FACT');

  const { data: memoryEntries, isLoading } = useQuery({
    queryKey: ['/api/memory/entries', { limit: 10000 }],
    queryFn: async () => {
      const response = await fetch('/api/memory/entries?limit=10000');
      if (!response.ok) throw new Error('Failed to fetch memory entries');
      return response.json();
    },
    enabled: !!profileId,
  });

  // Find duplicates mutation
  const findDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/memory/cleanup-duplicates', {});
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
      toast({
        title: "Duplicates Cleaned",
        description: `Removed ${data.duplicatesRemoved || 0} duplicate memories`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clean duplicates",
        variant: "destructive",
      });
    },
  });

  // Deep scan duplicates mutation
  const deepScanMutation = useMutation({
    mutationFn: async (scanDepth: number | 'ALL') => {
      const response = await apiRequest('POST', '/api/memory/deep-scan-duplicates', {
        scanDepth,
        similarityThreshold: 0.90
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Deep Scan Complete",
        description: `Scanned ${data.scannedCount} memories, found ${data.duplicateGroups?.length || 0} duplicate groups (${data.totalDuplicates || 0} total duplicates)`,
        duration: 8000,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to perform deep duplicate scan",
        variant: "destructive",
      });
    },
  });

  // Batch delete mutation
  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest('POST', '/api/memory/entries/batch-delete', { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
      setSelectedMemories(new Set());
      toast({
        title: "Batch Delete Complete",
        description: `Deleted ${data.deletedCount} memories`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete memories",
        variant: "destructive",
      });
    },
  });

  // Batch update importance mutation
  const batchUpdateImportanceMutation = useMutation({
    mutationFn: async ({ ids, importance }: { ids: string[]; importance: number }) => {
      return await apiRequest('POST', '/api/memory/entries/batch-update-importance', { ids, importance });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory/entries'] });
      setSelectedMemories(new Set());
      toast({
        title: "Importance Updated",
        description: `Updated ${data.updatedCount} memories`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update importance",
        variant: "destructive",
      });
    },
  });

  // Batch update type mutation
  const batchUpdateTypeMutation = useMutation({
    mutationFn: async ({ ids, type }: { ids: string[]; type: string }) => {
      return await apiRequest('POST', '/api/memory/entries/batch-update-type', { ids, type });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory/entries'] });
      setSelectedMemories(new Set());
      toast({
        title: "Type Updated",
        description: `Updated ${data.updatedCount} memories`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update type",
        variant: "destructive",
      });
    },
  });

  const toggleMemorySelection = (id: string) => {
    const newSet = new Set(selectedMemories);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMemories(newSet);
  };

  const selectAll = () => {
    const allIds = new Set(filteredMemories.map(m => m.id));
    setSelectedMemories(allIds);
  };

  const deselectAll = () => {
    setSelectedMemories(new Set());
  };

  // Filter memory entries based on all filters
  const filteredMemories = useMemo(() => {
    if (!memoryEntries || !Array.isArray(memoryEntries)) return [];
    
    let memories = memoryEntries as MemoryEntry[];
    
    // Apply source filter
    if (sourceFilter !== "all") {
      memories = memories.filter((memory: MemoryEntry) => {
        if (sourceFilter === "web_search") {
          return memory.source?.startsWith("web_search");
        }
        if (sourceFilter === "conversation") {
          return !memory.source || memory.source === "conversation";
        }
        if (sourceFilter === "document") {
          return memory.source?.startsWith("document:");
        }
        return true;
      });
    }
    
    // Apply category filter
    if (categoryFilter !== "all") {
      memories = memories.filter((memory: MemoryEntry) => 
        memory.type === categoryFilter
      );
    }
    
    // Apply importance filter
    memories = memories.filter((memory: MemoryEntry) => {
      const importance = memory.importance || 0;
      return importance >= importanceRange[0] && importance <= importanceRange[1];
    });
    
    // Apply text search filter
    if (searchTerm.trim()) {
      memories = memories.filter((memory: MemoryEntry) => 
        memory.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memory.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memory.source?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memory.keywords?.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Sort by importance and recency
    memories.sort((a, b) => {
      const importanceDiff = (b.importance || 0) - (a.importance || 0);
      if (importanceDiff !== 0) return importanceDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return memories.slice(0, 50);
  }, [memoryEntries, searchTerm, sourceFilter, categoryFilter, importanceRange]);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  const getTypeColor = (type: MemoryEntry['type']) => {
    switch (type) {
      case 'FACT':
        return 'text-accent';
      case 'PREFERENCE':
        return 'text-secondary';
      case 'LORE':
        return 'text-primary';
      case 'CONTEXT':
        return 'text-muted-foreground';
      default:
        return 'text-foreground';
    }
  };

  const renderEntityBadges = (memory: MemoryEntry) => {
    const entities = [
      ...(memory.people || []).map(p => ({ type: 'Person', name: p.canonicalName, color: 'bg-blue-500/20 text-blue-300' })),
      ...(memory.places || []).map(p => ({ type: 'Place', name: p.canonicalName, color: 'bg-green-500/20 text-green-300' })),
      ...(memory.events || []).map(e => ({ type: 'Event', name: e.canonicalName, color: 'bg-yellow-500/20 text-yellow-300' })),
      ...(memory.concepts || []).map(c => ({ type: 'Concept', name: c.canonicalName, color: 'bg-purple-500/20 text-purple-300' })),
      ...(memory.items || []).map(i => ({ type: 'Item', name: i.canonicalName, color: 'bg-orange-500/20 text-orange-300' })),
      ...(memory.misc || []).map(m => ({ type: 'Misc', name: m.canonicalName, color: 'bg-gray-500/20 text-gray-300' })),
    ];

    if (entities.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {entities.map((entity, idx) => (
          <Badge key={idx} className={`text-xs ${entity.color} border-none`}>
            {entity.type}: {entity.name}
          </Badge>
        ))}
      </div>
    );
  };

  const activeFilterCount = 
    (sourceFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (importanceRange[0] !== 0 || importanceRange[1] !== 5 ? 1 : 0);

  return (
    <div className="flex-1 p-4 space-y-4">
      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="browse">Browse Memories</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="protected">Protected Facts</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          {/* Memory Stats */}
          <Card className="glass-effect p-4 rounded-lg">
        <CardContent className="p-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">Memory Statistics</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => findDuplicatesMutation.mutate()}
                disabled={findDuplicatesMutation.isPending}
                data-testid="button-find-duplicates"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${findDuplicatesMutation.isPending ? 'animate-spin' : ''}`} />
                Quick Clean
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={deepScanMutation.isPending}
                    data-testid="button-deep-scan"
                  >
                    <Scan className={`h-3 w-3 mr-1 ${deepScanMutation.isPending ? 'animate-spin' : ''}`} />
                    Deep Scan
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Scan Depth</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => deepScanMutation.mutate(100)}
                    data-testid="scan-depth-100"
                  >
                    <span className="font-medium">100</span>
                    <span className="text-xs text-muted-foreground ml-2">Recent memories</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => deepScanMutation.mutate(500)}
                    data-testid="scan-depth-500"
                  >
                    <span className="font-medium">500</span>
                    <span className="text-xs text-muted-foreground ml-2">Extended scan</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => deepScanMutation.mutate(1000)}
                    data-testid="scan-depth-1000"
                  >
                    <span className="font-medium">1,000</span>
                    <span className="text-xs text-muted-foreground ml-2">Comprehensive scan</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => deepScanMutation.mutate('ALL')}
                    className="text-accent font-medium"
                    data-testid="scan-depth-all"
                  >
                    <span>ALL</span>
                    <span className="text-xs text-muted-foreground ml-2">Full memory scan</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary" data-testid="memory-total-facts">
                {memoryStats?.totalFacts || 0}
              </div>
              <div className="text-xs text-muted-foreground">Total Facts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent" data-testid="memory-conversations">
                {memoryStats?.conversations || 0}
              </div>
              <div className="text-xs text-muted-foreground">Conversations</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Memory Search & Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Memory Search</h3>
          <div className="flex items-center gap-2">
            {filteredMemories.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {filteredMemories.length} results
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs h-7"
              data-testid="toggle-filters"
            >
              <Filter className="h-3 w-3 mr-1" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search memories... (content, keywords, type, source)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 bg-background/50 border-muted-foreground/20 focus:border-accent"
            data-testid="memory-search-input"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
              onClick={() => setSearchTerm("")}
              data-testid="clear-search-button"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger data-testid="select-category-filter">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="FACT">📌 Facts</SelectItem>
                    <SelectItem value="PREFERENCE">💙 Preferences</SelectItem>
                    <SelectItem value="LORE">📖 Lore</SelectItem>
                    <SelectItem value="CONTEXT">💬 Context</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Source Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Source</label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger data-testid="select-source-filter">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="web_search">🌐 Web Search</SelectItem>
                    <SelectItem value="conversation">💬 Conversation</SelectItem>
                    <SelectItem value="document">📄 Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Importance Range Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Importance Range</label>
                <span className="text-xs text-foreground font-mono">
                  {importanceRange[0]} - {importanceRange[1]}
                </span>
              </div>
              <Slider
                value={importanceRange}
                onValueChange={(value) => setImportanceRange(value as [number, number])}
                min={0}
                max={5}
                step={1}
                className="w-full"
                data-testid="slider-importance-range"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low (0)</span>
                <span>High (5)</span>
              </div>
            </div>

            {/* Clear Filters Button */}
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSourceFilter("all");
                  setCategoryFilter("all");
                  setImportanceRange([0, 5]);
                }}
                className="w-full"
                data-testid="button-clear-filters"
              >
                <X className="h-3 w-3 mr-1" />
                Clear All Filters
              </Button>
            )}
          </Card>
        )}
        
        {/* Batch Operations Toolbar */}
        {selectedMemories.size > 0 && (
          <Card className="p-3 bg-primary/10 border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">
                  {selectedMemories.size} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    className="text-xs h-7"
                    data-testid="button-select-all"
                  >
                    Select All ({filteredMemories.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
                    className="text-xs h-7"
                    data-testid="button-deselect-all"
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Importance:</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={batchImportance}
                    onChange={(e) => setBatchImportance(parseInt(e.target.value))}
                    className="w-16 h-7 text-xs"
                    data-testid="input-batch-importance"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => batchUpdateImportanceMutation.mutate({ 
                      ids: Array.from(selectedMemories), 
                      importance: batchImportance 
                    })}
                    disabled={batchUpdateImportanceMutation.isPending}
                    className="text-xs h-7"
                    data-testid="button-batch-update-importance"
                  >
                    Update
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Type:</span>
                  <Select value={batchType} onValueChange={setBatchType}>
                    <SelectTrigger className="w-24 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FACT">FACT</SelectItem>
                      <SelectItem value="PREFERENCE">PREFERENCE</SelectItem>
                      <SelectItem value="LORE">LORE</SelectItem>
                      <SelectItem value="CONTEXT">CONTEXT</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => batchUpdateTypeMutation.mutate({ 
                      ids: Array.from(selectedMemories), 
                      type: batchType 
                    })}
                    disabled={batchUpdateTypeMutation.isPending}
                    className="text-xs h-7"
                    data-testid="button-batch-update-type"
                  >
                    Update
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete ${selectedMemories.size} memories?`)) {
                      batchDeleteMutation.mutate(Array.from(selectedMemories));
                    }
                  }}
                  disabled={batchDeleteMutation.isPending}
                  className="text-xs h-7"
                  data-testid="button-batch-delete"
                >
                  <i className="fas fa-trash mr-1"></i>
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Memory Results */}
        <div className="space-y-2 max-h-60 overflow-y-auto chat-scroll" data-testid="memory-entries-list">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : !memoryEntries || (memoryEntries as any[])?.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              <i className="fas fa-brain mb-2 text-2xl opacity-50"></i>
              <p>No memories stored yet</p>
              <p className="text-xs">Start chatting to build Nicky's memory!</p>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              <i className="fas fa-search mb-2 text-2xl opacity-50"></i>
              <p>No memories match your filters</p>
              <p className="text-xs">Try adjusting your search or filters</p>
            </div>
          ) : (
            filteredMemories.map((memory: MemoryEntry) => (
              <Card 
                key={memory.id} 
                className={`p-3 rounded-lg ${selectedMemories.has(memory.id) ? 'bg-primary/20 border-primary' : 'bg-muted/30'}`}
              >
                <CardContent className="p-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedMemories.has(memory.id)}
                        onChange={() => toggleMemorySelection(memory.id)}
                        className="h-4 w-4 cursor-pointer"
                        data-testid={`checkbox-memory-${memory.id}`}
                        aria-label={`Select memory ${memory.id}`}
                      />
                      <div className={`text-xs font-medium ${getTypeColor(memory.type)}`}>
                        {memory.type.charAt(0) + memory.type.slice(1).toLowerCase()} Knowledge
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Importance: {memory.importance}/5
                    </Badge>
                  </div>
                  <div className="text-sm text-foreground mb-2">{memory.content}</div>
                  {memory.keywords && memory.keywords.length > 0 && (
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {memory.keywords.slice(0, 5).map((keyword, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {renderEntityBadges(memory)}
                  {memory.source && (
                    <div className="text-xs text-secondary bg-secondary/10 px-2 py-1 rounded mb-2">
                      <strong>Source:</strong> {memory.source}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Stored {formatTimeAgo(memory.createdAt)}</span>
                    {memory.retrievalCount && memory.retrievalCount > 0 && (
                      <span className="text-accent">{memory.retrievalCount} uses</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      </TabsContent>

      <TabsContent value="analytics">
        <MemoryAnalytics profileId={profileId} />
      </TabsContent>

      <TabsContent value="protected">
        <ProtectedFactsManager />
      </TabsContent>
      </Tabs>

      {/* EVOLUTIONARY AI PANEL */}
      <EvolutionPanel profileId={profileId} />
    </div>
  );
}
