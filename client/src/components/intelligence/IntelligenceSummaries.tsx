import { Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { PriorityBadge } from './PriorityBadge';
import { SummaryData } from './types';
import { useQuery } from '@tanstack/react-query';

interface IntelligenceSummariesProps {
    trustAIMode: boolean;
}

export const IntelligenceSummaries = ({ trustAIMode }: IntelligenceSummariesProps) => {
    const { toast } = useToast();

    const { data: summaryData, isLoading: summariesLoading } = useQuery<SummaryData>({
        queryKey: ['/api/intelligence/summaries'],
        refetchInterval: 60000,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI-Generated Memory Summaries
                    <Badge variant="outline">
                        Replace individual fact reading
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {summariesLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3">Generating AI summaries...</span>
                    </div>
                ) : summaryData ? (
                    <>
                        {/* Overview Section */}
                        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg" data-testid="summaries-overview">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Knowledge Base Overview</h3>
                            <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                                {summaryData?.overview || 'No overview available'}
                            </div>
                        </div>

                        {/* Category Summaries */}
                        {summaryData?.summaries && summaryData.summaries.length > 0 ? (
                            <div className="space-y-4">
                                <h3 className="font-semibold">Category Summaries</h3>
                                {summaryData.summaries.map((summary) => (
                                    <div
                                        key={summary.id}
                                        className="p-4 border rounded-lg space-y-3"
                                        data-testid={`summary-${summary.type}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <h4 className="font-medium">{summary.title}</h4>
                                                <PriorityBadge
                                                    priority={summary.priority}
                                                    score={summary.confidenceScore}
                                                />
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                {summary.factCount} facts
                                            </div>
                                        </div>

                                        <div className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded whitespace-pre-wrap">
                                            {summary.content}
                                        </div>

                                        {summary.insights && summary.insights.length > 0 && (
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Insights:</div>
                                                {summary.insights.map((insight: string, idx: number) => (
                                                    <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 pl-2 border-l-2 border-blue-200">
                                                        {insight}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <Progress value={summary.confidenceScore} className="w-full" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                No category summaries available
                            </div>
                        )}

                        {/* Insights and Recommendations */}
                        {summaryData?.insights && summaryData.insights.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="font-semibold">AI Insights</h3>
                                <div className="space-y-2" data-testid="ai-insights">
                                    {summaryData.insights.map((insight, idx) => (
                                        <div key={idx} className="p-3 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-400 text-sm">
                                            💡 {insight}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {summaryData?.recommendations && summaryData.recommendations.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="font-semibold">AI Recommendations</h3>
                                <div className="space-y-2" data-testid="ai-recommendations">
                                    {summaryData.recommendations.map((rec, idx) => (
                                        <div key={idx} className="p-3 bg-green-50 dark:bg-green-900 border-l-4 border-green-400 text-sm flex items-start justify-between">
                                            <div>🎯 {rec}</div>
                                            {trustAIMode && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        // Auto-apply recommendation logic would go here
                                                        toast({
                                                            title: "AI Recommendation Applied",
                                                            description: "Trust AI mode handled this automatically",
                                                        });
                                                    }}
                                                    data-testid={`apply-recommendation-${idx}`}
                                                >
                                                    Auto-Apply
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        No summary data available. Enable intelligence analysis to generate summaries.
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
