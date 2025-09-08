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
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { useElevenLabsSpeech } from "@/hooks/use-elevenlabs-speech";
import { useVoiceActivity } from "@/hooks/use-voice-activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Message, Profile, AIStatus, StreamSettings, VoiceActivity, AppMode } from "@/types";
import { apiRequest } from "@/lib/queryClient";
import { nanoid } from "nanoid";

export default function JazzDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiStatus, setAiStatus] = useState<AIStatus>('IDLE');
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

  // Refs for queue management
  const messageQueueRef = useRef<Message[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Custom hooks
  const { isListening, startListening, stopListening, transcript, error: speechError } = useSpeechRecognition();
  const { speak: speakBrowser, isSpeaking: isSpeakingBrowser, stop: stopSpeakingBrowser } = useSpeechSynthesis();
  const { speak: speakElevenLabs, isSpeaking: isSpeakingElevenLabs, isPaused: isPausedElevenLabs, stop: stopSpeakingElevenLabs, pause: pauseElevenLabs, resume: resumeElevenLabs } = useElevenLabsSpeech();
  const voiceActivity = useVoiceActivity(isListening);

  // Choose speech synthesis based on mode
  const speak = appMode === 'STREAMING' ? speakElevenLabs : speakBrowser;
  const isSpeaking = appMode === 'STREAMING' ? isSpeakingElevenLabs : isSpeakingBrowser;
  const stopSpeaking = appMode === 'STREAMING' ? stopSpeakingElevenLabs : stopSpeakingBrowser;

  // Queries
  const { data: activeProfile } = useQuery({
    queryKey: ['/api/profiles/active'],
    refetchInterval: false,
  });

  const { data: memoryStats } = useQuery({
    queryKey: ['/api/memory/stats'],
    refetchInterval: 30000,
  });

  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
    refetchInterval: false,
  });

  const { data: chaosState } = useQuery({
    queryKey: ['/api/chaos/state'],
    refetchInterval: 5000,
  });

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; type: string; content: string; metadata?: any }) => {
      return apiRequest('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: data.conversationId,
          message: data.content,
          profileId: activeProfile?.id,
          mode: appMode,
        }),
      });
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
        
        if (streamSettings.voiceOutput) {
          speak(response.content);
        }
      }
      setAiStatus('IDLE');
    },
    onError: () => {
      setAiStatus('ERROR');
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: () => apiRequest('/api/conversations', { method: 'POST' }),
    onSuccess: (data) => {
      setCurrentConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  const consolidateMemoryMutation = useMutation({
    mutationFn: (conversationId: string) => {
      return apiRequest(`/api/memory/consolidate/${conversationId}`, {
        method: 'POST',
      });
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
    if (!currentConversationId) {
      createConversationMutation.mutate();
    }
  }, []);

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
            <Badge 
              variant={appMode === 'PODCAST' ? 'default' : 'secondary'}
              className="bg-white/20 text-white border-white/30"
            >
              {appMode === 'PODCAST' ? '🎙️ Podcast' : '🔴 Streaming'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-12 gap-6 h-[calc(100vh-120px)]">
        
        {/* Left Panel - Compact Controls */}
        <div className="col-span-3 space-y-4">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                Live Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ControlPanel
                onToggleListening={() => isListening ? stopListening() : startListening()}
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
                isListening={isListening}
                appMode={appMode}
              />
            </CardContent>
          </Card>

          <Card className="border-secondary/20">
            <CardContent className="p-4">
              <PersonalityPanel
                profile={activeProfile}
                onOpenProfileManager={() => setIsProfileModalOpen(true)}
                onResetChat={() => setMessages([])}
              />
            </CardContent>
          </Card>

          {chaosState && (
            <Card className="border-accent/20">
              <CardContent className="p-4">
                <ChaosMeter 
                  chaosLevel={chaosState.level} 
                  chaosMode={chaosState.mode} 
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Center Panel - Chat */}
        <div className="col-span-6">
          <Card className="h-full border-primary/20 shadow-xl">
            <ChatPanel
              messages={messages}
              sessionDuration={getSessionDuration()}
              messageCount={messages.length}
              appMode={appMode}
              onTextSelection={handleTextSelection}
            />
          </Card>
        </div>

        {/* Right Panel - Memory & Docs */}
        <div className="col-span-3">
          <Card className="h-full border-accent/20 shadow-lg">
            <Tabs defaultValue="memory" className="h-full flex flex-col">
              <TabsList className="grid grid-cols-2 bg-gradient-to-r from-primary/10 to-secondary/10">
                <TabsTrigger value="memory" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                  🧠 Memory
                </TabsTrigger>
                <TabsTrigger value="docs" className="data-[state=active]:bg-secondary data-[state=active]:text-white">
                  📁 Docs
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="memory" className="flex-1 overflow-hidden">
                <MemoryPanel
                  profileId={activeProfile?.id}
                  memoryStats={memoryStats}
                />
              </TabsContent>
              
              <TabsContent value="docs" className="flex-1 overflow-hidden">
                <DocumentPanel
                  profileId={activeProfile?.id}
                  documents={documents}
                />
              </TabsContent>
            </Tabs>
          </Card>
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

      {/* Jazz Cup Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-primary/90 via-accent/90 to-secondary/90 backdrop-blur-sm border-t border-white/20 p-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-white">
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
          </div>
        </div>
      </div>
    </div>
  );
}