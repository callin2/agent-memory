#!/bin/bash
#
# Graph Edges System Test Script
#
# Tests the 6 MCP edge tools and agent coordination helpers.
# Requires: MCP server running on localhost:4000
#

set -e

MCP_URL="http://localhost:4000/mcp"
MCP_AUTH="test-mcp-token"
TENANT="test-edges-$(date +%s)"

echo "================================"
echo "Graph Edges System Test Suite"
echo "================================"
echo "Tenant: $TENANT"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to call MCP tools
call_mcp() {
  local tool_name=$1
  local args=$2

  curl -s -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MCP_AUTH" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": $(date +%s%N),
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"$tool_name\",
        \"arguments\": $args
      }
    }"
}

# Parse JSON response
parse_response() {
  echo "$1" | jq -r '.result.content[0].text' | jq -r '.success // false'
}

parse_message() {
  echo "$1" | jq -r '.result.content[0].text' | jq -r '.message // .error // "Unknown error"'
}

# ============================================================================
# Test Results Tracking
# ============================================================================

TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
  local test_name=$1
  local result=$2

  if [ "$result" = "true" ]; then
    echo -e "${GREEN}✓${NC} $test_name"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $test_name"
    ((TESTS_FAILED++))
  fi
}

# ============================================================================
# Setup: Create Test Nodes
# ============================================================================

echo "Setup: Creating test nodes..."

# Create project knowledge note
PROJECT_RESPONSE=$(call_mcp "create_knowledge_note" "{\"text\": \"# Test Project\n\nThis is a test project for edges.\", \"tenant_id\": \"$TENANT\"}")
PROJECT_NODE_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.result.content[0].text' | jq -r '.node_id')

# Create task knowledge notes
TASK1_RESPONSE=$(call_mcp "create_knowledge_note" "{\"text\": \"# Task 1\n\nDatabase schema\", \"tenant_id\": \"$TENANT\"}")
TASK1_NODE_ID=$(echo "$TASK1_RESPONSE" | jq -r '.result.content[0].text' | jq -r '.node_id')

TASK2_RESPONSE=$(call_mcp "create_knowledge_note" "{\"text\": \"# Task 2\n\nBackend API\", \"tenant_id\": \"$TENANT\"}")
TASK2_NODE_ID=$(echo "$TASK2_RESPONSE" | jq -r '.result.content[0].text' | jq -r '.node_id')

TASK3_RESPONSE=$(call_mcp "create_knowledge_note" "{\"text\": \"# Task 3\n\nFrontend UI\", \"tenant_id\": \"$TENANT\"}")
TASK3_NODE_ID=$(echo "$TASK3_RESPONSE" | jq -r '.result.content[0].text' | jq -r '.node_id')

# Create findings note
FINDINGS_RESPONSE=$(call_mcp "create_knowledge_note" "{\"text\": \"# Findings\n\nImplementation complete\", \"tenant_id\": \"$TENANT\"}")
FINDINGS_NODE_ID=$(echo "$FINDINGS_RESPONSE" | jq -r '.result.content[0].text' | jq -r '.node_id')

echo "Project: $PROJECT_NODE_ID"
echo "Tasks: $TASK1_NODE_ID, $TASK2_NODE_ID, $TASK3_NODE_ID"
echo "Findings: $FINDINGS_NODE_ID"
echo ""

# Store created edge IDs for cleanup
EDGE_IDS=()

# ============================================================================
# Phase 1: MCP Tool Tests
# ============================================================================

echo "================================"
echo "Phase 1: MCP Tool Tests"
echo "================================"
echo ""

# Test 1: create_edge (parent_of)
echo "Test 1: Create parent_of relationship"
RESPONSE=$(call_mcp "create_edge" "{\"from_node_id\": \"$PROJECT_NODE_ID\", \"to_node_id\": \"$TASK1_NODE_ID\", \"type\": \"parent_of\", \"properties\": {\"status\": \"todo\"}, \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
EDGE_ID=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.edge.edge_id')
EDGE_IDS+=("$EDGE_ID")
test_result "create_edge (parent_of)" "$SUCCESS"

# Test 2: create_edge (parent_of) for task 2
RESPONSE=$(call_mcp "create_edge" "{\"from_node_id\": \"$PROJECT_NODE_ID\", \"to_node_id\": \"$TASK2_NODE_ID\", \"type\": \"parent_of\", \"properties\": {\"status\": \"todo\"}, \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
EDGE_ID=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.edge.edge_id')
EDGE_IDS+=("$EDGE_ID")
test_result "create_edge (parent_of task 2)" "$SUCCESS"

# Test 3: create_edge (parent_of) for task 3
RESPONSE=$(call_mcp "create_edge" "{\"from_node_id\": \"$PROJECT_NODE_ID\", \"to_node_id\": \"$TASK3_NODE_ID\", \"type\": \"parent_of\", \"properties\": {\"status\": \"todo\"}, \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
EDGE_ID=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.edge.edge_id')
EDGE_IDS+=("$EDGE_ID")
test_result "create_edge (parent_of task 3)" "$SUCCESS"

# Test 4: create_edge (depends_on)
echo "Test 4: Create depends_on relationship"
RESPONSE=$(call_mcp "create_edge" "{\"from_node_id\": \"$TASK2_NODE_ID\", \"to_node_id\": \"$TASK1_NODE_ID\", \"type\": \"depends_on\", \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
EDGE_ID=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.edge.edge_id')
EDGE_IDS+=("$EDGE_ID")
test_result "create_edge (depends_on)" "$SUCCESS"

# Test 5: create_edge (depends_on) for frontend
RESPONSE=$(call_mcp "create_edge" "{\"from_node_id\": \"$TASK3_NODE_ID\", \"to_node_id\": \"$TASK2_NODE_ID\", \"type\": \"depends_on\", \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
EDGE_ID=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.edge.edge_id')
EDGE_IDS+=("$EDGE_ID")
test_result "create_edge (depends_on for frontend)" "$SUCCESS"

# Test 6: get_edges (outgoing)
echo "Test 6: Get edges (outgoing)"
RESPONSE=$(call_mcp "get_edges" "{\"node_id\": \"$PROJECT_NODE_ID\", \"direction\": \"outgoing\", \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
COUNT=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.count // 0')
if [ "$SUCCESS" = "true" ] && [ "$COUNT" -ge 3 ]; then
  test_result "get_edges (outgoing)" "true"
else
  test_result "get_edges (outgoing)" "false"
fi

# Test 7: get_edges (incoming)
echo "Test 7: Get edges (incoming)"
RESPONSE=$(call_mcp "get_edges" "{\"node_id\": \"$TASK1_NODE_ID\", \"direction\": \"incoming\", \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
test_result "get_edges (incoming)" "$SUCCESS"

# Test 8: traverse
echo "Test 8: Traverse graph"
RESPONSE=$(call_mcp "traverse" "{\"node_id\": \"$PROJECT_NODE_ID\", \"type\": \"parent_of\", \"direction\": \"outgoing\", \"depth\": 1, \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
FOUND=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.total_found // 0')
if [ "$SUCCESS" = "true" ] && [ "$FOUND" -ge 3 ]; then
  test_result "traverse (depth 1, found $FOUND tasks)" "true"
else
  test_result "traverse (depth 1)" "false"
fi

# Test 9: update_edge_properties
echo "Test 9: Update edge properties"
RESPONSE=$(call_mcp "update_edge_properties" "{\"edge_id\": \"${EDGE_IDS[0]}\", \"properties\": {\"status\": \"doing\", \"started_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}, \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
test_result "update_edge_properties (status → doing)" "$SUCCESS"

# Test 10: get_project_tasks
echo "Test 10: Get Kanban board"
RESPONSE=$(call_mcp "get_project_tasks" "{\"project_node_id\": \"$PROJECT_NODE_ID\", \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
TOTAL=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.total // 0')
if [ "$SUCCESS" = "true" ] && [ "$TOTAL" -ge 3 ]; then
  test_result "get_project_tasks (Kanban board, $TOTAL tasks)" "true"
else
  test_result "get_project_tasks" "false"
fi

# Test 11: create_edge (created_by)
echo "Test 11: Create created_by relationship"
RESPONSE=$(call_mcp "create_edge" "{\"from_node_id\": \"$TASK1_NODE_ID\", \"to_node_id\": \"$FINDINGS_NODE_ID\", \"type\": \"created_by\", \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
EDGE_ID=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.edge.edge_id')
EDGE_IDS+=("$EDGE_ID")
test_result "create_edge (created_by)" "$SUCCESS"

# Test 12: traverse (multi-level)
echo "Test 12: Traverse multi-level (depth 2)"
RESPONSE=$(call_mcp "traverse" "{\"node_id\": \"$PROJECT_NODE_ID\", \"type\": \"parent_of\", \"direction\": \"outgoing\", \"depth\": 2, \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
FOUND=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.total_found // 0')
if [ "$SUCCESS" = "true" ] && [ "$FOUND" -ge 4 ]; then
  test_result "traverse (depth 2, found $FOUND items)" "true"
else
  test_result "traverse (depth 2)" "false"
fi

# Test 13: Circular dependency prevention
echo "Test 13: Circular dependency detection"
# Try to create Task 1 → Task 2 when Task 2 → Task 1 already exists
RESPONSE=$(call_mcp "create_edge" "{\"from_node_id\": \"$TASK1_NODE_ID\", \"to_node_id\": \"$TASK2_NODE_ID\", \"type\": \"depends_on\", \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
MESSAGE=$(parse_message "$RESPONSE")
if [ "$SUCCESS" = "false" ] && [[ "$MESSAGE" =~ (circular|cycle|dependency) ]]; then
  test_result "Circular dependency PREVENTED" "true"
else
  test_result "Circular dependency detection" "false"
fi

# Test 14: delete_edge
echo "Test 14: Delete edge"
if [ ${#EDGE_IDS[@]} -gt 0 ]; then
  RESPONSE=$(call_mcp "delete_edge" "{\"edge_id\": \"${EDGE_IDS[-1]}\", \"tenant_id\": \"$TENANT\"}")
  SUCCESS=$(parse_response "$RESPONSE")
  test_result "delete_edge" "$SUCCESS"
  # Remove from cleanup list
  unset 'EDGE_IDS[-1]'
else
  echo -e "${YELLOW}⊘${NC} delete_edge (no edges to delete)"
fi

# ============================================================================
# Phase 2: Integration Tests
# ============================================================================

echo ""
echo "================================"
echo "Phase 2: Integration Tests"
echo "================================"
echo ""

# Test 15: Task lifecycle (todo → doing → done)
echo "Test 15: Complete task lifecycle"
# Get task edge
TASK_EDGE_RESPONSE=$(call_mcp "get_edges" "{\"node_id\": \"$TASK1_NODE_ID\", \"direction\": \"incoming\", \"type\": \"child_of\", \"tenant_id\": \"$TENANT\"}")
TASK_EDGE_ID=$(echo "$TASK_EDGE_RESPONSE" | jq -r '.result.content[0].text' | jq -r '.edges[0].edge_id')

# Start task
call_mcp "update_edge_properties" "{\"edge_id\": \"$TASK_EDGE_ID\", \"properties\": {\"status\": \"doing\"}, \"tenant_id\": \"$TENANT\"}" > /dev/null

# Complete task
RESPONSE=$(call_mcp "update_edge_properties" "{\"edge_id\": \"$TASK_EDGE_ID\", \"properties\": {\"status\": \"done\", \"completed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}, \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")

# Verify on Kanban board
BOARD_RESPONSE=$(call_mcp "get_project_tasks" "{\"project_node_id\": \"$PROJECT_NODE_ID\", \"status\": \"done\", \"tenant_id\": \"$TENANT\"}")
DONE_COUNT=$(echo "$BOARD_RESPONSE" | jq -r '.result.content[0].text' | jq -r '.done | length')
if [ "$SUCCESS" = "true" ] && [ "$DONE_COUNT" -ge 1 ]; then
  test_result "Task lifecycle (todo → doing → done)" "true"
else
  test_result "Task lifecycle" "false"
fi

# Test 16: Dependency chain traversal
echo "Test 16: Dependency chain (A → B → C)"
RESPONSE=$(call_mcp "traverse" "{\"node_id\": \"$TASK3_NODE_ID\", \"type\": \"depends_on\", \"direction\": \"outgoing\", \"depth\": 3, \"tenant_id\": \"$TENANT\"}")
SUCCESS=$(parse_response "$RESPONSE")
FOUND=$(echo "$RESPONSE" | jq -r '.result.content[0].text' | jq -r '.total_found // 0')
if [ "$SUCCESS" = "true" ] && [ "$FOUND" -ge 2 ]; then
  test_result "Dependency chain traversal (found $FOUND deps)" "true"
else
  test_result "Dependency chain traversal" "false"
fi

# ============================================================================
# Cleanup
# ============================================================================

echo ""
echo "================================"
echo "Cleanup"
echo "================================"
echo ""

echo "Cleaning up ${#EDGE_IDS[@]} edges..."
for EDGE_ID in "${EDGE_IDS[@]}"; do
  call_mcp "delete_edge" "{\"edge_id\": \"$EDGE_ID\", \"tenant_id\": \"$TENANT\"}" > /dev/null 2>&1
done

echo "Test nodes remain in tenant: $TENANT (for manual inspection)"
echo ""

# ============================================================================
# Results Summary
# ============================================================================

echo "================================"
echo "Results Summary"
echo "================================"
echo ""
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Failed:${NC} $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed! ✓${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed ✗${NC}"
  exit 1
fi
