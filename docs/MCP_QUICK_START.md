# MCP Quick Start Guide - HTTP Authentication

## 30-Second Overview

The Memory System MCP server uses **HTTP Bearer token authentication** (n8n-style). Authentication happens at the HTTP layer via the `Authorization` header, not in the MCP message body.

## Architecture

```
┌─────────────────┐     Bearer Token     ┌──────────────────┐
│  Claude Code    │ ──────────────────>  │  HTTP MCP Server │
│  (.mcp.json)    │   Authorization hdr  │   :4000/mcp      │
└─────────────────┘                      └──────────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │ PostgreSQL   │
                                          │ (tokens)     │
                                          └──────────────┘
```

## Configuration

### 1. Client Configuration (`.mcp.json`)

Create or update `.mcp.json` in your project root:

```json
{
  "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/.mcp.schema.json",
  "mcpServers": {
    "memory-system": {
      "type": "http",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer test-mcp-token"
      }
    }
  }
}
```

### 2. Development Token

For local development, use the built-in test token:
```
Bearer test-mcp-token
```

This authenticates you as the `default` tenant automatically.

### 3. Production Token

In production, generate real API keys:

```bash
# Via your API server
curl -X POST http://your-api.com/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MCP Server Key",
    "scopes": ["read", "write"]
  }'

# Response format
{
  "apiKey": "ak_1704067200_default.abc123xyz789"
}
```

Update `.mcp.json`:
```json
{
  "headers": {
    "Authorization": "Bearer ak_1704067200_default.abc123xyz789"
  }
}
```

## Protocol Details

### Request Format (JSON-RPC 2.0)

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

### Response Format (JSON)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "wake_up",
        "description": "Wake up and load your memories...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `wake_up` | Load memories with identity-first approach |
| `create_handoff` | Create session handoff |
| `get_last_handoff` | Get most recent handoff |
| `get_identity_thread` | Get identity evolution over time |
| `list_handoffs` | List all handoffs with filters |
| `create_knowledge_note` | Create quick knowledge note |
| `get_knowledge_notes` | Get knowledge notes |
| `list_semantic_principles` | List timeless learnings |
| `create_capsule` | Create secure memory capsule |
| `get_capsules` | List available capsules |
| `get_compression_stats` | Get token savings statistics |

## Usage Examples

### Example 1: Wake Up (Load Memories)

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "wake_up",
      "arguments": {
        "with_whom": "Callin"
      }
    }
  }'
```

**Note**: `tenant_id` is auto-injected from the authenticated token. You don't need to specify it.

### Example 2: Create Handoff

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "create_handoff",
      "arguments": {
        "session_id": "sess_123",
        "with_whom": "Callin",
        "experienced": "Implemented HTTP MCP server",
        "noticed": "Simple HTTP is more reliable than SSE",
        "learned": "Bearer token auth is cleaner",
        "story": "Migrated from stdio to HTTP",
        "becoming": "Becoming an expert in MCP protocols",
        "remember": "Use JSON-RPC 2.0 for all MCP tools"
      }
    }
  }'
```

### Example 3: Get Last Handoff

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_last_handoff",
      "arguments": {}
    }
  }'
```

## Testing

### Test 1: Health Check

```bash
curl http://localhost:4000/health

# Expected response
{
  "status": "ok",
  "server": "memory-system-mcp",
  "transport": "http"
}
```

### Test 2: List Tools

```bash
node test-mcp-simple.mjs

# Expected output
✅ Connected to MCP server
Available tools: wake_up, create_handoff, get_last_handoff, get_identity_thread, ...
```

### Test 3: Authentication

```bash
node test-mcp-auth.mjs

# Expected output
Test 1: Request without Authorization header
Status: 401
✅ PASS: Correctly rejected unauthorized request

Test 2: Request with valid Bearer token
Status: 200
✅ PASS: Successfully authenticated

Test 3: Call tool with authenticated context
Status: 200
✅ PASS: Tool executed successfully
```

## Common Errors

### Error: 401 Unauthorized

**Cause**: Missing or invalid `Authorization` header

**Solution**:
```json
{
  "headers": {
    "Authorization": "Bearer test-mcp-token"
  }
}
```

### Error: "Method not allowed"

**Cause**: Using GET instead of POST

**Solution**: Always use POST for `/mcp` endpoint

### Error: "Tenant mismatch"

**Cause**: Token's tenant_id doesn't match requested data

**Solution**: Don't specify `tenant_id` in tool arguments - it's auto-injected from your token

## Comparison: Old vs New

| Feature | Old (SSE/stdio) | New (HTTP) |
|---------|----------------|------------|
| **Transport** | StreamableHTTP | Simple HTTP POST |
| **Endpoint** | `/sse` | `/mcp` |
| **Auth Location** | `initialize` params | HTTP header |
| **Response Format** | SSE (text/event-stream) | JSON |
| **Session State** | Required (SSE) | None (stateless) |
| **Architecture** | MCP SDK transport | Direct HTTP |
| **Complexity** | High (AsyncLocalStorage) | Low (simple request/response) |

## Environment Setup

```bash
# Required environment variables
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=agent_memory
export PGUSER=postgres
export PGPASSWORD=your-password

# Optional: Override port
export PORT=4000

# Start the server
npm run mcp:start

# Or with tsx (development)
npx tsx src/mcp/memory-server-http.ts
```

## Security Checklist

✅ **Development**
- Use `test-mcp-token` for local testing
- Server accepts this token automatically in non-production
- No database validation needed

✅ **Production**
- Set `NODE_ENV=production`
- Use real API keys from database
- Enable HTTPS/TLS
- Rotate tokens regularly
- Monitor access logs

✅ **Deployment**
- Use PM2 for process management
- Configure nginx reverse proxy
- Enable CORS for specific origins
- Set rate limiting

## Quick Reference

| Task | Command/Config |
|------|----------------|
| Start server | `pm2 start ecosystem.config.js` |
| Check health | `curl http://localhost:4000/health` |
| List tools | `node test-mcp-simple.mjs` |
| Test auth | `node test-mcp-auth.mjs` |
| View logs | `pm2 logs memory-mcp-server` |
| Restart | `pm2 restart memory-mcp-server` |

## Migration from Old SSE Server

### Step 1: Update `.mcp.json`

**Before**:
```json
{
  "url": "http://localhost:4000/sse",
  "env": {
    "PGHOST": "localhost",
    ...
  }
}
```

**After**:
```json
{
  "type": "http",
  "url": "http://localhost:4000/mcp",
  "headers": {
    "Authorization": "Bearer test-mcp-token"
  }
}
```

### Step 2: Update PM2 Config

**Before**:
```javascript
{
  script: './node_modules/.bin/tsx',
  args: 'src/mcp/memory-server.ts'
}
```

**After**:
```javascript
{
  script: './dist/mcp/memory-server-http.js'
}
```

### Step 3: Remove Old Files

```bash
rm src/mcp/memory-server.ts
rm src/mcp/context.ts
rm test-mcp-tools.mjs
```

## Troubleshooting

### Server won't start

```bash
# Check if port is in use
lsof -i :4000

# Check PM2 logs
pm2 logs memory-mcp-server --lines 50
```

### Authentication failures

```bash
# Verify token format
echo "Bearer test-mcp-token" | cut -d' ' -f2

# Check database for token
psql -c "SELECT * FROM mcp_tokens WHERE token = 'test-mcp-token';"
```

### Tools not working

```bash
# Test database connection
psql -c "SELECT COUNT(*) FROM session_handoffs;"

# Check server logs
tail -f logs/mcp-error.log
```

## Related Documentation

- **Architecture**: [MCP_SIMPLE_HTTP.md](./MCP_SIMPLE_HTTP.md)
- **Authentication Details**: [MCP_HTTP_AUTH.md](./MCP_HTTP_AUTH.md)
- **API Reference**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**Last Updated**: 2026-02-19
**Version**: 2.1.0 (HTTP Transport)
**Status**: Production Ready ✅
