import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import ChatPanel from "@/components/chat-panel";
import ControlPanel from "@/components/control-panel";
import DiscordManagementPanel from "@/components/discord-management-panel";
// PersonalityPanel moved to brain-management.tsx
// MemoryPanel and DocumentPanel moved to brain-management.tsx
import StatusIndicator from "@/components/status-indicator";
import VoiceVisualizer from "@/components/voice-visualizer";
import ProfileModal from "@/components/profile-modal";
import ChaosMeter from "@/components/chaos-meter";
import { MemoryChecker } from "@/components/memory-checker";
import NotesModal from "@/components/notes-modal";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { useElevenLabsSpeech } from "@/hooks/use-elevenlabs-speech";
import { useVoiceActivity } from "@/hooks/use-voice-activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Message, Profile, AIStatus, StreamSettings, VoiceActivity, AppMode } from "@/types";
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
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date());
  const [memoryCheckerOpen, setMemoryCheckerOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [checkerPosition, setCheckerPosition] = useState({ x: 0, y: 0 });
  const [pendingTranscript, setPendingTranscript] = useState<string>(''); // For manual voice control
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(true); // Start collapsed on mobile

  // Refs for queue management
  const messageQueueRef = useRef<Message[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Custom hooks
  const { isListening, startListening, stopListening, transcript, interimTranscript, resetTranscript, error: speechError } = useSpeechRecognition();
  const { speak: speakBrowser, isSpeaking: isSpeakingBrowser, stop: stopSpeakingBrowser } = useSpeechSynthesis();
  const { speak: speakElevenLabs, isSpeaking: isSpeakingElevenLabs, isPaused: isPausedElevenLabs, stop: stopSpeakingElevenLabs, pause: pauseElevenLabs, resume: resumeElevenLabs, replay: replayElevenLabs, canReplay: canReplayElevenLabs } = useElevenLabsSpeech();
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

  // Queries
  const { data: activeProfile } = useQuery({
    queryKey: ['/api/profiles/active'],
    refetchInterval: false,
  });

  const { data: memoryStats } = useQuery({
    queryKey: ['/api/memory/stats'],
    refetchInterval: 120000, // Reduced from 30s to 2min to reduce flickering
  });

  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
    refetchInterval: false,
  });

  const { data: chaosState } = useQuery({
    queryKey: ['/api/chaos/state'],
    refetchInterval: 15000, // Reduced from 5s to 15s to reduce flickering
  });

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
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // NOTE: Removed auto-play to prevent burning ElevenLabs credits
        // Users can now click Play button on individual messages for voice synthesis
      }
      
      // 🎲 ENHANCED: Invalidate chaos state after AI response for dynamic UI updates
      queryClient.invalidateQueries({ queryKey: ['/api/chaos/state'] });
      
      setAiStatus('IDLE');
    },
    onError: () => {
      setAiStatus('ERROR');
    },
  });

  const createConversationMutation = useMutation({
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
    console.log('🔄 Setting pendingTranscript:', newPending, 'from interimTranscript:', interimTranscript, 'transcript:', transcript, 'appMode:', appMode);
    setPendingTranscript(newPending);
  }, [transcript, interimTranscript, appMode]);

  // Handle voice control (only in streaming mode) - MANUAL MODE
  const toggleListening = () => {
    console.log('🔘 toggleListening clicked - appMode:', appMode, 'isListening:', isListening);
    
    if (appMode !== 'STREAMING') {
      console.log('❌ Not in STREAMING mode, returning early');
      return;
    }
    
    if (isListening) {
      // STOP: Process the pending transcript and send message
      stopListening();
      
      // Capture final text from available sources to avoid race conditions
      const finalText = (transcript || interimTranscript || pendingTranscript).trim();
      console.log('🛑 Stopping with finalText:', finalText);
      
      if (finalText && currentConversationId) {
        const userMessage: Message = {
          id: nanoid(),
          conversationId: currentConversationId,
          type: 'USER',
          content: finalText,
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
      console.log('🎤 Starting to listen...');
      setPendingTranscript('');
      resetTranscript();
      startListening();
      setAiStatus('LISTENING');
      console.log('✅ Called startListening() and set status to LISTENING');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Jazz Cup Header */}
      <div className="bg-gradient-to-r from-primary via-accent to-secondary p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white">🎷</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-sm">
                {activeProfile?.name || "Nicky A.I. Dente"}
              </h1>
              <p className="text-white/80 text-sm">"Noodle Arms" Jazz Cup Co-Host</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <StatusIndicator status={aiStatus} />
            <button
              onClick={() => setLocation('/workspace')}
              className="px-2 md:px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg border border-white/30 transition-colors text-sm"
              data-testid="button-project-workspace"
            >
              <span className="hidden sm:inline">🚧 Project Workspace</span>
              <span className="sm:hidden">🚧</span>
            </button>
            <button
              onClick={() => setLocation('/brain')}
              className="px-2 md:px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg border border-white/30 transition-colors text-sm"
              data-testid="button-brain-management"
            >
              <span className="hidden sm:inline">🧠 Brain Management</span>
              <span className="sm:hidden">🧠</span>
            </button>
            <button
              onClick={() => setAppMode(appMode === 'PODCAST' ? 'STREAMING' : 'PODCAST')}
              className="px-2 md:px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg border border-white/30 transition-colors text-sm"
              data-testid="button-toggle-mode"
            >
              <span className="hidden sm:inline">{appMode === 'PODCAST' ? '🎙️ Podcast Mode' : '🔴 Streaming Mode'}</span>
              <span className="sm:hidden">{appMode === 'PODCAST' ? '🎙️' : '🔴'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Full width chat */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 h-[calc(100vh-120px)]">
        
        {/* Chat Panel - Full width with bottom padding for fixed input */}
        <Card className="h-full border-primary/20 shadow-xl">
          <div className="h-full flex flex-col">
            <ChatPanel
              messages={messages}
              sessionDuration={getSessionDuration()}
              messageCount={messages.length}
              appMode={appMode}
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
              isPlayingAudio={appMode === 'PODCAST' ? isSpeakingElevenLabs && !isPausedElevenLabs : isSpeaking && !isPaused}
              isPausedAudio={appMode === 'PODCAST' ? isPausedElevenLabs : isPaused}
              canReplay={appMode === 'PODCAST' ? canReplayElevenLabs : canReplay}
              onTextSelection={handleTextSelection}
            />
            
            {/* Fixed space for input and status bars at bottom */}
            <div className="h-48"></div>
          </div>
        </Card>

      </div>

      {/* Fixed Bottom Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-7xl mx-auto p-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const message = formData.get('message') as string;
            if (message.trim()) {
              const userMessage: Message = {
                id: nanoid(),
                conversationId: currentConversationId,
                type: 'USER',
                content: message,
                createdAt: new Date(),
              };
              setMessages(prev => [...prev, userMessage]);
              setAiStatus('PROCESSING');
              sendMessageMutation.mutate({
                conversationId: currentConversationId,
                type: 'USER',
                content: message,
              });
              (e.target as HTMLFormElement).reset();
            }
          }} className="flex gap-2">
            <Textarea
              name="message"
              className="flex-1 bg-input border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder={isListening ? "🎤 Listening... speak now!" : "Type a message to Nicky..."}
              rows={2}
              data-testid="textarea-message-input"
              readOnly={isListening}
            />
            <Button 
              type="submit" 
              className="bg-accent hover:bg-accent/90 text-accent-foreground px-4 rounded-lg flex items-center justify-center transition-all duration-200"
              data-testid="button-send-message"
            >
              <i className="fas fa-paper-plane"></i>
            </Button>
          </form>
        </div>
      </div>

      {/* Floating Live Controls */}
      <div className="fixed bottom-24 right-4 sm:right-6 z-50 rounded-xl shadow-lg bg-card/90 backdrop-blur p-3 space-x-2 flex">
        <Button
          onClick={toggleListening}
          className={`p-3 rounded-lg transition-all duration-200 ${
            isListening 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
          }`}
          data-testid="button-toggle-voice"
        >
          <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'}`}></i>
        </Button>
        
        {chaosState && (
          <div className="bg-accent/20 rounded-lg p-2 min-w-[120px] space-y-1">
            <div className="text-xs text-center text-foreground">
              Chaos: {Math.round(chaosState.effectiveLevel || chaosState.level)}%
            </div>
            <div className="flex gap-1 justify-center">
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await apiRequest('POST', '/api/chaos/set-level', { level: 0 });
                  // Refresh chaos state
                  window.location.reload();
                }}
                className="h-6 px-2 text-xs hover:bg-green-500/20"
                data-testid="button-chaos-0"
              >
                0%
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await apiRequest('POST', '/api/chaos/set-level', { level: 50 });
                  // Refresh chaos state  
                  window.location.reload();
                }}
                className="h-6 px-2 text-xs hover:bg-yellow-500/20"
                data-testid="button-chaos-50"
              >
                50%
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await apiRequest('POST', '/api/chaos/set-level', { level: 80 });
                  // Refresh chaos state
                  window.location.reload();
                }}
                className="h-6 px-2 text-xs hover:bg-red-500/20"
                data-testid="button-chaos-80"
              >
                80%
              </Button>
            </div>
          </div>
        )}
        
        <Button
          onClick={() => setMessages([])}
          variant="outline"
          className="p-3 rounded-lg"
          data-testid="button-clear-chat"
          title="Clear Chat"
        >
          <i className="fas fa-trash"></i>
        </Button>
        
        <Button
          onClick={() => {
            if (messages.length > 0) {
              consolidateMemoryMutation.mutate(currentConversationId);
            }
          }}
          variant="outline"
          className="p-3 rounded-lg"
          data-testid="button-store-conversation"
          title="Store Conversation to Memory"
        >
          <i className="fas fa-save"></i>
        </Button>
      </div>

      {/* Legacy controls section - now hidden */}
      <div className="hidden">
        {/* Mobile: Collapsible Controls, Desktop: Side Panel */}
        <div className="md:col-span-3 space-y-4 order-3">
          <Collapsible 
            open={isControlsCollapsed ? false : true} 
            onOpenChange={(open) => setIsControlsCollapsed(!open)}
            className="md:hidden"
          >
            <Card className="border-primary/20 shadow-lg">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
                  <CardTitle className="text-lg flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                      Live Controls
                    </div>
                    <Button variant="ghost" size="sm">
                      {isControlsCollapsed ? '▼' : '▲'}
                    </Button>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <ControlPanel
                    onToggleListening={toggleListening}
                    onSendText={(message: string) => {
                      if (message.trim()) {
                        const userMessage: Message = {
                          id: nanoid(),
                          conversationId: currentConversationId,
                          type: 'USER',
                          content: message,
                          createdAt: new Date(),
                        };
                        setMessages(prev => [...prev, userMessage]);
                        setAiStatus('PROCESSING');
                        sendMessageMutation.mutate({
                          conversationId: currentConversationId,
                          type: 'USER',
                          content: message,
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
              </CollapsibleContent>
            </Card>
          </Collapsible>
          
          {/* Desktop: Always visible controls */}
          <Card className="border-primary/20 shadow-lg hidden md:block">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                Live Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ControlPanel
                onToggleListening={toggleListening}
                onSendText={(message: string) => {
                  if (message.trim()) {
                    const userMessage: Message = {
                      id: nanoid(),
                      conversationId: currentConversationId,
                      type: 'USER',
                      content: message,
                      createdAt: new Date(),
                    };
                    setMessages(prev => [...prev, userMessage]);
                    setAiStatus('PROCESSING');
                    sendMessageMutation.mutate({
                      conversationId: currentConversationId,
                      type: 'USER',
                      content: message,
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

          {/* Chaos meter only - personality moved to brain management */}
          {chaosState && (
            <Card className="border-accent/20 hidden md:block">
              <CardContent className="p-4">
                <ChaosMeter 
                  chaosLevel={chaosState.level} 
                  chaosMode={chaosState.mode}
                  manualOverride={chaosState.manualOverride}
                  effectiveLevel={chaosState.effectiveLevel}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Floating Voice Visualizer */}
      {isListening && (
        <VoiceVisualizer
          voiceActivity={voiceActivity}
          isActive={isListening}
          streamSettings={streamSettings}
          onUpdateSettings={setStreamSettings}
        />
      )}

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

      {/* Jazz Cup Status Bar */}
      <div className="fixed bottom-32 left-0 right-0 bg-gradient-to-r from-primary/90 via-accent/90 to-secondary/90 backdrop-blur-sm border-t border-white/20 p-2 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-black">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
              Claude API
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
              ElevenLabs
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span>💬 {messages.length} messages</span>
            <span>🧠 {memoryStats?.totalFacts || 0} facts</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNotesModalOpen(true)}
              className="text-black hover:bg-black/10 h-6 px-2 text-xs"
              data-testid="button-open-notes"
            >
              📝 Notes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}