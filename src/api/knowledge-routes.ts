/**
 * Knowledge Notes API
 * Phase 2: Post-It Capture
 * Simple, natural language observations
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export interface KnowledgeNote {
  id: string;
  tenant_id: string;
  text: string;
  with_whom?: string;
  timestamp: Date;
  tags?: string[];
  created_at: Date;
}

export function createKnowledgeRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/v1/knowledge/notes
   * Create a knowledge note
   */
  router.post('/notes', async (req: Request, res: Response) => {
    try {
      const { tenant_id, text, with_whom, tags } = req.body;

      // Validation
      if (!tenant_id) {
        return res.status(400).json({
          error: 'tenant_id is required'
        });
      }

      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          error: 'text is required and must be a string'
        });
      }

      // Create note
      const result = await pool.query(
        `INSERT INTO knowledge_notes (tenant_id, text, with_whom, tags)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [tenant_id, text, with_whom || null, tags || null]
      );

      const note = result.rows[0];
      return res.status(201).json(note);
    } catch (error: any) {
      console.error('Error creating knowledge note:', error);
      return res.status(500).json({
        error: 'Failed to create knowledge note',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  /**
   * GET /api/v1/knowledge/notes
   * Get knowledge notes
   */
  router.get('/notes', async (req: Request, res: Response) => {
    try {
      const { tenant_id, with_whom, limit = 100, offset = 0 } = req.query;

      if (!tenant_id) {
        return res.status(400).json({
          error: 'tenant_id is required'
        });
      }

      const limitNum = Math.min(Number(limit) || 100, 1000);
      const offsetNum = Number(offset) || 0;

      let query = `SELECT * FROM knowledge_notes WHERE tenant_id = $1`;
      const params: any[] = [tenant_id];

      if (with_whom) {
        query += ` AND with_whom = $2`;
        params.push(with_whom);
      }

      query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limitNum, offsetNum);

      const result = await pool.query(query, params);
      return res.json(result.rows);
    } catch (error: any) {
      console.error('Error getting knowledge notes:', error);
      return res.status(500).json({
        error: 'Failed to get knowledge notes',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  /**
   * GET /api/v1/knowledge/notes/:id
   * Get specific knowledge note
   */
  router.get('/notes/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'Note id is required'
        });
      }

      const result = await pool.query(
        'SELECT * FROM knowledge_notes WHERE id = $1',
        [id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error: 'Knowledge note not found'
        });
      }

      return res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Error getting knowledge note:', error);
      return res.status(500).json({
        error: 'Failed to get knowledge note',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  return router;
}
