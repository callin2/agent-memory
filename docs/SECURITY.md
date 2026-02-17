# Security Guide

**Best practices for securing Thread's Memory System in production**

This guide covers security considerations and hardening steps for deploying the memory system.

## Table of Contents

- [Security Checklist](#security-checklist)
- [Authentication & Authorization](#authentication--authorization)
- [Database Security](#database-security)
- [API Security](#api-security)
- [Deployment Security](#deployment-security)
- [Audit Logging](#audit-logging)
- [Incident Response](#incident-response)

---

## Security Checklist

### Pre-Deployment

- [ ] Change all default passwords
- [ ] Enable SSL/TLS for database connections
- [ ] Configure environment-specific secrets
- [ ] Set up CORS restrictions
- [ ] Enable rate limiting
- [ ] Configure audit logging
- [ ] Set up intrusion detection
- [ ] Review database permissions
- [ ] Enable request validation
- [ ] Configure backup encryption

### Post-Deployment

- [ ] Run security scanner (npm audit)
- [ ] Test authentication flows
- [ ] Verify API rate limits
- [ ] Check CORS configuration
- [ ] Review audit logs
- [ ] Test backup/restore procedures
- [ ] Verify secret management
- [ ] Monitor for suspicious activity

---

## Authentication & Authorization

### Current State (v2.0.0)

The system currently has **multi-tenancy isolation** but **no authentication**. All requests with a valid `tenant_id` can access that tenant's data.

⚠️ **IMPORTANT:** This is suitable for single-user or trusted environments. For multi-user production deployments, implement authentication.

### Recommended Authentication Patterns

#### 1. API Key Authentication

**Use case:** Service-to-service communication, simple integrations

```typescript
// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // Verify API key
  const valid = verifyApiKey(apiKey, req.body.tenant_id);

  if (!valid) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  req.user = { tenant_id: req.body.tenant_id };
  next();
}

// Verify API key from database
async function verifyApiKey(apiKey: string, tenantId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT api_key_hash FROM api_keys WHERE tenant_id = $1',
    [tenantId]
  );

  if (result.rows.length === 0) return false;

  // Compare hash
  return await bcrypt.compare(apiKey, result.rows[0].api_key_hash);
}
```

**Usage:**
```typescript
import { apiKeyAuth } from './middleware/auth.js';

app.use('/api/v1/handoffs', apiKeyAuth, handoffRoutes);
```

---

#### 2. JWT Bearer Tokens

**Use case:** User-facing applications, session management

```typescript
// middleware/jwt-auth.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_AUDIENCE = 'agent-memory-api';

export function jwtAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer token required' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      audience: JWT_AUDIENCE,
      issuer: 'agent-memory'
    }) as JWTPayload;

    req.user = {
      tenant_id: decoded.tenant_id,
      user_id: decoded.sub
    };

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

interface JWTPayload {
  sub: string;       // user_id
  tenant_id: string;
  iat: number;
  exp: number;
}
```

**Token generation:**
```typescript
import jwt from 'jsonwebtoken';

function generateToken(userId: string, tenantId: string): string {
  return jwt.sign(
    {
      tenant_id: tenantId
    },
    process.env.JWT_SECRET,
    {
      subject: userId,
      audience: 'agent-memory-api',
      issuer: 'agent-memory',
      expiresIn: '1h'
    }
  );
}
```

---

#### 3. OAuth 2.0 / OpenID Connect

**Use case:** Enterprise deployments, SSO integration

```typescript
// Use Passport.js with OAuth2 strategy
import passport from 'passport';
import { OAuth2Strategy } from 'passport-oauth';

passport.use('oauth2', new OAuth2Strategy({
    authorizationURL: process.env.OAUTH_AUTH_URL,
    tokenURL: process.env.OAUTH_TOKEN_URL,
    clientID: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    callbackURL: process.env.OAUTH_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    // Verify user belongs to tenant
    const tenantId = getTenantFromProfile(profile);
    done(null, { tenant_id: tenantId, profile });
  }
));
```

---

## Database Security

### Connection Security

**Always use SSL for database connections:**

```typescript
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
    ca: process.env.PG_CA_CERT
  }
});
```

**Force SSL in PostgreSQL:**
```sql
-- In postgresql.conf or via ALTER SYSTEM
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/path/to/server.crt';
ALTER SYSTEM SET ssl_key_file = '/path/to/server.key';

-- Require SSL for all connections
ALTER SYSTEM SET ssl_min_protocol_version = 'TLSv1.2';
```

---

### Principle of Least Privilege

**Create separate database users for different roles:**

```sql
-- Application user (read/write)
CREATE USER agent_mem_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE agent_memory TO agent_mem_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO agent_mem_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agent_mem_app;

-- Read-only user (for analytics/monitoring)
CREATE USER agent_mem_readonly WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE agent_memory TO agent_mem_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_mem_readonly;

-- Migration user (admin)
CREATE USER agent_mem_admin WITH PASSWORD 'admin_password';
GRANT ALL PRIVILEGES ON DATABASE agent_memory TO agent_mem_admin;
GRANT ALL PRIVILESES ON ALL TABLES IN SCHEMA public TO agent_mem_admin;
```

**Environment-specific credentials:**
```bash
# .env.production
PGUSER=agent_mem_app
PGPASSWORD=<production_password>

# .env.development
PGUSER=agent_mem_admin
PGPASSWORD=<dev_password>
```

---

### SQL Injection Prevention

**Always use parameterized queries:**

✅ **Correct:**
```typescript
const result = await pool.query(
  'SELECT * FROM session_handoffs WHERE tenant_id = $1',
  [tenantId]
);
```

❌ **Wrong:**
```typescript
// VULNERABLE TO SQL INJECTION
const result = await pool.query(
  `SELECT * FROM session_handoffs WHERE tenant_id = '${tenantId}'`
);
```

**Use query builders with validation:**
```typescript
import { z } from 'zod';

const HandoffQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0)
});

function queryHandoffs(params: unknown) {
  const validated = HandoffQuerySchema.parse(params);

  return pool.query(
    'SELECT * FROM session_handoffs WHERE tenant_id = $1 LIMIT $2 OFFSET $3',
    [validated.tenant_id, validated.limit, validated.offset]
  );
}
```

---

### Row-Level Security

**Enable PostgreSQL Row-Level Security (RLS):**

```sql
-- Enable RLS on session_handoffs
ALTER TABLE session_handoffs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's data
CREATE POLICY tenant_isolation ON session_handoffs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Set tenant_id for each request
CREATE OR REPLACE FUNCTION set_tenant_id() RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', current_user, false);
END;
$$ LANGUAGE plpgsql;
```

---

## API Security

### Rate Limiting

**Implement rate limiting to prevent abuse:**

```typescript
// middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Stricter limit for write operations
  message: 'Too many write requests'
});

// Usage
app.use('/api/v1', apiLimiter);
app.use('/api/v1/handoffs', strictLimiter); // Write operations
```

---

### Input Validation

**Validate all inputs using schemas:**

```typescript
import { z } from 'zod';

export const CreateHandoffSchema = z.object({
  tenant_id: z.string().uuid(),
  session_id: z.string().min(1).max(255),
  with_whom: z.string().min(1).max(255),
  experienced: z.string().max(5000),
  noticed: z.string().max(5000).optional(),
  learned: z.string().max(5000).optional(),
  story: z.string().max(10000).optional(),
  becoming: z.string().max(500).optional(),
  remember: z.string().max(1000).optional(),
  significance: z.number().min(0).max(1),
  tags: z.array(z.string().max(50)).max(20).optional()
});

// In route handler
app.post('/api/v1/handoffs', async (req, res) => {
  try {
    const validated = CreateHandoffSchema.parse(req.body);
    // Process validated data
  } catch (error) {
    return res.status(400).json({ error: 'Invalid input', details: error });
  }
});
```

---

### CORS Configuration

**Restrict CORS to trusted origins:**

```typescript
import cors from 'cors';

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'https://yourdomain.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow same-origin

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

### Security Headers

**Add security headers:**

```typescript
import helmet from 'helmet';

app.use(helmet());

// Or manually configure
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

---

## Deployment Security

### Environment Variable Management

**Never commit secrets to git:**

```bash
# .gitignore
.env
.env.local
.env.*.local
*.key
*.pem
```

**Use secret management:**
```typescript
// For production, use proper secret management
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretsManager({ region: 'us-east-1' });
  const response = await client.getSecretValue({ SecretId: secretName });
  return response.SecretString as string;
}

// Usage
const dbPassword = await getSecret('agent-memory/db-password');
```

---

### Docker Security

**Use non-root user:**

```dockerfile
# Dockerfile
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build
RUN npm run build

# Switch to non-root user
USER nodejs

EXPOSE 3456

CMD ["node", "dist/server.js"]
```

**Scan for vulnerabilities:**
```bash
# Scan Docker image
docker scan agent-memory:latest

# Use Trivy
trivy image agent-memory:latest
```

---

### File Permissions

**Secure sensitive files:**

```bash
# .env file
chmod 600 .env

# Private keys
chmod 600 *.key *.pem

# Scripts
chmod 700 scripts/*.sh
```

---

## Audit Logging

### Enable Audit Logs

**Log all sensitive operations:**

```typescript
// middleware/audit-log.ts
import { audit } from '../services/audit-logger.js';

export function auditLog(operation: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Log on completion
    res.on('finish', async () => {
      await audit.log({
        tenant_id: req.user?.tenant_id,
        user_id: req.user?.sub,
        operation,
        endpoint: req.path,
        method: req.method,
        status_code: res.statusCode,
        duration_ms: Date.now() - startTime,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
    });

    next();
  };
}

// Usage
app.use('/api/v1/handoffs',
  auditLog('handoff.create'),
  handoffRoutes
);
```

**Audit log storage:**
```sql
CREATE TABLE audit_logs (
  log_id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id TEXT,
  operation TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_user_created ON audit_logs(user_id, created_at DESC);
```

---

### Monitoring Suspicious Activity

**Alert on anomalies:**

```typescript
// services/anomaly-detection.ts
export function detectAnomalies() {
  // Too many failed auth attempts
  checkFailedAuthAttempts();

  // Unusual data access patterns
  checkUnusualAccessPatterns();

  // Data exfiltration attempts
  checkLargeExports();
}

async function checkFailedAuthAttempts() {
  const result = await pool.query(`
    SELECT tenant_id, COUNT(*) as failed_attempts
    FROM audit_logs
    WHERE operation = 'auth.failed'
      AND created_at > NOW() - INTERVAL '5 minutes'
    GROUP BY tenant_id
    HAVING COUNT(*) > 10
  `);

  if (result.rows.length > 0) {
    alertSecurityTeam('Multiple failed auth attempts', result.rows);
  }
}
```

---

## Incident Response

### Security Incident Response Plan

**1. Detection**
- Monitor logs for suspicious activity
- Set up alerts for anomalies
- Regular security scans

**2. Containment**
- Isolate affected systems
- Revoke compromised credentials
- Enable additional logging

**3. Eradication**
- Patch vulnerabilities
- Remove malicious code
- Update firewall rules

**4. Recovery**
- Restore from clean backups
- Verify system integrity
- Monitor for recurrence

**5. Post-Incident**
- Document incident
- Improve processes
- Train team

---

### Incident Response Checklist

**Immediate Actions (0-1 hour):**
- [ ] Identify scope of breach
- [ ] Preserve logs and evidence
- [ ] Isolate affected systems
- [ ] Alert security team
- [ ] Change all credentials

**Short-term Actions (1-24 hours):**
- [ ] Analyze attack vector
- [ ] Patch vulnerability
- [ ] Scan for backdoors
- [ ] Review recent access logs
- [ ] Notify affected users

**Long-term Actions (24+ hours):**
- [ ] Conduct security audit
- [ ] Update security policies
- [ ] Implement additional monitoring
- [ ] Document lessons learned
- [ ] Train team on prevention

---

## Security Best Practices Summary

| Practice | Implementation | Priority |
|----------|----------------|----------|
| API Authentication | Implement JWT or API keys | High |
| Rate Limiting | express-rate-limit | High |
| Input Validation | Zod schemas | High |
| Database SSL | Enable SSL in pool config | High |
| CORS Restrictions | Configure allowed origins | Medium |
| Security Headers | Helmet middleware | Medium |
| Audit Logging | Track all operations | High |
| Row-Level Security | PostgreSQL RLS policies | Medium |
| Secret Management | AWS Secrets Manager / Vault | High |
| Regular Security Scans | npm audit, docker scan | Medium |

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [Node.js Security](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Last Updated:** 2026-02-17
**Version:** 2.0.0
