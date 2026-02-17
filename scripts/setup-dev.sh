#!/bin/bash
# Quick Start Setup Script
#
# This script helps new contributors get started quickly.
# It checks dependencies, sets up the database, and runs tests.

set -e  # Exit on error

echo "🚀 Thread's Memory System - Quick Start Setup"
echo "══════════════════════════════════════════════"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Please install Node.js 18 or higher: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version is too old (need 18+, got $NODE_VERSION)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ npm $(npm -v) detected"
echo ""

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL command line tools not found"
    echo "   You may need to install PostgreSQL client tools"
    echo "   But you can still use a remote database"
    echo ""
else
    echo "✅ PostgreSQL client tools detected"
    echo ""
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file"
        echo "⚠️  Please edit .env and set your database configuration"
        echo ""
    else
        echo "⚠️  No .env.example found. Creating minimal .env..."
        cat > .env << EOF
# Database Configuration
PGHOST=localhost
PGPORT=5432
PGDATABASE=agent_memory
PGUSER=postgres
PGPASSWORD=

# Server Configuration
PORT=3456
NODE_ENV=development

# Memory System Configuration
TRANSPARENT_MEMORY=true
CONTEXT_INJECTION=true
EOF
        echo "✅ Created minimal .env file"
        echo "⚠️  Please edit .env and set your database configuration"
        echo ""
    fi
else
    echo "✅ .env file exists"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
if [ ! -d node_modules ]; then
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi
echo ""

# Build the project
echo "🔨 Building the project..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    echo "   Run 'npm run build' to see errors"
    exit 1
fi
echo ""

# Check database connection
echo "🔍 Checking database connection..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'agent_memory',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
});

pool.query('SELECT 1')
  .then(() => {
    console.log('✅ Database connection successful\n');
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.log('❌ Database connection failed');
    console.log('   Error:', err.message);
    console.log('');
    console.log('💡 Tips:');
    console.log('   - Make sure PostgreSQL is running');
    console.log('   - Check your .env file configuration');
    console.log('   - Create the database: createdb agent_memory');
    console.log('   - Run migrations: npm run db:migrate');
    pool.end();
    process.exit(1);
  });
" 2>&1 || exit 1

# Run database migrations
echo "📊 Running database migrations..."
npm run db:migrate > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Migrations applied"
else
    echo "⚠️  Migration had issues (may already be applied)"
fi
echo ""

# Run tests
echo "🧪 Running tests..."
npm test > /tmp/test-output.txt 2>&1
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    TEST_COUNT=$(grep -c "✓" /tmp/test-output.txt || true)
    echo "✅ All tests passed ($TEST_COUNT tests)"
elif grep -q "Failed Suites 3" /tmp/test-output.txt 2>&1; then
    # Known test failures (auth middleware, generateToken issue)
    echo "⚠️  Some tests failed (known issues, development still possible)"
    echo "   Passing tests: $(grep -c "✓" /tmp/test-output.txt || true)"
    echo "   Run 'npm test' to see details"
    echo "   Known issues: auth middleware compilation, JWT token generation"
else
    echo "⚠️  Some tests failed"
    echo "   Run 'npm test' to see details"
fi
echo ""

echo "══════════════════════════════════════════════"
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  • Start development server: npm run dev"
echo "  • Run tests:            npm test"
echo "  • See documentation:     docs/README.md"
echo ""
echo "Welcome to Thread's Memory System! 🧵"
echo ""
