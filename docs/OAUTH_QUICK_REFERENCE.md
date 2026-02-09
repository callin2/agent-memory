# OAuth2/SSO Quick Reference Guide

## Quick Start

### 1. Database Migration

The OAuth migration will automatically run when the server starts:

```bash
# Migration file: src/db/migrations/005_oauth.sql
# Creates: oauth_providers, oauth_connections tables
# Seeds: Google and GitHub OAuth providers
```

### 2. Environment Configuration

Add to `.env` file:

```bash
# OAuth2 Provider Credentials
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret

# Encryption Key (32+ characters)
ENCRYPTION_KEY=your-encryption-key-min-32-chars-long
```

### 3. Update Provider Secrets in Database

```sql
-- Update Google OAuth provider
UPDATE oauth_providers
SET
  client_id = 'YOUR_GOOGLE_CLIENT_ID',
  client_secret_encrypted = 'YOUR_GOOGLE_CLIENT_SECRET'
WHERE provider_id = 'google';

-- Update GitHub OAuth provider
UPDATE oauth_providers
SET
  client_id = 'YOUR_GITHUB_CLIENT_ID',
  client_secret_encrypted = 'YOUR_GITHUB_CLIENT_SECRET'
WHERE provider_id = 'github';
```

**Note**: The service will automatically encrypt the secrets when updating.

## API Endpoints

### List OAuth Providers

```bash
GET /auth/oauth/providers

# Response
{
  "providers": [
    { "provider_id": "google", "provider_name": "Google" },
    { "provider_id": "github", "provider_name": "GitHub" }
  ]
}
```

### Initiate OAuth Flow

```bash
GET /auth/oauth/:provider?redirect_uri=CALLBACK_URL&tenant_id=TENANT_ID

# Example
GET /auth/oauth/google?redirect_uri=http://localhost:3000/callback&tenant_id=default

# Response: Redirects to OAuth provider
```

### OAuth Callback (Automatic)

```bash
GET /auth/oauth/:provider/callback?code=CODE&state=STATE

# Response: Redirects to redirect_uri with JWT token
# Example: http://localhost:3000/callback?token=JWT&provider=google&created=true
```

### Link OAuth Account (Authenticated)

```bash
POST /auth/oauth/link
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "provider": "google",
  "code": "AUTHORIZATION_CODE",
  "redirect_uri": "http://localhost:3000/callback"
}

# Response
{
  "success": true,
  "provider": "google",
  "provider_user_id": "123456789",
  "email": "user@example.com"
}
```

### List OAuth Connections (Authenticated)

```bash
GET /auth/oauth/connections
Authorization: Bearer JWT_TOKEN

# Response
{
  "connections": [
    {
      "connection_id": "conn_1234567890",
      "user_id": "user_123",
      "provider_id": "google",
      "provider_user_id": "123456789",
      "connected_at": "2024-01-15T10:30:00Z",
      "last_used_at": "2024-01-16T14:22:00Z",
      "is_active": true
    }
  ]
}
```

### Unlink OAuth Account (Authenticated)

```bash
DELETE /auth/oauth/connections/:connectionId
Authorization: Bearer JWT_TOKEN

# Response
{
  "success": true
}
```

## OAuth Flow Diagram

```
User                    Your App              OAuth Provider              Google/GitHub API
 |                          |                        |                            |
 |-- 1. Click "Login with" -->|                        |                            |
 |                          |                        |                            |
 |                          |-- 2. GET /auth/oauth/:provider -->|                            |
 |                          |                        |                            |
 |                          |<-- 3. Redirect to auth page ----|                            |
 |                          |                        |                            |
 |<-- 4. User redirected --------|                        |                            |
 |                          |                        |                            |
 |-- 5. User authenticates ---------------------------------------------->|
 |                          |                        |                            |
 |                          |<---------------- 6. Redirect with code -----|
 |                          |                        |                            |
 |                          |-- 7. Callback with code ------------------>|
 |                          |                        |                            |
 |                          |<--------------- 8. Access token ------------|
 |                          |                        |                            |
 |                          |-- 9. Fetch user info ---------------------------------->|
 |                          |                        |                            |
 |                          |<-- 10. User data --------------------------------------|
 |                          |                        |                            |
 |                          |-- 11. Find/Create user ---->|                            |
 |                          |                        |                            |
 |                          |<-- 12. User created/found ---|                            |
 |                          |                        |                            |
 |                          |-- 13. Generate JWT -------->|                            |
 |                          |                        |                            |
 |<-- 14. Redirect with JWT -------|                        |                            |
```

## Provider Configuration

### Google OAuth

**Required Scopes:**
- `openid` - Authenticate user
- `profile` - Get user name and profile
- `email` - Get user email

**Setup Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project and enable Google+ API
3. Create OAuth 2.0 Client ID
4. Add redirect URI: `https://your-domain.com/auth/oauth/google/callback`
5. Copy Client ID and Secret

**User Info Mapped:**
```javascript
{
  provider_user_id: data.id,
  email: data.email,
  name: data.name,
  picture: data.picture,
  verified_email: data.verified_email
}
```

### GitHub OAuth

**Required Scopes:**
- `read:user` - Read user profile
- `user:email` - Read user email

**Setup Steps:**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Register OAuth App
3. Set callback URL: `https://your-domain.com/auth/oauth/github/callback`
4. Copy Client ID and generate Secret

**User Info Mapped:**
```javascript
{
  provider_user_id: String(data.id),
  email: data.email,
  name: data.name || data.login,
  picture: data.avatar_url,
  verified_email: true
}
```

## Security Features

### Token Encryption

OAuth tokens are encrypted using AES-256-CBC:

```typescript
// Encryption
encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decryption
decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### CSRF Protection (State Parameter)

```typescript
// Generate state
const state = randomBytes(16).toString('hex');
oauthStates.set(state, {
  providerId: provider,
  redirectUri: redirect_uri,
  tenantId: tenant_id,
  timestamp: Date.now(),
});

// Validate state (max 10 minutes)
const storedState = oauthStates.get(state);
if (!storedState || Date.now() - storedState.timestamp > 10 * 60 * 1000) {
  throw new Error('Invalid or expired state');
}
```

### Audit Logging

All OAuth events are logged:

```typescript
await auditService.logAuthEvent(
  user_id,
  'oauth_login',           // Event type
  'success',               // Outcome
  undefined,               // Request (optional)
  {
    tenant_id,
    provider,
    provider_user_id,
    email,
    created
  }
);
```

## Error Handling

### Common Errors

**redirect_uri_mismatch**
```
Error: Token exchange failed: {"error": "redirect_uri_mismatch"}
Solution: Ensure redirect URI matches OAuth provider settings exactly
```

**Invalid State**
```
Error: Invalid state
Solution: State may have expired (10-minute timeout)
```

**Provider Not Found**
```
Error: OAuth provider not found
Solution: Check provider is active in oauth_providers table
```

**Account Already Linked**
```
Error: Account already linked
Solution: User already has this OAuth provider linked
```

## Testing

### Manual Testing

1. **Test Google OAuth:**
   ```bash
   # 1. Visit authorization URL
   curl "http://localhost:3000/auth/oauth/google?redirect_uri=http://localhost:3000/callback"

   # 2. Complete authentication in browser

   # 3. Receive JWT token in redirect
   http://localhost:3000/callback?token=JWT&provider=google&created=true
   ```

2. **Test GitHub OAuth:**
   ```bash
   # 1. Visit authorization URL
   curl "http://localhost:3000/auth/oauth/github?redirect_uri=http://localhost:3000/callback"

   # 2. Complete authentication in browser

   # 3. Receive JWT token in redirect
   http://localhost:3000/callback?token=JWT&provider=github&created=true
   ```

### Integration Testing

```bash
# Run OAuth tests
npm test -- tests/unit/auth/oauth.test.ts
```

## Database Schema

### oauth_providers Table

```sql
CREATE TABLE oauth_providers (
  provider_id TEXT PRIMARY KEY,
  provider_name TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  authorization_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  user_info_url TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### oauth_connections Table

```sql
CREATE TABLE oauth_connections (
  connection_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES oauth_providers(provider_id),
  provider_user_id TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, provider_id)
);
```

## Production Checklist

Before deploying to production:

- [ ] HTTPS enabled with valid SSL certificate
- [ ] OAuth credentials configured in environment variables
- [ ] Encryption key set (32+ characters)
- [ ] OAuth provider callback URLs updated to production domain
- [ ] Database migrated with `005_oauth.sql`
- [ ] Provider secrets updated in database
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Monitoring configured for OAuth failures
- [ ] User privacy policy updated

## Troubleshooting

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run dev
```

### Check Provider Configuration

```sql
SELECT * FROM oauth_providers WHERE is_active = true;
```

### Check OAuth Connections

```sql
SELECT
  c.connection_id,
  c.user_id,
  c.provider_id,
  c.provider_user_id,
  c.connected_at,
  c.last_used_at
FROM oauth_connections c
WHERE c.is_active = true
ORDER BY c.connected_at DESC;
```

### View Audit Logs

```sql
SELECT
  log_id,
  user_id,
  event_type,
  action,
  outcome,
  details,
  created_at
FROM audit_logs
WHERE event_type LIKE 'oauth%'
ORDER BY created_at DESC
LIMIT 50;
```

## Additional Resources

- **Complete Setup Guide:** [OAUTH_SETUP.md](OAUTH_SETUP.md)
- **Implementation Summary:** [PHASE3_OAUTH_SUMMARY.md](PHASE3_OAUTH_SUMMARY.md)
- **Google OAuth Docs:** https://developers.google.com/identity/protocols/oauth2
- **GitHub OAuth Docs:** https://docs.github.com/en/developers/apps/building-oauth-apps

---

**Status:** ✅ Phase 3 Complete
**TypeScript Compilation:** ✅ Passing
**Database Migration:** ✅ Ready
**Documentation:** ✅ Complete
