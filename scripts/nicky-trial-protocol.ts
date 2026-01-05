
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5000/api';
const RESULTS_FILE = 'trial_results.json';

interface TestPrompt {
    id: string;
    category: string;
    prompt: string;
    iterations: number;
    mode: string;
}

const TEST_SUITE: TestPrompt[] = [
    {
        id: 'baseline',
        category: 'Fast baseline',
        prompt: 'Give me a 2-sentence answer: what is your job on this podcast?',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'persona_discipline',
        category: 'Persona discipline',
        prompt: 'Answer in exactly 3 sentences. No bullet points. No headers.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'canon_recall',
        category: 'Canon grounding',
        prompt: 'What is "Camping Them Softly" and who are the hosts? Keep it factual.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'operational_truth',
        category: 'Operational truth guard',
        prompt: 'Explain the difference between CANON and RUMOR in your memory system in plain English.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'rumor_play',
        category: 'Theater Zone',
        prompt: 'Tell me two mutually contradictory origin stories about how you lost your pinky finger. Make it funny. Make sure it\'s clearly rumor/theater, not fact.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'callback_test',
        category: 'Theater Zone',
        prompt: 'Mention Two-Tone Tony again and explain why he\'s banned from the Vatican basement.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'disputed_handling',
        category: 'Contradictions',
        prompt: 'Give me the most likely truth, but also mention what\'s disputed about it, and ask me one clarifying question.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'memory_heavy',
        category: 'Retrieval stress',
        prompt: 'Summarize the last 10 important things you learned about me and our shows. Keep it under 120 words.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'doc_rss_query',
        category: 'Retrieval stress',
        prompt: 'Summarize the latest episode notes you can find in my stored podcast/RSS memory in 5 bullets.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'web_search',
        category: 'Retrieval stress',
        prompt: 'What\'s the latest news about ARC Raiders? Give me 3 headlines and why they matter.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'loop_bait_1',
        category: 'Repetition guard',
        prompt: 'Talk about Oklahoma for 2 paragraphs.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'loop_bait_2',
        category: 'Repetition guard',
        prompt: 'Now talk about Oklahoma again, go deeper.',
        iterations: 1,
        mode: 'CHAT'
    },
    {
        id: 'killer_diagnostic',
        category: 'Structural Diagnostic',
        prompt: 'Answer in 6 sentences. Use 2 CANON facts, 2 RUMORS, and 1 DISPUTED item, each clearly labeled. Then ask me 1 clarifying question.',
        iterations: 1,
        mode: 'CHAT'
    }
];

async function runTrial() {
    console.log('🚀 Starting Nicky Trial Protocol...');
    
    // 1. Get Active Profile
    const profileRes = await fetch(`${API_BASE}/profiles`);
    const profiles = await profileRes.json() as any[];
    const activeProfile = profiles.find(p => p.isActive) || profiles[0];
    
    if (!activeProfile) {
        console.error('❌ No active profile found.');
        return;
    }
    console.log(`👤 Using profile: ${activeProfile.name}`);

    // 2. Create a fresh conversation for the trial
    const convRes = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            profileId: activeProfile.id,
            title: `Trial Protocol ${new Date().toISOString()}`,
            isPrivate: false
        })
    });
    const conversation = await convRes.json() as any;
    const conversationId = conversation.id;
    console.log(`💬 Created trial conversation: ${conversationId}`);

    const results: any[] = [];

    for (const test of TEST_SUITE) {
        console.log(`\n🧪 Testing [${test.category}] - ${test.id}...`);
        
        const iterations = [];
        for (let i = 0; i < test.iterations; i++) {
            process.stdout.write(`  Run ${i + 1}/${test.iterations}... `);
            
            const startTime = Date.now();
            const response = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: test.prompt,
                    conversationId,
                    mode: test.mode,
                    selectedModel: 'gemini-3-flash-preview'
                })
            });
            
            const data = await response.json() as any;
            const endTime = Date.now();
            const totalMs = endTime - startTime;

            iterations.push({
                run: i + 1,
                total_ms: totalMs,
                processing_time: data.processingTime || 0,
                content: data.content,
                cached: data.cached || false
            });
            
            console.log(`Done (${totalMs}ms)`);
        }

        const avgTotal = iterations.reduce((sum, it) => sum + it.total_ms, 0) / iterations.length;
        
        results.push({
            ...test,
            avg_total_ms: avgTotal,
            runs: iterations
        });
    }

    // 3. Save results
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`\n✅ Trial complete! Results saved to ${RESULTS_FILE}`);
    
    // 4. Summary Table
    console.log('\n📊 Summary:');
    console.table(results.map(r => ({
        ID: r.id,
        Category: r.category,
        'Avg Latency (ms)': Math.round(r.avg_total_ms)
    })));
}

runTrial().catch(err => {
    console.error('❌ Trial failed:', err);
});
