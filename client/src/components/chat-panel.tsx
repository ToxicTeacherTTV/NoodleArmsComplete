import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Message, AppMode } from "@/types";

interface ChatPanelProps {
  messages: Message[];
  sessionDuration: string;
  messageCount: number;
  appMode?: AppMode;
  isDebugMode?: boolean;
  onToggleDebugMode?: () => void;
  onPlayAudio?: (content: string) => void;
  onReplayAudio?: () => void;
  onSaveAudio?: (filename?: string) => void;
  isPlayingAudio?: boolean;
  isPausedAudio?: boolean;
  canReplay?: boolean;
  canSave?: boolean;
  onTextSelection?: () => void;
}

export default function ChatPanel({ messages, sessionDuration, messageCount, appMode = 'PODCAST', isDebugMode = false, onToggleDebugMode, onPlayAudio, onReplayAudio, onSaveAudio, isPlayingAudio = false, isPausedAudio = false, canReplay = false, canSave = false, onTextSelection }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rateMessageMutation = useMutation({
    mutationFn: async ({ messageId, rating }: { messageId: string; rating: number }) => {
      return await apiRequest('PATCH', `/api/messages/${messageId}/rate`, { rating });
    },
    onMutate: async ({ messageId, rating }) => {
      // Optimistically update the UI immediately
      queryClient.setQueryData(['messages'], (oldMessages: Message[] | undefined) => {
        if (!oldMessages) return oldMessages;
        return oldMessages.map(msg => 
          msg.id === messageId ? { ...msg, rating } : msg
        );
      });
    },
    onSuccess: () => {
      toast({
        title: "Rating Saved",
        description: "Thank you for your feedback!",
      });
      // Invalidate conversation-related queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: any, { messageId }) => {
      // Revert optimistic update on error
      queryClient.setQueryData(['messages'], (oldMessages: Message[] | undefined) => {
        if (!oldMessages) return oldMessages;
        return oldMessages.map(msg => 
          msg.id === messageId ? { ...msg, rating: undefined } : msg
        );
      });
      
      toast({
        title: "Rating Failed",
        description: error.message || "Could not save rating",
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    // Force immediate scroll to ensure visibility
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Backup: Force scroll after a short delay to handle layout timing
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [messages]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageStyle = (type: Message['type']) => {
    switch (type) {
      case 'USER':
        return 'ml-auto max-w-[70%] bg-secondary text-secondary-foreground';
      case 'AI':
        return 'mr-auto max-w-[70%] bg-card text-card-foreground border border-border';
      case 'CHATTER':
        return 'mr-auto max-w-[70%] bg-muted text-muted-foreground';
      case 'SYSTEM':
        return 'mx-auto max-w-[50%] bg-muted/30 text-muted-foreground text-center';
      default:
        return '';
    }
  };

  const getMessageIcon = (type: Message['type']) => {
    switch (type) {
      case 'AI':
        return <i className="fas fa-robot text-white text-sm"></i>;
      case 'CHATTER':
        return <i className="fas fa-comment text-white text-sm"></i>;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-display font-semibold text-foreground">Live Chat Session</h2>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <i className="fas fa-clock"></i>
              <span data-testid="session-duration">{sessionDuration}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 text-xs">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-muted-foreground">Claude API</span>
              </div>
              
              <div className="flex items-center space-x-1 text-xs">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-muted-foreground">ElevenLabs</span>
              </div>
            </div>
            
            {onToggleDebugMode && (
              <Button
                onClick={onToggleDebugMode}
                variant={isDebugMode ? "default" : "outline"}
                size="sm"
                className="text-xs"
                data-testid="button-toggle-debug"
              >
                <i className="fas fa-bug mr-1"></i>
                Debug
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 pb-6 space-y-4 chat-scroll scroll-smooth" style={{ minHeight: 0, maxHeight: '100%' }} data-testid="chat-messages">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <i className="fas fa-comments text-4xl mb-4 opacity-50"></i>
              <p className="text-lg">Start a conversation with Nicky!</p>
              <p className="text-sm">Use the microphone or type a message to begin.</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className="flex" data-testid={`message-${message.type.toLowerCase()}`}>
                {message.type === 'USER' ? (
                  <div className={`px-4 py-3 rounded-2xl rounded-br-md ${getMessageStyle(message.type)}`}>
                    <div 
                      className="text-sm cursor-text select-text"
                      onMouseUp={onTextSelection}
                      data-testid={`message-content-${message.id}`}
                    >
                      {message.content}
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                      You • {formatTime(message.createdAt)}
                      {message.metadata?.voice && <i className="fas fa-microphone ml-2 text-accent"></i>}
                    </div>
                  </div>
                ) : message.type === 'SYSTEM' ? (
                  <div className={`px-3 py-1 rounded-full text-xs ${getMessageStyle(message.type)}`}>
                    {message.content}
                  </div>
                ) : (
                  <div className="flex space-x-3 max-w-[70%]">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0">
                      {getMessageIcon(message.type)}
                    </div>
                    <div className={`px-4 py-3 rounded-2xl rounded-bl-md ${getMessageStyle(message.type)}`}>
                      <div 
                        className="text-sm cursor-text select-text"
                        onMouseUp={onTextSelection}
                        data-testid={`message-content-${message.id}`}
                      >
                        {message.type === 'CHATTER' && message.metadata?.speaker && (
                          <span className="text-accent font-medium">{message.metadata.speaker}: </span>
                        )}
                        {message.content}
                      </div>
                      <div className="text-xs opacity-70 mt-2 flex items-center space-x-2">
                        <span>
                          {message.type === 'AI' ? 'Nicky' : 'Chat'} • {formatTime(message.createdAt)}
                        </span>
                        {message.type === 'AI' && appMode === 'PODCAST' && onPlayAudio && (
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => onPlayAudio(message.content)}
                              className="flex items-center space-x-1 text-accent hover:text-accent/80 transition-colors"
                              data-testid={`play-audio-${message.id}`}
                            >
                              <i className={`fas ${isPlayingAudio ? (isPausedAudio ? 'fa-play' : 'fa-pause') : 'fa-play'} text-xs`}></i>
                              <span className="text-xs">
                                {isPlayingAudio ? (isPausedAudio ? 'Resume' : 'Pause') : 'Play Audio'}
                              </span>
                            </button>
                            {onReplayAudio && canReplay && (
                              <button
                                onClick={onReplayAudio}
                                className="flex items-center space-x-1 text-accent hover:text-accent/80 transition-colors"
                                data-testid={`replay-audio-${message.id}`}
                              >
                                <i className="fas fa-redo text-xs"></i>
                                <span className="text-xs">Replay</span>
                              </button>
                            )}
                            {onSaveAudio && canSave && (
                              <button
                                onClick={() => onSaveAudio(`nicky-message-${message.id}.mp3`)}
                                className="flex items-center space-x-1 text-accent hover:text-accent/80 transition-colors"
                                data-testid={`save-audio-${message.id}`}
                              >
                                <i className="fas fa-download text-xs"></i>
                                <span className="text-xs">Save</span>
                              </button>
                            )}
                          </div>
                        )}
                        {message.type === 'AI' && appMode === 'STREAMING' && (
                          <>
                            <i className="fas fa-volume-up text-accent"></i>
                            <span className="text-accent">Auto-Spoken</span>
                          </>
                        )}
                        {message.metadata?.processingTime && (
                          <span className="text-muted-foreground">({message.metadata.processingTime}ms)</span>
                        )}
                        
                        {/* Rating buttons for AI messages */}
                        {message.type === 'AI' && (
                          <div className="flex items-center space-x-2 ml-2 pl-2 border-l border-border">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => rateMessageMutation.mutate({ messageId: message.id, rating: 2 })}
                              className={`h-6 px-2 text-xs transition-colors ${
                                message.rating === 2 
                                  ? 'text-green-400 hover:text-green-500' 
                                  : 'text-muted-foreground hover:text-green-400'
                              }`}
                              disabled={rateMessageMutation.isPending}
                              data-testid={`button-thumbs-up-${message.id}`}
                            >
                              <i className="fas fa-thumbs-up text-xs"></i>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => rateMessageMutation.mutate({ messageId: message.id, rating: 1 })}
                              className={`h-6 px-2 text-xs transition-colors ${
                                message.rating === 1 
                                  ? 'text-red-400 hover:text-red-500' 
                                  : 'text-muted-foreground hover:text-red-400'
                              }`}
                              disabled={rateMessageMutation.isPending}
                              data-testid={`button-thumbs-down-${message.id}`}
                            >
                              <i className="fas fa-thumbs-down text-xs"></i>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Memory Debug Panel */}
      {isDebugMode && (
        <div className="border-t border-border bg-muted/30 p-4 max-h-64 overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="fas fa-bug text-orange-600"></i>
              <h3 className="font-semibold text-sm">Retrieved Memories</h3>
              <Badge variant="secondary" className="text-xs">Debug Mode</Badge>
            </div>
            
            {messages
              .filter(m => m.type === 'AI' && m.metadata?.retrieved_context)
              .map(msg => (
                <div key={msg.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    {new Date(msg.createdAt).toLocaleTimeString()} • 
                    {msg.metadata?.processingTime ? ` ${msg.metadata.processingTime}ms` : ''}
                  </div>
                  <div className="text-sm bg-muted/50 rounded p-2 font-mono whitespace-pre-wrap">
                    {msg.metadata?.retrieved_context || 'No context'}
                  </div>
                </div>
              ))}
            
            {messages.filter(m => m.type === 'AI' && m.metadata?.retrieved_context).length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">
                <i className="fas fa-info-circle mb-2"></i>
                <p>No retrieved memories yet. Start chatting to see debug info!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
