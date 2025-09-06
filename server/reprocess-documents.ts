import { storage } from "./storage";
import { documentProcessor } from "./services/documentProcessor";

async function reprocessAllDocuments() {
  try {
    console.log("Starting document reprocessing...");
    
    // Get active profile
    const activeProfile = await storage.getActiveProfile();
    if (!activeProfile) {
      console.error("No active profile found");
      return;
    }
    
    console.log(`Active profile: ${activeProfile.name}`);
    
    // Get all completed documents
    const documents = await storage.getProfileDocuments(activeProfile.id);
    const completedDocs = documents.filter(doc => doc.processingStatus === 'COMPLETED' && doc.extractedContent);
    
    console.log(`Found ${completedDocs.length} completed documents to reprocess`);
    
    let totalMemoriesCreated = 0;
    
    for (let i = 0; i < completedDocs.length; i++) {
      const document = completedDocs[i];
      console.log(`\nProcessing ${i + 1}/${completedDocs.length}: ${document.filename}`);
      console.log(`Content length: ${document.extractedContent?.length || 0} characters`);
      
      try {
        const memoriesBefore = await storage.getMemoryEntries(activeProfile.id, 10000);
        
        // Re-extract knowledge using improved logic
        await documentProcessor.extractAndStoreKnowledge(
          activeProfile.id, 
          document.extractedContent!, 
          document.filename
        );
        
        const memoriesAfter = await storage.getMemoryEntries(activeProfile.id, 10000);
        const newMemories = memoriesAfter.length - memoriesBefore.length;
        totalMemoriesCreated += newMemories;
        
        console.log(`  → Created ${newMemories} memory entries`);
      } catch (error) {
        console.error(`  ✗ Failed to process ${document.filename}:`, error);
      }
    }
    
    console.log(`\n✓ Reprocessing complete!`);
    console.log(`  Total documents processed: ${completedDocs.length}`);
    console.log(`  Total memory entries created: ${totalMemoriesCreated}`);
    
    // Final stats
    const finalStats = await storage.getMemoryStats(activeProfile.id);
    console.log(`  Final memory count: ${finalStats.totalFacts}`);
    
  } catch (error) {
    console.error("Reprocessing failed:", error);
  }
}

reprocessAllDocuments().then(() => {
  console.log("Script completed");
  process.exit(0);
}).catch((error) => {
  console.error("Script error:", error);
  process.exit(1);
});