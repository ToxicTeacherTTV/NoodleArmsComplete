// Intelligent city parser for podcast listener tracking

import { COUNTRY_TO_CONTINENT, FAMOUS_CITIES, US_STATES, CANADIAN_PROVINCES } from "../../shared/listenerCities";

export interface ParsedCityData {
  city: string;
  stateProvince?: string;
  country: string;
  continent: string;
  region?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
}

export interface CityParseError {
  rawInput: string;
  error: string;
}

/**
 * Intelligently parse city data from various input formats
 * Examples:
 *  - "New York, NY, USA"
 *  - "Paris, France"
 *  - "Toronto"
 *  - "Los Angeles, California"
 *  - "Berlin"
 *  - "Vernal Utah" (auto-detects Utah = USA)
 *  - "Springfield IL" (auto-detects IL = Illinois = USA)
 */
export function parseCity(input: string): ParsedCityData | CityParseError {
  if (!input || input.trim().length === 0) {
    return { rawInput: input, error: "Empty city name" };
  }

  const trimmed = input.trim();
  const parts = trimmed.split(',').map(p => p.trim());

  let city: string;
  let stateProvince: string | undefined;
  let country: string | undefined;

  // Parse based on number of parts
  if (parts.length === 1) {
    // Single part - could be "City" or "City State" (space-separated)
    // First check if there's a space and the last word is a US state or Canadian province
    const words = parts[0].split(' ');
    if (words.length >= 2) {
      const lastWord = words[words.length - 1];
      const secondToLast = words.length >= 3 ? words[words.length - 2] : '';
      
      // Check for multi-word states like "New York" or "New Mexico"
      const possibleMultiWordState = `${secondToLast} ${lastWord}`;
      
      if (US_STATES[possibleMultiWordState]) {
        // Multi-word US state (e.g., "Salt Lake City New York")
        city = words.slice(0, words.length - 2).join(' ');
        stateProvince = US_STATES[possibleMultiWordState];
        country = 'USA';
      } else if (CANADIAN_PROVINCES[possibleMultiWordState]) {
        // Multi-word Canadian province (e.g., "Corner Brook British Columbia")
        city = words.slice(0, words.length - 2).join(' ');
        stateProvince = CANADIAN_PROVINCES[possibleMultiWordState];
        country = 'Canada';
      } else if (US_STATES[lastWord]) {
        // Single-word US state or abbreviation (e.g., "Vernal Utah" or "Springfield IL")
        city = words.slice(0, -1).join(' ');
        stateProvince = US_STATES[lastWord];
        country = 'USA';
      } else if (CANADIAN_PROVINCES[lastWord]) {
        // Single-word Canadian province or abbreviation (e.g., "Toronto Ontario" or "Calgary AB")
        city = words.slice(0, -1).join(' ');
        stateProvince = CANADIAN_PROVINCES[lastWord];
        country = 'Canada';
      } else {
        // No state detected, just a city name
        city = parts[0];
      }
    } else {
      // Single word, just city name
      city = parts[0];
    }
    
    // Try to auto-detect from famous cities if we don't have country yet
    if (!country) {
      const famous = FAMOUS_CITIES[city];
      if (famous) {
        country = famous.country;
        stateProvince = stateProvince || famous.stateProvince;
      }
    }
  } else if (parts.length === 2) {
    // "City, Country" or "City, State"
    city = parts[0];
    const secondPart = parts[1];
    
    // Check if second part is a US state or Canadian province
    if (US_STATES[secondPart]) {
      stateProvince = US_STATES[secondPart];
      country = 'USA';
    } else if (CANADIAN_PROVINCES[secondPart]) {
      stateProvince = CANADIAN_PROVINCES[secondPart];
      country = 'Canada';
    } else if (COUNTRY_TO_CONTINENT[secondPart]) {
      // It's a known country
      country = secondPart;
    } else {
      // Unknown state/country, treat as state and try to guess country
      stateProvince = secondPart;
      const famous = FAMOUS_CITIES[city];
      if (famous) {
        country = famous.country;
      }
    }
  } else if (parts.length >= 3) {
    // "City, State, Country"
    city = parts[0];
    stateProvince = parts[1];
    country = parts[2];
  } else {
    return { rawInput: input, error: "Could not parse city format" };
  }

  // If we still don't have a country, try to guess from famous cities
  if (!country) {
    const famous = FAMOUS_CITIES[city];
    if (famous) {
      country = famous.country;
      if (!stateProvince) {
        stateProvince = famous.stateProvince;
      }
    }
  }

  // If we STILL don't have a country, return error
  if (!country) {
    return { 
      rawInput: input, 
      error: `Could not determine country for "${city}". Please specify country.` 
    };
  }

  // Normalize country names
  country = normalizeCountryName(country);

  // Get continent
  const continent = COUNTRY_TO_CONTINENT[country];
  if (!continent) {
    return { 
      rawInput: input, 
      error: `Unknown country: "${country}". Please check spelling.` 
    };
  }

  // Determine confidence level
  const confidence = determineConfidence(city, stateProvince, country);

  // Build region (optional)
  const region = buildRegion(country, continent);

  return {
    city,
    stateProvince,
    country,
    continent,
    region,
    confidence,
  };
}

/**
 * Normalize country names to standard format
 */
function normalizeCountryName(country: string): string {
  const normalized: Record<string, string> = {
    'US': 'USA',
    'United States': 'USA',
    'U.S.': 'USA',
    'U.S.A.': 'USA',
    'United States of America': 'USA',
    'UK': 'UK',
    'United Kingdom': 'UK',
    'Great Britain': 'UK',
    'Britain': 'UK',
    'England': 'UK',
    'Scotland': 'UK',
    'Wales': 'UK',
  };

  return normalized[country] || country;
}

/**
 * Determine confidence level of the parse
 */
function determineConfidence(city: string, stateProvince: string | undefined, country: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  // High confidence if famous city with matching data
  const famous = FAMOUS_CITIES[city];
  if (famous && famous.country === country) {
    if (stateProvince && famous.stateProvince === stateProvince) {
      return 'HIGH';
    }
    if (!stateProvince && !famous.stateProvince) {
      return 'HIGH';
    }
  }

  // Medium confidence if country provided explicitly
  if (stateProvince) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Build region string (optional grouping)
 */
function buildRegion(country: string, continent: string): string | undefined {
  // North America regions
  if (country === 'USA' || country === 'Canada' || country === 'Mexico') {
    return 'North America';
  }

  // European regions
  if (continent === 'Europe') {
    const western = ['UK', 'France', 'Germany', 'Netherlands', 'Belgium', 'Switzerland', 'Austria'];
    const northern = ['Sweden', 'Norway', 'Denmark', 'Finland'];
    const southern = ['Italy', 'Spain', 'Portugal'];
    const eastern = ['Poland'];

    if (western.includes(country)) return 'Western Europe';
    if (northern.includes(country)) return 'Northern Europe';
    if (southern.includes(country)) return 'Southern Europe';
    if (eastern.includes(country)) return 'Eastern Europe';
  }

  // Asian regions
  if (continent === 'Asia') {
    const east = ['China', 'Japan', 'South Korea'];
    const southeast = ['Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Malaysia', 'Singapore'];

    if (east.includes(country)) return 'East Asia';
    if (southeast.includes(country)) return 'Southeast Asia';
  }

  return undefined;
}

/**
 * Parse multiple cities from text (comma or newline separated)
 */
export function parseCitiesBulk(input: string): Array<ParsedCityData | CityParseError> {
  // Split by newlines first, then by semicolons
  const lines = input.split(/\n|;/).map(l => l.trim()).filter(l => l.length > 0);
  
  return lines.map(line => parseCity(line));
}

/**
 * Parse CSV file content
 * Expected format: City, State/Province, Country
 * OR: City, Country
 */
export function parseCitiesFromCSV(csvContent: string): Array<ParsedCityData | CityParseError> {
  const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Skip header if it looks like a header
  const firstLine = lines[0]?.toLowerCase();
  const hasHeader = firstLine?.includes('city') || firstLine?.includes('country');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  
  return dataLines.map(line => parseCity(line));
}

/**
 * Extract cities from plain text document (PDF, Word, etc.)
 * Looks for patterns like:
 *  - "New York, NY"
 *  - "Paris, France"
 *  - Lines with city names
 */
export function parseCitiesFromText(text: string): Array<ParsedCityData | CityParseError> {
  // Split into lines and try to parse each
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const results: Array<ParsedCityData | CityParseError> = [];
  
  for (const line of lines) {
    // Skip obvious non-city lines (too long, contains common document words)
    if (line.length > 100) continue;
    if (/page|document|section|chapter/i.test(line)) continue;
    
    // Try to parse
    const result = parseCity(line);
    
    // Only include if it parsed successfully
    if ('city' in result) {
      results.push(result);
    }
  }
  
  return results;
}
