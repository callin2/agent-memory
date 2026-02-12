# Agent Memory System v2.0 API Documentation

Complete API reference for the Agent Memory System, a PostgreSQL-backed persistent memory service for AI agents.

## Quick Links

- [Interactive API Documentation (Swagger UI)](./swagger-ui.html) - Explore and test API endpoints
- [OpenAPI Specification (YAML)](./openapi.yaml) - Machine-readable API specification
- [Postman Collection](./postman-collection.json) - Import into Postman for testing

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Valid account credentials or OAuth provider

### Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.example.com`

### Authentication

The API supports two authentication methods:

#### 1. JWT Bearer Token

```bash
# Login to get tokens
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "your-password"
  }'

# Use access token
curl -X GET http://localhost:3000/api/v1/events?session_id=abc123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 2. API Key

```bash
# Generate API key (requires admin role)
curl -X POST http://localhost:3000/auth/api-keys \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scopes": ["read:events", "write:events"]}'

# Use API key
curl -X POST http://localhost:3000/api/v1/events \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_123",
    "session_id": "sess_456",
    "role": "user",
    "content": "Hello!"
  }'
```

## Core Concepts

### Tenant Isolation

All data is isolated by `tenant_id`. Users can only access data belonging to their tenant, ensuring multi-tenancy security.

### Events

Events are the primary data structure, representing discrete interactions in the system.

**Event Types:**
- `system` - System-generated events
- `user` - User messages/actions
- `assistant` - AI agent responses
- `function` - Function call results

### Active Context Bundle (ACB)

ACBs are curated collections of memory items (chunks, decisions, artifacts) assembled dynamically for an agent based on:
- Current session history
- Agent intent
- Query relevance
- Token budget constraints

### Memory Capsules

Capsules are time-bounded, curated memory packages with:
- Specific audience (agent IDs)
- Expiry dates
- Access controls
- Risk metadata

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/login` | User login | No |
| POST | `/auth/register` | User registration | No |
| POST | `/auth/token/refresh` | Refresh access token | No |
| POST | `/auth/token/revoke` | Revoke refresh token (logout) | No |
| POST | `/auth/api-keys` | Generate API key | Yes (Admin) |
| POST | `/auth/validate` | Validate token | No |

### OAuth

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/auth/oauth/providers` | List OAuth providers | No |
| GET | `/auth/oauth/{provider}` | Initiate OAuth flow | No |
| GET | `/auth/oauth/{provider}/callback` | OAuth callback handler | No |
| POST | `/auth/oauth/link` | Link OAuth account | Yes |
| GET | `/auth/oauth/connections` | List OAuth connections | Yes |
| DELETE | `/auth/oauth/connections/{id}` | Unlink OAuth account | Yes |

### Sessions

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/auth/sessions` | List active sessions | Yes |
| GET | `/auth/sessions/stats` | Get session statistics | Yes |
| DELETE | `/auth/sessions/{id}` | Revoke specific session | Yes |
| DELETE | `/auth/sessions` | Revoke all sessions | Yes |

### Events

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/events` | Record an event | Yes |
| GET | `/api/v1/events` | Query events by session | Yes |
| GET | `/api/v1/events/{event_id}` | Get event by ID | Yes |

### Active Context Bundle (ACB)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/acb/build` | Build ACB for agent | Yes |

### Memory Operations

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/chunks/{chunk_id}` | Get memory chunk | Yes |
| GET | `/api/v1/artifacts/{artifact_id}` | Get artifact | Yes |

### Decisions

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/decisions` | Create decision | Yes |
| GET | `/api/v1/decisions` | Query decisions | Yes |

### Capsules

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/capsules` | Create capsule | Yes |
| GET | `/api/v1/capsules` | Query available capsules | Yes |
| GET | `/api/v1/capsules/{id}` | Get capsule | Yes |
| DELETE | `/api/v1/capsules/{id}` | Revoke capsule | Yes |

### Memory Surgery (Edits)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/edits` | Create memory edit | Yes |
| GET | `/api/v1/edits` | List memory edits | Yes |
| GET | `/api/v1/edits/{edit_id}` | Get edit details | Yes |
| PUT | `/api/v1/edits/{edit_id}/approve` | Approve pending edit | Yes |

### Health & Metrics

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| GET | `/metrics` | Prometheus metrics | No |
| GET | `/metrics/json` | Metrics as JSON | No |

## Memory Surgery Operations

Memory Surgery allows you to govern and control your agent memory with five operations:

### Edit Operations

**retract**: Hard-delete a memory chunk (excluded from ALL queries)
```json
{
  "target_type": "chunk",
  "target_id": "chk_abc123",
  "op": "retract",
  "reason": "PII violation - contains social security number"
}
```

**amend**: Modify chunk text and/or importance
```json
{
  "target_type": "chunk",
  "target_id": "chk_abc123",
  "op": "amend",
  "reason": "Correct customer name",
  "patch": {
    "text": "John Doe called regarding billing issue",
    "importance": 0.8
  }
}
```

**quarantine**: Exclude from auto-retrieval unless explicitly requested
```json
{
  "target_type": "chunk",
  "target_id": "chk_abc123",
  "op": "quarantine",
  "reason": "Unverified information awaiting fact check"
}
```

**attenuate**: Reduce importance score
```json
{
  "target_type": "chunk",
  "target_id": "chk_abc123",
  "op": "attenuate",
  "reason": "Lower priority - resolved issue",
  "patch": {
    "importance_delta": -0.5
  }
}
```

**block**: Exclude from specific channels
```json
{
  "target_type": "chunk",
  "target_id": "chk_abc123",
  "op": "block",
  "reason": "Internal discussion not for public channels",
  "patch": {
    "channel": "public"
  }
}
```

### Edit Workflow

1. Create edit request via POST `/api/v1/edits`
2. If approval required, status=pending
3. Approver reviews and calls PUT `/api/v1/edits/{edit_id}/approve`
4. System applies edit automatically upon approval
5. All subsequent queries apply approved edits

### Scope & Subject Filtering

All memory queries support optional scope and subject filtering:

```bash
GET /api/v1/chunks/search?scope=user&subject_type=user&subject_id=user-123
```

**Scopes**:
- `session`: Memory relevant to current conversation session
- `user`: Memory about a specific user (subject_id = user_id)
- `project`: Memory relevant to project (project_id)
- `policy`: Memory about decision/policy (decision_id)
- `global`: Memory relevant to all contexts

## Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid authentication |
| 403 | Forbidden - Access denied (tenant isolation) |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Event Recording**: 100 requests/minute per tenant
- **ACB Building**: 20 requests/minute per tenant
- **General API**: 1000 requests/minute per tenant

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Error Response Format

All errors follow this structure:

```json
{
  "error": "Error type",
  "message": "Detailed error message (development only)",
  "fields": ["field1", "field2"],
  "required": ["missing_field"],
  "allowed": ["value1", "value2"]
}
```

## Code Examples

### Recording an Event

```typescript
const response = await fetch('http://localhost:3000/api/v1/events', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    agent_id: 'agent_123',
    session_id: 'sess_456',
    role: 'user',
    content: 'Hello, how can you help me today?',
    scope: 'user',
    subject_type: 'user',
    subject_id: 'user-123',
    project_id: 'project-abc'
  })
});

const data = await response.json();
console.log(data.event_id); // evt_abc123...
```

### Building an ACB

```typescript
const response = await fetch('http://localhost:3000/api/v1/acb/build', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    session_id: 'sess_456',
    agent_id: 'agent_123',
    channel: 'private',
    intent: 'user_help_request',
    query_text: 'How can you help me?',
    scope: 'user',
    subject_type: 'user',
    subject_id: 'user-123',
    max_tokens: 65000
  })
});

const acb = await response.json();
console.log(acb.chunks); // Array of relevant memory chunks
console.log(acb.total_tokens); // Total token count
```

### Creating a Memory Capsule

```typescript
const response = await fetch('http://localhost:3000/api/v1/capsules', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    author_agent_id: 'agent_123',
    subject_type: 'session',
    subject_id: 'sess_456',
    scope: 'session',
    audience_agent_ids: ['agent_456', 'agent_789'],
    items: {
      chunks: ['chk_abc123', 'chk_def456'],
      decisions: [],
      artifacts: []
    },
    ttl_days: 30
  })
});

const capsule = await response.json();
console.log(capsule.capsule_id);
```

## SDKs and Libraries

Official SDKs:

- [TypeScript/JavaScript SDK](../packages/client/) - npm: `@agent-memory/sdk`
- [Python SDK](../packages/python-sdk/) - pip: `agent-memory-sdk`

Community SDKs:
- [Go SDK](https://github.com/community/agent-memory-go) - Community maintained
- [Rust SDK](https://github.com/community/agent-memory-rs) - Community maintained

## Support

- Documentation: [https://docs.example.com](https://docs.example.com)
- GitHub Issues: [https://github.com/example/agent-memory/issues](https://github.com/example/agent-memory/issues)
- Email: support@example.com

## License

MIT License - See [LICENSE](../LICENSE) for details.
