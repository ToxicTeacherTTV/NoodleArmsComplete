import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PodcastManagementPanel from "@/components/podcast-management-panel";
import ContentLibraryPanel from "@/components/content-library-panel";
import ContentIngestionPanel from "@/components/content-ingestion-panel";

interface ContentPipelineSettingsProps {
  activeProfile?: any;
}

export default function ContentPipelineSettings({ activeProfile }: ContentPipelineSettingsProps) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <h2 className="text-xl font-semibold text-foreground">Content Pipeline</h2>
        <p className="text-sm text-muted-foreground">
          Manage how content flows into Nicky's brain
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Podcast RSS & Episodes */}
        <Card>
          <CardHeader>
            <CardTitle>Podcast Management</CardTitle>
            <CardDescription>
              Configure RSS feeds, sync episodes, and manage podcast content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PodcastManagementPanel activeProfile={activeProfile} />
          </CardContent>
        </Card>

        {/* Content Ingestion */}
        <Card>
          <CardHeader>
            <CardTitle>Content Ingestion</CardTitle>
            <CardDescription>
              Upload and process documents, transcripts, and other content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContentIngestionPanel activeProfile={activeProfile} />
          </CardContent>
        </Card>

        {/* Content Library */}
        <Card>
          <CardHeader>
            <CardTitle>Content Library</CardTitle>
            <CardDescription>
              Manage training examples, documents, and ad content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="training" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="training">Training Examples</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="ads">Ad Content</TabsTrigger>
              </TabsList>

              <TabsContent value="training" className="mt-4">
                <ContentLibraryPanel activeProfile={activeProfile} />
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <div className="text-sm text-muted-foreground text-center py-8">
                  <p>Document library view</p>
                  <p className="text-xs mt-2">Available in Documents tab of "What Nicky Knows" section</p>
                </div>
              </TabsContent>

              <TabsContent value="ads" className="mt-4">
                <div className="text-sm text-muted-foreground text-center py-8">
                  <p>Ad content management</p>
                  <p className="text-xs mt-2">Configure pre-roll ads and sponsorship messages</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Auto-Processing Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Automatic Processing Rules</CardTitle>
            <CardDescription>
              Configure what happens automatically when new content arrives
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="text-sm font-medium">Auto-process podcast episodes</div>
                  <div className="text-xs text-muted-foreground">
                    Automatically extract memories from new episodes
                  </div>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="text-sm font-medium">Auto-extract entities</div>
                  <div className="text-xs text-muted-foreground">
                    Identify people, places, and events automatically
                  </div>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="text-sm font-medium">Generate embeddings</div>
                  <div className="text-xs text-muted-foreground">
                    Create vector embeddings for semantic search
                  </div>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>

              <div className="text-xs text-muted-foreground mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                <p className="font-medium text-foreground mb-1">⚠️ Note</p>
                <p>These settings are currently informational. Auto-processing rules are managed in server configuration.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
