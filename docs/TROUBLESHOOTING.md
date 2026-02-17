# Troubleshooting Guide

**Solving common problems with Thread's Memory System**

This guide helps you diagnose and fix issues when working with the memory system.

## Table of Contents

- [Database Issues](#database-issues)
- [API Issues](#api-issues)
- [Performance Issues](#performance-issues)
- [Deployment Issues](#deployment-issues)
- [Testing Issues](#testing-issues)
- [MCP Integration Issues](#mcp-integration-issues)

---

## Database Issues

### Problem: Cannot connect to database

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
or
```
password authentication failed for user "postgres"
```

**Solutions:**

1. **Check PostgreSQL is running:**
   ```bash
   # macOS
   brew services list | grep postgresql

   # Linux
   systemctl status postgresql

   # Start if not running
   brew services start postgresql  # macOS
   systemctl start postgresql      # Linux
   ```

2. **Verify credentials in .env:**
   ```bash
   cat .env | grep PG
   ```

   Should match your PostgreSQL setup:
   ```
   PGHOST=localhost
   PGPORT=5432
   PGDATABASE=agent_memory_dev
   PGUSER=your_username
   PGPASSWORD=your_password
   ```

3. **Test connection manually:**
   ```bash
   psql -h localhost -U your_username -d agent_memory_dev
   ```

4. **Create database if missing:**
   ```bash
   createdb -U your_username agent_memory_dev
   ```

---

### Problem: Migration failures

**Symptoms:**
```
Error: relation "session_handoffs" does not exist
```

**Solutions:**

1. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

2. **Check migration status:**
   ```bash
   npx tsx cli.ts status
   ```

3. **Reset database (CAUTION: deletes data):**
   ```bash
   npm run db:reset
   ```

4. **Check for pending migrations:**
   ```bash
   ls src/db/migrations/ | wc -l
   # Should show number of migration files

   npx tsx cli.ts status
   # Shows applied migrations
   ```

---

### Problem: Duplicate key errors

**Symptoms:**
```
Error: duplicate key value violates unique constraint "session_handoffs_pkey"
```

**Solutions:**

1. **Check if handoff ID already exists:**
   ```sql
   SELECT handoff_id, created_at
   FROM session_handoffs
   WHERE handoff_id = 'your-id-here';
   ```

2. **Use UUID for new handoffs:**
   ```typescript
   import { randomUUID } from 'crypto';

   const handoff = {
     handoff_id: randomUUID(), // Always generate new ID
     // ... rest of handoff data
   };
   ```

3. **Check sequence corruption:**
   ```sql
   -- Check current sequence value
   SELECT last_value FROM session_handoffs_handoff_id_seq;

   -- Reset if needed
   SELECT setval('session_handoffs_handoff_id_seq',
     (SELECT MAX(handoff_id) FROM session_handoffs));
   ```

---

## API Issues

### Problem: Port already in use

**Symptoms:**
```
Error: Port 3456 is already in use
```

**Solutions:**

1. **Find what's using the port:**
   ```bash
   lsof -i :3456

   # or
   netstat -tuln | grep 3456
   ```

2. **Kill the process:**
   ```bash
   lsof -ti:3456 | xargs kill -9
   ```

3. **Use different port:**
   ```bash
   PORT=4000 npm run dev
   ```

   Or update `.env`:
   ```
   PORT=4000
   ```

---

### Problem: CORS errors from frontend

**Symptoms:**
```
Access to fetch at 'http://localhost:3456/api/v1/handoffs'
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solutions:**

1. **Add CORS middleware:**
   ```typescript
   import cors from 'cors';

   app.use(cors({
     origin: 'http://localhost:3000',
     credentials: true
   }));
   ```

2. **Configure allowed origins in production:**
   ```typescript
   app.use(cors({
     origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
     credentials: true
   }));
   ```

---

### Problem: Request timeout

**Symptoms:**
```
Error: Request timeout after 30000ms
```

**Solutions:**

1. **Increase timeout:**
   ```typescript
   app.use('/api/v1/export', (req, res, next) => {
     res.setTimeout(120000); // 2 minutes
     next();
   });
   ```

2. **Optimize slow queries** (see [Performance Issues](#performance-issues))

3. **Use pagination:**
   ```bash
   # Instead of fetching all handoffs
   GET /api/v1/handoffs?limit=100&offset=0
   ```

---

## Performance Issues

### Problem: Slow wake-up times

**Symptoms:**
Wake-up takes 2-3 seconds or more.

**Solutions:**

1. **Check database query performance:**
   ```bash
   npx tsx scripts/analyze-db.ts --performance
   ```

2. **Add missing indexes:**
   ```sql
   -- Check if index exists
   \d session_handoffs

   -- Add composite index for common queries
   CREATE INDEX idx_handoffs_tenant_created
   ON session_handoffs(tenant_id, created_at DESC);
   ```

3. **Use connection pooling:**
   ```typescript
   const pool = new Pool({
     host: process.env.PGHOST,
     max: 20, // Increase pool size
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

4. **Enable query caching:**
   ```typescript
   // Cache identity thread (changes infrequently)
   const cache = new Map();

   async function getIdentityThread(tenantId: string) {
     if (cache.has(tenantId)) {
       return cache.get(tenantId);
     }
     const result = await fetchFromDB(tenantId);
     cache.set(tenantId, result);
     return result;
   }
   ```

---

### Problem: High memory usage

**Symptoms:**
Node process using >1GB memory.

**Solutions:**

1. **Monitor memory usage:**
   ```bash
   npm run metrics
   # Check storage estimates
   ```

2. **Run consolidation:**
   ```bash
   npx tsx cli.ts consolidate --tenant-id default
   ```

3. **Archive old handoffs:**
   ```typescript
   // Export handoffs older than 180 days
   const archiveDate = new Date();
   archiveDate.setDate(archiveDate.getDate() - 180);

   await exportHandoffs(archiveDate);
   await deleteOldHandoffs(archiveDate);
   ```

4. **Adjust Node memory limit:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

---

### Problem: Export fails for large datasets

**Symptoms:**
Export times out or returns error for tenants with 1000+ handoffs.

**Solutions:**

1. **Use pagination:**
   ```bash
   # Export in chunks
   GET /api/v1/export/all?format=json&limit=100&offset=0
   GET /api/v1/export/all?format=json&limit=100&offset=100
   ```

2. **Increase timeout:**
   ```bash
   # Server-side
   res.setTimeout(300000); // 5 minutes
   ```

3. **Export to file instead of memory:**
   ```typescript
   // Stream directly to file
   const stream = fs.createWriteStream('export.json');
   stream.write('[\n');

   let first = true;
   for await (const handoff of fetchHandoffsBatched(tenantId)) {
     if (!first) stream.write(',\n');
     stream.write(JSON.stringify(handoff));
     first = false;
   }

   stream.write('\n]');
   stream.end();
   ```

---

## Deployment Issues

### Problem: systemd service fails to start

**Symptoms:**
```
 systemctl status agent-memory
   ● agent-memory.service - Agent Memory System
      Loaded: loaded (/etc/systemd/system/agent-memory.service)
      Active: failed (Result: exit-code)
```

**Solutions:**

1. **Check logs:**
   ```bash
   journalctl -u agent-memory -n 50
   ```

2. **Verify environment variables:**
   ```bash
   systemctl show agent-memory | grep Environment
   ```

3. **Check file permissions:**
   ```bash
   ls -la /usr/local/agent-memory/
   # Should be readable by the service user
   ```

4. **Test start manually:**
   ```bash
   sudo -u agent-memory /usr/local/agent-memory/start.sh
   ```

---

### Problem: Database connection in Docker

**Symptoms:**
```
Error: connect ECONNREFUSED 172.17.0.1:5432
```

**Solutions:**

1. **Use Docker network:**
   ```yaml
   # docker-compose.yml
   services:
     app:
       environment:
         - PGHOST=db
     db:
       image: postgres:15
   ```

2. **Use host.docker.internal (Mac/Windows):**
   ```yaml
   environment:
     - PGHOST=host.docker.internal
   ```

3. **Wait for database to be ready:**
   ```yaml
   app:
     depends_on:
       db:
         condition: service_healthy
   ```

---

## Testing Issues

### Problem: Integration tests fail with "connect ECONNREFUSED"

**Symptoms:**
```
fetch failed
Error: connect ECONNREFUSED 127.0.0.1:3456
```

**Solutions:**

1. **Start development server:**
   ```bash
   npm run dev
   # Leave running in another terminal
   ```

2. **Set correct port in test:**
   ```typescript
   const baseUrl = `http://localhost:${process.env.PORT || 3456}`;
   ```

3. **Use environment variable:**
   ```bash
   PORT=3456 npm test
   ```

---

### Problem: Tests fail with "relation does not exist"

**Symptoms:**
```
error: relation "session_handoffs" does not exist
```

**Solutions:**

1. **Run migrations on test database:**
   ```bash
   PGDATABASE=agent_memory_test npm run db:migrate
   ```

2. **Set test database in .env.test:**
   ```
   PGDATABASE=agent_memory_test
   ```

3. **Create test database:**
   ```bash
   createdb agent_memory_test
   npm run db:migrate
   ```

---

## MCP Integration Issues

### Problem: MCP tools not found

**Symptoms:**
```
Error: Tool 'wake_up' not found
```

**Solutions:**

1. **Check MCP server is running:**
   ```bash
   # Should show process
   ps aux | grep "mcp/server.js"
   ```

2. **Verify MCP configuration:**
   ```json
   {
     "mcpServers": {
       "agent-memory": {
         "command": "node",
         "args": ["/path/to/agent-memory/dist/mcp/server.js"],
         "env": {
           "PGDATABASE": "agent_memory"
         }
       }
     }
   }
   ```

3. **Build MCP server:**
   ```bash
   npm run build
   # Ensure dist/mcp/server.js exists
   ```

---

### Problem: Wake-up returns no context

**Symptoms:**
```json
{
  "last_handoff": null,
  "identity_thread": []
}
```

**Solutions:**

1. **Create test handoff first:**
   ```bash
   curl -X POST http://localhost:3456/api/v1/handoff \
     -H "Content-Type: application/json" \
     -d '{
       "tenant_id": "default",
       "with_whom": "TestUser",
       "experienced": "Testing MCP integration",
       "becoming": "An agent that tests thoroughly"
     }'
   ```

2. **Check tenant_id matches:**
   ```bash
   # Wake-up uses same tenant_id as handoffs
   curl "http://localhost:3456/api/v1/wake-up?tenant_id=default&with_whom=TestUser"
   ```

3. **Verify database has handoffs:**
   ```sql
   SELECT COUNT(*) FROM session_handoffs
   WHERE tenant_id = 'default';
   ```

---

## Getting Help

If you're still stuck:

1. **Check logs:**
   ```bash
   # Server logs
   tail -f /tmp/agent-memory.log

   # Database logs
   tail -f /var/log/postgresql/postgresql-15-main.log
   ```

2. **Enable debug mode:**
   ```bash
   DEBUG=* npm run dev
   ```

3. **Run diagnostics:**
   ```bash
   npx tsx scripts/analyze-db.ts --all
   npx tsx cli.ts status
   ```

4. **Check GitHub Issues:**
   - Search for similar problems
   - Create new issue with:
     - Error message
     - Steps to reproduce
     - System information (OS, Node version, PostgreSQL version)

5. **Documentation:**
   - [Architecture](ARCHITECTURE.md)
   - [Developer Guide](DEVELOPER_GUIDE.md)
   - [API Reference](API_DOCUMENTATION.md)

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `password authentication failed` | Wrong credentials | Check `.env` PGUSER/PGPASSWORD |
| `relation "X" does not exist` | Missing table or migration | Run `npm run db:migrate` |
| `duplicate key value violates unique constraint` | Duplicate ID | Use `randomUUID()` for new records |
| `connect ECONNREFUSED` | Server not running | Start server with `npm run dev` |
| `Request timeout` | Slow query or large dataset | Add indexes, use pagination |
| `Port already in use` | Process using port | Kill process or change PORT |
| `CORS policy blocked` | Missing CORS config | Add CORS middleware |
| `out of memory` | Large dataset, no consolidation | Run consolidation, archive old data |

---

**Last Updated:** 2026-02-17
**Version:** 2.0.0
