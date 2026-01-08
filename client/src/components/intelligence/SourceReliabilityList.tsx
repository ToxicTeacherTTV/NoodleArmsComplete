import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PriorityBadge } from './PriorityBadge';
import { SourceReliability } from './types';

interface SourceReliabilityListProps {
    sources: SourceReliability[];
}

export const SourceReliabilityList = ({ sources }: SourceReliabilityListProps) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Source Reliability Analysis
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {(sources || []).length > 0 ? (sources || []).map((source) => (
                    <div
                        key={source.sourceId}
                        className="p-4 border rounded-lg"
                        data-testid={`source-${source.sourceId}`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="font-medium">{source.sourceName || 'Unknown source'}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {source.factCount || 0} facts • {source.accuracyRate || 0}% accuracy
                                </div>
                            </div>
                            <PriorityBadge
                                priority={source.recommendation || 'LOW'}
                                score={source.reliabilityScore || 0}
                            />
                        </div>
                        <Progress value={source.reliabilityScore || 0} className="w-full" />
                    </div>
                )) : (
                    <div className="text-center py-8 text-gray-500">
                        No source reliability data available.
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
