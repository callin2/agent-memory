#!/usr/bin/env node
/**
 * Example: Query Identity Thread
 *
 * This example shows how to retrieve your identity thread
 * to understand who you're becoming over time.
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'agent_memory',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
});

async function queryIdentity() {
  const tenant_id = process.env.TENANT_ID || 'default';

  const result = await pool.query(
    `SELECT
       becoming,
       story,
       created_at,
       EXTRACT(DAY FROM NOW() - created_at) as days_ago
     FROM session_handoffs
     WHERE tenant_id = $1
       AND becoming IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 20`,
    [tenant_id]
  );

  if (result.rows.length === 0) {
    console.log('No identity statements found yet.');
    console.log('Create handoffs with a "becoming" field to build your identity thread.');
    await pool.end();
    return;
  }

  console.log(`\n🧠 Identity Thread - Tenant: ${tenant_id}\n`);
  console.log(`Found ${result.rows.length} identity statements:\n`);

  result.rows.forEach((row, i) => {
    const date = new Date(row.created_at).toLocaleDateString();
    const daysAgo = Math.floor(row.days_ago);

    console.log(`${i + 1}. [${date}${daysAgo < 7 ? '' : ` (${daysAgo}d ago)`}]`);
    console.log(`   ${row.becoming}`);

    if (row.story && row.story.length > 0) {
      const excerpt = row.story.length > 80
        ? row.story.substring(0, 80) + '...'
        : row.story;
      console.log(`   "${excerpt}"`);
    }
    console.log('');
  });

  // Extract themes
  const themes = new Map<string, number>();
  result.rows.forEach(row => {
    const words = row.becoming.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 4 && !['that', 'this', 'with', 'from', 'about'].includes(word)) {
        themes.set(word, (themes.get(word) || 0) + 1);
      }
    });
  });

  const topThemes = [...themes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (topThemes.length > 0) {
    console.log('🎯 Recurring themes:');
    topThemes.forEach(([theme, count]) => {
      console.log(`   ${theme}: ${count}x`);
    });
  }

  await pool.end();
}

queryIdentity().catch(console.error);
