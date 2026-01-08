import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, Sparkles, Database, LineChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntelligenceAnalysis } from './intelligence/types';
import { TrustAIToggle } from './intelligence/TrustAIToggle';
import { OrphanRepairAction } from './intelligence/OrphanRepairAction';
import { IntelligenceSummaryStats } from './intelligence/IntelligenceSummaryStats';
import { IntelligenceInbox } from './intelligence/IntelligenceInbox';
import { IntelligenceSummaries } from './intelligence/IntelligenceSummaries';
import { FactClusters } from './intelligence/FactClusters';
import { SourceReliabilityList } from './intelligence/SourceReliabilityList';
import { PersonalityDrift } from './intelligence/PersonalityDrift';
import { ContextRelevanceList } from './intelligence/ContextRelevanceList';
import { StoryReconstruction } from './intelligence/StoryReconstruction';

export function IntelligenceDashboard() {
  const [trustAIMode, setTrustAIMode] = useState(false);
  const [selectedMemories, setSelectedMemories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch main intelligence analysis
  const { data: analysis, isLoading } = useQuery<IntelligenceAnalysis>({
    queryKey: ['/api/intelligence/analysis'],
    refetchInterval: 30000,
  });

  const handleToggleMemory = (id: string) => {
    setSelectedMemories(prev =>
      prev.includes(id)
        ? prev.filter(m => m !== id)
        : [...prev, id]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-4 text-lg">Analyzing cognitive state...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Dashboard</h1>
          <p className="text-muted-foreground">Monitor and optimize cognitive performance and memory integrity</p>
        </div>
        <TrustAIToggle
          enabled={trustAIMode}
          onToggle={setTrustAIMode}
        />
      </div>

      {/* Critical Actions */}
      <div className="grid gap-6">
        <OrphanRepairAction />
        <IntelligenceSummaryStats analysis={analysis} />
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7 h-auto p-1 bg-muted/50 gap-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Brain className="h-4 w-4" />
            <span className="hidden md:inline">Inbox</span>
          </TabsTrigger>
          <TabsTrigger value="summaries" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Sparkles className="h-4 w-4" />
            <span className="hidden md:inline">Summaries</span>
          </TabsTrigger>
          <TabsTrigger value="clusters" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Database className="h-4 w-4" />
            <span className="hidden md:inline">Clusters</span>
          </TabsTrigger>
          <TabsTrigger value="sources" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LineChart className="h-4 w-4" />
            <span className="hidden md:inline">Sources</span>
          </TabsTrigger>
          <TabsTrigger value="drift" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <span className="hidden md:inline">Drift</span>
          </TabsTrigger>
          <TabsTrigger value="relevance" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <span className="hidden md:inline">Relevance</span>
          </TabsTrigger>
          <TabsTrigger value="reconstruction" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <span className="hidden md:inline">Design</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 animate-in fade-in-50 duration-300">
          <IntelligenceInbox />
        </TabsContent>

        <TabsContent value="summaries" className="space-y-4 animate-in fade-in-50 duration-300">
          <IntelligenceSummaries trustAIMode={trustAIMode} />
        </TabsContent>

        <TabsContent value="clusters" className="space-y-4 animate-in fade-in-50 duration-300">
          <FactClusters
            clusters={analysis?.factClusters || []}
            trustAIMode={trustAIMode}
          />
        </TabsContent>

        <TabsContent value="sources" className="space-y-4 animate-in fade-in-50 duration-300">
          <SourceReliabilityList sources={analysis?.sourceReliability || []} />
        </TabsContent>

        <TabsContent value="drift" className="space-y-4 animate-in fade-in-50 duration-300">
          <PersonalityDrift drift={analysis?.personalityDrift || []} />
        </TabsContent>

        <TabsContent value="relevance" className="space-y-4 animate-in fade-in-50 duration-300">
          <ContextRelevanceList
            items={analysis?.contextRelevance || []}
            selectedMemories={selectedMemories}
            onToggleMemory={handleToggleMemory}
          />
        </TabsContent>

        <TabsContent value="reconstruction" className="space-y-4 animate-in fade-in-50 duration-300">
          <StoryReconstruction />
        </TabsContent>
      </Tabs>
    </div>
  );
}