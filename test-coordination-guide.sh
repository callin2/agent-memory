#!/bin/bash
# Test get_coordination_guide tool

echo "Testing get_coordination_guide tool..."

curl -X POST http://localhost:3456/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_coordination_guide",
      "arguments": {
        "format": "markdown"
      }
    }
  }' 2>/dev/null | jq .

echo ""
echo "Testing JSON format..."

curl -X POST http://localhost:3456/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_coordination_guide",
      "arguments": {
        "format": "json"
      }
    }
  }' 2>/dev/null | jq .
