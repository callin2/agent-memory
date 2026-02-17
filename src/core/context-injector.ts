/**
 * Transparent Context Injection
 *
 * Automatically injects Active Context Bundles (ACB) into agent requests
 * without the agent explicitly requesting them.
 *
 * This enables memory-augmented agents where:
 * - Agent sends normal request
 * - Backend detects context is needed
 * - Backend auto-builds and injects ACB
 * - Agent receives context-enhanced response
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { buildACB } from './orchestrator.js';

/**
 * Context injection configuration
 */
interface ContextInjectionConfig {
  enabled: boolean;
  defaultMaxTokens: number;
  injectOnPaths: string[];  // Paths where ACB should be auto-injected
  requireIntent: boolean;  // Require explicit intent header
}

/**
 * Create context injection middleware
 */
export function createContextInjector(
  pool: Pool,
  config: Partial<ContextInjectionConfig> = {}
) {
  const fullConfig: ContextInjectionConfig = {
    enabled: true,
    defaultMaxTokens: 65000,
    injectOnPaths: ['/api/v1/chat', '/api/v1/message', '/api/v1/agent'],
    requireIntent: false,
    ...config,
  };

  return async (req: Request, _res: Response, next: NextFunction) => {
    // Skip if disabled
    if (!fullConfig.enabled) {
      return next();
    }

    // Check if path needs context injection
    const needsContext = fullConfig.injectOnPaths.some(path =>
      req.path.startsWith(path)
    );

    if (!needsContext) {
      return next();
    }

    // Extract context parameters
    const context = extractContextParams(req, fullConfig);

    if (!context) {
      // Not enough context info, skip injection
      return next();
    }

    try {
      // Build ACB transparently
      const acb = await buildACB(pool, context);

      // Inject ACB into request
      (req as any).injectedContext = acb;

      console.log(`[Context Injector] Injected ACB for session ${context.session_id}`);
    } catch (error) {
      // Don't fail request if ACB injection fails
      console.error('[Context Injector] Failed to build ACB:', error);
      // Continue without context
    }

    next();
  };
}

/**
 * Extract context parameters for ACB building
 */
function extractContextParams(
  req: Request,
  config: ContextInjectionConfig
): any | null {
  // Try headers first
  if (req.headers['x-session-id'] && req.headers['x-agent-id']) {
    const context: any = {
      tenant_id: req.headers['x-tenant-id'] || 'default',
      session_id: req.headers['x-session-id'],
      agent_id: req.headers['x-agent-id'],
      channel: req.headers['x-channel'] || 'private',
      intent: req.headers['x-intent'] || 'general',
      max_tokens: config.defaultMaxTokens,
    };

    // Extract query text if available
    if (req.body?.text || req.body?.query) {
      context.query_text = req.body.text || req.body.query;
    }

    return context;
  }

  // Try request body
  if (req.body?.session_id && req.body?.agent_id) {
    return {
      tenant_id: req.body.tenant_id || 'default',
      session_id: req.body.session_id,
      agent_id: req.body.agent_id,
      channel: req.body.channel || 'private',
      intent: req.body.intent || 'general',
      query_text: req.body.text || req.body.query || '',
      max_tokens: req.body.max_tokens || config.defaultMaxTokens,
    };
  }

  // Try query params
  if (req.query?.session_id && req.query?.agent_id) {
    return {
      tenant_id: req.query.tenant_id || 'default',
      session_id: req.query.session_id,
      agent_id: req.query.agent_id,
      channel: req.query.channel || 'private',
      intent: req.query.intent || 'general',
      query_text: req.query.text || req.query.query || '',
      max_tokens: Number(req.query.max_tokens) || config.defaultMaxTokens,
    };
  }

  return null;
}

/**
 * Get injected context from request (for route handlers)
 */
export function getInjectedContext(req: Request): any | undefined {
  return (req as any).injectedContext;
}

/**
 * Utility to add context to response
 */
export function addContextToResponse(response: any, acb: any): any {
  return {
    ...response,
    _context: {
      bundle_id: acb.bundle_id,
      token_count: acb.token_count,
      chunk_count: acb.chunks?.length || 0,
      decision_count: acb.decisions?.length || 0,
      artifact_count: acb.artifacts?.length || 0,
    },
  };
}
