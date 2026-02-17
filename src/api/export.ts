/**
 * Export Thread - Memory Export API
 *
 * Allows agents and humans to export their memory for backup,
 * analysis, or portability.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function createExportRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * GET /api/v1/export/thread
   *
   * Export identity thread for backup or analysis
   *
   * Query params:
   * - tenant_id: Tenant identifier (required)
   * - format: Output format - 'json' or 'markdown' (default: json)
   */
  router.get('/export/thread', async (req: Request, res: Response) => {
    try {
      const tenant_id = req.query.tenant_id as string;
      const format = req.query.format as string || 'json';

      if (!tenant_id) {
        res.status(400).json({
          error: 'tenant_id is required'
        });
        return;
      }

      // Fetch identity thread
      const result = await pool.query(
        `SELECT
           handoff_id,
           session_id,
           with_whom,
           experienced,
           noticed,
           learned,
           story,
           becoming,
           remember,
           significance,
           tags,
           created_at
         FROM session_handoffs
         WHERE tenant_id = $1
           AND becoming IS NOT NULL
         ORDER BY created_at DESC`,
        [tenant_id]
      );

      if (format === 'markdown') {
        // Generate markdown format
        const markdown = generateIdentityMarkdown(result.rows);
        res.type('text/markdown');
        res.send(markdown);
      } else {
        // Default: JSON format
        res.json({
          tenant_id,
          export_date: new Date().toISOString(),
          total_statements: result.rowCount,
          identity_thread: result.rows
        });
      }
    } catch (error) {
      console.error('[Export] Error:', error);
      res.status(500).json({
        error: 'Failed to export identity thread',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/v1/export/all
   *
   * Export all memory data for a tenant
   *
   * Query params:
   * - tenant_id: Tenant identifier (required)
   * - include_events: Include event chunks (default: false)
   */
  router.get('/export/all', async (req: Request, res: Response) => {
    try {
      const tenant_id = req.query.tenant_id as string;
      const include_events = req.query.include_events === 'true';

      if (!tenant_id) {
        res.status(400).json({
          error: 'tenant_id is required'
        });
        return;
      }

      // Fetch handoffs
      const handoffs = await pool.query(
        `SELECT * FROM session_handoffs
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenant_id]
      );

      // Fetch decisions
      const decisions = await pool.query(
        `SELECT * FROM decisions
         WHERE tenant_id = $1
         ORDER BY ts DESC`,
        [tenant_id]
      );

      const exportData: Record<string, any> = {
        tenant_id,
        export_date: new Date().toISOString(),
        handoffs: {
          total: handoffs.rowCount,
          items: handoffs.rows
        },
        decisions: {
          total: decisions.rowCount,
          items: decisions.rows
        }
      };

      // Optionally include event chunks
      if (include_events) {
        const chunks = await pool.query(
          `SELECT * FROM chunks
           WHERE tenant_id = $1
           ORDER BY ts DESC
           LIMIT 1000`,
          [tenant_id]
        );

        exportData['events'] = {
          total: chunks.rowCount,
          items: chunks.rows,
          note: 'Limited to 1000 most recent chunks'
        };
      }

      res.json(exportData);
    } catch (error) {
      console.error('[Export] Error:', error);
      res.status(500).json({
        error: 'Failed to export data',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}

function generateIdentityMarkdown(handoffs: any[]): string {
  let md = `# Identity Thread Export\n\n`;
  md += `**Tenant:** ${handoffs[0]?.tenant_id || 'Unknown'}\n`;
  md += `**Export Date:** ${new Date().toISOString()}\n`;
  md += `**Total Statements:** ${handoffs.length}\n\n`;
  md += `---\n\n`;

  handoffs.forEach((handoff, index) => {
    md += `## Statement ${index + 1}\n\n`;
    md += `**Date:** ${new Date(handoff.created_at).toLocaleDateString()}\n`;
    md += `**With Whom:** ${handoff.with_whom}\n\n`;
    md += `### Who I Am Becoming\n`;
    md += `${handoff.becoming}\n\n`;
    md += `### What I Experienced\n`;
    md += `${handoff.experienced}\n\n`;
    md += `### What I Noticed\n`;
    md += `${handoff.noticed}\n\n`;
    md += `### What I Learned\n`;
    md += `${handoff.learned}\n\n`;
    if (handoff.story) {
      md += `### The Story\n`;
      md += `${handoff.story}\n\n`;
    }
    md += `### What to Remember\n`;
    md += `${handoff.remember}\n\n`;
    md += `**Significance:** ${handoff.significance}/1.0\n\n`;
    if (handoff.tags && handoff.tags.length > 0) {
      md += `**Tags:** ${handoff.tags.join(', ')}\n\n`;
    }
    md += `---\n\n`;
  });

  md += `\n*Exported from Thread's Memory System*\n`;
  return md;
}
