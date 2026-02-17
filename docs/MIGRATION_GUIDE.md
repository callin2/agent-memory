# Migration Guide: v1.0.0 → v2.0.0

**Upgrading Thread's Memory System to version 2.0.0**

This guide helps you upgrade from v1.0.0 to v2.0.0 with minimal downtime.

## Overview

Version 2.0.0 is a **major feature release** with **no breaking changes**. All v1.0.0 deployments can upgrade without modifying code or data.

### What's New in v2.0.0

- **Export Functionality**: Backup and transfer memory data
- **Health Monitoring**: Comprehensive system health checks
- **Enhanced Documentation**: 12 new documentation files
- **Production Tooling**: CI/CD, monitoring, backups
- **Developer Experience**: Scripts, examples, troubleshooting

### Compatibility

- ✅ **API Compatible**: All v1.0.0 API endpoints work unchanged
- ✅ **Data Compatible**: No database schema changes
- ✅ **Configuration Compatible**: Existing `.env` files work
- ✅ **Deployment Compatible**: Existing deployment methods work

---

## Pre-Migration Checklist

Before upgrading, ensure:

- [ ] You have a recent database backup
- [ ] You're running Node.js 20+
- [ ] You're running PostgreSQL 12+
- [ ] You have at least 1GB free disk space
- [ ] You've tested the upgrade in development/staging
- [ ] You have downtime scheduled (optional - upgrade is non-breaking)

---

## Step-by-Step Migration

### Step 1: Backup Your Data

Always backup before upgrading:

```bash
# Method 1: Using the backup script
./scripts/backup.sh

# Method 2: Manual pg_dump
pg_dump -h localhost -U your_user agent_memory > backup_$(date +%Y%m%d).sql

# Method 3: Using the new export API
curl "http://localhost:3456/api/v1/export/all?format=json" \
  -H "tenant_id: default" \
  > backup_$(date +%Y%m%d).json
```

**Verify backup:**
```bash
# Check file exists and is not empty
ls -lh backup_*.sql
wc -l backup_*.sql

# Should show significant file size (depends on data volume)
```

---

### Step 2: Stop the Application

**Systemd:**
```bash
sudo systemctl stop agent-memory
```

**Docker:**
```bash
docker stop agent-memory
```

**Manual:**
```bash
# Find the process
ps aux | grep "node.*server"

# Kill it
kill <PID>
```

---

### Step 3: Update Dependencies

```bash
# Pull latest code
git pull origin main
# or
git fetch origin
git checkout v2.0.0

# Install updated dependencies
npm install

# Build the application
npm run build
```

**If using Docker:**
```bash
docker build -t agent-memory:v2.0.0 .
```

---

### Step 4: Run Database Migrations

**Important**: v2.0.0 doesn't require schema changes, but run migrations to ensure you're up to date:

```bash
npm run db:migrate
```

**Expected output:**
```
✓ All migrations completed successfully
```

**Check migration status:**
```bash
npx tsx cli.ts status
```

---

### Step 5: Verify Configuration

Your v1.0.0 `.env` file should work unchanged. Optional v2.0.0 additions:

```bash
# New optional variables (not required for upgrade)

# Monitoring
ENABLE_HEALTH_CHECKS=true
METRICS_ENABLED=true

# Performance
DB_POOL_MAX=20
DB_POOL_MIN=5

# Security
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

**Keep existing variables:**
```bash
# Required (same as v1.0.0)
PGHOST=localhost
PGPORT=5432
PGDATABASE=agent_memory
PGUSER=your_user
PGPASSWORD=your_password
PORT=3456
```

---

### Step 6: Start the Application

**Systemd:**
```bash
sudo systemctl start agent-memory
sudo systemctl status agent-memory
```

**Docker:**
```bash
docker run -d \
  --name agent-memory \
  -p 3456:3456 \
  --env-file .env \
  agent-memory:v2.0.0
```

**Manual:**
```bash
npm run dev
# or for production
npm start
```

---

### Step 7: Verify the Upgrade

**Test basic functionality:**

1. **Health check:**
   ```bash
   curl http://localhost:3456/health
   # Should return: {"status":"healthy",...}
   ```

2. **API access:**
   ```bash
   curl http://localhost:3456/api/v1/handoffs?tenant_id=default
   # Should return your handoffs
   ```

3. **Wake-up (new v2 feature):**
   ```bash
   curl "http://localhost:3456/api/v1/wake-up?tenant_id=default&with_whom=YourName"
   # Should return context from previous sessions
   ```

4. **Export (new v2 feature):**
   ```bash
   curl "http://localhost:3456/api/v1/export/thread?tenant_id=default&format=markdown"
   # Should export your identity thread
   ```

**Check logs for errors:**
```bash
# Systemd
journalctl -u agent-memory -f

# Docker
docker logs -f agent-memory

# Manual
tail -f logs/agent-memory.log
```

---

## Post-Migration Steps

### Enable New Features (Optional)

#### 1. Enable Health Monitoring

**Already enabled** at `/health` and `/health/detailed`.

**Integrate with monitoring tools:**
```bash
# Add to Prometheus scrape config
- job_name: 'agent-memory'
  metrics_path: '/health/detailed'
  static_configs:
    - targets: ['localhost:3456']
```

#### 2. Set Up Automated Backups

**Using the backup script:**
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /path/to/agent-memory/scripts/backup.sh
```

**Using systemd timer:**
```bash
# Create timer
sudo cp scripts/agent-memory-backup.timer /etc/systemd/system/
sudo systemctl enable agent-memory-backup.timer
sudo systemctl start agent-memory-backup.timer
```

#### 3. Enable CI/CD (if deploying from git)

**GitHub Actions is already configured.**

Add secrets to your repository:
- `DATABASE_URL`
- `PGPASSWORD`
- `DEPLOY_HOST`
- `DEPLOY_KEY`

---

## Rollback Plan

If you need to rollback to v1.0.0:

### Step 1: Stop v2.0.0

```bash
sudo systemctl stop agent-memory
```

### Step 2: Restore v1.0.0 Code

```bash
git checkout v1.0.0
npm install
npm run build
```

### Step 3: Restore Database (if needed)

```bash
# From SQL backup
psql -h localhost -U your_user -d agent_memory < backup_YYYYMMDD.sql

# From JSON export (if you used export API)
# This requires the export import script (not yet implemented)
```

### Step 4: Start v1.0.0

```bash
sudo systemctl start agent-memory
```

### Step 5: Verify

```bash
curl http://localhost:3456/api/v1/handoffs?tenant_id=default
```

---

## New Feature Adoption Guide

### Export Functionality

**Use case**: Backup, transfer, or analyze memory data

**Basic usage:**
```bash
# Export identity thread as markdown
curl "http://localhost:3456/api/v1/export/thread?tenant_id=default&format=markdown" \
  > identity-thread.md

# Export all data as JSON
curl "http://localhost:3456/api/v1/export/all?tenant_id=default&format=json" \
  > full-backup.json
```

**Integration examples:**
```typescript
// See examples/export-memory.ts for complete examples
import { exportMemory } from './examples/export-memory.js';

// Backup memory
await exportMemory('default', 'json', './backups');
```

---

### Health Monitoring

**Use case**: Production monitoring and alerting

**Basic checks:**
```bash
# Quick health check
curl http://localhost:3456/health

# Detailed health with diagnostics
curl http://localhost:3456/health/detailed?tenant_id=default
```

**Monitoring integration:**
```yaml
# Prometheus alerting rules
groups:
  - name: agent-memory
    rules:
      - alert: HighResponseTime
        expr: response_time_ms > 1000
        for: 5m
        annotations:
          summary: "Agent Memory slow response"
```

---

### Enhanced CLI

**New commands:**
```bash
# Check system status
npx tsx cli.ts status

# Export memory
npx tsx cli.ts export --tenant-id default --format markdown

# List tenants
npx tsx cli.ts tenants

# View recent activity
npx tsx cli.ts recent --tenant-id default --limit 10

# Trigger consolidation
npx tsx cli.ts consolidate --tenant-id default

# Backup database
npx tsx cli.ts backup
```

---

## Performance Considerations

### Database Optimization

**Run after upgrade:**
```bash
# Analyze database for optimization opportunities
npx tsx scripts/analyze-db.ts --all

# Run VACUUM ANALYZE to reclaim space
npx tsx cli.ts vacuum
```

### Connection Pooling

**If you have high traffic, tune pool size:**
```bash
# In .env
DB_POOL_MAX=20
DB_POOL_MIN=5
```

### Index Verification

**Check indexes are present:**
```sql
-- Connect to database
psql -h localhost -U your_user -d agent_memory

-- Check indexes
\di

-- Should see indexes like:
-- - idx_handoffs_tenant_created
-- - idx_handoffs_with_whom
-- - decisions_tenant_scope_idx
```

---

## Troubleshooting

### Issue: Application won't start

**Symptoms:**
```
Error: Cannot find module '@types/express'
```

**Solution:**
```bash
npm install
npm run build
```

---

### Issue: Health check returns unhealthy

**Symptoms:**
```json
{"status":"unhealthy", "error":"connection refused"}
```

**Solution:**
```bash
# Check database is running
pg_isready -h localhost

# Check credentials
cat .env | grep PG

# Test connection
psql -h localhost -U your_user -d agent_memory
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more help.

---

### Issue: Export is slow

**Symptoms:**
Export times out or takes very long.

**Solution:**
```bash
# For large datasets, use pagination
curl "http://localhost:3456/api/v1/export/all?tenant_id=default&format=json&limit=100&offset=0"

# Increase timeout if using directly
npx tsx cli.ts export --timeout 120000
```

---

## Support

### Documentation

- [README.md](README.md) - Getting started
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common problems
- [SECURITY.md](SECURITY.md) - Security best practices
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference

### Getting Help

1. **Check documentation** - Most issues are covered
2. **Search GitHub Issues** - Someone may have solved it
3. **Create an Issue** - Include:
   - Version: v2.0.0
   - Error message
   - Steps to reproduce
   - System information (OS, Node version, PostgreSQL version)

---

## Migration Checklist

**Pre-Migration:**
- [ ] Backup database
- [ ] Backup configuration files
- [ ] Review new features
- [ ] Schedule maintenance window (optional)

**Migration:**
- [ ] Stop application
- [ ] Update code
- [ ] Install dependencies
- [ ] Run migrations
- [ ] Update configuration (optional)
- [ ] Start application
- [ ] Verify functionality

**Post-Migration:**
- [ ] Test new features
- [ ] Set up monitoring
- [ ] Configure automated backups
- [ ] Update documentation
- [ ] Train team on new features

---

**Migration Duration:** Typically 5-15 minutes
**Downtime Required:** None (zero-downtime upgrade possible with load balancer)
**Rollback Time:** 5-10 minutes

---

**Last Updated:** 2026-02-17
**Version:** 2.0.0
**Previous Version:** 1.0.0
