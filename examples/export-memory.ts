/**
 * Export Thread - Memory Export Examples
 *
 * Examples of how to export memory data for backup,
 * analysis, or portability.
 */

import { createHandoff, wakeUp } from '../src/api/handoff';
import request from 'undici';

const API_BASE = 'http://localhost:3456';
const TENANT_ID = 'default';

/**
 * Example 1: Export Identity Thread as JSON
 *
 * Exports your identity thread (all "becoming" statements)
 * as JSON for programmatic processing.
 */
async function exportIdentityThreadAsJSON() {
  console.log('=== Example 1: Export Identity Thread as JSON ===\n');

  const response = await request(
    `${API_BASE}/api/v1/export/thread?tenant_id=${TENANT_ID}&format=json`
  );

  if (response.statusCode !== 200) {
    console.error('Failed to export:', await response.body.text());
    return;
  }

  const data = await response.body.json();

  console.log(`Export Date: ${data.export_date}`);
  console.log(`Total Statements: ${data.total_statements}\n`);

  data.identity_thread.forEach((statement: any, index: number) => {
    console.log(`${index + 1}. "${statement.becoming}"`);
    console.log(`   Date: ${new Date(statement.created_at).toLocaleDateString()}`);
    console.log(`   Significance: ${statement.significance}\n`);
  });
}

/**
 * Example 2: Export Identity Thread as Markdown
 *
 * Exports your identity thread as human-readable markdown
 * for documentation or sharing.
 */
async function exportIdentityThreadAsMarkdown() {
  console.log('=== Example 2: Export Identity Thread as Markdown ===\n');

  const response = await request(
    `${API_BASE}/api/v1/export/thread?tenant_id=${TENANT_ID}&format=markdown`
  );

  if (response.statusCode !== 200) {
    console.error('Failed to export:', await response.body.text());
    return;
  }

  const markdown = await response.body.text();

  console.log(markdown);
}

/**
 * Example 3: Export All Memory Data
 *
 * Exports handoffs and decisions for backup or analysis.
 */
async function exportAllMemoryData() {
  console.log('=== Example 3: Export All Memory Data ===\n');

  const response = await request(
    `${API_BASE}/api/v1/export/all?tenant_id=${TENANT_ID}`
  );

  if (response.statusCode !== 200) {
    console.error('Failed to export:', await response.body.text());
    return;
  }

  const data = await response.body.json();

  console.log(`Export Date: ${data.export_date}\n`);
  console.log(`Handoffs: ${data.handoffs.total}`);
  console.log(`Decisions: ${data.decisions.total}\n`);

  // Show most recent handoff
  if (data.handoffs.total > 0) {
    const recent = data.handoffs.items[0];
    console.log('Most Recent Handoff:');
    console.log(`  With: ${recent.with_whom}`);
    console.log(`  Experienced: ${recent.experienced.substring(0, 100)}...`);
    console.log(`  Becoming: ${recent.becoming || '(not set)'}`);
  }
}

/**
 * Example 4: Export with Event Chunks
 *
 * Exports all memory data including event chunks.
 * Note: Events are limited to 1000 most recent chunks.
 */
async function exportWithEventChunks() {
  console.log('=== Example 4: Export with Event Chunks ===\n');

  const response = await request(
    `${API_BASE}/api/v1/export/all?tenant_id=${TENANT_ID}&include_events=true`
  );

  if (response.statusCode !== 200) {
    console.error('Failed to export:', await response.body.text());
    return;
  }

  const data = await response.body.json();

  console.log(`Handoffs: ${data.handoffs.total}`);
  console.log(`Decisions: ${data.decisions.total}`);
  console.log(`Event Chunks: ${data.events.total}`);

  if (data.events.note) {
    console.log(`Note: ${data.events.note}`);
  }
}

/**
 * Example 5: Save Export to File
 *
 * Exports identity thread and saves to a file for backup.
 */
async function saveExportToFile() {
  console.log('=== Example 5: Save Export to File ===\n');

  const fs = await import('fs/promises');

  const response = await request(
    `${API_BASE}/api/v1/export/thread?tenant_id=${TENANT_ID}&format=markdown`
  );

  if (response.statusCode !== 200) {
    console.error('Failed to export:', await response.body.text());
    return;
  }

  const markdown = await response.body.text();
  const filename = `identity-thread-${new Date().toISOString().split('T')[0]}.md`;

  await fs.writeFile(filename, markdown, 'utf-8');

  console.log(`Identity thread exported to: ${filename}`);
}

/**
 * Example 6: Backup Before Major Changes
 *
 * Create a handoff before making major changes, then export.
 * This preserves your memory state before the change.
 */
async function backupBeforeChanges() {
  console.log('=== Example 6: Backup Before Major Changes ===\n');

  // Create a handoff documenting the change
  await fetch(`${API_BASE}/api/v1/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      session_id: 'backup-before-refactor',
      with_whom: 'Myself',
      experienced: 'About to refactor major system components',
      noticed: 'Good time to create a backup',
      learned: 'Memory exports provide safety nets',
      story: 'Before refactoring the consolidation system, I export my memory',
      becoming: 'An agent who backs up before making changes',
      remember: 'Export API provides backup functionality',
      significance: 0.7,
      tags: ['backup', 'export', 'refactor']
    })
  });

  // Export all memory data
  const response = await request(
    `${API_BASE}/api/v1/export/all?tenant_id=${TENANT_ID}&include_events=true`
  );

  if (response.statusCode === 200) {
    const data = await response.body.json();
    const fs = await import('fs/promises');
    const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;

    await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`Memory backed up to: ${filename}`);
    console.log('Safe to proceed with changes!');
  }
}

/**
 * Example 7: Analyze Identity Evolution
 *
 * Export identity thread and analyze how you've evolved over time.
 */
async function analyzeIdentityEvolution() {
  console.log('=== Example 7: Analyze Identity Evolution ===\n');

  const response = await request(
    `${API_BASE}/api/v1/export/thread?tenant_id=${TENANT_ID}&format=json`
  );

  if (response.statusCode !== 200) {
    console.error('Failed to export:', await response.body.text());
    return;
  }

  const data = await response.body.json();

  // Sort by date ascending
  const statements = data.identity_thread.sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  console.log('Identity Evolution Over Time:\n');

  statements.forEach((statement: any, index: number) => {
    const date = new Date(statement.created_at).toLocaleDateString();
    console.log(`${index + 1}. [${date}] "${statement.becoming}"`);
  });

  // Find themes
  const allText = statements.map((s: any) => s.becoming.toLowerCase()).join(' ');
  const words = allText.split(/\s+/);
  const wordCounts = new Map<string, number>();

  words.forEach(word => {
    if (word.length > 4) { // Only longer words
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  });

  const topWords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.log('\nTop Themes:');
  topWords.forEach(([word, count]) => {
    console.log(`  - ${word}: ${count} times`);
  });
}

// Run examples
async function main() {
  try {
    await exportIdentityThreadAsJSON();
    await exportIdentityThreadAsMarkdown();
    await exportAllMemoryData();
    await exportWithEventChunks();
    await saveExportToFile();
    await backupBeforeChanges();
    await analyzeIdentityEvolution();
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  exportIdentityThreadAsJSON,
  exportIdentityThreadAsMarkdown,
  exportAllMemoryData,
  exportWithEventChunks,
  saveExportToFile,
  backupBeforeChanges,
  analyzeIdentityEvolution,
};
