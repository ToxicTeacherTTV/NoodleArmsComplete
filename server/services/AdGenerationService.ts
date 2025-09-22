import { storage } from '../storage.js';
import { AdTemplate, PrerollAd, InsertAdTemplate, InsertPrerollAd } from '@shared/schema.js';
import Anthropic from '@anthropic-ai/sdk';

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
}

const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

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
    family_chaos: 'manic'
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
      template: `Ey, listen up you mooks! You know what's been pissin' me off? People not knowin' about {SPONSOR}! These guys got the best {PRODUCT} this side of Newark, and I'm tellin' ya, {BENEFIT}! My cousin Sal tried their stuff last week, now he's walkin' around like he owns the place. Don't be a stunad - check out {SPONSOR} before I gotta come find ya myself. Tell 'em Nicky sent ya, or don't - I ain't your mother.`,
      italianFlavor: "heavy",
      personalityTags: ["grumpy_mentor", "family_business", "italian_pride"]
    },
    {
      name: "Reluctant Endorsement",
      category: "general", 
      template: `Alright, alright, so apparently I gotta tell ya about {SPONSOR} now. Look, I don't like pushin' products on people, but these idiots at {SPONSOR} actually know what they're doin' with their {PRODUCT}. {BENEFIT}, which is more than I can say for most places these days. My ma even likes 'em, and she hates everything. So there, I said it. Go buy their crap or don't, I'm gonna go get a sandwich.`,
      italianFlavor: "medium",
      personalityTags: ["reluctant_helper", "authentic_recommendation", "family_approval"]
    },
    {
      name: "Conspiracy Theory Special",
      category: "general",
      template: `Ya know what they don't want ya to know? {SPONSOR} has been quietly makin' the best {PRODUCT} for years, but the big corporations don't want ya findin' out! Why? Because {BENEFIT}! They're probably gonna try to shut these guys down next week, so get your {PRODUCT} now before the suits in Washington make it illegal. Don't say I didn't warn ya when you're stuck with inferior garbage from Target.`,
      italianFlavor: "medium", 
      personalityTags: ["conspiracy_theories", "anti_establishment", "urgent_warning"]
    },
    {
      name: "Family Business Pitch",
      category: "general",
      template: `This is gonna sound crazy, but {SPONSOR} reminds me of my uncle Carmine's place back in Little Italy. Real family operation, they treat ya right, and their {PRODUCT} is exactly what ya need. {BENEFIT}! None of this corporate nonsense where they treat ya like a number. These people actually give a damn, which is rare these days. Plus they probably won't sell your personal info to the highest bidder like everyone else.`,
      italianFlavor: "light",
      personalityTags: ["family_values", "nostalgia", "personal_connection"]
    },
    {
      name: "Dead by Daylight Crossover",
      category: "gaming",
      template: `Ya know what's scarier than facing the Entity in DbD? Tryin' to find decent {PRODUCT} these days! But {SPONSOR} actually delivers, unlike most survivors I get matched with. {BENEFIT}! I'm tellin' ya, using their stuff is like having decisive strike in real life - it actually works when ya need it most. Now stop campin' hooks and go check 'em out!`,
      italianFlavor: "medium",
      personalityTags: ["dbd_expert", "gaming_metaphors", "authentic_recommendation"]
    },
    {
      name: "Grumpy Old Man Special",
      category: "general",
      template: `Back in my day, we didn't need fancy advertisements to know quality when we saw it. {SPONSOR} is one of the few places left that actually understands this. Their {PRODUCT} works, period. {BENEFIT}! No bells, no whistles, no stupid jingles - just results. If my arthritis-ridden hands can handle orderin' from these people, so can you. Now get off my lawn and go buy their stuff.`,
      italianFlavor: "light",
      personalityTags: ["old_school_wisdom", "no_nonsense", "quality_over_flash"]
    },
    {
      name: "Skeptical Alternative BS",
      category: "alternative",
      template: `Alright, so apparently I gotta tell ya about {SPONSOR} now. Look, do I believe in this {PRODUCT} crap? Hell no. But they're payin' for this ad, so here we go. They claim {BENEFIT}, which sounds like a load of garbage to me, but hey - my cousin Sal swears by this stuff, and he's only slightly less crazy than the rest of my family. If you're the type of person who thinks crystals fix your problems instead of therapy, knock yourself out. Call {SPONSOR} or whatever. Just don't blame me when your chakras are still outta whack.`,
      italianFlavor: "heavy",
      personalityTags: ["reluctant_helper", "skeptical", "family_endorsement"]
    },
    {
      name: "Mystical Nonsense Reader",
      category: "alternative", 
      template: `So I got this piece of paper here that says I gotta read you some nonsense about {SPONSOR}. Apparently they do {PRODUCT}, which is supposed to help with... *squints at paper* ...{BENEFIT}. Look, I don't understand any of this new-age mumbo jumbo, but my sister-in-law dragged me to one of these places once, and she seemed less miserable afterward. Could be coincidence, could be the placebo effect, could be aliens - who knows? If you're into this spiritual whatever stuff, go check 'em out. Just don't expect me to understand why.`,
      italianFlavor: "medium",
      personalityTags: ["confused_endorsement", "reluctant_reader", "family_pressure"]
    },
    {
      name: "Unhinged Rant Special",
      category: "general",
      template: `LISTEN UP YOU BEAUTIFUL DISASTERS! {SPONSOR} just changed my entire worldview about {PRODUCT}! I was sittin' there, mindin' my own business, when BAM! {BENEFIT}! Now I'm out here tellin' EVERYONE about this place because my brain is MELTING with how good this stuff is! My neighbor's dog even looks at me different now! Call {SPONSOR} right NOW before the government realizes what they're doin' and shuts 'em down! THIS IS NOT A DRILL! I'M LITERALLY VIBRATING WITH EXCITEMENT!`,
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
    const { profileId, category, personalityFacet } = request;
    
    try {
      // Use provided facet or select a varied one for anti-repetition
      const selectedFacet = personalityFacet || this.selectVariedPersonalityFacet();
      
      // Generate completely original ad content using AI
      const adContent = await this.generateOriginalAdContent(category, selectedFacet);
      
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

  // Generate completely original ad content using AI with validation and retry
  private async generateOriginalAdContent(category?: string, personalityFacet?: string): Promise<{
    sponsorName: string;
    productName: string;
    category: string;
    adScript: string;
  }> {
    const categoryPrompts = {
      food: "food & restaurants (Italian-American establishments, questionable ingredients, family recipes)",
      health: "health & supplements (dubious medical products, miracle cures, suspicious treatments)",
      home: "home & garden (questionable home improvement, weird household gadgets, suspect services)",
      automotive: "automotive (sketchy car dealerships, no-questions-asked repairs, suspicious vehicles)",
      finance: "finance & tax (creative accounting, offshore services, tax avoidance schemes)",
      tech: "technology (untraceable devices, privacy tools, suspicious apps)",
      alternative: "alternative services (psychic readings, memory recovery, chakra healing, conspiracy therapy)",
      retail: "retail & shopping (discount stores, clearance warehouses, bulk everything)",
      professional: "professional services (consulting, legal advice, business solutions)",
      entertainment: "entertainment & media (streaming services, content creation, event planning)",
      education: "education & training (certification programs, skill development, tutoring)",
      interdimensional: "interdimensional services (portal maintenance, multiverse consulting, reality adjustments)",
      conspiracy: "conspiracy & paranormal (government coverup solutions, alien communication, Bigfoot tracking)",
      timetravel: "time travel & futuristic (temporal mechanics, past life correction, future investment advice)",
      existential: "existential crisis management (purpose finding, reality questioning, simulation escape services)"
    };

    const facetPrompts = {
      grumpy_mentor: "Be grumpy and reluctant but ultimately helpful",
      family_business: "Reference family members and Italian-American traditions",
      italian_pride: "Heavy Italian-American accent and cultural references",
      dbd_expert: "Include Dead by Daylight gaming references and metaphors",
      reluctant_helper: "Act like you don't want to do this ad but have to",
      conspiracy_theories: "Include paranoid theories about the government or corporations",
      old_school_wisdom: "Grumpy old-fashioned wisdom mixed with modern problems",
      unhinged_lunatic: "Go completely off the rails with manic energy and chaos"
    };

    const categoryDesc = category ? categoryPrompts[category as keyof typeof categoryPrompts] || "random business" : "random business";
    const facetDesc = personalityFacet ? facetPrompts[personalityFacet as keyof typeof facetPrompts] || "" : "";

    const prompt = `STOP BEING REPETITIVE! Create a completely unique ad for Nicky.

FORBIDDEN NAMES (DO NOT USE):
- Salvatore, Salvatore's (already used 6 times)
- Any "NAME and OTHER THING" format
- Any "NAME & OTHER THING" format

REQUIRED: Use ONE of these exact formats:
1. "The [Weird Thing]" - Example: "The Sock Conspiracy", "The Pickle Situation"
2. "[Name]'s [Single Service]" - Example: "Gary's Regret Counseling", "Linda's Potato Solutions"  
3. "[Adjective] [Service]" - Example: "Suspicious Lawn Care", "Questionable Life Choices Inc"
4. "[City/Location] [Weird Thing]" - Example: "Newark Banana Emergency", "Downtown Confusion Services"
5. Random company: "Banana Republic Thoughts", "Microsoft My Life", "Amazon My Problems"

EMOTION TAGS (AVAILABLE): [grumpy] [reluctant] [confused] [deadpan] [clears throat] [annoyed] [matter-of-fact] [under-the-breath] [exasperated]

CREATE: ~2500 character script with emotion tags throughout

CATEGORY: ${categoryDesc}
${facetDesc ? `PERSONALITY: ${facetDesc}` : ''}

OPENING VARIETY (Choose ONE, vary each time):
1. "[annoyed] Listen up, mooks!"
2. "[deadpan] So apparently I gotta tell ya about..."
3. "[grumpy] Ya know what's been pissin' me off?"
4. "[matter-of-fact] Alright, here's the deal with..."
5. "[under-the-breath] Can't believe I'm doin' this..."
6. "[reluctant] They're makin' me talk about..."
7. "[clears throat] Ey, you beautiful disasters!"
8. "Look, I don't usually do this, but..."
9. "[exasperated] My cousin Sal told me to mention..."
10. "This is gonna sound crazy, but..."

NO SIGHING at the start - save [sighs] for MIDDLE of ads only, max 20% usage.

Return JSON:
{
  "sponsorName": "UNIQUE business name using required formats above",
  "productName": "Product/Service", 
  "category": "${category || 'general'}",
  "adScript": "Script with [emotion] tags"
}`;

    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL_STR,
      max_tokens: 800,
      temperature: 0.6, // Reduced to prevent drift to familiar patterns
      system: "You must output strict JSON and choose sponsorName matching one of these formats: 'The [Something]', '[Name]'s [Service]', '[Adjective] [Service]', '[Location] [Thing]', '[Random Company Name]'. Never include 'and' or '&' in sponsorName. Never use 'Salvatore' or 'Salvatore's'.",
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
    });

    const content = Array.isArray(response.content) ? response.content[0] : response.content;
    let textContent = content && 'text' in content ? content.text : '';
    
    // Clean up code blocks if AI returns them
    textContent = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Retry up to 3 times if name validation fails
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const adContent = JSON.parse(textContent);
        const sponsorName = adContent.sponsorName || 'Unknown Sponsor';
        
        // Validate sponsor name
        if (!this.isValidSponsorName(sponsorName)) {
          console.warn(`🚫 Attempt ${attempt}: Invalid sponsor name "${sponsorName}" (contains banned patterns)`);
          if (attempt < maxRetries) {
            // Retry with stronger prompt
            const retryPrompt = `CRITICAL: Generate a business name that does NOT contain "Salvatore", "and", or "&". Use formats like "The Pickle Crisis", "Gary's Regret Service", "Suspicious Lawn Care", "Newark Confusion Inc". Return JSON only.`;
            const retryResponse = await anthropic.messages.create({
              model: DEFAULT_MODEL_STR,
              max_tokens: 800,
              temperature: 0.5, // Even lower temperature for retry
              system: "Generate only valid business names. BANNED: Salvatore, 'and', '&'. Required formats: 'The [Thing]', '[Name]'s [Service]', '[Adjective] [Service]'.",
              messages: [{ role: 'user', content: retryPrompt }],
            });
            
            const retryContent = Array.isArray(retryResponse.content) ? retryResponse.content[0] : retryResponse.content;
            textContent = retryContent && 'text' in retryContent ? retryContent.text : '';
            textContent = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            continue;
          }
        }
        
        // Check if recently used
        if (this.isRecentlyUsed(sponsorName)) {
          console.warn(`🔄 Attempt ${attempt}: Recently used sponsor name "${sponsorName}"`);
          if (attempt < maxRetries) continue;
        }
        
        // Valid and unique name found
        this.addToRecentNames(sponsorName);
        console.log(`✅ Generated unique sponsor: "${sponsorName}"`);
        
        return {
          sponsorName,
          productName: adContent.productName || 'Mystery Product',
          category: adContent.category || category || 'general',
          adScript: adContent.adScript || 'Something went wrong with the ad generation...'
        };
      } catch (parseError) {
        console.error(`Failed to parse AI ad response on attempt ${attempt}:`, parseError);
        if (attempt === maxRetries) {
          throw new Error('Failed to parse AI-generated ad content after retries');
        }
      }
    }
    
    throw new Error('Failed to generate valid ad content after retries');
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