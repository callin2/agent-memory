# @agent-memory/auth

Shared authentication library for Agent Memory System - JWT generation/validation, API key operations, and Express middleware.

## Features

- **JWT Operations**: Generate and verify JSON Web Tokens with configurable expiration
- **API Key Management**: Create and validate API keys for service-to-service authentication
- **Express Middleware**: Ready-to-use authentication middleware for Express applications
- **TypeScript Support**: Full TypeScript definitions included
- **Zero Dependencies**: Uses only peer dependencies (jsonwebtoken, express)

## Installation

```bash
npm install @agent-memory/auth jsonwebtoken
```

## Quick Start

### JWT Authentication

```typescript
import { generateToken, verifyToken } from '@agent-memory/auth';

// Generate a token
const token = generateToken('tenant123', 'user456', ['admin', 'user']);

// Verify a token
const payload = verifyToken(token);
if (payload) {
  console.log('User:', payload.user_id);
  console.log('Tenant:', payload.tenant_id);
  console.log('Roles:', payload.roles);
}
```

### API Key Authentication

```typescript
import { generateAPIKey, validateAPIKey } from '@agent-memory/auth';

// Generate an API key
const apiKey = generateAPIKey('tenant123', ['read', 'write']);

// Validate an API key
const keyData = validateAPIKey(apiKey);
if (keyData) {
  console.log('Tenant:', keyData.tenant_id);
  console.log('Scopes:', keyData.scopes);
}
```

### Express Middleware

```typescript
import express from 'express';
import { authenticate, authenticateAPIKey, requireRole } from '@agent-memory/auth/middleware';

const app = express();

// JWT authentication
app.get('/protected', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Role-based authorization
app.delete('/admin', requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});

// API key authentication
app.post('/webhook', authenticateAPIKey, (req, res) => {
  res.json({ message: 'API key authenticated' });
});

// Combined authentication (JWT or API key)
app.post('/api/endpoint', authenticateAny, (req, res) => {
  res.json({ message: 'Authenticated' });
});
```

## Configuration

Configure JWT settings via environment variables:

```bash
# Required: Secret key for signing tokens
JWT_SECRET=your-secret-key-here

# Optional: Token expiration (default: 15m)
JWT_EXPIRES_IN=15m

# Optional: JWT issuer (default: agent-memory-system)
JWT_ISSUER=agent-memory-system
```

## API Reference

### JWT Functions

- `generateToken(tenant_id, user_id, roles?, config?, jti?)` - Generate JWT token
- `verifyToken(token, config?)` - Verify JWT token
- `decodeToken(token)` - Decode JWT without verification
- `getAuthConfig()` - Get configuration from environment

### API Key Functions

- `generateAPIKey(tenant_id, scopes?)` - Generate API key
- `validateAPIKey(apiKey)` - Validate API key
- `revokeAPIKey(apiKey)` - Revoke API key
- `listAPIKeys(tenant_id)` - List all keys for tenant
- `hashAPIKey(apiKey)` - Hash API key for storage
- `extractAPIKeyPrefix(apiKey)` - Extract key prefix

### Middleware Functions

- `authenticate` - Require JWT authentication
- `optionalAuthenticate` - Optional JWT authentication
- `requireRole(...roles)` - Require specific roles
- `authenticateAPIKey` - Require API key authentication
- `authenticateAny` - Accept JWT or API key
- `extractToken` - Extract token from Authorization header

## License

MIT
