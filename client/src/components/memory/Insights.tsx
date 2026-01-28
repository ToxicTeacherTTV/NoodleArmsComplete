import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MemoryAnalytics } from "@/components/memory-analytics";
import { IntelligenceDashboard } from "@/components/intelligence-dashboard";
import SystemOperationsSummary from "@/components/system-operations-summary";

type InsightTab = 'overview' | 'analytics' | 'intelligence' | 'timeline' | 'system';

interface InsightsProps {
  activeProfile?: any;
  memoryStats?: any;
  timelineHealth?: any;
  chaosState?: any;
  personalityState?: any;
  documents?: any[];
  flagsData?: any;
  flagAnalytics?: any;
}

export default function Insights({ activeProfile, memoryStats, timelineHealth, chaosState, personalityState, documents, flagsData, flagAnalytics }: InsightsProps) {
  const [activeTab, setActiveTab] = useState<InsightTab>('overview');

  // Calculate quality score (simplified)
  const qualityScore = memoryStats && memoryStats.total > 0 ? Math.min(100, Math.round(
    (memoryStats.highConfidence / memoryStats.total) * 100
  )) : 0;

  const confidenceDistribution = memoryStats && memoryStats.total > 0 ? {
    high: Math.round((memoryStats.highConfidence / memoryStats.total) * 100),
    medium: Math.round((memoryStats.mediumConfidence / memoryStats.total) * 100),
    low: Math.round((memoryStats.lowConfidence / memoryStats.total) * 100)
  } : { high: 0, medium: 0, low: 0 };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Insights</h2>
          <p className="text-sm text-muted-foreground">
            Understand memory health, patterns, and system performance
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InsightTab)} className="flex-1 flex flex-col">
        <div className="border-b bg-muted/20 px-4">
          <TabsList className="h-auto p-0 bg-transparent">
            <TabsTrigger value="overview" className="px-4 py-2.5">
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="px-4 py-2.5">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="px-4 py-2.5">
              Intelligence
            </TabsTrigger>
            <TabsTrigger value="timeline" className="px-4 py-2.5">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="system" className="px-4 py-2.5">
              System Status
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <TabsContent value="overview" className="m-0 h-full">
            <div className="p-4 space-y-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Memory health at a glance
                </p>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Total Memories */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Total Memories</CardDescription>
                    <CardTitle className="text-3xl">{(memoryStats?.total ?? 0).toLocaleString()}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Facts, stories, and knowledge in Nicky's brain
                    </p>
                  </CardContent>
                </Card>

                {/* Quality Score */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Quality Score</CardDescription>
                    <CardTitle className="text-3xl flex items-baseline gap-2">
                      {qualityScore}
                      <span className="text-base text-muted-foreground">/100</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={qualityScore} className="h-2 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {qualityScore >= 80 ? 'Excellent' : qualityScore >= 60 ? 'Good' : 'Needs Improvement'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Confidence Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Confidence Distribution</CardTitle>
                  <CardDescription>
                    How confident Nicky is about his memories
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-green-600">High</Badge>
                        <span className="text-muted-foreground">{memoryStats?.highConfidence || 0} memories</span>
                      </div>
                      <span className="font-medium">{confidenceDistribution.high}%</span>
                    </div>
                    <Progress value={confidenceDistribution.high} className="h-2 bg-green-100 dark:bg-green-950" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-yellow-600">Medium</Badge>
                        <span className="text-muted-foreground">{memoryStats?.mediumConfidence || 0} memories</span>
                      </div>
                      <span className="font-medium">{confidenceDistribution.medium}%</span>
                    </div>
                    <Progress value={confidenceDistribution.medium} className="h-2 bg-yellow-100 dark:bg-yellow-950" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="bg-red-600">Low</Badge>
                        <span className="text-muted-foreground">{memoryStats?.lowConfidence || 0} memories</span>
                      </div>
                      <span className="font-medium">{confidenceDistribution.low}%</span>
                    </div>
                    <Progress value={confidenceDistribution.low} className="h-2 bg-red-100 dark:bg-red-950" />
                  </div>
                </CardContent>
              </Card>

              {/* Timeline Health */}
              {timelineHealth && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Timeline Health</span>
                      <Badge variant={timelineHealth.score >= 95 ? "default" : "secondary"}>
                        {timelineHealth.score}/100
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Event date consistency across memories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {timelineHealth.score >= 95 ? (
                      <p className="text-sm text-muted-foreground">
                        ✓ All event dates are consistent. No conflicts detected.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        ⚠️ {timelineHealth.issues || 0} date conflicts detected. Consider running timeline repair.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tips */}
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">💡 Health Tips</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>• Aim for a quality score above 80</p>
                  <p>• Keep high confidence memories above 60%</p>
                  <p>• Review contradictions weekly</p>
                  <p>• Run memory checker monthly</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Detailed charts and metrics
                </p>
              </div>
              <MemoryAnalytics profileId={activeProfile?.id} />
            </div>
          </TabsContent>

          <TabsContent value="intelligence" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  AI-driven insights and patterns
                </p>
              </div>
              <IntelligenceDashboard profileId={activeProfile?.id} />
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Event timeline consistency and conflicts
                </p>
              </div>
              {timelineHealth && timelineHealth.score >= 95 ? (
                <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                  <CardContent className="pt-6 text-center">
                    <div className="text-4xl mb-2">✅</div>
                    <CardTitle className="text-base mb-2">
                      Timeline Health: {timelineHealth.score}/100
                    </CardTitle>
                    <CardDescription>
                      All event dates are consistent. No conflicts detected in Nicky's timeline of memories.
                    </CardDescription>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                  <CardContent className="pt-6 text-center">
                    <div className="text-4xl mb-2">⚠️</div>
                    <CardTitle className="text-base mb-2">
                      Timeline Health: {timelineHealth?.score || 0}/100
                    </CardTitle>
                    <CardDescription className="mb-4">
                      {timelineHealth?.issues || 0} date conflicts detected that need resolution.
                    </CardDescription>
                    {/* TODO: Add repair timeline button */}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="system" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Background operations and system health
                </p>
              </div>
              <SystemOperationsSummary
                memoryStats={memoryStats}
                flagsData={flagsData}
                flagAnalytics={flagAnalytics}
                documents={documents}
                chaosState={chaosState}
                personalityState={personalityState}
                timelineHealth={timelineHealth}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
