#!/usr/bin/env node

/**
 * Test MCP server authentication
 *
 * Tests:
 * 1. No Authorization header → 401
 * 2. Invalid Bearer token → 401
 * 3. Valid Bearer token → 200, tools listed
 */

const MCP_SERVER_URL = "http://localhost:4000/sse";
const VALID_TOKEN = "test-mcp-token";

async function testMCPAuth() {
  console.log("Testing MCP Server Authentication\n");

  // Test 1: No Authorization header
  console.log("Test 1: Request without Authorization header");
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
      }),
    });

    const result = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(result, null, 2));

    if (response.status === 401) {
      console.log("✅ PASS: Correctly rejected unauthorized request\n");
    } else {
      console.log("❌ FAIL: Should have returned 401\n");
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 2: Invalid Bearer token
  console.log("Test 2: Request with invalid Bearer token");
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer invalid-token-12345",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
      }),
    });

    const result = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(result, null, 2));

    if (response.status === 401) {
      console.log("✅ PASS: Correctly rejected invalid token\n");
    } else {
      console.log("❌ FAIL: Should have returned 401\n");
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 3: Valid Bearer token
  console.log("Test 3: Request with valid Bearer token");
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Authorization": `Bearer ${VALID_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
      }),
    });

    console.log(`Status: ${response.status}`);

    if (response.status === 200) {
      const result = await response.json();
      console.log(`Response:`, JSON.stringify(result, null, 2));
      console.log("✅ PASS: Successfully authenticated\n");
    } else {
      const result = await response.json();
      console.log(`Response:`, JSON.stringify(result, null, 2));
      console.log("❌ FAIL: Should have returned 200\n");
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 4: List tools with valid token
  console.log("Test 4: List tools with valid token");
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Authorization": `Bearer ${VALID_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/list",
        params: {},
      }),
    });

    console.log(`Status: ${response.status}`);

    if (response.status === 200) {
      const result = await response.json();
      console.log(`Available tools:`, result.result?.tools?.map(t => t.name).join(", "));
      console.log("✅ PASS: Successfully listed tools\n");
    } else {
      const result = await response.json();
      console.log(`Response:`, JSON.stringify(result, null, 2));
      console.log("❌ FAIL: Should have returned 200\n");
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  console.log("Authentication tests complete!");
}

testMCPAuth().catch(console.error);
