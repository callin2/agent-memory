# Changelog

All notable changes to the Agent Memory System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-02-10

### Added

#### Admin Server (Phase 1)
- **Admin Server Foundation**: Created new `admin-server/` directory with independent Express.js application
  - Server running on port 3001 (configurable via `ADMIN_PORT`)
  - Health check endpoint at `GET /health`
  - Server information endpoint at `GET /`
  - PostgreSQL connection pooling (max 20, min 2 connections)
  - Error handling middleware with development/production modes
  - Request logging middleware for all incoming requests
  - Graceful shutdown handling for SIGTERM/SIGINT signals
  - TypeScript 5.3.3 with strict mode enabled
  - Vitest testing framework with Supertest for integration tests

#### Shared Authentication Library
- **@agent-memory/auth Package**: Created shared authentication library in `packages/auth/`
  - JWT generation and verification functions (`generateToken`, `verifyToken`, `decodeToken`)
  - API key generation, validation, and hashing (`generateAPIKey`, `validateAPIKey`, `hashAPIKey`)
  - Express authentication middleware (`authenticate`, `authenticateAPIKey`, `authenticateAny`, `optionalAuthenticate`, `requireRole`)
  - TypeScript type definitions (`JWTPayload`, `AuthConfig`, `APIKey`, `AuthenticatedRequest`)
  - Configured as scoped npm package with peer dependencies

#### Infrastructure
- **Monorepo Structure**: Established `packages/` directory for shared packages
- **TypeScript Configuration**: Separate tsconfig for admin-server and auth package
- **Testing Infrastructure**: Vitest configuration for both admin-server and auth package
- **Build Scripts**: Separate build scripts for each package using tsc

### Changed

- **Architecture**: Began migration from monolith to microservices architecture (SPEC-ARCH-001)
- **Database**: Connection pooling now configured per service

### Technical Details

#### Admin Server
- **Port**: 3001 (was part of monolith on port 3000)
- **Technology**: Express.js, TypeScript, PostgreSQL, jsonwebtoken, bcryptjs
- **Database**: Shared PostgreSQL with optimized connection pool
- **Testing**: Vitest + Supertest for integration tests

#### @agent-memory/auth
- **Version**: 1.0.0
- **Dependencies**: express (peer), jsonwebtoken (peer)
- **Features**: JWT, API keys, Express middleware
- **Type Support**: Full TypeScript definitions included

### Dependencies

#### Admin Server New Dependencies
- `express@^4.18.2` - Web framework
- `pg@^8.11.3` - PostgreSQL client
- `jsonwebtoken@^9.0.2` - JWT generation/verification
- `bcryptjs@^3.0.3` - Password hashing
- `dotenv@^16.3.1` - Environment configuration
- `tsx@^4.7.0` - TypeScript execution with hot reload
- `vitest@^1.2.0` - Testing framework
- `supertest@^6.3.4` - HTTP assertion library

#### @agent-memory/auth New Dependencies
- `jsonwebtoken@^9.0.2` - JWT generation/verification (peer)
- `express@^4.18.2` - Express types (peer, optional)

### Migration Notes

This release begins the microservices migration. The monolith server remains functional on port 3000 while the new Admin Server runs on port 3001.

**Next Steps:**
- Implement authentication endpoints (login, register, token refresh)
- Add OAuth provider configuration
- Extract API Server to separate service
- Separate MCP Server to standalone project

### Known Issues

- 99/146 tests failing due to database schema and mock configuration issues
- 143 linter warnings (0 errors)
- Authentication endpoints not yet implemented

---

## [2.0.0] - 2025-02-09

### Added
- Initial monolithic Agent Memory System
- Event recording and persistence
- Active Context Bundle (ACB) building
- Decision ledger management
- Task tracking
- Artifact storage and retrieval
- Multi-tenant support
- Channel-based privacy filtering
- PostgreSQL database with 13 tables
- MCP server via stdio transport
- Authentication with JWT and Refresh Tokens
- OAuth provider support
- API key management

### Architecture
- Single Express.js server on port 3000
- Unified PostgreSQL database
- Mixed authentication strategies
- Admin panel routes (`/auth/*`, `/auth/oauth/*`)
- API endpoints (`/api/v1/*`)
- MCP server integration

---

## [Unreleased]

### Planned
- API Server extraction (port 3002)
- MCP Server separation to standalone project
- Landing page for public marketing site
- Developer documentation site with Nextra
- Complete authentication endpoints in Admin Server
- OAuth provider configuration UI
- Session management endpoints
- User administration endpoints
- Tenant management endpoints
- Audit log viewing
- System metrics dashboard
