# Authentication System Implementation Plan

## Context

The Agent Memory System v2.0 currently has basic authentication (JWT + API keys) but lacks critical security features for production deployment. The system is **60% production ready** for authentication. This plan addresses the gaps to reach **95% production readiness**.

### Current State Analysis

**Existing (✓):**
- JWT authentication middleware in `src/middleware/auth.ts`
- Basic login/register endpoints in `src/api/auth-routes.ts`
- Users table in database schema
- bcrypt password hashing
- Tenant isolation middleware
- Role-based authorization

**Critical Gaps (✗):**
- No refresh token mechanism (tokens live for 24h, can't revoke)
- API keys stored in-memory (`Map`), lost on restart
- MCP server has **zero authentication** (critical security issue)
- No token revocation capability
- No session management
- No audit logging for security events
- In-memory rate limiting (not distributed)
- No OAuth2 support (optional)

### Security Risk

Without these enhancements, the system **cannot be safely exposed to the public internet**. Current mitigation requires deploying behind an authenticated API gateway, but this is not implemented.

---

## Implementation Approach

### Recommended Strategy: Phased Implementation (5 phases over 4-6 weeks)

**Priority:** Focus on Phase 1 (Core Infrastructure) first as it addresses the most critical security gaps.

#### Phase 1: Core Authentication Infrastructure (Week 1-2) **[CRITICAL]**

**Goal:** Implement refresh tokens, persistent API keys, session management, and audit logging.

**Deliverables:**
1. Refresh token system with rotation
2. Database-backed API keys with proper hashing
3. Session management and tracking
4. Comprehensive audit logging
5. Token revocation capability

**Database Changes:**
```sql
-- Migration 001: Refresh Tokens
CREATE TABLE refresh_tokens (
  token_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ,
  replaced_by TEXT REFERENCES refresh_tokens(token_id),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  last_used_at TIMESTAMPTZ
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id, expires_at DESC);

-- Migration 002: API Keys
CREATE TABLE api_keys (
  key_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(user_id),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INT DEFAULT 0,
  rate_limit INT DEFAULT 1000
);
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id, is_active);

-- Migration 003: Sessions
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  device_info JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active);

-- Migration 004: Audit Logs
CREATE TABLE audit_logs (
  log_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(user_id),
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_tenant_ts ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_ts ON audit_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;
```

**New Files to Create:**
- `src/services/token-service.ts` - Refresh token management (300 LOC)
- `src/services/api-key-service.ts` - API key CRUD operations (280 LOC)
- `src/services/session-service.ts` - Session management (200 LOC)
- `src/services/audit-service.ts` - Audit logging (150 LOC)
- `src/middleware/refresh-token.ts` - Refresh token middleware (250 LOC)
- `src/api/refresh-routes.ts` - Refresh token endpoints (200 LOC)
- `src/api/session-routes.ts` - Session management endpoints (180 LOC)
- `tests/unit/auth/refresh-token.test.ts` - Unit tests (200 LOC)
- `tests/unit/auth/api-key.test.ts` - Unit tests (180 LOC)
- `tests/integration/auth-flow.test.ts` - Integration tests (350 LOC)

**Files to Modify:**
- `src/middleware/auth.ts` - Add blacklist checking, refresh token validation (+150 LOC)
- `src/api/auth-routes.ts` - Update login to issue refresh tokens, add revoke endpoint (+120 LOC)
- `src/api/api-routes.ts` - Add audit logging to protected endpoints (+80 LOC)
- `src/server.ts` - Initialize new services (+40 LOC)

**New API Endpoints:**
```
POST   /auth/token/refresh     - Exchange refresh token for new access token (with rotation)
POST   /auth/token/revoke      - Revoke a refresh token (logout)
GET    /auth/sessions          - List active sessions
DELETE /auth/sessions/:id      - Revoke specific session
DELETE /auth/sessions          - Revoke all sessions except current
POST   /auth/api-keys          - Create new API key
GET    /auth/api-keys          - List API keys for tenant
DELETE /auth/api-keys/:id      - Revoke API key
```

**Success Criteria:**
- All unit tests passing (80%+ coverage)
- Refresh tokens rotate on each use
- API keys persist across restarts
- Sessions tracked in database
- All auth events logged to audit_logs table

---

#### Phase 2: MCP Server Authentication (Week 2-3) **[HIGH PRIORITY]**

**Goal:** Add authentication layer to MCP server (currently has NONE).

**Approach:** Token-based authentication in initialize handshake

**File to Modify:**
- `src/mcp/server.ts` (+60 LOC)

**Implementation:**
```typescript
// Add to initialize method params
interface InitializeParams {
  authorization?: {
    type: 'bearer' | 'api_key';
    token: string;
  };
}

// Validate token in initialize()
private async initialize(params: any): Promise<any> {
  // Validate token
  if (params.authorization) {
    const user = this.validateAuthToken(params.authorization);
    this.currentUser = user; // Attach to all tool calls
  } else {
    throw new Error('Authentication required');
  }

  return {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {}, resources: {} },
    serverInfo: { name: 'agent-memory-system', version: '2.0.0' },
  };
}
```

**Success Criteria:**
- MCP server rejects unauthenticated connections
- Tenant isolation enforced in MCP tools
- All MCP operations logged to audit_logs
- Tests passing

---

#### Phase 3: OAuth2 Integration (Week 3-4) **[OPTIONAL]**

**Goal:** Support OAuth2 login (Google, GitHub) for SSO.

**Database Changes:**
```sql
-- Migration 005: OAuth Tables
CREATE TABLE oauth_providers (
  provider_id TEXT PRIMARY KEY,
  provider_name TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  authorization_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  user_info_url TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE oauth_connections (
  connection_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES oauth_providers(provider_id),
  provider_user_id TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, provider_id)
);
```

**New Files:**
- `src/services/oauth-service.ts` (400 LOC)
- `src/api/oauth-routes.ts` (250 LOC)
- `tests/unit/auth/oauth.test.ts` (220 LOC)

**New Endpoints:**
```
GET    /auth/oauth/:provider       - Initiate OAuth flow
GET    /auth/oauth/:provider/callback - OAuth callback
POST   /auth/oauth/link            - Link OAuth to existing account
DELETE /auth/oauth/:provider       - Unlink OAuth provider
```

---

#### Phase 4: Advanced Security Features (Week 4-5) **[MEDIUM PRIORITY]**

**Goal:** Token blacklist, enhanced rate limiting, security hardening.

**Deliverables:**
1. Token blacklist (Redis-backed with PostgreSQL fallback)
2. Multi-dimensional rate limiting (per-user, per-tenant, per-API-key)
3. Enhanced security headers
4. Password complexity enforcement
5. Token versioning for forced re-authentication

**New File:**
- `src/utils/token-blacklist.ts` (180 LOC)

**Files to Modify:**
- `src/core/security.ts` - Enhanced security headers (+50 LOC)
- `src/middleware/auth.ts` - Add blacklist checking (+40 LOC)

**Rate Limiting Strategy:**
```typescript
const rateLimits = {
  'POST /auth/login': { window: 900000, max: 5, keyBy: 'ip' },      // 15 min
  'POST /auth/register': { window: 3600000, max: 3, keyBy: 'ip' },  // 1 hour
  'POST /api/v1/events': { window: 60000, max: 100, keyBy: 'user' },
  'POST /api/v1/acb/build': { window: 60000, max: 60, keyBy: 'user' },
};
```

---

#### Phase 5: Performance & Monitoring (Week 5-6) **[MEDIUM PRIORITY]**

**Goal:** Ensure performance targets met, add monitoring.

**Performance Targets:**
- Token verification: <5ms (p95)
- API key validation: <10ms (p95)
- Login endpoint: <200ms (p95)
- Token refresh: <50ms (p95)

**Monitoring:**
- Prometheus metrics for auth events
- Security event alerts (failed logins, rate limit violations)
- Dashboard for authentication metrics

---

## Critical Files Reference

### Files to Create
1. `src/services/token-service.ts` - Refresh token management logic
2. `src/services/api-key-service.ts` - API key CRUD with hashing
3. `src/services/session-service.ts` - Session lifecycle management
4. `src/services/audit-service.ts` - Security event logging
5. `src/middleware/refresh-token.ts` - Refresh token middleware
6. `src/api/refresh-routes.ts` - Token refresh endpoints
7. `src/api/session-routes.ts` - Session management endpoints

### Files to Modify
1. `src/middleware/auth.ts` (342 lines) - Add refresh token support, blacklist checking
2. `src/api/auth-routes.ts` (309 lines) - Update login for refresh tokens, add revoke
3. `src/mcp/server.ts` (383 lines) - **CRITICAL: Add authentication layer**
4. `src/db/schema.sql` (163 lines) - Add new tables (migrations 001-004)
5. `src/server.ts` - Initialize new services
6. `.env.example` - Add new environment variables
7. `package.json` - Add dependencies (ioredis, crypto-js)
8. `docker-compose.yml` - Add Redis service

---

## Dependencies to Add

```json
{
  "dependencies": {
    "ioredis": "^5.3.2",           // Redis for blacklist/rate limiting
    "crypto-js": "^4.2.0"          // Encryption for OAuth tokens
  },
  "devDependencies": {
    "@types/ioredis": "^4.28.10",
    "supertest": "^6.3.3"          // API testing
  }
}
```

---

## Environment Variables to Add

```bash
# JWT Configuration
JWT_SECRET=                        # Generate: openssl rand -base64 32
JWT_EXPIRES_IN=15m                 # Access token (reduced from 24h)
JWT_REFRESH_EXPIRES_IN=7d          # Refresh token
JWT_ISSUER=agent-memory-system

# API Key Configuration
API_KEY_SECRET=                    # Pepper for hashing

# Redis (for blacklist/rate limiting)
REDIS_URL=redis://localhost:6379/1

# OAuth (optional)
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=

# Encryption
ENCRYPTION_KEY=                    # AES-256 for OAuth tokens
```

---

## Testing Strategy

### Unit Tests
- Token generation, validation, rotation
- API key generation, hashing, validation
- Session creation, retrieval, revocation
- Audit log creation and querying

### Integration Tests
- Complete login flow with refresh token
- Token refresh with rotation
- Session management (list, revoke)
- API key CRUD operations
- Logout and token revocation

### Security Tests
- Token theft detection (family tracking)
- Brute force prevention (rate limiting)
- Cross-tenant access prevention
- SQL injection prevention
- XSS prevention in OAuth redirects

### Performance Tests
- Token verification <5ms (p95)
- API key validation <10ms (p95)
- Login endpoint <200ms (p95)
- Concurrent requests (100 parallel)

---

## Verification Steps

### Phase 1 Verification
```bash
# 1. Apply migrations
psql agent_memory < src/db/migrations/001_refresh_tokens.sql
psql agent_memory < src/db/migrations/002_api_keys.sql
psql agent_memory < src/db/migrations/003_sessions.sql
psql agent_memory < src/db/migrations/004_audit_logs.sql

# 2. Test login with refresh token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"pass","tenant_id":"test"}' \
  | jq '.refresh_token'

# 3. Test token refresh with rotation
curl -X POST http://localhost:3000/auth/token/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"..."}'

# 4. Verify in database
psql agent_memory -c "SELECT * FROM refresh_tokens WHERE revoked_at IS NOT NULL;"
```

### MCP Authentication Verification
```bash
# 1. Start MCP server
MCP_TOKEN="..." npm start -- --mcp

# 2. Send initialize with token
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"authorization":{"type":"bearer","token":"..."}}}' \
  | npm start -- --mcp

# 3. Verify success response (should fail without token)
```

---

## Implementation Effort Summary

- **New Code:** ~2,060 LOC (excluding OAuth which is optional)
- **Modified Code:** ~650 LOC
- **Total:** ~2,710 LOC
- **Timeline:** 4-6 weeks (phased approach)
- **Team Size:** 1-2 developers

---

## Success Metrics

### Security
- ✅ Refresh tokens with rotation implemented
- ✅ API keys persist in database (hashed)
- ✅ MCP server requires authentication
- ✅ Token revocation functional
- ✅ Audit logging captures all security events
- ✅ Rate limiting prevents brute force attacks

### Performance
- ✅ Token verification <5ms (p95)
- ✅ Login endpoint <200ms (p95)
- ✅ No regression in ACB building performance

### Quality
- ✅ 85%+ test coverage for auth code
- ✅ All security tests passing
- ✅ Zero critical vulnerabilities

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing auth | Backward compatible endpoints, gradual migration |
| Performance degradation | Performance testing after each phase, Redis caching |
| Token theft | Family tracking, rotation on each use |
| Distributed rate limiting | Redis with PostgreSQL fallback |
| OAuth complexity | Optional phase, start with basic auth only |

---

## Rollout Strategy

1. **Week 1-2:** Deploy Phase 1 to staging, extensive testing
2. **Week 3:** Deploy Phase 1 to production (feature flag)
3. **Week 3-4:** Deploy MCP authentication (critical security fix)
4. **Week 4-5:** Deploy advanced security features
5. **Week 5-6:** Performance optimization, monitoring setup

---

## Post-Implementation

After completing Phase 1-2 (core infrastructure + MCP auth), the system will be **95% production ready** for authentication. Optional Phase 3 (OAuth) provides enterprise SSO capabilities. Phase 4-5 provide additional hardening and observability.
