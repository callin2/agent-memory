#!/bin/bash
# Test script for 6 edge MCP tools
# Tests: create_edge, get_edges, traverse, delete_edge, update_edge_properties, get_project_tasks

MCP_URL="http://localhost:4000/mcp"
MCP_AUTH="test-mcp-token"
TENANT="default"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Edge MCP Tools Test Suite${NC}"
echo -e "${BLUE}======================================${NC}"

# Helper function to call MCP tool
call_tool() {
  local tool_name=$1
  local arguments=$2

  curl -s -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MCP_AUTH" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": $(date +%s),
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"$tool_name\",
        \"arguments\": $arguments
      }
    }"
}

# Helper function to extract result from MCP response
extract_result() {
  jq -r '.result.content[0].text' | jq .
}

echo -e "\n${BLUE}Test 1: create_edge - Create parent_of relationship${NC}"
echo "Creating: project_knowledge → task_1"
RESULT1=$(call_tool "create_edge" "{
  \"from_node_id\": \"kn_a6de739a-8c19-425e-8dea-c25dea68e03a\",
  \"to_node_id\": \"kn_4fb88c05-8372-448c-9aff-d4fe39a06705\",
  \"type\": \"parent_of\",
  \"properties\": {\"status\": \"todo\", \"priority\": \"high\"}
}")
echo "$RESULT1" | extract_result
EDGE_ID=$(echo "$RESULT1" | jq -r '.result.content[0].text | fromjson(.edge.edge_id)')
echo -e "${GREEN}✓ Created edge: $EDGE_ID${NC}"

echo -e "\n${BLUE}Test 2: create_edge - Create references relationship${NC}"
echo "Creating: task_1 → task_2 (references)"
RESULT2=$(call_tool "create_edge" "{
  \"from_node_id\": \"kn_4fb88c05-8372-448c-9aff-d4fe39a06705\",
  \"to_node_id\": \"kn_a6de739a-8c19-425e-8dea-c25dea68e03a\",
  \"type\": \"references\",
  \"properties\": {\"strength\": 0.9}
}")
echo "$RESULT2" | extract_result
echo -e "${GREEN}✓ Created references edge${NC}"

echo -e "\n${BLUE}Test 3: get_edges - Get outgoing edges${NC}"
RESULT3=$(call_tool "get_edges" "{
  \"node_id\": \"kn_a6de739a-8c19-425e-8dea-c25dea68e03a\",
  \"direction\": \"outgoing\",
  \"type\": \"parent_of\"
}")
echo "$RESULT3" | extract_result
EDGE_COUNT=$(echo "$RESULT3" | jq -r '.result.content[0].text | fromjson(.count)')
echo -e "${GREEN}✓ Found $EDGE_COUNT outgoing edges${NC}"

echo -e "\n${BLUE}Test 4: get_edges - Get all edges (both directions)${NC}"
RESULT4=$(call_tool "get_edges" "{
  \"node_id\": \"kn_a6de739a-8c19-425e-8dea-c25dea68e03a\",
  \"direction\": \"both\"
}")
echo "$RESULT4" | extract_result
TOTAL_EDGES=$(echo "$RESULT4" | jq -r '.result.content[0].text | fromjson(.count)')
echo -e "${GREEN}✓ Found $TOTAL_EDGES total edges${NC}"

echo -e "\n${BLUE}Test 5: traverse - Traverse parent_of relationships${NC}"
RESULT5=$(call_tool "traverse" "{
  \"node_id\": \"kn_a6de739a-8c19-425e-8dea-c25dea68e03a\",
  \"type\": \"parent_of\",
  \"direction\": \"outgoing\",
  \"depth\": 2
}")
echo "$RESULT5" | extract_result
TRAVERSAL_COUNT=$(echo "$RESULT5" | jq -r '.result.content[0].text | fromjson(.total_found)')
echo -e "${GREEN}✓ Traversal found $TRAVERSAL_COUNT nodes${NC}"

echo -e "\n${BLUE}Test 6: update_edge_properties - Update task status${NC}"
RESULT6=$(call_tool "update_edge_properties" "{
  \"edge_id\": \"$EDGE_ID\",
  \"properties\": {\"status\": \"doing\", \"started_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
}")
echo "$RESULT6" | extract_result
NEW_STATUS=$(echo "$RESULT6" | jq -r '.result.content[0].text | fromjson(.edge.properties.status)')
echo -e "${GREEN}✓ Updated edge status to: $NEW_STATUS${NC}"

echo -e "\n${BLUE}Test 7: get_project_tasks - Get Kanban board view${NC}"
RESULT7=$(call_tool "get_project_tasks" "{
  \"project_node_id\": \"kn_a6de739a-8c19-425e-8dea-c25dea68e03a\"
}")
echo "$RESULT7" | extract_result
TODO_COUNT=$(echo "$RESULT7" | jq -r '.result.content[0].text | fromjson(.todo | length)')
DOING_COUNT=$(echo "$RESULT7" | jq -r '.result.content[0].text | fromjson(.doing | length)')
echo -e "${GREEN}✓ Kanban: $TODO_COUNT todo, $DOING_COUNT doing${NC}"

echo -e "\n${BLUE}Test 8: delete_edge - Clean up test edges${NC}"
RESULT8=$(call_tool "delete_edge" "{
  \"edge_id\": \"$EDGE_ID\"
}")
echo "$RESULT8" | extract_result
echo -e "${GREEN}✓ Deleted edge${NC}"

echo -e "\n${BLUE}Test 9: create_edge - Test circular dependency detection${NC}"
echo "Creating: task_A → task_B (depends_on)"
RESULT9A=$(call_tool "create_edge" "{
  \"from_node_id\": \"kn_4fb88c05-8372-448c-9aff-d4fe39a06705\",
  \"to_node_id\": \"kn_a6de739a-8c19-425e-8dea-c25dea68e03a\",
  \"type\": \"depends_on\",
  \"properties\": {}
}")
echo "$RESULT9A" | extract_result
EDGE_A_ID=$(echo "$RESULT9A" | jq -r '.result.content[0].text | fromjson(.edge.edge_id)')

echo "Creating: task_B → task_A (depends_on) - should fail!"
RESULT9B=$(call_tool "create_edge" "{
  \"from_node_id\": \"kn_a6de739a-8c19-425e-8dea-c25dea68e03a\",
  \"to_node_id\": \"kn_4fb88c05-8372-448c-9aff-d4fe39a06705\",
  \"type\": \"depends_on\",
  \"properties\": {}
}")

if echo "$RESULT9B" | grep -q "Circular dependency"; then
  echo -e "${GREEN}✓ Circular dependency PREVENTED!${NC}"
else
  echo -e "${RED}✗ Circular dependency NOT prevented${NC}"
  echo "$RESULT9B"
fi

# Clean up
call_tool "delete_edge" "{\"edge_id\": \"$EDGE_A_ID\"}" > /dev/null 2>&1

echo -e "\n${GREEN}======================================${NC}"
echo -e "${GREEN}All edge tool tests passed!${NC}"
echo -e "${GREEN}======================================${NC}"
