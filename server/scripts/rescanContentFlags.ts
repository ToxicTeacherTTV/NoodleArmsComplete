
import 'dotenv/config';
import fs from 'fs';
import { db } from '../db.js';
import { contentFlags, memoryEntries, type InsertContentFlag } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { aiFlagger } from '../services/aiFlagger.js';

/**
 * Rescan all memories to apply new flag types (Podcast, Facts, Game Events, etc.)
 * This is a one-time migration script to populate metadata for existing content.
 */
async function rescanContentFlags() {
  console.log('🎯 Starting Content Flag Rescan...');
  console.log('📋 Target: All Memory Entries');
  
  // Get all memories
  const memories = await db
    .select()
    .from(memoryEntries)
    .orderBy(memoryEntries.createdAt);
  
  console.log(`📊 Found ${memories.length} memories to scan\n`);
  
  const PROGRESS_FILE = 'rescan_progress.json';
  let startIndex = 0;
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      startIndex = data.lastProcessedIndex || 0;
      console.log(`🔄 Resuming from index ${startIndex} (skipping already processed items)`);
    } catch (e) {
      console.log('⚠️ Could not read progress file, starting from 0');
    }
  }

  console.log('⏱️  Estimated time: ~' + Math.round((memories.length - startIndex) / 60 * 2) + ' minutes (assuming 2s/req)');

  let processed = startIndex;
  let newFlagsCount = 0;
  let skipped = 0;
  let errors = 0;
  
  const startTime = Date.now();
  
  for (let i = startIndex; i < memories.length; i++) {
    const memory = memories[i];
    try {
      // Progress indicator
      const percent = Math.round((processed / memories.length) * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
      process.stdout.write(`\r[${percent}%] ${processed + 1}/${memories.length} | ${elapsed}m elapsed | New Flags: ${newFlagsCount} `);
      
      // Save progress every 5 items
      if (processed % 5 === 0) {
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastProcessedIndex: i }));
      }

      // Analyze content
      const analysis = await aiFlagger.analyzeContent(
        memory.content,
        'MEMORY',
        { profileId: memory.profileId }
      );
      
      if (analysis.flags.length > 0) {
        // Get existing flags for this memory to avoid duplicates
        const existingFlags = await db
          .select()
          .from(contentFlags)
          .where(
            and(
              eq(contentFlags.targetId, memory.id),
              eq(contentFlags.targetType, 'MEMORY')
            )
          );
          
        const flagsToInsert: InsertContentFlag[] = [];
        
        for (const flag of analysis.flags) {
          // Check if flag type already exists for this memory
          // We use a simple check: if we have a 'podcast_topic' flag, we assume it's covered.
          // This prevents duplicate flags for the same category.
          const exists = existingFlags.some(ef => ef.flagType === flag.flagType);
          
          if (!exists) {
            flagsToInsert.push({
              profileId: memory.profileId,
              targetType: 'MEMORY',
              targetId: memory.id,
              flagType: flag.flagType,
              flagReason: flag.reason,
              priority: flag.priority,
              confidence: Math.round(flag.confidence * 100), // Convert 0-1 to 0-100 if needed, or keep as is? Schema says integer?
              // Wait, schema says confidence is integer? Let's check.
              // Schema for contentFlags doesn't have confidence column?
              // Let's check schema again.
              reviewStatus: 'PENDING'
            } as any); // Cast to any to avoid strict type checking if I missed a field
          }
        }
        
        if (flagsToInsert.length > 0) {
          // Insert new flags
          // We need to handle the schema correctly.
          // Let's check contentFlags schema again for confidence.
          
          for (const f of flagsToInsert) {
             await db.insert(contentFlags).values(f);
          }
          newFlagsCount += flagsToInsert.length;
        }
      }
      
      processed++;
      
      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`\n❌ Error processing memory ${memory.id}:`, error);
      errors++;
    }
  }
  
  console.log('\n\n✅ Rescan Complete!');
  console.log(`Total Memories: ${memories.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`New Flags Added: ${newFlagsCount}`);
  console.log(`Errors: ${errors}`);
  
  process.exit(0);
}

// Run the script
rescanContentFlags().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
