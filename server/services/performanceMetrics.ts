/**
 * Performance Metrics Tracker for Memory Retrieval
 */

interface PerformanceLog {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class PerformanceMetrics {
  private logs: PerformanceLog[] = [];
  private readonly maxLogs = 1000;

  /**
   * Start timing an operation
   */
  startTimer(operation: string): () => number {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      this.log(operation, duration);
      return duration;
    };
  }

  /**
   * Log a performance metric
   */
  log(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.logs.push({
      operation,
      duration,
      timestamp: new Date(),
      metadata
    });

    // Keep logs size manageable
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log slow operations
    if (duration > 1000) {
      console.warn(`⚠️ SLOW OPERATION: ${operation} took ${duration}ms`, metadata);
    } else if (duration > 500) {
      console.log(`📊 ${operation} took ${duration}ms`, metadata);
    }
  }

  /**
   * Get statistics for a specific operation
   */
  getStats(operation: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    totalDuration: number;
  } | null {
    const operationLogs = this.logs.filter(log => log.operation === operation);
    
    if (operationLogs.length === 0) return null;

    const durations = operationLogs.map(log => log.duration);
    const total = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: operationLogs.length,
      avgDuration: Math.round(total / operationLogs.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration: total
    };
  }

  /**
   * Get all operation statistics
   */
  getAllStats(): Record<string, any> {
    const uniqueOps = new Set(this.logs.map(log => log.operation));
    const operations = Array.from(uniqueOps);
    const stats: Record<string, any> = {};

    operations.forEach(operation => {
      stats[operation] = this.getStats(operation);
    });

    return stats;
  }

  /**
   * Get recent slow operations
   */
  getSlowOperations(threshold = 500, limit = 10): PerformanceLog[] {
    return this.logs
      .filter(log => log.duration >= threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Get summary report
   */
  getSummary(): string {
    const stats = this.getAllStats();
    const operations = Object.keys(stats);
    
    if (operations.length === 0) {
      return '📊 No performance metrics available';
    }

    let summary = '\n📊 PERFORMANCE SUMMARY\n' + '='.repeat(50) + '\n\n';

    operations.forEach(operation => {
      const opStats = stats[operation];
      summary += `${operation}:\n`;
      summary += `  Calls: ${opStats.count}\n`;
      summary += `  Avg: ${opStats.avgDuration}ms\n`;
      summary += `  Min: ${opStats.minDuration}ms / Max: ${opStats.maxDuration}ms\n`;
      summary += `  Total: ${opStats.totalDuration}ms\n\n`;
    });

    const slowOps = this.getSlowOperations(500, 5);
    if (slowOps.length > 0) {
      summary += '\n⚠️ SLOWEST OPERATIONS:\n';
      slowOps.forEach((log, i) => {
        summary += `${i + 1}. ${log.operation}: ${log.duration}ms\n`;
      });
    }

    return summary;
  }
}

// Global performance metrics instance
export const perfMetrics = new PerformanceMetrics();

// Log summary every 5 minutes
setInterval(() => {
  const summary = perfMetrics.getSummary();
  if (summary !== '📊 No performance metrics available') {
    console.log(summary);
  }
}, 5 * 60 * 1000);
