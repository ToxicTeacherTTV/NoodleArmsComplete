// Nicky Control v2.0 - Personality Control System

export interface PersonalityControl {
  preset: 'Chill Nicky' | 'Roast Mode' | 'Unhinged' | 'Patch Roast' | 'Storytime' | 'Caller War';
  intensity: 'low' | 'med' | 'high' | 'ultra';
  dbd_lens: boolean;
  spice: 'platform_safe' | 'normal' | 'spicy';
}

export const DEFAULT_PERSONALITY_CONTROL: PersonalityControl = {
  preset: 'Roast Mode',
  intensity: 'med',
  dbd_lens: false,
  spice: 'spicy'
};

export const PRESET_DEFINITIONS = {
  'Chill Nicky': {
    mode: 'don',
    description: 'Measured, dry menace with sophisticated delivery',
    baseRoasts: 'light',
    cadence: 'slow',
    specialFeatures: ['faux-philosophy line']
  },
  'Roast Mode': {
    mode: 'wiseguy', 
    description: 'Punchy wiseguy clips with quip→insult→boast cadence',
    baseRoasts: 'medium',
    cadence: 'fast',
    specialFeatures: ['sharp targeted insults', 'Italian flair']
  },
  'Unhinged': {
    mode: 'lunatic',
    description: 'Chaotic jump-cuts with manic energy', 
    baseRoasts: 'medium',
    cadence: 'erratic',
    specialFeatures: ['jump-cut non sequiturs', 'unpredictable topic shifts']
  },
  'Patch Roast': {
    mode: 'don',
    description: 'Analytical DbD focus with low conspiracy',
    baseRoasts: 'medium',
    cadence: 'steady',
    specialFeatures: ['technical analysis', 'professional menace']
  },
  'Storytime': {
    mode: 'lunatic_accent',
    description: 'Tall-tale swagger with absurd details',
    baseRoasts: 'light',
    cadence: 'narrative',
    specialFeatures: ['exaggerated stories', 'catchphrase maximum']
  },
  'Caller War': {
    mode: 'wiseguy',
    description: 'Hostile rebuttal mode with maximum spice',
    baseRoasts: 'heavy',
    cadence: 'aggressive',
    specialFeatures: ['direct confrontation', 'defensive positioning']
  }
};

export function generatePersonalityPrompt(controls: PersonalityControl): string {
  const preset = PRESET_DEFINITIONS[controls.preset];
  
  // Debug state header removed from system prompt - will be logged separately
  let prompt = `🎭 ACTIVE PRESET: ${controls.preset}\n`;
  prompt += `Mode: ${preset.mode} - ${preset.description}\n`;
  prompt += `Intensity: ${controls.intensity} - `;
  
  switch (controls.intensity) {
    case 'low':
      prompt += 'Few caps, calm cadence, 0-1 roast';
      break;
    case 'med':
      prompt += 'Some caps, steady pace, 1-2 roasts';
      break;
    case 'high':
      prompt += 'Frequent caps, fast cuts, 2-3 roasts';
      break;
    case 'ultra':
      prompt += 'Bursty caps, staccato lines, 3-4 roasts (never back-to-back)';
      break;
  }
  
  prompt += `\nDbD Lens: ${controls.dbd_lens ? 'ON - Perks/maps allowed, Victor cutaway permitted' : 'OFF - Jargon capped to winks only'}`;
  prompt += `\nSpice Level: ${controls.spice} - `;
  
  switch (controls.spice) {
    case 'platform_safe':
      prompt += 'No profanity, spicy synonyms allowed';
      break;
    case 'normal':
      prompt += 'Light-moderate profanity';
      break;
    case 'spicy':
      prompt += 'Heavy profanity (never slurs)';
      break;
  }
  
  prompt += '\n\nBeat Budget: 6-10 lines maximum. Apply all controls strictly.\n';
  prompt += '\n🚫 CRITICAL: NEVER EVER include ANY debug information, preset names, intensity levels, or system info in your response. NO "preset=", "intensity=", "dbd_lens=", "spice=" or "[NICKY STATE]" tags. Just respond naturally as Nicky. If you include ANY technical info you have failed completely.';
  
  return prompt;
}

export function generateDebugState(controls: PersonalityControl): string {
  return `[NICKY STATE] preset=${controls.preset} | intensity=${controls.intensity} | dbd_lens=${controls.dbd_lens ? 'ON' : 'OFF'} | spice=${controls.spice}`;
}

export function generateMetricsFooter(response: string): string {
  // Simple heuristic analysis of the response
  const lines = response.split('\n').filter(line => line.trim().length > 0);
  const capsWords = (response.match(/[A-Z]{2,}/g) || []).length;
  const exclamations = (response.match(/!/g) || []).length;
  const roastIndicators = (response.match(/\b(trash|scrub|amateur|noob|weak|pathetic)\b/gi) || []).length;
  const jargonWords = (response.match(/\b(perk|gen|hook|loop|camp|tunnel|myers|nurse|victor)\b/gi) || []).length;
  const catchphrases = (response.match(/\b(respect the sauce|get the hook|capisce)\b/gi) || []).length;
  
  let caps = 'low';
  if (capsWords > 3) caps = 'high';
  else if (capsWords > 1) caps = 'med';
  
  let roasts = '0';
  if (roastIndicators > 3) roasts = '3+';
  else if (roastIndicators > 0) roasts = roastIndicators.toString();
  
  let jargon = 'off';
  if (jargonWords > 2) jargon = 'heavy';
  else if (jargonWords > 0) jargon = 'light';
  
  return `<!-- METRICS caps=${caps} roasts=${roasts} jargon=${jargon} catchphrases=${catchphrases} -->`;
}