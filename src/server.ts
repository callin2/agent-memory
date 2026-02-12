import express from "express";
import { Pool, PoolConfig } from "pg";
import dotenv from "dotenv";
import { createAPIRoutes } from "./api/api-routes.js";
import { ensureUsersTable, createAuthRoutes } from "./api/auth-routes.js";
import { createRefreshRoutes } from "./api/refresh-routes.js";
import { createSessionRoutes } from "./api/session-routes.js";
import { createOAuthRoutes } from "./api/oauth-routes.js";
import { startMCPServer } from "./mcp/server.js";
import { TokenService } from "./services/token-service.js";
import { SessionService } from "./services/session-service.js";
import { AuditService } from "./services/audit-service.js";
import { applyMcpEnvDefaults } from "./utils/mcp-env.js";
import { promises as fs } from "fs";
import path from "path";

// Apply MCP_ENV defaults before loading .env
applyMcpEnvDefaults();

// Load environment variables
dotenv.config();

const app: express.Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path} from ${req.ip}`);
  next();
});

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

// Initialize database tables
async function initializeDatabase() {
  // Skip migrations when running tests (tests handle their own migrations)
  if (process.env.NODE_ENV === "test") {
    console.log("Skipping database migrations in test mode");
    await ensureUsersTable(pool);
    return;
  }

  // Run base schema first (creates events, chunks, decisions, tasks tables)
  const schemaPath = path.join(__dirname, "db", "schema.sql");
  const schemaSQL = await fs.readFile(schemaPath, "utf-8");
  await pool.query(schemaSQL);
  console.log("✓ Base schema applied");

  // Ensure users table exists (auth-specific, not in schema.sql)
  await ensureUsersTable(pool);

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
const tokenService = new TokenService(pool);
// const apiKeyService = new APIKeyService(pool); // Will be used in future phases
const sessionService = new SessionService(pool);
const auditService = new AuditService(pool);

// API routes with authentication
const apiRoutes = createAPIRoutes(pool);
const authRoutes = createAuthRoutes(
  pool,
  tokenService,
  sessionService,
  auditService,
);
const refreshRoutes = createRefreshRoutes(tokenService, auditService);
const sessionRoutes = createSessionRoutes(sessionService, auditService);
const oauthRoutes = createOAuthRoutes(pool, auditService);

app.use("/api/v1", apiRoutes);
app.use("/auth", authRoutes);
app.use("/auth", refreshRoutes);
app.use("/auth", sessionRoutes);
app.use("/auth/oauth", oauthRoutes);

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
const shutdown = async () => {
  console.log("Shutting down gracefully...");

  try {
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
  initializeDatabase().then(() => {
    startMCPServer(pool).catch((err) => {
      console.error("MCP server error:", err);
      process.exit(1);
    });
  });
} else {
  // Run as HTTP server
  const server = app.listen(PORT, async () => {
    await initializeDatabase();
    console.log(`Agent Memory System v2.0 running on port ${PORT}`);
    console.log(
      `Database: ${process.env.PGDATABASE || "agent_memory"}@${process.env.PGHOST || "localhost"}`,
    );
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`\nEndpoints:`);
    console.log(`  Health:   http://localhost:${PORT}/health`);
    console.log(`  Metrics:  http://localhost:${PORT}/metrics`);
    console.log(`  API:      http://localhost:${PORT}/api/v1/`);
    console.log(`  Auth:     http://localhost:${PORT}/auth/login`);
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
