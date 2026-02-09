/**
 * Security utilities for input validation and protection
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Validate required fields in request body
 */
export function validateRequired(fields: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing: string[] = [];

    for (const field of fields) {
      if (!req.body[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      res.status(400).json({
        error: 'Missing required fields',
        fields: missing,
      });
      return;
    }

    next();
  };
}

/**
 * Validate enum values
 */
export function validateEnum(field: string, allowedValues: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.body[field];

    if (value && !allowedValues.includes(value)) {
      res.status(400).json({
        error: `Invalid ${field}`,
        allowed: allowedValues,
        received: value,
      });
      return;
    }

    next();
  };
}

/**
 * Sanitize string input to prevent injection
 */
export function sanitizeString(input: string, maxLength: number = 10000): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate and sanitize event input
 */
export function validateEventInput(input: any): { valid: boolean; errors: string[]; sanitized?: any } {
  const errors: string[] = [];

  // Required fields
  if (!input.tenant_id || typeof input.tenant_id !== 'string') {
    errors.push('tenant_id is required and must be a string');
  }

  if (!input.session_id || typeof input.session_id !== 'string') {
    errors.push('session_id is required and must be a string');
  }

  if (!input.channel || !['private', 'public', 'team', 'agent'].includes(input.channel)) {
    errors.push('channel must be one of: private, public, team, agent');
  }

  if (!input.actor || typeof input.actor !== 'object') {
    errors.push('actor is required and must be an object');
  } else {
    if (!input.actor.type || !['human', 'agent', 'tool'].includes(input.actor.type)) {
      errors.push('actor.type must be one of: human, agent, tool');
    }
    if (!input.actor.id || typeof input.actor.id !== 'string') {
      errors.push('actor.id is required');
    }
  }

  if (!input.kind || !['message', 'tool_call', 'tool_result', 'decision', 'task_update', 'artifact'].includes(input.kind)) {
    errors.push('kind must be one of: message, tool_call, tool_result, decision, task_update, artifact');
  }

  if (input.sensitivity && !['none', 'low', 'high', 'secret'].includes(input.sensitivity)) {
    errors.push('sensitivity must be one of: none, low, high, secret');
  }

  if (input.tags && !Array.isArray(input.tags)) {
    errors.push('tags must be an array');
  }

  if (input.refs && !Array.isArray(input.refs)) {
    errors.push('refs must be an array');
  }

  // Validate content
  if (!input.content || typeof input.content !== 'object') {
    errors.push('content is required and must be an object');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Sanitize inputs
  const sanitized = {
    tenant_id: sanitizeString(input.tenant_id, 256),
    session_id: sanitizeString(input.session_id, 256),
    channel: input.channel,
    actor: {
      type: input.actor.type,
      id: sanitizeString(input.actor.id, 256),
    },
    kind: input.kind,
    sensitivity: input.sensitivity || 'none',
    tags: (input.tags || []).map((t: string) => sanitizeString(t, 100)),
    content: sanitizeContent(input.content),
    refs: (input.refs || []).map((r: string) => sanitizeString(r, 256)),
  };

  return { valid: true, errors: [], sanitized };
}

/**
 * Sanitize content object
 */
function sanitizeContent(content: any): any {
  const sanitized: any = {};

  for (const [key, value] of Object.entries(content)) {
    if (typeof value === 'string') {
      // Limit string field sizes
      sanitized[key] = sanitizeString(value, 100000);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeContent(value);
    } else if (Array.isArray(value)) {
      // Sanitize array elements
      sanitized[key] = value.map((v) => (typeof v === 'string' ? sanitizeString(v, 10000) : v));
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Rate limiter using in-memory storage
 * For production, use Redis or similar
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key)!;

    // Remove old timestamps
    const recent = timestamps.filter((t) => t > windowStart);
    this.requests.set(key, recent);

    // Check limit
    if (recent.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    recent.push(now);
    return true;
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const recent = timestamps.filter((t) => t > windowStart);

      if (recent.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recent);
      }
    }
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }
}

// Singleton instances
export const eventRateLimiter = new RateLimiter(60000, 100); // 100 requests per minute
export const acbRateLimiter = new RateLimiter(60000, 60); // 60 ACB builds per minute

/**
 * Rate limiting middleware
 */
export function rateLimiter(limiter: RateLimiter, keyExtractor: (req: Request) => string): (req: Request, res: Response, next: NextFunction) => void {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const key = keyExtractor(_req);

    if (!limiter.isAllowed(key)) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(limiter['windowMs'] / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Content Security Policy headers
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
}

/**
 * Log security events
 */
export function logSecurityEvent(event: string, details: any): void {
  console.error(`[SECURITY] ${event}:`, JSON.stringify(details));
}

/**
 * Detect common attack patterns
 */
export function detectSuspiciousInput(input: string): boolean {
  const patterns = [
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /javascript:/gi, // Javascript protocol
    /on\w+\s*=/gi, // Event handlers
    /<iframe[^>]*>/gi, // Iframes
    /<embed[^>]*>/gi, // Embed tags
    /<object[^>]*>/gi, // Object tags
    /eval\s*\(/gi, // Eval calls
    /expression\s*\(/gi, // CSS expressions
    /<[^>]+>/g, // Any HTML tag (sanitization)
  ];

  return patterns.some((pattern) => pattern.test(input));
}
