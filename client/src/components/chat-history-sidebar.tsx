import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConversationWithMeta {
  id: string;
  profileId: string;
  createdAt: Date | null;
  contentType: string;
  title?: string;
  messageCount: number;
  firstMessage?: string;
}

interface ChatHistorySidebarProps {
  currentConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  variant?: 'sidebar' | 'embedded';
  className?: string;
}

export default function ChatHistorySidebar({
  currentConversationId,
  onSelectConversation,
  onNewChat,
  variant = 'sidebar',
  className,
}: ChatHistorySidebarProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: conversations = [], isLoading } = useQuery<ConversationWithMeta[]>({
    queryKey: ['/api/conversations/web', showArchived],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/web?archived=${showArchived}`);
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return res.json();
    },
    refetchInterval: false,
  });

  const evaluateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/conversations/${id}/evaluate`);
      return res.json();
    },
    onSuccess: (data) => {
      setEvaluationResult(data.evaluation);
    },
    onError: () => {
      toast({
        title: "Evaluation Failed",
        description: "Could not evaluate conversation.",
        variant: "destructive",
      });
      setEvaluatingId(null);
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, isArchived }: { id: string; isArchived: boolean }) => {
      return await apiRequest('PATCH', `/api/conversations/${id}/archive`, { isArchived });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations/web'] });
      toast({
        title: showArchived ? "Unarchived" : "Archived",
        description: showArchived ? "Conversation restored to main list" : "Conversation archived",
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      return await apiRequest('PATCH', `/api/conversations/${id}/title`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations/web'] });
      setRenamingId(null);
      setNewTitle("");
      toast({
        title: "Renamed",
        description: "Conversation title updated",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async ({ id, format }: { id: string; format: 'txt' | 'json' }) => {
      const res = await fetch(`/api/conversations/${id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) throw new Error('Export failed');
      
      if (format === 'json') {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${id}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${id}.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    },
    onSuccess: () => {
      toast({
        title: "Exported",
        description: "Conversation downloaded successfully",
      });
    },
  });

  const generateTitle = (conv: ConversationWithMeta) => {
    // Use AI-generated title if available
    if (conv.title) {
      return conv.title;
    }
    // Fall back to first message preview
    if (conv.firstMessage) {
      return conv.firstMessage.length > 40 
        ? conv.firstMessage.substring(0, 40) + "..." 
        : conv.firstMessage;
    }
    // Last resort: message count
    return `Chat (${conv.messageCount} msgs)`;
  };

  const getRelativeTime = (date: Date | null) => {
    if (!date) return 'Unknown';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const groupByDate = (convs: ConversationWithMeta[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: Record<string, ConversationWithMeta[]> = {
      Today: [],
      Yesterday: [],
      'Last 7 Days': [],
      Older: []
    };

    convs.forEach(conv => {
      if (!conv.createdAt) {
        groups['Older'].push(conv);
        return;
      }
      const convDate = new Date(conv.createdAt);
      convDate.setHours(0, 0, 0, 0);

      if (convDate.getTime() === today.getTime()) {
        groups['Today'].push(conv);
      } else if (convDate.getTime() === yesterday.getTime()) {
        groups['Yesterday'].push(conv);
      } else if ((today.getTime() - convDate.getTime()) / (1000 * 60 * 60 * 24) <= 7) {
        groups['Last 7 Days'].push(conv);
      } else {
        groups['Older'].push(conv);
      }
    });

    return groups;
  };

  const groupedConversations = groupByDate(conversations);

  const feedbackMutation = useMutation({
    mutationFn: async ({ content, conversationId }: { content: string; conversationId: string }) => {
      return await apiRequest('POST', '/api/personality/feedback', { content, conversationId });
    },
    onSuccess: () => {
      toast({
        title: "Feedback Applied",
        description: "Nicky will remember this critique for future conversations.",
      });
      setEvaluatingId(null);
      setEvaluationResult(null);
    },
  });

  const handleApplyFeedback = () => {
    if (!evaluationResult || !evaluatingId) return;
    
    // Simple heuristic: Extract the "Critique" or "Improvement" section if possible, 
    // otherwise send the whole summary.
    // For now, we'll send a summarized prompt.
    const feedbackContent = `Review of conversation ${evaluatingId}: ${evaluationResult.substring(0, 500)}...`;
    
    feedbackMutation.mutate({ 
      content: feedbackContent, 
      conversationId: evaluatingId 
    });
  };

  return (
    <div
      className={cn(
        "h-full flex flex-col",
        variant === 'sidebar' ? 'bg-card border-r border-border' : '',
        className
      )}
    >
      <div
        className={cn(
          "p-4 space-y-2",
          variant === 'sidebar'
            ? 'border-b border-border bg-card'
            : 'border-b border-border/60 bg-muted/20'
        )}
      >
        <Button
          onClick={onNewChat}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          data-testid="button-new-chat"
        >
          <i className="fas fa-plus mr-2"></i>
          New Chat
        </Button>
        <Button
          onClick={() => setShowArchived(!showArchived)}
          variant="outline"
          size="sm"
          className="w-full text-xs"
          data-testid="button-toggle-archived"
        >
          <i className={`fas ${showArchived ? 'fa-inbox' : 'fa-archive'} mr-2`}></i>
          {showArchived ? 'Show Active' : 'Show Archived'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-4 px-2">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 px-4">
              <i className="fas fa-comments text-3xl mb-3 opacity-50"></i>
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start chatting to see history</p>
            </div>
          ) : (
            Object.entries(groupedConversations).map(([group, convs]) => 
              convs.length > 0 && (
                <div key={group} className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground px-2 mb-2">
                    {group}
                  </h3>
                  <div className="space-y-1">
                    {convs.map((conv) => (
                      <ContextMenu key={conv.id}>
                        <ContextMenuTrigger asChild>
                          <div className="group relative">
                            <button
                              onClick={() => onSelectConversation(conv.id)}
                              className={`w-full text-left px-3 py-2 pr-9 rounded-lg transition-colors ${
                                conv.id === currentConversationId
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted text-foreground'
                              }`}
                              data-testid={`conversation-${conv.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {generateTitle(conv)}
                                  </p>
                                  <p className={`text-xs mt-1 ${
                                    conv.id === currentConversationId 
                                      ? 'text-primary-foreground/70' 
                                      : 'text-muted-foreground'
                                  }`}>
                                    {getRelativeTime(conv.createdAt)}
                                  </p>
                                </div>
                                {conv.messageCount > 0 && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    conv.id === currentConversationId
                                      ? 'bg-primary-foreground/20 text-primary-foreground'
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {conv.messageCount}
                                  </span>
                                )}
                              </div>
                            </button>
                            
                            <div className={`absolute right-1 top-1/2 -translate-y-1/2 ${
                              conv.id === currentConversationId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            } transition-opacity`}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-7 w-7 p-0 ${
                                      conv.id === currentConversationId
                                        ? 'text-primary-foreground hover:bg-primary-foreground/20'
                                        : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    data-testid={`conversation-menu-${conv.id}`}
                                  >
                                    <i className="fas fa-ellipsis-v text-xs"></i>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEvaluatingId(conv.id);
                                      evaluateMutation.mutate(conv.id);
                                    }}
                                  >
                                    <i className="fas fa-star mr-2"></i>
                                    Evaluate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenamingId(conv.id);
                                      setNewTitle(conv.title || "");
                                    }}
                                  >
                                    <i className="fas fa-pen mr-2"></i>
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      exportMutation.mutate({ id: conv.id, format: 'txt' });
                                    }}
                                    data-testid={`export-txt-${conv.id}`}
                                  >
                                    <i className="fas fa-download mr-2"></i>
                                    Export as TXT
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      exportMutation.mutate({ id: conv.id, format: 'json' });
                                    }}
                                    data-testid={`export-json-${conv.id}`}
                                  >
                                    <i className="fas fa-file-code mr-2"></i>
                                    Export as JSON
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      archiveMutation.mutate({ id: conv.id, isArchived: !showArchived });
                                    }}
                                    data-testid={`archive-${conv.id}`}
                                  >
                                    <i className={`fas ${showArchived ? 'fa-inbox' : 'fa-archive'} mr-2`}></i>
                                    {showArchived ? 'Unarchive' : 'Archive'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => {
                              setEvaluatingId(conv.id);
                              evaluateMutation.mutate(conv.id);
                            }}
                          >
                            <i className="fas fa-star mr-2"></i>
                            Evaluate
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              setRenamingId(conv.id);
                              setNewTitle(conv.title || "");
                            }}
                          >
                            <i className="fas fa-pen mr-2"></i>
                            Rename
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              archiveMutation.mutate({ id: conv.id, isArchived: !showArchived });
                            }}
                          >
                            <i className={`fas ${showArchived ? 'fa-inbox' : 'fa-archive'} mr-2`}></i>
                            {showArchived ? 'Unarchive' : 'Archive'}
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              exportMutation.mutate({ id: conv.id, format: 'txt' });
                            }}
                          >
                            <i className="fas fa-download mr-2"></i>
                            Export as TXT
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                  </div>
                </div>
              )
            )
          )}
        </div>
      </ScrollArea>

      <Dialog open={!!evaluatingId} onOpenChange={(open) => {
        if (!open) {
          setEvaluatingId(null);
          setEvaluationResult(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversation Evaluation</DialogTitle>
            <DialogDescription>
              AI analysis of the conversation quality and personality adherence.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {evaluateMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">Analyzing conversation...</p>
              </div>
            ) : evaluationResult ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap">{evaluationResult}</div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {evaluationResult && (
              <Button 
                variant="secondary" 
                onClick={handleApplyFeedback}
                disabled={feedbackMutation.isPending}
              >
                {feedbackMutation.isPending ? (
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                ) : (
                  <i className="fas fa-graduation-cap mr-2"></i>
                )}
                Apply as Coaching Note
              </Button>
            )}
            <Button onClick={() => {
              setEvaluatingId(null);
              setEvaluationResult(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renamingId} onOpenChange={(open) => !open && setRenamingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a new title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Title
              </Label>
              <Input
                id="name"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="col-span-3"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (renamingId && newTitle.trim()) {
                      renameMutation.mutate({ id: renamingId, title: newTitle.trim() });
                    }
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingId(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (renamingId && newTitle.trim()) {
                  renameMutation.mutate({ id: renamingId, title: newTitle.trim() });
                }
              }}
              disabled={!newTitle.trim() || renameMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
