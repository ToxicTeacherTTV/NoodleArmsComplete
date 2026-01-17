
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifyVectors() {
    console.log("🔍 Running LIVE Vector Verification for all features...");

    const vectorVector = JSON.stringify(new Array(768).fill(0).map(() => 0.01));

    const checks = [
        {
            name: "Memory Entries (memory_entries)",
            query: `
                SELECT id, content, (1 - (embedding <=> $1::vector)) as similarity 
                FROM memory_entries 
                WHERE embedding IS NOT NULL 
                LIMIT 1
            `
        },
        {
            name: "Training Examples/Documents (documents)",
            query: `
                SELECT id, extracted_content as content, (1 - (embedding <=> $1::vector)) as similarity 
                FROM documents 
                WHERE embedding IS NOT NULL 
                LIMIT 1
            `
        },
        {
            name: "Content Library (content_library)",
            query: `
                SELECT id, content, (1 - (embedding <=> $1::vector)) as similarity 
                FROM content_library 
                WHERE embedding IS NOT NULL 
                LIMIT 1
            `
        }
    ];

    let allPassed = true;

    for (const check of checks) {
        console.log(`\n👉 Testing: ${check.name}`);
        try {
            const result = await pool.query(check.query, [vectorVector]);
            
            if (result.rows.length > 0) {
                console.log(`   ✅ Success! Found ${result.rows.length} row(s).`);
                console.log(`   📝 Sample: ${result.rows[0].content.substring(0, 50)}... (Sim: ${(result.rows[0].similarity * 100).toFixed(1)}%)`);
            } else {
                console.warn(`   ⚠️  No results returned (Table might be empty, but query didn't crash).`);
            }
        } catch (error: any) {
            console.error(`   ❌ FAIL: ${error.message}`);
            allPassed = false;
        }
    }

    await pool.end();
    
    if (allPassed) {
        console.log("\n✨ ALL VECTOR PATHS VERIFIED ✨");
        process.exit(0);
    } else {
        console.error("\n💥 SOME CHECKS FAILED");
        process.exit(1);
    }
}

verifyVectors();
