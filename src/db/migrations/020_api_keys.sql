-- Migration: API Key Authentication
-- Description: Add API key management for securing API endpoints
-- Version: 020

-- Drop old api_keys table if it exists (from migration 002)
DROP TABLE IF EXISTS api_keys CASCADE;

-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  -- API key metadata
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL UNIQUE, -- ak_xxxxxx...
  key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of full key

  -- Permissions
  permissions JSONB NOT NULL DEFAULT '{
    "can_read": true,
    "can_write": false,
    "can_delete": false,
    "can_admin": false
  }',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,

  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Metadata
  description TEXT,
  created_by VARCHAR(255),

  -- Constraints
  CONSTRAINT api_keys_name_unique UNIQUE (tenant_id, name)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used ON api_keys(last_used_at);

-- Audit log for API key usage
CREATE TABLE IF NOT EXISTS api_key_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Request info
  tenant_id VARCHAR(255) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,

  -- Response info
  status_code INTEGER NOT NULL,

  -- Metadata
  ip_address INET,
  user_agent TEXT,
  request_id UUID,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_audit_log_api_key_id ON api_key_audit_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_audit_log_tenant_id ON api_key_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_audit_log_created_at ON api_key_audit_log(created_at);

-- Comment for documentation
COMMENT ON TABLE api_keys IS 'API keys for authentication and authorization';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 10 characters of API key for identification (ak_xxxxxx...)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the full API key - never store the actual key';
COMMENT ON COLUMN api_keys.permissions IS 'JSONB object with permission flags: can_read, can_write, can_delete, can_admin';
COMMENT ON COLUMN api_keys.is_active IS 'Whether the API key is currently active';
COMMENT ON COLUMN api_keys.expires_at IS 'Optional expiration date for time-limited keys';

COMMENT ON TABLE api_key_audit_log IS 'Audit trail for API key usage';
COMMENT ON COLUMN api_key_audit_log.api_key_id IS 'Reference to the API key used';
COMMENT ON COLUMN api_key_audit_log.endpoint IS 'API endpoint that was called';
COMMENT ON COLUMN api_key_audit_log.status_code IS 'HTTP status code of the response';
