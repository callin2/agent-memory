# MCP Server Authentication

## Overview

The Agent Memory System MCP server requires authentication for all connections. This ensures secure access to memory tools and enforces tenant isolation, preventing unauthorized data access.

## Why Authentication Matters

The MCP server exposes powerful tools for:
- Recording events to memory
- Building Active Context Bundles (ACB)
- Querying decision history
- Retrieving specific events

Without authentication, anyone connecting to the stdio interface could:
- Access any tenant's data
- Modify event history
- Query sensitive decision information
- Bypass audit logging

## Authentication Methods

The MCP server supports two authentication methods:

### 1. JWT Token (Bearer)

Recommended for user-initiated connections and interactive sessions.

**Token Format:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Initialize Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "authorization": {
      "type": "bearer",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    },
    "clientInfo": {
      "name": "my-mcp-client",
      "version": "1.0.0"
    }
  }
}
```

**Obtaining JWT Tokens:**

Via REST API:
```bash
curl -X POST https://your-api.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "password"
  }'

# Response: { "access_token": "eyJhbGci...", "refresh_token": "..." }
```

### 2. API Key

Recommended for service-to-service communication and automated agents.

**Key Format:** `ak_1704067200_abc123def456.xyZ987abc123def456`

**Initialize Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "authorization": {
      "type": "api_key",
      "token": "ak_1704067200_abc123def456.xyZ987abc123def456"
    },
    "clientInfo": {
      "name": "my-mcp-client",
      "version": "1.0.0"
    }
  }
}
```

**Obtaining API Keys:**

Via REST API:
```bash
curl -X POST https://your-api.com/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Service Key",
    "scopes": ["read", "write"],
    "rateLimit": 100
  }'

# Response: { "apiKey": "ak_1704067200_...", "keyId": "key_..." }
```

## Example Clients

### Node.js Client

**Using JWT Authentication:**
```javascript
import { MCPServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function connectWithJWT() {
  // Step 1: Login to get JWT token
  const loginResponse = await fetch('https://your-api.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'user@example.com',
      password: 'password'
    })
  });

  const { access_token } = await loginResponse.json();

  // Step 2: Connect to MCP server with authentication
  const transport = new StdioServerTransport();

  // Note: Your MCP client implementation needs to support
  // passing authorization in the initialize params
  const server = new MCPServer({
    authorization: {
      type: 'bearer',
      token: access_token
    },
    clientInfo: {
      name: 'my-nodejs-client',
      version: '1.0.0'
    }
  });

  await server.connect(transport);
}
```

**Using API Key Authentication:**
```javascript
async function connectWithAPIKey() {
  const apiKey = process.env.MCP_API_KEY;

  const server = new MCPServer({
    authorization: {
      type: 'api_key',
      token: apiKey
    },
    clientInfo: {
      name: 'my-service-client',
      version: '1.0.0'
    }
  });

  await server.connect(transport);
}
```

### Python Client

**Using JWT Authentication:**
```python
import json
import subprocess
import requests

def login_and_get_token():
    """Login to API and get JWT token"""
    response = requests.post('https://your-api.com/api/v1/auth/login', json={
        'username': 'user@example.com',
        'password': 'password'
    })
    return response.json()['access_token']

def connect_to_mcp_server():
    """Connect to MCP server with authentication"""
    token = login_and_get_token()

    # Start MCP server process
    process = subprocess.Popen(
        ['node', 'mcp-server.js'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True
    )

    # Send initialize request with authentication
    init_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "authorization": {
                "type": "bearer",
                "token": token
            },
            "clientInfo": {
                "name": "my-python-client",
                "version": "1.0.0"
            }
        }
    }

    # Send request
    process.stdin.write(json.dumps(init_request) + '\n')
    process.stdin.flush()

    # Read response
    response = json.loads(process.stdout.readline())
    print("Initialized:", response['result'])

    # Now you can call tools
    tool_request = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": "memory_record_event",
            "arguments": {
                "session_id": "sess_123",
                "channel": "private",
                "actor": {"type": "human", "id": "user_1"},
                "kind": "message",
                "content": {"text": "Hello from Python!"}
            }
        }
    }

    process.stdin.write(json.dumps(tool_request) + '\n')
    process.stdin.flush()

    response = json.loads(process.stdout.readline())
    print("Tool result:", response['result'])

if __name__ == '__main__':
    connect_to_mcp_server()
```

**Using API Key Authentication:**
```python
import os

def connect_with_api_key():
    api_key = os.environ.get('MCP_API_KEY')

    init_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "authorization": {
                "type": "api_key",
                "token": api_key
            },
            "clientInfo": {
                "name": "my-python-service",
                "version": "1.0.0"
            }
        }
    }

    # Send to MCP server...
```

### Go Client

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "os/exec"
)

type InitializeParams struct {
    ProtocolVersion string                 `json:"protocolVersion,omitempty"`
    Authorization   *Authorization         `json:"authorization,omitempty"`
    ClientInfo      *map[string]string     `json:"clientInfo,omitempty"`
}

type Authorization struct {
    Type  string `json:"type"`
    Token string `json:"token"`
}

type MCPRequest struct {
    JSONRPC string          `json:"jsonrpc"`
    ID      int             `json:"id"`
    Method  string          `json:"method"`
    Params  json.RawMessage `json:"params,omitempty"`
}

func main() {
    // Start MCP server
    cmd := exec.Command("node", "mcp-server.js")
    stdin, _ := cmd.StdinPipe()
    stdout, _ := cmd.StdoutPipe()
    cmd.Start()

    // Send initialize request with JWT
    initReq := MCPRequest{
        JSONRPC: "2.0",
        ID:      1,
        Method:  "initialize",
    }

    params := InitializeParams{
        Authorization: &Authorization{
            Type:  "bearer",
            Token: "your-jwt-token-here",
        },
        ClientInfo: &map[string]string{
            "name":    "my-go-client",
            "version": "1.0.0",
        },
    }

    paramsJSON, _ := json.Marshal(params)
    initReq.Params = paramsJSON

    // Send request
    reqJSON, _ := json.Marshal(initReq)
    stdin.Write([]byte(string(reqJSON) + "\n"))

    // Read response
    decoder := json.NewDecoder(stdout)
    var response map[string]interface{}
    decoder.Decode(&response)

    fmt.Printf("Initialized: %+v\n", response)
}
```

## Security Features

### ✅ Token Validation

- **JWT tokens**: Validated on every connection using secret key
- **API keys**: Hashed with SHA-256 and validated against database
- **Expired tokens**: Automatically rejected
- **Revoked tokens**: Checked against blacklist

### ✅ Tenant Isolation

- **Automatic enforcement**: `tenant_id` overridden from authenticated user context
- **Cross-tenant prevention**: Users cannot access data from other tenants
- **Event access control**: `get_event` verifies ownership before returning data

### ✅ Comprehensive Audit Logging

All MCP operations are logged to `audit_logs` table:

- **Connection events**: `auth.mcp_connection` logged with client info
- **Tool calls**: `mcp_tool_call` logged with tool name and sanitized arguments
- **Access denied**: `mcp_access_denied` logged with reason
- **Cross-tenant attempts**: Logged as failures for security monitoring

**Example audit log entries:**
```sql
-- Successful connection
{
  "log_id": "audit_1234567890_abc",
  "tenant_id": "tenant_1",
  "user_id": "user_123",
  "event_type": "auth.mcp_connection",
  "action": "mcp_connection",
  "outcome": "success",
  "details": {
    "client": {"name": "my-client", "version": "1.0.0"}
  }
}

-- Tool call with redacted content
{
  "log_id": "audit_1234567891_def",
  "tenant_id": "tenant_1",
  "user_id": "user_123",
  "event_type": "mcp_tool_call",
  "action": "memory_record_event",
  "outcome": "success",
  "details": {
    "tool_name": "memory_record_event",
    "args": {
      "session_id": "sess_1",
      "content": "[REDACTED]"
    }
  }
}
```

### ✅ Rate Limiting (API Keys)

API keys can be configured with rate limits:
```json
{
  "rateLimit": 100  // 100 requests per minute
}
```

Exceeded rate limits return:
```json
{
  "error": {
    "code": -32002,
    "message": "Rate limit exceeded"
  }
}
```

### ✅ Scope-Based Access Control

API keys support scopes for fine-grained permissions:
```json
{
  "scopes": ["read", "write", "admin"]
}
```

## Error Handling

### Missing Authentication

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Authentication required: Missing authorization field in initialize params"
  }
}
```

### Invalid Token

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32002,
    "message": "Authentication failed: Invalid token or API key"
  }
}
```

### Not Authenticated

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32003,
    "message": "Not authenticated: Connection not initialized"
  }
}
```

### Access Denied (Cross-Tenant)

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32004,
    "message": "Access denied: Event belongs to different tenant"
  }
}
```

### Expired API Key

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32002,
    "message": "Authentication failed: API key has expired"
  }
}
```

### Rate Limit Exceeded

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32005,
    "message": "Rate limit exceeded: API key has exceeded allowed requests per minute"
  }
}
```

## Best Practices

### 1. Token Management

**Refresh tokens before expiration:**
```javascript
// Store token with expiry
const tokenData = {
  accessToken: 'eyJhbGci...',
  expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
};

// Check expiration before using
if (Date.now() >= tokenData.expiresAt) {
  tokenData = await refreshAccessToken();
}
```

**Use refresh tokens for long-lived sessions:**
```bash
curl -X POST https://your-api.com/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "your_refresh_token"}'
```

### 2. API Key Security

**Store API keys securely:**
```bash
# Use environment variables (never hardcode)
export MCP_API_KEY="ak_1704067200_..."

# Or use secrets management
# AWS Secrets Manager, HashiCorp Vault, etc.
```

**Rotate API keys regularly:**
```bash
# Create new key
curl -X POST https://your-api.com/api/v1/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"name": "New Key", "scopes": ["read", "write"]}'

# Revoke old key
curl -X DELETE https://your-api.com/api/v1/api-keys/old_key_id \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Limit scopes to minimum required:**
```json
{
  "scopes": ["read"]  // Only read access if writing not needed
}
```

### 3. Error Handling

**Implement robust error handling:**
```javascript
async function callMCPTool(toolName, args) {
  try {
    const response = await mcpServer.callTool(toolName, args);

    if (response.error) {
      // Handle specific error codes
      switch (response.error.code) {
        case -32002:
          console.error('Authentication failed');
          // Prompt user to re-authenticate
          break;
        case -32004:
          console.error('Access denied');
          // Log security event
          break;
        default:
          console.error('MCP error:', response.error.message);
      }
      return null;
    }

    return response.result;
  } catch (error) {
    console.error('Network error:', error);
    // Implement retry logic for transient errors
    return null;
  }
}
```

### 4. Audit Log Monitoring

**Monitor for suspicious activity:**
```sql
-- Check for failed authentication attempts
SELECT
  user_id,
  COUNT(*) as failed_attempts,
  details->>'client' as client
FROM audit_logs
WHERE event_type = 'auth.mcp_connection'
  AND outcome = 'failure'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id, client
HAVING COUNT(*) > 5;

-- Check for cross-tenant access attempts
SELECT
  user_id,
  tenant_id,
  COUNT(*) as blocked_attempts
FROM audit_logs
WHERE event_type = 'mcp_access_denied'
  AND action = 'get_event'
  AND details->>'reason' = 'tenant_mismatch'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, tenant_id
HAVING COUNT(*) > 10;
```

## Testing Authentication

### Test with JWT

```bash
# Step 1: Get token
TOKEN=$(curl -s -X POST https://your-api.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"password"}' \
  | jq -r '.access_token')

# Step 2: Test MCP connection
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"authorization":{"type":"bearer","token":"'$TOKEN'"}}}' | \
  node mcp-server.js
```

### Test with API Key

```bash
# Step 1: Get API key (requires JWT)
API_KEY=$(curl -s -X POST https://your-api.com/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Key"}' \
  | jq -r '.apiKey')

# Step 2: Test MCP connection
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"authorization":{"type":"api_key","token":"'$API_KEY'"}}}' | \
  node mcp-server.js
```

### Test Tenant Isolation

```bash
# Authenticate as tenant_1 user
TOKEN_T1=$(curl -s -X POST https://your-api.com/api/v1/auth/login \
  -d '{"username":"user1@tenant1.com","password":"password"}' \
  | jq -r '.access_token')

# Try to access tenant_2 event (should fail)
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"memory_get_event","arguments":{"event_id":"evt_tenant_2"}}}' | \
  AUTH_TOKEN="$TOKEN_T1" node mcp-server.js

# Expected: Access denied error
```

## Migration Guide

### From Unauthenticated MCP

If you're currently using an unauthenticated MCP server:

**1. Update client initialization:**
```javascript
// Before (no auth)
const server = new MCPServer();

// After (with auth)
const server = new MCPServer({
  authorization: {
    type: 'bearer',
    token: await getAuthToken()
  }
});
```

**2. Update tool calls:**
```javascript
// Before (manual tenant_id)
await callTool('memory_record_event', {
  tenant_id: 'my_tenant',  // Manual specification
  session_id: 'sess_1',
  // ...
});

// After (automatic from auth)
await callTool('memory_record_event', {
  // tenant_id auto-injected from authenticated user
  session_id: 'sess_1',
  // ...
});
```

**3. Handle new errors:**
```javascript
// Add authentication error handling
if (response.error?.code === -32001) {
  // Missing authentication
  promptUserForCredentials();
}
```

## Troubleshooting

### "Missing authorization field"

**Cause:** Initialize params don't include authorization.

**Solution:**
```json
{
  "method": "initialize",
  "params": {
    "authorization": {  // ← Add this
      "type": "bearer",
      "token": "your_token"
    }
  }
}
```

### "Invalid token or API key"

**Possible causes:**
1. Token expired
2. API key revoked
3. Invalid token format
4. Wrong secret key

**Solutions:**
- Check token expiration
- Verify API key is active
- Regenerate token/key
- Check server logs for details

### "Access denied: different tenant"

**Cause:** Trying to access data from another tenant.

**Solution:** Ensure you're using the correct authentication credentials for your tenant.

### Rate limiting issues

**Cause:** API key exceeded rate limit.

**Solutions:**
- Wait for rate limit window to reset (1 minute)
- Increase rate limit on API key
- Use multiple API keys for high-volume operations

## Further Reading

- [REST API Authentication](./API_AUTHENTICATION.md)
- [API Key Management](./API_KEYS.md)
- [Audit Logging](./AUDIT_LOGGING.md)
- [Tenant Isolation](./TENANT_ISOLATION.md)
- [Security Best Practices](./SECURITY.md)

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/agent-memory-system/issues
- Documentation: https://docs.agent-memory-system.com
- Security: security@agent-memory-system.com
