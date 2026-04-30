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

## 2026-04-30 (Phase 6 - Sandbox Orchestrator)

### Completed

- Added E2B-first reproduction orchestrator in `src/sandbox/reproduction-orchestrator.ts`:
  - Driver order: `e2b` then `cursor-cloud` fallback
  - Outcome contract captured in `src/contracts/reproduction-packet.ts`
  - Reproduction attempt emits Weave trace events for auditability.
- Wired worker flow to run reproduction before planning:
  - `maintenance.worker` now executes `runReproductionOrchestrator(payload)`
  - Maestro receives reproduction status/summary as additional planning context.
- Extended evidence artifact recorder:
  - Added `artifacts/<traceId>/reproduction-log.json`
  - Decision log now includes reproduction payload for reviewer context.
- Extended verifier artifact URI set to include `reproduction-log.json`.
- Added sandbox orchestrator test coverage in:
  - `src/sandbox/reproduction-orchestrator.test.ts`
  - validates deterministic SKIP behavior when drivers are not configured.

### Blocker

- Live E2B reproduction requires runtime `E2B_API_KEY` and a concrete `E2B_REPRO_COMMAND` implementation.

## 2026-04-30 (Phase 7 - Evidence Gate Detail Hardening)

### Completed

- Strengthened evidence gate output contract:
  - `VerificationPacket` now includes `gateChecks` with per-artifact existence details.
- Updated gate evaluator (`src/verification/gate.ts`) to return:
  - `passed`
  - `failures`
  - `checks` with `{ artifactUri, exists, required }`.
- Updated verifier to thread detailed gate checks into final packet output.
- Added gate evaluator tests in `src/verification/gate.test.ts`:
  - PASS path with all artifacts present
  - FAIL path with missing artifact and explicit check detail assertion.
- Updated README to document artifact-level verifier gate visibility.

### Blocker

- None in code path; full value depends on downstream surfaces consuming `gateChecks` (CLI/UI/reporting).

## 2026-04-30 (Phase 8 - Structured PR Review Packet)

### Completed

- Added structured review packet contracts in `src/contracts/review-packet.ts`.
- Added review packet publisher in `src/publishing/review-publisher.ts`:
  - Persists normalized review envelope artifact.
  - Includes publish metadata (`mode`, `baseBranch`, `headBranch`, `repository`) and recommendation (`open-pr` or `hold`).
- Wired worker to publish review packet after verification:
  - `maintenance.worker` now logs review packet path + recommendation.
  - Worker return payload now includes `review`.
- Added env controls for publishing stage:
  - `PR_PUBLISH_MODE` (`disabled`, `dry-run`, `github`)
  - `PR_REVIEW_PACKET_PATH`
  - `GITHUB_REPOSITORY`
  - `GITHUB_BASE_BRANCH`
  - `GITHUB_HEAD_BRANCH_PREFIX`
- Added unit coverage in `src/publishing/review-publisher.test.ts` for artifact generation and recommendation encoding.

### Blocker

- `PR_PUBLISH_MODE=github` currently publishes structured packet metadata only; full branch/PR side effects via `gh` are not yet executed in-process.

## 2026-04-30 (Phase 9 - GitHub Publish Side Effects)

### Completed

- Upgraded review packet publishing to execute optional GitHub PR creation when:
  - `PR_PUBLISH_MODE=github`
  - recommendation is `open-pr`
  - `GITHUB_REPOSITORY` is configured.
- `src/publishing/review-publisher.ts` now:
  - invokes `gh pr create` with configured base/head metadata
  - captures publish outcome status (`skipped`, `created`, `failed`)
  - records PR URL when available.
- Review packet contract extended with publish execution result metadata:
  - `payload.publish.result.{attempted,status,prUrl,reason}`
- Worker logs now include publish status and PR URL (when created).
- Added unit coverage updates in `src/publishing/review-publisher.test.ts`:
  - dry-run skipped status
  - github mode failure path when repository is missing.

### Blocker

- Successful `gh pr create` execution requires pre-existing head branch and authenticated GitHub CLI context at runtime.
