# Agent Memory System API - Quick Reference Card

Quick reference for common API operations.

## Base URL

```
Development: http://localhost:3000
Production:  https://api.example.com
```

## Authentication

### Login
```bash
curl -X POST {baseURL}/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"password"}'
```

### Using Token
```bash
curl -X GET {baseURL}/api/v1/events?session_id=xxx \
  -H "Authorization: Bearer {access_token}"
```

### Refresh Token
```bash
curl -X POST {baseURL}/auth/token/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"{refresh_token}"}'
```

## Core Operations

### Record Event
```bash
curl -X POST {baseURL}/api/v1/events \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_123",
    "session_id": "sess_456",
    "role": "user",
    "content": "Hello!"
  }'
```

### Get Session Events
```bash
curl -X GET "{baseURL}/api/v1/events?session_id=sess_456&limit=100" \
  -H "Authorization: Bearer {token}"
```

### Build ACB
```bash
curl -X POST {baseURL}/api/v1/acb/build \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "sess_456",
    "agent_id": "agent_123",
    "channel": "private",
    "intent": "user_request",
    "max_tokens": 65000
  }'
```

### Create Decision
```bash
curl -X POST {baseURL}/api/v1/decisions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "Use PostgreSQL",
    "rationale": ["ACID compliance", "Mature ecosystem"],
    "scope": "project"
  }'
```

### Create Capsule
```bash
curl -X POST {baseURL}/api/v1/capsules \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "author_agent_id": "agent_123",
    "subject_type": "session",
    "subject_id": "sess_456",
    "scope": "session",
    "audience_agent_ids": ["agent_456"],
    "items": {
      "chunks": ["chk_123"],
      "decisions": [],
      "artifacts": []
    },
    "ttl_days": 30
  }'
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200  | Success |
| 201  | Created |
| 400  | Bad Request |
| 401  | Unauthorized |
| 403  | Forbidden |
| 404  | Not Found |
| 409  | Conflict |
| 500  | Server Error |

## Event Types

- `system` - System events
- `user` - User messages
- `assistant` - Agent responses
- `function` - Function calls

## ACB Channels

- `private` - Private messages
- `public` - Public channels
- `team` - Team collaboration
- `agent` - Agent-to-agent

## Decision Scope

- `project` - Project-level decisions
- `user` - User-specific decisions
- `global` - Global decisions

## Capsule Scope

- `session` - Session-specific
- `user` - User-specific
- `project` - Project-wide
- `policy` - Policy-level
- `global` - Global scope

## ID Formats

```
Event:    evt_[a-f0-9]{16}
Chunk:    chk_[a-f0-9]{16}
Artifact: art_[a-f0-9]{16}
Decision: dec_[timestamp]_[random]
Session:  sess_[timestamp]_[random]
Capsule:  cap_[timestamp]_[random]
```

## Rate Limits

- Events: 100/min per tenant
- ACB: 20/min per tenant
- General: 1000/min per tenant

## Health Check

```bash
curl {baseURL}/health
```

## Metrics

```bash
curl {baseURL}/metrics/json
```

## TypeScript Example

```typescript
const api = {
  baseURL: 'http://localhost:3000',
  token: '',

  async login(username: string, password: string) {
    const res = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    this.token = data.access_token;
    return data;
  },

  async recordEvent(agent_id: string, session_id: string, role: string, content: string) {
    const res = await fetch(`${this.baseURL}/api/v1/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ agent_id, session_id, role, content })
    });
    return res.json();
  }
};

// Usage
await api.login('user@example.com', 'password');
await api.recordEvent('agent_123', 'sess_456', 'user', 'Hello!');
```

## Python Example

```python
import requests

class AgentMemoryAPI:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
        self.token = None

    def login(self, username, password):
        res = requests.post(f'{self.base_url}/auth/login',
            json={'username': username, 'password': password})
        data = res.json()
        self.token = data['access_token']
        return data

    def record_event(self, agent_id, session_id, role, content):
        res = requests.post(f'{self.base_url}/api/v1/events',
            headers={'Authorization': f'Bearer {self.token}'},
            json={'agent_id': agent_id, 'session_id': session_id, 'role': role, 'content': content})
        return res.json()

# Usage
api = AgentMemoryAPI()
api.login('user@example.com', 'password')
api.record_event('agent_123', 'sess_456', 'user', 'Hello!')
```

## Common Errors

### Missing Token
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid Authorization header"
}
```
**Solution**: Add `Authorization: Bearer {token}` header

### Invalid Token
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```
**Solution**: Refresh token using `/auth/token/refresh`

### Tenant Isolation
```json
{
  "error": "Forbidden",
  "message": "Cannot access data from different tenant"
}
```
**Solution**: Ensure tenant_id matches authenticated user

### Validation Error
```json
{
  "error": "Validation failed",
  "errors": ["Missing required field: session_id"]
}
```
**Solution**: Include all required fields

## Resources

- Full API: http://localhost:8080/swagger-ui.html
- OpenAPI Spec: http://localhost:8080/openapi.yaml
- Documentation: /docs/README.md
- Setup Guide: /docs/SETUP.md
