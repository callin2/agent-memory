# Automated Memory Consolidation

## Overview

The Agent Memory System includes automated memory consolidation inspired by human memory consolidation during sleep. This system compresses large amounts of session data into manageable reflections while preserving important insights.

## How It Works

### Human Memory Consolidation (Research Basis)

Research shows that human brains consolidate memories during sleep through:

1. **Replay**: Neural circuits reactivate recent experiences
2. **Integration**: New memories connect to existing knowledge
3. **Compression**: Details fade, patterns emerge
4. **Prioritization**: Important memories strengthen (hippocampal-neocortical transfer)

### Our Implementation

The system replicates this process using LLM-based reflection:

```
Raw Sessions → Salient Questions → Insights → Compressed Reflection
```

## Consolidation Schedules

### Daily Consolidation (Quick)
- **Schedule**: 2:00 AM UTC every day
- **Scope**: Last 24 hours
- **Max Sessions**: ~100
- **Compression Level**: `summary` (~500 tokens)
- **Purpose**: Quick digest of recent activity

### Weekly Consolidation (Deep)
- **Schedule**: 3:00 AM UTC every Sunday
- **Scope**: Last 7 days
- **Max Sessions**: ~700
- **Compression Level**: `quick_ref` (~100 tokens)
- **Purpose**: Weekly summary, pattern detection

### Monthly Consolidation (Identity)
- **Schedule**: 4:00 AM UTC on 1st of month
- **Scope**: All sessions
- **Max Sessions**: ~10,000 (unlimited)
- **Compression Level**: `integrated` (merged into principles)
- **Purpose**: Identity evolution tracking, long-term patterns

## Configuration

### Enable/Disable Scheduler

```bash
# .env
CONSOLIDATION_SCHEDULER_ENABLED=true  # Default: enabled
```

### Modify Schedules

Edit `src/services/consolidation/scheduler.ts`:

```typescript
const SCHEDULES: Record<ConsolidationType, ConsolidationSchedule> = {
  daily: {
    type: 'daily',
    cron: '0 2 * * *', // 2:00 AM daily
    // Modify cron expression as needed
  },
  // ...
};
```

## Manual Consolidation

You can trigger consolidation manually via API:

```bash
# Trigger daily consolidation
curl -X POST http://localhost:3456/api/v1/consolidation/trigger/daily \
  -H "X-API-Key: ak_your_key"

# Trigger weekly consolidation
curl -X POST http://localhost:3456/api/v1/consolidation/trigger/weekly \
  -H "X-API-Key: ak_your_key"

# Trigger monthly consolidation
curl -X POST http://localhost:3456/api/v1/consolidation/trigger/monthly \
  -H "X-API-Key: ak_your_key"
```

## Consolidation Process

### 1. Data Collection

```sql
SELECT handoff_id, tenant_id, experienced, noticed, learned, becoming, significance, tags
FROM session_handoffs
WHERE created_at >= :cutoffDate
  AND compression_level = 'full'
ORDER BY created_at DESC
LIMIT :maxSessions
```

### 2. Generate Reflection

Using LLM-based `ReflectionService`:

1. **Generate Salient Questions**: "What are the 3-5 most important patterns?"
2. **Answer Questions**: Extract insights from observations
3. **Identify Themes**: Tag common topics
4. **Track Identity**: Synthesize "becoming" evolution
5. **Compress Summary**: ~200 token summary

### 3. Store Reflection

```sql
INSERT INTO memory_reflections (
  tenant_id,
  period_start,
  period_end,
  session_count,
  summary,
  key_insights,
  themes,
  identity_evolution
)
VALUES (:tenantId, :periodStart, :periodEnd, :sessionCount, ...)
```

### 4. Mark Sessions Consolidated

```sql
UPDATE session_handoffs
SET compression_level = :level,    -- summary/quick_ref/integrated
    consolidated_at = NOW(),
    integrated_into = :reflectionId
WHERE handoff_id IN (:handoffIds)
```

## Compression Levels

| Level | Token Count | Description | Use Case |
|-------|-------------|-------------|----------|
| `full` | ~800 | Complete session data | Recent sessions |
| `summary` | ~500 | Compressed summary | Daily consolidation |
| `quick_ref` | ~100 | Key points only | Weekly consolidation |
| `integrated` | ~50 | Merged into principles | Monthly consolidation |

## Token Savings

### Before Consolidation
- 100 sessions × 800 tokens = **80,000 tokens**

### After Daily Consolidation
- 1 reflection × 200 tokens = **200 tokens**
- Compression: **400×** (99.75% reduction)

### After Weekly Consolidation
- 1 reflection × 200 tokens + 100 summaries × 500 tokens = **50,200 tokens**
- Compression: **1.6×** from daily

### After Monthly Consolidation
- Identity principles only (~50-100 tokens)
- Compression: **800-1,600×** from original

## Monitoring

### Check Consolidation Status

```bash
curl http://localhost:3456/api/v1/consolidation/status \
  -H "X-API-Key: ak_your_key"
```

Response:

```json
{
  "enabled": true,
  "jobs": ["daily", "weekly", "monthly"],
  "schedules": {
    "daily": {
      "type": "daily",
      "cron": "0 2 * * *",
      "description": "Quick consolidation of last 24h sessions",
      "maxSessions": 100
    },
    // ...
  }
}
```

### View Consolidation Jobs

```sql
SELECT
  job_id,
  job_type,
  status,
  items_processed,
  items_affected,
  started_at,
  completed_at,
  error_message
FROM consolidation_jobs
ORDER BY started_at DESC
LIMIT 20;
```

### View Reflections

```sql
SELECT
  reflection_id,
  tenant_id,
  period_start,
  period_end,
  session_count,
  summary,
  key_insights,
  themes,
  identity_evolution,
  generated_at
FROM memory_reflections
ORDER BY generated_at DESC;
```

## Performance Impact

### Database Load

- **Daily**: ~100 sessions in ~10-30 seconds
- **Weekly**: ~700 sessions in ~2-5 minutes
- **Monthly**: ~10,000 sessions in ~20-60 minutes

### LLM API Costs

Assuming 1K tokens per session:
- Daily: 100K tokens in, 200 tokens out = **~$0.20**
- Weekly: 700K tokens in, 200 tokens out = **~$1.40**
- Monthly: 10M tokens in, 200 tokens out = **~$20.00**

*Costs vary by provider (z.ai, OpenAI, Anthropic)*

### Recommendations

1. **Schedule During Low Traffic**: 2-4 AM UTC
2. **Monitor Duration**: If jobs take too long, reduce `maxSessions`
3. **Rate Limiting**: Use queue system (Bull) for production
4. **Error Handling**: Failed jobs are logged but don't block system

## Troubleshooting

### Scheduler Not Starting

```bash
# Check environment variable
echo $CONSOLIDATION_SCHEDULER_ENABLED

# Check logs
tail -f logs/consolidation.log
```

### Jobs Failing

```sql
-- Check failed jobs
SELECT * FROM consolidation_jobs
WHERE status = 'failed'
ORDER BY started_at DESC;

-- View error messages
SELECT error_message, started_at
FROM consolidation_jobs
WHERE status = 'failed';
```

### Reflections Not Generated

1. Check LLM client configuration
2. Verify API key is valid
3. Check tenant_id matches
4. Review logs for errors

## Advanced Usage

### Custom Consolidation Types

Add new consolidation type in `scheduler.ts`:

```typescript
const SCHEDULES: Record<ConsolidationType, ConsolidationSchedule> = {
  // ... existing types
  quarterly: {
    type: 'quarterly',
    cron: '0 5 1 */3 *', // 5:00 AM on 1st of quarter
    description: 'Quarterly review',
    maxSessions: 30000,
  },
};
```

### Multi-Instance Deployment

For production with multiple instances:

1. Use **Bull queue** instead of node-cron
2. Only one scheduler should run (leader election)
3. Use Redis for distributed locking

```bash
npm install bull @types/bull
```

Example:

```typescript
import Queue from 'bull';

const consolidationQueue = new Queue('consolidation', {
  redis: { port: 6379 }
});

// Add scheduled jobs
consolidationQueue.add(
  { type: 'daily' },
  { repeat: { cron: '0 2 * * *' } }
);

// Process jobs
consolidationQueue.process(async (job) => {
  await runConsolidation(job.data.type);
});
```

## Research References

- **Sleep & Memory Consolidation**: [Diekelmann & Born (2010)](https://www.nature.com/articles/nrn2863)
- **Generative Agents**: [Park et al. (2023)](https://arxiv.org/abs/2304.03442)
- **Hippocampal-Neocortical Transfer**: [Buzsáki (2015)](https://www.annualreviews.org/doi/10.1146/annurev-neuro-071714-033729)

## Future Enhancements

- [ ] Adaptive scheduling (trigger based on session count, not time)
- [ ] Priority consolidation (high-significance sessions first)
- [ ] Incremental consolidation (don't re-consolidate already compressed)
- [ ] Cross-tenant pattern detection (aggregate insights)
- [ ] Forgetting curve integration (decay old, unused data)
- [ ] Vector embeddings for semantic similarity search
