# API Key Authentication

Thread's Memory System supports API key-based authentication for securing API endpoints.

## Overview

API keys provide:
- **Secure access** without username/password
- **Permission-based access control** (read, write, delete, admin)
- **Audit logging** of all API key usage
- **Key rotation** support
- **Per-tenant isolation**

## Creating an API Key

### Using the API

```bash
curl -X POST http://localhost:3456/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "default",
    "name": "Production API Key",
    "permissions": {
      "can_read": true,
      "can_write": true,
      "can_delete": false,
      "can_admin": false
    },
    "description": "API key for production application"
  }'
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "default",
  "name": "Production API Key",
  "key_prefix": "ak_7a3b2c1d",
  "permissions": {
    "can_read": true,
    "can_write": true,
    "can_delete": false,
    "can_admin": false
  },
  "is_active": true,
  "created_at": "2026-02-17T10:00:00Z",
  "api_key": "ak_7a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  "warning": "Save this API key now. You will not be able to see it again."
}
```

**⚠️ IMPORTANT:** Save the `api_key` value immediately! It will not be shown again.

### Using the CLI

```bash
# Create a new API key
npx tsx cli.ts api-key create \
  --name "Production Key" \
  --permissions read,write \
  --tenant default
```

## Using API Keys

### Via Header

```bash
curl http://localhost:3456/api/v1/handoffs?tenant_id=default \
  -H "X-API-Key: ak_7a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
```

### Via Query Parameter

```bash
curl "http://localhost:3456/api/v1/handoffs?tenant_id=default&api_key=ak_7a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
```

### Via Authorization Header

```bash
curl http://localhost:3456/api/v1/handoffs?tenant_id=default \
  -H "Authorization: Bearer ak_7a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
```

## Permissions

API keys support granular permissions:

| Permission | Description | Endpoints |
|-----------|-------------|-----------|
| `can_read` | Read-only access | GET /api/v1/handoffs, GET /api/v1/identity/* |
| `can_write` | Create/update data | POST /api/v1/handoff, POST /api/v1/knowledge |
| `can_delete` | Delete data | DELETE /api/v1/handoffs/:id |
| `can_admin` | Administrative | POST /api/v1/admin/*, DELETE /api/v1/api-keys/* |

### Permission Examples

**Read-only key:**
```json
{
  "can_read": true,
  "can_write": false,
  "can_delete": false,
  "can_admin": false
}
```

**Full access key:**
```json
{
  "can_read": true,
  "can_write": true,
  "can_delete": true,
  "can_admin": true
}
```

**Write-only key (for agents):**
```json
{
  "can_read": false,
  "can_write": true,
  "can_delete": false,
  "can_admin": false
}
```

## Listing API Keys

```bash
curl "http://localhost:3456/api/v1/api-keys?tenant_id=default" \
  -H "X-API-Key: your_admin_api_key"
```

**Response:**
```json
{
  "tenant_id": "default",
  "api_keys": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Production API Key",
      "key_prefix": "ak_7a3b2c1d",
      "permissions": { "can_read": true, "can_write": true },
      "is_active": true,
      "created_at": "2026-02-17T10:00:00Z",
      "last_used_at": "2026-02-17T12:30:00Z"
    }
  ],
  "count": 1
}
```

## Revoking API Keys

```bash
curl -X DELETE http://localhost:3456/api/v1/api-keys/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_admin_api_key" \
  -d '{
    "tenant_id": "default",
    "reason": "Key compromised - rotating"
  }'
```

## Best Practices

### 1. Principle of Least Privilege

Only grant permissions needed:
```json
// ❌ Bad: Over-privileged
{
  "can_read": true,
  "can_write": true,
  "can_delete": true,
  "can_admin": true
}

// ✅ Good: Minimum required
{
  "can_read": true,
  "can_write": false,
  "can_delete": false,
  "can_admin": false
}
```

### 2. Use Descriptive Names

```json
// ❌ Bad
{ "name": "api-key" }

// ✅ Good
{ "name": "Production - Analytics Service" }
```

### 3. Set Expiration Dates

For time-limited access:
```bash
curl -X POST http://localhost:3456/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "default",
    "name": "Temporary Access - Contractor",
    "expires_at": "2026-03-17T10:00:00Z"
  }'
```

### 4. Rotate Keys Regularly

1. Create new API key
2. Update application to use new key
3. Wait for old key to no longer be used
4. Revoke old key

```bash
# Step 1: Create new key
NEW_KEY=$(curl -s -X POST http://localhost:3456/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "default", "name": "Rotated Key"}' \
  | jq -r '.api_key')

# Step 2-3: Deploy and wait...

# Step 4: Revoke old key
curl -X DELETE http://localhost:3456/api/v1/api-keys/old-key-id \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "default", "reason": "Key rotation"}'
```

### 5. Monitor Usage

Check `last_used_at` to identify unused keys:
```bash
curl "http://localhost:3456/api/v1/api-keys?tenant_id=default" \
  -H "X-API-Key: admin_key" \
  | jq '.api_keys[] | select(.last_used_at == null) | .name'
```

## Environment Variables

Store API keys in environment variables:

```bash
# .env
AGENT_MEMORY_API_KEY=ak_7a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

```typescript
// Use in code
const apiKey = process.env.AGENT_MEMORY_API_KEY;

const response = await fetch('http://localhost:3456/api/v1/handoffs?tenant_id=default', {
  headers: {
    'X-API-Key': apiKey
  }
});
```

## Security Considerations

### ✅ DO

- Store API keys in environment variables or secret managers
- Use HTTPS in production
- Set appropriate permissions
- Rotate keys regularly
- Monitor usage via audit logs
- Revoke unused keys

### ❌ DON'T

- Commit API keys to git
- Log API keys in plain text
- Share keys via email/chat
- Use overly permissive keys
- Ignore expiration dates
- Forget to revoke old keys

## Troubleshooting

### "Invalid API key"

**Causes:**
- Typos in the key
- Key was revoked
- Key expired

**Solution:**
```bash
# Verify key is correct
echo "ak_your_key_here" | wc -c  # Should be 66 characters (ak_ + 64 hex chars)

# Check key status
curl "http://localhost:3456/api/v1/api-keys?tenant_id=default" \
  -H "X-API-Key: admin_key" \
  | jq '.api_keys[] | select(.key_prefix == "ak_your_prefix")'
```

### "Insufficient permissions"

**Cause:** API key lacks required permission

**Solution:** Update key permissions or create new key with proper permissions:
```bash
curl -X PATCH http://localhost:3456/api/v1/api-keys/key_id \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "default",
    "permissions": {
      "can_read": true,
      "can_write": true
    }
  }'
```

### "API key required"

**Cause:** Endpoint requires authentication but no key provided

**Solution:** Add API key to request:
```bash
curl http://localhost:3456/api/v1/protected-endpoint \
  -H "X-API-Key: your_api_key"
```

## Example Usage Scenarios

### 1. Web Application

```typescript
const API_KEY = process.env.AGENT_MEMORY_API_KEY;

async function createHandoff(handoff) {
  const response = await fetch('http://localhost:3456/api/v1/handoff', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify(handoff)
  });
  return response.json();
}
```

### 2. AI Agent

```typescript
import { AgentMemoryClient } from '@thread/agent-memory';

const client = new AgentMemoryClient({
  apiKey: process.env.AGENT_MEMORY_API_KEY,
  tenantId: 'default'
});

await client.createHandoff({
  experienced: 'What I did',
  becoming: 'Who I\'m becoming'
});
```

### 3. Monitoring Service

```typescript
const READONLY_KEY = process.env.AGENT_MEMORY_READONLY_KEY;

async function checkHealth() {
  const response = await fetch('http://localhost:3456/health', {
    headers: {
      'X-API-Key': READONLY_KEY
    }
  });
  return response.json();
}
```

## Audit Logging

All API key usage is logged to the `api_key_audit_log` table:

```sql
-- View recent API usage
SELECT
  api_key_id,
  endpoint,
  method,
  status_code,
  ip_address,
  created_at
FROM api_key_audit_log
WHERE tenant_id = 'default'
ORDER BY created_at DESC
LIMIT 100;

-- Find most active API keys
SELECT
  key_prefix,
  COUNT(*) as request_count,
  MAX(created_at) as last_used
FROM api_key_audit_log
JOIN api_keys ON api_key_audit_log.api_key_id = api_keys.id
WHERE api_key_audit_log.created_at > NOW() - INTERVAL '7 days'
GROUP BY key_prefix
ORDER BY request_count DESC;
```

---

**Need help?** Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) or open an issue.
