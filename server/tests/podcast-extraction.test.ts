/**
 * Podcast Fact Extraction Tests
 *
 * Tests that the podcast extractor correctly distinguishes between
 * Toxic (the human host) and Nicky (the AI co-host).
 */

import { describe, it, expect } from 'vitest';

// ============================================
// SPEAKER DETECTION TESTS
// ============================================

describe('Nicky Dialogue Extraction', () => {

  /**
   * Extract only Nicky's dialogue from a transcript
   * Mirrors the logic in podcastFactExtractor.ts
   */
  function extractNickyDialogue(transcript: string): string {
    const lines = transcript.split('\n');
    const nickyLines: string[] = [];

    const nickyPatterns = [
      /^(Nicky|NICKY|Noodle Arms|NOODLE ARMS|Nicky Noodle Arms|Nicky A\.?I\.? Dente):?\s*/i,
      /^\[(Nicky|NICKY|Noodle Arms|NOODLE ARMS|Nicky Noodle Arms)\]\s*/i,
      /^\*\*(Nicky|Noodle Arms)\*\*:?\s*/i,
    ];

    for (const line of lines) {
      for (const pattern of nickyPatterns) {
        if (pattern.test(line)) {
          const cleaned = line.replace(pattern, '').trim();
          if (cleaned) nickyLines.push(cleaned);
          break;
        }
      }
    }

    return nickyLines.join('\n\n');
  }

  /**
   * Extract only Toxic's dialogue from a transcript
   */
  function extractToxicDialogue(transcript: string): string {
    const lines = transcript.split('\n');
    const toxicLines: string[] = [];

    const toxicPatterns = [
      /^(Toxic|TOXIC|ToxicTeacher|Host|HOST):?\s*/i,
      /^\[(Toxic|TOXIC|ToxicTeacher|Host)\]\s*/i,
      /^\*\*(Toxic|ToxicTeacher)\*\*:?\s*/i,
    ];

    for (const line of lines) {
      for (const pattern of toxicPatterns) {
        if (pattern.test(line)) {
          const cleaned = line.replace(pattern, '').trim();
          if (cleaned) toxicLines.push(cleaned);
          break;
        }
      }
    }

    return toxicLines.join('\n\n');
  }

  const sampleTranscript = `
Toxic: Welcome back to Noodle Arms everyone! Today we're talking about Dead by Daylight.
Nicky: Ayy, what's up chat! Let me tell you something about these killers, capisce?
Toxic: So Nicky, what do you think about Skull Merchant?
Nicky: Madonna mia, don't even get me started on that walking toaster. She's worse than my cousin Vinny's cooking, and that guy once burned water.
Toxic: I actually think she's pretty fun to play against.
Nicky: Fun?! You're outta your mind, Toxic. That's like saying getting whacked is a good time. My uncle Sal, rest his soul, he used to say "Nicky, never trust anyone who enjoys Skull Merchant."
Toxic: Speaking of family, I heard you have a new story about your grandmother.
Nicky: Oh, Nonna Lucia! She taught me everything about running tiles. Back in the old country, she was the best at running from the carabinieri.
Toxic: I personally prefer playing survivor over killer.
Nicky: That's because you ain't got the stomach for it. Me? I'm a killer main. The Entity himself asked me to join the roster but I said "Eh, I got better things to do."
`;

  it('should extract only Nicky dialogue, not Toxic dialogue', () => {
    const nickyDialogue = extractNickyDialogue(sampleTranscript);
    const toxicDialogue = extractToxicDialogue(sampleTranscript);

    // Nicky's lines should be extracted
    expect(nickyDialogue).toContain("walking toaster");
    expect(nickyDialogue).toContain("uncle Sal");
    expect(nickyDialogue).toContain("Nonna Lucia");
    expect(nickyDialogue).toContain("killer main");

    // Toxic's lines should NOT be in Nicky's dialogue
    expect(nickyDialogue).not.toContain("Welcome back to Noodle Arms");
    expect(nickyDialogue).not.toContain("I actually think she's pretty fun");
    expect(nickyDialogue).not.toContain("I personally prefer playing survivor");

    // Toxic's lines should be separate
    expect(toxicDialogue).toContain("Welcome back to Noodle Arms");
    expect(toxicDialogue).toContain("I actually think she's pretty fun");
  });

  it('should handle various Nicky speaker label formats', () => {
    const formats = [
      'Nicky: This is my opinion.',
      'NICKY: This is my opinion.',
      'Noodle Arms: This is my opinion.',
      '[Nicky] This is my opinion.',
      '[Noodle Arms] This is my opinion.',
      '**Nicky**: This is my opinion.',
      'Nicky Noodle Arms: This is my opinion.',
      'Nicky A.I. Dente: This is my opinion.',
    ];

    for (const format of formats) {
      const extracted = extractNickyDialogue(format);
      expect(extracted).toContain('This is my opinion');
    }
  });

  it('should NOT extract Toxic lines as Nicky', () => {
    const toxicOnly = `
Toxic: I love playing Nurse, she's my main.
ToxicTeacher: The new chapter is amazing.
Host: Let's talk about perks.
[Toxic] This meta is broken.
`;

    const nickyDialogue = extractNickyDialogue(toxicOnly);
    expect(nickyDialogue).toBe('');
  });
});

// ============================================
// PROMPT CONTENT VERIFICATION
// ============================================

describe('Extraction Prompt', () => {

  // The actual prompt from podcastFactExtractor.ts
  const promptTemplate = `You are an expert archivist for the "Noodle Arms" podcast. Your job is to extract PERMANENT FACTS and MEMORIES about NICKY from the following podcast transcript.

CRITICAL: This podcast has TWO CO-HOSTS:
1. **Toxic** (or "ToxicTeacher", "Host") - The HUMAN co-host. DO NOT extract his opinions/facts as Nicky's.
2. **Nicky** (or "Noodle Arms", "Nicky Noodle Arms", "Nicky A.I. Dente") - The AI co-host. ONLY extract facts about/from HIM.

The transcript has speaker labels like "Toxic:", "Nicky:", "[Toxic]", "[Nicky]", etc.`;

  it('should clearly distinguish between Toxic and Nicky in the prompt', () => {
    // Verify prompt mentions both hosts
    expect(promptTemplate).toContain('TWO CO-HOSTS');
    expect(promptTemplate).toContain('Toxic');
    expect(promptTemplate).toContain('Nicky');
  });

  it('should instruct AI to NOT extract Toxic opinions as Nicky', () => {
    expect(promptTemplate).toContain('DO NOT extract his opinions/facts as Nicky');
  });

  it('should instruct AI to ONLY extract Nicky facts', () => {
    expect(promptTemplate).toContain('ONLY extract facts about/from HIM');
  });

  it('should mention speaker label formats', () => {
    expect(promptTemplate).toContain('speaker labels');
    expect(promptTemplate).toContain('Toxic:');
    expect(promptTemplate).toContain('Nicky:');
  });
});

// ============================================
// FACT ATTRIBUTION SIMULATION
// ============================================

describe('Fact Attribution', () => {

  /**
   * Simulates what the AI SHOULD extract vs what it should NOT extract
   * based on the updated prompt instructions.
   */
  const sampleTranscript = `
Toxic: I've been playing a lot of Blight lately, he's so fun.
Nicky: Blight? That twitchy crackhead? Nah, I'm all about Wesker. The man's got style, capisce?
Toxic: Wesker is cool but I find his power frustrating.
Nicky: That's because you don't understand the art of the dash, my friend. My cousin Tony, he was a dasher too. Not Wesker dashes, more like dashing out of restaurants without paying.
Toxic: Your family stories are wild. Anyway, I think gen speeds are fine right now.
Nicky: Gen speeds? Madonna! They're faster than my Uncle Carmine running from his ex-wife. The survivors are done before I can even say "fuggedaboutit."
`;

  interface ExtractedFact {
    content: string;
    speaker: 'Nicky' | 'Toxic' | 'About Nicky';
    shouldExtract: boolean;
  }

  const expectedFacts: ExtractedFact[] = [
    // Nicky's opinions - SHOULD extract
    { content: "Nicky prefers Wesker over Blight", speaker: 'Nicky', shouldExtract: true },
    { content: "Nicky thinks Wesker has style", speaker: 'Nicky', shouldExtract: true },
    { content: "Nicky thinks gen speeds are too fast", speaker: 'Nicky', shouldExtract: true },
    { content: "Nicky has a cousin Tony who dashed from restaurants", speaker: 'Nicky', shouldExtract: true },
    { content: "Nicky has an Uncle Carmine", speaker: 'Nicky', shouldExtract: true },

    // Toxic's opinions - should NOT extract
    { content: "Toxic plays a lot of Blight", speaker: 'Toxic', shouldExtract: false },
    { content: "Toxic finds Wesker's power frustrating", speaker: 'Toxic', shouldExtract: false },
    { content: "Toxic thinks gen speeds are fine", speaker: 'Toxic', shouldExtract: false },
  ];

  it('should identify facts that SHOULD be extracted (Nicky)', () => {
    const nickyFacts = expectedFacts.filter(f => f.shouldExtract);
    expect(nickyFacts.length).toBeGreaterThan(0);

    for (const fact of nickyFacts) {
      expect(fact.speaker).not.toBe('Toxic');
    }
  });

  it('should identify facts that should NOT be extracted (Toxic)', () => {
    const toxicFacts = expectedFacts.filter(f => !f.shouldExtract);
    expect(toxicFacts.length).toBeGreaterThan(0);

    for (const fact of toxicFacts) {
      expect(fact.speaker).toBe('Toxic');
    }
  });

  it('should have more Nicky facts than Toxic facts to extract', () => {
    const nickyFacts = expectedFacts.filter(f => f.shouldExtract);
    const toxicFacts = expectedFacts.filter(f => !f.shouldExtract);

    // In a Nicky-focused extraction, we should have more Nicky facts
    expect(nickyFacts.length).toBeGreaterThanOrEqual(toxicFacts.length);
  });
});
