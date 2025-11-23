
import { db } from "../db";
import { memoryEntries } from "@shared/schema";
import { count } from "drizzle-orm";

async function checkMemoryCount() {
  try {
    console.log("🔌 Connecting to database to count memories...");
    const result = await db.select({ count: count() }).from(memoryEntries);
    console.log(`📊 Total Memory Entries in Database: ${result[0].count}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to count memories:", error);
    process.exit(1);
  }
}

checkMemoryCount();
