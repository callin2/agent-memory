# Agent Mental Models for Coordination

**Research Date**: 2026-02-22
**Researcher**: Mental Model Researcher Agent

## Executive Summary

When agents want to "share findings with the team", they naturally look for **post/share/create** verbs, but the current system uses `create_knowledge_note` for this purpose. The coordination model combines **BBS (Bulletin Board System)** for knowledge sharing + **Kanban** for task status.

## Key Findings

### 1. What Agents Naturally Look For

When an agent wants to share findings, they intuitively search for:
- **Verbs**: `post`, `share`, `publish`, `create_finding`, `report`
- **Nouns**: `BBS`, `bulletin`, `board`, `channel`, `team_feed`
- **Patterns**: "post to team", "share findings", "report results"

**Current Reality**: The tool is `create_knowledge_note` - which doesn't signal "team communication" clearly.

### 2. Core Terminology Mapping

| Concept | Current Term | Agent Mental Model |
|---------|--------------|-------------------|
| Knowledge sharing | `create_knowledge_note` | post/share/publish |
| Task status | `update_edge_properties` | update_status/mark_done |
| Project view | `get_project_tasks` | kanban/board/overview |
| Dependencies | `depends_on` edge | blocks/wait_for |
| Attribution | `created_by` edge | produced_by/authored_by |

### 3. Common Coordination Workflows

**Agent Initialization Pattern**:
```
1. Find parent project (traverse child_of)
2. Read project requirements
3. Discover sibling tasks (avoid duplication)
4. Check dependencies (wait if blocked)
5. Semantic search for related work
6. Update status to "doing"
```

**Work Completion Pattern**:
```
1. Create findings knowledge note
2. Link task → findings (created_by edge)
3. Update task status to "done"
4. Include concrete outputs (code, SQL, schemas)
```

**Dependency Waiting Pattern**:
```
1. Get depends_on edges
2. Poll dependency status
3. When status === "done", proceed
4. Get dependency findings via traverse
```

### 4. What Makes Systems Intuitive

1. **Clear Mental Models**: BBS (post findings) + Kanban (task tracking)
2. **Natural Discoverability**: Traverse relationships, semantic search
3. **Standardized Output**: Consistent tagging, automatic attribution
4. **Progress Transparency**: Kanban view, status properties

### 5. Terminology Gaps

| Current Tool | Intuitive Name |
|--------------|----------------|
| `create_knowledge_note` | `post_finding` / `share_with_team` |
| `update_edge_properties` | `update_task_status` |
| `get_project_tasks` | `get_kanban_board` |

## Recommendations

1. **Add Aliases**: `post_finding()`, `get_team_findings()`, `update_status()`
2. **Naming Clarity**: Emphasize "BBS" metaphor, use "post" language
3. **Agent Onboarding**: Standard init script template
4. **Tool Discoverability**: Group coordination tools, decision trees

## Tags

mcp, mental-models, redesign-2026-02, coordination, multi-agent, research
