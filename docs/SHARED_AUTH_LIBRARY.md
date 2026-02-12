# Shared Auth Library Guide

Complete guide to using the `@agent-memory/auth` shared authentication library.

## Overview

`@agent-memory/auth` is a reusable authentication library extracted from the Admin Server monolith. It provides JWT token generation, API key validation, and authentication middleware for use across all Agent Memory System services.

**Installation**:
```bash
npm install @agent-memory/auth
```

**Purpose**:
- Centralized authentication logic
- Consistent token validation across services
- Shared authentication utilities
- Reduced code duplication

## Features

- **JWT Token Generation**: Create and sign JWT access tokens
- **Token Validation**: Verify and decode JWT tokens
- **API Key Management**: Generate and validate API keys
- **Password Hashing**: Secure password hashing with bcrypt
- **Middleware**: Express authentication middleware
- **OAuth Helpers**: OAuth flow utilities

## Installation

### NPM Package

```bash
npm install @agent-memory/auth
```

### Development Link

For local development:

```bash
cd packages/auth
npm link

cd admin-server
npm link @agent-memory/auth
```

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# API Key Configuration
API_KEY_PREFIX=amk_
API_KEY_HASH_ROUNDS=10

# Password Configuration
PASSWORD_HASH_ROUNDS=12

# Token Issuer
TOKEN_ISSUER=agent-memory-system
```

### Initialization

```typescript
import { AuthLibrary } from '@agent-memory/auth';

const auth = new AuthLibrary({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  apiKeyPrefix: process.env.API_KEY_PREFIX,
  tokenIssuer: process.env.TOKEN_ISSUER
});

export default auth;
```

## JWT Token Operations

### Generate Access Token

```typescript
import { generateAccessToken } from '@agent-memory/auth';

const token = generateAccessToken({
  user_id: 'usr_abc123',
  tenant_id: 'acme-corp',
  roles: ['user'],
  session_id: 'sess_xyz789'
});

console.log(token);
// Output: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Payload**:
```json
{
  "user_id": "usr_abc123",
  "tenant_id": "acme-corp",
  "roles": ["user"],
  "session_id": "sess_xyz789",
  "iat": 1676092800,
  "exp": 1676093700,
  "iss": "agent-memory-system"
}
```

### Generate Refresh Token

```typescript
import { generateRefreshToken } from '@agent-memory/auth';

const refreshToken = generateRefreshToken({
  user_id: 'usr_abc123',
  tenant_id: 'acme-corp'
});

console.log(refreshToken);
```

Refresh tokens have longer expiration (7 days default).

### Validate Token

```typescript
import { validateToken } from '@agent-memory/auth';

try {
  const decoded = await validateToken('eyJhbGciOiJIUzI1NiIs...');

  console.log('User ID:', decoded.user_id);
  console.log('Tenant ID:', decoded.tenant_id);
  console.log('Roles:', decoded.roles);
  console.log('Session ID:', decoded.session_id);
} catch (error) {
  console.error('Token validation failed:', error.message);
  // Token expired, invalid, or malformed
}
```

**Returns**:
```typescript
{
  user_id: string;
  tenant_id: string;
  roles: string[];
  session_id?: string;
  iat: number;
  exp: number;
  iss: string;
}
```

### Decode Token (Without Validation)

For debugging or inspection (does NOT verify signature):

```typescript
import { decodeToken } from '@agent-memory/auth';

const decoded = decodeToken('eyJhbGciOiJIUzI1NiIs...');
console.log(decoded);
// WARNING: Does not verify signature - do not use for auth decisions
```

## API Key Operations

### Generate API Key

```typescript
import { generateAPIKey } from '@agent-memory/auth';

const apiKey = generateAPIKey({
  tenant_id: 'acme-corp',
  scopes: ['read:events', 'write:events']
});

console.log(apiKey);
// Output: amk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**API Key Format**:
- Prefix: `amk_live_` (production) or `amk_test_` (development)
- Key: 64-character random string
- Total: ~80 characters

### Hash API Key

For secure storage in database:

```typescript
import { hashAPIKey } from '@agent-memory/auth';

const apiKey = 'amk_live_xxxxxxxxxxxxxxx';
const hashed = await hashAPIKey(apiKey);

console.log(hashed);
// Output: $2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// Store only hashed value in database
```

### Validate API Key

```typescript
import { validateAPIKey } from '@agent-memory/auth';

const apiKey = 'amk_live_xxxxxxxxxxxxxxx';
const keyInfo = await validateAPIKey(apiKey, database);

if (keyInfo) {
  console.log('Valid API Key');
  console.log('Tenant ID:', keyInfo.tenant_id);
  console.log('Scopes:', keyInfo.scopes);
} else {
  console.error('Invalid API Key');
}
```

**database parameter**: Must be a database connection object that implements:

```typescript
interface Database {
  query(text: string, params: any[]): Promise<{
    rows: Array<{
      tenant_id: string;
      scopes: string[];
      revoked: boolean;
      expires_at: Date | null;
    }>;
  }>;
}
```

### Extract API Key ID

Extract key ID from full API key for database lookup:

```typescript
import { extractAPIKeyId } from '@agent-memory/auth';

const apiKey = 'amk_live_xxxxxxxxxxxxxxx';
const keyId = extractAPIKeyId(apiKey);

console.log(keyId);
// Output: xxxxxxxxxxxxxx (64-character hash for database lookup)
```

## Password Operations

### Hash Password

```typescript
import { hashPassword } from '@agent-memory/auth';

const plainPassword = 'SecurePassword123!';
const hashed = await hashPassword(plainPassword);

console.log(hashed);
// Output: $2a$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Uses bcrypt with 12 rounds (configurable via `PASSWORD_HASH_ROUNDS`).

### Compare Password

```typescript
import { comparePassword } from '@agent-memory/auth';

const plainPassword = 'SecurePassword123!';
const hashedPassword = '$2a$12$xxxxx...';

const match = await comparePassword(plainPassword, hashedPassword);

if (match) {
  console.log('Password correct');
} else {
  console.log('Password incorrect');
}
```

## Express Middleware

### JWT Authentication Middleware

Protect routes with JWT authentication:

```typescript
import { jwtAuthMiddleware } from '@agent-memory/auth';
import express from 'express';

const app = express();

// Protect route
app.get('/api/protected',
  jwtAuthMiddleware,
  (req, res) => {
    // req.user is populated with decoded token
    res.json({
      user_id: req.user.user_id,
      tenant_id: req.user.tenant_id,
      roles: req.user.roles
    });
  }
);
```

**Request Extension**:
- `req.user`: Decoded JWT payload
- `req.session_id`: Session ID from token

### API Key Authentication Middleware

Protect routes with API key authentication:

```typescript
import { apiKeyAuthMiddleware } from '@agent-memory/auth';

const app = express();

// Protect route
app.post('/api/events',
  apiKeyAuthMiddleware,
  (req, res) => {
    // req.apiKey is populated with key info
    res.json({
      tenant_id: req.apiKey.tenant_id,
      scopes: req.apiKey.scopes
    });
  }
);
```

**Request Extension**:
- `req.apiKey`: API key information from database
- `req.tenant_id`: Tenant ID (set for both JWT and API key auth)

### Combined Authentication Middleware

Accept either JWT or API key:

```typescript
import { authMiddleware } from '@agent-memory/auth';

const app = express();

// Accept either JWT or API key
app.use(authMiddleware);

// All subsequent routes have req.user or req.apiKey
app.get('/api/data', (req, res) => {
  if (req.user) {
    // Authenticated via JWT
    res.json({ type: 'jwt', user_id: req.user.user_id });
  } else if (req.apiKey) {
    // Authenticated via API key
    res.json({ type: 'api_key', tenant_id: req.apiKey.tenant_id });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});
```

### Scope-Based Authorization Middleware

Require specific scopes for API key access:

```typescript
import { requireScopes } from '@agent-memory/auth';

const app = express();

// Require read:events and write:events scopes
app.post('/api/events',
  apiKeyAuthMiddleware,
  requireScopes(['read:events', 'write:events']),
  (req, res) => {
    // req.apiKey has required scopes
    res.json({ success: true });
  }
);
```

Returns 403 Forbidden if API key lacks required scopes.

## OAuth Helpers

### Generate State Parameter

Generate secure state parameter for OAuth flow:

```typescript
import { generateOAuthState } from '@agent-memory/auth';

const state = generateOAuthState({
  provider: 'google',
  redirect_uri: 'http://localhost:3000/callback',
  tenant_id: 'acme-corp'
});

console.log(state);
// Output: base64-encoded JSON string
```

### Verify OAuth State

Verify and decode OAuth state parameter:

```typescript
import { verifyOAuthState } from '@agent-memory/auth';

const state = 'eyJwcm92aWRlciI6Imdvb2dsZSIs...';

try {
  const decoded = verifyOAuthState(state);

  console.log('Provider:', decoded.provider);
  console.log('Redirect URI:', decoded.redirect_uri);
  console.log('Tenant ID:', decoded.tenant_id);
} catch (error) {
  console.error('Invalid state parameter');
}
```

Prevents CSRF attacks during OAuth flow.

### Exchange OAuth Code for Tokens

Exchange OAuth authorization code for user profile:

```typescript
import { exchangeOAuthCode } from '@agent-memory/auth';

const userProfile = await exchangeOAuthCode({
  provider: 'google',
  code: 'AUTHORIZATION_CODE_FROM_REDIRECT',
  redirect_uri: 'http://localhost:3000/callback',
  client_id: process.env.OAUTH_GOOGLE_CLIENT_ID,
  client_secret: process.env.OAUTH_GOOGLE_CLIENT_SECRET
});

console.log('Provider User ID:', userProfile.provider_user_id);
console.log('Email:', userProfile.email);
console.log('Name:', userProfile.name);
```

Returns standardized user profile across OAuth providers.

## Usage Examples

### In Admin Server

```typescript
// admin-server/src/routes/auth.ts
import { generateAccessToken, generateRefreshToken } from '@agent-memory/auth';
import { hashPassword, comparePassword } from '@agent-memory/auth';

// Registration
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;

  // Hash password
  const hashed = await hashPassword(password);

  // Store user in database
  await db.query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
    [username, hashed]
  );

  // Generate tokens
  const accessToken = generateAccessToken({
    user_id: user.user_id,
    tenant_id: user.tenant_id,
    roles: user.roles
  });

  const refreshToken = generateRefreshToken({
    user_id: user.user_id,
    tenant_id: user.tenant_id
  });

  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 900
  });
});

// Login
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // Get user from database
  const user = await getUserByUsername(username);

  // Compare password
  const match = await comparePassword(password, user.password_hash);

  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate tokens
  const accessToken = generateAccessToken({
    user_id: user.user_id,
    tenant_id: user.tenant_id,
    roles: user.roles
  });

  res.json({
    access_token: accessToken,
    refresh_token: generateRefreshToken({ ... }),
    token_type: 'Bearer'
  });
});
```

### In Main API Server

```typescript
// src/api/routes.ts
import { jwtAuthMiddleware, validateToken } from '@agent-memory/auth';

// Protect all /api routes
app.use('/api', jwtAuthMiddleware);

// Access user info
app.get('/api/users/me', (req, res) => {
  res.json({
    user_id: req.user.user_id,
    tenant_id: req.user.tenant_id,
    roles: req.user.roles
  });
});

// Manual token validation
app.post('/api/validate', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = await validateToken(token);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.json({ valid: false });
  }
});
```

### In MCP Server

```typescript
// src/mcp/server.ts
import { apiKeyAuthMiddleware, validateAPIKey } from '@agent-memory/auth';

// MCP servers use API keys
app.use(apiKeyAuthMiddleware);

// All MCP tools require authentication
app.post('/mcp/tools/*', (req, res) => {
  if (!req.apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check scopes
  if (!req.apiKey.scopes.includes('mcp:tools')) {
    return res.status(403).json({ error: 'Insufficient scopes' });
  }

  // Process MCP tool request
  res.json({ result: '...' });
});
```

## Best Practices

### 1. Token Management

- Always set expiration on tokens (access: 15min, refresh: 7days)
- Include `tenant_id` in token payload for isolation
- Implement token rotation on refresh
- Revoke tokens on logout

### 2. API Key Security

- Hash API keys before database storage
- Use secure random generation (≥ 256 bits)
- Include key prefix for identification (`amk_live_`, `amk_test_`)
- Show API key only once after generation

### 3. Password Security

- Use bcrypt with cost factor ≥ 12
- Never store plain text passwords
- Implement rate limiting on login attempts
- Require strong password policies

### 4. Middleware Order

Apply middleware in correct order:

```typescript
app.use(express.json());                    // 1. Parse JSON
app.use(authMiddleware);                     // 2. Authenticate
app.use(tenantIsolationMiddleware);          // 3. Enforce tenant
app.use(rateLimitMiddleware);                 // 4. Rate limit
app.router;                                  // 5. Routes
```

### 5. Error Handling

Handle authentication errors consistently:

```typescript
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (err.name === 'ForbiddenError') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next(err);
});
```

### 6. Testing

Mock auth library in tests:

```typescript
// Mock JWT validation
jest.mock('@agent-memory/auth', () => ({
  validateToken: jest.fn().mockResolvedValue({
    user_id: 'test-user',
    tenant_id: 'test-tenant',
    roles: ['user']
  })
}));
```

## API Reference

See [TypeDoc documentation](https://docs.example.com/auth) for complete API reference.

## Related Documentation

- [Admin Server Guide](ADMIN_SERVER_GUIDE.md) - Admin Server usage
- [API Reference](README.md) - Complete API documentation
- [SPEC-ARCH-001](../.moai/specs/SPEC-ARCH-001/spec.md) - Microservices architecture
