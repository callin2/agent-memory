# Memory Capsules System

## Overview

Memory capsules are **curated collections of memory items** (chunks, decisions, artifacts) created for specific purposes or audiences. Unlike handoffs which capture session meaning, capsules proactively organize memory for sharing and reuse.

## Use Cases

1. **Onboarding** - Curate essential knowledge for new agents
2. **Project Handoff** - Package project context for team transitions
3. **Policy Reference** - Organize decisions around specific policies
4. **Knowledge Sharing** - Share insights across agents or teams

## Capsule Structure

```typescript
interface Capsule {
  capsule_id: string;          // Unique identifier
  tenant_id: string;          // Tenant owner
  scope: 'session' | 'user' | 'project' | 'policy' | 'global';
  subject_type: string;       // What the capsule is about
  subject_id: string;         // ID of the subject
  project_id?: string;        // Project (if scope=project)
  author_agent_id: string;    // Creator
  audience_agent_ids: string[]; // Who can access this capsule
  ttl_days: number;           // Time-to-live (default: 7 days)
  status: 'active' | 'revoked' | 'expired';
  items: {
    chunks: string[];         // Chunk IDs
    decisions: string[];      // Decision IDs
    artifacts: string[];      // Artifact IDs
  };
  risks: string[];            // Privacy/security risks
  created_at: Date;
  expires_at: Date;
}
```

## Creating Capsules

### Example 1: Project Onboarding Capsule

**Scenario:** New agent joining a project

```typescript
const capsule = await capsuleService.createCapsule({
  tenant_id: 'default',
  author_agent_id: 'thread-agent-1',
  subject_type: 'project',
  subject_id: 'project-123',
  scope: 'project',
  project_id: 'project-123',
  audience_agent_ids: ['new-agent-2', 'new-agent-3'],
  ttl_days: 30,
  items: {
    chunks: [
      'chunk-project-overview',
      'chunk-key-decisions',
      'chunk-team-structure'
    ],
    decisions: [
      'decision-architecture',
      'decision-tech-stack'
    ],
    artifacts: []
  },
  risks: ['contains-internal-documentation']
});
```

### Example 2: Policy Reference Capsule

**Scenario:** All decisions about data privacy

```typescript
const privacyCapsule = await capsuleService.createCapsule({
  tenant_id: 'default',
  author_agent_id: 'compliance-agent',
  subject_type: 'policy',
  subject_id: 'data-privacy',
  scope: 'global',
  audience_agent_ids: ['all'],  // All agents
  ttl_days: 365,  // Long-lived
  items: {
    chunks: [],
    decisions: [
      'decision-gdpr-compliance',
      'decision-data-retention',
      'decision-encryption-policy'
    ],
    artifacts: ['doc-privacy-policy']
  },
  risks: []
});
```

## Retrieving Capsules

### For a Specific Agent

```typescript
const capsules = await capsuleService.getAvailableCapsules(
  'default',           // tenant_id
  'thread-agent-1',    // agent_id
  'project',           // subject_type filter
  'project-123'        // subject_id filter
);
```

### Returns

Capsules that are:
- **Active** (not revoked or expired)
- **Accessible** to this agent (in audience_agent_ids)
- **Relevant** (matches subject_type/subject_id if provided)

## Capsule Scopes

| Scope | Description | Example |
|-------|-------------|---------|
| `session` | Single session context | Meeting summary |
| `user` | Individual user's memory | Personal notes |
| `project` | Project-specific | Project onboarding |
| `policy` | Policy-related | Compliance decisions |
| `global` | Organization-wide | Company policies |

## Time-to-Live (TTL)

Capsules automatically expire after `ttl_days`. Default is **7 days**.

```typescript
// Short-lived capsule (1 day)
ttl_days: 1

// Long-lived capsule (90 days)
ttl_days: 90

// Permanent (until revoked)
ttl_days: 36500  // ~100 years
```

## Revocation

Capsules can be revoked before they expire:

```typescript
await capsuleService.revokeCapsule(capsule_id, reason);
```

Use cases:
- Information becomes outdated
- Security concern discovered
- Policy changes

## Privacy & Security

### Risk Flagging

Capsules can include risk flags:

```typescript
risks: [
  'contains-pii',              // Personal data
  'contains-internal-docs',     // Internal documentation
  'contains-confidential',      // Confidential information
  'contains-security-issues'    // Security vulnerabilities
]
```

### Audience Control

Only agents in `audience_agent_ids` can retrieve capsules.

```typescript
// Single agent
audience_agent_ids: ['agent-1']

// Multiple agents
audience_agent_ids: ['agent-1', 'agent-2', 'agent-3']

// All agents (use with caution)
audience_agent_ids: ['all']
```

## Use Cases by Scope

### Session Capsules
**Purpose:** Share session context with team
```typescript
{
  scope: 'session',
  subject_id: 'daily-standup-2026-02-17',
  audience_agent_ids: ['team-lead', 'product-manager'],
  ttl_days: 7
}
```

### Project Capsules
**Purpose:** Onboarding agents to projects
```typescript
{
  scope: 'project',
  subject_id: 'project-alpha',
  audience_agent_ids: ['new-hire-1', 'new-hire-2'],
  ttl_days: 30
}
```

### Policy Capsules
**Purpose:** Policy compliance reference
```typescript
{
  scope: 'policy',
  subject_id: 'data-privacy',
  audience_agent_ids: ['all'],
  ttl_days: 365
}
```

## Best Practices

1. **Set appropriate TTL** - Don't keep capsules longer than needed
2. **Curate carefully** - Only include relevant, high-quality items
3. **Document risks** - Flag privacy/security concerns
4. **Limit audience** - Only share with agents who need it
5. **Review regularly** - Revoke outdated capsules
6. **Use meaningful subjects** - Clear subject_type and subject_id

## API Endpoints

### Create Capsule
```
POST /api/v1/capsules
```

### Get Available Capsules
```
GET /api/v1/capsules?tenant_id={id}&agent_id={id}
```

### Revoke Capsule
```
POST /api/v1/capsules/{id}/revoke
```

## Related Features

- **Handoffs** - Capture session meaning (automatic)
- **Consolidation** - Synthesize knowledge (automatic)
- **Knowledge Notes** - Long-term insights (automatic)
- **Capsules** - Curate collections (manual)

Capsules are the **manual** complement to automatic memory systems. They provide intentional organization for specific purposes.

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-17
