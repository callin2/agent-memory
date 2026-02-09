# Implementation Plan: SPEC-ARCH-001

**SPEC Reference**: SPEC-ARCH-001
**Document Type**: Implementation Plan
**Version**: 1.0
**Created**: 2025-02-09

---

## Overview

This document outlines the phased implementation strategy for migrating the Agent Memory System from a monolithic architecture to a microservices architecture.

**Approach**: Incremental migration with backward compatibility
**Risk Level**: High (architectural refactoring)
**Estimated Phases**: 5
**Rollback Strategy**: Git revert per phase

---

## Technical Approach

### Migration Strategy

**Pattern**: Strangler Fig Pattern
- Gradually replace monolith components with microservices
- Maintain monolith operational during transition
- Use feature flags to route traffic
- Cut over when new service is stable

**Database Strategy**: Shared Database with Clear Ownership
- Single PostgreSQL instance during transition
- Clear table ownership per service
- Shared authentication library for consistent validation
- Migration scripts applied by service startup order

**Authentication Strategy**: Centralized Issuance, Distributed Validation
- Admin Server: Issues JWT tokens, manages refresh tokens
- API Server: Validates JWT tokens (no issuance)
- MCP Server: Uses API key authentication
- Shared secret via environment variable

**Deployment Strategy**: Docker Compose for Development
- Multi-container orchestration locally
- Independent service builds
- Shared network for inter-service communication
- Production deployment via Kubernetes or cloud platform

---

## Implementation Phases

### Phase 1: Extract Admin Server

**Priority**: HIGH (Primary Goal)
**Dependencies**: None
**Duration**: 1-2 weeks

**Objectives**:
- Separate authentication and admin functionality into dedicated service
- Establish React-based admin panel
- Implement centralized authentication
- Create audit logging service

**Tasks**:

1. **Create Admin Server Repository Structure**
   - Initialize new TypeScript project with Express.js
   - Configure build process (tsc → dist/)
   - Set up development environment with hot reload

2. **Migrate Authentication Routes**
   - Copy `/auth/*` routes from monolith
   - Copy middleware (auth.ts, session management)
   - Copy services: TokenService, SessionService, AuditService
   - Copy user-related database queries

3. **Implement Shared Authentication Library**
   - Create `@agent-memory/auth` npm package
   - Extract JWT generation and validation logic
   - Extract API key generation and validation
   - Export middleware for token verification

4. **Build React Admin Panel**
   - Initialize Vite + React project
   - Create authentication flow (login, register)
   - Build user management interface
   - Build OAuth provider configuration UI
   - Build API key management interface
   - Build audit log viewer
   - Build tenant management interface

5. **Configure Database Access**
   - Connect Admin Server to existing PostgreSQL
   - Ensure tables exist on startup (migration logic)
   - Test user CRUD operations

6. **Update Monolith to Delegate Authentication**
   - Remove `/auth/*` routes from monolith
   - Add redirect to Admin Server for auth operations
   - Update API Server to validate tokens using shared library

7. **Testing**
   - Unit tests for authentication flows
   - Integration tests for admin panel
   - Load tests for token validation
   - Verify audit logging

**Deliverables**:
- Admin Server running on port 3001
- React admin panel accessible at http://localhost:3001
- Authentication API functional
- Monolith updated to delegate auth
- Test coverage > 85%

**Acceptance Criteria**:
- A1: Admin Server serves login page on port 3001
- A2: User can authenticate and receive JWT token
- A3: Admin panel displays user list
- A4: OAuth provider can be configured via admin panel
- A5: Audit logs are written and viewable

**Rollback Plan**:
- Revert monolith to include authentication routes
- Remove Admin Server deployment
- Restore original package.json scripts

---

### Phase 2: Extract API Server

**Priority**: HIGH (Primary Goal)
**Dependencies**: Phase 1 completion
**Duration**: 1-2 weeks

**Objectives**:
- Separate core memory operations into dedicated service
- Remove authentication issuance from API Server
- Implement tenant isolation enforcement
- Optimize database queries for API workload

**Tasks**:

1. **Create API Server Repository Structure**
   - Initialize new TypeScript project with Express.js
   - Configure build process
   - Set up environment variables for database and auth

2. **Migrate Core API Routes**
   - Copy `/api/v1/*` routes from monolith
   - Copy core services: recorder, orchestrator, chunker, privacy
   - Copy utility functions: metrics, token-counter, id-generator
   - Copy database queries for events, chunks, decisions

3. **Update Authentication to Validation-Only**
   - Remove token issuance logic from API Server
   - Remove refresh token endpoints
   - Import `@agent-memory/auth` for validation
   - Update middleware to verify JWT via shared library

4. **Implement API Key Authentication**
   - Add API key validation middleware
   - Support both JWT and API key authentication
   - Log API key usage in audit logs (via Admin Server endpoint)

5. **Optimize Database Access**
   - Review and optimize query performance
   - Add connection pooling configuration
   - Implement prepared statements for frequently called queries
   - Add query performance metrics

6. **Update Monolith to Delegate API Calls**
   - Remove `/api/v1/*` routes from monolith
   - Add reverse proxy to API Server (optional)
   - Or redirect API clients to new port

7. **Testing**
   - Unit tests for all API endpoints
   - Integration tests for authentication flows
   - Load tests for ACB building (target p95 ≤ 500ms)
   - Verify tenant isolation

**Deliverables**:
- API Server running on port 3002
- All memory API endpoints functional
- Authentication via JWT validation
- API key authentication supported
- Monolith delegates or proxies API calls

**Acceptance Criteria**:
- A6: API Server serves /api/v1/* endpoints on port 3002
- A7: Event recording creates records in database
- A8: ACB building completes with p95 ≤ 500ms
- A9: Tenant isolation enforced on all queries
- A10: API key authentication functional

**Rollback Plan**:
- Restore `/api/v1/*` routes to monolith
- Remove API Server deployment
- Update API clients to use port 3000

---

### Phase 3: Separate MCP Server

**Priority**: MEDIUM (Secondary Goal)
**Dependencies**: Phase 2 completion
**Duration**: 1 week

**Objectives**:
- Extract MCP server into standalone project
- Configure MCP server to communicate via HTTP
- Remove MCP mode from monolith
- Enable independent MCP deployment

**Tasks**:

1. **Create MCP Server Repository**
   - Initialize standalone TypeScript project
   - Add MCP SDK dependency
   - Configure stdio transport

2. **Implement HTTP Client for API Communication**
   - Add axios or fetch for HTTP requests
   - Configure base URL for API Server
   - Implement API key authentication header
   - Add error handling and retry logic

3. **Translate MCP Tools to HTTP Calls**
   - Implement `memory.record_event` → `POST /api/v1/events`
   - Implement `memory.build_acb` → `POST /api/v1/acb/build`
   - Implement `memory.get_artifact` → `GET /api/v1/artifacts/:id`
   - Implement `memory.query_decisions` → `GET /api/v1/decisions`

4. **Add Configuration Management**
   - Environment variable for API Server URL
   - Environment variable for API key
   - Connection validation on startup

5. **Update Documentation**
   - Document MCP server setup
   - Document configuration options
   - Update integration examples

6. **Testing**
   - Unit tests for tool-to-HTTP translation
   - Integration tests with running API Server
   - End-to-end tests with MCP client

**Deliverables**:
- MCP Server as standalone npm package
- MCP server communicates via HTTP
- Independent MCP deployment possible
- Documentation updated

**Acceptance Criteria**:
- A11: MCP Server starts and exposes tools via stdio
- A12: MCP tools successfully call API Server endpoints
- A13: MCP Server operates without direct database access

**Rollback Plan**:
- Remove MCP Server repository
- Restore MCP mode to monolith or API Server
- Update MCP client configurations

---

### Phase 4: Build Landing Page

**Priority**: LOW (Optional Goal)
**Dependencies**: None (can run in parallel)
**Duration**: 1 week

**Objectives**:
- Create public marketing website
- Showcase product features
- Provide quick start guide
- Link to documentation

**Tasks**:

1. **Initialize Frontend Project**
   - Choose Next.js 16 or Vite + React
   - Configure Tailwind CSS for styling
   - Set up build and deployment pipeline

2. **Create Page Structure**
   - Hero section with value proposition
   - Features section
   - Quick start guide
   - Integration examples
   - Pricing (if applicable)
   - Footer with links

3. **Add Interactive Elements**
   - Code examples with syntax highlighting
   - Copy-to-clipboard functionality
   - Responsive navigation
   - Optional: Interactive demo

4. **Deploy Landing Page**
   - Configure Vercel/Netlify deployment
   - Set up custom domain (if applicable)
   - Configure CDN for static assets

5. **Testing**
   - Cross-browser testing
   - Mobile responsiveness testing
   - Performance testing (FCP, LCP)

**Deliverables**:
- Landing page deployed and accessible
- Responsive design for mobile and desktop
- Performance metrics meeting targets

**Acceptance Criteria**:
- A14: Landing page accessible on root domain
- A15: Page load performance: FCP ≤ 1.5s

**Rollback Plan**:
- Remove deployment configuration
- Domain can be pointed elsewhere

---

### Phase 5: Create Developer Documentation

**Priority**: MEDIUM (Secondary Goal)
**Dependencies**: Phase 2 completion (for API reference)
**Duration**: 1 week

**Objectives**:
- Generate comprehensive API documentation
- Create integration guides
- Document architecture decisions
- Publish documentation site

**Tasks**:

1. **Initialize Documentation Project**
   - Choose Nextra or Docusaurus
   - Configure build and deployment
   - Set up custom domain

2. **Generate API Reference**
   - Extract API schemas from API Server
   - Auto-generate OpenAPI specification
   - Generate endpoint documentation from OpenAPI

3. **Write Integration Guides**
   - Getting started guide
   - Authentication guide
   - cURL examples
   - Python SDK examples
   - JavaScript/Node.js examples
   - MCP server setup guide

4. **Document Architecture**
   - System overview diagram
   - Data model documentation
   - Security model
   - Deployment guide

5. **Add Troubleshooting Section**
   - Common errors and solutions
   - Performance tuning guide
   - Security best practices

6. **Deploy Documentation Site**
   - Configure Vercel/Netlify deployment
   - Set up search functionality
   - Configure analytics (optional)

**Deliverables**:
- Documentation site published
- API reference complete
- Integration guides available

**Acceptance Criteria**:
- A16: Documentation site accessible
- A17: API reference covers all endpoints
- A18: Integration guides include code examples

**Rollback Plan**:
- Remove documentation deployment
- Source content preserved in repository

---

## Architecture Decisions

### ADR-001: Shared Database vs Separate Databases

**Decision**: Use shared database during migration, plan for separation if scaling needs emerge.

**Rationale**:
- Simplifies data consistency (ACID transactions)
- Reduces operational complexity (single backup)
- Enables cross-service queries for reporting
- Acceptable performance at current scale

**Trade-offs**:
- Pro: Easier migration, simpler ops
- Con: Database may become bottleneck, harder to scale

**Future**: If database becomes scaling constraint, separate into service-specific databases.

---

### ADR-002: API Gateway vs Direct Service Communication

**Decision**: Use direct service-to-service communication initially, add API Gateway if complexity grows.

**Rationale**:
- Simpler architecture for 2-3 services
- Lower latency (no additional hop)
- Easier debugging (direct calls)
- API Gateway adds premature complexity

**Trade-offs**:
- Pro: Lower latency, simpler ops
- Con: Authentication logic duplicated, no centralized rate limiting

**Future**: If services grow beyond 5, consider API Gateway (Kong, NGINX, or cloud service).

---

### ADR-003: React Admin Panel vs Server-Side Templates

**Decision**: Build React admin panel with Vite.

**Rationale**:
- Modern developer experience
- Rich interactive UI components
- Separate deployment from Admin Server backend
- Enables future SPA features (real-time updates, etc.)

**Trade-offs**:
- Pro: Better UX, modern tooling
- Con: Additional build step, more complex deployment

**Future**: Keep React, consider Next.js if SSR needed for performance.

---

## Risk Mitigation

### High-Risk Areas

1. **Authentication Migration**
   - Risk: Token validation breaks, users locked out
   - Mitigation: Comprehensive testing, gradual rollout, rollback plan ready

2. **Database Schema Changes**
   - Risk: Schema migration fails, data corruption
   - Mitigation: Backup before migration, test migrations in dev environment

3. **Service Communication**
   - Risk: Network failures between services
   - Mitigation: Retry logic with exponential backoff, circuit breakers

4. **Performance Regression**
   - Risk: Additional network hops increase latency
   - Mitigation: Performance testing after each phase, optimization iterations

### Contingency Plans

**If Phase 1 fails**:
- Rollback to monolith
- Re-evaluate authentication library design
- Increase testing coverage

**If Phase 2 fails**:
- Keep API Server within monolith
- Delay microservices migration
- Focus on Admin Server only

**If inter-service communication is unreliable**:
- Consider single-service deployment initially
- Add message queue for resilience
- Re-evaluate network configuration

---

## Success Metrics

### Phase Completion Criteria

Each phase is complete when:
- All acceptance criteria satisfied
- Test coverage ≥ 85%
- Performance targets met
- Documentation updated
- Rollback tested

### Overall Success Metrics

- All 5 phases complete
- p95 latency targets met (API ≤ 500ms, Admin ≤ 200ms)
- Zero regression in existing functionality
- Independent deployment verified
- Security audit passed

---

**Next Steps**: Begin Phase 1 (Extract Admin Server)

**Owner**: Architecture Team
**Status**: Ready for Implementation
