import { db } from "../db.js";
import { contentFlags, flagAutoApprovals } from "../../shared/schema.js";
import { eq, and, sql } from "drizzle-orm";

/**
 * Smart Auto-Approval System for Content Flags
 * 
 * Based on historical approval patterns, automatically approves flags that meet criteria:
 * - Categories with 100% historical approval rate
 * - High confidence scores (>=85%)
 * - Daily limit of 100 auto-approvals
 * - Always manual review for risky categories
 */

// Categories with 100% approval rate (safe for auto-approval)
const SAFE_CATEGORIES = [
  'new_backstory',
  'dbd_gameplay', 
  'pasta_related',
  'permanent_fact',
  'new_skill_claim',
  'personality_anomaly',
  'criminal_activity',
  'chaos_level_3',
  'content_importance',
  'mask_dropped',
  'chaos_level_2',
  'relationship_dynamics',
] as const;

// Categories that need manual review (no auto-approval)
const MANUAL_REVIEW_REQUIRED = [
  'fourth_wall_break',
  'ooc_behavior',
] as const;

// Categories with high approval rate but not 100% (higher confidence threshold)
const HIGH_CONFIDENCE_CATEGORIES = [
  'family_mention', // 97% approval
  'new_character', // 90% approval  
] as const;

interface AutoApprovalResult {
  approved: number;
  skipped: number;
  dailyLimit: number;
  flagIds: string[];
  categories: Record<string, number>;
}

export class FlagAutoApprovalService {
  /**
   * Run auto-approval process for pending flags
   */
  async runAutoApproval(profileId: string): Promise<AutoApprovalResult> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check daily limit
    const dailyStats = await db.query.flagAutoApprovals.findFirst({
      where: and(
        eq(flagAutoApprovals.profileId, profileId),
        eq(flagAutoApprovals.approvalDate, today)
      ),
    });

    const dailyLimit = 100;
    const currentCount = dailyStats?.approvalCount || 0;
    const remaining = dailyLimit - currentCount;

    if (remaining <= 0) {
      console.log(`⚠️ Daily auto-approval limit reached (${dailyLimit})`);
      return {
        approved: 0,
        skipped: 0,
        dailyLimit: currentCount,
        flagIds: [],
        categories: {},
      };
    }

    // Get pending flags that are candidates for auto-approval
    const pendingFlags = await db
      .select()
      .from(contentFlags)
      .where(
        and(
          eq(contentFlags.profileId, profileId),
          eq(contentFlags.reviewStatus, 'PENDING'),
          eq(contentFlags.targetType, 'MEMORY') // Only auto-approve memory flags for now
        )
      )
      .limit(remaining); // Don't fetch more than we can approve

    const approvedFlagIds: string[] = [];
    const categoryStats: Record<string, number> = {};
    let skipped = 0;

    for (const flag of pendingFlags) {
      const shouldApprove = this.shouldAutoApprove(flag);
      
      if (shouldApprove) {
        // Auto-approve this flag
        await db
          .update(contentFlags)
          .set({
            reviewStatus: 'APPROVED',
            reviewedBy: 'AUTO_APPROVAL_SYSTEM',
            reviewNotes: `Auto-approved: ${flag.flagType} (confidence: ${flag.confidence || 0}%)`,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(contentFlags.id, flag.id));

        approvedFlagIds.push(flag.id);
        categoryStats[flag.flagType] = (categoryStats[flag.flagType] || 0) + 1;
      } else {
        skipped++;
      }

      // Stop if we hit the limit
      if (approvedFlagIds.length >= remaining) {
        break;
      }
    }

    // Update or create daily stats
    if (approvedFlagIds.length > 0) {
      if (dailyStats) {
        await db
          .update(flagAutoApprovals)
          .set({
            approvalCount: currentCount + approvedFlagIds.length,
            flagIds: sql`array_cat(flag_ids, ${approvedFlagIds})`,
            updatedAt: new Date(),
          })
          .where(eq(flagAutoApprovals.id, dailyStats.id));
      } else {
        await db.insert(flagAutoApprovals).values({
          profileId,
          approvalDate: today,
          approvalCount: approvedFlagIds.length,
          flagIds: approvedFlagIds,
        });
      }
    }

    console.log(`✅ Auto-approved ${approvedFlagIds.length} flags (${skipped} skipped)`);
    console.log(`📊 Categories:`, categoryStats);
    console.log(`📈 Daily total: ${currentCount + approvedFlagIds.length}/${dailyLimit}`);

    return {
      approved: approvedFlagIds.length,
      skipped,
      dailyLimit: currentCount + approvedFlagIds.length,
      flagIds: approvedFlagIds,
      categories: categoryStats,
    };
  }

  /**
   * Determine if a flag should be auto-approved based on category and confidence
   */
  private shouldAutoApprove(flag: typeof contentFlags.$inferSelect): boolean {
    // Never auto-approve categories that need manual review
    if (MANUAL_REVIEW_REQUIRED.includes(flag.flagType as any)) {
      return false;
    }

    const confidence = flag.confidence || 0;

    // Safe categories with good confidence (>=85%)
    if (SAFE_CATEGORIES.includes(flag.flagType as any) && confidence >= 85) {
      return true;
    }

    // High confidence categories need even higher confidence (>=90%)
    if (HIGH_CONFIDENCE_CATEGORIES.includes(flag.flagType as any) && confidence >= 90) {
      return true;
    }

    return false;
  }

  /**
   * Get daily digest of auto-approved flags
   */
  async getDailyDigest(profileId: string, date?: string): Promise<{
    date: string;
    totalApproved: number;
    flags: (typeof contentFlags.$inferSelect)[];
    categoryBreakdown: Record<string, number>;
  } | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const dailyStats = await db.query.flagAutoApprovals.findFirst({
      where: and(
        eq(flagAutoApprovals.profileId, profileId),
        eq(flagAutoApprovals.approvalDate, targetDate)
      ),
    });

    if (!dailyStats || !dailyStats.flagIds || dailyStats.flagIds.length === 0) {
      return null;
    }

    // Fetch the actual flags
    const flags = await db.query.contentFlags.findMany({
      where: sql`${contentFlags.id} = ANY(${dailyStats.flagIds})`,
    });

    // Calculate category breakdown
    const categoryBreakdown: Record<string, number> = {};
    flags.forEach(flag => {
      categoryBreakdown[flag.flagType] = (categoryBreakdown[flag.flagType] || 0) + 1;
    });

    return {
      date: targetDate,
      totalApproved: dailyStats.approvalCount || 0,
      flags,
      categoryBreakdown,
    };
  }

  /**
   * Get stats for the last 7 days
   */
  async getWeeklyStats(profileId: string): Promise<{
    totalAutoApproved: number;
    averagePerDay: number;
    peakDay: string;
    peakCount: number;
    categoryTrends: Record<string, number>;
  }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const weeklyData = await db.query.flagAutoApprovals.findMany({
      where: and(
        eq(flagAutoApprovals.profileId, profileId),
        sql`${flagAutoApprovals.approvalDate} >= ${sevenDaysAgoStr}`
      ),
    });

    let totalAutoApproved = 0;
    let peakDay = '';
    let peakCount = 0;
    const categoryTrends: Record<string, number> = {};

    for (const day of weeklyData) {
      const dayCount = day.approvalCount || 0;
      totalAutoApproved += dayCount;
      
      if (dayCount > peakCount) {
        peakCount = dayCount;
        peakDay = day.approvalDate;
      }

      // Fetch flags for category trends
      if (day.flagIds && day.flagIds.length > 0) {
        const flags = await db.query.contentFlags.findMany({
          where: sql`${contentFlags.id} = ANY(${day.flagIds})`,
        });
        
        flags.forEach(flag => {
          categoryTrends[flag.flagType] = (categoryTrends[flag.flagType] || 0) + 1;
        });
      }
    }

    const averagePerDay = weeklyData.length > 0 ? totalAutoApproved / weeklyData.length : 0;

    return {
      totalAutoApproved,
      averagePerDay: Math.round(averagePerDay * 10) / 10,
      peakDay,
      peakCount,
      categoryTrends,
    };
  }
}

export const flagAutoApprovalService = new FlagAutoApprovalService();
