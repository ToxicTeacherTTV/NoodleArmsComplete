import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import SystemOperationsSummary from "@/components/system-operations-summary";

interface SystemSettingsProps {
  activeProfile?: any;
}

export default function SystemSettings({ activeProfile }: SystemSettingsProps) {
  // Fetch all the data needed for system status
  const { data: memoryStats } = useQuery({
    queryKey: ['/api/memory/stats'],
    refetchInterval: 120000,
  });

  const { data: chaosState } = useQuery({
    queryKey: ['/api/chaos/state'],
    refetchInterval: 10000,
  });

  const { data: personalityState } = useQuery({
    queryKey: ['/api/personality/state'],
    refetchInterval: 5000,
  });

  const { data: flagsData } = useQuery({
    queryKey: ['/api/flags/pending'],
    enabled: !!activeProfile?.id
  });

  const { data: flagAnalytics } = useQuery({
    queryKey: ['/api/flags/analytics'],
    enabled: !!activeProfile?.id
  });

  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
    refetchInterval: false,
  });

  const { data: timelineHealth } = useQuery({
    queryKey: ['/api/entities/events/timeline-health'],
    refetchInterval: 60000,
  });

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <h2 className="text-xl font-semibold text-foreground">System</h2>
        <p className="text-sm text-muted-foreground">
          Core system configuration and status
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Profile Management */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Management</CardTitle>
            <CardDescription>
              Manage Nicky profiles and switch between different configurations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeProfile ? (
                <div className="p-4 rounded-lg border bg-accent/5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium">{activeProfile.name || 'Default Profile'}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {activeProfile.id}
                      </div>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    <p>Created: {new Date(activeProfile.createdAt || Date.now()).toLocaleDateString()}</p>
                    <p>Memories: {memoryStats?.total?.toLocaleString() || 0}</p>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No active profile found
                </div>
              )}

              <div className="text-xs text-muted-foreground p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <p className="font-medium text-foreground mb-1">💡 Profile System</p>
                <p>Profiles allow you to maintain separate instances of Nicky with different personalities and memories.</p>
                <p className="mt-2">Multi-profile management UI coming soon.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debug & Logging */}
        <Card>
          <CardHeader>
            <CardTitle>Debug & Logging</CardTitle>
            <CardDescription>
              View system logs and configure debug settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="text-sm font-medium">Debug Mode</div>
                  <div className="text-xs text-muted-foreground">
                    Enable verbose logging in console
                  </div>
                </div>
                <Badge variant="outline">Disabled</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="text-sm font-medium">Log Level</div>
                  <div className="text-xs text-muted-foreground">
                    Current logging verbosity
                  </div>
                </div>
                <Badge variant="secondary">Info</Badge>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Recent Console Logs</div>
                <ScrollArea className="h-48 rounded-lg border bg-muted/20 p-3">
                  <div className="font-mono text-xs space-y-1">
                    <div className="text-muted-foreground">
                      Open browser console (F12) to view real-time logs
                    </div>
                  </div>
                </ScrollArea>
              </div>

              <Button variant="outline" size="sm" className="w-full">
                Download Server Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Operations Status */}
        <div>
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
      </div>
    </div>
  );
}
