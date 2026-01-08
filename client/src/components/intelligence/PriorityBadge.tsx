import { Badge } from '@/components/ui/badge';

export const PriorityBadge = ({ priority, score }: { priority?: string; score?: number }) => {
    const colors = {
        HIGH: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
        MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
        LOW: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
        AUTO: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
        MINOR: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
        MODERATE: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
        MAJOR: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200'
    };

    const displayPriority = priority || 'UNKNOWN';
    const color = colors[displayPriority as keyof typeof colors] || colors.LOW;

    return (
        <Badge className={color} data-testid={`priority-badge-${displayPriority.toLowerCase()}`}>
            {displayPriority} {score && `(${score}%)`}
        </Badge>
    );
};
