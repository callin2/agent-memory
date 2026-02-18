# API Authentication & Tenant Isolation

## Overview

The Agent Memory System v2.0 includes comprehensive security features for multi-tenant deployments:

- **API Key Authentication**: Secure API key-based authentication
- **Tenant Isolation**: Prevents cross-tenant data access
- **Permission Levels**: read, write, delete, admin permissions
- **Audit Logging**: Tracks API key usage

## Quick Start

### 1. Enable Authentication

Set environment variable:

```bash
export API_AUTH_ENABLED=true
```

**By default, authentication is DISABLED** for development convenience.

### 2. Generate API Keys

Use the API keys endpoint to generate keys:

```bash
curl -X POST http://localhost:3456/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-admin-key" \
  -d '{
    "tenant_id": "tenant_abc123",
    "name": "Production Key",
    "permissions": {
      "can_read": true,
      "can_write": true,
      "can_delete": false,
      "can_admin": false
    }
  }'
```

Response:

```json
{
  "api_key": "ak_abc123xyz...",
  "key_prefix": "ak_abc123",
  "tenant_id": "tenant_abc123",
  "name": "Production Key",
  "permissions": {
    "can_read": true,
    "can_write": true,
    "can_delete": false,
    "can_admin": false
  }
}
```

**⚠️ IMPORTANT**: Save the API key immediately! It won't be shown again.

### 3. Use API Keys

Include the API key in your requests:

```bash
# Using X-API-Key header
curl http://localhost:3456/api/v1/handoffs \
  -H "X-API-Key: ak_abc123xyz..."

# Using Authorization header
curl http://localhost:3456/api/v1/handoffs \
  -H "Authorization: Bearer ak_abc123xyz..."

# Using query parameter (less secure)
curl http://localhost:3456/api/v1/handoffs?api_key=ak_abc123xyz...
```

## Authentication Flow

```
1. Client Request → API Key (header/query)
                    ↓
2. apiKeyAuth Middleware → Verify key hash
                    ↓
3. tenantIsolation Middleware → Verify tenant_id matches
                    ↓
4. Route Handler → Process request
```

## Security Features

### API Key Storage

- Keys are hashed using SHA-256 before storage
- Only key prefix (first 10 chars) stored for identification
- Full key never logged or returned after creation

### Tenant Isolation

- API key is bound to specific tenant_id
- Requests with different tenant_id are rejected
- Prevents horizontal privilege escalation

Example attack prevented:

```bash
# API key for tenant_A tries to access tenant_B data
curl http://localhost:3456/api/v1/handoffs?tenant_id=tenant_B \
  -H "X-API-Key: ak_tenantA_key"

# Response: 403 Forbidden
{
  "error": "Tenant mismatch",
  "message": "API key is authorized for tenant 'tenant_A' but request specifies 'tenant_B'"
}
```

### Permission Levels

| Permission | Description | Example Operations |
|-----------|-------------|-------------------|
| `can_read` | Read data | GET /handoffs, GET /knowledge |
| `can_write` | Create/update | POST /handoffs, PUT /handoffs/:id |
| `can_delete` | Delete data | DELETE /handoffs/:id |
| `can_admin` | Admin ops | Create API keys, manage tenants |

## API Key Management

### List API Keys

```bash
curl http://localhost:3456/api/v1/api-keys?tenant_id=tenant_abc123 \
  -H "X-API-Key: ak_admin_key"
```

### Revoke API Key

```bash
curl -X DELETE http://localhost:3456/api/v1/api-keys/ak_abc123 \
  -H "X-API-Key: ak_admin_key"
```

### Update API Key Permissions

```bash
curl -X PUT http://localhost:3456/api/v1/api-keys/ak_abc123 \
  -H "X-API-Key: ak_admin_key" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": {
      "can_read": true,
      "can_write": true,
      "can_delete": true,
      "can_admin": false
    }
  }'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_AUTH_ENABLED` | `false` | Enable API key authentication |
| `PGHOST` | `localhost` | Database host |
| `PGDATABASE` | `agent_memory` | Database name |

## Best Practices

### 1. Development vs Production

**Development** (auth disabled):
```bash
# .env
API_AUTH_ENABLED=false
```

**Production** (auth required):
```bash
# .env.production
API_AUTH_ENABLED=true
```

### 2. API Key Rotation

1. Generate new API key
2. Update clients to use new key
3. Wait 24-48 hours
4. Revoke old key

### 3. Least Privilege

- Use read-only keys for analytics/reporting
- Use write keys for application servers
- Use admin keys only for management operations

### 4. Key Security

- Never commit API keys to git
- Use environment variables or secret management
- Rotate keys regularly (recommend: every 90 days)
- Monitor audit logs for suspicious activity

## Troubleshooting

### "API key required"

- Ensure `X-API-Key` header is set
- Check that `API_AUTH_ENABLED` is set correctly

### "Invalid API key"

- Verify API key is correct (starts with `ak_`)
- Check key hasn't been revoked
- Ensure key is active (`is_active = true`)

### "Tenant mismatch"

- API key's tenant_id doesn't match request tenant_id
- This is a security feature - prevents cross-tenant access

### "Insufficient permissions"

- API key lacks required permission for operation
- Check key's permissions in api_keys table

## Audit Logging

All API key usage is logged:

```sql
SELECT
  api_key_id,
  tenant_id,
  action,
  endpoint,
  ip_address,
  user_agent,
  created_at
FROM api_key_audit_log
WHERE tenant_id = 'tenant_abc123'
ORDER BY created_at DESC
LIMIT 100;
```

## Database Schema

### api_keys Table

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,          -- SHA-256 hash
  key_prefix TEXT NOT NULL,         -- First 10 chars for identification
  permissions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);
```

## Migration from No Auth

If you're upgrading from a version without authentication:

1. **Enable auth gradually**:
   ```bash
   # Phase 1: Log only (no blocking)
   API_AUTH_ENABLED=false

   # Phase 2: Optional auth
   API_AUTH_ENABLED=true
   # Set required: false in middleware

   # Phase 3: Required auth
   API_AUTH_ENABLED=true
   ```

2. **Create keys for all tenants**:
   ```sql
   -- Generate admin key for each tenant
   ```

3. **Update clients**:
   - Add API key to all requests
   - Handle 401/403 responses gracefully

4. **Enable full enforcement**:
   ```bash
   API_AUTH_ENABLED=true
   ```

## Security Checklist

Before deploying to production:

- [ ] Set `API_AUTH_ENABLED=true`
- [ ] Create unique API keys for each tenant
- [ ] Rotate default/admin keys
- [ ] Set up key rotation schedule
- [ ] Configure audit logging
- [ ] Set up monitoring for failed auth attempts
- [ ] Document key management procedures
- [ ] Test tenant isolation (try cross-tenant access)
- [ ] Review permission levels for all keys
- [ ] Set up key expiration policies

## Additional Resources

- [API Routes Documentation](../src/api/api-routes.ts)
- [Middleware Source](../src/middleware/apiKeyAuth.ts)
- [Tenant Isolation Source](../src/middleware/tenantIsolation.ts)
- [Database Migration: API Keys](../src/db/migrations/020_api_keys.sql)
