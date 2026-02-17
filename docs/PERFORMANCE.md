# Performance Guide

This guide helps both humans and AI agents optimize the memory system for performance and efficiency.

## Database Performance

### Connection Pooling

The system uses PostgreSQL connection pooling. Configure pool size based on your load:

```javascript
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'agent_memory',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  max: Number(process.env.PGPOOL_MAX) || 20,  // Increase for high traffic
  min: Number(process.env.PGPOOL_MIN) || 2,   // Keep minimum connections ready
  idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: Number(process.env.PGCONNECTION_TIMEOUT) || 2000,
});
```

**Guidelines:**
- **Development**: `max: 10` is sufficient
- **Production**: Start with `max: 20`, scale based on connection monitoring
- **High Traffic**: Consider `max: 50-100` with PgBouncer

### Indexing

Important indexes are automatically created by migrations:

- `idx_chunks_tenant_ts` - Fast time-based queries
- `idx_chunks_tsv_gin` - Full-text search
- `idx_decisions_tenant_status_ts` - Decision queries
- `idx_session_handoffs_tenant_created` - Handoff retrieval

**Monitor index usage:**
```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'your_schema_name'
ORDER BY idx_scan DESC;
```

### Query Optimization

**Use tenant_id in all queries:**
```javascript
// Good - Uses index
await pool.query(
  'SELECT * FROM chunks WHERE tenant_id = $1 AND ts > $2',
  [tenant_id, timestamp]
);

// Bad - Full table scan
await pool.query(
  'SELECT * FROM chunks WHERE ts > $2',
  [timestamp]
);
```

**Limit result sets:**
```javascript
// Always use LIMIT for large tables
await pool.query(
  'SELECT * FROM chunks WHERE tenant_id = $1 ORDER BY ts DESC LIMIT $2',
  [tenant_id, 100]
);
```

## Consolidation Performance

### Scheduling

Consolidation runs on three schedules:

```javascript
// Daily - Light consolidation (compress handoffs > 30 days)
setInterval(runDailyConsolidation, 24 * 60 * 60 * 1000);

// Weekly - Medium consolidation (identity + decisions)
setInterval(runWeeklyConsolidation, 7 * 24 * 60 * 60 * 1000);

// Monthly - Deep consolidation (old sessions)
// Run manually or via cron
```

**Best Practices:**
- Run heavy consolidation during low-traffic periods
- Monitor consolidation job duration
- Adjust thresholds based on memory growth rate

### Token Savings

Consolidation saves tokens by:

1. **Identity Thread Consolidation**: Merges similar "becoming" statements
   - Requires 10+ similar statements
   - Saves ~50 tokens per merged statement

2. **Handoff Compression**: Progressive compression of old handoffs
   - 30+ days: Summary (~500 tokens)
   - 90+ days: Quick reference (~100 tokens)
   - 180+ days: Integrated into principles

3. **Decision Archival**: Archives old decisions
   - 60+ days old: Mark as superseded
   - Saves ~200 tokens per archived decision

## Memory Usage

### Estimate Memory Requirements

**Per event:**
- Text chunk: ~1-5 KB (depending on content length)
- Metadata: ~500 bytes
- Indexes: ~1-2 KB

**Rule of thumb:** 1,000 events ≈ 5-10 MB storage

**Per handoff:**
- Full detail: ~2-5 KB
- Summary: ~1 KB
- Quick reference: ~200 bytes

### Monitoring Storage

Use the metrics endpoint:
```bash
curl http://localhost:3456/metrics?tenant_id=default
```

Response includes:
```json
{
  "storage": {
    "total_text_bytes": 1048576,
    "total_chunks": 500,
    "avg_chunk_size_bytes": 2097
  }
}
```

## API Performance

### Response Time Optimization

**Use query parameters efficiently:**
```bash
# Good - Specific query
GET /api/v1/handoffs?tenant_id=default&limit=10

# Avoid - Broad query without filters
GET /api/v1/handoffs
```

**Batch operations when possible:**
```javascript
// Instead of multiple requests
for (const handoff of handoffs) {
  await api.createHandoff(handoff);
}

// Use batch (if available)
await api.createHandoffs(handoffs);
```

### Caching

**Wake-up responses change infrequently.** Consider caching:
- Cache key: `{tenant_id}:{with_whom}`
- TTL: 5 minutes
- Invalidate on new handoff creation

**Identity thread changes slowly.** Cache longer:
- Cache key: `{tenant_id}:identity_thread`
- TTL: 1 hour
- Invalidate on consolidation

## Load Testing

### Test Memory System Under Load

```bash
# Using autocannon
npm install -g autocannon

# Test events endpoint
autocannon -c 10 -d 30 http://localhost:3456/api/v1/events

# Test wake-up endpoint
autocannon -c 10 -d 30 http://localhost:3456/api/v1/wake-up?tenant_id=default&with_whom=Callin
```

**Metrics to watch:**
- Requests per second
- Average latency (target: < 100ms for p95)
- Error rate (target: < 0.1%)
- Database connection pool usage

## Scaling Considerations

### Vertical Scaling

**When to scale up:**
- CPU consistently > 70%
- Memory consistently > 80%
- Database connection pool exhausted

**Upgrade path:**
1. Increase database server resources
2. Increase connection pool size
3. Add more index memory (work_mem)

### Horizontal Scaling

**When to scale out:**
- Single server can't handle load
- Need high availability
- Geographic distribution

**Approach:**
1. Use PgBouncer for connection pooling
2. Set up PostgreSQL read replicas
3. Load balance API servers

### Partitioning

**For very large datasets (> 10M events):**

Consider table partitioning by tenant_id or time:
```sql
-- Example: Partition chunks by month
CREATE TABLE chunks_2026_01 PARTITION OF chunks
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

## Performance Checklist

- [ ] Database indexes created and being used
- [ ] Connection pool sized appropriately
- [ ] Consolidation running on schedule
- [ ] Monitoring storage growth rate
- [ ] Caching implemented where appropriate
- [ ] Load testing performed
- [ ] Slow queries identified and optimized
- [ ] Database vacuum/analyze running regularly

## Troubleshooting Performance Issues

### Slow Queries

**Identify slow queries:**
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%chunks%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Solutions:**
- Add missing indexes
- Rewrite queries to use indexes
- Partition large tables
- Archive old data

### High Memory Usage

**Symptoms:** OOM errors, slow swap

**Solutions:**
- Reduce connection pool size
- Increase server memory
- Implement data archival
- Use pagination for large queries

### Database Connection Exhaustion

**Symptoms:** "Connection exhausted" errors

**Solutions:**
- Increase pool max size
- Reduce connection timeout
- Implement connection draining
- Add PgBouncer

## Best Practices

### For Humans

1. **Monitor metrics regularly** - Use `/metrics` endpoint
2. **Run consolidation during off-peak hours**
3. **Archive old data** - Don't keep everything forever
4. **Test before deploying** - Use load testing
5. **Have a scaling plan** - Know when to scale up/out

### For AI Agents

1. **Use specific queries** - Filter by tenant_id, date ranges
2. **Limit result sets** - Don't fetch everything
3. **Cache when appropriate** - Identity thread, decisions
4. **Batch operations** - Reduce round trips
5. **Monitor your own performance** - Log query times

## Resources

- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Database Indexing Strategies](https://use-the-index-luke.com/)

---

**Need help?** Open an issue with the `performance` tag.
