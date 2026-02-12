/**
 * Unit Tests: SQL Functions for Memory Surgery & Capsule Transfer
 *
 * Tests for PostgreSQL functions:
 * - search_chunks() with FTS + edit awareness
 * - get_timeline() with time-bounded query
 * - get_active_decisions() with precedence ordering
 * - get_available_capsules() with audience filtering
 * - effective_chunks view with edit application
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { generateId } from "../../../src/utils/id-generator.js";

describe("SQL Functions - Memory Surgery & Capsule Transfer", () => {
  let pool: Pool;
  const tenantId = "test-tenant-sql-funcs";
  const sessionId = "test-session-sql-funcs";
  const agentAlice = "agent-alice-sql";
  const agentBob = "agent-bob-sql";
  const userId = "user-jack-sql";
  const projectId = "project-alpha-sql";

  async function insertEventAndChunk(input: {
    chunkId: string;
    text: string;
    importance: number;
    channel: "private" | "public" | "team" | "agent";
    scope: "session" | "user" | "project" | "policy" | "global";
    subjectType: string;
    subjectId: string;
    projectId?: string | null;
    ts?: Date;
    kind?: string;
  }): Promise<string> {
    const eventId = generateId("evt");
    const ts = input.ts || new Date();
    const kind = input.kind || "message";

    await pool.query(
      `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, content, ts, scope, subject_type, subject_id, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        eventId,
        tenantId,
        sessionId,
        input.channel,
        "agent",
        agentAlice,
        kind,
        JSON.stringify({ text: input.text }),
        ts,
        input.scope,
        input.subjectType,
        input.subjectId,
        input.projectId || null,
      ],
    );

    await pool.query(
      `INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, kind, channel, token_est, importance, text, scope, subject_type, subject_id, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        input.chunkId,
        tenantId,
        eventId,
        ts,
        kind,
        input.channel,
        16,
        input.importance,
        input.text,
        input.scope,
        input.subjectType,
        input.subjectId,
        input.projectId || null,
      ],
    );

    return eventId;
  }

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || "agent_memory_dev",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "",
    });

    // Create test users (no tenants table - tenant_id is just a column)
    await pool.query(
      "INSERT INTO users (user_id, tenant_id, username, password_hash, roles) VALUES ($1, $2, $3, $4, $5)",
      [agentAlice, tenantId, "agent-alice", "hash", ["agent"]],
    );

    await pool.query(
      "INSERT INTO users (user_id, tenant_id, username, password_hash, roles) VALUES ($1, $2, $3, $4, $5)",
      [agentBob, tenantId, "agent-bob", "hash", ["agent"]],
    );
  });

  afterAll(async () => {
    // Cleanup
    await pool.query("DELETE FROM memory_edits WHERE tenant_id = $1", [
      tenantId,
    ]);
    await pool.query("DELETE FROM capsules WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM chunks WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM events WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM decisions WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    await pool.end();
  });

  beforeEach(async () => {
    // Clean test data before each test
    await pool.query("DELETE FROM memory_edits WHERE tenant_id = $1", [
      tenantId,
    ]);
    await pool.query("DELETE FROM capsules WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM chunks WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM events WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM decisions WHERE tenant_id = $1", [tenantId]);
  });

  describe("effective_chunks view", () => {
    it("should return chunks with amended text applied", async () => {
      const chunkId = generateId("chk");
      const editId = generateId("edt");

      // Create chunk
      await insertEventAndChunk({
        chunkId,
        text: "Original text",
        importance: 0.5,
        channel: "private",
        scope: "user",
        subjectType: "user",
        subjectId: userId,
      });

      // Create amend edit
      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          editId,
          tenantId,
          "chunk",
          chunkId,
          "amend",
          "Test correction",
          "agent",
          "approved",
          JSON.stringify({ text: "Amended text", importance: 0.8 }),
        ],
      );

      // Query effective_chunks view
      const result = await pool.query(
        "SELECT * FROM effective_chunks WHERE chunk_id = $1",
        [chunkId],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].text).toBe("Amended text");
      expect(result.rows[0].importance).toBe(0.8);
      expect(result.rows[0].edits_applied_count).toBe(1);
    });

    it("should exclude retracted chunks", async () => {
      const chunkId = generateId("chk");
      const editId = generateId("edt");

      // Create chunk
      await insertEventAndChunk({
        chunkId,
        text: "To be retracted",
        importance: 0.5,
        channel: "private",
        scope: "user",
        subjectType: "user",
        subjectId: userId,
      });

      // Create retract edit
      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          editId,
          tenantId,
          "chunk",
          chunkId,
          "retract",
          "Test retract",
          "agent",
          "approved",
          "{}",
        ],
      );

      // Query effective_chunks view
      const result = await pool.query(
        "SELECT * FROM effective_chunks WHERE chunk_id = $1",
        [chunkId],
      );

      expect(result.rows.length).toBe(0);
    });

    it("should apply attenuate importance edits", async () => {
      const chunkId = generateId("chk");
      const editId = generateId("edt");

      // Create chunk with importance 0.9
      await insertEventAndChunk({
        chunkId,
        text: "Important text",
        importance: 0.9,
        channel: "private",
        scope: "user",
        subjectType: "user",
        subjectId: userId,
      });

      // Create attenuate edit with delta
      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          editId,
          tenantId,
          "chunk",
          chunkId,
          "attenuate",
          "Lower priority",
          "agent",
          "approved",
          JSON.stringify({ importance_delta: -0.5 }),
        ],
      );

      // Query effective_chunks view
      const result = await pool.query(
        "SELECT * FROM effective_chunks WHERE chunk_id = $1",
        [chunkId],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].importance).toBeCloseTo(0.4);
    });

    it("should flag quarantined chunks", async () => {
      const chunkId = generateId("chk");
      const editId = generateId("edt");

      // Create chunk
      await insertEventAndChunk({
        chunkId,
        text: "Unverified info",
        importance: 0.5,
        channel: "private",
        scope: "user",
        subjectType: "user",
        subjectId: userId,
      });

      // Create quarantine edit
      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          editId,
          tenantId,
          "chunk",
          chunkId,
          "quarantine",
          "Unverified",
          "agent",
          "approved",
          "{}",
        ],
      );

      // Query effective_chunks view
      const result = await pool.query(
        "SELECT * FROM effective_chunks WHERE chunk_id = $1",
        [chunkId],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].is_quarantined).toBe(true);
    });

    it("should track blocked channels", async () => {
      const chunkId = generateId("chk");
      const editId = generateId("edt");

      // Create chunk
      await insertEventAndChunk({
        chunkId,
        text: "Internal discussion",
        importance: 0.5,
        channel: "team",
        scope: "user",
        subjectType: "user",
        subjectId: userId,
      });

      // Create block edit for public channel
      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          editId,
          tenantId,
          "chunk",
          chunkId,
          "block",
          "Internal only",
          "agent",
          "approved",
          JSON.stringify({ channel: "public" }),
        ],
      );

      // Query effective_chunks view
      const result = await pool.query(
        "SELECT * FROM effective_chunks WHERE chunk_id = $1",
        [chunkId],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].blocked_channels).toContain("public");
    });
  });

  describe("search_chunks() function", () => {
    beforeEach(async () => {
      // Create test chunks with FTS
      const chunks = [
        {
          id: generateId("chk"),
          text: "Jack Doe called about billing issue",
          scope: "user",
          subjectId: userId,
        },
        {
          id: generateId("chk"),
          text: "Jane Smith called about support",
          scope: "user",
          subjectId: "user-jane-sql",
        },
        {
          id: generateId("chk"),
          text: "Billing information for project alpha",
          scope: "project",
          subjectId: projectId,
        },
        {
          id: generateId("chk"),
          text: "Quarantined information about billing",
          scope: "user",
          subjectId: userId,
        },
      ];

      for (const chunk of chunks) {
        const scope = chunk.scope as
          | "session"
          | "user"
          | "project"
          | "policy"
          | "global";

        await insertEventAndChunk({
          chunkId: chunk.id,
          text: chunk.text,
          importance: 0.5,
          channel: "private",
          scope,
          subjectType: scope === "project" ? "project" : "user",
          subjectId: chunk.subjectId,
          projectId: scope === "project" ? projectId : null,
        });
      }

      // Quarantine one chunk
      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunks[3].id,
          "quarantine",
          "Test",
          "agent",
          "approved",
          "{}",
        ],
      );
    });

    it("should perform full-text search", async () => {
      const result = await pool.query("SELECT * FROM search_chunks($1, $2)", [
        tenantId,
        "billing",
      ]);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.some((r) => r.text.includes("billing"))).toBe(true);
    });

    it("should filter by subject", async () => {
      const result = await pool.query(
        "SELECT * FROM search_chunks($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [tenantId, "billing", null, "user", userId, null, false, null, 50],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].text).toContain("Jack Doe");
    });

    it("should filter by scope", async () => {
      const result = await pool.query(
        "SELECT * FROM search_chunks($1, $2, $3)",
        [tenantId, "billing", "project"],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].text).toContain("project alpha");
    });

    it("should exclude quarantined chunks by default", async () => {
      const result = await pool.query("SELECT * FROM search_chunks($1, $2)", [
        tenantId,
        "billing",
      ]);

      expect(result.rows.every((r) => r.is_quarantined === false)).toBe(true);
    });

    it("should include quarantined chunks when requested", async () => {
      const result = await pool.query(
        "SELECT * FROM search_chunks($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [
          tenantId,
          "billing",
          null, // p_scope
          null, // p_subject_type
          null, // p_subject_id
          null, // p_project_id
          true, // include_quarantined
          null, // p_channel
          50, // p_limit
        ],
      );

      expect(result.rows.some((r) => r.is_quarantined === true)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const result = await pool.query(
        "SELECT * FROM search_chunks($1, $2, $3, $4, $5, $6, $7, $8)",
        [tenantId, "billing", null, null, null, false, null, 2],
      );

      expect(result.rows.length).toBeLessThanOrEqual(2);
    });
  });

  describe("get_timeline() function", () => {
    let centerChunkId: string;
    const centerTime = new Date("2025-02-10T12:00:00Z");

    beforeEach(async () => {
      centerChunkId = generateId("chk");

      // Create center chunk
      await insertEventAndChunk({
        chunkId: centerChunkId,
        text: "Center event",
        importance: 0.5,
        channel: "private",
        scope: "session",
        subjectType: "session",
        subjectId: sessionId,
        ts: centerTime,
      });

      // Create chunks before and after
      for (let i = 1; i <= 3; i++) {
        const beforeTime = new Date(centerTime.getTime() - i * 30 * 60 * 1000); // 30, 60, 90 min before
        const afterTime = new Date(centerTime.getTime() + i * 30 * 60 * 1000); // 30, 60, 90 min after

        await insertEventAndChunk({
          chunkId: generateId("chk"),
          text: `Event before ${i}`,
          importance: 0.5,
          channel: "private",
          scope: "session",
          subjectType: "session",
          subjectId: sessionId,
          ts: beforeTime,
        });

        await insertEventAndChunk({
          chunkId: generateId("chk"),
          text: `Event after ${i}`,
          importance: 0.5,
          channel: "private",
          scope: "session",
          subjectType: "session",
          subjectId: sessionId,
          ts: afterTime,
        });
      }
    });

    it("should return chunks around center chunk", async () => {
      const result = await pool.query(
        "SELECT * FROM get_timeline($1, $2, $3)",
        [tenantId, centerChunkId, 3600],
      );

      expect(result.rows.length).toBe(5); // 2 before + 1 center + 2 after (90min events excluded)
    });

    it("should calculate distance from center correctly", async () => {
      const result = await pool.query(
        "SELECT * FROM get_timeline($1, $2, $3) ORDER BY distance_seconds",
        [tenantId, centerChunkId, 3600],
      );

      // Center chunk should have distance 0
      const center = result.rows.find((r) => r.chunk_id === centerChunkId);
      expect(center?.distance_seconds).toBe(0);
    });

    it("should respect window size", async () => {
      const result = await pool.query(
        "SELECT * FROM get_timeline($1, $2, $3)",
        [tenantId, centerChunkId, 1800],
      );

      expect(result.rows.length).toBe(3); // 1 before + 1 center + 1 after (30 min window)
    });

    it("should apply edits to chunks in timeline", async () => {
      const editId = generateId("edt");
      const chunkId = generateId("chk");
      const chunkTime = new Date(centerTime.getTime() - 30 * 60 * 1000);

      await insertEventAndChunk({
        chunkId,
        text: "Before event",
        importance: 0.5,
        channel: "private",
        scope: "session",
        subjectType: "session",
        subjectId: sessionId,
        ts: chunkTime,
      });

      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          editId,
          tenantId,
          "chunk",
          chunkId,
          "amend",
          "Test",
          "agent",
          "approved",
          JSON.stringify({ text: "Corrected event" }),
        ],
      );

      const result = await pool.query(
        "SELECT * FROM get_timeline($1, $2, $3)",
        [tenantId, centerChunkId, 3600],
      );

      const amended = result.rows.find((r) => r.chunk_id === chunkId);
      expect(amended?.text).toBe("Corrected event");
      expect(amended?.edits_applied).toBe(1);
    });
  });

  describe("get_active_decisions() function", () => {
    beforeEach(async () => {
      // Create decisions with different scopes
      await pool.query(
        `INSERT INTO decisions (decision_id, tenant_id, decision, scope, subject_type, subject_id, project_id, status, rationale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          generateId("dec"),
          tenantId,
          "Policy decision",
          "policy",
          "policy",
          "policy-1",
          null,
          "active",
          ["R1"],
        ],
      );

      await pool.query(
        `INSERT INTO decisions (decision_id, tenant_id, decision, scope, subject_type, subject_id, project_id, status, rationale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          generateId("dec"),
          tenantId,
          "Project decision",
          "project",
          "project",
          projectId,
          projectId,
          "active",
          ["R1"],
        ],
      );

      await pool.query(
        `INSERT INTO decisions (decision_id, tenant_id, decision, scope, subject_type, subject_id, project_id, status, rationale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          generateId("dec"),
          tenantId,
          "User decision",
          "user",
          "user",
          userId,
          null,
          "active",
          ["R1"],
        ],
      );

      await pool.query(
        `INSERT INTO decisions (decision_id, tenant_id, decision, scope, subject_type, subject_id, project_id, status, rationale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          generateId("dec"),
          tenantId,
          "Session decision",
          "session",
          "session",
          sessionId,
          null,
          "active",
          ["R1"],
        ],
      );
    });

    it("should return decisions ordered by precedence", async () => {
      const result = await pool.query(
        "SELECT * FROM get_active_decisions($1)",
        [tenantId],
      );

      expect(result.rows.length).toBe(4);
      expect(result.rows[0].precedence).toBe(4); // policy
      expect(result.rows[1].precedence).toBe(3); // project
      expect(result.rows[2].precedence).toBe(2); // user
      expect(result.rows[3].precedence).toBe(1); // session
    });

    it("should filter by scope", async () => {
      const result = await pool.query(
        "SELECT * FROM get_active_decisions($1, $2)",
        [tenantId, "user"],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].scope).toBe("user");
    });

    it("should filter by project", async () => {
      const result = await pool.query(
        "SELECT * FROM get_active_decisions($1, $2, $3)",
        [tenantId, null, projectId],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].scope).toBe("project");
    });

    it("should filter by subject", async () => {
      const result = await pool.query(
        "SELECT * FROM get_active_decisions($1, $2, $3, $4)",
        [tenantId, null, null, userId],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].scope).toBe("user");
    });
  });

  describe("get_available_capsules() function", () => {
    let activeCapsuleId: string;
    let expiredCapsuleId: string;
    let revokedCapsuleId: string;

    beforeEach(async () => {
      activeCapsuleId = generateId("cap");
      expiredCapsuleId = generateId("cap");
      revokedCapsuleId = generateId("cap");

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Create test chunks for capsules
      const chunk1 = generateId("chk");
      const chunk2 = generateId("chk");
      await insertEventAndChunk({
        chunkId: chunk1,
        text: "Chunk 1",
        importance: 0.5,
        channel: "private",
        scope: "user",
        subjectType: "user",
        subjectId: userId,
      });

      await insertEventAndChunk({
        chunkId: chunk2,
        text: "Chunk 2",
        importance: 0.5,
        channel: "private",
        scope: "user",
        subjectType: "user",
        subjectId: userId,
      });

      // Active capsule
      await pool.query(
        `INSERT INTO capsules (capsule_id, tenant_id, scope, subject_type, subject_id, author_agent_id, ttl_days, status, audience_agent_ids, items, risks, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)`,
        [
          activeCapsuleId,
          tenantId,
          "user",
          "user",
          userId,
          agentAlice,
          7,
          "active",
          [agentBob],
          JSON.stringify({ chunks: [chunk1], decisions: [], artifacts: [] }),
          [],
          tomorrow,
        ],
      );

      // Expired capsule
      await pool.query(
        `INSERT INTO capsules (capsule_id, tenant_id, scope, subject_type, subject_id, author_agent_id, ttl_days, status, audience_agent_ids, items, risks, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)`,
        [
          expiredCapsuleId,
          tenantId,
          "user",
          "user",
          userId,
          agentAlice,
          7,
          "active",
          [agentBob],
          JSON.stringify({ chunks: [chunk2], decisions: [], artifacts: [] }),
          [],
          yesterday,
        ],
      );

      // Revoked capsule
      await pool.query(
        `INSERT INTO capsules (capsule_id, tenant_id, scope, subject_type, subject_id, author_agent_id, ttl_days, status, audience_agent_ids, items, risks, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)`,
        [
          revokedCapsuleId,
          tenantId,
          "user",
          "user",
          userId,
          agentAlice,
          7,
          "revoked",
          [agentBob],
          JSON.stringify({ chunks: [], decisions: [], artifacts: [] }),
          [],
          tomorrow,
        ],
      );
    });

    it("should return active capsules for agent", async () => {
      const result = await pool.query(
        "SELECT * FROM get_available_capsules($1, $2)",
        [tenantId, agentBob],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].capsule_id).toBe(activeCapsuleId);
    });

    it("should exclude expired capsules", async () => {
      const result = await pool.query(
        "SELECT * FROM get_available_capsules($1, $2)",
        [tenantId, agentBob],
      );

      expect(result.rows.every((r) => r.capsule_id !== expiredCapsuleId)).toBe(
        true,
      );
    });

    it("should exclude revoked capsules", async () => {
      const result = await pool.query(
        "SELECT * FROM get_available_capsules($1, $2)",
        [tenantId, agentBob],
      );

      expect(result.rows.every((r) => r.capsule_id !== revokedCapsuleId)).toBe(
        true,
      );
    });

    it("should filter by subject", async () => {
      const result = await pool.query(
        "SELECT * FROM get_available_capsules($1, $2, $3, $4)",
        [tenantId, agentBob, "user", userId],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].subject_id).toBe(userId);
    });

    it("should not return capsules to non-audience agents", async () => {
      const result = await pool.query(
        "SELECT * FROM get_available_capsules($1, $2)",
        [tenantId, "non-audience-agent"],
      );

      expect(result.rows.length).toBe(0);
    });
  });
});
