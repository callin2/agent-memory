-- Refresh tokens table for token rotation and session management
-- This table stores refresh tokens with support for token family tracking
-- and security features like rotation and theft detection

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id       TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  tenant_id      TEXT NOT NULL,
  token_hash     TEXT NOT NULL UNIQUE,
  expires_at     TIMESTAMPTZ NOT NULL,

  -- Token rotation tracking
  rotated_at     TIMESTAMPTZ,
  replaced_by    TEXT REFERENCES refresh_tokens(token_id) ON DELETE SET NULL,

  -- Revocation tracking
  revoked_at     TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Device and usage tracking
  device_info    JSONB DEFAULT '{}'::jsonb,
  last_used_at   TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_refresh_token_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
);

-- Index for active token lookup
CREATE INDEX idx_refresh_tokens_user_active
  ON refresh_tokens (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

-- Index for token hash lookup (validation)
CREATE INDEX idx_refresh_tokens_hash
  ON refresh_tokens (token_hash);

-- Index for tenant-level queries
CREATE INDEX idx_refresh_tokens_tenant
  ON refresh_tokens (tenant_id, expires_at DESC);

-- Index for token family tracking
CREATE INDEX idx_refresh_tokens_family
  ON refresh_tokens (replaced_by)
  WHERE replaced_by IS NOT NULL;

-- Index for cleanup queries
CREATE INDEX idx_refresh_tokens_expired
  ON refresh_tokens (expires_at)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE refresh_tokens IS 'Refresh token storage with rotation support';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hash of the refresh token';
COMMENT ON COLUMN refresh_tokens.replaced_by IS 'Self-reference for token family tracking';
COMMENT ON COLUMN refresh_tokens.device_info IS 'JSONB with device fingerprint (user agent, IP, etc.)';
