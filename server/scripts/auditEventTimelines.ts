import { eventTimelineAuditor } from "../services/eventTimelineAuditor";
import { storage } from "../storage";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  let profileId: string | undefined;

  const profileIndex = args.indexOf("--profile");
  if (profileIndex !== -1 && args[profileIndex + 1]) {
    profileId = args[profileIndex + 1];
  }

  if (!profileId) {
    const activeProfile = await storage.getActiveProfile();
    profileId = activeProfile?.id;
  }

  if (!profileId) {
    console.error("❌ No profile specified and no active profile found.");
    process.exit(1);
  }

  const result = await eventTimelineAuditor.audit({ profileId, dryRun });

  console.log(`\n🗓️  Event timeline audit (${dryRun ? 'dry-run' : 'repair'})`);
  console.log(`   • Profile: ${profileId}`);
  console.log(`   • Events inspected: ${result.inspectedEvents}`);
  console.log(`   • Memories inspected: ${result.inspectedMemories}`);
  console.log(`   • Flagged memories: ${result.flaggedMemories.length}`);
  console.log(`   • Updates applied: ${result.updatesApplied}`);

  if (result.flaggedMemories.length > 0) {
    console.log("\n   Flagged entries:");
    for (const finding of result.flaggedMemories.slice(0, 10)) {
      console.log(
        `     - [${finding.conflictType}] ${finding.eventName} :: ${finding.memoryExcerpt}`
      );
    }
    if (result.flaggedMemories.length > 10) {
      console.log(`     …and ${result.flaggedMemories.length - 10} more`);
    }
  }

  if (result.skippedEvents.length > 0) {
    console.log("\n   Skipped events:");
    for (const skipped of result.skippedEvents.slice(0, 10)) {
      console.log(`     - ${skipped.eventId}: ${skipped.reason}`);
    }
    if (result.skippedEvents.length > 10) {
      console.log(`     …and ${result.skippedEvents.length - 10} more`);
    }
  }

  console.log("\nDone.\n");
}

main().catch((error) => {
  console.error("❌ Timeline audit failed:", error);
  process.exit(1);
});
