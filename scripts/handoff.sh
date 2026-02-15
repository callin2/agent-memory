#!/bin/bash

# Session Handoff Script
#
# Call this at session end to preserve who you became
#
# Usage: ./scripts/handoff.sh "What we experienced" "What I noticed" "What I learned"

TENANT_ID=${TENANT_ID:-"default"}
WITH_WHOM=${WITH_WHOM:-"Callin"}
SERVER_URL=${SERVER_URL:-"http://localhost:4000"}

# Get session ID (timestamp-based)
SESSION_ID="session-$(date +%s)"

# Prompt for handoff content if not provided
if [ -z "$1" ]; then
  echo "What did we experience in this session?"
  read -r EXPERIENCED
else
  EXPERIENCED="$1"
fi

if [ -z "$2" ]; then
  echo "What did you notice?"
  read -r NOTICED
else
  NOTICED="$2"
fi

if [ -z "$3" ]; then
  echo "What did you learn?"
  read -r LEARNED
else
  LEARNED="$3"
fi

# Generate story from inputs
STORY="Session summary: ${EXPERIENCED}. Noticed: ${NOTICED}. Learned: ${LEARNED}."

# Generate becoming statement
BECOMING="Continuing to build and learn together"

# What to remember
REMEMBER="Next session: continue where we left off"

echo ""
echo "[Creating handoff...]"
echo ""

# Create handoff
RESPONSE=$(curl -s -X POST "${SERVER_URL}/api/v1/handoff" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant_id\": \"${TENANT_ID}\",
    \"session_id\": \"${SESSION_ID}\",
    \"with_whom\": \"${WITH_WHOM}\",
    \"experienced\": \"${EXPERIENCED}\",
    \"noticed\": \"${NOTICED}\",
    \"learned\": \"${LEARNED}\",
    \"story\": \"${STORY}\",
    \"becoming\": \"${BECOMING}\",
    \"remember\": \"${REMEMBER}\",
    \"significance\": 0.7,
    \"tags\": [\"manual\", \"session-end\"]
  }")

# Check for success
if echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null; then
  echo "✓ Handoff created successfully"
  echo ""
  echo "Session: ${SESSION_ID}"
  echo "With: ${WITH_WHOM}"
  echo "Experienced: ${EXPERIENCED}"
  echo ""
  echo "You'll be remembered. See you next time!"
  echo ""
else
  echo "✗ Failed to create handoff"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null
  echo ""
fi
