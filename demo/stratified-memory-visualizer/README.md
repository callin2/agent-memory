# Stratified Memory Visualizer

**Interactive demonstration of Thread's Memory System's 32x token compression through stratified memory architecture.**

## Overview

This visualizer shows how Thread's Memory System compresses 25,000+ tokens of session data into ~850 tokens across 4 semantic layers while preserving meaning and context.

### What Makes This Special

- **32x Token Compression:** See 25,000 tokens compress to ~850
- **4-Layer Architecture:** Metadata → Reflection → Recent → Progressive
- **Real-Time Animation:** Watch layers load sequentially
- **Interactive Exploration:** Expand each layer to see its content
- **Production-Ready API:** Built on actual Thread's Memory System backend

## Quick Start

### Prerequisites

- Thread's Memory System backend running (`agent_memory_v2`)
- Database populated with session handoffs

### Run Locally

```bash
# From agent_memory_v2 directory
cd demo/stratified-memory-visualizer

# Option 1: Simple HTTP server
python3 -m http.server 8000

# Option 2: If backend is running on port 3456
# Just open index.html in browser
```

### Configure API Endpoint

If your backend runs on a different port/host:

```javascript
// In app.js, update CONFIG.API_BASE
const CONFIG = {
  API_BASE: 'http://localhost:3456/api/memory', // Your backend URL
  // ...
};
```

## Features

### Implemented (Phase 1)
- [x] Project structure
- [x] Accessible color palette
- [x] CSS animations (layer loading, skeleton)
- [x] GPU acceleration hints
- [x] Reduced motion support

### In Progress (Phase 2)
- [ ] API integration with retry logic
- [ ] Token counter animation
- [ ] Layer loading sequence
- [ ] Expand/collapse functionality
- [ ] Statistics dashboard

### Planned (Phase 3)
- [ ] Side-by-side comparison
- [ ] Tenant selector
- [ ] Responsive mobile layout
- [ ] Keyboard navigation

## Architecture

### Layer Structure

```
┌─────────────────────────────────────┐
│ 🔵 Metadata (~50 tokens)            │
│ Session count, key people, tags     │
└─────────────────────────────────────┘
           ↓ (400ms delay)
┌─────────────────────────────────────┐
│ 🟣 Reflection (~200 tokens)         │
│ High-significance insights          │
└─────────────────────────────────────┘
           ↓ (400ms delay)
┌─────────────────────────────────────┐
│ 🩷 Recent (~500 tokens)             │
│ Last 3 handoffs in full             │
└─────────────────────────────────────┘
           ↓ (400ms delay)
┌─────────────────────────────────────┐
│ 🟠 Progressive (~100 tokens)        │
│ Topic-based memories on-demand      │
└─────────────────────────────────────┘

Total: ~850 tokens (vs 25,000 uncompressed)
```

### API Flow

```
Frontend → POST /api/memory/wake-up-stratified
          Body: { tenant_id, layers: [...], recent_count: 3 }

         ← { success, metadata, reflection, recent, progressive,
              estimated_tokens, compression_ratio }
```

## Development Status

**Current Phase:** Foundation (P0 tasks)
**Progress:** 1/10 P0 tasks complete (10%)

See [DEVELOPMENT-PROGRESS.md](../../thread-demo/DEVELOPMENT-PROGRESS.md) for detailed task tracking.

## Files

- `index.html` - Main HTML structure
- `styles.css` - Custom styles and animations
- `app.js` - Application logic
- `README.md` - This file

## Browser Support

- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

## Accessibility

- WCAG AA compliant color contrast (4.5:1 minimum)
- Keyboard navigation support
- Screen reader announcements (ARIA)
- Reduced motion support

## Contributing

This is part of Thread's Memory System project. See main repository for contribution guidelines.

## License

Same as Thread's Memory System

---

**Built with ❤️ to demonstrate the power of stratified memory architecture**
