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
  conversationId?: string;
  sessionDuration: string;
  messageCount: number;
  appMode?: AppMode;
  isDebugMode?: boolean;
  onToggleDebugMode?: () => void;
  onPlayAudio?: (content: string) => void;
  onPauseAudio?: (content: string) => void;
  onResumeAudio?: () => void;
  onStopAudio?: () => void;
  onReplayAudio?: () => void;
  onSaveAudio?: (filename?: string) => void;
  isPlayingAudio?: boolean;
  isPausedAudio?: boolean;
  canReplay?: boolean;
  canSave?: boolean;
  onTextSelection?: () => void;
  memoryLearning?: boolean;
  onToggleLearning?: () => void;
  onSaveToMemory?: (messageId: string, content: string) => void;
}

export default function ChatPanel({ messages, conversationId, sessionDuration, messageCount, appMode = 'PODCAST', isDebugMode = false, onToggleDebugMode, onPlayAudio, onPauseAudio, onResumeAudio, onStopAudio, onReplayAudio, onSaveAudio, isPlayingAudio = false, isPausedAudio = false, canReplay = false, canSave = false, onTextSelection, memoryLearning = true, onToggleLearning, onSaveToMemory }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [enhancingMessage, setEnhancingMessage] = useState<string | null>(null);

  // Preprocess text for TTS - adds line breaks before emotion tags for better ElevenLabs handling
  const preprocessForTTS = (text: string): string => {
    return text
      // Add line break after sentence-ending punctuation followed by emotion tag
      .replace(/([.!?])\s+\[/g, '$1\n[')
      // Also handle cases where there's already a tag and a new one starts (but not accent tags)
      .replace(/\]\s+\[(?!strong)/g, ']\n[');
  };

  const rateMessageMutation = useMutation({
    mutationFn: async ({ messageId, rating }: { messageId: string; rating: number }) => {
      return await apiRequest('PATCH', `/api/messages/${messageId}/rate`, { rating });
    },
    onMutate: async ({ messageId, rating }) => {
      // Optimistically update the UI immediately
      const queryKey = conversationId 
        ? ['/api/conversations', conversationId, 'messages']
        : ['messages'];

      queryClient.setQueryData(queryKey, (oldMessages: Message[] | undefined) => {
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
      
      const queryKey = conversationId 
        ? ['/api/conversations', conversationId, 'messages']
        : ['messages'];
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any, { messageId }) => {
      // Revert optimistic update on error
      const queryKey = conversationId 
        ? ['/api/conversations', conversationId, 'messages']
        : ['messages'];

      queryClient.setQueryData(queryKey, (oldMessages: Message[] | undefined) => {
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

  const enhanceTextMutation = useMutation({
    mutationFn: async ({ text, mode, messageId }: { text: string; mode?: 'quick' | 'ai'; messageId?: string }) => {
      const res = await fetch('/api/enhance-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode, messageId }),
      });
      if (!res.ok) throw new Error('Enhancement failed');
      return res.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: variables.mode === 'quick' ? "⚡ Quick Enhanced" : "🎭 AI Enhanced",
        description: "Text enhanced with emotion tags",
        duration: 3000,
      });
      setEnhancingMessage(null);
      
      // Invalidate messages to show the enhancement inline
      const queryKey = conversationId 
        ? ['/api/conversations', conversationId, 'messages']
        : ['messages'];
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any) => {
      toast({
        title: "Enhancement Failed",
        description: error.message || "Could not enhance text",
        variant: "destructive",
      });
      setEnhancingMessage(null);
    },
  });

  const handleEnhanceMessage = async (messageId: string, text: string, mode: 'quick' | 'ai' = 'ai') => {
    setEnhancingMessage(messageId);
    try {
      await enhanceTextMutation.mutateAsync({ text, mode, messageId });
    } catch (error) {
      // Error already handled by mutation
    }
  };

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
    <div className="flex-1 flex flex-col min-h-0">
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
                <span className="text-muted-foreground">Gemini 3 Flash</span>
              </div>
              
              <div className="flex items-center space-x-1 text-xs">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-muted-foreground">ElevenLabs</span>
              </div>

              <button 
                onClick={onToggleLearning}
                className="flex items-center space-x-1 text-xs border-l border-border pl-3 ml-1 hover:opacity-80 transition-opacity"
                title={memoryLearning ? "Click to disable learning (Private Mode)" : "Click to enable learning (Public Mode)"}
              >
                <div className={`w-2 h-2 rounded-full ${memoryLearning ? 'bg-blue-400 animate-pulse' : 'bg-amber-400'}`}></div>
                <span className={memoryLearning ? 'text-blue-400 font-medium' : 'text-muted-foreground'}>
                  {memoryLearning ? '🧠 Learning' : '🔒 Private'}
                </span>
              </button>
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
      <div className="flex-1 overflow-y-auto p-4 pb-6 space-y-4 chat-scroll scroll-smooth min-h-0 max-h-full" data-testid="chat-messages">
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
                    <div className="text-xs opacity-70 mt-1 flex items-center space-x-2">
                      <span>
                        You • {formatTime(message.createdAt)}
                        {message.metadata?.voice && <i className="fas fa-microphone ml-2 text-accent"></i>}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(message.content);
                          toast({ title: "Copied!", description: "Message copied to clipboard", duration: 2000 });
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors ml-2 pl-2 border-l border-border"
                        data-testid={`copy-message-${message.id}`}
                        aria-label="Copy message"
                        title="Copy message"
                      >
                        <i className="fas fa-copy text-xs"></i>
                      </button>
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
                      {message.metadata?.enhanced_content && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                              <i className="fas fa-wand-magic-sparkles"></i> Enhanced Version
                            </span>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(message.metadata.enhanced_content);
                                toast({ title: "Copied!", description: "Enhanced text copied", duration: 2000 });
                              }}
                              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy enhanced text"
                            >
                              <i className="fas fa-copy"></i>
                            </button>
                          </div>
                          <div className="text-sm italic text-foreground/90 bg-purple-500/5 p-2 rounded border border-purple-500/10">
                            {message.metadata.enhanced_content}
                          </div>
                        </div>
                      )}
                      <div className="text-xs opacity-70 mt-2 flex items-center space-x-2">
                        <span>
                          {message.type === 'AI' ? 'Nicky' : 'Chat'} • {formatTime(message.createdAt)}
                        </span>
                        {message.type === 'AI' && appMode === 'PODCAST' && onPlayAudio && (
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => {
                                if (isPlayingAudio) {
                                  if (isPausedAudio && onResumeAudio) {
                                    onResumeAudio();
                                  } else if (!isPausedAudio && onPauseAudio) {
                                    onPauseAudio();
                                  } else if (onPlayAudio) {
                                    // Fallback if pause/resume not provided
                                    onPlayAudio(message.content);
                                  }
                                } else if (onPlayAudio) {
                                  onPlayAudio(message.content);
                                }
                              }}
                              className="flex items-center space-x-1 text-accent hover:text-accent/80 transition-colors"
                              data-testid={`play-audio-${message.id}`}
                            >
                              <i className={`fas ${isPlayingAudio ? (isPausedAudio ? 'fa-play' : 'fa-pause') : 'fa-play'} text-xs`}></i>
                              <span className="text-xs">
                                {isPlayingAudio ? (isPausedAudio ? 'Resume' : 'Pause') : 'Play Audio'}
                              </span>
                            </button>
                            {isPlayingAudio && onStopAudio && (
                              <button
                                onClick={onStopAudio}
                                className="flex items-center space-x-1 text-red-400 hover:text-red-500 transition-colors"
                                data-testid={`stop-audio-${message.id}`}
                                title="Stop Audio"
                              >
                                <i className="fas fa-stop text-xs"></i>
                                <span className="text-xs">Stop</span>
                              </button>
                            )}
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
                        {message.type === 'AI' && onSaveToMemory && (
                          <button
                            onClick={() => onSaveToMemory(message.id, message.content)}
                            className="flex items-center space-x-1 text-accent hover:text-accent/80 transition-colors ml-2 pl-2 border-l border-border"
                            title="Save this specific response to memory"
                          >
                            <i className="fas fa-brain text-xs"></i>
                            <span className="text-xs">Save to Memory</span>
                          </button>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEnhanceMessage(message.id, message.content, 'ai')}
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-purple-400 transition-colors"
                              disabled={enhancingMessage === message.id}
                              title="Add emotion tags with AI"
                            >
                              {enhancingMessage === message.id ? (
                                <i className="fas fa-spinner fa-spin text-xs"></i>
                              ) : (
                                <i className="fas fa-wand-magic-sparkles text-xs"></i>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(message.content);
                                toast({ title: "Copied!", description: "Message copied to clipboard", duration: 2000 });
                              }}
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy message"
                              data-testid={`copy-ai-message-${message.id}`}
                            >
                              <i className="fas fa-copy text-xs"></i>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const ttsText = preprocessForTTS(message.content);
                                navigator.clipboard.writeText(ttsText);
                                toast({ title: "Copied for TTS!", description: "Text with line breaks copied", duration: 2000 });
                              }}
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-accent transition-colors"
                              title="Copy with line breaks for ElevenLabs"
                              data-testid={`copy-tts-${message.id}`}
                            >
                              <i className="fas fa-microphone text-xs"></i>
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
              .filter(m => m.type === 'AI' && (m.metadata?.debug_info || m.metadata?.retrieved_context))
              .slice(-1) // Only show for the last message to avoid clutter
              .map(msg => (
                <div key={msg.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    {new Date(msg.createdAt).toLocaleTimeString()} • 
                    {msg.metadata?.processingTime ? ` ${msg.metadata.processingTime}ms` : ''}
                  </div>
                  
                  {msg.metadata?.debug_info ? (
                    <div className="space-y-2">
                      {msg.metadata.debug_info.memories && msg.metadata.debug_info.memories.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-1">Memories ({msg.metadata.debug_info.memories.length})</h4>
                          <div className="space-y-1">
                            {msg.metadata.debug_info.memories.map((mem: any, idx: number) => (
                              <div key={idx} className="text-xs bg-muted/50 p-1 rounded flex justify-between items-start">
                                <span className="flex-1 mr-2">{mem.content}</span>
                                <div className="flex flex-col items-end">
                                  <Badge variant="outline" className="text-[10px] h-4 px-1">{Math.round(mem.score * 100)}%</Badge>
                                  <span className="text-[10px] text-muted-foreground">{mem.method}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {msg.metadata.debug_info.docs && msg.metadata.debug_info.docs.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-1 mt-2">Documents ({msg.metadata.debug_info.docs.length})</h4>
                          <div className="space-y-1">
                            {msg.metadata.debug_info.docs.map((doc: any, idx: number) => (
                              <div key={idx} className="text-xs bg-muted/50 p-1 rounded flex justify-between">
                                <span className="truncate flex-1 mr-2">{doc.content}</span>
                                <Badge variant="outline" className="text-[10px] h-4 px-1">{Math.round(doc.score * 100)}%</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm bg-muted/50 rounded p-2 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {msg.metadata?.retrieved_context || 'No context'}
                    </div>
                  )}
                </div>
              ))}
            
            {messages.filter(m => m.type === 'AI' && (m.metadata?.debug_info || m.metadata?.retrieved_context)).length === 0 && (
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
