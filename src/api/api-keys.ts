/**
 * API Key Management API
 *
 * Endpoints for creating, listing, and managing API keys.
 * Requires authentication with existing API key or session.
 */

import { Router, Request } from 'express';
import { Pool } from 'pg';
import { randomBytes } from 'crypto';

export function createApiKeyRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/v1/api-keys
   *
   * Create a new API key
   * Body: { name, permissions, description?, expires_at? }
   */
  router.post('/', async (req: Request, res) => {
    try {
      const { tenant_id } = req.body;
      const { name, permissions, description, expires_at } = req.body;

      if (!tenant_id) {
        return res.status(400).json({ error: 'tenant_id is required' });
      }

      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      // Generate API key
      const apiKey = `ak_${randomBytes(32).toString('hex')}`;
      const keyPrefix = apiKey.substring(0, 10);
      const crypto = await import('crypto');
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      // Default permissions
      const keyPermissions = permissions || {
        can_read: true,
        can_write: false,
        can_delete: false,
        can_admin: false,
      };

      // Insert into database
      const result = await pool.query(
        `INSERT INTO api_keys (tenant_id, name, key_prefix, key_hash, permissions, description, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, tenant_id, name, key_prefix, permissions, is_active, created_at, expires_at`,
        [
          tenant_id,
          name,
          keyPrefix,
          keyHash,
          JSON.stringify(keyPermissions),
          description || null,
          expires_at || null,
          'system', // TODO: use actual user from auth
        ]
      );

      const newKey = result.rows[0];

      // Return the full API key (only time it's shown!)
      return res.status(201).json({
        ...newKey,
        api_key: apiKey, // Only shown on creation
        warning: 'Save this API key now. You will not be able to see it again.',
      });
    } catch (error) {
      console.error('[API Keys] Error creating API key:', error);
      return res.status(500).json({
        error: 'Failed to create API key',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/v1/api-keys
   *
   * List all API keys for a tenant
   */
  router.get('/', async (req: Request, res) => {
    try {
      const tenant_id = req.query.tenant_id as string || req.body.tenant_id;

      if (!tenant_id) {
        return res.status(400).json({ error: 'tenant_id is required' });
      }

      const result = await pool.query(
        `SELECT
           id,
           tenant_id,
           name,
           key_prefix,
           permissions,
           is_active,
           created_at,
           last_used_at,
           expires_at,
           description
         FROM api_keys
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenant_id]
      );

      return res.json({
        tenant_id,
        api_keys: result.rows,
        count: result.rows.length,
      });
    } catch (error) {
      console.error('[API Keys] Error listing API keys:', error);
      return res.status(500).json({
        error: 'Failed to list API keys',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/v1/api-keys/:id
   *
   * Get details of a specific API key
   */
  router.get('/:id', async (req: Request, res) => {
    try {
      const { id } = req.params;
      const tenant_id = req.query.tenant_id as string || req.body.tenant_id;

      if (!tenant_id) {
        return res.status(400).json({ error: 'tenant_id is required' });
      }

      const result = await pool.query(
        `SELECT
           id,
           tenant_id,
           name,
           key_prefix,
           permissions,
           is_active,
           created_at,
           last_used_at,
           expires_at,
           description,
           revoked_at,
           revoked_reason
         FROM api_keys
         WHERE id = $1 AND tenant_id = $2`,
        [id, tenant_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error('[API Keys] Error getting API key:', error);
      return res.status(500).json({
        error: 'Failed to get API key',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PATCH /api/v1/api-keys/:id
   *
   * Update API key (name, description, permissions)
   * Cannot update the key itself - must create new key and revoke old one
   */
  router.patch('/:id', async (req: Request, res) => {
    try {
      const { id } = req.params;
      const tenant_id = req.body.tenant_id;
      const { name, description, permissions } = req.body;

      if (!tenant_id) {
        return res.status(400).json({ error: 'tenant_id is required' });
      }

      // Build update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }

      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
      }

      if (permissions !== undefined) {
        updates.push(`permissions = $${paramCount++}`);
        values.push(JSON.stringify(permissions));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      values.push(id, tenant_id);

      const result = await pool.query(
        `UPDATE api_keys
         SET ${updates.join(', ')}
         WHERE id = $${paramCount++} AND tenant_id = $${paramCount++}
         RETURNING id, tenant_id, name, key_prefix, permissions, is_active, created_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error('[API Keys] Error updating API key:', error);
      return res.status(500).json({
        error: 'Failed to update API key',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /api/v1/api-keys/:id
   *
   * Revoke an API key
   */
  router.delete('/:id', async (req: Request, res) => {
    try {
      const { id } = req.params;
      const tenant_id = req.body.tenant_id;
      const { reason } = req.body;

      if (!tenant_id) {
        return res.status(400).json({ error: 'tenant_id is required' });
      }

      const result = await pool.query(
        `UPDATE api_keys
         SET is_active = false,
             revoked_at = NOW(),
             revoked_reason = $1
         WHERE id = $2 AND tenant_id = $3
         RETURNING id, tenant_id, name, key_prefix`,
        [reason || null, id, tenant_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }

      return res.json({
        message: 'API key revoked successfully',
        api_key: result.rows[0],
      });
    } catch (error) {
      console.error('[API Keys] Error revoking API key:', error);
      return res.status(500).json({
        error: 'Failed to revoke API key',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
