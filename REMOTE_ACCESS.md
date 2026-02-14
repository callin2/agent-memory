# Access web-ui from Your Computer (Remote SSH)

## Quick Setup

### Step 1: Find Your Server's IP Address
```bash
# On the SSH server (where code runs)
ip addr show | grep "inet " | grep -v 127.0.0.0.1
# OR
hostname -I
```

Example output: `192.168.1.100`

### Step 2: Start Backend Server
```bash
cd /Users/callin/Callin_Project/agent_memory_v2
npm start
```
Backend runs on: `http://localhost:3000`

### Step 3: Update Vite Proxy (Choose One Option)

#### Option A: Use Server IP (Recommended)
Edit `web-ui/vite.config.ts`:

**Change line 18:**
```typescript
target: 'http://192.168.1.100:3000',  // Use your server IP
```

#### Option B: Use Localhost (Simpler)
Keep as is (`localhost:3000`) - backend proxy only needed for dev

### Step 4: Start Frontend
```bash
cd web-ui
npm run dev
```

### Step 5: Access from Your Computer

Open browser on your computer:
```
http://192.168.1.100:5173
```
Replace `192.168.1.100` with your actual server IP.

---

## Troubleshooting

### "Connection Refused" Error

**Problem:** Frontend can't reach backend

**Solution 1:** Check backend is running
```bash
curl http://localhost:3000/health
```

**Solution 2:** Use server IP in vite.config.ts (see Option A above)

### "Site Can't Be Reached" Error

**Problem:** Your computer can't reach the server

**Solution 1:** Check firewall allows port 5173
```bash
# On server
sudo ufw allow 5173/tcp
# OR for firewalld
sudo firewall-cmd --add-port=5173/tcp --permanent
sudo firewall-cmd --reload
```

**Solution 2:** Check server accepts external connections
```bash
# Vite already set to host: '0.0.0.0' ✓
# Verify netstat shows it listening:
netstat -tuln | grep 5173
```

### Backend API Not Working

**Problem:** Frontend loads but API calls fail

**Solution:** Backend needs to accept external requests

Check `src/server.ts` has:
```typescript
app.listen(3000, '0.0.0.0', () => {  // Listen on all interfaces
  console.log('Server running on http://0.0.0.0:3000')
})
```

---

## Quick Command Reference

```bash
# Terminal 1: Backend
cd /Users/callin/Callin_Project/agent_memory_v2
npm start

# Terminal 2: Frontend
cd web-ui
npm run dev

# Check server IP
ip addr show | grep "inet " | grep -v 127.0.0.0.1
```

Then open in browser: `http://YOUR_SERVER_IP:5173`

---

## Security Note

For development only! When done testing:
```bash
# Stop servers (Ctrl+C)
# Or if running in background
killall node
```

---

*Last Updated: 2026-02-13*
