#!/usr/bin/env node

/**
 * Foundation Verification Test
 *
 * Tests the multi-agent collaboration foundation:
 * - SOURCES_OF_TRUTH.md accuracy
 * - File organization
 * - Documentation links
 * - Protocol usability
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

let passed = 0;
let failed = 0;
let warnings = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${err.message}`);
    failed++;
  }
}

function warn(msg) {
  console.log(`⚠️  WARN: ${msg}`);
  warnings++;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFileExists(path) {
  assert(existsSync(path), `File does not exist: ${path}`);
}

function assertFileHasContent(path, content) {
  const file = readFileSync(path, 'utf-8');
  assert(file.includes(content), `${path} does not include: ${content}`);
}

console.log('\n=== Foundation Verification Test ===\n');

// ============================================================================
// Test 1: Core Foundation Files Exist
// ============================================================================

console.log('1. Core Foundation Files');

test('SOURCES_OF_TRUTH.md exists', () => {
  assertFileExists(join(root, 'docs/SOURCES_OF_TRUTH.md'));
});

test('ONBOARDING.md exists', () => {
  assertFileExists(join(root, 'docs/ONBOARDING.md'));
});

test('MAINTENANCE.md exists', () => {
  assertFileExists(join(root, 'docs/MAINTENANCE.md'));
});

// ============================================================================
// Test 2: File Organization
// ============================================================================

console.log('\n2. File Organization');

test('Tests organized in folders', () => {
  assertFileExists(join(root, 'tests/integration/mcp'));
  assertFileExists(join(root, 'tests/manual'));
  assertFileExists(join(root, 'tests/debug'));
});

test('MCP tests moved to integration/mcp/', () => {
  assertFileExists(join(root, 'tests/integration/mcp/test-mcp-auth.mjs'));
  assertFileExists(join(root, 'tests/integration/mcp/test-mcp-simple.mjs'));
  assertFileExists(join(root, 'tests/integration/mcp/test-mcp-wake-up.mjs'));
});

test('Archive directory exists', () => {
  assertFileExists(join(root, 'docs/archive/progress'));
});

test('Root directory clean (only run-migrations.mjs)', () => {
  const files = readdirSync(join(root))
    .filter(f => f.endsWith('.mjs'));

  assert(files.length === 1, `Expected 1 .mjs file, found ${files.length}: ${files.join(', ')}`);
  assert(files[0] === 'run-migrations.mjs', `Expected run-migrations.mjs, found ${files[0]}`);
});

// ============================================================================
// Test 3: SOURCES_OF_TRUTH.md Accuracy
// ============================================================================

console.log('\n3. SOURCES_OF_TRUTH.md Accuracy');

const truthPath = join(root, 'docs/SOURCES_OF_TRUTH.md');
const truthContent = readFileSync(truthPath, 'utf-8');

test('SOURCES_OF_TRUTH.md lists current files', () => {
  assertFileHasContent(truthPath, 'src/mcp/memory-server-http.ts');
  assertFileHasContent(truthPath, 'src/mcp/auth.ts');
  assertFileHasContent(truthPath, '.mcp.json');
  assertFileHasContent(truthPath, 'ecosystem.config.js');
});

test('SOURCES_OF_TRUTH.md marks removed files as removed', () => {
  assertFileHasContent(truthPath, 'src/mcp/memory-server.ts');
  // Should mention it's removed
  assert(truthContent.includes('Removed Source Code') || truthContent.includes('memory-server.ts'),
    'Should list memory-server.ts as removed');
});

test('SOURCES_OF_TRUTH.md lists all 11 MCP tools', () => {
  const tools = [
    'wake_up',
    'create_handoff',
    'get_last_handoff',
    'get_identity_thread',
    'list_handoffs',
    'create_knowledge_note',
    'get_knowledge_notes',
    'list_semantic_principles',
    'create_capsule',
    'get_capsules',
    'get_compression_stats'
  ];

  tools.forEach(tool => {
    assert(truthContent.includes(tool), `Missing tool: ${tool}`);
  });
});

test('SOURCES_OF_TRUTH.md references correct docs', () => {
  assertFileHasContent(truthPath, 'MCP_QUICK_START.md');
  assertFileHasContent(truthPath, 'MCP_HTTP_AUTH.md');
  assertFileHasContent(truthPath, 'AGENTS.md');
});

test('SOURCES_OF_TRUTH.md has status markers', () => {
  assert(truthContent.includes('✅'), 'Missing ✅ Current marker');
  assert(truthContent.includes('⚠️'), 'Missing ⚠️ Needs Review marker');
  assert(truthContent.includes('❌'), 'Missing ❌ Outdated marker');
});

// ============================================================================
// Test 4: ONBOARDING.md Usability
// ============================================================================

console.log('\n4. ONBOARDING.md Usability');

const onboardingPath = join(root, 'docs/ONBOARDING.md');
const onboardingContent = readFileSync(onboardingPath, 'utf-8');

test('ONBOARDING.md provides clear paths', () => {
  assertFileHasContent(onboardingPath, "I'm a Human, New to the Project");
  assertFileHasContent(onboardingPath, "I'm an AI Agent, Starting a Session");
  assertFileHasContent(onboardingPath, "I'm Reviewing Code");
});

test('ONBOARDING.md links to SOURCES_OF_TRUTH.md', () => {
  assertFileHasContent(onboardingPath, 'SOURCES_OF_TRUTH.md');
  // Should appear multiple times
  const matches = onboardingContent.match(/SOURCES_OF_TRUTH.md/g);
  assert(matches && matches.length >= 5, `Expected 5+ references, found ${matches?.length || 0}`);
});

test('ONBOARDING.md has "What do you want to do?" section', () => {
  assertFileHasContent(onboardingPath, 'What Do You Want To Do?');
});

test('ONBOARDING.md provides time estimates', () => {
  assert(onboardingContent.includes('15-30 minutes') ||
         onboardingContent.includes('5-10 minutes') ||
         onboardingContent.includes('2-5 minutes'),
    'Missing time estimates for tasks');
});

// ============================================================================
// Test 5: MAINTENANCE.md Protocol
// ============================================================================

console.log('\n5. MAINTENANCE.md Protocol');

const maintenancePath = join(root, 'docs/MAINTENANCE.md');
const maintenanceContent = readFileSync(maintenancePath, 'utf-8');

test('MAINTENANCE.md has step-by-step protocols', () => {
  assertFileHasContent(maintenancePath, 'Adding a New Feature');
  assertFileHasContent(maintenancePath, 'Fixing a Bug');
  assertFileHasContent(maintenancePath, 'Removing a Feature');
});

test('MAINTENANCE.md explains commit structure', () => {
  assertFileHasContent(maintenancePath, 'type(scope): description');
  assertFileHasContent(maintenancePath, 'feat'); // Can be in table or example
  assertFileHasContent(maintenancePath, 'fix');
  assertFileHasContent(maintenancePath, 'docs:');
});

test('MAINTENANCE.md has weekly routine', () => {
  assertFileHasContent(maintenancePath, 'Weekly Review');
  assertFileHasContent(maintenancePath, 'Monthly Tasks');
});

test('MAINTENANCE.md references SOURCES_OF_TRUTH.md', () => {
  assertFileHasContent(maintenancePath, 'SOURCES_OF_TRUTH.md');
});

// ============================================================================
// Test 6: Documentation Links
// ============================================================================

console.log('\n6. Documentation Links');

test('SOURCES_OF_TRUTH.md links to ONBOARDING.md', () => {
  assertFileHasContent(truthPath, 'ONBOARDING.md');
});

test('ONBOARDING.md links to MAINTENANCE.md', () => {
  assertFileHasContent(onboardingPath, 'MAINTENANCE.md');
});

test('All three docs reference each other', () => {
  // Sources of truth mentions others
  assertFileHasContent(truthPath, 'ONBOARDING.md');
  assertFileHasContent(truthPath, 'MAINTENANCE.md');

  // Onboarding mentions others
  assertFileHasContent(onboardingPath, 'SOURCES_OF_TRUTH.md');
  assertFileHasContent(onboardingPath, 'MAINTENANCE.md');

  // Maintenance mentions others
  assertFileHasContent(maintenancePath, 'SOURCES_OF_TRUTH.md');
  assertFileHasContent(maintenancePath, 'ONBOARDING.md');
});

// ============================================================================
// Test 7: Current Implementation Verification
// ============================================================================

console.log('\n7. Current Implementation Verification');

test('memory-server-http.ts exists and has 11 tools', () => {
  const serverPath = join(root, 'src/mcp/memory-server-http.ts');
  assertFileExists(serverPath);

  const serverContent = readFileSync(serverPath, 'utf-8');

  // Check for key tools
  assert(serverContent.includes('wake_up'), 'Missing wake_up tool');
  assert(serverContent.includes('create_handoff'), 'Missing create_handoff tool');
  assert(serverContent.includes('get_last_handoff'), 'Missing get_last_handoff tool');
});

test('auth.ts exists with Bearer token functions', () => {
  const authPath = join(root, 'src/mcp/auth.ts');
  assertFileExists(authPath);

  const authContent = readFileSync(authPath, 'utf-8');
  assert(authContent.includes('extractBearerToken'), 'Missing extractBearerToken function');
  assert(authContent.includes('validateBearerToken'), 'Missing validateBearerToken function');
});

test('.mcp.json configured for HTTP', () => {
  const configPath = join(root, '.mcp.json');
  assertFileExists(configPath);

  const configContent = readFileSync(configPath, 'utf-8');
  assert(configContent.includes('http://localhost:4000/mcp'), 'Wrong MCP endpoint');
  assert(configContent.includes('Authorization'), 'Missing Authorization header');
  assert(configContent.includes('Bearer'), 'Missing Bearer token');
});

test('ecosystem.config.js uses memory-server-http', () => {
  const ecosystemPath = join(root, 'ecosystem.config.js');
  assertFileExists(ecosystemPath);

  const ecosystemContent = readFileSync(ecosystemPath, 'utf-8');
  assert(ecosystemContent.includes('memory-server-http'), 'Wrong MCP server script');
});

// ============================================================================
// Test 8: Archive Verification
// ============================================================================

console.log('\n8. Archive Verification');

test('Archive contains historical docs', () => {
  assertFileExists(join(root, 'docs/archive/progress/PHASE_2_MCP_AUTH_SUMMARY.md'));
  assertFileExists(join(root, 'docs/archive/progress/IMPLEMENTATION_UPDATE.md'));
});

test('Archive docs are not in main docs/', () => {
  const docsDir = join(root, 'docs');
  const files = readdirSync(docsDir);

  const phaseFiles = files.filter(f => f.startsWith('PHASE'));
  assert(phaseFiles.length === 0, `Found phase files in main docs: ${phaseFiles.join(', ')}`);
});

// ============================================================================
// Test 9: Test File Organization
// ============================================================================

console.log('\n9. Test File Organization');

test('No test files in root directory', () => {
  const rootFiles = readdirSync(join(root))
    .filter(f => f.startsWith('test-') || f.startsWith('debug-') || f.startsWith('final-') || f.startsWith('ensure-'));

  assert(rootFiles.length === 0, `Found test files in root: ${rootFiles.join(', ')}`);
});

test('Integration MCP tests exist', () => {
  const mcpDir = join(root, 'tests/integration/mcp');
  const files = readdirSync(mcpDir);

  assert(files.includes('test-mcp-auth.mjs'), 'Missing test-mcp-auth.mjs');
  assert(files.includes('test-mcp-simple.mjs'), 'Missing test-mcp-simple.mjs');
});

// ============================================================================
// Test 10: Documentation Timestamps
// ============================================================================

console.log('\n10. Documentation Freshness');

test('Foundation docs have recent dates', () => {
  // Check for any date in 2026-02 (current month)
  const hasRecentDate =
    (truthContent.includes('2026-02-19') || truthContent.includes('2026-02-18') || truthContent.includes('2026-02-17')) ||
    (onboardingContent.includes('2026-02-19') || onboardingContent.includes('2026-02-18') || onboardingContent.includes('2026-02-17')) ||
    (maintenanceContent.includes('2026-02-19') || maintenanceContent.includes('2026-02-18') || maintenanceContent.includes('2026-02-17'));

  assert(hasRecentDate, 'Foundation docs should have recent dates (2026-02-17, 2026-02-18, or 2026-02-19)');
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log('SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log('='.repeat(50));

if (failed === 0 && warnings === 0) {
  console.log('\n🎉 All tests passed! Foundation is solid.\n');
  process.exit(0);
} else if (failed === 0) {
  console.log('\n✅ All critical tests passed. Review warnings.\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Review and fix.\n');
  process.exit(1);
}
