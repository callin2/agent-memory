# Monitoring Guide

Comprehensive monitoring setup for Thread's Memory System using Prometheus and Grafana.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Prometheus Setup](#prometheus-setup)
- [Grafana Setup](#grafana-setup)
- [Available Metrics](#available-metrics)
- [Alerting](#alerting)
- [Troubleshooting](#troubleshooting)

---

## Overview

Thread's Memory System exposes metrics in Prometheus format for production monitoring and alerting.

**Benefits:**
- Real-time visibility into system health
- Historical performance data
- Proactive alerting on issues
- Capacity planning insights

**What's Monitored:**
- System health and uptime
- HTTP request metrics (rate, latency, errors)
- Database connection pool
- Memory usage (heap, RSS, external)
- Business metrics (events, handoffs, decisions)
- Storage usage
- Consolidation job stats

---

## Quick Start

**Docker Compose (Fastest):**

```bash
# Create docker-compose.monitoring.yml
cat > docker-compose.monitoring.yml << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana-dashboard.json:/etc/grafana/provisioning/dashboards/agent-memory.json
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
EOF

# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin)
```

---

## Prometheus Setup

### Configuration

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'agent-memory'
    environment: 'production'

# Alertmanager configuration (optional)
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

# Load rules once and periodically evaluate them
rule_files:
  - 'alerts.yml'

# Scrape configurations
scrape_configs:
  # Agent Memory System
  - job_name: 'agent-memory'
    static_configs:
      - targets: ['localhost:3456']
        labels:
          service: 'agent-memory-api'
    metrics_path: '/metrics/prometheus'
    scrape_interval: 10s

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### Installation

**Ubuntu/Debian:**

```bash
# Download Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
cd prometheus-2.45.0.linux-amd64

# Copy configuration
cp monitoring/prometheus.yml prometheus.yml

# Create user and directories
sudo useradd --no-create-home --shell /bin/false prometheus
sudo mkdir -p /etc/prometheus /var/lib/prometheus
sudo chown prometheus:prometheus /etc/prometheus /var/lib/prometheus

# Copy binaries
sudo cp prometheus promtool /usr/local/bin/
sudo chown prometheus:prometheus /usr/local/bin/prometheus /usr/local/bin/promtool

# Copy configuration
sudo cp prometheus.yml /etc/prometheus/
sudo chown prometheus:prometheus /etc/prometheus/prometheus.yml

# Create systemd service
sudo nano /etc/systemd/system/prometheus.service
```

**Systemd Service (`/etc/systemd/system/prometheus.service`):**

```ini
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/usr/local/bin/prometheus \
    --config.file /etc/prometheus/prometheus.yml \
    --storage.tsdb.path /var/lib/prometheus \
    --web.console.templates=/etc/prometheus/consoles \
    --web.console.libraries=/etc/prometheus/console_libraries

[Install]
WantedBy=multi-user.target
```

```bash
# Start Prometheus
sudo systemctl daemon-reload
sudo systemctl enable prometheus
sudo systemctl start prometheus

# Verify
curl http://localhost:9090/-/healthy
```

---

## Grafana Setup

### Installation

**Ubuntu/Debian:**

```bash
# Add Grafana repository
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -

# Install Grafana
sudo apt-get update
sudo apt-get install -y grafana

# Start Grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server

# Access at http://localhost:3000 (admin/admin)
```

### Import Dashboard

1. **Create Data Source:**
   - Go to Configuration → Data Sources → Add data source
   - Name: Prometheus
   - Type: Prometheus
   - URL: http://localhost:9090
   - Click "Save & Test"

2. **Import Dashboard:**
   ```bash
   # Via Grafana UI:
   # Go to Dashboards → Import → Upload JSON file
   # Select monitoring/grafana-dashboard.json
   ```

   ```bash
   # Or via API:
   curl -X POST http://localhost:3000/api/dashboards/db \
     -H "Content-Type: application/json" \
     -u admin:admin \
     -d @monitoring/grafana-dashboard.json
   ```

3. **View Dashboard:**
   - Navigate to Dashboards → Thread's Memory System
   - You should see real-time metrics

---

## Available Metrics

### System Metrics

```promql
# System health
agent_memory_up

# Uptime
agent_memory_uptime_seconds

# Memory usage
agent_memory_memory_bytes{type="heap_used"}
agent_memory_memory_bytes{type="heap_total"}
agent_memory_memory_bytes{type="rss"}
agent_memory_memory_bytes{type="external"}
```

### HTTP Metrics

```promql
# Request rate
rate(agent_memory_http_requests_total[5m])

# Request duration percentiles
histogram_quantile(0.95, rate(agent_memory_http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.50, rate(agent_memory_http_request_duration_seconds_bucket[5m]))

# Request rate by endpoint
rate(agent_memory_http_requests_total{path="/api/v1/handoff"}[5m])
```

### Database Metrics

```promql
# Connection pool
agent_memory_db_pool_connections{state="total"}
agent_memory_db_pool_connections{state="idle"}
agent_memory_db_pool_connections{state="waiting"}

# Pool utilization
100 * (1 - (agent_memory_db_pool_connections{state="idle"} / agent_memory_db_pool_connections{state="total"}))
```

### Business Metrics

```promql
# Events
sum(agent_memory_events_total)
sum by (kind) (agent_memory_events_total)

# Handoffs
sum(agent_memory_handoffs_total{compression_level="all"})

# Decisions
sum(agent_memory_decisions_total{status="active"})

# Storage
agent_memory_storage_bytes{type="text"}

# Knowledge notes
agent_memory_knowledge_notes_total
```

---

## Alerting

### Alert Rules

Create `monitoring/alerts.yml`:

```yaml
groups:
  - name: agent_memory_alerts
    interval: 30s
    rules:
      # System is down
      - alert: AgentMemoryDown
        expr: agent_memory_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Agent Memory System is down"
          description: "Instance {{ $labels.instance }} is down"

      # High memory usage
      - alert: HighMemoryUsage
        expr: agent_memory_memory_bytes{type="heap_used"} / agent_memory_memory_bytes{type="heap_total"} > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}%"

      # Database pool exhausted
      - alert: DatabasePoolExhausted
        expr: agent_memory_db_pool_connections{state="waiting"} > 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool waiting"
          description: "{{ $value }} connections waiting for pool"

      # High error rate
      - alert: HighErrorRate
        expr: rate(agent_memory_http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High HTTP error rate"
          description: "Error rate is {{ $value }} req/s"

      # Storage growing rapidly
      - alert: RapidStorageGrowth
        expr: rate(agent_memory_storage_bytes[1h]) > 1000000
        for: 10m
        labels:
          severity: info
        annotations:
          summary: "Storage growing rapidly"
          description: "Storage growing at {{ $value }} bytes/sec"
```

### Alertmanager Setup (Optional)

For email/Slack alerts:

```bash
# Download Alertmanager
wget https://github.com/prometheus/alertmanager/releases/download/v0.26.0/alertmanager-0.26.0.linux-amd64.tar.gz
tar xvfz alertmanager-0.26.0.linux-amd64.tar.gz
cd alertmanager-0.26.0.linux-amd64

# Create configuration
cat > alertmanager.yml << 'EOF'
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'

  routes:
    - match:
        severity: critical
      receiver: 'critical'

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:8001/webhook'

  - name: 'critical'
    email_configs:
      - to: 'alerts@example.com'
        from: 'alertmanager@example.com'
        smarthost: 'smtp.example.com:587'
        auth_username: 'alertmanager@example.com'
        auth_password: 'password'
```

---

## Troubleshooting

### Prometheus Not Scraping

**Problem:** Prometheus shows "up" metric as 0

**Solutions:**
1. Check if agent-memory is running:
   ```bash
   curl http://localhost:3456/health
   ```

2. Verify metrics endpoint:
   ```bash
   curl http://localhost:3456/metrics/prometheus
   ```

3. Check Prometheus configuration:
   ```bash
   promtool check config /etc/prometheus/prometheus.yml
   ```

4. Check Prometheus logs:
   ```bash
   sudo journalctl -u prometheus -f
   ```

### No Data in Grafana

**Problem:** Dashboard shows "No Data"

**Solutions:**
1. Verify Grafana can reach Prometheus:
   - Configuration → Data Sources → Prometheus → Save & Test

2. Check Prometheus has data:
   - Go to http://localhost:9090
   - Query: `agent_memory_up`

3. Verify time range in Grafana matches Prometheus data

### High Memory Usage Alerts

**Problem:** Frequent `HighMemoryUsage` alerts

**Investigation:**
```promql
# Check memory trend
rate(agent_memory_memory_bytes{type="heap_used"}[5m])

# Check for memory leaks
# Compare heap_used vs heap_total ratio
```

**Solutions:**
- Increase `NODE_OPTIONS=--max-old-space-size=4096`
- Check for memory leaks in code
- Review consolidation settings (may need more frequent consolidation)

### Database Pool Exhaustion

**Problem:** `DatabasePoolExhausted` alerts

**Investigation:**
```promql
# Check pool utilization
100 * (1 - (agent_memory_db_pool_connections{state="idle"} / agent_memory_db_pool_connections{state="total"}))

# Check wait times
rate(agent_memory_http_request_duration_seconds_sum[5m])
```

**Solutions:**
- Increase `PGPOOL_MAX` in `.env`
- Check for slow queries
- Add database read replicas
- Enable connection pooling (PgBouncer)

---

## Best Practices

1. **Retention:** Set appropriate data retention in Prometheus (default 15 days):
   ```yaml
   # prometheus.yml
   storage:
     tsdb:
       retention.time: 30d
   ```

2. **Scrape Interval:** Balance between granularity and storage:
   - Development: 30s
   - Production: 10-15s

3. **Alerting:** Start with critical alerts, add more as needed

4. **Dashboard Customization:** Clone and modify dashboard for your needs

5. **Monitoring Stack:** Run Prometheus and Grafana on separate servers for production

---

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard JSON Reference](https://grafana.com/docs/grafana/latest/dashboards/json-model/)

---

**Need help?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or open an issue.
