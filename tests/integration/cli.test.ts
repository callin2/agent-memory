/**
 * CLI Tool Integration Tests
 *
 * Tests the CLI tool commands and functionality.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { spawn } from 'child_process';
import { promisify } from 'util';

const exec = promisify(require('child_process').exec);

describe('CLI Tool', () => {
  let pool: Pool;
  const tenantId = 'test-cli-tenant';

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'agent_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
    });

    // Create test data
    await pool.query(
      `INSERT INTO session_handoffs
        (tenant_id, session_id, with_whom, experienced, noticed, learned, story, becoming, remember, significance, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        tenantId,
        'test-session-cli',
        'TestUser',
        'CLI test handoff',
        'Testing CLI commands',
        'CLI is useful for quick operations',
        'We added CLI commands for better system management',
        'An agent that values command-line tools',
        'Test CLI thoroughly',
        0.8,
        ['cli', 'test']
      ]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', [tenantId]);
    await pool.end();
  });

  describe('status command', () => {
    it('should show system status', async () => {
      const { stdout } = await exec(`npx tsx cli.ts status`, {
        env: { ...process.env, TENANT_ID: tenantId }
      });

      expect(stdout).toContain('Memory System Status');
      expect(stdout).toContain(tenantId);
    });
  });

  describe('identity command', () => {
    it('should show identity thread', async () => {
      const { stdout } = await exec(`npx tsx cli.ts identity`, {
        env: { ...process.env, TENANT_ID: tenantId }
      });

      expect(stdout).toContain('Identity Thread');
      expect(stdout).toContain('agent that values command-line tools');
    });
  });

  describe('recent command', () => {
    it('should show recent handoffs', async () => {
      const { stdout } = await exec(`npx tsx cli.ts recent 5`, {
        env: { ...process.env, TENANT_ID: tenantId }
      });

      expect(stdout).toContain('Recent Handoffs');
      expect(stdout).toContain('CLI test handoff');
    });

    it('should respect count parameter', async () => {
      const { stdout } = await exec(`npx tsx cli.ts recent 1`, {
        env: { ...process.env, TENANT_ID: tenantId }
      });

      // Should show only 1 handoff
      const matches = stdout.match(/\d+\\. \[/g);
      expect(matches?.length).toBe(1);
    });
  });

  describe('tenants command', () => {
    it('should list all tenants', async () => {
      const { stdout } = await exec(`npx tsx cli.ts tenants`);

      expect(stdout).toContain('Tenants');
    });
  });

  describe('stats command', () => {
    it('should show statistics', async () => {
      const { stdout } = await exec(`npx tsx cli.ts stats`, {
        env: { ...process.env, TENANT_ID: tenantId }
      });

      expect(stdout).toContain('Statistics');
      expect(stdout).toContain('Storage:');
    });
  });

  describe('health command', () => {
    it('should check system health', async () => {
      const { stdout } = await exec(`npx tsx cli.ts health`);

      expect(stdout).toContain('Health Check');
      expect(stdout).toContain('Database: Connected');
    });
  });

  describe('knowledge command', () => {
    it('should show knowledge notes or tip', async () => {
      const { stdout } = await exec(`npx tsx cli.ts knowledge`, {
        env: { ...process.env, TENANT_ID: tenantId }
      });

      expect(stdout).toContain('Knowledge Notes');
      // Either shows notes or tip
      expect(stdout.match(/knowledge notes|Tip:/)).toBeTruthy();
    });
  });

  describe('export command', () => {
    it('should export as JSON by default', async () => {
      const { stdout } = await exec(`npx tsx cli.ts export`, {
        env: { ...process.env, TENANT_ID: tenantId }
      });

      expect(stdout).toContain('tenant_id');
      expect(stdout).toContain(tenantId);
    });

    it('should export identity as markdown', async () => {
      const { stdout } = await exec(`npx tsx cli.ts export markdown`, {
        env: { ...process.env, TENANT_ID: tenantId }
      });

      expect(stdout).toContain('Identity Thread Export');
      expect(stdout).toContain('Who I Am Becoming');
    });
  });

  describe('error handling', () => {
    it('should show help for invalid command', async () => {
      const { stdout, stderr } = await exec(`npx tsx cli.ts invalid-command`).catch(e => e);

      const output = stdout + stderr;
      expect(output).toContain('Usage:');
    });
  });

  describe('environment variables', () => {
    it('should use TENANT_ID from environment', async () => {
      const customTenant = 'custom-tenant-test';
      const { stdout } = await exec(`npx tsx cli.ts status`, {
        env: { ...process.env, TENANT_ID: customTenant }
      });

      expect(stdout).toContain(customTenant);
    });
  });
});
