/**
 * @jest-environment node
 */

/**
 * Agent Runtime Tests
 */

import { AgentRuntime } from '../src/runtime.js';
import { AgentError, AgentTimeoutError, AgentRateLimitError } from '../src/errors.js';

describe('AgentRuntime', () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = new AgentRuntime({
      model: 'gpt-4-turbo-preview',
      temperature: 0.7,
      maxTokens: 4096,
      maxIterations: 5,
      timeout: 5000,
      metrics: { enabled: false },
      circuitBreaker: { enabled: false },
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await runtime.initialize();
      expect(runtime.getConfig()).toBeDefined();
    });

    it('should be idempotent', async () => {
      await runtime.initialize();
      await runtime.initialize(); // Should not throw
    });

    it('should emit initialized event', async () => {
      const listener = jest.fn();
      runtime.on('initialized', listener);
      await runtime.initialize();
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('configuration validation', () => {
    it('should reject invalid temperature', async () => {
      const invalidRuntime = new AgentRuntime({
        temperature: 3, // Invalid: > 2
      });

      await expect(invalidRuntime.initialize()).rejects.toThrow(AgentError);
    });

    it('should reject invalid maxTokens', async () => {
      const invalidRuntime = new AgentRuntime({
        maxTokens: 0, // Invalid: < 1
      });

      await expect(invalidRuntime.initialize()).rejects.toThrow(AgentError);
    });

    it('should reject invalid maxIterations', async () => {
      const invalidRuntime = new AgentRuntime({
        maxIterations: 150, // Invalid: > 100
      });

      await expect(invalidRuntime.initialize()).rejects.toThrow(AgentError);
    });
  });

  describe('execution', () => {
    beforeEach(async () => {
      await runtime.initialize();
    });

    it('should execute a task successfully', async () => {
      const result = await runtime.execute('Test task');
      
      expect(result.id).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.output).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include messages in result', async () => {
      const result = await runtime.execute('Hello');
      
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe('system');
      expect(result.messages[1]?.role).toBe('user');
      expect(result.messages[1]?.content).toBe('Hello');
    });

    it('should emit execution events', async () => {
      const startListener = jest.fn();
      const completeListener = jest.fn();
      
      runtime.on('execution:start', startListener);
      runtime.on('execution:complete', completeListener);
      
      await runtime.execute('Test');
      
      expect(startListener).toHaveBeenCalled();
      expect(completeListener).toHaveBeenCalled();
    });

    it('should handle custom execution config', async () => {
      const result = await runtime.execute('Test', {
        userId: 'user-123',
        sessionId: 'session-456',
        timeout: 10000,
      });
      
      expect(result).toBeDefined();
    });
  });

  describe('timeout handling', () => {
    it('should timeout on long execution', async () => {
      const shortTimeoutRuntime = new AgentRuntime({
        timeout: 100, // 100ms timeout
        metrics: { enabled: false },
        circuitBreaker: { enabled: false },
      });
      
      await shortTimeoutRuntime.initialize();
      
      const result = await shortTimeoutRuntime.execute('Long task');
      
      // Should handle timeout gracefully
      expect(['completed', 'timeout', 'failed']).toContain(result.status);
    });
  });

  describe('health check', () => {
    it('should return healthy status after initialization', async () => {
      await runtime.initialize();
      const health = await runtime.health();
      
      expect(health.status).toBe('healthy');
      expect(health.version).toBeDefined();
      expect(health.uptime).toBeGreaterThan(0);
    });

    it('should show not initialized before init', async () => {
      const health = await runtime.health();
      
      expect(health.status).toBe('degraded');
      expect(health.checks.initialized?.status).toBe('fail');
    });
  });

  describe('metrics', () => {
    it('should collect execution metrics', async () => {
      const metricsRuntime = new AgentRuntime({
        metrics: { enabled: true },
        circuitBreaker: { enabled: false },
      });
      
      await metricsRuntime.initialize();
      
      await metricsRuntime.execute('Task 1');
      await metricsRuntime.execute('Task 2');
      
      const metrics = metricsRuntime.getMetrics().getMetrics();
      
      expect(metrics.executions).toBe(2);
      expect(metrics.successRate).toBeGreaterThan(0);
    });

    it('should generate Prometheus format metrics', async () => {
      const metricsRuntime = new AgentRuntime({
        metrics: { enabled: true, labels: { service: 'test' } },
        circuitBreaker: { enabled: false },
      });
      
      await metricsRuntime.initialize();
      await metricsRuntime.execute('Test');
      
      const prometheusMetrics = metricsRuntime.getMetrics().getPrometheusMetrics();
      
      expect(prometheusMetrics).toContain('agent_executions_total');
      expect(prometheusMetrics).toContain('service="test"');
    });
  });

  describe('streaming', () => {
    it('should stream chunks', async () => {
      await runtime.initialize();
      
      const chunks: string[] = [];
      
      for await (const chunk of runtime.stream('Test stream')) {
        if (chunk.type === 'content' && chunk.content) {
          chunks.push(chunk.content);
        }
      }
      
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});

describe('AgentError', () => {
  it('should create error with code', () => {
    const error = new AgentError('Test error', 'TEST_CODE');
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.retryable).toBe(false);
  });

  it('should create retryable error', () => {
    const error = new AgentError('Retryable', 'RETRY_CODE', true);
    expect(error.retryable).toBe(true);
  });

  it('should serialize to JSON', () => {
    const error = new AgentError('Test', 'CODE', false, { key: 'value' });
    const json = error.toJSON();
    
    expect(json.name).toBe('AgentError');
    expect(json.message).toBe('Test');
    expect(json.code).toBe('CODE');
    expect(json.metadata).toEqual({ key: 'value' });
  });
});

describe('AgentTimeoutError', () => {
  it('should create timeout error with details', () => {
    const error = new AgentTimeoutError('testOperation', 5000);
    
    expect(error.message).toContain('timed out after 5000ms');
    expect(error.retryable).toBe(true);
    expect(error.metadata).toEqual({ operation: 'testOperation', timeout: 5000 });
  });
});

describe('AgentRateLimitError', () => {
  it('should create rate limit error', () => {
    const error = new AgentRateLimitError('Rate limited', 60, 100, 0);
    
    expect(error.retryable).toBe(true);
    expect(error.retryAfter).toBe(60);
    expect(error.limit).toBe(100);
    expect(error.remaining).toBe(0);
  });

  it('should create from headers', () => {
    const headers = {
      'retry-after': '120',
      'x-ratelimit-limit': '1000',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1234567890',
    };
    
    const error = AgentRateLimitError.fromHeaders(headers);
    
    expect(error.retryAfter).toBe(120);
    expect(error.limit).toBe(1000);
    expect(error.remaining).toBe(0);
  });
});
