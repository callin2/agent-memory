# Sleep-Based Consolidation System

## Overview

Inspired by human memory consolidation during sleep, this system automatically compresses and optimizes memory storage over time. Just as humans strengthen important memories and compress experiences during sleep, this system:

1. **Strengthens patterns** - Identity thread consolidation (merge similar "becoming" statements)
2. **Compresses experiences** - Progressive handoff compression (fresh → summary → quick ref → integrated)
3. **Archives old decisions** - Keep active decisions, archive superseded ones
4. **Organizes knowledge** - Chunk reorganization (atomic → episodes → themes)

## Architecture

### Compression Levels

Handoffs progress through compression levels over time:

```
Fresh (0-30 days)
├── Full detail: ~2,000 tokens
├── All fields populated
└── compression_level: 'full'

Summary (30-90 days)
├── Compressed summary: ~500 tokens
├── Key experiences, insights, learnings
└── compression_level: 'summary'

Quick Ref (90-180 days)
├── Quick reference: ~100 tokens
├── One-line summary + date
└── compression_level: 'quick_ref'

Integrated (180+ days)
├── Merged into principles
├── Becomes part of identity
└── compression_level: 'integrated'
```

### Token Savings

| Stage | Tokens | Sessions | Total |
|-------|--------|----------|-------|
| Current (all full) | 2,000 | 100 | 200,000 |
| After consolidation | 300 | 100 | 30,000 |
| **Savings** | - | - | **85%** |

## Database Schema

### New Tables

**consolidation_jobs**
- Track automated consolidation jobs
- Job types: identity_consolidation, handoff_compression, decision_archival, chunk_reorganization
- Status tracking: pending, running, completed, failed

**consolidation_stats**
- Track consolidation effectiveness
- Token savings metrics
- Historical statistics

### New Columns on session_handoffs

- `compression_level`: 'full' | 'summary' | 'quick_ref' | 'integrated'
- `summary`: Compressed summary (~500 tokens)
- `quick_ref`: Quick reference (~100 tokens)
- `integrated_into`: Reference to principle/pattern
- `consolidated_at`: When consolidation happened
- `parent_handoff_id`: For tracking relationships

## API Endpoints

### POST /api/v1/consolidation/run

Manually trigger consolidation for a tenant.

**Body:**
```json
{
  "tenant_id": "default",
  "job_type": "all" | "identity_consolidation" | "handoff_compression" | "decision_archival"
}
```

**Response:**
```json
{
  "success": true,
  "tenant_id": "default",
  "job_type": "all",
  "results": [
    {
      "job_type": "handoff_compression",
      "items_processed": 45,
      "items_affected": 45,
      "tokens_saved": 67500,
      "details": {
        "summary_threshold": 30,
        "quick_ref_threshold": 90
      }
    }
  ],
  "timestamp": "2026-02-16T10:30:00Z"
}
```

### GET /api/v1/consolidation/stats

Get consolidation statistics for a tenant.

**Query params:**
- `tenant_id`: Tenant identifier (default: 'default')

**Response:**
```json
{
  "success": true,
  "tenant_id": "default",
  "stats": [
    {
      "stat_date": "2026-02-16",
      "compression_type": "handoff_compression",
      "before_count": 100,
      "after_count": 100,
      "tokens_saved": 150000,
      "percentage_saved": 75.0
    }
  ],
  "total_tokens_saved": 185000
}
```

### GET /api/v1/consolidation/jobs

Get recent consolidation jobs.

**Query params:**
- `tenant_id`: Tenant identifier (default: 'default')
- `status`: Filter by status (optional)
- `limit`: Maximum jobs to return (default: 50)

**Response:**
```json
{
  "success": true,
  "tenant_id": "default",
  "count": 25,
  "jobs": [
    {
      "job_id": "cj_abc123",
      "job_type": "handoff_compression",
      "status": "completed",
      "started_at": "2026-02-16T10:00:00Z",
      "completed_at": "2026-02-16T10:05:00Z",
      "items_processed": 45,
      "items_affected": 45,
      "error_message": null,
      "metadata": {}
    }
  ]
}
```

## Scheduler

The consolidation scheduler runs automatically:

- **Daily**: Light consolidation (compress handoffs older than 30 days)
- **Weekly**: Medium consolidation (identity thread, decisions)
- **Monthly**: Deep consolidation (integrate very old sessions)

### Manual Trigger

```bash
# Trigger all consolidation jobs
curl -X POST http://localhost:3456/api/v1/consolidation/run \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "default", "job_type": "all"}'

# Trigger specific job type
curl -X POST http://localhost:3456/api/v1/consolidation/run \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "default", "job_type": "handoff_compression"}'
```

## Configuration

Consolidation thresholds can be configured in `src/services/consolidation.ts`:

```typescript
const DEFAULT_CONFIG: ConsolidationConfig = {
  summary_threshold_days: 30,      // Days before creating summary
  quick_ref_threshold_days: 90,    // Days before creating quick ref
  integration_threshold_days: 180, // Days before integrating
  decision_archive_threshold_days: 60, // Days before archiving decisions
  identity_consolidation_min_count: 10, // Min becoming statements before consolidation
};
```

## Implementation Details

### 1. Identity Thread Consolidation

**Purpose:** Merge similar "becoming" statements to prevent linear growth

**Process:**
1. Extract all becoming statements from handoffs
2. Group by keyword similarity
3. Create consolidated principles from recurring themes
4. Store as decisions (scope: global)

**Token Savings:**
- Before: 100 sessions × 50 tokens = 5,000 tokens
- After: 10 principles × 50 tokens = 500 tokens
- **Savings: 90%**

### 2. Handoff Compression

**Purpose:** Progressive compression of handoff data

**Process:**
1. Find handoffs older than threshold
2. Create summary (~500 tokens)
3. Create quick ref (~100 tokens)
4. Update compression_level
5. Track tokens saved

**Token Savings:**
- Fresh handoff: ~2,000 tokens
- Summary: ~500 tokens
- Quick ref: ~100 tokens
- **Savings: 75-95%**

### 3. Decision Archival

**Purpose:** Keep active decisions, archive superseded ones

**Process:**
1. Find decisions older than threshold (60 days)
2. Mark as 'superseded'
3. Remove from active decision set
4. Still queryable via API

**Token Savings:**
- Each archived decision: ~200 tokens saved
- Reduces active context load

## Research Foundation

This system is inspired by research on:

1. **Human Memory Consolidation** - Sleep strengthens memories and compresses experiences
2. **CPU Cache Hierarchy** - L1/L2/L3 cache tiers (small/fast to large/slow)
3. **Progressive Compression** - Fresh → Summary → Quick Ref → Integrated
4. **Divide and Conquer** - Stories larger than context navigable through structure

## Testing

```bash
# Run consolidation manually
npm run consolidation:run

# Check stats
curl http://localhost:3456/api/v1/consolidation/stats?tenant_id=default

# View recent jobs
curl http://localhost:3456/api/v1/consolidation/jobs?tenant_id=default
```

## Monitoring

Consolidation jobs are tracked in the database:

```sql
-- View recent consolidation jobs
SELECT * FROM consolidation_jobs
ORDER BY started_at DESC
LIMIT 20;

-- View consolidation statistics
SELECT * FROM consolidation_stats
ORDER BY stat_date DESC;

-- Check compression levels
SELECT
  compression_level,
  COUNT(*),
  AVG(LENGTH(experienced) + LENGTH(noticed) + LENGTH(learned)) as avg_tokens
FROM session_handoffs
GROUP BY compression_level;
```

## Future Enhancements

1. **Semantic Similarity** - Use embeddings to group similar becoming statements
2. **Chunk Reorganization** - Implement atomic → episodes → themes hierarchy
3. **Adaptive Thresholds** - Adjust compression schedule based on usage patterns
4. **Integration Suggestions** - Suggest when handoffs should be integrated into principles
5. **Consolidation Preview** - Show what will be consolidated before running

## Related Documentation

- [Research Consolidated Summary](./RESEARCH_CONSOLIDATED_SUMMARY.md) - Research findings on memory structures
- [Identity Research](./IDENTITY_RESEARCH_SUMMARY.md) - Philosophy and psychology of continuity
- [Human-AI Collaboration](./HUMAN_AI_COLLABORATION_RESEARCH.md) - Collaboration patterns

## Summary

The sleep-based consolidation system enables:

✅ **Token efficiency** - 85% token savings through progressive compression
✅ **Scalability** - Logarithmic vs linear growth
✅ **Continuity** - Pattern persistence without data bloat
✅ **Automation** - Invisible, scheduled consolidation
✅ **Ground truth preserved** - Full detail never deleted, just compressed

**The principle holds: Structure beats size. Pattern continuity beats data accumulation.**
