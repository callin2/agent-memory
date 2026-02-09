import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { CapsuleService } from '../services/capsule-service.js';
import { MemoryEditService } from '../services/memory-edit-service.js';

export function createMemoryRoutes(pool: Pool): Router {
  const router = Router();
  const capsuleService = new CapsuleService(pool);
  const memoryEditService = new MemoryEditService(pool);

  // ===== Capsule Endpoints =====

  /**
   * POST /api/v1/capsules
   * Create a new capsule
   */
  router.post('/capsules', async (req: Request, res: Response) => {
    try {
      const capsule = await capsuleService.createCapsule(req.body);
      return res.status(201).json({
        capsule_id: capsule.capsule_id,
        status: capsule.status,
        expires_at: capsule.expires_at,
      });
    } catch (error: any) {
      console.error('Error creating capsule:', error);
      return res.status(400).json({
        error: 'Failed to create capsule',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/capsules
   * List available capsules for the requesting agent
   */
  router.get('/capsules', async (req: Request, res: Response) => {
    try {
      const { tenant_id, agent_id, subject_type, subject_id } = req.query;

      if (!tenant_id || !agent_id) {
        return res.status(400).json({
          error: 'Missing required parameters: tenant_id, agent_id',
        });
      }

      const capsules = await capsuleService.getAvailableCapsules(
        tenant_id as string,
        agent_id as string,
        subject_type as string | undefined,
        subject_id as string | undefined
      );

      return res.json({ capsules, count: capsules.length });
    } catch (error: any) {
      console.error('Error getting capsules:', error);
      return res.status(500).json({
        error: 'Failed to get capsules',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/capsules/:capsule_id
   * Get a specific capsule
   */
  router.get('/capsules/:capsule_id', async (req: Request, res: Response) => {
    try {
      const { agent_id } = req.query;

      if (!agent_id) {
        return res.status(400).json({
          error: 'Missing required parameter: agent_id',
        });
      }

      const capsule = await capsuleService.getCapsule(
        req.params.capsule_id,
        agent_id as string
      );

      if (!capsule) {
        return res.status(404).json({ error: 'Capsule not found or access denied' });
      }

      return res.json(capsule);
    } catch (error: any) {
      console.error('Error getting capsule:', error);
      return res.status(500).json({
        error: 'Failed to get capsule',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/v1/capsules/:capsule_id
   * Revoke a capsule
   */
  router.delete('/capsules/:capsule_id', async (req: Request, res: Response) => {
    try {
      const { tenant_id } = req.body;

      if (!tenant_id) {
        return res.status(400).json({
          error: 'Missing required parameter: tenant_id',
        });
      }

      const revoked = await capsuleService.revokeCapsule(
        req.params.capsule_id,
        tenant_id
      );

      if (!revoked) {
        return res.status(404).json({ error: 'Capsule not found' });
      }

      return res.json({
        capsule_id: req.params.capsule_id,
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error revoking capsule:', error);
      return res.status(500).json({
        error: 'Failed to revoke capsule',
        message: error.message,
      });
    }
  });

  // ===== Memory Edit Endpoints =====

  /**
   * POST /api/v1/edits
   * Create a new memory edit
   */
  router.post('/edits', async (req: Request, res: Response) => {
    try {
      const edit = await memoryEditService.createMemoryEdit(req.body);
      return res.status(201).json({
        edit_id: edit.edit_id,
        status: edit.status,
        applied_at: edit.applied_at,
      });
    } catch (error: any) {
      console.error('Error creating memory edit:', error);
      return res.status(400).json({
        error: 'Failed to create memory edit',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/edits
   * List memory edits with filters
   */
  router.get('/edits', async (req: Request, res: Response) => {
    try {
      const { tenant_id, status, target_type, proposed_by, limit } = req.query;

      if (!tenant_id) {
        return res.status(400).json({
          error: 'Missing required parameter: tenant_id',
        });
      }

      const edits = await memoryEditService.listEdits(tenant_id as string, {
        status: status as any,
        target_type: target_type as any,
        proposed_by: proposed_by as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      return res.json({ edits, count: edits.length });
    } catch (error: any) {
      console.error('Error getting edits:', error);
      return res.status(500).json({
        error: 'Failed to get edits',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/edits/:edit_id
   * Get a specific edit
   */
  router.get('/edits/:edit_id', async (req: Request, res: Response) => {
    try {
      const edit = await memoryEditService.getEdit(req.params.edit_id);

      if (!edit) {
        return res.status(404).json({ error: 'Edit not found' });
      }

      return res.json(edit);
    } catch (error: any) {
      console.error('Error getting edit:', error);
      return res.status(500).json({
        error: 'Failed to get edit',
        message: error.message,
      });
    }
  });

  /**
   * PUT /api/v1/edits/:edit_id/approve
   * Approve a pending edit
   */
  router.put('/edits/:edit_id/approve', async (req: Request, res: Response) => {
    try {
      const { approved_by } = req.body;

      if (!approved_by) {
        return res.status(400).json({
          error: 'Missing required parameter: approved_by',
        });
      }

      const edit = await memoryEditService.approveEdit(
        req.params.edit_id,
        approved_by
      );

      if (!edit) {
        return res.status(404).json({ error: 'Edit not found or not pending' });
      }

      return res.json(edit);
    } catch (error: any) {
      console.error('Error approving edit:', error);
      return res.status(500).json({
        error: 'Failed to approve edit',
        message: error.message,
      });
    }
  });

  /**
   * PUT /api/v1/edits/:edit_id/reject
   * Reject a pending edit
   */
  router.put('/edits/:edit_id/reject', async (req: Request, res: Response) => {
    try {
      const edit = await memoryEditService.rejectEdit(req.params.edit_id);

      if (!edit) {
        return res.status(404).json({ error: 'Edit not found or not pending' });
      }

      return res.json(edit);
    } catch (error: any) {
      console.error('Error rejecting edit:', error);
      return res.status(500).json({
        error: 'Failed to reject edit',
        message: error.message,
      });
    }
  });

  return router;
}
