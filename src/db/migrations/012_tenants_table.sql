-- Migration 012: Create tenants table for multi-tenancy support
-- This migration creates the tenants table to support multi-tenant architecture

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for tenant lookups by name
CREATE INDEX IF NOT EXISTS idx_tenants_name
  ON tenants (name);

-- Add comment
COMMENT ON TABLE tenants IS 'Multi-tenant configuration and settings';
COMMENT ON COLUMN tenants.settings IS 'Tenant-specific settings (rate limits, quotas, etc.)';
