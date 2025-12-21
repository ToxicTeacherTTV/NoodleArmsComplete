import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import ChatPanel from "@/components/chat-panel";
import ChatHistorySidebar from "@/components/chat-history-sidebar";
import StatusIndicator from "@/components/status-indicator";
import PersonalitySurgePanel from "@/components/personality-surge-panel";
import MessageComposer from "@/components/MessageComposer";
import ProfileModal from "@/components/profile-modal";
import NotesModal from "@/components/notes-modal";
import { MemoryChecker } from "@/components/memory-checker";
import { QuickModelToggle } from "@/components/quick-model-toggle";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useElevenLabsSpeech } from "@/hooks/use-elevenlabs-speech";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Message, Profile, AIStatus, AppMode, MemoryStats } from "@/types";
import { apiRequest } from "@/lib/queryClient";
import { getModelPreference } from "@shared/modelSelection";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";

export default function JazzDashboard() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // State
    const [currentConversationId, setCurrentConversationId] = useState<string>("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [aiStatus, setAiStatus] = useState<AIStatus>('IDLE');
    const [appMode, setAppMode] = useState<AppMode>('PODCAST');
    const [sessionStartTime] = useState<Date>(new Date());
    const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [memoryCheckerOpen, setMemoryCheckerOpen] = useState(false);
    const [selectedText, setSelectedText] = useState("");
    const [checkerPosition, setCheckerPosition] = useState({ x: 0, y: 0 });
    const [isDebugMode, setIsDebugMode] = useState(false);

    // Voice hooks
    const { isListening, startListening, stopListening, transcript, interimTranscript, resetTranscript } = useSpeechRecognition();
    const { speak: speakElevenLabs, isSpeaking: isSpeakingElevenLabs, isPaused: isPausedElevenLabs, stop: stopElevenLabs, pause: pauseElevenLabs, resume: resumeElevenLabs, replay: replayElevenLabs, canReplay: canReplayElevenLabs, saveAudio: saveAudioElevenLabs, canSave: canSaveElevenLabs } = useElevenLabsSpeech();

    // Queries
    const { data: activeProfile } = useQuery<Profile>({
        queryKey: ['/api/profiles/active'],
        refetchInterval: false,
    });

    const { data: memoryStats } = useQuery<MemoryStats>({
        queryKey: ['/api/memory/stats'],
        refetchInterval: 120000,
    });

    const { data: documents } = useQuery({
        queryKey: ['/api/documents'],
        refetchInterval: false,
    });

    // Mutations
    const sendMessageMutation = useMutation({
        mutationFn: async (data: { conversationId: string; content: string }) => {
            // Get selected model from preferences
            const selectedModel = getModelPreference('chat');
            
            const response = await apiRequest('POST', '/api/chat', {
                conversationId: data.conversationId,
                message: data.content,
                profileId: activeProfile?.id,
                mode: appMode,
                selectedModel,
            });
            return response.json();
        },
        onSuccess: async (response, variables) => {
            if (variables.conversationId === currentConversationId) {
                if (response?.content) {
                    const aiMessage: Message = {
                        id: nanoid(),
                        conversationId: variables.conversationId,
                        type: 'AI',
                        content: response.content,
                        createdAt: new Date().toISOString(),
                        rating: null,
                        metadata: { 
                            processingTime: response.processingTime,
                            retrieved_context: response.retrievedContext,
                            debug_info: response.debugInfo
                        },
                    };
                    setMessages(prev => [...prev, aiMessage]);

                    if (appMode === 'STREAMING') {
                        speakElevenLabs(response.content);
                        setAiStatus('SPEAKING');
                    }
                }
                
                // Only set to IDLE if we didn't switch to SPEAKING
                setAiStatus(prev => prev === 'SPEAKING' ? 'SPEAKING' : 'IDLE');
            }

            queryClient.invalidateQueries({ queryKey: ['/api/conversations/web'] });
            // Ensure we fetch the persisted messages to sync state
            await queryClient.invalidateQueries({ queryKey: ['/api/conversations', variables.conversationId, 'messages'] });
            // Refresh personality state to clear any temporary overrides
            queryClient.invalidateQueries({ queryKey: ['/api/personality/state'] });
        },
        onError: () => setAiStatus('ERROR'),
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
                description: "Conversation stored in Nicky's memory.",
            });
            queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
        },
    });

    // Fetch messages
    const { data: conversationMessages } = useQuery<Message[]>({
        queryKey: ['/api/conversations', currentConversationId, 'messages'],
        enabled: !!currentConversationId,
        refetchInterval: false,
    });

    useEffect(() => {
        if (conversationMessages) {
            // Don't overwrite optimistic state while processing
            if (aiStatus === 'PROCESSING') {
                return;
            }
            setMessages(conversationMessages);
        }
    }, [conversationMessages, aiStatus]);

    // Initialize conversation - REMOVED auto-creation to prevent blank sessions
    /* 
    useEffect(() => {
        if (!currentConversationId && activeProfile?.id) {
            createConversationMutation.mutate();
        }
    }, [activeProfile?.id]);
    */

    // Voice control
    const toggleListening = () => {
        // Removed mode restriction to allow voice in PODCAST mode too

        if (isListening) {
            stopListening();
            const finalText = (transcript || interimTranscript).trim();
            // Allow sending even if no conversation ID yet (will be created)
            if (finalText) {
                handleSendMessage(finalText);
            } else {
                setAiStatus('IDLE');
            }
            resetTranscript();
        } else {
            resetTranscript();
            startListening();
            setAiStatus('LISTENING');
        }
    };

    // Handlers
    const handleSendMessage = async (content: string) => {
        if (!content.trim()) return;

        let activeId = currentConversationId;

        // Create conversation if it doesn't exist
        if (!activeId) {
            try {
                const newConv = await createConversationMutation.mutateAsync();
                activeId = newConv.id;
                // Note: setCurrentConversationId is also called in onSuccess, 
                // but we need the ID immediately for the message
            } catch (error) {
                console.error("Failed to create conversation:", error);
                toast({
                    title: "Error",
                    description: "Failed to start new conversation.",
                    variant: "destructive",
                });
                return;
            }
        }

        const userMessage: Message = {
            id: nanoid(),
            conversationId: activeId,
            type: 'USER',
            content: content.trim(),
            createdAt: new Date().toISOString(),
            rating: null,
            metadata: null,
        };

        setMessages(prev => [...prev, userMessage]);
        setAiStatus('PROCESSING');
        sendMessageMutation.mutate({
            conversationId: activeId,
            content: content.trim(),
        });
    };

    const handleSelectConversation = (conversationId: string) => {
        setCurrentConversationId(conversationId);
        setMessages([]);
        setAiStatus('IDLE');
    };

    const handleNewChat = () => {
        // Don't create immediately, just clear state
        setCurrentConversationId("");
        setMessages([]);
        setAiStatus('IDLE');
    };

    const getSessionDuration = () => {
        const now = new Date();
        const diff = now.getTime() - sessionStartTime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const documentCount = Array.isArray(documents) ? documents.length : 0;

    return (
        <>
            {/* History Sheet (Mobile) */}
            <Sheet open={isHistorySheetOpen} onOpenChange={setIsHistorySheetOpen}>
                <SheetContent side="left" className="p-0 sm:max-w-md">
                    <SheetHeader className="px-4 py-3 border-b">
                        <SheetTitle>Conversation History</SheetTitle>
                    </SheetHeader>
                    <ChatHistorySidebar
                        currentConversationId={currentConversationId}
                        onSelectConversation={(id) => {
                            setIsHistorySheetOpen(false);
                            handleSelectConversation(id);
                        }}
                        onNewChat={() => {
                            setIsHistorySheetOpen(false);
                            handleNewChat();
                        }}
                        variant="sidebar"
                        className="h-[calc(100vh-4rem)]"
                    />
                </SheetContent>
            </Sheet>

            {/* Profile & Notes Modals */}
            <ProfileModal open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen} />
            <NotesModal open={isNotesModalOpen} onOpenChange={setIsNotesModalOpen} />

            {/* Main Dashboard */}
            <div className="h-full flex flex-col gap-4">
                {/* Toolbar */}
                <div className="flex items-center justify-between pb-2 border-b">
                    <h2 className="text-lg font-semibold">Chat Session</h2>
                    <div className="flex items-center gap-3">
                        {/* Quick Model Toggle */}
                        <QuickModelToggle compact={true} />
                        
                        <StatusIndicator status={aiStatus} />

                        <ToggleGroup
                            type="single"
                            value={appMode}
                            onValueChange={(value) => value && setAppMode(value as AppMode)}
                            size="sm"
                            className="hidden sm:flex"
                        >
                            <ToggleGroupItem value="PODCAST" className={cn(appMode === "PODCAST" && "animate-spring")}>
                                <i className="fas fa-podcast mr-2" />
                                Podcast
                            </ToggleGroupItem>
                            <ToggleGroupItem value="STREAMING" className={cn(appMode === "STREAMING" && "animate-spring")}>
                                <i className="fas fa-broadcast-tower mr-2" />
                                Streaming
                            </ToggleGroupItem>
                        </ToggleGroup>

                        <Button
                            variant="ghost" size="sm"
                            className="sm:hidden"
                            onClick={() => setIsHistorySheetOpen(true)}
                        >
                            <i className="fas fa-clock-rotate-left" />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_320px] h-[calc(100vh-12rem)]">
                        {/* Sidebar: Conversation History (Desktop) */}
                        <Card className="hidden lg:flex flex-col min-h-0 overflow-hidden card-hover">
                            <CardHeader className="border-b px-4 py-3">
                                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                                    Conversations
                                    <Badge variant="secondary">{messages.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 overflow-hidden">
                                <ChatHistorySidebar
                                    currentConversationId={currentConversationId}
                                    onSelectConversation={handleSelectConversation}
                                    onNewChat={handleNewChat}
                                    variant="embedded"
                                    className="h-full"
                                />
                            </CardContent>
                        </Card>

                        {/* Main Chat Area */}
                        <div className="flex flex-col gap-4 min-h-0">
                            {/* Chat Panel */}
                            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-jazz">
                                <CardContent className="flex-1 p-0 flex flex-col min-h-0">
                                    <ChatPanel
                                        messages={messages}
                                        sessionDuration={getSessionDuration()}
                                        messageCount={messages.length}
                                        appMode={appMode}
                                        isDebugMode={isDebugMode}
                                        onToggleDebugMode={() => setIsDebugMode(!isDebugMode)}
                                        onPlayAudio={(content) => speakElevenLabs(content)}
                                        onPauseAudio={pauseElevenLabs}
                                        onResumeAudio={resumeElevenLabs}
                                        onStopAudio={stopElevenLabs}
                                        onReplayAudio={replayElevenLabs}
                                        onSaveAudio={saveAudioElevenLabs}
                                        isPlayingAudio={isSpeakingElevenLabs}
                                        isPausedAudio={isPausedElevenLabs}
                                        canReplay={canReplayElevenLabs}
                                        canSave={canSaveElevenLabs}
                                        onTextSelection={() => { }}
                                    />
                                </CardContent>
                            </Card>

                            {/* Message Composer */}
                            <MessageComposer
                                onSendMessage={handleSendMessage}
                                onClearChat={() => setMessages([])}
                                onStoreMemory={() => consolidateMemoryMutation.mutate(currentConversationId)}
                                onToggleVoice={toggleListening}
                                isListening={isListening}
                                isSpeaking={isSpeakingElevenLabs}
                                appMode={appMode}
                                sessionDuration={getSessionDuration()}
                                messageCount={messages.length}
                                memoryCount={memoryStats?.totalFacts ?? 0}
                                documentCount={documentCount}
                                disabled={aiStatus === 'PROCESSING'}
                            />
                        </div>

                        {/* Right Sidebar: Quick Info (Desktop XL+) */}
                        <Card className="hidden xl:flex flex-col min-h-0 overflow-hidden card-hover">
                            <CardHeader className="border-b px-4 py-3">
                                <CardTitle className="text-sm font-semibold">Command Center</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                                <PersonalitySurgePanel />
                            </CardContent>
                        </Card>
                    </div>
            </div>

            {/* Memory Checker */}
            <MemoryChecker
                selectedText={selectedText}
                open={memoryCheckerOpen}
                onOpenChange={setMemoryCheckerOpen}
                position={checkerPosition}
            />
        </>
    );
}
