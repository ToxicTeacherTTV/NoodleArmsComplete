import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EmptyState from "./EmptyState";
import MemoryPanel from "@/components/memory-panel";
import { PoisonControlPanel } from "@/components/poison-control-panel";
import { ProtectedFactsManager } from "@/components/protected-facts-manager";

type ReviewTab = 'by-trust' | 'contradictions' | 'duplicates' | 'flags' | 'protected';

interface ReviewAndFixProps {
  activeProfile?: any;
  memoryStats?: any;
}

export default function ReviewAndFix({ activeProfile, memoryStats }: ReviewAndFixProps) {
  const [activeTab, setActiveTab] = useState<ReviewTab>('by-trust');

  // Fetch issues count
  const { data: contradictions } = useQuery({
    queryKey: ['/api/memory/contradictions'],
    enabled: !!activeProfile?.id
  });

  const { data: flagsData } = useQuery({
    queryKey: ['/api/flags/pending'],
    enabled: !!activeProfile?.id
  });

  const issueCount = {
    contradictions: contradictions?.length || 0,
    duplicates: 0, // TODO: Implement duplicate detection
    lowConfidence: Math.floor((memoryStats?.total || 0) * 0.08), // Estimate 8%
    flags: flagsData?.count || 0
  };

  const totalIssues = issueCount.contradictions + issueCount.duplicates + issueCount.lowConfidence + issueCount.flags;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Review & Fix</h2>
          <p className="text-sm text-muted-foreground">
            Find and fix problematic memories to keep Nicky's brain healthy
          </p>
        </div>

        {/* Overview Card */}
        {totalIssues > 0 ? (
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                {totalIssues} item{totalIssues === 1 ? '' : 's'} need your attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {issueCount.contradictions > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">• {issueCount.contradictions} contradictions</span>
                  <Button size="sm" variant="link" onClick={() => setActiveTab('contradictions')}>
                    Review →
                  </Button>
                </div>
              )}
              {issueCount.duplicates > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">• {issueCount.duplicates} duplicates</span>
                  <Button size="sm" variant="link" onClick={() => setActiveTab('duplicates')}>
                    Review →
                  </Button>
                </div>
              )}
              {issueCount.lowConfidence > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">• {issueCount.lowConfidence} low confidence memories</span>
                  <Button size="sm" variant="link" onClick={() => setActiveTab('by-trust')}>
                    Review →
                  </Button>
                </div>
              )}
              {issueCount.flags > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">• {issueCount.flags} flagged for review</span>
                  <Button size="sm" variant="link" onClick={() => setActiveTab('flags')}>
                    Review →
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CardContent className="pt-6 pb-6 text-center">
              <div className="text-4xl mb-2">✅</div>
              <CardTitle className="text-base mb-2">All Clear!</CardTitle>
              <CardDescription>
                No issues detected in Nicky's memory. Everything looks healthy.
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReviewTab)} className="flex-1 flex flex-col">
        <div className="border-b bg-muted/20 px-4">
          <TabsList className="h-auto p-0 bg-transparent">
            <TabsTrigger value="by-trust" className="px-4 py-2.5">
              By Trust
            </TabsTrigger>
            <TabsTrigger value="contradictions" className="px-4 py-2.5">
              Contradictions
              {issueCount.contradictions > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {issueCount.contradictions}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="px-4 py-2.5">
              Duplicates
            </TabsTrigger>
            <TabsTrigger value="flags" className="px-4 py-2.5">
              Flags
              {issueCount.flags > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {issueCount.flags}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="protected" className="px-4 py-2.5">
              Protected
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <TabsContent value="by-trust" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  View memories organized by confidence level
                </p>
              </div>
              <MemoryPanel
                profileId={activeProfile?.id}
                viewMode="all"
                searchQuery=""
              />
            </div>
          </TabsContent>

          <TabsContent value="contradictions" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Conflicting facts that need resolution
                </p>
              </div>
              {issueCount.contradictions > 0 ? (
                <div className="space-y-4">
                  {/* TODO: Render contradiction groups */}
                  <EmptyState
                    icon="🔥"
                    title="Contradiction Viewer Coming Soon"
                    description="This will show conflicting memories that need your review."
                  />
                </div>
              ) : (
                <EmptyState
                  icon="✅"
                  title="No contradictions found"
                  description={
                    <>
                      <p>All of Nicky's memories are consistent.</p>
                      <p className="mt-2">
                        Contradictions appear when Nicky learns something that conflicts with existing facts.
                      </p>
                    </>
                  }
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="duplicates" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Similar memories that might be duplicates
                </p>
              </div>
              <EmptyState
                icon="✅"
                title="No duplicate memories"
                description={
                  <>
                    <p>Nicky's memories are unique.</p>
                    <p className="mt-2">
                      Duplicates happen when similar facts are learned from different sources.
                      The system usually catches these automatically.
                    </p>
                  </>
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="flags" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Memories flagged by AI or manually for review
                </p>
              </div>
              {/* TODO: Render flags list */}
              <EmptyState
                icon="🚩"
                title="Flag Viewer Coming Soon"
                description="This will show memories that have been flagged for review by the AI or manually."
              />
            </div>
          </TabsContent>

          <TabsContent value="protected" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Core facts locked from automatic changes
                </p>
              </div>
              <ProtectedFactsManager profileId={activeProfile?.id} />
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Poison Control Section */}
      <div className="border-t p-4 bg-muted/10">
        <Card className="border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              ☠️ Poison Control
            </CardTitle>
            <CardDescription>
              Dangerous memories that could harm Nicky's coherence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => {
              // TODO: Open poison control panel
            }}>
              View Quarantine
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
