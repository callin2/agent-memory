"use strict";
/**
 * Authentication and Authorization middleware
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthConfig = void 0;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.extractToken = extractToken;
exports.authenticate = authenticate;
exports.optionalAuthenticate = optionalAuthenticate;
exports.requireRole = requireRole;
exports.requireTenantAccess = requireTenantAccess;
exports.generateAPIKey = generateAPIKey;
exports.validateAPIKey = validateAPIKey;
exports.authenticateAPIKey = authenticateAPIKey;
exports.authenticateAny = authenticateAny;
exports.isTokenRevoked = isTokenRevoked;
exports.revokeToken = revokeToken;
exports.extractDeviceInfo = extractDeviceInfo;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Default auth configuration from environment
 */
const getAuthConfig = () => ({
    secret: process.env.JWT_SECRET || "change-this-secret-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    issuer: process.env.JWT_ISSUER || "agent-memory-system",
});
exports.getAuthConfig = getAuthConfig;
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
function generateToken(tenant_id, user_id, roles = [], config, jti) {
    const authConfig = config || (0, exports.getAuthConfig)();
    const signOptions = {
        expiresIn: authConfig.expiresIn,
        issuer: authConfig.issuer,
        subject: user_id,
        audience: "agent-memory-api",
    };
    if (jti) {
        signOptions.jwtid = jti;
    }
    const payload = {
        tenant_id,
        user_id,
        roles,
    };
    return jsonwebtoken_1.default.sign(payload, authConfig.secret, signOptions);
}
/**
 * Verify JWT token
 */
function verifyToken(token, config) {
    try {
        const authConfig = config || (0, exports.getAuthConfig)();
        const decoded = jsonwebtoken_1.default.verify(token, authConfig.secret, {
            issuer: authConfig.issuer,
            audience: "agent-memory-api",
        });
        return decoded;
    }
    catch (error) {
        return null;
    }
}
/**
 * Extract token from Authorization header
 */
function extractToken(req) {
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
function authenticate(req, res, next) {
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
function optionalAuthenticate(req, _res, next) {
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
function requireRole(...requiredRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                error: "Unauthorized",
                message: "Authentication required",
            });
            return;
        }
        const hasRole = requiredRoles.some((role) => req.user.roles.includes(role));
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
function requireTenantAccess(req, res, next) {
    if (!req.user) {
        res.status(401).json({
            error: "Unauthorized",
            message: "Authentication required",
        });
        return;
    }
    // Check if requested tenant_id matches authenticated user's tenant
    const requestedTenantId = req.body.tenant_id || req.query.tenant_id || req.params.tenant_id;
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
 * Simple API key validation
 * In production, store hashed keys in database
 */
const API_KEYS = new Map();
function generateAPIKey(tenant_id, scopes = []) {
    const key_id = `ak_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const keySecret = Math.random().toString(36).substring(2, 15) +
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
function validateAPIKey(apiKey) {
    return API_KEYS.get(apiKey) || null;
}
/**
 * API key authentication middleware
 */
function authenticateAPIKey(req, res, next) {
    const apiKey = req.headers["x-api-key"];
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
function authenticateAny(req, res, next) {
    const token = extractToken(req);
    const apiKey = req.headers["x-api-key"];
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
const TOKEN_BLACKLIST = new Set();
/**
 * Check if a JWT token is revoked (blacklisted)
 *
 * @param jti - JWT ID
 * @returns Promise<boolean>
 */
async function isTokenRevoked(jti) {
    return TOKEN_BLACKLIST.has(jti);
}
/**
 * Revoke a JWT token by adding it to blacklist
 *
 * @param jti - JWT ID
 */
function revokeToken(jti) {
    TOKEN_BLACKLIST.add(jti);
}
/**
 * Extract device information from request
 *
 * @param req - Express request
 * @returns Device info object
 */
function extractDeviceInfo(req) {
    const userAgent = req.headers["user-agent"] || "";
    // Simple device parsing (can be enhanced with ua-parser-js)
    const deviceInfo = {
        userAgent,
        ip: req.headers["x-forwarded-for"] ||
            req.headers["x-real-ip"] ||
            req.socket.remoteAddress,
    };
    // Basic browser detection
    if (userAgent.includes("Chrome")) {
        deviceInfo.browser = "Chrome";
    }
    else if (userAgent.includes("Firefox")) {
        deviceInfo.browser = "Firefox";
    }
    else if (userAgent.includes("Safari")) {
        deviceInfo.browser = "Safari";
    }
    else if (userAgent.includes("Edge")) {
        deviceInfo.browser = "Edge";
    }
    // Basic OS detection
    if (userAgent.includes("Windows")) {
        deviceInfo.os = "Windows";
    }
    else if (userAgent.includes("Mac")) {
        deviceInfo.os = "macOS";
    }
    else if (userAgent.includes("Linux")) {
        deviceInfo.os = "Linux";
    }
    else if (userAgent.includes("Android")) {
        deviceInfo.os = "Android";
    }
    else if (userAgent.includes("iOS")) {
        deviceInfo.os = "iOS";
    }
    return deviceInfo;
}
//# sourceMappingURL=auth.js.map