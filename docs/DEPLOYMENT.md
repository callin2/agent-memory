# Deployment Guide

Guide for deploying Thread's Memory System to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Deployment Options](#deployment-options)
- [Security Considerations](#security-considerations)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Scaling Strategies](#scaling-strategies)
- [Backup & Recovery](#backup--recovery)

---

## Prerequisites

### System Requirements

- **Node.js**: 20.x or higher
- **PostgreSQL**: 15.x or higher
- **RAM**: Minimum 2GB (4GB+ recommended)
- **Disk**: 10GB+ (depending on memory usage)
- **CPU**: 2+ cores recommended

### Network Requirements

- Port 3456 (default API port)
- PostgreSQL port (5432 by default)
- HTTPS termination (reverse proxy recommended)

---

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file:

```bash
# Server Configuration
NODE_ENV=production
PORT=3456
HOST=0.0.0.0

# Database Configuration
PGHOST=your-production-db-host
PGPORT=5432
PGDATABASE=agent_memory
PGUSER=agent_memory_user
PGPASSWORD=secure-random-password

# Connection Pooling
PGPOOL_MAX=20
PGPOOL_MIN=5
PGIDLE_TIMEOUT=30000
PGCONNECTION_TIMEOUT=2000
PGSTATEMENT_TIMEOUT=30000
PGQUERY_TIMEOUT=30000

# Feature Flags
TRANSPARENT_MEMORY=true
CONTEXT_INJECTION=true

# Consolidation Schedule
CONSOLIDATION_ENABLED=true
CONSOLIDATION_SCHEDULE=0 2 * * *
```

### Security Best Practices

1. **Never commit `.env` files** - Use environment variables or secret management
2. **Use strong passwords** - Minimum 32 characters for database passwords
3. **Rotate credentials** - Change passwords regularly (90 days recommended)
4. **Limit database access** - Use least-privilege database users
5. **Enable SSL** - Force SSL connections to PostgreSQL

---

## Database Setup

### Production Database Initialization

```bash
# Create production database
psql -U postgres -h localhost -c "CREATE DATABASE agent_memory;"

# Create dedicated user
psql -U postgres -h localhost -c "CREATE USER agent_memory_user WITH PASSWORD 'secure-password';"

# Grant privileges
psql -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE agent_memory TO agent_memory_user;"

# Run migrations
NODE_ENV=production npm run db:migrate
```

### Database Hardening

```sql
-- Remove public schema access
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Grant only necessary privileges
GRANT USAGE ON SCHEMA public TO agent_memory_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agent_memory_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agent_memory_user;

-- Enable row-level security (optional)
ALTER TABLE session_handoffs ENABLE ROW LEVEL SECURITY;
```

### Connection Pooling

Use PgBouncer for high-traffic deployments:

```ini
# pgbouncer.ini
[databases]
agent_memory = host=localhost port=5432 dbname=agent_memory

[pgbouncer]
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

---

## Deployment Options

### Option 1: Systemd Service (Recommended for Linux)

**Quick Deployment (Automated):**

Use the production deployment script for automated setup:

```bash
# Clone repository
git clone https://github.com/callin2/agent-memory.git /opt/agent-memory
cd /opt/agent-memory

# Run deployment script (interactive)
sudo ./scripts/deploy-production.sh
```

The deployment script will:
- Create service user (`agentmem`)
- Install dependencies and build
- Setup PostgreSQL database
- Configure environment variables
- Install systemd service
- Setup logging and log rotation
- Create backup directories
- Start the service

**Manual Deployment:**

If you prefer manual setup, use the provided systemd service file:

```bash
# Copy service file
sudo cp agent-memory.service /etc/systemd/system/

# Edit environment configuration
sudo nano /etc/systemd/system/agent-memory.service

# Reload and start
sudo systemctl daemon-reload
sudo systemctl enable agent-memory
sudo systemctl start agent-memory
```

**Service Management:**

```bash
# Check status
sudo systemctl status agent-memory

# View logs
sudo journalctl -u agent-memory -f

# Restart service
sudo systemctl restart agent-memory

# Stop service
sudo systemctl stop agent-memory
```

The service file includes:
- Automatic restart on failure
- Resource limits (memory, CPU, file handles)
- Security hardening (no new privileges, private tmp)
- Log rotation setup
- Health monitoring

### Option 2: Docker

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build and copy source
COPY . .
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S agentmemory && \
    adduser -S -u 1001 agentmemory
USER agentmemory

EXPOSE 3456

CMD ["node", "dist/server.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  agent-memory:
    build: .
    ports:
      - "3456:3456"
    environment:
      - NODE_ENV=production
      - PGHOST=postgres
      - PGDATABASE=agent_memory
      - PGUSER=agent_memory_user
      - PGPASSWORD=${PGPASSWORD}
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=agent_memory
      - POSTGRES_USER=agent_memory_user
      - POSTGRES_PASSWORD=${PGPASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

Deploy:
```bash
docker-compose up -d
```

### Option 3: Kubernetes

Create `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-memory
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-memory
  template:
    metadata:
      labels:
        app: agent-memory
    spec:
      containers:
      - name: agent-memory
        image: agent-memory:latest
        ports:
        - containerPort: 3456
        env:
        - name: NODE_ENV
          value: "production"
        - name: PGHOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3456
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3456
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: agent-memory-service
spec:
  selector:
    app: agent-memory
  ports:
  - port: 80
    targetPort: 3456
  type: LoadBalancer
```

---

## Security Considerations

### Reverse Proxy (Nginx)

A comprehensive nginx configuration is provided in the repository:

```bash
# Copy the nginx configuration
sudo cp nginx-example.conf /etc/nginx/sites-available/agent-memory

# Edit server_name and SSL certificate paths
sudo nano /etc/nginx/sites-available/agent-memory

# Enable the site
sudo ln -s /etc/nginx/sites-available/agent-memory /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

**The nginx configuration includes:**
- HTTP to HTTPS redirect
- SSL/TLS configuration
- Security headers
- Rate limiting for API endpoints
- Extended timeouts for export/consolidation
- Separate monitoring endpoint (internal access)
- Static asset caching
- Health check endpoint

**Obtain SSL certificates:**

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Certbot will auto-renew certificates
```

**Alternative: Basic Configuration**

For a simple setup, you can use this minimal configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3456;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Firewall Rules

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 80/tcp    # HTTP (redirect to HTTPS)
sudo ufw deny 3456/tcp   # Block direct API access
sudo ufw deny 5432/tcp   # Block direct database access

sudo ufw enable
```

### Database Security

1. **Use strong authentication** - md5 or scram-sha-256
2. **Enable SSL** - `sslmode=require` in connection string
3. **Network isolation** - Database on private network only
4. **Regular backups** - Automated daily backups
5. **Audit logging** - Enable PostgreSQL audit log

---

## Monitoring & Maintenance

### Health Checks

```bash
# Simple health check
curl https://memory.example.com/health

# Detailed metrics
curl https://memory.example.com/metrics?tenant_id=default
```

### Log Management

```bash
# Systemd logs
sudo journalctl -u agent-memory -f

# Docker logs
docker-compose logs -f

# Kubernetes logs
kubectl logs -f deployment/agent-memory
```

### Monitoring Dashboards

Key metrics to monitor:
- Request rate and latency
- Error rate
- Database connection pool usage
- Memory usage
- Disk I/O
- Consolidation job status

### Regular Maintenance

**Daily:**
- Check `/health` endpoint
- Review error logs
- Verify consolidation jobs running

**Weekly:**
- Review storage growth
- Check for slow queries
- Verify backup integrity

**Monthly:**
- Database maintenance (VACUUM ANALYZE)
- Review and rotate secrets
- Performance audit
- Security updates

---

## Scaling Strategies

### Vertical Scaling

For moderate loads (< 1000 requests/second):

- Increase server resources (CPU, RAM)
- Optimize database queries
- Increase connection pool size
- Enable query caching

### Horizontal Scaling

For high loads (> 1000 requests/second):

1. **Load Balancer** - Distribute requests across instances
2. **Multiple API Servers** - Stateless design enables easy scaling
3. **Database Replication** - Read replicas for query load
4. **Connection Pooling** - PgBouncer for efficient connections
5. **Caching Layer** - Redis for frequently accessed data

### Multi-Tenant Isolation

For hosting multiple organizations:

- Tenant-specific database schemas
- Per-tenant connection pools
- Resource quotas per tenant
- Isolated backup/restore

---

## Backup & Recovery

### Automated Backups

A comprehensive backup script is provided:

```bash
# Run backup manually
/opt/agent-memory/scripts/backup.sh

# Options
./scripts/backup.sh --database        # Database only
./scripts/backup.sh --exports         # Exports only
./scripts/backup.sh --tenant default  # Specific tenant
```

**Environment variables:**
```bash
export BACKUP_DIR=/var/backups/agent-memory
export RETENTION_DAYS=30
export API_BASE=http://localhost:3456
export DEFAULT_TENANT=default
```

**Setup cron jobs:**
```bash
# Edit crontab
sudo crontab -e

# Daily full backup at 2 AM
0 2 * * * /opt/agent-memory/scripts/backup.sh

# Hourly export backups (for recent data)
0 * * * * /opt/agent-memory/scripts/backup.sh --exports

# Weekly backup on Sunday at 3 AM
0 3 * * 0 /opt/agent-memory/scripts/backup.sh --database
```

**Backup contents:**
- PostgreSQL database dump (compressed)
- All tenant data exports (JSON format, compressed)
- Backup manifest with metadata
- Automatic cleanup of old backups (configurable retention)

### Recovery Procedure

```bash
# Stop the service
sudo systemctl stop agent-memory

# Restore database
gunzip < /backups/agent_memory_20260217_020000.sql.gz | \
  psql -h localhost -U postgres agent_memory

# Verify data
psql -h localhost -U postgres agent_memory -c "\dt"

# Start service
sudo systemctl start agent-memory
```

### Disaster Recovery

1. **Off-site backups** - Store backups in separate geographic region
2. **Backup testing** - Regularly test restore procedures
3. **Documentation** - Keep updated runbooks
4. **RTO/RPO** - Define recovery time and point objectives

---

## Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check logs
sudo journalctl -u agent-memory -n 50

# Verify database connection
psql -h $PGHOST -U $PGUSER -d $PGDATABASE
```

**High memory usage:**
```bash
# Check connection pool
curl http://localhost:3456/metrics

# Reduce pool size in .env
PGPOOL_MAX=10
PGPOOL_MIN=2
```

**Slow queries:**
```sql
-- Identify slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Add indexes as needed
CREATE INDEX idx_session_handoffs_tenant_created
ON session_handoffs(tenant_id, created_at DESC);
```

---

## Support

For deployment issues:
- GitHub Issues: https://github.com/callin2/agent-memory/issues
- Documentation: https://github.com/callin2/agent-memory/tree/main/docs

---

**Last Updated:** 2026-02-17
**Version:** 2.0.0
