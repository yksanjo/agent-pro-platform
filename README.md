# Agent Pro Platform - Enterprise AI Infrastructure

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/yksanjo/agent-pro-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/yksanjo/agent-pro-platform/actions)
[![Code Coverage](https://codecov.io/gh/yksanjo/agent-pro-platform/branch/main/graph/badge.svg)](https://codecov.io/gh/yksanjo/agent-pro-platform)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

> **Production-grade AI agent infrastructure platform built for enterprise workloads**

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT PRO PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      API GATEWAY LAYER                           │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │    │
│  │  │   Routing   │ │   Auth/Z    │ │Rate Limiting│ │  Logging  │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                   │                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      AGENT RUNTIME LAYER                         │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │    │
│  │  │   Executor  │ │   Context   │ │   Memory    │ │  Tools    │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                   │                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     INFRASTRUCTURE LAYER                         │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │    │
│  │  │   Queue     │ │   Cache     │ │   Storage   │ │  Metrics  │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@agent-pro/core` | Core agent runtime and execution engine | ✅ Production |
| `@agent-pro/gateway` | API Gateway with auth, routing, rate limiting | ✅ Production |
| `@agent-pro/memory` | Vector-based memory with persistence | ✅ Production |
| `@agent-pro/tools` | Tool registry and execution framework | ✅ Production |
| `@agent-pro/observability` | Metrics, tracing, and logging | ✅ Production |
| `@agent-pro/queue` | Distributed task queue with Redis | ✅ Production |
| `@agent-pro/cache` | Multi-layer caching (LRU + Redis) | ✅ Production |
| `@agent-pro/security` | Security middleware and audit logging | ✅ Production |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Redis 7+ (for queue and cache)
- PostgreSQL 15+ (for persistence)

### Installation

```bash
# Clone the repository
git clone https://github.com/yksanjo/agent-pro-platform.git
cd agent-pro-platform

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run migrations
npm run db:migrate

# Start the platform
npm start
```

### Basic Usage

```typescript
import { AgentRuntime, AgentConfig } from '@agent-pro/core';
import { MemoryStore } from '@agent-pro/memory';
import { ToolRegistry } from '@agent-pro/tools';

// Initialize components
const memory = new MemoryStore({
  provider: 'redis',
  url: process.env.REDIS_URL,
});

const tools = new ToolRegistry();
tools.register('search', searchTool);
tools.register('calculator', calculatorTool);

// Create agent runtime
const runtime = new AgentRuntime({
  model: 'gpt-4-turbo',
  temperature: 0.7,
  maxTokens: 4096,
  memory,
  tools,
});

// Execute agent
const result = await runtime.execute({
  task: 'Research the latest AI trends and summarize',
  userId: 'user-123',
  sessionId: 'session-456',
});

console.log(result);
```

---

## 📊 Features

### Core Agent Runtime

- ✅ **Streaming Support** - Real-time token streaming
- ✅ **Tool Calling** - Native function calling with validation
- ✅ **Memory Management** - Short-term and long-term memory
- ✅ **Context Window** - Intelligent context management
- ✅ **Error Recovery** - Automatic retry with exponential backoff
- ✅ **Rate Limiting** - Per-user and per-agent rate limits

### API Gateway

- ✅ **Authentication** - JWT, API keys, OAuth 2.0
- ✅ **Authorization** - RBAC with fine-grained permissions
- ✅ **Rate Limiting** - Token bucket algorithm
- ✅ **Request Validation** - Schema validation with Zod
- ✅ **Response Caching** - Intelligent response caching
- ✅ **CORS** - Configurable CORS policies

### Observability

- ✅ **Metrics** - Prometheus-compatible metrics
- ✅ **Tracing** - OpenTelemetry distributed tracing
- ✅ **Logging** - Structured JSON logging
- ✅ **Alerting** - Configurable alert rules
- ✅ **Dashboards** - Grafana dashboard templates

### Security

- ✅ **Input Validation** - Comprehensive input sanitization
- ✅ **Output Filtering** - PII detection and redaction
- ✅ **Audit Logging** - Complete audit trail
- ✅ **Secret Management** - Integration with Vault/AWS Secrets
- ✅ **Network Security** - mTLS support

---

## 🔧 Configuration

### Environment Variables

```bash
# Core
NODE_ENV=production
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/agent_pro
REDIS_URL=redis://localhost:6379

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Security
JWT_SECRET=your-secret-key
API_KEY_HEADER=X-API-Key

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
METRICS_ENABLED=true
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with watch mode
npm run test:watch
```

### Test Coverage Requirements

- Unit Tests: ≥ 90% coverage
- Integration Tests: ≥ 80% coverage
- E2E Tests: Critical paths covered

---

## 📈 Monitoring

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `agent_execution_time` | Agent execution duration | p99 > 5s |
| `agent_error_rate` | Error rate percentage | > 1% |
| `token_usage` | Token consumption | Budget exceeded |
| `queue_depth` | Pending tasks | > 1000 |
| `cache_hit_rate` | Cache effectiveness | < 80% |
| `memory_usage` | Memory consumption | > 80% |

### Health Checks

```bash
# Liveness probe
GET /health/live

# Readiness probe
GET /health/ready

# Detailed health
GET /health/detailed
```

---

## 🚢 Deployment

### Docker

```bash
# Build image
docker build -t agent-pro-platform:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=... \
  -e REDIS_URL=... \
  agent-pro-platform:latest
```

### Kubernetes

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=agent-pro-platform
```

### Environment Support

- ✅ Development
- ✅ Staging
- ✅ Production
- ✅ Multi-region

---

## 🔐 Security

### Authentication Methods

| Method | Use Case | Configuration |
|--------|----------|---------------|
| JWT | User authentication | `JWT_SECRET` |
| API Key | Service-to-service | `API_KEYS` |
| OAuth 2.0 | Third-party integration | OAuth config |
| mTLS | Internal services | TLS certs |

### Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

---

## 📚 Documentation

- [API Reference](./docs/api.md)
- [Architecture Guide](./docs/architecture.md)
- [Deployment Guide](./docs/deployment.md)
- [Security Guide](./docs/security.md)
- [Monitoring Guide](./docs/monitoring.md)
- [Troubleshooting](./docs/troubleshooting.md)

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone and install
git clone https://github.com/yksanjo/agent-pro-platform.git
cd agent-pro-platform
npm install

# Start development services
docker-compose up -d redis postgres

# Run in development mode
npm run dev
```

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 👥 Authors

- **Yoshi Kondo** - [yksanjo](https://github.com/yksanjo)

---

<div align="center">

**Built for Production • Designed for Scale**

[Documentation](./docs) • [API Reference](./docs/api.md) • [Examples](./examples)

</div>
