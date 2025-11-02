import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import ChatPanel from "@/components/chat-panel";
import ControlPanel from "@/components/control-panel";
import ChatHistorySidebar from "@/components/chat-history-sidebar";
// PersonalityPanel moved to brain-management.tsx
// MemoryPanel and DocumentPanel moved to brain-management.tsx
import StatusIndicator from "@/components/status-indicator";
import VoiceVisualizer from "@/components/voice-visualizer";
import ProfileModal from "@/components/profile-modal";
import PersonalitySurgePanel from "@/components/personality-surge-panel";
import { MemoryChecker } from "@/components/memory-checker";
import NotesModal from "@/components/notes-modal";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { useElevenLabsSpeech } from "@/hooks/use-elevenlabs-speech";
import { useVoiceActivity } from "@/hooks/use-voice-activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Message, Profile, AIStatus, StreamSettings, VoiceActivity, AppMode, ChatResponse, ConversationResponse, MemoryStats } from "@/types";
import { apiRequest } from "@/lib/queryClient";
import { nanoid } from "nanoid";

export default function JazzDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // State management
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiStatus, setAiStatus] = useState<AIStatus>('IDLE');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('PODCAST');
  const [streamSettings, setStreamSettings] = useState<StreamSettings>({
    autoRespond: true,
    voiceOutput: false, // Default to false to prevent auto credit burning
    memoryLearning: true,
  });

  // Auto-enable voice output when switching to STREAMING mode
  useEffect(() => {
    if (appMode === 'STREAMING') {
      setStreamSettings(prev => ({
        ...prev,
        voiceOutput: true // Auto-enable voice output in streaming mode
      }));
    }
  }, [appMode]);
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date());
  const [memoryCheckerOpen, setMemoryCheckerOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [checkerPosition, setCheckerPosition] = useState({ x: 0, y: 0 });
  const [pendingTranscript, setPendingTranscript] = useState<string>(''); // For manual voice control
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false); // Memory debug panel

  // Refs for queue management
  const messageQueueRef = useRef<Message[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Custom hooks
  const { isListening, startListening, stopListening, transcript, interimTranscript, resetTranscript, error: speechError } = useSpeechRecognition();
  const { speak: speakBrowser, isSpeaking: isSpeakingBrowser, stop: stopSpeakingBrowser } = useSpeechSynthesis();
  const { speak: speakElevenLabs, isSpeaking: isSpeakingElevenLabs, isPaused: isPausedElevenLabs, stop: stopSpeakingElevenLabs, pause: pauseElevenLabs, resume: resumeElevenLabs, replay: replayElevenLabs, canReplay: canReplayElevenLabs, saveAudio: saveAudioElevenLabs, canSave: canSaveElevenLabs } = useElevenLabsSpeech();
  const voiceActivity = useVoiceActivity(isListening);

  // Always use ElevenLabs when available and voice output is enabled, fall back to browser if needed
  const speak = speakElevenLabs;
  const isSpeaking = isSpeakingElevenLabs;
  const stopSpeaking = stopSpeakingElevenLabs;

  // Browser speech doesn't support pause/resume/replay - create safe fallbacks
  const pausePlayback = () => stopSpeakingBrowser();
  const resumePlayback = () => {}; // Browser speech can't resume
  const replayLastAudio = () => {}; // Browser speech can't replay
  const canReplay = false; // Browser speech doesn't support replay
  const isPaused = false; // Browser speech doesn't have pause state
  const speakText = speakBrowser;

  // Queries with proper error and loading handling
  const { data: activeProfile, isLoading: profileLoading, isError: profileError } = useQuery<Profile>({
    queryKey: ['/api/profiles/active'],
    refetchInterval: false,
  });

  // Handle profile error
  useEffect(() => {
    if (profileError) {
      console.error('Failed to fetch active profile:', profileError);
      toast({
        title: "Profile Error",
        description: "Failed to load active profile. Please refresh the page.",
        variant: "destructive",
      });
    }
  }, [profileError, toast]);

  const { data: memoryStats, isLoading: statsLoading, isError: statsError } = useQuery<MemoryStats>({
    queryKey: ['/api/memory/stats'],
    refetchInterval: 120000, // Reduced from 30s to 2min to reduce flickering
  });

  // Handle memory stats error
  useEffect(() => {
    if (statsError) {
      console.error('Failed to fetch memory stats:', statsError);
    }
  }, [statsError]);

  const { data: documents, isLoading: documentsLoading, isError: documentsError } = useQuery({
    queryKey: ['/api/documents'],
    refetchInterval: false,
  });

  // Handle documents error
  useEffect(() => {
    if (documentsError) {
      console.error('Failed to fetch documents:', documentsError);
    }
  }, [documentsError]);

  // Note: chaosState no longer needed - PersonalitySurgePanel manages its own state

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; type: string; content: string; metadata?: any }) => {
      const response = await apiRequest('POST', '/api/chat', {
        conversationId: data.conversationId,
        message: data.content,
        profileId: activeProfile?.id,
        mode: appMode,
      });
      return response.json();
    },
    onSuccess: (response) => {
      if (response?.content) {
        const aiMessage: Message = {
          id: nanoid(),
          conversationId: currentConversationId,
          type: 'AI',
          content: response.content,
          createdAt: new Date().toISOString(),
          rating: null,
          metadata: {
            processingTime: response.processingTime,
            retrieved_context: response.retrieved_context,
          },
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // NOTE: Removed auto-play to prevent burning ElevenLabs credits
        // Users can now click Play button on individual messages for voice synthesis
        
        // BUT: Auto-play IS enabled in STREAMING mode for interactive experience
        if (appMode === 'STREAMING' && streamSettings.voiceOutput) {
          speakElevenLabs(response.content);
          setAiStatus('SPEAKING');
        }
      }
      
      // 🎲 ENHANCED: Invalidate chaos state after AI response for dynamic UI updates
      queryClient.invalidateQueries({ queryKey: ['/api/chaos/state'] });
      // Invalidate conversation list to update message counts
      queryClient.invalidateQueries({ queryKey: ['/api/conversations/web'] });
      
      setAiStatus('IDLE');
    },
    onError: () => {
      setAiStatus('ERROR');
    },
  });

  const createConversationMutation = useMutation<ConversationResponse, Error>({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/conversations', {
        profileId: activeProfile?.id,
        title: `Session ${new Date().toLocaleTimeString()}`,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations/web'] });
    },
  });

  const consolidateMemoryMutation = useMutation({
    mutationFn: (conversationId: string) => {
      return apiRequest('POST', `/api/memory/consolidate/${conversationId}`);
    },
    onSuccess: () => {
      toast({
        title: "Memory Consolidated",
        description: "Conversation has been processed and stored in Nicky's memory.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
    },
  });

  // Fetch messages when conversation changes
  const { data: conversationMessages } = useQuery<Message[]>({
    queryKey: ['/api/conversations', currentConversationId, 'messages'],
    enabled: !!currentConversationId,
    refetchInterval: false,
  });

  // Sync fetched messages to state when they load
  useEffect(() => {
    if (conversationMessages && conversationMessages.length > 0) {
      setMessages(conversationMessages);
    }
  }, [conversationMessages]);

  // Initialize conversation on mount
  useEffect(() => {
    if (!currentConversationId && activeProfile?.id) {
      createConversationMutation.mutate();
    }
  }, [activeProfile?.id]);

  // Handle speech recognition transcript - always update pending transcript (manual mode)
  useEffect(() => {
    // Always show live interim transcript, even when not listening (captures final results)
    const newPending = interimTranscript || transcript || '';
    setPendingTranscript(newPending);
  }, [transcript, interimTranscript, appMode]);

  // Handle voice control (only in streaming mode) - MANUAL MODE
  const toggleListening = () => {
    if (appMode !== 'STREAMING') {
      return;
    }
    
    if (isListening) {
      // STOP: Process the pending transcript and send message
      stopListening();
      
      // Capture final text from available sources to avoid race conditions
      const finalText = (transcript || interimTranscript || pendingTranscript).trim();
      
      if (finalText && currentConversationId) {
        const userMessage: Message = {
          id: nanoid(),
          conversationId: currentConversationId,
          type: 'USER',
          content: finalText,
          rating: null,
          metadata: { voice: true },
          createdAt: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        
        // Send to backend
        sendMessageMutation.mutate({
          conversationId: currentConversationId,
          type: 'USER',
          content: finalText,
          metadata: { voice: true },
        });
      }
      
      // Clear pending transcript
      setPendingTranscript('');
      resetTranscript();
      setAiStatus('IDLE');
    } else {
      // START: Begin listening and clear any previous transcript
      setPendingTranscript('');
      resetTranscript();
      startListening();
      setAiStatus('LISTENING');
    }
  };

  // Calculate session duration
  const getSessionDuration = () => {
    const now = new Date();
    const diff = now.getTime() - sessionStartTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle text selection for memory checking
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (selectedText && selectedText.length > 2) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      
      if (rect) {
        setSelectedText(selectedText);
        setCheckerPosition({ x: rect.left, y: rect.top });
        setMemoryCheckerOpen(true);
      }
    }
  };

  // Handle conversation switching
  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setMessages([]); // Clear current messages, will be loaded from backend
  };

  // Handle new chat creation
  const handleNewChat = () => {
    createConversationMutation.mutate();
    setMessages([]);
  };

  const documentCount = Array.isArray(documents) ? documents.length : 0;

  return (
    <>
      <Sheet open={isHistorySheetOpen} onOpenChange={setIsHistorySheetOpen}>
        <SheetContent side="left" className="p-0 sm:max-w-md">
          <SheetHeader className="px-4 py-3">
            <SheetTitle>Conversation History</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-4rem)]">
            <ChatHistorySidebar
              currentConversationId={currentConversationId}
              onSelectConversation={(conversationId) => {
                setIsHistorySheetOpen(false);
                handleSelectConversation(conversationId);
              }}
              onNewChat={() => {
                setIsHistorySheetOpen(false);
                handleNewChat();
              }}
              variant="sidebar"
              className="h-full"
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex min-h-screen flex-col">
          <header className="border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <span className="text-2xl">🎷</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {activeProfile?.name || "Nicky A.I. Dente"}
                  </h1>
                  <p className="text-sm text-muted-foreground">"Noodle Arms" Jazz Cup Co-Host</p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                  <StatusIndicator status={aiStatus} />
                  <ToggleGroup
                    type="single"
                    value={appMode}
                    onValueChange={(value) => {
                      if (value) {
                        setAppMode(value as AppMode);
                      }
                    }}
                    size="sm"
                    className="rounded-lg bg-muted/50 p-1"
                  >
                    <ToggleGroupItem value="PODCAST" aria-label="Podcast mode">
                      <i className="fas fa-podcast" />
                      <span className="hidden sm:inline">Podcast</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="STREAMING" aria-label="Streaming mode">
                      <i className="fas fa-broadcast-tower" />
                      <span className="hidden sm:inline">Streaming</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <Button
                    variant="outline"
                    size="sm"
                    className="sm:hidden"
                    onClick={() => setIsHistorySheetOpen(true)}
                    data-testid="button-toggle-sidebar"
                  >
                    <i className="fas fa-clock-rotate-left mr-2" />
                    History
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsProfileModalOpen(true)}>
                    <i className="fas fa-user-astronaut mr-2" />
                    Profile
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsNotesModalOpen(true)}>
                    <i className="fas fa-note-sticky mr-2" />
                    Notes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation('/workspace')}
                    data-testid="button-project-workspace"
                  >
                    <span className="hidden md:inline">🚧 Project Workspace</span>
                    <span className="md:hidden">🚧</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation('/brain')}
                    data-testid="button-brain-management"
                  >
                    <span className="hidden md:inline">🧠 Brain Management</span>
                    <span className="md:hidden">🧠</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation('/listener-cities')}
                    data-testid="button-listener-cities"
                  >
                    <span className="hidden md:inline">🗺️ Listener Cities</span>
                    <span className="md:hidden">🗺️</span>
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-hidden">
            <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 px-4 py-6">
              <div className="grid flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
                <Card className="hidden min-h-0 flex-col overflow-hidden lg:flex">
                  <CardHeader className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground">Conversations</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {messages.length} active
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex-1 p-0">
                    <ChatHistorySidebar
                      currentConversationId={currentConversationId}
                      onSelectConversation={handleSelectConversation}
                      onNewChat={handleNewChat}
                      variant="embedded"
                      className="h-full"
                    />
                  </CardContent>
                </Card>

                <div className="flex min-h-0 flex-col gap-4">
                  <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-primary/20 shadow-xl">
                    <CardContent className="flex-1 p-0">
                      <ChatPanel
                        messages={messages}
                        sessionDuration={getSessionDuration()}
                        messageCount={messages.length}
                        appMode={appMode}
                        isDebugMode={isDebugMode}
                        onToggleDebugMode={() => setIsDebugMode(!isDebugMode)}
                        onPlayAudio={(content: string) => {
                          if (appMode === 'PODCAST') {
                            if (isSpeakingElevenLabs && !isPausedElevenLabs) {
                              pauseElevenLabs();
                            } else if (isPausedElevenLabs) {
                              resumeElevenLabs();
                            } else {
                              speakElevenLabs(content);
                            }
                          } else {
                            if (isSpeaking && !isPaused) {
                              pausePlayback();
                            } else if (isPaused) {
                              resumePlayback();
                            } else {
                              speakText(content);
                            }
                          }
                        }}
                        onReplayAudio={() => {
                          if (appMode === 'PODCAST') {
                            replayElevenLabs();
                          } else {
                            replayLastAudio();
                          }
                        }}
                        onSaveAudio={(filename?: string) => {
                          if (appMode === 'PODCAST') {
                            saveAudioElevenLabs(filename);
                          }
                        }}
                        isPlayingAudio={appMode === 'PODCAST' ? isSpeakingElevenLabs && !isPausedElevenLabs : isSpeaking && !isPaused}
                        isPausedAudio={appMode === 'PODCAST' ? isPausedElevenLabs : isPaused}
                        canReplay={appMode === 'PODCAST' ? canReplayElevenLabs : canReplay}
                        canSave={appMode === 'PODCAST' ? canSaveElevenLabs : false}
                        onTextSelection={handleTextSelection}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/10 shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <i className="fas fa-keyboard text-muted-foreground" />
                        Message Composer
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {appMode === 'STREAMING'
                          ? 'Use keyboard or microphone to keep pace with live chat without leaving stream mode.'
                          : 'Draft scripted prompts and switch to streaming mode when you are ready to go live.'}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.target as HTMLFormElement);
                          const message = (formData.get('message') as string) || '';
                          const trimmed = message.trim();
                          if (!trimmed) {
                            return;
                          }

                          const userMessage: Message = {
                            id: nanoid(),
                            conversationId: currentConversationId,
                            type: 'USER',
                            content: trimmed,
                            createdAt: new Date().toISOString(),
                            rating: null,
                            metadata: null,
                          };

                          setMessages(prev => [...prev, userMessage]);
                          setAiStatus('PROCESSING');
                          sendMessageMutation.mutate({
                            conversationId: currentConversationId,
                            type: 'USER',
                            content: trimmed,
                          });
                          (e.target as HTMLFormElement).reset();
                        }}
                        className="space-y-3"
                      >
                        <Textarea
                          name="message"
                          className="min-h-[80px] w-full resize-none rounded-lg border border-border bg-input p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:ring-2 focus:ring-ring"
                          placeholder={isListening ? '🎤 Listening... speak now!' : 'Type a message to Nicky... (Enter to send, Shift+Enter for new line)'}
                          data-testid="textarea-message-input"
                          readOnly={isListening}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              const form = e.currentTarget.form;
                              form?.requestSubmit();
                            }
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="submit" className="bg-accent px-4 text-accent-foreground hover:bg-accent/90" data-testid="button-send-message">
                            <i className="fas fa-paper-plane mr-2" />
                            Send Message
                          </Button>
                          <Button
                            type="button"
                            onClick={toggleListening}
                            className={`px-4 transition-colors ${
                              isListening
                                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                            data-testid="button-toggle-listening"
                          >
                            <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'} mr-2`} />
                            {isListening ? 'Stop Listening' : 'Start Listening'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setMessages([])}
                            data-testid="button-clear-chat"
                          >
                            <i className="fas fa-trash mr-2" />
                            Clear Chat
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (messages.length > 0) {
                                consolidateMemoryMutation.mutate(currentConversationId);
                              }
                            }}
                            data-testid="button-store-conversation"
                          >
                            <i className="fas fa-save mr-2" />
                            Store to Memory
                          </Button>
                        </div>
                      </form>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <i className="fas fa-clock" />
                          {getSessionDuration()}
                        </Badge>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <i className="fas fa-comments" />
                          {messages.length} messages
                        </Badge>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <i className="fas fa-brain" />
                          {memoryStats?.totalFacts ?? 0} facts
                        </Badge>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <i className="fas fa-folder-tree" />
                          {documentCount} docs
                        </Badge>
                      </div>

                      <Collapsible open={isMobileControlsOpen} onOpenChange={setIsMobileControlsOpen} className="md:hidden">
                        <Card className="border border-dashed border-primary/30 bg-muted/10">
                          <CollapsibleTrigger asChild>
                            <CardHeader className="flex cursor-pointer items-center justify-between pb-2">
                              <CardTitle className="text-sm font-semibold">Live Controls</CardTitle>
                              <Button variant="ghost" size="sm">
                                <i className={`fas ${isMobileControlsOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                              </Button>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="space-y-4">
                              <ControlPanel
                                onToggleListening={toggleListening}
                                onSendText={(message: string) => {
                                  if (message.trim()) {
                                    const userMessage: Message = {
                                      id: nanoid(),
                                      conversationId: currentConversationId,
                                      type: 'USER',
                                      content: message.trim(),
                                      createdAt: new Date().toISOString(),
                                      rating: null,
                                      metadata: null,
                                    };
                                    setMessages(prev => [...prev, userMessage]);
                                    setAiStatus('PROCESSING');
                                    sendMessageMutation.mutate({
                                      conversationId: currentConversationId,
                                      type: 'USER',
                                      content: message.trim(),
                                    });
                                  }
                                }}
                                onClearChat={() => setMessages([])}
                                onStoreConversation={() => {
                                  if (messages.length > 0) {
                                    consolidateMemoryMutation.mutate(currentConversationId);
                                  }
                                }}
                                onPauseSpeech={pauseElevenLabs}
                                onResumeSpeech={resumeElevenLabs}
                                onStopSpeech={stopSpeaking}
                                isListening={isListening}
                                isSpeaking={isSpeaking}
                                isPaused={isPausedElevenLabs}
                                appMode={appMode}
                                pendingTranscript={pendingTranscript}
                              />
                              <VoiceVisualizer
                                voiceActivity={voiceActivity}
                                isActive={isListening}
                                streamSettings={streamSettings}
                                onUpdateSettings={setStreamSettings}
                                variant="embedded"
                              />
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </CardContent>
                  </Card>
                </div>

                <Card className="hidden min-h-0 flex-col overflow-hidden xl:flex">
                  <CardHeader className="border-b border-border/60 px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <i className="fas fa-sliders-h" />
                      Command Center
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      <div className="rounded-lg border border-dashed border-primary/30 bg-muted/10 p-4">
                        <h3 className="text-sm font-semibold text-foreground">Session Summary</h3>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <i className="fas fa-clock text-primary" />
                            <span>{getSessionDuration()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="fas fa-comments text-primary" />
                            <span>{messages.length} messages</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="fas fa-brain text-primary" />
                            <span>{memoryStats?.totalFacts ?? 0} facts</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="fas fa-folder-open text-primary" />
                            <span>{documentCount} docs</span>
                          </div>
                        </div>
                      </div>

                      <Card className="border border-border/80 shadow-sm">
                        <CardContent className="p-0">
                          <ControlPanel
                            onToggleListening={toggleListening}
                            onSendText={(message: string) => {
                              if (message.trim()) {
                                const userMessage: Message = {
                                  id: nanoid(),
                                  conversationId: currentConversationId,
                                  type: 'USER',
                                  content: message.trim(),
                                  createdAt: new Date().toISOString(),
                                  rating: null,
                                  metadata: null,
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setAiStatus('PROCESSING');
                                sendMessageMutation.mutate({
                                  conversationId: currentConversationId,
                                  type: 'USER',
                                  content: message.trim(),
                                });
                              }
                            }}
                            onClearChat={() => setMessages([])}
                            onStoreConversation={() => {
                              if (messages.length > 0) {
                                consolidateMemoryMutation.mutate(currentConversationId);
                              }
                            }}
                            onPauseSpeech={pauseElevenLabs}
                            onResumeSpeech={resumeElevenLabs}
                            onStopSpeech={stopSpeaking}
                            isListening={isListening}
                            isSpeaking={isSpeaking}
                            isPaused={isPausedElevenLabs}
                            appMode={appMode}
                            pendingTranscript={pendingTranscript}
                          />
                        </CardContent>
                      </Card>

                      <VoiceVisualizer
                        voiceActivity={voiceActivity}
                        isActive={isListening}
                        streamSettings={streamSettings}
                        onUpdateSettings={setStreamSettings}
                        variant="embedded"
                      />

                      <Card className="border border-border/80 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-muted-foreground">
                            Personality Surge
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <PersonalitySurgePanel />
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>

      {/* Memory Checker */}
      <MemoryChecker
        selectedText={selectedText}
        profileId={activeProfile?.id}
        isOpen={memoryCheckerOpen}
        onClose={() => setMemoryCheckerOpen(false)}
        position={checkerPosition}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Notes Modal */}
      <NotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
      />

        </div>
      </div>
    </>
  );
}
