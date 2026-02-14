import { Pool } from 'pg'

/**
 * Database Helper for E2E Tests
 *
 * Provides direct database access to verify data persistence
 * independent of the API and UI layers.
 */
export class DatabaseHelper {
  private pool: Pool | null = null

  /**
   * Connect to the test database
   */
  async connect() {
    this.pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.TEST_DB || 'agent_memory_dev',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
    })

    // Test connection
    await this.pool.query('SELECT 1')
    console.log('Database helper connected successfully')
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }

  /**
   * Ensure pool is connected
   */
  private ensureConnected() {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.')
    }
  }

  /**
   * Create a test tenant
   */
  async createTenant(tenantId: string, name: string) {
    this.ensureConnected()
    await this.pool.query(
      'INSERT INTO tenants (tenant_id, name, settings) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [tenantId, name, '{}']
    )
  }

  /**
   * Create a test user
   */
  async createUser(tenantId: string, userId: string, roles: string[] = ['agent']) {
    this.ensureConnected()
    await this.pool.query(
      'INSERT INTO users (user_id, tenant_id, username, password_hash, roles) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
      [userId, tenantId, userId, 'test_hash', roles]
    )
  }

  /**
   * Get capsule by ID
   */
  async getCapsule(capsuleId: string) {
    this.ensureConnected()
    const result = await this.pool.query(
      'SELECT * FROM capsules WHERE capsule_id = $1',
      [capsuleId]
    )
    return result.rows[0] || null
  }

  /**
   * List capsules for tenant
   */
  async listCapsules(tenantId: string) {
    this.ensureConnected()
    const result = await this.pool.query(
      'SELECT * FROM capsules WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    )
    return result.rows
  }

  /**
   * Count capsules for tenant
   */
  async countCapsules(tenantId: string): Promise<number> {
    this.ensureConnected()
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM capsules WHERE tenant_id = $1',
      [tenantId]
    )
    return parseInt(result.rows[0].count)
  }

  /**
   * Get capsule status
   */
  async getCapsuleStatus(capsuleId: string): Promise<string | null> {
    this.ensureConnected()
    const result = await this.pool.query(
      'SELECT status FROM capsules WHERE capsule_id = $1',
      [capsuleId]
    )
    return result.rows[0]?.status || null
  }

  /**
   * Verify capsule exists in database
   */
  async capsuleExists(capsuleId: string): Promise<boolean> {
    this.ensureConnected()
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM capsules WHERE capsule_id = $1',
      [capsuleId]
    )
    return parseInt(result.rows[0].count) > 0
  }

  /**
   * Get capsule count by status
   */
  async countCapsulesByStatus(tenantId: string, status: string): Promise<number> {
    this.ensureConnected()
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM capsules WHERE tenant_id = $1 AND status = $2',
      [tenantId, status]
    )
    return parseInt(result.rows[0].count)
  }

  /**
   * Clean up test data
   */
  async cleanupTenant(tenantId: string) {
    this.ensureConnected()
    await this.pool.query('DELETE FROM capsules WHERE tenant_id = $1', [tenantId])
    await this.pool.query('DELETE FROM users WHERE tenant_id = $1', [tenantId])
    await this.pool.query('DELETE FROM tenants WHERE tenant_id = $1', [tenantId])
  }

  /**
   * Get all events for subject
   */
  async getEventsBySubject(tenantId: string, subjectId: string) {
    this.ensureConnected()
    const result = await this.pool.query(
      `SELECT * FROM events
       WHERE tenant_id = $1 AND subject_id = $2
       ORDER BY ts DESC`,
      [tenantId, subjectId]
    )
    return result.rows
  }

  /**
   * Count events for subject
   */
  async countEvents(tenantId: string, subjectId: string): Promise<number> {
    this.ensureConnected()
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM events WHERE tenant_id = $1 AND subject_id = $2',
      [tenantId, subjectId]
    )
    return parseInt(result.rows[0].count)
  }
}
