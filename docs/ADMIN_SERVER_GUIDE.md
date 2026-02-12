# Admin Server Guide

Complete guide to the Admin Server component in the Agent Memory System microservices architecture.

## Overview

The Admin Server is a dedicated microservice handling authentication, authorization, and user management. It is extracted from the monolithic API server as part of [SPEC-ARCH-001](../.moai/specs/SPEC-ARCH-001/spec.md).

**Port**: 3001
**Responsibilities**:
- User authentication (JWT tokens)
- OAuth provider integration
- API key management
- Session management
- User administration

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Server                           │
│                      (Port 3001)                        │
├─────────────────────────────────────────────────────────────┤
│
│  ┌──────────────────┐  ┌──────────────────┐
│  │  Auth Routes     │  │  User Routes     │
│  │                  │  │                  │
│  │ • Login          │  │ • Profile        │
│  │ • Register       │  │ • Preferences   │
│  │ • Token Refresh  │  │ • Roles         │
│  │ • Token Revoke   │  │ • Permissions   │
│  │                  │  │                  │
│  └──────────────────┘  └──────────────────┘
│
│  ┌──────────────────┐  ┌──────────────────┐
│  │  OAuth Routes    │  │  API Key Routes │
│  │                  │  │                  │
│  │ • Providers      │  │ • Generate       │
│  │ • Initiate       │  │ • List          │
│  │ • Callback       │  │ • Revoke        │
│  │ • Link           │  │ • Validate      │
│  │ • Unlink         │  │                  │
│  └──────────────────┘  └──────────────────┘
│
│  ┌──────────────────┐
│  │  Session Routes  │
│  │                  │
│  │ • List           │
│  │ • Stats          │
│  │ • Revoke         │
│  │                  │
│  └──────────────────┘
│
└──────────────┬─────────────────────────────────────────────┘
               │
               │ JWT Token
               ▼
┌─────────────────────────┐
│   PostgreSQL Database  │
│   (Shared)           │
│                      │
│ • users              │
│ • sessions           │
│ • api_keys          │
│ • oauth_connections │
└─────────────────────────┘
```

## Setup and Configuration

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis (for session storage, optional)

### Environment Variables

Create `.env` file for Admin Server:

```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/agent_memory

# JWT Secret (IMPORTANT: Generate secure random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OAuth Providers (Optional)
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret

# Session
SESSION_SECRET=your-session-secret
SESSION_TTL=3600

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Starting the Server

**Development** (with hot reload):
```bash
cd admin-server
npm run dev
```

**Production**:
```bash
cd admin-server
npm run build
npm start
```

**Docker**:
```bash
docker-compose up admin-server
```

## Authentication Endpoints

### User Registration

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "SecurePassword123!",
    "email": "user@example.com",
    "tenant_id": "acme-corp"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_expires_in": 604800,
  "user": {
    "user_id": "usr_abc123",
    "username": "user@example.com",
    "email": "user@example.com",
    "roles": ["user"],
    "tenant_id": "acme-corp",
    "created_at": "2026-02-10T10:00:00Z"
  }
}
```

### User Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_expires_in": 604800,
  "user": {
    "user_id": "usr_abc123",
    "username": "user@example.com",
    "email": "user@example.com",
    "roles": ["user"],
    "tenant_id": "acme-corp"
  }
}
```

### Token Refresh

```bash
curl -X POST http://localhost:3001/auth/token/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_expires_in": 604800
}
```

### Token Revoke (Logout)

```bash
curl -X POST http://localhost:3001/auth/token/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

Response:
```json
{
  "message": "Token revoked successfully"
}
```

## OAuth Integration

### Supported Providers

- Google (`google`)
- GitHub (`github`)
- Microsoft (`microsoft`) - Planned
- Okta (`okta`) - Planned

### OAuth Configuration

#### Google OAuth

1. Create OAuth 2.0 credentials in Google Cloud Console
2. Set redirect URI: `http://localhost:3001/auth/oauth/google/callback`
3. Add to environment:

```bash
OAUTH_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
OAUTH_GOOGLE_CLIENT_SECRET=your-client-secret
OAUTH_GOOGLE_REDIRECT_URI=http://localhost:3001/auth/oauth/google/callback
```

#### GitHub OAuth

1. Create OAuth App in GitHub Settings
2. Set Authorization callback URL: `http://localhost:3001/auth/oauth/github/callback`
3. Add to environment:

```bash
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret
OAUTH_GITHUB_REDIRECT_URI=http://localhost:3001/auth/oauth/github/callback
```

### OAuth Flow

#### 1. List Available Providers

```bash
curl -X GET http://localhost:3001/auth/oauth/providers
```

Response:
```json
{
  "providers": [
    {
      "provider_id": "google",
      "display_name": "Google",
      "auth_url": "http://localhost:3001/auth/oauth/google?redirect_uri=http://localhost:3000/callback"
    },
    {
      "provider_id": "github",
      "display_name": "GitHub",
      "auth_url": "http://localhost:3001/auth/oauth/github?redirect_uri=http://localhost:3000/callback"
    }
  ]
}
```

#### 2. Initiate OAuth Flow

```bash
curl -X GET "http://localhost:3001/auth/oauth/google?redirect_uri=http://localhost:3000/callback&tenant_id=acme-corp"
```

Redirects to Google OAuth consent page.

#### 3. OAuth Callback

After user approves, Google redirects to:

```
http://localhost:3001/auth/oauth/google/callback?code=AUTHORIZATION_CODE&state=STATE_VALUE
```

Server exchanges code for tokens and creates session.

#### 4. Link OAuth Account (Optional)

Link OAuth to existing account:

```bash
curl -X POST http://localhost:3001/auth/oauth/link \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "code": "AUTHORIZATION_CODE",
    "redirect_uri": "http://localhost:3000/callback"
  }'
```

Response:
```json
{
  "success": true,
  "provider": "google",
  "provider_user_id": "123456789",
  "email": "user@gmail.com"
}
```

#### 5. List OAuth Connections

```bash
curl -X GET http://localhost:3001/auth/oauth/connections \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Response:
```json
{
  "connections": [
    {
      "connection_id": "conn_google_123",
      "provider_id": "google",
      "provider_user_id": "123456789",
      "email": "user@gmail.com",
      "created_at": "2026-02-10T10:00:00Z"
    }
  ]
}
```

#### 6. Unlink OAuth Account

```bash
curl -X DELETE http://localhost:3001/auth/oauth/connections/conn_google_123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## API Key Management

### Generate API Key

```bash
curl -X POST http://localhost:3001/auth/api-keys \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scopes": ["read:events", "write:events", "read:chunks"]
  }'
```

Response:
```json
{
  "api_key": "amk_live_xxxxxxxxxxxxx",
  "tenant_id": "acme-corp",
  "scopes": ["read:events", "write:events", "read:chunks"],
  "created_at": "2026-02-10T10:00:00Z"
}
```

**IMPORTANT**: Save the API key immediately - it won't be shown again.

### Using API Keys

Use `X-API-Key` header instead of `Authorization`:

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "X-API-Key: amk_live_xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_123",
    "session_id": "sess_456",
    "role": "user",
    "content": "Hello!"
  }'
```

## Session Management

### List Active Sessions

```bash
curl -X GET http://localhost:3001/auth/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Response:
```json
{
  "sessions": [
    {
      "session_id": "sess_abc123",
      "created_at": "2026-02-10T09:00:00Z",
      "last_activity_at": "2026-02-10T14:30:00Z",
      "expires_at": "2026-02-17T09:00:00Z",
      "device_info": {
        "browser": "Chrome",
        "os": "macOS",
        "ip": "192.168.1.100"
      }
    }
  ],
  "count": 1
}
```

### Get Session Statistics

```bash
curl -X GET http://localhost:3001/auth/sessions/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Response:
```json
{
  "total_sessions": 15,
  "active_sessions": 3,
  "revoked_sessions": 12,
  "unique_devices": 5,
  "unique_locations": 3
}
```

### Revoke Specific Session

```bash
curl -X DELETE http://localhost:3001/auth/sessions/sess_abc123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Response:
```json
{
  "message": "Session revoked successfully"
}
```

### Revoke All Sessions

```bash
curl -X DELETE http://localhost:3001/auth/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "except_session_id": "sess_current"
  }'
```

Response:
```json
{
  "message": "Sessions revoked successfully",
  "revoked_count": 2
}
```

## Integration with Main API

### Using JWT Token with Main API

After authenticating with Admin Server, use JWT token with main API server:

```bash
# 1. Login with Admin Server
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "SecurePassword123!"
  }'

# 2. Use returned access_token with main API
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer ACCESS_TOKEN_FROM_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_123",
    "session_id": "sess_456",
    "role": "user",
    "content": "Hello!"
  }'
```

### Token Validation

Main API validates tokens with shared auth library:

```typescript
import { validateToken } from '@agent-memory/auth';

// In main API middleware
const user = await validateToken(request.headers.authorization);
// Returns: { user_id, tenant_id, roles, ... }
```

### User Context Propagation

Admin Server provides user context via JWT claims:

```json
{
  "user_id": "usr_abc123",
  "tenant_id": "acme-corp",
  "roles": ["user"],
  "session_id": "sess_xyz789",
  "exp": 1676092800
}
```

Main API extracts and enforces tenant isolation.

## Migration from Monolith

### Phase 1: Parallel Operation

1. Keep monolith authentication (`/auth` endpoints)
2. Deploy Admin Server on port 3001
3. Route auth traffic to Admin Server
4. Main API validates tokens from both sources

### Phase 2: Token Validation

1. Update main API to use `@agent-memory/auth` library
2. Configure shared JWT_SECRET
3. Test token validation with Admin Server tokens
4. Monitor for validation failures

### Phase 3: Deprecate Monolith Auth

1. Redirect monolith `/auth` to Admin Server
2. Update all clients to use Admin Server URLs
3. Deprecate monolith auth endpoints
4. Remove monolith auth code

### Migration Checklist

- [ ] Deploy Admin Server to production
- [ ] Configure shared JWT_SECRET
- [ ] Update environment variables
- [ ] Test authentication flow end-to-end
- [ ] Update API clients to use new URLs
- [ ] Monitor token validation success rate
- [ ] Remove monolith auth endpoints
- [ ] Update documentation

## Monitoring and Observability

### Health Check

```bash
curl -X GET http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-10T14:30:00Z",
  "authenticated": false
}
```

### Metrics

Admin Server exposes Prometheus metrics:

```bash
curl -X GET http://localhost:3001/metrics
```

Metrics include:
- `auth_login_total`: Total login attempts
- `auth_login_success_total`: Successful logins
- `auth_token_refresh_total`: Token refreshes
- `oauth_flow_initiated_total`: OAuth flows started
- `oauth_flow_completed_total`: OAuth flows completed

### Logging

Structured JSON logging:

```json
{
  "level": "info",
  "message": "User login successful",
  "user_id": "usr_abc123",
  "tenant_id": "acme-corp",
  "timestamp": "2026-02-10T14:30:00Z"
}
```

## Security Best Practices

### 1. JWT Secret Management

- Use minimum 32-character random string
- Store in environment variables (never in code)
- Rotate secrets regularly (every 90 days)
- Use different secrets for dev/prod

### 2. Password Security

- Enforce minimum 8 characters
- Require uppercase, lowercase, numbers, special chars
- Use bcrypt for hashing (cost factor ≥ 12)
- Implement rate limiting on login attempts

### 3. OAuth Security

- Validate state parameter (CSRF protection)
- Use HTTPS in production (required)
- Implement PKCE for public clients
- Limit OAuth scopes to minimum required

### 4. API Key Security

- Use secure random generation (≥ 256 bits)
- Include prefix (`amk_live_`, `amk_test_`)
- Hash keys before storing in database
- Allow user to view key only once after creation

### 5. Session Security

- Implement session timeout (default 1 hour)
- Track device information
- Detect and alert on suspicious activity
- Provide session revocation UI

## Troubleshooting

### Common Issues

**Issue**: Token validation fails on main API

**Solution**:
- Verify JWT_SECRET matches between Admin Server and main API
- Check token expiration (exp claim)
- Ensure Admin Server is accessible

**Issue**: OAuth callback fails

**Solution**:
- Verify redirect URI matches OAuth provider configuration
- Check OAuth client credentials
- Ensure callback URL is whitelisted in OAuth provider

**Issue**: API key not accepted

**Solution**:
- Verify `X-API-Key` header format
- Check API key is not expired or revoked
- Ensure API key has required scopes

## API Reference

See [API Documentation](README.md#authentication) for complete endpoint reference.

## Related Documentation

- [SPEC-ARCH-001](../.moai/specs/SPEC-ARCH-001/spec.md) - Admin Server extraction plan
- [Shared Auth Library](SHARED_AUTH_LIBRARY.md) - Authentication utilities
- [API Reference](README.md) - Complete API documentation
