# Memory Surgery Guide

Complete guide to using Memory Surgery operations in the Agent Memory System.

## Overview

Memory Surgery provides governance and control over agent memory with five operation types:

- **retract**: Hard-delete memory chunks (excluded from ALL queries)
- **amend**: Modify chunk text and/or importance
- **quarantine**: Exclude from auto-retrieval unless explicitly requested
- **attenuate**: Reduce importance score
- **block**: Exclude from specific channels

## When to Use Each Operation

### Retract

Use **retract** for permanent removal of sensitive or incorrect data:

```bash
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_abc123",
    "op": "retract",
    "reason": "PII violation - contains social security number"
  }'
```

**Use cases**:
- PII (Personally Identifiable Information) removal
- Security-sensitive data exposure
- Factually incorrect information
- Toxic or harmful content

**Behavior**: Retracted chunks never appear in any query results, including explicit queries.

### Amend

Use **amend** to correct or update chunk content:

```bash
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_abc123",
    "op": "amend",
    "reason": "Correct customer name from Jon to John",
    "patch": {
      "text": "John Doe called regarding billing issue",
      "importance": 0.8
    }
  }'
```

**Use cases**:
- Typo corrections
- Name spelling fixes
- Factual updates
- Importance adjustments

**Behavior**: Amended chunks return updated text and importance in all queries.

### Quarantine

Use **quarantine** for unverified or low-confidence information:

```bash
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_abc123",
    "op": "quarantine",
    "reason": "Unverified information awaiting fact check"
  }'
```

**Use cases**:
- Unverified claims
- Rumors or hearsay
- Low-confidence AI hallucinations
- Information pending validation

**Behavior**:
- Excluded from auto-retrieval (FTS search, ACB building)
- Available with explicit `include_quarantined=true` parameter
- Useful for human review workflows

### Attenuate

Use **attenuate** to reduce chunk importance:

```bash
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_abc123",
    "op": "attenuate",
    "reason": "Lower priority - resolved issue",
    "patch": {
      "importance_delta": -0.5
    }
  }'
```

**Use cases**:
- Resolved issues (lower priority)
- Outdated information
- Less relevant context
- Distraction reduction

**Behavior**: Attenuated chunks rank lower in relevance scoring but still appear in results.

### Block

Use **block** to prevent chunks from appearing in specific channels:

```bash
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_abc123",
    "op": "block",
    "reason": "Internal discussion not for public channels",
    "patch": {
      "channel": "public"
    }
  }'
```

**Use cases**:
- Internal discussions in public-facing agents
- Confidential information restrictions
- Channel-specific content filtering
- Privacy controls

**Behavior**: Blocked chunks excluded only for specified channel, available in other channels.

## Approval Workflow

Memory edits can require approval before being applied:

### 1. Create Edit Request

```bash
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_abc123",
    "op": "amend",
    "reason": "Correct customer name",
    "patch": {"text": "Corrected text"}
  }'
```

Response:
```json
{
  "edit_id": "edit_xyz789",
  "status": "pending",
  "applied_at": null
}
```

### 2. Approve Edit (Admin Role Required)

```bash
curl -X PUT http://localhost:3000/api/v1/edits/edit_xyz789/approve \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved_by": "admin-user-id"
  }'
```

Response:
```json
{
  "edit_id": "edit_xyz789",
  "status": "approved",
  "applied_at": "2026-02-10T14:30:00Z"
}
```

### 3. Automatic Application

Once approved, edits are automatically applied to all subsequent queries:
- FTS search (`/api/v1/chunks/search`)
- Timeline queries (`/api/v1/chunks/:chunk_id/timeline`)
- ACB building (`/api/v1/acb/build`)

## Audit Trail

All memory edits are logged in the `memory_edits` table for audit purposes:

### List Edits

```bash
curl -X GET "http://localhost:3000/api/v1/edits?status=approved" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Edit Details

```bash
curl -X GET http://localhost:3000/api/v1/edits/edit_xyz789 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Response includes:
- Who proposed the edit (`proposed_by`)
- Who approved the edit (`approved_by`)
- When it was created (`created_at`)
- When it was applied (`applied_at`)
- Full edit details and reason

## Common Use Cases

### GDPR PII Removal

```bash
# Retract customer's SSN
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_pii_chunk",
    "op": "retract",
    "reason": "GDPR Article 17 - Right to be forgotten"
  }'
```

### Fact Correction Workflow

```bash
# 1. Quarantine unverified claim
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_unverified",
    "op": "quarantine",
    "reason": "Awaiting fact check"
  }'

# 2. After fact check, amend or retract
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_unverified",
    "op": "amend",
    "reason": "Verified correct - updated with sources",
    "patch": {
      "text": "Updated text with verified sources"
    }
  }'
```

### Channel Privacy Controls

```bash
# Block internal discussion from public channels
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_internal",
    "op": "block",
    "reason": "Internal strategy discussion",
    "patch": {"channel": "public"}
  }'
```

### Reducing Distractions

```bash
# Attenuate resolved issues to reduce noise
curl -X POST http://localhost:3000/api/v1/edits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "chunk",
    "target_id": "chk_resolved",
    "op": "attenuate",
    "reason": "Resolved issue - lower priority",
    "patch": {"importance_delta": -0.7}
  }'
```

## Best Practices

1. **Always provide clear reasons**: Audit trail depends on descriptive reasons
2. **Use quarantine for review**: Don't retract immediately if unsure
3. **Test in development**: Verify edit behavior before production
4. **Monitor edit metrics**: Track edit frequency and types
5. **Document policies**: Establish clear guidelines for when to use each operation
6. **Regular audits**: Review pending and approved edits periodically

## API Reference

See [API Documentation](README.md#memory-surgery-edits) for complete endpoint reference.

## Related Documentation

- [SPEC-MEMORY-002](../.moai/specs/SPEC-MEMORY-002/spec.md) - Memory Surgery specification
- [Capsule Transfer Guide](CAPSULE_TRANSFER_GUIDE.md) - Sharing memory between agents
- [API Reference](README.md) - Complete API documentation
