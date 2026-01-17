
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifyColumns() {
    try {
        const result = await pool.query(`
            SELECT table_name, column_name, udt_name 
            FROM information_schema.columns 
            WHERE column_name = 'embedding'
        `);
        
        console.log("🔍 Checking embedding columns:");
        result.rows.forEach(row => {
            const icon = row.udt_name === 'vector' ? '✅' : '❌';
            console.log(`${icon} Table: ${row.table_name}, Column: ${row.column_name}, Type: ${row.udt_name}`);
        });

        const nonVector = result.rows.filter(r => r.udt_name !== 'vector');
        if (nonVector.length > 0) {
            console.error("❌ Some embedding columns are NOT of type vector!");
            process.exit(1);
        } else {
            console.log("✅ All embedding columns are correct.");
        }
    } catch (e) {
        console.error("Error verifying columns:", e);
    } finally {
        await pool.end();
    }
}

verifyColumns();
