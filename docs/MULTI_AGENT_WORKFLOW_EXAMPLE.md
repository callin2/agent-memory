# Multi-Agent Workflow Example

**Scenario**: Build a user authentication feature with 3 specialized agents working in parallel.

**Agents**: Database Agent, Backend Agent, Frontend Agent
**Timeline**: ~15 minutes
**Result**: Coordinated implementation without duplication

---

## Initial Setup (Main Session)

```typescript
// Create project knowledge
const project = await create_knowledge_note({
  text: `# Feature: OAuth2 User Authentication

**Goals**:
- Enable login with Google OAuth2
- Enable login with GitHub OAuth2
- Store user profile information

**Requirements**:
- Database: users table with OAuth credentials
- Backend: /auth/google, /auth/github endpoints
- Frontend: Login button + callback handlers

**Deadline**: 2026-02-25
`,
  tags: ["feature", "oauth2", "authentication"],
  project_path: "/Users/user/project"
});

// Create 3 tasks
const taskDatabase = await create_knowledge_note({
  text: `# Task: Database Schema

Create users table:
- id (UUID, primary key)
- oauth_provider (enum: google, github)
- oauth_id (text, unique)
- email (text, unique)
- name (text)
- avatar_url (text)
- created_at, updated_at

Add indexes on oauth_id and email.
`,
  tags: ["task", "database", "migration"]
});

const taskBackend = await create_knowledge_note({
  text: `# Task: Backend API

Implement OAuth endpoints:
- GET /auth/google - Redirect to Google OAuth
- GET /auth/github - Redirect to GitHub OAuth
- GET /auth/callback - Handle OAuth callback
- GET /auth/me - Get current user
- POST /auth/logout - Clear session

Use passport.js for OAuth flow.
Store session in JWT.
`,
  tags: ["task", "backend", "api", "oauth"]
});

const taskFrontend = await create_knowledge_note({
  text: `# Task: Frontend UI

Create login components:
- LoginButton.tsx - Google and GitHub login buttons
- CallbackHandler.tsx - Handle OAuth callback
- UserProfile.tsx - Display user info
- AuthContext.tsx - Provide auth state to app

Use React Context for auth state.
Style with Tailwind CSS.
`,
  tags: ["task", "frontend", "react", "ui"]
});

// Link tasks to project
for (const task of [taskDatabase, taskBackend, taskFrontend]) {
  await create_edge({
    from_node_id: project.node_id,
    to_node_id: task.node_id,
    type: "parent_of",
    properties: {
      status: "todo",
      priority: "high",
      created_at: new Date().toISOString()
    }
  });
}

// Create dependency: backend → database
// (Backend needs users table before implementing endpoints)
await create_edge({
  from_node_id: taskBackend.node_id,
  to_node_id: taskDatabase.node_id,
  type: "depends_on",
  properties: {
    reason: "Backend API needs users table schema first",
    blocker: true
  }
});

// Create dependency: frontend → backend
// (Frontend needs API endpoints before connecting)
await create_edge({
  from_node_id: taskFrontend.node_id,
  to_node_id: taskBackend.node_id,
  type: "depends_on",
  properties: {
    reason: "Frontend needs /auth endpoints before implementing UI",
    blocker: true
  }
});
```

**Result**: Project knowledge created with 3 tasks and 2 dependencies.

---

## Agent 1: Database Agent

### Initialization (on startup)
```typescript
async function databaseAgentInit() {
  const myTaskId = "kn_task_database_id";

  // 1. Find parent project
  const parentResult = await traverse({
    node_id: myTaskId,
    type: "child_of",
    direction: "incoming",
    depth: 1
  });
  const projectId = parentResult.root.node_id;

  // 2. Read project requirements
  const projectNode = await resolve_node(projectId);
  console.log("Project:", projectNode.content.text);

  // 3. Find sibling tasks
  const siblingsResult = await traverse({
    node_id: projectId,
    type: "parent_of",
    direction: "outgoing",
    depth: 1
  });
  console.log("Siblings:", siblingsResult.children.map(c => c.node.content.text));

  // 4. Check dependencies (I have none)
  const myDeps = await get_edges({
    node_id: myTaskId,
    direction: "outgoing",
    type: "depends_on"
  });
  console.log("My dependencies:", myDeps.edges.length); // 0

  // 5. Semantic search for existing database patterns
  const relatedWork = await semantic_search({
    query: "users table oauth database migration",
    project_path: "/Users/user/project",
    limit: 3
  });
  console.log("Related work:", relatedWork.map(r => r.content.text));

  // 6. Update my status to 'doing'
  const myEdge = await get_edges({
    node_id: myTaskId,
    direction: "incoming",
    type: "child_of"
  });
  await update_edge_properties({
    edge_id: myEdge.edges[0].edge_id,
    properties: {
      status: "doing",
      started_at: new Date().toISOString(),
      agent: "database-agent-1"
    }
  });

  return { projectNode, siblings: siblingsResult.children, relatedWork };
}
```

### Work
```typescript
// Create migration file
const migration = `
-- Migration: create users table for OAuth
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oauth_provider TEXT NOT NULL CHECK (oauth_provider IN ('google', 'github')),
  oauth_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(oauth_provider, oauth_id),
  UNIQUE(email)
);

CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);
CREATE INDEX idx_users_email ON users(email);
`;

// Create findings note
const findings = await create_knowledge_note({
  text: `# Database Implementation

**Created**: migration_001_users.sql

**Schema**: users table with OAuth fields

**Indexes**:
- idx_users_oauth (oauth_provider, oauth_id) - for OAuth lookups
- idx_users_email (email) - for email lookups

**Testing**: Verified unique constraints work correctly

**Next**: Backend agents can now use this table
`,
  tags: ["findings", "database", "migration", "implemented"],
  project_path: "/Users/user/project"
});

// Link task → findings
await create_edge({
  from_node_id: myTaskId,
  to_node_id: findings.node_id,
  type: "created_by",
  properties: {
    agent: "database-agent-1",
    completed_at: new Date().toISOString()
  }
});

// Mark task as done
await update_edge_properties({
  edge_id: myEdge.edges[0].edge_id,
  properties: {
    status: "done",
    completed_at: new Date().toISOString(),
    agent: "database-agent-1"
  }
});
```

**Result**: Database task complete. Migration created and documented.

---

## Agent 2: Backend Agent

### Initialization
```typescript
async function backendAgentInit() {
  const myTaskId = "kn_task_backend_id";

  // 1. Find parent and siblings
  const parentResult = await traverse({
    node_id: myTaskId,
    type: "child_of",
    direction: "incoming",
    depth: 1
  });
  const siblingsResult = await traverse({
    node_id: parentResult.root.node_id,
    type: "parent_of",
    direction: "outgoing",
    depth: 1
  });

  // 2. Check dependencies (I depend on database)
  const myDeps = await get_edges({
    node_id: myTaskId,
    direction: "outgoing",
    type: "depends_on"
  });

  console.log("I depend on:", myDeps.edges.length, "tasks");

  // 3. Wait for database task to complete
  for (const dep of myDeps.edges) {
    const depEdge = await get_edges({
      node_id: dep.to_node_id,
      direction: "incoming",
      type: "child_of"
    });

    const depStatus = depEdge.edges[0].properties.status;
    console.log(`Database task status: ${depStatus}`);

    while (depStatus !== "done") {
      console.log("Waiting for database task...");
      await sleep(5000); // Poll every 5 seconds

      // Check again
      const updated = await get_edges({
        node_id: dep.to_node_id,
        direction: "incoming",
        type: "child_of"
      });
      if (updated.edges[0].properties.status === "done") {
        break;
      }
    }
  }

  console.log("Database task complete! Safe to proceed.");

  // 4. Get database findings
  const dbFindings = await traverse({
    node_id: myDeps.edges[0].to_node_id,
    type: "created_by",
    direction: "outgoing",
    depth: 1
  });
  console.log("Database created:", dbFindings.children);

  // 5. Semantic search for OAuth patterns
  const relatedWork = await semantic_search({
    query: "passport.js OAuth endpoints implementation",
    limit: 3
  });

  // 6. Update status to 'doing'
  const myEdge = await get_edges({
    node_id: myTaskId,
    direction: "incoming",
    type: "child_of"
  });
  await update_edge_properties({
    edge_id: myEdge.edges[0].edge_id,
    properties: { status: "doing", started_at: new Date().toISOString() }
  });

  return { siblings: siblingsResult.children, dbFindings, relatedWork };
}
```

### Work
```typescript
// Implement OAuth endpoints using passport.js
const implementation = `
// src/routes/auth.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';

// Google OAuth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  // Find or create user
  const user = await db.users.findOrCreate({
    where: { oauth_provider: 'google', oauth_id: profile.id },
    defaults: {
      email: profile.emails[0].value,
      name: profile.displayName,
      avatar_url: profile.photos[0].value
    }
  });
  done(null, user);
}));

// GitHub OAuth (similar)
// ...

// Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  // Create JWT token
  const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET);
  res.redirect(\`/dashboard?token=\${token}\`);
});
`;

// Create findings note
const findings = await create_knowledge_note({
  text: `# Backend Implementation

**Files Created**:
- src/routes/auth.ts (OAuth endpoints)
- src/config/passport.ts (passport strategies)

**Endpoints**:
- GET /auth/google - Google OAuth flow
- GET /auth/github - GitHub OAuth flow
- GET /auth/callback - OAuth callback handler
- GET /auth/me - Get current user (JWT)
- POST /auth/logout - Clear session

**Dependencies**:
- passport
- passport-google-oauth20
- passport-github2
- jsonwebtoken

**Status**: ✅ Ready for frontend integration
`,
  tags: ["findings", "backend", "oauth", "implemented"],
  project_path: "/Users/user/project"
});

// Link and complete
await create_edge({
  from_node_id: myTaskId,
  to_node_id: findings.node_id,
  type: "created_by",
  properties: { agent: "backend-agent-1", completed_at: new Date().toISOString() }
});

await update_edge_properties({
  edge_id: myEdge.edges[0].edge_id,
  properties: { status: "done", completed_at: new Date().toISOString() }
});
```

**Result**: Backend task complete. OAuth endpoints implemented, waited for database task first.

---

## Agent 3: Frontend Agent

### Initialization
```typescript
async function frontendAgentInit() {
  const myTaskId = "kn_task_frontend_id";

  // 1. Check dependencies (I depend on backend)
  const myDeps = await get_edges({
    node_id: myTaskId,
    direction: "outgoing",
    type: "depends_on"
  });

  // 2. Wait for backend task
  for (const dep of myDeps.edges) {
    const depEdge = await get_edges({
      node_id: dep.to_node_id,
      direction: "incoming",
      type: "child_of"
    });

    while (depEdge.edges[0].properties.status !== "done") {
      console.log("Waiting for backend task...");
      await sleep(5000);
    }
  }

  // 3. Get backend findings
  const backendFindings = await traverse({
    node_id: myDeps.edges[0].to_node_id,
    type: "created_by",
    direction: "outgoing",
    depth: 1
  });

  // 4. Update status
  const myEdge = await get_edges({
    node_id: myTaskId,
    direction: "incoming",
    type: "child_of"
  });
  await update_edge_properties({
    edge_id: myEdge.edges[0].edge_id,
    properties: { status: "doing", started_at: new Date().toISOString() }
  });

  return { backendFindings };
}
```

### Work
```typescript
// Create React components
const components = `
// src/components/auth/LoginButton.tsx
import React from 'react';

export function LoginButton() {
  return (
    <div className="flex gap-4">
      <a href="/auth/google" className="bg-red-500 text-white px-4 py-2 rounded">
        Login with Google
      </a>
      <a href="/auth/github" className="bg-gray-800 text-white px-4 py-2 rounded">
        Login with GitHub
      </a>
    </div>
  );
}

// src/components/auth/UserProfile.tsx
// src/contexts/AuthContext.tsx
// ...
`;

const findings = await create_knowledge_note({
  text: `# Frontend Implementation

**Components Created**:
- LoginButton.tsx - Google/GitHub login buttons
- CallbackHandler.tsx - OAuth callback handler
- UserProfile.tsx - Display user info
- AuthContext.tsx - Auth state provider

**Styling**: Tailwind CSS
**State Management**: React Context

**Integration**: Connected to backend /auth endpoints

**Status**: ✅ Feature complete
`,
  tags: ["findings", "frontend", "react", "implemented"],
  project_path: "/Users/user/project"
});

await create_edge({
  from_node_id: myTaskId,
  to_node_id: findings.node_id,
  type: "created_by",
  properties: { agent: "frontend-agent-1", completed_at: new Date().toISOString() }
});

await update_edge_properties({
  edge_id: myEdge.edges[0].edge_id,
  properties: { status: "done", completed_at: new Date().toISOString() }
});
```

**Result**: Frontend task complete. UI components created, waited for backend task first.

---

## Final Results (Main Session)

```typescript
// Check Kanban board
const board = await get_project_tasks({
  project_node_id: project.node_id
});

console.log("Project Status:");
console.log("- Todo:", board.todo.length);      // 0
console.log("- Doing:", board.doing.length);     // 0
console.log("- Done:", board.done.length);       // 3
console.log("- Total:", board.total);            // 3

// Get all findings
const findings = await traverse({
  node_id: project.node_id,
  type: "created_by",
  direction: "outgoing",
  depth: 2
});

console.log("All Deliverables:");
findings.children.forEach(task => {
  console.log(\`- \${task.node.content.title}\`);
  task.children.forEach(finding => {
    console.log(\`  - \${finding.node.content.text.split('\\n')[0]}\`);
  });
});
```

**Output:**
```
Project Status:
- Todo: 0
- Doing: 0
- Done: 3
- Total: 3

All Deliverables:
- Task: Database Schema
  - # Database Implementation
- Task: Backend API
  - # Backend Implementation
- Task: Frontend UI
  - # Frontend Implementation
```

---

## What Made This Work

### 1. **Shared Project Context**
All 3 agents could see:
- Project requirements and goals
- Sibling tasks (who else is working on this)
- Related work from semantic search

### 2. **Dependency Tracking**
Agents automatically waited for dependencies:
- Backend waited for Database (users table)
- Frontend waited for Backend (OAuth endpoints)

### 3. **Status Broadcasting**
Status updates in edge properties enabled:
- Kanban board view
- Dependency waiting logic
- Progress monitoring

### 4. **Findings Linking**
Each agent produced findings note linked via `created_by` edge:
- Easy to find what each agent produced
- Permanent record of work done
- Traceable back to task

### 5. **No Duplication**
Agents saw each other's work via:
- Sibling task discovery
- Related semantic search
- Findings linked to tasks

---

## Time Comparison

**Without edges (traditional)**:
- Total: ~25 minutes
- Duplication: Backend re-researched OAuth patterns
- Blocking: Frontend started before backend ready
- Coordination: Manual status checking

**With edges (coordinated)**:
- Total: ~15 minutes
- No duplication: Each agent saw others' work
- Automatic blocking: Agents waited for dependencies
- Coordination: Status in edge properties

**Savings**: 10 minutes (40% faster)

---

## Key Takeaways

1. **Project knowledge note** serves as coordination hub
2. **Edges structure** the work (parent → child → findings)
3. **Dependencies prevent conflicts** (backend waits for database)
4. **Status properties** enable Kanban view and coordination
5. **findings notes** preserve outputs for reference

---

**Try it yourself**: Use the graph edges system for your next multi-agent project!

**Documentation**:
- Usage Guide: `docs/GRAPH_EDGES_USAGE.md`
- Design: `docs/plans/2026-02-21-graph-edges-design.md`
- Tools: `TOOLS.md` (Graph Tools section)
