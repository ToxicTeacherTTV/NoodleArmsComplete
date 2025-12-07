
import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔌 Enabling pgvector extension...");
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    console.log("✅ Extension enabled.");
  } catch (e) {
    console.error("❌ Error enabling extension:", e);
  }
  process.exit(0);
}

main();
