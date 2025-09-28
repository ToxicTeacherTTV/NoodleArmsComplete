import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  maxUses: 7500,
  idleTimeoutMillis: 10000,
  allowExitOnIdle: false
});

// Add proper error handling to prevent unhandled error dumps
pool.on('error', (err: any) => {
  console.error('Database pool error:', err.message);
  // Log the error type and basic info without dumping the entire client object
  if (err.code) {
    console.error('Error code:', err.code);
  }
  if (err.severity) {
    console.error('Error severity:', err.severity);
  }
});

export const db = drizzle({ client: pool, schema });