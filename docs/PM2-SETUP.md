# PM2 Setup Guide

## What is PM2?

PM2 is a production process manager for Node.js applications with:
- **Auto-restart** on crash
- **Cron scheduling** for background jobs
- **Log management**
- **Cluster mode** (multi-core)
- **Monitoring** & metrics
- **Zero-downtime reload**

## Installation

### Install PM2 Globally
```bash
npm install -g pm2
```

### Verify Installation
```bash
pm2 --version
# Should show: pm2@5.x.x
```

## Setup Thread's Memory System

### 1. Build the Project
```bash
npm run build
```

### 2. Start All Processes
```bash
npm run pm2:start
```

This starts:
- ✅ **thread-memory-api** - Main API server (always running)
- ✅ **consolidation-daily** - Runs at 2 AM UTC daily
- ✅ **consolidation-weekly** - Runs at 3 AM UTC on Sunday
- ✅ **consolidation-monthly** - Runs at 4 AM UTC on 1st of month
- ✅ **embedding-generator** - Runs every hour

### 3. Check Status
```bash
npm run pm2:status
# Or: pm2 status
```

Output:
```
┌─────┬────────────────────────────┬─────────────┬───────────┐
│ id  │ name                       │ status      │ cpu      │
├─────┼────────────────────────────┼─────────────┼───────────┤
│ 0   │ thread-memory-api          │ online      │ 0.1%     │
│ 1   │ consolidation-daily        │ stopped     │ 0%       │
│ 2   │ consolidation-weekly       │ stopped     │ 0%       │
│ 3   │ consolidation-monthly      │ stopped     │ 0%       │
│ 4   │ embedding-generator        │ stopped     │ 0%       │
└─────┴────────────────────────────┴─────────────┴───────────┘
```

**Note:** Consolidation jobs show "stopped" - that's normal! They run on schedule, not continuously.

## Common PM2 Commands

### View Logs
```bash
# All logs
npm run pm2:logs

# Specific app
pm2 logs thread-memory-api

# Last 100 lines
pm2 logs --lines 100

# Clear logs
pm2 flush
```

### Monitor in Real-time
```bash
npm run pm2:monit
```

### Restart All Apps
```bash
npm run pm2:restart
```

### Stop All Apps
```bash
npm run pm2:stop
```

### Delete All Apps
```bash
npm run pm2:delete
```

## Manually Trigger Consolidation

Want to test consolidation now instead of waiting for 2 AM?

```bash
# Daily consolidation
npm run build && CONSOLIDATION_TYPE=daily node dist/scripts/run-consolidation.js

# Weekly consolidation
CONSOLIDATION_TYPE=weekly node dist/scripts/run-consolidation.js

# Monthly consolidation
CONSOLIDATION_TYPE=monthly node dist/scripts/run-consolidation.js
```

## Manually Generate Embeddings

```bash
# Generate embeddings for 20 handoffs
npm run build && BATCH_SIZE=20 node dist/scripts/run-embeddings.js
```

## Log Files

Logs are stored in `./logs/`:

```
logs/
├── pm2-error.log                    # API server errors
├── pm2-out.log                      # API server output
├── consolidation-daily-error.log    # Daily consolidation errors
├── consolidation-daily-out.log      # Daily consolidation output
├── consolidation-weekly-error.log   # Weekly consolidation errors
├── consolidation-weekly-out.log     # Weekly consolidation output
├── consolidation-monthly-error.log  # Monthly consolidation errors
├── consolidation-monthly-out.log    # Monthly consolidation output
├── embedding-error.log              # Embedding generator errors
└── embedding-out.log                # Embedding generator output
```

## PM2 Persistence

### Save Process List
```bash
pm2 save
```

### Start on System Boot
```bash
pm2 startup
# Follow the instructions (copy-paste the command it gives you)
```

Now PM2 will auto-start when your server reboots!

## Troubleshooting

### Consolidation Didn't Run?
Check logs:
```bash
pm2 logs consolidation-daily --lines 50
```

### API Server Crashed?
```bash
# Check error logs
pm2 logs thread-memory-api --err

# Restart it
pm2 restart thread-memory-api
```

### Need to Update Code?
```bash
# 1. Build new version
npm run build

# 2. Zero-downtime reload
pm2 reload thread-memory-api

# 3. Or restart everything (brief downtime)
npm run pm2:restart
```

### Monitor Resources
```bash
pm2 monit
```

Shows CPU/memory usage for all processes.

## Cron Schedule Reference

| Job | Schedule | Description |
|-----|----------|-------------|
| consolidation-daily | `0 2 * * *` | 2:00 AM every day |
| consolidation-weekly | `0 3 * * 0` | 3:00 AM every Sunday |
| consolidation-monthly | `0 4 1 * *` | 4:00 AM on 1st of month |
| embedding-generator | `0 * * * *` | Every hour at :00 |

Cron format: `minute hour day month weekday`

## Environment Variables

PM2 reads from your `.env` file. Key variables:

```bash
# Database
PGHOST=localhost
PGPORT=5432
PGDATABASE=agent_memory_dev
PGUSER=agent_mem_dba
PGPASSWORD=your_password

# LLM (for consolidation)
LLM_PROVIDER=zai
LLM_MODEL=GLM-4.5-air
ZAI_API_KEY=your_api_key
ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4

# Embeddings (local API)
EMBEDDING_API_URL=http://172.30.1.23:1234/v1/embeddings
EMBEDDING_MODEL=text-embedding-qwen3-embedding-0.6b

# Consolidation
CONSOLIDATION_SCHEDULER_ENABLED=true
```

## Next Steps

1. **Build & Start:**
   ```bash
   npm run build
   npm run pm2:start
   ```

2. **Verify Status:**
   ```bash
   npm run pm2:status
   ```

3. **Check Logs:**
   ```bash
   npm run pm2:logs
   ```

4. **Save PM2 Config:**
   ```bash
   pm2 save
   pm2 startup
   ```

Done! Your memory system is now production-ready with PM2. 🚀
