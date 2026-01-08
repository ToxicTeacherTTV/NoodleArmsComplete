import { TrendingUp, Check, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PriorityBadge } from './PriorityBadge';
import { PersonalityDriftItem } from './types';

interface PersonalityDriftProps {
    drift: PersonalityDriftItem[];
}

export const PersonalityDrift = ({ drift }: PersonalityDriftProps) => {
    const { toast } = useToast();

    const handleAcceptBaseline = async (driftItem: PersonalityDriftItem) => {
        try {
            await apiRequest('POST', '/api/intelligence/accept-baseline', {
                traitName: driftItem.traitName,
                value: driftItem.current,
                previousValue: driftItem.baseline,
                notes: `Accepted drift from ${driftItem.baseline} to ${driftItem.current} (${driftItem.driftAmount >= 0 ? '+' : ''}${driftItem.driftAmount})`
            });

            toast({
                title: "Baseline Updated",
                description: `"${driftItem.traitName}" baseline set to ${driftItem.current}. Future analysis will compare against this value.`,
            });

            // Invalidate analysis to refresh drift detection
            queryClient.invalidateQueries({ queryKey: ['/api/intelligence/analysis'] });
        } catch (error: any) {
            toast({
                title: "Update Failed",
                description: error.message || "Failed to update personality baseline",
                variant: "destructive",
            });
        }
    };

    const handleReviewFacts = (factIds: string[]) => {
        toast({
            title: "Review Affected Facts",
            description: `Opening ${factIds.length} affected facts in memory management...`,
        });

        // Navigate to Brain Management tab with factIds filter
        const factIdsParam = encodeURIComponent(factIds.join(','));
        window.location.href = `/brain?tab=memory&factIds=${factIdsParam}`;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Personality Drift Analysis
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {(drift || []).length > 0 ? (
                    <>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">Drift Detection Summary</span>
                                <span className="text-lg font-bold" data-testid="drift-count">
                                    {(drift || []).length} trait{(drift || []).length !== 1 ? 's' : ''} shifted
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {(drift || []).map((item, index) => (
                                <div
                                    key={item.traitName}
                                    className="p-4 border rounded-lg space-y-3"
                                    data-testid={`drift-area-${index}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-lg">{item.traitName}</span>
                                        <PriorityBadge priority={item.severity} score={Math.abs(item.driftAmount)} />
                                    </div>

                                    <div className="flex items-center space-x-4 text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">
                                            Baseline: {item.baseline}
                                        </span>
                                        <span className="text-gray-600 dark:text-gray-400">
                                            Current: {item.current}
                                        </span>
                                        <span className={item.driftAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                                            {item.driftAmount > 0 ? '+' : ''}{item.driftAmount}
                                        </span>
                                    </div>

                                    <div className="text-sm bg-blue-50 dark:bg-blue-900 p-3 rounded">
                                        <div className="font-medium mb-1">Recommendation:</div>
                                        {item.recommendation}
                                    </div>

                                    <div className="text-xs text-gray-500 mb-2">
                                        Affected facts: {item.affectedFacts?.length || 0}
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleAcceptBaseline(item)}
                                            data-testid={`button-accept-baseline-${index}`}
                                            className="flex-1"
                                        >
                                            <Check className="h-4 w-4 mr-1" />
                                            Accept as New Baseline
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleReviewFacts(item.affectedFacts || [])}
                                            data-testid={`button-review-facts-${index}`}
                                            className="flex-1"
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            Review Affected Facts ({item.affectedFacts?.length || 0})
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        No personality drift detected. Nicky's personality traits are stable and consistent.
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
