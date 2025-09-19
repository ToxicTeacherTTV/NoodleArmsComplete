import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Brain, 
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Trash2,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface IntelligenceAnalysis {
  factClusters: FactCluster[];
  sourceReliability: SourceReliability[];
  personalityDrift: PersonalityDrift;
  contextRelevance: ContextRelevance[];
  summary: {
    totalIssues: number;
    highPriority: number;
    mediumPriority: number;
    autoHandled: number;
  };
}

interface FactCluster {
  clusterId: string;
  factIds: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  consolidationScore: number;
  suggestedMerge: string;
  reasoning: string;
}

interface SourceReliability {
  sourceId: string;
  sourceName: string;
  reliabilityScore: number;
  recommendation: 'TRUST' | 'CAUTION' | 'DISTRUST';
  factCount: number;
  accuracyRate: number;
}

interface PersonalityDrift {
  overallDrift: number;
  driftAreas: Array<{
    trait: string;
    originalValue: number;
    currentValue: number;
    drift: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  recommendation: string;
}

interface ContextRelevance {
  memoryId: string;
  content: string;
  relevanceScore: number;
  shouldHide: boolean;
  reasoning: string;
}

const PriorityBadge = ({ priority, score }: { priority: string; score?: number }) => {
  const colors = {
    HIGH: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
    LOW: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
    AUTO: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200'
  };

  const color = colors[priority as keyof typeof colors] || colors.LOW;

  return (
    <Badge className={color} data-testid={`priority-badge-${priority.toLowerCase()}`}>
      {priority} {score && `(${score}%)`}
    </Badge>
  );
};

const TrustAIToggle = ({ 
  enabled, 
  onToggle 
}: { 
  enabled: boolean; 
  onToggle: (enabled: boolean) => void;
}) => {
  return (
    <div className="flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
      <Brain className="h-5 w-5 text-blue-600" />
      <div className="flex-1">
        <div className="font-semibold text-blue-900 dark:text-blue-100">
          Trust AI Mode
        </div>
        <div className="text-sm text-blue-700 dark:text-blue-300">
          Let AI handle low-stakes decisions automatically
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        data-testid="trust-ai-toggle"
      />
    </div>
  );
};

export function IntelligenceDashboard() {
  const [trustAIMode, setTrustAIMode] = useState(false);
  const [selectedMemories, setSelectedMemories] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch intelligence analysis
  const { data: analysis, isLoading, error } = useQuery<IntelligenceAnalysis>({
    queryKey: ['/api/intelligence/analysis'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Bulk operations mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, memoryIds, options }: {
      action: string;
      memoryIds?: string[];
      options?: any;
    }) => {
      return apiRequest('/api/intelligence/bulk-action', 'POST', { 
        action, 
        memoryIds, 
        options, 
        trustAI: trustAIMode 
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Bulk Operation Complete",
        description: data?.message || "Operation completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/intelligence/analysis'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/entries'] });
      setSelectedMemories([]);
    },
    onError: (error: any) => {
      toast({
        title: "Operation Failed",
        description: error.message || "Failed to perform bulk operation",
        variant: "destructive",
      });
    }
  });

  const handleBulkAction = (action: string, memoryIds?: string[]) => {
    bulkActionMutation.mutate({
      action,
      memoryIds: memoryIds || selectedMemories,
    });
  };

  const handleToggleMemory = (memoryId: string) => {
    setSelectedMemories(prev => 
      prev.includes(memoryId)
        ? prev.filter(id => id !== memoryId)
        : [...prev, memoryId]
    );
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Intelligence Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Analyzing memory patterns...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load intelligence analysis: {(error as Error).message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="intelligence-dashboard">
      {/* Header with Trust AI Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Intelligence Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered memory management and optimization
          </p>
        </div>
      </div>

      <TrustAIToggle 
        enabled={trustAIMode} 
        onToggle={setTrustAIMode} 
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-600" data-testid="high-priority-count">
                  {analysis.summary.highPriority}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  High Priority
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-yellow-600" data-testid="medium-priority-count">
                  {analysis.summary.mediumPriority}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Medium Priority
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-600" data-testid="auto-handled-count">
                  {analysis.summary.autoHandled}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Auto-Handled
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-600" data-testid="total-issues-count">
                  {analysis.summary.totalIssues}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Issues
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedMemories.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  {selectedMemories.length} memories selected
                </span>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('hide_irrelevant')}
                  disabled={bulkActionMutation.isPending}
                  data-testid="button-hide-irrelevant"
                >
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Irrelevant
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkAction('delete_selected')}
                  disabled={bulkActionMutation.isPending}
                  data-testid="button-delete-selected"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="clusters" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="clusters" data-testid="tab-clusters">
            Fact Clusters
          </TabsTrigger>
          <TabsTrigger value="sources" data-testid="tab-sources">
            Source Reliability
          </TabsTrigger>
          <TabsTrigger value="drift" data-testid="tab-drift">
            Personality Drift
          </TabsTrigger>
          <TabsTrigger value="relevance" data-testid="tab-relevance">
            Context Relevance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clusters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Fact Clusters
                <Badge variant="outline">
                  {analysis.factClusters.length} clusters found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.factClusters.map((cluster) => (
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
                        {cluster.factIds.length} facts
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
                      {cluster.suggestedMerge}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {cluster.reasoning}
                    </div>
                  </div>

                  <Progress value={cluster.consolidationScore} className="w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Source Reliability Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.sourceReliability.map((source) => (
                <div
                  key={source.sourceId}
                  className="p-4 border rounded-lg"
                  data-testid={`source-${source.sourceId}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium">{source.sourceName}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {source.factCount} facts • {source.accuracyRate}% accuracy
                      </div>
                    </div>
                    <PriorityBadge 
                      priority={source.recommendation} 
                      score={source.reliabilityScore}
                    />
                  </div>
                  <Progress value={source.reliabilityScore} className="w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drift" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Personality Drift Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Overall Drift Score</span>
                  <span className="text-lg font-bold" data-testid="overall-drift-score">
                    {analysis.personalityDrift.overallDrift}%
                  </span>
                </div>
                <Progress value={analysis.personalityDrift.overallDrift} className="w-full" />
              </div>

              <div className="space-y-3">
                {analysis.personalityDrift.driftAreas.map((area, index) => (
                  <div
                    key={area.trait}
                    className="p-3 border rounded-lg"
                    data-testid={`drift-area-${index}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{area.trait}</span>
                      <PriorityBadge priority={area.severity} score={Math.abs(area.drift)} />
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Original: {area.originalValue}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        Current: {area.currentValue}
                      </span>
                      <span className={area.drift > 0 ? 'text-red-600' : 'text-green-600'}>
                        {area.drift > 0 ? '+' : ''}{area.drift}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Alert>
                <Brain className="h-4 w-4" />
                <AlertDescription>
                  {analysis.personalityDrift.recommendation}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relevance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Context Relevance Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.contextRelevance
                .filter(item => item.shouldHide)
                .map((item) => (
                <div
                  key={item.memoryId}
                  className="p-4 border rounded-lg"
                  data-testid={`relevance-${item.memoryId}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-sm mb-2">
                        {item.content.substring(0, 150)}...
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {item.reasoning}
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col items-end space-y-2">
                      <PriorityBadge 
                        priority={item.shouldHide ? 'HIGH' : 'LOW'} 
                        score={item.relevanceScore}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleMemory(item.memoryId)}
                        data-testid={`select-memory-${item.memoryId}`}
                      >
                        {selectedMemories.includes(item.memoryId) ? 'Deselect' : 'Select'}
                      </Button>
                    </div>
                  </div>
                  <Progress value={item.relevanceScore} className="w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}