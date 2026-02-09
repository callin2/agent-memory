# Dialog Parts - AI Agent Memory System Design

This directory contains the DIALOG.md file split into 12 topic-based sections for easier navigation and reference.

## File Overview

| File | Size | Topic |
|------|------|-------|
| `01_initial_research.md` | 6.9K | Core problem definition and architectural patterns for AI agent memory systems |
| `02_comparison_systems.md` | 33K | Detailed comparison: OpenClaw vs Claude Code vs Oh-My-OpenCode memory architectures |
| `03_spec_v1_formal.md` | 6.7K | Formal specification v1 with design principles and terminology |
| `04_spec_v1.1_65K_acb.md` | 11K | Spec v1.1 - 65K Active Context Budget (ACB) + fast curation requirements |
| `05_spec_v1.2_zero_dependency.md` | 7.2K | Spec v1.2 - Zero dependency baseline with micro-indexes |
| `06_scenarios_discussion.md` | 8.0K | Discussion about scenario-driven validation approach |
| `07_acceptance_scenarios.md` | 8.2K | 12 acceptance scenarios (A1-A12) for testing the memory system |
| `08_scenario_a1_legacy_onboarding.md` | 6.6K | Detailed Scenario A1: Legacy Project Onboarding workflow |
| `09_spec_validation.md` | 8.0K | Spec validation against Scenario A1 - API and I/O verification |
| `10_multi_agent_daemon.md` | 3.6K | Multi-agent daemon architecture and MCP compatibility |
| `11_spec_v2_redesign_thin_daemon.md` | 6.9K | Spec v2 redesign - Thin Memory Daemon with database support |
| `12_spec_v2.0_postgres_final.md` | 9.6K | Final Spec v2.0 - PostgreSQL-backed implementation |

## Conversation Flow

The dialogue evolves through the following stages:

1. **Initial Research** - Understanding the core problem of persisting almost all dialog while keeping active LLM context small
2. **Comparative Analysis** - Learning from existing systems (OpenClaw, Claude Code, Oh-My-OpenCode)
3. **Spec v1** - Formal specification with filesystem-first approach
4. **Spec v1.1** - Adding 65K token budget constraint and performance requirements
5. **Spec v1.2** - Zero dependency constraint with micro-index architecture
6. **Scenario Design** - Defining acceptance test scenarios
7. **Scenario Detail** - Working through specific scenarios (e.g., legacy project onboarding)
8. **Spec Validation** - Verifying APIs and I/O contracts against scenarios
9. **Multi-Agent** - Adapting for daemon/service architecture serving multiple agents
10. **Spec v2** - Redesigning for simplicity using external dependencies
11. **Final Spec** - PostgreSQL-backed thin daemon implementation

## Key Design Principles

Across all versions, these principles remain:
- P1: Ground truth is append-only
- P2: Derived views are disposable
- P3: Active context is a curated product
- P4: Traceability by reference
- P5: Least-privilege memory loading
- P6: Human-legible override
- P7: Determinism where possible
- P8: Scenario-driven validation
