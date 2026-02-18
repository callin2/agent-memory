// Ensure chat demo tenant exists
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'agent_memory_dev',
  user: 'agent_mem_dba',
  password: 'adminqwer1234'
});

async function ensureTenant() {
  try {
    // Check if tenant exists
    const checkResult = await pool.query(
      'SELECT tenant_id FROM tenants WHERE tenant_id = $1',
      ['claude-session']
    );

    if (checkResult.rows.length === 0) {
      // Create tenant
      await pool.query(
        'INSERT INTO tenants (tenant_id, name, created_by) VALUES ($1, $2, $3)',
        ['claude-session', 'Thread Session', 'system']
      );
      console.log('✅ Created tenant: claude-session');
    } else {
      console.log('✅ Tenant exists: claude-session');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

ensureTenant();
