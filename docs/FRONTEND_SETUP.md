# Frontend Test Harness Configuration

## Summary of Changes

### 1. Backend Server Configuration (src/server.ts)

#### Added CORS Middleware
- Imported `cors` package
- Configured CORS with development-friendly origins:
  - `http://localhost:5173` (Vite default)
  - `http://localhost:3000` (Backend default)
  - `http://localhost:5174` (Alternative Vite port)
- Supports credentials and common HTTP methods

#### Added Static File Serving
- **Route**: `/test-harness`
- **Source**: `frontend/dist/` directory
- **Features**:
  - Serves static assets (JS, CSS, images)
  - SPA routing fallback (returns `index.html` for unmatched routes)
  - 1-hour cache for static files
  - Helpful error message when frontend is not built

### 2. Package Configuration (package.json)

#### Dependencies Added
- `cors@^2.8.6` - Cross-origin resource sharing middleware
- `@types/cors@^2.8.19` - TypeScript type definitions

#### NPM Scripts Added
```bash
npm run frontend:install    # Install frontend dependencies
npm run frontend:dev       # Start frontend dev server (Vite)
npm run frontend:build     # Build frontend for production
npm run frontend:serve      # Build frontend and start backend
npm run frontend:preview   # Preview production build locally
```

## Frontend Setup Instructions

### Option 1: Development Mode (Recommended)

**Step 1: Create Frontend Project**
```bash
cd /Users/callin/Callin_Project/agent_memory_v2
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 2: Configure Vite Proxy**

Create or edit `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
```

**Step 3: Run Development Servers**

Terminal 1 - Backend:
```bash
npm run dev
```

Terminal 2 - Frontend:
```bash
npm run frontend:dev
```

Access frontend at: http://localhost:5173
Access backend API at: http://localhost:3000

### Option 2: Production Build

**Step 1: Build Frontend**
```bash
cd frontend
npm run build
```

This creates `frontend/dist/` directory with:
- `index.html` - Entry point
- `assets/` - JS, CSS, and static files

**Step 2: Start Backend (Serves Frontend)**
```bash
npm run frontend:serve
```

Or separately:
```bash
npm run frontend:build
npm start
```

Access application at: http://localhost:3000/test-harness

## API Endpoints

### Backend API (http://localhost:3000)
- `GET /health` - Health check
- `GET /metrics` - Metrics endpoint
- `POST /api/v1/events` - Record events
- `GET /api/v1/events/:event_id` - Get event
- `POST /api/v1/acb/build` - Build ACB
- `GET /api/v1/chunks/:chunk_id` - Get chunk
- `GET /api/v1/artifacts/:artifact_id` - Get artifact
- `POST /api/v1/decisions` - Create decision
- `GET /api/v1/decisions` - Get decisions
- `POST /auth/login` - Login
- `POST /auth/register` - Register
- `POST /auth/refresh` - Refresh token
- `POST /auth/oauth/*` - OAuth endpoints

### Frontend Routes (http://localhost:3000/test-harness)
- `/test-harness` - Main test harness UI
- `/test-harness/*` - SPA routes (React Router, etc.)

## Directory Structure

```
agent_memory_v2/
├── src/
│   └── server.ts          # Backend server (with CORS and static serving)
├── frontend/              # Frontend project (Vite + React)
│   ├── src/
│   ├── dist/              # Build output (served by Express)
│   ├── vite.config.ts     # Vite configuration
│   └── package.json
├── package.json            # Backend dependencies and scripts
└── FRONTEND_SETUP.md      # This file
```

## Troubleshooting

### Frontend Not Found Error
If you see:
```json
{
  "error": "Frontend not built",
  "message": "Please run \"npm run frontend:build\" to build frontend"
}
```

**Solution**: Build the frontend
```bash
npm run frontend:build
```

### CORS Errors in Development
If you see CORS errors in browser console:

**Solution 1**: Ensure both servers are running
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run frontend:dev
```

**Solution 2**: Check Vite proxy configuration in `frontend/vite.config.ts`

### Port Already in Use
If you see "Port 3000 is already in use":

**Solution 1**: Find and kill the process
```bash
lsof -ti:3000 | xargs kill -9
```

**Solution 2**: Use different port
```bash
PORT=3001 npm run dev
```

### TypeScript Path Resolution Issues

The root `tsconfig.json` already has proper configuration:
- `moduleResolution: "NodeNext"` - Modern Node.js resolution
- `module: "NodeNext"` - ESM support
- Paths are resolved from `src/` directory

If frontend has path issues, ensure `frontend/tsconfig.json` extends root config or has its own proper configuration.

## Development Workflow

1. **Make changes to frontend**: Hot reload via Vite dev server
2. **Make changes to backend**: Restart dev server (`tsx watch` provides some auto-restart)
3. **Test integration**: Access http://localhost:5173 (dev) or http://localhost:3000/test-harness (production)
4. **Build for deployment**: `npm run frontend:build`

## Security Notes

- CORS is configured to allow development origins only
- In production, update CORS origins to your actual frontend domain
- Static files are cached for 1 hour (adjust `maxAge` in `src/server.ts` if needed)
- For production deployment, consider using CDN for static assets

## Next Steps

1. Create the frontend project with Vite
2. Configure Vite proxy for API calls
3. Build test harness UI components
4. Test API integration
5. Deploy with `npm run frontend:serve`

## Environment Variables

Backend (`.env`):
```bash
PORT=3000
NODE_ENV=development
PGDATABASE=agent_memory_dev
# ... other database config
```

Frontend (`frontend/.env.development`):
```bash
VITE_API_URL=http://localhost:3000
```

Frontend (`frontend/.env.production`):
```bash
VITE_API_URL=/api  # Uses same origin
```
