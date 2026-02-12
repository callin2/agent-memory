# Capsule Transfer System Guide

Complete guide to using Capsules for agent-to-agent memory sharing in the Agent Memory System.

## Overview

Capsules are time-bounded, curated memory packages that enable agents to share context about specific subjects with other agents.

**Key Features**:
- **Audience Control**: Restrict access to specific agent IDs
- **TTL Expiration**: Automatic expiry after configured days
- **Subject Targeting**: Scoped to specific subjects (users, projects, etc.)
- **Risk Metadata**: Document considerations and warnings
- **Curated Content**: Bundle chunks, decisions, and artifacts

## When to Use Capsules

### Use Capsules When:

1. **Handoff Scenarios**: Agent A completes work and transfers context to Agent B
2. **Subject Expertise**: Share specialized knowledge about specific users/projects
3. **Context Packaging**: Curate relevant memory for specific tasks
4. **Time-Bounded Access**: Temporary access with automatic expiration
5. **Risk Awareness**: Need to document risks and considerations

### Don't Use Capsules For:

- Permanent memory storage (use normal memory operations)
- Public information (use global scope memory)
- Single-chunk transfers (direct chunk references more efficient)
- High-frequency updates (capsules have overhead)

## Creating Capsules

### Basic Capsule Creation

```bash
curl -X POST http://localhost:3000/api/v1/capsules \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_agent_id": "agent-support-lead",
    "subject_type": "user",
    "subject_id": "user-jack-doe",
    "scope": "user",
    "audience_agent_ids": ["agent-support-2", "agent-billing"],
    "items": {
      "chunks": ["chk_abc123", "chk_def456", "chk_ghi789"],
      "decisions": ["dec_resolution_1"],
      "artifacts": []
    },
    "ttl_days": 7,
    "risks": [
      "Customer has elevated support tier",
      "Recent complaint about billing",
      "Prefers email communication over phone"
    ]
  }'
```

Response:
```json
{
  "capsule_id": "cap_xyz789",
  "status": "active",
  "expires_at": "2026-02-17T00:00:00Z"
}
```

### Project Context Capsule

```bash
curl -X POST http://localhost:3000/api/v1/capsules \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_agent_id": "agent-architect",
    "subject_type": "project",
    "subject_id": "project-microservices",
    "scope": "project",
    "project_id": "project-microservices",
    "audience_agent_ids": ["agent-dev-lead", "agent-senior-dev"],
    "items": {
      "chunks": [
        "chk_arch_decision_1",
        "chk_api_design_2",
        "chk_db_schema_3"
      ],
      "decisions": ["dec_use_postgres", "dec_microservice_boundary"],
      "artifacts": ["art_arch_diagram_1"]
    },
    "ttl_days": 30,
    "risks": [
      "API contracts still evolving",
      "Database schema may change",
      "Performance testing incomplete"
    ]
  }'
```

### Session Handoff Capsule

```bash
curl -X POST http://localhost:3000/api/v1/capsules \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_agent_id": "agent-sales-lead",
    "subject_type": "session",
    "subject_id": "session_urgent_deal",
    "scope": "session",
    "audience_agent_ids": ["agent-sales-closing"],
    "items": {
      "chunks": ["chk_customer_needs", "chk_pricing_discussion"],
      "decisions": ["dec_discount_approved"],
      "artifacts": ["art_proposal_draft"]
    },
    "ttl_days": 3,
    "risks": [
      "Competitor bidding on same deal",
      "Customer price sensitive",
      "Deal closes this Friday"
    ]
  }'
```

## Managing Audience

### Adding Multiple Agents

```bash
"audience_agent_ids": [
  "agent-support-tier1",
  "agent-support-tier2",
  "agent-billing-specialist",
  "agent-manager-escalation"
]
```

### Team-Level Access

For team-wide access, create capsules with team agent IDs:

```bash
"audience_agent_ids": [
  "engineering_team_agent",
  "product_team_agent",
  "design_team_agent"
]
```

### Individual Agent Access

For specific agent handoffs:

```bash
"audience_agent_ids": ["agent-specific-replacement"]
```

## TTL and Expiration

### Short-Term Capsules (Hours to Days)

```bash
"ttl_days": 1  # Expires in 24 hours
```

Use cases:
- Urgent handoffs
- Time-sensitive context
- Temporary access grants

### Medium-Term Capsules (Weeks)

```bash
"ttl_days": 7  # Expires in 1 week
"ttl_days": 14  # Expires in 2 weeks
```

Use cases:
- Project onboarding
- Subject expertise transfer
- Training scenarios

### Long-Term Capsules (Months)

```bash
"ttl_days": 30  # Expires in 1 month
"ttl_days": 90  # Expires in 3 months
```

Use cases:
- Long-running projects
- Strategic context sharing
- Organizational knowledge transfer

## Querying Capsules

### Get Available Capsules for Agent

```bash
curl -X GET "http://localhost:3000/api/v1/capsules?agent_id=agent-support-2&subject_type=user&subject_id=user-jack-doe" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Response:
```json
{
  "capsules": [
    {
      "capsule_id": "cap_xyz789",
      "author_agent_id": "agent-support-lead",
      "subject_type": "user",
      "subject_id": "user-jack-doe",
      "scope": "user",
      "status": "active",
      "created_at": "2026-02-10T10:00:00Z",
      "expires_at": "2026-02-17T10:00:00Z"
    }
  ],
  "count": 1
}
```

### Get Capsule Details

```bash
curl -X GET "http://localhost:3000/api/v1/capsules/cap_xyz789?agent_id=agent-support-2" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Response:
```json
{
  "capsule_id": "cap_xyz789",
  "author_agent_id": "agent-support-lead",
  "subject_type": "user",
  "subject_id": "user-jack-doe",
  "scope": "user",
  "status": "active",
  "created_at": "2026-02-10T10:00:00Z",
  "expires_at": "2026-02-17T10:00:00Z",
  "audience_agent_ids": ["agent-support-2", "agent-billing"],
  "items": {
    "chunks": [
      {
        "chunk_id": "chk_abc123",
        "text": "Customer prefers email communication...",
        "importance": 0.8
      }
    ],
    "decisions": [
      {
        "decision_id": "dec_resolution_1",
        "decision": "Offer partial refund for service interruption"
      }
    ],
    "artifacts": []
  },
  "risks": [
    "Customer has elevated support tier",
    "Recent complaint about billing"
  ]
}
```

## Using Capsules in ACB Building

Capsules are automatically included when building Active Context Bundles:

```bash
curl -X POST http://localhost:3000/api/v1/acb/build \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session_xyz",
    "agent_id": "agent-support-2",
    "channel": "private",
    "intent": "customer_support",
    "query_text": "Customer support history for Jack Doe",
    "include_capsules": true,
    "max_tokens": 65000
  }'
```

The ACB will include:
1. Relevant chunks from FTS search
2. Active decisions
3. **Available capsules** for this agent
4. Recent window

## Revoking Capsules

### Manual Revocation

```bash
curl -X DELETE http://localhost:3000/api/v1/capsules/cap_xyz789 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp"
  }'
```

Response:
```json
{
  "capsule_id": "cap_xyz789",
  "status": "revoked",
  "revoked_at": "2026-02-10T15:30:00Z"
}
```

### Automatic Expiration

Capsules expire automatically based on TTL:

- **Expiration Check**: Scheduled job runs periodically
- **Status Change**: `active` → `expired`
- **Access Denied**: Expired capsules inaccessible to all agents
- **Audit Trail**: Expiration timestamp recorded

## Risk Documentation

Always document relevant risks and considerations:

### Customer Relationship Risks

```json
"risks": [
  "VIP customer - requires careful handling",
  "Previous billing dispute - be empathetic",
  "Legal department involved - consult before commitments"
]
```

### Technical Risks

```json
"risks": [
  "API endpoints still in beta - may change",
  "Database migration in progress - schema unstable",
  "Performance testing incomplete - may have issues"
]
```

### Business Risks

```json
"risks": [
  "Competing bid from competitor - price sensitive",
  "Contract renewal pending - retention critical",
  "Executive visibility - high profile"
]
```

## Best Practices

### 1. Keep Capsules Focused

**Good**: Customer onboarding capsule with support history and preferences

**Bad**: Everything we know about everything (too broad, hard to maintain)

### 2. Use Appropriate TTL

**Short TTL** (1-3 days):
- Urgent handoffs
- Time-sensitive context
- Temporary access

**Medium TTL** (7-14 days):
- Project onboarding
- Subject expertise
- Training scenarios

**Long TTL** (30+ days):
- Long-running projects
- Strategic context
- Organizational knowledge

### 3. Document Clear Risks

Provide actionable risk information:

**Good**: "Customer has open legal case - avoid making commitments"

**Bad**: "Be careful"

### 4. Limit Audience

Only include agents that need access:

**Good**: `["agent-billing-specialist"]` for billing handoff

**Bad**: `["agent-*"]` wildcard (not supported, use group agent IDs)

### 5. Regular Cleanup

- Revoke capsules when no longer needed
- Update capsules if context changes significantly
- Don't rely solely on TTL expiration

### 6. Version Control

For evolving context, create new capsule versions:

```
cap_customer_v1 (expired) → cap_customer_v2 (active) → cap_customer_v3 (future)
```

## Common Workflows

### Support Handoff Workflow

1. **Agent A** handles initial support interaction
2. **Agent A** creates capsule with:
   - Customer issue details
   - Troubleshooting steps taken
   - Current status
   - Risks (VIP customer, time sensitivity)
3. **Agent A** assigns to **Agent B** (specialist)
4. **Agent B** queries available capsules
5. **Agent B** builds ACB with capsule context
6. **Agent B** resolves issue
7. **Agent B** revokes capsule (or lets TTL expire)

### Project Onboarding Workflow

1. **Tech Lead** creates project capsule with:
   - Architecture decisions
   - Code style guidelines
   - Testing practices
   - Deployment procedures
   - Risks (API stability, known issues)
2. **New Team Members** query capsules by project
3. **New Team Members** build ACB with project context
4. **Capsule** updated as project evolves
5. **Old capsules** expire or revoked

### Escalation Workflow

1. **Tier 1 Support** handles initial contact
2. **Tier 1** creates escalation capsule with:
   - Issue summary
   - Troubleshooting attempted
   - Customer information
   - Risks (VIP status, legal involved)
3. **Tier 1** escalates to **Tier 2**
4. **Tier 2** receives capsule via query or ACB
5. **Tier 2** resolves and updates capsule with resolution
6. **Tier 2** revokes capsule after resolution documented

## Performance Considerations

### Capsule Size Limits

- **Maximum chunks**: 100 per capsule
- **Maximum decisions**: 50 per capsule
- **Maximum artifacts**: 20 per capsule
- **Maximum audience agents**: 50 per capsule

### Query Performance

- Capsule queries are indexed by `tenant_id`, `subject_type`, `subject_id`
- Audience filtering uses array operations (efficient for < 100 agents)
- Expired capsules excluded from queries automatically

### Storage Impact

- Capsules consume storage proportional to item count
- Consider TTL to manage storage growth
- Revoke unneeded capsules to free metadata

## API Reference

See [API Documentation](README.md#capsules) for complete endpoint reference.

## Related Documentation

- [SPEC-MEMORY-002](../.moai/specs/SPEC-MEMORY-002/spec.md) - Capsule Transfer specification
- [Memory Surgery Guide](MEMORY_SURGERY_GUIDE.md) - Editing and governing memory
- [API Reference](README.md) - Complete API documentation
