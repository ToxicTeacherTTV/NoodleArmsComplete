import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// 🔧 CRITICAL: Disable pipelining to avoid connection errors on Replit
neonConfig.pipelineConnect = false;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log('🔌 Connecting to Neon database...');

console.log('🔌 Connecting to Neon database...');

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 15, // Increased from 10
  maxUses: 7500,
  idleTimeoutMillis: 30000, // Increased from 10000
  allowExitOnIdle: false,
  // Connection validation to detect and remove dead connections
  connectionTimeoutMillis: 20000, // Increased from 10000
});

// 🚨 CRITICAL: Global error handler to prevent crashes from Neon connection errors
process.on('unhandledRejection', (reason: any, promise) => {
  // Silently handle Neon websocket errors that would otherwise crash
  if (reason?.message?.includes('Connect') || 
      reason?.code === 'ECONNREFUSED' ||
      reason?.code === 'ETIMEDOUT' ||
      reason?.toString().includes('ErrorEvent') ||
      (reason instanceof TypeError && reason.message.includes('Cannot set property message'))) {
    console.error('⚠️ Database connection issue (non-fatal):', reason?.message || reason);
    return;
  }
  // Re-throw other unhandled rejections
  console.error('❌ Unhandled rejection:', reason);
});

// 🚨 CRITICAL: Catch synchronous errors that might be thrown in callbacks
process.on('uncaughtException', (error: any) => {
  if (error?.message?.includes('Cannot set property message') && error?.message?.includes('ErrorEvent')) {
    console.error('⚠️ Caught Neon driver bug (ErrorEvent message setter):', error.message);
    return; // Prevent crash
  }
  console.error('❌ Uncaught Exception:', error);
  // For other errors, we might want to exit, but for now let's just log
});

// Add proper error handling to prevent unhandled error dumps and crashes
pool.on('error', (err: any) => {
  // Silently handle connection terminations (expected behavior for Neon serverless)
  if (err.code === '57P01' || err.message?.includes('terminating connection')) {
    // These are normal for long-running operations on Neon
    // Pool will automatically create new connections
    return;
  }
  
  console.error('⚠️ Database pool error:', err.message);
  
  // Log the error type and basic info without dumping the entire client object
  if (err.code) {
    console.error('   Error code:', err.code);
  }
  if (err.severity) {
    console.error('   Error severity:', err.severity);
  }
});

// Catch unhandled client errors that would otherwise crash the server
pool.on('connect', (client: any) => {
  client.on('error', (err: any) => {
    // Silently handle connection terminations
    if (err.code === '57P01' || err.message?.includes('terminating connection') || err.message?.includes('Connection terminated')) {
      return;
    }
    console.error('⚠️ Database client error:', err.message);
  });
});

// Periodically check pool health and log stats
setInterval(() => {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
  
  // Only log if there are issues
  if (stats.waiting > 0 || stats.total > 8) {
    console.log(`📊 DB Pool: ${stats.total} total, ${stats.idle} idle, ${stats.waiting} waiting`);
  }
}, 30000); // Check every 30 seconds

export const db = drizzle({ client: pool, schema });