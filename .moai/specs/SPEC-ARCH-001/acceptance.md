# Acceptance Criteria: SPEC-ARCH-001

**SPEC Reference**: SPEC-ARCH-001
**Document Type**: Acceptance Criteria
**Format**: Given-When-Then (Gherkin)
**Version**: 1.0
**Created**: 2025-02-09

---

## Overview

This document defines the acceptance criteria for the microservices architecture refactoring. Each criterion is expressed in Gherkin format (Given-When-Then) to enable automated testing and clear validation.

**Test Coverage Target**: 85%
**Definition of Done**: All acceptance criteria satisfied with automated tests passing

---

## Admin Server Acceptance Criteria

### AC-001: Admin Server Serves Login Page

**Given** the Admin Server is running on port 3001
**When** a user navigates to http://localhost:3001
**Then** the React admin panel login page is displayed
**And** the page includes username and password fields
**And** the page includes a login button

**Test Type**: Integration
**Priority**: HIGH

---

### AC-002: User Authentication Flow

**Given** the Admin Server is running
**And** a user exists in the database with credentials username="testuser", password="password123"
**When** the user submits POST /auth/login with valid credentials
**Then** the system returns HTTP 200
**And** the response includes access_token (JWT)
**And** the response includes refresh_token
**And** the response includes user object with tenant_id, user_id, username, roles
**And** the access token expires in 15 minutes
**And** the refresh token expires in 7 days

**Test Type**: Integration
**Priority**: HIGH

---

### AC-003: Admin Panel User Management

**Given** the Admin Server is running
**And** an admin user is authenticated
**When** the admin navigates to the users page
**Then** the system displays a list of all users
**And** each user shows tenant_id, username, email, roles, created_at, last_login
**And** the admin can filter users by tenant_id
**And** the admin can search users by username or email

**Test Type**: End-to-End (E2E)
**Priority**: HIGH

---

### AC-004: OAuth Provider Configuration

**Given** the Admin Server is running
**And** an admin user is authenticated
**When** the admin submits POST /auth/oauth/providers with provider_name="github", client_id="abc123", client_secret="secret456"
**Then** the system returns HTTP 201
**And** the OAuth provider is saved in the database
**And** the provider appears in GET /auth/oauth/providers list

**Test Type**: Integration
**Priority**: HIGH

---

### AC-005: Audit Logging

**Given** the Admin Server is running
**When** a user performs any authentication action (login, register, logout, token refresh)
**Then** the system writes an audit log entry to the audit_logs table
**And** the audit log includes: user_id, action, outcome, timestamp, ip_address, user_agent, metadata
**And** the admin can view audit logs via GET /admin/audit-logs

**Test Type**: Integration
**Priority**: HIGH

---

## API Server Acceptance Criteria

### AC-006: API Server Serves Memory Endpoints

**Given** the API Server is running on port 3002
**When** a client sends GET http://localhost:3002/health
**Then** the system returns HTTP 200
**And** the response includes status="healthy"
**And** the response includes timestamp

**Test Type**: Integration
**Priority**: HIGH

---

### AC-007: Event Recording

**Given** the API Server is running
**And** a client has valid JWT token or API key
**When** the client submits POST /api/v1/events with valid event data
```json
{
  "tenant_id": "tenant1",
  "session_id": "session1",
  "channel": "private",
  "actor": {"type": "human", "id": "user1"},
  "kind": "message",
  "content": {"text": "Hello, world!"}
}
```
**Then** the system returns HTTP 201
**And** the response includes event_id
**And** the response includes chunk_ids array
**And** the event is persisted in the events table
**And** the chunks are persisted in the chunks table
**And** tenant_id isolation is enforced (data only accessible to tenant1)

**Test Type**: Integration
**Priority**: HIGH

---

### AC-008: Active Context Bundle Building Performance

**Given** the API Server is running
**And** the database contains 1000 events and 5000 chunks for tenant1
**When** a client submits POST /api/v1/acb/build with tenant_id="tenant1", session_id="session1", max_tokens=65000
**Then** the system returns HTTP 200
**And** the response includes acb_id
**And** the response includes sections array
**And** the response includes token_used_est ≤ 65000
**And** the p95 response time is ≤ 500ms (measured over 100 requests)

**Test Type**: Performance
**Priority**: HIGH

---

### AC-009: Tenant Isolation Enforcement

**Given** the API Server is running
**And** the database contains events for tenant1 and tenant2
**And** a client has valid JWT token for tenant1
**When** the client submits GET /api/v1/events?tenant_id=tenant1&session_id=session1
**Then** the system returns only events belonging to tenant1
**And** no events from tenant2 are included in the response
**And** the SQL query includes tenant_id filter in WHERE clause

**Test Type**: Integration
**Priority**: HIGH

---

### AC-010: API Key Authentication

**Given** the API Server is running
**And** an API key exists for tenant1 with scopes ["read", "write"]
**When** a client sends request to GET /api/v1/events with header "x-api-key: <valid_api_key>"
**Then** the system validates the API key
**And** the system returns HTTP 200 with events data
**And** the system logs the API key usage in audit logs

**Test Type**: Integration
**Priority**: MEDIUM

---

## MCP Server Acceptance Criteria

### AC-011: MCP Server Initialization

**Given** the MCP Server is installed as a standalone package
**When** the MCP Server is started with environment variables API_SERVER_URL="http://localhost:3002", API_KEY="test_key"
**Then** the MCP Server starts without errors
**And** the MCP Server connects to API Server
**And** the MCP Server exposes tools via stdio

**Test Type**: Integration
**Priority**: MEDIUM

---

### AC-012: MCP Tool to HTTP Translation

**Given** the MCP Server is running and connected to API Server
**When** an MCP client calls tool memory.record_event with parameters
```json
{
  "tenant_id": "tenant1",
  "session_id": "session1",
  "channel": "private",
  "actor": {"type": "human", "id": "user1"},
  "kind": "message",
  "content": {"text": "Test message"}
}
```
**Then** the MCP Server translates the tool call to POST /api/v1/events
**And** the MCP Server includes API key in request headers
**And** the MCP Server returns the API Server response to the MCP client
**And** the response includes event_id and chunk_ids

**Test Type**: Integration
**Priority**: MEDIUM

---

### AC-013: MCP Server Database Independence

**Given** the MCP Server is running
**When** the MCP Server processes any tool call
**Then** the MCP Server makes zero direct database connections
**And** the MCP Server only communicates via HTTP to API Server
**And** the MCP Server has no PostgreSQL client library dependency

**Test Type**: Integration
**Priority**: MEDIUM

---

## Landing Page Acceptance Criteria

### AC-014: Landing Page Accessibility

**Given** the Landing Page is deployed
**When** a visitor navigates to the root domain (e.g., http://agent-memory.dev)
**Then** the landing page loads successfully
**And** the page includes hero section with value proposition
**And** the page includes features section
**And** the page includes quick start guide
**And** the page includes links to documentation

**Test Type**: Integration
**Priority**: LOW

---

### AC-015: Landing Page Performance

**Given** the Landing Page is deployed
**When** a visitor loads the page for the first time (cold cache)
**Then** the First Contentful Paint (FCP) is ≤ 1.5 seconds
**And** the Largest Contentful Paint (LCP) is ≤ 2.5 seconds
**And** the page passes Lighthouse performance audit with score ≥ 90

**Test Type**: Performance
**Priority**: LOW

---

## Documentation Acceptance Criteria

### AC-016: Documentation Site Accessibility

**Given** the Documentation site is deployed
**When** a developer navigates to the documentation URL (e.g., http://docs.agent-memory.dev)
**Then** the documentation site loads successfully
**And** the site includes navigation menu
**And** the site includes search functionality
**And** the site includes Getting Started guide

**Test Type**: Integration
**Priority**: MEDIUM

---

### AC-017: API Reference Completeness

**Given** the Documentation site is deployed
**When** a developer navigates to the API Reference section
**Then** the API Reference includes all endpoints:
  - POST /api/v1/events
  - GET /api/v1/events/:event_id
  - GET /api/v1/events
  - POST /api/v1/acb/build
  - GET /api/v1/chunks/:chunk_id
  - GET /api/v1/artifacts/:artifact_id
  - POST /api/v1/decisions
  - GET /api/v1/decisions
  - POST /api/v1/tasks
  - GET /api/v1/tasks
**And** each endpoint includes:
  - HTTP method and path
  - Request parameters with types
  - Response schema with examples
  - Authentication requirements
  - Error responses

**Test Type**: Content Validation
**Priority**: MEDIUM

---

### AC-018: Integration Guide Code Examples

**Given** the Documentation site is deployed
**When** a developer navigates to the Integration Guide section
**Then** the guide includes code examples for:
  - cURL examples
  - Python SDK (if available)
  - JavaScript/Node.js client
  - MCP server configuration
**And** each code example is copy-paste runnable
**And** each code example includes setup instructions
**And** each code example includes expected output

**Test Type**: Content Validation
**Priority**: MEDIUM

---

## Cross-Service Acceptance Criteria

### AC-019: Shared Authentication Validation

**Given** the Admin Server issues a JWT token for user1
**And** the API Server is configured with the same JWT_SECRET
**When** the API Server receives a request with the JWT token in Authorization header
**Then** the API Server validates the token signature
**And** the API Server extracts user_id and tenant_id from token claims
**And** the API Server processes the request with the user's identity
**And** no authentication database query is made by the API Server

**Test Type**: Integration
**Priority**: HIGH

---

### AC-020: Service Independence

**Given** all services are deployed (Admin, API, MCP, Landing, Docs)
**When** the Admin Server is stopped (unavailable)
**Then** the API Server continues to serve memory endpoints
**And** existing JWT tokens remain valid
**And** new authentication requests fail gracefully
**And** the system returns HTTP 503 for auth operations only

**Test Type**: Resilience
**Priority**: MEDIUM

---

### AC-021: Graceful Degradation

**Given** all services are running
**When** the API Server becomes unavailable (network failure or crash)
**Then** the Admin Server continues to serve the admin panel
**And** the Landing Page continues to be accessible
**And** the Documentation site continues to be accessible
**And** the MCP Server returns error messages to MCP clients

**Test Type**: Resilience
**Priority**: MEDIUM

---

## Security Acceptance Criteria

### AC-022: Cross-Site Request Forgery (CSRF) Protection

**Given** the Admin Server is serving the React admin panel
**When** a malicious site attempts to submit a form to the Admin Server
**Then** the Admin Server validates the CSRF token
**And** the request is rejected if CSRF token is missing or invalid
**And** the system returns HTTP 403

**Test Type**: Security
**Priority**: HIGH

---

### AC-023: SQL Injection Prevention

**Given** the API Server is running
**When** a client sends request with malicious payload in tenant_id parameter: "tenant1'; DROP TABLE events; --"
**Then** the API Server sanitizes the input using parameterized queries
**And** the events table is not dropped
**And** the system returns HTTP 400 with error message
**And** no SQL error is exposed to the client

**Test Type**: Security
**Priority**: HIGH

---

### AC-024: Tenant Data Leakage Prevention

**Given** the API Server is running
**And** tenant1 and tenant2 have data in the database
**When** a client with JWT token for tenant1 attempts to access tenant2 data by modifying tenant_id in request body
**Then** the API Server validates tenant_id from JWT token
**And** the API Server ignores tenant_id in request body
**And** the system returns only tenant1 data
**And** the system logs the unauthorized access attempt

**Test Type**: Security
**Priority**: HIGH

---

## Performance Acceptance Criteria

### AC-025: Concurrent Load Handling

**Given** all services are running
**When** 10 concurrent tenants each make 10 requests per second to the API Server
**Then** the API Server maintains p95 latency ≤ 500ms
**And** the API Server returns HTTP 200 for ≥ 99% of requests
**And** the database connection pool is not exhausted
**And** no memory leaks occur (heap size stable)

**Test Type**: Performance
**Priority**: HIGH

---

### AC-026: Cold Start Performance

**Given** all services are stopped
**When** the services are started in order: Admin Server, API Server, MCP Server
**Then** each service becomes healthy within 10 seconds
**And** the Admin Server serves login page within 15 seconds of startup
**And** the API Server serves health check within 15 seconds of startup
**And** the MCP Server responds to tool calls within 15 seconds of startup

**Test Type**: Performance
**Priority**: MEDIUM

---

## Rollback Acceptance Criteria

### AC-027: Database Rollback

**Given** Phase 1 or Phase 2 changes have been applied
**When** a database migration fails or causes data corruption
**Then** the rollback script restores the database to previous state
**And** all existing data is preserved
**And** the monolith can restart and operate correctly

**Test Type**: Disaster Recovery
**Priority**: HIGH

---

### AC-028: Service Rollback

**Given** Phase 1, 2, or 3 has been deployed
**When** a critical bug is discovered that requires rollback
**Then** the previous version can be deployed within 5 minutes
**And** the rollback does not require database changes
**And** the system operates correctly after rollback

**Test Type**: Disaster Recovery
**Priority**: HIGH

---

## Test Execution Summary

### Test Categories

| Category | Count | Priority |
|----------|-------|----------|
| Admin Server | 5 | HIGH |
| API Server | 5 | HIGH |
| MCP Server | 3 | MEDIUM |
| Landing Page | 2 | LOW |
| Documentation | 3 | MEDIUM |
| Cross-Service | 3 | MEDIUM |
| Security | 3 | HIGH |
| Performance | 2 | MEDIUM |
| Rollback | 2 | HIGH |

**Total Acceptance Criteria**: 28

### Testing Strategy

**Unit Tests**: Validate individual functions and methods
**Integration Tests**: Validate service endpoints and database interactions
**End-to-End Tests**: Validate complete user workflows
**Performance Tests**: Validate latency targets under load
**Security Tests**: Validate vulnerability resistance
**Resilience Tests**: Validate graceful degradation and rollback

### Definition of Done

Each acceptance criterion is considered complete when:
- Automated test exists and passes
- Test is documented in test suite
- Code review approved
- Performance targets met (if applicable)
- Security review passed (if applicable)

---

**Owner**: Quality Assurance Team
**Review Cycle**: Each phase completion
**Status**: Ready for Test Implementation
