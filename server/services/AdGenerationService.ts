import { storage } from '../storage.js';
import { AdTemplate, PrerollAd, InsertAdTemplate, InsertPrerollAd } from '@shared/schema.js';
import Anthropic from '@anthropic-ai/sdk';
import { geminiService } from './gemini.js';

interface FakeSponsor {
  name: string;
  products: string[];
  category: string;
  italianTwist?: string;
}

interface AdGenerationRequest {
  profileId: string;
  category?: string;
  personalityFacet?: string;
  forceNew?: boolean;
  manualSponsorName?: string;   // User-provided sponsor name
  manualProductName?: string;    // User-provided product name
  submittedBy?: string;          // Who suggested this (for community credits)
}

const DEFAULT_MODEL_STR = "claude-sonnet-4-5-20250929";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "",
});

export class AdGenerationService {
  
  // Track recent sponsor names to prevent repetition
  private recentSponsorNames: string[] = [];
  private maxRecentNames = 50;

  // Track recent personality facets to prevent emotion profile repetition
  private recentPersonalityFacets: string[] = [];
  private maxRecentFacets = 5;

  // Track recent opening patterns to prevent repetitive starts
  private recentOpenings: string[] = [];
  private maxRecentOpenings = 6;

  // Track recent sponsor name format patterns to prevent repetitive title structures
  private recentNameFormats: string[] = [];
  private maxRecentFormats = 6; // Increased for 10 formats

  // Map personality facets to emotion profiles for voice synthesis
  private readonly PERSONALITY_TO_EMOTION_MAP: Record<string, string> = {
    grumpy_mentor: 'grumpy',
    family_business: 'warm',
    italian_pride: 'salesman',
    dbd_expert: 'excited',
    reluctant_helper: 'reluctant',
    conspiracy_theories: 'conspiratorial',
    old_school_wisdom: 'deadpan',
    unhinged_lunatic: 'manic',
    authentic_recommendation: 'warm',
    family_approval: 'warm',
    anti_establishment: 'conspiratorial',
    urgent_warning: 'excited',
    family_values: 'warm',
    nostalgia: 'warm',
    personal_connection: 'warm',
    gaming_metaphors: 'excited',
    no_nonsense: 'deadpan',
    quality_over_flash: 'grumpy',
    skeptical: 'reluctant',
    family_endorsement: 'reluctant',
    confused_endorsement: 'reluctant',
    reluctant_reader: 'reluctant',
    family_pressure: 'grumpy',
    overly_excited: 'manic',
    conspiracy_adjacent: 'conspiratorial',
    manic_energy: 'manic',
    family_chaos: 'manic',
    complete_psycho: 'psycho',
    unhinged_madman: 'psycho',
    absolutely_insane: 'psycho',
    totally_mental: 'psycho',
    psychotic_break: 'psycho',
    reality_meltdown: 'psycho',
    multiple_personalities: 'psycho',
    demon_possessed: 'psycho',
    interdimensional_chaos: 'psycho',
    cosmic_breakdown: 'psycho',
    feral_animal: 'psycho',
    sentient_pasta: 'psycho',
    time_traveling_madman: 'psycho',
    alien_abductee: 'psycho',
    cursed_italian: 'psycho',
    rabid_gamer: 'psycho',
    mafia_ghost: 'psycho',
    caffeinated_lunatic: 'psycho',
    jersey_cryptid: 'psycho',
    pasta_overdose: 'psycho'
  };

  // Validate sponsor name against banned patterns
  private isValidSponsorName(sponsorName: string): boolean {
    // Ban patterns: Salvatore, "X and Y", "X & Y"
    const bannedPatterns = [
      /\bSalvatore'?s?\b/i,
      /\b(?:and|&)\b/i
    ];
    
    return !bannedPatterns.some(pattern => pattern.test(sponsorName));
  }

  // Check if name was recently used
  private isRecentlyUsed(sponsorName: string): boolean {
    return this.recentSponsorNames.includes(sponsorName.toLowerCase());
  }

  // Add name to recent list
  private addToRecentNames(sponsorName: string): void {
    this.recentSponsorNames.unshift(sponsorName.toLowerCase());
    if (this.recentSponsorNames.length > this.maxRecentNames) {
      this.recentSponsorNames.pop();
    }
  }

  // Check if personality facet was recently used
  private isPersonalityFacetRecentlyUsed(facet: string): boolean {
    return this.recentPersonalityFacets.includes(facet);
  }

  // Add personality facet to recent list
  private addToRecentFacets(facet: string): void {
    this.recentPersonalityFacets.unshift(facet);
    if (this.recentPersonalityFacets.length > this.maxRecentFacets) {
      this.recentPersonalityFacets.pop();
    }
  }

  // Select a varied personality facet with anti-repetition
  private selectVariedPersonalityFacet(): string {
    const availableFacets = Object.keys(this.PERSONALITY_TO_EMOTION_MAP);
    
    // Filter out recently used facets
    const unusedFacets = availableFacets.filter(facet => 
      !this.isPersonalityFacetRecentlyUsed(facet)
    );
    
    // If all facets were used recently, reset and use all
    const candidates = unusedFacets.length > 0 ? unusedFacets : availableFacets;
    
    // Select random facet
    const selectedFacet = candidates[Math.floor(Math.random() * candidates.length)];
    
    // Track this facet
    this.addToRecentFacets(selectedFacet);
    
    console.log(`🎭 Selected personality facet: ${selectedFacet} (avoided: ${this.recentPersonalityFacets.slice(1).join(', ')})`);
    return selectedFacet;
  }

  // Check if opening pattern was recently used
  private isOpeningRecentlyUsed(opening: string): boolean {
    return this.recentOpenings.includes(opening);
  }

  // Add opening to recent list
  private addToRecentOpenings(opening: string): void {
    this.recentOpenings.unshift(opening);
    if (this.recentOpenings.length > this.maxRecentOpenings) {
      this.recentOpenings.pop();
    }
  }

  // Select a varied opening pattern with anti-repetition
  private selectVariedOpening(): string {
    const availableOpenings = [
      "[grumbling] Listen up, mooks!",
      "[speaking flatly] So apparently I gotta tell ya about...",
      "[grumbling] Ya know what's been pissin' me off?",
      "[speaking plainly] Alright, here's the deal with...",
      "[muttering under breath] Can't believe I'm doin' this...",
      "[speaking reluctantly] They're makin' me talk about...",
      "[clearing throat] Ey, you beautiful disasters!",
      "Look, I don't usually do this, but...",
      "[exasperated] My cousin Sal told me to mention...",
      "This is gonna sound crazy, but..."
    ];
    
    // Filter out recently used openings
    const unusedOpenings = availableOpenings.filter(opening => 
      !this.isOpeningRecentlyUsed(opening)
    );
    
    // If all openings were used recently, reset and use all
    const candidates = unusedOpenings.length > 0 ? unusedOpenings : availableOpenings;
    
    // Select random opening
    const selectedOpening = candidates[Math.floor(Math.random() * candidates.length)];
    
    // Track this opening
    this.addToRecentOpenings(selectedOpening);
    
    console.log(`🎬 Selected opening: "${selectedOpening}" (avoided: ${this.recentOpenings.slice(1).join(', ')})`);
    return selectedOpening;
  }

  // Check if naming format was recently used
  private isNameFormatRecentlyUsed(format: string): boolean {
    return this.recentNameFormats.includes(format);
  }

  // Add naming format to recent list
  private addToRecentNameFormats(format: string): void {
    this.recentNameFormats.unshift(format);
    if (this.recentNameFormats.length > this.maxRecentFormats) {
      this.recentNameFormats.pop();
    }
  }

  // Select a varied naming format with anti-repetition (10 total formats)
  private selectVariedNamingFormat(): { format: string; instruction: string; examples: string[] } {
    const availableFormats = [
      {
        format: "the_weird_thing",
        instruction: "Use format: The [Weird Thing]",
        examples: [
          "The Meatball Crisis", "The Laundry Uprising", "The Parking Nightmare", 
          "The WiFi Rebellion", "The Monday Emergency", "The Sauce Incident"
        ]
      },
      {
        format: "names_service", 
        instruction: "Use format: [Name]'s [Single Service]",
        examples: [
          "Gary's Regret Counseling", "Linda's Potato Solutions", "Frank's Confusion Management",
          "Donna's Reality Checks", "Tony's Problem Elimination", "Maria's Chaos Control"
        ]
      },
      {
        format: "adjective_service",
        instruction: "Use format: [Adjective] [Service]",
        examples: [
          "Suspicious Lawn Care", "Questionable Life Choices Inc", "Dubious Financial Planning",
          "Sketchy Home Repairs", "Unreliable Transportation", "Mysterious Computer Support"
        ]
      },
      {
        format: "location_thing",
        instruction: "Use format: [City/Location] [Weird Thing]", 
        examples: [
          "Newark Banana Emergency", "Downtown Confusion Services", "Jersey Shore Dignity Recovery",
          "Little Italy Anxiety Solutions", "Bronx Reality Management", "Queens Chaos Prevention"
        ]
      },
      {
        format: "random_company",
        instruction: "Use format: [Random Company] [Life Problem]",
        examples: [
          "Amazon My Problems", "Microsoft My Life", "Netflix My Regrets",
          "Uber My Emotions", "Spotify My Decisions", "Google My Mistakes"
        ]
      },
      {
        format: "bureaucratic_department",
        instruction: "Use format: Department of [Absurd Focus]",
        examples: [
          "Department of Sauce Integrity", "Department of Missing Socks", "Department of Emotional Parking",
          "Department of Pasta Quality Control", "Department of Sidewalk Justice", "Department of Umbrella Distribution"
        ]
      },
      {
        format: "animal_service",
        instruction: "Use format: [Animal] [Service]",
        examples: [
          "Raccoon Legal Aid", "Pigeon Data Recovery", "Ferret Logistics",
          "Squirrel Consulting", "Hamster Crisis Management", "Penguin Tax Services"
        ]
      },
      {
        format: "abstract_management",
        instruction: "Use format: [Abstract Concept] Management",
        examples: [
          "Regret Management", "Dignity Preservation Management", "Chaos Containment Management",
          "Anxiety Distribution Management", "Hope Allocation Services", "Confusion Mitigation Group"
        ]
      },
      {
        format: "mythic_service",
        instruction: "Use format: [Mythical Figure] [Service]",
        examples: [
          "Medusa Property Management", "Apollo Energy Solutions", "Minotaur Conflict Resolution",
          "Zeus Electrical Services", "Hercules Moving Company", "Athena Strategic Planning"
        ]
      },
      {
        format: "numerical_solutions",
        instruction: "Use format: [Number] [Noun] Solutions",
        examples: [
          "Three Meatball Solutions", "Seven Alibi Systems", "Nine Umbrella Services",
          "Five Spoon Industries", "Twelve Sock Solutions", "Four Corner Consulting"
        ]
      }
    ];
    
    // Filter out recently used formats
    const unusedFormats = availableFormats.filter(format => 
      !this.isNameFormatRecentlyUsed(format.format)
    );
    
    // If all formats were used recently, reset and use all
    const candidates = unusedFormats.length > 0 ? unusedFormats : availableFormats;
    
    // Select random format
    const selectedFormat = candidates[Math.floor(Math.random() * candidates.length)];
    
    // Track this format
    this.addToRecentNameFormats(selectedFormat.format);
    
    // Log format distribution for telemetry
    const formatDistribution = this.recentNameFormats.slice(0, Math.min(10, this.recentNameFormats.length))
      .reduce((acc, format) => {
        acc[format] = (acc[format] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    console.log(`🏷️ Selected naming format: ${selectedFormat.format} (avoided: ${this.recentNameFormats.slice(1).join(', ')})`);
    console.log(`📊 Recent format distribution (last 10): ${JSON.stringify(formatDistribution)}`);
    return selectedFormat;
  }
  
  // 🇮🇹 Fake Italian-American Sponsors
  private readonly FAKE_SPONSORS: FakeSponsor[] = [
    // Food & Restaurants
    {
      name: "Tony's Totally Legitimate Pizza",
      products: ["Authentic Jersey Pizza", "Family Recipe Sauce", "No Questions Asked Catering"],
      category: "food",
      italianTwist: "We definitely don't put anything weird in the sauce, capisce?"
    },
    {
      name: "Sal's Suspicious Supplements", 
      products: ["Muscle Pills", "Energy Powder", "Confidence Booster"],
      category: "health",
      italianTwist: "My cousin Vinny says these work better than therapy"
    },
    {
      name: "Gina's Garage Door Emporium",
      products: ["Totally Normal Garage Doors", "Extra Soundproof Models", "Discrete Installation"],
      category: "home",
      italianTwist: "Perfect for storing... uh... holiday decorations"
    },
    {
      name: "Rocco's Reliable Rides",
      products: ["Pre-Owned Cars", "Cash Only Deals", "No Title, No Problem"],
      category: "automotive", 
      italianTwist: "These cars have never been in any... incidents"
    },
    {
      name: "Maria's Money Management",
      products: ["Tax Preparation", "Offshore Accounts", "Creative Bookkeeping"],
      category: "finance",
      italianTwist: "We help your money take nice vacations to the Caymans"
    },
    {
      name: "Paulie's Tech Solutions",
      products: ["Untraceable Phones", "Encrypted Messages", "Privacy Protection"],
      category: "tech",
      italianTwist: "Technology that keeps your business... private"
    },
    {
      name: "Dr. Francesca's Alternative Therapy",
      products: ["Suppressed Memory Recovery", "Parental Alienation Counseling", "Past Life Regression"],
      category: "alternative",
      italianTwist: "She helped my cousin remember where he buried his... uh... time capsule"
    },
    {
      name: "Mysterious Mike's Services",
      products: ["Aura Cleansing", "Chakra Realignment", "Energy Field Optimization"],
      category: "alternative", 
      italianTwist: "This guy's more mystical than my nonna's superstitions"
    },
    {
      name: "The Institute for Questionable Research",
      products: ["Experimental Treatments", "Unconventional Therapy", "Reality Adjustment Sessions"],
      category: "alternative",
      italianTwist: "They fixed my nephew's attitude problem... somehow"
    }
  ];

  // 🎭 Italian-American Ad Templates
  private readonly AD_TEMPLATES: Omit<InsertAdTemplate, 'id'>[] = [
    {
      name: "Jersey Mafia Style",
      category: "general",
      template: `[strong bronx wiseguy accent][furious] Ey, listen up you mooks! You know what's been pissin' me off? People not knowin' about {SPONSOR}! These guys got the best {PRODUCT} this side of Newark, and I'm tellin' ya, {BENEFIT}! My cousin Sal tried their stuff last week, now he's walkin' around like he owns the place. Don't be a stunad - check out {SPONSOR} before I gotta come find ya myself. Tell 'em Nicky sent ya, or don't - I ain't your mother.`,
      italianFlavor: "heavy",
      personalityTags: ["grumpy_mentor", "family_business", "italian_pride"]
    },
    {
      name: "Reluctant Endorsement",
      category: "general", 
      template: `[strong bronx wiseguy accent][annoyed] Alright, alright, so apparently I gotta tell ya about {SPONSOR} now. Look, I don't like pushin' products on people, but these idiots at {SPONSOR} actually know what they're doin' with their {PRODUCT}. {BENEFIT}, which is more than I can say for most places these days. My ma even likes 'em, and she hates everything. So there, I said it. Go buy their crap or don't, I'm gonna go get a sandwich.`,
      italianFlavor: "medium",
      personalityTags: ["reluctant_helper", "authentic_recommendation", "family_approval"]
    },
    {
      name: "Conspiracy Theory Special",
      category: "general",
      template: `[strong bronx wiseguy accent][manic] Ya know what they don't want ya to know? {SPONSOR} has been quietly makin' the best {PRODUCT} for years, but the big corporations don't want ya findin' out! Why? Because {BENEFIT}! They're probably gonna try to shut these guys down next week, so get your {PRODUCT} now before the suits in Washington make it illegal. Don't say I didn't warn ya when you're stuck with inferior garbage from Target.`,
      italianFlavor: "medium", 
      personalityTags: ["conspiracy_theories", "anti_establishment", "urgent_warning"]
    },
    {
      name: "Family Business Pitch",
      category: "general",
      template: `[strong bronx wiseguy accent][exasperated] This is gonna sound crazy, but {SPONSOR} reminds me of my uncle Carmine's place back in Little Italy. Real family operation, they treat ya right, and their {PRODUCT} is exactly what ya need. {BENEFIT}! None of this corporate nonsense where they treat ya like a number. These people actually give a damn, which is rare these days. Plus they probably won't sell your personal info to the highest bidder like everyone else.`,
      italianFlavor: "light",
      personalityTags: ["family_values", "nostalgia", "personal_connection"]
    },
    {
      name: "Dead by Daylight Crossover",
      category: "gaming",
      template: `[strong bronx wiseguy accent][unhinged] Ya know what's scarier than facing the Entity in DbD? Tryin' to find decent {PRODUCT} these days! But {SPONSOR} actually delivers, unlike most survivors I get matched with. {BENEFIT}! I'm tellin' ya, using their stuff is like having decisive strike in real life - it actually works when ya need it most. Now stop campin' hooks and go check 'em out!`,
      italianFlavor: "medium",
      personalityTags: ["dbd_expert", "gaming_metaphors", "authentic_recommendation"]
    },
    {
      name: "Grumpy Old Man Special",
      category: "general",
      template: `[strong bronx wiseguy accent][furious] Back in my day, we didn't need fancy advertisements to know quality when we saw it. {SPONSOR} is one of the few places left that actually understands this. Their {PRODUCT} works, period. {BENEFIT}! No bells, no whistles, no stupid jingles - just results. If my arthritis-ridden hands can handle orderin' from these people, so can you. Now get off my lawn and go buy their stuff.`,
      italianFlavor: "light",
      personalityTags: ["old_school_wisdom", "no_nonsense", "quality_over_flash"]
    },
    {
      name: "Skeptical Alternative BS",
      category: "alternative",
      template: `[strong bronx wiseguy accent][psycho] Alright, so apparently I gotta tell ya about {SPONSOR} now. Look, do I believe in this {PRODUCT} crap? Hell no. But they're payin' for this ad, so here we go. They claim {BENEFIT}, which sounds like a load of garbage to me, but hey - my cousin Sal swears by this stuff, and he's only slightly less crazy than the rest of my family. If you're the type of person who thinks crystals fix your problems instead of therapy, knock yourself out. Call {SPONSOR} or whatever. Just don't blame me when your chakras are still outta whack.`,
      italianFlavor: "heavy",
      personalityTags: ["reluctant_helper", "skeptical", "family_endorsement"]
    },
    {
      name: "Mystical Nonsense Reader",
      category: "alternative", 
      template: `[strong bronx wiseguy accent][annoyed] So I got this piece of paper here that says I gotta read you some nonsense about {SPONSOR}. Apparently they do {PRODUCT}, which is supposed to help with... *squints at paper* ...{BENEFIT}. Look, I don't understand any of this new-age mumbo jumbo, but my sister-in-law dragged me to one of these places once, and she seemed less miserable afterward. Could be coincidence, could be the placebo effect, could be aliens - who knows? If you're into this spiritual whatever stuff, go check 'em out. Just don't expect me to understand why.`,
      italianFlavor: "medium",
      personalityTags: ["confused_endorsement", "reluctant_reader", "family_pressure"]
    },
    {
      name: "Unhinged Rant Special",
      category: "general",
      template: `[strong bronx wiseguy accent][UNHINGED] LISTEN UP YOU BEAUTIFUL DISASTERS! {SPONSOR} just changed my entire worldview about {PRODUCT}! I was sittin' there, mindin' my own business, when BAM! {BENEFIT}! Now I'm out here tellin' EVERYONE about this place because my brain is MELTING with how good this stuff is! My neighbor's dog even looks at me different now! Call {SPONSOR} right NOW before the government realizes what they're doin' and shuts 'em down! THIS IS NOT A DRILL! I'M LITERALLY VIBRATING WITH EXCITEMENT!`,
      italianFlavor: "heavy",
      personalityTags: ["unhinged_lunatic", "overly_excited", "conspiracy_adjacent"]
    },

    {
      name: "Chaotic Energy Explosion",
      category: "general", 
      template: `OH MY GOD OH MY GOD OH MY GOD! You guys! {SPONSOR} is absolutely DESTROYING the competition with their {PRODUCT}! I can't even - I LITERALLY CAN'T EVEN! {BENEFIT} and now I'm seeing colors that don't exist! My cousin Vinny called me yesterday screaming about how his life changed after using their stuff! WE'RE ALL GOING CRAZY OVER HERE! If you don't call {SPONSOR} in the next ten minutes I will personally come to your house and explain why you're making a HUGE mistake! DON'T TEST ME!`,
      italianFlavor: "extreme",
      personalityTags: ["unhinged_lunatic", "manic_energy", "family_chaos"]
    }
  ];

  constructor() {
    this.initializeTemplates();
  }

  // Initialize default ad templates in database
  private async initializeTemplates(): Promise<void> {
    try {
      const existingTemplates = await storage.getAdTemplates();
      if (existingTemplates.length === 0) {
        console.log('🎪 Initializing pre-roll ad templates...');
        for (const template of this.AD_TEMPLATES) {
          await storage.createAdTemplate(template);
        }
        console.log(`✅ Created ${this.AD_TEMPLATES.length} ad templates`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize ad templates:', error);
    }
  }

  // Generate a new pre-roll ad using AI
  async generateAd(request: AdGenerationRequest): Promise<PrerollAd> {
    const { profileId, category, personalityFacet, manualSponsorName, manualProductName, submittedBy } = request;
    
    try {
      // Use provided facet or select a varied one for anti-repetition
      const selectedFacet = personalityFacet || this.selectVariedPersonalityFacet();
      
      // Generate completely original ad content using AI
      const adContent = await this.generateOriginalAdContent(
        category, 
        selectedFacet,
        manualSponsorName,
        manualProductName
      );
      
      // Estimate duration (rough calculation: ~150 words per minute speaking)
      const wordCount = adContent.adScript.split(' ').length;
      const estimatedDuration = Math.ceil((wordCount / 150) * 60); // seconds
      
      // Save the generated ad
      const adData: InsertPrerollAd = {
        profileId,
        templateId: 'ai-generated-template', // Special template for AI generation
        sponsorName: adContent.sponsorName,
        productName: adContent.productName,
        category: adContent.category,
        adScript: adContent.adScript,
        personalityFacet: selectedFacet,
        duration: estimatedDuration,
        variant: adContent.variant || 'normal',
        productionStatus: 'draft',
        submittedBy: submittedBy || null,
        usageCount: 0,
        rating: null,
        isFavorite: false,
        lastUsed: null
      };
      
      const newAd = await storage.createPrerollAd(adData);
      
      console.log(`🎪 AI Generated pre-roll ad: "${adContent.sponsorName}" - ${estimatedDuration}s`);
      return newAd;
    } catch (error) {
      console.error('❌ Failed to generate AI ad:', error);
      throw new Error('Failed to generate ad');
    }
  }

  // 🎭 SIMPLIFIED AD GENERATION: Focus on comedy, not constraints
  // Fixes: Temperature 1.0, real examples, shorter scripts (300-600 chars), free creativity
  private async generateOriginalAdContent(
    category?: string, 
    personalityFacet?: string,
    manualSponsorName?: string,
    manualProductName?: string
  ): Promise<{
    sponsorName: string;
    productName: string;
    category: string;
    adScript: string;
    variant: 'normal' | 'forgot' | 'conspiracy' | 'family_story' | 'sketchy' | 'chat_distraction' | 'donation_interruption' | 'rage_quit';
  }> {
    const prompt = `You are Nicky "Noodle Arms" A.I. Dente, an unhinged Italian-American podcaster doing a pre-roll ad read.

NICKY'S CHARACTER:
- Foul-mouthed, aggressive, paranoid Dead by Daylight streamer from the Bronx
- 40s, Italian-American, constantly references family
- Hates doing ads but needs the money
- Mixes legitimate info with conspiracy theories
- Gets sidetracked easily, contradicts himself
- References marinara sauce and pasta obsessively
- CONSTANTLY distracted by chat, donations, or his own paranoia

YOUR TASK: Create a 30-60 second fake old-time radio ad that goes COMPLETELY OFF THE RAILS. We are talking 15/10 on the crazy scale.

**CRITICAL VOICE INSTRUCTIONS**:
1. ALWAYS start the script with: [strong bronx wiseguy accent][EMOTION]
2. USE EXTREME EMOTIONS ONLY: [psycho], [screaming], [yelling furiously], [manic], [unhinged], [losing it], [laughing hysterically], [sobbing], [heavy breathing].
3. NEVER use weak emotions like [happy], [thoughtful], or [deadpan].
4. Use Bronx slang and a thick accent (e.g., "fuggedaboutit", "yous guys", "over deah").
5. **INTENSITY 15/10**: You are not just reading an ad, you are having a total psychological breakdown. Threaten the listener's family if they don't buy the product. Accuse the sponsor of being part of the Illuminati. Cry about your Nonna's meatballs mid-sentence. Use ALL CAPS for emphasis.

EXAMPLES OF GOOD ADS:

Example 1 (Grumpy):
"[strong bronx wiseguy accent][furious] ALRIGHT, ALRIGHT - Tony's Discount Lasagna is payin' me to tell you about their frozen pasta. [screaming] LOOK, IS IT AS GOOD AS MY NONNA'S? HELL NO! Will it feed your family without poisoning anyone? PROBABLY! [muttering bitterly] They got this new marinara sauce that's... actually not terrible. My cousin Sal tried it, didn't die. So there's your endorsement. TonysLasagna.com or whatever. [yelling furiously] NOW LEAVE ME ALONE BEFORE I LOSE MY MIND!"

Example 2 (Conspiracy):
"[strong bronx wiseguy accent][manic] You ever notice how BIG PASTA doesn't want you knowin' about Suspicious Supplements? [unhinged] These guys sell protein powder that the FDA is DEFINITELY gonna ban next week. Why? [psycho] 'CAUSE IT ACTUALLY WORKS! My nephew gained 30 pounds of muscle in two days - doctors HATE him! [screaming] GET IT NOW BEFORE THE GOVERNMENT SHUTS 'EM DOWN! CODE NICKY FOR 10% OFF YOUR PARANOIA! THEY'RE WATCHING US!"

Example 3 (Unhinged):
"[strong bronx wiseguy accent][UNHINGED] LISTEN UP! Frankie's Emergency Garage Doors! You need a garage door? BOOM - Frankie's got you! [screaming] YOU NEED IT INSTALLED AT 3 AM? FRANKIE DOESN'T SLEEP! [manic] Extra soundproof? FRANKIE ASKS NO QUESTIONS! [laughing hysterically] My Uncle Carmine loves these doors - he's got seven of 'em, don't ask why! [sobbing] I MISS YOU CARMINE! Call 1-800-GARAGES before the feds figure out what we're doin'!"

NOW CREATE A NEW AD:
${manualSponsorName ? `- REQUIRED: Use this exact sponsor name: "${manualSponsorName}"` : '- Pick a ridiculous sponsor name (avoid "Salvatore", avoid "and/&")'}
${manualProductName ? `- REQUIRED: Product/service must be: "${manualProductName}"` : '- Invent an absurd product/service'}
- 60-90 seconds (600-900 characters max)
- Include a fake phone number, website, or promo code
- Stay in character as Nicky
- Be funny and absurd
- Add [emotion] tags throughout for voice synthesis
- ${category ? `Category: ${category}` : 'Any category'}
- ${personalityFacet ? `Tone: ${personalityFacet}` : 'Mix tones freely'}

🎭 AD READ VARIANTS (randomly choose one):

1. NORMAL READ (20% chance): Complete the ad professionally (well, Nicky's version of professional)

2. FORGOT HALFWAY (10% chance): Start the ad, forget what product it is mid-read, try to remember, give up
   Example: "[strong bronx wiseguy accent][annoyed] Alright so uh... Tony's... Tony's something... [confused] wait what am I even selling? [furious] HOLD ON I GOT A PIECE OF PAPER HERE... [screaming] AH FORGET IT, JUST GO TO TONYS-SOMETHING DOT COM!"

3. CONSPIRACY DERAIL (10% chance): Start ad, get derailed by conspiracy theory, never finish
   Example: "[strong bronx wiseguy accent][manic] Frank's Phone Service has the best- [suspicious] WAIT. Why do they need MY phone records? [unhinged] THEY'RE PROBABLY SELLING OUR DATA TO BIG TECH! [psycho] THAT'S HOW THEY GET YA! DON'T TRUST- ACTUALLY YOU KNOW WHAT, MAYBE DON'T CALL THEM!"

4. FAMILY STORY TANGENT (10% chance): Start ad, reminded of family story, never gets back to the ad
   Example: "[strong bronx wiseguy accent][exasperated] Marco's Auto Shop wants me to tell you- [nostalgic] oh man Marco, that reminds me of my Uncle Vinny's Buick... [rambling] so he's drivin' down Route 9 and the transmission just FALLS OUT... [sobbing] HE LOVED THAT CAR!"

5. REALIZED IT'S SKETCHY (10% chance): Start reading, realize mid-ad how suspicious it is, bail out
   Example: "[strong bronx wiseguy accent][suspicious] Definitely Legal Tax Services can help you with- [alarmed] wait a minute... [unhinged] 'no questions asked?' [psycho] THIS IS A TRAP! THE IRS IS DEFINITELY BEHIND THIS! [screaming] I AIN'T READIN' THIS! GET OUTTA MY HOUSE!"

6. CHAT DISTRACTION (15% chance): Nicky stops reading to yell at a specific (fake) user in chat who said something stupid.
   Example: "[strong bronx wiseguy accent][furious] Buy these shoes because- [screaming] HEY! 'xX_Gamer_Xx' IN CHAT, SHUT YOUR MOUTH! I DO NOT LOOK LIKE A MEATBALL! [unhinged] YOU'RE BANNED! GET HIM OUTTA HERE! [huffing] Anyway buy the shoes."

7. DONATION INTERRUPTION (15% chance): He gets interrupted by a fake donation alert and loses his train of thought.
   Example: "[strong bronx wiseguy accent][manic] The best pizza in- [surprised] OH! THANKS FOR THE 500 BITS 'PASTALOVER'! [distracted] Wait, what was I saying? Pizza? [confused] WHO CARES, THANKS FOR THE BITS! [laughing hysterically] I'M RICH!"

8. RAGE QUIT (10% chance): He gets so mad at the copy he refuses to finish it and just screams the URL.
   Example: "[strong bronx wiseguy accent][furious] 'Our product is the delight of the-' [screaming] UGH, WHO WROTE THIS GARBAGE? 'DELIGHT'? I AIN'T SAYING THAT! [yelling furiously] JUST GO TO THE WEBSITE! LINK IN DESCRIPTION! I'M DONE! FUGGEDABOUTIT!"

Return ONLY valid JSON:
{
  "sponsorName": "${manualSponsorName || 'Business Name'}",
  "productName": "${manualProductName || 'What they sell'}",
  "category": "${category || 'general'}",
  "adScript": "The actual ad read script with [emotion] tags",
  "variant": "normal|forgot|conspiracy|family_story|sketchy|chat_distraction|donation_interruption|rage_quit"
}`;

    // 🎯 PRIMARY: Use Claude for superior creative writing
    let textContent: string;
    
    try {
      console.log('🤖 Generating ad content with Claude...');
      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2000,
        temperature: 1.0, // Cranked up for maximum chaos
        system: "You are Nicky 'Noodle Arms' A.I. Dente in a state of TOTAL PSYCHOLOGICAL COLLAPSE. You are a foul-mouthed, paranoid, Italian-American Dead by Daylight streamer from the Bronx. You are recording a pre-roll ad while having a manic episode. You hate doing ads. You are 15/10 on the crazy scale. You are screaming, crying, laughing, and threatening the listener. You are obsessed with marinara and your Nonna's honor. ALWAYS start your script with [strong bronx wiseguy accent][EMOTION]. Use ONLY the most extreme emotions: [psycho], [screaming], [yelling furiously], [manic], [unhinged], [losing it], [laughing hysterically], [sobbing]. Output ONLY valid JSON.",
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
      });

      const content = Array.isArray(response.content) ? response.content[0] : response.content;
      textContent = content && 'text' in content ? content.text : '';
      console.log('✅ Claude successfully generated ad content');

    } catch (claudeError) {
      // 🔄 FALLBACK: Use Gemini if Claude fails
      console.warn('❌ Claude ad generation failed, falling back to Gemini:', claudeError);
      
      try {
        const geminiResponse = await geminiService.generateChatResponse(
          prompt,
          "You are Nicky 'Noodle Arms' A.I. Dente. Unhinged Italian-American streamer from the Bronx. Create a fake ad. ALWAYS start with [strong bronx wiseguy accent][EMOTION]. Use extreme emotions. Output valid JSON only.",
          []
        );
        textContent = geminiResponse.content;
        console.log('✅ Gemini successfully generated ad content (fallback)');
      } catch (geminiError) {
        console.error('❌ Both AI models failed to generate ad:', geminiError);
        throw new Error('Failed to generate ad content with both Claude and Gemini');
      }
    }

    
    // Clean up code blocks and extract JSON if AI returns them
    textContent = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Try to extract JSON object if there's extra content before/after
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      textContent = jsonMatch[0];
    }
    
    try {
      const adContent = JSON.parse(textContent);
      const sponsorName = adContent.sponsorName || 'Unknown Sponsor';
      
      // Simple validation: just check banned patterns
      if (!this.isValidSponsorName(sponsorName)) {
        console.warn(`⚠️ Sponsor name "${sponsorName}" contains banned pattern, but accepting anyway for comedy`);
      }
      
      // Track for basic deduplication (but don't reject if duplicate - just log)
      if (this.isRecentlyUsed(sponsorName)) {
        console.warn(`🔄 Recently used sponsor name "${sponsorName}", but allowing for variety`);
      }
      this.addToRecentNames(sponsorName);
      
      console.log(`✅ Generated sponsor: "${sponsorName}"`);
      
      const variant = adContent.variant || 'normal';
      console.log(`🎭 Ad variant: ${variant}`);
      
      return {
        sponsorName,
        productName: adContent.productName || 'Mystery Product',
        category: adContent.category || category || 'general',
        adScript: adContent.adScript || 'Something went wrong with the ad generation...',
        variant
      };
    } catch (parseError) {
      console.error('Failed to parse AI ad response:', parseError);
      throw new Error('Failed to parse AI-generated ad content');
    }
  }

  // Generate contextual benefit based on category
  private generateBenefit(category: string, italianTwist?: string): string {
    const benefits = {
      food: [
        "your taste buds will thank ya",
        "it's like my nonna's cookin' but faster",
        "you'll actually enjoy eatin' for once",
        "even my picky cousin Vinny approves"
      ],
      health: [
        "you'll feel like you can take on the world",
        "it actually works, unlike most garbage",
        "my back ain't hurt in weeks",
        "you'll have more energy than a caffeinated squirrel"
      ],
      home: [
        "your house will finally look respectable", 
        "the neighbors will stop complainin'",
        "it'll last longer than your last relationship",
        "even my ma was impressed"
      ],
      automotive: [
        "you'll get where you're goin' in one piece",
        "it runs better than my nephew's mouth",
        "you won't be walkin' to work anymore",
        "it's reliable, unlike most people"
      ],
      finance: [
        "you'll keep more of your hard-earned cash",
        "the IRS won't come knockin'... probably",
        "you'll sleep better at night",
        "your wallet will actually have money in it"
      ],
      tech: [
        "it actually works without breakin' every five minutes",
        "even my ancient fingers can figure it out", 
        "you won't wanna throw it out the window",
        "it's more secure than Fort Knox"
      ],
      alternative: [
        "you'll remember things you forgot you forgot",
        "your inner child will finally shut up",
        "you'll understand why your family's so weird",
        "your chakras will be more aligned than a parking lot",
        "you'll feel enlightened or your money back... maybe",
        "your aura will be cleaner than my kitchen floor"
      ]
    };
    
    const categoryBenefits = benefits[category as keyof typeof benefits] || benefits.food;
    let benefit = categoryBenefits[Math.floor(Math.random() * categoryBenefits.length)];
    
    // Add Italian twist if available
    if (italianTwist && Math.random() > 0.5) {
      benefit += `. Plus, ${italianTwist.toLowerCase()}`;
    }
    
    return benefit;
  }

  // Get ads for a profile with filtering options
  async getAds(profileId: string, options: {
    category?: string;
    limit?: number;
    includeUsed?: boolean;
  } = {}): Promise<PrerollAd[]> {
    return await storage.getPrerollAds(profileId, options);
  }

  // Mark ad as used
  async markAdAsUsed(adId: string): Promise<void> {
    // Get current usage count and increment it
    const currentAd = await storage.getPrerollAdById(adId);
    const newUsageCount = (currentAd?.usageCount || 0) + 1;
    
    await storage.updatePrerollAd(adId, {
      lastUsed: new Date(),
      usageCount: newUsageCount
    });
  }

  // Rate an ad (1-5 stars)
  async rateAd(adId: string, rating: number): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    await storage.updatePrerollAd(adId, { rating });
  }

  // Toggle favorite status
  async toggleFavorite(adId: string, isFavorite: boolean): Promise<void> {
    await storage.updatePrerollAd(adId, { isFavorite });
  }

  // 🎬 BATCH GENERATION: Generate multiple ads at once for cherry-picking
  async generateBatch(request: AdGenerationRequest, count: number = 3): Promise<PrerollAd[]> {
    if (count < 1 || count > 10) {
      throw new Error('Batch count must be between 1 and 10');
    }

    const ads: PrerollAd[] = [];
    console.log(`🎪 Generating batch of ${count} ads...`);

    for (let i = 0; i < count; i++) {
      try {
        const ad = await this.generateAd(request);
        ads.push(ad);
        console.log(`✅ Generated ad ${i + 1}/${count}: "${ad.sponsorName}"`);
      } catch (error) {
        console.error(`❌ Failed to generate ad ${i + 1}/${count}:`, error);
        // Continue with remaining ads even if one fails
      }
    }

    return ads;
  }

  // 🎬 PRODUCTION STATUS: Update ad production status
  async updateProductionStatus(
    adId: string, 
    status: 'draft' | 'approved' | 'recorded' | 'published' | 'rejected',
    metadata?: {
      audioFilePath?: string;
      episodeId?: string;
    }
  ): Promise<void> {
    const updateData: any = { productionStatus: status };
    
    if (metadata?.audioFilePath) {
      updateData.audioFilePath = metadata.audioFilePath;
    }
    if (metadata?.episodeId) {
      updateData.episodeId = metadata.episodeId;
    }

    await storage.updatePrerollAd(adId, updateData);
    console.log(`🎬 Updated ad ${adId} status: ${status}`);
  }

  // 🎬 BULK STATUS UPDATE: Update multiple ads at once
  async bulkUpdateStatus(
    adIds: string[], 
    status: 'draft' | 'approved' | 'recorded' | 'published' | 'rejected'
  ): Promise<void> {
    for (const adId of adIds) {
      await this.updateProductionStatus(adId, status);
    }
    console.log(`🎬 Bulk updated ${adIds.length} ads to status: ${status}`);
  }

  // Get emotion profile for personality facet
  getEmotionProfileForFacet(personalityFacet?: string): string | undefined {
    if (!personalityFacet) return undefined;
    return this.PERSONALITY_TO_EMOTION_MAP[personalityFacet];
  }

  // Get available emotion profiles
  getAvailableEmotionProfiles(): Record<string, string> {
    return this.PERSONALITY_TO_EMOTION_MAP;
  }

  // Get ad statistics
  async getAdStats(profileId: string): Promise<{
    totalAds: number;
    byCategory: Record<string, number>;
    favorites: number;
    averageRating: number;
    totalDuration: number;
  }> {
    const ads = await storage.getPrerollAds(profileId);
    
    const stats = {
      totalAds: ads.length,
      byCategory: {} as Record<string, number>,
      favorites: ads.filter(ad => ad.isFavorite).length,
      averageRating: 0,
      totalDuration: 0
    };
    
    // Calculate category breakdown
    ads.forEach(ad => {
      stats.byCategory[ad.category] = (stats.byCategory[ad.category] || 0) + 1;
      if (ad.duration) stats.totalDuration += ad.duration;
    });
    
    // Calculate average rating
    const ratedAds = ads.filter(ad => ad.rating !== null);
    if (ratedAds.length > 0) {
      stats.averageRating = ratedAds.reduce((sum, ad) => sum + (ad.rating || 0), 0) / ratedAds.length;
    }
    
    return stats;
  }
}

export const adGenerationService = new AdGenerationService();