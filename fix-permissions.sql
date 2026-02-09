-- Fix PostgreSQL permissions for agent_mem_dba user
-- Run this as a superuser (postgres)

-- Connect to your database first:
-- \c agent_memory

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE agent_memory TO agent_mem_dba;

-- Grant usage and create on schema public
GRANT USAGE ON SCHEMA public TO agent_mem_dba;
GRANT CREATE ON SCHEMA public TO agent_mem_dba;

-- Grant all on existing tables (for future reference)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agent_mem_dba;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agent_mem_dba;

-- Ensure future tables are also accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO agent_mem_dba;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO agent_mem_dba;

-- Verify permissions
SELECT * FROM information_schema.role_table_grants
WHERE grantee = 'agent_mem_dba';
