/**
 * Agent Runtime - Production-grade agent execution engine
 */

import { EventEmitter } from 'events';
import {
  Message,
  ToolCall,
  StreamChunk,
  TokenUsage,
  ExecutionResult,
  ExecutionConfig,
  AgentOptions,
  ExecutionStatus,
  HealthStatus,
} from './types.js';
import {
  AgentError,
  AgentTimeoutError,
  AgentRateLimitError,
  AgentModelError,
} from './errors.js';
import { RetryConfig, CircuitBreaker } from './resilience.js';
import { AgentMetrics } from './metrics.js';

/**
 * Agent Runtime Configuration
 */
export interface RuntimeConfig extends AgentOptions {
  retry?: RetryConfig;
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
  };
  metrics?: {
    enabled: boolean;
    labels?: Record<string, string>;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RuntimeConfig = {
  model: 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 4096,
  maxIterations: 10,
  timeout: 60000,
  stream: false,
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    factor: 2,
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
  },
  metrics: {
    enabled: true,
  },
};

/**
 * Agent Runtime - Main execution engine
 * 
 * Features:
 * - Streaming support
 * - Tool calling
 * - Memory management
 * - Retry with exponential backoff
 * - Circuit breaker
 * - Metrics collection
 * - Comprehensive error handling
 */
export class AgentRuntime extends EventEmitter {
  private config: RuntimeConfig;
  private circuitBreaker?: CircuitBreaker;
  private metrics: AgentMetrics;
  private isInitialized: boolean = false;

  constructor(config: Partial<RuntimeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = new AgentMetrics(this.config.metrics?.labels);
    
    if (this.config.circuitBreaker?.enabled) {
      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: this.config.circuitBreaker.failureThreshold,
        successThreshold: this.config.circuitBreaker.successThreshold,
        timeout: this.config.circuitBreaker.timeout,
      });
    }
  }

  /**
   * Initialize the runtime
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.emit('initializing');
    
    try {
      // Validate configuration
      this.validateConfig();
      
      // Initialize metrics
      if (this.config.metrics?.enabled) {
        await this.metrics.initialize();
      }

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', { error });
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.temperature < 0 || this.config.temperature > 2) {
      throw new AgentError(
        'Temperature must be between 0 and 2',
        'INVALID_CONFIG',
        false,
        { temperature: this.config.temperature }
      );
    }

    if (this.config.maxTokens < 1 || this.config.maxTokens > 128000) {
      throw new AgentError(
        'maxTokens must be between 1 and 128000',
        'INVALID_CONFIG',
        false,
        { maxTokens: this.config.maxTokens }
      );
    }

    if (this.config.maxIterations < 1 || this.config.maxIterations > 100) {
      throw new AgentError(
        'maxIterations must be between 1 and 100',
        'INVALID_CONFIG',
        false,
        { maxIterations: this.config.maxIterations }
      );
    }
  }

  /**
   * Execute a task
   */
  async execute(
    task: string,
    config: ExecutionConfig = {}
  ): Promise<ExecutionResult> {
    await this.initialize();

    const executionId = this.generateId();
    const startTime = Date.now();
    const timeout = config.timeout || this.config.timeout;

    // Create execution context
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful AI assistant.', timestamp: Date.now() },
      { role: 'user', content: task, timestamp: Date.now() },
    ];

    const result: ExecutionResult = {
      id: executionId,
      status: 'pending',
      output: '',
      toolCalls: [],
      messages,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      duration: 0,
    };

    try {
      // Check circuit breaker
      if (this.circuitBreaker?.isOpen()) {
        throw new AgentError(
          'Circuit breaker is open',
          'CIRCUIT_OPEN',
          false
        );
      }

      this.emit('execution:start', { executionId, task, config });
      result.status = 'running';

      // Execute with timeout
      const executionPromise = this.executeWithRetry(messages, config);
      const timeoutPromise = new Promise<ExecutionResult>((_, reject) => {
        setTimeout(() => {
          reject(new AgentTimeoutError('execution', timeout));
        }, timeout);
      });

      const executionResult = await Promise.race([executionPromise, timeoutPromise]);
      
      result.output = executionResult.output;
      result.toolCalls = executionResult.toolCalls;
      result.messages = executionResult.messages;
      result.usage = executionResult.usage;
      result.status = 'completed';

      // Record success for circuit breaker
      this.circuitBreaker?.recordSuccess();

      this.emit('execution:complete', { executionId, result });
    } catch (error) {
      result.status = error instanceof AgentTimeoutError ? 'timeout' : 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      
      // Record failure for circuit breaker
      this.circuitBreaker?.recordFailure();

      this.emit('execution:error', { executionId, error });
    } finally {
      result.duration = Date.now() - startTime;
      result.messages = messages;
      
      // Record metrics
      if (this.config.metrics?.enabled) {
        this.metrics.recordExecution(result);
      }
    }

    return result;
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    messages: Message[],
    config: ExecutionConfig
  ): Promise<ExecutionResult> {
    const retryConfig = this.config.retry!;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        this.emit('execution:attempt', { attempt, max: retryConfig.maxRetries });
        
        return await this.executeCore(messages, config);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry non-retryable errors
        if (error instanceof AgentError && !error.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        this.emit('execution:retry', { attempt, delay, error: lastError.message });
        
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Core execution logic
   */
  private async executeCore(
    messages: Message[],
    config: ExecutionConfig
  ): Promise<ExecutionResult> {
    // This would integrate with actual LLM providers
    // For now, return a simulated result
    
    const result: ExecutionResult = {
      id: this.generateId(),
      status: 'completed',
      output: `Processed: ${messages[messages.length - 1]?.content || ''}`,
      toolCalls: [],
      messages,
      usage: {
        promptTokens: this.estimateTokens(messages),
        completionTokens: 50,
        totalTokens: this.estimateTokens(messages) + 50,
      },
      duration: 0,
    };

    return result;
  }

  /**
   * Stream execution
   */
  async *stream(
    task: string,
    config: ExecutionConfig = {}
  ): AsyncGenerator<StreamChunk> {
    await this.initialize();

    const executionId = this.generateId();
    this.emit('stream:start', { executionId, task });

    try {
      // Simulated streaming
      const chunks = ['Processing', ' your', ' request', '...'];
      
      for (const content of chunks) {
        yield {
          type: 'content',
          content,
        };
        await this.sleep(100);
      }

      yield {
        type: 'done',
        usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 },
      };

      this.emit('stream:complete', { executionId });
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
      this.emit('stream:error', { executionId, error });
    }
  }

  /**
   * Health check
   */
  async health(): Promise<HealthStatus> {
    const checks: Record<string, { status: 'pass' | 'fail' | 'warn'; message?: string }> = {};

    // Check initialization
    checks.initialized = {
      status: this.isInitialized ? 'pass' : 'fail',
      message: this.isInitialized ? 'Runtime initialized' : 'Runtime not initialized',
    };

    // Check circuit breaker
    if (this.circuitBreaker) {
      const state = this.circuitBreaker.getState();
      checks.circuitBreaker = {
        status: state === 'closed' ? 'pass' : state === 'open' ? 'fail' : 'warn',
        message: `Circuit breaker state: ${state}`,
      };
    }

    // Check metrics
    if (this.config.metrics?.enabled) {
      checks.metrics = {
        status: this.metrics.isHealthy() ? 'pass' : 'warn',
        message: 'Metrics collection active',
      };
    }

    const allPass = Object.values(checks).every(c => c.status === 'pass');
    const anyFail = Object.values(checks).some(c => c.status === 'fail');

    return {
      status: allPass ? 'healthy' : anyFail ? 'unhealthy' : 'degraded',
      version: '1.0.0',
      uptime: process.uptime(),
      checks,
    };
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    const { baseDelay, maxDelay, factor } = this.config.retry!;
    const exponentialDelay = baseDelay * Math.pow(factor, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  /**
   * Estimate token count
   */
  private estimateTokens(messages: Message[]): number {
    return messages.reduce((sum, msg) => {
      return sum + Math.ceil(msg.content.length / 4);
    }, 0);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<RuntimeConfig> {
    return { ...this.config };
  }

  /**
   * Get metrics
   */
  getMetrics(): AgentMetrics {
    return this.metrics;
  }
}
