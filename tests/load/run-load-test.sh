#!/bin/bash

# Load Test Runner Script for Agent Memory System
# Usage: ./run-load-test.sh [test-type]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_TYPE="${1:-basic}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Agent Memory System Load Test${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Base URL: $BASE_URL"
echo "Test Type: $TEST_TYPE"
echo ""

# Check if server is running
echo -e "${YELLOW}Checking if server is running...${NC}"
if ! curl -s -f "$BASE_URL/health" > /dev/null; then
    echo -e "${RED}Error: Server is not running at $BASE_URL${NC}"
    echo "Start the server first: npm run dev"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Install k6 if not installed
if ! command -v k6 &> /dev/null; then
    echo -e "${YELLOW}k6 not found. Installing...${NC}"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install k6
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install k6
    else
        echo -e "${RED}Error: Please install k6 manually${NC}"
        echo "Visit: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
fi

# Run different test types
case $TEST_TYPE in
    basic)
        echo -e "${GREEN}Running basic load test...${NC}"
        k6 run --env BASE_URL="$BASE_URL" tests/load/load-test.js
        ;;

    concurrent)
        echo -e "${GREEN}Running concurrent agents test (5-10-20 agents)...${NC}"
        k6 run --env BASE_URL="$BASE_URL" tests/load/concurrent-agents-test.js
        ;;

    smoke)
        echo -e "${GREEN}Running smoke test...${NC}"
        k6 run --env BASE_URL="$BASE_URL" --vus 1 --duration 30s tests/load/load-test.js
        ;;

    stress)
        echo -e "${GREEN}Running stress test...${NC}"
        k6 run --env BASE_URL="$BASE_URL" --vus 50 --duration 5m tests/load/load-test.js
        ;;

    *)
        echo -e "${YELLOW}Usage: ./run-load-test.sh [basic|concurrent|smoke|stress]${NC}"
        echo ""
        echo "Test types:"
        echo "  basic      - Basic load test (1->5->10 users)"
        echo "  concurrent - Concurrent agents test (5->10->20 agents)"
        echo "  smoke      - Quick smoke test (1 user, 30s)"
        echo "  stress     - Stress test (50 users, 5 minutes)"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Load Test Complete${NC}"
echo -e "${GREEN}========================================${NC}"
