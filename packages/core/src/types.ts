/**
 * Core Types for Agent Runtime
 */

/**
 * Message role in conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Conversation message
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Tool call definition
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

/**
 * Stream chunk for streaming responses
 */
export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
  usage?: TokenUsage;
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

/**
 * Agent execution status
 */
export type ExecutionStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

/**
 * Execution result
 */
export interface ExecutionResult {
  id: string;
  status: ExecutionStatus;
  output: string;
  toolCalls: ToolCall[];
  messages: Message[];
  usage: TokenUsage;
  duration: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent configuration options
 */
export interface AgentOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  maxIterations: number;
  timeout: number;
  stream?: boolean;
}

/**
 * Execution configuration
 */
export interface ExecutionConfig {
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  timeout?: number;
  maxIterations?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Health check result
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: Record<string, HealthCheck>;
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  latency?: number;
}
