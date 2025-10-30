import { sql, eq } from "drizzle-orm";
import { db } from "../db";
import {
  events,
  memoryEntries,
  memoryEventLinks,
  type Event,
  type MemoryEntry,
} from "@shared/schema";

const FUTURE_PATTERNS = [
  /\bin \d+\s+(day|days|week|weeks|month|months|year|years)\b/,
  /\bnext\b/,
  /\bupcoming\b/,
  /\bsoon\b/,
  /\btomorrow\b/,
  /\blaunch(?:es|ing)?\b/,
  /\brelease(?:s|ing)?\b/,
  /\bdrops?\b/,
  /\bscheduled for\b/,
  /\bset to\b/,
  /\bcoming\b/,
];

const PAST_PATTERNS = [
  /\bago\b/,
  /\blast\b/,
  /\byesterday\b/,
  /\balready\b/,
  /\breleased\b/,
  /\blaunched\b/,
  /\bdropped\b/,
  /\bwent live\b/,
  /\barrived\b/,
  /\bpremiered\b/,
  /\bdebuted\b/,
];

type TemporalOrientation = 'FUTURE' | 'PAST' | 'AMBIGUOUS' | 'NONE';
type EventTimelinePosition = 'FUTURE' | 'PAST' | 'PRESENT' | 'UNKNOWN';
type ConflictType = 'STALE_FUTURE' | 'STALE_PAST' | 'INTERNAL_CONFLICT';

export interface TimelineConflict {
  eventId: string;
  eventName: string;
  eventDate?: string | null;
  memoryId: string;
  memoryExcerpt: string;
  existingStatus: MemoryEntry['status'];
  suggestedStatus: MemoryEntry['status'];
  orientation: 'FUTURE' | 'PAST';
  eventPosition: EventTimelinePosition;
  conflictType: ConflictType;
  note: string;
}

export interface TimelineAuditOptions {
  profileId?: string;
  dryRun?: boolean;
  now?: Date;
}

export interface TimelineAuditResult {
  inspectedEvents: number;
  inspectedMemories: number;
  flaggedMemories: TimelineConflict[];
  skippedEvents: Array<{ eventId: string; reason: string }>;
  updatesApplied: number;
  dryRun: boolean;
  runAt: string;
}

interface EventWithMemories {
  event: Event;
  memories: MemoryEntry[];
}

class EventTimelineAuditor {
  async audit(options: TimelineAuditOptions = {}): Promise<TimelineAuditResult> {
    const { profileId, dryRun = false } = options;
    const now = options.now ?? new Date();

    const eventRecords = profileId
      ? await db.select().from(events).where(eq(events.profileId, profileId))
      : await db.select().from(events);

    const enrichedEvents: EventWithMemories[] = await Promise.all(
      eventRecords.map(async (eventRecord) => {
        const linkedMemories = await db
          .select({ memory: memoryEntries })
          .from(memoryEventLinks)
          .innerJoin(memoryEntries, eq(memoryEventLinks.memoryId, memoryEntries.id))
          .where(eq(memoryEventLinks.eventId, eventRecord.id));

        return {
          event: eventRecord,
          memories: linkedMemories.map((row) => row.memory),
        };
      })
    );

    let inspectedMemories = 0;
    let updatesApplied = 0;
    const flaggedMemories: TimelineConflict[] = [];
    const skippedEvents: Array<{ eventId: string; reason: string }> = [];

    for (const { event, memories } of enrichedEvents) {
      if (memories.length === 0) {
        continue;
      }

      inspectedMemories += memories.length;

      const eventDate = this.parseEventDate(event.eventDate);
      const eventPosition = this.resolveEventPosition(eventDate, now);

      if (!eventDate && !this.hasOrientationConflict(memories)) {
        skippedEvents.push({
          eventId: event.id,
          reason: 'No event date and no conflicting temporal cues',
        });
        continue;
      }

      if (eventPosition === 'UNKNOWN' && !this.hasOrientationConflict(memories)) {
        skippedEvents.push({
          eventId: event.id,
          reason: 'Unable to determine event timeline',
        });
        continue;
      }

      const orientationCounts = this.countOrientations(memories);
      const orientationMajority = this.resolveMajorityOrientation(orientationCounts);

      for (const memory of memories) {
        const orientation = this.classifyMemoryOrientation(memory);
        if (orientation === 'NONE' || orientation === 'AMBIGUOUS') {
          continue;
        }

        const conflict = this.detectConflict(
          orientation,
          eventPosition,
          orientationCounts,
          orientationMajority,
          eventDate
        );

        if (!conflict) {
          continue;
        }

        const note = this.buildAuditNote(event, orientation, conflict, eventDate, now, memory.content);
        flaggedMemories.push({
          eventId: event.id,
          eventName: event.canonicalName,
          eventDate: event.eventDate,
          memoryId: memory.id,
          memoryExcerpt: this.createExcerpt(memory.content),
          existingStatus: memory.status,
          suggestedStatus: 'AMBIGUOUS',
          orientation,
          eventPosition: conflict.eventPosition,
          conflictType: conflict.type,
          note,
        });

        if (dryRun) {
          continue;
        }

        const updatePayload: Record<string, unknown> = {
          updatedAt: sql`now()`,
        };

        if (memory.status !== 'AMBIGUOUS') {
          updatePayload.status = 'AMBIGUOUS';
        }

        const adjustedConfidence = this.adjustConfidence(memory.confidence);
        if (typeof adjustedConfidence === 'number' && adjustedConfidence !== memory.confidence) {
          updatePayload.confidence = adjustedConfidence;
        }

        const updatedContext = this.mergeTemporalContext(memory.temporalContext, note);
        if (updatedContext !== memory.temporalContext) {
          updatePayload.temporalContext = updatedContext;
        }

        if (Object.keys(updatePayload).length > 1) {
          await db
            .update(memoryEntries)
            .set(updatePayload)
            .where(eq(memoryEntries.id, memory.id));
          updatesApplied += 1;
        }
      }
    }

    return {
      inspectedEvents: eventRecords.length,
      inspectedMemories,
      flaggedMemories,
      skippedEvents,
      updatesApplied,
      dryRun,
      runAt: now.toISOString(),
    };
  }

  private classifyMemoryOrientation(memory: MemoryEntry): TemporalOrientation {
    const cues = [
      this.extractOrientation(memory.content),
      this.extractOrientation(memory.temporalContext ?? ''),
    ].filter((cue) => cue !== 'NONE');

    if (cues.length === 0) {
      return 'NONE';
    }

    const uniqueCues = new Set(cues);
    if (uniqueCues.size === 1) {
      return cues[0];
    }

    if (uniqueCues.has('FUTURE') && uniqueCues.has('PAST')) {
      return 'AMBIGUOUS';
    }

    return cues[0];
  }

  private extractOrientation(text: string): TemporalOrientation {
    if (!text) {
      return 'NONE';
    }

    const normalized = text.toLowerCase();

    if (FUTURE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return 'FUTURE';
    }

    if (PAST_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return 'PAST';
    }

    return 'NONE';
  }

  private parseEventDate(eventDate?: string | null): Date | null {
    if (!eventDate) {
      return null;
    }

    const trimmed = eventDate.trim();
    if (!trimmed) {
      return null;
    }

    const direct = Date.parse(trimmed);
    if (!Number.isNaN(direct)) {
      return new Date(direct);
    }

    const sanitized = trimmed.replace(/\b(ET|PT|CT|GMT)\b/gi, 'UTC');
    const sanitizedParse = Date.parse(sanitized);
    if (!Number.isNaN(sanitizedParse)) {
      return new Date(sanitizedParse);
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return new Date(numeric);
    }

    return null;
  }

  private resolveEventPosition(eventDate: Date | null, now: Date): EventTimelinePosition {
    if (!eventDate) {
      return 'UNKNOWN';
    }

    const diffMs = eventDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays > 1) {
      return 'FUTURE';
    }

    if (diffDays < -1) {
      return 'PAST';
    }

    return 'PRESENT';
  }

  private detectConflict(
    orientation: 'FUTURE' | 'PAST',
    eventPosition: EventTimelinePosition,
    orientationCounts: Record<'FUTURE' | 'PAST', number>,
    orientationMajority: 'FUTURE' | 'PAST' | null,
    eventDate: Date | null,
  ) {
    if (eventPosition === 'PAST' && orientation === 'FUTURE') {
      return { type: 'STALE_FUTURE' as ConflictType, eventPosition };
    }

    if (eventPosition === 'FUTURE' && orientation === 'PAST') {
      return { type: 'STALE_PAST' as ConflictType, eventPosition };
    }

    if (!eventDate && orientationMajority && orientation !== orientationMajority && orientationCounts[orientationMajority] > 0) {
      return { type: 'INTERNAL_CONFLICT' as ConflictType, eventPosition: 'UNKNOWN' as EventTimelinePosition };
    }

    if (!eventDate && orientationCounts.FUTURE > 0 && orientationCounts.PAST > 0) {
      return { type: 'INTERNAL_CONFLICT' as ConflictType, eventPosition: 'UNKNOWN' as EventTimelinePosition };
    }

    return null;
  }

  private hasOrientationConflict(memories: MemoryEntry[]): boolean {
    const counts = this.countOrientations(memories);
    return counts.FUTURE > 0 && counts.PAST > 0;
  }

  private countOrientations(memories: MemoryEntry[]): Record<'FUTURE' | 'PAST', number> {
    return memories.reduce(
      (acc, memory) => {
        const orientation = this.classifyMemoryOrientation(memory);
        if (orientation === 'FUTURE' || orientation === 'PAST') {
          acc[orientation] += 1;
        }
        return acc;
      },
      { FUTURE: 0, PAST: 0 } as Record<'FUTURE' | 'PAST', number>,
    );
  }

  private resolveMajorityOrientation(counts: Record<'FUTURE' | 'PAST', number>): 'FUTURE' | 'PAST' | null {
    if (counts.FUTURE === counts.PAST) {
      return null;
    }
    return counts.FUTURE > counts.PAST ? 'FUTURE' : 'PAST';
  }

  private buildAuditNote(
    event: Event,
    orientation: 'FUTURE' | 'PAST',
    conflict: { type: ConflictType; eventPosition: EventTimelinePosition },
    eventDate: Date | null,
    now: Date,
    memoryContent: string,
  ): string {
    const relative = eventDate ? this.describeRelativeTiming(eventDate, now) : 'timeline unknown';
    const snippet = this.createExcerpt(memoryContent);
    const conflictSummary = conflict.type === 'INTERNAL_CONFLICT'
      ? 'conflicts with other memories'
      : conflict.type === 'STALE_FUTURE'
        ? 'still describes the event as upcoming'
        : 'treats the event as already finished';

    return `Timeline audit ${now.toISOString()}: ${event.canonicalName} (${relative}) ${conflictSummary} (orientation: ${orientation}). Evidence: "${snippet}"`;
  }

  private describeRelativeTiming(eventDate: Date, now: Date): string {
    const diffMs = eventDate.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'occurs today';
    }

    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    }

    const pastDays = Math.abs(diffDays);
    return `${pastDays} day${pastDays === 1 ? '' : 's'} ago`;
  }

  private createExcerpt(content: string, length = 120): string {
    if (content.length <= length) {
      return content;
    }
    return `${content.slice(0, length - 1)}…`;
  }

  private adjustConfidence(confidence?: number | null): number | undefined {
    if (typeof confidence !== 'number') {
      return 40;
    }
    const lowered = confidence - 15;
    return Math.max(10, lowered);
  }

  private mergeTemporalContext(existing: string | null | undefined, note: string): string {
    if (!existing) {
      return note;
    }
    if (existing.includes(note)) {
      return existing;
    }
    return `${existing} | ${note}`;
  }
}

export const eventTimelineAuditor = new EventTimelineAuditor();
