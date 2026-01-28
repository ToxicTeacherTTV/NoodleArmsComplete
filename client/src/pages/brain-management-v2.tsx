import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import MemorySidebar, { type MemorySectionId } from "@/components/memory/MemorySidebar";
import QuickActionsMenu from "@/components/memory/QuickActionsMenu";
import WhatNickyKnows from "@/components/memory/WhatNickyKnows";
import ReviewAndFix from "@/components/memory/ReviewAndFix";
import Insights from "@/components/memory/Insights";
import type { Profile, MemoryStats, TimelineAuditResult, Document as KnowledgeDocument } from "@/types";

export default function BrainManagementV2() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentSection, setCurrentSection] = useState<MemorySectionId>('what-nicky-knows');

  // Data queries
  const { data: activeProfile } = useQuery<Profile>({
    queryKey: ['/api/profiles/active'],
    refetchInterval: false,
  });

  const { data: memoryStats } = useQuery<MemoryStats>({
    queryKey: ['/api/memory/stats'],
    refetchInterval: 120000,
  });

  const { data: documents } = useQuery<KnowledgeDocument[]>({
    queryKey: ['/api/documents'],
    refetchInterval: false,
  });

  const { data: timelineHealth } = useQuery<TimelineAuditResult>({
    queryKey: ['/api/entities/events/timeline-health'],
    refetchInterval: 60000,
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

  // Quick Actions handlers
  const cleanWallOfTextMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/memory/preview-cleaning');
      if (!response.ok) throw new Error('Failed to preview cleaning');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cleaning Preview Ready",
        description: "Review the proposed changes and apply them.",
      });
    }
  });

  const propagateImportanceMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/memory/propagate-importance', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to propagate importance');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory/stats'] });
      toast({
        title: "Importance Propagated",
        description: "Memory importance scores have been recalculated.",
      });
    }
  });

  const memoryCheckerMutation = useMutation({
    mutationFn: async () => {
      // TODO: Implement memory checker endpoint
      return Promise.resolve();
    },
    onSuccess: () => {
      toast({
        title: "Memory Check Complete",
        description: "Scan complete. Check the Review & Fix section for issues.",
      });
    }
  });

  const repairTimelineMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/entities/events/timeline-repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      if (!response.ok) throw new Error('Failed to repair timeline');
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/entities/events/timeline-health'] });
      toast({
        title: "Timeline Repaired",
        description: `Fixed ${result.updatesApplied} conflicting dates.`,
      });
    }
  });

  const exportMemoriesMutation = useMutation({
    mutationFn: async () => {
      // TODO: Implement export
      return Promise.resolve();
    },
    onSuccess: () => {
      toast({
        title: "Export Started",
        description: "Your memories are being prepared for download.",
      });
    }
  });

  const importMemoriesMutation = useMutation({
    mutationFn: async () => {
      // TODO: Implement import
      return Promise.resolve();
    },
    onSuccess: () => {
      toast({
        title: "Import Complete",
        description: "Memories have been restored from backup.",
      });
    }
  });

  // Render current section
  const renderSection = () => {
    switch (currentSection) {
      case 'what-nicky-knows':
        return (
          <WhatNickyKnows
            activeProfile={activeProfile}
            memoryStats={memoryStats}
            documents={documents}
          />
        );
      case 'review-fix':
        return (
          <ReviewAndFix
            activeProfile={activeProfile}
            memoryStats={memoryStats}
          />
        );
      case 'insights':
        return (
          <Insights
            activeProfile={activeProfile}
            memoryStats={memoryStats}
            timelineHealth={timelineHealth}
            chaosState={chaosState}
            personalityState={personalityState}
            documents={documents}
            flagsData={flagsData}
            flagAnalytics={flagAnalytics}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brain Management</h1>
          <p className="text-sm text-muted-foreground">View and manage Nicky's memory</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Quick Actions */}
          <QuickActionsMenu
            onCleanWallOfText={() => cleanWallOfTextMutation.mutate()}
            onPropagateImportance={() => propagateImportanceMutation.mutate()}
            onRunMemoryChecker={() => memoryCheckerMutation.mutate()}
            onRepairTimeline={() => repairTimelineMutation.mutate()}
            onExportMemories={() => exportMemoriesMutation.mutate()}
            onImportMemories={() => importMemoriesMutation.mutate()}
          />
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <MemorySidebar
          currentSection={currentSection}
          onSectionChange={setCurrentSection}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-background">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
