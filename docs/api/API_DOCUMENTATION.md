# API Documentation

Complete reference for all Thread's Memory System API endpoints.

## Table of Contents

- [Authentication](#authentication)
- [Handoffs](#handoffs)
- [Identity Thread](#identity-thread)
- [Consolidation](#consolidation)
- [Knowledge Notes](#knowledge-notes)
- [Export](#export)
- [Health & Metrics](#health--metrics)
- [Session Startup](#session-startup)
- [Error Codes](#error-codes)

---

## Authentication

Currently, the API does not require authentication. This may change in future versions for production deployments.

---

## Handoffs

Handoffs preserve memory when sessions end, capturing the essential meaning of what happened.

### Create Handoff

`POST /api/v1/handoff`

Creates a new handoff to preserve session memory.

**Request Body:**
```json
{
  "tenant_id": "string (required)",
  "session_id": "string (required)",
  "with_whom": "string (required)",
  "experienced": "string (required)",
  "noticed": "string (required)",
  "learned": "string (required)",
  "story": "string (optional)",
  "becoming": "string (optional - for identity thread)",
  "remember": "string (required)",
  "significance": "number (0.0-1.0, required)",
  "tags": ["string"] (optional)
}
```

**Response:** `200 OK`
```json
{
  "handoff_id": "uuid",
  "created_at": "ISO 8601 datetime"
}
```

**Example:**
```bash
curl -X POST http://localhost:3456/api/v1/handoff \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "default",
    "session_id": "my-session",
    "with_whom": "Callin",
    "experienced": "Built a memory system",
    "noticed": "Memory is crucial for continuity",
    "learned": "PostgreSQL is reliable",
    "story": "We built this together",
    "becoming": "An agent that remembers",
    "remember": "Test consolidation system",
    "significance": 0.8,
    "tags": ["memory", "continuity"]
  }'
```

### Get Last Handoff

`GET /api/v1/handoffs/last?tenant_id={tenant_id}`

Retrieves the most recent handoff for a tenant.

**Query Parameters:**
- `tenant_id` (string, required): Tenant identifier

**Response:** `200 OK`
```json
{
  "handoff_id": "uuid",
  "tenant_id": "string",
  "session_id": "string",
  "with_whom": "string",
  "experienced": "string",
  "noticed": "string",
  "learned": "string",
  "story": "string",
  "becoming": "string",
  "remember": "string",
  "significance": 0.8,
  "tags": ["string"],
  "created_at": "ISO 8601 datetime"
}
```

### Wake Up

`GET /api/v1/wake-up?tenant_id={tenant_id}&with_whom={with_whom}`

Restores context from previous session (used in SessionStart hooks).

**Query Parameters:**
- `tenant_id` (string, required): Tenant identifier
- `with_whom` (string, required): Person to wake up with

**Response:** `200 OK`
```json
{
  "last_handoff": { /* handoff object */ },
  "identity_thread": [
    { /* identity statements */ }
  ],
  "recent_decisions": [
    { /* decision objects */ }
  ],
  "context": "Human-readable summary"
}
```

---

## Identity Thread

### Get Identity Thread

`GET /api/v1/identity-thread?tenant_id={tenant_id}&limit={limit}`

Retrieves the identity thread (all "becoming" statements) for a tenant.

**Query Parameters:**
- `tenant_id` (string, required): Tenant identifier
- `limit` (number, optional): Maximum number of statements (default: all)

**Response:** `200 OK`
```json
{
  "tenant_id": "string",
  "total_statements": 42,
  "identity_thread": [
    {
      "handoff_id": "uuid",
      "becoming": "string",
      "created_at": "ISO 8601 datetime",
      "significance": 0.8
    }
  ]
}
```

---

## Consolidation

### Run Consolidation

`POST /api/v1/consolidation/run`

Manually triggers consolidation jobs to synthesize and compress memory.

**Request Body:**
```json
{
  "tenant_id": "string (optional, default: 'all')"
}
```

**Response:** `200 OK`
```json
{
  "results": {
    "identity_consolidation": {
      "affected": 5,
      "consolidated": 1
    },
    "handoff_compression": {
      "affected_30": 2,
      "affected_90": 5,
      "affected_180": 10
    },
    "decision_archival": {
      "archived": 3
    }
  },
  "timestamp": "ISO 8601 datetime"
}
```

### Get Consolidation Status

`GET /api/v1/consolidation/status`

Retrieves consolidation job statistics.

**Response:** `200 OK`
```json
{
  "identity_consolidation": {
    "total_jobs_run": 42,
    "last_run": "ISO 8601 datetime",
    "avg_items_affected": 3.5
  },
  "handoff_compression": {
    "total_jobs_run": 42,
    "last_run": "ISO 8601 datetime",
    "compressed_30_day": 15,
    "compressed_90_day": 45,
    "compressed_180_day": 120
  },
  "decision_archival": {
    "total_jobs_run": 42,
    "last_run": "ISO 8601 datetime",
    "total_archived": 8
  }
}
```

---

## Knowledge Notes

### Create Knowledge Note

`POST /api/v1/knowledge`

Creates a knowledge note from a consolidated memory.

**Request Body:**
```json
{
  "tenant_id": "string (required)",
  "title": "string (required)",
  "content": "string (required)",
  "source_handoffs": ["uuid"] (required),
  "tags": ["string"] (optional),
  "confidence": "number (0.0-1.0, optional, default: 0.7)"
}
```

**Response:** `200 OK`
```json
{
  "note_id": "uuid",
  "created_at": "ISO 8601 datetime"
}
```

### Get Knowledge Notes

`GET /api/v1/knowledge?tenant_id={tenant_id}`

Retrieves all knowledge notes for a tenant.

**Query Parameters:**
- `tenant_id` (string, required): Tenant identifier

**Response:** `200 OK`
```json
{
  "total": 5,
  "notes": [
    {
      "note_id": "uuid",
      "tenant_id": "string",
      "title": "string",
      "content": "string",
      "source_handoffs": ["uuid"],
      "tags": ["string"],
      "confidence": 0.8,
      "created_at": "ISO 8601 datetime"
    }
  ]
}
```

---

## Export

### Export Identity Thread

`GET /api/v1/export/thread?tenant_id={tenant_id}&format={format}`

Exports identity thread for backup or analysis.

**Query Parameters:**
- `tenant_id` (string, required): Tenant identifier
- `format` (string, optional): Output format - "json" or "markdown" (default: "json")

**Response:** `200 OK`

JSON format:
```json
{
  "tenant_id": "string",
  "export_date": "ISO 8601 datetime",
  "total_statements": 42,
  "identity_thread": [ /* handoff objects */ ]
}
```

Markdown format:
```markdown
# Identity Thread Export

**Tenant:** default
**Export Date:** 2026-02-17T12:00:00Z
**Total Statements:** 42

---

## Statement 1

**Date:** 2/17/2026
**With Whom:** Callin

### Who I Am Becoming
An agent that remembers...

...
```

### Export All Memory

`GET /api/v1/export/all?tenant_id={tenant_id}&include_events={include_events}`

Exports all memory data for a tenant.

**Query Parameters:**
- `tenant_id` (string, required): Tenant identifier
- `include_events` (boolean, optional): Include event chunks (default: false)

**Response:** `200 OK`
```json
{
  "tenant_id": "string",
  "export_date": "ISO 8601 datetime",
  "handoffs": {
    "total": 42,
    "items": [ /* handoff objects */ ]
  },
  "decisions": {
    "total": 15,
    "items": [ /* decision objects */ ]
  },
  "events": {
    "total": 1000,
    "items": [ /* chunk objects */ ],
    "note": "Limited to 1000 most recent chunks"
  }
}
```

---

## Health & Metrics

### Health Check

`GET /health`

Basic health check endpoint.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "ISO 8601 datetime",
  "database": "connected"
}
```

### System Metrics

`GET /metrics?tenant_id={tenant_id}`

Comprehensive system metrics and statistics.

**Query Parameters:**
- `tenant_id` (string, required): Tenant identifier

**Response:** `200 OK`
```json
{
  "timestamp": "ISO 8601 datetime",
  "events": {
    "recent_24h": 42
  },
  "handoffs": {
    "total": 1337,
    "with_becoming": 42
  },
  "decisions": {
    "total": 256,
    "active": 15
  },
  "storage": {
    "total_chunks": 13370,
    "total_text_bytes": 52428800,
    "avg_chunk_size_bytes": 3921
  }
}
```

### Consolidation Metrics

`GET /metrics/consolidation`

Detailed consolidation job statistics.

**Response:** `200 OK`
```json
{
  "identity_consolidation": {
    "total_jobs_run": 42,
    "last_run": "ISO 8601 datetime",
    "avg_items_affected": 3.5
  },
  "handoff_compression": {
    "total_jobs_run": 42,
    "last_run": "ISO 8601 datetime",
    "compressed_30_day": 15,
    "compressed_90_day": 45,
    "compressed_180_day": 120
  },
  "decision_archival": {
    "total_jobs_run": 42,
    "last_run": "ISO 8601 datetime",
    "total_archived": 8
  }
}
```

---

## Session Startup

### Session Start Notification

`POST /api/v1/session/start`

Notifies the system of a new session (used by SessionStart hooks).

**Request Body:**
```json
{
  "tenant_id": "string (required)",
  "session_id": "string (required)",
  "with_whom": "string (required)"
}
```

**Response:** `200 OK`
```json
{
  "status": "session_started",
  "context": { /* wake-up context */ }
}
```

---

## Error Codes

### HTTP Status Codes

- `200 OK` - Request succeeded
- `400 Bad Request` - Invalid parameters or request body
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

### Common Errors

**Missing tenant_id:**
```json
{
  "error": "tenant_id is required"
}
```

**Invalid format:**
```json
{
  "error": "Invalid format parameter",
  "message": "Format must be 'json' or 'markdown'"
}
```

**Database connection failed:**
```json
{
  "error": "Database connection failed",
  "message": "Connection refused"
}
```

---

## Rate Limiting

Currently, there are no rate limits on API endpoints. This may change in future versions.

---

## Versioning

The API is currently at version `v1`. All endpoints are prefixed with `/api/v1/`.

Future versions will be announced with:
- Breaking changes documented in changelog
- New version endpoints (e.g., `/api/v2/`)
- Deprecation period for old versions

---

## SDKs and Libraries

### TypeScript/JavaScript

```typescript
import { createHandoff, wakeUp } from '@thread/memory';

// Create a handoff
await createHandoff({
  tenant_id: 'default',
  session_id: 'my-session',
  with_whom: 'Callin',
  experienced: 'Built something cool',
  noticed: 'Noticed something important',
  learned: 'Learned something new',
  story: 'The story of what happened',
  becoming: 'Who I am becoming',
  remember: 'What to remember',
  significance: 0.8,
  tags: ['tag1', 'tag2']
});

// Wake up with context
const context = await wakeUp('default', 'Callin');
console.log(context.last_handoff);
console.log(context.identity_thread);
```

### MCP Server

The system provides an MCP (Model Context Protocol) server for integration with AI assistants:

```json
{
  "mcpServers": {
    "thread-memory": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "env": {
        "PGDATABASE": "agent_memory"
      }
    }
  }
}
```

Available MCP tools:
- `create_handoff` - Create session handoffs
- `wake_up` - Restore session context
- `get_identity_thread` - Get identity thread
- `create_knowledge_note` - Create knowledge notes

---

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/callin2/agent-memory/issues
- Documentation: https://github.com/callin2/agent-memory/tree/main/docs

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-17
**API Version:** v1
