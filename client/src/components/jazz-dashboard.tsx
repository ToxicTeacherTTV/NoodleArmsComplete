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
  const resumePlayback = () => { }; // Browser speech can't resume
  const replayLastAudio = () => { }; // Browser speech can't replay
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

  // 🎮 TWITCH AUDIO POLLING
  // Poll for pending audio commands (like !rant) from Twitch
  const { data: twitchAudioQueue } = useQuery<{ id: string; text: string; type: string }[]>({
    queryKey: ['/api/twitch/audio-queue'],
    refetchInterval: 3000, // Poll every 3 seconds
    refetchIntervalInBackground: true, // Keep polling even when tab is hidden
  });

  // Process Twitch audio queue
  useEffect(() => {
    // DBG: Always log the queue status to verify polling
    if (twitchAudioQueue) {
      console.log(`🎮 [Frontend] Polling Twitch Audio. Items: ${twitchAudioQueue.length}. VoiceOutput: ${streamSettings.voiceOutput}, AppMode: ${appMode}`);
    } else {
      console.log(`🎮 [Frontend] Polling Twitch Audio. Queue is UNDEFINED. VoiceOutput: ${streamSettings.voiceOutput}, AppMode: ${appMode}`);
    }

    if (twitchAudioQueue && twitchAudioQueue.length > 0) {
      console.log(`🎮 [Frontend] Found ${twitchAudioQueue.length} items in Twitch Audio Queue`);
      twitchAudioQueue.forEach(async (item) => {
        // Play the audio
        if (streamSettings.voiceOutput || appMode === 'STREAMING') {
          console.log(`🎮 [Frontend] Playing Twitch Audio: [${item.type}] "${item.text.substring(0, 50)}..."`);
          speakElevenLabs(item.text);

          // Acknowledge to remove from queue
          try {
            await apiRequest('POST', `/api/twitch/audio-queue/${item.id}/ack`);
            console.log(`🎮 [Frontend] Acknowledged audio ${item.id}`);
            queryClient.invalidateQueries({ queryKey: ['/api/twitch/audio-queue'] });
          } catch (e) {
            console.error("Failed to ack Twitch audio:", e);
          }
        } else {
          console.log(`⚠️ [Frontend] Skipped Twitch Audio (Voice Disabled): ${item.type}`);
        }
      });
    }
  }, [twitchAudioQueue, speakElevenLabs, streamSettings.voiceOutput, appMode, queryClient]);

  // Note: chaosState no longer needed - PersonalitySurgePanel manages its own state

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; type: string; content: string; metadata?: any }) => {
      const response = await apiRequest('POST', '/api/chat', {
        conversationId: data.conversationId,
        message: data.content,
        profileId: activeProfile?.id,
        mode: appMode,
        memoryLearning: streamSettings.memoryLearning,
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
          isPrivate: false,
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
      if (!activeProfile?.id) {
        throw new Error('No active profile found');
      }
      const response = await apiRequest('POST', '/api/conversations', {
        profileId: activeProfile.id,
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

  const updatePrivacyMutation = useMutation({
    mutationFn: async (isPrivate: boolean) => {
      await apiRequest('PATCH', `/api/conversations/${currentConversationId}/privacy`, { isPrivate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', currentConversationId] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations/web'] });
    }
  });

  const saveToMemoryMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      await apiRequest('POST', '/api/memory/entries', {
        profileId: activeProfile?.id,
        content,
        source: `Message: ${messageId}`,
        type: 'FACT',
        importance: 3,
        confidence: 1.0,
        metadata: { messageId, conversationId: currentConversationId }
      });
    },
    onSuccess: () => {
      toast({
        title: "Saved to Memory",
        description: "This interaction has been added to Nicky's long-term memory.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
    }
  });

  // Fetch current conversation details
  const { data: currentConversation } = useQuery<ConversationResponse>({
    queryKey: ['/api/conversations', currentConversationId],
    enabled: !!currentConversationId,
    refetchInterval: false,
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

  // Initialize conversation on mount - REMOVED to prevent blank sessions
  /*
  useEffect(() => {
    if (!currentConversationId && activeProfile?.id) {
      createConversationMutation.mutate();
    }
  }, [activeProfile?.id]);
  */

  // Handle speech recognition transcript - always update pending transcript (manual mode)
  useEffect(() => {
    // Always show live interim transcript, even when not listening (captures final results)
    const newPending = interimTranscript || transcript || '';
    setPendingTranscript(newPending);
  }, [transcript, interimTranscript, appMode]);

  // Handle voice control (manual mode)
  const toggleListening = () => {
    // Removed mode restriction to allow voice in PODCAST mode too

    if (isListening) {
      // STOP: Process the pending transcript and send message
      stopListening();

      // Capture final text from available sources to avoid race conditions
      const finalText = (transcript || interimTranscript || pendingTranscript).trim();

      // Allow sending even if no conversation ID yet (will be created)
      if (finalText) {
        const handleVoiceSend = async () => {
          let activeId = currentConversationId;
          if (!activeId) {
            try {
              const newConv = await createConversationMutation.mutateAsync();
              activeId = newConv.id;
            } catch (e) {
              console.error("Failed to create conversation for voice", e);
              return;
            }
          }

          const userMessage: Message = {
            id: nanoid(),
            conversationId: activeId,
            type: 'USER',
            content: finalText,
            rating: null,
            isPrivate: false,
            metadata: { voice: true },
            createdAt: new Date().toISOString(),
          };

          setMessages(prev => [...prev, userMessage]);

          // Send to backend
          sendMessageMutation.mutate({
            conversationId: activeId,
            type: 'USER',
            content: finalText,
            metadata: { voice: true },
          });
        };
        handleVoiceSend();
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
    // Don't create immediately, just clear state
    setCurrentConversationId("");
    setMessages([]);
  };

  const documentCount = Array.isArray(documents) ? documents.length : 0;

  const handleToggleLearning = () => {
    const currentLearning = currentConversation ? !currentConversation.isPrivate : streamSettings.memoryLearning;
    const newIsPrivate = currentLearning; // If learning was true, new isPrivate is true

    if (currentConversationId) {
      updatePrivacyMutation.mutate(newIsPrivate);
    }

    setStreamSettings(prev => ({
      ...prev,
      memoryLearning: !newIsPrivate
    }));

    toast({
      title: newIsPrivate ? "🔒 Private Mode" : "🧠 Learning Mode",
      description: newIsPrivate
        ? "Nicky will not remember this conversation."
        : "Nicky will learn from this conversation.",
    });
  };

  const handleSaveToMemory = (messageId: string, content: string) => {
    saveToMemoryMutation.mutate({ messageId, content });
  };

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
                        conversationId={currentConversationId}
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
                        onStopAudio={() => {
                          if (appMode === 'PODCAST') {
                            stopSpeakingElevenLabs();
                          } else {
                            stopSpeaking();
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
                        memoryLearning={currentConversation ? !currentConversation.isPrivate : streamSettings.memoryLearning}
                        onToggleLearning={handleToggleLearning}
                        onSaveToMemory={handleSaveToMemory}
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
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.target as HTMLFormElement);
                          const message = (formData.get('message') as string) || '';
                          const trimmed = message.trim();
                          if (!trimmed) {
                            return;
                          }

                          let activeId = currentConversationId;
                          if (!activeId) {
                            try {
                              const newConv = await createConversationMutation.mutateAsync();
                              activeId = newConv.id;
                            } catch (err) {
                              console.error("Failed to create conversation", err);
                              return;
                            }
                          }

                          const userMessage: Message = {
                            id: nanoid(),
                            conversationId: activeId,
                            type: 'USER',
                            content: trimmed,
                            createdAt: new Date().toISOString(),
                            rating: null,
                            isPrivate: false,
                            metadata: null,
                          };

                          setMessages(prev => [...prev, userMessage]);
                          setAiStatus('PROCESSING');
                          sendMessageMutation.mutate({
                            conversationId: activeId,
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
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={toggleListening}
                            className={`flex-1 transition-colors ${isListening
                              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90'
                              }`}
                            data-testid="button-toggle-listening"
                          >
                            <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'} mr-2`} />
                            {isListening ? 'Stop' : 'Speak'}
                          </Button>
                          <Button type="submit" className="flex-[2] bg-accent text-accent-foreground hover:bg-accent/90" data-testid="button-send-message">
                            <i className="fas fa-paper-plane mr-2" />
                            Send
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setMessages([])}
                            data-testid="button-clear-chat"
                            className="px-3"
                          >
                            <i className="fas fa-trash" />
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
                            className="px-3 flex items-center gap-2"
                            title="Save this conversation to Nicky's long-term memory"
                          >
                            <i className="fas fa-brain text-accent" />
                            <span className="hidden sm:inline">Save to Memory</span>
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
                                      isPrivate: false,
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
                                  isPrivate: false,
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
