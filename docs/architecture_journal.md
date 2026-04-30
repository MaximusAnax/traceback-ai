# TraceBack Architecture Journal

This document is the project memory for architecture decisions, sequencing, and constraints. Update it whenever a decision impacts system shape, runtime behavior, or cost profile.

## 2026-04-30 - Bootstrap Baseline

### Decisions

1. **Asynchronous first:** all incident processing flows through BullMQ (`maintenance:ingest` queue) and never executes synchronously in webhook handlers.
2. **Typed contracts:** incident and inter-agent packets are validated with Zod.
3. **Swarm roles:** Maestro (planning), Surgeon (implementation), Verifier (audit) are implemented as explicit orchestration modules.
4. **SDK integration point:** Surgeon now calls `@cursor/sdk` through `runCursorPrompt`.
5. **Evidence policy:** artifact URI surfaces are present in verifier output and must gate merge readiness.

### Implementation Snapshot

- Server entry: `src/server/fastify.ts`
- Sentry route: `src/server/routes/sentry-webhook.ts`
- Queue setup: `src/queue/*`
- Worker loop: `src/queue/workers/maintenance.worker.ts`
- Orchestration: `src/orchestration/*`

### Known Gaps

1. Maestro and Verifier still use deterministic local logic and should be upgraded to model-routed SDK calls.
2. Sentry MCP deep context provider is not wired yet.
3. E2B + Cursor Cloud hybrid sandbox drivers are not yet implemented.
4. Artifact generation is represented as URIs, but capture/persistence tooling still needs implementation.

### Next Ordered Milestones

1. Add model router module with budget-aware routing (Opus/Codex/Mini).
2. Implement Sentry MCP context enrichment pipeline before planning phase.
3. Introduce sandbox orchestrator with E2B-first reproduction fallback.
4. Implement verifier gates that enforce evidence artifacts.
5. Add PR publishing stage with structured review packets.

## 2026-04-30 - Webhook Hardening (Path A)

### Decisions

1. Adopt native Sentry webhook verification rather than custom signatures.
2. Validate HMAC over raw request bytes to avoid serializer mismatch.
3. Enforce timestamp freshness guard to reduce replay risk.

### Implementation

- Registered `fastify-raw-body` to preserve raw payload bytes for signature verification.
- Updated `/webhooks/sentry` verification flow to use:
  - `x-sentry-hook-signature` or `sentry-hook-signature`
  - `x-sentry-hook-timestamp` or `sentry-hook-timestamp`
  - `HMAC_SHA256(secret, rawBody)` comparison with constant-time check.
- Added `SENTRY_HOOK_MAX_AGE_SECONDS` configuration.

### Operational Notes

- Local testing requires exposing port `3000` (server default) and setting Sentry webhook URL to `https://<tunnel-domain>/webhooks/sentry`.

## 2026-04-30 - Weave Trace Sink Hardening

### Decisions

1. Keep local append-only JSONL trace stream as the authoritative OSS-safe audit path.
2. Add optional W&B/Weave remote export as a best-effort secondary sink.
3. Never fail maintenance jobs due to remote observability transport errors.

### Implementation

- Added sink mode controls in env schema:
  - `WEAVE_SINK_MODE` (`local` or `wandb`)
  - `WEAVE_REMOTE_TIMEOUT_MS`
  - `WANDB_BASE_URL`, `WANDB_API_KEY`, `WANDB_ENTITY`, `WANDB_PROJECT`
- Updated `src/observability/weave.ts`:
  - Always writes local JSONL trace event.
  - Optionally exports to W&B with timeout and warning-only failure handling.
- Added `src/observability/weave.test.ts` coverage for local write path and remote-failure tolerance.

### Operational Notes

- For `WEAVE_SINK_MODE=wandb`, missing credentials/config result in warning logs and continued local trace persistence.

## 2026-04-30 - Sandbox Orchestrator (E2B-first)

### Decisions

1. Reproduction attempts run before planning to improve Maestro context quality.
2. Reproduction strategy is ordered: E2B first, Cursor Cloud fallback second.
3. Reproduction failures or skips must not block the maintenance pipeline.

### Implementation

- Added typed reproduction packet contract:
  - `src/contracts/reproduction-packet.ts`
- Added orchestrator:
  - `src/sandbox/reproduction-orchestrator.ts`
  - E2B execution path uses `E2B_REPRO_COMMAND` with injected incident context env.
  - Cursor Cloud fallback uses SDK prompt path when cloud runtime is configured.
- Worker wiring:
  - `src/queue/workers/maintenance.worker.ts` now runs reproduction before Maestro.
  - Reproduction summary/status are passed into Maestro prompt context.
- Evidence updates:
  - Added `reproduction-log.json` artifact alongside reasoning and decision logs.

### Operational Notes

- E2B path is disabled unless both `E2B_API_KEY` and `E2B_REPRO_COMMAND` are configured.
- Fallback to Cursor Cloud reproduction is skipped unless `CURSOR_RUNTIME=cloud` and repo URL are configured.

## 2026-04-30 - Evidence Gate Detail Hardening

### Decisions

1. Verification gate output should be machine-readable at per-artifact granularity.
2. Gate failures remain non-ambiguous and deterministic with explicit missing artifact records.

### Implementation

- Expanded `VerificationPacket` with `gateChecks` (artifact URI + existence + required flag).
- Updated evidence gate evaluator to return both aggregate decision and check-level details.
- Updated verifier orchestration to include `gateChecks` in outbound packet.
- Added focused unit tests for gate pass/fail behavior and check record correctness.

### Operational Notes

- Any downstream PR publisher or UI should prefer `gateChecks` over string parsing for artifact audit display.

## 2026-04-30 - Structured PR Review Packet Stage

### Decisions

1. PR publishing stage should first emit a deterministic, machine-readable review packet artifact.
2. Recommendation generation is gate-driven (`PASS => open-pr`, `FAIL => hold`).
3. Side-effectful GitHub operations remain optional and mode-gated.

### Implementation

- Added review packet schema + envelope contract:
  - `src/contracts/review-packet.ts`
- Added publisher:
  - `src/publishing/review-publisher.ts`
  - Persists `review-packet.json` using configurable template path with `{traceId}` substitution.
- Worker integration:
  - Publishing now runs after verification.
  - Logger includes recommendation and packet path.
- Added env controls for publish mode and branch targeting metadata.

### Operational Notes

- Current `github` mode captures metadata intent in the packet; direct `gh` branch/PR mutation is intentionally deferred.
