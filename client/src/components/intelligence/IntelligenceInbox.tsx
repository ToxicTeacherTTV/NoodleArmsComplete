import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, CheckCircle, TrendingUp, Target, AlertTriangle, Check, Trash2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export const IntelligenceInbox = () => {
    const { toast } = useToast();

    // Fetch memory suggestions
    const { data: suggestions, isLoading: suggestionsLoading } = useQuery<any[]>({
        queryKey: ['/api/memory/suggestions'],
        refetchInterval: 30000,
    });

    const approveSuggestionMutation = useMutation({
        mutationFn: async (id: number) => {
            return apiRequest('POST', `/api/memory/suggestions/${id}/approve`);
        },
        onSuccess: () => {
            toast({
                title: "Suggestion Approved",
                description: "The memory has been updated.",
            });
            queryClient.invalidateQueries({ queryKey: ['/api/memory/suggestions'] });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to approve suggestion",
                variant: "destructive",
            });
        },
    });

    const rejectSuggestionMutation = useMutation({
        mutationFn: async (id: number) => {
            return apiRequest('POST', `/api/memory/suggestions/${id}/reject`);
        },
        onSuccess: () => {
            toast({
                title: "Suggestion Rejected",
                description: "The suggestion has been discarded.",
            });
            queryClient.invalidateQueries({ queryKey: ['/api/memory/suggestions'] });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to reject suggestion",
                variant: "destructive",
            });
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Memory Suggestions
                </CardTitle>
            </CardHeader>
            <CardContent>
                {suggestionsLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : suggestions?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p>No pending suggestions. All caught up!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {suggestions?.map((suggestion) => (
                            <Card key={suggestion.id} className="border-l-4 border-l-yellow-500">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">{suggestion.triggerType}</Badge>
                                                <span className="text-sm text-muted-foreground">
                                                    Memory #{suggestion.memoryId.substring(0, 8)}...
                                                </span>
                                            </div>

                                            <div className="bg-muted/50 p-3 rounded-md text-sm italic">
                                                "{suggestion.memory?.content || "Content unavailable"}"
                                            </div>

                                            <div className="flex items-center gap-4 text-sm">
                                                {suggestion.suggestedAction === 'BOOST_IMPORTANCE' && (
                                                    <div className="flex items-center gap-1">
                                                        <TrendingUp className="h-4 w-4 text-green-500" />
                                                        <span>Boost Importance: {suggestion.memory?.importance || 0} → {suggestion.suggestedValue.importance}</span>
                                                    </div>
                                                )}
                                                {suggestion.suggestedAction === 'ADD_TAG' && (
                                                    <div className="flex items-center gap-1">
                                                        <Target className="h-4 w-4 text-blue-500" />
                                                        <span>Add Tag: <Badge variant="secondary">{suggestion.suggestedValue.tag}</Badge></span>
                                                    </div>
                                                )}
                                                {suggestion.suggestedAction === 'FLAG_FOR_TRAINING' && (
                                                    <div className="flex items-center gap-1">
                                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                                        <span>Flag for Training</span>
                                                    </div>
                                                )}
                                            </div>

                                            <p className="text-sm text-muted-foreground">
                                                Trigger: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{suggestion.triggerValue}</span>
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => approveSuggestionMutation.mutate(suggestion.id)}
                                                disabled={approveSuggestionMutation.isPending}
                                            >
                                                <Check className="h-4 w-4 mr-1" />
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => rejectSuggestionMutation.mutate(suggestion.id)}
                                                disabled={rejectSuggestionMutation.isPending}
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" />
                                                Reject
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
