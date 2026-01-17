/**
 * Live test of podcast fact extraction
 *
 * Run with: npx tsx server/scripts/test-podcast-extraction.ts
 */

import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const sampleTranscript = `
Toxic: Welcome back to Noodle Arms episode 47! I'm your host Toxic, and as always I'm here with my co-host Nicky.

Nicky: Ayy, what's up everybody! Nicky Noodle Arms here, ready to talk about some Dead by Daylight. You know what I've been thinking about lately? Skull Merchant. Madonna mia, that killer is worse than my Aunt Rosa's meatballs, and those things could be used as weapons.

Toxic: I actually don't mind Skull Merchant, I think she gets too much hate.

Nicky: Too much hate?! Toxic, my friend, you're losing it. Let me tell you something - back in Little Italy, we had a saying: "If it walks like a toaster and sounds like a toaster, it's probably Skull Merchant." My cousin Vinny, he played against her once and he's still in therapy.

Toxic: Speaking of killers, I've been maining Wesker lately. His power feels really smooth.

Nicky: Now THAT'S a killer I can respect! Wesker's got class, capisce? He reminds me of my Uncle Sal before the incident. Very smooth, very professional. Not like these new killers they keep adding.

Toxic: What do you think about the current meta? I feel like gen speeds are pretty balanced.

Nicky: Balanced?! The gens fly faster than my Nonna running from immigration back in '62! These survivors finish three gens before I can even say "fuggedaboutit." The Entity needs to have a word with the devs, that's all I'm saying.

Toxic: I disagree, I think survivors need those speeds to have a chance.

Nicky: You're too soft, Toxic. That's your problem. Me? I come from a long line of killers. Well, not ACTUAL killers, allegedly. The court records are sealed.

Toxic: Let's talk about perks. I've been running Pain Resonance and it feels great.

Nicky: Pain Resonance is for chumps! Real killers use Hex perks. My boy Sal, he taught me - always go for the high risk, high reward plays. That's why I run five Hex perks. What do you mean you can only run four? I got connections.
`;

async function testExtraction() {
  console.log('🎙️ LIVE PODCAST EXTRACTION TEST\n');
  console.log('=' .repeat(60));
  console.log('Testing with sample transcript containing BOTH Toxic and Nicky dialogue');
  console.log('=' .repeat(60));
  console.log('\n📝 SAMPLE TRANSCRIPT:\n');
  console.log(sampleTranscript);
  console.log('\n' + '=' .repeat(60));
  console.log('🤖 Sending to AI for fact extraction...\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set in environment');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `You are an expert archivist for the "Noodle Arms" podcast. Your job is to extract PERMANENT FACTS and MEMORIES about NICKY from the following podcast transcript.

CRITICAL: This podcast has TWO CO-HOSTS:
1. **Toxic** (or "ToxicTeacher", "Host") - The HUMAN co-host. DO NOT extract his opinions/facts as Nicky's.
2. **Nicky** (or "Noodle Arms", "Nicky Noodle Arms", "Nicky A.I. Dente") - The AI co-host. ONLY extract facts about/from HIM.

The transcript has speaker labels like "Toxic:", "Nicky:", "[Toxic]", "[Nicky]", etc.

TRANSCRIPT:
"${sampleTranscript}"

INSTRUCTIONS:
Extract 10-20 distinct, atomic facts from this episode. ONLY extract facts that are:
- Said BY Nicky (his opinions, stories, preferences)
- Said ABOUT Nicky by Toxic or others (e.g., "Toxic mentions that Nicky hates camping killers")

Focus on:
1. Nicky's specific opinions and hot takes
2. Nicky's stories and lore (his fictional Italian-American backstory, SABAM, etc.)
3. Nicky's relationships with people (real or fictional)
4. Nicky's gaming preferences (Dead by Daylight, etc.)
5. Nicky's personal details and character traits

Do NOT extract:
- Toxic's personal opinions (unless they're ABOUT Nicky)
- Generic greetings or filler
- Ambiguous statements
- Facts about Toxic himself

Return a JSON object with a "facts" array. Each fact should have:
- content: The fact statement (e.g., "Nicky thinks The Trapper is the worst killer in DBD")
- type: One of ['OPINION', 'LORE', 'PREFERENCE', 'RELATIONSHIP', 'STORY']
- keywords: Array of 3-5 search keywords
- importance: 1-100 scale (100 = critical lore, 1 = trivial)
- lane: One of ['CANON', 'RUMOR']. Use 'RUMOR' if the statement is an obvious exaggeration, a lie, or part of Nicky's performative bullshit.

JSON FORMAT:
{
  "facts": [
    {
      "content": "Nicky hates playing against The Skull Merchant",
      "type": "PREFERENCE",
      "keywords": ["skull merchant", "dbd", "killer", "hate"],
      "importance": 85,
      "lane": "CANON"
    }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      config: {
        responseMimeType: "application/json",
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      const result = JSON.parse(rawJson);
      const facts = result.facts || [];

      console.log(`✅ AI extracted ${facts.length} facts:\n`);
      console.log('=' .repeat(60));

      // Categorize facts
      const nickyFacts: any[] = [];
      const suspiciousFacts: any[] = [];

      for (const fact of facts) {
        // Check if fact might be about Toxic instead of Nicky
        const content = fact.content.toLowerCase();
        if (content.includes('toxic') && !content.includes('nicky')) {
          suspiciousFacts.push(fact);
        } else {
          nickyFacts.push(fact);
        }
      }

      console.log('\n✅ NICKY FACTS (Correct extractions):\n');
      for (let i = 0; i < nickyFacts.length; i++) {
        const fact = nickyFacts[i];
        console.log(`${i + 1}. [${fact.type}] ${fact.content}`);
        console.log(`   Lane: ${fact.lane} | Importance: ${fact.importance}`);
        console.log(`   Keywords: ${fact.keywords?.join(', ')}`);
        console.log('');
      }

      if (suspiciousFacts.length > 0) {
        console.log('\n⚠️ SUSPICIOUS FACTS (Might be about Toxic, not Nicky):\n');
        for (const fact of suspiciousFacts) {
          console.log(`   ⚠️ ${fact.content}`);
        }
      }

      console.log('=' .repeat(60));
      console.log('\n📊 SUMMARY:');
      console.log(`   Total facts extracted: ${facts.length}`);
      console.log(`   Nicky facts: ${nickyFacts.length}`);
      console.log(`   Suspicious (possibly Toxic): ${suspiciousFacts.length}`);

      // Check for Toxic's opinions that should NOT have been extracted
      const toxicOpinions = [
        "don't mind skull merchant",
        "maining wesker",
        "gen speeds are pretty balanced",
        "survivors need those speeds",
        "running pain resonance"
      ];

      console.log('\n🔍 VERIFICATION - These Toxic opinions should NOT appear:');
      let leakedCount = 0;
      for (const opinion of toxicOpinions) {
        const leaked = facts.some((f: any) =>
          f.content.toLowerCase().includes(opinion.toLowerCase())
        );
        const status = leaked ? '❌ LEAKED' : '✅ Correctly excluded';
        console.log(`   ${status}: "${opinion}"`);
        if (leaked) leakedCount++;
      }

      console.log('\n' + '=' .repeat(60));
      if (leakedCount === 0) {
        console.log('🎉 SUCCESS! No Toxic opinions leaked into Nicky facts!');
      } else {
        console.log(`⚠️ WARNING: ${leakedCount} Toxic opinions may have leaked!`);
      }

    }
  } catch (error) {
    console.error('❌ Extraction failed:', error);
  }
}

testExtraction();
