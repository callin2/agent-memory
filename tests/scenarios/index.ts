import { runScenarios } from './scenario-runner';
import { testScenarioA1 } from './a1-legacy-onboarding.test';
import { testScenarioA2 } from './a2-old-decision-recall.test';
import { testScenarioA3 } from './a3-decision-supersession.test';
import { testScenarioA4, testScenarioA5, testScenarioA6 } from './a4-a6.test';

/**
 * Main test runner for all scenarios
 */
async function main() {
  const scenarios = [
    // A1: Legacy Project Onboarding
    await testScenarioA1(),

    // A2: Old Decision Recall
    await testScenarioA2(),

    // A3: Decision Supersession
    await testScenarioA3(),

    // A4: Summary Drift Guard
    await testScenarioA4(),

    // A5: Task Continuity
    await testScenarioA5(),

    // A6: Multi-Agent Handoff
    await testScenarioA6(),

    // More scenarios to be added...
    // await testScenarioA7();
    // await testScenarioA8();
    // ...
  ];

  await runScenarios(scenarios);
}

main().catch(console.error);
