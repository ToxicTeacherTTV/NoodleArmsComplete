import type { AIStatus } from "@/types";

interface StatusIndicatorProps {
  status: AIStatus;
}

export default function StatusIndicator({ status }: StatusIndicatorProps) {
  const getStatusConfig = (status: AIStatus) => {
    switch (status) {
      case 'LISTENING':
        return {
          color: 'text-accent',
          bgColor: 'bg-accent',
          icon: 'fa-microphone',
          text: 'Listening',
          animate: 'animate-pulse',
        };
      case 'THINKING':
        return {
          color: 'text-primary',
          bgColor: 'bg-primary',
          icon: 'fa-brain',
          text: 'Thinking',
          animate: 'animate-pulse',
        };
      case 'SPEAKING':
        return {
          color: 'text-secondary',
          bgColor: 'bg-secondary',
          icon: 'fa-volume-up',
          text: 'Speaking',
          animate: 'animate-bounce-subtle',
        };
      case 'IDLE':
      default:
        return {
          color: 'text-muted-foreground',
          bgColor: 'bg-muted-foreground',
          icon: 'fa-circle',
          text: 'Idle',
          animate: '',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className="mt-4 flex items-center space-x-2" data-testid="status-indicator">
      <div className={`w-3 h-3 ${config.bgColor} rounded-full ${config.animate}`}></div>
      <span className={`text-sm ${config.color} font-medium flex items-center space-x-1`}>
        <i className={`fas ${config.icon} text-xs`}></i>
        <span>{config.text}</span>
      </span>
    </div>
  );
}
