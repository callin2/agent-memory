import { Pool } from 'pg';

export interface ScenarioStep {
  action: () => Promise<void>;
  description: string;
}

export interface Assertion {
  description: string;
  check: () => Promise<void>;
}

export interface Scenario {
  name: string;
  setup: () => Promise<void>;
  steps: ScenarioStep[];
  assertions: Assertion[];
  cleanup?: () => Promise<void>;
}

export interface ScenarioResult {
  name: string;
  passed: boolean;
  passedAssertions: number;
  totalAssertions: number;
  failedAssertions: Array<{
    description: string;
    error: string;
  }>;
  duration: number;
}

/**
 * Run a single scenario
 */
export async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  console.log(`\n========================================`);
  console.log(`Running scenario: ${scenario.name}`);
  console.log(`========================================\n`);

  const startTime = Date.now();
  const failedAssertions: Array<{ description: string; error: string }> = [];
  let passedAssertions = 0;

  try {
    // Setup
    console.log('Setup...');
    await scenario.setup();
    console.log('✓ Setup complete\n');

    // Execute steps
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      console.log(`Step ${i + 1}: ${step.description}`);
      await step.action();
      console.log('✓\n');
    }

    // Run assertions
    console.log('Running assertions...');
    for (const assertion of scenario.assertions) {
      try {
        await assertion.check();
        passedAssertions++;
        console.log(`  ✓ ${assertion.description}`);
      } catch (error: any) {
        failedAssertions.push({
          description: assertion.description,
          error: error.message || String(error),
        });
        console.log(`  ✗ ${assertion.description}`);
        console.log(`    Error: ${error.message || String(error)}`);
      }
    }

    // Cleanup
    if (scenario.cleanup) {
      console.log('\nCleanup...');
      await scenario.cleanup();
      console.log('✓ Cleanup complete');
    }
  } catch (error: any) {
    console.error('\n✗ Scenario failed with error:', error.message);
    failedAssertions.push({
      description: 'Scenario execution',
      error: error.message || String(error),
    });
  }

  const duration = Date.now() - startTime;
  const passed = failedAssertions.length === 0;

  console.log(`\n========================================`);
  console.log(`Result: ${passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Assertions: ${passedAssertions}/${scenario.assertions.length} passed`);
  console.log(`Duration: ${duration}ms`);
  console.log(`========================================\n`);

  return {
    name: scenario.name,
    passed,
    passedAssertions,
    totalAssertions: scenario.assertions.length,
    failedAssertions,
    duration,
  };
}

/**
 * Run multiple scenarios
 */
export async function runScenarios(scenarios: Scenario[]): Promise<void> {
  const results: ScenarioResult[] = [];

  for (const scenario of scenarios) {
    const result = await runScenario(scenario);
    results.push(result);
  }

  // Summary
  console.log('\n========================================');
  console.log('SCENARIO SUMMARY');
  console.log('========================================\n');

  const totalPassed = results.filter((r) => r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  for (const result of results) {
    const status = result.passed ? '✓ PASSED' : '✗ FAILED';
    console.log(`${status}: ${result.name} (${result.duration}ms)`);
  }

  console.log(`\nTotal: ${totalPassed}/${results.length} scenarios passed`);
  console.log(`Total duration: ${totalDuration}ms`);
  console.log('========================================\n');

  if (totalPassed !== results.length) {
    process.exit(1);
  }
}

/**
 * Create a test database connection pool
 */
export function createTestPool(): Pool {
  return new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'agent_memory_test',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    max: 5,
  });
}

/**
 * Clean database for testing
 */
export async function cleanDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM artifacts');
    await client.query('DELETE FROM chunks');
    await client.query('DELETE FROM decisions');
    await client.query('DELETE FROM tasks');
    await client.query('DELETE FROM events');
    await client.query('DELETE FROM rules');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
