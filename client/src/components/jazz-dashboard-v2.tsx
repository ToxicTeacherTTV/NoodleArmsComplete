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
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useElevenLabsSpeech } from "@/hooks/use-elevenlabs-speech";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Message, Profile, AIStatus, AppMode, MemoryStats } from "@/types";
import { apiRequest } from "@/lib/queryClient";
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
    const { speak: speakElevenLabs, isSpeaking: isSpeakingElevenLabs, isPaused: isPausedElevenLabs, pause: pauseElevenLabs, resume: resumeElevenLabs, replay: replayElevenLabs, canReplay: canReplayElevenLabs, saveAudio: saveAudioElevenLabs, canSave: canSaveElevenLabs } = useElevenLabsSpeech();

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
                    metadata: { processingTime: response.processingTime },
                };
                setMessages(prev => [...prev, aiMessage]);

                if (appMode === 'STREAMING') {
                    speakElevenLabs(response.content);
                    setAiStatus('SPEAKING');
                }
            }
            queryClient.invalidateQueries({ queryKey: ['/api/conversations/web'] });
            setAiStatus('IDLE');
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
            setMessages(conversationMessages);
        }
    }, [conversationMessages]);

    // Initialize conversation
    useEffect(() => {
        if (!currentConversationId && activeProfile?.id) {
            createConversationMutation.mutate();
        }
    }, [activeProfile?.id]);

    // Voice control
    const toggleListening = () => {
        if (appMode !== 'STREAMING') return;

        if (isListening) {
            stopListening();
            const finalText = (transcript || interimTranscript).trim();
            if (finalText && currentConversationId) {
                handleSendMessage(finalText);
            }
            resetTranscript();
            setAiStatus('IDLE');
        } else {
            resetTranscript();
            startListening();
            setAiStatus('LISTENING');
        }
    };

    // Handlers
    const handleSendMessage = (content: string) => {
        if (!content.trim() || !currentConversationId) return;

        const userMessage: Message = {
            id: nanoid(),
            conversationId: currentConversationId,
            type: 'USER',
            content: content.trim(),
            createdAt: new Date().toISOString(),
            rating: null,
            metadata: null,
        };

        setMessages(prev => [...prev, userMessage]);
        setAiStatus('PROCESSING');
        sendMessageMutation.mutate({
            conversationId: currentConversationId,
            content: content.trim(),
        });
    };

    const handleSelectConversation = (conversationId: string) => {
        setCurrentConversationId(conversationId);
        setMessages([]);
    };

    const handleNewChat = () => {
        createConversationMutation.mutate();
        setMessages([]);
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
            <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
                {/*  Compact Header */}
                <header className="sticky top-0 z-50 border-b backdrop-blur-modern">
                    <div className="container flex h-16 items-center justify-between px-4">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl jazz-gradient shadow-jazz">
                                <span className="text-2xl">🎷</span>
                            </div>
                            <div className="hidden sm:block">
                                <h1 className="text-lg font-bold text-gradient tracking-tight">
                                    {activeProfile?.name || "Nicky A.I. Dente"}
                                </h1>
                                <p className="text-xs text-muted-foreground">"Noodle Arms" Co-Host</p>
                            </div>
                        </div>

                        {/* Status + Mode + Actions */}
                        <div className="flex items-center gap-3">
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
                </header>

                {/* Main Content */}
                <main className="container py-6">
                    <div className="grid gap-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_320px] h-[calc(100vh-7rem)]">
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
                                <CardContent className="flex-1 p-0">
                                    <ChatPanel
                                        messages={messages}
                                        sessionDuration={getSessionDuration()}
                                        messageCount={messages.length}
                                        appMode={appMode}
                                        isDebugMode={isDebugMode}
                                        onToggleDebugMode={() => setIsDebugMode(!isDebugMode)}
                                        onPlayAudio={(content) => speakElevenLabs(content)}
                                        onReplayAudio={replayElevenLabs}
                                        onSaveAudio={saveAudioElevenLabs}
                                        isPlayingAudio={isSpeakingElevenLabs && !isPausedElevenLabs}
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
                </main>
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
