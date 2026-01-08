import { useMutation } from '@tanstack/react-query';
import { Link, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export const OrphanRepairAction = () => {
    const { toast } = useToast();

    const repairOrphansMutation = useMutation({
        mutationFn: async () => {
            return apiRequest('POST', '/api/intelligence/repair-orphans');
        },
        onSuccess: (data: any) => {
            toast({
                title: "Orphan Facts Repaired!",
                description: data?.message || "Successfully repaired orphaned facts",
            });
            queryClient.invalidateQueries({ queryKey: ['/api/intelligence/analysis'] });
            queryClient.invalidateQueries({ queryKey: ['/api/intelligence/summaries'] });
            queryClient.invalidateQueries({ queryKey: ['/api/memory/entries'] });
            queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
        },
        onError: (error: any) => {
            toast({
                title: "Repair Failed",
                description: error.message || "Failed to repair orphaned facts",
                variant: "destructive"
            });
        },
    });

    return (
        <div className="flex items-center space-x-2 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
            <Link className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
                <div className="font-semibold text-orange-900 dark:text-orange-100">
                    Orphaned Facts Detected
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">
                    Some facts have been cut off from their original stories and lost context
                </div>
            </div>
            <Button
                onClick={() => repairOrphansMutation.mutate()}
                disabled={repairOrphansMutation.isPending}
                variant="outline"
                size="sm"
                data-testid="repair-orphan-facts-button"
                className="bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300"
            >
                {repairOrphansMutation.isPending ? (
                    <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Repairing...
                    </>
                ) : (
                    <>
                        <Wrench className="h-4 w-4 mr-2" />
                        Repair Facts
                    </>
                )}
            </Button>
        </div>
    );
};
