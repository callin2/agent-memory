# Local Network Access Guide

## Quick Setup

### 1. Start Backend Server

The server automatically binds to all network interfaces (`0.0.0.0`):

```bash
cd /Users/callin/Callin_Project/agent_memory_v2
npm run dev
```

The server will display:
```
Agent Memory System v2.0 running on port 3456

Endpoints:
  Health:   http://localhost:3456/health
  Metrics:  http://localhost:3456/metrics
  API:      http://localhost:3456/api/v1/
  Auth:     http://localhost:3456/auth/login

Local Network Access:
  Access from other devices using:
    http://192.168.1.100:3456
    http://10.0.0.5:3456
```

### 2. Find Your IP Address

```bash
npm run network:ips
```

### 3. Configure Frontend (for other devices)

**Option A: Same Machine (default)**
```bash
cd frontend
npm run dev
# Access at: http://localhost:5173
```

**Option B: From Other Devices**

1. Copy the IP address from the server output
2. Create `frontend/.env`:
   ```bash
   VITE_API_URL=http://192.168.1.100:3456
   VITE_WS_URL=ws://192.168.1.100:3456
   ```
3. Start frontend:
   ```bash
   cd frontend
   npm run dev
   # Access from device: http://192.168.1.100:5173
   ```

### 4. Test Harness Access

| Scenario | URL |
|----------|-----|
| Same machine, dev | http://localhost:5173 |
| Same machine, prod | http://localhost:3456/test-harness |
| Other device, dev | http://YOUR_IP:5173 |
| Other device, prod | http://YOUR_IP:3456/test-harness |

## Network Configuration

### Server (.env)

```bash
# Server Configuration
PORT=3456
HOST=0.0.0.0  # Bind to all interfaces
```

### Frontend (web-ui/.env)

```bash
# Same machine
VITE_API_URL=http://localhost:3456
VITE_WS_URL=ws://localhost:3456

# Other device
VITE_API_URL=http://192.168.1.100:3456
VITE_WS_URL=ws://192.168.1.100:3456
```

## Troubleshooting

### Can't access from other devices?

1. **Check firewall:**
   ```bash
   # macOS
   sudo pfctl -d all -e "pass in proto tcp from any to any port 3456"

   # Linux (ufw)
   sudo ufw allow 3456/tcp

   # Windows Firewall
   # Allow port 3456 in Windows Defender Firewall
   ```

2. **Verify server is listening:**
   ```bash
   lsof -i :3456
   # Should show: node *:3456 (LISTEN)
   ```

3. **Check device IP:**
   ```bash
   npm run network:ips
   ```

4. **Test from device:**
   ```bash
   curl http://YOUR_IP:3456/health
   # Should return: {"status":"ok"}
   ```

### CORS errors in browser?

The server allows these origins in development:
- `http://localhost:5173`
- `http://localhost:5456`
- `http://localhost:5174`
- All `192.168.x.x` IPs
- All `10.x.x.x` IPs
- All `172.16-31.x.x` IPs

If using a different subnet, update `src/server.ts` CORS configuration.

## Security Notes

⚠️ **Local network access is for development only**

- Production deployments should use reverse proxy (nginx, Apache)
- Use HTTPS in production (Let's Encrypt, self-signed cert)
- Configure proper CORS origins for production
- Use firewall rules to restrict access

## Example Network Topology

```
┌─────────────────────────────────────────┐
│         Your Local Network          │
│                                     │
│  ┌─────────────┐                 │
│  │   Server     │                 │
│  │  :3456      │                 │
│  │  0.0.0.0    │                 │
│  └─────┬───────┘                 │
│        │                           │
│        │ Wi-Fi/Ethernet            │
│   ┌────┴─────┐                      │
│   │          │                      │
│ ┌─┴──┐  ┌───┴───┐               │
│ │Laptop│  │Phone   │               │
│ │:5173│  │:5173   │               │
│ └─────┘  └────────┘               │
│                                     │
└─────────────────────────────────────────┘
```
