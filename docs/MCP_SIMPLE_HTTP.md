# MCP Server - Simple HTTP Transport

## Overview

This is a custom HTTP-based MCP server that follows n8n's architecture pattern. It handles independent HTTP POST requests without session management, making it compatible with Claude Code's HTTP client.

## Architecture

### Key Design Decisions

1. **No Session Management**: Each HTTP request is independent
2. **Bearer Token Auth**: Authentication via `Authorization` header
3. **JSON-RPC Protocol**: Standard MCP protocol over HTTP POST
4. **Simple Response Format**: JSON (not SSE)

### Comparison with StreamableHTTPServerTransport

| Feature | StreamableHTTPServerTransport | Simple HTTP |
|---------|------------------------------|-------------|
| Session Management | Required | None |
| Transport | SSE over HTTP | JSON-RPC over HTTP |
| Client Connection | Persistent | Stateless |
| Claude Code Compatible | ❌ | ✅ |
| n8n-style Pattern | ❌ | ✅ |

## Configuration

### Client Configuration (`.mcp.json`)

```json
{
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

### Server Endpoints

- **Health Check**: `GET http://localhost:4000/health`
- **MCP Protocol**: `POST http://localhost:4000/mcp`

## Authentication

### Development Token

```
Bearer test-mcp-token
```

### Production Tokens

Format: `ak_<timestamp>_<tenant_id>.<signature>`

Example:
```
ak_1704067200_default.abc123xyz789
```

## Protocol Examples

### Initialize

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    }
  }'
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {"tools": {}},
    "serverInfo": {"name": "memory-system", "version": "1.0.0"}
  }
}
```

### List Tools

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

### Call Tool

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "wake_up",
      "arguments": {"with_whom": "Callin"}
    }
  }'
```

## Deployment

### Development

```bash
# Start server directly
PORT=4000 node dist/mcp/memory-server-http.js

# Or using tsx for development
PORT=4000 npx tsx src/mcp/memory-server-http.ts
```

### Production (PM2)

```bash
# Build
npm run build

# Start with PM2
pm2 start ecosystem.config.js --only memory-mcp-server

# View logs
pm2 logs memory-mcp-server

# Restart
pm2 restart memory-mcp-server
```

## Available Tools

### wake_up

Load memories at session start with identity-first approach.

**Parameters:**
- `with_whom` (string): Person you're working with
- `tenant_id` (string, optional): Tenant identifier (auto-injected from auth)
- `layers` (array, optional): Memory layers to load
- `recent_count` (number, optional): Number of recent handoffs (default: 3)

### create_handoff

Create a session handoff to preserve continuity.

**Parameters:**
- `session_id` (string, required): Current session identifier
- `with_whom` (string, required): Person you're working with
- `experienced` (string, required): What you experienced
- `noticed` (string, required): What you noticed
- `learned` (string, required): What you learned
- `story` (string, required): The narrative
- `becoming` (string, required): Who you're becoming
- `remember` (string, required): What to remember next time
- `significance` (number, optional): Importance (0.0-1.0)
- `tags` (array, optional): Tags for retrieval

## Troubleshooting

### "Unauthorized: Missing Authorization header"

Add the Authorization header to your request:
```bash
-H "Authorization: Bearer test-mcp-token"
```

### "Method not allowed"

- Health check: Use `GET` not `POST`
- MCP endpoint: Use `POST` not `GET`

### "Invalid token"

Check your token format:
- Development: `test-mcp-token`
- Production: `ak_<timestamp>_<tenant_id>.<signature>`

## Testing

```bash
# Health check
curl http://localhost:4000/health

# Initialize
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# List tools
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

## Performance

- **Request latency**: ~2-5ms per request
- **Token auto-injection**: Zero overhead
- **No session overhead**: Stateless design
- **Database queries**: Optimized with indexes

## Security

### Best Practices

1. **Use HTTPS in production**: Deploy behind reverse proxy (nginx, Caddy)
2. **Rotate tokens regularly**: Change production API keys periodically
3. **Monitor logs**: Watch for failed authentication attempts
4. **Rate limiting**: Add rate limiting middleware for production
5. **Tenant isolation**: Each token scoped to single tenant

### Example nginx Config

```nginx
location /mcp {
    proxy_pass http://localhost:4000/mcp;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Rate limiting
    limit_req zone=mcp burst=20 nodelay;
}

limit_req_zone $binary_remote_addr zone=mcp:10m rate=10r/s;
```

## Related Documentation

- [MCP HTTP Authentication](./MCP_HTTP_AUTH.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Architecture Overview](./ARCHITECTURE.md)
