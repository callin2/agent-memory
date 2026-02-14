import { APIRequestContext, APIResponse } from '@playwright/test'

/**
 * API Helper for E2E Tests
 *
 * Provides direct API access to verify backend operations
 * independent of the frontend UI.
 */
export class APIHelper {
  private baseURL: string

  constructor(private request: APIRequestContext, baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL
  }

  /**
   * Get authentication headers (simplified - no frontend auth)
   */
  private getAuthHeaders(tenantId: string, userId: string) {
    return {
      'X-Tenant-ID': tenantId,
      'X-User-ID': userId,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Create a test tenant
   */
  async createTenant(tenantId: string, name: string): Promise<APIResponse> {
    const response = await this.request.post(`${this.baseURL}/api/v1/tenants`, {
      headers: this.getAuthHeaders(tenantId, 'system'),
      data: { tenant_id: tenantId, name, settings: {} },
    })
    return response
  }

  /**
   * Create a test user
   */
  async createUser(tenantId: string, userId: string, roles: string[] = ['agent']): Promise<APIResponse> {
    const response = await this.request.post(`${this.baseURL}/api/v1/users`, {
      headers: this.getAuthHeaders(tenantId, 'system'),
      data: {
        user_id: userId,
        tenant_id: tenantId,
        username: userId,
        roles,
      },
    })
    return response
  }

  /**
   * Create a memory capsule
   */
  async createCapsule(tenantId: string, userId: string, capsuleData: any): Promise<APIResponse> {
    const response = await this.request.post(`${this.baseURL}/api/v1/capsules`, {
      headers: this.getAuthHeaders(tenantId, userId),
      data: {
        tenant_id: tenantId,
        author_agent_id: userId,
        ...capsuleData,
      },
    })
    return response
  }

  /**
   * Get capsules
   */
  async getCapsules(tenantId: string, userId: string, filters?: Record<string, string>): Promise<APIResponse> {
    const url = new URL(`${this.baseURL}/api/v1/capsules`)
    url.searchParams.set('tenant_id', tenantId)
    url.searchParams.set('agent_id', userId)

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }

    const response = await this.request.get(url.toString(), {
      headers: this.getAuthHeaders(tenantId, userId),
    })
    return response
  }

  /**
   * Get a specific capsule
   */
  async getCapsule(tenantId: string, userId: string, capsuleId: string): Promise<APIResponse> {
    const response = await this.request.get(
      `${this.baseURL}/api/v1/capsules/${capsuleId}?agent_id=${userId}`,
      {
        headers: this.getAuthHeaders(tenantId, userId),
      }
    )
    return response
  }

  /**
   * Revoke a capsule
   */
  async revokeCapsule(tenantId: string, capsuleId: string): Promise<APIResponse> {
    const response = await this.request.delete(`${this.baseURL}/api/v1/capsules/${capsuleId}`, {
      headers: this.getAuthHeaders(tenantId, 'system'),
      data: { tenant_id: tenantId },
    })
    return response
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<APIResponse> {
    return await this.request.get(`${this.baseURL}/health`)
  }

  /**
   * Metrics check
   */
  async getMetrics(): Promise<APIResponse> {
    return await this.request.get(`${this.baseURL}/metrics`)
  }
}
