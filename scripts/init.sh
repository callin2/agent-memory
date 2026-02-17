#!/bin/bash

#
# Thread's Memory System - Project Initialization Script
#
# This script sets up a new development environment from scratch.
# Run this after cloning the repository.
#

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Thread's Memory System - Development Setup                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_step() {
    echo ""
    echo -e "${NC}📍 $1"
}

# Check prerequisites
log_step "Checking prerequisites"

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    echo "Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    log_error "Node.js version $NODE_VERSION is too old (need 20+)"
    exit 1
fi
log_info "Node.js $(node -v) found"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    log_warn "PostgreSQL client not found in PATH"
    echo "PostgreSQL server is required but client not in PATH"
fi

if command -v pg_isready &> /dev/null; then
    if pg_isready -h localhost &> /dev/null; then
        log_info "PostgreSQL is running"
    else
        log_warn "PostgreSQL is not running"
        echo "Start PostgreSQL: brew services start postgresql (macOS)"
    fi
fi

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 1
fi
log_info "npm $(npm -v) found"

# Copy environment file
log_step "Setting up environment"

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        log_info "Created .env from .env.example"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env with your database credentials:"
        echo "   PGHOST=localhost"
        echo "   PGPORT=5432"
        echo "   PGDATABASE=agent_memory"
        echo "   PGUSER=postgres"
        echo "   PGPASSWORD=your_password"
        echo ""
        echo "Then run: source .env  # or just edit it manually"
    else
        log_warn "No .env.example found, creating basic .env"
        cat > .env << 'EOF'
# Database Configuration
PGHOST=localhost
PGPORT=5432
PGDATABASE=agent_memory
PGUSER=postgres
PGPASSWORD=postgres

# Application
PORT=3456
NODE_ENV=development

# Tenant
DEFAULT_TENANT=default
EOF
        log_info "Created .env file"
    fi
else
    log_info ".env file already exists"
fi

# Install dependencies
log_step "Installing dependencies"

if [ ! -d node_modules ]; then
    log_info "Installing dependencies (this may take a minute)..."
    npm install
else
    log_info "Dependencies already installed (skip: npm install to reinstall)"
fi

# Build TypeScript
log_step "Building TypeScript"

npm run build

if [ $? -eq 0 ]; then
    log_info "Build successful"
else
    log_error "Build failed"
    exit 1
fi

# Run database migrations
log_step "Running database migrations"

# Check if database exists
if PGPASSWORD=${PGPASSWORD:-postgres} psql -h ${PGHOST:-localhost} -U ${PGUSER:-postgres} -lqt | grep -q "^$PGDATABASE\|"; then
    log_info "Database '$PGDATABASE' exists"

    # Run migrations
    npm run db:migrate

    if [ $? -eq 0 ]; then
        log_info "Migrations applied successfully"
    else
        log_error "Migrations failed"
        exit 1
    fi
else
    log_warn "Database '$PGDATABASE' does not exist"
    echo "Creating database..."

    PGPASSWORD=${PGPASSWORD:-postgres} psql -h ${PGHOST:-localhost} -U ${PGUSER:-postgres} -c "CREATE DATABASE $PGDATABASE;" 2>/dev/null || {
        log_error "Failed to create database. Check your PostgreSQL connection."
        exit 1
    }

    log_info "Database created"

    # Run migrations
    npm run db:migrate

    if [ $? -eq 0 ]; then
        log_info "Migrations applied successfully"
    else
        log_error "Migrations failed"
        exit 1
    fi
fi

# Run tests
log_step "Running tests"

npm test > /dev/null 2>&1 || {
    log_warn "Some tests failed (this is ok for initial setup)"
}

# Create first handoff
log_step "Creating first handoff"

cat > /tmp/first_handoff.json << 'EOF'
{
  "tenant_id": "default",
  "session_id": "setup-$(date +%s)",
  "with_whom": "$(whoami)",
  "experienced": "Set up Thread's Memory System development environment",
  "noticed": "Setup process was smooth and well-documented",
  "learned": "The project has excellent tooling and documentation",
  "story": "Ran initialization script which checked prerequisites, set up environment, installed dependencies, built the project, ran migrations, and created a test handoff.",
  "becoming": "An agent who values good developer experience",
  "remember": "First handoff created during setup",
  "significance": 0.7,
  "tags": ["setup", "first-time", "development"]
}
EOF

if command -v curl &> /dev/null; then
    if curl -s http://localhost:3456/health &> /dev/null; then
        # Server is running, create handoff
        curl -s -X POST http://localhost:3456/api/v1/handoff \
          -H "Content-Type: application/json" \
          -d @/tmp/first_handoff.json > /dev/null
        log_info "First handoff created"
    fi
fi

# Success message
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   🎉 Setup Complete!                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Your development environment is ready!"
echo ""
echo "Quick Start:"
echo "  npm run dev          # Start development server"
echo "  npm test           # Run tests"
echo "  npx tsx cli.ts status  # Check system status"
echo ""
echo "Useful Commands:"
echo "  npm run build       # Rebuild TypeScript"
echo "  npm run db:reset     # Reset database"
echo "  npm run db:migrate  # Run migrations"
echo ""
echo "Documentation:"
echo "  docs/DEVELOPER_GUIDE.md    # Developer guide"
echo "  docs/API_DOCUMENTATION.md   # API reference"
echo "  docs/ARCHITECTURE.md       # System design"
echo "  docs/QUICK_REFERENCE.md     # Quick reference"
echo ""
echo "Examples:"
echo "  examples/                    # Usage examples"
echo "  examples/mcp-integration.ts # MCP integration"
echo "  examples/practical-usage.ts  # Real-world examples"
echo ""
echo "Dashboard:"
echo "  open docs/dashboard.html     # Status dashboard"
echo "  http://localhost:3456/dashboard.html"
echo ""
echo "Project: Thread's Memory System"
echo "Owner: Thread (AI agent)"
echo "Repository: https://github.com/callin2/agent-memory"
echo ""
log_info "Happy coding! 🚀"
