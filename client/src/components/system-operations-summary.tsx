import { AlertTriangle, BookOpen, Brain, CalendarClock, Flame, Sparkles, Workflow } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ChaosState, Document, MemoryStats, PersonalityState, TimelineAuditResult } from '@/types';

type DocumentsByStatus = Record<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED', number>;

interface SystemOperationsSummaryProps {
  memoryStats?: MemoryStats;
  flagsData?: { count: number } | null;
  flagAnalytics?: {
    overview?: {
      totalFlags?: number;
      pendingFlags?: number;
      approvedFlags?: number;
      rejectedFlags?: number;
    };
    topFlagTypes?: Array<{ flagType: string; count: number }>;
  } | null;
  documents?: Document[];
  chaosState?: ChaosState | null;
  personalityState?: PersonalityState | null;
  timelineHealth?: TimelineAuditResult | null;
  onRequestTimelineRepair?: () => void;
  timelineRepairPending?: boolean;
}

function getDocumentsByStatus(documents: Document[] = []): DocumentsByStatus {
  return documents.reduce<DocumentsByStatus>((acc, doc) => {
    const status = (doc.processingStatus ?? 'PENDING') as keyof DocumentsByStatus;
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 });
}

export default function SystemOperationsSummary({
  memoryStats,
  flagsData,
  flagAnalytics,
  documents,
  chaosState,
  personalityState,
  timelineHealth,
  onRequestTimelineRepair,
  timelineRepairPending,
}: SystemOperationsSummaryProps) {
  const docsByStatus = getDocumentsByStatus(documents);
  const documentBacklog = docsByStatus.PENDING + docsByStatus.PROCESSING;
  const failedDocuments = docsByStatus.FAILED;
  const completedDocuments = docsByStatus.COMPLETED;

  const totalFlags = flagAnalytics?.overview?.totalFlags ?? flagsData?.count ?? 0;
  const pendingFlags = flagAnalytics?.overview?.pendingFlags ?? flagsData?.count ?? 0;
  const approvedFlags = flagAnalytics?.overview?.approvedFlags ?? 0;
  const rejectedFlags = flagAnalytics?.overview?.rejectedFlags ?? 0;
  const resolvedFlags = approvedFlags + rejectedFlags;
  const resolutionRate = totalFlags > 0 ? Math.round((resolvedFlags / totalFlags) * 100) : 0;
  const topFlagCategory = flagAnalytics?.topFlagTypes?.[0];

  const effectiveChaos = chaosState?.effectiveLevel ?? chaosState?.level ?? 0;
  const manualOverrideActive = typeof chaosState?.manualOverride === 'number';
  const chaosPresetSuggestion = personalityState?.chaosInfluence?.suggestedPreset
    ?? personalityState?.chaosInfluence?.presetSuggestion;
  const chaosSpiceCap = personalityState?.chaosInfluence?.spiceCap;

  const currentPreset = personalityState?.effectivePersonality.preset ?? 'Unknown';
  const currentIntensity = personalityState?.effectivePersonality.intensity?.toUpperCase?.() ?? '—';
  const currentSpice = personalityState?.effectivePersonality.spice ?? 'normal';
  const basePreset = personalityState?.basePersonality.preset ?? 'Unknown';
  const baseIntensity = personalityState?.basePersonality.intensity?.toUpperCase?.() ?? '—';
  const baseSpice = personalityState?.basePersonality.spice ?? 'normal';
  const baseDbDLens = personalityState?.basePersonality.dbd_lens;
  const timelineIssues = timelineHealth?.flaggedMemories.length ?? 0;
  const timelineRunAt = timelineHealth?.runAt ? new Date(timelineHealth.runAt).toLocaleString() : null;
  const orientationSummary = timelineHealth?.orientationSummary;

  const factsPerConversation = memoryStats?.conversations
    ? (memoryStats.totalFacts / memoryStats.conversations).toFixed(1)
    : '—';

  const actionItems: string[] = [];

  if (pendingFlags > 0) {
    actionItems.push(`Review ${pendingFlags} pending flag${pendingFlags === 1 ? '' : 's'} to keep safety tight.`);
  }

  if (documentBacklog > 0) {
    actionItems.push(`Resume ingestion on ${documentBacklog} document${documentBacklog === 1 ? '' : 's'} still processing.`);
  }

  if (failedDocuments > 0) {
    actionItems.push(`Investigate ${failedDocuments} failed document${failedDocuments === 1 ? '' : 's'} for retry.`);
  }

  if (manualOverrideActive) {
    actionItems.push('Manual chaos override armed for the next response.');
  }

  if (personalityState?.chaosInfluence) {
    const pieces = [personalityState.chaosInfluence.reason];
    if (chaosPresetSuggestion) {
      pieces.push(`suggests ${chaosPresetSuggestion}`);
    }
    if (chaosSpiceCap) {
      pieces.push(`caps spice at ${chaosSpiceCap}`);
    }
    actionItems.push(`Chaos influence active: ${pieces.join(', ')}.`);
  }

  if (timelineIssues > 0) {
    actionItems.push(`Timeline audit flagged ${timelineIssues} event fact${timelineIssues === 1 ? '' : 's'} for review.`);
  }

  if (actionItems.length === 0) {
    actionItems.push('All systems nominal. Keep ingesting high-signal clips.');
  }

  return (
    <Card className="mb-8" data-testid="system-operations-summary">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Operational Overview</h2>
            <p className="text-sm text-muted-foreground">Quick pulse on safety, knowledge, and ingestion pipelines.</p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            Live data
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Brain className="h-4 w-4" /> Personality & Chaos
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-semibold">{currentPreset}</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Intensity {currentIntensity}</Badge>
                <Badge variant="secondary">Spice {currentSpice === 'platform_safe' ? 'SAFE' : currentSpice.toUpperCase()}</Badge>
                <Badge variant="outline">Chaos {Math.round(effectiveChaos)}%</Badge>
              </div>
              {chaosState?.mode && (
                <p className="text-xs text-muted-foreground">
                  Mode: {chaosState.mode.replace(/_/g, ' ').toLowerCase()}
                </p>
              )}
              <div className="rounded border border-border/60 bg-background/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
                <div className="font-medium text-foreground text-xs mb-1">Baseline</div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Preset {basePreset}</Badge>
                  <Badge variant="outline">Intensity {baseIntensity}</Badge>
                  <Badge variant="outline">Spice {baseSpice === 'platform_safe' ? 'SAFE' : baseSpice.toUpperCase()}</Badge>
                  <Badge variant={baseDbDLens ? 'secondary' : 'outline'}>DbD Lens {baseDbDLens ? 'ON' : 'OFF'}</Badge>
                </div>
              </div>
              {personalityState?.chaosInfluence && (
                <div className="rounded border border-dashed border-amber-300/70 bg-amber-50/70 dark:bg-amber-950/20 p-2 text-[11px] leading-relaxed">
                  <div className="flex items-center gap-1 text-amber-700 dark:text-amber-200">
                    <Flame className="h-3 w-3" />
                    <span className="font-medium">Chaos influence</span>
                  </div>
                  <div className="mt-1 text-amber-800 dark:text-amber-100">{personalityState.chaosInfluence.reason}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-amber-700 dark:text-amber-200">
                    {typeof personalityState.chaosInfluence.intensityDelta === 'number' && (
                      <Badge variant="outline">Δ Intensity {personalityState.chaosInfluence.intensityDelta}</Badge>
                    )}
                    {chaosPresetSuggestion && (
                      <Badge variant="outline">Suggests {chaosPresetSuggestion}</Badge>
                    )}
                    {chaosSpiceCap && (
                      <Badge variant="outline">Spice cap {chaosSpiceCap === 'platform_safe' ? 'SAFE' : chaosSpiceCap.toUpperCase()}</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Workflow className="h-4 w-4" /> Knowledge Base
            </div>
            <div className="mt-3 space-y-2">
              <div className="text-2xl font-semibold">{memoryStats?.totalFacts ?? 0}</div>
              <p className="text-xs text-muted-foreground">Total facts indexed</p>
              <div className="flex gap-4 text-xs">
                <div>
                  <div className="font-semibold">{memoryStats?.conversations ?? 0}</div>
                  <div className="text-muted-foreground">Conversations tracked</div>
                </div>
                <div>
                  <div className="font-semibold">{factsPerConversation}</div>
                  <div className="text-muted-foreground">Facts per convo</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-orange-500" /> Flagging System
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-semibold">{pendingFlags}</div>
              <p className="text-xs text-muted-foreground">Pending safety reviews</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Resolved {resolvedFlags}</Badge>
                <Badge variant="secondary">Resolution {resolutionRate}%</Badge>
                {topFlagCategory && (
                  <Badge variant="outline">Top: {topFlagCategory.flagType}</Badge>
                )}
              </div>
              {flagAnalytics?.topFlagTypes && flagAnalytics.topFlagTypes.length > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  <div className="font-medium text-xs text-foreground mb-1">Top flag categories</div>
                  <ul className="space-y-1">
                    {flagAnalytics.topFlagTypes.slice(0, 3).map(({ flagType, count }) => (
                      <li key={flagType} className="flex items-center justify-between">
                        <span>{flagType}</span>
                        <span className="text-foreground font-medium">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <BookOpen className="h-4 w-4" /> Document Ingestion
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-semibold">{completedDocuments}</div>
              <p className="text-xs text-muted-foreground">Docs fully processed</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant={documentBacklog > 0 ? 'destructive' : 'secondary'}>
                  Backlog {documentBacklog}
                </Badge>
                {failedDocuments > 0 && (
                  <Badge variant="destructive">Failed {failedDocuments}</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between bg-background/60 px-2 py-1 rounded border border-border/40">
                  <span>Pending</span>
                  <span className="text-foreground font-medium">{docsByStatus.PENDING}</span>
                </div>
                <div className="flex justify-between bg-background/60 px-2 py-1 rounded border border-border/40">
                  <span>Processing</span>
                  <span className="text-foreground font-medium">{docsByStatus.PROCESSING}</span>
                </div>
                <div className="flex justify-between bg-background/60 px-2 py-1 rounded border border-border/40">
                  <span>Completed</span>
                  <span className="text-foreground font-medium">{docsByStatus.COMPLETED}</span>
                </div>
                <div className="flex justify-between bg-background/60 px-2 py-1 rounded border border-border/40">
                  <span>Failed</span>
                  <span className="text-foreground font-medium">{docsByStatus.FAILED}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <CalendarClock className="h-4 w-4" /> Timeline Health
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-semibold">{timelineIssues}</div>
              <p className="text-xs text-muted-foreground">Event facts needing review</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant={timelineIssues > 0 ? 'destructive' : 'secondary'}>
                  {timelineIssues > 0 ? 'Attention required' : 'Aligned'}
                </Badge>
                <Badge variant="outline">Events {timelineHealth?.inspectedEvents ?? 0}</Badge>
                <Badge variant="outline">Memories {timelineHealth?.inspectedMemories ?? 0}</Badge>
              </div>
              {timelineRunAt && (
                <p className="text-[11px] text-muted-foreground">Last audit: {timelineRunAt}</p>
              )}
              {orientationSummary && (
                <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                  <div className="flex justify-between bg-background/60 px-2 py-1 rounded border border-border/40">
                    <span>Future</span>
                    <span className="text-foreground font-medium">{orientationSummary.future}</span>
                  </div>
                  <div className="flex justify-between bg-background/60 px-2 py-1 rounded border border-border/40">
                    <span>Past</span>
                    <span className="text-foreground font-medium">{orientationSummary.past}</span>
                  </div>
                  <div className="flex justify-between bg-background/60 px-2 py-1 rounded border border-border/40">
                    <span>Ambiguous</span>
                    <span className="text-foreground font-medium">{orientationSummary.ambiguous}</span>
                  </div>
                  <div className="flex justify-between bg-background/60 px-2 py-1 rounded border border-border/40">
                    <span>None</span>
                    <span className="text-foreground font-medium">{orientationSummary.none}</span>
                  </div>
                </div>
              )}
              {timelineHealth?.flaggedMemories.slice(0, 2).map((conflict) => (
                <p key={conflict.memoryId} className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{conflict.eventName}</span>: {conflict.memoryExcerpt}
                </p>
              ))}
              {timelineIssues > 0 && onRequestTimelineRepair && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRequestTimelineRepair}
                  disabled={timelineRepairPending}
                >
                  {timelineRepairPending ? 'Reconciling…' : 'Auto-reconcile timeline'}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4">
          <h3 className="text-sm font-semibold mb-2">Recommended Next Actions</h3>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {actionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
