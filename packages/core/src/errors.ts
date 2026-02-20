/**
 * Agent Error Classes
 * Comprehensive error handling for production use
 */

/**
 * Base agent error
 */
export class AgentError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    retryable: boolean = false,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.retryable = retryable;
    this.metadata = metadata;
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      metadata: this.metadata,
      stack: this.stack,
    };
  }
}

/**
 * Timeout error
 */
export class AgentTimeoutError extends AgentError {
  constructor(operation: string, timeout: number) {
    super(
      `Operation '${operation}' timed out after ${timeout}ms`,
      'AGENT_TIMEOUT',
      true,
      { operation, timeout }
    );
    this.name = 'AgentTimeoutError';
  }
}

/**
 * Rate limit error
 */
export class AgentRateLimitError extends AgentError {
  public readonly retryAfter?: number;
  public readonly limit?: number;
  public readonly remaining?: number;
  public readonly resetAt?: Date;

  constructor(
    message: string,
    retryAfter?: number,
    limit?: number,
    remaining?: number,
    resetAt?: Date
  ) {
    super(
      message,
      'AGENT_RATE_LIMIT',
      true,
      { retryAfter, limit, remaining, resetAt }
    );
    this.name = 'AgentRateLimitError';
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.remaining = remaining;
    this.resetAt = resetAt;
  }

  static fromHeaders(headers: Record<string, string>): AgentRateLimitError {
    const retryAfter = parseInt(headers['retry-after'] || '60', 10);
    const limit = parseInt(headers['x-ratelimit-limit'] || '0', 10);
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '0', 10);
    const resetAt = headers['x-ratelimit-reset'] 
      ? new Date(parseInt(headers['x-ratelimit-reset'], 10) * 1000)
      : undefined;

    return new AgentRateLimitError(
      'Rate limit exceeded',
      retryAfter,
      limit,
      remaining,
      resetAt
    );
  }
}

/**
 * Model error (API errors from LLM providers)
 */
export class AgentModelError extends AgentError {
  public readonly provider?: string;
  public readonly statusCode?: number;

  constructor(
    message: string,
    provider?: string,
    statusCode?: number
  ) {
    super(
      message,
      'AGENT_MODEL_ERROR',
      statusCode !== undefined && statusCode >= 500,
      { provider, statusCode }
    );
    this.name = 'AgentModelError';
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

/**
 * Tool execution error
 */
export class AgentToolError extends AgentError {
  public readonly toolName: string;

  constructor(toolName: string, message: string) {
    super(
      `Tool '${toolName}' failed: ${message}`,
      'AGENT_TOOL_ERROR',
      false,
      { toolName }
    );
    this.name = 'AgentToolError';
    this.toolName = toolName;
  }
}

/**
 * Validation error
 */
export class AgentValidationError extends AgentError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(
    message: string,
    field?: string,
    value?: unknown
  ) {
    super(
      message,
      'AGENT_VALIDATION_ERROR',
      false,
      { field, value }
    );
    this.name = 'AgentValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Memory error
 */
export class AgentMemoryError extends AgentError {
  constructor(message: string) {
    super(
      message,
      'AGENT_MEMORY_ERROR',
      true
    );
    this.name = 'AgentMemoryError';
  }
}

/**
 * Circuit breaker open error
 */
export class AgentCircuitOpenError extends AgentError {
  public readonly opensAt?: Date;

  constructor(opensAt?: Date) {
    super(
      'Circuit breaker is open',
      'AGENT_CIRCUIT_OPEN',
      false,
      { opensAt }
    );
    this.name = 'AgentCircuitOpenError';
    this.opensAt = opensAt;
  }
}
