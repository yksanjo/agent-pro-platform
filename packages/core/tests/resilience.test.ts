/**
 * @jest-environment node
 */

/**
 * Circuit Breaker Tests
 */

import { CircuitBreaker, withRetry } from '../src/resilience.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });
  });

  describe('initial state', () => {
    it('should start closed', () => {
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.isOpen()).toBe(false);
    });
  });

  describe('failure handling', () => {
    it('should open after threshold failures', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('closed');
      
      circuitBreaker.recordFailure(); // 3rd failure
      expect(circuitBreaker.getState()).toBe('open');
      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should reset failures on success', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordSuccess();
      
      expect(circuitBreaker.getState()).toBe('closed');
      
      // Should need 3 more failures to open
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('closed');
    });
  });

  describe('half-open state', () => {
    it('should transition to half-open after timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      
      expect(circuitBreaker.getState()).toBe('open');
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(circuitBreaker.getState()).toBe('half-open');
    });

    it('should close after success threshold in half-open', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(circuitBreaker.getState()).toBe('half-open');
      
      // Record successes
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe('half-open'); // Need 2
      
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should reopen on failure in half-open', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(circuitBreaker.getState()).toBe('half-open');
      
      // Record failure
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('open');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.getStats().failures).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return current statistics', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordSuccess();
      
      const stats = circuitBreaker.getStats();
      
      expect(stats.state).toBe('closed');
      expect(stats.failures).toBe(0); // Reset on success
      expect(stats.successes).toBe(0);
    });
  });
});

describe('withRetry', () => {
  it('should return successful result on first try', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    
    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 1000,
      factor: 2,
    });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');
    
    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 10,
      maxDelay: 100,
      factor: 2,
    });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Always fails'));
    
    await expect(withRetry(fn, {
      maxRetries: 3,
      baseDelay: 10,
      maxDelay: 100,
      factor: 2,
    })).rejects.toThrow('Always fails');
    
    expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });

  it('should call onRetry callback', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Error'));
    const onRetry = jest.fn();
    
    try {
      await withRetry(fn, {
        maxRetries: 2,
        baseDelay: 10,
        maxDelay: 100,
        factor: 2,
      }, onRetry);
    } catch (e) {
      // Expected to fail
    }
    
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number));
  });

  it('should use exponential backoff', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Error'));
    const delays: number[] = [];
    
    try {
      await withRetry(fn, {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
        factor: 2,
      }, (attempt, _, delay) => {
        delays.push(delay);
      });
    } catch (e) {
      // Expected to fail
    }
    
    // Delays should increase exponentially
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[1]);
  });

  it('should respect maxDelay', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Error'));
    const delays: number[] = [];
    
    try {
      await withRetry(fn, {
        maxRetries: 5,
        baseDelay: 100,
        maxDelay: 200,
        factor: 2,
      }, (attempt, _, delay) => {
        delays.push(delay);
      });
    } catch (e) {
      // Expected to fail
    }
    
    // All delays should be <= maxDelay
    delays.forEach(delay => {
      expect(delay).toBeLessThanOrEqual(200);
    });
  });
});
