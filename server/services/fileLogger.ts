import fs from 'fs';
import path from 'path';

/**
 * File Logger with 7-day rotation
 * Writes all console output to daily log files and cleans up old logs
 */

const LOG_DIR = path.join(process.cwd(), 'logs');
const RETENTION_DAYS = 7;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFileName(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `nicky-${date}.log`);
}

function formatLogEntry(level: string, args: any[]): string {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  return `[${timestamp}] [${level}] ${message}\n`;
}

function writeToFile(entry: string): void {
  try {
    fs.appendFileSync(getLogFileName(), entry);
  } catch (err) {
    // Silently fail if we can't write logs
  }
}

function cleanOldLogs(): void {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    for (const file of files) {
      if (!file.startsWith('nicky-') || !file.endsWith('.log')) continue;

      // Extract date from filename (nicky-YYYY-MM-DD.log)
      const dateStr = file.replace('nicky-', '').replace('.log', '');
      const fileDate = new Date(dateStr);

      if (fileDate < cutoffDate) {
        fs.unlinkSync(path.join(LOG_DIR, file));
        console.log(`🗑️ Cleaned old log: ${file}`);
      }
    }
  } catch (err) {
    // Silently fail if we can't clean logs
  }
}

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

// Override console methods to also write to file
console.log = (...args: any[]) => {
  originalConsole.log(...args);
  writeToFile(formatLogEntry('LOG', args));
};

console.error = (...args: any[]) => {
  originalConsole.error(...args);
  writeToFile(formatLogEntry('ERROR', args));
};

console.warn = (...args: any[]) => {
  originalConsole.warn(...args);
  writeToFile(formatLogEntry('WARN', args));
};

console.info = (...args: any[]) => {
  originalConsole.info(...args);
  writeToFile(formatLogEntry('INFO', args));
};

console.debug = (...args: any[]) => {
  originalConsole.debug(...args);
  writeToFile(formatLogEntry('DEBUG', args));
};

// Clean old logs on startup
cleanOldLogs();

// Clean old logs daily
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

// Log initialization
console.log(`📝 File logging enabled - logs saved to ${LOG_DIR} (${RETENTION_DAYS}-day retention)`);

export { LOG_DIR, RETENTION_DAYS };
