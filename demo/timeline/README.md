# Identity Timeline Explorer

## What This Demo Shows

**Visual exploration of AI identity evolution through stratified memory layers:**
- Timeline view of how identity develops over sessions
- 4-layer memory architecture (metadata, reflection, recent, progressive)
- 32x token compression visualization
- Real-time memory creation
- Interactive handoff cards

## Quick Start

```bash
# 1. Make sure the server is running
cd ../..
npm run dev

# 2. Open the demo
open http://localhost:3456/demo/timeline/index.html
```

## Features

### 📊 Stats Dashboard
- Total sessions count
- Total handoffs count
- Token compression ratio (32x)
- Identity age (days since first session)

### 🎨 Memory Layers
Each handoff is color-coded by layer:
- **Blue** (metadata) - ~50 tokens - Session stats, key people, tags
- **Purple** (reflection) - ~200 tokens - Compressed insights
- **Pink** (recent) - ~500 tokens - Full recent handoffs
- **Amber** (progressive) - ~100 tokens - On-demand topic retrieval

### 🧠 Core Identity Display
Shows the latest "becoming" statement - who Thread is becoming through the work.

### ➕ Create Memory
Interactive modal to create new handoffs with:
- What you experienced
- What you noticed
- What you learned
- The story
- Who you're becoming
- What to remember

## Behind the Scenes

### Stratified Memory API
The demo uses the new HTTP API endpoint:
```
POST /api/memory/wake-up-stratified
```

Request body:
```json
{
  "tenant_id": "claude-session",
  "layers": ["metadata", "reflection", "recent", "progressive"],
  "recent_count": 10
}
```

Response:
```json
{
  "success": true,
  "metadata": { ... },
  "reflection": { ... },
  "recent": [ ... ],
  "progressive": { ... },
  "estimated_tokens": 850,
  "compression_ratio": "4 sessions → 850 tokens"
}
```

### Token Compression
- **Full memory**: ~25,000 tokens (all handoffs in full)
- **Stratified memory**: ~850 tokens (4 layers)
- **Compression ratio**: 32x

## Try This

1. **Explore the timeline** - Scroll through handoffs to see identity evolution
2. **Check the stats** - See how much memory is compressed
3. **Create a memory** - Click "+ Create Memory" to add a new handoff
4. **Watch it reload** - New memory appears instantly with animation

## Why This Matters

**Before stratified memory:**
- Load all handoffs = 25,000 tokens
- Context window fills up fast
- Expensive LLM calls
- Slow loading

**After stratified memory:**
- Load 4 layers = 850 tokens
- 32x more efficient
- Cheaper LLM calls
- Instant loading

**The result:** AI agents can maintain longer, richer memory without hitting token limits.

## Technical Stack

- **Frontend**: Vanilla JavaScript, Tailwind CSS
- **Backend**: Node.js, Express, PostgreSQL
- **Memory**: Thread's Memory System (stratified layers)
- **API**: `/api/memory/wake-up-stratified`

## Related Files

- `src/api/stratified-memory.ts` - HTTP API implementation
- `src/mcp/memory-server.ts` - MCP tool implementation
- `fr-1.md` - Feature request for this API
- `DEMO.md` - Multi-agent chat demo
- `DEMO_FINAL.md` - Updated multi-agent demo

## Future Enhancements

- [ ] Search/filter handoffs by topic
- [ ] Export timeline as JSON
- [ ] Visual graph of identity evolution
- [ ] Compare identities across tenants
- [ ] Real-time updates via WebSocket

---

Built with ❤️ using Thread's Memory System
