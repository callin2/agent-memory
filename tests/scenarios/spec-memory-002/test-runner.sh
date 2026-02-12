#!/bin/bash
# SPEC-MEMORY-002 Test Runner
# Executes comprehensive testing for Memory Surgery & Capsule Transfer System

set -e

echo "================================"
echo "SPEC-MEMORY-002 Test Execution"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="${PGDATABASE:-agent_memory_dev}"
TEST_RESULTS_DIR=".test-results"
mkdir -p "$TEST_RESULTS_DIR"

echo "Database: $DB_NAME"
echo ""

# Pre-test setup
echo "1. Pre-test Setup..."
echo "   - Updating decisions table constraint..."
PGDATABASE="$DB_NAME" psql -c "ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_scope_check;" 2>/dev/null || true
PGDATABASE="$DB_NAME" psql -c "ALTER TABLE decisions ADD CONSTRAINT decisions_scope_check CHECK (scope = ANY (ARRAY['session'::text, 'user'::text, 'project'::text, 'policy'::text, 'global'::text]));" 2>/dev/null || echo "   Warning: Could not update constraint (may already exist)"
echo "   ✓ Setup complete"
echo ""

# Test categories
TEST_PASSED=0
TEST_FAILED=0
TEST_TOTAL=0

run_test_suite() {
    local suite_name="$1"
    local test_file="$2"
    local result_file="$TEST_RESULTS_DIR/${suite_name}.txt"

    echo "================================"
    echo "Running: $suite_name"
    echo "================================"

    if PGDATABASE="$DB_NAME" npm run test -- "$test_file" --reporter=verbose > "$result_file" 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}: $suite_name"
        TEST_PASSED=$((TEST_PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}: $suite_name"
        TEST_FAILED=$((TEST_FAILED + 1))
    fi
    TEST_TOTAL=$((TEST_TOTAL + 1))
    echo ""
}

# Run test suites
echo "2. Executing Test Suites..."
echo ""

# Unit Tests
run_test_suite "Unit Tests - SQL Functions" "tests/unit/memory/sql-functions.test.ts"

# Integration Tests
run_test_suite "Integration Tests - Capsule API" "tests/integration/memory/capsule-api.test.ts"
run_test_suite "Integration Tests - Memory Edit API" "tests/integration/memory/memory-edit-api.test.ts"

# Acceptance Tests
run_test_suite "Acceptance Tests - All Criteria" "tests/scenarios/spec-memory-002/acceptance-tests.test.ts"

# Generate summary report
echo "================================"
echo "Test Execution Summary"
echo "================================"
echo ""
echo "Database: $DB_NAME"
echo "Test Results: $TEST_RESULTS_DIR"
echo ""
echo "Total Test Suites: $TEST_TOTAL"
echo -e "${GREEN}Passed: $TEST_PASSED${NC}"
echo -e "${RED}Failed: $TEST_FAILED${NC}"
echo ""

# Calculate detailed results from output files
echo "Detailed Results:"
echo "----------------"

for result_file in "$TEST_RESULTS_DIR"/*.txt; do
    if [ -f "$result_file" ]; then
        echo ""
        echo "File: $(basename "$result_file")"

        # Extract pass/fail counts
        if grep -q "Test Files" "$result_file"; then
            grep "Test Files\|Tests " "$result_file" | tail -5
        fi
    fi
done

echo ""
echo "================================"
echo "Coverage Report"
echo "================================"
echo ""

# Run coverage
if PGDATABASE="$DB_NAME" npm run test -- --coverage --coverage.reporter=text --coverage.reporter=json 2>&1 | tee "$TEST_RESULTS_DIR/coverage.txt"; then
    echo "✓ Coverage report generated: $TEST_RESULTS_DIR/coverage.txt"
else
    echo "⚠ Coverage report had issues"
fi

echo ""
echo "================================"
echo "Test Artifacts"
echo "================================"
echo "Results directory: $TEST_RESULTS_DIR"
echo "  - Individual test results: *.txt"
echo "  - Coverage report: coverage.txt"
echo "  - Coverage JSON: coverage-final/coverage.json"
echo ""

# Exit with error code if any tests failed
if [ $TEST_FAILED -gt 0 ]; then
    echo -e "${RED}Some test suites failed. Check results in $TEST_RESULTS_DIR${NC}"
    exit 1
else
    echo -e "${GREEN}All test suites passed!${NC}"
    exit 0
fi
