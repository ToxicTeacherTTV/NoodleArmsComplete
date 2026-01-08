import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { QuickModelToggle } from "@/components/quick-model-toggle";
import StatusIndicator from "@/components/status-indicator";
import { cn } from "@/lib/utils";
import { AIStatus, AppMode } from "@/types";

interface JazzHeaderProps {
    aiStatus: AIStatus;
    appMode: AppMode;
    onModeChange: (mode: AppMode) => void;
    onOpenHistory: () => void;
    children?: React.ReactNode;
    onConsolidate?: () => void;
    onClear?: () => void;
}

export const JazzHeader = ({
    aiStatus,
    appMode,
    onModeChange,
    onOpenHistory,
    children,
    onConsolidate,
    onClear
}: JazzHeaderProps) => {
    return (
        <div className="flex items-center justify-between pb-2 border-b">
            <h2 className="text-lg font-semibold">Chat Session</h2>
            <div className="flex items-center gap-3">
                {children}
                {/* Quick Model Toggle */}
                <QuickModelToggle compact={true} />

                <StatusIndicator status={aiStatus} />

                <ToggleGroup
                    type="single"
                    value={appMode}
                    onValueChange={(value) => value && onModeChange(value as AppMode)}
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

                {/* Manual Actions (Desktop) */}
                <div className="hidden md:flex items-center gap-1 border-l pl-2 ml-1">
                    {onConsolidate && (
                        <Button
                            variant="ghost" size="sm"
                            onClick={onConsolidate}
                            title="Consolidate Memory"
                        >
                            <i className="fas fa-save text-blue-400" />
                        </Button>
                    )}
                    {onClear && (
                        <Button
                            variant="ghost" size="sm"
                            onClick={onClear}
                            title="Clear Chat / New Session"
                        >
                            <i className="fas fa-trash text-muted-foreground hover:text-red-400" />
                        </Button>
                    )}
                </div>

                <Button
                    variant="ghost" size="sm"
                    className="sm:hidden"
                    onClick={onOpenHistory}
                >
                    <i className="fas fa-clock-rotate-left" />
                </Button>
            </div>
        </div>
    );
};
