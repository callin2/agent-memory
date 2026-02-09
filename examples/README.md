# Agent Memory System - Authentication Examples

This directory contains example clients demonstrating how to use the Agent Memory System API with the new authentication features.

## Features Demonstrated

- ✅ **JWT Authentication** - Login with username/password, obtain access tokens
- ✅ **Refresh Token Rotation** - Automatically refresh access tokens
- ✅ **API Key Authentication** - Service-to-service authentication
- ✅ **MCP Authentication** - Connect to MCP server with tokens
- ✅ **Session Management** - List and manage user sessions
- ✅ **Event Recording** - Store events with authentication
- ✅ **Active Context Bundles** - Build ACB with authenticated requests

## Examples

### 1. Node.js Client (JWT + Refresh Tokens)

**File:** `nodejs-client.ts`

Demonstrates complete authentication flow with JWT tokens and automatic refresh:

```typescript
import { AgentMemoryClient } from './nodejs-client';

const client = new AgentMemoryClient();

// Login
await client.login('username', 'password', 'tenant-id');

// Record event (handles token refresh automatically)
await client.recordEvent({
  session_id: 'session-123',
  channel: 'private',
  actor: { type: 'human', id: 'user-456' },
  kind: 'message',
  content: { text: 'Hello!' }
});

// Build ACB
const acb = await client.buildACB({
  session_id: 'session-123',
  agent_id: 'agent-789',
  channel: 'private',
  intent: 'Respond to greeting'
});

// List sessions
const sessions = await client.listSessions();

// Logout
await client.logout();
```

**Run:**
```bash
npm install node-fetch @types/node-fetch
tsx examples/nodejs-client.ts
```

### 2. API Key Client

**File:** `api-key-client.ts`

Demonstrates service-to-service authentication using API keys:

```typescript
import { APIKeyClient } from './api-key-client';

const API_KEY = 'ak_1234567890.abcdef...';
const client = new APIKeyClient(API_KEY);

// Record event (no login required)
await client.recordEvent({
  session_id: 'service-session',
  channel: 'private',
  actor: { type: 'agent', id: 'service-agent' },
  kind: 'message',
  content: { text: 'Automated event' }
});

// Build ACB
const acb = await client.buildACB({
  session_id: 'service-session',
  agent_id: 'service-agent',
  channel: 'private',
  intent: 'Process task'
});
```

**Run:**
```bash
tsx examples/api-key-client.ts
```

### 3. MCP Client

**File:** `mcp-client.ts`

Demonstrates connecting to the MCP server with authentication:

```typescript
import { MCPClient } from './mcp-client';

const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const client = new MCPClient('npm', ['run', 'start:mcp']);

// Initialize with authentication
await client.initialize(JWT_TOKEN, 'bearer');

// List available tools
const tools = await client.listTools();

// Record event via MCP
await client.recordEvent({
  session_id: 'mcp-session',
  channel: 'private',
  actor: { type: 'human', id: 'user-456' },
  kind: 'message',
  content: { text: 'Hello via MCP!' }
});

// Build ACB via MCP
await client.buildACB({
  session_id: 'mcp-session',
  agent_id: 'mcp-agent',
  channel: 'private',
  intent: 'Process MCP request'
});
```

**Run:**
```bash
tsx examples/mcp-client.ts
```

### 4. Python Client

**File:** `python-client.py`

Demonstrates using the API with Python:

```python
from agent_memory_client import AgentMemoryClient

client = AgentMemoryClient()

# Login
client.login('username', 'password', 'tenant-id')

# Record event
event = client.record_event({
    'session_id': 'session-123',
    'channel': 'private',
    'actor': {'type': 'human', 'id': 'user-456'},
    'kind': 'message',
    'content': {'text': 'Hello from Python!'}
})

# Build ACB
acb = client.build_acb({
    'session_id': 'session-123',
    'agent_id': 'agent-789',
    'channel': 'private',
    'intent': 'Respond to greeting'
})

# List sessions
sessions = client.list_sessions()

# Logout
client.logout()
```

**Run:**
```bash
pip install requests
python examples/python-client.py
```

## Authentication Methods

### JWT Token Authentication (Recommended for Interactive Applications)

1. **Login** to obtain access token and refresh token
2. **Use access token** in Authorization header: `Authorization: Bearer <token>`
3. **Refresh access token** when it expires (15 minutes)
4. **Logout** to revoke refresh token

**Example Request:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass","tenant_id":"default"}'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "rt_1234567890_abc123...",
  "expires_in": 900,
  "refresh_expires_in": 604800,
  "user": {
    "user_id": "user_123",
    "tenant_id": "default",
    "username": "user",
    "roles": ["user"]
  }
}
```

### API Key Authentication (Recommended for Service Accounts)

1. **Generate API key** via API or dashboard
2. **Use API key** in X-API-Key header: `X-API-Key: <key>`

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_1234567890.abcdef..." \
  -d '{"session_id":"session-123","channel":"private","actor":{"type":"agent","id":"service"},"kind":"message","content":{"text":"Hello"}}'
```

### MCP Authentication

Include authorization in the initialize handshake:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "authorization": {
      "type": "bearer",
      "token": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

## Token Management

### Access Token
- **Lifetime:** 15 minutes (configurable via `JWT_EXPIRES_IN`)
- **Usage:** Include in `Authorization: Bearer <token>` header
- **Auto-refresh:** Client libraries handle this automatically

### Refresh Token
- **Lifetime:** 7 days (configurable via `JWT_REFRESH_EXPIRES_IN`)
- **Usage:** Exchange for new access token
- **Rotation:** New refresh token issued on each use (old token revoked)
- **Security:** Single-use only, prevents token theft replay

### Refresh Flow

1. Client sends refresh token to `/auth/token/refresh`
2. Server validates refresh token and revokes it
3. Server issues new access token + new refresh token
4. Client stores new tokens

## Security Best Practices

### For Interactive Applications (JWT)
- ✅ Store tokens securely (httpOnly cookies or secure storage)
- ✅ Implement automatic token refresh
- ✅ Handle token expiration gracefully
- ✅ Implement proper logout with token revocation
- ❌ Never store tokens in localStorage (XSS risk)
- ❌ Never log tokens or include in URLs

### For Service Accounts (API Keys)
- ✅ Store API keys in environment variables
- ✅ Rotate API keys regularly
- ✅ Use least-privilege scopes
- ✅ Monitor API key usage
- ❌ Never commit API keys to version control
- ❌ Never share API keys between services

### For MCP Clients
- ✅ Always include authorization in initialize
- ✅ Validate server responses
- ✅ Handle authentication errors
- ✅ Implement retry logic with backoff
- ❌ Never send tokens over unencrypted connections

## Error Handling

### Common Errors

**401 Unauthorized**
```
Error: Invalid or expired token
Solution: Refresh access token or re-login
```

**403 Forbidden**
```
Error: Insufficient permissions
Solution: Check user roles and API key scopes
```

**429 Too Many Requests**
```
Error: Rate limit exceeded
Solution: Implement exponential backoff and retry
```

**32001 MCP Authentication Required**
```
Error: Missing authorization field in initialize
Solution: Include authorization in initialize params
```

**32002 MCP Invalid Token**
```
Error: Invalid token or API key
Solution: Verify token/API key is valid and not expired
```

## Testing

### Quick Test

Run the manual test script:

```bash
tsx test-auth.ts
```

This will verify all authentication features are working.

### Integration Test

Test with the example clients:

```bash
# Node.js client
tsx examples/nodejs-client.ts

# Python client
python examples/python-client.py
```

## Support

For more information, see:
- [API Documentation](../docs/MCP_AUTHENTICATION.md)
- [Implementation Guide](../docs/PHASE_2_MCP_AUTH_SUMMARY.md)
- [Quick Start Guide](../docs/MCP_QUICK_START.md)

## License

MIT
