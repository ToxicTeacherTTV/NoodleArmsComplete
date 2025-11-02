// Migration script to add listener_cities table
import { sql } from "drizzle-orm";
import { db } from "./db";

async function migrate() {
  console.log("🔄 Running listener_cities migration...");

  try {
    // Create the table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS listener_cities (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id VARCHAR NOT NULL REFERENCES profiles(id),
        city TEXT NOT NULL,
        state_province TEXT,
        country TEXT NOT NULL,
        continent TEXT NOT NULL,
        region TEXT,
        is_covered BOOLEAN DEFAULT false,
        covered_date TIMESTAMP,
        covered_episode TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      )
    `);

    console.log("✅ Table created");

    // Create unique index
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_city_country_idx 
        ON listener_cities(profile_id, city, country)
    `);

    console.log("✅ Unique index created");

    // Create filtering indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_listener_cities_country ON listener_cities(country)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_listener_cities_continent ON listener_cities(continent)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_listener_cities_region ON listener_cities(region)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_listener_cities_is_covered ON listener_cities(is_covered)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_listener_cities_profile_id ON listener_cities(profile_id)
    `);

    console.log("✅ All indexes created");

    // Add comment
    await db.execute(sql`
      COMMENT ON TABLE listener_cities IS 'Tracks podcast listener cities for "Where the fuck are the viewers from" segment'
    `);

    console.log("✅ Migration completed successfully!");
    console.log("\n📍 Listener Cities tracking is now available!");
    console.log("   Navigate to /listener-cities to start tracking cities.");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrate();
