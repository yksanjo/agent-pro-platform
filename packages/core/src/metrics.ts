/**
 * Metrics Collection
 */

import { EventEmitter } from 'events';
import { ExecutionResult, TokenUsage } from './types.js';

/**
 * Agent Metrics
 */
export class AgentMetrics extends EventEmitter {
  private executions: number = 0;
  private successes: number = 0;
  private failures: number = 0;
  private timeouts: number = 0;
  private totalDuration: number = 0;
  private totalTokens: number = 0;
  private totalCost: number = 0;
  private labels?: Record<string, string>;
  private initialized: boolean = false;

  constructor(labels?: Record<string, string>) {
    super();
    this.labels = labels;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * Record an execution
   */
  recordExecution(result: ExecutionResult): void {
    this.executions++;
    this.totalDuration += result.duration;
    this.totalTokens += result.usage.totalTokens;
    
    if (result.usage.cost) {
      this.totalCost += result.usage.cost;
    }

    switch (result.status) {
      case 'completed':
        this.successes++;
        break;
      case 'timeout':
        this.timeouts++;
        this.failures++;
        break;
      case 'failed':
        this.failures++;
        break;
    }

    this.emit('execution', result);
  }

  /**
   * Get current metrics
   */
  getMetrics(): {
    executions: number;
    successes: number;
    failures: number;
    timeouts: number;
    successRate: number;
    averageDuration: number;
    totalTokens: number;
    totalCost: number;
    labels?: Record<string, string>;
  } {
    return {
      executions: this.executions,
      successes: this.successes,
      failures: this.failures,
      timeouts: this.timeouts,
      successRate: this.executions > 0 
        ? (this.successes / this.executions) * 100 
        : 0,
      averageDuration: this.executions > 0 
        ? this.totalDuration / this.executions 
        : 0,
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      labels: this.labels,
    };
  }

  /**
   * Get Prometheus-format metrics
   */
  getPrometheusMetrics(): string {
    const m = this.getMetrics();
    
    return `
# HELP agent_executions_total Total number of agent executions
# TYPE agent_executions_total counter
agent_executions_total${this.formatLabels({ status: 'total' })} ${m.executions}
agent_executions_total${this.formatLabels({ status: 'success' })} ${m.successes}
agent_executions_total${this.formatLabels({ status: 'failure' })} ${m.failures}
agent_executions_total${this.formatLabels({ status: 'timeout' })} ${m.timeouts}

# HELP agent_success_rate Agent success rate percentage
# TYPE agent_success_rate gauge
agent_success_rate${this.formatLabels()} ${m.successRate.toFixed(2)}

# HELP agent_execution_duration_seconds Average execution duration
# TYPE agent_execution_duration_seconds gauge
agent_execution_duration_seconds${this.formatLabels()} ${(m.averageDuration / 1000).toFixed(3)}

# HELP agent_tokens_total Total tokens consumed
# TYPE agent_tokens_total counter
agent_tokens_total${this.formatLabels()} ${m.totalTokens}

# HELP agent_cost_total Total cost in USD
# TYPE agent_cost_total counter
agent_cost_total${this.formatLabels()} ${m.totalCost.toFixed(6)}
`.trim();
  }

  /**
   * Check if metrics system is healthy
   */
  isHealthy(): boolean {
    return this.initialized;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.executions = 0;
    this.successes = 0;
    this.failures = 0;
    this.timeouts = 0;
    this.totalDuration = 0;
    this.totalTokens = 0;
    this.totalCost = 0;
    this.emit('reset');
  }

  private formatLabels(extra?: Record<string, string>): string {
    const labels = { ...this.labels, ...extra };
    const entries = Object.entries(labels);
    
    if (entries.length === 0) {
      return '';
    }
    
    return '{' + entries.map(([k, v]) => `${k}="${v}"`).join(',') + '}';
  }
}

/**
 * Metric Collector - Collects metrics across multiple runtimes
 */
export class MetricCollector extends EventEmitter {
  private metrics: Map<string, AgentMetrics> = new Map();

  /**
   * Register a metrics instance
   */
  register(id: string, metrics: AgentMetrics): void {
    this.metrics.set(id, metrics);
    this.emit('registered', { id, metrics });
  }

  /**
   * Unregister a metrics instance
   */
  unregister(id: string): void {
    this.metrics.delete(id);
    this.emit('unregistered', { id });
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(): {
    totalExecutions: number;
    totalSuccesses: number;
    totalFailures: number;
    overallSuccessRate: number;
    totalTokens: number;
    totalCost: number;
  } {
    let totalExecutions = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let totalTokens = 0;
    let totalCost = 0;

    for (const metrics of this.metrics.values()) {
      const m = metrics.getMetrics();
      totalExecutions += m.executions;
      totalSuccesses += m.successes;
      totalFailures += m.failures;
      totalTokens += m.totalTokens;
      totalCost += m.totalCost;
    }

    return {
      totalExecutions,
      totalSuccesses,
      totalFailures,
      overallSuccessRate: totalExecutions > 0 
        ? (totalSuccesses / totalExecutions) * 100 
        : 0,
      totalTokens,
      totalCost,
    };
  }

  /**
   * Get all metrics in Prometheus format
   */
  getAllPrometheusMetrics(): string {
    const parts: string[] = [];
    
    for (const [id, metrics] of this.metrics.entries()) {
      parts.push(`# Agent: ${id}`);
      parts.push(metrics.getPrometheusMetrics());
    }
    
    return parts.join('\n\n');
  }
}
