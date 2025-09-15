import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { AppMode } from "@/types";

interface ControlPanelProps {
  onToggleListening: () => void;
  onSendText: (text: string) => void;
  onClearChat: () => void;
  onStoreConversation: () => void;
  isListening: boolean;
  appMode?: AppMode;
  pendingTranscript?: string; // Show what user is saying while listening
}

export default function ControlPanel({
  onToggleListening,
  onSendText,
  onClearChat,
  onStoreConversation,
  isListening,
  appMode = 'PODCAST',
  pendingTranscript = '',
}: ControlPanelProps) {
  const [textInput, setTextInput] = useState("");

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      onSendText(textInput.trim());
      setTextInput("");
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Voice Controls */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Voice Controls</h3>
        
        {appMode === 'STREAMING' ? (
          <Button
            onClick={onToggleListening}
            className={`w-full py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 ${
              isListening
                ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground neon-glow'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground neon-glow'
            }`}
            data-testid="button-toggle-listening"
          >
            <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'}`}></i>
            <span>{isListening ? 'Stop Listening' : 'Start Listening'}</span>
          </Button>
        ) : (
          <div className="w-full py-3 px-4 rounded-lg bg-muted/30 text-muted-foreground text-center text-sm">
            <i className="fas fa-microphone-slash mr-2"></i>
            Voice listening disabled in Podcast Mode
          </div>
        )}

        <div className="flex items-center justify-between w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground py-2 px-4 rounded-lg transition-all duration-200">
          <div className="flex items-center space-x-2">
            <i className="fas fa-volume-up"></i>
            <span className="text-sm">ElevenLabs Voice</span>
          </div>
          <div className="w-2 h-2 bg-green-400 rounded-full" data-testid="elevenlabs-status"></div>
        </div>
      </div>

      {/* Text Input */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Text Chat</h3>
        <form onSubmit={handleSendText} className="space-y-2">
          <Textarea
            value={isListening && pendingTranscript ? pendingTranscript : textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="w-full bg-input border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder={isListening ? "🎤 Listening... speak now!" : "Type a message to Nicky..."}
            rows={3}
            data-testid="textarea-message-input"
            readOnly={isListening} // Prevent typing while listening
          />
          <Button 
            type="submit" 
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200"
            data-testid="button-send-message"
          >
            <i className="fas fa-paper-plane"></i>
            <span>Send Message</span>
          </Button>
        </form>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onStoreConversation}
            variant="secondary"
            size="sm"
            className="bg-muted hover:bg-muted/80 text-muted-foreground py-2 px-3 rounded-lg text-xs transition-all duration-200"
            data-testid="button-store-conversation"
          >
            <i className="fas fa-save"></i>
            <span className="ml-1">Store Chat</span>
          </Button>
          <Button
            onClick={onClearChat}
            variant="secondary"
            size="sm"
            className="bg-muted hover:bg-muted/80 text-muted-foreground py-2 px-3 rounded-lg text-xs transition-all duration-200"
            data-testid="button-clear-chat"
          >
            <i className="fas fa-trash"></i>
            <span className="ml-1">Clear</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
