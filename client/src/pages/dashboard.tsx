import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import ChatPanel from "@/components/chat-panel";
import ControlPanel from "@/components/control-panel";
import PersonalityPanel from "@/components/personality-panel";
import MemoryPanel from "@/components/memory-panel";
import DocumentPanel from "@/components/document-panel";
import StatusIndicator from "@/components/status-indicator";
import VoiceVisualizer from "@/components/voice-visualizer";
import ProfileModal from "@/components/profile-modal";
import ChaosMeter from "@/components/chaos-meter";
import { MemoryChecker } from "@/components/memory-checker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { useElevenLabsSpeech } from "@/hooks/use-elevenlabs-speech";
import { useVoiceActivity } from "@/hooks/use-voice-activity";
import type { Message, Profile, AIStatus, StreamSettings, VoiceActivity, AppMode, Document } from "@/types";
import { apiRequest } from "@/lib/queryClient";
import { nanoid } from "nanoid";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiStatus, setAiStatus] = useState<AIStatus>('IDLE');
  const [activeTab, setActiveTab] = useState<'memory' | 'docs'>('memory');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('PODCAST');
  const [streamSettings, setStreamSettings] = useState<StreamSettings>({
    autoRespond: true,
    voiceOutput: true,
    memoryLearning: true,
  });
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date());
  const [memoryCheckerOpen, setMemoryCheckerOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [checkerPosition, setCheckerPosition] = useState({ x: 0, y: 0 });
  const [pendingTranscript, setPendingTranscript] = useState<string>(''); // For manual voice control

  // Refs for queue management
  const messageQueueRef = useRef<Message[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Custom hooks
  const { isListening, startListening, stopListening, transcript, interimTranscript, resetTranscript, error: speechError } = useSpeechRecognition();
  const { speak: speakBrowser, isSpeaking: isSpeakingBrowser, stop: stopSpeakingBrowser, replay: replayBrowser, canReplay: canReplayBrowser } = useSpeechSynthesis();
  const { speak: speakElevenLabs, isSpeaking: isSpeakingElevenLabs, isPaused: isPausedElevenLabs, stop: stopSpeakingElevenLabs, pause: pauseElevenLabs, resume: resumeElevenLabs, replay: replayElevenLabs, canReplay: canReplayElevenLabs } = useElevenLabsSpeech();
  const voiceActivity = useVoiceActivity(isListening);

  // Choose speech synthesis based on mode
  const speak = appMode === 'STREAMING' ? speakElevenLabs : speakBrowser;
  const isSpeaking = appMode === 'STREAMING' ? isSpeakingElevenLabs : isSpeakingBrowser;
  const stopSpeaking = appMode === 'STREAMING' ? stopSpeakingElevenLabs : stopSpeakingBrowser;
  const replay = appMode === 'STREAMING' ? replayElevenLabs : replayBrowser;
  const canReplay = appMode === 'STREAMING' ? canReplayElevenLabs : canReplayBrowser;

  // Queries
  const { data: activeProfile } = useQuery<Profile>({
    queryKey: ['/api/profiles/active'],
    refetchInterval: false,
  });

  const { data: memoryStats } = useQuery<{ totalFacts: number; conversations: number }>({
    queryKey: ['/api/memory/stats'],
    refetchInterval: 120000, // Refresh every 2 minutes (reduced from 30s to reduce flickering)
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    refetchInterval: false,
  });

  const { data: chaosState } = useQuery<{ level: number; mode: "FULL_PSYCHO" | "FAKE_PROFESSIONAL" | "HYPER_FOCUSED" | "CONSPIRACY"; lastModeChangeAt?: string }>({
    queryKey: ['/api/chaos/state'],
    refetchInterval: 15000, // Update chaos state every 15 seconds (reduced from 5s to reduce flickering)
  });

  const { data: existingMessages } = useQuery<Message[]>({
    queryKey: ['/api/conversations', currentConversationId, 'messages'],
    enabled: !!currentConversationId,
    refetchInterval: false,
  });

  // Mutations
  const createConversationMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const response = await apiRequest('POST', '/api/conversations', {
        profileId,
        sessionId: nanoid(),
      });
      return response.json();
    },
    onSuccess: (conversation) => {
      setCurrentConversationId(conversation.id);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, type, content, metadata }: {
      conversationId: string;
      type: 'USER' | 'CHATTER';
      content: string;
      metadata?: any;
    }) => {
      const response = await apiRequest('POST', `/api/conversations/${conversationId}/messages`, {
        type,
        content,
        metadata,
      });
      return response.json();
    },
  });

  const chatMutation = useMutation({
    mutationFn: async ({ message, conversationId }: { message: string; conversationId: string }) => {
      const response = await apiRequest('POST', '/api/chat', {
        message,
        conversationId,
      });
      return response.json();
    },
    onSuccess: (response) => {
      const aiMessage: Message = {
        id: nanoid(),
        conversationId: currentConversationId,
        type: 'AI',
        content: response.content,
        metadata: {
          processingTime: response.processingTime,
          retrieved_context: response.retrievedContext,
        },
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Handle response based on app mode
      if (appMode === 'STREAMING' && streamSettings.voiceOutput) {
        setAiStatus('SPEAKING');
        speak(response.content, () => {
          setAiStatus('LISTENING');
          isProcessingQueueRef.current = false;
        });
      } else {
        // Podcast mode - just show text, no auto-speech
        setAiStatus('IDLE');
        isProcessingQueueRef.current = false;
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: "Failed to get AI response",
        variant: "destructive",
      });
      setAiStatus('LISTENING');
      isProcessingQueueRef.current = false;
    },
  });

  const consolidateMemoryMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await apiRequest('POST', '/api/memory/consolidate', {
        conversationId,
      });
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Memory Consolidated",
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
    },
  });

  // Initialize conversation on profile load
  useEffect(() => {
    if (activeProfile && !currentConversationId) {
      createConversationMutation.mutate(activeProfile.id);
      setSessionStartTime(new Date());
    }
  }, [activeProfile, currentConversationId]);

  // Load existing messages when conversation changes
  useEffect(() => {
    if (existingMessages && existingMessages.length > 0) {
      setMessages(existingMessages);
    }
  }, [existingMessages]);

  // Handle speech recognition transcript - always update pending transcript in streaming mode (manual mode)
  useEffect(() => {
    if (appMode === 'STREAMING') {
      // Always show live interim transcript, even when not listening (captures final results)
      const newPending = interimTranscript || transcript || '';
      console.log('🔄 Setting pendingTranscript:', newPending, 'from interimTranscript:', interimTranscript, 'transcript:', transcript);
      setPendingTranscript(newPending);
    }
  }, [transcript, interimTranscript, appMode]);

  // Process message queue
  useEffect(() => {
    const processQueue = () => {
      if (
        isProcessingQueueRef.current || 
        messageQueueRef.current.length === 0 || 
        isSpeaking ||
        !currentConversationId
      ) {
        return;
      }

      const nextMessage = messageQueueRef.current.shift();
      if (!nextMessage) return;

      isProcessingQueueRef.current = true;
      setAiStatus('THINKING');

      chatMutation.mutate({
        message: nextMessage.content,
        conversationId: currentConversationId,
      });
    };

    const interval = setInterval(processQueue, 500);
    return () => clearInterval(interval);
  }, [currentConversationId, isSpeaking]);

  // Auto-consolidate memory every 6 messages
  useEffect(() => {
    if (messages.length > 0 && messages.length % 6 === 0 && streamSettings.memoryLearning) {
      consolidateMemoryMutation.mutate(currentConversationId);
    }
  }, [messages.length, streamSettings.memoryLearning, currentConversationId]);

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
        messageQueueRef.current.push(userMessage);
        
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

  // Play audio for a specific message (podcast mode)
  const playMessageAudio = (content: string) => {
    if (isSpeakingElevenLabs) {
      if (isPausedElevenLabs) {
        resumeElevenLabs();
      } else {
        pauseElevenLabs();
      }
    } else {
      speakElevenLabs(content);
    }
  };

  // Replay last audio message
  const replayLastAudio = () => {
    replay();
  };

  // Toggle app mode
  const toggleAppMode = () => {
    const newMode = appMode === 'PODCAST' ? 'STREAMING' : 'PODCAST';
    setAppMode(newMode);
    
    // Stop any ongoing speech
    stopSpeaking();
    
    // Stop listening if switching to podcast mode
    if (newMode === 'PODCAST' && isListening) {
      stopListening();
      setAiStatus('IDLE');
    }
  };

  // Handle text input
  const handleSendText = (text: string) => {
    if (!currentConversationId || !text.trim()) return;

    const userMessage: Message = {
      id: nanoid(),
      conversationId: currentConversationId,
      type: 'USER',
      content: text.trim(),
      metadata: { voice: false },
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    messageQueueRef.current.push(userMessage);

    // Send to backend
    sendMessageMutation.mutate({
      conversationId: currentConversationId,
      type: 'USER',
      content: text.trim(),
    });
  };

  // Handle chat message simulation
  const handleChatMessage = (message: string, speaker: string) => {
    if (!currentConversationId) return;

    const chatMessage: Message = {
      id: nanoid(),
      conversationId: currentConversationId,
      type: 'CHATTER',
      content: message,
      metadata: { speaker },
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, chatMessage]);
    
    if (streamSettings.autoRespond) {
      messageQueueRef.current.push(chatMessage);
      
      // Send to backend
      sendMessageMutation.mutate({
        conversationId: currentConversationId,
        type: 'CHATTER',
        content: message,
        metadata: { speaker },
      });
    }
  };

  const clearChat = () => {
    setMessages([]);
    messageQueueRef.current = [];
    isProcessingQueueRef.current = false;
    setAiStatus('IDLE');
  };

  const storeConversation = () => {
    if (messages.length === 0) {
      toast({
        title: "No Messages",
        description: "No conversation to store",
        variant: "destructive",
      });
      return;
    }

    consolidateMemoryMutation.mutate(currentConversationId);
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
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white font-bold text-lg font-display">
              NA
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">
                {activeProfile?.name || "Nicky A.I. Dente"}
              </h1>
              <p className="text-sm text-muted-foreground">"Noodle Arms" Co-Host</p>
            </div>
          </div>
          
          <StatusIndicator status={aiStatus} />
          
          {/* Mode Toggle */}
          <div className="mt-4 p-3 bg-secondary/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Mode</span>
              <button
                onClick={toggleAppMode}
                className="px-3 py-1 text-xs rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                data-testid="button-toggle-mode"
              >
                Switch to {appMode === 'PODCAST' ? 'Streaming' : 'Podcast'}
              </button>
            </div>
            <div className="text-xs text-muted-foreground">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${appMode === 'PODCAST' ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                <span className={appMode === 'PODCAST' ? 'text-foreground' : ''}>🎙️ Podcast Mode</span>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${appMode === 'STREAMING' ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                <span className={appMode === 'STREAMING' ? 'text-foreground' : ''}>🔴 Streaming Mode</span>
              </div>
            </div>
          </div>
        </div>

        <ControlPanel
          onToggleListening={toggleListening}
          onSendText={handleSendText}
          onClearChat={clearChat}
          onStoreConversation={storeConversation}
          isListening={isListening}
          appMode={appMode}
          pendingTranscript={pendingTranscript}
        />

        <PersonalityPanel
          profile={activeProfile}
          onOpenProfileManager={() => setIsProfileModalOpen(true)}
          onResetChat={clearChat}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <ChatPanel
          messages={messages}
          sessionDuration={getSessionDuration()}
          messageCount={messages.length}
          appMode={appMode}
          onPlayAudio={playMessageAudio}
          onReplayAudio={replayLastAudio}
          isPlayingAudio={isSpeakingElevenLabs}
          isPausedAudio={isPausedElevenLabs}
          canReplay={canReplay}
          onTextSelection={handleTextSelection}
        />
      </div>

      {/* Right Panel */}
      <div className="w-96 bg-card border-l border-border flex flex-col">
        {/* Chaos Meter */}
        <div className="p-4 border-b border-border">
          {chaosState && (
            <ChaosMeter 
              chaosLevel={chaosState.level} 
              chaosMode={chaosState.mode} 
            />
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="flex">
            <button
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'memory'
                  ? 'text-primary border-b-2 border-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('memory')}
              data-testid="tab-memory"
            >
              <i className="fas fa-brain mr-2"></i>Memory Banks
            </button>
            <button
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'docs'
                  ? 'text-primary border-b-2 border-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('docs')}
              data-testid="tab-docs"
            >
              <i className="fas fa-file-upload mr-2"></i>Documents
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'memory' && (
          <MemoryPanel
            profileId={activeProfile?.id}
            memoryStats={memoryStats}
          />
        )}

        {activeTab === 'docs' && (
          <DocumentPanel
            profileId={activeProfile?.id}
            documents={documents}
          />
        )}
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

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Memory Checker */}
      <MemoryChecker
        selectedText={selectedText}
        profileId={activeProfile?.id}
        isOpen={memoryCheckerOpen}
        onClose={() => setMemoryCheckerOpen(false)}
        position={checkerPosition}
      />

      {/* Connection Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-sm border-t border-border p-3 z-40">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-muted-foreground">Claude API</span>
            </div>
            
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-muted-foreground">ElevenLabs</span>
            </div>
            
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-muted-foreground">Speech API</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-muted-foreground">Session: {getSessionDuration()}</span>
            <span className="text-muted-foreground">Messages: {messages.length}</span>
            <span className="text-muted-foreground">Memory: {memoryStats?.totalFacts || 0} facts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
