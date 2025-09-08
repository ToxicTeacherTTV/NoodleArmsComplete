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
}

export default function MemoryPanel({ 
  profileId, 
  memoryStats 
}: MemoryPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: memoryEntries, isLoading } = useQuery({
    queryKey: ['/api/memory/entries'],
    enabled: !!profileId,
  });

  // Removed redundant mutations - Evolution Panel handles optimization

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

      {/* All memory management now handled by Evolution Panel above */}
    </div>
  );
}
