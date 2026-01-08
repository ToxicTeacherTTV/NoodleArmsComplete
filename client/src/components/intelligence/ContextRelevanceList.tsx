import { Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PriorityBadge } from './PriorityBadge';
import { ContextRelevance } from './types';

interface ContextRelevanceListProps {
    items: ContextRelevance[];
    selectedMemories: string[];
    onToggleMemory: (id: string) => void;
}

export const ContextRelevanceList = ({ items, selectedMemories, onToggleMemory }: ContextRelevanceListProps) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Context Relevance Analysis
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {(items || [])
                    .filter(item => item?.shouldHide)
                    .length > 0 ? (items || [])
                        .filter(item => item?.shouldHide)
                        .map((item) => (
                            <div
                                key={item.memoryId}
                                className="p-4 border rounded-lg"
                                data-testid={`relevance-${item.memoryId}`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="text-sm mb-2">
                                            {(item.content || 'No content').substring(0, 150)}...
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                            {item.reasoning || 'No reasoning provided'}
                                        </div>
                                    </div>
                                    <div className="ml-4 flex flex-col items-end space-y-2">
                                        <PriorityBadge
                                            priority={item.shouldHide ? 'HIGH' : 'LOW'}
                                            score={item.relevanceScore || 0}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onToggleMemory(item.memoryId)}
                                            data-testid={`select-memory-${item.memoryId}`}
                                        >
                                            {selectedMemories.includes(item.memoryId) ? 'Deselect' : 'Select'}
                                        </Button>
                                    </div>
                                </div>
                                <Progress value={item.relevanceScore || 0} className="w-full" />
                            </div>
                        )) : (
                    <div className="text-center py-8 text-gray-500">
                        No low-relevance memories found for hiding.
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
