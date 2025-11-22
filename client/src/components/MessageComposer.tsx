import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AppMode } from "@/types";

interface MessageComposerProps {
    onSendMessage: (message: string) => void;
    onClearChat: () => void;
    onStoreMemory: () => void;
    onToggleVoice: () => void;
    isListening: boolean;
    isSpeaking: boolean;
    appMode: AppMode;
    sessionDuration: string;
    messageCount: number;
    memoryCount: number;
    documentCount: number;
    disabled?: boolean;
}

export default function MessageComposer({
    onSendMessage,
    onClearChat,
    onStoreMemory,
    onToggleVoice,
    isListening,
    isSpeaking,
    appMode,
    sessionDuration,
    messageCount,
    memoryCount,
    documentCount,
    disabled = false,
}: MessageComposerProps) {
    const [message, setMessage] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || disabled) return;
        onSendMessage(message.trim());
        setMessage("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <Card className="border-primary/20 shadow-lg">
            <CardContent className="p-6 space-y-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Text Input */}
                    <div className="relative">
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                isListening
                                    ? "🎤 Listening... speak now!"
                                    : appMode === "STREAMING"
                                        ? "Type your message or use voice..."
                                        : "Chat with Nicky..."
                            }
                            className={cn(
                                "min-h-[100px] resize-none text-base",
                                "focus-visible:ring-2 focus-visible:ring-primary",
                                isListening && "bg-primary/5 border-primary"
                            )}
                            disabled={disabled || isListening}
                        />
                        {isListening && (
                            <div className="absolute right-3 top-3">
                                <div className="flex items-center gap-1">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                                    <span className="h-3 w-3 animate-pulse rounded-full bg-destructive animation-delay-150" />
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-destructive animation-delay-300" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Primary Actions */}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="submit"
                            size="lg"
                            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
                            disabled={disabled || !message.trim()}
                        >
                            <i className="fas fa-paper-plane mr-2" />
                            Send
                        </Button>

                        {appMode === "STREAMING" && (
                            <Button
                                type="button"
                                size="lg"
                                variant={isListening ? "destructive" : "default"}
                                onClick={onToggleVoice}
                                disabled={disabled}
                                className={cn(
                                    "shadow-md",
                                    isListening && "animate-pulse"
                                )}
                            >
                                <i className={`fas ${isListening ? "fa-stop" : "fa-microphone"} mr-2`} />
                                {isListening ? "Stop" : "Voice"}
                            </Button>
                        )}

                        {/* Options Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="lg">
                                    <i className="fas fa-ellipsis-vertical" />
                                    <span className="sr-only">Options</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={onStoreMemory} disabled={messageCount === 0}>
                                    <i className="fas fa-save mr-2 text-primary" />
                                    Store to Memory
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onClearChat} disabled={messageCount === 0}>
                                    <i className="fas fa-trash mr-2 text-muted-foreground" />
                                    Clear Chat
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled>
                                    <i className="fas fa-sliders mr-2 text-muted-foreground" />
                                    Voice Settings
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Stats Bar */}
                    <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary" className="gap-1.5">
                            <i className="fas fa-clock" />
                            {sessionDuration}
                        </Badge>
                        <Badge variant="secondary" className="gap-1.5">
                            <i className="fas fa-comments" />
                            {messageCount} messages
                        </Badge>
                        <Badge variant="secondary" className="gap-1.5">
                            <i className="fas fa-brain" />
                            {memoryCount} facts
                        </Badge>
                        <Badge variant="secondary" className="gap-1.5">
                            <i className="fas fa-folder-tree" />
                            {documentCount} docs
                        </Badge>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
