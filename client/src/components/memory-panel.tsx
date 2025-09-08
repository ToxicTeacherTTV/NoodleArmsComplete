import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { MemoryEntry, MemoryStats } from "@/types";
import { apiRequest } from "@/lib/queryClient";
import EvolutionPanel from "./evolution-panel";

interface MemoryPanelProps {
  profileId?: string;
  memoryStats?: MemoryStats;
  onConsolidateMemory: () => void;
}

export default function MemoryPanel({ 
  profileId, 
  memoryStats, 
  onConsolidateMemory 
}: MemoryPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: memoryEntries, isLoading } = useQuery({
    queryKey: ['/api/memory/entries'],
    enabled: !!profileId,
  });

  const optimizeKnowledgeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/memory/optimize');
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Knowledge Base Optimized",
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to optimize knowledge base",
        variant: "destructive",
      });
    },
  });

  const exportMemoriesMutation = useMutation({
    mutationFn: async () => {
      // This would typically generate and download a file
      const data = {
        memoryStats,
        entries: memoryEntries,
        exportedAt: new Date().toISOString(),
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nicky-memory-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Export Complete",
        description: "Memory bank exported successfully",
      });
    },
  });

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

  return (
    <div className="flex-1 p-4 space-y-4">
      {/* Memory Stats */}
      <Card className="glass-effect p-4 rounded-lg">
        <CardContent className="p-0">
          <h3 className="text-sm font-medium text-foreground mb-3">Memory Statistics</h3>
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
          
          <Button
            onClick={() => optimizeKnowledgeMutation.mutate()}
            disabled={optimizeKnowledgeMutation.isPending}
            className="w-full mt-3 bg-primary/20 hover:bg-primary/30 text-primary py-2 px-3 rounded-lg text-xs transition-all duration-200"
            data-testid="button-optimize-knowledge"
          >
            <i className="fas fa-compress-arrows-alt mr-1"></i>
            {optimizeKnowledgeMutation.isPending ? 'Optimizing...' : 'Optimize Knowledge Base'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Memories */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Recent Memories</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto chat-scroll" data-testid="memory-entries-list">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-4">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Loading memories...
            </div>
          ) : !memoryEntries || (memoryEntries as any[])?.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              <i className="fas fa-brain mb-2 text-2xl opacity-50"></i>
              <p>No memories stored yet</p>
              <p className="text-xs">Start chatting to build Nicky's memory!</p>
            </div>
          ) : (
            (memoryEntries as MemoryEntry[])?.slice(0, 10).map((memory: MemoryEntry) => (
              <Card key={memory.id} className="bg-muted/30 p-3 rounded-lg">
                <CardContent className="p-0">
                  <div className={`text-xs font-medium mb-1 ${getTypeColor(memory.type)}`}>
                    {memory.type.charAt(0) + memory.type.slice(1).toLowerCase()} Knowledge
                  </div>
                  <div className="text-sm text-foreground mb-2">{memory.content}</div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Stored {formatTimeAgo(memory.createdAt)}</span>
                    <div className="flex items-center space-x-2">
                      <span>Importance: {memory.importance}/5</span>
                      {memory.retrievalCount > 0 && (
                        <span className="text-accent">{memory.retrievalCount} uses</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* EVOLUTIONARY AI PANEL */}
      <EvolutionPanel profileId={profileId} />

      {/* Memory Actions */}
      <div className="space-y-2">
        <Button
          onClick={onConsolidateMemory}
          className="w-full bg-accent/20 hover:bg-accent/30 text-accent py-2 px-3 rounded-lg text-xs transition-all duration-200"
          data-testid="button-consolidate-memory"
        >
          <i className="fas fa-layer-group mr-1"></i>
          Consolidate Recent Memories
        </Button>
        <Button
          onClick={() => exportMemoriesMutation.mutate()}
          variant="secondary"
          className="w-full bg-muted hover:bg-muted/80 text-muted-foreground py-2 px-3 rounded-lg text-xs transition-all duration-200"
          data-testid="button-export-memories"
        >
          <i className="fas fa-download mr-1"></i>
          Export Memory Bank
        </Button>
      </div>
    </div>
  );
}
