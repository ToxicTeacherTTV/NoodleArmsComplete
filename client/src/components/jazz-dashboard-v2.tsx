import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

// Components
import ChatPanel from "@/components/chat-panel";
import ChatHistorySidebar from "@/components/chat-history-sidebar";
import PersonalitySurgePanel from "@/components/personality-surge-panel";
import MessageComposer from "@/components/MessageComposer";
import ProfileModal from "@/components/profile-modal";
import NotesModal from "@/components/notes-modal";
import { MemoryChecker } from "@/components/memory-checker";
import { JazzHeader } from "@/components/jazz/JazzHeader";
import { JazzChatLayout } from "@/components/jazz/JazzChatLayout";

// Hooks
import { useJazzChat } from "@/hooks/use-jazz-chat";
import { useJazzVoice } from "@/hooks/use-jazz-voice";

export default function JazzDashboard() {
    // Custom Hooks
    const chat = useJazzChat();
    const voice = useJazzVoice();

    // UI State
    const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [memoryCheckerOpen, setMemoryCheckerOpen] = useState(false);
    const [selectedText, setSelectedText] = useState("");
    const [checkerPosition, setCheckerPosition] = useState({ x: 0, y: 0 });
    const [audioEnabled, setAudioEnabled] = useState(false);
    const processedIds = useRef(new Set<string>());

    // Unlock audio context helper
    const enableAudio = () => {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.01; // Silent, but technical "sound"
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(0);
        setTimeout(() => oscillator.stop(), 100);
        setAudioEnabled(true);
        console.log("🔊 [Frontend V2] Audio Context Unlocked");
    };

    // URL handling for initial messages
    const [, setLocation] = useLocation();

    // Voice integration
    const handleToggleVoice = () => {
        voice.toggleListening((text) => {
            chat.handleSendMessage(text);
        });

        // Update UI state based on voice status
        if (voice.isListening) {
            chat.setAiStatus('IDLE');
        } else {
            chat.setAiStatus('LISTENING');
        }
    };

    // Auto-tts for streaming mode
    useEffect(() => {
        if (chat.appMode === 'STREAMING' && chat.messages.length > 0) {
            const lastMsg = chat.messages[chat.messages.length - 1];
            if (lastMsg.type === 'AI' && !voice.isSpeaking) {
                voice.speak(lastMsg.content);
                chat.setAiStatus('SPEAKING');
            }
        }
    }, [chat.messages, chat.appMode]);

    // Reset status when speaking ends
    useEffect(() => {
        if (!voice.isSpeaking && chat.aiStatus === 'SPEAKING') {
            chat.setAiStatus('IDLE');
        }
    }, [voice.isSpeaking]);

    // Handle initial URL message
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const initialMessage = params.get('message');

        if (initialMessage && chat.activeProfile) {
            console.log("📥 Received initial message from query param:", initialMessage);
            window.history.replaceState({}, '', window.location.pathname);
            const decodedMessage = decodeURIComponent(initialMessage);
            chat.handleSendMessage(decodedMessage);
        }
    }, [chat.activeProfile]); // Depend on activeProfile so we don't try before profile loads

    // 🎮 TWITCH AUDIO POLLING (V2)
    const { data: twitchAudioQueue } = useQuery<{ id: string; text: string; type: string }[]>({
        queryKey: ['/api/twitch/audio-queue'],
        refetchInterval: 3000,
        refetchIntervalInBackground: true,
    });

    useEffect(() => {
        // DBG: Log poll status
        if (twitchAudioQueue) {
            console.log(`🎮 [Frontend V2] Polling Twitch Audio. Items: ${twitchAudioQueue.length}. AppMode: ${chat.appMode}`);
        }

        if (twitchAudioQueue && twitchAudioQueue.length > 0) {
            console.log(`🎮 [Frontend V2] Found ${twitchAudioQueue.length} items in Twitch Audio Queue`);
            twitchAudioQueue.forEach(async (item) => {
                if (processedIds.current.has(item.id)) {
                    console.log(`⚠️ [Frontend V2] Skipping duplicate/processed item: ${item.id}`);
                    return;
                }

                processedIds.current.add(item.id);

                // Play audio
                console.log(`🎮 [Frontend V2] Playing Twitch Audio: [${item.type}] ${item.text.substring(0, 30)}...`);
                voice.speak(item.text);

                // Ack
                try {
                    await fetch(`/api/twitch/audio-queue/${item.id}/ack`, { method: 'POST' });
                    console.log(`✅ [Frontend V2] Acked audio item: ${item.id}`);
                } catch (e) {
                    console.error(`❌ [Frontend V2] Failed to ack audio item: ${item.id}`, e);
                }
            });
        }
    }, [twitchAudioQueue, voice]);

    return (
        <>
            {/* History Sheet (Mobile) */}
            <Sheet open={isHistorySheetOpen} onOpenChange={setIsHistorySheetOpen}>
                <SheetContent side="left" className="p-0 sm:max-w-md">
                    <SheetHeader className="px-4 py-3 border-b">
                        <SheetTitle>Conversation History</SheetTitle>
                    </SheetHeader>
                    <ChatHistorySidebar
                        currentConversationId={chat.currentConversationId}
                        onSelectConversation={(id) => {
                            setIsHistorySheetOpen(false);
                            chat.setCurrentConversationId(id);
                            chat.setMessages([]);
                            chat.setAiStatus('IDLE');
                        }}
                        onNewChat={() => {
                            setIsHistorySheetOpen(false);
                            chat.handleNewChat();
                        }}
                        variant="sidebar"
                        className="h-[calc(100vh-4rem)]"
                    />
                </SheetContent>
            </Sheet>

            {/* Modals */}
            <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
            <NotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} />

            {/* Main Dashboard */}
            <div className="h-full flex flex-col gap-4">
                <JazzHeader
                    aiStatus={chat.aiStatus}
                    appMode={chat.appMode}
                    onModeChange={chat.setAppMode}
                    onOpenHistory={() => setIsHistorySheetOpen(true)}
                    onConsolidate={chat.consolidateMemory}
                    onClear={chat.handleNewChat}
                >
                    {!audioEnabled && (
                        <button
                            onClick={enableAudio}
                            className="mr-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-full animate-pulse font-bold"
                            title="Click to enable automated audio (Browser Policy)"
                        >
                            <i className="fas fa-volume-mute mr-1"></i>
                            Enable Audio
                        </button>
                    )}
                </JazzHeader>

                <JazzChatLayout
                    messageCount={chat.messages.length}
                    sidebarContent={
                        <ChatHistorySidebar
                            currentConversationId={chat.currentConversationId}
                            onSelectConversation={(id) => {
                                chat.setCurrentConversationId(id);
                                chat.setMessages([]);
                                chat.setAiStatus('IDLE');
                            }}
                            onNewChat={chat.handleNewChat}
                            variant="embedded"
                            className="h-full"
                        />
                    }
                    chatPanelContent={
                        <ChatPanel
                            messages={chat.messages}
                            conversationId={chat.currentConversationId}
                            sessionDuration={chat.getSessionDuration()}
                            messageCount={chat.messages.length}
                            appMode={chat.appMode}
                            isDebugMode={chat.isDebugMode}
                            onToggleDebugMode={() => chat.setIsDebugMode(!chat.isDebugMode)}
                            onPlayAudio={(content) => voice.speak(content)}
                            onPauseAudio={voice.pauseSpeaking}
                            onResumeAudio={voice.resumeSpeaking}
                            onStopAudio={voice.stopSpeaking}
                            onReplayAudio={voice.replaySpeaking}
                            onSaveAudio={voice.saveAudio}
                            isPlayingAudio={voice.isSpeaking}
                            isPausedAudio={voice.isPaused}
                            canReplay={voice.canReplay}
                            canSave={voice.canSaveAudio}
                            onTextSelection={() => { }}
                            // Memory actions
                            memoryLearning={chat.memoryLearning}
                            onToggleLearning={chat.handleToggleLearning}
                            onSaveToMemory={chat.saveToMemory}
                        />
                    }
                    composerContent={
                        <MessageComposer
                            onSendMessage={chat.handleSendMessage}
                            onClearChat={() => chat.setMessages([])}
                            onStoreMemory={chat.consolidateMemory}
                            onToggleVoice={handleToggleVoice}
                            isListening={voice.isListening}
                            isSpeaking={voice.isSpeaking}
                            appMode={chat.appMode}
                            sessionDuration={chat.getSessionDuration()}
                            messageCount={chat.messages.length}
                            memoryCount={chat.memoryStats?.totalFacts ?? 0}
                            documentCount={chat.documentCount}
                            disabled={chat.aiStatus === 'PROCESSING'}
                        />
                    }
                    rightPanelContent={<PersonalitySurgePanel />}
                />
            </div>

            {/* Memory Checker */}
            <MemoryChecker
                selectedText={selectedText}
                profileId={chat.activeProfile?.id}
                isOpen={memoryCheckerOpen}
                onClose={() => setMemoryCheckerOpen(false)}
                position={checkerPosition}
            />
        </>
    );
}
