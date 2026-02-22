import { Pool } from "pg";

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "agent_memory",
  user: "callin",
  password: "postgres",
});

const args = {
  text: "Test Note",
  tenant_id: "test_coordination"
};

const { tenant_id = "default", text } = args;

console.log("Extracted tenant_id:", tenant_id);
console.log("Args tenant_id:", args.tenant_id);

const { randomBytes } = await import("crypto");
const noteId = `kn_${randomBytes(16).toString("hex")}`;

console.log("Inserting with tenant_id:", tenant_id);

try {
  const result = await pool.query(
    `INSERT INTO knowledge_notes (id, tenant_id, text, with_whom, tags, project_path, node_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [noteId, tenant_id, text, null, null, null, noteId]
  );
  console.log("Success! Inserted note:", result.rows[0].node_id);
} catch (err) {
  console.error("Error:", err.message);
  console.error("Detail:", err.detail);
  console.error("Constraint:", err.constraint);
}

await pool.end();
