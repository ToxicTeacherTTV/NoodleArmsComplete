
import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🛡️  SAFE MIGRATION: Dropping old text-based embedding column...");
  try {
    await db.execute(sql`ALTER TABLE memory_entries DROP COLUMN IF EXISTS embedding`);
    console.log("✅ Column dropped successfully. Rows preserved.");
  } catch (e) {
    console.error("❌ Error dropping column:", e);
  }
  process.exit(0);
}

main();
