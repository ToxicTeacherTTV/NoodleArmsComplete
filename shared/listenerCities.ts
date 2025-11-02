// Listener cities schema and types

export interface ListenerCity {
  id: string;
  city: string;
  stateProvince?: string; // Optional - not all countries have states/provinces
  country: string;
  continent: string;
  region?: string; // e.g., "North America", "Western Europe"
  isCovered: boolean; // Has it been covered on "Where the fuck are the viewers from"
  coveredDate?: string;
  coveredEpisode?: string;
  createdAt: string;
  updatedAt: string;
  profileId: string;
}

export interface ListenerCityInput {
  city: string;
  stateProvince?: string;
  country?: string; // Optional - will be auto-detected if not provided
}

export interface CityImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{
    row: number;
    city: string;
    error: string;
  }>;
}

// Continent mapping for countries
export const COUNTRY_TO_CONTINENT: Record<string, string> = {
  // North America
  'USA': 'North America',
  'United States': 'North America',
  'US': 'North America',
  'Canada': 'North America',
  'Mexico': 'North America',
  
  // Europe
  'UK': 'Europe',
  'United Kingdom': 'Europe',
  'England': 'Europe',
  'Scotland': 'Europe',
  'Wales': 'Europe',
  'Ireland': 'Europe',
  'Germany': 'Europe',
  'France': 'Europe',
  'Italy': 'Europe',
  'Spain': 'Europe',
  'Portugal': 'Europe',
  'Netherlands': 'Europe',
  'Belgium': 'Europe',
  'Switzerland': 'Europe',
  'Austria': 'Europe',
  'Poland': 'Europe',
  'Sweden': 'Europe',
  'Norway': 'Europe',
  'Denmark': 'Europe',
  'Finland': 'Europe',
  
  // Asia
  'China': 'Asia',
  'Japan': 'Asia',
  'India': 'Asia',
  'South Korea': 'Asia',
  'Thailand': 'Asia',
  'Vietnam': 'Asia',
  'Philippines': 'Asia',
  'Indonesia': 'Asia',
  'Malaysia': 'Asia',
  'Singapore': 'Asia',
  
  // South America
  'Brazil': 'South America',
  'Argentina': 'South America',
  'Chile': 'South America',
  'Colombia': 'South America',
  'Peru': 'South America',
  'Venezuela': 'South America',
  
  // Oceania
  'Australia': 'Oceania',
  'New Zealand': 'Oceania',
  
  // Africa
  'South Africa': 'Africa',
  'Nigeria': 'Africa',
  'Egypt': 'Africa',
  'Kenya': 'Africa',
};

// Well-known cities that can help auto-detect country
export const FAMOUS_CITIES: Record<string, { country: string; stateProvince?: string }> = {
  // USA
  'New York': { country: 'USA', stateProvince: 'New York' },
  'Los Angeles': { country: 'USA', stateProvince: 'California' },
  'Chicago': { country: 'USA', stateProvince: 'Illinois' },
  'Houston': { country: 'USA', stateProvince: 'Texas' },
  'Phoenix': { country: 'USA', stateProvince: 'Arizona' },
  'Philadelphia': { country: 'USA', stateProvince: 'Pennsylvania' },
  'San Antonio': { country: 'USA', stateProvince: 'Texas' },
  'San Diego': { country: 'USA', stateProvince: 'California' },
  'Dallas': { country: 'USA', stateProvince: 'Texas' },
  'San Jose': { country: 'USA', stateProvince: 'California' },
  'Austin': { country: 'USA', stateProvince: 'Texas' },
  'Seattle': { country: 'USA', stateProvince: 'Washington' },
  'Denver': { country: 'USA', stateProvince: 'Colorado' },
  'Boston': { country: 'USA', stateProvince: 'Massachusetts' },
  'Miami': { country: 'USA', stateProvince: 'Florida' },
  'Atlanta': { country: 'USA', stateProvince: 'Georgia' },
  'Las Vegas': { country: 'USA', stateProvince: 'Nevada' },
  'Portland': { country: 'USA', stateProvince: 'Oregon' },
  
  // Canada
  'Toronto': { country: 'Canada', stateProvince: 'Ontario' },
  'Montreal': { country: 'Canada', stateProvince: 'Quebec' },
  'Vancouver': { country: 'Canada', stateProvince: 'British Columbia' },
  'Calgary': { country: 'Canada', stateProvince: 'Alberta' },
  'Ottawa': { country: 'Canada', stateProvince: 'Ontario' },
  
  // UK
  'London': { country: 'UK' },
  'Manchester': { country: 'UK' },
  'Birmingham': { country: 'UK' },
  'Liverpool': { country: 'UK' },
  'Edinburgh': { country: 'UK' },
  'Glasgow': { country: 'UK' },
  
  // Other major cities
  'Paris': { country: 'France' },
  'Berlin': { country: 'Germany' },
  'Rome': { country: 'Italy' },
  'Madrid': { country: 'Spain' },
  'Barcelona': { country: 'Spain' },
  'Amsterdam': { country: 'Netherlands' },
  'Tokyo': { country: 'Japan' },
  'Sydney': { country: 'Australia' },
  'Melbourne': { country: 'Australia' },
  'Mexico City': { country: 'Mexico' },
  'São Paulo': { country: 'Brazil' },
  'Buenos Aires': { country: 'Argentina' },
};
