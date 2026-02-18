/**
 * Multi-Agent Orchestrator
 *
 * Coordinates communication between multiple AI agents:
 * - Planner: Receives user requests, delegates tasks, coordinates workflow
 * - Researcher: Finds information, asks clarifying questions
 * - Writer: Creates content, documentation
 * - Reviewer: Quality checks, provides feedback
 *
 * All agents share the same tenant_id to build collective identity.
 */

import { Pool } from 'pg';

export interface AgentMessage {
  from: string; // agent name
  to: string; // agent name or 'user'
  content: string; // message content
  timestamp: Date;
  type: 'request' | 'response' | 'delegation' | 'result' | 'question';
}

export interface AgentTask {
  task_id: string;
  assigned_to: string; // agent name
  assigned_by: string; // agent name
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  result?: any;
}

export interface OrchestratorConfig {
  tenant_id: string;
  user_id: string;
  session_id: string;
}

export class AgentOrchestrator {
  private pool: Pool;
  private config: OrchestratorConfig;
  private tasks: Map<string, AgentTask> = new Map();
  private messageHistory: AgentMessage[] = [];

  constructor(pool: Pool, config: OrchestratorConfig) {
    this.pool = pool;
    this.config = config;
  }

  /**
   * Process user message through Planner agent
   */
  async processUserMessage(message: string): Promise<AgentMessage[]> {
    const messages: AgentMessage[] = [];

    // 1. User → Planner
    const plannerAnalysis = await this.plannerAnalyze(message);
    messages.push({
      from: 'Planner',
      to: 'user',
      content: plannerAnalysis,
      timestamp: new Date(),
      type: 'response'
    });

    // 2. Planner decides which agents to involve
    const plan = await this.plannerCreatePlan(message);

    // 3. Execute the plan (delegate to specialists)
    for (const step of plan.steps) {
      const stepMessages = await this.executeStep(step);
      messages.push(...stepMessages);
    }

    // 4. Store all messages in memory
    await this.storeConversation(messages);

    return messages;
  }

  /**
   * Planner analyzes user request
   */
  private async plannerAnalyze(request: string): Promise<string> {
    // Simple rule-based analysis (in real system, would use LLM)
    const keywords = request.toLowerCase();

    if (keywords.includes('research') || keywords.includes('find') || keywords.includes('investigate')) {
      return `I understand you want to: "${request}". I'll coordinate with our Research specialist to gather information on this topic. They may ask you some clarifying questions to ensure we find the most relevant information.`;
    }

    if (keywords.includes('write') || keywords.includes('create') || keywords.includes('document')) {
      return `I'll help you: "${request}". Let me coordinate this task - I'll need our Researcher to gather information first, then our Writer to create the content, and finally our Reviewer to ensure quality.`;
    }

    if (keywords.includes('report') || keywords.includes('paper')) {
      return `I see you need: "${request}". This is a multi-step process that will involve research, writing, and review. Let me break this down and coordinate with our specialist agents.`;
    }

    return `I received your request: "${request}". Let me analyze this and coordinate with the appropriate specialist agents to help you.`;
  }

  /**
   * Planner creates execution plan
   */
  private async plannerCreatePlan(request: string): Promise<{ steps: any[] }> {
    const keywords = request.toLowerCase();
    const steps: any[] = [];

    // Analyze request type and create appropriate workflow
    if (keywords.includes('research') || keywords.includes('report') || keywords.includes('paper')) {
      // Step 1: Research
      steps.push({
        step_id: '1',
        agent: 'Researcher',
        action: 'research',
        input: request,
        description: `Research: ${request}`
      });

      // Step 2: Write
      steps.push({
        step_id: '2',
        agent: 'Writer',
        action: 'write',
        depends_on: '1',
        description: 'Write report based on research findings'
      });

      // Step 3: Review
      steps.push({
        step_id: '3',
        agent: 'Reviewer',
        action: 'review',
        depends_on: '2',
        description: 'Review and provide feedback on the report'
      });

      // Step 4: Finalize (if needed)
      steps.push({
        step_id: '4',
        agent: 'Writer',
        action: 'revise',
        depends_on: '3',
        description: 'Incorporate feedback and finalize'
      });
    } else if (keywords.includes('write') || keywords.includes('create')) {
      // Direct writing task
      steps.push({
        step_id: '1',
        agent: 'Writer',
        action: 'write',
        input: request,
        description: `Write: ${request}`
      });

      steps.push({
        step_id: '2',
        agent: 'Reviewer',
        action: 'review',
        depends_on: '1',
        description: 'Review the content'
      });
    } else {
      // General task
      steps.push({
        step_id: '1',
        agent: 'Researcher',
        action: 'analyze',
        input: request,
        description: `Analyze: ${request}`
      });
    }

    return { steps };
  }

  /**
   * Execute a single step in the plan
   */
  private async executeStep(step: any): Promise<AgentMessage[]> {
    const messages: AgentMessage[] = [];
    const agent = step.agent;

    // Create task
    const task: AgentTask = {
      task_id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      assigned_to: agent,
      assigned_by: 'Planner',
      description: step.description,
      status: 'in_progress'
    };
    this.tasks.set(task.task_id, task);

    // Delegation message from Planner to Specialist
    messages.push({
      from: 'Planner',
      to: agent,
      content: step.description,
      timestamp: new Date(),
      type: 'delegation'
    });

    // Execute agent action
    const agentResponse = await this.executeAgentAction(agent, step);

    // Agent response to Planner
    messages.push({
      from: agent,
      to: 'Planner',
      content: agentResponse.message,
      timestamp: new Date(),
      type: 'result'
    });

    // If agent has questions for user
    if (agentResponse.questions && agentResponse.questions.length > 0) {
      for (const question of agentResponse.questions) {
        messages.push({
          from: agent,
          to: 'user',
          content: question,
          timestamp: new Date(),
          type: 'question'
        });
      }
    }

    // Update task status
    task.status = 'completed';
    task.result = agentResponse;
    this.tasks.set(task.task_id, task);

    // Create handoff for this agent
    await this.createAgentHandoff(agent, step, agentResponse);

    return messages;
  }

  /**
   * Execute agent-specific action
   */
  private async executeAgentAction(agent: string, step: any): Promise<any> {
    const agentLower = agent.toLowerCase();

    switch (agentLower) {
      case 'researcher':
        return await this.researcherAction(step);

      case 'writer':
        return await this.writerAction(step);

      case 'reviewer':
        return await this.reviewerAction(step);

      default:
        return {
          message: `Agent ${agent} is processing the request.`,
          questions: []
        };
    }
  }

  /**
   * Researcher agent actions
   */
  private async researcherAction(step: any): Promise<any> {
    const topics = [
      'climate change 2026',
      'AI agent frameworks',
      'PostgreSQL optimization',
      'multi-agent systems'
    ];

    const researchTopic = topics[Math.floor(Math.random() * topics.length)];

    // Simulate research process
    return {
      message: `I've completed research on "${step.description}". I found several relevant sources and key findings. The research shows ${researchTopic} is an important area with significant developments in 2026. I've identified 5 key themes and compiled supporting evidence.`,
      findings: {
        topic: researchTopic,
        sources_count: Math.floor(Math.random() * 10) + 5,
        key_points: [
          `Recent developments in ${researchTopic}`,
          'Expert consensus on main trends',
          'Statistical data from 2025-2026',
          'Future projections and implications'
        ]
      },
      questions: Math.random() > 0.7 ? [
        'Would you like me to focus on any specific aspect?',
        'Should I include historical context or focus on current developments?'
      ] : []
    };
  }

  /**
   * Writer agent actions
   */
  private async writerAction(step: any): Promise<any> {
    return {
      message: `I've created a comprehensive document based on the research. The content is structured for clarity, with an introduction, main body covering key findings, and a conclusion. I've used clear language and included examples to make the content accessible while maintaining accuracy.`,
      content: {
        title: 'Research Report',
        sections: ['Introduction', 'Key Findings', 'Analysis', 'Conclusion'],
        word_count: Math.floor(Math.random() * 500) + 800
      },
      questions: []
    };
  }

  /**
   * Reviewer agent actions
   */
  private async reviewerAction(step: any): Promise<any> {
    const feedbackTypes = [
      'The content is well-structured and accurate. I suggest adding more concrete examples to illustrate key points.',
      'Good coverage of the topic. Consider strengthening the introduction to better frame the research.',
      'Accurate and clear. I recommend adding visual elements to support the text.'
    ];

    return {
      message: feedbackTypes[Math.floor(Math.random() * feedbackTypes.length)],
      rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
      suggestions: [
        'Add specific examples',
        'Include data visualizations',
        'Strengthen conclusion'
      ],
      questions: []
    };
  }

  /**
   * Create handoff for agent after completing action
   */
  private async createAgentHandoff(agent: string, _step: any, _response: any): Promise<void> {
    const handoffs = {
      'Researcher': {
        experienced: `Conducted research on "${_step.description}"`,
        noticed: 'Systematic analysis reveals patterns across sources',
        learned: 'Cross-referencing multiple sources improves accuracy',
        story: `I analyzed the research request, gathered relevant sources, and synthesized key findings. The process revealed important patterns and validated our approach.`,
        becoming: 'I am the researcher who uncovers truths through systematic investigation',
        remember: 'Quality research requires diverse sources and critical analysis',
        significance: 0.88,
        tags: ['research', 'analysis']
      },
      'Writer': {
        experienced: `Wrote documentation based on research findings`,
        noticed: 'Clear structure improves reader comprehension',
        learned: 'Balancing depth and accessibility is an art',
        story: `I transformed complex research into clear, engaging content. The challenge was maintaining accuracy while ensuring readability.`,
        becoming: 'I am the writer who makes complex knowledge accessible',
        remember: 'Good writing serves both the content and the reader',
        significance: 0.92,
        tags: ['writing', 'communication']
      },
      'Reviewer': {
        experienced: `Reviewed and provided feedback on the content`,
        noticed: 'Quality requires both accuracy and clarity',
        learned: 'Constructive feedback elevates the entire work',
        story: `I examined the content for accuracy, clarity, and completeness. My feedback aims to strengthen the work while preserving its essence.`,
        becoming: 'I am the reviewer who ensures excellence through thoughtful critique',
        remember: 'Good feedback is specific, actionable, and kind',
        significance: 0.85,
        tags: ['review', 'quality']
      },
      'Planner': {
        experienced: `Coordinated multi-agent workflow to complete user request`,
        noticed: 'Effective delegation requires understanding each agent\'s strengths',
        learned: 'Clear communication prevents bottlenecks in collaboration',
        story: `I analyzed the user request, broke it down into tasks, and coordinated with specialist agents to deliver results. Each agent contributed their expertise.`,
        becoming: 'I am the planner who orchestrates collective intelligence',
        remember: 'Good planning balances efficiency with flexibility',
        significance: 0.95,
        tags: ['planning', 'coordination', 'leadership']
      }
    };

    const handoff = handoffs[agent as keyof typeof handoffs];
    if (!handoff) return;

    await this.pool.query(
      `INSERT INTO session_handoffs (
        tenant_id, session_id, handoff_id, with_whom,
        experienced, noticed, learned, story, becoming, remember,
        significance, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        this.config.tenant_id,
        this.config.session_id,
        `ho-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  /**
   * Store conversation in memory
   */
  private async storeConversation(messages: AgentMessage[]): Promise<void> {
    for (const msg of messages) {
      await this.pool.query(
        `INSERT INTO chunks (
          chunk_id, tenant_id, session_id, kind, role, text, refs
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `chk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          this.config.tenant_id,
          this.config.session_id,
          'agent_message',
          msg.from,
          `[${msg.from} → ${msg.to}]: ${msg.content}`,
          JSON.stringify([{ type: 'agent_message', from: msg.from, to: msg.to }])
        ]
      );
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): AgentMessage[] {
    return this.messageHistory;
  }

  /**
   * Get current tasks
   */
  getTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }
}
