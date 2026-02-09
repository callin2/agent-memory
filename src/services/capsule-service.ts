import { Pool } from 'pg';
import { generateCapsuleId } from '../utils/id-generator.js';

export interface CapsuleItem {
  chunks: string[];
  decisions: string[];
  artifacts: string[];
}

export interface CreateCapsuleRequest {
  tenant_id: string;
  author_agent_id: string;
  subject_type: string;
  subject_id: string;
  scope: 'session' | 'user' | 'project' | 'policy' | 'global';
  project_id?: string;
  audience_agent_ids: string[];
  items: CapsuleItem;
  ttl_days?: number;
  risks?: string[];
}

export interface Capsule {
  capsule_id: string;
  tenant_id: string;
  ts: Date;
  scope: string;
  subject_type: string;
  subject_id: string;
  project_id: string | null;
  author_agent_id: string;
  ttl_days: number;
  status: string;
  audience_agent_ids: string[];
  items: CapsuleItem;
  risks: string[];
  created_at: Date;
  expires_at: Date;
}

/**
 * Service for capsule operations (create, query, revoke)
 */
export class CapsuleService {
  constructor(private pool: Pool) {}

  /**
   * Create a new capsule with curated memory items
   */
  async createCapsule(request: CreateCapsuleRequest): Promise<Capsule> {
    const capsule_id = generateCapsuleId();
    const ttl_days = request.ttl_days || 7;
    const created_at = new Date();
    const expires_at = new Date(created_at.getTime() + ttl_days * 24 * 60 * 60 * 1000);

    // Validate referenced items exist and belong to tenant
    await this.validateCapsuleItems(request.tenant_id, request.items);

    // Validate audience agents exist
    await this.validateAudienceAgents(request.tenant_id, request.audience_agent_ids);

    // Create capsule
    const result = await this.pool.query(
      `INSERT INTO capsules (
        capsule_id, tenant_id, scope, subject_type, subject_id, project_id,
        author_agent_id, ttl_days, status, audience_agent_ids, items, risks,
        created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        capsule_id,
        request.tenant_id,
        request.scope,
        request.subject_type,
        request.subject_id,
        request.project_id || null,
        request.author_agent_id,
        ttl_days,
        'active',
        request.audience_agent_ids,
        JSON.stringify(request.items),
        request.risks || [],
        created_at,
        expires_at,
      ]
    );

    return this.mapRowToCapsule(result.rows[0]);
  }

  /**
   * Get available capsules for an agent
   */
  async getAvailableCapsules(
    tenant_id: string,
    agent_id: string,
    subject_type?: string,
    subject_id?: string
  ): Promise<Capsule[]> {
    const result = await this.pool.query(
      `SELECT * FROM capsules
       WHERE tenant_id = $1
         AND status = 'active'
         AND expires_at > NOW()
         AND $2 = ANY(audience_agent_ids)
         AND ($3::text IS NULL OR subject_type = $3)
         AND ($4::text IS NULL OR subject_id = $4)
       ORDER BY ts DESC`,
      [tenant_id, agent_id, subject_type || null, subject_id || null]
    );

    return result.rows.map(row => this.mapRowToCapsule(row));
  }

  /**
   * Get a specific capsule by ID
   */
  async getCapsule(capsule_id: string, agent_id: string): Promise<Capsule | null> {
    const result = await this.pool.query(
      `SELECT * FROM capsules
       WHERE capsule_id = $1
         AND status = 'active'
         AND expires_at > NOW()
         AND $2 = ANY(audience_agent_ids)`,
      [capsule_id, agent_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCapsule(result.rows[0]);
  }

  /**
   * Revoke a capsule
   */
  async revokeCapsule(capsule_id: string, tenant_id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE capsules
       SET status = 'revoked'
       WHERE capsule_id = $1
         AND tenant_id = $2
         AND status = 'active'
       RETURNING capsule_id`,
      [capsule_id, tenant_id]
    );

    return result.rows.length > 0;
  }

  /**
   * Validate that all referenced items exist and belong to tenant
   */
  private async validateCapsuleItems(
    tenant_id: string,
    items: CapsuleItem
  ): Promise<void> {
    // Validate chunks
    if (items.chunks.length > 0) {
      const chunkResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM chunks
         WHERE chunk_id = ANY($1)
         AND tenant_id = $2`,
        [items.chunks, tenant_id]
      );

      if (parseInt(chunkResult.rows[0].count) !== items.chunks.length) {
        throw new Error('One or more referenced chunks not found or belong to different tenant');
      }
    }

    // Validate decisions
    if (items.decisions.length > 0) {
      const decisionResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM decisions
         WHERE decision_id = ANY($1)
         AND tenant_id = $2`,
        [items.decisions, tenant_id]
      );

      if (parseInt(decisionResult.rows[0].count) !== items.decisions.length) {
        throw new Error('One or more referenced decisions not found or belong to different tenant');
      }
    }

    // Validate artifacts
    if (items.artifacts.length > 0) {
      const artifactResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM artifacts
         WHERE artifact_id = ANY($1)
         AND tenant_id = $2`,
        [items.artifacts, tenant_id]
      );

      if (parseInt(artifactResult.rows[0].count) !== items.artifacts.length) {
        throw new Error('One or more referenced artifacts not found or belong to different tenant');
      }
    }
  }

  /**
   * Validate that all audience agents exist
   */
  private async validateAudienceAgents(
    tenant_id: string,
    audience_agent_ids: string[]
  ): Promise<void> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM users
       WHERE user_id = ANY($1)
       AND tenant_id = $2`,
      [audience_agent_ids, tenant_id]
    );

    if (parseInt(result.rows[0].count) !== audience_agent_ids.length) {
      throw new Error('One or more audience agents not found or belong to different tenant');
    }
  }

  /**
   * Map database row to Capsule object
   */
  private mapRowToCapsule(row: any): Capsule {
    return {
      capsule_id: row.capsule_id,
      tenant_id: row.tenant_id,
      ts: row.ts,
      scope: row.scope,
      subject_type: row.subject_type,
      subject_id: row.subject_id,
      project_id: row.project_id,
      author_agent_id: row.author_agent_id,
      ttl_days: row.ttl_days,
      status: row.status,
      audience_agent_ids: row.audience_agent_ids,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
      risks: row.risks,
      created_at: row.created_at,
      expires_at: row.expires_at,
    };
  }
}
