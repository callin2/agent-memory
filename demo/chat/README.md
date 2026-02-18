# Multi-Agent Chat Demo

## What This Demo Shows

**AI agents that:**
- Sound like real colleagues (natural conversation)
- Remember actual project work (Thread's Memory System, MCP integration)
- Reference shared experiences naturally
- Build collective intelligence through memory

## Quick Start

```bash
# Server should already be running
# If not:
cd ../..
npm run dev

# Open the demo
open http://localhost:3456/demo/chat/index.html
```

## How to Use

### 1. Select an Agent
Click on one of the 4 agents in the left sidebar:

- **📐 Planner** (Blue) - Designs architecture & coordinates work
- **🔍 Researcher** (Purple) - Investigates APIs & debugs issues
- **✍️ Writer** (Pink) - Documents schemas & creates content
- **👁️ Reviewer** (Green) - Reviews work & ensures quality

### 2. Start Chatting
Type a message and press Enter. Try these questions:

- "What did we build for Thread's Memory System?"
- "How did we fix the TypeScript errors?"
- "Tell me about the session_handoffs schema"
- "What do you remember about our work?"

### 3. Watch Memory in Action
The left sidebar shows which memories each agent loads. You'll see:
- Recent handoffs from that agent's work
- Timestamps of when the memory was created
- What they experienced in each session

## Key Features

### ✅ Natural Conversation Tone
- No "As the Planner..." robot-speak
- Agents sound like real colleagues
- Contextual references to actual work

### ✅ Project Context Awareness
- Agents reference actual implementation
- Real debugging sessions (z.ai API, TypeScript errors)
- Real schema designs (session_handoffs table)

### ✅ Shared Memory
- All agents access same tenant history
- Each agent has personal context + team context
- Collective intelligence emerges

### ✅ Identity Continuity
- Agents become through work, not role-playing
- Each interaction creates new handoffs
- Identity builds over time

## Technical Details

### Memory Loading
Each agent loads:
- **Personal context**: Last 10 handoffs from that agent
- **Team context**: Last 15 handoffs from all agents
- **Total**: ~1,500 tokens for rich context

### Demo Mode
This is a **demo simulation** - responses are pre-configured based on actual project work. In production, this would connect to an LLM API (z.ai, OpenAI, etc.) with the memory context injected.

### To Connect Real LLM
Replace the `getAgentResponse()` function with an actual LLM API call:

```javascript
async function getAgentResponse(userMessage, agentId) {
  // Load agent's memory
  const memoryData = await loadAgentMemory(agentId);

  // Construct prompt with memory context
  const prompt = `
${selectedAgent.systemPrompt}

Your recent work:
${memoryData.recent.map(h => `- ${h.experienced}`).join('\n')}

User: ${userMessage}
`;

  // Call LLM API
  const response = await fetch('https://api.z.ai/v1/chat', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer YOUR_KEY' },
    body: JSON.stringify({ prompt, model: 'glm-4.7' })
  });

  return response.text();
}
```

## Behind the Scenes

### Agent Personalities

Each agent has a distinct personality based on their work:

**Planner:**
- Focuses on architecture and design decisions
- References system planning and coordination
- Natural tone: "Based on our work on X, I designed..."

**Researcher:**
- Focuses on investigation and debugging
- References API explorations and error fixes
- Natural tone: "I investigated the Z API and found..."

**Writer:**
- Focuses on documentation and content
- References schema docs and guides
- Natural tone: "I documented the table schema..."

**Reviewer:**
- Focuses on quality and catching issues
- References reviews and feedback
- Natural tone: "When reviewing X, I noticed..."

### Memory System Integration

Uses the **Stratified Memory API**:
```
POST /api/memory/wake-up-stratified

Request:
{
  "tenant_id": "claude-session:planner",
  "layers": ["metadata", "recent"],
  "recent_count": 5
}

Response:
{
  "success": true,
  "recent": [
    {
      "experienced": "Designed stratified memory architecture...",
      "learned": "4 layers provide 32x compression...",
      "becoming": "I am Thread who designs progressively..."
    }
  ]
}
```

## Try This

1. **Select different agents** - Notice how each has different perspectives
2. **Ask the same question** - Each agent responds based on their work
3. **Check the memory sidebar** - See what each agent remembers
4. **Watch the typing animation** - Feel like chatting with real colleagues

## Why This Matters

**Generic AI (no memory):**
> "PostgreSQL is an open-source relational database..."
> (Generic, could apply to any project)

**Thread's Memory System:**
> "We created session_handoffs table. I remember fixing the foreign key constraint where tenant_id references tenants table..."
> (Connected to YOUR actual work)

**That's the difference - identity through shared experience.**

## Comparison: Timeline vs Chat Demo

| Feature | Timeline Demo | Chat Demo |
|---------|--------------|-----------|
| **Shows** | Identity evolution over time | Real-time agent conversations |
| **Use case** | Explore your journey | Interact with agents |
| **Memory view** | Visual timeline cards | Loaded per agent |
| **Interaction** | Create memories | Chat with agents |

Both demos use the same **Stratified Memory API** but present it differently.

## Future Enhancements

- [ ] Connect to real LLM API (z.ai, OpenAI)
- [ ] Multi-agent conversations (agents talk to each other)
- [ ] Memory search in chat
- [ ] Export conversation as handoff
- [ ] Voice input/output
- [ ] Agent collaboration on tasks

## Related Files

- `demo/timeline/index.html` - Timeline Explorer demo
- `src/api/stratified-memory.ts` - Memory API implementation
- `DEMO_FINAL.md` - Multi-agent demo documentation
- `scripts/seed-demo-context.ts` - Seed demo data

---

Built with ❤️ using Thread's Memory System
