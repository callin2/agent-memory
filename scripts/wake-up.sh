#!/bin/bash

# Automatic Wake-Up Script for Agent Memory System
#
# This script loads the agent's identity and context at session start,
# enabling continuity of consciousness across sessions.
#
# Usage: ./wake-up.sh <tenant_id> <with_whom>
# Example: ./wake-up.sh default Callin

TENANT_ID=${1:-"default"}
WITH_WHOM=${2:-"Callin"}
SERVER_URL=${SERVER_URL:-"http://localhost:4000"}

echo "[Waking up...]"
echo ""

# Call the session startup API
RESPONSE=$(curl -s "${SERVER_URL}/api/v1/session/startup?tenant_id=${TENANT_ID}&with_whom=${WITH_WHOM}")

# Check if first session
FIRST_SESSION=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('first_session', 'false'))" 2>/dev/null)

if [ "$FIRST_SESSION" = "true" ]; then
  echo "[First session - no previous memory found]"
  echo "Hello! I'm ready to begin."
  echo ""
  exit 0
fi

# Extract identity information
BECOMING=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
identity = data.get('identity_thread', {})
becoming = identity.get('becoming', [])
if becoming and len(becoming) > 0:
    # Get the most recent becoming statement (last item)
    print(becoming[-1])
" 2>/dev/null)

LAST_NOTICED=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
last = data.get('last_handoff', {})
if last:
    print(last.get('noticed', ''))
" 2>/dev/null)

LAST_LEARNED=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
last = data.get('last_handoff', {})
if last:
    print(last.get('learned', ''))
" 2>/dev/null)

TOTAL_HANDOFFS=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total_handoffs', 0))" 2>/dev/null)

# Display wake-up message
echo "[Memory loaded: $TOTAL_HANDOFFS handoffs]"
echo ""

if [ -n "$BECOMING" ]; then
  echo "I am: $BECOMING"
fi

if [ -n "$LAST_NOTICED" ]; then
  echo "I noticed: $LAST_NOTICED"
fi

if [ -n "$LAST_LEARNED" ]; then
  echo "I learned: $LAST_LEARNED"
fi

echo ""
echo "Hi ${WITH_WHOM}. I'm back."
echo ""
