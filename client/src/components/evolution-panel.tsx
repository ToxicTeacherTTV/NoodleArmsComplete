import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import NeuralMap from './neural-map';
import { Check, Save, ListTodo, HelpCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    queryFn: async () => {
      const response = await fetch(`/api/memory/evolution-metrics?profileId=${profileId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch evolution metrics');
      }
      return response.json();
    },
    enabled: !!profileId,
    refetchInterval: 120000, // Reduced from 30s to 2min to reduce flickering
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
        title: "🧠 Evolution Analysis Complete!",
        description: `Found ${result.knowledgeGaps.length} knowledge gaps and optimized ${result.summary.originalFacts} facts. Review below.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Evolution Analysis Failed",
        description: "Failed to analyze knowledge base",
        variant: "destructive",
      });
    },
  });

  const applyEvolutionMutation = useMutation({
    mutationFn: async () => {
      if (!optimizationResults) return;
      const response = await apiRequest('POST', '/api/memory/apply-evolution', {
        profileId,
        optimizedFacts: optimizationResults.optimizedFacts
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Evolution Applied!",
        description: `Brain updated with ${data.count} optimized memories.`,
      });
      setOptimizationResults(null); // Clear results after applying
      queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/evolution-metrics'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply evolution changes",
        variant: "destructive",
      });
    }
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

  // Debug logging removed for production

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

        {metrics && metrics.totalFacts !== undefined && (
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
              : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/20'
          }`}
          data-testid="button-evolutionary-optimization"
        >
          {evolutionMutation.isPending ? (
            <div className="flex items-center justify-center">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Analyzing Brain Structure...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <i className="fas fa-dna mr-2"></i>
              Run Evolutionary Analysis
            </div>
          )}
        </button>

        <div className="mt-2 text-xs text-muted-foreground text-center">
          Analyzes knowledge gaps, clusters concepts, and prepares optimization. 
          <br/><strong>Does not auto-save.</strong> You can review changes first.
        </div>
      </div>

      {/* Evolution Results */}
      {optimizationResults && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* 1. Knowledge Gaps (To-Do List) */}
          {optimizationResults.knowledgeGaps && optimizationResults.knowledgeGaps.length > 0 && (
            <Card className="border-l-4 border-l-yellow-500 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center text-yellow-500">
                  <ListTodo className="mr-2 h-5 w-5" />
                  Knowledge Gaps (To-Do List)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-4">
                  Ask Nicky these questions to fill missing spots in his brain:
                </div>
                <ScrollArea className="h-[200px] pr-4">
                  <div className="space-y-4">
                    {optimizationResults.knowledgeGaps.map((gap: any, idx: number) => (
                      <div key={idx} className="bg-muted/30 p-3 rounded-lg border border-border">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-foreground text-sm">{gap.category}</span>
                          <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full">
                            Priority {gap.priority}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{gap.description}</p>
                        <div className="space-y-1">
                          {gap.suggestedQuestions.map((q: string, qIdx: number) => (
                            <div key={qIdx} className="flex items-center text-sm text-foreground bg-background/50 p-2 rounded">
                              <HelpCircle className="h-3 w-3 mr-2 text-purple-400" />
                              {q}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* 2. Optimization Summary & Apply */}
          <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center text-green-500">
                <Save className="mr-2 h-5 w-5" />
                Review & Apply Changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">
                    {optimizationResults.summary.relationships}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">New Connections</div>
                </div>

                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">
                    {optimizationResults.summary.clusters}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Topic Clusters</div>
                </div>

                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">
                    {optimizationResults.summary.originalFacts - optimizationResults.summary.optimizedFacts}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Facts Merged</div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg mb-4">
                <div className="text-sm">
                  <div className="font-medium text-foreground">Ready to upgrade brain?</div>
                  <div className="text-muted-foreground text-xs">
                    This will replace {optimizationResults.summary.originalFacts} raw facts with {optimizationResults.summary.optimizedFacts} optimized memories.
                  </div>
                </div>
                <Button 
                  onClick={() => applyEvolutionMutation.mutate()}
                  disabled={applyEvolutionMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {applyEvolutionMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Apply Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
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