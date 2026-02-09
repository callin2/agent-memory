/**
 * OAuth2/SSO Service
 *
 * Manages OAuth2 authentication flows including:
 * - Provider configuration management
 * - Authorization URL generation
 * - Token exchange with OAuth providers
 * - User info fetching from providers
 * - User finding/creation from OAuth data
 * - OAuth connection management
 * - Token encryption for secure storage
 */

import { Pool } from 'pg';
import crypto from 'crypto';

// OAuth provider configuration
export interface OAuthProvider {
  provider_id: string;
  provider_name: string;
  client_id: string;
  client_secret: string; // Decrypted
  authorization_url: string;
  token_url: string;
  user_info_url: string;
  scopes: string[];
}

// User info from OAuth provider
export interface OAuthUserInfo {
  provider_user_id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email?: boolean;
}

// Token response from OAuth provider
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

// OAuth connection data
export interface OAuthConnection {
  connection_id: string;
  user_id: string;
  provider_id: string;
  provider_user_id: string;
  connected_at: Date;
  last_used_at: Date | null;
  is_active: boolean;
}

/**
 * OAuth Service class
 */
export class OAuthService {
  private pool: Pool;
  private encryptionKey: string;

  constructor(pool: Pool) {
    this.pool = pool;
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!';
  }

  /**
   * Get active OAuth provider configuration
   *
   * @param providerId - Provider ID (google, github)
   * @returns Provider configuration or null
   */
  async getProvider(providerId: string): Promise<OAuthProvider | null> {
    const result = await this.pool.query(
      `SELECT provider_id, provider_name, client_id, client_secret_encrypted,
              authorization_url, token_url, user_info_url, scopes
       FROM oauth_providers
       WHERE provider_id = $1 AND is_active = true`,
      [providerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const provider = result.rows[0];
    return {
      provider_id: provider.provider_id,
      provider_name: provider.provider_name,
      client_id: provider.client_id,
      client_secret: this.decrypt(provider.client_secret_encrypted),
      authorization_url: provider.authorization_url,
      token_url: provider.token_url,
      user_info_url: provider.user_info_url,
      scopes: provider.scopes,
    };
  }

  /**
   * Generate OAuth authorization URL
   *
   * @param providerId - Provider ID
   * @param redirectUri - OAuth callback URL
   * @param state - CSRF protection state parameter
   * @returns Authorization URL to redirect user to
   */
  async getAuthorizationUrl(
    providerId: string,
    redirectUri: string,
    state: string
  ): Promise<string> {
    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error(`OAuth provider not found: ${providerId}`);
    }

    const params = new URLSearchParams({
      client_id: provider.client_id,
      redirect_uri: redirectUri,
      scope: provider.scopes.join(' '),
      response_type: 'code',
      state: state,
    });

    return `${provider.authorization_url}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   *
   * @param providerId - Provider ID
   * @param code - Authorization code from OAuth callback
   * @param redirectUri - OAuth callback URL (must match original)
   * @returns Token response with access_token, refresh_token, expires_in
   */
  async exchangeCodeForToken(
    providerId: string,
    code: string,
    redirectUri: string
  ): Promise<OAuthTokenResponse> {
    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error(`OAuth provider not found: ${providerId}`);
    }

    const response = await fetch(provider.token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: provider.client_id,
        client_secret: provider.client_secret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json() as OAuthTokenResponse;
    return data;
  }

  /**
   * Fetch user info from OAuth provider
   *
   * @param providerId - Provider ID
   * @param accessToken - OAuth access token
   * @returns Normalized user info
   */
  async getUserInfo(
    providerId: string,
    accessToken: string
  ): Promise<OAuthUserInfo> {
    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error(`OAuth provider not found: ${providerId}`);
    }

    const response = await fetch(provider.user_info_url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, any>;

    // Normalize response based on provider
    if (providerId === 'google') {
      return {
        provider_user_id: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture,
        verified_email: data.verified_email,
      };
    } else if (providerId === 'github') {
      return {
        provider_user_id: String(data.id),
        email: data.email,
        name: data.name || data.login,
        picture: data.avatar_url,
        verified_email: true, // GitHub emails are verified
      };
    }

    throw new Error(`Unsupported provider: ${providerId}`);
  }

  /**
   * Find or create user from OAuth info
   *
   * @param providerId - Provider ID
   * @param userInfo - OAuth user info
   * @param tenantId - Tenant ID (default: 'default')
   * @returns User ID and whether user was created
   */
  async findOrCreateUser(
    providerId: string,
    userInfo: OAuthUserInfo,
    tenantId: string = 'default'
  ): Promise<{ user_id: string; created: boolean }> {
    // Check for existing OAuth connection
    const existing = await this.pool.query(
      `SELECT user_id FROM oauth_connections
       WHERE provider_id = $1 AND provider_user_id = $2 AND is_active = true`,
      [providerId, userInfo.provider_user_id]
    );

    if (existing.rows.length > 0) {
      // Update last_used_at
      await this.pool.query(
        `UPDATE oauth_connections
         SET last_used_at = NOW()
         WHERE provider_id = $1 AND provider_user_id = $2`,
        [providerId, userInfo.provider_user_id]
      );
      return { user_id: existing.rows[0].user_id, created: false };
    }

    // Create new user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const username = userInfo.email.split('@')[0];

    // Check if username already exists, add suffix if needed
    let finalUsername = username;
    let suffix = 1;
    let usernameExists = await this.pool.query(
      'SELECT 1 FROM users WHERE tenant_id = $1 AND username = $2',
      [tenantId, finalUsername]
    );

    while (usernameExists.rows.length > 0) {
      finalUsername = `${username}${suffix}`;
      suffix++;
      usernameExists = await this.pool.query(
        'SELECT 1 FROM users WHERE tenant_id = $1 AND username = $2',
        [tenantId, finalUsername]
      );
    }

    await this.pool.query(
      `INSERT INTO users (user_id, tenant_id, username, email, roles, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id, username) DO UPDATE SET
         email = EXCLUDED.email,
         roles = EXCLUDED.roles`,
      [userId, tenantId, finalUsername, userInfo.email, ['user']]
    );

    // Create OAuth connection
    await this.createOAuthConnection(userId, providerId, userInfo.provider_user_id);

    return { user_id: userId, created: true };
  }

  /**
   * Create OAuth connection for user
   *
   * @param userId - User ID
   * @param providerId - Provider ID
   * @param providerUserId - Provider's user ID
   * @param accessToken - OAuth access token (optional)
   * @param refreshToken - OAuth refresh token (optional)
   * @param expiresAt - Token expiration time (optional)
   */
  async createOAuthConnection(
    userId: string,
    providerId: string,
    providerUserId: string,
    accessToken?: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<void> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    await this.pool.query(
      `INSERT INTO oauth_connections (
        connection_id, user_id, provider_id, provider_user_id,
        access_token_encrypted, refresh_token_encrypted, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        connectionId,
        userId,
        providerId,
        providerUserId,
        accessToken ? this.encrypt(accessToken) : null,
        refreshToken ? this.encrypt(refreshToken) : null,
        expiresAt || null,
      ]
    );
  }

  /**
   * List OAuth connections for user
   *
   * @param userId - User ID
   * @returns Array of OAuth connections
   */
  async listConnections(userId: string): Promise<OAuthConnection[]> {
    const result = await this.pool.query<OAuthConnection>(
      `SELECT connection_id, user_id, provider_id, provider_user_id, connected_at, last_used_at, is_active
       FROM oauth_connections
       WHERE user_id = $1 AND is_active = true
       ORDER BY connected_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Revoke OAuth connection
   *
   * @param connectionId - Connection ID to revoke
   * @param userId - User ID (for authorization)
   */
  async revokeConnection(connectionId: string, userId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE oauth_connections
       SET is_active = false
       WHERE connection_id = $1 AND user_id = $2
       RETURNING connection_id`,
      [connectionId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Connection not found or access denied');
    }
  }

  /**
   * Update OAuth connection tokens
   *
   * @param connectionId - Connection ID
   * @param accessToken - New access token
   * @param refreshToken - New refresh token (optional)
   * @param expiresAt - New expiration time (optional)
   */
  async updateConnectionTokens(
    connectionId: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<void> {
    await this.pool.query(
      `UPDATE oauth_connections
       SET access_token_encrypted = $1,
           refresh_token_encrypted = $2,
           expires_at = $3,
           last_used_at = NOW()
       WHERE connection_id = $4`,
      [
        this.encrypt(accessToken),
        refreshToken ? this.encrypt(refreshToken) : null,
        expiresAt || null,
        connectionId,
      ]
    );
  }

  /**
   * Get all active providers
   *
   * @returns Array of active provider IDs and names
   */
  async getActiveProviders(): Promise<Array<{ provider_id: string; provider_name: string }>> {
    const result = await this.pool.query(
      `SELECT provider_id, provider_name
       FROM oauth_providers
       WHERE is_active = true
       ORDER BY provider_name`
    );

    return result.rows;
  }

  /**
   * Encrypt sensitive data using AES-256-CBC
   *
   * @param text - Plain text to encrypt
   * @returns Encrypted text with IV
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data using AES-256-CBC
   *
   * @param encryptedText - Encrypted text with IV
   * @returns Decrypted plain text
   */
  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
