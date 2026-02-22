#!/bin/bash
# Test circular dependency detection

MCP_URL="http://localhost:4000/mcp"
AUTH_HEADER="Authorization: Bearer test-mcp-token"

echo "===== Testing Circular Dependency Detection ====="
echo ""

# Test 1: Create Task A
echo "1. Creating Task A..."
TASK_A=$(curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_task",
      "arguments": {
        "title": "Task A",
        "details": "First task in chain",
        "project_id": "cycle-test"
      }
    }
  }' | jq -r '.result.content[0].text | fromjson | .task.task_id')

echo "Created Task A: $TASK_A"
echo ""

# Test 2: Create Task B (blocked by A)
echo "2. Creating Task B (blocked by A)..."
TASK_B=$(curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 2,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"create_task\",
      \"arguments\": {
        \"title\": \"Task B\",
        \"details\": \"Blocked by Task A\",
        \"project_id\": \"cycle-test\",
        \"blocked_by\": [\"$TASK_A\"]
      }
    }
  }" | jq -r '.result.content[0].text | fromjson | .task.task_id')

echo "Created Task B: $TASK_B"
echo ""

# Test 3: Try to create Task C blocked by B - should work
echo "3. Creating Task C (blocked by B) - should work..."
TASK_C=$(curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 3,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"create_task\",
      \"arguments\": {
        \"title\": \"Task C\",
        \"details\": \"Blocked by Task B\",
        \"project_id\": \"cycle-test\",
        \"blocked_by\": [\"$TASK_B\"]
      }
    }
  }" | jq -r '.result.content[0].text | fromjson | .task.task_id')

echo "Created Task C: $TASK_C"
echo ""

# Test 4: Try to make Task A block C - should FAIL (circular dependency: A→B→C→A)
echo "4. Attempting to create circular dependency (A blocks C, where C→B→A)..."
RESULT=$(curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 4,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"update_task\",
      \"arguments\": {
        \"task_id\": \"$TASK_A\",
        \"blocked_by\": [\"$TASK_C\"]
      }
    }
  }")

SUCCESS=$(echo $RESULT | jq -r '.result.content[0].text | fromjson | .success')
ERROR=$(echo $RESULT | jq -r '.result.content[0].text | fromjson | .error // empty')

if [ "$SUCCESS" = "false" ]; then
  echo "✅ Circular dependency PREVENTED!"
  echo "   Error: $ERROR"
else
  echo "❌ FAILED: Circular dependency was NOT prevented!"
  echo "   Result: $RESULT"
fi
echo ""

# Test 5: Try to make Task C block itself - should FAIL (self-reference)
echo "5. Attempting self-reference (Task C blocks itself)..."
RESULT=$(curl -s -X POST $MCP_URL \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 5,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"update_task\",
      \"arguments\": {
        \"task_id\": \"$TASK_C\",
        \"blocked_by\": [\"$TASK_C\"]
      }
    }
  }")

SUCCESS=$(echo $RESULT | jq -r '.result.content[0].text | fromjson | .success')
ERROR=$(echo $RESULT | jq -r '.result.content[0].text | fromjson | .error // empty')

if [ "$SUCCESS" = "false" ]; then
  echo "✅ Self-reference PREVENTED!"
  echo "   Error: $ERROR"
else
  echo "❌ FAILED: Self-reference was NOT prevented!"
  echo "   Result: $RESULT"
fi
echo ""

echo "===== Circular Dependency Tests Complete ====="
echo ""
echo "Task IDs for reference:"
echo "  Task A: $TASK_A"
echo "  Task B: $TASK_B"
echo "  Task C: $TASK_C"
