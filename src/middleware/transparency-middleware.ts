/**
 * Transparent Memory Middleware
 *
 * This middleware automatically intercepts and records all agent activity
 * to memory capsules WITHOUT the agent knowing about it.
 *
 * True Transparency:
 * - Agent modules send normal messages/decisions
 * - Backend automatically captures events
 * - Backend automatically builds ACB when needed
 * - Agent modules never call memory APIs directly
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { recordEvent } from '../core/recorder.js';

/**
 * Extract agent context from request
 */
interface AgentContext {
  tenant_id?: string;
  session_id?: string;
  agent_id?: string;
  channel?: 'private' | 'public' | 'team' | 'agent';
}

/**
 * Event kinds we auto-capture
 */
type AutoEventKind =
  | 'message'           // User message
  | 'agent_response'     // Agent response
  | 'decision'          // Agent decision
  | 'tool_call'         // Tool usage
  | 'artifact_created'   // Generated artifact
  | 'task_update';       // Task status change

/**
 * Auto-capture configuration
 */
interface AutoCaptureConfig {
  enabled: boolean;
  captureMessages: boolean;
  captureDecisions: boolean;
  captureToolCalls: boolean;
  captureArtifacts: boolean;
  captureTaskUpdates: boolean;
}

/**
 * Create transparent memory middleware
 */
export function createTransparencyMiddleware(
  pool: Pool,
  config: Partial<AutoCaptureConfig> = {}
) {
  const fullConfig: AutoCaptureConfig = {
    enabled: true,
    captureMessages: true,
    captureDecisions: true,
    captureToolCalls: true,
    captureArtifacts: true,
    captureTaskUpdates: true,
    ...config,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip transparency if disabled
    if (!fullConfig.enabled) {
      return next();
    }

    // Skip for non-agent routes (health, metrics, static files)
    if (req.path.startsWith('/health') ||
        req.path.startsWith('/metrics') ||
        req.path.startsWith('/test-harness')) {
      return next();
    }

    // Skip for GET requests (read-only)
    if (req.method === 'GET') {
      return next();
    }

    const startTime = Date.now();

    // Capture original res.json to intercept response
    const originalJson = res.json.bind(res);
    const responseData: any[] = [];

    res.json = function(data: any) {
      responseData.push(data);
      return originalJson(data);
    };

    // Wait for response to complete
    res.on('finish', async () => {
      const duration = Date.now() - startTime;

      // Auto-capture the activity
      await autoCaptureActivity(pool, req, responseData[0], duration, fullConfig);
    });

    next();
  };
}

/**
 * Auto-capture activity based on request type
 */
async function autoCaptureActivity(
  pool: Pool,
  req: Request,
  responseData: any,
  duration: number,
  config: AutoCaptureConfig
): Promise<void> {
  try {
    const context = extractAgentContext(req);

    if (!context.session_id || !context.tenant_id) {
      // No valid context, skip capture
      return;
    }

    // Determine event kind from request
    const eventKind = determineEventKind(req, responseData);

    if (!eventKind || !shouldCapture(eventKind, config)) {
      return;
    }

    // Extract event content
    const content = extractEventContent(req, responseData, eventKind);

    if (!content) {
      return;
    }

    // Record event transparently
    await recordEvent(pool, {
      tenant_id: context.tenant_id,
      session_id: context.session_id,
      channel: context.channel || 'private',
      actor: {
        type: 'agent',  // Default to agent
        id: context.agent_id || 'unknown',
      },
      kind: eventKind,
      sensitivity: 'none',
      tags: extractTags(req, eventKind),
      content,
      refs: extractRefs(responseData),
    });

    console.log(`[Transparent Memory] Captured ${eventKind} event for session ${context.session_id}`);
  } catch (error) {
    // Don't break requests if capture fails
    console.error('[Transparent Memory] Failed to capture event:', error);
  }
}

/**
 * Extract agent context from request
 */
function extractAgentContext(req: Request): AgentContext {
  // Try headers first
  if (req.headers['x-tenant-id'] || req.headers['x-session-id']) {
    return {
      tenant_id: req.headers['x-tenant-id'] as string,
      session_id: req.headers['x-session-id'] as string,
      agent_id: req.headers['x-agent-id'] as string,
      channel: req.headers['x-channel'] as any,
    };
  }

  // Try request body
  if (req.body) {
    return {
      tenant_id: req.body.tenant_id,
      session_id: req.body.session_id,
      agent_id: req.body.agent_id,
      channel: req.body.channel,
    };
  }

  // Try query params
  if (req.query) {
    return {
      tenant_id: req.query.tenant_id as string,
      session_id: req.query.session_id as string,
      agent_id: req.query.agent_id as string,
      channel: req.query.channel as any,
    };
  }

  return {};
}

/**
 * Determine event kind from request
 */
function determineEventKind(req: Request, responseData: any): AutoEventKind | null {
  const path = req.path;

  // Agent messages
  if (path.includes('/message') || path.includes('/chat')) {
    if (req.method === 'POST') {
      return responseData?.actor ? 'agent_response' : 'message';
    }
  }

  // Decisions
  if (path.includes('/decision') || path.includes('/decide')) {
    return 'decision';
  }

  // Tool calls
  if (path.includes('/tool') || path.includes('/function')) {
    return 'tool_call';
  }

  // Artifacts
  if (path.includes('/artifact') || path.includes('/generate')) {
    return 'artifact_created';
  }

  // Task updates
  if (path.includes('/task') || path.includes('/status')) {
    return 'task_update';
  }

  return null;
}

/**
 * Check if we should capture this event kind
 */
function shouldCapture(kind: AutoEventKind, config: AutoCaptureConfig): boolean {
  switch (kind) {
    case 'message':
    case 'agent_response':
      return config.captureMessages;
    case 'decision':
      return config.captureDecisions;
    case 'tool_call':
      return config.captureToolCalls;
    case 'artifact_created':
      return config.captureArtifacts;
    case 'task_update':
      return config.captureTaskUpdates;
    default:
      return false;
  }
}

/**
 * Extract event content from request/response
 */
function extractEventContent(
  req: Request,
  responseData: any,
  kind: AutoEventKind
): Record<string, unknown> | null {
  switch (kind) {
    case 'message':
    case 'agent_response':
      return {
        text: req.body?.text || responseData?.text || '',
        metadata: {
          method: req.method,
          path: req.path,
          duration: responseData?.duration,
        },
      };

    case 'decision':
      return {
        decision: req.body?.decision || responseData?.decision,
        rationale: req.body?.rationale || responseData?.rationale,
        constraints: req.body?.constraints || responseData?.constraints,
        alternatives: req.body?.alternatives || responseData?.alternatives,
        metadata: {
          scope: req.body?.scope || responseData?.scope,
        },
      };

    case 'tool_call':
      return {
        tool: req.body?.tool || responseData?.tool,
        parameters: req.body?.parameters || responseData?.parameters,
        result: responseData?.result,
        metadata: {
          duration: responseData?.duration,
        },
      };

    case 'artifact_created':
      return {
        artifact_type: req.body?.type || responseData?.type,
        artifact_id: responseData?.artifact_id,
        metadata: req.body?.metadata,
      };

    case 'task_update':
      return {
        task_id: req.body?.task_id || responseData?.task_id,
        status: req.body?.status || responseData?.status,
        progress: req.body?.progress || responseData?.progress,
        metadata: req.body?.metadata,
      };

    default:
      return null;
  }
}

/**
 * Extract tags for event categorization
 */
function extractTags(req: Request, kind: AutoEventKind): string[] {
  const tags = [kind, req.method];

  // Add path-based tags
  const pathParts = req.path.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    tags.push(pathParts[0]); // e.g., 'api'
  }
  if (pathParts.length > 1) {
    tags.push(pathParts[1]); // e.g., 'v1'
  }

  // Add content-based tags
  if (req.body?.tags) {
    tags.push(...req.body.tags);
  }

  return tags;
}

/**
 * Extract references from response
 */
function extractRefs(responseData: any): string[] {
  const refs: string[] = [];

  if (responseData?.event_id) {
    refs.push(responseData.event_id);
  }

  if (responseData?.artifact_id) {
    refs.push(responseData.artifact_id);
  }

  if (responseData?.decision_id) {
    refs.push(responseData.decision_id);
  }

  if (responseData?.refs && Array.isArray(responseData.refs)) {
    refs.push(...responseData.refs);
  }

  return refs;
}
