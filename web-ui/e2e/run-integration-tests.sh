#!/bin/bash

# Integration Test Runner for Agent Memory System
# Runs full stack tests: Frontend + Backend + Database

set -e

echo "🧪 Agent Memory System - Full Stack Integration Tests"
echo "======================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if PostgreSQL is running
echo "📊 Checking PostgreSQL connection..."
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
else
    echo -e "${RED}✗ PostgreSQL is not running${NC}"
    echo "Please start PostgreSQL first:"
    echo "  brew services start postgresql  # macOS"
    echo "  sudo systemctl start postgresql # Linux"
    exit 1
fi

# Check if database exists
echo ""
echo "🔍 Checking database..."
DB_EXISTS=$(psql -h localhost -U postgres -lqt | cut -d \| -f 1 | grep -w agent_memory_dev | wc -l)
if [ "$DB_EXISTS" -eq 1 ]; then
    echo -e "${GREEN}✓ Database 'agent_memory_dev' exists${NC}"
else
    echo -e "${YELLOW}⚠ Database 'agent_memory_dev' not found${NC}"
    echo "Creating database..."
    createdb -h localhost -U postgres agent_memory_dev
    echo -e "${GREEN}✓ Database created${NC}"
fi

# Install dependencies if needed
echo ""
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Install Playwright browsers if needed
echo ""
echo "🌐 Checking Playwright browsers..."
if ! npx playwright --version > /dev/null 2>&1; then
    echo "Installing Playwright browsers..."
    npx playwright install --with-deps
fi

# Build backend if needed
echo ""
echo "🔨 Checking backend build..."
if [ ! -d "../dist" ]; then
    echo "Building backend..."
    cd ..
    npm run build
    cd web-ui
fi

# Run tests
echo ""
echo "▶️  Running integration tests..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Choose test mode
if [ "$1" == "ui" ]; then
    echo "🎛️  Running tests with UI mode..."
    npx playwright test --ui
elif [ "$1" == "headed" ]; then
    echo "🖥️  Running tests in headed mode..."
    npx playwright test --headed
elif [ "$1" == "debug" ]; then
    echo "🐛 Running tests in debug mode..."
    npx playwright test --debug
else
    # Run all integration tests
    npx playwright test \
        integration.spec.ts \
        memory-retrieval-integration.spec.ts \
        visualization-metrics-integration.spec.ts \
        --reporter=list
fi

EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "📊 View detailed report:"
    echo "  npm run test:report"
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "📸 View screenshots and traces:"
    echo "  - Screenshots: web-ui/test-results/"
    echo "  - Traces: web-ui/test-results/"
    echo ""
    echo "📊 View HTML report:"
    echo "  npm run test:report"
fi

exit $EXIT_CODE
