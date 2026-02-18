-- API keys table for persistent service authentication
-- This table stores API keys for service-to-service communication

CREATE TABLE IF NOT EXISTS api_keys (
  key_id       TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  created_by   TEXT NOT NULL,

  -- Key storage (never store plaintext keys)
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL, -- First few chars for identification

  -- Key metadata
  name         TEXT NOT NULL,
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  expires_at   TIMESTAMPTZ,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  usage_count  INT NOT NULL DEFAULT 0,

  -- Rate limiting
  rate_limit   INT, -- Requests per minute

  -- Status
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_api_key_user
    FOREIGN KEY (created_by)
    REFERENCES users(user_id)
    ON DELETE CASCADE
);

-- Index for active key lookup by tenant
CREATE INDEX idx_api_keys_tenant_active
  ON api_keys (tenant_id, is_active)
  WHERE is_active = true;

-- Index for key prefix lookup (identification)
CREATE INDEX idx_api_keys_prefix
  ON api_keys (key_prefix);

-- Index for key hash lookup (validation)
CREATE INDEX idx_api_keys_hash
  ON api_keys (key_hash)
  WHERE is_active = true;

-- Index for expired keys cleanup
CREATE INDEX idx_api_keys_expires_at
  ON api_keys (expires_at)
  WHERE is_active = true;

COMMENT ON TABLE api_keys IS 'Persistent API key storage for service authentication';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the API key';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters for identification (ak_<timestamp>_)';
COMMENT ON COLUMN api_keys.scopes IS 'Array of scope strings (e.g., read, write, admin)';
COMMENT ON COLUMN api_keys.rate_limit IS 'Requests per minute limit';
