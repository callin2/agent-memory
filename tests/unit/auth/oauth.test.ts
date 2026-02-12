/**
 * OAuth Service Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OAuthService } from "../../../src/services/oauth-service.js";

describe("OAuth Service", () => {
  let oauthService: OAuthService;
  let mockPool: any;
  let mockQuery: any;

  beforeEach(() => {
    mockQuery = vi.fn();
    mockPool = {
      query: mockQuery,
    };
    oauthService = new OAuthService(mockPool);

    // Mock process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = "test-encryption-key-32-chars-long!";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getProvider", () => {
    it("should return provider configuration", async () => {
      const mockProvider = {
        provider_id: "google",
        provider_name: "Google",
        client_id: "test-client-id",
        client_secret_encrypted: (oauthService as any).encrypt(
          "test-client-secret",
        ),
        authorization_url: "https://accounts.google.com/o/oauth2/v2/auth",
        token_url: "https://oauth2.googleapis.com/token",
        user_info_url: "https://www.googleapis.com/oauth2/v2/userinfo",
        scopes: ["openid", "profile", "email"],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockProvider] });

      const provider = await oauthService.getProvider("google");

      expect(provider).not.toBeNull();
      expect(provider?.provider_id).toBe("google");
      expect(provider?.client_id).toBe("test-client-id");
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT provider_id"),
        ["google"],
      );
    });

    it("should return null for non-existent provider", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const provider = await oauthService.getProvider("nonexistent");

      expect(provider).toBeNull();
    });

    it("should only return active providers", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await oauthService.getProvider("google");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("is_active = true"),
        expect.anything(),
      );
    });
  });

  describe("getAuthorizationUrl", () => {
    it("should generate authorization URL with state", async () => {
      const mockProvider = {
        provider_id: "google",
        provider_name: "Google",
        client_id: "test-client-id",
        client_secret_encrypted: (oauthService as any).encrypt(
          "test-client-secret",
        ),
        authorization_url: "https://accounts.google.com/o/oauth2/v2/auth",
        token_url: "https://oauth2.googleapis.com/token",
        user_info_url: "https://www.googleapis.com/oauth2/v2/userinfo",
        scopes: ["openid", "profile", "email"],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockProvider] });

      const authUrl = await oauthService.getAuthorizationUrl(
        "google",
        "http://localhost:3000/callback",
        "random-state-123",
      );

      expect(authUrl).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(authUrl).toContain("client_id=test-client-id");
      expect(authUrl).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback",
      );
      expect(authUrl).toContain("scope=openid+profile+email");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("state=random-state-123");
    });

    it("should throw error for non-existent provider", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        oauthService.getAuthorizationUrl(
          "nonexistent",
          "http://localhost:3000/callback",
          "state",
        ),
      ).rejects.toThrow("OAuth provider not found");
    });
  });

  describe("encryption/decryption", () => {
    it("should encrypt and decrypt text correctly", async () => {
      const mockProvider = {
        provider_id: "google",
        provider_name: "Google",
        client_id: "test-client-id",
        client_secret_encrypted: (oauthService as any).encrypt(
          "test-client-secret",
        ),
        authorization_url: "https://accounts.google.com/o/oauth2/v2/auth",
        token_url: "https://oauth2.googleapis.com/token",
        user_info_url: "https://www.googleapis.com/oauth2/v2/userinfo",
        scopes: ["openid", "profile", "email"],
      };

      // Access private methods through test
      const testEncryption = async () => {
        mockQuery.mockResolvedValueOnce({ rows: [mockProvider] });

        const provider = await oauthService.getProvider("google");
        expect(provider?.client_secret).toBeDefined();

        const original = "test-secret-value";
        const encrypted = (oauthService as any).encrypt(original);
        const decrypted = (oauthService as any).decrypt(encrypted);

        expect(decrypted).toBe(original);
        expect(encrypted).not.toBe(original);
        expect(encrypted).toContain(":"); // IV separator
      };

      await testEncryption();
    });
  });

  describe("listConnections", () => {
    it("should return user OAuth connections", async () => {
      const mockConnections = [
        {
          connection_id: "conn_1",
          user_id: "user_123",
          provider_id: "google",
          provider_user_id: "google_user_123",
          connected_at: new Date(),
          last_used_at: new Date(),
          is_active: true,
        },
        {
          connection_id: "conn_2",
          user_id: "user_123",
          provider_id: "github",
          provider_user_id: "github_user_456",
          connected_at: new Date(),
          last_used_at: null,
          is_active: true,
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockConnections });

      const connections = await oauthService.listConnections("user_123");

      expect(connections).toHaveLength(2);
      expect(connections[0].provider_id).toBe("google");
      expect(connections[1].provider_id).toBe("github");
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT connection_id"),
        ["user_123"],
      );
    });

    it("should only return active connections", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await oauthService.listConnections("user_123");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("is_active = true"),
        expect.anything(),
      );
    });
  });

  describe("revokeConnection", () => {
    it("should revoke OAuth connection", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ connection_id: "conn_1" }],
      });

      await oauthService.revokeConnection("conn_1", "user_123");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE oauth_connections"),
        ["conn_1", "user_123"],
      );
    });

    it("should throw error for non-existent connection", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        oauthService.revokeConnection("nonexistent", "user_123"),
      ).rejects.toThrow("Connection not found or access denied");
    });
  });

  describe("getActiveProviders", () => {
    it("should return list of active providers", async () => {
      const mockProviders = [
        { provider_id: "google", provider_name: "Google" },
        { provider_id: "github", provider_name: "GitHub" },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockProviders });

      const providers = await oauthService.getActiveProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0].provider_id).toBe("google");
      expect(providers[1].provider_id).toBe("github");
    });
  });

  describe("findOrCreateUser", () => {
    it("should return existing user for OAuth connection", async () => {
      const mockConnection = {
        user_id: "existing_user",
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockConnection] });
      mockQuery.mockResolvedValueOnce({}); // Update last_used_at

      const result = await oauthService.findOrCreateUser(
        "google",
        {
          provider_user_id: "google_user_123",
          email: "test@example.com",
          name: "Test User",
        },
        "default",
      );

      expect(result.user_id).toBe("existing_user");
      expect(result.created).toBe(false);
    });

    it("should create new user for new OAuth connection", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No existing connection
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Username check
      mockQuery.mockResolvedValueOnce({}); // Insert user
      mockQuery.mockResolvedValueOnce({}); // Create OAuth connection

      const result = await oauthService.findOrCreateUser(
        "google",
        {
          provider_user_id: "google_user_123",
          email: "test@example.com",
          name: "Test User",
        },
        "default",
      );

      expect(result.user_id).toBeDefined();
      expect(result.created).toBe(true);
      expect(result.user_id).toMatch(/^user_/);
    });

    it("should add suffix if username already exists", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No existing connection
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: "existing" }] }); // Username exists
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Username with suffix
      mockQuery.mockResolvedValueOnce({}); // Insert user
      mockQuery.mockResolvedValueOnce({}); // Create OAuth connection

      const result = await oauthService.findOrCreateUser(
        "google",
        {
          provider_user_id: "google_user_123",
          email: "test@example.com",
          name: "Test User",
        },
        "default",
      );

      expect(result.created).toBe(true);
      expect(mockQuery).toHaveBeenCalledTimes(5);
    });
  });

  describe("createOAuthConnection", () => {
    it("should create OAuth connection with tokens", async () => {
      mockQuery.mockResolvedValueOnce({});

      await oauthService.createOAuthConnection(
        "user_123",
        "google",
        "google_user_123",
        "access_token_value",
        "refresh_token_value",
        new Date(Date.now() + 3600000),
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO oauth_connections"),
        expect.any(Array),
      );
    });

    it("should create OAuth connection without tokens", async () => {
      mockQuery.mockResolvedValueOnce({});

      await oauthService.createOAuthConnection(
        "user_123",
        "google",
        "google_user_123",
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO oauth_connections"),
        expect.arrayContaining([
          expect.any(String), // connection_id
          "user_123",
          "google",
          "google_user_123",
          null, // access_token_encrypted
          null, // refresh_token_encrypted
          null, // expires_at
        ]),
      );
    });
  });

  describe("updateConnectionTokens", () => {
    it("should update connection tokens", async () => {
      mockQuery.mockResolvedValueOnce({});

      await oauthService.updateConnectionTokens(
        "conn_1",
        "new_access_token",
        "new_refresh_token",
        new Date(Date.now() + 3600000),
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE oauth_connections"),
        expect.any(Array),
      );
    });
  });
});
