# SPEC-ARCH-001: Microservices Architecture Refactoring

**SPEC ID:** SPEC-ARCH-001
**Title:** Monolith to Microservices Architecture Migration
**Status:** In Progress
**Priority:** High
**Created:** 2025-02-09
**Updated:** 2025-02-10
**Assigned:** Architecture Team

---

## TAG BLOCK

**Tags:** architecture, microservices, migration, refactoring
**Related SPECs:** None
**Epic:** System Architecture Evolution

---

## Environment

### Current State
The Agent Memory System v2.0 operates as a monolithic Express.js application combining multiple concerns:

- **Single HTTP Server** (port 3000) serving:
  - Admin panel routes (`/auth/*`, `/auth/oauth/*`)
  - API endpoints (`/api/v1/*`)
  - MCP server via stdio transport
- **Unified PostgreSQL database** with 13 tables
- **Mixed authentication strategies**: JWT, Refresh Tokens, API Keys, OAuth
- **Tight coupling** between admin, API, and MCP functionality

### Deployment Context
- **Development**: Local Node.js process with PostgreSQL
- **Production**: Single container (planned) or VM
- **Scale**: Currently single-tenant, designed for multi-tenancy
- **Operational Complexity**: All services share lifecycle, logs, and metrics

### Problem Statement
The monolithic architecture creates several constraints:

1. **Independent Scaling**: Cannot scale admin panel independently from API server
2. **Technology Lock-in**: Admin UI and API server forced to use same framework
3. **Deployment Coupling**: MCP server changes require full deployment
4. **Security Boundaries**: Admin and API functions share same attack surface
5. **Development Velocity**: Large codebase slows onboarding and feature development
6. **Separation of Concerns**: Mixed responsibilities violate single-purpose principle

---

## Assumptions

### Technical Assumptions
- **Confidence: HIGH** - PostgreSQL will remain the primary data store for all services
- **Confidence: HIGH** - All services can authenticate using shared JWT validation
- **Confidence: MEDIUM** - MCP server can operate as standalone process using HTTP API
- **Confidence: HIGH** - Docker Compose can orchestrate local multi-service development
- **Confidence: MEDIUM** - API Gateway pattern provides sufficient inter-service communication

### Business Assumptions
- **Confidence: HIGH** - User base will require dedicated admin panel separate from API
- **Confidence: MEDIUM** - Developer documentation will drive adoption
- **Confidence: LOW** - Public landing page will significantly increase user acquisition
- **Confidence: HIGH** - Multi-tenancy requires isolated tenant contexts across services

### Integration Assumptions
- **Confidence: HIGH** - Existing database schema can support multi-service access
- **Confidence: MEDIUM** - OAuth providers can be configured without code changes
- **Confidence: HIGH** - Audit logging can remain centralized in Admin Server
- **Confidence: MEDIUM** - Cross-service authentication will not significantly impact latency

### Risk if Wrong
- **PostgreSQL bottleneck**: If database becomes primary scaling constraint, may require separate databases
- **MCP HTTP dependency**: If MCP server requires direct database access, architecture changes needed
- **Authentication overhead**: If JWT validation adds significant latency, may need caching layer
- **OAuth complexity**: If OAuth configuration requires frequent code changes, admin panel value decreases

---

## Requirements (EARS Format)

### Ubiquitous Requirements (System-Wide)

**WHEN** any service receives a request, the system **shall** validate authentication tokens via shared JWT verification.

**WHEN** any service accesses the database, the system **shall** enforce tenant_id isolation at query level.

**WHEN** any service performs a write operation, the system **shall** write audit logs to the central audit_logs table.

**WHEN** any service experiences an error, the system **shall** expose structured error responses with consistent format.

### Event-Driven Requirements (Trigger-Based)

**WHEN** a user requests admin panel access, the Admin Server **shall** serve the React application on port 3001.

**WHEN** an API client submits an event, the API Server **shall** record the event and trigger chunking pipeline.

**WHEN** an MCP client connects via stdio, the MCP Server **shall** initialize and expose memory tools.

**WHEN** a visitor accesses the root domain, the Landing Page **shall** serve the public marketing site.

**WHEN** OAuth callback is received, the Admin Server **shall** complete authentication flow and issue tokens.

### State-Driven Requirements (Conditional)

**IF** a service requires user authentication, **THEN** the system **shall** redirect to Admin Server login endpoint.

**IF** a request lacks valid authentication, **THEN** the system **shall** return HTTP 401 with standardized error response.

**IF** the database connection pool is exhausted, **THEN** the system **shall** return HTTP 503 with retry-after header.

**IF** an API request exceeds rate limits, **THEN** the system **shall** return HTTP 429 with rate limit headers.

### Unwanted Requirements (Prohibited Behaviors)

The system **shall not** allow cross-service direct database access bypassing the service layer.

The system **shall not** expose admin panel routes on the API Server port.

The system **shall not** store plaintext passwords or sensitive credentials in database.

The system **shall not** allow API clients to access OAuth provider configuration directly.

The system **shall not** mix tenant data in query results without tenant_id filtering.

### Optional Requirements (Nice-to-Have)

**WHERE** feasible, the system **should** provide API rate limiting per tenant.

**WHERE** feasible, the system **should** cache JWT validation results to reduce database queries.

**WHERE** feasible, the system **should** support graceful degradation when Admin Server is unavailable.

**WHERE** feasible, the system **should** provide real-time metrics for each service independently.

---

## Specifications

### Functional Specifications

#### 1. Admin Server (Port 3001)

**Purpose**: User management, authentication, OAuth provider configuration, system monitoring

**Responsibilities**:
- User account management (CRUD operations, role assignment)
- Authentication endpoints (login, register, token refresh, logout)
- OAuth provider management (configure GitHub, Google, etc.)
- API key generation and management
- Audit log viewing and export
- System metrics and monitoring dashboard
- Tenant management (create, configure, isolate)
- Session management (view active sessions, revoke)

**API Endpoints**:
- `POST /auth/login` - User authentication
- `POST /auth/register` - User registration
- `POST /auth/token/refresh` - Token refresh with rotation
- `POST /auth/token/revoke` - Token revocation (logout)
- `GET /auth/sessions` - List active sessions
- `DELETE /auth/sessions/:id` - Revoke specific session
- `GET /auth/oauth/providers` - List OAuth providers
- `POST /auth/oauth/providers` - Configure OAuth provider
- `GET /auth/api-keys` - List API keys
- `POST /auth/api-keys` - Generate new API key
- `DELETE /auth/api-keys/:id` - Revoke API key
- `GET /admin/users` - List users (admin only)
- `GET /admin/tenants` - List tenants (admin only)
- `POST /admin/tenants` - Create tenant (admin only)
- `GET /admin/audit-logs` - View audit logs
- `GET /admin/metrics` - System metrics dashboard

**Technology Stack**:
- Backend: Express.js (TypeScript)
- Frontend: React + Vite
- Database: PostgreSQL (shared)
- Authentication: JWT + Refresh Tokens
- OAuth: Passport.js strategy adapters

#### 2. API Server (Port 3002)

**Purpose**: Core memory operations - event recording, context building, data retrieval

**Responsibilities**:
- Event recording and persistence
- Automatic chunking pipeline
- Active Context Bundle (ACB) building
- Decision ledger management
- Task tracking
- Artifact storage and retrieval
- Multi-tenant data isolation
- Privacy filtering by channel

**API Endpoints**:
- `POST /api/v1/events` - Record event
- `GET /api/v1/events/:event_id` - Retrieve event
- `GET /api/v1/events` - List events by session
- `POST /api/v1/acb/build` - Build Active Context Bundle
- `GET /api/v1/chunks/:chunk_id` - Retrieve chunk
- `GET /api/v1/artifacts/:artifact_id` - Retrieve artifact
- `POST /api/v1/decisions` - Create decision
- `GET /api/v1/decisions` - Query decisions
- `POST /api/v1/tasks` - Create/update task
- `GET /api/v1/tasks` - Query tasks
- `GET /health` - Health check
- `GET /metrics` - Service metrics (Prometheus format)

**Authentication**:
- Validates JWT tokens issued by Admin Server
- Validates API keys issued by Admin Server
- Enforces tenant_id isolation on all queries

**Technology Stack**:
- Framework: Express.js (TypeScript)
- Database: PostgreSQL (shared)
- Authentication: JWT validation only (no token issuance)
- Rate Limiting: Per-tenant token bucket algorithm

#### 3. MCP Server (Separate Project)

**Purpose**: Model Context Protocol integration for AI agents

**Responsibilities**:
- Expose memory tools via MCP stdio transport
- Translate MCP tool calls to HTTP API requests
- Handle MCP protocol negotiation
- Provide tool descriptions and schemas

**MCP Tools**:
- `memory.record_event` - Record any event type
- `memory.build_acb` - Build Active Context Bundle
- `memory.get_artifact` - Retrieve full artifact
- `memory.query_decisions` - Query decision ledger

**Architecture**:
- Standalone Node.js process
- Communicates with API Server via HTTP
- No direct database access
- Configurable API Server endpoint

**Technology Stack**:
- Framework: TypeScript MCP SDK
- Transport: stdio
- API Communication: HTTP client (fetch or axios)

#### 4. Landing Page (Port 3000 or 80)

**Purpose**: Public marketing website, product showcase, quick start guide

**Sections**:
- Hero section with value proposition
- Feature highlights
- Interactive demo (optional)
- Quick start guide
- Pricing information (if applicable)
- Documentation links
- Community/discussion links

**Technology Stack**:
- Framework: Next.js 16 or Vite + React
- Deployment: Static site hosting (Vercel, Netlify, or nginx)
- Styling: Tailwind CSS

#### 5. Developer Documentation (Separate Project)

**Purpose**: API reference, integration guides, architecture documentation

**Sections**:
- Getting started guide
- Authentication guide
- API reference (endpoint documentation)
- Integration examples (cURL, Python, JavaScript)
- MCP server configuration
- Architecture overview
- Troubleshooting guide

**Technology Stack**:
- Framework: Nextra or Docusaurus
- Deployment: Static site hosting
- OpenAPI Specification: auto-generated from API Server schema

### Non-Functional Specifications

#### Performance
- API Server p95 latency: ≤ 500ms for ACB building
- Admin Server p95 latency: ≤ 200ms for auth operations
- MCP Server tool call latency: ≤ 600ms (includes API Server call)
- Landing Page First Contentful Paint: ≤ 1.5s

#### Scalability
- Support 10+ concurrent tenants without performance degradation
- Independent horizontal scaling of API Server
- Admin Server vertical scaling sufficient for expected load
- Database connection pooling supports all services concurrently

#### Security
- All services validate JWT tokens using shared secret
- OAuth provider credentials stored encrypted in database
- API keys scoped to specific operations
- Audit logging for all administrative actions
- TLS required for all inter-service communication

#### Maintainability
- Each service has independent version control
- Shared authentication library via npm package
- Database migrations applied sequentially by service startup order
- Structured logging with service identification

#### Availability
- API Server: Target 99.9% uptime
- Admin Server: Target 99.5% uptime
- Graceful degradation when Admin Server unavailable (API Server continues)
- Database failover handling (connection retry with exponential backoff)

---

## Data Architecture

### Database Access Pattern

**Shared Database with Service Isolation**:

All services share the same PostgreSQL database but access different tables:

| Service | Tables Accessed | Operations |
|---------|----------------|------------|
| Admin Server | users, refresh_tokens, api_keys, sessions, audit_logs, oauth_providers, oauth_connections, tenants | Read/Write |
| API Server | events, chunks, decisions, tasks, artifacts | Read/Write |
| API Server | users (read-only for validation) | Read |
| MCP Server | No direct database access (uses API Server) | N/A |

**Rationale**:
- Simplifies backup and disaster recovery
- Maintains data consistency (ACID transactions)
- Enables cross-service queries for reporting
- Reduces operational complexity

**Migration Strategy**:
- Apply schema changes via Admin Server startup (owns schema)
- API Server validates required tables exist on startup
- Shared migrations directory for coordinated changes

### Inter-Service Communication

**Synchronous Communication**:
- MCP Server → API Server: HTTP requests (authenticated with API key)
- Landing Page → API Server: Public API endpoints (if demo enabled)
- Admin Panel → API Server: HTTP requests (authenticated with JWT)

**Asynchronous Communication**:
- Audit logs: Write directly to database (no message queue needed)
- Future: Event streaming for real-time metrics (optional)

### Authentication Flow

1. **User Login** (via Admin Server):
   - User sends credentials to `POST /auth/login`
   - Admin Server validates password, issues JWT + refresh token
   - Admin Server creates session record
   - Returns tokens to user

2. **API Access** (via API Server):
   - Client includes JWT in Authorization header
   - API Server validates JWT signature using shared secret
   - API Server extracts tenant_id from JWT claims
   - API Server processes request with tenant isolation

3. **MCP Access** (via MCP Server):
   - MCP client connects via stdio
   - MCP Server initialized with API key
   - MCP Server calls API Server with API key in headers
   - API Server validates API key, processes request

---

## Traceability

**TAG**: SPEC-ARCH-001

**Requirements Traceability**:
- Admin Server responsibilities → Acceptance Criteria A1-A5
- API Server responsibilities → Acceptance Criteria A6-A10
- MCP Server responsibilities → Acceptance Criteria A11-A13
- Landing Page requirements → Acceptance Criteria A14-A15
- Documentation requirements → Acceptance Criteria A16-A18

**Implementation Traceability**:
- Phase 1 (Admin Server extraction) → Plan.md Milestone M1
- Phase 2 (API Server extraction) → Plan.md Milestone M2
- Phase 3 (MCP Server separation) → Plan.md Milestone M3
- Phase 4 (Landing Page) → Plan.md Milestone M4
- Phase 5 (Documentation) → Plan.md Milestone M5

**Test Coverage**:
- All EARS requirements mapped to acceptance test scenarios
- Performance requirements validated via load testing
- Security requirements validated via penetration testing

---

## Success Criteria

The microservices refactoring is considered successful when:

1. ✅ Admin Server serves React application and authentication endpoints on port 3001
2. ✅ API Server serves memory operations on port 3002
3. ✅ MCP Server operates as standalone project communicating via HTTP
4. ✅ Landing Page deployed and accessible on root domain
5. ✅ Developer documentation published with API reference
6. ✅ All services authenticate using shared JWT validation
7. ✅ Tenant isolation enforced across all services
8. ✅ Audit logging centralized in Admin Server
9. ✅ Independent deployment of each service verified
10. ✅ p95 latency targets met for all services
11. ✅ No regression in existing functionality
12. ✅ All acceptance criteria satisfied

---

**Document Owner**: Architecture Team
**Review Cycle**: Daily during implementation phase
**Next Review**: After Phase 1 completion (Admin Server extraction)
