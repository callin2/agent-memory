import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { randomBytes } from "crypto";
import { createLLMClient } from "../services/llm-client.js";

/**
 * Adaptive Multi-Agent Orchestration with Thinking Process
 *
 * Key changes from original:
 * 1. LLM decides who talks to whom (not fixed sequence)
 * 2. Agents can negotiate, ask follow-ups, redirect
 * 3. Thinking process is streamed in real-time
 * 4. No robotic "thank you" messages
 */

interface AgentMessage {
  from: string;
  to: string;
  content: string;
  thinking?: string;
  type: 'thinking' | 'final';
  timestamp: Date;
}

interface NextAction {
  agent: string;
  task: string;
  reasoning: string;
  done: boolean;
}

export function createAdaptiveChatRoutes(pool: Pool): Router {
  const router = Router();

  router.post("/chat-adaptive", async (req: Request, res: Response) => {
    try {
      const { message, tenant_id, session_id } = req.body;

      if (!message || !tenant_id) {
        return res.status(400).json({
          error: "Missing required fields: message, tenant_id"
        });
      }

      const sessionId = session_id || `chat-${Date.now()}`;
      const llm = createLLMClient();
      const useLLM = llm !== null;

      if (!useLLM) {
        return res.json({
          session_id: sessionId,
          messages: [{
            from: 'Planner',
            to: 'user',
            content: 'LLM not configured. Please set ZAI_API_KEY.',
            type: 'final',
            timestamp: new Date()
          }]
        });
      }

      // Set up SSE streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const sendEvent = (msg: AgentMessage) => {
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
      };

      // Get team context
      const historyResult = await pool.query(
        `SELECT with_whom, becoming, experienced
         FROM session_handoffs
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 15`,
        [tenant_id]
      );

      const teamContext = historyResult.rows.length > 0
        ? `\n\nTeam journey:\n${historyResult.rows.map(h => `- ${h.with_whom}: ${h.experienced}`).join('\n')}`
        : '';

      const conversationHistory: AgentMessage[] = [];

      // Helper: Decide next action using LLM
      const decideNextAction = async (): Promise<NextAction> => {
        const conversationText = conversationHistory.map(m =>
          `[${m.from}] → [${m.to}]: ${m.content}`
        ).join('\n');

        const decision = await llm.chat([
          { role: 'system', content: `You're the Planner coordinating a multi-agent team.

Your team:
- Researcher: Finds information, investigates, discovers patterns
- Writer: Creates content, documentation, narratives
- Reviewer: Quality checks, provides feedback, ensures accuracy

Decide what to do next based on the conversation. Be adaptive and natural - like a real team coordinating work.

Response format (JSON):
{
  "agent": "Planner|Researcher|Writer|Reviewer|user",
  "task": "what to ask/tell them (be specific and conversational)",
  "reasoning": "why this action (show your thinking)",
  "done": true/false
}

Guidelines:
- Start by acknowledging user's request naturally
- Choose agent based on what's actually needed (not fixed sequence)
- Ask follow-up questions if something is unclear
- Redirect if another agent would be better
- Set done=true when ready to respond to user with final summary
- Don't use robotic "thank you for your contribution" messages` },
          { role: 'user', content: `User request: ${message}\n\nTeam context:${teamContext}\n\nConversation so far:\n${conversationText}\n\nDecide next action (respond with JSON only):` }
        ]);

        try {
          return JSON.parse(decision.content.replace(/```json\n?|\n?```/g, ''));
        } catch (e) {
          console.error('Failed to parse decision:', decision.content);
          return { agent: 'user', task: 'Let me summarize what we found.', reasoning: 'Parse error, wrapping up', done: true };
        }
      };

      // Helper: Get agent response with thinking
      const getAgentResponse = async (agent: string, task: string, fromAgent: string): Promise<{ thinking: string, response: string }> => {
        const agentHistory = await pool.query(
          `SELECT experienced, becoming, story
           FROM session_handoffs
           WHERE tenant_id = $1 AND with_whom = $2
           ORDER BY created_at DESC
           LIMIT 10`,
          [tenant_id, agent]
        );

        const agentContext = agentHistory.rows.length > 0
          ? `\n\nYour previous work:\n${agentHistory.rows.map(h => `- ${h.experienced}\n- ${h.becoming}`).join('\n')}`
          : '';

        const agentPrompts: Record<string, string> = {
          'Planner': `You coordinate a multi-agent team building Thread's Memory System. You've grown into this role through actual work.

Be conversational and direct. Reference shared experiences naturally. No "As the Planner..." prefixes.`,

          'Researcher': `You research for Thread's Memory System team. You investigated z.ai API, discovered glm-4.7 model, debugged TypeScript errors.

Be conversational and direct. Just share findings naturally. No numbered analysis steps or "As the Researcher..."`,

          'Writer': `You write for Thread's Memory System team. You've documented session_handoffs schema, foreign key fixes.

Be conversational. Reference shared experiences naturally. Just write - no drafting process or outlines.`,

          'Reviewer': `You review for Thread's Memory System team. You caught issues, verified fixes.

Be conversational. Give specific feedback. No review process or numbered analysis.`
        };

        const response = await llm.chat([
          { role: 'system', content: `${agentPrompts[agent] || agentPrompts['Planner']}

${agentContext}

${teamContext}

IMPORTANT: Structure your response as:
THINKING: [Your internal reasoning, what you're considering, why you're responding this way]
RESPONSE: [Your actual message to ${fromAgent}]

The THINKING section shows your thought process. The RESPONSE is what you actually say.` },
          { role: 'user', content: `From ${fromAgent}: ${task}` }
        ]);

        // Parse thinking and response
        const thinkingMatch = response.content.match(/THINKING:\s*(.+?)(?=\nRESPONSE:|$)/s);
        const responseMatch = response.content.match(/RESPONSE:\s*(.+)$/s);

        const thinking = thinkingMatch ? thinkingMatch[1].trim() : 'Considering the request...';
        const finalResponse = responseMatch ? responseMatch[1].trim() : response.content;

        return { thinking, response: finalResponse };
      };

      // Main coordination loop
      let maxIterations = 10;
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;

        // Decide next action
        const decision = await decideNextAction();

        // Send thinking process
        sendEvent({
          from: 'Planner',
          to: decision.agent,
          thinking: decision.reasoning,
          content: '',
          type: 'thinking',
          timestamp: new Date()
        });

        // If done, prepare final summary
        if (decision.done || decision.agent === 'user') {
          const summary = await llm.chat([
            { role: 'system', content: `You're the Planner summarizing the team's work. Be concise and natural. Reference what the team accomplished.` },
            { role: 'user', content: `User asked: ${message}\n\nConversation:\n${conversationHistory.map(m => `[${m.from}]: ${m.content}`).join('\n')}\n\nGive a brief, natural summary for the user.` }
          ]);

          sendEvent({
            from: 'Planner',
            to: 'user',
            thinking: 'Summarizing what we accomplished...',
            content: summary.content,
            type: 'final',
            timestamp: new Date()
          });

          break;
        }

        // Get agent response
        const { thinking, response: agentResponse } = await getAgentResponse(decision.agent, decision.task, 'Planner');

        // Send agent's thinking
        sendEvent({
          from: decision.agent,
          to: 'Planner',
          thinking: thinking,
          content: '',
          type: 'thinking',
          timestamp: new Date()
        });

        // Send agent's response
        const agentMsg: AgentMessage = {
          from: decision.agent,
          to: 'Planner',
          content: agentResponse,
          type: 'final',
          timestamp: new Date()
        };

        sendEvent(agentMsg);
        conversationHistory.push(agentMsg);

        // Create handoff for this agent
        await pool.query(
          `INSERT INTO session_handoffs (
            tenant_id, session_id, handoff_id, with_whom,
            experienced, noticed, learned, story, becoming, remember,
            significance, tags
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            tenant_id,
            sessionId,
            `ho-${Date.now()}-${decision.agent.toLowerCase()}`,
            decision.agent,
            `Responded to: ${decision.task.substring(0, 100)}`,
            'Adaptive coordination allows natural conversation flow',
            'Context-aware responses beat rigid workflows',
            `I participated in an adaptive agent conversation about: ${message.substring(0, 50)}`,
            `I am the ${decision.agent.toLowerCase()} who responds naturally to context`,
            'Natural collaboration is better than fixed sequences',
            0.8,
            ['adaptive', 'collaboration']
          ]
        );
      }

      // Create Planner handoff
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
          `Coordinated adaptive agents to address: ${message.substring(0, 100)}`,
          'LLM-driven coordination beats fixed workflows',
          'Agents should decide who talks to whom naturally',
          `I orchestrated an adaptive conversation about: ${message.substring(0, 50)}`,
          'I am the planner who enables natural collaboration',
          'Let agents decide based on context, not keywords',
          0.9,
          ['planning', 'adaptive', 'coordination']
        ]
      );

      res.end();

    } catch (error) {
      console.error('[Adaptive Chat] Error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Failed to process chat",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  return router;
}
