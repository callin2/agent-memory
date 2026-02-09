-- OAuth2/SSO Integration Migration
-- Phase 3: OAuth Provider and Connection Tables

-- OAuth Providers Configuration
-- Stores configuration for OAuth2 providers (Google, GitHub, etc.)
CREATE TABLE IF NOT EXISTS oauth_providers (
  provider_id TEXT PRIMARY KEY,
  provider_name TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  authorization_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  user_info_url TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_providers_active ON oauth_providers(is_active);

-- OAuth User Connections
-- Stores user connections to OAuth providers
CREATE TABLE IF NOT EXISTS oauth_connections (
  connection_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES oauth_providers(provider_id),
  provider_user_id TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, provider_id)
);

CREATE INDEX idx_oauth_connections_user ON oauth_connections(user_id, is_active);
CREATE INDEX idx_oauth_connections_provider ON oauth_connections(provider_id, provider_user_id);
CREATE INDEX idx_oauth_connections_active ON oauth_connections(is_active);

-- Trigger to update updated_at timestamp on oauth_providers
CREATE OR REPLACE FUNCTION update_oauth_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oauth_providers_updated_at
  BEFORE UPDATE ON oauth_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_oauth_providers_updated_at();

-- Seed Google OAuth provider
-- Note: Update with actual client credentials from Google Cloud Console
INSERT INTO oauth_providers (
  provider_id,
  provider_name,
  client_id,
  client_secret_encrypted,
  authorization_url,
  token_url,
  user_info_url,
  scopes
) VALUES (
  'google',
  'Google',
  'YOUR_GOOGLE_CLIENT_ID',
  'encrypted_secret_here',
  'https://accounts.google.com/o/oauth2/v2/auth',
  'https://oauth2.googleapis.com/token',
  'https://www.googleapis.com/oauth2/v2/userinfo',
  ARRAY['openid', 'profile', 'email']
) ON CONFLICT (provider_id) DO NOTHING;

-- Seed GitHub OAuth provider
-- Note: Update with actual client credentials from GitHub Developer Settings
INSERT INTO oauth_providers (
  provider_id,
  provider_name,
  client_id,
  client_secret_encrypted,
  authorization_url,
  token_url,
  user_info_url,
  scopes
) VALUES (
  'github',
  'GitHub',
  'YOUR_GITHUB_CLIENT_ID',
  'encrypted_secret_here',
  'https://github.com/login/oauth/authorize',
  'https://github.com/login/oauth/access_token',
  'https://api.github.com/user',
  ARRAY['read:user', 'user:email']
) ON CONFLICT (provider_id) DO NOTHING;

-- Add audit log entry for OAuth initialization
-- Note: user_id is intentionally null to avoid FK constraint violation for system events
INSERT INTO audit_logs (
  log_id,
  tenant_id,
  event_type,
  action,
  resource_type,
  resource_id,
  outcome,
  details,
  ip_address,
  user_agent,
  created_at
) VALUES (
  'oauth_init_' || gen_random_uuid(),
  'default',
  'system',
  'oauth_initialized',
  'oauth_providers',
  'migration',
  'success',
  '{"providers": ["google", "github"], "migration": "005_oauth.sql"}',
  '127.0.0.1',
  'migration_script',
  NOW()
) ON CONFLICT (log_id) DO NOTHING;

COMMENT ON TABLE oauth_providers IS 'OAuth2 provider configurations';
COMMENT ON TABLE oauth_connections IS 'User OAuth provider connections';
COMMENT ON COLUMN oauth_connections.access_token_encrypted IS 'Encrypted OAuth access token';
COMMENT ON COLUMN oauth_connections.refresh_token_encrypted IS 'Encrypted OAuth refresh token';
COMMENT ON COLUMN oauth_providers.client_secret_encrypted IS 'Encrypted OAuth client secret';
