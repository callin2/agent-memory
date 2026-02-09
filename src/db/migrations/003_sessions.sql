-- Sessions table for active session tracking
-- This table stores user sessions for monitoring and management

CREATE TABLE IF NOT EXISTS sessions (
  session_id      TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,

  -- Device and location tracking
  device_info     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address      INET,

  -- Session metadata
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,

  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT fk_session_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_session_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES users(tenant_id)
);

-- Index for active session lookup by user
CREATE INDEX idx_sessions_user_active
  ON sessions (user_id, is_active, last_activity_at DESC)
  WHERE is_active = true;

-- Index for expired session cleanup
CREATE INDEX idx_sessions_expires_at
  ON sessions (expires_at)
  WHERE is_active = true;

-- Index for tenant-level queries
CREATE INDEX idx_sessions_tenant
  ON sessions (tenant_id, is_active);

-- Index for IP-based security analysis
CREATE INDEX idx_sessions_ip
  ON sessions (ip_address, last_activity_at DESC)
  WHERE is_active = true;

COMMENT ON TABLE sessions IS 'User session tracking for monitoring and management';
COMMENT ON COLUMN sessions.device_info IS 'JSONB with device fingerprint (browser, OS, device type)';
COMMENT ON COLUMN sessions.ip_address IS 'INET type for IP address with PostgreSQL network functions';
COMMENT ON COLUMN sessions.is_active IS 'Active sessions can be revoked by setting to false';
