/**
 * Database Configuration Module
 *
 * Provides PostgreSQL connection pool configuration for Admin Server.
 * Uses environment variables for flexible deployment across environments.
 */

import { Pool, PoolConfig } from 'pg';

/**
 * Creates and configures PostgreSQL connection pool
 * based on environment variables.
 *
 * @returns Configured PostgreSQL pool instance
 */
export function createDatabasePool(): Pool {
  const poolConfig: PoolConfig = {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'agent_memory',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    max: Number(process.env.PGPOOL_MAX) || 20,
    min: Number(process.env.PGPOOL_MIN) || 2,
    idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: Number(process.env.PGCONNECTION_TIMEOUT) || 2000,
    // Performance optimizations
    statement_timeout: Number(process.env.PGSTATEMENT_TIMEOUT) || 30000,
    query_timeout: Number(process.env.PGQUERY_TIMEOUT) || 30000,
  };

  const pool = new Pool(poolConfig);

  // Connection pool event handlers
  pool.on('connect', () => {
    console.log('Admin Server: New PostgreSQL client connected');
  });

  pool.on('error', (err) => {
    console.error('Admin Server: PostgreSQL client error:', err);
  });

  pool.on('remove', () => {
    console.log('Admin Server: PostgreSQL client removed');
  });

  return pool;
}

/**
 * Creates a PoolConfig object for testing purposes
 *
 * @param overrides - Optional configuration overrides
 * @returns Pool configuration object
 */
export function createTestPoolConfig(overrides?: Partial<PoolConfig>): PoolConfig {
  const defaultConfig: PoolConfig = {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'agent_memory_test',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    max: 5,
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  return { ...defaultConfig, ...overrides };
}
