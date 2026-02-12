/**
 * Authentication and Authorization middleware
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request type to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        tenant_id: string;
        user_id: string;
        roles: string[];
      };
      tenant_id?: string;
    }
  }
}

export interface JWTPayload {
  tenant_id: string;
  user_id: string;
  roles: string[];
  jti?: string; // JWT ID for token tracking
  iat: number;
  exp: number;
}

export interface RefreshTokenData {
  token_id: string;
  user_id: string;
  tenant_id: string;
  expires_at: Date;
  device_info?: Record<string, any>;
}

export interface AuthConfig {
  secret: string;
  expiresIn: string;
  issuer: string;
}

/**
 * Default auth configuration from environment
 */
export const getAuthConfig = (): AuthConfig => ({
  secret: process.env.JWT_SECRET || "change-this-secret-in-production",
  expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  issuer: process.env.JWT_ISSUER || "agent-memory-system",
});

/**
 * Generate JWT token for a user
 *
 * @param tenant_id - Tenant ID
 * @param user_id - User ID
 * @param roles - User roles
 * @param config - Optional auth config
 * @param jti - Optional JWT ID for token tracking
 * @returns JWT token string
 */
export function generateToken(
  tenant_id: string,
  user_id: string,
  roles: string[] = [],
  config?: AuthConfig,
  jti?: string,
): string {
  const authConfig = config || getAuthConfig();

  const signOptions: any = {
    expiresIn: authConfig.expiresIn,
    issuer: authConfig.issuer,
    subject: user_id,
    audience: "agent-memory-api",
  };

  if (jti) {
    signOptions.jwtid = jti;
  }

  const payload: Omit<JWTPayload, "iat" | "exp" | "jti"> = {
    tenant_id,
    user_id,
    roles,
  };

  return jwt.sign(payload, authConfig.secret, signOptions);
}

/**
 * Verify JWT token
 */
export function verifyToken(
  token: string,
  config?: AuthConfig,
): JWTPayload | null {
  try {
    const authConfig = config || getAuthConfig();
    const decoded = jwt.verify(token, authConfig.secret, {
      issuer: authConfig.issuer,
      audience: "agent-memory-api",
    });

    return decoded as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Bearer token format
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    return parts[1];
  }

  return null;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header",
    });
    return;
  }

  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
    return;
  }

  // Attach user info to request
  req.user = {
    tenant_id: payload.tenant_id,
    user_id: payload.user_id,
    roles: payload.roles,
  };
  req.tenant_id = payload.tenant_id;

  next();
}

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = {
        tenant_id: payload.tenant_id,
        user_id: payload.user_id,
        roles: payload.roles,
      };
      req.tenant_id = payload.tenant_id;
    }
  }

  next();
}

/**
 * Role-based authorization middleware factory
 */
export function requireRole(...requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
      return;
    }

    const hasRole = requiredRoles.some((role) =>
      req.user!.roles.includes(role),
    );

    if (!hasRole) {
      res.status(403).json({
        error: "Forbidden",
        message: `Requires one of roles: ${requiredRoles.join(", ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * Tenant isolation middleware
 * Ensures requests only access data for their tenant
 */
export function requireTenantAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
    return;
  }

  // Check if requested tenant_id matches authenticated user's tenant
  const requestedTenantId =
    req.body.tenant_id || req.query.tenant_id || req.params.tenant_id;

  if (requestedTenantId && requestedTenantId !== req.user.tenant_id) {
    res.status(403).json({
      error: "Forbidden",
      message: "Cannot access data for different tenant",
    });
    return;
  }

  // Override tenant_id with authenticated user's tenant
  req.tenant_id = req.user.tenant_id;

  next();
}

/**
 * API key authentication (alternative to JWT)
 * For service-to-service communication
 */
export interface APIKey {
  key_id: string;
  tenant_id: string;
  scopes: string[];
  created_at: Date;
}

/**
 * Simple API key validation
 * In production, store hashed keys in database
 */
const API_KEYS: Map<string, APIKey> = new Map();

export function generateAPIKey(
  tenant_id: string,
  scopes: string[] = [],
): string {
  const key_id = `ak_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const keySecret =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  const apiKey = `${key_id}.${keySecret}`;

  API_KEYS.set(apiKey, {
    key_id,
    tenant_id,
    scopes,
    created_at: new Date(),
  });

  return apiKey;
}

export function validateAPIKey(apiKey: string): APIKey | null {
  return API_KEYS.get(apiKey) || null;
}

/**
 * API key authentication middleware
 */
export function authenticateAPIKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing API key",
    });
    return;
  }

  const keyData = validateAPIKey(apiKey);

  if (!keyData) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key",
    });
    return;
  }

  // Attach tenant info from API key
  req.user = {
    tenant_id: keyData.tenant_id,
    user_id: `service:${keyData.key_id}`,
    roles: keyData.scopes,
  };
  req.tenant_id = keyData.tenant_id;

  next();
}

/**
 * Combined authentication (JWT or API key)
 */
export function authenticateAny(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  const apiKey = req.headers["x-api-key"] as string;

  if (!token && !apiKey) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing authentication (Bearer token or X-API-Key header)",
    });
    return;
  }

  // Try JWT first
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = {
        tenant_id: payload.tenant_id,
        user_id: payload.user_id,
        roles: payload.roles,
      };
      req.tenant_id = payload.tenant_id;
      next();
      return;
    }
  }

  // Try API key
  if (apiKey) {
    const keyData = validateAPIKey(apiKey);
    if (keyData) {
      req.user = {
        tenant_id: keyData.tenant_id,
        user_id: `service:${keyData.key_id}`,
        roles: keyData.scopes,
      };
      req.tenant_id = keyData.tenant_id;
      next();
      return;
    }
  }

  res.status(401).json({
    error: "Unauthorized",
    message: "Invalid authentication credentials",
  });
}

/**
 * Token blacklist for revoked tokens
 * In production, use Redis or database for distributed systems
 */
const TOKEN_BLACKLIST = new Set<string>();

/**
 * Check if a JWT token is revoked (blacklisted)
 *
 * @param jti - JWT ID
 * @returns Promise<boolean>
 */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  return TOKEN_BLACKLIST.has(jti);
}

/**
 * Revoke a JWT token by adding it to blacklist
 *
 * @param jti - JWT ID
 */
export function revokeToken(jti: string): void {
  TOKEN_BLACKLIST.add(jti);
}

/**
 * Extract device information from request
 *
 * @param req - Express request
 * @returns Device info object
 */
export function extractDeviceInfo(req: Request): Record<string, any> {
  const userAgent = req.headers["user-agent"] || "";

  // Simple device parsing (can be enhanced with ua-parser-js)
  const deviceInfo: Record<string, any> = {
    userAgent,
    ip:
      (req.headers["x-forwarded-for"] as string) ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress,
  };

  // Basic browser detection
  if (userAgent.includes("Chrome")) {
    deviceInfo.browser = "Chrome";
  } else if (userAgent.includes("Firefox")) {
    deviceInfo.browser = "Firefox";
  } else if (userAgent.includes("Safari")) {
    deviceInfo.browser = "Safari";
  } else if (userAgent.includes("Edge")) {
    deviceInfo.browser = "Edge";
  }

  // Basic OS detection
  if (userAgent.includes("Windows")) {
    deviceInfo.os = "Windows";
  } else if (userAgent.includes("Mac")) {
    deviceInfo.os = "macOS";
  } else if (userAgent.includes("Linux")) {
    deviceInfo.os = "Linux";
  } else if (userAgent.includes("Android")) {
    deviceInfo.os = "Android";
  } else if (userAgent.includes("iOS")) {
    deviceInfo.os = "iOS";
  }

  return deviceInfo;
}
