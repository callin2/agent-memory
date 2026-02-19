#!/usr/bin/env node

/**
 * Test Script for New MCP Tools: recall() and remember_note()
 *
 * Tests the simplified memory tools:
 * 1. remember_note() - Quick capture
 * 2. recall() - Universal semantic search
 */

import { MemoryClient } from '../../../src/utils/memory-client-v2.js';

const MEMORY_API = process.env.MEMORY_API || 'http://localhost:4000/mcp';
const client = new MemoryClient(MEMORY_API);

async function testRememberNote() {
  console.log('\n=== Testing remember_note() ===\n');

  const testNotes = [
    {
      text: "Stratified memory visualizer has a bug with dark mode toggle",
      tags: ["bug", "visualizer", "dark-mode"],
      with_whom: "Callin"
    },
    {
      text: "Implemented P0-2 API integration with retry logic",
      tags: ["feature", "api", "completed"],
      with_whom: "Callin"
    },
    {
      text: "User feedback: want mobile responsive layout for the visualizer",
      tags: ["feedback", "mobile", "ux"],
      with_whom: "Callin"
    },
    {
      text: "Remember to check embedding API latency - currently 200-500ms per call",
      tags: ["performance", "embedding", "todo"],
      with_whom: null
    }
  ];

  const results = [];

  for (const note of testNotes) {
    try {
      console.log(`Creating note: "${note.text.substring(0, 50)}..."`);

      const response = await client.callTool('remember_note', note);

      const result = JSON.parse(response.content[0].text);

      if (result.success) {
        console.log(`✅ Note created: ${result.note.id}`);
        console.log(`   Tags: ${result.note.tags?.join(', ') || 'none'}`);
        console.log(`   With whom: ${result.note.with_whom || 'none'}\n`);
        results.push({ success: true, note: result.note });
      } else {
        console.log(`❌ Failed: ${result.error}\n`);
        results.push({ success: false, error: result.error });
      }
    } catch (error) {
      console.log(`❌ Exception: ${error.message}\n`);
      results.push({ success: false, error: error.message });
    }
  }

  return results;
}

async function testRecall() {
  console.log('\n=== Testing recall() ===\n');

  const testQueries = [
    "visualizer issues and bugs",
    "what did I work on with Callin",
    "embedding performance",
    "mobile responsive design",
    "API integration features"
  ];

  const results = [];

  for (const query of testQueries) {
    try {
      console.log(`Query: "${query}"`);

      const response = await client.callTool('recall', {
        query,
        types: ['all'],
        limit: 3,
        min_similarity: 0.3
      });

      const result = JSON.parse(response.content[0].text);

      if (result.success) {
        console.log(`✅ Found ${result.total_count} results`);
        console.log(`   Types searched: ${result.types_searched.join(', ')}`);

        // Show breakdown by type
        for (const [type, data] of Object.entries(result.results)) {
          if (data.count > 0) {
            console.log(`   - ${type}: ${data.count} results`);
            // Show first result preview
            if (data.items && data.items[0]) {
              const item = data.items[0];
              const preview = item.description || item.text || item.experienced || JSON.stringify(item);
              console.log(`     Preview: "${preview.substring(0, 80)}..."`);
              console.log(`     Similarity: ${item.similarity?.toFixed(3) || 'N/A'}`);
            }
          }
        }
        console.log('');
        results.push({ success: true, query, result });
      } else {
        console.log(`❌ Failed: ${result.error}\n`);
        results.push({ success: false, query, error: result.error });
      }
    } catch (error) {
      console.log(`❌ Exception: ${error.message}\n`);
      results.push({ success: false, query, error: error.message });
    }
  }

  return results;
}

async function testCrossTableSearch() {
  console.log('\n=== Testing Cross-Table Search ===\n');

  // Search for something that should appear in multiple tables
  const query = "visualizer";

  try {
    console.log(`Query: "${query}" across all types\n`);

    const response = await client.callTool('recall', {
      query,
      types: ['agent_feedback', 'knowledge_notes', 'session_handoffs'],
      limit: 5,
      min_similarity: 0.3
    });

    const result = JSON.parse(response.content[0].text);

    if (result.success) {
      console.log(`✅ Cross-table search successful`);
      console.log(`   Total results: ${result.total_count}`);
      console.log(`   Types searched: ${result.types_searched.join(', ')}\n`);

      // Show results by type
      for (const [type, data] of Object.entries(result.results)) {
        if (data.count > 0) {
          console.log(`${type.toUpperCase()} (${data.count} results):`);
          data.items.slice(0, 2).forEach((item, i) => {
            const preview = item.description || item.text || item.experienced || JSON.stringify(item);
            console.log(`  ${i + 1}. [${item.similarity?.toFixed(3)}] "${preview.substring(0, 100)}..."`);
          });
          console.log('');
        }
      }

      return { success: true, result };
    } else {
      console.log(`❌ Failed: ${result.error}\n`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.log(`❌ Exception: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

async function testNoteRecallFlow() {
  console.log('\n=== Testing Note → Recall Flow ===\n');

  // 1. Create a note
  const noteText = "TEST NOTE: Quick brown fox jumps over the lazy dog - unique phrase for testing";
  console.log(`1. Creating test note: "${noteText.substring(0, 50)}..."`);

  const createResponse = await client.callTool('remember_note', {
    text: noteText,
    tags: ['test'],
    with_whom: 'Claude'
  });

  const createResult = JSON.parse(createResponse.content[0].text);

  if (!createResult.success) {
    console.log(`❌ Failed to create note: ${createResult.error}`);
    return { success: false, error: createResult.error };
  }

  console.log(`✅ Note created: ${createResult.note.id}`);

  // 2. Wait a moment for embedding generation
  console.log(`\n2. Waiting 2 seconds for embedding generation...`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. Recall the note
  console.log(`\n3. Searching for note using unique phrase...`);

  const recallResponse = await client.callTool('recall', {
    query: "brown fox lazy dog testing",
    types: ['knowledge_notes'],
    limit: 5,
    min_similarity: 0.3
  });

  const recallResult = JSON.parse(recallResponse.content[0].text);

  if (!recallResult.success) {
    console.log(`❌ Failed to recall: ${recallResult.error}`);
    return { success: false, error: recallResult.error };
  }

  console.log(`✅ Recall successful: ${recallResult.total_count} results found`);

  // 4. Verify the note is in results
  const found = recallResult.results.knowledge_notes?.items?.find(
    item => item.id === createResult.note.id
  );

  if (found) {
    console.log(`✅ Test note found in search results!`);
    console.log(`   Similarity score: ${found.similarity?.toFixed(3)}`);
    console.log(`   Text: "${found.text.substring(0, 80)}..."`);
    return { success: true, found };
  } else {
    console.log(`❌ Test note NOT found in results`);
    console.log(`   This might mean embedding hasn't been generated yet`);
    console.log(`   Try running: npm run generate-embeddings`);
    return { success: false, error: 'Note not found in search results' };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  MCP Tools Redesign - Integration Test                 ║');
  console.log('║  Testing: recall() and remember_note()                 ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  console.log(`\nAPI Endpoint: ${MEMORY_API}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  try {
    // Test 1: remember_note
    const noteResults = await testRememberNote();

    // Test 2: Cross-table search
    const crossTableResults = await testCrossTableSearch();

    // Test 3: Various recall queries
    const recallResults = await testRecall();

    // Test 4: Note → Recall flow
    const flowResults = await testNoteRecallFlow();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  Test Summary                                          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    const summary = {
      remember_note: {
        total: noteResults.length,
        successful: noteResults.filter(r => r.success).length,
        failed: noteResults.filter(r => !r.success).length
      },
      cross_table_search: crossTableResults.success ? '✅ Pass' : '❌ Fail',
      recall_queries: {
        total: recallResults.length,
        successful: recallResults.filter(r => r.success).length,
        failed: recallResults.filter(r => !r.success).length
      },
      note_recall_flow: flowResults.success ? '✅ Pass' : '❌ Fail'
    };

    console.log('remember_note():');
    console.log(`  Total: ${summary.remember_note.total}`);
    console.log(`  ✅ Successful: ${summary.remember_note.successful}`);
    console.log(`  ❌ Failed: ${summary.remember_note.failed}\n`);

    console.log('Cross-table search:');
    console.log(`  ${summary.cross_table_search}\n`);

    console.log('recall():');
    console.log(`  Total queries: ${summary.recall_queries.total}`);
    console.log(`  ✅ Successful: ${summary.recall_queries.successful}`);
    console.log(`  ❌ Failed: ${summary.recall_queries.failed}\n`);

    console.log('Note → Recall flow:');
    console.log(`  ${summary.note_recall_flow}\n`);

    // Exit with appropriate code
    const allPassed =
      summary.remember_note.failed === 0 &&
      summary.cross_table_search === '✅ Pass' &&
      summary.recall_queries.failed === 0 &&
      summary.note_recall_flow === '✅ Pass';

    if (allPassed) {
      console.log('✅ All tests PASSED!');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests FAILED');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();
