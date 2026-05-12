# TraceBack Implementation Status

Last updated: 2026-05-12

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
- `implemented` - Bounded depth-1 `/multitask`-style subagent task/result packets are wired into Maestro/Surgeon orchestration.

### Evidence-driven verification

- `implemented` - Decision logs, reproduction logs, rule audit, visual-regression, and video-demo artifacts are generated and gated.
- `partial` - Video demo and visual regression currently use Playwright MCP/Cursor Cloud when configured and deterministic skip artifacts otherwise.

### MCP tooling and integration

- `implemented` - Sentry MCP context ingestion is wired with runtime bridge, retries/timeouts, and fallback.
- `implemented` - Playwright MCP adapter hooks exist for visual verification and external knowledge lookup.

### Resource-optimized model roles

- `partial` - Model routing for Maestro/Surgeon/Verifier is implemented, but defaults do not fully match the exact model targets in requirements (for example Surgeon target).

## 2) Technical Design Coverage

### Async maintenance pipeline

- `implemented` - Fastify webhook producer, BullMQ queue, Redis worker loop are in place.
- `implemented` - Sentry and GitHub webhook ingestion paths normalize into `MaintenanceJob`.

### Hybrid sandbox strategy (E2B + Cursor Cloud)

- `partial` - Reproduction orchestrator uses E2B-first and Cursor Cloud fallback strategy.
- `implemented` - E2B path uses a direct optional SDK adapter and injects reproduction context into sandbox execution.
- `partial` - Integrated browser verification is adapter-backed and requires Cursor Cloud + Playwright MCP configuration for live capture.

### SDK wrapper agent loop

- `implemented` - SDK wrapper pattern is used for role runs (`Agent.create` + `send` + result envelope persistence).
- `implemented` - Dedicated rule-audit stage emits `rule-audit.json` and feeds verifier/review packet risk data.

### Open-source vs SaaS boundary

- `implemented` - OSS core behavior is present: CLI, queue/orchestration, artifacts, BYOK config.
- `partial` - SaaS governance scaffolding exists in this repo with identity/storage/audit adapters and review-packet dashboard routes; full OIDC/SCIM provider integrations remain adapter-level follow-up work.

## 3) Implemented Milestones Snapshot

- Budget-aware role model router.
- SDK-backed Maestro/Surgeon/Verifier runs with persisted run envelopes.
- Sentry context source modes (`inline`, `fixture`, `mcp`) and MCP runtime bridge.
- Weave-aligned trace events with local JSONL sink and optional W&B export.
- E2B-first reproduction orchestration with Cursor Cloud fallback.
- Evidence gate with per-artifact checks.
- Structured review packet publishing.
- Optional mode-gated branch/commit/`gh pr create` side effects and publish-result tracking.
- GitHub webhook ingestion producer path.
- Bounded subagent orchestration packets.
- Rule-audit and visual-evidence verification stages.
- SaaS governance adapters and review-packet dashboard routes.

## 4) Backlog (Prioritized)

1. Exercise live Cursor Cloud + Playwright MCP visual capture against a real frontend fixture.
2. Validate the optional E2B SDK adapter against the installed production E2B package/API.
3. Add full OIDC token verification and SCIM protocol endpoints behind the governance adapters.
4. Add hosted artifact storage adapter for SaaS deployments.
5. Add end-to-end dry-run worker integration with mocked Cursor/E2B/GitHub side effects.
