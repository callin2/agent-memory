/**
 * Node.js Client Example - Agent Memory System with Authentication
 *
 * This example demonstrates how to use the Agent Memory System API
 * with the new authentication features (JWT tokens and refresh tokens).
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  user: {
    user_id: string;
    tenant_id: string;
    username: string;
    roles: string[];
  };
}

interface ACBResponse {
  token_used_est: number;
  budget_tokens: number;
  sections: Array<{
    name: string;
    token_est: number;
    items: Array<{ text: string }>;
  }>;
}

class AgentMemoryClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Login and obtain authentication tokens
   */
  async login(username: string, password: string, tenantId: string = 'default'): Promise<void> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        tenant_id: tenantId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.statusText}`);
    }

    const data = (await response.json()) as AuthResponse;

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    console.log(`✅ Logged in as ${data.user.username}`);
    console.log(`   Access token expires in ${data.expires_in}s`);
    console.log(`   Refresh token expires in ${data.refresh_expires_in}s`);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_BASE}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = (await response.json()) as AuthResponse;

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token; // New refresh token (rotation)
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    console.log('✅ Access token refreshed');
    console.log('   New refresh token issued (old token revoked)');
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Record an event to memory
   */
  async recordEvent(params: {
    session_id: string;
    channel: 'private' | 'public' | 'team' | 'agent';
    actor: { type: 'human' | 'agent' | 'tool'; id: string };
    kind: string;
    content: any;
  }): Promise<any> {
    await this.ensureAuthenticated();

    const response = await fetch(`${API_BASE}/api/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        ...params,
        sensitivity: 'none',
        tags: [],
      }),
    });

    if (!response.ok) {
      throw new Error(`Event recording failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Build an Active Context Bundle
   */
  async buildACB(params: {
    session_id: string;
    agent_id: string;
    channel: 'private' | 'public' | 'team' | 'agent';
    intent: string;
    query_text?: string;
  }): Promise<ACBResponse> {
    await this.ensureAuthenticated();

    const response = await fetch(`${API_BASE}/api/v1/acb/build`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`ACB build failed: ${response.statusText}`);
    }

    return response.json() as Promise<ACBResponse>;
  }

  /**
   * List active sessions
   */
  async listSessions(): Promise<any[]> {
    await this.ensureAuthenticated();

    const response = await fetch(`${API_BASE}/auth/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.statusText}`);
    }

    const data = (await response.json()) as { sessions: any[] };
    return data.sessions;
  }

  /**
   * Logout and revoke refresh token
   */
  async logout(): Promise<void> {
    if (!this.refreshToken) {
      return;
    }

    const response = await fetch(`${API_BASE}/auth/token/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        refresh_token: this.refreshToken,
      }),
    });

    if (response.ok) {
      console.log('✅ Logged out successfully');
    }

    this.accessToken = null;
    this.refreshToken = null;
  }
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

async function main() {
  const client = new AgentMemoryClient();

  try {
    console.log('=== Agent Memory System - Authentication Example ===\n');

    // 1. Login
    console.log('1. Logging in...');
    await client.login('testuser', 'password123', 'my-tenant');

    // 2. Record an event
    console.log('\n2. Recording an event...');
    const eventResult = await client.recordEvent({
      session_id: 'session-123',
      channel: 'private',
      actor: { type: 'human', id: 'user-456' },
      kind: 'message',
      content: { text: 'Hello, Agent Memory System!' },
    });
    console.log(`   Event recorded: ${eventResult.event_id}`);

    // 3. Build Active Context Bundle
    console.log('\n3. Building Active Context Bundle...');
    const acb = await client.buildACB({
      session_id: 'session-123',
      agent_id: 'agent-789',
      channel: 'private',
      intent: 'Respond to user greeting',
      query_text: 'user greeting',
    });
    console.log(`   ACB built: ${acb.token_used_est}/${acb.budget_tokens} tokens`);
    console.log(`   Sections: ${acb.sections.map((s) => s.name).join(', ')}`);

    // 4. List sessions
    console.log('\n4. Listing active sessions...');
    const sessions = await client.listSessions();
    console.log(`   Active sessions: ${sessions.length}`);
    sessions.forEach((s) => {
      console.log(`   - ${s.session_id} (${s.is_active ? 'active' : 'inactive'})`);
    });

    // 5. Logout
    console.log('\n5. Logging out...');
    await client.logout();

    console.log('\n=== Example completed successfully! ===');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);
