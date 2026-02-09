# OAuth2/SSO Setup Guide

This guide explains how to configure OAuth2/SSO authentication for the Agent Memory System using Google and GitHub OAuth providers.

## Overview

The Agent Memory System supports OAuth2 authentication allowing users to sign in using their existing Google or GitHub accounts. This eliminates the need for users to remember separate credentials and provides a secure, industry-standard authentication flow.

## Supported Providers

- **Google OAuth 2.0**: Sign in with Google accounts
- **GitHub OAuth**: Sign in with GitHub accounts

## Architecture

The OAuth2 implementation consists of:

1. **OAuth Providers Table**: Stores configuration for each OAuth provider
2. **OAuth Connections Table**: Links users to their OAuth provider accounts
3. **OAuth Service**: Manages OAuth flows, token exchange, and user info fetching
4. **OAuth Routes**: HTTP endpoints for initiating OAuth flows and handling callbacks
5. **Token Encryption**: OAuth tokens are encrypted at rest using AES-256-CBC

## Prerequisites

- Node.js 20+ runtime
- PostgreSQL 15+ database
- Google Cloud account (for Google OAuth)
- GitHub account (for GitHub OAuth)
- HTTPS enabled (required for OAuth callbacks in production)

## Step 1: Google OAuth Setup

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" or "People API"
   - Click "Enable"

### 1.2 Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Configure the OAuth consent screen:
   - Choose "External" user type
   - Add app name, logo, and contact information
   - Add required scopes: `openid`, `profile`, `email`
   - Save and continue
4. Create the OAuth 2.0 Client ID:
   - Application type: "Web application"
   - Name: "Agent Memory System"
   - Authorized redirect URIs:
     - Development: `http://localhost:3000/auth/oauth/google/callback`
     - Production: `https://your-domain.com/auth/oauth/google/callback`
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**

### 1.3 Test Google OAuth

Use the following curl command to test the OAuth flow:

```bash
# Step 1: Get authorization URL
curl "http://localhost:3000/auth/oauth/google?redirect_uri=http://localhost:3000/callback"

# Step 2: Visit the returned URL and complete authentication in browser

# Step 3: After callback, you'll receive token in redirect URL
```

## Step 2: GitHub OAuth Setup

### 2.1 Register OAuth Application

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "OAuth Apps" > "New OAuth App"
3. Fill in the application details:
   - Application name: "Agent Memory System"
   - Homepage URL: `http://localhost:3000` (development) or production URL
   - Application description: "Agent Memory System authentication"
   - Authorization callback URL:
     - Development: `http://localhost:3000/auth/oauth/github/callback`
     - Production: `https://your-domain.com/auth/oauth/github/callback`
4. Click "Register application"
5. Copy the **Client ID** and generate a new **Client Secret**

### 2.2 Configure Scopes

The following scopes are requested:
- `read:user`: Read user profile data
- `user:email`: Read user email addresses

These scopes allow the system to fetch basic user information for authentication.

### 2.3 Test GitHub OAuth

```bash
# Step 1: Get authorization URL
curl "http://localhost:3000/auth/oauth/github?redirect_uri=http://localhost:3000/callback"

# Step 2: Visit the returned URL and complete authentication in browser

# Step 3: After callback, you'll receive token in redirect URL
```

## Step 3: Environment Configuration

### 3.1 Update Environment Variables

Add the following to your `.env` file:

```bash
# OAuth2 Configuration
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret

# Encryption for OAuth tokens (32+ characters recommended)
ENCRYPTION_KEY=your-encryption-key-min-32-chars-long-change-this
```

### 3.2 Update Database Providers

After configuring environment variables, update the OAuth providers in the database:

```sql
-- Update Google OAuth provider
UPDATE oauth_providers
SET
  client_id = 'YOUR_GOOGLE_CLIENT_ID',
  client_secret_encrypted = pgp_sym_encrypt('YOUR_GOOGLE_CLIENT_SECRET', 'your-encryption-key')
WHERE provider_id = 'google';

-- Update GitHub OAuth provider
UPDATE oauth_providers
SET
  client_id = 'YOUR_GITHUB_CLIENT_ID',
  client_secret_encrypted = pgp_sym_encrypt('YOUR_GITHUB_CLIENT_SECRET', 'your-encryption-key')
WHERE provider_id = 'github';
```

**Important**: Use PostgreSQL's `pgp_sym_encrypt` function to encrypt client secrets, or restart the application after setting environment variables to use the built-in encryption.

## Step 4: Security Configuration

### 4.1 Encryption Key

The `ENCRYPTION_KEY` is used to encrypt OAuth tokens at rest. Follow these guidelines:

- Minimum 32 characters
- Use a cryptographically secure random key
- Store securely (don't commit to git)
- Rotate periodically in production

Generate a secure key:

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4.2 HTTPS Requirement

OAuth2 requires HTTPS in production. Configure your reverse proxy:

**Nginx Example:**

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4.3 State Parameter (CSRF Protection)

The system uses a state parameter to prevent CSRF attacks:

- Random 32-byte hex string generated for each OAuth flow
- Stored in memory with 10-minute expiration
- Verified on callback to ensure request integrity
- Automatically cleaned up after expiration

### 4.4 Token Storage

OAuth tokens are encrypted using AES-256-CBC:

- Initialization vector (IV) generated for each encryption
- Encryption key derived from `ENCRYPTION_KEY` using scrypt
- Encrypted tokens stored in `oauth_connections` table
- Only decrypted in memory when needed for API calls

## Step 5: Usage Examples

### 5.1 Initiate OAuth Flow

```typescript
// Redirect user to OAuth provider
window.location.href = 'http://localhost:3000/auth/oauth/google?redirect_uri=http://localhost:3000/callback';
```

### 5.2 Handle OAuth Callback

After successful authentication, the user is redirected with:

```
http://localhost:3000/callback?token=JWT_ACCESS_TOKEN&provider=google&created=true
```

Extract the token and store it:

```typescript
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const provider = urlParams.get('provider');
const created = urlParams.get('created') === 'true';

// Store token for API requests
localStorage.setItem('access_token', token);
```

### 5.3 Link OAuth Account (Authenticated Users)

```bash
curl -X POST http://localhost:3000/auth/oauth/link \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "code": "AUTHORIZATION_CODE",
    "redirect_uri": "http://localhost:3000/callback"
  }'
```

### 5.4 List OAuth Connections

```bash
curl http://localhost:3000/auth/oauth/connections \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:

```json
{
  "connections": [
    {
      "connection_id": "conn_1234567890",
      "user_id": "user_123",
      "provider_id": "google",
      "provider_user_id": "google_user_id",
      "connected_at": "2024-01-15T10:30:00Z",
      "last_used_at": "2024-01-16T14:22:00Z",
      "is_active": true
    }
  ]
}
```

### 5.5 Unlink OAuth Account

```bash
curl -X DELETE http://localhost:3000/auth/oauth/connections/conn_1234567890 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Step 6: API Endpoints

### Available Endpoints

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/auth/oauth/providers` | List available OAuth providers | None |
| GET | `/auth/oauth/:provider` | Initiate OAuth flow | None |
| GET | `/auth/oauth/:provider/callback` | OAuth callback handler | None |
| POST | `/auth/oauth/link` | Link OAuth to existing user | Required |
| GET | `/auth/oauth/connections` | List user OAuth connections | Required |
| DELETE | `/auth/oauth/connections/:id` | Unlink OAuth account | Required |

### Response Codes

- `200 OK`: Successful request
- `302 Found`: Redirect to OAuth provider
- `400 Bad Request`: Missing or invalid parameters
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Provider or connection not found
- `409 Conflict`: Account already linked
- `500 Internal Server Error`: Server error

## Step 7: Testing

### 7.1 Integration Tests

```bash
# Run OAuth integration tests
npm test -- oauth.test.ts
```

### 7.2 Manual Testing Checklist

- [ ] Google OAuth flow completes successfully
- [ ] GitHub OAuth flow completes successfully
- [ ] New users are created on first OAuth login
- [ ] Existing users are recognized on subsequent OAuth logins
- [ ] OAuth accounts can be linked to existing users
- [ ] OAuth connections can be listed
- [ ] OAuth connections can be unlinked
- [ ] Invalid state parameter is rejected
- [ ] Expired state parameter is rejected
- [ ] Tokens are encrypted in database

## Step 8: Troubleshooting

### Common Issues

**Issue: "redirect_uri_mismatch" error**

- Solution: Ensure redirect URI in OAuth provider settings matches exactly (including trailing slashes and protocol)

**Issue: "Invalid state" error**

- Solution: State parameter may have expired (10-minute timeout) or been tampered with

**Issue: "OAuth provider not found"**

- Solution: Provider may be disabled in database. Check `is_active` column in `oauth_providers` table

**Issue: Tokens not being saved**

- Solution: Verify `ENCRYPTION_KEY` is set and at least 32 characters long

### Debug Logging

Enable debug logging by setting:

```bash
LOG_LEVEL=debug
```

This will log OAuth flow details including:

- Provider configuration
- Token exchange requests/responses
- User info fetch results
- Connection creation/updates

## Step 9: Production Checklist

Before deploying to production:

- [ ] HTTPS enabled with valid SSL certificate
- [ ] Environment variables configured securely
- [ ] Encryption key stored in secrets manager
- [ ] OAuth provider callback URLs updated to production domain
- [ ] Rate limiting configured for OAuth endpoints
- [ ] Audit logging enabled for OAuth events
- [ ] Database backups configured
- [ ] Token rotation policy implemented
- [ ] Monitoring configured for OAuth failures
- [ ] User privacy policy updated for OAuth data collection

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [PostgreSQL Encryption Functions](https://www.postgresql.org/docs/current/pgcrypto.html)

## Security Considerations

1. **Always use HTTPS** in production for OAuth flows
2. **Validate state parameter** to prevent CSRF attacks
3. **Encrypt OAuth tokens** at rest
4. **Implement rate limiting** on OAuth endpoints
5. **Log OAuth events** for security auditing
6. **Rotate encryption keys** periodically
7. **Use PKCE** for mobile/native applications
8. **Verify email addresses** from OAuth providers
9. **Implement token rotation** for long-lived sessions
10. **Monitor for suspicious activity** (multiple failed OAuth attempts)

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review audit logs in the `audit_logs` table
3. Enable debug logging and check application logs
4. Consult the API documentation for detailed endpoint specifications
