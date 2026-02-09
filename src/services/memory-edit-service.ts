import { Pool } from 'pg';
import { generateEditId } from '../utils/id-generator.js';

export type EditOperation = 'retract' | 'amend' | 'quarantine' | 'attenuate' | 'block';
export type EditTarget = 'chunk' | 'decision' | 'capsule';
export type EditStatus = 'pending' | 'approved' | 'rejected';
export type ProposedBy = 'human' | 'agent';

export interface EditPatch {
  text?: string;
  importance?: number;
  importance_delta?: number;
  channel?: string;
}

export interface CreateMemoryEditRequest {
  tenant_id: string;
  target_type: EditTarget;
  target_id: string;
  op: EditOperation;
  reason: string;
  proposed_by: ProposedBy;
  approved_by?: string;
  patch: EditPatch;
  auto_approve?: boolean;
}

export interface MemoryEdit {
  edit_id: string;
  tenant_id: string;
  ts: Date;
  target_type: EditTarget;
  target_id: string;
  op: EditOperation;
  reason: string;
  proposed_by: ProposedBy;
  approved_by: string | null;
  status: EditStatus;
  patch: EditPatch;
  created_at: Date;
  applied_at: Date | null;
}

/**
 * Service for memory surgery operations (retract, amend, quarantine, attenuate, block)
 */
export class MemoryEditService {
  constructor(private pool: Pool) {}

  /**
   * Create a new memory edit
   */
  async createMemoryEdit(request: CreateMemoryEditRequest): Promise<MemoryEdit> {
    const edit_id = generateEditId();
    const created_at = new Date();
    const status: EditStatus = request.auto_approve ? 'approved' : 'pending';
    const applied_at: Date | null = request.auto_approve ? new Date() : null;

    // Validate target exists
    await this.validateTarget(request.target_type, request.target_id, request.tenant_id);

    // Validate operation has required patch fields
    this.validatePatchForOperation(request.op, request.patch);

    // Create edit
    const result = await this.pool.query(
      `INSERT INTO memory_edits (
        edit_id, tenant_id, target_type, target_id, op, reason, proposed_by,
        approved_by, status, patch, created_at, applied_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        edit_id,
        request.tenant_id,
        request.target_type,
        request.target_id,
        request.op,
        request.reason,
        request.proposed_by,
        request.approved_by || null,
        status,
        JSON.stringify(request.patch),
        created_at,
        applied_at,
      ]
    );

    return this.mapRowToMemoryEdit(result.rows[0]);
  }

  /**
   * Get edits for a target
   */
  async getEditsForTarget(
    tenant_id: string,
    target_type: EditTarget,
    target_id: string,
    status?: EditStatus
  ): Promise<MemoryEdit[]> {
    let query = `
      SELECT * FROM memory_edits
      WHERE tenant_id = $1 AND target_type = $2 AND target_id = $3
    `;
    const params: any[] = [tenant_id, target_type, target_id];

    if (status) {
      query += ` AND status = $4`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToMemoryEdit(row));
  }

  /**
   * Get edit by ID
   */
  async getEdit(edit_id: string): Promise<MemoryEdit | null> {
    const result = await this.pool.query(
      'SELECT * FROM memory_edits WHERE edit_id = $1',
      [edit_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToMemoryEdit(result.rows[0]);
  }

  /**
   * List edits with filters
   */
  async listEdits(
    tenant_id: string,
    filters: {
      status?: EditStatus;
      target_type?: EditTarget;
      proposed_by?: string;
      limit?: number;
    } = {}
  ): Promise<MemoryEdit[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenant_id];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.target_type) {
      conditions.push(`target_type = $${paramIndex++}`);
      params.push(filters.target_type);
    }

    if (filters.proposed_by) {
      conditions.push(`proposed_by = $${paramIndex++}`);
      params.push(filters.proposed_by);
    }

    const limit = filters.limit || 100;
    const query = `
      SELECT * FROM memory_edits
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++}
    `;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToMemoryEdit(row));
  }

  /**
   * Approve a pending edit
   */
  async approveEdit(edit_id: string, approved_by: string): Promise<MemoryEdit | null> {
    const result = await this.pool.query(
      `UPDATE memory_edits
       SET status = 'approved',
           approved_by = $2,
           applied_at = NOW()
       WHERE edit_id = $1
         AND status = 'pending'
       RETURNING *`,
      [edit_id, approved_by]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToMemoryEdit(result.rows[0]);
  }

  /**
   * Reject a pending edit
   */
  async rejectEdit(edit_id: string): Promise<MemoryEdit | null> {
    const result = await this.pool.query(
      `UPDATE memory_edits
       SET status = 'rejected'
       WHERE edit_id = $1
         AND status = 'pending'
       RETURNING *`,
      [edit_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToMemoryEdit(result.rows[0]);
  }

  /**
   * Validate target exists and belongs to tenant
   */
  private async validateTarget(
    target_type: EditTarget,
    target_id: string,
    tenant_id: string
  ): Promise<void> {
    const tableMap: Record<EditTarget, string> = {
      chunk: 'chunks',
      decision: 'decisions',
      capsule: 'capsules',
    };

    const table = tableMap[target_type];
    const idColumn = target_type === 'capsule' ? 'capsule_id' : `${target_type}_id`;

    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM ${table}
       WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [target_id, tenant_id]
    );

    if (parseInt(result.rows[0].count) === 0) {
      throw new Error(`Target ${target_type}:${target_id} not found or belongs to different tenant`);
    }
  }

  /**
   * Validate patch has required fields for operation
   */
  private validatePatchForOperation(op: EditOperation, patch: EditPatch): void {
    switch (op) {
      case 'amend':
        // Amend should have at least text or importance
        if (!patch.text && patch.importance === undefined) {
          throw new Error('Amend operation requires at least text or importance in patch');
        }
        break;
      case 'attenuate':
        // Attenuate should have importance_delta or importance
        if (patch.importance_delta === undefined && patch.importance === undefined) {
          throw new Error('Attenuate operation requires importance_delta or importance in patch');
        }
        break;
      case 'block':
        // Block should have channel
        if (!patch.channel) {
          throw new Error('Block operation requires channel in patch');
        }
        break;
      case 'retract':
      case 'quarantine':
        // These operations don't require patch fields
        break;
    }
  }

  /**
   * Map database row to MemoryEdit object
   */
  private mapRowToMemoryEdit(row: any): MemoryEdit {
    return {
      edit_id: row.edit_id,
      tenant_id: row.tenant_id,
      ts: row.ts,
      target_type: row.target_type,
      target_id: row.target_id,
      op: row.op,
      reason: row.reason,
      proposed_by: row.proposed_by,
      approved_by: row.approved_by,
      status: row.status,
      patch: typeof row.patch === 'string' ? JSON.parse(row.patch) : row.patch,
      created_at: row.created_at,
      applied_at: row.applied_at,
    };
  }
}
