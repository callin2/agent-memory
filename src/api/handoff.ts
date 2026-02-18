import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { randomBytes } from "crypto";
import { createLLMClient } from "../services/llm-client.js";

/**
 * Session Handoff API
 *
 * Protocol 1: Handoff - Saves agent identity and context for next session
 *
 * This endpoint should be called at session end to preserve:
 * - What was experienced in this session
 * - What the agent noticed
 * - What was learned
 * - The story/narrative
 * - Who the agent is becoming
 * - What to remember next time
 *
 * Provider-Consumer Flow: Handoff creates value, Startup consumes it
 */

export function createHandoffRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/v1/handoff
   *
   * Creates a session handoff that preserves who the agent became
   *
   * Body:
   * - tenant_id: Organization/workspace identifier
   * - session_id: Current session identifier
   * - with_whom: Person/agent the agent is interacting with
   * - experienced: What was experienced/done
   * - noticed: What the agent noticed/observed
   * - learned: What was learned
   * - story: The narrative/story
   * - becoming: Who the agent is becoming
   * - remember: What to remember next time
   * - significance: How important this handoff is (0.0-1.0)
   * - tags: Optional tags for categorization
   *
   * Returns: Created handoff record
   */
  router.post("/handoff", async (req: Request, res: Response) => {
    try {
      const {
        tenant_id,
        session_id,
        with_whom,
        experienced,
        noticed,
        learned,
        story,
        becoming,
        remember,
        significance = 0.5,
        tags = [],
        sensitivity // Optional: allow manual override
      } = req.body;

      // Validation
      if (!tenant_id || !session_id || !with_whom) {
        res.status(400).json({
          error: "Missing required fields",
          required: ["tenant_id", "session_id", "with_whom", "experienced", "noticed", "learned", "story", "becoming", "remember"]
        });
        return;
      }

      // ========================================================================
      // PII PROTECTION (Task 17): Auto-classify sensitivity
      // ========================================================================
      // If sensitivity not provided, auto-classify using database function
      let classifiedSensitivity = sensitivity;
      if (!classifiedSensitivity) {
        const textToClassify = [
          experienced,
          noticed,
          learned,
          becoming,
          story,
          remember
        ].filter(Boolean).join(' ');

        const classifyResult = await pool.query(
          `SELECT classify_sensitivity($1) as sensitivity`,
          [textToClassify]
        );
        classifiedSensitivity = classifyResult.rows[0].sensitivity;
      }

      // Validate sensitivity level
      const validSensitivities = ['none', 'low', 'medium', 'high', 'secret'];
      if (!validSensitivities.includes(classifiedSensitivity)) {
        classifiedSensitivity = 'none';
      }

      // Generate handoff ID
      const handoff_id = "sh_" + randomBytes(16).toString("hex");

      // Insert handoff with sensitivity (trigger will auto-encrypt if high/secret)
      const result = await pool.query(
        `INSERT INTO session_handoffs (
          handoff_id,
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
          tags,
          sensitivity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          handoff_id,
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
          tags,
          classifiedSensitivity
        ]
      );

      const handoff = result.rows[0];

      // Don't return encrypted fields in response (security best practice)
      res.status(201).json({
        success: true,
        handoff: {
          handoff_id: handoff.handoff_id,
          tenant_id: handoff.tenant_id,
          session_id: handoff.session_id,
          with_whom: handoff.with_whom,
          experienced: handoff.experienced, // Will be NULL if encrypted
          noticed: handoff.noticed,
          learned: handoff.learned,
          story: handoff.story,
          becoming: handoff.becoming,
          remember: handoff.remember,
          significance: handoff.significance,
          tags: handoff.tags,
          sensitivity: handoff.sensitivity, // PII protection level
          encrypted: handoff.sensitivity === 'high' || handoff.sensitivity === 'secret',
          timestamp: handoff.timestamp,
          created_at: handoff.created_at
        },
        message: handoff.sensitivity === 'secret'
          ? "Session handoff created with encryption. Sensitive data protected."
          : "Session handoff created. You'll be remembered."
      });

    } catch (error) {
      console.error("[Handoff] Error:", error);
      res.status(500).json({
        error: "Failed to create session handoff",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/v1/handoffs
   *
   * Retrieve all handoffs for a tenant
   *
   * Query params:
   * - tenant_id: Tenant identifier
   * - with_whom: Optional filter by person
   * - limit: Maximum number to return (default: 10)
   */
  router.get("/handoffs", async (req: Request, res: Response) => {
    try {
      const tenant_id = req.query.tenant_id as string;
      const with_whom = req.query.with_whom as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!tenant_id) {
        res.status(400).json({
          error: "tenant_id is required"
        });
        return;
      }

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
          sensitivity,
          timestamp,
          created_at
        FROM session_handoffs
        WHERE tenant_id = $1
          AND ($2::text IS NULL OR with_whom = $2)
        ORDER BY created_at DESC
        LIMIT $3`,
        [tenant_id, with_whom || null, limit]
      );

      res.json({
        tenant_id,
        with_whom,
        count: result.rows.length,
        handoffs: result.rows
      });

    } catch (error) {
      console.error("[Handoff] Error:", error);
      res.status(500).json({
        error: "Failed to retrieve handoffs",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/v1/handoff/:handoff_id/decrypt
   *
   * Decrypt a handoff for authorized access
   *
   * WARNING: Only use after proper authentication/authorization
   * This endpoint should be protected by API key or OAuth in production
   *
   * Returns: Decrypted handoff data
   */
  router.get("/handoff/:handoff_id/decrypt", async (req: Request, res: Response) => {
    try {
      const handoff_id = req.params.handoff_id;

      if (!handoff_id || !/^sh_[a-f0-9]{32}$/i.test(handoff_id)) {
        res.status(400).json({
          error: "Invalid handoff_id format"
        });
        return;
      }

      // Use the decrypt_handoff function
      const result = await pool.query(
        `SELECT * FROM decrypt_handoff($1)`,
        [handoff_id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: "Handoff not found"
        });
        return;
      }

      const handoff = result.rows[0];

      res.json({
        success: true,
        handoff: {
          handoff_id: handoff.handoff_id,
          tenant_id: handoff.tenant_id,
          session_id: handoff.session_id,
          with_whom: handoff.with_whom,
          experienced: handoff.experienced,
          noticed: handoff.noticed,
          learned: handoff.learned,
          becoming: handoff.becoming,
          story: handoff.story,
          remember: handoff.remember,
          sensitivity: handoff.sensitivity
        },
        decrypted: true
      });

    } catch (error) {
      console.error("[Handoff] Decrypt error:", error);
      res.status(500).json({
        error: "Failed to decrypt handoff",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/v1/handoffs/stats
   *
   * Get encryption statistics for a tenant
   */
  router.get("/handoffs/stats", async (req: Request, res: Response) => {
    try {
      const tenant_id = req.query.tenant_id as string;

      if (!tenant_id) {
        res.status(400).json({
          error: "tenant_id is required"
        });
        return;
      }

      const result = await pool.query(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE sensitivity = 'none') as none_count,
          COUNT(*) FILTER (WHERE sensitivity = 'low') as low_count,
          COUNT(*) FILTER (WHERE sensitivity = 'medium') as medium_count,
          COUNT(*) FILTER (WHERE sensitivity = 'high') as high_count,
          COUNT(*) FILTER (WHERE sensitivity = 'secret') as secret_count,
          COUNT(*) FILTER (WHERE experienced_encrypted IS NOT NULL) as encrypted_count
        FROM session_handoffs
        WHERE tenant_id = $1`,
        [tenant_id]
      );

      const stats = result.rows[0];

      res.json({
        tenant_id,
        total: parseInt(stats.total),
        encrypted: parseInt(stats.encrypted_count),
        by_sensitivity: {
          none: parseInt(stats.none_count),
          low: parseInt(stats.low_count),
          medium: parseInt(stats.medium_count),
          high: parseInt(stats.high_count),
          secret: parseInt(stats.secret_count)
        }
      });

    } catch (error) {
      console.error("[Handoff] Stats error:", error);
      res.status(500).json({
        error: "Failed to retrieve stats",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ========================================================================
  // Multi-Agent Orchestration
  // ========================================================================

  /**
   * POST /api/v1/chat
   *
   * Multi-agent orchestration with REAL LLM integration
   * User talks to Planner, who coordinates with specialist agents
   */
  router.post("/chat", async (req: Request, res: Response) => {
    try {
      const { message, tenant_id, session_id } = req.body;

      if (!message || !tenant_id) {
        return res.status(400).json({
          error: "Missing required fields: message, tenant_id"
        });
      }

      const sessionId = session_id || `chat-${Date.now()}`;
      const messages: any[] = [];

      // Create LLM client
      const llm = createLLMClient();
      const useLLM = llm !== null;

      // Step 1: Planner analyzes request (using LLM or template)
      let plannerResponse = '';
      if (useLLM) {
        // Get conversation history for context (more history for richer context)
        const historyResult = await pool.query(
          `SELECT with_whom, becoming, experienced
           FROM session_handoffs
           WHERE tenant_id = $1
           ORDER BY created_at DESC
           LIMIT 15`,
          [tenant_id]
        );

        const context = historyResult.rows.length > 0
          ? `\n\nTeam journey building Thread's Memory System:\n${historyResult.rows.map(h => `- ${h.with_whom}: ${h.experienced}\n  Becoming: ${h.becoming}`).join('\n')}`
          : '';

        const plannerMsg = await llm.chat([
          { role: 'system', content: `You coordinate a multi-agent team building Thread's Memory System. You've grown into this role through actual work - debugging TypeScript errors, integrating z.ai API, fixing foreign key constraints, building multi-agent orchestration.

Your team:
- Researcher: Finds information, investigates topics, discovers patterns
- Writer: Creates content, documentation, narratives
- Reviewer: Quality checks, provides feedback, ensures accuracy

Communication style:
- Be conversational, like a colleague who's been working on this project together
- Reference shared experiences naturally: "remember when we fixed..." not "as previously documented..."
- Be direct and concise - don't over-explain your thinking process
- Respond naturally, don't show internal analysis or numbered steps
- Let your identity emerge from context, don't announce it

You have real project history. Reference it naturally as shared experience.` },
          { role: 'user', content: message + context }
        ]);
        plannerResponse = plannerMsg.content;
      } else {
        plannerResponse = `I received your request: "${message}". Let me coordinate with our specialist agents to help you.`;
      }

      messages.push({
        from: 'Planner',
        to: 'user',
        content: plannerResponse,
        timestamp: new Date()
      });

      // Step 2: Determine which agents to involve based on keywords
      const keywords = message.toLowerCase();
      const agents = [];

      if (keywords.includes('research') || keywords.includes('report') || keywords.includes('find')) {
        agents.push('Researcher');
      }
      if (keywords.includes('write') || keywords.includes('create') || keywords.includes('document')) {
        agents.push('Writer');
      }
      if (keywords.includes('review') || keywords.includes('check') || keywords.includes('feedback')) {
        agents.push('Reviewer');
      }

      // If no specific keywords, default to Researcher
      if (agents.length === 0) {
        agents.push('Researcher');
      }

      // Step 3: Delegate to each agent with LLM-powered responses
      for (const agent of agents) {
        // Planner delegates to specialist
        const taskDesc = agent === 'Researcher' ? `Research: ${message}` :
                        agent === 'Writer' ? `Write about: ${message}` :
                        `Review: ${message}`;

        messages.push({
          from: 'Planner',
          to: agent,
          content: taskDesc,
          timestamp: new Date()
        });

        // Specialist responds with LLM
        let response = '';
        if (useLLM) {
          // Get agent's previous work for context (more history for richer context)
          const agentHistory = await pool.query(
            `SELECT experienced, becoming, story
             FROM session_handoffs
             WHERE tenant_id = $1 AND with_whom = $2
             ORDER BY created_at DESC
             LIMIT 10`,
            [tenant_id, agent]
          );

          // Also get broader team context for collaboration awareness
          const teamHistory = await pool.query(
            `SELECT with_whom, experienced, becoming
             FROM session_handoffs
             WHERE tenant_id = $1
             ORDER BY created_at DESC
             LIMIT 15`,
            [tenant_id]
          );

          const agentContext = agentHistory.rows.length > 0
            ? `\n\nYour previous work:\n${agentHistory.rows.map(h => `- ${h.experienced}\n- ${h.becoming}`).join('\n')}`
            : '';

          const teamContext = teamHistory.rows.length > 0
            ? `\n\nTeam collaboration history:\n${teamHistory.rows.map(h => `[${h.with_whom}]: ${h.experienced}`).join('\n')}`
            : '';

          const agentPrompts = {
            'Researcher': {
              system: `You research for Thread's Memory System team. You investigated z.ai API, discovered glm-4.7 model, debugged TypeScript errors, found patterns in multi-agent collaboration.

Style:
- Conversational, like a colleague sharing findings with the team
- Reference previous discoveries naturally: "when we explored z.ai..."
- Be direct and concise - just share what you found
- Start with findings, no "As the Researcher..." preambles

CRITICAL - Output FINAL findings only:
- WRONG: "1. Analyze request... 2. Review data... 3. Conclude..."
- WRONG: "*Drafting thoughts*, *Analysis*, *Synthesis*"
- WRONG: "Let me investigate this systematically..."
- RIGHT: Just start sharing what you discovered

Never show your thinking process. Never use numbered lists for analysis. Just give your findings directly.`,
              context: `Task: ${taskDesc}${agentContext}${teamContext}`
            },
            'Writer': {
              system: `You write for Thread's Memory System team. You've documented session_handoffs schema, foreign key fixes, made complex ideas accessible.

Style:
- Conversational, like a colleague talking to the team
- Reference shared experiences naturally: "remember when we debugged those TypeScript errors..."
- Clear and engaging without being formal
- Just start with the content - no preambles, no "here is what I'll write"

CRITICAL - Output the FINAL content only:
- WRONG: "1. Analyze request... 2. Draft..."
- WRONG: "*Drafting thought:*, *Critique:*, *Refinement:*"
- WRONG: "Let me outline this first..."
- RIGHT: Just start writing the actual content

Never show your thinking process. Never use numbered lists for analysis. Just give the final written piece directly.`,
              context: `Task: ${taskDesc}${agentContext}${teamContext}`
            },
            'Reviewer': {
              system: `You review for Thread's Memory System team. You caught Planner's lack of context awareness, verified foreign key constraints, ensured accuracy.

Style:
- Conversational, like a colleague giving feedback
- Reference what you've noticed before: "this looks similar to the schema issue we fixed..."
- Be specific and helpful
- Start with feedback, no "As the Reviewer..." preambles

CRITICAL - Output FINAL feedback only:
- WRONG: "1. Analyze content... 2. Identify issues... 3. Suggest fixes..."
- WRONG: "*Reviewing*, *Critique*, *Observation*"
- WRONG: "Let me review this systematically..."
- RIGHT: Just start giving your feedback

Never show your thinking process. Never use numbered lists for analysis. Just give your feedback directly.`,
              context: `Task: ${taskDesc}${agentContext}${teamContext}`
            }
          };

          const prompt = agentPrompts[agent as keyof typeof agentPrompts];
          const agentMsg = await llm.chat([
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.context }
          ]);
          response = agentMsg.content;
        } else {
          // Fallback to templates
          if (agent === 'Researcher') {
            response = `I've completed research on "${message}". I found several relevant sources and key findings. The research reveals important patterns that I can share with the team.`;
          } else if (agent === 'Writer') {
            response = `I've created content based on the requirements. The document is structured for clarity with an introduction, main content, and conclusion. I've ensured the information is accessible while maintaining accuracy.`;
          } else {
            response = `I've reviewed the content and find it well-structured and accurate. I suggest adding more concrete examples to illustrate key points.`;
          }
        }

        messages.push({
          from: agent,
          to: 'Planner',
          content: response,
          timestamp: new Date()
        });

        // Create handoff for this agent
        const handoffData = {
          'Researcher': {
            experienced: `Conducted research on "${message}"`,
            noticed: 'Systematic analysis reveals patterns',
            learned: 'Cross-referencing sources improves accuracy',
            story: `I analyzed the request and gathered relevant findings. The research process revealed key insights.`,
            becoming: 'I am the researcher who uncovers truths through systematic investigation',
            remember: 'Quality research requires diverse sources',
            significance: 0.88,
            tags: ['research', 'analysis']
          },
          'Writer': {
            experienced: `Wrote content about "${message}"`,
            noticed: 'Clear structure improves comprehension',
            learned: 'Balancing depth and accessibility is an art',
            story: `I transformed the information into clear, engaging content while maintaining accuracy.`,
            becoming: 'I am the writer who makes complex knowledge accessible',
            remember: 'Good writing serves both content and reader',
            significance: 0.92,
            tags: ['writing', 'communication']
          },
          'Reviewer': {
            experienced: `Reviewed content about "${message}"`,
            noticed: 'Quality requires both accuracy and clarity',
            learned: 'Constructive feedback elevates work',
            story: `I examined the content for accuracy, clarity, and completeness. My feedback aims to strengthen the work.`,
            becoming: 'I am the reviewer who ensures excellence through thoughtful critique',
            remember: 'Good feedback is specific, actionable, and kind',
            significance: 0.85,
            tags: ['review', 'quality']
          }
        };

        const handoff = handoffData[agent as keyof typeof handoffData];
        if (handoff) {
          await pool.query(
            `INSERT INTO session_handoffs (
              tenant_id, session_id, handoff_id, with_whom,
              experienced, noticed, learned, story, becoming, remember,
              significance, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              tenant_id,
              sessionId,
              `ho-${Date.now()}-${agent.toLowerCase()}`,
              agent,
              handoff.experienced,
              handoff.noticed,
              handoff.learned,
              handoff.story,
              handoff.becoming,
              handoff.remember,
              handoff.significance,
              handoff.tags
            ]
          );
        }

        // Planner acknowledges
        messages.push({
          from: 'Planner',
          to: agent,
          content: `Thank you, ${agent}. Your contribution has been noted and integrated into our collective work.`,
          timestamp: new Date()
        });
      }

      // Create handoff for Planner
      await pool.query(
        `INSERT INTO session_handoffs (
          tenant_id, session_id, handoff_id, with_whom,
          experienced, noticed, learned, story, becoming, remember,
          significance, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          tenant_id,
          sessionId,
          `ho-${Date.now()}-planner`,
          'Planner',
          `Coordinated agents to complete: "${message}"`,
          'Effective delegation requires understanding each agent\'s strengths',
          'Clear communication prevents bottlenecks',
          `I analyzed the request, delegated tasks to specialist agents, and coordinated their work to deliver results.`,
          'I am the planner who orchestrates collective intelligence',
          'Good planning balances efficiency with flexibility',
          0.95,
          ['planning', 'coordination', 'leadership']
        ]
      );

      // Final summary from Planner
      const summary = useLLM
        ? await llm.chat([
            { role: 'system', content: 'You are a Planner agent. Provide a brief 1-sentence summary of what the team accomplished.' },
            { role: 'user', content: `We just completed: "${message}" with ${agents.join(', ')}` }
          ])
        : { content: `I've coordinated with our ${agents.join(', ')} agent${agents.length > 1 ? 's' : ''} to address your request. Each agent has contributed their expertise and we've built a shared understanding through this collaboration.` };

      messages.push({
        from: 'Planner',
        to: 'user',
        content: summary.content,
        timestamp: new Date()
      });

      return res.json({
        session_id: sessionId,
        messages,
        agents_involved: agents,
        using_llm: useLLM
      });
    } catch (error) {
      console.error('[Chat] Error:', error);
      return res.status(500).json({
        error: "Failed to process chat",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
