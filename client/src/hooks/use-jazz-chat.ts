import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getModelPreference } from "@shared/modelSelection";
import { nanoid } from "nanoid";
import { Message, Profile, AIStatus, AppMode, MemoryStats } from "@/types";

export const useJazzChat = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // State
    const [currentConversationId, setCurrentConversationId] = useState<string>("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [aiStatus, setAiStatus] = useState<AIStatus>('IDLE');
    const [appMode, setAppMode] = useState<AppMode>('PODCAST');
    const [sessionStartTime] = useState<Date>(new Date());
    const [memoryLearning, setMemoryLearning] = useState<boolean>(false); // Default to OFF (private)
    const [isDebugMode, setIsDebugMode] = useState(false);

    // Initial Data Queries
    const { data: activeProfile } = useQuery<Profile>({
        queryKey: ['/api/profiles/active'],
        refetchInterval: false,
    });

    const { data: currentConversation } = useQuery<{ isPrivate: boolean } | null>({
        queryKey: ['/api/conversations', currentConversationId],
        enabled: !!currentConversationId,
    });

    const { data: memoryStats } = useQuery<MemoryStats>({
        queryKey: ['/api/memory/stats'],
        refetchInterval: 120000,
    });

    const { data: documents } = useQuery({
        queryKey: ['/api/documents'],
        refetchInterval: false,
    });

    const { data: conversationMessages } = useQuery<Message[]>({
        queryKey: ['/api/conversations', currentConversationId, 'messages'],
        enabled: !!currentConversationId,
        refetchInterval: false,
    });

    // Effects
    useEffect(() => {
        if (currentConversation) {
            setMemoryLearning(!currentConversation.isPrivate);
        }
    }, [currentConversation]);

    useEffect(() => {
        if (conversationMessages) {
            if (aiStatus === 'PROCESSING') return;
            setMessages(conversationMessages);
        }
    }, [conversationMessages, aiStatus]);

    // Initial message from URL param handling could be moved here or kept in component
    // Keeping it simple for now, relying on component to call handleSendMessage if needed

    // Mutations
    const sendMessageMutation = useMutation({
        mutationFn: async (data: { conversationId: string; content: string }) => {
            const selectedModel = getModelPreference('chat');
            const response = await apiRequest('POST', '/api/chat', {
                conversationId: data.conversationId,
                message: data.content,
                profileId: activeProfile?.id,
                mode: appMode,
                selectedModel,
                memoryLearning,
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
                        isPrivate: false,
                        metadata: {
                            processingTime: response.processingTime,
                            retrieved_context: response.retrievedContext,
                            debug_info: response.debugInfo
                        },
                    };
                    setMessages(prev => [...prev, aiMessage]);

                    // Note: Voice triggering should be handled by the consumer using the hook's returned status or callback
                    if (appMode === 'STREAMING') {
                        setAiStatus('SPEAKING');
                    } else {
                        setAiStatus('IDLE');
                    }

                    // Dispatch event to notify heat panel to refresh
                    window.dispatchEvent(new CustomEvent('nicky-response'));
                } else {
                    setAiStatus('IDLE');
                }
            }

            queryClient.invalidateQueries({ queryKey: ['/api/conversations/web'] });
            await queryClient.invalidateQueries({ queryKey: ['/api/conversations', variables.conversationId, 'messages'] });
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

    const updatePrivacyMutation = useMutation({
        mutationFn: async (isPrivate: boolean) => {
            if (!currentConversationId) return;
            return await apiRequest('PATCH', `/api/conversations/${currentConversationId}/privacy`, { isPrivate });
        },
        onSuccess: (_, isPrivate) => {
            queryClient.invalidateQueries({ queryKey: ['/api/conversations', currentConversationId] });
            queryClient.invalidateQueries({ queryKey: ['/api/conversations/web'] });
            toast({
                title: isPrivate ? "🔒 Private Mode" : "🧠 Learning Mode",
                description: isPrivate
                    ? "Nicky will not remember this conversation."
                    : "Nicky will learn from this conversation.",
            });
        },
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

    // Actions
    const handleSendMessage = async (content: string) => {
        if (!content.trim()) return;

        let activeId = currentConversationId;

        if (!activeId) {
            try {
                const newConv = await createConversationMutation.mutateAsync();
                activeId = newConv.id;
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
            isPrivate: false,
            metadata: {} as any,
        };

        setMessages(prev => [...prev, userMessage]);
        setAiStatus('PROCESSING');
        sendMessageMutation.mutate({
            conversationId: activeId,
            content: content.trim(),
        });
    };

    const handleNewChat = () => {
        setCurrentConversationId("");
        setMessages([]);
        setAiStatus('IDLE');
        setMemoryLearning(false); // Default to OFF (private) for new chats
    };

    const handleToggleLearning = () => {
        const currentIsPrivate = !memoryLearning;
        const targetIsPrivate = !currentIsPrivate;
        setMemoryLearning(!targetIsPrivate);
        if (currentConversationId) {
            updatePrivacyMutation.mutate(targetIsPrivate);
        }
    };

    const getSessionDuration = () => {
        const now = new Date();
        const diff = now.getTime() - sessionStartTime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return {
        // State
        currentConversationId,
        setCurrentConversationId,
        messages,
        setMessages,
        aiStatus,
        setAiStatus,
        appMode,
        setAppMode,
        memoryLearning,
        isDebugMode,
        setIsDebugMode,
        activeProfile,
        memoryStats,
        documents,

        // Actions
        handleSendMessage,
        handleNewChat,
        handleToggleLearning,
        consolidateMemory: () => consolidateMemoryMutation.mutate(currentConversationId),
        saveToMemory: (messageId: string, content: string) => saveToMemoryMutation.mutate({ messageId, content }),

        // Utils
        getSessionDuration,
        documentCount: Array.isArray(documents) ? documents.length : 0,
    };
};
