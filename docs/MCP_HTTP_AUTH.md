# MCP HTTP Authentication (n8n-style)

## Overview

The Memory System MCP server now supports **HTTP Bearer token authentication**, following the same pattern used by n8n. This allows you to authenticate using an `Authorization` header instead of passing credentials in the MCP message body.

## Configuration

### Client Configuration (`.mcp.json`)

```json
{
  "mcpServers": {
    "memory-system": {
      "type": "http",
      "url": "http://localhost:4000/sse",
      "headers": {
        "Authorization": "Bearer <YOUR_TOKEN>"
      }
    }
  }
}
```

### Development Tokens

For development, use the test token:
```
Bearer test-mcp-token
```

This token is automatically accepted in non-production environments and authenticates you as the `default` tenant.

## Token Format

Production API keys follow this format:
```
ak_<timestamp>_<tenant_id>.<signature>
```

Example:
```
ak_1704067200_default.abc123xyz789
```

## How It Works

1. **HTTP Layer**: The Bearer token is extracted from the `Authorization` header
2. **Validation**: Token is validated against the database (or accepted in dev mode)
3. **Context Injection**: Authenticated `tenant_id` is injected into the tool call context
4. **Auto-fill**: Tools automatically use the authenticated tenant_id

## Example Usage

### Without Authentication (Old Way - Still Supported)

```json
{
  "method": "tools/call",
  "params": {
    "name": "wake_up",
    "arguments": {
      "tenant_id": "default"
    }
  }
}
```

### With HTTP Authentication (New Way - Recommended)

```json
{
  "method": "tools/call",
  "params": {
    "name": "wake_up"
    // tenant_id automatically injected from authenticated token
  }
}
```

## Testing

Run the authentication test script:

```bash
# Start the MCP server first
npm run mcp:start

# In another terminal, run tests
node test-mcp-auth.mjs
```

Expected output:
```
Test 1: Request without Authorization header
Status: 401
✅ PASS: Correctly rejected unauthorized request

Test 2: Request with invalid Bearer token
Status: 401
✅ PASS: Correctly rejected invalid token

Test 3: Request with valid Bearer token
Status: 200
✅ PASS: Successfully authenticated

Test 4: List tools with valid token
Status: 200
Available tools: wake_up, wake_up_stratified, create_handoff, get_last_handoff, get_identity_thread
✅ PASS: Successfully listed tools
```

## Security

### Production Deployment

In production:
1. Set `NODE_ENV=production`
2. Use real API keys stored in the `api_keys` table
3. Tokens are validated against the database
4. Only active, non-expired keys are accepted

### Creating API Keys

API keys should be created through your main API server. Example format:

```typescript
const timestamp = Math.floor(Date.now() / 1000);
const tenant_id = "your-tenant-id";
const signature = crypto.randomBytes(16).toString("hex");
const apiKey = `ak_${timestamp}_${tenant_id}.${signature}`;
```

Store in database:
```sql
INSERT INTO api_keys (api_key, tenant_id, is_active, created_at)
VALUES ('ak_1704067200_default.abc123xyz', 'default', true, NOW());
```

## Comparison: n8n vs Memory System

| Feature | n8n | Memory System |
|---------|-----|---------------|
| Auth Type | Bearer token in headers | Bearer token in headers |
| Header Name | `Authorization` | `Authorization` |
| Token Format | JWT or API key | API key format |
| Endpoint | `/mcp-server/http` | `/sse` |
| Transport | HTTP | Streamable HTTP |

## Troubleshooting

### 401 Unauthorized

**Cause**: Missing or invalid `Authorization` header

**Solution**:
```json
{
  "headers": {
    "Authorization": "Bearer test-mcp-token"
  }
}
```

### "Missing Authorization header" Error

**Cause**: No `Authorization` header in request

**Solution**: Add the header to your `.mcp.json` configuration

### Tenant ID Mismatch

**Cause**: Trying to access data for a different tenant than authenticated

**Solution**: Ensure your token is for the correct tenant, or don't specify `tenant_id` in tool calls (it will be auto-injected)

## Migration Guide

### From Old Auth (in initialize params)

```json
{
  "method": "initialize",
  "params": {
    "authorization": {
      "type": "bearer",
      "token": "your-token"
    }
  }
}
```

### To New Auth (in HTTP headers)

```json
{
  "mcpServers": {
    "memory-system": {
      "url": "http://localhost:4000/sse",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

Both methods still work, but HTTP header auth is recommended for new integrations.

## Related Documentation

- [MCP Quick Start](./MCP_QUICK_START.md)
- [MCP Authentication Details](./MCP_AUTHENTICATION.md)
- [API Documentation](./API_DOCUMENTATION.md)
