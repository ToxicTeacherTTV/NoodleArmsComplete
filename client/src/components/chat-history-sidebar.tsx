import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

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
}

export default function ChatHistorySidebar({
  currentConversationId,
  onSelectConversation,
  onNewChat,
}: ChatHistorySidebarProps) {
  const { data: conversations = [], isLoading } = useQuery<ConversationWithMeta[]>({
    queryKey: ['/api/conversations/web'],
    refetchInterval: false,
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

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      <div className="p-4 border-b border-border">
        <Button
          onClick={onNewChat}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          data-testid="button-new-chat"
        >
          <i className="fas fa-plus mr-2"></i>
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Loading...
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
                      <button
                        key={conv.id}
                        onClick={() => onSelectConversation(conv.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
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
                    ))}
                  </div>
                </div>
              )
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
