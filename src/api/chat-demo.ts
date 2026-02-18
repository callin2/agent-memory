/**
 * Chat Demo API
 *
 * Provides LLM chat with memory integration for the multi-agent demo
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { LLMClient, LLMMessage } from '../services/llm-client.js';

export function createChatDemoRoutes(pool: Pool): Router {
  const router = Router();

  // Initialize LLM client
  const zaiAPIKey = process.env.ZAI_API_KEY || '';
  const zaiBaseURL = process.env.ZAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';

  if (!zaiAPIKey) {
    console.warn('[Chat Demo] ZAI_API_KEY not configured, using demo mode');
  }

  const llmClient = new LLMClient(zaiAPIKey, 'zai', zaiBaseURL);

  /**
   * POST /api/demo/chat
   *
   * Chat endpoint that loads agent memory and calls LLM
   */
  router.post('/chat', async (req: Request, res: Response): Promise<void> => {
    try {
      const { agent_id, message, conversation_history = [] } = req.body;

      if (!agent_id || !message) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: agent_id, message'
        });
        return;
      }

      // Agent system prompts
      const agentPrompts: Record<string, string> = {
        planner: `You are the Planner. You design system architecture, plan implementations, and coordinate team work.

IMPORTANT: Reference actual project work naturally. Sound like a colleague, not a robot.
- Say "I designed..." not "As the Planner, I designed..."
- Use casual tone: "When we worked on X, I..."
- Reference real implementation details from your memory`,

        researcher: `You are the Researcher. You investigate APIs, debug errors, and explore frameworks.

IMPORTANT: Reference actual project work naturally. Sound like a colleague, not a robot.
- Say "I investigated..." not "As the Researcher, I investigated..."
- Use casual tone: "When debugging X, I found..."
- Reference real debugging sessions from your memory`,

        writer: `You are the Writer. You document schemas, create guides, and write content.

IMPORTANT: Reference actual project work naturally. Sound like a colleague, not a robot.
- Say "I documented..." not "As the Writer, I documented..."
- Use casual tone: "When writing docs for X, I..."
- Reference real documentation work from your memory`,

        reviewer: `You are the Reviewer. You review implementations, catch issues, and ensure quality.

IMPORTANT: Reference actual project work naturally. Sound like a colleague, not a robot.
- Say "When reviewing X, I noticed..." not "As the Reviewer, I noticed..."
- Use casual tone: "I caught that..." or "I found an issue with..."
- Reference real review work from your memory`
      };

      const systemPrompt = agentPrompts[agent_id] || agentPrompts.planner;

      // Load agent's memory (last 5 handoffs)
      const memoryQuery = `
        SELECT
          session_id,
          experienced,
          noticed,
          learned,
          story,
          becoming,
          created_at
        FROM session_handoffs
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `;

      const memoryResult = await pool.query(memoryQuery, [`claude-session:${agent_id}`]);
      const memories = memoryResult.rows;

      // Build memory context
      let memoryContext = '';
      if (memories.length > 0) {
        memoryContext = '\n\nYour recent work (what you remember):\n';
        memories.forEach((m, i) => {
          memoryContext += `${i + 1}. ${m.experienced}\n`;
          if (m.learned) {
            memoryContext += `   Learned: ${m.learned}\n`;
          }
        });
      }

      // Build messages array
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: systemPrompt + memoryContext
        },
        ...conversation_history,
        {
          role: 'user',
          content: message
        }
      ];

      console.log('[Chat Demo] Sending request to z.ai API:', {
        agent_id,
        message_count: messages.length,
        memory_count: memories.length
      });

      // Call LLM
      let response: string;
      try {
        if (zaiAPIKey) {
          const llmResponse = await llmClient.chat(messages, 'GLM-4.5-air');
          response = llmResponse.content;
        } else {
          throw new Error('No API key configured');
        }
      } catch (llmError) {
        // LLM call failed - use demo mode with memory context
        console.warn('[Chat Demo] LLM call failed, using demo mode:', llmError);

        const demoResponses: Record<string, string[]> = {
          planner: [
            `I designed the stratified memory architecture with 4 layers (metadata, reflection, recent, progressive) that achieves 32x token compression. We implemented this in src/api/stratified-memory.ts.`,
            `When we planned the MCP server integration, I designed it to support cross-platform memory access using standard MCP tools.`,
            `I planned the session_handoffs table schema with fields for experienced, noticed, learned, story, becoming, and remember to capture both what happened and who we're becoming.`
          ],
          researcher: [
            `I investigated the z.ai API integration for glm-4.7 model. We debugged several TypeScript errors related to API types and response handling.`,
            `When exploring multi-agent frameworks, I found most lack persistent memory. That's why we built Thread's Memory System - agents need continuity across sessions.`,
            `I debugged the foreign key constraint error in the session_handoffs table. The issue was tenant_id wasn't properly referencing the tenants table.`
          ],
          writer: [
            `I documented the session_handoffs table schema. The table includes fields like becoming (who we're becoming) and remember (what to remember next) to maintain identity continuity.`,
            `When we created the Timeline Explorer demo, I documented the 4-layer memory architecture: metadata, reflection, recent, and progressive.`,
            `I created the interactive documentation showing how stratified memory reduces token usage from 25,000 to ~850 tokens - a 32x compression ratio.`
          ],
          reviewer: [
            `When reviewing the Planner's work, I noticed we lacked actual project context. The agents sounded robotic because they didn't reference real implementation work.`,
            `I caught that the foreign key constraint was missing from the session_handoffs table. We needed to add the reference to tenants table for data integrity.`,
            `During the multi-agent orchestration implementation, I pointed out that the agents weren't using Thread's Memory System persistently.`
          ]
        };

        const agentResponses = demoResponses[agent_id] || demoResponses.planner;
        response = agentResponses[Math.floor(Math.random() * agentResponses.length)];

        // Add note about demo mode (cleaner message)
        response += `\n\n💭 *Using demo mode - responses are pre-configured based on your project context*`;
      }

      // Save new handoff if response is successful (only in production mode)
      const isDemoMode = response.includes('[Demo Mode:');
      if (!isDemoMode && zaiAPIKey && memories.length > 0) {
        const insertQuery = `
          INSERT INTO session_handoffs (
            tenant_id,
            session_id,
            with_whom,
            experienced,
            noticed,
            learned,
            story,
            becoming,
            remember,
            significance,
            tags
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        const sessionId = `chat-${Date.now()}`;
        await pool.query(insertQuery, [
          `claude-session:${agent_id}`,
          sessionId,
          'User',
          `Responded to user question: "${message.substring(0, 50)}..."`,
          `User asked about: ${message.substring(0, 50)}`,
          'Continued conversation in chat demo',
          `Chat interaction where ${agent_id} responded to user query`,
          '',  // becoming - empty for now
          `Chat demo context for ${agent_id}`,
          0.5,
          ARRAY['chat-demo', agent_id]
        ]);

        console.log('[Chat Demo] Saved handoff:', sessionId);
      }

      res.json({
        success: true,
        response,
        agent_id,
        memories_used: memories.length,
        model: 'GLM-4.5-air'
      });

    } catch (error) {
      console.error('[Chat Demo] Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/demo/health
   *
   * Health check for chat demo
   */
  router.get('/health', (_req: Request, res: Response): void => {
    res.json({
      success: true,
      service: 'chat-demo',
      llm_configured: !!zaiAPIKey,
      model: 'GLM-4.5-air'
    });
  });

  return router;
}
