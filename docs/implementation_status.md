# TraceBack Implementation Status

Last updated: 2026-04-30

This document tracks implementation coverage against the guiding specs:

- `docs/product_requirements.md`
- `docs/technical_design.md`

Status legend:

- `implemented`: Present in code and wired into the runtime flow.
- `partial`: Implemented in part, but missing key behavior from spec intent.
- `backlog`: Not implemented yet.

## 1) Product Requirements Coverage

### Programmatic orchestration (`@cursor/sdk`)

- `implemented` - Cursor SDK headless runs are used by orchestration roles through `src/orchestration/cursor-agent.ts`.
- `backlog` - Subagent multitasking (`/multitask` protocol) is not yet wired into runtime orchestration.

### Evidence-driven verification

- `partial` - Decision logs and verification artifacts are generated and gated.
- `backlog` - Video demo artifact generation is not implemented.
- `backlog` - Visual regression via integrated VM browser is not implemented in verifier flow.

### MCP tooling and integration

- `implemented` - Sentry MCP context ingestion is wired with runtime bridge, retries/timeouts, and fallback.
- `backlog` - Playwright MCP (external docs/wiki navigation) is not integrated.

### Resource-optimized model roles

- `partial` - Model routing for Maestro/Surgeon/Verifier is implemented, but defaults do not fully match the exact model targets in requirements (for example Surgeon target).

## 2) Technical Design Coverage

### Async maintenance pipeline

- `implemented` - Fastify webhook producer, BullMQ queue, Redis worker loop are in place.
- `partial` - Sentry ingestion is implemented; GitHub webhook ingestion path is not yet implemented.

### Hybrid sandbox strategy (E2B + Cursor Cloud)

- `partial` - Reproduction orchestrator uses E2B-first and Cursor Cloud fallback strategy.
- `partial` - E2B path is command-driven (`E2B_REPRO_COMMAND`), not yet a direct E2B SDK integration.
- `backlog` - Integrated browser-based visual verification in cloud runtime is not yet implemented.

### SDK wrapper agent loop

- `implemented` - SDK wrapper pattern is used for role runs (`Agent.create` + `send` + result envelope persistence).
- `partial` - Audit pass against rules exists by policy and prompts, but no explicit dedicated rule-audit stage yet.

### Open-source vs SaaS boundary

- `implemented` - OSS core behavior is present: CLI, queue/orchestration, artifacts, BYOK config.
- `backlog` - SaaS governance features (OIDC/SCIM identity binding, enterprise action signing, hosted comprehension dashboard) are not implemented in this repo.

## 3) Implemented Milestones Snapshot

- Budget-aware role model router.
- SDK-backed Maestro/Surgeon/Verifier runs with persisted run envelopes.
- Sentry context source modes (`inline`, `fixture`, `mcp`) and MCP runtime bridge.
- Weave-aligned trace events with local JSONL sink and optional W&B export.
- E2B-first reproduction orchestration with Cursor Cloud fallback.
- Evidence gate with per-artifact checks.
- Structured review packet publishing.
- Optional mode-gated `gh pr create` side effects and publish-result tracking.

## 4) Backlog (Prioritized)

1. Add runtime subagent multitasking for complex fixes.
2. Implement video demo artifact capture in verification flow.
3. Add browser-based visual regression verification in cloud runtime.
4. Integrate Playwright MCP for external knowledge workflows.
5. Add GitHub webhook ingestion producer path.
6. Replace command-based E2B path with direct E2B SDK/tool integration.
7. Add SaaS governance layer items (identity binding, hosted comprehension artifacts).
