#!/bin/bash
# Setup script for agent_memory_dev database
# Run this as postgres superuser or your admin user

echo "Setting up agent_memory_dev database..."

# Change database owner to agent_mem_dba
psql postgres -c "ALTER DATABASE agent_memory_dev OWNER TO agent_mem_dba;"

# Create extensions
psql agent_memory_dev -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql agent_memory_dev -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# Apply base schema
echo "Applying base schema..."
cat src/db/schema.sql | psql agent_memory_dev

# Apply migrations
echo "Applying migrations..."
cat src/db/migrations/001_refresh_tokens.sql | psql agent_memory_dev
cat src/db/migrations/002_api_keys.sql | psql agent_memory_dev
cat src/db/migrations/003_sessions.sql | psql agent_memory_dev
cat src/db/migrations/004_audit_logs.sql | psql agent_memory_dev
cat src/db/migrations/005_oauth.sql | psql agent_memory_dev

# Verify tables
echo "Verifying tables..."
psql agent_memory_dev -c "\dt"

echo "Done! Development database ready."
