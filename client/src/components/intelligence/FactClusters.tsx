import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Target, Loader2, Edit, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PriorityBadge } from './PriorityBadge';
import { FactCluster } from './types';

interface FactClustersProps {
    clusters: FactCluster[];
    trustAIMode: boolean;
}

export const FactClusters = ({ clusters, trustAIMode }: FactClustersProps) => {
    const { toast } = useToast();
    const [mergingClusterId, setMergingClusterId] = useState<string | null>(null);
    const [mergedClusters, setMergedClusters] = useState<Set<string>>(new Set());
    const [reviewingCluster, setReviewingCluster] = useState<FactCluster | null>(null);
    const [editedMergeContent, setEditedMergeContent] = useState("");

    const bulkActionMutation = useMutation({
        mutationFn: async ({ action, memoryIds, options, clusterId }: {
            action: string;
            memoryIds?: string[];
            options?: any;
            clusterId?: string;
        }) => {
            if (clusterId) setMergingClusterId(clusterId);
            return apiRequest('POST', '/api/intelligence/bulk-action', {
                action,
                memoryIds,
                options,
                trustAI: trustAIMode
            });
        },
        onSuccess: (data: any, variables) => {
            const clusterId = variables.clusterId;

            if (clusterId) {
                setMergedClusters(prev => {
                    const next = new Set(prev);
                    next.add(clusterId);
                    return next;
                });
                toast({
                    title: "✅ Cluster Merged",
                    description: `Successfully merged ${variables.memoryIds?.length || 0} facts into one memory`,
                });
            }

            // Invalidate all intelligence-related queries
            queryClient.invalidateQueries({ queryKey: ['/api/intelligence/analysis'] });
            queryClient.invalidateQueries({ queryKey: ['/api/intelligence/summaries'] });
            queryClient.invalidateQueries({ queryKey: ['/api/memory/entries'] });
            queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });

            setMergingClusterId(null);
        },
        onError: (error: any) => {
            toast({
                title: "Operation Failed",
                description: error.message || "Failed to perform bulk operation",
                variant: "destructive",
            });
            setMergingClusterId(null);
        }
    });

    const handleReviewMerge = (cluster: FactCluster) => {
        setReviewingCluster(cluster);
        setEditedMergeContent(cluster.suggestedMerge);
    };

    const handleConfirmMerge = () => {
        if (!reviewingCluster) return;

        bulkActionMutation.mutate({
            action: 'merge_cluster',
            memoryIds: reviewingCluster.factIds,
            options: { mergedContent: editedMergeContent },
            clusterId: reviewingCluster.clusterId
        });

        setReviewingCluster(null);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Fact Clusters
                        <Badge variant="outline">
                            {(clusters || []).length} clusters found
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {(clusters || []).filter(c => !mergedClusters.has(c.clusterId)).length > 0 ? (clusters || []).filter(c => !mergedClusters.has(c.clusterId)).map((cluster) => (
                        <div
                            key={cluster.clusterId}
                            className="p-4 border rounded-lg space-y-3"
                            data-testid={`cluster-${cluster.clusterId}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <PriorityBadge
                                        priority={cluster.priority}
                                        score={cluster.consolidationScore}
                                    />
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {(cluster.factIds || []).length} facts
                                    </span>
                                </div>
                                {trustAIMode && cluster.priority === 'HIGH' && (
                                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        Auto-eligible
                                    </Badge>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="font-medium">Suggested merge:</div>
                                <div className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded">
                                    {cluster.suggestedMerge || 'No suggestion available'}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {cluster.reasoning || 'No reasoning provided'}
                                </div>
                            </div>

                            <Progress value={cluster.consolidationScore || 0} className="w-full" />

                            <div className="flex justify-end pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReviewMerge(cluster)}
                                    disabled={mergingClusterId === cluster.clusterId}
                                    data-testid={`button-merge-cluster-${cluster.clusterId}`}
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-200"
                                >
                                    {mergingClusterId === cluster.clusterId ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Merging...
                                        </>
                                    ) : (
                                        <>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Review & Merge
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-8 text-gray-500">
                            No fact clusters found. This could be due to API limitations or insufficient data for clustering.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!reviewingCluster} onOpenChange={(open) => !open && setReviewingCluster(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Review & Merge Facts</DialogTitle>
                        <DialogDescription>
                            Review the original facts and edit the suggested merged content before confirming.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                            <h4 className="font-medium text-sm text-gray-500">Original Facts ({reviewingCluster?.factIds.length})</h4>
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-4 space-y-3 max-h-60 overflow-y-auto border">
                                {reviewingCluster?.facts?.map((fact, i) => (
                                    <div key={fact.id} className="text-sm border-b last:border-0 pb-2 last:pb-0 border-slate-200 dark:border-slate-700">
                                        <span className="font-mono text-xs text-slate-400 mr-2">#{i + 1}</span>
                                        {fact.content}
                                    </div>
                                )) || (
                                        <div className="text-sm text-gray-500 italic">
                                            Fact content not available. IDs: {reviewingCluster?.factIds.join(', ')}
                                        </div>
                                    )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-medium text-sm text-gray-500">Merged Content (Editable)</h4>
                            <Textarea
                                value={editedMergeContent}
                                onChange={(e) => setEditedMergeContent(e.target.value)}
                                className="min-h-[150px] font-medium"
                                placeholder="Enter the merged fact content..."
                            />
                            <p className="text-xs text-gray-500">
                                This will replace the {reviewingCluster?.factIds.length} original facts with a single new memory.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReviewingCluster(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmMerge} className="bg-blue-600 hover:bg-blue-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Confirm Merge
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
