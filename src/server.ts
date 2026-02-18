import express from "express";
import { Pool, PoolConfig } from "pg";
import dotenv from "dotenv";
import { createAPIRoutes } from "./api/api-routes.js";
import { createTestHarnessRoutes } from "./api/test-harness-routes.js";
import { createKnowledgeRoutes } from "./api/knowledge-routes.js";
import { createSessionStartupRoutes } from "./api/session-startup.js";
import { createHandoffRoutes } from "./api/handoff.js";
import { createAdaptiveChatRoutes } from "./api/handoff-adaptive.js";
import { createConsolidationRoutes } from "./api/consolidation.js";
import { createMetricsRoutes } from "./api/metrics.js";
import { createExportRoutes } from "./api/export.js";
import { createOrchestrationRoutes } from "./api/orchestration.js";
import { createStratifiedMemoryRoutes } from "./api/stratified-memory.js";
import { createChatDemoRoutes } from "./api/chat-demo.js";
import { startMCPServer } from "./mcp/server.js";
import { applyMcpEnvDefaults } from "./utils/mcp-env.js";
import { promises as fs } from "fs";
import path from "path";
import cors from "cors";
import {
  createTransparencyMiddleware,
} from "./middleware/transparency-middleware.js";
import { createContextInjector } from "./core/context-injector.js";
import { createApiKeyAuthMiddleware } from "./middleware/apiKeyAuth.js";
import { createTenantIsolationMiddleware } from "./middleware/tenantIsolation.js";
import { createConsolidationScheduler } from "./services/consolidation/scheduler.js";

// Apply MCP_ENV defaults before loading .env
applyMcpEnvDefaults();

// Load environment variables
dotenv.config();

const app: express.Express = express();
const PORT = process.env.PORT || 3456;
const HOST = process.env.HOST || '0.0.0.0';

// CORS configuration for development
const corsOptions = {
  origin: process.env.NODE_ENV === 'development'
    ? [
        'http://localhost:5173',
        'http://localhost:3456',
        'http://localhost:5174',
        // Allow local network access (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
        /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
        /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+(:\d+)?$/
      ]
    : [],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Apply CORS middleware
app.use(cors(corsOptions));

// ============================================================================
// DATABASE POOL INITIALIZATION
// ============================================================================
// Pool must be created BEFORE middleware that uses it

// Create PostgreSQL connection pool with optimized settings
const poolConfig: PoolConfig = {
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "agent_memory",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
  max: Number(process.env.PGPOOL_MAX) || 20,
  min: Number(process.env.PGPOOL_MIN) || 2,
  idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: Number(process.env.PGCONNECTION_TIMEOUT) || 2000,
  // Performance optimizations
  statement_timeout: Number(process.env.PGSTATEMENT_TIMEOUT) || 30000,
  query_timeout: Number(process.env.PGQUERY_TIMEOUT) || 30000,
};

const pool = new Pool(poolConfig);

// ============================================================================
// API KEY AUTHENTICATION MIDDLEWARE
// ============================================================================
// Authentication middleware for securing API endpoints
// NOTE: Auth is disabled by default. Set API_AUTH_ENABLED=true to enable.

const authEnabled = process.env.API_AUTH_ENABLED === 'true';
const apiKeyAuth = authEnabled
  ? createApiKeyAuthMiddleware(pool, { required: false, permission: 'read' })
  : (_req: any, _res: any, next: any) => next(); // No-op when disabled

console.log(
  `[API Authentication] ${authEnabled ? 'ENABLED' : 'DISABLED'} - Set API_AUTH_ENABLED=true to enable`
);

// ============================================================================
// TENANT ISOLATION MIDDLEWARE
// ============================================================================
// Prevents horizontal privilege escalation (Tenant A accessing Tenant B data)
// This middleware runs AFTER authentication to verify tenant_id matches

const tenantIsolation = authEnabled
  ? createTenantIsolationMiddleware({ allowOverride: false, requireTenantId: true })
  : (_req: any, _res: any, next: any) => next(); // No-op when disabled

console.log(
  `[Tenant Isolation] ${authEnabled ? 'ENABLED' : 'DISABLED'} - Prevents cross-tenant data access`
);

// ============================================================================
// TRANSPARENT MEMORY LAYER
// ============================================================================
// These middlewares automatically capture all agent activity to memory capsules
// and inject Active Context Bundles (ACB) when needed.
// Agent modules DON'T call memory APIs directly - true transparency!

const transparencyConfig = {
  enabled: process.env.TRANSPARENT_MEMORY !== "false", // Default enabled
  captureMessages: true,
  captureDecisions: true,
  captureToolCalls: true,
  captureArtifacts: true,
  captureTaskUpdates: true,
};

const contextInjectorConfig = {
  enabled: process.env.CONTEXT_INJECTION !== "false", // Default enabled
  defaultMaxTokens: 65000,
  injectOnPaths: ["/api/v1/chat", "/api/v1/message", "/api/v1/agent"],
  requireIntent: false, // Auto-detect intent from request
};

// Apply transparent middleware BEFORE other middleware
app.use(createTransparencyMiddleware(pool, transparencyConfig));
app.use(createContextInjector(pool, contextInjectorConfig));

console.log(
  `[Transparent Memory] Enabled: ${transparencyConfig.enabled}, Context Injection: ${contextInjectorConfig.enabled}`
);

// ============================================================================
// STANDARD MIDDLEWARE
// ============================================================================

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path} from ${req.ip}`);
  next();
});

// Initialize database tables
async function initializeDatabase() {
  // Skip migrations when running tests (tests handle their own migrations)
  if (process.env.NODE_ENV === "test") {
    console.log("Skipping database migrations in test mode");
    return;
  }

  // Run base schema first (creates events, chunks, decisions, tasks tables)
  const schemaPath = path.join(__dirname, "db", "schema.sql");
  const schemaSQL = await fs.readFile(schemaPath, "utf-8");
  await pool.query(schemaSQL);
  console.log("✓ Base schema applied");

  // Run migrations in numeric order
  const migrationsDir = path.join(__dirname, "db", "migrations");
  const migrationFiles = await fs.readdir(migrationsDir);
  const sqlFiles = migrationFiles
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !f.startsWith("010_")) // Skip rollback migration
    .sort((a, b) => {
      // Extract numeric prefix for sorting
      const aNum = parseInt(a.split("_")[0].replace(/[^0-9]/g, ""), 10);
      const bNum = parseInt(b.split("_")[0].replace(/[^0-9]/g, ""), 10);
      return aNum - bNum;
    });

  console.log(`Running ${sqlFiles.length} database migrations...`);

  const client = await pool.connect();
  try {
    // Run each migration in its own transaction to handle failures independently
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      const migrationSQL = await fs.readFile(filePath, "utf-8");

      // Start a transaction for this migration
      await client.query('BEGIN');

      try {
        await client.query(migrationSQL);
        await client.query('COMMIT');
        console.log(`✓ Migration applied: ${file}`);

        // Verify memory_edits table after migration 008
        if (file === "008_memory_edits.sql") {
          const checkResult = await client.query(
            "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'memory_edits' AND schemaname = 'public')"
          );
          if (checkResult.rows[0].exists === false) {
            throw new Error("memory_edits table was not created!");
          }
          console.log("  ✓ Verified: memory_edits table exists");
        }
      } catch (migrationError: any) {
        // Rollback this migration's transaction
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // Ignore rollback errors if transaction is already aborted
        }

        // Check if this is an "already exists" error that we can ignore
        const isDuplicateError =
          migrationError.message.includes("already exists") ||
          migrationError.code === "42P07" || // duplicate_table
          migrationError.code === "42P06";   // duplicate_schema

        if (isDuplicateError) {
          console.log(`  ⊘ Migration skipped (already applied): ${file}`);
        } else {
          console.error(`✗ Migration failed: ${file}`, migrationError.message);
          throw migrationError;
        }
      }
    }

    console.log("✓ All migrations completed successfully");
    console.log("Database tables initialized");
  } catch (initError: any) {
    console.error("Database initialization error:", initError);
    throw initError;
  } finally {
    client.release();
  }
}

// Connection pool event handlers
pool.on("connect", () => {
  console.log("New PostgreSQL client connected");
});

pool.on("error", (err) => {
  console.error("PostgreSQL client error:", err);
});

pool.on("remove", () => {
  console.log("PostgreSQL client removed");
});

// Attach pool to request for use in routes
app.use((req, _res, next) => {
  (req as any).db = pool;
  next();
});

// Initialize services

// API routes
const apiRoutes = createAPIRoutes(pool);
const testHarnessRoutes = createTestHarnessRoutes(pool);
const knowledgeRoutes = createKnowledgeRoutes(pool);
const sessionStartupRoutes = createSessionStartupRoutes(pool);
const handoffRoutes = createHandoffRoutes(pool);
const adaptiveChatRoutes = createAdaptiveChatRoutes(pool);
const consolidationRoutes = createConsolidationRoutes(pool);
const exportRoutes = createExportRoutes(pool);
const orchestrationRoutes = createOrchestrationRoutes(pool);
const stratifiedMemoryRoutes = createStratifiedMemoryRoutes(pool);
const chatDemoRoutes = createChatDemoRoutes(pool);

// Apply API key authentication + tenant isolation to all /api/v1/* routes
// Note: /metrics and /health remain public for monitoring
// Note: /api/demo routes remain open for demo purposes
app.use("/api/v1", apiKeyAuth, tenantIsolation, apiRoutes);
app.use("/api/v1/test-harness", apiKeyAuth, tenantIsolation, testHarnessRoutes);
app.use("/api/v1/knowledge", apiKeyAuth, tenantIsolation, knowledgeRoutes);
app.use("/api/v1", apiKeyAuth, tenantIsolation, sessionStartupRoutes); // Session startup under /api/v1
app.use("/api/v1", apiKeyAuth, tenantIsolation, handoffRoutes); // Handoff routes under /api/v1
app.use("/api/v1", apiKeyAuth, tenantIsolation, adaptiveChatRoutes); // Adaptive chat routes under /api/v1
app.use("/api/v1", apiKeyAuth, tenantIsolation, consolidationRoutes); // Consolidation routes under /api/v1
app.use("/api/v1", apiKeyAuth, tenantIsolation, orchestrationRoutes); // Orchestration routes under /api/v1
app.use("/api/v1", apiKeyAuth, tenantIsolation, exportRoutes); // Export routes under /api/v1
app.use("/api/memory", apiKeyAuth, tenantIsolation, stratifiedMemoryRoutes); // Stratified memory under /api/memory
app.use("/api/demo", chatDemoRoutes); // Chat demo under /api/demo (no auth for demo)

// Metrics and health monitoring (serves both humans and agents)
const metricsRoutes = createMetricsRoutes(pool);
app.use("/metrics", metricsRoutes);
app.use("/health", metricsRoutes); // Also register at /health for convenience

// Static file serving for frontend test harness
const frontendDistPath = path.join(__dirname, '..', 'web-ui', 'dist');

// Serve static files from /test-harness route
app.use('/test-harness', express.static(frontendDistPath, {
  index: 'index.html',
  maxAge: '1h'
}));

// Serve static files from /demo route
const demoPath = path.join(__dirname, '..', 'demo');
app.use('/demo', express.static(demoPath, {
  index: 'index.html',
  maxAge: '1h'
}));

// Serve static files from /thread-demo route (separate repo)
const threadDemoPath = path.join(__dirname, '..', '..', 'thread_demo');
app.use('/thread-demo', express.static(threadDemoPath, {
  index: 'index.html',
  maxAge: '1h'
}));

// SPA fallback - return index.html for non-matching routes under /test-harness
app.get('/test-harness/*', (_req, res) => {
  const indexPath = path.join(frontendDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({
        error: 'Frontend not built',
        message: 'Please run "npm run frontend:build" to build the frontend'
      });
    }
  });
});

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    name: "Agent Memory System v2.0",
    version: "2.0.0",
    status: "running",
    features: {
      performance: true,
      metrics: true,
      security: true,
      mcp: true,
    },
    endpoints: {
      health: "GET /health",
      metrics: "GET /metrics",
      metricsJson: "GET /metrics/json",
      recordEvent: "POST /api/v1/events",
      getEvent: "GET /api/v1/events/:event_id",
      buildACB: "POST /api/v1/acb/build",
      getChunk: "GET /api/v1/chunks/:chunk_id",
      getArtifact: "GET /api/v1/artifacts/:artifact_id",
      createDecision: "POST /api/v1/decisions",
      getDecisions: "GET /api/v1/decisions",
    },
  });
});

// Error handling middleware
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === "development";

    res.status(err.status || 500).json({
      error: isDevelopment ? err.message : "Internal server error",
      ...(isDevelopment && { stack: err.stack }),
    });
  },
);

// Graceful shutdown
let consolidationScheduler: any = null;

const shutdown = async () => {
  console.log("Shutting down gracefully...");

  try {
    // Stop consolidation scheduler
    if (consolidationScheduler) {
      console.log("Stopping consolidation scheduler...");
      consolidationScheduler.stop();
      console.log("✓ Consolidation scheduler stopped");
    }

    await pool.end();
    console.log("PostgreSQL pool closed");
  } catch (err) {
    console.error("Error closing pool:", err);
  }

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start HTTP server (unless running in MCP mode)
if (process.argv.includes("--mcp")) {
  // Run as MCP server using stdio
  console.error("Starting MCP server...");
  initializeDatabase().then(async () => {
    // Start consolidation scheduler
    const schedulerEnabled = process.env.CONSOLIDATION_SCHEDULER_ENABLED !== 'false';
    if (schedulerEnabled) {
      try {
        consolidationScheduler = await createConsolidationScheduler(pool, { enabled: true });
        console.error('[Consolidation] Scheduler started');
      } catch (error) {
        console.error('[Consolidation] Failed to start scheduler:', error);
      }
    }

    startMCPServer(pool).catch((err) => {
      console.error("MCP server error:", err);
      process.exit(1);
    });
  });
} else {
  // Run as HTTP server
  const server = app.listen(Number(PORT), HOST as string, async () => {
    await initializeDatabase();

    // Start consolidation scheduler
    const schedulerEnabled = process.env.CONSOLIDATION_SCHEDULER_ENABLED !== 'false';
    if (schedulerEnabled) {
      try {
        consolidationScheduler = await createConsolidationScheduler(pool, { enabled: true });
        const status = consolidationScheduler.getStatus();
        console.log('[Consolidation] Scheduler started');
        console.log(`[Consolidation] Scheduled jobs: ${status.jobs.join(', ')}`);
      } catch (error) {
        console.error('[Consolidation] Failed to start scheduler:', error);
      }
    }

    console.log(`Agent Memory System v2.0 running on port ${PORT}`);
    console.log(
      `Database: ${process.env.PGDATABASE || "agent_memory"}@${process.env.PGHOST || "localhost"}`,
    );
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`\nEndpoints:`);
    console.log(`  Health:   http://localhost:${PORT}/health`);
    console.log(`  Metrics:  http://localhost:${PORT}/metrics`);
    console.log(`  API:      http://localhost:${PORT}/api/v1/`);
    console.log(`\nLocal Network Access:`);

    // Get local network IP addresses
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(networkInterfaces)) {
      for (const iface of networkInterfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }

    if (ips.length > 0) {
      console.log(`  Access from other devices using:`);
      ips.forEach(ip => {
        console.log(`    http://${ip}:${PORT}`);
      });
    }
    console.log(`\nTo run as MCP server:`);
    console.log(`  npm start -- --mcp`);
  });

  // Handle server errors
  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use`);
    } else {
      console.error("Server error:", err);
    }
    process.exit(1);
  });
}

export { app, pool };
