
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifyVectorCast() {
    console.log("🧪 Verifying Vector Casting Rule...");

    // Create a dummy vector (768 dimensions)
    const vector = new Array(768).fill(0.1);
    // pg/neon driver usually creates a string representation for arrays, e.g. "[0.1, 0.1, ...]"
    // But without explicit type, Postgres might treat it as text or unknown.
    // The error usually happens when Postgres infers the parameter as text but the operator expects vector.

    // const vectorStr = `[${vector.join(',')}]`;

    // TEST 1: FAILING CASE (No Cast)
    console.log("\n--- TEST 1: No Cast (Expecting Failure) ---");
    try {
        // We use $1 binding. Postgres often defaults $1 to 'text' if not specified, 
        // causing "operator does not exist: vector <=> text" (or text <=> vector)
        // Note: The column `embedding` is type `vector`.
        await pool.query(
            `SELECT (embedding <=> $1) as distance FROM documents WHERE embedding IS NOT NULL LIMIT 1`,
            [vector] // Passing RAW ARRAY
        );
        console.log("❌ TEST 1 FAILED: Query succeeded (unexpectedly).");
    } catch (err: any) {
        console.log("✅ TEST 1 PASSED: Caught expected error.");
        console.log(`   Error message: "${err.message}"`);
    }

    // TEST 2: SUCCESS CASE (With Cast)
    console.log("\n--- TEST 2: With Cast (Expecting Success) ---");
    try {
        await pool.query(
            `SELECT (embedding <=> $1::vector) as distance FROM documents WHERE embedding IS NOT NULL LIMIT 1`,
            [JSON.stringify(vector)] // Cast usually works on string representation
        );
        console.log("✅ TEST 2 PASSED: Query succeeded.");
    } catch (err: any) {
        console.log("❌ TEST 2 FAILED: Query failed.");
        console.log(`   Error message: "${err.message}"`);
    }

    await pool.end();
}

verifyVectorCast();
