import { Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface TrustAIToggleProps {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
}

export const TrustAIToggle = ({ enabled, onToggle }: TrustAIToggleProps) => {
    return (
        <div className="flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <Brain className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
                <div className="font-semibold text-blue-900 dark:text-blue-100">
                    Trust AI Mode
                    {enabled && <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                    {enabled
                        ? "AI is automatically handling 80% of memory management decisions"
                        : "Enable to let AI handle low-stakes decisions automatically"
                    }
                </div>
            </div>
            <Switch
                checked={enabled}
                onCheckedChange={onToggle}
                data-testid="trust-ai-toggle"
            />
        </div>
    );
};
