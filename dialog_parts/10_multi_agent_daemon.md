나의 말:
this memory system is not for only one agent, it serve multiple agent at same time. so daemon or service is suitable form. is THERE MCP work like this?

ChatGPT의 말:
Yes — a daemon/service memory system that serves multiple agents concurrently is a natural fit, and MCP can work in that shape, but the transport you choose matters.
Can MCP be a multi-agent shared daemon?
MCP in general
MCP defines a host ↔ client ↔ server architecture where servers expose tools/resources that AI apps can call. 
Concurrency depends on transport
Streamable HTTP transport: explicitly supports an MCP server running as an independent process handling multiple client connections (and optionally SSE). That’s the “daemon/shared service” shape you want. 
stdio transport: typically a 1:1 process connection pattern (a host spawns a server process and talks over stdio). It’s great locally, but it doesn’t naturally become a shared multi-client daemon without an external multiplexer. 
So: Yes, MCP can be used, and for a shared memory service you should target Streamable HTTP.
Practical caveat: “multi-client support” isn’t guaranteed in every SDK
In the MCP ecosystem, there have been discussions/issues about enhancing some server implementations to support multiple concurrent client connections cleanly. 
Also, questions around session isolation for a single deployed server instance show that you must design isolation yourself (tenant/session separation, per-client context boundaries). 
Meaning: MCP doesn’t automatically solve multi-tenant memory safety. Your service must.

Is MCP the right abstraction for “shared agent memory”?
MCP is primarily a way to expose tools and data access to agents. OpenAI’s docs also frame MCP servers as tool providers and mention practical issues like limiting exposed tools for cost/latency. 
That’s compatible with your memory service: your memory system becomes an MCP server that exposes tools like:
record_event
build_acb
get_chunk
get_handoff_packet
query_decisions
pin_memory
This fits MCP well.
(Also: OpenAI’s agents ecosystem explicitly mentions MCP support in their Agents SDK docs. )

What you must add to our spec for a multi-agent daemon
Your spec is close, but for “multiple agents at same time” you need 3 concrete protocol-level additions:
1) Session / tenant isolation (hard requirement)
Every API call must include:
tenant_id (or workspace_id)
session_id
agent_id
All stored artifacts must be keyed by these, and loading policies must prevent cross-tenant bleed.
This directly addresses the MCP session-isolation ambiguity. 

2) Concurrency control (append-only log + atomic writes)
For a shared daemon:
event append must be atomic
projector updates must be consistent under concurrent writes
The simplest approach (still zero-dep):
per-tenant event files (jsonl) rotated daily
append with OS atomic append semantics
projector uses a cursor (file + byte offset) per tenant
3) Transport choice: Streamable HTTP MCP server
Because you want multiple agents and likely multi-process clients, use streamable HTTP transport.
Direct answer to “is there MCP work like this?”
Yes:
MCP servers can be deployed as independent processes, and with Streamable HTTP they can handle multiple clients — which matches a shared memory daemon. 
But:
Some reference implementations historically assume simpler 1:1 patterns, and you must implement session isolation and concurrency boundaries yourself. 
If you want, next I can do a spec patch: “MCP-facing API surface for Memory Daemon v1” (tool names, request/response JSON shapes, required IDs, and the exact mapping to our internal Recorder/Projector/Orchestrator/ChunkStore).




출처

