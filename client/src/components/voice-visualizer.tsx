import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VoiceActivity, StreamSettings } from "@/types";

interface VoiceVisualizerProps {
  voiceActivity: VoiceActivity;
  isActive: boolean;
  streamSettings: StreamSettings;
  onUpdateSettings: (settings: StreamSettings) => void;
  variant?: 'floating' | 'embedded';
  className?: string;
}

export default function VoiceVisualizer({
  voiceActivity,
  isActive,
  streamSettings,
  onUpdateSettings,
  variant = 'floating',
  className,
}: VoiceVisualizerProps) {
  const toggleSetting = (key: keyof StreamSettings) => {
    onUpdateSettings({
      ...streamSettings,
      [key]: !streamSettings[key],
    });
  };

  return (
    <div
      className={cn(
        variant === 'floating'
          ? 'fixed bottom-6 right-6 z-30 space-y-3'
          : 'space-y-3',
        className
      )}
    >
      {/* Voice Visualization */}
      <Card
        className={cn(
          variant === 'floating'
            ? 'w-64 bg-card/90 backdrop-blur-sm'
            : 'w-full bg-card',
          'border border-border rounded-xl p-4'
        )}
      >
        <CardContent className="p-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">Voice Input</span>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`}></div>
              <span className={`text-xs ${isActive ? 'text-green-400' : 'text-muted-foreground'}`}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          
          {/* Audio Visualizer */}
          <div className="flex items-end justify-center space-x-1 h-12 mb-3" data-testid="audio-visualizer">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-200 ${
                  isActive && voiceActivity.isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                style={{
                  height: isActive && voiceActivity.isActive 
                    ? `${20 + Math.random() * 60}%` 
                    : '20%',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          
          <div className="text-xs text-muted-foreground text-center min-h-[2.5rem] flex items-center justify-center">
            {voiceActivity.transcript ? (
              <span className="italic">"{voiceActivity.transcript.slice(0, 60)}..."</span>
            ) : isActive ? (
              <span>Listening for voice input...</span>
            ) : (
              <span>Voice input inactive</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Settings */}
      <Card
        className={cn(
          variant === 'floating'
            ? 'bg-card/90 backdrop-blur-sm'
            : 'bg-card',
          'border border-border rounded-xl p-4'
        )}
      >
        <CardContent className="p-0">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Stream Mode</h4>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Auto-respond to Chat</span>
              <Button
                onClick={() => toggleSetting('autoRespond')}
                className={`w-10 h-6 rounded-full relative transition-colors p-0 ${
                  streamSettings.autoRespond ? 'bg-primary' : 'bg-muted'
                }`}
                data-testid="toggle-auto-respond"
              >
                <div 
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    streamSettings.autoRespond ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Voice Output</span>
              <Button
                onClick={() => toggleSetting('voiceOutput')}
                className={`w-10 h-6 rounded-full relative transition-colors p-0 ${
                  streamSettings.voiceOutput ? 'bg-primary' : 'bg-muted'
                }`}
                data-testid="toggle-voice-output"
              >
                <div 
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    streamSettings.voiceOutput ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Memory Learning</span>
              <Button
                onClick={() => toggleSetting('memoryLearning')}
                className={`w-10 h-6 rounded-full relative transition-colors p-0 ${
                  streamSettings.memoryLearning ? 'bg-primary' : 'bg-muted'
                }`}
                data-testid="toggle-memory-learning"
              >
                <div 
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    streamSettings.memoryLearning ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
