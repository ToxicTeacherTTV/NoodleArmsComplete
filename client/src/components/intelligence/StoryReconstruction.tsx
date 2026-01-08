import { useState } from 'react';
import { Brain, Loader2, Wrench, CheckCircle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export const StoryReconstruction = () => {
    const { toast } = useToast();
    const [isReconstructing, setIsReconstructing] = useState(false);
    const [reconstructionResult, setReconstructionResult] = useState<any>(null);

    const handleRunStoryReconstruction = async () => {
        setIsReconstructing(true);
        try {
            const response = await apiRequest('POST', '/api/memory/reconstruct', {});
            const result = await response.json();
            setReconstructionResult(result);
            toast({
                title: "Story Reconstruction Complete",
                description: `Successfully processed ${result.processedOrphans || 0} orphaned facts into ${result.newStories?.length || 0} story clusters`,
            });
        } catch (error: any) {
            toast({
                title: "Reconstruction Failed",
                description: error.message || "Failed to run story reconstruction",
                variant: "destructive",
            });
        } finally {
            setIsReconstructing(false);
        }
    };

    const handleApproveStory = async (storyId: string) => {
        try {
            await apiRequest('POST', `/api/memory/stories/${storyId}/approve`, {});
            toast({
                title: "Story Approved",
                description: "Story cluster has been approved and integrated into the knowledge base",
            });
            // Refresh reconstruction results
            if (reconstructionResult) {
                setReconstructionResult({
                    ...reconstructionResult,
                    newStories: reconstructionResult.newStories?.filter((story: any) => story.id !== storyId)
                });
            }
        } catch (error: any) {
            toast({
                title: "Approval Failed",
                description: error.message || "Failed to approve story",
                variant: "destructive",
            });
        }
    };

    const handleRejectStory = async (storyId: string) => {
        try {
            await apiRequest('POST', `/api/memory/stories/${storyId}/reject`, {});
            toast({
                title: "Story Rejected",
                description: "Story cluster has been rejected and facts returned to orphan status",
            });
            // Refresh reconstruction results
            if (reconstructionResult) {
                setReconstructionResult({
                    ...reconstructionResult,
                    newStories: reconstructionResult.newStories?.filter((story: any) => story.id !== storyId)
                });
            }
        } catch (error: any) {
            toast({
                title: "Rejection Failed",
                description: error.message || "Failed to reject story",
                variant: "destructive",
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Story Reconstruction Management
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4 mb-6">
                    <Button
                        onClick={() => handleRunStoryReconstruction()}
                        disabled={isReconstructing}
                        className="flex items-center gap-2"
                        data-testid="button-run-reconstruction"
                    >
                        {isReconstructing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                        {isReconstructing ? 'Reconstructing...' : 'Run Story Reconstruction'}
                    </Button>

                    {reconstructionResult && (
                        <Badge variant="outline" className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Processed {reconstructionResult.processedOrphans} orphaned facts into {reconstructionResult.newStories?.length || 0} stories
                        </Badge>
                    )}
                </div>

                {reconstructionResult?.newStories && reconstructionResult.newStories.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Reconstructed Story Clusters</h3>
                        {reconstructionResult.newStories.map((story: any, index: number) => (
                            <div
                                key={story.id}
                                className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800"
                                data-testid={`story-cluster-${index}`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-lg mb-2">{story.suggestedTitle || `Story Cluster ${index + 1}`}</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                            {story.suggestedSynopsis || `A story reconstructed from ${story.facts?.length || 0} related facts.`}
                                        </p>
                                        <div className="text-xs text-gray-500 mb-3">
                                            {story.facts?.length || 0} facts • Coherence Score: {(story.coherenceScore * 100).toFixed(1)}%
                                        </div>
                                    </div>
                                    <div className="ml-4 flex flex-col space-y-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleApproveStory(story.id)}
                                            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                            data-testid={`approve-story-${index}`}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-1" />
                                            Approve
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRejectStory(story.id)}
                                            className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                            data-testid={`reject-story-${index}`}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" />
                                            Reject
                                        </Button>
                                    </div>
                                </div>

                                {/* Show facts in this story */}
                                <div className="space-y-2">
                                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Facts in this story:</h5>
                                    {story.facts?.map((fact: any, factIndex: number) => (
                                        <div
                                            key={fact.id}
                                            className="text-xs bg-white dark:bg-slate-700 p-2 rounded border"
                                            data-testid={`fact-${index}-${factIndex}`}
                                        >
                                            {fact.content}
                                        </div>
                                    )) || (
                                            <div className="text-xs text-gray-500">No facts available for this story</div>
                                        )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {reconstructionResult && (!reconstructionResult.newStories || reconstructionResult.newStories.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                        No new story clusters were created. All orphaned facts may already be well-organized.
                    </div>
                )}

                {!reconstructionResult && (
                    <div className="text-center py-8 text-gray-500">
                        Click "Run Story Reconstruction" to analyze orphaned facts and create coherent story clusters.
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
