import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, CheckCircle, XCircle, ExternalLink, Clock, Zap, FileText, AlertTriangle, ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AutomatedSource {
  id: string;
  profileId: string;
  sourceType: string;
  sourceUrl: string;
  isActive: boolean;
  confidenceMultiplier: string;
  lastProcessedAt: string | null;
  collectionSchedule: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

interface PendingContentItem {
  id: string;
  sourceId: string;
  profileId: string;
  rawContent: string;
  title: string;
  sourceUrl: string;
  metadata: Record<string, any>;
  isProcessed: boolean;
  isApproved: boolean;
  rejectionReason: string | null;
  createdAt: string;
}

interface ContentIngestionPanelProps {
  profileId?: string;
}

export default function ContentIngestionPanel({ profileId }: ContentIngestionPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("sources");
  const [selectedContent, setSelectedContent] = useState<PendingContentItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  if (!profileId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No active profile selected. Please select or create a profile first.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Queries
  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['/api/ingestion/sources', profileId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ingestion/sources/${profileId}`);
      const data = await response.json();
      return data.data as AutomatedSource[];
    },
    refetchInterval: false,
  });

  const { data: pendingContent = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['/api/ingestion/pending', profileId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ingestion/pending/${profileId}?processed=false`);
      const data = await response.json();
      return data.data as PendingContentItem[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: processedContent = [] } = useQuery({
    queryKey: ['/api/ingestion/processed', profileId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ingestion/pending/${profileId}?processed=true`);
      const data = await response.json();
      return data.data as PendingContentItem[];
    },
    enabled: selectedTab === "processed",
    refetchInterval: false,
  });

  // Mutations
  const toggleSourceMutation = useMutation({
    mutationFn: async ({ sourceId, isActive }: { sourceId: string; isActive: boolean }) => {
      const response = await apiRequest('PATCH', `/api/ingestion/sources/${sourceId}/toggle`, {
        isActive
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingestion/sources', profileId] });
      toast({
        title: "Source Updated",
        description: "Automated source has been toggled successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update source status.",
        variant: "destructive",
      });
    },
  });

  const manualCollectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/ingestion/collect/${profileId}`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingestion/pending', profileId] });
      toast({
        title: "Collection Complete",
        description: `Collected ${data.totalCollected} new items from ${data.reddit || 0} Reddit posts and ${data.steam || 0} Steam announcements.`,
      });
    },
    onError: () => {
      toast({
        title: "Collection Failed",
        description: "Failed to collect new content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const approveContentMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const response = await apiRequest('POST', `/api/ingestion/pending/${contentId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingestion/pending', profileId] });
      toast({
        title: "Content Approved",
        description: "Content has been processed and added to memory.",
      });
    },
    onError: () => {
      toast({
        title: "Approval Failed",
        description: "Failed to approve content.",
        variant: "destructive",
      });
    },
  });

  const rejectContentMutation = useMutation({
    mutationFn: async ({ contentId, reason }: { contentId: string; reason: string }) => {
      const response = await apiRequest('POST', `/api/ingestion/pending/${contentId}/reject`, {
        reason
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingestion/pending', profileId] });
      setIsRejectDialogOpen(false);
      setSelectedContent(null);
      setRejectionReason("");
      toast({
        title: "Content Rejected",
        description: "Content has been marked as rejected.",
      });
    },
    onError: () => {
      toast({
        title: "Rejection Failed",
        description: "Failed to reject content.",
        variant: "destructive",
      });
    },
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Less than 1 hour ago";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  const getSourceTypeIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'reddit': return '📱';
      case 'steam': return '🎮';
      default: return '🔗';
    }
  };

  const getSourceTypeName = (sourceType: string) => {
    switch (sourceType) {
      case 'reddit': return 'Reddit';
      case 'steam': return 'Steam News';
      default: return sourceType.charAt(0).toUpperCase() + sourceType.slice(1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Manual Collection */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content Ingestion</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Manage automated content collection for keeping Nicky's knowledge current
          </p>
        </div>
        <Button
          onClick={() => manualCollectionMutation.mutate()}
          disabled={manualCollectionMutation.isPending}
          className="ml-4"
          data-testid="button-manual-collect"
        >
          {manualCollectionMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Collecting...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Collect Now
            </>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Sources</p>
                <p className="text-2xl font-bold">{sources.filter(s => s.isActive).length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold">{pendingContent.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sources</p>
                <p className="text-2xl font-bold">{sources.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <ExternalLink className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processed Today</p>
                <p className="text-2xl font-bold">
                  {processedContent.filter(c => 
                    new Date(c.createdAt).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sources" data-testid="tab-sources">
            📡 Sources ({sources.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            ⏳ Pending Review ({pendingContent.length})
          </TabsTrigger>
          <TabsTrigger value="processed" data-testid="tab-processed">
            ✅ Processed
          </TabsTrigger>
        </TabsList>

        {/* Sources Tab */}
        <TabsContent value="sources" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated Sources</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Configure and manage your automated content collection sources
              </p>
            </CardHeader>
            <CardContent>
              {sourcesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading sources...
                </div>
              ) : sources.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No automated sources configured yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl">{getSourceTypeIcon(source.sourceType)}</div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium">{getSourceTypeName(source.sourceType)}</h3>
                            <Badge variant={source.isActive ? "default" : "secondary"}>
                              {source.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {source.sourceUrl}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                            <span>Schedule: {source.collectionSchedule}</span>
                            <span>Confidence: {Math.round(parseFloat(source.confidenceMultiplier) * 100)}%</span>
                            {source.lastProcessedAt && (
                              <span>Last run: {formatTimeAgo(source.lastProcessedAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <Switch
                          checked={source.isActive}
                          onCheckedChange={(checked) => 
                            toggleSourceMutation.mutate({ sourceId: source.id, isActive: checked })
                          }
                          disabled={toggleSourceMutation.isPending}
                          data-testid={`switch-source-${source.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Review Tab */}
        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Content Review</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Review and approve content before it's added to Nicky's knowledge base
              </p>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading pending content...
                </div>
              ) : pendingContent.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No content pending review.
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {pendingContent.map((item) => (
                      <div
                        key={item.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant="outline">{getSourceTypeName(item.sourceId.includes('reddit') ? 'reddit' : 'steam')}</Badge>
                              <span className="text-xs text-gray-500">
                                {formatTimeAgo(item.createdAt)}
                              </span>
                            </div>
                            <h4 className="font-medium mb-2">{item.title}</h4>
                            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 max-h-32 overflow-y-auto">
                              {item.rawContent.substring(0, 300)}
                              {item.rawContent.length > 300 && "..."}
                            </div>
                            {item.metadata && (
                              <div className="text-xs text-gray-500 space-x-2">
                                {item.metadata.upvotes && <span>👍 {item.metadata.upvotes}</span>}
                                {item.metadata.author && <span>👤 {item.metadata.author}</span>}
                                {item.metadata.subreddit && <span>📱 {item.metadata.subreddit}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(item.sourceUrl, '_blank')}
                            data-testid={`button-view-${item.id}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Source
                          </Button>
                          
                          <div className="flex space-x-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedContent(item);
                                setIsRejectDialogOpen(true);
                              }}
                              disabled={rejectContentMutation.isPending && rejectContentMutation.variables?.contentId === item.id}
                              data-testid={`button-reject-${item.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                            
                            <Button
                              size="sm"
                              onClick={() => approveContentMutation.mutate(item.id)}
                              disabled={approveContentMutation.isPending && approveContentMutation.variables === item.id}
                              data-testid={`button-approve-${item.id}`}
                            >
                              <ThumbsUp className="h-4 w-4 mr-2" />
                              Approve & Process
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processed Tab */}
        <TabsContent value="processed" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Processed Content</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Recently processed content from automated sources
              </p>
            </CardHeader>
            <CardContent>
              {processedContent.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No processed content yet.
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {processedContent.slice(0, 20).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant={item.isApproved ? "default" : "destructive"}>
                              {item.isApproved ? "Approved" : "Rejected"}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {formatTimeAgo(item.createdAt)}
                            </span>
                          </div>
                          <h4 className="font-medium text-sm">{item.title}</h4>
                          {item.rejectionReason && (
                            <p className="text-xs text-red-600 mt-1">
                              Rejection reason: {item.rejectionReason}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(item.sourceUrl, '_blank')}
                          data-testid={`button-view-processed-${item.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Content Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Content</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this content. This helps improve future content filtering.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Content:</h4>
              <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded border max-h-32 overflow-y-auto">
                {selectedContent?.rawContent}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium">Rejection Reason</label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Off-topic, Low quality, Irrelevant to Nicky's character..."
                className="mt-1"
                data-testid="textarea-rejection-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setSelectedContent(null);
                setRejectionReason("");
              }}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedContent && rejectionReason.trim()) {
                  rejectContentMutation.mutate({
                    contentId: selectedContent.id,
                    reason: rejectionReason.trim()
                  });
                }
              }}
              disabled={!rejectionReason.trim() || rejectContentMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectContentMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <ThumbsDown className="h-4 w-4 mr-2" />
                  Confirm Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}