# MCP Authentication - Quick Start Guide

## 30-Second Overview

The MCP server now requires authentication. You must provide a JWT token or API key in the `initialize` message.

## Before (No Auth) ❌

```json
{
  "method": "initialize",
  "params": {}
}
```

**Result:** Error - "Authentication required"

## After (With Auth) ✅

### Option 1: JWT Token

```json
{
  "method": "initialize",
  "params": {
    "authorization": {
      "type": "bearer",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### Option 2: API Key

```json
{
  "method": "initialize",
  "params": {
    "authorization": {
      "type": "api_key",
      "token": "ak_1704067200_abc123.xyZ789"
    }
  }
}
```

## Getting Credentials

### Get JWT Token

```bash
curl -X POST https://your-api.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "you@example.com",
    "password": "your-password"
  }'

# Response: { "access_token": "eyJhbGci..." }
```

### Get API Key

```bash
curl -X POST https://your-api.com/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My MCP Key",
    "scopes": ["read", "write"]
  }'

# Response: { "apiKey": "ak_1704067200_..." }
```

## Complete Example (Node.js)

```javascript
import { MCPClient } from 'your-mcp-client-library';

async function main() {
  // Step 1: Get JWT token
  const authResponse = await fetch('https://your-api.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.API_USERNAME,
      password: process.env.API_PASSWORD
    })
  });

  const { access_token } = await authResponse.json();

  // Step 2: Connect to MCP server with authentication
  const client = new MCPClient({
    authorization: {
      type: 'bearer',
      token: access_token
    }
  });

  await client.connect();

  // Step 3: Use tools (tenant_id auto-injected)
  const result = await client.callTool('memory_record_event', {
    session_id: 'sess_123',
    channel: 'private',
    actor: { type: 'human', id: 'user_1' },
    kind: 'message',
    content: { text: 'Hello!' }
    // No tenant_id needed - auto-injected from token
  });

  console.log('Event recorded:', result);
}

main();
```

## Common Errors

### Error: "Authentication required: Missing authorization"

**Cause:** No authorization in initialize params

**Fix:** Add authorization field:
```json
{
  "params": {
    "authorization": { "type": "bearer", "token": "..." }
  }
}
```

### Error: "Invalid token or API key"

**Cause:** Token expired, invalid, or API key revoked

**Fix:**
- Check token expiration
- Verify API key is active
- Regenerate credentials

### Error: "Access denied: different tenant"

**Cause:** Trying to access another tenant's data

**Fix:** Ensure you're authenticated with correct tenant credentials

## Environment Setup

```bash
# Required environment variables
export API_USERNAME=your-username
export API_PASSWORD=your-password
export MCP_SERVER_URL=https://your-mcp-server.com

# Optional: Use API key instead of password
export MCP_API_KEY=ak_1704067200_abc123.xyZ789
```

## Testing Your Connection

```bash
# Test with curl
curl -X POST https://your-mcp-server.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "authorization": {
        "type": "bearer",
        "token": "'$ACCESS_TOKEN'"
      }
    }
  }'

# Expected response: { "result": { "serverInfo": { ... } } }
```

## Key Changes from Unauthenticated MCP

| Feature | Before | After |
|---------|--------|-------|
| Initialize | No auth required | Auth required |
| tenant_id | Manual in params | Auto from token |
| Cross-tenant | Possible | Blocked |
| Audit log | No logging | Full logging |
| Errors | Generic | Specific codes |

## Security Checklist

✅ Store credentials in environment variables
✅ Use HTTPS for all communications
✅ Rotate tokens regularly
✅ Monitor audit logs for suspicious activity
✅ Implement rate limiting on API keys
✅ Use minimum required scopes

## Need Help?

- **Full Documentation:** See `docs/MCP_AUTHENTICATION.md`
- **Implementation Details:** See `docs/PHASE_2_MCP_AUTH_SUMMARY.md`
- **Troubleshooting:** See `docs/MCP_AUTHENTICATION.md` → Troubleshooting section
- **Issues:** https://github.com/your-org/agent-memory-system/issues

## Quick Reference

| Task | Command |
|------|---------|
| Get JWT token | `POST /api/v1/auth/login` |
| Get API key | `POST /api/v1/api-keys` |
| Revoke key | `DELETE /api/v1/api-keys/{id}` |
| Refresh token | `POST /api/v1/auth/refresh` |
| View audit logs | `GET /api/v1/audit-logs` |

---

**Last Updated:** 2026-02-09
**Version:** 2.0.0
**Status:** Production Ready ✅
