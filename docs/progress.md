# TraceBack Progress

## 2026-04-30

### Completed

- Repository initialized with strict TypeScript + Node scaffolding.
- BullMQ ingestion queue and maintenance worker loop implemented.
- Fastify Sentry webhook route implemented with Zod payload validation.
- Native Sentry webhook signature verification implemented:
  - `x-sentry-hook-signature` / `sentry-hook-signature`
  - `x-sentry-hook-timestamp` / `sentry-hook-timestamp`
  - HMAC-SHA256 on raw request body
  - stale timestamp rejection via `SENTRY_HOOK_MAX_AGE_SECONDS`
- `@cursor/sdk` integrated into Surgeon execution path.
- Baseline docs added (`README`, architecture journal).

### In Progress

- Cursor model catalog discovery and model-ID alignment for Maestro/Surgeon/Verifier.

### Completed (Update)

- Cursor model discovery completed against account API key.
- Default routed model IDs aligned to account-available slugs:
  - Maestro: `claude-opus-4-6`
  - Surgeon: `gpt-5.3-codex`
  - Verifier: `gpt-5-mini`

### Blockers

- None at this stage.

### Next

1. Complete model discovery and lock env model IDs.
2. Add budget-aware model router module.
3. Upgrade Maestro and Verifier to SDK-backed runs.
4. Add MCP-ready Sentry context provider interface.
5. Enforce evidence gate artifacts before PR-ready transitions.

## 2026-04-30 (Implementation Wave 2)

### Completed

- Added budget-aware model router in `src/orchestration/model-router.ts`.
- Upgraded Maestro and Verifier orchestration paths to SDK-backed prompts with fallbacks.
- Added MCP-ready Sentry context provider contract and inline provider implementation.
- Added evidence artifact recorder and gate checks:
  - `src/verification/artifact-recorder.ts`
  - `src/verification/gate.ts`
- Worker now records reasoning/decision artifacts before verification gate execution.

## 2026-04-30 (Phase 3)

### Completed

- Added runtime-selectable Cursor SDK driver path (`local` or `cloud`) with env control.
- Added structured run envelope contract with run metadata and cost estimate.
- Added run envelope persistence under `artifacts/<traceId>/runs/<role>.json`.
- Upgraded Surgeon to require structured JSON output and validate with `ChangeSetPacketSchema`.
- Added robust JSON extraction utility for model responses containing surrounding text.

## 2026-04-30 (Phase 4 - Context Ingestion)

### Completed

- Added pluggable Sentry context provider factory with source modes:
  - `inline`
  - `fixture`
  - `mcp`
- Added deterministic replay fixture at `fixtures/sentry/sample-incident.json`.
- Wired Maestro to provider factory so discovery context source is environment-selectable.
- Added in-process MCP stdio runtime bridge:
  - Loads server command/args/env from `.cursor/mcp.json`
  - Resolves `${ENV_VAR}` templates before launch
  - Calls configured `SENTRY_MCP_TOOL` and parses structured output into `SentryContextEnvelope`
- Added Phase 4.1 resilience hardening:
  - Maestro now degrades gracefully to inline context if fixture/MCP provider fails.
  - MCP tool calls now have timeout + retry controls (`SENTRY_MCP_TIMEOUT_MS`, `SENTRY_MCP_MAX_RETRIES`).
- Added Weave-aligned action trace recording:
  - JSONL event stream at `artifacts/weave-trace.jsonl` (configurable via `WEAVE_TRACE_LOG_PATH`)
  - Events emitted for worker lifecycle, MCP context fetch, and Maestro/Surgeon/Verifier model runs.
- Added MCP parser tests in `src/providers/sentry/sentry-mcp-parser.test.ts` covering:
  - structuredContent path
  - text JSON fallback path
  - malformed response failure path

### Blocker

- None in code path; live pulls require valid Sentry MCP credentials/tool access at runtime.

## 2026-04-30 (Phase 5 - Traceability Sink Hardening)

### Completed

- Added dual-mode Weave trace sink configuration:
  - `WEAVE_SINK_MODE=local|wandb`
  - Existing JSONL local sink remains default and always-on persistence path.
- Added optional W&B Weave export path in `src/observability/weave.ts`:
  - Remote POST with bearer auth and timeout budget (`WEAVE_REMOTE_TIMEOUT_MS`)
  - Non-fatal export behavior with warning logs; local trace persistence is preserved.
- Added new env contracts for remote Weave sink:
  - `WANDB_BASE_URL`
  - `WANDB_API_KEY`
  - `WANDB_ENTITY`
  - `WANDB_PROJECT`
- Added observability tests in `src/observability/weave.test.ts` for:
  - local JSONL trace persistence
  - remote sink failure tolerance (no throw + local persistence intact)

### Blocker

- Remote W&B sink requires valid credentials and project/entity routing at runtime.
