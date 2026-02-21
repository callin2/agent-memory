#!/bin/bash
# Test script for task management MCP tools

MCP_URL="http://localhost:4000/mcp"
AUTH_HEADER="Authorization: Bearer test-mcp-token"

echo "===== Testing Task Management MCP Tools ====="
echo ""

# Test 1: Create Task A
echo "1. Creating Task A..."
TASK_A_RESPONSE=$(curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_task",
      "arguments": {
        "title": "Task A - Foundation",
        "details": "First task that others depend on",
        "project_id": "test-proj",
        "priority": "high"
      }
    }
  }')

TASK_A_ID=$(echo $TASK_A_RESPONSE | jq -r '.result.content[0].text' | jq -r '.task.task_id')
echo "Created Task A: $TASK_A_ID"
echo ""

# Test 2: Create Task B (blocked by Task A)
echo "2. Creating Task B (blocked by Task A)..."
TASK_B_RESPONSE=$(curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 2,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"create_task\",
      \"arguments\": {
        \"title\": \"Task B - Dependent\",
        \"details\": \"Second task blocked by Task A\",
        \"project_id\": \"test-proj\",
        \"priority\": \"medium\",
        \"blocked_by\": [\"$TASK_A_ID\"]
      }
    }
  }")

TASK_B_ID=$(echo $TASK_B_RESPONSE | jq -r '.result.content[0].text' | jq -r '.task.task_id')
echo "Created Task B: $TASK_B_ID"
echo ""

# Test 3: Create Task C (blocked by Task B)
echo "3. Creating Task C (blocked by Task B)..."
TASK_C_RESPONSE=$(curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 3,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"create_task\",
      \"arguments\": {
        \"title\": \"Task C - Final\",
        \"details\": \"Final task blocked by Task B\",
        \"project_id\": \"test-proj\",
        \"priority\": \"critical\",
        \"blocked_by\": [\"$TASK_B_ID\"]
      }
    }
  }")

TASK_C_ID=$(echo $TASK_C_RESPONSE | jq -r '.result.content[0].text' | jq -r '.task.task_id')
echo "Created Task C: $TASK_C_ID"
echo ""

# Test 4: Get Task B with dependencies
echo "4. Getting Task B with dependencies..."
curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 4,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_task\",
      \"arguments\": {
        \"task_id\": \"$TASK_B_ID\"
      }
    }
  }" | jq '.result.content[0].text' | jq .
echo ""

# Test 5: List tasks for project
echo "5. Listing tasks for test-proj..."
curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "list_tasks",
      "arguments": {
        "project_id": "test-proj"
      }
    }
  }' | jq '.result.content[0].text' | jq .
echo ""

# Test 6: Get project summary
echo "6. Getting project summary..."
curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "get_project_summary",
      "arguments": {
        "project_id": "test-proj"
      }
    }
  }' | jq '.result.content[0].text' | jq .
echo ""

# Test 7: Get task dependencies (graph)
echo "7. Getting task dependency graph for Task B..."
curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 7,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_task_dependencies\",
      \"arguments\": {
        \"task_id\": \"$TASK_B_ID\",
        \"depth\": 3
      }
    }
  }" | jq '.result.content[0].text' | jq .
echo ""

# Test 8: Update Task A to "done"
echo "8. Updating Task A status to 'done'..."
curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 8,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"update_task\",
      \"arguments\": {
        \"task_id\": \"$TASK_A_ID\",
        \"status\": \"done\",
        \"progress_percentage\": 100
      }
    }
  }" | jq '.result.content[0].text' | jq .
echo ""

# Test 9: List projects
echo "9. Listing all projects..."
curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d '{
    "jsonrpc": "2.0",
    "id": 9,
    "method": "tools/call",
    "params": {
      "name": "list_projects",
      "arguments": {}
    }
  }' | jq '.result.content[0].text' | jq .
echo ""

echo "===== All tests completed ====="
echo ""
echo "Task IDs created:"
echo "  Task A: $TASK_A_ID"
echo "  Task B: $TASK_B_ID"
echo "  Task C: $TASK_C_ID"
