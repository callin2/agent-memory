# Task Decomposition: SPEC-ARCH-001 Phase 1

**SPEC Reference**: SPEC-ARCH-001
**Phase**: Phase 1 - Extract Admin Server
**Document Type**: Task Decomposition
**Format**: SDD 2025 Standard
**Version**: 1.0
**Created**: 2025-02-09
**Total Tasks**: 8
**Estimated Effort**: 14-17 days

---

## Overview

This document decomposes Phase 1 (Admin Server Extraction) into atomic, reviewable tasks following SDD 2025 standard. Each task is designed to be completable in a single DDD cycle (ANALYZE-PRESERVE-IMPROVE) with clear acceptance criteria.

**TAG Coverage**: All 6 TAGs from the execution strategy are mapped to tasks.

---

## Task List

### TASK-001: Initialize Admin Server Project Structure

**Requirement Mapping**: Maps to SPEC-ARCH-001 requirements [1.1, 1.2, 2.1]
**Dependencies**: None
**Priority**: HIGH
**Estimated Effort**: 1 day

**Description**:
Create the foundational project structure for the Admin Server with TypeScript, Express.js, and development tooling. This establishes the build pipeline, development environment, and basic application skeleton.

**Acceptance Criteria**:
- [ ] TypeScript project initialized with tsconfig.json configured for ES2022 target
- [ ] Express.js server skeleton created with port 3001 configuration
- [ ] Build process configured (tsc compiling to dist/)
- [ ] Development server with hot reload (nodemon or ts-node-dev)
- [ ] Environment variable loading via dotenv
- [ ] Package.json scripts: dev, build, start, test, lint
- [ ] ESLint and Prettier configured with project standards
- [ ] Git repository initialized with .gitignore

**Implementation Notes**:
- Use `npm init -y` for package.json initialization
- Configure TypeScript with strict mode enabled
- Set up nodemon for development watching
- Create directory structure: src/{routes,services,middleware,config,utils}
- Add health check endpoint at GET /health for verification

**Verification Method**:
Unit test | Integration test | Manual verification

**TAG Mapping**: TAG-001 (Admin Server Foundation)

---

### TASK-002: Create Shared Authentication Library

**Requirement Mapping**: Maps to SPEC-ARCH-001 requirements [1.6, 3.3]
**Dependencies**: TASK-001
**Priority**: HIGH
**Estimated Effort**: 2 days

**Description**:
Create `@agent-memory/auth` npm package containing JWT generation, validation, API key management, and authentication middleware. This library will be shared across Admin Server, API Server, and MCP Server.

**Acceptance Criteria**:
- [ ] npm package initialized with scoped name @agent-memory/auth
- [ ] JWT generation function with configurable expiry (15min access, 7day refresh)
- [ ] JWT validation function with signature verification
- [ ] API key generation function (random 32-byte string)
- [ ] API key validation function with database lookup support
- [ ] Express middleware for JWT verification (authMiddleware.ts)
- [ ] Express middleware for API key verification (apiKeyMiddleware.ts)
- [ ] TypeScript types exported (TokenPayload, JWTPair, APIKey)
- [ ] Unit tests for all functions with >85% coverage
- [ ] Package published to local npm registry or linked via npm link

**Implementation Notes**:
- Use jsonwebtoken library for JWT operations
- Define TokenPayload interface: { user_id, tenant_id, roles, iat, exp }
- Export validateToken(token, secret): Promise<TokenPayload>
- Export generateToken(payload, secret, expiresIn): Promise<string>
- Include error handling for expired tokens, invalid signatures
- Document all exported functions with JSDoc comments

**Verification Method**:
Unit test | Integration test

**TAG Mapping**: TAG-004 (Shared Authentication Library)

---

### TASK-003: Migrate Authentication Routes and Services

**Requirement Mapping**: Maps to SPEC-ARCH-001 requirements [1.1, 1.2]
**Dependencies**: TASK-001, TASK-002
**Priority**: HIGH
**Estimated Effort**: 3 days

**Description**:
Extract authentication routes, services, and database queries from the monolith to the Admin Server. Implement login, register, token refresh, logout, and session management endpoints.

**Acceptance Criteria**:
- [ ] POST /auth/login endpoint validates credentials and issues JWT + refresh token
- [ ] POST /auth/register endpoint creates new user and issues tokens
- [ ] POST /auth/token/refresh endpoint rotates refresh tokens
- [ ] POST /auth/token/revoke endpoint invalidates refresh tokens
- [ ] GET /auth/sessions endpoint lists active user sessions
- [ ] DELETE /auth/sessions/:id endpoint revokes specific session
- [ ] UserService class migrated with create, findById, findByEmail methods
- [ ] TokenService class migrated using @agent-memory/auth library
- [ ] SessionService class migrated with create, find, revoke, deleteExpired methods
- [ ] Database queries copied and adapted for users, refresh_tokens, sessions tables
- [ ] Integration tests for all authentication endpoints

**Implementation Notes**:
- Copy src/routes/auth.ts from monolith to Admin Server
- Copy src/services/userService.ts, tokenService.ts, sessionService.ts
- Copy database queries from src/db/queries/users.ts
- Update imports to use @agent-memory/auth library
- Add input validation using express-validator or Zod schemas
- Return HTTP 401 for invalid credentials, HTTP 201 for successful login
- Implement token rotation: issue new refresh token on refresh, invalidate old one

**Verification Method**:
Integration test | E2E test

**TAG Mapping**: TAG-002 (Authentication Service Extraction)

---

### TASK-004: Implement OAuth Provider Management

**Requirement Mapping**: Maps to SPEC-ARCH-001 requirements [1.3, 3.3]
**Dependencies**: TASK-001, TASK-002
**Priority**: HIGH
**Estimated Effort**: 3 days

**Description**:
Implement OAuth provider configuration endpoints and Passport.js strategy adapters. Enable admin users to configure GitHub, Google, and other OAuth providers without code changes.

**Acceptance Criteria**:
- [ ] GET /auth/oauth/providers endpoint lists configured OAuth providers
- [ ] POST /auth/oauth/providers endpoint creates new provider configuration
- [ ] PUT /auth/oauth/providers/:id endpoint updates provider configuration
- [ ] DELETE /auth/oauth/providers/:id endpoint deletes provider configuration
- [ ] OAuth provider credentials stored encrypted in database (client_secret)
- [ ] Passport.js strategy factory for dynamic provider configuration
- [ ] OAuth callback endpoint at GET /auth/oauth/callback/:provider
- [ ] OAuth connection stored in oauth_connections table (user_id, provider, provider_user_id)
- [ ] Integration tests for provider CRUD operations
- [ ] Integration tests for OAuth flow with GitHub provider

**Implementation Notes**:
- Use passport-github2, passport-google-oauth20 strategies
- Create OAuthService class with createProvider, getProviders, getProvider methods
- Implement dynamic strategy loading using passport.use()
- Store client_secret encrypted using crypto module or database encryption
- Define OAuthProvider interface: { id, provider_name, client_id, client_secret, scopes, created_at }
- On callback: find or create user in oauth_connections table, issue JWT tokens
- Handle OAuth errors: denied access, invalid state, token exchange failure

**Verification Method**:
Integration test | Manual verification

**TAG Mapping**: TAG-003 (OAuth Provider Integration)

---

### TASK-005: Build React Admin Panel Foundation

**Requirement Mapping**: Maps to SPEC-ARCH-001 requirements [1.4, 4.1]
**Dependencies**: TASK-001
**Priority**: HIGH
**Estimated Effort**: 2 days

**Description**:
Initialize Vite + React project for the admin panel. Create authentication flow (login page, register page) with JWT token storage and API client integration.

**Acceptance Criteria**:
- [ ] Vite + React project initialized with TypeScript
- [ ] Tailwind CSS configured for styling
- [ ] React Router configured for client-side routing
- [ ] Login page with username/password form at /login
- [ ] Register page with username/email/password form at /register
- [ ] Axios client configured with base URL (http://localhost:3001)
- [ ] JWT token stored in localStorage or httpOnly cookie
- [ ] Axios interceptor adds Authorization header with JWT token
- [ ] Protected route wrapper checks authentication status
- [ ] Login redirect to /admin on successful authentication
- [ ] Logout function clears token and redirects to /login

**Implementation Notes**:
- Use `npm create vite@latest admin-panel --template react-ts`
- Configure axios instance with interceptors for request/response
- Create AuthContext for global authentication state
- Create useAuth hook for accessing authentication state
- Implement auto-refresh logic: call /auth/token/refresh before expiry
- Handle 401 responses: redirect to login, clear tokens
- Form validation with react-hook-form or Zod schemas

**Verification Method**:
E2E test | Manual verification

**TAG Mapping**: TAG-005 (React Admin Panel)

---

### TASK-006: Build Admin Panel Management Interfaces

**Requirement Mapping**: Maps to SPEC-ARCH-001 requirements [1.5, 1.6]
**Dependencies**: TASK-003, TASK-004, TASK-005
**Priority**: HIGH
**Estimated Effort**: 4 days

**Description**:
Create admin panel UI components for user management, OAuth provider configuration, API key management, audit log viewing, and tenant management.

**Acceptance Criteria**:
- [ ] User management page at /admin/users with list, filter, search functionality
- [ ] User detail page showing user info, roles, active sessions
- [ ] OAuth provider configuration page at /admin/oauth with CRUD forms
- [ ] API key management page at /admin/api-keys with generate and revoke actions
- [ ] Audit log viewer page at /admin/audit-logs with filter and export
- [ ] Tenant management page at /admin/tenants with create and configure actions
- [ ] Session management page at /admin/sessions with revoke functionality
- [ ] All pages use consistent layout with navigation header
- [ ] Loading states displayed during API calls
- [ ] Error handling with user-friendly error messages

**Implementation Notes**:
- Use React Table or TanStack Table for data tables
- Implement pagination for user list and audit logs
- Add modal dialogs for confirmations (revoke session, delete user)
- Create reusable components: Button, Input, Table, Modal, Alert
- Implement optimistic UI updates for better UX
- Add form validation with real-time feedback
- Export audit logs as CSV or JSON
- Use React Query for data fetching and caching

**Verification Method**:
E2E test | Manual verification

**TAG Mapping**: TAG-005 (React Admin Panel)

---

### TASK-007: Implement Audit Logging Service

**Requirement Mapping**: Maps to SPEC-ARCH-001 requirements [1.7, 3.1]
**Dependencies**: TASK-001
**Priority**: MEDIUM
**Estimated Effort**: 2 days

**Description**:
Create centralized audit logging service that records all authentication actions, administrative operations, and security-relevant events. Enable audit log viewing and export in the admin panel.

**Acceptance Criteria**:
- [ ] AuditService class with logAction method
- [ ] Audit log fields: user_id, action, outcome, timestamp, ip_address, user_agent, metadata
- [ ] Audit middleware for Express automatically logs requests
- [ ] GET /admin/audit-logs endpoint with pagination and filtering
- [ ] Audit log export endpoint (CSV/JSON) at GET /admin/audit-logs/export
- [ ] Audit logs stored in audit_logs table with indexes on user_id, action, timestamp
- [ ] Sensitive data (passwords, tokens) never logged
- [ ] Integration tests for audit logging middleware
- [ ] Unit tests for AuditService with >85% coverage

**Implementation Notes**:
- Create AuditService.logAction(userId, action, outcome, req) method
- Extract ip_address from req.ip or X-Forwarded-For header
- Extract user_agent from req.headers['user-agent']
- Define action types: LOGIN, REGISTER, LOGOUT, TOKEN_REFRESH, SESSION_REVOKE, USER_CREATE, USER_UPDATE, USER_DELETE, API_KEY_CREATE, API_KEY_REVOKE, OAUTH_PROVIDER_CREATE
- Define outcome types: SUCCESS, FAILURE, ERROR
- Implement audit middleware to apply to all /auth/* and /admin/* routes
- Add audit log to database transactions for atomicity
- Implement log retention policy (e.g., 90 days)

**Verification Method**:
Unit test | Integration test

**TAG Mapping**: TAG-001 (Admin Server Foundation)

---

### TASK-008: Integrate Admin Server with Monolith

**Requirement Mapping**: Maps to SPEC-ARCH-001 requirements [3.2, 3.4]
**Dependencies**: TASK-003, TASK-004, TASK-005, TASK-006, TASK-007
**Priority**: HIGH
**Estimated Effort**: 2 days

**Description**:
Update the monolith to delegate authentication operations to the Admin Server. Remove authentication routes from monolith and add HTTP 301 redirects to Admin Server. Ensure backward compatibility during migration.

**Acceptance Criteria**:
- [ ] All /auth/* routes removed from monolith
- [ ] Monolith redirects GET /auth/login to http://localhost:3001/auth/login (HTTP 301)
- [ ] Monolith redirects POST /auth/login to http://localhost:3001/auth/login (HTTP 307)
- [ ] All authentication redirects include original URL as return query parameter
- [ ] Admin Server handles return_url parameter after login
- [ ] Existing JWT tokens remain valid (same JWT_SECRET)
- [ ] Database migrations compatible with both monolith and Admin Server
- [ ] Integration tests for redirect flow
- [ ] Load tests for authentication endpoints (target p95 ≤ 200ms)
- [ ] Rollback script tested and documented

**Implementation Notes**:
- Create redirect middleware in monolith for /auth/* routes
- Use HTTP 307 for POST redirects to preserve request method
- Add return_url parameter to login link: /auth/login?return_url=/original/page
- Update Admin Server login success to redirect to return_url or /admin
- Keep database tables unchanged (users, refresh_tokens, sessions)
- Share JWT_SECRET via environment variable between monolith and Admin Server
- Use nginx or reverse proxy for production redirects (optional)
- Document rollback steps: restore /auth/* routes, remove redirects

**Verification Method**:
Integration test | E2E test | Load test

**TAG Mapping**: TAG-006 (Monolith Integration)

---

## Task Dependencies

```
TASK-001 (Admin Server Foundation)
    ↓
TASK-002 (Shared Auth Library) ────────┐
    ↓                                  │
TASK-003 (Auth Routes & Services) ─────┤
    ↓                                  │
TASK-004 (OAuth Provider)              │
    ↓                                  ↓
TASK-005 (React Panel Foundation) ←───┤
    ↓                                  │
TASK-006 (Admin Panel UI) ←────────────┤
    ↓                                  │
TASK-007 (Audit Logging) ──────────────┤
    ↓                                  │
TASK-008 (Monolith Integration) ←──────┘
```

**Critical Path**: TASK-001 → TASK-002 → TASK-003 → TASK-005 → TASK-006 → TASK-008
**Parallel Opportunities**: TASK-004 and TASK-007 can run in parallel with TASK-005/TASK-006

---

## TAG Coverage Verification

| TAG | Description | Task Coverage | Status |
|-----|-------------|---------------|--------|
| TAG-001 | Admin Server Foundation | TASK-001, TASK-007 | ✅ Covered |
| TAG-002 | Authentication Service Extraction | TASK-003 | ✅ Covered |
| TAG-003 | OAuth Provider Integration | TASK-004 | ✅ Covered |
| TAG-004 | Shared Authentication Library | TASK-002 | ✅ Covered |
| TAG-005 | React Admin Panel | TASK-005, TASK-006 | ✅ Covered |
| TAG-006 | Monolith Integration | TASK-008 | ✅ Covered |

**Coverage Status**: All 6 TAGs mapped to tasks
**Requirement Traceability**: 100% of Phase 1 requirements covered

---

## Effort Summary

| Task | Effort | Priority |
|------|--------|----------|
| TASK-001 | 1 day | HIGH |
| TASK-002 | 2 days | HIGH |
| TASK-003 | 3 days | HIGH |
| TASK-004 | 3 days | HIGH |
| TASK-005 | 2 days | HIGH |
| TASK-006 | 4 days | HIGH |
| TASK-007 | 2 days | MEDIUM |
| TASK-008 | 2 days | HIGH |

**Total Estimated Effort**: 19 days
**Buffer**: 20% → ~4 days
**Final Estimate**: ~23 days (3.2 weeks)

---

## Risk Assessment

### High-Risk Tasks

**TASK-003 (Auth Routes Migration)**:
- Risk: Breaking existing authentication flow
- Mitigation: Comprehensive integration tests, gradual rollout, rollback plan

**TASK-008 (Monolith Integration)**:
- Risk: Redirect loops, token validation failures
- Mitigation: Test redirect flow in development, monitor authentication logs

### Medium-Risk Tasks

**TASK-004 (OAuth Provider)**:
- Risk: OAuth provider API changes, security vulnerabilities
- Mitigation: Use established Passport.js strategies, security review

**TASK-006 (Admin Panel UI)**:
- Risk: UI complexity leads to development delays
- Mitigation: Use component library (shadcn/ui), iterative development

---

## Quality Gates

Each task must satisfy the following quality gates before completion:

1. **Test Coverage**: ≥85% for services, ≥70% for UI components
2. **Code Review**: Approved by at least one team member
3. **Documentation**: Code comments for complex logic, README for setup
4. **Linting**: Zero ESLint errors, zero TypeScript errors
5. **Verification**: Acceptance criteria validated through automated tests

---

## Definition of Done

Phase 1 is complete when:
- ✅ All 8 tasks completed
- ✅ All acceptance criteria satisfied
- ✅ Test coverage ≥85%
- ✅ Admin Server serves React panel on port 3001
- ✅ All authentication endpoints functional
- ✅ Monolith delegates auth operations to Admin Server
- ✅ Performance targets met (p95 ≤ 200ms for auth operations)
- ✅ Security review passed
- ✅ Rollback tested and documented

---

**Owner**: Development Team
**Status**: Ready for DDD Execution
**Next Phase**: Phase 2 (Extract API Server)
