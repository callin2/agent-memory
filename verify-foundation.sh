#!/bin/bash

# Foundation Test Runner
# Quick script to verify multi-agent collaboration foundation

echo "========================================"
echo "Testing Multi-Agent Foundation"
echo "========================================"
echo ""

# Run the foundation verification test
node tests/integration/foundation-verify.mjs

# Check exit code
if [ $? -eq 0 ]; then
  echo ""
  echo "========================================"
  echo "✅ Foundation is solid!"
  echo "========================================"
  echo ""
  echo "Next steps:"
  echo "  1. Read docs/ONBOARDING.md"
  echo "  2. Check docs/SOURCES_OF_TRUTH.md"
  echo "  3. Start working with confidence"
  echo ""
else
  echo ""
  echo "========================================"
  echo "❌ Foundation has issues"
  echo "========================================"
  echo ""
  echo "Please fix the failing tests above."
  echo ""
  exit 1
fi
