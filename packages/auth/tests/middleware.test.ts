/**
 * Unit Tests: Express Middleware
 *
 * Tests for authentication middleware functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  extractToken,
  authenticate,
  optionalAuthenticate,
  requireRole,
  authenticateAPIKey,
  authenticateAny,
} from '../src/middleware.js';
import { generateToken } from '../src/jwt.js';
import { generateAPIKey, validateAPIKey } from '../src/api-keys.js';

// Mock Express Request, Response, and NextFunction
const mockRequest = (headers: Record<string, string> = {}): Partial<Request> => ({
  headers,
});

const mockResponse = () => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

const mockNext = vi.fn();

describe('Middleware Functions', () => {
  beforeEach(() => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_ISSUER = 'test-issuer';

    // Clear mocks
    vi.clearAllMocks();
  });

  describe('extractToken', () => {
    it('should extract token from valid Bearer header', () => {
      const token = generateToken('tenant123', 'user456');
      const req = mockRequest({ authorization: `Bearer ${token}` });

      const extracted = extractToken(req as Request);

      expect(extracted).toBe(token);
    });

    it('should return null for missing authorization header', () => {
      const req = mockRequest();

      const extracted = extractToken(req as Request);

      expect(extracted).toBeNull();
    });

    it('should return null for malformed authorization header', () => {
      const req = mockRequest({ authorization: 'InvalidFormat' });

      const extracted = extractToken(req as Request);

      expect(extracted).toBeNull();
    });

    it('should return null for authorization without Bearer prefix', () => {
      const token = generateToken('tenant123', 'user456');
      const req = mockRequest({ authorization: token });

      const extracted = extractToken(req as Request);

      expect(extracted).toBeNull();
    });
  });

  describe('authenticate', () => {
    it('should authenticate valid JWT token', () => {
      const token = generateToken('tenant123', 'user456', ['admin']);
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();
      const next = mockNext;

      authenticate(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeDefined();
      expect(req.user?.tenant_id).toBe('tenant123');
      expect(req.user?.user_id).toBe('user456');
      expect(req.user?.roles).toEqual(['admin']);
      expect(req.tenant_id).toBe('tenant123');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject missing token', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      authenticate(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
    });

    it('should reject invalid token', () => {
      const req = mockRequest({ authorization: 'Bearer invalid-token' });
      const res = mockResponse();
      const next = mockNext;

      authenticate(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    });

    it('should reject malformed authorization header', () => {
      const req = mockRequest({ authorization: 'InvalidFormat token123' });
      const res = mockResponse();
      const next = mockNext;

      authenticate(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('optionalAuthenticate', () => {
    it('should authenticate when valid token is present', () => {
      const token = generateToken('tenant123', 'user456', ['user']);
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();
      const next = mockNext;

      optionalAuthenticate(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeDefined();
      expect(req.user?.user_id).toBe('user456');
    });

    it('should pass through when token is missing', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      optionalAuthenticate(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeUndefined();
    });

    it('should pass through when token is invalid', () => {
      const req = mockRequest({ authorization: 'Bearer invalid-token' });
      const res = mockResponse();
      const next = mockNext;

      optionalAuthenticate(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeUndefined();
    });
  });

  describe('requireRole', () => {
    it('should allow access when user has required role', () => {
      const req = mockRequest();
      req.user = {
        tenant_id: 'tenant123',
        user_id: 'user456',
        roles: ['admin', 'user'],
      };
      const res = mockResponse();
      const next = mockNext;

      const middleware = requireRole('admin');
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access when user has one of multiple required roles', () => {
      const req = mockRequest();
      req.user = {
        tenant_id: 'tenant123',
        user_id: 'user456',
        roles: ['user'],
      };
      const res = mockResponse();
      const next = mockNext;

      const middleware = requireRole('admin', 'user', 'moderator');
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should deny access when user lacks required role', () => {
      const req = mockRequest();
      req.user = {
        tenant_id: 'tenant123',
        user_id: 'user456',
        roles: ['user'],
      };
      const res = mockResponse();
      const next = mockNext;

      const middleware = requireRole('admin');
      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Requires one of roles: admin',
      });
    });

    it('should deny access when user is not authenticated', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      const middleware = requireRole('admin');
      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });
  });

  describe('authenticateAPIKey', () => {
    it('should authenticate valid API key', () => {
      const apiKey = generateAPIKey('tenant123', ['read', 'write']);
      const req = mockRequest({ 'x-api-key': apiKey });
      const res = mockResponse();
      const next = mockNext;

      authenticateAPIKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeDefined();
      expect(req.user?.tenant_id).toBe('tenant123');
      expect(req.user?.user_id).toMatch(/^service:/);
      expect(req.user?.roles).toEqual(['read', 'write']);
    });

    it('should reject missing API key', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      authenticateAPIKey(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing API key',
      });
    });

    it('should reject invalid API key', () => {
      const req = mockRequest({ 'x-api-key': 'invalid-api-key' });
      const res = mockResponse();
      const next = mockNext;

      authenticateAPIKey(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
    });
  });

  describe('authenticateAny', () => {
    it('should authenticate valid JWT token', () => {
      const token = generateToken('tenant123', 'user456', ['admin']);
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();
      const next = mockNext;

      authenticateAny(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeDefined();
      expect(req.user?.user_id).toBe('user456');
    });

    it('should authenticate valid API key', () => {
      const apiKey = generateAPIKey('tenant123', ['read', 'write']);
      const req = mockRequest({ 'x-api-key': apiKey });
      const res = mockResponse();
      const next = mockNext;

      authenticateAny(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeDefined();
      expect(req.user?.user_id).toMatch(/^service:/);
    });

    it('should prefer JWT over API key when both present', () => {
      const token = generateToken('tenant123', 'user456', ['admin']);
      const apiKey = generateAPIKey('tenant789', ['read']);
      const req = mockRequest({
        authorization: `Bearer ${token}`,
        'x-api-key': apiKey,
      });
      const res = mockResponse();
      const next = mockNext;

      authenticateAny(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user?.user_id).toBe('user456'); // JWT user, not API key
    });

    it('should reject when both authentication methods are missing', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      authenticateAny(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing authentication (Bearer token or X-API-Key header)',
      });
    });

    it('should reject when both authentication methods are invalid', () => {
      const req = mockRequest({
        authorization: 'Bearer invalid-token',
        'x-api-key': 'invalid-key',
      });
      const res = mockResponse();
      const next = mockNext;

      authenticateAny(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should accept valid JWT even if API key is invalid', () => {
      const token = generateToken('tenant123', 'user456');
      const req = mockRequest({
        authorization: `Bearer ${token}`,
        'x-api-key': 'invalid-key',
      });
      const res = mockResponse();
      const next = mockNext;

      authenticateAny(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user?.user_id).toBe('user456');
    });

    it('should accept valid API key if JWT is invalid', () => {
      const apiKey = generateAPIKey('tenant123', ['read']);
      const req = mockRequest({
        authorization: 'Bearer invalid-token',
        'x-api-key': apiKey,
      });
      const res = mockResponse();
      const next = mockNext;

      authenticateAny(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user?.user_id).toMatch(/^service:/);
    });
  });
});
