-- Add listener_cities table for podcast tracking
-- "Where the fuck are the viewers from" segment support

CREATE TABLE IF NOT EXISTS listener_cities (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id VARCHAR NOT NULL REFERENCES profiles(id),
  city TEXT NOT NULL,
  state_province TEXT, -- Optional - not all countries have states/provinces
  country TEXT NOT NULL,
  continent TEXT NOT NULL,
  region TEXT, -- e.g., "Western Europe", "Southeast Asia"
  is_covered BOOLEAN DEFAULT false, -- Has it been covered on the podcast segment
  covered_date TIMESTAMP,
  covered_episode TEXT, -- Episode number or title
  notes TEXT, -- Any additional notes about this city
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create unique index to prevent duplicate cities
CREATE UNIQUE INDEX IF NOT EXISTS unique_city_country_idx 
  ON listener_cities(profile_id, city, country);

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_listener_cities_country ON listener_cities(country);
CREATE INDEX IF NOT EXISTS idx_listener_cities_continent ON listener_cities(continent);
CREATE INDEX IF NOT EXISTS idx_listener_cities_region ON listener_cities(region);
CREATE INDEX IF NOT EXISTS idx_listener_cities_is_covered ON listener_cities(is_covered);
CREATE INDEX IF NOT EXISTS idx_listener_cities_profile_id ON listener_cities(profile_id);

-- Add comment
COMMENT ON TABLE listener_cities IS 'Tracks podcast listener cities for "Where the fuck are the viewers from" segment';
