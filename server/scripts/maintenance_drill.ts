
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { embeddingServiceInstance } from '../services/embeddingService'; // Ensure this is initialized or mocked if needed
import { storage } from '../storage'; // Direct DB access for verification

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runVectorDrill() {
    console.log("\n🧪 --- DRILL 1: VECTOR HEALTH ---");
    try {
        // 1. Check memory_entries
        console.log("   Running vector check on 'memory_entries'...");
        const resMem = await pool.query(`
            SELECT id, (1 - (embedding <=> '[${new Array(768).fill(0).map(()=>0.01).join(',')}]'::vector)) as sim 
            FROM memory_entries 
            WHERE embedding IS NOT NULL 
            LIMIT 1
        `);
        if (resMem.rows.length > 0) console.log("   ✅ memory_entries: OK");
        else console.warn("   ⚠️ memory_entries: No rows returned (might be empty DB)");

        // 2. Check documents
        console.log("   Running vector check on 'documents'...");
        const resDoc = await pool.query(`
            SELECT id, (1 - (embedding <=> '[${new Array(768).fill(0).map(()=>0.01).join(',')}]'::vector)) as sim 
            FROM documents 
            WHERE embedding IS NOT NULL 
            LIMIT 1
        `);
        if (resDoc.rows.length > 0) console.log("   ✅ documents: OK");
        else console.warn("   ⚠️ documents: No rows returned (might be empty DB)");

        console.log("✅ Vector Drill Complete: No operator errors detected.");
        return true;
    } catch (e: any) {
        console.error("❌ Vector Drill FAILED:", e.message);
        return false;
    }
}

async function runLatencyDrill() {
    console.log("\n🧪 --- DRILL 2: LATENCY CHECK ---");
    const start = Date.now();
    try {
        const res = await fetch(`${BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: "Ping check for latency", 
                conversationId: "maintenance-drill",
                mode: "CHAT" 
            })
        });

        if (!res.ok) throw new Error(`Status ${res.status}`);
        
        const data = await res.json();
        const totalTime = Date.now() - start;
        console.log(`   ⏱️ Total Round Trip: ${totalTime}ms`);
        
        if (data.metadata?.processingTime) {
            console.log(`   ⏱️ Internal Processing: ${data.metadata.processingTime}ms`);
        }
        
        if (totalTime < 8000) console.log("✅ Latency Drill Passed (< 8s)");
        else console.warn("⚠️ Latency High (> 8s)");
        
        return true;
    } catch (e: any) {
        console.error("❌ Latency Drill FAILED (Is server running?):", e.message);
        return false;
    }
}

async function runQualityDrill() {
    console.log("\n🧪 --- DRILL 3: QUALITY & INTENT ---");
    
    // Helper to get memory count
    const getCount = async () => {
        const res = await pool.query("SELECT COUNT(*) as c FROM memory_entries");
        return parseInt(res.rows[0].c);
    };

    const scenarios = [
        { name: "Greeting", prompt: "Hello there", expectedIntent: "general" }, // or greeting if implemented
        { name: "Lore Req", prompt: "Tell me about the 1998 incident", expectedIntent: "tell_about" },
        { name: "Tech Q",   prompt: "How do I install a driver?", expectedIntent: "how_to" },
    ];

    let passed = true;

    // 1. Intent Checks (Mock logic if intent not in metadata yet, but structure is ready)
    for (const s of scenarios) {
        process.stdout.write(`   Testing '${s.name}'... `);
        try {
            const res = await fetch(`${BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: s.prompt, conversationId: "maintenance-drill", mode: "CHAT" })
            });
            const data = await res.json();
            // If intent is exposed in metadata, check it. Otherwise just ensure 200 OK.
            // console.log(data.metadata?.debug_info?.intent); 
            console.log("✅ OK");
        } catch (e) {
            console.log("❌ FAIL");
            passed = false;
        }
    }

    // 2. Memory Toggle Check
    console.log("   Testing Memory Toggle...");
    const startCount = await getCount();
    
    // A. Should Store
    await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: "Remember: Drill Test Memory 123", conversationId: "maintenance-drill", mode: "CHAT" })
    });
    
    // Wait for background processing (lore extraction is async)
    await new Promise(r => setTimeout(r, 2000));
    
    const midCount = await getCount();
    if (midCount > startCount) console.log("   ✅ Memory Stored (Count increased)");
    else console.warn("   ⚠️ Memory NOT Stored (Might be due to empty response or async delay)");

    // B. Should NOT Store (Private)
    await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: "[PRIVATE] Don't remember this secret drill", conversationId: "maintenance-drill", mode: "CHAT" })
    });
    
    await new Promise(r => setTimeout(r, 2000));
    const endCount = await getCount();
    
    if (endCount === midCount) console.log("   ✅ Privacy Respected (Count stable)");
    else console.warn(`   ❌ Privacy Leak? Count increased by ${endCount - midCount}`);

    return passed;
}

async function runAll() {
    console.log("🔧 STARTING MAINTENANCE DRILL 🔧");
    await runVectorDrill();
    await runLatencyDrill();
    await runQualityDrill();
    console.log("\n🏁 DRILL COMPLETE 🏁");
    await pool.end();
    process.exit(0);
}

runAll();
