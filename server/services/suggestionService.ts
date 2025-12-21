import { db } from "../db";
import { memorySuggestions, memoryEntries, contentFlags } from "@shared/schema";
import { eq } from "drizzle-orm";

// Regex patterns for "Fast Tagging"
const TAG_PATTERNS = [
  {
    id: 'family_mention',
    pattern: /\b(uncle|cousin|aunt|mama|papa|nonna|nonno|brother|sister|family|marinara|gnocchi|tortellini|calzone)\b/i,
    action: 'BOOST_IMPORTANCE',
    value: { importance: 8 },
    description: 'Family mention detected'
  },
  {
    id: 'dbd_gameplay',
    pattern: /\b(dead by daylight|dbd|killer|survivor|gen rush|tunneling|hook|pallet|looping|perk|totem|entity)\b/i,
    action: 'ADD_TAG',
    value: { tag: 'dbd_gameplay' },
    description: 'DbD gameplay detected'
  },
  {
    id: 'pasta_related',
    pattern: /\b(pasta|spaghetti|sauce|meatball|lasagna|ravioli|linguine|fettuccine|carbonara|pesto|al dente|noodle)\b/i,
    action: 'ADD_TAG',
    value: { tag: 'pasta_related' },
    description: 'Pasta content detected'
  },
  {
    id: 'emotional_vulnerability',
    pattern: /\b(scared|afraid|lonely|sad|crying|tears|hurt|pain|broken|fail|failure|sorry|apologize|regret)\b/i,
    action: 'FLAG_FOR_TRAINING',
    value: { reason: 'Emotional vulnerability' },
    description: 'Potential mask slip detected'
  },
  {
    id: 'lore_mention',
    pattern: /\b(arc raiders|squad|glitch|simulation|matrix|code|developer|admin|mod|ban)\b/i,
    action: 'BOOST_IMPORTANCE',
    value: { importance: 9 },
    description: 'Lore/Meta content detected'
  },
  {
    id: 'technical_fact',
    pattern: /\b(typescript|javascript|react|node|database|postgres|sql|api|endpoint|route|schema|function|variable|const|let|var|import|export|class|interface|type|enum|async|await|promise|console|log|error|debug|warn|info|trace|table|group|groupEnd|time|timeEnd|count|countReset|assert|clear|dir|dirxml|profile|profileEnd|timeStamp|context|memory|storage|service|client|server|shared|test|script|build|deploy|run|start|stop|restart|status|health|check|ping|pong|ack|nack|syn|fin|rst|psh|urg|ece|cwr|ns|cname|mx|txt|ptr|soa|srv|aaaa|a|any|opt|rrsig|dnskey|ds|nsec|nsec3|nsec3param|tkey|tsig|ixfr|axfr|mailb|maila|wks|hinfo|minfo|rp|afsdb|x25|isdn|rt|nsap|nsap-ptr|sig|key|px|gpos|loc|eid|nimloc|srv|atma|naptr|kx|cert|a6|dname|sink|opt|apl|ds|sshfp|ipseckey|rrsig|nsec|dnskey|dhcid|nsec3|nsec3param|tlsa|smimea|hip|ninfo|rkey|talink|cds|cdnskey|openpgpkey|csync|zonemd|svcB|https|spf|uinfo|uid|gid|unspec|nid|l32|l64|lp|eui48|eui64|tkey|tsig|ixfr|axfr|mailb|maila|any|uri|caa|avc|doa|amt|ta|dlv)\b/i,
    action: 'ADD_TAG',
    value: { tag: 'technical' },
    description: 'Technical/System fact detected'
  }
];

export class SuggestionService {
  
  /**
   * Analyze a new memory and generate suggestions based on regex patterns
   * This is the "Shadow Mode" - it suggests changes but doesn't apply them
   */
  async generateSuggestions(memoryId: string, content: string, profileId: string) {
    console.log(`🕵️ Running Shadow Tagging for memory ${memoryId}...`);
    
    const suggestions = [];

    for (const rule of TAG_PATTERNS) {
      if (rule.pattern.test(content)) {
        console.log(`✨ Match found: ${rule.id}`);
        
        suggestions.push({
          profileId,
          memoryId,
          triggerType: 'REGEX' as const,
          triggerValue: rule.id,
          suggestedAction: rule.action as any,
          suggestedValue: rule.value,
          status: 'PENDING' as const
        });
      }
    }

    if (suggestions.length > 0) {
      await db.insert(memorySuggestions).values(suggestions);
      console.log(`✅ Created ${suggestions.length} suggestions for memory ${memoryId}`);
    }
  }

  /**
   * Approve a suggestion and apply its effects
   */
  async approveSuggestion(suggestionId: string) {
    const suggestion = await db.query.memorySuggestions.findFirst({
      where: eq(memorySuggestions.id, suggestionId)
    });

    if (!suggestion) throw new Error("Suggestion not found");
    if (suggestion.status !== 'PENDING') throw new Error("Suggestion already processed");

    // Apply the change
    if (suggestion.suggestedAction === 'BOOST_IMPORTANCE') {
      const value = suggestion.suggestedValue as { importance: number };
      await db.update(memoryEntries)
        .set({ importance: value.importance })
        .where(eq(memoryEntries.id, suggestion.memoryId));
    }
    else if (suggestion.suggestedAction === 'ADD_TAG') {
      const value = suggestion.suggestedValue as { tag: string };
      const memory = await db.query.memoryEntries.findFirst({
        where: eq(memoryEntries.id, suggestion.memoryId)
      });
      
      if (memory) {
        const currentTags = memory.tags || [];
        if (!currentTags.includes(value.tag)) {
          await db.update(memoryEntries)
            .set({ tags: [...currentTags, value.tag] })
            .where(eq(memoryEntries.id, suggestion.memoryId));
        }
      }
    }
    else if (suggestion.suggestedAction === 'FLAG_FOR_TRAINING') {
      const value = suggestion.suggestedValue as { reason: string };
      await db.insert(contentFlags).values({
        profileId: suggestion.profileId,
        targetType: 'MEMORY',
        targetId: suggestion.memoryId,
        flagType: 'mask_dropped', // Defaulting to mask_dropped for emotional vulnerability
        flagReason: value.reason,
        priority: 'HIGH',
        triggerPattern: suggestion.triggerValue
      });
    }

    // Mark as approved
    await db.update(memorySuggestions)
      .set({ status: 'APPROVED' })
      .where(eq(memorySuggestions.id, suggestionId));
      
    return { success: true };
  }

  /**
   * Reject a suggestion (just mark as rejected)
   */
  async rejectSuggestion(suggestionId: string) {
    await db.update(memorySuggestions)
      .set({ status: 'REJECTED' })
      .where(eq(memorySuggestions.id, suggestionId));
      
    return { success: true };
  }
}

export const suggestionService = new SuggestionService();
