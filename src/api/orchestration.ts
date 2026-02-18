/**
 * Multi-Agent Orchestration API
 *
 * Provides endpoints for orchestrating multi-agent collaboration
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { AgentOrchestrator } from '../services/agent-orchestrator.js';

export function createOrchestrationRoutes(pool: Pool): Router {
  const router = Router();

  // Store active orchestrators by session
  const orchestrators = new Map<string, AgentOrchestrator>();

  /**
   * POST /api/v1/orchestration/chat
   *
   * Send message to multi-agent system and get coordinated response
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, tenant_id, session_id, user_id } = req.body;

      if (!message || !tenant_id) {
        return res.status(400).json({
          error: 'Missing required fields: message, tenant_id'
        });
      }

      // Get or create orchestrator for this session
      let orchestrator = orchestrators.get(session_id);
      if (!orchestrator) {
        orchestrator = new AgentOrchestrator(pool, {
          tenant_id,
          user_id: user_id || 'user',
          session_id: session_id || `session-${Date.now()}`
        });
        orchestrators.set(session_id, orchestrator);
      }

      // Process message through orchestrator
      const messages = await orchestrator.processUserMessage(message);

      // Return all messages from the orchestration
      return res.json({
        session_id,
        messages,
        tasks: orchestrator.getTasks()
      });
    } catch (error) {
      console.error('[Orchestration] Error processing message:', error);
      return res.status(500).json({
        error: 'Failed to process message',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/v1/orchestration/history
   *
   * Get conversation history for a session
   */
  router.get('/history', async (req: Request, res: Response) => {
    try {
      const { session_id, tenant_id } = req.query;

      if (!session_id || !tenant_id) {
        return res.status(400).json({
          error: 'Missing required parameters: session_id, tenant_id'
        });
      }

      // Get conversation from memory
      const result = await pool.query(
        `SELECT
          chunk_id,
          kind,
          role,
          text,
          refs,
          ts
         FROM chunks
         WHERE tenant_id = $1
           AND session_id = $2
           AND kind = 'agent_message'
         ORDER BY ts ASC`,
        [tenant_id, session_id]
      );

      // Parse refs to get message structure
      const messages = result.rows.map(row => {
        const refs = typeof row.refs === 'string' ? JSON.parse(row.refs) : row.refs;
        const ref = refs && refs[0] ? refs[0] : {};

        return {
          from: row.role,
          to: ref.to || 'user',
          content: row.text.replace(/^\[[^\]]+\]:\s*/, ''),
          timestamp: row.ts
        };
      });

      return res.json({
        session_id,
        messages
      });
    } catch (error) {
      console.error('[Orchestration] Error fetching history:', error);
      return res.status(500).json({
        error: 'Failed to fetch history',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/v1/orchestration/identity
   *
   * Get collective identity thread for all agents
   */
  router.get('/identity', async (req: Request, res: Response) => {
    try {
      const { tenant_id } = req.query;

      if (!tenant_id) {
        return res.status(400).json({
          error: 'Missing required parameter: tenant_id'
        });
      }

      // Get handoffs for all agents
      const result = await pool.query(
        `SELECT
          with_whom,
          becoming,
          experienced,
          timestamp
         FROM session_handoffs
         WHERE tenant_id = $1
         ORDER BY timestamp DESC
         LIMIT 50`,
        [tenant_id]
      );

      // Group by agent
      const agents = new Map<string, any[]>();
      for (const handoff of result.rows) {
        if (!agents.has(handoff.with_whom)) {
          agents.set(handoff.with_whom, []);
        }
        agents.get(handoff.with_whom)!.push(handoff);
      }

      return res.json({
        tenant_id,
        agents: Object.fromEntries(agents),
        total: result.rows.length
      });
    } catch (error) {
      console.error('[Orchestration] Error fetching identity:', error);
      return res.status(500).json({
        error: 'Failed to fetch identity',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
