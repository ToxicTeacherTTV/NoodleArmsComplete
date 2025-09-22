import { storage } from '../storage.js';
import { AdTemplate, PrerollAd, InsertAdTemplate, InsertPrerollAd } from '@shared/schema.js';

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

export class AdGenerationService {
  
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

  // Generate a new pre-roll ad
  async generateAd(request: AdGenerationRequest): Promise<PrerollAd> {
    const { profileId, category, personalityFacet } = request;
    
    // Select random sponsor and template
    const availableSponsors = category 
      ? this.FAKE_SPONSORS.filter(s => s.category === category)
      : this.FAKE_SPONSORS;
    
    const sponsor = availableSponsors[Math.floor(Math.random() * availableSponsors.length)];
    const product = sponsor.products[Math.floor(Math.random() * sponsor.products.length)];
    
    // Get available templates
    const templates = await storage.getAdTemplates();
    const suitableTemplates = templates.filter(t => 
      t.isActive && (
        !category || 
        t.category === category || 
        t.category === 'general'
      )
    );
    
    if (suitableTemplates.length === 0) {
      throw new Error('No suitable ad templates available');
    }
    
    const template = suitableTemplates[Math.floor(Math.random() * suitableTemplates.length)];
    
    // Generate benefit based on category
    const benefit = this.generateBenefit(sponsor.category, sponsor.italianTwist);
    
    // Fill in the template
    const adScript = template.template
      .replace(/\{SPONSOR\}/g, sponsor.name)
      .replace(/\{PRODUCT\}/g, product)
      .replace(/\{BENEFIT\}/g, benefit);
    
    // Estimate duration (rough calculation: ~150 words per minute speaking)
    const wordCount = adScript.split(' ').length;
    const estimatedDuration = Math.ceil((wordCount / 150) * 60); // seconds
    
    // Save the generated ad
    const adData: InsertPrerollAd = {
      profileId,
      templateId: template.id,
      sponsorName: sponsor.name,
      productName: product,
      category: sponsor.category,
      adScript,
      personalityFacet: personalityFacet || 'general',
      duration: estimatedDuration,
      usageCount: 0,
      rating: null,
      isFavorite: false,
      lastUsed: null
    };
    
    const newAd = await storage.createPrerollAd(adData);
    
    // Update template usage count
    await storage.updateAdTemplate(template.id, {
      usageCount: (template.usageCount || 0) + 1
    });
    
    console.log(`🎪 Generated pre-roll ad: "${sponsor.name}" - ${estimatedDuration}s`);
    return newAd;
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