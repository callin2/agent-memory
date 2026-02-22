#!/bin/bash

# Test script for project_path auto-injection
echo "=== Testing Project Path Auto-injection ==="
echo ""

# Test 1: Via X-Project-Path header
echo "Test 1: Creating note via X-Project-Path header"
curl -s -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -H "X-Project-Path: /Users/callin/Callin_Project/test-project" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "remember_note",
      "arguments": {
        "text": "Test note with project path from header",
        "tags": ["test", "project-tracking"]
      }
    }
  }' | jq '.'

echo ""
echo "Test 2: Checking server logs for auto-injection"
tail -20 /Users/callin/Callin_Project/agent_memory_v2/logs/mcp-error.log | grep -E "Project path|Auto-injected" || echo "No auto-injection logs found (might not have triggered yet)"

echo ""
echo "Test 3: Direct database query for project_path"
echo "Run this manually to verify:"
echo "psql -d agent_memory_dev -c \"SELECT id, LEFT(text, 50) as text, project_path, created_at FROM knowledge_notes ORDER BY created_at DESC LIMIT 5;\""
