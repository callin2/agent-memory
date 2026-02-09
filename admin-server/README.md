# Admin Server

Admin Server for Agent Memory System - User management, authentication, OAuth configuration, and system monitoring.

## Overview

This is the Admin Server component of the Agent Memory System microservices architecture. It handles user authentication, session management, OAuth provider configuration, and administrative functions.

**Port**: 3001 (configurable via `ADMIN_PORT` environment variable)
**Status**: 🟡 Work in Progress (Phase 1 - 60% Complete)
**SPEC**: [SPEC-ARCH-001](../.moai/specs/SPEC-ARCH-001/spec.md)

## Implementation Status

### ✅ Completed (TASK-001)
- [x] Express.js server on port 3001
- [x] Health check endpoint (`GET /health`)
- [x] Server information endpoint (`GET /`)
- [x] PostgreSQL connection pooling
- [x] Error handling middleware
- [x] Request logging middleware
- [x] Graceful shutdown handling
- [x] TypeScript configuration
- [x] Vitest testing framework

### 🟡 In Progress (TASK-003)
- [ ] User registration endpoint (`POST /auth/register`)
- [ ] User login endpoint (`POST /auth/login`)
- [ ] Token refresh endpoint (`POST /auth/token/refresh`)
- [ ] Token revocation endpoint (`POST /auth/token/revoke`)
- [ ] Session management endpoints
- [ ] Password hashing with bcrypt

### ❌ Planned (Future Tasks)
- [ ] OAuth provider configuration (TASK-004)
- [ ] API key management (TASK-005)
- [ ] User administration (TASK-006)
- [ ] Tenant management
- [ ] Audit log viewing
- [ ] System metrics dashboard

## Features

**Currently Implemented:**
- **Health Check Endpoint**: `GET /health` - Server health monitoring
- **Root Endpoint**: `GET /` - Server information and available endpoints
- **PostgreSQL Connection Pool**: Optimized database connection management
- **Error Handling**: Centralized error handling with development/production modes
- **Request Logging**: Automatic logging of all incoming requests
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT signals

**Planned:**
- User authentication and registration
- JWT token issuance and refresh
- OAuth provider management
- API key generation and validation
- Session management
- User and tenant administration
- Audit log viewing
- System metrics dashboard

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
# Server Configuration
ADMIN_PORT=3001
NODE_ENV=development

# PostgreSQL Configuration
PGHOST=localhost
PGPORT=5432
PGDATABASE=agent_memory
PGUSER=postgres
PGPASSWORD=your_password_here

# JWT Configuration
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Development

```bash
# Run with hot reload
npm run dev

# Run from build
npm start

# Type checking
npm run typecheck
```

## Testing

```bash
# Run all tests
npm test

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "admin-server",
  "version": "1.0.0",
  "timestamp": "2026-02-09T15:06:42.926Z"
}
```

### Server Information

```bash
GET /
```

Response:
```json
{
  "name": "Admin Server",
  "version": "1.0.0",
  "status": "running",
  "port": 3001,
  "environment": "development",
  "endpoints": {
    "root": "GET /",
    "health": "GET /health"
  }
}
```

## Project Structure

```
admin-server/
├── src/
│   ├── config/
│   │   └── database.ts          # PostgreSQL pool configuration
│   ├── middleware/
│   │   ├── error-handler.ts     # Error handling middleware
│   │   ├── request-logger.ts    # Request logging middleware
│   │   └── index.ts             # Middleware exports
│   ├── routes/
│   │   ├── health-routes.ts     # Health check endpoints
│   │   └── index.ts             # Route exports
│   └── index.ts                 # Main server entry point
├── tests/
│   └── integration/
│       └── health.test.ts       # Health endpoint tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .env.example
```

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js (TypeScript)
- **Database**: PostgreSQL with connection pooling
- **Build Tool**: TypeScript compiler (tsc)
- **Testing**: Vitest + Supertest
- **Dev Tool**: tsx (hot reload)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `PGHOST` | PostgreSQL host | `localhost` |
| `PGPORT` | PostgreSQL port | `5432` |
| `PGDATABASE` | Database name | `agent_memory` |
| `PGUSER` | Database user | `postgres` |
| `PGPASSWORD` | Database password | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | Access token expiry | `15m` |

## Scripts Reference

- `npm run build` - Compile TypeScript to `dist/`
- `npm run dev` - Run with hot reload (tsx watch)
- `npm start` - Run compiled server from `dist/`
- `npm test` - Run all tests
- `npm run test:integration` - Run integration tests only
- `npm run typecheck` - Type check without building

## Development Notes

### TypeScript Configuration

- Target: ES2022
- Module: NodeNext
- Strict mode enabled
- Source maps enabled
- Declaration files generated

### Database Connection Pool

The server uses an optimized PostgreSQL connection pool:

- Max connections: 20
- Min connections: 2
- Idle timeout: 30s
- Connection timeout: 2s
- Statement timeout: 30s

### Graceful Shutdown

The server handles shutdown signals properly:

1. SIGTERM/SIGINT triggers graceful shutdown
2. Database pool closes all connections
3. Process exits cleanly

## Future Enhancements

This is the foundation for the Admin Server. Future phases will add:

- User authentication endpoints (login, register)
- Token refresh with rotation
- Session management
- OAuth provider configuration
- API key management
- User administration
- Tenant management
- Audit log viewing
- System metrics dashboard

## Related Documentation

- [Main Monolith Server](../README.md)
- [SPEC-ARCH-001](../.moai/specs/SPEC-ARCH-001/spec.md) - Microservices Architecture
- [API Server](../api-server/) - Memory operations API (future)
- [MCP Server](../mcp-server/) - Model Context Protocol server (future)
