# Production Deployment Guide

**Agent Memory System v2.0**
**Last Updated:** 2025-02-09

---

## Overview

This guide covers deploying the Agent Memory System to production with TLS/HTTPS, authentication, and load testing.

---

## Prerequisites

### Infrastructure Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB | 50 GB SSD |
| Database | PostgreSQL 15+ | PostgreSQL 15+ |
| Reverse Proxy | nginx 1.18+ | nginx 1.21+ |

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- k6 (for load testing)
- OpenSSL (for certificate generation)

---

## Step 1: TLS/HTTPS Setup

### 1.1 Generate Self-Signed Certificate (Development)

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Generate private key
openssl genrsa -out nginx/ssl/key.pem 2048

# Generate certificate
openssl req -new -key nginx/ssl/key.pem -out nginx/ssl/csr.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=memory-api.example.com"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -days 365 -in nginx/ssl/csr.pem \
  -signkey nginx/ssl/key.pem -out nginx/ssl/cert.pem

# Set permissions
chmod 600 nginx/ssl/key.pem
chmod 644 nginx/ssl/cert.pem
```

### 1.2 Production Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install -y certbot

# Obtain certificate (requires domain and public IP)
sudo certbot certonly --standalone \
  -d memory-api.example.com \
  --email admin@example.com \
  --agree-tos \
  --non-interactive

# Certificates will be saved to /etc/letsencrypt/live/memory-api.example.com/

# Copy to nginx directory
sudo cp /etc/letsencrypt/live/memory-api.example.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/memory-api.example.com/privkey.pem nginx/ssl/key.pem

# Set up auto-renewal with cron
sudo crontab -e

# Add this line:
0 0 * * * /usr/bin/certbot renew --quiet --post-hook "docker cp /etc/letsencrypt/live/memory-api.example.com/*.pem /path/to/nginx/ssl/ && docker kill -HUP nginx"
```

### 1.3 Update nginx Configuration

Edit `nginx/nginx.conf`:
```nginx
server_name memory-api.example.com;  # Change to your domain
```

---

## Step 2: Environment Configuration

### 2.1 Create Production .env File

```bash
cp .env.example .env.prod
```

Edit `.env.prod`:
```bash
# PostgreSQL
PGHOST=postgres
PGPORT=5432
PGDATABASE=agent_memory
PGUSER=memory
POSTGRES_PASSWORD=<strong-password-here>

# Connection Pool
PGPOOL_MAX=20
PGPOOL_MIN=5
PGIDLE_TIMEOUT=30000
PGCONNECTION_TIMEOUT=2000
PGMAX_LIFETIME=60000
PGSTATEMENT_TIMEOUT=30000
PGQUERY_TIMEOUT=30000

# Server
PORT=3000
NODE_ENV=production

# JWT Authentication
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_EXPIRES_IN=24h
JWT_ISSUER=agent-memory-system

# Security
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2.2 Generate Secure JWT Secret

```bash
openssl rand -base64 32
```

Use the output as `JWT_SECRET`.

---

## Step 3: Deploy with Docker Compose

### 3.1 Start Services

```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f memory-daemon
```

### 3.2 Initialize Database

```bash
# Connect to PostgreSQL container
docker-compose -f docker-compose.prod.yml exec postgres psql -U memory -d agent_memory

# Run schema
\i /docker-entrypoint-initdb.d/schema.sql

# Exit
\q
```

Or use the script:
```bash
docker-compose -f docker-compose.prod.yml exec -T memory-daemon npx ts-node src/db/schema.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U memory -d agent_memory
```

---

## Step 4: Verify Deployment

### 4.1 Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-02-09T10:00:00.000Z",
  "authenticated": false
}
```

### 4.2 HTTPS Health Check

```bash
curl -k https://your-domain.com/health
```

### 4.3 Test Authentication

```bash
# Register user
curl -k -X POST https://your-domain.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "SecurePass123!",
    "tenant_id": "production"
  }'

# Login
curl -k -X POST https://your-domain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "SecurePass123!",
    "tenant_id": "production"
  }'
```

---

## Step 5: Load Testing

### 5.1 Install k6

```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6
```

### 5.2 Run Load Tests

#### Smoke Test (1 user, 30s)

```bash
cd tests/load
./run-load-test.sh smoke
```

#### Basic Load Test (5-10 users)

```bash
./run-load-test.sh basic
```

#### Concurrent Agents Test (5-10-20 agents)

```bash
./run-load-test.sh concurrent
```

#### Stress Test (50 users, 5 minutes)

```bash
./run-load-test.sh stress
```

### 5.3 Load Test Interpretation

**Key Metrics:**
- `http_req_duration`: Response times
  - `p(95)`: 95th percentile latency (target: < 500ms)
  - `p(99)`: 99th percentile latency (target: < 1000ms)
- `http_req_failed`: Error rate (target: < 2%)

**Passing Thresholds:**
```
✓ http_req_duration{scenario:warmup}: p(95)<300 ✓
✓ http_req_duration{scenario:main}: p(95)<500 ✓
✓ http_req_duration{scenario:peak}: p(95)<500 ✓
✓ http_req_failed{scenario:warmup}: rate<0.01 ✓
✓ http_req_failed{scenario:main}: rate<0.02 ✓
```

---

## Step 6: Monitoring Setup

### 6.1 View Metrics

```bash
# Prometheus format
curl http://localhost:3000/metrics

# JSON format
curl http://localhost:3000/metrics/json | jq
```

### 6.2 Key Metrics to Monitor

```bash
# Request rate
curl http://localhost:3000/metrics | grep agent_memory_total_requests

# Latency
curl http://localhost:3000/metrics | grep agent_memory_latency_ms

# Errors
curl http://localhost:3000/metrics | grep agent_memory_failed_requests
```

### 6.3 Set up Prometheus (Optional)

Create `prometheus.yml`:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'agent-memory'
    static_configs:
      - targets: ['memory-daemon:3000']
```

Run Prometheus:
```bash
docker run -d \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

Access at http://localhost:9090

### 6.4 Set up Grafana (Optional)

```bash
docker run -d \
  -p 3001:3000 \
  grafana/grafana
```

Access at http://localhost:3001 (default: admin/admin)

Add Prometheus as data source and import dashboard.

---

## Step 7: Database Backup Setup

### 7.1 Automated Backup Script

```bash
#!/bin/bash
# backup.sh - Automated database backup

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Run backup
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dumpall -U memory > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### 7.2 Scheduled Backups

```bash
# Add to crontab (crontab -e)
0 2 * * * /path/to/backup.sh
```

---

## Step 8: Kubernetes Deployment (Optional)

### 8.1 Create Kubernetes Manifests

See `kubernetes/` directory for complete manifests.

### 8.2 Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace agent-memory

# Apply secrets
kubectl apply -f kubernetes/secrets.yaml

# Apply ConfigMaps
kubectl apply -f kubernetes/configmap.yaml

# Deploy
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml
kubectl apply -f kubernetes/ingress.yaml
```

### 8.3 Verify Deployment

```bash
kubectl get pods -n agent-memory
kubectl logs -f deployment/agent-memory-daemon -n agent-memory
```

---

## Security Checklist

### Before Going Live

- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET
- [ ] Configure TLS/HTTPS
- [ ] Enable firewall rules
- [ ] Configure rate limiting
- [ ] Set up database backups
- [ ] Enable audit logging
- [ ] Configure log aggregation
- [ ] Set up monitoring alerts
- [ ] Review security headers
- [ ] Test disaster recovery

---

## Performance Tuning

### Database

```sql
-- Tune PostgreSQL
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- Apply changes
SELECT pg_reload_conf();
```

### Connection Pool

Adjust in `.env.prod`:
```bash
PGPOOL_MIN=5              # Increase min connections
PGPOOL_MAX=50            # Increase max connections for high load
```

### Nginx

Adjust worker processes in `nginx.conf`:
```nginx
worker_processes auto;
worker_connections 2048;
```

---

## Troubleshooting

### Issue: High Latency (> 500ms)

**Check:**
```bash
# Check database connections
curl http://localhost:3000/metrics | grep pool

# Check slow queries
docker-compose logs postgres | grep "duration:"
```

**Fix:**
- Increase PGPOOL_MAX
- Add database indexes
- Check network latency

### Issue: Memory Leaks

**Check:**
```bash
docker stats
```

**Fix:**
- Restart daemon periodically
- Check for unhandled promises
- Monitor with heapdump

### Issue: Certificate Expired

**Check:**
```bash
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

**Fix:**
```bash
sudo certbot renew
docker-compose restart nginx
```

---

## Rolling Updates

### Update Application

```bash
# Pull new image
docker-compose -f docker-compose.prod.yml pull memory-daemon

# Update service (zero downtime)
docker-compose -f docker-compose.prod.yml up -d --force-recreate memory-daemon
```

### Database Migration

```bash
# Backup first
./backup.sh

# Run migration
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U memory -d agent_memory < migrations/001_add_new_table.sql

# Verify
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U memory -d agent_memory -c "\d users"
```

---

## Disaster Recovery

### Restore from Backup

```bash
# Stop application
docker-compose -f docker-compose.prod.yml stop memory-daemon

# Drop and recreate database
docker-compose -f docker-compose.prod.yml exec -T postgres dropdb -U memory agent_memory
docker-compose -f docker-compose.prod.yml exec -T postgres createdb -U memory agent_memory

# Restore from backup
gunzip -c /backups/postgres/backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker-compose -f docker-compose.prod.yml exec -T postgres psql -U memory -d agent_memory

# Restart application
docker-compose -f docker-compose.prod.yml start memory-daemon
```

---

## Support & Monitoring

### Health Check Endpoint

```bash
watch -n 5 'curl -s http://localhost:3000/health | jq'
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f memory-daemon
```

### Metrics Dashboard

Prometheus: http://localhost:9090
Grafana: http://localhost:3001

---

## Production Checklist

**After Deployment:**

- [ ] Health check returns 200
- [ ] HTTPS works correctly
- [ ] Authentication works
- [ ] Smoke test passes
- [ ] Load test passes (10+ agents)
- [ ] p95 latency < 500ms
- [ ] Error rate < 2%
- [ ] Database backups configured
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Rolling update tested

---

## Next Steps

After production deployment:

1. **Week 2-3:** Implement remaining acceptance scenarios (A7-A12)
2. **Week 3:** Set up Grafana dashboards
3. **Week 4:** Configure log aggregation (ELK/Loki)
4. **Week 5:** Penetration testing
5. **Week 6:** Performance tuning based on metrics

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Database Admin | [TODO] |
| DevOps | [TODO] |
| Security Team | [TODO] |

---

**Deployment Guide Last Updated:** 2025-02-09
**Version:** 1.0
