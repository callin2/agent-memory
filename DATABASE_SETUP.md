# Database Setup Guide

This project supports multiple PostgreSQL databases for different environments:

- **agent_memory** - Production database
- **agent_memory_dev** - Development database
- **agent_memory_test** - Test database (auto-created by tests)

## Quick Start

### 1. Setup Development Database

Run the setup script as a PostgreSQL superuser:

```bash
bash setup-dev-db.sh
```

Or manually:

```sql
-- As postgres superuser
ALTER DATABASE agent_memory_dev OWNER TO agent_mem_dba;

\c agent_memory_dev
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Apply schema and migrations
cat src/db/schema.sql | psql agent_memory_dev
cat src/db/migrations/001_refresh_tokens.sql | psql agent_memory_dev
cat src/db/migrations/002_api_keys.sql | psql agent_memory_dev
cat src/db/migrations/003_sessions.sql | psql agent_memory_dev
cat src/db/migrations/004_audit_logs.sql | psql agent_memory_dev
cat src/db/migrations/005_oauth.sql | psql agent_memory_dev
```

### 2. Configure Environment

**Option A: Use .env.dev (Recommended for development)**

```bash
cp .env.dev .env
# Edit .env with your database credentials
```

**Option B: Use .env.example (For production)**

```bash
cp .env.example .env
# Edit .env and set PGDATABASE=agent_memory
```

### 3. Start the Server

The server automatically uses the database specified in the `PGDATABASE` environment variable:

```bash
npm run dev
```

## Database Switching

The application uses the `PGDATABASE` environment variable to determine which database to use. The code (src/server.ts) reads this variable and defaults to `agent_memory` if not set.

### Switch to Development Database

```bash
# Set in .env file
PGDATABASE=agent_memory_dev

# Or override when running
PGDATABASE=agent_memory_dev npm run dev
```

### Switch to Production Database

```bash
# Set in .env file
PGDATABASE=agent_memory

# Or override when running
PGDATABASE=agent_memory npm start
```

### Switch to Test Database

Tests use `DATABASE_URL` environment variable (see .env.test):

```bash
NODE_ENV=test DATABASE_URL="postgresql://agent_mem_dba:password@localhost:5432/agent_memory_test" npm test
```

## Database Schema

All databases share the same schema with 13 tables:

| Table | Purpose |
|-------|---------|
| users | User accounts with roles |
| events | Event log for agent interactions |
| chunks | Retrieval units for semantic search |
| decisions | First-class decisions with rationale |
| tasks | Task management |
| artifacts | Large file storage (tool outputs) |
| rules | Agent behavior rules |
| refresh_tokens | JWT refresh token rotation |
| api_keys | Persistent API keys for services |
| sessions | User session tracking |
| audit_logs | Security event logging |
| oauth_providers | OAuth2 provider configurations |
| oauth_connections | User OAuth provider links |

## Migration Scripts

Migrations are stored in `src/db/migrations/` and must be applied in order:

1. `001_refresh_tokens.sql` - Refresh token storage with rotation tracking
2. `002_api_keys.sql` - API key storage with rate limiting
3. `003_sessions.sql` - Session tracking with device info
4. `004_audit_logs.sql` - Security event logging
5. `005_oauth.sql` - OAuth provider and connection tables

### Apply Migrations

**Development:**
```bash
npm run db:migrate:dev
```

**Production:**
```bash
npm run db:migrate:prod
```

**Manual:**
```bash
PGDATABASE=agent_memory_dev psql -f src/db/schema.sql
for f in src/db/migrations/*.sql; do
    echo "Applying $f..."
    PGDATABASE=agent_memory_dev psql -f "$f"
done
```

## Environment Variables

Key database-related environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| PGHOST | localhost | PostgreSQL host |
| PGPORT | 5432 | PostgreSQL port |
| PGDATABASE | agent_memory | **Database name (change to switch envs)** |
| PGUSER | postgres | Database user |
| PGPASSWORD | - | Database password |
| PGPOOL_MAX | 20 | Max pool connections |
| PGPOOL_MIN | 2 | Min pool connections |
| PGIDLE_TIMEOUT | 30000 | Idle timeout (ms) |
| PGTIMEOUT | 2000 | Connection timeout (ms) |

## Troubleshooting

### Permission Denied

If you get permission errors:

```sql
-- Grant privileges as superuser
GRANT ALL PRIVILEGES ON DATABASE agent_memory_dev TO agent_mem_dba;
\c agent_memory_dev
GRANT ALL PRIVILEGES ON SCHEMA public TO agent_mem_dba;
ALTER DATABASE agent_memory_dev OWNER TO agent_mem_dba;
```

### Extension Creation Failed

If extension creation fails:

```sql
\c agent_memory_dev
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Table Already Exists

Migrations use `IF NOT EXISTS` clauses, so they're safe to run multiple times. If you need to reset:

```bash
npm run db:reset  # Drops and recreates database using $PGDATABASE
```

## Verification

Verify your database setup:

```bash
# List all tables
psql $PGDATABASE -c "\dt"

# Count rows in each table
psql $PGDATABASE -c "
SELECT
    schemaname,
    tablename,
    n_tup_ins as rows
FROM pg_stat_user_tables
ORDER BY tablename;"
```
