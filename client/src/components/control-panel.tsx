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
  onPauseSpeech?: () => void;
  onResumeSpeech?: () => void;
  onStopSpeech?: () => void;
  isListening: boolean;
  isSpeaking?: boolean;
  isPaused?: boolean;
  appMode?: AppMode;
  pendingTranscript?: string; // Show what user is saying while listening
}

export default function ControlPanel({
  onToggleListening,
  onSendText,
  onClearChat,
  onStoreConversation,
  onPauseSpeech,
  onResumeSpeech,
  onStopSpeech,
  isListening,
  isSpeaking = false,
  isPaused = false,
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter, allow Shift+Enter for new lines
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText(e as any);
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Voice Controls */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Voice Controls</h3>
        
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

        <div className="flex items-center justify-between w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground py-2 px-4 rounded-lg transition-all duration-200">
          <div className="flex items-center space-x-2">
            <i className="fas fa-volume-up"></i>
            <span className="text-sm">ElevenLabs Voice</span>
          </div>
          <div className="w-2 h-2 bg-green-400 rounded-full" data-testid="elevenlabs-status"></div>
        </div>

        {/* Speech Control Buttons */}
        {isSpeaking && (
          <div className="flex space-x-2">
            {!isPaused ? (
              <Button
                onClick={onPauseSpeech}
                size="sm"
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 px-3 rounded-lg flex items-center justify-center space-x-1 transition-all duration-200"
                data-testid="button-pause-speech"
              >
                <i className="fas fa-pause"></i>
                <span>Pause</span>
              </Button>
            ) : (
              <Button
                onClick={onResumeSpeech}
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg flex items-center justify-center space-x-1 transition-all duration-200"
                data-testid="button-resume-speech"
              >
                <i className="fas fa-play"></i>
                <span>Resume</span>
              </Button>
            )}
            <Button
              onClick={onStopSpeech}
              size="sm"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg flex items-center justify-center space-x-1 transition-all duration-200"
              data-testid="button-stop-speech"
            >
              <i className="fas fa-stop"></i>
              <span>Stop</span>
            </Button>
          </div>
        )}
      </div>

      {/* Text Input */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Text Chat</h3>
        <form onSubmit={handleSendText} className="space-y-2">
          <Textarea
            value={isListening ? pendingTranscript : textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-input border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder={isListening ? "🎤 Listening... speak now!" : "Type a message to Nicky... (Press Enter to send, Shift+Enter for new line)"}
            rows={3}
            data-testid="textarea-message-input"
            readOnly={isListening} // Prevent typing while listening
          />
          <div className="flex gap-2">
            <Button 
              type="button"
              onClick={onToggleListening}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 ${
                isListening
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground neon-glow'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }`}
              title={isListening ? "Stop Recording" : "Start Recording"}
            >
              <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'}`}></i>
              <span>{isListening ? 'Stop' : 'Speak'}</span>
            </Button>
            <Button 
              type="submit" 
              className="flex-[2] bg-accent hover:bg-accent/90 text-accent-foreground py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200"
              data-testid="button-send-message"
            >
              <i className="fas fa-paper-plane"></i>
              <span>Send</span>
            </Button>
          </div>
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
