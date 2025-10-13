/**
 * Prometheus Metrics Service
 * Tracks costs, usage, and performance across the application
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

class PrometheusMetrics {
  public readonly register: Registry;

  // LLM Metrics
  public readonly llmCallsTotal: Counter;
  public readonly llmTokensTotal: Counter;
  public readonly llmCostEstimate: Counter;
  public readonly llmErrorsTotal: Counter;
  public readonly llmLatency: Histogram;

  // Discord Metrics
  public readonly discordMessagesTotal: Counter;
  public readonly discordProactiveMessages: Counter;
  public readonly discordErrorsTotal: Counter;

  // Memory Metrics
  public readonly memoryRetrievalsTotal: Counter;
  public readonly memoryWritesTotal: Counter;
  public readonly memorySearchLatency: Histogram;
  public readonly totalMemories: Gauge;

  // HTTP Metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;

  // Voice Metrics
  public readonly voiceGenerationsTotal: Counter;
  public readonly voiceCostEstimate: Counter;

  constructor() {
    this.register = new Registry();

    // LLM Call Tracking
    this.llmCallsTotal = new Counter({
      name: 'llm_calls_total',
      help: 'Total number of LLM API calls',
      labelNames: ['provider', 'model', 'type'],
      registers: [this.register]
    });

    this.llmTokensTotal = new Counter({
      name: 'llm_tokens_total',
      help: 'Total number of tokens processed',
      labelNames: ['provider', 'model', 'direction'],
      registers: [this.register]
    });

    this.llmCostEstimate = new Counter({
      name: 'llm_cost_estimate_usd',
      help: 'Estimated LLM API costs in USD',
      labelNames: ['provider', 'model'],
      registers: [this.register]
    });

    this.llmErrorsTotal = new Counter({
      name: 'llm_errors_total',
      help: 'Total number of LLM API errors',
      labelNames: ['provider', 'model', 'error_type'],
      registers: [this.register]
    });

    this.llmLatency = new Histogram({
      name: 'llm_request_duration_seconds',
      help: 'LLM request duration in seconds',
      labelNames: ['provider', 'model'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register]
    });

    // Discord Metrics
    this.discordMessagesTotal = new Counter({
      name: 'discord_messages_total',
      help: 'Total Discord messages sent',
      labelNames: ['type'],
      registers: [this.register]
    });

    this.discordProactiveMessages = new Counter({
      name: 'discord_proactive_messages_total',
      help: 'Total proactive Discord messages sent',
      labelNames: ['channel', 'triggered_by'],
      registers: [this.register]
    });

    this.discordErrorsTotal = new Counter({
      name: 'discord_errors_total',
      help: 'Total Discord errors',
      labelNames: ['error_type'],
      registers: [this.register]
    });

    // Memory Metrics
    this.memoryRetrievalsTotal = new Counter({
      name: 'memory_retrievals_total',
      help: 'Total memory retrieval operations',
      labelNames: ['query_type', 'category'],
      registers: [this.register]
    });

    this.memoryWritesTotal = new Counter({
      name: 'memory_writes_total',
      help: 'Total memory write operations',
      labelNames: ['category', 'source'],
      registers: [this.register]
    });

    this.memorySearchLatency = new Histogram({
      name: 'memory_search_duration_seconds',
      help: 'Memory search duration in seconds',
      labelNames: ['query_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.register]
    });

    this.totalMemories = new Gauge({
      name: 'total_memories',
      help: 'Total number of memories stored',
      labelNames: ['category'],
      registers: [this.register]
    });

    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.register]
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register]
    });

    // Voice Metrics
    this.voiceGenerationsTotal = new Counter({
      name: 'voice_generations_total',
      help: 'Total voice generations via ElevenLabs',
      labelNames: ['voice_id', 'mode'],
      registers: [this.register]
    });

    this.voiceCostEstimate = new Counter({
      name: 'voice_cost_estimate_usd',
      help: 'Estimated voice generation costs in USD',
      labelNames: ['voice_id'],
      registers: [this.register]
    });
  }

  /**
   * Track LLM call with automatic cost estimation
   */
  trackLLMCall(params: {
    provider: 'claude' | 'gemini' | 'openai';
    model: string;
    type: 'chat' | 'embedding' | 'consolidation' | 'extraction';
    inputTokens: number;
    outputTokens: number;
    durationSeconds: number;
    error?: string;
  }): void {
    const { provider, model, type, inputTokens, outputTokens, durationSeconds, error } = params;

    // Always track call and latency (even for errors)
    this.llmCallsTotal.inc({ provider, model, type });
    if (durationSeconds > 0) {
      this.llmLatency.observe({ provider, model }, durationSeconds);
    }

    if (error) {
      this.llmErrorsTotal.inc({ provider, model, error_type: error });
      return;
    }

    // Track tokens and costs only for successful calls
    this.llmTokensTotal.inc({ provider, model, direction: 'input' }, inputTokens);
    this.llmTokensTotal.inc({ provider, model, direction: 'output' }, outputTokens);

    // Cost estimation (rough approximations)
    const costPerMillionInputTokens = this.getInputCost(provider, model);
    const costPerMillionOutputTokens = this.getOutputCost(provider, model);
    
    const estimatedCost = 
      (inputTokens / 1_000_000 * costPerMillionInputTokens) +
      (outputTokens / 1_000_000 * costPerMillionOutputTokens);

    this.llmCostEstimate.inc({ provider, model }, estimatedCost);
  }

  /**
   * Get input token cost per million tokens (USD)
   */
  private getInputCost(provider: string, model: string): number {
    if (provider === 'claude') {
      if (model.includes('sonnet')) return 3.00;
      if (model.includes('opus')) return 15.00;
      return 3.00;
    }
    if (provider === 'gemini') return 0; // Gemini 2.0 Flash is free
    if (provider === 'openai') {
      if (model.includes('gpt-4')) return 30.00;
      return 0.50;
    }
    return 0;
  }

  /**
   * Get output token cost per million tokens (USD)
   */
  private getOutputCost(provider: string, model: string): number {
    if (provider === 'claude') {
      if (model.includes('sonnet')) return 15.00;
      if (model.includes('opus')) return 75.00;
      return 15.00;
    }
    if (provider === 'gemini') return 0; // Gemini 2.0 Flash is free
    if (provider === 'openai') {
      if (model.includes('gpt-4')) return 60.00;
      return 1.50;
    }
    return 0;
  }

  /**
   * Track Discord message
   */
  trackDiscordMessage(type: 'reply' | 'proactive' | 'error', channel?: string, trigger?: string): void {
    this.discordMessagesTotal.inc({ type });
    
    if (type === 'proactive' && channel) {
      this.discordProactiveMessages.inc({ 
        channel: channel, 
        triggered_by: trigger || 'unknown' 
      });
    }

    if (type === 'error') {
      this.discordErrorsTotal.inc({ error_type: trigger || 'unknown' });
    }
  }

  /**
   * Track memory retrieval
   */
  trackMemoryRetrieval(params: {
    queryType: 'semantic' | 'keyword' | 'hybrid';
    category?: string;
    durationSeconds: number;
    resultsCount: number;
  }): void {
    const { queryType, category, durationSeconds } = params;
    
    this.memoryRetrievalsTotal.inc({ 
      query_type: queryType, 
      category: category || 'all' 
    });
    
    this.memorySearchLatency.observe({ query_type: queryType }, durationSeconds);
  }

  /**
   * Track memory write
   */
  trackMemoryWrite(category: string, source: 'conversation' | 'document' | 'web' | 'discord'): void {
    this.memoryWritesTotal.inc({ category, source });
  }

  /**
   * Update total memory count gauge
   */
  updateMemoryCount(category: string, count: number): void {
    this.totalMemories.set({ category }, count);
  }

  /**
   * Track HTTP request
   */
  trackHttpRequest(params: {
    method: string;
    route: string;
    status: number;
    durationSeconds: number;
  }): void {
    const { method, route, status, durationSeconds } = params;
    
    this.httpRequestsTotal.inc({ method, route, status: status.toString() });
    this.httpRequestDuration.observe({ method, route }, durationSeconds);
  }

  /**
   * Track voice generation
   */
  trackVoiceGeneration(params: {
    voiceId: string;
    mode: 'podcast' | 'streaming' | 'manual';
    charactersProcessed: number;
  }): void {
    const { voiceId, mode, charactersProcessed } = params;
    
    this.voiceGenerationsTotal.inc({ voice_id: voiceId, mode });
    
    // ElevenLabs pricing: ~$0.30 per 1000 characters
    const estimatedCost = (charactersProcessed / 1000) * 0.30;
    this.voiceCostEstimate.inc({ voice_id: voiceId }, estimatedCost);
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return await this.register.metrics();
  }

  /**
   * Get metrics summary for logging
   */
  async getSummary(): Promise<string> {
    const metrics = await this.register.getMetricsAsJSON();
    
    let summary = '\n📊 PROMETHEUS METRICS SUMMARY\n' + '='.repeat(50) + '\n\n';
    
    metrics.forEach((metric: any) => {
      summary += `${metric.name}:\n`;
      if (metric.values && metric.values.length > 0) {
        metric.values.forEach((value: any) => {
          const labels = value.labels ? JSON.stringify(value.labels) : '';
          summary += `  ${labels}: ${value.value}\n`;
        });
      }
      summary += '\n';
    });
    
    return summary;
  }
}

// Global Prometheus metrics instance
export const prometheusMetrics = new PrometheusMetrics();
