import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import NeuralMap from './neural-map';

interface EvolutionMetrics {
  totalFacts: number;
  avgQualityScore: number;
  avgImportance: number;
  recentUsageRate: number;
  estimatedClusters: number;
  lastOptimization: string;
  readyForOptimization: boolean;
}

interface EvolutionPanelProps {
  profileId?: string;
}

export default function EvolutionPanel({ profileId }: EvolutionPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [optimizationResults, setOptimizationResults] = useState<any>(null);

  const { data: metrics, isLoading } = useQuery<EvolutionMetrics>({
    queryKey: ['/api/memory/evolution-metrics', profileId],
    enabled: !!profileId,
    refetchInterval: 30000,
  });

  const evolutionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/memory/evolutionary-optimization', {
        profileId,
      });
      return response.json();
    },
    onSuccess: (result) => {
      setOptimizationResults(result);
      toast({
        title: "🧠 Evolution Complete!",
        description: `Knowledge optimized: ${result.summary.originalFacts} → ${result.summary.optimizedFacts} facts`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/evolution-metrics'] });
    },
    onError: (error) => {
      toast({
        title: "Evolution Failed",
        description: "Failed to optimize knowledge base",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 bg-card border border-border rounded-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-48 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  // Debug logging
  console.log('EvolutionPanel Debug:', { profileId, metrics, isLoading });

  const getQualityColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getUsageColor = (rate: number) => {
    if (rate >= 0.3) return 'text-green-400';
    if (rate >= 0.1) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-4">
      {/* Evolution Metrics */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center">
            <i className="fas fa-brain mr-2 text-purple-400"></i>
            Evolutionary Intelligence
          </h3>
          {metrics?.readyForOptimization && (
            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
              Ready for Evolution
            </span>
          )}
        </div>

        {metrics && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-muted/50 rounded p-3">
              <div className="text-sm text-muted-foreground">Total Knowledge</div>
              <div className="text-xl font-bold text-foreground">{metrics.totalFacts}</div>
              <div className="text-xs text-muted-foreground">facts</div>
            </div>

            <div className="bg-muted/50 rounded p-3">
              <div className="text-sm text-muted-foreground">Quality Score</div>
              <div className={`text-xl font-bold ${getQualityColor(metrics.avgQualityScore)}`}>
                {metrics.avgQualityScore}/10
              </div>
              <div className="text-xs text-muted-foreground">average</div>
            </div>

            <div className="bg-muted/50 rounded p-3">
              <div className="text-sm text-muted-foreground">Usage Rate</div>
              <div className={`text-xl font-bold ${getUsageColor(metrics.recentUsageRate)}`}>
                {(metrics.recentUsageRate * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">last 7 days</div>
            </div>

            <div className="bg-muted/50 rounded p-3">
              <div className="text-sm text-muted-foreground">Knowledge Clusters</div>
              <div className="text-xl font-bold text-foreground">{metrics.estimatedClusters}</div>
              <div className="text-xs text-muted-foreground">concept groups</div>
            </div>
          </div>
        )}

        {/* Evolution Button */}
        <button
          onClick={() => evolutionMutation.mutate()}
          disabled={evolutionMutation.isPending || !profileId}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
            evolutionMutation.isPending
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
          }`}
          data-testid="button-evolutionary-optimization"
        >
          {evolutionMutation.isPending ? (
            <div className="flex items-center justify-center">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Evolving Intelligence...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <i className="fas fa-dna mr-2"></i>
              Run Evolutionary Optimization
            </div>
          )}
        </button>

        <div className="mt-2 text-xs text-muted-foreground text-center">
          Advanced AI that discovers relationships, clusters concepts, and optimizes knowledge
        </div>
      </div>

      {/* Evolution Results */}
      {optimizationResults && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
            <i className="fas fa-chart-line mr-2 text-green-400"></i>
            Evolution Results
          </h4>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 bg-muted/50 rounded">
              <div className="text-lg font-bold text-green-400">
                {optimizationResults.summary.relationships}
              </div>
              <div className="text-xs text-muted-foreground">Relationships</div>
            </div>

            <div className="text-center p-2 bg-muted/50 rounded">
              <div className="text-lg font-bold text-blue-400">
                {optimizationResults.summary.clusters}
              </div>
              <div className="text-xs text-muted-foreground">Clusters</div>
            </div>

            <div className="text-center p-2 bg-muted/50 rounded">
              <div className="text-lg font-bold text-purple-400">
                {optimizationResults.summary.knowledgeGaps}
              </div>
              <div className="text-xs text-muted-foreground">Knowledge Gaps</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quality Score:</span>
              <span className={getQualityColor(optimizationResults.summary.qualityImprovement)}>
                {optimizationResults.summary.qualityImprovement.toFixed(1)}/10
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Knowledge Coverage:</span>
              <span className="text-foreground">
                {(optimizationResults.summary.knowledgeCoverage * 100).toFixed(0)}%
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Facts Optimized:</span>
              <span className="text-foreground">
                {optimizationResults.summary.originalFacts} → {optimizationResults.summary.optimizedFacts}
              </span>
            </div>
          </div>

          {optimizationResults.knowledgeGaps && optimizationResults.knowledgeGaps.length > 0 && (
            <div className="mt-4 p-3 bg-muted/30 rounded border-l-4 border-yellow-400">
              <div className="text-sm font-semibold text-foreground mb-2">
                <i className="fas fa-exclamation-triangle mr-1 text-yellow-400"></i>
                Knowledge Gaps Identified
              </div>
              <div className="text-xs text-muted-foreground">
                Found {optimizationResults.knowledgeGaps.length} areas where Nicky's knowledge could be improved.
                Consider asking about: {optimizationResults.knowledgeGaps[0]?.category}
              </div>
            </div>
          )}
        </div>
      )}

      {/* NEURAL MAP VISUALIZATION */}
      {optimizationResults && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
            <i className="fas fa-project-diagram mr-2 text-purple-400"></i>
            Neural Knowledge Map
          </h4>
          
          <div className="mb-3 text-xs text-muted-foreground">
            Interactive visualization of Nicky's optimized brain structure
          </div>

          <NeuralMap
            facts={optimizationResults.optimizedFacts || []}
            relationships={optimizationResults.relationships || []}
            clusters={optimizationResults.clusters || []}
            knowledgeGaps={optimizationResults.knowledgeGaps || []}
            width={550}
            height={350}
          />

          <div className="mt-3 text-xs text-muted-foreground">
            <div className="grid grid-cols-2 gap-2">
              <div>• <strong>Green lines:</strong> Supporting facts</div>
              <div>• <strong>Red lines:</strong> Contradictions</div>
              <div>• <strong>Blue lines:</strong> Enhancing facts</div>
              <div>• <strong>Yellow lines:</strong> Dependencies</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}