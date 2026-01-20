import { IStorage } from '../storage.js';
import { geminiService } from './gemini.js';

/**
 * Processes game patch notes (DbD, Arc Raiders, etc.) and extracts structured information
 * Preserves version numbers, dates, and change impacts for accurate meta knowledge
 */
export class PatchNotesProcessor {
  
  /**
   * Detect if text looks like patch notes
   */
  detectPatchNotes(text: string): {
    isPatches: boolean;
    game?: string;
    version?: string;
    confidence: number;
  } {
    const lower = text.toLowerCase();
    
    // DbD patch indicators
    const hasDbDIndicators = (
      /dead by daylight|dbd|ptb|public test build/i.test(text) &&
      /patch|update|hotfix|nerf|buff|rework|change/i.test(text)
    );
    
    // Version number patterns
    const versionMatch = text.match(/\b(\d+\.\d+\.\d+|\d+\.\d+)\b/);
    const hasPTB = /ptb|public test build/i.test(text);
    
    // Change keywords
    const changeKeywords = [
      'increased', 'decreased', 'reduced', 'buffed', 'nerfed',
      'reworked', 'adjusted', 'changed', 'fixed', 'added', 'removed'
    ];
    const hasChanges = changeKeywords.some(kw => lower.includes(kw));
    
    // Patch structure indicators
    const hasSections = /^#{1,3}\s+/m.test(text) || /^[A-Z][^a-z]+$/m.test(text);
    
    let confidence = 0;
    let game = undefined;
    let version = undefined;
    
    if (hasDbDIndicators) {
      game = 'Dead by Daylight';
      confidence += 40;
    }
    
    // Check for Arc Raiders
    if (/arc raiders/i.test(text)) {
      game = 'Arc Raiders';
      confidence += 40;
    }
    
    if (versionMatch) {
      version = versionMatch[1];
      confidence += 25;
    }
    
    if (hasPTB) confidence += 15;
    if (hasChanges) confidence += 15;
    if (hasSections) confidence += 10;
    
    return {
      isPatches: confidence >= 60,
      game,
      version,
      confidence
    };
  }
  
  /**
   * Extract structured patch information using AI
   */
  async extractPatchInfo(text: string, game: string, version?: string): Promise<{
    version: string;
    releaseDate?: string;
    isPTB: boolean;
    changes: Array<{
      category: string; // 'PERK' | 'KILLER' | 'SURVIVOR' | 'MAP' | 'MECHANIC' | 'BUG_FIX'
      item: string;      // "Pain Resonance", "Nurse", "Dead Dawg Saloon"
      changeType: string; // 'BUFF' | 'NERF' | 'REWORK' | 'FIX' | 'NEW'
      description: string;
      impact: 'HIGH' | 'MEDIUM' | 'LOW';
      details: string;
    }>;
  }> {
    
    const prompt = `Extract structured patch note information from this ${game} update.

Game: ${game}
${version ? `Version: ${version}` : ''}

PATCH NOTES:
${text}

Extract ALL changes into structured JSON format:

{
  "version": "9.3.0",
  "releaseDate": "2025-11-04" or null if not mentioned,
  "isPTB": true if PTB/Test Build, false if live,
  "changes": [
    {
      "category": "PERK" | "KILLER" | "SURVIVOR" | "MAP" | "MECHANIC" | "BUG_FIX" | "ITEM" | "OFFERING",
      "item": "Name of perk/killer/item",
      "changeType": "BUFF" | "NERF" | "REWORK" | "FIX" | "NEW" | "DISABLED" | "REMOVED",
      "description": "Brief summary of change",
      "impact": "HIGH" | "MEDIUM" | "LOW",
      "details": "Full details of the change"
    }
  ]
}

Guidelines:
- HIGH impact: Meta-defining changes, massive nerfs/buffs
- MEDIUM impact: Noticeable changes but not game-breaking
- LOW impact: Minor tweaks, bug fixes
- For DbD: Perks, Killers, Survivors, Maps are separate categories
- Include specific numbers when mentioned (cooldowns, percentages, etc.)
- Extract EVERY change mentioned, even small ones

Return ONLY valid JSON.`;

    try {
      const response = await geminiService.generateChatResponse(
        prompt,
        'You are a technical parser that extracts structured information from game patch notes.',
        []
      );
      
      // Parse JSON from response content
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!parsed.version) {
        parsed.version = version || 'Unknown';
      }
      if (!Array.isArray(parsed.changes)) {
        parsed.changes = [];
      }
      
      return parsed;
      
    } catch (error) {
      console.error('Failed to extract patch info:', error);
      
      // Fallback: Create basic structure
      return {
        version: version || 'Unknown',
        isPTB: /ptb|test/i.test(text),
        changes: []
      };
    }
  }
  
  /**
   * Store patch notes as structured memories with temporal context
   */
  async processPatchNotes(
    storage: IStorage,
    profileId: string,
    text: string,
    sourceDocument?: string
  ): Promise<{
    success: boolean;
    game?: string;
    version?: string;
    changesStored: number;
  }> {
    
    console.log('🔍 Analyzing text for patch notes...');
    
    // Detect if this is patch notes
    const detection = this.detectPatchNotes(text);
    
    if (!detection.isPatches) {
      console.log(`⏭️ Not patch notes (confidence: ${detection.confidence}%)`);
      return { success: false, changesStored: 0 };
    }
    
    console.log(`✅ Detected ${detection.game} patch notes (confidence: ${detection.confidence}%)`);
    
    // Extract structured information
    const patchInfo = await this.extractPatchInfo(
      text, 
      detection.game!, 
      detection.version
    );
    
    console.log(`📋 Extracted ${patchInfo.changes.length} changes from version ${patchInfo.version}`);
    
    // Store each change as a memory with temporal context
    let stored = 0;
    const versionLabel = patchInfo.isPTB ? `${patchInfo.version} PTB` : patchInfo.version;
    const temporalContext = `${detection.game} Patch ${versionLabel}${patchInfo.releaseDate ? ` (Released ${patchInfo.releaseDate})` : ''}`;
    
    for (const change of patchInfo.changes) {
      try {
        // Create memory content
        const content = `As of patch ${versionLabel}, ${change.item} was ${change.changeType.toLowerCase()}: ${change.description}`;
        
        // Generate keywords
        const keywords = [
          detection.game!.toLowerCase(),
          'patch',
          patchInfo.version,
          change.category.toLowerCase(),
          change.item.toLowerCase(),
          change.changeType.toLowerCase(),
          change.impact.toLowerCase()
        ];
        
        if (patchInfo.isPTB) keywords.push('ptb', 'test');
        
        // Create memory entry
        // FIXED: Importance values were 500-900, should be 1-100 scale
        await storage.addMemoryEntry({
          profileId,
          type: 'FACT',
          content,
          importance: change.impact === 'HIGH' ? 65 : change.impact === 'MEDIUM' ? 50 : 35,
          source: 'patch_notes',
          sourceId: sourceDocument,
          keywords,
          confidence: 75, // FIXED: Was 99, patch notes are factual but auto-extracted
          temporalContext,
          storyContext: change.details,
          qualityScore: 5,
          retrievalCount: 0,
          successRate: 100,
          supportCount: 1,
          canonicalKey: `patch_${patchInfo.version}_${change.category}_${change.item}`.toLowerCase().replace(/[^a-z0-9_]/g, '_')
        });
        
        stored++;
        
      } catch (error) {
        console.warn(`⚠️ Failed to store change for ${change.item}:`, error);
      }
    }
    
    console.log(`✅ Stored ${stored}/${patchInfo.changes.length} patch changes as memories`);
    
    // Also create a summary memory for the patch itself
    try {
      const summaryContent = `${detection.game} patch ${versionLabel} ${patchInfo.isPTB ? '(PTB) ' : ''}included ${patchInfo.changes.length} changes: ${patchInfo.changes.slice(0, 3).map(c => c.item).join(', ')}${patchInfo.changes.length > 3 ? ' and more' : ''}`;
      
      await storage.addMemoryEntry({
        profileId,
        type: 'FACT',
        content: summaryContent,
        importance: 55, // FIXED: Was 850, should be 1-100 scale. Patch summaries are useful but not core facts.
        source: 'patch_notes',
        sourceId: sourceDocument,
        keywords: [
          detection.game!.toLowerCase(),
          'patch',
          patchInfo.version,
          patchInfo.isPTB ? 'ptb' : 'live'
        ],
        confidence: 75, // FIXED: Was 99, reduced to allow room for verified facts
        temporalContext,
        qualityScore: 5,
        retrievalCount: 0,
        successRate: 100,
        supportCount: 1,
        canonicalKey: `patch_${patchInfo.version}_summary`.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      });
      
    } catch (error) {
      console.warn('⚠️ Failed to create patch summary:', error);
    }
    
    return {
      success: true,
      game: detection.game,
      version: patchInfo.version,
      changesStored: stored
    };
  }
}

export const patchNotesProcessor = new PatchNotesProcessor();
