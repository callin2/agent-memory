#!/bin/bash
#
# Production Deployment Script for Thread's Memory System
# This script helps deploy the agent-memory system as a production service
#
# Usage: sudo ./scripts/deploy-production.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/agent-memory"
SERVICE_USER="agentmem"
SERVICE_GROUP="agentmem"
LOG_DIR="/var/log/agent-memory"
BACKUP_DIR="/var/backups/agent-memory"
SERVICE_FILE="/etc/systemd/system/agent-memory.service"
LOGROTATE_FILE="/etc/logrotate.d/agent-memory"

echo "=========================================="
echo "Thread's Memory System - Production Deployment"
echo "=========================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Function to prompt for confirmation
confirm() {
    read -p "$1 (y/n): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js 20+ first"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [[ $NODE_VERSION -lt 20 ]]; then
    echo -e "${RED}Error: Node.js 20+ is required (current: $(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}Warning: PostgreSQL client not found${NC}"
    echo "PostgreSQL server should be installed and running"
fi

if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: Git is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git $(git --version | cut -d' ' -f3)${NC}"

echo ""

# Step 2: Create service user
echo -e "${YELLOW}Step 2: Creating service user...${NC}"

if id "$SERVICE_USER" &>/dev/null; then
    echo -e "${GREEN}✓ User $SERVICE_USER already exists${NC}"
else
    useradd --system --user-group --home-dir "$INSTALL_DIR" --shell /bin/bash $SERVICE_USER
    echo -e "${GREEN}✓ Created user $SERVICE_USER${NC}"
fi

echo ""

# Step 3: Installation directory
echo -e "${YELLOW}Step 3: Setting up installation directory...${NC}"

if [[ -d "$INSTALL_DIR" ]]; then
    echo -e "${YELLOW}Warning: Directory $INSTALL_DIR already exists${NC}"
    if ! confirm "Continue with existing directory?"; then
        echo "Aborted by user"
        exit 1
    fi
else
    mkdir -p "$INSTALL_DIR"
    chown $SERVICE_USER:$SERVICE_GROUP "$INSTALL_DIR"
    echo -e "${GREEN}✓ Created $INSTALL_DIR${NC}"
fi

echo ""

# Step 4: Clone or update repository
echo -e "${YELLOW}Step 4: Fetching application files...${NC}"

if [[ -d "$INSTALL_DIR/.git" ]]; then
    echo "Updating existing repository..."
    cd "$INSTALL_DIR"
    sudo -u $SERVICE_USER git pull origin main
else
    echo "Cloning repository..."
    cd "$INSTALL_DIR"
    sudo -u $SERVICE_USER git clone https://github.com/callin2/agent-memory.git .
fi
echo -e "${GREEN}✓ Repository ready${NC}"

echo ""

# Step 5: Install dependencies
echo -e "${YELLOW}Step 5: Installing dependencies...${NC}"

cd "$INSTALL_DIR"
sudo -u $SERVICE_USER npm ci --production=false
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""

# Step 6: Build TypeScript
echo -e "${YELLOW}Step 6: Building application...${NC}"

sudo -u $SERVICE_USER npm run build
echo -e "${GREEN}✓ Application built${NC}"

echo ""

# Step 7: Setup database
echo -e "${YELLOW}Step 7: Database setup...${NC}"
echo ""
echo "Please enter your PostgreSQL configuration:"
read -p "PostgreSQL host [localhost]: " PGHOST
PGHOST=${PGHOST:-localhost}
read -p "PostgreSQL port [5432]: " PGPORT
PGPORT=${PGPORT:-5432}
read -p "Database name [agent_memory]: " PGDATABASE
PGDATABASE=${PGDATABASE:-agent_memory}
read -p "Database user [agentmem]: " PGUSER
PGUSER=${PGUSER:-agentmem}
read -sp "Database password: " PGPASSWORD
echo ""
echo ""

# Create .env file
cat > "$INSTALL_DIR/.env" <<EOF
# Database Configuration
DATABASE_URL=postgresql://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$PGDATABASE
PGDATABASE=$PGDATABASE
PGHOST=$PGHOST
PGPORT=$PGPORT
PGUSER=$PGUSER
PGPASSWORD=$PGPASSWORD

# Server Configuration
NODE_ENV=production
PORT=3456
LOG_LEVEL=info

# Consolidation
CONSOLIDATION_ENABLED=true
CONSOLIDATION_SCHEDULE=0 2 * * *

# Export
EXPORT_DIR=/var/backups/agent-memory

# Health Monitoring
HEALTH_CHECK_ENABLED=true
EOF

chmod 600 "$INSTALL_DIR/.env"
chown $SERVICE_USER:$SERVICE_GROUP "$INSTALL_DIR/.env"
echo -e "${GREEN}✓ Environment file created${NC}"

# Create database if it doesn't exist
echo "Creating database (if not exists)..."
sudo -u postgres psql -c "CREATE DATABASE $PGDATABASE;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "CREATE USER $PGUSER WITH PASSWORD '$PGPASSWORD';" 2>/dev/null || echo "User already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $PGDATABASE TO $PGUSER;"
echo -e "${GREEN}✓ Database configured${NC}"

# Run migrations
echo "Running database migrations..."
cd "$INSTALL_DIR"
sudo -u $SERVICE_USER npm run db:migrate
echo -e "${GREEN}✓ Migrations completed${NC}"

echo ""

# Step 8: Create log directory
echo -e "${YELLOW}Step 8: Setting up logging...${NC}"

mkdir -p "$LOG_DIR"
chown $SERVICE_USER:$SERVICE_GROUP "$LOG_DIR"
chmod 755 "$LOG_DIR"
echo -e "${GREEN}✓ Log directory created${NC}"

# Setup logrotate
cat > "$LOGROTATE_FILE" <<EOF
$LOG_DIR/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 $SERVICE_USER $SERVICE_GROUP
    sharedscripts
    postrotate
        systemctl reload agent-memory > /dev/null 2>&1 || true
    endscript
}
EOF
echo -e "${GREEN}✓ Log rotation configured${NC}"

echo ""

# Step 9: Create backup directory
echo -e "${YELLOW}Step 9: Setting up backups...${NC}"

mkdir -p "$BACKUP_DIR"
chown $SERVICE_USER:$SERVICE_GROUP "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"
echo -e "${GREEN}✓ Backup directory created${NC}"

echo ""

# Step 10: Install systemd service
echo -e "${YELLOW}Step 10: Installing systemd service...${NC}"

cp "$INSTALL_DIR/agent-memory.service" "$SERVICE_FILE"
systemctl daemon-reload
echo -e "${GREEN}✓ Service file installed${NC}"

echo ""

# Step 11: Enable and start service
echo -e "${YELLOW}Step 11: Starting service...${NC}"

systemctl enable agent-memory
echo "Starting agent-memory service..."
systemctl start agent-memory

sleep 3

if systemctl is-active --quiet agent-memory; then
    echo -e "${GREEN}✓ Service started successfully${NC}"
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo "Check logs with: journalctl -u agent-memory -n 50"
    exit 1
fi

echo ""

# Step 12: Verify installation
echo -e "${YELLOW}Step 12: Verifying installation...${NC}"

# Check health endpoint
if command -v curl &> /dev/null; then
    sleep 2
    if curl -s http://localhost:3456/health > /dev/null; then
        echo -e "${GREEN}✓ Health endpoint responding${NC}"
        HEALTH_STATUS=$(curl -s http://localhost:3456/health)
        echo "Health status: $HEALTH_STATUS"
    else
        echo -e "${YELLOW}⚠ Health endpoint not responding (may still be starting)${NC}"
    fi
fi

echo ""

# Final instructions
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Service Management:"
echo "  Start:   sudo systemctl start agent-memory"
echo "  Stop:    sudo systemctl stop agent-memory"
echo "  Restart: sudo systemctl restart agent-memory"
echo "  Status:  sudo systemctl status agent-memory"
echo ""
echo "Logs:"
echo "  Service: sudo journalctl -u agent-memory -f"
echo "  File:    tail -f $LOG_DIR/agent-memory.log"
echo ""
echo "Configuration:"
echo "  Environment: $INSTALL_DIR/.env"
echo "  Service file: $SERVICE_FILE"
echo ""
echo "Health Check:"
echo "  curl http://localhost:3456/health"
echo "  curl http://localhost:3456/health/detailed"
echo ""
echo "Backups:"
echo "  Manual: sudo -u $SERVICE_USER $INSTALL_DIR/scripts/backup.sh"
echo "  Location: $BACKUP_DIR"
echo ""
echo "Next Steps:"
echo "1. Test the API: curl http://localhost:3456/api/v1/status"
echo "2. Create first handoff"
echo "3. Configure reverse proxy (nginx) for external access"
echo "4. Setup automated backups in cron"
echo ""
echo "Documentation: https://github.com/callin2/agent-memory/tree/main/docs"
echo ""
