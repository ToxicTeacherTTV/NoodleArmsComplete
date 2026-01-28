import { useState } from "react";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import EmptyState from "./EmptyState";
import MemoryPanel from "@/components/memory-panel";
import DocumentPanel from "@/components/document-panel";
import PodcastManagementPanel from "@/components/podcast-management-panel";

type ViewMode = 'recent' | 'all' | 'entities' | 'documents' | 'podcasts';

interface WhatNickyKnowsProps {
  activeProfile?: any;
  memoryStats?: any;
  documents?: any[];
}

export default function WhatNickyKnows({
  activeProfile,
  memoryStats,
  documents
}: WhatNickyKnowsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="mb-2">
          <h2 className="text-xl font-semibold text-foreground">What Nicky Knows</h2>
          <p className="text-sm text-muted-foreground">
            Browse, search, and explore everything in Nicky's memory
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search memories, entities, documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="default">
            Filters
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="flex-1 flex flex-col">
        <div className="border-b bg-muted/20 px-4">
          <TabsList className="h-auto p-0 bg-transparent">
            <TabsTrigger value="recent" className="px-4 py-2.5">
              Recent
            </TabsTrigger>
            <TabsTrigger value="all" className="px-4 py-2.5">
              All
            </TabsTrigger>
            <TabsTrigger value="entities" className="px-4 py-2.5">
              Entities
            </TabsTrigger>
            <TabsTrigger value="documents" className="px-4 py-2.5">
              Documents
            </TabsTrigger>
            <TabsTrigger value="podcasts" className="px-4 py-2.5">
              Podcasts
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <TabsContent value="recent" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Last 50 memories Nicky learned, newest first
                </p>
              </div>
              {memoryStats && memoryStats.total > 0 ? (
                <MemoryPanel
                  profileId={activeProfile?.id}
                  viewMode="recent"
                  searchQuery={searchQuery}
                />
              ) : (
                <EmptyState
                  icon="📝"
                  title="No memories yet"
                  description={
                    <>
                      <p>Nicky hasn't learned anything recently.</p>
                      <p className="mt-2">
                        Start a conversation or upload a podcast transcript to populate this section.
                      </p>
                    </>
                  }
                  actions={[
                    { label: "Go to Chat", onClick: () => window.location.href = "/" },
                    { label: "Upload Content", onClick: () => setViewMode('documents'), variant: "outline" }
                  ]}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="all" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  All memories in Nicky's brain, paginated and sortable
                </p>
              </div>
              <MemoryPanel
                profileId={activeProfile?.id}
                viewMode="all"
                searchQuery={searchQuery}
              />
            </div>
          </TabsContent>

          <TabsContent value="entities" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  People, places, events, and things Nicky knows about
                </p>
              </div>
              {/* TODO: Build proper entity browser */}
              <EmptyState
                icon="👥"
                title="Entity Browser Coming Soon"
                description="This will show all entities (people, places, events) that Nicky knows about."
              />
            </div>
          </TabsContent>

          <TabsContent value="documents" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Documents uploaded to Nicky's knowledge base
                </p>
              </div>
              {documents && documents.length > 0 ? (
                <DocumentPanel documents={documents} activeProfile={activeProfile} />
              ) : (
                <EmptyState
                  icon="📄"
                  title="No documents uploaded"
                  description={
                    <>
                      <p>Upload documents to expand Nicky's knowledge.</p>
                      <p className="mt-2">
                        Supported formats: PDF, TXT, MD, DOCX
                      </p>
                    </>
                  }
                  actions={[
                    { label: "Upload Document", onClick: () => { /* TODO: Open upload dialog */ } }
                  ]}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="podcasts" className="m-0 h-full">
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Podcast episodes synced and processed
                </p>
              </div>
              <PodcastManagementPanel activeProfile={activeProfile} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
